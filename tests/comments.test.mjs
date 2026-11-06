// SPDX-License-Identifier: Apache-2.0
import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

async function boardFixture() {
  const { empty, upgrade, add } = await import("../packages/board-rules/src/document.ts");
  let board = upgrade(empty());
  board = add(board, "section", 0, 0);
  board = add(board, "sticky", 0, 0);
  board = add(board, "text", 0, 0);
  board.objects = board.objects.map((object, order) => ({ ...object, x: 0, y: 0, width: 100, height: 100, order }));
  return board;
}
test("anchors choose the highest drawing band and then saved order, including grouped children", async () => {
  const { anchorAt } = await import("../packages/board-sync/src/comments.ts");
  const board = await boardFixture(), [section, sticky, text] = board.objects;
  section.order = 100;
  assert.equal(anchorAt(board, { x: 20, y: 30 }).objectId, text.id);
  sticky.order = 200; sticky.group = randomUUID();
  assert.equal(anchorAt(board, { x: 20, y: 30 }).objectId, sticky.id);
  for (const [point, u, v] of [[{ x: 0, y: 0 }, 0, 0], [{ x: 100, y: 100 }, 1, 1]]) {
    const anchor = anchorAt(board, point); assert.equal(anchor.u, u); assert.equal(anchor.v, v);
  }
});
test("connectors, empty points and section titles outside saved boxes make board anchors", async () => {
  const { anchorAt } = await import("../packages/board-sync/src/comments.ts");
  const board = await boardFixture();
  for (const [point, connector] of [[{ x: 10, y: 20 }, true], [{ x: 1000, y: 20 }, false], [{ x: 20, y: -12 }, false]]) {
    assert.deepEqual(anchorAt(board, point, connector), { ...point, objectId: null, u: 0, v: 0, detached: false, objectLabel: "", objectType: "" });
  }
});
test("pins follow saved move and non-uniform resize and ignore display growth", async () => {
  const { anchorAt, anchorPoint } = await import("../packages/board-sync/src/comments.ts");
  const board = await boardFixture(), anchor = anchorAt(board, { x: 25, y: 75 });
  board.objects.at(-1).displayHeight = 900;
  assert.deepEqual(anchorPoint(anchor, board), { x: 25, y: 75 });
  Object.assign(board.objects.at(-1), { x: 10, y: 30, width: 200, height: 400 });
  assert.deepEqual(anchorPoint(anchor, board), { x: 60, y: 330 });
});
test("detaching stores the pre-edit point and live naming, moves store the post-edit point", async () => {
  const { anchorAt, detachAnchor } = await import("../packages/board-sync/src/comments.ts");
  const before = await boardFixture(), anchor = anchorAt(before, { x: 25, y: 75 });
  before.objects.at(-1).text = "Renamed\nidea\t\u007f";
  const moved = structuredClone(before); Object.assign(moved.objects.at(-1), { x: 40, y: 60, width: 200, height: 50 });
  const point = detachAnchor(anchor, before, moved); assert.equal(point.x, 90); assert.equal(point.y, 97.5); assert.equal(point.detached, false);
  const after = { ...before, objects: [] }, detached = detachAnchor(anchor, before, after);
  assert.equal(detached.x, 25); assert.equal(detached.y, 75); assert.equal(detached.detached, true);
  assert.equal(detached.objectLabel, "Renamed idea  "); assert.equal(detached.objectType, "text");
  assert.deepEqual(detachAnchor(detached, after, before), detached);
  assert.deepEqual(detachAnchor(detached, after, moved), detached);
  const boardPoint = anchorAt(before, { x: 900, y: 900 });
  assert.deepEqual(detachAnchor(boardPoint, before, moved), boardPoint);
});
test("object labels use 120 UTF-16 units, sanitize controls and fall back to type words", async () => {
  const { nameObject } = await import("../packages/board-sync/src/comments.ts");
  const board = await boardFixture(), object = board.objects[1];
  assert.deepEqual(nameObject({ ...object, text: " \t\n" }), { objectLabel: "Sticky", objectType: "sticky" });
  assert.equal(nameObject({ ...object, text: "a".repeat(119) + "😀" }).objectLabel.length, 120);
  assert.deepEqual(nameObject({ ...object, type: "stroke", text: undefined }), { objectLabel: "Drawing", objectType: "drawing" });
});
test("text normalizes CRLF, carriage returns and lone surrogates, keeping pairs and spaces", async () => {
  const { normalizeText, textProblem, textLength } = await import("../packages/board-sync/src/comments.ts");
  assert.equal(normalizeText(" a\r\nb\rc\ud800x\udc00😀\n"), " a\nb\nc�x�😀\n");
  assert.equal(textLength("a".repeat(3999) + "😀"), 4000);
  assert.equal(textProblem("a".repeat(3999) + "😀"), null);
  assert.equal(textProblem("a".repeat(4000) + "😀"), "too_long");
  for (const text of ["", " \t\n", "\u2003\u00a0"]) assert.equal(textProblem(text), "empty_text");
  for (const code of [...Array(160).keys()].filter((code) => code < 32 && ![9, 10].includes(code) || code >= 127)) {
    assert.equal(textProblem("x" + String.fromCharCode(code)), "bad_message", String(code));
  }
  assert.equal(textProblem("\ud800"), "bad_message"); assert.equal(textProblem(" \tvalue\n"), null);
});
test("author colours hash fixed person keys to the eight permitted colours", async () => {
  const { authorColour, commentColours } = await import("../packages/board-sync/src/comments.ts");
  assert.equal(authorColour("ana"), "#ea580c"); assert.equal(authorColour("ben"), "#9333ea");
  assert.equal(authorColour("00000000000000000000000000000000"), "#2563eb");
  assert.deepEqual(new Set(Array.from({ length: 100 }, (_, index) => authorColour(String(index)))), new Set(commentColours));
});
test("thread filters include authors and repliers, hide resolved and preserve saved order", async () => {
  const { visibleThreads } = await import("../packages/board-sync/src/comments.ts");
  const threads = [{ id: "3", sequence: 3, resolved: true, person: "me", comments: [] },
    { id: "2", sequence: 2, resolved: false, person: "other", comments: [{ person: "me" }] },
    { id: "1", sequence: 1, resolved: false, person: "other", comments: [] }];
  assert.deepEqual(visibleThreads(threads, "me").map((thread) => thread.id), ["1", "2"]);
  assert.deepEqual(visibleThreads(threads, "me", true, true).map((thread) => thread.id), ["2", "3"]);
  assert.deepEqual(visibleThreads(threads, "me", false, true).map((thread) => thread.id), ["2"]);
});
test("time words cover minute and hour edges, calendar days and both date formats", async () => {
  const { timeWords } = await import("../apps/web/src/team/comments/rules.ts");
  const now = new Date(2026, 10, 3, 14).getTime();
  for (const [elapsed, expected] of [[59000, "Just now"], [60000, "1 min ago"], [59 * 60000, "59 min ago"],
    [3600000, "1 hour ago"], [23 * 3600000, "23 hours ago"], [86400000, "Yesterday"],
    [2 * 86400000, "2 days ago"], [6 * 86400000, "6 days ago"], [7 * 86400000, new Intl.DateTimeFormat(undefined,{year:"numeric",month:"short",day:"numeric",hour:"2-digit",minute:"2-digit",timeZoneName:"short"}).format(now - 7 * 86400000)]]) {
    assert.equal(timeWords(now - elapsed, now), expected);
  }
  assert.equal(timeWords(new Date(2025, 9, 28).getTime(), now), new Intl.DateTimeFormat(undefined,{year:"numeric",month:"short",day:"numeric",hour:"2-digit",minute:"2-digit",timeZoneName:"short"}).format(new Date(2025, 9, 28).getTime()));
});
test("comment words cover counts, delete questions, limits, names and every refusal note", async () => {
  const r = await import("../apps/web/src/team/comments/rules.ts"), board = await boardFixture();
  for (const [count, plain, resolved] of [[0, "", "Resolved"], [1, "1 reply", "1 reply · Resolved"], [2, "2 replies", "2 replies · Resolved"]]) {
    assert.equal(r.replyCount(count), plain); assert.equal(r.replyCount(count, true), resolved);
    assert.equal(r.deleteBody(count), `This deletes the comment${count ? ` and its ${count} ${count === 1 ? "reply" : "replies"}` : ""} for everyone. You can't undo this.`);
  }
  assert.equal(r.lengthWords(4012), "4,012 / 4,000");
  const thread = { person: "p", label: "ana", comments: [{}, {}, {}], anchor: r.anchorAt(board, { x: 50, y: 50 }), resolved: false };
  board.objects.at(-1).text = "Pick the launch date";
  assert.equal(r.threadName(thread, board), "Comment thread by ana on “Pick the launch date”, 2 replies");
  thread.anchor.detached = true; thread.resolved = true;
  assert.match(r.threadName(thread, board), /, 2 replies, detached, resolved$/);
  thread.anchor.objectId = null; thread.comments = [{}]; thread.anchor.detached = false; thread.resolved = false;
  assert.equal(r.threadName(thread, board), "Comment thread by ana on the board");
  assert.equal(r.onWords(thread, board), "On the board");
  assert.equal(r.words.resolvedNote("ben"), "ben resolved this thread. Replying reopens it.");
  assert.equal(r.words.resolvedNote(), "This thread was resolved. Replying reopens it.");
  assert.equal(r.words.gone("ben"), "ben deleted this thread, so your reply wasn't posted. Your text is kept below.");
  assert.equal(r.refusalWords("thread_deleted", false), "This thread was deleted.");
  assert.equal(r.refusalWords("thread_deleted"), r.words.gone());
  assert.equal(r.refusalWords("comment_deleted"), r.words.commentDeleted);
  assert.equal(r.refusalWords("comment_limit"), "This board has reached its comment limit.");
  assert.equal(r.refusalWords("rate_limited"), "You're commenting too fast. Try again in a few minutes.");
  for (const reason of ["no_access", "epoch_changed"]) {
    assert.equal(r.refusalWords(reason, false), "Your access changed, so this wasn't saved.");
    assert.equal(r.refusalWords(reason), "Your access changed, so this wasn't saved. Your text is kept below.");
  }
  assert.equal(r.refusalWords("anchor_deleted", true, "start"), "The object you clicked was deleted, so your comment wasn't posted. Your text is kept below.");
  for (const reason of ["bad_message", "bad_anchor", "identifier_reused", "not_author", "request_id_reused", "anchor_deleted"]) {
    assert.equal(r.refusalWords(reason), "Something went wrong, so this wasn't saved. Your text is kept below.");
    assert.equal(r.refusalWords(reason, false), "Something went wrong, so this wasn't saved.");
  }
  assert.equal(r.requestNote(undefined, false, "reply").text, r.words.offline);
  assert.equal(r.requestNote({ state: "unconfirmed" }, true, "reply").text, r.words.unconfirmed);
  assert.equal(r.requestNote({ state: "refused", reason: "comment_limit" }, true, "reply").role, "alert");
  assert.equal(r.requestNote({ state: "saved" }, true, "reply"), undefined);
});
test("placement flips by panel and edge, clamps both axes and fits narrow windows", async () => {
  const { placeBox } = await import("../apps/web/src/team/comments/rules.ts");
  const size = { w: 1280, h: 800 };
  assert.deepEqual(placeBox({ left: 100, top: 300 }, size, 1280, false), { left: 144, top: 268, width: 320, maxHeight: 442 });
  assert.equal(placeBox({ left: 700, top: 300 }, size, 1280, false).left, 744);
  assert.equal(placeBox({ left: 700, top: 300 }, size, 1280, true).left, 368);
  assert.equal(placeBox({ left: 1200, top: 300 }, size, 1280, false, true).left, 888);
  for (const composer of [true, false]) for (const panel of [true, false]) {
    assert.equal(placeBox({ left: -999, top: -999 }, size, 1280, panel, composer).left, 12);
    assert.equal(placeBox({ left: 9999, top: 9999 }, size, 1280, panel, composer).left, composer ? 968 : 948);
    assert.equal(placeBox({ left: 100, top: 0 }, size, 1280, panel, composer).top, 72);
    assert.equal(placeBox({ left: 100, top: 9999 }, size, 1280, panel, composer, 80).top, composer ? 630 : 700);
    const narrow = placeBox({ left: 200, top: 300 }, { w: 300, h: 800 }, 390, panel, composer);
    assert.equal(narrow.left, 12); assert.equal(narrow.width, 276);
  }
});

