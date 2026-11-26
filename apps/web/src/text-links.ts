// SPDX-License-Identifier: Apache-2.0
import { count, type Board, type ItemV16 as Item } from "nextphase-board-rules/document.ts";
import type { Mark } from "nextphase-board-rules/marks.ts";
import { linkAddress, linkAt } from "nextphase-board-rules/text-link.ts";
import { textUnits } from "nextphase-board-rules/styles.ts";
import { hasRectangle, hasText, objectKind, objectType, textBox, usesShapePaint } from "nextphase-board-rules/objects/registry.ts";
import { readHostedBoardLink } from "./page-links.ts";
import { hitObject } from "./connectors.ts";
import { lineOffset, type LinkSpan, type RunLine } from "./text-runs.ts";
import { TEXT_INSET, TEXT_LAYOUT, type ResolvedItem } from "./geometry.ts";

export const LINK_WORDS = {
  link: "Link", several: "Select one object to add a link", empty: "Add text first", caret: "Select words to link",
  address: "Link address", placeholder: "Paste or type a link", remove: "Remove link", apply: "Apply link",
  refused: "Use a web address starting with http:// or https://, or a link to this board.",
  copy: "Copy link", edit: "Edit link", copied: "Link copied.", gone: "Not on this board any more", group: "Link", details: "Link details",
} as const;

type Key = { key: string; shiftKey: boolean; metaKey: boolean; ctrlKey: boolean; altKey: boolean };
export const linkTooltip = (mac: boolean) => mac ? "Link · ⇧⌘U" : "Link · Ctrl+Shift+U";
export const isMac = (platform: string) => /Mac|iPhone|iPad/.test(platform);
export const isLinkShortcut = (e: Key & { isComposing: boolean }) =>
  (e.key === "u" || e.key === "U") && e.shiftKey && (e.metaKey || e.ctrlKey) && !e.altKey && !e.isComposing;
export const isPlainPasteKey = (e: Key) =>
  (e.key === "v" || e.key === "V") && e.shiftKey && (e.metaKey || e.ctrlKey) && !e.altKey;

export const copyObjectLabel = (kind: string) => `Copy link to ${kind}`;
export const objectCopied = (kind: string, hosted: boolean) => `Link to ${kind} copied.${hosted ? "" : " It opens in this browser only."}`;
export const capitalised = (kind: string) => kind.charAt(0).toUpperCase() + kind.slice(1);
export function firstLine(text: string) {
  const line = text.split(/\r\n|[\r\n]/).map(line => line.trim()).find(Boolean) ?? "";
  const points = Array.from(line);
  return points.length > 60 ? points.slice(0, 60).join("") + "…" : line;
}

export function sameBoardLink(href: string, address: string, hostedBoard?: string): { page?: string; object?: string } | undefined {
  let target: URL, current: URL;
  try { target = new URL(href); current = new URL(address); } catch { return undefined; }
  if (target.origin !== current.origin || target.pathname !== current.pathname) return undefined;
  if (hostedBoard !== undefined) {
    const link = readHostedBoardLink(target.hash);
    if (link?.board !== hostedBoard || link.page === undefined && link.object === undefined) return undefined;
    const { board: _board, ...values } = link;
    return values;
  }
  const board = target.searchParams.get("board");
  if (board === null || board !== current.searchParams.get("board")) return undefined;
  const page = target.searchParams.get("page"), object = target.searchParams.get("object");
  if (page === null && object === null) return undefined;
  return { ...(page === null ? {} : { page }), ...(object === null ? {} : { object }) };
}

export type LinkLabel = { text: string; muted: boolean; icon: "page" | "object" | "gone" | "outside"; tool: string | null };
export function linkLabel(href: string, board: Board, address: string, hostedBoard?: string): LinkLabel {
  const link = sameBoardLink(href, address, hostedBoard);
  if (!link) return { text: href, muted: false, icon: "outside", tool: null };
  if (link.object !== undefined) {
    const object = board.objects.find(o => o.id === link.object);
    if (object) {
      const { kind, icon } = objectKind(object.type);
      return { text: (hasText(object) && firstLine(object.text)) || capitalised(kind), muted: false, icon: "object", tool: icon };
    }
  } else {
    const page = board.pages?.find(page => page.id === link.page);
    if (page) return { text: page.name, muted: false, icon: "page", tool: null };
  }
  return { text: LINK_WORDS.gone, muted: true, icon: "gone", tool: null };
}

type Point = { x: number; y: number };
type Range = { start: number; end: number };
type LinkLayout = { height: number; runs: RunLine[] | null; links: LinkSpan[] };
export type LinkBox = Range & { id: string; href: string; line: number; x: number; y: number; width: number; height: number };
export type LinkHit = { id: string; href: string; run: Range; box: LinkBox; first: LinkBox };

export function linkBoxes(object: Item, layout: LinkLayout): LinkBox[] {
  if (!hasRectangle(object) || !hasText(object) || !objectType(object.type).richText) return [];
  const shape = usesShapePaint(object), box = shape ? textBox(object) : {
    x: object.x + TEXT_INSET, y: object.y + TEXT_INSET,
    width: object.width - 2 * TEXT_INSET, height: layout.height - 2 * TEXT_INSET,
  };
  const lineHeight = textUnits(object.textSize) * (shape ? 1.45 : TEXT_LAYOUT.lineHeight);
  const inset = shape ? Math.max(0, (box.height - (layout.runs?.length ?? 0) * lineHeight) / 2) : 0;
  const boxes: LinkBox[] = [];
  for (const span of layout.links) {
    const left = box.x + lineOffset(object.align, box.width, span.lineWidth) + span.x;
    const top = box.y + inset + span.line * lineHeight;
    const right = left + span.width, bottom = top + lineHeight;
    const x = shape ? left : Math.max(left, box.x), y = shape ? top : Math.max(top, box.y);
    const width = (shape ? right : Math.min(right, box.x + box.width)) - x;
    const height = (shape ? bottom : Math.min(bottom, box.y + box.height)) - y;
    if (width > 0 && height > 0) boxes.push({ id: object.id, href: span.href, start: span.start, end: span.end, line: span.line, x, y, width, height });
  }
  return boxes;
}

