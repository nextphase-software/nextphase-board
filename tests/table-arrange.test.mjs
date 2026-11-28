// SPDX-License-Identifier: Apache-2.0
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const rules = () => import("../packages/board-rules/src/objects/table.ts");
const document = () => import("../packages/board-rules/src/document.ts");
const web = () => import("../apps/web/src/table.ts");
const selectionRules = () => import("../apps/web/src/table-selection.ts");
const arrangeRules = () => import("../apps/web/src/table-arrange.ts");
const address = (t, r = 0, c = 0) => ({ row: t.rows[r].id, column: t.columns[c].id });
const span = (t, a, b, c, d) => ({ from: address(t, a, b), to: address(t, c, d) });
const selectCell = (t, r = 0, c = 0) => ({ kind: "cell", id: t.id, ...address(t, r, c) });
const selectRow = (t, r = 0) => ({ kind: "row", id: t.id, row: t.rows[r].id });
const selectColumn = (t, c = 0) => ({ kind: "column", id: t.id, column: t.columns[c].id });
const ids = (t, axis, ...positions) => positions.map(i => t[axis === "row" ? "rows" : "columns"][i].id);
const measure = text => text.split("\n").length;
const uuid = () => crypto.randomUUID();
const modifiers = (patch = {}) => ({ altKey: false, ctrlKey: false, metaKey: false, shiftKey: false, ...patch });
const key = (key, patch = {}) => ({ key, code: key, ...modifiers(patch) });
async function fixture(columns = 4, rows = 4) {
  const { empty, add } = await document();
  const b = add({ ...empty(), title: "Arrange check" }, "table", 0, 0, undefined, { columns, rows });
  return { board: b, table: b.objects[0] };
}

test("X12-W00 unmerged tables preserve the baseline rules, boxes, grabbers and CSV", async () => {
  const k = await rules(), w = await web(), { tableCsv } = await import("../apps/web/src/table-csv.ts");
  const { table } = await fixture(2, 2);
  const t = k.setCell(k.setCell({ ...table, merges: [] }, address(table), "A\nB"), address(table, 1, 1), "C");
  const row = uuid(), column = uuid();
  const rows = [...t.rows];
  rows.splice(1, 0, { id: row, height: 64 });
  const insert = k.insertAxis(t, "row", row, 1);
  assert.deepEqual(insert, { ...t, rows, height: 192 });
  assert.deepEqual(k.deleteAxis(insert, "row", row), t);
  const columns = [{ id: column, width: 192 }, ...t.columns];
  assert.deepEqual(k.insertAxis(t, "column", column, 0), { ...t, columns, width: 576 });
  assert.deepEqual(k.nextCell(t, address(t, 0, 1), 1), address(t, 1, 0));
  assert.deepEqual(k.neighbourCell(t, address(t), "ArrowRight"), address(t, 0, 1));
  const next = [uuid(), uuid(), uuid(), uuid()], [r0, r1, c0, c1] = next;
  const copy = k.remapTable(t, () => next.shift());
  assert.deepEqual(copy, { ...t, rows: [{ id: r0, height: 64 }, { id: r1, height: 64 }],
    columns: [{ id: c0, width: 192 }, { id: c1, width: 192 }],
    cells: [{ row: r0, column: c0, text: "A\nB" }, { row: r1, column: c1, text: "C" }] });
  const layout = w.layoutTable(t, measure), { box, rows: drawnRows, minimums } = layout;
  assert.deepEqual({ box, rows: drawnRows, minimums }, { box: { x: 0, y: 0, width: 384, height: 152 }, rows: [88, 64], minimums: [88, 64] });
  assert.deepEqual(w.tableButtons(t, layout, selectCell(t), 1), [
    { x: 82, y: -28, width: 28, height: 28, axis: "column", action: "select", selected: false, id: t.columns[0].id, index: 0 },
    { x: -28, y: 30, width: 28, height: 28, axis: "row", action: "select", selected: false, id: t.rows[0].id, index: 0 },
  ]);
  assert.equal(tableCsv(t), '\uFEFF"A\nB",\r\n,C\r\n');
});

test("X12-W01 ranges and sets keep anchors, normalize merged cells and follow reading order", async () => {
  const [s, k] = await Promise.all([selectionRules(), rules()]);
  const { table: t } = await fixture();
  const a = selectCell(t, 1, 0), c = address(t, 2, 1), range = s.chooseCell(t, a, c, "range");
  assert.deepEqual(range, { kind: "range", id: t.id, anchor: address(t, 1, 0), focus: c });
  assert.deepEqual(s.selectionAnchor(t, range), address(t, 1, 0));
  assert.deepEqual(s.selectionCells(t, range), [address(t, 1, 0), address(t, 1, 1), address(t, 2, 0), c]);
  assert.equal(s.countText(t, range), "4 cells");
  assert.equal(s.selectedText(t, range), "4 cells selected");
  const withThree = s.chooseCell(t, range, c, "toggle");
  assert.equal(withThree.kind, "cells"); assert.equal(withThree.cells.length, 3);
  const s2 = s.chooseCell(t, a, address(t, 0, 2), "toggle");
  assert.deepEqual(s2.cells, [address(t, 0, 2), address(t, 1, 0)]);
  assert.deepEqual(s.selectionAnchor(t, s2), address(t, 0, 2));
  assert.deepEqual(s.chooseCell(t, s2, address(t, 0, 2), "toggle"), a);
  assert.deepEqual(s.chooseCell(t, a, a, "toggle"), { kind: "table", id: t.id });
  assert.deepEqual(s.chooseCell(t, selectRow(t), address(t, 1, 0), "range"), a);
  assert.deepEqual(s.chooseCell(t, selectColumn(t), address(t, 1, 0), "toggle"), a);
  assert.deepEqual(s.chooseCell(t, range, address(t, 1, 0)), a);
  const merged = k.mergeRange(t, span(t, 1, 0, 2, 1));
  assert.deepEqual(s.rangeSelection(merged, t.id, a, c), a);
  assert.deepEqual(s.selectionCells(merged, range), [address(t, 1, 0)]);
  assert.deepEqual(s.boundsCells(merged, { top: 1, left: 0, bottom: 2, right: 2 }), [address(t, 1, 0), address(t, 1, 2), address(t, 2, 2)]);
  const covered = selectCell(t, 2, 1);
  assert.deepEqual(s.keepSelection(merged, covered), a);
  assert.deepEqual(s.keepSelection(merged, { kind: "cells", id: t.id, cells: [address(t, 2, 1), address(t, 1, 0)] }), a);
  assert.equal(s.keepSelection(t, range), range);
  assert.equal(s.keepSelection(t, s2), s2);
  const gone = k.deleteAxis(t, "row", t.rows[1].id);
  assert.equal(s.keepSelection(gone, range).kind, "table");
  assert.deepEqual(s.keepSelection(gone, s2), selectCell(gone, 0, 2));
  assert.equal(s.mergeTarget(t, s2), undefined);
  assert.deepEqual(s.mergeTarget(t, range), { from: address(t, 1, 0), to: c });
});

