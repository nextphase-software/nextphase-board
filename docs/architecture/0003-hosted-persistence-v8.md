# 0003 — Hosted persistence contract

CONTRACT VERSION: 0003 hosted persistence v8 (2026-11-07)

Status: Draft for 0006-W4 v1. Replaces [persistence v7](0003-hosted-persistence-v7.md).
All layout-5 stores, history chunking/journals, backup validation/fingerprints and 16 MiB budget
remain. This version replaces v7's no-lifecycle-register exclusion. Current rules are
[lifecycle v2](0006-board-lifecycle-v2.md), [access v8](0003-access-v8.md),
[API v8](0003-api-v8.md), [runner v4](0003-self-host-runner-v4.md).
Saved document 10 / room layout 5; lifecycle authority is outside room backups.

## Server-only directory stores

Add three RLS-enabled service-only tables (13 existing + 3 = **16**). No browser privileges,
public policies or client calls. Fixed-search-path service functions explicitly revoke public,
anon and authenticated EXECUTE. No content is stored in the permanent register.

| Table | Exact logical fields / constraints |
| --- | --- |
| board_lifecycle | board_id UUID primary key, workspace_id UUID, state TEXT in active/moving/trashed/restoring/purging, cycle BIGINT, generation BIGINT, deleted_at BIGINT nullable, restore_before BIGINT nullable, operation_id UUID nullable, phase TEXT, next_attempt_at BIGINT nullable; all integers nonnegative JS-safe; timestamps null in initial active, fixed through its Trash cycle, cleared when purging |
| board_lifecycle_requests | board_id UUID, person_id UUID, request_id UUID composite primary key; operation_id UUID UNIQUE, operation TEXT move/restore/purge, expected_cycle BIGINT, accepted_cycle BIGINT, digest TEXT exactly 64 lowercase hex, result TEXT bounded metadata-only JSON; remove all board requests at final purge |
| deleted_board_ids | board_id UUID primary key, workspace_id UUID, generation BIGINT; only these content-free identifiers and generation, no title, person, dates, body, permission snapshot or result; no board-row FK/cascade and no room restore can replace/delete it |

operation_id is server-generated once per accepted operation and, for an owner request, joins
the lifecycle record to its request row; it is distinct from the caller's requestId. A retry resolves the composite
caller/request key to this same operation. An automatic expiry operation is identified by operation_id in board_lifecycle alone, with
no fabricated person/request row. A background/current-owner status continuation needs
no new caller request. At most one nonterminal operation exists per board. `phase` is exactly
idle/admitted/room_fenced/delivery_cleared/access_ready/room_removed/sql_removed:
- active or settled trashed: idle, operation_id null, next_attempt_at null (trashed is still
  discovered by restore_before);
- moving: admitted → room_fenced → delivery_cleared → settled trashed;
- restoring: admitted → room_fenced → access_ready → active;
- purging: admitted → room_removed → sql_removed → final deleted marker.

Each nonterminal state has non-null operation_id and next_attempt_at. Mark delivery_cleared
only after source/projection clearing confirms, access_ready only after current access/fresh
fence reconciliation, room_removed only after complete runner discard, sql_removed only after
all board-dependent SQL removal confirms. Final state/phase changes and request result commit
in the same SQL transaction; no skipped/retrograde phase within one operation on retry. Automatic expiry may replace an
overdue moving operation only as lifecycle v2 explicitly permits. The register's insert plus
lifecycle/request removal is the final purge transaction. Refuse invalid combinations before write.

workspace_id in the deleted-ID register is solely the immutable identifier needed to authorize
current-owner terminal status after removing the board row. It stores no workspace name or
membership snapshot. The register survives deleting a board's dependent SQL rows. Workspace
removal is outside this milestone. For absent unregistered IDs, deny; never infer active.

