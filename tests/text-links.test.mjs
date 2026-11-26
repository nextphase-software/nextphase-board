// SPDX-License-Identifier: Apache-2.0
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const rules = () => import("../apps/web/src/text-links.ts");
const pageLinks = () => import("../apps/web/src/page-links.ts");
const teamLinks = () => import("../apps/web/src/team/links.ts");
const textRuns = () => import("../apps/web/src/text-runs.ts");
const check = (id, name, run) => test(`X11-W${String(id).padStart(2, "0")} ${name}`, run);
const base = "https://board.example/app", external = "https://example.com/";
const boardId = "00000000-0000-4000-8000-000000000001", other = "00000000-0000-4000-8000-000000000002";
const local = base + "?board=original", hosted = base + "#/b/" + boardId;
const mark = (start, end, link = external) => ({ start, end, link });
const measure = text => Array.from(text).length * 10;
const lineText = lines => lines.map(line => line.pieces.map(p => p.text).join(""));

async function fixture() {
  const { add, empty } = await import("../packages/board-rules/src/document.ts");
  const { addPage } = await import("../apps/web/src/pages.ts");
  const board = add(add({ ...empty(), title: "Useful words" }, "sticky", 15, 25), "shape", 50, 70);
  return addPage(board).board;
}

check(0, "v46 releases preserve bare and page-only hosted links exactly", async () => {
  const { readHostedBoardLink } = await pageLinks(), { parseLink } = await teamLinks();
  for (const [suffix, fields] of [["", {}], ["?page=ideas%20two", { page: "ideas%20two" }], ["?page=", { page: "" }]]) {
    const hash = `#/b/${boardId}${suffix}`;
    assert.deepEqual(readHostedBoardLink(hash), { board: boardId, ...fields });
    assert.deepEqual(parseLink(hash), { kind: "board", board: boardId, ...fields });
  }
  assert.equal(readHostedBoardLink(`#/b/${boardId}?x=1`), undefined);
  assert.deepEqual(parseLink(`#/b/${boardId}?x=1`), { kind: "bad" });
});

check(1, "both team parsers accept one or two named values and refuse extra and repeated parameters", async () => {
  const { readHostedBoardLink, readObjectValue } = await pageLinks(), { parseLink } = await teamLinks();
  for (const [query, fields] of [["object=obj%20two", { object: "obj%20two" }], ["object=", { object: "" }],
    ["page=p&object=o", { page: "p", object: "o" }], ["object=o&page=", { object: "o", page: "" }]]) {
    assert.deepEqual(readHostedBoardLink(`#/b/${boardId}?${query}`), { board: boardId, ...fields });
    assert.deepEqual(parseLink(`#/b/${boardId}?${query}`), { kind: "board", board: boardId, ...fields });
  }
  for (const query of ["", "object", "object=o&", "object=o&object=a", "page=p&page=q", "object=o&x=1",
    "page=p&object=o&x=1", "object=o&&page=p", "object=o#bad"]) {
    assert.equal(readHostedBoardLink(`#/b/${boardId}?${query}`), undefined);
    assert.deepEqual(parseLink(`#/b/${boardId}?${query}`), { kind: "bad" });
  }
  assert.equal(readObjectValue(hosted + "?object=a%20b", boardId), "a%20b");
  assert.equal(readObjectValue(hosted + "?object=a", other), undefined);
  assert.equal(readObjectValue(local + "&object=a%20b&object=c"), "a b");
  assert.equal(readObjectValue(local + "&object="), "");
});

check(2, "pageLink writes object links without changing unrelated encoded query parts", async () => {
  const { pageLink } = await pageLinks();
  assert.equal(pageLink(local, "p", boardId, "o"), hosted + "?page=p&object=o");
  assert.equal(pageLink(hosted + "?object=o", "p", boardId), hosted + "?page=p");
  assert.equal(pageLink(local, "p"), local + "&page=p");
  assert.equal(pageLink(local, "p", undefined, "o"), local + "&page=p&object=o");
  const encoded = base + "?object=a&board=original&%70age=old&x=a%20b&x=%2f&object=b&page=other#saved";
  assert.equal(pageLink(encoded, "p", undefined, "o o"), base + "?object=o+o&board=original&page=p&x=a%20b&x=%2f#saved");
  assert.equal(pageLink(encoded, "p"), local + "&page=p&x=a%20b&x=%2f#saved");
});

check(3, "same-board recognition checks host, path and board and needs a page or object", async () => {
  const { sameBoardLink } = await rules();
  assert.deepEqual(sameBoardLink(hosted + "?page=p", hosted, boardId), { page: "p" });
  assert.deepEqual(sameBoardLink(hosted + "?object=o", hosted, boardId), { object: "o" });
  assert.deepEqual(sameBoardLink(hosted + "?object=o&page=p", hosted, boardId), { object: "o", page: "p" });
  assert.deepEqual(sameBoardLink(local + "&page=Ideas%202&object=first&object=second", local), { page: "Ideas 2", object: "first" });
  for (const href of [hosted, hosted.replace(boardId, other) + "?object=o", hosted.replace("https:", "http:") + "?object=o",
    hosted.replace("/app", "/other") + "?page=p", "not a URL"]) assert.equal(sameBoardLink(href, hosted, boardId), undefined);
  for (const href of [local, local.replace("original", "another") + "&page=p", base + "?page=p"]) assert.equal(sameBoardLink(href, local), undefined);
});

