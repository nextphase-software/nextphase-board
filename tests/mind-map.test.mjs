// SPDX-License-Identifier: Apache-2.0
import { withoutPages } from "./import-fixture.mjs";
// 0009-W2 mind maps. Every check imports its subject dynamically, so on the
// baseline each one fails by name rather than aborting the file.
import test from "node:test";
import assert from "node:assert/strict";
import * as Y from "yjs";

const root = new URL("../", import.meta.url);
const load = (path) => import(new URL(path, root).href);
const rules = () => load("packages/board-rules/src/document.ts");
const registry = () => load("packages/board-rules/src/objects/registry.ts");
const map = () => load("apps/web/src/mind-map.ts");
// Fixed measurements: a bold code point is 0.6 of the size, a regular one 0.5.
const text = (value, bold, size) => Array.from(value).length * size * (bold ? 0.6 : 0.5);
const measureNode = async () => { const { nodeBox } = await map(); return (value, isRoot) => nodeBox(value, isRoot, text); };
const named = (board, value) => board.objects.find((o) => o.text === value);
const titled = async () => { const { empty } = await rules(); return { ...empty(), title: "Planning map" }; };

async function starter(at = { x: 560, y: 450 }) {
  const { starterMap } = await map();
  return starterMap(await titled(), at, await measureNode());
}
// The mock-up's grown map: both sides, three levels.
async function grown() {
  const { addChild, layoutRoots } = await map(), measure = await measureNode();
  let { board, id } = await starter();
  const rename = (from, to) => { board = { ...board, objects: board.objects.map((o) => o.text === from ? { ...o, text: to, ...measure(to, o.parent === null) } : o) }; };
  const child = (parent, value, side) => {
    const result = addChild(board, named(board, parent).id, measure, side);
    board = { ...result.board, objects: result.board.objects.map((o) => o.id === result.id ? { ...o, text: value, ...measure(value, false) } : o) };
  };
  rename("Main topic", "Launch plan"); rename("First idea", "Goals"); rename("Second idea", "Risks"); rename("Third idea", "Owners");
  child("Goals", "Grow sign-ups"); child("Goals", "Keep costs flat");
  child("Risks", "Late design sign-off"); child("Risks", "Server limits"); child("Server limits", "Load tests");
  child("Launch plan", "Questions", "left"); child("Questions", "Which regions first?"); child("Questions", "Do we need a beta?");
  return { board: { ...board, objects: layoutRoots(board.objects, [id]) }, id };
}

test("MM-U1 the mindNode record holds its keys, values and defaults", async () => {
  const { OBJECT_TYPES, objectType, objectKeys, ADD_OPTIONS, isMindNode, eligibleIdea, sectionIdea, eligibleVote, labelPrefix, fontSize, textBox, placementTool } = await registry();
  const record = objectType("mindNode");
  assert.equal(OBJECT_TYPES.at(-2), record); assert.equal(record.validFrom, 11);
  assert.equal(record.tool, "Mind map"); assert.equal(record.label, "Mind map node"); assert.equal(placementTool("Mind map"), record);
  assert.deepEqual(record.extraKeys, ["parent", "side", "rank", "collapsed"]);
  assert.deepEqual(record.defaults(), { parent: null, side: null, rank: 0, collapsed: false });
  assert.equal(record.textLimit, 200); assert.equal(record.initialText, ""); assert.equal(record.richText, false);
  assert.equal(record.growsWithText, false); assert.equal(record.voting, false); assert.equal(record.container, false);
  assert.deepEqual(record.defaultSize, { width: 120, height: 39 }); assert.deepEqual(record.sizeRange, { min: 1, max: 20000 });
  assert.deepEqual(record.editorMinimum, { width: 0, height: 0 }); assert.equal(record.previewRadius, 0); assert.equal(record.draws, false);
  assert.deepEqual(record.defaultStyle, { color: "neutral", textSize: "medium", align: "left" });
  assert.deepEqual(record.legacyStyle, record.defaultStyle); assert.equal(record.shapePaint, false); assert.deepEqual(record.kinds, []);
  assert.equal(record.fill({ color: "rose" }), undefined); assert.equal(record.edge({ color: "rose" }), undefined);
  assert.equal(record.textColor({ color: "blue" }), "#2a55a0");
  const node = { type: "mindNode", textSize: "medium", x: 10, y: 20, width: 100, height: 39 };
  assert.equal(fontSize({ ...node, parent: null }), 24); assert.equal(fontSize({ ...node, parent: "p" }), 18);
  assert.deepEqual(textBox(node), { x: 18, y: 26, width: 84, height: 27 }); assert.equal(labelPrefix(node), "mind map node");
  assert.equal(isMindNode(node), true); assert.equal(eligibleIdea(node), false); assert.equal(sectionIdea(node), false);
  assert.equal(eligibleVote(node), false); assert(!ADD_OPTIONS.some((o) => o.type === "mindNode"));
  assert.deepEqual(objectKeys("mindNode", 13), ["id", "generation", "type", "page", "text", "color", "textSize", "align", "group", "marks", "section",
    "parent", "side", "rank", "collapsed", "x", "y", "width", "height", "order"]);
});