async function clientFixture(sync) {
  const Y = await import("yjs"), { Adapter } = await import("../packages/board-sync/src/document-adapter.ts");
  const { empty, upgrade } = await import("../packages/board-rules/src/document.ts");
  const seed = new Adapter(); seed.set(upgrade(empty()));
  const timers = new Set(), wires = [], events = []; let now = 0;
  const clock = { now: () => now, after(ms, run) { const timer = { at: now + ms, run }; timers.add(timer); return () => timers.delete(timer); } };
  const joined = { kind: "joined", role: "editor", epoch: 2, restoreGeneration: 0, revision: 0,
    update: sync.encode(Y.encodeStateAsUpdate(seed.doc)), self: {}, present: [] };
  const session = await sync.BoardSession.join({ clock, ticket: async () => "ticket", open: async () => {
    const wire = { sent: [], closes: [], send(text) { this.sent.push(text); }, close(code) { this.closes.push(code); },
      listen(handlers) { this.handlers = handlers; this.message(joined); }, message(value) { this.handlers.message(JSON.stringify(value)); } };
    wires.push(wire); return wire;
  } });
  session.subscribe((event) => events.push(event));
  return { session, wires, events, joined, done() { wires.at(-1).message({ kind: "comments_snapshot", done: true }); },
    async rejoin(patch = {}) { Object.assign(joined, patch); await session.reconnect(); return wires.at(-1); },
    advance(ms) { now += ms; for (const timer of [...timers]) if (timer.at <= now) { timers.delete(timer); timer.run(); } },
    finish() { session.close(); seed.destroy(); } };
}
const start = (text = "hello") => ({ action: "start", threadId: randomUUID(), commentId: randomUUID(), anchor: { objectId: null, u: 0, v: 0, x: 0, y: 0 }, text });
test("the client requires snapshot done, including retry reset, and refuses empty and long text without sending", async () => {
  await import("../packages/board-sync/src/comments.ts");
  const sync = await import("../packages/board-sync/src/session.ts"), f = await clientFixture(sync);
  try {
    assert.equal(f.session.comment(start()), "join_required"); f.done();
    assert.equal(f.session.comment(start(" \t\n")), "empty_text"); assert.equal(f.session.comment(start("😀".repeat(4001))), "too_long");
    assert.equal(f.wires[0].sent.length, 0);
    const id = f.session.comment(start("a\rb\ud800")); assert(f.session.commentRequests.has(id));
    assert.equal(JSON.parse(f.wires[0].sent[0]).operation.text, "a\nb�");
    f.wires[0].message({ kind: "comments_snapshot", reset: true, sequence: 1 });
    assert.equal(f.session.comment(start()), "join_required");
    f.done(); assert(f.session.commentRequests.has(f.session.comment(start())));
  } finally { f.finish(); }
});
test("comment frames build ordered threads, replace records, delete comments and threads, and reset on joined", async () => {
  const { anchorAt } = await import("../packages/board-sync/src/comments.ts");
  const sync = await import("../packages/board-sync/src/session.ts"), f = await clientFixture(sync);
  try {
    const wire = f.wires[0], thread = { id: "t", sequence: 1, anchor: anchorAt(f.session.board, { x: 0, y: 0 }), resolved: false };
    wire.message({ kind: "comment_changed", threadId: "t", thread });
    for (const sequence of [3, 1, 2]) wire.message({ kind: "comment_changed", threadId: "t", commentId: String(sequence), comment: { id: String(sequence), sequence } });
    assert.deepEqual(f.session.threads.get("t").comments.map((comment) => comment.sequence), [1, 2, 3]);
    wire.message({ kind: "comment_changed", sequence: 4, by: "ben", threadId: "t", thread: { ...thread, resolved: true } });
    assert.equal(f.session.threads.get("t").comments.length, 3); assert.equal(f.session.threads.get("t").resolved, true);
    wire.message({ kind: "comment_changed", threadId: "t", commentId: "2", comment: null });
    assert.deepEqual(f.session.threads.get("t").comments.map((comment) => comment.id), ["1", "3"]);
    wire.message({ kind: "comment_changed", threadId: "t", thread: null }); assert.equal(f.session.threads.size, 0);
    wire.message({ kind: "comment_changed", threadId: "t", thread });
    wire.message({ kind: "comments_snapshot", reset: true, sequence: 0 }); assert.equal(f.session.threads.size, 0); assert.equal(f.session.commentsReady, false);
    wire.message({ kind: "comment_changed", threadId: "t", thread }); f.done(); await f.rejoin();
    assert.equal(f.session.threads.size, 0); assert.equal(f.session.commentsReady, false);
    assert.equal(f.events.filter((event) => event.kind === "comment_changed").length, 9);
  } finally { f.finish(); }
});
for (const final of ["saved", "refused"]) test(`a ${final} comment stays final and refusals never rejoin or alter edits`, async () => {
  await import("../packages/board-sync/src/comments.ts");
  const sync = await import("../packages/board-sync/src/session.ts"), f = await clientFixture(sync);
  try {
    f.done(); const edit = f.session.edit({ ...f.session.board, title: "Waiting" });
    const id = f.session.comment(start()), wire = f.wires[0];
    wire.message({ kind: "comment_" + final, requestId: id, sequence: 1, reason: "thread_deleted" });
    const before = structuredClone(f.session.commentRequests.get(id));
    wire.message({ kind: final === "saved" ? "comment_refused" : "comment_saved", requestId: id, sequence: 99, reason: "not_author" });
    assert.deepEqual(f.session.commentRequests.get(id), before); assert.equal(f.session.requests.get(edit).state, "sent");
    assert.equal(f.wires.length, 1); f.session.interrupt(); assert.equal(f.session.commentRequests.get(id).state, final);
  } finally { f.finish(); }
});
test("an attempt end makes sent comments unconfirmed; retry sends the identical serialized text only on request", async () => {
  await import("../packages/board-sync/src/comments.ts");
  const sync = await import("../packages/board-sync/src/session.ts"), f = await clientFixture(sync);
  try {
    f.done(); const operation = start(), id = f.session.comment(operation), text = f.wires[0].sent[0];
    operation.text = "mutated"; operation.anchor.x = 999;
    f.session.interrupt(); assert.equal(f.session.commentRequests.get(id).state, "unconfirmed");
    const wire = await f.rejoin(); f.done(); assert.equal(wire.sent.length, 0);
    assert.equal(f.session.retryComment(id), id); assert.deepEqual(wire.sent, [text]);
    assert.equal(f.session.commentRequests.get(id).state, "sent");
    f.session.close(); assert.equal(f.session.commentRequests.get(id).state, "unconfirmed"); assert.equal(wire.sent.length, 1);
  } finally { f.finish(); }
});
for (const patch of [{ epoch: 3 }, { restoreGeneration: 1 }, { epoch: 3, restoreGeneration: 1 }]) {
  test(`retry precedence covers join, retryability and access fences ${JSON.stringify(patch)}`, async () => {
    await import("../packages/board-sync/src/comments.ts");
    const sync = await import("../packages/board-sync/src/session.ts"), f = await clientFixture(sync);
    try {
      f.done(); const id = f.session.comment(start()), final = f.session.comment(start());
      f.wires[0].message({ kind: "comment_saved", requestId: final, sequence: 2 });
      f.session.interrupt();
      for (const request of [id, final, "missing"]) assert.equal(f.session.retryComment(request), "join_required");
      const wire = await f.rejoin(patch);
      for (const request of [id, final, "missing"]) assert.equal(f.session.retryComment(request), "join_required");
      f.done();
      assert.equal(f.session.retryComment("missing"), "not_retryable"); assert.equal(f.session.retryComment(final), "not_retryable");
      assert.equal(f.session.retryComment(id), "access_changed"); assert.equal(wire.sent.length, 0);
    } finally { f.finish(); }
  });
}
test("comments do not wait for edit recovery and never resend on rejoin or recovered", async () => {
  await import("../packages/board-sync/src/comments.ts");
  const sync = await import("../packages/board-sync/src/session.ts"), f = await clientFixture(sync);
  try {
    f.done(); const edit = f.session.edit({ ...f.session.board, title: "waiting" }), old = f.session.comment(start());
    f.session.interrupt(); const wire = await f.rejoin(); f.done();
    assert.equal(f.session.recovering, true); const next = f.session.comment(start()); assert(f.session.commentRequests.has(next));
    wire.message({ kind: "saved", requestId: edit, revision: 1 });
    assert.equal(f.session.recovering, false);
    assert.equal(wire.sent.filter((text) => JSON.parse(text).kind === "comment").length, 1);
    assert.equal(f.session.commentRequests.get(old).state, "unconfirmed");
  } finally { f.finish(); }
});
test("the comment deadline ends the attempt at ten seconds and ignores late answers", async () => {
  await import("../packages/board-sync/src/comments.ts");
  const sync = await import("../packages/board-sync/src/session.ts"), f = await clientFixture(sync);
  try {
    f.done(); const id = f.session.comment(start()), wire = f.wires[0];
    f.advance(9999); assert.equal(f.session.commentRequests.get(id).state, "sent");
    f.advance(1); assert.equal(f.session.commentRequests.get(id).state, "unconfirmed");
    assert.deepEqual(wire.closes, [1000]); assert.deepEqual(f.events.at(-1), { kind: "close", code: 4000, reason: "answer_deadline" });
    wire.message({ kind: "comment_saved", requestId: id, sequence: 1 }); assert.equal(f.session.commentRequests.get(id).state, "unconfirmed");
  } finally { f.finish(); }
});
for (const layout of ["created", "uncreated"]) test(`current storage initialization is idempotent: ${layout}`, async () => {
  await import("../packages/board-sync/src/comments.ts");
  const { initialize, meta, setMeta } = await import("../packages/board-room/src/storage.ts");
  const { NodeStorage } = await import("../apps/server/src/node-storage.ts");
  const storage = new NodeStorage(":memory:");
  try {
    initialize(storage);
    if (layout === "created") setMeta(storage, "storage_version", 5);
    storage.exec("INSERT INTO receipts VALUES ('p', 'r', 'digest', 4, 'edit')");
    assert.equal(meta(storage, "storage_version"), layout === "uncreated" ? 0 : 5);
    assert.equal(storage.all("SELECT * FROM receipts")[0].kind, "edit");
    for (const table of ["threads", "comments", "comment_ids", "comment_counts", "mention_targets", "mention_pending"]) assert.deepEqual(storage.all(`SELECT * FROM ${table}`), []);
    const before = storage.all("SELECT * FROM sqlite_master ORDER BY name"); initialize(storage);
    assert.deepEqual(storage.all("SELECT * FROM sqlite_master ORDER BY name"), before);
    assert.equal(storage.all("SELECT * FROM receipts").length, 1);
  } finally { storage.close(); }
});
test("a fresh room creates storage version 5 with no threads", async () => {
  await import("../packages/board-sync/src/comments.ts");
  const { Room } = await import("../packages/board-room/src/room.ts"), { NodeStorage } = await import("../apps/server/src/node-storage.ts");
  const { meta } = await import("../packages/board-room/src/storage.ts");
  const storage = new NodeStorage(":memory:");
  try {
    const room = new Room(randomUUID(), { storage, hash: async value => { const { createHash } = await import("node:crypto"); return createHash("sha256").update(value).digest("hex"); }, randomId: randomUUID, now: () => 0, connections: () => [], schedule: async () => {},
      access: { board: async () => ({ title: "Comments", createdAt: new Date(0).toISOString() }), changes: async () => ({ latest: 0, lowestKept: 1, changes: [] }) }, fence: async () => 0 });
    await room.load(); assert.equal(meta(storage, "storage_version"), 5); assert.deepEqual(storage.all("SELECT * FROM threads"), []);
  } finally { storage.close(); }
});