export function linkUnder(objects: readonly ResolvedItem[], layouts: ReadonlyMap<string, LinkLayout>, point: Point, zoom: number, editing?: string): LinkHit | undefined {
  const object = hitObject(objects, point, zoom);
  if (!object || object.id === editing || !hasText(object)) return undefined;
  const layout = layouts.get(object.id);
  if (!layout) return undefined;
  const boxes = linkBoxes(object, layout);
  const box = boxes.find(box => point.x >= box.x && point.x <= box.x + box.width && point.y >= box.y && point.y <= box.y + box.height);
  if (!box) return undefined;
  const run = linkAt(object.marks, count(object.text), box.start, box.start + 1);
  if (!run) return undefined;
  const first = boxes.find(span => span.line === box.line && span.start >= run.start && span.end <= run.end) ?? box;
  return { id: object.id, href: run.href, run: { start: run.start, end: run.end }, box, first };
}

export function cardPlace(anchor: { left: number; top: number; bottom: number }, size: { width: number; height: number }, window: { width: number; height: number }) {
  const below = Math.round(anchor.bottom + 6);
  return { left: Math.max(12, Math.min(anchor.left, window.width - size.width - 12)),
    top: below + size.height > window.height - 12 ? anchor.top - 6 - size.height : below };
}

export type LinkButtonState = { disabled: boolean; reason: string; own: boolean; pressed: boolean };
export function linkButton({ selectionReason, objects, editing, marks, length, start, end }: Range & {
  selectionReason: string; objects: readonly Item[]; editing: boolean; marks: readonly Mark[]; length: number;
}): LinkButtonState {
  const single = objects.length === 1 && objectType(objects[0].type).richText;
  const pressed = single && !!linkAt(marks, length, start, end);
  const ownReason = objects.length > 1 ? LINK_WORDS.several : !length ? LINK_WORDS.empty
    : editing && start === end && !pressed ? LINK_WORDS.caret : "";
  const reason = selectionReason || ownReason;
  return { disabled: !single || !!reason, reason, own: !selectionReason && !!ownReason, pressed };
}

export function pastedLink(text: string) {
  if (/\s/u.test(text.trim())) return undefined;
  const address = linkAddress(text);
  return address.ok ? address.href : undefined;
}
export function editRange(selection: Range, inputType: string | undefined, before: string, after: string): Range | undefined {
  if (!inputType) return undefined;
  const length = count(before), removed = length - count(after);
  let { start, end } = selection;
  if (start === end && !inputType.startsWith("insert")) {
    if (/^delete(?:Content|Word|SoftLine|HardLine)Backward/.test(inputType)) start -= removed;
    else if (/^delete(?:Content|Word|SoftLine|HardLine)Forward/.test(inputType)) end += removed;
    else return undefined;
  }
  return start >= 0 && start <= end && end <= length ? { start, end } : undefined;
}
export const toUnits = (text: string, offset: number) => Array.from(text).slice(0, Math.max(0, offset)).join("").length;

export type LinkPress = { board: string; page: string; id: string; run: Range; href: string; address: string };
export type LinkPointer = {
  move(point: Point, event: { buttons: number; pointerType: string }): void;
  leave(): void;
  press(point: Point): LinkPress | undefined;
  follow(press: LinkPress, up: Point): boolean;
  repeats(press: LinkPress | undefined): boolean;
  doubled(point: Point): boolean;
};
export type EditorLinks = {
  open: boolean;
  highlight?: Range;
  key(event: KeyboardEvent): boolean;
  paste(event: ClipboardEvent): boolean;
  keepsEditing(next: EventTarget | null): boolean;
  compositionStart(range: Range | null): void;
  compositionEdit(): Range | undefined;
};
export type LinkBarModel = {
  value: string; refused: boolean; canApply: boolean; canRemove: boolean; left: number;
  change(value: string): void; submit(): void; apply(): void; remove(): void; close(): void;
};
export type LinkCardModel = {
  left: number; top: number; label: LinkLabel; editable: boolean;
  copy(): void; edit(): void; enter(): void; leave(): void; measure(element: HTMLElement | null): void;
};
export type LinkControls = {
  link: LinkButtonState & { tooltip: string; run(): void };
  copy: { shown: boolean; label: string; run(): void };
  bar: LinkBarModel | null;
};
export type LinkPages = { id: string; openLink(page: string | undefined, object: string | undefined, source: "hash" | "click"): void };

export const BLOCKING_SURFACES = "[role=menu], [role=dialog], [role=listbox], .pages-panel, .swatches, .arrange-menu, .connector-popup, .image-description-panel, .context details[open]";
export function blockingSurfaceOpen(root: ParentNode) {
  return Array.from(root.querySelectorAll(BLOCKING_SURFACES)).some(element => typeof element.checkVisibility === "function"
    ? element.checkVisibility({ visibilityProperty: true })
    : element.getClientRects().length > 0 && getComputedStyle(element).visibility === "visible");
}
