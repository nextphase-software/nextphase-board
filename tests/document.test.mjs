// SPDX-License-Identifier: Apache-2.0
import nodeTest from "node:test";
import assert from "node:assert/strict";
import {
  Adapter,
  add as addV2,
  canonical,
  empty as emptyV2,
  upgrade,
  validate,
  validText,
} from "../apps/web/src/document.ts";
import { ALIGNMENTS, COLORS, DEFAULT_STYLES, TEXT_SIZES } from "../apps/web/src/styles.ts";
const legacy = (b) => ({ ...b, schemaVersion: 1, objects: b.objects.map(({ color, textSize, align, ...o }) => o) });
for (const version of [1, 2]) {
  const test = (name, fn) => nodeTest(`v${version}: ${name}`, fn);
  const empty = () => version === 1 ? legacy(emptyV2()) : emptyV2();
  const add = (...args) => version === 1 ? legacy(addV2(...args)) : addV2(...args);
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
      (x) => x.schemaVersion = 3,
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

}

nodeTest("v1 canonical bytes stay exact and upgrading adds only defaults", () => {
  const b = legacy(addV2(addV2({ ...emptyV2(), title: "Legacy 🧭" }, "sticky", 0, 0), "text", 450, 0));
  b.objects[0].text = "One\nTwo\ne\u0301";
  b.objects[0].height = 160;
  b.retiredGenerations = [crypto.randomUUID()];
  const bytes = JSON.stringify(b);
  const decoded = validate(JSON.parse(bytes));
  assert.equal(canonical(decoded), bytes);
  const upgraded = upgrade(decoded);
  assert.equal(upgraded.schemaVersion, 2);
  assert.deepEqual(legacy(upgraded), b);
  assert.deepEqual(upgraded.objects.map(({ color, textSize, align }) => ({ color, textSize, align })),
    [DEFAULT_STYLES.sticky, DEFAULT_STYLES.text]);
  assert.equal(canonical(decoded), bytes);
  assert.equal(upgrade(upgraded), upgraded);
  const adapter = new Adapter();
  adapter.set(decoded);
  assert.deepEqual(adapter.doc.getMap("objects").get(b.objects[1].id).get("style"), DEFAULT_STYLES.text);
  assert.equal(canonical(decoded), bytes);
  adapter.destroy();
});
nodeTest("v2 accepts every style combination on both object types", () => {
  assert.equal(emptyV2().schemaVersion, 2);
  for (const type of ["sticky", "text"]) {
    const b = addV2({ ...emptyV2(), title: "Styles" }, type, 0, 0);
    assert.equal(b.schemaVersion, 2);
    for (const key of ["color", "textSize", "align"]) assert.equal(b.objects[0][key], DEFAULT_STYLES[type][key]);
    for (const c of COLORS) for (const s of TEXT_SIZES) for (const a of ALIGNMENTS) {
      const styled = { ...b, objects: [{ ...b.objects[0], color: c.name, textSize: s.name, align: a.name }] };
      assert.deepEqual(validate(JSON.parse(canonical(styled))), styled);
      assert.deepEqual(Object.keys(JSON.parse(canonical(styled)).objects[0]), [
        "id", "generation", "type", "text", "color", "textSize", "align", "x", "y", "width", "height", "order",
      ]);
    }
    for (const key of ["color", "textSize", "align"]) {
      for (const value of ["unknown", "", null, 1, {}, [b.objects[0][key]]]) {
        const invalid = structuredClone(b);
        invalid.objects[0][key] = value;
        assert.throws(() => validate(invalid));
      }
      const missing = structuredClone(b);
      delete missing.objects[0][key];
      assert.throws(() => validate(missing));
      const v1 = legacy(b);
      v1.objects[0][key] = b.objects[0][key];
      assert.throws(() => validate(v1));
    }
    const extra = structuredClone(b);
    extra.objects[0].extra = "unknown";
    assert.throws(() => validate(extra));
  }
});
nodeTest("v2 canonical ordering is independent of input key order; v1 omits styles", () => {
  const b = addV2({ ...emptyV2(), title: "Ordering" }, "sticky", 0, 0);
  const reversed = { ...b, objects: [Object.fromEntries(Object.entries(b.objects[0]).reverse())] };
  assert.equal(canonical(reversed), canonical(b));
  assert(!canonical(legacy(b)).includes('"color"'));
  assert.deepEqual(Object.keys(JSON.parse(canonical(legacy(b))).objects[0]), [
    "id", "generation", "type", "text", "x", "y", "width", "height", "order",
  ]);
});
nodeTest("adapter stores style atomically with size growth in one transaction", () => {
  const b = addV2({ ...emptyV2(), title: "Atomic style" }, "sticky", 0, 0);
  const adapter = new Adapter();
  adapter.set(b);
  const map = adapter.doc.getMap("objects").get(b.objects[0].id);
  const text = map.get("text");
  const beforeStyle = map.get("style");
  const changedKeys = [];
  map.observe((event) => changedKeys.push([...event.keysChanged].sort()));
  let revisions = 0;
  adapter.doc.on("afterTransaction", () => revisions++);
  const after = { ...b, objects: [{ ...b.objects[0], color: "teal", textSize: "extra-large", align: "right", height: 400 }] };
  adapter.set(after);
  assert.equal(revisions, 1);
  assert.deepEqual(changedKeys, [["geometry", "style"]]);
  assert.deepEqual(beforeStyle, DEFAULT_STYLES.sticky);
  assert.deepEqual(map.get("style"), { color: "teal", textSize: "extra-large", align: "right" });
  assert.equal(map.get("geometry").height, 400);
  assert.equal(map.get("text"), text);
  assert.equal(map.get("generation"), b.objects[0].generation);
  const recreated = new Adapter();
  recreated.set(validate(JSON.parse(canonical(after))));
  assert.deepEqual(recreated.doc.getMap("objects").get(b.objects[0].id).get("style"), map.get("style"));
  adapter.destroy(); recreated.destroy();
});
