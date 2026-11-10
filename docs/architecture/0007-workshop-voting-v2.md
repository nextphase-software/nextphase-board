# 0007 — Workshop voting contract

CONTRACT VERSION: 0007 workshop voting v2 (2026-11-10)

Status: Draft for 0007-W3 v1. Replaces [voting v1](0007-workshop-voting-v1.md).
All v1 ballot/privacy/rights/targets/budget/projections/storage/retention,
reveal/results/marker anchors, panel controls, focus and announcements stay.
Only the interaction with [spotlight](0004-presence-v3.md) changes.

Starting running voting ends the current spotlight in the same Room.ordered
transition before any subsequent spatial delivery. Invalidate all offers,
memberships, private resume capability and grace deadline; never suspend it for
later reveal. Refuse spotlight start/take_over/follow/resume while running with
spotlight_voting even when the client has stale voting state. Leave/read remain
possible; read returns idle spotlight. Define failure by the Start commit in
packages/board-room/src/voting.ts: rejection before that commit leaves spotlight
unchanged. A committed Start ends spotlight in the same ordered transition,
before any post-commit await, even if the later stamp, authorization or reply
delivery fails and the caller receives vote_refused. Never roll spotlight back
or revive it because that post-commit work failed; authorized peers/readback
observe running voting and idle spotlight. No partial ending for an uncommitted
Start, and no surviving spotlight after a committed Start.

Retain v1/presence v2 running redaction on joined/relay/reconstructed attachments,
immediate remote spatial clearing and disabled manual Follow. Spotlight adds no
view transport or privacy bypass. Reveal/reset requests fresh presence without
restoring spotlight/manual Follow or hidden offers. Timer controls/clocks/title
and both workshop cards are unchanged. No voting storage version or format change.
