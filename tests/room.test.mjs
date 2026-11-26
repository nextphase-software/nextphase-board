// SPDX-License-Identifier: Apache-2.0
import test from "node:test";
import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { setTimeout as delay } from "node:timers/promises";
import * as Y from "yjs";
import { Room } from "../packages/board-room/src/room.ts";
import { NodeStorage } from "../apps/server/src/node-storage.ts";
import { startNode } from "../apps/server/src/start-node.ts";
import { COPY_INTERVAL } from "../packages/board-room/src/copies.ts";
import { HISTORY_AGE } from "../packages/board-sync/src/history.ts";
import { meta, setMeta } from "../packages/board-room/src/storage.ts";
const NODE_TIMER_LIMIT = 2 ** 31 - 1;
function fixture() {
  const storage = new NodeStorage(":memory:"), board = crypto.randomUUID(), person = crypto.randomUUID();
  let now = Date.now(), fence = 0, offline = false;
  const connections = [], messages = [];
  const environment = { storage, lifecycle: { lifecycle: async () => ({ state: "active", generation: 0 }) }, access: {
    async board() { return { id: board, title: "Room", workspaceId: crypto.randomUUID(), createdAt: new Date(now).toISOString() }; },
    async role() { return "editor"; },
    async changes() { if (offline) throw Error(); return { changes: [], latest: 0, lowestKept: 1 }; },
  }, now: () => now, fence: async () => fence, raiseFence: async () => ++fence,
    hash: async (bytes) => createHash("sha256").update(bytes).digest("hex"),
    randomTicket: () => randomBytes(32).toString("base64url"), randomId: () => crypto.randomUUID(),
    async verify() { return { id: person, email: "unit@example.test", expiresAt: now + 3600000 }; },
    connections: () => connections, async schedule() {}, backupLimit: 16777216 };
  const room = new Room(board, environment);
  async function open() {
    const ticket = await room.ticket({ id: person, email: "unit@example.test", expiresAt: now + 3600000 });
    let attachment = await room.join(ticket.ticket);
    const connection = { attachment: () => attachment, attach: (v) => { attachment = v; },
      send: (v) => messages.push(JSON.parse(v)), close: () => { connections.splice(connections.indexOf(connection), 1); } };
    connections.push(connection); await room.connected(connection);
    return connection;
  }
  return { room, storage, messages, open, advance: (ms) => { now += ms; }, offline: (v) => { offline = v; } };
}
function edit(doc, title) {
  const vector = Y.encodeStateVector(doc);
  doc.getMap("board").set("title", title);
  return Buffer.from(Y.encodeStateAsUpdate(doc, vector)).toString("base64");
}
async function nodeRoomFixture(t, lifecycleDelay = 0) {
  const dataDir = await mkdtemp(join(tmpdir(), "board-room-node-"));
  t.after(() => rm(dataDir, { recursive: true, force: true }));
  const initialTime = Date.UTC(2026, 0, 1);
  let now = initialTime, copies = 0;
  const db = {
    async lifecycle() {
      if (lifecycleDelay) await delay(lifecycleDelay);
      return { state: "active", generation: 0 };
    },
    async board() { return { title: "Room", createdAt: new Date(initialTime).toISOString() }; },
    async role() { return "editor"; },
    async changes() { return { changes: [], latest: 0, lowestKept: 1 }; },
    async copy() { copies++; },
  };
  const app = await startNode({ dataDir, port: 0 }, { db, auth: {}, now: () => now, deliveryIntervalMs: 0 });
  const room = app.runtime.room(crypto.randomUUID()), entry = app.rooms.get(room.boardId);
  // Exercise the Node timer and drain with a room whose saves use in-memory SQLite.
  entry.storage.close();
  entry.storage.database = new DatabaseSync(":memory:");
  const person = { id: crypto.randomUUID(), email: "unit@example.test", expiresAt: initialTime + HISTORY_AGE + 3600000 };
  return {
    app, room, entry, copyCount: () => copies,
    advance(ms) { now += ms; },
    save(name) { return room.saveVersion(person, { name, description: "", requestId: crypto.randomUUID() }); },
    async drain() { while (entry.tasks.size) await Promise.allSettled([...entry.tasks]); },
  };
}
test("NB-120 Node shutdown drains a named save with a future room alarm", async (t) => {
  const { app, room, entry, save, drain, advance, copyCount } = await nodeRoomFixture(t, 8);
  // Accelerate the far-future alarm to exercise shutdown during an early wake.
  const setTimer = globalThis.setTimeout;
  t.mock.method(globalThis, "setTimeout", (callback, ms, ...args) =>
    setTimer(callback, ms >= NODE_TIMER_LIMIT ? 1 : ms, ...args));
  let closing;
  try {
    await save("Initial");
    await drain();
    assert.equal(copyCount(), 1);
    advance(HISTORY_AGE);
    await room.alarm();
    await drain();
    advance(-HISTORY_AGE);
    assert(meta(entry.storage, "history_next_at") - room.env.now() > NODE_TIMER_LIMIT);

    const busy = Promise.withResolvers();
    const alarm = room.alarm.bind(room);
    room.alarm = () => {
      if (entry.tasks.size) busy.resolve(true);
      return alarm();
    };
    await save("Retry");
    const deadline = AbortSignal.timeout(2000);
    const expired = new Promise(resolve => deadline.addEventListener("abort", () => resolve(false), { once: true }));
    assert.equal(await Promise.race([busy.promise, expired]), true, "expected an alarm with a room task still pending");
    assert(entry.tasks.size > 0);
    advance(COPY_INTERVAL);
    closing = app.close();
    const drained = await Promise.race([closing.then(() => true), expired]);
    assert.equal(copyCount(), 1);
    assert.equal(drained, true,
      "future room alarms kept the shutdown drain pending after a copy interval on the injected clock");
    assert.equal(entry.tasks.size, 0);
  } finally {
    room.env.schedule = async () => {};
    clearTimeout(entry.timer);
    await (closing ?? app.close());
    room.doc.destroy();
  }
});
test("NB-120 Node caps a 30-day room alarm and re-arms until due", async (t) => {
  const { app, room, entry, save, drain, advance, copyCount } = await nodeRoomFixture(t);
  const { storage } = entry;
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const setTimer = t.mock.method(globalThis, "setTimeout");
  const alarm = t.mock.method(room, "alarm");
  const armedDelay = () => setTimer.mock.calls.at(-1).arguments[1];
  const changedRows = () => storage.all("SELECT total_changes() AS count")[0].count;
  function tick(ms) {
    advance(ms);
    t.mock.timers.tick(ms);
  }
  try {
    await save("Initial");
    await drain();
    const deadline = room.env.now() + HISTORY_AGE;
    setMeta(storage, "history_next_at", deadline);
    await room.env.schedule(deadline);
    assert.equal(armedDelay(), NODE_TIMER_LIMIT, "the 30-day deadline must fit in a Node timer");

    tick(1000);
    assert.equal(alarm.mock.callCount(), 0);
    const before = changedRows();
    tick(NODE_TIMER_LIMIT - 1000);
    assert.equal(alarm.mock.callCount(), 1);
    await alarm.mock.calls[0].result;
    await drain();
    assert.equal(changedRows(), before);
    assert.equal(copyCount(), 1);
    assert.equal(meta(storage, "history_next_at"), deadline);
    assert.equal(armedDelay(), deadline - room.env.now());

    tick(deadline - room.env.now());
    assert.equal(alarm.mock.callCount(), 2);
    await alarm.mock.calls[1].result;
    await drain();
    assert(meta(storage, "history_next_at") > deadline);
    assert.equal(storage.all("SELECT id FROM versions").length, 0);
  } finally {
    await app.close();
    room.doc.destroy();
  }
});
test("room serializes concurrent messages, saves receipts atomically and snapshots after 100", async () => {
  const f = fixture(), connection = await f.open(), doc = new Y.Doc();
  Y.applyUpdate(doc, Buffer.from(f.messages[0].update, "base64"));
  const messages = Array.from({ length: 100 }, (_, i) => ({ kind: "edit", restoreGeneration: f.messages.find(message => message.kind === "joined").restoreGeneration, epoch: 0, requestId: "e" + i, update: edit(doc, "Edit " + i) }));
  await Promise.all(messages.map((m) => f.room.message(connection, JSON.stringify(m))));
  assert.deepEqual(f.messages.filter((m) => m.kind === "saved").map((m) => m.revision), Array.from({ length: 100 }, (_, i) => i + 1));
  await f.room.message(connection, JSON.stringify(messages[0]));
  assert.equal(meta(f.storage, "revision"), 100);
  assert.equal(f.messages.at(-1).revision, 1);
  assert.equal(f.storage.all("SELECT MAX(snapshot_revision) AS n FROM snapshot_chunks")[0].n, 100);
  doc.destroy(); f.storage.close();
});
test("waiting count and deadline use the injected clock and never create receipts", async () => {
  const f = fixture(), connection = await f.open(), doc = new Y.Doc();
  Y.applyUpdate(doc, Buffer.from(f.messages[0].update, "base64"));
  edit(doc, "Missing predecessor");
  const update = edit(doc, "Waiting");
  for (let i = 0; i < 65; i++) await f.room.message(connection, JSON.stringify({ kind: "edit", restoreGeneration: f.messages.find(message => message.kind === "joined").restoreGeneration, epoch: 0, requestId: "w" + i, update }));
  assert.equal(f.messages.at(-1).reason, "waiting_count");
  await f.room.message(connection, JSON.stringify({ kind: "edit", restoreGeneration: f.messages.find(message => message.kind === "joined").restoreGeneration, epoch: 0, requestId: "deadline", update }));
  f.advance(30001); await f.room.alarm();
  assert.equal(f.messages.at(-1).reason, "waiting_timeout");
  assert.equal(f.storage.all("SELECT * FROM receipts").length, 0);
  doc.destroy(); f.storage.close();
});
test("a restore answers locked and cannot export until access replay succeeds", async () => {
  const f = fixture(), connection = await f.open();
  const envelope = await f.room.backup(); f.offline(true);
  assert.equal((await f.room.restore(envelope)).locked, true);
  await assert.rejects(f.room.export(connection.attachment()), /room_locked/);
  f.offline(false);
  assert.equal(JSON.parse(await f.room.export(connection.attachment())).title, "Room");
  f.storage.close();
});

