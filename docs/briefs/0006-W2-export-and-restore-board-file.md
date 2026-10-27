BRIEF VERSION: 0006-W2 v1 (2026-10-27)
# 0006-W2 — Export and restore a local Board file

Status: Draft. Implementation starts only after the maintainer commits this brief,
[0001 storage v2](../architecture/0001-storage-v2.md),
[0006 board file v1](../architecture/0006-board-file-v1.md),
[0001 interaction v20](../architecture/0001-interaction-v20.md) and
[0001 web modules v18](../architecture/0001-web-modules-v18.md) to main.

## Outcome

A board can be saved as a file and opened again, here or in another browser. Opening a file
never touches the boards already kept in this browser: it becomes a board of its own.

- **Save a copy to file** in the Board panel downloads the open board as `<name>.nextboard`:
  Board's own open JSON format with a digest, the board as shown, unsaved edits included.
- **Open board file…** reads a board file, checks it completely, and saves it as a new board
  in this browser with a new board ID; everything else in it is kept. A file that is too large,
  not a Board file, damaged, not a valid board or from a newer version of Board is refused with
  one notice, and nothing changes.
- The Board panel lists the **boards in this browser** and opens any of them. Switching or
  opening a file with unsaved edits first asks: Save and open, Discard changes, Cancel.
- The board saved by earlier versions stays exactly where it is, so an older version of the
  app still opens, edits and saves it. Other boards have their own records and writer locks,
  so two tabs can edit two boards.

"Today" means `7e332e2`. The document format (v7) does not change. Boards look and behave as
today except for the Board panel and the start-up board choice named in this brief.

## Read first and prerequisite contracts

- [Contributor guidance](../../CONTRIBUTING.md), [agent instructions](../../AGENTS.md) and
  [engineering standards](../../DESIGN.md).
- [0001 storage v2](../architecture/0001-storage-v2.md): board keys and records, locks, the
  board list and its refresh, opening and switching boards, creating a board from a file.
- [0006 board file v1](../architecture/0006-board-file-v1.md): the file format, writing, the
  ordered reading checks and their reasons, the file name, identity.
- [0001 interaction v20](../architecture/0001-interaction-v20.md): the Board panel, the two
  file commands, the board list and its wording, the unsaved-edits question, opening a board,
  and the Section from selection reason.
- [0001 web modules v18](../architecture/0001-web-modules-v18.md): the new modules and the
  guard change; v12's rules unchanged.
- [0001 document v7](../architecture/0001-document-v7.md) and
  [0001 toolchain v1](../architecture/0001-toolchain-v1.md): unchanged. No new dependency.
- [0001-W24 v1](0001-W24-selection-layouts-editor-hooks.md)'s comparison procedure
  (scenarios A–J) is reused by the reviewer.

## Deliverables and boundaries

Paths are under `apps/web/` unless they start with `tests/`. The contracts say what each
behaviour is; this list says where it goes. These are the only files that may change.

**New files (seven).**
1. **`src/board-catalog.ts`**: board keys (`original` or a board ID), their record keys and
   lock names, the board list record's parsing and serialization, its entries and states, the
   list order, and the status line and saved-time wording of interaction v20. No React, Konva or
   DOM.
2. **`src/board-file.ts`**: writing a board file, the ten ordered reading checks and their
   reasons, and the file name. No React, Konva or DOM.
3. **`src/ui/board-question.tsx`**: `BoardQuestion`, the unsaved-edits dialog.
4. **`src/ui/boards-list.tsx`**: `BoardsList`, the heading and the rows.
5. **`src/ui/information-controls.tsx`**: `InformationControls`, the existing Information
   button and panel placed together, moved out of `App.tsx` unchanged (web modules rule 6).
6. **`tests/board-catalog.test.mjs`** and 7. **`tests/board-file.test.mjs`**: as listed under
   validation.

**Changed rules modules.**
8. **`src/storage.ts`**: a store for one board key; the list entry in each save transaction;
   creating a board from a file; refreshing and repairing the list (storage v2).

