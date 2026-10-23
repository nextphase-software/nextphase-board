BRIEF VERSION: 0001-W5 v1 (2026-10-23)
# 0001-W5 — Persist note colors and basic text styles

Status: Draft. Implementation starts only after the maintainer commits this brief,
[0001 document v2](../architecture/0001-document-v2.md) and
[0001 interaction v8](../architecture/0001-interaction-v8.md) to main.

## Outcome

Stickies and text objects can be given one of eight colours, one of four text
sizes and left, centre or right alignment, from the bar above a selected object or
from the Objects panel. Styles are saved and reopened with the board. Each change is
one undo step and touches nothing else. Boards saved earlier open looking exactly as
before, and nothing is written until the next Save.

## Read first and prerequisite contracts

- [Contributor guidance](../../CONTRIBUTING.md), [agent instructions](../../AGENTS.md)
  and [engineering standards](../../DESIGN.md).
- [0001 document v2](../architecture/0001-document-v2.md): the saved format (style
  keys, the version 1 read rule and defaults, per-version canonical output, the
  adapter's style value).
- [0001 interaction v8](../architecture/0001-interaction-v8.md): the governing
  behavior (palette, sizes, alignment, growth with size, controls, transactions,
  editor, opening older boards).
- [0001 storage v1](../architecture/0001-storage-v1.md): unchanged. It validates
  payloads under the document contract and keeps head and previous records.
- [0001 toolchain v1](../architecture/0001-toolchain-v1.md): unchanged; no new dependency.

## Deliverables and boundaries

1. A new pure module `apps/web/src/styles.ts` holding interaction v8's style tables:
   the eight colours (name, label, sticky fill, sticky edge, text-object colour), the
   four text sizes (name, label, board units), the three alignments and the defaults
   for new and version 1 objects. Erasable TypeScript only, so the Node test runner
   can load it the way the existing tests load `document.ts`.
2. `apps/web/src/document.ts`: board and object types for versions 1 and 2;
   `validate` accepting a version 1 document exactly as document v1 defines it and a
   version 2 document as document v2 defines it; `canonical` serializing a board in
   the version it carries; an upgrade function that returns the version 2 board for
   a version 1 board with document v2's defaults; `empty()` and `add()` producing
   version 2 boards and objects with the new-object defaults; the adapter's atomic
   style value. Identity, limit and bound rules do not change.
3. `apps/web/src/geometry.ts`: needed height for a given text size in board units,
   with the allowed, saved and display rules unchanged in form.
4. `apps/web/src/App.tsx`: upgrade a version 1 board when it is adopted for editing
   or shown, without advancing the revision, recording history or marking it
   Unsaved; draw fills, edges, text colours, sizes and alignment from the style; the
   bar's Colour (with the swatch popover), Text size and Alignment controls and the
   Objects panel's three controls, with v8's availability, focus and blocking rules;
   one transaction per style change, including growth for a larger size; ending the
   text-editing session before a style change; the editor's size, alignment, colour
   and fallback threshold.
5. `apps/web/style.css` and `apps/web/src/icons.tsx`: the controls, popover and
   alignment icons, following the 0001-W3 icon rules.
6. Tests: see Validation.

New source files use `SPDX-License-Identifier: Apache-2.0`. Do not change
`storage.ts`, `history.ts`, `view.ts`, storage format or rules, persistence,
explicit-save policy, placement, navigation, other tools, package files or the lock.
`tests/browser/fixtures.ts` may change only if typecheck requires it. If a
requirement seems to need any other change, stop and report it.

Append the implementation record below with the branch, validated revision,
commands, results and exclusions; report the final branch tip separately.

## Numbered acceptance criteria

- 0001-W5-AC01: Apply a bounded original color palette and declared text size/alignment to the intended note or text object.
- 0001-W5-AC02: Save and reopen the supported styles through a versioned document projection with explicit older-data defaults.
- 0001-W5-AC03: Undo and redo one style transaction while preserving text and unrelated object styling.

| Criterion | Evidence that shows it |
| --- | --- |
| 0001-W5-AC01 | Each of the eight colours, four sizes and three alignments applied from the bar and from Objects changes only the selected object; stickies change fill and edge with text unchanged, text objects change text colour; a larger size grows a full note in the same step; new objects keep today's look |
| 0001-W5-AC02 | Save and reload keep every style; a document v1 board opens looking unchanged, stays byte-identical in storage and not Unsaved until an edit and Save, after which head is version 2 and previous is the version 1 record; document v2 rejects unknown style values and missing or extra keys |
| 0001-W5-AC03 | One style change is one undo step that restores exactly the previous style, including size and its growth together, with the object's text and every other object unchanged; choosing the current value records nothing |

## Validation commands and expected evidence

From the repository root with the pinned toolchain:

```sh
npm --prefix apps/web ci --ignore-scripts --no-audit --no-fund
npm --prefix apps/web run typecheck
node --test tests/styles.test.mjs tests/document.test.mjs tests/geometry.test.mjs tests/history.test.mjs tests/storage.test.mjs
npm --prefix apps/web run build
git diff --name-only main...HEAD
```

Run only these five unit test files:

- `styles.test.mjs` is new.
- `document.test.mjs` covers the changed validation, canonical form, defaults and adapter.
- `geometry.test.mjs` covers the changed needed height.
- `history.test.mjs` checks that a style change is one step through the unchanged history module.
- `storage.test.mjs` checks that its unchanged decoder accepts the new format and the mixed head and previous pair.

Running anything broader needs an explicit maintainer instruction (see
[agent instructions](../../AGENTS.md)).

Unit cases, with assertions on document state, bytes and revision counts:

- **`styles.test.mjs`**: every name in document v2 has an entry; every sticky fill
  with `#28272c` and every text-object colour on `#fafafa` reaches at least 4.5:1
  under WCAG's relative-luminance formula; the defaults match document v2.
- **`document.test.mjs`**:
  - Existing version 1 cases still pass, and version 1 documents still round-trip
    byte for byte.
  - The existing "unknown version" case uses version 3 instead of 2.
  - Version 2 accepts every style value and rejects unknown values, missing keys and
    extra keys on either object type.
  - Canonical output places the style keys after `text` in version 2 and omits them
    in version 1.
  - The upgrade applies the sticky and text defaults without changing anything else.
  - `add()` and `empty()` produce version 2 with the new-object defaults.
  - The adapter holds the style value and keeps one transaction per change.
- **`geometry.test.mjs`**: needed height for one and many lines at each size;
  growth at a larger size up to the allowed height; no shrink at a smaller size.
- **`history.test.mjs`**:
  - A style change records one step; undo and redo restore the exact style with
    text and other objects unchanged.
  - A size change with growth undoes size and height together.
  - Duplicate copies the style.
  - A restored object gets its style back.
- **`storage.test.mjs`**: a valid pair with a version 2 head and a version 1
  previous decodes; a version 1 record's raw bytes are preserved; an unknown
  version is still rejected.

One browser pass in Chrome and Safari, recorded by whoever can run those browsers:

- **Controls:** each control in the bar and in Objects on a sticky and a text
  object; Escape closing the swatch popover with focus back on Colour.
- **Growth and undo:** Extra large growing a full note, with one undo reverting both.
- **Persistence:** Save and reload keeping styles.
- **Older boards:** a board saved by the build before this change opens looking the
  same, with its stored bytes unchanged and no Unsaved state until an edit; after
  Save, head is version 2 and previous is the earlier record.
- **Older builds:** that board, reopened in the earlier build, is read-only with
  nothing written.

No browser matrix, fixtures sweep, accessibility audit or IME checks unless the
maintainer asks.

## Exclusions and reasons

Rich text such as bold, italic, links and lists, custom colours or a colour picker,
styling several objects at once, borders and shapes, font families, per-board
default colours, vertical alignment, resize and new dependencies are later or out of
scope.

## Public references with retrieval dates

Interaction v8 cites WCAG 2.2 success criterion 1.4.3 (retrieved 2026-10-23).
Document v1's and interaction v4's references (retrieved 2026-10-22) still apply.

## Implementation record

Implementation handoff dated 2026-10-23 for **0001-W5 v1**, using document v2
and interaction v8. Independent review and browser acceptance remain pending.

Branch: `codex/0001-W5-note-styles`; worktree: `.worktrees/codex-0001-W5`.
Committed main base: `96485b5f9db08f70f9f1a85ec5afd427657db048`.
Validated source/test revision: `eecf754c492283102e895a8c12285a25049478ed`.
The final checks ran against these exact source/test bytes before their commit.
This implementation record is a separate documentation commit; the final branch
tip is reported separately in the handoff.

The implementation adds the eight-colour palette, four sizes and three alignments
through the selection bar and equivalent native Objects controls. The bar measures
its contents, clamps within the scene and yields to Objects when it cannot fit.
The swatch popover marks the current colour, supports Escape and focus return,
and dismisses on outside pointer/focus movement or selection/bar changes. The
renderer, fade and on-canvas editor use the selected style; the editor fallback
uses the object's own size times zoom. A style change ends text editing first,
records one object transaction, and includes any size-driven height growth in
that step. Choosing the current value makes no document/history change.

Version 1 remains independently valid and canonicalizes without style keys.
Adoption upgrades only the in-memory board, including read-only snapshots, without
advancing its draft revision, recording history, marking it Unsaved or writing
storage. Version 2 serializes the required style keys after text. The adapter stores
one atomic style value alongside geometry. Existing duplicate/restoration logic
copies the style without changes to history.ts.

| Criterion | Source/unit evidence and remaining boundary |
| --- | --- |
| 0001-W5-AC01 | Style tables cover every declared name and pass the WCAG contrast formula; needed height is covered at all four sizes with grow-only and bottom-edge bounds. Both control routes, rendering, focus and fallback are implemented; browser observations remain unverified. |
| 0001-W5-AC02 | Existing document cases pass for v1 and v2; all style combinations validate on both types; unknown, missing and extra values/keys reject. Tests assert per-version canonical bytes, defaults, upgrade preservation and mixed v2 head/v1 previous decoding with legacy bytes unchanged. Actual browser Save/reload and older-build read-only behavior remain unverified. |
| 0001-W5-AC03 | Tests assert one adapter transaction/history step per style change, exact undo/redo with unrelated content preserved, combined size/height undo, copied/restored styles, separate text/style steps and no-op history preservation. Actual UI command/focus journeys remain unverified. |

The pinned toolchain was selected in the shell before every Node/npm command;
its machine-specific location is deliberately omitted from this public record.

| Exact command | Actual result |
| --- | --- |
| `node --version` | PASS, exit 0: `v24.22.1` |
| `npm --version` | PASS, exit 0: `11.19.1` |
| `npm --prefix apps/web ci --ignore-scripts --no-audit --no-fund` | PASS, exit 0; added 19 packages. Manifest and lock unchanged. |
| `npm --prefix apps/web run typecheck` | PASS, exit 0 on both runs, including final source bytes. Browser fixture source typechecked unchanged. |
| `node --test tests/styles.test.mjs tests/document.test.mjs tests/geometry.test.mjs tests/history.test.mjs tests/storage.test.mjs` | PASS, exit 0: initially 46/46; final run after explicit button-focus handling and the text/style-session regression, 47/47; zero failures, skips or cancellations. Only these five test files ran. |
| `npm --prefix apps/web run build` | PASS, exit 0; accepted lock, runtime inventory and complete distributed notices verified; application built. |
| `git diff --check` | PASS, exit 0 before the source/test commit. |
| `git diff --name-only main -- apps/web/src/storage.ts apps/web/src/history.ts apps/web/src/view.ts apps/web/package.json apps/web/package-lock.json` | PASS, exit 0, no output: all five prohibited files unchanged. |
| `git diff --cached --check` | PASS, exit 0 before the source/test commit. |
| `git diff --cached --stat` | Inspected: only the eleven permitted source/test files, including new styles.ts and styles.test.mjs. |
| `git commit -m "feat(web): persist note colors and basic text styles"` | PASS, exit 0; both mandatory public-boundary hooks passed. Git also reported a sandbox-denied packed-refs.lock creation; the commit exists, and no hook was bypassed. |
| `git diff --name-only main...HEAD` | PASS, exit 0 at the validated source/test revision: only the eleven permitted source/test files. The subsequent record commit adds only this brief. |
| `git status --short` | Clean immediately after the source/test commit, before this record was added. |

Added dependencies and assets: **none**. storage.ts, history.ts, view.ts, package
files, the lock, browser fixtures, storage rules, explicit-save policy, placement
and navigation are unchanged. Graph discovery/indexing was attempted but blocked
by the environment's approval policy; direct source reads were used as fallback.

No browser was launched, as explicitly required for this environment. The brief's
single Chrome/Safari pass remains with the independent reviewer: both control
routes on both object types, swatch Escape/focus behavior, Extra large growth and
one-step undo, Save/reload, legacy opening with unchanged stored bytes and no
Unsaved state, subsequent v2 head/v1 previous storage, and older-build read-only
behavior. No browser fixtures or matrix, accessibility audit, native IME checks,
performance tests or other unit files were run. No browser evidence or full
milestone acceptance is claimed. No push, merge, publication, deployment or later
milestone was performed.
