# 0006 — Board lifecycle contract

CONTRACT VERSION: 0006 board lifecycle v1 (2026-11-06)

Status: Draft for 0006-W3 v1. Governs team-board document history only.
[API v7](0003-api-v7.md), [access v7](0003-access-v7.md),
[hosted persistence v7](0003-hosted-persistence-v7.md), [document v12](0001-document-v12.md),
[sync v8](0003-sync-v8.md), [comments v3](0005-comments-v3.md),
[hosted storage v7](0003-hosted-storage-v7.md) and [interaction v33](0001-interaction-v33.md)
are the corresponding contracts. The saved board document is version 10; room layout is 5.

## Captures and metadata

A version is an immutable canonical copy of the latest server-confirmed document: board ID,
title, object IDs/generations, retired generations, memberships and connector references.
Comments, permissions, inboxes, unposted text and unsaved tab edits are not part of it.
Document size is at most 2,097,152 canonical UTF-8 bytes; chunks are at most 1,048,576 bytes.
History is separate from newest/previous recovery snapshots and never delays edit acknowledgement
for a remote service. Capture and retention are ordered room transactions.

Capture the initial confirmed state once, including an imported initial document. Thereafter:

- At the next 30-minute checkpoint, capture if the canonical document changed since the last
  successful capture. Persist the checkpoint deadline; intervals are anchored to initial capture,
  1,800,000 ms apart. A late wake captures at most the current head, never invented missed states.
- Capture on the last collaborator close if changed. This includes a final viewer leaving after
  an editor's earlier change. Ordinary unchanged close/wake/restart creates no duplicate.
- An explicit Save version captures the latest confirmed head even if unchanged. An optional name
  labels that new entry. Name version updates metadata of an existing retained entry only.
- Restore creates two entries as specified below, even if either content equals another entry.

Automatic equality uses the durable last-capture SHA-256 and canonical UTF-8 byte count from
hosted persistence v7. Both survive history expiry/eviction and recovery-snapshot pruning and
update atomically with each successful capture; naming/failure does not advance them. Returning
to identical canonical content after subsequent edits/restart suppresses a duplicate automatic
capture even at a higher revision with no retained last-capture chunks. Manual/restore captures
still occur on equality; the restored entry is the final fingerprint of a two-entry restore.
Current backups include and validate the required fingerprint metadata before changing fences.

Each public metadata record is exactly `{id,ordinal,capturedAt,revision,generation,reason,name,
description,actor,namedBy,sourceName}` (line wrapping here adds no keys). `id` is a server-generated
lowercase UUID; `ordinal` strictly increases per board. Times are server Unix milliseconds;
revision/generation/ordinal are nonnegative safe integers. `reason` is `initial`, `checkpoint`,
`last_close`, `manual`, `before_restore` or `restored`. `name`, `description` and `sourceName`
are strings; absent values are empty strings. `actor` and `namedBy` are board-person label
snapshots or null, never account UUIDs/emails. Automatic captures have null actor. `namedBy`
identifies the last explicit naming actor; capture actor/time/content never change when named.
`sourceName` is the selected version's display heading captured when restoring.

Names and descriptions are optional plain text, at most 100 and 500 Unicode code points.
Reject ill-formed Unicode, controls other than LF, CR and TAB, or over-limit input with
400 `bad_request`; store valid input verbatim, including empty strings. Render as text, never HTML.
UI counts Unicode code points, including non-BMP characters once. No implicit title truncation
changes a saved name. A named version uses its name as heading; otherwise use interaction v33's
reason headings. Metadata is mutable; the captured document and original age are immutable.

## Retention and access

Keep the newest 50 entries by ordinal, each for less than 2,592,000,000 ms (30 × 24 hours)
from original capture. At `now >= capturedAt + 2,592,000,000`, the version is unavailable.
Age and count apply equally to named, automatic, manual and restore entries. Naming never pins
or renews. The 51st evicts the oldest and all its chunks in the same transaction. A restore's
two entries consume two places. Enforce age on every list/preview/name/restore, before lazy
physical cleanup; live content never expires. List newest first, no pagination or total outside
the permitted retained set. If the selected entry is evicted during restore, copy it before pruning.

