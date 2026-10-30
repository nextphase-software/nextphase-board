// SPDX-License-Identifier: Apache-2.0
import test from "node:test";
import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import * as Y from "yjs";
import { Room } from "../packages/board-room/src/room.ts";
import { NodeStorage } from "../apps/server/src/node-storage.ts";
import { meta } from "../packages/board-room/src/storage.ts";
function fixture() {
  const storage = new NodeStorage(":memory:"), board = crypto.randomUUID(), person = crypto.randomUUID();
  let now = Date.now(), fence = 0, offline = false;
  const connections = [], messages = [];
  const environment = { storage, access: {
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
test("room serializes concurrent messages, saves receipts atomically and snapshots after 100", async () => {
  const f = fixture(), connection = await f.open(), doc = new Y.Doc();
  Y.applyUpdate(doc, Buffer.from(f.messages[0].update, "base64"));
  const messages = Array.from({ length: 100 }, (_, i) => ({ kind: "edit", epoch: 0, requestId: "e" + i, update: edit(doc, "Edit " + i) }));
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
  for (let i = 0; i < 65; i++) await f.room.message(connection, JSON.stringify({ kind: "edit", epoch: 0, requestId: "w" + i, update }));
  assert.equal(f.messages.at(-1).reason, "waiting_count");
  await f.room.message(connection, JSON.stringify({ kind: "edit", epoch: 0, requestId: "deadline", update }));
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
