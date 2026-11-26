// SPDX-License-Identifier: Apache-2.0
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import test from "node:test";

const rule = () => import("../packages/board-rules/src/text-link.ts");
const marks = () => import("../packages/board-rules/src/marks.ts");
const document = () => import("../packages/board-rules/src/document.ts");
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const check = (id, name, run) => test(`X11-R${String(id).padStart(2, "0")} ${name}`, run);
const first = "https://example.com/", second = "http://localhost:5173/x";
const mark = (start, end, link = first) => ({ start, end, link });
const asFile = raw => ({ size: Buffer.byteLength(raw), arrayBuffer: async () => new TextEncoder().encode(raw).buffer });

function stored16(boardId = randomUUID()) {
  return { schemaVersion: 16, boardId, title: "Linked notes", pages: [{ id: boardId, name: "Page 1" }],
    objects: [{ id: randomUUID(), generation: randomUUID(), type: "sticky", page: boardId, text: "abcd",
      color: "rose", textSize: "medium", align: "left", group: null, marks: [{ start: 0, end: 2, bold: true }],
      section: null, x: 0, y: 0, width: 240, height: 240, order: 0 }], retiredGenerations: [] };
}

async function linkedBoard() {
  const { empty, add } = await document();
  const board = ["sticky", "shape", "text"].reduce((board, kind, index) => add(board, kind, 260 * index, 0), { ...empty(), title: "Linked notes" });
  board.objects.forEach((item, index) => {
    item.text = "abcd";
    item.marks = index === 0 ? [mark(0, 2)] : index === 1 ? [{ start: 0, end: 2, bold: true, link: first }]
      : [mark(0, 2), mark(2, 4, second)];
  });
  return board;
}

check(1, "address rule normalizes absolute URLs and bare hosts, with the input and href limits", async () => {
  const { linkAddress } = await rule();
  for (const [raw, href] of [["example.com", first], ["  https://Example.com/a  ", first + "a"],
    ["HTTP://Example.COM", "http://example.com/"], ["example.com:8080/x", "https://example.com:8080/x"],
    ["http://localhost:3000/x", "http://localhost:3000/x"], [second, second], ["http://127.0.0.1/", "http://127.0.0.1/"],
    ["https://192.168.1.10/", "https://192.168.1.10/"], [first.padEnd(2048, "x"), first.padEnd(2048, "x")]]) {
    assert.deepEqual(linkAddress(raw), { ok: true, href }, raw);
  }
  for (const raw of ["", "localhost", "localhost:3000", "notes", "//example.com", "/example.com", "javascript:alert(1)", "data:,x",
    "mailto:a@example.com", "ftp://example.com/", "http://", "https://user@example.com/", "https://:pw@example.com/",
    "https://exa mple.com/", "https://example.com/a\u007fb", first.padEnd(2049, "x"), "example.com/".padEnd(2048, "x")]) {
    assert.deepEqual(linkAddress(raw), { ok: false }, raw);
  }
});

check(2, "linkAt identifies a maximal run across flags and touchesLink includes its caret boundaries", async () => {
  const { linkAt, touchesLink } = await rule();
  const formatted = [mark(1, 3), { ...mark(3, 4), bold: true }, mark(4, 5, second)];
  assert.deepEqual(linkAt(formatted, 6, 2, 4), { start: 1, end: 4, href: first });
  assert.deepEqual(linkAt(formatted, 6, 3, 3), { start: 1, end: 4, href: first });
  for (const [start, end] of [[1, 1], [4, 4], [2, 5], [5, 5]]) {
    assert.equal(linkAt(formatted, 6, start, end), null);
    assert(touchesLink(formatted, 6, start, end));
  }
  assert(!touchesLink(formatted, 6, -1, 0));
  assert(!touchesLink(formatted, 6, 5, 6));
});