**Changed screen parts.**
9. **`src/ui/board-panel.tsx`**: Save a copy to file, Open board file… and its hidden file
   input, the list, and the new footer, in interaction v20's order.
10. **`style.css`**: the file commands, the list rows, the question and its narrow wrap.

**Changed state hook** (keeps its ownership, web modules v18):
11. **`src/state/use-storage-session.ts`**: the open board's key and the start-up choice;
    switching boards; the list and lock status refreshes; the question; opening a file;
    saving a copy.

**Composition.**
12. **`src/App.tsx`**: places `BoardQuestion`, passes the session's board-file values to
    `BoardPanel`, and places `InformationControls` in place of the two Information lines. It
    must not exceed **262 lines**, its budget.

**Changed tests.**
13. **`tests/modules.test.mjs`**: screen parts twenty, as listed under validation.

No other module changes: no `document.ts`, other hook, other screen part, `icons.tsx`,
`main.tsx`, packages, locks, contracts, fixtures or other tests. If something seems to need
more, stop and report it.

New source files use `SPDX-License-Identifier: Apache-2.0`. Append the implementation record
below with the branch, validated revision, commands, results and exclusions; report the final
branch tip separately.

## Numbered acceptance criteria

- 0006-W2-AC01: Download a versioned native Board document containing the supported local objects and references.
- 0006-W2-AC02: Restore into a separately identified local board under explicit identity rules, leaving the existing board recoverable.
- 0006-W2-AC03: Reject malformed or unsupported input without overwriting the current board; no team permissions or cloud storage are implied.

| Criterion | Evidence that shows it |
| --- | --- |
| 0006-W2-AC01 | Scenario P: P2–P6 (download name, envelope, bytes, unsaved edits, unavailability), P9, P23, P25 (byte-exact own-version payloads), P40 (read-only tab); unit tests in `tests/board-file.test.mjs` |
| 0006-W2-AC02 | Scenario P: P7–P10 (new board ID, identities kept, notice, original records unchanged, the same file twice), P22–P47 (versions, switching, the question, the list, tabs, reload, repair, keyboard, the older app), P49–P53 (list wording, damaged and newer rows, unknown times, no timed rewrites); unit tests in `tests/board-catalog.test.mjs` |
| 0006-W2-AC03 | Scenario P: P11–P21 (each refusal, nothing written, exact notice), P33 (no question for a refused file); unit tests in `tests/board-file.test.mjs`; no network request or account in any check |

## Validation commands and expected evidence

From the repository root with the pinned toolchain:

```sh
npm --prefix apps/web ci --ignore-scripts --no-audit --no-fund
npm --prefix apps/web run typecheck
node --test tests/board-catalog.test.mjs tests/board-file.test.mjs tests/storage.test.mjs tests/modules.test.mjs
npm --prefix apps/web test
npm --prefix apps/web run build
npm --prefix apps/web run build:fixtures
git diff --name-only main...HEAD
```

The change touches storage, the storage session and `App.tsx`, so the implementer runs the full
unit suite (`npm --prefix apps/web test`) and reports any failure, saying whether it also fails
at `7e332e2`.

**`tests/board-file.test.mjs`** (new) covers board file v1's verification list: writing and
reading back boards of versions 1 to 7 byte for byte, with sections, groups, shapes,
connectors, formatting and retired generations; the unedited-versus-edited payload rule; each
of the ten checks with a file that fails exactly that check (wrong key order, extra key,
indentation, a byte order mark, invalid UTF-8, a wrong `format`, `fileVersion` 2, `fileVersion`
`"1"`, an upper-case digest, a wrong digest, a payload that is not JSON, `schemaVersion` 8, an
invalid board, a payload in non-canonical form); the size limit at 4,194,304 and 4,194,305
bytes; and the file name rules (each replaced character, trailing dots and spaces, each device
name with and without an extension, an empty title, other Unicode kept).

