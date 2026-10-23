BRIEF VERSION: 0001-W14 v1 (2026-10-23)
# 0001-W14 — Edit an unnamed board

Status: Draft. Implementation starts only after the maintainer commits this brief
and [0001 interaction v9](../architecture/0001-interaction-v9.md) to main.

## Outcome

A blank or invalid board name blocks only Save. On a new, unnamed board, Undo, Redo,
Duplicate, Delete and the colour, text-size and alignment controls work. Invalid
object text, composition, gestures and read-only views still block them, and Save
still needs a valid name. Nothing about saving, storage or history changes.

## Read first and prerequisite contracts

- [Contributor guidance](../../CONTRIBUTING.md), [agent instructions](../../AGENTS.md)
  and [engineering standards](../../DESIGN.md).
- [0001 interaction v9](../architecture/0001-interaction-v9.md): the governing rule
  (which invalid drafts make editing commands unavailable, and the order of reasons).
- [0001 document v2](../architecture/0001-document-v2.md),
  [0001 storage v1](../architecture/0001-storage-v1.md) and
  [0001 toolchain v1](../architecture/0001-toolchain-v1.md): unchanged; no new dependency.

## Deliverables and boundaries

1. A new pure module `apps/web/src/commands.ts` with one function that returns the
   reason editing commands are unavailable, or none. It takes read-only,
   composition, pointer-gesture and invalid-object-text state and returns today's
   reason strings in interaction v9's order. It takes no board-name input.
   Erasable TypeScript only, so the Node test runner can load it.
2. `apps/web/src/App.tsx`: compute whether any object-text draft is invalid,
   separately from the board name; use the new function for the command reason;
   keep the full invalid state, board name included, for Save, the status note and
   the explanations, exactly as today.
3. A new `tests/commands.test.mjs` with the unit cases listed under validation.

New source files use `SPDX-License-Identifier: Apache-2.0`. Apart from appending
this brief's implementation record, do not change any other file: no document,
storage, history, geometry, styles, view, CSS, package or lock change, and no change
to reason wording. If a requirement seems to need one, stop and report it.

Append the implementation record below with the branch, validated revision,
commands, results and exclusions; report the final branch tip separately.

## Numbered acceptance criteria

- 0001-W14-AC01: With a blank or invalid board name, undo, redo, duplicate, delete and the colour, text-size and alignment controls stay available, while Save stays blocked with its reason.
- 0001-W14-AC02: An invalid object-text draft, composition, a pointer gesture or a read-only view still blocks those commands, as before.
- 0001-W14-AC03: Giving the board a valid name enables Save; the saved format, storage and history are unchanged.

| Criterion | Evidence that shows it |
| --- | --- |
| 0001-W14-AC01 | On a new, unnamed board, and again with a 121-character board name: colour, text size, alignment, Duplicate, Delete, Undo and Redo work on a sticky; Save is unavailable with the board-name explanation; the command-reason function takes no board-name input |
| 0001-W14-AC02 | With a note's text over 1,000 code points, the same commands are unavailable with today's reason; unit cases give each existing reason in interaction v9's order |
| 0001-W14-AC03 | Naming the board makes Save available and Save writes as before; the diff touches only `commands.ts`, `App.tsx`, the new test and this brief's implementation record |

## Validation commands and expected evidence

From the repository root with the pinned toolchain:

```sh
npm --prefix apps/web ci --ignore-scripts --no-audit --no-fund
npm --prefix apps/web run typecheck
node --test tests/commands.test.mjs
npm --prefix apps/web run build
git diff --name-only main...HEAD
```

Run only the new unit test file: this change adds the commands module and leaves the
code covered by the other test files untouched. Running anything broader needs an
explicit maintainer instruction (see [agent instructions](../../AGENTS.md)).

`tests/commands.test.mjs` asserts, for the function's own inputs: no reason when
nothing blocks; read-only, composition, gesture and invalid object text each give
their existing reason; and when several apply, the reason follows read-only,
composition, gesture, object text. That `App.tsx` passes object-text validity only,
not the board name, is checked in review and by the browser pass below.

One browser pass in Chrome and Safari, recorded by whoever can run those browsers,
on a new, unnamed board:

- Colour, text size and alignment change a sticky; Duplicate, Delete, Undo and Redo work.
- Save is unavailable, and its explanation names the board name.
- The same holds with a 121-character board name.
- Typing a valid board name makes Save available, and Save then reaches Locally saved.
- Pasting more than 1,000 code points into a note makes the commands unavailable with today's reason.

No browser matrix, fixtures sweep, accessibility audit or IME checks unless the
maintainer asks.

## Exclusions and reasons

A default board name, new or reworded messages, changes to Save's rules and changes
to what counts as an invalid draft are out of scope.

## Public references with retrieval dates

No new external reference. Interaction v4's references (retrieved 2026-10-22) still
apply.

## Implementation record

Not started.
