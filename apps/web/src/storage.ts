// SPDX-License-Identifier: Apache-2.0
import { type Board, canonical, validate } from "./document.ts";
export type Pair = [unknown, unknown];
export type Envelope = {
  formatVersion: 1;
  storageRevision: number;
  payload: string;
  sha256: string;
};
export const digest = async (s: string) =>
  Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)),
    ),
    (v) => v.toString(16).padStart(2, "0"),
  ).join("");
export async function decode(raw: unknown) {
  if (
    typeof raw !== "string" || new TextEncoder().encode(raw).length > 4194304
  ) throw Error("Unknown saved data");
  const e = JSON.parse(raw) as Envelope;
  if (
    !e ||
    Object.keys(e).sort().join("|") !==
      "formatVersion|payload|sha256|storageRevision" ||
    e.formatVersion !== 1 || !Number.isSafeInteger(e.storageRevision) ||
    e.storageRevision < 1 || typeof e.payload !== "string" ||
    typeof e.sha256 !== "string" || !/^[a-f0-9]{64}$/.test(e.sha256) ||
    JSON.stringify({
        formatVersion: 1,
        storageRevision: e.storageRevision,
        payload: e.payload,
        sha256: e.sha256,
      }) !== raw ||
    await digest(e.payload) !== e.sha256
  ) throw Error("Invalid saved envelope");
  const board = validate(JSON.parse(e.payload));
  if (canonical(board) !== e.payload) {
    throw Error("Noncanonical saved document");
  }
  return { envelope: e, board };
}
export async function readPair(pair: Pair) {
  if (pair.every((x) => x === undefined)) return null;
  const h = await decode(pair[0]);
  if (h.envelope.storageRevision === 1) {
    if (pair[1] !== undefined) throw Error("Inconsistent saved pair");
  } else {
    const p = await decode(pair[1]);
    if (
      p.board.boardId !== h.board.boardId ||
      p.envelope.storageRevision !== h.envelope.storageRevision - 1
    ) throw Error("Inconsistent saved pair");
  }
  return h;
}
export class LocalStore {
  db: IDBDatabase | null = null;
  expected: Pair = [undefined, undefined];
  active = true;
  tail: Promise<unknown> = Promise.resolve();
  transactions = new Set<IDBTransaction>();
  name: string;
  constructor(name = "nextphase-board") {
    this.name = name;
  }
  async open(onUnavailable: () => void) {
    this.db = await new Promise<IDBDatabase>((resolve, reject) => {
      const r = indexedDB.open(this.name, 1);
      r.onupgradeneeded = () => r.result.createObjectStore("boards");
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
      r.onblocked = () => reject(Error("Database is open in another version"));
    });
    this.db.onversionchange = () => {
      this.close();
      onUnavailable();
    };
    this.expected = await this.read();
    return this.expected;
  }
  read(): Promise<Pair> {
    return new Promise((resolve, reject) => {
      if (!this.db) return reject(Error("Storage unavailable"));
      const t = this.db.transaction("boards", "readonly"),
        s = t.objectStore("boards");
      const h = s.get("head"), p = s.get("previous");
      t.oncomplete = () => resolve([h.result, p.result]);
      t.onabort = () => reject(t.error ?? Error("Read aborted"));
      t.onerror = () => {};
    });
  }
  save(b: Board, revision: number) {
    const payload = canonical(structuredClone(b));
    const run = async () => {
      if (!this.active || !this.db) throw Error("Writer closed");
      const sha256 = await digest(payload);
      if (!this.active) throw Error("Writer closed");
      const current = await readPair(this.expected);
      const storageRevision = (current?.envelope.storageRevision ?? 0) + 1;
      if (!Number.isSafeInteger(storageRevision)) {
        throw Error("Storage revision exhausted");
      }
      const raw = JSON.stringify({
        formatVersion: 1,
        storageRevision,
        payload,
        sha256,
      });
      const expected = [...this.expected];
      await new Promise<void>((resolve, reject) => {
        if (!this.active || !this.db) return reject(Error("Writer closed"));
        const t = this.db.transaction("boards", "readwrite", {
          durability: "strict",
        });
        this.transactions.add(t);
        const s = t.objectStore("boards");
        const h = s.get("head"), p = s.get("previous");
        let failure: Error | null = null;
        p.onsuccess = () => {
          if (
            !this.active || h.result !== expected[0] || p.result !== expected[1]
          ) {
            failure = Error(
              "Saved data changed. Reload explicitly before editing.",
            );
            this.active = false;
            t.abort();
            return;
          }
          if (expected[0] !== undefined) s.put(expected[0], "previous");
          s.put(raw, "head");
        };
        t.oncomplete = () => {
          this.transactions.delete(t);
          this.expected = [raw, expected[0]];
          resolve();
        };
        t.onabort = () => {
          this.transactions.delete(t);
          reject(failure ?? t.error ?? Error("Save aborted"));
        };
        t.onerror = () => {};
      });
      return { draftRevision: revision, storageRevision };
    };
    const result = this.tail.then(run);
    this.tail = result.catch(() => {});
    return result;
  }
  close() {
    this.active = false;
    for (const t of this.transactions) {
      try {
        t.abort();
      } catch {}
    }
    this.transactions.clear();
    this.db?.close();
    this.db = null;
  }
}
