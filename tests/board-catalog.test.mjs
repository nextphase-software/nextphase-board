// SPDX-License-Identifier: Apache-2.0
import test from "node:test";
import assert from "node:assert/strict";
import { canonical, empty } from "../apps/web/src/document.ts";
import { LocalStore, digest, readPair } from "../apps/web/src/storage.ts";
import { boardKeys, isBoardKey, recordBoardKey, fingerprint, LIST_KEY, entryDefaults, parseList, serializeList, orderedBoards, savedTime, boardStatus } from "../apps/web/src/board-catalog.ts";
const id = "10000000-0000-4000-8000-000000000001", other = "20000000-0000-4000-8000-000000000002";
const board = (boardId = id, title = "Synthetic board") => ({ ...empty(), boardId, title });
const wrap = async (b, revision = 1) => {
  const payload = canonical(b);
  return JSON.stringify({ formatVersion: 1, storageRevision: revision, payload, sha256: await digest(payload) });
};
const entry = (key = "original", changes = {}) => ({ ...entryDefaults(key), boardId: key === "original" ? id : key, title: "Synthetic board", state: "valid", ...changes });

test("only recognised board and record keys produce the contracted lock names", () => {
  assert.deepEqual(boardKeys("original"), { head: "head", previous: "previous", lock: "nextphase-board/writer/v1" });
  assert.deepEqual(boardKeys(id), { head: `board/${id}/head`, previous: `board/${id}/previous`, lock: `nextphase-board/writer/v1/${id}` });
  for (const key of [null, 1, "", "head", "../head", id.toUpperCase().replace("100", "ABC"), id.replace("-4", "-3")]) {
    assert.equal(isBoardKey(key), false); assert.throws(() => boardKeys(key));
  }
  for (const key of ["head", "previous"]) assert.equal(recordBoardKey(key), "original");
  assert.equal(recordBoardKey(`board/${id}/head`), id);
  for (const key of [LIST_KEY, "foreign", `board/${id}/extra`, "board/invalid/head", 1]) assert.equal(recordBoardKey(key), null);
});

test("catalog requires its exact serialized shape and key order with nullable defaults", () => {
  const entries = [entry(other), entry(id), entry("original")], raw = serializeList(entries);
  assert.deepEqual(parseList(raw).map((e) => e.key), [id, other, "original"]);
  assert.equal(raw, JSON.stringify({ formatVersion: 1, boards: [entries[1], entries[0], entries[2]] }));
  assert.deepEqual(entryDefaults(id), { key: id, boardId: null, title: "", savedAt: null, fromFile: false, head: null, state: "damaged" });
  for (const state of ["valid", "damaged", "newer"]) assert.equal(parseList(serializeList([entry(id, { state, boardId: null, savedAt: null, head: null })]))[0].state, state);
  const malformed = [undefined, 1, {}, "bad", "null", JSON.stringify({ formatVersion: 2, boards: [] }),
    JSON.stringify({ boards: [], formatVersion: 1 }), serializeList([entry(id), entry(id)]),
    serializeList([entry("foreign")]), JSON.stringify({ formatVersion: 1, boards: [{ title: "Synthetic board", ...entry(id) }] }),
    raw + " ", JSON.stringify({ formatVersion: 1, boards: [], extra: true })];
  for (const changes of [{ boardId: 1 }, { boardId: "bad" }, { savedAt: -1 }, { savedAt: 1.5 }, { savedAt: Number.MAX_SAFE_INTEGER + 1 }, { fromFile: 1 }, { head: 1 }, { title: null }, { state: "other" }]) malformed.push(serializeList([entry(id, changes)]));
  for (const value of malformed) assert.deepEqual(parseList(value), [], String(value));
});

test("catalog sorts newest first, unknown last and key ties in code-unit order", () => {
  const entries = [entry("original"), entry(other, { savedAt: 10 }), entry(id, { savedAt: 10 }), entry(crypto.randomUUID(), { savedAt: 20 })];
  assert.deepEqual(orderedBoards(entries).map((e) => e.key), [entries[3].key, id, other, "original"]);
});

test("status lines cover every current, read-only, lock, state, saved-time and file combination", () => {
  const now = new Date(2026, 9, 27, 12), time = new Date(2026, 9, 27, 9, 5).getTime();
  for (const current of [true, false]) for (const readOnly of [true, false]) for (const another of [true, false]) for (const state of ["valid", "damaged", "newer"]) for (const savedAt of [null, time]) for (const fromFile of [true, false]) {
    const parts = [];
    if (current) parts.push("open here"); if (another && (!current || readOnly)) parts.push("open in another tab");
    parts.push(state === "valid" ? savedAt === null ? "saved time unavailable" : "saved today 09:05"
      : (current ? "" : "can't be opened: ") + (state === "damaged" ? "damaged" : "made by a newer version of Board"));
    if (fromFile && state === "valid") parts.push("from file");
    const expected = parts.join(" · ");
    assert.equal(boardStatus(entry(id, { state, savedAt, fromFile }), current, another, readOnly, now), expected[0].toUpperCase() + expected.slice(1));
  }
});

