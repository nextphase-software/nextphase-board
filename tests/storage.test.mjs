// SPDX-License-Identifier: Apache-2.0
import { withoutPages } from "./import-fixture.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { add, canonical, empty, upgrade } from "../packages/board-rules/src/document.ts";
import { decode, digest, readPair } from "../apps/web/src/storage.ts";
const b = { ...empty(), title: "Storage" };
const wrap = async (revision, board = b) =>
  JSON.stringify({
    formatVersion: 1,
    storageRevision: revision,
    payload: canonical(board),
    sha256: await digest(canonical(board)),
  });
test("absent, initial and consecutive saved pair validation", async () => {
  assert.equal(await readPair([undefined, undefined]), null);
  assert.equal(
    (await readPair([await wrap(1), undefined])).board.title,
    "Storage",
  );
  assert.equal(
    (await readPair([await wrap(2), await wrap(1)])).envelope.storageRevision,
    2,
  );
});
test("reject inconsistent, corrupt and unknown data without altering raw bytes", async () => {
  for (
    const pair of [
      [undefined, await wrap(1)],
      [await wrap(2), undefined],
      [await wrap(3), await wrap(1)],
      [await wrap(2), await wrap(1, { ...b, boardId: crypto.randomUUID() })],
      ["unsupported", undefined],
    ]
  ) {
    const copy = structuredClone(pair);
    await assert.rejects(readPair(pair));
    assert.deepEqual(pair, copy);
  }
  const raw = await wrap(1);
  await assert.rejects(decode(raw.replace("Storage", "Changed")));
  await assert.rejects(
    decode(raw.replace('"formatVersion":1', '"formatVersion":2')),
  );
});

test("correctly hashed envelopes cannot adopt non-string UUID fields", async () => {
  const original = add({ ...empty(), title: "Strict stored identities" }, "text", 0, 0);
  for (const field of ["boardId", "id", "generation", "retiredGenerations"]) {
    const board = structuredClone(original);
    if (field === "boardId") board.boardId = [board.boardId];
    else if (field === "retiredGenerations") board.retiredGenerations = [[crypto.randomUUID()]];
    else board.objects[0][field] = [board.objects[0][field]];
    const payload = JSON.stringify(board);
    const raw = JSON.stringify({
      formatVersion: 1, storageRevision: 1, payload, sha256: await digest(payload),
    });
    const pair = [raw, undefined];
    const before = structuredClone(pair);
    await assert.rejects(decode(raw), field);
    await assert.rejects(readPair(pair), field);
    assert.deepEqual(pair, before);
  }
});

test("mixed v2 head and v1 previous decode while legacy raw bytes remain exact", async () => {
  const { upgrade } = await import("../packages/board-rules/src/document.ts");
  const current = add(add({ ...empty(), title: "Legacy storage" }, "sticky", 0, 0), "text", 400, 0);
  const legacy = { ...withoutPages(current), schemaVersion: 1, objects: withoutPages(current).objects.map(({ color, textSize, align, group, marks, section, ...o }) => o) };
  legacy.objects[0].text = "Legacy\n你好 🧭";
  const previous = await wrap(1, legacy);
  const legacyPayload = JSON.parse(previous).payload;
  const read = await readPair([previous, undefined]);
  assert.equal(read.board.schemaVersion, 1);
  assert.equal(canonical(read.board), legacyPayload);
  const upgraded = upgrade(read.board);
  const editable = { ...withoutPages(upgraded), schemaVersion: 2, objects: withoutPages(upgraded).objects.map(({ group, marks, section, ...o }) => o) };
  assert.equal(canonical(read.board), legacyPayload);
  editable.objects[1] = { ...editable.objects[1], color: "yellow", textSize: "large", align: "center" };
  const head = await wrap(2, editable);
  const pair = [head, previous];
  const before = structuredClone(pair);
  const loaded = await readPair(pair);
  assert.deepEqual(loaded.board, editable);
  assert.equal(loaded.envelope.storageRevision, 2);
  assert.deepEqual(pair, before);
  assert.equal((await decode(pair[1])).envelope.payload, legacyPayload);
  assert.equal(pair[1], previous);
  assert.equal(canonical((await decode(pair[1])).board), legacyPayload);
});
test("a correctly hashed unknown document version is rejected with raw bytes unchanged", async () => {
  const payload = JSON.stringify({ ...b, schemaVersion: 19 });
  const raw = JSON.stringify({ formatVersion: 1, storageRevision: 1, payload, sha256: await digest(payload) });
  const pair = [raw, undefined];
  await assert.rejects(decode(raw));
  await assert.rejects(readPair(pair));
  assert.deepEqual(pair, [raw, undefined]);
});

test("v7 grouped head and exact v2 previous decode without rewriting either record", async () => {
  const { upgrade } = await import("../packages/board-rules/src/document.ts");
  const { groupObjects } = await import("../apps/web/src/group.ts");
  let current = { ...empty(), title: "Saved groups" };
  for (let i = 0; i < 3; i++) current = add(current, "sticky", i * 400, 0);
  const old = { ...withoutPages(current), schemaVersion: 2, objects: withoutPages(current).objects.map(({ group, marks, section, ...o }) => o) };
  old.objects[0].text = "Old bytes\n你好 🧭";
  const previous = await wrap(1, old), bytes = JSON.parse(previous).payload;
  const opened = await readPair([previous, undefined]);
  assert.equal(opened.board.schemaVersion, 2);
  const upgraded = upgrade(opened.board);
  assert(upgraded.objects.every((o) => o.group === null));
  assert.equal(canonical(opened.board), bytes);
  const grouped = groupObjects(upgraded, new Set(upgraded.objects.slice(0, 2).map((o) => o.id)));
  const head = await wrap(2, grouped), pair = [head, previous], before = structuredClone(pair);
  const loaded = await readPair(pair);
  assert.equal(loaded.board.schemaVersion, 18);
  assert.deepEqual(loaded.board, grouped);
  assert.equal(loaded.board.objects[2].group, null);
  assert.equal((await decode(pair[1])).envelope.payload, bytes);
  assert.equal(canonical((await decode(pair[1])).board), bytes);
  assert.deepEqual(pair, before);
});

