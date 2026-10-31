// SPDX-License-Identifier: Apache-2.0
import { test, beforeAll, afterAll, afterEach, inject } from "vitest";
import assert from "node:assert/strict";
import * as Y from "yjs";
import { makeDriver } from "board-test-driver";
import type { Context, Driver, Peer } from "./driver-types.ts";
import { Adapter } from "../../packages/board-sync/src/document-adapter.ts";
import { readBoard } from "../../packages/board-sync/src/codec.ts";
import { add } from "../../packages/board-rules/src/document.ts";

const context = inject<Context & { docker: boolean }>("board");
const runner = context.docker ? "docker" : inject<string>("runner");
type Fixture = { workspace: string; a: string; b: string; people: Context["people"] };
let driver: Driver, f: Fixture, pass = 0, fail = 0, timerEnabled = false;
const peers: Peer[] = [], documents: Y.Doc[] = [], measures: Record<string, unknown> = {};
const names = ["owner", "editor", "viewer", "granted", "plain", "outsider"];
const person = (name: string) => f.people[name];
beforeAll(async () => { if (runner !== "docker") driver = await makeDriver(context); });
afterEach(async () => {
  if (!driver) return;
  await helper("proxy", { release: "board_role" });
  for (const rpc of ["board_role", "record_access_receipt"]) await helper("proxy", { rpc });
  for (const peer of peers.splice(0)) await peer.close();
  for (const doc of documents.splice(0)) doc.destroy();
  await driver.control({ unreachable: [] });
  if (timerEnabled) { await driver.control({ deliveryIntervalMs: 0 }); timerEnabled = false; }
});
afterAll(async () => {
  if (!driver) return;
  await driver.close();
  console.log("SUMMARY-REMOVAL " + JSON.stringify({ runner, checks: pass + fail, pass, fail, measures }));
});
function check(id: number, name: string, operation: () => Promise<void>) {
  test.skipIf(runner === "docker")(`S${id} ${name}`, async () => {
    try { f = await helper("removal-fixture"); await operation(); pass++; console.log(`PASS: S${id} ${name}`); }
    catch (error) { fail++; console.log(`FAIL: S${id} ${name}`); throw error; }
  });
}
async function helper(action: string, value: unknown = {}): Promise<any> {
  const response = await fetch(context.helperUrl + "/" + action, { method: "POST", body: JSON.stringify(value) });
  const result = await response.json() as any;
  assert.equal(response.status, 200, JSON.stringify(result));
  return result;
}
const rpc = (name: string, parameters: unknown) => helper("rpc", { name, parameters });
const rows = (table: string, filters: Record<string, string>) => helper("rows", { table, filters });
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
    await new Promise((resolve) => setTimeout(resolve, 10));
  } while (Date.now() < deadline);
  assert.fail("Condition not reached within five seconds: " + JSON.stringify(value));
}
const memberPath = (name = "editor") => `/workspaces/${f.workspace}/members/${person(name).id}`;
const grantPath = (name = "granted", board = f.a) => `/boards/${board}/grants/${person(name).id}`;
const members = () => success(`/workspaces/${f.workspace}/members`);
const grants = () => success(`/workspaces/${f.workspace}/grants`);
const ticket = (board = f.a, name = "editor") => success(`/boards/${board}/join-tickets`, name, "POST", undefined, 201);
const changeCount = async () => (await rows("access_changes", { workspace_id: f.workspace })).length;
async function done(path: string, method = "DELETE", value?: unknown) {
  const result = await success(path, "owner", method, value); assert.equal(result.removal, "done"); return result;
}
const encoded = (bytes: Uint8Array) => {
  let text = "";
  for (let offset = 0; offset < bytes.length; offset += 8192) text += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
  return btoa(text);
};
async function join(board = f.a, name = "editor") {
  const issued = await ticket(board, name);
  const peer = await driver.connect(`/boards/${board}/join?ticket=${issued.ticket}`); peers.push(peer);
  const joined = await peer.next("joined"), doc = new Y.Doc(); documents.push(doc);
  Y.applyUpdate(doc, Uint8Array.from(atob(joined.update), (c) => c.charCodeAt(0)));
  return { peer, joined, doc, epoch: joined.epoch as number };
}
function titleUpdate(doc: Y.Doc, title: string) {
  const vector = Y.encodeStateVector(doc); doc.getMap("board").set("title", title);
  return encoded(Y.encodeStateAsUpdate(doc, vector));
}
async function saved(client: Awaited<ReturnType<typeof join>>, title: string) {
  client.peer.send({ kind: "edit", epoch: client.epoch, requestId: crypto.randomUUID(), update: titleUpdate(client.doc, title) });
  return client.peer.next("saved");
}
async function closed(peer: Peer, code = 4403) {
  await until(async () => peer.closed, (value) => value !== null); assert.equal(peer.closed, code);
}
async function retryHost() {
  if (runner === "node") { await driver.control({ deliveryIntervalMs: 200 }); timerEnabled = true; }
}
async function retry() {
  if (runner === "workerd") await driver.control({ scheduled: true });
}
const pending = (name = "editor", board: string | null = null) => rpc("pending_deliveries", {
  person: person(name).id, workspace: f.workspace, board,
});
async function waitDone(name = "editor") { await until(() => pending(name), (value) => value.length === 0); }
const operator = (personId: string, action: string, key: string | null = context.operatorKey) =>
  driver.request(`/operator/people/${personId}/${action}`, { method: "POST", headers: key ? { "Board-Operator-Key": key } : {} });
