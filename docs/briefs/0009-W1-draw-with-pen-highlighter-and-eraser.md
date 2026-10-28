BRIEF VERSION: 0009-W1 v1 (2026-10-27)
# 0009-W1 — Draw with pen, highlighter and eraser

Status: Draft. Implementation starts only after the maintainer commits this brief,
[0001 document v8](../architecture/0001-document-v8.md),
[0001 interaction v22](../architecture/0001-interaction-v22.md) and
[0001 web modules v20](../architecture/0001-web-modules-v20.md) to main.

## Outcome

A **Draw** button in the bottom toolbar arms the **Marker**, the **Highlighter** or the
**Eraser**, and a drawing bar above the toolbar chooses Thin or Thick and one of eight colours per
tool. Press and drag draws a smooth line; the highlighter's ink is wide and see-through, so text
under it stays readable. The eraser removes every line it touches, whole, in one step. A drawn
line is an ordinary object: it can be selected, recoloured, made thicker, resized, moved, copied,
grouped and put in a section, and it is saved with the board.

- Lines are a new saved type, `stroke`, in **document v8**. Boards saved by earlier versions open
  unchanged and are saved as version 8 at the next Save; an older copy of Board shows a version 8
  board as unsupported and changes nothing.
- The eraser only removes lines. Stickies, text, shapes, sections and connectors are never erased.

"Today" means `c8bf3f7`. Boards look and behave as today except for the Draw button, the drawing
bar, strokes and what they bring with them (document version 8, the popups above the toolbar).

## Read first and prerequisite contracts

- [Contributor guidance](../../CONTRIBUTING.md), [agent instructions](../../AGENTS.md) and
  [engineering standards](../../DESIGN.md).
- [0001 document v8](../architecture/0001-document-v8.md): the stroke type and its keys, ink
  colours, points and padding, eligible ideas, version 1 to 7 reading, older applications, the
  version references in board file v1, storage v2 and activity catalogue v1, and the adapter.
- [0001 interaction v22](../architecture/0001-interaction-v22.md): the Draw button, keys and
  arming; the drawing bar; drawing (the click rule, smoothing, thinning, Shift); how strokes are
  drawn; erasing; selecting; resizing and the stroke floor; the context bar; mixed selections;
  Objects; copies; templates; history.
- [0001 web modules v20](../architecture/0001-web-modules-v20.md): the new modules, the registry's
  split of eligible ideas, and the guard change.
- [0001 storage v2](../architecture/0001-storage-v2.md),
  [0006 board file v1](../architecture/0006-board-file-v1.md),
  [0008 activity catalogue v1](../architecture/0008-activity-catalogue-v1.md) and
  [0001 toolchain v1](../architecture/0001-toolchain-v1.md): unchanged except for the version
  references document v8 lists. No new dependency.
- [0001-W24 v1](0001-W24-selection-layouts-editor-hooks.md)'s comparison procedure (scenarios
  A–J) is reused by the reviewer.

## Deliverables and boundaries

Paths are under `apps/web/` unless they start with `tests/`. The contracts say what each
behaviour is; this list says where it goes. These are the only files that may change.

**New files (six).**
1. **`src/objects/stroke.ts`**: the stroke type record (web modules v20): saved keys in document
   v8's order, validation of kind, colour, weight and points (document v8's stroke rules), the
   ink colours with their names, labels and values, ink widths, the drawing tool names, the
   default session style, label prefixes and the context label.
2. **`src/strokes.ts`**: the rules in web modules v20: drawing points (click rule, smoothing,
   thinning, Shift line, rounding, board edges), the rectangle and relative points, making a
   stroke, weight changes, the hit tests (painted ink, 8 pixels), the eraser's swept 6-pixel test,
   box containment, and scaling with the stroke floor. No React, Konva or DOM; no type-name or
   kind-name comparison.
3. **`src/scene/stroke-body.tsx`**: one stroke's line (ink colour and width, round or flat ends,
   round joins, multiply blending for the highlighter) and its selected outline.