test("v7 shapes head and v5 previous decode without rewriting either record", async () => {
  const old = add({ ...empty(), title: "Before shapes", schemaVersion: 5 }, "sticky", 0, 0);
  Object.assign(old, withoutPages(old)); delete old.pages; old.schemaVersion = 5;
  const previous = await wrap(1, old), beforePayload = canonical(old);
  const current = add(old, "shape", 250, 0);
  current.objects[1] = { ...current.objects[1], shape: "circle", fill: { mode: "transparent", color: "#7a3cf0" }, border: { style: "dashed", color: "#204060" } };
  const pair = [await wrap(2, current), previous], before = structuredClone(pair);
  const loaded = await readPair(pair);
  assert.deepEqual(loaded.board, current); assert.equal(loaded.board.schemaVersion, 18);
  assert.equal(canonical((await decode(previous)).board), beforePayload);
  assert.deepEqual(pair, before);
});

test("v7 connector head and v6 previous decode without rewriting either record", async () => {
  const { createConnector } = await import("../apps/web/src/connectors.ts");
  const old = add(add({ ...empty(), title: "Connections" }, "sticky", 0, 0), "shape", 400, 0);
  Object.assign(old, withoutPages(old)); delete old.pages; old.schemaVersion = 6;
  const current = createConnector(upgrade({ ...old, schemaVersion: 9 }), old.objects[0].id, old.objects[1].id).board;
  const pair = [await wrap(2, current), await wrap(1, old)], before = structuredClone(pair);
  const loaded = await readPair(pair);
  assert.deepEqual(loaded.board, current);
  assert.equal((await decode(pair[1])).board.schemaVersion, 6);
  assert.equal(canonical((await decode(pair[1])).board), canonical(old));
  assert.deepEqual(pair, before);
});

test("0011-W3 storage decodes merged tables exactly and refuses invalid merge documents", async () => {
  const r = await import("../packages/board-rules/src/document.ts");
  const k = await import("../packages/board-rules/src/objects/table.ts");
  const s = await import("../apps/web/src/storage.ts");
  let board = r.add(r.add({ ...r.empty(), title: "Arranged" }, "table", 0, 0), "table", 600, 0);
  const t = board.objects[0], from = k.cellAt(t, 0, 0), to = k.cellAt(t, 1, 1);
  const merged = k.mergeRange(k.setCell(t, from, "Anchor"), { from, to });
  board = { ...board, objects: [merged, board.objects[1]] };
  const raw = await wrap(1, board);
  const decoded = await s.decode(raw);
  assert.equal(decoded.envelope.payload, r.canonical(board));
  assert.deepEqual(decoded.board.objects.map(o => o.merges), [merged.merges, []]);
  const { id, generation, type, page, columns, rows, cells, textSize, group, section, x, y, width, height, order } = t;
  const historical = { id, generation, type, page, columns, rows, cells, textSize, group, section, x, y, width, height, order };
  const legacy = { ...board, schemaVersion: 17, objects: [historical] };
  const legacyRaw = await wrap(2, legacy), opened = await s.decode(legacyRaw);
  assert.equal(opened.envelope.payload, r.canonical(legacy));
  assert.deepEqual(r.upgrade(opened.board).objects[0].merges, []);
  for (const [schemaVersion, table] of [[18, historical], [17, t],
    [18, { ...merged, merges: [merged.merges[0], merged.merges[0]] }],
    [18, { ...merged, cells: [{ ...to, text: "Covered" }] }]]) {
    const payload = JSON.stringify({ ...board, schemaVersion, objects: [table] });
    const bad = JSON.stringify({ formatVersion: 1, storageRevision: 1, payload, sha256: await s.digest(payload) });
    const memory = [bad, undefined], before = [...memory];
    await assert.rejects(s.readPair(memory));
    assert.deepEqual(memory, before);
  }
});

test("0011-W3 local storage reads an exact-cap legacy table and refuses its next save", async () => {
  const r = await import("../packages/board-rules/src/document.ts");
  const s = await import("../apps/web/src/storage.ts");
  const { sizedBoard } = await import("./import-fixture.mjs");
  const max = 2097152, row = crypto.randomUUID(), column = crypto.randomUUID();
  const table = { id: crypto.randomUUID(), generation: crypto.randomUUID(), type: "table", columns: [{ id: column, width: 192 }],
    rows: [{ id: row, height: 64 }], cells: [], textSize: "medium", group: null, section: null, x: 0, y: 0, width: 192, height: 64,
    order: sizedBoard().objects.length };
  const legacy = sizedBoard(max - 1 - Buffer.byteLength(JSON.stringify(table)), 17);
  legacy.objects.push({ ...table, page: legacy.pages[0].id });
  const raw = await wrap(1, legacy);
  const opened = await s.readPair([raw, undefined]);
  assert.equal(r.payloadBytes(opened.envelope.payload), max);
  const upgraded = r.upgrade(opened.board), store = new s.LocalStore();
  store.expected = [raw, undefined];
  assert.equal(upgraded.schemaVersion, 18);
  assert.deepEqual(upgraded.objects.at(-1).merges, []);
  assert.throws(() => store.save(upgraded, 1), /Board too large/);
  assert.deepEqual(store.expected, [raw, undefined]);
});
