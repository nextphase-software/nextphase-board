// SPDX-License-Identifier: Apache-2.0
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as Y from "yjs";

const tableRules = () => import("../packages/board-rules/src/objects/table.ts");
const document = () => import("../packages/board-rules/src/document.ts");
const web = () => import("../apps/web/src/table.ts");
const uuid = () => crypto.randomUUID();
async function board(columns = 2, rows = 2) {
  const r = await document(), t = await tableRules();
  return r.add({ ...r.empty(), title: "Table check" }, t.table.type, -500, -250, undefined, { rows, columns });
}
const withTable = (b, update) => ({ ...b, objects: [update(b.objects[0]), ...b.objects.slice(1)] });
const address = (t, r = 0, c = 0) => ({ row: t.rows[r].id, column: t.columns[c].id });
const tableMap = (doc, id) => doc.getMap("objects").get(id);
async function shared(initial) {
  const [{ Adapter }, { readBoard }] = await Promise.all([
    import("../packages/board-sync/src/document-adapter.ts"), import("../packages/board-sync/src/codec.ts"),
  ]);
  const adapter = new Adapter();
  if (initial instanceof Y.Doc) Y.applyUpdate(adapter.doc, Y.encodeStateAsUpdate(initial));
  else adapter.set(initial);
  return { adapter, doc: adapter.doc, read: () => readBoard(adapter.doc), write(update, hint) {
    const vector = Y.encodeStateVector(adapter.doc);
    adapter.set(update(readBoard(adapter.doc)), undefined, undefined, hint);
    return Y.encodeStateAsUpdate(adapter.doc, vector);
  } };
}

test("T-U01 table rules place bounded dimensions and canonicalize nested keys and cells", async () => {
  const r = await document(), t = await tableRules(), b = await board(), base = b.objects[0];
  assert.equal(b.schemaVersion, 18);
  assert.deepEqual([base.x, base.y, base.width, base.height], [-500, -250, 384, 128]);
  assert.equal(new Set([...base.rows, ...base.columns].map(a => a.id)).size, 4);
  const large = (await board(3, 4)).objects[0];
  assert.deepEqual([large.width, large.height], [576, 256]);
  const withCells = withTable(b, o => ({ ...o, columns: o.columns.map(({id,width}) => ({width,id})),
    cells: [{ text: "Last", ...address(o, 1, 1) }, { text: "First", ...address(o) }] }));
  const canonical = JSON.parse(r.canonical(withCells)).objects[0];
  assert.deepEqual(Object.keys(canonical), t.table.savedKeys);
  assert.deepEqual(Object.keys(canonical.columns[0]), ["id", "width"]);
  assert.deepEqual(Object.keys(canonical.cells[0]), ["row", "column", "text"]);
  assert.deepEqual(canonical.cells.map(c => c.text), ["First", "Last"]);
  assert.throws(() => r.validate({ ...b, schemaVersion: 13 }));
  const legacy = { ...b, schemaVersion: 13, objects: [] };
  assert.equal(r.upgrade(legacy).schemaVersion, 18);
  assert.equal(JSON.parse(r.canonical(legacy)).schemaVersion, 13);
});

test("T-U02 document refuses malformed entries, invalid text, sizes, bounds and board cell totals", async () => {
  const b = await board(), r = await document(), k = await tableRules(), t = b.objects[0];
  const cell = { ...address(t), text: "a" }, withCell = text => ({ cells: [{ ...cell, text }] });
  for (const changes of [
    { columns: [] }, { rows: [] }, { columns: k.createTable(20, 1).columns.concat(t.columns) },
    { rows: k.createTable(1, 50).rows.concat(t.rows) },
    { columns: [{ ...t.columns[0], width: 63 }] }, { rows: [{ ...t.rows[0], height: 1001 }] },
    { rows: [{ ...t.rows[0], height: 64.5 }] }, { columns: [{ ...t.columns[0], id: t.rows[0].id }] },
    { columns: [{ width: 192, id: "unknown" }] }, { rows: [{ ...t.rows[0], extra: true }] },
    { width: t.width - 1 }, { height: t.height + 1 }, { textSize: "huge" }, { fill: "white" },
    { cells: [cell, cell] }, { cells: [{ ...cell, column: uuid() }] }, { cells: [{ ...cell, row: uuid() }] },
    withCell(""), withCell("🟦".repeat(1001)), withCell("\ud800"),
  ]) assert.throws(() => r.validate(withTable(b, o => ({ ...o, ...changes }))), JSON.stringify(changes).slice(0, 120));
  assert.doesNotThrow(() => r.validate(withTable(b, o => ({ ...o, ...withCell("🟦".repeat(1000)) }))));
  let limits = { ...b, objects: [] };
  for (let i = 0; i < 5; i++) limits = r.add(limits, "table", 0, 0, limits.boardId, { columns: 20, rows: 50 });
  assert.doesNotThrow(() => r.validate(limits));
  assert.throws(() => r.validate(r.add(limits, "table", 0, 0, limits.boardId, { columns: 1, rows: 1 })), /Too many table cells/);
});

test("T-U03 axis changes, reading order and duplication, paste and template copies keep stable addresses", async () => {
  const t = await tableRules(), b = await board(), h = await import("../apps/web/src/history.ts"), c = await import("../apps/web/src/clipboard.ts");
  const original = t.setCell(b.objects[0], address(b.objects[0]), "Keep me"), row = uuid(), column = uuid();
  let next = t.insertAxis(t.insertAxis(original, "row", row, 0), "column", column, 1);
  assert.equal(t.cellText(next, address(original)), "Keep me");
  assert.deepEqual(t.nextCell(next, address(next, 0, 2), 1), address(next, 1, 0));
  assert.deepEqual(t.nextCell(next, address(next, 1, 0), -1), address(next, 0, 2));
  assert.equal(t.neighbourCell(next, address(next), "ArrowLeft"), undefined);
  assert.deepEqual(t.neighbourCell(next, address(next), "ArrowDown"), address(next, 1, 0));
  next = t.deleteAxis(t.deleteAxis(next, "column", column), "row", row);
  assert.deepEqual(next, original);
  const single = t.createTable(1, 1);
  assert.equal(t.deleteAxis(single, "row", single.rows[0].id), single);
  assert.equal(t.deleteAxis(single, "column", single.columns[0].id), single);
  assert.equal(t.resizeAxis(original, "row", original.rows[0].id, 10).rows[0].height, 64);
  assert.equal(t.resizeAxis(original, "column", original.columns[0].id, 2000).columns[0].width, 1000);
  assert.deepEqual(t.scaleTable(original, 1.25, 2).columns.map(c => c.width), [240, 240]);
  assert.deepEqual(t.scaleTable(original, 1.25, 2).rows.map(r => r.height), [128, 128]);
  const copied = { ...b, objects: [original] };
  const duplicate = h.duplicate(copied, h.emptyHistory(), original).board.objects[1];
  const inserted = c.copyObjects(copied, { objects: [original], sourceIdentifiers: [original.id] }, 10, 10).objects[1];
  for (const copy of [duplicate, inserted]) {
    assert.notEqual(copy.id, original.id);
    assert(![...copy.rows, ...copy.columns].some(a => [...original.rows, ...original.columns].some(o => o.id === a.id)));
    assert.equal(t.cellText(copy, address(copy)), "Keep me");
  }
  assert.notEqual(duplicate.rows[0].id, inserted.rows[0].id);
});

test("T-U13 saved table templates insert twice on an imported board and the room accepts both edits", async () => {
  const t = await tableRules(), b = await board(3, 4);
  const { templateObjects } = await import("../apps/server/src/templates.ts");
  const { templateSnapshot, templateBoard } = await import("../apps/web/src/team/templates-rules.ts");
  const { insertActivity } = await import("../apps/web/src/activities.ts");
  const { evaluate } = await import("../packages/board-room/src/edits.ts");
  const original = t.setCell(b.objects[0], address(b.objects[0]), "Keep me");
  // Hosted import assigns a room ID and preserves the exported page IDs.
  const imported = { ...b, boardId: uuid(), objects: [original] };
  const server = await shared(imported);
  try {
    const { snapshot } = templateSnapshot(imported, new Set(), [{ ...original, displayHeight: original.height }]);
    const stored = templateObjects(JSON.parse(JSON.stringify(snapshot.objects)));
    const template = templateBoard(JSON.parse(JSON.stringify(stored.objects)));
    for (let i = 0; i < 2; i++) {
      const client = await shared(server.doc);
      try {
        const update = client.write(current => insertActivity(current, template,
          { x: 0, y: 0, z: 1 }, { w: 1440, h: 900 }).board);
        const result = evaluate(server.doc, server.read(), update, { all: () => [] });
        assert.equal(result.kind, "complete", result.reason);
        try { Y.applyUpdate(server.doc, result.update); }
        finally { result.doc.destroy(); }
      } finally { client.adapter.destroy(); }
    }
    const tables = server.read().objects;
    assert.equal(tables.length, 3);
    assert.equal(new Set(tables.flatMap(o => [o.id, ...o.rows.map(r => r.id), ...o.columns.map(c => c.id)])).size, 24);
    for (const o of tables) {
      assert.equal(o.page, imported.pages[0].id);
      assert.deepEqual(o.rows.map(r => r.height), original.rows.map(r => r.height));
      assert.deepEqual(o.columns.map(c => c.width), original.columns.map(c => c.width));
      assert.equal(t.cellText(o, address(o)), "Keep me");
    }
  } finally { server.adapter.destroy(); }
});

test("T-U04 shared table codec checks live shape and tombstones, and skips orphan cells", async () => {
  await tableRules();
  const b = await board(), t = b.objects[0], base = await shared(b), key = t.rows[0].id + ":" + t.columns[0].id;
  try {
    assert.deepEqual(base.read(), b);
    const bad = async change => {
      const a = await shared(base.doc);
      try { change(tableMap(a.doc, t.id)); assert.throws(a.read, /invalid_update/); }
      finally { a.adapter.destroy(); }
    };
    for (const change of [
      m => m.set("geometry", {}), m => {m.set("extra", 1); m.delete("extra");}, m => m.delete("place"),
      m => m.set("place", { x: 0.5, y: 0 }), m => m.set("place", { x: 1, y: 0, extra: 1 }),
      m => m.set("tableStyle", {textSize: "huge"}), m => m.set("tableStyle", {}),
      m => m.set("columnMap", {}), m => m.get("rowMap").set(uuid(), {order: "V", height: 64}),
      m => m.get("columnMap").get(t.columns[0].id).set("order", "0"),
      m => m.get("rowMap").get(t.rows[0].id).set("height", 64.5),
      m => m.get("rowMap").get(t.rows[0].id).delete("height"),
      m => m.get("rowMap").get(t.rows[0].id).set("extra", ""),
      m => {m.get("rowMap").set("bad", new Y.Map()); m.get("rowMap").delete("bad");},
      m => m.get("cells").set(key, "bad"), m => m.get("cells").set(key + ":extra", new Y.Text()),
      m => m.get("cells").get(key).insert(0, "e", {bold: true}),
    ]) await bad(change);
    const map = tableMap(base.doc, t.id), orphan = uuid() + ":" + t.columns[0].id, cells = map.get("cells");
    cells.set(orphan, new Y.Text("Hidden"));
    assert.equal(base.read().objects[0].cells.length, 0);
    base.write(b => ({ ...b, title: "Unrelated" }));
    assert(cells.has(orphan));
    base.write(b => withTable(b, t => ({ ...t, x: t.x + 1 })));
    assert(!cells.has(orphan));
  } finally { base.adapter.destroy(); }
});