**`tests/board-catalog.test.mjs`** (new) covers: keys and lock names for `original` and a board
ID, and rejection of any other key; parsing the list (missing, not a string, wrong
`formatVersion`, a wrong key order, a duplicate key, an unrecognised key, each state) and its
serialization order; nullable fields and their defaults; the list order (saved time
descending, unknown last, key ties); the status line for every combination of open here, open
in another tab (other row, read-only current row), saved time known and unknown, damaged and
newer (current and other rows) and from file, with the first letter capitalised; the
saved-time wording for today, yesterday, this year, an earlier year, a future time and a time
the browser cannot turn into a date, around midnight, with
two-digit hours and minutes. Through `storage.ts` with the test file's in-memory IndexedDB
double: a board's save writing its pair and list entry in one strict transaction and keeping
other entries; two stores saving two boards; the original pair byte for byte unchanged by
another board's saves, creation and list refreshes; creation aborting when its keys hold a
record; compare-before-write per board; a refresh validating every pair, carrying
`savedAt` and `fromFile` only on a matching fingerprint, rebuilding a missing, damaged and
stale list, giving `damaged` and `newer` states with the old entry's values or the defaults
(including a head that is absent or not JSON), listing a corrupted `previous` under an
unchanged head as `damaged`, dropping keys with no records, never writing a board record, never touching an unrecognised key, and skipping its
write when a record changed, was added or was removed after its read; a pair whose board ID differs from its key treated
as inconsistent.

**`tests/storage.test.mjs`**: unchanged; it must still pass.

**`tests/modules.test.mjs`**: screen parts twenty (adding `board-question.tsx`,
`boards-list.tsx` and `information-controls.tsx`); hooks nineteen and the `App.tsx` budget 262,
unchanged.

Reviewer checks (not run by the implementer; browsers cannot start there):

