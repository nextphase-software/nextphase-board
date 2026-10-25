BRIEF VERSION: 0001-W25 v1 (2026-10-25)
# 0001-W25 — Make App.tsx composition only

Status: Draft. Implementation starts only after the maintainer commits this brief
and [0001 web modules v11](../architecture/0001-web-modules-v11.md) to main.

## Outcome

The last step of the staged move out of `App.tsx` (web modules v11, "Planned steps"),
with no change in behaviour and no effect moved:

- The remaining plain state and element refs get owners: three new state hooks, and
  the existing context bar, viewport and editor placement hooks for the refs only they
  and the markup use.
- Validity and the command and notice reasons move into two hooks.
- The pure helpers `pos`, `posForCorner` and `commonStyle` become rules functions with
  unit tests, and one types-only module replaces the copies of the drag and resize types.
- The Content field becomes a screen part.
- A guard test keeps `App.tsx` from creating state, refs, memos or effects of its own.

After this step `App.tsx` holds only hook calls, `select`, a one-line `pos`, the Content
field element and the markup. Every element, attribute, focus move, drawn pixel and saved
byte stays as it is at `fa0d1da`.

## Read first and prerequisite contracts

- [Contributor guidance](../../CONTRIBUTING.md), [agent instructions](../../AGENTS.md)
  and [engineering standards](../../DESIGN.md).
- [0001 web modules v11](../architecture/0001-web-modules-v11.md): the governing note.
  Its rules are v3's, except that rule 8 is amended by one sentence: a named helper that
  needs neither the DOM nor React always goes to a rules module, while a value derived
  inline from a hook's inputs and state may stay in the hook.
- [0001 interaction v14](../architecture/0001-interaction-v14.md),
  [0001 document v3](../architecture/0001-document-v3.md),
  [0001 storage v1](../architecture/0001-storage-v1.md) and
  [0001 toolchain v1](../architecture/0001-toolchain-v1.md): unchanged. No new
  dependency.
- [0001-W24 v1](0001-W24-selection-layouts-editor-hooks.md): its comparison procedure is
  reused below.

## Deliverables and boundaries

Line numbers refer to `apps/web/src/App.tsx` at `fa0d1da` unless a file is named.
"Verbatim" means the statements move as they are; only where each name comes from
changes.

1. **Three state hooks, with no effects.** Each owns the `useState` and `useRef` calls
   below, created with the same initial values and types as today, and returns every
   value, setter and ref:
   - **`apps/web/src/state/use-session-status.ts`**, `useSessionStatus()`: `readOnly` and
     `status` (lines 49–50).
   - **`apps/web/src/state/use-gesture-state.ts`**, `useGestureState()`: `selectionBox`,
     `tool`, `busy` and `spacePan` (lines 46–47, 51–52), and the refs `scene` (60),
     `spacePanRef` (69) and `drag` (73–93, typed `Drag | null` from item 5).
   - **`apps/web/src/state/use-text-entry.ts`**, `useTextEntry()`: `inline` and
     `composing` (lines 48, 53).

   None takes an input.
2. **Existing hooks create the refs only they and the markup use**, and return them:
   - `use-context-bar.ts` creates `contextBar`, `colourControl`, `colourButton`,
     `swatches`, `arrangeControl`, `arrangeButton` and `arrangeMenu` (lines 61–67) at the
     start of the hook. They leave its `Input` type and are added to its return.
   - `use-viewport.ts` creates `inlineSurface` (line 68) at the start of the hook. It
     leaves `Input` and is added to the return.
   - `use-editor-placement.ts` creates `editor`, `selector`, `objectsButton` (lines
     70–72), `boardButton`, `navButton` and `infoButton` (104–106) directly after
     `fallbackFocus`. They leave `Input` and are added to the return.

   Nothing else in these hooks changes.
3. **`apps/web/src/state/use-validity.ts`**, `useValidity(input)`, with no effects. It
   holds lines 108–125 verbatim, including `pending` and its per-render assignment.
   - Inputs: `board`, `drafts` and `title` from `useBoardDocument`; `composing` from
     `useTextEntry`; `busy` from `useGestureState`.
   - Returns `invalidObjectText`, `invalidFields`, `invalid` and `pending`.
4. **`apps/web/src/state/use-command-reasons.ts`**, `useCommandReasons(input)`, with no
   effects. It holds lines 197–207 and then 217–218 verbatim, in that order.
   - Inputs: `readOnly`; `composing`; `busy` and `tool`; `invalidObjectText` and
     `invalid`; `textSession`, `model` and `history`; `selected`; `visibleMessage`;
     `snapshots`; `displayedObjects`. Each comes from the hook that provides it today.
   - Returns `commandReason`, `undoReason`, `redoReason`, `selectionReason`,
     `clipboardState`, `showNotice`, `editingState` and `arrangementMembers`.