test("X12-W02 row and column runs use live ids and keep the most recent unshifted start", async () => {
  const s = await selectionRules(), k = await rules(), { table: t } = await fixture();
  for (const axis of ["row", "column"]) {
    const entry = n => ids(t, axis, n)[0];
    const one = s.chooseAxis(t, selectCell(t), axis, entry(1), "toggle");
    const run = s.chooseAxis(t, one, axis, entry(3), "range");
    assert.equal(run.kind, axis + "s"); assert.equal(run.start, entry(1));
    assert(s.axisSelected(run, axis));
    assert(!s.axisSelected(run, axis === "row" ? "column" : "row"));
    assert.deepEqual(s.chosenIds(t, run, axis), ids(t, axis, 1, 2, 3));
    assert.equal(s.selectedText(t, run), `3 ${axis}s selected`);
    assert(s.isRun(t, axis, ids(t, axis, 3, 2, 1)));
    assert.equal(s.selectionAnchor(t, run)[axis], entry(1));
    const apart = s.chooseAxis(t, run, axis, entry(2), "toggle");
    assert.equal(apart.start, entry(2));
    assert(!s.isRun(t, axis, s.chosenIds(t, apart, axis)));
    assert.equal(s.mergeTarget(t, apart), undefined);
    assert(s.mergeTarget(t, run));
    assert(s.mergeTarget(t, selectCell(t), axis));
    const withoutStart = k.deleteAxis(t, axis, entry(2));
    const kept = s.keepSelection(withoutStart, apart);
    assert.equal(kept.start, entry(1));
    const moved = k.moveAxis(t, axis, ids(t, axis, 1, 2, 3), 0);
    assert.equal(s.keepSelection(moved, run), run);
    assert.deepEqual(s.chosenIds(moved, apart, axis), [entry(1), entry(3)]);
    const narrowed = s.chooseAxis(t, apart, axis, entry(1), "toggle");
    assert.equal(narrowed.kind, axis);
    assert.equal(s.chooseAxis(t, narrowed, axis, entry(3), "toggle").kind, "table");
  }
  assert.equal(s.chooseHow(modifiers({ shiftKey: true }), true), "range");
  assert.equal(s.chooseHow(modifiers({ shiftKey: true, ctrlKey: true }), false), undefined);
  assert.equal(s.chooseHow(modifiers({ metaKey: true }), true), "toggle");
  assert.equal(s.chooseHow(modifiers({ ctrlKey: true }), false), "toggle");
  assert.equal(s.chooseHow(modifiers({ ctrlKey: true }), true), undefined);
  assert.equal(s.chooseHow(modifiers({ metaKey: true }), false), undefined);
  assert.equal(s.chooseHow(modifiers({ altKey: true, metaKey: true }), true), undefined);
});

test("X12-W03 keys grow over merged spans, consume arranged levels and hold anchor at navigation edges", async () => {
  const k = await rules(), s = await selectionRules(), w = await web(), { table: t } = await fixture();
  const top = selectCell(t), bottom = selectCell(t, 3, 3);
  const forward = s.chooseCell(t, top, address(t, 1, 1), "range");
  const backwards = s.chooseCell(t, bottom, address(t, 2, 2), "range");
  const picked = s.chooseCell(t, top, address(t, 1, 1), "toggle");
  const run = s.chooseAxis(t, selectRow(t, 1), "row", t.rows[2].id, "range");
  const column = selectColumn(t, 1);
  const ask = (selection, e, options = {}) => w.tableKey(options.t ?? t, selection, e, !!options.inline, !!options.readOnly, !!options.composing);
  assert.deepEqual(ask(forward, key("ArrowRight", { shiftKey: true })).choose.focus, address(t, 1, 2));
  assert.deepEqual(ask(top, key("ArrowLeft", { shiftKey: true })), { consume: true });
  assert.equal(s.moveFocus(t, top, "ArrowUp"), top);
  const merged = k.mergeRange(t, span(t, 0, 1, 1, 2));
  const across = ask(top, key("ArrowRight", { shiftKey: true }), { t: merged }).choose;
  assert.deepEqual(across.focus, address(t, 0, 1));
  assert.equal(s.countText(merged, across), "3 cells");
  assert.deepEqual(ask(across, key("ArrowRight", { shiftKey: true }), { t: merged }).choose.focus, address(t, 0, 3));
  for (const selected of [picked, run, column]) assert.deepEqual(ask(selected, key("ArrowRight", { shiftKey: true })), { consume: true });
  for (const e of [key("Tab", { shiftKey: true }), key("ArrowLeft"), key("ArrowUp")]) {
    for (const selected of [forward, picked]) assert.deepEqual(ask(selected, e), { select: address(t) });
  }
  assert.deepEqual(ask(backwards, key("Tab")), { select: address(t, 3, 3) });
  assert.deepEqual(ask(backwards, key("ArrowRight")), { select: address(t, 3, 3) });
  assert.deepEqual(ask(picked, key("Tab")), { select: address(t, 0, 1) });
  assert.deepEqual(ask(forward, key("Enter")), { edit: address(t) });
  assert.deepEqual(ask(run, key("Enter")), { consume: true });
  assert.deepEqual(ask(forward, key("Delete")), { action: { at: "clear" } });
  assert.deepEqual(ask(run, key("Backspace")), { action: { axis: "row", at: "delete" } });
  assert.deepEqual(ask(run, key("d", { ctrlKey: true })), { action: { axis: "row", at: "duplicate" } });
  assert.deepEqual(ask(column, key("d", { metaKey: true })), { action: { axis: "column", at: "duplicate" } });
  for (const selected of [top, forward, picked]) assert.deepEqual(ask(selected, key("d", { metaKey: true })), { consume: true });
  assert.equal(ask({ kind: "table", id: t.id }, key("d", { metaKey: true })), undefined);
  const mergeKey = key("m", { code: "KeyM", altKey: true });
  assert.deepEqual(ask(forward, mergeKey), { action: { at: "merge" } });
  assert.deepEqual(ask(selectCell(t, 0, 1), mergeKey, { t: merged }), { action: { at: "split" } });
  assert.deepEqual(ask(picked, mergeKey), { consume: true });
  assert.deepEqual(ask(forward, key("Escape")), { exit: false });
  for (const code of ["Enter", "BracketLeft", "BracketRight"]) {
    assert.deepEqual(ask(picked, key(code, { altKey: true })), { consume: true });
  }
  assert.deepEqual(ask(run, key("Enter", { altKey: true, shiftKey: true })), { action: { axis: "row", at: "before" } });
  assert.deepEqual(ask(column, key("BracketRight", { altKey: true })), { action: { axis: "column", at: "after" } });
  assert.equal(ask(top, key("ArrowRight", { shiftKey: true }), { readOnly: true }), undefined);
  assert.equal(ask(run, key("d", { metaKey: true }), { composing: true }), undefined);
  assert.equal(ask(top, mergeKey, { inline: true }), undefined);
});

