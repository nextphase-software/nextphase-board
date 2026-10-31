// SPDX-License-Identifier: Apache-2.0
import test from "node:test";
import assert from "node:assert/strict";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import * as Y from "yjs";
import { deliver, removal } from "../apps/server/src/delivery.ts";
import { closeCode } from "../packages/board-room/src/access.ts";
import { Room } from "../packages/board-room/src/room.ts";
import { NodeStorage } from "../apps/server/src/node-storage.ts";
import { meta } from "../packages/board-room/src/storage.ts";

function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

test("delivery limits active rooms to ten and acknowledges only stored watermarks", async () => {
  const boards = Array.from({ length: 25 }, (_, i) => String(i));
  const gates = boards.map(deferred), started = [], receipts = [];
  let active = 0, maximum = 0;
  const runtime = {
    db: { async rpc(name, parameters) {
      if (name === "pending_access_boards") return boards;
      receipts.push(parameters);
    } },
    room(board) { return { async changed() {
      started.push(board); active++; maximum = Math.max(maximum, active);
      try {
        await gates[Number(board)].promise;
        if (board === "3") throw Error("Room unavailable");
        return board === "4" ? undefined : 80;
      } finally { active--; }
    } }; },
  };
  const delivery = deliver(runtime);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(started.length, 10);
  for (const gate of gates) gate.resolve();
  await delivery;
  assert.equal(maximum, 10);
  assert.equal(receipts.length, 23);
  assert(!receipts.some((row) => ["3", "4"].includes(row.board)));
  assert(receipts.every((row) => row.through === 80));
});

test("a second delivery waits for the first attempt including its receipts", async () => {
  const gate = deferred(), entered = deferred();
  let reads = 0;
  const runtime = { db: { async rpc(name) {
    if (name === "pending_access_boards") { reads++; return ["board"]; }
    entered.resolve(); await gate.promise;
  } }, room: () => ({ changed: async () => 7 }) };
  const first = deliver(runtime);
  await entered.promise;
  const second = deliver(runtime);
  await Promise.resolve();
  assert.equal(reads, 1);
  gate.resolve(); await Promise.all([first, second]);
  assert.equal(reads, 2);
});

test("removal is scoped and pending on any outstanding change or read failure", async () => {
  let pending = [{ changeNumber: 1, boardId: "a" }, { changeNumber: 2, boardId: "b" }];
  const runtime = { db: { async rpc(name, parameters) {
    assert.equal(name, "pending_deliveries");
    assert.deepEqual(parameters, { person: "person", workspace: "workspace", board: null });
    return pending;
  } } };
  assert.equal(await removal(runtime, "person", "workspace"), "pending");
  pending.shift(); assert.equal(await removal(runtime, "person", "workspace"), "pending");
  pending.shift(); assert.equal(await removal(runtime, "person", "workspace"), "done");
  runtime.db.rpc = async () => { throw Error("Unavailable"); };
  assert.equal(await removal(runtime, "person", "workspace"), "pending");
});

test("connection close choice distinguishes raises from lower or missing access", () => {
  assert.equal(closeCode("editor", "viewer"), 4409);
  for (const [current, joined] of [["viewer", "editor"], [null, "viewer"], ["editor", "editor"]]) {
    assert.equal(closeCode(current, joined), 4403);
  }
});

