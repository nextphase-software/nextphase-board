# 0003 — Hosted boards in the web app

CONTRACT VERSION: 0003 hosted storage v14 (2026-11-24)

Status: Draft for 0012-W4 v1. Replaces [hosted storage v13](0003-hosted-storage-v13.md), whose rules remain
word for word except as below. This version keeps a team board's **videos** in the same room storage as its
pictures, with the same two tables, and says how a video is written and read as a stream. Storing and reading a
**picture** keep exactly today's code paths.

## Room storage version stays 9

No table, column or upgrade is added: the room's `storage_version` stays **9**, the upgrades from 7 and 8 and the
recovery guard (7, 8 and 9) are unchanged, and no stored room changes. The `pictures` and `picture_parts` tables
of hosted storage v13 now also hold videos:

| `pictures` column | Picture row | Video row |
| --- | --- | --- |
| `type` | A picture type ([API v14](0003-api-v14.md)) | A video type: `video/mp4`, `video/quicktime` or `video/webm` |
| `bytes` | 1 to 20,971,520 | 1 to 52,428,800 |
| `width`, `height` | The header size, the longer side at most 4,096 | Both **0**: the server never reads a video's frame size |
| `parts` | 1 to 20 | 1 to 50 |
| `uploaded_at`, `captured_ordinal` | As hosted storage v13 | The same |

Parts are 1,048,576 bytes as before. The **held** predicate of hosted storage v13 is unchanged except that its
byte bound is the row's own kind's (20,971,520 for a picture type, 52,428,800 for a video type). An asset is
**held as a picture** when it is held with a picture type, **held as a first frame** when it is held with the type
`image/jpeg`, and **held as a video** when it is held with a video type. Reads, the edit check
([sync v17](0003-sync-v17.md)), the board totals and the restore checks all use this one predicate.

A board has two **totals**, each over its held rows: the `bytes` of rows of picture types (first frames included)
and the `bytes` of rows of video types. Each is checked only against its own limit (52,428,800 and 104,857,600).

`packages/board-room/src/pictures.ts` gains `VIDEO_BYTES = 52_428_800`, `BOARD_VIDEO_BYTES = 104_857_600`,
`UPLOAD_IDLE = 60_000`, the types `VideoType` and `AssetType = PictureType | VideoType`, `pictureSignature(head)`,
`videoType(head)` (API v14) and the upload registry below; `PictureType` and `pictureHeader` are unchanged.

## Storing a picture

As hosted storage v13 (`storePicture`, unchanged in its path and answers), except that the board total it checks
counts only rows of picture types, and its clean-up spares the registry's staging keys (hosted persistence v12).

## The upload registry

Each room keeps one in-memory **upload registry** (`Room.uploads`), passed to every clean-up caller (the picture
store, a video store's admission and final step, `capture()` and `automatic()` in `history.ts`). Each entry holds:
the hash; its role, **owner** (the one upload that stages this hash, with a staging key `upload:` followed by
`randomId()`), **waiter** (another upload of a hash that has an owner) or **drained** (an upload of a hash held at
admission); the bytes it has staged; its **binding** (the room's upload cycle, a counter, and its recovery
generation, `Room.generation`, the fence value `refresh()` reads); and a **cancellation handle** that cancels the
entry's body reader and its idle timer and settles the entry with a given answer. A hash has at most one owner.

The room's **video total** at any moment is the held video total (the `bytes` of rows held as a video, read from
storage at that moment) plus the staged bytes of every owner in the registry.

**Invalidation.** Each of these, inside its ordered step and **before** it replaces or disposes of any storage,
increments the upload cycle and cancels every entry: owners, waiters and drained uploads alike, whether they are
waiting for their next chunk, for an owner's outcome or for their final step. Cancelling deletes the entry's staged
rows at once (except on disposal, which erases the storage anyway), removes it from the registry and settles its
answer; the first cancellation of an entry decides it:

