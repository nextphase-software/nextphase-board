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
import { objectType } from "../apps/web/src/objects/registry.ts";
import { ALIGNMENTS, COLORS, TEXT_SIZES } from "../apps/web/src/styles.ts";
const legacy = (b) => ({ ...b, schemaVersion: 1, objects: b.objects.map(({ color, textSize, align, group, marks, ...o }) => o) });
const v2 = (b) => ({ ...b, schemaVersion: 2, objects: b.objects.map(({ group, marks, ...o }) => o) });
const v3 = (b) => ({ ...b, schemaVersion: 3, objects: b.objects.map(({ marks, ...o }) => o) });
const versioned = (b, version) => version === 1 ? legacy(b) : version === 2 ? v2(b) : version === 3 ? v3(b) : b;
for (const version of [1, 2, 3, 4]) {
  const test = (name, fn) => nodeTest(`v${version}: ${name}`, fn);
  const empty = () => versioned(emptyV2(), version);
  const add = (...args) => versioned(addV2(...args), version);
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
      (x) => x.schemaVersion = 5,
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
  assert.equal(upgraded.schemaVersion, 4);
  assert(upgraded.objects.every((o) => o.group === null));
  assert(upgraded.objects.every((o) => o.marks.length === 0));
  assert.deepEqual(legacy(upgraded), b);
  assert.deepEqual(upgraded.objects.map(({ color, textSize, align }) => ({ color, textSize, align })),
    [objectType("sticky").legacyStyle, objectType("text").legacyStyle]);
  assert.equal(canonical(decoded), bytes);
  assert.equal(upgrade(upgraded), upgraded);
  const adapter = new Adapter();
  adapter.set(decoded);
  assert.deepEqual(adapter.doc.getMap("objects").get(b.objects[1].id).get("style"), objectType("text").legacyStyle);
  assert.equal(canonical(decoded), bytes);
  adapter.destroy();
});
nodeTest("v2 accepts every style combination on both object types", () => {
  assert.equal(emptyV2().schemaVersion, 4);
  for (const type of ["sticky", "text"]) {
    const b = addV2({ ...emptyV2(), title: "Styles" }, type, 0, 0);
    assert.equal(b.schemaVersion, 4);
    assert.equal(b.objects[0].group, null);
    assert.deepEqual(b.objects[0].marks, []);
    for (const key of ["color", "textSize", "align"]) assert.equal(b.objects[0][key], objectType(type).defaultStyle[key]);
    for (const c of COLORS) for (const s of TEXT_SIZES) for (const a of ALIGNMENTS) {
      const styled = { ...b, objects: [{ ...b.objects[0], color: c.name, textSize: s.name, align: a.name }] };
      for (const versioned of [v2(styled), v3(styled), styled]) {
        assert.deepEqual(validate(JSON.parse(canonical(versioned))), versioned);
        assert.deepEqual(Object.keys(JSON.parse(canonical(versioned)).objects[0]), [
          "id", "generation", "type", "text", "color", "textSize", "align",
          ...(versioned.schemaVersion >= 3 ? ["group"] : []),
          ...(versioned.schemaVersion === 4 ? ["marks"] : []), "x", "y", "width", "height", "order",
        ]);
      }
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
  assert.deepEqual(beforeStyle, objectType("sticky").defaultStyle);
  assert.deepEqual(map.get("style"), { color: "teal", textSize: "extra-large", align: "right" });
  assert.equal(map.get("geometry").height, 400);
  assert.equal(map.get("text"), text);
  assert.equal(map.get("generation"), b.objects[0].generation);
  const recreated = new Adapter();
  recreated.set(validate(JSON.parse(canonical(after))));
  assert.deepEqual(recreated.doc.getMap("objects").get(b.objects[0].id).get("style"), map.get("style"));
  adapter.destroy(); recreated.destroy();
});

nodeTest("v3 group validation accepts shared IDs, null and singleton groups and rejects collisions", () => {
  let b = addV2(addV2({ ...emptyV2(), title: "Group validation" }, "sticky", 0, 0), "text", 400, 0);
  b = addV2(b, "sticky", 800, 0);
  b.retiredGenerations = [crypto.randomUUID()];
  const group = crypto.randomUUID();
  for (const membership of [[null, null, null], [group, group, null], [group, null, null]]) {
    const grouped = { ...b, objects: b.objects.map((o, i) => ({ ...o, group: membership[i] })) };
    assert.deepEqual(validate(JSON.parse(canonical(grouped))), grouped);
  }
  const invalidValues = [undefined, 42, {}, [group], "", group.toUpperCase(), "not-a-uuid",
    group.slice(0, 14) + "5" + group.slice(15), b.boardId, ...b.objects.flatMap((o) => [o.id, o.generation]), ...b.retiredGenerations];
  for (const value of invalidValues) {
    const invalid = structuredClone(b);
    invalid.objects[0].group = value;
    const before = structuredClone(invalid);
    assert.throws(() => validate(invalid));
    assert.throws(() => canonical(invalid));
    assert.deepEqual(invalid, before);
  }
  const missing = structuredClone(b);
  delete missing.objects[0].group;
  assert.throws(() => validate(missing));
  const extra = structuredClone(b);
  extra.objects[0].groups = [];
  assert.throws(() => validate(extra));
  for (const old of [legacy(b), v2(b)]) {
    old.objects[0].group = null;
    assert.throws(() => validate(old));
  }
});

for (const version of [1, 2, 3]) nodeTest(`v${version} exact bytes survive decoding and in-memory v4 upgrade`, () => {
  const current = addV2(addV2({ ...emptyV2(), title: "Legacy groups 🧭" }, "sticky", 0, 0), "text", 400, 0);
  if (version === 3) current.objects[0].group = crypto.randomUUID();
  current.objects[1].color = "teal";
  current.objects[1].text = "你好\ne\u0301";
  const old = versioned(current, version), bytes = JSON.stringify(old);
  const decoded = validate(JSON.parse(bytes)), before = structuredClone(decoded);
  const upgraded = upgrade(decoded);
  assert.equal(canonical(decoded), bytes);
  assert.deepEqual(decoded, before);
  assert.equal(upgraded.schemaVersion, 4);
  assert.deepEqual(upgraded.objects.map((o) => o.group), version === 3 ? old.objects.map((o) => o.group) : [null, null]);
  assert(upgraded.objects.every((o) => o.marks.length === 0));
  assert.deepEqual(versioned(upgraded, version), old);
  assert.equal(upgrade(upgraded), upgraded);
  assert.equal(upgraded.objects[1].color, version === 1 ? "neutral" : "teal");
  if (version === 2) assert.deepEqual(Object.keys(JSON.parse(bytes).objects[0]), [
    "id", "generation", "type", "text", "color", "textSize", "align", "x", "y", "width", "height", "order",
  ]);
});

nodeTest("v3 canonical group key order and atomic adapter membership survive recreation", () => {
  const b = addV2(addV2({ ...emptyV2(), title: "Atomic group" }, "sticky", 0, 0), "text", 400, 0);
  const group = crypto.randomUUID();
  const grouped = { ...b, objects: b.objects.map((o) => ({ ...o, group })) };
  const shuffled = { ...grouped, objects: grouped.objects.map((o) => Object.fromEntries(Object.entries(o).reverse())) };
  assert.equal(canonical(shuffled), canonical(grouped));
  assert.deepEqual(Object.keys(JSON.parse(canonical(grouped)).objects[0]), [
    "id", "generation", "type", "text", "color", "textSize", "align", "group", "marks", "x", "y", "width", "height", "order",
  ]);
  const adapter = new Adapter();
  adapter.set(b);
  const maps = b.objects.map((o) => adapter.doc.getMap("objects").get(o.id));
  assert(maps.every((m) => m.get("group") === null));
  const changes = [];
  for (const m of maps) m.observe((event) => changes.push([...event.keysChanged]));
  let revisions = 0;
  adapter.doc.on("afterTransaction", () => revisions++);
  adapter.set(grouped);
  assert.equal(revisions, 1);
  assert.deepEqual(changes, [["group"], ["group"]]);
  assert(maps.every((m, i) => m === adapter.doc.getMap("objects").get(b.objects[i].id) && m.get("group") === group));
  const recreated = new Adapter();
  recreated.set(validate(JSON.parse(canonical(grouped))));
  assert(b.objects.every((o) => recreated.doc.getMap("objects").get(o.id).get("group") === group));
  adapter.set(b);
  assert(maps.every((m) => m.get("group") === null));
  adapter.destroy(); recreated.destroy();
});

nodeTest("v4 marks roundtrip, canonical order and strict validation", () => {
  const b = addV2({ ...emptyV2(), title: "Formatted 🧭" }, "text", 0, 0);
  b.objects[0].text = "🧭abc";
  b.objects[0].marks = [{ start: 0, end: 2, bold: true, italic: true, strike: true }, { start: 2, end: 4, italic: true }];
  const bytes = canonical(b);
  assert.deepEqual(validate(JSON.parse(bytes)), b);
  assert.equal(JSON.parse(bytes).schemaVersion, 4);
  assert.deepEqual(Object.keys(JSON.parse(bytes).objects[0].marks[0]), ["start", "end", "bold", "italic", "strike"]);
  const shuffled = structuredClone(b);
  shuffled.objects = shuffled.objects.map((o) => Object.fromEntries(Object.entries({
    ...o, marks: o.marks.map((m) => Object.fromEntries(Object.entries(m).reverse())),
  }).reverse()));
  assert.equal(canonical(shuffled), bytes);
  for (const marks of [
    [{ start: 0, end: 2, bold: true }, { start: 1, end: 3, italic: true }],
    [{ start: 0, end: 1, bold: true }, { start: 1, end: 2, bold: true }],
    [{ start: 0, end: 5, bold: true }],
    [{ start: 0, end: 1, strike: false }],
  ]) {
    const invalid = { ...b, objects: [{ ...b.objects[0], marks }] };
    assert.throws(() => validate(invalid), /Invalid marks/);
    assert.throws(() => canonical(invalid), /Invalid marks/);
  }
  const missing = structuredClone(b);
  delete missing.objects[0].marks;
  assert.throws(() => validate(missing));
  for (const version of [1, 2, 3]) {
    const old = versioned(b, version);
    old.objects[0].marks = [];
    assert.throws(() => validate(old));
  }
});
nodeTest("v4 adapter stores canonical marks atomically and recreates them without redundant writes", () => {
  const b = addV2({ ...emptyV2(), title: "Atomic marks" }, "sticky", 0, 0);
  b.objects[0].text = "abc";
  const adapter = new Adapter();
  adapter.set(b);
  const map = adapter.doc.getMap("objects").get(b.objects[0].id), text = map.get("text");
  assert.deepEqual(map.get("marks"), []);
  const changes = [];
  map.observe((event) => changes.push([...event.keysChanged]));
  let revisions = 0;
  adapter.doc.on("afterTransaction", () => revisions++);
  const marks = [{ strike: true, italic: true, bold: true, end: 3, start: 0 }];
  const after = { ...b, objects: [{ ...b.objects[0], marks }] };
  adapter.set(after);
  assert.equal(revisions, 1);
  assert.deepEqual(changes, [["marks"]]);
  assert.equal(map.get("text"), text);
  assert.deepEqual(Object.keys(map.get("marks")[0]), ["start", "end", "bold", "italic", "strike"]);
  const stored = map.get("marks");
  adapter.set({ ...after, objects: [{ ...after.objects[0], marks: [{ start: 0, end: 3, bold: true, italic: true, strike: true }] }] });
  assert.equal(map.get("marks"), stored);
  assert.deepEqual(changes, [["marks"]]);
  const recreated = new Adapter();
  recreated.set(validate(JSON.parse(canonical(after))));
  assert.deepEqual(recreated.doc.getMap("objects").get(b.objects[0].id).get("marks"), stored);
  adapter.destroy(); recreated.destroy();
});
