// SPDX-License-Identifier: Apache-2.0
import { afterAll, afterEach, beforeAll, inject, test } from "vitest";
import assert from "node:assert/strict";
import { deflateSync } from "node:zlib";
import { makeDriver } from "board-test-driver";
import { add, canonical, empty, type BoardV14, type ImageItem, type VideoItem } from "../../packages/board-rules/src/document.ts";
import type { Context, Driver } from "./driver-types.ts";

const context = inject<Context>("board"), runner = inject<string>("runner");
const MiB = 1_048_576;
let driver: Driver, f: { workspace: string; a: string; people: Context["people"] };
beforeAll(async () => { driver = await makeDriver(context); });
afterEach(async () => {
  await helper("proxy", { rpc: "create_board" });
  await driver.control({ fixedNow: null, offset: 0 });
});
afterAll(async () => { await driver?.close(); });

async function helper(action: string, value: unknown = {}) {
  const reply = await fetch(context.helperUrl + "/" + action, { method: "POST", body: JSON.stringify(value) });
  const body = await reply.json() as any;
  assert.equal(reply.status, 200, JSON.stringify(body));
  return body;
}
const rpc = (name: string, parameters: object) => helper("rpc", { name, parameters });
const rows = (table: string, filters: object) => helper("rows", { table, filters });
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
function check(id: number, title: string, run: () => Promise<void>) {
  const register = id === 467 && runner !== "node" ? test.skip : test;
  register("S" + id + " " + title, async () => {
    try {
      f = await helper("removal-fixture");
      await run();
      console.log("PASS: S" + id + " " + title);
    } catch (error) { console.log("FAIL: S" + id + " " + title); throw error; }
  });
}

const workspace = (id = f.workspace) => "/workspaces/" + id;
const board = (id: string) => "/boards/" + id;
const importPath = (id?: string, inWorkspace?: string) => workspace(inWorkspace) + "/imports" + (id ? "/" + id : "");
const uploadPath = (id?: string) => workspace() + "/template-uploads" + (id ? "/" + id : "");
const templatePath = (id?: string) => workspace() + "/templates" + (id ? "/" + id : "");
function request(path: string, method = "GET", value?: unknown, who = "owner") {
  const binary = value instanceof Uint8Array;
  return driver.request(path, { method,
    headers: { Authorization: "Bearer " + (f.people[who]?.token ?? context.people.viewer.token),
      Origin: context.origin, "Content-Type": binary ? "application/octet-stream" : "application/json" },
    body: binary ? value.slice().buffer : value === undefined ? undefined : JSON.stringify(value),
  });
}
async function json(answer: Promise<Response>, status: number) {
  const reply = await answer;
  assert.equal(reply.status, status, reply.ok ? undefined : await reply.clone().text());
  return reply.json() as Promise<any>;
}
const refused = async (answer: Promise<Response>, status: number, reason: string, needed?: string) =>
  assert.deepEqual(await json(answer, status), { error: { reason, ...(needed ? { needed } : {}) } });
type Asset = { hash: string; type: string; bytes: number; data: Uint8Array<ArrayBuffer> };
const sizes = (assets: Asset[]) => assets.map(({ hash, type, bytes }) => ({ hash, type, bytes }));
const sha256 = async (data: Uint8Array<ArrayBuffer>) =>
  Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", data)), b => b.toString(16).padStart(2, "0")).join("");