async function fixture() {
  const storage = new NodeStorage(":memory:"), board = randomUUID(), person = randomUUID();
  let role = "editor", latest = 0;
  const connections = [], messages = [], closes = [];
  const environment = { storage, now: Date.now, async fence() { return 0; }, async raiseFence() { return 1; },
    access: {
      async board() { return { id: board, workspaceId: randomUUID(), title: "Removal", createdAt: new Date().toISOString() }; },
      async role() { return role; },
      async changes(_board, after) { return { lowestKept: 1, latest,
        changes: latest > after ? [{ number: latest, personId: person }] : [] }; },
    },
    hash: async (bytes) => createHash("sha256").update(bytes).digest("hex"),
    randomTicket: () => randomBytes(32).toString("base64url"), randomId: randomUUID,
    async verify() { return { id: person, email: "unit@example.test", expiresAt: Date.now() + 3600000 }; },
    connections: () => connections, async schedule() {}, backupLimit: 16777216 };
  const room = new Room(board, environment);
  const ticket = await room.ticket(await environment.verify());
  const attachment = await room.join(ticket.ticket);
  // Retain the connection after close to model a process stopping after commit.
  const connection = { attachment: () => attachment, attach() {},
    send: (value) => messages.push(JSON.parse(value)), close: (code) => closes.push(code) };
  connections.push(connection); await room.connected(connection);
  const doc = new Y.Doc(); Y.applyUpdate(doc, Buffer.from(messages[0].update, "base64"));
  doc.getMap("board").set("title", "Missing predecessor");
  const vector = Y.encodeStateVector(doc);
  doc.getMap("board").set("title", "Must never save");
  await room.message(connection, JSON.stringify({ kind: "edit", epoch: attachment.epoch,
    requestId: "waiting", update: Buffer.from(Y.encodeStateAsUpdate(doc, vector)).toString("base64") }));
  assert.equal(messages.at(-1).kind, "received");
  doc.destroy();
  return { storage, room, closes, person, connection, messages, lower: (value) => { role = value; latest++; } };
}

test("lowered access and deletion of its waiting edits commit together before closing", async () => {
  const f = await fixture();
  try {
    const transaction = f.storage.transaction.bind(f.storage), observations = [];
    const execute = f.storage.exec.bind(f.storage), writes = [];
    let inTransaction = false;
    f.storage.exec = (sql, ...parameters) => {
      if (/INSERT INTO grants|DELETE FROM waiting/.test(sql)) {
        assert(inTransaction, "access and waiting changes must be inside a storage transaction");
        writes.push(sql);
      }
      execute(sql, ...parameters);
    };
    f.storage.transaction = (operation) => transaction(() => {
      inTransaction = true;
      try {
        const result = operation();
        observations.push({ role: f.room.access.get(f.person)?.role, waiting: f.storage.all("SELECT * FROM waiting").length,
          epoch: f.room.access.get(f.person)?.epoch, closes: f.closes.length });
        return result;
      } finally { inTransaction = false; }
    });
    f.lower("viewer"); await f.room.changed();
    assert(writes.some((sql) => sql.startsWith("INSERT INTO grants")));
    assert(writes.some((sql) => sql.startsWith("DELETE FROM waiting")));
    assert(observations.some((row) => row.role === "viewer" && row.epoch === 1 && row.waiting === 0 && row.closes === 0));
    assert.deepEqual(f.closes, [4403]);
    assert.equal(f.storage.all("SELECT * FROM receipts").length, 0);
    await f.room.message(f.connection, JSON.stringify({ kind: "edit", epoch: 0, requestId: "stale", update: "" }));
    assert.equal(f.messages.at(-1).reason, "epoch_changed");
  } finally { f.storage.close(); }
});

test("a replay with no new change closes a connection left open after the room step", async () => {
  const f = await fixture();
  try {
    f.lower("viewer"); await f.room.changed();
    const grant = f.room.access.get(f.person), watermark = meta(f.storage, "watermark");
    f.closes.length = 0;
    await f.room.changed();
    assert.deepEqual(f.closes, [4403]);
    assert.deepEqual(f.room.access.get(f.person), grant);
    assert.equal(meta(f.storage, "watermark"), watermark);
  } finally { f.storage.close(); }
});

test("delivery refuses an outage and does not initialize an unopened room", async () => {
  const f = await fixture();
  try {
    f.room.env.access.changes = async () => { throw Error("Supabase unavailable"); };
    await assert.rejects(f.room.changed(), /Supabase unavailable/);
    assert.equal(meta(f.storage, "watermark"), 0);
  } finally { f.storage.close(); }
  const storage = new NodeStorage(":memory:");
  try {
    const room = new Room("unopened", { storage, access: { async changes() { return { latest: 42 }; } }, connections: () => [] });
    assert.equal(await room.changed(), 42);
    assert.deepEqual(storage.all("SELECT * FROM meta"), []);
  } finally { storage.close(); }
});
