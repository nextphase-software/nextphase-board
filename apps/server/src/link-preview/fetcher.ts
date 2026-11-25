// SPDX-License-Identifier: Apache-2.0
import { RoomError, base64 } from "nextphase-board-room/protocol.ts";
import { pictureSignature } from "nextphase-board-room/pictures.ts";

export type LinkHeaders = Readonly<Record<string, string>>;
export type LinkReply = {
  status: number;
  header(name: string): string | null;
  body: ReadableStream<Uint8Array> | null;
};
export interface LinkTransport {
  readonly testAllow?: ReadonlySet<string>;
  resolve(host: string, signal: AbortSignal): Promise<string[]>;
  request(url: URL, address: string, headers: LinkHeaders, signal: AbortSignal): Promise<LinkReply>;
}
export type LinkFetcherOptions = {
  transport: LinkTransport;
  now(): number;
  abortAfter(ms: number): AbortSignal;
  startedAt: number;
  denyPrefixes?: readonly string[];
};
export type LinkPreview = {
  url: string;
  title: string;
  description: string;
  site: string;
  picture: { type: NonNullable<ReturnType<typeof pictureSignature>>; bytes: string } | null;
};

export const REQUEST_MS = 12_000;
const HTML_BYTES = 1_048_576;
const PICTURE_BYTES = 5_242_880;
const pageUnavailable = () => new RoomError(422, "preview_unavailable");
const addressRefused = () => new RoomError(422, "address_refused");
const previewFailed = () => new RoomError(502, "preview_failed");

type Address = { bits: 32 | 128; value: bigint; text: string };
type Prefix = Pick<Address, "bits" | "value"> & { size: number };

function ipv4(text: string): Address | null {
  const parts = text.split(".");
  if (parts.length !== 4 || parts.some(part => !/^\d{1,3}$/.test(part) || Number(part) > 255)) return null;
  const numbers = parts.map(Number);
  return { bits: 32, value: numbers.reduce((n, part) => n * 256n + BigInt(part), 0n), text: numbers.join(".") };
}

export function parseAddress(text: string): Address | null {
  if (!text.includes(":")) return ipv4(text);
  if (!/^[0-9a-f:.]+$/i.test(text)) return null;
  const canonical = URL.parse(`http://[${text}]/`)?.hostname.slice(1, -1);
  if (!canonical) return null;
  const [left, right] = canonical.split("::");
  const front = left ? left.split(":") : [];
  const end = right ? right.split(":") : [];
  const parts = right === undefined ? front : [...front, ...Array<string>(8 - front.length - end.length).fill("0"), ...end];
  const value = parts.reduce((n, part) => n * 65536n + BigInt(`0x${part}`), 0n);
  return { bits: 128, value, text: canonical };
}

function prefix(text: string): Prefix {
  const [host, length, ...rest] = text.split("/");
  const address = parseAddress(host);
  const size = Number(length);
  if (!address || rest.length || !/^\d{1,3}$/.test(length ?? "") || size > address.bits) throw Error("invalid_deny_prefix");
  const trailing = BigInt(address.bits - size);
  if (address.value >> trailing << trailing !== address.value) throw Error("invalid_deny_prefix");
  return { bits: address.bits, value: address.value, size };
}

export function checkDenyPrefixes(values: readonly string[]): void { values.map(prefix); }

function contains(range: Prefix, address: Address): boolean {
  const trailing = BigInt(range.bits - range.size);
  return range.bits === address.bits && address.value >> trailing === range.value >> trailing;
}

const documentation = ["192.0.2.0/24", "198.51.100.0/24", "203.0.113.0/24", "2001:db8::/32"].map(prefix);
const refused4 = [
  "0.0.0.0/8", "10.0.0.0/8", "100.64.0.0/10", "127.0.0.0/8", "169.254.0.0/16", "172.16.0.0/12",
  "192.0.0.0/24", "192.88.99.0/24", "192.168.0.0/16", "198.18.0.0/15", "224.0.0.0/4", "240.0.0.0/4",
].map(prefix).concat(documentation.filter(range => range.bits === 32));
const refused6 = ["2001::/23", "2002::/16", "3fff::/20", "2001:db8::/32"].map(prefix);
const global6 = prefix("2000::/3");

