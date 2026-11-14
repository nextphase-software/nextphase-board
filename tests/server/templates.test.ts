// SPDX-License-Identifier: Apache-2.0
import { test, beforeAll, afterAll, afterEach, inject } from "vitest";
import assert from "node:assert/strict";
import { makeDriver } from "board-test-driver";
import { add, empty } from "../../packages/board-rules/src/document.ts";
import { labelOf } from "../../packages/board-room/src/tickets.ts";
import { groupObjects } from "../../apps/web/src/group.ts";
import { createConnector } from "../../apps/web/src/connectors.ts";
import { assignSection } from "../../apps/web/src/sections.ts";
import type { Context, Driver, Peer } from "./driver-types.ts";
const context = inject<Context>("board"), runner = inject<string>("runner");
let driver: Driver, f: any, pass = 0, fail = 0;
const peers: Peer[] = [], functions = ["list_templates", "get_template", "save_template", "update_template_details", "replace_template", "delete_template"];
beforeAll(async () => { driver = await makeDriver(context); });
afterEach(async () => {
  for (const peer of peers.splice(0)) await peer.close();
  for (const rpc of functions) await helper("proxy", { rpc, fail: false });
  await helper("sql", { sql: `UPDATE nextphase_board.people SET disabled=false WHERE id='${context.people.editor.id}'` });
});
afterAll(async () => { await driver.close(); console.log("SUMMARY-TEMPLATES " + JSON.stringify({ runner, checks: pass + fail, pass, fail, unproved: ["S389 source-board-viewer subcase: workspace editor inherits editor on same-workspace boards"] })); });
async function helper(action: string, value: unknown = {}): Promise<any> {
  const r = await fetch(context.helperUrl + "/" + action, { method: "POST", body: JSON.stringify(value) });
  const v = await r.json(); assert(r.ok, JSON.stringify(v)); return v;
}
const rpc = (name: string, parameters: unknown) => helper("rpc", { name, parameters });
const sql = (sql: string) => helper("sql", { sql });
const rows = () => helper("rows", { table: "templates", filters: { workspace_id: f.workspace } });
const path = (id = "") => `/workspaces/${f.workspace}/templates${id ? "/" + id : ""}`;
async function req(url = path(), who = "owner", method = "GET", value?: unknown, origin = context.origin) {
  return driver.request(url, { method, headers: { Authorization: "Bearer " + f.people[who].token, Origin: origin, "Content-Type": "application/json" },
    ...(value === undefined ? {} : { body: JSON.stringify(value) }) });
}
async function ok(url = path(), who = "owner", method = "GET", value?: unknown, status = 200): Promise<any> {
  const r = await req(url, who, method, value); assert.equal(r.status, status, await r.clone().text());
  return status === 204 ? undefined : r.json();
}
async function refused(url: string, who: string, method: string, value: unknown, status: number, reason: string, needed?: string) {
  const r = await req(url, who, method, value); assert.equal(r.status, status, await r.clone().text());
  assert.deepEqual(await r.json(), { error: { reason, ...(needed ? { needed } : {}) } });
}
function content(full = false): any[] {
  let b = add({ ...empty(), title: "Template" }, full ? "section" : "sticky", 0, 0);
  if (full) {
    b = add(add(b, "sticky", 20, 20), "sticky", 300, 20);
    const [section, a, c] = b.objects;
    b = assignSection(b, new Set([a.id, c.id]), section.id); b = groupObjects(b, new Set([a.id, c.id]));
    b = createConnector(b, a.id, c.id).board;
  }
  return b.objects.map(({ generation, order, ...o }) => o);
}
const body = (objects = content(), name = "Sprint kickoff") => ({ name, description: "Goals and owners.", sourceBoard: f.a, objects });
const save = (who = "owner", value = body()) => ok(path(), who, "POST", value, 201);
function exact(t: any) {
  assert.deepEqual(Object.keys(t).sort(), ["id", "name", "description", "creatorLabel", "sourceTitle", "objectCount", "createdAt", "updatedAt", "canManage", "objects"].sort());
  for (const key of ["createdAt", "updatedAt"]) assert.match(t[key], /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/);
}
async function allRefused(who: string, template: string, status: number, needed?: string) {
  const reason = status === 404 ? "not_found" : "role_too_low";
  for (const [url, method, value] of [[path(), "GET"], [path(template), "GET"], [path(), "POST", body()], [path(template), "PATCH", { name: "Changed", description: "" }], [path(template), "DELETE"]] as const) {
    await refused(url, who, method, value, status, reason, needed);
  }
}
const check = (id: number, name: string, run: () => Promise<void>) => test(`S${id} ${name}`, async () => {
  try {
    await import("../../apps/server/src/templates.ts");
    f = { ...await helper("fixture"), people: structuredClone(context.people) };
    await run(); pass++; console.log(`PASS: S${id} ${name}`);
  } catch (error) { fail++; console.log(`FAIL: S${id} ${name}`); throw error; }
});
check(378, "list exact keys roles and newest updatedAt then id", async () => {
  const a = await save(), b = await save("editor", body(content(), "Weekly check-in"));
  for (const [who, canSave] of [["owner", true], ["editor", true], ["viewer", false]] as const) {
    const v = await ok(path(), who); assert.deepEqual(Object.keys(v).sort(), ["canSave", "limit", "templates"]);
    assert.equal(v.limit, 25); assert.equal(v.canSave, canSave); v.templates.forEach(exact);
    assert.deepEqual(v.templates.map((t: any) => t.id), [b.id, a.id]);
  }
  await sql(`UPDATE nextphase_board.templates SET updated_at='2026-11-14T12:00:00Z' WHERE workspace_id='${f.workspace}'`);
  assert.deepEqual((await ok()).templates.map((t: any) => t.id), [a.id, b.id].sort());
});
check(379, "guests with and without grants and outsiders refused on all routes", async () => {
  const t = await save(), before = await rows();
  for (const who of ["granted", "plain"]) await allRefused(who, t.id, 403, "viewer");
  await allRefused("outsider", t.id, 404); assert.deepEqual(await rows(), before);
});
check(380, "owner and editor save attribution counts source and first position", async () => {
  for (const who of ["owner", "editor"]) {
    const value = body(content(true)), t = await save(who, value); exact(t);
    const row = (await rows()).find((r: any) => r.id === t.id);
    assert.equal(row.creator_label, labelOf(f.people[who].email)); assert.equal(t.creatorLabel, row.creator_label);
    assert.equal(row.source_title, "Synthetic board A"); assert.equal(row.source_board_id, f.a);
    assert.equal(row.object_count, value.objects.length); assert.equal(row.content_bytes, new TextEncoder().encode(JSON.stringify(value.objects)).length);
    assert.equal((await ok()).templates[0].id, t.id); assert.deepEqual(t.objects, value.objects);
  }
});
check(381, "source and save rights refusals store no row", async () => {
  await refused(path(), "viewer", "POST", body(), 403, "role_too_low", "editor");
  const other = await helper("fixture");
  for (const sourceBoard of [other.a, crypto.randomUUID()]) await refused(path(), "owner", "POST", { ...body(), sourceBoard }, 404, "not_found");
  await ok(`/boards/${f.b}/trash`, "owner", "POST", { requestId: crypto.randomUUID(), expectedCycle: 0 });
  await refused(path(), "owner", "POST", { ...body(), sourceBoard: f.b }, 404, "not_found");
  await refused(path(), "owner", "POST", { ...body(), sourceBoard: "not-a-uuid" }, 400, "bad_request"); assert.equal((await rows()).length, 0);
});
check(382, "exact request shapes text types Unicode and code point limits", async () => {
  const v = body(); const { name: _name, ...missing } = v;
  const values = [missing, { ...v, extra: 1 }, { ...missing, Name: "Name" }, { ...v, name: 1 }, { ...v, description: 1 },
    ...["", " \n", "a".repeat(121), "\ud800", "x\u0000"].map(name => ({ ...v, name })),
    ...["a".repeat(301), "\udfff", "x\u0000"].map(description => ({ ...v, description })), { ...v, objects: {} }];
  for (const value of values) await refused(path(), "owner", "POST", value, 400, "bad_request");
  assert.equal((await rows()).length, 0); assert.equal((await save("owner", { ...v, name: "😀".repeat(120) })).name, "😀".repeat(120));
});
check(383, "object validation rejects unsupported sets and preserves section group connector", async () => {
  const v = content(), o = v[0];
  for (const objects of [[], Array(251).fill(o), [{ ...o, type: "image" }], [o, o], [{ ...o, generation: crypto.randomUUID() }],
    [{ ...o, order: 0 }], [{ ...o, type: "unknown" }], [{ ...o, width: -1 }], [{ ...o, text: "\u0000" }]]) {
    await refused(path(), "owner", "POST", body(objects), 400, "bad_request");
  }
  const full = content(true), t = await save("owner", body(full)); assert.deepEqual(t.objects, full);
});
function sized(bytes: number) {
  const values = Array.from({ length: 250 }, () => content()[0]); let remaining = bytes - new TextEncoder().encode(JSON.stringify(values)).length;
  for (const o of values) { const n = Math.min(1000, remaining); o.text = "x".repeat(n); remaining -= n; }
  assert.equal(remaining, 0); assert.equal(new TextEncoder().encode(JSON.stringify(values)).length, bytes); return values;
}
check(384, "compact JSON byte boundaries and default request limit", async () => {
  await save("owner", body(sized(262144)));
  await refused(path(), "owner", "POST", body(sized(262145)), 413, "template_too_large");
  const r = await driver.request(path(), { method: "POST", headers: { Authorization: "Bearer " + f.people.owner.token }, body: " ".repeat(1048577) });
  assert.equal(r.status, 413); assert.deepEqual(await r.json(), { error: { reason: "body_too_large" } }); assert.equal((await rows()).length, 1);
});
check(385, "25 cap and concurrent inserts under workspace lock", async () => {
  for (let i = 0; i < 24; i++) await save(); await save();
  await refused(path(), "owner", "POST", body(), 409, "template_limit");
  const list = (await ok()).templates; await ok(path(list[0].id), "owner", "DELETE", undefined, 204); await ok(path(list[1].id), "owner", "DELETE", undefined, 204);
  const replies = await Promise.all(Array.from({ length: 5 }, () => req(path(), "owner", "POST", body())));
  assert.equal(replies.filter(r => r.status === 201).length, 2); assert.equal(replies.filter(r => r.status === 409).length, 3); assert.equal((await rows()).length, 25);
});
check(386, "get exact shape and path ids never disclose other workspace", async () => {
  const t = await save(); assert.deepEqual(await ok(path(t.id)), t);
  const own = f.workspace, other = await helper("fixture"); f.workspace = other.workspace;
  await refused(path(t.id), "owner", "GET", undefined, 404, "not_found"); f.workspace = own;
  for (const id of [crypto.randomUUID(), "unknown"]) await refused(path(id), "owner", "GET", undefined, 404, "not_found");
});
check(387, "creator edits details only with later update and first order", async () => {
  const t = await save("editor"); await save(); const updated = await ok(path(t.id), "editor", "PATCH", { name: "Updated", description: "New details" });
  const { name: _a, description: _b, updatedAt: _c, ...old } = t, { name: n, description: d, updatedAt: at, ...kept } = updated;
  assert.deepEqual(kept, old); assert.equal(n, "Updated"); assert.equal(d, "New details"); assert(at > t.updatedAt); assert.equal((await ok()).templates[0].id, t.id);
});
check(388, "replace changes content and source while preserving details and creator", async () => {
  const t = await save("editor"), objects = content(true), updated = await ok(path(t.id), "editor", "PATCH", { sourceBoard: f.b, objects });
  assert.deepEqual(updated.objects, objects); assert.equal(updated.objectCount, objects.length); assert.equal(updated.sourceTitle, "Synthetic board B");
  for (const k of ["name", "description", "creatorLabel", "createdAt", "id"]) assert.equal(updated[k], t[k]);
  assert.equal((await rows())[0].source_board_id, f.b);
});
check(389, "manage rights current owner editor creator and lowered creator", async () => {
  const t = await save("editor");
  await rpc("write_member_role", { workspace: f.workspace, person: f.people.viewer.id, role: "editor" });
  for (const who of ["viewer", "editor"]) {
    if (who === "editor") await rpc("write_member_role", { workspace: f.workspace, person: f.people.editor.id, role: "viewer" });
    for (const [method, value] of [["PATCH", { name: "Other", description: "" }], ["PATCH", { sourceBoard: f.a, objects: content() }], ["DELETE", undefined]] as const) {
      await refused(path(t.id), who, method, value, 403, "role_too_low", "owner");
    }
  }
  await ok(path(t.id), "owner", "PATCH", { name: "Owner edit", description: "" });
  await ok(path(t.id), "owner", "PATCH", { sourceBoard: f.a, objects: content() });
  await ok(path(t.id), "owner", "DELETE", undefined, 204);
  // A viewer of a workspace can retain an editor grant on one source board.
  await rpc("write_board_grant", { board: f.a, person: f.people.editor.id, role: "editor" });
  await refused(path(), "editor", "POST", body(), 403, "role_too_low", "editor");
  await rpc("write_member_role", { workspace: f.workspace, person: f.people.editor.id, role: "editor" });
  await rpc("write_board_grant", { board: f.a, person: f.people.editor.id, role: "viewer" });
  assert.equal(await rpc("board_role", { person: f.people.editor.id, board: f.a }), "editor");
  console.log("UNPROVED: S389 creator with viewer source-board role is unreachable under inherited workspace editor rights; defensive database guard retained");
});
check(390, "delete empty response removes row and frees one slot", async () => {
  for (let i = 0; i < 25; i++) await save(); const t = (await ok()).templates[0];
  const r = await req(path(t.id), "owner", "DELETE"); assert.equal(r.status, 204); assert.equal(await r.text(), "");
  await refused(path(t.id), "owner", "GET", undefined, 404, "not_found"); assert(!(await ok()).templates.some((v: any) => v.id === t.id)); await save(); assert.equal((await rows()).length, 25);
});
check(391, "PATCH exact alternatives refuse mixed missing and extra keys unchanged", async () => {
  const t = await save(), before = await rows();
  for (const value of [{ name: "Name", objects: content() }, {}, { name: "Name" }, { name: "Name", description: "", extra: 1 }, { sourceBoard: f.a, objects: content(), extra: 1 }]) {
    await refused(path(t.id), "owner", "PATCH", value, 400, "bad_request");
  }
  assert.deepEqual(await rows(), before);
});
check(392, "member removal immediately refuses every next request and retains attribution", async () => {
  const t = await save("editor"), removed = await ok(`/workspaces/${f.workspace}/members/${f.people.editor.id}`, "owner", "DELETE"); assert.equal(removed.removal, "done");
  await allRefused("editor", t.id, 404);
  assert.equal((await ok(path(t.id))).creatorLabel, t.creatorLabel); await ok(path(t.id), "owner", "PATCH", { name: "Kept", description: "" });
  await rpc("write_member_role", { workspace: f.workspace, person: f.people.granted.id, role: "editor" });
  const g = await save("granted"); assert.equal((await ok(`/workspaces/${f.workspace}/members/${f.people.granted.id}`, "owner", "DELETE")).removal, "done");
  await allRefused("granted", g.id, 403, "viewer"); await ok(path(g.id), "owner", "DELETE", undefined, 204); await ok(path(t.id), "owner", "DELETE", undefined, 204);
});
check(393, "lowering editor to viewer and guest applies on next request", async () => {
  const t = await save("editor"); await ok(`/workspaces/${f.workspace}/members/${f.people.editor.id}`, "owner", "PUT", { role: "viewer" });
  assert.equal((await ok(path(), "editor")).canSave, false);
  await refused(path(), "editor", "POST", body(), 403, "role_too_low", "editor");
  await refused(path(t.id), "editor", "PATCH", { name: "Denied", description: "" }, 403, "role_too_low", "owner");
  await refused(path(t.id), "editor", "DELETE", undefined, 403, "role_too_low", "owner");
  await ok(`/workspaces/${f.workspace}/members/${f.people.editor.id}`, "owner", "PUT", { role: "guest" });
  await refused(path(), "editor", "GET", undefined, 403, "role_too_low", "viewer");
});
check(394, "disabled member receives not_found on every route", async () => {
  const t = await save("editor"); await sql(`UPDATE nextphase_board.people SET disabled=true WHERE id='${f.people.editor.id}'`);
  const before = await rows(); await allRefused("editor", t.id, 404); assert.deepEqual(await rows(), before);
});
async function join() {
  const ticket = await ok(`/boards/${f.a}/join-tickets`, "owner", "POST", undefined, 201);
  const peer = await driver.connect(`/boards/${f.a}/join?ticket=${ticket.ticket}`); peers.push(peer); return { peer, joined: await peer.next("joined") };
}
async function backup() {
  const r = await driver.request(`/operator/boards/${f.a}/backup`, { method: "POST", headers: { "Board-Operator-Key": context.operatorKey } }); assert.equal(r.status, 200); return r.json() as Promise<any>;
}
check(395, "library mutations leave source document revision history and room inventory unchanged", async () => {
  const { peer } = await join(); await ok(`/boards/${f.a}/versions`);
  const before = { export: await ok(`/boards/${f.a}/export`), backup: await backup(),
    board: await helper("rows", { table: "boards", filters: { id: f.a } }), versions: await ok(`/boards/${f.a}/versions`) };
  await driver.control({ board: f.a, settled: true }); const frames = peer.messages.length;
  const t = await save(); await ok(path(t.id), "owner", "PATCH", { name: "Updated", description: "" });
  await ok(path(t.id), "owner", "PATCH", { sourceBoard: f.a, objects: content(true) }); await ok(path(t.id), "owner", "DELETE", undefined, 204);
  await driver.control({ board: f.a, settled: true }); assert.equal(peer.messages.length, frames);
  assert.deepEqual({ export: await ok(`/boards/${f.a}/export`), backup: await backup(),
    board: await helper("rows", { table: "boards", filters: { id: f.a } }), versions: await ok(`/boards/${f.a}/versions`) }, before);
});
check(396, "tickets joined and room snapshots never carry template data", async () => {
  const t = await save(), { joined } = await join(); assert(!JSON.stringify(joined).includes(t.id)); assert(!JSON.stringify(joined).includes('"template'));
  const ticket = await ok(`/boards/${f.a}/join-tickets`, "owner", "POST", undefined, 201); assert.deepEqual(Object.keys(ticket).sort(), ["expiresAt", "ticket"]);
  const envelope = await backup(); assert(!JSON.stringify(envelope).includes(t.id)); assert(!Object.keys(envelope.tables).some(k => /template/i.test(k)));
});
check(397, "17 service tables RLS and six service-only fixed-path functions", async () => {
  await save(); assert.equal(String(await sql("SELECT count(*) FROM pg_tables WHERE schemaname='nextphase_board'")).trim(), "17");
  assert.equal(String(await sql("SELECT relrowsecurity FROM pg_class WHERE oid='nextphase_board.templates'::regclass")).trim(), "t");
  const r = await helper("rls", { token: f.people.owner.token, table: "templates" }); assert(r.error || r.data.length === 0);
  assert((await helper("rls", { token: f.people.owner.token, table: "templates", write: { id: crypto.randomUUID() } })).error);
  const inventory = await sql(`SELECT count(*),bool_and(prosecdef AND proconfig @> ARRAY['search_path=""']) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='nextphase_board' AND proname IN (${functions.map(n => "'" + n + "'").join(",")});
    SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='nextphase_board' AND proname IN (${functions.map(n => "'" + n + "'").join(",")}) AND (has_function_privilege('anon',p.oid,'execute') OR has_function_privilege('authenticated',p.oid,'execute'));`);
  assert.match(String(inventory), /6\|t/); assert.match(String(inventory), /\n0\n/);
});
check(398, "schema reapplication preserves every existing template", async () => {
  await save(); const before = await rows(); await helper("template-schema"); assert.deepEqual(await rows(), before); assert.equal((await ok()).templates.length, 1);
});
check(399, "induced templates database failure maps to 503 and stores nothing", async () => {
  await helper("proxy", { rpc: "save_template", fail: true });
  await refused(path(), "owner", "POST", body(), 503, "service_unavailable"); assert.equal((await rows()).length, 0);
});
check(400, "allowed CORS headers on five routes and PATCH DELETE preflight", async () => {
  const t = await save();
  for (const [url, method, value] of [[path(), "GET"], [path(t.id), "GET"], [path(), "POST", body()], [path(t.id), "PATCH", { name: "New", description: "" }], [path(t.id), "DELETE"]] as const) {
    const r = await req(url, "owner", method, value); assert.equal(r.headers.get("Access-Control-Allow-Origin"), context.origin); assert.equal(r.headers.get("Vary"), "Origin");
  }
  const r = await req(path(), "owner", "OPTIONS"); assert.equal(r.status, 204); assert.match(r.headers.get("Access-Control-Allow-Methods")!, /PATCH, DELETE/);
  const other = await req(path(), "owner", "GET", undefined, "http://other.example.test"); assert.equal(other.headers.get("Access-Control-Allow-Origin"), null);
});
check(401, "non ASCII participant label and millisecond UTC timestamps", async () => {
  const person = { ...f.people.editor, email: "élise@example.test" };
  f.people.editor.token = await helper("token", { person });
  const t = await save("editor"); exact(t); assert.equal(t.creatorLabel, labelOf(person.email)); assert.equal(t.creatorLabel, "élise");
});
