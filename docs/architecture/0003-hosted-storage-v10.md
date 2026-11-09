# 0003 — Hosted boards in the web app

CONTRACT VERSION: 0003 hosted storage v10 (2026-11-09)

Status: Draft for 0007-W2 v1. Replaces [hosted storage v9](0003-hosted-storage-v9.md).
All document drafts, Home/Trash/history/Comments, current4403/4423 behavior and
timer controller remain. [Voting v1](0007-workshop-voting-v1.md) owns exact states,
recipient data, health, words, focus, geometry and keyboard input. No local/off
voting controller, DOM or request; hosted solo use remains available.

Keep voting in its dedicated tab-memory controller and pure rules, never document
edit hooks/App.tsx/localStorage/IndexedDB. One pending mutation, Checking vote…,
2,000ms readback without resend,15,000ms reads/30,000ms freshness, labelled
last-confirmed uncertainty. Fresh snapshots reconcile split versions; ignore
obsolete board/account/connection/epoch/generation responses. Voting refusals do
not refuse/erase document pending edits. No optimistic cast or mutation replay.

Set-up draft, selector, local mode and confirmations are local. Shared panel
handoffs retain controller drafts, full reload resets them. Fresh role downgrade
removes own ballot/mode/input and joins as viewer while retaining timer rights.
Confirmed removal/sign-out/account/board change clears all protected voting state
before delayed replies.4423 preserves live round and local setup draft while
refreshing transport and reconciling targets. History preview suppresses voting
input/overlays but permits owner/editor reveal/clear and normal timer controls.

Timer and voting is a shared neutral shell: Timer card first, Voting/Results
second, single Close last in traversal. Timer controller/draft/focus stays its
owner. History/Comments/Share remain exclusive transient surfaces. Running
voting discards remote spatial presence and disables Follow, retains avatars and
show-cursors preference, and returns only fresh presence after reveal/reset.
No document/history/export/edited-at changes or persistent browser ballots.
