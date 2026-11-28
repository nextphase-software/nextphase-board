# 0001 — Interaction

Contract version: 54 (for 0011-W3 brief v1, 2026-11-27). Status: Draft. When accepted it replaces
[interaction v53](0001-interaction-v53.md) for later work. Uses [document v24](0001-document-v24.md),
[board file v8](0006-board-file-v8.md), [sync v20](0003-sync-v20.md), [API v18](0003-api-v18.md),
[team templates v6](0008-team-templates-v6.md), [storage v7](0001-storage-v7.md), and, unchanged,
[access v17](0003-access-v17.md), [link preview v1](0012-link-preview-v1.md), [toolchain v6](0001-toolchain-v6.md),
[hosted storage v15](0003-hosted-storage-v15.md) and [board lifecycle v8](0006-board-lifecycle-v8.md); its modules
are [web modules v52](0001-web-modules-v52.md).

Every rule in v53 (and, through it, v52 back to v4 and the 0001-W3 presentation) still applies except where this
version replaces or adds to it. v53's own text follows as the part **Links in text (v53)**, word for word except that
its first sentence says "Version 53" and its first heading carries "(v53)"; its headings keep their levels, and its
copy of v52's text, the part **Link cards (v52)**, follows it unchanged. v53's change note is not repeated. Where a
part links an older contract, read the versions above. The page links of [interaction v46](0001-interaction-v46.md)
(page addresses, Copy link to page, opening a board on a page, a link to the board that is open, the address following
the open page, notice placement) still apply, with the `object` value that **Links in text (v53)** adds.

Tables were added in [interaction v45](0001-interaction-v45.md) (the Table tool, the table, selecting, context bars,
adding, deleting and resizing, keys and editing, undo, other features, tables on hosted boards); CSV copy and export
in [interaction v47](0001-interaction-v47.md); the export dialog's table rules in
[interaction v48](0001-interaction-v48.md). Every one of those rules still applies except where the part **Arranging
table cells** below replaces or extends it, and each such place names the rule it changes.

This version adds **arranging table cells** (the part **Arranging table cells**, values AT1–AT21), for owners and
editors on single-user and team boards: choosing several cells, rows or columns at once with ⇧-click, ⌘-click (Ctrl
elsewhere) and ⇧+arrow keys; **Cells**, **Rows** and **Columns** context bars; inserting a row or column between two
others from **insert points** on the borders of a hovered row or column; moving rows and columns with new menu items
or by **dragging a grabber**; duplicating rows and columns with ⌘D or the menus; **merging** a rectangle of cells into
one cell and **splitting** it again; drawing, selecting, editing and navigating a merged cell as one cell; and a notice
when someone else merges away the cell you are editing. The saved form (`merges` on a table, schema 18) and the
merge rules are [document v24](0001-document-v24.md)'s; the shared document's `mergeMap` and the room's check are
[sync v20](0003-sync-v20.md)'s. The look was approved in mock-up v1 (approved design, 2026-11-27); every value is
restated below so it is checked, not inferred.

## Change note (v53 → v54)

- New part **Arranging table cells** (AT1–AT21): the four new selection kinds (range, cell set, rows, columns) and how
  ⇧-click, ⌘-click, grabber clicks and ⇧+arrows build them; their outlines and grabbers; the Cells, Rows and Columns
  bars, Merge cells on the Row and Column bars and Split cell on a merged cell's bar, with the bar's position; the Row
  and Column menus' new items, order, shortcuts and disabled reasons; keys; hovered grabbers; insert points with their
  geometry, names, tooltip and behaviour; moving by menu and by drag with the drag's states, threshold, drop gaps,
  cancel and merge restrictions; duplicating; merging and splitting; drawing a merged cell and the row growth it
  causes; merged cells in selecting, editing and navigating; viewers, others' changes and the remote-merge notice;
  Undo steps; announcements; limits; copy and export of merged tables; and what is not in this version.
- Interaction v45's **Selecting** ("Four selection levels, one at a time"), **Looks**, **Context bars**, Row and
  Column menus, **Keys and editing**, **Undo** and **Tables on hosted boards** are extended as AT1–AT18 say; v47's
  **Export as CSV** "Who and when" and v48's **Whole tables** read the new selection kinds as AT20 says.
- ⌘D with a single cell selected no longer duplicates the table (AT7).
- Nothing in **Links in text (v53)** or **Link cards (v52)** changes.

## Arranging table cells

### Terms

- **Row** and **column**: an entry of the table's `rows` or `columns`, with a stable `id` (document v24). Its
  **index** is its position in the table's current order; every number shown to people (`Row 3`, `rows 2 and 3`) is
  the index counted from 1. A **run** is a set of rows (or columns) whose indices are consecutive; one row is a run.
- **Merge**: an entry of the table's `merges` (document v24): its **anchor** (the top-left cell, named by `row` and
  `column` ids) and how many rows and columns it covers (`rows`, `columns`, counted in the current order from the
  anchor). Its **span** on an axis is the indices it covers on that axis. A **covered cell** is a cell inside a merge
  other than its anchor; it holds no text.
- **Cell**, from here on: an unmerged cell, or a **merged cell** (a merge's anchor together with its covered cells,
  drawn, hit, selected, edited, counted and announced as one cell). A merged cell is named by its anchor's address.
  A click, a ⇧-click or a ⌘-click on a covered cell is taken as one on its merged cell.
- **Reading order** of cells: by the anchor's row index, then the anchor's column index.
- **Grown**: a rectangle of cells grown until it contains every merge it touches, repeated until no merge is cut
  (document v24's rule; a merge touches a rectangle when they share at least one cell).
- **Strictly inside a span**: a border between two rows (columns) lies strictly inside a merge's span when both the
  row (column) before it and the one after it are in that span. A run **partly overlaps** a merge's span when some but
  not all of the span's rows (columns) are in the run.
- **Gap**: a place a row (column) can move to: before the first row, between two rows, or after the last row
  (likewise for columns). A gap is **allowed** unless it lies strictly inside a merge's span.
- **Editors**, **viewers**, **the board notice** and **Platform** ("Mac") are as defined in **Links in text (v53)**,
  Terms. **⌘** means Cmd (`metaKey`) on Mac and Ctrl (`ctrlKey`) elsewhere; a **⌘-click** is a primary click with ⌘
  held and Shift and Alt not held; a **⇧-click** is a primary click with Shift held and Alt, Cmd and Ctrl not held.
- **The table status**: interaction v45's polite announcement path for tables (`role="status"`, `aria-live="polite"`,
  `aria-atomic="true"`, visually hidden).
- **Screen pixels** (px) are used for every chrome size and offset (grabbers, dots, lines, the ghost's offset,
  thresholds), as v45's chrome; table sizes are canvas units scaled with the view, as v45 says.

### Words

Every text this part adds, exactly:

| Where | Text |
| --- | --- |
| Context bar labels | `Cells`; `Rows`; `Columns` |
| Context bar counts | `<N> cells`; `<N> rows`; `<N> columns` (N in en-US grouping, for example `1,000 cells`) |
| Merge cells button, `aria-label` / tooltip and `title` | `Merge cells` / `Merge cells ⌥M` |
| Split cell button, `aria-label` / tooltip and `title` | `Split cell` / `Split cell ⌥M` |
| Delete button for several | `Delete rows`; `Delete columns` |
| Row menu items | `Move row up`, `Move row down`, `Duplicate row`; with several rows `Move rows up`, `Move rows down`, `Duplicate rows`, `Delete rows` |
| Column menu items | `Move column left`, `Move column right`, `Duplicate column`; with several columns `Move columns left`, `Move columns right`, `Duplicate columns`, `Delete columns` |
| Menu item in both | `Merge cells` |
| Menu headings for several | `Rows`; `Columns` |
| Insert point names (`aria-label`) | `Insert row between rows <N> and <N+1>`; `Insert column between columns <N> and <N+1>` |
| Insert point tooltips | `Insert row`; `Insert column` |
| Disabled reasons | `Already the first row`; `Already the last row`; `Already the first column`; `Already the last column`; `Choose rows next to each other`; `Choose columns next to each other`; `A merged cell is in the way`; `Already a single cell` |
| Announcements (AT18) | `<N> cells selected`; `<N> rows selected`; `<N> columns selected`; `Row moved to row <N>`; `Rows moved to rows <N>–<M>`; `Column moved to column <N>`; `Columns moved to columns <N>–<M>`; `Row inserted`; `Column inserted`; `Row duplicated`; `Rows duplicated`; `Column duplicated`; `Columns duplicated`; `Cells merged`; `Cell split` |
| Board notice (AT16) | `<label> merged cells you were editing.` |

The existing limit reasons stay word for word: `A table holds at most 50 rows`, `A table holds at most 20 columns`,
`A table needs at least one row`, `A table needs at least one column`, and the board-wide `A board holds at most 5,000
table cells.`

### AT1 — Selection kinds

Interaction v45's four selection levels (table, cell, row, column) gain four kinds. Exactly one kind is selected at a
time, always inside one table, and that table is the only selected object (as for a cell today):

| Kind | Holds | Its cells |
| --- | --- | --- |
| **Range** | an `anchor` cell and a `focus` cell | the smallest rectangle containing both, grown |
| **Cell set** | 2 or more cells (a merged cell counted once, by its anchor) | those cells, in reading order |
| **Rows** | 2 or more row ids, in table order | every cell of those rows |
| **Columns** | 2 or more column ids, in table order | every cell of those columns |

- A range whose grown rectangle is exactly one cell (one unmerged cell, or exactly one merged cell) is that single
  cell's selection instead. A set, rows or columns left with one item become that single cell, row or column.
- **Anchor cell** (extends v45's **Anchors**): a range's `anchor` cell; a set's first cell in reading order; for rows,
  the first chosen row's cell in the first column; for columns, the first chosen column's cell in the first row; a
  merged cell's anchor for a merged cell.
- **Count**: the number of cells in a range or set (a merged cell counts once), of rows, or of columns.
- **Changes from elsewhere** (an Undo, a remote edit, a reload): ids no longer in the table drop out of a set, rows or
  columns; when one is left the selection becomes that single cell, row or column, and when none is left, the table.
  When a range's `anchor` or `focus` cell's row or column is gone, the selection becomes the table. A selected cell
  that has become a covered cell becomes its merged cell; a set's cells are mapped the same way (duplicates removed);
  a range is grown again. Reading order and table order are always read from the table as it is at that moment (never
  remembered), so a move by someone else can change which cell of a set is first. When the start row or column of
  chosen rows or columns (AT2) is gone and two or more remain, the first remaining chosen one in table order becomes
  the start. Interaction v45's remote-delete notice shows exactly when such a change, from someone
  else (origin `remote`), makes the selection fall back to the table (`<label> deleted a row you had selected.` /
  `…a column you had selected.`, or `…you were editing.` while editing); when items remain, the selection shrinks
  with no notice. After an Undo or Redo the selection is the table (v45, unchanged).

### AT2 — Choosing with the pointer

Editors only, with the Select tool. A ⇧- or ⌘-press on a cell or grabber of the selected table is always taken by
these rules first, for every kind below: it never starts a border resize (v45's border drags), a move of the table or
a box selection, and never adds the table to or removes it from a multiple selection. A plain click, a border drag,
moving the table and box selection keep today's paths.

- **⇧-click on a cell** of the table, while a cell, range or set of that table is selected: a **range** from the
  current anchor cell (a single cell is its own anchor; a range keeps its `anchor`; a set uses its first cell in
  reading order) to the clicked cell, which becomes the `focus`. Another ⇧-click moves the `focus` again.
- **⌘-click on a cell** of the table, while a cell, range or set of that table is selected: the clicked cell is added
  to a **set**, or removed from it when it is already in it. From a single cell the set is that cell and the clicked
  one; from a range it is the range's cells with the clicked cell added or removed. A set left with one cell becomes
  that cell; with none, the table.
- **⇧-click on a row grabber** (selected or hovered, AT8), while one row or several rows of that table are selected:
  **rows** from the start row to the clicked row, inclusive, in table order; the **start row** is the row chosen by
  the last grabber click without ⇧ (with one row selected, that row). **⌘-click on a row grabber**: adds that row to
  the chosen rows or removes it (one left: that row; none: the table). Columns alike with column grabbers.
- **Another kind starts again**: a ⇧- or ⌘-click on a cell while rows or columns are chosen, on a row grabber while a
  cell, range, set or columns are chosen, or on a column grabber while a cell, range, set or rows are chosen,
  selects that one cell, row or column, as a plain click does.
- A plain click on a cell (any kind selected) selects that cell alone; a plain click on a grabber selects that row or
  column alone (v45). A click on a covered cell selects its merged cell.
- ⇧-click and ⌘-click on the table while the **table** is selected, on another object, or on empty canvas keep
  today's rules (Shift adds or removes the object in a multiple selection; the cell-level selection ends).
- **While a cell is being edited**, a ⇧- or ⌘-click on another cell of the same table ends editing, committing as
  Escape does, and then acts as above with the edited cell as the selected single cell (⇧: a range from it; ⌘: a set
  of it and the clicked cell).
- **Viewers**: a ⇧- or ⌘-click on a cell of a table one of whose cells is selected acts as a plain click on that cell.

Each change of a range, set, rows or columns announces its count (AT18).

### AT3 — Choosing with ⇧+arrows

With a cell or range selected (editors, not editing, not composing), Shift+ArrowUp/Down/Left/Right (`key`
`ArrowUp`, `ArrowDown`, `ArrowLeft`, `ArrowRight`, Shift held, Alt, Cmd and Ctrl not held) moves the range's `focus`
(a single cell: a range is started with that cell as `anchor` and `focus`) by one cell in that direction, as the
arrow keys move a selected cell (AT15): it stops at the table's edges, leaves a merged cell's span, and lands on a
merged cell's anchor. The range is then grown. When the result is one cell it is that cell's selection; otherwise the
count is announced. With a set, rows or columns selected, Shift+arrows are consumed and do nothing. Shift+Tab keeps
its v45 meaning (previous cell).

### AT4 — Outlines and grabbers of a selection

All line widths are screen pixels (drawn at `width ÷ zoom` canvas units), as v45's outlines:

| Selection | Drawn |
| --- | --- |
| Unmerged cell, row, column | v45: a 2 px `#518de0` outline over its edges |
| Merged cell | one 2 px `#518de0` outline round its whole box (the span); `#7051cf` while editing |
| Range | one 2 px `#518de0` outline round the grown rectangle, and a 1 px `#8fbdf5` line on each of its inner row and column borders, except where a border lies inside a merged cell |
| Cell set | a 2 px `#518de0` outline round each chosen cell's box (a merged cell's whole box) |
| Rows or columns forming a run | one 2 px `#518de0` outline round the run (the table's drawn width × the run's drawn height; for columns, the run's width × the table's drawn height) |
| Rows or columns not forming a run | one 2 px `#518de0` outline round each chosen row or column |

**Selection grabbers** (extends v45's **Grabbers**; editors only, not editing):
- An unmerged cell: v45 (its column's above, its row's at the left). A **merged cell**: its row grabber only when it
  spans one row, its column grabber only when it spans one column, each placed by v45's rule for its anchor's row and
  column.
- A range or a set: no selection grabbers (hovered grabbers, AT8, still show).
- Rows or columns: each chosen row's (column's) grabber in v45's **selected** look (16 × 16, radius 4, `#518de0`, white
  grip), `aria-pressed="true"`. One row or column: v45.
