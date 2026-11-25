// SPDX-License-Identifier: Apache-2.0
/// <reference lib="dom" />
import type { Board } from "nextphase-board-rules/document.ts";
import { assetsOf } from "nextphase-board-rules/objects/registry.ts";
import { RoomError } from "./protocol.ts";
import type { Row, Storage } from "./storage.ts";
import type { RoomEnvironment } from "./interfaces.ts";

export const PART_BYTES = 1_048_576, PICTURE_BYTES = 20_971_520, BOARD_BYTES = 52_428_800;
export const RECENT_UPLOAD = 86_400_000, MAX_SIDE = 4_096;
const types = ["image/png", "image/jpeg", "image/gif", "image/webp"] as const;
export type PictureType = typeof types[number];

export const VIDEO_BYTES = 52_428_800, BOARD_VIDEO_BYTES = 104_857_600, UPLOAD_IDLE = 60_000;
const videoTypes = ["video/mp4", "video/quicktime", "video/webm"] as const;
export type VideoType = typeof videoTypes[number];
export type AssetType = PictureType | VideoType;
export type AssetEntry = { hash: string; type: AssetType; bytes: number };
export const isVideoType = (type: unknown): type is VideoType => videoTypes.includes(type as VideoType);
export const isPictureType = (type: unknown): type is PictureType => types.includes(type as PictureType);

export function pictureSignature(head: Uint8Array): PictureType | null {
  const text = String.fromCharCode(...head.subarray(0, 64));
  if (head.length >= 24 && text.startsWith("\x89PNG\r\n\x1a\n") && text.slice(12, 16) === "IHDR") return "image/png";
  if (head.length >= 10 && (text.startsWith("GIF87a") || text.startsWith("GIF89a"))) return "image/gif";
  if (text.startsWith("\xff\xd8\xff")) return "image/jpeg";
  if (text.startsWith("RIFF") && text.slice(8, 12) === "WEBP") return "image/webp";
  return null;
}

export function videoType(head: Uint8Array): VideoType | null {
  const text = String.fromCharCode(...head.subarray(0, 64));
  if (text.length >= 12 && text.slice(4, 8) === "ftyp") return text.slice(8, 12) === "qt  " ? "video/quicktime" : "video/mp4";
  if (text.startsWith("\x1a\x45\xdf\xa3") && /\x42\x82(?:\x84|\x01\x00{6}\x04)webm/.test(text.slice(4))) return "video/webm";
  return null;
}

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
  return Number.isSafeInteger(bytes) && bytes > 0 && (isVideoType(row.type) ? bytes <= VIDEO_BYTES : isPictureType(row.type) && bytes <= PICTURE_BYTES) &&
    row.parts === Math.ceil(bytes / PART_BYTES) && parts.length === row.parts &&
    parts.every((part, i) => part.part === i && part.length === Math.min(PART_BYTES, bytes - i * PART_BYTES));
}

export function held(storage: Storage, hash: string) {
  const row = storage.all("SELECT * FROM pictures WHERE hash = ?", hash)[0];
  return row && complete(row, storage.all("SELECT part, length(data) AS length FROM picture_parts WHERE hash = ? ORDER BY part", hash)) ? row : undefined;
}
export function assetEntries(storage: Storage, hashes: string[]): AssetEntry[] {
  return hashes.flatMap(hash => {
    const row = held(storage, hash);
    return row ? [{ hash, type: row.type as AssetType, bytes: Number(row.bytes) }] : [];
  });
}

function assets(board: Board) { return new Set(board.objects.flatMap(assetsOf)); }