test("X12-W04 refused edits share the same limit and merge reasons and menus use exact order and platform keys", async () => {
  const a = await arrangeRules(), s = await selectionRules(), k = await rules(), { table: t } = await fixture();
  const row = selectRow(t), col = selectColumn(t, 3), move = (axis, by) => ({ axis, at: "move", by });
  assert.equal(a.arrangeRefusal(t, row, move("row", -1), 0).reason, "Already the first row");
  assert.equal(a.arrangeRefusal(t, selectRow(t, 3), move("row", 1), 0).reason, "Already the last row");
  assert.equal(a.arrangeRefusal(t, selectColumn(t), move("column", -1), 0).reason, "Already the first column");
  assert.equal(a.arrangeRefusal(t, col, move("column", 1), 0).reason, "Already the last column");
  for (const axis of ["row", "column"]) {
    const id = i => ids(t, axis, i)[0], base = axis === "row" ? row : selectColumn(t);
    const apart = s.chooseAxis(t, base, axis, id(2), "toggle");
    for (const action of [move(axis, 1), { axis, at: "duplicate" }, { axis, at: "merge" }]) {
      assert.equal(a.arrangeRefusal(t, apart, action, 0).reason, `Choose ${axis}s next to each other`);
    }
    const limit = { ...t, ...k.createTable(axis === "column" ? 20 : 4, axis === "row" ? 50 : 4) };
    const first = s.chooseAxis(limit, { kind: "table", id: t.id }, axis, ids(limit, axis, 0)[0]);
    const at = { axis, at: "duplicate" };
    assert.equal(a.arrangeRefusal(limit, first, at, 5000).reason, a.BOARD_CELLS_REASON);
    assert.equal(a.arrangeRefusal(limit, first, at, 0).reason, `A table holds at most ${axis === "row" ? 50 : 20} ${axis}s`);
    for (const item of a.axisMenu(t, base, axis, false, 5000).items.filter(item => /^(Add|Duplicate)/.test(item.name))) {
      assert(item.disabled); assert.equal(item.reason, a.BOARD_CELLS_REASON);
    }
    const all = s.chooseAxis(t, base, axis, id(3), "range");
    const remove = { axis, at: "delete" };
    assert.equal(a.arrangeRefusal(t, all, remove, 0).reason, `A table needs at least one ${axis}`);
    const nowThree = k.deleteAxis(t, axis, id(3));
    assert.equal(a.arrangeRefusal(nowThree, all, remove, 0).reason, `A table needs at least one ${axis}`);
  }
  const four = k.mergeRange(t, span(t, 1, 1, 2, 2)), select = selectRow(t, 2);
  assert.equal(a.arrangeRefusal(four, select, move("row", 1), 0).reason, "A merged cell is in the way");
  assert.equal(a.arrangeRefusal(four, select, { axis: "row", at: "duplicate" }, 0).reason, "A merged cell is in the way");
  const single = { ...t, ...k.createTable(1, 1) };
  assert.equal(a.arrangeRefusal(single, selectRow(single), { at: "merge" }, 0).reason, "Already a single cell");
  assert.deepEqual(a.arrangeRefusal(t, { ...row, row: uuid() }, move("row", -1), 0), { code: "invalid" });
  const many = s.chooseAxis(t, row, "row", t.rows[1].id, "range");
  for (const mac of [true, false]) {
    for (const [axis, selected, names] of [
      ["row", row, ["Move row up", "Move row down", "Add row above", "Add row below", "Duplicate row", "Merge cells", "Delete row"]],
      ["row", many, ["Move rows up", "Move rows down", "Add row above", "Add row below", "Duplicate rows", "Merge cells", "Delete rows"]],
      ["column", col, ["Move column left", "Move column right", "Add column to the left", "Add column to the right", "Duplicate column", "Merge cells", "Delete column"]],
      ["column", s.chooseAxis(t, col, "column", t.columns[2].id, "range"), ["Move columns left", "Move columns right", "Add column to the left", "Add column to the right", "Duplicate columns", "Merge cells", "Delete columns"]],
    ]) {
      const menu = a.axisMenu(t, selected, axis, mac, 16);
      assert.equal(menu.heading, ({ row: "Row", rows: "Rows", column: "Column", columns: "Columns" })[selected.kind]);
      assert.deepEqual(menu.items.map(item => item.name), names);
      assert.deepEqual(menu.items.map(item => item.key), ["", "", axis === "row" ? "⌥⇧↩" : "⌥[",
        axis === "row" ? "⌥↩" : "⌥]", mac ? "⌘D" : "Ctrl+D", "⌥M", "⌫"]);
      assert.deepEqual(menu.items.map(item => item.separatorBefore), [false, false, true, false, false, false, true]);
      assert.deepEqual(menu.items.filter(item => item.danger).map(item => item.action), [{ axis, at: "delete" }]);
    }
  }
  assert(a.mergeShown(t, many));
  assert(a.mergeShown(t, s.chooseCell(t, selectCell(t), address(t, 1, 1), "range")));
  assert(!a.mergeShown(t, s.chooseCell(t, selectCell(t), address(t, 1, 1), "toggle")));
  assert(!a.mergeShown(t, selectCell(t)));
});

test("X12-W05 arranged actions return exact selection, hint and announcement after one table change", async () => {
  const a = await arrangeRules(), s = await selectionRules(), k = await rules(), { table } = await fixture();
  const t = k.resizeAxis(k.setCell(k.setCell(table, address(table), "Anchor"), address(table, 1, 1), "Covered"), "row", table.rows[0].id, 92);
  const anchor = selectCell(t), range = s.chooseCell(t, anchor, address(t, 1, 1), "range"), section = a.arrangeTable(t, range, { at: "merge" }, uuid, 16);
  assert.equal(section.announcement, "Cells merged"); assert.deepEqual(section.selection, anchor);
  assert.equal(section.hint, undefined); assert.equal(k.cellText(section.table, address(t, 1, 1)), "");
  const split = a.arrangeTable(section.table, anchor, { at: "split" }, uuid, 16);
  assert.equal(split.announcement, "Cell split");
  assert.deepEqual(split.selection, range);
  assert.deepEqual(split.table.merges, []);
  const cleared = a.arrangeTable(t, range, { at: "clear" }, uuid, 16);
  assert.equal(cleared.selection, range); assert.equal(cleared.table.cells.length, 0);
  assert.equal(a.arrangeTable(cleared.table, range, { at: "clear" }, uuid, 16), null);
  const picked = selectRow(t, 1), row = uuid();
  const after = a.arrangeTable(t, picked, { at: "after", axis: "row" }, () => row, 16);
  assert.equal(after.table.rows[2].id, row);
  assert.equal(after.selection.row, row);
  assert.deepEqual(after.hint, { table: t.id, axis: "row", moved: [row] });
  assert.equal(after.announcement, "");
  const before = a.arrangeTable(t, picked, { at: "before", axis: "row" }, () => row, 16);
  assert.equal(before.table.rows[1].id, row);
  const insert = a.arrangeTable(section.table, anchor, { at: "insert", axis: "row", gap: 1 }, () => row, 16);
  assert.equal(insert.table.rows[1].height, 92);
  assert.equal(insert.table.merges[0].rows, 3);
  assert.equal(insert.selection, anchor);
  assert.equal(insert.announcement, "Row inserted");
  assert.deepEqual(insert.hint, { table: t.id, axis: "row", moved: [row] });
  const up = a.arrangeTable(t, picked, { at: "move", axis: "row", by: -1 }, uuid, 16);
  assert.equal(up.selection, picked); assert.equal(up.announcement, "Row moved to row 1");
  const run = s.chooseAxis(t, picked, "row", t.rows[2].id, "range");
  const down = a.arrangeTable(t, run, { at: "move", axis: "row", to: 4 }, uuid, 16);
  assert.equal(down.selection, run); assert.equal(down.announcement, "Rows moved to rows 3–4");
  assert.equal(a.arrangeTable(t, run, { at: "move", axis: "row", to: 2 }, uuid, 16), null);
  const copy = [uuid(), uuid()], remaining = [...copy];
  const duplicate = a.arrangeTable(t, run, { at: "duplicate", axis: "row" }, () => remaining.shift(), 16);
  assert.equal(duplicate.announcement, "Rows duplicated"); assert.deepEqual(duplicate.selection.rows, copy);
  assert.deepEqual(duplicate.hint, { table: t.id, axis: "row", moved: copy });
  const deleted = a.arrangeTable(t, run, { at: "delete", axis: "row" }, uuid, 16);
  assert.deepEqual(deleted.table.rows, [t.rows[0], t.rows[3]]);
  assert.deepEqual(deleted.selection, selectCell(deleted.table, 1, 0));
  assert.equal(a.arrangeTable(t, run, { at: "duplicate", axis: "row" }, uuid, 5000).refusal.reason, a.BOARD_CELLS_REASON);
});

