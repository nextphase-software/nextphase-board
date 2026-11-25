// SPDX-License-Identifier: Apache-2.0

export type LinkKeys = {
  url: string;
  title: string;
  description: string;
  site: string;
  asset: string | null;
  layout: "vertical" | "horizontal";
  state: "loading" | "ready" | "linkOnly";
  requestedAt: number;
};

// The rules package runs in browsers and on servers without depending on DOM declarations.
declare const URL: new (value: string) => { protocol: string; username: string; password: string; href: string };

function validAddress(value: unknown): boolean {
  if (typeof value !== "string" || value.length < 1 || value.length > 1000) return false;
  try {
    const url = new URL(value);
    return (url.protocol === "https:" || url.protocol === "http:") &&
      !url.username && !url.password && url.href === value;
  } catch { return false; }
}

function validText(value: unknown, limit: number): boolean {
  return typeof value === "string" && !/[\u0000-\u001f\u007f-\u009f\ud800-\udfff]/u.test(value) &&
    Array.from(value).length <= limit;
}

export function validLink(value: object): boolean {
  const o = value as LinkKeys & { width: number; height: number };
  const validSize = o.width === 306 && [100, 230, 250, 251, 268, 271, 288].includes(o.height) ||
    o.width === 480 && [64, 114].includes(o.height);
  if (!validSize || !validAddress(o.url) || !validText(o.title, 300) || !validText(o.description, 500) ||
      !validText(o.site, 100) || !Number.isSafeInteger(o.requestedAt) || o.requestedAt < 0 ||
      (o.layout !== "vertical" && o.layout !== "horizontal") ||
      (o.asset !== null && (typeof o.asset !== "string" || !/^[0-9a-f]{64}$/.test(o.asset)))) return false;
  if (o.state === "ready") return /\S/u.test(o.title);
  if (o.state === "loading" && o.layout !== "vertical") return false;
  return (o.state === "loading" || o.state === "linkOnly") && !o.title && !o.description && !o.site && o.asset === null;
}

export const link = {
  voting: true, type: "link", label: "Link", tool: null, validFrom: 16, body: "link-body",
  points: false, text: false, ends: false, container: false, richText: false,
  extraKeys: ["url", "title", "description", "site", "asset", "layout", "state", "requestedAt"] as readonly string[],
  savedKeys: ["id", "generation", "type", "page", "group", "section", "url", "title", "description", "site",
    "asset", "layout", "state", "requestedAt", "x", "y", "width", "height", "order"],
  validExtras: validLink, sizeRange: { min: 64, max: 480 }, shapePaint: false,
  growsWithText: false, labelPrefix: (_o: object) => "link",
} as const;