test("T-U05 table writes touch only the changed values and retain emptied text identity", async () => {
  const k = await tableRules(), b = await board(3, 3), t = b.objects[0], a = await shared(b);
  const m = tableMap(a.doc, t.id), rows = m.get("rowMap"), cols = m.get("columnMap"), cells = m.get("cells");
  const changes = [];
  m.observeDeep(events => changes.push(...events.map(e => [e.path, [...e.keysChanged ?? []]])));
  const cell = address(t), key = k.cellKey(cell), original = cells.get(key), row = uuid();
  try {
    a.write(b => withTable(b, t => k.setCell(t, cell, "a")));
    assert.deepEqual(changes.splice(0), [[["cells", key], []]]);
    a.write(b => withTable(b, t => k.setCell(t, cell, "")));
    assert.equal(cells.get(key), original);
    assert.deepEqual(changes.splice(0), [[["cells", key], []]]);
    a.write(b => withTable(b, t => k.insertAxis(t, "row", row)), { table: t.id, axis: "row", moved: [row] });
    assert.equal(rows.size, 4);
    assert.deepEqual(changes.splice(0).sort(), [[["rowMap"], [row]], [["cells"], t.columns.map(c => row + ":" + c.id)]].sort());
    const col = t.columns[0].id;
    a.write(b => withTable(b, t => k.resizeAxis(t, "column", col, 224)));
    assert.deepEqual(changes.splice(0), [[["columnMap", col], ["width"]]]);
    assert.equal(cols.get(col).get("width"), 224);
    a.write(b => withTable(b, t => ({...t, x: t.x + 4})));
    assert.deepEqual(changes.splice(0), [[[], ["place"]]]);
    a.write(b => withTable(b, t => k.deleteAxis(t, "column", col)));
    assert.equal(changes.find(([path]) => path[0] === "cells")[1].length, 4);
    assert(!cols.has(col));
  } finally { a.adapter.destroy(); }
});

test("T-U06 table races converge through room promotion in both arrival orders", async () => {
  const k = await tableRules(), { evaluate } = await import("../packages/board-room/src/edits.ts");
  const b = await board(), t = b.objects[0], cell = address(t), other = address(t, 1, 1), row = uuid(), row2 = uuid(), col = uuid();
  const change = fn => b => withTable(b, fn);
  const storage = { all: () => [] };
  const cases = [
    [k.setCell.bind(null, t, cell, "A"), k.setCell.bind(null, t, other, "B"), o => assert.deepEqual(o.cells.map(c => c.text), ["A", "B"])],
    [o => k.setCell(o, cell, "A"), o => k.setCell(o, cell, "B"), o => assert.match(k.cellText(o, cell), /^(AB|BA)$/)],
    [o => k.insertAxis(o, "row", row), o => k.insertAxis(o, "row", row2), o => assert.deepEqual(o.rows.slice(2).map(r => r.id), [row, row2].sort())],
    [o => k.resizeAxis(o, "column", cell.column, 230), o => k.resizeAxis(o, "column", cell.column, 260),
      (o, i) => assert.equal(o.columns[0].width, i ? 230 : 260)],
    [o => k.deleteAxis(o, "row", cell.row), o => k.setCell(o, cell, "gone"), o => assert.equal(o.cells.length, 0)],
    [o => k.deleteAxis(o, "row", cell.row), o => k.deleteAxis(o, "row", other.row), null],
    [o => k.insertAxis(o, "row", row), o => k.insertAxis(o, "column", col), async (o, _, merged) => {
      const key = row + ":" + col, cells = m => tableMap(m, t.id).get("cells");
      assert.equal(o.rows.length, 3); assert.equal(o.columns.length, 3); assert(!cells(merged).has(key));
      const first = await shared(merged), second = await shared(merged), init = await shared(merged);
      try {
        init.write(change(o => ({...o, x: o.x + 1})));
        assert(cells(init.doc).get(key) instanceof Y.Text); assert.equal(cells(init.doc).get(key).toString(), "");
        const a = first.write(change(o => k.setCell(o, { row, column: col }, "A")));
        const b = second.write(change(o => k.setCell(o, { row, column: col }, "B")));
        Y.applyUpdate(first.doc, b); Y.applyUpdate(second.doc, a);
        assert.equal(cells(first.doc).get(key).toString(), cells(second.doc).get(key).toString());
        assert.match(cells(first.doc).get(key).toString(), /^[AB]$/);
      } finally { first.adapter.destroy(); second.adapter.destroy(); init.adapter.destroy(); }
    }],
  ];
  for (const [left, right, expect] of cases) for (const i of [0, 1]) {
    const seed = await shared(b), a = await shared(seed.doc), z = await shared(seed.doc);
    try {
      const updates = [a.write(change(left)), z.write(change(right))];
      const first = evaluate(seed.doc, seed.read(), updates[i], storage);
      assert.equal(first.kind, "complete");
      try {
        const second = evaluate(first.doc, first.board, updates[1 - i], storage);
        if (!expect) assert.deepEqual(second, { kind: "refused", reason: "invalid_document" });
        else {
          assert.equal(second.kind, "complete");
          try { await expect(second.board.objects[0], i, second.doc); } finally { second.doc.destroy(); }
        }
      } finally { first.doc.destroy(); }
    } finally { seed.adapter.destroy(); a.adapter.destroy(); z.adapter.destroy(); }
  }
});

test("T-U07 hosted Undo and Redo guard complete table steps, keep restored identities and isolate others' edits", async () => {
  const k = await tableRules(), { SharedUndo, capture } = await import("../packages/board-sync/src/undo.ts");
  const b = await board(), t = b.objects[0], cell = address(t), kept = withTable(b, t => k.setCell(t, cell, "Keep me"));
  for (const mutate of [
    t => k.deleteAxis(t, "row", cell.row), t => k.insertAxis(t, "row", uuid()),
    t => k.resizeAxis(t, "column", cell.column, 224), t => k.setCell(t, cell, "Edited"),
  ]) {
    const a = await shared(kept), undo = new SharedUndo();
    try {
      const before = capture(a.doc);
      a.write(b => withTable(b, mutate)); const after = capture(a.doc);
      undo.record(before, after);
      const restored = undo.take(after, "undo");
      assert.equal(typeof restored, "object");
      a.adapter.set(restored, undefined, undefined, undo.tableHint);
      const undone = capture(a.doc); undo.record(after, undone, "undo");
      assert.deepEqual(undone.board, before.board);
      const redone = undo.take(undone, "redo"); a.adapter.set(redone, undefined, undefined, undo.tableHint);
      assert.deepEqual(a.read(), after.board);
    } finally { a.adapter.destroy(); }
  }
  for (const mode of ["resize", "add", "delete"]) {
    const a = await shared(kept), undo = new SharedUndo(), row = uuid();
    const edit = mode === "resize" ? t => k.resizeAxis(t, "column", cell.column, 230) :
      mode === "add" ? t => k.insertAxis(t, "row", row) : t => k.deleteAxis(t, "row", cell.row);
    const remote = mode === "resize" ? t => k.resizeAxis(t, "column", cell.column, 260) :
      mode === "add" ? t => k.setCell(t, { row, column: cell.column }, "Peer") : t => k.deleteAxis(t, "column", cell.column);
    try {
      const before = capture(a.doc); a.write(b => withTable(b, edit)); const after = capture(a.doc); undo.record(before, after);
      a.write(b => withTable(b, remote)); const current = capture(a.doc); undo.observe(after, current, false);
      assert.equal(undo.take(current, "undo"), "changed_by_others");
    } finally { a.adapter.destroy(); }
  }
  const rules = await document(), mixed = await shared(rules.add(kept, "sticky", 0, 0));
  try {
    const history = new SharedUndo(), before = capture(mixed.doc);
    mixed.write(b => ({ ...b, objects: [k.scaleTable(b.objects[0], 2, 2), { ...b.objects[1], width: 480, height: 480 }] }));
    const after = capture(mixed.doc);
    history.record(before, after);
    const restored = history.take(after, "undo");
    assert.deepEqual(restored.objects, before.board.objects);
  } finally { mixed.adapter.destroy(); }
  const a = await shared(kept), undo = new SharedUndo();
  try {
    const before = capture(a.doc);
    a.write(b => ({ ...b, objects: [], retiredGenerations: [t.generation] }));
    const after = capture(a.doc); undo.record(before, after);
    const restored = undo.take(after, "undo").objects[0];
    assert.notEqual(restored.id, t.id); assert.notEqual(restored.generation, t.generation);
    assert.deepEqual(restored.rows, t.rows); assert.deepEqual(restored.columns, t.columns);
    assert.equal(k.cellText(restored, cell), "Keep me");
  } finally { a.adapter.destroy(); }
});

