# 0003 — Self-host runner contract

CONTRACT VERSION: 0003 self-host runner v6 (2026-11-09)

Status: Draft for 0007-W2 v1. Replaces [runner v5](0003-self-host-runner-v5.md).
All process/key/volume ownership, independent lifecycle/fence discovery, deadline
scheduling, disposal and denial remain. Current layout7 and bounded stores are
[persistence v10](0003-hosted-persistence-v10.md) / [voting v1](0007-workshop-voting-v1.md).
Node26.13.0/npm11.20.0/document10/fileVersion2 remain.

Node SQLite and Durable Object SQLite persist identical voting session/private
rows. Ordinary restart/last-leave/room reopen/DO eviction or hibernation preserves
them. Reconstruct strict authorization, bounded rates and redacted presence
before sending to resumed sockets. No per-vote alarm or vote inactivity TTL.
Retain the timer's earliest-deadline integration without changes to its clocks.

Explicit logical/marked-volume/supported Workers time recovery resets timer and
voting together, before serving or pending-history resume. Use persistence v10's
marker/reservation and fail-closed retries. Ordinary restart with the same
document-history intent preserves/reconciles workshop state; explicit recovery
with that intent resets it while preserving accepted intent/chunks. Trash,
purge/discard drain callbacks and clear all workshop rows/files/alarms.

Recovery-path inventory: room.ts, storage.ts, backups.ts, lifecycle.ts, history.ts,
access.ts, timer.ts and voting.ts under packages/board-room/src; Node
apps/server/src/start-node.ts (roomEntry/recoveryGeneration/removeRoom),
node-storage.ts and apps/server/scripts/mark-restored-volume.mjs; Workers
apps/server/src/worker.ts (BoardRoom.getRoom/reserveTimeRecovery and independent
RestoreFence), worker-room.ts (reconstruction/restore-to-time/discard),
worker-runtime.ts; shared apps/server/src/runtime.ts, app.ts, lifecycle.ts,
delivery.ts and routes/operator.ts, access.ts, boards.ts, history.ts, lifecycle.ts.
Each is an allowed integration seam in the brief; do not implement only a
room-local reset and miss an adapter's pre-load path.

Session row≤65,536/ballot row≤4,096/50 ballots/aggregate≤270,336 encoded bytes;
each new row<131,072/below2 MB; no journal or ceiling increase. Reapply test clocks,
holds/failures after Node restart. Common recovery tests execute on both runners;
the real stopped marked-volume copy is Node-only. Record actual eviction/
hibernation/reconstruction mechanism; simulated reload alone is not server proof.