check(3, "setLink replaces both links, removes just the selected link and keeps flags and a caret unchanged", async () => {
  const { setLink } = await rule(), flags = { start: 0, end: 2, bold: true };
  const original = [{ ...flags, link: first }, mark(2, 4, second)];
  assert.deepEqual(setLink(original, "abcd", 0, 4, second), [{ ...flags, link: second }, mark(2, 4, second)]);
  assert.deepEqual(setLink(original, "abcd", 1, 3, null), [{ start: 0, end: 1, bold: true, link: first },
    { start: 1, end: 2, bold: true }, mark(3, 4, second)]);
  assert.deepEqual(setLink(original, "abcd", 1, 1, null), original);
});

check(4, "setLink widens both ends to graphemes and uses code points without Segmenter", async t => {
  const { setLink } = await rule(), text = "a👍🏽e\u0301b";
  assert.deepEqual(setLink([], text, 2, 4, first), [mark(1, 5)]);
  assert.deepEqual(setLink([], text, 1, 5, first), [mark(1, 5)]);
  const segmenter = Object.getOwnPropertyDescriptor(Intl, "Segmenter");
  t.after(() => Object.defineProperty(Intl, "Segmenter", segmenter));
  Object.defineProperty(Intl, "Segmenter", { ...segmenter, value: undefined });
  assert.deepEqual(setLink([], text, 2, 4, first), [mark(2, 4)]);
});

check(5, "remap extends links only inside the run and respects explicit edit ranges and fallback", async () => {
  await rule();
  const { remap } = await marks();
  const original = [mark(1, 3)];
  for (const [after, expected] of [["abXcd", [mark(1, 4)]], ["aXbcd", [mark(2, 4)]], ["abcXd", original],
    ["abd", [mark(1, 2)]], ["ad", []]]) assert.deepEqual(remap(original, "abcd", after), expected, after);
  assert.deepEqual(remap([mark(1, 5)], "abcdef", "abXYef", { start: 2, end: 4 }), [mark(1, 5)]);
  assert.deepEqual(remap([mark(0, 3), mark(3, 4, second)], "abcd", "abcXd"), [mark(0, 3), mark(4, 5, second)]);
  const link = mark(0, 3), bold = { start: 0, end: 3, bold: true };
  assert.deepEqual(remap([link], "aaaa", "aaaaa", { start: 1, end: 1 }), [mark(0, 4)]);
  assert.deepEqual(remap([link], "aaaa", "aaaaa"), [link]);
  assert.deepEqual(remap([bold], "aaaa", "aaaaa", { start: 1, end: 1 }), remap([bold], "aaaa", "aaaaa"));
  assert.deepEqual(remap([{ ...bold, link: first }], "aaaa", "aaaaa", { start: 1, end: 1 }), [{ ...bold, link: first }, mark(3, 4)]);
  assert.deepEqual(remap([link], "aaaa", "aaa", { start: 1, end: 2 }), [mark(0, 2)]);
  for (const edit of [{ start: -1, end: 0 }, { start: 2, end: 2 }, { start: 0, end: 0 }]) {
    assert.deepEqual(remap(original, "abcd", "abXcd", edit), remap(original, "abcd", "abXcd"));
  }
});

check(6, "format normalization, flag toggles, segments and mark validation preserve links", async () => {
  await rule();
  const { FLAGS, formatted, formattedRange, normalize, segments, toggle, validMarks } = await marks();
  const linked = [mark(0, 4)];
  for (const flag of FLAGS) {
    assert(!formatted(linked, 4, flag));
    const changed = toggle(linked, 4, 1, 3, flag);
    assert.deepEqual(changed, [mark(0, 1), { start: 1, end: 3, [flag]: true, link: first }, mark(3, 4)]);
    assert(formattedRange(changed, 4, 1, 3, flag));
    assert.deepEqual(toggle(changed, 4, 1, 3, flag), linked);
  }
  assert.deepEqual(normalize([mark(0, 2), mark(2, 3), mark(3, 5, second)], 4), [mark(0, 3), mark(3, 4, second)]);
  assert.deepEqual(normalize([{ ...mark(0, 4), bold: true }, mark(1, 3, second)], 4),
    [{ ...mark(0, 1), bold: true }, { ...mark(1, 3, second), bold: true }, { ...mark(3, 4), bold: true }]);
  assert.deepEqual(segments("abcd", [mark(0, 1), mark(1, 2, second)]), [{ text: "a", link: first }, { text: "b", link: second }, { text: "cd" }]);
  assert(validMarks(linked, 4));
  assert(validMarks([mark(0, 2), mark(2, 4, second)], 4));
  assert(validMarks([mark(0, 2), { ...mark(2, 4), strike: true }], 4));
  for (const value of [[mark(0, 2), mark(2, 4)], [mark(0, 2, "")], [mark(0, 2, 123)]]) assert(!validMarks(value, 4));
  assert(validMarks([mark(0, 2, "example.com")], 4), "only document validation runs the URL rule");
});

