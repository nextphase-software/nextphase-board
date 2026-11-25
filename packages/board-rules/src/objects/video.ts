// SPDX-License-Identifier: Apache-2.0
import { validImage, type ImageKeys } from "./image.ts";

export type VideoKeys = ImageKeys & { poster: string; durationMs: number; name: string };
export function validVideo(value: object): boolean {
  const o = value as VideoKeys;
  return validImage(o) && Math.max(o.pixelWidth, o.pixelHeight) <= 1920 &&
    typeof o.poster === "string" && /^[0-9a-f]{64}$/.test(o.poster) && o.poster !== o.asset &&
    Number.isSafeInteger(o.durationMs) && o.durationMs >= 1 && o.durationMs <= 86400000 &&
    typeof o.name === "string" && o.name.length > 0 && Array.from(o.name).length <= 255 &&
    !/[\u0000-\u001f\u007f-\u009f\ud800-\udfff]/u.test(o.name);
}
export const video = {
  voting: true, type: "video", label: "Video", tool: null, validFrom: 15, body: "image-body",
  points: false, text: false, ends: false, container: false, richText: false,
  extraKeys: ["asset", "poster", "pixelWidth", "pixelHeight", "durationMs", "name", "description"] as readonly string[],
  savedKeys: ["id", "generation", "type", "page", "group", "section", "asset", "poster", "pixelWidth", "pixelHeight",
    "durationMs", "name", "description", "x", "y", "width", "height", "order"],
  validExtras: validVideo, sizeRange: { min: 1, max: 20000 }, shapePaint: false,
  growsWithText: false, labelPrefix: (_o: object) => "video",
} as const;