5. **Rules modules.**
   - **`apps/web/src/gesture.ts`** (new, types only) exports `ResizeStart` (the shape at
     line 43) and `Drag` (the object type inside the drag ref, lines 74–92). It imports
     only types and has no runtime code.
   - These local copies are removed and the types imported from `gesture.ts` instead:
     `ResizeStart` in `App.tsx`, `use-viewport.ts`, `use-canvas-input.ts`,
     `use-object-layouts.ts` and `use-geometry-edits.ts`; the drag-ref type in
     `use-viewport.ts`, `use-canvas-input.ts` and `use-object-layouts.ts`. Each `drag`
     input there becomes `RefObject<Drag | null>`.
   - `view.ts` gains `export function screenPoint(o: { x: number; y: number }, view: View,
     size: Size)`, whose body is `pos`'s object expression (lines 140–141).
   - `resize.ts` gains `export function cornerPoint(corner: Corner, rectangle: Rectangle)`,
     with `posForCorner`'s body from `use-object-layouts.ts`. The layouts hook imports
     it, spreads `cornerPoint(corner, bounds)` where it spread `posForCorner(corner,
     bounds)`, and drops `posForCorner`.
   - `styles.ts` gains `export function commonStyle<K extends keyof Style>(objects:
     readonly Style[], key: K): Style[K] | ""`. Its body is the selection hook's
     `commonStyle` with `selectedObjects` replaced by `objects`. The selection hook
     imports it, calls `commonStyle(selectedObjects, "color")` (and likewise for
     `"textSize"` and `"align"`), and drops its local `commonStyle`.
6. **`apps/web/src/ui/content-field.tsx`**, exporting `ContentField(props)`. It renders
   the fragment at lines 167–195 verbatim, with the same handlers.
   - It takes as props what that markup reads: `editor`, `inline`, `text`, `readOnly`,
     `busy`, `item`, `selectedId`, `composing`, `beginTextSession`, `changeText`,
     `setComposing`, `setDrafts`, `commitText`, `finishTextSession` and `setInline`. Each
     is typed as at its source.
   - It imports `count` and `validText` from `document.ts`, and React only as types.
7. **`App.tsx`:**
   - Lines 43, 46–53, 60–93, 104–106, 108–125, 166–196, 197–207 and 217–218 are removed.
   - At the place of line 46 it calls `useSessionStatus()`, `useGestureState()` and
     `useTextEntry()`, in that order. At the place of line 108 it calls `useValidity`.
   - `pos` (139–142) becomes
     `const pos = (o: { x: number; y: number }) => screenPoint(o, view, size);`.
   - `nativeEditor` becomes `const nativeEditor = <ContentField … />;` with the props
     above. It is still passed to `ObjectsPanel` and `InlineEditor` as today.
   - At the place of line 197 it calls `useCommandReasons`.
   - The context bar, viewport and editor placement calls lose the ref inputs and
     destructure the refs they now return.
   - Every use keeps its name. `select`, the order of every existing hook call, and the
     markup stay as they are. Imports no longer used are removed, including the `react`
     import.

   Nothing else changes.
8. **Tests.** Unit tests for `screenPoint` in `tests/view.test.mjs`, `cornerPoint` in
   `tests/resize.test.mjs` and `commonStyle` in `tests/styles.test.mjs`, as listed under
   validation, and `tests/modules.test.mjs`.

**Effects.** No `useEffect` or `useLayoutEffect` moves, is added or is removed; the
declared order of every effect is the same as at `fa0d1da`. The five new hooks hold none.

**How the move is done** (web modules v11, "moves are moves"): statements move as they
are, and only where each name comes from changes. The exceptions are those stated above:
the three helpers become rules functions with the stated signatures, `commonStyle` takes
its objects as a parameter, the duplicated types are imported, the refs are created
inside their owners, and the Content field becomes a component.

No other module changes: no other `ui/` or `scene/` part, `objects/`, the other hooks,
other rules modules, `icons.tsx`, `main.tsx`, `style.css`, package files, locks,
contracts or other tests. If something seems to need more, stop and report it.

New source files use `SPDX-License-Identifier: Apache-2.0`. Append the implementation
record below with the branch, validated revision, commands, results, the `App.tsx`
line counts before and after, and exclusions; report the final branch tip separately.

## Numbered acceptance criteria

- 0001-W25-AC01: App.tsx creates no state, ref, memo or effect of its own; the remaining state and refs, validity and the reasons live in hooks, the three helpers in rules modules, the drag and resize types in one types-only module and the Content field in a screen part, with markup, focus, drawing and saved records identical to fa0d1da.
- 0001-W25-AC02: Web modules v11 is published with App.tsx recorded as composition only, the plan marked done and rule 8 amended to allow values derived inline in a hook; the guardrail test covers the nineteen state/ hooks, the thirteen screen parts, the composition-only check and a lowered App.tsx budget; the three rules functions have unit tests; the unit suite and browser checks pass.

