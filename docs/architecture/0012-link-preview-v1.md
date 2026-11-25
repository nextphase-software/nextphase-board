# 0012 — Link preview contract

CONTRACT VERSION: 0012 link preview v1 (2026-11-25)

Status: Draft for 0012-W5 v1. **Contract version 1**, new: there is no earlier version. It defines Board's **link
preview fetcher**: the server code that reads a pasted web page once and answers with its title, description, site
and picture. Its two routes, bodies and the one status matrix are in [API v16](0003-api-v16.md); who may call them is
[access v17](0003-access-v17.md); how each runner is configured, the `LinkLimits` store, the test launcher and the
runner proofs are in [self-host runner v11](0003-self-host-runner-v11.md); the web build's `connect-src` origin is
[toolchain v6](0001-toolchain-v6.md). The card, its states and the thumbnail the browser makes are
[document v22](0001-document-v22.md) and [interaction v52](0001-interaction-v52.md).

## 1. Purpose and scope

- The fetcher runs **on the server only**, once per paste, for an owner or editor of a team board (the team route) or
  for a single-user board (the public route). Viewing a card never calls it; copy, duplicate, undo, board files,
  templates and export never call it.
- **Only the link is sent** to the fetcher. It sends no cookie, no credential and nothing from the board to the page's
  site.
- It **stores nothing and caches nothing**: no page, picture, address, title or description is written to any store,
  room, file or log. Its only lasting state is the rate-limit counters of section 11, which hold keys and counts.
- It fetches only `http` and `https` addresses whose every DNS answer is globally reachable and outside the
  operator's deny prefixes (sections 2 and 3; what that does and does not prove on each runner is section 15),
  checks every redirect (section 6) and stops at the size and time limits of sections 7 to 10.
- It never renders, runs or returns HTML, never fetches a favicon, an oEmbed endpoint or `robots.txt`, and makes at
  most two fetch chains per request: the page, then at most one picture.

## 2. Address rules (F1, F2)

An address **passes the address rules** when every check below holds. The fetcher applies them to the pasted address
and again to every redirect target and to the picture address. The web app applies the same two rules in its own
module before asking, and pastes an address that fails them as a text object instead
([interaction v52](0001-interaction-v52.md)).

**F1 — form.**
1. The input is a string of at most **2,048** characters (JavaScript string length, before parsing).
2. It parses as an absolute URL with the WHATWG URL parser (`new URL(input)`, no base).
3. Its scheme is `http:` or `https:`.
4. Its port is 80 or 443: `url.port` is `""` (the scheme's default) or exactly `"80"` or `"443"`.
5. It holds no user name and no password (`url.username === ""` and `url.password === ""`).

**F2 — host.** On `url.hostname` (already lower-case after parsing), with one trailing `.` removed:
1. It is not an IP literal: not an IPv4 dotted quad (the parser has already turned forms such as `0x7f.1` into
   `127.0.0.1`) and not a bracketed IPv6 address.
2. It is not `localhost` and does not end in `.localhost`, `.local`, `.internal` or `.home.arpa`.
3. It has at least one dot (a single-label name such as `intranet` is refused).

The fragment is never sent (requests use the path and query only). The answer's `url` is the pasted address's
`url.href` (section 12), not the last redirect target.

**Lengths.** The server's own limit is F1's **2,048** characters, for any caller. The web app never sends more than
**1,000**: it asks only for an address whose serialized `href` is at most 1,000 characters; a longer pasted text
takes today's paste path, and an allowed address whose `href` is longer becomes a text object, neither with a request
([interaction v52](0001-interaction-v52.md)). So the 2,048 limit only ever judges other callers.

**Where each target's failure lands.** The pasted address failing F1 or F2 is 422 `address_refused`. A page redirect
`Location` that does not parse is 422 `preview_unavailable` (section 6); one that parses but whose target fails F1 or
F2 (or the address policy) is 422 `address_refused`. A picture address (section 8) or picture redirect target that
does not parse, or fails F1, F2 or the address policy, gives `picture: null` with a 200. API v16's matrix states the
same outcomes.

## 3. Resolution and the address policy (F3)

Before **every** hop (the page, each redirect target, the picture and its redirect targets) the fetcher asks its
transport (section 4) to resolve the host and checks **every** answer against the address policy below. The policy is
an **allow rule**: an answer is allowed only when it is globally reachable; everything else is refused.

**Answers.** Every A and AAAA answer is checked; CNAME records are followed by the resolver and are not themselves
answers. The transport returns the IPv4 answers first, then the IPv6 answers, each family in the resolver's order.
An answer that does not parse as an IPv4 dotted quad (four decimal parts, 0–255) or as IPv6 text, or that carries a
zone id (`%…`), is refused. IPv6 text is parsed to its 16 bytes before any check, so every textual form of one address
(`::ffff:127.0.0.1`, `::ffff:7f00:1`, `0:0:0:0:0:ffff:7f00:1`) is judged the same.

**The policy, in this order:**
0. An answer inside any of the operator's **deny prefixes** (below) is **refused**. An IPv4-mapped answer is checked
   both as written (against IPv6 prefixes) and unmapped (against IPv4 prefixes). This step comes before the test
   allowlist too: an allowlisted answer inside a deny prefix is refused.
1. An IPv6 answer in `::ffff:0:0/96` (IPv4-mapped) is **unmapped** to the IPv4 address in its last 32 bits, and step 3
   judges that IPv4 address.
2. An IPv6 answer in `64:ff9b::/96` (the NAT64 well-known prefix) is **refused outright**: its real destination is an
   IPv4 address chosen by a translator the fetcher cannot see, so it cannot be validated.
3. An IPv4 answer is allowed unless it lies in a block of table A.
4. Any other IPv6 answer is allowed only when it lies in **`2000::/3`** (global unicast) and in no block of table B.
   Everything outside `2000::/3` is refused, which covers `::1/128`, `::/128`, `::/96` (IPv4-compatible),
   `64:ff9b:1::/48`, `100::/64`, `100:0:0:1::/64`, `5f00::/16`, `fc00::/7`, `fe80::/10` and `ff00::/8`.

**Table A — IPv4 blocks refused.** Source: IANA's IPv4 Special-Purpose Address Registry (last updated 2025-10-09, read
2026-11-25), every block not marked globally reachable, plus multicast from IANA's IPv4 Address Space Registry.