4. **`src/ui/drawing-tools.tsx`**: `DrawButton` and `DrawingBar`, with their icons.
5. **`src/ui/stroke-controls.tsx`**: the stroke context bar controls (label, Colour, Weight,
   Delete) and Objects' Stroke colour and Stroke weight fields with their keys.
6. **`tests/strokes.test.mjs`**: as listed under validation.

**Changed rules modules.**
7. **`src/document.ts`**: document v8 (the stroke's keys and checks, connector ends not on
   strokes, version 1 to 7 reading and upgrade, canonical form, the adapter's points value, the
   version 8 board types).
8. **`src/board-file.ts`**, 9. **`src/storage.ts`**: "newer" is above 8.
10. **`src/activities.ts`**: a version 7 activity onto a version 8 board; the board's box
    includes strokes.
11. **`src/clipboard.ts`**: copies of strokes keep kind, colour, weight and points; plain text
    leaves strokes out.
12. **`src/connectors.ts`**: ends and targets are eligible ideas only (never strokes).
13. **`src/gesture.ts`**, 14. **`src/group.ts`**, 15. **`src/sections.ts`**: strokes as section
    ideas (membership by centre, groups, labels "marker stroke *n*" / "highlight *n*" with group and
    section parts, no text part).
16. **`src/resize.ts`**: the nearest corner when handle hit areas overlap.

**Changed object types.**
17. **`src/objects/registry.ts`**: the stroke type, "has points", section idea and eligible idea.
18–22. **`src/objects/connector.ts`**, **`section.ts`**, **`shape.ts`**, **`sticky.ts`**,
    **`text.ts`**: only what the registry's new fields require.

**Changed scene parts.**
23–26. **`src/scene/board-drawing.tsx`** (draws strokes in the idea band and the drawing preview), **`inline-editor.tsx`**, **`note-body.tsx`**,
    **`section-body.tsx`**: only what objects without text require.

**Changed state hooks** (each keeps its ownership, web modules v20):
27. **`src/state/use-gesture-state.ts`**: the last drawing tool, the session style, clearing the
    selection on arming, and arming Select when another route selects while a drawing tool is
    armed.
28. **`src/state/use-canvas-input.ts`**: the drawing and erasing gestures, the drawing keys, the
    stroke hit tests, the nearest handle.
29. **`src/state/use-geometry-edits.ts`**: proportional resizing of selections holding strokes,
    with each object's floor.
30. **`src/state/use-editing-commands.ts`**: stroke colour and weight, mixed selections, Undo
    and Redo selecting nothing while a drawing tool is armed.
31. **`src/state/use-selection.ts`**: what a selection holding strokes offers (stroke colour and
    weight; no text controls).
32–38. **`use-board-document.ts`**, **`use-command-reasons.ts`**, **`use-editor-placement.ts`**,
    **`use-object-layouts.ts`**, **`use-page-keys.ts`**, **`use-storage-session.ts`**,
    **`use-validity.ts`**: the version 8 types and objects without text only.

**Changed screen parts.**
39. **`src/ui/palette.tsx`**: the Draw button after the Shapes tool, and the drawing bar.
40. **`src/ui/context-bar.tsx`**, 41. **`src/ui/objects-panel.tsx`**: the stroke controls and
    fields; mixed selections.
42–45. **`src/ui/board-panel.tsx`**, **`content-field.tsx`**, **`format-preview.tsx`**,
    **`shape-controls.tsx`**: the version 8 types and objects without text only.
46. **`style.css`**: the drawing bar (positions, scrolling, pressed states, the eraser's
    unavailable controls), the ink menus, and the open menus above the toolbar.

**Composition.**
47. **`src/App.tsx`**: passes the drawing and stroke values on existing lines or lines it needs.
    It must not exceed **262 lines**, its budget.

