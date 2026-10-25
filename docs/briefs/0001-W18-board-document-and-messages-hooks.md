BRIEF VERSION: 0001-W18 v1 (2026-10-24)
# 0001-W18 — Move the board document and messages into hooks

Status: Implemented. Independently reviewed at `ed51fcd` (pass) and merged into main
on 2026-10-24 with [0001 web modules v4](../architecture/0001-web-modules-v4.md). The
implementation record below, which lists the validated revisions, was written before
that review.

## Outcome

The first half of part 3b of the staged move described in web modules v4, with no
change in behaviour:

- The **board document** (the board, its board name and drafts, the undo history, the
  text editing session, the revision counter, the canvas adapter and the changes that
  record history) leaves `App.tsx` for a hook under `apps/web/src/state/`.
- The **messages** (the current message and the last save acknowledgement) leave
  `App.tsx` for a second hook, and the choice of which messages the notice shows
  becomes a pure **rules module** with unit tests.
- **No effect moves.** Neither new hook holds an effect, so the order in which React
  runs the app's effects cannot change.

Every element, attribute, measured position, focus move, undo and redo step, message,
drawn pixel and saved byte stays as it is at `ffe5c0f`.

## Read first and prerequisite contracts

- [Contributor guidance](../../CONTRIBUTING.md), [agent instructions](../../AGENTS.md)
  and [engineering standards](../../DESIGN.md).
- [0001 web modules v4](../architecture/0001-web-modules-v4.md): the governing note
  (layers, the rules for every brief, the state-hook rules); its rules are v3's,
  unchanged.
- [0001 interaction v14](../architecture/0001-interaction-v14.md),
  [0001 document v3](../architecture/0001-document-v3.md),
  [0001 storage v1](../architecture/0001-storage-v1.md) and
  [0001 toolchain v1](../architecture/0001-toolchain-v1.md): unchanged; they describe
  the behaviour that must stay identical. No new dependency.

## Deliverables and boundaries

All line numbers refer to `apps/web/src/App.tsx` at `ffe5c0f`.

1. **`apps/web/src/notice-message.ts`**, in erasable TypeScript that the Node test
   runner can load, exporting `noticeMessage(message: string)`. Its body is lines 778,
   781 and 782 (`acknowledgement`, `routineStorage`, `visibleMessage`) moved verbatim,
   and it returns `{ acknowledgement, routineStorage, visibleMessage }`. It imports
   nothing.

2. **`apps/web/src/state/use-messages.ts`**, exporting `useMessages()`. It holds,
   moved verbatim and in this order:
   - the `message` state with its setter `setMessageState` (line 74, same initial
     value);
   - the `messageSequence` ref (line 87, same initial value);
   - `setMessage` (lines 132–135);
   - a call to `noticeMessage(message)`, giving `acknowledgement` and
     `visibleMessage`;
   - the `latestAcknowledgement` ref and its assignment (lines 779–780).

   It returns `setMessage`, `messageSequence`, `latestAcknowledgement` and
   `visibleMessage`.

3. **`apps/web/src/state/use-board-document.ts`**, exporting
   `useBoardDocument({ readOnly, setStatus })`, where `readOnly` is the state of that
   name in `App.tsx` and `setStatus` is the setter of `App.tsx`'s `status` state
   (line 75), typed as React types that setter (`commit` calls it at line 283). It
   holds, moved verbatim and in this order:
   - the `board`, `title`, `drafts` and `history` state (lines 65, 66, 67 and 81, same
     initial values);
   - the `model`, `historyRef`, `textSession`, `revision` and `adapter` refs (lines 86,
     88, 89, 90 and 93, same initial values);
   - the adapter's first creation (line 136);
   - `updateHistory` (lines 246–249), `clearHistory` (lines 257–260),
     `beginTextSession` (lines 261–265), `finishTextSession` (lines 266–270) and
     `commit` (lines 271–284). The one change: `beginTextSession` takes the selected
     object as its only parameter, `item` (typed as `item` is in `App.tsx`, possibly
     `undefined`), instead of reading `item` from `App.tsx`; its body is unchanged;
   - a new function `load(input)`, taking the same type as `adopt`'s first parameter,
     whose body is lines 286–294 and 298 of `adopt`, in that order (`upgrade`, clear
     the history, replace the model, board and adapter, reset the board name and
     drafts, reset the revision counter).

   It returns `board`, `setBoard`, `title`, `setTitle`, `drafts`, `setDrafts`,
   `history`, the refs `model`, `historyRef`, `textSession`, `revision` and `adapter`,
   and `updateHistory`, `clearHistory`, `beginTextSession`, `finishTextSession`,
   `commit` and `load`.