| Block | Registry name | Registry source and reachability |
| --- | --- | --- |
| `0.0.0.0/8` | "This network" (with `0.0.0.0/32`, this host) | Special-purpose; not globally reachable |
| `10.0.0.0/8` | Private-Use | Special-purpose; not globally reachable |
| `100.64.0.0/10` | Shared Address Space | Special-purpose; not globally reachable |
| `127.0.0.0/8` | Loopback | Special-purpose; not globally reachable |
| `169.254.0.0/16` | Link Local | Special-purpose; not globally reachable |
| `172.16.0.0/12` | Private-Use | Special-purpose; not globally reachable |
| `192.0.0.0/24` | IETF Protocol Assignments | Special-purpose; not globally reachable. Refused whole, including its sub-entries: `192.0.0.0/29`, `192.0.0.8/32`, `192.0.0.170/32` and `192.0.0.171/32` (not globally reachable) and `192.0.0.9/32` and `192.0.0.10/32` (protocol anycast addresses marked globally reachable, which serve no web page) |
| `192.0.2.0/24` | Documentation (TEST-NET-1) | Special-purpose; not globally reachable |
| `192.88.99.0/24` | Deprecated (6to4 Relay Anycast) | Special-purpose; deprecated, no reachability listed; its `192.88.99.2/32` is not globally reachable |
| `192.168.0.0/16` | Private-Use | Special-purpose; not globally reachable |
| `198.18.0.0/15` | Benchmarking | Special-purpose; not globally reachable |
| `198.51.100.0/24` | Documentation (TEST-NET-2) | Special-purpose; not globally reachable |
| `203.0.113.0/24` | Documentation (TEST-NET-3) | Special-purpose; not globally reachable |
| `224.0.0.0/4` | Multicast | IPv4 Address Space Registry |
| `240.0.0.0/4` | Reserved (with `255.255.255.255/32`, Limited Broadcast) | Special-purpose; not globally reachable |

The registry's globally reachable entries outside these blocks (`192.31.196.0/24` and `192.175.48.0/24`, AS112;
`192.52.193.0/24`, AMT) are ordinary allowed addresses.

**Table B — IPv6 blocks refused inside `2000::/3`.** Source: IANA's IPv6 Special-Purpose Address Registry (last
updated 2025-10-09, read 2026-11-25), every block inside `2000::/3` not marked globally reachable; `2000::/3` itself is
the global unicast space of IANA's IPv6 Address Space Registry.

| Block | Registry name | Registry source and reachability |
| --- | --- | --- |
| `2001::/23` | IETF Protocol Assignments | Special-purpose; not globally reachable unless a more specific entry says so. Refused whole, including `2001::/32` (TEREDO, reachability N/A: its destination is an embedded IPv4 address), `2001:2::/48` (Benchmarking) and `2001:10::/28` (deprecated ORCHID), and also the globally reachable protocol entries inside it (`2001:1::1/128`, `2001:1::2/128`, `2001:1::3/128` anycast; `2001:3::/32` AMT; `2001:4:112::/48` AS112-v6; `2001:20::/28` ORCHIDv2; `2001:30::/28` drone entity tags), which are protocol identifiers that serve no web page |
| `2001:db8::/32` | Documentation | Special-purpose; not globally reachable |
| `2002::/16` | 6to4 | Special-purpose; reachability N/A (its destination is an embedded IPv4 address that cannot be validated) |
| `3fff::/20` | Documentation | Special-purpose; not globally reachable |

The registry's other globally reachable entry inside `2000::/3` (`2620:4f:8000::/48`, AS112) is an ordinary allowed
address. A later change to either registry is adopted only by a new version of this contract.

**Deny prefixes.** `LinkFetcherOptions.denyPrefixes` (section 4) is a list of CIDR blocks the fetcher refuses **in
addition to** the policy. It is a production setting, not a test seam: the Node runner fills it from the settings
file's optional **`linkPreviewDenyPrefixes`** ([self-host runner v11](0003-self-host-runner-v11.md)); absent means
`[]`. Each entry is an IPv4 block `a.b.c.d/n` (`n` 0–32) or an IPv6 block `<IPv6 text>/n` (`n` 0–128) whose bits after
the first `n` are all zero; any other entry makes `checkSettings` refuse the file at start. It exists for networks
whose egress translates addresses (section 15): an operator lists the translation prefixes there, for example a
network-specific NAT64 prefix such as `2001:db8:64::/96`. The Workers runner has no such setting (its outbound
`fetch` leaves through Cloudflare's network, not the operator's).

