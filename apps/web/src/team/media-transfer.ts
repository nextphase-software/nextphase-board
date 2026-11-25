// SPDX-License-Identifier: Apache-2.0
import { isImage, isVideo } from "nextphase-board-rules/objects/registry.ts";
import type { ApiError } from "./api.ts";
import { parseAssetEntries, type AssetEntry, type TemplateDetail } from "./templates-rules.ts";
import type { ImportBody, ImportMedia } from "./import.ts";
import type { HostedBoard } from "./hosted-board.ts";
import type { BoardPictures } from "./pictures.ts";

type ByteProgress = (loaded: number, total: number) => void;
type Status = "gone" | "network" | "expired" | "refused";
type Result<T extends object> = ({ kind: "ok" } & T) | { kind: Status };
type Objects = readonly { type: string }[];
const partOf = (type: string) => type.startsWith("video/") ? "video" : "picture";
export function mediaOf(objects: Objects, held?: ReadonlyMap<string, AssetEntry>) {
  const media = new Map<string, "picture" | "video">();
  const add = (hash: string, kind: "picture" | "video") => {
    if (!held || held.has(hash) && partOf(held.get(hash)!.type) === kind) media.set(hash, kind);
  };
  for (const object of objects) {
    if (isVideo(object)) { add(object.poster, "picture"); add(object.asset, "video"); }
    else if (isImage(object)) add(object.asset, "picture");
  }
  return [...media].map(([hash, kind]) => ({ hash, kind }));
}
export function checkedSizes(objects: Objects, entries: AssetEntry[]) {
  const byHash = new Map(entries.map(entry => [entry.hash, entry]));
  for (const object of objects) {
    if (isVideo(object) && byHash.get(object.poster)?.type !== "image/jpeg") return null;
  }
  const entriesInOrder: AssetEntry[] = [];
  for (const { hash, kind } of mediaOf(objects)) {
    const entry = byHash.get(hash);
    if (!entry || partOf(entry.type) !== kind) return null;
    entriesInOrder.push(entry);
  }
  return entriesInOrder;
}
export function percent(done: number, total: number) {
  return total > 0 ? Math.max(0, Math.min(100, Math.floor(done * 100 / total))) : 0;
}
export class Progress {
  private value = 0;
  private readonly total: number;
  constructor(total: number) { this.total = total; }
  report(done: number, complete = false) {
    return this.value = Math.max(this.value, Math.min(complete ? 100 : 99, percent(done, this.total)));
  }
}
export function watchdog(ms: number, onStall: () => void) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const stop = () => { clearTimeout(timer); timer = undefined; };
  const poke = () => { stop(); timer = setTimeout(onStall, ms); };
  poke();
  return { poke, stop };
}