export function testAllowlist(entries?: ReadonlySet<string>): ReadonlySet<string> | undefined {
  if (!entries) return undefined;
  const allowed = new Set<string>();
  for (const entry of entries) {
    const address = parseAddress(entry);
    if (!address || !documentation.some(range => contains(range, address))) throw Error("invalid_test_address");
    allowed.add(address.text);
  }
  return allowed;
}

function ipv4Text(value: bigint): string {
  return [24n, 16n, 8n, 0n].map(shift => Number(value >> shift & 255n)).join(".");
}
function unmap(address: Address): Address {
  return address.bits === 128 && address.value >> 32n === 65535n ? ipv4(ipv4Text(address.value))! : address;
}

export function addressKey(value: string | undefined): string {
  const parsed = value && parseAddress(value);
  if (!parsed) return "address:unknown";
  const address = unmap(parsed);
  if (address.bits === 32) return "address:" + address.text;
  const network = address.value >> 64n << 64n;
  const expanded = [112n, 96n, 80n, 64n].map(shift => (network >> shift & 65535n).toString(16)).join(":");
  return "address:" + parseAddress(expanded + "::")!.text + "/64";
}

function vettedAddress(text: string, deny: Prefix[], allowed?: ReadonlySet<string>): string {
  const original = parseAddress(text);
  if (!original) throw addressRefused();
  const address = unmap(original);
  if (deny.some(p => contains(p, original) || contains(p, address))) throw addressRefused();
  if (allowed?.has(original.text) && documentation.some(p => contains(p, original))) return original.text;
  const permitted = address.bits === 32 ? !refused4.some(p => contains(p, address))
    : contains(global6, address) && !refused6.some(p => contains(p, address));
  if (!permitted) throw addressRefused();
  return original.text;
}

function allowedURL(url: URL, length: number): URL {
  const host = url.hostname.replace(/\.$/, "");
  if (length > 2048 || (url.protocol !== "http:" && url.protocol !== "https:") ||
      (url.port && url.port !== "80" && url.port !== "443") || url.username || url.password ||
      !host.includes(".") || parseAddress(host) || host.startsWith("[") ||
      /(?:^|\.)(?:localhost|local|internal|home\.arpa)$/.test(host)) throw addressRefused();
  return url;
}

export function raceAbort<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const abort = () => reject(signal.reason);
    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted) abort();
    void promise.then(
      value => signal.aborted ? abort() : resolve(value),
      reject,
    ).finally(() => signal.removeEventListener("abort", abort));
  });
}

type Clock = Pick<LinkFetcherOptions, "now" | "abortAfter" | "startedAt">;
export function deadline(clock: Clock, maxMs: number) {
  const start = clock.now();
  const end = Math.min(start + maxMs, clock.startedAt + REQUEST_MS);
  const controller = new AbortController();
  const signal = AbortSignal.any([controller.signal, clock.abortAfter(Math.max(0, end - start))]);
  function expired() {
    if (clock.now() >= end && !signal.aborted) controller.abort();
    return signal.aborted;
  }
  return { signal, expired, check() { if (expired()) throw signal.reason; } };
}

export function cancelBody(body: ReadableStream<Uint8Array> | null): void {
  if (body && !body.locked) void body.cancel().catch(() => {});
}

