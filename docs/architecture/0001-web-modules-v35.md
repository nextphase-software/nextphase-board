# 0001 — Web app modules

Note version: 35 (for 0007-W3 brief v1, 2026-11-10). Status: Draft.
Replaces [web modules v34](0001-web-modules-v34.md). Registry/import/composition
and one-state-owner guards remain. [Presence v3](0004-presence-v3.md),
[hosted storage v11](0003-hosted-storage-v11.md) and
[interaction v37](0001-interaction-v37.md) add exactly three team modules:

| Module | Responsibility |
| --- | --- |
| team/spotlight.ts | Dedicated page-memory controller: projections/versions, commands/reads/health, capability, offer/decline/dismiss/membership and once-only speech |
| team/spotlight-rules.ts | Pure phase/offer safety/countdown/leave/labels/placement/focus decisions; no React/Auth/server import |
| team/spotlight-layer.tsx | Single follow/spotlight banner, native controls/frame/presenter ring integration, measured collision inputs, focus and identified status region; no second session owner |

Exactly48 team modules (45+3), exactly22 state-hook modules; App.tsx remains
composition-only and at most264 lines. Minimal prop/composition wiring only,
never spotlight effects/state machine/protocol/geometry. No new state hook,
package/dependency/font/service/import exception. Off bundle remains free of
team/Supabase/spotlight inputs. Existing hook/document-edit boundaries remain.

New packages/board-sync/src/spotlight.ts owns neutral strict wire types/validators/
bounds, no web imports. New packages/board-room/src/spotlight.ts is the dedicated
room controller for authority/membership/projections/rebind/close/reconstruction
inside Room.ordered; room.ts integrates only dispatch/ordering/lifetime seams.
Existing session.ts owns separate spotlight transport/subscription; hosted-board
delegates without making edits/receipts/recovery queues own spotlight state.

Reuse team/presence.ts chooseFollow/fitFollow/grouping, hosted-board.ts manual
follow/reset, state/use-presence.ts latest exact-connection view application,
state/use-viewport.ts ownViewChange versus setFollowView. People and presence
layer compose presenter/target rings and single banner. Existing input/page-key/
selection/history seams delegate local leave/stop/preview signals before acting;
no spotlight state in document-edit hooks. Timer/voting controllers, workshop
panel, cursor preference and selection chrome retain their existing owners.
Update inventory/guards for the three named modules and two new server-test
includes only; do not relax composition/import/line/one-owner constraints.
