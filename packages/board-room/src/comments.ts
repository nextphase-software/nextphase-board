// SPDX-License-Identifier: Apache-2.0
import type { BoardV10 } from "nextphase-board-rules/document.ts";
import { hasRectangle } from "nextphase-board-rules/objects/registry.ts";
import { anchorPoint, detachAnchor, nameObject, textProblem, type Anchor, type AnchorInput,
  type Comment, type CommentOperation, type Thread } from "nextphase-board-sync/comments.ts";
import { Mentions } from "./mentions.ts";
import type { Mention } from "nextphase-board-sync/comments.ts";
import type { Access } from "./access.ts";
import type { RoomEnvironment } from "./interfaces.ts";
import { bytes, send, type Connection } from "./protocol.ts";
import { meta, setMeta, type Row } from "./storage.ts";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const id = (value: unknown) => typeof value === "string" && uuid.test(value);
function operationShape(value: unknown): value is CommentOperation {
  if (!record(value) || !id(value.threadId)) return false;
  const action = value.action;
  if (!["start", "reply", "edit", "delete_comment", "delete_thread", "resolve", "reopen", "move"].includes(String(action))) return false;
  if (["start", "reply", "edit", "delete_comment"].includes(String(action)) && !id(value.commentId)) return false;
  if (["start", "reply", "edit"].includes(String(action)) &&
    (typeof value.text !== "string" || textProblem(value.text) === "bad_message")) return false;
  return !["start", "move"].includes(String(action)) || record(value.anchor);
}
function threadRow(row: Row): Thread {
  return { id: String(row.id), person: String(row.person), label: String(row.label), anchor: JSON.parse(String(row.anchor)),
    resolved: !!row.resolved, createdAt: Number(row.created_at), updatedAt: Number(row.updated_at),
    sequence: Number(row.sequence), firstComment: String(row.first_comment) };
}
export function commentRow(row: Row): Comment {
  return { id: String(row.id), threadId: String(row.thread_id), person: String(row.person), label: String(row.label),
    text: String(row.text), createdAt: Number(row.created_at), editedAt: row.edited_at === null ? null : Number(row.edited_at),
    sequence: Number(row.sequence), mentions: JSON.parse(String(row.mentions ?? "[]")) };
}
export class Comments {
  mentions: Mentions;
  private env: RoomEnvironment;
  private access: Access;
  private host: { board: BoardV10; boardId: string; generation: number };
  constructor(env: RoomEnvironment, access: Access, host: { board: BoardV10; boardId: string; generation: number }) {
    this.mentions = new Mentions(env, host);
    this.env = env; this.access = access; this.host = host;
  }
  snapshot(connection: Connection) {
    const storage = this.env.storage;
    send(connection, { kind: "comments_snapshot", reset: true, sequence: meta(storage, "comment_sequence") });
    for (const row of storage.all("SELECT * FROM threads ORDER BY sequence")) {
      send(connection, { kind: "comment_changed", threadId: row.id, thread: threadRow(row) });
    }
    for (const row of storage.all("SELECT * FROM comments ORDER BY sequence")) {
      send(connection, { kind: "comment_changed", threadId: row.thread_id, commentId: row.id, comment: commentRow(row) });
    }
    send(connection, { kind: "comments_snapshot", done: true });
  }
  async handle(connection: Connection, message: Record<string, unknown>) {
    const refuse = (reason: string) => send(connection, { kind: "comment_refused", reason,
      ...(typeof message.requestId === "string" ? { requestId: message.requestId } : {}) });
    if (typeof message.requestId !== "string" || !message.requestId.length || [...message.requestId].length > 100 ||
      !Number.isSafeInteger(message.epoch) || !Number.isSafeInteger(message.restoreGeneration) || !operationShape(message.operation)) { refuse("bad_message"); return; }
    const value = connection.attachment(), grant = this.access.get(value.id);
    if (!grant) { refuse("no_access"); return; }
    if (grant.epoch !== message.epoch || grant.epoch !== value.epoch) { refuse("epoch_changed"); return; }
    const storage = this.env.storage, op = message.operation;
    if (message.restoreGeneration !== meta(storage, "restore_generation")) { refuse("restore_changed"); return; }
    // Hash the parsed operation, including its original key order and ignored fields.
    const digest = await this.env.hash(bytes("comment:" + JSON.stringify(op)));
    const receipt = storage.all("SELECT * FROM receipts WHERE person_id = ? AND request_id = ?", value.id, message.requestId)[0];
    if (receipt) {
      if (receipt.kind !== "comment" || receipt.digest !== digest) refuse("request_id_reused");
      else {
        send(connection, { kind: "comment_saved", requestId: message.requestId, sequence: Number(receipt.revision) });
        this.snapshot(connection);
      }
      return;
    }
    if ("text" in op) {
      const problem = textProblem(op.text);
      if (problem) { refuse(problem); return; }
    }
    const stored = storage.all("SELECT * FROM threads WHERE id = ?", op.threadId)[0];
    const used = (identifier: string) => storage.all("SELECT id FROM comment_ids WHERE id = ?", identifier).length > 0;
    let comment: Row | undefined;
    if (op.action === "start") {
      if (op.threadId === op.commentId || used(op.threadId) || used(op.commentId)) { refuse("identifier_reused"); return; }
    } else {
      if (!stored) { refuse("thread_deleted"); return; }
      if (op.action === "reply" && used(op.commentId)) { refuse("identifier_reused"); return; }
      if (op.action === "edit" || op.action === "delete_comment") {
        comment = storage.all("SELECT * FROM comments WHERE id = ? AND thread_id = ?", op.commentId, op.threadId)[0];
        if (!comment) { refuse("comment_deleted"); return; }
      }
    }
    if (comment && comment.author_id !== value.id ||
      (op.action === "move" || op.action === "delete_thread") && stored.author_id !== value.id) { refuse("not_author"); return; }
    let mentionPlan: Awaited<ReturnType<Mentions["prepare"]>> | undefined;
    const mentions: Mention[] = "text" in op ? (op.mentions === undefined ? [] : op.mentions) : [];
    if ("text" in op) {
      try { mentionPlan = await this.mentions.prepare(value.id, op.text, mentions, comment); }
      catch (error) { refuse(error instanceof Error ? error.message : "service_unavailable"); return; }
    }
    let anchor: Anchor | undefined;
    if ("anchor" in op) {
      const input: AnchorInput = op.anchor;
      if (![input.x, input.y, input.u, input.v].every((n) => typeof n === "number" && Number.isFinite(n)) ||
        Math.abs(input.x) > 1000000 || Math.abs(input.y) > 1000000 || input.u < 0 || input.u > 1 || input.v < 0 || input.v > 1 ||
        input.objectId !== null && !id(input.objectId)) { refuse("bad_anchor"); return; }
      const object = this.host.board.objects.find((object) => object.id === input.objectId);
      if (input.objectId !== null && (!object || !hasRectangle(object))) { refuse("anchor_deleted"); return; }
      const old = stored && threadRow(stored).anchor;
      if (old?.detached) anchor = { ...old, x: input.x, y: input.y };
      else {
        anchor = { objectId: input.objectId, u: object ? input.u : 0, v: object ? input.v : 0,
          x: input.x, y: input.y, detached: false, ...(object ? nameObject(object) : { objectLabel: "", objectType: "" }) };
        Object.assign(anchor, anchorPoint(anchor, this.host.board));
      }
    }
    const posting = op.action === "start" || op.action === "reply";
    if ("text" in op) {
      const total = storage.all('SELECT COUNT(*) AS count, COALESCE(SUM(length(CAST(text AS BLOB))), 0) AS bytes FROM comments')[0];
      const nextBytes = Number(total.bytes) + bytes(op.text).length - (op.action === "edit" ? bytes(String(comment!.text)).length : 0);
      if (nextBytes > 4194304 || posting && Number(total.count) >= 2000) { refuse("comment_limit"); return; }
    }
    const now = this.env.now(), hour = Math.floor(now / 3600000), kind = posting ? "post" : "other";
    const times = (value.commentTimes ?? []).filter((at) => at > now - 1000);
    const count = Number(storage.all("SELECT count FROM comment_counts WHERE person_id = ? AND hour = ? AND kind = ?", value.id, hour, kind)[0]?.count ?? 0);
    if (count >= (posting ? 100 : 600) || times.length >= 10) { refuse("rate_limited"); return; }
    const sequence = meta(storage, "comment_sequence") + 1;
    const person = (await this.env.hash(bytes(`presence:${this.host.boardId}:${value.id}`))).slice(0, 32);
    let changed: Record<string, unknown>;
    storage.transaction(() => {
      if (op.action === "start") {
        storage.exec("INSERT INTO threads VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, ?)", op.threadId, value.id, person, value.label!, JSON.stringify(anchor), now, now, sequence, op.commentId);
        storage.exec("INSERT INTO comment_ids VALUES (?, 'thread', ?)", op.threadId, sequence);
      }
      if (posting) {
        storage.exec("INSERT INTO comments VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)", op.commentId, op.threadId, value.id, person, value.label!, op.text, now, sequence, JSON.stringify(mentions));
        storage.exec("INSERT INTO comment_ids VALUES (?, 'comment', ?)", op.commentId, sequence);
        storage.exec("UPDATE threads SET resolved = 0, updated_at = ? WHERE id = ?", now, op.threadId);
      } else if (op.action === "edit") {
        storage.exec("UPDATE comments SET text = ?, edited_at = ?, mentions = ? WHERE id = ?", op.text, now, JSON.stringify(mentions), op.commentId);
        storage.exec("UPDATE threads SET updated_at = ? WHERE id = ?", now, op.threadId);
      } else if (op.action === "delete_thread" || op.action === "delete_comment" && stored.first_comment === op.commentId) {
        storage.exec("DELETE FROM comments WHERE thread_id = ?", op.threadId);
        storage.exec("DELETE FROM threads WHERE id = ?", op.threadId);
      } else if (op.action === "delete_comment") {
        storage.exec("DELETE FROM comments WHERE id = ?", op.commentId);
        storage.exec("UPDATE threads SET updated_at = ? WHERE id = ?", now, op.threadId);
      } else if (op.action === "move") {
        storage.exec("UPDATE threads SET anchor = ?, updated_at = ? WHERE id = ?", JSON.stringify(anchor), now, op.threadId);
      } else if (op.action === "resolve" || op.action === "reopen") {
        const resolved = Number(op.action === "resolve");
        if (Number(stored.resolved) !== resolved) storage.exec("UPDATE threads SET resolved = ?, updated_at = ? WHERE id = ?", resolved, now, op.threadId);
      }
      if (mentionPlan && "commentId" in op) this.mentions.save(op.commentId, op.threadId, mentionPlan, now);
      else if (op.action.startsWith("delete")) this.mentions.cleanDeleted();
      setMeta(storage, "comment_sequence", sequence);
      storage.exec("INSERT INTO receipts VALUES (?, ?, ?, ?, 'comment')", value.id, message.requestId as string, digest, sequence);
      storage.exec("DELETE FROM comment_counts WHERE hour < ?", hour);
      storage.exec("INSERT INTO comment_counts VALUES (?, ?, ?, ?) ON CONFLICT(person_id, hour, kind) DO UPDATE SET count = excluded.count", value.id, hour, kind, count + 1);
      const thread = storage.all("SELECT * FROM threads WHERE id = ?", op.threadId)[0];
      changed = { kind: "comment_changed", sequence, by: value.label, threadId: op.threadId, thread: thread ? threadRow(thread) : null };
      if (thread && "commentId" in op) {
        const row = storage.all("SELECT * FROM comments WHERE id = ?", op.commentId)[0];
        Object.assign(changed, { commentId: op.commentId, comment: row ? commentRow(row) : null });
      }
    });
    connection.attach({ ...connection.attachment(), commentTimes: [...times, now] });
    for (const peer of this.env.connections()) send(peer, changed!);
    send(connection, { kind: "comment_saved", requestId: message.requestId, sequence });
  }
}
// Called inside the edit's own transaction; only deletions need wire frames.
export function keepAnchors(env: RoomEnvironment, before: BoardV10, after: BoardV10) {
  const detached: Thread[] = [];
  for (const row of env.storage.all("SELECT * FROM threads ORDER BY sequence")) {
    const thread = threadRow(row), next = detachAnchor(thread.anchor, before, after);
    if (JSON.stringify(next) === JSON.stringify(thread.anchor)) continue;
    env.storage.exec("UPDATE threads SET anchor = ? WHERE id = ?", JSON.stringify(next), thread.id);
    if (!thread.anchor.detached && next.detached) detached.push({ ...thread, anchor: next });
  }
  return detached;
}
