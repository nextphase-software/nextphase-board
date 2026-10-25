BRIEF VERSION: 0001-W22 v1 (2026-10-25)
# 0001-W22 — Move the geometry edits into a hook

Status: Draft. Implementation starts only after the maintainer commits this brief
and [0001 web modules v8](../architecture/0001-web-modules-v8.md) to main.

## Outcome

The third of five steps that finish moving input and actions out of `App.tsx`
(web modules v8, "Planned steps"), with no change in behaviour:

- The **geometry edits** (creating an object, moving and resizing the selection, and
  changing and committing an object's text) leave `App.tsx` for a hook under
  `apps/web/src/state/`.
- **No effect moves.** The hook holds none, so the order in which React runs the app's
  effects cannot change.

Every element, attribute, focus move, drawn pixel and saved byte stays as it is at
`a054b8a`.

## Read first and prerequisite contracts

- [Contributor guidance](../../CONTRIBUTING.md), [agent instructions](../../AGENTS.md)
  and [engineering standards](../../DESIGN.md).
- [0001 web modules v8](../architecture/0001-web-modules-v8.md): the governing note;
  its rules are v3's, unchanged.
- [0001 interaction v14](../architecture/0001-interaction-v14.md),
  [0001 document v3](../architecture/0001-document-v3.md),
  [0001 storage v1](../architecture/0001-storage-v1.md) and
  [0001 toolchain v1](../architecture/0001-toolchain-v1.md): unchanged. No new
  dependency.
- [0001-W21 v1](0001-W21-viewport-hooks.md): its comparison procedure is reused below.

## Deliverables and boundaries

All line numbers refer to `apps/web/src/App.tsx` at `a054b8a`.

1. **`apps/web/src/state/use-geometry-edits.ts`**, exporting `useGeometryEdits(input)`.
   It holds, moved verbatim and in this order: `commitText` (lines 205–214),
   `changeText` (215–223), `create` (255–268), `movedBoard` (269–274), `move`
   (275–278), `resizeStart` (279–284), `resizeStillValid` (285–291), `resizedBoard`
   (292–305) and `resizeBy` (306–310). It may declare a local type with the same shape
   as `App.tsx`'s `ResizeStart` (line 46) for the signatures that use it.

   Its input carries what those lines read from `App.tsx`: from `useBoardDocument`
   `model`, `commit`, `beginTextSession`, `finishTextSession` and `setDrafts`; from
   `useMessages` `setMessage`; from `App.tsx` `item`, `selected`, `select`,
   `objectLayouts`, `readOnly`, `busy`, `composing`, `setStatus`, `setTool`,
   `setPanel`, `setInline`, the `editor` ref, and `lineCount` (the function at lines
   48–59). Each is typed as it is typed where it comes from. It returns the nine
   functions above. It imports what the moved lines use from rules modules and nothing
   from `state/`, `ui/`, `scene/` or `App`.

2. **`App.tsx`:**
   - Lines 205–223 and 255–310 are removed.
   - At the place of line 205 (after `pos`), `App.tsx` calls `useGeometryEdits({ … })`
     with the inputs above, destructuring the nine returned names so every use keeps
     its current name.
   - `fallbackEditor`, `edit`, the effect at lines 236–254, `ResizeStart`, `lineCount`
     and everything else stay where they are. Imports that are no longer used in
     `App.tsx` are removed.
   Nothing else changes.

3. **`tests/modules.test.mjs`**, as listed under validation.

**Effects.** No `useEffect` or `useLayoutEffect` moves, is added or is removed; the
declared order of every effect is the same as at `a054b8a`.

**How the move is done** (web modules v8, "moves are moves"): expressions, functions
and their order move as they are; only where each name comes from changes. No other
module (rules modules, `ui/`, `scene/`, `objects/`, the eight existing hooks,
`icons.tsx`, `main.tsx`), `style.css`, package file, lock, contract or existing test
other than `tests/modules.test.mjs` changes. If something seems to need more, stop and
report it.

New source files use `SPDX-License-Identifier: Apache-2.0`. Append the implementation
record below with the branch, validated revision, commands, results, the `App.tsx`
line counts before and after, and exclusions; report the final branch tip separately.

## Numbered acceptance criteria

- 0001-W22-AC01: The geometry edits live in a hook under apps/web/src/state/ that holds no effects, with markup, focus, drawing and saved records identical to a054b8a.
- 0001-W22-AC02: Web modules v8 is published with the inventory and plan updated and the rules unchanged; the guardrail test covers the nine state/ hooks, the new hook's lack of effects and a lowered App.tsx budget; the unit suite and browser checks pass unchanged.

| Criterion | Evidence that shows it |
| --- | --- |
| 0001-W22-AC01 | The hook exists with the contents listed above and no effects; the comparison under validation finds no difference |
| 0001-W22-AC02 | Web modules v8 is on main with this brief; `tests/modules.test.mjs` passes with the new checks and budget; the full unit suite and both browser fixture pages pass with no other test changed |

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
  `use-geometry-edits.ts`, `use-messages.ts`, `use-panel-layout.ts`,
  `use-scene-size.ts`, `use-storage-session.ts` and `use-viewport.ts` (the inventory
  test is updated to these nine; its other state checks stay as they are and now cover
  all nine files).
- **The geometry hook holds no effects.** `use-geometry-edits.ts` contains neither
  `useEffect` nor `useLayoutEffect`.

Reviewer checks (not run by the implementer; browsers cannot start there):

- **Regression harness.** The eight PASS lines at the fixture index page and at
  `regressions.html` ([tests README](../../tests/README.md)), in headless Chrome or a
  focused browser window.
- **Markup, focus and drawing comparison.** Scenarios A–G of the 0001-W21 v1 brief's
  comparison, under its conditions, recorded values, DOM actions and validity rules,
  plus scenario H below, on a build of `a054b8a` twice (the two must match exactly) and
  once on the candidate; the candidate must match at every checkpoint with no values
  set aside. In scenario H, pointer presses and drags are **real mouse input** from the
  browser automation (move, press, move, release; the canvas takes pointer capture, which
  synthetic pointer events cannot), and "the board point (x, y)" means the screen point
  at the canvas centre plus (x, y) pixels, which holds while the view is at its start
  (x 0, y 0, zoom 100%). The selection's board position and size are read from the
  Objects panel's lines "X … · Y …" and "W … · H …".
  - **H. Geometry edits.** In a fresh browser context, wait until ready. Name the board
    `Geometry` and choose Save; wait for "Locally saved".
    1. Choose the Sticky tool, then press and release the mouse without moving at the
       board point (−300, −150); the inline editor's container (`.inline`) must be
       present. Set its text to `Alpha` and choose Done. **Checkpoint H1.**
    2. Open Objects and choose "Add sticky" (the button with that text). **Checkpoint
       H2.**
    3. Select `Alpha` only in Objects' list. Choose "Move object right"
       (`button[aria-label="Move object right"]`). **Checkpoint H3.** Choose "Make object
       wider". **Checkpoint H4.** Choose "Make object taller". **Checkpoint H5.**
    4. Read `Alpha`'s X, Y, W and H from Objects. Press the mouse at the board point
       (X + 20, Y + 20), move it by (60, 40) in four equal steps, and release.
       **Checkpoint H6.**
    5. Read X, Y, W and H again. Press the mouse at the board point (X + W, Y + H) (the
       south-east resize handle), move it by (40, 30) in four equal steps, and release.
       **Checkpoint H7.**
    6. Move focus to Objects' Content field (`#content`) with its `focus()` method;
       dispatch on it a bubbling `compositionstart`; set its value to `Alpha composed`
       with the native setter and a bubbling `input` event; dispatch a bubbling
       `compositionend`. **Checkpoint H8.**
    7. Open the board name panel if it is closed, choose Save and wait for "Locally
       saved"; read the saved head record as in scenario A and compare it the same way.

    Wait 250 milliseconds and two animation frames after each action before a
    checkpoint.

No browser matrix, Safari check, fixtures sweep, accessibility audit or IME checks
unless the maintainer asks; the maintainer runs a full regression pass after the last
step of this move.

## Exclusions and reasons

Any change in behaviour or appearance; fixes for bugs noticed on the way (report
them); moving `fallbackEditor`, `edit`, the inline-editor effect, the pointer and
keyboard handlers, the pointer helpers, the drag and gesture state, selection, panels,
the read-only state or save status (later steps); moving `ResizeStart` or `lineCount`;
per-type saved data; new object types; rule changes in the web modules note; other
contract changes; new dependencies.

## Public references with retrieval dates

None beyond the repository's own documents.

## Implementation record

Not started.

### 2026-10-25 — Implementation and non-browser validation

- Branch: `codex/0001-W22-geometry-edits`, based on committed main
  `e302bfae45449beb339a9351bdd0dd82596bcf46`, which contains this v1 brief and
  web modules v8. The preceding "Not started" entry is superseded by this record.
- Validated source/test revision: `22cda189d558b85c7d2af86f4714cc54d04574b8`
  (`refactor(web): extract geometry edits hook`). The commands below ran on the
  identical source/test contents immediately before that commit; only this
  implementation record changes afterward. The final branch tip is reported
  separately in the handoff.
- `useGeometryEdits` holds `commitText`, `changeText`, `create`, `movedBoard`,
  `move`, `resizeStart`, `resizeStillValid`, `resizedBoard` and `resizeBy`, moved
  verbatim in that order from `a054b8a`. Inputs retain their originating types;
  the local `ResizeStart` type has the original shape. The hook has no effects,
  uses the Apache-2.0 SPDX header, and imports only React types and rules modules.
- `App.tsx` newline count: **818 before, 752 after**. The guardrail budget is
  **752**, its recursive inventory names all nine hooks, and the new check rejects
  either effect name in the geometry hook. All existing guardrails remain.
- Additional in-memory source comparison passed: the nine moved functions match
  `a054b8a` verbatim and in order. Reversing only the permitted extraction and
  import changes restores `App.tsx` byte-for-byte, including every effect and its
  order, `fallbackEditor`, `edit`, `ResizeStart`, `lineCount`, markup and handlers.
  This is source evidence; browser behavior equivalence remains unverified.

Commands ran from the repository root with the pinned distribution selected in
`PATH` before every Node/npm invocation and the commit's hooks. No machine-specific
path is recorded.

| Exact command | Result |
| --- | --- |
| `node --version` | Exit 0; `v24.22.1` |
| `npm --version` | Exit 0; `11.19.1` |
| `npm --prefix apps/web ci --ignore-scripts --no-audit --no-fund` | Exit 0; 19 packages installed |
| `npm --prefix apps/web run typecheck` | Exit 0; no diagnostics |
| `node --test tests/modules.test.mjs` | Exit 0; 19 passed, 0 failed, 0 skipped |
| `npm --prefix apps/web test` | Exit 0; 260 passed, 0 failed, 0 skipped |
| `npm --prefix apps/web run build` | Exit 0; application built; accepted lock, runtime inventory and complete distributed notices verified |
| `npm --prefix apps/web run build:fixtures` | Exit 0; disposable fixtures built; accepted lock, runtime inventory and complete distributed notices verified |
| `git diff --check` | Exit 0; no whitespace errors in implementation diff |
| `git diff --cached --check` | Exit 0; no whitespace errors in staged implementation diff |
| `git commit -m 'refactor(web): extract geometry edits hook'` | Exit 0; source/test revision above created; both public-boundary hook checks passed. Git also emitted a `packed-refs.lock` permission error; the commit and branch ref were verified afterward. No hook was bypassed |
| `git rev-parse HEAD` | Exit 0; `22cda189d558b85c7d2af86f4714cc54d04574b8` after source/test commit |
| `git rev-parse refs/heads/codex/0001-W22-geometry-edits` | Exit 0; matches the source/test revision above |
| `git diff --name-only main...HEAD` | Exit 0 after source/test commit; exactly `apps/web/src/App.tsx`, `apps/web/src/state/use-geometry-edits.ts` and `tests/modules.test.mjs`. The final handoff additionally includes this brief's implementation record |
| `git status --short` | Exit 0; clean after source/test commit |

Dependencies added: **none**. Package manifests, locks, other modules, styles,
contracts and other existing tests are unchanged. Generated build outputs and
installed dependencies are ignored and uncommitted. No stash, push or merge.

Not run, per maintainer instruction and the environment's browser limitation:
browsers, the browser regression harness (both fixture pages), and the W21 A–G
plus W22 H markup/focus/drawing/saved-record comparison against two baseline runs
and the candidate. Those checks remain for the independent reviewer. No browser
matrix, Safari, accessibility, native IME, performance/load or unrelated acceptance
sweep was run. Fixture compilation does not establish browser fixture passes.

Graph listing, indexing and search were attempted first; each was unavailable
because the tool required approval under a never-approve policy. File reading was
used as the discovery fallback. Independent review and browser acceptance remain
pending; this handoff does not authorize merging or another milestone.
