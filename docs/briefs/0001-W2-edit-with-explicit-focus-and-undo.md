BRIEF VERSION: 0001-W2 v2 (2026-10-22)
# 0001-W2 — Edit with explicit focus and undo

Status: Draft. Implementation starts only after the maintainer commits this brief
and [0001 interaction v5](../architecture/0001-interaction-v5.md) to main.

## Outcome

People can undo and redo their edits, duplicate an object and delete an object,
by button or by keyboard, while text fields keep their own typing, undo and
clipboard. Focus and selection land somewhere predictable after every command.
The saved document format and saving behavior do not change.

## Read first and prerequisite contracts

- [Contributor guidance](../../CONTRIBUTING.md), [agent instructions](../../AGENTS.md)
  and [engineering standards](../../DESIGN.md).
- [0001 interaction v5](../architecture/0001-interaction-v5.md): the governing
  behavior for this brief, including the 0001-W3 presentation it builds on.
- [0001 document v1](../architecture/0001-document-v1.md) (generations,
  `retiredGenerations`, transactions) and [0001 storage v1](../architecture/0001-storage-v1.md):
  unchanged.
- [0001 toolchain v1](../architecture/0001-toolchain-v1.md): unchanged; no new
  dependency. Yjs remains the transaction adapter only; do not use its undo manager.

## Deliverables and boundaries

1. A new pure module `apps/web/src/history.ts` holding the history and the four
   commands over the `Board` type: record, undo, redo, duplicate and delete, the
   generation rule, the 100-step cap and Redo clearing, exactly as interaction v5
   specifies. No React, DOM or storage code in it; erasable TypeScript only, so the
   Node test runner can load it as the existing tests load `document.ts`.
2. `apps/web/src/App.tsx`: record history for create, completed moves and text
   editing sessions; wire Undo/Redo buttons in the board bar, Duplicate/Delete in
   the selection context bar and the Objects panel, the scene-scoped shortcuts, the
   blocking rules, focus outcomes and status messages; clear history on Reopen,
   reload, page hide and writer-ownership changes.
3. `apps/web/src/icons.tsx` and `apps/web/style.css`: undo, redo, duplicate and
   delete icons and their states, following the 0001-W3 icon rules.
4. A new `tests/history.test.mjs` with the unit cases listed under validation.

New source files use `SPDX-License-Identifier: Apache-2.0`. Do not change
`document.ts`, `storage.ts`, the saved format, persistence, explicit-save policy,
object geometry defaults, placement, other tools, package files or the lock. If a
requirement seems to need any of those, stop and report it.

Append the implementation record below with the branch, validated revision,
commands, results and exclusions; report the final branch tip separately.

## Numbered acceptance criteria

- 0001-W2-AC01: Selection, text editing and clipboard targets are explicit; keyboard shortcuts act on the intended context.
- 0001-W2-AC02: Duplicate, delete, move and edit are undoable/redoable under documented transaction boundaries; duplicate IDs are independent.
- 0001-W2-AC03: Reopening retains the supported scene; keyboard focus recovers after edit/undo; history persistence behavior is explicitly specified.

| Criterion | Evidence that shows it |
| --- | --- |
| 0001-W2-AC01 | Shortcuts act on the focused scene or Board controls only; inside a text field Cmd/Ctrl+Z, Delete/Backspace and copy/paste stay native; Cmd/Ctrl+D duplicates only on the focused scene; Board never touches the system clipboard |
| 0001-W2-AC02 | Unit cases: each of create, move, text session, duplicate and delete undoes and redoes exactly once with correct document state and one revision step each; removed objects retire their generation and returned objects get a fresh one; duplicates get new logical IDs and generations; cap and Redo clearing |
| 0001-W2-AC03 | Save then reload restores the saved board with empty history; focus and selection after each command match interaction v5; commands blocked with reasons during composition, gestures, invalid drafts and read-only |

## Validation commands and expected evidence

From the repository root with the pinned toolchain:

```sh
npm --prefix apps/web ci --ignore-scripts --no-audit --no-fund
npm --prefix apps/web run typecheck
node --test tests/history.test.mjs
npm --prefix apps/web run build
git diff --name-only main...HEAD
```

Run only the new unit tests: this change adds the history module and leaves the
code covered by the other test files untouched. Running the whole unit suite needs
an explicit maintainer instruction (see [agent instructions](../../AGENTS.md)).

`tests/history.test.mjs` asserts document state, generations, `retiredGenerations`
and revision counts for: create, move, text session, duplicate and delete each
undone and redone once; a restored delete keeping its logical ID with a fresh
generation while the old generation stays retired; duplicate independence; the
100-step cap; a new step clearing Redo; refusal at 250 objects and at the retired-
generation limit.

One browser pass in Chrome and Safari, recorded by whoever can run a browser:
each command by button and by shortcut on the scene; Cmd/Ctrl+Z and Delete inside
a text field acting on text only; focus after each command; Save, reload, empty
history. No browser matrix, fixtures sweep, accessibility audit or IME checks
unless the maintainer asks.

## Exclusions and reasons

