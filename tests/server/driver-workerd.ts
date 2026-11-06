// SPDX-License-Identifier: Apache-2.0
import { env, SELF, evictDurableObject, runInDurableObject, createExecutionContext,
  createScheduledController, waitOnExecutionContext } from "cloudflare:test";
import worker from "./worker-test.ts";
import { peer } from "./peer.ts";
import type { Context, Driver } from "./driver-types.ts";
import { decodeBackup, replace } from "../../packages/board-room/src/backups.ts";
const bindings = env as any;
export async function makeDriver(context: Context): Promise<Driver> {
  const rooms = new Set<string>();
  const roomStub = (board: string) => { rooms.add(board); return bindings.ROOMS.get(bindings.ROOMS.idFromName(board)); };
  return {
    runner: "workerd",
    request: (path, init) => {
      const match = /\/boards\/([0-9a-f-]{36})/.exec(path);
      if (match) rooms.add(match[1]);
      return SELF.fetch("http://board" + path, init);
    },
    async connect(path, origin = context.origin) {
      const response = await SELF.fetch("http://board" + path, { headers: { Upgrade: "websocket", Origin: origin } });
      if (response.status !== 101 || !response.webSocket) throw Error("Upgrade refused " + response.status);
      const socket = response.webSocket;
      const result = peer(socket);
      socket.accept();
      return result;
    },
    async control(value) {
      if (value.board && value.fences) {
        const stub = bindings.FENCES.get(bindings.FENCES.idFromName(String(value.board)));
        const result = await stub.fetch('http://fence/read').then((response: Response) => response.json()) as { generation: number };
        return result.generation;
      }
      if (value.board && value.legacyStorage !== undefined) {
        const stub = roomStub(String(value.board));
        await runInDurableObject<DurableObject, void>(stub, async (instance: any) => {
          const room = await instance.getRoom(String(value.board)), storage = room.env.storage;
          await room.ordered(async () => {
            storage.transaction(() => {
              for (const table of ["threads", "comments", "comment_ids", "comment_counts"]) storage.exec(`DROP TABLE IF EXISTS "${table}"`);
              if (storage.all("PRAGMA table_info(receipts)").some((column: any) => column.name === "kind")) storage.exec("ALTER TABLE receipts DROP COLUMN kind");
              storage.exec("DELETE FROM meta WHERE key IN ('storage_version', 'comment_sequence')");
              if (value.legacyStorage) storage.exec("INSERT INTO meta VALUES ('storage_version', ?)", Number(value.legacyStorage));
            });
            room.initialized = false;
          });
        });
        // S121 calls wake() next; it owns eviction before the next storage open.
        return {};
      }
      if (value.board && (value.roomSQL || value.failInitialization || value.deliverMentions)) {
        return runInDurableObject(roomStub(String(value.board)), async (instance:any) => {
          const room=await instance.getRoom(String(value.board)), storage=room.env.storage;
          if(value.roomSQL)await room.ordered(async()=>{for(const item of value.roomSQL)storage.exec(item.sql,...(item.bindings??[]));});
          if(value.failInitialization){const execute=storage.exec.bind(storage);storage.exec=(sql:string,...args:any[])=>{if(sql.includes("CREATE TABLE IF NOT EXISTS mention_pending"))throw Error("initialization rollback");execute(sql,...args);};try{const {initialize}=await import("../../packages/board-room/src/storage.ts");initialize(storage);}finally{storage.exec=execute;}}
          if(value.deliverMentions)await room.deliverNotices();
        });
      }
      if (value.scheduled) {
        const execution = createExecutionContext();
        worker.scheduled(createScheduledController({ cron: "* * * * *" }), bindings, execution);
        await waitOnExecutionContext(execution);
        return {};
      }
      const control = bindings.CONTROLS.get(bindings.CONTROLS.idFromName("controls"));
      const response = await control.fetch("http://controls/", { method: "POST", body: JSON.stringify(value) });
      const result = await response.json();
      if (value.board && value.alarm) await runInDurableObject(roomStub(String(value.board)), async (instance: any) => instance.alarm());
      if (value.alarmAll) for (const board of rooms) await runInDurableObject(roomStub(board), async (instance: any) => instance.alarm());
      if (value.now) return Date.now() + ((result as any).offset ?? 0);
      return result;
    },
    async wake(board) { await evictDurableObject(roomStub(board)); },
    async restoreFile(board, envelope, fenced) {
      const stub = roomStub(board);
      await runInDurableObject(stub, async (instance: any) => {
        const room = await instance.getRoom(board);
        if (fenced) await room.lock();
        await room.ordered(async () => {
          replace(room.env, decodeBackup(envelope, board));
          // A real point-in-time restore replaces storage at the next session.
          // Queued close callbacks must read that copy, not snapshot old RAM.
          room.initialized = false;
        });
      });
      await evictDurableObject(stub);
    },
    async rows(board, table) {
      return runInDurableObject(roomStub(board), async (instance: any) => {
        const room = await instance.getRoom(board);
        return room.env.storage.all(`SELECT * FROM "${table}"`).map((row: any) => Object.fromEntries(
          Object.entries(row).map(([key, value]) => [key, value instanceof Uint8Array ? { bytes: value.byteLength } : value])));
      });
    },
    async close() {
      for (const board of rooms) {
        try { await evictDurableObject(roomStub(board), { webSockets: "close" }); }
        catch (error) { if (!(error instanceof Error) || !error.message.includes("not currently running")) throw error; }
      }
    },
  };
}
