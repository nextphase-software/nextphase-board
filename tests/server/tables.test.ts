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
  assert.equal((await exported(await create())).schemaVersion, 16);
  const b = seed(s, 3, 4), t = tableAt(b);
  const served = await exported(await create(b));
  assert.equal(served.schemaVersion, 16);
  assert.deepEqual(tableAt(served), t);
  const { boardId, pages, title, retiredGenerations } = b;
  const legacy = { schemaVersion: 13, boardId, title, pages, objects: [], retiredGenerations };
  assert.equal((await exported(await create(legacy))).schemaVersion, 16);
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
    assert.equal(live.schemaVersion, 16); assert.deepEqual(live, s.rules.upgrade(legacy));
    const c = await join(s, id, "owner");
    assert(!c.doc.getMap("board").has("pages")); assert(c.doc.getMap("board").get("pageMap") instanceof Y.Map);
    if (storage === 8 && schemaVersion === 13) {
      const old = new Y.Doc(); docs.add(old); Y.applyUpdate(old, update);
      const delta = Y.decodeUpdate(Y.encodeStateAsUpdate(c.doc, Y.encodeStateVector(old))).structs;
      assert.equal(delta.length, 1); assert.equal(delta[0].content.getContent()[0], 15);
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
  await restore(oldBoard, oldVersion.id); assert.equal((await exported(oldBoard)).schemaVersion, 16);
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
