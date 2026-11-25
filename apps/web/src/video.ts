// SPDX-License-Identifier: Apache-2.0
import type { ItemV12 } from "nextphase-board-rules/document.ts";
import { isImage, isVideo, type Rectangle } from "nextphase-board-rules/objects/registry.ts";
import { pictureHash, signature, tabPictures, type Picture, type VideoMime, type VideoRecord } from "./image-assets.ts";
import { landingSize, decodePicture, VIDEO_REASONS, IMAGE_REASONS } from "./images.ts";
export { isVideoKind, isPictureKind } from "./image-assets.ts";
export const POSTER_SIDE = 1920, PREPARE_TIMEOUT = 15000;
export const VIDEO_CANNOT_PLAY = "This video can't play in this browser.";
export const loadFailedNotice = (name: string) => `Could not load ${name}. Press play to try again.`;
export const videoName = (name: string) => Array.from(name.replace(/[\u0000-\u001f\u007f-\u009f\ud800-\udfff]/gu, "")).slice(0, 255).join("") || "Clipboard video";
export type PreparedVideo = { hash: string; video: VideoRecord; posterHash: string; poster: Picture; name: string; width: number; height: number };
export function posterPixels(width: number, height: number) {
  const scale = Math.min(1, POSTER_SIDE / Math.max(width, height));
  return { pixelWidth: Math.max(1, Math.round(width * scale)), pixelHeight: Math.max(1, Math.round(height * scale)) };
}

export async function prepareVideo(file: { name: string }, bytes: ArrayBuffer, mime: VideoMime): Promise<PreparedVideo> {
  const element = document.createElement("video"), url = URL.createObjectURL(new Blob([bytes], { type: mime }));
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    element.muted = true; element.playsInline = true; element.preload = "auto";
    await new Promise<void>((resolve, reject) => {
      element.onerror = () => reject(Error(VIDEO_REASONS.play));
      timer = setTimeout(element.onerror as () => void, PREPARE_TIMEOUT);
      element.onloadeddata = () => {
        const ms = Math.round(element.duration * 1000);
        if (!(element.videoWidth >= 1 && element.videoHeight >= 1) || !Number.isSafeInteger(ms) || ms < 1 || ms > 86400000) {
          reject(Error(VIDEO_REASONS.play)); return;
        }
        element.onseeked = () => resolve();
        try { element.currentTime = 0; } catch (error) { reject(error); }
      };
      element.src = url;
    });
    clearTimeout(timer);
    const { videoWidth, videoHeight } = element, durationMs = Math.round(element.duration * 1000);
    const pixels = posterPixels(videoWidth, videoHeight), canvas = new OffscreenCanvas(pixels.pixelWidth, pixels.pixelHeight);
    canvas.getContext("2d")!.drawImage(element, 0, 0, pixels.pixelWidth, pixels.pixelHeight);
    const jpeg = await canvas.convertToBlob({ type: "image/jpeg", quality: .90 });
    const poster: Picture = { bytes: (await new Response(jpeg).bytes()).buffer, mime: "image/jpeg", ...pixels };
    if (signature(poster.bytes) !== poster.mime) throw Error();
    (await decodePicture(poster)).close();
    const [hash, posterHash] = await Promise.all([pictureHash(bytes), pictureHash(poster.bytes)]);
    return { hash, video: { bytes, mime, durationMs }, posterHash, poster, name: videoName(file.name), ...landingSize(videoWidth, videoHeight) };
  } catch (error) { throw Error(error instanceof Error && error.message === IMAGE_REASONS.size ? IMAGE_REASONS.size : VIDEO_REASONS.play); }
  finally {
    clearTimeout(timer); element.onloadeddata = element.onseeked = element.onerror = null;
    element.removeAttribute("src"); URL.revokeObjectURL(url);
  }
}

export function videoFrame(o: ItemV12, bitmaps: ReadonlyMap<string, ImageBitmap>, pictures: ReadonlyMap<string, Picture> = tabPictures) {
  if (!isVideo(o) || pictures.get(o.poster)?.mime !== "image/jpeg") return;
  const bitmap = bitmaps.get(o.poster);
  if (bitmap?.width === o.pixelWidth && bitmap.height === o.pixelHeight) return bitmap;
}
export function hasPlayMark(o: ItemV12, animated: ReadonlySet<string>, bitmaps: ReadonlyMap<string, ImageBitmap>) {
  if (!isImage(o)) return !!videoFrame(o, bitmaps);
  const bitmap = bitmaps.get(o.asset);
  return animated.has(o.asset) && bitmap?.width === o.pixelWidth && bitmap.height === o.pixelHeight;
}
export function clockText(ms: number) {
  const seconds = Math.floor(ms / 1000), minutes = Math.floor(seconds / 60);
  const pad = (v: number) => String(v).padStart(2, "0");
  return (minutes >= 60 ? Math.floor(minutes / 60) + ":" + pad(minutes % 60) : minutes) + ":" + pad(seconds % 60);
}
export const lengthText = (ms: number) => clockText(Math.max(1, Math.round(ms / 1000)) * 1000);
export const currentText = (ms: number, duration: number) => clockText(Math.min(ms, Math.max(1, Math.round(duration / 1000)) * 1000));
export const mediaLabel = (images: number, videos: number) => images && videos ? `${images + videos} items` :
  videos ? videos === 1 ? "Video" : `${videos} videos` : images === 1 ? "Image" : `${images} images`;
export const addedNotice = (images: number, videos: number) => "Added " + (images + videos === 1 ? "1 " : "") + mediaLabel(images, videos).toLowerCase() + ".";
export type VideoPlayerState = {
  id: string; box: Rectangle; state: "paused" | "playing" | "ended" | "loading" | "unavailable"; timeMs: number;
  durationMs: number; percent: number; shown: boolean; hidden: boolean; fullScreen: boolean; muted: boolean;
  hasData: boolean; canFullScreen: boolean; ref(element: HTMLVideoElement | null): void;
  onLoadedMetadata(): void; onLoadedData(): void; onTimeUpdate(): void; onPlaying(): void; onPause(): void;
  onEnded(): void; onError(): void; play(): void; pause(): void; seek(ms: number): void;
  seekKey(key: string): boolean; toggleMute(): void; enterFullScreen(): void;
};
