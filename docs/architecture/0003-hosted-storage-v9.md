# 0003 — Hosted boards in the web app

CONTRACT VERSION: 0003 hosted storage v9 (2026-11-08)

Status: Draft for 0007-W1 v1. Replaces [hosted storage v8](0003-hosted-storage-v8.md).
All Home/Trash/history/Comments/document-draft and current4403/4423 behavior stays.
[Timer v1](0007-workshop-timer-v1.md) and [interaction v35](0001-interaction-v35.md)
own the hosted-only timer and exact words/styles/focus. No local/off timer.

Use a dedicated tab-memory timer controller and pure monotonic clock/draft rules,
independent of document editing and canEdit. One outstanding mutation; freeze
Checking timer… immediately, read back after 2,000ms without resend. Initial
--:--/Connecting timer…; lost transport/authority/clock health freezes confirmed
time under Timer disconnected. Reconnecting… with no title prefix. Fresh current
snapshot/sample restores controls, never replays commands. Timer-specific
refusals cannot mark an edit refused or erase/replay document pending changes.

Personal03:00 idle input is tab memory only; independent per participant, retained
through active/remote transitions and panel handoff, reset on full reload. A4403
role change pauses timer work, reauthorizes and retains draft if access remains;
viewer rejoins with all timer controls. Confirmed loss/sign-out/account/board
boundary clears timer snapshot, clock, input, panel, confirmation, pending work,
announcements and title before late responses can repaint. A4423 document restore
keeps live shared timer and personal draft but refreshes session generation/sample.

Timer/History/Comments/Share are mutually exclusive transient surfaces; controllers
retain drafts. Timer continues closed and is controllable in history preview.
Trigger immediately before Share; panel nonmodal, no focus trap. Title Timer for
all roles. No timer actor/name/email on any client surface or announcement; remove
the attribution line and its reserved space, keeping8px between status/time block
and controls. Neither ticking nor timer commands change save status, Undo, document
export/history/canonical bytes or edited-at metadata. No timer disk persistence.
