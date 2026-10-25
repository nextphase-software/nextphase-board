BRIEF VERSION: 0001-W19 v1 (2026-10-25)
# 0001-W19 — Move the storage session into a hook

Status: Draft. Implementation starts only after the maintainer commits this brief
and [0001 web modules v5](../architecture/0001-web-modules-v5.md) to main.

## Outcome

The second half of part 3b of the staged move described in web modules v5, with no
change in behaviour:

- The **storage session** (the writer lock, opening a board, recovery snapshots,
  saving, reopening, and pausing editing when the page is hidden) leaves `App.tsx` for
  a hook under `apps/web/src/state/`, called where its effect used to be.
- That effect also tracked the window size, which belongs to the view; that half stays
  in `App.tsx` as its own effect, declared immediately after the hook call.
- One stale line in the browser regression harness is fixed, so the check that covers
  the pause-and-retry path this milestone moves actually reaches that path.

Every element, attribute, measured position, focus move, message, saved byte and
drawn pixel stays as it is at `ed51fcd`.

## Read first and prerequisite contracts

- [Contributor guidance](../../CONTRIBUTING.md), [agent instructions](../../AGENTS.md)
  and [engineering standards](../../DESIGN.md).
- [0001 web modules v5](../architecture/0001-web-modules-v5.md): the governing note;
  its rules are v3's, unchanged.
- [0001 storage v1](../architecture/0001-storage-v1.md),
  [0001 interaction v14](../architecture/0001-interaction-v14.md),
  [0001 document v3](../architecture/0001-document-v3.md) and
  [0001 toolchain v1](../architecture/0001-toolchain-v1.md): unchanged; they describe
  the behaviour that must stay identical. No new dependency.
- [0001-W18 v1](0001-W18-board-document-and-messages-hooks.md): the board document and
  messages hooks this hook takes inputs from, and the comparison procedure reused
  below.

## Deliverables and boundaries

All line numbers refer to `apps/web/src/App.tsx` at `ed51fcd` unless stated.

1. **`apps/web/src/state/use-storage-session.ts`**, exporting
   `useStorageSession(input)`. It holds, moved verbatim and in this order:
   - the `snapshots` state (lines 77–79, same initial value);
   - the `ack`, `store`, `release`, `alive` and `lockTask` refs (lines 86, 87, 88, 125
     and 168, same initial values);
   - `adopt` (lines 242–249) and `start` (lines 250–322);
   - one `useEffect` with an empty dependency list whose body is lines 324–325 and
     333–349, in that order (mark the page alive, start the session, define `hide` and
     `show`, add the `pagehide` and `pageshow` listeners), and whose cleanup is lines
     351–353 and 355–356, in that order (mark the page not alive, `hide()`, destroy the
     adapter, remove the `pagehide` and `pageshow` listeners);
   - `save` (lines 438–462) and `reopen` (lines 463–477).

   Its input carries what those lines read from `App.tsx`: `readOnly`, `setReadOnly`,
   `setStatus` (state in `App.tsx`); `setMessage` (from `useMessages`); `load`,
   `clearHistory`, `model`, `revision` and `adapter` (from `useBoardDocument`);
   `select`, `setInline` and `setView` (read by `adopt`); and `invalid`, `busy`,
   `composing` and the `pending` ref (read by `save` and `reopen`). Each is typed as it
   is typed where it comes from. It returns `snapshots`, `alive`, `adopt`, `save` and
   `reopen`. It imports what the moved lines use from `../storage` and `../document`
   and nothing from `state/`, `ui/`, `scene/` or `App`.

2. **`App.tsx`:**
   - `snapshots` leaves the `useState` declarations (lines 77–79); `ack`, `store`,
     `release` and `alive` leave the `useRef` declarations at lines 86–125; `lockTask`
     leaves the declaration at line 168 (`fallbackFocus` stays).
   - Lines 242–322 and 438–477 are removed.
   - At the place of the effect at lines 323–358, `App.tsx` calls
     `useStorageSession({ … })` with the inputs above, destructuring `snapshots`,
     `alive`, `adopt`, `save` and `reopen` so every use keeps its current name; and
     immediately after that call it declares the window-size effect:
     `useEffect` with an empty dependency list whose body is lines 326–332, in that
     order (define `resize`, call it, add the `resize` listener), and whose cleanup is
     line 354 (remove the `resize` listener).
   - Imports that are no longer used in `App.tsx` are removed.
   Nothing else changes.