check(4, "object kinds, label glyphs and copy notices match all registry records", async () => {
  const { objectKind, OBJECT_TYPES } = await import("../packages/board-rules/src/objects/registry.ts");
  const { capitalised, copyObjectLabel, objectCopied } = await rules();
  const kinds = { sticky: ["sticky", "Sticky"], shape: ["shape", "Shapes"], text: ["text", "Text"], section: ["section", "Section"],
    table: ["table", "Table"], mindNode: ["mind map node", "Mind map"], image: ["image", "Image"], video: ["video", null],
    link: ["link card", null], connector: ["connector", null], stroke: ["drawing", "Draw"], tape: ["washi tape", null] };
  assert.deepEqual(Object.keys(kinds).sort(), OBJECT_TYPES.map(o => o.type).sort());
  for (const [type, [kind, icon]] of Object.entries(kinds)) {
    assert.deepEqual(objectKind(type), { kind, icon });
    assert.equal(copyObjectLabel(kind), `Copy link to ${kind}`);
    assert.equal(objectCopied(kind, true), `Link to ${kind} copied.`);
    assert.equal(objectCopied(kind, false), `Link to ${kind} copied. It opens in this browser only.`);
  }
  assert.equal(capitalised("mind map node"), "Mind map node");
});

check(5, "hover labels read live page and object names and retain muted missing labels", async () => {
  const { firstLine, linkLabel, LINK_WORDS } = await rules(), board = await fixture(), [sticky] = board.objects;
  const page = board.pages[1], pageAddress = local + "&page=" + page.id, objectAddress = local + "&object=" + sticky.id;
  const label = (text, icon, tool = null, muted = false) => ({ text, icon, tool, muted });
  assert.deepEqual(linkLabel(external, board, local), label(external, "outside"));
  page.name = "Renamed ideas";
  assert.deepEqual(linkLabel(pageAddress, board, local), label("Renamed ideas", "page"));
  sticky.text = "\n   \r\n  Budget review  \nNext";
  assert.deepEqual(linkLabel(objectAddress, board, local), label("Budget review", "object", "Sticky"));
  sticky.text = "🧭".repeat(61);
  assert.equal(firstLine(sticky.text), "🧭".repeat(60) + "…");
  assert.equal(linkLabel(objectAddress, board, local).text, firstLine(sticky.text));
  for (const text of ["", "  \n\t  "]) {
    sticky.text = text;
    assert.equal(firstLine(text), "");
    assert.deepEqual(linkLabel(objectAddress, board, local), label("Sticky", "object", "Sticky"));
  }
  const image = { id: "photo", type: "image" };
  assert.deepEqual(linkLabel(local + "&object=photo", { ...board, objects: [...board.objects, image] }, local), label("Image", "object", "Image"));
  for (const addr of [local + "&page=missing", local + "&object=missing"]) {
    assert.deepEqual(linkLabel(addr, board, local), label(LINK_WORDS.gone, "gone", null, true));
  }
});

check(6, "shortcuts distinguish platform, modifiers and composition", async () => {
  const { isMac, isLinkShortcut, isPlainPasteKey, linkTooltip } = await rules();
  for (const platform of ["MacIntel", "iPhone", "iPad"]) assert(isMac(platform));
  assert(!isMac("Linux"));
  assert.equal(linkTooltip(true), "Link · ⇧⌘U");
  assert.equal(linkTooltip(false), "Link · Ctrl+Shift+U");
  const event = { key: "U", metaKey: true, ctrlKey: false, shiftKey: true, altKey: false, isComposing: false };
  assert(isLinkShortcut(event));
  assert(isLinkShortcut({ ...event, key: "u", metaKey: false, ctrlKey: true }));
  for (const change of [{ shiftKey: false }, { altKey: true }, { isComposing: true }, { metaKey: false }]) assert(!isLinkShortcut({ ...event, ...change }));
  assert(isPlainPasteKey({ ...event, key: "v" }));
  assert(isPlainPasteKey({ ...event, key: "V", metaKey: false, ctrlKey: true }));
  assert(!isPlainPasteKey({ ...event, key: "v", shiftKey: false }));
  assert(!isPlainPasteKey({ ...event, key: "v", altKey: true }));
});

check(7, "spans measure prefixes within unchanged layout pieces, including kerning", async () => {
  await rules();
  const { layoutRuns, linkSpans, lineSources } = await textRuns();
  const text = "AV!", metric = s => s.startsWith("AV") ? measure(s) - 3 : measure(s);
  const plain = layoutRuns(text, [], 100, metric);
  assert.deepEqual(layoutRuns(text, [mark(1, 2)], 100, metric), plain);
  assert.deepEqual(lineSources(text, [text]), [{ start: 0, length: 3 }]);
  assert.deepEqual(linkSpans(text, [mark(1, 2)], plain, lineSources(text, [text]), metric),
    [{ href: external, start: 1, end: 2, line: 0, x: 10, width: 7, lineWidth: 27 }]);
  const bold = [{ start: 0, end: 1, bold: true }, { start: 1, end: 2, bold: true, link: external }, { start: 2, end: 3, bold: true }];
  const flagged = layoutRuns(text, bold, 100, metric);
  assert.equal(flagged[0].pieces.length, 1);
  assert.deepEqual(linkSpans(text, bold, flagged, lineSources(text, [text]), metric),
    [{ href: external, start: 1, end: 2, line: 0, x: 10, width: 7, lineWidth: 27 }]);
});

