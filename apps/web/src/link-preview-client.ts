// SPDX-License-Identifier: Apache-2.0
declare const BOARD_LINK_PREVIEW_URL: string | null;

export type LinkPreview = {
  url: string; title: string; description: string; site: string;
  picture: { type: string; bytes: ArrayBuffer } | null;
};
export const previewOrigin = () => typeof BOARD_LINK_PREVIEW_URL === "string" ? BOARD_LINK_PREVIEW_URL : "";
export const previewConfigured = () => previewOrigin() !== "";
export function previewRequest(url: string, signal: AbortSignal): RequestInit {
  return { method: "POST", body: JSON.stringify({ url }), headers: { "Content-Type": "application/json" },
    credentials: "omit", referrerPolicy: "no-referrer", cache: "no-store", signal };
}
const exact = (value: unknown, keys: string): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).sort().join() === keys;
const text = (value: unknown, limit: number, required = false): value is string =>
  typeof value === "string" && (!required || /\S/u.test(value)) &&
  !/[\u0000-\u001f\u007f-\u009f\ud800-\udfff]/u.test(value) && Array.from(value).length <= limit;
const pictureLimit = 5_242_880;
export async function readLinkPreview(reply: Response): Promise<LinkPreview | null> {
  if (reply.status !== 200) return null;
  try {
    const data: unknown = await reply.json();
    if (!exact(data, "description,picture,site,title,url")) return null;
    const { url, title, description, site, picture } = data;
    if (typeof url !== "string" || new URL(url).href !== url || !text(title, 300, true) || !text(description, 500) || !text(site, 100, true)) return null;
    if (picture === null) return { url, title, description, site, picture };
    if (!exact(picture, "bytes,type") || typeof picture.type !== "string" ||
      !["image/png", "image/jpeg", "image/gif", "image/webp"].includes(picture.type) ||
      typeof picture.bytes !== "string" || !picture.bytes || picture.bytes.length > Math.ceil(pictureLimit / 3) * 4 ||
      picture.bytes.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(picture.bytes)) return null;
    const binary = atob(picture.bytes);
    if (binary.length > pictureLimit || btoa(binary) !== picture.bytes) return null;
    const bytes = Uint8Array.from(binary, char => char.charCodeAt(0)).buffer;
    return { url, title, description, site, picture: { bytes, type: picture.type } };
  } catch { return null; }
}
export async function requestLinkPreview(url: string, signal: AbortSignal): Promise<LinkPreview | null> {
  const origin = previewOrigin();
  if (!origin) return null;
  try {
    const answer = await readLinkPreview(await fetch(origin + "/link-preview", previewRequest(url, signal)));
    return signal.aborted ? null : answer;
  } catch { return null; }
}
