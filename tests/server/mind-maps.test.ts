// SPDX-License-Identifier: Apache-2.0
// 0009-W2 server checks S402–S406 on both runners. Subjects load dynamically
// inside each check, so a missing feature fails its check by name.
import { test, beforeAll, afterAll, afterEach, inject } from "vitest";
import assert from "node:assert/strict";
import { storedBoardUpdate, withoutPages } from "../import-fixture.mjs";
import * as Y from "yjs";
import { makeDriver } from "board-test-driver";
import type { Context, Driver, Peer } from "./driver-types.ts";
const context = inject<Context>("board"), runner = inject<string>("runner");
let driver: Driver, f: any, pass = 0, fail = 0;
const peers: Peer[] = [], docs: Y.Doc[] = [];
beforeAll(async () => { driver = await makeDriver(context); });
afterEach(async () => { for (const p of peers.splice(0)) await p.close(); for (const doc of docs.splice(0)) doc.destroy(); });
afterAll(async () => { await driver.close(); console.log("SUMMARY-MIND-MAPS " + JSON.stringify({ runner, checks: pass + fail, pass, fail })); });
const modules = async () => ({
  rules: await import("../../packages/board-rules/src/document.ts"),
  map: await import("../../apps/web/src/mind-map.ts"),
  adapter: await import("../../packages/board-sync/src/document-adapter.ts"),
  codec: await import("../../packages/board-sync/src/codec.ts"),
  session: await import("../../packages/board-sync/src/session.ts"),
});
async function helper(action: string, value: unknown = {}): Promise<any> {
  const r = await fetch(context.helperUrl + "/" + action, { method: "POST", body: JSON.stringify(value) });
  assert.equal(r.status, 200, await r.clone().text()); return r.json();
}
async function req(path: string, name = "owner", method = "GET", body?: unknown) {
  return driver.request(path, { method, headers: { Authorization: "Bearer " + f.people[name].token, Origin: context.origin, "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
}
async function ok(path: string, name = "owner", method = "GET", body?: unknown, status = 200): Promise<any> {
  const r = await req(path, name, method, body); assert.equal(r.status, status, await r.clone().text()); return status === 204 ? null : r.json();
}
const exported = async (board = f.a) => JSON.parse(await (await req(`/boards/${board}/export`)).text());
const rows = (table: string, board = f.a) => driver.rows(board, table);
const versions = (board = f.a) => ok(`/boards/${board}/versions`);
const sql = (items: { sql: string; bindings?: unknown[] }[], board = f.a) => driver.control({ board, roomSQL: items });
const hex = (bytes: Uint8Array) => "x'" + Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("") + "'";
async function sha256(bytes: Uint8Array) { return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)), (b) => b.toString(16).padStart(2, "0")).join(""); }
async function until<T>(read: () => T | Promise<T>, predicate = (v: T) => !!v): Promise<T> {
  const end = Date.now() + 10000; let result: T;
  do { result = await read(); if (predicate(result)) return result; await new Promise((r) => setTimeout(r, 10)); } while (Date.now() < end);
  assert.fail("Condition timed out " + JSON.stringify(result));
}
async function join(name = "editor", board = f.a) {
  const { session } = await modules();
  const ticket = await ok(`/boards/${board}/join-tickets`, name, "POST", undefined, 201), p = await driver.connect(`/boards/${board}/join?ticket=${ticket.ticket}`);
  peers.push(p); const joined = await p.next("joined"), doc = new Y.Doc(); docs.push(doc); Y.applyUpdate(doc, session.decode(joined.update));
  await until(() => p.messages.some((m) => m.kind === "comments_snapshot" && m.done));
  return { p, joined, doc };
}
type Client = Awaited<ReturnType<typeof join>>;
// Writes a whole-board change through an adapter bound to the client's document.
async function send(c: Client, change: (board: any) => any, raw?: (doc: Y.Doc) => void) {
  const { adapter, codec, session } = await modules();
  const vector = Y.encodeStateVector(c.doc);
  if (raw) raw(c.doc);
  else { const a = new adapter.Adapter(); a.doc.destroy(); a.doc = c.doc; a.set(change(codec.readBoard(c.doc))); }
  const id = crypto.randomUUID();
  c.p.send({ kind: "edit", epoch: c.joined.epoch, requestId: id, update: session.encode(Y.encodeStateAsUpdate(c.doc, vector)), restoreGeneration: c.joined.restoreGeneration });
  return id;
}
async function answer(c: Client, id: string) {
  const { session } = await modules();
  const result = await until(() => c.p.messages.find((m) => m.requestId === id && ["saved", "refused"].includes(m.kind)));
  if (result!.kind === "saved" && result!.update) Y.applyUpdate(c.doc, session.decode(result!.update));
  return result!;
}
async function measure() { const { map } = await modules(); return (text: string, root: boolean) => map.nodeBox(text, root, (v, bold, size) => Array.from(v).length * size * (bold ? 0.6 : 0.5)); }
async function starterEdit(c: Client) {
  const { map, codec } = await modules(), m = await measure();
  let id = "";
  const sent = await send(c, (board) => { const result = map.starterMap(board, { x: 200, y: 200 }, m); id = result.id; return result.board; });
  const result = await answer(c, sent); assert.equal(result.kind, "saved", JSON.stringify(result));
  return { root: id, board: codec.readBoard(c.doc) };
}
const check = (id: number, name: string, run: () => Promise<void>) => test(`S${id} ${name}`, async () => {
  try { f = await helper("removal-fixture"); await run(); pass++; console.log(`PASS: S${id} ${name}`); }
  catch (error) { fail++; console.log(`FAIL: S${id} ${name}`); throw error; }
});

