// SPDX-License-Identifier: Apache-2.0
import test from "node:test";
import assert from "node:assert/strict";
import { canonical, empty } from "../apps/web/src/document.ts";
import { decode, digest, readPair } from "../apps/web/src/storage.ts";
const b = { ...empty(), title: "Storage" };
const wrap = async (revision, board = b) =>
  JSON.stringify({
    formatVersion: 1,
    storageRevision: revision,
    payload: canonical(board),
    sha256: await digest(canonical(board)),
  });
test("absent, initial and consecutive saved pair validation", async () => {
  assert.equal(await readPair([undefined, undefined]), null);
  assert.equal(
    (await readPair([await wrap(1), undefined])).board.title,
    "Storage",
  );
  assert.equal(
    (await readPair([await wrap(2), await wrap(1)])).envelope.storageRevision,
    2,
  );
});
test("reject inconsistent, corrupt and unknown data without altering raw bytes", async () => {
  for (
    const pair of [
      [undefined, await wrap(1)],
      [await wrap(2), undefined],
      [await wrap(3), await wrap(1)],
      [await wrap(2), await wrap(1, { ...b, boardId: crypto.randomUUID() })],
      ["unsupported", undefined],
    ]
  ) {
    const copy = structuredClone(pair);
    await assert.rejects(readPair(pair));
    assert.deepEqual(pair, copy);
  }
  const raw = await wrap(1);
  await assert.rejects(decode(raw.replace("Storage", "Changed")));
  await assert.rejects(
    decode(raw.replace('"formatVersion":1', '"formatVersion":2')),
  );
});
