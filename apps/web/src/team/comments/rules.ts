// SPDX-License-Identifier: Apache-2.0
export * from "nextphase-board-sync/comments.ts";
import { nameObject, type CommentThread, type CommentRequest } from "nextphase-board-sync/comments.ts";
import type { BoardV10 } from "nextphase-board-rules/document.ts";

export const words = {
  empty: "No comments yet. Click a sticky, shape or empty spot to start a thread. Press Esc to stop commenting.",
  onlyYours: "No threads you started or replied to.", noResolved: "No resolved threads.",
  offline: "You're offline. Your reply stays here; post it when the board is back.",
  unconfirmed: "Your comment may not have been posted. Your text is kept below.",
  notRetryable: "Your access or the board changed, so this can't be sent again. Check the thread before posting it again.",
  commentDeleted: "This comment was deleted, so your edit wasn't saved. Your text is kept below.",
  threadDeleted: "This thread was deleted.", resolved: "Thread resolved",
  resolvedNote: (name?: string) => name ? `${name} resolved this thread. Replying reopens it.` : "This thread was resolved. Replying reopens it.",
  gone: (name?: string) => `${name ? name + " deleted this thread" : "This thread was deleted"}, so your reply wasn't posted. Your text is kept below.`,
};
export function timeWords(at: number, now = Date.now()) {
  const minutes = Math.floor((now - at) / 60000), hours = Math.floor(minutes / 60);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  if (hours < 24) return hours === 1 ? "1 hour ago" : `${hours} hours ago`;
  const date = new Date(at), today = new Date(now);
  const day = (value: Date) => Date.UTC(value.getFullYear(), value.getMonth(), value.getDate()) / 86400000;
  const days = day(today) - day(date);
  if (days === 1) return "Yesterday";
  if (days >= 2 && days <= 6) return `${days} days ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric",
    ...(date.getFullYear() !== today.getFullYear() ? { year: "numeric" } : {}) });
}
export function replyCount(count: number, resolved = false) {
  return [count ? `${count} ${count === 1 ? "reply" : "replies"}` : "", resolved ? "Resolved" : ""].filter(Boolean).join(" · ");
}
export const lengthWords = (count: number) => `${count.toLocaleString("en-US")} / 4,000`;
export const deleteBody = (count: number) => `This deletes the comment${count ? ` and its ${count} ${count === 1 ? "reply" : "replies"}` : ""} for everyone. You can't undo this.`;
export function objectName(thread: CommentThread, board: BoardV10) {
  const object = !thread.anchor.detached && board.objects.find((object) => object.id === thread.anchor.objectId);
  return object ? nameObject(object) : thread.anchor;
}
export function onWords(thread: CommentThread, board: BoardV10) {
  const name = objectName(thread, board).objectLabel;
  return thread.anchor.detached ? `Detached: “${name}” was deleted` : thread.anchor.objectId ? `On “${name}”` : "On the board";
}
export function detachedWords(thread: CommentThread) {
  return `Detached. The ${thread.anchor.objectType} “${thread.anchor.objectLabel}” was deleted; this thread stays where it was.`;
}
export function threadName(thread: CommentThread, board: BoardV10) {
  const count = thread.comments.length - 1;
  return `Comment thread by ${thread.label} on ${thread.anchor.objectId ? `“${objectName(thread, board).objectLabel}”` : "the board"}` +
    (count > 0 ? `, ${replyCount(count)}` : "") + (thread.anchor.detached ? ", detached" : "") + (thread.resolved ? ", resolved" : "");
}
export function refusalWords(reason: string, text = true, action = "reply") {
  if (reason === "thread_deleted") return text ? words.gone() : words.threadDeleted;
  if (reason === "comment_deleted") return words.commentDeleted;
  if (reason === "comment_limit") return "This board has reached its comment limit.";
  if (reason === "rate_limited") return "You're commenting too fast. Try again in a few minutes.";
  if (reason === "anchor_deleted" && action === "start") return "The object you clicked was deleted, so your comment wasn't posted. Your text is kept below.";
  const message = ["no_access", "epoch_changed"].includes(reason) ? "Your access changed, so this wasn't saved." : "Something went wrong, so this wasn't saved.";
  return message + (text ? " Your text is kept below." : "");
}
export function requestNote(request: CommentRequest | undefined, connected: boolean, action: string) {
  if (!connected) return { text: words.offline, tone: "amber", role: "status" as const };
  if (request?.state === "unconfirmed") return { text: words.unconfirmed, tone: "amber", role: "status" as const };
  if (request?.state === "refused") return { text: refusalWords(request.reason ?? "", true, action), tone: "error", role: "alert" as const };
  return undefined;
}
export function placeBox(point: { left: number; top: number }, size: { w: number; h: number },
  windowWidth: number, panel: boolean, composer = false, measuredHeight = 42) {
  const width = Math.min(composer ? 300 : 320, windowWidth < 768 ? size.w - 24 : Infinity);
  const limit = size.w - (panel && windowWidth >= 768 ? 320 : 12);
  const right = point.left + 44;
  const left = Math.max(12, Math.min(size.w - width - 12, right + width <= limit ? right : point.left - width - 12));
  const top = Math.max(72, Math.min(point.top - (composer ? 38 : 32), size.h - (composer ? 90 + measuredHeight : 100)));
  return { left, top, width, ...(composer ? {} : { maxHeight: Math.max(0, size.h - top - 90) }) };
}