export async function readBytes(
  body: ReadableStream<Uint8Array> | null, limit: number, boundary: ReturnType<typeof deadline>,
  overflow: () => Error, stop?: (bytes: Uint8Array) => number | undefined,
): Promise<Uint8Array<ArrayBuffer>> {
  const reader = body?.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  if (reader) {
    try {
      while (true) {
        boundary.check();
        const { value, done } = await raceAbort(reader.read(), boundary.signal);
        boundary.check();
        if (done) break;
        if (!stop && size + value.byteLength > limit) throw overflow();
        const chunk = value.subarray(0, limit - size);
        const end = stop?.(chunk);
        const used = end === undefined ? chunk : chunk.subarray(0, end);
        size += used.byteLength;
        chunks.push(used);
        if (end !== undefined || (stop && size >= limit)) break;
      }
    } finally {
      void reader.cancel().catch(() => {});
      reader.releaseLock();
    }
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return bytes;
}

// This scanner only recognizes markup needed for the head and metadata. It
// keeps the incomplete token between chunks, including a raw-text end tag.
class HeadScanner {
  private token = "";
  private raw = "";
  private comment = false;
  private quote = "";
  private endName = "";
  private closed = false;

  push(text: string, tag?: (token: string, contentStart: number, contentEnd: number) => void): number | undefined {
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      if (this.comment) {
        this.token = (this.token + char).slice(-3);
        if (this.token === "-->") { this.comment = false; this.token = ""; }
        continue;
      }
      if (this.raw) {
        const target = "</" + this.raw;
        const lower = char.toLowerCase();
        if (this.token === target && /[\t\n\f\r />]/.test(char)) {
          this.endName = this.raw;
          this.raw = "";
          if (char === ">") {
            tag?.(target + ">", i + 1, i - target.length);
            this.token = ""; this.endName = "";
          } else this.token += char;
        } else {
          this.token += lower;
          if (!target.startsWith(this.token)) this.token = char === "<" ? "<" : "";
        }
        continue;
      }
      if (!this.token) { if (char === "<") this.token = char; continue; }
      if (this.token === "<" && !/[a-z!/?]/i.test(char)) {
        this.token = char === "<" ? "<" : "";
        continue;
      }
      this.token += char;
      if (this.token === "<!--") { this.comment = true; this.token = ""; continue; }
      if (this.quote) { if (char === this.quote) this.quote = ""; continue; }
      if (char === '"' || char === "'") { this.quote = char; continue; }
      if (!this.closed && /^<\/head[\t\n\f\r />]$/i.test(this.token)) {
        this.closed = true;
        if (!tag) return i + 1;
      }
      if (char !== ">") continue;
      const name = /^<([a-z]+)(?=[\t\n\f\r />])/i.exec(this.token)?.[1].toLowerCase();
      const start = i + 1 - this.token.length;
      tag?.(this.endName ? "</" + this.endName + ">" : this.token, i + 1, start);
      if (name && ["script", "style", "template", "noscript", "title"].includes(name)) this.raw = name;
      this.token = ""; this.endName = "";
    }
  }
}

function attributeValues(tag: string): Map<string, string> {
  const attributes = new Map<string, string>();
  for (const match of tag.slice(5, -1).matchAll(/([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g)) {
    const name = match[1].toLowerCase();
    if (!attributes.has(name)) attributes.set(name, match[2] ?? match[3] ?? match[4] ?? "");
  }
  return attributes;
}

const namedEntities: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
function entities(text: string): string {
  return text.replace(/&(#\d+|#x[0-9a-f]+|[a-z]+);/gi, (whole, key: string) => {
    if (!key.startsWith("#")) return Object.hasOwn(namedEntities, key) ? namedEntities[key] : whole;
    const hex = key[1].toLowerCase() === "x";
    const n = Number.parseInt(key.slice(hex ? 2 : 1), hex ? 16 : 10);
    return n === 0 || n > 0x10ffff || n >= 0xd800 && n <= 0xdfff ? "\ufffd" : String.fromCodePoint(n);
  });
}

function clean(text: string | undefined, limit: number): string {
  const value = entities((text ?? "").replace(/<[^>]*>/g, ""))
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, " ").replace(/\s+/gu, " ").trim();
  return Array.from(value).slice(0, limit).join("").trim();
}

function metadata(html: string, host: string) {
  const tags = new Map<string, string>();
  let titleStart = -1;
  let rawTitle: string | undefined;
  new HeadScanner().push(html, (tag, after, before) => {
    if (/^<meta[\s/>]/i.test(tag)) {
      const attrs = attributeValues(tag);
      const name = (attrs.get("property") ?? attrs.get("name"))?.toLowerCase();
      if (name && !tags.has(name)) tags.set(name, attrs.get("content") ?? "");
    } else if (rawTitle === undefined && /^<title[\s/>]/i.test(tag)) {
      titleStart = after;
    } else if (rawTitle === undefined && tag === "</title>" && titleStart >= 0) {
      rawTitle = html.slice(titleStart, before);
    }
  });
  const first = (limit: number, ...values: (string | undefined)[]) => values.map(value => clean(value, limit)).find(Boolean) ?? "";
  const title = first(300, tags.get("og:title"), tags.get("twitter:title"), rawTitle);
  const description = first(500, tags.get("og:description"), tags.get("twitter:description"), tags.get("description"));
  const site = first(100, tags.get("og:site_name"), host);
  const image = tags.get("og:image") ?? tags.get("og:image:secure_url") ?? tags.get("twitter:image");
  return { title, description, site, image: image === undefined ? undefined : entities(image.trim()) };
}

function htmlText(bytes: Uint8Array<ArrayBuffer>, contentType: string) {
  const charset = /(?:^|;)\s*charset\s*=\s*(?:"([^"]*)"|'([^']*)'|([^;\s]+))/i.exec(contentType);
  const label = charset?.[1] ?? charset?.[2] ?? charset?.[3] ?? "utf-8";
  try { return new TextDecoder(label).decode(bytes); }
  catch { return new TextDecoder().decode(bytes); }
}

