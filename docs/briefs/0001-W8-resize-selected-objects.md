BRIEF VERSION: 0001-W8 v1 (2026-10-23)
# 0001-W8 — Resize selected objects

Status: Implemented. Independently reviewed at `9348c83` (pass) and merged into
main on 2026-10-24 with [0001 interaction v11](../architecture/0001-interaction-v11.md).
The implementation record below, which lists the validated revisions, was written
before that review.

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

Implementation handoff dated 2026-10-24 for **0001-W8 v1**, governed by
[interaction v11](../architecture/0001-interaction-v11.md).

- Branch: `codex/0001-W8-resize`.
- Worktree: `.worktrees/codex-0001-W8`.
- Committed main base: `89f66014d5d49ab6821228a63a1b186ec2e4590e`.
- Validated source/test revision: `c10e30d8298d8249f7ab9d606b85146588fc6893`.
  Checks ran on identical source/test bytes before this implementation commit;
  the working-tree comparison against that commit was empty afterwards. This
  record is a separate documentation commit. The final branch tip is reported
  separately in the handoff.

Implemented pure single-object and set resizing from all four corners, shared
scale limits, Shift proportions and per-object text floors. Floating-point
boundary overshoots are prevented by adjusting the shared scale toward 1 to the
next representable value when necessary; positions and sizes are not rounded.
The scene routes handle presses ahead of object/empty-space hits, after temporary
pan, using its existing pointer capture and cancellation. Resize previews use
starting drawn rectangles and frozen zoom, cross the 3 CSS-pixel threshold, and
commit once on release. Returning to the starting rectangle records nothing,
including when its drawn height exceeds its saved height. Objects shows the
rounded size line and four size buttons with the same availability as move buttons.
Existing history records every resized object's geometry in one step.

Source inspection checked handle visibility, fixed CSS-pixel dimensions and hit
areas, stacking, read-only/composition/editor exclusions, Space priority, capture
release, cancellation, expected-geometry checks, gesture control blocking and the
single transaction path. Move, selection-box, Pan, Space + drag and placement
branches retain their existing behavior outside the newly defined handle hit
areas. v11's two corrections to v10 required no code change. These are source
observations, not browser acceptance evidence.

The supplied pinned toolchain was selected in the shell before every Node/npm
command and both Git commit invocations. Its machine-specific location is omitted
from this public record. Only the four implementation/test deliverables and this
record changed. Added dependencies: **none**. No dependency version or license,
manifest, lock, saved format, storage rule, other module or existing test changed.

| Exact command | Actual result |
| --- | --- |
| `node --version` | PASS, exit 0: `v24.22.1`. |
| `npm --version` | PASS, exit 0: `11.19.1`. |
| `npm --prefix apps/web ci --ignore-scripts --no-audit --no-fund` | PASS, exit 0; added 19 packages, manifest and lock unchanged. |
| `npm --prefix apps/web run typecheck` | PASS, exit 0 on both runs, including final source/test bytes. |
| `node --test tests/resize.test.mjs` | First run: exit 1, 30 passed and 2 failed; exposed unnecessary scale-ratio arithmetic for ordinary single-object deltas. After using direct width/height arithmetic: exit 0, 32 passed. Final run after boundary and history cases: PASS, exit 0, 35 passed, zero failures. |
| `npm --prefix apps/web run build` | PASS, exit 0 on final implementation bytes; accepted lock, runtime inventory and complete distributed notices verified; application built. |
| `git diff --check` | PASS, exit 0 before the implementation commit and for this record. |
| `git diff --cached --check` | PASS, exit 0 before each commit. |
| `git diff --cached --stat` | Inspected before each commit: four permitted source/test files, then only this brief. |
| `git diff --cached --name-only` | Inspected before the implementation commit: only `App.tsx`, `resize.ts`, `style.css` and `resize.test.mjs` at their declared paths. |
| `git commit -m "feat(web): resize selected objects with corner handles"` | PASS, exit 0; created the validated revision above. Both mandatory public-boundary hooks reported PASS. Git emitted a sandbox-denied `packed-refs.lock` diagnostic; the commit exists and the branch revision was verified. No hook was bypassed. |
| `git rev-parse HEAD` | Verified the validated source/test revision above after the implementation commit. |
| `git diff HEAD -- apps/web/src/resize.ts apps/web/src/App.tsx apps/web/style.css tests/resize.test.mjs` | PASS, exit 0, empty after the implementation commit: the tested bytes match the committed files. |
| `git commit -m "docs(web): record W8 resize implementation evidence"` | Record commit; actual result and final branch tip are reported separately in the handoff. |
| `git diff --name-only main...HEAD` | Inspected after implementation and after the record commit: final scope is exactly the four implementation/test files and this brief. |
| `git status --short` | Clean after the implementation commit and after the record commit. |

| Criterion | Bounded implementation evidence |
| --- | --- |
| 0001-W8-AC01 | Unit cases cover all corners, width/height and board limits, narrower starting widths, top- and bottom-fixed text floors and their caps/edge exception, Shift dominance/ties/limits and zero delta. UI behavior awaits the browser pass. |
| 0001-W8-AC02 | Unit cases cover each fixed corner, independently limited axes, joint Shift limits, every member size/board bound, per-member downward text growth and exact document limits despite fractional boundary quotients. Visual set behavior and unchanged rendered text sizes await the browser pass. |
| 0001-W8-AC03 | Focused cases in the new file apply single and set resize geometry through the unchanged adapter/history: one transaction and step, exact Undo/Redo and unaffected unselected objects. Button deltas and no-change results are tested. Real pointer cancellation, native button activation and save/reload await the browser pass. |

No browser was launched and the browser regression harness was not run, as
instructed: browsers cannot start in this environment. The brief's single Chrome
and Safari pass is **UNVERIFIED** and left to the independent reviewer on the exact
validated revision. Runtime/visual acceptance of **AC01–AC03 remains pending**.
No other unit test file, full suite, fixture build/sweep, browser matrix,
accessibility audit, performance/load test or native IME check ran. No evidence
from another milestone is reused as browser acceptance. Graph discovery and
indexing were attempted first, but both tools were blocked by the environment's
approval policy; source was read directly instead.

No stash, hook bypass, push, merge, publication, deployment or later milestone was
performed.