**Test allowlist.** `LinkTransport` has an optional, read-only `testAllow: ReadonlySet<string>`. An answer whose
canonical text (IPv4 dotted; IPv6 as the WHATWG URL parser writes it) is in that set, and outside every deny prefix
(step 0), is allowed without the rest of the policy; every other answer is judged by it. Every entry must lie inside `192.0.2.0/24`, `198.51.100.0/24`, `203.0.113.0/24`
or `2001:db8::/32`, so an allowlist can never exempt a private, loopback or routable public address: the transport
constructors throw at creation for any other entry. Production never sets it (section 4, "Production never sets a
seam").

**Outcomes.**
- **If any answer of a hop is refused, the hop is refused** and no connection is made. A name with one allowed and
  one refused answer is refused. A refused **page** hop (the pasted address or a page redirect target) ends the
  request with 422 `address_refused`; a refused **picture** hop gives `picture: null` (section 9).
- A name with no allowed or refused answer at all (no A and no AAAA record), or a resolver failure as the transport
  defines it (section 4), ends a page hop with 502 `preview_failed` and a picture hop with `picture: null`.
- The **vetted address** is the first answer in the transport's order (IPv4 first). Only it is used for the hop
  (section 4).

## 4. Transports

The fetcher (`apps/server/src/link-preview/fetcher.ts`) holds every rule and limit. It reaches the network only
through one injected interface, so the same rules run on both runners and in unit tests with a fake transport and
clock:

```ts
export type LinkHeaders = Readonly<Record<string, string>>;
export type LinkReply = {
  status: number;                           // the HTTP status of this hop
  header(name: string): string | null;      // a response header by lower-case name, null when absent
  body: ReadableStream<Uint8Array> | null;  // the response body, not yet read; cancelling it ends the connection
};
export interface LinkTransport {
  // Test only (section 3): documentation addresses exempt from the policy. Never set in production.
  readonly testAllow?: ReadonlySet<string>;
  // Every A and AAAA answer for `host`, as text, IPv4 answers first; [] when the name has none.
  // Rejects when the resolver fails as this transport defines it, or when `signal` aborts.
  resolve(host: string, signal: AbortSignal): Promise<string[]>;
  // One GET of `url` (path and query only), sending exactly `headers`, never following a redirect,
  // never adding a cookie or credential. `address` is the vetted address of section 3.
  // Rejects when the connection or the request fails before a status, or when `signal` aborts;
  // an abort also errors `body`.
  request(url: URL, address: string, headers: LinkHeaders, signal: AbortSignal): Promise<LinkReply>;
}
export type LinkFetcherOptions = {
  transport: LinkTransport;
  now(): number;                       // the clock (the runner's `runtime.now`, a fake clock in tests)
  abortAfter(ms: number): AbortSignal; // `AbortSignal.timeout` in production, the fake clock's timer in tests
  startedAt: number;                   // now() read when the route handler started (section 10)
  denyPrefixes?: readonly string[];    // section 3, step 0: the operator's deny prefixes (Node settings); [] when absent
};
export function fetchLinkPreview(input: string, options: LinkFetcherOptions): Promise<LinkPreview>;
```

`fetchLinkPreview` answers the 200 body of section 12, or throws `RoomError` (`nextphase-board-room/protocol.ts`)
with 422 `address_refused`, 422 `preview_unavailable` or 502 `preview_failed`. When the phase's or the request's
deadline has fired, the outcome is the deadline's (section 10) whichever step then rejected. Any other error inside it
becomes 502 `preview_failed`; it never lets an error reach the app's generic 503 handler.

**Body handling, both transports.** The fetcher cancels a reply's `body` on **every** exit from a hop: a redirect
(before the next hop starts), a size or head stop, an unusable reply, a deadline, a refused picture type and any
error. On Node a cancelled body destroys the response and its socket; on Workers it releases the subrequest.

**Node transport** (`apps/server/src/link-preview/transport-node.ts`,
`createNodeTransport(options?: NodeTransportOptions)`) **pins every connection**:
- `resolve` uses a new `dns.promises.Resolver({ timeout: 2000, tries: 1 })` (`node:dns`) per hop, never the OS
  `dns.lookup` and never the hosts file. It runs `resolve4(host)` and `resolve6(host)` together, behind a **fence**:
  it waits at most until the earlier of 2,000 ms (its own timer) and `signal`'s abort; then it calls the resolver's
  `cancel()` and drops any later result, which is never used for this or any other hop. For each family,
  `ENODATA` and `ENOTFOUND` mean no answers; any other error, or the fence, means that family failed. **One family
  failing is accepted when the other answered**: the answers are those of the family that answered, IPv4 first. Both
  families failing rejects (502 `preview_failed`); no answer in either family answers `[]` (502 `preview_failed`).
  Because the connection is pinned to the vetted address, an unseen answer of a failed family is never used.
- `request` uses `node:http` `request` or `node:https` `request` (by the URL's scheme) with `host` the URL's hostname,
  `port` the URL's port (or the scheme's default), `method: "GET"`, the given headers plus `Host: url.host`,
  `servername: url.hostname` (TLS SNI), `agent: false` (a new connection, never a pooled one), `signal`, and a
  **`lookup` option that answers only the vetted address**: `callback(null, address, family)`, or
  `callback(null, [{ address, family }])` when called with `all: true`. The connection is therefore **pinned** to the
  address the fetcher checked; no second DNS lookup happens. TLS certificates are verified as Node's defaults do,
  against the name.
- It sends `Accept-Encoding: identity`. A response whose `Content-Encoding` is present and not `identity` is unusable
  (a page: 422 `preview_unavailable`; a picture: `null`).
- The response becomes a web `ReadableStream` (`Readable.toWeb`); every socket and request error is handled inside
  the transport, so nothing is printed. No dependency is added.
- **Test seams**, the optional members of `NodeTransportOptions` (test code only; production passes none):
  - `resolver`: an object with `resolve4(host)`, `resolve6(host)` and `cancel()`, replacing the `Resolver`; the
    fence, the per-family rules and the 2,000 ms timer still apply;
  - `testAllow`: the test allowlist of section 3, exposed as the transport's `testAllow`;
  - `testDial(address: string, protocol: "http:" | "https:") => { host: "127.0.0.1"; port: number }`: used **only
    when the vetted address is in `testAllow`**. The connection's `lookup` then answers `127.0.0.1` and the port is
    the dial's port; the `Host` header and the SNI keep the name, and the certificate is verified against the name.
    For a vetted address not in `testAllow` it is never called. Creation throws when `testDial` is given without
    `testAllow`, and a dial answer whose `host` is not `127.0.0.1` is refused;
  - `ca`: the certificate authority that `https` test connections trust instead of Node's roots;
  - `onSocket(record)`: called once per connection with `{ vetted, remoteAddress, remotePort, servername }` read
    from the connected socket, so a test sees where the connection really went.

  The fetcher's rules are never replaced; the allowlist only exempts listed documentation addresses.

**Worker transport** (`apps/server/src/link-preview/transport-worker.ts`,
`createWorkerTransport(options?: WorkerTransportOptions)`) **checks, then lets the platform connect**:
- A Worker cannot pin an address: `fetch` resolves the name again, and the TCP `connect()` API refuses Cloudflare's
  own address ranges, which many sites use. So `resolve` checks each hop's name **through DNS over HTTPS before the
  hop**, as defence in depth, and `request` then lets the platform connect. The protection against private
  destinations on Workers rests on the platform itself; the residual is stated in "Known limits".
- `resolve` sends two queries together, `https://cloudflare-dns.com/dns-query?name=<host>&type=A` and `…&type=AAAA`,
  each `fetch(<query>, { method: "GET", headers: { accept: "application/dns-json" }, redirect: "manual",
  cache: "no-store", signal })` where `signal` aborts at the earlier of **2,000 ms** and the hop's signal. A reply is
  **valid** only when all hold: status 200 (any 3xx, returned unfollowed, is invalid); at most **65,536 bytes** of
  body are read (a longer body is invalid and cancelled); the body parses as a JSON object; its `Status` is 0 or 3;
  with `Status` 0, `Answer` is absent or an array; every `Answer` entry of `type` 1 has `data` that is an IPv4 dotted
  quad and every entry of `type` 28 has `data` that is IPv6 text (entries of other types, such as CNAME, are
  skipped). `Status` 3 (NXDOMAIN) or no type 1/28 entry means no answers for that family. **Both** replies must be
  valid: an invalid reply, a timeout or a failed query of either family rejects (502 `preview_failed`), because the
  platform's own lookup could use answers the check did not see. (A Worker cannot fetch an IP-literal URL, so the
  resolver is reached by name.)
- `request` calls `fetch(url.href, { method: "GET", headers, redirect: "manual", cache: "no-store", signal })` and
  does not use `address`. With `redirect: "manual"` a 3xx reply is returned unfollowed with its `Location` header
  (proved in the production configuration by S478).
