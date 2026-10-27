# 0001 — Local persistence contract

Contract version: 2 (for 0006-W2 brief v1, 2026-10-27). Status: Draft. When accepted it
replaces [storage v1](0001-storage-v1.md) for later work. Depends on
[the document contract](0001-document-v7.md) and [the board file contract](0006-board-file-v1.md).

Every rule in v1 still applies, **to each board on its own keys and lock**, except where this
version replaces or adds to it. This version keeps several boards in one browser profile. The
board saved by earlier versions (the **original board**) stays exactly where v1 put it, so an
older app still opens, edits and saves it. It replaces:
- v1's "keys head and previous": the original board keeps them; other boards have their own
  (see **Boards and keys**);
- v1's single writer lock: each board has its own (see **Locks**);
- v1's "No ... import/export is part of this contract": opening a board file creates a board
  (see **Creating a board from a file**);
- v1's "Initial load and reopening do not rewrite storage": they never rewrite a board's
  records, but may rewrite the board list (see **The board list**).

## Boards and keys

The database stays `nextphase-board` at **database version 1** with the one object store
`boards`. No version change, no new store and no index: an older app opens version 1 and would
fail on a higher one.

A **board key** names a board in this profile: `original` for the original board, or a board
ID (document v7's canonical lowercase UUID v4) for any other board.

| Board key | Head record | Previous record | Writer lock |
| --- | --- | --- | --- |
| `original` | `head` | `previous` | `nextphase-board/writer/v1` |
| `<board ID>` | `board/<board ID>/head` | `board/<board ID>/previous` | `nextphase-board/writer/v1/<board ID>` |

Each pair holds v1's envelopes under v1's rules: format, size, digest, canonical payload, the
pair rules (same board ID in both, consecutive revisions, inconsistent states), strict
durability, the acknowledgement rule, the FIFO queue, compare-before-write of that board's own
pair and conflict to read-only. For a key other than `original`, both records' payload board ID
must equal the key; a pair whose board ID differs from its key is inconsistent. The original
board's board ID is whatever its records hold.

Only a board's own saves write its pair, under v1's rules; the original board's saves stay
exactly as v1 makes them. Nothing else (creating, opening, switching or saving another board,
or keeping the board list) moves, rewrites, re-encodes or deletes any board's pair, and no code
reads, changes or deletes a key it does not recognise. Recognised keys are `head`, `previous`, the board list
key, and `board/<board ID>/head` and `board/<board ID>/previous` where the ID is a canonical
UUID v4. No board is deleted or renamed by this version.

## Locks

v1's writer rules apply per board with that board's lock name. A tab holds at most the open
board's writer lock while editing, plus a new board's lock while creating it from a file
(**Creating a board from a file** says how that lock becomes the open board's). It
releases the outgoing board's lock, after settling or aborting that board's transactions and
closing its connection, before acquiring the target's lock when it switches boards. Two tabs on
different boards are both writers; a second tab on the same board is read-only as in v1, with
Retry editing.

## The board list

One record, key `board-list/v1`, holds what the Board panel lists. Its value is the JSON string
of `{"formatVersion":1,"boards":[...]}`, serialized without indentation, entries sorted by board
key in code-unit order. Each entry has exactly these keys in this order:

| Key | Value |
| --- | --- |
| `key` | The board key |
| `boardId` | The head payload's board ID when the board is valid; otherwise the last known one, or `null` |
| `title` | The head payload's title when valid; otherwise the last known one, or `""` |
| `savedAt` | Milliseconds since the epoch (a safe non-negative integer) of the save that wrote the current head, from this app's clock; `null` when not known |
| `fromFile` | `true` from creation from a file until the board's first save after an edit; `false` when not known |
| `head` | The head envelope's `storageRevision`, a colon, and its `sha256`, when the head is a JSON object with a safe integer `storageRevision` and a string `sha256`; otherwise `null`. A fingerprint, not a copy |
| `state` | `"valid"`, `"damaged"` or `"newer"` |

The list is advisory. It never decides whether a board opens: opening reads and validates the
board's own pair as v1 says. A list that is missing, not a string, not this exact shape, or
holds a duplicate or unrecognised key is treated as empty and rebuilt.

**Written with each save.** A board's save transaction (v1's strict readwrite transaction) also
reads the list record and writes it with that board's entry replaced: the new title, `savedAt`
taken just before the transaction, `fromFile` (true for the first save of a board created from
a file, false for a save after an edit, otherwise unchanged), the new fingerprint and state
`valid`. Other entries are kept as read inside the same transaction, so two tabs saving two
boards keep each other's entries. The list never takes part in the pair comparison: a changed
list never aborts a save.

**Refreshing.** A tab refreshes the list when the Board panel opens, after this tab saves,
opens a board, creates a board from a file or switches boards, and when the window gains focus
while the Board panel is open. Never on a timer. A refresh reads, in one readonly transaction,
the list record and every recognised record. For each board key present (`original` when
`head` or `previous` exists; a board ID when either of its records exists), the pair is
validated as v1 opens it (both records, digest, payload, pair rules, key and board ID); a
refresh never trusts the list instead. A valid pair gives state `valid`, its title and board
ID, `savedAt` and `fromFile` from the old entry when the old entry's fingerprint is not `null`
and equals the stored head's, otherwise `savedAt` `null` and `fromFile` true exactly when the
key is not `original` and the head is revision 1 with no previous. A record whose envelope
  `formatVersion` is a safe integer above 1, or whose payload `schemaVersion` is a safe integer
  above 7, gives `newer`; anything else `damaged`. A `damaged` or `newer` entry keeps the old
entry's `title`, `boardId`, `savedAt` and `fromFile`, or the defaults above when there is none,
and takes the stored head's fingerprint.
Entries for keys with no records are dropped. When the result differs from the stored list,
the tab writes it in a strict readwrite transaction that first reads every recognised key and
its value, the list included, and writes only the list, and only if that complete set of keys
and values equals the refresh's read (a key added or removed since counts as a change);
otherwise it writes nothing and the next refresh tries again. A refresh never writes a board
record, and its failure never changes whether a board is editable.

An older app saving the original board does not update the list; the next refresh finds a new
fingerprint, so the original board's `savedAt` becomes `null` (shown as "Saved time
unavailable") until this app saves it again.

## Opening a board

Which board a tab opens when it loads, in this order: the page address's `board` query
parameter; this tab's remembered board (sessionStorage key `nextphase-board/open/v1`); this
browser's remembered board (localStorage, same key); `original`. A value that is not a valid
board key is skipped. A remembered or addressed board key whose head and previous are both
absent falls back to `original` with nothing written. A board whose records exist but are
damaged or unsupported opens into v1's recovery view, read-only, as the original board does
today.

Once a board is open (editable or read-only), the tab writes its key to both remembered stores
and replaces the address's `board` parameter with it, without adding a history entry. Failures
of either store are ignored. Nothing in an address or a remembered store is ever used as
anything but a board key.

Switching boards in a tab follows v1's reopen sequence for the outgoing board (cancel queued
writes, settle transactions, close, release its lock), then v1's open sequence for the target.
The tab's undo history and text session are cleared as Reopen clears them.

