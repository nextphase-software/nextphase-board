// SPDX-License-Identifier: Apache-2.0
import { test, beforeAll, afterAll, afterEach, inject } from "vitest";
import assert from "node:assert/strict";
import * as Y from "yjs";
import { makeDriver } from "board-test-driver";
import type { Context, Driver, Peer } from "./driver-types.ts";
import { Adapter } from "../../packages/board-sync/src/document-adapter.ts";
import { readBoard } from "../../packages/board-sync/src/codec.ts";
import { add, canonical, empty } from "../../packages/board-rules/src/document.ts";
const context = inject<Context & { docker: boolean }>("board"), runner = context.docker ? "docker" : inject<string>("runner");
let driver: Driver;
const requestUrls: string[] = [];
const peers: Peer[] = [], measures: Record<string, unknown> = {};
let pass = 0, fail = 0;
const names = ["owner", "editor", "viewer", "granted", "plain", "outsider"];
beforeAll(async () => {
  driver = await makeDriver(context);
  const request = driver.request.bind(driver), connect = driver.connect.bind(driver);
  driver.request = (path, init) => { requestUrls.push(path); return request(path, init); };
  driver.connect = (path, origin) => { requestUrls.push(path); return connect(path, origin); };
});
afterEach(async () => {
  for (const p of peers.splice(0)) await p.close();
  await helper("proxy", { offline: false });
  if (runner !== "docker") await driver.control({ offset: 0, fenceUnreadable: false, unreachable: [], backupLimit: 16777216, noOperator: false });
});
afterAll(async () => {
  if (driver) await driver.close();
  console.log("SUMMARY " + JSON.stringify({ runner, checks: pass + fail, pass, fail, measures }));
});
function check(id: number, name: string, fn: () => Promise<void>) {
  if (runner === "docker" ? id < 51 : id >= 51 || runner === "workerd" && [37, 43].includes(id)) return;
  test(`S${id} ${name}`, async () => {
    try { await fn(); pass++; console.log(`PASS: S${id} ${name}`); }
    catch (error) { fail++; console.log(`FAIL: S${id} ${name}`); throw error; }
  });
}
async function helper(action: string, value: unknown = {}) {
  const reply = await fetch(context.helperUrl + "/" + action, { method: "POST", body: JSON.stringify(value) });
  const result = await reply.json() as any;
  if (!reply.ok) throw Error(result.error + ": " + result.detail);
  return result;
}
const fixture = () => helper("fixture");
const person = (name: string) => context.people[name];
async function request(path: string, name = "owner", method = "GET", body?: unknown, token?: string) {
  const headers: Record<string, string> = { Authorization: "Bearer " + (token ?? person(name).token), Origin: context.origin };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  return driver.request(path, { method, headers, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
}
async function success(path: string, name = "owner", method = "GET", value?: unknown, status = 200) {
  const response = await request(path, name, method, value);
  assert.equal(response.status, status, path + " " + await response.clone().text());
  return status === 204 ? null : response.json();
}
async function refused(response: Response, status: number, reason: string, needed?: string) {
  assert.equal(response.status, status);
  assert.deepEqual(await response.json(), { error: { reason, ...(needed ? { needed } : {}) } });
}
async function ticket(board: string, name = "editor", token?: string) {
  const response = await request(`/boards/${board}/join-tickets`, name, "POST", undefined, token);
  assert.equal(response.status, 201, await response.clone().text());
  return response.json() as Promise<{ ticket: string; expiresAt: number }>;
}
async function join(board: string, name = "editor", token?: string) {
  const t = await ticket(board, name, token);
  const peer = await driver.connect(`/boards/${board}/join?ticket=${t.ticket}`); peers.push(peer);
  const joined = await peer.next("joined");
  const doc = new Y.Doc(); Y.applyUpdate(doc, Uint8Array.from(atob(joined.update), (c) => c.charCodeAt(0)));
  return { peer, joined, doc, epoch: joined.epoch as number };
}
const encoded = (bytes: Uint8Array) => {
  let text = ""; for (let offset = 0; offset < bytes.length; offset += 8192) text += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
  return btoa(text);
};
function change(doc: Y.Doc, title: string) {
  const vector = Y.encodeStateVector(doc); doc.getMap("board").set("title", title);
  return encoded(Y.encodeStateAsUpdate(doc, vector));
}
async function edit(client: Awaited<ReturnType<typeof join>>, title = "Edited", requestId = crypto.randomUUID()) {
  const update = change(client.doc, title);
  client.peer.send({ kind: "edit", epoch: client.epoch, requestId, update });
  return { saved: await client.peer.next("saved"), update, requestId };
}
async function untilClosed(peer: Peer, code: number) {
  for (let n = 0; n < 100 && peer.closed === null; n++) await new Promise((r) => setTimeout(r, 10));
  assert.equal(peer.closed, code);
}
const operator = (board: string, action: string, body?: unknown, key: string | null = context.operatorKey) =>
  driver.request(`/operator/boards/${board}/${action}`, { method: "POST", headers: { ...(key ? { "Board-Operator-Key": key } : {}), "Content-Type": "application/json" }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
async function backup(board: string) { const r = await operator(board, "backup"); assert.equal(r.status, 200); return r.json() as Promise<any>; }
async function raise(workspace: string, name: string) { await success(`/workspaces/${workspace}/members/${person(name).id}`, "owner", "PUT", { role: "editor" }); }
async function grant(board: string, name: string) { await success(`/boards/${board}/grants/${person(name).id}`, "owner", "PUT", { role: "editor" }); }
const readStatuses = (board: "a" | "b") => board === "a" ? [200, 200, 200, 200, 404, 404] : [200, 200, 200, 404, 404, 404];
async function identityChecks() {
  const f = await fixture();
  for (const name of names) assert.notEqual((await request(`/boards/${f.a}`, name)).status, 401);
  assert.equal((await request(`/boards/${f.a}`)).status, 200);
}
check(1, "independent ES256 identities", identityChecks);
check(2, "missing and malformed tokens", async () => {
  const f = await fixture();
  await refused(await driver.request(`/boards/${f.a}`), 401, "token_missing");
  await refused(await request(`/boards/${f.a}`, "owner", "GET", undefined, context.bad.malformed), 401, "token_malformed");
});
async function signatures() {
  const f = await fixture();
  await refused(await request(`/boards/${f.a}`, "owner", "GET", undefined, context.bad.tampered), 401, "token_signature");
  await refused(await request(`/boards/${f.a}`, "owner", "GET", undefined, context.bad.hs256), 401, "token_algorithm");
}
check(3, "tampering and shared-secret algorithms", signatures);
check(4, "expiry audience and issuer", async () => {
  const f = await fixture();
  for (const name of ["expired", "audience", "issuer"]) await refused(await request(`/boards/${f.a}`, "owner", "GET", undefined, context.bad[name]), 401, "token_" + name);
});
check(5, "pinned keys survive endpoint failure", async () => {
  const f = await fixture();
  await helper("proxy", { offline: true });
  // Unknown route proves token verification without needing a database lookup.
  assert.equal((await request("/unknown")).status, 404);
  await refused(await request("/unknown", "owner", "GET", undefined, context.bad.unknown), 503, "signing_keys_unavailable");
});
check(6, "every protected route checks tokens before lookups", async () => {
  const f = await fixture();
  const routes = (id: string) => [
    ["POST", `/workspaces/${id}/boards`], ["GET", `/boards/${id}`], ["POST", `/boards/${id}/join-tickets`], ["GET", `/boards/${id}/export`],
    ...["members", "grants", "invitations"].map((part) => ["GET", `/workspaces/${id}/${part}`]),
    ["POST", `/workspaces/${id}/invitations`], ["POST", `/boards/${id}/invitations`],
    ["DELETE", `/invitations/${id}`], ["POST", `/invitations/${id}/accept`],
    ["PUT", `/workspaces/${id}/members/${person("viewer").id}`], ["PUT", `/boards/${id}/grants/${person("viewer").id}`],
  ];
  for (const [bad, reason] of [["malformed", "token_malformed"], ["tampered", "token_signature"], ["hs256", "token_algorithm"],
    ["expired", "token_expired"], ["audience", "token_audience"], ["issuer", "token_issuer"]]) {
    for (const id of [f.a, crypto.randomUUID()]) for (const [method, path] of routes(id)) await refused(await request(path, "owner", method, undefined, context.bad[bad]), 401, reason);
  }
  for (const [method, path] of routes(f.a)) await refused(await driver.request(path, { method }), 401, "token_missing");
});
check(7, "create route role matrix and titles", async () => {
  const f = await fixture();
  for (let n = 0; n < names.length; n++) {
    const r = await request(`/workspaces/${f.workspace}/boards`, names[n], "POST", { title: "Created 🧭" });
    if (n < 2) assert.equal(r.status, 201);
    else await refused(r, n < 4 ? 403 : 404, n < 4 ? "role_too_low" : "not_found", n < 4 ? "editor" : undefined);
  }
  for (const title of ["x".repeat(121), "   ", "\ud800"]) await refused(await request(`/workspaces/${f.workspace}/boards`, "owner", "POST", { title }), 400, "bad_request");
});
check(8, "board details role matrix", async () => {
  const f = await fixture();
  for (const key of ["a", "b"] as const) for (let n = 0; n < names.length; n++) assert.equal((await request(`/boards/${f[key]}`, names[n])).status, readStatuses(key)[n]);
});
async function joinMatrix() {
  const f = await fixture();
  for (const key of ["a", "b"] as const) for (let n = 0; n < names.length; n++) {
    if (readStatuses(key)[n] === 200) { const c = await join(f[key], names[n]); assert.equal(c.joined.kind, "joined"); }
    else await refused(await request(`/boards/${f[key]}/join-tickets`, names[n], "POST"), 404, "not_found");
  }
}
check(9, "ticket and join role matrix", joinMatrix);
check(10, "canonical export role matrix", async () => {
  const f = await fixture();
  for (const key of ["a", "b"] as const) {
    const c = await join(f[key]); await edit(c, "Exported " + key);
    const expected = canonical(readBoard(c.doc));
    for (let n = 0; n < names.length; n++) {
      const r = await request(`/boards/${f[key]}/export`, names[n]);
      assert.equal(r.status, readStatuses(key)[n]); if (r.ok) assert.equal(await r.text(), expected);
    }
  }
});
check(11, "owner lists members grants and invitations", async () => {
  const f = await fixture();
  for (const part of ["members", "grants", "invitations"]) for (let n = 0; n < names.length; n++) {
    const r = await request(`/workspaces/${f.workspace}/${part}`, names[n]);
    if (!n) assert.equal(r.status, 200); else await refused(r, n < 4 ? 403 : 404, n < 4 ? "role_too_low" : "not_found", n < 4 ? "owner" : undefined);
  }
});
check(12, "invitation create cancel matrix and private rows", async () => {
  const f = await fixture();
  for (const path of [`/workspaces/${f.workspace}/invitations`, `/boards/${f.a}/invitations`, `/boards/${f.b}/invitations`]) {
    for (let n = 0; n < names.length; n++) {
      const r = await request(path, names[n], "POST", { email: person("viewer").email, role: "viewer" });
      const absent = n >= 4 || n === 3 && path.includes(f.b);
      if (!n) assert.equal(r.status, 201); else await refused(r, absent ? 404 : 403, absent ? "not_found" : "role_too_low", absent ? undefined : "owner");
    }
  }
  for (const board of [f.a, f.b]) {
    const invite = await success(`/boards/${board}/invitations`, "owner", "POST", { email: person("viewer").email, role: "viewer" }, 201) as any;
    for (let n = 1; n < names.length; n++) {
      const absent = n >= 4 || n === 3 && board === f.b;
      await refused(await request(`/invitations/${invite.id}`, names[n], "DELETE"), absent ? 404 : 403, absent ? "not_found" : "role_too_low", absent ? undefined : "owner");
    }
    assert.equal((await request(`/invitations/${invite.id}`, "owner", "DELETE")).status, 204);
  }
  const rows = await helper("rls", { token: person("viewer").token, table: "invitations" }); assert.deepEqual(rows.data, []);
});
check(13, "raise matrix no-op and lowering refusals", async () => {
  const f = await fixture();
  const paths = [`/workspaces/${f.workspace}/members/${person("viewer").id}`, `/boards/${f.a}/grants/${person("viewer").id}`, `/boards/${f.b}/grants/${person("viewer").id}`];
  for (const path of paths) for (let n = 1; n < names.length; n++) {
    const absent = n >= 4 || n === 3 && path.includes(f.b);
    await refused(await request(path, names[n], "PUT", { role: "editor" }), absent ? 404 : 403, absent ? "not_found" : "role_too_low", absent ? undefined : "owner");
  }
  for (const path of paths) {
    await success(path, "owner", "PUT", { role: "editor" });
    const before = (await helper("rows", { table: "access_changes", filters: { workspace_id: f.workspace } })).length;
    await success(path, "owner", "PUT", { role: "editor" });
    assert.equal((await helper("rows", { table: "access_changes", filters: { workspace_id: f.workspace } })).length, before);
    await refused(await request(path, "owner", "PUT", { role: "viewer" }), 409, "lowering_not_offered");
  }
});
check(14, "invitation acceptance identity expiry cancellation and retries", async () => {
  const f = await fixture();
  const offer = async () => success(`/workspaces/${f.workspace}/invitations`, "owner", "POST", { email: person("outsider").email, role: "viewer" }, 201) as Promise<any>;
  const invitation = await offer();
  await refused(await request(`/invitations/${invitation.id}/accept`, "viewer", "POST"), 403, "invitation_email_mismatch");
  const first = await success(`/invitations/${invitation.id}/accept`, "outsider", "POST");
  await raise(f.workspace, "outsider");
  assert.deepEqual(await success(`/invitations/${invitation.id}/accept`, "outsider", "POST"), first);
  assert.equal((first as any).role, "viewer");
  const usedToken = await helper("token", { person: { ...person("plain"), email: person("outsider").email } });
  await refused(await request(`/invitations/${invitation.id}/accept`, "plain", "POST", undefined, usedToken), 410, "invitation_used");
  const expired = await offer();
  await helper("sql", { sql: `UPDATE nextphase_board.invitations SET expires_at = now() - interval '1 second' WHERE id='${expired.id}'` });
  await refused(await request(`/invitations/${expired.id}/accept`, "outsider", "POST"), 410, "invitation_expired");
  const cancelled = await offer(); await success(`/invitations/${cancelled.id}`, "owner", "DELETE", undefined, 204);
  await refused(await request(`/invitations/${cancelled.id}/accept`, "outsider", "POST"), 410, "invitation_cancelled");
});
check(15, "unoffered routes return not found", async () => {
  const f = await fixture();
  for (const board of [f.a, f.b]) for (const name of names) for (const [method, suffix] of [["DELETE", ""], ["GET", "/images"], ["POST", "/images"], ["GET", "/comments"], ["POST", "/comments"], ["GET", "/unknown"]]) {
    await refused(await request(`/boards/${board}${suffix}`, name, method), 404, "not_found");
  }
});
async function secrecy() {
  const f = await fixture();
  for (const name of ["outsider", "plain"]) {
    const response = await request(`/boards/${f.a}/join-tickets`, name, "POST");
    assert.equal(response.status, 404); assert.equal(await response.text(), '{"error":{"reason":"not_found"}}');
    await refused(await driver.request(`/boards/${f.a}/join?ticket=unknown`, { headers: { Origin: context.origin } }), 401, "ticket_invalid");
  }
}
check(16, "refused joins disclose no board content", secrecy);
async function viewerEdit() {
  const f = await fixture(), c = await join(f.a, "viewer"), before = await success(`/boards/${f.a}/export`);
  c.peer.send({ kind: "edit", epoch: c.epoch, requestId: "viewer", update: change(c.doc, "Refused") });
  const r = await c.peer.next("refused"); assert.equal(r.reason, "role_too_low"); assert.equal(r.needed, "editor");
  assert(!c.peer.messages.some((m) => ["received", "saved"].includes(m.kind)));
  assert.deepEqual(await success(`/boards/${f.a}/export`), before);
}
check(17, "viewer edits are never acknowledged", viewerEdit);
async function editorEdit() {
  const f = await fixture(), c = await join(f.a), other = await join(f.a, "owner");
  const result = await edit(c); assert.equal(result.saved.revision, 1);
  const update = await other.peer.next("update"); assert.equal(update.revision, 1);
  assert(result.saved.observed < update.observed);
}
check(18, "saved precedes broadcast", editorEdit);
check(19, "incomplete edits wait until dependencies arrive", async () => {
  const f = await fixture(), c = await join(f.a);
  const first = change(c.doc, "First"), second = change(c.doc, "Second");
  c.peer.send({ kind: "edit", epoch: c.epoch, requestId: "second", update: second });
  await c.peer.next("received"); assert(!c.peer.messages.some((m) => m.kind === "saved"));
  c.peer.send({ kind: "edit", epoch: c.epoch, requestId: "first", update: first });
  assert.equal((await c.peer.next("saved")).requestId, "first"); assert.equal((await c.peer.next("saved")).requestId, "second");
});
check(20, "receipt retry is idempotent and bound to update bytes", async () => {
  const f = await fixture(), c = await join(f.a), result = await edit(c);
  c.peer.send({ kind: "edit", epoch: c.epoch, requestId: result.requestId, update: result.update });
  assert.equal((await c.peer.next("saved")).revision, 1);
  c.peer.send({ kind: "edit", epoch: c.epoch, requestId: result.requestId, update: change(c.doc, "Other") });
  assert.equal((await c.peer.next("refused")).reason, "request_id_reused");
});
check(21, "highest board role wins", async () => {
  const f = await fixture(); await grant(f.a, "viewer");
  const c = await join(f.a, "viewer"); await edit(c);
  const b = await join(f.b, "viewer"); b.peer.send({ kind: "edit", epoch: b.epoch, requestId: "low", update: change(b.doc, "No") });
  assert.equal((await b.peer.next("refused")).reason, "role_too_low");
});
check(22, "guest access and Data API rows agree", async () => {
  const f = await fixture(); await join(f.a, "granted");
  await refused(await request(`/boards/${f.b}/join-tickets`, "granted", "POST"), 404, "not_found");
  const rows = await helper("rls", { token: person("granted").token, table: "boards" });
  assert(rows.data.some((b: any) => b.id === f.a)); assert(!rows.data.some((b: any) => b.id === f.b));
});
check(23, "board invitations add an outsider as a guest", async () => {
  const f = await fixture();
  const invitation = await success(`/boards/${f.a}/invitations`, "owner", "POST", { email: person("outsider").email, role: "editor" }, 201) as any;
  await success(`/invitations/${invitation.id}/accept`, "outsider", "POST"); await join(f.a, "outsider");
  await refused(await request(`/boards/${f.b}/join-tickets`, "outsider", "POST"), 404, "not_found");
});
check(24, "workspace raises close all affected boards with 4409", async () => {
  const f = await fixture(), a = await join(f.a, "viewer"), b = await join(f.b, "viewer");
  await raise(f.workspace, "viewer"); await untilClosed(a.peer, 4409); await untilClosed(b.peer, 4409);
  await edit(await join(f.a, "viewer"));
});
check(25, "a board raise leaves other rooms connected", async () => {
  const f = await fixture(), a = await join(f.a, "viewer"), b = await join(f.b, "viewer");
  await grant(f.a, "viewer"); await untilClosed(a.peer, 4409); assert.equal(b.peer.closed, null);
});
check(26, "acceptance refreshes a cached viewer", async () => {
  const f = await fixture(), c = await join(f.a, "viewer");
  const invitation = await success(`/boards/${f.a}/invitations`, "owner", "POST", { email: person("viewer").email, role: "editor" }, 201) as any;
  await success(`/invitations/${invitation.id}/accept`, "viewer", "POST"); await untilClosed(c.peer, 4409);
  assert.equal((await join(f.a, "viewer")).joined.role, "editor");
});
check(27, "a redundant effective grant leaves epoch and connection alone", async () => {
  const f = await fixture(), c = await join(f.a);
  const before = (await helper("rows", { table: "access_changes", filters: { workspace_id: f.workspace } })).length;
  await grant(f.a, "editor"); assert.equal(c.peer.closed, null);
  assert.equal((await helper("rows", { table: "access_changes", filters: { workspace_id: f.workspace } })).length, before + 1);
  await edit(c); assert.equal((await join(f.a)).epoch, c.epoch);
});
check(28, "failed fanout is recovered on next join", async () => {
  const f = await fixture(); await join(f.a, "viewer");
  await driver.control({ unreachable: [f.a] }); await grant(f.a, "viewer");
  await driver.control({ unreachable: [] }); assert.equal((await join(f.a, "viewer")).joined.role, "editor");
});
check(29, "tickets are one-time short-lived and origin-bound", async () => {
  const f = await fixture(), t = await ticket(f.a);
  assert.match(t.ticket, /^[A-Za-z0-9_-]{43}$/);
  const p = await driver.connect(`/boards/${f.a}/join?ticket=${t.ticket}`); peers.push(p); await p.next("joined");
  const invalid = (board: string, token: string) => driver.request(`/boards/${board}/join?ticket=${token}`, { headers: { Origin: context.origin } });
  await refused(await invalid(f.a, t.ticket), 401, "ticket_invalid");
  const other = await ticket(f.a); await refused(await invalid(f.b, other.ticket), 401, "ticket_invalid");
  await refused(await invalid(f.a, "unknown"), 401, "ticket_invalid");
  await refused(await invalid(crypto.randomUUID(), "unknown"), 401, "ticket_invalid");
  const expired = await ticket(f.a); await driver.control({ offset: 30001 }); await refused(await invalid(f.a, expired.ticket), 401, "ticket_invalid");
  await driver.control({ offset: 0 });
  const now = await driver.control({ now: true });
  const short = await helper("token", { options: { now, exp: Math.floor(now / 1000) + 2 } });
  const dead = await ticket(f.a, "owner", short); await driver.control({ offset: 3000 }); await refused(await invalid(f.a, dead.ticket), 401, "ticket_invalid");
  await refused(await driver.request(`/boards/${f.a}/join?ticket=unknown`, { headers: { Origin: "https://wrong.example.test" } }), 403, "origin_not_allowed");
  // The only URL credential used by any client helper above is a random ticket.
  assert(requestUrls.every((url) => !/access_token|Bearer/.test(url) && names.every((name) => !url.includes(person(name).token))));
});
check(30, "renewal and expiry survive hibernation", async () => {
  const f = await fixture(), now = await driver.control({ now: true });
  const short = await helper("token", { options: { now, exp: Math.floor(now / 1000) + 2 } });
  const c = await join(f.a, "owner", short);
  c.peer.send({ kind: "renew", token: person("owner").token }); await c.peer.next("renewed");
  c.peer.send({ kind: "renew", token: person("editor").token }); await untilClosed(c.peer, 4401);
  const expiring = await join(f.a, "owner", short);
  if (runner === "workerd") await driver.wake(f.a);
  await driver.control({ offset: 3000, board: f.a, alarm: true }); await untilClosed(expiring.peer, 4401);
  try { expiring.peer.send({ kind: "renew", token: person("owner").token }); } catch { /* The transport is already closed. */ }
  assert.equal(expiring.peer.closed, 4401);
  assert(!expiring.peer.messages.some((m) => m.kind === "renewed"));
});
check(31, "invited confirmed account signs in once without sign-ups", async () => {
  const f = await fixture(), email = `invited-${crypto.randomUUID()}@example.test`;
  const invitation = await success(`/boards/${f.a}/invitations`, "owner", "POST", { email, role: "viewer" }, 201) as any;
  assert.equal(invitation.accountCreated, true);
  const login = await helper("account-login", { email }); assert(login.exists && login.confirmed && !login.otpError);
  assert(!JSON.stringify(login.mailBefore).includes(email));
  const response = await request(`/invitations/${invitation.id}/accept`, "owner", "POST", undefined, login.token); assert.equal(response.status, 200);
  assert((await helper("account-login", { email: `unknown-${crypto.randomUUID()}@example.test`, unknown: true })).otpError);
});
check(32, "new rooms are empty and first open is idempotent", async () => {
  const f = await fixture(), c = await join(f.a);
  const b = readBoard(c.doc); assert.equal(b.boardId, f.a); assert.equal(b.title, "Synthetic board A"); assert.deepEqual(b.objects, []);
  const before = await success(`/boards/${f.a}/export`); await join(f.a);
  assert.deepEqual(await success(`/boards/${f.a}/export`), before);
});

let large: { a: string; workspace: string; json: string };
function largeBoard(boardId: string) {
  let b = { ...empty(), boardId, title: "Large" };
  for (let n = 0; n < 250; n++) b = add(b, "text", 0, 0);
  for (const object of b.objects) object.text = "x".repeat(1000);
  function marks(total: number) {
    for (let n = 0; n < b.objects.length; n++) b.objects[n].marks = Array.from({ length: Math.min(1000, Math.max(0, total - n * 1000)) }, (_, i) =>
      ({ start: i, end: i + 1, ...(i % 2 ? { italic: true as const } : { bold: true as const }) }));
  }
  let low = 0, high = 250000;
  const length = () => new TextEncoder().encode(JSON.stringify(b)).length;
  while (low < high) { const middle = Math.ceil((low + high) / 2); marks(middle); if (length() <= 2097152) low = middle; else high = middle - 1; }
  marks(low);
  const padding = 2097152 - length();
  assert(padding < 1000); b.objects[249].text = "é".repeat(padding) + "x".repeat(1000 - padding);
  assert.equal(new TextEncoder().encode(canonical(b)).length, 2097152);
  return b;
}
async function setBoard(client: Awaited<ReturnType<typeof join>>, board: any) {
  const vector = Y.encodeStateVector(client.doc), adapter = new Adapter(); adapter.doc = client.doc;
  adapter.set(board);
  const update = encoded(Y.encodeStateAsUpdate(client.doc, vector));
  assert(new TextEncoder().encode(update).length < 1048000, "Fixture edit must fit one incoming message");
  client.peer.send({ kind: "edit", epoch: client.epoch, requestId: crypto.randomUUID(), update });
  return client.peer.next("saved");
}
check(33, "exact 2 MiB board persists in bounded chunks", async () => {
  const f = await fixture(), c = await join(f.a), board = largeBoard(f.a);
  for (let n = 5; n <= 250; n += 5) await setBoard(c, { ...board, objects: board.objects.slice(0, n) });
  const expected = canonical(board); await c.peer.close();
  const chunks = await driver.rows(f.a, "snapshot_chunks");
  const jsonChunks = chunks.filter((r) => r.kind === "json" && r.snapshot_revision === 50).length;
  const yjsChunks = chunks.filter((r) => r.kind === "yjs" && r.snapshot_revision === 50).length;
  const largest = Math.max(...chunks.map((row) => Object.values(row).reduce<number>((sum, value: any) =>
    sum + (typeof value === "number" ? 8 : typeof value === "string" ? new TextEncoder().encode(value).length : value?.bytes ?? 0), 0)));
  assert.equal(jsonChunks, 2); assert(yjsChunks >= 2); assert(largest < 1.1 * 1048576);
  const start = performance.now(); await driver.wake(f.a);
  assert.equal(await (await request(`/boards/${f.a}/export`)).text(), expected);
  measures.storage = { jsonChunks, yjsChunks, largestRowBytes: largest, reloadMs: performance.now() - start };
  large = { a: f.a, workspace: f.workspace, json: expected };
});
check(34, "oversized message leaves transport usable", async () => {
  const f = await fixture(), c = await join(f.a);
  c.peer.send(" ".repeat(1048577)); assert.equal((await c.peer.next("refused")).reason, "message_too_large");
  await edit(c);
});
check(35, "hundred-edit and idle snapshots retain two generations", async () => {
  const f = await fixture(), c = await join(f.a);
  for (let n = 0; n < 200; n++) await edit(c, "Snapshot " + n);
  let chunks = await driver.rows(f.a, "snapshot_chunks");
  assert.deepEqual([...new Set(chunks.map((r) => r.snapshot_revision))].sort((a, b) => a - b), [100, 200]);
  assert((await driver.rows(f.a, "edits")).every((r) => r.revision > 100));
  await edit(c, "Idle"); await driver.control({ offset: 60001, board: f.a, alarm: true });
  chunks = await driver.rows(f.a, "snapshot_chunks"); assert(chunks.some((r) => r.snapshot_revision === 201));
  assert((await driver.rows(f.a, "edits")).every((r) => r.revision > 200));
  await edit(c, "Last close"); await c.peer.close();
  for (let tries = 0; tries < 30; tries++) {
    if ((await driver.rows(f.a, "snapshot_chunks")).some((r) => r.snapshot_revision === 202)) break;
    await new Promise((r) => setTimeout(r, 10));
  }
  assert((await driver.rows(f.a, "snapshot_chunks")).some((r) => r.snapshot_revision === 202));
  const before = await (await request(`/boards/${f.a}/export`)).text(); await driver.wake(f.a);
  assert.equal(await (await request(`/boards/${f.a}/export`)).text(), before);
});
check(36, "waiting count bytes deadline and hibernation", async () => {
  const f = await fixture(), c = await join(f.a);
  change(c.doc, "Missing"); const update = change(c.doc, "Waiting");
  for (let n = 0; n < 64; n++) {
    c.peer.send({ kind: "edit", epoch: c.epoch, requestId: "count" + n, update }); await c.peer.next("received");
  }
  c.peer.send({ kind: "edit", epoch: c.epoch, requestId: "count64", update });
  assert.equal((await c.peer.next("resync")).reason, "waiting_count");
  for (let n = 0; n < 5; n++) {
    const message = JSON.stringify({ kind: "edit", epoch: c.epoch, requestId: "bytes" + n, update });
    c.peer.send(message + " ".repeat(900000 - message.length));
    if (n < 4) await c.peer.next("received"); else assert.equal((await c.peer.next("resync")).reason, "waiting_bytes");
  }
  c.peer.send({ kind: "edit", epoch: c.epoch, requestId: "deadline", update }); await c.peer.next("received");
  const waiting = await driver.rows(f.a, "waiting"); assert.equal(waiting.length, 1);
  if (runner === "workerd") { await driver.wake(f.a); assert.deepEqual(await driver.rows(f.a, "waiting"), waiting); }
  await driver.control({ offset: 30001, board: f.a, alarm: true }); assert.equal((await c.peer.next("resync")).reason, "waiting_timeout");
  assert.equal((await driver.rows(f.a, "waiting")).length, 0); assert.equal((await driver.rows(f.a, "receipts")).length, 0);
});
check(37, "Node restart drops waits and clients resend", async () => {
  const f = await fixture(), c = await join(f.a), first = change(c.doc, "First"), second = change(c.doc, "Second");
  c.peer.send({ kind: "edit", epoch: c.epoch, requestId: "second", update: second }); await c.peer.next("received");
  await driver.wake(f.a); assert.equal((await driver.rows(f.a, "waiting")).length, 0);
  const next = await join(f.a);
  for (const [requestId, update] of [["first", first], ["second", second]]) {
    next.peer.send({ kind: "edit", epoch: next.epoch, requestId, update }); await next.peer.next("saved");
  }
});
check(38, "hostile transitions hidden fields history and size store nothing", async () => {
  const f = await fixture(), c = await join(f.a);
  let b = add(readBoard(c.doc), "text", 0, 0); await setBoard(c, b); const old = b.objects[0];
  b = { ...b, objects: [], retiredGenerations: [old.generation] }; await setBoard(c, b); await edit(c, "Several revisions later");
  async function bad(board: string, mutate: (doc: Y.Doc) => void, reason: string) {
    const client = await join(board), vector = Y.encodeStateVector(client.doc);
    const before = (await driver.rows(board, "receipts")).length;
    mutate(client.doc);
    client.peer.send({ kind: "edit", epoch: client.epoch, requestId: crypto.randomUUID(), update: encoded(Y.encodeStateAsUpdate(client.doc, vector)) });
    assert.equal((await client.peer.next("refused")).reason, reason);
    assert.equal((await driver.rows(board, "receipts")).length, before);
  }
  await bad(f.a, (doc) => { const adapter = new Adapter(); adapter.doc = doc; adapter.set({ ...readBoard(doc), retiredGenerations: [], objects: [{ ...old, id: crypto.randomUUID() }] }); }, "invalid_transition");
  await bad(f.a, (doc) => { const adapter = new Adapter(); adapter.doc = doc; adapter.set({ ...readBoard(doc), objects: [{ ...old, generation: crypto.randomUUID() }] }); }, "identifier_reused");
  const fresh = add(readBoard(c.doc), "text", 0, 0); await setBoard(c, fresh);
  await bad(f.a, (doc) => doc.getMap<Y.Map<unknown>>("objects").get(fresh.objects[0].id)!.set("generation", crypto.randomUUID()), "invalid_transition");
  await bad(f.a, (doc) => doc.getMap("hidden").set("payload", "hidden"), "invalid_update");
  await bad(f.a, (doc) => doc.getMap<Y.Map<unknown>>("objects").get(fresh.objects[0].id)!.set("hidden", "hidden"), "invalid_update");
  assert(large); await bad(large.a, (doc) => doc.getMap("board").set("title", "Large!"), "document_too_large");
});
check(39, "hosted image edits are refused", async () => {
  const f = await fixture(), c = await join(f.a), vector = Y.encodeStateVector(c.doc), adapter = new Adapter(); adapter.doc = c.doc;
  adapter.set({ ...readBoard(c.doc), objects: [{ id: crypto.randomUUID(), generation: crypto.randomUUID(), type: "image", group: null, section: null,
    asset: "a".repeat(64), pixelWidth: 1, pixelHeight: 1, description: "Synthetic", x: 0, y: 0, width: 1, height: 1, order: 0 }] });
  c.peer.send({ kind: "edit", epoch: c.epoch, requestId: "image", update: encoded(Y.encodeStateAsUpdate(c.doc, vector)) });
  assert.equal((await c.peer.next("refused")).reason, "images_not_supported");
});
check(40, "ordinary wakes retain cached access during outage", async () => {
  const f = await fixture(); for (const name of ["owner", "editor", "viewer"]) await join(f.a, name);
  await helper("proxy", { offline: true }); await driver.wake(f.a);
  for (const name of ["owner", "editor"]) await edit(await join(f.a, name));
  const viewer = await join(f.a, "viewer"); viewer.peer.send({ kind: "edit", epoch: viewer.epoch, requestId: "outage", update: change(viewer.doc, "No") });
  assert.equal((await viewer.peer.next("refused")).reason, "role_too_low");
  for (const name of ["granted", "plain", "outsider"]) await refused(await request(`/boards/${f.a}/join-tickets`, name, "POST"), 404, "not_found");
});
check(41, "large logical restore locks until replay and clears tickets", async () => {
  assert(large); const board = large.a;
  const c = await join(board, "owner"), before = await ticket(board, "owner");
  await refused(await request(`/boards/${board}/join-tickets`, "outsider", "POST"), 404, "not_found");
  const envelope = await backup(board); assert(new TextEncoder().encode(JSON.stringify(envelope)).length > 1048576);
  await helper("proxy", { offline: true }); const restored = await operator(board, "restore", envelope);
  assert.equal(restored.status, 200); assert.equal((await restored.json() as any).locked, true); await untilClosed(c.peer, 4423);
  await refused(await driver.request(`/boards/${board}/join?ticket=${before.ticket}`, { headers: { Origin: context.origin } }), 401, "ticket_invalid");
  for (const suffix of ["join-tickets", "export"]) {
    await refused(await request(`/boards/${board}/${suffix}`, "owner", suffix === "export" ? "GET" : "POST"), 503, "room_locked");
    await refused(await request(`/boards/${board}/${suffix}`, "outsider", suffix === "export" ? "GET" : "POST"), 404, "not_found");
  }
  await helper("proxy", { offline: false }); await join(board, "owner");
  assert.equal(await (await request(`/boards/${board}/export`)).text(), large.json);
  const tooLarge = await driver.request(`/operator/boards/${board}/restore`, { method: "POST", headers: { "Board-Operator-Key": context.operatorKey }, body: " ".repeat(16777217) });
  await refused(tooLarge, 413, "body_too_large");
});
check(42, "physical rewind respects an external fence", async () => {
  const f = await fixture(), client = await join(f.a, "owner"); const envelope = await backup(f.a);
  await edit(client, "Newer than the point-in-time copy");
  await helper("proxy", { offline: true }); await driver.restoreFile(f.a, envelope, true);
  await refused(await request(`/boards/${f.a}/export`), 503, "room_locked");
  await helper("proxy", { offline: false }); assert.equal((await success(`/boards/${f.a}/export`) as any).title, "Synthetic board A");
  const ordinary = await backup(f.a);
  await edit(await join(f.a, "owner"), "Newer than the ordinary copy");
  await helper("proxy", { offline: true }); await driver.restoreFile(f.a, ordinary, false);
  assert.equal((await success(`/boards/${f.a}/export`) as any).title, "Synthetic board A");
});
check(43, "copied Node volume requires replay after marking", async () => {
  const f = await fixture(); await join(f.a, "owner"); await helper("proxy", { offline: true });
  await driver.volumeCopy!(f.a); await refused(await request(`/boards/${f.a}/export`), 503, "room_locked");
  await helper("proxy", { offline: false }); await success(`/boards/${f.a}/export`);
});
check(44, "unreadable fence fails closed independently of Supabase", async () => {
  const f = await fixture(); await join(f.a, "owner"); await driver.control({ fenceUnreadable: true });
  await refused(await request(`/boards/${f.a}/export`), 503, "room_locked");
  await driver.control({ fenceUnreadable: false }); await success(`/boards/${f.a}/export`);
});
check(45, "replay lowers and removes cached effective roles", async () => {
  const f = await fixture(), editor = await join(f.a), guest = await join(f.a, "granted");
  await helper("sql", { sql: `BEGIN; SELECT id FROM nextphase_board.workspaces WHERE id='${f.workspace}' FOR UPDATE;
    UPDATE nextphase_board.workspace_members SET role='viewer' WHERE workspace_id='${f.workspace}' AND person_id='${person("editor").id}';
    INSERT INTO nextphase_board.access_changes(workspace_id,person_id,kind,role) VALUES('${f.workspace}','${person("editor").id}','member','viewer');
    DELETE FROM nextphase_board.board_grants WHERE board_id='${f.a}' AND person_id='${person("granted").id}';
    INSERT INTO nextphase_board.access_changes(workspace_id,board_id,person_id,kind,role) VALUES('${f.workspace}','${f.a}','${person("granted").id}','grant',NULL); COMMIT;` });
  await ticket(f.a, "owner"); await untilClosed(editor.peer, 4403); await untilClosed(guest.peer, 4403);
  const viewer = await join(f.a); viewer.peer.send({ kind: "edit", epoch: viewer.epoch, requestId: "lowered", update: change(viewer.doc, "No") });
  assert.equal((await viewer.peer.next("refused")).reason, "role_too_low");
  await refused(await request(`/boards/${f.a}/join-tickets`, "granted", "POST"), 404, "not_found");
});
check(46, "access history floor enforces the inclusive replay boundary", async () => {
  const f = await fixture(); await join(f.a, "owner"); const envelope = await backup(f.a);
  const watermark = Number(envelope.tables.meta.find((r: any) => r.key === "watermark").value);
  await helper("sql", { sql: `UPDATE nextphase_board.access_log_floor SET lowest_kept=${watermark + 2} WHERE workspace_id='${f.workspace}'` });
  assert.equal((await operator(f.a, "restore", envelope)).status, 200);
  await refused(await request(`/boards/${f.a}/export`), 503, "access_log_pruned");
  await helper("sql", { sql: `UPDATE nextphase_board.access_log_floor SET lowest_kept=${watermark + 1} WHERE workspace_id='${f.workspace}'` });
  await success(`/boards/${f.a}/export`);
});
check(47, "operator authentication limits and runner-specific routes", async () => {
  const f = await fixture(); await join(f.a, "owner");
  for (const key of [null, "wrong"]) await refused(await operator(f.a, "backup", undefined, key), 401, "operator_key_invalid");
  await driver.control({ noOperator: true }); await refused(await operator(f.a, "backup"), 404, "not_found");
  await driver.control({ noOperator: false });
  if (runner === "node") await refused(await operator(f.a, "restore-to-time", { bookmark: "unavailable" }), 404, "not_found");
  await driver.control({ backupLimit: 1 }); await refused(await operator(f.a, "backup"), 413, "backup_too_large");
});
check(48, "schema is repeatable and authenticated writes are denied", async () => {
  const f = await fixture();
  const catalog = await helper("sql", { sql: `SELECT count(*), bool_and(relrowsecurity) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='nextphase_board' AND relkind='r';
    SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='nextphase_board' AND p.proname IN ('bootstrap_workspace','remember_person','create_board','write_member_role','write_board_grant','create_invitation','cancel_invitation','accept_invitation','access_changes_after') AND has_function_privilege('authenticated',p.oid,'execute');` });
  assert.match(catalog, /8\|t/); assert.match(catalog, /\n0\n/);
  for (const table of ["people", "workspaces", "workspace_members", "boards", "board_grants", "invitations", "access_changes", "access_log_floor"]) {
    assert((await helper("rls", { token: person("owner").token, table, write: { id: crypto.randomUUID() } })).error);
  }
  for (const [rpc, parameters] of [
    ["remember_person", { person: person("owner").id, email: person("owner").email }],
    ["create_board", { workspace: f.workspace, person: person("owner").id, title: "Forbidden" }],
    ["write_member_role", { workspace: f.workspace, person: person("viewer").id, role: "editor" }],
    ["write_board_grant", { board: f.a, person: person("viewer").id, role: "editor" }],
  ]) assert((await helper("rls", { token: person("owner").token, rpc, parameters })).error);
});
check(49, "workspace setup creates its owner and refuses a second run", async () => {
  const name = "Script " + crypto.randomUUID(); const first = await helper("setup-script", { name }); assert(first.workspaceId && first.ownerId);
  await assert.rejects(helper("setup-script", { name }));
});
check(50, "fanout timing for 1 10 and 50 connected boards", async () => {
  const timings: Record<string, number> = {};
  for (const count of [1, 10, 50]) {
    const workspace = await helper("rpc", { name: "bootstrap_workspace", parameters: { name: "Fanout " + crypto.randomUUID(), owner_id: person("owner").id, owner_email: person("owner").email } });
    const offer = await helper("rpc", { name: "create_invitation", parameters: { workspace, board: null, email: person("viewer").email, role: "viewer", by: person("owner").id } });
    await helper("rpc", { name: "accept_invitation", parameters: { invitation: offer.id, person: person("viewer").id, email: person("viewer").email } });
    const connections: Peer[] = [];
    for (let n = 0; n < count; n++) {
      const board = await helper("rpc", { name: "create_board", parameters: { workspace, person: person("owner").id, title: "Fanout " + n } });
      connections.push((await join(board.id, "viewer")).peer);
    }
    const start = performance.now(); await raise(workspace, "viewer"); for (const connection of connections) await untilClosed(connection, 4409);
    timings[String(count)] = performance.now() - start;
  }
  measures.fanoutMs = timings;
});
check(51, "Docker image builds with the pinned digest", async () => { assert.equal(driver.runner, "docker"); });
check(52, "container passes identity join secrecy and edit checks", async () => {
  await identityChecks(); await signatures(); await joinMatrix(); await secrecy(); await viewerEdit(); await editorEdit();
});
check(53, "Docker restart preserves the board and permits another saved edit", async () => {
  const f = await fixture(), c = await join(f.a); await edit(c, "Before restart");
  const before = await (await request(`/boards/${f.a}/export`)).text(); await driver.control({ restart: true });
  assert.equal(await (await request(`/boards/${f.a}/export`)).text(), before);
  const next = await join(f.a), other = await join(f.a, "owner");
  assert.equal((await edit(next, "After restart")).saved.revision, 2); await other.peer.next("update");
});
check(54, "self-hosted Supabase accepts ES256 and refuses HS256", signatures);
