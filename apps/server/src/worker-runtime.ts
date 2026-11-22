// SPDX-License-Identifier: Apache-2.0
import { ledgerRecord } from "./lifecycle.ts";
import { Auth } from "./auth.ts";
import { Supabase } from "./supabase.ts";
import type { Runtime, RoomClient } from "./runtime.ts";
import { base64, bytes, BACKUP_LIMIT, RoomError } from "nextphase-board-room/protocol.ts";
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
  db.lifecycleGuard = async (board,row,request) => {
    const response=await stub(env,"FENCES","lifecycle-ledger").fetch("http://fence/ledger",{method:"POST",body:JSON.stringify({board,row,record:row?ledgerRecord(row,request):null})});
    await response.arrayBuffer();
    if(!response.ok)throw new RoomError(503,"service_unavailable");
  };
  function client(board: string): RoomClient {
    async function call(action: string, value?: unknown) {
      const response = await stub(env, "ROOMS", board).fetch("http://room/" + action, {
        method: "POST", body: JSON.stringify({ board, value }), headers: { "Content-Type": "application/json" },
      });
      const result = await response.json() as any;
      if (!response.ok) throw new RoomError(response.status, result.error.reason, result.error.needed);
      return result;
    }
    function pictureCall(action: string, person: Parameters<RoomClient["export"]>[0], hash: string, headers: Record<string, string> = {}, body?: ArrayBuffer) {
      const caller = base64(bytes(JSON.stringify(person))).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
      return stub(env, "ROOMS", board).fetch("http://room/" + action, {
        method: "POST", body, headers: { "x-board": board, "x-person": caller, "x-picture-hash": hash, ...headers },
      }).then(async response => {
        if (!response.ok) {
          const { error } = await response.json() as { error: { reason: string; needed?: string } };
          throw new RoomError(response.status, error.reason, error.needed);
        }
        return response;
      });
    }
    return {
      async storePicture(person, hash, data, type, width, height) {
        const body = data.buffer instanceof ArrayBuffer && data.byteOffset === 0 && data.length === data.buffer.byteLength ? data.buffer : data.slice().buffer;
        const response = await pictureCall("picture-store", person, hash, {
          "x-picture-type": type, "x-picture-width": String(width), "x-picture-height": String(height),
        }, body);
        return (await response.json() as { result: "created" | "exists" | "full" }).result;
      },
      async readPicture(person, hash) {
        const response = await pictureCall("picture-read", person, hash);
        return response.status === 204 ? null : { type: response.headers.get("Content-Type")!, bytes: new Uint8Array(await response.arrayBuffer()) };
      },
      admitLifecycle: value => call("admit-lifecycle", value), fenceLifecycle: (row, ready) => call("fence-lifecycle", { row, ready }), versions: person => call("versions", { person }), version: (person, id) => call("version", { person, id }),
      saveVersion: (person, value) => call("save-version", { person, input: value }),
      nameVersion: (person, id, value) => call("name-version", { person, id, input: value }),
      restoreVersion: (person, id, value) => call("restore-version", { person, id, input: value }),
      create: (document) => call("create", document), rename: (person, title) => call("rename", { person, title }), ticket: (person) => call("ticket", person), export: (person) => call("export", person),
      deliverNotices: () => call("deliver-notices"), discussion: (person, commentId, occurrence) => call("discussion", { person, commentId, occurrence }),
      changed: () => call("changed"), backup: () => call("backup"), restore: (value) => call("restore", value),
      async restoreToTime(bookmark) {
        const result = await call("restore-to-time", bookmark);
        // abort() intentionally ends the separate request without a response.
        // The schedule and undo bookmark were committed by the preceding call.
        try { await call("restart"); } catch { /* The old session was aborted. */ }
        return result;
      } };
  }
  const runtime: Runtime = { backupLimit: BACKUP_LIMIT, now: Date.now, async fenceGeneration(board){
      const response=await stub(env,"FENCES",board).fetch("http://fence/read",{method:"POST"});
      if(!response.ok)throw new RoomError(503,"service_unavailable");
      const independent=(await response.json() as {generation:number}).generation;
      const local=await stub(env,"ROOMS",board).fetch("http://room/lifecycle-floor",{method:"POST",body:JSON.stringify({board})});
      if(!local.ok)throw new RoomError(503,"service_unavailable");
      return Math.max(independent,(await local.json() as {generation:number}).generation);
    }, auth, db, allowedOrigin: env.ALLOWED_ORIGIN, operatorKey: env.OPERATOR_KEY,
    room: client,
    async removeRoom(board, generation) {
      const response = await stub(env, "ROOMS", board).fetch("http://room/discard", {
        method: "POST", body: JSON.stringify({ board, value: { generation } }),
      });
      await response.arrayBuffer();
      if (!response.ok) throw new RoomError(503, "service_unavailable");
    },
    upgrade: (board, ticket, request) => stub(env, "ROOMS", board).fetch(
      new Request("http://room/join?board=" + board + "&ticket=" + encodeURIComponent(ticket), request)),
  };
  runtimes.set(env, runtime);
  return runtime;
}
