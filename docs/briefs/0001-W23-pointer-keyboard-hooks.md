BRIEF VERSION: 0001-W23 v1 (2026-10-25)
# 0001-W23 — Move the pointer and keyboard handlers into hooks

Status: Draft. Implementation starts only after the maintainer commits this brief
and [0001 web modules v9](../architecture/0001-web-modules-v9.md) to main.

## Outcome

The fourth of five steps that finish moving input and actions out of `App.tsx`
(web modules v9, "Planned steps"), with no change in behaviour:

- The **canvas input** (the pointer helpers, the window blur and key-up effect, the
  read-only effect, and the canvas element's key, pointer and double-click handlers)
  leaves `App.tsx` for a hook under `apps/web/src/state/`, called where the helpers
  were. The two effects keep their order and their place among the app's effects.
- The **page's key handler** (the shortcuts handled on the page's `main` element) leaves
  `App.tsx` for a second hook, with no effects, called after the editing commands hook
  whose commands it uses.

The drag and gesture state stays in `App.tsx` and is passed in; a later step settles who
owns it. Every element, attribute, focus move, drawn pixel and saved byte stays as it is
at `b2dc288`.

## Read first and prerequisite contracts

- [Contributor guidance](../../CONTRIBUTING.md), [agent instructions](../../AGENTS.md)
  and [engineering standards](../../DESIGN.md).
- [0001 web modules v9](../architecture/0001-web-modules-v9.md): the governing note;
  its rules are v3's, unchanged.
- [0001 interaction v14](../architecture/0001-interaction-v14.md),
  [0001 document v3](../architecture/0001-document-v3.md),
  [0001 storage v1](../architecture/0001-storage-v1.md) and
  [0001 toolchain v1](../architecture/0001-toolchain-v1.md): unchanged. No new
  dependency.
- [0001-W22 v1](0001-W22-geometry-edits-hook.md): its comparison procedure is reused below.

## Deliverables and boundaries

All line numbers refer to `apps/web/src/App.tsx` at `b2dc288`.

1. **`apps/web/src/state/use-canvas-input.ts`**, exporting `useCanvasInput(input)`.
   It holds, moved verbatim and in this order:
   - `point` (lines 260–266), `releaseCapture` (267–271), `endSpacePan` (272–281) and
     `cancel` (282–292);
   - the effect at lines 293–309 (window `blur` and `keyup`), keeping its empty
     dependency list, so it still calls the `cancel` and `endSpacePan` of the first
     render, as today;
   - the effect at lines 341–344 (read-only);
   - the canvas element's handlers, each an inline arrow function today, as named
     functions with the same bodies, in markup order: `sceneKeyDown` (the `onKeyDown` at
     lines 448–469), `pointerDown` (470–556), `pointerMove` (557–590), `pointerUp`
     (591–636), `doubleClick` (637–649), `pointerCancel` (650–654) and
     `lostPointerCapture` (655–661).

   Each named handler takes the parameter its arrow takes, typed as React infers it on
   the canvas element: `e: React.KeyboardEvent<HTMLDivElement>` for `sceneKeyDown`,
   `e: React.PointerEvent<HTMLDivElement>` for the three pointer handlers,
   `e: React.MouseEvent<HTMLDivElement>` for `doubleClick`; `pointerCancel` and
   `lostPointerCapture` take none. These are the `React` namespace types, as `App.tsx`
   writes `React.CSSProperties`; the `keyup` listener inside the first effect keeps the
   DOM `KeyboardEvent` it uses today.

   The hook may declare local types with the same shapes as `App.tsx`'s `ResizeStart`
   (line 47) and the drag ref's type (lines 92–112), for the signatures that use them.

   Its input carries what those lines read from `App.tsx`:
   - from `useBoardDocument`: `model`, `commit`, `setBoard`, `clearHistory` and
     `finishTextSession`;
   - from `useViewport`: `setView` and `trackPointer`;
   - from `useMessages`: `setMessage`;
   - from `useGeometryEdits`: `create`, `resizeStart`, `resizeStillValid`, `resizedBoard`
     and `movedBoard`;
   - from `App.tsx`: `scene`, `view`, `size`, `drag`, `busy`, `setBusy`, `spacePanRef`,
     `setSpacePan`, `setSelectionBox`, `selected`, `select`, `tool`, `setTool`,
     `readOnly`, `composing`, `inline`, `setInline`, `setPanel`, `handlesVisible`,
     `handlePoints`, `objectLayouts`, `displayedObjects` and `edit`.

   That is 36 inputs, each typed as it is typed where it comes from. The hook returns
   `cancel` and the seven handlers. It imports what the moved lines use from rules
   modules and `objects/registry`, and nothing from `state/`, `ui/`, `scene/` or `App`.

