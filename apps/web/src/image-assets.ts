// SPDX-License-Identifier: Apache-2.0
import type { Board } from "./document.ts";
import { isImage } from "./objects/registry.ts";
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
export const boardPictures = (board: Pick<Board, "objects">) => new Set(board.objects.filter(isImage).map((o) => o.asset));
export const pictureBytes = (board: Pick<Board, "objects">, pictures: ReadonlyMap<string, Picture> = tabPictures) =>
  [...boardPictures(board)].reduce((sum, hash) => sum + (pictures.get(hash)?.bytes.byteLength ?? 0), 0);
export async function readPictures(db: IDBDatabase, hashes: Iterable<string>, pictures: Pictures = tabPictures): Promise<void> {
  const missing = [...new Set(hashes)].filter((hash) => !pictures.has(hash));
  if (!missing.length) return;
  const values = await new Promise<[string, unknown][]>((resolve, reject) => {
    const t = db.transaction("boards", "readonly"), s = t.objectStore("boards");
    const requests = missing.map((hash) => [hash, s.get(assetKey(hash))] as const);
    t.oncomplete = () => resolve(requests.map(([hash, request]) => [hash, request.result]));
    t.onabort = () => reject(t.error ?? Error("Picture read aborted")); t.onerror = () => {};
  });
  for (const [hash, value] of values) if (await validPicture(assetKey(hash), value)) pictures.set(hash, value as Picture);
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
export function writePictures(store: IDBObjectStore, board: Board, pictures: ReadonlyMap<string, Picture>) {
  const keys = store.getAllKeys();
  keys.onsuccess = () => {
    const existing = new Set(keys.result);
    for (const hash of boardPictures(board)) {
      const value = pictures.get(hash);
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
          for (const object of b.objects) if (object && typeof object.asset === "string") used.add(object.asset);
        } catch { parseable = false; }
        if (!--remaining) finish();
      };
    }
  };
}
