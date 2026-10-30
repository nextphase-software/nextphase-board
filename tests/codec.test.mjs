// SPDX-License-Identifier: Apache-2.0
import test from "node:test";
import assert from "node:assert/strict";
import { add, canonical, empty } from "../packages/board-rules/src/document.ts";
import { Adapter } from "../packages/board-sync/src/document-adapter.ts";
import { readBoard } from "../packages/board-sync/src/codec.ts";
const board = () => add({ ...empty(), title: "Roundtrip" }, "text", 100, 100);
test("the adapter mapping roundtrips to canonical JSON", () => {
  const b = board(), a = new Adapter();
  a.set(b);
  assert.equal(canonical(readBoard(a.doc)), canonical(b));
  a.destroy();
});
for (const [name, change] of [
  ["unknown root", (a) => a.doc.getMap("hidden").set("secret", "no")],
  ["unknown object field", (a, b) => a.doc.getMap("objects").get(b.objects[0].id).set("hidden", "no")],
]) test("codec rejects " + name, () => {
  const b = board(), a = new Adapter(); a.set(b); change(a, b);
  assert.throws(() => readBoard(a.doc), /invalid_update/); a.destroy();
});
