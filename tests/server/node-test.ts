// SPDX-License-Identifier: Apache-2.0
import { readFile } from "node:fs/promises";
import { startNode } from "../../apps/server/src/start-node.ts";
import { checkSettings } from "../../apps/server/src/settings.ts";
const settings = checkSettings(JSON.parse(await readFile(process.env.BOARD_SETTINGS!, "utf8")));
let fixedNow: number | null = null;
let offset = 0, unreachable: string[] = [];
const app = await startNode(settings, { now: () => fixedNow ?? Date.now() + offset, backupLimit: 16777216 });
const original = app.runtime.room;
app.runtime.room = (board) => {
  const room = original(board);
  return { rename: (p, title) => room.rename(p, title), ticket: (p) => room.ticket(p), export: (p) => room.export(p), backup: () => room.backup(), restore: (v) => room.restore(v),
    changed: () => unreachable.includes(board) ? Promise.reject(Error("Room unavailable")) : room.changed() };
};
process.on("message", async (message: any) => {
  try {
    let result: any = {};
    const value = message.value;
    if (value.fixedNow !== undefined) fixedNow = value.fixedNow;
    if (value.offset !== undefined) offset = value.offset;
    if (value.unreachable) unreachable = value.unreachable;
    if (value.backupLimit !== undefined) for (const entry of app.rooms.values()) entry.room.env.backupLimit = value.backupLimit;
    if (value.board) {
      // Resolve the room through the same lazy factory as production.
      original(value.board);
      const entry = app.rooms.get(value.board)!;
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
