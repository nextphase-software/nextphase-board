BRIEF VERSION: 0001-W24 v1 (2026-10-25)
# 0001-W24 — Move selection, object layouts, the editor and panels into hooks

Status: Implemented. Independently reviewed at `fa0d1da` (pass) and merged into main
on 2026-10-25 with [0001 web modules v10](../architecture/0001-web-modules-v10.md). The
implementation record below, which lists the validated revisions, was written before
that review.

## Outcome

The first of two steps that finish the staged move out of `App.tsx` (web modules v10,
"Planned steps"), with no change in behaviour:

- The **selection** values and the style summaries leave `App.tsx` for a hook that owns
  the selected set.
- The **object layouts and resize handles**, with the text measurement they use, leave
  for a second hook.
- **Where the text editor opens and the panels** leave for a third hook, which owns the
  open panel and holds the last three effects in `App.tsx`, in their order and at their
  place among the app's effects.

Every element, attribute, focus move, drawn pixel and saved byte stays as it is at
`25d2d74`. The second step settles who owns the remaining state and element refs and
leaves `App.tsx` as composition only.

## Read first and prerequisite contracts

- [Contributor guidance](../../CONTRIBUTING.md), [agent instructions](../../AGENTS.md)
  and [engineering standards](../../DESIGN.md).
- [0001 web modules v10](../architecture/0001-web-modules-v10.md): the governing note;
  its rules are v3's, unchanged.
- [0001 interaction v14](../architecture/0001-interaction-v14.md),
  [0001 document v3](../architecture/0001-document-v3.md),
  [0001 storage v1](../architecture/0001-storage-v1.md) and
  [0001 toolchain v1](../architecture/0001-toolchain-v1.md): unchanged. No new
  dependency.
- [0001-W23 v1](0001-W23-pointer-keyboard-hooks.md): its comparison procedure is reused
  below.

## Deliverables and boundaries

All line numbers refer to `apps/web/src/App.tsx` at `25d2d74`.

1. **`apps/web/src/state/use-selection.ts`**, exporting `useSelection(input)`, with no
   effects.
   - It **owns `selected`**: the `useState` for `selected` and `setSelected` (line 62)
     moves into it unchanged.
   - It holds, moved verbatim and in this order: `selectedObjects`, `selectionKey`,
     `selectedId`, `item` and `text` (lines 112–116), then `commonStyle`,
     `selectionColor`, `selectionSize`, `selectionAlign` and `colourLabel` (147–152).
   - Inputs: `board` and `drafts` from `useBoardDocument`.
   - It returns `selected`, `setSelected`, `selectionKey`, `selectedId`, `item`, `text`,
     `selectionColor`, `selectionSize`, `selectionAlign` and `colourLabel`.
2. **`apps/web/src/state/use-object-layouts.ts`**, exporting `useObjectLayouts(input)`, with
   no effects.
   - At module level it holds `CORNERS` (line 45) and the function `lineCount` (48–59),
     moved verbatim, with the Konva import `lineCount` needs.
   - Inside the hook it holds, moved verbatim and in this order: `objectLayouts`
     (117–131), `displayedObjects`, `bounds`, `selectedGroups`, `numbers`,
     `handlesVisible`, `handlePoints` and `posForCorner` (132–146), then `itemHeight`
     (153).
   - Its inputs:
     - from `useBoardDocument`: `board`;
     - from `useSelection`: `selected`, `selectedId`, `item` and `text`;
     - from `App.tsx`: `inline`, `tool`, `readOnly`, `composing`, `busy` and `drag`.
   - It returns `lineCount`, `objectLayouts`, `displayedObjects`, `bounds`,
     `selectedGroups`, `numbers`, `handlesVisible`, `handlePoints` and `itemHeight`.
   - It may declare local types with the same shapes as `App.tsx`'s `ResizeStart` (line
     46) and the drag ref's type (lines 91–111), for `drag`'s input type.
3. **`apps/web/src/state/use-editor-placement.ts`**, exporting `useEditorPlacement(input)`.
   - It **owns `panel`**: the `useState` for `panel` and `setPanel` (line 65) and the
     `fallbackFocus` ref (line 154) move into it unchanged, before everything else.
   - It holds, moved verbatim and in this order:
     - the effect at lines 190–192 (focus the inline editor);
     - the effect at 193–200 (focus inside Objects when it opens);
     - `fallbackEditor` (213–218) and `edit` (219–224);
     - the effect at 225–243 (fall back to Objects when the inline editor cannot fit);
     - `toggle` (244–258).
   - Every effect keeps its dependency list.
   - Its inputs:
     - from `useBoardDocument`: `finishTextSession`;
     - from `useViewport`: `view`;
     - from `useSceneSize`: `size`;
     - from `useSelection`: `selected` and `item`;
     - from `useObjectLayouts`: `itemHeight`;
     - from `App.tsx`: `inline`, `setInline`, `composing`, `busy`, `readOnly`, `pos`,
       `editor`, `selector`, `objectsButton`, `boardButton`, `infoButton` and
       `navButton`.
   - It returns `panel`, `setPanel`, `edit` and `toggle`.