test("MM-U2 schema 11: new boards, reading 1 to 10, newer versions and canonical keys", async () => {
  const { empty, upgrade, validate, canonical, add } = await rules();
  assert.equal(empty().schemaVersion, 18);
  for (let version = 1; version <= 11; version++) {
    const board = { ...withoutPages(empty()), schemaVersion: version, title: "Old" };
    assert.equal(validate(board).schemaVersion, version);
    assert.equal(upgrade(board).schemaVersion, 18);
  }
  const ten = add({ ...empty(), title: "Ten" }, "sticky", 0, 0), old = { ...withoutPages(ten), schemaVersion: 10 };
  assert.deepEqual(withoutPages(upgrade(old)).objects, old.objects);
  assert.throws(() => validate({ ...empty(), title: "New", schemaVersion: 19 }));
  const { board } = await starter();
  const parsed = JSON.parse(canonical(board));
  assert.deepEqual(Object.keys(parsed.objects[0]), ["id", "generation", "type", "page", "text", "color", "textSize", "align", "group", "marks", "section",
    "parent", "side", "rank", "collapsed", "x", "y", "width", "height", "order"]);
  const placed = add({ ...empty(), title: "Root" }, "mindNode", 0, 0);
  assert.equal(validate(placed).objects[0].parent, null);
  assert.throws(() => validate({ ...board, schemaVersion: 10 }));
});

test("MM-U3 the structure rule refuses each broken map", async () => {
  const { validate } = await rules();
  const { board } = await starter();
  const [top, a, b] = board.objects;
  const change = (patches) => ({ ...board, objects: board.objects.map((o) => ({ ...o, ...patches[o.id] })) });
  assert.doesNotThrow(() => validate(board));
  const cases = {
    "missing parent": change({ [a.id]: { parent: crypto.randomUUID() } }),
    "self parent": change({ [a.id]: { parent: a.id, side: null } }),
    "loop": change({ [a.id]: { parent: b.id, side: null }, [b.id]: { parent: a.id, side: null } }),
    "first-level node without a side": change({ [a.id]: { side: null } }),
    "deeper node with a side": change({ [b.id]: { parent: a.id } }),
    "collapsed root": change({ [top.id]: { collapsed: true } }),
    "root with a side": change({ [top.id]: { side: "left" } }),
    "201 code points": change({ [a.id]: { text: "x".repeat(201) } }),
    "line break": change({ [a.id]: { text: "a" + String.fromCharCode(0x2028) + "b" } }),
    "rank above 9999": change({ [a.id]: { rank: 10000 } }),
    "fractional rank": change({ [a.id]: { rank: 0.5 } }),
    "bad side": change({ [a.id]: { side: "up" } }),
    "text size": change({ [a.id]: { textSize: "large" } }),
    "marks": change({ [a.id]: { marks: [{ start: 0, end: 1, bold: true }] } }),
  };
  for (const [name, value] of Object.entries(cases)) assert.throws(() => validate(value), Error, name);
  const sticky = { ...board.objects[0], id: crypto.randomUUID(), generation: crypto.randomUUID(), type: "sticky", color: "rose", order: 4 };
  for (const key of ["parent", "side", "rank", "collapsed"]) delete sticky[key];
  delete sticky.text; sticky.text = "Card";
  const withSticky = { ...board, objects: [...board.objects, sticky] };
  assert.doesNotThrow(() => validate(withSticky));
  assert.throws(() => validate({ ...withSticky, objects: withSticky.objects.map((o) => o.id === a.id ? { ...o, parent: sticky.id, side: null } : o) }), Error, "sticky parent");
  assert.throws(() => validate({ ...withSticky, objects: withSticky.objects.map((o) => o.id === sticky.id ? { ...o, parent: null } : o) }), Error, "parent on a sticky");
  const missing = { ...a }; delete missing.collapsed;
  assert.throws(() => validate({ ...board, objects: board.objects.map((o) => o.id === a.id ? missing : o) }), Error, "missing key");
  assert.throws(() => validate({ ...board, objects: board.objects.map((o) => o.id === a.id ? { ...o, extra: 1 } : o) }), Error, "extra key");
  const twin = change({ [b.id]: { rank: 0 } });
  assert.doesNotThrow(() => validate(twin), "siblings may share a rank");
});

