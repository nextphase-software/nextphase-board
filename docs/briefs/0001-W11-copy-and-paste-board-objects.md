BRIEF VERSION: 0001-W11 v1 (2026-10-24)
# 0001-W11 — Copy and paste board objects

Status: Draft. Implementation starts only after the maintainer commits this brief
and [0001 interaction v14](../architecture/0001-interaction-v14.md) to main.

## Outcome

Selected objects can be copied, cut and pasted on the board: with Cmd/Ctrl+C, X and V
while the canvas has focus, and with buttons in Objects.
Board keeps copied objects in its own clipboard for the tab and also puts their text
on the system clipboard as plain text, to paste into other applications. Pastes get
fresh identities, keep whole groups grouped, cascade next to the originals or land in
the middle of the view, and are one undo step each; Cut is one undo step. Inside text
fields the keys stay native. Nothing is saved differently.

## Read first and prerequisite contracts

- [Contributor guidance](../../CONTRIBUTING.md), [agent instructions](../../AGENTS.md)
  and [engineering standards](../../DESIGN.md).
- [0001 interaction v14](../architecture/0001-interaction-v14.md): the governing
  behavior (the object clipboard and snapshot, Copy, Cut and Paste, placement and
  bounds, where the commands come from, writing the plain text, availability and
  reasons, history).
- [0001 interaction v13](../architecture/0001-interaction-v13.md) and, through it,
  v12 (the rounding rule), v11 (drawn rectangles), v10 (Delete, selection after
  undo), v9 (unavailability reasons, read-only), v5 (Duplicate's clamping and
  shortcut, keyboard scope) and v4 (coordinates, scene size).
- [0001 document v3](../architecture/0001-document-v3.md) (fresh identifiers, group
  IDs), [0001 storage v1](../architecture/0001-storage-v1.md) and
  [0001 toolchain v1](../architecture/0001-toolchain-v1.md): unchanged; no new dependency.

## Deliverables and boundaries