test("X12-W06 hover geometry keeps inner dots, merge-safe gaps and approved drag dimensions", async () => {
  const k = await rules(), a = await arrangeRules(), w = await web(), { table: t } = await fixture();
  const layout = w.layoutTable(t, measure), box = layout.box, s = selectCell(t);
  assert.deepEqual(a.hoverTarget(t, layout, { x: -40, y: 90 }, 1), { row: t.rows[1].id });
  assert.deepEqual(a.hoverTarget(t, layout, { x: -41, y: 90 }, 1), {});
  assert.deepEqual(a.hoverTarget(t, layout, { x: 220, y: -20 }, 2), { column: t.columns[1].id });
  assert.deepEqual(a.hoverTarget(t, layout, { x: 220, y: 90 }, 1), { row: t.rows[1].id, column: t.columns[1].id });
  const hover = a.hoverControls(t, layout, s, { row: t.rows[1].id, column: t.columns[0].id }, 1, 5000);
  assert.equal(hover.grabbers.length, 1);
  assert.deepEqual(hover.grabbers[0], { x: -28, y: 82, width: 28, height: 28, axis: "row", id: t.rows[1].id, index: 1, action: "select", selected: false });
  assert.deepEqual(hover.dots.map(d => [d.name, d.x, d.y, d.length, d.reason]), [
    ["Insert row between rows 1 and 2", -14, 64, box.width, a.BOARD_CELLS_REASON],
    ["Insert row between rows 2 and 3", -14, 128, box.width, a.BOARD_CELLS_REASON],
    ["Insert column between columns 1 and 2", 192, -14, box.height, a.BOARD_CELLS_REASON],
  ]);
  assert.deepEqual(a.hoverControls(t, layout, s, { row: t.rows[3].id }, 2, 16).dots.map(d => [d.gap, d.x, d.y]), [[3, -7, 192]]);
  const merged = k.mergeRange(t, span(t, 1, 1, 2, 2));
  const valid = ids(t, "row", 1, 2), broken = ids(t, "row", 2);
  assert(a.dragStarts(merged, "row", valid));
  assert(!a.dragStarts(merged, "row", broken));
  assert.equal(a.dropGap(merged, layout, "row", broken, { x: 0, y: 180 }), undefined);
  assert(a.ownPlace(merged, "row", valid, 2));
  assert.equal(a.dropGap(merged, layout, "row", valid, { x: 0, y: 128 }), 1);
  assert.equal(a.dropGap(t, layout, "row", valid, { x: 0, y: 128 }), 2);
  assert.equal(a.dropGap(t, layout, "row", ids(t, "row", 3), { x: 0, y: 32 }), 0);
  assert.deepEqual(a.dropLine(t, layout, "row", 1, 2), [-2, 64, box.width + 2, 64]);
  assert.deepEqual(a.dropLine(t, layout, "column", 1, 1), [192, -4, 192, box.height + 4]);
  assert.deepEqual(a.dragGhost(t, layout, "row", valid, { x: -14, y: 96 }, { x: 50, y: 28 }, 1),
    { x: 10, y: 6, width: 768, height: 128 });
  assert.deepEqual(a.dragSquare(t, layout, "column", { x: 28, y: 512 }, 2), { x: 28, y: -7 });
});

test("X12-W07 merged outlines, inner grid, hit testing and remote selection notices", async () => {
  const k = await rules(), s = await selectionRules(), w = await web(), { table: t } = await fixture();
  const anchor = selectCell(t, 1, 1), covered = selectCell(t, 2, 2), target = span(t, 1, 1, 2, 2);
  const merged = k.setCell(k.mergeRange(t, target), anchor, "one\ntwo\nthree\nfour\nfive");
  const layout = w.layoutTable(merged, measure);
  assert.deepEqual(layout.unmerged, [64, 64, 64, 64]);
  assert.deepEqual(layout.rows, [64, 64, 96, 64]);
  const box = { x: 192, y: 64, width: 384, height: 160 };
  assert.deepEqual(w.cellBox(merged, layout, covered), box);
  assert.deepEqual(w.hitCell(merged, layout, { x: 400, y: 140 }), address(t, 1, 1));
  assert.equal(w.hitBorder(merged, layout, { x: 385, y: 130 }, 1), undefined);
  assert.equal(w.hitBorder(merged, layout, { x: 575, y: 130 }, 1)?.index, 2);
  assert.deepEqual(w.tableGridLines(merged, layout).filter(line => line.points[1] === 128 && line.points[3] === 128)
    .map(line => line.points), [[0, 128, 192, 128], [576, 128, 768, 128]]);
  assert.deepEqual(w.selectionOutlines(merged, layout, anchor), { boxes: [box], inner: [] });
  const range = s.chooseCell(merged, selectCell(merged, 0, 0), address(merged, 2, 3), "range");
  const outline = w.selectionOutlines(merged, layout, range);
  assert.equal(outline.boxes.length, 1);
  assert(outline.inner.some(([x, y, x2]) => x === 0 && y === 128 && x2 === 192));
  assert(!outline.inner.some(([x, y, x2]) => y === 128 && Math.min(x, x2) < 576 && Math.max(x, x2) > 192));
  const set = s.chooseCell(merged, anchor, address(merged), "toggle");
  assert.deepEqual(w.selectionOutlines(merged, layout, set).boxes, [w.cellBox(merged, layout, address(t)), box]);
  const run = s.chooseAxis(merged, selectRow(t, 1), "row", t.rows[2].id, "range");
  assert.equal(w.selectionOutlines(merged, layout, run).boxes.length, 1);
  assert.equal(w.selectionOutlines(merged, layout, s.chooseAxis(merged, selectRow(t), "row", t.rows[2].id, "toggle")).boxes.length, 2);
  assert.deepEqual(w.selectionBox(merged, layout, run), layout.box);
  assert(!w.tableButtons(merged, layout, anchor, 1).some(b => b.action === "select"));
  assert.equal(w.tableButtons(merged, layout, run, 1).filter(b => b.selected).length, 2);
  assert.equal(w.tableButtons(merged, layout, range, 1).filter(b => b.action === "select").length, 0);
  assert.equal(w.selectionAnnouncement(merged, range), s.countText(merged, range) + " selected");
  assert.equal(w.selectionAnnouncement(merged, selectColumn(t)), "");
  assert.deepEqual(w.validTableSelection(merged, covered, true, "remote", "ana", t),
    { selection: anchor, notice: "ana merged cells you were editing." });
  assert.equal(w.validTableSelection(merged, covered, true, "remote", undefined, t).notice, "Someone merged cells you were editing.");
  for (const origin of ["own", "reload"]) assert.deepEqual(w.validTableSelection(merged, covered, true, origin, "ana", t), { selection: anchor, notice: "" });
  assert.equal(w.validTableSelection(merged, anchor, true, "remote", "ana", t).selection, anchor);
  const shifted = { ...merged, rows: [t.rows[0], t.rows[1], t.rows[3], t.rows[2]] };
  const previouslyUncovered = selectCell(shifted, 2, 2);
  assert.deepEqual(w.validTableSelection(shifted, previouslyUncovered, true, "remote", "ana", merged), { selection: anchor, notice: "" });
  for (const next of [k.splitMerge(merged, anchor), k.insertAxis(merged, "column", uuid()),
    k.duplicateAxis(merged, "row", ids(t, "row", 1, 2)),
    k.moveAxis(merged, "row", ids(t, "row", 1, 2), 4)]) {
    assert.deepEqual(w.validTableSelection(next, anchor, true, "remote", "ana", merged), { selection: anchor, notice: "" });
  }
  const rowRemoved = k.deleteAxis(t, "row", covered.row);
  assert.equal(w.validTableSelection(rowRemoved, covered, false, "remote", "ana", t).notice, "ana deleted a row you had selected.");
});