async function backup() {
  const response = await driver.request(`/operator/boards/${f.a}/backup`, { method: "POST", headers: { "Board-Operator-Key": context.operatorKey } });
  assert.equal(response.status, 200); return response.json() as Promise<any>;
}

check(77, "lowering roles authorization owner protection and no-op", async () => {
  for (const path of [memberPath(), grantPath()]) for (const name of names.slice(1)) {
    await refused(await request(path, name, "PUT", { role: "viewer" }), names.indexOf(name) < 4 ? 403 : 404,
      names.indexOf(name) < 4 ? "role_too_low" : "not_found", names.indexOf(name) < 4 ? "owner" : undefined);
  }
  await done(memberPath(), "PUT", { role: "viewer" });
  assert.equal((await success(`/boards/${f.a}`, "editor")).role, "viewer");
  await done(memberPath("viewer"), "PUT", { role: "guest" });
  await refused(await request(`/boards/${f.a}`, "viewer"), 404, "not_found");
  assert.deepEqual((await success("/workspaces", "viewer")).workspaces, []);
  await done(grantPath(), "PUT", { role: "viewer" });
  assert.equal((await success(`/boards/${f.a}`, "granted")).role, "viewer");
  for (const path of [memberPath("owner"), grantPath("owner")]) {
    for (const method of ["PUT", "DELETE"]) await refused(await request(path, "owner", method,
      method === "PUT" ? { role: "viewer" } : undefined), 409, "owner_row_immutable");
    await refused(await request(path, "owner", "PUT", { role: "owner" }), 400, "bad_request");
  }
  const count = await changeCount();
  await done(memberPath(), "PUT", { role: "viewer" }); await done(grantPath(), "PUT", { role: "viewer" });
  assert.equal(await changeCount(), count);
  // The owner accepts an offer without bypassing route owner-row protection.
  const offer = await success(`/boards/${f.a}/invitations`, "owner", "POST", { email: person("owner").email, role: "viewer" }, 201);
  await success(`/invitations/${offer.id}/accept`, "owner", "POST"); assert.equal(await changeCount(), count);
});

check(78, "removing workspace access preserves direct grants and removes empty guests", async () => {
  await done(memberPath());
  assert.deepEqual((await success("/workspaces", "editor")).workspaces, []);
  await refused(await request(`/workspaces/${f.workspace}/boards`, "editor"), 404, "not_found");
  await done(grantPath("viewer"), "PUT", { role: "editor" });
  await done(memberPath("viewer"));
  assert.equal((await success("/workspaces", "viewer")).workspaces[0].role, "guest");
  await saved(await join(f.a, "viewer"), "Guest keeps direct access");
  await refused(await request(`/boards/${f.b}`, "viewer"), 404, "not_found");
  await done(memberPath("plain"));
  await refused(await request(memberPath("granted"), "owner", "DELETE"), 409, "guest_has_grants");
  await refused(await request(memberPath("owner"), "owner", "DELETE"), 409, "owner_row_immutable");
  await refused(await request(memberPath("outsider"), "owner", "DELETE"), 404, "not_found");
  for (const path of [memberPath("viewer"), grantPath()]) for (const name of names.slice(1)) {
    const visible = ["viewer", "granted"].includes(name);
    await refused(await request(path, name, "DELETE"), visible ? 403 : 404, visible ? "role_too_low" : "not_found", visible ? "owner" : undefined);
  }
});