test("MM-U4 box: wrap at 320, 8 and 6 px insets, rounded up, placeholder when empty", async () => {
  const { nodeBox, nodeLines } = await map();
  assert.deepEqual(nodeBox("Main topic", true, text), { width: 160, height: 47 });
  assert.deepEqual(nodeBox("First idea", false, text), { width: 106, height: 39 });
  assert.deepEqual(nodeBox("", false, text), nodeBox("Add text", false, text));
  assert.deepEqual(nodeBox("abc", false, (v) => Array.from(v).length * 7.3), { width: 38, height: 39 });
  const long = Array.from({ length: 10 }, () => "abcde").join(" ");
  const lines = nodeLines(long, false, text);
  assert(lines.length > 1 && lines.every((line) => line.width <= 320), "wraps within 320");
  assert.deepEqual(nodeBox(long, false, text), { width: Math.ceil(Math.max(...lines.map((l) => l.width)) + 16), height: Math.ceil(lines.length * 18 * 1.45 + 12) });
  const word = "x".repeat(60);
  assert(nodeLines(word, false, text).length > 1, "a word longer than 320 breaks between characters");
  assert.equal(nodeBox(word, false, text).width, Math.ceil(Math.max(...nodeLines(word, false, text).map((l) => l.width)) + 16));
});

test("MM-U5 starter map: four nodes centred on the click, laid out as the mock-up", async () => {
  const { board, id } = await starter();
  const [top, ...ideas] = board.objects;
  assert.equal(board.objects.length, 4); assert.equal(top.id, id);
  assert.deepEqual([top.text, ...ideas.map((o) => o.text)], ["Main topic", "First idea", "Second idea", "Third idea"]);
  assert.deepEqual([top.parent, top.side, top.collapsed], [null, null, false]);
  assert.deepEqual(ideas.map((o) => [o.parent, o.side, o.rank]), [[id, "right", 0], [id, "right", 1], [id, "right", 2]]);
  assert.deepEqual([top.x, top.y, top.width, top.height], [480, 427, 160, 47]);
  for (const o of ideas) { assert.equal(o.x, top.x + top.width + 72); assert.equal(o.height, 39); }
  assert.deepEqual(ideas.map((o) => o.y), [360, 431, 502]);
  assert.equal(ideas[1].y + ideas[1].height / 2, top.y + top.height / 2);
  assert.deepEqual(board.objects.map((o) => o.order), [0, 1, 2, 3]);
});

test("MM-U6 layout: columns on both sides, blocks, centring, one rounding and idempotence", async () => {
  const { layoutRoots, settle } = await map();
  const { board, id } = await grown();
  const box = (value) => named(board, value);
  const top = box("Launch plan"), mid = (o) => o.y + o.height / 2;
  // Right: column 1 after the root, column 2 after the widest of column 1, column 3 after that.
  const column1 = ["Goals", "Risks", "Owners"].map(box), column2 = ["Grow sign-ups", "Keep costs flat", "Late design sign-off", "Server limits"].map(box);
  for (const o of column1) assert.equal(o.x, top.x + top.width + 72);
  for (const o of column2) assert.equal(o.x, column1[0].x + Math.max(...column1.map((n) => n.width)) + 72);
  assert.equal(box("Load tests").x, column2[0].x + Math.max(...column2.map((n) => n.width)) + 72);
  // Left: mirrored; a node's right edge sits on its column.
  assert.equal(box("Questions").x + box("Questions").width, top.x - 72);
  for (const value of ["Which regions first?", "Do we need a beta?"]) assert.equal(box(value).x + box(value).width, box("Questions").x - 72);
  assert.equal(mid(box("Questions")), mid(top));
  // Blocks: leaves 32 px apart, parents centred on their blocks, the stack centred on the root.
  assert.equal(box("Keep costs flat").y - (box("Grow sign-ups").y + 39), 32);
  assert.equal(Math.abs(mid(box("Goals")) - (mid(box("Grow sign-ups")) + mid(box("Keep costs flat"))) / 2) <= 0.5, true);
  const blocks = [39 + 32 + 39, 39 + 32 + 39, 39];
  const first = mid(top) - (blocks.reduce((a, b) => a + b) + 64) / 2;
  assert.equal(box("Goals").y, Math.round(first + blocks[0] / 2 - 19.5));
  for (const o of board.objects) { assert(Number.isInteger(o.x) && Number.isInteger(o.y), o.text); }
  assert.strictEqual(layoutRoots(board.objects, [id]), board.objects, "laying out twice changes nothing");
  assert.strictEqual(settle(board, board), board);
  // Rounding: the root is rounded first (halves up) and every other node once.
  const shifted = { ...board, objects: board.objects.map((o) => o.id === id ? { ...o, x: o.x + 0.5, y: o.y - 0.5 } : o) };
  const moved = layoutRoots(shifted.objects, [id]), movedRoot = moved.find((o) => o.id === id);
  assert.deepEqual([movedRoot.x, movedRoot.y], [top.x + 1, top.y]);
  // Ranks are rewritten 0, 1, 2 in order (rank, then id).
  const shuffled = board.objects.map((o) => o.text === "Goals" ? { ...o, rank: 7 } : o.text === "Owners" ? { ...o, rank: 5 } : o);
  const ranked = layoutRoots(shuffled, [id]);
  assert.deepEqual(["Risks", "Questions", "Owners", "Goals"].map((v) => ranked.find((o) => o.text === v).rank), [0, 1, 2, 3]);
});

