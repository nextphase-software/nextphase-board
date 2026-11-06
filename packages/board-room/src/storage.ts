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
  waiting: ["connection_id", "sequence", "message_bytes", "received_at", "deadline", "request_id", "update", "restore_generation"],
  snapshot_chunks: ["snapshot_revision", "kind", "chunk_index", "bytes"],
  grants: ["person_id", "role", "epoch", "change_number"],
  identifiers: ["object_id", "generation", "first_revision"],
  threads: ["id", "author_id", "person", "label", "anchor", "resolved", "created_at", "updated_at", "sequence", "first_comment"],
  comments: ["id", "thread_id", "author_id", "person", "label", "text", "created_at", "edited_at", "sequence", "mentions"],
  comment_ids: ["id", "kind", "sequence"],
  comment_counts: ["person_id", "hour", "kind", "count"],
  mention_targets: ["comment_id", "recipient", "person", "lease", "occurrence", "source_order", "thread_id", "created_at"],
  mention_pending: ["comment_id", "recipient", "source_order"],
  versions: ["id", "ordinal", "captured_at", "revision", "generation", "reason", "name", "description", "actor", "named_by", "source_name"],
  version_chunks: ["version_id", "chunk_index", "bytes"],
  history_requests: ["person_id", "request_id", "digest", "operation", "result"],
  history_intent_chunks: ["person_id", "request_id", "kind", "chunk_index", "bytes"],
  tickets: ["digest", "person_id", "token_expires_at", "expires_at", "label"],
};
export const binaryColumns: Record<string, string> = { edits: "update", waiting: "update", snapshot_chunks: "bytes", version_chunks: "bytes", history_intent_chunks: "bytes" };
export function initialize(storage: Storage) {
  const statements = [
    'CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value INTEGER NOT NULL)',
    'CREATE TABLE IF NOT EXISTS edits (revision INTEGER PRIMARY KEY, person_id TEXT NOT NULL, request_id TEXT NOT NULL, "update" BLOB NOT NULL)',
    "CREATE TABLE IF NOT EXISTS receipts (person_id TEXT, request_id TEXT, digest TEXT NOT NULL, revision INTEGER NOT NULL, kind TEXT NOT NULL DEFAULT 'edit', PRIMARY KEY(person_id, request_id))",
    'CREATE TABLE IF NOT EXISTS waiting (connection_id TEXT, sequence INTEGER, message_bytes INTEGER NOT NULL, received_at INTEGER NOT NULL, deadline INTEGER NOT NULL, request_id TEXT NOT NULL, "update" BLOB NOT NULL, restore_generation INTEGER NOT NULL, PRIMARY KEY(connection_id, sequence))',
    'CREATE TABLE IF NOT EXISTS snapshot_chunks (snapshot_revision INTEGER, kind TEXT, chunk_index INTEGER, bytes BLOB NOT NULL, PRIMARY KEY(snapshot_revision, kind, chunk_index))',
    'CREATE TABLE IF NOT EXISTS grants (person_id TEXT PRIMARY KEY, role TEXT NOT NULL, epoch INTEGER NOT NULL, change_number INTEGER NOT NULL)',
    'CREATE TABLE IF NOT EXISTS identifiers (object_id TEXT PRIMARY KEY, generation TEXT UNIQUE NOT NULL, first_revision INTEGER NOT NULL)',
    "CREATE TABLE IF NOT EXISTS tickets (digest TEXT PRIMARY KEY, person_id TEXT NOT NULL, token_expires_at INTEGER NOT NULL, expires_at INTEGER NOT NULL, label TEXT NOT NULL DEFAULT '')",
  ];
  storage.transaction(() => {
    for (const sql of statements) storage.exec(sql);
    storage.exec('CREATE TABLE IF NOT EXISTS threads (id TEXT PRIMARY KEY, author_id TEXT NOT NULL, person TEXT NOT NULL, label TEXT NOT NULL, anchor TEXT NOT NULL, resolved INTEGER NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, sequence INTEGER NOT NULL, first_comment TEXT NOT NULL)');
    storage.exec("CREATE TABLE IF NOT EXISTS comments (id TEXT PRIMARY KEY, thread_id TEXT NOT NULL, author_id TEXT NOT NULL, person TEXT NOT NULL, label TEXT NOT NULL, text TEXT NOT NULL, created_at INTEGER NOT NULL, edited_at INTEGER, sequence INTEGER NOT NULL, mentions TEXT NOT NULL DEFAULT '[]')");
    storage.exec('CREATE INDEX IF NOT EXISTS comments_thread_sequence ON comments(thread_id, sequence)');
    storage.exec('CREATE TABLE IF NOT EXISTS comment_ids (id TEXT PRIMARY KEY, kind TEXT NOT NULL, sequence INTEGER NOT NULL)');
    storage.exec('CREATE TABLE IF NOT EXISTS comment_counts (person_id TEXT, hour INTEGER, kind TEXT, count INTEGER NOT NULL, PRIMARY KEY(person_id, hour, kind))');
    storage.exec("CREATE TABLE IF NOT EXISTS mention_targets (comment_id TEXT, recipient TEXT, person TEXT NOT NULL, lease TEXT NOT NULL, occurrence TEXT NOT NULL UNIQUE, source_order INTEGER NOT NULL, thread_id TEXT NOT NULL, created_at INTEGER NOT NULL, PRIMARY KEY(comment_id, recipient))");
    storage.exec("CREATE TABLE IF NOT EXISTS mention_pending (comment_id TEXT, recipient TEXT, source_order INTEGER NOT NULL, PRIMARY KEY(comment_id, recipient))");
    storage.exec('CREATE TABLE IF NOT EXISTS versions (id TEXT PRIMARY KEY, ordinal INTEGER UNIQUE NOT NULL, captured_at INTEGER NOT NULL, revision INTEGER NOT NULL, generation INTEGER NOT NULL, reason TEXT NOT NULL, name TEXT NOT NULL, description TEXT NOT NULL, actor TEXT, named_by TEXT, source_name TEXT NOT NULL)');
    storage.exec('CREATE TABLE IF NOT EXISTS version_chunks (version_id TEXT, chunk_index INTEGER, bytes BLOB NOT NULL, PRIMARY KEY(version_id, chunk_index))');
    storage.exec('CREATE TABLE IF NOT EXISTS history_requests (person_id TEXT, request_id TEXT, digest TEXT NOT NULL, operation TEXT NOT NULL, result TEXT NOT NULL, PRIMARY KEY(person_id, request_id))');
    storage.exec('CREATE TABLE IF NOT EXISTS history_intent_chunks (person_id TEXT, request_id TEXT, kind TEXT, chunk_index INTEGER, bytes BLOB NOT NULL, PRIMARY KEY(person_id, request_id, kind, chunk_index))');
    const version = meta(storage, "storage_version");
    if (version !== 0 && version !== 5) throw Error("storage_unsupported");
  });
}
export function meta(storage: Storage, key: string): number {
  return Number(storage.all("SELECT value FROM meta WHERE key = ?", key)[0]?.value ?? 0);
}
export function setMeta(storage: Storage, key: string, value: string | number) {
  storage.exec("INSERT INTO meta(key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value", key, value);
}
export function insert(storage: Storage, table: string, row: Row) {
  const columns = tables[table];
  storage.exec(`INSERT INTO "${table}" (${columns.map((key) => `"${key}"`).join(",")}) VALUES (${columns.map(() => "?").join(",")})`,
    ...columns.map((key) => row[key]));
}
