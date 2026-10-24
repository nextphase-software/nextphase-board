# 0001 — Web app modules

Note version: 2 (for 0001-W16 brief v1, 2026-10-24). Status: Draft. When accepted it
replaces [web modules v1](0001-web-modules-v1.md) for later work. It describes how
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
note sets the target for the rest and the rules that keep the app there. 0001-W15
moved the screen parts around the canvas; 0001-W16 adds the object-type registry and
moves the canvas drawing.

## The target structure

The app has four layers and one composition file. Each layer may use the layers
listed above it, never the ones below.

| Layer | What it holds | Where | Rules |
| --- | --- | --- | --- |
| 1. Rules | Pure logic: the saved document, storage, history, selection, geometry, styles, view maths, arrangement, groups, clipboard, command reasons | `apps/web/src/*.ts` (for example `document.ts`, `history.ts`, `clipboard.ts`) | No React and no browser globals except where storage needs them; erasable TypeScript so the Node test runner can load them; every rule has unit tests under `tests/` |
| 2. State | The live board, history, selection, drafts, view, gestures and the actions that change them | Today inside `App.tsx`; later in hooks under `apps/web/src/state/` | Each piece of state has exactly one owner; other code changes it only through that owner's actions |
| 3. Object types | What each kind of object is called, which tool places it, and its colours on the canvas | `apps/web/src/objects/`: one module per type and `registry.ts` | Erasable TypeScript with unit tests; no React, react-konva or Konva; a new type adds a record; composition and screen parts ask the registry and never compare type names (rule 7) |
| 4. Screen parts | The bars, panels, menus and notice around the canvas; the canvas drawing, its overlays and the inline editor's container | `apps/web/src/ui/` for the regions around the canvas; `apps/web/src/scene/` for the canvas drawing, one body per way of drawing an object | Get everything through props; hold no state and run no effects of their own unless the brief that adds a part names the effect it may run; render exactly the markup and drawing they own |
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
| `objects/` (from 0001-W16) | Object types | `sticky.ts`, `text.ts` and `registry.ts`: names, labels, tools, canvas fill and edge colours, lookups by type and by tool |
| `ui/` (from 0001-W15) | Screen parts | File bar, save area, notice, board panel, objects panel, context bar with its colour and arrange menus, shared arrange controls, tool palette, zoom controls, information button and panel, navigation panel |
| `scene/` (from 0001-W16) | Screen parts | The canvas drawing (`board-drawing.tsx`), the shared body for stickies and text (`note-body.tsx`), group outlines, resize handles and the selection box (`overlays.tsx`), the inline editor's container (`inline-editor.tsx`) |
| `App.tsx` | Composition and, until moved, state | Everything not listed above: live state, effects, event handlers, object layouts, and the canvas element with its pointer and keyboard handlers |
| `main.tsx` | Entry | Mounts the app |

## Rules for every brief

1. **Name the modules.** A brief lists every module it may change or add. Anything
   else needs a new brief version.
2. **New screen code goes in a screen part.** A new region or control goes in a
   module under `ui/` (or `scene/` for canvas drawing, `objects/` for a type), never
   written inline in `App.tsx`.
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
7. **Ask the registry.** Composition and screen parts (`App.tsx`, `ui/` and
   `scene/`) never compare a type name; they ask the registry. A new object type adds
   its record to the registry and, if it draws differently from the existing bodies,
   its own body under `scene/`. Rules modules below the registry may keep per-type
   data they own and test (today the default sizes in `document.ts` and the text
   colour in `styles.ts`). A unit test looks for type-name comparisons in `App.tsx`,
   `ui/` and `scene/`.

## Planned steps

The structure is reached in small steps, each with no change in behaviour and each
reviewed on its own: screen parts (0001-W15, done); object types and the canvas
drawing (0001-W16); state hooks, including the canvas element's pointer and keyboard
handlers; then per-type saved data with the first new object type. This note is
updated as each step lands.
