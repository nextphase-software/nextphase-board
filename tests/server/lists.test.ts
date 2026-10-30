// SPDX-License-Identifier: Apache-2.0
import { test, beforeAll, afterAll, afterEach, inject } from "vitest";
import assert from "node:assert/strict";
import * as Y from "yjs";
import { makeDriver } from "board-test-driver";
import type { Context, Driver, Peer } from "./driver-types.ts";
import { Adapter } from "../../packages/board-sync/src/document-adapter.ts";
import { readBoard } from "../../packages/board-sync/src/codec.ts";
import { add, canonical, empty } from "../../packages/board-rules/src/document.ts";
const context = inject<Context & { docker: boolean }>("board");
const runner = context.docker ? "docker" : inject<string>("runner");
const names = ["owner", "editor", "viewer", "granted", "plain", "outsider"];
const peers: Peer[] = [], measures: Record<string, unknown> = {};
let driver: Driver, pass = 0, fail = 0;
const person = (name: string) => context.listsPeople[name];
beforeAll(async () => { if (runner !== "docker") driver = await makeDriver(context); });
afterEach(async () => {
  if (!driver) return;
  for (const peer of peers.splice(0)) await peer.close();
  await helper("proxy", { offline: false, rpc: "copy_saved_board" });
  await helper("proxy", { rpc: "record_board_open" });
  await driver.control({ offset: 0, fixedNow: null });
});
afterAll(async () => {
  if (!driver) return;
  await driver.close();
  console.log("SUMMARY-LISTS " + JSON.stringify({ runner, checks: pass + fail, pass, fail, measures }));
});
function check(id: number, name: string, operation: () => Promise<void>) {
  test.skipIf(runner === "docker" || runner === "workerd" && id === 70)(`S${id} ${name}`, async () => {
    try { await operation(); pass++; console.log(`PASS: S${id} ${name}`); }
    catch (error) { fail++; console.log(`FAIL: S${id} ${name}`); throw error; }
  });
}
async function helper(action: string, value: unknown = {}) {
  const response = await fetch(context.helperUrl + "/" + action, { method: "POST", body: JSON.stringify(value) });
  const result = await response.json() as any;
  assert.equal(response.status, 200, JSON.stringify(result));
  return result;
}
const fixture = () => helper("lists-fixture");
const rpc = (name: string, parameters: unknown) => helper("rpc", { name, parameters });
const sql = (text: string) => helper("sql", { sql: text });
async function request(path: string, name = "owner", method = "GET", value?: unknown, token = person(name).token) {
  return driver.request(path, { method, headers: { Authorization: "Bearer " + token,
    Origin: context.origin, "Content-Type": "application/json" },
    ...(value === undefined ? {} : { body: JSON.stringify(value) }) });
}
async function success(path: string, name = "owner", method = "GET", value?: unknown, status = 200): Promise<any> {
  const response = await request(path, name, method, value);
  assert.equal(response.status, status, path + " " + await response.clone().text());
  return response.json();
}
async function refused(response: Response, status: number, reason: string, needed?: string) {
  assert.equal(response.status, status, await response.clone().text());
  assert.deepEqual(await response.json(), { error: { reason, ...(needed ? { needed } : {}) } });
}
async function until(read: () => Promise<any>, accepts: (value: any) => boolean) {
  const deadline = Date.now() + 5000;
  let value;
  do {
    value = await read();
    if (accepts(value)) return value;
    await new Promise((resolve) => setTimeout(resolve, 20));
  } while (Date.now() < deadline);
  assert.fail("Condition not reached within five seconds: " + JSON.stringify(value));
}
const row = async (board: string) => (await helper("rows", { table: "boards", filters: { id: board } }))[0];
const boardList = (workspace: string, name = "owner", query = "") => success(`/workspaces/${workspace}/boards${query}`, name);
const recents = (name = "owner") => success("/recent-boards", name);
const ticket = (board: string, name = "owner") => success(`/boards/${board}/join-tickets`, name, "POST", undefined, 201);
const rename = (board: string, title: string, name = "owner") => success(`/boards/${board}`, name, "PATCH", { title });
const clearOpens = (name: string) => sql(`DELETE FROM nextphase_board.board_opens WHERE person_id='${person(name).id}'`);
async function create(workspace: string, title = "Synthetic") {
  return success(`/workspaces/${workspace}/boards`, "owner", "POST", { title }, 201);
}
async function join(board: string, name = "editor") {
  const issued = await ticket(board, name);
  const peer = await driver.connect(`/boards/${board}/join?ticket=${issued.ticket}`); peers.push(peer);
  const joined = await peer.next("joined"), doc = new Y.Doc();
  Y.applyUpdate(doc, Uint8Array.from(atob(joined.update), (c) => c.charCodeAt(0)));
  return { peer, doc, epoch: joined.epoch as number, revision: joined.revision as number };
}
function encoded(bytes: Uint8Array) {
  let text = "";
  for (let at = 0; at < bytes.length; at += 8192) text += String.fromCharCode(...bytes.subarray(at, at + 8192));
  return btoa(text);
}
function titleUpdate(doc: Y.Doc, title: string) {
  const vector = Y.encodeStateVector(doc);
  doc.getMap("board").set("title", title);
  return encoded(Y.encodeStateAsUpdate(doc, vector));
}
async function edit(client: Awaited<ReturnType<typeof join>>, title: string) {
  const requestId = crypto.randomUUID();
  client.peer.send({ kind: "edit", epoch: client.epoch, requestId, update: titleUpdate(client.doc, title) });
  return client.peer.next("saved");
}
async function operator(board: string, action: string, value?: unknown) {
  const response = await driver.request(`/operator/boards/${board}/${action}`, { method: "POST",
    headers: { "Board-Operator-Key": context.operatorKey, "Content-Type": "application/json" },
    ...(value === undefined ? {} : { body: JSON.stringify(value) }) });
  assert.equal(response.status, 200, await response.clone().text());
  return response.json() as Promise<any>;
}
async function copiedTitle(board: string, title: string) {
  return until(() => row(board), (value) => value.title === title);
}
async function copyIdle(board: string) {
  await until(() => driver.rows(board, "meta"), (rows) => rows.some((r: any) => r.key === "copied"));
}
function assertFields(value: any, recent = false) {
  assert.deepEqual(Object.keys(value).sort(), ["id", "workspaceId", "title", "role", "createdAt", "editedAt", "openedAt",
    ...(recent ? ["workspaceName"] : [])].sort());
}
check(55, "workspace discovery follows workspace roles and granted boards", async () => {
  const f = await fixture();
  const second = await rpc("bootstrap_workspace", { name: "A workspace " + crypto.randomUUID(),
    owner_id: person("outsider").id, owner_email: person("outsider").email });
  for (const name of names) {
    await clearOpens(name);
    const { workspaces } = await success("/workspaces", name);
    const expected = name === "outsider" ? second : ["plain"].includes(name) ? undefined : f.workspace;
    assert.deepEqual(workspaces.map((w: any) => w.id), expected ? [expected] : []);
    if (expected) assert.equal(workspaces[0].role, name === "granted" ? "guest" : name === "outsider" ? "owner" : name);
  }
  await rpc("bootstrap_workspace", { name: "A first " + crypto.randomUUID(), owner_id: person("owner").id, owner_email: person("owner").email });
  const { workspaces } = await success("/workspaces");
  const compare = (a: any, b: any) => a.name < b.name ? -1 : a.name > b.name ? 1 : a.id.localeCompare(b.id);
  assert.deepEqual(workspaces, [...workspaces].sort(compare));
});
check(56, "board lists apply roles hide missing access and expose exact fields", async () => {
  const f = await fixture();
  for (const name of names) {
    if (["plain", "outsider"].includes(name)) {
      await refused(await request(`/workspaces/${f.workspace}/boards`, name), 404, "not_found"); continue;
    }
    const { boards } = await boardList(f.workspace, name);
    assert.deepEqual(boards.map((b: any) => b.id).sort(), (name === "granted" ? [f.a] : [f.a, f.b]).sort());
    for (const board of boards) { assertFields(board); assert.equal(board.role, name === "granted" ? "editor" : name); assert.equal(board.openedAt, null); }
  }
  await refused(await request(`/workspaces/${crypto.randomUUID()}/boards`), 404, "not_found");
});
check(57, "recent boards include only opened accessible boards newest first", async () => {
  const f = await fixture();
  for (const name of names) {
    await clearOpens(name);
    const ids = ["plain", "outsider"].includes(name) ? [] : name === "granted" ? [f.a] : [f.a, f.b];
    let clock = Date.now();
    for (const board of ids) { await driver.control({ fixedNow: clock += 10 }); await ticket(board, name); }
    const result = await until(() => recents(name), (value) => value.boards.length === ids.length);
    assert.deepEqual(result.boards.map((b: any) => b.id), [...ids].reverse());
    for (const board of result.boards) { assertFields(board, true); assert.equal(board.workspaceName, (await success("/workspaces", name)).workspaces.find((w: any) => w.id === f.workspace).name); }
  }
});
check(58, "creation supports Untitled validates bodies and preserves role refusals", async () => {
  const f = await fixture(), path = `/workspaces/${f.workspace}/boards`;
  for (const name of ["owner", "editor"]) {
    assert.equal((await success(path, name, "POST", {}, 201)).title, "Untitled");
    assert.equal((await success(path, name, "POST", { title: "Named" }, 201)).title, "Named");
  }
  for (const value of [{ title: null }, { extra: true }, [], undefined]) await refused(await request(path, "owner", "POST", value), 400, "bad_request");
  for (const name of ["viewer", "granted"]) await refused(await request(path, name, "POST", {}), 403, "role_too_low", "editor");
  for (const name of ["plain", "outsider"]) await refused(await request(path, name, "POST", {}), 404, "not_found");
});
async function fullBoard(boardId: string) {
  let board = { ...empty(), boardId, title: "Large" };
  for (let i = 0; i < 250; i++) board = add(board, "text", 0, 0);
  for (const object of board.objects) object.text = "x".repeat(1000);
  function marks(count: number) {
    board.objects.forEach((object, index) => {
      object.marks = Array.from({ length: Math.min(1000, Math.max(0, count - index * 1000)) }, (_, i) =>
        ({ start: i, end: i + 1, ...(i % 2 ? { italic: true } : { bold: true }) }));
    });
  }
  let low = 0, high = 250000;
  const size = () => new TextEncoder().encode(JSON.stringify(board)).length;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2); marks(middle);
    if (size() <= 2097152) low = middle; else high = middle - 1;
  }
  marks(low);
  const padding = 2097152 - size();
  board.objects[249].text = "é".repeat(padding) + "x".repeat(1000 - padding);
  assert.equal(new TextEncoder().encode(canonical(board)).length, 2097152);
  return board;
}
check(59, "rename role matrix title rules and document size limit", async () => {
  const f = await fixture();
  for (const board of [f.a, f.b]) for (const name of names) {
    const response = await request(`/boards/${board}`, name, "PATCH", { title: `${name} renamed` });
    if (["owner", "editor"].includes(name) || name === "granted" && board === f.a) assert.equal(response.status, 200);
    else await refused(response, name === "viewer" ? 403 : 404, name === "viewer" ? "role_too_low" : "not_found", name === "viewer" ? "editor" : undefined);
  }
  for (const title of ["x".repeat(121), "   ", null, "a\u0000b", "\ud800"]) {
    await refused(await request(`/boards/${f.a}`, "owner", "PATCH", { title }), 400, "bad_request");
  }
  await refused(await request(`/boards/${f.a}`, "owner", "PATCH", { title: "valid", extra: 1 }), 400, "bad_request");
  await refused(await request(`/workspaces/${f.workspace}/boards`, "owner", "POST", { title: "a\u0000b" }), 400, "bad_request");
  const large = await create(f.workspace, "Large"), client = await join(large.id), observer = await join(large.id, "owner");
  const board = await fullBoard(large.id), adapter = new Adapter(); adapter.doc = client.doc;
  let revision = 0;
  for (let count = 5; count <= 250; count += 5) {
    const vector = Y.encodeStateVector(client.doc);
    adapter.set({ ...board, objects: board.objects.slice(0, count) });
    client.peer.send({ kind: "edit", epoch: client.epoch, requestId: crypto.randomUUID(), update: encoded(Y.encodeStateAsUpdate(client.doc, vector)) });
    revision = (await client.peer.next("saved")).revision;
    await observer.peer.next("update");
  }
  const broadcasts = observer.peer.messages.filter((m) => m.kind === "update").length;
  const receipts = (await driver.rows(large.id, "receipts")).length;
  await refused(await request(`/boards/${large.id}`, "owner", "PATCH", { title: "x".repeat(120) }), 413, "document_too_large");
  assert.equal((await driver.rows(large.id, "receipts")).length, receipts);
  assert.equal((await driver.rows(large.id, "meta")).find((r) => r.key === "revision").value, revision);
  assert.equal(observer.peer.messages.filter((m) => m.kind === "update").length, broadcasts);
});
check(60, "new routes authenticate every invalid token before looking up resources", async () => {
  const id = crypto.randomUUID();
  await helper("proxy", { offline: true });
  for (const [method, path] of [["GET", "/workspaces"], ["GET", `/workspaces/${id}/boards`], ["GET", "/recent-boards"], ["PATCH", `/boards/${id}`]]) {
    await refused(await driver.request(path, { method }), 401, "token_missing");
    for (const [bad, reason] of [["malformed", "token_malformed"], ["tampered", "token_signature"], ["hs256", "token_algorithm"], ["expired", "token_expired"], ["audience", "token_audience"], ["issuer", "token_issuer"]]) {
      await refused(await request(path, "owner", method, undefined, context.bad[bad]), 401, reason);
    }
  }
});
check(61, "rename saves once broadcasts exports and reaches every list", async () => {
  const f = await fixture(), client = await join(f.a);
  const result = await rename(f.a, "One saved name");
  assert.equal(result.revision, client.revision + 1);
  const update = await client.peer.next("update");
  Y.applyUpdate(client.doc, Uint8Array.from(atob(update.update), (c) => c.charCodeAt(0)));
  assert.equal(readBoard(client.doc).title, result.title);
  assert.equal((await success(`/boards/${f.a}/export`)).title, result.title);
  await until(() => success(`/boards/${f.a}`), (b) => b.title === result.title);
  await until(() => boardList(f.workspace), (v) => v.boards.find((b: any) => b.id === f.a)?.title === result.title);
  await until(() => recents("editor"), (v) => v.boards.find((b: any) => b.id === f.a)?.title === result.title);
  const broadcasts = client.peer.messages.filter((m) => m.kind === "update").length;
  const receipts = (await driver.rows(f.a, "receipts")).length;
  assert.deepEqual(await rename(f.a, result.title), result);
  assert.equal((await driver.rows(f.a, "receipts")).length, receipts);
  assert.equal(client.peer.messages.filter((m) => m.kind === "update").length, broadcasts);
});
check(62, "ordinary title edits reach board details and both lists", async () => {
  const f = await fixture(), client = await join(f.a);
  await edit(client, "From an ordinary edit");
  await until(() => success(`/boards/${f.a}`), (b) => b.title === "From an ordinary edit");
  for (const read of [() => boardList(f.workspace), () => recents("editor")]) {
    await until(read, (v) => v.boards.find((b: any) => b.id === f.a)?.title === "From an ordinary edit");
  }
});
check(63, "refused edits copy nothing and ordinary NUL titles keep their document", async () => {
  const f = await fixture(), viewer = await join(f.a, "viewer");
  await copyIdle(f.a); const before = await row(f.a);
  viewer.peer.send({ kind: "edit", requestId: "viewer", epoch: viewer.epoch, update: titleUpdate(viewer.doc, "Refused") });
  assert.equal((await viewer.peer.next("refused")).reason, "role_too_low");
  const editor = await join(f.a);
  editor.peer.send({ kind: "edit", requestId: "invalid", epoch: editor.epoch, update: "invalid!" });
  assert.equal((await editor.peer.next("refused")).reason, "invalid_update");
  assert.equal((await row(f.a)).title, before.title); assert.equal((await row(f.a)).edited_at, before.edited_at);
  await edit(editor, "With\u0000NUL");
  await copiedTitle(f.a, "With\ufffdNUL");
  assert.equal((await success(`/boards/${f.a}/export`)).title, "With\u0000NUL");
});
check(64, "edited times throttle idle flush and failed copies retry after sixty seconds", async () => {
  const f = await fixture(), initial = await row(f.a), start = Date.now();
  await driver.control({ fixedNow: start });
  const client = await join(f.a); await copyIdle(f.a);
  const log = await helper("proxy");
  assert(log.some((call: any) => call.name === "copy_saved_board" && call.parameters.board === f.a));
  const first = await row(f.a);
  for (const key of Object.keys(initial).filter((key) => key !== "edited_at")) assert.deepEqual(first[key], initial[key]);
  await driver.control({ fixedNow: start + 60000 });
  // Use a content-only edit: names would deliberately bypass the throttle.
  async function contentEdit(x: number) {
    const vector = Y.encodeStateVector(client.doc), adapter = new Adapter(); adapter.doc = client.doc;
    const board = readBoard(client.doc);
    adapter.set(board.objects.length ? { ...board, objects: board.objects.map((o) => ({ ...o, x })) } : add(board, "text", x, 0));
    client.peer.send({ kind: "edit", epoch: client.epoch, requestId: crypto.randomUUID(), update: encoded(Y.encodeStateAsUpdate(client.doc, vector)) });
    await client.peer.next("saved");
  }
  await contentEdit(1);
  await until(() => row(f.a), (b) => Date.parse(b.edited_at) === start + 60000);
  await driver.control({ fixedNow: start + 70000 }); await contentEdit(2);
  assert.equal(Date.parse((await row(f.a)).edited_at), start + 60000);
  await edit(client, "Name copies immediately"); await copiedTitle(f.a, "Name copies immediately");
  assert.equal(Date.parse((await row(f.a)).edited_at), start + 60000);
  await driver.control({ fixedNow: start + 120001, board: f.a, alarm: true });
  await until(() => row(f.a), (b) => Date.parse(b.edited_at) === start + 70000);
  await helper("proxy", { rpc: "copy_saved_board", fail: true, clearLog: true });
  await edit(client, "Retry later");
  await until(() => helper("proxy"), (calls) => calls.some((c: any) => c.name === "copy_saved_board"));
  // Wait for the failed task's alarm to be scheduled, not merely dispatched.
  await new Promise((resolve) => setTimeout(resolve, 50));
  await helper("proxy", { clearLog: true });
  await driver.control({ fixedNow: start + 179000, board: f.a, alarm: true });
  await new Promise((resolve) => setTimeout(resolve, 50));
  assert(!(await helper("proxy")).some((c: any) => c.name === "copy_saved_board" && c.parameters.board === f.a));
  await driver.control({ fixedNow: start + 180002, board: f.a, alarm: true });
  await until(() => helper("proxy"), (calls) => calls.some((c: any) => c.name === "copy_saved_board" && c.parameters.board === f.a));
});
check(65, "copy failure cannot refuse or undo edits and recovery catches up", async () => {
  const f = await fixture(), client = await join(f.a); await copyIdle(f.a);
  const before = await row(f.a);
  await helper("proxy", { rpc: "copy_saved_board", fail: true });
  const result = await edit(client, "Saved during outage"); assert.equal(result.revision, 1);
  assert.equal((await success(`/boards/${f.a}/export`)).title, "Saved during outage");
  assert.equal((await row(f.a)).title, before.title);
  await helper("proxy", { rpc: "copy_saved_board" });
  await edit(client, "Recovered"); await copiedTitle(f.a, "Recovered");
});
check(66, "slow copies leave ten save acknowledgements below two hundred milliseconds", async () => {
  const f = await fixture(), client = await join(f.a); await copyIdle(f.a);
  await helper("proxy", { rpc: "copy_saved_board", delayMs: 1000 });
  const elapsed: number[] = [];
  for (let i = 0; i < 10; i++) {
    const started = performance.now();
    await edit(client, "Slow copy " + i);
    elapsed.push(performance.now() - started);
  }
  measures.ackMsWhileCopySlow = Math.max(...elapsed);
  assert(Math.max(...elapsed) < 200, JSON.stringify(elapsed));
  await copiedTitle(f.a, "Slow copy 9");
});
check(67, "saved row writes compare generation before revision and accept equal pairs", async () => {
  const f = await fixture();
  const copy = (title: string, generation: number, revision: number) => rpc("copy_saved_board", { board: f.a, title, edited_at: null, generation, revision });
  await copy("Current", 3, 10);
  for (const [generation, revision] of [[2, 999], [3, 9]]) { await copy("Old", generation, revision); assert.equal((await row(f.a)).title, "Current"); }
  await copy("Equal", 3, 10); assert.equal((await row(f.a)).title, "Equal");
  await copy("Newer revision", 3, 11); assert.equal((await row(f.a)).title, "Newer revision");
  await copy("Newer generation", 4, 0); assert.equal((await row(f.a)).title, "Newer generation");
});
async function restoreNames(physical: boolean) {
  const f = await fixture(), start = Date.now();
  await driver.control({ fixedNow: start });
  await rename(f.a, "X"); const x = await copiedTitle(f.a, "X");
  const envelope = await operator(f.a, "backup");
  await driver.control({ fixedNow: start + 60001 });
  await rename(f.a, "Y");
  const y = await until(() => row(f.a), (b) => b.title === "Y" && Date.parse(b.edited_at) > Date.parse(x.edited_at));
  await helper("proxy", { rpc: "copy_saved_board", delayMs: 1000, clearLog: true });
  const stale = fetch(context.proxyUrl + "/rest/v1/rpc/copy_saved_board", { method: "POST",
    headers: { apikey: context.serviceKey, Authorization: "Bearer " + context.serviceKey,
      "Content-Type": "application/json", "Content-Profile": "nextphase_board" },
    body: JSON.stringify({ board: f.a, title: "Delayed old copy", edited_at: y.edited_at,
      generation: y.document_generation, revision: y.document_revision + 100 }) });
  await until(() => helper("proxy"), (calls) => calls.some((c: any) => c.name === "copy_saved_board"));
  await helper("proxy", { rpc: "copy_saved_board" });
  if (physical) await driver.restoreFile(f.a, envelope, true);
  else await operator(f.a, "restore", envelope);
  assert.equal((await success(`/boards/${f.a}/export`)).title, "X");
  const restored = await copiedTitle(f.a, "X");
  assert.equal(Date.parse(restored.edited_at), Date.parse(x.edited_at));
  assert(restored.document_generation > y.document_generation);
  assert((await stale).ok);
  assert.equal((await row(f.a)).title, "X");
}
check(68, "logical restore rewinds name and edit time and fences delayed copies", () => restoreNames(false));
check(69, "point in time rewind reconciles names with an external fence", () => restoreNames(true));
check(70, "marked Node volume raises above row generation and stays locked offline", async () => {
  const f = await fixture(); await rename(f.a, "Volume X"); await copiedTitle(f.a, "Volume X");
  let newer: any;
  await driver.volumeCopy!(f.a, async () => {
    await rename(f.a, "Volume Y"); await copiedTitle(f.a, "Volume Y");
    await rpc("copy_saved_board", { board: f.a, title: "Volume Y", edited_at: null, generation: 5, revision: 0 });
    newer = await row(f.a);
    await helper("proxy", { offline: true });
  });
  await refused(await request(`/boards/${f.a}`, "owner", "PATCH", { title: "No" }), 503, "room_locked");
  await helper("proxy", { offline: false });
  assert.equal((await success(`/boards/${f.a}/export`)).title, "Volume X");
  const restored = await copiedTitle(f.a, "Volume X"); assert(restored.document_generation > newer.document_generation);
  const stored = (await driver.rows(f.a, "meta")).find((m) => m.key === "restore_generation");
  assert.equal(Number(stored.value), restored.document_generation);
});
check(71, "locked rename hides boards from outsiders and stores no edit", async () => {
  const f = await fixture(); await ticket(f.a); const envelope = await operator(f.a, "backup");
  await helper("proxy", { offline: true }); await operator(f.a, "restore", envelope);
  const before = await driver.rows(f.a, "receipts");
  await refused(await request(`/boards/${f.a}`, "owner", "PATCH", { title: "Locked" }), 503, "room_locked");
  await refused(await request(`/boards/${f.a}`, "outsider", "PATCH", { title: "Hidden" }), 404, "not_found");
  assert.deepEqual(await driver.rows(f.a, "receipts"), before);
});
check(72, "opens reorder tie by descending ID survive failure and cap at fifty", async () => {
  const f = await fixture(); await clearOpens("owner");
  const at = Date.now(); await driver.control({ fixedNow: at });
  await ticket(f.a);
  await until(() => recents(), (v) => v.boards.length === 1);
  assert.equal(Date.parse((await recents()).boards[0].openedAt), at);
  await ticket(f.b); await until(() => recents(), (v) => v.boards.length === 2);
  assert.deepEqual((await recents()).boards.map((b: any) => b.id), [f.a, f.b].sort().reverse());
  await driver.control({ fixedNow: at + 1 }); await ticket(f.a);
  await until(() => recents(), (v) => v.boards[0].id === f.a && Date.parse(v.boards[0].openedAt) === at + 1);
  await rpc("record_board_open", { person: person("owner").id, board: f.a, opened_at: new Date(at - 100).toISOString() });
  assert.equal(Date.parse((await recents()).boards[0].openedAt), at + 1);
  const lost = await create(f.workspace, "Failed open");
  await helper("proxy", { rpc: "record_board_open", fail: true });
  const issued = await ticket(lost.id);
  const peer = await driver.connect(`/boards/${lost.id}/join?ticket=${issued.ticket}`); peers.push(peer);
  assert.equal((await peer.next("joined")).kind, "joined");
  assert(!(await recents()).boards.some((b: any) => b.id === lost.id));
  await helper("proxy", { rpc: "record_board_open" });
  await driver.control({ fixedNow: at + 2 }); await ticket(lost.id);
  await until(() => recents(), (v) => v.boards[0].id === lost.id);
  await clearOpens("owner");
  const opened: string[] = [];
  for (let i = 0; i < 55; i++) {
    const board = await create(f.workspace, "Recent " + i);
    await driver.control({ fixedNow: at + 100 + i }); await ticket(board.id); opened.push(board.id);
  }
  await until(() => recents(), (v) => v.boards.length === 50 && v.boards[0].id === opened[54]);
  assert.deepEqual((await recents()).boards.map((b: any) => b.id), opened.slice(-50).reverse());
});
check(73, "removing the last guest grant removes board and workspace discovery", async () => {
  const f = await fixture(); await ticket(f.a, "granted");
  await until(() => recents("granted"), (v) => v.boards.some((b: any) => b.id === f.a));
  await sql(`DELETE FROM nextphase_board.board_grants WHERE board_id='${f.a}' AND person_id='${person("granted").id}'`);
  assert(!(await recents("granted")).boards.some((b: any) => b.id === f.a));
  assert(!(await success("/workspaces", "granted")).workspaces.some((w: any) => w.id === f.workspace));
  await refused(await request(`/workspaces/${f.workspace}/boards`, "granted"), 404, "not_found");
});
check(74, "all six sort directions page 250 tied boards exactly once", async () => {
  const f = await fixture();
  await sql(`INSERT INTO nextphase_board.boards(workspace_id, created_by, title, created_at, edited_at)
    SELECT '${f.workspace}', '${person("owner").id}', CASE n % 3 WHEN 0 THEN 'Apple' WHEN 1 THEN 'apple' ELSE 'banana' END,
      '2026-10-30 00:00:00.123456+00'::timestamptz, '2026-10-30 00:00:00.123456+00'::timestamptz
    FROM generate_series(1,248) n`);
  for (const sort of ["edited", "created", "title"]) for (const order of ["asc", "desc"]) {
    let cursor: string | null = null;
    const found: string[] = [], sizes: number[] = [];
    do {
      const page = await boardList(f.workspace, "owner", `?sort=${sort}&order=${order}${cursor ? "&cursor=" + cursor : ""}`);
      sizes.push(page.boards.length); found.push(...page.boards.map((b: any) => b.id)); cursor = page.nextCursor;
      assert(sizes.length <= 3, "Paging must terminate");
    } while (cursor !== null);
    assert.deepEqual(sizes, [100, 100, 50]); assert.equal(new Set(found).size, 250);
    const expression = sort === "title" ? `translate(title,'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz') COLLATE "C" ${order}, title COLLATE "C"` : sort === "edited" ? "edited_at" : "created_at";
    const expected = (await sql(`SELECT id FROM nextphase_board.boards WHERE workspace_id='${f.workspace}' ORDER BY ${expression} ${order}, id ${order}`)).trim().split("\n");
    assert.deepEqual(found, expected);
  }
});
check(75, "cursor shape context and unknown sort directions are refused", async () => {
  const f = await fixture();
  const valid = { v: 1, workspace: f.workspace, sort: "title", order: "asc", id: f.a, key: "Apple" };
  const encode = (value: unknown) => btoa(JSON.stringify(value)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  for (const cursor of ["!", encode([]), encode({ ...valid, extra: 1 }), encode({ ...valid, workspace: crypto.randomUUID() }),
    encode({ ...valid, sort: "created" }), encode({ ...valid, order: "desc" })]) {
    await refused(await request(`/workspaces/${f.workspace}/boards?sort=title&order=asc&cursor=${encodeURIComponent(cursor)}`), 400, "bad_request");
  }
  for (const query of ["sort=unknown", "order=unknown"]) await refused(await request(`/workspaces/${f.workspace}/boards?${query}`), 400, "bad_request");
});
check(76, "title order folds ASCII then compares original bytes and reverses exactly", async () => {
  const f = await fixture();
  for (const title of ["banana", "Apple", "cherry", "apple"]) await create(f.workspace, title);
  const select = (rows: any[]) => rows.filter((b) => ![f.a, f.b].includes(b.id)).map((b) => b.title);
  assert.deepEqual(select((await boardList(f.workspace, "owner", "?sort=title&order=asc")).boards), ["Apple", "apple", "banana", "cherry"]);
  assert.deepEqual(select((await boardList(f.workspace, "owner", "?sort=title&order=desc")).boards), ["cherry", "banana", "apple", "Apple"]);
});