check(79, "grant removal keeps the highest role and lists omit completed removals", async () => {
  await done(grantPath("editor"), "PUT", { role: "editor" }); await done(grantPath("editor"));
  assert.equal((await success(`/boards/${f.a}`, "editor")).role, "editor");
  await done(grantPath());
  assert.deepEqual((await success("/workspaces", "granted")).workspaces, []);
  await refused(await request(grantPath(), "owner", "DELETE"), 404, "not_found");
  const memberRows = (await members()).members, grantRows = (await grants()).grants;
  assert(!memberRows.some((row: any) => row.personId === person("granted").id));
  assert(!grantRows.some((row: any) => [person("granted").id, person("editor").id].includes(row.personId)));
  assert([...memberRows, ...grantRows].every((row: any) => row.removal === "done"));
});

check(80, "active edits stop at the room step and saved edits match export", async () => {
  const client = await join(), sent = new Map<string, string>();
  const adapter = new Adapter(); adapter.doc.destroy(); adapter.doc = client.doc;
  let interval: ReturnType<typeof setInterval> | undefined;
  const send = () => {
    if (client.peer.closed !== null) return;
    const vector = Y.encodeStateVector(client.doc), board = add(readBoard(client.doc), "sticky", 0, 0);
    const object = board.objects.at(-1)!, requestId = crypto.randomUUID();
    adapter.set(board); sent.set(requestId, object.id);
    try { client.peer.send({ kind: "edit", epoch: client.epoch, requestId, update: encoded(Y.encodeStateAsUpdate(client.doc, vector)) }); }
    catch { /* A transport close can race the next 10 ms send. */ }
  };
  try {
    send(); await client.peer.next("saved"); interval = setInterval(send, 10);
    await new Promise((resolve) => setTimeout(resolve, 40));
    const start = performance.now(); await done(memberPath()); await closed(client.peer);
    measures.closeMs = performance.now() - start; assert(Number(measures.closeMs) <= 2000);
  } finally { clearInterval(interval); }
  const board = await success(`/boards/${f.a}/export`), savedIds = client.peer.messages.filter((m) => m.kind === "saved").map((m) => sent.get(m.requestId));
  assert.deepEqual(board.objects.map((object: any) => object.id).sort(), savedIds.sort());
  assert(client.peer.messages.filter((m) => m.kind === "refused").every((m) => m.reason === "epoch_changed"));
});

check(81, "removal deletes waiting edits before another editor supplies their dependency", async () => {
  const client = await join(), other = await join(f.a, "owner");
  const first = titleUpdate(client.doc, "Missing update"), second = titleUpdate(client.doc, "Waiting edit must disappear");
  client.peer.send({ kind: "edit", epoch: client.epoch, requestId: "waiting", update: second });
  await client.peer.next("received");
  await done(memberPath()); await closed(client.peer);
  assert.deepEqual(await driver.rows(f.a, "waiting"), []);
  other.peer.send({ kind: "edit", epoch: other.epoch, requestId: "missing", update: first }); await other.peer.next("saved");
  assert.equal((await success(`/boards/${f.a}/export`)).title, "Missing update");
  assert(!(await driver.rows(f.a, "receipts")).some((row) => row.request_id === "waiting"));
  assert(!client.peer.messages.some((m) => m.kind === "saved"));
});

check(82, "lowering closes 4403 and raising closes 4409 with the new join role", async () => {
  const editor = await join(); await done(memberPath(), "PUT", { role: "viewer" }); await closed(editor.peer);
  const viewer = await join(); assert.equal(viewer.joined.role, "viewer");
  viewer.peer.send({ kind: "edit", epoch: viewer.epoch, requestId: "denied", update: titleUpdate(viewer.doc, "Denied") });
  const reply = await viewer.peer.next("refused"); assert.equal(reply.reason, "role_too_low"); assert.equal(reply.needed, "editor");
  await success(`/boards/${f.a}/export`, "editor");
  await done(memberPath(), "PUT", { role: "editor" }); await closed(viewer.peer, 4409);
  assert.equal((await join()).joined.role, "editor");
});

check(83, "removing a redundant grant preserves the epoch connection and edits", async () => {
  await done(grantPath("editor"), "PUT", { role: "editor" }); const client = await join();
  await done(grantPath("editor")); assert.equal(client.peer.closed, null);
  assert.equal((await driver.rows(f.a, "grants")).find((row) => row.person_id === person("editor").id).epoch, client.epoch);
  await saved(client, "Still an editor");
});

check(84, "removed editors and viewers cannot reuse tickets reconnect export or discover boards", async () => {
  for (const name of ["editor", "viewer"]) {
    const client = await join(f.a, name), unused = await ticket(f.a, name);
    await done(memberPath(name)); await closed(client.peer);
    for (const [path, method] of [[`/boards/${f.a}/join-tickets`, "POST"], [`/boards/${f.a}/export`, "GET"],
      [`/boards/${f.a}`, "GET"], [`/workspaces/${f.workspace}/boards`, "GET"]]) {
      await refused(await request(path, name, method), 404, "not_found");
    }
    await refused(await driver.request(`/boards/${f.a}/join?ticket=${unused.ticket}`, { headers: { Origin: context.origin } }), 404, "not_found");
    assert(!(await success("/recent-boards", name)).boards.some((row: any) => row.id === f.a));
  }
});

