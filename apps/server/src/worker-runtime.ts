// SPDX-License-Identifier: Apache-2.0
import { Auth } from "./auth.ts";
import { Supabase } from "./supabase.ts";
import type { Runtime, RoomClient } from "./runtime.ts";
import { RoomError } from "nextphase-board-room/protocol.ts";
export type WorkerEnv = {
  ROOMS: DurableObjectNamespace; FENCES: DurableObjectNamespace;
  SUPABASE_URL: string; SUPABASE_ISSUER?: string; SUPABASE_SERVICE_KEY: string;
  JWKS: string; ALLOWED_ORIGIN: string; OPERATOR_KEY?: string; BOARD_JURISDICTION?: "us" | "eu";
};
export function namespace(env: WorkerEnv, name: "ROOMS" | "FENCES") {
  return env.BOARD_JURISDICTION ? env[name].jurisdiction(env.BOARD_JURISDICTION) : env[name];
}
export function stub(env: WorkerEnv, name: "ROOMS" | "FENCES", board: string) {
  const binding = namespace(env, name);
  return binding.get(binding.idFromName(board));
}
const runtimes = new WeakMap<WorkerEnv, Runtime>();
export function workerRuntime(env: WorkerEnv): Runtime {
  const cached = runtimes.get(env);
  if (cached) return cached;
  const auth = new Auth({ supabaseUrl: env.SUPABASE_URL, issuer: env.SUPABASE_ISSUER, jwks: JSON.parse(env.JWKS) });
  const db = new Supabase(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);
  function client(board: string): RoomClient {
    async function call(action: string, value?: unknown) {
      const response = await stub(env, "ROOMS", board).fetch("http://room/" + action, {
        method: "POST", body: JSON.stringify({ board, value }), headers: { "Content-Type": "application/json" },
      });
      const result = await response.json() as any;
      if (!response.ok) throw new RoomError(response.status, result.error.reason, result.error.needed);
      return result;
    }
    return { rename: (person, title) => call("rename", { person, title }), ticket: (person) => call("ticket", person), export: (person) => call("export", person),
      changed: () => call("changed"), backup: () => call("backup"), restore: (value) => call("restore", value),
      async restoreToTime(bookmark) {
        const result = await call("restore-to-time", bookmark);
        // abort() intentionally ends the separate request without a response.
        // The schedule and undo bookmark were committed by the preceding call.
        try { await call("restart"); } catch { /* The old session was aborted. */ }
        return result;
      } };
  }
  const runtime: Runtime = { auth, db, allowedOrigin: env.ALLOWED_ORIGIN, operatorKey: env.OPERATOR_KEY,
    room: client,
    upgrade: (board, ticket, request) => stub(env, "ROOMS", board).fetch(
      new Request("http://room/join?board=" + board + "&ticket=" + encodeURIComponent(ticket), request)),
  };
  runtimes.set(env, runtime);
  return runtime;
}
