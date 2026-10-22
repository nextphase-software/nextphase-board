# 0001 — Local persistence contract

Contract version: 1. Status: Accepted on 2026-10-22. Applies to 0001-W1 brief v2.
Depends on [the document contract](0001-document-v1.md).

## Storage and acknowledgements

Use IndexedDB database nextphase-board, database version 1, one object store
boards, with keys head and previous. No other application database or remote
storage is required. Each record is a JSON string encoding a plain envelope with
exactly these keys in the listed order:

| Field | Value |
| --- | --- |
| formatVersion | Integer 1 |
| storageRevision | Safe positive integer |
| payload | Canonical document JSON string |
| sha256 | Lowercase 64-character SHA-256 hex digest of UTF-8 payload bytes |

Serialize the envelope without indentation using JSON.stringify. Reject a stored
value whose type is not string or whose decoded/validated/re-serialized form does
not exactly equal that string; preserve the original value on rejection. The
serialized envelope is at most 4,194,304 UTF-8 bytes. Validate envelope shape,
size, digest and the complete payload before adoption. Head/previous use the same
board ID. First save has head revision 1 and no previous; subsequent records are
consecutive, with previous.storageRevision = head.storageRevision - 1. Missing
head with an existing previous, or missing previous after head revision 1, is an
inconsistent state and blocks writes.

Use a readwrite transaction with durability: strict. This requests the browser's
strongest available durability hint; it is not a disk, backup, eviction or
power-loss guarantee. A put request's success is not a save acknowledgement.
Acknowledge only after the complete transaction's oncomplete event.

Show Unsaved, Saving, Locally saved or Save failed. A receipt identifies the
captured draft revision and committed storage revision. Locally saved applies
only when the current draft matches the acknowledged capture and no invalid
editor draft or unfinished gesture exists. Editing during a save keeps the newer
draft Unsaved. Never label it saved when an older capture completes.

## Exclusive writer and ordered saves

Before enabling mutation or Save, acquire the origin-scoped Web Lock
nextphase-board/writer/v1 with mode exclusive and ifAvailable: true. Hold it for
the editing document's lifetime. If unavailable, show a read-only board and
explain that another tab is editing. A Retry editing action may reacquire it,
then reload and validate storage before enabling edits. Missing Web Locks or
storage availability fails closed to a readable, non-saving state.

No timed localStorage lease, lock stealing or automatic concurrent-writer merge.
A read-only tab cannot create/edit/move/save. Selection, reading and viewport
navigation remain available. Closing/reloading the owner releases its lock.
On pagehide or database versionchange, disable mutations, invalidate the writer's
session token and cancel every queued/preparing write that has not started its
transaction. Before opening each write transaction, recheck that token and lock
ownership. Settle or abort any active transaction, then close the database and
release the Web Lock; never start another transaction after releasing it.
A restored/frozen page must reacquire and revalidate before editing. Retained
unsaved drafts are never silently replaced. If stored bytes changed while such a
draft was retained, keep it read-only with a conflict explanation; explicit reload
must warn that unsaved changes will be discarded. No automatic merge is provided.

At Save invocation, synchronously capture an immutable validated document and its
draft revision. Queue the entire hash preparation and persistence operation FIFO.
Only one operation runs at a time. Each successful operation updates the queue's
expected stored pair; failure never advances its receipt or expected pair.

Immediately before each mutation, within the same readwrite transaction, read
head and previous and compare both complete serialized envelopes with the last
validated/acknowledged pair (including absence). On any difference abort with a
conflict, retain the draft and switch to read-only until explicit reload/retry.
Comparing the revision counter alone is insufficient.

Atomically copy the validated old head to previous and write the new head with
storageRevision + 1. For the first save, previous remains absent. Never overwrite
an unknown/corrupt record or wrap an exhausted safe-integer revision. Do not await
hashing/network work inside the IndexedDB transaction; prepare the envelope first.
On abort/error, both prior records remain byte-for-byte recoverable. Reject that
request, keep edits in memory, explain the failure and permit an explicit retry.
Conflict cancels further queued writes; an ordinary failed request must not poison
the queue forever. No background retry or autosave is introduced.

## Open and recovery

Acquire a writer before creating a new editable draft. If both records are absent,
explain that nothing is saved in this browser profile and start an Unsaved draft.
Browser data cleared/evicted is indistinguishable from a new profile; do not claim
to diagnose or recover that event.

Read head/previous together; validate both before enabling editing. If any record
is unsupported, corrupt or inconsistent, preserve both and block all writes.
Offer View valid snapshot (read-only) only for a fully validated head or previous,
with its revision and the recovery choice disclosed. This increment does not
promote, delete or overwrite damaged/unknown records. No automatic migration,
repair, cloud recovery or import/export is part of this contract.

Normal reopen restores the latest complete valid transaction, including one that
finished before its UI receipt was displayed. Initial load and reopening do not
rewrite storage. Selection, viewport, focus, leases and session history are not
document content. Clearing browser data can remove every local record.

## Required negative cases

Before accepting the implementation, verify FIFO saves with reversed preparation
delays; newer draft after older acknowledgement; two competing contexts; stale
expected pairs including same-counter payload changes; real transaction abort;
quota/unavailable failures; unknown format/schema; digest corruption; inconsistent
pairs; valid read-only recovery; fresh-session and interrupted-renderer reopen.
Fault-injected quota errors and deletion of disposable test data must be identified
as simulations, without claiming native quota pressure or power-loss evidence.

## Public references

Retrieved 2026-10-22: [Web Locks](https://www.w3.org/TR/web-locks/),
[IndexedDB transactions and durability](https://www.w3.org/TR/IndexedDB/).
The lock/CAS/queue policy and recovery restrictions are project requirements.
