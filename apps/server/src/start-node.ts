// SPDX-License-Identifier: Apache-2.0
import { checkLedger, ledgerRecord, type RecoveryRecord } from "./lifecycle.ts";
import { serve } from "@hono/node-server";
import { WebSocketServer, type WebSocket } from "ws";
import { mkdir, access, readdir, rm } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import { resolve } from "node:path";
import { randomBytes, randomUUID, createHash } from "node:crypto";
import { meta } from "nextphase-board-room/storage.ts";
import { Room, importDeadline, readImport, type ImportStaging } from "nextphase-board-room/room.ts";
import { StagingExpired, TemplateStore } from "nextphase-board-room/template-store.ts";
import { RoomError, type Attachment, type Connection } from "nextphase-board-room/protocol.ts";
import { NodeStorage } from "./node-storage.ts";
import { createApp } from "./app.ts";
import { Auth } from "./auth.ts";
import { Supabase } from "./supabase.ts";
import type { Settings } from "./settings.ts";
import type { Runtime } from "./runtime.ts";
import { deliver } from "./delivery.ts";
const MAX_TIMER_MS = 2 ** 31 - 1;
const boardFile = /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.sqlite$/;

function markedImport(file: string) {
  const db = new DatabaseSync(file, { readOnly: true });
  try {
    const rows = db.prepare("SELECT key,value FROM meta WHERE key IN ('import','storage_version')").all();
    const value = rows.find(row => row.key === "import")?.value;
    return !rows.some(row => row.key === "storage_version") && typeof value === "string" &&
      (JSON.parse(value) as ImportStaging).finishing === true;
  } catch (error) {
    if (error instanceof Error && error.message.includes("no such table: meta")) return false;
    throw error;
  } finally { db.close(); }
}

function eraseUnknown<T extends object>(target: T, erase: () => Promise<void>): T {
  return new Proxy(target, {
    get(instance, key) {
      const value = Reflect.get(instance, key);
      if (typeof value !== "function") return value;
      return async (...args: unknown[]) => {
        try {
          const answer = await value.apply(instance, args);
          if (answer?.discard) await erase();
          return answer;
        } catch (error) {
          if (error instanceof StagingExpired && error.discard) await erase();
          throw error;
        }
      };
    },
  });
}

