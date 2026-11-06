# 0003 — Hosted persistence contract

CONTRACT VERSION: 0003 hosted persistence v7 (2026-11-06)

Status: Draft for 0006-W3 v1. Replaces [hosted persistence v6](0003-hosted-persistence-v6.md).
Its ordered room, recovery snapshots, receipt semantics, imported creation, mention source/cap/
projection and operator restore rules continue, with current room layout **5** replacing 4.
Saved document remains **10**. The current contract set is [lifecycle v1](0006-board-lifecycle-v1.md),
[document v12](0001-document-v12.md), [access v7](0003-access-v7.md), [sync v8](0003-sync-v8.md)
and [comments v3](0005-comments-v3.md). Initialize the current layout transactionally/idempotently.

## Retained history stores

Current `waiting` rows additionally carry `restore_generation INTEGER NOT NULL`, captured when
admitted. Recheck it before queued application; restore deletes waiting rows. Waiting remains
excluded from backups. This is part of layout 5, not a document field.

Add these room tables; include all in current backups (binary chunks use existing base64 rules).
Field types INTEGER/TEXT/BLOB follow the existing shared SQLite adapters on both runners.

| Table | Columns and constraints |
| --- | --- |
| `versions` | `id TEXT PRIMARY KEY`, `ordinal INTEGER UNIQUE`, `captured_at INTEGER`, `revision INTEGER`, `generation INTEGER`, `reason TEXT`, `name TEXT`, `description TEXT`, `actor TEXT NULL`, `named_by TEXT NULL`, `source_name TEXT`; non-null except the stated actor fields |
| `version_chunks` | `(version_id TEXT,chunk_index INTEGER)` primary key, `bytes BLOB NOT NULL`; contiguous indices starting 0, at most 1,048,576 bytes each; exactly one canonical document per version |
| `history_requests` | `(person_id TEXT,request_id TEXT)` primary key, `digest TEXT`, `operation TEXT`, `result TEXT`; metadata-only JSON, at most 65,536 UTF-8 bytes, containing a durable result or the single active restore intent's phase, expected head, old/new generations and chunk references; never document bodies |
| `history_intent_chunks` | `(person_id TEXT,request_id TEXT,kind TEXT,chunk_index INTEGER)` primary key; `kind` is `selected` or `replaced`; `bytes BLOB NOT NULL`, at most 1,048,576 raw bytes per row; contiguous indices from 0 for each document, each canonical document at most 2,097,152 bytes |

`meta.history_ordinal`, `meta.history_next_at`, `meta.history_revision` record the monotonic
capture ordinal, persisted 30-minute deadline and last captured document revision. In addition,
`meta.history_capture_sha256` is a TEXT value of exactly 64 lowercase hexadecimal characters:
SHA-256 of the last successfully captured document's exact canonical UTF-8 bytes.
`meta.history_capture_bytes` is its positive canonical byte count, at most 2,097,152. Read the
hash as text, not through the numeric meta accessor; SQLite's meta value column admits this
explicit text-valued key, as it does board_id. The fingerprint is the hash plus byte count;
revision equality, retained version chunks and recovery snapshots are not substitutes.

Create both fingerprint keys atomically with the initial capture. Every successful capture,
including manual and each restore checkpoint, updates fingerprint, history_revision and
history_ordinal in the same transaction as the version/chunks. A two-entry restore leaves the
fingerprint of the newest restored entry, not Before restore. A failed capture changes none of
these values. Metadata naming, expiry/eviction, snapshot pruning and restart never clear or
recompute the fingerprint from a different head. No extra retained document copy is required.
At changed-checkpoint/last-close time, hash the latest confirmed canonical bytes and compare
both values with this durable last-capture fingerprint. Equal values suppress an automatic
copy even after edits returned to identical content at a higher revision, all version chunks
expired and recovery snapshots pruned; unequal values capture the actual head. Manual save
and restore still capture even on equality. Hash failure leaves capture due without advancing
fingerprint or claiming a save; a successful unchanged check advances the due deadline only.
`versions`/chunks retain at most 50 current entries and 100 MiB of canonical document bytes,
plus metadata. Age is 30 elapsed days; read gates apply before physical pruning. Expiry/eviction
removes chunks in the same transaction. History requests follow existing durable receipt
retention, not the 50-version cap; do not claim a global bound. An active intent may temporarily
hold selected/replaced documents in history_intent_chunks until completion. Each live journal
reference identifies its person/request/kind and records chunk count, canonical byte length and
SHA-256; verify the reconstructed canonical bytes before use. No JSON/base64 document string,
object array or unbounded identifier union goes into result. Two legal 2 MiB documents occupy
separate rows of at most 1 MiB, never one combined journal row; metadata plus chunk keys also
remain below the inherited Durable Object 2 MB row ceiling. Inventory actual row sizes and
intent bytes separately.
History captures do not replace or relax newest/previous recovery snapshots.

