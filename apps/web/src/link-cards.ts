// SPDX-License-Identifier: Apache-2.0
import { add, freshIdentifier, type BoardV16, type ItemV16, type LinkItem } from "nextphase-board-rules/document.ts";
import { isLink, linkType, typeForTool, type LinkKeys } from "nextphase-board-rules/objects/registry.ts";
import { pictureHash, signature, type Picture } from "./image-assets.ts";
import { placeObject } from "./sections.ts";
import type { History } from "./history.ts";

export const LINK_LOADING_MS = 20_000;
export const LINK_REQUEST_MS = 15_000;
export const LINK_ADDRESS_LIMIT = 1_000;
export const LINK_SIZES = {
  loading: [306, 288], horizontal: [480, 114], titleVertical: [306, 100], titleHorizontal: [480, 64],
  linkOnly: [480, 64],
} as const;
export const CARD_SIZES = [[306, 100], [306, 230], [306, 250], [306, 251], [306, 268], [306, 271], [306, 288], [480, 64], [480, 114]] as const;
export type LinkLook = keyof typeof LINK_SIZES | "vertical";
type Lines = { title: number; description: number };
type Point = { x: number; y: number };
type Size = { width: number; height: number };
type Rectangle = Point & Size;
const box = (x: number, y: number, width: number, height: number) => ({ x, y, width, height });
const fullLines: Lines = { title: 2, description: 2 };

export const LINK_LOOK = {
  frame: { fill: "#ffffff", stroke: "#e3e1e6", radius: 8 },
  innerRadius: 7,
  outline: "#518de0",
  separator: "#efedf1",
  placeholder: "#f1f0f3",
  spinner: { radius: 9.75, strokeWidth: 2.5, ring: "#d8d5dc", arc: "#7051cf" },
  skeleton: { fill: "#eeedf0", radius: 5 },
  fontFamily: "system-ui",
  title: { size: 14, line: 20, color: "#1e1c22", style: "600" },
  description: { size: 12, line: 17, color: "#5f5b66", style: "normal" },
  site: { size: 12, line: 16, color: "#5f5b66", style: "normal" },
  address: { size: 13, line: 16, color: "#3d3942", style: "normal" },
  glyph: { size: 14, stroke: "#8a8590", paths: [
    "M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1",
    "M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1",
  ] },
  loading: {
    picture: box(1, 1, 304, 159), divider: box(1, 160, 304, 1), spinner: { x: 153, y: 80.5 },
    bars: [box(15, 177, 171, 10), box(15, 197, 254, 10), box(15, 217, 204, 10)],
  },
  vertical: { picture: box(1, 1, 304, 159), divider: box(1, 160, 304, 1), titleX: 15, titleY: 173, textWidth: 276, siteInset: 25 },
  horizontal: { picture: box(1, 1, 111, 112), divider: box(112, 1, 1, 112), titleX: 127, titleY: 11, textWidth: 338, siteInset: 27 },
  titleVertical: { titleX: 17, titleY: 17, textWidth: 272, siteInset: 33 },
  titleHorizontal: { titleX: 17, titleY: 11, textWidth: 446, siteInset: 27 },
  linkOnly: { addressX: 37, textInset: 54 },
} as const;

type Face = {
  inner: Rectangle; picture?: Rectangle; divider?: Rectangle; spinner?: Point; bars?: Rectangle[];
  title?: Rectangle; description?: Rectangle; site?: Rectangle; glyph?: Point; address?: Rectangle;
};
export function faceLayout(look: LinkLook, width: number, height: number, lines: Lines = fullLines): Face {
  const face: Face = { inner: box(1, 1, width - 2, height - 2) };
  if (look === "linkOnly") {
    const y = (height - 16) / 2;
    return { ...face, glyph: { x: 17, y: y + 1 }, address: box(37, y, width - LINK_LOOK.linkOnly.textInset, 16) };
  }
  const dx = width - cardSize(look, lines).width;
  const stretch = (part: Rectangle) => ({ ...part, width: part.width + dx });
  if (look === "loading") {
    const f = LINK_LOOK.loading;
    return { ...face, picture: stretch(f.picture), divider: stretch(f.divider), spinner: f.spinner, bars: f.bars.map(stretch) };
  }
  const f = LINK_LOOK[look];
  const horizontal = look === "horizontal" || look === "titleHorizontal";
  const titleLines = horizontal ? 1 : look === "vertical" ? lines.title : 2;
  const w = f.textWidth + dx, row = height - f.siteInset;
  const withPicture = "picture" in f;
  return {
    ...face,
    ...(withPicture ? {
      picture: horizontal ? { ...f.picture, height: height - 2 } : stretch(f.picture),
      divider: horizontal ? { ...f.divider, height: height - 2 } : stretch(f.divider),
    } : {}),
    title: box(f.titleX, f.titleY, w, 20 * titleLines),
    ...(withPicture && (horizontal || lines.description) ? {
      description: box(f.titleX, horizontal ? 35 : 177 + 20 * lines.title, w, horizontal ? 17 : 17 * lines.description),
    } : {}),
    site: box(f.titleX + 20, row, w - 20, 16),
    glyph: { x: f.titleX, y: row + 1 },
  };
}

