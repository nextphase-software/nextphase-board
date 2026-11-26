// SPDX-License-Identifier: Apache-2.0
import { validate, validText, type BoardV14 } from "nextphase-board-rules/document.ts";
import { hasEnds, hasRectangle } from "nextphase-board-rules/objects/registry.ts";
import { buildSnapshot, type Snapshot } from "../clipboard.ts";
import { connectorLayout } from "../connectors.ts";

export type Template = {
  id: string; name: string; description: string; creatorLabel: string; sourceTitle: string;
  objectCount: number; createdAt: string; updatedAt: string; canManage: boolean; objects: Snapshot["objects"];
};
export const TEMPLATE_LIMIT = 25, TEMPLATE_BYTES = 262144;
export const TEMPLATE_MEDIA_BYTES = 20_971_520;
export type AssetEntry = { hash: string; type: string; bytes: number };
export type TemplateDetail = Template & { media: AssetEntry[] };
const pictureTypes = ["image/png", "image/jpeg", "image/gif", "image/webp"];
const videoTypes = ["video/mp4", "video/quicktime", "video/webm"];
export function parseAssetEntries(value: unknown): AssetEntry[] {
  if (!Array.isArray(value) || value.length > 1_000) throw Error("Invalid media");
  const hashes = new Set<string>();
  for (const entry of value) {
    if (!entry || Object.keys(entry).sort().join() !== "bytes,hash,type" || typeof entry.hash !== "string" ||
      !/^[0-9a-f]{64}$/.test(entry.hash) || hashes.has(entry.hash) ||
      !Number.isInteger(entry.bytes) || entry.bytes < 1 ||
      !(pictureTypes.includes(entry.type) && entry.bytes <= TEMPLATE_MEDIA_BYTES || videoTypes.includes(entry.type) && entry.bytes <= 52_428_800)) throw Error("Invalid media");
    hashes.add(entry.hash);
  }
  return value;
}
export const mib = (bytes: number) => (Math.floor(bytes * 10 / 1_048_576 + 0.5) / 10).toFixed(1);
export const mibUp = (bytes: number) => String(Math.ceil(bytes / 1_048_576));
export function pictureLine(counts: { pictures: number; videos: number }, bytes?: number) {
  const count = [counts.pictures ? `${counts.pictures} picture${counts.pictures === 1 ? "" : "s"}` : "",
    counts.videos ? `${counts.videos} video${counts.videos === 1 ? "" : "s"}` : ""].filter(Boolean).join(" and ");
  if (!count) return "";
  return `Includes ${count}${bytes === undefined ? "" : ` (${bytes > TEMPLATE_MEDIA_BYTES ? mibUp(bytes) : mib(bytes)} MiB of the 20 MiB a template can hold)`}.`;
}
export const points = (text: string) => [...text].length;
export const contentBytes = (objects: unknown) => new TextEncoder().encode(JSON.stringify(objects)).byteLength;
export const validName = (name: unknown): name is string => typeof name === "string" && validText(name, 120, true) && !name.includes("\u0000");
export const validDescription = (text: unknown): text is string => typeof text === "string" && validText(text, 300) && !text.includes("\u0000");
function containsNul(value: unknown): boolean {
  return typeof value === "string" ? value.includes("\u0000") : !!value && typeof value === "object" &&
    Object.entries(value).some(([k, v]) => k.includes("\u0000") || containsNul(v));
}
export function templateBoard(objects: unknown): BoardV14 {
  if (!Array.isArray(objects) || objects.length < 1 || objects.length > 250 || containsNul(objects) || objects.some(o =>
    !o || typeof o !== "object" || Array.isArray(o) || "generation" in o || "order" in o || "page" in o)) throw Error("Invalid template");
  const boardId = crypto.randomUUID();
  const board = validate({ schemaVersion: 17, boardId, pages: [{ id: boardId, name: "Page 1" }], title: "Template", retiredGenerations: [],
    objects: objects.map((o, order) => ({ ...o, page: boardId, order, generation: crypto.randomUUID() })) }) as BoardV14;
  if (contentBytes(objects) > TEMPLATE_BYTES) throw Error("This is too large for a template. Select fewer objects.");
  return board;
}
export function templateSnapshot(board: BoardV14, selected: ReadonlySet<string>, drawn: Parameters<typeof buildSnapshot>[2], page = board.pages[0].id) {
  // Page captures have no canvas measurements. Resolve connector boxes from
  // saved geometry; the clipboard placement box is not part of template storage.
  const rectangles = new Map(board.objects.filter(hasRectangle).map(o => [o.id, o]));
  const missing = board.objects.filter(hasEnds).filter(o => !drawn.some(d => d.id === o.id)).map(o => {
    const bounds = connectorLayout(o, rectangles, text => [...text].length * 10).bounds;
    return { ...o, ...bounds, displayHeight: bounds.height };
  });
  return { title: board.title, ...(board.pages.length > 1 ? { pageName: board.pages.find(p => p.id === page)?.name } : {}), selected: selected.size > 0,
    snapshot: buildSnapshot(board, selected.size ? selected : new Set(board.objects.filter(o => o.page === page).map(o => o.id)), [...missing, ...drawn]) };
}
export const saveLabel = (selected: boolean, multiple = false) => selected ? "Save selection as template" : multiple ? "Save page as template" : "Save board as template";
export const limitReason = (workspace: string) => `${workspace} has 25 templates, the most it can keep. Delete one to save another.`;
export function saveReason(commandReason: string, canSave: boolean, count: number, workspace: string, objects: number): string {
  return commandReason || (!canSave ? "Only workspace owners and editors can save templates" : count >= TEMPLATE_LIMIT
    ? limitReason(workspace) : !objects ? "Add something to the board first." : "");
}
export function parseTemplate(value: unknown): Template {
  const t = value as Template;
  const keys = ["id", "name", "description", "creatorLabel", "sourceTitle", "objectCount", "createdAt", "updatedAt", "canManage", "objects"];
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
  const time = (v: unknown) => typeof v === "string" && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(v) && Number.isFinite(Date.parse(v));
  if (!t || typeof t !== "object" || Object.keys(t).sort().join() !== keys.sort().join() || !uuid.test(t.id) ||
    !validName(t.name) || !validDescription(t.description) || typeof t.creatorLabel !== "string" || typeof t.sourceTitle !== "string" ||
    !time(t.createdAt) || !time(t.updatedAt) || typeof t.canManage !== "boolean" || !Array.isArray(t.objects) || t.objectCount !== t.objects.length) throw Error("Invalid template response");
  templateBoard(t.objects);
  return t;
}
export function parseTemplateDetail(value: unknown): TemplateDetail {
  if (!value || typeof value !== "object") throw Error("Invalid template response");
  const { media, ...template } = value as TemplateDetail;
  const entries = parseAssetEntries(media);
  if (entries.some((entry, i) => i > 0 && entries[i - 1].hash >= entry.hash)) throw Error("Invalid media order");
  return { ...parseTemplate(template), media: entries };
}
export function sortTemplates(templates: Template[]) {
  return [...templates].sort((a, b) => a.updatedAt === b.updatedAt ? (a.id < b.id ? -1 : a.id > b.id ? 1 : 0) : a.updatedAt > b.updatedAt ? -1 : 1);
}
export function parseTemplates(value: unknown) {
  const v = value as { templates: unknown[]; limit: number; canSave: boolean };
  if (!v || Object.keys(v).sort().join() !== "canSave,limit,templates" || v.limit !== 25 || typeof v.canSave !== "boolean" ||
    !Array.isArray(v.templates) || v.templates.length > 25) throw Error("Invalid templates response");
  return { templates: sortTemplates(v.templates.map(parseTemplate)), canSave: v.canSave };
}
export function templateNotice(action: "saved" | "updated" | "replaced" | "deleted" | "added" | "gone" | "refused", name: string, workspace = "", count = 0): string {
  switch (action) {
    case "saved": return `Saved “${name}” to ${workspace}.`;
    case "updated": return `Updated “${name}”.`;
    case "replaced": return `Replaced “${name}” with ${count} objects.`;
    case "deleted": return `Deleted “${name}”.`;
    case "added": return `Added “${name}”: ${count} objects.`;
    case "gone": return `“${name}” is no longer available. Templates were refreshed.`;
    case "refused": return `You can no longer save templates in ${workspace}. Templates were refreshed.`;
  }
}
export function menuIndex(key: string, current: number, length = 3): number | null {
  return key === "ArrowDown" ? (current + 1) % length : key === "ArrowUp" ? (current + length - 1) % length
    : key === "Home" ? 0 : key === "End" ? length - 1 : null;
}
