// SPDX-License-Identifier: Apache-2.0
import worker, { BoardRoom as ProductionRoom, RestoreFence } from "../../apps/server/src/worker.ts";
import { createApp } from "../../apps/server/src/app.ts";
import { Auth } from "../../apps/server/src/auth.ts";
import { workerRuntime, type WorkerEnv } from "../../apps/server/src/worker-runtime.ts";
export { RestoreFence };
export type Controls = { failCreate?: "before" | "write" | "after" | "exists" | ""; fixedNow?: number | null; offset?: number; fenceUnreadable?: boolean; backupLimit?: number; noOperator?: boolean; unreachable?: string[] };
export type TestEnv = WorkerEnv & { CONTROLS: DurableObjectNamespace };
export class TestControls {
  state: DurableObjectState;
  constructor(state: DurableObjectState) { this.state = state; }
  async fetch(request: Request) {
    const old = await this.state.storage.get<Controls>("controls") ?? {};
    const value = request.method === "POST" ? { ...old, ...await request.json() as Controls } : old;
    if (request.method === "POST") await this.state.storage.put("controls", value);
    return Response.json(value);
  }
}
export async function controls(env: TestEnv): Promise<Controls> {
  return (await env.CONTROLS.get(env.CONTROLS.idFromName("controls")).fetch("http://controls/")).json();
}
export class BoardRoom extends ProductionRoom {
  current: Controls = {};
  async refreshControls() { this.current = await controls(this.env as TestEnv); }
  environment(board: string) {
    const environment = super.environment(board);
    const actualFence = environment.fence;
    environment.now = () => this.current.fixedNow ?? Date.now() + (this.current.offset ?? 0);
    environment.fence = () => this.current.fenceUnreadable ? Promise.reject(Error("Fence unreadable")) : actualFence();
    environment.backupLimit = this.current.backupLimit ?? environment.backupLimit;
    const auth = new Auth({ supabaseUrl: this.env.SUPABASE_URL, issuer: this.env.SUPABASE_ISSUER, jwks: JSON.parse(this.env.JWKS) }, environment.now);
    environment.verify = (token) => auth.verify(token);
    return environment;
  }
  async fetch(request: Request) {
    await this.refreshControls();
    if (new URL(request.url).pathname === "/changed") {
      const { board } = await request.clone().json() as { board: string };
      if (this.current.unreachable?.includes(board)) return Response.json({ error: { reason: "service_unavailable" } }, { status: 503 });
    }
    if (new URL(request.url).pathname === "/create" && this.current.failCreate) {
      const unavailable = () => Response.json({ error: { reason: "service_unavailable" } }, { status: 503 });
      if (this.current.failCreate === "before") return unavailable();
      const { board } = await request.clone().json() as { board: string };
      const room = await this.getRoom(board);
      if (this.current.failCreate === "exists") await room.ordered(() => room.load());
      const storage = room.env.storage, exec = storage.exec.bind(storage);
      if (this.current.failCreate === "write") storage.exec = (sql, ...values) => {
        if (sql.startsWith("INSERT INTO snapshot_chunks")) throw Error("Snapshot write unavailable");
        exec(sql, ...values);
      };
      try {
        const response = await super.fetch(request);
        return this.current.failCreate === "after" && response.ok ? unavailable() : response;
      } finally { storage.exec = exec; }
    }
    if (this.room) this.room.env.backupLimit = this.current.backupLimit ?? 16777216;
    return super.fetch(request);
  }
  async webSocketMessage(socket: WebSocket, message: string | ArrayBuffer) { await this.refreshControls(); return super.webSocketMessage(socket, message); }
  async alarm() { await this.refreshControls(); return super.alarm(); }
}
export default {
  scheduled: worker.scheduled,
  async fetch(request: Request, env: TestEnv) {
    const state = await controls(env);
    const base = workerRuntime(env);
    const runtime = { ...base, operatorKey: state.noOperator ? undefined : base.operatorKey,
      auth: new Auth({ supabaseUrl: env.SUPABASE_URL, issuer: env.SUPABASE_ISSUER, jwks: JSON.parse(env.JWKS) }, () => state.fixedNow ?? Date.now() + (state.offset ?? 0)),
      room(board: string) {
        const room = base.room(board);
        if (state.unreachable?.includes(board)) return { ...room, changed: () => Promise.reject(Error("Room unavailable")) };
        return room;
      },
    };
    return createApp(runtime).fetch(request);
  },
};
