// SPDX-License-Identifier: Apache-2.0
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { catalog } from "../apps/web/src/activities/catalog.ts";
import { activityBox, activityPreview, activityView, insertActivity, readActivity } from "../apps/web/src/activities.ts";
import { readBoardFile, writeBoardFile } from "../apps/web/src/board-file.ts";
import { add, canonical, empty as emptyBoard, validate } from "../apps/web/src/document.ts";
import { emptyHistory, record, redo, undo } from "../apps/web/src/history.ts";
import { groupObjects } from "../apps/web/src/group.ts";
import { hasEnds, hasRectangle, isContainer, orderBand, rectangleType } from "../apps/web/src/objects/registry.ts";

const empty = () => ({ ...emptyBoard(), title: "Synthetic activities" });
const view = { x: 230, y: -170, z: 1 }, size = { w: 1280, h: 800 };
const activities = await Promise.all(catalog.map(readActivity));
const identifiers = (board) => [board.boardId, ...board.retiredGenerations,
  ...board.objects.flatMap((o) => [o.id, o.generation, ...(o.group ? [o.group] : [])])];
const addedObjects = (result) => result.board.objects.filter((o) => result.ids.includes(o.id));
const centre = (box) => ({ x: (box.left + box.right) / 2, y: (box.top + box.bottom) / 2 });
const fromRaw = (file) => new Blob([file]);

// These assertions deliberately repeat the public catalogue, not its implementation.
test("catalogue has exactly the three contracted entries, fields, order and provenance", () => {
  const rows = [
    ["retrospective", "Retrospective", "Look back together: what went well, what to improve, actions."],
    ["brainstorm", "Brainstorm", "A topic in the middle and ideas around it."],
    ["kanban", "Kanban", "Track work from to do, through doing, to done."],
  ];
  assert.equal(catalog.length, rows.length);
  catalog.forEach((entry, i) => {
    const [id, name, description] = rows[i];
    assert.deepEqual(Object.keys(entry).sort(), ["id", "name", "description", "author", "license", "version", "file"].sort());
    assert.deepEqual({ ...entry, file: undefined }, { id, name, description, author: "NextPhase", license: "Apache-2.0", version: 1, file: undefined });
    assert.match(entry.id, /^[a-z]+(?:-[a-z]+)*$/);
    assert(entry.description.length <= 80);
  });
});

for (const [i, entry] of catalog.entries()) {
  test(`${entry.id}: exact file bytes, board file rules, version, title, size and only file exported`, async () => {
    const raw = readFileSync(new URL(`../docs/briefs/0008-W1-activities/${entry.id}.nextboard`, import.meta.url));
    assert.deepEqual(Buffer.from(entry.file, "utf8"), raw);
    const module = await import(`../apps/web/src/activities/${entry.id}.ts`);
    assert.deepEqual(Object.keys(module), ["file"]);
    assert.equal(module.file, entry.file);
    const board = await readBoardFile(fromRaw(entry.file));
    assert.deepEqual(board, activities[i]);
    validate(board);
    assert.equal(board.schemaVersion, 7);
    assert.equal(board.title, entry.name);
    assert(board.objects.length >= 1 && board.objects.length <= 40);
    assert.equal(await writeBoardFile(board), entry.file);
  });
}

test("box uses saved rectangles, ignores connector geometry and returns null without rectangles", () => {
  const activity = activities[1];
  assert.deepEqual(activityBox(activity.objects), { left: -620, top: -650, right: 620, bottom: 520 });
  assert.deepEqual(activityBox(activity.objects.filter(hasRectangle)), activityBox(activity.objects));
  assert.equal(activityBox([]), null);
  assert.equal(activityBox(activity.objects.filter(hasEnds)), null);
  assert.deepEqual(activityBox([{ ...activity.objects.find(hasRectangle), x: 25, y: -30, width: 70, height: 80, displayHeight: 8000 }]),
    { left: 25, top: -30, right: 95, bottom: 50 });
});

