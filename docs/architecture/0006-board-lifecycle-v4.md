# 0006 — Board lifecycle contract

CONTRACT VERSION: 0006 board lifecycle v4 (2026-11-09)

Status: Draft for 0007-W2 v1. Replaces [lifecycle v3](0006-board-lifecycle-v3.md).
All owner-only transitions,30-day retention, permanent register, journals and
independent denial/fences remain. [Voting v1](0007-workshop-voting-v1.md) adds a
session and private ballots, never document/history content.

Serialize voting with lifecycle admission in Room.ordered. At Trash's durable
fence clear timer/session/ballots/results before closing peers. Cleanup failure
keeps pending/denial and retries; held commands/reads/publications cannot recreate
state. Trash restore initializes idle. Purge/discard inventory includes
workshop_timer, workshop_vote, workshop_vote_ballots and pending callbacks; drain
before confirming disposal, preserve other boards.

Explicit operator logical/marked-volume/time recovery resets both workshop
records behind fresh generation before serving, including before pending-history
shortcuts. Ordinary restart/last-leave/eviction preserves them. User document-
history restore preserves live session/results, reconciling removed/different
active target identities without reviving pruned votes. Frozen totals never
recompute after reveal. Preview suppresses target inputs/overlays only.
Voting-only actions never revise canonical bytes/revision/edited-at, trigger a
capture, change retained ages/fingerprint or enter a logical backup/file.