test("T-U08 layout, placement geometry, hit testing, selection words and editor names", async () => {
  const w = await web(), k = await tableRules(), t = (await board(3, 3)).objects[0];
  const cell = { kind: "cell", id: t.id, ...address(t, 1, 1) };
  const typed = k.setCell(t, cell, "One\nTwo"), measure = text => text.split("\n").length;
  const layout = w.layoutTable(typed, measure);
  assert.deepEqual(layout.rows, [64, 88, 64]);
  assert.deepEqual(w.hitCell(typed, layout, { x: t.x + 200, y: t.y + 65 }), address(t, 1, 1));
  assert.equal(w.hitBorder(typed, layout, { x: t.x + 196, y: t.y + 40 }).id, t.columns[0].id);
  assert.equal(w.hitBorder(typed, layout, { x: t.x + 197, y: t.y + 40 }), undefined);
  const grab = w.tableButtons(t, layout, cell, 1)[0];
  assert.equal(w.hitTableButton(t, layout, cell, { x: grab.x + 14, y: t.y - 14 }).axis, "column");
  const bottom = w.tableButtons(t, layout, { kind: "table", id: t.id }, 1).find(x => x.axis === "row");
  assert.equal(bottom.y, t.y + layout.box.height + 8);
  assert.deepEqual(w.tableGhost({ x: -500, y: -250 }, { x: -100, y: -50 }, true),
    { x: -500, y: -250, width: 576, height: 256, columns: 3, rows: 4 });
  assert.equal(w.tableDimensions({columns:3, rows:4}), "3 × 4");
  assert.equal(w.editorName(t, cell, "table 1"), "Row 2, column 2 of table 1");
  assert.equal(w.announceCell(t, cell), "Row 2, column 2: empty");
  assert.equal(w.validTableSelection(k.deleteAxis(t, "row", cell.row), cell, true, "remote", "ana").notice, "ana deleted a row you were editing.");
  assert.equal(w.validTableSelection(k.deleteAxis(t, "column", cell.column), cell, false, "remote", "ana").notice, "ana deleted a column you had selected.");
  assert.equal(w.validTableSelection(k.deleteAxis(t, "row", cell.row), cell, true, "reload", "ana").notice, "");
  assert.equal(w.validTableSelection(undefined, cell, true, "remote").selection, null);
  assert.equal(w.tableReason(k.createTable(1, 1), "row", "delete"), "A table needs at least one row");
  assert.equal(w.tableReason(k.createTable(20, 50), "column", "add"), "A table holds at most 20 columns");
  assert.equal(w.tableMode(cell, true), "Editing");
  assert.equal(w.tableMode({ kind: "row", row: cell.row, id: t.id }, false), "Row");
});

test("T-U09 physical tool shortcut and selection keys preserve native input and viewers", async () => {
  const w = await web(), r = await import("../packages/board-rules/src/objects/registry.ts"), t = (await board()).objects[0];
  const toolOrder = r.OBJECT_TYPES.flatMap(t => t.tool ? [t.tool] : []);
  assert.equal(toolOrder[toolOrder.indexOf("Section") + 1], "Table");
  assert.equal(r.toolForKey("t"), undefined); assert.equal(r.toolForKey("t", true), "Table");
  const cell = { kind: "cell", id: t.id, ...address(t) }, table = { kind: "table", id: t.id };
  const key = (sel, key, mode = {}, mods = {}) => w.tableKey(t, sel, {
    code: key, key, shiftKey: false, altKey: false, metaKey: false, ctrlKey: false, ...mods,
  }, !!mode.editing, !!mode.viewer, !!mode.composing);
  assert.deepEqual(key(table, "Enter"), { select: address(t) });
  assert.deepEqual(key(table, "Escape"), { exit: true });
  assert.deepEqual(key(cell, "Escape"), { exit: false });
  assert.deepEqual(key(cell, "ArrowLeft"), { consume: true });
  assert.deepEqual(key(cell, "ArrowDown"), { select: address(t, 1, 0) });
  assert.deepEqual(key(cell, "Tab"), { select: address(t, 0, 1) });
  assert.deepEqual(key(cell, "Enter"), { edit: address(t) });
  assert.deepEqual(key(cell, "Enter", {}, { altKey: true, shiftKey: true }), { action: { axis: "row", at: "before" } });
  assert.deepEqual(key(cell, "BracketRight", {}, { altKey: true }), { action: { axis: "column", at: "after" } });
  assert.deepEqual(key(cell, "Delete"), { action: { at: "clear" } });
  for (const axis of ["row", "column"]) {
    const selection = { kind: axis, id: t.id, [axis]: cell[axis] };
    assert.deepEqual(key(selection, "Backspace"), { action: { axis, at: "delete" } });
    for (const letter of ["Enter", "Tab", "ArrowDown"]) assert.deepEqual(key(selection, letter), { consume: true });
  }
  assert.equal(key(cell, "Enter", { editing: true }), undefined);
  assert.equal(key(cell, "ArrowDown", { editing: true }), undefined);
  assert.deepEqual(key(cell, "Tab", { editing: true }), { edit: address(t, 0, 1) });
  assert.deepEqual(key(cell, "Tab", { editing: true }, { shiftKey: true }), { exit: false });
  assert.equal(key(cell, "Tab", { editing: true, composing: true }), undefined);
  assert.equal(key(cell, "Delete", { viewer: true }), undefined);
  assert.deepEqual(w.rebaseComposition("abcd", "Xabcd", 2, "字"), { text: "Xab字cd", caret: 4 });
  assert.deepEqual(w.rebaseComposition("abcd", "ad", 2, "字"), { text: "a字d", caret: 2 });
});

test("T-U10 row growth and each edit, geometry or structure operation are single local history steps", async () => {
  const k = await tableRules(), w = await web(), h = await import("../apps/web/src/history.ts");
  const b = await board(), t = b.objects[0], cell = address(t), measure = text => text.split("\n").length;
  const grown = w.growTable(k.setCell(t, cell, "a\nb"), measure);
  assert.equal(grown.rows[0].height, 88);
  assert.equal(w.growTable(k.setCell(grown, cell, ""), measure).rows[0].height, 88);
  for (const next of [
    b, withTable(b, () => grown), withTable(b, t => k.insertAxis(t, "row", uuid())),
    withTable(b, t => k.deleteAxis(t, "column", cell.column)), withTable(b, t => k.resizeAxis(t, "column", cell.column, 240)),
    withTable(b, t => k.scaleTable(t, 1.25, 1.25)), withTable(b, t => w.growTable({...t,textSize:"large"}, measure)),
    withTable(b, t => k.setCell(grown, cell, "")),
  ]) {
    const before = next === b ? { ...b, objects: [] } : next.objects[0].height === 152 && !next.objects[0].cells.length ? withTable(b, () => grown) : b;
    const history = h.record(h.emptyHistory(), before, next);
    assert.equal(history.past.length, 1);
    const undone = h.undo(next, history);
    assert.deepEqual(undone.board.objects, before.objects);
    assert.equal(h.redo(undone.board, undone.history).board.objects[0].id, t.id);
  }
});

test("T-U11 stored schema 13 pageMap upgrades to 18 through a schema-only snapshot with no edit", async () => {
  await tableRules();
  const { NodeStorage } = await import("../apps/server/src/node-storage.ts"), { Room } = await import("../packages/board-room/src/room.ts");
  const { meta, setMeta } = await import("../packages/board-room/src/storage.ts");
  const { canonical } = await document(), { createHash } = await import("node:crypto");
  const { readBoard } = await import("../packages/board-sync/src/codec.ts");
  const { storedBoardUpdate } = await import("./import-fixture.mjs");
  const id = uuid(), legacy = { schemaVersion: 13, boardId: id, title: "Old room", pages: [{ id, name: "Page 1" }], objects: [], retiredGenerations: [] };
  const storage = new NodeStorage(":memory:"), now = Date.now();
  const env = { storage, lifecycle: { lifecycle: async () => ({ state: "active", generation: 0 }) },
    access: { board: async () => ({ id, title: legacy.title, createdAt: new Date(now).toISOString() }), changes: async () => ({ changes: [], latest: 0, lowestKept: 1 }) },
    now: () => now, fence: async () => 0, hash: async data => createHash("sha256").update(data).digest("hex"),
    randomId: uuid, connections: () => [], schedule: async () => {}, backupLimit: 16777216 };
  const room = new Room(id, env), stored = new Y.Doc();
  try {
    await room.create(legacy);
    const data = storedBoardUpdate(legacy), json = new TextEncoder().encode(canonical(legacy));
    Y.applyUpdate(stored, data);
    assert.throws(() => readBoard(stored, true), /invalid_update/);
    assert.throws(() => readBoard(room.doc, true), /invalid_update/);
    storage.exec("DELETE FROM snapshot_chunks");
    storage.exec("INSERT INTO snapshot_chunks VALUES (0,'yjs',0,?)", data);
    storage.exec("INSERT INTO snapshot_chunks VALUES (0,'json',0,?)", json);
    setMeta(storage, "history_capture_sha256", await env.hash(json)); setMeta(storage, "history_capture_bytes", json.length);
    const tables = () => ["edits", "receipts", "versions", "version_chunks"].map(t => storage.all("SELECT * FROM " + t));
    const before = tables();
    room.initialized = false; await room.load();
    assert.equal(room.board.schemaVersion, 18);
    const delta = Y.decodeUpdate(Y.encodeStateAsUpdate(room.doc, Y.encodeStateVector(stored))).structs;
    assert.equal(delta.length, 1); assert.equal(delta[0].content.getContent()[0], 18);
    await room.history.automatic("last_close");
    assert.deepEqual(tables(), before); assert.equal(meta(storage, "revision"), 0);
    room.initialized = false; await room.load(); assert.equal(room.board.schemaVersion, 18);
  } finally { room.doc.destroy(); stored.destroy(); storage.close(); }
});

async function tableUi(exports) {
  const { build } = await import("esbuild");
  const compiled = await build({
    stdin: { contents: exports, loader: "ts", resolveDir: new URL("../apps/web/src/", import.meta.url).pathname },
    bundle: true, write: false,
    format: "esm", platform: "node", jsx: "automatic", packages: "external",
    plugins: [{ name: "resolve-test-imports", setup(build) {
      build.onResolve({ filter: /^(react(?:\/jsx-runtime)?$|nextphase-board-rules\/)/ },
        args => ({ path: import.meta.resolve(args.path), external: true }));
    } }],
  });
  return import("data:text/javascript;base64," + Buffer.from(compiled.outputFiles[0].text).toString("base64"));
}

test("T-U12 table chrome exposes named buttons, hit sizes and only the permitted selections", async () => {
  const w = await web(), t = (await board()).objects[0];
  const { TableButtons } = await tableUi('export { TableButtons } from "./scene/table-buttons.tsx";');
  const props = { object: { ...t, tableLayout: w.layoutTable(t, () => 1) }, zoom: 1, pos: p => ({ left: p.x, top: p.y }), size: {w:1440,h:900} };
  const buttons = (selection, extra) => TableButtons({ ...props, selection: { id: t.id, ...selection }, ...extra })?.props.children ?? [];
  assert.deepEqual(buttons({ kind: "table" }).map(b => b.props["aria-label"]), ["Add column", "Add row"]);
  const grabs = buttons({ kind: "cell", ...address(t) });
  assert.deepEqual(grabs.map(b => b.props["aria-label"]), ["Select column 1", "Select row 1"]);
  assert(grabs.every(b => b.type === "button" && b.props.style.width >= 28 && b.props.style.height >= 28));
  assert.deepEqual(buttons({ kind: "column", column: t.columns[0].id }).map(b => b.props["aria-label"]), ["Select column 1"]);
  assert.equal(buttons({ kind: "cell", ...address(t) }, {readOnly:true}).length, 0);
  assert.equal(buttons({ kind: "cell", ...address(t) }, {editing:true}).length, 0);
});

