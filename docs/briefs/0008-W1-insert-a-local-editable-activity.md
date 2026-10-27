BRIEF VERSION: 0008-W1 v1 (2026-10-27)
# 0008-W1 — Insert a local editable activity

Status: Draft. Implementation starts only after the maintainer commits this brief, its three
activity files, [0008 activity catalogue v1](../architecture/0008-activity-catalogue-v1.md),
[0001 interaction v21](../architecture/0001-interaction-v21.md) and
[0001 web modules v19](../architecture/0001-web-modules-v19.md) to main.

## Outcome

A **Templates** button in the bottom toolbar opens a small gallery of ready-made activities
written for Board: Retrospective, Brainstorm and Kanban. **Add template** copies an activity's
stickies, text, shapes, sections and connectors onto the board as ordinary objects you can edit,
move or delete. They land to the right of what is already on the board, the view moves to them,
and they are all selected; one Undo takes the whole activity away again.

- Adding an activity works as Paste does: new identities, sections, groups and connector ends
  pointing at the copies, one history step.
- The activities ship with the app, each with its author and licence shown on its card. Adding
  one never changes it, and the board stores nothing extra: the saved format stays document v7.

"Today" means `6fe6a7f`. Boards look and behave as today except for the Templates button and
panel and adding an activity.

## Read first and prerequisite contracts

- [Contributor guidance](../../CONTRIBUTING.md), [agent instructions](../../AGENTS.md) and
  [engineering standards](../../DESIGN.md).
- [0008 activity catalogue v1](../architecture/0008-activity-catalogue-v1.md): where activities
  live, the catalogue's fields, what an activity file must be, provenance.
- [0001 interaction v21](../architecture/0001-interaction-v21.md): the Templates button and
  panel, placement, copies, history, selection and view, the notice and limits.
- [0001 web modules v19](../architecture/0001-web-modules-v19.md): the new modules, the
  clipboard's shared copy step, and the guard change; v12's rules unchanged.
- [0001 document v7](../architecture/0001-document-v7.md),
  [0001 storage v2](../architecture/0001-storage-v2.md),
  [0006 board file v1](../architecture/0006-board-file-v1.md) and
  [0001 toolchain v1](../architecture/0001-toolchain-v1.md): unchanged. No new dependency.
- The three activity files: [retrospective](0008-W1-activities/retrospective.nextboard),
  [brainstorm](0008-W1-activities/brainstorm.nextboard) and
  [kanban](0008-W1-activities/kanban.nextboard). Each is a board file v1 that passes every reading
  rule; their text goes into the activity modules exactly, byte for byte.
- [0001-W24 v1](0001-W24-selection-layouts-editor-hooks.md)'s comparison procedure (scenarios
  A–J) is reused by the reviewer.

## Deliverables and boundaries

Paths are under `apps/web/` unless they start with `tests/`. The contracts say what each
behaviour is; this list says where it goes. These are the only files that may change.

**New files (seven).**
1. **`src/activities/catalog.ts`**: the three entries, in this order: `retrospective`,
   `brainstorm`, `kanban`, with the names and descriptions in the catalogue contract, author
   `"NextPhase"`, licence `"Apache-2.0"`, version 1.
2. **`src/activities/retrospective.ts`**, 3. **`src/activities/brainstorm.ts`**,
   4. **`src/activities/kanban.ts`**: each `export const file = "…";` holding the matching file's
   text from `docs/briefs/0008-W1-activities/`, exactly.
5. **`src/activities.ts`**: the rules in web modules v19 (reading an entry, the box and placement,
   adding through the clipboard's copy step, the view and zoom after adding, the preview's
   geometry). No React, Konva or DOM; no type-name comparison.
6. **`src/ui/templates-panel.tsx`**: `TemplatesPanel`: the header, Close, "Activities", the cards
   with their previews (SVG from the preview geometry), text and Add template buttons.
7. **`tests/activities.test.mjs`**: as listed under validation.

**Changed rules modules.**
8. **`src/clipboard.ts`**: the copy step of `buildPaste` becomes its own exported function used by
   `buildPaste` and by adding an activity; Paste's results are unchanged.

**Changed screen parts.**
9. **`src/ui/palette.tsx`**: the Templates button after the last tool, and the placement of
   `TemplatesPanel`.
10. **`src/icons.tsx`**: the templates icon.
11. **`style.css`**: the button's pressed state as the other toolbar buttons, the panel, the
    cards, previews and Add template buttons, and the narrow layout.

**Changed state hooks** (each keeps its ownership, web modules v19):
12. **`src/state/use-editing-commands.ts`**: adding an activity (the limit, one history step,
    selection, the notice, focus to the canvas, the view).
