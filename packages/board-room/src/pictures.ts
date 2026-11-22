// SPDX-License-Identifier: Apache-2.0
import type { Board } from "nextphase-board-rules/document.ts";
import { isImage } from "nextphase-board-rules/objects/registry.ts";
import type { Row, Storage } from "./storage.ts";
import type { RoomEnvironment } from "./interfaces.ts";

export const PART_BYTES = 1_048_576, PICTURE_BYTES = 20_971_520, BOARD_BYTES = 52_428_800;
export const RECENT_UPLOAD = 86_400_000, MAX_SIDE = 4_096;
const types = ["image/png", "image/jpeg", "image/gif", "image/webp"] as const;
export type PictureType = typeof types[number];

export function pictureHeader(data: Uint8Array) {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const tag = (at: number, size: number) => String.fromCharCode(...data.subarray(at, at + size));
  const size = (type: PictureType, width: number, height: number) => width && height ? { type, width, height } : null;
  if (data.length >= 24 && tag(0, 8) === "\x89PNG\r\n\x1a\n" && tag(12, 4) === "IHDR") {
    return size("image/png", view.getUint32(16), view.getUint32(20));
  }
  if (data.length >= 10 && ["GIF87a", "GIF89a"].includes(tag(0, 6))) {
    return size("image/gif", view.getUint16(6, true), view.getUint16(8, true));
  }
  if (tag(0, 3) === "\xff\xd8\xff") {
    let at = 2;
    while (at < data.length && data[at] === 255) {
      while (data[at] === 255) at++;
      const marker = data[at++];
      if (marker === 1 || marker >= 0xd0 && marker <= 0xd7) continue;
      if (marker === 0xd9 || marker === 0xda || at + 2 > data.length) return null;
      const length = view.getUint16(at);
      if (length < 2 || at + length > data.length) return null;
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
        return length >= 8 ? size("image/jpeg", view.getUint16(at + 5), view.getUint16(at + 3)) : null;
      }
      at += length;
    }
  }
  if (tag(0, 4) === "RIFF" && tag(8, 4) === "WEBP") {
    const chunk = tag(12, 4);
    if (chunk === "VP8 " && data.length >= 30) return size("image/webp", view.getUint16(26, true) & 0x3fff, view.getUint16(28, true) & 0x3fff);
    if (chunk === "VP8L" && data.length >= 25 && data[20] === 47) {
      const packed = view.getUint32(21, true);
      return size("image/webp", (packed & 0x3fff) + 1, ((packed >>> 14) & 0x3fff) + 1);
    }
    if (chunk === "VP8X" && data.length >= 30) {
      const side = (at: number) => 1 + view.getUint16(at, true) + data[at + 2] * 65536;
      return size("image/webp", side(24), side(27));
    }
  }
  return null;
}

function complete(row: Row, parts: Row[]) {
  const bytes = Number(row.bytes);
  return Number.isSafeInteger(bytes) && bytes > 0 && bytes <= PICTURE_BYTES &&
    row.parts === Math.ceil(bytes / PART_BYTES) && parts.length === row.parts &&
    parts.every((part, i) => part.part === i && part.length === Math.min(PART_BYTES, bytes - i * PART_BYTES));
}

export function held(storage: Storage, hash: string) {
  const row = storage.all("SELECT * FROM pictures WHERE hash = ?", hash)[0];
  return row && complete(row, storage.all("SELECT part, length(data) AS length FROM picture_parts WHERE hash = ? ORDER BY part", hash)) ? row : undefined;
}

function assets(board: Board) { return new Set(board.objects.filter(isImage).map(o => o.asset)); }