test("T-U14 both add bars render 24 px thick and 8 px from the drawn edge", async () => {
  const { layoutTable } = await web(), table = (await board()).objects[0];
  const { TableButtons } = await tableUi('export { TableButtons } from "./scene/table-buttons.tsx";');
  const tableLayout = layoutTable(table, () => 3), { box } = tableLayout;
  for (const zoom of [1, 0.5, 2]) {
    const { props: { children: [right, bottom] } } = TableButtons({
      object: { ...table, tableLayout }, selection: { id: table.id, kind: "table" },
      zoom, pos: ({ x, y }) => ({ left: x * zoom, top: y * zoom }),
    });
    assert.equal(right.props.className, "table-add-bar table-add-column");
    assert.equal(bottom.props.className, "table-add-bar table-add-row");
    assert.deepEqual(right.props.style, {
      left: (box.x + box.width) * zoom + 8, top: box.y * zoom, width: 24, height: box.height * zoom,
    });
    assert.deepEqual(bottom.props.style, {
      left: box.x * zoom, top: (box.y + box.height) * zoom + 8, width: box.width * zoom, height: 24,
    });
  }
  const css = readFileSync(new URL("../apps/web/style.css", import.meta.url), "utf8");
  const addBarRule = css.match(/^\.scene > \.table-add-bar\s*\{([^}]+)\}/m)?.[1] ?? "";
  assert.match(addBarRule, /\bmin-width:\s*0\s*;/);
  assert.match(addBarRule, /\bmin-height:\s*0\s*;/);
  assert.doesNotMatch(css, /\.table-add-(?:bar|column|row)::(?:before|after)\b/);
});

test("T-U15 moving the selected cell updates a polite sr-only status and leaves the visible notice empty", async () => {
  const { createElement, Fragment, useState } = await import("react");
  const { renderToStaticMarkup } = await import("react-dom/server");
  const { useSelection, useCanvasInput, useMessages, Notice, TableCellStatus } = await tableUi(`
    export { useSelection } from "./state/use-selection.ts";
    export { useCanvasInput } from "./state/use-canvas-input.ts";
    export { useMessages } from "./state/use-messages.ts";
    export { Notice } from "./ui/notice.tsx";
    export { TableCellStatus } from "./scene/table-buttons.tsx";
  `);
  const b = withTable(await board(), t => ({ ...t, cells: [{ ...address(t), text: "Ship CSV import" }] }));
  const scene = {};
  function renderAfter(keys) {
    return renderToStaticMarkup(createElement(function Harness() {
      const [step, setStep] = useState(0);
      const { selected, tableSelection, tableAnnouncement, chooseTable, setSelected } = useSelection({ board: b, drafts: {}, textSelection: null });
      const { setMessage, visibleMessage } = useMessages();
      const { sceneKeyDown } = useCanvasInput({
        selected, tableSelection, chooseTable, setMessage, displayedObjects: b.objects, tool: "Select",
        view: { z: 1 }, drag: { current: null }, spacePanRef: { current: false },
      });
      // Server rendering applies these state updates before emitting the final markup.
      if (step === 0) {
        setMessage("");
        setSelected(new Set([b.objects[0].id]));
      } else if (step <= keys.length) {
        sceneKeyDown({ key: keys[step - 1], target: scene, currentTarget: scene, nativeEvent: {},
          preventDefault() {}, stopPropagation() {} });
      }
      if (step <= keys.length) setStep(step + 1);
      return createElement(Fragment, null,
        createElement(Notice, {
          pages: { list: [] }, showNotice: !!visibleMessage, visibleMessage, invalidFields: [],
          busy: false, tool: "Select", readOnly: false, snapshots: [],
        }),
        createElement(TableCellStatus, { announcement: tableAnnouncement }),
      );
    }));
  }
  for (const [keys, announcement] of [
    [["Enter", "ArrowRight"], "Row 1, column 2: empty"],
    [["Enter"], "Row 1, column 1: Ship CSV import"],
    [[], ""],
  ]) {
    const markup = renderAfter(keys);
    assert.match(markup, /<aside class="notice" role="status" hidden=""><\/aside>/);
    assert.ok(markup.includes(`<span class="sr-only" role="status" aria-live="polite" aria-atomic="true">${announcement}</span>`), markup);
  }
});

function legacyTable(b, order = 0, rowCount = 2, columnCount = 2) {
  const columns = Array.from({ length: columnCount }, () => ({ id: uuid(), width: 192 }));
  const rows = Array.from({ length: rowCount }, () => ({ id: uuid(), height: 64 }));
  return { id: uuid(), generation: uuid(), type: "table", page: b.pages[0].id, columns, rows, cells: [],
    textSize: "medium", group: null, section: null, x: 0, y: 0, width: columnCount * 192, height: rowCount * 64, order };
}

function legacyBoard(schemaVersion = 17, count = 1, rows = 2, columns = 2) {
  const boardId = uuid();
  const b = { schemaVersion, boardId, title: "Legacy tables", pages: [{ id: boardId, name: "Page 1" }],
    objects: [], retiredGenerations: [] };
  b.objects = Array.from({ length: count }, (_, i) => legacyTable(b, i, rows, columns));
  return b;
}

function legacyShared(b, rebalance) {
  const doc = new Y.Doc(), { schemaVersion, boardId, title } = b, pages = new Y.Map();
  doc.getMap("board").set("schemaVersion", schemaVersion);
  doc.getMap("board").set("boardId", boardId);
  doc.getMap("board").set("title", title);
  doc.getMap("board").set("pageMap", pages);
  const pageOrder = rebalance(b.pages.map(p => p.id));
  for (const page of b.pages) pages.set(page.id, new Y.Map([["name", page.name], ["order", pageOrder.get(page.id)]]));
  for (const t of b.objects) {
    const orders = (axis, size) => {
      const keys = rebalance(axis.map(entry => entry.id));
      return new Y.Map(axis.map(entry => [entry.id, new Y.Map([["order", keys.get(entry.id)], [size, entry[size]]])]));
    };
    const texts = new Map(t.cells.map(c => [c.row + ":" + c.column, c.text]));
    const cells = new Y.Map(t.rows.flatMap(r => t.columns.map(c => {
      const key = r.id + ":" + c.id;
      return [key, new Y.Text(texts.get(key) ?? "")];
    })));
    const common = ["generation", "type", "page", "order", "group", "section"].map(key => [key, t[key]]);
    doc.getMap("objects").set(t.id, new Y.Map([...common, ["place", { x: t.x, y: t.y }], ["tableStyle", { textSize: t.textSize }],
      ["rowMap", orders(t.rows, "height")], ["columnMap", orders(t.columns, "width")], ["cells", cells]]));
  }
  return doc;
}
const rangeAt = (t, top, left, bottom, right) => ({ from: address(t, top, left), to: address(t, bottom, right) });
const idsAt = (t, axis, ...indices) => indices.map(i => (axis === "row" ? t.rows : t.columns)[i].id);
const fill = (t, rule) => t.rows.reduce((table, _, r) => t.columns.reduce((next, _, c) =>
  rule.setCell(next, address(t, r, c), `R${r + 1}C${c + 1}`), table), t);
const tableStep = (b, t) => withTable(b, () => t);

test("T-U16 document 18 checks merge shape, spans and covered text and writes canonical order", async () => {
  const k = await tableRules(), r = await document(), b = await board(4, 4), t = b.objects[0];
  assert.equal(b.schemaVersion, 18);
  assert.deepEqual(t.merges, []);
  const top = address(t), end = address(t, 2, 2);
  const first = { columns: 2, rows: 2, ...top }, last = { columns: 2, rows: 2, ...end };
  const voice = { ...top, text: "Anchor" };
  const valid = { ...t, merges: [last, first], cells: [voice] };
  const json = JSON.parse(r.canonical(tableStep(b, valid))).objects[0];
  assert.deepEqual(Object.keys(json), ["id", "generation", "type", "page", "columns", "rows", "cells", "merges", "textSize", "group", "section", "x", "y", "width", "height", "order"]);
  assert.deepEqual(json.merges.map(Object.keys), Array(2).fill(["row", "column", "rows", "columns"]));
  assert.deepEqual(json.merges.map(m => m.row), [top.row, end.row]);
  const legacy = legacyBoard();
  assert.throws(() => r.validate({ ...legacy, objects: [{ ...legacy.objects[0], merges: [] }] }), /Invalid object$/);
  assert.throws(() => r.validate({ ...legacy, schemaVersion: 18 }), /Invalid object$/);
  for (const merge of [{ ...first, extra: true }, { ...top, rows: 2 }, { ...first, row: top.column }, { ...first, column: uuid() },
    ...["rows", "columns"].flatMap(key => [0, -1, 1.5, "2"].map(value => ({ ...first, [key]: value }))),
    { ...first, rows: 1, columns: 1 }, { ...last, rows: 3 }, { ...last, columns: 3 }]) {
    assert.throws(() => r.validate(tableStep(b, { ...t, merges: [merge] })), /Invalid object paint/);
  }
  for (const merges of [[first, first], [first, { ...first, ...address(t, 1, 1) }], [first, { ...last, ...address(t, 1, 0) }]]) {
    assert.throws(() => r.validate(tableStep(b, { ...t, merges })), /Invalid object paint/);
  }
  assert.throws(() => r.validate(tableStep(b, { ...valid, cells: [{ ...address(t, 1, 1), text: "Covered" }] })), /Invalid object paint/);
  assert(k.validTable(valid));
});

