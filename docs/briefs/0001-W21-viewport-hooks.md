BRIEF VERSION: 0001-W21 v1 (2026-10-25)
# 0001-W21 — Move the viewport into hooks

Status: Draft. Implementation starts only after the maintainer commits this brief
and [0001 web modules v7](../architecture/0001-web-modules-v7.md) to main.

## Outcome

The second of four steps that finish moving input and actions out of `App.tsx`
(web modules v7, "Planned steps"), with no change in behaviour:

- The **view** (pan and zoom), **wheel and trackpad zoom** and the **last pointer
  position** leave `App.tsx` for one hook, and the **canvas size** for a second hook,
  each called where its effect used to be, so every effect still runs in the same
  order.

Every element, attribute, measured position, focus move, drawn pixel and saved byte
stays as it is at `d455ec6`.

## Read first and prerequisite contracts

- [Contributor guidance](../../CONTRIBUTING.md), [agent instructions](../../AGENTS.md)
  and [engineering standards](../../DESIGN.md).
- [0001 web modules v7](../architecture/0001-web-modules-v7.md): the governing note;
  its rules are v3's, unchanged.
- [0001 interaction v14](../architecture/0001-interaction-v14.md),
  [0001 document v3](../architecture/0001-document-v3.md),
  [0001 storage v1](../architecture/0001-storage-v1.md) and
  [0001 toolchain v1](../architecture/0001-toolchain-v1.md): unchanged. No new
  dependency.
- [0001-W20 v1](0001-W20-editing-commands-hook.md): its comparison procedure is reused
  below.

## Deliverables and boundaries

All line numbers refer to `apps/web/src/App.tsx` at `d455ec6`.

1. **`apps/web/src/state/use-viewport.ts`**, exporting `useViewport(input)`. It holds,
   moved verbatim and in this order:
   - the `view` state with its setter (line 67, same initial value);
   - the `lastPointer` and `previousScale` refs (lines 88–89, same initial values);
   - the effect at lines 179–221 (wheel and trackpad pan and zoom, with its dependency
     list);
   - `trackPointer` (lines 388–391).

   Its input carries what those lines read from `App.tsx`: the `scene` and
   `inlineSurface` refs, the `inline` state, and the `drag` and `pending` refs, each
   typed as it is typed where it comes from. It returns `view`, `setView` and
   `trackPointer`.

2. **`apps/web/src/state/use-scene-size.ts`**, exporting `useSceneSize(scene)`, where
   `scene` is the canvas element's ref. It holds the `size` state with its setter (line
   68, same initial value) and the effect at lines 233–244, moved verbatim, and returns
   `size`.

   Both hooks import what the moved lines use from rules modules and nothing from
   `state/`, `ui/`, `scene/` or `App`.

3. **`App.tsx`:**
   - `view` and `size` leave the `useState` declarations at lines 60–71; `lastPointer`
     and `previousScale` leave the `useRef` declarations at lines 78–118.
   - At the place of the effect at lines 179–221, `App.tsx` calls
     `useViewport({ scene, inlineSurface, inline, drag, pending })`, destructuring
     `view`, `setView` and `trackPointer`; at the place of the effect at lines 233–244 it
     calls `useSceneSize(scene)`, taking `size`. Every use keeps its current name.
   - Lines 388–391 are removed. `pos` (256–259), `point` (381–387) and everything else
     stay where they are. `App.tsx` does not assign to the viewport's refs. Imports that
     are no longer used in `App.tsx` are removed.
   Nothing else changes.

4. **`tests/modules.test.mjs`**, as listed under validation.

**Effect order.** The two moved effects each run from a hook called at the effect's
current place, so the declared order of every effect in the app is the same as at
`d455ec6`. No other effect moves, is added or is removed. Moving `useState` and `useRef`
declarations into the hooks is allowed: nothing reads `view` before line 179 or `size`
before line 256.

**How the move is done** (web modules v7, "moves are moves"): expressions, effects,
dependency lists and their order move as they are; only where each name comes from
changes. No other module (rules modules, `ui/`, `scene/`, `objects/`, the six existing
hooks, `icons.tsx`, `main.tsx`), `style.css`, package file, lock, contract or existing
test other than `tests/modules.test.mjs` changes. If something seems to need more, stop
and report it.

New source files use `SPDX-License-Identifier: Apache-2.0`. Append the implementation
record below with the branch, validated revision, commands, results, the `App.tsx`
line counts before and after, and exclusions; report the final branch tip separately.

## Numbered acceptance criteria

