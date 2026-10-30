# 0003 — Hosted persistence contract

CONTRACT VERSION: 0003 hosted persistence v2 (2026-10-30)

Status: Draft for 0003-W3 v1. It replaces [hosted persistence v1](0003-hosted-persistence-v1.md),
adding how a room copies its board's name and last-edited time to Supabase for the board lists,
and how that copy is kept right across restores. It defines how a board's room stores its board, how it is
backed up and restored, and how a restored room is kept closed until its access is current.
The same layout is used on Cloudflare (one SQLite-backed Durable Object per board) and on the
Node server (one SQLite file per board).

## One database per board

| Table | One row per | Holds |
| --- | --- | --- |
| `meta` | setting | `revision`, `watermark` (access changes replayed), `restore_generation`, `restore_pending`, `storage_version` (1), `last_edit_at` (milliseconds since 1970 of the last saved edit, set to the board's creation time when the room is created), `copied` (see "Names and edited times in lists") |
| `edits` | saved edit | `revision`, `person_id`, `request_id`, `update` (the Yjs update) |
| `receipts` | saved request | `person_id`, `request_id`, SHA-256 of the update, `revision` |
| `waiting` | waiting edit | `connection_id`, `sequence`, `message_bytes`, `received_at`, `deadline`, `request_id`, `update` |
| `snapshot_chunks` | chunk | `snapshot_revision`, `kind` (`json` or `yjs`), `chunk_index`, `bytes` (at most 1 MiB) |
| `grants` | person | `person_id`, `role`, `epoch`, `change_number` ([access contract](0003-access-v2.md)) |
| `identifiers` | object ID ever used | `object_id`, `generation`, `first_revision` ([document v11](0001-document-v11.md)) |
| `tickets` | join ticket | SHA-256 of the ticket, `person_id`, `token_expires_at`, `expires_at` |

No row holds the whole board. Incoming messages are at most 1 MiB ([sync contract](0003-sync-v1.md))
and snapshot chunks at most 1 MiB, so no row comes near Cloudflare's 2 MB limit for a row.

## Snapshots

A snapshot stores the board twice, each split into chunks of at most 1 MiB: the canonical JSON
document, and the Yjs state (`Y.encodeStateAsUpdate`). Both are needed: the JSON is what export
and validation read, and the Yjs state keeps the identifiers that let a client catch up with
only what it is missing.

A snapshot is written after every 100 saved edits, and when the room goes idle: its last
connection closes, or 60 seconds pass without a saved edit while there are edits newer than the
last snapshot. The room keeps the newest and the previous snapshot and deletes edit rows at or
below the previous snapshot's revision. Loading a board reads the newest snapshot and applies
the edit rows after it.

Receipts, the identifier history and Yjs's own deletion records grow for the life of a board in
this version; a later version adds rules for compacting them.

## Names and edited times in lists

The board's document holds its one name ([document v11](0001-document-v11.md), `title`). The
board's row in Supabase ([access contract](0003-access-v2.md)) holds a copy of that name and of
`last_edit_at`, made by the room, so the lists can be read without opening every room. Supabase
never changes a board's name by itself.

- **When.** After every saved edit, after the room loads, after a restore's replay unlocks it,
  and when the room's alarm fires, the room compares its saved state with the last copy it made
  (`meta.copied`). A changed name is copied at once. `last_edit_at` is copied on the first copy,
  after a restore, and otherwise only when at least 60 seconds have passed since the last copy of
  it, so a busy board writes its time at most about once a minute; a copy of the name alone sends
  no time, and the row keeps its time. While a later time is waiting to be copied, the room sets
  its alarm for when it may be, so the last edit's time arrives even if no edit follows.
- **A title Postgres cannot store.** A title holding U+0000, which the document allows but a
  Postgres `text` column cannot hold, is copied with each U+0000 replaced by U+FFFD; the
  document and its export keep the title as it is. (The API refuses such a title on creation and
  renaming.)
- **Only saved states.** The room copies only what it has saved: never a received edit that is
  still waiting, never a refused one. A rename by the API is an ordinary saved edit and travels
  the same way.
- **Never in the way of a save.** The copy starts after the edit's `saved` reply and `update`
  broadcast have been sent, outside the room's order of messages and outside the edit's storage
  transaction, and nothing waits for it. A slow, failing or unreachable Supabase never delays,
  refuses or undoes an edit and never changes what any client is told. At most one copy per room
  is in flight; edits saved meanwhile are folded into the next. A failed copy is tried again at
  the room's next save or load, and by the alarm, which the room sets for 60 seconds after the
  failure. The room's alarm is the earliest of every deadline it has (expiry, waiting edits,
  the idle snapshot, a copy); while a copy is in flight no copy deadline is set, and a copy
  deadline is always in the future. The Cloudflare runner keeps the room alive for a copy
  with `waitUntil`; the Node runner waits for copies in flight before it stops.
- **What it sends.** `copy_saved_board(board, title, edited_at, generation, revision)` with the
  room's `restore_generation` and `revision`. Supabase applies it only if that pair is not older
  than the one it holds, generation first, so a copy that arrives late can never overwrite a
  newer one, including one from after a restore.
