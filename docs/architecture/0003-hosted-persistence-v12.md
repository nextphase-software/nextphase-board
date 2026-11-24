# 0003 — Hosted persistence contract

CONTRACT VERSION: 0003 hosted persistence v12 (2026-11-24)

Status: Draft for 0012-W4 v1. Replaces [persistence v11](0003-hosted-persistence-v11.md), whose service
tables, fences, journals, chunking, fingerprints, limits, recovery reservation, workshop rules and picture rules
remain word for word except as below. Current room layout stays **9** ([hosted storage v14](0003-hosted-storage-v14.md)):
the `pictures` and `picture_parts` tables now also hold videos. Document schema is 15 ([sync v17](0003-sync-v17.md)).

## How long an asset is kept

Persistence v11's three rules apply to every held asset, picture or video. A board **refers** to a hash when one
of its image objects has it as `asset`, or one of its video objects has it as `asset` or `poster`. Rule 1 (live)
becomes: the room's current board (all its pages) refers to its hash. Rules 2 (recent upload, 86,400,000 ms) and 3
(in a version) are unchanged.

**Marking.** Every history capture sets `captured_ordinal` on every held asset that the captured board refers to,
as persistence v11 says, so a captured video keeps both its video and its first frame.

**Clean-up** deletes, in its transaction, every unused asset's `pictures` row and part rows, and any part rows
whose hash has no `pictures` row **except the staged rows of an upload in this room's upload registry** (hosted
storage v14, "The upload registry"). Every caller passes the room's one registry: `cleanPictures(storage, board,
now, uploads)` in `packages/board-room/src/pictures.ts`, called by the picture store, a video store's admission and
final step, and `capture()` and `automatic()` in `history.ts`. The registry lives in memory, so after a restart no
key is spared and the next clean-up removes every staged row left behind; an upload invalidated by Trash, restore
from Trash, backup restore, restore to time or disposal deletes its own staged rows, and any it could not delete
are then no longer spared. Clean-up runs where persistence v11 says, and at a video store's admission and final
step as at the start of every picture store, before the board totals are checked. Its live board is passed
explicitly as before. The lifecycle fence's prune still does not run it.

A video removed and later needed again (an old Undo step) is refused with `asset_missing`, never re-created by
the room; the same holds when only its first frame was removed.

## Backups and restore

The logical backup carries both tables with their video rows (hosted storage v14). The whole-backup limit is the
runner setting `backupLimit`:

| Runner | Whole logical backup (JSON bytes, as measured today) | Why |
| --- | --- | --- |
| Node (`apps/server/src/start-node.ts`) | **234,881,024** (224 MiB) by default; the runner's `backupLimit` option still sets another | Holds a board with 52,428,800 bytes of pictures and 104,857,600 bytes of videos (157,286,400 bytes, 209,715,200 as base64) and up to about 24 MiB of other state; a board whose versions and snapshots are larger is refused with 413 as today |
| Cloudflare Workers (`apps/server/src/worker-room.ts`) | **16,777,216** (16 MiB), unchanged | A Worker or Durable Object isolate has 128 MB of memory, which a backup built and parsed as one JSON value would exceed; on Workers a board is recovered with restore-to-time, which covers its pictures and videos |

**Memory.** Backups are outside the streaming guarantee of the asset routes (hosted storage v14): `backup()`
reads every backed-up part and builds the whole JSON value, and restore parses and decodes the whole envelope, as
today. That is bounded by the limit above: at most 16,777,216 bytes on Workers (so a small video can be held whole
there) and up to `backupLimit` on Node.

**Early refusal**, as persistence v11, over `SELECT SUM(length(data)) FROM picture_parts WHERE hash IN (SELECT hash
FROM pictures)`: if `4 × ceil(total ÷ 3)` alone exceeds the limit, `backup()` answers 413 `backup_too_large`
before reading any table's rows. The operator restore route's body limit stays the runtime's `backupLimit`.

**Restore checks** (in `validateHistoryBackup`, before any fence or write, 400 `bad_request`): a version 7 or 8
backup's head must hold no image and no video. A version 9 backup's head may hold images and videos, with or
without their assets. In a version 9 backup, the `pictures` rows' hashes are all different and every row has a
hash, an integer `uploaded_at` and a null or positive integer `captured_ordinal`, and by its type:

| Row type | `bytes` | `width`, `height` | `parts` |
| --- | --- | --- | --- |
| A picture type | 1 to 20,971,520 | From 1, the longer at most 4,096 | `ceil(bytes ÷ 1,048,576)` |
| A video type | 1 to 52,428,800 | Both 0 | `ceil(bytes ÷ 1,048,576)` |
| Anything else | Refused | | |

Each row's type must also be the type its own bytes give, checked before the row can satisfy any typed held check:
a picture row's type is the type `pictureHeader` reads from its first part (its header size is not compared with
`width` and `height` beyond the bounds above); a video row's first 64 bytes have the row's video type
(`videoType`) and no picture signature ([API v14](0003-api-v14.md)). So a row typed `image/jpeg`, the only type a
first frame may have ([sync v17](0003-sync-v17.md)), holds JPEG bytes.

Its part rows have integer indexes, exactly 0 to `parts − 1` with none repeated, each part but the last exactly
1,048,576 bytes and the last the rest; the SHA-256 of its parts is its hash (a picture's parts joined and
hashed with `hash()` as today; a video's parts fed in order to the streaming hasher, with no joined copy); no part row lacks its `pictures` row; the rows of picture types add up to at most 52,428,800
bytes and the rows of video types to at most 104,857,600. Images and videos are not checked against the stored
assets, in the head or in versions. Every check runs on the decoded backup before the fence is raised. Restore first
invalidates every upload in progress (hosted storage v14), then replaces both tables with the backup's rows in the
existing replacement transaction; a version 7 or 8 backup leaves
both empty.

## Limits

| Stored value | Bound |
| --- | --- |
| `picture_parts` row | `data` at most 1,048,576 bytes, below both runners' row limits |
| `pictures` row | A few hundred bytes |
| One picture | 20,971,520 bytes (20 parts) |
| One video | 52,428,800 bytes (50 parts) |
| A board's held pictures (picture types, first frames included) | 52,428,800 bytes in all (checked at store and at restore) |
| A board's held videos (video types) | 104,857,600 bytes in all (checked at store and at restore) |
| Staged rows of uploads in progress | At most 52,428,800 bytes for one upload; with the board's held videos, at most 104,857,600 in all; removed when the upload ends or by the next clean-up |

Measure on both runners that a 52,428,800-byte video stores and reads back byte for byte, that a board holding
104,857,600 bytes of videos refuses one more video and still takes a picture, and that a board holding 52,428,800
bytes of pictures refuses one more picture and still takes a video, that two uploads in progress together cannot stage past the video total, and that an upload cut off midway leaves only staged rows that the next clean-up removes; on Node, that a backup of a board at both limits
(with a small document and few versions) stays under 224 MiB and restores; on Workers, that its backup is refused
early with 413. No other limit changes.