test("empty placement centres the activity box on the current view", () => {
  for (const activity of activities) {
    const board = empty(), before = structuredClone(board);
    const result = insertActivity(board, activity, view, size), copies = addedObjects(result);
    assert.deepEqual(centre(activityBox(copies)), { x: view.x, y: view.y });
    const sourceBox = activityBox(activity.objects);
    for (const [i, source] of activity.objects.entries()) {
      if (!hasRectangle(source)) continue;
      const copy = copies[i];
      assert.equal(copy.x - source.x, view.x - centre(sourceBox).x);
      assert.equal(copy.y - source.y, view.y - centre(sourceBox).y);
    }
    assert.deepEqual(board, before);
    validate(result.board);
  }
});

test("nonempty placement uses saved edges and repeats 120 units to the right with tops equal", () => {
  let board = add(empty(), "text", -230, 310);
  board.objects[0] = { ...board.objects[0], y: 310, height: 80, displayHeight: 5000 };
  const first = insertActivity(board, activities[2], view, size), box = activityBox(addedObjects(first));
  assert.equal(box.left, activityBox(board.objects).right + 120);
  assert.equal(box.top, 310);
  const second = insertActivity(first.board, activities[0], view, size), nextBox = activityBox(addedObjects(second));
  assert.equal(nextBox.left, activityBox(first.board.objects).right + 120);
  assert.equal(nextBox.top, box.top);
  assert(first.ids.every((id) => !second.ids.includes(id)));
  // The drawn-only test field was never used to place either copy.
  assert.equal(nextBox.top, 310);
});

test("adding Retrospective twice makes independent copies to the right and leaves the first unchanged", () => {
  const first = insertActivity(empty(), activities[0], view, size), before = structuredClone(first.board);
  const second = insertActivity(first.board, activities[0], first.view, size);
  const firstBox = activityBox(addedObjects(first)), secondBox = activityBox(addedObjects(second));
  assert.equal(secondBox.left, firstBox.right + 120);
  assert.equal(secondBox.top, firstBox.top);
  assert.equal(second.ids.length, 7);
  assert(second.ids.every((id) => !identifiers(first.board).includes(id)));
  for (const old of before.objects) {
    assert.deepEqual({ ...second.board.objects.find((o) => o.id === old.id), order: old.order }, old);
  }
  assert.deepEqual(first.board, before);
  validate(second.board);
});

for (const edge of [-1e6, 1e6]) {
  test(`placement clamps saved rectangles at both coordinate axes near ${edge}`, () => {
    const result = insertActivity(empty(), activities[0], { x: edge, y: edge, z: 1 }, size);
    for (const o of addedObjects(result).filter(hasRectangle)) {
      assert(o.x >= -1e6 && o.y >= -1e6);
      assert(o.x + o.width <= 1e6 && o.y + o.height <= 1e6);
    }
    assert.deepEqual(centre(activityBox(addedObjects(result))), { x: result.view.x, y: result.view.y });
    validate(result.board);
  });
}