4. **Pure helpers stay as they are for now.** `posForCorner` and `commonStyle` need
   neither the DOM nor React, so web modules rule 8 places such calculations in rules
   modules with unit tests. Like `pos`, they move here unchanged. The next step moves all
   three into rules modules with tests, as recorded in web modules v10's "Planned steps".
   This step changes no rules module and adds no test beyond the guardrails below.
5. **Hook inputs and imports.** Each input is typed as it is typed where it comes from.
   Each hook imports what its moved lines use from rules modules (and, for the layouts
   hook, `konva`), and nothing from `state/`, `ui/`, `scene/` or `App`.
6. **`App.tsx`:**
   - Lines 45, 48–59, 62 (the `selected` entry), 65 (the `panel` entry), 112–154,
     190–200 and 213–258 are removed. The remaining `useState` declarations keep their
     order.
   - At the place of line 112 (after the drag ref), `App.tsx` calls `useSelection({ … })`
     and then `useObjectLayouts({ … })`, destructuring the returned names.
   - `pos` (201–204) moves up, unchanged, to directly after the `useSceneSize` call
     (line 189). Directly after it, at the place of line 190, `App.tsx` calls
     `useEditorPlacement({ … })`, destructuring `panel`, `setPanel`, `edit` and `toggle`.
   - Every use keeps its name. `ResizeStart` (line 46), the drag ref, `select`, the
     validity values, `pending`, the Content field and everything else stay where they
     are. Imports that are no longer used in `App.tsx` are removed.

   Nothing else changes.
7. **`tests/modules.test.mjs`**, as listed under validation.

**Effects.** The three effects at lines 190–200 and 225–243 move into
`useEditorPlacement`, in their order, all passive. No other `useEffect` or
`useLayoutEffect` moves, and none is added or removed. Today only `pos`,
`useGeometryEdits` (which holds no effects), `fallbackEditor` and `edit` sit between the
second and third of them, so calling the hook at the place of line 190 keeps each effect's
position in the passive phase. `useSelection` and `useObjectLayouts` hold no effects.

**How the move is done** (web modules v10, "moves are moves"): expressions, functions,
statements and their order move as they are. Only where each name comes from changes,
plus the stated reorderings: the style summaries come up next to the selection values,
`pos` moves up before the editor placement call, and the two `useState` entries leave the
list at the top. No other module (rules modules, `ui/`, `scene/`, `objects/`, the eleven
existing hooks, `icons.tsx`, `main.tsx`), `style.css`, package file, lock, contract or
existing test other than `tests/modules.test.mjs` changes. If something seems to need
more, stop and report it.

New source files use `SPDX-License-Identifier: Apache-2.0`. Append the implementation
record below with the branch, validated revision, commands, results, the `App.tsx`
line counts before and after, and exclusions; report the final branch tip separately.

## Numbered acceptance criteria

- 0001-W24-AC01: The selection values, the object layouts and handles, and the editor placement and panels with the last three effects live in three hooks under apps/web/src/state/, with every effect in its order and markup, focus, drawing and saved records identical to 25d2d74.
- 0001-W24-AC02: Web modules v10 is published with the inventory and plan updated and the rules unchanged; the guardrail test covers the fourteen state/ hooks, the new hooks' effects and a lowered App.tsx budget; the unit suite and browser checks pass unchanged.

| Criterion | Evidence that shows it |
| --- | --- |
| 0001-W24-AC01 | The hooks exist with the contents listed above; the editor placement hook holds exactly the three effects and the other two none; the comparison under validation finds no difference |
| 0001-W24-AC02 | Web modules v10 is on main with this brief; `tests/modules.test.mjs` passes with the new checks and budget; the full unit suite and both browser fixture pages pass with no other test changed |

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
  `use-editing-commands.ts`, `use-editor-placement.ts`, `use-geometry-edits.ts`,
  `use-messages.ts`, `use-object-layouts.ts`, `use-page-keys.ts`, `use-panel-layout.ts`,
  `use-scene-size.ts`, `use-selection.ts`, `use-storage-session.ts` and
  `use-viewport.ts` (the inventory test is updated to these fourteen; its other state
  checks stay as they are and now cover all fourteen files).
- **The editor placement hook holds exactly three passive effects.**
  `use-editor-placement.ts` contains `useEffect(` exactly three times and does not
  contain `useLayoutEffect`.
