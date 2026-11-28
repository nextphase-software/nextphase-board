// SPDX-License-Identifier: Apache-2.0
import { test, beforeAll, afterEach, afterAll, inject } from "vitest";
import assert from "node:assert/strict";
import * as Y from "yjs";
import { makeDriver } from "board-test-driver";
import type { BoardV14, TableItem } from "../../packages/board-rules/src/document.ts";
import type { TableOrderHint } from "../../packages/board-sync/src/document-adapter.ts";
import type { Context, Driver, Peer } from "./driver-types.ts";

const context = inject<Context>("board"), runner = inject<string>("runner");
let driver: Driver, fixture: { a: string; workspace: string; people: Context["people"] };
let passed = 0, failed = 0;
const peers = new Set<Peer>();
const docs = new Set<Y.Doc>();
beforeAll(async () => { driver = await makeDriver(context); });
afterEach(async () => {
  for (const peer of peers) await peer.close();
  for (const doc of docs) doc.destroy();
  peers.clear(); docs.clear();
  await driver.control({ fixedNow: null, offset: 0 });
});
afterAll(async () => {
  await driver.close();
  console.log("SUMMARY-TABLES " + JSON.stringify({ runner, checks: passed + failed, pass: passed, fail: failed }));
});

async function subjects() {
  return {
    rules: await import("../../packages/board-rules/src/document.ts"),
    table: await import("../../packages/board-rules/src/objects/table.ts"),
    codec: await import("../../packages/board-sync/src/codec.ts"),
    sync: await import("../../packages/board-sync/src/session.ts"),
    adapter: await import("../../packages/board-sync/src/document-adapter.ts"),
    undo: await import("../../packages/board-sync/src/undo.ts"),
  };
}
type Subjects = Awaited<ReturnType<typeof subjects>>;
function check(id: number, label: string, run: (s: Subjects) => Promise<void>) {
  test(`S${id} ${label}`, async () => {
    try {
      const s = await subjects();
      const response = await fetch(context.helperUrl + "/removal-fixture", { method: "POST", body: "{}" });
      assert.equal(response.status, 200);
      fixture = await response.json() as typeof fixture;
      await run(s);
      passed++; console.log(`PASS: S${id} ${label}`);
    } catch (error) {
      failed++; console.log(`FAIL: S${id} ${label}`); throw error;
    }
  });
}
function request(path: string, who = "owner", method = "GET", body?: unknown) {
  return driver.request(path, { method, headers: { Authorization: "Bearer " + fixture.people[who].token,
    Origin: context.origin, "Content-Type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
}
async function ok(path: string, who = "owner", method = "GET", body?: unknown, status = 200): Promise<any> {
  const res = await request(path, who, method, body);
  assert.equal(res.status, status, await res.clone().text());
  return res.json();
}
async function create(board?: unknown) {
  return (await ok(`/workspaces/${fixture.workspace}/boards`, "owner", "POST",
    board === undefined ? { title: "Table check" } : { title: "Table check", document: board }, 201)).id as string;
}
const exported = (board = fixture.a): Promise<BoardV14> => ok(`/boards/${board}/export`);
const rowId = () => crypto.randomUUID();
const tableAt = (b: BoardV14) => b.objects[0] as TableItem;
const setTable = (b: BoardV14, table: TableItem): BoardV14 => ({ ...b, objects: [table, ...b.objects.slice(1)] });
const cell = (table: TableItem, row = 0, column = 0) => ({ row: table.rows[row].id, column: table.columns[column].id });
const map = (doc: Y.Doc, table: TableItem) => doc.getMap<Y.Map<unknown>>("objects").get(table.id)!;
function text(s: Subjects, t: TableItem, address: ReturnType<typeof cell>, value: string) {
  return s.table.setCell(t, address, value);
}
function seed(s: Subjects, columns = 2, rows = 2) {
  const board = s.rules.add({ ...s.rules.empty(), title: "Table check" }, s.table.table.type, -500, -250, undefined, { rows, columns });
  const table = tableAt(board);
  return setTable(board, text(s, table, cell(table), "Keep me"));
}
async function join(s: Subjects, board: string, who: string) {
  const ticket = await ok(`/boards/${board}/join-tickets`, who, "POST", undefined, 201);
  const peer = await driver.connect(`/boards/${board}/join?ticket=${ticket.ticket}`);
  peers.add(peer);
  const joined = await peer.next("joined"), doc = new Y.Doc();
  docs.add(doc);
  Y.applyUpdate(doc, s.sync.decode(joined.update));
  return { peer, doc, joined };
}
type Client = Awaited<ReturnType<typeof join>>;
async function pair(s: Subjects, board: string) {
  const owner = await join(s, board, "owner"), editor = await join(s, board, "editor");
  assert.deepEqual(s.codec.readBoard(owner.doc), s.codec.readBoard(editor.doc));
  return [owner, editor] as const;
}
function write(s: Subjects, doc: Y.Doc, next: BoardV14, hint?: TableOrderHint) {
  const adapter = new s.adapter.Adapter(); adapter.doc.destroy(); adapter.doc = doc;
  const vector = Y.encodeStateVector(doc);
  adapter.set(next, undefined, undefined, hint);
  return Y.encodeStateAsUpdate(doc, vector);
}
async function send(s: Subjects, c: Client, update: Uint8Array, reason?: string) {
  const requestId = rowId();
  c.peer.send({ kind: "edit", requestId, update: s.sync.encode(update), epoch: c.joined.epoch, restoreGeneration: c.joined.restoreGeneration });
  const answer = await c.peer.next(reason ? "refused" : "saved");
  assert.equal(answer.requestId, requestId);
  if (reason) assert.equal(answer.reason, reason);
  if (answer.update) Y.applyUpdate(c.doc, s.sync.decode(answer.update));
}
async function change(s: Subjects, c: Client, mutate: (t: TableItem) => TableItem, hint?: TableOrderHint) {
  const b = s.codec.readBoard(c.doc);
  await send(s, c, write(s, c.doc, setTable(b, mutate(tableAt(b))), hint));
}
function fork(doc: Y.Doc) { const next = new Y.Doc(); Y.applyUpdate(next, Y.encodeStateAsUpdate(doc)); docs.add(next); return next; }

check(425, "create and import bounded schema-14 tables and read legacy schema 13", async s => {
  assert.equal((await exported(await create())).schemaVersion, 18);
  const b = seed(s, 3, 4), t = tableAt(b);
  const served = await exported(await create(b));
  assert.equal(served.schemaVersion, 18);
  assert.deepEqual(tableAt(served), t);
  const { boardId, pages, title, retiredGenerations } = b;
  const legacy = { schemaVersion: 13, boardId, title, pages, objects: [], retiredGenerations };
  assert.equal((await exported(await create(legacy))).schemaVersion, 18);
  const refuses = async (document: unknown) => {
    const r = await request(`/workspaces/${fixture.workspace}/boards`, "owner", "POST", { title, document });
    assert.equal(r.status, 400);
    assert.equal((await r.json() as any).error.reason, "invalid_document");
  };
  await refuses({ ...b, schemaVersion: 13 });
  await refuses({ ...legacy, schemaVersion: 12, pages: undefined });
  for (const malformed of [
    { rows: [] }, { rows: [...s.table.createTable(1, 50).rows, t.rows[0]] },
    { columns: [...s.table.createTable(20, 1).columns, t.columns[0]] },
    { columns: [{ ...t.columns[0], width: 63 }, ...t.columns.slice(1)], width: t.width - 129 },
    { cells: [{ ...cell(t), text: "🟦".repeat(1001) }] },
    { rows: [{ ...t.rows[0], id: t.columns[0].id }, ...t.rows.slice(1)] },
    { cells: [{ ...cell(t), row: rowId(), text: "Missing row" }] }, { width: t.width + 1 },
  ]) await refuses(setTable(b, { ...t, ...malformed }));
  let maximum = { ...b, objects: [] as BoardV14["objects"] };
  for (let i = 0; i < 5; i++) maximum = s.rules.add(maximum, s.table.table.type, 0, 0, maximum.boardId, { columns: 20, rows: 50 });
  assert.equal((await exported(await create(maximum))).objects.length, 5);
  await refuses(s.rules.add(maximum, s.table.table.type, 0, 0, maximum.boardId, { columns: 1, rows: 1 }));
});

check(426, "two editors merge both arrival orders, including row/column intersections", async s => {
  const b = seed(s), t = tableAt(b), a = cell(t), z = cell(t, 1, 1), row = rowId(), row2 = rowId(), column = rowId();
  const cases: { edit: ((t: TableItem) => TableItem)[]; verify?: (t: TableItem, first: number) => void; intersection?: "initialize" | "race" }[] = [
    { edit: [t => text(s, t, a, "Keep me A"), t => text(s, t, z, "B")],
      verify: t => assert.deepEqual(t.cells.map(c => c.text), ["Keep me A", "B"]) },
    { edit: [t => text(s, t, a, "Keep me A"), t => text(s, t, a, "B Keep me")],
      verify: t => assert.equal(s.table.cellText(t, a), "B Keep me A") },
    { edit: [t => s.table.insertAxis(t, "row", row), t => s.table.insertAxis(t, "row", row2)],
      verify: t => assert.deepEqual(t.rows.slice(-2).map(r => r.id), [row, row2].sort()) },
    { edit: [t => s.table.resizeAxis(t, "column", a.column, 230), t => s.table.resizeAxis(t, "column", a.column, 260)],
      verify: (t, first) => assert.equal(t.columns[0].width, first ? 230 : 260) },
    { edit: [t => s.table.deleteAxis(t, "row", a.row), t => text(s, t, a, "Keep me updated")],
      verify: t => { assert(!t.rows.some(r => r.id === a.row)); assert.equal(t.cells.length, 0); } },
    { edit: [t => s.table.deleteAxis(t, "row", a.row), t => s.table.deleteAxis(t, "row", z.row)] },
    { edit: [t => s.table.insertAxis(t, "row", row), t => s.table.insertAxis(t, "column", column)],
      verify: t => { assert.equal(t.rows.length, 3); assert.equal(t.columns.length, 3); assert.equal(s.table.cellText(t, {row, column}), ""); },
      intersection: "initialize" },
    { edit: [t => s.table.insertAxis(t, "row", row), t => s.table.insertAxis(t, "column", column)],
      verify: t => assert.equal(s.table.cellText(t, {row, column}), ""), intersection: "race" },
  ];
  for (const spec of cases) for (const first of [0, 1]) {
    const board = await create(b), clients = await pair(s, board);
    const updates = clients.map((client, i) => {
      const base = s.codec.readBoard(client.doc);
      return write(s, client.doc, setTable(base, spec.edit[i](tableAt(base))));
    });
    await send(s, clients[first], updates[first]);
    await send(s, clients[1 - first], updates[1 - first], spec.verify ? undefined : "invalid_document");
    for (const client of clients) { await client.peer.close(); peers.delete(client.peer); }
    if (!spec.verify) { assert.equal(tableAt(await exported(board)).rows.length, 1); continue; }
    spec.verify(tableAt(await exported(board)), first);
    if (spec.intersection) {
      const intersection = { row, column }, key = s.table.cellKey(intersection);
      const cells = (doc: Y.Doc) => map(doc, t).get("cells") as Y.Map<Y.Text>;
      if (spec.intersection === "initialize") {
        const c = await join(s, board, first ? "owner" : "editor");
        assert(!cells(c.doc).has(key));
        await change(s, c, t => ({ ...t, x: t.x + 1 }));
        const head = await join(s, board, first ? "editor" : "owner");
        assert(cells(head.doc).get(key) instanceof Y.Text);
        assert.equal(cells(head.doc).get(key)?.toString(), "");
        for (const client of [c, head]) { await client.peer.close(); peers.delete(client.peer); }
      } else {
        const clients = await pair(s, board);
        const updates = clients.map((c, i) => {
          assert(!cells(c.doc).has(key));
          const base = s.codec.readBoard(c.doc);
          return write(s, c.doc, setTable(base, text(s, tableAt(base), intersection, i ? "B" : "A")));
        });
        await send(s, clients[first], updates[first]);
        await send(s, clients[1 - first], updates[1 - first]);
        const served = s.table.cellText(tableAt(await exported(board)), intersection);
        assert.match(served, /^[AB]$/);
        for (const c of clients) {
          const message = await c.peer.next("update");
          Y.applyUpdate(c.doc, s.sync.decode(message.update));
          assert.equal(cells(c.doc).get(key)?.toString(), served);
          await c.peer.close(); peers.delete(c.peer);
        }
      }
    }
  }
});

check(427, "wire updates contain only cell, axis size, entry or deletion changes", async s => {
  const b = seed(s, 3, 3), t = tableAt(b), at = cell(t), added = rowId(), key = s.table.cellKey(at);
  const changes = [
    { mutate: (t: TableItem) => text(s, t, at, "Keep me!"), expected: [[["cells", key], []]] },
    { mutate: (t: TableItem) => s.table.insertAxis(t, "row", added), expected: [
      [["cells"], t.columns.map(c => added + ":" + c.id)], [["rowMap"], [added]],
    ] },
    { mutate: (t: TableItem) => s.table.resizeAxis(t, "column", at.column, 240), expected: [[["columnMap", at.column], ["width"]]] },
    { mutate: (t: TableItem) => s.table.deleteAxis(t, "column", at.column), expected: [
      [["cells"], t.rows.map(r => r.id + ":" + at.column)], [["columnMap"], [at.column]],
    ] },
  ];
  for (const spec of changes) {
    const board = await create(b), c = await join(s, board, "owner");
    const before = s.codec.readBoard(c.doc), wire = fork(c.doc), target = map(wire, t);
    const paths: [string[], string[]][] = [];
    target.observeDeep(events => {
      for (const e of events) paths.push([e.path.map(String), [...((e as Y.YMapEvent<unknown>).keysChanged ?? [])].sort()]);
    });
    const update = write(s, c.doc, setTable(before, spec.mutate(tableAt(before))));
    Y.applyUpdate(wire, update);
    const expected = spec.expected.map(([path, keys]) => [path, keys.sort()]);
    assert.deepEqual(paths.sort(), expected.sort());
    await send(s, c, update);
    assert.deepEqual(tableAt(await exported(board)), tableAt(s.codec.readBoard(wire)));
  }
});

check(428, "hosted Undo restores atomic table steps and refuses stale compound guards", async s => {
  const original = seed(s), at = cell(tableAt(original)), added = rowId();
  type Change = (t: TableItem) => TableItem;
  const cases: { change: Change; interfere?: Change }[] = [
    { change: t => s.table.deleteAxis(t, "row", at.row) },
    { change: t => s.table.insertAxis(t, "row", added) },
    { change: t => s.table.resizeAxis(t, "column", at.column, 230) },
    { change: t => text(s, t, at, "Edited session") },
    { change: t => s.table.insertAxis(t, "row", added), interfere: t => text(s, t, { row: added, column: at.column }, "Peer") },
    { change: t => s.table.deleteAxis(t, "row", at.row), interfere: t => s.table.deleteAxis(t, "column", at.column) },
  ];
  for (const spec of cases) {
    const board = await create(original), owner = await join(s, board, "owner"), history = new s.undo.SharedUndo();
    const before = s.undo.capture(owner.doc), oldOrder = (map(owner.doc, tableAt(original)).get("rowMap") as Y.Map<Y.Map<unknown>>).get(at.row)!.get("order");
    await change(s, owner, spec.change);
    const changed = s.undo.capture(owner.doc);
    history.record(before, changed, undefined, "table step");
    if (spec.interfere) {
      const editor = await join(s, board, "editor");
      await change(s, editor, spec.interfere);
      const update = await owner.peer.next("update");
      Y.applyUpdate(owner.doc, s.sync.decode(update.update));
      const after = s.undo.capture(owner.doc);
      history.observe(changed, after, false);
      assert.equal(history.take(after, "undo"), "changed_by_others");
      assert.deepEqual(await exported(board), after.board);
    } else {
      const undo = history.take(changed, "undo");
      assert(typeof undo !== "string");
      await send(s, owner, write(s, owner.doc, undo, history.tableHint));
      assert.deepEqual(await exported(board), before.board);
      assert.equal((map(owner.doc, tableAt(original)).get("rowMap") as Y.Map<Y.Map<unknown>>).get(at.row)!.get("order"), oldOrder);
    }
  }
  const board = await create(original), owner = await join(s, board, "owner"), history = new s.undo.SharedUndo();
  const before = s.undo.capture(owner.doc), t = tableAt(before.board);
  await send(s, owner, write(s, owner.doc, { ...before.board, objects: [], retiredGenerations: [t.generation] }));
  const after = s.undo.capture(owner.doc); history.record(before, after);
  const restored = history.take(after, "undo");
  assert(typeof restored !== "string");
  await send(s, owner, write(s, owner.doc, restored, history.tableHint));
  const live = tableAt(await exported(board));
  assert.notEqual(live.id, t.id);
  assert.deepEqual(live.rows, t.rows); assert.deepEqual(live.columns, t.columns); assert.deepEqual(live.cells, t.cells);
});

check(429, "stored room upgrades and history and backup restores retain tables and revision boundaries", async s => {
  const { storedBoardUpdate, withoutPages } = await import("../import-fixture.mjs");
  const ops = (id: string, action: string, body?: unknown) => driver.request(`/operator/boards/${id}/${action}`, {
    method: "POST", headers: { "Board-Operator-Key": context.operatorKey, "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const versionRoot = (id: string) => `/boards/${id}/versions`;
  const restore = async (board: string, id: string) => {
    const { head } = await ok(versionRoot(board));
    await ok(versionRoot(board) + `/${id}/restore`, "owner", "POST",
      { requestId: rowId(), expectedRevision: head.revision, expectedGeneration: head.generation });
  };
  for (const [storage, schemaVersion] of [[8, 13], [7, 13], [8, 12]] as const) {
    const id = await create(), current = await exported(id), id2 = rowId();
    const prior = s.rules.add(current, "sticky", 0, 0).objects[0];
    const legacy13 = { schemaVersion: 13 as const, boardId: id, title: current.title,
      pages: [{ id, name: "Page 1" }, ...(schemaVersion === 13 ? [{ id: id2, name: "Ideas" }] : [])],
      objects: [{ ...prior, page: schemaVersion === 13 ? id2 : id }], retiredGenerations: [] };
    const legacy = schemaVersion === 13 ? legacy13 : { ...withoutPages(legacy13), schemaVersion };
    const json = new TextEncoder().encode(s.rules.canonical(legacy));
    const update = storedBoardUpdate(legacy, storage === 7 || schemaVersion < 13);
    const digest = Buffer.from(await crypto.subtle.digest("SHA-256", json)).toString("hex");
    const roomSQL: { sql: string; bindings?: unknown[] }[] = [
      { sql: "DELETE FROM edits" }, { sql: "DELETE FROM snapshot_chunks" },
      { sql: "UPDATE meta SET value=? WHERE key='storage_version'", bindings: [storage] },
      { sql: "UPDATE meta SET value=? WHERE key='history_capture_sha256'", bindings: [digest] },
      { sql: "UPDATE meta SET value=? WHERE key='history_capture_bytes'", bindings: [json.length] },
      { sql: "INSERT INTO identifiers VALUES (?,?,0)", bindings: [prior.id, prior.generation] },
    ];
    if (storage === 7) roomSQL.push(
      { sql: "DROP TABLE workshop_vote" },
      { sql: "CREATE TABLE workshop_vote (singleton INTEGER PRIMARY KEY,status TEXT,session_id TEXT,session_version INTEGER,prompt TEXT,budget INTEGER,targets TEXT,totals TEXT)" },
    );
    for (const [kind, bytes] of [["json", json], ["yjs", update]] as const) {
      for (let at = 0, i = 0; at < bytes.length; at += 32768, i++)
        roomSQL.push({ sql: `INSERT INTO snapshot_chunks VALUES (0,?,?,x'${Buffer.from(bytes.slice(at, at + 32768)).toString("hex")}')`, bindings: [kind, i] });
    }
    const versions = await ok(versionRoot(id)), receipts = await driver.rows(id, "receipts");
    await driver.control({ board: id, roomSQL }); await driver.wake(id);
    const live = await exported(id);
    assert.equal(live.schemaVersion, 18); assert.deepEqual(live, s.rules.upgrade(legacy));
    const c = await join(s, id, "owner");
    assert(!c.doc.getMap("board").has("pages")); assert(c.doc.getMap("board").get("pageMap") instanceof Y.Map);
    if (storage === 8 && schemaVersion === 13) {
      const old = new Y.Doc(); docs.add(old); Y.applyUpdate(old, update);
      const delta = Y.decodeUpdate(Y.encodeStateAsUpdate(c.doc, Y.encodeStateVector(old))).structs;
      assert.equal(delta.length, 1); assert.equal(delta[0].content.getContent()[0], 18);
    }
    await c.peer.close(); peers.delete(c.peer);
    assert.deepEqual(await ok(versionRoot(id)), versions);
    assert.deepEqual(await driver.rows(id, "receipts"), receipts);
    assert.deepEqual(await driver.rows(id, "edits"), []);
    await driver.wake(id); assert.deepEqual(await exported(id), live);
  }
  const board = await create(seed(s)), before = await exported(board);
  const version = (await ok(versionRoot(board), "owner", "POST", { requestId: rowId(), name: "With table", description: "" })).version;
  const c = await join(s, board, "owner");
  await change(s, c, t => text(s, t, cell(t), "Edited"));
  await restore(board, version.id);
  assert.deepEqual(await exported(board), before);
  const backup = await (await ops(board, "backup")).json();
  assert.equal((await ops(board, "restore", backup)).status, 200);
  assert.deepEqual(await exported(board), before);

  const oldBoard = await create(), current = await exported(oldBoard);
  const oldVersion = (await ok(versionRoot(oldBoard))).versions[0];
  const legacy = { schemaVersion: 13 as const, boardId: oldBoard, title: current.title,
    pages: current.pages, objects: [], retiredGenerations: [] };
  const bytes = new TextEncoder().encode(s.rules.canonical(legacy));
  await driver.control({ board: oldBoard, roomSQL: [{ sql: "DELETE FROM version_chunks WHERE version_id=?", bindings: [oldVersion.id] },
    { sql: `INSERT INTO version_chunks VALUES (?,0,x'${Buffer.from(bytes).toString("hex")}')`, bindings: [oldVersion.id] }] });
  await restore(oldBoard, oldVersion.id); assert.equal((await exported(oldBoard)).schemaVersion, 18);
});

check(430, "saving and inserting a team template twice remaps all table IDs", async s => {
  const board = await create(seed(s, 3, 4)), source = await exported(board), t = tableAt(source);
  const { templateSnapshot, templateBoard } = await import("../../apps/web/src/team/templates-rules.ts");
  const { insertActivity } = await import("../../apps/web/src/activities.ts");
  const { snapshot } = templateSnapshot(source, new Set(), [{ ...t, displayHeight: t.height }]);
  assert(snapshot);
  const path = `/workspaces/${fixture.workspace}/templates`;
  const item = await ok(path, "owner", "POST", { name: "Table template", description: "", sourceBoard: board, objects: snapshot.objects }, 201);
  const { objects } = await ok(path + "/" + item.id), wrapped = templateBoard(objects);
  const c = await join(s, board, "editor");
  for (let i = 0; i < 2; i++) {
    const next = insertActivity(s.codec.readBoard(c.doc), wrapped, { x: i * 500, y: 200, z: 1 }, { w: 1440, h: 900 }).board;
    await send(s, c, write(s, c.doc, next));
  }
  const tables = (await exported(board)).objects.filter(o => o.type === s.table.table.type) as TableItem[];
  assert.equal(tables.length, 3);
  assert.equal(new Set(tables.flatMap(t => [t.id, ...t.rows.map(r => r.id), ...t.columns.map(c => c.id)])).size, 24);
  for (const copy of tables) {
    assert.deepEqual(copy.rows.map(r => r.height), t.rows.map(r => r.height));
    assert.deepEqual(copy.columns.map(c => c.width), t.columns.map(c => c.width));
    assert.equal(s.table.cellText(copy, cell(copy)), "Keep me");
  }
});

function declared17(boardId = rowId()) {
  const columns = Array.from({ length: 2 }, () => ({ id: rowId(), width: 192 }));
  const rows = Array.from({ length: 2 }, () => ({ id: rowId(), height: 64 }));
  const table = { id: rowId(), generation: rowId(), type: "table" as const, page: boardId, columns, rows,
    cells: [{ row: rows[0].id, column: columns[0].id, text: "Legacy anchor" }],
    textSize: "medium" as const, group: null, section: null, x: 0, y: 0, width: 384, height: 128, order: 0 };
  return { schemaVersion: 17 as const, boardId, title: "Table check", pages: [{ id: boardId, name: "Page 1" }],
    objects: [table], retiredGenerations: [] };
}
function span(table: TableItem, top: number, left: number, bottom: number, right: number) {
  return { from: cell(table, top, left), to: cell(table, bottom, right) };
}

check(480, "merge and split updates, malformed results, schema create and import, and legacy template response", async s => {
  const seeded = seed(s, 4, 4), table = tableAt(seeded), target = span(table, 0, 0, 1, 1);
  const base = setTable(seeded, text(s, text(s, table, target.to, "Covered"), cell(table, 1, 0), "Also covered"));
  const board = await create(base), [owner, editor] = await pair(s, board);
  const open = s.codec.readLiveBoard(owner.doc), merged = s.table.mergeRange(tableAt(open), target);
  await send(s, owner, write(s, owner.doc, setTable(open, merged)));
  Y.applyUpdate(editor.doc, s.sync.decode((await editor.peer.next("update")).update));
  assert.deepEqual(s.codec.readLiveBoard(editor.doc), await exported(board));
  assert.deepEqual(tableAt(await exported(board)).merges, merged.merges);
  const texts = map(editor.doc, table).get("cells") as Y.Map<Y.Text>;
  assert.equal(texts.get(s.table.cellKey(target.to))?.toString(), "");
  assert.equal(texts.get(s.table.cellKey(cell(table, 1, 0)))?.toString(), "");
  await change(s, owner, table => s.table.splitMerge(table, target.from));
  Y.applyUpdate(editor.doc, s.sync.decode((await editor.peer.next("update")).update));
  assert.deepEqual(tableAt(s.codec.readLiveBoard(editor.doc)).merges, []);
  assert.deepEqual(tableAt(await exported(board)).merges, []);

  const accepted = await create(setTable(base, merged));
  const before = await exported(accepted), beforeEdits = await driver.rows(accepted, "edits");
  const key = s.table.cellKey(target.from), covered = s.table.cellKey(target.to);
  type Mutate = (m: Y.Map<unknown>) => void;
  const mergeMap = (m: Y.Map<unknown>) => m.get("mergeMap") as Y.Map<unknown>;
  const malformed: Mutate[] = [m => m.delete("mergeMap"),
    m => mergeMap(m).set("not a cell", { rows: 1, columns: 2 }),
    m => { mergeMap(m).set("deleted invalid key", { rows: 1, columns: 2 }); mergeMap(m).delete("deleted invalid key"); },
    ...[{ rows: 2 }, { rows: 2, columns: 2, extra: 1 }, { rows: 1.5, columns: 2 }, new Y.Map([["rows", 2], ["columns", 2]])]
      .map(value => (m: Y.Map<unknown>) => mergeMap(m).set(key, value))];
  const invalid: Mutate[] = [
    m => mergeMap(m).set(covered, { rows: 2, columns: 2 }),
    m => mergeMap(m).set(key, { rows: 1, columns: 1 }),
    m => mergeMap(m).set(key, { rows: 5, columns: 1 }),
    m => mergeMap(m).set(key, { rows: 1, columns: 5 }),
    m => mergeMap(m).set(rowId() + ":" + target.from.column, { rows: 1, columns: 2 }),
    m => mergeMap(m).set(target.from.row + ":" + rowId(), { rows: 2, columns: 1 }),
    m => (m.get("cells") as Y.Map<Y.Text>).get(covered)!.insert(0, "Text in a covered cell"),
  ];
  for (const [cases, reason] of [[malformed, "invalid_update"], [invalid, "invalid_document"]] as const) {
    for (const mutate of cases) {
      const client = await join(s, accepted, "owner"), doc = fork(client.doc), vector = Y.encodeStateVector(doc);
      mutate(map(doc, table));
      await send(s, client, Y.encodeStateAsUpdate(doc, vector), reason);
      assert.deepEqual(await exported(accepted), before);
      assert.deepEqual(await driver.rows(accepted, "edits"), beforeEdits);
      await client.peer.close();
      peers.delete(client.peer);
    }
  }
  const noTable = await create(), client = await join(s, noTable, "owner");
  {
    const doc = fork(client.doc), vector = Y.encodeStateVector(doc);
    doc.getMap("board").set("schemaVersion", 17);
    await send(s, client, Y.encodeStateAsUpdate(doc, vector), "invalid_document");
  }
  assert.deepEqual(await driver.rows(noTable, "edits"), []);

  // Construct a version-17 table snapshot through the old map shape, then
  // add an illegal mergeMap assignment while the client still declares 17.
  const legacy = declared17(noTable), legacyDoc = stored17(legacy);
  docs.add(legacyDoc);
  const wrongClient = await join(s, noTable, "owner"), wrong = fork(wrongClient.doc), vector = Y.encodeStateVector(wrong);
  wrong.getMap("board").set("schemaVersion", 17);
  const legacyMap = legacyDoc.getMap<Y.Map<unknown>>("objects").get(legacy.objects[0].id)!;
  const wrongTable = legacyMap.clone();
  wrong.getMap("objects").set(legacy.objects[0].id, wrongTable);
  wrongTable.set("mergeMap", new Y.Map());
  await send(s, wrongClient, Y.encodeStateAsUpdate(wrong, vector), "invalid_update");
  assert.deepEqual(await driver.rows(noTable, "edits"), []);

  const workspace = `/workspaces/${fixture.workspace}`;
  const historical = declared17();
  for (const document of [setTable(base, merged), historical]) {
    const normal = await exported(await create(document));
    assert.deepEqual(tableAt(normal), s.rules.upgrade(document).objects[0]);
    const stage = (await ok(workspace + "/imports", "owner", "POST", {
      assets: [{ hash: "a".repeat(64), type: "image/png", bytes: 1 }],
    }, 201)).import;
    const imported = await ok(workspace + "/boards", "owner", "POST", { title: "Table check", document, import: stage }, 201);
    const served = await exported(imported.id);
    assert.equal(served.schemaVersion, 18);
    assert.deepEqual(tableAt(served), s.rules.upgrade(document).objects[0]);
  }

  const templates = workspace + "/templates";
  const template = (objects: unknown[], name: string) => ({ name, description: "", sourceBoard: accepted, objects });
  const { generation: _g, page: _p, order: _o, ...object } = tableAt(before);
  const saved = await ok(templates, "owner", "POST", template([object], "Merged table"), 201);
  const rejected = await request(templates, "owner", "POST", template([{ ...object, merges: [...object.merges, ...object.merges] }], "Overlaps"));
  assert.equal(rejected.status, 400);
  assert.equal((await rejected.json() as any).error.reason, "bad_request");
  const { generation: _lg, page: _lp, order: _lo, ...legacyObject } = historical.objects[0];
  const old = await ok(templates, "owner", "POST", template([{ ...legacyObject, merges: [] }], "Legacy table"), 201);
  const json = JSON.stringify([legacyObject]), byteCount = Buffer.byteLength(json);
  const sql = await fetch(context.helperUrl + "/sql", { method: "POST", body: JSON.stringify({
    sql: `UPDATE nextphase_board.templates SET objects=$legacy$${json}$legacy$::jsonb, content_bytes=${byteCount} WHERE id='${old.id}'`,
  }) });
  assert.equal(sql.status, 200, await sql.clone().text());
  assert.deepEqual((await ok(templates + "/" + old.id)).objects, [legacyObject]);
  const listed = (await ok(templates)).templates;
  assert.deepEqual(listed.find((entry: any) => entry.id === old.id).objects, [legacyObject]);
  assert.deepEqual(listed.find((entry: any) => entry.id === saved.id).objects, [object]);
});

function stored17(b: ReturnType<typeof declared17>) {
  const doc = new Y.Doc(), root = doc.getMap("board"), t = b.objects[0];
  root.set("schemaVersion", 17); root.set("boardId", b.boardId); root.set("title", b.title);
  const pageMap = new Y.Map(), page = new Y.Map([["name", "Page 1"], ["order", "V"]]);
  root.set("pageMap", pageMap); pageMap.set(b.boardId, page);
  const object = new Y.Map<unknown>(["generation", "type", "page", "order", "group", "section"].map(key =>
    [key, t[key as keyof typeof t]]));
  doc.getMap("objects").set(t.id, object);
  object.set("place", { x: t.x, y: t.y }); object.set("tableStyle", { textSize: t.textSize });
  object.set("rowMap", new Y.Map(t.rows.map((row, i) => [row.id, new Y.Map<unknown>([["order", i ? "j" : "V"], ["height", row.height]])])));
  object.set("columnMap", new Y.Map(t.columns.map((column, i) => [column.id, new Y.Map<unknown>([["order", i ? "j" : "V"], ["width", column.width]])])));
  object.set("cells", new Y.Map(t.rows.flatMap(r => t.columns.map(c => [r.id + ":" + c.id,
    new Y.Text(t.cells.find(at => at.row === r.id && at.column === c.id)?.text ?? "")]))));
  return doc;
}

async function waitTable<T>(read: () => T | Promise<T>, accepts: (value: T) => boolean) {
  const end = Date.now() + 5000;
  do {
    const value = await read();
    if (accepts(value)) return value;
    await new Promise(resolve => setTimeout(resolve, 5));
  } while (Date.now() < end);
  assert.fail("Table operation did not settle in five seconds");
}

check(481, "real sessions keep concurrent moves and inserts, refuse invalid spans, and restore schema 17 history", async s => {
  const { BoardSession } = s.sync, sessions: InstanceType<typeof BoardSession>[] = [];
  async function joinSession(board: string, who: string, clientId: number) {
    const out: string[] = [];
    let peer: Peer;
    const session = await BoardSession.join({ clientId,
      clock: { now: Date.now, after(ms, action) { const timer = setTimeout(action, ms); return () => clearTimeout(timer); } },
      ticket: () => ok(`/boards/${board}/join-tickets`, who, "POST", undefined, 201),
      open: async issued => {
        peer = await driver.connect(`/boards/${board}/join?ticket=${issued.ticket}`); peers.add(peer);
        const current = peer;
        return { send: data => out.push(data), close: () => { void current.close(); }, listen: handlers => current.listen(handlers) };
      } });
    sessions.push(session);
    return { session, deliver() {
      assert.equal(out.length, 1);
      peer.send(out.shift()!);
    } };
  }
  try {
    for (const scenario of ["two moves", "move and insert", "merge and insert", "merge and move text"]) {
      const b = seed(s, 4, 6), t = tableAt(b), anchor = span(t, 1, 0, 2, 1);
      const board = await create(scenario === "merge and move text"
        ? setTable(b, text(s, t, cell(t, 4, 0), "Do not cover")) : b);
      const a = await joinSession(board, "owner", 41), z = await joinSession(board, "editor", 42);
      const ownerBoard = a.session.board, editorBoard = z.session.board;
      const row = rowId(), movedA = [t.rows[0].id], movedZ = [t.rows[4].id];
      const first = scenario.startsWith("merge") ? s.table.mergeRange(tableAt(ownerBoard), anchor)
        : s.table.moveAxis(tableAt(ownerBoard), "row", movedA, 3);
      const second = scenario.endsWith("insert") ? s.table.insertAxis(tableAt(editorBoard), "row", row, scenario.startsWith("merge") ? 2 : 5)
        : s.table.moveAxis(tableAt(editorBoard), "row", movedZ, scenario === "two moves" ? 6 : 2);
      const hint = (moved: string[]): TableOrderHint => ({ table: t.id, axis: "row", moved });
      const idA = a.session.edit(setTable(ownerBoard, first), undefined, undefined, undefined, scenario.startsWith("merge") ? undefined : hint(movedA));
      const idZ = z.session.edit(setTable(editorBoard, second), undefined, undefined, undefined, hint(scenario.endsWith("insert") ? [row] : movedZ));
      a.deliver();
      await waitTable(() => a.session.requests.get(idA)?.state, state => state === "saved");
      z.deliver();
      const refused = scenario === "merge and move text";
      const result = await waitTable(() => z.session.requests.get(idZ), request => request?.state === "saved" || request?.state === "refused");
      assert.equal(result?.state, refused ? "refused" : "saved");
      if (refused) assert.equal(result?.reason, "invalid_document");
      const stored = await exported(board), key = s.rules.canonical(stored), rows = tableAt(stored).rows.map(r => r.id);
      await waitTable(() => [a.session.board, z.session.board], boards => boards.every(b => s.rules.canonical(b) === key));
      assert(s.rules.validate(stored));
      const original = t.rows.map(r => r.id);
      if (scenario === "two moves") assert.deepEqual(rows, [original[1], original[2], original[0], original[3], original[5], original[4]]);
      if (scenario === "move and insert") assert.deepEqual(rows, [original[1], original[2], original[0], original[3], original[4], row, original[5]]);
      if (scenario === "merge and insert") assert.deepEqual(rows, [original[0], original[1], row, ...original.slice(2)]);
      if (refused) assert.deepEqual(rows, original);
      if (scenario.startsWith("merge")) assert.deepEqual(tableAt(stored).merges, [{ ...anchor.from, rows: 2, columns: 2 }]);
      assert.equal((await driver.rows(board, "edits")).length, refused ? 1 : 2);
      a.session.close(); z.session.close();
    }
  } finally { for (const session of sessions) session.close(); }

  const board = await create(), legacy = declared17(board), doc = stored17(legacy);
  docs.add(doc);
  const path = `/boards/${board}/versions`, old = (await ok(path)).versions[0];
  const json = Buffer.from(s.rules.canonical(legacy)), encoded = Buffer.from(Y.encodeStateAsUpdate(doc));
  const digest = Buffer.from(await crypto.subtle.digest("SHA-256", json)).toString("hex");
  const object = legacy.objects[0];
  await driver.control({ board, roomSQL: [
    { sql: "DELETE FROM snapshot_chunks" },
    { sql: `INSERT INTO snapshot_chunks VALUES (0,'json',0,x'${json.toString("hex")}')` },
    { sql: `INSERT INTO snapshot_chunks VALUES (0,'yjs',0,x'${encoded.toString("hex")}')` },
    { sql: "DELETE FROM version_chunks WHERE version_id=?", bindings: [old.id] },
    { sql: `INSERT INTO version_chunks VALUES (?,0,x'${json.toString("hex")}')`, bindings: [old.id] },
    { sql: "UPDATE meta SET value=? WHERE key='history_capture_sha256'", bindings: [digest] },
    { sql: "UPDATE meta SET value=? WHERE key='history_capture_bytes'", bindings: [json.length] },
    { sql: "INSERT INTO identifiers VALUES (?,?,0)", bindings: [object.id, object.generation] },
  ] });
  await driver.wake(board);
  const upgraded = await exported(board);
  assert.deepEqual(upgraded, s.rules.upgrade(legacy));
  const client = await join(s, board, "owner");
  assert.equal((map(client.doc, tableAt(upgraded)).get("mergeMap") as Y.Map<unknown>).size, 0);
  assert.equal(Y.decodeUpdate(Y.encodeStateAsUpdate(client.doc, Y.encodeStateVector(doc))).structs.length, 2);
  assert.equal((await driver.rows(board, "edits")).length, 0);
  await client.peer.close(); peers.delete(client.peer);
  assert.equal((await ok(path)).versions.length, 1);
  assert.deepEqual((await ok(path + "/" + old.id)).document, legacy);

  const editor = await join(s, board, "owner");
  await change(s, editor, table => s.table.mergeRange(table, span(table, 0, 0, 1, 1)));
  await editor.peer.close(); peers.delete(editor.peer);
  const versions = await waitTable(() => ok(path), value => value.versions.length === 2);
  const current = (await ok(path + "/" + versions.versions[0].id)).document;
  assert.equal(current.schemaVersion, 18);
  assert.equal(current.objects[0].merges.length, 1);
  await ok(path + "/" + old.id + "/restore", "owner", "POST",
    { requestId: rowId(), expectedRevision: versions.head.revision, expectedGeneration: versions.head.generation });
  assert.deepEqual(await exported(board), upgraded);
  assert.equal((await ok(path + "/" + old.id)).document.schemaVersion, 17);
});
