// SPDX-License-Identifier: Apache-2.0
import test from "node:test";
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { Room } from "../packages/board-room/src/room.ts";
import { colours } from "../packages/board-room/src/presence.ts";
import { checkPresence } from "../packages/board-sync/src/session.ts";
import { labelOf } from "../packages/board-room/src/tickets.ts";
import { initialize, meta, setMeta } from "../packages/board-room/src/storage.ts";
import { NodeStorage } from "../apps/server/src/node-storage.ts";
const input = () => ({ cursor: null, selection: [], view: { x: 0, y: 0, width: 1, height: 1 }, active: false });
const bytes = (value) => new TextEncoder().encode(value).length;
const sha = (value) => createHash("sha256").update(value).digest("hex");
function fixture() {
  const storage = new NodeStorage(":memory:"), board = "11111111-1111-4111-8111-111111111111";
  const person = "22222222-2222-4222-8222-222222222222";
  let now = 1000000, fence = 0, role = "editor", latest = 0;
  const peers = [], events = [];
  const env = { storage, now: () => now, access: {
    async board() { return { id: board, title: "Presence", createdAt: new Date(now).toISOString() }; },
    async role() { return role; },
    async changes(_board, after) { return { latest, lowestKept: 1, changes: latest > after ? [{ personId: person, number: latest }] : [] }; },
  }, fence: async () => fence, raiseFence: async () => ++fence, hash: async (value) => sha(value),
    randomId: randomUUID, randomTicket: randomUUID, verify: async (token) => ({ id: token === "other" ? randomUUID() : person,
      email: "not-retained@example.test", expiresAt: Number.MAX_SAFE_INTEGER }),
    connections: () => [...peers], schedule: async () => {}, backupLimit: 16777216 };
  const room = new Room(board, env);
  async function reserve(label = "unit") {
    const ticket = await room.ticket({ id: person, email: label + "@example.test", expiresAt: Number.MAX_SAFE_INTEGER });
    return room.join(ticket.ticket);
  }
  async function open(attachment = undefined) {
    attachment ??= await reserve();
    const messages = [];
    const peer = { attachment: () => attachment, attach: (value) => { attachment = value; },
      send: (text) => { const value = JSON.parse(text); messages.push(value); events.push({ kind: "send", peer, value }); },
      close: (code) => { events.push({ kind: "close", peer, code }); const at = peers.indexOf(peer); if (at >= 0) peers.splice(at, 1); } };
    peer.messages = messages; peers.push(peer); await room.connected(peer); return peer;
  }
  const send = (peer, value, padding = 0) => room.message(peer, JSON.stringify({ kind: "presence", ...value }) + " ".repeat(padding));
  return { room, env, board, person, storage, peers, events, open, reserve, send,
    advance: (ms) => { now += ms; }, change: (next) => { role = next; latest++; } };
}

test("presence checks byte, field, selection and shape precedence", () => {
  const valid = { kind: "presence", ...input() };
  assert.equal(checkPresence({ ...valid, update: "x", selection: Array(251).fill("bad") }, 1048577, true), "message_too_large");
  assert.equal(checkPresence({ ...valid, update: "x" }, 12289, true), "presence_too_large");
  assert.equal(checkPresence({ ...valid, update: "x", selection: Array(251).fill("bad") }, 100, true), "presence_fields");
  assert.equal(checkPresence({ ...valid, selection: Array(251).fill("bad"), active: "bad" }, 100, true), "presence_selection_limit");
  assert.equal(checkPresence({ ...valid, active: "bad" }, 100, true), "bad_presence");
  assert.deepEqual(checkPresence(valid, 12288, true), input());
  const id = randomUUID(), other = randomUUID();
  assert.deepEqual(checkPresence({ ...valid, selection: [id, other, id] }, 100, true).selection, [id, other]);
  assert.equal(checkPresence({ ...valid, selection: Array(250).fill(id) }, 100, true).selection.length, 1);
  for (const patch of [{ cursor: { x: Infinity, y: 0 } }, { cursor: { x: 1000001, y: 0 } },
    { cursor: { x: 0, y: 0, z: 0 } }, { selection: [id.toUpperCase()] }, { view: { x: 0, y: 0, width: 0, height: 1 } },
    { view: { x: 0, y: 0, width: -1, height: 1 } }, { active: 1 }]) {
    assert.equal(checkPresence({ ...valid, ...patch }, 100, true), "bad_presence");
  }
  assert.equal(typeof checkPresence({ ...valid, cursor: { x: -1000000, y: 1000000 },
    view: { x: -1000000, y: 1000000, width: Number.MIN_VALUE, height: 1000000 } }, 100, true), "object");
});

