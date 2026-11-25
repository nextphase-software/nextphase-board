// SPDX-License-Identifier: Apache-2.0
import { checkLedger, type RecoveryRecord } from "./lifecycle.ts";
import { createApp } from "./app.ts";
import type { Room } from "nextphase-board-room/room.ts";
import { meta } from "nextphase-board-room/storage.ts";
import { markExplicitRecovery } from "nextphase-board-room/timer.ts";
import { errorBody, RoomError } from "nextphase-board-room/protocol.ts";
import { StagingExpired, TemplateStore } from "nextphase-board-room/template-store.ts";
import type { AssetType } from "nextphase-board-room/pictures.ts";
import { callerFrom, WorkerRoom } from "./worker-room.ts";
import { WorkerStorage } from "./worker-storage.ts";
import { workerRuntime, stub, type WorkerEnv } from "./worker-runtime.ts";
import { deliver } from "./delivery.ts";
import { prune, rulesFor, take, type Counts } from "./link-preview/limits.ts";
type FenceState = { generation: number; recoveryGeneration: number };
const recoveryKey = "time_recovery_generation";
function checkedFence(value: FenceState): FenceState {
  if (![value.generation, value.recoveryGeneration].every(n => Number.isSafeInteger(n) && n >= 0) ||
    value.recoveryGeneration > value.generation) throw new RoomError(503, "room_locked");
  return value;
}
async function recoveryFence(env: WorkerEnv, board: string, recover = false) {
  const response = await stub(env, "FENCES", board).fetch("http://fence/" + (recover ? "recover" : "read"), { method: "POST" });
  if (!response.ok) throw new RoomError(503, "room_locked");
  return checkedFence(await response.json() as FenceState);
}
export class BoardRoom extends WorkerRoom {
  private checkedRoom?: Room;
  private checkingRecovery?: Promise<void>;
  async getRoom(board?: string, stagingAction = false) {
    const state = this.stagingState();
    const room = await super.getRoom(board, stagingAction);
    if (state.staging || !state.loaded && stagingAction) return room;
    // Check once per reconstructed Room, before any load can resume history.
    // Keep ordinary reads of an already-open room outside its potentially held queue.
    if (this.checkedRoom !== room) {
      this.checkedRoom = room;
      this.checkingRecovery = room.ordered(async () => {
        const signal = await recoveryFence(this.env, room.boardId), s = room.env.storage;
        const floor = meta(s, "restore_generation");
        if (!Number.isSafeInteger(floor) || floor < 0) throw new RoomError(503, "room_locked");
        if (signal.recoveryGeneration <= floor) return;
        room.spotlight.end("recovery");
        await room.lifecycle.active();
        const pending = s.all("SELECT value FROM meta WHERE key='explicit_recovery_pending'")[0];
        const reservation = s.all("SELECT value FROM meta WHERE key='explicit_recovery_generation'")[0];
        if (![7, 8, 9].includes(meta(s, "storage_version")) || pending && pending.value !== 1 || reservation &&
          (!pending || !Number.isSafeInteger(reservation.value) || Number(reservation.value) < 1)) throw new RoomError(503, "room_locked");
        markExplicitRecovery(s);
        room.access.locked = true;
      });
    }
    try { await this.checkingRecovery; }
    catch (error) { if (this.checkedRoom === room) this.checkedRoom = undefined; throw error; }
    return room;
  }
  protected reserveTimeRecovery(room: Room) {
    return room.lock(async () => {
      // Deny locally even if the independent reservation fails. The retained
      // signal is never cleared: a later provider rewind must still see it.
      markExplicitRecovery(room.env.storage);
      room.access.locked = true;
      return (await recoveryFence(this.env, room.boardId, true)).generation;
    });
  }
}
export class TemplateMedia {
  private store?: TemplateStore;
  protected readonly state: DurableObjectState;
  constructor(state: DurableObjectState) { this.state = state; }
  protected now() { return Date.now(); }
  private async getStore() {
    if (!this.store) {
      this.store = new TemplateStore({ storage: new WorkerStorage(this.state.storage), now: () => this.now(), randomId: () => crypto.randomUUID(),
        schedule: async at => { if (at === null) await this.state.storage.deleteAlarm(); else await this.state.storage.setAlarm(at); } });
      await this.store.reopen();
    }
    return this.store;
  }
  private async erase() {
    await this.store?.discard();
    await this.state.storage.deleteAlarm();
    await this.state.storage.deleteAll();
    this.store = undefined;
  }
  async fetch(request: Request) {
    try {
      const path = new URL(request.url).pathname;
      if (path === "/discard") { await this.erase(); return Response.json({}); }
      const store = await this.getStore(), headers = request.headers;
      if (path === "/inventory") {
        const inventory = await store.inventory();
        if (!Array.isArray(inventory)) await this.erase();
        return Response.json(Array.isArray(inventory) ? inventory : []);
      }
      if (path === "/read") {
        const value = await store.read(headers.get("x-picture-hash")!);
        if (!value) {
          if (!Array.isArray(await store.inventory())) await this.erase();
          return new Response(null, { status: 204 });
        }
        return new Response(value.bytes, { headers: { "Content-Type": value.type, "Content-Length": String(value.bytes.length) } });
      }
      if (path === "/stage") {
        const value = await store.stage(callerFrom(headers), headers.get("x-workspace")!, headers.get("x-upload-token")!,
          headers.get("x-picture-hash")!, headers.get("x-picture-type") as AssetType, new Uint8Array(await request.arrayBuffer()),
          Number(headers.get("x-picture-width")), Number(headers.get("x-picture-height")));
        return Response.json(value);
      }
      const value = await request.json() as any;
      switch (path) {
        case "/open": await store.open(value.person, value.workspace, value.assets); return Response.json({});
        case "/begin": return Response.json(await store.begin(value.person, value.workspace, value.hash));
        case "/end": await store.end(value.person, value.workspace, value.token); return Response.json({});
        case "/commit": return Response.json(await store.commit(value.person, value.workspace));
        default: throw new RoomError(404, "not_found");
      }
    } catch (error) {
      if (error instanceof StagingExpired && error.discard) await this.erase();
      const failure = error instanceof RoomError ? error : new RoomError(503, "service_unavailable");
      return Response.json(errorBody(failure), { status: failure.status });
    }
  }
  async alarm() {
    if (!this.store && !this.state.storage.sql.exec("SELECT 1 FROM sqlite_master WHERE name='meta'").toArray().length) return;
    if ((await (await this.getStore()).alarm())?.discard) await this.erase();
  }
}
export class RestoreFence {
  state: DurableObjectState;
  constructor(state: DurableObjectState) {
    this.state = state;
    state.storage.sql.exec("CREATE TABLE IF NOT EXISTS lifecycle_ledger (board_id TEXT PRIMARY KEY, record TEXT NOT NULL)");
    state.storage.sql.exec("CREATE TABLE IF NOT EXISTS fence (id INTEGER PRIMARY KEY CHECK (id = 1), generation INTEGER NOT NULL)");
  }
  async fetch(request: Request) {
    if(new URL(request.url).pathname === "/ledger") {
      try {
        const {board,row,record}=await request.json() as any;
        const old=this.state.storage.sql.exec<{record:string}>("SELECT record FROM lifecycle_ledger WHERE board_id=?",board).toArray()[0];
        checkLedger(old?JSON.parse(old.record) as RecoveryRecord:null,row);
        if(record && !(row.state === "active" && row.cycle === 0))this.state.storage.sql.exec("INSERT INTO lifecycle_ledger VALUES (?,?) ON CONFLICT(board_id) DO UPDATE SET record=excluded.record",board,JSON.stringify(record));
        return Response.json({});
      } catch {return Response.json({error:{reason:"service_unavailable"}},{status:503});}
    }
    try {
      const read = () => {
        const row = this.state.storage.sql.exec<{ generation: number }>("SELECT generation FROM fence WHERE id = 1").toArray()[0];
        const recovery = this.state.storage.kv.get<number>(recoveryKey);
        return checkedFence({ generation: row?.generation ?? 0, recoveryGeneration: recovery === undefined ? 0 : recovery });
      };
      const path = new URL(request.url).pathname;
      const result = path === "/raise" || path === "/recover" ? this.state.storage.transactionSync(() => {
        const previous = read();
        if (previous.generation === Number.MAX_SAFE_INTEGER) throw new RoomError(503, "room_locked");
        const generation = previous.generation + 1;
        this.state.storage.sql.exec("INSERT INTO fence VALUES (1, ?) ON CONFLICT(id) DO UPDATE SET generation=excluded.generation", generation);
        if (path === "/recover") this.state.storage.kv.put(recoveryKey, generation);
        return read();
      }) : read();
      return Response.json(result);
    } catch { return Response.json({ error: { reason: "room_locked" } }, { status: 503 }); }
  }
}
export class LinkLimits {
  protected readonly state: DurableObjectState;
  constructor(state: DurableObjectState) { this.state = state; }