4. **`App.tsx`:**
   - The moved state leaves the `useState` declarations at lines 65–85; immediately
     after the remaining declarations, `App.tsx` calls `useMessages()` and then
     `useBoardDocument({ readOnly, setStatus })`, destructuring the returned names so
     that every use keeps its current name.
   - The moved refs leave the declarations at lines 86–131; lines 132–136, 246–249,
     257–284 and 778–782 are removed.
   - `adopt` (lines 285–301) keeps its name and parameters; its body becomes a call to
     `load(input)` followed by lines 295–297 and 299–300, unchanged and in that order.
     The revision counter is therefore reset before `select("")` and `setView` rather
     than after; nothing reads it in between.
   - The two callers of `beginTextSession` pass the selected object: line 438 becomes
     `beginTextSession(item);` and line 651 becomes
     `onFocus={() => beginTextSession(item)}`.
   - `App.tsx` reads the returned refs but does not assign to them.
   - Imports that are no longer used in `App.tsx` are removed.
   Nothing else changes.

5. **`tests/modules.test.mjs`** and a new **`tests/notice-message.test.mjs`**, as
   listed under validation.

**Effects.** No `useEffect` or `useLayoutEffect` moves, is added or is removed. The
declared order of every effect in the app is the same as at `ffe5c0f`. Moving
`useState` and `useRef` declarations into the hooks is allowed (their order does not
change behaviour).

**How the move is done** (web modules v4, "moves are moves"): expressions, functions
and their order move as they are; only where each name comes from changes (a parameter
or returned value instead of a variable in `App.tsx`), apart from the
`beginTextSession` parameter and the `adopt`/`load` split described above. The hooks
own the state they hold; `App.tsx` reads it through the returned values. No other
module (rules modules, `ui/`, `scene/`, `objects/`, the two existing hooks,
`icons.tsx`, `main.tsx`), `style.css`, package file, lock, contract or existing test
other than `tests/modules.test.mjs` changes. If something seems to need more, stop and
report it.

New source files use `SPDX-License-Identifier: Apache-2.0`. Append the implementation
record below with the branch, validated revision, commands, results, the `App.tsx`
line counts before and after, and exclusions; report the final branch tip separately.

## Numbered acceptance criteria

- 0001-W18-AC01: The notice text is decided by a pure rules module with unit tests that returns exactly what App.tsx computed at ffe5c0f.
- 0001-W18-AC02: The board document and the messages live in hooks under apps/web/src/state/, with no effect moved, and markup, focus moves, undo and redo, text editing sessions, saving, reopening and messages identical to ffe5c0f.
- 0001-W18-AC03: Web modules v4 is published with the inventory updated and the rules unchanged; the guardrail test covers the four state/ hooks and a lowered App.tsx budget; the unit suite and browser checks pass unchanged.

| Criterion | Evidence that shows it |
| --- | --- |
| 0001-W18-AC01 | `tests/notice-message.test.mjs` passes; the moved lines match lines 778, 781 and 782 |
| 0001-W18-AC02 | The two hooks exist with the contents listed above and no effects; the comparison under validation finds no difference in markup, focus, drawing or saved records |
| 0001-W18-AC03 | Web modules v4 is on main with this brief; `tests/modules.test.mjs` passes with the new checks and budget; the full unit suite and the browser regression harness pass with no other test changed |

## Validation commands and expected evidence

