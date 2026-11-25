# 0003 — Self-host runner contract

CONTRACT VERSION: 0003 self-host runner v11 (2026-11-25)

Status: Draft for 0012-W5 v1. Replaces [runner v10](0003-self-host-runner-v10.md), whose process, key, volume, fence,
deadline, denial, disposal, spotlight, close, picture, video, streaming, backup, import and template media rules
remain word for word except as below. [API v16](0003-api-v16.md) adds the two link preview routes, and
[link preview v1](0012-link-preview-v1.md) the fetcher they share. This version gives each runner its transport, its
`LinkLimits` store and its settings (with the Node runner's `linkPreviewDenyPrefixes` and the supported Workers
configuration), adds the test fixture owner and a test-only launcher for the browser check, and adds the runner
proofs. The
new rules are in the section **Link previews (v11)**; everything else below is v10's text.

**Carried from v10 (2026-11-25):** v10 replaced [runner v9](0003-self-host-runner-v9.md), whose process, key, volume,
fence, deadline, denial, disposal, spotlight, close, picture, video, streaming and backup rules remain word for word
except as below. [API v15](0003-api-v15.md) adds the staged import and the template media routes;
[hosted storage v15](0003-hosted-storage-v15.md) adds the room's importing state and the template store.

## Reaching the room

`RoomClient` (`apps/server/src/runtime.ts`) gains, each forwarded by both runners exactly as the existing picture and
video calls are (Workers: a `POST http://room/<action>` to the board's Durable Object with the person in `x-person`
and the hash, type and size headers of the picture calls, the video body as the request stream; Node: a direct call):