test("another-tab wording distinguishes editable and read-only current rows", () => {
  const e = entry(id);
  assert.equal(boardStatus(e, true, true, false), "Open here · saved time unavailable");
  assert.equal(boardStatus(e, true, true, true), "Open here · open in another tab · saved time unavailable");
  assert.equal(boardStatus(e, true, false, true), "Open here · saved time unavailable");
  for (const readOnly of [false, true]) {
    assert.equal(boardStatus(e, false, true, readOnly), "Open in another tab · saved time unavailable");
  }
});

test("saved times use local calendar dates, English months, two digits and future years", () => {
  const now = new Date(2026, 9, 27, 0, 1);
  const cases = [
    [new Date(2026, 9, 27, 0, 0), "today 00:00"],
    [new Date(2026, 9, 26, 23, 59), "yesterday 23:59"],
    [new Date(2026, 9, 24, 9, 3), "24 Oct 09:03"],
    [new Date(2025, 9, 24, 9, 3), "24 Oct 2025 09:03"],
    [new Date(2026, 9, 27, 0, 2), "27 Oct 2026 00:02"],
    [new Date(2027, 0, 1, 9, 3), "1 Jan 2027 09:03"],
  ];
  for (const [date, result] of cases) assert.equal(savedTime(date.getTime(), now), result);
  assert.equal(savedTime(null, now), null); assert.equal(savedTime(Number.MAX_SAFE_INTEGER, now), null);
  assert.equal(boardStatus(entry(id, { savedAt: Number.MAX_SAFE_INTEGER }), false, false, false, now), "Saved time unavailable");
  assert.equal(savedTime(new Date(2025, 11, 31, 23, 59).getTime(), new Date(2026, 0, 1, 0, 1)), "yesterday 23:59");
});

// A transactional in-memory IndexedDB double. Writes become visible together only
// on completion; queued transactions observe the preceding committed transaction.
function database(initial = []) {
  const data = new Map(initial), transactions = [], reads = [], writes = [];
  let queue = Promise.resolve(), afterReadonly = null, failWrite = false;
  const db = {
    close() {},
    transaction(_store, mode, options) {
      let pending = 0, started = false, aborted = false, completed = false, local;
      const jobs = [], puts = [];
      let done;
      const finished = new Promise((resolve) => { done = resolve; });
      const previous = queue; queue = finished;
      const t = { mode, options, error: null,
        abort() { if (completed || aborted) return; aborted = true; setImmediate(() => { t.onabort?.(); done(); }); },
        objectStore() { return {
          get(key) { reads.push(key); return request(() => local.get(key)); },
          getAllKeys() { return request(() => [...local.keys()].sort()); },
          put(value, key) { puts.push(key); return request(() => { if (mode !== "readwrite") throw Error("Read-only write"); local.set(key, structuredClone(value)); return key; }); },
        }; },
      };
      transactions.push(t);
      function settle() {
        setImmediate(() => {
          if (pending || aborted || completed) return;
          if (mode === "readwrite" && failWrite) { failWrite = false; t.error = Error("Simulated abort"); t.abort(); return; }
          completed = true;
          if (mode === "readwrite") { data.clear(); for (const [key, value] of local) data.set(key, value); writes.push(...puts); }
          else if (afterReadonly) { const action = afterReadonly; afterReadonly = null; action(data); }
          t.oncomplete?.(); done();
        });
      }
      function request(action) {
        const r = {}; pending++;
        const run = () => setImmediate(() => {
          if (aborted) return;
          try { r.result = structuredClone(action()); r.onsuccess?.(); }
          catch (error) { t.error = error; t.abort(); }
          pending--; settle();
        });
        if (started) run(); else jobs.push(run);
        return r;
      }
      previous.then(() => { started = true; local = structuredClone(data); jobs.forEach((run) => run()); settle(); });
      return t;
    },
  };
  function store(key = "original", expected = [undefined, undefined]) {
    const s = new LocalStore("synthetic", key); s.db = db; s.expected = expected; return s;
  }
  return { data, transactions, reads, writes, store,
    race(action) { afterReadonly = action; }, fail() { failWrite = true; } };
}