async function harness(exports, { state = false, konva = false } = {}) {
  const { build } = await import("esbuild");
  const result = await build({
    stdin: { contents: exports, loader: "ts", resolveDir: new URL("../apps/web/src/", import.meta.url).pathname },
    bundle: true, write: false, platform: "node", format: "esm", jsx: "automatic", packages: "external",
    plugins: [{ name: "table-ui-test", setup(plugin) {
      plugin.onResolve({ filter: /^(react|react-konva)$/ }, ({ path }) => {
        if (path === "react" && state) return { path, namespace: "test" };
        if (path === "react-konva" && konva) return { path, namespace: "test" };
        return { path: import.meta.resolve(path), external: true };
      });
      plugin.onResolve({ filter: /^(react\/jsx(-dev)?-runtime$|yjs$|nextphase-board-(rules|sync)\/)/ },
        ({ path }) => ({ path: import.meta.resolve(path), external: true }));
      plugin.onLoad({ filter: /.*/, namespace: "test" }, ({ path }) => ({ loader: "js", contents: path === "react-konva"
        ? 'export const Group = "Group", Line = "Line", Rect = "Rect", Text = "Text";'
        : `
          let frame, cursor;
          export function render(slots, call) { frame = slots; cursor = 0; return call(); }
          export function useRef(initial) { const i = cursor++; return frame[i] ??= { current: initial }; }
          export function useState(initial) { const i = cursor++; const slot = frame[i] ??= { value: typeof initial === "function" ? initial() : initial };
            return [slot.value, update => { slot.value = typeof update === "function" ? update(slot.value) : update; }]; }
          export function useEffect(run, deps) { const slot = useRef(null);
            if (!slot.current || deps.some((v,i) => v !== slot.current.deps[i])) {
              slot.current = { deps, cleanup: run() };
            }
          }
          export function useCallback(fn) { return fn; }
        ` }));
    } }],
  });
  return import("data:text/javascript;base64," + Buffer.from(result.outputFiles[0].text).toString("base64"));
}

function fakeGlobal(test, key, value) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, key);
  Object.defineProperty(globalThis, key, { configurable: true, value });
  test.after(() => previous ? Object.defineProperty(globalThis, key, previous) : delete globalThis[key]);
}

test("X12-W08 captured press crosses a 4 px axis threshold, uses the live gap and releases the shared gate", async test => {
  const { useTableArrange, useViewport, render } = await harness(`
    export { useTableArrange } from "./state/use-table-arrange.ts";
    export { useViewport } from "./state/use-viewport.ts";
    export { render } from "react";
  `, { state: true });
  const w = await web(), s = await selectionRules(), k = await rules(), { board, table: t } = await fixture();
  class Target {
    pointer = null;
    closest() { return this; }
    setPointerCapture(id) { this.pointer = id; }
    hasPointerCapture(id) { return this.pointer === id; }
    releasePointerCapture() { this.pointer = null; }
  }
  fakeGlobal(test, "Element", Target);
  const actions = [], chosen = [], slots = [], viewport = [], target = new Target(), listeners = new Map();
  const surface = { clientWidth: 0, clientHeight: 0, getBoundingClientRect: () => ({ left: 0, top: 0 }),
    addEventListener(type, listener) { listeners.set(type, listener); }, removeEventListener() {} };
  const live = { board, table: { ...t, tableLayout: w.layoutTable(t, measure) }, selection: selectCell(t),
    readOnly: false, editing: false, busy: false, view: { x: 0, y: 0, z: 1 }, size: { w: 0, h: 0 },
    scene: { current: surface }, drag: { current: null },
    setBusy(value) { live.busy = value; },
    choose(value) { chosen.push(value); live.selection = value; },
    action(value) { actions.push(value); },
  };
  const show = () => render(slots, () => useTableArrange(live));
  const view = () => render(viewport, () => useViewport({ scene: live.scene, inline: false, drag: live.drag, pending: { current: {} } }));
  const event = (x, y, patch = {}) => ({ ...modifiers(), clientX: x, clientY: y, isPrimary: true, button: 0, pointerId: 5, ...patch });
  const g = i => ({ axis: "row", id: t.rows[i].id });
  const move = (x, y, target = null, pointerType = "mouse", buttons = 0) => show().pointer.move({ x, y }, { target, pointerType, buttons });
  move(300, 100, null, "touch"); assert.deepEqual(show().buttons.hover, {});
  move(300, 100, null, "pen"); assert.deepEqual(show().buttons.hover, { row: t.rows[1].id, column: t.columns[1].id });
  move(-14, 128, target); assert.equal(show().buttons.hover.row, t.rows[1].id);
  show().pointer.leave(); assert.deepEqual(show().buttons.hover, {});
  move(300, 100); show().buttons.press(g(1), event(-14, 96), target);
  assert.equal(target.pointer, 5);
  show().buttons.move(event(300, 99)); assert.equal(show().drawing, null);
  show().buttons.release(event(300, 99));
  show().buttons.click(g(1), event(300, 99));
  assert.deepEqual(chosen.pop(), selectRow(t, 1));
  show().buttons.press(g(2), event(-14, 160), target);
  show().buttons.move(event(-14, 164));
  assert.deepEqual(chosen.pop(), selectRow(t, 2));
  assert.equal(live.drag.current.arrange, true);
  assert(live.busy); assert(show().dragging);
  assert.deepEqual(show().drawing.ids, [t.rows[2].id]);
  assert.deepEqual(show().buttons.hover, {});
  const wheel = () => listeners.get("wheel")({ preventDefault() {}, deltaX: 10, deltaY: 0, deltaMode: 0, target: surface });
  view();
  wheel(); assert.equal(view().view.x, 0);
  const moved = k.moveAxis(t, "row", [t.rows[0].id], 4);
  live.table = { ...moved, tableLayout: w.layoutTable(moved, measure) };
  assert.equal(show().drawing.ghost.y, 78);
  const release = show();
  release.buttons.release(event(-14, 3));
  assert.equal(live.drag.current, null); assert.equal(live.busy, false); assert.equal(target.pointer, null);
  assert.deepEqual(actions.splice(0), [{ axis: "row", at: "move", to: 0 }]);
  show().buttons.click(g(2), event(-14, 3));
  assert.equal(chosen.length, 0);
  wheel(); assert.notEqual(view().view.x, 0);

  live.table = { ...t, tableLayout: w.layoutTable(t, measure) };
  for (const cause of ["own place", "Escape", "lost", "readOnly", "live break"]) {
    live.selection = s.chooseAxis(t, selectRow(t, 1), "row", t.rows[2].id, "range");
    show().buttons.press(g(1), event(-14, 96), target);
    show().buttons.move(event(-14, 100));
    assert.deepEqual(show().drawing.ids, ids(t, "row", 1, 2));
    if (cause === "Escape") assert(show().buttons.key(key("Escape")));
    if (cause === "lost") show().buttons.lost();
    if (cause === "readOnly") { live.readOnly = true; assert.equal(show().drawing, null); }
    if (cause === "live break") {
      const broken = k.moveAxis(t, "row", [t.rows[1].id], 0);
      live.table = { ...broken, tableLayout: w.layoutTable(broken, measure) };
      assert.equal(show().drawing, null);
    }
    show().buttons.release(event(-14, 128));
    assert.equal(live.drag.current, null); assert.equal(actions.length, 0);
    live.readOnly = false; live.table = { ...t, tableLayout: w.layoutTable(t, measure) };
  }
  const apart = s.chooseAxis(t, selectRow(t), "row", t.rows[2].id, "toggle");
  live.selection = apart;
  show().buttons.press(g(2), event(-14, 160), target); show().buttons.move(event(-14, 170));
  assert.deepEqual(show().drawing.ids, [t.rows[2].id]);
  show().cancel();
  const merged = k.mergeRange(t, span(t, 1, 1, 2, 1));
  live.table = { ...merged, tableLayout: w.layoutTable(merged, measure) };
  live.selection = selectRow(t, 2);
  show().buttons.press(g(2), event(-14, 160), target); show().buttons.move(event(-14, 200));
  assert.equal(show().drawing, null);
  show().buttons.release(event(-14, 200));
  assert.equal(actions.length, 0);
});

