// SPDX-License-Identifier: Apache-2.0
import test from "node:test";
import assert from "node:assert/strict";
import { NodeStorage } from "../apps/server/src/node-storage.ts";
import { initialize } from "../packages/board-room/src/storage.ts";
// Load inside each check so V12 reports missing candidate modules as assertions.
async function cursorModule() {
  return import("../apps/server/src/cursor.ts").catch(() => assert.fail("cursor module is required"));
}
async function copiesModule() {
  return import("../packages/board-room/src/copies.ts").catch(() => assert.fail("copies module is required"));
}
const workspace = "11111111-1111-4111-8111-111111111111";
const id = "22222222-2222-4222-8222-222222222222";
const envelope = { v: 1, workspace, sort: "edited", order: "desc", id, key: "2026-10-30 12:00:00.123456+00" };
const raw = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
test("list cursors round trip titles and exact microseconds", async () => {
  const { encodeCursor, decodeCursor } = await cursorModule();
  for (const value of [envelope, { ...envelope, sort: "created" }, { ...envelope, sort: "title", key: "Apple 🧭" }]) {
    assert.deepEqual(decodeCursor(encodeCursor(value), workspace, value.sort, value.order), value);
  }
});
test("list cursors reject every invalid shape key and request context", async () => {
  const { decodeCursor, listOrder } = await cursorModule();
  for (const value of [null, [], "cursor", { ...envelope, extra: 1 }, { ...envelope, v: "1" },
    { ...envelope, workspace: id }, { ...envelope, sort: "created" }, { ...envelope, order: "asc" },
    { ...envelope, id: id.toUpperCase().replace("2222", "AAAA") }, { ...envelope, key: 3 },
    { ...envelope, key: "0000-10-30 12:00:00+00" }, { ...envelope, key: "2026-10-30 12:00:00.000+00" },
    { ...envelope, key: "2026-02-30 12:00:00+00" }, { ...envelope, key: "2026-10-30T12:00:00Z" },
    { ...envelope, key: "2026-10-30 12:00:00.1234567+00" }, { ...envelope, key: "2026-10-30 12:00:00+01" }]) {
    assert.throws(() => decodeCursor(raw(value), workspace, "edited", "desc"), /bad_request/);
  }
  for (const value of ["", "!", raw(envelope) + "=", "a".repeat(2049), "_w", "eyJ2IjoxfR"]) {
    assert.throws(() => decodeCursor(value, workspace, "edited", "desc"), /bad_request/);
  }
  for (const key of ["", " ", "x".repeat(121), "\ud800", "\u0000"]) {
    assert.throws(() => decodeCursor(raw({ ...envelope, sort: "title", key }), workspace, "title", "desc"), /bad_request/);
  }
  assert.throws(() => listOrder("unknown", "desc"), /bad_request/);
  assert.throws(() => listOrder("title", "unknown"), /bad_request/);
});
test("title order folds only ASCII uppercase letters", async () => {
  const { titleOrderKey } = await cursorModule();
  assert.equal(titleOrderKey("AZ ÄİΣ"), "az ÄİΣ");
});
const saved = { boardId: id, title: "First", editedAt: 1000, generation: 0, revision: 0 };
const copied = { ...saved, timeCopiedAt: 1000 };
for (const [name, state, previous, now, expected] of [
  ["first copy includes time", saved, undefined, 1000, { needed: true, editedAt: 1000, deadline: null }],
  ["name within sixty seconds copies without time", { ...saved, title: "Second", editedAt: 2000 }, copied, 2000,
    { needed: true, editedAt: null, deadline: 61000 }],
  ["pending time copies at sixty seconds", { ...saved, editedAt: 2000 }, copied, 61000,
    { needed: true, editedAt: 2000, deadline: null }],
  ["restore copies an earlier time immediately", { ...saved, generation: 1, editedAt: 500 }, copied, 2000,
    { needed: true, editedAt: 500, deadline: null }],
]) test(name, async () => {
  const { copyDecision } = await copiesModule();
  assert.deepEqual(copyDecision(state, previous, now), expected);
});
test("failed copy stores no checkpoint and schedules a future retry", async () => {
  const { Copies } = await copiesModule();
  const storage = new NodeStorage(":memory:"); initialize(storage);
  try {
    const copies = new Copies(storage, { copy() { throw Error("offline"); } }, () => 1000, async () => {});
    copies.offer(saved); await copies.start();
    assert.equal(copies.checkpoint(), undefined);
    assert.equal(copies.deadline(), 61000);
  } finally { storage.close(); }
});
test("one copy in flight coalesces saves and sanitizes only the row title", async () => {
  const { Copies } = await copiesModule();
  const storage = new NodeStorage(":memory:"); initialize(storage);
  const calls = [];
  let release;
  const copies = new Copies(storage, { async copy(value) {
    calls.push(value);
    if (calls.length === 1) await new Promise((resolve) => { release = resolve; });
  } }, () => 1000, async () => {});
  try {
    copies.offer(saved); const task = copies.start();
    copies.offer({ ...saved, title: "Next" }); await copies.start();
    copies.offer({ ...saved, title: "Last\u0000", revision: 2 });
    assert.equal(calls.length, 1); assert.equal(copies.deadline(), null);
    release(); await task;
    assert.equal(calls.length, 2); assert.equal(calls[1].title, "Last\ufffd");
    assert.equal(copies.checkpoint().revision, 2);
  } finally { storage.close(); }
});
