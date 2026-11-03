# 0003 — Hosted persistence contract

CONTRACT VERSION: 0003 hosted persistence v4 (2026-11-03)

Status: Draft for 0005-W1 v1. When accepted it replaces
[hosted persistence v3](0003-hosted-persistence-v3.md) for later work. Every table, rule and limit
of v3 still applies, word for word, except where this version changes it. It stores **comments**
in each board's own database beside the board: four new tables, a `kind` on receipts, a comment
sequence in `meta`, storage version 3 with its migration, and comments in the backup envelope
(whose format and version do not change). The same layout is used on Cloudflare and on the Node
server. What comments are is in the [comments contract](0005-comments-v1.md); their messages are
in [sync v6](0003-sync-v6.md).

## One database per board

v3's table applies, with these changes and additions:

| Table | One row per | Holds |
| --- | --- | --- |
| `meta` | setting | v3's settings, with `storage_version` 3 (see "Storage version"), and `comment_sequence` (the last saved comment action's sequence; absent means 0) |
| `receipts` | saved request | `person_id`, `request_id`, SHA-256 of what the client sent (the update for an edit; for a comment, sync v6 "Retrying a comment"), `revision` (the board revision for an edit; the comment sequence for a comment), `kind` (`edit` or `comment`) |
| `threads` | thread | `id`, `author_id` (the account ID), `person` (the person key), `label`, `anchor` (JSON text, comments contract "Anchors"), `resolved` (0 or 1), `created_at`, `updated_at`, `sequence`, `first_comment` |
| `comments` | comment | `id`, `thread_id`, `author_id`, `person`, `label`, `text`, `created_at`, `edited_at` (null until edited), `sequence`; indexed by (`thread_id`, `sequence`) |
| `comment_ids` | thread or comment ID ever used | `id`, `kind` (`thread` or `comment`), `sequence` (the action that first used it). Rows are never deleted, so an ID is never used twice (comments contract, "Threads and comments") |
| `comment_counts` | person, hour and kind of action | `person_id`, `hour` (whole hours since 1970, UTC), `kind` (`post` for `start` and `reply`, `other` for every other action), `count`. Each saved comment action deletes the rows of earlier hours (comments contract, "Limits") |

A receipt's primary key is still (`person_id`, `request_id`): a request ID is used once per person
per board, by an edit or by a comment. Comment actions write no `edits` row and never change
`revision`, `last_edit_at` or `copied`; the lists ("Names and edited times in lists") never change
because of a comment.

**Saving a comment action** writes, in one storage transaction: its receipt (`kind` `comment`),
the new `comment_sequence`, its `comment_counts` row, its `comment_ids` row where it uses a new ID,
and its `threads` and `comments` changes. **Saving an edit** (sync v4, "Editing", step 6) also
writes, in the edit's own transaction, every change the comments contract's "Detaching" makes to
`threads.anchor`.

**The connection's attachment** (v3, "One database per board") also holds the times of the
connection's last 10 saved comment actions, for the per-connection limit. Its largest serialized
form stays at most 16,384 bytes.

No row holds the whole board or every comment: a comment row holds at most 4,000 code points of
text, far below Cloudflare's 2 MB row limit.

## Storage version

v3's section is replaced. A room's storage records its layout in `meta.storage_version`.
Version 2 added `tickets.label`; **version 3** adds `threads`, `comments` and its index,
`comment_ids`, `comment_counts` and `receipts.kind`.

Whenever a room opens its storage, before it handles any request, it runs the migration in **one
storage transaction**:

1. creates each table and index above that does not exist;
2. if `tickets` has no `label` column, adds it (`label TEXT NOT NULL DEFAULT ''`) and deletes
   every ticket (v3);
3. if `receipts` has no `kind` column, adds it (`kind TEXT NOT NULL DEFAULT 'edit'`), so every
   existing receipt is an edit's;
4. sets the version to 3 if it is 1 or 2, or if it is 0 or none and `snapshot_chunks` holds a row
   (a room created before versions were recorded). A version of 0 or none with no snapshot still
   means the room has not been created, and the migration leaves it so; a room is created at
   version 3.

This covers a room last used at version 1 or 2, a restore of an older backup, storage whose tables
an earlier version created without creating the room, and a room that holds some of the new tables
but not its version. If any step fails, the transaction leaves the storage as it was and the room
does not open. Running the migration again changes nothing. A ticket issued before step 2 gets
401 `ticket_invalid`, as in v3; steps 3 and 4 change no ticket and close no connection.

v3's paragraph on attachments written by an earlier server version (close 1012) applies
unchanged.

## Snapshots

v3's section applies. Comments are not part of a snapshot: `threads` and `comments` are the only
copy, and loading a board reads them as they are. Receipts, `comment_ids`, the identifier history
and Yjs's own deletion records grow for the life of a board in this version.

## Backup envelope

v3's section applies, with these changes. The envelope's format (`nextphase-board-room-backup`)
and version (1) do not change, and every table is still included except `waiting` and `tickets`:
so `threads`, `comments`, `comment_ids` and `comment_counts` are included, and each receipt
carries its `kind`.

The restore route accepts exactly two shapes of envelope, and refuses any other with 400
`bad_request`:

- **storage version 3** (its `meta` rows hold `storage_version` 3): every table of version 3,
  each row with exactly its table's columns, `receipts.kind` included;
- **storage version 1 or 2** (its `meta` rows hold `storage_version` 1 or 2): none of `threads`,
  `comments`, `comment_ids` and `comment_counts`, and receipts without `kind`. The restored room
  then has no comments, and the migration ("Storage version") brings it to version 3.

A version-3 envelope that lacks a comment table, or an older one that has one, is never accepted.
The comments contract's limits bound what comments add to an envelope ("Limits": less than
12 MiB at both limits with ordinary labels, as the 0005-W1 brief's S133 measures) but do not
guarantee a backup: a board can still get 413 `backup_too_large`, whose rule is unchanged.

## Restores and the restore fence

v3's section applies. Every restore puts back the board **and its comments**, receipts and counts
together, from the same point: threads, replies, resolved states and anchors (detached ones
included) are as they were then. After a restore every client rejoins (4423, then a new ticket)
and gets the restored room's comments in its snapshot ([sync v6](0003-sync-v6.md)).

## Not in this version

v3's list, and: compacting comment receipts, `comment_ids` or counts; a larger or streamed backup
format; storing comments anywhere but the board's room.