**Changed tests.**
48–55. **`tests/board-catalog.test.mjs`**, **`board-file.test.mjs`**, **`connectors.test.mjs`**,
    **`document.test.mjs`**, **`modules.test.mjs`**, **`objects.test.mjs`**, **`shapes.test.mjs`**,
    **`storage.test.mjs`**: version 8 where they assert the newest version, a future version of 9,
    and the guard counts below.

No other module changes: no `history.ts`, `notice.tsx`, `icons.tsx`, other hook, other screen
part, `main.tsx`, activity files, packages, locks, contracts, build scripts or other tests. If
something seems to need more, stop and report it.

New source files use `SPDX-License-Identifier: Apache-2.0`. Append the implementation record
below with the branch, validated revision, commands, results and exclusions; report the final
branch tip separately.

## Numbered acceptance criteria

- 0009-W1-AC01: Create editable pen and highlighter strokes using the selected tool and bounded style controls.
- 0009-W1-AC02: Erase under declared stroke/object semantics without deleting unrelated content.
- 0009-W1-AC03: Undo and save/reopen supported strokes through the versioned document model.

| Criterion | Evidence that shows it |
| --- | --- |
| 0009-W1-AC01 | Scenario R: R1–R23 (button, bar, keys, drawing), R25 and R32–R48 (selecting, editing, Objects, mixed selections), R54–R58 (limit, click rule, stroke floor, arming, narrow bar); unit tests in `tests/strokes.test.mjs` |
| 0009-W1-AC02 | Scenario R: R26–R31 (erasing by click and drag, unrelated objects unchanged, Escape); unit tests (swept test, painted ink, flat ends) |
| 0009-W1-AC03 | Scenario R: R24, R27, R29 (Undo and Redo), R49–R53 (save and reopen, version 7 board, older application, board file); unit tests (document v8, adapter, canonical form) |

## Validation commands and expected evidence

From the repository root with the pinned toolchain:

```sh
npm --prefix apps/web ci --ignore-scripts --no-audit --no-fund
npm --prefix apps/web run typecheck
node --test tests/strokes.test.mjs tests/document.test.mjs tests/modules.test.mjs
npm --prefix apps/web test
npm --prefix apps/web run build
npm --prefix apps/web run build:fixtures
git diff --name-only main...HEAD
```

The change touches the saved format, storage, the registry and `App.tsx`, so the implementer runs
the full unit suite (`npm --prefix apps/web test`) and reports any failure, saying whether it also
fails at `c8bf3f7`.

**`tests/strokes.test.mjs`** (new) covers:
- document v8: a stroke's exact keys and order; each kind's eight colour names and a name from the
  other kind rejected; weights; text, textSize, align or marks on a stroke rejected; kind, weight or
  points on another type rejected; 1 and 1,001 points rejected, 2 and 1,000 accepted; a non-integer
  or out-of-box point rejected; padding exact (smallest point equals the pad, largest plus the pad
  equals the size) for each ink width; a connector end on a stroke rejected; a stroke in a version
  7 document rejected;
- canonical form and reading: a version 8 board with strokes round-trips byte for byte; each
  version 1 to 7 board reads unchanged and serializes byte for byte until edited; the upgrade is
  not an edit;
- the adapter: points held as one value; projection and re-creation give back kind, colour,
  weight and points; Undo and Redo of a stroke;
- drawing: a marker click gives two equal points and a 4 × 4 (thin) rectangle; a highlighter click
  gives nothing; smoothing (previous + 2 × this + next) ÷ 4 with the ends kept; 2,500 positions
  thinned to exactly 1,000 with the ends kept and the index rule; Shift gives two points; rounding;
  a stroke near the board's edge kept inside it;