- 0001-W21-AC01: The viewport lives in two hooks under apps/web/src/state/, each called where its effect was, with every effect in its original order and markup, focus, drawing and saved records identical to d455ec6.
- 0001-W21-AC02: Web modules v7 is published with the inventory updated and the rules unchanged; the guardrail test covers the eight state/ hooks, each new hook's single effect and a lowered App.tsx budget; the unit suite and browser checks pass unchanged.

| Criterion | Evidence that shows it |
| --- | --- |
| 0001-W21-AC01 | The two hooks exist with the contents listed above and are called where the effects were; the comparison under validation finds no difference |
| 0001-W21-AC02 | Web modules v7 is on main with this brief; `tests/modules.test.mjs` passes with the new checks and budget; the full unit suite and both browser fixture pages pass with no other test changed |

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
  `use-board-document.ts`, `use-context-bar.ts`, `use-editing-commands.ts`,
  `use-messages.ts`, `use-panel-layout.ts`, `use-scene-size.ts`,
  `use-storage-session.ts` and `use-viewport.ts` (the inventory test is updated to
  these eight; its other state checks stay as they are and now cover all eight files).
- **Each new hook holds one effect.** `use-viewport.ts` and `use-scene-size.ts` each
  contain exactly one match of `/\buseEffect\s*\(/` and no `useLayoutEffect`.

Reviewer checks (not run by the implementer; browsers cannot start there):

- **Regression harness.** The eight PASS lines at the fixture index page and at
  `regressions.html` ([tests README](../../tests/README.md)), in headless Chrome or a
  focused browser window.
- **Markup, focus and drawing comparison.** Scenarios A–F of the 0001-W20 v1 brief's
  comparison, under its conditions, recorded values, DOM actions and validity rules,
  plus scenario G below, on a build of `d455ec6` twice (the two must match exactly) and
  once on the candidate; the candidate must match at every checkpoint with no values
  set aside. "The canvas centre" is the centre of the canvas element's bounding
  rectangle. A wheel event is a bubbling, cancelable `WheelEvent` with the given
  `deltaX`, `deltaY`, `deltaMode` 0, modifier flags and client coordinates; a gesture
  event is a bubbling, cancelable `Event` with the given type and a `scale` property.
  - **G. Viewport.** In a fresh browser context, wait until ready. Name the board
    `Viewport` and choose Save; wait for "Locally saved". Place a sticky with the text
    `Alpha` (the Sticky tool, focus the canvas, Enter, set the text, Done).
    1. Dispatch on the canvas element a wheel event with `deltaY` 120 at the canvas
       centre. **Checkpoint G1.**
    2. Dispatch on the canvas element a wheel event with `deltaY` −120 and
       `ctrlKey: true`, 100 pixels right of and 50 pixels below the canvas centre.
       **Checkpoint G2.**
    3. Dispatch on the canvas element a bubbling `pointermove` with `pointerId` 1, 150
       pixels left of and 80 pixels above the canvas centre; then gesture events
       `gesturestart` (scale 1), `gesturechange` (scale 1.5) and `gestureend` (scale
       1.5) on the canvas element. **Checkpoint G3.**
    4. Choose "Zoom in" (`button[aria-label="Zoom in"]`). **Checkpoint G4.** Choose
       "Zoom out". **Checkpoint G5.**
    5. Open Navigation (`button[aria-label="Navigation"]`); choose "Pan left".
       **Checkpoint G6.** Choose "Reset view". **Checkpoint G7.** Choose "Close
       navigation".
    6. Open Objects, select `Alpha` in Objects' list, move focus to the canvas element
       with its `focus()` method and press Enter; the inline editor's container
       (`.inline`) must be present. Dispatch on `.inline` a wheel event with `deltaY`
       120 at its centre. **Checkpoint G8.** Dispatch on `.inline` a wheel event with
       `deltaY` −120 and `ctrlKey: true` at its centre. **Checkpoint G9.**
    7. Set the page's viewport to 1024 × 700 and wait two animation frames.
       **Checkpoint G10.** Set it back to 1280 × 800. **Checkpoint G11.**

    Wait 250 milliseconds and two animation frames after each action before a
    checkpoint.

No browser matrix, Safari check, fixtures sweep, accessibility audit or IME checks
unless the maintainer asks; the maintainer runs a full regression pass after the last
step of this move.

## Exclusions and reasons

Any change in behaviour or appearance; fixes for bugs noticed on the way (report
them); moving `pos`, `point`, the geometry edits, the pointer and keyboard handlers,
drag state, selection, panels, the read-only state or save status (later steps);
per-type saved data; new object types; rule changes in the web modules note; other
contract changes; new dependencies.

## Public references with retrieval dates

None beyond the repository's own documents.

## Implementation record

Not started.