test("X12-W09 DOM controls show dots, keep grabber keys and expose exact context bar and menu items", async () => {
  const k = await rules(), s = await selectionRules(), w = await web(), { table: t } = await fixture();
  const { TableButtons, TableControls, AxisMenu } = await harness(`
    export { TableButtons } from "./scene/table-buttons.tsx";
    export { TableControls } from "./ui/table-controls.tsx";
    export { AxisMenu } from "./ui/table-menu.tsx";
  `);
  const { createElement } = await import("react"), { renderToStaticMarkup } = await import("react-dom/server");
  const noop = () => {}, press = { axis: "row", id: t.rows[1].id };
  const arrange = { hover: { row: press.id, column: t.columns[1].id }, press: noop, move: noop, key: noop,
    release: noop, lost: noop, click: noop, insert: noop };
  const props = { object: { ...t, tableLayout: w.layoutTable(t, measure) }, zoom: 1,
    pos: ({ x, y }) => ({ left: x, top: y }), action: noop, select: noop, focus: noop };
  const render = (selection, opts) => TableButtons({ ...props, selection, ...opts })?.props.children ?? [];
  const without = render(selectCell(t), {});
  assert.deepEqual(without.map(node => node.props["aria-label"]), ["Select column 1", "Select row 1"]);
  assert(!without.some(node => node.props.onPointerDown));
  const withDots = render(selectCell(t), { arrange, cells: 5000 });
  const firstDot = withDots.findIndex(node => node.props.className.includes("table-insert"));
  assert.equal(firstDot, 4);
  assert(withDots.slice(0, firstDot).every(node => node.props.className.includes("table-grabber")));
  assert(withDots.slice(firstDot).every(node => node.props.tabIndex === -1 && node.props.disabled && node.props.title.includes("5,000")));
  const live = render(selectRow(t, 1), { arrange });
  assert.equal(withDots.find(node => node.props["aria-label"] === "Select row 2").key, live.find(node => node.props["aria-label"] === "Select row 2").key);
  assert.deepEqual(withDots.slice(firstDot).map(node => node.props["aria-label"]), [
    "Insert row between rows 1 and 2", "Insert row between rows 2 and 3",
    "Insert column between columns 1 and 2", "Insert column between columns 2 and 3"]);
  assert.equal(render(selectCell(t), { arrange, readOnly: true }).length, 0);
  assert.equal(render(selectCell(t), { arrange, editing: true }).length, 0);
  const run = s.chooseAxis(t, selectRow(t, 1), "row", t.rows[2].id, "range");
  const dragging = render(run, { busy: true, arrange: { ...arrange, dragging: press, square: { x: -14, y: 100 } } });
  assert.deepEqual(dragging.map(node => node.props["aria-label"]), ["Select row 2", "Select row 3", undefined]);
  assert.equal(dragging[2].props.className, "table-drag-square");
  const range = s.chooseCell(t, selectCell(t), address(t, 1, 1), "range"), set = s.chooseCell(t, selectCell(t), address(t, 1, 1), "toggle");
  const bar = (selection, table = t, extra = {}) => renderToStaticMarkup(createElement(TableControls, { table, selection,
    action: noop, cells: 16, copyLink: createElement("button", { "aria-label": "Copy link to table" }), ...extra }));
  assert.match(bar(range), /<span>Cells<\/span>.*4 cells.*aria-label="Merge cells".*aria-label="Delete content".*aria-label="Copy link to table"/);
  assert.doesNotMatch(bar(set), /aria-label="Merge cells"/);
  assert.match(bar(run), /<span>Rows<\/span>.*2 rows.*aria-label="Row options".*aria-label="Merge cells".*aria-label="Delete rows"/);
  assert.match(bar(selectColumn(t)), /aria-label="Column options".*aria-label="Merge cells".*aria-label="Delete column"/);
  const merged = k.mergeRange(t, span(t, 0, 0, 1, 1));
  assert.match(bar(selectCell(t), merged), /class="icon-button table-split" aria-label="Split cell" aria-pressed="true" title="Split cell ⌥M"/);
  assert.doesNotMatch(bar(selectCell(t), merged, { readOnly: true }), /Split cell|Row options/);
  const menu = renderToStaticMarkup(createElement(AxisMenu, { axis: "row", table: t, selection: run, cells: 16, action: noop }));
  assert.match(menu, /Move rows up.*Move rows down.*role="separator".*Add row above.*Add row below.*Duplicate rows.*Merge cells.*role="separator".*Delete rows/);
});

