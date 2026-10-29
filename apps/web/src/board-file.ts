// SPDX-License-Identifier: Apache-2.0
import { canonical, validate, type Board } from "./document.ts";
import { digest } from "./storage.ts";
import { isImage } from "./objects/registry.ts";
import { assetKey, boardPictures, pictureBytes, PICTURE_LIMIT, tabPictures, validPicture, type Picture, type Pictures } from "./image-assets.ts";
export const FILE_LIMIT = 75497472;
export const FILE_REASONS = ["it is larger than 72 MiB", "it is not a Board file", "it is damaged", "it is not a valid board", "it was made by a newer version of Board"] as const;
export function boardFileName(title: string) {
  let name = title.replace(/[<>:"/\\|?*\u0000-\u001f\u007f]/g, "_").replace(/[ .]+$/, "_");
  if (/^(CON|PRN|AUX|NUL|COM[0-9]|LPT[0-9])(?:\.|$)/i.test(name)) name = "_" + name;
  return (name || "Untitled board") + ".nextboard";
}
export function pictureBase64(bytes: ArrayBuffer): string {
  const data = new Uint8Array(bytes), chunks: string[] = [];
  for (let i = 0; i < data.length; i += 32768) chunks.push(String.fromCharCode(...data.subarray(i, i + 32768)));
  return btoa(chunks.join(""));
}
export async function writeBoardFile(shown: Board, unchanged?: Board, pictures: ReadonlyMap<string, Picture> = tabPictures) {
  const board = unchanged ?? shown, document = canonical(board);
  for (const image of board.objects.filter(isImage)) {
    const p = pictures.get(image.asset);
    if (!p || p.pixelWidth !== image.pixelWidth || p.pixelHeight !== image.pixelHeight || !await validPicture(assetKey(image.asset), p)) throw Error("a picture is unavailable");
  }
  if (pictureBytes(board, pictures) > PICTURE_LIMIT) throw Error("pictures exceed the 50 MiB board limit");
  const assets = [...boardPictures(board)].sort().map((hash) => {
    const p = pictures.get(hash)!;
    return { sha256: hash, mime: p.mime, pixelWidth: p.pixelWidth, pixelHeight: p.pixelHeight, base64: pictureBase64(p.bytes) };
  });
  const payload = JSON.stringify({ document, assets });
  const raw = JSON.stringify({ format: "nextphase-board", fileVersion: 2, payload, sha256: await digest(payload) });
  if (new TextEncoder().encode(raw).length > FILE_LIMIT) throw Error(FILE_REASONS[0]);
  return raw;
}
export async function readBoardBundle(file: { size: number; arrayBuffer: () => Promise<ArrayBuffer> }): Promise<{ board: Board; pictures: Pictures; fileVersion: number }> {
  const refuse = (reason: string): never => { throw Error(reason); };
  if (file.size > FILE_LIMIT) refuse(FILE_REASONS[0]);
  const bytes = await file.arrayBuffer();
  if (bytes.byteLength > FILE_LIMIT) refuse(FILE_REASONS[0]);
  let text: string, value;
  try { text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes); value = JSON.parse(text); }
  catch { return refuse(FILE_REASONS[1]); }
  if (!value || typeof value !== "object" || Array.isArray(value) ||
    Object.keys(value).join("|") !== "format|fileVersion|payload|sha256" || JSON.stringify(value) !== text) refuse(FILE_REASONS[1]);
  if (value.format !== "nextphase-board") refuse(FILE_REASONS[1]);
  if (Number.isSafeInteger(value.fileVersion) && value.fileVersion > 2) refuse(FILE_REASONS[4]);
  if (![1, 2].includes(value.fileVersion) || typeof value.payload !== "string" || typeof value.sha256 !== "string") refuse(FILE_REASONS[1]);
  if (!/^[a-f0-9]{64}$/.test(value.sha256) || await digest(value.payload) !== value.sha256) refuse(FILE_REASONS[2]);
  let document = value.payload, bundle;
  if (value.fileVersion === 2) {
    try {
      bundle = JSON.parse(value.payload);
      if (!bundle || Object.keys(bundle).join("|") !== "document|assets" || JSON.stringify(bundle) !== value.payload || typeof bundle.document !== "string") refuse(FILE_REASONS[2]);
      document = bundle.document;
    } catch { return refuse(FILE_REASONS[2]); }
  }
  let board;
  try { board = JSON.parse(document); } catch { return refuse(FILE_REASONS[3]); }
  if (Number.isSafeInteger(board?.schemaVersion) && board.schemaVersion > 10) refuse(FILE_REASONS[4]);
  try { validate(board); if (canonical(board) !== document) refuse(FILE_REASONS[3]); }
  catch { return refuse(FILE_REASONS[3]); }
  const validated = board as Board;
  const pictures: Pictures = new Map();
  if (bundle) {
    try {
      if (!Array.isArray(bundle.assets)) refuse(FILE_REASONS[2]);
      let previous = "", total = 0;
      for (const entry of bundle.assets) {
        if (!entry || typeof entry !== "object" || Object.keys(entry).join("|") !== "sha256|mime|pixelWidth|pixelHeight|base64" ||
          typeof entry.sha256 !== "string" || entry.sha256 <= previous || typeof entry.base64 !== "string" ||
          (entry.base64.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(entry.base64))) refuse(FILE_REASONS[2]);
        const decoded = Uint8Array.from(atob(entry.base64), (c) => c.charCodeAt(0)).buffer;
        const p: Picture = { bytes: decoded, mime: entry.mime, pixelWidth: entry.pixelWidth, pixelHeight: entry.pixelHeight };
        if (pictureBase64(decoded) !== entry.base64 || !await validPicture(assetKey(entry.sha256), p)) refuse(FILE_REASONS[2]);
        total += decoded.byteLength;
        if (total > PICTURE_LIMIT) refuse(FILE_REASONS[2]);
        previous = entry.sha256; pictures.set(entry.sha256, p);
      }
      if ([...boardPictures(board)].sort().join() !== [...pictures.keys()].join() || validated.objects.filter(isImage).some((o) =>
        pictures.get(o.asset)?.pixelWidth !== o.pixelWidth || pictures.get(o.asset)?.pixelHeight !== o.pixelHeight)) refuse(FILE_REASONS[2]);
    } catch { return refuse(FILE_REASONS[2]); }
  }
  return { board, pictures, fileVersion: value.fileVersion };
}
// Existing document-only callers (including the activity catalogue) remain pure.
export async function readBoardFile(file: { size: number; arrayBuffer: () => Promise<ArrayBuffer> }, pictures: ReadonlyMap<string, Picture> = tabPictures): Promise<Board> {
  const bundle = await readBoardBundle(file);
  if (bundle.fileVersion === 1 && pictureBytes(bundle.board, pictures) > PICTURE_LIMIT) throw Error("its pictures exceed the 50 MiB board limit");
  return bundle.board;
}
