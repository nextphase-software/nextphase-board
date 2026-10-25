BRIEF VERSION: 0001-W20 v1 (2026-10-25)
# 0001-W20 — Move the editing commands into a hook

Status: Draft. Implementation starts only after the maintainer commits this brief
and [0001 web modules v6](../architecture/0001-web-modules-v6.md) to main.

## Outcome

The first of four steps that finish moving input and actions out of `App.tsx`
(web modules v6, "Planned steps"), with no change in behaviour:

- The **editing commands** (undo, redo, duplicate, delete, copy, cut and paste with the
  object clipboard, align, distribute, order, group, and text styles) leave `App.tsx`
  for a hook under `apps/web/src/state/`.
- **No effect moves.** The hook holds none, so the order in which React runs the app's
  effects cannot change.

Every element, attribute, focus move, message, clipboard text, drawn pixel and saved
byte stays as it is at `f4048d5`.

## Read first and prerequisite contracts

- [Contributor guidance](../../CONTRIBUTING.md), [agent instructions](../../AGENTS.md)
  and [engineering standards](../../DESIGN.md).
- [0001 web modules v6](../architecture/0001-web-modules-v6.md): the governing note;
  its rules are v3's, unchanged.
- [0001 interaction v14](../architecture/0001-interaction-v14.md),
  [0001 document v3](../architecture/0001-document-v3.md),
  [0001 storage v1](../architecture/0001-storage-v1.md) and
  [0001 toolchain v1](../architecture/0001-toolchain-v1.md): unchanged. No new
  dependency.
- [0001-W19 v1](0001-W19-storage-session-hook.md): its comparison procedure is reused
  below.

## Deliverables and boundaries

All line numbers refer to `apps/web/src/App.tsx` at `f4048d5`.

1. **`apps/web/src/state/use-editing-commands.ts`**, exporting
   `useEditingCommands(input)`. It holds, moved verbatim and in this order:
   - the `objectClipboard` state with its setter (line 74, same initial value);
   - `writePlainText` (lines 482–494), `clipboardCommand` (495–520), `command`
     (521–574), `arrangementReason` (588–592), `arrange` (593–608) and `changeStyle`
     (609–621).

   Its input carries what those lines read from `App.tsx`: from `useBoardDocument`
   `model`, `commit`, `historyRef`, `updateHistory`, `setDrafts` and
   `finishTextSession`; from `useMessages` `setMessage` and `messageSequence`; from
   `useStorageSession` `alive`; from `App.tsx` `select`, `selected`, `setInline`,
   `scene`, `view`, `displayedObjects`, `commandReason`, `selectionReason`,
   `clipboardState`, `editingState` and `arrangementMembers`; and `lineCount` (the
   function at lines 48–59). Each is typed as it is typed where it comes from. It
   returns `objectClipboard`, `command`, `clipboardCommand`, `arrangementReason`,
   `arrange` and `changeStyle`. It imports what the moved lines use from rules modules
   and nothing from `state/`, `ui/`, `scene/` or `App`.

2. **`App.tsx`:**
   - `objectClipboard` leaves the `useState` declarations (line 74; line 73 then ends
     the declaration).
   - Lines 482–574 and 588–621 are removed.
   - At the place of line 588 (after `editingState` and `arrangementMembers`),
     `App.tsx` calls `useEditingCommands({ … })` with the inputs above, destructuring
     the returned names so every use keeps its current name.
   - `lineCount`, the derived values at lines 473–481 and 586–587, and everything else
     stay where they are. Imports that are no longer used in `App.tsx` are removed.
   Nothing else changes.

3. **`tests/modules.test.mjs`**, as listed under validation.

**Effects.** No `useEffect` or `useLayoutEffect` moves, is added or is removed; the
declared order of every effect is the same as at `f4048d5`.

**How the move is done** (web modules v6, "moves are moves"): expressions, functions
and their order move as they are; only where each name comes from changes (a
parameter or returned value instead of a variable in `App.tsx`). The hook owns the
object clipboard; `App.tsx` reads it through the returned value. No other module
(rules modules, `ui/`, `scene/`, `objects/`, the five existing hooks, `icons.tsx`,
`main.tsx`), `style.css`, package file, lock, contract or existing test other than
`tests/modules.test.mjs` changes. If something seems to need more, stop and report it.

New source files use `SPDX-License-Identifier: Apache-2.0`. Append the implementation
record below with the branch, validated revision, commands, results, the `App.tsx`
line counts before and after, and exclusions; report the final branch tip separately.

