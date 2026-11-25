// SPDX-License-Identifier: Apache-2.0
import type { Board } from "nextphase-board-rules/document.ts";
import { pictureOf, isVideo } from "nextphase-board-rules/objects/registry.ts";
import { recordBoardKey } from "./board-catalog.ts";
export const PICTURE_LIMIT = 52428800;
export type Picture = { bytes: ArrayBuffer; mime: "image/png" | "image/jpeg" | "image/gif" | "image/webp"; pixelWidth: number; pixelHeight: number };
export type Pictures = Map<string, Picture>;
// Page lifetime, shared across boards, reopen and history. Never cleared by a save.
export const tabPictures: Pictures = new Map();
export const assetKey = (hash: string) => "asset/" + hash;
export const isAssetKey = (key: unknown): key is string => typeof key === "string" && /^asset\/[0-9a-f]{64}$/.test(key);
export async function pictureHash(bytes: ArrayBuffer): Promise<string> {
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)), (v) => v.toString(16).padStart(2, "0")).join("");
}
export function signature(bytes: ArrayBuffer): Picture["mime"] | null {
  const b = new Uint8Array(bytes), starts = (values: number[]) => b.length >= values.length && values.every((v, i) => b[i] === v);
  const ascii = (start: number, text: string) => b.length >= start + text.length && [...text].every((c, i) => b[start + i] === c.charCodeAt(0));
  return starts([137, 80, 78, 71, 13, 10, 26, 10]) ? "image/png" : starts([255, 216, 255]) ? "image/jpeg"
    : ascii(0, "GIF87a") || ascii(0, "GIF89a") ? "image/gif" : ascii(0, "RIFF") && ascii(8, "WEBP") ? "image/webp" : null;
}
export async function validPicture(key: unknown, value: unknown): Promise<boolean> {
  if (!isAssetKey(key) || !value || typeof value !== "object" || Array.isArray(value) ||
    Object.keys(value).sort().join() !== "bytes,mime,pixelHeight,pixelWidth") return false;
  const p = value as Picture;
  return p.bytes instanceof ArrayBuffer && p.bytes.byteLength >= 1 && p.bytes.byteLength <= PICTURE_LIMIT &&
    signature(p.bytes) !== null && signature(p.bytes) === p.mime && [p.pixelWidth, p.pixelHeight].every((n) => Number.isSafeInteger(n) && n >= 1 && n <= 4096) &&
    await pictureHash(p.bytes) === key.slice(6);
}
export const boardPictures = (board: Pick<Board, "objects">) => new Set(board.objects.map(pictureOf).filter((hash): hash is string => hash !== undefined));
export const pictureBytes = (board: Pick<Board, "objects">, pictures: ReadonlyMap<string, Picture> = tabPictures) =>
  [...boardPictures(board)].reduce((sum, hash) => sum + (pictures.get(hash)?.bytes.byteLength ?? 0), 0);
export async function readPictures(db: IDBDatabase, hashes: Iterable<string>, pictures: Pictures = tabPictures): Promise<void> {
  const missing = [...new Set(hashes)].filter((hash) => !pictures.has(hash));
  if (!missing.length) return;
  for (const [hash, value] of await readRecords(db, missing)) if (await validPicture(assetKey(hash), value)) pictures.set(hash, value as Picture);
}
function readRecords(db: IDBDatabase, missing: string[]) {
  return new Promise<[string, unknown][]>((resolve, reject) => {
    const t = db.transaction("boards", "readonly"), s = t.objectStore("boards");
    const requests = missing.map((hash) => [hash, s.get(assetKey(hash))] as const);
    t.oncomplete = () => resolve(requests.map(([hash, request]) => [hash, request.result]));
    t.onabort = () => reject(t.error ?? Error("Picture read aborted")); t.onerror = () => {};
  });

}
export async function storePicture(db: IDBDatabase, hash: string, picture: Picture, transactions: Set<IDBTransaction>): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const t = db.transaction("boards", "readwrite", { durability: "strict" }); transactions.add(t);
    t.objectStore("boards").put(picture, assetKey(hash));
    t.oncomplete = () => { transactions.delete(t); resolve(); };
    t.onabort = () => { transactions.delete(t); reject(t.error ?? Error("Picture write aborted")); }; t.onerror = () => {};
  });
}
// Called synchronously inside the board's strict save/creation transaction.
export function writePictures(store: IDBObjectStore, board: Board, pictures: ReadonlyMap<string, Picture>, videos: ReadonlyMap<string, VideoRecord> = tabVideos) {
  const keys = store.getAllKeys();
  keys.onsuccess = () => {
    const existing = new Set(keys.result);
    for (const hash of boardPictures(board)) {
      const value = pictures.get(hash);
      if (value && !existing.has(assetKey(hash))) store.put(value, assetKey(hash));
    }
    for (const hash of boardVideos(board)) {
      const value = videos.get(hash);
      if (value && !existing.has(assetKey(hash))) store.put(value, assetKey(hash));
    }
    removeUnusedPictures(store);
  };
}
export function removeUnusedPictures(store: IDBObjectStore) {
  const keys = store.getAllKeys();
  keys.onsuccess = () => {
    const boards = keys.result.filter((key) => recordBoardKey(key) !== null), used = new Set<string>();
    let remaining = boards.length, parseable = true;
    const finish = () => { if (parseable) for (const key of keys.result) if (isAssetKey(key) && !used.has(key.slice(6))) store.delete(key); };
    if (!remaining) finish();
    for (const key of boards) {
      const r = store.get(key);
      r.onsuccess = () => {
        try {
          if (typeof r.result !== "string") throw Error();
          const envelope = JSON.parse(r.result);
          if (!envelope || typeof envelope.payload !== "string") throw Error();
          const b = JSON.parse(envelope.payload);
          if (!b || !Array.isArray(b.objects)) throw Error();
          for (const object of b.objects) {
            if (typeof object?.asset === "string") used.add(object.asset);
            if (typeof object?.poster === "string") used.add(object.poster);
          }
        } catch { parseable = false; }
        if (!--remaining) finish();
      };
    }
  };
}

