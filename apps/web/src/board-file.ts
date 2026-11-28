// SPDX-License-Identifier: Apache-2.0
import { canonical, validate, type Board } from "nextphase-board-rules/document.ts";
import { digest } from "./storage.ts";
import { pictureOf, isMedia, isVideo } from "nextphase-board-rules/objects/registry.ts";
import { assetKey, assetKind, isPictureKind, boardPictures, pictureBytes, PICTURE_LIMIT, tabPictures, validPicture, boardVideos, videoBytes, VIDEO_LIMIT, tabVideos, validVideoRecord, type VideoRecord, type Videos, type Picture, type Pictures } from "./image-assets.ts";
export const FILE_LIMIT = 226492416;
export const FILE_REASONS = ["it is larger than 216 MiB", "it is not a Board file", "it is damaged", "it is not a valid board", "it was made by a newer version of Board"] as const;
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
export async function writeBoardFile(shown: Board, unchanged?: Board, pictures: ReadonlyMap<string, Picture> = tabPictures, videos: ReadonlyMap<string, VideoRecord> = tabVideos) {
  const board = unchanged ?? shown, document = canonical(board);
  for (const media of board.objects) {
    const hash = pictureOf(media);
    if (!hash) continue;
    const p = pictures.get(hash);
    if (!p || isVideo(media) && p.mime !== "image/jpeg" || isMedia(media) && (p.pixelWidth !== media.pixelWidth || p.pixelHeight !== media.pixelHeight) || !await validPicture(assetKey(hash), p)) throw Error("a picture is unavailable");
  }
  const hashes = boardVideos(board);
  for (const hash of hashes) if (!await validVideoRecord(assetKey(hash), videos.get(hash))) throw Error("a video is unavailable");
  if (pictureBytes(board, pictures) > PICTURE_LIMIT) throw Error("pictures exceed the 50 MiB board limit");
  if (videoBytes(board, videos) > VIDEO_LIMIT) throw Error("videos exceed the 100 MiB board limit");
  const assets = [...boardPictures(board), ...hashes].sort().map(hash => {
    if (hashes.has(hash)) {
      const v = videos.get(hash)!;
      return { sha256: hash, mime: v.mime, durationMs: v.durationMs, base64: pictureBase64(v.bytes) };
    }
    const p = pictures.get(hash)!;
    return { sha256: hash, mime: p.mime, pixelWidth: p.pixelWidth, pixelHeight: p.pixelHeight, base64: pictureBase64(p.bytes) };
  });
  const payload = JSON.stringify({ document, assets });
  const raw = JSON.stringify({ format: "nextphase-board", fileVersion: 3, payload, sha256: await digest(payload) });
  if (new TextEncoder().encode(raw).length > FILE_LIMIT) throw Error(FILE_REASONS[0]);
  return raw;
}
export async function readBoardBundle(file: { size: number; arrayBuffer: () => Promise<ArrayBuffer> }): Promise<{ board: Board; pictures: Pictures; videos: Videos; fileVersion: number }> {
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
  if (Number.isSafeInteger(value.fileVersion) && value.fileVersion > 3) refuse(FILE_REASONS[4]);
  if (![1, 2, 3].includes(value.fileVersion) || typeof value.payload !== "string" || typeof value.sha256 !== "string") refuse(FILE_REASONS[1]);
  if (!/^[a-f0-9]{64}$/.test(value.sha256) || await digest(value.payload) !== value.sha256) refuse(FILE_REASONS[2]);
  let document = value.payload, bundle;
  if (value.fileVersion >= 2) {
    try {
      bundle = JSON.parse(value.payload);
      if (!bundle || Object.keys(bundle).join("|") !== "document|assets" || JSON.stringify(bundle) !== value.payload || typeof bundle.document !== "string") refuse(FILE_REASONS[2]);
      document = bundle.document;
    } catch { return refuse(FILE_REASONS[2]); }
  }
  let board;
  try { board = JSON.parse(document); } catch { return refuse(FILE_REASONS[3]); }
  if (Number.isSafeInteger(board?.schemaVersion) && board.schemaVersion > 18) refuse(FILE_REASONS[4]);
  try { validate(board); if (canonical(board) !== document) refuse(FILE_REASONS[3]); }
  catch { return refuse(FILE_REASONS[3]); }
  const validated = board as Board;
  const pictures: Pictures = new Map(), videos: Videos = new Map();
  if (bundle) {
    try {
      if (!Array.isArray(bundle.assets)) refuse(FILE_REASONS[2]);
      let previous = "", total = 0, videoTotal = 0;
      for (const entry of bundle.assets) {
        const video = value.fileVersion === 3 && entry && "durationMs" in Object(entry);
        if (!entry || typeof entry !== "object" || Object.keys(entry).join("|") !== (video ? "sha256|mime|durationMs|base64" : "sha256|mime|pixelWidth|pixelHeight|base64") ||
          typeof entry.sha256 !== "string" || entry.sha256 <= previous || typeof entry.base64 !== "string" ||
          (entry.base64.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(entry.base64))) refuse(FILE_REASONS[2]);
        const decoded = Uint8Array.from(atob(entry.base64), (c) => c.charCodeAt(0)).buffer;
        previous = entry.sha256;
        if (pictureBase64(decoded) !== entry.base64) refuse(FILE_REASONS[2]);
        if (video) {
          const record = { bytes: decoded, mime: entry.mime, durationMs: entry.durationMs };
          videoTotal += decoded.byteLength;
          if (videoTotal > VIDEO_LIMIT || !await validVideoRecord(assetKey(entry.sha256), record)) refuse(FILE_REASONS[2]);
          videos.set(entry.sha256, record); continue;
        }
        const p: Picture = { bytes: decoded, mime: entry.mime, pixelWidth: entry.pixelWidth, pixelHeight: entry.pixelHeight };
        const kind = assetKind(decoded);
        if (!isPictureKind(kind) || kind.picture !== p.mime || !await validPicture(assetKey(entry.sha256), p)) refuse(FILE_REASONS[2]);
        total += decoded.byteLength;
        if (total > PICTURE_LIMIT) refuse(FILE_REASONS[2]);
        pictures.set(entry.sha256, p);
      }
      if ([...boardPictures(board)].sort().join() !== [...pictures.keys()].join() || [...boardVideos(board)].sort().join() !== [...videos.keys()].join() ||
          validated.objects.filter(isMedia).some(o => {
            const p = pictures.get(pictureOf(o)!);
            return p?.pixelWidth !== o.pixelWidth || p.pixelHeight !== o.pixelHeight || isVideo(o) && p.mime !== "image/jpeg";
          })) refuse(FILE_REASONS[2]);
    } catch { return refuse(FILE_REASONS[2]); }
  }
  return { board, pictures, videos, fileVersion: value.fileVersion };
}
// Existing document-only callers (including the activity catalogue) remain pure.
export async function readBoardFile(file: { size: number; arrayBuffer: () => Promise<ArrayBuffer> }, pictures: ReadonlyMap<string, Picture> = tabPictures, videos: ReadonlyMap<string, VideoRecord> = tabVideos): Promise<Board> {
  const bundle = await readBoardBundle(file);
  if (bundle.fileVersion === 1 && pictureBytes(bundle.board, pictures) > PICTURE_LIMIT) throw Error("its pictures exceed the 50 MiB board limit");
  if (bundle.fileVersion === 1 && videoBytes(bundle.board, videos) > VIDEO_LIMIT) throw Error("its videos exceed the 100 MiB board limit");
  return bundle.board;
}
