// SPDX-License-Identifier: Apache-2.0
import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { add, empty as emptyBoard, validate } from "../packages/board-rules/src/document.ts";
import { buildSnapshot } from "../apps/web/src/clipboard.ts";
import { insertActivity } from "../apps/web/src/activities.ts";
import { groupObjects } from "../apps/web/src/group.ts";
import { createConnector } from "../apps/web/src/connectors.ts";
import { assignSection } from "../apps/web/src/sections.ts";
const empty = () => ({ ...emptyBoard(), title: "Synthetic templates" });
const rules = () => import("../apps/web/src/team/templates-rules.ts");
const server = () => import("../apps/server/src/templates.ts");
function fixture() {
  let board = add(empty(), "section", 0, 0);
  board = add(add(board, "sticky", 20, 20), "sticky", 300, 20);
  const [section, a, b] = board.objects;
  board = assignSection(board, new Set([a.id, b.id]), section.id);
  board = groupObjects(board, new Set([a.id, b.id]));
  board = createConnector(board, a.id, b.id).board;
  return board;
}
const drawn = board => board.objects.map(o => ({ ...o, displayHeight: o.height ?? 0, x: o.x ?? 0, y: o.y ?? 0, width: o.width ?? 0 }));
const objects = board => buildSnapshot(board, new Set(board.objects.map(o => o.id)), drawn(board)).objects;
function sized(bytes) {
  let board = empty(); for (let i = 0; i < 250; i++) board = add(board, "text", i * 10, 0);
  const value = objects(board); let remaining = bytes - Buffer.byteLength(JSON.stringify(value));
  for (const o of value) { const n = Math.min(1000 - o.text.length, remaining); o.text += "x".repeat(n); remaining -= n; }
  assert.equal(remaining, 0); assert.equal(Buffer.byteLength(JSON.stringify(value)), bytes); return value;
}
function response(value = objects(add(empty(), "sticky", 0, 0))) {
  return { id: randomUUID(), name: "Sprint kickoff", description: "Example description", creatorLabel: "ana", sourceTitle: "Team board",
    objectCount: value.length, createdAt: "2026-11-14T12:00:00.000Z", updatedAt: "2026-11-14T12:00:00.000Z", canManage: true, objects: value };
}
const unit = (id, name, run) => test(`T8-U${id} ${name}`, run);
unit(1, "selection and whole board use Copy snapshots with normalized sections and groups", async () => {
  const r = await rules(), board = fixture(), a = board.objects.find(o => o.type === "sticky");
  const one = r.templateSnapshot(board, new Set([a.id]), drawn(board));
  assert.equal(one.selected, true); assert.equal(one.snapshot.objects.length, 1);
  assert.equal(one.snapshot.objects[0].section, null); assert.equal(one.snapshot.objects[0].group, null);
  const whole = r.templateSnapshot(board, new Set(), drawn(board));
  assert.equal(whole.selected, false); assert.deepEqual(whole.snapshot.objects, objects(board));
  assert(whole.snapshot.objects.every(o => !Object.hasOwn(o, "order") && !Object.hasOwn(o, "generation")));
  assert.deepEqual(r.templateSnapshot(empty(), new Set(), []).snapshot, null);
});
unit(2, "both validators wrap document 10 and preserve stored objects", async () => {
  const r = await rules(), s = await server(), value = objects(fixture()), before = structuredClone(value);
  assert.equal(r.templateBoard(value).schemaVersion, 13); validate(r.templateBoard(value));
  assert.deepEqual(s.templateObjects(value).objects, value); assert.deepEqual(value, before);
  assert.equal(s.templateObjects(value).objectCount, value.length);
});
unit(3, "both validators refuse counts images identities fields ends and NUL", async () => {
  const r = await rules(), s = await server(), base = objects(add(empty(), "sticky", 0, 0));
  const bad = [[], Array(251).fill(base[0]), null, {}, [null], [...base, base[0]],
    [{ ...base[0], type: "image" }], [{ ...base[0], generation: randomUUID() }], [{ ...base[0], order: 0 }],
    [{ ...base[0], type: "unknown" }], [{ ...base[0], width: -1 }], [{ ...base[0], text: "x\u0000" }],
    [{ ...base[0], text: "\ud800" }], [{ ...base[0], extra: 1 }], [{ ...base[0], section: randomUUID() }]];
  for (const value of bad) { assert.throws(() => r.templateBoard(value)); assert.throws(() => s.templateObjects(value), e => e.status === 400); }
  const many = Array.from({ length: 250 }, () => ({ ...base[0], id: randomUUID() }));
  assert.equal(r.templateBoard(many).objects.length, 250); assert.equal(s.templateObjects(many).objectCount, 250);
});
unit(4, "compact UTF-8 content accepts 262144 and refuses 262145 bytes", async () => {
  const r = await rules(), s = await server();
  assert.equal(r.contentBytes(sized(262144)), 262144); assert.equal(s.templateObjects(sized(262144)).contentBytes, 262144);
  assert.equal(r.templateBoard(sized(262144)).objects.length, 250);
  assert.throws(() => r.templateBoard(sized(262145)), /too large/);
  assert.throws(() => s.templateObjects(sized(262145)), e => e.status === 413 && e.message === "template_too_large");
  assert.equal(r.contentBytes([{ text: "😀" }]), Buffer.byteLength(JSON.stringify([{ text: "😀" }])));
});
unit(5, "text uses code points with exact limits and rejects lone surrogates and NUL", async () => {
  const r = await rules(), s = await server(); assert.equal(r.points("😀a"), 2);
  assert(r.validName("😀".repeat(120))); assert(!r.validName("😀".repeat(121)));
  assert(r.validDescription("😀".repeat(300))); assert(!r.validDescription("a".repeat(301)));
  for (const name of ["", " \t\n", "\udfff", "a\u0000", 1]) { assert(!r.validName(name)); assert.throws(() => s.templateDetails(name, "")); }
  for (const description of ["\ud800", "a\u0000", "a".repeat(301), null]) { assert(!r.validDescription(description)); assert.throws(() => s.templateDetails("Name", description)); }
  assert.deepEqual(s.templateDetails("😀".repeat(120), ""), { name: "😀".repeat(120), description: "" });
});
unit(6, "Save labels and all four disabled reasons take contractual precedence", async () => {
  const r = await rules(); assert.equal(r.saveLabel(true), "Save selection as template"); assert.equal(r.saveLabel(false), "Save board as template");
  assert.equal(r.saveReason("Locked", false, 25, "Example team", 0), "Locked");
  assert.equal(r.saveReason("", false, 25, "Example team", 0), "Only workspace owners and editors can save templates");
  assert.equal(r.saveReason("", true, 25, "Example team", 0), "Example team has 25 templates, the most it can keep. Delete one to save another.");
  assert.equal(r.saveReason("", true, 24, "Example team", 0), "Add something to the board first.");
  assert.equal(r.saveReason("", true, 24, "Example team", 1), "");
});
unit(7, "exact response parsing sorts newest first and then by id", async () => {
  const r = await rules(), a = response(), b = { ...response(), updatedAt: "2026-11-14T12:00:01.000Z" }, c = { ...a, id: "00000000-0000-4000-8000-000000000001" };
  assert.deepEqual(r.parseTemplates({ templates: [a, c, b], limit: 25, canSave: true }).templates, [b, c, a]);
  for (const value of [{ ...a, extra: 1 }, { ...a, objectCount: 9 }, { ...a, canManage: 1 }, { ...a, objects: [] }, { ...a, updatedAt: "today" }]) assert.throws(() => r.parseTemplate(value));
  for (const value of [{ templates: [], limit: 24, canSave: true }, { templates: [], limit: 25, canSave: true, extra: 1 }]) assert.throws(() => r.parseTemplates(value));
});
unit(8, "notice words and menu key movement are exact", async () => {
  const r = await rules(); const args = ["X", "Example team", 3];
  const words = { saved: "Saved “X” to Example team.", updated: "Updated “X”.", replaced: "Replaced “X” with 3 objects.", deleted: "Deleted “X”.", added: "Added “X”: 3 objects.", gone: "“X” is no longer available. Templates were refreshed.", refused: "You can no longer save templates in Example team. Templates were refreshed." };
  for (const [action, text] of Object.entries(words)) assert.equal(r.templateNotice(action, ...args), text);
  assert.equal(r.menuIndex("ArrowUp", 0), 2); assert.equal(r.menuIndex("ArrowDown", 2), 0);
  assert.equal(r.menuIndex("Home", 2), 0); assert.equal(r.menuIndex("End", 0), 2); assert.equal(r.menuIndex("Escape", 0), null);
});
unit(9, "stored insertion remaps section group and ends with no template provenance", async () => {
  const r = await rules(), original = objects(fixture()), template = r.templateBoard(original), before = structuredClone(original);
  const first = insertActivity(empty(), template, { x: 0, y: 0, z: 1 }, { w: 1280, h: 800 });
  const second = insertActivity(first.board, template, first.view, { w: 1280, h: 800 }); validate(second.board);
  assert.equal(first.ids.length, original.length); assert(second.ids.every(id => !first.ids.includes(id)));
  for (const o of second.board.objects) assert(!Object.keys(o).some(k => /template|creator|source/i.test(k)));
  assert.deepEqual(original, before);
  const sourceIds = new Set(template.objects.flatMap(o => [o.id, o.generation, o.group]));
  for (const o of second.board.objects) { assert(!sourceIds.has(o.id)); assert(!sourceIds.has(o.generation)); if (o.group) assert(!sourceIds.has(o.group)); }
});
let controllerModule;
async function controller() {
  controllerModule ??= (async () => {
    const { build } = await import("esbuild"); const { fileURLToPath } = await import("node:url");
    const result = await build({ stdin: { contents: "export {Templates} from './apps/web/src/team/templates.ts'; export {ApiError} from './apps/web/src/team/api.ts';", resolveDir: fileURLToPath(new URL("../", import.meta.url)), loader: "ts" }, bundle: true, write: false, format: "esm", platform: "node", plugins: [{ name: "template-http-port", setup(b) {
      b.onLoad({ filter: /\/team\/api\.ts$/ }, () => ({ contents: "export function api(){throw Error('Unexpected HTTP');} export class ApiError extends Error {constructor(status,reason){super(reason);this.status=status;this.reason=reason;}}", loader: "js" }));
    } }] }); return import("data:text/javascript;base64," + Buffer.from(result.outputFiles[0].text).toString("base64"));
  })(); return controllerModule;
}
unit(10, "controller gates guests, reloads on open, re-reads Add and refreshes own changes", async () => {
  const { Templates } = await controller(), calls = [], notices = [], t = response(); let role = "guest";
  const request = async (path, method = "GET") => { calls.push([path, method]); return path === "/workspaces" ? { workspaces: [{ id: "w", role }] } : path.endsWith(t.id) ? t : method === "POST" ? t : { templates: [t], limit: 25, canSave: true }; };
  const c = new Templates("w", "Example team", "b", text => notices.push(text), request);
  await c.open(); assert.equal(c.visible, false); assert.deepEqual(calls, [["/workspaces", "GET"]]);
  role = "editor"; await c.open(); assert.equal(c.visible, true); assert.equal(c.status, "ready");
  assert.deepEqual(await c.read(t), t); assert.deepEqual(calls.at(-1), ["/workspaces/w/templates/" + t.id, "GET"]);
  assert.equal(await c.change("save", { name: t.name, description: t.description }, undefined, t.objects), "done");
  assert.equal(c.newId, t.id); assert.deepEqual(calls.at(-1), ["/workspaces/w/templates", "GET"]);
  assert.equal(notices.at(-1), "Saved “Sprint kickoff” to Example team."); c.stop();
});
unit(11, "controller refreshes refusals, hides a refused list and retains ordinary failures", async () => {
  const { Templates, ApiError } = await controller(), t = response(), notices = []; let failure = 0, count = 0;
  const c = new Templates("w", "Example team", "b", text => notices.push(text), async (path, method = "GET") => {
    if (path === "/workspaces") return { workspaces: [{ id: "w", role: "owner" }] };
    if (path.endsWith(t.id)) throw new ApiError(failure || 404, "not_found");
    if (method !== "GET") throw new ApiError(failure || 503, "service_unavailable");
    count++; if (failure === 403) throw new ApiError(403, "role_too_low"); return { templates: [], limit: 25, canSave: true };
  });
  await c.open(); await c.read(t); assert.equal(count, 2); assert.match(notices.at(-1), /no longer available/);
  assert.equal(await c.change("save", { name: t.name, description: "" }, undefined, t.objects), "failed"); assert.equal(c.error, "Couldn't save the template. Try again."); assert.equal(c.pending, false);
  failure = 403; assert.equal(await c.change("delete", { name: "", description: "" }, t), "refused"); assert.equal(c.visible, false); c.stop();
});
unit(12, "controller pending excludes duplicate writes and late replies after close", async () => {
  const { Templates } = await controller(), t = response(); let resolve, writes = 0;
  const c = new Templates("w", "Example team", "b", () => {}, async () => { writes++; return new Promise(r => { resolve = r; }); });
  const pending = c.change("save", { name: t.name, description: "" }, undefined, t.objects);
  assert.equal(c.pending, true); assert.equal(await c.change("save", { name: t.name, description: "" }, undefined, t.objects), "failed"); assert.equal(writes, 1);
  c.stop(); resolve(t); await pending; assert.equal(writes, 1);
});