- **`meta.copied`.** After a copy succeeds, the room stores the name, the time and the
  (generation, revision) it copied, and when the time was copied. A failed copy stores nothing.

The lists can therefore be behind the document: for the time a copy takes, for up to about a
minute for the edited time of a busy board, and for as long as Supabase is unreachable.

## Backup envelope

The operator backup route ([API contract](0003-api-v2.md)) returns:

```json
{
  "format": "nextphase-board-room-backup",
  "version": 1,
  "boardId": "<uuid>",
  "createdAt": "<ISO 8601>",
  "tables": { "<table>": [ { "<column>": "<value>" } ] }
}
```

Every table above is included except `waiting` and `tickets`; binary columns are base64. An
envelope is at most 16 MiB: a board whose envelope would be larger gets 413 `backup_too_large`
and no envelope, not a partial one. Because receipts and history grow (see "Snapshots"), a
board used for very long can reach that limit in this version. The restore route accepts only
this format and version, for the same `boardId`.

## Restores and the restore fence

Restoring a board puts back older storage, including an older copy of its access. Access may
have been given or taken since, so a restored room stays **locked** until it has replayed every
access change after its watermark ([access contract](0003-access-v2.md), "Replay"). Every restore, of any kind,
closes every open connection of the room with 4423, deletes its tickets and waiting edits, and
makes the room load again from storage; after replay each person needs a new ticket, so their
role is checked afresh. A locked room serves nobody: a person in its copy gets 503
`room_locked`, anyone else 404 (API contract).

A mark inside the board's own database is not enough, because a point-in-time restore rewinds
the whole database, mark included. Each board therefore has a **restore fence** outside its
database: a generation number that only goes up.

- On Cloudflare the fence is a separate Durable Object class, `RestoreFence`, one per board
  (named by the board's ID), in the same `us` jurisdiction. It is never included in a backup
  and never restored.
- On the Node server the fences are one SQLite file, `restore-fences.sqlite`, beside the board
  files.

Each room stores the fence generation it has accepted in `meta.restore_generation`. When a room
starts, it reads its fence once. If the fence is ahead of `restore_generation`, or
`restore_pending` is set, the room is locked. Replay then fetches the access changes, and the
room commits the new grants, the new watermark and the fence generation in one transaction
before it unlocks. If the fence cannot be read, the room stays locked. The fence is advanced only by the
restore routes and the volume script; ordinary edits never change it.

| Restore | How it is done | What locks it |
| --- | --- | --- |
| Logical restore (a backup envelope, for example a copy kept in R2) | Operator restore route: raise the fence, replace every table with the envelope's | The fence is ahead of the restored `restore_generation` |
| Point in time (Cloudflare only) | Operator restore-to-time route: raise the fence, close the room's connections, call `onNextSessionRestoreBookmark`, then `abort()`; the next start loads the restored database | The fence, which the restore does not rewind |
| Copy of a Docker volume (Node only) | Stop the server, put the files back, run `node apps/server/scripts/mark-restored-volume.mjs <data folder>`, then start the server | The script sets `restore_pending` in every board file, because the fence file was put back too |

Putting back board files any other way, without the script, is not a supported restore; after
one, the lists may keep showing a newer name or time than the board holds.

An ordinary wake (eviction or restart, no restore) is not locked: it replays if Supabase answers
and otherwise opens with its copy (access contract).

**Lists after a restore.** Once a restored room has replayed and unlocked, it copies the restored
document's name and its `last_edit_at` to the board's row, even when that time is earlier than
the one the row holds: a restore is not an edit, and the lists show the restored board as it
was. Because the fence generation went up, this copy wins over any copy still in flight from
before the restore. Until the first request after the restore reaches the room, and while
Supabase is unreachable, the lists still show the board as it was before the restore.

**The Node volume copy and the board rows.** A copied Docker volume rewinds the fence file too.
When a room marked by `mark-restored-volume.mjs` starts, it reads its board's
`document_generation` from Supabase and raises its fence above both that and its stored fence
before replay, so its copies win over the rows written before the restore; if Supabase cannot
answer, the room stays locked.

## Keeping the access history

Access changes are kept at least as long as the oldest backup that can still be restored: today
30 days (point-in-time restore keeps 30 days, and logical backups are kept 30 days). Nothing is
deleted from `access_changes` in this version. If a restored room's watermark is below the
workspace's `lowest_kept` minus one (`lowest_kept > watermark + 1`), the changes it needs are
gone (`lowest_kept = watermark + 1` is still replayable): it stays locked, and its
routes answer 503 `access_log_pruned`. Supabase and the rooms are never rolled back together
unless the access history covers the older of the two.

## Not in this version

Scheduled copies to R2, deleting boards and a trash, and compacting receipts and Yjs history.

## Public references

Retrieved 2026-10-30: [Durable Objects SQLite storage API](https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/)
(the SQL API, point-in-time recovery with bookmarks over the past 30 days, which restores the
whole database on the next start and is not available in local development),
[Durable Objects data location](https://developers.cloudflare.com/durable-objects/reference/data-location/)
(the `us` jurisdiction) and [Durable Objects limits](https://developers.cloudflare.com/durable-objects/platform/limits/)
(the row size limit).