3. **`tests/browser/app-regressions.mjs`, line 239 only:** the wait for the older save
   acknowledgement reads `host.querySelector("#save-acknowledgement").textContent`
   instead of `host.querySelector(".notice").textContent`; the rest of the line and
   file is unchanged. Since the notice stopped showing save acknowledgements (they are
   announced through the save area's `#save-acknowledgement` text), this wait could
   never succeed, so the check stopped before its pause-and-retry part.

4. **`tests/modules.test.mjs`**, as listed under validation.

**Effect order.** The app's effects keep their declared order, with the effect at
lines 323–358 replaced by the hook's effect followed by the window-size effect. The
two halves touch only different listeners and different state, so splitting them
cannot be observed: within a mount, the session still starts before the size is first
measured, and the cleanups only remove listeners and release the session. The app does
not render under React's StrictMode. No other effect moves, is added or is removed.

**How the move is done** (web modules v5, "moves are moves"): expressions, functions
and their order move as they are; only where each name comes from changes (a
parameter or returned value instead of a variable in `App.tsx`), apart from the effect
split described above. The hook owns the state and refs it holds; `App.tsx` reads
`snapshots` and `alive` through the returned values and does not assign to `alive`. No
other module (rules modules including `storage.ts`, `ui/`, `scene/`, `objects/`, the
four existing hooks, `icons.tsx`, `main.tsx`), `style.css`, package file, lock,
contract or existing test other than `tests/modules.test.mjs` and line 239 of
`tests/browser/app-regressions.mjs` changes. If something seems to need more, stop and
report it.

New source files use `SPDX-License-Identifier: Apache-2.0`. Append the implementation
record below with the branch, validated revision, commands, results, the `App.tsx`
line counts before and after, and exclusions; report the final branch tip separately.

## Numbered acceptance criteria

- 0001-W19-AC01: The storage session lives in a hook under apps/web/src/state/, called where its effect was, with every effect in its original order and behaviour identical to ed51fcd.
- 0001-W19-AC02: The stale browser regression check reads the save acknowledgement where the app shows it, and all eight app regressions and all eight storage fixtures pass.
- 0001-W19-AC03: Web modules v5 is published with the inventory updated and the rules unchanged; the guardrail test covers the five state/ hooks, the storage hook's single effect and a lowered App.tsx budget; the unit suite passes unchanged.

| Criterion | Evidence that shows it |
| --- | --- |
| 0001-W19-AC01 | The hook exists with the contents listed above; the window-size effect follows its call; the comparison under validation finds no difference |
| 0001-W19-AC02 | Line 239 changed as described; the eight PASS lines at `regressions.html` and at the fixture index page |
| 0001-W19-AC03 | Web modules v5 is on main with this brief; `tests/modules.test.mjs` passes with the new checks and budget; the full unit suite passes with no other unit test changed |

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
  `use-board-document.ts`, `use-context-bar.ts`, `use-messages.ts`,
  `use-panel-layout.ts` and `use-storage-session.ts` (the inventory test is updated to
  these five; its other state checks stay as they are and now cover all five files).
- **The storage hook holds one effect.** `use-storage-session.ts` contains exactly one
  match of `/\buseEffect\s*\(/` and no `useLayoutEffect`.

Reviewer checks (not run by the implementer; browsers cannot start there):

- **Regression harness.** In headless Chrome or a focused browser window, the eight
  PASS lines at the fixture index page and at `regressions.html`
  ([tests README](../../tests/README.md)), on the candidate; and the same pages on
  `ed51fcd` with only line 239 changed as above, which must also show eight PASS lines.
- **Markup, focus and drawing comparison.** In headless Chrome, under the conditions,
  recorded values and DOM actions of the 0001-W18 v1 brief's comparison (same Chrome
  version for every run, a fresh browser context per run and per scenario, 1280 × 800,
  device scale factor 1; a run with a missed animation frame or an unexpected dialog is
  discarded). The runs are made on a build of `ed51fcd` twice (the two must match
  exactly) and once on the candidate; the candidate must match at every checkpoint
  with no values set aside. "Wait until ready" means: wait until the Sticky tool
  button is enabled and the notice no longer shows "Opening local board…" or
  "Checking local storage and writer ownership…". Scenarios:
  - **A. Board and editing.** The 0001-W18 v1 brief's procedure, steps 1–29, with its
    saved record comparison after steps 11 and 26.
  - **B. Damaged saved data.** Wait until ready. Name the board `Damage` in the board
    name panel and choose Save; wait until the save status reads "Locally saved".
    Place a sticky with the text `Beta` (Sticky tool, focus the canvas, Enter, set the
    text, Done), choose Save and wait again. In IndexedDB (database `nextphase-board`,
    store `boards`), replace the `sha256` of the `head` record with 64 zeros, keeping
    everything else. Reload and wait until the notice shows "Saved data is
    unsupported, damaged or inconsistent". **Checkpoint B1.** Choose "View valid
    snapshot 1". **Checkpoint B2.**
  - **C. Web Locks unavailable.** Before any page script runs, make
    `navigator.locks` read as `undefined`. Load the page and wait until the notice
    shows "Web Locks unavailable". **Checkpoint C1.**
  - **D. Reopen with unsaved drafts.** Wait until ready. Name the board `Reopen` and
    choose Save; wait for "Locally saved". Place a sticky with the text `Alpha`.
    Open the board name panel if it is closed and choose Reopen; **dismiss** the
    confirmation dialog. **Checkpoint D1** (the sticky is still there, unsaved).
    Choose Reopen again; **accept** the dialog; wait until ready. **Checkpoint D2.**
    These two dialogs are expected; any other dialog invalidates the run.
  - **E. Pause and retry.** Wait until ready. Name the board `Pause` and choose Save;
    wait for "Locally saved". Dispatch on `window` a `PageTransitionEvent` named
    `pagehide` with `persisted: true`, then one named `pageshow` with
    `persisted: true`. Wait until the notice shows "Editing paused". **Checkpoint E1.**
    Choose "Retry editing" and wait until ready. **Checkpoint E2.**
