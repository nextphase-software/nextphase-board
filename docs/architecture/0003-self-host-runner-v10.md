# 0003 — Self-host runner contract

CONTRACT VERSION: 0003 self-host runner v10 (2026-11-25)

Status: Draft for 0012-W6 v1. Replaces [runner v9](0003-self-host-runner-v9.md), whose process, key, volume, fence,
deadline, denial, disposal, spotlight, close, picture, video, streaming and backup rules remain word for word except
as below. [API v15](0003-api-v15.md) adds the staged import and the template media routes;
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
