// SPDX-License-Identifier: Apache-2.0
import { createServer as httpServer } from "node:http";
import { createServer as httpsServer } from "node:https";
import type { IncomingMessage, Server, ServerResponse } from "node:http";
import { deflateSync } from "node:zlib";
import type { Socket } from "node:net";
import type { TLSSocket } from "node:tls";
import { createSecureContext } from "node:tls";

export const sprintTitle = "How we run a five-day design sprint with a small remote team";
export const sprintDescription = "A practical guide to planning, sketching and testing ideas with a small team in one week, with the agenda we use.";
const hallTitle = "Lakeside Hall — directions and parking";
const browserAnswers = {
  "fieldnotes.test": "192.0.2.10", "hall.test": "192.0.2.11", "slow.test": "192.0.2.12",
  "large.test": "192.0.2.13", "hops.test": "192.0.2.14", "intranet.example": "10.0.0.5",
};
const additional = ["clean", "wrongca", "styles", "pictures", "drip", "manual", "pin", "reset", "limit", "chain",
  "relative", "v4only", "rebinding", "bad-doh", "both-fail", "never", "private", "cgnat", "mapped",
  "mapped-hex", "nat64", "nat64-local", "six-to-four", "teredo", "documentation", "ula", "unlisted", "mixed"];
export const fixtureNames = [...Object.keys(browserAnswers).filter(name => name.endsWith(".test")),
  ...additional.filter(name => name !== "wrongca").map(name => name + ".test")];
export const browserAllow = new Set(["192.0.2.10", "192.0.2.11", "192.0.2.12", "192.0.2.13", "192.0.2.14"]);
export const testAllow = new Set([...browserAllow, "192.0.2.15"]);
export const suiteOrigin = "http://127.0.0.1:4174";
const special: Record<string, string[]> = {
  private: ["10.0.0.5"], cgnat: ["100.64.0.1"], mapped: ["::ffff:127.0.0.1"], "mapped-hex": ["::ffff:7f00:1"],
  nat64: ["64:ff9b::7f00:1"], "nat64-local": ["64:ff9b:1::1"], "six-to-four": ["2002:7f00:1::1"],
  teredo: ["2001::1"], documentation: ["3fff::1"], ula: ["fc00::1"], unlisted: ["192.0.2.99"], mixed: ["192.0.2.15", "10.0.0.5"],
};
export function fixtureAnswers(host: string, browser = false): string[] {
  const known = browserAnswers[host as keyof typeof browserAnswers];
  if (known) return [known];
  const name = host.slice(0, -5);
  if (browser || !host.endsWith(".test") || !additional.includes(name)) return [];
  return special[name] ?? ["192.0.2.15"];
}
export function fixtureDial(http: number, https: number) {
  return (_address: string, protocol: "http:" | "https:") => ({ host: "127.0.0.1" as const, port: protocol === "http:" ? http : https });
}
const failed = (code: string) => Object.assign(Error("Fixture resolution"), { code });
export function nodeResolver(records: { host: string; family: string }[] = [], browser = false) {
  let rebound = false;
  const resolve = async (host: string, family: "A" | "AAAA"): Promise<string[]> => {
    records.push({ host, family });
    if (!browser && host === "never.test") return new Promise(resolve => { setTimeout(() => resolve(["192.0.2.15"]), 2350).unref(); });
    if (!browser && (host === "both-fail.test" || host === "v4only.test" && family === "AAAA")) throw failed("ESERVFAIL");
    if (!browser && host === "rebinding.test" && family === "A") {
      const result = rebound ? ["127.0.0.1"] : ["192.0.2.15"]; rebound = true; return result;
    }
    const answers = fixtureAnswers(host, browser).filter(address => address.includes(":") === (family === "AAAA"));
    if (!answers.length) throw failed("ENODATA");
    return answers;
  };
  return { resolve4: (host: string) => resolve(host, "A"), resolve6: (host: string) => resolve(host, "AAAA"), cancel() {} };
}

