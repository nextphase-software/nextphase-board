# 0001 — Web app modules

Note version: 32 (for 0006-W4 brief v1, 2026-11-07). Status: Draft.
Replaces [web modules v31](0001-web-modules-v31.md); existing boundaries/history preview rules
remain. [Interaction v34](0001-interaction-v34.md), [hosted storage v8](0003-hosted-storage-v8.md)
and [lifecycle v2](0006-board-lifecycle-v2.md) define behaviour.

Exactly **37 team modules**: existing 34 plus three SPDX-bearing files:

| Module | Job |
| --- | --- |
| team/lifecycle.ts | Tab-memory lifecycle requests/results, immutable cycle/request identity, stale response guards, owner-state invalidation and cleanup; no disk persistence |
| team/trash.tsx | Workspace Trash list/rows/states and Move/Delete dialogs; exact copy/values/focus, same-ID Open board |
| team/lifecycle-rules.ts | Pure state/deadline/display helpers and local-time formatting reuse; no React/Auth/server import |

Existing team/links.ts owns the bounded TeamLink/parseLink change: add exactly
{kind:"trash",workspace:string} for #/files/<lowercase-UUID>/trash, with whole-fragment matching.
Reject missing/malformed/uppercase workspace IDs, trailing slash, query or extra segment; keep
all Home/board/invitation/local parsing unchanged. pages/team-app consumes the new route kind;
do not create a second parser inside Home or bypass parseLink. Focused coverage lives in the
new board-lifecycle unit file and browser direct-entry/reload checks.

Wire through existing Home/home-menu/home-card/home-lists/home-rules, links/pages/team-app,
hosted-board, history controller/panel and ui/board-panel. Sidebar rows use current workspace
ownership, separately from effective board role. Place Trash immediately below each owned
workspace row. No header Trash button; no extra global control. Keep Home/local markup outside
the named additions. Existing state/use-hosted-board/use-storage-session connect 4403's split:
fresh-authorized role-change reconnect keeps drafts; confirmed unavailability resets protected
state and returns Home. Keep existing nonterminal role-change paths and no automatic sends; no new hook. Keep exactly **22 state-hook modules**,
App.tsx unchanged and at most **264 lines**. Lifecycle work never moves into App.tsx.

Existing team/comments/layer/card/panel/rules, notifications/inbox/navigation/notices cooperate
only in clearing protected state and refusing stale delivery/painting; 4423 draft retention
stays. Existing history-rules remains the sole history shared-import exception. The new pure
lifecycle-rules imports no new package or server type; HTTP lifecycle shapes may be locally
specified against API v8. Keep the existing BoardSession import exception in hosted-board.
Module guards add precisely these three team names; no new import exception/dependency/config.

New room lifecycle.ts owns ordered admission/freeze/phase bridge through room.ts, not a second
queue. New server lifecycle.ts coordinates authoritative SQL work/runner discard; routes/lifecycle.ts
exposes API v8 routes. Existing adapters implement the same interface on Node/workerd. New
packages, UI fonts/icons, browser scenario tools in public source and a feature prototype are
not part of implementation. Off builds have no team/Supabase inputs and no lifecycle controls.