async function asset(type: string, data: Uint8Array<ArrayBuffer>): Promise<Asset> {
  return { hash: await sha256(data), type, bytes: data.length, data };
}
const png = Uint8Array.from(atob("iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAC0lEQVR4nGNgQAYAAA4AAamRc7EAAAAASUVORK5CYII="), c => c.charCodeAt(0));
async function assets() {
  const video = new Uint8Array(1_048_583);
  video.set(new TextEncoder().encode("ftypisom"), 4);
  return Promise.all([asset("image/png", png), asset("image/jpeg", Uint8Array.of(255,216,255,192,0,8,8,0,2,0,2,0)), asset("video/mp4", video)]);
}
function withMedia(picture?: Asset, frame?: Asset, video?: Asset): BoardV14 {
  const source = { ...empty(), title: "File title" }, page = source.pages[0].id;
  const geometry = { x: 0, y: 0, width: 2, height: 2, pixelWidth: 2, pixelHeight: 2, description: "", group: null, section: null, page };
  const objects: BoardV14["objects"] = [];
  if (picture) objects.push({ ...geometry, type: "image", id: crypto.randomUUID(), generation: crypto.randomUUID(), order: 0, asset: picture.hash } as ImageItem & { page: string });
  if (frame && video) objects.push({ ...geometry, type: "video", id: crypto.randomUUID(), generation: crypto.randomUUID(), order: objects.length,
    asset: video.hash, poster: frame.hash, durationMs: 4000, name: "clip.mp4" } as VideoItem);
  return { ...source, objects };
}
const objectsOf = (document: BoardV14) => document.objects.map(({ generation, order, page, ...object }) => object);
const sticky = () => objectsOf(add(empty(), "sticky", 0, 0));
const templateBody = (objects = sticky(), upload?: string) =>
  ({ name: "Kit", description: "", sourceBoard: f.a, objects, ...(upload ? { upload } : {}) });
const put = (path: string, entry: Asset, who?: string, data = entry.data) => request(path + "/assets/" + entry.hash, "PUT", data, who);
const finish = (id: string, document: BoardV14, who?: string, inWorkspace?: string) =>
  request(workspace(inWorkspace) + "/boards", "POST", { import: id, title: "Imported board", document }, who);
async function opened(entries: Asset[], who?: string) {
  return (await json(request(importPath(), "POST", { assets: sizes(entries) }, who), 201)).import as string;
}
async function staged(entries: Asset[]) {
  const upload = (await json(request(uploadPath(), "POST", { assets: sizes(entries) }), 201)).upload as string;
  for (const entry of entries) await json(put(uploadPath(upload), entry), 201);
  return upload;
}
async function exactAsset(request: Promise<Response>, expected: Asset) {
  const reply = await request;
  assert.equal(reply.status, 200); assert.equal(reply.headers.get("Content-Type"), expected.type);
  const bytes = new Uint8Array(await reply.arrayBuffer());
  assert.equal(bytes.length, expected.bytes); assert.equal(await sha256(bytes), expected.hash);
}
async function erased(id: string, store?: "template") {
  for (const table of ["meta", "pictures", "picture_parts"]) assert.deepEqual(await driver.rows(id, table, store), []);
  if (driver.runner === "node") assert.deepEqual((await driver.control({ board: id, inventory: true, store })).files, []);
}