13. **`src/state/use-editor-placement.ts`**: the Templates button's element; returning focus to it
    when the panel closes by its button.
14. **`src/state/use-page-keys.ts`**: returning focus to the Templates button when Escape closes
    the panel.

**Composition.**
15. **`src/App.tsx`**: passes the Templates values to `Palette` and the hooks on existing lines or
    a line it needs. It must not exceed **262 lines**, its budget.

**Changed tests.**
16. **`tests/modules.test.mjs`**: screen parts twenty-one, as listed under validation.

No other module changes: no `document.ts`, `storage.ts`, `board-file.ts`, other hook, other
screen part, `main.tsx`, packages, locks, contracts, build scripts or other tests. If something
seems to need more, stop and report it.

New source files use `SPDX-License-Identifier: Apache-2.0`. Append the implementation record
below with the branch, validated revision, commands, results and exclusions; report the final
branch tip separately.

## Numbered acceptance criteria

- 0008-W1-AC01: Choose a small independently authored activity and insert editable supported objects.
- 0008-W1-AC02: Give inserted objects independent identities and remap supported internal references correctly.
- 0008-W1-AC03: Undo one insertion as one action while preserving the original activity source and license provenance.

| Criterion | Evidence that shows it |
| --- | --- |
| 0008-W1-AC01 | Scenario Q: Q1–Q8 (button, panel, cards, focus), Q9–Q11 and Q16 (adding each activity), Q18 (the added objects are editable), Q20–Q22 (unavailable states, limit, keyboard), Q23 (narrow); unit tests in `tests/activities.test.mjs` |
| 0008-W1-AC02 | Scenario Q: Q12–Q15 (saved record: new identities, sections and connector ends remapped), Q17 (adding twice); unit tests |
| 0008-W1-AC03 | Scenario Q: Q19 (one Undo, one Redo, view kept), Q24 (the activity files unchanged); unit tests (catalogue checks, one history step) |

## Validation commands and expected evidence

From the repository root with the pinned toolchain:

```sh
npm --prefix apps/web ci --ignore-scripts --no-audit --no-fund
npm --prefix apps/web run typecheck
node --test tests/activities.test.mjs tests/clipboard.test.mjs tests/modules.test.mjs
npm --prefix apps/web test
npm --prefix apps/web run build
npm --prefix apps/web run build:fixtures
git diff --name-only main...HEAD
```

The change touches the clipboard, the editing commands and `App.tsx`, so the implementer runs
the full unit suite (`npm --prefix apps/web test`) and reports any failure, saying whether it also
fails at `6fe6a7f`.

**`tests/activities.test.mjs`** (new) covers:
- the catalogue: three entries in order, with exactly the contract's fields and values; each
  entry's `file` passes every board file v1 rule, is `schemaVersion` 7, holds 1 to 40 objects,
  and its title equals the entry's name; each `file` equals the matching
  `docs/briefs/0008-W1-activities/<id>.nextboard` byte for byte;
