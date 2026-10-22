// SPDX-License-Identifier: Apache-2.0
import test from "node:test";
import assert from "node:assert/strict";
import {
  Adapter,
  add,
  canonical,
  empty,
  validate,
  validText,
} from "../apps/web/src/document.ts";
test("named board canonical roundtrip, independent identities and exact Unicode", () => {
  let b = { ...empty(), title: "Team 🧭" };
  b = add(b, "sticky", 0, 0);
  b.objects[0].text = "你好\ne\u0301";
  assert.deepEqual(validate(JSON.parse(canonical(b))), b);
  assert.notEqual(b.boardId, b.objects[0].id);
  const a = new Adapter();
  a.set(b);
  assert.equal(
    a.doc.getMap("objects").get(b.objects[0].id).get("text").toString(),
    b.objects[0].text,
  );
  a.destroy();
});
test("malformed schemas, duplicate identities and invalid geometry fail closed", () => {
  const b = add({ ...empty(), title: "Example" }, "text", 0, 0);
  for (
    const mutate of [
      (x) => x.schemaVersion = 2,
      (x) => x.unknown = true,
      (x) => x.objects[0].id = x.boardId,
      (x) => x.objects[0].x = Infinity,
      (x) => x.objects[0].order = 1,
    ]
  ) {
    const x = structuredClone(b);
    mutate(x);
    assert.throws(() => canonical(x));
  }
});
test("limits count code points and preserve valid empty object text", () => {
  assert(validText("🧭".repeat(1000), 1000));
  assert(!validText("x".repeat(1001), 1000));
  assert(validText("", 1000));
  assert(!validText(" ", 120, true));
  assert(!validText("\ud800", 1000));
  let b = { ...empty(), title: "Limit" };
  for (let i = 0; i < 250; i++) b = add(b, "sticky", 1e6, 1e6);
  assert.doesNotThrow(() => canonical(b));
  assert.throws(() => add(b, "text", 0, 0));
});

test("adapter retains live map and text identity across text and geometry edits", () => {
  const b = add({ ...empty(), title: "Stable adapter" }, "sticky", 0, 0);
  const adapter = new Adapter();
  adapter.set(b);
  const map = adapter.doc.getMap("objects").get(b.objects[0].id);
  const text = map.get("text");
  const edited = {
    ...b,
    objects: [{ ...b.objects[0], text: "Updated 🧭", x: 50 }],
  };
  adapter.set(edited);
  assert.equal(adapter.doc.getMap("objects").get(b.objects[0].id), map);
  assert.equal(map.get("text"), text);
  assert.equal(text.toString(), "Updated 🧭");
  assert.equal(map.get("geometry").x, 50);
  assert.equal(map.get("generation"), b.objects[0].generation);
  adapter.destroy();
});

test("UUID fields reject non-string values without coercion", () => {
  const original = add({ ...empty(), title: "Strict identities" }, "sticky", 0, 0);
  const fields = [
    (b, value) => b.boardId = value,
    (b, value) => b.objects[0].id = value,
    (b, value) => b.objects[0].generation = value,
    (b, value) => b.retiredGenerations = [value],
  ];
  for (const change of fields) {
    for (const value of [[crypto.randomUUID()], null, 42, {}]) {
      const board = structuredClone(original);
      change(board, value);
      const before = structuredClone(board);
      assert.throws(() => validate(board));
      assert.throws(() => canonical(board));
      assert.deepEqual(board, before);
    }
  }
});
