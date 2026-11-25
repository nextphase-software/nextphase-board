// SPDX-License-Identifier: Apache-2.0
import test from "node:test";
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

const part = 1_048_576, idle = 60_000, hold = 600_000;
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const jpg = Uint8Array.of(255,216,255,192,0,8,8,0,3,0,2,0);
const png = Uint8Array.of(137,80,78,71,13,10,26,10,0,0,0,13,73,72,68,82,0,0,0,2,0,0,0,3);
const clip = new Uint8Array(part + 17).fill(1);
clip.set(new TextEncoder().encode("ftypisom"), 4);
const entries = [[png, "image/png"], [jpg, "image/jpeg"], [clip, "video/mp4"]].map(([bytes, type]) =>
  ({ hash: hash(bytes), type, bytes: bytes.length }));
const [picture, poster, video] = entries;
const input = bytes => new ReadableStream({
  start(controller) {
    controller.enqueue(bytes.subarray(0, 19)); controller.enqueue(bytes.subarray(19)); controller.close();
  },
});
const rejects = (promise, status, message) => assert.rejects(promise, { status, message });

async function fixture(t, discardImport) {
  const { Room } = await import("../packages/board-room/src/room.ts");
  const { NodeStorage } = await import("../apps/server/src/node-storage.ts");
  const storage = new NodeStorage(":memory:"), id = randomUUID(), workspace = randomUUID();
  const person = { id: randomUUID(), email: "importer@example.test", expiresAt: Number.MAX_SAFE_INTEGER };
  const stranger = { ...person, id: randomUUID() };
  let now = 1794000000000, deadline = null;
  const timers = new Set();
  const env = { storage, now: () => now, randomId: randomUUID, randomTicket: randomUUID, connections: () => [],
    schedule: async at => { deadline = at; }, hash: async data => hash(data), backupLimit: 234_881_024,
    access: { board: async () => ({ id, workspaceId: workspace, title: "Import", createdAt: new Date(now).toISOString() }),
      role: async () => "editor", changes: async () => ({ changes: [], latest: 0, lowestKept: 1 }), discardImport },
    lifecycle: { lifecycle: async () => ({ state: "active", generation: 0 }) }, fence: async () => 0, raiseFence: async () => 1,
    timer(ms, callback) { const e = { at: now + ms, callback }; timers.add(e); return () => timers.delete(e); },
    hasher() { const h = createHash("sha256"); return { async update(data) { h.update(data); }, async hex() { return h.digest("hex"); } }; },
  };
  const room = new Room(id, env);
  t.after(() => { room.doc.destroy(); storage.close(); });
  const document = { schemaVersion: 15, boardId: id, title: "Import", pages: [{ id: randomUUID(), name: "Page 1" }],
    retiredGenerations: [], objects: [] };
  return { room, person, stranger, id, workspace, document, env, storage, get deadline() { return deadline; },
    tick: ms => { now += ms; }, open: (assets = entries) => room.openImport(person, workspace, assets),
    claim: (doc = document) => room.claimImport(person, workspace, doc),
    begin: (asset = picture) => room.beginImport(person, workspace, asset.hash),
    stage: async (asset = picture, bytes = png, token) =>
      room.stageImportPicture(person, workspace, token ?? await room.beginImport(person, workspace, asset.hash),
        asset.hash, bytes, asset.type, 2, 3),
    stageClip: async () => room.stageImportVideo(person, workspace, await room.beginImport(person, workspace, video.hash),
      video.hash, video.type, input(clip)),
    meta: () => storage.all("SELECT * FROM meta ORDER BY key"),
  };
}
function withMedia(f, frame = poster) {
  const geometry = { page: f.document.pages[0].id, group: null, section: null, x: 0, y: 0,
    width: 2, height: 3, pixelWidth: 2, pixelHeight: 3, description: "" };
  return { ...f.document, objects: [
    { ...geometry, type: "image", id: randomUUID(), generation: randomUUID(), order: 0, asset: picture.hash },
    { ...geometry, type: "video", id: randomUUID(), generation: randomUUID(), order: 1, asset: video.hash,
      poster: frame.hash, durationMs: 4000, name: "clip.mp4" },
  ] };
}

