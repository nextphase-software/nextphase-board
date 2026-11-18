BRIEF VERSION: 0011-W1 v1 (2026-11-17)
# 0011-W1 — Edit a structured table on the canvas

Status: Draft. Implementation has not started under this brief.

## Outcome and read first

A board can hold **tables**, on local and team (hosted) boards alike.
- A Table tool sits after Section (⇧T). A click places a 2 × 2 table; a drag chooses columns × rows.
- Click a table to select it, then a cell to select that cell. Return, double-click or Edit text edits the
  cell in a native text field. Return inside the field is a line break and the row grows; Tab and Shift+Tab
  move between cells; Escape stops editing. With a cell selected but not edited, the arrows move between
  cells.
- Rows and columns are added at the end (bar buttons and add bars) or beside a selection (Row options,
  Column options, ⌥ shortcuts), deleted (grabbers and Delete) and resized by their borders or the table's
  corners.
- Each change is one Undo step. Cells belong to their row and column ids, so no change moves another
  cell's text. Tables save, export and reopen the same.
- On team boards several people edit one table at once. Different cells never interfere; typing in one
  cell merges letter by letter; rows or columns added at once are all kept; a later resize wins; a delete
  wins over typing in the deleted row or column, with a notice.

Read [AGENTS.md](../../AGENTS.md), [CONTRIBUTING.md](../../CONTRIBUTING.md), [DESIGN.md](../../DESIGN.md)
and these new contract files (prior versions remain untouched):

| Contract | New version / ownership |
| --- | --- |
| [Document](../architecture/0001-document-v20.md) | v20: the `table` type, schema version 14, table rules, canonical order, reading 1–13 |
| [Sync](../architecture/0003-sync-v15.md) | v15: the table's shared-document map (`place`, `tableStyle`, `columnMap`, `rowMap`, `cells`), reading and writing, concurrent merge, hosted Undo units, the room accepting 13 and 14 |
| [Interaction](../architecture/0001-interaction-v45.md) | v45: every look, word, key and rule of tables, on local and hosted boards |
| [Web modules](../architecture/0001-web-modules-v43.md) | v43: five new source modules and two test files, the counts, the package, room and web paths, App.tsx substitutions and seams |

Use this set wherever inherited contracts link a replaced version. Unchanged: [presence v5](../architecture/0004-presence-v5.md),
[comments v5](../architecture/0005-comments-v5.md), [workshop voting v3](../architecture/0007-workshop-voting-v3.md),
[team templates v2](../architecture/0008-team-templates-v2.md), [hosted storage v12](../architecture/0003-hosted-storage-v12.md)
(room storage version stays 8), [storage v3](../architecture/0001-storage-v3.md), [board file v4](../architecture/0006-board-file-v4.md),
[hosted persistence v10](../architecture/0003-hosted-persistence-v10.md), [board lifecycle v5](../architecture/0006-board-lifecycle-v5.md),
[API v12](../architecture/0003-api-v12.md), [access v13](../architecture/0003-access-v13.md),
[toolchain v5](../architecture/0001-toolchain-v5.md), [lock v5](../architecture/0001-dependency-lock-v5.json),
[inventory v5](../architecture/0001-dependency-inventory-v5.json) and [runtime notices v3](../architecture/0001-runtime-notices-v3.txt).
The 17 service tables remain: no service migration.

Build directly; no prototype or scenario tool is an input. Prove the stated values with focused tests,
followed by independent checks. Report a contract conflict before dependent work.

**Design.** The maintainer approved the look on 2026-11-17. Interaction v45 states every value of it
(sizes, colours, positions, words). The table, its selections and the context bars reuse the app's own
values; new chrome (add bars, Row and Column menus) uses NextPhase values, as v43's pages list does.

## Deliverables and boundaries

Planning source baseline main **3f4ad48**. Use a fresh milestone worktree and branch from committed main
containing this packet, recording that prerequisite base separately from the behaviour baseline. New
source files carry `SPDX-License-Identifier: Apache-2.0`. Only these files may change, plus the
append-only Implementation record below.

**New (seven: five source modules, two test files).**
1. `packages/board-rules/src/objects/table.ts`
2. `apps/web/src/table.ts`
3. `apps/web/src/scene/table-body.tsx`
4. `apps/web/src/scene/table-buttons.tsx`
5. `apps/web/src/ui/table-controls.tsx` (all five as web modules v43)
6. `tests/tables.test.mjs`
7. `tests/server/tables.test.ts` (S425–S430 below)

**Changed: packages and server.**

