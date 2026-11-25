// SPDX-License-Identifier: Apache-2.0
import test from "node:test";
import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { richBoard, sizedBoard, imageBoard, withoutPages } from "./import-fixture.mjs";

const file = (raw) => {
  const bytes = new TextEncoder().encode(raw);
  return { size: bytes.length, arrayBuffer: async () => bytes.buffer };
};
const envelope = (payload, changes = {}) => JSON.stringify({ format: "nextphase-board", fileVersion: 1, payload,
  sha256: createHash("sha256").update(payload).digest("hex"), ...changes });
async function refused(importBoard, input, reason) {
  let sends = 0;
  await assert.rejects(importBoard(input, async () => { sends++; }), { message: reason });
  assert.equal(sends, 0);
}
for (const [name, input, index] of [
  ["file over 216 MiB", () => ({ size: 226492417, arrayBuffer: () => assert.fail("Oversized file was read") }), 0],
  ["not a Board file", () => file("not JSON"), 1],
  ["damaged file", () => file(envelope("{}", { sha256: "0".repeat(64) })), 2],
  ["not a valid board", () => file(envelope("{}")), 3],
  ["newer Board file", () => file(envelope("{}", { fileVersion: 4 })), 4],
]) test(`team import refuses ${name} with the reader's exact words without sending`, async () => {
  const { importBoard } = await import("../apps/web/src/team/import.ts");
  const { FILE_REASONS } = await import("../apps/web/src/board-file.ts");
  await refused(importBoard, input(), FILE_REASONS[index]);
});
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAC0lEQVR4nGNgQAYAAA4AAamRc7EAAAAASUVORK5CYII=", "base64");
for (const version of [1, 2, 3]) test(`team import checks pictures in file version ${version} before sending`, async t => {
  const { importBoard } = await import("../apps/web/src/team/import.ts");
  const { canonical } = await import("../packages/board-rules/src/document.ts");
  const { writeBoardFile } = await import("../apps/web/src/board-file.ts");
  const bytes = new Uint8Array(png).buffer;
  const hash = createHash("sha256").update(new Uint8Array(bytes)).digest("hex"), board = imageBoard(hash);
  const raw = version === 1 ? envelope(canonical(board)) : version === 2 ?
    envelope(JSON.stringify({ document: canonical(board), assets: [{ sha256: hash, mime: "image/png", pixelWidth: 2, pixelHeight: 2, base64: Buffer.from(bytes).toString("base64") }] }), {fileVersion: 2}) : await writeBoardFile(board, undefined,
    new Map([[hash, { bytes, mime: "image/png", pixelWidth: 2, pixelHeight: 2 }]]));
  if (version === 1) { await refused(importBoard, file(raw), "a picture is unavailable"); return; }
  const previousDecoder = globalThis.createImageBitmap;
  globalThis.createImageBitmap = async blob => {
    assert.equal(blob.type, "image/png");
    if (!Buffer.from(await blob.arrayBuffer()).equals(png)) throw Error("Decode failed");
    return { width: 2, height: 2, close() {} };
  };
  t.after(() => { if (previousDecoder) globalThis.createImageBitmap = previousDecoder; else delete globalThis.createImageBitmap; });
  const result = await importBoard(file(raw), async () => assert.fail("A staged import sent its board early"));
  assert.deepEqual(result.document, board);
  assert.equal(result.title, board.title);
  assert.deepEqual(result.media.map(({ blob, ...entry }) => entry), [{ hash, type: "image/png", bytes: png.length }]);
  assert.deepEqual(Buffer.from(await result.media[0].blob.arrayBuffer()), png);
  if (version === 2) {
    const header = png.subarray(0, 24), sha256 = createHash("sha256").update(header).digest("hex");
    const damaged = envelope(JSON.stringify({ document: canonical(imageBoard(sha256)), assets: [
      { sha256, mime: "image/png", pixelWidth: 2, pixelHeight: 2, base64: header.toString("base64") },
    ] }), { fileVersion: 2 });
    await refused(importBoard, file(damaged), "it is damaged");
  }
});
test("team import refuses a document of 2097153 canonical bytes without sending", async () => {
  const { importBoard } = await import("../apps/web/src/team/import.ts");
  const board = sizedBoard(2097153);
  assert.equal(Buffer.byteLength(JSON.stringify(withoutPages(board))), 2097153);
  await refused(importBoard, file(envelope(JSON.stringify(board))), "it is not a valid board");
});
test("team import refuses a version 1 file whose document upgrade exceeds 2 MiB", async () => {
  const { importBoard } = await import("../apps/web/src/team/import.ts");
  const { canonical } = await import("../packages/board-rules/src/document.ts");
  const board = sizedBoard(2097152, 8);
  await refused(importBoard, file(envelope(canonical(board))), "it is not a valid board");
});
test("team import sends exactly one title and complete current document", async () => {
  const { importBoard } = await import("../apps/web/src/team/import.ts");
  const { writeBoardFile } = await import("../apps/web/src/board-file.ts");
  const board = richBoard(), bodies = [], reply = { id: crypto.randomUUID() };
  assert.deepEqual(await importBoard(file(await writeBoardFile(board)), async (body) => { bodies.push(body); return reply; }), reply);
  assert.deepEqual(bodies, [{ title: board.title, document: board }]);
});
test("team import upgrades schema 9 to 10 preserving every object", async () => {
  const { importBoard } = await import("../apps/web/src/team/import.ts");
  const { canonical } = await import("../packages/board-rules/src/document.ts");
  const board = { ...withoutPages(richBoard()), schemaVersion: 9 }, bodies = [];
  await importBoard(file(envelope(canonical(board))), async (body) => { bodies.push(body); });
  assert.deepEqual(bodies, [{ title: board.title, document: { ...board, schemaVersion: 15, pages: [{ id: board.boardId, name: "Page 1" }], objects: board.objects.map(o => ({ ...o, page: board.boardId })) } }]);
});

