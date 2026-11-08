# 0006 — Board lifecycle contract

CONTRACT VERSION: 0006 board lifecycle v3 (2026-11-08)

Status: Draft for 0007-W1 v1. Replaces [lifecycle v2](0006-board-lifecycle-v2.md).
All authority,30-day retention, history, owner-only transitions/phases, permanent
register and recovery fencing stay. [Timer v1](0007-workshop-timer-v1.md) adds
one workshop side record, never document/history content.

Serialize timer commands/read/publication with lifecycle admission in Room.ordered.
Trash admission clears timer at its durable fence before peers close; held old
commands/results/alarms cannot write or publish afterward. If cleanup fails keep
denial/pending and retry the same phase; never reopen with a prior timer. Trash
restore starts idle under its fresh generation, not a recovered timer. Purge and
discard inventory additionally includes workshop_timer and scheduled timer work,
draining/cancelling callbacks before confirming removal. Other boards stay intact.

Operator logical/marked-volume/time recovery clears timer before serving under
a fresh generation. Ordinary restart/eviction/last-leave preserves it; user
document-history restore preserves the current live side record, refreshing
transport generation without restoring historical timer data. Timer-only actions
do not create versions/captures, revise content/edited-at, alter retained ages or
history fingerprints. Existing genuinely changed-document scheduled work remains
allowed; timer activity itself is never an edit/capture trigger.