test("a lookup overtaken by a committed role change discards its older result", async () => {
  const f = fixture(), source = f.room.env.access;
  let latest = 0, role = "viewer", release, started;
  const entered = new Promise((resolve) => { started = resolve; });
  source.changes = async (_board, after) => ({ latest, lowestKept: 1,
    changes: latest > after ? [{ number: latest, personId: "joining-person" }] : [] });
  let first = true;
  source.role = async () => {
    if (first) { first = false; started(); return new Promise((resolve) => { release = resolve; }); }
    return role;
  };
  const lookup = f.room.access.lookup("joining-person", "synthetic-board");
  await entered; role = "editor"; latest = 1; release("viewer");
  assert.equal((await lookup).role, "editor");
  f.storage.close();
});

for (const [version, maximum] of [[10, false], [11, false], [12, false], [12, true]]) {
  test(`stored version ${version}${maximum ? " maximum payload" : ""} upgrades without edits, receipts, revision or history changes`, async () => {
    const { canonical, payloadBytes, upgrade } = await import("../packages/board-rules/src/document.ts");
    const { richBoard, sizedBoard, storedBoardUpdate, withoutPages } = await import("./import-fixture.mjs");
    const { readBoard } = await import("../packages/board-sync/src/codec.ts");
    const { setMeta } = await import("../packages/board-room/src/storage.ts");
    const f = fixture(), doc = new Y.Doc();
    try {
      const connection = await f.open();
      Y.applyUpdate(doc, Buffer.from(f.messages[0].update, "base64"));
      await f.room.message(connection, JSON.stringify({ kind: "edit", epoch: 0, requestId: "before-upgrade",
        restoreGeneration: f.messages.find(message => message.kind === "joined").restoreGeneration, update: edit(doc, "Before upgrade") }));
      assert.equal(meta(f.storage, "revision"), 1);
      const board = { ...withoutPages(maximum ? sizedBoard(2097152, 12) : richBoard()), schemaVersion: version, boardId: f.room.boardId };
      const json = new TextEncoder().encode(canonical(board)), yjs = storedBoardUpdate(board);
      f.storage.transaction(() => {
        f.storage.exec("DELETE FROM snapshot_chunks"); f.storage.exec("DELETE FROM edits");
        for (const [kind, bytes] of [["json", json], ["yjs", yjs]]) {
          for (let at = 0, index = 0; at < bytes.length; at += 1048576, index++) {
            f.storage.exec("INSERT INTO snapshot_chunks VALUES (?, ?, ?, ?)", 1, kind, index, bytes.slice(at, at + 1048576));
          }
        }
        for (const object of board.objects) f.storage.exec("INSERT INTO identifiers VALUES (?, ?, 0)", object.id, object.generation);
        setMeta(f.storage, "history_capture_sha256", createHash("sha256").update(json).digest("hex"));
        setMeta(f.storage, "history_capture_bytes", json.length);
      });
      const unchanged = () => ({ revision: meta(f.storage, "revision"), generation: meta(f.storage, "restore_generation"),
        receipts: f.storage.all("SELECT * FROM receipts"), versions: f.storage.all("SELECT * FROM versions"),
        versionChunks: f.storage.all("SELECT * FROM version_chunks"), identifiers: f.storage.all("SELECT * FROM identifiers") });
      const before = unchanged(); assert.equal(before.receipts.length, 1);
      for (let wake = 0; wake < 2; wake++) {
        f.room.initialized = false;
        const served = JSON.parse(await f.room.export(connection.attachment()));
        assert.deepEqual(served, JSON.parse(canonical(upgrade(board))));
        assert.deepEqual(served.pages, [{ id: board.boardId, name: "Page 1" }]);
        assert(served.objects.every(object => object.page === board.boardId));
        assert.equal(readBoard(f.room.doc).schemaVersion, 17);
        assert.deepEqual(f.storage.all("SELECT * FROM edits"), []); assert.deepEqual(unchanged(), before);
        if (maximum) assert.equal(payloadBytes(canonical(served)), 2097152);
      }
    } finally { doc.destroy(); f.room.doc.destroy(); f.storage.close(); }
  });
}