- It sends `Accept-Encoding: identity`. The runtime may still negotiate `gzip` or `br` with the origin and decodes
  them as the body is read; so on Workers a `Content-Encoding` of `gzip` or `br` is accepted and the size limits apply
  to the decoded bytes read. Any other `Content-Encoding` is unusable, as on Node.
- The Worker runs with the compatibility flag **`global_fetch_strictly_public`**: its global `fetch` is routed as a
  request from the public internet would be. A request to a host on the Worker's own zone therefore goes through
  Cloudflare's public entry point for that zone (its rules apply, and it may be served by this Worker or another
  Worker routed on that zone) instead of straight to the zone's origin. The supported configuration and its effect on
  the server's other subrequests are in [self-host runner v11](0003-self-host-runner-v11.md).
- **Test seams**, the optional members of `WorkerTransportOptions` (the test worker only; production passes none):
  `fetch` (replacing the global `fetch`, so the test worker can answer DoH queries from the test resolver table and
  send test names to the local page server), `doh` (the resolver URL) and `testAllow` (section 3). The fetcher's rules
  and the DoH reply rules are never replaced.

**Production never sets a seam.** `start-node.ts` calls `createNodeTransport(options.linkTransport)`; only
`tests/server/node-test.ts` and the test-only launcher `tests/browser/link-preview-stack.mjs`
([self-host runner v11](0003-self-host-runner-v11.md)) pass `linkTransport`, and `apps/server/src/node.ts` calls
`startNode(settings)` with no options, unchanged. `worker-runtime.ts` calls `createWorkerTransport()` with no argument.
No settings key, environment variable, header or request value can set a seam. Review (V8) checks this by grepping
`apps/server/src` for `testAllow`, `testDial`, `onSocket`, `linkTransport` and `linkLimits`: they appear only in the
two transports' option types and checks, the fetcher's allowlist check and `NodeOptions` (and its use in
`start-node.ts`), never with a value.

## 5. Request headers (F7)

Every hop sends exactly these headers and no others (the transport adds `Host` and, on Node, `Connection`):