From the repository root with the pinned toolchain:

```sh
npm --prefix apps/web ci --ignore-scripts --no-audit --no-fund
npm --prefix apps/web run typecheck
node --test tests/notice-message.test.mjs tests/modules.test.mjs
npm --prefix apps/web test
npm --prefix apps/web run build
git diff --name-only main...HEAD
```

The full unit suite runs here because code shared by every feature moves.

`tests/notice-message.test.mjs` calls `noticeMessage` and asserts all three returned
values for: `"Local revision 3 acknowledged after transaction completion."`
(acknowledgement, nothing shown); the same text with a trailing space (not an
acknowledgement, shown as given); `"Local revision x acknowledged after transaction
completion."` (not an acknowledgement); `"Stored only in this browser profile. Browser
storage is not a backup."` (routine, nothing shown); `"Another tab is editing. This
board is read-only."` (shown as given); and the empty string (neither, nothing shown).

`tests/modules.test.mjs` keeps its W15, W16 and W17 checks and changes or adds:

- **Line budget.** The literal budget for `App.tsx` becomes its newline count after
  this change.
- **State hooks.** Listing `apps/web/src/state/` recursively finds exactly
  `use-board-document.ts`, `use-context-bar.ts`, `use-messages.ts` and
  `use-panel-layout.ts` (the W17 inventory test is updated to these four; its other
  state checks stay as they are and now cover all four files).
- **The new hooks hold no effects.** `use-board-document.ts` and `use-messages.ts`
  contain neither `useEffect` nor `useLayoutEffect`.
- **The notice module is a rules module.** `apps/web/src/notice-message.ts` imports
  nothing from `"react"`.

Reviewer checks (not run by the implementer; browsers cannot start there):

- **Regression harness.** The eight PASS lines at `regressions.html`
  ([tests README](../../tests/README.md)), in headless Chrome or a browser window that
  has focus.
