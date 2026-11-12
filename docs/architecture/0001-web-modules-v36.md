# 0001 — Web app modules

Note version: 36 (for 0007-W4 brief v1, 2026-11-11). Status: Draft.
Replaces [web modules v35](0001-web-modules-v35.md), whose registry, import,
composition and one-state-owner guards remain word for word.
[Presence v4](0004-presence-v4.md) and [interaction v38](0001-interaction-v38.md)
add exactly three team modules:

| Module | Responsibility |
| --- | --- |
| team/reactions-rules.ts | Pure: the ordered id/name list, frame building and validation for the client, the client's 4-per-second throttle, wheel placement and clamping, slot geometry, the burst table and per-frame copy positions/opacity, reduced-motion variant, live-burst cap. No React, Auth or server import |
| team/reactions.ts | Page-memory controller: armed reaction, send through the hosted board, incoming `reacted` subscription, live bursts with board-space origins, clearing on session end/board change/access loss/voting start. No React import |
| team/reactions-layer.tsx | The palette Reactions button and wheel (the team tool passed to the palette, like the Comment tool), E key, armed pointer, and the burst renderer composed into the existing presence layer. No second controller |

Exactly 51 team modules (48 + 3) and exactly 22 state-hook modules. App.tsx is
not changed: it remains composition-only and at most 264 lines. The Reactions
button reaches the palette through the existing team-tool slot that carries the
Comment tool (`team-app.tsx` passes it; `ui/palette.tsx` renders it before
Comment), and bursts render through the existing presence layer
(`team/presence-layer.tsx`). `team/spotlight-layer.tsx` only asks the reaction
controller whether an event belongs to reactions (button, wheel, armed canvas
click or Enter, E, and Escape while the wheel is open or armed) and then does not
treat it as a local leave action or a spotlight Escape. No new state hook, package, dependency, font,
service or import exception. The off bundle remains free of team, Supabase and
reaction inputs.

New `packages/board-sync/src/reactions.ts` owns the neutral id list, strict wire
types, validators and bounds, with no web imports. New
`packages/board-room/src/reactions.ts` is the room controller for the budget,
voting gate, current-admission checks and relay inside Room.ordered; `room.ts`
only dispatches `react` beside `presence`. Existing `session.ts` sends `react`
and reports `reacted` to one subscriber; `team/hosted-board.ts` delegates to it
without making edits, receipts or recovery queues own reaction state.

Update the module inventory and guards for the three named modules and the new
server-test include only; add `reactions-rules.ts` to the no-React/no-Auth list.
Do not relax composition, import, line or one-owner constraints.