| Header | Value |
| --- | --- |
| `User-Agent` | `NextPhaseBoard-LinkPreview/1` |
| `Accept` | `text/html,application/xhtml+xml` for page hops; `image/png,image/jpeg,image/gif,image/webp` for picture hops |
| `Accept-Language` | `en` |
| `Accept-Encoding` | `identity` (both runners; section 4 says what a Worker's runtime may still negotiate) |

No `Cookie`, no `Authorization`, no `Referer`. A `Set-Cookie` in a reply is ignored and never sent back.

## 6. Redirects (F6)

- Every hop uses `redirect: "manual"` (Workers) or no redirect handling at all (Node).
- A reply of 301, 302, 303, 307 or 308 is a redirect when its `Location` header is present and
  `new URL(location, <current hop's URL>)` succeeds, so a relative `Location` resolves against the current URL. Its
  body is cancelled before the next hop. The next hop is always a `GET` with no body.
- One of those statuses with a **missing or unparsable `Location`**, and **any other 3xx** (300, 304, 305, 306), is an
  unusable reply: the page ends with 422 `preview_unavailable`, the picture with `null`.
- **At most 3 redirects** for the page, and at most 3 for the picture. A fourth redirect ends the page with 422
  `preview_unavailable` (the picture with `null`) before any resolution of or request to its target.
- **Every target goes through sections 2 and 3 again** before any request to it. A page target that parses but fails
  F1, F2 or the address policy (a scheme other than `http` or `https`, a port other than 80 or 443, credentials, an
  IP literal, a refused answer) ends the request with 422 `address_refused`; a picture target failing them gives
  `null`. No request is made to it.

## 7. The page (F8)

- **Time**: the page phase (every page hop's resolution, connection, headers and body) ends **5,000 ms** after it
  starts, or earlier at the request's ceiling (section 10). At that deadline the hop is aborted, its body cancelled,
  and the page ends with 422 `preview_unavailable`.
- **Final reply**: a 2xx status, a `Content-Type` whose media type (before any `;`, compared case-insensitively) is
  `text/html` or `application/xhtml+xml`, and an acceptable `Content-Encoding` (section 4). Anything else is 422
  `preview_unavailable`.
- **Size**: at most **1,048,576 bytes** are **read from the body stream** (with identity encoding these are the bytes
  sent; on Workers with `gzip` or `br`, the decoded bytes). A chunk that crosses the limit is cut at it. The body is
  then cancelled; the rest of the page is never read. A page larger than 1 MiB whose title lies within the bytes read
  answers 200.
- **Head stop**: reading also stops at the first `</head` followed by white space, `/` or `>` (ASCII, any letter case)
  that lies **outside** comments (`<!--` to `-->`) and outside the raw text of `<script>`, `<style>`, `<template>`,
  `<noscript>` and `<title>` (from the start tag to its matching end tag, any letter case). The scan runs over the raw
  bytes as ASCII with its state carried across chunks, so a marker split between two chunks is still found; for a
  charset that is not ASCII-compatible (UTF-16) it finds nothing and reading stops at 1 MiB or the end.
- **Failed read**: a body that errors after the status arrived (a reset, a truncated chunk) ends the page with 422
  `preview_unavailable`, even when a title was already read.
- **Text**: the bytes read are decoded with the `charset` parameter of `Content-Type` when `TextDecoder` supports that
  label, otherwise as UTF-8, never fatally (bad bytes become U+FFFD). `<meta charset>` is not read.
- **Classes of ending** (the full matrix is API v16's "Answers"): no answer for the name, a resolver failure or a
  connection failure before any reply status (including a TLS or certificate failure) is 502 `preview_failed`; a
  refused address at any page hop is 422 `address_refused`; every other failure (a deadline, a status other than 2xx
  after redirects, a wrong type or encoding, a bad or missing `Location`, too many redirects, a failed read, no
  title) is 422 `preview_unavailable`.

## 8. Metadata (F9)

From the decoded text, after removing every comment (`<!-- … -->`) and every `<script>`, `<style>`, `<template>` and
`<noscript>` element with its content:

- **Meta tags**: each `<meta …>` tag's attributes are read (names case-insensitive; values in double quotes, single
  quotes or unquoted). Its key is the value of `property`, else of `name`, lower-cased; its value is `content`. The
  **first** tag with a given key counts.
- **Title**: `og:title` → `twitter:title` → the text of the first `<title>…</title>`.
- **Description**: `og:description` → `twitter:description` → `description`.
- **Site**: `og:site_name` → the last page hop's `url.hostname`.
- **Picture address**: `og:image`, else `og:image:secure_url`, else `twitter:image`, resolved with
  `new URL(value, <last page hop's URL>)`. Only the first present candidate is tried: when it throws (the value does
  not parse) or the result fails F1 or F2, the answer is 200 with `picture: null` and no other candidate is tried.

Each text value is cleaned in this order:
1. tags removed (every `<…>` run);
2. entities decoded: numeric (`&#nn;`, `&#xhh;`; zero, surrogates and values past U+10FFFF become U+FFFD) and the
   named `&amp;`, `&lt;`, `&gt;`, `&quot;`, `&apos;` and `&nbsp;` (a space); other named entities are left as written;
3. control characters (U+0000–U+001F, U+007F–U+009F) replaced by spaces, every run of white space collapsed to one
   space, both ends trimmed;
4. cut to its first **300** (title), **500** (description) or **100** (site) code points, then trimmed again. The card
   draws its own ellipsis.

A value that is empty after cleaning counts as absent, and the next source is tried. **Without a title the page ends
with 422 `preview_unavailable`.** Without a description the answer's `description` is `""`.

## 9. The picture (F10)

When the page gave a title and a picture address:
- The picture address goes through sections 2, 3, 5 and 6 exactly as a page hop does, with its own phase of
  **5,000 ms** from its start, also cut by the request's ceiling.
- Its final reply must be 2xx with an acceptable `Content-Encoding`. At most **5,242,880 bytes** (5 MiB) are read; a
  `Content-Length` above that, or a body that passes it, gives no picture (the body is cancelled at once).
- Its type is **sniffed from the bytes** with the existing `pictureSignature` of `nextphase-board-room/pictures.ts`:
  PNG, JPEG, GIF or WebP. Anything else (SVG, ICO, AVIF, HTML) gives no picture. The reply's `Content-Type` is not
  trusted.
- **Any failure of the picture** gives `picture: null` and the answer stays 200: a picture address that does not
  parse, a picture address or redirect target refused by the address rules or the address policy (no connection is
  made to it), a deadline, a resolver or
  connection failure, a failed read, a bad redirect, a size or type failure. The bytes are passed to the answer
  unchanged; the server never decodes, resizes or re-encodes them.

## 10. The whole request and its deadlines

- The request's **ceiling** is **12,000 ms** from `startedAt`, the `now()` the route handler reads as it starts,
  before it reads the body. The body read, the rate-limit call and the fetcher all count against it.
- Each phase's deadline is fixed when the phase starts, as the earlier of its own bound and the ceiling. A slow
  sender never extends a deadline: deadlines are not reset by arriving bytes.
- **Late results are never used.** A body chunk, limiter answer, resolver answer, reply or picture byte that arrives
  after its phase's deadline is dropped; the outcome is the one the table gives for that expiry, whichever step then
  rejected. The only lasting effect a late result may have is a rate-limit count the limiter already made.

**The one deadlines table** (both routes, both runners):

| Phase | Starts | Deadline | On expiry | The late result |
| --- | --- | --- | --- | --- |
| **Body** | As the handler starts (`startedAt`) | The ceiling | The reader is cancelled and the request answers **400 `bad_request`**. The page phase cannot have begun, because the address is in the body | Never read: the reader was cancelled |
| **Limiter** (`limits.take`) | After the content-type and body checks | The earlier of **1,000 ms** and the ceiling | **503 `service_unavailable`**; nothing is fetched | Ignored. A count it made stands (at most one per request) |
| **Address rules** (F1, F2 on the pasted address) | After the limiter allowed | None: a synchronous check of the string | Not applicable | Not applicable |
| **Resolution** (each hop's `resolve`, F3) | As the hop starts | The earlier of **2,000 ms** (section 4) and the hop's phase deadline | A page hop: **502 `preview_failed`**, unless the page phase's deadline has fired, then 422 `preview_unavailable`. A picture hop: `picture: null` | Dropped: never used for this or any other hop (section 4) |
| **Page** (every page hop: resolution, connection, headers, body) | After the address rules passed | The earlier of **5,000 ms** and the ceiling | The hop is aborted, its body cancelled; **422 `preview_unavailable`** | Dropped |
| **Picture** (every picture hop) | After the page gave a title and a picture address | The earlier of **5,000 ms** and the ceiling | The hop is aborted, its body cancelled; **200 with `picture: null`**, sent at once | Dropped |

**The body reader.** The link preview routes do not use the shared `body()` of `apps/server/src/routes/common.ts`,
whose `read()` has no deadline; that reader and every other route stay unchanged. `routes/link-preview.ts` reads
`c.req.raw.body` with its own reader: each `read()` is raced against the ceiling's signal; at the ceiling it calls
`reader.cancel()` and answers 400 `bad_request`. Otherwise it keeps the shared reader's rules exactly: more than
1,048,576 bytes is 413 `body_too_large` (the reader cancelled at once), and a body that is not JSON is 400
`bad_request`.

**The limiter call.** The route races `limits.take(key)` against the limiter deadline. On expiry it answers 503
without waiting for the call, which is left to finish on its own; its answer, allowed or refused, is ignored.
- Fetches per request: at most 4 page fetches and 4 picture fetches (3 redirects each), plus, on Workers, two DoH
  queries before each, so at most 24 outbound requests: within the Workers Free plan's 50 subrequests, each redirect
  counting.

## 11. Rate limits (`LinkLimits`)

Both routes count every well-formed request (after the content-type and body checks, before the address rules) in
**`LinkLimits`**: a Durable Object on Cloudflare, memory on Node ([self-host runner v11](0003-self-host-runner-v11.md)).

| Route | Key | Limits |
| --- | --- | --- |
| Team: `POST /boards/:board/link-preview` | `person:<person id>:<board id>` | **20** a minute |
| Public: `POST /link-preview` | `address:<client address>` (IPv6 grouped by /64, below) | **10** a minute and **200** a day |

- The client address is the `CF-Connecting-IP` header on Cloudflare and the socket's remote address on Node (an
  IPv4-mapped `::ffff:a.b.c.d` written as `a.b.c.d`). The Node runner never reads forwarding headers. When no address
  can be read the key is `address:unknown`, one shared counter.
- **Key form.** An IPv4 client address is keyed in full: `address:203.0.113.7`. An IPv6 client address is **grouped
  by its /64**, so rotating addresses within one /64 does not escape the limit: its last 64 bits are set to zero, the
  result is written as the WHATWG URL parser writes IPv6, and `/64` is appended (`2001:db8:1:2:3:4:5:6` →
  `address:2001:db8:1:2::/64`). A value that parses as neither is keyed `address:unknown`.
- **The limiter's own clock.** Every count is judged by the clock of the store that keeps it, read inside `take`:
  `Date.now()` in the key's Durable Object on Cloudflare (through its overridable `now()` method) and the clock given
  to `memoryLimits` on Node (`Date.now` in production). **No request carries a time**: the route sends only the key,
  and no value from the route, the request or `runtime.now()` reaches the counts. Tests set the limiter's clock: on
  Node by passing the driver's fake clock to `memoryLimits`, on workerd through a test subclass of `LinkLimits` whose
  `now()` reads the driver's controlled clock (as the test `TemplateMedia` does).
- **Fixed windows** aligned to the epoch: a window of length `w` starts at `floor(now / w) * w` (the minute at its
  first millisecond, the day at 00:00 UTC), with `now` the limiter's own clock. The window is derived **inside the
  limiter**, at the moment of `take`, never by the caller.
- A request is allowed when, for every limit of its key, the count in the current window is below the limit; then
  every count of that key goes up by one. Otherwise it is refused with **429 `rate_limited`** and no count changes.
  A stored window whose start is earlier than the current window's start counts as 0 and is replaced by the current
  window. A stored window whose start is later than the current one (the clock stepped back) is kept and counted as
  the current window, so a count is never lowered by a clock step.
- **Atomic.** The check and the increase are one step: on Node `take` runs synchronously over the in-memory map, with
  no `await` between reading the clock, reading and writing a key's counts; on Cloudflare the key's Durable Object
  reads its clock, reads and writes its counts and sets its alarm within one request, with no outside call between
  them, and handles one request at a time. Two takes near a window start are therefore each judged wholly in the
  window their own clock reading falls in.
- `apps/server/src/link-preview/limits.ts` holds the rule shared by both runners:

```ts
export type LimitRule = { window: number; max: number };
export function rulesFor(key: string): LimitRule[]; // person: → [{60000,20}]; address: → [{60000,10},{86400000,200}]
export type Counts = Record<string, { start: number; count: number }>; // by window length
// `now` is the limiter's own clock reading, taken inside the limiter.
export function take(counts: Counts, rules: LimitRule[], now: number): { allowed: boolean; counts: Counts; next: number | null };
// Drops every stored window that has ended (start + window <= now); keeps the current ones.
export function prune(counts: Counts, now: number): { counts: Counts; next: number | null };
export interface LinkLimitsClient { take(key: string): Promise<boolean>; }
export function memoryLimits(now?: () => number): LinkLimitsClient; // now defaults to Date.now
```

`next` is the earliest end among the stored windows, or `null` when none is left; the limiter's expiry runs at or
after it (section 13). When the store cannot be reached, its call rejects or it does not answer within the limiter
deadline of section 10, the route answers **503 `service_unavailable`** and nothing is fetched.

## 12. Answers

The routes' **one status matrix** is [API v16](0003-api-v16.md) "Answers"; no other table defines statuses. The
fetcher itself produces only 200, 422 `address_refused`, 422 `preview_unavailable` and 502 `preview_failed`, by the
classes of section 7, the picture rule of section 9 and the target outcomes of section 2 ("Where each target's
failure lands"). The deadlines' outcomes are section 10's table.

The 200 body, with `Content-Type: application/json` and `Cache-Control: no-store`:

```ts
type LinkPreview = {
  url: string;          // the pasted address's url.href
  title: string;        // 1–300 code points
  description: string;  // 0–500 code points
  site: string;         // 1–100 code points
  picture: { type: "image/png" | "image/jpeg" | "image/gif" | "image/webp"; bytes: string } | null; // bytes: standard base64, padded
};
```

The browser maps every non-200 answer to a link-only card, with no message ([interaction v52](0001-interaction-v52.md)).

## 13. Nothing kept; logging

- No page, picture, address, title or description is written to any store, room, template store, file or cache, on
  either runner. The answer is built in memory and dropped after it is sent.
- `LinkLimits` holds only keys and counts. **Expiry erases only ended windows.** On Cloudflare each key's object sets
  its alarm at `next`; the alarm reads its own clock, runs `prune`, and erases its storage (`deleteAll()`) only when
  no window is left, otherwise writes the remaining windows and re-arms at the new `next`. A window that started after
  the alarm was set (a take that crossed a window start) is therefore never erased by it. On Node, `prune` runs over
  the map at most once a minute during `take`, and a key whose windows have all ended is removed.
- **Logging**: the link preview modules and routes write **no log line** and put no address, host or page text into
  any error they throw (errors carry only a status and a reason). Should a later version add a log line, it may hold
  only the route (`team` or `public`), an outcome class (`ok`, `no_picture`, `address_refused`,
  `preview_unavailable`, `preview_failed`, `rate_limited`, `bad_request`, `not_found`) and counts; never an address,
  a host, a title, a description or page text.

## 14. Module layout

| File | Holds |
| --- | --- |
| `apps/server/src/link-preview/fetcher.ts` | `LinkTransport`, `LinkReply`, `LinkHeaders`, `LinkFetcherOptions`, `LinkPreview`, `fetchLinkPreview`, the address rules and policy (sections 2, 3), headers, redirects, page, head stop, metadata, picture and deadlines |
| `apps/server/src/link-preview/transport-node.ts` | `createNodeTransport` (section 4) |
| `apps/server/src/link-preview/transport-worker.ts` | `createWorkerTransport` and the DoH reply rules (section 4) |
| `apps/server/src/link-preview/limits.ts` | Section 11's shared rule and `memoryLimits` |
| `apps/server/src/routes/link-preview.ts` | `publicLinkPreview(runtime)`, the exact-path branch for `/link-preview`, `linkPreviewRoutes(app, runtime)`, the team route ([API v16](0003-api-v16.md)), and the routes' cancellable body reader and limiter deadline (section 10) |

The fetcher, the Worker transport and limits import nothing runner-specific (no `node:` module, no Workers type), so
both runners and the unit tests load them. Only `transport-node.ts` imports `node:` modules, and only `start-node.ts`
imports it.

## 15. Known limits

- **Workers do not pin the connection.** On Workers the DoH check before each hop and the platform's own lookup in
  `fetch` are separate. A name that changes its answer between the two (DNS rebinding) is connected to whatever the
  platform's lookup answers. This is an **accepted limit**: such a name can reach only addresses the platform itself
  will connect to. A Worker of this server has no VPC, Tunnel or private-network binding, so its `fetch` reaches only
  the public internet; `fetch` cannot target an IP literal, and a subrequest to a Cloudflare-owned address is refused
  by the platform; with `global_fetch_strictly_public` a request to the Worker's own zone goes through Cloudflare's
  public entry point (section 4), not straight to the origin. The check still refuses every non-global answer it
  sees, so a name that answers privately at check time is never fetched.
- **What the Node runner proves, and where it stops.** The Node runner pins every connection to the vetted address,
  so DNS rebinding does not apply to it: the address it connects to is always one that passed the policy. That is
  the whole guarantee. Whether a policy-passing address can lead to a private destination is a property of the
  host's network, not of the check. On a network whose egress **translates addresses**, for example NAT64 with
  DNS64 under a network-specific prefix (RFC 6052 section 3.3), which lies inside `2000::/3`, or any translation or
  route by which an address the policy allows reaches a private network, a vetted address can still reach a private
  destination. Such a deployment is supported only when its operator either lists every translation prefix in
  `linkPreviewDenyPrefixes` (section 3) or denies private destinations at its egress. The NAT64 well-known prefix
  `64:ff9b::/96` (and the local-use `64:ff9b:1::/48`) is always refused without any setting. A network without
  translation needs neither.
- The public route's per-address limit sees a reverse proxy's address when the Node runner runs behind one
  ([self-host runner v11](0003-self-host-runner-v11.md), operator note).

## 16. Proofs

Server checks in `tests/server/link-preview.test.ts`, each on both runners unless marked, against the test page
servers and the test resolver of [self-host runner v11](0003-self-host-runner-v11.md). The test resolver answers test
names (`*.test`) with allowlisted documentation addresses (section 3), which the seams send to the local page servers
on `127.0.0.1`; the real policy still refuses `127.0.0.1` itself and every documentation address not on the
allowlist. Every check uses its own fresh names, keys and boards, so no check depends on another's counts.

| Check | Shows |
| --- | --- |
| S468 | The team route for an editor: `https://fieldnotes.test/sprint` → 200 with the title, description, site `fieldnotes.test` and the PNG picture byte for byte; `hall.test` → 200 with its `<title>` and `picture: null`. Node: the `onSocket` record names the vetted documentation address, a `remoteAddress` of `127.0.0.1` and the page server's port, and a `servername` of `fieldnotes.test`; the page server records `Host: fieldnotes.test` and SNI `fieldnotes.test`; a name whose certificate is signed by another authority → 502 `preview_failed` (the certificate is verified against the seam's `ca`) |
| S469 | Address rules: `http://127.0.0.1/`, `http://[::1]/`, `http://0x7f.1/`, `http://localhost/`, `http://intranet/`, `ftp://fieldnotes.test/`, `http://user:pw@fieldnotes.test/`, `http://fieldnotes.test:22/` and a 2,049-character address → each 422 `address_refused`, with no request reaching a page server |
| S470 | Rights: a viewer → 403; a non-member → 404; no `Authorization` on the team route → 401; a trashed board → as the existing lifecycle gate |
| S471 | Address policy: names answering `10.0.0.5`, `100.64.0.1`, `::ffff:127.0.0.1`, `::ffff:7f00:1`, `64:ff9b::7f00:1` (NAT64), `64:ff9b:1::1`, `2002:7f00:1::1` (6to4), `2001::1` (Teredo), `3fff::1`, `fc00::1`, an unlisted documentation address, an allowlisted address together with `10.0.0.5`, and a rebinding name (its page redirects once to its own name; the first lookup answers allowlisted, the second `127.0.0.1`) → each 422 `address_refused`, with no connection to a refused address. Node: the resolver seam is asked once per family per hop; a name whose AAAA fails and whose A answers allowlisted → 200; both families failing → 502 `preview_failed`; a resolver that never answers → 502 within 2,500 ms, and its late answer is never used; pinning: the transport's `request` for `http://pinned.test:<page server port>/` with address `127.0.0.1` reaches the page server while the resolver seam records no call. workerd: both DoH queries run before each hop; each invalid DoH reply → 502 `preview_failed`: a 302 from the resolver, a body over 65,536 bytes, `Status` 2, an `Answer` of type 1 with `data` `not-an-address`, a reply after 2,000 ms, and an A reply valid with the AAAA reply failed |
| S472 | Redirects: 3 hops → 200; 4 hops → 422 `preview_unavailable` with no request to the fourth target; a hop to `http://127.0.0.1/` → 422 `address_refused` with no request to it; a relative `Location` resolved against the current URL; a 302 without `Location`, a 302 whose `Location` is `http://[` and a 300 → each 422 `preview_unavailable`; a 302 whose `Location` parses but fails F1 (`ftp://fieldnotes.test/`, `http://fieldnotes.test:22/`) → 422 `address_refused` with no request to it. Pictures: a page whose `og:image` name answers `10.0.0.5` → 200 with `picture: null` and no connection to it; a picture that redirects to `http://127.0.0.1/` → 200 with `picture: null` and no request to it; an `og:image` of `http://[` (does not parse) and one of `ftp://fieldnotes.test/a.png` (fails F1) → each 200 with `picture: null` |
| S473 | Page and picture limits: a 2 MiB page whose `<title>` starts after byte 1,048,576 → 422 `preview_unavailable`; a 2 MiB page with its title in the first 1 MiB and no `</head>` → 200; a page with `</head>` inside a comment and inside a `<script>` before its `<title>` → 200 with that title; a page whose body is reset after its title → 422; `Content-Encoding: x-unknown` → 422; a `windows-1252` title decoded; an 8 s page → 422 within 5.5 s; a non-HTML page → 422; a 6 MiB picture → 200 with `picture: null`; an SVG `og:image` → `picture: null`. The ceiling: the request body sent over 3,000 ms, a page that drips one byte every 900 ms and closes its head about 4.5 s into its phase, and a picture that drips one byte every 900 ms without end → 200 with `picture: null`, answered after 12,000 ms and before the picture's own 5,000 ms deadline (at about 12.5 s). A request body still arriving at 12,000 ms (one byte every 900 ms, never ending) → 400 `bad_request`, answered within 12,500 ms, with no limiter count and no request to a page server. In the counted suites these ceiling cases run with the fake clock in the unit checks; their real-time forms run on both runners in the server-only run |
| S474 | The public route and CORS: a listed `Origin` with no `Authorization` → 200 with `Access-Control-Allow-Origin` of that origin, `Vary: Origin` and no credentials header; an unlisted origin, an absent `Origin`, `Origin: null`, `linkPreviewOrigins` empty, and `allowedOrigin` when it is not listed → each 404 with no CORS header; `OPTIONS` from a listed origin → 204 with `POST, OPTIONS` and `Content-Type` only; `OPTIONS` from `allowedOrigin` (not listed) → 404; `GET` and `PUT` from a listed origin → 404 with its CORS headers. Bodies from a listed origin, each answered with its CORS headers: no `Content-Type`, `text/plain`, `not json`, `{"url":1}` and `{"url":"https://fieldnotes.test/","x":1}` → 400 `bad_request`; 1,048,577 bytes → 413 `body_too_large`; a refused address → 422. The team route with `Content-Type: text/plain` → 400. Near matches stay private: `/link-preview/`, `/link-preview/x` and `/LINK-PREVIEW` without `Authorization` → 401; **Amendment A3 (2026-11-25):** `/link%2Dpreview` and `/%6Cink-preview` from a listed `Origin` without `Authorization` → 401 with no CORS header and no request to a page server; `/workspaces` without `Authorization` → 401; `OPTIONS /workspaces` from `allowedOrigin` → 204 with today's headers |
| S475 | Rate limits, each with a fresh key and the limiter's clock (section 11: the fake clock given to `memoryLimits` on Node, the test `LinkLimits` subclass's `now()` on workerd) set to a window start: the 11th public request within a minute → 429 and the next minute allows again; 200 public requests spread over 20 minutes, then the 201st in a fresh minute of the same UTC day → 429, and the next UTC day allows; the 21st team request from one person on one board within a minute → 429 while another board allows. The counted public requests use refused addresses (422), so no page is fetched. workerd: `CF-Connecting-IP` values `2001:db8:5:6::1` and `2001:db8:5:6::2` share one count and `2001:db8:5:7::1` does not; Node: the loopback socket's key, checked in a fresh day window per check. The limit store made to fail (the driver's control) → 503 `service_unavailable` on both routes, with CORS headers on the public one and no request to a page server. The limit store made to answer after 1,500 ms (the driver's `delayLinkLimits` control) → 503 within 1,500 ms, no request to a page server, and its late answer changes no response. Rollover: a public key filled to 10 in one minute (an 11th → 429); the limiter's clock moved to the next minute's start; then 12 requests sent together → exactly 10 counted and 2 refused with 429; then the old minute's expiry runs (workerd: the key object's alarm, run by the driver; Node: `prune`) → the next request is still 429, so the new minute's counts were not erased |
| S476 | Nothing kept: first a 200 **with a picture** (`fieldnotes.test`) is witnessed. Around it, the server's storage inventory (rooms and template stores; `LinkLimits` aside) is read before and after and is unchanged, and the captured output holds no URL, host, title, description or page text: on Node the server process's stdout and stderr, on workerd every `console` call of the test worker during the request |
| S478 | **Compatibility check** (it proves the runtime under the production configuration, not new code, so it passes on the baseline and on the candidate). Manual redirects, with no `fetch` replacement: the workerd test, running under `wrangler.json`'s compatibility date and flags (`global_fetch_strictly_public` included), calls the global `fetch` itself for a page-server URL answering 302 with `redirect: "manual"` → status 302, the `Location` header readable and equal to the page server's, and no request to the target. Node: `node:http` `request` (as the Node transport uses it, without the transport) returns the same 302 and its `Location`, with no request to the target. The transport's own redirect handling is S472's |

Unit checks (`tests/link-preview-fetcher.test.mjs`, a fake `LinkTransport` and clock) cover: the address rules
table; the address policy with every block of tables A and B, the global entries allowed beside them
(`192.31.196.1`, `2620:4f:8000::1`, an ordinary public address of each family), unmapping and the NAT64 refusal;
the test allowlist (an entry outside the four documentation blocks throws; a listed address passes; an unlisted
documentation address is refused); the deny prefixes (an ordinary public address of each family inside a configured
prefix is refused and the same address without the setting is allowed; an IPv4-mapped answer whose IPv4 address lies
in an IPv4 prefix is refused; an allowlisted address inside a prefix is refused; `checkSettings` refuses an entry
with host bits set, a prefix length out of range or text that is not an address); the limiter (`take` and `prune`
with a fake clock: each window derived from the clock reading; takes interleaved across a window start, each judged
in its own reading's window and none counted twice; a reading earlier than a stored window counted in the stored
window; `prune` keeping the current window and dropping only ended ones; `next`); the /64 key form; metadata order, entity decoding, tag stripping and cut lengths;
the head stop across chunk boundaries, comments and raw-text elements; picture sniffing; redirect counting, bad
`Location` and other 3xx; a parseable redirect target failing F1 (`address_refused`) and an unparseable or
F1-failing picture address (`picture: null`); body cancellation on every exit; every row of section 10's deadlines
table, including the ceiling from `startedAt` with dripping replies, a request body still arriving at the ceiling
(400, the reader cancelled), a limiter answering after 1,000 ms (503, its answer ignored) and a resolver answering
after the page phase's deadline (422, not 502); and the Worker transport's DoH rules with a fake `fetch` (the request's `redirect: "manual"`,
`accept` and signal; each invalid reply shape; the 65,536-byte and 2,000 ms bounds).

## Public references

Read 2026-11-25: the [Open Graph protocol](https://ogp.me/); OWASP's
[SSRF prevention cheat sheet](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html)
(allow list, resolve then connect to the checked address, re-check every redirect); IANA's
[IPv4](https://www.iana.org/assignments/iana-ipv4-special-registry/) and
[IPv6](https://www.iana.org/assignments/iana-ipv6-special-registry/) special-purpose address registries (both last
updated 2025-10-09), the [IPv4 address space](https://www.iana.org/assignments/ipv4-address-space/) and
[IPv6 address space](https://www.iana.org/assignments/ipv6-address-space/) registries; Cloudflare Workers'
[known issues](https://developers.cloudflare.com/workers/platform/known-issues/) (fetch reaches URLs, not IP
addresses), [Request](https://developers.cloudflare.com/workers/runtime-apis/request/) (`redirect` "follow" or
"manual"), [fetch](https://developers.cloudflare.com/workers/runtime-apis/fetch/) (gzip and brotli requested and
decoded by the runtime), [TCP sockets](https://developers.cloudflare.com/workers/runtime-apis/tcp-sockets/)
(Cloudflare IP ranges blocked), [errors](https://developers.cloudflare.com/workers/observability/errors/) (1024: no
subrequest to a Cloudflare-owned address), [limits](https://developers.cloudflare.com/workers/platform/limits/) (50
subrequests on Free, each redirect counting) and
[compatibility flags](https://developers.cloudflare.com/workers/configuration/compatibility-flags/)
(`global_fetch_strictly_public`: same-zone requests routed as from the public internet);
[RFC 6052](https://www.rfc-editor.org/rfc/rfc6052.html#section-3.3) (NAT64 network-specific prefixes); Node's [`dns.Resolver`](https://nodejs.org/api/dns.html#class-dnspromisesresolver)
and the `lookup` option of [`http.request`](https://nodejs.org/api/http.html); Facebook's
[crawler guidance](https://developers.facebook.com/docs/sharing/webmasters/web-crawlers/) (tags within the first 1 MB).
