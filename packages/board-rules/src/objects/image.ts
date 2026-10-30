// SPDX-License-Identifier: Apache-2.0
export type ImageKeys = { asset: string; pixelWidth: number; pixelHeight: number; description: string };
export function validImage(value: object): boolean {
  const o = value as ImageKeys;
  return typeof o.asset === "string" && /^[0-9a-f]{64}$/.test(o.asset) &&
    [o.pixelWidth, o.pixelHeight].every((n) => Number.isSafeInteger(n) && n >= 1 && n <= 4096) &&
    typeof o.description === "string" && !/[\uD800-\uDFFF]/u.test(o.description) && Array.from(o.description).length <= 1000;
}
export const image = {
  type: "image", label: "Image", tool: null, validFrom: 10, body: "image-body",
  points: false, text: false, ends: false, container: false, richText: false,
  extraKeys: ["asset", "pixelWidth", "pixelHeight", "description"] as readonly string[],
  savedKeys: ["id", "generation", "type", "group", "section", "asset", "pixelWidth", "pixelHeight", "description", "x", "y", "width", "height", "order"],
  validExtras: validImage, sizeRange: { min: 1, max: 20000 }, shapePaint: false,
  growsWithText: false, labelPrefix: (_o: object) => "image",
} as const;