| Event (its room method) | Answer of every upload in progress |
| --- | --- |
| Trash: the lifecycle fence to a state that is not active (`Room.fenceLifecycle`) | 404 `not_found` |
| Restore from Trash: the fence back to active (`Room.fenceLifecycle` with ready) | 503 `service_unavailable` |
| Backup restore (`Room.restore`, before `replace()`) and restore to time (`Room.lock`) | 503 `service_unavailable` |
| Disposal: purge, delete or discard (`Room.discardLifecycle`, on both runners) | 503 `service_unavailable` |

A cancelled receiver never treats the end of its cancelled reader as the end of the body: it returns the settled
answer without reaching a final step. A final step also refuses with 503 when its entry's binding differs from the
room's (an event it did not see).

## Storing a video

A new room method `storeVideo(person, hash, type, body)` takes the replay stream ([self-host runner v9](0003-self-host-runner-v9.md)).
It never holds more than one part plus the chunk in hand.

1. **Admission**, in the room's ordered queue (`Room.ordered()`), in one storage transaction after export's load
   path: the role looked up again (owner or editor), the lifecycle and recovery gates, then the clean-up (committed).
   The upload is registered with its binding: **drained** if the hash is held, **waiter** if the hash already has an
   owner, else **owner**. An owner is refused "full" at once if the video total plus 1 would exceed 104,857,600.
2. **Receiving**, outside the queue, so edits and every other request go on while the video arrives. Each chunk
   restarts the entry's idle timer (`timer()`, runner v9) and is counted and fed to the streaming hasher
   (`hasher()`, runner v9). An owner also buffers it, and writes every full 1,048,576 bytes (the remainder at the
   end) as a `picture_parts` row (staging key, index, data) in **its own storage transaction that also accounts for
   it**: inside that transaction it re-reads the held video total, adds every owner's staged bytes from the
   registry and this part, refuses "full" if that exceeds 104,857,600, and otherwise inserts the row and adds the
   part to its entry's staged bytes. Storage transactions and registry updates run synchronously, so no two writes
   can overcommit. Waiters and drained uploads write nothing. Once more than 52,428,800 bytes have arrived the body
   is cancelled and the refusal is 413 `body_too_large`. If the idle timer fires (no chunk for **60,000 ms**,
   `UPLOAD_IDLE`) or reading the body rejects, the reader is cancelled, the hasher's writer is aborted, and the
   upload fails (503). The receiver never relies on a request disconnect signal: under the pinned Workers
   compatibility date a client that goes away surfaces only as a body that rejects, ends early or stalls. At the end
   the timer is cancelled; if the digest is not the hash (a body that ended early included), the refusal is 400
   `picture_hash_mismatch`.
3. A **waiter** whose body hashed correctly then waits for its owner's outcome: if the owner stored the video (or
   found it held), the waiter goes on to its final step as a drained upload; if the owner failed or was refused, the
   waiter answers 503 `service_unavailable` and stores nothing.
4. **Final step**, in the ordered queue and in **one storage transaction**, after the admission checks again (a lost
   role is 403 `role_too_low` or 404 `not_found` exactly as for a new upload; a lifecycle or recovery refusal as its
   gate answers) and the binding check: run the clean-up. If the hash is held, delete any staged rows, set its
   `uploaded_at` to now and answer "exists" with the stored row's type and bytes. A drained upload (or waiter) whose
   hash is no longer held fails (503) and renews nothing. For an owner: if the staged rows are not exactly the
   indexes 0 to `ceil(bytes ÷ 1,048,576) − 1` with the right lengths, delete them and fail (503); if the held video
   total plus this video's bytes would exceed 104,857,600, delete them and answer "full" (the clean-up is
   committed); otherwise delete any rows for the hash that are not a held asset, move the staged rows to the hash
   (`UPDATE picture_parts SET hash = ? WHERE hash = ?`), insert the `pictures` row (`width` and `height` 0,
   `captured_ordinal` null) and answer "created".
5. **Always**, when the method ends, the idle timer is cancelled and the entry leaves the registry. On any refusal
   or failure the staged rows are deleted and nothing is renewed; if that delete fails, the next clean-up removes
   them.

Staged rows are not a held asset: they are never read, checked by an edit or backed up, and only the registry
counts them. Final steps run one at a time, so no total can be passed. Staging under its own key, rather than under
the hash, keeps a clean-up that runs during the upload from removing its parts.

