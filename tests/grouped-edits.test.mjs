// SPDX-License-Identifier: Apache-2.0
import test from "node:test";
import assert from "node:assert/strict";
import * as Y from "yjs";
import { BoardSession, encode } from "../packages/board-sync/src/session.ts";
import { Adapter } from "../packages/board-sync/src/document-adapter.ts";
import { add, empty, upgrade } from "../packages/board-rules/src/document.ts";

const initialBoard = () => add({ ...upgrade(empty()), title: "Grouped edits" }, "sticky", 0, 0);
const text = (board, value) => ({ ...board, objects: board.objects.map((object, index) => index ? object : { ...object, text: value }) });
async function fixture(initial = initialBoard()) {
  const seed = new Adapter(); seed.set(initial);
  const wires = [], timers = new Set();
  const clock = { now: () => 0, after(ms, run) { const timer = { ms, run }; timers.add(timer); return () => timers.delete(timer); } };
  const joined = { kind: "joined", role: "editor", epoch: 1, revision: 0,
    update: encode(Y.encodeStateAsUpdate(seed.doc)), self: {}, present: [] };
  const session = await BoardSession.join({ clock, clientId: 42, ticket: async () => "ticket",
    open: async () => {
      const wire = { sent: [], send(value) { this.sent.push(value); }, close() {},
        listen(handlers) { this.handlers = handlers; handlers.message(JSON.stringify(joined)); },
        message(value) { this.handlers.message(JSON.stringify(value)); } };
      wires.push(wire); return wire;
    } });
  return { session, seed, wires, finish() { session.close(); seed.destroy(); } };
}
const tick = async () => { for (let index = 0; index < 10; index++) await Promise.resolve(); };

test("three grouped text edits undo once and redo to the last text", async () => {
  const f = await fixture();
  try {
    const before = f.session.board.objects[0].text;
    for (const value of ["I", "In", "Interview"]) f.session.edit(text(f.session.board, value), "typing");
    assert.equal(f.wires[0].sent.length, 3);
    assert.equal(f.session.history.past.length, 1);
    assert(f.session.requests.has(f.session.undo()));
    assert.equal(f.session.board.objects[0].text, before);
    assert(f.session.requests.has(f.session.redo()));
    assert.equal(f.session.board.objects[0].text, "Interview");
  } finally { f.finish(); }
});
for (const boundary of ["different group", "no group", "undo", "redo", "rejoin"]) {
  test(`a ${boundary} starts a new grouped step`, async () => {
    const f = await fixture();
    try {
      const first = f.session.edit(text(f.session.board, "First"), "a");
      if (boundary === "different group") f.session.edit(text(f.session.board, "Other"), "b");
      if (boundary === "no group") f.session.edit(text(f.session.board, "Other"));
      if (boundary === "undo" || boundary === "redo") f.session.undo();
      if (boundary === "redo") f.session.redo();
      if (boundary === "rejoin") { f.wires[0].message({ kind: "refused", requestId: first, reason: "invalid_update" }); await tick(); }
      const count = f.session.history.past.length;
      f.session.edit(text(f.session.board, "Next"), "a");
      assert.equal(f.session.history.past.length, count + 1);
    } finally { f.finish(); }
  });
}
for (const operation of ["add", "delete"]) test(`grouped ${operation} is separate and ends the group`, async () => {
  const f = await fixture();
  try {
    f.session.edit(text(f.session.board, "First"), "a");
    const board = f.session.board;
    const next = operation === "add" ? add(board, "text", 100, 100)
      : { ...board, objects: [], retiredGenerations: [...board.retiredGenerations, board.objects[0].generation].sort() };
    f.session.edit(next, "a");
    assert.equal(f.session.history.past.length, 2);
    const changed = operation === "add" ? text(f.session.board, "Next") : { ...f.session.board, title: "Next" };
    f.session.edit(changed, "a");
    assert.equal(f.session.history.past.length, 3);
  } finally { f.finish(); }
});
test("a peer's text between grouped edits kills the whole text guard permanently", async () => {
  const f = await fixture();
  try {
    f.session.edit(text(f.session.board, "Mine"), "a");
    const peer = new Adapter();
    Y.applyUpdate(peer.doc, Y.encodeStateAsUpdate(f.session.doc));
    const vector = Y.encodeStateVector(peer.doc);
    peer.set(text(f.session.board, "Mine and theirs"));
    f.wires[0].message({ kind: "update", revision: 1, update: encode(Y.encodeStateAsUpdate(peer.doc, vector)) });
    f.session.edit(text(f.session.board, "Mine and theirs plus mine"), "a");
    assert.equal(f.session.history.past.length, 1);
    assert.equal(f.session.undo(), "changed_by_others");
    assert.equal(f.session.board.objects[0].text, "Mine and theirs plus mine");
    peer.destroy();
  } finally { f.finish(); }
});
test("a grouped step counts once toward the hundred step cap", async () => {
  const f = await fixture();
  try {
    for (let index = 1; index <= 110; index++) f.session.edit(text(f.session.board, String(index)), "a");
    assert.equal(f.session.history.past.length, 1);
    for (let index = 111; index <= 210; index++) f.session.edit(text(f.session.board, String(index)));
    assert.equal(f.session.history.past.length, 100);
  } finally { f.finish(); }
});
test("the group never reaches the wire: edit bytes are identical", async (context) => {
  const initial = initialBoard();
  const left = await fixture(initial), right = await fixture(initial);
  try {
    // Both connections receive the same seed bytes and use the same client ID.
    right.wires[0].message({ kind: "joined", role: "editor", epoch: 1, revision: 0,
      update: encode(Y.encodeStateAsUpdate(left.seed.doc)), self: {}, present: [] });
    context.mock.method(crypto, "randomUUID", () => "11111111-1111-4111-8111-111111111111");
    left.session.edit(text(left.session.board, "Same"), "typing");
    right.session.edit(text(right.session.board, "Same"));
    assert.equal(left.wires[0].sent[0], right.wires[0].sent[0]);
    assert.deepEqual(Object.keys(JSON.parse(left.wires[0].sent[0])), ["kind", "epoch", "requestId", "update"]);
  } finally { left.finish(); right.finish(); }
});

test("joining a group keeps each unit's first before-value and latest after-value", async () => {
  const f = await fixture();
  try {
    const before = f.session.board;
    f.session.edit(text(before, "First"), "a");
    f.session.edit({ ...text(f.session.board, "Final"), title: "Changed title" }, "a");
    assert.equal(f.session.history.past.length, 1);
    f.session.undo();
    assert.equal(f.session.board.title, before.title);
    assert.equal(f.session.board.objects[0].text, before.objects[0].text);
    f.session.redo();
    assert.equal(f.session.board.title, "Changed title");
    assert.equal(f.session.board.objects[0].text, "Final");
  } finally { f.finish(); }
});
