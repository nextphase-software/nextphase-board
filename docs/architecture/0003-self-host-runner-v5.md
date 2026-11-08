# 0003 — Self-host runner contract

CONTRACT VERSION: 0003 self-host runner v5 (2026-11-08)

Status: Draft for 0007-W1 v1. Replaces [runner v4](0003-self-host-runner-v4.md).
Its process/key/volume ownership, lifecycle discovery, independent fences,
disposal and recovery procedures remain. Current room layout 6 and timer storage
are [persistence v9](0003-hosted-persistence-v9.md) and
[timer v1](0007-workshop-timer-v1.md); document 10 and Node 26.13.0/npm11.20.0 stay.

Both Node SQLite and Durable Object SQLite atomically persist the same singleton
timer. Ordinary Node restart, room reopen, DO eviction/hibernation/ordinary restart
and last-leave preserve it; use env.now() and persisted end, never restart duration.
Paused remains paused indefinitely. Restore rate counters from bounded socket
attachments after hibernation; no growing row or journal. Timer row≤1,024 encoded
UTF-8 bytes, each rate budget≤1,024; inherited row/journal/chunk ceilings remain.

Add end/end+2,500 deadlines to the existing earliest-deadline calculation without
replacing history, presence, ticket, waiting or copy work. No per-second server
timer. Late wake/read/command normalizes once and schedules the next real deadline.
Node's process timer and DO alarm execute the same ordered state machine. Record
which actual eviction/hibernation/reconstruction mechanism each test exercised.

Distinguish ordinary restart from explicit recovery: logical operator restore,
marked Node-volume and supported Workers time recovery clear workshop state
behind a new generation before serving. Document-history restore preserves live
timer state. Lifecycle Trash/discard/purge clears it and drains/cancels held timer
callbacks so no table/file/alarm can be recreated. Recovery never lowers lifecycle
or independent fences. Keep Node physical marked-volume subcases Node-only;
both runners execute logical/time guards. Reapply process-local injected clock/
hold/failure controls after Node restart. Document these exact boundaries in the
server README without changing deployment, dependencies or service schema.

`apps/server/scripts/mark-restored-volume.mjs` must mark each stopped Node board
DB transactionally with explicit_recovery_pending=1 as well as restore_pending=1,
preserving a reservation on repeat marking. A pending document-history restore
sets restore_pending too, so that flag alone is not an explicit-recovery signal.
Implement the exact marker/reservation/fence/reset ordering in
[persistence v9](0003-hosted-persistence-v9.md), before recoveryGeneration's
history-intent shortcut and before Room load can resume or serve an intent.
Do not change an ordinary restart with an intent into an explicit recovery.

On a marked copy, reserve above all live/independent/room/intent generation floors,
commit the fresh fence reservation and timer reset together locally, then resume
the accepted document intent without losing its chunks or resetting the timer
again. Gate serving on the explicit marker even if history clears restore_pending;
retain marker/reservation on failure, remove them only after completion and strict
current replay. Unsupported/invalid marker state or unavailable floors stays locked.
Supported Workers time-recovery entry points stamp the same marker before room
load; ordinary eviction/hibernation/restart does not. Logical recovery keeps its
explicit-entry reset and cannot accept a marker from a backup. No compatibility
with earlier marked volumes is part of this current-format contract.

Paired proof uses the same pending document-history intent phase and running or
paused timer: ordinary restart preserves it on both runners (S248); a stopped
Node volume copy marked by the real script resets it before any serving, despite
the intent (S252 Node-only physical subcase). Both runners additionally prove
their explicit logical/time entry reset with an intent. Inject a failure after
fence reservation/reset, restart/retry and prove denial until completion, no
repeated reset, no stale command admission and no accepted-history-intent loss.
