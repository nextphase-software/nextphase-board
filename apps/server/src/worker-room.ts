// SPDX-License-Identifier: Apache-2.0
import { Room } from "nextphase-board-room/room.ts";
import { BACKUP_LIMIT, errorBody, RoomError, type Connection, type Attachment } from "nextphase-board-room/protocol.ts";
import type { RoomEnvironment } from "nextphase-board-room/interfaces.ts";
import { WorkerStorage } from "./worker-storage.ts";
import { workerRuntime, stub, type WorkerEnv } from "./worker-runtime.ts";
export function connection(socket: WebSocket): Connection {
  return { attachment: () => socket.deserializeAttachment() as Attachment,
    attach: (value) => socket.serializeAttachment(value), send: (text) => socket.send(text), close: (code) => socket.close(code) };
}
export function roomEnvironment(state: DurableObjectState, env: WorkerEnv, board: string): RoomEnvironment {
  const runtime = workerRuntime(env);
  const fenceCall = async (path: string) => {
    const response = await stub(env, "FENCES", board).fetch("http://fence/" + path, { method: "POST" });
    if (!response.ok) throw Error("Restore fence unavailable");
    return (await response.json() as { generation: number }).generation;
  };
  return { storage: new WorkerStorage(state.storage), access: runtime.db, rows: runtime.db,
    background: { run: (task) => state.waitUntil(task) }, now: Date.now,
    fence: () => fenceCall("read"), raiseFence: () => fenceCall("raise"),
    hash: async (value) => [...new Uint8Array(await crypto.subtle.digest("SHA-256", new Uint8Array(value)))].map((byte) => byte.toString(16).padStart(2, "0")).join(""),
    randomTicket: () => btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""),
    randomId: () => crypto.randomUUID(), verify: (token) => runtime.auth.verify(token),
    connections: () => state.getWebSockets().filter((socket) => socket.readyState === 1).map(connection),
    schedule: async (at) => { if (at === null) await state.storage.deleteAlarm(); else await state.storage.setAlarm(at); },
    backupLimit: BACKUP_LIMIT,
  };
}
export class WorkerRoom {
  state: DurableObjectState;
  env: WorkerEnv;
  room?: Room;
  constructor(state: DurableObjectState, env: WorkerEnv) { this.state = state; this.env = env; }
  environment(board: string) { return roomEnvironment(this.state, this.env, board); }
  async getRoom(board?: string) {
    if (!board) {
      try {
        board = this.state.storage.sql.exec<{ value: string }>("SELECT value FROM meta WHERE key = 'board_id'").toArray()[0]?.value;
      } catch { /* A never-opened room has no metadata yet. */ }
    }
    if (!board) throw new RoomError(404, "not_found");
    if (!this.room) {
      this.room = new Room(board, this.environment(board));
    }
    return this.room;
  }
  async fetch(request: Request) {
    try {
      const url = new URL(request.url);
      if (url.pathname === "/join") {
        const room = await this.getRoom(url.searchParams.get("board") ?? undefined);
        const attachment = await room.join(url.searchParams.get("ticket") ?? "");
        const pair = new WebSocketPair();
        pair[1].serializeAttachment(attachment);
        this.state.acceptWebSocket(pair[1]);
        await room.connected(connection(pair[1]));
        return new Response(null, { status: 101, webSocket: pair[0] });
      }
      const { board, value } = await request.json() as { board: string; value: any };
      const room = await this.getRoom(board);
      let result: unknown;
      switch (url.pathname) {
        case "/ticket": result = await room.ticket(value); break;
        case "/rename": result = await room.rename(value.person, value.title); break;
        case "/export": result = await room.export(value); break;
        case "/changed": await room.changed(); result = null; break;
        case "/backup": result = await room.backup(); break;
        case "/restore": result = await room.restore(value); break;
        case "/restore-to-time": {
          const generation = await room.lock();
          const undoBookmark = await this.state.storage.onNextSessionRestoreBookmark(value);
          // Return the undo bookmark to the calling Worker before it requests
          // a separate abort. Aborting this request could lose the reply.
          result = { boardId: board, restoreGeneration: generation, undoBookmark };
          break;
        }
        case "/restart": this.state.abort(); break;
        default: throw new RoomError(404, "not_found");
      }
      return Response.json(result);
    } catch (error) {
      const failure = error instanceof RoomError ? error : new RoomError(503, "service_unavailable");
      return Response.json(errorBody(failure), { status: failure.status });
    }
  }
  async webSocketMessage(socket: WebSocket, message: string | ArrayBuffer) {
    await (await this.getRoom()).message(connection(socket), typeof message === "string" ? message : "");
  }
  async webSocketClose(socket: WebSocket, code: number) {
    socket.close(code === 1006 ? 1001 : code);
    await (await this.getRoom()).closed(connection(socket));
  }
  async webSocketError(socket: WebSocket) { socket.close(1011); await (await this.getRoom()).closed(connection(socket)); }
  async alarm() { await (await this.getRoom()).alarm(); }
}
