# 0003 — Hosted boards in the web app

CONTRACT VERSION: 0003 hosted storage v13 (2026-11-22)

Status: Draft for 0012-W3 v1. Replaces [hosted storage v12](0003-hosted-storage-v12.md), whose rules remain
word for word except as below. This version stores a team board's **pictures inside the board's own room
storage** (the board's SQLite Durable Object on Cloudflare; the board's SQLite file on the Node runner) and
lifts the web app's "Images are not on hosted boards" rule of hosted storage v1.

## Room storage version 9

The room's `storage_version` meta value moves from **8 to 9**. A room accepts stored version 0 (new), 7, 8 or
9 and refuses any other value with `storage_unsupported` as today.

Two new tables, created by `initialize()` in `packages/board-room/src/storage.ts` with `CREATE TABLE IF NOT
EXISTS` like every other table, and added to its `tables` registry (so `insert()`, backups, decoding and
replacement cover them):

| Table | Columns (in this order) |
| --- | --- |
| `pictures` | `hash TEXT PRIMARY KEY` (a hash, [API v13](0003-api-v13.md)), `type TEXT NOT NULL` (the picture type), `bytes INTEGER NOT NULL` (1 to 20,971,520), `width INTEGER NOT NULL`, `height INTEGER NOT NULL` (the header size, each 1 to 4,096 on its longer side), `parts INTEGER NOT NULL` (1 to 20), `uploaded_at INTEGER NOT NULL` (the room's `now()` milliseconds), `captured_ordinal INTEGER` (nullable; the ordinal of the latest history version that included it, [hosted persistence v11](0003-hosted-persistence-v11.md)) |
| `picture_parts` | `hash TEXT NOT NULL`, `part INTEGER NOT NULL` (0 to `parts − 1`), `data BLOB NOT NULL`, `PRIMARY KEY (hash, part)` |

`picture_parts.data` is that table's one binary column (`binaryColumns`). A picture's bytes are split in order
into **parts of 1,048,576 bytes** (the last part holds the rest; `parts = ceil(bytes ÷ 1,048,576)`), the same
size as the room's existing snapshot and history chunks, so no stored value comes near either runner's row
limit. A picture is **held** when its `pictures` row exists and its part rows are exactly the indexes 0 to
`parts − 1` (every `part` an integer; with the primary key, `COUNT(*) = parts`, `MIN(part) = 0` and `MAX(part) = parts − 1`), each part but
the last 1,048,576 bytes and the lengths adding up to `bytes`. Reads, the edit check ([sync v16](0003-sync-v16.md)),
the board total and the restore checks all use this one predicate.

| Change | Rule |
| --- | --- |
| New rooms | Created at storage version 9 (`room.ts`, the creation transaction) |
| Upgrade from 7 | The existing upgrade to 8 (hosted storage v12), then the upgrade from 8 below, both whenever the room loads or finishes restoring a backup |
| Upgrade from 8 | The tables already exist (`initialize()`), empty. Set `storage_version` to 9 in one transaction. Nothing else changes: no edits row, receipt, revision, history version or comment change |
| Recovery guard | `apps/server/src/worker.ts`'s recovery check accepts stored versions **7, 8 and 9** (today 7 and 8) |
| Reading a layout 9 room | Exactly as a layout 8 room is read (the board's `pageMap` reading of sync v14 and v15, and their document upgrades); sync v15's sentences "The room's storage version stays 8" and "Images are still refused as today" are replaced by this version and [sync v16](0003-sync-v16.md) |
| Future versions | A stored or backup `storage_version` above 9 is refused as today (`storage_unsupported`; the backup's `bad_request`) |

## Storing and reading a picture

Both run inside the room through its existing ordered queue (`Room.ordered()`), which also serializes every edit,
waiting-edit retry, capture and clean-up, from two new room methods that the API's picture routes call
([self-host runner v8](0003-self-host-runner-v8.md) says how each runner reaches them). Each is admitted exactly as
the existing export call (`Room.export`, used by `GET /boards/:board/export`) is, with the caller passed in: the
same load path (`refresh()`), the caller's role looked up again with `access.lookup` inside the queue (a store
needs owner or editor, [self-host runner v8](0003-self-host-runner-v8.md)), the same lifecycle and recovery gates
checked inside the queue (so a change while the request body was being read is
seen), and the same errors with the same HTTP mapping on both runners. A room that is not loaded is loaded as
export loads it; a missing picture is then "not held", never an error.

- **Store** (`hash`, bytes, picture type, header size): in **one storage transaction**, first run the
  clean-up ([hosted persistence v11](0003-hosted-persistence-v11.md)). If the picture is held, set its
  `uploaded_at` to now and answer "exists". Otherwise, if the `bytes` of every held picture plus the new
  picture's bytes would exceed 52,428,800, answer `board_pictures_full`: the clean-up is committed and nothing of
  the new picture is written. Otherwise delete any rows for the hash that are not a held picture, insert the
  `pictures` row (`captured_ordinal` null) and every part, and answer "created". Concurrent uploads are taken one
  at a time by the queue, so the total cannot be passed.
- **Read** (`hash`): the held picture's type and its parts joined in order; or "not held".

A picture is never changed after it is stored: the same hash always means the same bytes.

## Backups

`decodeBackup` (`backups.ts`) accepts an envelope whose `storage_version` is **7, 8 or 9**:
- 7 or 8: the table set is today's, with or without `pictures` and `picture_parts` (when present, both must be
  empty arrays); the backup restores, then the room upgrades as above.
- 9: the table set is today's plus `pictures` and `picture_parts`, with exact columns; `picture_parts.data` is
  base64 as every binary column is.

Every other envelope and table check is unchanged. A new backup records 9. The backup envelope stays version
1. Size limits and the pictures' check on restore are [hosted persistence v11](0003-hosted-persistence-v11.md)'s.

No other table or column changes. The 17 service tables and their schema are unchanged: no service migration.

## Web client

The rule of hosted storage v1 that images are not on hosted boards (the Image button absent, its keys and
pasted or dropped files doing nothing) is replaced by [interaction v49](0001-interaction-v49.md): owners and
editors add pictures, everyone with a role sees them. A hosted board's pictures are never written to the
browser's IndexedDB; the tab keeps them only in its existing tab-lifetime picture map (`tabPictures`,
[storage v3](0001-storage-v3.md)). Storage v3 and local boards are unchanged.
