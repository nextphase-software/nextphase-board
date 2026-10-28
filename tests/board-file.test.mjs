// SPDX-License-Identifier: Apache-2.0
import test from "node:test";
import assert from "node:assert/strict";
import { add, canonical, empty, upgrade } from "../apps/web/src/document.ts";
import { createConnector } from "../apps/web/src/connectors.ts";
import { digest } from "../apps/web/src/storage.ts";
import { boardFileName, FILE_LIMIT, readBoardFile, writeBoardFile } from "../apps/web/src/board-file.ts";

const file = (raw) => {
  const bytes = typeof raw === "string" ? new TextEncoder().encode(raw) : raw;
  return { size: bytes.length, arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) };
};
const envelope = async (payload, changes = {}) => JSON.stringify({ format: "nextphase-board", fileVersion: 1, payload, sha256: await digest(payload), ...changes });
function versionBoard(version) {
  let board = { ...empty(), title: "Synthetic 你好 🧭" };
  board = add(add(board, "sticky", 0, 0), "text", 400, 0);
  board.objects[0].text = "Formatted\n你好 🧭";
  board.retiredGenerations = [crypto.randomUUID(), crypto.randomUUID()].sort();
  if (version >= 3) {
    const group = crypto.randomUUID(); board.objects.forEach((o) => { o.group = group; });
  }
  if (version >= 4) board.objects[0].marks = [{ start: 0, end: 3, bold: true, italic: true, strike: true }];
  if (version >= 5) {
    board = add(board, "section", 0, 0);
    board.objects.slice(0, 2).forEach((o) => { o.section = board.objects[2].id; });
  }
  if (version >= 6) {
    board = add(board, "shape", 800, 0);
    board.objects.at(-1).shape = "circle";
  }
  if (version >= 7) board = createConnector(board, board.objects[0].id, board.objects[1].id).board;
  return { ...board, schemaVersion: version, objects: board.objects.map((object) => {
    const o = { ...object };
    if (version < 2) { delete o.color; delete o.textSize; delete o.align; }
    if (version < 3) delete o.group;
    if (version < 4) delete o.marks;
    if (version < 5) delete o.section;
    return o;
  }) };
}
for (let version = 1; version <= 8; version++) test(`version ${version} file round-trip preserves exact payload and identities`, async () => {
  const board = versionBoard(version), before = structuredClone(board), payload = canonical(board);
  const raw = await writeBoardFile(board), parsed = JSON.parse(raw);
  assert.deepEqual(Object.keys(parsed), ["format", "fileVersion", "payload", "sha256"]);
  assert.equal(parsed.payload, payload); assert.equal(parsed.sha256, await digest(payload));
  assert.equal(raw, JSON.stringify(parsed));
  const restored = await readBoardFile(file(raw));
  assert.deepEqual(restored, board); assert.equal(canonical(restored), payload); assert.deepEqual(board, before);
  const shown = upgrade(board);
  assert.equal(JSON.parse(await writeBoardFile(shown, board)).payload, payload);
  const edited = { ...shown, title: "Edited unsaved title" };
  assert.equal(JSON.parse(await writeBoardFile(edited)).payload, canonical(edited));
  assert.equal(JSON.parse(JSON.parse(await writeBoardFile(edited)).payload).schemaVersion, 8);
});

test("ordered file checks refuse each malformed input with its exact first reason", async () => {
  const payload = canonical(versionBoard(7)), good = await envelope(payload), e = JSON.parse(good);
  const cases = [
    ["not JSON", "it is not a Board file"],
    ["null", "it is not a Board file"],
    ["[]", "it is not a Board file"],
    [JSON.stringify({ fileVersion: 1, format: e.format, payload, sha256: e.sha256 }), "it is not a Board file"],
    [JSON.stringify({ ...e, extra: 1 }), "it is not a Board file"],
    [JSON.stringify(e, null, 2), "it is not a Board file"],
    ["\ufeff" + good, "it is not a Board file"],
    [new Uint8Array([0xc3, 0x28]), "it is not a Board file"],
    [await envelope(payload, { format: "other" }), "it is not a Board file"],
    [await envelope(payload, { fileVersion: 2 }), "it was made by a newer version of Board"],
    [await envelope(payload, { fileVersion: "1" }), "it is not a Board file"],
    [await envelope(payload, { fileVersion: 0 }), "it is not a Board file"],
    [await envelope(payload, { payload: {} }), "it is not a Board file"],
    [await envelope(payload, { sha256: null }), "it is not a Board file"],
    [await envelope(payload, { sha256: e.sha256.toUpperCase() }), "it is damaged"],
    [await envelope(payload, { sha256: "0".repeat(64) }), "it is damaged"],
    [await envelope("not JSON"), "it is not a valid board"],
    [await envelope(JSON.stringify({ schemaVersion: 9 })), "it was made by a newer version of Board"],
    [await envelope(JSON.stringify({ schemaVersion: 7 })), "it is not a valid board"],
    [await envelope(payload.replace('"title":', '"title" :')), "it is not a valid board"],
    [await envelope(JSON.stringify({ ...versionBoard(1), objects: versionBoard(2).objects })), "it is not a valid board"],
    // Earlier checks take precedence over all later failures.
    [await envelope("bad", { format: "other", fileVersion: 2 }), "it is not a Board file"],
    [await envelope("bad", { fileVersion: 2, sha256: 1 }), "it was made by a newer version of Board"],
    [await envelope("bad", { sha256: "0".repeat(64) }), "it is damaged"],
  ];
  for (const [raw, reason] of cases) await assert.rejects(readBoardFile(file(raw)), { message: reason });
});

test("the byte limit is checked before reading, including the exact boundary", async () => {
  let read = false;
  await assert.rejects(readBoardFile({ size: FILE_LIMIT + 1, arrayBuffer() { read = true; throw Error(); } }), { message: "it is larger than 4 MB" });
  assert.equal(read, false);
  await assert.rejects(readBoardFile(file(" ".repeat(FILE_LIMIT))), { message: "it is not a Board file" });
  await assert.rejects(readBoardFile(file(" ".repeat(FILE_LIMIT + 1))), { message: "it is larger than 4 MB" });
});

test("file names replace each forbidden character and keep other Unicode", () => {
  for (const c of '<>:"/\\|?*' + Array.from({ length: 32 }, (_, i) => String.fromCharCode(i)).join("") + "\x7f") {
    assert.equal(boardFileName(`a${c}b`), "a_b.nextboard");
  }
  for (const suffix of [".", " ", " . .  "]) assert.equal(boardFileName("Board" + suffix), "Board_.nextboard");
  for (const device of ["CON", "PRN", "AUX", "NUL", ...Array.from({ length: 10 }, (_, i) => `COM${i}`), ...Array.from({ length: 10 }, (_, i) => `LPT${i}`)]) {
    for (const name of [device, device.toLowerCase(), device + ".txt", device.toLowerCase() + ".json"]) assert.equal(boardFileName(name), "_" + name + ".nextboard");
  }
  assert.equal(boardFileName(""), "Untitled board.nextboard");
  assert.equal(boardFileName("你好 🧭 café"), "你好 🧭 café.nextboard");
  assert.equal(boardFileName("CONNECTION"), "CONNECTION.nextboard");
});
