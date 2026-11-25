// SPDX-License-Identifier: Apache-2.0
import { deliver } from "../../apps/server/src/delivery.ts";
import * as production from "../../apps/server/src/worker.ts";
import { fixtureAnswers, testAllow } from "./link-preview-fixtures.ts";
const { BoardRoom: ProductionRoom, RestoreFence, TemplateMedia: ProductionTemplateMedia } = production;
import { createApp } from "../../apps/server/src/app.ts";
import { Auth } from "../../apps/server/src/auth.ts";
import { workerRuntime, type WorkerEnv } from "../../apps/server/src/worker-runtime.ts";
export { RestoreFence };
export type Controls = {
  linkNow?: number | null; failLinkLimits?: boolean; delayLinkLimits?: boolean;
  linkOrigins?: string[] | null; dohCase?: string; failVoting?: string; failTimer?: string;  failLifecycle?: string; holdRoom?: string; releaseRoom?: boolean; failHistory?: string; failCheckpoint?: string; failCreate?: "before" | "write" | "after" | "exists" | ""; fixedNow?: number | null; offset?: number; fenceUnreadable?: boolean; backupLimit?: number; noOperator?: boolean; unreachable?: string[] };
export type TestEnv = WorkerEnv & { CONTROLS: DurableObjectNamespace; LINK_FIXTURE_PORT: string };
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
const Limiter = (production as Partial<typeof production>).LinkLimits;
export const LinkLimits = Limiter ? class TestLinkLimits extends Limiter {
  private clock: Controls = {};
  private testEnv: TestEnv;
  constructor(state: DurableObjectState, env: TestEnv) { super(state); this.testEnv = env; }
  protected now() { return this.clock.linkNow ?? Date.now(); }
  async fetch(request: Request) {
    this.clock = await controls(this.testEnv);
    if (this.clock.failLinkLimits) return new Response(null, { status: 503 });
    if (this.clock.delayLinkLimits) await new Promise(resolve => setTimeout(resolve, 1500));
    return super.fetch(request);
  }
  async alarm() { this.clock = await controls(this.testEnv); return super.alarm(); }
} : class {};

// On the baseline this glob is empty, so the rest of the server suite can still start.
const previewModules = import.meta.glob("../../apps/server/src/link-preview/{fetcher,transport-worker}.ts", { eager: true });
const workerTransport = previewModules["../../apps/server/src/link-preview/transport-worker.ts"] as
  typeof import("../../apps/server/src/link-preview/transport-worker.ts") | undefined;
const previewFetcher = previewModules["../../apps/server/src/link-preview/fetcher.ts"] as
  typeof import("../../apps/server/src/link-preview/fetcher.ts") | undefined;
const workerRecords: { host: string; family: string }[] = [];
const workerLogs: string[] = [];
let rebound = false;
function fixtureFetch(env: TestEnv, state: Controls): typeof fetch {
  return async (input, init) => {
    const url = new URL(typeof input === "string" || input instanceof URL ? input : input.url);
    if (url.hostname === "cloudflare-dns.com") {
      const host = url.searchParams.get("name") ?? "", family = url.searchParams.get("type") ?? "";
      workerRecords.push({ host, family });
      if (host === "bad-doh.test" && (state.dohCase !== "aaaa-reject" || family === "AAAA")) {
        switch (state.dohCase) {
          case "redirect": return new Response(null, { status: 302, headers: { Location: "/" } });
          case "large": return new Response(" ".repeat(65_537));
          case "status": return Response.json({ Status: 2 });
          case "data": return Response.json({ Status: 0, Answer: [{ type: 1, data: "not-an-address" }] });
          case "late":
            await new Promise(resolve => setTimeout(resolve, 2150)); break;
          case "aaaa-reject": throw Error("Fixture DNS failure");
        }
      }
      let answers = fixtureAnswers(host);
      if (host === "rebinding.test" && family === "A") {
        answers = rebound ? ["127.0.0.1"] : ["192.0.2.15"]; rebound = true;
      }
      return Response.json({ Status: answers.length ? 0 : 3, Answer: answers.filter(a => a.includes(":") === (family === "AAAA"))
        .map(data => ({ type: family === "AAAA" ? 28 : 1, data })) });
    }
    if (!fixtureAnswers(url.hostname).some(address => testAllow.has(address))) throw Error("No fixture transport for this name");
    const headers = new Headers(init?.headers);
    headers.set("x-link-fixture-host", url.hostname);
    headers.set("x-link-fixture-scheme", url.protocol.slice(0, -1));
    return fetch(`http://127.0.0.1:${env.LINK_FIXTURE_PORT}${url.pathname}${url.search}`, { ...init, headers });
  };
}