test("MM-U7 add child and sibling: ranks, sides, expansion and the new empty node", async () => {
  const { addChild, addSibling, collapse, children } = await map(), measure = await measureNode();
  let { board, id } = await starter();
  const second = named(board, "Second idea").id;
  const child = addChild(board, second, measure);
  const node = child.board.objects.find((o) => o.id === child.id);
  assert.deepEqual([node.text, node.parent, node.side, node.rank, node.width, node.height], ["", second, null, 0, 88, 39]);
  const sibling = addSibling(board, second, measure);
  assert.deepEqual(children(sibling.board.objects, id).map((o) => [o.text, o.rank]), [["First idea", 0], ["Second idea", 1], ["", 2], ["Third idea", 3]]);
  assert.equal(sibling.board.objects.find((o) => o.id === sibling.id).side, "right");
  assert.equal(addSibling(board, id, measure), undefined, "a root has no sibling");
  const left = addChild(board, id, measure);
  assert.equal(left.board.objects.find((o) => o.id === left.id).side, "left", "fewer first-level nodes on the left");
  let even = board;
  for (let i = 0; i < 3; i++) even = addChild(even, id, measure, "left").board;
  const tie = addChild(even, id, measure);
  assert.equal(tie.board.objects.find((o) => o.id === tie.id).side, "right", "right when equal");
  const nested = addChild(child.board, child.id, measure).board;
  const folded = collapse(nested, child.id, true);
  const reopened = addChild(folded, child.id, measure);
  assert.equal(reopened.board.objects.find((o) => o.id === child.id).collapsed, false, "adding to a collapsed node expands it");
});