test("X12-W10 canvas intercepts modified cell presses and composing keys and page commands respect the drag gate", async test => {
  const { useCanvasInput, usePageKeys, render } = await harness(`
    export { useCanvasInput } from "./state/use-canvas-input.ts";
    export { usePageKeys } from "./state/use-page-keys.ts";
    export { render } from "react";
  `, { state: true });
  const { board, table: t } = await fixture(), w = await web(), s = await selectionRules();
  fakeGlobal(test, "window", { addEventListener() {}, removeEventListener() {} });
  fakeGlobal(test, "Element", class {});
  fakeGlobal(test, "HTMLCanvasElement", class {});
  const choices = [], calls = [], actions = [], drag = { current: null };
  const scene = { getBoundingClientRect: () => ({ left: 0, top: 0 }), focus() { calls.push("focus"); } };
  const base = { model: { current: board }, view: { x: 0, y: 0, z: 1 }, size: { w: 0, h: 0 },
    displayedObjects: [{ ...t, displayHeight: t.height, tableLayout: w.layoutTable(t, measure) }],
    tool: "Select", scene: { current: scene }, selected: new Set([t.id]), drag, spacePanRef: { current: false },
    setSpacePan() {}, setSelectionBox() {}, setBusy() {}, setTool() {}, setBoard() {},
    trackPointer() {}, clearHistory() {}, finishTextSession() { calls.push("finish"); },
    chooseTable(selection) { choices.push(selection); }, setInline() { calls.push("close"); }, tableAction(action) { actions.push(action); },
    select() { assert.fail("modified cell press must not toggle the object"); },
    handlesVisible: true, handlePoints: [{ corner: "n", x: 192, y: 64 }],
  };
  const renderCanvas = extra => render([], () => useCanvasInput({ ...base, ...extra }));
  const click = (extra = {}) => ({ target: scene, currentTarget: scene, clientX: 192, clientY: 64,
    pointerId: 1, button: 0, isPrimary: true, nativeEvent: {}, preventDefault() {},
    ...modifiers({ shiftKey: true }), ...extra });
  const cell = selectCell(t), run = s.chooseAxis(t, selectRow(t), "row", t.rows[1].id, "range");
  renderCanvas({ tableSelection: cell }).pointerDown(click());
  assert.equal(choices.pop().kind, "range"); assert.equal(drag.current, null);
  renderCanvas({ tableSelection: run }).pointerDown(click());
  assert.equal(choices.pop().kind, "cell"); assert.equal(drag.current, null);
  calls.length = 0;
  renderCanvas({ tableSelection: cell, inline: true }).pointerDown(click());
  assert.deepEqual(calls, ["finish", "close", "focus"]);
  assert.equal(choices.pop().kind, "range");
  renderCanvas({ tableSelection: cell, readOnly: true }).pointerDown(click());
  assert.deepEqual(choices.pop(), selectCell(t, 1, 1)); assert.equal(drag.current, null);
  const mac = /Mac|iPhone|iPad/.test(navigator.platform);
  renderCanvas({ tableSelection: cell }).pointerDown(click({ shiftKey: false, metaKey: mac, ctrlKey: !mac }));
  assert.equal(choices.pop().kind, "cells");
  let stopped = 0, prevented = 0;
  const e = { target: scene, currentTarget: scene, ...key("d", { metaKey: true }), nativeEvent: { isComposing: true },
    stopPropagation() { stopped++; }, preventDefault() { prevented++; } };
  renderCanvas({ tableSelection: run }).sceneKeyDown(e);
  assert.equal(stopped, 1); assert.equal(actions.length, 0);
  const commands = [];
  const { pageKeyDown } = usePageKeys({ arranging: () => true, cancel: () => commands.push("cancel"), command: name => commands.push(name) });
  pageKeyDown(e); pageKeyDown({ ...e, key: "Delete" }); pageKeyDown({ ...e, key: "Escape" });
  assert.deepEqual(commands, ["cancel"]); assert.equal(prevented, 1);
});

test("X12-W11 table commands choose and announce only after admission and refused commits record no history", async () => {
  const { useEditingCommands, useBoardDocument, render } = await harness(`
    export { useEditingCommands } from "./state/use-editing-commands.ts";
    export { useBoardDocument } from "./state/use-board-document.ts";
    export { render } from "react";
  `, { state: true });
  const k = await rules(), s = await selectionRules(), { board, table: t } = await fixture();
  const select = s.chooseCell(t, selectCell(t), address(t, 1, 1), "range"), messages = [], chosen = [];
  let outcome = "refuse", calls = 0;
  const props = { pages: { id: board.boardId }, model: { current: board }, commandReason: "", selectionReason: "", setMessage: x => messages.push(x),
    tableSelection: select, selected: new Set([t.id]), alive: { current: true }, view: { z: 1 }, scene: { current: { focus() {} } },
    finishTextSession() {}, displayedObjects: [t], clipboardState: {}, editingState: {}, chooseTable(...args) { chosen.push(args); },
    commit(next) {
      calls++;
      if (outcome === "throw") throw new Error("Board too large");
      if (outcome === "admit") return { ...next, objects: [{ ...next.objects[0], x: 99 }] };
    } };
  const action = render([], () => useEditingCommands(props)).tableAction;
  for (const mode of ["throw", "refuse", "admit"]) {
    outcome = mode; action({ at: "merge" }); assert.equal(chosen.length, mode === "admit" ? 1 : 0);
  }
  assert.equal(calls, 3);
  assert.deepEqual(messages, ["Error: Board too large"]);
  const [[selection, applied, announcement]] = chosen;
  assert.equal(applied.x, 99); assert.deepEqual(selection, selectCell(t)); assert.equal(announcement, "Cells merged");
  const { add, tableCellCount } = await document();
  for (const [rows, columns] of [[50, 20], [50, 20], [50, 20], [50, 20], [49, 20], [2, 2]]) {
    props.model.current = add(props.model.current, "table", 0, 0, props.model.current.boardId, { rows, columns });
  }
  assert.equal(tableCellCount(props.model.current.objects), 5000);
  props.tableSelection = selectRow(t);
  render([], () => useEditingCommands(props)).tableAction({ at: "duplicate", axis: "row" });
  assert.equal(calls, 3, "duplicate shortcut uses the same board-wide count as its menu");

  let admit = false;
  const doc = render([], () => useBoardDocument({ readOnly: false, setStatus() {}, hosted: { edit: () => admit } }));
  doc.load(board);
  const candidate = { ...board, objects: [k.mergeRange(t, span(t, 0, 0, 1, 1))] };
  assert.equal(doc.commit(candidate, true), undefined);
  assert.equal(doc.historyRef.current.past.length, 0);
  assert.equal(doc.model.current, board);
  admit = true;
  assert.equal(doc.commit(candidate, true), doc.model.current);
  assert.equal(doc.historyRef.current.past.length, 1);
  doc.adapter.current.destroy();
});

test("X12-W12 border and corner or Objects-panel sizing stay saved and highlight clips around merges", async () => {
  const k = await rules(), w = await web(), { board, table: t } = await fixture();
  const c = address(t, 0, 0), merged = k.setCell(k.mergeRange(t, span(t, 0, 0, 1, 1)), c, "one\ntwo\nthree\nfour\nfive\nsix");
  const layout = w.layoutTable(merged, measure), current = { ...board, objects: [merged] };
  const { useGeometryEdits, TableBody } = await harness(`
    export { useGeometryEdits } from "./state/use-geometry-edits.ts";
    export { TableBody } from "./scene/table-body.tsx";
  `, { konva: true });
  const saved = [];
  const hooks = useGeometryEdits({ model: { current }, selected: new Set([merged.id]),
    objectLayouts: new Map([[merged.id, { height: layout.box.height }]]), growTableRows: t => w.growTable(t, measure),
    tableMeasure: measure, finishTextSession() {}, commit: value => saved.push(value) });
  const border = w.tableBorders(merged, layout).find(b => b.axis === "row" && b.index === 1);
  assert.ok(layout.rows[1] > merged.rows[1].height);
  assert.equal(hooks.tableGeometry.resizedTableBorder(merged, border, layout, 10).rows[1].height, 74);
  const start = hooks.resizeStart();
  assert.equal(start[0].rectangle.height, merged.height);
  const corner = hooks.resizedBoard("se", start, 0, 64, false).objects[0];
  assert.deepEqual(corner.rows.map(r => r.height), [80, 80, 80, 80]);
  hooks.resizeBy(0, 64);
  assert.deepEqual(saved[0].objects[0].rows, corner.rows);
  const inner = w.tableBorders(merged, layout).find(b => b.axis === "row" && b.index === 0);
  const scene = TableBody({ object: merged, layout, selected: true, border: inner, zoom: 1 });
  const highlight = scene.props.children.flat(Infinity).filter(x => x?.type === "Line" && x.props.stroke === "#518de0");
  assert.deepEqual(highlight.map(line => line.props.points), [[-6, 64, 0, 64], [384, 64, 768, 64], [768, 64, 774, 64]]);
});