export class TemplateMedia extends ProductionTemplateMedia {
  private clock: Controls = {};
  private testEnv: TestEnv;
  constructor(state: DurableObjectState, env: TestEnv) { super(state); this.testEnv = env; }
  protected now() { return this.clock.fixedNow ?? Date.now() + (this.clock.offset ?? 0); }
  async fetch(request: Request) { this.clock = await controls(this.testEnv); return super.fetch(request); }
  async alarm() { this.clock = await controls(this.testEnv); return super.alarm(); }
}
export class BoardRoom extends ProductionRoom {
  current: Controls = {};
  async refreshControls() { this.current = await controls(this.env as TestEnv); }
  environment(board: string) {
    const environment = super.environment(board);
    const actualFence = environment.fence, raise = environment.raiseFence, exec = environment.storage.exec.bind(environment.storage);
    environment.storage.exec = (sql,...args) => {
      if ((this.current.failVoting === "session" && sql.startsWith("INSERT INTO workshop_vote ")) || (this.current.failVoting === "ballot" && sql.startsWith("INSERT INTO workshop_vote_ballots")) || (this.current.failVoting === "delete" && sql.startsWith("DELETE FROM workshop_vote_ballots")))throw Error("Voting storage unavailable");
      if(this.current.failTimer === "write" && sql.startsWith("INSERT INTO workshop_timer"))throw Error("Timer storage unavailable");
      const failure = this.current.failHistory;
      if (failure === "capture" && sql.startsWith("INSERT INTO versions") || failure === "intent" && sql.startsWith("INSERT INTO history_requests") ||
        failure === "local" && sql.startsWith("INSERT INTO versions") && args[5] === "before_restore" || failure === "cleanup" && sql.startsWith("DELETE FROM history_intent_chunks")) throw Error("History transaction unavailable");
      exec(sql,...args);
      if((this.current.failVoting === "after-ballot" && sql.startsWith("INSERT INTO workshop_vote_ballots")) || (this.current.failVoting === "after-delete" && sql.startsWith("DELETE FROM workshop_vote_ballots")))throw Error("Voting transaction unavailable");
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
    const testPath = new URL(request.url).pathname;
    if (testPath === "/__link-test-records") return Response.json({ resolutions: workerRecords });
    if (testPath === "/__link-test-logs") return Response.json(workerLogs);
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
    if (!runtime.linkPreview || !workerTransport || !previewFetcher) return createApp(runtime).fetch(request);
    const transport = workerTransport.createWorkerTransport({ fetch: fixtureFetch(env, state), testAllow });
    runtime.linkPreview = { ...runtime.linkPreview, preview: (url, startedAt) =>
      previewFetcher.fetchLinkPreview(url, { now: runtime.now, startedAt, abortAfter: ms => AbortSignal.timeout(ms), transport }) };
    if (state.linkOrigins !== null && state.linkOrigins !== undefined) runtime.linkPreviewOrigins = state.linkOrigins;
    if (!testPath.endsWith("/link-preview")) return createApp(runtime).fetch(request);
    const levels = ["debug", "info", "log", "warn", "error"] as const;
    const originals = levels.map(level => console[level]);
    for (const [index, level] of levels.entries()) console[level] = (...args: unknown[]) => {
      workerLogs.push(args.map(String).join(" "));
      originals[index].apply(console, args);
    };
    try { return await createApp(runtime).fetch(request); }
    finally { for (const [index, level] of levels.entries()) console[level] = originals[index]; }
  },
};
