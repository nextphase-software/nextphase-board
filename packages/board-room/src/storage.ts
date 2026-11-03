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
  receipts: ["person_id", "request_id", "digest", "revision", "kind"],
  waiting: ["connection_id", "sequence", "message_bytes", "received_at", "deadline", "request_id", "update"],
  snapshot_chunks: ["snapshot_revision", "kind", "chunk_index", "bytes"],
  grants: ["person_id", "role", "epoch", "change_number"],
  identifiers: ["object_id", "generation", "first_revision"],
  threads: ["id", "author_id", "person", "label", "anchor", "resolved", "created_at", "updated_at", "sequence", "first_comment"],
  comments: ["id", "thread_id", "author_id", "person", "label", "text", "created_at", "edited_at", "sequence"],
  comment_ids: ["id", "kind", "sequence"],
  comment_counts: ["person_id", "hour", "kind", "count"],
  tickets: ["digest", "person_id", "token_expires_at", "expires_at", "label"],
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
  storage.transaction(() => {
    for (const sql of statements) storage.exec(sql);
    storage.exec('CREATE TABLE IF NOT EXISTS threads (id TEXT PRIMARY KEY, author_id TEXT NOT NULL, person TEXT NOT NULL, label TEXT NOT NULL, anchor TEXT NOT NULL, resolved INTEGER NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, sequence INTEGER NOT NULL, first_comment TEXT NOT NULL)');
    storage.exec('CREATE TABLE IF NOT EXISTS comments (id TEXT PRIMARY KEY, thread_id TEXT NOT NULL, author_id TEXT NOT NULL, person TEXT NOT NULL, label TEXT NOT NULL, text TEXT NOT NULL, created_at INTEGER NOT NULL, edited_at INTEGER, sequence INTEGER NOT NULL)');
    storage.exec('CREATE INDEX IF NOT EXISTS comments_thread_sequence ON comments(thread_id, sequence)');
    storage.exec('CREATE TABLE IF NOT EXISTS comment_ids (id TEXT PRIMARY KEY, kind TEXT NOT NULL, sequence INTEGER NOT NULL)');
    storage.exec('CREATE TABLE IF NOT EXISTS comment_counts (person_id TEXT, hour INTEGER, kind TEXT, count INTEGER NOT NULL, PRIMARY KEY(person_id, hour, kind))');
    if (!storage.all("PRAGMA table_info(tickets)").some((column) => column.name === "label")) {
      storage.exec("ALTER TABLE tickets ADD COLUMN label TEXT NOT NULL DEFAULT ''");
      storage.exec("DELETE FROM tickets");
    }
    if (!storage.all("PRAGMA table_info(receipts)").some((column) => column.name === "kind")) {
      storage.exec("ALTER TABLE receipts ADD COLUMN kind TEXT NOT NULL DEFAULT 'edit'");
    }
    const version = meta(storage, "storage_version");
    if (version === 1 || version === 2 || !version && storage.all("SELECT 1 FROM snapshot_chunks LIMIT 1").length) {
      setMeta(storage, "storage_version", 3);
    }
  });
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
