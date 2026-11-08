# 0001 — Web app modules

Note version: 33 (for 0007-W1 brief v1, 2026-11-08). Status: Draft.
Replaces [web modules v32](0001-web-modules-v32.md). Its rules/import boundaries
remain; [timer v1](0007-workshop-timer-v1.md) and
[hosted storage v9](0003-hosted-storage-v9.md) add three team modules:

| Module | Responsibility |
| --- | --- |
| team/timer.ts | Dedicated tab-memory timer controller, socket subscription/commands/readback, current response epochs, panel/focus/title lifecycle and protected clearing |
| team/timer-rules.ts | Pure input/state/display/monotonic-offset rules, no React/Auth/server import |
| team/timer-panel.tsx | Trigger/panel/inline confirmation, exact styles/words/semantics/focus |

Exactly40 team modules (37+3), exactly 22 state-hook modules. App.tsx unchanged,
at most264 lines; timer state/logic never enters App.tsx or document-edit hooks.
TeamParts gains optional timerControl; ui/save-area renders it immediately before
team.saveControl (Share). TeamApp composes controller/panel only for hosted board.
Existing hosted-board/session handle timer frames separately from document edits;
history/Comments/Share controllers cooperate only in exclusive surface handoff.
Use the existing BoardSession import exception, no new shared-import exception.

New pure packages/board-sync/src/timer.ts owns browser/server-neutral wire types,
strict validation and state/clock bounds; new packages/board-room/src/timer.ts
owns transactional persistence and the single room queue integration. These do
not depend on web, browser globals or Auth. Existing session.ts offers separate
timer subscriptions/read/command transport without waiting/edit retries. Timer
clock rendering remains in timer-rules, not document-edit hooks. No new hook,
package/dependency/font/config other than the brief's two server-test includes.
Module guards retain all existing rules and add exactly these three team names.