export function markPictures(storage: Storage, board: Board, ordinal: number) {
  for (const hash of assets(board)) if (held(storage, hash)) storage.exec("UPDATE pictures SET captured_ordinal = ? WHERE hash = ?", ordinal, hash);
}
function remove(storage: Storage, hash: string) {
  storage.exec("DELETE FROM picture_parts WHERE hash = ?", hash);
  storage.exec("DELETE FROM pictures WHERE hash = ?", hash);
}
export function cleanPictures(storage: Storage, board: Board, now: number, uploads?: VideoUploads) {
  const live = assets(board);
  const oldest = storage.all("SELECT MIN(ordinal) AS oldest FROM versions")[0].oldest;
  for (const row of storage.all("SELECT hash FROM pictures WHERE uploaded_at < ? AND (captured_ordinal IS NULL OR ? IS NULL OR captured_ordinal < ?)", now - RECENT_UPLOAD, oldest, oldest)) {
    if (!live.has(String(row.hash))) remove(storage, String(row.hash));
  }
  const orphan = "NOT EXISTS (SELECT 1 FROM pictures WHERE pictures.hash = picture_parts.hash)";
  const staged = new Set(uploads?.stagingKeys());
  if (!staged.size) storage.exec("DELETE FROM picture_parts WHERE NOT EXISTS (SELECT 1 FROM pictures WHERE pictures.hash = picture_parts.hash)");
  else for (const row of storage.all("SELECT DISTINCT hash FROM picture_parts WHERE " + orphan)) {
    if (!staged.has(String(row.hash))) storage.exec("DELETE FROM picture_parts WHERE hash = ?", row.hash);
  }
}
export function storePicture(s: Storage, board: Board | undefined, now: number, hash: string, data: Uint8Array, type: PictureType, width: number, height: number, uploads?: VideoUploads) {
  return s.transaction(() => {
    if (board) cleanPictures(s, board, now, uploads);
    if (held(s, hash)) {
      s.exec("UPDATE pictures SET uploaded_at = ? WHERE hash = ?", now, hash);
      return "exists" as const;
    }
    let total = data.length;
    for (const row of s.all("SELECT hash FROM pictures WHERE type LIKE 'image/%'")) total += Number(held(s, String(row.hash))?.bytes ?? 0);
    if (total > BOARD_BYTES) return "full" as const;
    remove(s, hash);
    writeAsset(s, now, hash, data, type, width, height);
    return "created" as const;
  });
}
export function writeAsset(s: Storage, now: number, hash: string, data: Uint8Array, type: AssetType, width: number, height: number) {
  s.exec("INSERT INTO pictures VALUES (?, ?, ?, ?, ?, ?, ?, NULL)", hash, type, data.length, width, height, Math.ceil(data.length / PART_BYTES), now);
  for (let at = 0; at < data.length; at += PART_BYTES) {
    s.exec("INSERT INTO picture_parts VALUES (?, ?, ?)", hash, at / PART_BYTES, data.slice(at, at + PART_BYTES));
  }
}
function join(rows: Row[], bytes: number) {
  const data = new Uint8Array(bytes);
  for (const row of rows) data.set(row.data as Uint8Array, Number(row.part) * PART_BYTES);
  return data;
}
export function readAsset(s: Storage, hash: string) {
  const row = held(s, hash);
  return row ? { type: row.type as AssetType, bytes: join(s.all("SELECT part, data FROM picture_parts WHERE hash = ? ORDER BY part", hash), Number(row.bytes)) } : null;
}
export function readPicture(s: Storage, hash: string) {
  const row = held(s, hash);
  if (!row || !isPictureType(row.type)) return null;
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
  let picturesTotal = 0, videosTotal = 0;
  for (const row of tables.pictures) {
    if (typeof row.hash !== "string" || !/^[0-9a-f]{64}$/.test(row.hash) || seen.has(row.hash) ||
      !(isVideoType(row.type) ? row.width === 0 && row.height === 0 : isPictureType(row.type) && [row.width, row.height].every(n => Number.isSafeInteger(n) && Number(n) >= 1 && Number(n) <= MAX_SIDE)) ||
      !Number.isSafeInteger(row.bytes) || !Number.isSafeInteger(row.uploaded_at) ||
      row.captured_ordinal !== null && (!Number.isSafeInteger(row.captured_ordinal) || Number(row.captured_ordinal) < 1)) throw Error("bad_picture");
    seen.add(row.hash);
    const parts = groups.get(row.hash) ?? [];
    groups.delete(row.hash);
    if (!complete(row, parts.sort((a,b) => Number(a.part) - Number(b.part)))) throw Error("bad_picture");
    const first = parts[0].data as Uint8Array;
    if (isVideoType(row.type)) {
      videosTotal += Number(row.bytes);
      if (videosTotal > BOARD_VIDEO_BYTES || pictureSignature(first) || videoType(first) !== row.type) throw Error("bad_video");
      const hasher = env.hasher();
      for (const part of parts) await hasher.update(part.data as Uint8Array);
      if (await hasher.hex() !== row.hash) throw Error("bad_video");
    } else {
      picturesTotal += Number(row.bytes);
      if (picturesTotal > BOARD_BYTES || pictureHeader(first)?.type !== row.type || await env.hash(join(parts, Number(row.bytes))) !== row.hash) throw Error("bad_picture");
    }
  }
  if (groups.size) throw Error("orphan_picture_part");
}