check(453, "import-roundtrip", async () => {
  const entries = await assets(), id = await opened(entries);
  for (const entry of entries) await json(put(importPath(id), entry), 201);
  await json(put(importPath(id), entries[0]), 200);
  const document = withMedia(...entries as [Asset, Asset, Asset]);
  assert.equal((await json(finish(id, document), 201)).id, id);
  assert.equal((await rows("boards", { id })).length, 1);
  assert.equal((await rows("board_lifecycle", { board_id: id })).length, 1);
  for (const role of ["owner", "editor", "viewer"]) {
    for (const entry of entries) await exactAsset(request(board(id) + "/assets/" + entry.hash, "GET", undefined, role), entry);
  }
  assert.equal(await (await request(board(id) + "/export")).text(), canonical({ ...document, boardId: id, title: "Imported board" }));
});
check(454, "import-budgets", async () => {
  const [picture, , video] = await assets();
  const descriptor = (i: number, type: string, bytes: number) => ({ hash: i.toString(16).padStart(64, "0"), type, bytes });
  for (const malformed of [[], Array.from({ length: 1001 }, (_, i) => descriptor(i, picture.type, 1)),
    [descriptor(1, picture.type, 1), descriptor(1, video.type, 1)], [descriptor(1, "image/svg+xml", 1)], [descriptor(1, picture.type, 0)]]) {
    await refused(request(importPath(), "POST", { assets: malformed }), 400, "bad_request");
  }
  await refused(request(importPath(), "POST", { assets: [20 * MiB, 20 * MiB, 10 * MiB + 1].map((bytes, i) => descriptor(i, picture.type, bytes)) }), 409, "board_pictures_full");
  await refused(request(importPath(), "POST", { assets: [50 * MiB, 50 * MiB, 1].map((bytes, i) => descriptor(i, video.type, bytes)) }), 409, "board_videos_full");
  const id = await opened([{ ...picture, bytes: picture.bytes + 1 }, { ...video, type: "video/webm" }]);
  for (const entry of [picture, video, { ...picture, hash: "0".repeat(64) }]) await refused(put(importPath(id), entry), 400, "bad_request");
  assert.deepEqual(await driver.rows(id, "pictures"), []);
});
check(455, "import-missing", async () => {
  const entries = await assets(), id = await opened(entries);
  const [picture, frame, video] = entries;
  await json(put(importPath(id), picture), 201); await json(put(importPath(id), video), 201);
  const document = withMedia(picture, frame, video);
  await refused(finish(id, document), 400, "asset_missing");
  assert.deepEqual(await rows("boards", { id }), []);
  await refused(finish(id, withMedia(picture, picture, video)), 400, "asset_missing");
  await json(put(importPath(id), frame), 201);
  await json(finish(id, document), 201);
  const unknown = crypto.randomUUID();
  await refused(finish(unknown, document), 410, "upload_expired");
  await erased(unknown);
});
check(456, "import-other-person, import-demoted and import-workspace", async () => {
  const [picture] = await assets(), id = await opened([picture]);
  await refused(put(importPath(id), picture, "editor"), 403, "role_too_low", "editor");
  await refused(finish(id, withMedia(picture), "editor"), 403, "role_too_low", "editor");
  for (const role of ["viewer", "granted"]) await refused(request(importPath(), "POST", { assets: sizes([picture]) }, role), 403, "role_too_low", "editor");
  for (const role of ["plain", "outsider"]) await refused(request(importPath(), "POST", { assets: sizes([picture]) }, role), 404, "not_found");
  const otherWorkspace = await rpc("bootstrap_workspace", { name: "Other " + crypto.randomUUID(), owner_id: f.people.owner.id, owner_email: f.people.owner.email });
  await refused(put(importPath(id, otherWorkspace), picture), 410, "upload_expired");
  await refused(finish(id, withMedia(picture), "owner", otherWorkspace), 410, "upload_expired");
  const second = await opened([picture], "editor");
  await json(put(importPath(second), picture, "editor"), 201);
  await rpc("write_member_role", { workspace: f.workspace, person: f.people.editor.id, role: "viewer" });
  await refused(finish(second, withMedia(picture), "editor"), 403, "role_too_low", "editor");
  assert.deepEqual(await rows("boards", { id: second }), []);
  const staged = await driver.control({ board: id, importCommand: "begin", person: f.people.owner, workspace: f.workspace, hash: picture.hash });
  await refused(put(importPath(id), picture), 409, "upload_in_progress");
  await driver.control({ board: id, importCommand: "end", person: f.people.owner, workspace: f.workspace, token: staged });
});
check(457, "import-idle-drop", async () => {
  const [picture] = await assets(), id = await opened([picture]);
  await json(put(importPath(id), picture), 201);
  await wait(75_000);
  await erased(id); assert.deepEqual(await rows("boards", { id }), []);
  await refused(put(importPath(id), picture), 410, "upload_expired");
  await refused(finish(id, withMedia(picture)), 410, "upload_expired");
  await erased(id);
  if (driver.runner === "node") {
    const cold = await opened([picture]);
    await json(put(importPath(cold), picture), 201);
    await driver.control({ board: cold, reload: true });
    await driver.control({ offset: 75_000 });
    await refused(put(importPath(cold), picture), 410, "upload_expired");
    await wait(20);
    await erased(cold);
  }
});
check(458, "template-media-roundtrip", async () => {
  const entries = await assets(), upload = await staged(entries), objects = objectsOf(withMedia(...entries as [Asset, Asset, Asset]));
  const t = await json(request(templatePath(), "POST", templateBody(objects, upload)), 201);
  assert.deepEqual((await json(request(templatePath(t.id)), 200)).media, sizes(entries).toSorted((a, b) => a.hash.localeCompare(b.hash)));
  for (const entry of entries) for (const role of ["owner", "editor", "viewer"])
    await exactAsset(request(templatePath(t.id) + "/assets/" + entry.hash, "GET", undefined, role), entry);
  await refused(request(templatePath(t.id) + "/assets/" + entries[0].hash, "GET", undefined, "plain"), 403, "role_too_low", "viewer");
  await refused(request(templatePath(t.id) + "/assets/" + "0".repeat(64)), 404, "not_found");
  await refused(request(templatePath(), "POST", templateBody(objects)), 400, "bad_request");
  const incomplete = await staged([entries[0]]);
  await refused(request(templatePath(), "POST", templateBody(objects, incomplete)), 400, "asset_missing");
  await erased(incomplete, "template");
  const retry = await staged(entries);
  await refused(request(templatePath(), "POST", templateBody(sticky(), retry)), 400, "bad_request");
  await json(request(templatePath(), "POST", templateBody(objects, retry)), 201);
  await refused(request(templatePath(), "POST", templateBody(objects, upload)), 410, "upload_expired");
  for (const entry of entries) await exactAsset(request(templatePath(t.id) + "/assets/" + entry.hash), entry);
});

