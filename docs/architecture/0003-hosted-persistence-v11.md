# 0003 — Hosted persistence contract

CONTRACT VERSION: 0003 hosted persistence v11 (2026-11-22)

Status: Draft for 0012-W3 v1. Replaces [persistence v10](0003-hosted-persistence-v10.md), whose service
tables, fences, journals, chunking, fingerprints, limits, recovery reservation and workshop rules remain word for
word except as below. Current room layout is **9** ([hosted storage v13](0003-hosted-storage-v13.md)): the
`pictures` and `picture_parts` tables. Document schema stays 14.

## How long a picture is kept

A held picture is **kept** while at least one of these is true; otherwise it is **unused**:

1. **Live:** the room's current board (all its pages) has an image object whose `asset` is its hash.
2. **Recent upload:** its `uploaded_at` is at most **86,400,000 ms** (24 hours) before now (the room's `now()`).
3. **In a version:** its `captured_ordinal` is not null and is at least the smallest `ordinal` of the
   history versions the room holds (`SELECT MIN(ordinal) FROM versions`). With no version held, this rule keeps
   nothing. (`captured_ordinal` is the ordinal of the latest capture that included the picture, and ordinals only
   grow, so a picture included in any held version is kept even when `prune()` keeps versions that are not
   consecutive.)

**Marking.** Every history capture (`capture()` in `packages/board-room/src/history.ts`: initial, checkpoint, last
close, manual, before restore and restored) sets `captured_ordinal` to the new version's ordinal on every held
picture that **the captured board** refers to, in the capture's own transaction. The caller passes that board to
the marking step explicitly (at creation it is the board being created, which `Room.board` does not hold yet;
during a restore, each capture's own board). A capture that `automatic()` skips because nothing changed marks
nothing (the latest version already holds those pictures).

**Clean-up** deletes, in the transaction named below, every unused picture's `pictures` row and part rows, and
any part rows whose hash has no `pictures` row. Its live board (rule 1) is passed explicitly: the board that is
current when that transaction commits. It runs:
- in `capture()`, after its `prune()`, with the room's current board as live (at creation, the created board);
  **except** for the `before_restore` capture: during a history restore, clean-up runs once, after the restored
  head is installed and the `restored` capture is written, with the restored head as live;
- in `automatic()` after its `prune()`, also when the capture itself is skipped, with the room's current board
  (the room is loaded there);
- at the start of every picture store (hosted storage v13), before the board total is checked, with the room's
  current board.

The lifecycle fence's prune (`packages/board-room/src/lifecycle.ts`) does **not** run clean-up: a fenced room may
be cold, and Trash keeps the board's pictures untouched. Clean-up is not a person's edit: no edits row, receipt,
revision, history version, comment or socket frame. A picture removed and later needed again (an old Undo step,
[sync v16](0003-sync-v16.md)) is refused with `asset_missing`, never re-created by the room. A version that refers to a
picture the room did not hold when the version was captured does not keep a later upload of that picture: the
upload starts with `captured_ordinal` null and is kept by the other rules only.

## Backups and restore

The logical backup carries both picture tables (hosted storage v13). The whole-backup limit is a runner setting,
the room environment's existing `backupLimit`:

| Runner | Whole logical backup (JSON bytes, as measured today) | Why |
| --- | --- | --- |
| Node (`apps/server/src/start-node.ts`) | **100,663,296** (96 MiB) by default; the runner's `backupLimit` option still sets another | Holds a board with 52,428,800 bytes of pictures (about 70 MiB as base64) and up to about 25 MiB of other state; a board whose versions and snapshots are larger is refused with 413 as today |
| Cloudflare Workers (`apps/server/src/worker-room.ts`) | **16,777,216** (16 MiB), unchanged | A Worker or Durable Object isolate has 128 MB of memory, which a 96 MiB backup built and parsed as one JSON value would exceed; on Workers a board is recovered with restore-to-time, which covers its pictures |

**Early refusal.** After its existing recovery checks (`restore_pending`, `explicit_recovery_pending`) and before
reading any table's rows, `backup()` reads `SELECT SUM(length(data)) FROM picture_parts`; if `4 × ceil(total ÷ 3)`
alone exceeds its limit it answers 413 `backup_too_large`, so a runner never builds a backup it must refuse for its
pictures. Otherwise it builds the backup as today and answers 413 above
its limit as today. The operator restore route's body limit (`apps/server/src/routes/operator.ts`, today the
literal 16,777,216) becomes the same runner setting, exposed on the server `Runtime` as `backupLimit`
([self-host runner v8](0003-self-host-runner-v8.md)).

**Restore checks** (in `validateHistoryBackup`, before any fence or write, answering 400 `bad_request` like the
existing checks): a version 7 or 8 backup's head must still hold no image, as today. A version 9 backup's head may
hold images, with or without their pictures (a live board can hold an image whose picture is missing after a
version restore, [sync v16](0003-sync-v16.md), and its backup restores the same way). In a version 9 backup, the
`pictures` rows' hashes are all different, every row has a hash ([API v13](0003-api-v13.md)), a picture type, `bytes` from 1 to
20,971,520, `width` and `height` from 1 with the longer at most 4,096, `parts` equal to `ceil(bytes ÷ 1,048,576)`,
an integer `uploaded_at` and a null or positive integer `captured_ordinal`; its part rows have integer indexes, exactly
0 to `parts − 1` with none repeated, each part but the last exactly 1,048,576 bytes and the last the rest; the SHA-256 of its joined
parts is its hash; no part row lacks its `pictures` row; and the rows' `bytes` add up to at most 52,428,800. Images are not checked against the pictures, in the head or in
versions (a missing one shows the web app's missing-picture box). Every check runs on the decoded backup before the
fence is raised, so a backup that fails one leaves the fence and every table untouched. Restore replaces both tables
with the backup's rows in the existing replacement transaction; a version 7 or 8 backup leaves both empty.

## Limits

| Stored value | Bound |
| --- | --- |
| `picture_parts` row | `data` at most 1,048,576 bytes, below both runners' row limits |
| `pictures` row | A few hundred bytes |
| One picture | 20,971,520 bytes (20 parts) |
| A board's held pictures | 52,428,800 bytes in all (checked at store and at restore) |

Measure on both runners that a 20,971,520-byte picture stores and reads back byte for byte and that a board
holding 52,428,800 bytes of pictures refuses one more; on Node, that a backup of such a board (with a small
document and few versions) stays under 96 MiB and restores; on Workers, that its backup is refused early with
413. No other limit changes.
