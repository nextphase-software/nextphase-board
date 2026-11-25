// SPDX-License-Identifier: Apache-2.0
import type { Context, Hono } from "hono";
import { RoomError } from "nextphase-board-room/protocol.ts";
import type { Runtime, AppVariables } from "../runtime.ts";
export type ServerApp = Hono<{ Variables: AppVariables }>;
export type ServerContext = Context<{ Variables: AppVariables }>;
export const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export function id(context: ServerContext, name: string) {
  const value = context.req.param(name);
  if (!value || !uuid.test(value)) throw new RoomError(404, "not_found");
  return value;
}
export function hashId(context: ServerContext) {
  const hash = context.req.param("hash");
  if (!hash || !/^[0-9a-f]{64}$/.test(hash)) throw new RoomError(404, "not_found");
  return hash;
}
export async function bytes(context: ServerContext, limit: number) {
  return streamBytes(context.req.raw.body, limit);
}
export async function head(context: ServerContext, limit: number) {
  const reader = context.req.raw.body?.getReader();
  const prefix = new Uint8Array(limit), chunks: Uint8Array[] = [];
  let used = 0, ended = !reader;
  try {
    while (reader && used < limit) {
      const { value, done } = await reader.read();
      if (done) { ended = true; reader.releaseLock(); break; }
      if (!value.length) continue;
      chunks.push(value);
      const n = Math.min(limit - used, value.length);
      prefix.set(value.subarray(0, n), used); used += n;
    }
  } catch (error) { reader?.releaseLock(); throw error; }
  const body = new ReadableStream<Uint8Array>({
    async pull(controller) {
      const chunk = chunks.shift();
      if (chunk) { controller.enqueue(chunk); return; }
      if (ended) { controller.close(); return; }
      try {
        const { value, done } = await reader!.read();
        if (done) { ended = true; reader!.releaseLock(); controller.close(); }
        else controller.enqueue(value);
      } catch (error) { ended = true; reader!.releaseLock(); controller.error(error); }
    },
    async cancel(reason) {
      chunks.length = 0;
      if (!ended) { ended = true; try { await reader!.cancel(reason); } finally { reader!.releaseLock(); } }
    },
  }, { highWaterMark: 0 });
  return { head: prefix.subarray(0, used), body };
}
export async function streamBytes(body: ReadableStream<Uint8Array> | null, limit: number) {
  const reader = body?.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  if (reader) try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > limit) { void reader.cancel().catch(() => {}); throw new RoomError(413, "body_too_large"); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return bytes;
}
export async function body(context: ServerContext, limit = 1048576) {
  const data = await bytes(context, limit);
  try { return JSON.parse(new TextDecoder().decode(data)) as Record<string, unknown>; }
  catch { throw new RoomError(400, "bad_request"); }
}
export function shape(value: Record<string, unknown>, fields: string[]) {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).sort().join() !== fields.sort().join()) {
    throw new RoomError(400, "bad_request");
  }
}
export function role(value: unknown, board: boolean): string {
  if (typeof value !== "string" || !(board ? ["editor", "viewer"] : ["editor", "viewer", "guest"]).includes(value)) {
    throw new RoomError(400, "bad_request");
  }
  return value;
}
export async function authorize(runtime: Runtime, person: string, target: string, level: "board" | "workspace", needed?: string) {
  const role = level === "board" ? await runtime.db.role(person, target) : await runtime.db.workspaceRole(person, target);
  if (!role) throw new RoomError(404, "not_found");
  if (needed && role !== "owner" && (needed === "owner" || role !== "editor")) throw new RoomError(403, "role_too_low", needed);
  return role;
}