function pngChunk(type: string, payload: Uint8Array) {
  const chunk = new Uint8Array(payload.length + 12), data = new DataView(chunk.buffer);
  data.setUint32(0, payload.length);
  chunk.set(new TextEncoder().encode(type), 4);
  chunk.set(payload, 8);
  let crc = -1;
  for (let i = 4; i < chunk.length - 4; i++) {
    crc ^= chunk[i];
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  data.setUint32(chunk.length - 4, ~crc);
  return chunk;
}
function noisyPNG(length: number) {
  const width = 2048, height = 1600, stride = width * 3 + 1, scanlines = new Uint8Array(stride * height);
  for (let at = 0; at < scanlines.length; at += 65536) crypto.getRandomValues(scanlines.subarray(at, at + 65536));
  for (let row = 0; row < height; row++) scanlines[row * stride] = 0;
  const header = new Uint8Array(13), dimensions = new DataView(header.buffer);
  dimensions.setUint32(0, width); dimensions.setUint32(4, height); header.set([8, 2], 8);
  const chunks = [png.subarray(0, 8), pngChunk("IHDR", header), pngChunk("IDAT", deflateSync(scanlines, { level: 0 }))];
  const used = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  chunks.push(pngChunk("npAD", new Uint8Array(length - used - 24)), pngChunk("IEND", new Uint8Array()));
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return bytes;
}
check(459, "template-media-limit", async () => {
  const entries = await Promise.all([asset("image/png", noisyPNG(10 * MiB)), asset("image/png", noisyPNG(10 * MiB))]);
  const excessive = sizes(entries); excessive[1].bytes++;
  await refused(request(uploadPath(), "POST", { assets: excessive }), 413, "template_too_large");
  const upload = await staged(entries);
  await refused(put(uploadPath(upload), entries[0], "owner", new Uint8Array(20 * MiB + 1)), 413, "body_too_large");
  const document = withMedia(entries[0]), image = { ...document.objects[0], asset: entries[1].hash, id: crypto.randomUUID(), generation: crypto.randomUUID(), order: 1 };
  document.objects = [...document.objects, image];
  const t = await json(request(templatePath(), "POST", templateBody(objectsOf(document), upload)), 201);
  for (const entry of entries) await exactAsset(request(templatePath(t.id) + "/assets/" + entry.hash), entry);
  assert.equal((await request(templatePath(t.id), "DELETE")).status, 204);
  await erased(upload, "template");
});
check(460, "template-media-replace-delete and template-media-refused-save", async () => {
  const [picture, frame] = await assets(), base = await staged([picture]), replacement = await staged([frame]);
  const a = await json(request(templatePath(), "POST", templateBody(objectsOf(withMedia(picture)), base)), 201);
  const path = templatePath(a.id);
  await json(request(path, "PATCH", { sourceBoard: f.a, objects: objectsOf(withMedia(frame)), upload: replacement }), 200);
  assert.deepEqual((await json(request(path), 200)).media, sizes([frame]));
  await erased(base, "template");
  await json(request(path, "PATCH", { sourceBoard: f.a, objects: sticky() }), 200);
  assert.deepEqual((await json(request(path), 200)).media, []); await erased(replacement, "template");
  const last = await staged([picture]);
  await json(request(path, "PATCH", { sourceBoard: f.a, objects: objectsOf(withMedia(picture)), upload: last }), 200);
  assert.equal((await request(path, "DELETE")).status, 204);
  await erased(last, "template");
  for (let i = 0; i < 25; i++) await json(request(templatePath(), "POST", templateBody()), 201);
  const rejected = await staged([picture]);
  await refused(request(templatePath(), "POST", templateBody(objectsOf(withMedia(picture)), rejected)), 409, "template_limit");
  await erased(rejected, "template");
});
check(461, "template-media-idle-drop", async () => {
  const [picture] = await assets();
  const upload = (await json(request(uploadPath(), "POST", { assets: sizes([picture]) }), 201)).upload;
  await wait(75_000);
  await erased(upload, "template");
  await refused(put(uploadPath(upload), picture), 410, "upload_expired");
  await erased(upload, "template");
});
check(462, "asset-sizes", async () => {
  const entries = await assets(), root = board(f.a);
  for (const entry of entries) await json(put(root, entry), 201);
  const hashes = [entries[2].hash, "0".repeat(64), entries[0].hash];
  assert.deepEqual(await json(request(root + "/asset-sizes", "POST", { hashes }, "viewer"), 200), { assets: sizes([entries[2], entries[0]]) });
  await refused(request(root + "/asset-sizes", "POST", { hashes }, "outsider"), 404, "not_found");
  await refused(request(root + "/asset-sizes", "POST", { hashes: Array.from({ length: 1001 }, (_, i) => i.toString(16).padStart(64, "0")) }), 400, "bad_request");
});
check(463, "legacy create and template media refusals", async () => {
  const [picture, frame, video] = await assets();
  for (const document of [withMedia(picture), withMedia(undefined, frame, video)]) {
    await refused(request(workspace() + "/boards", "POST", { title: "Legacy import", document }), 400, "images_not_supported");
    await refused(request(templatePath(), "POST", templateBody(objectsOf(document))), 400, "bad_request");
  }
  await json(request(workspace() + "/boards", "POST", { title: "Legacy import", document: withMedia() }), 201);
});
check(464, "schema is repeatable with one signature and legacy board create", async () => {
  await helper("template-schema"); await helper("template-schema");
  const functions = ["create_board", "discard_import", "save_template", "replace_template", "delete_template", "get_template", "list_templates"];
  const output = String(await helper("sql", { sql: `SELECT proname,pg_get_function_identity_arguments(p.oid) FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace=n.oid WHERE n.nspname='nextphase_board' AND proname IN ('${functions.join("','")}') ORDER BY proname` }));
  for (const name of functions) assert.equal(output.split("\n").filter(line => line.startsWith(name + "|")).length, 1);
  assert.match(output, /create_board\|workspace uuid, person uuid, title text, board uuid/);
  assert.match(output, /discard_import\|board uuid, workspace uuid/);
  assert.match(output, /save_template\|[^\n]*store uuid/); assert.match(output, /replace_template\|[^\n]*store uuid/);
  assert.equal(String(await helper("sql", { sql: "SELECT count(*) FROM information_schema.columns WHERE table_schema='nextphase_board' AND table_name='templates' AND column_name='store'" })).trim(), "1");
  const boardId = crypto.randomUUID(), args = { workspace: f.workspace, person: f.people.owner.id, title: "Explicit" };
  assert.equal((await rpc("create_board", { ...args, board: boardId })).id, boardId);
  assert.notEqual((await rpc("create_board", args)).id, boardId);
  await json(request(templatePath(), "POST", templateBody()), 201);
  assert((await rpc("list_templates", { person: args.person, workspace: f.workspace })).templates.every((entry: object) => !Object.hasOwn(entry, "store")));
});
check(465, "import-claim", async () => {
  const [picture] = await assets(), document = withMedia(picture);
  async function uploaded() { const id = await opened([picture]); await json(put(importPath(id), picture), 201); return id; }
  const id = await uploaded(), replies = await Promise.all([finish(id, document), finish(id, document)]);
  assert.deepEqual(replies.map(r => r.status).sort(), [201, 409]);
  await refused(Promise.resolve(replies.find(r => r.status === 409)!), 409, "import_in_progress");
  await refused(finish(id, document), 409, "import_in_progress");
  assert.equal((await rows("boards", { id })).length, 1);
  for (const mode of [{ failAfter: true }, { delayMs: 4200 }]) {
    const failed = await uploaded();
    await helper("proxy", { rpc: "create_board", parameters: { board: failed }, ...mode });
    await refused(finish(failed, document), 503, "service_unavailable");
    if (mode.delayMs) await wait(mode.delayMs);
    await helper("proxy", { rpc: "create_board" });
    assert.deepEqual(await rows("boards", { id: failed }), []);
    assert.equal((await rows("deleted_board_ids", { board_id: failed })).length, 1);
    await erased(failed);
  }
});
check(466, "import-gate", async () => {
  const [picture] = await assets(), id = await opened([picture]), document = { ...withMedia(picture), boardId: id, title: "Board" };
  await json(put(importPath(id), picture), 201);
  const person = f.people.owner, claim = await driver.control({ board: id, importCommand: "claim", workspace: f.workspace, person, document });
  async function probes() {
    await assert.rejects(driver.connect(board(id) + "/join?ticket=invalid"), /401/);
    for (const tail of ["/assets/" + picture.hash, "/export", "/versions"])
      await refused(request(board(id) + tail), 404, "not_found");
    await refused(driver.request("/operator" + board(id) + "/backup", { method: "POST", headers: { "Board-Operator-Key": context.operatorKey } }), 404, "not_found");
    assert(!(await driver.rows(id, "meta")).some(row => row.key === "storage_version"));
  }
  await probes();
  await rpc("create_board", { board: id, workspace: f.workspace, person: person.id, title: document.title });
  await probes();
  await driver.control({ board: id, importCommand: "create", person, document, token: claim });
  assert((await driver.rows(id, "meta")).some(row => row.key === "storage_version"));
});
check(467, "Node restart expires a marked import without opening it by request", async () => {
  const [picture] = await assets(), id = await opened([picture]);
  await json(put(importPath(id), picture), 201);
  const document = { ...withMedia(picture), boardId: id, title: "Board" }, person = f.people.owner;
  await driver.control({ board: id, importCommand: "claim", workspace: f.workspace, person, document });
  await rpc("create_board", { board: id, workspace: f.workspace, person: person.id, title: document.title });
  await helper("proxy", { clearLog: true });
  await driver.control({ restart: true, restartOffset: 600_001 });
  const calls = await helper("proxy");
  assert.equal(calls.filter((call: any) => call.name === "discard_import" && call.parameters.board === id).length, 1);
  assert.deepEqual(await rows("boards", { id }), []); assert.deepEqual(await rows("board_lifecycle", { board_id: id }), []);
  assert.equal((await rows("deleted_board_ids", { board_id: id })).length, 1);
  await erased(id);
});
