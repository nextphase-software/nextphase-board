// SPDX-License-Identifier: Apache-2.0
import { auth } from "./auth";
import { settings } from "./config";

type Upload = { ok: true } | { ok: false; kind: "offline" | "too_large" | "full" | "refused" };

const timedOut = Symbol("picture timeout");

async function withTimeout<T>(ms: number, run: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => { reject(timedOut); controller.abort(); }, ms);
  });
  try { return await Promise.race([run(controller.signal), timeout]); }
  finally { clearTimeout(timer!); }
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
  async upload(hash: string, bytes: ArrayBuffer): Promise<Upload> {
    try {
      return await withTimeout<Upload>(120000, async signal => {
        const reply = await this.request(hash, signal, bytes);
        if (reply.status === 200 || reply.status === 201) return { ok: true };
        if (reply.status === 413) return { ok: false, kind: "too_large" };
        if (reply.status === 409 && (await reply.json().catch(() => null))?.error?.reason === "board_pictures_full") {
          return { ok: false, kind: "full" };
        }
        return { ok: false, kind: "refused" };
      });
    } catch (error) { return { ok: false, kind: error === timedOut ? "refused" : "offline" }; }
  }
  async download(hash: string) {
    try {
      return await withTimeout(60000, async signal => {
        const reply = await this.request(hash, signal);
        return reply.status === 200 ? await reply.arrayBuffer() : null;
      });
    } catch { return null; }
  }
}