test("copies have fresh identities, preserve content and remap groups, sections and connector ends in three bands", () => {
  const originalFiles = catalog.map((e) => e.file);
  for (const activity of activities) {
    let source = structuredClone(activity);
    const ideas = source.objects.filter((o) => hasRectangle(o) && !isContainer(o));
    source = groupObjects(source, new Set(ideas.slice(0, 2).map((o) => o.id)));
    source.objects.find((o) => o.id === ideas[0].id).marks = [{ start: 0, end: 1, bold: true }];
    source.retiredGenerations = [crypto.randomUUID()];
    const board = insertActivity(empty(), activities[1], view, size).board;
    const before = structuredClone(board), sourceBefore = structuredClone(source);
    const result = insertActivity(board, source, view, size), copies = addedObjects(result);
    const idMap = new Map(source.objects.map((o, i) => [o.id, copies[i].id]));
    const reserved = new Set([...identifiers(source), ...identifiers(board)]);
    const newIds = [...copies.flatMap((o) => [o.id, o.generation]), ...new Set(copies.map((o) => o.group).filter(Boolean))];
    assert.equal(newIds.length, new Set(newIds).size);
    for (const id of newIds) assert(!reserved.has(id));
    assert.equal(copies.length, source.objects.length);
    for (const [i, copy] of copies.entries()) {
      const original = source.objects[i];
      assert.equal(copy.type, original.type);
      assert.equal(copy.section, original.section ? idMap.get(original.section) : null);
      assert.equal(copy.group === null, original.group === null);
      for (const key of ["text", "color", "textSize", "align", "marks", "shape", "fill", "border", "width", "height"]) {
        assert.deepEqual(copy[key], original[key], key);
      }
      if (hasEnds(copy)) {
        assert.deepEqual(copy.from, { ...original.from, object: idMap.get(original.from.object) });
        assert.deepEqual(copy.to, { ...original.to, object: idMap.get(original.to.object) });
      }
      for (const other of copies) {
        const old = source.objects.find((o) => idMap.get(o.id) === other.id);
        assert.equal(copy.group && copy.group === other.group, original.group && original.group === old.group);
      }
    }
    for (let band = 0; band < 3; band++) {
      assert.deepEqual(result.board.objects.filter((o) => orderBand(o) === band).map((o) => o.id),
        [...board.objects.filter((o) => orderBand(o) === band), ...copies.filter((o) => orderBand(o) === band)].map((o) => o.id));
    }
    assert.deepEqual(result.board.objects.map(orderBand), result.board.objects.map(orderBand).sort());
    for (const old of board.objects) {
      assert.deepEqual({ ...result.board.objects.find((o) => o.id === old.id), order: old.order }, old);
    }
    assert.equal(result.board.boardId, board.boardId);
    assert.equal(result.board.title, board.title);
    assert.deepEqual(result.board.retiredGenerations, board.retiredGenerations);
    assert.deepEqual(board, before);
    assert.deepEqual(source, sourceBefore);
    copies.find((o) => o.marks.length).marks[0].end = 2;
    assert.deepEqual(source, sourceBefore);
    validate(result.board);
  }
  assert.deepEqual(catalog.map((e) => e.file), originalFiles);
});

test("identity allocator refuses source identities, board identities and new duplicates", (t) => {
  const activity = activities[0], board = add(empty(), "sticky", 0, 0);
  const randomUUID = crypto.randomUUID.bind(crypto);
  const unique = randomUUID(), offers = [...identifiers(activity), ...identifiers(board), unique, unique];
  t.mock.method(crypto, "randomUUID", () => offers.shift() ?? randomUUID());
  const result = insertActivity(board, activity, view, size);
  assert.equal(offers.length, 0);
  validate(result.board);
});

test("one history step undoes the entire activity and redo restores IDs with fresh generations, keeping the view", () => {
  for (const activity of activities) {
    const board = insertActivity(empty(), activities[2], view, size).board;
    const result = insertActivity(board, activity, view, size), savedView = structuredClone(result.view);
    const history = record(emptyHistory(), board, result.board);
    assert.equal(history.past.length, 1);
    const undone = undo(result.board, history);
    assert.deepEqual(undone.board.objects, board.objects);
    assert(result.ids.every((id) => !undone.board.objects.some((o) => o.id === id)));
    const restored = redo(undone.board, undone.history);
    assert.deepEqual(restored.board.objects.map((o) => o.id), result.board.objects.map((o) => o.id));
    for (const o of restored.board.objects.filter((o) => result.ids.includes(o.id))) {
      assert.notEqual(o.generation, result.board.objects.find((old) => old.id === o.id).generation);
    }
    assert.deepEqual(result.view, savedView);
    validate(restored.board);
  }
});