test("MM-U8 reparent, detach, join and the cycle rule", async () => {
  const { reparent, detach, canReparent, descendants, outerSide, dropTarget, dragPreview } = await map(), measure = await measureNode();
  const { validate } = await rules();
  const { board, id } = await grown();
  const goals = named(board, "Goals"), limits = named(board, "Server limits"), risks = named(board, "Risks");
  const moved = reparent(board, limits.id, goals.id, "right", measure);
  validate(moved);
  const after = (value) => named(moved, value);
  assert.equal(after("Server limits").parent, goals.id); assert.equal(after("Server limits").rank, 2);
  assert.equal(after("Load tests").parent, limits.id); assert.equal(after("Server limits").side, null);
  assert.equal(after("Server limits").x, after("Grow sign-ups").x);
  assert.equal(canReparent(board.objects, risks.id, limits.id), false); assert.equal(canReparent(board.objects, risks.id, risks.id), false);
  assert.strictEqual(reparent(board, risks.id, limits.id, "right", measure), board, "never under a descendant");
  // Drop targets never offer the dragged branch; a root target picks the pointer's side.
  const branch = new Set([risks.id, ...descendants(board.objects, risks.id).map((o) => o.id)]);
  assert.equal(dropTarget(board.objects, { x: limits.x + 2, y: limits.y + 2 }, branch), null);
  assert.deepEqual(dropTarget(board.objects, { x: goals.x + 2, y: goals.y + 2 }, branch), { target: goals.id, side: "right" });
  const top = named(board, "Launch plan");
  assert.equal(dropTarget(board.objects, { x: top.x + 2, y: top.y + 2 }, branch).side, "left");
  // The drag draws the rest of the map laid out without the branch.
  const preview = dragPreview(board, risks.id, 100, 0);
  assert.equal(preview.objects.find((o) => o.id === risks.id).x, risks.x + 100);
  assert.notEqual(preview.objects.find((o) => o.text === "Owners").y, named(board, "Owners").y);
  // Detach: a separate map in root look, centred where the dragged box was, children on the right.
  const questions = named(board, "Questions");
  const centre = { x: 200, y: 600 };
  const split = detach(board, questions.id, centre, measure);
  validate(split);
  const q = named(split, "Questions");
  assert.deepEqual([q.parent, q.side, q.collapsed, q.width, q.height], [null, null, false, measure("Questions", true).width, 47]);
  assert.deepEqual([q.x, q.y], [Math.round(200 - q.width / 2), Math.round(600 - 23.5)]);
  for (const value of ["Which regions first?", "Do we need a beta?"]) {
    assert.equal(named(split, value).side, "right"); assert.equal(named(split, value).x, q.x + q.width + 72);
  }
  assert.equal(outerSide(split.objects, named(split, "Which regions first?").id), "right");
  // Join: a root dropped on a node of another map becomes its last child in the node look.
  const joined = reparent(split, q.id, top.id, "left", measure);
  validate(joined);
  assert.deepEqual([named(joined, "Questions").parent, named(joined, "Questions").side, named(joined, "Questions").height], [id, "left", 39]);
  assert.equal(named(joined, "Which regions first?").side, null);
});

test("MM-U9 collapse and expand: hidden nodes, counts and layout", async () => {
  const { collapse, hiddenIds, hiddenCount, MAP_WORDS } = await map();
  const { validate } = await rules();
  const { board, id } = await grown();
  const risks = named(board, "Risks");
  const folded = collapse(board, risks.id, true);
  validate(folded);
  const hidden = hiddenIds(folded.objects);
  assert.deepEqual([...hidden].map((h) => folded.objects.find((o) => o.id === h).text).sort(), ["Late design sign-off", "Load tests", "Server limits"]);
  assert.equal(hiddenCount(folded.objects, risks.id), 3);
  assert.equal(named(folded, "Owners").y - (named(folded, "Risks").y + 39), 32, "the map closes up");
  for (const value of ["Late design sign-off", "Load tests"]) assert.deepEqual(named(folded, value), named(board, value), "hidden nodes keep their saved boxes");
  assert.strictEqual(collapse(board, id, true), board, "a root never collapses");
  assert.strictEqual(collapse(board, named(board, "Owners").id, true), board, "only a node with children collapses");
  const opened = collapse(folded, risks.id, false);
  assert.deepEqual(opened.objects, board.objects);
  assert.equal(MAP_WORDS.collapsed("Risks", 3), "Collapsed “Risks”: 3 hidden.");
  assert.equal(MAP_WORDS.expanded("Risks"), "Expanded “Risks”.");
  assert.equal(MAP_WORDS.count(99), "99"); assert.equal(MAP_WORDS.count(100), "99+");
  assert.equal(MAP_WORDS.badge("Risks", 3), "Expand “Risks”, 3 hidden");
});

