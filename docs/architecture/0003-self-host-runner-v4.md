# 0003 — Self-host runner contract

CONTRACT VERSION: 0003 self-host runner v4 (2026-11-07)

Status: Draft for 0006-W4 v1. Replaces [runner v3](0003-self-host-runner-v3.md).
Its process/key/volume ownership, layout-5 history, separate Supabase store and bounded backup
remain. Partners: [persistence v8](0003-hosted-persistence-v8.md),
[lifecycle v2](0006-board-lifecycle-v2.md), [API v8](0003-api-v8.md),
[sync v9](0003-sync-v9.md), [access v8](0003-access-v8.md).
Node 26.13.0 / npm 11.20.0, saved document 10 and room layout 5 remain current.

Both Node SQLite and Durable Object SQLite execute identical lifecycle admission/phase rules.
Add lifecycle discovery to the **60,000-ms** delivery scheduler: Node interval and Workers
scheduled handler discover durable due records/expired Trash in 50-record batches, independently
of whether a room is awake. Relevant lifecycle reads and room wakes also request continuation.
Downtime delays physical cleanup, never extends restoreBefore. Persist operation/phase before
external work; injected failure/restart resumes it without another deletion or false success.
Test controls must reapply process-local clock/failure/hold settings after a Node restart.

Discard drains queued/background work and closes sockets without a history last-close capture.
Node cancels per-room timers, closes SQLite and removes its SQLite/WAL/SHM files; Workers cancels
alarms, drains work and deleteAlls room storage. Confirm absence before advancing purge. Both
removeRoom adapters reject late callbacks and never initialize a denied/deleted room. Independent
runner fences are retained outside room discard until lifecycle authority/register makes them
redundant; do not mistake them for the permanent deletion authority.

Every logical backup/restore, marked-volume recovery and supported Workers time recovery checks
live lifecycle and deleted_board_ids before load/replay/serving. Active recovery still preserves
history ages/fingerprint and uses generation floors from lifecycle, independent fence, room,
boards.document_generation and mention_delivery.generation. Non-active/deleted recovered rooms
remain denied and are discarded/resumed according to their authoritative operation; no recovered
intent may complete across a later lifecycle fence. No timer resets Trash/history ages.

Node marked-volume recovery still stops the process, restores its folder/fences, runs
mark-restored-volume.mjs and restarts. The separate live lifecycle/register is not replaced by
that folder. Workers logical/time recovery likewise cannot roll it back. For SQL recovery,
independently preserve and reapply the latest deleted-ID register AND unresolved lifecycle
records/request phases/original deadlines before any listener, room wake or scheduler serves.
If that ledger cannot be proven present, stay closed. A successful older SQL restore does not
make a missing deleted marker an active ID. Document exact recovery/discard sequencing and the
three service tables in apps/server/README.md; apply schema/deploy only as a separate operator
action. Local disposable test-stack schema setup is owned by the independent check run.

Purge erases all Board serving stores/managed copies, without promising erasure of downloaded
files, operator-held offline envelopes or provider recovery copies. No managed backup archive,
provider plan, deployment, dependency or broader recovery campaign is introduced. Physical
marked-volume checks are Node-only; both runners must execute logical recovery and the same
lifecycle tests, reporting genuine runner-specific exclusions as such.