## Creating a board from a file

A board file accepted by the board file contract becomes a new board:
1. Its document is kept exactly (title, objects, IDs, generations, retired generations, version)
   except `boardId`, which is a new UUID v4 from `crypto.randomUUID()`, distinct from every board
   ID in the list and from the original board's.
2. The tab acquires the new board's writer lock (exclusive, `ifAvailable`); if it is not
   granted, nothing is written and the open fails.
3. In one strict readwrite transaction, the new board's head and previous keys must both be
   absent; the head is written at storage revision 1 with no previous, with its list entry
   (`fromFile` true). Any existing record at those keys aborts the transaction and writes nothing.
4. Only after that transaction's `oncomplete`, the tab closes the outgoing board as in
   switching (cancel queued writes, settle transactions, close, release its lock), then opens
   the new board with the lock it already holds: it reads and validates the new pair as v1's
   open does, without requesting the lock again, and the new board is editable.
A failure at steps 2 or 3 releases the new board's lock and leaves every existing record, the
open board and its lock unchanged. During steps 2 to 4 the tab holds at most two writer locks; a read-only tab holds only the
new board's.

The new board's head payload is the canonical document at the file's own `schemaVersion`; like
any board saved at an earlier version, it becomes version 7 at its first save after an edit.

## Required negative cases

v1's cases, run against the original board and against a board created from a file. Also: the
original pair byte-for-byte unchanged through creating, opening, switching, saving and
refreshing other boards; two tabs saving two boards keep both list entries; a missing, damaged,
stale and foreign-key list each rebuilt without writing any board record; a refresh write
skipped when a record changes between its read and its write; a damaged and a newer pair listed
with state `damaged` and `newer` and never rewritten; an unrecognised key never read or written;
a pair under `board/<ID>/` whose board ID differs from the key treated as inconsistent; a new
board's creation aborting when its keys already hold a record; an older app (built from the
version before this contract) opening, editing and saving the original board in a profile that
holds other boards and a list, leaving every other record unchanged.

## Public references

Retrieved 2026-10-27: [Web Locks](https://www.w3.org/TR/web-locks/),
[IndexedDB](https://www.w3.org/TR/IndexedDB/),
[HTML: the session and local storage areas](https://html.spec.whatwg.org/multipage/webstorage.html).