async function roomFixture() {
  const { createHash } = await import("node:crypto");
  const { Room } = await import("../packages/board-room/src/room.ts");
  const { NodeStorage } = await import("../apps/server/src/node-storage.ts");
  const storage = new NodeStorage(":memory:"), peers = [], boardId = randomUUID(); let now = 1000000;
  const env = { storage, now: () => now, access: {
    board: async () => ({ id: boardId, title: "Launch", createdAt: new Date(0).toISOString() }),
    role: async (person) => person === "viewer" ? "viewer" : "owner",
    changes: async () => ({ latest: 0, lowestKept: 1, changes: [] }),
  }, hash: async (value) => createHash("sha256").update(value).digest("hex"), randomId: randomUUID,
    randomTicket: randomUUID, connections: () => peers, schedule: async () => {}, fence: async () => 0,
    raiseFence: async () => 1, backupLimit: 16777216 };
  const room = new Room(boardId, env);
  async function open(id) {
    const ticket = await room.ticket({ id, email: id + "@example.test", expiresAt: Number.MAX_SAFE_INTEGER });
    let attachment = await room.join(ticket.ticket); const messages = [];
    const peer = { messages, attachment: () => attachment, attach: (next) => { attachment = next; },
      send: (text) => messages.push(JSON.parse(text)), close() {} };
    peers.push(peer); await room.connected(peer); return peer;
  }
  async function send(peer, operation, requestId = randomUUID()) {
    await room.message(peer, JSON.stringify({ kind: "comment", requestId, epoch: peer.attachment().epoch, restoreGeneration: 0, operation }));
    return peer.messages.at(-1);
  }
  return { storage, room, open, send, advance(ms = 1001) { now += ms; } };
}
test("room actions stamp private-safe rows, enforce authorship, share receipts and restore exact envelope shapes", async () => {
  await import("../packages/board-sync/src/comments.ts");
  const { decodeBackup } = await import("../packages/board-room/src/backups.ts");
  const f = await roomFixture();
  try {
    const a = await f.open("author"), b = await f.open("viewer"), operation = start(), id = randomUUID();
    assert.equal((await f.send(a, operation, id)).kind, "comment_saved");
    const frame = a.messages.at(-2); assert.equal(frame.kind, "comment_changed"); assert.equal(frame.by, "author");
    assert(!JSON.stringify(frame).includes("author_id"));
    assert.equal((await f.send(b, { action: "edit", threadId: operation.threadId, commentId: operation.commentId, text: "Forbidden" })).reason, "not_author");
    const reply = { action: "reply", threadId: operation.threadId, commentId: randomUUID(), text: "Viewer reply" };
    await f.send(b, { action: "resolve", threadId: operation.threadId }); await f.send(b, reply);
    assert.equal(f.storage.all("SELECT resolved FROM threads")[0].resolved, 0);
    assert.equal(f.storage.all("SELECT * FROM receipts").length, 3);
    await f.send(a, operation, id); assert.equal(a.messages.at(-1).done, true);
    assert.equal(f.storage.all("SELECT * FROM receipts").length, 3);
    assert.equal((await f.send(a, { ...operation, text: "Changed" }, id)).reason, "request_id_reused");
    const envelope = await f.room.backup(); assert.equal(envelope.tables.receipts[0].kind, "comment");
    const missing = structuredClone(envelope); delete missing.tables.comment_ids;
    assert.throws(() => decodeBackup(missing, f.room.boardId), /bad_request/);
    const malformed = structuredClone(envelope); malformed.tables.comments[0].mentions = 'null';
    assert.throws(() => decodeBackup(malformed, f.room.boardId), /bad_request/);
    assert.doesNotThrow(() => decodeBackup(envelope, f.room.boardId));
    await f.send(a, { action: "delete_comment", threadId: operation.threadId, commentId: operation.commentId });
    assert.equal(f.storage.all("SELECT * FROM comments").length, 0); assert.equal(f.storage.all("SELECT * FROM comment_ids").length, 3);
    assert.equal((await f.send(a, operation)).reason, "identifier_reused");
    assert.equal((await f.send(b, reply)).reason, "thread_deleted");
    assert.equal(f.storage.all("SELECT * FROM edits").length, 0);
    assert.equal(f.storage.all("SELECT value FROM meta WHERE key = 'revision'")[0].value, 0);
  } finally { f.storage.close(); }
});
test("a failed current initialization rolls back its tables", async () => {
  await import("../packages/board-sync/src/comments.ts");
  const { initialize } = await import("../packages/board-room/src/storage.ts");
  const { NodeStorage } = await import("../apps/server/src/node-storage.ts");
  const storage = new NodeStorage(":memory:");
  try {
    const execute = storage.exec.bind(storage);
    storage.exec = (sql, ...args) => { if (sql.includes("CREATE TABLE IF NOT EXISTS comment_ids")) throw Error("Injected initialization failure"); execute(sql, ...args); };
    assert.throws(() => initialize(storage), /Injected initialization failure/);
    assert.deepEqual(storage.all("SELECT name FROM sqlite_master WHERE type = 'table'"), []);
  } finally { storage.close(); }
});