check(7, "schema 17 validates rich-text links and writes keys in canonical order", async () => {
  await rule();
  const { canonical, validate, upgrade } = await document(), board = await linkedBoard(), old = stored16(board.boardId);
  assert.equal(validate(board).schemaVersion, 17);
  assert.deepEqual(upgrade(old), { ...old, schemaVersion: 17 });
  assert.equal(validate(old).schemaVersion, 16);
  assert.throws(() => validate({ ...board, schemaVersion: 16 }), /Invalid marks/);
  const item = board.objects[1];
  item.marks = [{ link: first, strike: true, italic: true, bold: true, end: 2, start: 0 }];
  assert.deepEqual(Object.keys(JSON.parse(canonical(board)).objects[1].marks[0]), ["start", "end", "bold", "italic", "strike", "link"]);
  for (const href of [42, null, "", "example.com", "HTTP://Example.com/", "javascript:alert(1)", "data:text/html,x", "mailto:a@example.com",
    "ftp://example.com/", "https://user:pw@example.com/", "https://example.com/a b", "https://example.com/a\u001fb", first.padEnd(2049, "x")]) {
    item.marks = [mark(0, 1, href)];
    assert.throws(() => validate(board), /Invalid marks/, String(href));
  }
});

check(8, "non-rich types enforce their existing validation precedence", async () => {
  await rule();
  const { add, validate } = await document(), { createConnector } = await import("../apps/web/src/connectors.ts");
  const base = await linkedBoard();
  const connector = createConnector(base, base.objects[0].id, base.objects[1].id).board;
  const make = (board, type) => ({ ...board, objects: board.objects.map(o => o.type === type ? { ...o, text: "ab", marks: [mark(0, 1)] } : o) });
  assert.throws(() => validate(make(connector, "connector")), /Invalid object paint/);
  assert.throws(() => validate(make(add(base, "mindNode", 0, 0), "mindNode")), /Invalid object paint/);
  assert.throws(() => validate(make(add(base, "section", 0, 0), "section")), /Invalid marks/);
  assert.equal(globalThis.document, undefined);
  assert.equal(typeof (await marks()).normalize, "function");
});

check(9, "local storage and the catalogue keep schema 17 and reject malformed and legacy links", async () => {
  await rule();
  const { canonical } = await document(), { decode, digest, LocalStore } = await import("../apps/web/src/storage.ts");
  const { boardKeys } = await import("../apps/web/src/board-catalog.ts");
  const board = await linkedBoard(), payload = canonical(board);
  const envelope = async payload => JSON.stringify({ formatVersion: 1, storageRevision: 1, payload, sha256: await digest(payload) });
  assert.equal(canonical((await decode(await envelope(payload))).board), payload);
  const raw = async change => envelope(JSON.stringify(change(JSON.parse(payload))));
  for (const mutate of [b => ({ ...b, schemaVersion: 16 }), b => { b.objects[0].marks[0].link = "javascript:alert(1)"; return b; }]) {
    await assert.rejects(decode(await raw(mutate)), /Invalid marks/);
  }
  const store = new LocalStore();
  const other = randomUUID(), records = new Map([[boardKeys("original").head, await envelope(payload)],
    [boardKeys(other).head, await raw(b => ({ ...b, schemaVersion: 18 }))]]);
  store.records = async () => records;
  const result = await store.refreshList();
  assert.deepEqual(result.map(row => row.state).sort(), ["newer", "valid"]);
});