2. **`apps/web/src/state/use-page-keys.ts`**, exporting `usePageKeys(input)`, with no
   effects. It holds the `onKeyDown` arrow function on `main` (lines 380–432) as the
   named function `pageKeyDown(e: React.KeyboardEvent<HTMLElement>)`, with the same body.

   Its input:
   - from `useEditingCommands`: `command` and `clipboardCommand`;
   - from `useBoardDocument`: `model`;
   - from `useCanvasInput`: `cancel`;
   - from `App.tsx`: `scene`, `busy`, `composing`, `select`, `setInline`, `panel`,
     `setPanel`, `objectsButton`, `boardButton`, `infoButton` and `navButton`.

   That is 15 inputs, typed as at their source. It returns `pageKeyDown` and imports
   nothing from `state/`, `ui/`, `scene/` or `App`.

3. **`App.tsx`:**
   - Lines 260–309 and 341–344 are removed. The `nativeEditor` element between them
     stays where it is.
   - At the place of line 260 (after `toggle`), `App.tsx` calls `useCanvasInput({ … })`
     with the inputs above, destructuring `cancel` and the seven handlers.
   - After the `useEditingCommands` call (line 372), before `return`, `App.tsx` calls
     `usePageKeys({ … })`, destructuring `pageKeyDown`.
   - In the markup, `main` gets `onKeyDown={pageKeyDown}` in place of its arrow function.
     The canvas element gets `onKeyDown={sceneKeyDown}`, `onPointerDown={pointerDown}`,
     `onPointerMove={pointerMove}`, `onPointerUp={pointerUp}`,
     `onDoubleClick={doubleClick}`, `onPointerCancel={pointerCancel}` and
     `onLostPointerCapture={lostPointerCapture}`, each in its current attribute position.
     `onPointerEnter={trackPointer}` stays.
   - The `panView` and `zoomView` imports, unused since 0001-W21, are removed, as are
     imports this change leaves unused.
   - The drag and gesture state (`drag`, `busy`, `spacePan`, `spacePanRef`,
     `selectionBox`), `pos`, `toggle`, `fallbackEditor`, `edit`, the inline-editor
     effect, `handlesVisible`, `handlePoints`, `ResizeStart`, `lineCount` and everything
     else stay where they are.

   Nothing else changes.

4. **`tests/modules.test.mjs`**, as listed under validation.

**Effects.** The two effects above move into `useCanvasInput`, in their order. No other
`useEffect` or `useLayoutEffect` moves, and none is added or removed. Between line 260
and line 344 nothing else declares an effect or calls a hook, so calling the hook at the
place of line 260 keeps each effect's position in the passive phase. `usePageKeys` holds
no effects, and nothing between `useEditingCommands` and `return` declares one.

**How the move is done** (web modules v9, "moves are moves"): expressions, functions,
statements and their order move as they are. Only where each name comes from changes,
plus the stated change of each inline handler into a named function. No other module
(rules modules, `ui/`, `scene/`, `objects/`, the nine existing hooks, `icons.tsx`,
`main.tsx`), `style.css`, package file, lock, contract or existing test other than
`tests/modules.test.mjs` changes. If something seems to need more, stop and report it.

New source files use `SPDX-License-Identifier: Apache-2.0`. Append the implementation
record below with the branch, validated revision, commands, results, the `App.tsx`
line counts before and after, and exclusions; report the final branch tip separately.

## Numbered acceptance criteria

- 0001-W23-AC01: The pointer helpers, the window blur and key-up and read-only effects and the canvas handlers live in a canvas input hook, and the page key handler in a page keys hook, under apps/web/src/state/, with every effect in its order and markup, focus, drawing and saved records identical to b2dc288.
- 0001-W23-AC02: Web modules v9 is published with the inventory and plan updated and the rules unchanged; the guardrail test covers the eleven state/ hooks, the new hooks' effects and a lowered App.tsx budget; the unit suite and browser checks pass unchanged.

| Criterion | Evidence that shows it |
| --- | --- |
| 0001-W23-AC01 | The hooks exist with the contents listed above; the canvas input hook holds exactly the two effects and the page keys hook none; the comparison under validation finds no difference |
| 0001-W23-AC02 | Web modules v9 is on main with this brief; `tests/modules.test.mjs` passes with the new checks and budget; the full unit suite and both browser fixture pages pass with no other test changed |

## Validation commands and expected evidence

From the repository root with the pinned toolchain:

```sh
npm --prefix apps/web ci --ignore-scripts --no-audit --no-fund
npm --prefix apps/web run typecheck
node --test tests/modules.test.mjs
npm --prefix apps/web test
npm --prefix apps/web run build
npm --prefix apps/web run build:fixtures
git diff --name-only main...HEAD
```

The full unit suite runs here because code shared by every feature moves.

`tests/modules.test.mjs` keeps its existing checks and changes or adds:

- **Line budget.** The literal budget for `App.tsx` becomes its newline count after
  this change.
