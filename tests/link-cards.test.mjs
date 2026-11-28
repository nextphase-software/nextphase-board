// SPDX-License-Identifier: Apache-2.0
import test from "node:test";
import assert from "node:assert/strict";
import { setImmediate } from "node:timers/promises";
import { fileURLToPath } from "node:url";

const source = name => import(new URL("../" + name, import.meta.url));
const rules = () => source("packages/board-rules/src/document.ts");
const cards = () => source("apps/web/src/link-cards.ts");
const clipboard = () => source("apps/web/src/clipboard.ts");
const history = () => source("apps/web/src/history.ts");
const url = "https://fieldnotes.test/sprint";
const centre = { x: 500, y: 400 };
const pasteView = { centerX: 500, centerY: 400, zoom: 1, width: 1440, height: 900 };
const now = 120_000;
const textFields = { title: "Fixture title", description: "Short fixture description", site: "fieldnotes.test" };
const replace = (board, card) => ({ ...board, objects: board.objects.map(o => o.id === card.id ? card : o) });
const file = value => { const bytes = new TextEncoder().encode(value); return { size: bytes.length, arrayBuffer: async () => bytes.buffer }; };
const png = Uint8Array.from(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAC0lEQVR4nGNgQAYAAA4AAamRc7EAAAAASUVORK5CYII=", "base64")).buffer;
function eventFor(text, files = []) {
  const scene = {};
  return { target: scene, currentTarget: scene, defaultPrevented: false,
    preventDefault() { this.defaultPrevented = true; },
    clipboardData: { files, items: files.map(() => ({ kind: "file" })), getData: type => type === "text/plain" ? text : "" } };
}
function inputFor(board, overrides = {}) {
  return { board, page: board.boardId, model: { current: board }, selected: new Set(), readOnly: false,
    commandReason: "", tidyOpen: false, busy: false, composing: false, editing: () => false, ownCopy: () => false, ...overrides };
}
async function loading() {
  const empty = { ...(await rules()).empty(), title: "Fixture board" }, c = await cards();
  const made = c.pasteCard(empty, url, centre, empty.pages[0].id, now, true);
  return { empty, ...made, card: made.board.objects[0], c };
}
let compiled;
function harnessModules() {
  return compiled ??= (async () => {
    const { build } = await import("esbuild");
    const sources = [
      'export * from "./apps/web/src/state/use-link-cards.ts";',
      'export * from "./apps/web/src/state/use-board-document.ts";',
      'export * from "./apps/web/src/team/hosted-board.ts";',
      'export * from "./apps/web/src/team/media-transfer.ts";',
      'export * from "./apps/web/src/state/use-editing-commands.ts";',
      'export * from "./apps/web/src/state/use-images.ts";',
      'export * from "./packages/board-sync/src/document-adapter.ts";',
      'export * from "./packages/board-sync/src/session.ts";',
      'export * from "./packages/board-room/src/edits.ts";',
      'export * as Y from "yjs";',
      'export { render, effects } from "react";',
    ];
    const shims = {
      react: `
        let slots, cursor;
        export const effects = [];
        export function render(frame, callback) { slots = frame; cursor = 0; effects.length = 0; return callback(); }
        export function useRef(initial) { const i = cursor++; return slots[i] ??= { current: initial }; }
        export function useState(initial) {
          const i = cursor++, slot = slots[i] ??= { current: typeof initial === "function" ? initial() : initial };
          return [slot.current, next => { slot.current = typeof next === "function" ? next(slot.current) : next; }];
        }
        export function useEffect(fn) { effects.push(fn); }
        export const useLayoutEffect = useEffect;
        export const useMemo = fn => fn();
        export const useCallback = fn => fn;
      `,
      konva: `export default { Text: class { constructor(values) { this.textArr = values.text ? [values.text] : []; } destroy() {} } };`,
    };
    const result = await build({
      stdin: { contents: sources.join("\n"), resolveDir: fileURLToPath(new URL("../", import.meta.url)), loader: "ts" },
      bundle: true, write: false, format: "esm", platform: "node", jsx: "automatic",
      define: { BOARD_TEAM_FEATURES: "true", BOARD_LINK_PREVIEW_URL: "null",
        BOARD_TEAM_SETTINGS: JSON.stringify({ serverUrl: "https://server.test", supabaseUrl: "https://auth.test", anonKey: "synthetic" }) },
      plugins: [{ name: "link-card-harness", setup(b) {
        b.onResolve({ filter: /^(react|konva)$/ }, args => ({ path: args.path, namespace: "link-stub" }));
        b.onLoad({ filter: /.*/, namespace: "link-stub" }, ({ path }) => ({ contents: shims[path], loader: "js" }));
        b.onLoad({ filter: /\/team\/auth\.ts$/ }, () => ({
          contents: "export const auth = { getSession: async () => ({ data: { session: null } }) };",
          loader: "js",
        }));
      } }],
    });
    return import("data:text/javascript;base64," + Buffer.from(result.outputFiles[0].text).toString("base64"));
  })();
}

// Uses only existing modules so the compatibility check also runs on the prerequisite behavior baseline.
test("X10-U00 compatibility keeps plain text, Board object copies and file paste paths", async () => {
  const { add, empty } = await rules();
  const { isCanvasPasteTarget, isSpreadsheetData, isCsvFile } = await source("apps/web/src/table-csv.ts");
  const { buildSnapshot, plainText, buildPaste } = await clipboard();
  const { nativePasteKey } = await source("apps/web/src/images.ts");
  const board = add(empty(), "sticky", 0, 0), note = { ...board.objects[0], text: "Copied Board note" };
  const raw = { ...board, objects: [note] };
  const ownCopy = buildSnapshot(raw, new Set([note.id]), [{ ...note, displayHeight: note.height }]);
  assert(isCanvasPasteTarget(eventFor("plain words")));
  assert(!isSpreadsheetData("plain words", ""));
  assert.equal(plainText(ownCopy), note.text);
  assert.equal(buildPaste(raw, ownCopy, pasteView).board.objects.at(-1).text, note.text);
  const picture = new File([png], "fixture.png", { type: "image/png" });
  assert.equal(isCsvFile(picture), false);
  const event = eventFor("plain words", [picture]);
  assert(isCanvasPasteTarget(event));
  assert.equal(event.clipboardData.files[0], picture);
  assert(nativePasteKey({ isTrusted: true, key: "v", metaKey: true }, "Mac"));
});

test("X10-U01 only one bare address is consumed before media", async () => {
  const m = await harnessModules(), c = await cards(), board = (await rules()).empty();
  assert.deepEqual(c.pastedAddress("  " + url + "\n"), { kind: "card", url });
  for (const text of [url + " " + url, url + " with a space", "plain words", "mailto:board@example.test",
    "https://fieldnotes.test/" + "x".repeat(1000)]) assert.equal(c.pastedAddress(text), null);
  const own = inputFor(board, { ownCopy: raw => raw === " " + url });
  assert.equal(m.linkPasteCandidate(eventFor(" " + url), own), null);
  assert.equal(m.linkPasteCandidate(eventFor(url), own).url, url);
  assert.equal(m.linkPasteCandidate(eventFor(url, [new File([png], "fixture.png")]), own), null);
  assert.equal(m.linkPasteCandidate(eventFor(url), { ...own, readOnly: true }), null);
  assert.equal(m.linkPasteCandidate(eventFor(url), { ...own, editing: () => true }), null);
  assert.equal(m.linkPasteCandidate(eventFor(url), { ...own, hosted: { canEdit: false, voting: {} } }), null);
  const denied = eventFor(url); denied.preventDefault();
  assert.equal(m.linkPasteCandidate(denied, own), null);
});

test("X10-U02 refused address shapes and serialized length paste as text", async () => {
  const { pastedAddress } = await cards();
  for (const text of ["http://127.0.0.1/", "http://[::1]/", "http://0x7f.1/", "http://localhost:8080/",
    "ftp://fieldnotes.test/", "https://intranet/", "https://home.local/", "http://user:pw@fieldnotes.test/",
    "http://fieldnotes.test:22/", "https://fieldnotes.test/" + "é".repeat(330)]) {
    assert.deepEqual(pastedAddress("  " + text), { kind: "text", text });
  }
  assert.equal(pastedAddress(url.padEnd(1001, "x")), null);
});

test("X10-U03 sizes, line caps and face boxes use the stored rectangle", async () => {
  const { c, card } = await loading();
  const ready = { ...card, state: "ready", ...textFields, asset: "a".repeat(64) };
  for (const [look, size] of Object.entries(c.LINK_SIZES)) {
    const { width, height } = c.cardSize(look);
    assert.deepEqual([width, height], Array.from(size));
    assert.deepEqual(c.faceLayout(look, width, height).inner, { x: 1, y: 1, width: width - 2, height: height - 2 });
  }
  for (const [title, description, height] of [[1, 0, 230], [2, 0, 250], [1, 1, 251], [1, 2, 268], [2, 1, 271], [2, 2, 288]]) {
    assert.equal(c.verticalHeight(title, description), height);
    assert.deepEqual(c.cardLines({ height }), { title, description });
    assert.deepEqual(c.cardSize("vertical", { title, description }), { width: 306, height });
  }
  assert.equal(c.linkLook(ready, now), "vertical");
  assert.equal(c.linkLook({ ...ready, asset: null }, now), "titleVertical");
  assert.equal(c.linkLook({ ...ready, layout: "horizontal" }, now), "horizontal");
  assert.equal(c.linkLook({ ...ready, asset: null, layout: "horizontal" }, now), "titleHorizontal");
  assert.deepEqual(c.faceLayout("linkOnly", 306, 288).address, { x: 37, y: 136, width: 252, height: 16 });
  assert.equal(c.faceLayout("titleVertical", 306, 288).site.y, 255);
  assert.deepEqual(c.faceLayout("vertical", 306, 288).picture, c.LINK_LOOK.vertical.picture);
  assert.deepEqual(c.faceLayout("horizontal", 480, 114).picture, c.LINK_LOOK.horizontal.picture);
  assert.deepEqual(c.cardLines({ height: 114 }), { title: 2, description: 2 });
});

test("X10-U04 stale face and arrival gate respect the active opening and deadline", async () => {
  const { c, board, card } = await loading(), { arrivalGate } = await harnessModules();
  assert.equal(c.linkLook(card, now + 19999), "loading");
  assert.equal(c.linkLook(card, now + 20000), "linkOnly");
  const store = { active: true }, local = inputFor(board, { isAlive: () => true, getStore: () => store });
  const arrival = { opening: { boardId: board.boardId, store }, id: card.id, url, at: now };
  assert.equal(arrivalGate(local, arrival, now), card);
  store.active = false;
  assert.equal(arrivalGate(local, arrival, now), null);
  store.active = true;
  assert.equal(arrivalGate({ ...local, getStore: () => ({ active: true }) }, arrival, now), null);
  assert.equal(arrivalGate({ ...local, readOnly: true }, arrival, now), null);
  const hosted = { snapshot: { role: "editor" }, history: { previewing: true } };
  const team = { ...local, hosted }, attempt = { ...arrival, opening: { ...arrival.opening, hosted, store: null } };
  assert.equal(arrivalGate(team, attempt, now + 14999), "hold");
  assert.equal(arrivalGate(team, attempt, now + 15000), null);
  hosted.history.previewing = false;
  assert.equal(arrivalGate(team, attempt, now + 14999), card);
  hosted.snapshot.role = "viewer";
  assert.equal(arrivalGate(team, attempt, now), null);
});

test("X10-U05 thumbnail fit, GIF first frame, PNG alpha and JPEG quality", async t => {
  const { makeThumbnail, thumbnailSize } = await cards();
  assert.deepEqual(thumbnailSize(1200, 630), { width: 640, height: 336 });
  assert.deepEqual(thumbnailSize(1, 10000), { width: 1, height: 640 });
  assert.deepEqual(thumbnailSize(100, 120), { width: 100, height: 120 });
  const gif = asciiBuffer("GIF89aFIRST");
  const jpeg = Uint8Array.of(255, 216, 255, 217).buffer;
  const encoded = [];
  let alpha = 255, closed = 0, drawn;
  const priorDecoder = globalThis.createImageBitmap;
  globalThis.createImageBitmap = async blob => {
    assert.equal(blob.type, "image/gif");
    assert.equal(new TextDecoder().decode(await blob.arrayBuffer()), "GIF89aFIRST");
    return { width: 1200, height: 630, frame: "first", close: () => closed++ };
  };
  t.after(() => { if (priorDecoder) globalThis.createImageBitmap = priorDecoder; else delete globalThis.createImageBitmap; });
  const prior = globalThis.document;
  globalThis.document = { createElement: () => ({
    getContext: () => ({ drawImage(bitmap, ...bounds) { drawn = { frame: bitmap.frame, bounds }; },
      getImageData: () => ({ data: Uint8Array.of(0, 0, 0, alpha) }) }),
    toBlob(done, mime, quality) { encoded.push({ mime, quality }); done(new Blob([mime === "image/png" ? png : jpeg], { type: mime })); },
  }) };
  t.after(() => { if (prior) globalThis.document = prior; else delete globalThis.document; });
  const opaque = await makeThumbnail(gif);
  assert.equal(opaque.picture.mime, "image/jpeg");
  assert.deepEqual(drawn, { frame: "first", bounds: [0, 0, 640, 336] });
  alpha = 254;
  assert.equal((await makeThumbnail(gif)).picture.mime, "image/png");
  assert.deepEqual(encoded, [{ mime: "image/jpeg", quality: .85 }, { mime: "image/png", quality: undefined }]);
  assert.equal(closed, 2);
  assert.equal(await makeThumbnail(gif, { decode: async () => { throw Error("Undecodable"); } }), null);
});
const asciiBuffer = text => new TextEncoder().encode(text).buffer;

test("X10-U06 local arrival amends paste, move and restored conversion history", async () => {
  const { c, empty, board, card } = await loading(), h = await history(), pasted = h.record(h.emptyHistory(), empty, board);
  const finished = c.finishCard(card, textFields);
  let step = h.undo(replace(board, finished), c.amendHistory(pasted, finished));
  assert.deepEqual(step.board.objects, []);
  const redone = h.redo(step.board, step.history).board.objects[0];
  assert.equal(redone.id, card.id); assert.notEqual(redone.generation, card.generation); assert.equal(redone.state, "ready");
  const moved = { ...card, x: card.x + 17, y: card.y + 33 }, after = replace(board, moved);
  const arrived = c.finishCard(moved, textFields), recorded = c.amendHistory(h.record(pasted, board, after), arrived);
  step = h.undo(replace(after, arrived), recorded);
  assert.equal(step.board.objects[0].x, card.x); assert.equal(step.board.objects[0].state, "ready");
  step = h.undo(step.board, step.history); assert.equal(step.board.objects.length, 0);
  step = h.redo(step.board, step.history); assert.equal(step.board.objects[0].x, card.x);
  step = h.redo(step.board, step.history); assert.equal(step.board.objects[0].x, moved.x);
  const text = c.cardToText(board, card.id, 135).board;
  const restored = h.undo(text, h.record(pasted, board, text));
  assert.equal(restored.board.objects[0].id, card.id);
  const later = c.finishCard(restored.board.objects[0], textFields);
  const redo = h.redo(replace(restored.board, later), c.amendHistory(restored.history, later));
  assert.equal(redo.board.objects[0].text, url);
  assert.equal(h.undo(redo.board, redo.history).board.objects[0].title, textFields.title);
  const earlyUndo = h.undo(board, pasted), earlyRedo = h.redo(earlyUndo.board, earlyUndo.history);
  assert.equal(earlyRedo.board.objects[0].id, card.id);
  assert.equal(earlyRedo.board.objects[0].state, "loading");
});
test("X10-U07 Change back to text preserves bounds, section and Undo restores thumbnail", async () => {
  const { c, board, card } = await loading(), h = await history();
  const ready = c.finishCard(card, { ...textFields, asset: "a".repeat(64) }, { title: 1, description: 1 });
  const original = replace(board, ready);
  const changed = c.cardToText(original, card.id, 170), plain = changed.board.objects[0];
  assert.deepEqual([plain.text, plain.x, plain.y, plain.width, plain.height, plain.textSize, plain.color, plain.align],
    [url, card.x, card.y, 320, 170, "medium", "neutral", "left"]);
  assert.deepEqual(plain.marks, []);
  const restored = h.undo(changed.board, h.record(h.emptyHistory(), original, changed.board)).board.objects[0];
  assert.deepEqual({ ...restored, generation: ready.generation }, ready);
  assert.notEqual(restored.generation, ready.generation);
});

test("X10-U08 schema 16 validates the card sizes, fields and schema 15 upgrade", async () => {
  const { c, empty, board, card } = await loading(), r = await rules();
  const { validLink } = await source("packages/board-rules/src/objects/link.ts");
  assert.equal(r.empty().schemaVersion, 18);
  const older = { ...empty, schemaVersion: 15 };
  assert.deepEqual(r.upgrade(older), empty); assert.equal(older.schemaVersion, 15);
  assert.throws(() => r.validate({ ...board, schemaVersion: 15 }));
  for (const [width, height] of c.CARD_SIZES) for (const state of ["loading", "ready", "linkOnly"]) {
    const resized = { ...card, width, height, state, title: state === "ready" ? "title" : "" };
    assert.equal(validLink(resized), true);
    assert.doesNotThrow(() => r.validate(replace(board, resized)));
    assert.equal(validLink({ ...resized, height: height + 0.1 }), false);
  }
  for (const change of [{ url: "" }, { url: "ftp://fieldnotes.test/" }, { url: "https://u:p@fieldnotes.test/" },
    { url: "HTTP://FieldNotes.test" }, { url: url.padEnd(1001, "x") }, { title: "loading title" }, { description: "c\u0000" },
    { site: "\ud800" }, { asset: undefined }, { asset: "a".repeat(64) }, { layout: "horizontal" }, { requestedAt: -1 },
    { requestedAt: 1.5 }, { requestedAt: 2 ** 53 }, { state: "ready", title: " " }, { state: "idle" }]) {
    assert.equal(validLink({ ...card, ...change }), false, JSON.stringify(change));
  }
  assert.deepEqual(Object.keys(JSON.parse(r.canonical(board)).objects[0]),
    ["id", "generation", "type", "page", "group", "section", "url", "title", "description", "site", "asset", "layout", "state", "requestedAt", "x", "y", "width", "height", "order"]);
  const { isLink, linkType, isMedia, pictureOf, assetsOf, keepsProportions, eligibleIdea, eligibleVote } =
    await source("packages/board-rules/src/objects/registry.ts");
  assert.equal(linkType().type, "link"); assert(isLink(card)); assert(!isMedia(card)); assert(!keepsProportions(card)); assert(!eligibleIdea(card)); assert(eligibleVote(card));
  assert.deepEqual(assetsOf(card), []);
  const ready = c.finishCard(card, { ...textFields, asset: "b".repeat(64) });
  assert.equal(pictureOf(ready), ready.asset); assert.deepEqual(assetsOf(ready), [ready.asset]);
});

test("X10-U09 board file and template round trips keep card state and its thumbnail", async () => {
  const { c, board, card } = await loading(), { pictureHash } = await source("apps/web/src/image-assets.ts");
  const { writeBoardFile, readBoardBundle } = await source("apps/web/src/board-file.ts");
  const { templateBoard } = await source("apps/web/src/team/templates-rules.ts");
  const { templateObjects } = await source("apps/server/src/templates.ts");
  const hash = await pictureHash(png), picture = { bytes: png, mime: "image/png", pixelWidth: 2, pixelHeight: 2 };
  const ready = c.finishCard(card, { ...textFields, asset: hash });
  const document = replace(board, ready), held = new Map([[hash, picture]]);
  const serialized = await writeBoardFile(document, undefined, held);
  const read = await readBoardBundle(file(serialized));
  assert.deepEqual(read.board, document);
  assert.deepEqual(read.pictures.get(hash), picture);
  assert.equal(await writeBoardFile(read.board, undefined, read.pictures), serialized);
  await assert.rejects(writeBoardFile(document, undefined, new Map()), /picture is unavailable/);
  const { generation, order, page, ...saved } = ready;
  const wrapped = templateBoard([saved]);
  const { generation: _, order: __, page: ___, ...object } = wrapped.objects[0];
  assert.deepEqual(object, saved);
  assert.throws(() => templateObjects([saved]), /bad_request/);
  assert.deepEqual(templateObjects([saved], new Map([[hash, { type: "image/png" }]])).objects, [saved]);
  assert.throws(() => templateObjects([saved], new Map([[hash, { type: "video/mp4" }]])), /asset_missing/);
});

async function editingHarness(t, initial, hostId = 20) {
  initial = { ...initial, title: "Team fixture" };
  const m = await harnessModules();
  const sent = [], fakeWindow = { addEventListener() {}, removeEventListener() {} };
  const priorWindow = globalThis.window;
  globalThis.window = fakeWindow;
  t.after(() => { if (priorWindow) globalThis.window = priorWindow; else delete globalThis.window; });
  const hosted = new m.HostedBoard({ kind: "board", board: initial.boardId }, () => {});
  const session = new m.BoardSession({
    clientId: hostId, ticket: async () => "fixture", open: () => new Promise(() => {}),
    clock: { now: () => now, after: () => () => {} },
  });
  t.after(() => session.close?.());
  session.doc.clientID = hostId;
  session.adapter.set(initial);
  session.joined = true;
  session.role = "editor";
  session.transport = { send: value => sent.push(JSON.parse(value)), close() {} };
  hosted.session = session;
  hosted.snapshot = { ...hosted.snapshot, connected: true, role: "editor", board: initial };
  session.subscribe(event => { if (event.kind === "refused") hosted.changed(session, event); });
  let resolvePreview;
  const requests = [], mockPreview = () => new Promise(resolve => { resolvePreview = resolve; });
  hosted.pictures.linkPreview = (url, signal) => { requests.push({ url, signal }); return mockPreview(); };
  const boardSlots = [], linkSlots = [];
  let doc, link, selection = new Set(), currentBoard = initial;
  function render(withEffects = false, overrides = {}) {
    doc = m.render(boardSlots, () => m.useBoardDocument({ hosted, readOnly: false, setStatus: () => {} }));
    const input = inputFor(doc.model.current, {
      hosted, model: doc.model, board: doc.model.current, selected: selection, editing: () => false,
      commit: doc.commit, select: id => { selection = new Set([id]); }, historyRef: doc.historyRef, updateHistory: doc.updateHistory,
      lineCount: () => 1, getView: () => centre, scene: { current: { focus() {} } }, getStore: () => null, isAlive: () => true, ...overrides,
    });
    link = m.render(linkSlots, () => m.useLinkCards(input));
    if (withEffects) {
      const cleanup = m.effects.at(-1)?.();
      if (typeof cleanup === "function") cleanup();
    }
    return doc;
  }
  render().load(initial);
  render();
  t.after(() => doc.adapter.current.destroy());
  const useRemote = value => { currentBoard = value; doc.model.current = value; render(); };
  function paste() {
    render();
    const event = eventFor(url);
    link.paste(() => assert.fail("Address reached downstream paste"))(event);
    assert(event.defaultPrevented);
    currentBoard = session.board;
    render();
    return session.board.objects.at(-1);
  }
  async function finish(answer = { url, ...textFields, picture: null }) {
    resolvePreview(answer);
    await setImmediate();
    render(true);
    return session.board;
  }
  return { m, session, hosted, sent, requests, render, paste, finish, useRemote,
    get doc() { return doc; }, get link() { return link; }, get board() { return currentBoard; } };
}

test("X10-U13 team arrival uses the document commit, session amendment and synchronous retry", async t => {
  const { empty } = await rules(), c = await cards();
  const first = await editingHarness(t, empty(), 20), { session, sent } = first;
  const pasted = first.paste(), completed = await first.finish();
  assert.equal(completed.objects[0].title, textFields.title);
  assert.equal(session.history.past.length, 1);
  assert.equal(session.requests.get(sent.at(-1).requestId).arrivalOf, pasted.id);
  first.hosted.inverse("undo"); assert.equal(session.board.objects.length, 0);
  first.hosted.inverse("redo"); assert.equal(session.board.objects[0].title, textFields.title);
  assert.notEqual(session.board.objects[0].id, pasted.id);
  assert.equal(first.requests.length, 1);

  const moving = await editingHarness(t, empty(), 31);
  const start = moving.paste(), moved = { ...start, x: start.x + 40, y: start.y + 7 };
  moving.doc.commit(replace(moving.session.board, moved), true);
  moving.render();
  assert.equal((await moving.finish()).objects[0].x, moved.x);
  assert.equal(moving.session.undo(), "changed_by_others");
  moving.session.undo(); assert.equal(moving.session.board.objects.length, 0);
  moving.session.redo(); assert.equal(moving.session.board.objects[0].x, moved.x);
  assert.equal(moving.session.redo(), "nothing_to_undo");

  const refused = await editingHarness(t, empty(), 32), refusing = refused.paste();
  const fakeClock = refused.session.options.clock;
  assert.equal(fakeClock.now(), now);
  const loadingBoard = refused.session.board;
  const originalSend = refused.session.sendEdit.bind(refused.session);
  let attempted = 0;
  refused.session.sendEdit = (update, group, touched, arrivalOf) => {
    if (arrivalOf && ++attempted === 1) {
      return originalSend(new Uint8Array(800_000), group, touched, arrivalOf);
    }
    return originalSend(update, group, touched, arrivalOf);
  };
  await refused.finish();
  assert.equal([...refused.session.requests.values()].find(r => r.state === "refused")?.arrivalOf, refusing.id);
  assert.equal(refused.hosted.snapshot.toast, "");
  refused.session.adapter.set(loadingBoard);
  refused.session.joined = true;
  refused.session.transport = { send: value => refused.sent.push(JSON.parse(value)), close() {} };
  refused.hosted.snapshot = { ...refused.hosted.snapshot, connected: true, board: loadingBoard };
  refused.useRemote(loadingBoard);
  refused.render(true);
  assert.equal(refused.session.board.objects[0].state, "linkOnly");
  assert.equal(attempted, 2);
  refused.render(true);
  assert.equal(attempted, 2);

  const { NodeStorage } = await source("apps/server/src/node-storage.ts");
  const { initialize } = await source("packages/board-room/src/storage.ts");
  const storage = new NodeStorage(":memory:"); initialize(storage); t.after(() => storage.close());
  const { canonical } = await rules();
  for (const [label, order] of [["A: move then arrival", [1, 0]], ["B: arrival then move", [0, 1]]]) {
    const { board, card } = await loading(), { m } = first;
    const base = new m.Adapter(); base.doc.clientID = 10; base.set(board);
    const peers = [new m.Adapter(), new m.Adapter()];
    const full = m.Y.encodeStateAsUpdate(base.doc), vector = m.Y.encodeStateVector(base.doc);
    m.Y.applyUpdate(peers[0].doc, full); m.Y.applyUpdate(peers[1].doc, full);
    const arrival = c.finishCard(card, textFields);
    const moved = { ...card, x: card.x + 40 };
    peers[0].doc.clientID = 110; peers[1].doc.clientID = 210;
    peers[0].set(replace(board, arrival));
    peers[1].set(replace(board, moved));
    const updates = peers.map(peer => m.Y.encodeStateAsUpdate(peer.doc, vector));
    let room = { doc: base.doc, board };
    for (const index of order) {
      const result = m.evaluate(room.doc, room.board, updates[index], storage);
      assert.equal(result.kind, "complete", label + ": " + (result.reason ?? ""));
      room.doc.destroy(); room = result;
    }
    const final = room.board.objects[0];
    // Case A deliberately saves the lower-client-ID arrival last.
    const expected = order.at(-1) === 0 ? arrival : { ...arrival, x: moved.x, y: moved.y, width: moved.width, height: moved.height };
    assert.deepEqual(final, expected, label);
    assert.doesNotThrow(() => canonical(room.board), label);
    for (const peer of peers) {
      m.Y.applyUpdate(peer.doc, m.Y.encodeStateAsUpdate(room.doc));
      assert.deepEqual(peer.doc.toJSON(), room.doc.toJSON(), label);
      peer.destroy();
    }
    room.doc.destroy();
  }
});

test("X10-U14 restored team card gets a new id and its old arrival is dropped", async t => {
  const b = await editingHarness(t, (await rules()).empty()), c = await cards();
  const card = b.paste();
  b.link.bar.toText();
  assert.equal(b.session.board.objects[0].text, url);
  b.hosted.inverse("undo");
  const back = b.session.board.objects[0];
  assert.notEqual(back.id, card.id);
  b.useRemote(b.session.board);
  await b.finish();
  assert.equal(b.session.board.objects[0].state, "loading");
  assert.equal(c.linkLook(back, back.requestedAt + 20_000), "linkOnly");
  assert.equal(b.requests.length, 1);
  assert.equal([...b.session.requests.values()].some(request => request.arrivalOf), false);
});

test("X10-U15 Add template uploads the thumbnail before inserting the card", async t => {
  const { c, empty, card } = await loading(), { runTemplateAdd } = await harnessModules();
  const hash = "a".repeat(64), asset = { hash, type: "image/png", bytes: png.byteLength };
  const ready = c.finishCard(card, { ...textFields, asset: hash });
  const events = [];
  t.mock.method(globalThis, "fetch", () => assert.fail("No request should leave the template transfer doubles"));
  const bytes = new Blob([png], { type: "image/png" });
  const { generation: _oldGeneration, page: _oldPage, order: _oldOrder, ...saved } = ready;
  const { templateBoard, templateSnapshot } = await source("apps/web/src/team/templates-rules.ts");
  const { buildPaste } = await clipboard();
  let inserted;
  const result = await runTemplateAdd([saved], [asset], {
    download: async entry => { assert.deepEqual(entry, asset); events.push("download"); return { kind: "ok", blob: bytes }; },
    upload: async (entry, blob) => { assert.deepEqual(entry, asset); assert.equal(blob, bytes); events.push("upload"); return "ok"; },
    insert: () => {
      const wrapped = templateBoard([saved]);
      assert.equal(wrapped.objects[0].asset, hash);
      const selected = new Set([ready.id]);
      const snapshot = templateSnapshot(wrapped, selected, [{ ...wrapped.objects[0], displayHeight: ready.height }]);
      inserted = buildPaste(empty, snapshot.snapshot, pasteView).board.objects[0];
      events.push("insert");
    },
  }, () => {});
  assert.equal(result.ok, true);
  assert.deepEqual(events, ["download", "upload", "insert"]);
  assert.notEqual(inserted.id, ready.id); assert.notEqual(inserted.generation, ready.generation);
  assert.equal(inserted.asset, hash); assert.equal(inserted.url, url);
});

test("X10-U16 card placement, layout, arrival and conversion stay inside document bounds", async () => {
  const { c, card, board, empty } = await loading(), { validate } = await rules();
  const placed = c.pasteCard(empty, url, { x: 1e8, y: -1e8 }, empty.boardId, now, true).board.objects[0];
  assert.deepEqual([placed.x, placed.y], [999_694, -1_000_000]);
  const corner = { ...card, x: 999_694, y: 999_712 };
  const ready = c.finishCard(corner, { ...textFields, asset: "a".repeat(64) });
  const horizontal = c.withLayout(ready, "horizontal");
  assert.deepEqual([horizontal.x, horizontal.y, horizontal.width], [999_520, 999_712, 480]);
  const failed = c.finishCard(corner, null);
  assert.deepEqual([failed.x, failed.y], [999_520, 999_712]);
  const lower = { ...failed, x: 999_520, y: 999_936 };
  const text = c.cardToText(replace(board, lower), lower.id, 200);
  assert.deepEqual([text.board.objects[0].x, text.board.objects[0].y], [999_520, 999_800]);
  assert.equal(c.cardToText(replace(board, corner), corner.id, 120).board.objects[0].x, 999_680);
  assert.doesNotThrow(() => validate(text.board));
  assert.doesNotThrow(() => validate(replace(board, horizontal)));
  assert.doesNotThrow(() => validate(replace(board, failed)));
});

test("link preview client requests and About lines are mode-specific", async () => {
  const c = await cards(), api = await source("apps/web/src/link-preview-client.ts");
  assert.equal(c.aboutLine(false, false), "");
  assert.equal(c.aboutLine(false, true), c.LINK_ABOUT_LOCAL);
  assert.equal(c.aboutLine(true, false), c.LINK_ABOUT_TEAM);
  const signal = new AbortController().signal, init = api.previewRequest(url, signal);
  assert.deepEqual(init, { method: "POST", body: JSON.stringify({ url }), headers: { "Content-Type": "application/json" },
    credentials: "omit", referrerPolicy: "no-referrer", cache: "no-store", signal });
  assert.equal(await api.requestLinkPreview(url, signal), null);
  for (const status of [204, 400, 401, 403, 404, 413, 422, 429, 502, 503]) {
    assert.equal(await api.readLinkPreview(new Response(null, { status })), null);
  }
  const preview = { url, ...textFields, picture: { type: "image/png", bytes: Buffer.from(png).toString("base64") } };
  assert.deepEqual(await api.readLinkPreview(Response.json(preview)), { ...preview, picture: { type: "image/png", bytes: png } });
  for (const body of [{ ...preview, title: "" }, { ...preview, picture: { type: "image/png", bytes: "invalid=" } }, { ...preview, extra: 1 }]) {
    assert.equal(await api.readLinkPreview(Response.json(body)), null);
  }
});
