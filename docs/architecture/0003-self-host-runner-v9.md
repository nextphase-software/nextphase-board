# 0003 — Self-host runner contract

CONTRACT VERSION: 0003 self-host runner v9 (2026-11-24)

Status: Draft for 0012-W4 v1. Replaces [runner v8](0003-self-host-runner-v8.md), whose process, key, volume,
fence, deadline, denial, disposal, spotlight, close and picture rules remain word for word except as below.
[API v14](0003-api-v14.md) streams videos through the asset routes, and [hosted storage v14](0003-hosted-storage-v14.md)
keeps them in the board's room (layout 9). Pictures keep exactly runner v8's calls. Neither runner may hold a
whole video in memory.

## Reaching the room's assets

The server's `RoomClient` (`apps/server/src/runtime.ts`), used only by `apps/server/src/routes/pictures.ts`:

| Method | Answer |
| --- | --- |
| `storePicture(person, hash, bytes: Uint8Array, type: PictureType, width, height)` | Unchanged: `"created"`, `"exists"` or `"full"` |
| `readPicture(person, hash)` | Unchanged: `{ type, bytes: Uint8Array }` or `null` (also `null` for a hash held as a video) |
| **New** `storeVideo(person, hash, type: VideoType, body: ReadableStream<Uint8Array>)` | `{ result: "created" \| "exists" \| "full"; type: AssetType; bytes: number }`, or a room refusal (413 `body_too_large`, 400 `picture_hash_mismatch`, 503, and the existing access, lifecycle and recovery errors) |
| **New** `readVideo(person, hash)` | `{ type: VideoType; bytes: number; body: ReadableStream<Uint8Array> }` or `null` |

`AssetType` is `PictureType | VideoType` (`packages/board-room/src/pictures.ts`). `person` and the admission inside
the room's queue are runner v8's; `storeVideo` requires owner or editor at admission and again at its final step.