- **Chromium and Safari smoke.** Save; reopen with and without unsaved changes; open a
  second tab and see it read-only; switch away from the tab and back.

No browser matrix, fixtures sweep, accessibility audit or IME checks unless the
maintainer asks.

## Exclusions and reasons

Any change in behaviour or appearance; fixes for bugs noticed on the way (report
them); moving the read-only state, save status, the `pending` ref, the window size,
selection, gestures, pointer or keyboard handlers, actions or the effect that reacts to
read-only changes (part 3c); changes to `storage.ts` or any other rules module; any
other change to the browser harness; per-type saved data; new object types; rule
changes in the web modules note; other contract changes; new dependencies.

## Public references with retrieval dates

None beyond the repository's own documents.

## Implementation record

Not started.

### 0001-W19 v1 implementation — 2026-10-25

- Branch: `codex/0001-W19-storage-hook`, from committed main
  `80580408c6e747bda386dc8caa47f14c7a80932e`, which contains this brief v1 and
  web modules v5. The worktree was clean at the start. `App.tsx` at that revision
  matches the brief's `ed51fcd` baseline.
- Validated source/test revision: `ddc30b5b6df4b6081fed9c78e943812add7e058a`
  (`refactor(web): extract storage session hook`). The successful checks below ran
  on the source and tests committed unchanged at this revision. The later record
  commit changes only this implementation record; its final branch tip is reported
  separately in the handoff.
- Moved snapshots, the five session refs, `adopt`, `start`, `save` and `reopen`
  into `use-storage-session.ts`, preserving their initial values, bodies and order.
  The hook's single passive effect contains the specified session setup and cleanup
  lines verbatim. Its call occupies the former effect's position, immediately
  followed by the window-size effect with the specified unchanged resize lines.
  Other effects and their order, markup and handlers are unchanged. `App.tsx`
  reads the returned `alive` ref without assigning to it.
