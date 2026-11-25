// SPDX-License-Identifier: Apache-2.0
import type { MiddlewareHandler } from "hono";
import type { AppVariables } from "../runtime.ts";
import { errorBody, RoomError } from "nextphase-board-room/protocol.ts";
import { deadline, raceAbort, readBytes, REQUEST_MS } from "../link-preview/fetcher.ts";
import type { Runtime, LinkPreviewRuntime } from "../runtime.ts";
import { authorize, id, shape, type ServerApp, type ServerContext } from "./common.ts";

const path = "/link-preview";
export function isPublicLinkPreview(honoPath: string, url: string): boolean {
  return honoPath === path && URL.parse(url)?.pathname === path;
}
const badRequest = () => new RoomError(400, "bad_request");

export async function readPreviewUrl(context: ServerContext, clock: Parameters<typeof deadline>[0]): Promise<string> {
  const type = context.req.header("Content-Type")?.split(";")[0].trim().toLowerCase();
  if (type !== "application/json") throw badRequest();
  const bound = deadline(clock, REQUEST_MS);
  const bytes = await readBytes(context.req.raw.body, 1048576, bound, () => new RoomError(413, "body_too_large"))
    .catch((error: unknown) => { throw error instanceof RoomError ? error : badRequest(); });
  if (bound.expired()) throw badRequest();
  let value: Record<string, unknown>;
  try { value = JSON.parse(new TextDecoder().decode(bytes)); }
  catch { throw badRequest(); }
  shape(value, ["url"]);
  if (typeof value.url !== "string") throw badRequest();
  return value.url;
}

export async function checkLimit(limits: LinkPreviewRuntime["limits"], key: string, clock: Parameters<typeof deadline>[0]) {
  const bound = deadline(clock, 1000);
  let allowed: boolean;
  try {
    bound.check();
    allowed = await raceAbort(limits.take(key), bound.signal);
    bound.check();
  } catch { throw new RoomError(503, "service_unavailable"); }
  if (!allowed) throw new RoomError(429, "rate_limited");
}

async function reply(context: ServerContext, runtime: Runtime, startedAt: number, key: () => string) {
  const clock = { startedAt, now: runtime.now, abortAfter: (ms: number) => AbortSignal.timeout(ms) };
  const url = await readPreviewUrl(context, clock);
  await checkLimit(runtime.linkPreview.limits, key(), clock);
  return context.json(await runtime.linkPreview.preview(url, startedAt), 200, { "Cache-Control": "no-store" });
}

export function publicLinkPreview(runtime: Runtime): MiddlewareHandler<{ Variables: AppVariables }> {
  return async (context: ServerContext, next: () => Promise<void>) => {
    if (!isPublicLinkPreview(context.req.path, context.req.url)) return next();
    const startedAt = runtime.now(), origin = context.req.header("Origin");
    if (!origin || origin === "null" || !runtime.linkPreviewOrigins.includes(origin)) {
      return context.json(errorBody(new RoomError(404, "not_found")), 404);
    }
    context.header("Access-Control-Allow-Origin", origin);
    context.header("Vary", "Origin");
    if (context.req.method === "OPTIONS") {
      context.header("Access-Control-Allow-Methods", "POST, OPTIONS");
      context.header("Access-Control-Allow-Headers", "Content-Type");
      return context.body(null, 204);
    }
    try {
      if (context.req.method !== "POST") throw new RoomError(404, "not_found");
      return await reply(context, runtime, startedAt, () => runtime.linkPreview.clientAddress(context));
    } catch (error) {
      const failure = error instanceof RoomError ? error : new RoomError(503, "service_unavailable");
      return context.json(errorBody(failure), failure.status as 400);
    }
  };
}

export function linkPreviewRoutes(app: ServerApp, runtime: Runtime) {
  app.post("/boards/:board/link-preview", async context => {
    const startedAt = runtime.now(), board = id(context, "board"), person = context.get("person").id;
    await authorize(runtime, person, board, "board", "editor");
    return reply(context, runtime, startedAt, () => `person:${person}:${board}`);
  });
}