- **Add bars** keep v45's rule, with the anchor cell of AT1.

### AT5 — Context bars

Extends v45's **Context bars** table. │ is the existing `.context` divider; every other part is as in v45.

| State | Bar, left to right |
| --- | --- |
| Range | `Cells` │ `<N> cells` · **Merge cells** · `Delete content` · `Copy link to table` |
| Cell set | `Cells` │ `<N> cells` · `Delete content` · `Copy link to table` (no Merge cells) |
| Cell, unmerged | v45's Cell bar, unchanged (`Cell` │ `Edit text` │ `n / 1,000` · `Row options` · `Column options` · `Delete content` · `Copy link to table`) |
| Cell, merged | `Cell` │ `Edit text` │ `n / 1,000` · `Row options` · `Column options` · **Split cell** · `Delete content` · `Copy link to table` |
| Editing | v45, unchanged (a merged cell's count is its text's) |
| Row | `Row` │ `Row options` · **Merge cells** · `Delete row` · `Copy link to table` |
| Column | `Column` │ `Column options` · **Merge cells** · `Delete column` · `Copy link to table` |
| Rows | `Rows` │ `<N> rows` · `Row options` · **Merge cells** · `Delete rows` · `Copy link to table` |
| Columns | `Columns` │ `<N> columns` · `Column options` · **Merge cells** · `Delete columns` · `Copy link to table` |
| Viewers | v45 and v53, unchanged: `Cell` and the count, and `Copy link to table` |

- `Copy link to table` is **Links in text (v53)**'s Copy link to object (LT9), unchanged, always last.
- The count (`<N> cells`, `<N> rows`, `<N> columns`) is the bar's existing count element (`small`) in the place of
  `n / 1,000`.
- `Delete rows` / `Delete columns` use the `Delete row` button's glyph and look; disabled with `A table needs at least
  one row` (`…one column`) when the number chosen is not less than the table's live number of rows (columns), checked
  before anything is deleted, so a refused delete removes nothing.
- Every new bar button (Merge cells, Split cell, Delete rows, Delete columns) uses the shared `.context` button's
  hover, focus-visible and active (pointer-down) looks, with no own active look; Split cell keeps its pressed fill
  while held.
- **Merge cells**: a `button.icon-button` of the bar's existing look, `aria-label` `Merge cells`, tooltip and `title`
  `Merge cells ⌥M` (on every platform, as the table menus' ⌥ shortcuts). Glyph (20 × 20 viewBox, stroke 1.75,
  `currentColor`, round caps and joins):
  `<rect x="2.5" y="4.5" width="15" height="11" rx="2"/><path d="M6 10h8M8 8l-2 2 2 2M12 8l2 2-2 2"/>`.
  Enabled when the selection is **mergeable** (AT13); otherwise disabled, its tooltip and `title` the first reason
  that applies: the bar's selection reason; `Choose rows next to each other` (`…columns…`) for rows or columns that
  are not a run; `Already a single cell` when the merge rectangle (AT13) is one cell.
- **Split cell**: shown only when the selected cell is a merged cell; `button.icon-button`, `aria-label` `Split cell`,
  tooltip and `title` `Split cell ⌥M`, `aria-pressed="true"`. Glyph (same attributes):
  `<rect x="2.5" y="4.5" width="15" height="11" rx="2"/><path d="M10 4.5v11M3.5 10h3M13.5 10h3"/>`.
  Its look is pressed: fill `#7051cf`, radius
  8 px, white glyph; hovered while pressed `#6142be`, radius 8 px (the pressed rule of **Links in text (v53)** LT2,
  which outranks `.context button`, with radius 8 px for this button). Disabled only by the bar's selection reason.