check(8, "link spans skip wrap whitespace, blank paragraphs and synthetic shape ellipses", async () => {
  const { linkBoxes } = await rules(), { layoutRuns, lineSources, linkSpans } = await textRuns();
  const text = "one two\n\nthen", marks = [mark(0, 12)];
  const lines = layoutRuns(text, marks, 40, measure), sources = lineSources(text, lineText(lines));
  assert.deepEqual(lineText(lines), ["one", "two", "", "then"]);
  assert.deepEqual(sources, [{ start: 0, length: 3 }, { start: 4, length: 3 }, { start: 7, length: 0 }, { start: 9, length: 4 }]);
  assert.deepEqual(linkSpans(text, marks, lines, sources, measure).map(({ start, end, line }) => [start, end, line]),
    [[0, 3, 0], [4, 7, 1], [9, 12, 3]]);
  const { shapeTextLayout, textBox } = await import("../packages/board-rules/src/objects/registry.ts");
  const board = await fixture(), shape = { ...board.objects[1], width: 100, height: 60, text: "AV\n…", marks: [mark(0, 4)] };
  const full = layoutRuns(shape.text, shape.marks, textBox(shape).width, measure);
  const drawn = shapeTextLayout(shape, w => layoutRuns(shape.text, shape.marks, w, measure), measure).lines;
  assert.deepEqual(lineText(full), ["AV", "…"]);
  assert.deepEqual(lineText(drawn), ["AV…"]);
  const positions = lineSources(shape.text, lineText(full));
  positions[0].length = 2;
  const links = linkSpans(shape.text, shape.marks, drawn, positions, measure);
  assert.deepEqual(links.map(({ start, end, line, width }) => [start, end, line, width]), [[0, 2, 0, 20]]);
  assert.deepEqual(linkBoxes(shape, { runs: drawn, links, height: shape.height }).map(box => box.width), [20]);
});

check(9, "hit boxes share drawn geometry, respect the note clip and choose the topmost object and saved run", async () => {
  const { linkBoxes, linkUnder } = await rules(), { layoutRuns, linkSpans, lineSources } = await textRuns();
  const { textBox } = await import("../packages/board-rules/src/objects/registry.ts");
  const { textUnits } = await import("../packages/board-rules/src/styles.ts");
  const [note, shape] = (await fixture()).objects;
  note.x = 15; note.y = 25;
  note.text = "ab\ncd\nef";
  note.align = "left";
  note.marks = [mark(0, 1), { start: 1, end: 8, bold: true, link: external }];
  const runs = layoutRuns(note.text, note.marks, 200, measure), lineHeight = textUnits(note.textSize) * 1.45;
  const links = linkSpans(note.text, note.marks, runs, lineSources(note.text, lineText(runs)), measure);
  const layout = { height: 40 + lineHeight + 6, links, runs };
  const noteBoxes = linkBoxes(note, layout);
  assert.equal(noteBoxes.length, 3);
  const { height, ...firstBox } = noteBoxes[0];
  assert.deepEqual(firstBox, { href: external, id: note.id, line: 0, x: 35, y: 45, width: 10, start: 0, end: 1 });
  assert(Math.abs(height - lineHeight) < 1e-9);
  assert(Math.abs(noteBoxes[2].height - 6) < 1e-9);
  assert.equal(noteBoxes[2].line, 1);
  const point = { x: 46, y: 48 }, drawnNote = { ...note, displayHeight: layout.height };
  const geometry = new Map([[note.id, layout]]);
  const hit = linkUnder([drawnNote], geometry, point, 1);
  assert.deepEqual(hit.run, { start: 0, end: 8 });
  assert.equal(hit.first.x, 35);
  assert.equal(linkUnder([drawnNote], geometry, { x: 60, y: 48 }, 1), undefined);
  assert.equal(linkUnder([drawnNote], geometry, point, 1, note.id), undefined);
  assert.equal(linkUnder([drawnNote, { ...drawnNote, id: "front", order: 10 }], geometry, point, 1), undefined);
  shape.align = "center"; shape.text = "ab";
  const box = textBox(shape), shapeLine = textUnits(shape.textSize) * 1.45;
  const [shapeHit] = linkBoxes(shape, { runs: layoutRuns("ab", [], 500, measure), height: shape.height,
    links: [{ href: external, start: 1, end: 2, line: 0, x: 10, width: 10, lineWidth: 20 }] });
  assert.equal(shapeHit.x, box.x + (box.width - 20) / 2 + 10);
  assert.equal(shapeHit.y, box.y + Math.max(0, (box.height - shapeLine) / 2));
});

