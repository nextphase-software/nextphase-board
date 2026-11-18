// SPDX-License-Identifier: Apache-2.0
import test from "node:test";
import assert from "node:assert/strict";
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
  assert.equal(b.schemaVersion, 14);
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
  assert.equal(r.upgrade(legacy).schemaVersion, 14);
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

test("T-U11 stored schema 13 pageMap upgrades to 14 through a schema-only snapshot with no edit", async () => {
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
    assert.equal(room.board.schemaVersion, 14);
    const delta = Y.decodeUpdate(Y.encodeStateAsUpdate(room.doc, Y.encodeStateVector(stored))).structs;
    assert.equal(delta.length, 1); assert.equal(delta[0].content.getContent()[0], 14);
    await room.history.automatic("last_close");
    assert.deepEqual(tables(), before); assert.equal(meta(storage, "revision"), 0);
    room.initialized = false; await room.load(); assert.equal(room.board.schemaVersion, 14);
  } finally { room.doc.destroy(); stored.destroy(); storage.close(); }
});

test("T-U12 table chrome exposes named buttons, hit sizes and only the permitted selections", async () => {
  const w = await web(), t = (await board()).objects[0], { build } = await import("esbuild");
  const compiled = await build({ entryPoints: ["apps/web/src/scene/table-buttons.tsx"], bundle: true, write: false,
    format: "esm", platform: "node", jsx: "automatic", packages: "external",
    plugins: [{ name: "jsx-runtime", setup(build) {
      build.onResolve({ filter: /^react\/jsx-runtime$/ }, () => ({ path: import.meta.resolve("react/jsx-runtime"), external: true }));
      build.onResolve({ filter: /^nextphase-board-rules\// }, args => ({ path: import.meta.resolve(args.path), external: true }));
    } }],
  });
  const { TableButtons } = await import("data:text/javascript;base64," + Buffer.from(compiled.outputFiles[0].text).toString("base64"));
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