test("room rate window counts refusals, drops silently and allows the exact byte edge", async () => {
  const f = fixture();
  try {
    const a = await f.open(), b = await f.open(); b.messages.length = 0;
    for (let i = 0; i < 5; i++) await f.send(a, input());
    for (let i = 0; i < 5; i++) await f.send(a, { ...input(), label: "spoof" });
    const count = a.messages.length; await f.send(a, { ...input(), update: "spoof" });
    assert.equal(a.messages.length, count); assert.equal(b.messages.length, 5);
    f.advance(999); await f.send(a, input()); assert.equal(b.messages.length, 5);
    f.advance(1);
    const value = { ...input(), selection: Array.from({ length: 250 }, randomUUID) };
    const size = bytes(JSON.stringify({ kind: "presence", ...value }));
    await f.send(a, value, 12288 - size); assert.equal(b.messages.at(-1).selection.length, 250);
    await f.send(a, value, 12289 - size); assert.equal(a.messages.at(-1).reason, "presence_too_large");
    await f.send(a, { ...input(), selection: Array(251).fill(randomUUID()) });
    assert.equal(a.messages.at(-1).reason, "presence_selection_limit");
  } finally { f.storage.close(); }
});

test("ordinals, board person key, largest attachment and renewal without email", async () => {
  const f = fixture();
  try {
    const a = await f.open(await f.reserve("\u0000".repeat(256)));
    const expected = sha(`presence:${f.board}:${f.person}`).slice(0, 32);
    assert.equal(a.messages[0].self.person, expected);
    assert.equal(expected, "af5f9083ba848927b40af52242d736dc");
    for (let i = 1; i < 9; i++) await f.open();
    assert.deepEqual(f.peers.map((p) => p.attachment().presence.colour), [...colours, colours[0]]);
    const highest = f.peers.at(-1); highest.close(1000); await f.room.closed(highest);
    assert.equal((await f.open()).attachment().ordinal, 8);
    for (const p of [...f.peers]) { p.close(1000); await f.room.closed(p); }
    const largest = await f.open(await f.reserve("\u0000".repeat(256)));
    assert.equal(largest.attachment().ordinal, 0);
    const value = { cursor: { x: -999999.9999999999, y: -999999.9999999999 }, selection: Array.from({ length: 250 }, randomUUID),
      view: { x: -999999.9999999999, y: -999999.9999999999, width: Number.MIN_VALUE, height: Number.MIN_VALUE }, active: true };
    for (let i = 0; i < 10; i++) await f.send(largest, value);
    const max = { ...largest.attachment(), epoch: Number.MAX_SAFE_INTEGER, ordinal: Number.MAX_SAFE_INTEGER,
      presenceAt: Number.MAX_SAFE_INTEGER, presenceTimes: Array(10).fill(Number.MAX_SAFE_INTEGER) };
    assert(bytes(JSON.stringify(max)) <= 16384, String(bytes(JSON.stringify(max))));
    await f.room.message(largest, JSON.stringify({ kind: "renew", token: "same" }));
    assert(!("email" in largest.attachment())); assert(bytes(JSON.stringify(largest.attachment())) <= 16384);
    assert.equal(largest.attachment().label.length, 256);
  } finally { f.storage.close(); }
});

