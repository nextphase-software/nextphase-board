# 0001 — Web app modules

Note version: 12 (for 0016-W1 brief v1, 2026-10-25). Status: Draft. When accepted it
replaces [web modules v11](0001-web-modules-v11.md) for later work. Its rules are v11's,
except that rule 7 is amended: it loses its two exceptions (the default sizes in
`document.ts` and the text colour in `styles.ts`), so everything that differs by object
type lives in that type's record, and it now covers rules modules too. The dependency
direction gains one sentence: object types use `styles.ts`, and rules modules may ask the
registry. "Why", the object types' row in the target structure, "Where the code is now"
and "Planned steps" are also updated. It
describes how the web app's source is organised, who owns what, and the rules every
later brief follows. It changes no behaviour, saved format or contract:
[document v3](0001-document-v3.md), [interaction v14](0001-interaction-v14.md),
[storage v1](0001-storage-v1.md) and [toolchain v1](0001-toolchain-v1.md) still govern
what the app does.

## Why

Until 0001-W15, every screen, every piece of live state and every event handler
lived in one component, `apps/web/src/App.tsx`, which every feature edited. That
made changes harder to review and meant two features could not be built at the same
time without colliding. The rules (saving, undo history, selection, geometry,
arrangement, groups, copy and paste) were already in separate, tested modules. This
note sets the target for the rest and the rules that keep the app there. 0001-W15
moved the screen parts around the canvas; 0001-W16 added the object-type registry and
moved the canvas drawing; 0001-W17 started the state layer with the panel layout and
the context bar; 0001-W18 moved the board document and the messages; 0001-W19 moved
the storage session; 0001-W20 moved the editing commands; 0001-W21 moved the
viewport; 0001-W22 moved the geometry edits; 0001-W23 moved the pointer and keyboard
handlers; 0001-W24 moved the selection, the object layouts and where the text editor
opens with the panels; 0001-W25 gives the remaining state and element refs their owners
and leaves `App.tsx` as composition only. 0016-W1 moves each object type's default size
and style, the style an old board gets on upgrade, and its text colour into the type's
record, so a new type no longer needs edits in the save code.

## The target structure

The app has four layers and one composition file. The dependency direction below the
table says which may use which; in short, everything may use rules, and only the
composition file uses state.

| Layer | What it holds | Where | Rules |
| --- | --- | --- | --- |
| 1. Rules | Pure logic: the saved document, storage, history, selection, geometry, styles, view maths, arrangement, groups, clipboard, command reasons | `apps/web/src/*.ts` (for example `document.ts`, `history.ts`, `clipboard.ts`) | No React and no browser globals except where storage needs them; erasable TypeScript so the Node test runner can load them; every rule has unit tests under `tests/` |
| 2. State | The live board, history, selection, drafts, view, gestures, panel layout, the context bar and its menus, and the actions that change them | Hooks under `apps/web/src/state/` (from 0001-W17; all of it from 0001-W25) | Each piece of state has exactly one owner; other code changes it only through that owner's actions; see rule 8 |
| 3. Object types | What each kind of object is called, which tool places it, its default size and style, the style an object saved before styles existed gets, and its colours on the canvas (fill, edge and text) | `apps/web/src/objects/`: one module per type and `registry.ts` | Erasable TypeScript with unit tests; no React, react-konva or Konva; a new type adds a record; composition, screen parts and rules modules ask the registry and never name a type (rule 7) |
| 4. Screen parts | The bars, panels, menus and notice around the canvas; the canvas drawing, its overlays and the inline editor's container | `apps/web/src/ui/` for the regions around the canvas; `apps/web/src/scene/` for the canvas drawing, one body per way of drawing an object | Get everything through props; hold no state and run no effects of their own unless the brief that adds a part names the effect it may run; render exactly the markup and drawing they own |
| Composition | Calls the state, places the screen parts and attaches the handlers the state returns to the elements that receive the events | `apps/web/src/App.tsx` | Grows only by the lines needed to place a new part; otherwise only shrinks |