// Seeds the room's stored state with a version 10 board (one sticky), as the
// history and lifecycle checks seed stored rows, then reloads the room.
async function seedVersion10() {
  const { rules } = await modules();
  const current = await exported(), revision = (await rows("meta")).find((r) => r.key === "revision").value;
  const board = { ...withoutPages(rules.add({ ...rules.empty(), boardId: f.a, title: current.title }, "sticky", 0, 0)), schemaVersion: 10 as const };
  const json = new TextEncoder().encode(rules.canonical(board)), yjs = storedBoardUpdate(board);
  const object = board.objects[0];
  await sql([{ sql: "DELETE FROM snapshot_chunks" }, { sql: "DELETE FROM edits" },
    { sql: `INSERT INTO snapshot_chunks VALUES (?, 'json', 0, ${hex(json)})`, bindings: [revision] },
    { sql: `INSERT INTO snapshot_chunks VALUES (?, 'yjs', 0, ${hex(yjs)})`, bindings: [revision] },
    { sql: "INSERT OR IGNORE INTO identifiers VALUES (?, ?, 0)", bindings: [object.id, object.generation] },
    { sql: "UPDATE meta SET value = ? WHERE key = 'history_capture_sha256'", bindings: [await sha256(json)] },
    { sql: "UPDATE meta SET value = ? WHERE key = 'history_capture_bytes'", bindings: [json.length] }]);
  await driver.wake(f.a);
  return { board, json };
}

check(402, "a stored version 10 board is served as version 11 without an edit or history version", async () => {
  await versions();
  const revision = (await rows("meta")).find((r) => r.key === "revision").value;
  const { board } = await seedVersion10(), before = (await versions()).versions.length;
  const served = await exported();
  assert.equal(served.schemaVersion, 17); assert.deepEqual(served.objects, (await modules()).rules.upgrade(board).objects);
  const viewer = await join("viewer");
  assert.equal((await modules()).codec.readBoard(viewer.doc).schemaVersion, 17);
  await viewer.p.close();
  await new Promise((r) => setTimeout(r, 200)); await driver.control({ board: f.a, settled: true });
  assert.deepEqual(await rows("edits"), []);
  assert.equal((await rows("meta")).find((r) => r.key === "revision").value, revision);
  assert.equal((await versions()).versions.length, before, "closing the last connection captures no version for the upgrade");
  await driver.wake(f.a);
  assert.equal((await exported()).schemaVersion, 17, "a reload with no edit serves version 17 again");
  assert.equal((await versions()).versions.length, before, "the upgrade alone captures no version");
  const c = await join();
  const { board: mapped } = await starterEdit(c);
  assert.equal(mapped.objects.filter((o: any) => o.type === "mindNode").length, 4);
  assert.equal((await rows("edits")).length, 1);
  await driver.wake(f.a);
  const reloaded = await exported();
  assert.equal(reloaded.schemaVersion, 17); assert.equal(reloaded.objects.filter((o: any) => o.type === "mindNode").length, 4);
});

