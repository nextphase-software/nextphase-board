BRIEF VERSION: 0011-W3 v1 (2026-11-27)
# 0011-W3 — Arrange table cells

Status: Draft. Implementation has not started under this brief.

## Outcome and read first

Tables can be rearranged, on single-user and team boards alike.
- **Choosing several cells.** With a cell of a table selected, ⇧-click another cell of it to select the rectangle
  between them (a **range**), or ⌘-click (Ctrl on Windows and Linux) to add or remove single cells (a **set**).
  ⇧+arrow keys grow or shrink a range. ⇧-click and ⌘-click on grabbers do the same for whole rows and columns. The
  bar then reads `Cells` · `N cells` (or `Rows` · `N rows`, `Columns` · `N columns`); Delete clears every chosen cell.
- **Inserting in the middle.** With any part of a table selected, the row and the column under the pointer show their
  grabbers, and a small dot on each of their **inner** borders. A dot turns into a plus; a click inserts an empty row
  or column there, the size of the row above (the column to the left); the selection does not move.
- **Moving.** Row options gains `Move row up` and `Move row down`; Column options gains `Move column left` and
  `Move column right`. Dragging a grabber along its axis moves the row or column (a run moves together); a blue line
  shows where it lands; Escape cancels. The moved rows stay selected.
- **Duplicating.** ⌘D with one row or column, or a run, selected puts copies right after them and selects the copies;
  also `Duplicate row` / `Duplicate column` in the menus.
- **Merging.** `Merge cells` (⌥M) joins a rectangle into one cell, keeping the top-left cell's text and clearing the
  others; `Split cell` (⌥M again, shown pressed) gives the cells back with the text top-left. A merged cell is
  selected, edited and navigated as one cell; inserting inside it makes it bigger, deleting shrinks it.
- Each of these is one Undo step. Merges are saved and kept in copies, board files, templates and history; CSV export
  writes a merged cell's text in its top-left cell.
- **Team boards.** Owners and editors get all of it; two people arranging one table keep each other's changes. If a
  merge covers the cell someone is typing in, their editor closes and they see `<label> merged cells you were
  editing.` Viewers see merged cells but none of the new controls.

Read [AGENTS.md](../../AGENTS.md), [CONTRIBUTING.md](../../CONTRIBUTING.md), [DESIGN.md](../../DESIGN.md)
and these new contract files (prior versions remain untouched):

| Contract | New version / ownership |
| --- | --- |
| [Document](../architecture/0001-document-v24.md) | v24: a table's `merges`, schema 18 and its upgrade from 17, the merge rules, `canonical()` order, and the table rule functions (`mergeOf`, `rangeBounds`, `canMerge`, `mergeRange`, `splitMerge`, `canMove`, `moveAxis`, `canDuplicate`, `duplicateAxis`, and the changed `insertAxis`, `deleteAxis`, `setCell`, `remapTable`, `nextCell`, `neighbourCell`, `layoutTable`'s drawn-height rule) |
| [Interaction](../architecture/0001-interaction-v54.md) | v54: every arrange behaviour, word and look: hovered grabbers and insert points, the range, set, row and column selections, ⇧/⌘-click and ⇧+arrows, the Cells, Rows and Columns bars, Merge cells and Split cell, the Row and Column menus, keys, the drag, Duplicate, the reasons for each refusal, announcements, the remote-merge notice, viewers |
| [Web modules](../architecture/0001-web-modules-v52.md) | v52: the new modules, the changed files, App.tsx's wiring, CSS rules, effects, counts and tests |
| [Sync](../architecture/0003-sync-v20.md) | v20: live board 18; a table's `mergeMap`; reading and writing it; moves and duplicates through order keys; the room's refusal of a result that breaks the merge rules; concurrent changes; hosted Undo of a merge; the remote-merge notice |
| [Board file](../architecture/0006-board-file-v8.md) | v8: documents of version 1 to 18; merges travel inside `document` (file version stays 3) |
| [Team templates](../architecture/0008-team-templates-v6.md) | v6: templates hold documents at schema 18 (the version 18 wrapper); a template's tables keep `merges` |
| [Storage](../architecture/0001-storage-v7.md) | v7: reading accepts schema 1–18; `newer` is above 18 |
| [API](../architecture/0003-api-v18.md) | v18: board create and import accept schema 13–18; template objects are validated inside a version 18 wrapper |

Use this set wherever inherited contracts link a replaced version. Unchanged: [hosted storage v15](../architecture/0003-hosted-storage-v15.md),
[hosted persistence v13](../architecture/0003-hosted-persistence-v13.md), [board lifecycle v8](../architecture/0006-board-lifecycle-v8.md),
[access v17](../architecture/0003-access-v17.md), [link preview v1](../architecture/0012-link-preview-v1.md),
[presence v5](../architecture/0004-presence-v5.md), [comments v5](../architecture/0005-comments-v5.md),
[workshop voting v3](../architecture/0007-workshop-voting-v3.md), [toolchain v6](../architecture/0001-toolchain-v6.md),
[self-host runner v11](../architecture/0003-self-host-runner-v11.md), [lock v5](../architecture/0001-dependency-lock-v5.json),
[inventory v5](../architecture/0001-dependency-inventory-v5.json) and [runtime notices v1 and v3](../architecture/0001-runtime-notices-v3.txt).
The room's stored layout stays 9; the service tables stay 17: no service migration.

Build directly; no prototype or scenario tool is an input. Prove the stated values with focused tests, followed by
independent checks. Report a contract conflict before dependent work.

**Design.** The look was approved on 2026-11-27 (nine screens: `1-insert-point`, `2-range`, `3-set`, `4-merged`,
`5-row-menu`, `6-drag-move`, `7-duplicated`, `8-notice-editor`, `9-notice-owner`). Interaction v54 states every value
of it; in short: insert dot 8 × 8, radius 4, `#8fbdf5`, centred on each inner border 14 outside the table's left
(rows) or top (columns) edge, hit area 24 × 24; hovered: an 18 × 18 `#518de0` circle with a white 10 px plus (stroke
1.8), shadow `0 1px 3px rgba(20,18,26,.25)`, a 2 px `#8fbdf5` line along that border across the whole table, and the
tooltip `Insert row` / `Insert column` in the app's tooltip look 8 px from the circle; hovered grabber pills as the
selected cell's pills today (20 × 6 / 6 × 20 `#8fbdf5`, centred 14 outside the edge); range: one 2 px `#518de0`
outline and 1 px `#8fbdf5` lines on its inner borders; set: a 2 px `#518de0` outline on each chosen cell; merged
cell: one box with no inner grid lines; pressed `Split cell` filled `#7051cf`, radius 8, `aria-pressed="true"`; drag
ghost at the table's width (height), white at 92 %, 1 px `#d9dfe7`, shadow `0 8px 24px rgba(20,18,26,.18)`, 10 px
from the pointer; the moving rows' place `rgba(245,247,250,.85)`; drop line 2 px `#518de0` reaching 4 px past each end
of the table; pointer `grabbing`; the context bar centred on the selection's box with its bottom 48 above the table's
top for every cell, range, set, row or column selection; the notice in the app's existing notice bar.

