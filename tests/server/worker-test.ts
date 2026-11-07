// SPDX-License-Identifier: Apache-2.0
import { deliver } from "../../apps/server/src/delivery.ts";
import worker, { BoardRoom as ProductionRoom, RestoreFence } from "../../apps/server/src/worker.ts";
import { createApp } from "../../apps/server/src/app.ts";
import { Auth } from "../../apps/server/src/auth.ts";
import { workerRuntime, type WorkerEnv } from "../../apps/server/src/worker-runtime.ts";
export { RestoreFence };
export type Controls = { failLifecycle?: string; holdRoom?: string; releaseRoom?: boolean; failHistory?: string; failCheckpoint?: string; failCreate?: "before" | "write" | "after" | "exists" | ""; fixedNow?: number | null; offset?: number; fenceUnreadable?: boolean; backupLimit?: number; noOperator?: boolean; unreachable?: string[] };
export type TestEnv = WorkerEnv & { CONTROLS: DurableObjectNamespace };
const lifecycleDatabases=new WeakSet<object>();
export class TestControls {
  state: DurableObjectState;
  held = new Set<() => void>();
  constructor(state: DurableObjectState) { this.state = state; }
  async fetch(request: Request) {
    if(new URL(request.url).pathname==='/wait') {
      const current=await this.state.storage.get<Controls>('controls');
      if(current?.holdRoom)await new Promise<void>(resolve=>this.held.add(resolve));
      return Response.json({});
    }
    const old = await this.state.storage.get<Controls>("controls") ?? {};
    const value = request.method === "POST" ? { ...old, ...await request.json() as Controls } : old;
    if(value.releaseRoom){value.holdRoom='';value.releaseRoom=false;for(const release of this.held)release();this.held.clear();}
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
    const actualFence = environment.fence, raise = environment.raiseFence, exec = environment.storage.exec.bind(environment.storage);
    environment.storage.exec = (sql,...args) => {
      const failure = this.current.failHistory;
      if (failure === "capture" && sql.startsWith("INSERT INTO versions") || failure === "intent" && sql.startsWith("INSERT INTO history_requests") ||
        failure === "local" && sql.startsWith("INSERT INTO versions") && args[5] === "before_restore" || failure === "cleanup" && sql.startsWith("DELETE FROM history_intent_chunks")) throw Error("History transaction unavailable");
      exec(sql,...args);
    };
    environment.raiseFence = async minimum => {
      if (this.current.failHistory === "fence") throw Error("Fence unavailable");
      const result = await raise(minimum);
      if (this.current.failHistory === "after-fence") throw Error("Fence answer unavailable");
      return result;
    };
    const source = environment.mentions!;
    const mentions = Object.create(source);
    mentions.documentGeneration = (id:string) => this.current.failCheckpoint === "document" ? Promise.reject(Error("Checkpoint unavailable")) : source.documentGeneration!(id);
    mentions.mentionGeneration = (id:string) => this.current.failCheckpoint === "mention" ? Promise.reject(Error("Checkpoint unavailable")) : source.mentionGeneration!(id);
    environment.mentions = mentions;
    environment.now = () => this.current.fixedNow ?? Date.now() + (this.current.offset ?? 0);
    environment.fence = () => this.current.fenceUnreadable ? Promise.reject(Error("Fence unreadable")) : actualFence();
    environment.backupLimit = this.current.backupLimit ?? environment.backupLimit;
    const auth = new Auth({ supabaseUrl: this.env.SUPABASE_URL, issuer: this.env.SUPABASE_ISSUER, jwks: JSON.parse(this.env.JWKS) }, environment.now);
    environment.verify = (token) => auth.verify(token);
    return environment;
  }
  async fetch(request: Request) {
    await this.refreshControls();
    if(new URL(request.url).pathname==='/discard'&&this.current.failLifecycle==='discard'||new URL(request.url).pathname==='/fence-lifecycle'&&this.current.failLifecycle==='room')return Response.json({error:{reason:'service_unavailable'}},{status:503});
    if(new URL(request.url).pathname==='/admit-lifecycle'&&this.current.failLifecycle==='before'){
      const {value}=await request.clone().json() as any;return Response.json({error:{reason:value.operation==='move'?'move_failed':'restore_failed'}},{status:503});
    }
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
  async webSocketMessage(socket: WebSocket, message: string | ArrayBuffer) {
    await this.refreshControls();
    if(this.current.holdRoom)await (this.env as TestEnv).CONTROLS.get((this.env as TestEnv).CONTROLS.idFromName('controls')).fetch('http://controls/wait');
    return super.webSocketMessage(socket, message);
  }
  async alarm() { await this.refreshControls(); return super.alarm(); }
}
export default {
  async scheduled(_controller:ScheduledController,env:TestEnv,context:ExecutionContext){
    const state=await controls(env),base=workerRuntime(env);context.waitUntil(deliver({...base,now:()=>state.fixedNow??Date.now()+(state.offset??0)}));
  },
  async fetch(request: Request, env: TestEnv) {
    const state = await controls(env);
    const base = workerRuntime(env);
    if(!lifecycleDatabases.has(base.db)) {
      lifecycleDatabases.add(base.db);const guard=base.db.lifecycleGuard!;
      base.db.lifecycleGuard=async(...args)=>{if((await controls(env)).failLifecycle==='ledger')throw Error('Independent ledger unavailable');await guard(...args);};
    }
    const runtime = { ...base, now: () => state.fixedNow ?? Date.now() + (state.offset ?? 0), operatorKey: state.noOperator ? undefined : base.operatorKey,
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