test("strict saves atomically write their pair and list entry, preserving all other records", async () => {
  const original = await wrap(board()), previous = await wrap(board(id, "Older"));
  const originalHead = await wrap(board(id, "Original"), 2);
  const d = database([["head", originalHead], ["previous", previous], ["foreign", "never read"], [LIST_KEY, serializeList([entry()])]]);
  const s = d.store(other), b = board(other);
  await s.create(b);
  assert.deepEqual(d.data.get("head"), originalHead); assert.equal(d.data.get("previous"), previous);
  assert.equal(d.data.get(boardKeys(other).previous), undefined);
  let list = parseList(d.data.get(LIST_KEY));
  assert.equal(list.find((e) => e.key === other).fromFile, true);
  assert(Number.isSafeInteger(list.find((e) => e.key === other).savedAt));
  assert.equal(list.find((e) => e.key === "original").title, "Synthetic board");
  assert.deepEqual(d.transactions[0].options, { durability: "strict" });
  await s.save(b, 0);
  assert.equal(parseList(d.data.get(LIST_KEY)).find((e) => e.key === other).fromFile, true);
  const first = d.data.get(boardKeys(other).head);
  await s.save({ ...b, title: "Edited" }, 1);
  list = parseList(d.data.get(LIST_KEY));
  assert.equal(list.find((e) => e.key === other).fromFile, false);
  assert.equal(d.data.get(boardKeys(other).previous), first);
  assert.equal((await readPair(s.expected, other)).envelope.storageRevision, 3);
  await s.refreshList();
  assert.equal(d.data.get("head"), originalHead); assert.equal(d.data.get("previous"), previous);
  assert(!d.reads.includes("foreign")); assert(!d.writes.includes("foreign"));
  assert.equal(fingerprint(original), `1:${JSON.parse(original).sha256}`);
});

test("the first save after an edit clears from-file even when undo restored the same payload", async () => {
  const d = database(), s = d.store(id), b = board(id);
  await s.create(b); await s.save(b, 2);
  assert.equal(parseList(d.data.get(LIST_KEY))[0].fromFile, false);
});

test("save captures document and catalog metadata before queued preparation", async () => {
  const d = database(), s = d.store(id), b = board(id, "Captured");
  const result = s.create(b); b.title = "Later mutation";
  await result;
  assert.equal(parseList(d.data.get(LIST_KEY))[0].title, "Captured");
  assert.equal((await readPair(s.expected, id)).board.title, "Captured");
});

test("two stores saving different boards retain both catalog entries and compare only their own pairs", async () => {
  const d = database(), a = d.store(id), b = d.store(other);
  await Promise.all([a.create(board(id)), b.create(board(other))]);
  assert.deepEqual(parseList(d.data.get(LIST_KEY)).map((e) => e.key), [id, other]);
  await Promise.all([a.save(board(id, "A edited"), 1), b.save(board(other, "B edited"), 1)]);
  assert.deepEqual(parseList(d.data.get(LIST_KEY)).map((e) => e.title), ["A edited", "B edited"]);
  const before = structuredClone(d.data);
  d.fail(); await assert.rejects(a.save(board(id, "Aborted"), 2));
  assert.deepEqual(d.data, before);
  await a.save(board(id, "Retry"), 3);
  d.data.set(boardKeys(id).previous, "changed previous");
  const changed = structuredClone(d.data);
  await assert.rejects(a.save(board(id, "Conflict"), 4), /changed/); assert.equal(a.active, false);
  assert.deepEqual(d.data, changed);
});

test("creation refuses either occupied key and leaves all bytes unchanged", async () => {
  for (const key of [boardKeys(id).head, boardKeys(id).previous]) {
    const d = database([[key, "occupied"]]), before = structuredClone(d.data);
    await assert.rejects(d.store(id).create(board(id)), /changed/);
    assert.deepEqual(d.data, before);
  }
});

test("refresh rebuilds missing, damaged and stale lists without writing any board record", async () => {
  const original = await wrap(board()), imported = await wrap(board(other));
  for (const raw of [undefined, 123, "broken", serializeList([entry("original", { head: "stale", savedAt: 12 }), entry(id)])]) {
    const d = database([["head", original], [boardKeys(other).head, imported], ["foreign", { private: "unread" }]]);
    if (raw !== undefined) d.data.set(LIST_KEY, raw);
    const entries = await d.store().refreshList();
    assert.deepEqual(entries.map((e) => e.key).sort(), [other, "original"].sort());
    assert.equal(entries.find((e) => e.key === "original").savedAt, null);
    assert.equal(entries.find((e) => e.key === other).fromFile, true);
    assert(d.writes.every((key) => key === LIST_KEY)); assert(!d.reads.includes("foreign"));
    assert.equal(d.data.get("head"), original); assert.equal(d.data.get(boardKeys(other).head), imported);
    const writes = d.writes.length; await d.store().refreshList(); assert.equal(d.writes.length, writes);
  }
});