All current effective roles may list/preview, including viewers and granted guests. Effective
editors/owners may save/name/restore. Every route rechecks live access before protected data or
receipt results; signed-in denied/missing/expired targets are generic 404 `not_found`, permitted
viewer mutations 403 `role_too_low`, invalid authentication 401, service failure 503
`service_unavailable`. A service failure is never an empty list. No history read marks notices read.

## Document restore

Confirm against `{expectedRevision,expectedGeneration}` from a fresh live head. Inside the room's
ordered queue, revalidate current access, selected retention and expected head before mutation.
A changed head returns 409 `head_changed`; return no replacement expected head as permission to
auto-confirm. The user reviews current content and explicitly confirms again with a new request.

Preserve the replaced confirmed head as `before_restore`, then append the selected document as
`restored`, under the same board ID, at live revision + 1 and a strictly higher independent
restore generation. Both entries have server capture time and consecutive increasing ordinals;
newest is restored even when timestamps are equal. The before entry records the replaced head's
revision/generation. Rebuild fresh Yjs state, never merge historical updates into the live CRDT.
Retain the union of all seen ID/generation pairs. Only the internal authorized history path may
reinstate historical pairs/retired-generation content (document v12); ordinary edits cannot.
Preserve all other newer retained versions subject only to the shared age/count limits.

Use one durable `(person,requestId)` identity with a digest of the exact operation, selected ID
and confirmation. An identical retry returns the original result, never another restore. A changed
body for that identity is 409 `request_id_reused`. Save version has the same retry rule; naming
is an absolute metadata assignment and does not capture a document. Request results survive
restart and expiry of their version; recheck access before returning them. Resolving an accepted
request's receipt precedes reapplying expected-head/retention checks; a never-accepted request
must pass those checks. Such a receipt grants no preview of an expired document.

Document replacement, two captures, retention, identity union, pin reconciliation, source mention
carry and durable result/journal commit atomically in room storage. A known rollback changes no
document/history. After a durable restore intent/fence or a committed replacement, failures are
pending, not a claim of rollback: stay locked and explicitly retry the same identity until the
external carry and access replay succeed. Persist selected/replaced intent documents in raw
chunks of at most 1,048,576 bytes; the journal contains only bounded references, phase and result,
never document bodies. Atomically create journal/chunks before the fence, and after external
completion atomically save the terminal result, delete that request's intent chunks and clear
the local lock. A failed transaction leaves no partial intent or partial cleanup; pending chunks
remain available across restart. Hosted persistence v7 defines the exact stores/row bounds.
The fence reservation
is monotonic and never rolled back. The locked operation cannot be bypassed by another mutation.
Do not acknowledge success until both stores' required work is confirmed. No distributed atomic
transaction is claimed. Hosted persistence v7 specifies the notification carry.

Pause edits/comments, invalidate tickets, discard waiting updates and close sockets with 4423.
Rejoin current content, clear board Undo/Redo and reject every pre-restore edit/comment generation
before receipts or recovery. Keep unposted comment text/ranges in this tab for explicit review,
without automatic send; deleted target drafts remain reviewable without recreating that comment.
Access loss/sign-out still clears protected drafts. Announce the restoring actor and rejoin state.

Keep today's threads, replies, text, mention ranges, resolved state, identifiers and counters;
never revive deleted discussion. Attached pins follow matching restored ID/generation; missing
anchors detach at their latest authoritative point; detached pins stay detached. Keep retained
notice IDs, creation order and read state and legitimate pending delivery, without replay of
already delivered/dismissed/evicted occurrences. User restore is distinct from operator whole-room
restore, which suppresses restored mention delivery and clears projected notices.

## Current backup and boundaries

Current backups include retained versions and original capture ages. Restart/logical backup/
supported runner recovery preserves valid history and fences; reads re-evaluate server time.
The entire serialized room backup remains at most 16,777,216 bytes; exceeding it explicitly
returns 413 `backup_too_large` (restore body: `body_too_large`). Fifty maximal documents alone
can consume 104,857,600 bytes; no guarantee every legal board fits the backup envelope.
Local boards, Board files and JSON exports carry no history, comments or permissions. No Trash,
board deletion, purge, asset route, history link sharing, diff, branch or duplicate-from-version
is introduced. Trash and board deletion belong to 0006-W4.