async function accessToken(signal?: AbortSignal) {
  signal?.throwIfAborted();
  const { auth } = await import("./auth");
  const { data } = await auth.getSession();
  signal?.throwIfAborted();
  return "Bearer " + (data.session?.access_token ?? "");
}
async function send(path: string, signal?: AbortSignal, body?: object) {
  const { settings } = await import("./config");
  return fetch(settings.serverUrl + path, { signal, method: body ? "POST" : "GET",
    headers: { Authorization: await accessToken(signal), ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body && JSON.stringify(body),
  });
}
const workspacePath = (workspace: string) => "/workspaces/" + workspace;
const unknownReason = async (reply: Response) => (await reply.json().catch(() => null))?.error?.reason;
function status(code: number, reason?: string): Status {
  return code === 410 ? "expired" : code === 403 || code === 404 && reason === "not_found" ? "gone" : "refused";
}
async function open(path: string, key: string, assets: AssetEntry[], signal?: AbortSignal): Promise<Result<{ id: string }>> {
  let reply: Response;
  try { reply = await send(path, signal, { assets }); }
  catch { return { kind: signal?.aborted ? "refused" : "network" }; }
  if (reply.status !== 201) {
    const kind = status(reply.status, await unknownReason(reply));
    return { kind: kind === "expired" ? "refused" : kind };
  }
  const id = (await reply.json().catch(() => null))?.[key];
  return typeof id === "string" && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(id) ? { kind: "ok", id } : { kind: "refused" };
}
export const openImport = (workspace: string, assets: AssetEntry[], signal?: AbortSignal) =>
  open(workspacePath(workspace) + "/imports", "import", assets, signal);
export const openTemplateUpload = (workspace: string, assets: AssetEntry[], signal?: AbortSignal) =>
  open(workspacePath(workspace) + "/template-uploads", "upload", assets, signal);

async function stage(path: string, hash: string, blob: Blob, progress: ByteProgress, signal?: AbortSignal): Promise<"ok" | Status> {
  try {
    const token = await accessToken(signal);
    const { settings } = await import("./config");
    return await new Promise(resolve => {
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", settings.serverUrl + path + "/assets/" + hash);
      xhr.timeout = 600_000;
      xhr.setRequestHeader("Authorization", token);
      xhr.setRequestHeader("Content-Type", "application/octet-stream");
      const abort = () => { xhr.abort(); finish("refused"); };
      const finish = (value: "ok" | Status) => {
        signal?.removeEventListener("abort", abort);
        xhr.upload.onprogress = null;
        resolve(value);
      };
      xhr.upload.onprogress = event => progress(event.loaded, blob.size);
      xhr.onerror = () => finish("network");
      xhr.onabort = xhr.ontimeout = () => finish("refused");
      xhr.onload = () => {
        let reply;
        try { reply = JSON.parse(xhr.responseText); } catch { /* Invalid replies are refused. */ }
        if ((xhr.status === 200 || xhr.status === 201) && reply?.asset === hash && reply?.bytes === blob.size) finish("ok");
        else finish(status(xhr.status, reply?.error?.reason));
      };
      if (signal?.aborted) finish("refused");
      else {
        signal?.addEventListener("abort", abort, { once: true });
        xhr.send(blob);
      }
    });
  } catch { return "refused"; }
}
export const stageImport = (workspace: string, id: string, hash: string, blob: Blob, progress: ByteProgress, signal?: AbortSignal) =>
  stage(workspacePath(workspace) + "/imports/" + id, hash, blob, progress, signal);
export const stageTemplate = (workspace: string, id: string, hash: string, blob: Blob, progress: ByteProgress, signal?: AbortSignal) =>
  stage(workspacePath(workspace) + "/template-uploads/" + id, hash, blob, progress, signal);

export async function readTemplateAsset(workspace: string, template: string, hash: string, progress: ByteProgress, signal?: AbortSignal): Promise<Result<{ blob: Blob }>> {
  try {
    const reply = await send(workspacePath(workspace) + "/templates/" + template + "/assets/" + hash, signal);
    const raw = reply.headers.get("Content-Length"), type = reply.headers.get("Content-Type"), total = Number(raw);
    if (reply.status !== 200 || !reply.body || !raw || !/^\d+$/.test(raw) || !type || total < 1 || total > 20_971_520) {
      await reply.body?.cancel();
      return { kind: "refused" };
    }
    const reader = reply.body.getReader(), chunks: ArrayBuffer[] = [];
    let loaded = 0;
    try {
      while (!signal?.aborted) {
        const { done, value } = await reader.read();
        if (done || signal?.aborted) break;
        loaded += value.length;
        if (loaded > total) break;
        chunks.push(value.slice().buffer);
        progress(loaded, total);
      }
      if (!signal?.aborted && loaded === total) return { kind: "ok", blob: new Blob(chunks, { type }) };
      await reader.cancel();
      return { kind: "refused" };
    } finally { reader.releaseLock(); }
  } catch { return { kind: signal?.aborted ? "refused" : "network" }; }
}
export async function assetSizes(board: string, hashes: string[], signal?: AbortSignal): Promise<Result<{ assets: AssetEntry[] }>> {
  let reply: Response;
  try { reply = await send("/boards/" + board + "/asset-sizes", signal, { hashes }); }
  catch { return { kind: signal?.aborted ? "refused" : "network" }; }
  try {
    if (!reply.ok) return { kind: "refused" };
    return { kind: "ok", assets: parseAssetEntries((await reply.json()).assets) };
  } catch { return { kind: "refused" }; }
}

const stalled = Symbol("stalled"), cancelled = Symbol("cancelled");
type Unfinished = typeof stalled | typeof cancelled;
async function transfer<T>(task: (signal: AbortSignal, progress: ByteProgress) => Promise<T>, report?: ByteProgress, parent?: AbortSignal): Promise<T | Unfinished> {
  if (parent?.aborted) return cancelled;
  const controller = new AbortController();
  let stop!: (value: Unfinished) => void;
  const stopped = new Promise<Unfinished>(resolve => { stop = resolve; });
  const cancel = (reason: Unfinished) => { stop(reason); controller.abort(); };
  const abort = () => cancel(cancelled);
  const timeout = watchdog(60_000, () => cancel(stalled));
  parent?.addEventListener("abort", abort, { once: true });
  try {
    return await Promise.race([stopped, task(controller.signal, (loaded, total) => {
      if (!controller.signal.aborted) { timeout.poke(); report?.(loaded, total); }
    })]);
  } finally { timeout.stop(); parent?.removeEventListener("abort", abort); }
}
const stopReason = "the upload stopped", offline = "you are offline", refused = "the server did not accept it";
const unloaded = "a picture on this board couldn't be loaded", unloadedTemplate = "its pictures could not be loaded";
const failed = (reason: string) => ({ ok: false as const, reason });
const addFailure = (answer: string | Unfinished) => answer === stalled ? stopReason : answer === "network" || answer === "offline" ? offline
  : answer === "full" ? "this board already holds 50 MiB of pictures" : answer === "videos_full" ? "this board already holds 100 MiB of videos" : refused;
const importFailure = (answer: Status | Unfinished) => answer === stalled || answer === "expired" ? stopReason : answer === "network" ? offline
  : answer === "gone" ? "you can no longer add boards here" : refused;
const saveFailure = (answer: Status | Unfinished) => answer === stalled || answer === "expired" ? stopReason : answer === "network" ? offline : refused;
const keyOf = <T extends object>(value: Result<T> | Unfinished) => typeof value === "symbol" ? value : value.kind;
const isApiError = (error: unknown): error is ApiError => error instanceof Error &&
  "status" in error && typeof error.status === "number" && "reason" in error && typeof error.reason === "string";
const apiStatus = (error: unknown) => isApiError(error) ? error.reason === "no_answer" ? "network" : status(error.status, error.reason) : "refused";

type ProgressEvents = (value: number) => void;
type Open = (assets: AssetEntry[], signal: AbortSignal) => Promise<Result<{ id: string }>>;
type Stage = (id: string, hash: string, blob: Blob, progress: ByteProgress, signal: AbortSignal) => Promise<"ok" | Status>;
type Download = (entry: AssetEntry, progress: ByteProgress, signal: AbortSignal) => Promise<Result<{ blob: Blob }>>;
type BoardUpload = (entry: AssetEntry, blob: Blob, progress: ByteProgress, signal: AbortSignal) => Promise<"ok" | Status | "offline" | "too_large" | "full" | "videos_full">;
const sizeOf = (entries: AssetEntry[]) => entries.reduce((sum, entry) => sum + entry.bytes, 0);
const metadata = ({ hash, type, bytes }: AssetEntry) => ({ hash, type, bytes });

export async function runImport<T>(media: ImportMedia[], calls: { open: Open; stage: Stage; finish: (id: string) => Promise<T> },
  report: ProgressEvents, signal?: AbortSignal) {
  const opened = await transfer(active => calls.open(media.map(metadata), active), undefined, signal);
  if (typeof opened === "symbol" || opened.kind !== "ok") return failed(importFailure(keyOf(opened) as Status | Unfinished));
  let done = 0;
  const progress = new Progress(sizeOf(media));
  report(0);
  for (const [index, entry] of media.entries()) {
    const result = await transfer((active, update) => calls.stage(opened.id, entry.hash, entry.blob, update, active),
      loaded => report(progress.report(done + Math.min(loaded, entry.bytes))), signal);
    if (result !== "ok") return failed(importFailure(result));
    done += entry.bytes;
    report(progress.report(done, index === media.length - 1));
  }
  if (signal?.aborted) return failed(refused);
  try { return { ok: true as const, value: await calls.finish(opened.id) }; }
  catch (error) { return failed(importFailure(apiStatus(error))); }
}

async function copyFiles(entries: AssetEntry[], download: Download, upload: BoardUpload, report: ProgressEvents,
  reason: (answer: string | Unfinished) => string, unavailable: string, signal?: AbortSignal) {
  const progress = new Progress(2 * sizeOf(entries));
  let done = 0;
  report(0);
  for (const [index, entry] of entries.entries()) {
    const update: ByteProgress = loaded => report(progress.report(done + Math.min(loaded, entry.bytes)));
    const received = await transfer((active, emit) => download(entry, emit, active), update, signal);
    if (received === stalled) return failed(stopReason);
    if (typeof received === "symbol" || received.kind !== "ok" || received.blob.size !== entry.bytes ||
      received.blob.type !== entry.type) return failed(unavailable);
    done += entry.bytes;
    report(progress.report(done));
    const sent = await transfer((active, emit) => upload(entry, received.blob, emit, active), update, signal);
    if (sent !== "ok") return failed(reason(sent));
    done += entry.bytes;
    report(progress.report(done, index === entries.length - 1));
  }
  return { ok: true as const };
}
export async function runTemplateSave<T>(entries: AssetEntry[], calls: { open: Open; download: Download; stage: Stage; save: (id: string) => Promise<T> },
  report: ProgressEvents, signal?: AbortSignal) {
  const opened = await transfer(active => calls.open(entries, active), undefined, signal);
  if (typeof opened === "symbol" || opened.kind !== "ok") return failed(saveFailure(keyOf(opened) as Status | Unfinished));
  const result = await copyFiles(entries, calls.download, (entry, blob, progress, active) => calls.stage(opened.id, entry.hash, blob, progress, active),
    report, answer => saveFailure(answer as Status | Unfinished), unloaded, signal);
  if (!result.ok) return result;
  if (signal?.aborted) return failed(refused);
  try { return { ok: true as const, value: await calls.save(opened.id) }; }
  catch (error) {
    return { ...failed(saveFailure(apiStatus(error))), limit: isApiError(error) && error.status === 409 && error.reason === "template_limit" };
  }
}
export async function runTemplateAdd(objects: Objects, entries: AssetEntry[], calls: { download: Download; upload: BoardUpload; insert: () => void },
  report: ProgressEvents, signal?: AbortSignal) {
  const assets = checkedSizes(objects, entries);
  if (!assets) return failed(unloadedTemplate);
  const result = await copyFiles(assets, calls.download, calls.upload, report, addFailure, unloadedTemplate, signal);
  if (result.ok && !signal?.aborted) calls.insert();
  return result;
}

export async function finishImport(workspace: string, body: ImportBody, id: string, signal?: AbortSignal) {
  const { api } = await import("./api.ts");
  signal?.throwIfAborted();
  return api<{ id: string }>(workspacePath(workspace) + "/boards", "POST", {
    ...body,
    // The API reads the session before serializing the request body.
    get import() { signal?.throwIfAborted(); return id; },
  });
}
export const boardDownload = (pictures: BoardPictures): Download => async (entry, progress, signal) => {
  if (partOf(entry.type) === "video") return pictures.downloadVideo(entry.hash, progress, signal);
  const bytes = await pictures.download(entry.hash, signal);
  return bytes ? { kind: "ok", blob: new Blob([bytes], { type: entry.type }) } : { kind: "refused" };
};
class TemplateAdds {
  adding = false;
  private listeners = new Set<() => void>();
  private readonly hosted: HostedBoard;
  constructor(hosted: HostedBoard) { this.hosted = hosted; }
  subscribe = (callback: () => void) => {
    this.listeners.add(callback);
    return () => { this.listeners.delete(callback); };
  };
  snapshot = () => this.adding;
  async add(template: TemplateDetail, close: () => void, insert: () => void) {
    if (this.adding) return;
    this.adding = true;
    this.listeners.forEach(listener => listener());
    close();
    const hosted = this.hosted, workspace = hosted.snapshot.workspaceId;
    const controller = new AbortController();
    const navigation = typeof window === "undefined" ? undefined : window.location.hash;
    const leave = () => { if (window.location.hash !== navigation) controller.abort(); };
    const hide = () => controller.abort();
    if (navigation !== undefined) {
      window.addEventListener("hashchange", leave);
      window.addEventListener("pagehide", hide);
    }
    let value = 0;
    const toast = () => {
      if (hosted.snapshot.workspaceId !== workspace) controller.abort();
      if (!controller.signal.aborted) hosted.toast("Adding “" + template.name + "”… " + value + "%");
    };
    const timer = setInterval(toast, 2_000);
    try {
      const result = await runTemplateAdd(template.objects, template.media, {
        download: (entry, progress, signal) => readTemplateAsset(workspace, template.id, entry.hash, progress, signal),
        upload: async (entry, blob, progress, signal) => {
          if (partOf(entry.type) === "video") return hosted.pictures.uploadVideo(entry.hash, blob, progress, signal);
          const bytes = await blob.arrayBuffer();
          const sent = await hosted.pictures.upload(entry.hash, bytes, signal);
          return sent.ok ? "ok" : sent.kind;
        },
        insert,
      }, progress => { value = progress; toast(); }, controller.signal);
      if (!result.ok && !controller.signal.aborted) hosted.toast("Could not add “" + template.name + "”: " + result.reason + ".");
    } finally {
      clearInterval(timer);
      if (navigation !== undefined) {
        window.removeEventListener("hashchange", leave);
        window.removeEventListener("pagehide", hide);
      }
      this.adding = false;
      this.listeners.forEach(listener => listener());
    }
  }
}
const boardAdds = new WeakMap<HostedBoard, TemplateAdds>();
export function templateAdds(hosted: HostedBoard) {
  let runner = boardAdds.get(hosted);
  if (!runner) { runner = new TemplateAdds(hosted); boardAdds.set(hosted, runner); }
  return runner;
}