test("T-U17 merge bounds grow across a chain, merge preserves the anchor and split returns its cells", async () => {
  const k = await tableRules(), b = await board(5, 5), t = fill(b.objects[0], k);
  const first = k.mergeRange(t, rangeAt(t, 0, 1, 1, 1));
  const chain = k.mergeRange(first, rangeAt(t, 1, 2, 1, 3));
  const picked = rangeAt(t, 0, 0, 0, 2);
  const expected = { top: 0, left: 0, bottom: 1, right: 3 };
  assert.deepEqual(k.rangeBounds(chain, picked), expected);
  assert.deepEqual(k.rangeBounds(chain, { from: picked.to, to: picked.from }), expected);
  assert.equal(k.rangeBounds(t, { ...picked, to: { ...picked.to, column: uuid() } }), undefined);
  assert.equal(k.canMerge(t, rangeAt(t, 4, 4, 4, 4)), "single");
  assert.equal(k.canMerge(chain, rangeAt(t, 0, 1, 1, 1)), "single");
  assert.equal(k.canMerge(t, { ...picked, to: { row: uuid(), column: uuid() } }), "invalid");
  assert.equal(k.canMerge(chain, picked), null);
  const merged = k.mergeRange(chain, picked), anchor = address(t), cover = address(t, 1, 2);
  assert.deepEqual(merged.merges, [{ ...anchor, rows: 2, columns: 4 }]);
  assert.deepEqual(k.mergeOf(merged, cover), merged.merges[0]);
  assert.equal(k.cellText(merged, anchor), "R1C1");
  assert.equal(k.cellText(merged, cover), "");
  assert.equal(k.cellText(merged, address(t, 2, 2)), "R3C3");
  assert.equal(k.setCell(merged, cover, "refused"), merged);
  assert.equal(k.cellText(k.setCell(merged, anchor, "kept"), anchor), "kept");
  assert.equal(k.splitMerge(merged, cover), merged);
  assert.equal(k.splitMerge(merged, address(t, 4, 4)), merged);
  const split = k.splitMerge(merged, anchor);
  assert.equal(split.cells, merged.cells);
  assert.deepEqual(split.merges, []);
  const emptyAnchor = k.mergeRange(k.setCell(t, anchor, ""), rangeAt(t, 0, 0, 1, 1));
  assert.equal(k.cellText(emptyAnchor, anchor), "");
  assert.deepEqual(k.mergeRange(t, rangeAt(t, 0, 0, 0, 4)).merges[0], { ...anchor, rows: 1, columns: 5 });
  assert.deepEqual(k.mergeRange(t, rangeAt(t, 0, 1, 4, 2)).merges[0], { ...address(t, 0, 1), rows: 5, columns: 2 });
});

test("T-U18 effective insert gaps, sizes, covered and anchor deletion keep valid merge spans", async () => {
  const k = await tableRules(), t = fill((await board(4, 4)).objects[0], k);
  const merged = k.mergeRange(t, rangeAt(t, 1, 1, 2, 2));
  for (const axis of ["row", "column"]) {
    const entries = axis === "row" ? "rows" : "columns", dim = axis === "row" ? "height" : "width";
    for (const [at, expected, grows] of [[1, 1, false], [2, 2, true], [3, 3, false], [2.9, 2, true], [NaN, 0, false],
      [-2, 2, true], [-1, 3, false], [-Infinity, 0, false], [Infinity, 4, false], [9, 4, false]]) {
      const id = uuid(), next = k.insertAxis(merged, axis, id, at, 80.4);
      assert.deepEqual(next[entries][expected], { id, [dim]: 80 });
      assert.equal(next.merges[0][entries], grows ? 3 : 2);
      assert(k.validTable(next));
    }
    for (const size of [63, 63.9, 1000.1, 1001, NaN, Infinity, "80"]) {
      assert.equal(k.insertAxis(merged, axis, uuid(), 2, size), merged);
    }
    for (const size of [64, 1000]) assert.equal(k.insertAxis(merged, axis, uuid(), 2, size)[entries][2][dim], size);
    assert.equal(k.insertAxis(merged, axis, uuid())[entries].at(-1)[dim], axis === "row" ? 64 : 192);
    assert.equal(k.insertAxis(merged, axis, t.rows[1].id), merged);
    const shrunk = k.deleteAxis(merged, axis, merged[entries][2].id);
    assert.equal(shrunk.merges[0][entries], 1);
    assert.equal(shrunk.merges[0][axis], merged.merges[0][axis]);
    const moved = k.deleteAxis(merged, axis, merged[entries][1].id);
    assert.equal(moved.merges[0][axis], merged[entries][2].id);
    assert.equal(k.cellText(moved, moved.merges[0]), "");
    assert(k.validTable(moved));
    const only = axis === "row" ? k.mergeRange(t, rangeAt(t, 1, 1, 1, 2)) : k.mergeRange(t, rangeAt(t, 1, 1, 2, 1));
    assert.deepEqual(k.deleteAxis(only, axis, only[entries][1].id).merges, []);
    const oneCell = axis === "row" ? k.mergeRange(t, rangeAt(t, 1, 1, 2, 1)) : k.mergeRange(t, rangeAt(t, 1, 1, 1, 2));
    assert.deepEqual(k.deleteAxis(oneCell, axis, oneCell[entries][2].id).merges, []);
    const single = k.createTable(1, 1);
    assert.equal(k.deleteAxis(single, axis, single[entries][0].id), single);
  }
});

test("T-U19 moving and duplicating axis runs preserve text, set sizes and whole merges", async () => {
  const k = await tableRules(), t = fill((await board(5, 5)).objects[0], k);
  const merged = k.mergeRange(t, rangeAt(t, 1, 1, 2, 2));
  for (const axis of ["row", "column"]) {
    const entries = axis === "row" ? "rows" : "columns", id = i => merged[entries][i].id;
    assert.equal(k.canMove(merged, axis, [uuid()], 0), "invalid");
    assert.equal(k.canMove(merged, axis, [id(1), id(1)], 0), "invalid");
    assert.equal(k.canMove(merged, axis, [id(0)], 2.5), "invalid");
    assert.equal(k.canMove(merged, axis, [id(0), id(2)], 5), "notRun");
    for (const gap of [-1, 0, 1, 6]) assert.equal(k.canMove(merged, axis, [id(0)], gap), "edge");
    assert.equal(k.canMove(merged, axis, [id(0)], 2), "merge");
    assert.equal(k.canMove(merged, axis, [id(1)], 4), "merge");
    assert.equal(k.canDuplicate(merged, axis, [id(1)]), "merge");
    assert.equal(k.canDuplicate(merged, axis, [id(1), id(3)]), "notRun");
    const limit = axis === "row" ? k.createTable(2, 49) : k.createTable(19, 2);
    assert.equal(k.canDuplicate(limit, axis, [limit[entries][0].id, limit[entries][2].id]), "limit");
    for (const [picked, gap, expected] of [[[1, 2], 0, [1, 2, 0, 3, 4]], [[1, 2], 5, [0, 3, 4, 1, 2]],
      [[3], 4, [0, 1, 2, 3, 4]], [[3], 5, [0, 1, 2, 4, 3]], [[4], 3, [0, 1, 2, 4, 3]], [[0], 3, [1, 2, 0, 3, 4]]]) {
      const next = k.moveAxis(merged, axis, picked.map(id), gap);
      assert.deepEqual(next[entries].map(e => e.id), expected.map(id));
      assert.equal(next.cells, merged.cells);
      assert.equal(next.merges, merged.merges);
      assert(k.validTable(next));
    }
    const copies = [uuid(), uuid()], duplicate = k.duplicateAxis(merged, axis, [id(2), id(1)], () => copies.shift());
    const copied = duplicate[entries].slice(3, 5);
    assert.deepEqual(copied.map(({ id: _id, ...size }) => size), merged[entries].slice(1, 3).map(({ id: _id, ...size }) => size));
    assert.deepEqual(duplicate.merges[1], { ...merged.merges[0], [axis]: copied[0].id });
    assert.equal(k.cellText(duplicate, duplicate.merges[1]), "R2C2");
    assert.equal(k.duplicateAxis(merged, axis, [id(0)], () => merged.columns[0].id), merged);
    assert.equal(k.duplicateAxis(merged, axis, [id(1), id(2)], () => "bad"), merged);
    assert(k.validTable(duplicate));
  }
  const copied = k.remapTable(merged);
  assert.deepEqual(copied.merges, [{ ...address(copied, 1, 1), rows: 2, columns: 2 }]);
  assert.equal(k.cellText(copied, copied.merges[0]), "R2C2");
});

test("T-U20 Tab and arrows visit each merged cell once and top-left layout grows the last row only", async () => {
  const k = await tableRules(), w = await web(), t = (await board(4, 4)).objects[0];
  const anchor = address(t, 1, 1), covered = address(t, 2, 2);
  const merged = k.setCell(k.mergeRange(t, rangeAt(t, 1, 1, 2, 2)), anchor, "A\nB\nC\nD\nE");
  const cases = { ArrowDown: [3, 1], ArrowUp: [0, 1], ArrowLeft: [1, 0], ArrowRight: [1, 3] };
  for (const [arrow, [row, column]] of Object.entries(cases)) {
    assert.deepEqual(k.neighbourCell(merged, anchor, arrow), address(t, row, column));
    assert.deepEqual(k.neighbourCell(merged, covered, arrow), address(t, row, column));
  }
  assert.equal(k.neighbourCell(merged, address(t), "ArrowUp"), undefined);
  assert.deepEqual(k.neighbourCell(merged, address(t, 3, 2), "ArrowUp"), anchor);
  assert.deepEqual(k.nextCell(merged, anchor, 1), address(t, 1, 3));
  assert.deepEqual(k.nextCell(merged, covered, -1), address(t, 1, 0));
  assert.deepEqual(k.nextCell(merged, address(t, 1, 0), 1), anchor);
  const measure = text => text.split("\n").length;
  const layout = w.layoutTable(merged, measure);
  assert.deepEqual(layout.rows, [64, 64, 96, 64]);
  assert.deepEqual(layout.unmerged, [64, 64, 64, 64]);
  assert.deepEqual(w.growTable(merged, measure).rows, t.rows);
});