- **The selection and layouts hooks hold no effects.** `use-selection.ts` and
  `use-object-layouts.ts` contain neither `useEffect` nor `useLayoutEffect`.

Reviewer checks (not run by the implementer; browsers cannot start there):

- **Regression harness.** The eight PASS lines at the fixture index page and at
  `regressions.html` ([tests README](../../tests/README.md)), in headless Chrome or a
  focused browser window.
- **Markup, focus and drawing comparison.** Scenarios A–I of the 0001-W23 v1 brief's
  comparison, under its conditions, recorded values, DOM actions and validity rules,
  plus scenario J below. Run them on a build of `25d2d74` twice (the two must match
  exactly) and once on the candidate; the candidate must match at every checkpoint, with
  no values set aside.

  In scenario J, clicks, double-clicks, drags, wheel turns and keys are **real mouse and
  keyboard input** from the browser automation. "Choose" a button means a real click at
  the centre of its box, after scrolling it into view. "The board point (x, y)" is defined
  as in scenario I and holds while the view is at its start; step 8 changes the view and
  ends by resetting it before step 9.

  - **J. Editor placement and panels.** In a fresh browser context, wait until ready.
    Name the board `Panels`, choose Save, wait for "Locally saved", and close the board
    name panel with its button.
    1. With the Sticky tool, click the board point (−300, −150); set the inline editor's
       text to `Alpha` and choose Done. With the Text tool, click (100, −150); set the text
       to `Beta` and choose Done. **Checkpoint J1.**
    2. Choose each panel's button twice, taking a checkpoint after each click: Objects
       (**J2**, **J3**), the board name button (**J4**, **J5**), About local storage
       (**J6**, **J7**) and Navigation (**J8**, **J9**).
    3. Click (−300, −150). Move focus to the canvas element with its `focus()` method and
       press Enter. **Checkpoint J10** (inline editor open). Choose Done.
    4. Hold Shift, click (100, −150), release Shift. **Checkpoint J11** (both selected;
       colour "Mixed"). Move focus to the canvas element and press Enter. **Checkpoint J12**
       ("Select one object to edit its text.").
    5. Choose Objects, then "Group" in its Arrange section. **Checkpoint J13** (both
       listed in Group 1). Choose Objects to close it.
    6. Choose the Sticky tool. **Checkpoint J14** (handles hidden). Choose the Select tool.
    7. Click the empty board point (−460, 100). Double-click (−300, −150). **Checkpoint
       J15** (inline editor on Alpha). Resize the window to 700 × 800. **Checkpoint J16**
       (Objects open, focus on Content). Resize it to 1280 × 800. **Checkpoint J17.**
       Choose Objects to close it.
    8. Click (−460, 100) and double-click (−300, −150). With the pointer at (−300, −150)
       and Control held, turn the wheel by 120 (one step down). **Checkpoint J18**
       (inline editor still open). Turn it once more. **Checkpoint J19** (Objects open,
       focus on Content). Release Control. Choose Objects to close it; choose Navigation,
       "Reset view" and Navigation again. **Checkpoint J20.**
    9. Choose the Sticky tool and click (0, 260), so that the new sticky's editor overlaps
       the tool palette. **Checkpoint J21** (Objects open, focus on Content).
    10. Open the board name panel if it is closed, choose Save and wait for "Locally
        saved"; read the saved head record as in scenario A and compare it the same way.

    Wait 250 milliseconds and two animation frames after each action before a
    checkpoint.

No browser matrix, Safari check, fixtures sweep, accessibility audit or IME checks
unless the maintainer asks; the maintainer runs a full regression pass after the last
step of this move.

## Exclusions and reasons

Any change in behaviour or appearance; fixes for bugs noticed on the way (report them);
moving or re-owning the remaining state (`selectionBox`, `tool`, `inline`, `readOnly`,
`status`, `busy`, `spacePan`, `composing`), the element refs, the drag ref and
`ResizeStart`, `select`, the validity values, `pending`, the Content field or the command
and notice reasons (the last step); turning `pos`, `posForCorner` or `commonStyle` into
rules functions (the last step, with unit tests); per-type saved
data; new object types; rule changes in the web modules note; other contract changes; new
dependencies.

## Public references with retrieval dates

None beyond the repository's own documents.

## Implementation record

Not started.

### 2026-10-25 — Implementation and non-browser validation

- Branch: `codex/0001-W24-selection-editor`, based on committed main
  `0504c5684e9c9260d5a6c205c1c7d56e4dcea296`, which contains this v1 brief and
  web modules v10. The preceding "Not started" entry is superseded by this record.
- Validated source/test revision: `7c7cdf8ba3c3121b1025b87789047604228f4a9d`
  (`refactor(web): extract selection layouts and editor hooks`). The requested
  install, typecheck, tests and builds ran on identical source/test contents
  immediately before that commit.
  Only this implementation record changes afterward; the final branch tip is
  reported separately in the handoff.