check(10, "card placement clamps horizontally and moves above the line at the bottom edge", async () => {
  const { cardPlace } = await rules(), size = { width: 250, height: 36 }, window = { width: 800, height: 600 };
  assert.deepEqual(cardPlace({ left: -20, top: 40, bottom: 57.6 }, size, window), { left: 12, top: 64 });
  assert.deepEqual(cardPlace({ left: 700, top: 40, bottom: 58 }, size, window), { left: 538, top: 64 });
  assert.deepEqual(cardPlace({ left: 200, top: 550, bottom: 568 }, size, window), { left: 200, top: 508 });
});

check(11, "Link reasons take precedence and the pressed state follows one whole link", async () => {
  const { LINK_WORDS, linkButton } = await rules(), board = await fixture(), [item] = board.objects;
  const base = { selectionReason: "", objects: [item], editing: true, marks: [mark(0, 2), mark(2, 4, "https://other.example/")], length: 4, start: 0, end: 2 };
  assert.deepEqual(linkButton(base), { disabled: false, reason: "", own: false, pressed: true });
  for (const [change, reason, own, pressed] of [
    [{ selectionReason: "Read-only", objects: board.objects }, "Read-only", false, false],
    [{ objects: board.objects, length: 0 }, LINK_WORDS.several, true, false],
    [{ length: 0, start: 0, end: 0 }, LINK_WORDS.empty, true, false],
    [{ start: 2, end: 2 }, LINK_WORDS.caret, true, false],
  ]) assert.deepEqual(linkButton({ ...base, ...change }), { disabled: true, reason, own, pressed });
  assert(linkButton({ ...base, start: 1, end: 1 }).pressed);
  assert(!linkButton({ ...base, start: 1, end: 3 }).pressed);
});

check(12, "paste accepts one address and DOM edits retain the actual code-point range", async () => {
  const { pastedLink, editRange, toUnits } = await rules();
  assert.equal(pastedLink("  example.com  "), external);
  assert.equal(pastedLink("https://example.com/ and more"), undefined);
  assert.equal(pastedLink("javascript:alert(1)"), undefined);
  for (const [inputType, selection, after, expected] of [
    ["insertText", [2, 2], "abXcd", [2, 2]], ["insertFromPaste", [1, 3], "aXYZd", [1, 3]],
    ["deleteContentBackward", [2, 2], "acd", [1, 2]], ["deleteContentForward", [2, 2], "abd", [2, 3]],
    ["deleteWordBackward", [2, 2], "cd", [0, 2]], ["deleteWordForward", [2, 2], "ab", [2, 4]],
    ["deleteSoftLineBackward", [2, 2], "cd", [0, 2]], ["deleteHardLineForward", [2, 2], "ab", [2, 4]],
    ["historyUndo", [2, 2], "abd"], ["unknown", [2, 2], "abd"], [undefined, [2, 2], "abXd"],
    ["deleteWordBackward", [0, 0], "cd"],
  ]) {
    const [start, end] = selection;
    assert.deepEqual(editRange({ start, end }, inputType, "abcd", after), expected && { start: expected[0], end: expected[1] });
  }
  assert.equal(toUnits("a🧭b👍🏽", 2), 3);
  assert.equal(toUnits("a🧭b👍🏽", 5), 8);
});

check(13, "only visible blocking surfaces count", async t => {
  const { blockingSurfaceOpen, BLOCKING_SURFACES } = await rules();
  const root = values => ({ querySelectorAll(selector) { assert.equal(selector, BLOCKING_SURFACES); return values; } });
  const element = visible => ({ checkVisibility(options) { assert.deepEqual(options, { visibilityProperty: true }); return visible; } });
  for (const reason of ["display: none", "[hidden]", "visibility: hidden", "hidden ancestor"]) assert(!blockingSurfaceOpen(root([element(false)])), reason);
  assert(blockingSurfaceOpen(root([element(false), element(true)])));
  const style = Object.getOwnPropertyDescriptor(globalThis, "getComputedStyle");
  Object.defineProperty(globalThis, "getComputedStyle", { configurable: true, value: e => ({ visibility: e.visibility }) });
  t.after(() => { if (style) Object.defineProperty(globalThis, "getComputedStyle", style); else delete globalThis.getComputedStyle; });
  assert(!blockingSurfaceOpen(root([{ getClientRects: () => [], visibility: "visible" }, { getClientRects: () => [1], visibility: "hidden" }])));
  assert(blockingSurfaceOpen(root([{ getClientRects: () => [1], visibility: "visible" }])));
});