| Method | Answer |
| --- | --- |
| `openImport(person, workspace: string, assets: AssetEntry[])` | `void`, or a room refusal |
| `beginImport(person, workspace, hash)` / `endImport(person, workspace, token)` | A lease token / `void`, or a refusal |
| `stageImportPicture(person, workspace, token, hash, bytes: Uint8Array, type: PictureType, width, height)` | `"created" \| "exists"`, or a refusal (as `storePicture`'s, plus 410, 403, 400 of hosted storage v15) |
| `stageImportVideo(person, workspace, token, hash, type: VideoType, body: ReadableStream<Uint8Array>)` | As `storeVideo`, or a refusal |
| `claimImport(person, workspace, document)` / `releaseImport(token)` | A claim token / `void`, or a refusal |
| `create(document, importer?: Person, token?: string)` | As today; the optional importer and claim (hosted storage v15) |
| `assetSizes(person, hashes: string[])` | `AssetEntry[]` (held entries, request order) |

`Runtime` gains `templateMedia(upload: string): TemplateMediaClient` (the `TemplateStore` methods of hosted storage
v15 except `alarm`) and `removeTemplateMedia(upload: string): Promise<void>`.

## Where the stores live

| | Cloudflare Workers | Node |
| --- | --- | --- |
| A room in the importing state | The `BoardRoom` Durable Object `ROOMS.idFromName(<upload id>)` (its board's future room) | `<dataDir>/boards/<upload id>.sqlite`, the board's future file |
| A template store | A new Durable Object class **`TemplateMedia`** exported from `apps/server/src/worker.ts`, bound as `TEMPLATE_MEDIA` in `apps/server/wrangler.json` (`durable_objects.bindings`) with a second migration `{ "tag": "v2", "new_sqlite_classes": ["TemplateMedia"] }` appended after `v1`; reached by `idFromName(<upload id>)` (with `BOARD_JURISDICTION` as `ROOMS` is) | `<dataDir>/template-media/<upload id>.sqlite`, the folder created at start with the others; stores opened lazily and cached in a map as rooms are |

The workerd test configuration (`vitest.workerd.config.ts`, `durableObjects`) gains `TEMPLATE_MEDIA: { className:
"TemplateMedia", useSQLite: true }`, and `tests/server/worker-test.ts` exports the class.

## Expiry and erasing

- **Recovery-free staging dispatch (Workers).** `BoardRoom` reads `meta` directly through `ctx.storage.sql` before
  `getRoom()` on every request and alarm. When it holds `import` and no `storage_version`, or holds neither (an unknown
  id reached by a staging action), the request is dispatched to the room **without** `BoardRoom.getRoom()`'s
  recovery-fence check and without contacting `FENCES` (a staging has no recovery state); every other room keeps
  today's check. After promotion `storage_version` exists, so the normal check applies.
- **Workers.** `worker-room.ts`'s `alarm()` handler first reads `meta` directly through `ctx.storage.sql` (no
  `getRoom()`, no table creation): when it holds `import` and no `storage_version` it runs the import expiry only
  (the room object if cached, else the deadline read from `meta.import`), skipping `getRoom()`'s `meta.board_id`
  reconstruction and `BoardRoom.getRoom()`'s recovery-fence check; a normal board's alarm is unchanged. When the
  expiry answers `{ discard: true }` it runs `ctx.storage.deleteAll()` and `ctx.storage.deleteAlarm()` and drops its
  cached room, as the existing `/discard` action does. A room or store request answering `{ discard: true }` (an
  unknown id, hosted storage v15) is erased the same way before its response is returned. The existing `/discard`
  action and the Node `removeRoom` both call `Room.discardLifecycle()`, which is exempt from the importing gate and on
  a staging invalidates uploads with 410 (hosted storage v15); so the finish's compensation (`removeRoom`), the alarm
  and unknown ids share one erase path, serialized with queued work. `TemplateMedia` does the same with
  `TemplateStore.alarm()` and `discard()`; it has its own `fetch` dispatch (`/open`, `/begin`, `/end`, `/stage`,
  `/commit`, `/inventory`, `/read`, `/discard`) and its own `alarm()`. `/stage` takes the asset's bytes as the raw
  request body and `/read` answers them as the raw response body, with the person, workspace, lease token, hash, type
  and size in headers (base64url JSON for the person, as the picture calls do), so a 20 MiB asset is never expanded
  through JSON; the other actions use JSON bodies.
- **Amendment A1 (2026-11-25).** A cold Workers alarm for a staging with the `finishing` mark constructs the room
  without the recovery-fence check and runs the room's expiry path. It erases the staging only after the room
  confirms SQL cleanup; a failure re-arms the alarm. The Node timer uses the same expiry path in `room.alarm()`.
- **Node.** The `schedule` timer of `start-node.ts` that calls `room.alarm()` calls `removeRoom(<id>)` when the
  answer is `{ discard: true }` (closing the database and deleting the `.sqlite`, `-wal` and `-shm` files as today).
  Template stores get the same timer and `removeTemplateMedia`. When the Node runner opens a room or store file
  whose `meta` holds a staging, it arms the timer to the stored deadline (hosted storage v15, "Reopening").
  **Amendment A2 (2026-11-25).** After creating the data folders and before accepting requests, the runner
  reads the `meta` of each `boards/<uuid>.sqlite` read-only, without creating tables or a room. If `import` holds
  the `finishing` mark and `storage_version` is absent, it opens the room through the normal path to re-arm
  expiry. A passed deadline runs A1 cleanup at once. Other files stay unopened by the runner.
- `removeTemplateMedia` on Workers posts `/discard` to the store (`deleteAll()` and `deleteAlarm()`); on Node it
  closes and deletes the store's three files. Erasing a store that does not exist succeeds.
- Room code still calls no timer itself: it reports deadlines through `env.schedule` as today (the shared-module
  guard of `tests/modules.test.mjs` is unchanged). `TemplateStore` receives the same `schedule` and clock from its
  runner.

## Body limits and memory

Unchanged for the board routes. The import upload route uses the board asset route's code path (a picture read whole
up to 20,971,520 bytes, a video streamed up to 52,428,800). The template upload route reads its body whole up to
20,971,520 bytes on both runners, and a template asset is read whole from its parts; both stay far below the 128 MB
isolate memory. The finish route's 13,631,488-byte limit is unchanged.

## Test doubles