test("X9-U20 import open, ownership, leased staging and chunked videos", async t => {
  const f = await fixture(t), { room, person, stranger, workspace } = f;
  await f.open();
  await rejects(f.open(), 409, "room_exists");
  await rejects(room.beginImport(person, randomUUID(), picture.hash), 410, "upload_expired");
  await rejects(room.beginImport(stranger, workspace, picture.hash), 403, "role_too_low");
  await rejects(room.beginImport(person, workspace, "f".repeat(64)), 400, "bad_request");
  const token = await f.begin();
  await rejects(f.begin(), 409, "upload_in_progress");
  await rejects(f.stage(picture, png, randomUUID()), 409, "upload_in_progress");
  await rejects(f.stage(picture, png.subarray(0, 14), token), 400, "bad_request");
  assert.equal(await f.stage(), "created");
  assert.equal(await f.stage(), "exists");
  assert.equal((await f.stageClip()).result, "created");
  assert.deepEqual(f.storage.all("SELECT length(data) AS size FROM picture_parts WHERE hash = ? ORDER BY part", video.hash).map(row => row.size), [part, 17]);
  const last = await f.begin();
  await room.endImport(person, workspace, last);
  assert.equal(f.deadline, f.env.now() + idle);
});
test("X9-U21 claim validates kinds, releases, and promotion preserves staged rows and pages", async t => {
  const f = await fixture(t), { room, person, stranger } = f;
  await f.open();
  const document = withMedia(f);
  await rejects(f.claim(document), 400, "asset_missing");
  await f.stage(); await f.stage(poster, jpg); await f.stageClip();
  await rejects(f.claim(withMedia(f, picture)), 400, "asset_missing");
  await room.releaseImport(await f.claim(document));
  const token = await f.claim(document);
  await rejects(f.claim(document), 409, "import_in_progress");
  await rejects(room.create(document, stranger, token), 409, "import_in_progress");
  await rejects(room.create(document, person, randomUUID()), 409, "import_in_progress");
  const oldParts = f.storage.all("SELECT hash, part, length(data) AS size FROM picture_parts ORDER BY hash, part");
  f.tick(123);
  await room.create(document, person, token);
  assert.equal(f.meta().some(row => row.key === "import"), false);
  assert(f.storage.all("SELECT uploaded_at FROM pictures").every(row => row.uploaded_at === f.env.now()));
  assert.deepEqual(f.storage.all("SELECT hash, part, length(data) AS size FROM picture_parts ORDER BY hash, part"), oldParts);
  assert.deepEqual(JSON.parse(await room.export(person)), { ...document, schemaVersion: 16 });
  assert.deepEqual(await room.assetSizes(person, [video.hash, "0".repeat(64), picture.hash]), [video, picture]);
  await rejects(f.open(), 409, "room_exists");
});
test("X9-U22 importing gates board operations, including after directory creation", async t => {
  const f = await fixture(t), { room, person } = f;
  await f.open();
  const meta = f.meta();
  await rejects(room.join("unknown"), 401, "ticket_invalid");
  for (const operation of [
    () => room.load(), () => room.ticket(person), () => room.export(person), () => room.backup(),
    () => room.restore({}), () => room.lock(), () => room.readPicture(person, picture.hash),
    () => room.readVideo(person, video.hash), () => room.assetSizes(person, []), () => room.versions(person),
    () => room.version(person, randomUUID()), () => room.saveVersion(person, {}), () => room.nameVersion(person, "", {}),
    () => room.restoreVersion(person, "", {}), () => room.changed(), () => room.deliverNotices(),
    () => room.rename(person, "New name"), () => room.connected({}), () => room.closed({}), () => room.message({}, ""),
    () => room.discussion(person, randomUUID()), () => room.fenceLifecycle({ state: "active" }), () => room.admitLifecycle({ operation: "move" }),
  ]) await rejects(operation(), 404, "not_found");
  assert.deepEqual(f.meta(), meta);
});
test("X9-U23 lease and claim hold the deadline off, staging discard invalidates an active upload", async t => {
  const f = await fixture(t), { room, workspace, person } = f;
  await f.open(); await room.schedule(); assert.equal(f.deadline, f.env.now() + idle);
  const lease = await f.begin(video);
  f.tick(idle);
  assert.equal(await room.alarm(), undefined);
  await rejects(f.claim(), 409, "import_in_progress");
  const pending = room.stageImportVideo(person, workspace, lease, video.hash, video.type, new ReadableStream({}));
  const aborted = rejects(pending, 410, "upload_expired");
  await room.ordered(async () => {});
  await room.discardLifecycle();
  await aborted;
  assert.equal(f.deadline, null);
});
test("X9-U24 unclaimed, released and unknown import cleanup", async t => {
  const calls = [];
  for (const release of [null, true]) {
    const f = await fixture(t, (...args) => calls.push(args));
    await f.open();
    if (release) await f.room.releaseImport(await f.claim());
    f.tick(idle - 1);
    assert.equal(await f.room.alarm(), undefined);
    f.tick(1);
    assert.deepEqual(await f.room.alarm(), { discard: true });
  }
  assert.deepEqual(calls, []);
  const f = await fixture(t);
  await assert.rejects(f.begin(), { status: 410, discard: true });
});
test("X9-U25 expired claimed import tombstones before erasing, once", async t => {
  const calls = [];
  const f = await fixture(t, async (...args) => { assert(f.meta().some(row => row.key === "import")); calls.push(args); });
  await f.open(); await f.claim(); f.tick(hold - 1);
  assert.equal(await f.room.alarm(), undefined);
  assert.deepEqual(calls, []);
  f.tick(1);
  assert.deepEqual(await f.room.alarm(), { discard: true });
  assert.deepEqual(calls, [[f.id, f.workspace]]);
  assert.equal(await f.room.alarm(), undefined);
  assert.equal(calls.length, 1);
});
test("X9-U26 failed and absent SQL cleanup retain the gate until retry succeeds", async t => {
  let calls = 0;
  const f = await fixture(t, async () => { if (++calls === 1) throw Error("Unavailable"); });
  await f.open(); const claim = await f.claim(); f.tick(hold);
  assert.equal(await f.room.alarm(), undefined);
  assert.equal(f.deadline, f.env.now() + idle);
  await rejects(f.room.backup(), 404, "not_found");
  for (const call of [
    () => f.begin(), () => f.stage(picture, png, randomUUID()), () => f.claim(),
    () => f.room.create(f.document, f.person, claim),
  ]) await rejects(call(), 410, "upload_expired");
  f.tick(idle);
  assert.deepEqual(await f.room.alarm(), { discard: true });
  assert.equal(calls, 2);
  const absent = await fixture(t);
  await absent.open(); await absent.claim(); absent.tick(hold);
  assert.equal(await absent.room.alarm(), undefined);
  assert.equal(absent.deadline, absent.env.now() + idle);
  await rejects(absent.room.backup(), 404, "not_found");
});
test("X9-U27 template store bounds, ordered stage, one-use commit, reads, expiry and discard", async t => {
  const { TemplateStore } = await import("../packages/board-room/src/template-store.ts");
  const f = await fixture(t), { person, workspace } = f;
  const store = new TemplateStore(f.env);
  await assert.rejects(store.open(person, workspace, [{ ...picture, bytes: 20_971_521 }]), { status: 413 });
  await store.open(person, workspace, entries);
  assert.equal(await store.read(picture.hash), null);
  const token = await store.begin(person, workspace, video.hash);
  await rejects(store.begin(person, workspace, picture.hash), 409, "upload_in_progress");
  await store.end(person, workspace, token);
  const lease = await store.begin(person, workspace, video.hash);
  assert.equal(await store.stage(person, workspace, lease, video.hash, video.type, clip, 0, 0), "created");
  assert.deepEqual(await store.inventory(), [video]);
  assert.deepEqual(await store.commit(person, workspace), [video]);
  await rejects(store.commit(person, workspace), 410, "upload_expired");
  f.tick(hold);
  assert.equal(await store.alarm(), undefined);
  assert.deepEqual(await store.read(video.hash), { type: video.type, bytes: clip });
  assert.deepEqual(await store.discard(), { discard: true });
  const other = await fixture(t), staging = new TemplateStore(other.env);
  await staging.open(other.person, other.workspace, [picture]); other.tick(idle);
  assert.deepEqual(await staging.alarm(), { discard: true });
});
test("X9-U28 restore marker preserves a claimed staging and erases its unmarked peer", t => {
  const root = mkdtempSync(join(tmpdir(), "board-import-marker-")), dir = join(root, "boards");
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(dir);
  const [board, unmarked, marked] = [randomUUID(), randomUUID(), randomUUID()].map(id => id + ".sqlite");
  for (const name of [board, unmarked, marked]) {
    const db = new DatabaseSync(join(dir, name));
    db.exec("CREATE TABLE meta (key TEXT PRIMARY KEY, value INTEGER NOT NULL)");
    db.prepare("INSERT INTO meta VALUES (?, ?)").run(name === board ? "storage_version" : "import",
      name === board ? 9 : JSON.stringify(name === marked ? { finishing: true } : {}));
    db.close();
  }
  for (const suffix of ["-wal", "-shm"]) writeFileSync(join(dir, unmarked + suffix), "");
  const script = new URL("../apps/server/scripts/mark-restored-volume.mjs", import.meta.url);
  assert.equal(execFileSync(process.execPath, [script.pathname, root], { encoding: "utf8" }).trim(), "Marked 1 restored board files");
  assert.deepEqual(readdirSync(dir).sort(), [board, marked].sort());
  const values = name => {
    const db = new DatabaseSync(join(dir, name), { readOnly: true });
    try { return db.prepare("SELECT key, value FROM meta ORDER BY key").all().map(row => [row.key, row.value]); }
    finally { db.close(); }
  };
  assert.deepEqual(values(board), [["explicit_recovery_pending", 1], ["restore_pending", 1], ["storage_version", 9]]);
  assert.deepEqual(values(marked), [["import", '{"finishing":true}']]);
});
