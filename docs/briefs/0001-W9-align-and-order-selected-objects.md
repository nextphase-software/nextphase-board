BRIEF VERSION: 0001-W9 v1 (2026-10-24)
# 0001-W9 — Align and order selected objects

Status: Implemented. Independently reviewed at `fc86e44` (pass) and merged into
main on 2026-10-24 with [0001 interaction v12](../architecture/0001-interaction-v12.md).
The implementation record below, which lists the validated revisions, was written
before that review.

## Outcome

Selected objects can be aligned (left, centre, right, top, middle, bottom, against
the selection's bounding box), distributed with equal gaps horizontally or
vertically, and restacked (bring to front, bring forward, send backward, send to
back). The commands sit in an Arrange menu in the selection bar and in Objects. Each
is one undo step that restores positions or order exactly, and order and positions
are saved and reopened as today. Nothing is saved differently.

## Read first and prerequisite contracts

- [Contributor guidance](../../CONTRIBUTING.md), [agent instructions](../../AGENTS.md)
  and [engineering standards](../../DESIGN.md).
- [0001 interaction v12](../architecture/0001-interaction-v12.md): the governing
  behavior (align, distribute and order rules, availability and reasons, history,
  the Arrange menu, the Objects group).
- [0001 interaction v11](../architecture/0001-interaction-v11.md) and, through it,
  v10, v9, v8, v5 and v4: drawn rectangles, sets and their bounding box, steps
  covering several objects, command reasons, the swatch popover's rules, Objects
  equivalence.
- [0001 document v2](../architecture/0001-document-v2.md),
  [0001 storage v1](../architecture/0001-storage-v1.md) and
  [0001 toolchain v1](../architecture/0001-toolchain-v1.md): unchanged; no new dependency.

## Deliverables and boundaries

1. A new pure module `apps/web/src/arrange.ts`, in erasable TypeScript so the Node
   test runner can load it the way the existing tests load `resize.ts`, with:
   - the six alignments, from the selected objects' drawn rectangles;
   - the two distributions, including the free-space check;
   - interaction v12's rounding rule for every align and distribute result;
   - the four order computations, from the current order and the selected IDs;
   - the availability reasons of interaction v12, in its order.
2. `apps/web/src/history.ts`: an order step that records each selected object with
   its order before and after, so Undo and Redo restore the whole order exactly, as
   interaction v12 specifies. Recording a removal still ignores the renumbering it
   causes, every existing call form keeps its current result, and every existing case
   in `tests/history.test.mjs` passes unchanged. Positions from align and distribute
   use the existing recording.
3. `apps/web/src/App.tsx`: the Arrange button and its menu (popover, groups, focus,
   closing rules, only one popover open), the Objects Arrange group, wiring each
   command to one transaction and one history step, and no step when nothing
   changes.
4. `apps/web/style.css` and `apps/web/src/icons.tsx`: the menu, the group and an
   Arrange icon, following the 0001-W3 icon rules.
5. Tests: a new `tests/arrange.test.mjs` and added cases in `tests/history.test.mjs`
   (see Validation).

New source files use `SPDX-License-Identifier: Apache-2.0`. Do not change
`document.ts`, `storage.ts`, `geometry.ts`, `styles.ts`, `view.ts`, `commands.ts`,
`selection.ts`, `resize.ts`, the saved format, storage rules, package files, the lock
or any existing test case. Importing from those modules is fine. If a requirement
seems to need another change, stop and report it.

Append the implementation record below with the branch, validated revision,
commands, results and exclusions; report the final branch tip separately.

## Numbered acceptance criteria

- 0001-W9-AC01: Align and distribute a supported selection with declared reference bounds.
- 0001-W9-AC02: Change front/back stacking with a deterministic visible order.
- 0001-W9-AC03: Undo one arrangement command and preserve positions and order through save/reopen.

| Criterion | Evidence that shows it |
| --- | --- |
| 0001-W9-AC01 | Each of the six alignments moves a box-selected set to the box's matching edge or centre, sizes unchanged; both distributions leave equal gaps with the outer edges in place; align with one object, distribute with two, and distribute with too little room are unavailable with v12's reasons; unit cases for every formula |
| 0001-W9-AC02 | Each order command restacks the canvas and renumbers Objects' list exactly as v12's table says, with selected objects never passing each other; unit cases for each command, including sets with gaps and objects already at the top or bottom |
| 0001-W9-AC03 | One Undo restores each command exactly and Redo reapplies it; a command that changes nothing records nothing; save and reload keep the order and positions; history unit cases for order steps, with every existing case unchanged |

## Validation commands and expected evidence

From the repository root with the pinned toolchain:

```sh
npm --prefix apps/web ci --ignore-scripts --no-audit --no-fund
npm --prefix apps/web run typecheck
node --test tests/arrange.test.mjs tests/history.test.mjs
npm --prefix apps/web test
npm --prefix apps/web run build
git diff --name-only main...HEAD
```

`arrange.test.mjs` is new, and `history.test.mjs` covers the changed history module.
The full unit suite, `npm --prefix apps/web test`, is explicitly requested here
because `history.ts` is shared by every editing command. Running anything broader
needs an explicit maintainer instruction (see [agent instructions](../../AGENTS.md)).

Unit cases:

- **`arrange.test.mjs`**:
  - Each alignment for two and for several objects, including an object whose
    display height is taller than its saved height.
  - Each distribution with different sizes, ties sorted by order, zero free space,
    and negative free space refused with its reason.
  - Interaction v12's rounding rule: a distribution and a right and a centre
    alignment at the board's right or bottom edge whose arithmetic would round past
    it stay inside the box (for example four 80-unit-wide objects at x = 999001,
    999300, 999600 and 999920); bottom alignment keeps the drawn bottom inside the box
    when the display height is far above the saved height (box bottom 100.1, display
    height 1006, saved height 40).
  - The free space accumulated one object at a time in sorted order (widths 80, 80.2
    and 80.1 at x = 0, 80 and 160.2 give zero free space, so distribution is
    available).
  - Each order command for one object and for a set: a set with unselected objects
    between its members, objects already at the top or bottom, and a command that
    changes nothing; Bring forward and Send backward follow v12's position sequence.
  - The reasons, in v12's order.
- **`history.test.mjs`** (every existing case unchanged): an order step for each of
  the four commands undone and redone exactly, with the whole order restored; an
  align step undone and redone; a removal still recording no renumbering.

One browser pass in Chrome and Safari, recorded by whoever can run those browsers,
starting from a new, unnamed board with a few stickies and text objects:

- **Align and distribute:** each command from the Arrange menu on a box-selected set,
  each undone; the reasons with one or two objects selected.
- **Order:** each command on one object and on a set, visibly restacking the canvas
  and renumbering Objects' list, each undone.
- **Menu:** opened, moved through with Tab, closed with Escape (focus back on
  Arrange); a click outside closes it.
- **Objects:** the Arrange group runs a command.
- **Persistence:** name the board, Save, reload; order and positions are kept.

No browser matrix, fixtures sweep, accessibility audit or IME checks unless the
maintainer asks.

## Exclusions and reasons

Aligning to the board or to a key object, distributing by centres, keyboard
shortcuts, snapping and guides, tidy-up or auto-layout, a separate stacking order,
grouping (a later milestone) and new dependencies are out of scope.

## Public references with retrieval dates

No new external reference. Interaction v4's references (retrieved 2026-10-22) still
apply.

## Implementation record

Implementation handoff dated 2026-10-24 for **0001-W9 v1**, governed by
**0001 interaction v12**.

- Branch: `codex/0001-W9-arrange`.
- Worktree: `.worktrees/codex-0001-W9`.
- Committed main base: `b2ac7810ecc0e4570695835c9aa0bb607e3771f8`.
- Validated source/test revision: `60611f8074440ec72ed4f953fc8778334b17a54a`.
  The final checks below ran against the exact source/test bytes committed there.
  This implementation record is a separate documentation commit; the final branch
  tip is reported separately in the handoff.

Implemented the six alignments from drawn rectangles, both equal-gap distributions,
all four order commands, and the ordered availability reasons in a new pure module.
Every position is kept inside the measured selection box at double precision;
edge correction finds the nearest valid representable position, including the case
near zero where subtracting the object's length alone would overcorrect. Saved
sizes do not change. Order steps explicitly record every selected object's before
and after order, including a selected member that stays at its index. Ordinary
history callers still ignore order-only renumbering, including removals.

The selection bar has an original Arrange icon between Alignment and Duplicate.
Its bounded, scrollable popover and the Objects Arrange group share the same twelve
buttons, names and availability. The popover has native Tab navigation, disabled
button reasons, Escape/command focus return, outside-click/focus dismissal,
selection/bar-visibility dismissal and mutual exclusion with colour swatches.
Commands use the existing single-transaction commit path and skip unchanged boards.
The existing canvas and Objects list both consume the reordered saved array.
Document format, storage and explicit saving remain unchanged.

The pinned runtime was selected in the shell before every Node/npm invocation,
including the commit shell for hooks. Its environment-specific location is omitted
from this public record. No dependency, external asset, package or lock change was
added. The new source and test files carry Apache-2.0 SPDX identifiers.

| Exact command | Actual result |
| --- | --- |
| `node --version` | PASS, exit 0: `v24.22.1` |
| `npm --version` | PASS, exit 0: `11.19.1` |
| `npm --prefix apps/web ci --ignore-scripts --no-audit --no-fund` | PASS, exit 0; added 19 packages |
| `npm --prefix apps/web run typecheck` | PASS, exit 0; final run includes all source changes |
| `node --test tests/arrange.test.mjs tests/history.test.mjs` | Final PASS, exit 0: 77/77. The first run passed 71/72: one new assertion expected decimal `60.1` instead of the specified double-precision subtraction. Corrected that assertion; all existing history cases passed unchanged. Subsequent focused runs passed, including the added nearest-double regression. |
| `npm --prefix apps/web test` | PASS, exit 0: 166/166 unit tests |
| `npm --prefix apps/web run build` | PASS, exit 0; accepted lock, runtime inventory and complete distributed notices verified; application built |
| `git diff --check` | PASS, exit 0 |
| `git diff --cached --check` | PASS, exit 0 before source commit |
| `git diff --cached --stat` | Inspected: source commit contains only the seven permitted source/test files |
| `git commit -m "feat(web): align distribute and order selected objects"` | PASS; source/test revision above created, both mandatory public-boundary hooks reported PASS. Git also reported a sandbox-denied packed-refs lock operation; the commit and branch ref exist. No hook was bypassed. |
| `git diff --name-only main...HEAD` | Source commit lists only the seven permitted source/test files; final handoff check also includes this brief's implementation record |

Additional source/diff inspection verified that the original
`tests/history.test.mjs` bytes remain an unchanged prefix: cases were appended only.
Changed tracked and untracked files were checked against the maintainer's explicit
allowlist. No unrelated work was present or changed.

| Criterion | Evidence and remaining boundary |
| --- | --- |
| 0001-W9-AC01 | Unit cases cover all six alignments for two and several objects, taller display heights, both distributions, differing sizes, order tie-breaks, zero/negative free space, sequential fractional accumulation and rounding at the board edges. Browser commands on a box-selected set and visible reasons remain pending. |
| 0001-W9-AC02 | Unit cases cover each command for one object and sets with gaps, contiguous members, top/bottom members and unchanged orders. Forward/backward follow v12's position sequence. Visible canvas restacking and Objects labels remain pending browser review. |
| 0001-W9-AC03 | Added history cases verify each order command as one step/revision, exact whole-order Undo/Redo, arranged selection IDs, unchanged recording, align Undo/Redo, generation retargeting after deletion/restoration and removal without renumbering changes. Every pre-existing history case passes unchanged. Menu focus/dismissal, Objects command activation and actual Save/reload persistence remain pending browser review. |

No browser or browser regression harness was launched: browsers cannot start in
this environment, and the maintainer explicitly assigned that pass to the reviewer.
The brief's one Chrome and Safari pass (menu commands and Undo, order for one/set,
Tab/Escape/outside click and focus, Objects equivalence, Save and reload) is
**UNVERIFIED**. Unit and source evidence do not establish browser acceptance.
No browser matrix, fixture sweep, accessibility audit, native IME check,
performance/load test or unrelated acceptance campaign ran.

Codebase-memory project listing, indexing and symbol search were attempted first,
but each was blocked by the environment's approval policy. Direct source reads
were used as the fallback. No merge, push, publication, deployment or later
milestone was performed; independent review of the exact validated revision is
still required.