Dependency direction: composition (`App.tsx`) uses everything below it; state hooks use
rules; screen parts (`ui/`, `scene/`) use object types and rules; object types use
rules. Only composition uses state (rule 8). Among the rules modules, object types use
only `styles.ts`, which never imports them; other rules modules may ask the registry
(from 0016-W1, `document.ts` does), so there is no import cycle.
A rules module never imports React or a component; a screen part never imports
`App.tsx`.

## Where the code is now

| Module | Layer | Owns |
| --- | --- | --- |
| `document.ts`, `storage.ts` | Rules | The saved document versions, validation, fresh identifiers (asking the registry for the list of types and each type's defaults, from 0016-W1); local storage records |
| `history.ts` | Rules | Undo and redo steps |
| `selection.ts`, `group.ts` | Rules | Selection sets, box selection, bounding boxes; groups |
| `geometry.ts`, `resize.ts`, `view.ts` | Rules | Object heights and text layout; resizing and corner points; zoom and pan maths and where a board point sits on screen |
| `gesture.ts` (from 0001-W25) | Rules (types only) | The shape of a pointer gesture in progress and of a resize's starting rectangles |
| `styles.ts`, `arrange.ts`, `clipboard.ts`, `commands.ts` | Rules | Colours and text styles, and the style a set of objects shares; align, distribute, order; copy and paste; command availability |
| `context-bar-position.ts` (from 0001-W17) | Rules | Where the context bar sits and whether it fits |
| `notice-message.ts` (from 0001-W18) | Rules | Which messages the notice shows and which it hides (save acknowledgements and the routine storage message) |
| `state/` (from 0001-W17) | State | `use-panel-layout.ts` (where the notice and panels start), `use-context-bar.ts` (the bar's measured width and the colour and arrange menus), `use-board-document.ts` (from 0001-W18: the board, its board name and drafts, the undo history, the text editing session, the revision counter, the canvas adapter and the changes that record history), `use-messages.ts` (from 0001-W18: the current message and the last save acknowledgement), `use-storage-session.ts` (from 0001-W19: the writer lock, opening a board, recovery snapshots, saving, reopening, and pausing editing when the page is hidden), `use-editing-commands.ts` (from 0001-W20: undo, redo, duplicate, delete, copy, cut and paste with the object clipboard, align, distribute, order, group, and text styles), `use-viewport.ts` (from 0001-W21: the view, wheel and trackpad pan and zoom, and the last pointer position used to zoom around it), `use-scene-size.ts` (from 0001-W21: the canvas size, measured on load and on window resize), `use-geometry-edits.ts` (from 0001-W22: creating, moving and resizing objects, and changing and committing their text), `use-canvas-input.ts` (from 0001-W23: the canvas element's key, pointer and double-click handlers, the pointer helpers, cancelling a gesture, and the effects that end a gesture when the window loses focus or Space is released and when the board becomes read-only), `use-page-keys.ts` (from 0001-W23: the page's keyboard shortcuts), `use-selection.ts` (from 0001-W24: the selected objects, the single selected object and its text, and the selection's shared colour, size and alignment), `use-object-layouts.ts` (from 0001-W24: measuring object text, drawn heights, the selection's bounds, group outlines and numbers, and the resize handles) `use-editor-placement.ts` (from 0001-W24: which panel is open, opening and closing panels, opening the inline editor, moving focus into it or into Objects, and falling back to Objects when the inline editor cannot fit; from 0001-W25 also the text editor, the Objects list and the panel buttons' elements), `use-session-status.ts` (from 0001-W25: the read-only state and the save status), `use-gesture-state.ts` (from 0001-W25: the armed tool, whether a gesture is in progress, Space-held panning, the selection box, the canvas element and the gesture being dragged), `use-text-entry.ts` (from 0001-W25: whether the inline editor is open and whether text is being composed), `use-validity.ts` (from 0001-W25: which fields are invalid and the values the storage and viewport hooks read while a save is pending) and `use-command-reasons.ts` (from 0001-W25: why each command is unavailable, and whether the notice shows). From 0001-W25 the context bar hook also owns its elements, and the viewport hook the inline editor's surface |
| `icons.tsx` | Screen part | Icon glyphs |
| `objects/` (from 0001-W16) | Object types | `sticky.ts`, `text.ts` and `registry.ts`: names, labels, tools, default sizes and styles and the style a version 1 object gets on upgrade (from 0016-W1), canvas fill, edge and text colours (text colour from 0016-W1), lookups by type and by tool |
| `ui/` (from 0001-W15) | Screen parts | File bar, save area, notice, board panel, objects panel, the Content field (from 0001-W25), context bar with its colour and arrange menus, shared arrange controls, tool palette, zoom controls, information button and panel, navigation panel |
| `scene/` (from 0001-W16) | Screen parts | The canvas drawing (`board-drawing.tsx`), the shared body for stickies and text (`note-body.tsx`), group outlines, resize handles and the selection box (`overlays.tsx`), the inline editor's container (`inline-editor.tsx`) |
| `App.tsx` | Composition | Calls the hooks in order and places the screen parts, passing each what it needs; `select`, the one action of its own, which changes the selection and closes the context bar's menus; `pos`, which passes the view and canvas size to `screenPoint`. A unit test checks that it creates no state, ref, memo or effect of its own |
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
7. **Ask the registry.** Composition, screen parts and rules modules (`App.tsx`, `ui/`,
   `scene/` and `apps/web/src/*.ts`) never compare a type name or keep a table keyed by
   type; they ask the registry. Everything that differs by type lives in its record
   under `objects/` (amended in v12: v11 let the default sizes stay in `document.ts`
   and the text colour in `styles.ts`). A new object type adds its record to the
   registry and, if it draws differently from the existing bodies, its own body under
   `scene/`. Unit tests look for type-name comparisons in `App.tsx`, `ui/` and
   `scene/`, and for any use of a type name in the rules modules.
8. **State hooks.** A hook under `state/` owns the state it holds and returns values
   and actions; it takes what it needs as parameters (no React context, no state
   library). React runs all layout effects and then all passive effects, each phase in
   the order the effects are declared; a hook that holds effects is called where those
   effects were, keeping each effect's kind (layout or passive) and its position
   within its phase. Calculations that need neither the DOM nor React (such as where
   the context bar sits) go to rules modules with unit tests: a named helper function
   always does, while a value derived inline from a hook's inputs and state may stay
   in the hook (amended in v11); measuring the DOM and
   deriving a hook's own flags from its state (such as whether a menu is open) stay in
   the hook. Only `App.tsx` imports from `state/`; no other module does, hooks do not
   import each other, and hooks never import `App.tsx`, `ui/` or `scene/`.

## Planned steps

The structure is reached in small steps, each with no change in behaviour and each
reviewed on its own: screen parts (0001-W15, done); object types and the canvas
drawing (0001-W16, done); state hooks in three parts, safest first: panel layout and
the context bar (0001-W17, done); then the board and storage, in two steps (the board
document and messages, 0001-W18, done; then the storage session, 0001-W19, done); then
input and actions in five steps (the editing commands, 0001-W20, done; the viewport,
0001-W21, done; the geometry edits, 0001-W22, done; the pointer and keyboard
handlers, 0001-W23, done; then the last part in two steps: the selection, object
layouts, the editor and panels, 0001-W24, done; then owners for the remaining state and
element refs, the pure helpers as rules functions, the Content field as a screen part
and the composition-only check, 0001-W25, done). With that the staged move is complete.
Then each object type's rules move into its record (0016-W1). Next come rich text and
the first new object type, which follow these rules from the start. This note is
updated as each step lands.
