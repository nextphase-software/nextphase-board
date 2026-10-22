// SPDX-License-Identifier: Apache-2.0
import { canonical, empty } from "../../apps/web/src/document";
import { digest, LocalStore, readPair } from "../../apps/web/src/storage";

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
    for (const key of ["head", "previous"]) {
      const isolated = new LocalStore(name + "-same-counter-" + key);
      try {
        await isolated.open(() => {});
        await isolated.save({ ...board, title: "First" }, 1);
        await isolated.save({ ...board, title: "Second" }, 2);
        const pair = await isolated.read();
        const envelope = JSON.parse(pair[key === "head" ? 0 : 1] as string);
        const changed = { ...JSON.parse(envelope.payload), title: "External same-counter edit" };
        envelope.payload = canonical(changed);
        envelope.sha256 = await digest(envelope.payload);
        await new Promise<void>((resolve, reject) => {
          const tx = isolated.db!.transaction("boards", "readwrite");
          tx.objectStore("boards").put(JSON.stringify(envelope), key);
          tx.oncomplete = () => resolve(); tx.onabort = () => reject(tx.error);
        });
        const changedBytes = JSON.stringify(await isolated.read());
        await rejects(isolated.save(board, 3), "Same-counter " + key + " conflict");
        assert(!isolated.active, "Same-counter conflict left writer active");
        assert(JSON.stringify(await isolated.read()) === changedBytes, "Conflict overwrote " + key);
      } finally { isolated.close(); indexedDB.deleteDatabase(isolated.name); }
    }
    results.push("PASS: same-counter head and previous payload changes reject without overwriting either record.");

    const queuedStore = new LocalStore(name + "-preparation");
    const originalDigest = crypto.subtle.digest.bind(crypto.subtle);
    let releaseHash!: () => void, hashStarted!: () => void, calls = 0;
    const gate = new Promise<void>((resolve) => releaseHash = resolve);
    const started = new Promise<void>((resolve) => hashStarted = resolve);
    try {
      await queuedStore.open(() => {});
      crypto.subtle.digest = ((...args: Parameters<SubtleCrypto["digest"]>) => {
        calls++;
        if (calls === 1) { hashStarted(); return gate.then(() => originalDigest(...args)); }
        return originalDigest(...args);
      }) as SubtleCrypto["digest"];
      const first = queuedStore.save({ ...board, title: "Slow first preparation" }, 1);
      const second = queuedStore.save({ ...board, title: "Fast second preparation" }, 2);
      await started;
      assert(calls === 1, "Second preparation overtook FIFO");
      releaseHash();
      const receipts = await Promise.all([first, second]);
      assert(receipts[0].storageRevision === 1 && receipts[1].storageRevision === 2, "Preparation reordered receipts");
      assert((await readPair(await queuedStore.read()))?.board.title === "Fast second preparation", "Wrong FIFO result");
    } finally {
      releaseHash(); crypto.subtle.digest = originalDigest;
      queuedStore.close(); indexedDB.deleteDatabase(queuedStore.name);
    }
    results.push("PASS: delayed first hash and immediately eligible second hash remain FIFO.");

    const failed = new LocalStore(name + "-quota");
    try {
      await failed.open(() => {}); await failed.save(board, 1);
      const original = JSON.stringify(await failed.read());
      const transaction = failed.db!.transaction.bind(failed.db!);
      failed.db!.transaction = ((...args: Parameters<IDBDatabase["transaction"]>) => {
        if (args[1] === "readwrite") throw new DOMException("Injected fixture quota error", "QuotaExceededError");
        return transaction(...args);
      }) as IDBDatabase["transaction"];
      await rejects(failed.save({ ...board, title: "Failed quota capture" }, 2), "Injected quota");
      assert(JSON.stringify(await failed.read()) === original, "Injected quota changed saved bytes");
      failed.db!.transaction = transaction;
      assert((await failed.save(board, 3)).storageRevision === 2, "Explicit retry skipped revision");
      failed.close(); await rejects(failed.save(board, 4), "Closed writer");
    } finally { failed.close(); indexedDB.deleteDatabase(failed.name); }
    results.push("PASS: injected quota/unavailable writer failures preserve bytes and allow explicit retry only while active.");
    const interrupted = new LocalStore(name + "-interrupted");
    let unblock!: () => void, preparing!: () => void;
    const held = new Promise<void>((resolve) => unblock = resolve);
    const preparingStarted = new Promise<void>((resolve) => preparing = resolve);
    try {
      await interrupted.open(() => {}); await interrupted.save(board, 1);
      const original = JSON.stringify(await interrupted.read());
      crypto.subtle.digest = ((...args: Parameters<SubtleCrypto["digest"]>) => {
        preparing(); return held.then(() => originalDigest(...args));
      }) as SubtleCrypto["digest"];
      const active = rejects(interrupted.save({ ...board, title: "Interrupted preparation" }, 2), "Interrupted preparation");
      const queued = rejects(interrupted.save({ ...board, title: "Queued after interruption" }, 3), "Interrupted queue");
      await preparingStarted; interrupted.close(); unblock();
      await Promise.all([active, queued]);
      crypto.subtle.digest = originalDigest;
      const recovered = new LocalStore(interrupted.name);
      try {
        await recovered.open(() => {});
        assert(JSON.stringify(await recovered.read()) === original, "Interrupted writer changed saved records");
      } finally { recovered.close(); }
    } finally {
      unblock(); crypto.subtle.digest = originalDigest;
      interrupted.close(); indexedDB.deleteDatabase(interrupted.name);
    }
    results.push("PASS: closing an interrupted preparing writer cancels active/queued saves and preserves acknowledged records.");
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