check(10, "board files preserve links and legacy bytes, with no assets, staging or request", async t => {
  await rule();
  t.mock.method(globalThis, "fetch", () => assert.fail("text links must never be fetched"));
  const { canonical, upgrade } = await document(), { digest } = await import("../apps/web/src/storage.ts");
  const { writeBoardFile, readBoardBundle } = await import("../apps/web/src/board-file.ts");
  const { importBoard } = await import("../apps/web/src/team/import.ts");
  const board = await linkedBoard(), file = asFile(await writeBoardFile(board)), read = await readBoardBundle(file);
  assert.equal(canonical(read.board), canonical(board));
  assert.deepEqual([read.fileVersion, read.pictures.size, read.videos.size], [3, 0, 0]);
  assert.equal(await importBoard(file, async body => { assert.deepEqual(body, { title: board.title, document: board }); return "sent"; }), "sent");
  const legacy = stored16(board.boardId), old = asFile(await writeBoardFile(upgrade(legacy), legacy));
  assert.equal(canonical((await readBoardBundle(old)).board), canonical(legacy));
  assert.equal((await readBoardBundle(asFile(await writeBoardFile(upgrade(legacy))))).board.schemaVersion, 17);
  const malformed = async candidate => {
    const document = JSON.stringify(candidate), payload = JSON.stringify({ document, assets: [] });
    return asFile(JSON.stringify({ format: "nextphase-board", fileVersion: 3, payload, sha256: await digest(payload) }));
  };
  const base = JSON.parse(canonical(board));
  const { createConnector } = await import("../apps/web/src/connectors.ts");
  const connector = createConnector(base, base.objects[0].id, base.objects[1].id).board;
  const label = connector.objects.find(o => o.type === "connector");
  label.text = "ab"; label.marks = [mark(0, 1)];
  for (const candidate of [{ ...base, schemaVersion: 16 }, connector,
    ...["javascript:alert(1)", "example.com"].map(link => ({ ...base, objects: [{ ...base.objects[0], marks: [mark(0, 1, link)] }, ...base.objects.slice(1)] }))]) {
    await assert.rejects(readBoardBundle(await malformed(candidate)), /it is not a valid board/);
  }
});

check(11, "team template save, server validation and add retain marks without media", async t => {
  await rule();
  t.mock.method(globalThis, "fetch", () => assert.fail("adding or saving a text link must never fetch it"));
  const board = await linkedBoard(), { empty, validate } = await document();
  const { templateSnapshot, templateBoard } = await import("../apps/web/src/team/templates-rules.ts");
  const { templateObjects } = await import("../apps/server/src/templates.ts");
  const { insertActivity } = await import("../apps/web/src/activities.ts");
  const snapshot = templateSnapshot(board, new Set(), board.objects).snapshot;
  assert.deepEqual(snapshot.objects.map(o => o.marks), board.objects.map(o => o.marks));
  const { objects } = templateObjects(snapshot.objects);
  const template = templateBoard(objects);
  assert.equal(template.schemaVersion, 17);
  const added = insertActivity({ ...empty(), title: "Template copy" }, template, { x: 0, y: 0, z: 1 }, { w: 1200, h: 800 }).board;
  assert.deepEqual(validate(added).objects.map(o => o.marks), board.objects.map(o => o.marks));
  const { createConnector } = await import("../apps/web/src/connectors.ts");
  const withConnector = createConnector(board, board.objects[0].id, board.objects[1].id).board;
  const invalidConnector = templateSnapshot(withConnector, new Set(), withConnector.objects).snapshot.objects;
  const label = invalidConnector.find(o => o.type === "connector");
  label.text = "ab"; label.marks = [mark(0, 1)];
  for (const bad of [invalidConnector, ...["javascript:alert(1)", "example.com"].map(link => [{ ...objects[0], marks: [mark(0, 1, link)] }])]) {
    assert.throws(() => templateBoard(bad));
    assert.throws(() => templateObjects(bad), error => error.status === 400);
  }
});

