// SPDX-License-Identifier: Apache-2.0
import { clamp, freshIdentifier, type BoardV10, type ImageItem, validText } from "nextphase-board-rules/document.ts";
import { imageType, isImage, type Rectangle } from "nextphase-board-rules/objects/registry.ts";
import { bandOrder, sectionAt } from "./sections.ts";
import { PICTURE_LIMIT, pictureHash, signature, tabPictures, type Picture } from "./image-assets.ts";
export const IMAGE_ACCEPT = "image/png,image/jpeg,image/gif,image/webp";
export const IMAGE_REASONS = {
  file: "file is larger than 20 MiB", type: "not a supported image (PNG, JPEG, GIF or WebP)",
  size: "picture would exceed the 20,000-unit size limit", objects: "250 object limit reached",
  bytes: "pictures would exceed the 50 MiB board limit", store: "picture could not be stored in this browser",
} as const;
export type PreparedImage = { hash: string; picture: Picture; width: number; height: number };
export function landingSize(width: number, height: number) {
  const s = Math.min(1, 480 / height), result = { width: Math.max(1, width * s), height: Math.max(1, height * s) };
  if (!Number.isFinite(result.width) || !Number.isFinite(result.height) || result.width > 20000 || result.height > 20000) throw Error(IMAGE_REASONS.size);
  return result;
}
export function scaledPixels(width: number, height: number) {
  const longest = Math.max(width, height);
  return longest <= 4096 ? { pixelWidth: width, pixelHeight: height }
    : { pixelWidth: Math.max(1, Math.round(width * 4096 / longest)), pixelHeight: Math.max(1, Math.round(height * 4096 / longest)) };
}
export function imageRow(sizes: readonly { width: number; height: number }[], centre: { x: number; y: number }): Rectangle[] {
  const width = sizes.reduce((sum, size) => sum + size.width, 0) + 16 * Math.max(0, sizes.length - 1);
  const height = Math.max(0, ...sizes.map((s) => s.height));
  let x = centre.x - width / 2;
  return sizes.map((s) => {
    const result = { x: clamp(x, -1e6, 1e6 - s.width), y: clamp(centre.y + height / 2 - s.height, -1e6, 1e6 - s.height), width: s.width, height: s.height };
    x += s.width + 16; return result;
  });
}
export function importReason(board: BoardV10, accepted: readonly PreparedImage[], next: PreparedImage, pictures: ReadonlyMap<string, Picture> = tabPictures): string {
  if (board.objects.length + accepted.length >= 250) return IMAGE_REASONS.objects;
  const available = new Map(pictures), hashes = new Set(board.objects.filter(isImage).map((o) => o.asset));
  for (const item of [...accepted, next]) { hashes.add(item.hash); available.set(item.hash, item.picture); }
  const bytes = [...hashes].reduce((sum, hash) => sum + (available.get(hash)?.bytes.byteLength ?? 0), 0);
  return bytes > PICTURE_LIMIT ? IMAGE_REASONS.bytes : "";
}
export function addImages(board: BoardV10, images: readonly PreparedImage[], centre: { x: number; y: number }): BoardV10 {
  if (!images.length) return board;
  if (board.objects.length + images.length > 250) throw Error(IMAGE_REASONS.objects);
  const reserved: string[] = [], fresh = () => { const id = freshIdentifier(board, reserved); reserved.push(id); return id; };
  const row = imageRow(images, centre);
  const objects: ImageItem[] = images.map((image, i) => ({
    id: fresh(), generation: fresh(), type: imageType().type, group: null,
    section: sectionAt(board.objects, { x: row[i].x + row[i].width / 2, y: row[i].y + row[i].height / 2 })?.id ?? null,
    asset: image.hash, pixelWidth: image.picture.pixelWidth, pixelHeight: image.picture.pixelHeight, description: "",
    ...row[i], order: board.objects.length + i,
  }));
  return { ...board, objects: bandOrder([...board.objects, ...objects]).map((o, order) => ({ ...o, order })) };
}
export function refusalNotice(refused: readonly { name: string; reason: string }[]): string {
  const names = refused.slice(0, 3).map((r) => r.name || "Clipboard image");
  const text = names.length <= 1 ? names[0] : names.slice(0, -1).join(", ") + " and " + names.at(-1);
  return "Could not add " + text + (refused.length > 3 ? " and " + (refused.length - 3) + " more" : "") + ": " +
    [...new Set(refused.map((r) => r.reason))].join("; ") + ".";
}
export async function decodePicture(picture: Picture): Promise<ImageBitmap> {
  const bitmap = await createImageBitmap(new Blob([picture.bytes], { type: picture.mime }));
  if (bitmap.width !== picture.pixelWidth || bitmap.height !== picture.pixelHeight) { bitmap.close(); throw Error("Image unavailable"); }
  return bitmap;
}
export async function prepareImage(file: { size: number; arrayBuffer: () => Promise<ArrayBuffer> }): Promise<PreparedImage> {
  if (file.size > 20971520) throw Error(IMAGE_REASONS.file);
  let bytes: ArrayBuffer, mime: Picture["mime"], bitmap: ImageBitmap;
  try {
    bytes = await file.arrayBuffer();
    if (bytes.byteLength > 20971520) throw Error(IMAGE_REASONS.file);
    const found = signature(bytes); if (!found) throw Error(); mime = found;
    bitmap = await createImageBitmap(new Blob([bytes], { type: mime }));
    if (!bitmap.width || !bitmap.height) { bitmap.close(); throw Error(); }
  } catch (error) { throw Error(error instanceof Error && error.message === IMAGE_REASONS.file ? IMAGE_REASONS.file : IMAGE_REASONS.type); }
  try {
    const landing = landingSize(bitmap.width, bitmap.height), pixels = scaledPixels(bitmap.width, bitmap.height);
    if (bitmap.width > 4096 || bitmap.height > 4096) {
      const canvas = new OffscreenCanvas(pixels.pixelWidth, pixels.pixelHeight), context = canvas.getContext("2d")!;
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
      let transparent = false;
      for (let i = 3; i < data.length; i += 4) if (data[i] !== 255) { transparent = true; break; }
      mime = transparent ? "image/png" : "image/jpeg";
      bytes = await (await canvas.convertToBlob({ type: mime, quality: .90 })).arrayBuffer();
    }
    return { hash: await pictureHash(bytes), picture: { bytes, mime, ...pixels }, ...landing };
  } finally { bitmap.close(); }
}
export const platformPaste = (platform: string) => /Mac|iPhone|iPad|iPod/.test(platform);
export function nativePasteKey(event: { isTrusted: boolean; key: string; metaKey: boolean; ctrlKey: boolean; altKey: boolean; shiftKey: boolean }, platform: string): boolean {
  return event.isTrusted && event.key.toLowerCase() === "v" && !event.altKey && !event.shiftKey &&
    (platformPaste(platform) ? event.metaKey && !event.ctrlKey : event.ctrlKey && !event.metaKey);
}
export const descriptionDraft = (value: string) => validText(value, Number.MAX_SAFE_INTEGER) ? Array.from(value).slice(0, 1000).join("") : null;
export function describeImage(board: BoardV10, boardId: string, id: string, generation: string, description: string): BoardV10 {
  if (board.boardId !== boardId || !validText(description, 1000)) return board;
  const objects = board.objects.map((o) => isImage(o) && o.id === id && o.generation === generation && o.description !== description ? { ...o, description } : o);
  return objects.some((o, i) => o !== board.objects[i]) ? { ...board, objects } : board;
}
