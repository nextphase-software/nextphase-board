// SPDX-License-Identifier: Apache-2.0
import { type Board, canonical, validate } from "./document.ts";
import { boardKeys, entryDefaults, fingerprint, LIST_KEY, parseList, recordBoardKey, serializeList, type BoardEntry } from "./board-catalog.ts";
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
export async function readPair(pair: Pair, key = "original") {
  boardKeys(key);
  if (pair.every((x) => x === undefined)) return null;
  const h = await decode(pair[0]);
  if (key !== "original" && h.board.boardId !== key) throw Error("Inconsistent board key");
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
  key: string;
  constructor(name = "nextphase-board", key = "original") {
    boardKeys(key);
    this.name = name;
    this.key = key;
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
      const keys = boardKeys(this.key);
      const h = s.get(keys.head), p = s.get(keys.previous);
      t.oncomplete = () => resolve([h.result, p.result]);
      t.onabort = () => reject(t.error ?? Error("Read aborted"));
      t.onerror = () => {};
    });
  }
  save(b: Board, revision: number, creating = false) {
    const captured = structuredClone(b), payload = canonical(captured);
    const run = async () => {
      if (!this.active || !this.db) throw Error("Writer closed");
      const sha256 = await digest(payload);
      if (!this.active) throw Error("Writer closed");
      const current = await readPair(this.expected, this.key);
      if (this.key !== "original" && captured.boardId !== this.key) throw Error("Inconsistent board key");
      if (current && current.board.boardId !== captured.boardId) throw Error("Inconsistent board identity");
      if (creating && current) throw Error("Board already exists");
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
      if (new TextEncoder().encode(raw).length > 4194304) throw Error("Saved envelope too large");
      const savedAt = Date.now();
      await new Promise<void>((resolve, reject) => {
        if (!this.active || !this.db) return reject(Error("Writer closed"));
        const t = this.db.transaction("boards", "readwrite", {
          durability: "strict",
        });
        this.transactions.add(t);
        const s = t.objectStore("boards");
        const keys = boardKeys(this.key);
        const h = s.get(keys.head), p = s.get(keys.previous), list = s.get(LIST_KEY);
        let failure: Error | null = null;
        list.onsuccess = () => {
          if (
            !this.active || h.result !== expected[0] || p.result !== expected[1] ||
            creating && (h.result !== undefined || p.result !== undefined)
          ) {
            failure = Error(
              "Saved data changed. Reload explicitly before editing.",
            );
            this.active = false;
            t.abort();
            return;
          }
          if (expected[0] !== undefined) s.put(expected[0], keys.previous);
          s.put(raw, keys.head);
          const entries = parseList(list.result), old = entries.find((e) => e.key === this.key);
          const entry: BoardEntry = { key: this.key, boardId: captured.boardId, title: captured.title, savedAt,
            fromFile: creating || (revision === 0 && (old?.fromFile ?? false)),
            head: `${storageRevision}:${sha256}`, state: "valid" };
          s.put(serializeList([...entries.filter((e) => e.key !== this.key), entry]), LIST_KEY);
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
  create(b: Board) {
    if (this.key === "original") throw Error("A file requires a new board key");
    return this.save(b, 0, true);
  }
  // Enumerate keys first, then request only recognised values. Foreign records are never read.
  records(mode: IDBTransactionMode = "readonly", compare?: Map<string, unknown>, list?: string): Promise<Map<string, unknown>> {
    return new Promise((resolve, reject) => {
      if (!this.db) return reject(Error("Storage unavailable"));
      const t = this.db.transaction("boards", mode, mode === "readwrite" ? { durability: "strict" } : undefined);
      this.transactions.add(t);
      const s = t.objectStore("boards"), keys = s.getAllKeys(), records = new Map<string, unknown>();
      keys.onsuccess = () => {
        const recognised = keys.result.filter((k): k is string => typeof k === "string" && (k === LIST_KEY || recordBoardKey(k) !== null));
        let remaining = recognised.length;
        const finish = () => {
          if (compare && list !== undefined && records.size === compare.size &&
            [...records].every(([k, v]) => compare.has(k) && sameValue(v, compare.get(k)))) s.put(list, LIST_KEY);
        };
        if (!remaining) finish();
        for (const key of recognised) {
          const request = s.get(key);
          request.onsuccess = () => { records.set(key, request.result); if (!--remaining) finish(); };
        }
      };
      t.oncomplete = () => { this.transactions.delete(t); resolve(records); };
      t.onabort = () => { this.transactions.delete(t); reject(t.error ?? Error("List read aborted")); };
      t.onerror = () => {};
    });
  }
  async refreshList(): Promise<BoardEntry[]> {
    const records = await this.records(), old = parseList(records.get(LIST_KEY));
    const keys = new Set([...records.keys()].map(recordBoardKey).filter((k): k is string => k !== null));
    const entries = await Promise.all([...keys].map(async (key): Promise<BoardEntry> => {
      const names = boardKeys(key), pair: Pair = [records.get(names.head), records.get(names.previous)];
      const prior = old.find((e) => e.key === key), head = fingerprint(pair[0]);
      try {
        const loaded = await readPair(pair, key);
        if (!loaded) throw Error("Absent pair");
        const matches = head !== null && prior?.head === head;
        return { key, boardId: loaded.board.boardId, title: loaded.board.title,
          savedAt: matches ? prior.savedAt : null,
          fromFile: matches ? prior.fromFile : key !== "original" && loaded.envelope.storageRevision === 1 && pair[1] === undefined,
          head, state: "valid" };
      } catch {
        const newer = pair.some((raw) => {
          try {
            const e = typeof raw === "string" ? JSON.parse(raw) : null;
            if (Number.isSafeInteger(e?.formatVersion) && e.formatVersion > 1) return true;
            const b = typeof e?.payload === "string" ? JSON.parse(e.payload) : null;
            return Number.isSafeInteger(b?.schemaVersion) && b.schemaVersion > 9;
          } catch { return false; }
        });
        return { ...(prior ?? entryDefaults(key)), head, state: newer ? "newer" : "damaged" };
      }
    }));
    const raw = serializeList(entries);
    if (raw !== records.get(LIST_KEY)) await this.records("readwrite", records, raw);
    return entries;
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
function sameValue(a: unknown, b: unknown, seen = new Map<object, object>()): boolean {
  if (Object.is(a, b)) return true;
  if (!a || !b || typeof a !== "object" || typeof b !== "object") return false;
  if (Object.getPrototypeOf(a) !== Object.getPrototypeOf(b)) return false;
  if (seen.has(a)) return seen.get(a) === b;
  seen.set(a, b);
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  if (a instanceof RegExp && b instanceof RegExp) return String(a) === String(b);
  if (a instanceof ArrayBuffer && b instanceof ArrayBuffer) {
    return a.byteLength === b.byteLength && new Uint8Array(a).every((v, i) => v === new Uint8Array(b)[i]);
  }
  if (ArrayBuffer.isView(a) && ArrayBuffer.isView(b)) {
    return a.byteLength === b.byteLength && sameValue(a.buffer.slice(a.byteOffset, a.byteOffset + a.byteLength), b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), seen);
  }
  if (a instanceof Map && b instanceof Map) return sameValue([...a], [...b], seen);
  if (a instanceof Set && b instanceof Set) return sameValue([...a], [...b], seen);
  if (Object.getPrototypeOf(a) !== Object.prototype && !Array.isArray(a)) return false;
  if (Array.isArray(a) && Array.isArray(b) && a.length !== b.length) return false;
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every((key) => Object.hasOwn(b, key) &&
    sameValue((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key], seen));
}