- the box: rectangles only, connectors left out;
- placement: an empty board (the box centred on the view's centre); a board with content (left
  edge 120 units right of the board's right edge, tops equal), including content whose drawn
  height differs from its saved height (saved rectangles are used); a second addition placed
  right of the first; positions kept inside the coordinate limits;
- the copies: counts and types as the activity; every ID and generation new and different from
  the activity's and the board's; group IDs new; section membership and connector ends pointing
  at the copies; the three bands; the board's existing objects unchanged apart from the `order`
  numbers the bands require;
- history: one recorded step; Undo removes every added object; Redo restores the same IDs;
- the view: centred on the added box; zoom kept when it fits with 48 pixels each side; otherwise
  the largest quarter step below the current zoom that fits, down to 50%; Paste's own results
  unchanged (the existing clipboard tests); from 200% and from an
  in-between zoom such as 83%;
- the 250-object limit (nothing added at 249 + 7) and an unreadable file (the reason, nothing
  added);
- the preview: the viewBox (the box plus 40 on each side) and "xMidYMid meet"; a frame for each
  container; for other objects, the board fill when drawn with one, else the border outline,
  else the #dedede outline (a text object); a line between end centres for each connector; no
  text;
- the activity modules: `file` is the only export.

**`tests/clipboard.test.mjs`**: unchanged; it must still pass (Paste unchanged).

**`tests/modules.test.mjs`**: screen parts twenty-one (adding `templates-panel.tsx`); hooks
nineteen and the `App.tsx` budget 262, unchanged.

Reviewer checks (not run by the implementer; browsers cannot start there):

- **Scenario Q** (new behaviour), with real mouse and keyboard input in fresh contexts at
  1280 × 800 and 100% zoom (Q23 at 390 × 844), once on the candidate and once on a build of
  `6fe6a7f` as a negative control: there the Templates button is absent, so the run marks every
  dependent check failed, runs Q25, and exits with a failure. Saved records are read after each
  Save, waiting for "Locally saved". Crafted stored records are used only for Q21 (a board at 249
  objects). The tool is `tools/browser-compare/templates-check.mjs` in the private repository; the
  check run keeps its order and may adjust its steps, keeping each check's meaning.
  - **Q1** The Templates button is directly after Section, named "Templates", with the tooltip
    "Templates" and `aria-expanded` false.
  - **Q2** Activating it opens the panel; the button is pressed and expanded.
  - **Q3** The panel reads "Templates", Close, "Activities", and three cards in order:
    Retrospective, Brainstorm, Kanban, each with its description and "By NextPhase · Apache-2.0".
  - **Q4** Each card has a preview with no text, and an Add template button named "Add template:
    <name>".
  - **Q5** Focus is on the first Add template; the panel's left edge is 40 pixels right of the
    window's middle and its bottom 78 pixels above the window's bottom.
  - **Q6** Escape closes the panel and focus returns to the Templates button.
  - **Q7** Close does the same; activating the Templates button while open does the same.
  - **Q8** Opening it with the Shapes panel open sets the tool to Select; opening it closes the
    Objects panel, and opening Objects closes it.
  - **Q9** On an empty board, Add template for Retrospective adds 7 objects centred on the view,
    all selected, the panel closed, focus on the canvas, and the notice "Added “Retrospective”: 7
    objects.".
  - **Q10** On a board with three stickies, Add template for Kanban places its box 120 units right
    of the stickies' box, tops equal.
  - **Q11** The view's centre is the added box's centre and the zoom follows the rule: at
    1280 × 800 from 100%, Retrospective (Q9) moves to 50% and Kanban (Q10) to 75%.
  - **Q12** After Save, the record holds the added objects with the activity's types, text,
    colours and relative positions.
  - **Q13** Every added ID and generation differs from the activity file's and from the board's.
  - **Q14** Each added sticky's section is the added section that held it in the activity.
  - **Q15** Brainstorm's six connectors join the added topic to the added stickies.
  - **Q16** Brainstorm and Kanban each add their full object count.
  - **Q17** Adding Retrospective twice gives two copies with different IDs; the second is right
    of the first.
  - **Q18** An added sticky's text edits, and moving an added section carries its stickies.
  - **Q19** Right after a fresh addition (no edit in between), one Undo removes every added
    object and leaves the view; one Redo restores them with the same IDs.
  - **Q20** In a read-only tab (a second tab on the same board) the Templates button is
    unavailable.
  - **Q21** At 249 objects, Add template adds nothing, keeps the panel open and shows Paste's
    limit notice.
  - **Q22** Keyboard only: Tab reaches the Templates button, Enter opens the panel, Tab reaches
    each Add template, Enter adds.
  - **Q23** At 390 × 844 the panel is inside the window with one card per row and scrolls.
  - **Q24** The built app holds each activity file unchanged: its `sha256` value from
    `docs/briefs/0008-W1-activities/` appears in the served `app.js`, and adding each activity
    changes nothing but the board.
  - **Q25** No dialogs, page errors or console errors.

Recommended regression checks, run only if the maintainer accepts them (this change touches the
clipboard, the editing commands, the palette and `App.tsx`):

- **The full unit suite** in a clean clone, separating failures new to the candidate from
  failures that also occur at `6fe6a7f`.
- **Previous behaviour.** Scenarios A–J of the 0001-W24 v1 brief's comparison on a build of
  `6fe6a7f` and on the candidate, with 0002-W2's adjusted starts in both runs (I2's marquee from
  (−140, −40) and I4's from (−240, 40)). Before comparing, both runs are normalized with exactly
  this mask, and nothing else: the Templates button is removed from the bottom toolbar's markup.
  After the mask the candidate must match at every checkpoint in markup, focus, canvas drawing
  and saved records.
- **Regression harness.** The eight PASS lines at the fixture index page and at
  `regressions.html` ([tests README](../../tests/README.md)), in headless Chrome.

Scenarios N, M, K, L, O and P are not affected (no document, storage or shape change) and are not
recommended. The maintainer checks three items drawn from scenario Q in Safari, one picked by the
reviewer: Q9 (adding, view and selection). No browser matrix, accessibility audit, phone layout
check or performance test unless the maintainer asks.

## Exclusions and reasons

- The section "Templates" button; search, tabs, recents or more activities (later).
- Saving your own activities, team templates (0008-W2).
- Other products' templates or community files; widgets, voting, timers.
- Provenance stored on the board; any document, storage or file format change.
- Fixes for bugs noticed on the way (report them).

## Public references with retrieval dates

None beyond the repository's own documents.

## Implementation record