async function roomFixture(t) {
  const { Room } = await import("../packages/board-room/src/room.ts");
  const { NodeStorage } = await import("../apps/server/src/node-storage.ts");
  const storage = new NodeStorage(":memory:"), boardId = randomUUID(), now = 1795676400000;
  const env = { storage, now: () => now, schedule: async () => {}, fence: async () => 0, connections: () => [],
    randomId: randomUUID, randomTicket: randomUUID, hash: async bytes => hash(bytes),
    access: { board: async () => ({ title: "Linked notes", createdAt: new Date(now).toISOString() }), role: async () => "editor",
      changes: async () => ({ latest: 0, lowestKept: 1, changes: [] }) }, lifecycle: { lifecycle: async () => ({ state: "active", generation: 0 }) } };
  const room = new Room(boardId, env), person = { id: randomUUID(), email: "editor@example.test", expiresAt: Number.MAX_SAFE_INTEGER };
  t.after(() => { room.doc.destroy(); storage.close(); });
  return { boardId, room, person, storage };
}

check(12, "history capture and preview read back links at their declared schema", async t => {
  await rule();
  const { room, person, boardId } = await roomFixture(t), board = await linkedBoard();
  const { canonical } = await document();
  const initial = { ...board, boardId };
  await room.load(initial);
  const version = (await room.history.list(person)).versions[0];
  const preview = await room.history.preview(person, version.id);
  assert.equal(canonical(preview.document), canonical(initial));
  assert.equal(preview.document.schemaVersion, 17);
});

check(13, "schema 16 rooms adopt at 17 without a revision or duplicate history capture", async t => {
  await rule();
  const { storedBoardUpdate } = await import("./import-fixture.mjs");
  const { room, storage, boardId, person } = await roomFixture(t), old = stored16(boardId);
  await room.load();
  const legacy = await room.history.prepare(old);
  storage.exec("UPDATE snapshot_chunks SET bytes = ? WHERE kind = 'json'", legacy.data);
  storage.exec("UPDATE snapshot_chunks SET bytes = ? WHERE kind = 'yjs'", storedBoardUpdate(old));
  const version = room.history.capture(legacy, 0, 0, "checkpoint");
  room.initialized = false;
  await room.load();
  assert.deepEqual(room.board, { ...old, schemaVersion: 17 });
  assert.equal(room.doc.getMap("board").get("schemaVersion"), 17);
  const before = await room.history.list(person);
  await room.history.automatic("last_close");
  assert.deepEqual(await room.history.list(person), before);
  assert.equal(before.head.revision, 0);
  assert.equal((await room.history.preview(person, version.id)).document.schemaVersion, 16);
});

check(14, "room codec rejects unsafe, noncanonical and off-type links and repair keeps valid marks", async t => {
  await rule();
  const Y = await import("yjs"), { Adapter } = await import("../packages/board-sync/src/document-adapter.ts");
  const { readBoard, readLiveBoard } = await import("../packages/board-sync/src/codec.ts");
  const { evaluate } = await import("../packages/board-room/src/edits.ts");
  const { createConnector } = await import("../apps/web/src/connectors.ts");
  const linked = await linkedBoard();
  const base = createConnector(linked, linked.objects[0].id, linked.objects[1].id).board;
  const one = base.objects.find(o => o.type === "sticky"), connector = base.objects.find(o => o.type === "connector");
  connector.text = "ab";
  const room = new Adapter(); t.after(() => room.destroy());
  room.set(base);
  assert.deepEqual(readLiveBoard(room.doc), base);
  const edit = (id, marks, version) => {
    const client = new Y.Doc();
    try {
      Y.applyUpdate(client, Y.encodeStateAsUpdate(room.doc));
      const vector = Y.encodeStateVector(client);
      if (version !== undefined) client.getMap("board").set("schemaVersion", version);
      client.getMap("objects").get(id).set("marks", marks);
      return evaluate(room.doc, base, Y.encodeStateAsUpdate(client, vector), { all: () => [] });
    } finally { client.destroy(); }
  };
  for (const href of [123, "javascript:alert(1)", "https://user@example.com/", first.padEnd(2049, "x"), "example.com"]) {
    assert.deepEqual(edit(one.id, [mark(0, 1, href)]), { kind: "refused", reason: "invalid_update" });
  }
  assert.deepEqual(edit(one.id, [mark(0, 1, "example.com")], 16), { kind: "refused", reason: "invalid_document" });
  assert.deepEqual(edit(connector.id, [mark(0, 1)]), { kind: "refused", reason: "invalid_document" });
  const repaired = edit(one.id, [mark(0, 2, second), mark(2, 10, second)]);
  assert.equal(repaired.kind, "complete");
  t.after(() => repaired.doc.destroy());
  assert.deepEqual(readBoard(repaired.doc).objects.find(o => o.id === one.id).marks, [mark(0, 4, second)]);
});

