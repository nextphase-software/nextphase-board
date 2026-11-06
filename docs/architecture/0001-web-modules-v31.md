# 0001 — Web app modules

Note version: 31 (for 0006-W3 brief v1, 2026-11-06). Status: Draft.
Replaces [web modules v30](0001-web-modules-v30.md); its imports/state boundaries remain except
for these additions. Behaviour: [interaction v33](0001-interaction-v33.md),
[hosted storage v7](0003-hosted-storage-v7.md), [lifecycle v1](0006-board-lifecycle-v1.md).

## History modules and wiring

Exactly **34** team modules: the previous 31 plus these three SPDX-bearing files:

| Module | Job |
| --- | --- |
| `team/history.ts` | Tab-memory history controller, immutable requests, selection/head/access races and separate read-only document; no disk storage |
| `team/history-panel.tsx` | History rows, preview/status bar, dialogs, exact copy, local timestamp formatter, focus and key controls |
| `team/history-rules.ts` | Pure metadata/retention/display helpers, no React/Auth; only this new web module may import/re-export `nextphase-board-sync/history.ts` |

Wire through existing team-app/hosted-board, Home/home-menu/home-card and board-panel.
Existing ui/palette.tsx may distinguish history preview from ordinary hosted readOnly: retain
the full effective-editor toolbar and Templates in place but disable all actions except Pan;
zoom works separately. Existing state/use-hosted-board must explicitly set Pan on historical
preview entry and preserve it through that tab’s return-current/restore-rejoin, overriding its generic
forced-Select branch only for this handoff. Pan is pressed, disabled Select is not; a later
explicit current-board tool choice is respected. Ordinary viewer/guest palettes, current boards and team-off/local
palettes retain their existing controls/behaviour. No permission relaxation or App.tsx change.
Use the existing state/use-storage-session hook only to accept the hosted read-only preview
and return fresh live content; state/use-hosted-board and team/comments/layer/card may connect
the single panel slot and retained drafts. Existing hosted-board owns session/Undo reset and
stopped following; no history job moves into App.tsx. Keep exactly **22** state-hook modules;
App.tsx remains unchanged and at most **264 lines**. No other import exception is added.

Shared `packages/board-sync/src/history.ts` defines pure metadata/request/display shapes;
current edit generation/retry changes stay in session.ts. Room `history.ts` owns capture,
retention and restore journal, working through room.ts's existing ordered queue; it cannot
bypass authorization/transactions by an ordinary edit flag. Server routes/history.ts owns
API v7's five history routes. Existing runtimes connect the same room on both runners.
No new package/dependency/configuration. Module guards update the exact 34-name list,
the one history-rules import exception and hook name/version expectations only. Off builds
must contain no team or Supabase inputs; local markup/data behaviour remains unchanged.
