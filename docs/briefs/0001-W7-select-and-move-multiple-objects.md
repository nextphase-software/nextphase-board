BRIEF VERSION: 0001-W7 v1 (2026-10-23)
# 0001-W7 — Select and move multiple objects

Status: Draft. Implementation starts only after the maintainer commits this brief
and [0001 interaction v10](../architecture/0001-interaction-v10.md) to main.

## Outcome

Several objects can be selected at once: by dragging a selection box on empty
canvas, by Shift-clicking, with Cmd/Ctrl+A on the canvas, or in the Objects list.
Dragging any selected object moves the whole set, keeping their positions relative
to each other. Delete, Duplicate, colour, text size, alignment and Objects' move
buttons act on the whole set. Each of these is one undo step, and Undo restores
every object exactly. Nothing is saved differently, and with one object selected
everything works as before.

## Read first and prerequisite contracts

- [Contributor guidance](../../CONTRIBUTING.md), [agent instructions](../../AGENTS.md)
  and [engineering standards](../../DESIGN.md).
- [0001 interaction v10](../architecture/0001-interaction-v10.md): the governing
  behavior (selection, pointer rules, the selection box, moving a set, select all,
  commands on a set, history steps covering several objects, the bar and Objects for
  a set, keyboard, availability).
- [0001 interaction v9](../architecture/0001-interaction-v9.md) and, through it,
  v8, v5 and v4: the rules v10 extends (selection, drags and cancellation, commands,
  the generation rule, history, style controls, blocking reasons).
- [0001 document v2](../architecture/0001-document-v2.md),
  [0001 storage v1](../architecture/0001-storage-v1.md) and
  [0001 toolchain v1](../architecture/0001-toolchain-v1.md): unchanged; no new dependency.

## Deliverables and boundaries

1. A new pure module `apps/web/src/selection.ts`, in erasable TypeScript so the Node
   test runner can load it the way the existing tests load `history.ts`. It holds:
   - the box test: given a box (two corner points in board units, in any order) and
     objects with their display heights, the IDs of the objects the box touches, in
     reading order;
   - the set move limit: given the selected objects and a requested distance, the
     largest distance up to it that keeps every one within interaction v10's range;
   - the set's bounding box, for the bar's placement and Objects' coordinates.
2. `apps/web/src/history.ts`: a history step can cover several objects.
   - `record` accepts a change to any number of objects and records one step; it
     still returns the history unchanged when no object changed.
   - Undo and Redo apply every object of a step together, by v10's per-object
     generation rule, and bring objects back at their former reading-order
     positions.
   - The 250-object limit, the 10,000-generation limit and the incarnation check
     refuse the whole step with today's messages and no change to the board or
     history.
   - Duplicate and Delete accept several targets, through new exports or optional
     list arguments, and record one step. Copies are appended in their sources'
     reading order.
   - Undo, Redo, Duplicate and Delete report every object the step covers (for
     Duplicate, the copies), so App can select them.
   - Every existing call form keeps working with its current single-object result,
     including `affectedId`, so every existing case in `tests/history.test.mjs`
     passes unchanged.
3. `apps/web/src/App.tsx`:
   - the selection as a set of logical IDs, with the selection stroke on every member;
   - v10's pointer rules, the selection box (drawing, live preview, capture,
     cancellation restoring the previous selection) and set drags with the limit;
   - Cmd/Ctrl+A on the scene;
   - Duplicate, Delete and the style controls on a set, with v10's messages and
     focus;
   - selection and messages after Undo and Redo;
   - the bar and Objects for a set, including "Mixed", the multiple-selection list
     and the set's move buttons;
   - the Enter message with several selected.

   v4's and v7's gesture blocking, and v9's command reasons, apply to the box
   unchanged.
4. `apps/web/style.css`: the selection box, the Mixed colour dot and the
   multiple-selection list.
5. Tests: a new `tests/selection.test.mjs` and added cases in
   `tests/history.test.mjs` (see Validation).
6. `tests/browser/app-regressions.mjs`: only its option-count helper, which
   subtracts the placeholder option that v10 removes. Do not run that harness.

New source files use `SPDX-License-Identifier: Apache-2.0`. Do not change
`document.ts`, `storage.ts`, `geometry.ts`, `styles.ts`, `view.ts`, `commands.ts`,
`icons.tsx`, the saved format, storage rules, package files or the lock, and do not
change any existing test case. If a requirement seems to need another change, stop
and report it.

Append the implementation record below with the branch, validated revision,
commands, results and exclusions; report the final branch tip separately.

## Numbered acceptance criteria

