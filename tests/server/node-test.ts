// SPDX-License-Identifier: Apache-2.0
import { readFile } from "node:fs/promises";
import { Supabase } from "../../apps/server/src/supabase.ts";
import { startNode } from "../../apps/server/src/start-node.ts";
import { checkSettings } from "../../apps/server/src/settings.ts";
const settings = checkSettings(JSON.parse(await readFile(process.env.BOARD_SETTINGS!, "utf8")));
let fixedNow: number | null = null;
let offset = 0, unreachable: string[] = [];
let failCreate = "", failCheckpoint = "", failHistory = "";
const instrumented = new WeakSet<object>();
const db = new Supabase(settings.supabaseUrl, settings.serviceKey);
const documentGeneration = db.documentGeneration.bind(db), mentionGeneration = db.mentionGeneration.bind(db);
db.documentGeneration = board => failCheckpoint === "document" ? Promise.reject(Error("Document checkpoint unavailable")) : documentGeneration(board);
db.mentionGeneration = board => failCheckpoint === "mention" ? Promise.reject(Error("Mention checkpoint unavailable")) : mentionGeneration(board);
const app = await startNode(settings, { db, now: () => fixedNow ?? Date.now() + offset, backupLimit: 16777216,
  deliveryIntervalMs: Number(process.env.BOARD_DELIVERY_INTERVAL_MS ?? 0) });
const original = app.runtime.room;
app.runtime.room = (board) => {
  const room = original(board);
  const entry = app.rooms.get(board)!;
  if (!instrumented.has(entry)) {
    instrumented.add(entry);
    const exec = entry.storage.exec.bind(entry.storage), raise = entry.room.env.raiseFence;
    entry.storage.exec = (sql, ...args) => {
      if (failHistory === "capture" && sql.startsWith("INSERT INTO versions") ||
        failHistory === "intent" && sql.startsWith("INSERT INTO history_requests") ||
        failHistory === "local" && sql.startsWith("INSERT INTO versions") && args[5] === "before_restore" ||
        failHistory === "cleanup" && sql.startsWith("DELETE FROM history_intent_chunks")) throw Error("History transaction unavailable");
      exec(sql,...args);
    };
    entry.room.env.raiseFence = async minimum => {
      if (failHistory === "fence") throw Error("Fence unavailable");
      const result = await raise(minimum);
      if (failHistory === "after-fence") throw Error("Fence answer unavailable");
      return result;
    };
  }
  return { versions: p => room.versions(p), version: (p,id) => room.version(p,id), saveVersion: (p,v) => room.saveVersion(p,v), nameVersion: (p,id,v) => room.nameVersion(p,id,v), restoreVersion: (p,id,v) => room.restoreVersion(p,id,v), async create(document) {
    if (failCreate === "before") throw Error("Create unavailable");
    const entry = app.rooms.get(board)!;
    if (failCreate === "exists") await entry.room.ordered(() => entry.room.load());
    const exec = entry.storage.exec.bind(entry.storage);
    if (failCreate === "write") entry.storage.exec = (sql, ...values) => {
      if (sql.startsWith("INSERT INTO snapshot_chunks")) throw Error("Snapshot write unavailable");
      exec(sql, ...values);
    };
    try { await room.create(document); }
    finally { entry.storage.exec = exec; }
    if (failCreate === "after") throw Error("Create reply unavailable");
  }, rename: (p, title) => room.rename(p, title), ticket: (p) => room.ticket(p), export: (p) => room.export(p), backup: () => room.backup(), restore: (v) => room.restore(v),
    discussion: (p, id, occurrence) => room.discussion(p, id, occurrence), deliverNotices: () => room.deliverNotices(),
    changed: () => unreachable.includes(board) ? Promise.reject(Error("Room unavailable")) : room.changed() };
};
process.on("message", async (message: any) => {
  try {
    let result: any = {};
    const value = message.value;
    if (value.failHistory !== undefined) failHistory = value.failHistory;
    if (value.failCheckpoint !== undefined) failCheckpoint = value.failCheckpoint;
    if (value.fences) result = await app.fences.read(value.board);
    if (value.failCreate !== undefined) failCreate = value.failCreate;
    if (value.fixedNow !== undefined) fixedNow = value.fixedNow;
    if (value.offset !== undefined) offset = value.offset;
    if (value.unreachable) unreachable = value.unreachable;
    if (value.backupLimit !== undefined) for (const entry of app.rooms.values()) entry.room.env.backupLimit = value.backupLimit;
    if (value.board) {
      // Resolve the room through the same lazy factory as production.
      original(value.board);
      const entry = app.rooms.get(value.board)!;
      if (value.legacyStorage !== undefined) {
        entry.storage.transaction(() => {
          for (const table of ["threads", "comments", "comment_ids", "comment_counts"]) entry.storage.exec(`DROP TABLE IF EXISTS "${table}"`);
          if (entry.storage.all("PRAGMA table_info(receipts)").some((column) => column.name === "kind")) entry.storage.exec("ALTER TABLE receipts DROP COLUMN kind");
          entry.storage.exec("DELETE FROM meta WHERE key IN ('storage_version', 'comment_sequence')");
          if (value.legacyStorage) entry.storage.exec("INSERT INTO meta VALUES ('storage_version', ?)", value.legacyStorage);
        });
        entry.room.initialized = false;
      }
      if (value.roomSQL) await entry.room.ordered(async () => { for (const item of value.roomSQL) entry.storage.exec(item.sql, ...(item.bindings ?? [])); });
      if (value.failInitialization) {
        const execute=entry.storage.exec.bind(entry.storage); entry.storage.exec=(sql,...args)=>{if(sql.includes("CREATE TABLE IF NOT EXISTS mention_pending"))throw Error("initialization rollback");execute(sql,...args);};
        try { const {initialize}=await import("../../packages/board-room/src/storage.ts"); initialize(entry.storage); } finally { entry.storage.exec=execute; }
      }
      if (value.deliverMentions) await entry.room.deliverNotices();
      if (value.rows) result = entry.storage.all(`SELECT * FROM "${value.rows}"`).map((row) => Object.fromEntries(Object.entries(row).map(([k, v]) => [k, v instanceof Uint8Array ? { bytes: v.byteLength } : v])));
      if (value.raiseFence) result = await entry.room.lock();
      if (value.fileSnapshot) entry.storage.exec("VACUUM INTO ?", value.fileSnapshot);
      if (value.alarm) await entry.room.alarm();
      if (value.reload) {
        for (const connection of entry.connections) connection.close(1001);
        clearTimeout(entry.timer); entry.storage.close(); app.rooms.delete(value.board);
      }
    }
    if (value.alarmAll) for (const entry of app.rooms.values()) await entry.room.alarm();
    if (value.shutdown) { await app.close(); process.send?.({ id: message.id, result: {} }); process.exit(0); }
    result = value.now ? Date.now() + offset : result;
    process.send?.({ id: message.id, result });
  } catch (error) { process.send?.({ id: message.id, error: (error as Error).message }); }
});
process.send?.({ ready: true, port: app.port });
