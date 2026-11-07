# 0006 — Board lifecycle contract

CONTRACT VERSION: 0006 board lifecycle v2 (2026-11-07)

Status: Draft for 0006-W4 v1. Replaces [lifecycle v1](0006-board-lifecycle-v1.md).
Its capture/metadata/retention and document-restore rules continue on active boards. This
version replaces its Trash/deletion exclusion and gates every inherited operation, including
accepted history receipts, on current lifecycle state. Current partners: [API v8](0003-api-v8.md),
[access v8](0003-access-v8.md), [persistence v8](0003-hosted-persistence-v8.md),
[sync v9](0003-sync-v9.md), [runner v4](0003-self-host-runner-v4.md),
[comments v4](0005-comments-v4.md), [document v13](0001-document-v13.md),
[hosted storage v8](0003-hosted-storage-v8.md), [interaction v34](0001-interaction-v34.md).
Saved document 10 and room layout 5 remain current. Build directly from these contracts.

## Authority and state machine

Only the current workspace owner may move an active board to Trash, view workspace Trash,
restore it, or permanently delete it. Being its creator, an editor, or a granted guest is
insufficient. Recheck current ownership on every request/retry and inside transition admission.
No ownership-transfer capability is added. Ordinary access is possible only in `active` state.
Every other state fails closed for content access, including incomplete cross-store work. The
current-owner grant-revocation exception in access v8 grants no content access.

Authoritative server-only lifecycle state, request identity and work discovery live in Supabase,
outside recoverable room storage. The independent runner fence still exists. Read both; an
unreadable required state is 503, never an assumed active board. Missing lifecycle authority
for a known board is a service failure, never permission to initialize/recover its room.

| From | Operation | Ordered result |
| --- | --- | --- |
| active | Move | moving → trashed; first transition records deletedAt and restoreBefore once |
| trashed | Restore while server now < restoreBefore | restoring → active, same board/workspace, strictly higher generation |
| trashed | Owner delete or expiry | purging → deleted marker |
| moving whose deadline has passed | Automatic expiry only | purging → deleted marker; an owner delete cannot supersede moving work |
| moving / restoring / purging | Same accepted request or background continuation | Resume that operation only; no competing owner transition |

`cycle` is a nonnegative safe integer, initially 0, incremented exactly once when Move is
accepted. The active state after restore retains that cycle. Move expects the current active
cycle; restore/delete expect the Trash cycle. Requests capture these values immutably.
Server times are Unix milliseconds. `restoreBefore = deletedAt + 2,592,000,000` (30 × 24 hours).
Restore admission linearizes under the lifecycle row lock: at deadline−1 ms it may win; at
exact equality/later it cannot. An admitted restore can complete after the deadline; its
persisted admission is the winner, not a new restore admission. Expiry/delete cannot overtake
it. A purge winner can never be restored. Serialize both race orders; no deadline extension.
Automatic expiry may supersede an overdue moving operation under the same lifecycle row lock,
with a new system operation_id/higher fence in the same cycle. It requires no caller receipt,
never claims Move completion, and resolves older Move retries as current purging/deleted status.
No ordinary owner operation can supersede nonterminal work; an admitted restoring winner is
never superseded by expiry.

## Move and the lifecycle fence

Confirm that everyone loses access, including open peers. Serialize admission with edits,
automatic/manual capture, user document restore, operator restore and mention projection.
Use the same ordered room queue plus a locked compare-and-set lifecycle transition; all paths
revalidate lifecycle at their commit/receipt boundary. Before creating an empty lazy room,
check directory/lifecycle authority; moving a never-opened board need not create a room.

A previously accepted pending history restore must finish first. A new Move returns 503
`restore_pending`, without entering moving, discarding intent chunks or claiming deletion.
Holding that queue prevents a history intent from starting between this check and admission.
Once moving/fence is durable, no earlier edit save, capture, history receipt result, history
restore completion, directory copy, notification batch or recovered intent may cross it.
The transition is irreversible by a failed external call; keep denial and durable pending work.
Reserve a generation above lifecycle, independent runner, room and live directory/mention
checkpoints. Freeze history writes before closing peers so deletion's last-close creates no
checkpoint. Invalidate join tickets, dependency-waiting edits and client retries; close 4403.