- Changed only line 239 of `tests/browser/app-regressions.mjs`: the older receipt
  wait now reads `#save-acknowledgement`. The browser harness was not executed.
- `App.tsx` newline count: **1,152 before, 1,001 after**. The literal module-test
  budget is 1,001. The inventory and existing state guardrails cover all five
  hooks; the new check requires exactly one `useEffect` call and no
  `useLayoutEffect` in the storage hook.
- Added dependencies: **none**. No other module, style, package, lock, contract or
  existing test changed. Web modules v5 was already committed on main and was not
  edited.
- Toolchain: Node **24.22.1**, npm **11.19.1**, selected through the shell's `PATH`
  before every Node/npm command and inherited by Git hooks. No machine-specific
  toolchain path is committed.

Commands run from the repository root with that toolchain:

| Exact command | Result |
| --- | --- |
| `node --version` | Exit 0; `v24.22.1` |
| `npm --version` | Exit 0; `11.19.1` |
| `npm --prefix apps/web ci --ignore-scripts --no-audit --no-fund` | Exit 0; 19 packages installed |
| `npm --prefix apps/web run typecheck` | First run exited 1: the extraction initially left a duplicate snapshots declaration in App. Removed that leftover declaration within the allowed scope; final run exited 0 |
| `node --test tests/modules.test.mjs` | Exit 0 on both runs; final run: 16 passed, 0 failed, 0 skipped, with the final 1,001-line budget |
| `npm --prefix apps/web test` | Exit 0; full unit suite: 257 passed, 0 failed, 0 skipped |
| `npm --prefix apps/web run build` | Exit 0; accepted lock, runtime inventory and complete distributed notices verified; application built |
| `npm --prefix apps/web run build:fixtures` | Exit 0; accepted lock, runtime inventory and complete distributed notices verified; disposable fixtures built, not executed |
| `git diff ed51fcd -- apps/web/src/App.tsx` | Exit 0 before implementation; no difference from the baseline |
| `git diff --check` | Exit 0 before source/test commit; no whitespace errors |
| `git diff --color-moved=plain -- apps/web/src/App.tsx tests/modules.test.mjs tests/browser/app-regressions.mjs` | Exit 0; inspected the extraction, effect split, guardrails and single browser-line correction; inspected the new hook against the named baseline blocks |
| `git diff --cached --check` | Exit 0 before source/test commit; no staged whitespace errors |
| `git diff --cached --name-only` | Exit 0 before source/test commit; exactly the four allowed source/test deliverables |
| `git commit -m "refactor(web): extract storage session hook"` | Exit 0; created `ddc30b5b6df4b6081fed9c78e943812add7e058a`; both public-boundary hook checks reported PASS |
| `git rev-parse HEAD` | Exit 0 after source/test commit; `ddc30b5b6df4b6081fed9c78e943812add7e058a` |
| `git status --short` | Exit 0 after source/test commit; empty output, clean worktree |
| `git diff --name-only main...HEAD` | Exit 0 after source/test commit; exactly the four allowed source/test deliverables |
| `wc -l apps/web/src/App.tsx` | Exit 0 after source/test commit; 1,001 lines |
| `git diff --exit-code ddc30b5b6df4b6081fed9c78e943812add7e058a -- apps/web/src tests` | Exit 0 after appending the record; source and tests still match the validated revision |

Git emitted a sandbox denial while creating `packed-refs.lock`, but the source/test
commit succeeded; its branch ref and clean worktree were verified. No hook was
bypassed.

Exclusions: no browser was launched. The eight app regressions, eight storage
fixtures, baseline/candidate markup, focus, drawing and saved-record comparisons,
and Chromium/Safari smoke remain reviewer checks. Consequently browser equivalence,
0001-W19-AC02's runtime evidence and final milestone acceptance remain pending.
No browser regression harness, fixture execution, browser matrix, accessibility
audit, native IME check, performance/load test or unrelated test campaign ran.
Nothing was merged or pushed.

The graph inventory, indexing and symbol-search tools were attempted first but
returned an approval-policy error. Source discovery therefore used the brief's
named files directly; no graph artifact was written to the repository.