check(15, "two real sessions set, replace, remove, Undo and Redo links and converge with a concurrent text edit", async t => {
  const { setLink } = await rule(), { remap } = await marks();
  const Y = await import("yjs"), { Adapter } = await import("../packages/board-sync/src/document-adapter.ts");
  const { BoardSession, encode, decode } = await import("../packages/board-sync/src/session.ts");
  const { readLiveBoard } = await import("../packages/board-sync/src/codec.ts");
  const { evaluate } = await import("../packages/board-room/src/edits.ts");
  const server = new Adapter(); t.after(() => server.destroy());
  const base = await linkedBoard(), id = base.objects[0].id;
  base.objects[0].marks = [];
  server.set(base);
  const clients = [];
  const send = (handler, value) => handler.message(JSON.stringify(value));
  const join = async clientId => {
    const wire = [];
    let handler;
    const session = await BoardSession.join({ clientId, clock: { now: () => 0, after: () => () => {} }, ticket: async () => "ticket",
      open: async () => ({ send: text => wire.push(JSON.parse(text)), close() {}, listen(next) {
        handler = next; send(handler, { kind: "joined", role: "editor", epoch: 1, restoreGeneration: 0, revision: 0,
          update: encode(Y.encodeStateAsUpdate(server.doc)), self: {}, present: [] });
      } }) });
    const client = { session, wire, handler }; clients.push(client); t.after(() => session.close()); return client;
  };
  const a = await join(17), b = await join(18);
  let revision = 0;
  const settle = client => {
    assert.equal(client.wire.length, 1, "exactly one edit frame");
    const frame = client.wire.shift(); assert.equal(frame.kind, "edit");
    const result = evaluate(server.doc, readLiveBoard(server.doc), decode(frame.update), { all: () => [] });
    assert.equal(result.kind, "complete");
    Y.applyUpdate(server.doc, result.update); result.doc.destroy(); revision++;
    for (const peer of clients) send(peer.handler, { kind: client === peer ? "saved" : "update", requestId: frame.requestId,
      revision, update: encode(result.update) });
  };
  const patch = (client, apply) => client.session.edit({ ...client.session.board,
    objects: client.session.board.objects.map(o => o.id === id ? apply(o) : o) });
  const link = (client, href) => patch(client, o => ({ ...o, marks: setLink(o.marks, o.text, 0, 3, href) }));
  const expected = href => href ? [mark(0, 3, href)] : [];
  const assertMarks = href => { for (const peer of clients) assert.deepEqual(peer.session.board.objects[0].marks, expected(href)); };
  for (const href of [first, second, null]) { link(a, href); settle(a); assertMarks(href); }
  for (const href of [second, first, null]) { a.session.undo(); settle(a); assertMarks(href); }
  for (const href of [first, second, null]) { a.session.redo(); settle(a); assertMarks(href); }
  link(a, first);
  patch(b, o => ({ ...o, text: "ab", marks: remap(o.marks, o.text, "ab") }));
  settle(a); settle(b);
  for (const peer of clients) assert.deepEqual([peer.session.board.objects[0].text, peer.session.board.objects[0].marks], ["ab", [mark(0, 2)]]);
  assert.equal(revision, 11);
});