## Reading an asset

- **A picture:** `readPicture(person, hash)`, unchanged in its path and answer (`{ type, bytes: Uint8Array }`,
  joined in the queue), for a hash held as a picture; for a hash held as a video it answers "not held".
- **A video:** a new `readVideo(person, hash)`, admitted in the queue as `readPicture` is, answers the held video's
  type and `bytes` and a stream, or "not held" (also for a hash held as a picture). The stream reads one part per
  pull, in order, outside the queue (`SELECT data FROM picture_parts WHERE hash = ? AND part = ?`); if a part is
  missing or of the wrong length when its turn comes (a clean-up removed the video meanwhile), the stream ends in
  error. The room never joins a video's parts.

The `GET` route asks `readPicture` first and, when it answers "not held", `readVideo`; so a picture's `GET` makes
exactly today's one room call.

## Backups

The envelope rules of hosted storage v13 are unchanged (stored versions 7, 8 and 9; envelope version 1); a
version 9 backup's `pictures` and `picture_parts` carry video rows as well. A backup takes only part rows whose
hash has a `pictures` row (`SELECT * FROM picture_parts WHERE hash IN (SELECT hash FROM pictures)`), so staged
rows are never backed up; the early refusal sums the same rows. Size limits and the restore checks are
[hosted persistence v12](0003-hosted-persistence-v12.md)'s.

**Streaming covers the asset routes only.** The guarantee that no Worker or room holds a whole video applies to
the asset `PUT` and `GET`. A backup is built, and a restore parsed, as one JSON value in memory exactly as today:
at most 16,777,216 bytes on Workers, which can therefore hold a small video whole, and up to the runner's
`backupLimit` on Node (234,881,024 by default).

No other table or column changes. The 17 service tables and their schema are unchanged: no service migration.

## Web client transfers

[Interaction v50](0001-interaction-v50.md) says who adds and plays videos, the order of the uploads, the notices
and the playback hook's retries. `apps/web/src/team/pictures.ts` gains one **single-attempt** call per direction;
neither retries. Their answer kinds are exactly **`ok`, `too_large`, `videos_full`, `refused` and `network`**:

| Call | Request | Progress | Answers |
| --- | --- | --- | --- |
| `uploadVideo(hash: string, file: Blob, progress: (loaded: number, total: number) => void): Promise<"ok" \| "too_large" \| "videos_full" \| "refused" \| "network">` | `XMLHttpRequest` `PUT` to the asset route, headers `Authorization: Bearer …` and `Content-Type: application/octet-stream`, the file as the body, timeout **600,000 ms** | From `upload.onprogress`: `loaded` the bytes sent, `total` always `file.size` | `ok`: 200 or 201 whose body's `asset` is `hash` and `bytes` is `file.size`; `too_large`: 413; `videos_full`: 409 with the reason `board_videos_full`; `network`: the request's `error` event; `refused`: anything else, the timeout included |
| `downloadVideo(hash: string, progress: (loaded: number, total: number) => void, signal?: AbortSignal): Promise<{ kind: "ok"; blob: Blob } \| { kind: "refused" \| "network" }>` | `fetch` `GET` with the sign-in and `signal` (an abort answers `refused`, reports no more progress and leaves nothing cached), the body read through its reader, timeout **600,000 ms** | None before the response headers; then `(0, total)` and one call per chunk, `total` the `Content-Length` | `ok`: 200 with a `Content-Length` (the server sends the stored row's byte count), a `Content-Type` that is a video type, and exactly that many bytes received; the `Blob`'s type is that `Content-Type` (the server row's type); `network`: `fetch` or the reader rejects; `refused`: anything else (any other status, 404 included, a missing length, a short or long body, another type, the timeout) |

The picture `upload` and `download` are unchanged. A hosted board's videos and first frames are never written to
the browser's IndexedDB. The tab keeps a downloaded video, and a video it uploaded itself, only in its
tab-lifetime video map (`tabVideos`, [storage v4](0001-storage-v4.md)), so each video is downloaded at most once per
tab. First frames load through the picture loader unchanged. Local boards follow storage v4.
