// SPDX-License-Identifier: Apache-2.0
import { auth } from "./auth";
import { settings } from "./config";

type Upload = { ok: true } | { ok: false; kind: "offline" | "too_large" | "full" | "refused" };

const timedOut = Symbol("picture timeout");

async function withTimeout<T>(ms: number, run: (signal: AbortSignal) => Promise<T>, caller?: AbortSignal): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout>;
  let abort: (() => void) | undefined;
  const timeout = new Promise<never>((_, reject) => {
    if (caller) {
      abort = () => { controller.abort(); reject(caller.reason); };
      caller.addEventListener("abort", abort, { once: true });
      if (caller.aborted) abort();
    }
    timer = setTimeout(() => { reject(timedOut); controller.abort(); }, ms);
  });
  try { return await Promise.race([run(controller.signal), timeout]); }
  finally { clearTimeout(timer!); if (abort) caller?.removeEventListener("abort", abort); }
}

export class BoardPictures {
  private board: () => string;
  constructor(board: () => string) { this.board = board; }
  private async request(hash: string, signal: AbortSignal, body?: ArrayBuffer) {
    const url = settings.serverUrl + "/boards/" + this.board() + "/assets/" + hash;
    const { data } = await auth.getSession();
    signal.throwIfAborted();
    return fetch(url, { method: body ? "PUT" : "GET", signal, body, headers: {
      Authorization: "Bearer " + (data.session?.access_token ?? ""),
      ...(body ? { "Content-Type": "application/octet-stream" } : {}),
    } });
  }
  async upload(hash: string, bytes: ArrayBuffer, signal?: AbortSignal): Promise<Upload> {
    try {
      return await withTimeout<Upload>(120000, async signal => {
        const reply = await this.request(hash, signal, bytes);
        if (reply.status === 200 || reply.status === 201) return { ok: true };
        if (reply.status === 413) return { ok: false, kind: "too_large" };
        if (reply.status === 409 && (await reply.json().catch(() => null))?.error?.reason === "board_pictures_full") {
          return { ok: false, kind: "full" };
        }
        return { ok: false, kind: "refused" };
      }, signal);
    } catch (error) { return { ok: false, kind: signal?.aborted || error === timedOut ? "refused" : "offline" }; }
  }
  async uploadVideo(hash: string, file: Blob, progress: (loaded: number, total: number) => void, signal?: AbortSignal): Promise<"ok" | "too_large" | "videos_full" | "refused" | "network"> {
    const url = settings.serverUrl + "/boards/" + this.board() + "/assets/" + hash;
    try {
      signal?.throwIfAborted();
      const { data } = await auth.getSession();
      signal?.throwIfAborted();
      return await new Promise(done => {
        const xhr = new XMLHttpRequest();
        const abort = () => { xhr.abort(); resolve("refused"); };
        const resolve = (value: Awaited<ReturnType<BoardPictures["uploadVideo"]>>) => {
          signal?.removeEventListener("abort", abort);
          xhr.upload.onprogress = null;
          done(value);
        };
        xhr.open("PUT", url);
        xhr.timeout = 600000;
        xhr.setRequestHeader("Authorization", "Bearer " + (data.session?.access_token ?? ""));
        xhr.setRequestHeader("Content-Type", "application/octet-stream");
        xhr.upload.onprogress = event => progress(event.loaded, file.size);
        xhr.onerror = () => resolve("network");
        xhr.ontimeout = xhr.onabort = () => resolve("refused");
        xhr.onload = () => {
          if (xhr.status === 413) { resolve("too_large"); return; }
          try {
            const reply = JSON.parse(xhr.responseText);
            if (xhr.status === 409 && reply?.error?.reason === "board_videos_full") { resolve("videos_full"); return; }
            if ((xhr.status === 200 || xhr.status === 201) && reply?.asset === hash && reply.bytes === file.size) { resolve("ok"); return; }
          } catch { /* An invalid reply is a refusal. */ }
          resolve("refused");
        };
        signal?.addEventListener("abort", abort, { once: true });
        try { xhr.send(file); }
        catch (error) { signal?.removeEventListener("abort", abort); throw error; }
      });
    } catch { return signal?.aborted ? "refused" : "network"; }
  }
  async downloadVideo(hash: string, progress: (loaded: number, total: number) => void, signal?: AbortSignal): Promise<{ kind: "ok"; blob: Blob } | { kind: "network" | "refused" }> {
    try {
      return await withTimeout(600000, async active => {
        active.throwIfAborted();
        const reply = await this.request(hash, active), raw = reply.headers.get("Content-Length");
        const type = reply.headers.get("Content-Type") ?? "", total = Number(raw);
        if (active.aborted || reply.status !== 200 || !raw || !/^\d+$/.test(raw) || !Number.isSafeInteger(total) ||
            total > 52428800 || !["video/mp4", "video/webm", "video/quicktime"].includes(type) || !reply.body) {
          await reply.body?.cancel(); return { kind: "refused" };
        }
        const reader = reply.body.getReader(), chunks: ArrayBuffer[] = [];
        let loaded = 0;
        const cancel = () => { void reader.cancel().catch(() => {}); };
        active.addEventListener("abort", cancel, { once: true });
        try {
          progress(0, total);
          while (!active.aborted) {
            const { done, value } = await reader.read();
            if (done || active.aborted) break;
            loaded += value.length;
            if (loaded > total) { await reader.cancel(); return { kind: "refused" }; }
            chunks.push(value.slice().buffer); progress(loaded, total);
          }
          return !active.aborted && loaded === total ? { kind: "ok", blob: new Blob(chunks, { type }) } : { kind: "refused" };
        } finally { active.removeEventListener("abort", cancel); reader.releaseLock(); }
      }, signal);
    } catch (error) { return { kind: signal?.aborted || error === timedOut ? "refused" : "network" }; }
  }
  async download(hash: string, signal?: AbortSignal) {
    try {
      return await withTimeout(60000, async signal => {
        const reply = await this.request(hash, signal);
        return reply.status === 200 ? await reply.arrayBuffer() : null;
      }, signal);
    } catch { return null; }
  }
}