The room fixtures gain nothing for the importing state beyond runner v9's fake clock (the alarm is driven by calling
`alarm()` after `tick`). New `tests/room-imports.test.mjs` builds a `TemplateStore` over the same Node SQLite fixture
storage the room tests use. The server test driver (`tests/server/node-test.ts` and the workerd test worker) forwards
the new `RoomClient` and `Runtime` methods. Its storage inventory read (`rows`) can name a template store and never
creates storage: on Node it reports an empty inventory when the file does not exist, on workerd it reads
`ctx.storage.sql` through a test-only action that does not construct a room or store. "Erased" in the proofs means no
row in `meta`, `pictures` and `picture_parts` (and on Node no file), checked again after any probe.

## Proof

Each case runs on both runners; the brief maps them to server checks.

| Case | Shows |
| --- | --- |
| `import-roundtrip` | Open, upload a picture and a video, finish: 201; the board serves both files byte for byte to its owner, editor and viewer; its row's id is the upload id |
| `import-full-size` | An import of 52,428,800 bytes of pictures and 104,857,600 bytes of videos finishes and serves every file (server-only run) |
| `import-idle-drop` | An import opened and given one upload, then left: after 75,000 ms its room storage is erased, no board row exists, an upload or finish answers 410 `upload_expired`, and after that probe the storage is still erased. On Node, also with the runner's room cache dropped (the driver's control) before the deadline: the next probe reopens, re-arms and erases |
| `import-gate` | While importing, including after a board row with the import's id exists (the check inserts it through the RPC between claim and create), the room's socket join answers 401 and its `/boards/:id` asset, export, versions and operator backup routes answer 404, and none writes `storage_version` |
| `import-missing` | A finish whose document names a hash not uploaded is 400 `asset_missing`; no board row exists and the staging still accepts uploads (it is erased only by its deadline) |
| `import-claim` | Two finishes sent together: one 201, the other 409 `import_in_progress`; a third after promotion 409; exactly one board row. A lost `create_board` reply (the test proxy's `failAfter`) and a `create_board` delayed past the server's RPC timeout (the proxy's delay) each answer 503 and leave no row and no room, the delayed insert included (fenced by `discard_import`) |
| `import-workspace` | An opener who edits two workspaces cannot upload to or finish the import through the other workspace's routes (410) |
| `import-other-person` | Another editor of the workspace cannot upload to or finish someone else's import (403) |
| `import-demoted` | An opener made a viewer between upload and finish is refused 403 at the finish; no row |
| `import-budgets` | Open refuses lists over the board budgets (409) and undeclared or mismatched uploads (400) |
| `template-media-roundtrip` | Open, upload, save with `upload`: the template's `GET` lists `media`; a viewer reads each asset byte for byte; a guest 403 |
| `template-media-limit` | A list summing 20,971,521 bytes is 413 `template_too_large`; one of 20,971,520 stores and commits |
| `template-media-replace-delete` | Replace swaps the store and erases the old one; delete erases the store (inventory read) |
| `template-media-refused-save` | A save refused by the 25-template limit leaves no store |
| `template-media-idle-drop` | A staged store left 60,000 ms is erased; its upload id then answers 410 |
| `asset-sizes` | The sizes route answers held entries in order and leaves out others; a non-member 404 |

## Link previews (v11)

New in v11. Both runners serve the two routes of [API v16](0003-api-v16.md) with the one fetcher of
[link preview v1](0012-link-preview-v1.md); they differ only in the transport and the `LinkLimits` store.

### `Runtime`

`Runtime` (`apps/server/src/runtime.ts`) gains:

| Member | Value |
| --- | --- |
| `linkPreviewOrigins: readonly string[]` | The browser origins the public route answers; `[]` turns the public route off (404) |
| `linkPreview: LinkPreviewRuntime` | `{ preview(url: string, startedAt: number): Promise<LinkPreview>; limits: LinkLimitsClient; clientAddress(c: ServerContext): string }`: `preview` is `fetchLinkPreview` bound to the runner's transport, `runtime.now`, `AbortSignal.timeout` and (Node) the settings' `denyPrefixes`, given the `startedAt` its route read as its handler started; `limits` is section 11 of link preview v1 (`take(key)`: the key only, never a time); `clientAddress` gives the public route's key |

A rejection of `limits.take`, or no answer within the limiter deadline of link preview v1 section 10 (1,000 ms, or the
ceiling if earlier), becomes 503 `service_unavailable` in the route, on both runners, and the fetcher is not called;
a late answer is ignored.

### Settings and environment

| | Node (settings file) | Cloudflare Workers (environment) |
| --- | --- | --- |
| Public route origins | **`linkPreviewOrigins`**: optional array of absolute origins, for example `["https://board.example.com"]`. Each entry must equal `new URL(entry).origin` and follow the existing HTTPS rule (plain `http://` only for `localhost`, `127.0.0.1` and `host.docker.internal`); otherwise `checkSettings` refuses the file at start. Absent or `[]`: the public route is off | **`LINK_PREVIEW_ORIGINS`**: optional, comma-separated origins (each entry trimmed, empty entries dropped), set as `ALLOWED_ORIGIN` is, outside `wrangler.json`. An entry that does not equal `new URL(entry).origin`, or is `null`, is ignored (it can never match). Absent or empty: the public route is off |
| Deny prefixes | **`linkPreviewDenyPrefixes`**: optional array of CIDR blocks refused in addition to the address policy (link preview v1 section 3, step 0), for example `["2001:db8:64::/96"]`. Each entry is `a.b.c.d/n` (`n` 0–32) or `<IPv6 text>/n` (`n` 0–128) with every bit after the first `n` zero; otherwise `checkSettings` refuses the file at start. Absent or `[]`: none | None: the Worker's outbound `fetch` leaves through Cloudflare's network, not an operator's translating egress |
| Transport | `createNodeTransport()` from `start-node.ts`: `dns.promises.Resolver` per hop, then a connection pinned to the vetted address | `createWorkerTransport()` from `worker-runtime.ts`: bounded DNS over HTTPS before each hop, then `fetch` with `redirect: "manual"`; the connection is not pinned (link preview v1, "Known limits") |
| `LinkLimits` | `memoryLimits()`: in the process's memory, lost on restart, one store per process | The Durable Object class **`LinkLimits`**, one object per key (`stub(env, "LINK_LIMITS", <key>)`, following `BOARD_JURISDICTION` as the other stores do) |
| Client address | The request socket's remote address (`c.env.incoming.socket.remoteAddress` from `@hono/node-server`), an IPv4-mapped address written as plain IPv4; forwarding headers are never read | The `CF-Connecting-IP` header. On both runners an IPv4 address is keyed in full and an IPv6 address by its /64 (`address:<first 64 bits>::/64`, link preview v1 section 11) |

`settings.ts`'s `Settings` gains `linkPreviewOrigins?: string[]` and `linkPreviewDenyPrefixes?: string[]`; `WorkerEnv` gains `LINK_LIMITS:
DurableObjectNamespace` and `LINK_PREVIEW_ORIGINS?: string`, and the store-namespace type gains `"LINK_LIMITS"`.

### Cloudflare Workers

`apps/server/wrangler.json` changes only by these three items:
- `compatibility_flags` becomes `["nodejs_compat", "global_fetch_strictly_public"]`. **What the flag does:** the
  Worker's global `fetch` is routed as a request from the public internet would be. Without it, a `fetch` to a host
  on the Worker's own zone goes straight to that zone's origin; with it, such a request goes through Cloudflare's
  public entry point for the zone, so the zone's rules apply and it may be served by this Worker, or by another
  Worker routed on that zone, before (or instead of) reaching the origin. A request to a host on any other zone is
  routed the same way with or without the flag. Durable Object stubs (`stub(…).fetch`, for `ROOMS`, `FENCES`,
  `TEMPLATE_MEDIA` and `LINK_LIMITS`) are not the global `fetch` and are not affected.
- **Supported configuration.** The server's existing global-`fetch` subrequests are the Supabase REST calls and the
  sign-in key refresh, both to `SUPABASE_URL`'s host. They are unchanged by the flag **only when that host is on a
  zone other than the server Worker's own**, as a hosted Supabase project's host is. That is the supported
  configuration. A Supabase reached through a host on the Worker's own zone is **unsupported** with this flag: its
  requests would pass through the zone's public entry point and could be routed back to a Worker on that zone. The
  runner does not check this; the operator notes below say it. The new outbound requests are the DNS-over-HTTPS
  queries and the preview hops.
- `durable_objects.bindings` gains `{ "name": "LINK_LIMITS", "class_name": "LinkLimits" }`.
- `migrations` gains `{ "tag": "v3", "new_sqlite_classes": ["LinkLimits"] }`, appended after `v2`.

`LinkLimits` is exported from `apps/server/src/worker.ts`. Its `fetch` answers one action, `POST /take` with the JSON
body `{ "key": string }` (exactly that key; **no time is sent**, and a body with any other key is refused), by
running `take` of `limits.ts` over the counts it keeps in its own storage and answering `{ "allowed": boolean }`.
Within that one request it reads **its own clock** (a `protected now(): number` method returning `Date.now()`, which
only a test subclass overrides), reads the counts, runs `take`, writes the new counts and sets its alarm at the
answer's `next`, with no outside call in between; the object handles one request at a time, so two requests for one
key never interleave. Its `alarm()` reads its own clock and runs `prune`: when no window is left it erases its storage
(`deleteAll()`); otherwise it writes the remaining windows and re-arms at the new `next`, so a window that began after
the alarm was set is never erased (link preview v1 sections 11 and 13). It holds no other data and never logs. A
failed or late call to it answers 503 `service_unavailable` (the request is not fetched).

**Operator note (Workers).** Keep `SUPABASE_URL` on a host whose zone is not the server Worker's own zone (a hosted
Supabase project's `*.supabase.co` host is). Putting Supabase behind a host on the Worker's own zone is unsupported
while `global_fetch_strictly_public` is on: those calls would enter through the zone's public entry point and could
be routed to a Worker on that zone. The link preview Worker has no VPC, Tunnel or private-network binding; adding one
is outside this contract.

### Node

- `start-node.ts` builds `runtime.linkPreview` with `createNodeTransport(options.linkTransport)`, `memoryLimits()`
  (its clock `Date.now`) and `denyPrefixes: settings.linkPreviewDenyPrefixes ?? []`, and `runtime.linkPreviewOrigins`
  from `settings.linkPreviewOrigins ?? []`.
- `NodeOptions` gains `linkTransport?: NodeTransportOptions`, the test seams of link preview v1 section 4 (`resolver`,
  `testAllow`, `testDial`, `ca`, `onSocket`), and `linkLimits?: LinkLimitsClient`, a test replacement for
  `memoryLimits()` (the driver's store over `memoryLimits(<fake clock>)`, which can fail or answer late). Production passes neither: only `tests/server/node-test.ts` and the
  test-only launcher below set them, and `apps/server/src/node.ts` is unchanged (it calls `startNode(settings)`
  without options).
- **Operator note.** The link preview routes make the server fetch outside web pages. The Node runner's host (the
  Docker container) therefore needs **outbound HTTP and HTTPS** (ports 80 and 443) and DNS: the transport queries the
  host's configured DNS servers through `dns.promises.Resolver` (it does not read the hosts file). Without them every
  preview answers 502 `preview_failed` and cards stay link-only; nothing else is affected. The transport refuses
  every answer that is not globally reachable and pins each connection to the checked address (link preview v1
  sections 3 and 15). **That guarantee covers the address, not the network behind it.** On a network whose egress
  does not translate addresses, no egress firewall is required for safety, though one may still be used. On a network
  whose egress **translates** addresses (NAT64 with DNS64 under a network-specific prefix, or any translation or route
  by which an address the policy allows reaches a private network), the operator **must** either list every
  translation prefix in `linkPreviewDenyPrefixes` or deny private destinations at the egress; otherwise a vetted
  address can still reach a private destination. The NAT64 well-known prefix `64:ff9b::/96` is refused without any
  setting. Behind a reverse proxy
  the public route's per-address limit sees the proxy's address, so all callers share one counter; the runner does
  not trust forwarding headers.
- Leaving `linkPreviewOrigins` out keeps the public route off. The team route needs no setting.

### Test doubles

- **Fixture pages.** A new test module, `tests/server/link-preview-fixtures.ts`, exports
  `startLinkFixtures(tls, options?: { http?: number; https?: number; hold?: string[] })` (TLS input from
  Amendment A6), which starts the local page
  servers (one `http`, one `https`, on `127.0.0.1`; port `0`, a free port, unless given) and answers
  `{ http: number; https: number; close(): Promise<void> }`. The servers serve every fixture page by the request's
  `Host` (the Node runner's pinned connections) or by the test name the workerd seam passes in its
  `x-link-fixture-host` header, record each request (name, path, `Host` header, TLS SNI, bytes sent), and the module
  exports the test resolver table, the allowlist and the `testDial` mapping that send allowlisted addresses to those
  servers. It imports nothing from `apps/server/src`. Its pages include those named in link preview v1 section 16 and
  in the browser check: `fieldnotes.test` (with its 1200 × 630 PNG), `hall.test`, `slow.test` (answers after 8 s),
  `large.test` (2 MiB, tags after 1 MiB), `hops.test` (a chain of 4 redirects), the dripping page and picture, and the
  redirect, encoding and charset cases.
- **Control paths (test only).** A fixture server answers its control paths only to a request whose `Host` is
  `127.0.0.1:<its port>` and which carries no `x-link-fixture-host` header, so no fetcher hop can reach them (a Node
  hop always sends a test name as `Host`; a workerd hop always carries the seam's header): `GET /__requests?name=<name>`
  answers the records for that name as JSON; `POST /__release` releases held requests (the launcher's hold, below).
  Every other request to a control path is 404.
- **Who starts them (one owner).** `tests/server/setup.ts`, the existing Vitest global setup that runs in Node for both
  pools and already owns the Supabase proxy and the test helper, calls `startLinkFixtures(tls)` once, adds
  `linkFixtures: { http: <port>, https: <port>, ca: <test authority PEM> }` to the `board` context it provides,
  and closes them in its teardown (Amendment A6).
  No other server-suite file starts a fixture server. The ports reach each runner as follows:
  - **Node:** `driver-node.ts` passes `LINK_FIXTURE_HTTP_PORT` and `LINK_FIXTURE_HTTPS_PORT` in the environment of the
    forked `tests/server/node-test.ts`, which builds `testDial` from them. It also passes the test authority via
    `LINK_FIXTURE_CA` (Amendment A6).
  - **workerd:** `vitest.workerd.config.ts` adds `LINK_FIXTURE_PORT: String(context.linkFixtures.http)` to
    `miniflare.bindings`, beside today's `SUPABASE_URL: context.proxyUrl`. The test worker's `fetch` seam sends each
    test-name hop to `http://127.0.0.1:<LINK_FIXTURE_PORT><path and query>` with `x-link-fixture-host: <name>` and
    `x-link-fixture-scheme: http | https`. A Worker cannot be given the test authority, so certificate checks are
    Node's only (S468).
  - Checks read a fixture server's records through `GET /__requests` from their own pool, as they reach the proxy.
- **TLS fixtures. Amendment A6 (2026-11-25).** `tests/server/link-preview-tls.ts` uses the system `openssl` to
  generate a test authority and a leaf certificate for the fixture names, each listed explicitly in the leaf's
  subject alternative names. A second authority signs a leaf for `wrongca.test` (S468's refused certificate).
  The keys are EC P-256, and all certificates are valid from one hour before generation until seven days after.
  The server harness and browser launcher each generate the fixtures in a fresh scratch folder at startup and
  remove the folder at teardown. Certificate and key files are never committed or read by `apps/server/src`.
- `tests/server/node-test.ts` passes `linkTransport`: the test resolver (`resolver`) answering test names from the
  table, including the private, mapped, NAT64, 6to4, mixed, unlisted-documentation, rebinding, one-family-failure,
  never-answering and both-failing cases of S471; `testAllow`; `testDial` to the fixture ports it was given; `ca`
  (the test authority); and `onSocket`, recording every connection. It also passes `linkLimits`, a wrapper over
  `memoryLimits(<the driver's fake clock>)` that rejects while the driver's `failLinkLimits` control is on and answers
  only after 1,500 ms while `delayLinkLimits` is on (S475).
- `tests/server/worker-test.ts` exports a test subclass of `LinkLimits` that reads the driver's controls (the
  controlled clock, `failLinkLimits`, `delayLinkLimits`) **before** calling the production `fetch` or `alarm`, and
  whose `now()` returns that clock reading, so the production `take` still runs with no outside call inside it (as the
  test `TemplateMedia` does). It builds the test runtime's `linkPreview` with `createWorkerTransport({ fetch,
  testAllow })`: a `fetch` that answers DNS-over-HTTPS queries from the same resolver table (and can answer the
  invalid DoH replies of S471) and sends test names to the fixture server as above, and the same allowlist. The
  production `worker-runtime.ts` calls `createWorkerTransport()` with no argument; `driver-workerd.ts` and
  `driver-types.ts` gain only what that needs, plus the `CF-Connecting-IP` header a request may carry.
- `vitest.workerd.config.ts`: `durableObjects` gains `LINK_LIMITS: { className: "LinkLimits", useSQLite: true }`,
  `bindings` gains `LINK_FIXTURE_PORT`, and `compatibilityFlags` becomes `["nodejs_compat",
  "global_fetch_strictly_public"]`, equal to `wrangler.json`'s list (with the same `compatibilityDate`), so every
  workerd suite, S478 included, runs under the production flags. Both vitest configs add
  `tests/server/link-preview.test.ts`. If local workerd cannot reach the loopback fixture server or the loopback
  Supabase proxy with the flag on, the implementer stops and reports it; the flag is not dropped from the test
  configuration to make checks pass.
- **Docker target.** Under `BOARD_TEST_TARGET=docker` the server is the production image, which takes no seams, so
  `tests/server/link-preview.test.ts` skips its checks there (`test.skipIf(runner === "docker")`), as the lists and
  removal suites do.
- **Baseline-safe harness.** The harness changes must load on a source that has no `apps/server/src/link-preview/`,
  no `LinkLimits` and no `Runtime.linkPreview`, so that on such a source each link preview check fails by name and
  no setup or import aborts:
  - `node-test.ts` and `worker-test.ts` reach the new runtime modules only through a dynamic `import()` whose
    specifier is held in a variable (so no transform step resolves it ahead of time), inside a `try`. When it fails,
    the harness builds no link preview seams; the routes then answer as that source does (404).
  - `worker-test.ts` reads the production `LinkLimits` from a namespace import of `worker.ts` and exports
    `LinkLimits` as its test subclass when that class exists, or as an empty placeholder class when it does not.
  - A run on such a source uses a copy of `vitest.workerd.config.ts` **without** the `LINK_LIMITS` binding (the class
    it names does not exist there) and with everything else above; `setup.ts` and the fixture module need no change
    for it.
- The storage inventory read (`rows`) is unchanged and never reports `LinkLimits`; S476 reads the rooms and template
  stores only.

### Test launcher for the browser check

`tests/browser/link-preview-stack.mjs` is a **test-only** entry point. It is never imported by `apps/server/src`,
never built by `build:server` and never deployed; `apps/server/src/node.ts` stays the production entry, unchanged.

- **One process.** A check run starts exactly one launcher. It owns the run's only fixture listener pair and its only
  preview server; the team app and the single-user build both use it. No second launcher and no other fixture
  server runs during the browser check.
- **Start**: `BOARD_SETTINGS=<settings file> node tests/browser/link-preview-stack.mjs`. It reads and checks the
  settings exactly as `node.ts` does (`checkSettings`), starts `startLinkFixtures(tls, { http: 8797, https: 8798, hold:
  ["fieldnotes.test/sprint"] })`, the **fixed loopback ports, `http` on `127.0.0.1:8797` and `https` on
  `127.0.0.1:8798`**, then calls `startNode(settings, { linkTransport })` with the seams below and nothing else: the
  real Supabase connection from the settings, the real clock and `memoryLimits()`. It prints one line,
  `Link preview test server listening on port <port>`, and closes on SIGTERM or SIGINT (the fixture servers with it).
- **Seams**: `resolver` answering only the fixture table (`fieldnotes.test` → `192.0.2.10`, `hall.test` →
  `192.0.2.11`, `slow.test` → `192.0.2.12`, `large.test` → `192.0.2.13`, `hops.test` → `192.0.2.14`,
  `intranet.example` → `10.0.0.5`); **every other name has no answer** (`ENOTFOUND`), so the check run never resolves
  or fetches anything outside the machine; `testAllow` the five `192.0.2.x` addresses; `testDial` sending them to
  port 8797 (`http:`) or 8798 (`https:`); `ca` the test authority of the TLS fixtures. The fixture pages answer with
  their designed delays (the slow page after 8 s).
- **Settings**: the check run passes a copy of its own isolated local team stack's settings file, unchanged except
  that `linkPreviewOrigins` lists the single-user app's origin. It starts the launcher **in place of** that stack's
  production server process, with the same port and `dataDir`, so the team web build's `BOARD_SERVER_URL` is
  unchanged and the team app reaches its team route there. The single-user build's `BOARD_LINK_PREVIEW_URL` is that
  same server's origin, `http://127.0.0.1:<the team stack's server port>`, and it reaches the public route there.