export const VIDEO_FILE_LIMIT = 52428800, VIDEO_LIMIT = 104857600;
export type VideoMime = "video/mp4" | "video/quicktime" | "video/webm";
export type VideoRecord = { bytes: ArrayBuffer; mime: VideoMime; durationMs: number };
export type Videos = Map<string, VideoRecord>;
export const tabVideos: Videos = new Map();

export function videoHeader(bytes: ArrayBuffer): VideoMime | null {
  const text = String.fromCharCode(...new Uint8Array(bytes, 0, Math.min(64, bytes.byteLength)));
  if (text.length >= 12 && text.slice(4, 8) === "ftyp") return text.slice(8, 12) === "qt  " ? "video/quicktime" : "video/mp4";
  if (text.startsWith("\x1a\x45\xdf\xa3") && /\x42\x82(?:\x84|\x01\x00{6}\x04)webm/.test(text.slice(4))) return "video/webm";
  return null;
}
export function routingSignature(bytes: ArrayBuffer) {
  const mime = signature(bytes);
  if (mime === "image/png" && (bytes.byteLength < 24 || String.fromCharCode(...new Uint8Array(bytes, 12, 4)) !== "IHDR")) return null;
  if (mime === "image/gif" && bytes.byteLength < 10) return null;
  return mime;
}
export function assetKind(bytes: ArrayBuffer) {
  const picture = routingSignature(bytes);
  if (picture) return { picture };
  const video = videoHeader(bytes);
  return video ? { video } : null;
}
export const isPictureKind = (kind: ReturnType<typeof assetKind>): kind is { picture: Picture["mime"] } => !!kind && "picture" in kind;
export const isVideoKind = (kind: ReturnType<typeof assetKind>): kind is { video: VideoMime } => !!kind && "video" in kind;
export function holdVideo(hash: string, record: VideoRecord, videos: Videos = tabVideos) {
  if (!videos.has(hash)) videos.set(hash, record);
}
export async function validVideoRecord(key: unknown, value: unknown) {
  if (!isAssetKey(key) || !value || typeof value !== "object" || Object.keys(value).sort().join() !== "bytes,durationMs,mime") return false;
  const v = value as VideoRecord;
  if (!(v.bytes instanceof ArrayBuffer) || !v.bytes.byteLength || v.bytes.byteLength > VIDEO_FILE_LIMIT ||
      !Number.isSafeInteger(v.durationMs) || v.durationMs < 1 || v.durationMs > 86400000) return false;
  const kind = assetKind(v.bytes);
  return isVideoKind(kind) && kind.video === v.mime && await pictureHash(v.bytes) === key.slice(6);
}
export const boardVideos = (board: Pick<Board, "objects">) => new Set(board.objects.filter(isVideo).map(o => o.asset));
export const videoBytes = (board: Pick<Board, "objects">, videos: ReadonlyMap<string, VideoRecord> = tabVideos) =>
  [...boardVideos(board)].reduce((n, hash) => n + (videos.get(hash)?.bytes.byteLength ?? 0), 0);
export async function readVideos(db: IDBDatabase, hashes: Iterable<string>, videos: Videos = tabVideos) {
  const missing = [...new Set(hashes)].filter(hash => !videos.has(hash));
  if (!missing.length) return;
  for (const [hash, value] of await readRecords(db, missing)) {
    if (await validVideoRecord(assetKey(hash), value)) holdVideo(hash, value as VideoRecord, videos);
  }
}
export async function storeVideo(db: IDBDatabase, hash: string, video: VideoRecord, posterHash: string, poster: Picture, transactions: Set<IDBTransaction>) {
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction("boards", "readwrite", { durability: "strict" }), store = tx.objectStore("boards");
    transactions.add(tx);
    for (const [id, record] of [[hash, video], [posterHash, poster]] as const) {
      const key = assetKey(id), exists = store.getKey(key);
      exists.onsuccess = () => { if (exists.result === undefined) store.put(record, key); };
    }
    tx.oncomplete = () => { transactions.delete(tx); resolve(); };
    tx.onabort = () => { transactions.delete(tx); reject(tx.error ?? Error("Video write aborted")); };
    tx.onerror = () => {};
  });
}

export async function downloadedVideo(blob: Blob, hash: string, durationMs: number): Promise<VideoRecord | undefined> {
  if (!blob.size || blob.size > VIDEO_FILE_LIMIT) return;
  const bytes = await blob.arrayBuffer(), kind = assetKind(bytes);
  if (isVideoKind(kind) && kind.video === blob.type && await pictureHash(bytes) === hash) return { bytes, mime: kind.video, durationMs };
}