1. A new pure module `apps/web/src/clipboard.ts`, in erasable TypeScript so the Node
   test runner can load it the way the existing tests load `group.ts`, with:
   - building a snapshot from a board, a selection and the drawn rectangles
     (group marks, the source box's four edges, source identifiers, paste count 0);
   - the plain text for a snapshot;
   - building a paste from a board, a snapshot and the view (scene size, centre,
     zoom), returning the new board and the next paste count, using document v3's
     fresh identifiers (with `freshIdentifier`'s extra identifiers for the source
     identifiers and those already created in the paste) and interaction v14's
     placement, clamping and rounding rules, or refusing at 250 objects;
   - the availability reasons of interaction v14, in its order.
2. `apps/web/src/App.tsx`: the tab's object clipboard; Cmd/Ctrl+C, X and V on key
   presses that reach the canvas scene itself, in the existing shortcut handling
   beside Duplicate, leaving every other element's native behaviour alone; the
   Objects buttons; the asynchronous clipboard write for both and its failure
   message; messages; Cut as one transaction with Delete's rules; Paste as one
   transaction selecting the copies.
3. `apps/web/style.css`: the Objects buttons' layout, if needed.
4. A new `tests/clipboard.test.mjs` with the unit cases listed under validation.

New source files use `SPDX-License-Identifier: Apache-2.0`. Do not change
`document.ts`, `history.ts`, `storage.ts`, `group.ts`, `arrange.ts`, `selection.ts`,
`resize.ts`, `geometry.ts`, `styles.ts`, `view.ts`, `commands.ts`, `icons.tsx`, the
saved format, package files, the lock or any existing test. Importing from those
modules is fine. If a requirement seems to need another change, stop and report it.

Append the implementation record below with the branch, validated revision,
commands, results and exclusions; report the final branch tip separately.

## Numbered acceptance criteria

- 0001-W11-AC01: Copy and paste supported selected objects within Board with fresh identities and declared offsets.
- 0001-W11-AC02: Keep object clipboard actions separate from native text clipboard actions.
- 0001-W11-AC03: Undo one paste and preserve valid supported internal references without promising OS-wide or third-party design-tool clipboard compatibility.

| Criterion | Evidence that shows it |
| --- | --- |
| 0001-W11-AC01 | Copy then Paste of a set creates copies with new logical IDs and generations, the same content, offset 24, 48 and 72 units on three pastes while the originals are in view, and centred in the view after panning away; the copies are selected; unit cases for identities, offsets, centring, clamping and rounding |
| 0001-W11-AC02 | Cmd/Ctrl+C, X and V inside a note's text and in Objects' list act natively and leave the object clipboard unchanged; on the canvas, Paste ignores the system clipboard; the copied plain text pastes into another application's text field |
| 0001-W11-AC03 | One Undo removes a paste and one restores a cut; a copied whole group pastes as a new group of its own, a partly copied group pastes ungrouped; no copy references an original's identity; unit cases for group marks and mapping |

## Validation commands and expected evidence

From the repository root with the pinned toolchain:

```sh
npm --prefix apps/web ci --ignore-scripts --no-audit --no-fund
npm --prefix apps/web run typecheck
node --test tests/clipboard.test.mjs
npm --prefix apps/web run build
git diff --name-only main...HEAD
```

Run only the new unit test file: this change adds the clipboard module and leaves the
modules covered by the other test files unchanged. Running anything broader needs an
explicit maintainer instruction (see [agent instructions](../../AGENTS.md)).

`tests/clipboard.test.mjs` asserts:

- **Snapshot:** reading order; group marks for a whole group (kept) and a partly
  selected group (`null`); committed text, not a draft; the source box from drawn
  rectangles as four edges, including a display height taller than the saved height;
  the source identifiers; paste count 0.
- **Plain text:** snapshot order; empty texts skipped; all empty gives `""`.
- **Paste:** fresh logical IDs and generations distinct from every existing
  identifier and from each other; one fresh group ID per non-null mark per paste,
  different on the next paste; content copied exactly; appended in snapshot order;
  after a Cut, with the UUID source stubbed (for example with `node:test`'s mock) to
  offer a cut object's logical ID first, the copy gets a different one.
- **Placement:** with the source box in view (including each edge touching the view
  rectangle's), offsets of 24, 48 and 72 on the first three pastes; with the source
  box partly outside, centring by v14's `dx`/`dy` formulas; a source box whose right
  edge differs from `left + (right − left)` in floating point (for example `left`
  −1000 and `right` 80.1) judged by its stored right edge; clamping at each board
  edge; the rounding rule at the right and bottom edges using saved height.
- **Limit:** a paste that would exceed 250 objects is refused, the board is
  unchanged and the paste count does not advance.
- **Reasons:** each in v14's order, including Copy in a read-only view.

One browser pass in Chrome and Safari, recorded by whoever can run those browsers,
starting from a new, unnamed board with a few stickies and text objects. Unless a
row names one route, run it once with the keys on the canvas and once with the
Objects buttons:

- **Copy and paste:** a box-selected set pasted three times (cascade), then panning
  away and pasting (centred); each paste undone.
- **Groups:** copy a whole group and paste (copies form their own group); copy part
  of a group and paste (copies ungrouped).
- **Cut:** cut a set and undo.
- **Availability (buttons):** "Nothing to paste." on a fresh page; "Select an object
  to copy." with nothing selected.
- **Limit (keys):** a paste that would take the board above 250 objects is refused
  with the existing explanation.
- **System clipboard ignored (keys):** after copying objects, copy other text from
  another application, then paste on the canvas: the objects are pasted.
- **Native text (keys):** with a note's text open, and with focus in Objects' list,
  Cmd/Ctrl+C, X and V act natively and the object clipboard is unchanged (a
  following canvas Paste still pastes the earlier objects).
- **Outside (once):** the copied text pasted into another application's text field.
- **Write failure (once, from the developer console):** with
  `navigator.clipboard.writeText` replaced by a function that rejects, Copy sets the
  object clipboard (a later Paste works) and its message ends " Text could not be
  placed on the system clipboard."; Cut removes the objects at once, Undo restores
  them, and its message gains the same suffix. With `navigator.clipboard` removed,
  Copy behaves the same. With a replacement whose first call rejects after two
  seconds and whose second call succeeds, a second Copy within those two seconds
  shows "Copied 1 object." and keeps it without the suffix after the first call
  rejects.

No browser matrix, fixtures sweep, accessibility audit or IME checks unless the
maintainer asks.

## Exclusions and reasons

Reading the system clipboard, pasting outside text or images, clipboard round trips
between tabs, browsers or reloads, OS-wide or other applications' object clipboard
formats, the browser's Edit menu as a route to these commands, paste-in-place
shortcuts and new dependencies are out of scope.

## Public references with retrieval dates

Retrieved 2026-10-24:
[the asynchronous clipboard write](https://www.w3.org/TR/clipboard-apis/).
Interaction v4's references (retrieved 2026-10-22) still apply.

## Implementation record

Not started.