- **The release protocol** (so loading states can be captured):
  1. A `GET` of path `/sprint` on `fieldnotes.test` (either scheme, from any client) is **held**: the fixture server
     records it and sends nothing. Every other path and name, `fieldnotes.test`'s picture included, answers at once.
  2. `POST http://127.0.0.1:8797/__release` (a control path: no body, `Host` `127.0.0.1:8797`) releases every
     `/sprint` request held at that moment; each then answers its page normally. It answers
     `200 {"released": <count>}`. A `/sprint` request that arrives after a release is held until the next release.
  3. A held request whose connection closes is dropped. The preview server abandons the page phase at 5,000 ms, so
     the check tool takes its loading captures and then releases **within 4,000 ms of the paste** to get a ready
     card; leaving it unreleased past 5,000 ms gives the link-only card instead.
- The fixture servers and the test authority are what a browser needs to open a fixture page itself (a browser's own
  `GET /sprint` is held as above); how the browser check maps the names and trusts the authority is the brief's.

### Proof

The server checks of link preview v1 (section 16) run on both runners; the brief maps them. The parts that are the
runners' own:

| Check | Node | Cloudflare Workers (workerd) |
| --- | --- | --- |
| S468, S472, S473 | Through the pinned transport to the local page servers; `onSocket`, `Host` and SNI recorded | Through the DoH check and `fetch` with `redirect: "manual"` to the local page servers |
| S469 | No request reaches a page server (their request logs are empty) | The same |
| S471 | The resolver seam is asked for each family once per hop; each connection goes only to the vetted address (`onSocket`); a refused answer opens no socket; the fence, one-family and both-failing cases; the pinning case | Both DoH queries run before each hop; a refused answer means no `fetch` to the page name; each invalid DoH reply → 502 |
| S474 | `linkPreviewOrigins` from the settings; absent and `[]` both 404 | `LINK_PREVIEW_ORIGINS` from the environment; absent and empty both 404 |
| S475 | `memoryLimits(<the driver's fake clock>)`, the limiter's own clock; the loopback key in a fresh day window per check; `failLinkLimits` → 503; `delayLinkLimits` → 503 within 1,500 ms; the rollover case with `prune` | The test `LinkLimits` subclass, whose `now()` reads the driver's controlled clock (no time travels in the request); fresh `CF-Connecting-IP` keys and the /64 grouping; `failLinkLimits` → 503; `delayLinkLimits` → 503 within 1,500 ms; the rollover case with the object's alarm run by the driver |
| S476 | No new room or template file under the data folder; the server process's captured stdout and stderr hold no URL, host, title or page text | No new room or template store; the test worker's captured `console` calls hold none either |
| S478 (compatibility check: it proves the runtime, not new code, and passes on a source without link previews too) | `node:http` `request`, called by the check itself without the transport, returns a 302 and its `Location` unfollowed | The global `fetch`, called by the check itself under the production compatibility date and flags and with no replacement, returns a 302 with a readable `Location` and makes no request to the target |

The server-only run checks, on each runner and on the exact candidate, what the cloud checks cannot reach: the address
policy against a local resolver that answers private, mapped, NAT64 and rebinding addresses; slow, dripping and huge
pages, redirect chains and the 12,000 ms ceiling in real time; the limits over a real minute.
