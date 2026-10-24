BRIEF VERSION: 0001-W8 v1 (2026-10-23)
# 0001-W8 — Resize selected objects

Status: Draft. Implementation starts only after the maintainer commits this brief
and [0001 interaction v11](../architecture/0001-interaction-v11.md) to main.

## Outcome

A selected object, or a selected set, shows four corner handles. Dragging a corner
resizes towards it with the opposite corner fixed; Shift keeps the proportions. An
object can't be made narrower than 80 units (or than it already is, if narrower) or
shorter than its text needs within the height limits, so resizing never hides text
that fits, and text size never changes. A set scales as one and
stops as one at its limits. Objects offers Wider, Narrower, Taller and Shorter
buttons as the keyboard route. Each resize is one undo step, and Escape cancels it.
Nothing is saved differently.

## Read first and prerequisite contracts

- [Contributor guidance](../../CONTRIBUTING.md), [agent instructions](../../AGENTS.md)
  and [engineering standards](../../DESIGN.md).
- [0001 interaction v11](../architecture/0001-interaction-v11.md): the governing
  behavior (handles, resizing one object and a set, limits, the text floor, Objects'
  size buttons, history, and two corrections to v10).
- [0001 interaction v10](../architecture/0001-interaction-v10.md) and, through it,
  v8, v6 and v4: the rules v11 extends (selection and sets, steps covering several
  objects, needed, allowed and display heights, drags and cancellation).
- [0001 document v2](../architecture/0001-document-v2.md),
  [0001 storage v1](../architecture/0001-storage-v1.md) and
  [0001 toolchain v1](../architecture/0001-toolchain-v1.md): unchanged; no new dependency.

## Deliverables and boundaries

1. A new pure module `apps/web/src/resize.ts`, in erasable TypeScript so the Node
   test runner can load it the way the existing tests load `selection.ts`. It holds:
   - resizing one object: from the dragged corner, the starting drawn rectangle, the
     board-unit delta and Shift, the new `x`, `y`, `width` and `height` under
     interaction v11's steps 1–4;
   - resizing a set: from the dragged corner, the members' starting drawn
     rectangles and the delta and Shift, each member's new geometry, with the
     scale limits and the per-member text floor.

   The needed height at a given width is supplied by the caller (for example, as a
   function per object), so the module never measures text and stays testable.
2. `apps/web/src/App.tsx`:
   - the four handles, their visibility rules, hit areas and cursors;
   - the resize gesture (priority over objects and empty canvas, threshold,
     capture, frozen view, live preview, one transaction on release, cancellation
     restoring the starting geometry);
   - the needed height at a new width, measured as the app measures text today;
   - Objects' size line and its Wider, Narrower, Taller and Shorter buttons, with
     v11's names, availability and limits.

   Handle presses go through the scene's pointer handling with pointer capture,
   like every other gesture. v4's and v7's gesture rules and v9's command reasons
   apply to a resize. v11's two corrections to v10 describe the current behaviour
   and need no code change.
3. `apps/web/style.css`: the handles, their cursors and the size buttons.
4. A new `tests/resize.test.mjs` with the unit cases listed under validation.

New source files use `SPDX-License-Identifier: Apache-2.0`. Do not change
`history.ts`, `selection.ts`, `document.ts`, `storage.ts`, `geometry.ts`,
`styles.ts`, `view.ts`, `commands.ts`, `icons.tsx`, the saved format, storage rules,
package files, the lock or any existing test. Importing from those modules is fine.
If a requirement seems to need another change, stop and report it.

Append the implementation record below with the branch, validated revision,
commands, results and exclusions; report the final branch tip separately.

## Numbered acceptance criteria

- 0001-W8-AC01: Resize supported single objects using visible handles and declared minimum-size rules.
- 0001-W8-AC02: Resize a supported selection using explicit geometry and text-growth rules.
- 0001-W8-AC03: Persist and undo changed sizes without moving or corrupting unselected content.

| Criterion | Evidence that shows it |
| --- | --- |
| 0001-W8-AC01 | Handles appear at the corners of one selected sticky and one text object, and not in read-only views or while editing text; each corner resizes with the opposite corner fixed; the object stops at width 80 and never becomes shorter than its text within the height limits; narrowing a full note makes it taller; Shift keeps proportions; unit cases for every limit, the text floor and its exceptions |
| 0001-W8-AC02 | Handles on a set's bounding box scale every member's position and size about the fixed corner, with text size unchanged; the set stops as one when a member reaches a limit; a member's height never drops below its text within the height limits; unit cases for the set scales, their limits and the floor |
| 0001-W8-AC03 | One Undo restores a single and a set resize exactly, and Redo reapplies it; unselected objects never change; Escape during a resize restores the starting geometry; the size buttons resize and undo; save and reload keep the new sizes |

## Validation commands and expected evidence

From the repository root with the pinned toolchain:

```sh
npm --prefix apps/web ci --ignore-scripts --no-audit --no-fund
npm --prefix apps/web run typecheck
node --test tests/resize.test.mjs
npm --prefix apps/web run build
git diff --name-only main...HEAD
```

Run only the new unit test file: this change adds the resize module and leaves the
modules covered by the other test files unchanged. Running anything broader needs an
explicit maintainer instruction (see [agent instructions](../../AGENTS.md)).

`tests/resize.test.mjs` asserts, with the needed height supplied by the test:

- **One object:** each of the four corners keeps the opposite corner fixed; width
  stops at 80, at a starting width already below 80, and at 2,000; height stops at
  40 and 2,000; each board edge stops the resize; the text floor raises the height
  with the top and with the bottom edge fixed, in v11's calculation order, is capped
  at the allowed height, and grows downward when a bottom-fixed object reaches the
  top board edge; Shift keeps
  proportions, using the ratio that differs more from 1 (the larger on a tie), stops
  at a limit, and gives way to the text floor; a delta of zero returns the starting
  geometry.
- **A set:** scaling about each fixed corner moves and sizes every member; a member
  at width 80 or 2,000, height 40 or 2,000, or a board edge limits that scale for the
  whole set, independently per direction without Shift and together with Shift; a
  member's text floor raises only that member, downward from its scaled top.
- **Size buttons** (the bottom-right corner with a 10-unit delta, modifiers
  ignored): each direction for one object and a set, and a press reduced to no
  change.

One browser pass in Chrome and Safari, recorded by whoever can run those browsers,
starting from a new, unnamed board:

- **One object:** each corner on a sticky and on a text object, each undone; the
  80-unit minimum; narrowing a note full of text, which grows taller; Shift.
- **A set:** a box-selected set resized from a corner and undone; text sizes
  unchanged.
- **Cancelling:** Escape during a resize restores the object.
- **Objects:** each size button on one object and on a set; the size line.
- **Persistence:** name the board, Save, then reload; the sizes are kept.
- **No handles:** in a read-only view (a second tab) and while editing text.

No browser matrix, fixtures sweep, accessibility audit or IME checks unless the
maintainer asks.

## Exclusions and reasons

Edge handles, rotation, scaling text with the object, resizing during on-canvas
editing, snapping and guides (alignment is a later milestone), touch gestures and
new dependencies are out of scope.

## Public references with retrieval dates

No new external reference. Interaction v4's references (retrieved 2026-10-22) still
apply.

## Implementation record

Not started.