function chunk(name: string, data: Uint8Array) {
  const body = Buffer.concat([Buffer.from(name), data]), prefix = Buffer.alloc(4), suffix = Buffer.alloc(4);
  prefix.writeUInt32BE(data.length);
  let crc = -1;
  for (const byte of body) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  suffix.writeUInt32BE((~crc) >>> 0);
  return Buffer.concat([prefix, body, suffix]);
}
export function fixturePng(width = 1200, height = 630) {
  const stride = width * 3 + 1, raw = Buffer.alloc(stride * height), head = Buffer.alloc(13);
  const colours = [[255, 217, 102], [154, 214, 245], [184, 224, 168], [255, 179, 193], [154, 214, 245]];
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const cell = Math.max(0, Math.floor((x - 118) / 202)), inColumn = (x - 118) % 202 < 165;
    const row = (y > 175 && y < 310 || y > 333 && y < 466) && x > 118 && x < 1090 && inColumn;
    const rgb = row ? colours[Math.min(4, cell)] : x > 76 && x < 1124 && y > 82 && y < 550 ? [255, 255, 255] : [243, 239, 231];
    const i = y * stride + x * 3 + 1;
    raw[i] = rgb[0]; raw[i + 1] = rgb[1]; raw[i + 2] = rgb[2];
  }
  head.writeUInt32BE(width); head.writeUInt32BE(height, 4); head[8] = 8; head[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", head), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}
type RequestRecord = { name: string; path: string; host?: string; sni?: string; bytes: number };
export async function startLinkFixtures(
  { pageCert: cert, pageKey: key, wrongCert, wrongKey }: { pageCert: string; pageKey: string; wrongCert: string; wrongKey: string },
  options: { http?: number; https?: number; hold?: string[] } = {},
) {
  const holds = new Set(options.hold ?? []), pending = new Set<() => void>(), records: RequestRecord[] = [];
  const image = fixturePng();
  const page = (title: string, metadata = "") => `<html><head><title>${title}</title>${metadata}</head></html>`;
  const withImage = (target: string) => page("Picture fixture", `<meta property="og:image" content="${target}">`);
  function handle(req: IncomingMessage, res: ServerResponse) {
    const path = req.url ?? "/", port = req.socket.localPort, host = req.headers.host;
    const proxy = req.headers["x-link-fixture-host"], control = host === `127.0.0.1:${port}` && proxy === undefined;
    if (path === "/__release" && req.method === "POST" && control) {
      const queue = [...pending]; queue.forEach(send => send());
      return res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify({ released: queue.length }));
    }
    const url = new URL(path, "http://fixture.test");
    if (url.pathname === "/__requests" && req.method === "GET" && control) {
      const name = url.searchParams.get("name");
      return res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify(records.filter(r => !name || r.name === name)));
    }
    if (path.startsWith("/__")) return res.writeHead(404).end();
    const name = typeof proxy === "string" ? proxy : host?.split(":")[0] === "127.0.0.1" ? "direct" : host?.split(":")[0] ?? "";
    const record: RequestRecord = { name, path, host, sni: (req.socket as TLSSocket & { servername?: string }).servername || undefined, bytes: 0 };
    records.push(record);
    const bytes = (data: string | Uint8Array, type = "text/html", headers: Record<string, string> = {}) => {
      record.bytes += Buffer.byteLength(data);
      res.writeHead(200, { "Content-Type": type, ...headers }).end(data);
    };
    const redirect = (target?: string, status = 302) => res.writeHead(status, target ? { Location: target } : {}).end();
    const drip = (last?: string) => {
      res.writeHead(200, { "Content-Type": last ? "text/html" : "image/png" }); res.flushHeaders();
      let ticks = 0;
      const timer = setInterval(() => {
        if (last && ++ticks === 5) { clearInterval(timer); record.bytes += Buffer.byteLength(last); res.end(last); }
        else { record.bytes++; res.write(" "); }
      }, 900);
      res.once("close", () => clearInterval(timer));
    };
    if (url.pathname === "/manual") return redirect("/manual-target");
    if (url.pathname === "/manual-target") return bytes(page("Redirect target"));
    if (name === "wrongca.test") return bytes(page("Wrong authority"));
    if (name === "slow.test") { const t = setTimeout(() => bytes(page("Late page")), 8000); res.once("close", () => clearTimeout(t)); return; }
    if (name === "large.test") return bytes(" ".repeat(2_097_152) + page("Late title"));
    if (name === "rebinding.test") return redirect("/again");
    if (name === "hops.test" || name === "chain.test") {
      const n = Number(url.pathname.split("/").at(-1) || 0), limit = name === "hops.test" ? 4 : Number(url.searchParams.get("max") ?? 3);
      return n < limit ? redirect(`/${n + 1}?max=${limit}`) : bytes(page("Redirect result"));
    }
    if (name === "relative.test") {
      if (!url.searchParams.has("location")) return bytes(page("Relative target"));
      const location = url.searchParams.get("location");
      return redirect(location === "missing" ? undefined : location!, Number(url.searchParams.get("status") ?? 302));
    }
    if (name === "pictures.test") {
      if (url.pathname === "/redirect") return redirect("http://127.0.0.1/");
      if (url.pathname === "/large") return bytes(Buffer.alloc(6_291_456), "image/png", { "Content-Length": "6291456" });
      if (url.pathname === "/svg") return bytes("<svg/>", "image/svg+xml");
      return bytes(withImage(url.searchParams.get("image") ?? "/svg"));
    }
    if (name === "reset.test") {
      res.writeHead(200, { "Content-Type": "text/html", "Content-Length": 800 });
      const text = "<title>Incomplete</title>"; record.bytes = text.length; res.write(text);
      setTimeout(() => res.destroy(), 25);
      return;
    }
    if (name === "drip.test") return url.pathname === "/picture" ? drip() : drip(withImage("/picture"));
    if (name === "styles.test") {
      if (path === "/early") return bytes("<title>Early</title>" + " ".repeat(2_097_152));
      if (path === "/comment") return bytes('<head><!-- </head> --><script>const s = "</head>";</script><title>Real</title></head>');
      if (path === "/charset") return bytes(Buffer.from(page("Café"), "latin1"), "text/html; charset=windows-1252");
      if (path === "/encoding") return bytes(page("Unusable"), "text/html", { "Content-Encoding": "x-unknown" });
      if (path === "/plain") return bytes(page("Unusable"), "text/plain");
    }
    if (name === "hall.test" || name === "v4only.test" || name === "pin.test" || name === "direct") return bytes(page(hallTitle));
    if (name === "fieldnotes.test" || name === "clean.test" || name === "limit.test" || name === "bad-doh.test") {
      if (path === "/cover.png") return bytes(image, "image/png");
      const answer = () => {
        pending.delete(answer);
        return bytes(page(sprintTitle, `<meta property="og:title" content="${sprintTitle}"><meta property="og:description" content="${sprintDescription}"><meta property="og:image" content="/cover.png">`));
      };
      if (holds.has(name + url.pathname)) { pending.add(answer); res.once("close", () => pending.delete(answer)); return; }
      return answer();
    }
    return res.writeHead(404).end();
  }
  const wrong = createSecureContext({ cert: wrongCert, key: wrongKey });
  const okay = createSecureContext({ cert, key });
  const http = httpServer(handle);
  const https = httpsServer({ cert, key, SNICallback(name, callback) { callback(null, name === "wrongca.test" ? wrong : okay); } }, handle);
  const listen = (server: Server, port: number) => new Promise<number>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => { server.off("error", reject); resolve((server.address() as { port: number }).port); });
  });
  const sockets = new Set<Socket>();
  for (const server of [http, https]) server.on("connection", socket => { sockets.add(socket); socket.once("close", () => sockets.delete(socket)); });
  const close = async () => {
    for (const socket of sockets) socket.destroy();
    await Promise.all([http, https].map(server => new Promise<void>(resolve => server.close(() => resolve()))));
  };
  try { return { http: await listen(http, options.http ?? 0), https: await listen(https, options.https ?? 0), close }; }
  catch (error) { await close(); throw error; }
}
