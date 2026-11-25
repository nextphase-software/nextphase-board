# 0003 — Hosted boards in the web app

CONTRACT VERSION: 0003 hosted storage v15 (2026-11-25)

Status: Draft for 0012-W6 v1. Replaces [hosted storage v14](0003-hosted-storage-v14.md), whose rules remain word
for word except as below. This version adds two kinds of storage that hold pictures and videos before they belong to
a board or after they are copied out of one: a room's **importing state** (the staging of a board-file import inside
the future board's own room) and the **template store** (one per team template upload). Both use the `pictures` and
`picture_parts` tables and the 1,048,576-byte parts of hosted storage v13/v14 unchanged. The room's stored layout
stays **9**.

## Staging deadlines (both kinds)

A staging has a `touched` time, an upload **lease** (null, or `{ token, until }`) and, for an import, a **claim** (null,
or `{ token, until }`), all room clock milliseconds in its `meta` value. Its **deadline** is the latest of
`touched + 60,000` (`UPLOAD_IDLE` reused), the lease's `until` and the claim's `until`.
- **Amendment A1 (2026-11-25).** Claiming an import also sets `finishing` in `meta.import`. The mark survives the
  claim's expiry. Only `releaseImport(token)` clears it with the claim, and promotion removes the entire
  `meta.import` value. Once a marked claim has expired, begin, stage, claim and create refuse 410
  `upload_expired`, including during a cleanup retry.