| Criterion | Evidence that shows it |
| --- | --- |
| 0001-W25-AC01 | The modules exist with the contents listed above; the composition-only check passes; the comparison under validation finds no difference |
| 0001-W25-AC02 | Web modules v11 is on main with this brief; `tests/modules.test.mjs` and the three unit test files pass with the new checks; the full unit suite and both browser fixture pages pass |

## Validation commands and expected evidence

From the repository root with the pinned toolchain:

```sh
npm --prefix apps/web ci --ignore-scripts --no-audit --no-fund
npm --prefix apps/web run typecheck
node --test tests/modules.test.mjs tests/view.test.mjs tests/resize.test.mjs tests/styles.test.mjs
npm --prefix apps/web test
npm --prefix apps/web run build
npm --prefix apps/web run build:fixtures
git diff --name-only main...HEAD
```

The full unit suite runs here because code shared by every feature moves.

**Unit tests added:**

- `screenPoint`:
  - at `{ x: 0, y: 0, z: 1 }` with size `{ w: 1000, h: 800 }`, the point `(0, 0)` maps to
    `{ left: 500, top: 400 }`;
  - at `{ x: 100, y: -50, z: 2 }`, the point `(150, 0)` maps to `{ left: 600, top: 500 }`.
- `cornerPoint`: for the rectangle `{ x: 10, y: 20, width: 30, height: 40 }`, `nw`, `ne`,
  `sw` and `se` give `(10, 20)`, `(40, 20)`, `(10, 60)` and `(40, 60)`.
- `commonStyle`:
  - two objects with the same colour give that colour;
  - different colours give `""`;
  - an empty list gives `""`;
  - `"textSize"` and `"align"` behave the same way.

`tests/modules.test.mjs` keeps its existing checks and changes or adds:

- **Line budget.** The literal budget for `App.tsx` becomes its newline count after this
  change.
- **Screen parts.** The screen-parts inventory becomes thirteen modules, adding
  `content-field.tsx`. The existing screen-part checks (no React state, React imported
  only as types, the licence header, no `App` import, no type-name comparisons) cover it.
- **State hooks.** Listing `apps/web/src/state/` recursively finds exactly the fourteen
  current hooks plus `use-command-reasons.ts`, `use-gesture-state.ts`,
  `use-session-status.ts`, `use-text-entry.ts` and `use-validity.ts`. That is nineteen,
  listed alphabetically; the other state checks stay and now cover all nineteen.
- **The new hooks hold no effects.** None of the five new files contains `useEffect` or
  `useLayoutEffect`. The existing effect-count checks for the viewport (one) and editor
  placement (three) hooks stay as they are.
- **App.tsx is composition only.** The test defines a helper,
  `compositionProblems(source)`, that returns a list of problems. It asserts that the list
  is empty for `App.tsx`. A problem is any of:
  - an `import` from `"react"` that is not `import type` (the same pattern as the
    screen-parts check);
  - a call matching `/\buse[A-Z]\w*\s*(?:<[^()]*?>)?\s*\(/` (calls with a type argument
    included) whose name is not imported from a `./state/` module;
  - a value import from any module other than a `./state/` module whose imported name
    or local name matches `/^use[A-Z]/`.

  The test also checks the helper on seven fixed source strings. Each problem kind has a
  sample that only that kind catches, so the helper cannot pass with any check missing:
  - `import { createElement } from "react";` yields a problem (only the `react` rule
    applies);
  - `import { useThing as thing } from "./ui/thing";` yields a problem (only the
    imported-name rule applies);
  - the call `useThing<number>();` alone, with no import, yields a problem (only the
    call rule applies);
  - `import { useSelection } from "./state/use-selection";` followed by the calls
    `useSelection();` and then `useOther();` yields a problem (the call rule, continuing
    past an allowed call);
  - `import { useThing } from "./ui/thing";` followed by a call `useThing<number>();`
    yields a problem;
  - `import type { CSSProperties } from "react";` yields none;
  - `import { useSelection } from "./state/use-selection";` followed by a call
    `useSelection<number>({});` yields none.

Reviewer checks (not run by the implementer; browsers cannot start there):

- **Regression harness.** The eight PASS lines at the fixture index page and at
  `regressions.html` ([tests README](../../tests/README.md)), in headless Chrome or a
  focused browser window.
- **Markup, focus and drawing comparison.** Scenarios A–J of the 0001-W24 v1 brief's
  comparison, unchanged, under its conditions, recorded values, DOM actions and validity
  rules. Run them on a build of `fa0d1da` twice (the two must match exactly) and once on
  the candidate. The candidate must match at every checkpoint, with no values set aside.

No browser matrix, Safari check, fixtures sweep, accessibility audit or IME checks
unless the maintainer asks; the maintainer runs a full regression pass after this step.

## Exclusions and reasons

- Any change in behaviour or appearance.
- Fixes for bugs noticed on the way (report them).
- Moving `select` or changing what any hook does.
- Rewriting validity or the reasons as rules functions.
- Other contract changes, per-type saved data, new object types and new dependencies.

## Public references with retrieval dates

None beyond the repository's own documents.

## Implementation record

Not started.