- **Position** (replaces v45's horizontal rule for these states): the bar is centred horizontally on the selection's
  box: a cell's box (a merged cell's whole box); a range's rectangle; for a set, the smallest box holding every chosen
  cell; for a row or rows, the table's drawn box; for a column or columns, the smallest box holding the chosen
  columns. Its bottom is **48** px above the table's drawn top for every cell, range, set, row or column selection not
  being edited (v45's rule for a cell, row or column); while editing (a merged cell included), v45's 26. The existing
  viewport fit applies. It is hidden while a border or corner is dragged (v45) and while a grabber drag runs (AT11).

### AT6 — Row and column menus

Replaces v45's Row options and Column options item lists (their look, keys, focus and open rules are unchanged):

| Menu | Items, top to bottom (│ is the menu's separator) |
| --- | --- |
| Row options, one row | heading `Row` · `Move row up` · `Move row down` │ `Add row above` ⌥⇧↩ · `Add row below` ⌥↩ · `Duplicate row` ⌘D · `Merge cells` ⌥M │ `Delete row` ⌫ |
| Row options, several rows | heading `Rows` · `Move rows up` · `Move rows down` │ `Add row above` ⌥⇧↩ · `Add row below` ⌥↩ · `Duplicate rows` ⌘D · `Merge cells` ⌥M │ `Delete rows` ⌫ |
| Column options, one column | heading `Column` · `Move column left` · `Move column right` │ `Add column to the left` ⌥[ · `Add column to the right` ⌥] · `Duplicate column` ⌘D · `Merge cells` ⌥M │ `Delete column` ⌫ |
| Column options, several columns | heading `Columns` · `Move columns left` · `Move columns right` │ `Add column to the left` ⌥[ · `Add column to the right` ⌥] · `Duplicate columns` ⌘D · `Merge cells` ⌥M │ `Delete columns` ⌫ |

- The shortcut column shows `⌘D` on Mac and `Ctrl+D` elsewhere; every other shortcut is shown as written on every
  platform (as today). The Move items show no shortcut.
- **What they act on.** From a Row or Column bar: the selected row or column. From a Rows or Columns bar: every chosen
  row or column; `Add row above` adds above the first chosen row and `Add row below` below the last (columns: left of
  the first, right of the last). From a Cell bar: that cell's row or column (a merged cell's anchor's row or column),
  so `Merge cells` there merges that whole row or column and `Duplicate row` duplicates that row.
- **Disabled reasons**, each item's first match; the reason is its `title` (v45's disabled item look):

| Item | When, in order | Reason |
| --- | --- | --- |
| Move … up / left | the chosen rows (columns) are not a run | `Choose rows next to each other` (`…columns…`) |
| | the first chosen row (column) is the first | `Already the first row` (`Already the first column`) |
| | the run partly overlaps a merge's span, or the gap one place up (left) is not allowed | `A merged cell is in the way` |
| Move … down / right | not a run; the last chosen is the last (`Already the last row` / `Already the last column`); the run partly overlaps a merge's span, or the gap one place down (right) is not allowed | as above |
| Add … | the new cells would take the board past 5,000 table cells | `A board holds at most 5,000 table cells.` |
| | at 50 rows / 20 columns | v45's limit reason |
| Duplicate … | the copies would take the board past 5,000 table cells | `A board holds at most 5,000 table cells.` |
| | the copies would pass 50 rows / 20 columns | v45's limit reason |
| | not a run | `Choose rows next to each other` (`…columns…`) |
| | the run partly overlaps a merge's span | `A merged cell is in the way` |
| Merge cells | as the bar's Merge cells (AT5) | |
| Delete … | the number chosen is not less than the table's live number of rows (columns), checked before anything is deleted | v45's reason |

- **One refusal order** for adding and duplicating: the board's cell limit, then the table's row or column limit,
  then not a run, then a merge in the way. The same check, in that order, decides the menu items, ⌘D, and the ⌥⇧↩,
  ⌥↩, ⌥[ and ⌥] keys (from a cell, row, column, rows or columns alike), so a key acts exactly when the matching menu
  item is enabled.
- The **gap one place up** of a run is the gap just before the row above the run; **one place down**, the gap just
  after the row below it (columns: left, right).
- Opening a menu focuses its first enabled item (v45's rule), which is now `Move row up` (`Move column left`, or the
  plural) when it is enabled.
- Choosing an item closes the menu, acts, and returns focus to the canvas (v45).

### AT7 — Keys

Extends v45's **Keys and editing** and **Adding, deleting, resizing** keys. Editors only; never while an input method
is composing; keys a table selection handles are consumed (v45).

| Key | Selection | Effect |
| --- | --- | --- |
| ⌥M (`code` `KeyM`, Alt held, Shift, Cmd and Ctrl not held) | range, row, column, or rows/columns forming a run | **Merge cells** when enabled (AT5); otherwise nothing |
| | a merged cell | **Split cell** |
| | anything else | nothing |
| ⌘D (today's Duplicate key) | one row or column, or rows/columns forming a run | **Duplicate** (AT12) when its menu item is enabled; otherwise nothing |
| | a cell (merged or not), range or set | nothing (it no longer duplicates the table) |
| | the table | today's Duplicate of the table |
| Delete or Backspace | range or set | clears every chosen cell's text, one Undo step (none when no chosen cell had text); the selection stays |
| | rows or columns (one or several) | deletes them all in one step; when the number chosen is not less than the table's live number, nothing is deleted. A selection that the delete leaves on a covered cell becomes its merged cell |
| Return | range or set | edits the anchor cell (AT1); the multi-selection ends |
| | rows or columns | nothing (consumed), as v45 for a row or column |
| Tab, Shift+Tab, arrows (no Shift) | range or set | end the multi-selection and act from the anchor cell exactly as from a single selected cell (v45): the next or neighbouring cell is selected; when there is none (Tab from the last cell, Shift+Tab from the first, an arrow at the table's edge), the selection becomes the anchor cell alone and nothing else moves |
| Shift+arrows | cell or range | AT3 |
| | set, rows or columns | nothing (consumed) |
| Escape | range, set, rows or columns | selects the table |
| ⌥⇧↩, ⌥↩ | rows | add a row above the first / below the last chosen row |
| | columns | add a row beside the anchor cell's row (v45) |
| ⌥[, ⌥] | columns | add a column left of the first / right of the last chosen column |
| | rows | add a column beside the anchor cell's column (v45) |
| ⌥⇧↩, ⌥↩, ⌥[, ⌥] | range or set | nothing (consumed) |

Viewers keep v45: no table keys. A key whose bar button or menu item is disabled does nothing.

### AT8 — Hovered grabbers

**When.** For an editor, while the table, or any cell, range, set, row or column of it, is selected, nothing is being
edited, no pointer gesture is running (a border, corner or grabber drag, a box selection), Tidy up is closed and the
pointer (`pointerType` `mouse` or `pen`) is over the hover area:
- the **hovered row** is the row whose drawn span contains the pointer's y, while the pointer's x is from 40 px left
  of the table's drawn left edge to its right edge;
- the **hovered column** is the column whose span contains the pointer's x, while the pointer's y is from 40 px above
  the table's drawn top edge to its bottom edge.

Over the table both are hovered; in the 40 px strip at the left only a row, above only a column. While the pointer is
over one of the table's grabbers or insert points, the hovered row and column stay as they were. When the pointer
leaves the area they go.

**What shows.** Each hovered row and column shows its grabber in v45's **closed** look and place (a pill 6 × 20 for a
row, 20 × 6 for a column, radius 3, `#8fbdf5`, centred 14 px outside the table's left or top edge, beside the hovered
row's or column's middle; hit area 28 × 28), as the selected cell's grabbers are drawn today, with v45's name
(`Select row R` / `Select column C`), tooltip, hover, focus-visible and active looks. A hovered row or column that
already shows a grabber (AT4) shows only that one. Clicking it chooses by AT2; pressing and dragging it moves by AT11.

### AT9 — Insert points

**When.** With every condition of AT8, and for the hovered row and column only.

**Where.** A **dot** on each **inner** border of the hovered row (its top border unless it is the first row, its bottom
border unless it is the last) and of the hovered column (its left border unless it is the first, its right border
unless it is the last); never on the table's outer edges (where the add bars are). A row's dot is centred 14 px left
of the table's drawn left edge at the border's y; a column's dot 14 px above the table's drawn top at the border's x.
Each dot is a DOM button over the canvas, in the stacking and placement of v45's grabbers, with a **24 × 24** hit area
centred on the dot. Where a dot's hit area and a grabber's overlap (at low zoom), the dot takes the pointer. Dots are
pointer-only: they are not in the tab order (`tabindex="-1"`); the keyboard route to inserting a row or column is the
Row and Column menus' Add items, which keep v45's default sizes (a row of set height 64, a column of width 192).

**Look** (approved design, 2026-11-27):

| State | Value |
| --- | --- |
| Rest | an 8 × 8 dot, radius 4, `#8fbdf5` |
| Hover (pointer over its hit area), and while it is held down (no own active look) | an 18 × 18 circle `#518de0`, shadow `0 1px 3px rgba(20,18,26,.25)`, holding a white plus 10 × 10 (`<svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round">` with the path `M5 1.5v7M1.5 5h7`), centred where the dot was; a **2 px `#8fbdf5` line** centred on that border across the table's whole drawn width (a row border) or height (a column border), not past its ends; and the tooltip |
| Tooltip | `Insert row` / `Insert column`, in the app's shared `.tooltip` look (its font, line height, colours, radius and padding unchanged); for a row dot its right edge 8 px left of the circle, vertically centred on it; for a column dot its bottom edge 8 px above the circle, horizontally centred on it |
| Disabled (the table already has 50 rows / 20 columns, or the new cells would take the board past 5,000 table cells) | `disabled`; the 8 × 8 dot only at **45 % opacity (the app's disabled look, `.45`)** (no plus, no line on hover), cursor `not-allowed`; its tooltip (shown on hover) and `title` the reason: v45's limit reason, or `A board holds at most 5,000 table cells.` |

**Names.** `aria-label` `Insert row between rows N and N+1` (N the index of the row above the border, from 1) or
`Insert column between columns N and N+1` (N the index of the column to its left).

**Click.** Inserts one empty row at that border whose set height is the **set height of the row above it** (a column:
the width of the column to its left); one Undo step; once the change is accepted (AT19), the announcement `Row
inserted` / `Column inserted`. The
**selection does not change** (it keeps its ids; a range's rectangle may now hold the new row). A border strictly
inside a merge's span grows that merge by the new row (document v24). Focus returns to the canvas.

### AT10 — Moving with the menus

`Move row up` / `Move row down` (`Move rows …`, `Move column left` / `right`, `Move columns …`) move the chosen row,
column or run by **one place**: to the gap one place up, down, left or right (AT6), when the item is enabled. Rows
keep their ids, set heights, cells' texts and every merge wholly inside the run; no other cell's text moves. From a
Row, Column, Rows or Columns bar the moved rows or columns stay selected (the same kind); from a Cell bar's menu the
**cell** stays selected and moves with its row or column. One Undo step; announcement AT18. On team boards:

> On a fully initialized table (every live row and column pair has a text and no orphan text is live) whose stationary order keys are strictly increasing and where a key fits between each moved id's new neighbours, a move's update writes exactly one `order` per moved row or column and nothing else.

Otherwise the same update also carries sync v20's fallback keys and sync v15's cleanup of that table.

### AT11 — Moving by drag

**Start.** An editor presses the primary button, with no Shift, Alt, Cmd or Ctrl, on a row grabber (selected look or
closed pill, hovered or not), with the Select tool and nothing being edited. Pointer movement of **4 px or more along
the row axis** (vertical; horizontal for a column grabber) from the press starts a drag; movement across the axis does
not count; a press and release before that is today's click on the grabber (AT2).

**What moves.** When the current selection is rows (one row or several), the grabbed row is one of them and they form
a run, the whole run; otherwise, when the threshold is crossed, the selection becomes the grabbed row alone and it
moves alone (so a set of rows that is not a run is never dragged together). Columns alike, with column selections.

**A run that cannot move.** When the run that would move partly overlaps a merge's span on that axis, no drag starts:
crossing the threshold shows no ghost, square, faded place or drop line, the context bar stays, nothing moves, and the
release is not a click.

**While dragging** (approved design, 2026-11-27):
- the pointer is `grabbing` everywhere on the page (over the canvas, every control and the bars alike), for as long as
  the drag runs;
- the context bar is hidden; hovered grabbers, insert points, add bars and every other grabber of the table are
  hidden, except the selected grabbers of the moving rows or columns, which stay at their places;
- the run's selection outline stays, and the run's place is faded by `rgba(245,247,250,.85)` drawn 1 px inside its
  box;
- a **ghost** of the run follows the pointer: a box the size of the run on screen (the table's drawn width × the run's
  drawn height for rows; the run's width × the table's drawn height for columns) showing the run's cells and texts as
  the table draws them, fill `rgba(255,255,255,.92)`, a 1 px `#d9dfe7` border and 1 px `#d9dfe7` lines between its
  cells, no corner radius, shadow `0 8px 24px rgba(20,18,26,.18)`. Its position is the run's own box moved along the
  axis by the pointer's movement since the press, then offset **10 px right and 10 px down**; it is drawn above the
  table and below the context bar, menus and notices;
- a solid **16 × 16 `#518de0` square**, radius 4, no grip, is centred on the pointer's position along the axis on the
  grabbers' line (14 px outside the table's left edge for rows, above its top for columns);
- a **drop line** marks the **drop gap**: the allowed gap whose border is nearest the pointer along the axis (a tie
  goes to the gap above or to the left). The line is 2 px `#518de0`, centred on that border, from 4 px before the
  table's drawn left edge to 4 px past its right edge (columns: from 4 px above the top to 4 px below the bottom). The
  run's **own place** (its top and bottom borders and every border between its own rows) holds allowed gaps when the
  merge rule allows them; a drop there changes nothing.

**Live geometry.** The drag keeps the latest pointer position and the moving rows' ids, not a gap number. The drop gap,
the drop line, the ghost and the faded place are found again from the table as it is now on every pointer move, on
every change to the table (someone else's included, even while the pointer is still) and at the release.

**Release.** The move is checked against the table as it is at the release. When there is a drop gap outside the
run's own place, the run moves to it: the moved rows stay selected (the same kind), one Undo step (on release), and,
once the change is accepted (AT19), the announcement of AT18. Otherwise (no drop line, or the run's own place)
nothing changes: no Undo step, no announcement.

**Cancel.** Escape (consumed), `pointercancel`, loss of pointer capture, the window losing focus, the board turning
read-only, the table or a moving row being deleted, or a change that leaves the moving rows no longer a run or makes
the run partly overlap a merge's span: nothing moves, nothing is announced, and the selection stays
what it was when the drag started (the run, or the grabbed row). The `click` that follows a release past the threshold
is not a click on the grabber.

Viewers never drag. A press on a grabber never resizes; border drags are as AT14 says.

### AT12 — Duplicating rows and columns

`Duplicate row` / `Duplicate rows` (`Duplicate column` / `Duplicate columns`) in the menus, and ⌘D (AT7), with one row
or column or a run chosen and the item enabled (AT6): copies of the run are inserted **right after its last row**
(right of its last column), with new ids, the same set heights (widths), the same cell texts, and a copy of every
merge lying wholly inside the run on that axis (new ids). The **copies become the selection** (one row or column, or
rows or columns forming the copied run). One Undo step; announcement `Row duplicated` / `Rows duplicated` (`Column
duplicated` / `Columns duplicated`), once the change is accepted (AT19). Refused (item disabled, ⌘D does nothing) at
the 50-row / 20-column limit, when the copies would take the board past 5,000 table cells, when the
run partly overlaps a merge's span (`A merged cell is in the way`), and for rows or columns that are not a run
(`Choose rows next to each other` / `Choose columns next to each other`).

### AT13 — Merging and splitting

**Mergeable selection** and its **merge rectangle**: a range (its grown rectangle); one row or one column (all its
cells, grown); rows or columns forming a run (all their cells, grown). A cell set and rows or columns that are not a
run are never mergeable. The selection is mergeable when its merge rectangle holds two or more cells (a merged cell
counted once).

**Merge cells** (bar button, menu item or ⌥M): one merge over the merge rectangle, anchored at its top-left cell;
merges inside it are replaced by it; every cell's text except the anchor's is removed without asking (an empty
anchor stays empty). The merged cell becomes the selection (a single cell). Announcement `Cells merged`. One Undo step,
whose Undo restores every removed text and every replaced merge.

**Split cell** (bar button or ⌥M, with a merged cell selected): the merge is removed; its cells come back with the
text in the anchor cell and the others empty. The selection becomes the **range** of those cells (`anchor` the
anchor, `focus` the bottom-right cell). Announcement `Cell split`. One Undo step.

Inserting, deleting, moving and duplicating rows and columns keep merges by document v24's rules: an insert at a
border strictly inside a span grows the merge; deleting a row or column of a span shrinks it; deleting a merge's anchor
row or column moves the anchor to the next row or column of the span and its text goes with the deleted row or column;
a merge left with one cell is removed.

### AT14 — Drawing a merged cell

Extends v45's **The table**:
- A merged cell is **one box** over its span: no grid lines inside it, covered cells not drawn, and its text laid
  out top-left with v45's padding (20 on every side), wrapped within the span's total width minus 40, at the table's
  text size and line height.
- **Heights.** Each row's drawn height is first found by v45's rule from its **unmerged** cells only. Then, for each
  merge in the document's canonical order (anchor row index, then anchor column index): when its text height + 40 is
  more than the sum of its rows' drawn heights, the **last row of its span** is drawn taller by the difference. These
  additions change drawn heights only: v45's **Row growth** (raising set heights when text is committed or the size
  changes) and a row border's drag minimum count unmerged cells only, so a merged cell's text never raises a saved
  height.
- **Border drags** (replaces part of v45's): a resize by a border drag, a corner handle or the Objects panel starts
  from the rows' **saved** set heights, never from drawn heights that a merged cell's text added, so a resize never
  saves that growth. A border is hit (the `row-resize` / `col-resize` pointer and the drag) only within 4 px of a
  **visible** grid segment: the parts of a border inside a merged cell are not drawn and are not hit, while a merged
  cell's outer edges stay resizable like any border. While a border is dragged, v45's 2 px `#518de0` line is drawn
  only over that border's visible grid segments (and its 6 px extensions past the table's outer edges), never across
  a merged cell.
- The drawn box (document v24) uses these heights; hit testing maps any point inside a merged cell's box to it.
- Image and PDF exports draw merged cells as the canvas does.

### AT15 — Merged cells in selecting, editing and navigating

- A click anywhere in a merged cell's box selects it; a double-click edits it (editors).
- **Editing**: v45's native text field placed exactly over the merged cell's text box (its whole box inset 20), with
  v45's look, placeholder, commits, 1,000 code-point limit and notices. Its accessible name is `Row R, column C of
  <the table's Objects-panel name>`, R and C the anchor's indices.
- `Delete content` and Delete or Backspace clear its text; `Copy link to table` is unchanged.
- **Arrows** from a merged cell leave its span: left and right from the anchor's row, up and down from the anchor's
  column; an arrow onto a covered cell selects its merged cell. **Tab** and **Shift+Tab** (selecting and editing)
  visit each merged cell once, at its anchor's place in reading order, and skip covered cells.
- The announcement on moving the selected cell is v45's `Row R, column C: <text>` with the anchor's R and C.
- While a cell is being edited, a plain click on another cell of that table ends editing and selects that cell (v45);
  a ⇧- or ⌘-click ends editing as Escape does and then chooses by AT2 (**While a cell is being edited**).

### AT16 — Team boards

**Roles.** Owners and editors (and board guests with an editor grant) have every part of AT1–AT15. **Viewers** keep
v45's single-cell selection (a click on a covered cell selects its merged cell) and see merged cells drawn, but get no
range, set, rows or columns, no hovered grabbers, insert points, Merge cells or Split cell buttons, no menus, no drag
and no new keys. Everything an editor changes is in the shared document (sync v20); the room refuses a viewer's
edits as today. Presence is unchanged: others see the existing outline round the whole table.

**Others' changes.** v45's rules stay, with AT1's fallback for the new kinds. In addition:
- **A merge over the cell you are editing.** When an update from someone else (origin `remote`) adds or changes a
  merge (a `mergeMap` entry, sync v20) that makes the cell you are editing a covered cell (so its text is removed),
  your editor closes, its uncommitted part is discarded (as for v45's remote delete), the merged cell becomes your
  selection, and the board notice reads `<label> merged cells you were editing.`, where `<label>` is the presence
  label of the update frame's `connection`, or `Someone` when it is not known (interaction v44's remote-delete form).
  The notice is the board notice in its existing `.notice` look and place (v53 Terms), unchanged. In a `reload` change
  the same happens with no notice; your own changes never show it. When you are editing the **anchor** of the new
  merge, editing continues in the merged cell, with no notice.
- **A move that brings an existing merge over the cell you are editing.** When an update that adds or changes no
  merge (for example someone else's accepted move, which changes which rows a merge covers) makes the cell you are
  editing a covered cell, your editor closes, its uncommitted part is discarded and the merged cell becomes your
  selection, with **no notice**.
- A merge or split by someone else over your selection (not editing) maps it by AT1, with no notice; a split of the
  merged cell you are editing leaves you editing its anchor cell.
- Otherwise a move, insert or duplicate by someone else never closes an editor or a menu and shows no notice: rows
  and columns keep their ids, so the selection and the cell being edited stay.

### AT17 — Undo

Extends v45's **Undo**. One Undo step each: an insert from an insert point; a move (by menu, or by drag on release);
a duplicate; a merge (its Undo restores every removed text); a split; clearing several cells; deleting several rows or
columns. Single-user history and hosted Undo alike (hosted Undo is atomic per step, sync v20). After an Undo or Redo
the selection is the table (v45).

### AT18 — Announcements and accessibility

Every announcement goes through the table status:

| When | Words |
| --- | --- |
| A range or set is made or changes | `<N> cells selected` |
| Rows or columns are chosen or change | `<N> rows selected` / `<N> columns selected` |
| A single cell is selected (a merged cell included) | v45: `Row R, column C: <text>` (or `…: empty`) |
| Moved | `Row moved to row <N>`; `Rows moved to rows <N>–<M>`; `Column moved to column <N>`; `Columns moved to columns <N>–<M>` (N and M the new indices of the first and last moved, `–` an en dash) |
| Inserted from an insert point | `Row inserted` / `Column inserted` |
| Duplicated | `Row duplicated`; `Rows duplicated`; `Column duplicated`; `Columns duplicated` |
| Merged / split | `Cells merged` / `Cell split` |

The remote-merge notice (AT16) is the board notice (`role="status"`). Insert points, Merge cells, Split cell (a toggle
button with `aria-pressed`) and every new menu item are real buttons with the names in **Words**; disabled ones carry
their reason as `title`. Insert points are pointer-only and outside the tab order (AT9); inserting has a keyboard
route through the menus' Add items, and moving through the menus' Move items (the drag is pointer-only). Every new
action has a menu or key route from a selected cell or grabber.

### AT19 — Limits

Unchanged: 1–50 rows, 1–20 columns, 1,000 code points a cell; a merge counts no object toward the board's 250-object
limit. Every insert, duplicate and move keeps the row and column limits; an insert point, item or key that would break
one is disabled (or does nothing) with v45's reason. The board-wide limit of 5,000 table cells is unchanged: an
insert point, an Add or Duplicate menu item, or ⌘D whose new cells would pass it is disabled (or does nothing), with
the reason `A board holds at most 5,000 table cells.`

**Accepted changes only.** Every action in this part keeps today's commit and error handling. The new selection and
the announcement come only after the change is accepted (committed locally, or taken by the hosted board); when the
commit fails or is not accepted, the selection, the announcement and the Undo history stay as they were, and today's
error notice, if any, shows.

### AT20 — Other features

- Copy and paste, Duplicate and Move to page of a whole table, templates, board files, history, backups and local
  storage keep its merges (new ids on copy, document v24).
- Covered cells hold no text, so v47's tab-separated copy text, v47's **Export as CSV** and v48's CSV write a merged
  cell's text in its anchor's place and leave its covered cells empty. CSV paste and import make tables with no
  merges; nothing else in v47's CSV rules changes.
- v47's **Export as CSV** "Who and when" counts a range, set, rows or columns of the table as the table being selected
  ("the table, or one of its cells, rows or columns, selected").
- v48's **Whole tables**: under `Selection only`, the table named by a table selection whose kind is `cell`, `range`,
  `cells` (a set), `row`, `rows`, `column` or `columns` counts as no table.
- v48's **Drawing** never draws hovered grabbers, insert points, range inner lines, drag ghosts, drop lines or the drag
  square (they are table selection marks and controls).

### AT21 — Not in this version (arranging table cells)

Cell formatting (fill, text size, colour, bold, strikethrough, links, alignment) for one or several cells; pasting
onto selected cells; copying only the selected cells; exporting part of a table; merging a cell set or rows or columns
that are not a run; a right-click menu; moving a set of rows or columns that is not a run; moving rows or columns to
another table; moving with the keyboard other than the menus; scrolling the view during a drag; choosing cells across
tables; sorting; hovered grabbers and insert points for touch; keeping other cells' text when merging.

## Links in text (v53)

Version 53 adds **links in text** (the part **Links in text**, values LT1–LT18): words in a sticky, a shape or a
text object can carry a web address, added with a new **Link** button in the context bar's Formatting group, its
shortcut, or by pasting an address onto selected words, and changed or removed in a new **link bar** that takes the
context bar's place. Linked words are underlined on the canvas. Resting the pointer on them shows a **hover card** with
the address, or, for a link to this board, the current name of its page or object. One click follows a link: a link to
this board in place, any other link in a new tab. It also adds **object links**: a **Copy link to object** button in
the context bar for any one selected object (viewers included), an `object` value in board addresses, opening a board
on a linked object, and an address that follows a single selected object. The saved form (a `link` on formatting runs,
schema 17) and the address rule are [document v23](0001-document-v23.md)'s; the room's handling is
[sync v19](0003-sync-v19.md)'s. The look was approved in mock-up v1 (approved design, 2026-11-26); every value is
restated below so it is checked, not inferred.

### Terms

- **Rich-text object**: an object whose registry type has `richText: true`: a sticky (`sticky`), a shape (`shape`)
  or a text object (`text`). No other type holds a link (LT1).
- **Link**: the optional `link` key of a formatting run (`Mark`, document v23): the full stored address. A **linked
  character** is a character covered by a mark with a `link`. A **link run** is a maximal run of consecutive
  characters that all carry the same `link`. Offsets are code points, as for every mark.
- **The address rule** is document v23's `linkAddress(raw)` (`packages/board-rules/src/text-link.ts`), restated
  here: trim the text; refuse it when it is empty, longer than 2,048 characters before parsing, or contains whitespace
  or a control character inside; if it does not start with a scheme (`/^[a-z][a-z0-9+.-]*:(?!\d)/i` does not match;
  a colon followed by a digit is a port, so `example.com:8080/x` becomes `https://example.com:8080/x`) and its host part (the text before the first `/`, `?` or `#`)
  contains a `.`, put `https://` in front; parse it with `URL`; accept it only when the protocol is `http:` or
  `https:`, the hostname is not empty, there is no username or password, and `href.length ≤ 2048`. The stored value
  is the parsed URL's `href`. Local and private hosts are accepted when the rule otherwise accepts them (`localhost:3000`
  has no scheme and no `.`, so it is refused; `http://localhost:3000` is accepted). An address that **passes** the rule
  is one the rule accepts.
- **The range**: while an object is being edited, the editor's selection (`selectionStart` to `selectionEnd`, as code
  points); otherwise the object's whole text. A **collapsed caret** is a selection whose start equals its end. The
  caret is **inside a link** when the characters on both sides of it belong to the same link run (at a link's start
  or end it is not inside, as document v23's text-edit rule). The link-range helpers are document v23's: `linkAt`
  (the whole link run that covers a range, or that a caret is inside), `touchesLink` (whether a range or a caret
  touches a linked character) and `setLink` (set or remove a link over a range, flags kept).
- **Editing** an object: the object's canvas editor is open (`inline`), as the bar's **Edit text** button or a
  double-click opens it.
- **Linked piece**: the drawn part of a linked span on one text line (LT6), inside the object's visible text area (the
  part clipped away is not a linked piece). Hover, following and Edit link identify the link by the **saved link run**
  that contains the character under the pointer (`linkAt` at that code point), never by the drawn piece.
- **Same-board link**: an address that, when used (hovered or clicked, never when saved), meets all of: its origin
  and pathname equal the app's (`location.origin` and `location.pathname`); and either, on a team board, its fragment
  reads as a board link (LT10) whose board id is **the open board's id** and that carries `page`, `object` or both;
  or, on a single-user board, its query's `board` value equals the open board's key and it carries `page`, `object`
  or both. A same-board link with `object` is an **object link**; one with only `page` is a **page link**. A bare
  board link of the open board (no `page`, no `object`) and any link to another board are ordinary links.
- **Kind** of an object, used in Copy link's words (LT9) and in the hover card (LT7):

| Type | Kind | Type | Kind |
| --- | --- | --- | --- |
| `sticky` | `sticky` | `image` | `image` |
| `shape` | `shape` | `video` | `video` |
| `text` | `text` | `link` | `link card` |
| `section` | `section` | `connector` | `connector` |
| `table` | `table` | `stroke` | `drawing` |
| `mindNode` | `mind map node` | `tape` | `washi tape` |

  The **capitalised kind** is the kind with its first letter in upper case (`Sticky`, `Link card`, `Mind map node`).
- **Editors**: people for whom the open board is not read-only (`readOnly` false): on a single-user board, the tab that
  holds the board; on a team board, an owner, an editor or a board guest with an editor grant. **Viewers**: everyone
  else who can open the board (a team viewer, or a board that is read-only for another reason).
- **The board notice**: the app's existing notice (`aside.notice`, `role="status"`, set with `setMessage`), placed as
  interaction v46's **Notice placement** says: at 1440 × 900 its box is 390, 68, 660 × 37, and on a viewer's team board
  390, 123 (8 px under the view-only banner).
- **Platform**: "Mac" is the test the Tidy up tooltip already uses, `/Mac|iPhone|iPad/` on `navigator.platform`.

### Words

Every text this part adds, exactly:

| Where | Text |
| --- | --- |
| Link button, `aria-label` | `Link` |
| Link button tooltip, enabled | `Link · ⇧⌘U` on Mac; `Link · Ctrl+Shift+U` elsewhere |
| Link button disabled reasons (LT2) | `Select one object to add a link`; `Add text first`; `Select words to link`; or the bar's existing selection reason |
| Link bar field, `aria-label` | `Link address` |
| Link bar field, placeholder | `Paste or type a link` |
| Link bar buttons, `aria-label` and tooltip | `Remove link`; `Apply link` |
| Refusal line (LT4) | `Use a web address starting with http:// or https://, or a link to this board.` |
| Copy link to object, `aria-label` and tooltip | `Copy link to <kind>` |
| Notice after Copy link to object | `Link to <kind> copied.` on a team board; `Link to <kind> copied. It opens in this browser only.` on a single-user board |
| Hover card buttons, `aria-label` and tooltip | `Copy link`; `Edit link` |
| Notice after the card's Copy link | `Link copied.` |
| Card label for a missing target | `Not on this board any more` |
| Notice for a missing object | `That object no longer exists.` |
| Notice when a clipboard write is refused | `Could not copy the link. Your browser blocked the clipboard.` (interaction v46's, unchanged) |

`<kind>` is the object's kind (Terms) in lower case, for example `Copy link to sticky`, `Link to table copied.`

### LT1 — Which objects

Links live only in the text of rich-text objects: stickies, shapes and text objects. Connector labels, mind-map nodes,
table cells, section names and every other type never hold a link, show no Link button and accept no paste-to-link.
Copy link to object (LT9) works for **every** type, because it links to the object, not to its text.

### LT2 — The Link button and its shortcut

**Place.** A new button in the context bar's existing Formatting group (`<span class="formats" role="group"
aria-label="Formatting">`), right after **Strikethrough**. It is shown whenever that group is shown (today: when the
selection's formatting objects are all rich-text objects) and nowhere else. The bar's existing placement (centred over
the selection, kept inside the window) applies to its new width: the bar is wider by the two new buttons (LT2, LT9)
and is centred again, not extended to one side. The existing fit rule applies unchanged to the new measured width: the
bar is shown only when the window is at least 768 px wide and the bar's width is at most the window's width minus 24 px
(and the existing height and editor-overlap tests pass); otherwise it is hidden as today. Because the bar is about 80 px
wider, it can now hide at a window about 80 px wider than before; nothing else changes.

**Look.** The bar's existing `button.icon-button` (40 × 40 in the 40-high context bar) with the existing
`<span class="tooltip">`, the bar's hover fill and its disabled look, and no `title` attribute. Its icon is 20 × 20:
`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"
stroke-linejoin="round" aria-hidden="true">` with the paths `M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1`
and `M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1`. Pressing it does not move focus out of the editor
(its `mousedown` default is prevented, as the formatting buttons do). The glyph is 20 px like every other bar icon;
the approved screen drew it larger only because the capture's SVG had no size (derived value).

**States** (approved design, 2026-11-26; every new button in this part uses the shared focus and active looks):

| State | Link button | Copy link to object |
| --- | --- | --- |
| Rest | transparent, white icon (the `.context button` rule) | the same |
| Hover | the bar's existing hover: background `#f1eff5` (shared `button:hover:not(:disabled):not([aria-disabled=true])`), icon `#29272e` (`.context button:hover:not(:disabled)`) | the same |
| Pressed (`aria-pressed="true"`) | background `#7051cf`, radius 6 px, white icon, by a new rule that outranks `.context button` (which today sets every bar button transparent, so the shared `button[aria-pressed=true]` fill does not show in the bar) | — (never pressed) |
| Hovered while pressed | background `#6142be`, radius 6 px, white icon | — |
| Disabled | the shared `button:disabled` (opacity 0.45), tooltip the reason | — (never disabled) |
| Focus-visible | the shared `button:focus-visible` ring (3 px solid `#7051cf`, offset 3 px), and the tooltip shows (`.icon-button:focus-visible .tooltip`) | the same |
| Active (pointer down) | no own look: the hover or pressed look stays | the same |

**Enabled.** For an editor, when the bar's existing selection reason is empty and either:
- not editing: exactly one rich-text object is selected and its text is not empty; or
- editing a rich-text object: the selection is not empty, or the collapsed caret is inside a link.

**Disabled reasons**, first match wins; the reason is the button's tooltip text:

| When | Reason |
| --- | --- |
| The bar's existing selection reason is not empty (a viewer, a read-only board, a composition, a pointer gesture, invalid drafts, Tidy up) | That reason, for example `Read-only: editing commands are unavailable.` for a viewer |
| More than one object is selected | `Select one object to add a link` |
| The one selected object's text is empty | `Add text first` |
| Editing, with a collapsed caret not inside a link | `Select words to link` |

While disabled by the selection reason the button has `aria-describedby="selection-reason"`, as the bar's other
editing buttons do; while disabled by one of the three new reasons it has `aria-describedby="link-reason"`, a new
visually hidden `<span id="link-reason" class="sr-only">` beside `selection-reason` that holds that reason (as
`duplicate-reason` does for Duplicate). Enabled, its tooltip is `Link · ⇧⌘U` on Mac and `Link · Ctrl+Shift+U`
elsewhere.

**Pressed.** `aria-pressed="true"` when the range lies inside one link run (while editing, a collapsed caret inside a
link counts), else `"false"`. With several objects selected it is `"false"`.

**Click.**
- Editing: opens the link bar (LT3) for the range.
- Not editing: starts editing the object through the bar's real **Edit text** route (which also closes any open side
  panel), selects all of its text in the editor, then opens the link bar for that whole range. The pending range is
  consumed (the bar opens) only **after** the editor placement has accepted the canvas editor. When that route falls
  back to the Objects panel's Content field because the canvas editor cannot fit, the pending range is cleared
  **before** the fallback takes focus, the fallback happens as it does for Edit text, and the link bar does not open;
  nothing else happens.

**Shortcut.** Cmd+Shift+U or Ctrl+Shift+U (`key` `u` in either case, Shift held, Cmd or Ctrl held, Alt not held), not
during a text composition, does exactly what the click does whenever the button is shown and enabled: from the canvas
(the scene has focus) and from the canvas editor. When the button is not shown or is disabled the shortcut does
nothing and shows nothing. The Objects panel's Content field does not take the shortcut in this version.

**Narrow windows.** When the context bar is not shown (below 768 px wide, or when it does not fit), the Link button and
its shortcut are not offered, as for every bar command (v52's **Narrow windows**).

### LT3 — The link bar

**Opening.** The link bar opens in the context bar's place: the context bar is hidden (`visibility: hidden`, `inert`,
`aria-hidden="true"`) while the link bar is open, and the link bar is centred on the context bar's box at that moment:
its centre is the bar's centre, its top the bar's top (both 40 high), kept 12 px inside the window horizontally. In
the approved design, editing "Lakeside Hall" at 1440 × 900, its box is 886, 282, 356 × 40. Viewers never see it.

**Editing continues** while it is open: moving focus into the bar does not end the text session, and the object stays
in its editing state with the range kept. While the bar is open:
- the canvas editor keeps its editing outline, 3 px solid `#7051cf` with a 4 px offset (the look of today's
  `.inline:focus-within`, kept by a class set on the editor while the bar is open, because focus has left it);
- **Amendment A4 (2026-11-26).** While the link bar is open and the editor field is blurred, the editor draws an
  opaque `#aec9f4` highlight behind exactly the range's characters on every wrapped line. It follows the field's
  wrapping, padding, font, line height, scroll position and zoom. The text, its colour and the layout stay the same.
  The highlight is pointer-transparent and hidden from assistive technology. It goes away when the field regains
  focus and its native selection shows, or when the bar closes;
- the address field shows focus only by its own 1.5 px `#8a73e6` border: no extra focus ring (`outline: none`); its
  caret is the browser's native text caret (the approved screen drew a 1 × 15 px white stand-in for it).

**Contents**, left to right, in a `<div class="link-bar" role="group" aria-label="Link">`:
1. a text field: `<input type="text" inputmode="url" autocomplete="off" spellcheck="false">`, `aria-label="Link
   address"`, placeholder `Paste or type a link`. It is focused on opening and prefilled with the stored address of
   the link run that covers the whole range (or, with a collapsed caret, the link run the caret is inside): `linkAt`
   for the range; all of it selected; with no such link it is empty;
2. **Remove link**: an icon button, enabled only when `touchesLink` is true for the range (for a range, any of its
   characters is linked; the bar opens on a collapsed caret only when it is inside a link);
3. **Apply link**: an icon button, enabled only when the field's text passes the address rule.

Each button has the `aria-label` and a `<span class="tooltip">` with the same text.

**Look** (approved design, 2026-11-26):

| Part | Value |
| --- | --- |
| Bar | fill `#302d36` (the context bar's), shadow `0 4px 14px rgba(20,18,26,.22)`, radius 10 px, padding 6 px, gap 4 px, height 40 px, `display: flex`, `align-items: center`; width 356 px (6 + 280 + 4 + 28 + 4 + 28 + 6) |
| Field | 280 × 28 px, `box-sizing: border-box`, radius 6 px, border 1.5 px solid `#8a73e6`, fill `#1d1b21`, padding 0 8 px, text 13 px `system-ui` in white; placeholder `#8f8a96` |
| Remove link | 28 × 28 px, radius 6 px, transparent, white 18 px icon: paths `M10 14a4.5 4.5 0 0 0 6.4 0l1.2-1.2`, `M19.4 11l.1-.1a4.5 4.5 0 0 0-6.4-6.4l-1 1`, `M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1`, `M4 4l16 16` |
| Apply link | 28 × 28 px, radius 6 px, fill `#7051cf` when enabled, transparent when disabled; white 18 px icon: path `M5 12.5l4.5 4.5L19 7.5` |
| Disabled buttons | opacity 0.38 |
| Hover | Remove link and Apply link: background `#57525f`, white icon; Apply link (enabled) `#6142be` |
| Focus-visible | buttons: the shared `button:focus-visible` ring (3 px solid `#7051cf`, offset 3 px) and their tooltip shows; the field: see **Editing continues** (its border only) |
| Active (pointer down) | no own look |
| Icons | `viewBox="0 0 24 24"`, `fill="none"`, `stroke="currentColor"`, `stroke-width="1.8"`, round caps and joins, `aria-hidden="true"` |

**Keys and closing.**
- **Return** applies, or refuses (LT4), only while the **field** has focus. Return or Space on a focused Remove link or
  Apply link button activates that button natively; no Return handler sits on the bar itself.
- **Escape** closes the bar without a change.
- A pointer press outside the bar closes it without a change; that press does nothing else, and the `click` that
  follows it is consumed too, so no button or control under the pointer activates.
- Tab and Shift+Tab move between the field and the enabled buttons and stay inside the bar.
- **Focus after closing**, on every close path (Escape, Apply, Remove, an outside press, a text change, a role change,
  the editor gone): after any commit, focus goes to the editor with the same range selected when the object is still
  being edited (editing continues and the context bar shows again); otherwise to the canvas (the scene element).
- The bar also closes without a change, and nothing is written, when editing of the object ends by any other path
  (the selection changes, the object is deleted, the board turns read-only).
- It also closes without a change, and with no notice, when the object's text changes while it is open (for example a
  team member's edit arrives), so Apply never links other words than the ones selected.

**Grapheme boundaries.** Every range a link is set on or removed from (Apply, Remove, paste onto selected words) is
first widened outward to whole graphemes (document v23's `setLink` snaps it), so a link never starts or ends inside a
grapheme (an emoji with modifiers, a letter with combining marks).

**Apply.** Sets the field's address, as the address rule stores it (`href`), on every character of the range with
`setLink`, replacing any link inside the range; flags are kept (document v23: bold, italic and strikethrough are independent of links). With a
collapsed caret inside a link, it replaces that whole link run's address instead.

**Remove link.** Removes the link (`setLink` with `null`) from every character of the range (parts of a link run outside the range keep it);
with a collapsed caret inside a link, from that whole link run. Flags are kept.

Apply and Remove each commit as a Bold toggle while editing does: the text session's pending text is committed first,
then one commit changes the marks, one Undo step (LT14). Then the bar closes as above.

### LT4 — The refusal

Apply link is disabled (transparent, opacity 0.38) whenever the field's text, trimmed, does not pass the address rule
(checked on every input), so a half-typed address is never shown as an error. When Return is pressed and the text,
trimmed, is not empty and does not pass the rule, nothing is applied and the refusal shows:
- the field's border turns `#ff8a80`;
- one line appears under the bar, exactly `Use a web address starting with http:// or https://, or a link to this
  board.`: 12 px `system-ui`, line height 1.35, colour `#ffb4ab`, on the bar's fill `#302d36`, padding 6 px 10 px,
  radius 6 px, `box-sizing: border-box`, at most 360 px wide (it wraps inside), its left edge at the bar's left edge and
  its top 4 px under the bar's bottom edge;
- the field has `aria-invalid="true"` and `aria-describedby` naming the line's `id`.

An empty field shows no refusal (Return does nothing). The refusal stays until the field's text changes, then goes;
it also goes when the bar closes.

### LT5 — Paste onto selected words

While editing a rich-text object with a non-empty selection, a paste into the editor links the selection instead of
replacing it when all of these hold:
1. no text composition is running;
2. it is not a plain-text paste (Cmd+Shift+V or Ctrl+Shift+V, "paste and match style");
3. the clipboard holds no file and is not Board's own copy (the existing test: an object clipboard exists and the last
   copy's plain text equals the raw `text/plain`, or that copy was refused);
4. its `text/plain`, trimmed, contains no whitespace (one token) and passes the address rule.

Then the paste's default is prevented, the selection gets that link exactly as Apply link sets it (LT3), and the words
and the selection stay as they were. One Undo step. Every other paste behaves exactly as today.

### LT6 — Underlines

**Links never change layout.** Line breaks, line widths, the object's height, every glyph's position and the choice
between today's single text drawing and its run-by-run drawing are computed exactly as they would be without links:
the pieces used for layout are split by flags only, so a note with links but no flags keeps today's single drawing, and
adding, changing or removing a link never moves a letter. Each linked character is then underlined: one **underline
line per linked span per text line**, drawn as its own line (not the text library's `underline` decoration), its left
and right ends placed by measuring the line's text up to the span's first character and up to its end in the same font.
Strikethrough keeps today's native `line-through`; a linked struck-through span has both. Unlinked text draws exactly
as today. The editor's text field is unchanged: it shows plain text while editing, as it does for bold today, and the
underlines show on the canvas.

**Look**, in screen pixels, for a piece whose font is `F` px on screen (its font size in board units times the zoom)
on a text line whose top is at `Y` and whose height is `F × 1.45` (the text layout's line height):
- colour: the text's own colour (the object type's text colour, the same fill the piece's letters use);
- thickness: `max(1, round(F / 16))` px;
- position: the underline's top edge at `round(Y + F × 1.45 / 2 + 0.47 × F)`, across exactly the span's measured width.

On the canvas these are given in board units scaled by the current zoom, so they render at the stated screen pixels at
every zoom.

At 100 % zoom with Medium text (18 units) that is a 1 px line about 21 px below the line's top: in the approved design,
y 398 under "Lakeside Hall", whose line starts at 377. An underline that lands more than 1 screen pixel away from these
values, in position or thickness, does not meet this rule. Image and PDF exports draw the same underlines at the
export's own pixel scale `s` (the export draws at zoom 1 and is scaled `s` times when captured): `F` is the font size
times `s`, so the thickness in board units is `max(1, round(F / 16)) ÷ s`, and the position likewise.

### LT7 — The hover card

**When it shows.** The pointer (`pointerType` `mouse` or `pen`) rests for **300 ms** on a linked piece of a visible
rich-text object that is not being edited, on the current page. "Rests" means the pointer stays over linked characters
of the same saved link run (Terms: identified by its maximal run, not by the drawn piece); moving to another link run
restarts the 300 ms. At the moment it would show, it shows only when no pointer gesture is in progress, nothing is
being edited, no Tidy up preview, voting mode or link bar is open, and no **visible** blocker exists: an element
matching `[role=menu]`, `[role=dialog]`, `[role=listbox]`, `.pages-panel`, `.swatches`, `.arrange-menu`,
`.connector-popup`, `.image-description-panel`, or a `details[open]` inside `.context`, for which
`element.checkVisibility({ visibilityProperty: true })` is true (so one hidden by `display`, `visibility` or a hidden
ancestor does not count). A pending show is cancelled **at once** when the pointer leaves the link run (it does not
wait for the hide timer), when editing starts, and on every pointer press; if a blocker is visible at show time the
show is cancelled.

**When it hides.** **200 ms** after the pointer has left both the link run and the card (re-entering either within
200 ms keeps it), and at once on pan, zoom, a page change, the start of any editing, Escape, a pointer press outside
the card, or a selection change. A shown card or pending show is valid only while the current layout still has
that object's link run with the same range and stored address. A change to either, or loss of the run from the
layout, clears the card or pending show at once. Resting on the words again picks up the current link. At most one
card shows at a time.

**Contents**, left to right: an icon, a label, a divider, **Copy link** (everyone), **Edit link** (editors only; absent
for viewers).

| The link | Icon | Label |
| --- | --- | --- |
| A page link whose page exists | page icon: paths `M7 3.5h7l4 4v13H7z` and `M14 3.5v4h4` | the page's current name |
| An object link whose object exists | the bottom palette's tool icon for that type (Sticky, Shapes, Draw, Text, Section, Table, Mind map, Image), else the generic object icon: `<rect x="4.5" y="4.5" width="15" height="15" rx="2.5">` | the object's first non-empty text line, else its capitalised kind |
| A same-board link whose object (object link) or page (page link) does not exist | gone icon: `<circle cx="12" cy="12" r="8.5">` and path `M8.5 8.5l7 7` | `Not on this board any more`, muted |
| Any other link | outside-link icon: path `M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5` (v52's Open link icon) | the stored address, as stored (for example `https://lakeside-hall.example/visit`) |

The **first non-empty text line** is read from the object's current `text` (types with text: sticky, shape, text,
section, connector, mind map node): the text is split at line breaks, the first line holding a non-whitespace character
is taken with its leading and trailing whitespace removed, and if it is longer than 60 code points it becomes its first
60 code points followed by `…`. When the text is empty or holds only whitespace (no such line), the label is the
capitalised kind. Labels are read from the board as it is at the moment the card shows, so a renamed page
or an edited object shows its current name.

**Look** (approved design, 2026-11-26):

| Part | Value |
| --- | --- |
| Card | height 36 px, `box-sizing: border-box`, radius 8 px, fill `#302d36` (the context bar's, as for the link bar; the approved screens that show a card with no bar on screen read `#2b2930`, a capture artefact), shadow `0 4px 14px rgba(20,18,26,.22)`, padding 0 4 px 0 10 px, `display: flex`, `align-items: center`, gap 2 px, `white-space: nowrap`, font `500 13px/1 system-ui` |
| Icon | 16 × 16 px, colour `#d9d6de`, `margin-right: 8px` in addition to the card's 2 px gap; same SVG attributes as the link bar's icons |
| Label | 13 px, weight 500, white, at most 260 px wide with `overflow: hidden` and `text-overflow: ellipsis`, `margin-right: 8px` in addition to the 2 px gap |
| Muted label | colour `#b9b5bf`, italic |
| Divider | 1 × 20 px, `rgba(255,255,255,.18)`, margin 0 4 px |
| Buttons | 28 × 28 px, radius 6 px, transparent, white 18 px icons: Copy link uses the bar's Duplicate icon, Edit link the bar's Edit text (pencil) icon; hover background `#57525f` with a white icon; focus-visible the shared `button:focus-visible` ring (3 px solid `#7051cf`, offset 3 px); active: no own look |

**Place.** Its left edge is at the first character of the link run on the hovered line, its top `round(line top + line
height + 6)` screen pixels (6 px under that line), then kept 12 px inside the window: `left = max(12, min(left,
innerWidth − width − 12))`. If its bottom would be closer than 12 px to the window's bottom, it is placed 6 px above the
line instead. In the approved design at 100 %: the card for "Lakeside Hall" is at 920, 408, 327 × 36.

**Copy link** writes the stored address to the clipboard with `navigator.clipboard.writeText` inside the click and
shows the board notice `Link copied.`; when the write is refused (its promise rejects, or the API is missing) the notice
is `Could not copy the link. Your browser blocked the clipboard.` Nothing is written to the board.

**Edit link** selects only that object, starts editing it through the real Edit text route, selects the link run under
the card in the editor, and opens the link bar (LT3) prefilled with that link. When the route falls back to the Objects
panel, the pending range is cleared before the fallback takes focus and the link bar does not open; the bar opens only
after the placement has accepted the canvas editor, as for the Link button (LT2). It is shown only to editors and
works with any selection, including an empty one, when the editing command has no blocking reason and Tidy up is closed.

### LT8 — Following a link

A **primary click** on a linked piece follows its link. **At the press** (a primary-button press on a linked character,
with the Select tool, no modifier key (Shift, Alt, Cmd, Ctrl) and nothing being edited) the board id, the open page,
the object's id, the saved link run (its start and end) and its stored address are recorded. Whether it follows is
decided **at the release**, for viewers (who have no drag) and editors alike, from values read at that moment: the
same board and page are open; a live hit test at the release point finds the **same object** and the **same saved run
with the same address** (so an edit that arrived during the press, adding, moving or changing a link there, cancels the
follow); the gesture **never** moved 3 screen pixels or more from the press (the canvas's existing drag threshold; a
gesture that crossed it never follows, even when released back at its start); no text composition is in progress; and
no voting mode or Tidy up preview is open. Otherwise nothing follows and the click is an ordinary click. Then:
- **An object link, or a page link to another page**: followed in place, on both board kinds: no new tab, no page
  load, no `hashchange`. An object link opens by LT11; a page link opens its page as interaction v46's link to the board
  that is open does (with nothing selected). In-place opening runs with its own guards (LT11 **While opening is not
  allowed**), not with any state captured during the click. The address is then rewritten with
  `history.replaceState` (LT12). The clicked object is not selected (an object link selects its target).
- **A page link to the page already open**: an ordinary click (the clicked object is selected as a click selects it;
  no navigation, no notice). A same-page `hashchange` keeps interaction v46's result.
- **Any other link that passes the address rule** (checked again now): `window.open(href, "_blank",
  "noopener,noreferrer")`, and the clicked object is selected as an ordinary click selects it.
- **A stored address that fails the address rule**: nothing opens; the click is an ordinary click.

**Double-clicks.** Following happens on the first click's release. When that click followed a link, only the second
click that belongs to it is suppressed, together with the browser's `dblclick` that follows: the next press counts as
that second click when it is on the same object and the same saved run and starts within 500 ms of the first click's
release (the double-click interval; browsers do not expose their own), and the `dblclick` the browser then fires is
suppressed with it. Suppressed means it neither follows again nor starts editing, so no editing starts
on a moved view or another page; for an outside link the tab has already opened. Every other click, including a quick
click on a different link or object, behaves normally (the 500 ms applies only to that one same-link press). To edit linked words, use Edit text, Edit
link, or a double-click on unlinked words of the object.

A drag that starts on a linked piece moves the object (editors) as today; a modifier click selects as today; while an
object is being edited, a click in its editor only places the caret, and a click on the canvas ends editing as today
and follows nothing. Viewers follow links too. Following adds no Undo step and sends no edit (a page switch sends
presence, as today).

### LT9 — Copy link to object

**Place.** A new context-bar button shown when **exactly one** object of **any** type is selected, right before
**Duplicate** (after **Move to page** when that is shown). In the bars that have no Duplicate (the drawing bar and the
connector bar) it sits right before **Delete**. It exists only where the regular context bar is shown: not for several
objects or none, not while Tidy up is open (its own bar replaces the regular one), and not when the context bar is not
shown (below 768 px wide, or when it does not fit).

**Look.** The bar's existing `button.icon-button` (40 × 40) with the existing `<span class="tooltip">` and no `title`;
icon 20 × 20 with the link bar's SVG attributes and the paths `M8.5 15.5l3.5-3.5`,
`M9.8 9.6l.9-.9a3.2 3.2 0 0 1 4.5 4.5l-.9.9`, `M10.7 18.4l-.9.9a3.2 3.2 0 0 1-4.5-4.5l.9-.9` and
`M15 3.5h5.5V9M20.5 3.5l-5 5`. `aria-label` and tooltip: `Copy link to <kind>`.

**Enabled** always, for every role, wherever it is shown: not disabled for a viewer, a read-only board, a gesture or a
composition. For a viewer it is the bar's one enabled control, except on a link card's bar, where v52's **Open link**
also stays enabled for viewers (an existing exception that this version keeps).

Pressing it does not move focus (its `mousedown` default is prevented), so when the selected object is being edited
the editor keeps focus and editing continues.

**Click.** Inside the click it writes the object's link (LT10, with `page` the object's own page) as plain text with
`navigator.clipboard.writeText`, then shows the board notice `Link to <kind> copied.` on a team board, or `Link to <kind>
copied. It opens in this browser only.` on a single-user board; when the write is refused (its promise rejects, or the
API is missing), `Could not copy the link. Your browser blocked the clipboard.` It adds no Undo step, changes nothing on
the board, leaves the save state unchanged and sends nothing to the room. The selection, focus and any editing stay.

### LT10 — Object link addresses

An **object link** is interaction v46's page link plus an `object` value naming the object's `id`:

```
team board:         <origin><path>#/b/<board id>?page=<page id>&object=<object id>
single-user board:  <origin><path>?board=<board key>&page=<page id>&object=<object id>
```

**Team boards.** The fragment `#/b/<uuid>` may end with `?` followed by one or two parameters joined by `&`, each
`page=<value>` or `object=<value>`, each name **at most once**, in either order, where `<value>` is any run of
characters other than `&` and `#` (it may be empty). Any other text after the board id (another name, a repeated name,
an empty part, a trailing `&`) makes the link bad, as today. `#/b/<uuid>` alone keeps its exact result today (a board
link with no page value and no object value). Copied and written links put `page` first. Invitation, home, workspace
and Trash fragments are unchanged.

**Single-user boards.** The `object` value is the `object` query parameter, decoded as the URL standard decodes it (its
first occurrence). A written link treats `object` exactly as interaction v46's page link treats `page`: the first
existing `object` parameter is replaced in place (wherever it stands, even before `page`), later `object` parameters
are dropped, and when there is none it is appended after `page`; `page` keeps v46's rule; every other part of the query
is kept as it is encoded, in its place. Writing an address **without** an object removes every `object` parameter. For
example, `?object=a&board=k&page=p&object=b` with object `c` becomes `?object=c&board=k&page=p`.

The board link copied from the Share dialog and the home lists stays the board link without a page or object value.

### LT11 — Opening an object link

An object link is opened at three moments: when the tab **first shows a board** (interaction v46's term) and its
address carries an `object` value; on a team board, when the fragment changes to a board link of the board open in this
tab carrying an `object` value (v46's **A link to the board that is open**, which keeps every rule it states: the board
is not stopped or reloaded, no leave question, the Undo history and connection stay, and before the first real
document has arrived the latest fragment's values wait and replace each other); and when an object link is followed by
a click (LT8). A single-user board's changed query is a new page load, so it is opened as the first show.

**The object exists** (an object with that `id` is on the board): its **own current page** opens, whatever `page`
says (it may have moved); only that object is selected (not its group or branch); and the view is centred on the
object's box (the centre of its box at the centre of the window): at the **current zoom** for a hashchange or a click,
at **that page's opening zoom** (today's opening view of that page) when the board is first shown. A page opened this
way opens as v46 says (no Undo step, no save state change, remembered for the board in this browser, carried by
presence on a team board).

**The object is hidden** in a collapsed mind-map branch: its page opens and nothing is selected, with no notice (the
branch is not expanded in this version).

**While opening is not allowed** (a pointer gesture, a composition, a Tidy up preview, as v46): for a hashchange or a
click, nothing changes and the board notice reads `Finish the current action first.`

Then the address is corrected with `history.replaceState` to the open page and the selection (LT12). A page link
without `object` keeps interaction v46's behaviour exactly.

### LT12 — The address follows the selection

Whenever the selection settles (after any change of the selected set, once no pointer gesture is in progress: a box
selection writes once, on release), the address is rewritten with `history.replaceState`: no new history entry, no
`hashchange`, no page load, no remount of the board route:
- exactly one object selected: the open page's link with `object=<its id>` (LT10);
- none or several: the open page's link with no `object`.

While the selection is **unsettled** (a pointer gesture is in progress), selection-driven writes are skipped entirely:
the address keeps the `object` it had, and is neither stripped at a drag's start nor restored at its release unless the
settled selection differs. Page changes and address repair still write while a gesture runs; they carry the `object`
of the last settled selection when it is still valid on the open page, else none.

Every address write of interaction v46's **The address follows the open page** uses the same form (a page change
clears the selection, so it writes no `object`). Nothing is written before the board is first shown, while a team
board's page value is still waiting for its first real document, or for the selection inside a history preview (the
address there carries no `object`). On a team board, no change of the `object` value, from a link or from these writes,
remounts the board (v46's **Route identity**). When a leave question opens, the address already shows the open page
and the selected object, and **Stay** keeps it.

### LT13 — Missing targets

**Opening a link to a missing object** (LT11): the page `page` names opens if it exists, else the board's first page;
nothing is selected; the view is that page's opening view (first show) or the page's view as v46 opens it (hashchange
or click; unchanged when it is already the open page); and the board notice reads `That object no longer exists.` Only
that one notice shows, even when the page is missing too. On first show it follows v46's **Order with the load's own
messages** exactly as the missing-page notice does (set after the load's own startup message; not shown when a local
load ends read-only or with a recovery message; shown to a team viewer under the team notice column). The address is
then corrected (LT12).

**The hover card** of a same-board link whose object (object link) or page (page link) is missing shows the gone icon
and the muted label `Not on this board any more`, with Copy link (everyone) and Edit link (editors). A page link to a
missing page keeps v46's notice when followed: `That page no longer exists. You are on “<first page name>”.`

### LT14 — Undo and edits

Setting, changing or removing a link (Apply link, Remove link, paste onto selected words) is **one Undo step** and,
on a team board, **one synced edit** of that object's marks, exactly as a Bold toggle is. Undo restores the marks
before the change, Redo reapplies them. Text edits carry links through document v23's rule: characters typed strictly
inside a link take it; characters typed at a link's start or end do not; deleting every linked character removes the
link. Bold, italic and strikethrough keep links; setting or removing a link keeps flags. Copying a link (either Copy
link), hovering, following and every address write add no Undo step, change no save state and send no edit (a page
switch sends presence, as today).

### LT15 — Viewers and roles

Viewers see the underlines, get the hover card with **Copy link** only (no Edit link), follow links (LT8), and use
**Copy link to object** (LT9). The Link button is shown to them disabled with the bar's selection reason
(`Read-only: editing commands are unavailable.`), its shortcut does nothing, they never see the link bar, and their
pastes never link words (they cannot edit text). The room refuses a viewer's mark edits as it refuses every viewer edit
(sync v19, unchanged access). Editors (owners, editors, board guests with an editor grant, and the single-user board's
holder) have every control in this part.

### LT16 — Where links travel

- **Kept:** object copy and paste (the object clipboard keeps each mark's `link`), Duplicate, board files (board file
  v7), team templates (save and add), undo history, and the room (sync v19).
- **Drawn:** image and PDF exports draw the underlines (LT6).
- **Dropped:** plain-text copies and CSV carry only the text.
- Every place that reads a document checks each link with the address rule (document v23); in a room, an update
  holding a mark that fails it is refused as `invalid_update` (sync v19).
- A pasted copy keeps its stored addresses unchanged. Same-board recognition happens only at use (Terms), so an object
  link copied onto another board is an ordinary link there and opens a new tab.

### LT17 — Accessibility

- The Link button is a labelled toggle button (`aria-pressed`) with its reason exposed through `aria-describedby`
  (LT2); Copy link to object is a labelled button.
- The link bar is a labelled group (`role="group"`, `aria-label="Link"`) whose field is labelled `Link address`; its
  focus is trapped by Tab and Shift+Tab, and closing returns focus to the editor, or to the canvas when the editor is
  gone or the board is read-only (LT3). The refusal line is tied to the
  field with `aria-describedby` and `aria-invalid` (LT4).
- The hover card is a `role="group"` with `aria-label="Link details"`; its buttons are labelled `Copy link` and `Edit
  link`. It is a pointer affordance: Escape hides it.
- Every notice is the board notice (`role="status"`).
- The shortcut gives keyboard access to adding, changing and removing links. Below 768 px the bar commands are not
  offered (LT2).

### LT18 — Not in this version (links in text)

Links in connector labels, mind-map nodes, table cells, section names or any non-rich-text object; showing links in the
editor while editing (a rich-text editor); turning a text link into a link card ("create preview"); a canvas
right-click menu; following, hovering or copying a text link from the keyboard; a Link control in the Objects panel, or
the shortcut in its Content field; the Link and Copy link controls in narrow windows (the context bar not shown);
opening a link in the same tab; expanding a collapsed mind-map branch to reveal a linked node; links to several objects
or a selection; Copy link for several objects; linking typed addresses automatically; `mailto:`, `tel:` and every other
scheme; touch hover.

## Link cards (v52)

Version 52 adds **link cards** (the part **Link cards**, values LC1–LC9): an owner or editor pastes one web address
on the canvas and gets a card that shows the page's picture, title, short description and site, read once by Board's
link preview service. It adds one object type (`link`, document v22), the bar's label `Link` / `<n> links` and four
context-bar buttons, the card's looks drawn on the canvas, and one line in the About popover. It adds exactly two CSS
rules (the layout group's row and its pressed button) and no notice, dialog or panel. The look was approved in the journey mock-up v1
(2026-11-25); every value is restated below so it is checked, not inferred.

### Link cards

#### Terms

- A **card** is an object of type `link` (document v22). Its own keys: `url`, `title`, `description`, `site`,
  `asset` (a picture hash, or `null`), `layout` (`vertical` | `horizontal`), `state` (`loading` | `ready` | `linkOnly`)
  and `requestedAt` (milliseconds since 1970 by the paster's clock, a whole number). Like a picture it also has `x`,
  `y`, `width`, `height`, `page`, `section`, `group` and `order`. Whenever a browser writes a card's look it writes
  that look's size (table below). The document accepts any **card size** with any state (document v22's size rule,
  the union of the table's sizes), so after two concurrent edits merge a card may hold another card size (sync v18).
- **Stored rectangle.** A card's saved `x`, `y`, `width` and `height`. It is always what is drawn, hit-tested and
  outlined, and where the context bar is anchored: the face of the card's look is drawn **inside** it (**Drawing at
  the stored size**), whatever its size.
- **Document bounds.** Every rectangle keeps `x ≥ −1,000,000`, `y ≥ −1,000,000`, `x + width ≤ 1,000,000` and
  `y + height ≤ 1,000,000` (document v22). When a card gets a new size (a finish, a layout choice, a stale card's
  edit), when Change back to text puts a text object in a card's place, and when a paste places a card or a text
  object, the object is **kept within the bounds**: `x` becomes `min(max(x, −1,000,000), 1,000,000 − width)` and `y`
  becomes `min(max(y, −1,000,000), 1,000,000 − height)`. A size change or a conversion can only cross the right or
  bottom edge, so it shifts the object left and/or up just enough; that is the only case where it changes `x` or
  `y`.
- **Units.** Every length below is in board units. At 100% zoom one unit is one screen pixel. The card is drawn on the
  canvas (Konva), as a picture's body is, so it scales with the zoom; only the selection outline keeps a constant
  screen width. Every offset is from the card's top-left corner (its saved `x`, `y`).
- **Stale.** A card whose `state` is `loading` is stale when `now ≥ requestedAt + 20,000` (now by the viewing
  browser's clock). A stale card is drawn and treated as link-only everywhere in this part; its face is drawn inside
  its stored rectangle (306 × 288).
- **Look.** Each card has exactly one look, from its keys and the clock:

| Look | When | Size written (width × height) |
| --- | --- | --- |
| loading | `state: "loading"`, not stale | 306 × 288 |
| vertical | `state: "ready"`, `asset` a hash, `layout: "vertical"` | 306 × `210 + 20·Lt + (Ld > 0 ? 4 + 17·Ld : 0)`: 230, 250, 251, 268, 271 or 288 |
| horizontal | `state: "ready"`, `asset` a hash, `layout: "horizontal"` | 480 × 114 |
| title-only vertical | `state: "ready"`, `asset: null`, `layout: "vertical"` | 306 × 100 |
| title-only horizontal | `state: "ready"`, `asset: null`, `layout: "horizontal"` | 480 × 64 |
| link-only | `state: "linkOnly"`, or stale | 480 × 64 |

  `Lt` is the number of lines the title takes (1 or 2) and `Ld` the description's (0, 1 or 2; 0 when it is empty),
  wrapped as drawn (below). The browser that writes a vertical card measures them; every browser that draws it reads
  them back from the saved height, which is unique for each pair (`Lt, Ld` → height: 1,0 → 230; 2,0 → 250;
  1,1 → 251; 1,2 → 268; 2,1 → 271; 2,2 → 288). The saved counts **cap** what is drawn: every viewer draws at most
  `Lt` title lines and `Ld` description lines, and a text cut at its cap ends its last drawn line with an ellipsis
  (`…`). A viewer whose fonts wrap a text into fewer lines draws fewer (the space below stays empty), never more.
  Different system fonts may therefore show different words; the card's size and rows do not change. A vertical
  card is never taller than 288.
- **Preview service.** Where the paster's browser asks (link preview v1, API v16): on a team board,
  `POST /boards/:board/link-preview` on the team server; on a single-user board, `POST <origin>/link-preview`, where
  `<origin>` is the build's link preview origin (toolchain v6's compile-time constant `BOARD_LINK_PREVIEW_URL`; in a
  team build its local boards are single-user boards and use the same constant). A build where that constant is
  `null` has **no preview service** for single-user boards; team boards always ask the team server.
- **The address rules** are link preview v1's F1–F2. The browser applies them to the parsed address before asking,
  and never asks for an address that fails them.

#### Pasting an address (LC1, LC4)

**Place in the paste chain.** This order is authoritative. The canvas's paste handler runs: (1) the table/CSV step
(unchanged); (2) **the link step (new)**; (3) the existing media and object path, unchanged: the team board's paste,
or the picture and video step, which ends in the object paste (`clipboardCommand("Paste")`). The link step must run
**before** the picture and video step, because that step calls `preventDefault()` on every canvas paste it receives,
even one whose clipboard holds no file. The link step passes the event on untouched whenever the clipboard holds any
file (so files keep their table, picture and video paths) and whenever it does not act (below), so every such paste
reaches the media and object path exactly as today.

The link step acts only when **all** of these hold; otherwise it passes the event on untouched and the paste behaves
exactly as today ("Nothing to paste." or the earlier copied objects):

1. The event targets the canvas (`isCanvasPasteTarget`), is not already handled (`defaultPrevented`), and no text
   composition is running. Nothing is being edited: a paste inside a text editor or field never reaches the canvas.
2. The clipboard holds no file.
3. Editing commands are available: the existing editing command reason is empty (not read-only, not composing, no
   pointer gesture, no invalid draft), Tidy up is not open, and on a team board the person can edit and no vote is
   running. A viewer's paste therefore takes today's path and adds nothing.
4. `text/plain`, with leading and trailing whitespace removed, is **one address**: it contains no whitespace; it
   starts with a scheme and `://` (a letter, then letters, digits, `+`, `-` or `.`, then `://`); `new URL()` accepts
   it; and it is at most **1,000** characters (the text object's limit, so every card can change back to text).
5. It is not Board's own copy: the table step's existing test, applied to the **raw** `text/plain` before any
   trimming (an object clipboard exists, and the last copy's plain text equals that raw text or that copy was
   refused). A clipboard holding Board objects keeps today's path.

When it acts it calls `preventDefault()` and, by the address rules on the parsed URL and the length of its `href`:

**Allowed address → a card.** When the address rules pass **and** `new URL(trimmed).href.length <= 1000`. (`new
URL()` can lengthen an address, for example by percent-encoding non-ASCII characters, and a card's `url` is its
`href`, which document v22 limits to 1,000 characters.) One commit, one undo step, no notice:
- `url` is the parsed URL's `href`; `title`, `description` and `site` are `""`; `asset: null`; `layout: "vertical"`;
  `state: "loading"`; `requestedAt` is `Date.now()`.
- 306 × 288, centred on the view centre: `x = round(view.x − 153)`, `y = round(view.y − 144)`, then kept within
  the **document bounds**; on the current page; in the section under its centre (as a pasted picture); no group; on
  top of its band.
- It is selected at once (within 200 ms of the key press), and the arrival starts.
- With **no preview service**, the card is made link-only at once instead: `state: "linkOnly"`, `layout:
  "horizontal"`, 480 × 64 centred on the view centre and kept within the document bounds. No request leaves the
  page.

**Refused address → a text object (LC4).** An address that fails the address rules (another scheme such as `ftp://`;
an IP literal of either family, in any form `new URL()` normalises, such as `127.0.0.1`, `0x7f.1` or `[::1]`;
`localhost`; a name ending `.localhost`, `.local`, `.internal` or `.home.arpa`; a single-label name; a port other than
80 or 443; a user name or password) becomes one **text object** holding the trimmed text exactly. It is made as
Change back to text makes one (below), except its place: its default 320-unit width and its grown height are centred
on the view centre, `x = round(view.x − 160)`, `y = round(view.y − height ÷ 2)`, then kept within the document
bounds. Selected, not opened for editing. One undo step, no notice, no request.

**Allowed address too long → the same text object.** An address that passes the address rules but whose `href` is
longer than 1,000 characters becomes the same text object, holding the trimmed text (which step 4 keeps within 1,000
characters), placed and selected as above. One undo step, no notice, no request.

Text that is not one address (plain words, two addresses, an address with a space inside, `mailto:…`) is not touched
by the link step.

#### The arrival (LC7)

Only the paster's browser runs it, once for each card it pasted. Viewing a card never asks; copies, duplicates, board
files, imports, templates, undo and redo never ask again.

**The same board, still editable (the gate).** When the card is pasted the browser notes the **opening**: the
board's `boardId`, the `HostedBoard` object on a team board (none on a single-user board) and, on a single-user board,
the `LocalStore` object. The gate runs **before the upload** (step 4) and **again before the finish** (step 5, at the
commit). It passes only when all of these hold:
- the page is still mounted and the open board has the same `boardId`;
- **single-user:** this tab is still the board's **active local writer** through the same opening: the `LocalStore`
  in use is the noted object, it is still open (`active`), and the board is not read-only (this tab still holds the
  writer ownership). If the writer was lost (another tab took it, storage changed under it, a save found the stored
  board changed, the page was hidden), the arrival is **cancelled**;
- **team:** the same `HostedBoard` object is in use, the person's role is still owner or editor, and the **live
  editable document** is shown. While a version preview is shown (the board drawn is the preview, not the live
  board), the arrival **holds** at the gate until the live board is shown again; if that has not happened by
  `requestedAt + 15,000` ms, the arrival is **cancelled**;
- the card is still on the board with the same `id`, `url` and `requestedAt`, in `state: "loading"` (checked before
  the upload too, so a card deleted, undone or changed back to text is never uploaded for).

A **cancelled** (ended) arrival aborts what is still running and writes nothing (no picture, no edit). The card stays
`loading` and is drawn link-only once it is stale. Other passing reasons that the board cannot take an edit *now* do
not end it; they hold the finish (step 8).

1. **Ask.** `POST` with the body `{ "url": <the card's url> }` (`Content-Type: application/json`, `credentials:
   "omit"`, `referrerPolicy: "no-referrer"`): a team board through the team route with the person's bearer token; a
   single-user board through the public route with no `Authorization`. The request is aborted after **15,000 ms**.
2. **Answer.** Only a 200 whose body is well formed (API v16: `url`, `title` non-empty, `description`, `site`, and
   `picture` either `null` or `{ type, bytes }` with `bytes` base64 of at most 5,242,880 bytes) is a preview. Any other
   status (403, 404, 413, 422 `address_refused` or `preview_unavailable`, 429 `rate_limited`, 502, 503), a malformed
   body, a network failure or the abort gives the **link-only finish**.
3. **Thumbnail.** With a `picture`, the browser decodes the bytes and makes the thumbnail (below). If they do not
   decode or do not encode, the card is finished **without a picture** (ready, title-only look).
4. **Hold the picture, then name it.** The thumbnail is stored as an ordinary board picture before the card names it
   (after the gate above):
   - single-user: when holding it keeps the board's pictures within 50 MiB (the existing `PICTURE_LIMIT`, counted as
     the board's picture bytes are counted today, each hash once), it is written to the local picture store
     (`asset/<hash>`) and the tab's picture map; otherwise the card is finished without a picture. A store failure
     gives the link-only finish. **At the finish the budget is counted again** on the board as it is then (each hash
     once, the thumbnail included); if it is then over 50 MiB, the card is finished without a picture, and the stored
     record, named by nothing, is removed by the next save's clean-up;
   - team: through the existing picture upload, `PUT /boards/:board/assets/:hash`. `ok` → named; `full` (409
     `board_pictures_full`) → finished without a picture; any other answer → the link-only finish.
5. **Finish.** After the gate above, one edit to the card, made only if a card with the same `id`, `url` and
   `requestedAt` is still on the board in `state: "loading"` (otherwise nothing is written; a team upload that ends
   unused is cleared after 24 h as today, a local one at the next save's clean-up):
   - **ready:** `title`, `description` and `site` from the answer (`site` empty → the url's host), each cut to 300,
     500 and 100 code points as a guard; `asset` when held; `state: "ready"`; `layout` as the card has it
     (`"vertical"`); the size of its new look;
   - **link-only finish:** `state: "linkOnly"`, `layout: "horizontal"`, 480 × 64; texts stay `""`, `asset: null`.

   The **finish keys** are exactly `title`, `description`, `site`, `asset`, `state`, `layout`, `width` and `height`.
   The finish is built from the card **as the board holds it at the commit**: its `x` and `y` are read then, so a
   move made while the card loaded is kept, and they change only when the new size would cross the document bounds
   (shifted left and/or up just enough). Every other key (`page`, `section`, `group`, `order`, `url`, `requestedAt`)
   stays as the board holds it then. The card keeps the pasted `url`; the answer's `url` is not used. The finish is
   **one commit**: on a team board the adapter writes the rectangle (`x`, `y`, `width`, `height`, one shared value)
   and the finish keys in **one shared-document transaction** (sync v18). A single-user board commits the finish
   without recording it (`commit(next)`); a team board commits it as an **arrival** (sync v18: `arrivalOf`).

   **A move by another person at the same instant (team).** When another person's move of the card is concurrent
   with the finish, the two edits merge; both outcomes are **accepted**: either the finish's rectangle wins (the card
   is finished at the place the paster's board held, and that move is lost), or the move's rectangle wins (the card is
   finished at the moved place and keeps the loading size, 306 × 288, which is a valid card size; its face is drawn
   inside it). Neither is refused by the room, and neither is repaired later. Sync v18 **Verification** proves both
   arrival orders with two clients.
6. **Not an undo step.** The finish amends the paste's undo history instead of adding a step:
   - single-user: the browser writes the eight finish keys into every version of that card (the same `id`, `url` and
     `requestedAt`) held in the board's undo history, past and future, each version keeping its own `x`, `y` and
     every other key; a version whose `x` or `y` would put the new size across the document bounds is shifted left
     and/or up just enough. So no undo or redo ever brings back the loading look, and a move made while the card
     loaded keeps both its positions;
   - team: sync v18's `SharedUndo.amend`. A step this person made while the card loaded whose entry the arrival's
     values changed follows the existing stale-guard rule: a move's `geometry` entry holds the card's `width` and
     `height` too, so when the finish changes the card's size, that move **may no longer undo** after the arrival
     (accepted; when the finished size is the loading size, 306 × 288, it undoes as usual).
7. **Deadline.** If the finish has not been made by `requestedAt + 20,000` ms, the browser aborts what is still
   running (the request or the upload) and makes the link-only finish (with the same gate and holds).
8. **Held, never mid-gesture.** A finish waits while the paster is in a pointer gesture, composing or editing text,
   Tidy up is open, or the board cannot take an edit for a passing reason (the existing editing command reason is not
   empty; on a team board, also while `hosted.canEdit` is false: reconnecting, rejoining or recovering; a version
   preview holds at the gate instead, with its own 15,000 ms limit). On a single-user board a read-only board is not a
   passing reason: it means the writer was lost, and the gate cancels. It is made at the first moment after all of
   these end. If that moment is past the deadline, the link-only finish is made instead.
9. **Refused by the room (team).** When an arrival's edit is refused, whether the session refuses it before sending
   (too large) or the room answers `refused`, the session's existing refusal handling runs (the edit is dropped and
   the board rejoins), but **no notice shows**: the hosted board's refusal toast (`words.refusedEdit`) is not shown
   for an arrival's request. What the paster's browser then writes is sync v18's **one retry** rule, stated there
   once: one silent link-only finish, then nothing more.

**Undo and Redo around an arrival.** Each sequence below is checked by name (web modules v50 **Tests**, sync v18
**Verification**). "Finished" is the card with its finish keys; positions are its own top-left.

| Sequence | Single-user board | Team board |
| --- | --- | --- |
| paste → arrival → Undo → Redo | Undo removes the finished card; Redo brings it back finished | Undo removes the finished card; Redo restores it finished, under a fresh `id` (as today) |
| paste → move → arrival → Undo → Undo → Redo → Redo | Undo 1 moves the finished card back; Undo 2 removes it; Redo 1 brings it back finished at its pasted place; Redo 2 moves it again | When the finish changed the size: Undo 1 is refused with today's changed-by-others notice and that step is gone; Undo 2 removes the finished card; Redo 1 restores it finished at its moved place under a fresh `id`; Redo 2 has nothing to redo. When the size did not change, as single-user |
| paste → Undo before the arrival | The card is removed; an arrival that reaches its finish now finds no card and writes nothing. Redo brings the loading card back under its **same** `id`: if the arrival has not yet reached its finish, it finishes that card; if it already ended, the card stays `loading` | Redo restores the loading card under a **fresh** `id`, so the arrival never finds it; it stays `loading` |
| paste → Change back to text → Undo → arrival (the conversion and its Undo both before the arrival) | The arrival **applies**: Undo restored the card under its same `id`, `url` and `requestedAt`, still `loading`, so the gate and the finish find it; the finish is also written into the conversion's versions, so Redo and Undo of the conversion keep the finished card | The arrival is **dropped**: Undo restored the card under a fresh `id`, so the gate finds no card with the arrival's `id` and writes nothing (no upload if the gate runs before it); the card stays `loading`, is drawn link-only once stale, and is never fetched again |
| Change back to text → arrival → Undo | The arrival finds no card and writes nothing; Undo restores the loading card, which stays `loading` | The same, under a fresh `id` |

A card left `loading` this way is **never fetched again**; it is drawn link-only once 20,000 ms are past its
`requestedAt`. The single-user rows are checked in web modules v50 **Tests** and the team rows in sync v18
**Verification**, each sequence separately for the two modes.

**Stale cards.** A card can be left loading (the paster closed the tab, an arrival ended or was dropped, or a copy was
made while it loaded). Nothing is written for it (document v22 rule 5, sync v18): every browser draws the link-only
face **inside its stored rectangle** (306 × 288, **Drawing at the stored size**) and offers the link-only bar; the
stored rectangle is its hit area, its selection outline and the bar's anchor, so what is seen, clicked and outlined
agree. An edit a person makes to it other than moving, arranging, grouping, sectioning or deleting (a layout choice)
writes it as `state: "linkOnly"` with the link-only size (480 × 64), its top-left kept (except for the document
bounds shift), in that same edit. Change back to text works on it as on any card.

**No notices.** Pasting a card or a text object, every finish, every failure and a refused arrival show no notice,
toast or error text. There is no retry control.

#### The thumbnail (LC8)

Made in the paster's browser from the answer's picture bytes:
- The type is sniffed from the bytes with the existing picture sniffer (PNG, JPEG, GIF, WebP); anything else means no
  picture. It is decoded with `createImageBitmap`; a GIF gives its **first frame**.
- Scale `s = min(1, 640 ÷ max(width, height))`; the thumbnail is `max(1, round(width × s))` × `max(1, round(height ×
  s))`: at most **640** on its longer side, never enlarged. It is drawn on a canvas with high-quality smoothing.
- It is encoded as **PNG** when any pixel of the drawn thumbnail has alpha below 255, otherwise as **JPEG at quality
  0.85**. The stored picture is `{ bytes, mime, pixelWidth, pixelHeight }` of the encoded thumbnail, named by the
  SHA-256 of its bytes, like any other picture (its type sniffed again equals `mime`).

#### The card's looks (LC2)

The approved mock-up drew each card as a CSS box with `box-sizing: border-box` and `border: 1px solid #e3e1e6`, so its
picture, dividers and body sit **inside the border**. Every value below is that approved box translated to canvas
coordinates, offsets from the card's top-left corner (its saved `x`, `y`), the 1-unit border already counted.

Common to every look:
- **Frame.** A rectangle of the look's size with corner radius **8**, filled `#ffffff`, and a **1-unit border**
  `#e3e1e6` lying inside the rectangle: drawn last, as a stroke of width 1 on the rectangle at 0.5, 0.5 of
  `width − 1` × `height − 1`, radius 7.5. No shadow.
- **Inner box.** The rectangle inside the border: 1, 1, `width − 2` × `height − 2`, corner radius 7. The picture, the
  dividers and every fill are clipped to it; nothing is drawn under the border.
- **Type.** Font family `system-ui`. Title: 14, line height 20, weight 600, `#1e1c22`. Description: 12, line height
  17, weight normal, `#5f5b66`. Site: 12, line height 16, `#5f5b66`, underlined. Address (link-only): 13, line height
  16, `#3d3942`, underlined. A text's position is the top of its first line box (Konva `Text` at that `y` with
  `lineHeight = line height ÷ font size`).
- **Underline.** The site and the address are underlined by a filled rectangle the card draws itself (not Konva's
  `textDecoration`): 1 unit tall, in the text's colour, from the text's left edge for the width of the drawn text (its
  ellipsis included), with its top edge **2 units below the text's alphabetic baseline** (the approved
  `text-underline-offset: 2px`). For a one-line text whose line box top is `t` and line height `L`, the baseline is
  `t + L ÷ 2 + (A − D) ÷ 2`, where `A` and `D` are the canvas `measureText` result's `fontBoundingBoxAscent` and
  `fontBoundingBoxDescent` in that font (the CSS line-box rule). In the approved capture the site's underline is the
  row 14 units below the site row's top.
- **Text cuts.** Text wraps at word boundaries (a word longer than the line breaks between characters) to the box
  width given, and is cut to the stated number of lines; a cut ends with an ellipsis (`…`). One-line texts never wrap.
- **Link glyph.** 14 × 14: the paths `M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1` and
  `M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1` in a 24-unit box scaled to 14, stroked `#8a8590`,
  width 2 (in the 24-unit box), round caps, no fill. It is centred on the 16-unit site row (its top 1 unit below the
  row's top) and its text starts 20 units right of the glyph's left (14 + a 6-unit gap). It stands in place of a site
  icon; no favicon is fetched.
- **Picture.** The card's `asset` picture, **cover-cropped** into its box: scaled by `max(boxW ÷ pixelWidth, boxH ÷
  pixelHeight)` and centred, the overflow cut. Until the picture is decoded (or if it never loads), its box is filled
  `#f1f0f3`, with no text.
- **Selection.** See **Selection, handles and keys**.

| Look | Parts (offsets from the card's top-left, inside the border) |
| --- | --- |
| loading | Picture box 1, 1, 304 × 159 filled `#f1f0f3`; a divider 1, 160, 304 × 1 `#efedf1`. A **spinner** centred at 153, 80.5 (the picture box's centre): a ring of radius 9.75, stroke 2.5, `#d8d5dc`, and over it an arc of the same ring in `#7051cf` spanning the top quarter (from −135° to −45°, 0° pointing right); it is still, not animated. Three bars, each 10 tall, radius 5, `#eeedf0`, at x 15: y 177 width 171, y 197 width 254, y 217 width 204 (62%, 92% and 74% of 276, rounded) |
| vertical | Picture 1, 1, 304 × 159; divider 1, 160, 304 × 1 `#efedf1`. Title at 15, 173, box width 276, at most 2 lines. Description at 15, `177 + 20·Lt`, width 276, at most 2 lines (none when empty). Site row top at `height − 25`: glyph at 15, `height − 24`; site text at 35, `height − 25`, width 256, one line |
| horizontal | Picture 1, 1, 111 × 112; divider 112, 1, 1 × 112 `#efedf1`. Title at 127, 11, width 338, one line. Description at 127, 35, width 338, one line (none when empty). Site row top at 87: glyph at 127, 88; site text at 147, 87, width 318, one line |
| title-only vertical | No picture, no description. Title at 17, 17, width 272, at most 2 lines. Site row top at 67: glyph at 17, 68; site text at 37, 67, width 252, one line |
| title-only horizontal | No picture, no description. Title at 17, 11, width 446, one line. Site row top at 37: glyph at 17, 38; site text at 37, 37, width 426, one line |
| link-only | Glyph at 17, 25; the card's full `url` at 37, 24, width 426, one line, in the address style. No title, picture or error text |

How the rows follow from the approved box: vertical body padding 12 / 14 / 14 below a 160-unit picture box that
includes its 1-unit divider (so the title starts at 1 + 160 + 12 = 173 and x 1 + 14 = 15), a 4-unit gap between
title, description and site, and 8 more above the site row; the content-fit height `210 + 20·Lt + (Ld > 0 ? 4 +
17·Ld : 0)` (230, 250, 251, 268, 271 or 288, kept) then leaves 8 units of padding below the site row, as the approved
288 capture shows. Horizontal: a 112-unit picture box that includes its 1-unit divider, body padding 10 / 14, the site
row at the bottom (113 − 10 − 16 = 87). Title-only vertical: padding 16, the site row at the bottom (99 − 16 − 16 =
67). Link-only: padding 16 left, the row centred in the inner box (1 + (62 − 16) ÷ 2 = 24). The title-only horizontal
look was not drawn in the mock-up; it takes the horizontal body's vertical padding (10) and the title-only look's
side padding (16).

A drawn line count is measured with the canvas's own wrapping in the font above (title box 276 wide; description box
276 wide). The site shown is the card's `site`.

#### Drawing at the stored size

The look (state, `asset`, `layout` and the stale rule) chooses the **face**; the stored rectangle `W × H` is its
frame. The values above are each look's at its written size (`w × h`, the looks table). At any other card size
(document v22) the same face is drawn in `W × H` by these rules, which give exactly the values above when `W × H` is
the written size:
- the frame and the inner box use `W` and `H` (as above); everything is clipped to the inner box;
- every left offset is kept; every box width (a text box, the vertical picture box and its divider, a loading bar)
  becomes its value plus `W − w`; the horizontal look's picture box and divider keep their left-hand place and width;
- rows measured from the top (the vertical picture box and divider, the title, the description, the loading bars and
  spinner) keep their offsets; the site row is anchored to the bottom, at `H − (h − its top)` (vertical:
  `H − 25`; horizontal and title-only horizontal: `H − 27`; title-only vertical: `H − 33`); the horizontal picture box
  and divider are `H − 2` tall;
- the link-only face's row is centred in the inner box: its top is `(H − 16) ÷ 2` and the glyph's top 1 unit below it,
  its left padding 16 (the address at 37, its box `W − 54` wide). A stale card at 306 × 288 so shows its address at
  37, 136 in a 252-unit box;
- a vertical face's line caps come from its stored height when it is one of the six content-fit heights (above), and
  are 2 and 2 at any other height.

The selection outline, the hit area and the bar's anchor are the stored rectangle in every case.

#### Selection, handles and keys

- **Outline.** A selected card is outlined like a picture: a rectangle at its stored rectangle, stroke `#518de0`,
  **2 screen pixels** at every zoom (`2 ÷ zoom` units), square corners, centred on the edge.
- **No resizing when a card is selected.** When **any** selected object is a card, no resize handles are shown and
  the selection cannot be resized by any path, for any role, in any look: neither its cards nor its other objects.
  The Objects panel's Wider, Narrower, Taller and Shorter are then disabled with the title `Link cards can't be
  resized.` (washi tape's text `Washi tape can't be resized.` wins when the selection also holds tape). Selections
  without cards keep today's handles and resizing, the tape and mind-node restrictions included (document v22 rule
  1). A card moves, arranges, joins sections, groups and pages as a picture does; it is never a connector end
  (document v22 rule 2).
- **Keys.** Delete and Backspace delete the selected cards (the existing Delete command and its text). Enter and a
  double-click do nothing on a card (as on a picture: there is no text to open). Cmd/Ctrl+C, X, V and D use the
  existing object clipboard and Duplicate; a copied card's plain text is its `url`, so a pasted copy is Board's own
  copy and is pasted as a card without asking again. A copy keeps every key, `state` and `requestedAt` included.

#### The context bar (LC3)

The existing context bar (`.context`) shows the link bar when **every** selected object is a card. A selection mixing
cards and other objects shows the generic bar exactly as today (label `<n> objects`, no link buttons).

| Selection | Bar, left to right |
| --- | --- |
| One card, loading look | `Link` · divider · **Open link** · **Change back to text** · the existing Arrange, Move to page (when shown today), Duplicate and Delete |
| One card, any other look | `Link` · divider · **Open link** · **Display vertical** · **Display horizontal** · **Change back to text** · Arrange, Move to page (when shown), Duplicate, Delete |
| Two or more cards | `<n> links` (for example `2 links`) · divider · Arrange, Move to page (when shown), Duplicate, Delete |

Tidy up is not shown on a link bar. The label is a `<span>` as the picture bar's `Image` is, followed by the existing
`<span class="divider">`. The bar is placed over the selection's stored rectangle, as for any object.

**Narrow windows.** When the context bar is not shown (below 768 px wide, or when it does not fit), as today for every
object, the link commands, like every bar command, are not offered: no other route offers Open link, the layout
buttons or Change back to text. This is a stated limit of this version; Delete, Duplicate and the keys keep their
existing routes.

**Buttons.** Each new button is the bar's existing `button.icon-button` (40 × 40) with an SVG icon of 20 × 20
(`viewBox="0 0 24 24"`, `fill="none"`, `stroke="currentColor"`, `stroke-width="1.8"`, `aria-hidden="true"`) and the
existing `<span class="tooltip">`:

| Button | `aria-label` and tooltip | Icon |
| --- | --- | --- |
| Open link | `Open link` | path `M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5`, round caps and joins |
| Display vertical | `Display vertical` | rect 6, 3, 12 × 18, `rx` 2; path `M6 11h12`; path `M9 15h6M9 18h4` with round caps |
| Display horizontal | `Display horizontal` | rect 2.5, 7, 19 × 10, `rx` 2; path `M9 7v10`; path `M12 10.5h6M12 13.5h4` with round caps |
| Change back to text | `Change back to text` | paths `M4 7V5h11v2M9.5 5v13M7.5 18h4` and `M15 14h5M18 11.5l2.5 2.5-2.5 2.5`, round caps and joins |

The two layout buttons sit together in one horizontal, labelled group, `<span class="link-layout" role="group"
aria-label="Link layout">`. The one matching the card's `layout` has `aria-pressed="true"`, the other
`aria-pressed="false"`. The group and the pressed button are drawn by exactly two new CSS rules, placed together
after `.context .paint-modes button[aria-pressed=true]` in `apps/web/style.css`:

```css
.context .link-layout { display: flex; align-items: center; gap: 4px; }
.context .link-layout button[aria-pressed=true] { background: #7051cf; border-radius: 6px; }
```

The first lays the pair out as a row with the bar's own 4 px gap, so the label, divider and all four link buttons
stand 4 px apart as in the approved bar (the mock-up placed them straight in `.context`, whose `gap` is 4px). The
second gives the pressed button the approved purple square with 6 px corners; its white icon comes from the existing
`button[aria-pressed=true]` rule. **Hover** is the bar's existing one, unchanged: an unpressed button gets the
`#f1eff5` background and a `#29272e` icon (`button:hover…` and `.context button:hover:not(:disabled)`); a pressed
button keeps its purple background and its icon turns `#29272e`, as the approved hover capture shows. No other rule
is added or changed.

**Enabled.** Open link is always enabled, for every role. Display vertical, Display horizontal and Change back to
text are disabled whenever the existing selection reason is not empty (a viewer, read-only, composing, a gesture);
then their tooltip shows that reason, and each carries `aria-describedby="selection-reason"`, as the bar's other
editing buttons do. Arrange, Duplicate and Delete keep their existing rules.

**Link-only look.** Both layout buttons are shown and the pressed one is the card's `layout` (`horizontal` after a
link-only finish). Choosing the other records the new `layout` (an undo step) while the link-only look stays 480 × 64
(there is one link-only look). On a stale card the choice also writes it link-only, as **Stale cards** says.

#### What the buttons do

- **Open link (LC6):** `window.open(url, "_blank", "noopener,noreferrer")`. Nothing is written, nothing is fetched by
  Board, and no notice shows. Viewers may use it.
- **Display vertical / Display horizontal:** one undo step setting `layout` and the size of the card's new look, its
  top-left (`x`, `y`) kept except for the document bounds shift. The browser that writes a vertical size measures
  `Lt` and `Ld`. Choosing the current layout does nothing.
- **Change back to text (LC5):** one undo step that removes the card and adds one **text object** in its place:
  - `text`: the card's `url`; no marks;
  - `x`, `y`: the card's saved top-left, kept within the document bounds (a card near the right or bottom edge
    gives a text object shifted left and/or up just enough); width **320** (the text tool's default width); height
    the existing grown height of that text in that width (as a text object's height grows with its lines);
  - text size **Medium**, colour neutral, alignment left (the text tool's defaults);
  - the card's page, section and group, and its place in the stacking order.

  The text object is selected and not opened for editing, and **focus moves to the canvas** (the scene element
  inside `<main>`, as Delete returns it), because the pressed button is removed with the link bar: an immediate
  Cmd/Ctrl+Z then reaches `<main>`'s key handler and undoes the conversion. One Undo removes the text object and
  restores the card
  exactly, thumbnail included (its picture stays held). It works in every look, loading included. A loading card
  changed back is gone, so an arrival that reaches its finish then finds no card with its `id` and `url` and writes
  nothing. Undo restores the card under its same `id` on a single-user board (an arrival that has not yet reached
  its finish still finishes it) and under a fresh `id` on a team board (no arrival ever finishes it); a restored card
  left `loading` is drawn link-only once 20,000 ms are past its `requestedAt` and is never fetched again (**Undo and
  Redo around an arrival**).

#### Viewers (LC6) and roles

Owners and editors (and board guests with an editor grant) paste cards, use the layout buttons and Change back to
text. A **viewer** who selects a card sees the same bar with only Open link enabled: both layout buttons (the current
one pressed, dimmed as disabled buttons are), Change back to text, Arrange, Duplicate and Delete are disabled, and no
handles show. A viewer's Cmd/Ctrl+V of an address adds nothing (today's path). The team route refuses viewers (access
v17); viewers' browsers never ask the preview service and never write a card.

#### The About line (LC9)

The About popover (the bottom-left "i", `section.information-panel`, label `About local storage`) keeps its existing
paragraph and gains a **second `<p>`**, directly after it, with no class and no inline style:

| Board | Second paragraph |
| --- | --- |
| Single-user board, with a preview service | `Links you paste are read by Board's link preview service, which fetches each page's title, description and picture. Only the link is sent, never your board.` |
| Single-user board, no preview service | None (the popover is as today) |
| Team board, every role | `Links pasted on team boards are read by Board's server, which fetches each page's title, description and picture. Only the link is sent.` |

Its look is the existing paragraph's, from existing rules only: 14 px `system-ui`, `#29272e`. The gap between the two
paragraphs is **14 px**: the first paragraph's default bottom margin (1em at 14 px), with `margin-top: 0` on the new
one from `.information-panel p`. That is the spacing the approved capture shows: the capture gave its added line an
inline `margin-top: 8px`, which collapses with the first paragraph's 14 px bottom margin, so the gap drawn was 14 px,
not 8. No margin, class or inline style is added. There is no consent prompt.

#### Accessibility

The new buttons are labelled buttons with tooltips; the layout pair is a labelled group with `aria-pressed`. No focus
moves on paste, arrival or a layout change; after Change back to text the selection moves to the text object as any
command's result does and focus moves to the canvas (above), so the keyboard keeps working. No live region or notice
is added. Below 768 px the link commands are not offered (**Narrow windows**).

#### Not in this version (link cards)

Interactive embeds, oEmbed and any HTML from a site; a native import from other whiteboard tools; a favicon; a retry control or any
failure notice; a consent prompt; hyperlinks inside text objects (see **Links in text**); pasting plain non-address text as text; resizing a
card; Open link, layout or Change back to text for several cards at once, or when the context bar is not shown (narrow
windows); an animated spinner; a server-side cache of previews; repairing a card whose concurrent move and finish
merged (both outcomes are accepted).