test("T-U21 codec validates mergeMap shape before document validation and reads anchors canonically", async () => {
  const k = await tableRules(), r = await document(), b = await board(4, 4), t = b.objects[0];
  const doc = await shared(tableStep(b, { ...t, merges: [{ ...address(t, 2, 2), rows: 2, columns: 2 }, { ...address(t), rows: 2, columns: 2 }] }));
  const key = k.cellKey(address(t)), other = k.cellKey(address(t, 1, 1));
  const { rebalance } = await import("../packages/board-sync/src/order-keys.ts");
  const { readBoard } = await import("../packages/board-sync/src/codec.ts");
  const { capture } = await import("../packages/board-sync/src/undo.ts");
  try {
    assert.deepEqual(doc.read().objects[0].merges.map(k.cellKey), [key, k.cellKey(address(t, 2, 2))]);
    const legacy = legacyShared(legacyBoard(), rebalance);
    const object = [...legacy.getMap("objects").values()][0];
    try {
      assert.equal(Object.hasOwn(readBoard(legacy).objects[0], "merges"), false);
      object.set("mergeMap", new Y.Map()); assert.throws(() => readBoard(legacy), /invalid_update/);
      object.delete("mergeMap"); assert.throws(() => readBoard(legacy), /invalid_update/);
    } finally { legacy.destroy(); }
    for (const mutate of [m => m.delete("mergeMap"), m => m.set("mergeMap", {}),
      m => { m.get("mergeMap").set("bad", { rows: 2, columns: 2 }); m.get("mergeMap").delete("bad"); },
      ...[{ rows: 2 }, { rows: 2, columns: 1, extra: 1 }, { rows: 1.5, columns: 1 }, new Y.Map([["rows", 2], ["columns", 2]])]
        .map(value => m => m.get("mergeMap").set(key, value))]) {
      const bad = await shared(doc.doc);
      try { mutate(tableMap(bad.doc, t.id)); assert.throws(bad.read, /invalid_update/); } finally { bad.adapter.destroy(); }
    }
    for (const mutate of [m => m.get("mergeMap").set(key, { rows: 1, columns: 1 }),
      m => m.get("mergeMap").set(key, { rows: 2, columns: 5 }), m => m.get("mergeMap").set(other, { rows: 2, columns: 1 }),
      m => m.get("mergeMap").set(uuid() + ":" + t.columns[0].id, { rows: 1, columns: 2 }),
      m => m.get("mergeMap").set(t.rows[0].id + ":" + uuid(), { rows: 1, columns: 2 }),
      m => m.get("cells").get(other).insert(0, "covered")]) {
      const bad = await shared(doc.doc);
      try {
        mutate(tableMap(bad.doc, t.id)); assert.throws(() => r.validate(bad.read()), /Invalid object paint/);
        assert.throws(() => capture(bad.doc), /invalid_document/);
      } finally { bad.adapter.destroy(); }
    }
  } finally { doc.adapter.destroy(); }
});

test("T-U22 writer updates merges and covered texts atomically, writes only moved order keys and cleans fallback intersections", async () => {
  const k = await tableRules(), r = await document(), seed = await board(4, 6), b = withTable(seed, t => fill(t, k));
  const sharedBoard = await shared(b), t = b.objects[0], map = tableMap(sharedBoard.doc, t.id);
  const paths = [];
  map.observeDeep(events => paths.push(events.map(e => [e.path, [...e.keysChanged ?? []]])));
  try {
    const old = rangeAt(t, 0, 1, 0, 2), big = rangeAt(t, 0, 0, 1, 2);
    sharedBoard.write(b => withTable(b, t => k.mergeRange(t, old)));
    paths.length = 0;
    sharedBoard.write(b => withTable(b, t => k.mergeRange(t, big)));
    assert.equal(paths.length, 1);
    const changes = paths.pop();
    assert.deepEqual(new Set(changes.find(([path]) => path[0] === "mergeMap")[1]),
      new Set([k.cellKey(old.from), k.cellKey(big.from)]));
    assert.equal(changes.filter(([p]) => p[0] === "cells").length, 4);
    assert.equal(map.get("cells").get(k.cellKey(address(t, 1, 1))).toString(), "");
    sharedBoard.write(b => b);
    assert.equal(paths.length, 0);
    sharedBoard.write(b => withTable(b, t => k.splitMerge(t, big.from)));
    assert.deepEqual(paths.pop(), [[["mergeMap"], [k.cellKey(big.from)]]]);
    for (const count of [1, 3]) {
      const live = sharedBoard.read().objects[0], moved = live.rows.slice(0, count).map(row => row.id);
      sharedBoard.write(b => withTable(b, t => k.moveAxis(t, "row", moved, t.rows.length)), { table: t.id, axis: "row", moved });
      assert.deepEqual(paths.pop().sort(), moved.map(id => [["rowMap", id], ["order"]]).sort());
    }
    const live = sharedBoard.read().objects[0], moved = idsAt(live, "row", 2);
    const orphan = uuid() + ":" + live.columns[0].id, missing = k.cellKey(address(live, 0, 2));
    map.get("cells").delete(missing); map.get("cells").set(orphan, new Y.Text("old"));
    paths.length = 0;
    sharedBoard.write(b => withTable(b, t => k.moveAxis(t, "row", moved, 0)), { table: t.id, axis: "row", moved });
    assert.deepEqual(new Set(paths.pop().find(([path]) => path[0] === "cells")[1]), new Set([orphan, missing]));
    assert(map.get("cells").get(missing) instanceof Y.Text);
    for (const order of ["tie", "rebalance"]) {
      const rows = map.get("rowMap"), t = sharedBoard.read().objects[0];
      const low = "1".repeat(64), high = low.slice(0, -1) + "2";
      rows.get(t.rows[0].id).set("order", order === "tie" ? "A" : low);
      rows.get(t.rows[1].id).set("order", order === "tie" ? "A" : high);
      const current = sharedBoard.read().objects[0], moving = [current.rows[3].id];
      paths.length = 0;
      const expected = k.moveAxis(current, "row", moving, 1);
      sharedBoard.write(b => tableStep(b, expected), { table: t.id, axis: "row", moved: moving });
      assert.deepEqual(sharedBoard.read().objects[0].rows, expected.rows);
      assert(paths.pop().filter(([path]) => path[0] === "rowMap").length > 1);
    }
    const current = sharedBoard.read().objects[0], target = rangeAt(current, 0, 0, 1, 1);
    sharedBoard.write(b => withTable(b, t => k.mergeRange(t, target)));
    const newRow = uuid(), base = sharedBoard.read().objects[0];
    sharedBoard.write(b => withTable(b, t => k.insertAxis(t, "row", newRow, 1)), { table: t.id, axis: "row", moved: [newRow] });
    assert.equal(map.get("mergeMap").get(k.cellKey(target.from)).rows, 3);
    const copyRows = [uuid(), uuid(), uuid()], ids = base.rows.slice(0, 2).map(row => row.id);
    ids.splice(1, 0, newRow);
    let i = 0;
    sharedBoard.write(b => withTable(b, t => k.duplicateAxis(t, "row", ids, () => copyRows[i++])), { table: t.id, axis: "row", moved: copyRows });
    const after = sharedBoard.read();
    assert.deepEqual(after.objects[0].rows.slice(3, 6).map(row => row.id), copyRows);
    assert.deepEqual(map.get("mergeMap").get(copyRows[0] + ":" + target.from.column), { rows: 3, columns: 2 });
    assert(r.validate(after));
  } finally { sharedBoard.adapter.destroy(); }
});

async function tableClients(t, initial) {
  const { BoardSession, encode, decode } = await import("../packages/board-sync/src/session.ts");
  const { evaluate } = await import("../packages/board-room/src/edits.ts");
  const server = await shared(initial);
  t.after(() => server.adapter.destroy());
  let revision = 0;
  const clients = [];
  async function join(clientId) {
    const client = { sent: [], reports: [], joins: 0, deliver: message => client.handlers.message(JSON.stringify(message)) };
    client.session = await BoardSession.join({ clientId, clock: { now: () => 0, after: () => () => {} }, ticket: async () => "ticket",
      open: async () => ({
        send: text => client.sent.push(JSON.parse(text)), close() {}, listen(handlers) {
          client.handlers = handlers;
          client.joins++;
          client.deliver({ kind: "joined", role: "editor", epoch: 1, restoreGeneration: 0, revision, self: {}, present: [],
            update: encode(Y.encodeStateAsUpdate(server.doc)) });
        },
      }) });
    client.session.subscribe(event => client.reports.push(event));
    client.edit = (fn, { axis, moved } = {}) => client.session.edit(withTable(client.session.board, fn), undefined, undefined,
      undefined, axis ? { table: initial.objects[0].id, axis, moved } : undefined);
    clients.push(client);
    t.after(() => client.session.close());
    return client;
  }
  function accept(client, delivery = {}) {
    const frame = client.sent.shift();
    assert.equal(frame.kind, "edit");
    const result = evaluate(server.doc, server.read(), decode(frame.update), { all: () => [] });
    if (result.kind === "refused") {
      client.deliver({ kind: "refused", requestId: frame.requestId, reason: result.reason });
      return result;
    }
    assert.equal(result.kind, "complete");
    Y.applyUpdate(server.doc, result.update);
    result.doc.destroy();
    revision++;
    for (const peer of clients) {
      if (delivery.skip === peer) continue;
      const own = peer === client;
      const data = own && delivery.append ? Y.mergeUpdates([delivery.append, result.update]) : result.update;
      peer.deliver({ kind: own ? "saved" : "update", requestId: frame.requestId, revision, connection: "ana", update: encode(data) });
    }
    return result;
  }
  return { join, accept, server, converge() { for (const { session } of clients) assert.deepEqual(session.board, server.read()); } };
}

test("T-U23 room accepts independent axis edits and refuses the later move or typing that violates a merge", async test => {
  const k = await tableRules(), r = await document();
  // Use stable ids in actual client sessions and room evaluation for both orders.
  for (const kind of ["moves", "move and insert", "merge and insert", "merge and move text", "merge and type"]) for (const reverse of [false, true]) {
    const seed = await board(4, 6), b = kind === "merge and move text"
      ? withTable(seed, t => k.setCell(t, address(t, 4, 0), "Must survive")) : seed;
    const t = b.objects[0], mesh = await tableClients(test, b), a = await mesh.join(11), z = await mesh.join(22);
    const merge = rangeAt(t, 1, 0, 2, 1), inserted = uuid();
    const moveA = idsAt(t, "row", 0), moveZ = idsAt(t, "row", 4);
    if (kind === "moves" || kind === "move and insert") {
      a.edit(t => k.moveAxis(t, "row", moveA, 3), { axis: "row", moved: moveA });
    } else a.edit(t => k.mergeRange(t, merge));
    if (kind === "moves") z.edit(t => k.moveAxis(t, "row", moveZ, 6), { axis: "row", moved: moveZ });
    else if (kind.endsWith("insert")) z.edit(t => k.insertAxis(t, "row", inserted, kind.startsWith("merge") ? 2 : 5), { axis: "row", moved: [inserted] });
    else if (kind === "merge and move text") z.edit(t => k.moveAxis(t, "row", moveZ, 2), { axis: "row", moved: moveZ });
    else z.edit(t => k.setCell(t, merge.to, "Concurrent typing"));
    const order = reverse ? [z, a] : [a, z];
    assert.equal(mesh.accept(order[0]).kind, "complete");
    const final = mesh.accept(order[1]);
    if (kind === "merge and type" || kind === "merge and move text") {
      assert.deepEqual(final, { kind: "refused", reason: "invalid_document" });
      await new Promise(setImmediate);
      assert.equal(order[1].joins, 2);
    } else {
      assert.equal(final.kind, "complete");
      const live = mesh.server.read().objects[0];
      if (kind === "moves") assert.deepEqual(live.rows.map(row => row.id), idsAt(t, "row", 1, 2, 0, 3, 5, 4));
      if (kind === "move and insert") assert.deepEqual(live.rows.map(row => row.id), [...idsAt(t, "row", 1, 2, 0, 3, 4), inserted, t.rows[5].id]);
      if (kind === "merge and insert") {
        assert.equal(live.rows[2].id, inserted);
        assert.deepEqual(live.merges, [{ ...merge.from, rows: 2, columns: 2 }]);
      }
    }
    assert(r.validate(mesh.server.read()));
    mesh.converge();
  }
});