check(403, "merged edits are repaired in document v16's order and still-invalid edits are refused", async () => {
  const c = await join(), { root, board } = await starterEdit(c);
  const [a, b] = board.objects.filter((o: any) => o.parent === root).map((o: any) => o.id);
  const set = (id: string, values: Record<string, unknown>) => (doc: Y.Doc) => { const m = doc.getMap<Y.Map<unknown>>("objects").get(id)!; for (const [k, v] of Object.entries(values)) m.set(k, v); };
  const positions = async () => Object.fromEntries((await exported()).objects.map((o: any) => [o.id, [o.x, o.y]]));
  const moved = await positions();
  // A loop: the node with the smallest id becomes a root; no node moves.
  let result = await answer(c, await send(c, () => null, (doc) => { set(a, { parent: b, side: null })(doc); set(b, { parent: a, side: null })(doc); }));
  assert.equal(result.kind, "saved", JSON.stringify(result));
  let stored = await exported(), small = [a, b].sort()[0], large = [a, b].sort()[1];
  const node = (id: string) => stored.objects.find((o: any) => o.id === id);
  assert.deepEqual([node(small).parent, node(small).side, node(small).collapsed], [null, null, false]);
  assert.deepEqual([node(large).parent, node(large).side], [small, "right"]);
  assert.deepEqual(await positions(), moved);
  // A missing parent becomes a root; a first-level node without a side gets right; a root never stays collapsed.
  const third = board.objects.find((o: any) => o.parent === root && o.id !== a && o.id !== b).id;
  result = await answer(c, await send(c, () => null, set(third, { parent: crypto.randomUUID() })));
  assert.equal(result.kind, "saved"); stored = await exported();
  assert.deepEqual([node(third).parent, node(third).side], [null, null]);
  result = await answer(c, await send(c, () => null, set(large, { side: null })));
  assert.equal(result.kind, "saved"); stored = await exported(); assert.equal(node(large).side, "right");
  result = await answer(c, await send(c, () => null, set(root, { collapsed: true })));
  assert.equal(result.kind, "saved"); stored = await exported(); assert.equal(node(root).collapsed, false);
  // Still invalid after the repair: refused, nothing changes.
  const before = await exported(), revision = (await rows("meta")).find((r) => r.key === "revision").value;
  result = await answer(c, await send(c, () => null, (doc) => { const text = doc.getMap<Y.Map<unknown>>("objects").get(root)!.get("text") as Y.Text; text.insert(0, "x".repeat(201)); }));
  assert.equal(result.kind, "refused"); assert.equal(result.reason, "invalid_document");
  assert.deepEqual(await exported(), before); assert.equal((await rows("meta")).find((r) => r.key === "revision").value, revision);
});

check(404, "two clients reparent A under B and B under A at once and converge on a valid map", async () => {
  const { codec, rules } = await modules();
  const one = await join(), { root, board } = await starterEdit(one), two = await join("owner");
  await until(() => codec.readBoard(two.doc).objects.length === 4);
  const [a, b] = board.objects.filter((o: any) => o.parent === root).map((o: any) => o.id);
  const under = (child: string, parent: string) => (doc: Y.Doc) => { const m = doc.getMap<Y.Map<unknown>>("objects").get(child)!; m.set("parent", parent); m.set("side", null); };
  const first = await send(one, () => null, under(a, b)), second = await send(two, () => null, under(b, a));
  assert.equal((await answer(one, first)).kind, "saved"); assert.equal((await answer(two, second)).kind, "saved");
  const stored = await exported();
  rules.validate(stored);
  const small = [a, b].sort()[0];
  assert.equal(stored.objects.find((o: any) => o.id === small).parent, null);
  const { session } = await modules();
  for (const c of [one, two]) for (const m of c.p.messages) if (m.kind === "update") Y.applyUpdate(c.doc, session.decode(m.update));
  for (const c of [one, two]) assert.equal(rules.canonical(codec.readBoard(c.doc)), rules.canonical(stored));
});