export function markPictures(storage: Storage, board: Board, ordinal: number) {
  for (const hash of assets(board)) if (held(storage, hash)) storage.exec("UPDATE pictures SET captured_ordinal = ? WHERE hash = ?", ordinal, hash);
}
function remove(storage: Storage, hash: string) {
  storage.exec("DELETE FROM picture_parts WHERE hash = ?", hash);
  storage.exec("DELETE FROM pictures WHERE hash = ?", hash);
}
export function cleanPictures(storage: Storage, board: Board, now: number) {
  const live = assets(board);
  const oldest = storage.all("SELECT MIN(ordinal) AS oldest FROM versions")[0].oldest;
  for (const row of storage.all("SELECT hash FROM pictures WHERE uploaded_at < ? AND (captured_ordinal IS NULL OR ? IS NULL OR captured_ordinal < ?)", now - RECENT_UPLOAD, oldest, oldest)) {
    if (!live.has(String(row.hash))) remove(storage, String(row.hash));
  }
  storage.exec("DELETE FROM picture_parts WHERE NOT EXISTS (SELECT 1 FROM pictures WHERE pictures.hash = picture_parts.hash)");
}
export function storePicture(s: Storage, board: Board, now: number, hash: string, data: Uint8Array, type: PictureType, width: number, height: number) {
  return s.transaction(() => {
    cleanPictures(s, board, now);
    if (held(s, hash)) {
      s.exec("UPDATE pictures SET uploaded_at = ? WHERE hash = ?", now, hash);
      return "exists" as const;
    }
    let total = data.length;
    for (const row of s.all("SELECT hash FROM pictures")) total += Number(held(s, String(row.hash))?.bytes ?? 0);
    if (total > BOARD_BYTES) return "full" as const;
    remove(s, hash);
    s.exec("INSERT INTO pictures VALUES (?, ?, ?, ?, ?, ?, ?, NULL)", hash, type, data.length, width, height, Math.ceil(data.length / PART_BYTES), now);
    for (let at = 0; at < data.length; at += PART_BYTES) {
      s.exec("INSERT INTO picture_parts VALUES (?, ?, ?)", hash, at / PART_BYTES, data.slice(at, at + PART_BYTES));
    }
    return "created" as const;
  });
}
function join(rows: Row[], bytes: number) {
  const data = new Uint8Array(bytes);
  for (const row of rows) data.set(row.data as Uint8Array, Number(row.part) * PART_BYTES);
  return data;
}
export function readPicture(s: Storage, hash: string) {
  const row = held(s, hash);
  if (!row) return null;
  return { type: String(row.type), bytes: join(s.all("SELECT part, data FROM picture_parts WHERE hash = ? ORDER BY part", hash), Number(row.bytes)) };
}

export async function validatePictures(env: RoomEnvironment, tables: Record<string, Row[]>) {
  const groups = new Map<string, Row[]>();
  for (const row of tables.picture_parts) {
    if (typeof row.hash !== "string" || !(row.data instanceof Uint8Array)) throw Error("bad_picture_part");
    const group = groups.get(row.hash) ?? [];
    group.push({ ...row, length: row.data.length });
    groups.set(row.hash, group);
  }
  const seen = new Set<string>();
  let total = 0;
  for (const row of tables.pictures) {
    if (typeof row.hash !== "string" || !/^[0-9a-f]{64}$/.test(row.hash) || seen.has(row.hash) ||
      !types.includes(row.type as PictureType) || ![row.width, row.height].every(n => Number.isSafeInteger(n) && Number(n) >= 1 && Number(n) <= MAX_SIDE) ||
      !Number.isSafeInteger(row.bytes) || !Number.isSafeInteger(row.uploaded_at) ||
      row.captured_ordinal !== null && (!Number.isSafeInteger(row.captured_ordinal) || Number(row.captured_ordinal) < 1)) throw Error("bad_picture");
    seen.add(row.hash);
    const parts = groups.get(row.hash) ?? [];
    groups.delete(row.hash);
    total += Number(row.bytes);
    if (total > BOARD_BYTES || !complete(row, parts.sort((a,b) => Number(a.part) - Number(b.part))) ||
      await env.hash(join(parts, Number(row.bytes))) !== row.hash) throw Error("bad_picture");
  }
  if (groups.size) throw Error("orphan_picture_part");
}
