// SPDX-License-Identifier: Apache-2.0
import { empty } from "../../apps/web/src/document";
import { LocalStore, readPair } from "../../apps/web/src/storage";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw Error(message);
}
async function rejects(action: Promise<unknown>, label: string) {
  let failed = false;
  try {
    await action;
  } catch {
    failed = true;
  }
  assert(failed, label + " unexpectedly succeeded");
}
async function run() {
  const name = "nextphase-board-test-" + crypto.randomUUID();
  const store = new LocalStore(name);
  const other = new LocalStore(name);
  const results: string[] = [];
  try {
    await store.open(() => {});
    const board = { ...empty(), title: "Synthetic fixture" };
    const first = store.save(board, 1);
    board.title = "Changed after capture";
    const second = store.save({ ...board, title: "Later capture" }, 2);
    const receipts = await Promise.all([first, second]);
    assert(
      receipts[0].storageRevision === 1 && receipts[1].storageRevision === 2,
      "FIFO receipts",
    );
    let pair = await store.read();
    let loaded = await readPair(pair);
    assert(loaded?.board.title === "Later capture", "FIFO latest payload");
    assert(
      (await readPair([pair[1], undefined]))?.board.title ===
        "Synthetic fixture",
      "Immutable capture",
    );
    results.push(
      "PASS: immutable capture, FIFO receipts and independently decoded head/previous.",
    );

    const original = JSON.stringify(pair);
    const transaction = store.db!.transaction.bind(store.db!);
    // Test-only fault injection: abort the actual IndexedDB write transaction.
    // This exercises the production rejection path; it does not simulate quota.
    store.db!.transaction =
      ((...args: Parameters<IDBDatabase["transaction"]>) => {
        const tx = transaction(...args);
        if (args[1] === "readwrite") queueMicrotask(() => tx.abort());
        return tx;
      }) as IDBDatabase["transaction"];
    await rejects(
      store.save({ ...board, title: "Aborted capture" }, 3),
      "Real transaction abort",
    );
    store.db!.transaction = transaction;
    assert(
      JSON.stringify(await store.read()) === original,
      "Abort changed saved bytes",
    );
    const retry = await store.save({ ...board, title: "Successful retry" }, 4);
    assert(retry.storageRevision === 3, "Failed write advanced revision");
    results.push(
      "PASS: real aborted save rejects, preserves both records and permits explicit retry.",
    );

    await other.open(() => {});
    await other.save({ ...board, title: "Competing connection capture" }, 5);
    pair = await other.read();
    const stale = store.save({ ...board, title: "Stale capture" }, 6);
    const queued = store.save({ ...board, title: "Queued stale capture" }, 7);
    await Promise.all([
      rejects(stale, "CAS conflict"),
      rejects(queued, "Queued conflict"),
    ]);
    assert(
      JSON.stringify(await other.read()) === JSON.stringify(pair),
      "CAS conflict overwrote bytes",
    );
    assert(!store.active, "CAS conflict failed to invalidate writer");
    results.push(
      "PASS: stale complete-pair CAS rejects, invalidates writer and rejects queued writes.",
    );

    store.close();
    const reopened = new LocalStore(name);
    try {
      loaded = await readPair(await reopened.open(() => {}));
      assert(
        loaded?.board.title === "Competing connection capture",
        "Fresh connection recovery",
      );
      results.push(
        "PASS: fresh connection recovers last acknowledged revision.",
      );
    } finally {
      reopened.close();
    }
    document.body.textContent = results.join("\n") +
      "\nDisposable synthetic database only. No app records touched.";
    document.body.style.whiteSpace = "pre-wrap";
  } finally {
    store.close();
    other.close();
    indexedDB.deleteDatabase(name);
  }
}
run().catch((error) => {
  document.body.textContent = "FAIL: " + String(error);
});