check(85, "a held role lookup computed before removal cannot return stale access", async () => {
  await join(f.b, "owner");
  const count = await changeCount();
  await helper("proxy", { rpc: "board_role", hold: true, parameters: { person: person("editor").id, board: f.b }, clearLog: true });
  const lookup = request(`/boards/${f.b}/join-tickets`, "editor", "POST");
  const log = await until(() => helper("proxy"), (value) => value.some((entry: any) => entry.heldAt));
  const heldAt = log.find((entry: any) => entry.heldAt).heldAt;
  const removing = success(memberPath(), "owner", "DELETE");
  await until(changeCount, (value) => value > count);
  await helper("proxy", { release: "board_role" }); assert(Date.now() - heldAt < 1000);
  await refused(await lookup, 404, "not_found"); assert.equal((await removing).removal, "done");
  assert(!(await driver.rows(f.b, "grants")).some((row) => row.person_id === person("editor").id));
  await refused(await request(`/boards/${f.b}/join-tickets`, "editor", "POST"), 404, "not_found");
});

check(86, "failed delivery leaves a pending removed row until a retry closes its room", async () => {
  await retryHost(); const a = await join(), b = await join(f.b);
  await driver.control({ unreachable: [f.b] });
  assert.equal((await success(memberPath(), "owner", "DELETE")).removal, "pending"); await closed(a.peer);
  const row = (await members()).members.find((row: any) => row.personId === person("editor").id);
  assert.deepEqual([row.role, row.removal], [null, "pending"]);
  for (const [path, method] of [[`/boards/${f.a}`, "GET"], [`/workspaces/${f.workspace}/boards`, "GET"], [`/boards/${f.a}/join-tickets`, "POST"]]) {
    await refused(await request(path, "editor", method), 404, "not_found");
  }
  assert.equal(b.peer.closed, null);
  await driver.control({ unreachable: [] }); await retry(); await closed(b.peer); await waitDone();
  assert(!(await members()).members.some((row: any) => row.personId === person("editor").id));
});

check(87, "lost receipts remain pending and retry does not advance the epoch twice", async () => {
  await retryHost(); const editor = await join(), guest = await join(f.a, "granted");
  await helper("proxy", { rpc: "record_access_receipt", fail: true });
  assert.equal((await success(memberPath(), "owner", "DELETE")).removal, "pending"); await closed(editor.peer);
  assert.equal((await success(grantPath(), "owner", "PUT", { role: "viewer" })).removal, "pending"); await closed(guest.peer);
  const before = (await driver.rows(f.a, "grants")).find((row) => row.person_id === person("granted").id);
  assert.equal(before.epoch, guest.epoch + 1);
  assert.equal((await grants()).grants.find((row: any) => row.personId === person("granted").id).removal, "pending");
  await helper("proxy", { rpc: "record_access_receipt" }); await retry(); await waitDone(); await waitDone("granted");
  assert.deepEqual((await driver.rows(f.a, "grants")).find((row) => row.person_id === person("granted").id), before);
});

check(88, "restart after a room step preserves the copy while retry records its receipt", async () => {
  const editor = await join(); await helper("proxy", { rpc: "record_access_receipt", fail: true });
  assert.equal((await success(memberPath(), "owner", "DELETE")).removal, "pending"); await closed(editor.peer);
  const before = await driver.rows(f.a, "grants");
  if (runner === "node") await retryHost(); else await driver.wake(f.a);
  await helper("proxy", { rpc: "record_access_receipt" }); await retry(); await waitDone();
  assert.deepEqual(await driver.rows(f.a, "grants"), before);
  await refused(await request(`/boards/${f.a}/join-tickets`, "editor", "POST"), 404, "not_found");
});

check(89, "an older backup cannot restore removed access or unused tickets", async () => {
  await join(); const unused = await ticket(), envelope = await backup();
  await done(memberPath());
  const response = await driver.request(`/operator/boards/${f.a}/restore`, { method: "POST",
    headers: { "Board-Operator-Key": context.operatorKey, "Content-Type": "application/json" }, body: JSON.stringify(envelope) });
  assert.equal(response.status, 200); await ticket(f.a, "owner");
  await refused(await request(`/boards/${f.a}/join-tickets`, "editor", "POST"), 404, "not_found");
  await refused(await driver.request(`/boards/${f.a}/join?ticket=${unused.ticket}`, { headers: { Origin: context.origin } }), 401, "ticket_invalid");
});