export function keepInBounds<T extends Rectangle>(rect: T): T {
  return { ...rect, x: Math.min(Math.max(rect.x, -1e6), 1e6 - rect.width), y: Math.min(Math.max(rect.y, -1e6), 1e6 - rect.height) };
}
export function addressAllowed(url: URL): boolean {
  const host = url.hostname.replace(/\.$/, "");
  return url.href.length <= 2048 && (url.protocol === "http:" || url.protocol === "https:") &&
    (!url.port || url.port === "80" || url.port === "443") && !url.username && !url.password &&
    host.includes(".") && !host.startsWith("[") && !/^\d+(?:\.\d+){3}$/.test(host) &&
    !/(?:^|\.)(?:localhost|local|internal|home\.arpa)$/.test(host);
}
export function pastedAddress(raw: string): { kind: "card"; url: string } | { kind: "text"; text: string } | null {
  const text = raw.trim();
  if (text.length > LINK_ADDRESS_LIMIT || /\s/u.test(text) || !/^[a-z][a-z0-9+.-]*:\/\//i.test(text)) return null;
  let url: URL;
  try { url = new URL(text); } catch { return null; }
  if (!addressAllowed(url) || url.href.length > LINK_ADDRESS_LIMIT) return { kind: "text", text };
  return { kind: "card", url: url.href };
}
export function linkLook(card: LinkKeys, now: number): LinkLook {
  if (card.state === "loading") return now >= card.requestedAt + LINK_LOADING_MS ? "linkOnly" : "loading";
  if (card.state === "linkOnly") return "linkOnly";
  return card.asset ? card.layout : card.layout === "vertical" ? "titleVertical" : "titleHorizontal";
}
export const verticalHeight = (titleLines: number, descriptionLines: number) =>
  210 + 20 * titleLines + (descriptionLines > 0 ? 4 + 17 * descriptionLines : 0);
export function cardLines(card: Pick<LinkItem, "height">): Lines {
  for (const title of [1, 2]) for (const description of [0, 1, 2]) {
    if (card.height === verticalHeight(title, description)) return { title, description };
  }
  return fullLines;
}
export function cardSize(look: LinkLook, lines: Lines = fullLines): Size {
  if (look === "vertical") return { width: 306, height: verticalHeight(lines.title, lines.description) };
  const [width, height] = LINK_SIZES[look];
  return { width, height };
}

function centred(centre: Point, size: Size): Rectangle {
  return keepInBounds({ x: Math.round(centre.x - size.width / 2), y: Math.round(centre.y - size.height / 2), ...size });
}
function identities(board: BoardV16) {
  const id = freshIdentifier(board);
  return { id, generation: freshIdentifier(board, [id]) };
}
export function pasteCard(board: BoardV16, url: string, centre: Point, page: string, now: number, service: boolean) {
  const at = identities(board), state = service ? "loading" : "linkOnly";
  const card: LinkItem = { ...at, type: linkType().type, page, section: null, group: null, order: board.objects.length,
    ...centred(centre, cardSize(state)), url, title: "", description: "", site: "", asset: null,
    layout: service ? "vertical" : "horizontal", state, requestedAt: now };
  return { board: placeObject(board, card), id: at.id };
}
export function textObject(board: BoardV16, text: string, page: string) {
  const object = add({ ...board, objects: [] }, typeForTool("Text"), 0, 0, page).objects[0];
  return { ...object, ...identities(board), text } as Extract<ItemV16, { text: string }>;
}
export function pasteText(board: BoardV16, text: string, centre: Point, page: string, height: number) {
  const object = textObject(board, text, page);
  if (!("width" in object)) throw Error("Invalid text rectangle");
  const placed = { ...object, order: board.objects.length, ...centred(centre, { width: object.width, height }) };
  return { board: placeObject(board, placed), id: placed.id };
}

export type LinkResult = { title: string; description: string; site: string; asset?: string } | null;
export const LINK_FINISH_KEYS = ["title", "description", "site", "asset", "state", "layout", "width", "height"] as const;
const cut = (value: string, limit: number) => Array.from(value).slice(0, limit).join("").trim();
export function finishCard(card: LinkItem, result: LinkResult, lines?: Lines): LinkItem {
  const next: LinkItem = result ? {
    ...card, state: "ready", title: cut(result.title, 300), description: cut(result.description, 500),
    site: cut(result.site || new URL(card.url).hostname, 100), asset: result.asset ?? null,
  } : { ...card, state: "linkOnly", layout: "horizontal", title: "", description: "", site: "", asset: null };
  return keepInBounds({ ...next, ...cardSize(linkLook(next, 0), lines) });
}
export function withLayout(card: LinkItem, layout: LinkKeys["layout"], lines?: Lines, now = Date.now()): LinkItem {
  const look = linkLook(card, now);
  if (look === "loading") return card;
  const next = card.state === "loading" ? { ...finishCard(card, null), layout, x: card.x, y: card.y } : { ...card, layout };
  return keepInBounds({ ...next, ...cardSize(linkLook(next, now), lines) });
}
export function cardToText(board: BoardV16, id: string, height: number) {
  const card = board.objects.find(o => o.id === id);
  if (!card || !isLink(card)) throw Error("Unknown link card");
  const text = textObject(board, card.url, card.page);
  if (!("width" in text)) throw Error("Invalid text rectangle");
  const placed = keepInBounds({ ...text, x: card.x, y: card.y, height, order: card.order, group: card.group, section: card.section });
  return { board: { ...board, objects: board.objects.map(o => o === card ? placed : o),
    retiredGenerations: [...board.retiredGenerations, card.generation].sort() }, id: placed.id };
}
export function amendHistory(history: History, card: LinkItem): History {
  const { title, description, site, asset, state, layout, width, height } = card;
  const apply = (value: Parameters<typeof isLink>[0] & ItemV16 | null) =>
    value && isLink(value) && value.id === card.id && value.url === card.url && value.requestedAt === card.requestedAt
      ? keepInBounds({ ...value, title, description, site, asset, state, layout, width, height }) : value;
  const steps = (list: History["past"]): History["past"] => list.map(step => ({ ...step,
    changes: step.changes.map(change => ({ before: apply(change.before as ItemV16 | null), after: apply(change.after as ItemV16 | null) })) }));
  return { past: steps(history.past), future: steps(history.future) };
}
export function thumbnailSize(width: number, height: number): Size {
  const scale = Math.min(1, 640 / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}
type Decoded = { width: number; height: number; close(): void };
type ThumbnailOptions<T extends Decoded = ImageBitmap> = {
  decode?: (blob: Blob) => Promise<T>;
  encode?: (bitmap: T, size: Size, settings: { jpegQuality: number }) => Promise<{ bytes: ArrayBuffer; mime: "image/png" | "image/jpeg" }>;
};
async function encodeBitmap(bitmap: ImageBitmap, size: Size, { jpegQuality }: { jpegQuality: number }) {
  const canvas = document.createElement("canvas");
  canvas.width = size.width; canvas.height = size.height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw Error("Thumbnail canvas unavailable");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, 0, 0, size.width, size.height);
  const { data } = ctx.getImageData(0, 0, size.width, size.height);
  const mime = data.some((value, index) => index % 4 === 3 && value < 255) ? "image/png" : "image/jpeg";
  const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, mime, mime === "image/jpeg" ? jpegQuality : undefined));
  if (!blob) throw Error("Thumbnail encoding failed");
  return { bytes: await blob.arrayBuffer(), mime } as const;
}
export async function makeThumbnail<T extends Decoded = ImageBitmap>(bytes: ArrayBuffer, options: ThumbnailOptions<T> = {}): Promise<{ hash: string; picture: Picture } | null> {
  const type = signature(bytes);
  if (!type) return null;
  try {
    const bitmap = await (options.decode ?? createImageBitmap)(new Blob([bytes], { type }));
    try {
      const size = thumbnailSize(bitmap.width, bitmap.height);
      const encoded = options.encode ? await options.encode(bitmap as T, size, { jpegQuality: .85 })
        : await encodeBitmap(bitmap as ImageBitmap, size, { jpegQuality: .85 });
      if (signature(encoded.bytes) !== encoded.mime) return null;
      return { hash: await pictureHash(encoded.bytes), picture: { ...encoded, pixelWidth: size.width, pixelHeight: size.height } };
    } finally { bitmap.close(); }
  } catch { return null; }
}
export const LINK_ABOUT_LOCAL = "Links you paste are read by Board's link preview service, which fetches each page's title, description and picture. Only the link is sent, never your board.";
export const LINK_ABOUT_TEAM = "Links pasted on team boards are read by Board's server, which fetches each page's title, description and picture. Only the link is sent.";
export const aboutLine = (hosted: boolean, service: boolean) => hosted ? LINK_ABOUT_TEAM : service ? LINK_ABOUT_LOCAL : "";
export type LinkBar = {
  only: boolean; count: number; look?: LinkLook; layout?: LinkKeys["layout"];
  open(): void; setLayout(layout: LinkKeys["layout"]): void; toText(): void;
};