check(14, "the scene draws separate Lines from spans and the stylesheet ends with the link rules", async () => {
  await rules();
  for (const part of ["note-body", "shape-body"]) {
    const source = await readFile(new URL(`../apps/web/src/scene/${part}.tsx`, import.meta.url), "utf8");
    assert.match(source, /layout\.links\.map\(span/);
    assert.match(source, /<Line\b[^>]*points=\{\[x, y, x \+ span\.width, y\]\}/);
    assert.doesNotMatch(source, /textDecoration=[^\n]*underline/);
  }
  const contract = await readFile(new URL("../docs/architecture/0001-web-modules-v51.md", import.meta.url), "utf8");
  const block = contract.split("### CSS")[1].split("```css\n")[1].split("```")[0];
  assert.equal(block.trim().split("\n").length, 21);
  const amendment = contract.split("#### Selection highlight CSS")[1].split("```css\n")[1].split("```")[0];
  const css = await readFile(new URL("../apps/web/style.css", import.meta.url), "utf8");
  assert(css.endsWith(block + amendment));
});

async function modules() {
  const { build } = await import("esbuild");
  const runtime = `let cursor = 0, slots = [], effects = [];
    export function begin() { cursor = 0; }
    export function flush() { effects.splice(0).forEach(fn => fn()); }
    export function useState(initial) {
      const at = cursor++; if (!(at in slots)) slots[at] = typeof initial === 'function' ? initial() : initial;
      return [slots[at], value => { slots[at] = typeof value === 'function' ? value(slots[at]) : value; }];
    }
    export function useRef(value) { const at = cursor++; return slots[at] ??= { current: value }; }
    export function useEffect(callback, deps) {
      const at = cursor++; if (deps && slots[at]) return;
      slots[at] = true; effects.push(callback);
    }`;
  const output = await build({ stdin: { contents: `
    export { usePages } from './state/use-pages.ts';
    export { useTextLinks } from './state/use-text-links.ts';
    export { ContextBar } from './ui/context-bar.tsx';
    export { ContentField } from './ui/content-field.tsx';
    export { LinkBar } from './ui/link-bar.tsx';
    export { begin, flush } from 'test-react';`, resolveDir: new URL("../apps/web/src/", import.meta.url).pathname },
    bundle: true, write: false, format: "esm", platform: "node", jsx: "automatic", define: { "process.env.NODE_ENV": '"production"' },
    plugins: [{ name: "scheduler", setup(build) {
      build.onResolve({ filter: /^(react|test-react)$/ }, () => ({ path: "react", namespace: "test-react" }));
      build.onLoad({ filter: /.*/, namespace: "test-react" }, () => ({ contents: runtime }));
    } }] });
  return import("data:text/javascript;base64," + Buffer.from(output.outputFiles[0].text).toString("base64") + "#" + crypto.randomUUID());
}

function globals(t, url = local) {
  let address = url;
  const writes = [];
  for (const [key, value] of Object.entries({
    location: { get href() { return address; } },
    history: { state: null, replaceState(_state, _title, value) { writes.push(value); address = value; } },
    localStorage: { getItem() { return null; }, setItem() {} },
    document: { addEventListener() {}, removeEventListener() {}, querySelector() { return null; }, querySelectorAll() { return []; } },
    window: { innerWidth: 1200, innerHeight: 800, addEventListener() {}, removeEventListener() {} },
  })) {
    const previous = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, { configurable: true, value });
    t.after(() => { if (previous) Object.defineProperty(globalThis, key, previous); else delete globalThis[key]; });
  }
  return { writes, set address(next) { address = next; }, get address() { return address; } };
}

check(15, "A1 repairs retain the last settled visible object on its page and skip object-only writes during gestures", async t => {
  await rules();
  const m = await modules(), { readObjectValue } = await pageLinks(), { add } = await import("../packages/board-rules/src/document.ts");
  let board = await fixture();
  for (let i = 0; i < 3; i++) board = add(board, "mindNode", 100 * i, 100);
  const page = board.pages[0].id, next = board.pages[1].id, [note, , root, branch, child] = board.objects;
  branch.parent = root.id; branch.side = "right"; child.parent = branch.id;
  const address = base + "#/b/" + board.boardId, env = globals(t, address), model = { current: board };
  let view = { x: 0, y: 0, z: 1 }, selection = { ids: new Set(), settled: true };
  const team = { history: { previewing: false }, subscribePresence() {}, pageChanged() {}, stopFollowing() {} };
  const input = { board, model, team, hosted: true, stepPage: {}, commit() {}, setMessage() {}, finishTextSession() {},
    getSelection: () => selection, select: id => { selection = { ...selection, ids: new Set(id ? [id] : []) }; },
    getView: () => view, setView: next => { view = next; }, getObjects: () => model.current.objects,
    openingReason: () => selection.settled ? "" : "Finish the current action first.", editingReason: () => "" };
  const draw = () => { m.begin(); const result = m.usePages(input); m.flush(); return result; };
  draw().changed(board, board, { origin: "reload" }); draw();
  input.select(note.id); draw();
  assert.equal(readObjectValue(env.address, board.boardId), note.id);
  assert.equal(team.addressObject, note.id);
  selection.settled = false; input.select(child.id);
  const count = env.writes.length; draw(); assert.equal(env.writes.length, count);
  env.address = `${address}?object=foreign&page=bad`;
  team.onLinkedPage("bad", "foreign"); draw(); assert.equal(env.address, `${address}?page=${page}&object=${note.id}`);
  assert.equal(team.addressObject, note.id);
  draw().openPage(next, true); draw();
  assert.equal(env.address, `${address}?page=${next}`);
  draw().openPage(page, true); draw();
  assert.equal(env.address, `${address}?page=${page}&object=${note.id}`, "unsettled repairs leave the last settled id in the ref");
  input.board = model.current = { ...board, objects: board.objects.filter(o => o !== note) };
  const beforeDeletionRepair = env.writes.length; draw(); assert.equal(env.writes.length, beforeDeletionRepair);
  env.address = `${address}?page=old&object=${note.id}`; team.onLinkedPage("old", note.id); draw();
  assert.equal(readObjectValue(env.address, board.boardId), undefined);
  selection.settled = true; input.select(child.id); draw();
  assert.equal(readObjectValue(env.address, board.boardId), child.id);
  selection.settled = false;
  input.board = model.current = { ...model.current, objects: model.current.objects.map(o => o === branch ? { ...branch, collapsed: true } : o) };
  env.address = `${address}?page=old&object=${child.id}`; team.onLinkedPage("old", child.id); draw();
  assert.equal(readObjectValue(env.address, board.boardId), undefined);
  assert.equal(team.addressObject, undefined);
});