export type NodeOptions = {
  now?: () => number; db?: Supabase; auth?: Auth; backupLimit?: number;
  deliveryIntervalMs?: number;
  fence?: { read(board: string): Promise<number>; raise(board: string, minimum?: number): Promise<number> };
};
export async function recoveryGeneration(board: string, storage: NodeStorage, db: Supabase, fences: NonNullable<NodeOptions['fence']>) {
  let generation = await fences.read(board);
  if (!meta(storage,"explicit_recovery_pending") && meta(storage, "restore_pending") && !storage.all("SELECT result FROM history_requests WHERE operation = 'restore'").some(r => JSON.parse(String(r.result)).phase)) {
    // A successful mention clear can be newer than a delayed document copy.
    // Neither failed checkpoint read may become an absent/zero checkpoint.
    const document = await db.documentGeneration(board);
    const mentions = await db.mentionGeneration(board);
    const restored = meta(storage, "restore_generation");
    const values = [generation, restored, document, mentions];
    if (!values.every(n => Number.isSafeInteger(n) && n >= 0) || Math.max(...values) >= Number.MAX_SAFE_INTEGER) throw Error("Invalid restore generation");
    const minimum = Math.max(...values);
    generation = await fences.raise(board, minimum);
    if (!Number.isSafeInteger(generation) || generation <= minimum) throw Error("Restore fence did not advance");
  }
  return generation;
}
export async function startNode(settings: Settings, options: NodeOptions = {}) {
  const boardDir = resolve(settings.dataDir, "boards"), templateDir = resolve(settings.dataDir, "template-media");
  await Promise.all([mkdir(boardDir, { recursive: true }), mkdir(templateDir, { recursive: true })]);
  const now = options.now ?? Date.now;
  const db = options.db ?? new Supabase(settings.supabaseUrl, settings.serviceKey);
  const auth = options.auth ?? new Auth(settings, now);
  const fenceFile = resolve(settings.dataDir, "restore-fences.sqlite");
  let fenceStorage: NodeStorage | undefined;
  let existingFence = false;
  try { await access(fenceFile); existingFence = true; } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") existingFence = true; }
  function openFence() {
    if (!fenceStorage) {
      const storage = new NodeStorage(fenceFile);
      try {
        if (existingFence && !storage.all("SELECT name FROM sqlite_master WHERE type='table' AND name='lifecycle_ledger'").length) throw Error("Independent lifecycle ledger missing");
        storage.exec("CREATE TABLE IF NOT EXISTS fences (board_id TEXT PRIMARY KEY, generation INTEGER NOT NULL)");
        storage.exec("CREATE TABLE IF NOT EXISTS lifecycle_ledger (board_id TEXT PRIMARY KEY, record TEXT NOT NULL)");
      }
      catch (error) { storage.close(); throw error; }
      existingFence = true;
      fenceStorage = storage;
    }
    return fenceStorage;
  }
  // A fence outage locks rooms rather than preventing the HTTP app from
  // starting. Later requests retry it, so fixing permissions can recover it.
  try { openFence(); } catch { /* Room fence reads will fail closed. */ }
  const fences = options.fence ?? {
    async read(board: string) {
      await access(fenceFile, 4);
      return Number(openFence().all("SELECT generation FROM fences WHERE board_id = ?", board)[0]?.generation ?? 0); },
    async raise(board: string, minimum = 0) {
      const storage = openFence();
      return storage.transaction(() => {
        const current = Number(storage.all("SELECT generation FROM fences WHERE board_id = ?", board)[0]?.generation ?? 0);
        if (![current, minimum].every(n => Number.isSafeInteger(n) && n >= 0) || Math.max(current, minimum) >= Number.MAX_SAFE_INTEGER) throw Error("Invalid restore generation");
        storage.exec("INSERT INTO fences VALUES (?, ?) ON CONFLICT(board_id) DO UPDATE SET generation=excluded.generation", board, Math.max(current, minimum) + 1);
        return Number(storage.all("SELECT generation FROM fences WHERE board_id = ?", board)[0].generation);
      });
    },
  };
  db.lifecycleGuard = async (board,row,request) => {
    try { await access(fenceFile,4); } catch { throw new RoomError(503,"room_locked"); }
    const storage=openFence();
    const saved=storage.all("SELECT record FROM lifecycle_ledger WHERE board_id=?",board)[0];
    const previous=saved?JSON.parse(String(saved.record)) as RecoveryRecord:null;
    checkLedger(previous,row);
    if(row && !(row.state === "active" && row.cycle === 0)){const record=ledgerRecord(row,request);storage.exec("INSERT INTO lifecycle_ledger VALUES (?,?) ON CONFLICT(board_id) DO UPDATE SET record=excluded.record",board,JSON.stringify(record));}
  };
  const tasks = new Set<Promise<void>>();
  const background = { run(task: Promise<void>) {
    tasks.add(task);
    void task.finally(() => tasks.delete(task)).catch(() => {});
  } };
  const rooms = new Map<string, { room: Room; storage: NodeStorage; connections: Set<Connection>; tasks: Set<Promise<void>>;
    timer?: ReturnType<typeof setTimeout>; reopen?: Promise<void> }>();
  const stores = new Map<string, { store: TemplateStore; storage: NodeStorage; timer?: ReturnType<typeof setTimeout> }>();
  let closing = false;
  function roomEntry(board: string) {
    let entry = rooms.get(board);
    if (entry) return entry;
    const storage = new NodeStorage(resolve(boardDir, board + ".sqlite"));
    const importRoom = storage.all("SELECT 1 FROM sqlite_master WHERE type='table' AND name='meta'").length && readImport(storage);
    if (!importRoom) {
      storage.exec("CREATE TABLE IF NOT EXISTS waiting (connection_id TEXT, sequence INTEGER, message_bytes INTEGER NOT NULL, received_at INTEGER NOT NULL, deadline INTEGER NOT NULL, request_id TEXT NOT NULL, \"update\" BLOB NOT NULL, restore_generation INTEGER NOT NULL, PRIMARY KEY(connection_id, sequence))");
      storage.exec("DELETE FROM waiting");
    }
    const connections = new Set<Connection>();
    const roomTasks = new Set<Promise<void>>();
    const roomBackground = { run(task: Promise<void>) { roomTasks.add(task); background.run(task); void task.finally(() => roomTasks.delete(task)).catch(() => {}); } };
    const room = new Room(board, { storage, access: db, lifecycle: db, rows: db, mentions: db, background: roomBackground, now,
      fence: () => recoveryGeneration(board, storage, db, fences), raiseFence: (minimum) => fences.raise(board, minimum),
      hasher() {
        const hash = createHash("sha256");
        return { async update(chunk) { hash.update(chunk); }, async hex() { return hash.digest("hex"); }, abort() { hash.destroy(); } };
      },
      timer(ms, callback) { const timer = setTimeout(callback, ms).unref(); return () => clearTimeout(timer); },
      hash: async (value) => createHash("sha256").update(value).digest("hex"), randomTicket: () => randomBytes(32).toString("base64url"),
      randomId: randomUUID, verify: (token) => auth.verify(token), connections: () => [...connections],
      backupLimit: runtime.backupLimit,
      async schedule(at) {
        const current = rooms.get(board);
        if (!current) return;
        clearTimeout(current.timer);
        if (!closing && at !== null && !room.lifecycle.discarded) {
          // Node treats longer delays as 1 ms. The room rechecks deadlines when woken.
          const delay = Math.min(MAX_TIMER_MS, Math.max(1, at - now()));
          current.timer = setTimeout(() => background.run(roomAlarm(board, current.room)), delay);
          current.timer.unref();
        }
      },
    });
    entry = { room, storage, connections, tasks: roomTasks };
    rooms.set(board, entry);
    if (importRoom) {
      entry.reopen = room.ordered(() => room.schedule());
      background.run(entry.reopen);
    }
    return entry;
  }
  async function roomAlarm(board: string, room: Room) {
    if ((await room.alarm())?.discard && rooms.get(board)?.room === room) await runtime.removeRoom(board);
  }
  function templateEntry(upload: string) {
    const existing = stores.get(upload);
    if (existing) return existing.store;
    const storage = new NodeStorage(resolve(templateDir, upload + ".sqlite"));
    const store = new TemplateStore({ storage, now, randomId: randomUUID, async schedule(at) {
      const current = stores.get(upload);
      if (!current) return;
      clearTimeout(current.timer);
      if (closing || at === null) return;
      const delay = Math.min(MAX_TIMER_MS, Math.max(1, at - now()));
      current.timer = setTimeout(() => background.run((async () => {
        if ((await store.alarm())?.discard && stores.get(upload)?.store === store) await runtime.removeTemplateMedia(upload);
      })()), delay).unref();
    } });
    stores.set(upload, { store, storage });
    background.run(store.reopen());
    return store;
  }
  async function eraseFiles(dir: string, name: string) {
    for (const suffix of ["", "-wal", "-shm"]) {
      const file = resolve(dir, name + ".sqlite" + suffix);
      await rm(file, { force: true });
      try { await access(file); throw Error("Storage discard not confirmed"); }
      catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
    }
  }
  const upgrades = new WeakMap<Request, { board: string; attachment: Attachment }>();
  const runtime: Runtime = { backupLimit: options.backupLimit ?? 234_881_024, now, async fenceGeneration(board) {
      const independent=await fences.read(board),entry=rooms.get(board);
      if(entry)return Math.max(independent,meta(entry.storage,"restore_generation"));
      const file=resolve(settings.dataDir,"boards",board+".sqlite");
      try {await access(file);} catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return independent;throw error;}
      const saved=new NodeStorage(file);
      try{return Math.max(independent,meta(saved,"restore_generation"));}finally{saved.close();}
    }, auth, db, allowedOrigin: settings.allowedOrigin, operatorKey: settings.operatorKey,
    room: (board) => eraseUnknown(roomEntry(board).room, () => runtime.removeRoom(board)),
    templateMedia(upload) {
      const store = eraseUnknown(templateEntry(upload), () => runtime.removeTemplateMedia(upload));
      return {
        open: store.open, begin: store.begin, end: store.end, stage: store.stage, commit: store.commit,
        async inventory() {
          const inventory = await store.inventory();
          return Array.isArray(inventory) ? inventory : [];
        },
        async read(hash) {
          const value = await store.read(hash);
          if (!value) await store.inventory();
          return value;
        },
      };
    },
    async removeTemplateMedia(upload) {
      const entry = stores.get(upload);
      if (entry) {
        await entry.store.discard();
        clearTimeout(entry.timer);
        stores.delete(upload);
        entry.storage.close();
      }
      await eraseFiles(templateDir, upload);
    },
    async removeRoom(board, generation) {
      if (generation !== undefined && await fences.read(board) < generation) {
        if (await fences.raise(board, generation - 1) !== generation) throw new RoomError(503, "service_unavailable");
      }
      const entry = rooms.get(board);
      if (entry) {
        await entry.room.discardLifecycle();
        clearTimeout(entry.timer);
        // Copies settle through the room queue, so drain them outside that queue.
        while (entry.tasks.size) await Promise.allSettled([...entry.tasks]);
        await entry.room.ordered(async () => {
          clearTimeout(entry.timer);
          rooms.delete(board);
          entry.storage.close();
        });
      }
      await eraseFiles(boardDir, board);
    },
    async upgrade(board, ticket, request) {
      const attachment = await roomEntry(board).room.join(ticket);
      if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") throw new RoomError(400, "bad_request");
      upgrades.set(request, { board, attachment });
      return new Response(null);
    },
  };
  for (const file of await readdir(boardDir)) {
    const name = boardFile.exec(file);
    if (!name || !markedImport(resolve(boardDir, file))) continue;
    const board = name[1], { room, storage, reopen } = roomEntry(board);
    await reopen;
    const staged = readImport(storage);
    if (staged && importDeadline(staged) <= now()) await roomAlarm(board, room);
  }
  const app = createApp(runtime);
  const interval = options.deliveryIntervalMs ?? 60000;
  const deliveryTimer = interval > 0 ? setInterval(() => background.run(deliver(runtime)), interval) : undefined;
  deliveryTimer?.unref();
  const server = serve({ fetch: app.fetch, port: settings.port ?? 8788, hostname: "0.0.0.0" });
  const sockets = new WebSocketServer({ noServer: true, maxPayload: 1048576 + 65536 });
  const socketConnections = new WeakMap<Connection, WebSocket>();
  server.on("upgrade", async (incoming, socket, head) => {
    const headers = new Headers();
    for (const [key, value] of Object.entries(incoming.headers)) if (value) headers.set(key, Array.isArray(value) ? value.join(",") : String(value));
    const request = new Request(`http://localhost${incoming.url}`, { headers });
    try {
      const response = await app.fetch(request);
      const accepted = upgrades.get(request);
      if (!accepted || response.status !== 200) {
        const text = await response.text();
        socket.end(`HTTP/1.1 ${response.status} Refused\r\nContent-Type: application/json\r\nContent-Length: ${Buffer.byteLength(text)}\r\nConnection: close\r\n\r\n${text}`);
        return;
      }
      sockets.handleUpgrade(incoming, socket, head, (websocket) => {
        const entry = roomEntry(accepted.board);
        let attachment = accepted.attachment;
        const connection: Connection = {
          attachment: () => attachment, attach: (value) => { attachment = value; },
          send: (text) => { if (websocket.readyState === 1) websocket.send(text); },
          close: (code) => {
            entry.connections.delete(connection);
            websocket.close(code);
          },
        };
        socketConnections.set(connection,websocket);
        entry.connections.add(connection);
        websocket.on("message", (data, binary) => {
          void entry.room.message(connection, binary ? "" : data.toString()).catch(() => websocket.close(1011));
        });
        websocket.on("close", (code, reason) => {
          entry.connections.delete(connection);
          if (rooms.get(accepted.board) === entry) void entry.room.closed(connection,code ?? 1006,reason?.toString("utf8") ?? "").catch(() => {});
        });
        websocket.on("error", () => { if(rooms.get(accepted.board)===entry)void entry.room.closed(connection,1011,"error").catch(()=>{}); });
        void entry.room.connected(connection).catch(() => websocket.close(1011));
      });
    } catch { socket.destroy(); }
  });
  await new Promise<void>((resolve) => server.listening ? resolve() : server.once("listening", () => resolve()));
  return { server, rooms, runtime, fences, socketFor:(connection:Connection)=>socketConnections.get(connection),
    port: (server.address() as { port: number }).port,
    async close() {
      closing = true;
      clearInterval(deliveryTimer);
      // Alarms can enqueue more work while the drain is waiting. Stop their
      // timers before waiting and ignore re-arms from work already in flight.
      for (const entry of rooms.values()) clearTimeout(entry.timer);
      for (const entry of stores.values()) clearTimeout(entry.timer);
      while (tasks.size) await Promise.allSettled([...tasks]);
      for (const entry of rooms.values()) {
        for (const connection of entry.connections) connection.close(1001);
      }
      await new Promise<void>((resolve) => server.close(() => resolve()));
      for (const entry of rooms.values()) await entry.room.ordered(async () => {});
      while (tasks.size) await Promise.allSettled([...tasks]);
      for (const entry of rooms.values()) entry.storage.close();
      for (const entry of stores.values()) entry.storage.close();
      fenceStorage?.close();
    },
  };
}