- **State hooks.** Listing `apps/web/src/state/` recursively finds exactly
  `use-board-document.ts`, `use-canvas-input.ts`, `use-context-bar.ts`,
  `use-editing-commands.ts`, `use-geometry-edits.ts`, `use-messages.ts`,
  `use-page-keys.ts`, `use-panel-layout.ts`, `use-scene-size.ts`,
  `use-storage-session.ts` and `use-viewport.ts` (the inventory test is updated to these
  eleven; its other state checks stay as they are and now cover all eleven files).
- **The canvas input hook holds exactly two passive effects.** `use-canvas-input.ts`
  contains `useEffect(` exactly twice and does not contain `useLayoutEffect`.
- **The page keys hook holds no effects.** `use-page-keys.ts` contains neither
  `useEffect` nor `useLayoutEffect`.

Reviewer checks (not run by the implementer; browsers cannot start there):

- **Regression harness.** The eight PASS lines at the fixture index page and at
  `regressions.html` ([tests README](../../tests/README.md)), in headless Chrome or a
  focused browser window.
- **Markup, focus and drawing comparison.** Scenarios A–H of the 0001-W22 v1 brief's
  comparison, under its conditions, recorded values, DOM actions and validity rules,
  plus scenario I below. Run them on a build of `b2dc288` twice (the two must match
  exactly) and once on the candidate; the candidate must match at every checkpoint, with
  no values set aside.

  In scenario I, presses, drags, clicks and keys are **real mouse and keyboard input**
  from the browser automation. A drag is a press, a move in four equal steps, and a
  release. "The board point (x, y)" means the screen point at the canvas centre plus
  (x, y) pixels, which holds while the view is at its start (x 0, y 0, zoom 100%); steps
  9–11 change the view and press only at the canvas centre.

  - **I. Gestures and page keys.** In a fresh browser context, wait until ready. Name
    the board `Gestures` and choose Save; wait for "Locally saved".
    1. Choose the Sticky tool, then press and release the mouse without moving at the
       board point (−300, −150); set the inline editor's text to `Alpha` and choose Done.
       In the same way, place `Beta` with the Sticky tool at (60, −150), and `Gamma` with
       the Text tool at (−120, 150). **Checkpoint I1.**
    2. Drag from the empty board point (−140, 40) by (100, −80), and before releasing
       take **Checkpoint I2**. Release. **Checkpoint I3** (Beta selected).
    3. Hold Shift. Drag from (−140, 40) by (−100, 80). **Checkpoint I4** (Gamma added).
       Click (−300, −150). **Checkpoint I5** (Alpha added). Click (60, −150).
       **Checkpoint I6** (Beta removed). Release Shift.
    4. Click (−140, 40). **Checkpoint I7** (nothing selected). Double-click (60, −150).
       **Checkpoint I8** (inline editor open on Beta). Choose Done.
    5. Drag from (−300, −150) by (40, 30), and before releasing take **Checkpoint I9**.
       Press Escape, then release. **Checkpoint I10** (Alpha back in place).
    6. Drag from (60, −150) by (40, 30) without releasing; dispatch a bubbling
       `pointercancel` event (`pointerId` 1) on the canvas element; release.
       **Checkpoint I11** (Beta back in place).
    7. Move focus to the canvas element with its `focus()` method before each of these
       keys, and take a checkpoint after each: Control+A (**I12**), Control+D (**I13**),
       Delete (**I14**), Control+Z (**I15**), Control+Y (**I16**).
    8. Open Objects, move focus to its "Add sticky" button with `focus()`, and press
       Escape. **Checkpoint I17** (panel closed, focus on the Objects button).
    9. Move focus to the canvas element; hold Space; drag from the canvas centre by
       (100, 50), and before releasing take **Checkpoint I18**. Release, then release
       Space. **Checkpoint I19**.
    10. Move focus to the canvas element; hold Space; drag from the canvas centre by
        (60, 40) without releasing; dispatch a `blur` event on `window`; release, then
        release Space. **Checkpoint I20** (the view as at I19).
    11. Choose the Pan tool; drag from the canvas centre by (−80, −60). **Checkpoint
        I21.**
    12. Open the board name panel if it is closed, choose Save and wait for "Locally
        saved"; read the saved head record as in scenario A and compare it the same way.

    Wait 250 milliseconds and two animation frames after each action before a
    checkpoint.

No browser matrix, Safari check, fixtures sweep, accessibility audit or IME checks
unless the maintainer asks; the maintainer runs a full regression pass after the last
step of this move.

## Exclusions and reasons

Any change in behaviour or appearance; fixes for bugs noticed on the way (report them),
including the first-render values the window blur and key-up effect uses; moving or
re-owning the drag and gesture state, selection, panels, `toggle`, the inline editor's
routing, the read-only state or save status (the last step); moving `pos`,
`ResizeStart` or `lineCount`; merging or reordering handlers; per-type saved data; new
object types; rule changes in the web modules note; other contract changes; new
dependencies.

## Public references with retrieval dates

None beyond the repository's own documents.

## Implementation record

Not started.