check(18, "A3 renders and deliveries leave independent navigation alone until the selection changes", async t => {
  await rules();
  const m = await modules(), { pageLink } = await pageLinks(), board = await fixture();
  const page = board.pages[0].id, address = base + "#/b/" + board.boardId;
  const env = globals(t, address), model = { current: board };
  let ids = new Set();
  const team = { history: { previewing: false }, subscribePresence() {}, pageChanged() {}, removedPage() {} };
  const input = { board, model, team, hosted: true, stepPage: {}, commit() {}, setMessage() {}, finishTextSession() {},
    getSelection: () => ({ ids, settled: true }), select() {}, getView: () => ({ x: 0, y: 0, z: 1 }), setView() {},
    getObjects: () => model.current.objects, openingReason: () => "", editingReason: () => "" };
  const draw = () => { m.begin(); const pages = m.usePages(input); m.flush(); return pages; };
  draw().changed(board, board, { origin: "reload" });
  assert.deepEqual(env.writes, [pageLink(address, page, board.boardId)]);
  env.address = address + "?page=independent&object=other";
  draw().changed(board, { ...board, title: "Reloaded board" }, { origin: "reload" });
  draw();
  assert.equal(env.writes.length, 1);
  assert.equal(env.address, address + "?page=independent&object=other");
  const [object] = board.objects;
  ids = new Set([object.id]); draw(); draw();
  assert.equal(env.writes.length, 2);
  assert.equal(env.address, pageLink(address, page, board.boardId, object.id));
});

check(16, "A2 Copy link and Link remain in the measured context bar when it does not fit", async t => {
  await rules();
  globals(t);
  const m = await modules(), { renderToStaticMarkup } = await import("react-dom/server"), board = await fixture();
  const [item] = board.objects;
  item.text = "Some words";
  const selected = new Set([item.id]), ref = { current: null }, noop = () => {};
  const hook = { board, model: { current: board }, pages: { id: board.pages[0].id, openLink: noop }, selected, inline: false,
    textSelection: null, objects: [item], objectLayouts: new Map(), editor: ref, scene: ref, tool: "Select", view: { x: 0, y: 0, z: 1 },
    size: { w: 900, h: 800 }, pos: o => ({ left: o.x, top: o.y }), selectionReason: "" };
  for (const contextFits of [true, false]) {
    m.begin();
    const { controls } = m.useTextLinks({ ...hook, barShown: contextFits }); m.flush();
    const html = renderToStaticMarkup(m.ContextBar({ board, selected, item, text: item.text, textLinks: controls, contextFits,
      contextBar: ref, contextLeft: 12, contextTop: 240, contextWidth: 850, size: hook.size, richText: true,
      links: { only: false }, tapeSelection: {}, strokeSelection: { objects: [] }, shapeSelection: { objects: [] },
      tidy: { reason: () => "" }, selectionReason: "", selectionFormats: {}, selectionAlign: "left", selectionSize: "medium" }));
    assert.match(html, /aria-label="Copy link to sticky"/);
    assert.match(html, /aria-label="Strikethrough"[^]*aria-label="Link"/);
    assert(html.indexOf('aria-label="Copy link to sticky"') < html.indexOf('aria-label="Duplicate"'));
    assert.match(html, contextFits ? /aria-hidden="false"[^>]*visibility:visible/ : /aria-hidden="true" inert=""[^>]*visibility:hidden/);
  }
});