- **Scenario P** (new behaviour), with real mouse, keyboard, download and file-chooser events
  in fresh contexts at 1280 × 800 and 100% zoom (P45 also at 390 × 844), once on the candidate
  and once on a build of `7e332e2` as a negative control: there the file commands are absent,
  so the run marks every dependent check failed, runs P54, and exits with a failure. P46 and
  P47 run the build of `7e332e2` at the candidate's exact origin (the same scheme, host and
  port, served by response routing), so both use the same storage. Crafted files are used for
  P11–P25; crafted stored records only for P44 and P50–P52. The tool is
  `tools/browser-compare/boards-check.mjs` in the private repository; the check run keeps its
  order and may adjust its steps, keeping each check's meaning.
  - **P1** The panel's controls in interaction v20's order with its wording, the single
    scroll and height cap, and Close board details present.
  - **P2** A saved board's download is named `<name>.nextboard` with the four keys in order,
    its saved payload exactly, and the payload's digest.
  - **P3** An unsaved name and object edit are in the download; forbidden file name
    characters are replaced.
  - **P4** Save a copy to file is unavailable while the name draft is invalid.
  - **P5** It is unavailable while an object editor draft is invalid.
  - **P6** It is unavailable while a pointer gesture is in progress.
  - **P7** A valid file opens as a new saved board with a new board ID, keeping every object
    ID, generation, retired generation and connector end.
  - **P8** The opened notice names the file; the list shows the new board "Open here … from
    file"; the original board's `head` and `previous` are byte for byte unchanged.
  - **P9** An unedited saved board's file round-trips its payload byte for byte (apart from the
    new board ID).
  - **P10** The same file opened twice gives two boards with different IDs.
  - **P11–P21** Each refusal with its exact notice, nothing written and no question: larger
    than 4 MB, not JSON, a wrong `format`, a wrong key order, an extra key, a digest mismatch,
    an invalid board, a non-canonical payload, a newer `schemaVersion`, a newer `fileVersion`,
    invalid UTF-8.
  - **P22–P25** A version 1 and a version 6 file are accepted and stored at their own version,
    and each unedited board's download keeps that payload byte for byte.
  - **P26** Activating a row opens that board with its saved name and objects.
  - **P27** With unsaved edits, activating a row shows the question with the exact text, focus
    on Save and open.
  - **P28** Cancel keeps the draft and returns focus to the row.
  - **P29** Escape does the same.
  - **P30** Discard changes opens the target, leaves the original's records unchanged and
    clears undo history.
  - **P31** Save and open saves (waiting for "Locally saved"), then opens the target.
  - **P32** A failed save (fault injected and reported as a simulation) closes the question,
    shows Save failed, keeps the draft and opens nothing.
  - **P33** Opening a valid file with unsaved edits asks; Cancel writes nothing. A refused file
    asks nothing.
  - **P34** Discard changes then opens the file as a new board; the original's records are
    unchanged.
  - **P35** Save and open saves the draft before the new board is created.
  - **P36** The first saved edit on a board from a file removes "from file".
  - **P37** The most recently saved board is first.
  - **P38** Two tabs on two boards both edit and save.
  - **P39** A second tab on the first tab's board is read-only and its row says "Open here ·
    open in another tab"; a third tab editing a different board makes that board's row in the
    first tab's list say "Open in another tab".
  - **P40** A read-only tab can download the board it shows and cannot save.
  - **P41** Lock status updates within two seconds after the owning tab closes; Retry editing
    then takes the lock.
  - **P42** Reload reopens this tab's board; a new tab without a choice opens the browser's
    last opened board.
  - **P43** Two tabs keep their own board choices through reload.
  - **P44** A missing, damaged and stale list is rebuilt without any board record written.
  - **P45** Keyboard only: Tab reaches Save a copy to file, Open board file…, Reopen and each
    row; Enter on a valid row other than the current one opens it; at 390 × 844 the question's buttons stay inside it.
  - **P46** The `7e332e2` build at the same origin opens the original board only, edits and
    saves it, and leaves every other record unchanged.
  - **P47** The candidate then lists and opens every board; the original's row says "Saved
    time unavailable" with its new name.
  - **P48** Reopen keeps the browser's confirmation; Cancel keeps the draft.
  - **P49** Status lines use interaction v20's form: "Open here · saved today HH:MM" and
    "Saved today HH:MM" with two-digit hours and minutes.
  - **P50** A damaged board stored under its own keys shows "Can't be opened: damaged" with
    `aria-disabled`; activating it does nothing; its records are unchanged.
  - **P51** A board whose payload is `schemaVersion` 8 shows "Can't be opened: made by a newer
    version of Board" and stays unchanged.
  - **P52** Opening a damaged board by its address opens the recovery view, read-only, with its
    row "Open here · damaged".
  - **P53** With the panel open for three seconds and nothing else happening, the list record
    and every board record are unchanged.
  - **P54** No native browser dialogs other than Reopen's confirmation where exercised (the
    in-app question is not one), and no page or console errors.

Recommended regression checks, run only if the maintainer accepts them (this change touches
storage, the storage session and `App.tsx`):

- **The full unit suite** in a clean clone, separating failures new to the candidate from
  failures that also occur at `7e332e2`.
- **Previous behaviour.** Scenarios A–J of the 0001-W24 v1 brief's comparison on a build of
  `7e332e2` and on the candidate, with 0002-W2's adjusted starts in both runs (I2's marquee
  from (−140, −40) and I4's from (−240, 40), clear of the context bar). Before comparing, both runs are normalized with exactly these
  masks, and nothing else, inside the Board panel only:
  1. the file commands' container and the hidden file input are removed;
  2. the list heading and the list are removed;
  3. the footer paragraph's text is replaced by today's text.
  After the masks the candidate must match at every checkpoint in markup, focus, canvas
  drawing and saved records.
- **Regression harness.** The eight PASS lines at the fixture index page and at
  `regressions.html` ([tests README](../../tests/README.md)), in headless Chrome.

Scenarios N, M, K, L and O are not affected (no document, canvas or editing change) and are not
recommended. The maintainer checks three items drawn from scenario P in Safari, one picked by
the reviewer: the downloaded file's name (P2), which Safari could change. No browser matrix,
accessibility audit, phone layout check, quota or power-loss test, or performance test unless
the maintainer asks.

