// SPDX-License-Identifier: Apache-2.0
import { ledgerRecord } from "./lifecycle.ts";
import { Auth } from "./auth.ts";
import { Supabase } from "./supabase.ts";
import type { Runtime, RoomClient, TemplateMediaClient } from "./runtime.ts";
import { base64, bytes, BACKUP_LIMIT, RoomError } from "nextphase-board-room/protocol.ts";
import { addressKey, fetchLinkPreview } from "./link-preview/fetcher.ts";
import { createWorkerTransport } from "./link-preview/transport-worker.ts";
export type WorkerEnv = {
  ROOMS: DurableObjectNamespace; FENCES: DurableObjectNamespace; TEMPLATE_MEDIA: DurableObjectNamespace;
  LINK_LIMITS: DurableObjectNamespace; LINK_PREVIEW_ORIGINS?: string;
  SUPABASE_URL: string; SUPABASE_ISSUER?: string; SUPABASE_SERVICE_KEY: string;
  JWKS: string; ALLOWED_ORIGIN: string; OPERATOR_KEY?: string; BOARD_JURISDICTION?: "us" | "eu";
};
type StoreNamespace = "ROOMS" | "FENCES" | "TEMPLATE_MEDIA" | "LINK_LIMITS";
export function namespace(env: WorkerEnv, name: StoreNamespace) {
  return env.BOARD_JURISDICTION ? env[name].jurisdiction(env.BOARD_JURISDICTION) : env[name];
}
export function stub(env: WorkerEnv, name: StoreNamespace, board: string) {
  const binding = namespace(env, name);
  return binding.get(binding.idFromName(board));
}
const encodePerson = (person: Parameters<RoomClient["export"]>[0]) =>
  base64(bytes(JSON.stringify(person))).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