- hit tests: within 8 pixels of the centreline at zoom 1 and 2 (including 5 units from a thin
  marker's centreline, off its ink); on a thick highlight's painted ink away from the centreline;
  not on an empty part of the rectangle; not past a highlight's flat end beyond 8 pixels; box
  containment, and a stroke outside the box selected through its group;
- erasing: a path crossing a stroke between two pointer positions (a fast sweep); a click on ink;
  6 pixels at zoom 1 and 2; never another type;
- resizing: points scaled about the opposite corner, weight kept, rectangle recomputed; the stroke
  floor (larger centreline side 8; a dot does not shrink); no 80-unit floor for strokes; a mixed
  selection stops at the first floor; the board's edges; the nearest corner and the tie order;
- weight: the centreline unchanged and the rectangle grown by the pad change; refused at the
  board's edge;
- mixed selections: ordinary colour leaves strokes unchanged; stroke colour refused across kinds;
- copies: kind, colour, weight and points kept, fresh identities, group and section remapped;
  the plain text of a copy leaves strokes out with no separator (`[A, stroke, B]` gives A's and
  B's text with one separator; strokes only give an empty string).

**`tests/modules.test.mjs`**: object types seven (adding `stroke.ts`), scene parts nine (adding
`stroke-body.tsx`), screen parts twenty-three (adding `drawing-tools.tsx` and
`stroke-controls.tsx`), the type-name guard adding `stroke`, `marker` and `highlighter`; hooks
nineteen and the `App.tsx` budget 262, unchanged.

**The other changed tests** assert version 8 where they assert the newest version and use 9 for a
future version. `tests/objects.test.mjs` also lists the stroke type among the types and asserts
the split of eligible ideas (a stroke is a section idea, not a connector end). No other
expectation changes; `tests/activities.test.mjs` stays as it is (activity files are still read
as version 7).

Reviewer checks (not run by the implementer; browsers cannot start there):

- **Scenario R** (new behaviour), with real mouse and keyboard input in fresh contexts at
  1280 × 800 and 100% zoom (R58 at 390 × 844), once on the candidate and once on a build of
  `c8bf3f7` as a negative control: there the Draw button is absent, so the run marks every
  dependent check failed, runs R59, and exits with a failure. Saved records are read after each
  Save, waiting for "Locally saved". Crafted stored records are used only for the starting ideas,
  the version 7 board (R50), the older application's round trip (R51–R52), the board file (R53)
  and the 250-object board (R54). Every stroke used is drawn. The tool is
  `tools/browser-compare/strokes-check.mjs` in the private repository; the check run keeps its
  order and may adjust its steps, keeping each check's meaning.
  - **R1–R2** Draw is directly after the Shapes tool and shows the Marker icon; activating it arms
    the Marker and shows the drawing bar above the toolbar in the contract's order.
  - **R3–R7** The marker's eight colours with Black pressed and Thin; each kind keeps its own
    colour and weight; the highlighter starts Thin Yellow with its eight colours; the Eraser
    greys out weights and colours and shows the circle pointer.
  - **R8–R15** Draw re-arms the last tool, the Eraser included; M, Shift+M, Shift+Delete and
    Shift+Backspace; Escape returns to Select; another tool hides the bar; the keys do nothing in
    Objects' Content field and Enter draws nothing.
  - **R16–R23** A marker and a highlighter drag each save one version 8 stroke with exact keys and
    valid points; the drawn look (widths, ends, multiply) matches; a long drag is thinned to 1,000
    points; Shift draws two points; Escape cancels and keeps the tool; no editor opens; strokes
    enter the idea band, newest on top.
  - **R24** One Undo removes the last stroke; Redo restores its ID and points.
  - **R25** A thin straight stroke resizes from its bottom-right corner (nearest handle).
  - **R26–R31** An eraser click removes the touched stroke only; one Undo restores it; one drag
    removes several strokes whole and nothing else; one Undo restores them all; a click on a
    sticky changes nothing; Escape cancels an erasing drag.
  - **R32–R34** Select within 8 pixels of the line; an empty part of the rectangle does not
    select; box selection takes a whole stroke only.
  - **R35–R38** Colour and Weight menus (eight colours; Thin and Thick, the ink staying in place);
    four corner handles, no dots, the context bar "Marker", Colour, Weight, Delete; proportional
    resize with valid points.
  - **R39–R45** Move keeps the points; Copy and Paste and Duplicate give fresh identities; Group;
    order within the idea band; Section from selection; Connect refused.
  - **R46–R48** Objects' labels and fields; the keyboard route (choose, colour, weight, move, size);
    mixed selections (ordinary colour separate, weight on strokes, no alignment, no shared colour
    across kinds).
  - **R49–R53** Save and reload keep strokes exactly; a version 7 board opens unchanged and saves
    as version 8; the `c8bf3f7` application shows a version 8 board as unsupported with Save
    unavailable, draws nothing and keeps the bytes; the candidate then opens the same bytes; a
    board file holding strokes opens with its points.
  - **R54** At 250 objects drawing adds nothing, with the limit notice.
  - **R55** A marker click saves a dot; a highlighter click adds nothing.
  - **R56** A diagonal stroke shrinks to 12 × 12 (8 units of centreline plus a thin marker's 4) and
    no further, below the 80-unit floor of other ideas.
  - **R57** Arming a drawing tool empties the selection; undoing an erase while the Eraser is armed
    restores the stroke and selects nothing.
  - **R58** At 390 × 844 the bar is one row between 12-pixel margins, above the toolbar, and
    scrolls sideways.
  - **R59** No dialogs, page errors or console errors.

Recommended regression checks, run only if the maintainer accepts them (this change touches the
saved format, storage, the registry, the canvas input, the palette and `App.tsx`):

- **The full unit suite** in a clean clone, separating failures new to the candidate from
  failures that also occur at `c8bf3f7`.
- **Previous behaviour.** Scenarios A–J of the 0001-W24 v1 brief's comparison on a build of
  `c8bf3f7` and on the candidate, with 0002-W2's adjusted starts in both runs (I2's marquee from
  (−140, −40) and I4's from (−240, 40)). Before comparing, both runs are normalized with exactly
  these two masks, and nothing else: the Draw button is removed from the bottom toolbar's markup;
  a saved version 8 record that holds no stroke is compared as the same record with
  `schemaVersion` 7. After the masks the candidate must match at every checkpoint in markup,
  focus, canvas drawing and saved records. The masks are
  `tools/browser-compare/strokes-normalize.mjs` in the private repository.
- **Earlier scenarios on the candidate**, each with its version assertions moved to 8 (and future
  data to 9): O (connectors, O10 and O71), N (shapes, N56), M (sections, M3), K (formatting, K4),
  L (unchanged), P (board files with `--baseline` at a `c8bf3f7` build: P19 and P50 use version 9
  as the future version; P46 and P47 check that the `c8bf3f7` application refuses the version 8
  boards and keeps every board pair, then the candidate reopens them) and Q (templates, Q21 saves
  a version 7 board as version 8).
- **Regression harness.** The eight PASS lines at the fixture index page and at
  `regressions.html` ([tests README](../../tests/README.md)), in headless Chrome.

The maintainer checks three items drawn from scenario R in Safari, one picked by the reviewer:
R18 (the highlighter's multiply blending over text). No browser matrix, accessibility audit,
phone layout check beyond R58, or performance test unless the maintainer asks.

## Exclusions and reasons

- Partial erasing (cutting a line in two); erasing other object types.
- Highlights that follow the sticky or shape under them; attaching strokes to objects.
- Other pens (washi tape), custom colours, pressure, tilt, shape recognition, drawing inside a
  sticky's text.
- Connector ends on strokes; image export.
- Fixes for bugs noticed on the way (report them).

## Public references with retrieval dates

None beyond the repository's own documents.

## Implementation record

### Implementer handoff — 2026-10-27

Implemented **0009-W1 v1 only**, using document v8, interaction v22 and web modules v20.
The Draw button and session drawing bar provide Marker, Highlighter and whole-stroke Eraser;
strokes participate in selection, geometry edits, groups, sections, clipboard, history and
version 8 persistence. The registry distinguishes section ideas, connector-eligible ideas,
text and points. No editor or connection dots are offered for strokes.

- Branch: `codex/0009-W1-drawing`, in the milestone worktree, from committed main
  `1b9d3027ad827a2f3cf30fb2ce04469ef9e1f037`.
- **Validated source/test revision:** `2c1d68a33c4116970ee62e2706ad0bb9ae97b5c6`.
  This includes implementation commit `b8a435bd2acc72a17de3dd97905b64c7659a0c6f` and
  the drawing-limit/history-feedback correction. The final branch tip includes this
  documentation record and is reported separately in the implementation handoff.
- Scope: 54 implementation files, all in the brief's allowlist; this record is the only
  additional changed file. `App.tsx` is 258 lines (budget 262). No unrelated edits were present.
- Dependencies added: **none**. Manifests, locks and dependency versions/licenses are unchanged.
- Runtime for the final checks: Node **24.22.1**, npm **11.19.1**, selected on `PATH`.

All commands below ran from the repository root against the validated source/test revision.

| Exact command | Result |
| --- | --- |
| `node --version` | Exit 0; `v24.22.1`. |
| `npm --version` | Exit 0; `11.19.1`. |
| `npm --prefix apps/web ci --ignore-scripts --no-audit --no-fund` | Exit 0; 19 packages installed. |
| `npm --prefix apps/web run typecheck` | Exit 0; no TypeScript errors. |
| `node --test tests/strokes.test.mjs tests/document.test.mjs tests/modules.test.mjs` | Exit 0; 117 passed, 0 failed, 0 skipped. |
| `npm --prefix apps/web test` | Exit 0; 537 passed, 0 failed, 0 skipped. |
| `npm --prefix apps/web run build` | Exit 0; application built; accepted lock, runtime inventory and complete distributed notices verified. |
| `npm --prefix apps/web run build:fixtures` | Exit 0; disposable fixtures built; the same lock/inventory/notices verification passed. |
| `git diff --name-only main...HEAD` | Exit 0; 54 implementation files, checked against the brief's allowlist. |
| `git diff --check` | Exit 0; no whitespace errors. |

The new stroke tests cover saved keys and padding, kinds/colours/weights, point limits,
legacy bytes and in-memory upgrade, atomic adapter points, history, click/drawing rules,
smoothing and thinning, edges, ink/centreline hits, flat ends, swept erasing, whole-object
box selection and group expansion, proportional resize/floors, handle ties, weight changes,
mixed colours, copy identities and membership, plain-text omission, labels, template placement
and board-file round trips. Existing tests changed only for the new version, type and module
guards. The final full unit suite has no failure to compare with `c8bf3f7`; that baseline
was not run.

During integration, typecheck exposed callers that assumed every rectangle had text. Those
callers now use registry capabilities. Two initial new-test assertions were corrected: a
legacy upgrade is adopted without recording a transaction, and section membership follows the
stroke's centre. An initial install used the shell's newer runtime and emitted an engine
warning; installation and all final checks were rerun with the pinned runtime above.

**Not run:** browsers, scenario R, A–J comparisons/normalization, earlier browser scenarios,
the browser regression harness, Safari checks, native IME checks, performance/load checks or
other broader acceptance sweeps. Browser execution is unavailable in the implementer sandbox
and is explicitly reserved for the reviewer. The fixture build is not a browser test result.
Independent review and milestone acceptance remain pending; this handoff authorizes no merge,
publication or later milestone.

Graph project discovery and indexing were attempted first but the tools required approval
that the sandbox disallows; read-only file searches were used as the fallback. Commits used
normal Git hooks: the public-boundary checks passed. Git also emitted a nonfatal sandbox
lock diagnostic for `.git/packed-refs.lock`; both source/test commits succeeded. Nothing was
stashed, no hook was bypassed, and nothing was pushed.