test("T-U24 competing merges use save order and malformed or invalid room changes keep the stored board", async test => {
  const k = await tableRules(), { evaluate } = await import("../packages/board-room/src/edits.ts");
  const b = await board(4, 4), t = b.objects[0];
  for (const [first, second, outcome] of [
    [rangeAt(t, 0, 0, 0, 1), rangeAt(t, 0, 0, 1, 0), "same anchor"],
    [rangeAt(t, 0, 0, 1, 1), rangeAt(t, 1, 1, 2, 2), "overlap"],
    [rangeAt(t, 0, 0, 1, 1), rangeAt(t, 2, 2, 3, 3), "disjoint"],
  ]) for (const reverse of [false, true]) {
    const mesh = await tableClients(test, b), a = await mesh.join(15), z = await mesh.join(24);
    a.edit(t => k.mergeRange(t, first)); z.edit(t => k.mergeRange(t, second));
    const [x, y] = reverse ? [z, a] : [a, z];
    assert.equal(mesh.accept(x).kind, "complete");
    const answer = mesh.accept(y), live = mesh.server.read().objects[0];
    if (outcome === "overlap") {
      assert.deepEqual(answer, { kind: "refused", reason: "invalid_document" });
      assert.deepEqual(live.merges, k.mergeRange(t, reverse ? second : first).merges);
      await new Promise(setImmediate);
    } else {
      assert.equal(answer.kind, "complete");
      assert.deepEqual(live.merges, (outcome === "same anchor" ? k.mergeRange(t, reverse ? first : second)
        : k.mergeRange(k.mergeRange(t, first), second)).merges);
    }
    mesh.converge();
  }
  const baseRange = rangeAt(t, 1, 1, 1, 2), grew = rangeAt(t, 1, 1, 2, 2);
  for (const reverse of [false, true]) {
    const mesh = await tableClients(test, tableStep(b, k.mergeRange(t, baseRange)));
    const a = await mesh.join(15), z = await mesh.join(24);
    a.edit(t => k.mergeRange(t, grew)); z.edit(t => k.splitMerge(t, baseRange.from));
    for (const client of reverse ? [z, a] : [a, z]) assert.equal(mesh.accept(client).kind, "complete");
    assert.deepEqual(mesh.server.read().objects[0].merges, [{ ...baseRange.from, rows: 2, columns: 2 }]);
    mesh.converge();
  }
  const replacement = rangeAt(t, 0, 0, 1, 2);
  for (const reverse of [false, true]) {
    const original = tableStep(b, k.mergeRange(t, baseRange));
    const mesh = await tableClients(test, original), a = await mesh.join(15), z = await mesh.join(24);
    const other = rangeAt(t, 0, 1, 2, 2);
    a.edit(t => k.mergeRange(t, replacement));
    z.edit(t => k.mergeRange(t, other));
    const [first, last] = reverse ? [z, a] : [a, z];
    assert.equal(mesh.accept(first).kind, "complete");
    assert.deepEqual(mesh.accept(last), { kind: "refused", reason: "invalid_document" });
    assert.deepEqual(mesh.server.read().objects[0].merges, k.mergeRange(original.objects[0], reverse ? other : replacement).merges);
    await new Promise(setImmediate);
    mesh.converge();
  }
  const full = await board(2, 49), mesh = await tableClients(test, full);
  const a = await mesh.join(15), z = await mesh.join(24), first = uuid(), second = uuid();
  a.edit(t => k.insertAxis(t, "row", first, 4), { axis: "row", moved: [first] });
  z.edit(t => k.insertAxis(t, "row", second, 6), { axis: "row", moved: [second] });
  assert.equal(mesh.accept(a).kind, "complete");
  assert.deepEqual(mesh.accept(z), { kind: "refused", reason: "invalid_document" });
  assert.equal(mesh.server.read().objects[0].rows.length, 50);
  assert.equal(mesh.server.read().objects[0].rows[4].id, first);
  await new Promise(setImmediate);
  mesh.converge();
  const original = await shared(tableStep(b, k.mergeRange(t, baseRange)));
  test.after(() => original.adapter.destroy());
  for (const [mutate, reason] of [
    [m => m.get("mergeMap").set("bad", { rows: 1, columns: 2 }), "invalid_update"],
    [m => m.get("mergeMap").set(k.cellKey(address(t, 1, 0)), { rows: 1, columns: 2 }), "invalid_document"],
    [m => m.get("cells").get(k.cellKey(baseRange.to)).insert(0, "invalid"), "invalid_document"],
  ]) {
    const peer = await shared(original.doc);
    try {
      const vector = Y.encodeStateVector(peer.doc), snapshot = Y.encodeStateAsUpdate(original.doc);
      mutate(tableMap(peer.doc, t.id));
      assert.deepEqual(evaluate(original.doc, original.read(), Y.encodeStateAsUpdate(peer.doc, vector), { all: () => [] }), { kind: "refused", reason });
      assert.deepEqual(Y.encodeStateAsUpdate(original.doc), snapshot);
    } finally { peer.adapter.destroy(); }
  }
});

test("T-U25 invalid optimistic merge holds the client and a valid update or saved releases it", async test => {
  const k = await tableRules(), { capture } = await import("../packages/board-sync/src/undo.ts");
  for (const recovery of ["refusal", "update", "saved", "reconcile throws"]) {
    const seed = await board(4, 4), t = seed.objects[0], mesh = await tableClients(test, seed);
    const a = await mesh.join(12), b = await mesh.join(30);
    const ra = rangeAt(t, 0, 0, 1, 1), rb = rangeAt(t, 1, 1, 2, 2);
    a.edit(t => k.mergeRange(t, ra)); b.edit(t => k.mergeRange(t, rb));
    const old = b.session.board, events = b.reports.length;
    assert.equal(mesh.accept(a).kind, "complete");
    assert.throws(() => capture(b.session.doc), /invalid_document/);
    assert.deepEqual(b.session.board, old);
    assert.equal(b.reports.length, events);
    assert.equal(b.edit(t => t), "join_required");
    assert.equal(b.session.undo(), "join_required");
    assert.equal(b.session.redo(), "join_required");
    assert.equal(b.sent.length, 1);
    if (recovery === "refusal") {
      assert.deepEqual(mesh.accept(b), { kind: "refused", reason: "invalid_document" });
      await new Promise(setImmediate);
      assert.equal(b.joins, 2);
    } else {
      if (recovery === "reconcile throws") b.session.history.observe = () => { throw Error("Cannot reconcile"); };
      a.edit(t => k.splitMerge(t, ra.from));
      const split = mesh.accept(a, recovery === "saved" ? { skip: b } : undefined);
      assert.equal(split.kind, "complete");
      if (recovery === "reconcile throws") {
        await new Promise(setImmediate);
        assert.equal(b.joins, 2);
        continue;
      }
      if (recovery === "update") {
        assert.equal(b.reports.length, events + 1);
        assert.equal(b.session.change.origin, "remote");
        assert.deepEqual(b.session.board.objects[0].merges, k.mergeRange(t, rb).merges);
      } else assert.equal(b.reports.length, events);
      assert.equal(mesh.accept(b, recovery === "saved" ? { append: split.update } : undefined).kind, "complete");
      assert.equal(b.session.change.origin, "own");
      assert.equal(b.joins, 1);
    }
    mesh.converge();
  }
});

test("T-U26 hosted Undo restores all replaced merges and texts in one step and refuses a stale split", async test => {
  const k = await tableRules(), r = await document();
  for (const largerAnchor of ["same", "different"]) {
    const seed = await board(4, 4), t = fill(seed.objects[0], k);
    const oldRange = rangeAt(t, 1, 1, 1, 2), small = k.mergeRange(t, oldRange);
    const wanted = largerAnchor === "same" ? rangeAt(t, 1, 1, 2, 2) : rangeAt(t, 0, 0, 2, 2);
    const b = tableStep(seed, small), mesh = await tableClients(test, b), a = await mesh.join(17), z = await mesh.join(18);
    a.edit(t => k.mergeRange(t, wanted));
    assert.equal(mesh.accept(a).kind, "complete");
    const expanded = mesh.server.read();
    assert.equal(a.session.history.past.length, 1);
    assert(a.session.requests.has(a.session.undo()));
    assert.equal(mesh.accept(a).kind, "complete");
    assert.equal(r.canonical(mesh.server.read()), r.canonical(b));
    assert(a.session.requests.has(a.session.redo()));
    assert.equal(mesh.accept(a).kind, "complete");
    assert.deepEqual(mesh.server.read(), expanded);
    a.edit(t => k.splitMerge(t, wanted.from)); assert.equal(mesh.accept(a).kind, "complete");
    z.edit(t => k.setCell(t, wanted.to, "Peer typed here")); assert.equal(mesh.accept(z).kind, "complete");
    assert.equal(a.session.undo(), "undo_invalid");
    assert.equal(a.sent.length, 0);
    mesh.converge();
  }
  const seed = await board(3, 4), t = seed.objects[0], at = address(t, 1, 1);
  const b = tableStep(seed, k.setCell(t, at, "Restore this"));
  const rewritten = await tableClients(test, b), owner = await rewritten.join(17), editor = await rewritten.join(18);
  owner.edit(t => k.mergeRange(t, rangeAt(t, 0, 1, 1, 1)));
  assert.equal(rewritten.accept(owner).kind, "complete");
  editor.edit(t => k.mergeRange(t, rangeAt(t, 0, 1, 2, 1)));
  assert.equal(rewritten.accept(editor).kind, "complete");
  assert.equal(owner.session.undo(), "changed_by_others");
  assert.equal(owner.sent.length, 0);
  rewritten.converge();

  const mesh = await tableClients(test, b), a = await mesh.join(15), z = await mesh.join(25);
  a.edit(t => k.mergeRange(t, rangeAt(t, 0, 1, 1, 1)));
  assert.equal(mesh.accept(a).kind, "complete");
  // The other peer can submit a move planned before seeing the merge.
  const moved = [at.row];
  z.edit(t => ({ ...t, rows: [t.rows[0], t.rows[2], t.rows[1], t.rows[3]] }), { axis: "row", moved });
  assert.equal(mesh.accept(z).kind, "complete");
  z.edit(t => k.mergeRange(t, rangeAt(t, 2, 0, 2, 1)));
  assert.equal(mesh.accept(z).kind, "complete");
  const saved = mesh.server.read();
  assert.equal(a.session.undo(), "changed_by_others");
  assert.equal(a.sent.length, 0);
  assert.deepEqual(mesh.server.read(), saved);
  mesh.converge();
});