check(90, "the retry host completes pending delivery without an HTTP access write", async () => {
  const client = await join(); await driver.control({ unreachable: [f.a] });
  assert.equal((await success(memberPath(), "owner", "DELETE")).removal, "pending");
  await driver.control({ unreachable: [] });
  if (runner === "node") await retryHost(); else await retry();
  // Read Supabase directly: no HTTP request to the server can cause this retry.
  await waitDone();
  if (runner === "workerd") await closed(client.peer);
  const config = await helper("server-config"); assert.deepEqual(config.triggers.crons, ["* * * * *"]);
});

check(91, "disable removes all board access while tokens still verify and RLS reads vanish", async () => {
  const a = await join(), b = await join(f.b), before = await changeCount();
  for (const key of [null, "wrong"]) await refused(await operator(person("editor").id, "disable", key), 401, "operator_key_invalid");
  await refused(await operator(crypto.randomUUID(), "disable"), 404, "person_not_found");
  const response = await operator(person("editor").id, "disable"); assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { personId: person("editor").id, disabled: true, removal: "done" });
  await closed(a.peer); await closed(b.peer);
  for (const board of [f.a, f.b]) for (const [suffix, method] of [["", "GET"], ["/export", "GET"], ["/join-tickets", "POST"]]) {
    await refused(await request(`/boards/${board}${suffix}`, "editor", method), 404, "not_found");
  }
  assert.deepEqual((await success("/workspaces", "editor")).workspaces, []);
  assert.deepEqual((await success("/recent-boards", "editor")).boards, []);
  const offer = await success(`/workspaces/${f.workspace}/invitations`, "owner", "POST", { email: person("editor").email, role: "editor" }, 201);
  await refused(await request(`/invitations/${offer.id}/accept`, "editor", "POST"), 403, "account_disabled");
  const after = await changeCount(); assert.equal(after, before + 1);
  const again = await operator(person("editor").id, "disable"); assert.equal(again.status, 200); assert.equal(await changeCount(), after);
  for (const table of ["people", "workspaces", "workspace_members", "boards", "board_opens", "board_grants", "invitations", "access_changes", "access_deliveries", "access_log_floor"]) {
    assert.deepEqual((await helper("rls", { token: person("editor").token, table })).data, []);
  }
  // A disabled subject still gets the signature refusal before any role lookup.
  const parts = person("editor").token.split(".");
  parts[2] = (parts[2][0] === "A" ? "B" : "A") + parts[2].slice(1);
  await refused(await request(`/boards/${f.a}`, "editor", "GET", undefined, parts.join(".")), 401, "token_signature");
});

check(92, "enable restores the retained workspace role and grants", async () => {
  await done(grantPath("editor"), "PUT", { role: "editor" }); await join();
  assert.equal((await operator(person("editor").id, "disable")).status, 200);
  const response = await operator(person("editor").id, "enable"); assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { personId: person("editor").id, disabled: false, removal: "done" });
  assert.equal((await join()).joined.role, "editor");
  assert.equal((await grants()).grants.find((row: any) => row.personId === person("editor").id).role, "editor");
  const count = await changeCount(); assert.equal((await operator(person("editor").id, "enable")).status, 200); assert.equal(await changeCount(), count);
  await refused(await operator(crypto.randomUUID(), "enable"), 404, "person_not_found");
});

check(93, "workspace removal closes every connection within two seconds at 1 10 and 50 boards", async () => {
  const timings: Record<string, number> = {};
  for (const count of [1, 10, 50]) {
    const workspace = await rpc("bootstrap_workspace", { name: "Removal timing " + crypto.randomUUID(), owner_id: person("owner").id, owner_email: person("owner").email });
    const offer = await rpc("create_invitation", { workspace, board: null, email: person("editor").email, role: "editor", by: person("owner").id });
    await rpc("accept_invitation", { invitation: offer.id, person: person("editor").id, email: person("editor").email });
    const connections: Peer[] = [];
    for (let index = 0; index < count; index++) {
      const board = await rpc("create_board", { workspace, person: person("owner").id, title: "Removal " + index });
      connections.push((await join(board.id)).peer);
    }
    const start = performance.now();
    await done(`/workspaces/${workspace}/members/${person("editor").id}`);
    await Promise.all(connections.map((peer) => closed(peer)));
    timings[String(count)] = performance.now() - start; assert(timings[String(count)] <= 2000);
  }
  measures.removalMs = timings;
});
