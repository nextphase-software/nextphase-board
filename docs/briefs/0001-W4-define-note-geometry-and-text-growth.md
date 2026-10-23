BRIEF VERSION: 0001-W4 v1 (2026-10-22)
# 0001-W4 — Define note geometry and text growth

Status: Draft. Implementation starts only after the maintainer commits this brief
and [0001 interaction v6](../architecture/0001-interaction-v6.md) to main.

## Outcome

New sticky notes are square, and every note grows taller to fit its text, so the
canvas never hides text. Width and font size stay fixed, notes never shrink on
their own, and boards saved earlier open exactly as they were. The saved document
format and saving behavior do not change.

## Read first and prerequisite contracts

- [Contributor guidance](../../CONTRIBUTING.md), [agent instructions](../../AGENTS.md)
  and [engineering standards](../../DESIGN.md).
- [0001 interaction v6](../architecture/0001-interaction-v6.md): the governing
  behavior for this brief (default sizes, needed/saved/display height, limit,
  editor growth, existing objects).
- [0001 document v1](../architecture/0001-document-v1.md) (heights 40–2,000,
  transactions) and [0001 storage v1](../architecture/0001-storage-v1.md): unchanged.
- [0001 toolchain v1](../architecture/0001-toolchain-v1.md): unchanged; no new dependency.

## Deliverables and boundaries

1. A new pure module `apps/web/src/geometry.ts` with the sizing rule from
   interaction v6: needed height from a line count, saved height after an edit
   (grow only, 2,000 cap) and display height. It takes the line count as input so it
   can be tested without a canvas. Erasable TypeScript only, so the Node test runner
   can load it the way the existing tests load `document.ts`.
2. `apps/web/src/document.ts`: change only `add()` so a new sticky is 240×240. Do not
   change validation, the canonical form, identity code or limits.
3. `apps/web/src/App.tsx` (and `apps/web/style.css` if needed): measure the line
   count with the same Konva text layout the canvas draws (same width, font, size,
   line height and wrapping); apply the saved height inside the committed text
   transaction so one undo reverts text and height together; draw objects at the
   display height; show the "more" fade at the 2,000 limit; keep the on-canvas
   editor aligned and growing with the displayed height.
4. A new `tests/geometry.test.mjs` with the unit cases listed under validation.

New source files use `SPDX-License-Identifier: Apache-2.0`. Do not change
`storage.ts`, `history.ts`, the saved format, persistence, explicit-save policy,
placement rules, other tools, package files or the lock. If a requirement seems to
need any of those, stop and report it.

Append the implementation record below with the branch, validated revision,
commands, results and exclusions; report the final branch tip separately.

## Numbered acceptance criteria

- 0001-W4-AC01: Create notes using the chosen default proportions and declared text growth behavior.
- 0001-W4-AC02: Keep existing saved rectangular notes readable and editable under an explicit compatibility rule.
- 0001-W4-AC03: Preserve placement and text through the changed geometry save/reopen path without changing unrelated objects.

| Criterion | Evidence that shows it |
| --- | --- |
| 0001-W4-AC01 | New stickies are 240×240 and text objects 320×120; typing past the box grows the note taller with width and font unchanged; one undo reverts text and height together |
| 0001-W4-AC02 | A saved 240×160 sticky opens unchanged and only grows when its text needs more room; the canvas never hides its text |
| 0001-W4-AC03 | Save and reload keep every object's position, text and size; editing one note never changes another; display-only extra height is never saved |

## Validation commands and expected evidence

From the repository root with the pinned toolchain:

```sh
npm --prefix apps/web ci --ignore-scripts --no-audit --no-fund
npm --prefix apps/web run typecheck
node --test tests/geometry.test.mjs tests/document.test.mjs tests/history.test.mjs
npm --prefix apps/web run build
git diff --name-only main...HEAD
```

Run only these three unit test files: `geometry.test.mjs` is new, and
`document.test.mjs` and `history.test.mjs` both create objects through `add()`,
whose default this brief changes. Running anything broader needs an explicit
maintainer instruction (see [agent instructions](../../AGENTS.md)).

`tests/geometry.test.mjs` asserts, with injected line counts: needed height for one
and many lines; the saved height grows when more lines are needed and never
shrinks when fewer are; width is never changed; the 2,000 cap; an existing 240×160
height is kept until its text needs more; the display height is at least the
needed height without changing the saved value.

One browser pass in Chrome and Safari, recorded by whoever can run a browser: a new
square sticky; typing past the box grows it with the editor aligned; one undo
reverts text and height; a board saved before this change opens with its 240×160
note unchanged; save and reload keeps sizes. No browser matrix, fixtures sweep,
accessibility audit or IME checks unless the maintainer asks.

## Exclusions and reasons

Manual resize and handles, colors and text styles, rich text, auto-width, font
shrinking, multi-select, schema or storage changes and new dependencies are later
or out of scope.

## Public references with retrieval dates

No new external reference. Interaction v4's references (retrieved 2026-10-22)
apply; behavior above is a project requirement.

## Implementation record

Not started.
