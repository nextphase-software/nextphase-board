// SPDX-License-Identifier: Apache-2.0
import type { BoardV10, ItemV10 } from "nextphase-board-rules/document.ts";
import { hasRectangle, orderBand } from "nextphase-board-rules/objects/registry.ts";

export type Point = { x: number; y: number };
export type AnchorInput = Point & { objectId: string | null; u: number; v: number };
export type Anchor = AnchorInput & { detached: boolean; objectLabel: string; objectType: string };
export type Comment = { id: string; threadId: string; person: string; label: string; text: string;
  createdAt: number; editedAt: number | null; sequence: number };
export type Thread = { id: string; person: string; label: string; anchor: Anchor; resolved: boolean;
  createdAt: number; updatedAt: number; sequence: number; firstComment: string };
export type CommentThread = Thread & { comments: Comment[] };
export type CommentOperation =
  | { action: "start"; threadId: string; commentId: string; anchor: AnchorInput; text: string }
  | { action: "reply" | "edit"; threadId: string; commentId: string; text: string }
  | { action: "delete_comment"; threadId: string; commentId: string }
  | { action: "delete_thread" | "resolve" | "reopen"; threadId: string }
  | { action: "move"; threadId: string; anchor: AnchorInput };
export type CommentRequest = { state: "sent" | "saved" | "refused" | "unconfirmed"; reason?: string;
  text: string; epoch: number; restoreGeneration: number; sequence?: number };
export const commentColours = ["#2563eb", "#dc2626", "#16a34a", "#9333ea", "#ea580c", "#0891b2", "#db2777", "#4f46e5"];
const loneSurrogate = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g;
export const normalizeText = (text: string) => text.replace(/\r\n?/g, "\n").replace(loneSurrogate, "\uFFFD");
export const textLength = (text: string) => [...text].length;
export const emptyText = (text: string) => /^\p{White_Space}*$/u.test(text);
export function textProblem(text: string): string | null {
  if (text !== text.replace(loneSurrogate, "\uFFFD") || /[\x00-\x08\x0b-\x1f\x7f-\x9f]/.test(text)) return "bad_message";
  return emptyText(text) ? "empty_text" : textLength(text) > 4000 ? "too_long" : null;
}
export function authorColour(person: string) {
  let hash = 0;
  for (const character of person) hash = (Math.imul(hash, 31) + character.codePointAt(0)!) >>> 0;
  return commentColours[hash % 8];
}
export function nameObject(object: ItemV10) {
  const objectType = object.type === "stroke" ? "drawing" : object.type;
  const text = "text" in object ? object.text ?? "" : "";
  const label = text.slice(0, 120).replace(/[\x00-\x1f\x7f-\x9f]/g, " ");
  return { objectType, objectLabel: label.trim() ? label : objectType[0].toUpperCase() + objectType.slice(1) };
}
export function drawingOrder(a: ItemV10, b: ItemV10) {
  return orderBand(a) - orderBand(b) || a.order - b.order;
}
export function anchorAt(board: BoardV10, point: Point, onConnector = false): Anchor {
  const object = !onConnector && [...board.objects].sort(drawingOrder).reverse().find((object) =>
    hasRectangle(object) && point.x >= object.x && point.x <= object.x + object.width &&
    point.y >= object.y && point.y <= object.y + object.height);
  if (!object || !hasRectangle(object)) return { ...point, objectId: null, u: 0, v: 0,
    detached: false, objectLabel: "", objectType: "" };
  const clamp = (value: number) => Math.max(0, Math.min(1, value));
  return { ...point, objectId: object.id, u: clamp((point.x - object.x) / object.width),
    v: clamp((point.y - object.y) / object.height), detached: false, ...nameObject(object) };
}
export function anchorPoint(anchor: Anchor, board: BoardV10): Point {
  const object = !anchor.detached && board.objects.find((object) => object.id === anchor.objectId);
  return object && hasRectangle(object) ? { x: object.x + object.width * anchor.u,
    y: object.y + object.height * anchor.v } : { x: anchor.x, y: anchor.y };
}
export function detachAnchor(anchor: Anchor, before: BoardV10, after: BoardV10): Anchor {
  if (anchor.detached || anchor.objectId === null) return anchor;
  const object = before.objects.find((object) => object.id === anchor.objectId);
  if (!after.objects.some((object) => object.id === anchor.objectId)) {
    return { ...anchor, ...anchorPoint(anchor, before), detached: true, ...(object ? nameObject(object) : {}) };
  }
  return { ...anchor, ...anchorPoint(anchor, after) };
}
export function visibleThreads(threads: Iterable<CommentThread>, person: string, showResolved = false, onlyYours = false) {
  return [...threads].filter((thread) => (showResolved || !thread.resolved) &&
    (!onlyYours || thread.person === person || thread.comments.some((comment) => comment.person === person)))
    .sort((a, b) => a.sequence - b.sequence);
}