test("the exact 2 MiB text fixture saves on the hosted default page and refuses a one-byte rename", async () => {
  const { canonical, payloadBytes } = await import("../packages/board-rules/src/document.ts");
  const { largeTextBoard } = await import("./import-fixture.mjs");
  const { Adapter } = await import("../packages/board-sync/src/document-adapter.ts");
  const f = fixture(), adapter = new Adapter();
  try {
    const connection = await f.open(), board = largeTextBoard(f.room.boardId);
    Y.applyUpdate(adapter.doc, Buffer.from(f.messages[0].update, "base64"));
    assert.deepEqual(board.pages, [{ id: f.room.boardId, name: "Page 1" }]);
    assert(board.objects.every(object => object.page === f.room.boardId));
    assert.equal(payloadBytes(canonical(board)), 2097152);
    assert(Buffer.byteLength(canonical(board)) > 2097152);
    for (let count = 5; count <= 250; count += 5) {
      const vector = Y.encodeStateVector(adapter.doc);
      adapter.set({ ...board, objects: board.objects.slice(0, count) });
      const update = Buffer.from(Y.encodeStateAsUpdate(adapter.doc, vector)).toString("base64");
      assert(Buffer.byteLength(update) < 1048000);
      await f.room.message(connection, JSON.stringify({ kind: "edit", epoch: 0, requestId: "large-" + count,
        restoreGeneration: f.messages.find(message => message.kind === "joined").restoreGeneration, update }));
      assert.equal(f.messages.at(-1).kind, "saved");
    }
    assert.equal(meta(f.storage, "revision"), 50);
    f.advance(60001); await f.room.alarm();
    const chunks = f.storage.all("SELECT * FROM snapshot_chunks WHERE snapshot_revision = 50");
    assert.equal(chunks.filter(row => row.kind === "json").length, Math.ceil(Buffer.byteLength(canonical(board)) / 1048576));
    assert(chunks.filter(row => row.kind === "yjs").length >= 2);
    f.room.initialized = false;
    assert.equal(await f.room.export(connection.attachment()), canonical(board));
    const receipts = f.storage.all("SELECT * FROM receipts");
    await assert.rejects(f.room.rename(connection.attachment(), "Large!"), error => error.status === 413 && error.message === "document_too_large");
    assert.equal(meta(f.storage, "revision"), 50); assert.deepEqual(f.storage.all("SELECT * FROM receipts"), receipts);
    assert.equal(await f.room.export(connection.attachment()), canonical(board));
  } finally { adapter.destroy(); f.room.doc.destroy(); f.storage.close(); }
});
