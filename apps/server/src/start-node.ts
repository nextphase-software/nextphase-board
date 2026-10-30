// SPDX-License-Identifier: Apache-2.0
import { serve } from "@hono/node-server";
import { WebSocketServer } from "ws";
import { mkdir, access } from "node:fs/promises";
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
export type NodeOptions = {
  now?: () => number; db?: Supabase; auth?: Auth; backupLimit?: number;
  fence?: { read(board: string): Promise<number>; raise(board: string): Promise<number> };
};
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
    async raise(board: string) {
      const storage = openFence();
      return storage.transaction(() => {
        storage.exec("INSERT INTO fences VALUES (?, 1) ON CONFLICT(board_id) DO UPDATE SET generation=generation+1", board);
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
    storage.exec("CREATE TABLE IF NOT EXISTS waiting (connection_id TEXT, sequence INTEGER, message_bytes INTEGER NOT NULL, received_at INTEGER NOT NULL, deadline INTEGER NOT NULL, request_id TEXT NOT NULL, \"update\" BLOB NOT NULL, PRIMARY KEY(connection_id, sequence))");
    storage.exec("DELETE FROM waiting");
    const connections = new Set<Connection>();
    const room = new Room(board, { storage, access: db, rows: db, background, now,
      async fence() {
        let generation = await fences.read(board);
        if (meta(storage, "restore_pending")) {
          const row = (await db.rows("boards", { id: board }))[0];
          if (!row) throw Error("Board row unavailable");
          const minimum = Math.max(generation, Number(row.document_generation));
          do { generation = await fences.raise(board); } while (generation <= minimum);
        }
        return generation;
      }, raiseFence: () => fences.raise(board),
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
    async upgrade(board, ticket, request) {
      const attachment = await roomEntry(board).room.join(ticket);
      if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") throw new RoomError(400, "bad_request");
      upgrades.set(request, { board, attachment });
      return new Response(null);
    },
  };
  const app = createApp(runtime);
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
        websocket.on("close", () => { entry.connections.delete(connection); void entry.room.closed(connection); });
        websocket.on("error", () => {});
        void entry.room.connected(connection).catch(() => websocket.close(1011));
      });
    } catch { socket.destroy(); }
  });
  await new Promise<void>((resolve) => server.listening ? resolve() : server.once("listening", () => resolve()));
  return { server, rooms, runtime, fences,
    port: (server.address() as { port: number }).port,
    async close() {
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