The room environment (`RoomEnvironment`, `packages/board-room/src/interfaces.ts`) gains
`hasher(): AssetHasher`, with `type AssetHasher = { update(chunk: Uint8Array): Promise<void>; hex(): Promise<string> }`
(64 lowercase hexadecimal characters), which keeps no data, and **`timer(ms: number, callback: () => void): () => void`**,
which runs `callback` once after `ms` milliseconds unless the returned function (cancel) is called first. The
shared room modules never call `setTimeout` themselves (`tests/modules.test.mjs` forbids it); the receiver's idle
timer (`UPLOAD_IDLE`, hosted storage v14) is the only user of `timer()`. Only the video paths call either, so `hash()`
and every picture path are unchanged.
- **Cloudflare Workers** (`worker-room.ts`): a `crypto.DigestStream("SHA-256")`
  ([Web Crypto](https://developers.cloudflare.com/workers/runtime-apis/web-crypto/#constructors)); `update` writes
  the chunk to its writer, `hex` closes the writer and formats its `digest`.
- **Node** (`start-node.ts`): `createHash("sha256")` from `node:crypto`; `update` calls its `update`, `hex` its
  `digest("hex")`.
- `timer` on both runners (`worker-room.ts`, `start-node.ts`): `setTimeout(callback, ms)`, cancelled with
  `clearTimeout`; on Node the handle is `unref()`ed.

**Node.** `runtime.room(board)` is the `Room`, so every method is called directly. `@hono/node-server` 2.1.5 gives
the route the request body as a web `ReadableStream` read from the socket as it arrives, so the route passes the
replay stream from `head()` (API v14) to `storeVideo` unread, and answers a video `GET` with
`c.body(body, 200, headers)`, `Content-Length` from `bytes`.

**Cloudflare Workers** (`worker-runtime.ts`, `worker-room.ts`). `picture-store` and `picture-read` are unchanged
(a picture `GET` that finds a video answers 204, as for any hash not held as a picture). Two new paths, handled in
`WorkerRoom.fetch` **before** `request.json()` as runner v8's are:
- `POST http://room/video-store`, with the headers `x-board`, `x-person`, `x-picture-hash` and `x-picture-type`
  (the video type) and the replay stream as the `body` of the stub's `fetch`. The Worker never calls
  `arrayBuffer()` on it; workerd sends a `ReadableStream` body streamed (its `RequestInit` takes no `duplex`
  option, so none is passed). The Durable Object passes `request.body` to `room.storeVideo`, never
  `request.arrayBuffer()`, and answers JSON `{ result, type, bytes }`.
- `POST http://room/video-read`, with `x-board`, `x-person` and `x-picture-hash`: 200 with `Content-Type` the
  stored type, `x-picture-bytes` the byte count and as its body the readable side of `new FixedLengthStream(bytes)`,
  into which the room's part stream is piped without awaiting the pipe (`stream.pipeTo(fixed.writable)`, its
  rejection caught; a failed pipe aborts the fixed-length body); or 204 with an empty body when not held as a video.
  The Worker's `readVideo` pipes the reply's body the same way into its own `FixedLengthStream(bytes)`, without
  awaiting, and returns that readable side, so the outer Worker response has a known length
  ([Response: set the Content-Length header](https://developers.cloudflare.com/workers/runtime-apis/response/#set-the-content-length-header)).
  The route sends the same headers on both runners; on Workers the length is carried by the body itself, never by
  setting the header on a body of unknown length.

A room refusal crosses as a JSON error body with its status, as runner v8 says. `FixedLengthStream` is used only
in `worker-room.ts` and `worker-runtime.ts`, never in `packages/board-room`.

**Under the pinned configuration** (`apps/server/wrangler.json`, `compatibility_date` 2026-10-30): no code relies
on a request's disconnect signal. A client that goes away mid-upload surfaces in the room only as a body read that
rejects, a body that ends early (then a hash mismatch) or a body that stalls (`UPLOAD_IDLE`, 60,000 ms); each
cancels the body, deletes the staged parts and fails (hosted storage v14). A `GET` whose client goes away cancels
the outer body, which cancels the pipes and the part stream.

The `Runtime`'s `backupLimit` ([hosted persistence v12](0003-hosted-persistence-v12.md)) starts on Node as
`startNode`'s `backupLimit` option, default **234,881,024** (today 100,663,296), the same value given to every
room's environment; on Workers it stays 16,777,216. The Node test runner keeps passing 16,777,216 explicitly
(`tests/server/node-test.ts`). On workerd the test control changes only the rooms' backup limit, as today.

## Test doubles

The Node-hosted room fixtures (the `fixture` environment and the `WorkerRoom` fake in
`tests/room-pictures.test.mjs`, and any new room test) add, only for the video tests:
- `hasher: () => { const h = createHash("sha256"); return { update: async chunk => { h.update(chunk); }, hex: async () => h.digest("hex") }; }`;
- a **fake clock**: `timer: (ms, callback) => { const entry = { at: now + ms, callback }; timers.add(entry); return () => timers.delete(entry); }`,
  with a `tick(ms)` helper that advances the fixture's time and runs, in order, every entry now due, so the idle
  refusal is tested without waiting 60 seconds; a test asserts that a refused upload leaves no entry in `timers`,
  its reader cancelled and its hasher's writer aborted;
- when `globalThis.FixedLengthStream` is absent, a double installed on `globalThis`: a `TransformStream` subclass
  constructed with the expected length that passes chunks through, errors as soon as more bytes than expected
  pass, and errors at flush when fewer did.

Existing picture tests keep their fixtures and assertions unchanged, since no picture path calls any of them.

## Body limits and memory

Neither runner sets a request size limit of its own: the picture route's raw reader stops at 20,971,520 bytes, the
room stops a video at 52,428,800 bytes while it streams, and the operator restore route stops at the runtime's
`backupLimit`. A Cloudflare zone on the Free or Pro plan accepts request bodies up to 100 MB, above both Workers
limits. A Worker or Durable Object isolate has 128 MB of memory
([Workers limits](https://developers.cloudflare.com/workers/platform/limits/)): on the video path the Worker holds
only the head and the chunk in hand, the room at most one part plus the chunk in hand, and a read one part at a time. This
streaming guarantee covers the asset `PUT` and `GET` only. Backups and restores are built and parsed whole in memory
as today, bounded by `backupLimit`: at most 16,777,216 bytes on Workers, up to 234,881,024 by default on Node
([hosted persistence v12](0003-hosted-persistence-v12.md), "Memory").
The Node WebSocket `maxPayload` is unchanged.

## Storage version

Unchanged: the Workers recovery check in `worker.ts` accepts stored versions 7, 8 and 9; the Node runner has no
separate version check. An asset's rows, staged rows included, live and die with the board's storage
([lifecycle v7](0006-board-lifecycle-v7.md)).

## Proof

Each case below has a name the brief maps to its server checks; unless marked, it runs on both runners. Streamed
request bodies in the checks are paced (sent in pieces with pauses) and, on Node's `fetch`, sent with
`duplex: "half"`. `uploaded_at` is compared by reading the `pictures` row through the driver's `rows`.

| Case | Shows |
| --- | --- |
| `video-roundtrip` | A 52,428,800-byte body with an MP4 head answers 201, stores in 50 parts, and `GET` returns it byte for byte with `Content-Type: video/mp4` and `Content-Length: 52428800` |
| `video-oversized` | 52,428,801 bytes answers 413 and leaves no part row once the request has settled |
| `video-hash-mismatch` | A wrong hash answers 400 and leaves no part row |
| `video-duplicate-renews` | A correct upload of a held hash answers 200 after its whole body and renews `uploaded_at` |
| `video-duplicate-bad-body` | A held hash with a wrong body answers 400; `uploaded_at` unchanged |
| `video-duplicate-oversized` | A held hash with 52,428,801 bytes answers 413; `uploaded_at` unchanged |
| `video-duplicate-demoted` | A held hash whose caller is made a viewer while the paced body arrives answers 403 `role_too_low`; `uploaded_at` unchanged |
| `video-budgets-apart` | A board holding 104,857,600 bytes of videos refuses one more with 409 `board_videos_full` and stores a picture; a board holding 52,428,800 bytes of pictures refuses one more picture with 409 `board_pictures_full` and stores a video |
| `video-concurrent-staging` | Two paced uploads of different videos cannot together stage past 104,857,600 (one answers 409); two of the same hash: the second answers 200 after the first's 201, or 503 when the first is refused |
| `video-slow-upload-edit` | While a paced upload is still arriving, an edit sent on the board's socket is saved; the upload then answers 201 |
| `video-abort-cleanup` | A paced upload: poll `rows` until the first `upload:` part row exists, abort the request, then wait for the server to settle by polling `rows` every 100 ms until no `upload:` key remains, for at most 70,000 ms (the idle bound plus 10 s); trigger a clean-up (an automatic capture) and assert no `upload:` row is left |
| `video-trash-during-upload` | Trash while a paced upload is arriving answers it 404 `not_found` and leaves no `upload:` row |
| `video-asset-missing` | An edit adding a video whose video, or whose first frame, is not held, or whose poster is held as a PNG, is refused `asset_missing` |
| `video-erase` | Purging the board removes every row; the storage inventory is read only after the purge, so reading it cannot reopen the room |
| `video-backup-node` (Node) | With the `backupLimit` control set to 234,881,024, a backup of a board at both limits (a small document and few versions) stays within it and restores; the check sets the control back to 16,777,216 in a `finally` |
| `video-backup-workers-early` (Workers) | Such a backup is refused with 413 `backup_too_large` before its parts are read |

Room unit tests with the fake clock prove the idle refusal (503, no rows, no timer left) and that restore refuses a
row whose type is not the type its bytes give. The code shows that no asset-route path joins a video's parts or
calls `arrayBuffer()` on a video body. The Node test runner's `RoomClient` wrapper (`tests/server/node-test.ts`)
forwards `storeVideo` and `readVideo`.