const bufferOf = (data: Uint8Array) =>
  data.buffer instanceof ArrayBuffer && data.byteOffset === 0 && data.length === data.buffer.byteLength ? data.buffer : data.slice().buffer;
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
    function pictureCall(action: string, person: Parameters<RoomClient["export"]>[0], hash: string, headers: Record<string, string> = {}, body?: ArrayBuffer | ReadableStream<Uint8Array>) {
      const caller = encodePerson(person);
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
        const body = bufferOf(data);
        const response = await pictureCall("picture-store", person, hash, {
          "x-picture-type": type, "x-picture-width": String(width), "x-picture-height": String(height),
        }, body);
        return (await response.json() as { result: "created" | "exists" | "full" }).result;
      },
      async storeVideo(person, hash, type, body) {
        const response = await pictureCall("video-store", person, hash, { "x-picture-type": type }, body);
        return await response.json() as Awaited<ReturnType<RoomClient["storeVideo"]>>;
      },
      async readVideo(person, hash) {
        const response = await pictureCall("video-read", person, hash);
        if (response.status === 204) return null;
        const bytes = Number(response.headers.get("x-picture-bytes"));
        const fixed = new FixedLengthStream(bytes);
        void response.body!.pipeTo(fixed.writable).catch(() => {});
        return { type: response.headers.get("Content-Type") as import("nextphase-board-room/pictures.ts").VideoType, bytes, body: fixed.readable };
      },
      async readPicture(person, hash) {
        const response = await pictureCall("picture-read", person, hash);
        return response.status === 204 ? null : { type: response.headers.get("Content-Type")!, bytes: new Uint8Array(await response.arrayBuffer()) };
      },
      openImport: (person, workspace, assets) => call("import-open", { person, workspace, assets }),
      beginImport: (person, workspace, hash) => call("import-begin", { person, workspace, hash }),
      endImport: (person, workspace, token) => call("import-end", { person, workspace, token }),
      async stageImportPicture(person, workspace, token, hash, data, type, width, height) {
        const response = await pictureCall("import-picture", person, hash, {
          "x-workspace": workspace, "x-upload-token": token, "x-picture-type": type,
          "x-picture-width": String(width), "x-picture-height": String(height),
        }, bufferOf(data));
        return (await response.json() as { result: "created" | "exists" | "full" }).result;
      },
      async stageImportVideo(person, workspace, token, hash, type, body) {
        const response = await pictureCall("import-video", person, hash,
          { "x-workspace": workspace, "x-upload-token": token, "x-picture-type": type }, body);
        return await response.json() as Awaited<ReturnType<RoomClient["stageImportVideo"]>>;
      },
      claimImport: (person, workspace, document) => call("import-claim", { person, workspace, document }),
      releaseImport: token => call("import-release", { token }),
      assetSizes: (person, hashes) => call("asset-sizes", { person, hashes }),
      admitLifecycle: value => call("admit-lifecycle", value), fenceLifecycle: (row, ready) => call("fence-lifecycle", { row, ready }), versions: person => call("versions", { person }), version: (person, id) => call("version", { person, id }),
      saveVersion: (person, value) => call("save-version", { person, input: value }),
      nameVersion: (person, id, value) => call("name-version", { person, id, input: value }),
      restoreVersion: (person, id, value) => call("restore-version", { person, id, input: value }),
      create: (document, importer, token) => importer ? call("import-create", { document, importer, token }) : call("create", document), rename: (person, title) => call("rename", { person, title }), ticket: (person) => call("ticket", person), export: (person) => call("export", person),
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
  async function templateCall(upload: string, action: string, init?: RequestInit) {
    const reply = await stub(env, "TEMPLATE_MEDIA", upload).fetch("http://template/" + action, { method: "POST", ...init });
    if (!reply.ok) {
      const { error } = await reply.json() as { error: { reason: string; needed?: string } };
      throw new RoomError(reply.status, error.reason, error.needed);
    }
    return reply;
  }
  function templateMedia(upload: string): TemplateMediaClient {
    async function call<T>(action: string, value?: object): Promise<T> {
      return (await templateCall(upload, action, { body: value && JSON.stringify(value) })).json() as Promise<T>;
    }
    return {
      open: (person, workspace, assets) => call("open", { person, workspace, assets }),
      begin: (person, workspace, hash) => call("begin", { person, workspace, hash }),
      end: (person, workspace, token) => call("end", { person, workspace, token }),
      async stage(person, workspace, token, hash, type, data, width, height) {
        return (await templateCall(upload, "stage", { body: bufferOf(data), headers: {
          "x-person": encodePerson(person), "x-workspace": workspace, "x-upload-token": token,
          "x-picture-hash": hash, "x-picture-type": type, "x-picture-bytes": String(data.length),
          "x-picture-width": String(width), "x-picture-height": String(height),
        } })).json() as Promise<"created" | "exists">;
      },
      commit: (person, workspace) => call("commit", { person, workspace }),
      inventory: () => call("inventory"),
      async read(hash) {
        const reply = await templateCall(upload, "read", { headers: { "x-picture-hash": hash } });
        return reply.status === 204 ? null : {
          type: reply.headers.get("Content-Type") as import("nextphase-board-room/pictures.ts").AssetType,
          bytes: new Uint8Array(await reply.arrayBuffer()),
        };
      },
    };
  }
  const linkTransport = createWorkerTransport();
  const runtime: Runtime = { backupLimit: BACKUP_LIMIT, now: Date.now, async fenceGeneration(board){
      const response=await stub(env,"FENCES",board).fetch("http://fence/read",{method:"POST"});
      if(!response.ok)throw new RoomError(503,"service_unavailable");
      const independent=(await response.json() as {generation:number}).generation;
      const local=await stub(env,"ROOMS",board).fetch("http://room/lifecycle-floor",{method:"POST",body:JSON.stringify({board})});
      if(!local.ok)throw new RoomError(503,"service_unavailable");
      return Math.max(independent,(await local.json() as {generation:number}).generation);
    }, auth, db, allowedOrigin: env.ALLOWED_ORIGIN, operatorKey: env.OPERATOR_KEY,
    linkPreviewOrigins: (env.LINK_PREVIEW_ORIGINS ?? "").split(",").map(value => value.trim())
      .filter(value => value !== "null" && URL.parse(value)?.origin === value),
    linkPreview: {
      preview: (url, startedAt) => fetchLinkPreview(url, { transport: linkTransport, now: runtime.now, startedAt, abortAfter: ms => AbortSignal.timeout(ms) }),
      limits: {
        async take(key) {
          const response = await stub(env, "LINK_LIMITS", key).fetch("http://limits/take", {
            method: "POST", body: JSON.stringify({ key }), headers: { "Content-Type": "application/json" },
          });
          if (!response.ok) throw Error("limit_unavailable");
          const answer = await response.json<{ allowed?: boolean }>();
          if (typeof answer.allowed !== "boolean") throw Error("limit_unavailable");
          return answer.allowed;
        },
      },
      clientAddress: c => addressKey(c.req.header("CF-Connecting-IP")),
    },
    room: client,
    templateMedia,
    async removeTemplateMedia(upload) { await (await templateCall(upload, "discard")).arrayBuffer(); },
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
