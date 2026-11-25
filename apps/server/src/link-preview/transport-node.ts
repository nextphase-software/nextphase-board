// SPDX-License-Identifier: Apache-2.0
import { Resolver } from "node:dns/promises";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { isIP } from "node:net";
import { Readable } from "node:stream";
import type { TLSSocket } from "node:tls";
import { raceAbort, testAllowlist, type LinkTransport } from "./fetcher.ts";

type SocketRecord = { vetted: string; remoteAddress: string | undefined; remotePort: number | undefined; servername: string | undefined };
export type NodeTransportOptions = {
  resolver?: Pick<Resolver, "resolve4" | "resolve6" | "cancel">;
  testAllow?: ReadonlySet<string>;
  testDial?: (address: string, protocol: "http:" | "https:") => { host: "127.0.0.1"; port: number };
  ca?: string | Buffer;
  onSocket?: (record: SocketRecord) => void;
};

export function createNodeTransport(options: NodeTransportOptions = {}): LinkTransport {
  const testAllow = testAllowlist(options.testAllow);
  if (options.testDial && !testAllow?.size) throw Error("missing_test_allowlist");
  return {
    testAllow,
    async resolve(host, signal) {
      if (signal.aborted) throw Error("resolution_failed");
      const resolver = options.resolver ?? new Resolver({ timeout: 2000, tries: 1 });
      const bound = AbortSignal.any([signal, AbortSignal.timeout(2000)]);
      const answers: string[][] = [[], []];
      const failed: boolean[] = [false, false];
      const checked = [resolver.resolve4(host), resolver.resolve6(host)].map((call, index) =>
        raceAbort(call, bound).then(records => { answers[index] = records; }, (error: unknown) => {
          const code = (error as NodeJS.ErrnoException | undefined)?.code;
          failed[index] = bound.aborted || code !== "ENODATA" && code !== "ENOTFOUND";
        }));
      try { await Promise.all(checked); }
      finally { if (bound.aborted) resolver.cancel(); }
      if (signal.aborted || failed.some(Boolean) && !answers.some(a => a.length)) throw Error("resolution_failed");
      return answers.flat();
    },
    request(url, address, headers, signal) {
      return new Promise((resolve, reject) => {
        if (signal.aborted) { reject(Error("request_failed")); return; }
        const secure = url.protocol === "https:";
        if (!secure && url.protocol !== "http:") { reject(Error("request_failed")); return; }
        const test = testAllow?.has(address) ? options.testDial?.(address, secure ? "https:" : "http:") : undefined;
        if (test && (test.host !== "127.0.0.1" || !Number.isInteger(test.port) || test.port < 1 || test.port > 65535)) {
          reject(Error("invalid_test_dial")); return;
        }
        const ip = test?.host ?? address;
        const family = isIP(ip);
        if (!family) { reject(Error("request_failed")); return; }
        const send = secure ? httpsRequest : httpRequest;
        const req = send({
          host: url.hostname,
          port: test?.port ?? (url.port || (secure ? 443 : 80)),
          path: url.pathname + url.search,
          method: "GET",
          headers: { ...headers, Host: url.host },
          servername: url.hostname,
          ca: options.ca,
          agent: false,
          signal,
          lookup(_host, settings, callback) {
            if (settings.all) callback(null, [{ address: ip, family }]);
            else callback(null, ip, family);
          },
        }, response => {
          const body = Readable.toWeb(response, { strategy: { highWaterMark: 1, size: () => 1 } }) as ReadableStream<Uint8Array>;
          resolve({
            status: response.statusCode ?? 0,
            header: name => {
              const value = response.headers[name];
              return Array.isArray(value) ? value.join(", ") : value ?? null;
            },
            body,
          });
        });
        req.on("error", () => reject(Error("request_failed")));
        if (options.onSocket) req.on("socket", socket => {
          socket.once(secure ? "secureConnect" : "connect", () => options.onSocket?.({
            vetted: address, remoteAddress: socket.remoteAddress, remotePort: socket.remotePort,
            servername: secure ? (socket as TLSSocket & { servername?: string }).servername : undefined,
          }));
        });
        req.end();
      });
    },
  };
}