- `useSelection` owns `selected` and its setter, derives the selection values and
  shared styles in the specified order, takes only `board` and `drafts`, and has
  no effects. `commonStyle` is unchanged and remains local as required.
- `useObjectLayouts` holds `CORNERS`, Konva text measurement, the memoized layouts,
  displayed objects, bounds, groups, numbers, resize handles and selected height.
  It has no effects; its memo dependencies and local `posForCorner` are unchanged.
  Its drag-ref input and local `ResizeStart` have the original shapes.
- `useEditorPlacement` owns `panel` and `fallbackFocus`, then holds the two focus
  effects, `fallbackEditor`, `edit`, the fallback effect and `toggle`, in that
  order. All three effects remain passive with their exact dependency lists.
  Its call follows `useSceneSize` and the unchanged `pos`; `useGeometryEdits`
  remains immediately afterward with no effects, preserving passive-phase order.
- Every new hook has the Apache-2.0 SPDX header and imports only React, rules
  and, for layouts, Konva. No existing hook changes. The remaining state, refs,
  drag type, `select`, validity values, `pending`, Content field, command and
  notice reasons, and markup remain in `App.tsx` as required.
- `App.tsx` newline count: **452 before, 349 after**. The literal guardrail
  budget is **349**; the recursive inventory and existing state checks cover
  all fourteen hooks. Two new guardrails enforce the three passive editor
  placement effects and the absence of effects in selection and layouts.
- A one-off source comparison passed: reversing only the permitted moves,
  imports and state-declaration punctuation restores `App.tsx` byte-for-byte
  to `25d2d74`. This checks the moved bodies, effect dependencies and order,
  and all remaining code and markup. State initializers and the full drag-ref
  type also match. An initial comparison-script assertion rejected drag-type
  indentation; correcting its whitespace normalization passed without changing
  application code or tests. This is source evidence, not browser equivalence.

Commands ran from the repository root with the existing pinned distribution
selected in `PATH` before every Node/npm invocation and the commit's hooks.
No machine-specific path is recorded.

| Exact command | Result |
| --- | --- |
| `node --version` | Exit 0; `v24.22.1` |
| `npm --version` | Exit 0; `11.19.1` |
| `npm --prefix apps/web ci --ignore-scripts --no-audit --no-fund` | Exit 0; 19 packages installed |
| `npm --prefix apps/web run typecheck` | Exit 0; no diagnostics |
| `node --test tests/modules.test.mjs` | Exit 0; 23 passed, 0 failed, 0 skipped |
| `npm --prefix apps/web test` | Exit 0; 264 passed, 0 failed, 0 skipped |
| `npm --prefix apps/web run build` | Exit 0; application built; accepted lock, runtime inventory and complete distributed notices verified |
| `npm --prefix apps/web run build:fixtures` | Exit 0; disposable fixtures built; accepted lock, runtime inventory and complete distributed notices verified |
| `git diff --check` | Exit 0; no whitespace errors in implementation diff |
| `git diff --cached --check` | Exit 0; no whitespace errors in staged implementation diff |
| `git commit -m 'refactor(web): extract selection layouts and editor hooks'` | Exit 0; validated revision above created; both public-boundary hooks passed. Git also emitted a `packed-refs.lock` permission error; the commit and branch ref were verified afterward. No hook was bypassed |
| `git rev-parse HEAD refs/heads/codex/0001-W24-selection-editor` | Exit 0; both refs match the validated source/test revision above |
| `git diff --name-only main...HEAD` | Exit 0 after source/test commit; exactly `apps/web/src/App.tsx`, the three new hooks and `tests/modules.test.mjs`. The final handoff additionally includes this brief's implementation record |
| `git status --short` | Exit 0; clean after source/test commit |

Dependencies added: **none**. Package manifests, locks, rules, other modules,
styles, contracts and other existing tests are unchanged. Web modules v10 was
already committed on main. Generated build outputs and installed dependencies
are ignored and uncommitted. No stash, push or merge.

Not run, per maintainer instruction and the environment's browser limitation:
any browser or browser regression harness, either fixture page's runtime checks,
and the W23 A–I plus W24 J markup/focus/drawing/saved-record comparisons against
two `25d2d74` baseline runs and the candidate. These remain for the independent
reviewer. No browser matrix, Safari, accessibility, native IME, performance/load
or unrelated acceptance sweep was run. Fixture compilation does not establish
browser fixture passes. Browser-dependent parts of AC01 and AC02 remain pending.

Graph architecture and indexing were attempted first; both were unavailable
because the tools required approval under a never-approve policy. Direct file
reads were used as the discovery fallback. Independent review and browser
acceptance remain pending; this handoff does not authorize merging or another
milestone.