  protected now(): number { return Date.now(); }

  async fetch(request: Request) {
    if (request.method !== "POST" || new URL(request.url).pathname !== "/take") return new Response(null, { status: 404 });
    let input: { key?: unknown } | null;
    try { input = await request.json(); }
    catch { return new Response(null, { status: 400 }); }
    if (!input || typeof input.key !== "string" || Object.keys(input).length !== 1 ||
        !/^(person|address):.+$/.test(input.key)) return new Response(null, { status: 400 });
    const key = input.key;
    return this.state.blockConcurrencyWhile(async () => {
      const time = this.now(), storage = this.state.storage;
      const current = await storage.get<Counts>("counts") ?? {};
      const result = take(current, rulesFor(key), time);
      if (result.allowed) await storage.put("counts", result.counts);
      if (result.next !== null) await storage.setAlarm(result.next);
      return Response.json({ allowed: result.allowed });
    });
  }

  async alarm() {
    await this.state.blockConcurrencyWhile(async () => {
      const time = this.now(), storage = this.state.storage;
      const result = prune(await storage.get<Counts>("counts") ?? {}, time);
      if (result.next === null) await storage.deleteAll();
      else {
        await storage.put("counts", result.counts);
        await storage.setAlarm(result.next);
      }
    });
  }
}
export default {
  fetch(request: Request, env: WorkerEnv) { return createApp(workerRuntime(env)).fetch(request); },
  scheduled(_controller: ScheduledController, env: WorkerEnv, context: ExecutionContext) {
    context.waitUntil(deliver(workerRuntime(env)));
  },
};