- 0001-W7-AC01: Use marquee and additive selection to identify multiple supported objects visibly.
- 0001-W7-AC02: Move the selected set as one transaction while preserving relative positions and unselected objects.
- 0001-W7-AC03: Undo or cancel the selected-set operation without stealing text-caret shortcuts.

| Criterion | Evidence that shows it |
| --- | --- |
| 0001-W7-AC01 | A box selects exactly the objects it touches (including a tall note counted by its display height); Shift + box adds; Shift-click adds and removes; Cmd/Ctrl+A selects all; a range chosen in Objects with the keyboard selects those objects; every member shows the selection stroke, the bar reads "*N* objects" and Objects reads "*N* objects selected"; unit cases for the box test |
| 0001-W7-AC02 | Dragging a member moves every member by the same distance and no other object; one drag is one transaction and one history step; Objects' move buttons move the set; unit cases show the set stopping as one at each board edge with relative positions kept, and a set move as one step |
| 0001-W7-AC03 | One Undo restores a set move, set duplicate, set delete and set style change exactly, and Redo reapplies it; Escape during a set drag restores every position, and during a box restores the previous selection; inside a note's text, Cmd/Ctrl+A, Delete and Backspace act on the text only; unit cases for steps covering several objects, their limits and generations |

## Validation commands and expected evidence

From the repository root with the pinned toolchain:

```sh
npm --prefix apps/web ci --ignore-scripts --no-audit --no-fund
npm --prefix apps/web run typecheck
node --test tests/selection.test.mjs tests/history.test.mjs
npm --prefix apps/web test
npm --prefix apps/web run build
git diff --name-only main...HEAD
```

`selection.test.mjs` is new, and `history.test.mjs` covers the changed history
module. The full unit suite, `npm --prefix apps/web test`, is explicitly requested
here because `history.ts` is shared by every editing command. Running anything
broader needs an explicit maintainer instruction (see
[agent instructions](../../AGENTS.md)).

Unit cases, with assertions on document state, generations and revision counts:

- **`selection.test.mjs`**:
  - The box test: objects inside, partly inside, touching only at an edge or a
    corner, and outside; corners given in either order; an object counted by a
    display height taller than its saved height; a box with no height; results in
    reading order.
  - The set move limit: a free move unchanged; each of the four bounds stopping the
    whole set, with relative positions kept; no change when a member is already at
    the bound in that direction.
  - The bounding box of one and of several objects.
- **`history.test.mjs`** (every existing case unchanged):
  - A set move recorded through `record` is one step, adopts one revision, and undo
    and redo restore every member exactly.
  - A set style change with growth on one member is one step, undone and redone
    together.
  - A set duplicate appends copies in source reading order with new IDs and
    generations; undo retires every copy's generation; redo brings them back with
    fresh generations.
  - A set delete of non-adjacent objects retires each generation; undo brings them
    back at their former reading-order positions with fresh generations; redo
    removes them again.
  - The 250-object limit refuses a set duplicate and the undo of a set delete, and
    the 10,000-generation limit refuses a set delete and the redo of a set delete,
    each with today's message and the board and history unchanged.
  - A step whose object is no longer the recorded incarnation is refused whole.
  - A set step counts once toward the 100 kept steps.

One browser pass in Chrome and Safari, recorded by whoever can run those browsers,
starting from a new, unnamed board with a few stickies and text objects:

- **Selecting:** a box with and without Shift, including one that only grazes a
  note; Shift-click adding and removing; a click on a member selecting it alone;
  Cmd/Ctrl+A on the canvas.
- **Moving:** a set moved and undone; a set drag cancelled with Escape. The board
  edge is covered by the unit cases, as it lies 1,000,000 units out.
- **Commands:** Duplicate, Delete and each of Colour, Text size and Alignment on a
  set, each undone, with "Mixed" shown before choosing.
- **Objects:** selecting a range with Shift and the arrow keys; the set's move
  buttons.
- **Text:** with a note's text open, Cmd/Ctrl+A, Delete and Backspace affect the
  text only.

No browser matrix, fixtures sweep, accessibility audit or IME checks unless the
maintainer asks.

## Exclusions and reasons

Resizing a set, align and distribute, grouping, and copy and paste between boards
are later milestones. Escape to clear the selection, lasso selection and touch
gestures are not part of this change. No new dependency.

## Public references with retrieval dates

Retrieved 2026-10-23:
[the HTML `select` element and its `multiple` attribute](https://html.spec.whatwg.org/multipage/form-elements.html#the-select-element)
and [CSS conic gradients](https://www.w3.org/TR/css-images-4/#conic-gradients).
Interaction v4's references (retrieved 2026-10-22) still apply.

## Implementation record

Not started.
