# 0003 — Hosted persistence contract

CONTRACT VERSION: 0003 hosted persistence v9 (2026-11-08)

Status: Draft for 0007-W1 v1. Replaces [persistence v8](0003-hosted-persistence-v8.md).
Its16 service tables, lifecycle phases/fences/journals, chunk/history fingerprint
rules and limits remain. Current room layout **6** adds exactly one singleton
workshop_timer table to layout 5; saved document remains10. No Supabase timer store.
[Timer v1](0007-workshop-timer-v1.md) owns exact typed columns/invariants and
atomic state/version changes. Its server-only last_actor UUID is not a label.

The row's maximum encoded UTF-8 size is1,024 bytes, measured including keys.
No timer journal exists. Five recent mutation timestamps and five read timestamps
are bounded connection-attachment metadata, each budget≤1,024 bytes. All fit
the existing <131,072-byte new-row budget and2 MB runner ceiling; do not raise
65,536-byte journals,1,048,576-byte chunks,2,097,152-byte canonical document or
16,777,216-byte aggregate backup limits. Safe-integer overflow refuses atomically.

Persist through ordinary restart/eviction/last-leave. Backup envelope remains1
with storage_version6; omit workshop_timer explicitly from table enumeration,
not just empty its rows. Strict current envelope/table/meta/row key validation
rejects any timer payload before a fence/write (400 bad_request). Operator
replacement clears the live side record in its local replacement transaction,
behind a new recovery generation; physical marked/time recovery clears before
serving. User document-history restore preserves this live side record across
generation changes. No history/canonical/edit/edited-at change from timer actions.
Trash admission clears behind its fence, purge/discard erases table and callbacks.
Trash restoration initializes idle under a fresh generation. No hidden timer meta
key may leak through the generic meta copier. Existing recovery intent journals
carry no timer payload and do not reconstruct one.

## Explicit physical/time recovery marker

`restore_pending=1` alone never identifies explicit recovery: an accepted
document-history intent also sets it. Use two bounded room-local meta keys:
`explicit_recovery_pending` is exactly integer1 while explicit recovery is pending
(absent otherwise); `explicit_recovery_generation` is a positive JS-safe integer
reservation, absent until the reset transaction commits and removed on completion.
Reservation without the pending marker is invalid and fails closed.
Each complete encoded meta row is ≤1,024 UTF-8 bytes, including key/value; no
new journal or document payload. No compatibility with prior marked volumes is
required. These keys are recovery control, not timer/document/history content.

The stopped-process marking script atomically sets explicit_recovery_pending=1
and restore_pending=1 per board DB. Repeated marking of the same pending recovery
preserves an existing reservation. On load, inspect this marker **before** the
pending-history-intent shortcut, History.resume or any serving/publication.
An unreadable/invalid marker, reservation, required authority or checkpoint fails
closed. Never infer the marker from restore_pending or an intent's existence.

Check live active lifecycle/no deleted marker first. With the room still denied,
reserve an independent fence strictly above the independent/room/live directory/
mention generations and every generation in the pending history intent. Validate
all floors and overflow. In one local transaction persist the reservation, set
restore_generation to it and reset workshop_timer to idle/version0/null actor and
active fields. Reset here takes precedence even when a history intent exists;
it does not delete or replace the accepted intent/chunks. No reset publication to
old-generation peers. A crash before this transaction may reserve a higher fence
on retry; after it, the durable reservation proves reset completion and prevents
resetting again on each load. If a later live floor exceeds it, advance safely
without reviving timer state or lowering a generation.

Resume the pending document-history intent under the existing completion rules
and the fresh fence; it may advance the generation further, but must preserve
the now-idle timer. Do not discard an accepted document operation. Keep the marker
and serving denial through failures, history completion and current strict access
replay. Only after these confirm, atomically remove both explicit keys and clear
restore_pending if no history intent still requires it. No transient serving gap
when the history code clears restore_pending: explicit_recovery_pending remains
an independent gate until completion. A retry rechecks live authority/floors.

Without the explicit marker, ordinary restart resumes a pending document-history
intent and preserves the live timer end/remainder/id/version. Logical operator
restore still resets through its explicit entry point and local replacement
transaction; a new logical restore while a history intent is active still refuses
restore_pending without losing that intent or resetting its timer. Supported
time-recovery entry points stamp this same explicit marker
before loading recovered state. Logical backups omit both marker keys from meta;
strict restore validation rejects injected explicit keys before any fence/write,
as it rejects injected timer data. No marker can be imported through a backup.