| # | File |
| --- | --- |
| 8 | `packages/board-rules/src/objects/registry.ts` |
| 9 | `packages/board-rules/src/document.ts` |
| 10 | `packages/board-sync/src/codec.ts` |
| 11 | `packages/board-sync/src/document-adapter.ts` |
| 12 | `packages/board-sync/src/session.ts` (the table order hint through commit, Undo and Redo) |
| 13 | `packages/board-sync/src/undo.ts` |
| 14 | `packages/board-room/src/conflicts.ts` |
| 15 | `packages/board-room/src/edits.ts` |
| 16 | `packages/board-room/src/history.ts` |
| 17 | `packages/board-room/src/room.ts` |
| 18 | `packages/board-room/src/backups.ts` (only if it checks the schema version; the version checks of every runner entry point and `apps/server/src/routes/` were grepped at planning: only the files in this table hold one) |
| 19 | `apps/server/src/routes/boards.ts` |
| 20 | `apps/server/src/templates.ts` |

Type-only changes in other package, server and web files are allowed where the compiler needs them,
with no behaviour change; the record lists them.

**Changed: web** (under `apps/web/src/`).

| # | File |
| --- | --- |
| 21 | `App.tsx` (only the substitutions of web modules v43, including `TableButtons` beside `MindMapButtons`) |
| 22 | `state/use-selection.ts` |
| 23 | `state/use-canvas-input.ts` |
| 24 | `state/use-geometry-edits.ts` |
| 25 | `state/use-text-entry.ts` |
| 26 | `state/use-validity.ts` |
| 27 | `state/use-object-layouts.ts` (drawn row heights and box) |
| 28 | `state/use-editor-placement.ts` (the cell editor) |
| 29 | `state/use-board-document.ts` (the table order hint) |
| 30 | `state/use-hosted-board.ts` and `team/hosted-board.ts` (passing the change origin, as v42 does for pages) |
| 31 | `scene/board-drawing.tsx` |
| 32 | `scene/inline-editor.tsx` |
| 33 | `scene/connection-dots.tsx` |
| 34 | `ui/context-bar.tsx` and `context-bar-position.ts` |
| 35 | `ui/content-field.tsx` |
| 36 | `ui/objects-panel.tsx` and `sections.ts` |
| 37 | `ui/palette.tsx` (only if the Table tool's icon or tooltip needs it) |
| 38 | `icons.tsx` (the table and add row/column icons) |
| 39 | `history.ts` and `clipboard.ts` |
| 40 | `resize.ts` |
| 41 | `connectors.ts` |
| 42 | `board-file.ts` and `storage.ts` |
| 43 | `team/templates-rules.ts` and `team/import.ts` |
| 44 | `apps/web/style.css` |
| 45 | `state/use-editing-commands.ts` (table actions; the selection after Undo and Redo) |
| 46 | `activities.ts` (`copyObjects` remaps table ids on template and activity insertion) |
| 47 | Any web file that computes an object's box from saved geometry for hit testing, outlines, Arrange, Tidy up, find, comments or presence (for example `find.ts`, `arrange.ts`, `tidy-up.ts`, `team/presence-layer.tsx`, `team/comments/layer.tsx`): only to use the drawn box of `use-object-layouts.ts` for tables. The record lists each |

All change as web modules v43 says.

**Changed: tests and guide.**
- 48. `tests/modules.test.mjs`: the counts and lists of web modules v43, the type-name guard list, and the
  App test of web modules v43.
- 49. `tests/README.md`: the two new files.
- 50. The fixture and expectation updates under **Shared-path check dispositions**.
- 51. `docs/guides/try-board.md`: one row at the end of Part 1's table and one at the end of Part 2's,
  below; nothing else in the guide changes.
- 52. `vitest.node.config.ts` and 53. `vitest.workerd.config.ts`: only adding `tests/server/tables.test.ts`
  to each `include` list.

New tests import the new modules dynamically inside their named checks, never at top level, so on the
3f4ad48 baseline each new check fails by name (V12).

**Try-and-test guide.**

Part 1 (local):

| Feature | Try this | You should see |
| --- | --- | --- |
| [Tables](../briefs/0011-W1-tables.md) | Choose the Table tool (after Section) and click the board. Click the table's top-left cell, press Return, type "Task", press Tab and type "Owner", then press Escape twice. Click Add row in the bar. Click the "Owner" cell and choose Column options › Add column to the left. Drag the border right of "Task" to the right. Click the new empty column's top cell, then the small grabber above that column, and press Delete; then press Cmd+Z (Ctrl+Z). Click Save, wait for "Locally saved" and reload | A 2 × 2 table appears where you clicked, selected. "Task" and "Owner" fill the first row; the first Escape leaves the "Owner" cell selected and the second the whole table. A third row appears at the bottom. A new empty column appears left of "Owner"; widening "Task" leaves the other columns as they were. Delete removes the empty column and Cmd+Z brings it back, with "Task" and "Owner" still in their cells. After the reload the table is the same |

Part 2 (team mode):

| Feature | Try this | You should see |
| --- | --- | --- |
| [Tables on team boards](../briefs/0011-W1-tables.md) | Open the same team board in two browsers, signed in as two editors. In browser A place a table, click its top-left cell, press Return and type "Task". In browser B click the table, click its top-right cell, press Return and type "Owner", press Escape twice and click Add row. In browser B click a cell of the new bottom row, press Return and start typing; while B types, in browser A press Escape twice, click a cell of that bottom row, click the grabber left of the row and press Delete. Reload both | Both browsers show "Task" and "Owner" in their cells. The new row appears in both. When A deletes the row, B's typing stops, B's whole table is selected and B sees "<A's name> deleted a row you were editing."; the rest of the table is unchanged in both. After the reload both show the same table |

Not allowed:
- a dependency, font, image file, service, service migration or import exception;
- a stored value other than document v20's table keys;
- a state hook, scene part or screen part beyond web modules v43;
- a change to presence, comments, voting, templates, the timer, access, lifecycle or the board file's
  format beyond the version numbers above;
- per-cell formatting, merged cells, multi-cell selection, moving or duplicating rows and columns, or the
  middle insert points (a later milestone).

Outside the named new controls, the existing screens' markup stays exactly as at the base: the
reviewer's A–J comparison allows only the mask listed under validation.

## Required behavior and concrete design

Implement document v20, sync v15, interaction v45 and web modules v43 in full. In particular:

- **Document.** Schema 14 with the `table` type and its rules; `upgrade` from 1–13; `empty` and `add` at 14;
  validation of every bound (1–50 rows, 1–20 columns, sizes 64–1,000, cells ≤1,000 code points, unique ids,
  `width` and `height` equal to the sums); canonical order; duplicate and paste remap every id.
- **Sync.** The table's shared map with `columnMap` and `rowMap` entries `{order, width|height}` and one
  shared text per cell key. Minimal writes: typing writes only that cell's text; an add writes one entry;
  a resize one size; a delete removes one entry and its cells. Orphan cells are not read and the next
  write removes them. The room's `promote()` extends to the `order`, `width` and `height` writes inside
  table entries. Hosted Undo has `column:`, `row:` and `cell:` units; undoing a delete restores the entry,
  its key and its cells with the same ids.
- **Room.** Versions 13 and 14 on reading (create, import, history, restore, backups, templates); the live
  board is always 14: new boards at 14, stored version 10–13 rooms upgraded on load by `upgradeStored` (a
  snapshot, not an edit); storage version stays 8; images still refused; `transition.ts` unchanged.
- **Web.** The Table tool and ⇧T; placing by click and drag; the four selection levels and their looks;
  grabbers and add bars; the three context bars and two menus; adding, deleting and resizing with their
  keys and disabled reasons; the cell editor with Return, Tab, Shift+Tab, Escape, composition and the
  1,000-code-point rule; row growth in the same step; Undo steps; the Objects panel name; no connection
  dots; viewers read only; the remote-delete notices on hosted boards.

## Shared-path check dispositions

This inventory authorizes expectation changes, not additional historical runs.

| Shared path / older checks | Disposition |
| --- | --- |
| Any test asserting that a **new, created, upgraded-on-load or edited** document is at the current version 13, including `tests/document.test.mjs`, `storage.test.mjs`, `board-file.test.mjs` (edited exports), `board-history.test.mjs`, `board-catalog.test.mjs`, `room.test.mjs`, `pages.test.mjs`, `shapes.test.mjs`, `strokes.test.mjs`, `images.test.mjs`, `connectors.test.mjs`, `connector-styles.test.mjs`, `mind-map.test.mjs`, `tape.test.mjs`, `team-import.test.mjs`, `team-templates.test.mjs`, and the server tests `pages.test.ts`, `shared.test.ts`, `mind-maps.test.ts`, `drawing-layout.test.ts` | The expected value becomes 14. No assertion changes for any other reason |
| Deliberately pinned legacy round trips (for example `board-file.test.mjs`'s "version N file round-trip" for N = 1–13, unedited exports, history's legacy comparisons) | Unchanged: older versions keep their exact bytes (document v20) |
| Future-version negatives (for example `document.test.mjs`'s unknown-schema case, the "newer version of Board" cases in board file, local storage and the board catalogue) | The first unknown or newer version becomes **15**; 14 is current |
| Room, history and backup tests listing accepted versions `[10, 11, 12, 13]` | The list gains 14 |
| `tests/import-fixture.mjs` and its callers (`tests/team-pages.test.mjs`, `tests/server/team-pages.test.ts` and others) | Storage-7 seeds (a live `pages` array, no `pageMap`, in the Yjs and in the stored JSON) are built from a genuine **version 13** board, never by downgrading the current board; storage-8 seeds at version 13 are built with `pageMap`; both load live at 14 (sync v15's table). Rows stay under the runners' SQL statement limit |
| Fixtures that send **edits** to a room from a hard-coded board (voting, reactions, spotlight, timer, comments, mentions, templates, shared and other server and client tests) | Their base board is version 14, since a live room is 14 and an edit cannot change the version. No assertion changes for any other reason |
| Tests that build or assert an existing object type's shared-document map through the codec | Unchanged: no existing type's map changes |
| Module inventory: `tests/modules.test.mjs` | Rules package 16 files; object types 11 (`table.ts`); scene parts 18; screen parts 32 → 33; state hooks 25; the type-name guard list gains `table`; "0010-W3 App composition" becomes "0011-W1 App composition" from base 3f4ad48 with the recorded substitutions |
| Palette tests that list the tools in order | `Table` appears directly after `Section`; nothing else in the order changes (also asserted on its own) |
| `tests/pages.test.mjs` (205–212: a legacy-13 assertion beside a current payload; 79–83), `tests/import-fixture.mjs` (75–92: defaults to 13 and drops page metadata only for 13), `tests/server/shared.test.ts` (906–912, 991–998), `tests/workshop-reactions.test.mjs`, `workshop-spotlight.test.mjs` and `workshop-voting.test.mjs` (line 18 fixtures) | The current-version payloads and fixture defaults become 14 and drop page metadata for 13 and 14 alike; the storage-7 seeds of both team-pages suites stay pinned at genuine 13; the legacy-13 assertion stays 13. Codec and transition assertions are unchanged |
| Historical check tools (`0010-w2-check.mjs` and other earlier scenario tools) | Not rerun; no disposition needed beyond A–J below |
| Local shell: A–J | One new mask: the union of the palette's footprint at 3f4ad48 and at the candidate (the palette is centred, so tools on both sides move), including any tooltip a scene opens over it. `tools/browser-compare/compare.mjs` compares saved payload bytes, so for A–J records that hold no table the check run normalizes only the `schemaVersion` field (13 → 14) and verifies separately that the raw digests differ only there, the revisions match and every other byte is equal. No other difference |

The record lists every changed line range under `tests/`.

## Browser checks

New scenario **N3-S1–N3-S14**. N3 was unused in existing public briefs when allocated. A fresh,
independent check run writes its tool from these clauses and the contract values. Each row prints its full
ID, `PASS:` or `FAIL:` and a summary, and keeps raw receipts and unrun rows.

Setup: 1440 × 900, scale 1, macOS Chrome (so ⌘ and ⌥ keys), US keyboard layout. Rows N3-S1–N3-S9 on the
local app (single-user mode). Rows N3-S10–N3-S14 on the local team stack started from the candidate on its own
uniquely owned local Supabase project, with Ana (owner), Ben (editor) and Mia (viewer) each in their own
browser context. Use real pointer and key events, never painted DOM. New capability rows also fail by name on
the independent baseline 3f4ad48. Derived positions ±0.5 CSS px; colours and sizes exactly as interaction
v45. "Within 3 s" means the change shows on the other screen within 3 seconds. Save a real-state image for
N3-S1–N3-S8. Board points are canvas units; at 100 % with the view at (0, 0) the board origin is the canvas
area's centre.

**Fixture L** (local): a new board, view 100 % at (0, 0), Select tool, nothing selected, focus on the canvas.
**Fixture T** (team): the guide's Part 2 seed (Example team with Ana as owner, Ben as editor, Mia as viewer)
and sign-in steps; Ana chooses Home › New board, then sets Board name to `Tables check` (board panel); Ben and
Mia open it; every context at 100 % with the view at (0, 0). Unless a row says it continues, each row starts on
a **fresh empty board** of its fixture with Escape pressed until nothing is selected.

| ID | Scriptable behavior and expected result |
| --- | --- |
| N3-S1 | Fixture L. The palette shows `Table tool` directly after `Section tool`; hovering it shows `Table · ⇧T`. Click it, then click board point (−500, −250): a table 384 × 128 at (−500, −250), two 192-wide columns, two 64-high rows, selected (1 px `#518de0` outline, four 8 × 8 handles, no side handles, no connection dots); the tool is Select. The bar reads `Table`, Text size `Medium`, `Add row`, `Add column`, Arrange, Duplicate, Delete, centred on the table, its bottom 26 above the table's top. Add bars right and below: 24 thick, 8 out, `#dceafb`. Hover the Table tool again and capture placed (tooltip showing) |
| N3-S2 | Fixture L. Press ⇧T; press at (−500, −250) and drag to (−100, −50): during the drag the ghost and the label `3 × 4` show (capture drag-size); release places a 3 × 4 table 576 × 256 at (−500, −250). Press ⇧T again, press at (200, 100), drag 100 right and press Escape before release: nothing is placed and the tool stays armed; press Escape again |
| N3-S3 | Continues from N3-S2 (the 3 × 4 table). Press Escape until nothing is selected, click the table, then its cell in row 2, column 2: that cell is selected (2 px outline); the row grabber (6 × 20) left of row 2 and the column grabber (20 × 6) above column 2, each centred 14 outside; the bar reads `Cell`, `Edit text`, `0 / 1,000`, `Row options`, `Column options`, `Delete content`, centred on column 2, its bottom 48 above the table's top. Capture cell-selected. Arrow Right selects row 2, column 3; Arrow Right again stays; Tab selects row 3, column 1; Shift+Tab returns to row 2, column 3; Escape selects the table |
| N3-S4 | Continues: click row 1, column 1. Click `Row options` and keep the pointer over it: the button is white with ink `#29272e`; the menu (248 wide, heading `Row`, `Add row above ⌥⇧↩`, `Add row below ⌥↩`, a separator, `Delete row ⌫` in `#a3302a`) opens 8 below it. Capture row-menu. Choose `Add row below`: a 64-high row appears under row 1 and its cell in column 1 is selected. Press ⌥[: a 192-wide column appears left of column 1 and the new column's cell in that row is selected |
| N3-S5 | Fixture L; place a 2 × 2 table by click at (−500, −250); click its row 1, column 1. Typing `x` does not start editing. Press Return: the editor opens (purple 2 px outline, placeholder `Add text`, caret at the end; named `Row 1, column 1 of table 1`); the bar reads `Cell`, `Done`, `0 / 1,000`, its bottom 26 above the table. Type `Ship CSV import`, Return, `and export`: two lines, row 1 drawn and set to 88; the bar reads `26 / 1,000`. Capture editing |
| N3-S6 | Continues editing: Tab ends the edit and edits row 1, column 2 (placeholder shown; capture tab-next); Shift+Tab edits row 1, column 1 again; Tab three more times reaches row 2, column 2 (via row 1, column 2 and row 2, column 1); a fourth Tab ends editing with it selected. Return edits it again; during an input-method composition (CDP `Input.imeSetComposition`), Tab and Return do not act; after committing the composition, Escape ends editing with the cell selected |
| N3-S7 | Fixture L; place a 2 × 2 table by click at (−500, −250); click row 1, column 1, press Return, type `A`, press Tab, type `B`, press Escape twice; click row 1, column 2, then its column grabber: the column is selected (16 × 16 `#518de0` square with grip, outline round the column; bar `Column`, `Column options`, `Delete column`). Capture column-selected. Press Delete: the column is gone and row 1, column 1 is selected. Press ⌘Z: the column is back with `B` in its cell and `A` unchanged |
| N3-S8 | Fixture L; place a 2 × 2 table at (−500, −250) and click it. Drag the border between columns 1 and 2 (board x −308) 40 right: during the drag the bar is hidden and a 2 px `#518de0` line shows over the border (capture resize); after release column 1 is 232, column 2 192, the table 424 wide. Type two lines into row 1, column 1 as in N3-S5 (row 1 becomes 88), press Escape twice; drag row 1's bottom border down 40 (128), then up 100: it stops at 88. Drag the bottom-right handle 424 right: every column doubles (464, 384) and row heights stay. Press ⌘Z five times: it undoes, in order, the corner resize, the drag up, the drag down, the text editing session and the column border drag |
| N3-S9 | The Part 1 guide row of `docs/guides/try-board.md`, walked as written: each `You should see` holds. Then Board › Save a copy to file, and Board › Open board file… with that file: the opened board holds the same table, with the same table, row and column ids, texts and sizes |
| N3-S10 | Fixture T. Ana places a 2 × 2 table by click at (−500, −250); both Ana and Ben see it within 3 s. Ana edits row 1, column 1 and types `Task` while Ben edits row 1, column 2 and types `Owner`: within 3 s both see both texts. Both press Escape twice. From that confirmed base, Ana and Ben each click Add row, the second click issued before the first person's new row shows on the second screen (the tool checks both contexts' DOM and repeats the pair on a fresh base, at most 3 times, when it was not); arrival order is not asserted (S426 proves the merge): within 3 s both see two new rows |
| N3-S11 | Continues: Ana clicks the table, then row 3, column 1, presses Return, types `Keep me` and presses Escape twice. The tool records row 3's id. Ben clicks row 3, column 2, presses Return and types `abc`; while Ben's editor is open, Ana clicks row 3, column 1, then the row grabber, and presses Delete: within 3 s Ben's editor closes, his table is selected, and he sees `ana deleted a row you were editing.`; both tables have no row with the recorded id and every other cell keeps its text. Ana clicks empty canvas and presses ⌘Z: within 3 s the row is back for both, with the recorded id and `Keep me` |
| N3-S12 | Continues: Ana selects the table and drags the border between columns 1 and 2 by 40 right; after Ben sees it, Ben drags the same border 80 right. Ana presses ⌘Z: the width stays Ben's for both and Ana sees `Someone else changed that, so it was not undone.` |
| N3-S13 | Continues: Mia clicks the table and a cell: no add bars, no grabbers, no `Edit text`, no menus; her bar reads `Cell` and the count; Return, Delete, ⌥↩ and ⌥[ change nothing. Ana uses the Comment tool, clicks inside the table and posts `Check`: the thread reads `On “Table”`. Ana reloads: the same table. Then the Part 2 guide row, walked as written by Ana and Ben on a new table: each `You should see` holds |
| N3-S14 | Fixture T. Ana opens Board › Show version history, chooses Save version…, names it `Before table` and saves; she closes the history panel, places a 2 × 2 table, edits row 1, column 1 to `Saved`, presses Escape twice and waits until the save area shows the change saved; she opens the history panel again and saves `With table`. She chooses `Before table`: the preview shows no table; Back to current version: the table is there. She chooses `Before table` again and Restore this version, confirming: after both editors have rejoined, the table is gone for Ana and Ben. She chooses `With table` and restores it: after both have rejoined, both see the table with `Saved` and the same table, row and column ids |

## Acceptance criteria

- **0011-W1-AC01:** On single-user and team boards, the Table tool places a 2 × 2 table by click or a C × R
  table by drag; rows and columns are added at the end or beside a selection, deleted, and resized by their
  borders or the table's corners, within document v20's bounds. Look and placement match the approved design.
- **0011-W1-AC02:** Cells are selected and edited as interaction v45 says: a native text field over the
  cell; Return, Tab, Shift+Tab, Escape, arrows and composition behave as stated; every action has a
  keyboard route and a named control.
- **0011-W1-AC03:** Each change is one Undo step; after any add, delete or resize, and after Undo and Redo,
  every other cell keeps its text and its row and column ids; a saved schema 14 board and its board file
  reopen with the same table, as does a team board after a reload, a restore and in history.
- **0011-W1-AC04:** On a team board, two people editing one table at once get sync v15's results: edits to
  different cells, and rows or columns added at once, are all kept; one cell's typing merges; a delete wins
  over an edit inside it, with the notice; each person's Undo undoes only their own steps.

| Criterion | Evidence that shows it |
| --- | --- |
| 0011-W1-AC01 | N3-S1, N3-S2, N3-S4, N3-S7, N3-S8, N3-S10; S425; V4 |
| 0011-W1-AC02 | N3-S3, N3-S5, N3-S6, N3-S13; V4 |
| 0011-W1-AC03 | N3-S7, N3-S8, N3-S9, N3-S13, N3-S14; S425, S429, S430; V4; V9 |
| 0011-W1-AC04 | N3-S10, N3-S11, N3-S12; S426–S428; V4; V9 |

## Applicable DESIGN.md guardrails

Canvas-first shell, native controls and visible focus, minimum action hits, protected native editing and
independent state owners apply. Every new action has a named button, and a key route except dragging a
single row or column border and drag-to-size placement, which are pointer-only (interaction v45 gives the
Objects panel's size fields and Add row / Add column as their keyboard alternatives); the cell editor is a
native text field. Interaction v45 states every new look, word and key; never infer generic styling. No new
sound, font or image file.

## Validation commands and expected evidence

Use pinned Node 26.13.0 and npm 11.20.0 from the repository root. Source validation is not independent
acceptance. Each check run restates **every V row it reruns** as its own `PASS: Vn ...` / `FAIL: Vn ...`
line with SHA, logs and counts.

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm run typecheck
npm test
BOARD_TEAM_FEATURES=off BOARD_SUPABASE_URL=http://127.0.0.1:55321 BOARD_SUPABASE_ANON_KEY=synthetic BOARD_SERVER_URL=http://127.0.0.1:8796 npm run build
npm run audit:licenses
npm run build:fixtures
BOARD_TEAM_FEATURES=on BOARD_SUPABASE_URL=http://127.0.0.1:55321 BOARD_SUPABASE_ANON_KEY=synthetic BOARD_SERVER_URL=http://127.0.0.1:8796 npm run build
npm run audit:licenses
npm run build:server
npm run audit:licenses
WRANGLER_SEND_METRICS=false npx wrangler deploy --dry-run --outdir <scratch> -c apps/server/wrangler.json
npm run test:server:node
npm run test:server:workerd
git diff --name-status <prerequisite-base>..<validated-source>
git diff --check <prerequisite-base>..<validated-source>
```

The document, room and sync change, so a short server-only run follows the build. It installs the schema
on its own uniquely owned local Supabase project and runs both server suites on the candidate (V9),
stopping on any failed setup step. The check run starts the team stack on its own uniquely owned local
Supabase project. Record each long run's start and end and the host's sleep and wake events; a run that
overlapped a sleep is INVALID and is rerun awake. Three Safari checks from this milestone are chosen only
at Review.

**New server checks** (`tests/server/tables.test.ts`, both runners).

| ID | Check |
| --- | --- |
| S425 | Create a blank board: live version 14. Create and import a version 14 document holding a 3 × 4 table with cells: accepted and served the same (ids, order, sizes, texts). Import a version 13 document without a table: accepted and served as 14. Refused `invalid_document`: a version 13 document holding a table; a table with 0 or 51 rows, 21 columns, a width of 63, a cell of 1,001 code points, a duplicate id, a cell naming a missing row, or a `width` not equal to the sum. Version 12 import is still refused as today. Cell bound: a board whose tables hold 5,000 cells in all is accepted; 5,001 is refused `invalid_document` |
| S426 | Concurrency, with two editor connections from one confirmed base state, each update built against that base and the room receiving them in a chosen order (both orders each): (a) typing in different existing cells: both kept; (b) typing in the same existing cell: the text holds both insertions; (c) both add a row at the end: both rows exist, ordered by id if their keys tie; (d) both set the same column's width: the later arrival wins; (e) one deletes a row while the other types in an existing cell of it: the row is gone, both edits accepted, nothing of the typing is served; (f) of a two-row table each deletes a different row: the later edit is refused `invalid_document`; (g) one adds a row while the other adds a column: both exist and the served board has no text at their intersection; then, on a fork of that merged state, the next edit by either leaves a live empty text there; (h) on another fork of the same merged state (before any initializing write), both first-type into the intersection: exactly one text survives, the same for both connections |
| S427 | Net writes (sync v15's table, inspected on the Yjs update) on a 3 × 3 table whose order keys are distinct and increasing: typing one character writes only that cell's text (and the row's `height` only when the fixture's text wraps to a new line); adding a row at the end writes one `rowMap` entry and three empty texts and no other order key; resizing a column writes only its `width`; deleting a column deletes its entry and its three texts |
| S428 | Hosted Undo, atomic: Undo of a row delete restores the row's id, order key, height and cells; of an add removes the row and its texts; of a resize restores the width; of a cell editing session restores the text. When another editor has since written any guarded value (for example typed in a cell of the added row), or deleted the column of a cell the Undo would restore, nothing is applied and the Undo reports `changed_by_others`. Undo of a whole table's delete re-creates it with a fresh table id and its nested ids unchanged |
| S429 | Stored rooms, each seeded in its old shape: storage 8 at version 13 (`pageMap`) loads live at 14 with only `schemaVersion` written; storage 7 at version 13 (a live `pages` array) loads with `pageMap` and 14, object `page` values unchanged; storage 8 at version 12 loads at 14 as `upgradeStored` does today plus the schema step. In each: unchanged revision, no edits row, receipt or history version, no new automatic capture, and a reload serves the same. History and backup: a captured version holding a table restores with it; a version 13 capture restores as 14; a backup of a board with a table restores |
| S430 | Team templates: saving a page holding a table and inserting it twice gives two tables with new table, row and column ids (different in each) and the same texts and sizes |
| Check | Command/inspection and pass condition |
| --- | --- |
| V1 | Byte-compare manifests, locks, dependency inventory and runtime notices against the prerequisite base: unchanged, no new dependency |
| V2 | `npm ci --ignore-scripts --no-audit --no-fund` exits 0 on the clean candidate and on the independent baseline |
| V3 | `npm run typecheck` exits 0 across all five workspace members |
| V4 | `npm test` full suite exits 0. `tests/tables.test.mjs` proves each group below. Guards as web modules v43 |
| V5 | Team-off `npm run build` and `npm run audit:licenses` exit 0; notices equal runtime notices v1 (team off) |
| V6 | `npm run build:fixtures`, team-on `npm run build` and `audit:licenses` exit 0; team-on notices equal runtime notices v3 |
| V7 | `npm run build:server`, `audit:licenses` and the wrangler dry run exit 0; no deploy |
| V8 | Inspect all hunks plus `git diff --name-status` and `git diff --check` over `<prerequisite-base>..<validated-source>`: only the deliverables, the dispositions above and the append-only Implementation record |
| V9 | Server-only run: `npm run test:server:node` and `npm run test:server:workerd` exit 0 on the candidate against a fresh local stack, including S425–S430 (the implementer cannot start the stack: unrun in implementation) |
| V10 | N3-S1–N3-S14 pass with the state captures and raw receipts |
| V11 | Design: the captures of N3-S1–N3-S8 show every look interaction v45 states, and the reviewer compares them with the approved design |
| V12 | Once, on an independent 3f4ad48 source and build with the candidate's `tests/tables.test.mjs` copied in: its checks and the new browser capability checks fail by name; a top-level setup or import abort does not count |
| V13 | Accepted A–J compare: baseline twice, then candidate and diffs, with existing normalization and only the palette mask above |

What `tests/tables.test.mjs` proves for V4:
- **Rules:** creating 2 × 2 and C × R tables (sizes, ids); every validation bound of document v20 and each
  refusal; `upgrade` from 13 to 14 and refusing a table below 14; canonical order; add, insert and delete of
  rows and columns keeping every other cell's text and ids; the last row or column not deletable; widths and
  set heights clamped to 64–1,000; corner scaling; duplicate and paste remapping every id and keeping texts;
  reading-order next and previous cell; arrow neighbours stopping at edges.
- **Codec and adapter:** reading a table's map and refusing every wrong shape; orphan cells not read; the
  minimal writes of typing, add, resize, move and delete; empty cells written as empty texts, never
  deleted; orphans removed by the next write.
- **Merge:** two Yjs docs from one base merging each S426 case through the room's `promote()` with the
  stated result.
- **Hosted Undo:** `column:`, `row:` and `cell:` units for add, delete (restored with the same ids and
  cells), resize and text, and the per-value guard when someone else wrote the value.
- **`table.ts` (web):** hit testing cells, borders (within 4), grabbers and add bars; drawn row heights; the
  drag size, ghost and label; the selection level after board changes, including the remote-delete words for
  `remote` and the silent fallback for `reload`; the bar modes and disabled reasons; the editor's accessible
  name and the announcement.
- **Keys:** ⇧T; Return, Escape, arrows, Tab and Shift+Tab with a table, cell, row or column selected and
  while editing; ⌥ shortcuts; Delete and Backspace at each level; nothing acts while composing; viewers.
- **Row growth:** a committed edit raises the row's set height in the same step; removing text never lowers
  it.
- **Local history:** each step of interaction v45 "Undo" is one step.
- **Stored room upgrade without the stack:** a room unit check loads a stored version 13 room seeded in its
  old shape and asserts live version 14 and no edit, on the in-memory storage the room tests use.
- **`table-buttons.tsx`:** the grabbers and add bars are buttons with the names of interaction v45, 28 × 28
  minimum hits, shown only at the stated selection levels and never for viewers.

A regression failure that also fails on 3f4ad48 is a baseline finding to report, never fixed here.

## Review focus and public references

Review that:
- cells are addressed by row and column ids everywhere (document, adapter, history, Undo), so no step moves
  another cell's text;
- `columnMap`, `rowMap` and `cells` writes are minimal, and the reading order is deterministic;
- `promote()` covers the `order`, `width` and `height` writes in table entries and skips deleted entries;
- orphan cells are never read and are removed by the next write; a delete always wins over an edit inside;
- the room refuses every table that breaks document v20 and never repairs one;
- hosted Undo of a row or column delete restores the same ids and cells;
- the cell editor is the native field, with Return as a line break, Tab and Shift+Tab moving cells, arrows
  kept inside the text, and nothing acting while composing;
- row growth happens in the same step as the text commit;
- the remote-delete rule runs only for another person's change, never for this tab's own delete;
- viewers can make no table step through any control or key;
- no connection dots are drawn on tables and no connector attaches to one;
- duplicate and paste give new ids throughout;
- intersections of concurrently added rows and columns are initialized by the next write, and the codec
  checks live keys while tolerating tombstones;
- hosted Undo of a table step is atomic and refused whole when any guarded value changed;
- stored rooms take the right one of sync v15's three upgrade branches, never rewriting object pages, with an
  unchanged revision and no new automatic capture;
- the drawn box is used for every geometric purpose and row growth uses the stated line heights;
- App.tsx changed only by the recorded substitutions.

Unresolved after read 2 (the read cap), for the check run and review to confirm:
- hosted Undo's guard is checked by the issuing tab, so a peer change still in flight can be overwritten by
  the Undo (sync v15 states this as today's behaviour for every hosted Undo); not tested beyond S428;
- the composition rebase rule (interaction v45) on a real input method;
- the 5,000-cell board bound (a Board value, not from the reference product) against the room's backup limit;
- border drags and whole-row or whole-column selection are pointer-only; the menus and Objects panel give the
  keyboard routes;
- the A–J schema-field normalization keeps every other byte equal.

The public source basis is main 3f4ad48 and the linked versioned contracts, read 2026-11-17. No outside
product is needed to implement this contract, and no unresolved product decision is delegated to
implementation.

## Exclusions and reasons

- Per-cell formatting (fill, typeface, size, colour, bold, strikethrough, link, lists, alignment), merged
  cells, multi-cell selection, moving and duplicating rows and columns, and the middle insert points: a
  later milestone.
- Pasting from a spreadsheet and CSV import or export: a later milestone.
- Finding text in cells; attaching connectors to tables; stamps in cells; links to a table.
- Another person's cell highlight; locking a cell while someone edits it.
- Repairs to separately tracked baseline failures.

## Implementation record