Keep the latest confirmed document, identifier history, current discussion/ranges, grants and
unexpired history. Preserve original capture ages/ordinals, newest-50 policy, last-capture
SHA-256/byte count and persisted capture deadline. No automatic/manual/document-restore capture
while unavailable. Physical age pruning is allowed; unavailable history never becomes readable.
Remove source mention targets/pending work and projected notices behind a higher delivery fence;
retain the higher-generation mention_delivery checkpoint and delivered cutoff so held batches cannot recreate them. Mark trashed only after room
fencing/ticket/source/projection cleanup is confirmed. A partial/lost answer is pending, not
rollback or success. The browser distinguishes uncertainty from a proven pre-admission failure.

## Same-board Trash restore

Recheck owner and deadline under the row lock. Preserve board ID, link, workspace, document,
revision, object identities, current discussion and still-valid history. Use retained grants and
current memberships, never a permission snapshot. Removed membership/grants stay removed.
Reserve a higher fence; invalidate all former tickets/waiting work. No old tab retries or notice
replay. Do not call document history's carry-notices path to recreate removed delivery. Only a
later explicit mention may create a new occurrence once. All clearing/access reconciliation
must finish before active/success. A cross-store restore failure stays restoring/denied and
resumes its accepted operation, even after the original deadline; it never changes admission time.

Restore access creates no history entry or document replacement. Resume the persisted active
capture schedule only after active; if overdue, capture at most one genuinely changed confirmed
head at an ordinary scheduled wake, never backfill or renew ages. Keep the durable fingerprint.
Every confirmed Trash restore includes Some older versions may have expired. in its success
note, whether history is empty or retained. This asserts no expiry cause/time. Empty history on
return from that tab-memory receipt uses interaction v34's neutral copy; no extra expiry evidence
or joined field is added. Stay in Trash with a temporary Board restored receipt and Open board;
only explicit Open board navigates to the same `#/b/<boardId>` with fresh access/session state.

## Idempotency and uncertainty

Use `(board, person, requestId)` with an immutable operation/body digest and expectedCycle.
The request's accepted cycle is durable. After fresh owner/lifecycle checks, resolve the accepted
request before applying a new state's preconditions. Same identity with different body/operation
is 409 `request_id_reused`; a receipt from another cycle is 409 `lifecycle_changed` and cannot
move/restore/delete the later cycle. A stale never-accepted expectedCycle also gets that 409.
No receipt exposes document/history data. Lost-answer Retry uses identical route/body/identity;
automatic server continuation is permitted, automatic browser mutation retry is not.
On permanent completion receipts are removed; the deleted marker supplies only the terminal
state after current owner authorization. No request can recreate a permanently deleted ID.

## Permanent deletion and expiry

Owner confirmation and expiry use the same purge. Durably mark purging and advance denial/fence
first. Erase title/deletion dates from lifecycle work metadata before returning purging status;
owner status is content-free. Drain queued/background room work, cancel timers/alarms, close
sockets, discard room storage and confirm it is gone. Remove every room table, including document,
recovery snapshots/chunks, seen identifiers, receipts, waiting/tickets, comments/mentions,
versions/version_chunks/history_requests/history_intent_chunks and any pending restore data.
Remove any Board-managed backup copy; there is no Board-managed backup archive in this release.

Explicitly remove board-dependent SQL rows: board grants, board invitations, opens, notification
references, leases/checkpoints, board-specific access changes/delivery, and the board row.
Preserve unrelated workspaces/members, other boards and workspace-wide access history. No
foreign-key cascade assumption substitutes for an inventory. Lifecycle work remains until every
phase confirms; failures survive restart and retry on minute discovery and relevant reads/wakes.
Only then atomically remove lifecycle progress/requests and retain the content-free deleted-ID/
generation register specified by persistence v8. Deletion pending has no Restore/Cancel control.
Refresh status checks existing progress; it never begins another deletion.

All supported logical, marked-volume and time recovery consult that register before room
creation/load/restore/replay. SQL recovery must preserve/reapply it, plus unresolved lifecycle
state and original deadlines, before serving. Loss of the register is a recovery failure, never
proof that an ID is active. Reject late directory copies, initialization, projection and recovered
intents after permanent completion. Never reuse a deleted board ID.

Serving-store deletion cannot erase downloaded files/envelopes, operator-held offline copies or
provider recovery copies. Do not promise that erasure, add a backup archive or choose a provider
recovery plan. Local-board Trash, account/workspace erasure, historical exports and asset routes
are excluded. All checks concern the current client, protocol and saved formats.