test("T-U27 hosted axis Undo restores row orders, ids and merge entries atomically", async () => {
  const k = await tableRules(), r = await document(), { SharedUndo, capture } = await import("../packages/board-sync/src/undo.ts");
  const b = await board(4, 5), t = k.mergeRange(fill(b.objects[0], k), rangeAt(b.objects[0], 1, 0, 2, 1));
  const base = tableStep(b, t), run = idsAt(t, "row", 1, 2), inserted = uuid(), copies = [uuid(), uuid()];
  for (const [change, moved] of [
    [t => k.moveAxis(t, "row", run, 5), run],
    [t => { let i = 0; return k.duplicateAxis(t, "row", run, () => copies[i++]); }, copies],
    [t => k.insertAxis(t, "row", inserted, 2), [inserted]],
    [t => k.deleteAxis(t, "row", t.rows[1].id), undefined],
  ]) {
    const a = await shared(base), undo = new SharedUndo();
    try {
      const before = capture(a.doc);
      a.write(b => withTable(b, change), moved ? { table: t.id, axis: "row", moved } : undefined);
      const after = capture(a.doc); undo.record(before, after);
      const restored = undo.take(after, "undo");
      assert.equal(typeof restored, "object", String(restored));
      a.adapter.set(restored, undefined, undefined, undo.tableHint);
      assert.equal(r.canonical(a.read()), r.canonical(base));
      assert.equal(undo.past.length, 0);
    } finally { a.adapter.destroy(); }
  }
});

async function legacyRoom(test, legacy) {
  const { createHash } = await import("node:crypto"), { Room } = await import("../packages/board-room/src/room.ts");
  const { NodeStorage } = await import("../apps/server/src/node-storage.ts"), { setMeta } = await import("../packages/board-room/src/storage.ts");
  const { rebalance } = await import("../packages/board-sync/src/order-keys.ts"), r = await document();
  const storage = new NodeStorage(":memory:"), id = legacy.boardId, now = 1795676400000;
  const env = { storage, lifecycle: { lifecycle: async () => ({ state: "active", generation: 0 }) },
    access: { board: async () => ({ id, title: legacy.title, createdAt: new Date(now).toISOString() }),
      role: async () => "owner", changes: async () => ({ changes: [], latest: 0, lowestKept: 1 }) },
    now: () => now, fence: async () => 0, raiseFence: async floor => floor + 1,
    hash: async data => createHash("sha256").update(data).digest("hex"),
    randomId: uuid, connections: () => [], schedule: async () => {} };
  const room = new Room(id, env), old = legacyShared(legacy, rebalance);
  test.after(() => { room.doc.destroy(); old.destroy(); storage.close(); });
  await room.create();
  const prepared = await room.history.prepare(legacy), revision = 0;
  storage.transaction(() => {
    storage.exec("DELETE FROM snapshot_chunks");
    for (const [kind, value] of [["yjs", Y.encodeStateAsUpdate(old)], ["json", prepared.data]]) {
      for (let offset = 0; offset < value.length; offset += 1048576) storage.exec(
        "INSERT INTO snapshot_chunks VALUES (?,?,?,?)", revision, kind, offset / 1048576, value.slice(offset, offset + 1048576));
    }
    setMeta(storage, "history_capture_sha256", prepared.sha256);
    setMeta(storage, "history_capture_bytes", prepared.data.length);
    for (const o of legacy.objects) storage.exec("INSERT INTO identifiers VALUES (?,?,0)", o.id, o.generation);
  });
  room.initialized = false; await room.load();
  return { room, old, storage, r, prepared, person: { id: uuid(), email: "owner@example.test", expiresAt: Number.MAX_SAFE_INTEGER } };
}

function sizedLegacyTableBoard(r, size) {
  const b = legacyBoard(17, 3, 50, 20);
  let remaining = size - r.payloadBytes(JSON.stringify(b));
  for (const table of b.objects) for (const row of table.rows) for (const column of table.columns) {
    const at = { row: row.id, column: column.id, text: "" };
    const overhead = Buffer.byteLength(JSON.stringify(at)) + Number(table.cells.length > 0);
    if (remaining > overhead + 1) {
      const added = Math.min(1000, remaining - overhead);
      table.cells.push({ ...at, text: "x".repeat(added) });
      remaining -= overhead + added;
    }
  }
  if (remaining > 0) {
    const first = b.objects[0].cells[0];
    first.text = "é".repeat(remaining) + first.text.slice(remaining);
  }
  assert.equal(r.payloadBytes(r.canonical(b)), size);
  return b;
}

test("T-U28 schema 17 table room adds only mergeMap and the version, preserves preview and captures the first merge", async test => {
  const k = await tableRules(), legacy = legacyBoard(), { room, old, storage, r, prepared, person } = await legacyRoom(test, legacy);
  assert.equal(room.board.schemaVersion, 18);
  assert.deepEqual(room.board, r.upgrade(legacy));
  const delta = Y.decodeUpdate(Y.encodeStateAsUpdate(room.doc, Y.encodeStateVector(old))).structs;
  assert.equal(delta.length, 2);
  assert.equal(tableMap(room.doc, legacy.objects[0].id).get("mergeMap").size, 0);
  assert.equal(storage.all("SELECT * FROM edits").length, 0);
  const version = room.history.capture(prepared, 0, 0, "checkpoint");
  assert.deepEqual((await room.history.preview(person, version.id)).document, legacy);
  await room.history.automatic("last_close");
  assert.equal(storage.all("SELECT * FROM versions").length, 2);
  const { evaluate } = await import("../packages/board-room/src/edits.ts"), client = await shared(room.doc);
  try {
    const update = client.write(b => withTable(b, t => k.mergeRange(t, rangeAt(t, 0, 0, 1, 1))));
    const result = evaluate(room.doc, room.board, update, storage);
    assert.equal(result.kind, "complete");
    Y.applyUpdate(room.doc, result.update);
    room.board = result.board; result.doc.destroy();
    await room.history.automatic("last_close");
    assert.equal(storage.all("SELECT * FROM versions").length, 3);
    const { versions: [current], head } = await room.history.list(person);
    assert.deepEqual((await room.history.preview(person, current.id)).document.objects[0].merges, room.board.objects[0].merges);
    const restore = await room.restoreVersion(person, version.id, {
      requestId: uuid(), expectedRevision: head.revision, expectedGeneration: head.generation,
    });
    assert.deepEqual(room.board, r.upgrade(legacy));
    assert.deepEqual((await room.history.preview(person, restore.restoredVersionId)).document, room.board);
    assert.deepEqual((await room.history.preview(person, version.id)).document, legacy);
  } finally { client.adapter.destroy(); }
});

test("T-U29 room upgrade writes the legacy cap snapshot once and enforces the cap again on edits", async test => {
  const r = await document(), { evaluate } = await import("../packages/board-room/src/edits.ts");
  const legacy = sizedLegacyTableBoard(r, 2097152), { room, storage } = await legacyRoom(test, legacy);
  const snapshot = Buffer.concat(storage.all("SELECT bytes FROM snapshot_chunks WHERE kind='json' ORDER BY chunk_index").map(row => row.bytes));
  assert.equal(r.payloadBytes(snapshot.toString()), 2097152 + 3 * Buffer.byteLength(',"merges":[]'));
  assert.equal(JSON.parse(snapshot).schemaVersion, 18);
  assert.throws(() => r.canonical(room.board), /Board too large/);
  const client = await shared(room.doc);
  try {
    const update = client.write(b => ({ ...b, title: b.title + "!" }));
    assert.deepEqual(evaluate(room.doc, room.board, update, storage), { kind: "refused", reason: "document_too_large" });
    assert.equal(storage.all("SELECT * FROM edits").length, 0);
  } finally { client.adapter.destroy(); }
});

test("T-U30 board files and media-free team imports carry merges byte for byte", async () => {
  const k = await tableRules(), r = await document();
  const { readBoardBundle, writeBoardFile } = await import("../apps/web/src/board-file.ts");
  const { importBoard } = await import("../apps/web/src/team/import.ts");
  const { digest } = await import("../apps/web/src/storage.ts");
  let b = await board(3, 3);
  for (let i = 0; i < 2; i++) b = r.add(b, "table", i * 300, 0);
  const base = b;
  b = { ...b, objects: b.objects.map((t, i) => i > 1 ? t : k.mergeRange(fill(t, k),
    i === 0 ? rangeAt(t, 0, 0, 1, 1) : rangeAt(t, 0, 0, 0, 1))) };
  const raw = await writeBoardFile(b), normal = JSON.parse(raw), bundle = JSON.parse(normal.payload);
  const file = raw => new File([raw], "Tables.nextboard");
  assert.deepEqual(bundle.assets, JSON.parse(JSON.parse(await writeBoardFile(base)).payload).assets);
  assert.equal(bundle.document, r.canonical(b));
  const restored = await readBoardBundle(file(raw));
  assert.deepEqual(restored.board, b);
  assert.equal(await writeBoardFile(restored.board), raw);
  const posted = [];
  await importBoard(file(raw), async input => posted.push(input));
  assert.deepEqual(posted, [{ document: b, title: b.title }]);
  const legacy = legacyBoard(), old = await writeBoardFile(legacy);
  assert.equal(await writeBoardFile(r.upgrade(legacy), (await readBoardBundle(file(old))).board), old);
  assert.deepEqual((await readBoardBundle(file(await writeBoardFile(r.upgrade(legacy))))).board.objects[0].merges, []);
  const first = b.objects[0], merge = first.merges[0];
  for (const bad of [
    { ...b, schemaVersion: 17 },
    { ...legacy, schemaVersion: 18 },
    tableStep(b, { ...first, merges: [merge, { ...merge, ...address(first, 1, 1) }] }),
    tableStep(b, { ...first, merges: [{ ...merge, columns: 4 }] }),
    tableStep(b, { ...first, merges: [{ ...merge, columns: 1, rows: 1 }] }),
    tableStep(b, { ...first, cells: [...first.cells, { ...address(first, 1, 1), text: "covered" }] }),
  ]) {
    const payload = JSON.stringify({ document: JSON.stringify(bad), assets: [] });
    await assert.rejects(readBoardBundle(file(JSON.stringify({ ...normal, payload, sha256: await digest(payload) }))), /it is not a valid board/);
  }
});