## Numbered acceptance criteria

- 0001-W20-AC01: The editing commands and the object clipboard live in a hook under apps/web/src/state/ that holds no effects, with markup, focus, messages, the clipboard text and saved records identical to f4048d5.
- 0001-W20-AC02: Web modules v6 is published with the inventory updated and the rules unchanged; the guardrail test covers the six state/ hooks, the commands hook's lack of effects and a lowered App.tsx budget; the unit suite and browser checks pass unchanged.

| Criterion | Evidence that shows it |
| --- | --- |
| 0001-W20-AC01 | The hook exists with the contents listed above and no effects; the comparison under validation finds no difference |
| 0001-W20-AC02 | Web modules v6 is on main with this brief; `tests/modules.test.mjs` passes with the new checks and budget; the full unit suite and both browser fixture pages pass with no other test changed |

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
  `use-messages.ts`, `use-panel-layout.ts` and `use-storage-session.ts` (the inventory
  test is updated to these six; its other state checks stay as they are and now cover
  all six files).
- **The commands hook holds no effects.** `use-editing-commands.ts` contains neither
  `useEffect` nor `useLayoutEffect`.

Reviewer checks (not run by the implementer; browsers cannot start there):

- **Regression harness.** The eight PASS lines at the fixture index page and at
  `regressions.html` ([tests README](../../tests/README.md)), in headless Chrome or a
  focused browser window.
- **Markup, focus and drawing comparison.** Scenarios A–E of the 0001-W19 v1 brief's
  comparison, under its conditions, recorded values, DOM actions and validity rules,
  plus scenario F below, on a build of `f4048d5` twice (the two must match exactly) and
  once on the candidate; the candidate must match at every checkpoint with no values
  set aside. A key press with a modifier is a bubbling, cancelable `keydown` with that
  `key`, `code` `Key` plus the upper-case letter, and `ctrlKey: true`, dispatched on the
  canvas element.
  - **F. Editing commands.** In a fresh browser context in which, before any page
    script runs, `navigator.clipboard.writeText` is replaced by a function returning a
    rejected promise (so every run has the same system-clipboard outcome). Wait until
    ready. Name the board `Commands` and choose Save; wait for "Locally saved". Place a
    sticky with the text `Alpha`, a sticky with `Beta` and a text object with `Gamma`
    (each: the tool, focus the canvas, Enter, set the text, Done). Open Objects. In
    this scenario an object is selected in Objects' list by the option whose text ends
    with `· ` followed by its text (for example `· Alpha`), because ordering commands
    change the numbers in the option text; where two options match, the one that is
    already selected is kept. After each Copy or Cut, by button or shortcut, wait until
    the notice shows "Text could not be placed on the system clipboard." before the
    checkpoint.
    1. Select `Alpha` and `Beta`; choose "Align objects left" in Objects' Arrange group.
       **Checkpoint F1.**
    2. Choose "Bring to front". **Checkpoint F2.**
    3. Choose "Group". **Checkpoint F3.** Choose "Ungroup". **Checkpoint F4.**
    4. Select `Gamma` only; set Objects' text size (`#object-size`) to `extra-large`.
       **Checkpoint F5.**
    5. Select `Alpha` only; choose Copy in Objects' Clipboard group.
       **Checkpoint F6.** Choose Paste. **Checkpoint F7.**
    6. Choose Cut. **Checkpoint F8.** Choose Undo. **Checkpoint F9.**
    7. Select `Beta` only; move focus to the canvas element with its `focus()` method;
       press Control+C, then Control+V. **Checkpoint F10.** Press Control+X.
       **Checkpoint F11.** Press Control+Z. **Checkpoint F12.**
    8. Open the board name panel if it is closed, choose Save and wait for "Locally
       saved"; then read the saved head record as in scenario A and compare it the same
       way.

No browser matrix, Safari check, fixtures sweep, accessibility audit or IME checks
unless the maintainer asks; the maintainer runs a full regression pass after the last
step of this move.

## Exclusions and reasons

Any change in behaviour or appearance; fixes for bugs noticed on the way (report
them); moving `lineCount`, the derived reasons, the viewport, the geometry edits
(`create`, `move`, resizing, text editing), the pointer and keyboard handlers,
selection, panels, the read-only state or save status (later steps); per-type saved
data; new object types; rule changes in the web modules note; other contract changes;
new dependencies.

## Public references with retrieval dates

None beyond the repository's own documents.

## Implementation record

Not started.
