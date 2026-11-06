// SPDX-License-Identifier: Apache-2.0
import { serve } from "@hono/node-server";
import { WebSocketServer } from "ws";
import { mkdir, access, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { randomBytes, randomUUID, createHash } from "node:crypto";
import { meta } from "nextphase-board-room/storage.ts";
import { Room } from "nextphase-board-room/room.ts";
import { BACKUP_LIMIT, RoomError, type Attachment, type Connection } from "nextphase-board-room/protocol.ts";
import { NodeStorage } from "./node-storage.ts";
import { createApp } from "./app.ts";
import { Auth } from "./auth.ts";
import { Supabase } from "./supabase.ts";
import type { Settings } from "./settings.ts";
import type { Runtime } from "./runtime.ts";
import { deliver } from "./delivery.ts";
export type NodeOptions = {
  now?: () => number; db?: Supabase; auth?: Auth; backupLimit?: number;
  deliveryIntervalMs?: number;
  fence?: { read(board: string): Promise<number>; raise(board: string, minimum?: number): Promise<number> };
};
export async function recoveryGeneration(board: string, storage: NodeStorage, db: Supabase, fences: NonNullable<NodeOptions['fence']>) {
  let generation = await fences.read(board);
  if (meta(storage, "restore_pending") && !storage.all("SELECT result FROM history_requests WHERE operation = 'restore'").some(r => JSON.parse(String(r.result)).phase)) {
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
  await mkdir(resolve(settings.dataDir, "boards"), { recursive: true });
  const now = options.now ?? Date.now;
  const db = options.db ?? new Supabase(settings.supabaseUrl, settings.serviceKey);
  const auth = options.auth ?? new Auth(settings, now);
  const fenceFile = resolve(settings.dataDir, "restore-fences.sqlite");
  let fenceStorage: NodeStorage | undefined;
  function openFence() {
    if (!fenceStorage) {
      const storage = new NodeStorage(fenceFile);
      try { storage.exec("CREATE TABLE IF NOT EXISTS fences (board_id TEXT PRIMARY KEY, generation INTEGER NOT NULL)"); }
      catch (error) { storage.close(); throw error; }
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
  const tasks = new Set<Promise<void>>();
  const background = { run(task: Promise<void>) {
    tasks.add(task);
    void task.finally(() => tasks.delete(task)).catch(() => {});
  } };
  const rooms = new Map<string, { room: Room; storage: NodeStorage; connections: Set<Connection>; timer?: ReturnType<typeof setTimeout> }>();
  function roomEntry(board: string) {
    let entry = rooms.get(board);
    if (entry) return entry;
    const storage = new NodeStorage(resolve(settings.dataDir, "boards", board + ".sqlite"));
    storage.exec("CREATE TABLE IF NOT EXISTS waiting (connection_id TEXT, sequence INTEGER, message_bytes INTEGER NOT NULL, received_at INTEGER NOT NULL, deadline INTEGER NOT NULL, request_id TEXT NOT NULL, \"update\" BLOB NOT NULL, restore_generation INTEGER NOT NULL, PRIMARY KEY(connection_id, sequence))");
    storage.exec("DELETE FROM waiting");
    const connections = new Set<Connection>();
    const room = new Room(board, { storage, access: db, rows: db, mentions: db, background, now,
      fence: () => recoveryGeneration(board, storage, db, fences), raiseFence: (minimum) => fences.raise(board, minimum),
      hash: async (value) => createHash("sha256").update(value).digest("hex"), randomTicket: () => randomBytes(32).toString("base64url"),
      randomId: randomUUID, verify: (token) => auth.verify(token), connections: () => [...connections],
      backupLimit: options.backupLimit ?? BACKUP_LIMIT,
      async schedule(at) {
        const current = rooms.get(board);
        if (!current) return;
        clearTimeout(current.timer);
        if (at !== null) {
          current.timer = setTimeout(() => { void room.alarm().catch(() => {}); }, Math.max(1, at - now()));
          current.timer.unref();
        }
      },
    });
    entry = { room, storage, connections };
    rooms.set(board, entry);
    return entry;
  }
  const upgrades = new WeakMap<Request, { board: string; attachment: Attachment }>();
  const runtime: Runtime = { auth, db, allowedOrigin: settings.allowedOrigin, operatorKey: settings.operatorKey,
    room: (board) => roomEntry(board).room,
    async removeRoom(board) {
      const entry = rooms.get(board);
      if (entry) {
        await entry.room.ordered(async () => {
          for (const connection of entry.connections) connection.close(4403);
          clearTimeout(entry.timer);
        });
        // Copies settle through the room queue, so drain them outside that queue.
        while (tasks.size) await Promise.allSettled([...tasks]);
        await entry.room.ordered(async () => {
          clearTimeout(entry.timer);
          rooms.delete(board);
          entry.storage.close();
        });
      }
      for (const suffix of ["", "-wal", "-shm"]) {
        await rm(resolve(settings.dataDir, "boards", board + ".sqlite" + suffix), { force: true });
      }
    },
    async upgrade(board, ticket, request) {
      const attachment = await roomEntry(board).room.join(ticket);
      if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") throw new RoomError(400, "bad_request");
      upgrades.set(request, { board, attachment });
      return new Response(null);
    },
  };
  const app = createApp(runtime);
  const interval = options.deliveryIntervalMs ?? 60000;
  const deliveryTimer = interval > 0 ? setInterval(() => background.run(deliver(runtime)), interval) : undefined;
  deliveryTimer?.unref();
  const server = serve({ fetch: app.fetch, port: settings.port ?? 8788, hostname: "0.0.0.0" });
  const sockets = new WebSocketServer({ noServer: true, maxPayload: 1048576 + 65536 });
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
        entry.connections.add(connection);
        websocket.on("message", (data, binary) => {
          void entry.room.message(connection, binary ? "" : data.toString()).catch(() => websocket.close(1011));
        });
        websocket.on("close", () => {
          entry.connections.delete(connection);
          if (rooms.get(accepted.board) === entry) void entry.room.closed(connection);
        });
        websocket.on("error", () => {});
        void entry.room.connected(connection).catch(() => websocket.close(1011));
      });
    } catch { socket.destroy(); }
  });
  await new Promise<void>((resolve) => server.listening ? resolve() : server.once("listening", () => resolve()));
  return { server, rooms, runtime, fences,
    port: (server.address() as { port: number }).port,
    async close() {
      clearInterval(deliveryTimer);
      // Drain an in-flight delivery before closing room storage.
      while (tasks.size) await Promise.allSettled([...tasks]);
      for (const entry of rooms.values()) {
        clearTimeout(entry.timer);
        for (const connection of entry.connections) connection.close(1001);
      }
      await new Promise<void>((resolve) => server.close(() => resolve()));
      for (const entry of rooms.values()) await entry.room.ordered(async () => {});
      while (tasks.size) await Promise.allSettled([...tasks]);
      for (const entry of rooms.values()) { clearTimeout(entry.timer); entry.storage.close(); }
      fenceStorage?.close();
    },
  };
}
