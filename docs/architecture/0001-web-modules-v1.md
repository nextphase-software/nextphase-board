# 0001 — Web app modules

Note version: 1 (for 0001-W15 brief v1, 2026-10-24). Status: Draft. It describes how
the web app's source is organised, who owns what, and the rules every later brief
follows. It changes no behaviour, saved format or contract: [document v3](0001-document-v3.md),
[interaction v14](0001-interaction-v14.md), [storage v1](0001-storage-v1.md) and
[toolchain v1](0001-toolchain-v1.md) still govern what the app does.

## Why

Until 0001-W15, every screen, every piece of live state and every event handler
lived in one component, `apps/web/src/App.tsx`, which every feature edited. That
made changes harder to review and meant two features could not be built at the same
time without colliding. The rules (saving, undo history, selection, geometry,
arrangement, groups, copy and paste) were already in separate, tested modules. This
note sets the target for the rest and the rules that keep the app there.

## The target structure

The app has four layers and one composition file. Each layer may use the layers
listed above it, never the ones below.

| Layer | What it holds | Where | Rules |
| --- | --- | --- | --- |
| 1. Rules | Pure logic: the saved document, storage, history, selection, geometry, styles, view maths, arrangement, groups, clipboard, command reasons | `apps/web/src/*.ts` (for example `document.ts`, `history.ts`, `clipboard.ts`) | No React and no browser globals except where storage needs them; erasable TypeScript so the Node test runner can load them; every rule has unit tests under `tests/` |
| 2. State | The live board, history, selection, drafts, view, gestures and the actions that change them | Today inside `App.tsx`; later in hooks under `apps/web/src/state/` | Each piece of state has exactly one owner; other code changes it only through that owner's actions |
| 3. Object types | How each kind of object is drawn, labelled and created | Later under `apps/web/src/objects/`, one module per type | A new type adds a module; shared code never branches on a type name |
| 4. Screen parts | The bars, panels, menus and notice around the canvas | `apps/web/src/ui/`, one component per region | Get everything through props; hold no state and run no effects of their own; render exactly the markup they own |
| Composition | Calls the state, places the screen parts, owns the root keyboard dispatch | `apps/web/src/App.tsx` | Grows only by the lines needed to place a new part; otherwise only shrinks |

Dependency direction: composition → screen parts and object types → state → rules.
A rules module never imports React or a component; a screen part never imports
`App.tsx`.

## Where the code is now

| Module | Layer | Owns |
| --- | --- | --- |
| `document.ts`, `storage.ts` | Rules | The saved document versions, validation, fresh identifiers; local storage records |
| `history.ts` | Rules | Undo and redo steps |
| `selection.ts`, `group.ts` | Rules | Selection sets, box selection, bounding boxes; groups |
| `geometry.ts`, `resize.ts`, `view.ts` | Rules | Object heights and text layout; resizing; zoom and pan maths |
| `styles.ts`, `arrange.ts`, `clipboard.ts`, `commands.ts` | Rules | Colours and text styles; align, distribute, order; copy and paste; command availability |
| `icons.tsx` | Screen part | Icon glyphs |
| `ui/` (from 0001-W15) | Screen parts | File bar, save area, notice, board panel, objects panel, context bar with its colour and arrange menus, shared arrange controls, tool palette, zoom controls, information button and panel, navigation panel |
| `App.tsx` | Composition and, until moved, state | Everything not listed above: live state, event handlers, the canvas scene and its editor |
| `main.tsx` | Entry | Mounts the app |

## Rules for every brief

1. **Name the modules.** A brief lists every module it may change or add. Anything
   else needs a new brief version.
2. **New screen code goes in a screen part.** A new region or control goes in a
   module under `ui/` (or `objects/` for a type), never written inline in `App.tsx`.
   `App.tsx` gains at most the lines that place the new part and pass it what it
   needs.
3. **New rules go in a rules module with unit tests,** never in a component or in
   `App.tsx`.
4. **`App.tsx` may only shrink,** except for rule 2's placement lines. A unit test
   records its line budget; a brief that lowers it updates the budget, and no brief
   raises it by more than its placement lines.
5. **Two briefs in flight must not share a module,** except placement lines in
   `App.tsx`, which are small and are rebased by whichever lands second.
6. **Moves are moves.** A brief that restructures code without changing behaviour
   keeps identifiers, logic and order, changing only parameters and imports, so the
   change can be reviewed as moved code.

## Planned steps

The structure is reached in small steps, each with no change in behaviour and each
reviewed on its own: screen parts (0001-W15); object types and the canvas scene with
its editor (which measure and draw, so that step defines where they live and what
effects they may run); state hooks; then per-type saved data with the first new
object type. This note is updated as each step lands.