- **Markup, focus and drawing comparison.** The procedure below runs on a build of
  `ffe5c0f` twice (the two baseline runs must match each other exactly) and once on
  the candidate, each served on the same origin, in **headless Chrome** (the same
  version for every run) with a **fresh browser context per run** (so the board's
  storage starts empty), a 1280 × 800 viewport and a device scale factor of 1. A run in
  which any animation frame fails to arrive within one second, or in which a
  confirmation dialog appears, is discarded and repeated. Before checkpoint 1, and
  again after the reopen in step 26, the reviewer waits until the Sticky tool button
  is enabled and the notice no longer shows "Opening local board…" or "Checking local
  storage and writer ownership…". At each checkpoint the reviewer waits two animation
  frames, then records: `document.querySelector("main").outerHTML` with every UUID
  (`/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g`) replaced by
  `id-1`, `id-2`, … in order of first appearance; the focused element's path from
  `main`, written as each element's lower-case tag name and its 1-based position
  among its parent's element children, joined by `>` (for example
  `section:5>span:3>div:1>button:2`), or `body` when focus is on the page; and the
  Konva stage's own render, `Konva.stages[0].toDataURL({ pixelRatio: 1 })`. The
  candidate must match the baseline at every checkpoint in all three, with no values
  set aside. Every step acts through the DOM, the same way in every run: a button is
  activated with its `click()` method (which does not move focus); a key press is a
  bubbling, cancelable `keydown` event with that `key` and `code` dispatched on the
  named element (the canvas element, the swatches, the menu); typing into, or setting,
  a text field (`textarea` or `input`) uses the element's native `value` setter
  followed by a bubbling `input` event; selecting in Objects' list (`#selection`) sets
  each option's `selected` flag (an option is chosen by the start of its text, for
  example `sticky 1 `) and dispatches a bubbling `change` event; choosing a colour in
  Objects (`#object-colour`) uses the native `value` setter followed by a bubbling
  `change` event. Focus moves only through these actions and the `focus()` calls the
  steps name. Procedure:
  1. Load the page. **Checkpoint 1.**
  2. Open the board name panel from the file bar. **Checkpoint 2.** Close it with its
     Close button.
  3. Open Objects. **Checkpoint 3.**
  4. With the Sticky tool, focus the canvas and press Enter; type `Alpha`; choose Done.
     Repeat with `Beta`. With the Text tool, do the same with `Gamma`. Open Objects
     again, select `sticky 1` only, and wait until the context bar is visible and
     measured. **Checkpoint 4.**
  5. Open the colour control in the context bar. **Checkpoint 5.** Press Escape
     inside the swatches.
  6. Open the context bar's Arrange control (the button inside `.arrange-control`).
     **Checkpoint 6.** Press Escape inside the menu.
  7. In Objects' list select all three objects. **Checkpoint 7.**
  8. Select `sticky 1` and `sticky 2`; choose Group in Objects. **Checkpoint 8.**
  9. Open the information panel. **Checkpoint 9.** Close it.
  10. Open Navigation. **Checkpoint 10.** Close it.
  11. Name the board `Compare` in the board name panel and choose Save; wait until the
      save status reads "Locally saved". **Checkpoint 11.**
  12. Open Objects. Select `sticky 2` only and choose the colour Teal in Objects; then
      select `text 3` only and choose the colour Violet. **Checkpoint 12.**
  13. Select `sticky 1` only. Move focus to the canvas element with its `focus()`
      method and press Enter; the inline editor's container (`.inline`) must be
      present. **Checkpoint 13.** Choose Done in the context bar.
  14. Open the colour control, then dispatch a `pointerdown` event (bubbling) on the
      save status element (`.save-status`). **Checkpoint 14.**
  15. Open the colour control and press Escape inside the swatches. **Checkpoint 15.**
  16. Open Objects, then open the context bar's Arrange control. **Checkpoint 16.**
  17. Move focus to Objects' list with its `focus()` method. **Checkpoint 17.**
  18. Move focus to Objects' Content field (`#content`) with its `focus()` method and
      set its value to `Alpha one`. **Checkpoint 18** (a text editing session is
      open).
  19. Choose Undo (`button[aria-label="Undo"]`). **Checkpoint 19.**
  20. Choose Redo (`button[aria-label="Redo"]`). **Checkpoint 20.**
  21. Select `sticky 2` only in Objects' list and choose Duplicate in Objects (the
      button inside `.object-commands`). **Checkpoint 21.**
  22. Choose Undo. **Checkpoint 22.**
  23. Choose Redo. **Checkpoint 23.**
  24. Choose Delete in Objects (it deletes the selected copy). **Checkpoint 24.**
  25. Choose Undo. **Checkpoint 25.**
  26. Open the board name panel if it is closed, choose Save and wait until the save
      status reads "Locally saved"; then choose Reopen in the board name panel and
      wait as before checkpoint 1. **Checkpoint 26** (the undo history is empty).
  27. Open the board name panel if it is closed and set the board name field
      (`#title`) to the empty string. **Checkpoint 27** (the notice lists the board
      name error).
  28. Set the board name field to `Compare two`. **Checkpoint 28.**
  29. Open a second page in the same browser context at the same address and wait
      until its notice shows "Another tab is editing. This board is read-only."
      **Checkpoint 29**, recorded on the second page; then close it.
- **Saved record comparison.** After step 11 and again after the save in step 26, the
  reviewer reads the saved head record from IndexedDB in each run and checks that
  `formatVersion` and `storageRevision` are equal, that the two `payload` strings are
  equal after the same UUID replacement, and that each record's `sha256` is the
  SHA-256 of its own `payload`.
- **Chromium and Safari smoke.** Edit an object's text, undo and redo it; duplicate and
  delete with undo and redo; save and reopen; clear the board name and fix it; open a
  second tab and see it read-only.

No browser matrix, fixtures sweep, accessibility audit or IME checks unless the
maintainer asks.

## Exclusions and reasons