Multi-select and group actions (later milestones), object copy and paste (later),
collaborative or persisted history, board-title undo, rich text, OS-wide clipboard,
a history panel, new object types and geometry changes.

## Public references with retrieval dates

No new external reference. Interaction v4's references (retrieved 2026-10-22)
apply; behavior above is a project requirement.

## Version history

- v2 (2026-10-22): the unit-test command runs only `tests/history.test.mjs`, in
  line with the focused-testing rule. No other requirement changed.

## Implementation record

Implementation handoff dated 2026-10-22 for **0001-W2 v2**, governed by
[interaction v5](../architecture/0001-interaction-v5.md).
Branch: `codex/0001-W2-edit-focus-undo`; worktree: `.worktrees/codex-0001-W2`.
Committed main base: `9930173a5e912705f8ad97a43fb27e61b7ab96cc`.
Validated source/test revision: `e95f36e5c0f561396741bed1b83aac362f8f5547`.
Checks below ran against these same source/test bytes before the source commit;
the subsequent clean diff confirmed no source change. This implementation record
is a separate documentation commit. The final branch tip is reported separately.

`history.ts` implements immutable single-object steps, a 100-step cap, Redo
clearing, duplicate/delete, generation retirement and fresh incarnations on
restoration. History commands reject stale incarnations and limit violations
without mutating their inputs. Restorations preserve logical IDs and reading
order; retired generations accumulate. History never changes the board title.

`App.tsx` records creation and completed moves, and groups object text changes
from editor entry to blur, editor close or selection change. Existing valid-input
document commits and save-revision tracking remain intact; grouping history does
not delay valid text reaching Save. Undo/Redo each adopt one document transaction.
The new buttons, scene/control shortcuts, blocking explanations, selection/focus
outcomes and status messages follow interaction v5. Undo/Redo use `aria-disabled`
with activation guards so their initiating control can retain focus when a list
becomes empty. Native text editing shortcuts and clipboard events are untouched.
Reopen, initial load, page hide and writer-ownership changes clear in-memory
history; Save does not. Original inline SVG commands and their styles extend the
existing icon set. No external asset or dependency was added.

The supplied pinned toolchain was selected in the shell before every Node/npm
command and commit hook invocation. Its machine-specific location is omitted
from this public record as instructed.

| Exact command | Actual result |
| --- | --- |
| `node --version` | PASS, exit 0: `v24.22.1` |
| `npm --version` | PASS, exit 0: `11.19.1` |
| `npm --prefix apps/web ci --ignore-scripts --no-audit --no-fund` | PASS, exit 0; added 19 packages; manifest and lock unchanged |
| `npm --prefix apps/web run typecheck` | PASS, exit 0 on initial integration and final source bytes |
| `node --test tests/history.test.mjs` | PASS, exit 0; initially 9 tests, then all 10 on final source/test bytes after adding stale-history protection |
| `npm --prefix apps/web run build` | PASS, exit 0 on final source bytes; accepted lock, runtime inventory and complete distributed notices verified; built application |
| `git diff --check` | PASS, exit 0 before source commit |
| `git diff --exit-code -- apps/web/src/document.ts apps/web/src/storage.ts apps/web/package.json apps/web/package-lock.json` | PASS, exit 0; protected files unchanged |
| `git diff --cached --stat` | Inspected before source commit: only App.tsx, history.ts, icons.tsx, style.css and history.test.mjs |
| `git commit -m "feat(web): add focused editing commands and session undo"` | PASS, exit 0; created validated revision above; both mandatory public-boundary hooks reported PASS. Git also emitted a sandbox-denied packed-refs lock error; the commit exists and no hook was bypassed. |
| `git rev-parse HEAD` | Returned validated source/test revision above |
| `git diff --exit-code` | PASS, exit 0 after source commit; validated source/test bytes unchanged |
| `git status --short` | Clean after source commit |
| `git diff --name-only main...HEAD` | At validated source/test revision, lists only the five allowed source/test files. The documentation commit adds this implementation record only. |

Unit assertions cover create, move, text-session, duplicate and delete undo/redo;
document state, adapter transaction counts, logical IDs, active and retired
generations, reading order, duplicate independence, mixed-history restoration,
stale-incarnation rejection, bounds, the cap, Redo clearing and atomic refusal at
250 objects and 10,000 retired generations. These are pure-module/adapter tests;
they do not establish App focus, native input or browser persistence behavior.

No browser was launched because browsers cannot start in this environment.
The single Chrome/Safari pass for commands by button/shortcut, native text undo
and deletion, focus, and Save/reload with empty history remains **UNVERIFIED** for
the independent reviewer of this exact revision. AC01 and AC03 runtime acceptance
therefore remains pending; AC02 has the unit evidence above, with UI wiring still
requiring the browser pass. No other unit files, browser fixtures/matrices,
accessibility audits, native IME checks or performance/load checks ran.

Document/storage modules, saved format, explicit-save policy, geometry defaults,
placement, other tools, package files and lock are unchanged. Added dependencies:
none. Codebase graph discovery/indexing was attempted but rejected by the
environment's approval policy; source was read directly. No push, merge,
publication, deployment or later milestone was performed.