test("labels use the last @ and refuse empty or excessive UTF-8 without shortening", () => {
  assert.equal(labelOf("a@b@host"), "a@b");
  assert.equal(labelOf("é".repeat(128) + "@host"), "é".repeat(128));
  for (const email of ["@host", "", "é".repeat(128) + "a@host"]) assert.throws(() => labelOf(email), /invalid_label/);
});

for (const created of [true, false]) test(`current storage initialization is idempotent, created=${created}`, () => {
  const storage = new NodeStorage(":memory:");
  try {
    initialize(storage);
    if (created) setMeta(storage, "storage_version", 5);
    assert(storage.all("PRAGMA table_info(tickets)").some((c) => c.name === "label"));
    assert.deepEqual(storage.all("SELECT * FROM tickets"), []);
    assert.equal(meta(storage, "storage_version"), created ? 5 : 0);
    storage.exec("INSERT INTO tickets VALUES ('new', 'person', 1, 1, 'label')"); initialize(storage);
    assert.equal(storage.all("SELECT * FROM tickets").length, 1);
    assert.equal(meta(storage, "storage_version"), created ? 5 : 0);
  } finally { storage.close(); }
});

for (const held of [false, true]) test(`late upgrade counts other unexpired holds, held=${held}`, async () => {
  const f = fixture();
  try {
    const expired = await f.reserve(); f.advance(5000);
    for (let i = 0; i < (held ? 49 : 50); i++) await f.open();
    const hold = held ? await f.reserve() : null;
    const late = await f.open(expired);
    assert.equal(late.messages.length, 0);
    assert.equal(f.events.find((event) => event.kind === "close" && event.peer === late).code, 1013);
    if (held) assert.equal((await f.open(hold)).messages[0].kind, "joined");
  } finally { f.storage.close(); }
});

for (const code of [4401, 4403, 4409, 4423]) test(`left precedes room close ${code}`, async () => {
  const f = fixture();
  try {
    const a = await f.open(), b = await f.open(), c = await f.open();
    f.events.length = 0;
    if (code === 4401) await f.room.message(a, JSON.stringify({ kind: "renew", token: "other" }));
    if (code === 4403 || code === 4409) { f.change(code === 4403 ? "viewer" : "owner"); await f.room.changed(); }
    if (code === 4423) await f.room.restore(await f.room.backup());
    const closes = f.events.filter((e) => e.kind === "close"); assert(closes.length);
    for (const closing of closes) {
      assert.equal(closing.code, code);
      for (const other of [a, b, c].filter((p) => p !== closing.peer)) {
        if (code !== 4423 && closes.some((e) => e.peer === other && f.events.indexOf(e) < f.events.indexOf(closing))) continue;
        const left = f.events.find((e) => e.peer === other && e.value?.kind === "left" &&
          e.value.connection === closing.peer.attachment().connectionId);
        assert(left); assert(f.events.indexOf(left) < f.events.indexOf(closing));
      }
    }
    if (code === 4423) assert(f.events.filter((e) => e.value?.kind === "left").every((e) => f.events.indexOf(e) < f.events.indexOf(closes[0])));
  } finally { f.storage.close(); }
});

test("a base-format attachment closes 1012 on wake with waiting deleted and no left", async () => {
  const f = fixture();
  try {
    const a = await f.open(), b = await f.open();
    const old = a.attachment();
    a.attach({ id: old.id, email: "old@example.test", connectionId: old.connectionId, expiresAt: old.expiresAt, role: old.role, epoch: old.epoch });
    f.storage.exec("INSERT INTO waiting VALUES (?, 1, 1, 1, 99999999, 'waiting', ?, 0)", old.connectionId, new Uint8Array([0, 0]));
    b.messages.length = 0; await f.room.alarm();
    assert.equal(f.events.find((e) => e.kind === "close" && e.peer === a).code, 1012);
    assert.equal(f.storage.all("SELECT * FROM waiting").length, 0);
    assert(!b.messages.some((m) => m.kind === "left"));
  } finally { f.storage.close(); }
});