test("refresh validates both records, carries metadata only on a matching head, and preserves damaged/newer metadata", async () => {
  const first = await wrap(board()), head = await wrap(board(id, "Current"), 2), imported = await wrap(board(other));
  const old = entry("original", { head: fingerprint(head), savedAt: 123, fromFile: true, title: "Old title" });
  const d = database([["head", head], ["previous", first], [LIST_KEY, serializeList([old])]]);
  let [e] = await d.store().refreshList();
  assert.equal(e.savedAt, 123); assert.equal(e.fromFile, true); assert.equal(e.title, "Current");
  d.data.set("previous", "corrupted");
  [e] = await d.store().refreshList(); assert.equal(e.state, "damaged"); assert.equal(e.savedAt, 123); assert.equal(e.title, "Current");
  for (const raw of [undefined, "not JSON", JSON.stringify({ formatVersion: 2 })]) {
    const x = database([["previous", first], [LIST_KEY, serializeList([old])]]);
    if (raw !== undefined) x.data.set("head", raw);
    const [result] = await x.store().refreshList();
    assert.equal(result.state, raw?.includes('"formatVersion":2') ? "newer" : "damaged");
    assert.equal(result.title, "Old title"); assert.equal(result.savedAt, 123); assert.equal(result.fromFile, true);
    assert.equal(result.head, fingerprint(raw));
  }
  const payload = JSON.stringify({ ...board(other), schemaVersion: 9 });
  const future = JSON.stringify({ formatVersion: 1, storageRevision: 1, payload, sha256: await digest(payload) });
  const x = database([[boardKeys(other).head, future]]), [result] = await x.store().refreshList();
  assert.deepEqual(result, { ...entryDefaults(other), head: fingerprint(future), state: "newer" });
  const y = database([[boardKeys(other).head, imported], [LIST_KEY, serializeList([entry(other, { head: "stale", savedAt: 42, fromFile: false })])]]);
  const [fresh] = await y.store().refreshList(); assert.equal(fresh.savedAt, null); assert.equal(fresh.fromFile, true);
  const z = database([[boardKeys(other).head, head]]);
  assert.equal((await z.store().refreshList())[0].state, "damaged");
  await assert.rejects(readPair([head, first], other), /board key/);
});

test("refresh skips list writes on a changed, added, removed record or changed list", async () => {
  const original = await wrap(board());
  for (const mutate of [
    (data) => data.set("head", "changed"),
    (data) => data.set(boardKeys(other).head, "added"),
    (data) => data.delete("head"),
    (data) => data.set(LIST_KEY, "changed list"),
  ]) {
    const d = database([["head", original]]); d.race(mutate);
    await d.store().refreshList(); assert.deepEqual(d.writes, []);
  }
});

test("damaged entries without metadata use defaults, including absent or non-JSON heads", async () => {
  const raw = await wrap(board());
  for (const head of [undefined, "not JSON", 123, JSON.stringify({ storageRevision: 2, sha256: "fingerprint only" })]) {
    const d = database([[boardKeys(id).previous, raw]]);
    if (head !== undefined) d.data.set(boardKeys(id).head, head);
    const [result] = await d.store().refreshList();
    assert.deepEqual(result, { ...entryDefaults(id), head: fingerprint(head) });
    assert(d.writes.every((key) => key === LIST_KEY));
  }
});

test("a null old fingerprint never carries save metadata onto a valid board", async () => {
  const raw = await wrap(board());
  const d = database([["head", raw], [LIST_KEY, serializeList([entry("original", { head: null, savedAt: 123, fromFile: true })])]]);
  const [result] = await d.store().refreshList();
  assert.equal(result.savedAt, null); assert.equal(result.fromFile, false);
});

test("refresh compares malformed structured values without trusting their identity", async () => {
  const raw = { bad: new Map([["key", new Uint8Array([1, 2])]]) };
  raw.cycle = raw;
  const d = database([["head", raw]]);
  const [entry] = await d.store().refreshList();
  assert.equal(entry.state, "damaged"); assert.deepEqual(d.writes, [LIST_KEY]);
  const x = database([["head", raw]]);
  x.race((data) => { data.get("head").bad.get("key")[0] = 9; });
  await x.store().refreshList(); assert.deepEqual(x.writes, []);
});
