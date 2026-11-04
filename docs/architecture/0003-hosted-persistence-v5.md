# 0003 — Hosted persistence contract

CONTRACT VERSION: 0003 hosted persistence v5 (2026-11-04)

Status: Draft for 0006-W1 v1. When accepted it replaces
[hosted persistence v4](0003-hosted-persistence-v4.md) for later work. Every table, rule and limit
of v4 (and through it v3) still applies, word for word, except where this version changes it. It
adds two things: **a room may start from a given document** instead of an empty one, for a board
created from a document ([API v5](0003-api-v5.md), "Creating a board from a document"), and **a
room may be discarded** when that creation is undone. The storage layout, storage version 3, its
migration, snapshots, the backup envelope and restores do not change. The same rules hold on
Cloudflare and on the Node server.

## How a room is created

v3 and v4 create a room the first time a request loads its board (API v4, "Boards", says "a join
ticket, a join or an export"; in the code at this version it is a join ticket, an export, a rename
or an operator backup). A join never creates one: on a room that is not created it answers 401
`ticket_invalid` before anything else, and an access delivery leaves a room that is not created as
it is (v3). The room holds an empty version 10 document whose `boardId` is the board's ID and whose
`title` is the board's title from its row. That path is unchanged. This version adds one caller of
the same step: the creation route, for a board created from a document, asks the room to start from
that document.

Both are **one creation step** with one difference, the document it stores. In one storage
transaction, the room:

1. writes `meta`: `storage_version` 3, `board_id`, `last_edit_at` (the board's creation time from
   its row), `revision` 0, `watermark` (the access log's latest change, read as v3 says),
   `restore_generation` 0 and `restore_pending` 0;
2. writes a snapshot at revision 0 of the document (v3, "Snapshots": its canonical JSON and its
   Yjs state, each in chunks of at most 1 MiB);
3. writes one `identifiers` row for each object in the document's `objects`: its `object_id`, its
   `generation` and `first_revision` 0. An empty document writes none.

If any part fails, the transaction leaves the storage as it was: the room is not created. The
room then loads the board from that snapshot exactly as any later open does. Nothing marks a room
as started from a document: no seed, flag or copy of the request is kept, and every later open,
backup, restore and edit treats it as an ordinary room at revision 0.

Because the imported objects' IDs are in `identifiers` from revision 0, document v11's rule that
an ID is never used for a new object again holds for them too: an edit that adds an object with
an imported ID, after that object was deleted, is refused `identifier_reused`
([sync v4](0003-sync-v4.md), "Editing", which sync v6 keeps).

The room copies the board's name and edited time to its row after it loads (v3, "Names and edited
times in lists"), as after any first open; the name is the stored document's title, which equals
the row's.

## A room started from a document

The creation route sends the document as stored (API v5, "What is stored": the board's own
`boardId` and the request's title). The room
handles it in the one order it already keeps for edits, opens and access changes, so nothing else
the room does runs between its check and its write:

- If the room's storage is **already created** (`meta.storage_version` is set), the room refuses
  with 409 `room_exists` and changes nothing. This happens only if the board was opened (for
  example from the workspace's list) between its row being written and its document arriving;
  that open (a join ticket, for example) created the room empty.
- Otherwise it runs the creation step above with the given document and answers once the
  transaction is committed.

The room does not validate the document again: the route has (API v5, checks 6 to 8).

## Discarding a room

Only the creation route discards a room, and only to undo a creation from a document (API v5,
"When step 2 fails"). Discarding removes everything the board's room has stored:

- **Node server:** the room finishes the message it is handling (its order of messages), closes
  each open connection with 4403 (sync contract, "Close codes": no one has access to a board that
  no longer exists), stops its timers, closes its database, removes it from the server's open
  rooms, and deletes the board's SQLite file with its `-wal` and `-shm` files.
- **Cloudflare:** the board's Durable Object closes each open connection with 4403, drops its
  in-memory room and deletes all of its storage with `deleteAll()`, which, at the Worker's
  compatibility date (2026-10-30, later than 2026-02-24), also deletes its alarm
  ([Durable Object Storage API](https://developers.cloudflare.com/durable-objects/api/storage-api/),
  retrieved 2026-11-04).

A discard of a board that has no room, or whose files are already gone, succeeds and does
nothing. Once both the row's delete and the discard have succeeded, the board has no row and no
room, and each route answers as it does today for a board that does not exist: board details, a
join ticket, an export and a rename answer 404 `not_found`, and a join (with any ticket, one issued
before the discard included) answers 401 `ticket_invalid`. When either
fails (API v5, 503 `creation_cleanup_failed`), what stays is as API v5 says.

## Backup envelope and restores

v4's sections apply unchanged. A room started from a document is an ordinary room: its backup
holds its `meta`, its snapshot, its `identifiers` rows (first revision 0) and empty comment
tables, and a restore of it brings it back to revision 0 with those identifiers, as for any room.

## Not in this version

v4's list, and: a board row that stays hidden until its room is filled (which would close the two
gaps API v5 lists under "What 'all or nothing' covers"); starting a room from a document of an
older version; keeping a record of where a board's document came from.