## Exclusions and reasons

- Deleting, renaming or creating an empty board from the list; recovering a damaged board
  (0006-W3).
- Dragging a file onto the canvas; merging a file into the open board.
- Other formats: images, PDF, CSV, other products' files (0012).
- Undo history, comments, view or selection in files; cloud storage, sharing or permissions
  (0003).
- A limit on the number of boards, and performance with many boards.
- Fixes for bugs noticed on the way (report them).

## Public references with retrieval dates

None beyond the repository's own documents and those cited in storage v2.

## Implementation record

### 2026-10-27 — v1 implementation handoff

- Branch: `codex/0006-W2-board-files`, in the prescribed milestone worktree, starting
  clean from committed main `92e22b3dab2ede29fd8c904e8ddd8c1f98f2ae50`.
- Validated source/test revision: `d4f06664abc26a88dbf7786544d5a5ef455d41bb`
  (`feat(web): add local board file export and restore`). Checks below ran on the
  identical source/test tree before that commit. The final branch tip is reported
  separately because the subsequent commit adds only this implementation record.
- Scope: the thirteen permitted implementation files only, plus this record.
  Board-file v1 verification, per-board storage/locks, advisory catalog repair,
  board selection, file controls and the unsaved-edits question are implemented.
  The original board retains its existing record keys and lock. The existing
  Section from selection connector reason already satisfies interaction v20.
- Dependencies added: **none**. Manifests, dependency lock, contracts, document
  format, other hooks, fixtures and `tests/storage.test.mjs` are unchanged.
  `App.tsx` has 259 lines against its unchanged 262-line budget; there are twenty
  UI modules and nineteen state hooks.

Commands ran from the repository root with Node **24.22.1** and npm **11.19.1**
selected on `PATH`:

| Exact command | Result |
| --- | --- |
| `npm --prefix apps/web ci --ignore-scripts --no-audit --no-fund` | Exit 0; 19 packages installed; no manifest or lock changes. |
| `npm --prefix apps/web run typecheck` | Exit 0. |
| `node --test tests/board-catalog.test.mjs tests/board-file.test.mjs tests/storage.test.mjs tests/modules.test.mjs` | Exit 0; 64 passed, 0 failed, cancelled or skipped. |
| `npm --prefix apps/web test` | Exit 0; 484 passed, 0 failed, cancelled or skipped. No failures required comparison with `7e332e2`; that baseline unit run was not performed. |
| `npm --prefix apps/web run build` | Exit 0; application built; accepted lock, runtime inventory and complete distributed notices verified. |
| `npm --prefix apps/web run build:fixtures` | Exit 0; disposable fixtures built; accepted lock, runtime inventory and complete distributed notices verified. This builds fixtures without executing them. |
| `git diff --check` | Exit 0. |
| `git diff --name-only main...HEAD` | Exit 0; the validated implementation changes only the thirteen permitted implementation paths. The handoff adds this brief's record only. |
| `git commit -m "feat(web): add local board file export and restore"` | Exit 0; mandatory public-boundary checks passed. Git reported a sandbox-denied `packed-refs.lock` operation; the commit completed and its branch ref was verified. |

The catalog tests use a transactional in-memory IndexedDB double, including
simulated aborts and changes between refresh read/write transactions. They cover
atomic saves/list updates, competing stores, byte preservation, occupied-key
creation refusal, complete-pair comparison, catalog reconstruction and states,
unrecognised-key isolation, metadata/defaults, and refresh races. File tests cover
versions 1–7, exact own-version payloads, the ordered refusals, byte-limit boundaries
and file names. These are unit results, not native IndexedDB/browser evidence.

Graph discovery and indexing were attempted first; the graph service was denied
by the sandbox's approval policy, so code discovery used direct source reads.