Any change in behaviour or appearance; fixes for bugs noticed on the way (report
them); moving the storage session (the writer lock, opening, saving, reopening,
read-only state, save status, recovery snapshots), which is the next step; moving
selection, view, gestures, pointer or keyboard handlers, actions or the effect that
reacts to read-only changes (part 3c); per-type saved data; new object types; rule
changes in the web modules note; other contract changes; new dependencies.

## Public references with retrieval dates

None beyond the repository's own documents.

## Implementation record

Not started.

### 0001-W18 v1 implementation — 2026-10-24

- Branch: `codex/0001-W18-document-hooks`, from committed main
  `fc4539eb11f22ade1769138236f0c9e2edc29c5a`, which contains this brief v1 and
  web modules v4. The worktree was clean at the start.
- Validated source/test revision: `18f517c62889362d158fe2b8f97c830c1c94be2e`
  (`refactor(web): extract board document and message hooks`). The checks below ran
  on the source and tests committed unchanged at this revision. The later record
  commit changes only this implementation record; its final branch tip is reported
  separately in the handoff.
- Moved the notice expressions verbatim into `notice-message.ts`; moved messages
  and board document ownership into the two specified hooks. The only function
  changes are the specified `beginTextSession(item)` parameter/callers and the
  `adopt`/`load` split. Source diff inspection found no effect or markup changes
  beyond the specified focus-handler wiring; effect bodies and order stay in place.
  `App.tsx` reads the returned refs without assigning to them.
- `App.tsx` newline count: **1,209 before, 1,152 after**. The literal module-test
  budget is 1,152; the state inventory and existing state guardrails cover all four
  hooks, with added checks for effect-free new hooks and a React-free notice rule.
- Added dependencies: **none**. No package, lock, contract, style, other module or
  other existing test changed.
- Toolchain: Node **24.22.1**, npm **11.19.1**, selected in the shell before every
  Node/npm command. Toolchain selection uses environment configuration, without
  committing a machine-specific path.

Commands run from the repository root:

| Exact command | Result |
| --- | --- |
| `node --version` | Exit 0; `v24.22.1` |
| `npm --version` | Exit 0; `11.19.1` |
| `npm --prefix apps/web ci --ignore-scripts --no-audit --no-fund` | Exit 0; 19 packages installed |
| `npm --prefix apps/web run typecheck` | Exit 0; TypeScript passed |
| `node --test tests/notice-message.test.mjs tests/modules.test.mjs` | Exit 0; 21 passed, 0 failed, 0 skipped |
| `npm --prefix apps/web test` | Exit 0; full unit suite: 256 passed, 0 failed, 0 skipped |
| `npm --prefix apps/web run build` | Exit 0; accepted lock, runtime inventory and complete distributed notices verified; application built |
| `git diff --check` | Exit 0; no whitespace errors |
| `git diff --color-moved=plain -- apps/web/src/App.tsx tests/modules.test.mjs` | Exit 0; inspected the extraction and guardrail changes against the unchanged baseline source |
| `git diff --cached --check` | Exit 0 before source/test commit; no staged whitespace errors |
| `git diff --name-only main...HEAD` | Exit 0 after source/test commit; exactly the six allowed source/test deliverables |
| `git diff --exit-code 18f517c62889362d158fe2b8f97c830c1c94be2e -- apps/web/src tests` | Exit 0 after appending the record; source and tests still match the validated revision |

Both public-boundary hook checks reported PASS for the source/test commit; no hook
was bypassed. Git also emitted a sandbox denial while creating `packed-refs.lock`,
but the commit succeeded and its branch ref and clean worktree were verified.

Exclusions: no browser was launched; no browser regression harness, markup/focus/
drawing comparison, saved-record comparison or Chromium/Safari smoke ran. These
remain reviewer checks, so browser equivalence and final milestone acceptance are
pending. No fixtures sweep, browser matrix, accessibility audit, native IME check,
performance/load test or unrelated test campaign ran. Nothing was merged or pushed.

The graph inventory, symbol search and indexing tools were attempted first but
returned an approval-policy error. Source discovery therefore used the brief's
named files directly; no graph artifact was written to the repository.
