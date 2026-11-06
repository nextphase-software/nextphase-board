# 0003 — Hosted persistence contract

CONTRACT VERSION: 0003 hosted persistence v6 (2026-11-05)

Status: Draft for 0005-W2 v1. Replaces [hosted persistence v5](0003-hosted-persistence-v5.md).
V5's one room per board, ordered transactions, snapshots, edit receipts, imported-document
creation at revision 0 and discard rules apply. Replace the storage/backup rules below.
The current layout is **4**; the board document stays saved version **10** (document contract v11).
No older layout, client, saved-board or board-file migration is required for this milestone.
Preview data may be reset. Current-format restart and restore remain required on both runners.

## Current room layout

| Store | Fields / retention |
| --- | --- |
| `comments` | Existing columns plus `mentions TEXT NOT NULL DEFAULT '[]'`, holding validated JSON ranges; at most 2,000 current rows and 4,194,304 plain-text bytes |
| `mention_targets` | Primary key `(comment_id,recipient)`; `person`, `lease`, `occurrence UNIQUE`, `source_order`, `thread_id`, `created_at`; current distinct non-author pairs only, at most 40,000/board |
| `mention_pending` | Primary key `(comment_id,recipient)`; `source_order`; at most 1,000 current creation pairs |
| `meta.mention_order` | One monotonic integer per board, advanced on source projection/cleanup change |
| `meta.mention_cleanup` | One 0/1 marker per board, independent of pending capacity |

`recipient` is the server-side account UUID; `person` is its board key; `lease` and `occurrence`
are UUIDs. Current targets reference the live comment/thread and record original creation time.
Removed/deleted/revoked occurrences are deleted without tombstones. Historical ranges can remain
without targets. Tickets retain their existing 30-second lifecycle; no mention capability column
is necessary. An uncreated room stays uncreated until its normal creation. Creation initializes
layout 4 and the two fixed meta keys transactionally; repeat initialization is idempotent and
failed initialization leaves no partially created room. Refuse a future/unsupported layout.
The room never writes comments or inbox data into the board's Yjs maps or snapshots.

## Atomic source save

Store comment, receipt, comment sequence, counts, targets and pending pairs in **one SQLite
transaction**. Check the 1,000-pair cap before writing. Repeated recipients occupy one pair.
A retained recipient preserves its occurrence; newly added recipients get a fresh UUID/order.
An action adding no pairs can succeed at cap. Delete/withdraw removes its pending pairs and
leaves one cleanup marker, so cleanup can never be blocked by a full creation queue.
Access replay validates target leases and prunes targets/pending pairs even if the recipient
never joined this room; it sets the same marker. A refused comment saves no receipt or sequence.
Projection failure never rolls back a confirmed source save.

## Projection, fences and retry

[Access v6](0003-access-v6.md) specifies the three Supabase tables and exact service functions.
`Mentions` sends a full set of current active occurrences plus pending creations with the room's
external restore generation and source order. Board row locks serialize projection/lease changes;
account (`people`) row locks serialize inbox cap changes and account actions.
`project_mentions` reconciles references, inserts still-current creations, evicts beyond 50/account
and advances the one board checkpoint atomically. Ignore a batch no newer than the checkpoint.
A newer batch must also skip **each creation whose own source order is already covered**;
otherwise a lost acknowledgement followed by an edit can resurrect a dismissed/evicted notice.
Acknowledge the whole batch before deleting pending rows/cleanup marker. Lost answers and
reordered held work must not duplicate or revive a removed occurrence. No per-action notification
tombstone, dismissed history or delivery receipt table is added. Standard comment receipts remain.

Try delivery after saved actions and ordinary room load. The shared server scheduler additionally
gets **all live boards** via JSON RPC `mention_boards()` and attempts their pending notice delivery
before the access-delivery pass, once per minute, with at most **10** concurrent boards.
Node uses 60,000 ms; Workers uses `* * * * *`. Pending work survives restart. Home resolves only
its retained references; the retry scheduler scans boards and fully reconciles current targets.
No latency or load guarantee follows from these intervals.

Durable notification bounds are 40,000 current source pairs/board, 1,000 pending pairs plus one
cleanup marker/board, 50 inbox references/account, one checkpoint/live board and one lease/current
permitted board-person pair. Lease counts scale with current access. Existing lifetime edit/comment
receipts, comment/object identifier history, access history and Yjs history are not globally bounded
by these limits. Inventory evidence must count every existing room table and the new SQL tables,
not call the whole system bounded because the inbox is bounded.

## Backup envelope and restores

The format remains `nextphase-board-room-backup`, envelope version **1**. The current shape has
`meta.storage_version` **4**, the existing backed-up tables, `comments.mentions` as validated JSON
text and both mention source tables. `waiting` and `tickets` are excluded. Only the current shape
is required. Missing/mixed tables or malformed mention metadata (including JSON `null`) are
400 `bad_request`, validated **before** advancing any restore fence or changing any room row.

The total UTF-8 JSON envelope, including every serialized metadata field and existing history,
has a budget of **16,777,216 bytes**. A larger backup returns 413 `backup_too_large`; a larger
restore request returns 413 `body_too_large`. There is no separate metadata save-admission cap
and no promise that a legal comment board can be backed up. Do not silently raise the envelope.
A legal capacity fixture is 2,000 comments with exactly 4,194,304 text bytes, 812 of them using
20 maximal 256-byte labels, the rest plain; measure actual escaping/row bytes and assert explicit
backup refusal when it exceeds 16 MiB. Twenty maximal labels in all 2,000 comments is invalid
because its text alone is 10,318,000 bytes. Also measure one legal small backup/restore and a
maximum text/range frame below 1,048,576 bytes. These are size checks, not load tests.

Logical restore validates first, raises the independent runner fence, closes sockets and replaces
room tables transactionally. Clear restored target/pending creation work and mark restore pending.
Answer locked even if Supabase is unavailable, as the existing restore route does. Before unlock,
clear the board's Supabase projection behind the **new external generation**, replay/prune access,
then remove the local restore lock. An unavailable external clear keeps it locked. Old held work
cannot pass the new projection checkpoint or access lease. Restored ranges are historical blue text;
they create no notice. Only a later explicit newly introduced recipient makes new work.
The account inbox is not a room-backup table. Room and Supabase backups are separate stores,
not an atomic distributed snapshot.

**Generation floor after a current volume restore.** Stop Node, replace the data folder and run
`mark-restored-volume.mjs` before restart. Before clearing the projection or unlocking a marked
room, read both live Supabase checkpoints: `boards.document_generation` and that board's
`mention_delivery.generation`. Choose and durably store a new independent runner generation
strictly greater than the maximum of those two values, the restored independent fence and the
restored room's `meta.restore_generation`. Read both checkpoints before deciding the floor;
mention clearing can have advanced even when copying the document failed or was delayed.
A successfully read absent mention checkpoint contributes 0; an unreadable checkpoint is never
treated as absent or 0. A failed read, missing board row, invalid generation or failed durable
fence write keeps the room locked: do not clear with an unproven generation or unlock it.

Only after this advancement may clearing run behind the new generation, followed by access replay
and unlock. A failed clear still keeps the lock. New explicit mention additions must project under
that generation; held work from before the volume rewind cannot revive a reference. The focused
Node current-format volume-restore check is S168 in the 0005-W2 brief, including a mention
checkpoint ahead of the document copy and separate failures of each checkpoint read.