- **Renewing:** every staging method below that answers without refusing sets `touched` to now.
- **One upload at a time (the lease):** before an upload route reads any body byte it calls `begin(…, hash)`, which
  runs the same identity and entry checks as the upload, refuses 409 `upload_in_progress` while another lease is held
  (or, for an import, while a claim is held), and otherwise sets the lease to a new random token with `until = now +
  600,000` (the client's upload timeout) and returns the token. The store call that ends the upload takes that token
  (a different or absent token is 409 `upload_in_progress`) and clears the lease whatever its outcome; when the route
  fails before reaching it (the body read rejects, the client went away) it calls `end(…, token)` in a `finally`,
  which clears the lease only if it still holds that token. Clearing sets `touched = now`. So a slow upload never
  expires mid-body, two uploads never overlap, and an upload cut off leaves the normal 60,000 ms idle time (at most
  600,000 ms if the runner itself died mid-request).
- **Alarm:** every change of `touched`, the lease or the claim re-arms the store's single alarm (`env.schedule`) to the
  deadline. In the importing state `schedule()` arms **only** the deadline: the room's history deadlines do not exist
  yet and are ignored.
- **Expiry:** an alarm at or past the deadline, in the staging state, runs the **staging discard**: it first
  invalidates every upload in the room's registry with **410 `upload_expired`** (a new row of hosted storage v14's
  invalidation table, "Staging discard"), then answers `{ discard: true }`; the runner erases the storage
  ([self-host runner v10](0003-self-host-runner-v10.md)). The same discard serves the finish's compensation and
  unknown ids: `Room.discardLifecycle` (and `TemplateStore`'s `discard`) is **exempt from the gate**, runs in the
  ordered queue, and on a staging does only this (it never refuses with the gate's 404).
  An alarm before the deadline re-arms and does nothing else. A staging method that finds its deadline passed
  refuses 410 `upload_expired` and re-arms the alarm at once.
  With the `finishing` mark, the room first calls `env.access.discardImport(id, workspace)` to tombstone the id and
  delete any board and lifecycle rows. Only a successful call permits the staging discard. If the call fails or
  the optional method is absent, the room remains importing and gated, sets the deadline to now plus 60,000 ms,
  and re-arms the alarm so the next alarm retries. Never-claimed and released stagings expire without this call.
- **Reopening:** when a runner opens a room or a template store whose `meta` holds a staging (a cold Durable Object, a
  Node runner restart reached by a request), it re-arms the alarm to the stored deadline, so a passed deadline erases
  it at once.
- **Unknown ids:** a staging method called on a **room** whose `meta` holds neither `import` nor `storage_version`, or
  on a **template store** whose `meta` has no `store` key at all, refuses 410 `upload_expired` and also answers
  `{ discard: true }`, so the runner erases whatever the call created (the tables a room or store creates on open);
  nothing remains after a probe of an unknown or expired id. A **committed** template store is never discarded this
  way: a staging method on it refuses 410 and changes nothing.

## The importing state (a room before its board exists)

A staged import ([API v15](0003-api-v15.md)) lives in `room(<upload id>)`, the room its board will have: the Durable
Object `idFromName(<upload id>)` on Cloudflare, `boards/<upload id>.sqlite` on Node. A room is **importing** when its
`meta` table holds the key `import` and no `storage_version`. Its value is a JSON object with exactly `id` (the upload
id), `workspace`, `person` (the opener's id), `assets` (the opened asset list, in order), `touched`, `lease` and
`claim`, plus `finishing` when marked ("Staging deadlines").

**The gate.** While a room is importing, every `Room` method except those named in this section, `alarm` and
`discardLifecycle` refuses
**before reading or writing storage** with exactly the answer it gives today for a board whose directory row does not
exist (`join` 401, every other method 404 `not_found`), and `load()` itself refuses 404 when `meta.import` exists, so
no path — sockets, tickets, history, versions, the asset routes on `/boards/…`, lifecycle and fences, `backup`,
`restore`, `lock`, `restoreToTime`, recovery — loads, backs up or writes `storage_version` into an importing room.

New room methods, all in `packages/board-room/src/room.ts`, none of which calls `load()`, `refresh()` or the directory:

1. **`openImport(person, workspace, assets)`** (ordered queue): refuses 409 `room_exists` when `meta` holds
   `storage_version` or `import`; otherwise creates the room's tables exactly as `load()` creates them **without**
   writing `storage_version`, a board, identifiers or history, writes `meta.import` (with `id` the room's name) and
   arms the alarm.
2. **`beginImport(person, workspace, hash)`** → lease token / **`endImport(person, workspace, token)`**: the lease of
   "Staging deadlines".
3. **`stageImportPicture(person, workspace, token, hash, bytes, type, width, height)`** and
   **`stageImportVideo(person, workspace, token, hash, type, body)`** (`token` the lease): the picture store and the streamed video store of hosted storage v14, word for
   word, except their admission and final step. Instead of the board role, lifecycle and recovery gates they require,
   in this order: the room is importing and its deadline has not passed (else 410 `upload_expired`); `workspace` is
   `meta.import.workspace` (else 410 `upload_expired`: another workspace's route never learns the id exists); `person`
   is `meta.import.person` (else 403 `role_too_low`, `needed: "editor"`); `hash` is in `meta.import.assets` with this
   type (else 400 `bad_request`) and, at the final step, this byte count (else 400 `bad_request`). The board totals
   are checked as today. The importing state never runs `cleanPictures`: every staged asset is kept until the create
   or the erase.
4. **`claimImport(person, workspace, document)`** (ordered queue): on a room holding `storage_version` (the import
   was already promoted) 409 `import_in_progress`; then the 410 / 403 checks of item 3; no lease and no claim held
   (else 409 `import_in_progress`); every media hash of the document is held with its kind (the typed held check of
   [sync v17](0003-sync-v17.md); else 400 `asset_missing`, and nothing changes but `touched`). Then it sets the claim
   to a new random token with `until = now + 600,000` and returns the token. While a claim is held the staging does not
   expire (its `until` bounds a finish whose server died).
5. **`releaseImport(token)`**: clears the claim when it holds `token` (the finish failed before the board row existed)
   and sets `touched = now`.
6. **`create(document, importer?, token?)`**: unchanged when the room has neither `storage_version` nor `import` and
   no `importer` is given. When the room is importing: `importer` must be `meta.import.person` and `token` the claim
   it holds (else 409 `import_in_progress`), the deadline must not have passed (else 410), and every media hash must
   still be held with its kind (else 400 `asset_missing`); then, in **one storage transaction**, `load(document)`'s
   writes (the gate lifted for this call only; the directory row now exists), every staged row's `uploaded_at` set to
   now, and the deletion of `meta.import`. The `pictures` and `picture_parts` rows stay. Then `schedule()` returns to
   its board rules. A loaded room answers 409 `room_exists` as today.
7. **`assetSizes(person, hashes)`**: for a **board** (not importing), admitted as `readPicture` is; answers the held
   asset entries, request order.

## The template store

One **template store** per upload id, in a new module `packages/board-room/src/template-store.ts`, exported as
`TemplateStore`, over a runner-supplied SQL storage (as the room's) and environment (clock, `schedule`):

| Runner | Where |
| --- | --- |
| Cloudflare | A new Durable Object class `TemplateMedia` (binding `TEMPLATE_MEDIA`, `idFromName(<upload id>)`), SQLite-backed |
| Node | `<dataDir>/template-media/<upload id>.sqlite` (with its `-wal` and `-shm` files) |

Tables: `meta(key PRIMARY KEY, value)` and the room's `pictures` and `picture_parts` exactly as hosted storage v13/v14
create them (videos have `width` and `height` 0; `uploaded_at` is the clock, `captured_ordinal` null, neither read).
`meta.store` is a JSON object with exactly `workspace`, `person`, `assets`, `touched`, `lease` and `state`
(`"staging"` or `"committed"`). Every method runs in the store's own ordered queue, one at a time.

| Method | Behaviour |
| --- | --- |
| `open(person, workspace, assets)` | Refuses 409 when `meta.store` exists; writes it with `state: "staging"`; arms the alarm |
| `begin(person, workspace, hash)` / `end(person, workspace, token)` | As "Staging deadlines" (the lease) |
| `stage(person, workspace, token, hash, type, bytes: Uint8Array, width, height)` | Staging and deadline not passed (else 410); same workspace (else 410); same person (else 403 `role_too_low`); `hash` in `assets` with this type and byte count (else 400 `bad_request`); stores the asset in `ceil(bytes ÷ 1,048,576)` parts and its row in one transaction; answers `"created"`, or `"exists"` when held |
| `commit(person, workspace)` | One use: the checks of `stage` (a committed store answers 410), then `state: "committed"`, the alarm cancelled, and answers the held inventory. Committed stores never expire |
| `inventory()` | The held asset entries `{hash, type, bytes}`, sorted by hash (any state; `[]` for an unknown store, which is then erased as "Unknown ids" says) |
| `read(hash)` | Committed only (else `null`): `{ type, bytes: Uint8Array }` joined from its parts, or `null` |
| `alarm()` / `discard()` | As "Staging deadlines" (a committed store's `discard()` is the removal of API v15 and erases it) |

A store holds at most 20,971,520 bytes in all (its opened list's sum, checked at Open). Its bytes are read and written
whole in memory (at most 20 MiB a request); no streaming. A store is reached only by its upload id; the template row
names it in its `store` column ([hosted persistence v13](0003-hosted-persistence-v13.md)).

## Web client transfers

`apps/web/src/team/pictures.ts` keeps `upload`, `uploadVideo`, `download` and `downloadVideo` unchanged except that
`upload(hash, bytes, signal?)`, `uploadVideo(hash, file, progress, signal?)` and `download(hash, signal?)` gain an
optional `AbortSignal` (an abort answers `refused` / `"refused"` / no picture and sends or reads nothing more;
`downloadVideo` already takes one); without it they behave exactly as today. A new team
module `apps/web/src/team/media-transfer.ts` ([web modules v49](0001-web-modules-v49.md)) holds every new request, each
a single attempt that takes an optional `AbortSignal`, and reports progress as `(loaded, total)` bytes:

| Call | Request | Answers |
| --- | --- | --- |
| `openImport(workspace, assets)` / `openTemplateUpload(workspace, assets)` | `fetch` `POST` JSON with the sign-in | `{ kind: "ok", id }`; `"network"` (`fetch` rejects); `"gone"` (403, or 404 `not_found`); `"refused"` (anything else) |
| `stageImport(workspace, id, hash, blob, progress)` / `stageTemplate(workspace, id, hash, blob, progress)` | `XMLHttpRequest` `PUT`, `Content-Type: application/octet-stream`, progress from `upload.onprogress`, timeout 600,000 ms | `"ok"` (200 or 201 whose body's `asset` is the hash and `bytes` the blob's size); `"network"` (`error`); `"expired"` (410); `"gone"` (403, or 404 `not_found`); `"refused"` (anything else, the timeout and an abort included) |
| `readTemplateAsset(workspace, template, hash, progress)` | `fetch` `GET`, read through its reader | `{ kind: "ok", blob }` (200, `Content-Length` equal to the bytes received, the blob typed with `Content-Type`); `"network"`; `"refused"` |
| `assetSizes(board, hashes)` | `fetch` `POST /boards/:board/asset-sizes` | `{ kind: "ok", assets }`; `"network"`; `"refused"` |

**Watchdog.** Every transfer of the three sequences (these calls, and the board's `download`, `downloadVideo`,
`upload` and `uploadVideo`) runs under a 60,000 ms no-progress watchdog that aborts it through its signal and is
reported as **`"stalled"`**, which takes precedence over the answer the abort produces. Progress is a progress event
or a received chunk; a call without progress events (`upload`, `download`, the opens) counts only its start, so it
stalls after 60,000 ms in all.

The finish of an import is the existing `api("/workspaces/:w/boards", "POST", …)` call with `import` added; its
`ApiError` reason `no_answer` is `"network"`. [Interaction v51](0001-interaction-v51.md) maps each answer to its text.
Nothing new is written to IndexedDB; a template video downloaded for an add is dropped when the add ends.

No service table is added: the 17 service tables remain (one column added, hosted persistence v13).