Create lifecycle active authority in the same SQL transaction as ordinary/imported board creation;
compensation removes that failed creation's authority, not a fabricated successful Trash cycle.
Never permit room initialization until this exists. Deliberately resolve lifecycle joins inside
board_role, RLS/list/Recents/participants/invitation acceptance, copy_saved_board and projection/
lease/access functions. Active means active authority AND no deleted marker. Existing dependent
rows are retained during Trash except delivery cleanup; retained grants can be revoked while in
Trash by the current workspace owner using access v8's DELETE grant exception. Implement the
service-only revoke_unavailable_board_grant(board,person,caller) function: under workspace then
lifecycle row locks (the common transition lock order), resolve matching live board/workspace,
require current enabled owner and moving/trashed/restoring/no marker, and apply remove_grant's
owner-row guard, access-change/guest cleanup atomically. Never authorize via active-only
board_role. Serialize against restoration; if active won, recheck current owner and apply the ordinary
remove_grant logic inside the same locked SQL call.
No grant creation/read/access admission is authorized; purging/deleted/missing refuse, and
unreadable required state fails closed. Preserve pending removal receipts and replay revocations
before active restoration, without room creation or old notice delivery. Keep fixed search_path
and service-only EXECUTE revocations. Removing a board row alone is not purge.

Expose service-only transition/status/work-discovery functions through supabase.ts. Lock the
workspace row first, then the board's lifecycle row (the shared lock order), and recheck
current owner/expected cycle. Persist admission, operation
identity, immutable times and phase together. Serialize with the room queue and use monotonic
compare-and-set generations on external writes. Never hold a SQL transaction open over a room
network call; durable phase transitions coordinate stores, without a distributed atomic claim.
Minute discovery selects due nonterminal records and expired Trash in bounded batches of **50**,
ordered next_attempt_at then board_id; repeat batches to exhaustion, retry each failure no sooner
than the next 60,000-ms tick, keeping progress. Relevant reads/wakes also schedule due work.
A restored active record has no pending next_attempt_at; clear deleted_at/restore_before on
confirmed restoration. Cycle remains to distinguish later stale requests. Expiry time remains logically binding.

## Stored-value budget

No new document payload, identifier union, row array or backup envelope goes in a lifecycle row
or request result. `result` is at most **65,536 UTF-8 bytes**, validated before persistence;
accepted journal phases contain IDs, digest, integer fences/cycle/times and bounded result only.
Use explicit typed fields/phase flags, no accumulating error strings/logs. IDs use 36 ASCII
characters, phase/state/operation strings at most **32 UTF-8 bytes** each; every complete encoded
lifecycle/register/request row (including keys and metadata) must be **<131,072 UTF-8 bytes**.
Thus even the largest permitted journal row is below the runner's inherited **2 MB row ceiling**.
Measure actual maximum rows in checks; do not reason from document size alone. `deleted_board_ids`
has constant-size fields (two UUIDs and one integer). Request count is not globally bounded.

Existing version_chunks and history_intent_chunks remain at most **1,048,576 raw bytes/row**;
history_requests.result at most **65,536 UTF-8 bytes**; each canonical document at most
**2,097,152 bytes**; entire JSON/base64 backup at most **16,777,216 bytes**. No new room table,
chunk or combined selected/replaced document journal is necessary. Preserve exact layout-5
history fingerprints and chunk/terminal-result/cleanup atomicity. Keep separate row/aggregate
limits; fifty maximal versions need not fit a backup. SQL pagination is not a journal payload.

## Transition and recovery ordering

Follow lifecycle v2's moving/frozen-history/source-clear → trashed, restoring/fresh-fence/access
→ active, and purging/room-discard/dependent-SQL-cleanup → deleted order. Persist phase before
external work and confirm completion before advancing. Repeating a confirmed phase is harmless.
Failures never delete intent needed by an accepted history restore; finish it before admitting
Move. Every post-admission callback checks the authoritative operation/cycle/generation before
writes or receipts. No older work can unlock/overwrite a later fence.

At purging, clear title/time-bearing work results and rewrite request results to content-free
pending metadata. The title remains only in denied serving data awaiting cleanup, not status.
Keep workspace/board IDs, phase and generation for current-owner status and retries. Atomically
insert the final deleted register at the already reserved or higher generation and remove all
lifecycle/request/dependent rows only after runner discard and backup-copy cleanup confirm.
A crash between room removal and SQL cleanup stays denied; retry cannot reinitialize the room.

Logical backup is active-only. Operator restore, Node marked-volume recovery and Workers time
recovery must query authority/deleted register before touching/serving restored rooms, preserve
original Trash/history deadlines, and reject non-active/deleted IDs. Supabase recovery requires
an independently preserved current register and unresolved lifecycle ledger to be reapplied
before routes/schedulers serve; never restore an older SQL copy and declare missing markers
active. Document this procedure in the server README. If the independent ledger is unavailable,
keep service closed. Runner fences alone cannot replace the authoritative deletion register.