test("MM-U10 delete moves children up; deleting a root splits its map", async () => {
  const { deleteObject } = await load("apps/web/src/history.ts");
  const { validate } = await rules();
  const measure = await measureNode();
  const { board, id } = await grown();
  const risks = named(board, "Risks");
  const result = deleteObject(board, { past: [], future: [] }, risks, measure);
  validate(result.board);
  const order = result.board.objects.filter((o) => o.parent === id).sort((a, b) => a.rank - b.rank).map((o) => o.text);
  assert.deepEqual(order, ["Goals", "Late design sign-off", "Server limits", "Owners", "Questions"]);
  assert.equal(named(result.board, "Late design sign-off").side, "right");
  assert.equal(named(result.board, "Load tests").parent, named(board, "Server limits").id);
  assert.equal(result.history.past.length, 1);
  const split = deleteObject(board, { past: [], future: [] }, named(board, "Launch plan"), measure).board;
  validate(split);
  for (const value of ["Goals", "Risks", "Owners", "Questions"]) {
    const was = named(board, value), now = named(split, value);
    assert.equal(now.parent, null, value); assert.equal(now.height, 47, value);
    assert(Math.abs(now.x + now.width / 2 - (was.x + was.width / 2)) <= 0.5 && Math.abs(now.y + now.height / 2 - (was.y + was.height / 2)) <= 0.5, value);
  }
  assert.equal(named(split, "Which regions first?").side, "right");
  assert.equal(named(split, "Which regions first?").x, named(split, "Questions").x + named(split, "Questions").width + 72);
  // Several at once: each surviving child goes to its nearest surviving ancestor.
  const both = deleteObject(board, { past: [], future: [] }, [risks, named(board, "Server limits")], measure).board;
  validate(both);
  assert.equal(named(both, "Load tests").parent, id);
  assert.deepEqual(both.objects.filter((o) => o.parent === id).sort((a, b) => a.rank - b.rank).map((o) => o.text),
    ["Goals", "Late design sign-off", "Load tests", "Owners", "Questions"]);
  const { commandObjectLabel } = await load("apps/web/src/sections.ts");
  assert.equal(commandObjectLabel(board, named(board, "First idea") ?? { ...risks, text: "First idea", order: 3 }), "mind map node 4 · First idea");
});

test("MM-U11 copies keep links inside the set; other nodes become roots; ids remap", async () => {
  const { buildSnapshot, copyObjects } = await load("apps/web/src/clipboard.ts");
  const { duplicate } = await load("apps/web/src/history.ts");
  const { collapse } = await map();
  const { validate } = await rules();
  const measure = await measureNode();
  const { board } = await grown();
  const limits = named(board, "Server limits"), tests = named(board, "Load tests");
  const drawn = board.objects.map((o) => ({ ...o, displayHeight: o.height }));
  const snapshot = buildSnapshot(board, new Set([limits.id, tests.id]), drawn, measure);
  const copied = (value) => snapshot.objects.find((o) => o.text === value);
  assert.deepEqual([copied("Server limits").parent, copied("Server limits").side, copied("Server limits").height], [null, null, 47]);
  assert.deepEqual([copied("Load tests").parent, copied("Load tests").side], [limits.id, "right"]);
  const pasted = copyObjects(board, snapshot, 24, 24);
  validate(pasted);
  const fresh = pasted.objects.slice(board.objects.length);
  const newLimits = fresh.find((o) => o.text === "Server limits"), newTests = fresh.find((o) => o.text === "Load tests");
  assert.notEqual(newLimits.id, limits.id); assert.equal(newTests.parent, newLimits.id);
  // A collapsed node carries its hidden descendants and stays collapsed under a copied parent.
  const risks = named(board, "Risks"), folded = collapse(board, risks.id, true);
  const carried = buildSnapshot(folded, new Set([risks.id]), drawn.filter((o) => !["Late design sign-off", "Server limits", "Load tests"].includes(o.text)), measure);
  assert.deepEqual(carried.objects.map((o) => o.text).sort(), ["Late design sign-off", "Load tests", "Risks", "Server limits"]);
  const withParent = buildSnapshot(folded, new Set([named(board, "Launch plan").id, risks.id]), drawn, measure);
  assert.equal(withParent.objects.find((o) => o.text === "Risks").collapsed, true);
  // Duplicate of a lone child gives a separate one-node map.
  const owners = named(board, "Owners");
  const copy = duplicate(board, { past: [], future: [] }, owners, measure);
  validate(copy.board);
  const lone = copy.board.objects.find((o) => o.id === copy.affectedId);
  assert.deepEqual([lone.parent, lone.side, lone.height], [null, null, 47]);
});

test("MM-U12 the codec and adapter carry the four keys, and only on mind nodes", async () => {
  const { Adapter } = await load("packages/board-sync/src/document-adapter.ts");
  const { readBoard } = await load("packages/board-sync/src/codec.ts");
  const { add, canonical } = await rules();
  const { collapse } = await map();
  const { board } = await grown();
  const folded = add(collapse(board, named(board, "Risks").id, true), "sticky", 0, 0);
  const adapter = new Adapter();
  try {
    adapter.set(folded);
    const read = readBoard(adapter.doc);
    assert.equal(canonical(read), canonical(folded));
    const objects = adapter.doc.getMap("objects");
    const node = objects.get(named(folded, "Risks").id), sticky = objects.get(folded.objects.at(-1).id);
    assert.deepEqual(["parent", "side", "rank", "collapsed"].map((key) => node.get(key)), [named(folded, "Launch plan").id, "right", 1, true]);
    assert(["parent", "side", "rank", "collapsed"].every((key) => !sticky.has(key)));
    node.set("depth", 1);
    assert.throws(() => readBoard(adapter.doc), /invalid_update/);
  } finally { adapter.destroy(); }
});