test("X12-W13 App keeps nine wiring substitutions and CSS preserves the link rules after the table controls", async () => {
  const app = readFileSync(new URL("../apps/web/src/App.tsx", import.meta.url), "utf8");
  const css = readFileSync(new URL("../apps/web/style.css", import.meta.url), "utf8");
  assert.match(app, /import \{ useTableArrange \} from "\.\/state\/use-table-arrange";/);
  const contract = readFileSync(new URL("../docs/architecture/0001-web-modules-v52.md", import.meta.url), "utf8");
  const wiring = contract.split("### App.tsx wiring\n")[1].split("### CSS (v52)")[0];
  const changes = [...wiring.matchAll(/^\| [1-9] \| `(.*?)` \| `(.*?)` \|$/gm)];
  assert.equal(changes.length, 9);
  for (const [, , to] of changes) assert(app.includes(to.replaceAll("\\|", "|")), to);
  assert.equal(app.split("\n").length - 1, 264);
  const start = ".context:has(.table-menu:not([hidden])) { z-index: 6; }\n";
  const rules = css.split(start)[1].split("\n.export-dialog")[0].trim().split("\n");
  assert.equal(rules.length, 17);
  assert(rules.includes(".scene > .table-insert:disabled { opacity: .45; cursor: not-allowed; }"));
  assert(css.endsWith(".inline textarea.link-open:focus + .link-selection { visibility: hidden; }\n"));
});

test("X12-W14 single-axis commands use the selected row or column through a merge", async () => {
  const { useEditingCommands, render } = await harness(`
    export { useEditingCommands } from "./state/use-editing-commands.ts";
    export { render } from "react";
  `, { state: true });
  const { mergeRange, setCell, cellText } = await rules();
  const { tableKey } = await web(), { axisMenu } = await arrangeRules();
  const { board, table } = await fixture();
  const anchor = address(table), text = "Ship CSV import";
  const filled = setCell(table, anchor, text);
  const merged = mergeRange(filled, span(table, 0, 0, 1, 1));
  const noop = () => {};
  function run(t, selection, action) {
    const model = { current: { ...board, objects: [t] } }, commits = [];
    const commands = render([], () => useEditingCommands({
      model, tableSelection: selection, selected: new Set([t.id]), displayedObjects: [t], clipboardState: {}, editingState: {},
      scene: { current: { focus: noop } }, finishTextSession: noop, chooseTable: noop,
      setMessage: assert.fail, commit(next, record) {
        assert.equal(record, true);
        commits.push(next.objects[0]);
        return model.current = next;
      },
    }));
    commands.tableAction(action);
    return commits;
  }
  for (const axis of ["row", "column"]) {
    const rows = axis === "row", entries = rows ? "rows" : "columns";
    const select = rows ? selectRow : selectColumn;
    const original = merged[entries].map(entry => entry.id);
    const menuFor = (t, selection) => axisMenu(t, selection, axis, true, 16).items;
    const addKeys = rows
      ? [key("Enter", { altKey: true, shiftKey: true }), key("Enter", { altKey: true })]
      : [key("[", { code: "BracketLeft", altKey: true }), key("]", { code: "BracketRight", altKey: true })];
    for (const index of [0, 1]) {
      const selection = select(merged, index), menu = menuFor(merged, selection);
      const item = (at, by) => menu.find(item => item.action.at === at && item.action.by === by);
      const actionFor = e => tableKey(merged, selection, e, false, false, false).action;
      const remove = item("delete");
      assert.equal(remove.disabled, false);
      assert.deepEqual(actionFor(key("Delete")), remove.action);
      const removed = run(merged, selection, remove.action);
      assert.equal(removed.length, 1);
      const [afterDelete] = removed;
      assert.deepEqual(afterDelete[entries].map(entry => entry.id), original.filter((_, i) => i !== index));
      assert.deepEqual(afterDelete.merges, [{ ...merged.merges[0], [axis]: original[1 - index], [entries]: 1 }]);
      assert.equal(cellText(afterDelete, afterDelete.merges[0]), index === 0 ? "" : text);

      const previous = item("move", -1), following = item("move", 1), duplicate = item("duplicate");
      assert.equal(previous.reason, index === 0 ? `Already the first ${axis}` : "A merged cell is in the way");
      assert.equal(following.reason, "A merged cell is in the way");
      assert.equal(duplicate.reason, "A merged cell is in the way");
      assert.deepEqual(actionFor(key("d", { metaKey: true })), duplicate.action);
      for (const { action, disabled } of [previous, following, duplicate]) {
        assert(disabled);
        assert.deepEqual(run(merged, selection, action), []);
      }
      for (const [offset, at] of ["before", "after"].entries()) {
        const add = item(at), gap = index + offset;
        assert.equal(add.disabled, false);
        assert.deepEqual(actionFor(addKeys[offset]), add.action);
        const added = run(merged, selection, add.action);
        assert.equal(added.length, 1);
        const [afterAdd] = added;
        const newOrder = afterAdd[entries].map(entry => entry.id);
        assert(!original.includes(newOrder[gap]));
        assert.deepEqual(newOrder.toSpliced(gap, 1), original);
        assert.deepEqual(afterAdd.merges, [{ ...merged.merges[0], [entries]: gap === 1 ? 3 : 2 }]);
        assert.equal(cellText(afterAdd, anchor), text);
      }
    }
    const contained = mergeRange(filled, span(table, 0, 0, rows ? 0 : 1, rows ? 1 : 0));
    const selection = select(contained), menu = menuFor(contained, selection);
    const move = menu.find(item => item.action.at === "move" && item.action.by === 1);
    const duplicate = menu.find(item => item.action.at === "duplicate");
    assert(!move.disabled && !duplicate.disabled);
    const [moved] = run(contained, selection, move.action);
    assert.deepEqual(moved[entries].map(entry => entry.id), [original[1], original[0], ...original.slice(2)]);
    assert.deepEqual(moved.merges, contained.merges);
    const [copied] = run(contained, selection, duplicate.action);
    assert.deepEqual(copied.merges, [contained.merges[0], { ...contained.merges[0], [axis]: copied[entries][1].id }]);
    assert.equal(cellText(copied, copied.merges[1]), text);
  }
});

test("X12-W15 dragging hides both grabber tooltips without changing the buttons' keys or names", async () => {
  const { TableButtons } = await harness('export { TableButtons } from "./scene/table-buttons.tsx";');
  const { chooseAxis } = await selectionRules(), { layoutTable } = await web(), { table: t } = await fixture();
  const noop = () => {}, object = { ...t, tableLayout: layoutTable(t, measure) };
  for (const axis of ["row", "column"]) {
    const select = axis === "row" ? selectRow : selectColumn;
    const [id, end] = ids(t, axis, 0, 1), selection = chooseAxis(t, select(t), axis, end, "range");
    const arrange = { hover: {}, press: noop, move: noop, release: noop, lost: noop, key: noop, click: noop, insert: noop };
    const props = { object, selection, zoom: 1, pos: noop, action: noop, select: noop, focus: noop };
    const buttons = (opts) => TableButtons({ ...props, ...opts }).props.children.filter(node => node.props["aria-pressed"]);
    const idle = buttons({ arrange });
    const moving = buttons({ busy: true, arrange: { ...arrange, dragging: { axis, id } } });
    const identities = nodes => nodes.map(node => [node.key, node.props["aria-label"]]);
    const hasTip = node => node.props.children.props.children.some(child => child?.props?.className === "mind-map-tip");
    assert.equal(idle.length, 2);
    assert.deepEqual(identities(moving), identities(idle));
    assert(idle.every(hasTip));
    assert(!moving.some(hasTip));
  }
});