Initial capture occurs with normal room creation, including imported documents. Capture due
changed heads on room alarms/wake and changed last close; add the persisted deadline to the
existing minimum alarm schedule. Store actual server capture times; no fabricated missed copies.
A failed automatic capture remains due for retry, never reports a version that was not saved.

## Ordered document restore and two-store completion

Follow lifecycle v1's access/receipt/retention/expected-head order. In one SQLite transaction,
persist all selected/replaced intent chunks and the metadata-only journal referencing them,
before a monotonic external fence reservation. A failed intent transaction leaves neither a
journal nor orphan chunks. Serialize with edits, comments, capture, operator restore
and projection. Reserve above the independent fence, room generation and both live Supabase
checkpoints, failing closed on any unreadable/invalid required value. Persist old/new generation
and phase so restart can distinguish user-history completion from operator whole-room recovery.
No pending user restore may fall into the operator's clear-notices path.

In one room transaction store the before/after versions, new revision/fresh Yjs snapshot,
seen-identifier union, reconciled anchors and current mention targets/pending work under the
new generation, discard waiting/tickets and persist the result/pending phase. Keep current
discussion rows, comment IDs/counters and ordinary receipts. The selected document is validated
before any fence advancement; it is never accepted as a client upload. Ordinary transition
rules are bypassed only for this selected retained document through document v12's exception.

Call `carry_board_mentions` (access v7), preserving the delivered source_order cutoff and retained
notices/read state. Keep source occurrence IDs, original creation order and legitimate pending
pairs; do not reset mention_order. This fences older batches without turning delivered, dismissed
or evicted occurrences into new creations. Resume pending work only after carry/access replay
and unlock. Idempotent retry after a lost carry answer must not change read state or duplicate
capture. A read/fence/carry/access failure leaves the durable operation locked/pending and retries
that same request. After external carry and access replay are confirmed, atomically write the
terminal result (remove live intent-chunk references), delete every intent chunk for that request,
and clear the durable local restore lock in one SQLite transaction; acknowledge only after it
commits. Retained version_chunks and the durable idempotency result are kept. A failed completion/
cleanup transaction retains the pending journal, lock and complete chunk set for retry/restart;
never delete chunks independently or expose a completed result with orphan/missing chunks.
A transaction known to have rolled back changes no document/history; never report rollback after replacement committed. Announce 4423/rejoin, with stale generation checks
before edit/comment receipts, waiting application and recovery.

Directory copying uses the new revision/generation so the restored title eventually appears on
Home; copy failure does not undo a confirmed room save. No history content lives in Supabase.

## Current backup and runner recovery

Envelope remains `nextphase-board-room-backup`, version 1, with `meta.storage_version` **5**,
all existing backed-up tables plus the four history tables and fixed metadata keys. Validate
schema, reasons, metadata limits, chunk sequence/size, document board IDs/references, ordinal
uniqueness, current request/journal shapes and all current mention data before any fence/write.
The fingerprint keys are required current-format backup metadata: reject a missing/non-string/
non-64-lowercase-hex hash, a non-integer/out-of-range byte count, or inconsistent capture ordinal/
revision before any fence/write. Require history_revision no greater than live revision and a
positive history_ordinal. When the last-capture ordinal is retained, reconstruct its canonical
bytes and verify hash/count and capture revision against the metadata. When expiry/eviction
removed it, valid fingerprint metadata remains sufficient; never require it to match a newer
uncaptured live head or a recovery snapshot. Back up and restore those exact keys with the
other room metadata, preserving them through expiry cleanup and supported runner recovery.
Reject invalid current envelopes with 400 `bad_request`. No waiting/tickets/account inbox in it.
An in-progress user restore cannot be exported as an unlocked completed room: return 503
`restore_pending` until completion, rather than exporting an ambiguous journal. A completed
backup therefore has an empty history_intent_chunks table and no live chunk references or
pending intent. Reject orphan chunks, pending journals, dangling live intent-chunk references or embedded document
bodies in a current backup before advancing any fence; terminal result rows remain metadata only.

Keep 16,777,216 bytes for the entire UTF-8 JSON backup envelope, with 413 `backup_too_large`;
restore bodies over it get 413 `body_too_large`. Measure base64/escaping/metadata too, not just
document totals. Fifty 2 MiB documents exceed the envelope; legal history may be unbackupable.
Keep an explicit small valid backup/restore check and an over-budget refusal check.

Operator whole-room restore still clears restored mention source/projection behind a new fence,
keeps current-format retained versions with original ages and replays access before unlocking.
It never treats restored expired content as fresh. Node marked-volume recovery must still read
both live `boards.document_generation` and `mention_delivery.generation`, advance durably above
both and restored room/independent generations, then perform the correct pending-operation
completion or operator clear/access/unlock. Either failed checkpoint read keeps it locked.
Workers logical restore uses its independent fence too. Current restart and both supported
restore paths preserve valid history/identity and reject held pre-restore work. No new deletion
register, Trash state or purge job is introduced.