test("MM-U13 shared Undo remaps parent within a step and in older steps", async () => {
  const { Adapter } = await load("packages/board-sync/src/document-adapter.ts");
  const { readBoard } = await load("packages/board-sync/src/codec.ts");
  const { capture, SharedUndo } = await load("packages/board-sync/src/undo.ts");
  const { deleteObject } = await load("apps/web/src/history.ts");
  const { validate } = await rules();
  const { board } = await grown();
  const adapter = new Adapter(), history = new SharedUndo();
  try {
    adapter.set(board);
    const before = capture(adapter.doc);
    adapter.set(deleteObject(board, { past: [], future: [] }, named(board, "Risks"), await measureNode()).board);
    history.record(before, capture(adapter.doc));
    const restored = history.take(capture(adapter.doc), "undo");
    assert.equal(typeof restored, "object", String(restored));
    validate(restored);
    const risks = named(restored, "Risks");
    assert.notEqual(risks.id, named(board, "Risks").id, "restored under a new identity");
    assert.equal(named(restored, "Late design sign-off").parent, risks.id);
    assert.equal(named(restored, "Server limits").parent, risks.id);
    const state = capture(adapter.doc);
    adapter.set(restored); history.record(state, capture(adapter.doc), "undo");
    assert.equal(named(readBoard(adapter.doc), "Server limits").parent, risks.id);
  } finally { adapter.destroy(); }
});

test("MM-U14 an add opening its node's text session joins one shared step", async () => {
  const { Adapter } = await load("packages/board-sync/src/document-adapter.ts");
  const { capture, SharedUndo } = await load("packages/board-sync/src/undo.ts");
  const { addChild } = await map();
  const { board, id } = await starter();
  const measure = await measureNode(), adapter = new Adapter(), history = new SharedUndo();
  try {
    adapter.set(board);
    const write = (next, group) => { const before = capture(adapter.doc); adapter.set(next); history.record(before, capture(adapter.doc), undefined, group); };
    const added = addChild(board, id, measure);
    write(added.board, "session");
    const typed = { ...added.board, objects: added.board.objects.map((o) => o.id === added.id ? { ...o, text: "Child", ...measure("Child", false) } : o) };
    write(typed, "session");
    assert.equal(history.past.length, 1);
    write({ ...typed, title: "Other" });
    assert.equal(history.past.length, 2);
  } finally { adapter.destroy(); }
});

test("MM-U15 the room repairs merged mind nodes in document v16's order", async () => {
  const { mindNodeRepairs } = await load("packages/board-room/src/repair.ts");
  const { evaluate } = await load("packages/board-room/src/edits.ts");
  const { initialize } = await load("packages/board-room/src/storage.ts");
  const { NodeStorage } = await load("apps/server/src/node-storage.ts");
  const { Adapter } = await load("packages/board-sync/src/document-adapter.ts");
  const { readBoard } = await load("packages/board-sync/src/codec.ts");
  const { validate } = await rules();
  const { board, id } = await grown();
  const goals = named(board, "Goals"), grow = named(board, "Grow sign-ups"), risks = named(board, "Risks");
  const patch = (patches) => board.objects.map((o) => ({ ...o, ...patches[o.id] }));
  const fixed = (objects) => Object.fromEntries([...mindNodeRepairs(objects)].map(([key, value]) => [objects.find((o) => o.id === key).text, value]));
  // A missing parent becomes a root; every root gets side null and collapsed false.
  const orphan = fixed(patch({ [grow.id]: { parent: crypto.randomUUID() } }));
  assert.deepEqual(orphan["Grow sign-ups"], { parent: null, side: null, collapsed: false });
  // A loop: the node with the smallest id in it becomes a root.
  const [small, large] = [goals.id, grow.id].sort();
  const loop = fixed(patch({ [goals.id]: { parent: grow.id, side: null } }));
  assert.equal(loop[board.objects.find((o) => o.id === small).text].parent, null);
  assert.equal(loop[board.objects.find((o) => o.id === large).text].parent, small);
  // A first-level node without a side gets right; a deeper node loses its side.
  assert.equal(fixed(patch({ [risks.id]: { side: null } }))["Risks"].side, "right");
  assert.equal(fixed(patch({ [grow.id]: { side: "left" } }))["Grow sign-ups"].side, null);
  assert.equal(fixed(patch({ [id]: { collapsed: true, side: "left" } }))["Launch plan"].collapsed, false);
  // Through the room's edit check: a loop is accepted repaired, nodes do not move,
  // and an edit still invalid after the repair is refused.
  const storage = new NodeStorage(":memory:"); initialize(storage);
  const seed = new Adapter(), client = new Adapter();
  try {
    seed.set(board); Y.applyUpdate(client.doc, Y.encodeStateAsUpdate(seed.doc));
    const vector = Y.encodeStateVector(client.doc);
    client.set({ ...board, objects: patch({ [goals.id]: { parent: grow.id, side: null } }) });
    const result = evaluate(seed.doc, readBoard(seed.doc), Y.encodeStateAsUpdate(client.doc, vector), storage);
    assert.equal(result.kind, "complete", result.reason);
    validate(result.board);
    assert.equal(result.changed, true);
    for (const o of result.board.objects) { const was = board.objects.find((b) => b.id === o.id); assert.deepEqual([o.x, o.y], [was.x, was.y]); }
    const next = new Adapter(); Y.applyUpdate(next.doc, Y.encodeStateAsUpdate(seed.doc));
    const v2 = Y.encodeStateVector(next.doc);
    next.set({ ...board, objects: patch({ [goals.id]: { text: "x".repeat(201) } }) });
    assert.deepEqual(evaluate(seed.doc, readBoard(seed.doc), Y.encodeStateAsUpdate(next.doc, v2), storage), { kind: "refused", reason: "invalid_document" });
    next.destroy(); result.doc.destroy();
  } finally { seed.destroy(); client.destroy(); storage.close(); }
});