**Where the contract and the screens differ, the contract wins.** Known differences: screens `2-range` and `3-set` show
the bar off-centre (interaction v54 AT5 centres it on the selection's box); screen `7-duplicated` shows the Row bar
without `Merge cells` (AT5 adds it before `Delete row`); screens `8-notice-editor` and `9-notice-owner` show nothing
selected (AT16 makes the merged cell the selection when the editor closes); screen `5-row-menu` highlights `Add row
above` (the open menu focuses its first enabled item, `Move row up`); screen `6-drag-move` still shows the bottom add
bar (AT11 hides add bars during a drag); screens `8-notice-editor` and `9-notice-owner` draw the notice at 13 px with
an 8 px radius and their own fill, border and padding (the app's existing `.notice` look is kept); screen
`1-insert-point`'s tooltip uses a 12 px / 1.3 line height (the app's `.tooltip` look is kept). Screens 8 and 9 were also drawn on a local
board in the notice bar's place, so their team chrome (avatars, Share) is absent; on a team board it is the team
board's. Texts and positions may differ by the fixture.

## Deliverables and boundaries

Planning source baseline main **8fd36fb**. Use a fresh milestone worktree and branch from committed main containing
this packet, recording that prerequisite base separately from the behaviour baseline. New source files carry
`SPDX-License-Identifier: Apache-2.0`. Only these files may change, plus the append-only Implementation record below.

**New (five).**
1. `apps/web/src/table-selection.ts` (web modules v52: choosing several cells, rows or columns; AT1–AT3)
2. `apps/web/src/table-arrange.ts` (bar and menu states, actions, hovered controls, the drag's geometry; AT5–AT13)
3. `apps/web/src/state/use-table-arrange.ts` (`useTableArrange`, no effect)
4. `apps/web/src/ui/table-menu.tsx` (`AxisMenu`, moved out of `ui/table-controls.tsx`)
5. `tests/table-arrange.test.mjs` (X12-W00, X12-W01 onward)

The rules package gains no file: document v24's rules live in `packages/board-rules/src/objects/table.ts`.

**Changed**, each only as web modules v52 **Changed files** (and the contract it cites) states.

| # | File |
| --- | --- |
| 1 | `packages/board-rules/src/objects/table.ts`, `objects/registry.ts`, `document.ts` (document v24) |
| 2 | `packages/board-sync/src/codec.ts`, `document-adapter.ts`, `undo.ts`; `session.ts` (scoped: its `board` type follows `readLiveBoard`, and `capture()` never emits a board that fails the document rules, so the client holds its last valid board, releases the hold after a valid remote `update` or own `saved` reconciles history, and rejoins after refusal or failed reconciliation; sync v20) |
| 3 | `packages/board-room/src/conflicts.ts`, `edits.ts`, `room.ts`, `history.ts` (sync v20); `snapshots.ts` (scoped to the uncapped load-time upgrade snapshot; ordinary writes keep `canonical()`'s cap) |
| 4 | `apps/server/src/routes/boards.ts` (API v18), `apps/server/src/templates.ts` (team templates v6) |
| 5 | `apps/web/src/App.tsx` (web modules v52's nine substitutions only; it stays at 264 newlines) |
| 6 | `apps/web/src/table.ts`, `context-bar-position.ts`, `icons.tsx`, `gesture.ts` (`Drag` gains `arrange?: true`, so the grabber drag holds the shared gesture gate) |
| 7 | `apps/web/src/state/use-selection.ts`, `state/use-canvas-input.ts`, `state/use-editing-commands.ts`, `state/use-geometry-edits.ts` (scoped: a row border drag, a corner resize and an Objects-panel resize all start from saved heights, never drawn growth), `state/use-board-document.ts` (scoped: `commit` returns the admitted board and records the history step only after admission; hosted success means optimistic admission, and a later room refusal takes today's reload path), `state/use-page-keys.ts` (scoped: no page command while a grabber drag is past its threshold; Escape ends the drag), `state/use-hosted-board.ts` (`onTableChange` passes the table before the update to `validTableSelection`) |
| 8 | `apps/web/src/scene/table-body.tsx` (the resize highlight clipped to visible grid segments), `scene/board-drawing.tsx`, `scene/table-buttons.tsx` |
| 9 | `apps/web/src/ui/table-controls.tsx`, `ui/context-bar.tsx` (a `tableCells` prop passed to `TableControls`) |
| 10 | `apps/web/src/storage.ts` (storage v7), `board-file.ts` (board file v8), `team/templates-rules.ts` and `team/templates-section.tsx` (its preview reads with `templateBoard(objects, true)`) (team templates v6) |
| 11 | `apps/web/style.css` (only the seventeen rules of web modules v52, inserted as one block right after `.context:has(.table-menu:not([hidden])) { z-index: 6; }` and before the blank line that precedes `.export-dialog`; nothing appended at the end of the file and nothing before `/* Pages:` changed) |
| 12 | `tests/tables.test.mjs` (new checks `T-U16` onward: document v24's and sync v20's Verification items), `tests/document.test.mjs` (document v24's items), `tests/table-csv.test.mjs` (a merged table's export), `tests/storage.test.mjs` (storage v7's items), `tests/team-templates.test.mjs` (team templates v6's client items, the mixed catalogue included) |
| 13 | `tests/server/tables.test.ts` (S480, S481) |
| 14 | `tests/modules.test.mjs`, `tests/find.test.mjs` (F1-U14's synthetic scope only) and the schema-pinning tests (only the dispositions below) |
| 15 | `tests/README.md` (the new test file and checks) |
| 16 | `docs/guides/try-board.md` (two rows, below) |

Unchanged (web modules v52): `packages/board-room/src/repair.ts`, `ui/content-field.tsx`,
`state/use-object-layouts.ts`, `state/use-editor-placement.ts`, `state/use-context-bar.ts`, `state/use-viewport.ts` (its wheel and pinch already stop while `drag.current` is set, which the grabber drag now sets), `state/use-export.ts`, `board-export.ts`, `table-csv.ts`,
`clipboard.ts`, `history.ts`, `team/hosted-board.ts`, `geometry.ts`, `scene/export-drawing.tsx`, and the files that
name `BoardV17` or `BoardV16` (aliases of `BoardV18`). The Vitest configs do not change (S480 and S481 go in an
existing file). **No other package, server, `supabase/` or manifest file changes**, and no other web file.

New checks import the changed or new modules dynamically inside their named checks, never at top level, so on the
8fd36fb baseline each new check fails by name (V12).

**Try-and-test guide.** One row at the end of Part 1's table and one at the end of Part 2's. Nothing else in the
guide changes. In Part 1, "A1…C3" means column letter and row number: row 1 holds A1, B1, C1.

Part 1 (local):

| Feature | Try this | You should see |
| --- | --- | --- |
| [Arrange table cells](../briefs/0011-W3-arrange-table-cells.md) | Click the board name, type "Arrange" in Board name and close the panel. Choose the Table tool and drag on the board until the label reads 3 × 3, then release. Click the top-left cell (A1), press Return and type A1, then press Tab and type B1, and so on with Tab between cells up to C3; press Escape twice. Click A1, then ⇧-click B2, click Merge cells, then Cmd+Z (Ctrl+Z). Rest the pointer over the middle of row 1, move it to the dot on the left edge between rows 1 and 2 and click the plus. Rest the pointer over row 3, click the grabber left of it, choose Row options › Move row up, then press Cmd+D (Ctrl+D). Click Save, wait for "Locally saved" and reload | Merge makes one cell showing A1 over four, Undo brings back B1, A2 and B2. An empty row appears between rows 1 and 2. Row 3's texts move up one place, then a copy appears right below it, selected. After the reload the table is the same |

Part 2 (team mode):

| Feature | Try this | You should see |
| --- | --- | --- |
| [Arrange table cells on team boards](../briefs/0011-W3-arrange-table-cells.md) | Ana and Ben open the same team board with a 3 × 3 table holding A1…C3. Ben double-clicks B2 and starts typing. Ana clicks the table, clicks A1, ⇧-clicks B2 and clicks Merge cells. Then Ben rests the pointer over row 1, clicks the grabber left of it, rests over row 2 and ⇧-clicks its grabber, and chooses Row options › Move rows down, while Ana rests the pointer over column 2 and clicks the dot on the top edge between columns 2 and 3 | Ben's typing stops and he sees "ana merged cells you were editing."; both see one merged cell with A1's text. Both then see row A3…C3 on top with the merged cell's two rows below it, and a new empty column right of column 2 |

Not allowed:
- a dependency, font, image file, service, service migration or import exception;
- a new stored value other than a table's `merges` (document v24) and a table's `mergeMap` (sync v20), a room message,
  a presence key, or an Undo step for hovering, choosing, starting a drag or cancelling one;
- a canvas right-click menu; cell formatting (fill, size, colour, bold, strikethrough, link, alignment); pasting onto
  selected cells, copying only the selected cells or exporting part of a table; ranges or drags across tables;
- cell locks or any wait for other people during a merge;
- a state hook, scene part or screen part beyond web modules v52, or effect counts other than its.

Outside the named new controls, the existing screens' markup stays exactly as at the base. The reviewer's A–J
comparison holds no table, so it is compared unmasked; for its saved payloads the check run normalizes only the
`schemaVersion` field (17 → 18) and verifies separately that the raw digests differ only there.

## Required behavior and concrete design

Implement document v24, sync v20, board file v8, team templates v6, storage v7, API v18, interaction v54 and web
modules v52 in full. In particular:

- **The saved form:** a table's `merges` after `cells` (saved key order `id, generation, type, page, columns, rows,
  cells, merges, textSize, group, section, x, y, width, height, order`), each entry exactly `row, column, rows,
  columns`; merges never overlap, cover at least two cells, stay inside the table from the anchor's current index,
  and a covered cell holds no text; `canonical()` sorts them by anchor row index, then anchor column index. Schema 18,
  upgraded from 17 by adding `merges: []` to every table. A merge counts no object toward the 250-object limit.
- **The table rules** (document v24): merge a range grown to cover every merge it touches, keeping the anchor's text
  and removing every other text inside it; split leaving the text in the anchor; move a run to an allowed gap; duplicate
  a run right after itself with its inner merges; insert strictly inside a span grows that merge; delete shrinks it,
  moves the anchor when its row or column goes (its text lost with it), and removes a merge left with one cell;
  navigation treats a merged cell as one cell.
- **Choosing** (interaction v54): ⇧-click, ⌘-click (Ctrl on Windows and Linux), ⇧-click and ⌘-click on grabbers,
  ⇧+arrows; another kind starts again with that one item; not while editing; for viewers ⇧/⌘-click acts as a plain
  click.
- **Hovered grabbers and insert points** exactly as interaction v54: shown with the table or any part of it selected,
  not editing, not read-only, not dragging, for the row and column under the pointer (over the table, or within 40 px
  left of it for rows / above it for columns); dots on inner borders only; buttons named `Insert row between rows N
  and N+1` / `Insert column between columns N and N+1`; the new row takes the height of the row above (the new column
  the width of the column to its left); the selection does not change.
- **Bars, menus and keys**: the Cells, Rows and Columns bars; `Merge cells` on the single Row and Column bars before
  `Delete row` / `Delete column`; `Split cell` (pressed) on the Cell bar of a merged cell before `Delete content`; the
  Row and Column menus in interaction v54's order; ⌥M, ⌘D, Delete and Backspace, Return, Tab, arrows and Escape as v54;
  none act during composition.
- **Drag**: a press on a grabber followed by 4 px along its axis; a click otherwise; the drop line only on an allowed
  gap; release moves; Escape or a lost pointer cancels; one Undo step on release.
- **Refusals** carry their reason as the item's or dot's title: `Already the first row`, `Already the last row`,
  `Already the first column`, `Already the last column`, `Choose rows next to each other`, `Choose columns next to each
  other`, `A merged cell is in the way`, `Already a single cell` (Merge cells when the merge rectangle is one cell), and today's limit reasons (`A table holds at most 50 rows`, `A table holds at
  most 20 columns`, `A table needs at least one row`, `A table needs at least one column`).
- **Announcements** through the existing polite status: `N cells selected`, `N rows selected`, `N columns selected`,
  `Row inserted`, `Column inserted`, `Row moved to row N`, `Rows moved to rows N–M`, `Column moved to column N`,
  `Columns moved to columns N–M`, `Row duplicated`, `Rows duplicated`, `Column duplicated`, `Columns duplicated`,
  `Cells merged`, `Cell split`. A merged cell's editor name is today's `Row R, column C of <table name>` with R and C
  its anchor's.
- **Drawing**: a merged cell is one box over its span with no inner grid lines, its text laid out across the span's
  width with today's padding (20) from its top-left; a merged cell whose text needs more height than its rows' total
  adds the difference to the last row of its span (drawn height).
- **Team boards** (sync v20): `mergeMap` keyed `<row id>:<column id>` of the anchor with plain `{ rows, columns }`;
  the writer touches only changed entries. On a fully initialized table (every live row and column pair has a text and no orphan text is live) whose stationary order keys are strictly increasing and where a key fits between each moved id's new neighbours, a move's update writes exactly one `order` per moved row or column and nothing else.
  Otherwise sync v14's tie and rebalance steps and sync v15's cleanup apply, as sync v20 states. A merge writes its
  entry and empties the covered texts in one update; a result that breaks document v24 is refused by the room
  (`invalid_document`) and that client rejoins; the remote-merge notice and hosted Undo as sync v20.
- **Other features**: copy and paste, Duplicate, templates, board files, history, backups and local storage keep
  `merges` (new ids on copy through `remapTable`); CSV export writes a merged cell's text in its anchor and leaves
  covered cells empty; CSV paste and import make tables with `merges: []`; nothing else in 0011-W2's CSV behaviour
  changes.
- **Limits** unchanged: 1–50 rows, 1–20 columns, 1,000 code points a cell, 5,000 table cells a board.

## Shared-path check dispositions

This inventory authorizes expectation changes, not additional historical runs.

| Shared path / older checks | Disposition |
| --- | --- |
| Live current-schema assertions (the version `empty()`, `upgrade`, `validate` of a current fixture, a save, an export, a served or reloaded room, a restore, a template wrapper or an import produces): `tests/board-file.test.mjs:56`; `connector-styles.test.mjs:45,84,478,539`; `connectors.test.mjs:37`; `document.test.mjs:117,132,135,246,293,375`; `images.test.mjs:27,56`; `link-cards.test.mjs:255`; `mind-map.test.mjs:66,70`; `pages.test.mjs:26,57,214,315`; `room.test.mjs:248`; `room-imports.test.mjs:106`; `room-videos.test.mjs:163,166`; `shapes.test.mjs:39`; `storage.test.mjs:116,132`; `strokes.test.mjs:32,96`; `team-import.test.mjs:84`; `team-templates.test.mjs:48`; `text-link-rules.test.mjs:124,125,182,209,245,259,260`; `video.test.mjs:91,102`; `tests/server/drawing-layout.test.ts:96,97,102,133,137,144`; `server/mind-maps.test.ts:105,107,114,122,189,213`; `server/pages.test.ts:91,99,102,129`; `server/shared.test.ts:996`; `server/tables.test.ts:115,118,122,322,328,353`; `server/text-links.test.ts:87,142` (line numbers at 8fd36fb) | 17 becomes 18, in values and in messages (`server/mind-maps.test.ts:114` "serves version 18 again"). In `room-videos.test.mjs` the iteration over live schemas gains 18 and its live-schema predicate becomes `=== 18`. An upgraded document's expected value gains `merges: []` on each table (none of these fixtures holds a table unless it says so). Every other assertion unchanged; must pass. The record lists each changed line |
| Newer-than-current fixtures at 18: `tests/board-catalog.test.mjs:235,322`; `board-file.test.mjs:79,139`; `document.test.mjs:43`; `mind-map.test.mjs:74`; `pages.test.mjs:209`; `storage.test.mjs:92`; `text-link-rules.test.mjs:164` | 18 becomes 19; `pages.test.mjs` check 27's title becomes "storage and board files accept 13–18, classify 19 as newer, and preserve all pages". Every other assertion unchanged |
| `tests/tables.test.mjs` T-U01 (`:34`, `:48`) and T-U11 (`:408`, `:410`, `:413`, and its title "… upgrades to 17 …") | Exempt from "unchanged": their current-version assertions and T-U11's title move to 18; their behaviour assertions stay as written and must pass |
| The Yjs upgrade-delta assertions `tests/tables.test.mjs:410` and `tests/server/tables.test.ts:328` (`delta[0].content.getContent()[0]`) | The expected schema value moves from 17 to 18; the assertions that the table-free fixtures write exactly one struct (`delta.length === 1`) stay and must pass |
| Historical assertions: a fixture's own declared version (for example `pages.test.mjs:212` at 13, `text-link-rules.test.mjs:126` at 16), legacy upgrades' sources, and check titles that name the version a past milestone introduced (`text-link-rules.test.mjs` checks 7, 9 and 13 keep their titles; their live assertions follow the first row) | Unchanged |
| Not schema numbers: the 17 service tables (`tests/server/history.test.ts:202`, `server/templates.test.ts:238`, `server/reactions.test.ts:148`) and the timer `version: 17` (`workshop-timer.test.mjs:139`) | Unchanged |
| Table fixtures written literally at the current schema in the files above | A current-schema table gains `merges: []` right after `cells`; a fixture declared at 14–17 keeps its shape and is read through the upgrade. Every other assertion unchanged |
| `tests/tables.test.mjs` T-U01–T-U15 other than the T-U01 and T-U11 lines above, including T-U14's read of `apps/web/style.css` (the add bar rule) | Unchanged; must pass as written (web modules v52 **Tests**) |
| `tests/table-csv.test.mjs` existing checks | Unchanged; must pass as written (`table-csv.ts` does not change) |
| `tests/context-bar-position.test.mjs` | Unchanged; must pass as written: the cell, row, column and table positions keep today's results |
| `tests/modules.test.mjs`: screen parts and state hooks lists, App budget, App composition, "App.tsx is composition only", the type-name guard, its reads of `context-bar-position.ts` (no React import), `state/use-editing-commands.ts` (no effect) and `state/use-canvas-input.ts` (two passive effects) | As web modules v52 **Effect guards and module lists**: 38 screen parts (gaining `table-menu.tsx`), 31 state hooks (gaining `use-table-arrange.ts`), the new "the table arrange hook contains no effects", the App composition test titled "0011-W3 App composition changes only its recorded substitutions" with the nine pairs appended; the budget stays 264; every other guard (19 rules files, 13 object types, 22 scene parts, 57 team modules, twelve board-sync modules, the effect counts) unchanged and must pass |
| `tests/modules.test.mjs` effect guards for changed hooks: "the geometry edits hook contains no effects" (`:353`), "the page keys hook contains no effects" (`:364`), "the hosted board hook holds exactly one passive effect" (`:604`) | Unchanged; must pass as written (each hook keeps its effect count) |
| `tests/find.test.mjs` F1-U14 (slices `sceneKeyDown` out of `use-canvas-input.ts` up to `function pointerDown(` and runs it in a synthetic scope) | The extraction boundary stays (`sceneKeyDown` still ends right before `function pointerDown(`). Its synthetic `state` gains only `tableSelection: undefined` (web modules v52), which keeps today's path; every assertion unchanged and must pass. The record lists the fixture lines |
| `tests/pages.test.mjs` (the style.css prefix comparison before `/* Pages:` and the parsed-rule comparisons) | Unchanged; must pass as written: the seventeen rules go after the table block, never before `/* Pages:` |
| `tests/text-links.test.mjs` check 14 (style.css ends with web modules v51's link rules and selection highlight rules) and its selection-highlight CSS assertions (`:574`–`:577`) | Unchanged; must pass as written: nothing is appended at the end of the file |
| `style.css` source checks in `tidy-up`, `video-playback`, `workshop-voting` and `workshop-spotlight` tests; `tests/workshop-voting.test.mjs` (App order assertion) | Unchanged; must pass as written |
| `tests/board-export.test.mjs` X6-U09 (the complete `BoardDrawing` props from `export-drawing.tsx`) | Unchanged; must pass as written: `tableDrag` is optional and `export-drawing.tsx` does not pass it |
| Tests that list a table's shared-document keys through the codec (`place`, `tableStyle`, `columnMap`, `rowMap`, `cells`) | At 18 the list gains `mergeMap` (sync v20); at 14–17 unchanged |
| Tests listing the Row or Column menu's entries, or the single Row or Column bar's buttons, in order | The menus become interaction v54 AT6's lists; the Row and Column bars gain `Merge cells` before `Delete row` / `Delete column` (AT5); the Cell bar of an unmerged cell is unchanged |
| Tests asserting that ⌘D duplicates the table while one of its cells, rows or columns is selected, if any | AT7: with one row or column, or a run, ⌘D duplicates it; with a cell, range or set it does nothing; with the whole table it is today's Duplicate |
| Tests asserting Shift-click on a cell of a table whose cell is selected, if any | AT2: it now makes a range; Shift-click on the table while the table is selected, on another object or on empty canvas keeps today's rules |
| Server and room tests that seed stored older boards | They keep building older boards in the old shape at their declared versions; a stored schema-17 room holding a table loads and upgrades to 18 with an empty `mergeMap` (S481) |
| The scene's paste chain (`tableData.paste`, `links.paste`, the hosted and image pastes in `App.tsx`) | Unchanged; must pass as written |
| Historical browser scenarios N3 (0011-W1) and N5 (0011-W2) (V14) | Read with these dispositions: N3-S4's menu list and N3-S3 and N3-S7's Row and Column bars as above; hovered pills and dots may show in captures where the pointer rests over a selected table; every other assertion as written. Any row that also fails on 8fd36fb is a baseline finding |

## Browser checks

New scenario **N12-S1–N12-S14**. N12 was unused as a scenario ID in existing public briefs when allocated. A fresh,
independent check run writes its tool from these clauses and the contract values. Each row prints its full ID,
`PASS:` or `FAIL:` and a summary, and keeps raw receipts and unrun rows.

Setup: 1440 × 900, scale 1, macOS Chrome (so ⌘ and ⌥ keys), US keyboard layout, clipboard read and write granted to
the app's origin. Rows N12-S1–N12-S10 on the local app (single-user mode); N12-S11–N12-S14 on the local team stack
started from the candidate on its own uniquely owned local Supabase project, with Ana (owner), Ben (editor) and Mia
(viewer) each in their own browser context (N12-S14's Part 1 walk on the local app). Real pointer and key events,
never painted DOM. The run is on a Mac, so ⌘ is Cmd: Ctrl-click, Ctrl+D and the `Ctrl+D` menu shortcut text off Mac
are proved by unit checks only (X12-W01). Positions are derived from the table's drawn layout (±0.5 CSS px); colours, sizes and words
exactly as interaction v54. "Within 3 s" means the change shows on the other screen within 3 seconds. "Row r, column
c" counts from 1 in the table's current order. Each row sets up its own state from its fixture, so on the baseline
every row fails by its own first new check. Each row saves the captures it names; a capture never blurs an open menu
or tooltip.

**Fixture L** (local): a new board named `Launch plan` (board panel, Board name) with one 4 × 4 table placed with the
Table tool by a drag from board point (−384, −128) to (380, 120) (the label reads `4 × 4` before release); click row 1,
column 1, press Return, type the cells with Tab between them, press Escape twice, then click empty canvas:

| Row | Column 1 | Column 2 | Column 3 | Column 4 |
| --- | --- | --- | --- | --- |
| 1 | `Task` | `Owner` | `Status` | `Due` |
| 2 | `Ship CSV import` | `Ana` | `In review` | `Dec 2` |
| 3 | `Write release notes` | `Ben` | `Doing` | `Dec 4` |
| 4 | `Plan the demo` | `Mia` | `To do` | `Dec 6` |

Saved (`Locally saved`), view 100 % at (0, 0), Select tool, nothing selected, focus on the canvas. The tool records
every row and column id. Cells below are named by their text in this fixture.
**Fixture T** (team): the guide's Part 2 seed (Example team with Ana as owner, Ben as editor, Mia as viewer) and
sign-in steps; from the seeded team board Ana chooses Board › Back to files › New board, sets Board name to `Arrange check` and makes Fixture L's table the same
way; Ben and Mia open the board and see the table within 3 s; every context at 100 % with the view at (0, 0) and
nothing selected.

| ID | Scriptable behavior and expected result |
| --- | --- |
| N12-S1 | Fixture L. Click the table, then `Ship CSV import`: the cell is selected with today's row 2 and column 1 grabbers. Move the pointer over `Doing` without pressing: row 3's pill (6 × 20, `#8fbdf5`, centred 14 left of the table's left edge at row 3's middle) and column 3's pill (20 × 6, centred 14 above the top edge) show as buttons named `Select row 3` and `Select column 3`, besides row 2's and column 1's; one 8 × 8 `#8fbdf5` dot on the left edge line (14 outside) at the border between rows 2 and 3 and one at rows 3 and 4, and one on the top edge line at columns 2 and 3 and one at columns 3 and 4; none on the table's outer edges. Hover row 1 instead: one row dot only (rows 1 and 2). Hover the middle of row 3 again, then move onto the row dot between rows 2 and 3 and rest there: the 18 × 18 `#518de0` circle with the white plus, the 2 px `#8fbdf5` line across the table on that border, and the tooltip `Insert row` 8 from the circle; the button's accessible name is `Insert row between rows 2 and 3`; capture insert-point. Click it: an empty row 3 appears with the saved height of row 2, `Write release notes` is now in row 4, every text keeps its row and column ids, the selection is still `Ship CSV import` (bar `Cell`), status `Row inserted`. ⌘Z (scene focused): the table equals the fixture (ids and texts); ⇧⌘Z: the row is back with the same id. Drag the border between columns 2 and 3 40 right (column 2 232 wide); hover column 3 and click the dot between columns 2 and 3 (`Insert column between columns 2 and 3`, tooltip `Insert column`): an empty column 3, 232 wide; status `Column inserted`. With the pointer 30 left of the table at row 4's height, row 4's pill and dots show; at 60 left, no hovered pill or dot. Tab from the scene never focuses a dot (dots are hover-only; the keyboard route is the menus' Add items). Click `Ship CSV import` again and press Return (editing it), then hover row 3: no hovered pill or dot |
| N12-S2 | Fixture L. Click the table, then `Ship CSV import`; ⇧-click `Ben`: rows 2–3 × columns 1–2 selected, one 2 px `#518de0` outline round the rectangle and 1 px `#8fbdf5` lines on its one inner row border and one inner column border; status `4 cells selected`; the bar reads `Cells`, `4 cells`, `Merge cells` (enabled; hovered tooltip `Merge cells ⌥M`), `Delete content`, `Copy link to table`, centred horizontally on the range's rectangle with its bottom 48 above the table's top (AT5); capture range. ⇧+ArrowRight: `6 cells` (columns 1–3); ⇧+ArrowDown: `9 cells` (rows 2–4); ⇧+ArrowDown again: unchanged; ⇧+ArrowLeft twice: `3 cells` (rows 2–4, column 1). Click `Ana` (a plain click: the single cell, bar `Cell`); ⌘-click `Doing`: each of the two cells has its own 2 px `#518de0` outline and there are no inner lines; status `2 cells selected`; the bar reads `Cells`, `2 cells`, `Delete content`, `Copy link to table`, with no `Merge cells`, centred on the smallest box holding both cells; capture set. ⌘-click `Dec 6`: `3 cells`; ⌘-click `Doing`: `2 cells`; ⌘-click `Dec 6`: the single cell `Ana` (bar `Cell`). ⌘-click `Doing` and `Dec 6`, press Delete: `Ana`, `Doing` and `Dec 6` are empty, the other 13 texts unchanged and the set still selected; one ⌘Z restores all three (the table is then selected, AT17); ⇧⌘Z empties them again; ⌘Z. Click `Ship CSV import`, ⇧-click `Ben`, click `Delete content`: the four are empty; ⌘Z restores them (the table is then selected). Click `Ship CSV import` again, ⇧-click `Ben` and press Return: `Ship CSV import` is being edited (the range has ended); Escape: that cell is selected. ⌘-click `Doing`, then ⌘-click column 3's hovered grabber: column 3 alone is selected (bar `Column`). Click `Ship CSV import`, ⇧-click `Ben` (a range again) and press Escape: the table is selected |
| N12-S3 | Fixture L. Click the table, `Ship CSV import`, then row 2's grabber: row 2 selected. Hover row 4 and ⇧-click its grabber: rows 2–4 selected with one outline round the run; status `3 rows selected`; the bar reads `Rows`, `3 rows`, `Row options`, `Merge cells`, `Delete rows`, `Copy link to table`. ⌘-click row 3's grabber: rows 2 and 4, one outline each, `2 rows`, status `2 rows selected`, and `Merge cells` disabled with the title `Choose rows next to each other`; ⌘-click row 2's grabber: row 4 alone (bar `Row`). Click column 1's grabber (hovered), ⇧-click column 3's: `Columns`, `3 columns`, status `3 columns selected`. ⇧-click `Mia`: `Mia` alone is selected (bar `Cell`). Select rows 2–3 (grabber, ⇧-click) and press Delete: both rows are gone (one Undo step), the remaining texts keep their ids; one ⌘Z brings both back with their ids and texts. Select rows 1–4 (row 1's grabber, ⇧-click row 4's): `Delete rows` is disabled with the title `A table needs at least one row` and Delete changes nothing. With rows 2–3 chosen, ⇧+ArrowDown and Return change nothing. Escape: the table is selected |
| N12-S4 | Fixture L. Click the table, `Ship CSV import`, ⇧-click `Ben`, click `Merge cells`: one cell over rows 2–3 × columns 1–2, no grid line inside its box, `Ship CSV import` at its top-left (padding 20) laid across the span's width; `Ana`, `Write release notes` and `Ben` are gone; the merged cell is selected with one 2 px outline round the box; the bar reads `Cell`, `Edit text`, `15 / 1,000`, `Row options`, `Column options`, `Split cell` (`aria-pressed="true"`, filled `#7051cf`, radius 8, hovered tooltip `Split cell ⌥M`), `Delete content`, `Copy link to table`; status `Cells merged`; the saved table's `merges` is exactly `[{"row":<row 2 id>,"column":<column 1 id>,"rows":2,"columns":2}]` and `cells` holds no entry for the three covered cells. ⌘Z: all four texts back and `merges` `[]`; ⇧⌘Z: merged again (the table is then selected, AT17). Click the merged cell, then press ⌥M: split: the four cells back, `Ship CSV import` in row 2, column 1 and the other three empty, the range of the four selected (anchor `Ship CSV import`, focus row 3, column 2; `4 cells`), status `Cell split`; ⌘Z: merged again. Click the table's empty canvas, click the table, then the area of row 3, column 2: the merged cell is selected. Click `Task`, ⇧-click `In review`: the range grows to cover the merge (rows 1–3 × columns 1–3), `6 cells`; ⌥M: one merge over it with `Task`; ⌘Z twice. Then a fresh Fixture L: click `Mia`, press Delete; click `Ben`, ⇧-click the empty cell below it, press ⌥M: `Ben` over rows 3–4 of column 2, nothing lost; capture merged (the merged cell selected, the bar showing `Split cell` pressed). Then a fresh Fixture L (no merge): click the table, `Plan the demo`, row 4's grabber and `Merge cells`: row 4 becomes one cell `Plan the demo` across four columns; `To do` and `Dec 6` gone. Click row 4's grabber again: `Merge cells` is disabled with the title `Already a single cell` and ⌥M changes nothing; ⌘Z. From `Dec 4`'s Cell bar choose Column options › `Merge cells`: column 4 becomes one cell `Due`; ⌘Z. With `Ana` and `Doing` chosen by ⌘-click, ⌥M changes nothing |
| N12-S5 | Fixture L with the merge of `Ship CSV import`–`Ben` (N12-S4's steps). Click `Task`; ArrowDown: the merged cell; ArrowDown: `Plan the demo`; ArrowUp: the merged cell; ArrowRight: `In review`; click `Doing`, ArrowLeft: the merged cell. From `Due`, Tab visits the merged cell, `In review`, `Dec 2`, `Doing`, `Dec 4`, `Plan the demo` in that order; Shift+Tab reverses it. Select the merged cell and press Return: the editor's accessible name starts `Row 2, column 1 of`; press End, then Return five times and type `x` (six lines need 184 px, more than the span's 152): row 3 (the span's last row) is drawn taller and row 2 keeps its drawn height; Escape twice, then ⌘Z (the text session undone: the merged cell holds `Ship CSV import` again and row 3 its fixture height). Hover the middle of row 2, then click the row dot between rows 2 and 3 (strictly inside the span): the merge covers rows 2–4 × columns 1–2; ⌘Z. Hover the middle of row 1 again, then click the dot between rows 1 and 2: a new row 2; the merge (now rows 3–4) is unchanged in size; ⌘Z. Hover the middle of column 1, then click the column dot between columns 1 and 2: the merge covers three columns; ⌘Z. Select row 3 (hovered grabber) and press Delete: the merge covers row 2 × columns 1–2 with its text; ⌘Z. Select column 2 and press Delete, then row 3 and Delete: the merge is gone and `Ship CSV import` is an ordinary cell; ⌘Z twice. Select row 2 and press Delete: the merge is anchored at the former row 3's column 1, covers one row × two columns, and `Ship CSV import` is gone; ⌘Z: the fixture's merge and texts are back |
| N12-S6 | Fixture L. Click the table, `Ship CSV import`, row 2's grabber, then `Row options`: the menu reads `Move row up`, `Move row down`, separator, `Add row above ⌥⇧↩`, `Add row below ⌥↩`, `Duplicate row ⌘D`, `Merge cells ⌥M`, separator, `Delete row ⌫`; the bar reads `Row`, `Row options`, `Merge cells`, `Delete row`, `Copy link to table`; capture row-menu. Escape; select row 3 and choose Row options › `Move row up`: the rows read `Task`, `Write release notes`, `Ship CSV import`, `Plan the demo`, every text keeping its ids, the moved row selected, status `Row moved to row 2`; one ⌘Z restores the order; ⇧⌘Z. Row 1: `Move row up` disabled with the title `Already the first row`; row 4: `Move row down` disabled with `Already the last row`. Column 1's Column options read `Move column left` (disabled, `Already the first column`), `Move column right`, separator, `Add column to the left ⌥[`, `Add column to the right ⌥]`, `Duplicate column ⌘D`, `Merge cells ⌥M`, separator, `Delete column ⌫`; `Move column right`: `Owner` is column 1, status `Column moved to column 2`; column 4's `Move column right` is disabled with `Already the last column`. Rows 2–3 (⇧): the menu reads heading `Rows`, `Move rows up`, `Move rows down`, separator, `Add row above ⌥⇧↩`, `Add row below ⌥↩`, `Duplicate rows ⌘D`, `Merge cells ⌥M`, separator, `Delete rows ⌫`; `Move rows down`: rows 3–4, status `Rows moved to rows 3–4`; ⌘Z. Rows 2 and 4 (⌘): `Move rows up`, `Move rows down`, `Duplicate rows` and `Merge cells` disabled with `Choose rows next to each other`. Columns 2–3 (⇧): heading `Columns`, `Move columns left`, `Move columns right`, …, `Duplicate columns ⌘D`, `Merge cells ⌥M`, …, `Delete columns ⌫`; `Move columns right` gives `Columns moved to columns 3–4`. Fresh Fixture L: click the table, `Dec 4` and choose its bar's Row options › `Move row up`: row 3 moves to row 2 (`Row moved to row 2`) and the `Dec 4` cell stays selected (bar `Cell`). Fresh Fixture L with `Ship CSV import` and `Write release notes` merged as below: row 4's `Move row up` is disabled with `A merged cell is in the way` (the gap one place up lies inside the merge's span). Fresh Fixture L; merge `Ship CSV import` and `Write release notes` (range, `Merge cells`); select row 3: `Move row up`, `Move row down` and `Duplicate row` disabled with `A merged cell is in the way` (`Move row down` too, since the run partly overlaps the span); select rows 2–3: `Move rows down` moves both with the merge (it still covers the same two row ids) |
| N12-S7 | Fixture L. Click the table, `Plan the demo`, then row 4's grabber (the 16 × 16 square). Press on the grabber, move 3 up and release: nothing moves, row 4 stays selected. Press again and move up over the border between rows 1 and 2: after 4 px the drag starts: a ghost of row 4 at the table's drawn width (white 92 %, 1 px `#d9dfe7` border and cell lines, no corner radius, the stated shadow), at row 4's own box moved along the axis by the pointer's movement and then 10 right and 10 down, a 16 × 16 `#518de0` square on the grabbers' line at the pointer's y, hovered grabbers, dots and add bars hidden, row 4's place filled `rgba(245,247,250,.85)`, the context bar hidden, the cursor `grabbing`, and a 2 px `#518de0` drop line on the border between rows 1 and 2 reaching 4 past each end of the table; capture drag-move. Release: the rows read `Task`, `Plan the demo`, `Ship CSV import`, `Write release notes`; the moved row selected; status `Row moved to row 2`; one ⌘Z restores the order. Drag it again and press Escape before release: ghost and line gone, nothing changes or is announced, the selection is what it was when the drag started, the Undo button unchanged; drag and release over its own place: nothing changes; drag and dispatch `pointercancel`: nothing changes. Click `Ana`, press row 3's hovered grabber and drag below row 4: row 3 alone is selected and moved to row 4, status `Row moved to row 4`. Select column 4 (`Due`) and drag its grabber left past the table's left edge: the drop line on the left edge, release: `Due` is column 1, status `Column moved to column 1`. Select rows 2–3 and drag row 3's grabber below row 4: both move, status `Rows moved to rows 3–4`. Fresh Fixture L with `Ship CSV import` and `Write release notes` merged: drag row 4's grabber up across the border between rows 2 and 3: the drop line never shows on that border (the tool samples every 4 px); release with the pointer on it: row 4 lands in the drop line's last gap. Press row 3's grabber (row 3 partly overlaps the merge) and move 80 down: no drag starts (no ghost, square, faded place or drop line); release: nothing changes and nothing is announced |
| N12-S8 | Fixture L. Click the table, `Ship CSV import`, row 2's grabber; press ⌘D: a new row 3 holds `Ship CSV import`, `Ana`, `In review`, `Dec 2` with row 2's height and a new id, and is selected; status `Row duplicated`; capture duplicated. ⌘Z removes it; ⇧⌘Z brings it back with the same id; ⌘Z. Select rows 2–3 and press ⌘D: copies as rows 4–5, both selected (`2 rows`), status `Rows duplicated`. Select column 2 and choose Column options › `Duplicate column`: a new column 3 with `Owner`, `Ana`, `Ben`, `Ana`, `Ben`, `Mia` (the six rows now) and column 2's width, status `Column duplicated`. Fresh Fixture L: merge `Ship CSV import`–`Ben`, select rows 2–3 and press ⌘D: rows 4–5 hold a second merge over rows 4–5 × columns 1–2 with `Ship CSV import` and new ids (`merges` has two entries). Select row 3 alone: ⌘D changes nothing and `Duplicate row` is disabled with `A merged cell is in the way`. Rows 1 and 4 (⌘): ⌘D changes nothing, `Duplicate rows` disabled with `Choose rows next to each other`. A range of cells: ⌘D changes nothing (no row, column or table added). The whole table selected: ⌘D is today's Duplicate (a second table, its merge with new ids) |
| N12-S9 | Fixture L. Click the table, `Task`, row 1's grabber; press ⌥↩ 46 times (50 rows). Hover row 2: its dots are disabled (the 8 × 8 dot at 45 % opacity, cursor `not-allowed`, no plus or line) with the tooltip and title `A table holds at most 50 rows`, and a click on one adds nothing. Click row 2's grabber (row 2 selected): ⌘D changes nothing and `Duplicate row` is disabled with that title. Pan until row 50 is in view, select it with its grabber and press Delete (49 rows); select rows 2–3: ⌘D changes nothing, `Duplicate rows` disabled with that title. Pan back until rows 1–4 are in view (if the Pan tool was used, choose the Select tool again); select column 4 with its grabber and press ⌥] 16 times (20 columns): hovering column 2 shows its dots disabled with `A table holds at most 20 columns`; select a visible column with its grabber: ⌘D changes nothing |
| N12-S10 | Fixture L. Merge `Ship CSV import`–`Ben` (⌥M). Click Save and wait for `Locally saved`; reload: the merged cell is drawn the same; the stored payload's `schemaVersion` is 18 and the table's keys are in the saved order with `merges` exactly as N12-S4 states. Board › Save a copy to file; Board › Open board file… with that file: the same table, row and column ids, texts and merge. Select the table (its outline), ⌘C, click empty canvas, ⌘V: a copy whose table, row and column ids all differ from the original's and whose one merge covers the copy's rows 2–3 × columns 1–2 with `Ship CSV import`. Select the original table and click Export as CSV: one download `Launch plan table.csv` whose bytes are exactly EF BB BF + `Task,Owner,Status,Due␍␊Ship CSV import,,In review,Dec 2␍␊,,Doing,Dec 4␍␊Plan the demo,Mia,To do,Dec 6␍␊`. Import that file with Import CSV…: a new 4 × 4 table with those texts and `merges` `[]` |
| N12-S11 | Fixture T. From the confirmed base, Ben selects row 4 and chooses Row options › `Move row up` while Ana selects `Task` and clicks the column dot between columns 1 and 2, the second action issued before the first one's result shows on the second screen (the tool checks both contexts' DOM and repeats the pair on a fresh base, at most 3 times, when it was not); arrival order is not asserted: within 3 s Ana, Ben and Mia see the same table, `Plan the demo` in row 3 and a new empty column 2, every text with its ids, and no notice. Ben then selects the row holding `Ship CSV import` with its grabber and Ana the row holding `Write release notes` with its grabber (each on their own screen, identified by the row ids the tool recorded), and each presses ⌘D, issued the same way: within 3 s all three see both copies (new ids, each right after its original), in the same order. Ben drags row 1's grabber below the last row: within 3 s Ana and Mia see the move. Ana merges `Doing` and `Dec 4` of the original row (identified by its recorded id, not the copy; range, ⌥M): within 3 s Ben and Mia see one merged cell with `Doing` in that row. Ana clicks empty canvas (the scene focused) and presses ⌘Z: within 3 s `Dec 4` is back for all three |
| N12-S12 | Fixture T. Ben double-clicks `Mia`, presses End (caret after `Mia`) and types `x`; the tool waits until Ana and Mia see `Miax`. Ana clicks the table, `Ben`, ⇧-clicks `Miax` and clicks `Merge cells`: within 3 s Ben's editor closes, his selection is the merged cell (bar `Cell` with `Split cell` pressed), and his board notice (`role="status"`) reads `ana merged cells you were editing.`; capture notice-editor (Ben). All three see one merged cell with `Ben`; `Miax` is gone everywhere. Ana presses ⌘Z (scene focused): within 3 s the merge is gone for all three, `Miax` (the text at merge time) is back, and Ana's selection is the table. Ben double-clicks `Miax`, presses End and starts an input-method composition `ü` (CDP `Input.imeSetComposition`) without committing it; Ana merges `Ben`–`Miax` again: Ben's editor closes with the composition discarded (no `ü` anywhere, for anyone) and the same notice shows. Ana presses ⌘Z. Then Ana double-clicks `Dec 4`, presses End and types `y`, and the tool waits until Ben sees `Dec 4y`; Ben clicks `Doing`, ⇧-clicks `Dec 4y` and clicks `Merge cells`: Ana's editor closes, her selection is the merged cell, and she sees `ben merged cells you were editing.`; capture notice-owner (Ana). The tool records each notice element's text and when it was set. Ana double-clicks `Dec 6`, presses End and types `z`; meanwhile Ben moves row 2 down (Row options), inserts a column from a dot and presses ⌘D on row 3: Ana's editor stays open throughout, `Dec 6z` reaches everyone, and no **new** notice is shown to Ana. Ana presses Escape twice, double-clicks `To do`, presses End and types `w`; the tool waits until Ben sees `To dow`; Ben clicks `To dow`, ⇧-clicks its current right-hand neighbour and clicks `Merge cells` (Ana's cell is the anchor): Ana keeps editing the merged cell, `To dow` kept, and no new notice shows (AT16) |
| N12-S13 | Fixture T. Ana merges `Ship CSV import`–`Ben` (range, `Merge cells`); within 3 s Mia sees the merged cell drawn as Ana sees it. Mia clicks the table and `Doing`: the single cell, bar `Cell` and its count. Mia hovers rows 2–4 and columns 1–4: no hovered pill, no dot and no `Insert row …` or `Insert column …` button in the DOM. Mia ⇧-clicks `Dec 6`: `Dec 6` alone is selected; ⌘-clicks `Task`: `Task` alone; ⇧+ArrowRight forms no range. Mia clicks the merged cell: it is selected, her bar has no `Split cell` and no `Row options`; ⌥M, ⌘D and Delete change nothing for anyone; her board equals Ana's throughout. Capture viewer (Mia) |
| N12-S14 | Both guide rows (Part 1 on the local app, Part 2 by Ana and Ben on a fresh Fixture T board with a 3 × 3 table typed A1…C3) walked as written: each `You should see` holds |

**Baseline (8fd36fb).** Each row fails at its first new assertion or at the first step that needs a new control,
which is then the row's named expected failure: N12-S1 at the hovered pill of row 3 (absent); N12-S2 at the range after
⇧-click (no `Cells` bar); N12-S3 at row 4's hovered grabber (absent); N12-S4, N12-S5 and N12-S12 at
`Merge cells` (absent); N12-S10 at the merged cell after ⌥M (none appears); N12-S6 at the Row options list (no `Move row up`); N12-S7 at the drag (nothing moves);
N12-S8 at ⌘D on row 2 (no new row); N12-S9 at the row dots (absent); N12-S11 at `Move row up`; N12-S13 at Ana's
merge (absent); N12-S14 at the guide's Merge cells. The check run records each row's baseline outcome and the step it
failed at.

## Acceptance criteria

- **0011-W3-AC01:** ⇧-click and ⌘-click (and ⇧+arrows) choose a range or a set of cells, rows or columns; Merge cells
  joins a rectangle into one cell keeping the top-left text, Split cell gives the cells back; Delete content clears
  every chosen cell.
- **0011-W3-AC02:** Rows and columns can be inserted between others from the insert points, moved with the menus or by
  dragging a grabber, and duplicated with ⌘D or the menu, without moving any other cell's text.
- **0011-W3-AC03:** Each change is one Undo step; the table saves, exports and reopens with its merges, and merges
  survive copy, paste, board files and templates.
- **0011-W3-AC04:** On a team board, two editors arranging one table keep each other's changes as sync v20 states; a
  merge over a cell being edited closes that editor with the notice. Look matches the approved design.

| Criterion | Evidence that shows it |
| --- | --- |
| 0011-W3-AC01 | N12-S2–N12-S5, N12-S13, N12-S14; X12-W01; V4 |
| 0011-W3-AC02 | N12-S1, N12-S6–N12-S9, N12-S14; X12-W01; X12-W00; V4 |
| 0011-W3-AC03 | N12-S1, N12-S2, N12-S4, N12-S10; X12-W01; S480; S481; V4 |
| 0011-W3-AC04 | N12-S11–N12-S14; X12-W01; S480; S481; V9; V11 |

## Applicable DESIGN.md guardrails

Canvas-first shell, native controls and visible focus, minimum action hits, protected native editing and independent
state owners apply. The dots, hovered grabbers and new bar and menu items are real buttons with names, reachable by
keys where today's grabbers and items are; the drag has a keyboard route through the Move items. Interaction v54
states every new word and value; never infer generic styling. No new sound, font or image file.

## Validation commands and expected evidence

Use pinned Node 26.13.0 and npm 11.20.0 from the repository root. Source validation is not independent acceptance.
Each check run restates **every V row it reruns** as its own `PASS: Vn ...` / `FAIL: Vn ...` line with SHA, logs and
counts.

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
npm run test:server:node
npm run test:server:workerd
WRANGLER_SEND_METRICS=false npx wrangler deploy --dry-run --outdir <scratch> -c apps/server/wrangler.json
git diff --name-status <prerequisite-base>..<validated-source>
git diff --check <prerequisite-base>..<validated-source>
```

The room's codec, writer, conflict handling and history change, so the counted server suites (S480 and S481 included)
are taken from the Checks workflow run on the exact candidate commit (V9), and a short server-only run checks on both
runners only what that workflow does not count. The check run starts the team stack on its own uniquely owned local
Supabase project. Record each long run's start and end and the host's sleep and wake events; a run that overlapped a
sleep is INVALID and is rerun awake. Three manual checks from this milestone are chosen only at Review.

| Check | Command/inspection and pass condition |
| --- | --- |
| V1 | Byte-compare manifests, locks, dependency inventory and runtime notices against the prerequisite base: unchanged, no new dependency |
| V2 | `npm ci --ignore-scripts --no-audit --no-fund` exits 0 on the clean candidate and on the independent baseline |
| V3 | `npm run typecheck` exits 0 across all five workspace members |
| V4 | `npm test` full suite exits 0, `T-U16` onward and X12-W included. Guards as web modules v52 |
| V5 | Team-off `npm run build` and `audit:licenses` exit 0; notices equal runtime notices v1 (team off) |
| V6 | `npm run build:fixtures`, team-on `npm run build` and `audit:licenses` exit 0; team-on notices equal runtime notices v3 |
| V7 | `npm run build:server`, `audit:licenses` and the wrangler dry run exit 0; no deploy |
| V8 | Inspect all hunks plus `git diff --name-status` and `git diff --check` over `<prerequisite-base>..<validated-source>`: only the deliverables, the dispositions and the append-only Implementation record; no file under `supabase/`; App.tsx differing only by web modules v52's wiring points and still 264 lines; `style.css` only by the seventeen rules right after the table block; no new file in `packages/board-rules/src` |
| V9 | The Checks workflow's server suites (Node and workerd) pass on the exact candidate commit, S480 and S481 included; the server-only run passes on both runners |
| V10 | N12-S1–N12-S14 pass with the state captures and raw receipts, and the baseline outcomes are recorded |
| V11 | Design, one receipt per approved screen: 1-insert-point ↔ insert-point; 2-range ↔ range; 3-set ↔ set; 4-merged ↔ merged; 5-row-menu ↔ row-menu; 6-drag-move ↔ drag-move; 7-duplicated ↔ duplicated; 8-notice-editor ↔ notice-editor (Ben); 9-notice-owner ↔ notice-owner (Ana). Where a capture and its screen differ, interaction v54 wins; the known differences are not findings: 2-range and 3-set show the bar off-centre (AT5 centres it on the selection), 7-duplicated shows the Row bar without `Merge cells` (AT5 adds it), 8-notice-editor and 9-notice-owner show nothing selected (AT16 selects the merged cell), no team chrome and their own notice look (the app's `.notice` is kept), 5-row-menu highlights `Add row above` (the menu focuses `Move row up`), 6-drag-move shows the bottom add bar (hidden during a drag), and 1-insert-point's tooltip line height differs from the app's `.tooltip`. Texts and positions may differ by the fixture |
| V12 | Once, on an independent 8fd36fb source and build, copy in exactly these candidate test files and **no** candidate runtime source: `tests/table-arrange.test.mjs`, `tests/tables.test.mjs`, `tests/document.test.mjs`, `tests/storage.test.mjs`, `tests/table-csv.test.mjs`, `tests/team-templates.test.mjs` and `tests/server/tables.test.ts`. Run only the new checks, selected by these names: in `tests/tables.test.mjs` the checks titled `T-U16` onward; in `tests/table-arrange.test.mjs` those titled `X12-`; in `tests/document.test.mjs`, `tests/storage.test.mjs`, `tests/table-csv.test.mjs` and `tests/team-templates.test.mjs` those whose titles begin `0011-W3 ` (every new check there is so titled); in `tests/server/tables.test.ts` S480 and S481. Every check that proves new behaviour fails by name; a top-level setup or import abort does not count. X12-W00 passes on both |
| V13 | Accepted A–J compare: baseline twice, then candidate and diffs, with existing normalization and only the `schemaVersion` normalization stated under Deliverables; no mask |
| V14 | Accepted regression runs: V4, V9, V13 and the 0011-W1 scenario N3 and 0011-W2 scenario N5 on the candidate, read with the dispositions above. Any row that also fails on 8fd36fb is a baseline finding |

Server checks (both runners, in `tests/server/tables.test.ts`, an existing file of both Vitest configs; sync v20's room-level **Verification** items):
- **S480** merges in a room: a client's update adding a valid `mergeMap` entry and emptying the covered cells' texts in
  the same transaction is accepted, stored and sent to the other clients; a split (the entry deleted) is accepted; an
  update whose result holds two overlapping merges, a single-cell merge, a span past the table's end, an anchor row or
  column that is not live, or text in a covered cell is `invalid_document` with nothing stored; a malformed `mergeMap`
  (a missing one at 18, one at 17, a key that is not a cell key, a value with a missing, extra or non-integer key) is
  `invalid_update`; a version 17 client update is `invalid_document`; creating a board with merges and importing a
  board at 18 with merges keep them, and a board created or imported at 17 is upgraded with `merges: []`; saving a
  team template holding a table with a 2 × 2 merge through the templates POST **without** `upload` (a table names no
  media) is accepted and one with overlapping merges refused (400 `bad_request`, team templates v6); a saved template
  whose table lacks `merges` (an older entry) is answered by the server in its stored shape (no `merges` key) and the
  rest of the catalogue still lists (the client's `merges: []` is a T-U16 check).
- **S481** arranging in a room: two clients (each through a real `BoardSession`) moving different rows at once keep
  both; a move and an insert at once keep both; an empty row inserted inside a span concurrently with the merge is
  accepted, and a row with text moved into a span concurrently is refused for the later arrival; both clients converge
  to the same valid document after each accepted case; a stored storage 9 room at schema 17 holding a table is upgraded
  to 18 by the schema step (an empty `mergeMap` on each table, no edits row); a version 17 capture with its upgrade
  causes no new capture and a first merge causes one; a version 17 history version is previewed at 17 and restored as
  18. Fixtures: boards built in their declared shapes (never by deleting keys from a current board).

**Unit checks** (web modules v52 **Tests**; each named, importing changed or new modules inside the check):

| Check | Scope and what it proves |
| --- | --- |
| T-U16 | T-U16 onward in `tests/tables.test.mjs` (rules and sync, web modules v52 **Tests**), with document v24's items also in `tests/document.test.mjs`, storage v7's in `tests/storage.test.mjs`, a merged table's CSV export in `tests/table-csv.test.mjs` and team templates v6's client items in `tests/team-templates.test.mjs` (the new checks in those four files titled `0011-W3 …`); counted through V4: every item of document v24's **Verification** "Document v24 adds" list (validity, key and merge order, the 17 → 18 upgrade, `rangeBounds`, `mergeRange`, `canMerge`, `splitMerge`, `insertAxis` inside and at the edge of a span with its `size` argument, `deleteAxis` of a covered, anchor and last row or column, `canMove`, `moveAxis`, `canDuplicate`, `duplicateAxis`, `setCell`, `remapTable`, `nextCell`, `neighbourCell`, the drawn-height rule); sync v20's **Verification** items for the codec, the writer (including the move receipt above, sync v20's fallback and cleanup, a merge's entry, replaced entries and covered texts in one update, and an unchanged merge writing nothing), the room, two clients, the notice and hosted Undo (a merge's Undo restoring every emptied text in one step, Redo emptying them again, a split's Undo refused after someone typed in a covered cell, `undo_invalid`); readback of merges through local storage (`storage.ts`), a board file (`board-file.ts`) and a team template save and add (`team/templates-rules.ts`); the byte caps at both limits: a legacy board and a legacy template whose **stored** form is exactly at its cap read and upgrade (the added `merges: []` is not counted on read or upgrade, and a room's load-time snapshot is written uncounted, sync v20), and the next save, Add or template write of the upgraded form is refused with today's cap words; in `tests/team-templates.test.mjs`, a mixed catalogue whose legacy table reads with `merges: []` after `parseTemplates`; a history preview and capture keeping merges (`packages/board-room/src/history.ts`); the rules load without the DOM. |
| X12-W01 | X12-W01 onward in the new `tests/table-arrange.test.mjs` (web; each check imports the module it tests inside the check), with a merged table's CSV export in `tests/table-csv.test.mjs`: every item of web modules v52's **Tests** list for that file, among them `table-selection.ts`'s and `table-arrange.ts`'s exports, the `table.ts` changes, `useTableArrange` through the esbuild harness, `TableButtons` with and without `arrange`, `TableControls` and `AxisMenu` per kind, and the source checks that the seventeen CSS rules follow the table block and that `style.css` still ends with the link rules: the selection kinds and their normalisation when ids disappear; choosing (⇧, ⌘, Ctrl off Mac, another kind starting again, viewers); ⇧+arrows at the edges and growing over merges; keys (⌥M, ⌘D, Delete, Return, Tab, arrows, Escape, composition); hovered pills and dot placement (inner borders only, 14 outside, 24 hit area, names, disabled reasons); the insert size and the unchanged selection; each refusal's words, tested through `arrangeRefusal`; the menus' items, order, plural names, titles and key texts on both platforms (`⌘D` on Mac, `Ctrl+D` elsewhere); `Already a single cell`; each bar's contents and count; the drag (the 4 px threshold, a run or a single row, allowed gaps only, Escape, a lost pointer, its own place); outlines; the merged cell's layout; `validTableSelection`'s `<label> merged cells you were editing.` and `Someone merged cells you were editing.`, and no notice for a remote move, insert, duplicate or split; the announcements; CSV export of a merged table; App wiring. |
| X12-W00 | Compatibility (V12), in `tests/table-arrange.test.mjs`: on tables without merges (given `merges: []`), `insertAxis`, `deleteAxis`, `nextCell`, `neighbourCell`, `remapTable`, `layoutTable` (its baseline fields `box`, `rows` and `minimums` compared exactly; the new `unmerged` field is asserted in an X12-W01 check, not here), `tableButtons` for a selected cell with no hovered row or column, and CSV export give 8fd36fb's exact results, using only modules that exist at 8fd36fb. Passes on both revisions. |

A regression failure that also fails on 8fd36fb is a baseline finding to report, never fixed here.

## Review focus and public references

Review that:
- **fixed after the last pre-commit read, so look hardest here:** hosted Undo of a merge (every touched merge removed,
  texts restored, reinstalled, validated once; the whole inverse refused when a text cannot be restored); the session
  hold and its release on a valid `saved`; legacy byte caps on read versus later writes; the S480 template response
  shape; `insertAxis` size bounds (63 and 1,001 refused); `commit` returning the bounded result and recording history
  only after admission; drag reuse only for a run, captured ids, live-change cancel; the grabber drag in the shared
  gesture gate (canvas commands, wheel, pinch, the click after a drag, Escape); multi-delete checked against the live
  count; one refusal order for menus, ⌘D and ⌥-add; F1-U14's fixture; the two upgrade-delta assertions; the unchanged
  effect guards and CSS checks; X12-W00's baseline fields; V12's copied files and names; corner and Objects-panel resize
  from saved heights and the clipped highlight; the move receipt's scope; the bar buttons' active look and the held
  insert point; Fixture T's route; N12-S1's Return; N12-S5's growth and fresh hovers; N12-S9's pan and column; N12-S12's
  wait for `To dow`; Tab, Shift+Tab and arrows ending a range or set at the table's edge;
- no path stores a table that breaks document v24's merge rules: every rule function refuses rather than repairs, the
  room refuses such a result after concurrent moves, and the room never repairs, shrinks or drops a merge;
- a move or duplicate is never offered or performed through a merge it would cut (menus, keys, drag, team boards);
- merging removes covered texts in the same Undo step and update as the merge, and Undo restores every one;
- a press on a grabber without 4 px of movement stays a click, and a drag adds one Undo step only on release;
- hovered grabbers and dots never show while editing, read-only, dragging, or for viewers, and viewers can change
  nothing by any new path;
- ⌘D duplicates rows or columns only with rows or columns chosen, does nothing with cells chosen, and stays today's
  Duplicate for the whole table;
- the remote-merge notice shows only when the edited cell becomes covered, with the sender's presence label;
- App.tsx and `style.css` change only as stated (the nine substitutions; the seventeen rules after the table block).

The public source basis is main 8fd36fb and the linked versioned contracts, read 2026-11-27. Outside facts relied on:
the W3C Pointer Events (pointer capture, `pointercancel`, `lostpointercapture`) and UI Events (`KeyboardEvent.isComposing`)
specifications. No unresolved product decision is delegated to implementation.

## Exclusions and reasons

- Cell formatting (fill, size, text colour, bold, strikethrough, link, alignment), pasting onto selected cells,
  copying only the selected cells and exporting part of a table: later table work builds on this multi-cell selection.
- Typefaces and bulleted lists: board-wide work, not tables only.
- A canvas right-click menu: the Move, Duplicate and Merge items live in the Row and Column menus and the bar.
- Shortcuts for moving rows and columns: the menus and the drag are the routes.
- ⌘D on cells, ranges or drags across tables, and keeping covered cells' text on merge.
- Repairs to separately tracked baseline failures.

## Implementation record

Append-only. The implementer adds dated sections here.

A1: web modules v52's disabled insert dot opacity corrected from .4 to .45 to match interaction v54 AT9 (planner amendment)

A2: web modules v52's held-session recovery and the brief's T-U16 split-Undo code aligned with sync v20 (planner amendment)

A3: legacy byte cap on writes, snapshots.ts upgrade path, drop line inside merges, held-session wording, canDuplicate order, test file list, move receipt wording (planner amendment)