**Reviewer checks remain unverified.** Per the maintainer's instruction, no browser
was launched and no browser regression harness was run. Scenario P (including its
`7e332e2` negative control and older-app same-origin checks), scenarios A–J,
fixture PASS lines, real download/file-chooser/focus/lock journeys, and Safari
checks remain for the reviewer/maintainer. No additional browser matrix, native
IME, accessibility audit, performance, quota or power-loss campaign was run.
No merge, push or subsequent milestone is part of this handoff.

### Fix round 1 — F1–F3

- Branch: `codex/0006-W2-board-files`; started clean at reviewed tip
  `1facce9f78001f096de37e25c2b6a83636f05baf` in the same milestone worktree.
- Validated source/test revision: `bc948c9065504c57bd0828ece6a145eb94fcd7e1`
  (`fix(web): correct board saves, focus and lock status`). The checks below ran
  on the identical source/test tree before that commit. The final branch tip is
  reported separately; the following commit appends only this record.
- **F1 (P2):** explicit Save always captures `structuredClone(model.current)`, so
  an unedited legacy board's next Save writes the live version 7 document.
  Acknowledgement still sets `opened.current = snapshot`; a subsequent unedited
  file copy therefore uses the acknowledged payload. The from-file rule is unchanged.
  No hook unit test was added: the brief's named Node tests exercise rules/storage
  or structural guards, without a React hook/DOM runner. Adding such a runner or
  changing other tests would exceed this fix's scope. Existing version 1–7 file
  round-trip tests pass; they do not prove the hook's Save journey.
- **F2 (P2):** removed `inert` from `main`. Board/file open returns now queue a focus
  target, consumed only by a passive effect keyed on `opening` after React commits
  the enabled controls. This covers the activated row/file command and refused
  files. Startup, Reopen and Retry editing do not request focus restoration;
  dialog cancellation/save-failure focus handling is unchanged. The module guard
  now expects the lifecycle effect plus the explicitly requested opening-focus effect.
- **F3 (P3):** `boardStatus` takes `readOnly` and owns the
  `(!current || readOnly)` wording condition. `BoardsList` passes the lock and
  read-only values without applying that rule. Catalog tests cover all read-only
  combinations plus explicit editable-current, read-only-current and other-row cases.
- Scope: six source/test files plus this append-only record. Brief requirements,
  architecture contracts, storage rules, other hooks, fixtures and dependency
  manifests/lock are unchanged. Dependencies added: **none**.

Commands ran from the repository root with Node **24.22.1** and npm **11.19.1**
selected on `PATH`:

| Exact command | Result |
| --- | --- |
| `npm --prefix apps/web ci --ignore-scripts --no-audit --no-fund` | Exit 0; 19 packages installed; manifests and lock unchanged. |
| `npm --prefix apps/web run typecheck` | Exit 0. |
| `node --test tests/board-catalog.test.mjs tests/board-file.test.mjs tests/storage.test.mjs tests/modules.test.mjs` | Exit 0; 65 passed, 0 failed, cancelled or skipped. |
| `npm --prefix apps/web test` | Exit 0; 485 passed, 0 failed, cancelled or skipped. No failures required a baseline unit comparison; no baseline suite was run. |
| `npm --prefix apps/web run build` | Exit 0; application built; accepted lock, runtime inventory and complete distributed notices verified. |
| `npm --prefix apps/web run build:fixtures` | Exit 0; disposable fixtures built with the same dependency/notice verification; fixtures were not executed. |
| `git diff --check` | Exit 0. |
| `git diff --name-only 1facce9...HEAD` | Exit 0; only the six intended source/test paths at the validated revision. The handoff adds this record only. |
| `git commit -m "fix(web): correct board saves, focus and lock status"` | Exit 0; mandatory public-boundary checks passed. Git reported a sandbox-denied `packed-refs.lock` operation; the commit and branch ref were verified. |

Graph discovery/indexing was attempted first and denied by the sandbox's approval
policy; direct source reads were used. No browser was launched, and no browser
regression harness was run. Native Save/download/focus journeys, scenario P,
the reviewer's A–J comparison and Safari remain **unverified by this fix round**.
There was no broader test campaign, merge, push or subsequent milestone.