test("view keeps fitting zoom, reserves 48 CSS pixels each side, and chooses the largest fitting lower quarter step", () => {
  const box = { left: 100, top: -200, right: 1100, bottom: 300 };
  for (const z of [.5, .83, 1, 2]) {
    assert.deepEqual(activityView(box, { ...view, z }, { w: 1000 * z + 96, h: 500 * z + 96 }), { x: 600, y: 50, z });
  }
  assert.equal(activityView(box, { ...view, z: 2 }, { w: 1596, h: 1200 }).z, 1.5);
  assert.equal(activityView(box, { ...view, z: .83 }, { w: 846, h: 1000 }).z, .75);
  assert.equal(activityView(box, { ...view, z: .83 }, { w: 845, h: 1000 }).z, .5);
  assert.equal(activityView(box, { ...view, z: 2 }, { w: 900, h: 471 }).z, .75);
  assert.equal(activityView(box, { ...view, z: 1 }, { w: 100, h: 100 }).z, .5);
  assert.equal(insertActivity(empty(), activities[0], { ...view, z: 1 }, size).view.z, .5);
  assert.equal(insertActivity(empty(), activities[2], { ...view, z: 1 }, size).view.z, .75);
});

test("249 + 7 refuses without changing either input; an unreadable file preserves its first refusal reason", async () => {
  let board = empty();
  for (let i = 0; i < 249; i++) board = add(board, "sticky", i * 100, 0);
  const before = canonical(board), activity = structuredClone(activities[0]);
  assert.throws(() => insertActivity(board, activity, view, size), /^Error: 250 object limit reached$/);
  assert.equal(canonical(board), before);
  assert.deepEqual(activity, activities[0]);
  const corrupt = JSON.parse(catalog[0].file);
  corrupt.sha256 = "0".repeat(64);
  await assert.rejects(async () => insertActivity(board, await readActivity({ name: "Retrospective", file: JSON.stringify(corrupt) }), view, size),
    /^Error: it is damaged$/);
  assert.equal(canonical(board), before);
  await assert.rejects(readActivity({ name: "Wrong title", file: catalog[0].file }), /^Error: it is not a valid board$/);
  await assert.rejects(readActivity({ name: "Empty", file: await writeBoardFile({ ...empty(), title: "Empty" }) }), /^Error: it is not a valid board$/);
});

test("previews contain padded viewBox, container frames, registry colours, connector end centres and no text", () => {
  for (const activity of activities) {
    const preview = activityPreview(activity.objects), box = activityBox(activity.objects);
    assert.equal(preview.viewBox, `${box.left - 40} ${box.top - 40} ${box.right - box.left + 80} ${box.bottom - box.top + 80}`);
    assert.equal(preview.preserveAspectRatio, "xMidYMid meet");
    assert.equal(preview.rectangles.length, activity.objects.filter(hasRectangle).length);
    for (const rect of preview.rectangles) {
      const o = activity.objects.find((o) => o.id === rect.id), style = rectangleType(o.type);
      assert.deepEqual([rect.x, rect.y, rect.width, rect.height], [o.x, o.y, o.width, o.height]);
      assert.equal(rect.fill, isContainer(o) ? "#f0eff3" : style.fill(o) ?? "none");
      assert.equal(rect.stroke, isContainer(o) ? "#dbd9df" : style.fill(o) ? "none" : style.edge(o) ?? "#dedede");
      assert(!("text" in rect));
    }
    assert.equal(preview.lines.length, activity.objects.filter(hasEnds).length);
    for (const line of preview.lines) {
      const o = activity.objects.find((o) => o.id === line.id);
      const from = activity.objects.find((r) => r.id === o.from.object), to = activity.objects.find((r) => r.id === o.to.object);
      assert.deepEqual(line, { id: o.id, x1: from.x + from.width / 2, y1: from.y + from.height / 2,
        x2: to.x + to.width / 2, y2: to.y + to.height / 2, stroke: "#6b6b6b" });
      assert(!("text" in line));
    }
  }
  const shape = activities[1].objects.find((o) => o.type === "shape");
  const borderOnly = { ...shape, fill: { mode: "none", color: "light-blue" } };
  const noPaint = { ...borderOnly, border: { style: "none", color: "blue" } };
  assert.deepEqual(activityPreview([borderOnly]).rectangles.map((r) => [r.fill, r.stroke]), [["none", rectangleType(shape.type).edge(shape)]]);
  assert.deepEqual(activityPreview([noPaint]).rectangles.map((r) => [r.fill, r.stroke]), [["none", "#dedede"]]);
});