check(17, "only a qualifying canvas paste replaces marks in one commit and leaves text and selection intact", async t => {
  await rules(); globals(t);
  const m = await modules(), board = await fixture(), [item] = board.objects;
  item.text = "ab🧭cd";
  const calls = [], field = { value: item.text, selectionStart: 1, selectionEnd: 4 }, model = { current: board };
  const props = { board, model, pages: { id: board.pages[0].id }, selected: new Set([item.id]), inline: true,
    textSelection: { id: item.id, start: 1, end: 3 }, objects: [item], objectLayouts: new Map(), editor: { current: field },
    tool: "Select", view: { x: 0, y: 0, z: 1 }, selectionReason: "", finishTextSession: () => calls.push("finish"),
    commit: (next, undo) => { calls.push(undo); model.current = next; }, ownCopy: text => text === " https://Board.example/ " };
  const draw = (patch = {}) => { m.begin(); const links = m.useTextLinks({ ...props, ...patch }).editor; m.flush(); return links; };
  const data = (text, files = []) => ({ clipboardData: { files, getData: key => (assert.equal(key, "text/plain"), text) } });
  const e = draw();
  e.key({ key: "V", metaKey: true, shiftKey: true });
  assert(!e.paste(data(external)), "plain paste remains native");
  for (const input of [data(" two words "), data("javascript:alert(1)"), data(external, [{}]), data(" https://Board.example/ ")]) assert(!e.paste(input));
  assert(!draw({ readOnly: true }).paste(data(external)));
  assert(!draw({ composing: true }).paste(data(external)));
  assert(!draw({ inline: false }).paste(data(external)));
  assert.deepEqual(calls, []);
  assert(draw().paste(data("example.com")));
  assert.deepEqual(calls, ["finish", true]);
  assert.deepEqual(model.current.objects[0].marks, [mark(1, 3)]);
  assert.equal(model.current.objects[0].text, field.value);
  assert.deepEqual([field.selectionStart, field.selectionEnd], [1, 4]);
});

async function hoverFixture(t) {
  const { linkBoxes } = await rules(), { layoutRuns, lineSources, linkSpans } = await textRuns();
  globals(t);
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const m = await modules(), board = await fixture(), [note] = board.objects;
  const field = { value: "🧭Lunch today", focus() {}, setSelectionRange(start, end) { this.selection = [start, end]; } };
  const input = { board, model: { current: board }, pages: { id: note.page }, selected: new Set(), inline: false,
    textSelection: null, editor: { current: field }, commandReason: "", selectionReason: "Select an object to duplicate or delete.",
    tool: "Select", view: { x: 0, y: 0, z: 1 }, size: { w: 1200, h: 800 }, pos: p => ({ left: p.x, top: p.y }) };
  let point;
  function change(marks, text = field.value) {
    const item = { ...note, marks, text, align: "left", displayHeight: note.height };
    const runs = layoutRuns(item.text, marks, 200, measure);
    const layout = { height: item.height, runs, links: linkSpans(item.text, marks, runs, lineSources(item.text, lineText(runs)), measure) };
    const [box] = linkBoxes(item, layout);
    if (box) point = { x: box.x + 2, y: box.y + 2 };
    Object.assign(input, { board: { ...board, objects: [item, board.objects[1]] }, objects: [item], objectLayouts: new Map([[item.id, layout]]) });
    input.model.current = input.board;
  }
  change([mark(1, 6)]);
  const draw = () => { m.begin(); const links = m.useTextLinks(input); m.flush(); return links; };
  function rest() { draw().pointer.move(point, { pointerType: "mouse", buttons: 0 }); }
  function waited() { t.mock.timers.tick(300); return draw().card; }
  return { input, field, change, draw, rest, waited, LinkBar: m.LinkBar };
}

check(19, "card Edit link selects and edits its object across selections, with command and Tidy up guards", async t => {
  const { input, field, draw, rest, waited, LinkBar } = await hoverFixture(t);
  const item = input.objects[0], actions = [];
  input.select = id => { actions.push(["select", id]); input.selected = new Set([id]); input.selectionReason = ""; };
  input.edit = target => { actions.push(["edit", target]); input.inline = true; };

  rest();
  assert(waited()?.editable);
  input.commandReason = "Finish the current text edit first.";
  draw().card.edit();
  assert.deepEqual(actions, []);
  input.commandReason = "";
  input.tidyOpen = true;
  assert.equal(draw().card, null);
  input.tidyOpen = false;
  input.readOnly = true;
  rest();
  assert.equal(waited()?.editable, false);
  draw().card.edit();
  assert.deepEqual(actions, []);
  input.readOnly = false;

  for (const selected of [[], [input.board.objects[1].id], input.board.objects.map(o => o.id)]) {
    actions.length = 0;
    input.selected = new Set(selected);
    input.selectionReason = selected.length ? "" : "Select an object to duplicate or delete.";
    rest();
    waited().edit();
    assert.deepEqual(actions, [["select", item.id], ["edit", item]]);
    draw().placed(true);
    const opened = draw();
    assert.deepEqual(field.selection, [2, 7]);
    assert.deepEqual(opened.editor.highlight, { start: 1, end: 6 });
    const [address] = LinkBar({ bar: opened.controls.bar, top: 0 }).props.children;
    assert.equal(address.props.value, external);
    assert(address.props.autoFocus);
    let selectedAddress = false;
    address.props.onFocus({ currentTarget: { select() { selectedAddress = true; } } });
    assert(selectedAddress);
    opened.controls.bar.close();
    // End editing before hovering again.
    draw();
    input.inline = false;
  }
});