check(405, "a stored version 10 history snapshot restores as version 11; a version 11 snapshot keeps its map", async () => {
  const { rules } = await modules();
  const list = await versions(), head = list.head, current = await exported();
  const old = { ...withoutPages(rules.add({ ...rules.empty(), boardId: f.a, title: current.title }, "sticky", 0, 0)), schemaVersion: 10 as const };
  const bytes = new TextEncoder().encode(rules.canonical(old)), id = crypto.randomUUID(), object = old.objects[0];
  const ordinal = Math.max(...list.versions.map((v: any) => v.ordinal)) + 1;
  await sql([{ sql: "INSERT OR IGNORE INTO identifiers VALUES (?, ?, 0)", bindings: [object.id, object.generation] },
    { sql: "INSERT INTO versions VALUES (?, ?, ?, ?, ?, 'manual', 'Old', '', NULL, NULL, '')", bindings: [id, ordinal, Date.now(), head.revision, head.generation] },
    { sql: `INSERT INTO version_chunks VALUES (?, 0, ${hex(bytes)})`, bindings: [id] },
    // Leave the room's history metadata as a real capture would: the next capture's
    // ordinal is meta + 1, and ordinals are unique.
    { sql: "UPDATE meta SET value = ? WHERE key = 'history_ordinal'", bindings: [ordinal] },
    { sql: "UPDATE meta SET value = ? WHERE key = 'history_revision'", bindings: [head.revision] },
    { sql: "UPDATE meta SET value = ? WHERE key = 'history_capture_sha256'", bindings: [await sha256(bytes)] },
    { sql: "UPDATE meta SET value = ? WHERE key = 'history_capture_bytes'", bindings: [bytes.length] }]);
  let restored = await ok(`/boards/${f.a}/versions/${id}/restore`, "owner", "POST", { requestId: crypto.randomUUID(), expectedRevision: head.revision, expectedGeneration: head.generation });
  let stored = await exported();
  assert.equal(stored.schemaVersion, 17); assert.deepEqual(stored.objects.map((o: any) => [o.id, o.type, o.text]), [[object.id, "sticky", ""]]);
  assert.equal(restored.revision, head.revision + 1);
  const c = await join(), { root, board } = await starterEdit(c);
  const saved = await ok(`/boards/${f.a}/versions`, "owner", "POST", { requestId: crypto.randomUUID(), name: "Map", description: "" });
  const removed = await answer(c, await send(c, (b) => ({ ...b, objects: b.objects.filter((o: any) => o.type !== "mindNode").map((o: any, order: number) => ({ ...o, order })),
    retiredGenerations: [...b.retiredGenerations, ...b.objects.filter((o: any) => o.type === "mindNode").map((o: any) => o.generation)].sort() })));
  assert.equal(removed.kind, "saved");
  const now = (await versions()).head;
  restored = await ok(`/boards/${f.a}/versions/${saved.version.id}/restore`, "owner", "POST", { requestId: crypto.randomUUID(), expectedRevision: now.revision, expectedGeneration: now.generation });
  stored = await exported();
  const nodes = stored.objects.filter((o: any) => o.type === "mindNode");
  assert.equal(nodes.length, 4);
  for (const o of board.objects.filter((n: any) => n.type === "mindNode")) {
    const back = nodes.find((n: any) => n.id === o.id);
    assert.deepEqual([back.parent, back.side, back.rank, back.x, back.y], [o.parent, o.side, o.rank, o.x, o.y]);
  }
  assert.equal(nodes.filter((o: any) => o.parent === root).length, 3);
});

check(406, "the import route accepts a version 11 board with a map and refuses one holding a loop", async () => {
  const { rules, map } = await modules(), m = await measure();
  const { board, id } = map.starterMap({ ...rules.empty(), title: "Mapped" }, { x: 0, y: 0 }, m);
  const created = await ok(`/workspaces/${f.workspace}/boards`, "owner", "POST", { title: "Mapped", document: board }, 201);
  const stored = await exported(created.id);
  assert.equal(stored.schemaVersion, 17);
  assert.deepEqual(stored.objects.map((o: any) => [o.text, o.parent === null ? null : o.parent === id]), [["Main topic", null], ["First idea", true], ["Second idea", true], ["Third idea", true]]);
  const [a, b] = board.objects.slice(1);
  const loop = { ...board, objects: board.objects.map((o: any) => o.id === a.id ? { ...o, parent: b.id, side: null } : o.id === b.id ? { ...o, parent: a.id, side: null } : o) };
  const refused = await req(`/workspaces/${f.workspace}/boards`, "owner", "POST", { title: "Loop", document: loop });
  assert.equal(refused.status, 400); assert.deepEqual(await refused.json(), { error: { reason: "invalid_document" } });
});