type VideoResult = { result: "created" | "exists" | "full"; type: AssetType; bytes: number };
type Upload = {
  hash: string; key?: string; staged: number; cycle: number; generation: number;
  settled: Promise<boolean>; settle(stored: boolean): void; cancel(error: RoomError): void;
};
type UploadRoom = Pick<import("./room.ts").Room, "env" | "board" | "generation" | "ordered">;
const unavailable = () => new RoomError(503, "service_unavailable");

function videoTotal(storage: Storage) {
  let total = 0;
  for (const { hash } of storage.all("SELECT hash FROM pictures WHERE type LIKE 'video/%'")) {
    total += Number(held(storage, String(hash))?.bytes ?? 0);
  }
  return total;
}

export class VideoUploads {
  private entries = new Set<Upload>();
  private cycle = 0;
  stagingKeys() { return [...this.entries].flatMap(entry => entry.key ? [entry.key] : []); }
  private staged() { return [...this.entries].reduce((n, entry) => n + entry.staged, 0); }
  invalidate(status: 404 | 410 | 503) {
    this.cycle++;
    for (const entry of this.entries) entry.cancel(status === 404 ? new RoomError(404, "not_found")
      : status === 410 ? new RoomError(410, "upload_expired") : unavailable());
  }

  async store(room: UploadRoom, hash: string, type: VideoType, body: ReadableStream<Uint8Array>, authorize: (bytes?: number) => Promise<void>, importing = false): Promise<VideoResult> {
    const { env } = room, s = env.storage, reader = body.getReader(), digest = env.hasher();
    let settle!: (stored: boolean) => void, interrupt!: (reason: RoomError) => void;
    const settled = new Promise<boolean>(resolve => { settle = resolve; });
    const interrupted = new Promise<never>((_, reject) => { interrupt = reject; });
    let problem: RoomError | undefined, owner: Upload | undefined, stopTimer: (() => void) | undefined;
    let bytes = 0, index = 0, offset = 0, buffer: Uint8Array<ArrayBuffer> | undefined;
    const full: VideoResult = { result: "full", type, bytes: 0 };
    const removeStaging = () => {
      if (entry.key) s.exec("DELETE FROM picture_parts WHERE hash = ?", entry.key);
      entry.staged = 0;
    };
    const cleanup = () => {
      stopTimer?.();
      if (this.entries.delete(entry) && entry.staged) {
        try { s.transaction(removeStaging); } catch { /* The next clean-up removes abandoned parts. */ }
      }
    };
    const entry: Upload = { hash, cycle: this.cycle, generation: room.generation, staged: 0,
      settled, settle, cancel: error => {
        if (problem) return;
        problem = error;
        cleanup();
        void reader.cancel().catch(() => {});
        digest.abort?.();
        entry.settle(false);
        interrupt(error);
      } };
    const check = () => {
      if (problem) throw problem;
      if (entry.cycle !== this.cycle || room.generation !== entry.generation) throw unavailable();
    };
    const arm = () => { stopTimer?.(); stopTimer = env.timer(UPLOAD_IDLE, () => entry.cancel(unavailable())); };
    const stage = (part: Uint8Array) => s.transaction(() => {
      check();
      if (videoTotal(s) + this.staged() + part.length > BOARD_VIDEO_BYTES) throw new RoomError(409, "board_videos_full");
      s.exec("INSERT INTO picture_parts VALUES (?, ?, ?)", entry.key!, index++, part);
      entry.staged += part.length;
    });
    const receive = async (): Promise<VideoResult> => {
      await room.ordered(async () => {
        await authorize();
        entry.generation = room.generation;
        check();
        s.transaction(() => {
          if (!importing) cleanPictures(s, room.board, env.now(), this);
          if (!held(s, hash)) {
            owner = [...this.entries].find(other => other.hash === hash && other.key);
            if (!owner && videoTotal(s) + this.staged() >= BOARD_VIDEO_BYTES) return;
            if (!owner) entry.key = "upload:" + env.randomId();
          }
          this.entries.add(entry);
        });
      });
      if (!this.entries.has(entry)) { check(); return full; }
      arm();
      while (true) {
        const { done, value } = await reader.read();
        check();
        if (done) break;
        arm(); bytes += value.length;
        if (bytes > VIDEO_BYTES) throw new RoomError(413, "body_too_large");
        await digest.update(value);
        check();
        if (!entry.key) continue;
        buffer ??= new Uint8Array(PART_BYTES);
        for (let at = 0; at < value.length;) {
          const n = Math.min(PART_BYTES - offset, value.length - at);
          buffer.set(value.subarray(at, at + n), offset);
          at += n; offset += n;
          if (offset === PART_BYTES) { stage(buffer); offset = 0; }
        }
      }
      stopTimer?.();
      if (buffer && offset) stage(buffer.subarray(0, offset));
      if (await digest.hex() !== hash) throw new RoomError(400, "picture_hash_mismatch");
      check();
      if (owner && !await owner.settled) throw unavailable();
      return room.ordered(async () => {
        check(); await authorize(bytes); check();
        return s.transaction((): VideoResult => {
          if (!importing) cleanPictures(s, room.board, env.now(), this);
          const existing = held(s, hash);
          if (existing) {
            removeStaging();
            s.exec("UPDATE pictures SET uploaded_at = ? WHERE hash = ?", env.now(), hash);
            return { result: "exists", type: existing.type as AssetType, bytes: Number(existing.bytes) };
          }
          if (!entry.key) throw unavailable();
          const parts = s.all("SELECT part, length(data) AS length FROM picture_parts WHERE hash = ? ORDER BY part", entry.key);
          if (!complete({ type, bytes, parts: index }, parts)) throw unavailable();
          if (videoTotal(s) + bytes > BOARD_VIDEO_BYTES) { removeStaging(); return full; }
          remove(s, hash);
          s.exec("UPDATE picture_parts SET hash = ? WHERE hash = ?", hash, entry.key);
          s.exec("INSERT INTO pictures VALUES (?, ?, ?, 0, 0, ?, ?, NULL)", hash, type, bytes, index, env.now());
          entry.staged = 0;
          return { result: "created", type, bytes };
        });
      });
    };
    try {
      const result = await Promise.race([receive(), interrupted]);
      entry.settle(result.result !== "full");
      if (result.result === "full") { void reader.cancel().catch(() => {}); digest.abort?.(); }
      return result;
    } catch (error) {
      entry.cancel(error instanceof RoomError ? error : unavailable());
      if (problem?.status === 409 && problem.message === "board_videos_full") return full;
      throw problem;
    } finally { cleanup(); reader.releaseLock(); }
  }
}

export function readVideo(s: Storage, hash: string) {
  const row = held(s, hash);
  if (!row || !isVideoType(row.type)) return null;
  const bytes = Number(row.bytes);
  let index = 0;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      const part = s.all("SELECT data FROM picture_parts WHERE hash = ? AND part = ?", hash, index)[0]?.data;
      if (!(part instanceof Uint8Array) || part.length !== Math.min(PART_BYTES, bytes - index * PART_BYTES)) {
        controller.error(unavailable()); return;
      }
      controller.enqueue(part);
      if (++index === row.parts) controller.close();
    },
  }, { highWaterMark: 0 });
  return { type: row.type, bytes, body };
}