check(20, "the link bar's blurred editor highlights the stored range across wrapped lines", async t => {
  const m = await modules(), [item] = (await fixture()).objects;
  const value = "🧭Lakeside Hall and more";
  const listeners = new Map();
  const measuredStyles = { "font-family": "system-ui", "font-size": "18px", "line-height": "26px",
    "padding-left": "4px", "white-space": "pre-wrap", "overflow-wrap": "break-word", "text-align": "center" };
  const field = { value, clientWidth: 97, offsetWidth: 112, clientHeight: 70, offsetHeight: 70,
    clientTop: 0, clientLeft: 0, scrollLeft: 0, scrollTop: 0,
    getBoundingClientRect: () => ({ left: 101.5, top: 204.5, width: 111.5, height: 70 }),
    addEventListener: (name, draw) => listeners.set(name, draw),
    removeEventListener: (name, draw) => { assert.equal(listeners.get(name), draw); listeners.delete(name); },
  };
  let resized, observed, disconnected = false;
  for (const [name, replacement] of Object.entries({
    getComputedStyle: () => ({ lineHeight: measuredStyles["line-height"], getPropertyValue: key => measuredStyles[key] ?? "" }),
    ResizeObserver: class {
      constructor(callback) { resized = callback; }
      observe(element) { observed = element; }
      disconnect() { disconnected = true; }
    },
  })) {
    const previous = Object.getOwnPropertyDescriptor(globalThis, name);
    Object.defineProperty(globalThis, name, { configurable: true, value: replacement });
    t.after(() => { if (previous) Object.defineProperty(globalThis, name, previous); else delete globalThis[name]; });
  }
  const node = () => ({
    children: [], style: { setProperty(key, value) { this[key] = value; } },
    append(...children) { this.children.push(...children); },
    replaceChildren(...children) { this.children = children; },
    getBoundingClientRect: () => ({ left: 101.5, top: 204.5 }),
  });
  const overlay = node(), boundaries = [];
  overlay.parentElement = { getBoundingClientRect: () => ({ left: 100, top: 200 }) };
  overlay.ownerDocument = {
    createElement: node, createTextNode: text => ({ text }),
    createRange: () => ({
      setStart: (text, offset) => boundaries.push([text, offset]),
      setEnd: (text, offset) => boundaries.push([text, offset]),
      getClientRects: () => [
        { left: 149, top: 207.5, width: 40, height: 20 },
        { left: 117, top: 233.5, width: 27, height: 20 },
        { left: 144, top: 233.5, width: 0, height: 20 },
      ],
    }),
  };
  function render(open, inline = true) {
    return m.ContentField({ item, inline, text: value, editor: { current: field }, links: { open, highlight: { start: 1, end: 14 } } }).props.children;
  }
  const [, textarea, selection] = render(true);
  assert.equal(textarea.props.className, "link-open");
  assert.equal(textarea.props.value, value);
  assert.equal(selection.props["aria-hidden"], "true");
  const remove = selection.props.ref(overlay);
  const [mirror, paint] = overlay.children;
  assert.deepEqual(boundaries, [[mirror.children[0], 2], [mirror.children[0], 15]]);
  assert.equal(mirror.children[0].text, value);
  for (const [property, style] of Object.entries(measuredStyles)) assert.equal(mirror.style[property], style);
  assert.equal(overlay.style.left, "1.5px");
  assert.equal(overlay.style.top, "4.5px");
  assert.equal(overlay.style.width, "96.5px");
  const rectangles = () => paint.children.map(({ style: { left, top, width, height } }) => [left, top, width, height]);
  assert.deepEqual(rectangles(), [["47.5px", "0px", "40px", "26px"], ["15.5px", "26px", "27px", "26px"]]);
  field.scrollTop = 7; field.scrollLeft = 2; listeners.get("scroll")();
  assert.deepEqual(rectangles(), [["45.5px", "-7px", "40px", "26px"], ["13.5px", "19px", "27px", "26px"]]);
  field.clientWidth = 112; resized();
  assert.equal(observed, field);
  assert.equal(overlay.style.width, "111.5px");
  const css = await readFile(new URL("../apps/web/style.css", import.meta.url), "utf8");
  assert.match(css, /\.link-selection \{[^}]*pointer-events: none;/);
  assert.match(css, /\.link-selection span \{[^}]*background: #aec9f4;/);
  assert.match(css, /textarea\.link-open:focus \+ \.link-selection \{ visibility: hidden; \}/);
  assert(!render(true, false)[2]);
  assert(!render(false)[2]);
  remove();
  assert.equal(listeners.size, 0);
  assert(disconnected);
  assert.deepEqual(overlay.children, []);
});

check(21, "a pending or shown hover is dropped when its live link address, range or layout changes", async t => {
  const { input, change, draw, rest, waited } = await hoverFixture(t);
  const replacement = "https://example.org/";
  rest();
  change([mark(1, 6, replacement)]);
  assert.equal(draw().card, null);
  assert.equal(waited(), null);

  rest();
  assert.equal(waited()?.label.text, replacement);
  change([mark(1, 6)]);
  assert.equal(draw().card, null, "an Undo changing the address hides the old card");
  rest();
  assert.equal(waited()?.label.text, external);

  change([mark(2, 6)]);
  assert.equal(draw().card, null, "changing the run with the same address hides the old card");
  rest();
  assert.equal(waited()?.label.text, external);
  input.objectLayouts = new Map();
  assert.equal(draw().card, null, "a link missing from the drawn layout cannot keep its card");
});
