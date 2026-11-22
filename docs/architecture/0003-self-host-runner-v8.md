# 0003 — Self-host runner contract

CONTRACT VERSION: 0003 self-host runner v8 (2026-11-22)

Status: Draft for 0012-W3 v1. Replaces [runner v7](0003-self-host-runner-v7.md), whose process, key, volume,
fence, deadline, denial, disposal, spotlight and close rules remain word for word except as below.
[API v13](0003-api-v13.md) adds two routes that carry raw picture bytes, and
[hosted storage v13](0003-hosted-storage-v13.md) stores them in the board's room (layout 9).

## Reaching the room's pictures

The server's `RoomClient` (`apps/server/src/runtime.ts`) gains two methods, used only by
`apps/server/src/routes/pictures.ts`:

| Method | Answer |
| --- | --- |
| `storePicture(person, hash, bytes: Uint8Array, type, width, height)` | `"created"`, `"exists"` or `"full"` |
| `readPicture(person, hash)` | `{ type, bytes: Uint8Array }` or `null` |

`person` is the authenticated caller exactly as the existing `export(person)` call receives it. Inside the room's
queue each method first does what `Room.export` does (`refresh()`, then `access.lookup(person.id, boardId)`, whose
refusals are the existing room errors); `storePicture` then requires the looked-up role to be owner or editor (a
guest with an editor grant counts), else the existing `role_too_low` error with `needed: "editor"`. So a role
change while the body was being read is seen.

- **Node** (`start-node.ts`): `runtime.room(board)` is the `Room` itself, so both call the room methods
  directly.
- **Cloudflare Workers** (`worker-runtime.ts`, `worker-room.ts`): today every room call is a JSON `POST` that
  `WorkerRoom.fetch` reads with `request.json()`. The two picture calls instead use their own paths, handled in
  `WorkerRoom.fetch` **before** `request.json()` (as `/join` is):
  - `POST http://room/picture-store` with the raw bytes as the body and the board, caller, hash, type, width and
    height in the headers `x-board`, `x-person` (the caller value the existing JSON actions put in their body, as
    base64url-encoded JSON), `x-picture-hash`, `x-picture-type`, `x-picture-width` and `x-picture-height`; answers
    JSON `{ result }`;
  - `POST http://room/picture-read` with `x-board`, `x-person` and `x-picture-hash`; answers 200 with the raw bytes
    and `Content-Type` the stored type, or **204 with an empty body** when not held.

  A room refusal (an access, lifecycle or recovery error, `role_too_low`) crosses as a JSON error body with its
  status, the same way the existing JSON actions' errors do, so it is never mistaken for "not held". No other room
  call changes.

The `Runtime` also exposes `backupLimit` ([hosted persistence v11](0003-hosted-persistence-v11.md)), a number
property read at each restore request: on Node it starts as `startNode`'s `backupLimit` option, default
**100,663,296** (replacing today's default, `BACKUP_LIMIT`), the same value given to every room's environment; on Workers it is
16,777,216, as the Durable Object's room environment keeps. The Node test runner's `backupLimit` control sets it
along with the rooms' (`tests/server/node-test.ts`), and a check that raises it sets it back afterwards. On workerd the
test control changes only the rooms' backup limit (backup-side fault injection, as today); the restore route stays at
16,777,216.

## Body limits

Neither runner sets a request size limit of its own today: every body is bounded by `routes/common.ts`. The
picture route's raw reader stops at 20,971,520 bytes; the operator restore route stops at the runtime's
`backupLimit`. A Cloudflare zone on the Free or Pro plan accepts request bodies up to 100 MB, above both
Workers limits. The Node WebSocket `maxPayload` is unchanged.

## Storage version

The Workers recovery check in `worker.ts` accepts stored versions 7, 8 and 9. The Node runner has no separate
version check. Both runners keep one storage per board, so a picture's rows live and die with the board's
storage (lifecycle v6): the Node volume backup includes them, and erasing the board removes them.

## Proof

On both runners: a 20,971,520-byte picture stores in 20 parts and reads back byte for byte; a repeated upload
of the same hash stores nothing new; the board total refuses one more picture at 52,428,800 bytes; an edit
adding an image whose picture is not held is refused `asset_missing`; erasing the board leaves no picture row.
On Node: a backup of a board at its picture limit (with a small document and few versions) stays within
100,663,296 bytes and restores. On Workers: a backup whose pictures alone would pass 16,777,216 bytes as base64 is
refused with 413 `backup_too_large` before its picture parts are read ([hosted persistence v11](0003-hosted-persistence-v11.md)).
The Node test runner's `RoomClient` wrapper (`tests/server/node-test.ts`) forwards the two picture methods.
