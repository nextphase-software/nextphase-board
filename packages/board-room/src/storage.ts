// SPDX-License-Identifier: Apache-2.0
export type Value = string | number | null | Uint8Array;
export type Row = Record<string, Value>;
export interface Storage {
  all(sql: string, ...bindings: Value[]): Row[];
  exec(sql: string, ...bindings: Value[]): void;
  transaction<T>(operation: () => T): T;
}
// The same SQL and columns are used by node:sqlite and Durable Object SQLite.
export const tables: Record<string, string[]> = {
  meta: ["key", "value"],
  edits: ["revision", "person_id", "request_id", "update"],
  receipts: ["person_id", "request_id", "digest", "revision"],
  waiting: ["connection_id", "sequence", "message_bytes", "received_at", "deadline", "request_id", "update"],
  snapshot_chunks: ["snapshot_revision", "kind", "chunk_index", "bytes"],
  grants: ["person_id", "role", "epoch", "change_number"],
  identifiers: ["object_id", "generation", "first_revision"],
  tickets: ["digest", "person_id", "token_expires_at", "expires_at"],
};
export const binaryColumns: Record<string, string> = { edits: "update", waiting: "update", snapshot_chunks: "bytes" };
export function initialize(storage: Storage) {
  const statements = [
    'CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value INTEGER NOT NULL)',
    'CREATE TABLE IF NOT EXISTS edits (revision INTEGER PRIMARY KEY, person_id TEXT NOT NULL, request_id TEXT NOT NULL, "update" BLOB NOT NULL)',
    'CREATE TABLE IF NOT EXISTS receipts (person_id TEXT, request_id TEXT, digest TEXT NOT NULL, revision INTEGER NOT NULL, PRIMARY KEY(person_id, request_id))',
    'CREATE TABLE IF NOT EXISTS waiting (connection_id TEXT, sequence INTEGER, message_bytes INTEGER NOT NULL, received_at INTEGER NOT NULL, deadline INTEGER NOT NULL, request_id TEXT NOT NULL, "update" BLOB NOT NULL, PRIMARY KEY(connection_id, sequence))',
    'CREATE TABLE IF NOT EXISTS snapshot_chunks (snapshot_revision INTEGER, kind TEXT, chunk_index INTEGER, bytes BLOB NOT NULL, PRIMARY KEY(snapshot_revision, kind, chunk_index))',
    'CREATE TABLE IF NOT EXISTS grants (person_id TEXT PRIMARY KEY, role TEXT NOT NULL, epoch INTEGER NOT NULL, change_number INTEGER NOT NULL)',
    'CREATE TABLE IF NOT EXISTS identifiers (object_id TEXT PRIMARY KEY, generation TEXT UNIQUE NOT NULL, first_revision INTEGER NOT NULL)',
    'CREATE TABLE IF NOT EXISTS tickets (digest TEXT PRIMARY KEY, person_id TEXT NOT NULL, token_expires_at INTEGER NOT NULL, expires_at INTEGER NOT NULL)',
  ];
  for (const sql of statements) storage.exec(sql);
}
export function meta(storage: Storage, key: string): number {
  return Number(storage.all("SELECT value FROM meta WHERE key = ?", key)[0]?.value ?? 0);
}
export function setMeta(storage: Storage, key: string, value: number) {
  storage.exec("INSERT INTO meta(key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value", key, value);
}
export function insert(storage: Storage, table: string, row: Row) {
  const columns = tables[table];
  storage.exec(`INSERT INTO "${table}" (${columns.map((key) => `"${key}"`).join(",")}) VALUES (${columns.map(() => "?").join(",")})`,
    ...columns.map((key) => row[key]));
}
