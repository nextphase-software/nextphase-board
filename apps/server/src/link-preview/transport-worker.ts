// SPDX-License-Identifier: Apache-2.0
import { cancelBody, deadline, parseAddress, raceAbort, readBytes, testAllowlist, type LinkTransport } from "./fetcher.ts";

export type WorkerTransportOptions = { fetch?: typeof fetch; doh?: string; testAllow?: ReadonlySet<string> };
const resolutionFailed = () => Error("resolution_failed");
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);

export function createWorkerTransport(options: WorkerTransportOptions = {}): LinkTransport {
  const send = options.fetch ?? ((...args: Parameters<typeof fetch>) => fetch(...args));
  const testAllow = testAllowlist(options.testAllow);
  const doh = options.doh ?? "https://cloudflare-dns.com/dns-query";
  return {
    testAllow,
    async resolve(host, signal) {
      const bound = deadline({ now: Date.now, startedAt: Date.now(), abortAfter: ms => AbortSignal.timeout(ms) }, 2000);
      const controller = new AbortController();
      const querySignal = AbortSignal.any([signal, bound.signal, controller.signal]);
      const queryBound = { signal: querySignal, expired: () => querySignal.aborted || bound.expired(),
        check() { if (querySignal.aborted) throw resolutionFailed(); bound.check(); } };
      async function query(family: "A" | "AAAA") {
        const url = new URL(doh);
        url.searchParams.set("name", host);
        url.searchParams.set("type", family);
        queryBound.check();
        const pending = send(url.href, { method: "GET", headers: { accept: "application/dns-json" }, redirect: "manual",
          cache: "no-store", signal: querySignal });
        void pending.then(response => { if (queryBound.expired()) cancelBody(response.body); }, () => {});
        const response = await raceAbort(pending, querySignal);
        try {
          queryBound.check();
          if (response.status !== 200 || Number(response.headers.get("content-length")) > 65536) throw resolutionFailed();
          const bytes = await readBytes(response.body, 65536, queryBound, resolutionFailed);
          const value: unknown = JSON.parse(new TextDecoder().decode(bytes));
          if (!object(value) || (value.Status !== 0 && value.Status !== 3)) throw resolutionFailed();
          if (value.Status === 3) return [];
          if (value.Answer !== undefined && !Array.isArray(value.Answer)) throw resolutionFailed();
          const addresses: string[] = [];
          for (const answer of value.Answer ?? []) {
            if (!object(answer)) throw resolutionFailed();
            if (answer.type !== 1 && answer.type !== 28) continue;
            const parsed = typeof answer.data === "string" && parseAddress(answer.data);
            if (!parsed || parsed.bits !== (answer.type === 1 ? 32 : 128)) throw resolutionFailed();
            addresses.push(parsed.text);
          }
          queryBound.check();
          return addresses;
        } finally { cancelBody(response.body); }
      }
      try { return (await Promise.all([query("A"), query("AAAA")])).flat(); }
      catch { throw resolutionFailed(); }
      finally { controller.abort(); }
    },
    async request(url, _address, headers, signal) {
      const response = await send(url.href, { method: "GET", headers, redirect: "manual", cache: "no-store", signal });
      return {
        status: response.status,
        body: response.body,
        header(name) {
          const value = response.headers.get(name);
          return name === "content-encoding" && ["gzip", "br"].includes(value?.trim().toLowerCase() ?? "") ? null : value;
        },
      };
    },
  };
}