const redirectStatuses = new Set([301, 302, 303, 307, 308]);
const headers = (picture: boolean): LinkHeaders => ({
  "User-Agent": "NextPhaseBoard-LinkPreview/1",
  Accept: picture ? "image/png,image/jpeg,image/gif,image/webp" : "text/html,application/xhtml+xml",
  "Accept-Language": "en",
  "Accept-Encoding": "identity",
});

async function fetchPhase<T>(start: URL, options: LinkFetcherOptions, picture: boolean,
  read: (reply: LinkReply, phase: ReturnType<typeof deadline>, final: URL) => Promise<T>): Promise<T> {
  const phase = deadline(options, 5000);
  const deny = (options.denyPrefixes ?? []).map(prefix);
  const { transport } = options;
  let url = start;
  try {
    for (let redirects = 0; ; redirects++) {
      phase.check();
      const dnsEnd = options.now() + 2000;
      const signal = AbortSignal.any([phase.signal, options.abortAfter(2000)]);
      const answers = await raceAbort(transport.resolve(url.hostname.replace(/\.$/, ""), signal), signal);
      phase.check();
      if (options.now() >= dnsEnd) throw previewFailed();
      const addresses = answers.map(answer => vettedAddress(answer, deny, transport.testAllow));
      if (!addresses.length) throw previewFailed();

      const target = new URL(url);
      target.hash = "";
      const received = transport.request(target, addresses[0], headers(picture), phase.signal);
      void received.then(reply => { if (phase.expired()) cancelBody(reply.body); }, () => {});
      const reply = await raceAbort(received, phase.signal);
      try {
        phase.check();
        if (reply.status >= 300 && reply.status < 400) {
          const location = reply.header("location");
          const next = location === null ? null : URL.parse(location, url);
          if (!redirectStatuses.has(reply.status) || redirects === 3 || !next) throw pageUnavailable();
          url = allowedURL(next, next.href.length);
          continue;
        }
        const encoding = reply.header("content-encoding")?.trim().toLowerCase();
        if (reply.status < 200 || reply.status >= 300 || encoding && encoding !== "identity") throw pageUnavailable();
        try { return await read(reply, phase, url); }
        catch { throw pageUnavailable(); }
      } finally { cancelBody(reply.body); }
    }
  } catch (error) {
    if (phase.expired()) throw pageUnavailable();
    if (error instanceof RoomError) throw error;
    throw previewFailed();
  }
}

export async function fetchLinkPreview(input: string, options: LinkFetcherOptions): Promise<LinkPreview> {
  const parsed = URL.parse(input);
  if (!parsed) throw addressRefused();
  const url = allowedURL(parsed, input.length);
  const { final, image, ...texts } = await fetchPhase(url, options, false, async (reply, phase, final) => {
    const type = reply.header("content-type") ?? "";
    if (!["text/html", "application/xhtml+xml"].includes(type.split(";")[0].trim().toLowerCase())) throw pageUnavailable();
    const scanner = new HeadScanner();
    const bytes = await readBytes(reply.body, HTML_BYTES, phase, pageUnavailable,
      chunk => scanner.push(new TextDecoder("windows-1252").decode(chunk)));
    const fields = metadata(htmlText(bytes, type), final.hostname);
    if (!fields.title) throw pageUnavailable();
    phase.check();
    return { ...fields, final };
  });
  let picture: LinkPreview["picture"] = null;
  if (image) try {
    const target = URL.parse(image, final);
    if (target) picture = await fetchPhase(allowedURL(target, target.href.length), options, true, async (reply, phase) => {
      if (Number(reply.header("content-length")) > PICTURE_BYTES) return null;
      const bytes = await readBytes(reply.body, PICTURE_BYTES, phase, pageUnavailable);
      const type = pictureSignature(bytes);
      const encoded = type ? base64(bytes) : "";
      phase.check();
      return type ? { type, bytes: encoded } : null;
    });
  } catch { /* The title still makes a preview. */ }
  return { url: url.href, ...texts, picture };
}