async function roomFixture() {
  const { Room } = await import("../packages/board-room/src/room.ts");
  const { NodeStorage } = await import("../apps/server/src/node-storage.ts");
  const storage = new NodeStorage(":memory:"), board = richBoard(), now = Date.now();
  const environment = { storage, lifecycle: { lifecycle: async () => ({ state: "active", generation: 0 }) }, access: {
    async board() { return { id: board.boardId, title: board.title, workspaceId: crypto.randomUUID(), createdAt: new Date(now).toISOString() }; },
    async role() { return "editor"; }, async changes() { return { changes: [], latest: 7, lowestKept: 1 }; },
  }, now: () => now, fence: async () => 0, raiseFence: async () => 1,
    hash: async (bytes) => createHash("sha256").update(bytes).digest("hex"),
    randomTicket: () => randomBytes(32).toString("base64url"), randomId: () => crypto.randomUUID(),
    async verify() { throw Error("Not needed"); }, connections: () => [], async schedule() {}, backupLimit: 16777216 };
  return { storage, board, room: new Room(board.boardId, environment), reopen: () => new Room(board.boardId, environment) };
}
test("room create persists the imported canonical document and identifiers at revision zero across load", async () => {
  const { canonical } = await import("../packages/board-rules/src/document.ts");
  const { meta } = await import("../packages/board-room/src/storage.ts");
  const f = await roomFixture();
  try {
    await f.room.create(f.board);
    assert.equal(meta(f.storage, "revision"), 0); assert.equal(meta(f.storage, "storage_version"), 9);
    assert.equal(meta(f.storage, "watermark"), 7); assert.deepEqual(f.room.board, f.board);
    const chunks = f.storage.all("SELECT bytes FROM snapshot_chunks WHERE kind = 'json' ORDER BY chunk_index");
    assert.equal(Buffer.concat(chunks.map((row) => Buffer.from(row.bytes))).toString(), canonical(f.board));
    assert.deepEqual(f.storage.all("SELECT * FROM identifiers ORDER BY object_id").map((row) => ({ ...row })), f.board.objects.map((o) =>
      ({ object_id: o.id, generation: o.generation, first_revision: 0 })).sort((a, b) => a.object_id.localeCompare(b.object_id)));
    const reopened = f.reopen(); await reopened.load(); assert.deepEqual(reopened.board, f.board);
    assert.equal(meta(f.storage, "revision"), 0);
  } finally { f.storage.close(); }
});
test("room create refuses an ordinarily opened room with 409 room_exists without changing any table", async () => {
  const { tables } = await import("../packages/board-room/src/storage.ts");
  const f = await roomFixture();
  try {
    await f.room.load();
    const read = () => Object.fromEntries(Object.keys(tables).map((table) => [table, f.storage.all(`SELECT * FROM "${table}"`)]));
    const before = read();
    await assert.rejects(f.room.create(f.board), (error) => error.status === 409 && error.message === "room_exists");
    assert.deepEqual(read(), before);
  } finally { f.storage.close(); }
});
