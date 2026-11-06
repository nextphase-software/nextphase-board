// SPDX-License-Identifier: Apache-2.0
import test from "node:test";
import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { richBoard, sizedBoard, imageBoard } from "./import-fixture.mjs";

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
  ["file over 72 MiB", () => ({ size: 75497473, arrayBuffer: () => assert.fail("Oversized file was read") }), 0],
  ["not a Board file", () => file("not JSON"), 1],
  ["damaged file", () => file(envelope("{}", { sha256: "0".repeat(64) })), 2],
  ["not a valid board", () => file(envelope("{}")), 3],
  ["newer Board file", () => file(envelope("{}", { fileVersion: 3 })), 4],
]) test(`team import refuses ${name} with the reader's exact words without sending`, async () => {
  const { importBoard } = await import("../apps/web/src/team/import.ts");
  const { FILE_REASONS } = await import("../apps/web/src/board-file.ts");
  await refused(importBoard, input(), FILE_REASONS[index]);
});
for (const version of [1, 2]) test(`team import refuses pictures in file version ${version} before decoding or sending`, async () => {
  const { importBoard, PICTURES_REASON } = await import("../apps/web/src/team/import.ts");
  const { canonical } = await import("../packages/board-rules/src/document.ts");
  const { writeBoardFile } = await import("../apps/web/src/board-file.ts");
  const bytes = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10, 1]).buffer;
  const hash = createHash("sha256").update(new Uint8Array(bytes)).digest("hex"), board = imageBoard(hash);
  const raw = version === 1 ? envelope(canonical(board)) : await writeBoardFile(board, undefined,
    new Map([[hash, { bytes, mime: "image/png", pixelWidth: 2, pixelHeight: 2 }]]));
  assert.equal(PICTURES_REASON, "it holds pictures, which team boards can't hold yet");
  await refused(importBoard, file(raw), PICTURES_REASON);
});
test("team import refuses a document of 2097153 canonical bytes without sending", async () => {
  const { importBoard } = await import("../apps/web/src/team/import.ts");
  const board = sizedBoard(2097153);
  assert.equal(Buffer.byteLength(JSON.stringify(board)), 2097153);
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
  const board = { ...richBoard(), schemaVersion: 9 }, bodies = [];
  await importBoard(file(envelope(canonical(board))), async (body) => { bodies.push(body); });
  assert.deepEqual(bodies, [{ title: board.title, document: { ...board, schemaVersion: 10 } }]);
});

async function roomFixture() {
  const { Room } = await import("../packages/board-room/src/room.ts");
  const { NodeStorage } = await import("../apps/server/src/node-storage.ts");
  const storage = new NodeStorage(":memory:"), board = richBoard(), now = Date.now();
  const environment = { storage, access: {
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
    assert.equal(meta(f.storage, "revision"), 0); assert.equal(meta(f.storage, "storage_version"), 4);
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
