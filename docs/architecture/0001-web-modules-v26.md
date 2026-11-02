# 0001 — Web app modules

Note version: 26 (for 0004-W3 brief v1, 2026-11-02). Status: Draft. When accepted it replaces
[web modules v25](0001-web-modules-v25.md) for later work. It adds the modules that draw presence
on hosted boards and one state hook. Behaviour is in [interaction v26](0001-interaction-v26.md),
[0003 hosted storage v2](0003-hosted-storage-v2.md) and [0004 presence v1](0004-presence-v1.md).
Every rule of v25 (and through it v24 and v23) still applies except where this note changes it.

## Packages and programs

v25's table applies unchanged. No package, dependency or import of `nextphase-board-sync` is
added: presence reaches the web app through `BoardSession` in `team/hosted-board.ts`.

## The team modules

`apps/web/src/team/` holds exactly fifteen modules: v25's twelve and these three. Each starts
with `// SPDX-License-Identifier: Apache-2.0` and has one job:

| Module | Job |
| --- | --- |
| `presence.ts` | Pure presence rules: grouping connections into people and their first connection, the avatar order and overflow (three, or one below 768 CSS pixels), a person's colour, the pill words, the 250-ID cut, the presence to send from the pointer, view and scene size (with interaction v26's number limits), which connection a follow chooses, the follow fit, which refusals are presence refusals, and the stored switch's key |
| `people.tsx` | The people group and the people menu |
| `presence-layer.tsx` | The layer of other connections' cursors, pills and outlines, the follow frame and banner; it loads `state/use-presence.ts` |

`presence.ts` imports neither React nor `auth.ts`, so the unit tests import it directly.

`team/hosted-board.ts` keeps presence apart from the board: a separate presence snapshot (this
connection, the others, the followed connection, the switch) with its own subscription.
`present` and `left` notify only presence subscribers and never the board's; a presence refusal
(hosted storage v2) notifies no one. It sends this tab's presence through
`BoardSession.setPresence` and keeps the order in which it received presence from each
connection, for following.

`team/team-app.tsx` adds the people group and the presence layer to the team parts. `App`
receives them in the same optional prop as v25's parts: the people group as a node the save
panel shows before its status, and the presence layer as a component `App` renders over the
canvas with the scene, the selection, the displayed objects, the view, the scene size and the
follow setter. `App` does no presence work itself.

## State

`apps/web/src/state/` gains `use-presence.ts`: it sends this tab's presence (pointer, selection,
view, visibility), handles the cursor switch's shortcut and Escape while following, and moves the
view while following. The hooks become **twenty-two**.

`use-viewport.ts` returns two setters: `setView`, which every one of the person's own view
changes uses and which first calls an optional "own view change" callback (on a hosted board,
Stop following), and `setFollowView`, which only following uses and which calls nothing. On a
local board the callback is absent and `setView` behaves as in v25.

**One exception to "only `App.tsx` imports state hooks":** `team/presence-layer.tsx` imports
`state/use-presence.ts`, and no other module does (`App.tsx` included). This keeps the hook out of
a build with team features off, and keeps incoming presence from re-rendering `App`: presence
changes re-render only the layer and the people group, except a followed view change, which sets
the view.

`App.tsx` stays composition only, within a **264**-line budget.

## Guard tests

v25's guard tests apply, with these changes:

- `team/` holds exactly the fifteen modules above, each with the licence header;
- `state/` holds exactly the twenty-two hooks; `use-hosted-board.ts` still has exactly one
  passive effect;
- `state/use-presence.ts` is imported only by `team/presence-layer.tsx`; every other state hook
  is imported only by `App.tsx`, as before;
- `team/presence.ts` imports neither React nor `team/auth.ts`;
- the `App.tsx` budget is 264 lines;
- outside `team/` and `main.tsx`, a web source file still imports from `team/` only with
  `import type`.

## Planned steps

Home, creating and renaming hosted boards (0003-W5) add their modules to `team/` by amending this
note.