test("MM-U16 the commit lays out every changed map except the edited node's", async () => {
  const { settle, changedRoots } = await map();
  const { add } = await rules();
  const { board, id } = await grown();
  const nudged = { ...board, objects: board.objects.map((o) => o.text === "Goals" ? { ...o, x: o.x + 40 } : o) };
  assert.deepEqual([...changedRoots(board.objects, nudged.objects)], [id]);
  assert.deepEqual(settle(board, nudged).objects, board.objects);
  assert.strictEqual(settle(board, nudged, named(board, "Risks").id), nudged, "the edited node's map waits for its session to end");
  const sticky = add(board, "sticky", 0, 0);
  assert.strictEqual(settle(board, sticky), sticky, "a change that touches no map lays out nothing");
});

test("MM-U17 words, names and exclusions", async () => {
  const { MAP_WORDS, nodeName } = await map();
  assert.equal(nodeName(""), "Empty"); assert.equal(nodeName("x".repeat(40)), "x".repeat(40)); assert.equal(nodeName("x".repeat(41)), "x".repeat(40) + "…");
  assert.equal(MAP_WORDS.addedChild("Second idea"), "Added a child to “Second idea”.");
  assert.equal(MAP_WORDS.addedSibling("Main topic"), "Added a node to “Main topic”.");
  assert.equal(MAP_WORDS.moved("Server limits", "Goals"), "Moved “Server limits” under “Goals”.");
  assert.equal(MAP_WORDS.separate("Questions"), "“Questions” is now a separate map.");
  const { groupReason } = await load("apps/web/src/group.ts");
  const { arrangeReason } = await load("apps/web/src/arrange.ts");
  const { wrapReason } = await load("apps/web/src/sections.ts");
  const { add } = await rules();
  const { board } = await starter();
  const withSticky = add(board, "sticky", 0, 0), sticky = withSticky.objects.at(-1), node = board.objects[1];
  const both = new Set([sticky.id, node.id]), state = { readOnly: false, composing: false, pointerGesture: false, invalidObjectText: false };
  const drawn = withSticky.objects.map((o) => ({ ...o, displayHeight: o.height }));
  assert.equal(groupReason("Group", withSticky, both, state), "Mind map nodes can't be grouped.");
  assert.equal(arrangeReason("Align objects left", drawn.filter((o) => both.has(o.id)), state), "Mind map nodes are placed by their map.");
  assert.equal(arrangeReason("Bring to front", drawn.filter((o) => both.has(o.id)), state), "Mind map nodes are placed by their map.");
  assert.equal(wrapReason(withSticky, both, drawn, state), "Mind map nodes can't be put in a section.");
  const { connectionDots } = await load("apps/web/src/connection-drag.ts");
  assert.deepEqual(connectionDots(drawn, new Set([node.id]), 1), []);
});
