# 0001 — Web app modules

Note version: 52 (for 0011-W3 brief v1, 2026-11-27). Status: Draft.
Replaces [web modules v51](0001-web-modules-v51.md), whose registry, import, composition, one-state-owner, team
guards, counts, seams, CSS and App.tsx rules remain word for word except as below. v51's own text follows as the part
**Links in text (v51)**, word for word with its headings one level lower.
[Interaction v54](0001-interaction-v54.md) lets tables be arranged (several cells, rows or columns chosen at once,
insert points, moving, duplicating, merging and splitting), [document v24](0001-document-v24.md) adds a table's
`merges` and schema version 18, and [sync v20](0003-sync-v20.md) adds the shared `mergeMap`. They take **four new web
source modules**: two web rules modules, one state hook and one screen part. The rules package gains **no file** (its
table rules stay in `objects/table.ts`). **App.tsx changes only by its wiring points** (below), on existing lines, so
its line count and budget stay; `style.css` gains **seventeen rules**, placed right after the existing table block.

## Change note (v51 → v52)

- New part **Arrange table cells (v52)**: the four modules and their exported names, the changed files (web, rules
  package, sync, room and server), App.tsx's exact substitutions, the seventeen CSS rules and where they go, the new
  hook (no effect), the guards and counts, and where the unit tests go.
- Every current-schema mention of v51 that says 17 now says 18 (the newest schema is document v24's 18): the board
  list's `newer` test and the board file's newer test are `schemaVersion > 18`, and the decode paths accept what
  document v24's `validate` accepts (schema 1–18). The rest of v51's text is kept as written; read its "17" as the
  schema of its own version.
- Counts: **31 state hooks**, 22 scene parts, **38 screen parts**, the rules package's 19 files and 13 object-type
  modules; 57 team modules and the board-sync list unchanged.
- Nothing else in v51 changes.

## Arrange table cells (v52)

Every value the new and changed modules hold (words, sizes, colours, distances, reasons) is interaction v54's
(**Arranging table cells**, rules AT1–AT20), document v24's (**Saved document (version 18)** and **Table rules in
`objects/table.ts`**) or sync v20's (**Merged cells**). This part says only where each lives and how it is wired.
Every new file begins with `// SPDX-License-Identifier: Apache-2.0`. Line counts below are measured at public main
`8fd36fb`; only `App.tsx` has a line cap (264), and no file named here is near another limit.

**Words.** Row, column, index, merge, anchor, covered cell, span, run, gap, grown, wholly inside, partly overlaps and
strictly inside are document v24's **Terms**; reading order, anchor cell, count and ⌘ are interaction v54's **Terms**
and AT1. The rules package's names used below are document v24's: `TableMerge`, `CellRange` (`{ from, to }`, two
opposite corners), `TableBounds` (`{ top, left, bottom, right }`, indices, inclusive), `TableRefusal` (`"invalid"`,
`"notRun"`, `"edge"`, `"merge"`, `"limit"`, `"single"`), `mergeOf`, `rangeBounds`, `canMerge`, `mergeRange`,
`splitMerge`, `canMove`, `moveAxis`, `canDuplicate`, `duplicateAxis`, and `insertAxis(t, axis, id, at?, size?)`.

### New modules

**`apps/web/src/table-selection.ts`** — a web rules module for choosing several cells, rows or columns (AT1, AT2,
AT3): no React, Konva or `react-dom` import, no value import from `team/`, no `.tsx` import, every relative import
written with its `.ts` extension (so unit tests load it under Node), no `sticky` word and no type-name comparison. It
imports values only from `nextphase-board-rules/objects/registry.ts` (`cellAt`, `cellIndex`, `mergeOf`,
`rangeBounds`, `neighbourCell` and types) and **types only** from `./table.ts` (`TableSelection`), so no module cycle
exists at run time (`table.ts` imports its values).

| Export | What |
| --- | --- |
| `boundsCells(t, b: TableBounds)` | The addresses of the cells in `b` in reading order, a merged cell once (by its anchor) |
| `selectionAnchor(t, s)` | AT1's **anchor cell**: a cell → itself; a range → `s.anchor`; a set → its first cell in reading order; rows → the first chosen row's cell in the first column; columns → the first chosen column's cell in the first row; a row, a column and the table → today's `anchorCell` answer; a covered cell → its merge's anchor |
| `rangeSelection(t, id, anchor, focus)` | `{ kind: "range", id, anchor, focus }`, or `{ kind: "cell", id, ...cell }` when `rangeBounds(t, { from: anchor, to: focus })` holds exactly one cell or exactly one merged cell (its anchor) (AT1) |
| `selectionCells(t, s)` | The chosen cells in reading order, a merged cell once by its anchor: range → `boundsCells` of its grown rectangle; set → its cells; cell → that cell; row, rows, column, columns → every cell of them; table → every cell |
| `chosenIds(t, s, axis)` | The row (column) ids an axis action acts on, in the current table order (AT6 **What they act on**): `rows` (`columns`) → its ids; `row` (`column`) → that id; any other kind → the row (column) of `selectionAnchor` (a Cell bar's menu) |
| `axisSelected(s, axis)` | True only when `s` is a `row` or `rows` (for `"row"`) or a `column` or `columns` (for `"column"`): an actual selection on that axis (the drag reuses a run only then) |
| `isRun(t, axis, ids)` | True when `ids` are consecutive in the current order |
| `chooseHow(e, mac)` | AT2's terms: `"range"` for a ⇧-click (Shift, no Alt, Cmd or Ctrl); `"toggle"` for a ⌘-click (Cmd on a Mac, Ctrl elsewhere; no Shift or Alt); else `undefined`. `e` is `{ shiftKey, altKey, metaKey, ctrlKey }` |
| `chooseCell(t, s, cell, how)` | AT2 for a cell of the same table while a cell, range or set is selected (a covered `cell` counts as its anchor): `"range"` → `rangeSelection(t, s.id, selectionAnchor(t, s), cell)`; `"toggle"` → `selectionCells(t, s)` with `cell` added or removed, answered as a set of 2 or more (`{ kind: "cells", id, cells }`, reading order), a single cell, or `{ kind: "table", id }` when none is left. With rows or columns selected it answers that single cell (another kind starts again) |
| `chooseAxis(t, s, axis, id, how)` | AT2 for a grabber: with a row or rows selected (column or columns for a column grabber), `"range"` → every row from the selection's **start row** to `id`, inclusive, in table order; `"toggle"` → `id` added or removed, the start becoming `id`; answered as `rows` (`columns`, 2 or more), a single `row` (`column`), or the table when none is left. Any other kind, or `how` `undefined` → that single row (column), its own start |
| `moveFocus(t, s, arrow)` | AT3 from a cell or range: the focus moves one cell by document v24's `neighbourCell` (stopping at the edges, leaving a merged cell's span, landing on a merged cell's anchor), answered through `rangeSelection` from the same anchor (a cell is its own anchor) |
| `keepSelection(t, s)` | AT1 **Changes from elsewhere** against the current table: ids that are gone drop out of a set, rows or columns (one left: that single item; none: the table); a range whose `anchor` or `focus` row or column is gone becomes the table; a selected cell, or a set's cell, that has become covered becomes its merged cell (duplicates removed); a range is grown again. When a rows or columns selection's `start` is gone, the first remaining chosen id in table order replaces it. It answers **the same object** when every chosen id still exists and no chosen cell is covered (it never re-sorts, so a move, insert or duplicate keeps the object). Order is never read from the stored lists: `selectionCells`, `selectionAnchor` and `chosenIds` derive reading order and table order from the current table on each use |
| `mergeTarget(t, s, axis?)` | AT13's **merge rectangle** as a `CellRange`, or `undefined` when the selection is not mergeable: a range (its corners); one row or column (its first and last cells); rows or columns forming a run (their first and last cells). With `axis` (a menu's Merge cells, AT6) it is the whole rows (columns) of `chosenIds(t, s, axis)`. `undefined` for a single cell, a set of cells and rows or columns that are not a run. Whether it holds two or more cells is `canMerge`'s `"single"` |
| `countText(t, s)` | AT5's count: `<N> cells` (a merged cell once), `<N> rows` or `<N> columns`, `N` in en-US grouping; `""` for other kinds |
| `selectedText(t, s)` | AT18's `<N> cells selected`, `<N> rows selected` or `<N> columns selected`; `""` for other kinds |

**`apps/web/src/table-arrange.ts`** — a web rules module for the bars' and menus' states, the actions, the hovered
controls and the drag's geometry (AT5–AT13), under the same rules as `table-selection.ts`. It imports values from
`nextphase-board-rules/*` (`objects/registry.ts`: `insertAxis`, `deleteAxis`, `setCell`, `mergeOf`, `rangeBounds`,
`canMerge`, `mergeRange`, `splitMerge`, `canMove`, `moveAxis`, `canDuplicate`, `duplicateAxis`, `cellIndex`, `cellAt`,
`cellText` and types; `document.ts` types), `./table.ts` and `./table-selection.ts`, and types only from
`./selection.ts`, `./resize.ts` and `nextphase-board-sync/document-adapter.ts` (`TableOrderHint`).

| Export | What |
| --- | --- |
| `ARRANGE_WORDS` | Every text of interaction v54's **Words**: `{ cells: "Cells", rows: "Rows", columns: "Columns", merge: "Merge cells", mergeTip: "Merge cells ⌥M", split: "Split cell", splitTip: "Split cell ⌥M", blocked: "A merged cell is in the way", single: "Already a single cell", merged: "Cells merged", splitDone: "Cell split" }` and, as functions of `axis` (and a count or index), the menu items (`move(axis, by, several)`: `Move row up` … `Move columns right`; `duplicate(axis, several)`; `remove(axis, several)`: `Delete row` … `Delete columns`; `heading(axis, several)`: `Row`, `Rows`, `Column`, `Columns`), `insertTip(axis)`, `insertName(axis, gap)` (`Insert row between rows N and N+1`, N = `gap`), `inserted(axis)`, `first(axis)` / `last(axis)` (`Already the first row` …), `apart(axis)` (`Choose rows next to each other` / `Choose columns next to each other`), `moved(axis, from, to)` (`Row moved to row N`, `Rows moved to rows N–M`, …, 1-based in the new order, an en dash) and `duplicated(axis, several)` |
| `type ArrangeRefusal` | `{ code: TableRefusal \| "cells"; reason?: string }`: why an action cannot run (`"cells"`: the board-wide cell limit), kept apart from its display text; `reason` is absent only for `"invalid"` (ids not in the table, never offered by a control) |
| `BOARD_CELLS_REASON` | `"A board holds at most 5,000 table cells."`, the existing words of `use-board-document.ts`' commit check |
| `arrangeRefusal(t, s, action, cells)` | `ArrangeRefusal \| null` (`null`: the action can run); `cells` is the board's table cell count (document v24's `tableCellCount` of every page). It is the **one** refusal function: the bar buttons, menu items, insert points, ⌘D, the ⌥-add shortcuts (⌥↩, ⌥⇧↩, ⌥[, ⌥] for every kind) and Delete all ask it. Adding entries (Add, Insert, Duplicate) is checked in this order: `"cells"` when the new entries (one, or the run's length) would bring `cells` above 5,000; `"limit"` (the axis limit's existing words, `A table holds at most 50 rows` / `A table holds at most 20 columns`) when they would pass 50 rows or 20 columns; then, for Duplicate, `canDuplicate`'s `"notRun"` and `"merge"`. A Move by one goes through `canMove(t, axis, ids, by < 0 ? first − 1 : last + 2)` and a drag move through `canMove(t, axis, ids, to)` (the actual drop gap). Merge: `"notRun"` for rows or columns that are not a run, else `canMerge(t, mergeTarget(...))`. Delete: `"limit"` with today's words (`A table needs at least one row` / `…column`) when the number of chosen entries is at least the live axis count, checked before anything is deleted. Words: `"notRun"` → `apart`, `"edge"` → `first` or `last`, `"merge"` → `blocked`, `"single"` → `single`, `"cells"` → `BOARD_CELLS_REASON`. Bars, menus, dots, keys and `arrangeTable` all use it; a control is disabled exactly when it answers a refusal, and shows its `reason` |
| `type TableMenuItem` | `{ action: TableAction; name: string; key: string; disabled: boolean; reason?: string; danger: boolean; separatorBefore: boolean }` |
| `axisMenu(t, s, axis, mac, cells)` | `{ heading: string; items: TableMenuItem[] }`: AT6's heading and items, in order, singular or plural by `chosenIds(t, s, axis).length`, each with its key text (`⌘D` when `mac`, else `Ctrl+D`; the Move items none) and `arrangeRefusal(...)?.reason` as `reason` (an item is disabled when the refusal is not `null`); the Merge cells item's action is `{ at: "merge", axis }`; Delete is `danger` |
| `mergeShown(t, s)` | AT5: true for the Row, Column, Rows and Columns bars and a range's Cells bar; false for a set's Cells bar and every other bar |
| `type TableHover` | `{ row?: string; column?: string }` |
| `hoverTarget(t, layout, p, zoom)` | AT8: the row whose drawn span holds `p.y` while `p.x` is from `40 / zoom` left of the table's drawn left edge to its right edge; the column whose span holds `p.x` while `p.y` is from `40 / zoom` above its drawn top to its bottom |
| `type InsertDot` | `{ axis: TableAxis; gap: number; x: number; y: number; length: number; name: string; reason: string }`: AT9: `x`, `y` the dot's centre in board units (a row's border at `box.x − 14 / zoom`, a column's border at `box.y − 14 / zoom`), `length` the table's drawn width (rows) or height (columns) for the border line |
| `hoverControls(t, layout, s, hover, zoom, cells)` | `{ grabbers, dots }`: AT8's grabbers of the hovered row and column that `tableButtons` does not already give (same shape and place as its select grabbers, `selected: false`), and AT9's dot on each **inner** border of the hovered row and column (never gap 0 or n), each with `insertName` and, as `reason`, the `reason` of `arrangeRefusal` for that insert (the row limit, the column limit or `BOARD_CELLS_REASON`; `""` when enabled) |
| `dragStarts(t, axis, ids)` | False when the run partly overlaps a merge's span on that axis (AT11: such a run never starts a drag, so no ghost is drawn), or is not a run |
| `dropGap(t, layout, axis, ids, p)` | AT11's drop gap for the live table: the allowed gap whose border is nearest `p` along `axis` (a tie goes to the gap above or to the left). The run's own two borders and the gaps inside the run are allowed and are **own-place** gaps: a line, but no move |
| `ownPlace(t, axis, ids, gap)` | True for a gap from the run's first index to its last + 1 |
| `dropLine(t, layout, axis, gap, zoom)` | `[x1, y1, x2, y2]`: the gap's border across the table, reaching `4 / zoom` past each end |
| `dragGhost(t, layout, axis, ids, start, p, zoom)` | `Rectangle`: AT11's ghost: the run's drawn box (the table's drawn width × the run's drawn height; columns alike) moved along the axis by `p − start`, then `10 / zoom` right and `10 / zoom` down |
| `dragSquare(t, layout, axis, p, zoom)` | `Point`: AT11's square's centre: `p`'s position along the axis on the grabbers' line (`box.x − 14 / zoom` for rows, `box.y − 14 / zoom` for columns) |
| `type TableDragDrawing` | `{ table: string; axis: TableAxis; ids: string[]; gap?: number; ghost: Rectangle; square: Point }` |
| `type TablePointer` | `{ move(p: Point, e: { buttons: number; pointerType: string; target: EventTarget \| null }): void; leave(): void; dragging(): boolean; cancel(): void }`: what `useCanvasInput` calls |
| `type GrabberRef` | `{ axis: TableAxis; id: string }` |
| `type TableArrangeButtons` | `{ hover: TableHover; dragging?: GrabberRef; square?: Point; press(g: GrabberRef, e: PointerEvent, target: Element): void; move(e: PointerEvent): void; release(e: PointerEvent): void; lost(): void; key(e: KeyboardEvent): boolean; click(g: GrabberRef, e: MouseEvent): void; insert(axis: TableAxis, gap: number): void }`: what `TableButtons` calls (DOM event types; the scene part passes `nativeEvent` and `currentTarget`) |
| `type ArrangeResult` | `{ table: TableItem; selection: TableSelection; hint?: TableOrderHint; announcement: string } \| { refusal: ArrangeRefusal } \| null` |
| `arrangeTable(t, s, action, newId: () => string, cells: number)` | Runs one action as the table below states; `{ refusal }` when `arrangeRefusal` refuses; `null` when it would change nothing (clearing cells none of which holds text; a move to an own-place gap) |

`arrangeTable` takes the saved table `t` (as `model.current` holds it) and these actions:

| Action | Change (document v24) | Selection after | Announcement (AT18) | Hint (sync v20) |
| --- | --- | --- | --- | --- |
| `{ axis, at: "before" \| "after" }` (any cell-level kind: menus and the ⌥-add shortcuts) | One new entry (`newId()`) at the gap before the first (`before`) or after the last (`after`) of `chosenIds(t, s, axis)`, via `insertAxis` | The new entry's cell in the anchor cell's other axis, as a single add does today | `""` | `{ table, axis, moved: [id] }` |
| `{ axis, at: "delete" }` with rows or columns chosen | After `arrangeRefusal` has checked the chosen count against the live axis count, `deleteAxis` for each chosen id | The cell at the first chosen entry's index, clamped, as a single delete does today, and its merge's anchor when that cell is now covered | `""` | none |
| `{ at: "clear" }` with a range or set | Every chosen cell's text `""` (`setCell`) | Unchanged | `""` | none |
| `{ axis, at: "move", by: -1 \| 1 }` (AT10) | `moveAxis(t, axis, ids, by < 0 ? first − 1 : last + 2)` with `ids = chosenIds(t, s, axis)` | The same selection: moved rows or columns stay selected, and a Move from a Cell bar's menu keeps that **cell** selected (it moves with its row or column) | `moved` | `{ table, axis, moved: ids }` |
| `{ axis, at: "move", to: gap }` (AT11) | `moveAxis(t, axis, chosenIds(t, s, axis), gap)` (`gap` counted before the move) | The same ids, the same kind | `moved` | `{ table, axis, moved: ids }` |
| `{ axis, at: "duplicate" }` (AT12) | `duplicateAxis(t, axis, ids, newId)` | The copies (`row`, `column`, `rows` or `columns`) | `duplicated` | `{ table, axis, moved: copies }` |
| `{ axis, at: "insert", gap }` (AT9) | `insertAxis(t, axis, newId(), gap, size)`, `size` the set height of the row above the gap (width of the column to its left) | Unchanged | `inserted` | `{ table, axis, moved: [id] }` |
| `{ at: "merge", axis? }` (AT13) | `mergeRange(t, mergeTarget(t, s, axis))` | The merged cell (a `cell` at its anchor) | `merged` | none |
| `{ at: "split" }` (AT13) | `splitMerge(t, anchor)` of the selected merged cell | The range of its former cells (`anchor` the anchor, `focus` the bottom-right cell) | `splitDone` | none |

**`apps/web/src/state/use-table-arrange.ts`** — `useTableArrange(input: TableArrangeInput)`, returning
`{ pointer, buttons, drawing, dragging, cells, cancel }`:

| Returned | What |
| --- | --- |
| `pointer: TablePointer` | Hover from the canvas (`move`, `leave`), and the drag's state for the canvas (`dragging`, `cancel`) |
| `buttons: TableArrangeButtons` | The hovered row and column, the grabber drag and its square, grabber clicks and the insert points |
| `drawing: TableDragDrawing \| null` | While a drag is past its threshold |
| `dragging: boolean` | The same, for hiding the context bar (AT5) |
| `cells: number` | The board's table cell count, for the context bar and the dots |
| `cancel(): void` | Ends a press or drag with nothing written |

`TableArrangeInput` is `{ table?: TableItem & { tableLayout?: TableLayout }; selection?: TableSelection; choose:
(s: TableSelection, t: TableItem, announcement?: string) => void; action: (a: TableAction) => void; readOnly: boolean;
editing: boolean; busy: boolean; drag: RefObject<Drag | null>; setBusy: Dispatch<SetStateAction<boolean>>; board: { objects: readonly Item[] }; view: View; size: { w: number; h: number }; scene:
RefObject<HTMLDivElement | null> }`. `cells` is `tableCellCount(board.objects)` (every page; `board`
is App's whole board).
It holds the hover (state), the drag (state: its `GrabberRef`, the moved ids, the start point and the **latest pointer**) and the press (a
ref: `GrabberRef`, `pointerId`, start `clientX`/`clientY`, the target element, and whether the next `click` is to be
dropped).

- **Hover** (AT8). `move` acts only for `pointerType` `mouse` or `pen` with `buttons` 0; it keeps the hover as it is
  while `target` is inside a `.table-grabber` or `.table-insert` of the table, and otherwise sets it from
  `hoverTarget` when it changes; `leave` clears it. At render the hover is `{}` and its state is cleared (the pattern
  `useCanvasInput` uses for its hover) unless `table` and `selection` are set, `selection.id === table.id`,
  `!readOnly`, `!editing`, `!busy` and no drag is under way.
- **Press and drag** (AT11). `press` acts for the primary button (`isPrimary`, `button` 0) with no Shift, Alt, Cmd or
  Ctrl while `!readOnly`, `!editing` and `!busy` and no other gesture owns `drag.current`: it records the press and calls `target.setPointerCapture(e.pointerId)`.
  `move` (same `pointerId`) starts the drag once the pointer has moved 4 screen px or more **along the grabber's axis**
  (vertically for a row, horizontally for a column; movement across it does not count). It reuses the selection only when
  `axisSelected(selection, axis)`, the grabbed id is one of `chosenIds(table, selection, axis)` **and** those ids are
  a run (`isRun`); otherwise, at the threshold, it calls `choose` with the grabbed row (column) alone and moves it
  alone, keeping the captured button. The moved ids are captured then and carried to the release. **Gesture gate.** At
  the threshold the hook takes the shared gesture ownership the canvas and viewport already check: it sets
  `drag.current` to `{ id: <table id>, x, y, cx, cy, view, pan: false, pointerId, arrange: true }` and calls
  `setBusy(true)`, so canvas keys and commands (their `busy` and `drag.current` tests), wheel and pinch
  (`use-viewport.ts`' existing `drag.current` test) and page commands (`arranging`) are gated; every end of the drag
  (release, `lost()`, `cancel()`, Escape, a render-time end) clears `drag.current` when it is still its own and calls
  `setBusy(false)`. While it owns the drag, its own `busy` input is ignored.
  When `dragStarts` is false the press ends there: no drag, no ghost, and the next `click` is dropped. While dragging,
  each `move` stores the latest pointer (board units, from `scene`'s rectangle, `view` and `size` as `useCanvasInput`'s
  `point` is); `drawing` (`gap = dropGap(...)`, `ghost = dragGhost(...)`, `square = dragSquare(...)`) is computed at
  every render from the live table, the moved ids and that pointer, so a remote change redraws them. `release` (same
  `pointerId`) releases the capture and computes the drop gap again from the live table; when it is defined and not
  `ownPlace`, it calls `action({ axis, at: "move", to: gap })` once. A press released under the threshold is today's
  click; a press that crossed it marks the next `click` to be dropped. `lost()` (lost pointer capture or
  `pointercancel`) and `cancel()` end the press or drag with no action. `key(e)` answers `true` and cancels on Escape
  while dragging. At render a drag is ended with no action, as Escape ends it (its state cleared, the gate released), when
  `readOnly` or `editing` holds, the table or one of the moving ids is gone, or a live change makes the moved ids no
  longer a run or makes them cut a merge (`dragStarts` false); the selection then stays what it was when the drag
  started.
- **Clicks.** `click(g, e)` drops the marked click, and does nothing while a drag runs (a native activation of a
  focused grabber included); otherwise `choose(chooseAxis(table, selection, g.axis, g.id,
  readOnly ? undefined : chooseHow(e, isMac(navigator.platform))), table)` (a plain click selects that row or column as
  today; AT2). `insert(axis, gap)` calls `action({ axis, at: "insert", gap })`.

**Effects.** None: no passive and no layout effect (the window losing focus reaches it through `useCanvasInput`'s
existing blur listener, below). It imports `react`, `../table`, `../table-selection`, `../table-arrange`,
`../text-links` (`isMac`), `nextphase-board-rules/*` and types only from `../view`, `../geometry` and
`../selection`; never another state hook, `ui/` or `scene/`. It holds no `sticky` word and no type-name comparison.

**`apps/web/src/ui/table-menu.tsx`** — `AxisMenu({ axis, table, selection, cells, action })`, no hook or state, React
imported only for types. It is today's `AxisMenu` moved out of `ui/table-controls.tsx` with its open and close
(`toggle`), outside-press and focus-out closing and keyboard handling unchanged, and its heading and entries replaced
by `axisMenu(table, selection, axis, isMac(navigator.platform), cells)` (AT6): the heading (`Row`, `Rows`, `Column` or
`Columns`) in `.table-menu-heading`, then a `<div role="separator" />` before each item with `separatorBefore`, then
`<button role="menuitem" disabled={disabled} title={reason}>` (class `table-danger` when `danger`) holding
`<span>{name}</span><small>{key}</small>`, whose click closes the menu and calls `action(item.action)`. The menu
button's own name stays `Row options` / `Column options`. It imports `../table` (types), `../table-arrange`,
`../text-links` (`isMac`) and `../icons`.

### Changed files

Exactly these files change, each only as stated, with the four new modules above. This is the list the brief
carries.

**Rules package** (document v24; no new file):

| File | Change |
| --- | --- |
| `packages/board-rules/src/objects/table.ts` (141 lines) | **Table rules in `objects/table.ts`**: the types `TableMerge`, `CellRange`, `TableBounds` and `TableRefusal`; `TableKeys` gains `merges` after `cells`; new `mergeOf`, `rangeBounds`, `canMerge`, `mergeRange`, `splitMerge`, `canMove`, `moveAxis`, `canDuplicate`, `duplicateAxis`; `insertAxis` gains the optional last `size` and grows a merge whose span the gap lies strictly inside; `deleteAxis` shrinks merges and moves an anchor; `setCell` refuses text in a covered cell; `remapTable`, `canonicalTable` and `validTable` carry merges (**Saved document (version 18)**, merge rules 1–7); `createTable` returns `merges: []`; `nextCell` and `neighbourCell` treat a merged cell as one cell. The table record's `savedKeys` gains `"merges"` after `"cells"` |
| `packages/board-rules/src/objects/registry.ts` | `objectKeys("table", version)` leaves `merges` out below version 18 (**Object type module and registry**); it still re-exports `objects/table.ts` (`export * from "./table.ts"`) |
| `packages/board-rules/src/document.ts` | Schema 18 (**Reading version 1 to 17 documents**, **Types (v24)**): `TableItemV14`, `StoredItemV14 = ItemV13 \| TableItemV14`, `StoredItemV16`, `ItemV18`, `BoardV18`, and `ItemV12`–`ItemV16` and `BoardV12`–`BoardV17` as aliases of the version 18 ones; `Board["schemaVersion"]` and `Item` widened; `validate` accepts 1–18 and its link check refuses a mark's `link` only when `schemaVersion < 17` (today `!== 17`); `upgrade` adds `merges: []` to every table and sets 18; `empty` and `add` at 18 |

**Sync, room and server** (sync v20, API v18, team templates v6):

| File | Change |
| --- | --- |
| `packages/board-sync/src/codec.ts` | **Schema version 18 in the room** and **Merged cells › Reading**: `DecodedBoard` covers 10–18, its members for 14, 15, 16 and 17 built from `StoredItemV14`, `StoredItemV15`, `StoredItemV16` and `StoredItemV16` with `pages`, plus `BoardV18`; accepted versions 10–18; `readLiveBoard` returns `BoardV18` and requires 18; `readTable` receives the version and at 18 reads `mergeMap` (its refusals as `invalid_update`, entries in canonical order, orphan entries read last); the mark link check runs at version 17 or 18 (**Links in text**) |
| `packages/board-sync/src/document-adapter.ts` | **Merged cells › Writing**: `writeTable` creates `mergeMap` when missing, compares merges when deciding to write, deletes the entries no merge needs and sets only the entries that differ; a merge empties the covered cells' texts in the same transaction; a move's and a duplicate's `TableOrderHint.moved` go through `orderWrites` (one new order key per moved id when the table is fully initialised and its keys need no fallback, otherwise sync v20's ties, rebalance and cleanup also apply; copies after the run). `TableOrderHint`'s shape is unchanged |
| `packages/board-sync/src/undo.ts` | **Merged cells › The client keeps its last valid board**: `capture(doc)` checks the board it reads with `validate` and throws `Error("invalid_document")` instead of returning one that fails it. **Merged cells › Undo on hosted boards**: `capture` adds one unit per live `mergeMap` entry (`merge:<row id>:<column id>`, guarded as `place` and `tableStyle`); `stepBetween` records merges added, removed and changed; `restoreTable`, after the axis entries, removes **every merge the step touches** (absent or changed in its target, a changed span at the same anchor included), then restores the cell texts, then reinstalls the target entries, and validates once; when a text it must restore cannot be (a merge it does not touch now covers that cell) it applies nothing and the whole inverse is refused with today's hosted refusal words; the state reader's type follows `readLiveBoard` |
| `packages/board-sync/src/session.ts` | **Merged cells › The client keeps its last valid board** (scoped to the hold): `BoardSession` keeps the last board that passed `validate`; when, after any update, its board fails `validate` (or the codec or `capture` throws) the session is **held**: `board` answers that last valid board, the update is not observed by its history, `change` and the change report are not raised, and `edit`, `undo` and `redo` send nothing and answer `join_required` (the existing `blocked()` answer). While held, it applies each later remote `update` or own `saved` frame and checks the board again. When the result passes `validate`, it calls `capture` and `history.observe(last valid state, new state, false)` to reconcile history, releases the hold immediately, sets `change` from that frame and reports the change once. If capture or reconciliation throws, the room refuses the pending edit, or no request is outstanding while held, it drops with `refused_edit` and rejoins (`joined` replaces the document, history cleared, and ends the hold). The `board` getter's type follows `readLiveBoard` (`BoardV18`) |
| `packages/board-room/src/conflicts.ts` | **Merged cells › Concurrent changes**: `promote()` also re-assigns a write of a `mergeMap` key when the whole chain is live (the `mergeMap` is the live value of its table's object map, which is live in `objects` with `type` `"table"`); deletions are not promoted |
| `packages/board-room/src/edits.ts` | Both schema checks expect 18 (lines 36 and 44 at `8fd36fb`), still in the `invalid_document` branch |
| `packages/board-room/src/room.ts` | New boards at 18; created boards accept 13–18; load and `upgradeStored` narrow to `BoardV18`, set 18 and give every table's object map an empty `mergeMap` (the **schema step**) |
| `packages/board-room/src/history.ts` | Backup verification accepts 10–18; the capture's legacy comparison gains 17 (it compares 10 to 17) |
| `apps/server/src/routes/boards.ts` | Create and import accept schema 13–18 (API v18) |
| `apps/server/src/templates.ts` | Template objects validated in a version 18 wrapper (team templates v6) |

`packages/board-room/src/repair.ts` does not change (the room never repairs a merge).

**Web app:**

| File | Change |
| --- | --- |
| `apps/web/src/App.tsx` (264 lines) | Wiring only, by the substitutions below |
| `apps/web/src/table.ts` (195 lines) | `TableSelection` (AT1) gains `{ kind: "range"; id; anchor: CellAddress; focus: CellAddress }`, `{ kind: "cells"; id; cells: CellAddress[] }` (2 or more, reading order), `{ kind: "rows"; id; rows: string[]; start: string }` and `{ kind: "columns"; id; columns: string[]; start: string }` (2 or more ids; `chosenIds` gives them in table order; `start` AT2's start row or column). `TableAction` gains `{ axis; at: "move"; by: -1 \| 1 }`, `{ axis; at: "move"; to: number }`, `{ axis; at: "duplicate" }`, `{ axis; at: "insert"; gap: number }`, `{ at: "merge"; axis?: TableAxis }` and `{ at: "split" }`. `anchorCell` answers `selectionAnchor`. `TableLayout` gains `unmerged: number[]` (each row's drawn height before the merge additions); `layoutTable` finds drawn heights by AT14 (document v24 **Drawn heights**): unmerged cells first, then each merge's text measured across its span's width, its lack added to the span's last row in `rows`; `minimums` and `unmerged` leave merged cells out, so `growTable` (which now saves from `unmerged`) and a border drag's minimum never raise a height for a merged cell. `cellBox` answers a merged cell's whole box for its anchor or a covered cell. `selectionBox` answers AT5's box (a range's rectangle, a set's bounding box, a run's or set's of columns; rows the table's box). `hitCell` answers a merge's anchor for any point in its box (AT15). `hitBorder` hits a border only along its drawn segments (`tableGridLines`) and the table's right and bottom edges, so a point inside a merged cell's box hits none and a merged cell's own edges stay resizable. New `tableGridLines(t, layout)`: `{ id: string; points: number[] }[]`, the inner borders split around merged cells. New `selectionOutlines(t, layout, s)`: `{ boxes: Rectangle[]; inner: number[][] }` (AT4). `tableButtons` (AT4): a merged cell shows its row grabber only when it spans one row and its column grabber only when it spans one column; `rows` and `columns` give one pressed grabber per chosen entry; `range` and `cells` give none; the add bars keep today's rule from `anchorCell`. `validTableSelection` keeps today's answer for a cell, row or column whose id is gone and otherwise answers `keepSelection`; its notice: today's remote-delete words (`<label> deleted a row you had selected.` …, naming the axis of a gone id, rows first) exactly when an update from someone else (origin `remote`) makes the selection fall back to the table (AT1), and, checked after that, sync v20's **A remote merge over the cell being edited**: it gains a last parameter `before?: TableItem` (the table before the update); when a cell is being edited and is now covered, the selection is its merged cell (the editor closes), and the notice `` `${label} merged cells you were editing.` `` (`label` defaulting to `Someone`; AT16) shows only for origin `remote` **and** when `before` has no merge with that anchor and the same `rows` and `columns` (the update added or changed it). A move, insert, duplicate or delete alone that brings the edited cell under an existing merge closes the editor and selects the merged cell with **no notice**; a remote move, insert, duplicate or split that leaves the edited cell uncovered answers the same object, so nothing closes. It answers the same object whenever nothing changes. `tableMode` gains `Cells`, `Rows` and `Columns`. `tableKey` (AT3, AT7): Cmd or Ctrl+D (no Alt, no Shift, not editing) → `{ action: { axis, at: "duplicate" } }` for a row, rows, column or columns, `{ consume: true }` for a cell, range or set, `undefined` for the table (today's Duplicate); Alt+`KeyM` (no Shift, Cmd or Ctrl) → `{ action: { at: "split" } }` on a merged cell, `{ action: { at: "merge" } }` for a range, row, column or run, `{ consume: true }` for any other cell-level kind, `undefined` for the table; Shift+arrow → the new answer `{ choose: TableSelection }` (`moveFocus`) on a cell or range, `{ consume: true }` on a set, rows or columns; Alt+Return, Alt+Shift+Return, Alt+`[` and Alt+`]` → `{ consume: true }` on a range or set (rows and columns keep today's answers, which `arrangeTable` applies to the chosen run); Delete or Backspace → `{ action: { at: "clear" } }` for a range or set and `{ action: { axis, at: "delete" } }` for rows or columns; Return on a range or set → `{ edit: selectionAnchor }`; Tab, Shift+Tab and plain arrows from a range or set end it: `{ select }` of the next cell from `selectionAnchor`, and at the table's edge (no next cell) `{ select: selectionAnchor }`, that single cell, with nothing else moving; rows and columns consume Return, Tab and arrows as a row does. Every other answer is today's. New `selectionAnnouncement(t, s)`: `announceCell` for a cell, `selectedText` for a range, set, rows or columns, else `""`. It imports values from `./table-selection.ts` |
| `apps/web/src/context-bar-position.ts` (50 lines) | AT5 **Position**: the horizontal anchor treats `rows` as `row` (`kind !== "row" && kind !== "rows"`, the table's box) and every other kind through `selectionBox`. The 88 px offset already applies to every kind but the table (26 while editing), so the bar's bottom sits 48 px above the table for each new kind. Nothing else |
| `apps/web/src/icons.tsx` (72 lines) | `tableIcons` gains AT5's glyphs: `"Merge cells": [2.5, 4.5, 15, 11, 2, "M6 10h8M8 8l-2 2 2 2M12 8l2 2-2 2"]` and `"Split cell": [2.5, 4.5, 15, 11, 2, "M10 4.5v11M3.5 10h3M13.5 10h3"]` |
| `apps/web/src/state/use-selection.ts` (61 lines) | `chooseTable(next, table, announcement?)`: the announcement is the one given, else `selectionAnnouncement(table, next)` (AT18). `tableAnnouncement` is the stored announcement whenever the stored selection is the current table's (every kind, not only a cell). Still no effect |
| `apps/web/src/state/use-board-document.ts` (124 lines) | Scoped to `commit`: it returns the committed board (`Board \| undefined`). The history step is built as today but recorded (`updateHistory`) only **after** `apply` has admitted the edit; when `apply` answers `false` (a hosted edit not admitted, a held session's `join_required`) nothing is recorded and `commit` returns `undefined`; it also returns `undefined` when nothing changed or the board is read-only, and still throws at the 5,000-cell limit. On admission it returns the board `apply` set (`model.current`, the bounded result). Hosted success means **optimistic admission** (the local apply accepted); a later room refusal takes today's reload path. Every other caller ignores the return value. Still no effect |
| `apps/web/src/gesture.ts` (37 lines) | `Drag` gains `arrange?: true`: the shared gesture record the grabber drag sets while it owns the gesture |
| `apps/web/src/state/use-hosted-board.ts` (103 lines) | `onTableChange` passes the table before the update (`old` when it is a table) as `validTableSelection`'s new last argument `before`; nothing else (its existing changed-selection branch closes the editor and shows the notice). Still exactly one passive effect |
| `apps/web/src/state/use-geometry-edits.ts` (220 lines) | Every table resize starts from **saved** heights, never drawn ones, so a merged cell's drawn growth never becomes a saved height (AT14): `resizedTableBorder` starts a row border drag from the row's saved height (`table.rows[border.index].height`), with today's minimum from `start.minimums` (unmerged cells only); `resizeStart` gives a table's starting rectangle its saved `height` (not its layout's drawn height), which corner resize (`resizedBoard`) and the Objects panel's size fields (`resizeBy`) then scale from. Other objects keep today's drawn starting height. Nothing else; still no effect |
| `apps/web/src/state/use-page-keys.ts` (125 lines) | Input gains `arranging?: () => boolean`, read only in the handler. While it answers `true` (a grabber drag is past its threshold) `pageKeyDown` runs no page command: Escape prevents its default and calls the existing `cancel()` (which ends the drag), and every other key returns at once. Page commands work again on release. Still no effect |
| `apps/web/src/ui/context-bar.tsx` (283 lines) | A `tableCells: number` prop, passed to `TableControls` as `cells`. Nothing else |
| `apps/web/src/state/use-canvas-input.ts` (662 lines) | Input gains `tablePointer?: () => TablePointer` (type from `../table-arrange`), called only inside event handlers and effects. `pointerMove` calls `tablePointer?.().move(point(e), e)` right after the link pointer's `move`; `pointerLeave` also calls `leave()`; `pointerMove`, `pointerUp` and `lostPointerCapture` return at once (after the hover call) while `drag.current?.arrange` is set, since the hook owns that gesture (its events bubble from the captured grabber); `cancel()` (reached by the existing window blur listener and the read-only effect) also calls `tablePointer?.().cancel()`. In `tableKeys`, the existing Escape test also matches `tablePointer?.().dragging()` and then calls `tablePointer().cancel()` (default prevented, propagation stopped), and the answer `{ choose }` calls `chooseTable(result.choose, selectedTable)`. In `pointerDown`, in the Select tool, **before the handle, border (resize) and object-toggle checks**: when the press hits `selectedTable` (with a layout), `tableSelection` is not the table kind, `hitCell` gives a cell and `chooseHow(e, isMac(navigator.platform))` answers, then for `!readOnly` it calls `chooseTable(chooseCell(...), hit)` (every AT2 kind: a cell, range or set extends or toggles, rows or columns start again with that cell), records no drag and no link press, focuses the scene and returns. While editing a cell of that table the earlier existing lines (`finishTextSession()`, `setInline(false)`) have already ended editing as Escape in the cell editor does (its text kept), and the edited cell, the current selection, is the anchor. For `readOnly` the press takes the plain-click path (that cell is chosen; AT2 **Viewers**). A press without ⇧ or ⌘, and every press on another object, empty canvas or the table while the table is selected, keeps today's path (click, resize, move, marquee). `sceneKeyDown`'s first line also calls `e.stopPropagation()` when it returns for a composition (`composing` or `isComposing`) while a cell-level table selection is selected, so a composing key never reaches the page's Duplicate or Delete. It imports `chooseHow` and `chooseCell` from `../table-selection` and `isMac` from `../text-links`. Still exactly two passive effects |
| `apps/web/src/state/use-editing-commands.ts` (591 lines) | `tableAction(action)`: when `action.at` is `before`, `after`, `move`, `duplicate`, `insert`, `merge` or `split` (so the ⌥-add shortcuts, the menus and ⌘D share one refusal), or `tableSelection` is a range, set, rows or columns and `action.at` is `delete` or `clear`, it calls `arrangeTable(t, tableSelection, action, () => crypto.randomUUID(), tableCellCount(model.current.objects))`: `null` or `{ refusal }` → nothing (the control is disabled, or the key does nothing; AT7); else `finishTextSession()` and one `const saved = commit({ ...model.current, objects: ... boundTable(result.table) ... }, true, undefined, undefined, undefined, result.hint)` (one Undo step, AT17) inside today's `try`/`catch` (`setMessage(String(error))` and return, as today). Only when `saved` is a board (the commit was admitted; see `use-board-document.ts`) does it call `chooseTable(result.selection, <the table in saved>, result.announcement)` and focus the scene; a thrown limit, a held session or a hosted edit not admitted selects and announces nothing. Every other action (an add bar's `end` included) keeps today's path. Still no effect |
| `apps/web/src/scene/table-body.tsx` (47 lines) | AT14 and AT4: `TableBody` draws the inner grid from `tableGridLines`, each cell's text in its `cellBox` (a merged cell across its span, inset 20, wrapped within its width minus 40), and the outlines from `selectionOutlines` (boxes `#518de0` at `2 / zoom`, or `1 / zoom` for the table as today, `#7051cf` while editing; inner lines `#8fbdf5` at `1 / zoom`). The resize highlight (today's `border` line) is drawn only along that border's drawn segments (`tableGridLines`, or the outer edge), never across a merged cell. New optional prop `drag?: TableDragDrawing` (AT11): the run's place filled `rgba(245,247,250,0.85)` 1 px (`1 / zoom`) inside its box, over its texts, and, when `drag.gap` is defined, a `Line` at `dropLine(...)`, `#518de0`, `2 / zoom`. New export `TableDragGhost({ object, layout, drag, zoom })`: a `Group` at `drag.ghost` holding a `Rect` (fill `rgba(255,255,255,0.92)`, stroke `#d9dfe7` at `1 / zoom`, no corner radius, `shadowColor="rgb(20,18,26)"`, `shadowOpacity={0.18}`, `shadowBlur={24 / zoom}`, `shadowOffsetY={8 / zoom}`; Konva scales shadows by the stage's scale, so these are screen pixels), `#d9dfe7` lines between its cells at `1 / zoom`, and the run's cells' texts laid out as `TableBody` lays them out. Still no hook |
| `apps/web/src/scene/board-drawing.tsx` (96 lines) | Optional prop `tableDrag?: TableDragDrawing \| null`: passed to the dragged table's `TableBody` as `drag`, and `<TableDragGhost>` drawn after every object (beside today's `TableGhostBody`). Still no hook |
| `apps/web/src/scene/table-buttons.tsx` (46 lines) | Optional props `arrange?: TableArrangeButtons` and `cells?: number` (the board's table cell count, for the dots' reasons); without it the part renders exactly as today. With it, one keyed list holds `tableButtons(...)` and `hoverControls(..., arrange.hover, zoom)`'s grabbers (deduplicated by axis and id; key `select:<axis>:<id>`, add bars `add:<axis>`) and its dots (key `insert:<axis>:<gap>`), so a pressed grabber keeps its element, and its pointer capture, when the press selects its row. Grabbers gain `onPointerDown` (`arrange.press(g, e.nativeEvent, e.currentTarget)`), `onPointerMove`, `onPointerUp`, `onPointerCancel` and `onLostPointerCapture` (`arrange.lost()`), `onKeyDown` (prevents the default and stops propagation when `arrange.key` answers `true`) and an `onClick` that calls `arrange.click(g, e.nativeEvent)` and then `focus()`; While `arrange.dragging` is set, only the run's own selected grabbers and `<span class="table-drag-square" aria-hidden="true">` at `pos(arrange.square)` are rendered (AT11). Dots are rendered after every grabber in the list, so where hit areas overlap at low zoom the dot is on top and wins. Each dot (AT9) is `<button type="button" tabIndex={-1} class="table-insert table-insert-<axis>" aria-label={name} title={reason \|\| undefined} disabled={!!reason}>` at `pos(dot)` (hover-only and not in the tab order; the keyboard path is the menus' Add items, at today's default sizes), holding `<span class="table-insert-dot" aria-hidden="true">` with the 10 × 10 white plus (`viewBox="0 0 10 10"`, `stroke="white"`, `strokeWidth="1.8"`, round caps, `d="M5 1.5v7M1.5 5h7"`), `<span class="table-insert-line" aria-hidden="true">` (a row's: `left: 26px; top: 11px; width: length × zoom; height: 2px`; a column's: `left: 11px; top: 26px; width: 2px; height: length × zoom`) and `<span class="tooltip">` holding `reason \|\| insertTip(axis)`; its click calls `arrange.insert(axis, gap)` and then `focus()`. The existing visibility rule (not read-only, not editing, not busy, a table and a selection) still applies to everything it renders, except that while `arrange.dragging` is set (the hook itself has set `busy` through the gesture gate) the run's grabbers and the square are rendered regardless of `busy`, so the captured button is never unmounted. Still no hook |
| `apps/web/src/ui/table-controls.tsx` (122 lines) | AT5. `AxisMenu` moves to `ui/table-menu.tsx` (imported from `./table-menu`, now given `selection` and `cells`). New prop `cells: number` (the board's table cell count, from `ContextBar`). `TableButton` gains an optional `tip` (its tooltip and `title` when there is no reason; default `name`). New bars: **Cells** (`<span>Cells</span>`, divider, `<small>{countText}</small>`, Merge cells when `mergeShown`, Delete content (`{ at: "clear" }`), `copyLink`); **Rows** / **Columns** (label, divider, `<small>{countText}</small>`, `AxisMenu`, Merge cells, `Delete rows` / `Delete columns` (the Delete axis glyph) with `arrangeRefusal(table, selection, { axis, at: "delete" }, cells)?.reason`, `copyLink`). The Row and Column bars gain Merge cells before Delete row / Delete column. Merge cells is `TableButton` `name="Merge cells"`, `icon="Merge cells"`, `tip="Merge cells ⌥M"`, reason `reason \|\| arrangeRefusal(table, selection, { at: "merge" }, cells)?.reason`, action `{ at: "merge" }`. On a merged cell (`mergeOf` answers a merge anchored at the selected cell) the Cell bar gains, before Delete content, `<button class="icon-button table-split" aria-label="Split cell" aria-pressed="true" title="Split cell ⌥M" disabled={!!reason}>` with `Icon name="Split cell"` and the tooltip `Split cell ⌥M`, action `{ at: "split" }`. Read-only, editing and table bars are unchanged |
| `apps/web/src/storage.ts` | As storage v7: the board list's `newer` test is `schemaVersion > 18` |
| `apps/web/src/board-file.ts` | As board file v8: the newer test is `schemaVersion > 18` |
| `apps/web/src/team/templates-rules.ts` (112 lines) | As team templates v6: `templateBoard` validates in a version 18 wrapper and stays strict (it is what every new save checks). New pure `legacyTemplateObjects(objects: unknown): unknown` (team templates v6): each non-null, non-array object with `type` `table` and no own `merges` key is copied with `merges: []`; every other element, a table that has the key, and a non-array `objects` are answered unchanged. `templateBoard(objects, read = false)` gains `read`: when `true` it validates as today but skips the content cap. `parseTemplate` measures `contentBytes` of the **stored** objects first (above the cap: today's error), then runs `legacyTemplateObjects`, validates with `templateBoard(objects, true)` and returns the template with the normalised objects; Save, Replace and Add keep `templateBoard(objects)` with the cap, so the added `merges: []` is never counted on a read, so one saved table without `merges` hides no catalogue entry (`parseTemplates`' `map(parseTemplate)`), and Add template inserts tables with `merges`. Still no React and no `./auth` import |
| `apps/web/src/team/templates-section.tsx` (210 lines) | A template card's preview calls `templateBoard(template.objects, true)` (team templates v6: no cap on a read). The save dialog's call is unchanged |
| `apps/web/style.css` (1,787 lines) | Only the seventeen rules below, inserted right after `.context:has(.table-menu:not([hidden])) { z-index: 6; }` |

**Unchanged.** `ui/content-field.tsx` (its `tableKey` call while editing gets only today's answers), `state/use-object-layouts.ts`,
`state/use-editor-placement.ts` (the editor box follows `cellBox`), `state/use-context-bar.ts`, `state/use-viewport.ts`
(its wheel and pinch already stop while `drag.current` is set, which the grabber drag now sets), `state/use-export.ts` and `board-export.ts` (a table selection
of any kind but the table already counts as no table under `Selection only`, and Export as CSV already asks only that
the table is the one selected object; AT20), `table-csv.ts` (a covered cell holds no text, so CSV export and copy text
write a merged cell's text in its anchor's place and leave covered cells empty; CSV paste and import make tables
through `add`, so `merges: []`), `clipboard.ts` and `history.ts` (they copy through `remapTable`, which remaps merges),
`team/hosted-board.ts`, `geometry.ts`, `scene/export-drawing.tsx` (it passes no `tableDrag` and no selection, so
exports draw merged cells and no selection marks; AT20). Files that name the current board's type
(`state/use-text-links.ts`, `link-cards.ts`, `state/use-link-cards.ts`) name `BoardV17`/`BoardV16`, which document v24
keeps as aliases of `BoardV18`, and need no edit. No other web file changes.

### App.tsx wiring

App.tsx changes only on existing lines, so it keeps its 264 newlines and the budget test's limit stays **264**.
Exactly these substitutions, applied in this order to the current App.tsx (each `from` occurs once):

| # | From | To |
| --- | --- | --- |
| 1 | `import { LinkHoverCard } from "./ui/link-hover-card";` | `import { LinkHoverCard } from "./ui/link-hover-card"; import { useTableArrange } from "./state/use-table-arrange";` |
| 2 | `linkPointer: () => textLinks.pointer,` | `linkPointer: () => textLinks.pointer, tablePointer: () => tableArrange.pointer,` |
| 3 | `cancelDrag: tableGesture.cancelDrag,` | `cancelDrag: () => { tableGesture.cancelDrag(); tableArrange.cancel(); },` |
| 4 | `ownCopy: tableData.ownCopy, view, size, pos, setMessage });` | `ownCopy: tableData.ownCopy, view, size, pos, setMessage }); const tableArrange = useTableArrange({ table: resolvedTable, selection: tableSelection, choose: chooseTable, action: tableAction, readOnly, editing: inline, busy: busy \|\| composing \|\| tool !== "Select" \|\| tidy.open, drag, setBusy, board, view, size, scene });` |
| 5 | `tableGesture={tableGesture} faded={find.faded}` | `tableGesture={tableGesture} tableDrag={tableArrange.drawing} faded={find.faded}` |
| 6 | `select={chooseTable} focus={tableGesture.focus} />` | `select={chooseTable} focus={tableGesture.focus} arrange={tableArrange.buttons} cells={tableArrange.cells} />` |
| 7 | `tableResizing={tableGesture.resizing}` | `tableResizing={tableGesture.resizing \|\| tableArrange.dragging} tableCells={tableArrange.cells}` |
| 8 | `openLink: () => textLinks.shortcut(),` | `openLink: () => textLinks.shortcut(), arranging: () => tableArrange.dragging,` |
| 9 | `onKeyDown={pageKeyDown} onKeyDownCapture={images.guardGesture}` | `onKeyDown={pageKeyDown} onKeyDownCapture={images.guardGesture} className={tableArrange.dragging ? "table-dragging" : undefined}` |

`tableArrange` is declared on the hook-call line (4), after every value it takes (`resolvedTable`, `tableSelection`,
`chooseTable`, `tableAction`, `drag`, `setBusy`, `scene`); substitutions 2, 3 and 8 read it only inside functions that run in event handlers
or effects, never during render, and 5, 6, 7 and 9 are in the returned JSX (9 on `<main>`, the app's root, which has
no class today). The hook call stays composition only
(`useTableArrange` is imported from `./state/`), so "App.tsx is composition only" holds. In `tests/modules.test.mjs`
the App composition test is titled "0011-W3 App composition changes only its recorded substitutions", its comment
names web modules v52 too, and it gains these nine pairs, in this order, at the end of its list; its line-count
assertion is unchanged and must pass.

### CSS (v52)

`apps/web/style.css` gains these **seventeen** rules, inserted as one block right after
`.context:has(.table-menu:not([hidden])) { z-index: 6; }` (the end of the table block) and before the blank line that
precedes `.export-dialog`. Nothing is appended at the end of the file, so the link rules and the selection highlight
rules stay its last rules (the existing check that `style.css` ends with them), and everything before `/* Pages:` is
untouched.

```css
.scene > .table-insert { position: absolute; transform: translate(-50%, -50%); display: grid; place-items: center; width: 24px; height: 24px; min-width: 24px; min-height: 24px; margin: 0; padding: 0; border: 0; border-radius: 12px; background: transparent; pointer-events: auto; cursor: pointer; }
.scene > .table-insert:hover:not(:disabled), .scene > .table-insert:active:not(:disabled) { background: transparent; }
.scene > .table-insert:focus-visible { outline: 2px solid #518de0; outline-offset: 2px; }
.scene > .table-insert:disabled { opacity: .45; cursor: not-allowed; }
.table-insert-dot { display: grid; place-items: center; width: 8px; height: 8px; border-radius: 4px; background: #8fbdf5; }
.table-insert-dot svg { display: none; }
.table-insert:hover:not(:disabled) .table-insert-dot, .table-insert:active:not(:disabled) .table-insert-dot, .table-insert:focus-visible:not(:disabled) .table-insert-dot { width: 18px; height: 18px; border-radius: 9px; background: #518de0; box-shadow: 0 1px 3px rgba(20,18,26,.25); }
.table-insert:hover:not(:disabled) .table-insert-dot svg, .table-insert:active:not(:disabled) .table-insert-dot svg, .table-insert:focus-visible:not(:disabled) .table-insert-dot svg { display: block; }
.table-insert-line { position: absolute; background: #8fbdf5; pointer-events: none; visibility: hidden; }
.table-insert:hover:not(:disabled) .table-insert-line, .table-insert:active:not(:disabled) .table-insert-line, .table-insert:focus-visible:not(:disabled) .table-insert-line { visibility: visible; }
.table-insert-row .tooltip { bottom: auto; top: 50%; left: auto; right: calc(50% + 17px); transform: translateY(-50%); }
.table-insert-column .tooltip { bottom: calc(50% + 17px); }
.table-insert:hover .tooltip, .table-insert:focus-visible .tooltip { visibility: visible; }
main.table-dragging, main.table-dragging * { cursor: grabbing !important; }
.scene > .table-drag-square { position: absolute; transform: translate(-50%, -50%); width: 16px; height: 16px; border-radius: 4px; background: #518de0; pointer-events: none; }
.context button.table-split[aria-pressed=true] { background: #7051cf; color: white; border-radius: 8px; }
.context button.table-split[aria-pressed=true]:hover:not(:disabled) { background: #6142be; color: white; border-radius: 8px; }
```

| Rule | Outranks | Specificity (a,b,c) |
| --- | --- | --- |
| `.scene > .table-insert` | the shared `button` rule's `min-width: 40px; min-height: 40px`, border, padding and white background | 0,2,0 > 0,0,1 |
| `.scene > .table-insert:hover:not(:disabled)` | the shared `button:hover:not(:disabled):not([aria-disabled=true])` `#f1eff5` | 0,4,0 > 0,3,1 |
| `.scene > .table-insert:focus-visible` | the shared `button:focus-visible` ring (3 px `#7051cf`), as the grabbers' rule does | 0,3,0 > 0,1,1 |
| `.scene > .table-insert:disabled` | the shared `button:disabled` opacity (0.45) and the button cursor: a disabled dot is 45 % opaque with a `not-allowed` cursor and keeps the 8 × 8 look | 0,3,0 > 0,1,1 |
| `main.table-dragging, main.table-dragging *` | every cursor on the page while a grabber drag runs (AT11), the scene's inline `cursor` style included, hence `!important` | 0,1,1 / 0,1,0 with `!important` |
| `.table-insert-row .tooltip`, `.table-insert-column .tooltip` | the shared `.tooltip` placement (above, centred) | 0,2,0 > 0,1,0 |
| `.table-insert:hover .tooltip` | the shared `.tooltip`'s `visibility: hidden` (the dot is not an `.icon-button`); a disabled dot shows its reason (AT9) | 0,3,0 > 0,1,0 |
| `.context button.table-split[aria-pressed=true]` | `.context button`'s transparent background | 0,3,1 > 0,1,1 |
| `.context button.table-split[aria-pressed=true]:hover:not(:disabled)` | `.context button:hover:not(:disabled)`'s `#29272e` icon and the shared hover fill, so the hovered pressed Split cell keeps a white icon on `#6142be` | 0,5,1 > 0,3,1 |

AT9's plus is 18 px with its 10 px white plus, the border line 2 px across the table, the tooltip 8 px from the circle
(17 px from its centre: to the left for a row's dot, above for a column's). Holding an insert point down keeps its hover look (the `:active` selectors). Merge cells, Split cell and the
other new bar buttons use the shared `.context` button rest, hover, active and disabled looks (no rule of their own
beyond Split cell's pressed fill); the drag's ghost, faded place and drop line are drawn on the canvas (`scene/table-body.tsx`),
not in CSS. The grabbing pointer shows everywhere while dragging through the `table-dragging` class App puts on `<main>`, the app's
root (substitution 9); pointer capture alone does not make one button's cursor global.

### Effect guards and module lists

In `tests/modules.test.mjs`, titles that change say "through 0011-W3 v1", the new names inserted in sorted order:

| Test | Change |
| --- | --- |
| screen parts | Thirty-eight modules, gaining `table-menu.tsx` (after `table-controls.tsx`) |
| state hooks | Thirty-one hooks, gaining `use-table-arrange.ts` (between `use-storage-session.ts` and `use-text-entry.ts`) |
| New: "the table arrange hook contains no effects" | `use-table-arrange.ts` has no `useEffect` and no `useLayoutEffect` |
| App budget | Unchanged: at most 264 newlines |
| App composition | The nine substitutions above |

Every other guard is unchanged and must pass: "the package holds exactly its modules" (19 files, no new rules file) and
`packageRules` unchanged; screen and scene parts hold no hook and import React only for types; state hooks never import
each other, `ui/` or `scene/`; no file but App imports `state/`; non-team files import `team/` only as types; rules
modules (`table-selection.ts` and `table-arrange.ts` among them) import no React or Konva and name no type literally;
scene parts stay 22, object-type modules 13, team modules 57, the board-sync list twelve; the canvas input hook still
holds exactly two passive effects, and the selection and editing commands hooks none.

### Counts

From v51: **31 state hooks**, 22 scene parts, **38 screen parts**, the rules package's 19 files and 13 object-type
modules; 57 team modules, the board-sync list (twelve modules) and every other effect count unchanged.

### Tests

- **Rules** (document v24's **Verification**): new checks in `tests/tables.test.mjs`, numbered after its last
  (`T-U16` onward).
- **Web** (new unit file `tests/table-arrange.test.mjs`, `npm test`, checks `X12-W01` onward, each importing the
  module it tests dynamically inside the check so that on the baseline each fails by its own name): every export of
  `table-selection.ts` (`chooseCell` and `chooseAxis` for each kind and `how`, the start row, `moveFocus` at the edges
  and over a merge, `keepSelection` for each kind and its same-object answer, `mergeTarget` with and without `axis`,
  `countText`, `selectedText`); `table-arrange.ts` (every refusal and its words through `arrangeRefusal`, in its order: board cells, axis limit, not a run, merge in the way, and Delete's chosen-count check, `axisMenu`'s
  heading, items, names and key texts for one and several entries and both platforms, `mergeShown`, `hoverTarget` at
  40 px, `hoverControls` with no dot on the outer edges, `dropGap` and its tie, no gap for a run cutting a merge,
  `dropLine`, `dragGhost`, `dragSquare`, `arrangeTable` for every action row above, including its selection,
  announcement and hint); the `table.ts` changes (`layoutTable`'s merged growth of the span's last row and `unmerged`,
  `growTable` never raising a height for a merged cell, `cellBox`, `hitCell` and `hitBorder` inside a merge,
  `tableGridLines`, `selectionOutlines`, `tableButtons` for a merged cell and the new kinds, `tableKey`'s new answers,
  `validTableSelection`'s fallback notice and merge notice for a remote update and none for an own or reload one);
  `useTableArrange` through the esbuild harness `tests/tables.test.mjs` uses (hover shown, kept over a grabber and
  cleared, the 4 px threshold along the axis only, a grabbed row outside the run chosen first, one `action` on release,
  none at the own place, after Escape, lost capture or a read-only turn, the dropped click); `TableButtons` with
  `arrange` (dot names, disabled reason in the tooltip, key stability while a press selects its row, only the run's
  grabbers and the square while dragging) and without it (today's output); `TableControls` and `AxisMenu` per kind
  (Cells bar of a range with Merge cells, of a set without it, Rows bar, Split cell pressed); and source checks that
  the seventeen CSS rules follow the table block in `style.css` and that `style.css` still ends with the link rules.
- **Also in `tests/table-arrange.test.mjs`**: `arrangeRefusal` at the board's 5,000-cell limit (`BOARD_CELLS_REASON`
  on the dot, the Add and Duplicate items and ⌘D), the drag reusing a run only for a same-axis selection, a remote
  reorder during a still drag redrawing the gap and the release using the live gap, a run cutting a merge starting no
  drag, own-place gaps inside the run doing nothing, `tableAction` neither selecting nor announcing when the commit
  throws or is not accepted, a ⇧/⌘-click with rows selected, with a cell being edited and as a viewer (before any
  resize or object toggle), `sceneKeyDown` stopping a composing key, `usePageKeys` running no command while
  `arranging()` and cancelling on Escape, `resizedTableBorder` starting from the saved height, `validTableSelection`
  with `before` (notice for an added or changed covering merge, none for a move that brings the cell under an existing
  one), the dots' `tabIndex` and their place after the grabbers, the drag taking and releasing the gesture gate
  (`drag.current.arrange`, `busy`; wheel blocked meanwhile), a live change breaking the run ending the drag, a
  non-run rows selection dragging the grabbed row alone, `commit` returning `undefined` and recording no step when
  `apply` refuses, corner and Objects-panel resize scaling a table from saved heights, the resize highlight skipping
  merged cells, and Tab, Shift+Tab and an arrow at the table's edge from a range and from a set ending on the anchor
  cell.
- **Templates**: `legacyTemplateObjects` and `parseTemplates` with a mixed catalogue (one saved table without `merges`,
  one with, one other object), `merges: []` after `parseTemplates`, and a stored template exactly at the content cap
  that is listed (`read`) and refused on Add, in `tests/team-templates.test.mjs`.
- **Fixture**: `tests/find.test.mjs` `F1-U14` evaluates `sceneKeyDown` (the extraction boundary, from
  `function sceneKeyDown(` to `function pointerDown(`, is kept) in a synthetic scope; its `state` gains
  `tableSelection: undefined`, the one binding the composition guard reads. Nothing else in that test changes.
- **Test files touched, in all**: `tests/table-arrange.test.mjs` (new), `tests/tables.test.mjs`,
  `tests/table-csv.test.mjs`, `tests/team-templates.test.mjs`, `tests/find.test.mjs` (fixture only) and
  `tests/modules.test.mjs`, besides the schema-pinning files the brief's dispositions name.
- **CSV**: a merged table's export (anchor text, covered cells empty) in `tests/table-csv.test.mjs`; `table-csv.ts`
  itself does not change.
- **Sync, room and server**: the checks sync v20's **Verification** lists, in the files it names.
- **Existing files**: `tests/modules.test.mjs` as above; `tests/text-links.test.mjs` (its CSS end check),
  `tests/pages.test.mjs` (its prefix comparisons) and `tables.test.mjs`' existing `T-U01`–`T-U15` must pass, except
  that `T-U01`'s and `T-U11`'s current-version assertions (`tests/tables.test.mjs` lines 34, 48, 408 and 413 at
  `8fd36fb`) and `T-U11`'s title move from 17 to 18, their behaviour assertions unchanged; tests that pin the newest schema 17 follow document v24, sync v20, storage v7, board file v8 and team templates
  v6 as the brief's dispositions list.

## Links in text (v51)

Replaces [web modules v50](0001-web-modules-v50.md), whose registry, import, composition, one-state-owner, team
guards, counts, seams, CSS and App.tsx rules remain word for word except as below. v50's own text follows as the part
**Link cards (v50)**, word for word with its headings one level lower.
[Interaction v53](0001-interaction-v53.md) adds links in text and object links, and [document v23](0001-document-v23.md)
adds the `link` key of a mark and schema version 17. They take **five new source modules**: one rules-package file,
one web rules module, one state hook and two screen parts. **App.tsx changes only by its wiring points** (below), on
existing lines, so its line count and budget stay; `style.css` gains **twenty-one rules** at its end.

### Change note (v50 → v51)

- New part **Links in text (v51)**: the five modules and their exported names, the changed files (web, rules package,
  sync, room and server), App.tsx's exact substitutions, the twenty-one CSS rules, the new hook's two effects, the guards
  and counts, and the tests.
- Every current-schema mention of v50 that says 16 now says 17 (the newest schema is document v23's 17): the board
  list's `newer` test and the board file's newer test are `schemaVersion > 17`, and the decode paths accept what
  document v23's `validate` accepts (schema 1–17). The rest of v50's text is kept as written; read its "16" as the
  schema of its own version.
- Counts: **30 state hooks**, 22 scene parts, **37 screen parts**, the rules package's **19 files** and 13 object-type
  modules; 57 team modules and the board-sync list unchanged.
- Nothing else in v50 changes.

### Links in text (v51)

Every value the new modules hold (words, timings, sizes, colours, icon paths, kinds, rules LT1–LT17) is interaction
v53's or document v23's; this part says only where each lives and how it is wired. Every new file begins with
`// SPDX-License-Identifier: Apache-2.0`.

#### New modules

**`packages/board-rules/src/text-link.ts`** — the rules package's 19th file (document v23 **Link address rule** and
**Links in `marks.ts` and `text-link.ts`**). It imports only `./marks.ts`; `marks.ts` does not import it (no cycle);
`document.ts` imports both. It names no object type and holds no `sticky` word (the rules type-name guard).

| Export | What |
| --- | --- |
| `linkAddress(raw: string)` | `{ ok: true; href: string } \| { ok: false }`: document v23's five steps, pure (no network, clock or storage) |
| `linkAt(marks, length, start, end)` | `{ start: number; end: number; href: string } \| null`: the whole link run (maximal run) that covers a range, or that a caret is inside (document v23) |
| `touchesLink(marks, length, start, end)` | `boolean` (document v23) |
| `setLink(marks, text, start, end, href: string \| null)` | `Mark[]`: the range snapped outward to grapheme boundaries of `text` (`Intl.Segmenter`, no snapping without it), flags kept, normalised; a caret changes nothing (document v23) |

It uses the global `URL`. The rules package compiles against ES2022 only (`lib: ["ES2022"]`, `types: []`), whose
globals do not include `URL` (`Intl.Segmenter` is ES2022), so **`packages/board-rules/src/platform.d.ts`** (the
package's one list of globals beyond ES2022, also included by board-sync and board-room) gains exactly:
`declare class URL { constructor(url: string); readonly href: string; readonly protocol: string; readonly hostname: string; readonly username: string; readonly password: string }`.
The web app and the server compile with the DOM library and never include `platform.d.ts`, so nothing else changes.

**`apps/web/src/text-links.ts`** — a web rules module: no React, Konva or `react-dom` import, no value import from
`team/`, no `.tsx` import, every relative import written with its `.ts` extension (so unit tests load it under Node),
and it names object types only through the registry (no `sticky` word, no type-name comparison). It owns same-board
recognition, labels and kinds, the button's state, the paste test, the edit range of a text change, the card's place
and hit-testing a point against the drawn underline spans.

| Export | What |
| --- | --- |
| `LINK_WORDS` | `{ link: "Link", several: "Select one object to add a link", empty: "Add text first", caret: "Select words to link", address: "Link address", placeholder: "Paste or type a link", remove: "Remove link", apply: "Apply link", refused: "Use a web address starting with http:// or https://, or a link to this board.", copy: "Copy link", edit: "Edit link", copied: "Link copied.", gone: "Not on this board any more", group: "Link", details: "Link details" }` (interaction v53 **Words**) |
| `linkTooltip(mac: boolean)` | `Link · ⇧⌘U` or `Link · Ctrl+Shift+U` |
| `isMac(platform: string)` | `/Mac\|iPhone\|iPad/.test(platform)` (interaction v53 **Platform**) |
| `isLinkShortcut(event)` | LT2's key test on `{ key, shiftKey, metaKey, ctrlKey, altKey, isComposing }`: `key` `u` or `U`, Shift, Cmd or Ctrl, no Alt, no composition |
| `isPlainPasteKey(event)` | Cmd+Shift+V or Ctrl+Shift+V (`key` `v` or `V`, Shift, Cmd or Ctrl, no Alt) |
| `copyObjectLabel(kind)` | `Copy link to <kind>` |
| `objectCopied(kind, hosted: boolean)` | `Link to <kind> copied.`, plus ` It opens in this browser only.` when `hosted` is false |
| `capitalised(kind)` | The kind with its first letter in upper case |
| `firstLine(text)` | LT7's first non-empty text line: trimmed, at most 60 code points, then `…`; `""` when none |
| `sameBoardLink(href, address, hostedBoard?)` | `{ page?: string; object?: string } \| undefined` (interaction v53 **Same-board link**): `href`'s origin and pathname equal `address`'s; on a team board (`hostedBoard` given) `readHostedBoardLink(url.hash)` names `hostedBoard` and carries `page` and/or `object`; on a single-user board `href`'s `board` query value is not null and equals `address`'s, and it carries `page` and/or `object` (first occurrence of each, decoded). A bare board link and any other board's link answer `undefined`; an `href` that `new URL` cannot read answers `undefined` |
| `type LinkLabel` | `{ text: string; muted: boolean; icon: "page" \| "object" \| "gone" \| "outside"; tool: string \| null }` |
| `linkLabel(href, board, address, hostedBoard?)` | LT7's label table, read from `board` (all pages) as it is now: an object link whose object exists → `firstLine(o.text)` when the type has text and that answer is not empty, else (no text, an empty or whitespace-only text) `capitalised(objectKind(o.type).kind)`, `icon: "object"`, `tool: objectKind(o.type).icon`; a page link whose page exists → its name, `icon: "page"`; a same-board link whose target is missing → `LINK_WORDS.gone`, `muted: true`, `icon: "gone"`; anything else → `href` as stored, `icon: "outside"`. `tool` is `null` except for an existing object |
| `type LinkBox` | `{ id: string; href: string; start: number; end: number; line: number; x: number; y: number; width: number; height: number }`: one underline span's hit box in board units (`line` its text line; `start`/`end` its code points) |
| `linkBoxes(object, layout)` | The hit boxes of one rich-text object's underline spans (`layout.links`, below), at exactly the place the scene part draws them: for `usesShapePaint(o)` objects, `x = box.x + lineOffset(o.align, box.width, span.lineWidth) + span.x` and line top `box.y + max(0, (box.height − lines × L) / 2) + span.line × L`, with `box = textBox(o)`, `L = textUnits(o.textSize) × 1.45`, `lines` the drawn line count (ShapeBody draws without a clip, so these boxes are kept whole); for the others `x = o.x + TEXT_INSET + lineOffset(o.align, o.width − 2·TEXT_INSET, span.lineWidth) + span.x` and line top `o.y + TEXT_INSET + span.line × L` (`L = textUnits(o.textSize) × TEXT_LAYOUT.lineHeight`), each box **intersected with NoteBody's clip rectangle** (`o.x + TEXT_INSET`, `o.y + TEXT_INSET`, `o.width − 2·TEXT_INSET`, `layout.height − 2·TEXT_INSET`) and left out when the intersection is empty. Each box is one line high |
| `type LinkHit` | `{ id: string; href: string; run: { start: number; end: number }; box: LinkBox; first: LinkBox }`: `run` is the **saved maximal run** (`linkAt(o.marks, count(o.text), box.start, box.start + 1)`), `first` the leftmost box of that run on the hit box's line (the card's left edge, LT7) |
| `linkUnder(objects, layouts, point, zoom, editing?)` | `LinkHit \| undefined`: `hitObject(objects, point, zoom)` (the topmost object, as clicks use), then that object's box holding `point`; `undefined` when the topmost object is `editing` (its id) or no box holds the point. Hover, following and Edit link identify a link only by `id` and `run`, never by the drawn span |
| `cardPlace(anchor, size, window)` | LT7's place in screen pixels: `left = max(12, min(anchor.left, window.width − size.width − 12))`; `top = round(anchor.bottom + 6)`, or `anchor.top − 6 − size.height` when that top would bring the card's bottom closer than 12 px to the window's bottom |
| `type LinkButtonState` | `{ disabled: boolean; reason: string; own: boolean; pressed: boolean }`: `own` is true when `reason` is one of the three new reasons (then `aria-describedby="link-reason"`), false for the bar's selection reason |
| `linkButton(input)` | LT2's enabled rule, first-match reasons and pressed state from `{ selectionReason, objects (the selected objects), editing: boolean, marks, length, start, end }` (the range in code points) |
| `pastedLink(text)` | LT5 step 4: the `href` when `text.trim()` contains no white space and passes `linkAddress`, else `undefined` |
| `editRange(selection, inputType, before, after)` | The `edit` that `remap` takes (document v23) for one change of the editor's field, in code points of `before`, or `undefined` for the fallback. `selection` is the field's selection before the change. A non-collapsed selection → `{ start, end }` of it, whatever `inputType` (typing, pasting, deleting or dropping replaces it). A collapsed caret `c` with `k = count(before) − count(after)`: an `inputType` starting with `insert` → `{ start: c, end: c }`; one starting with `deleteContentBackward`, `deleteWordBackward`, `deleteSoftLineBackward` or `deleteHardLineBackward` → `{ start: c − k, end: c }`; one starting with `deleteContentForward`, `deleteWordForward`, `deleteSoftLineForward` or `deleteHardLineForward` → `{ start: c, end: c + k }`; anything else (`historyUndo`, `historyRedo`, an unknown or missing type) → `undefined`. A range outside `[0, count(before)]` → `undefined` |
| `toUnits(text, offset)` | The UTF-16 offset of code point `offset` in `text` (the inverse of `codePointOffset`) |
| `type LinkPress` | `{ board: string; page: string; id: string; run: { start: number; end: number }; href: string; address: string }`: what a press on a linked span captured (the board's id, the open page, the object, its saved run, the stored address and `location.href`) |
| `type LinkPointer` | `{ move(point: Point, event: { buttons: number; pointerType: string }): void; leave(): void; press(point: Point): LinkPress \| undefined; follow(press: LinkPress, up: Point): boolean; repeats(press: LinkPress \| undefined): boolean; doubled(point: Point): boolean }`: what `useCanvasInput` calls; `follow` answers whether it acted, `repeats` whether a press is the second press of a double-click on a link just followed, `doubled` whether a `dblclick` at `point` belongs to that double-click (it then clears the record) |
| `type EditorLinks` | `{ open: boolean; highlight?: { start: number; end: number }; key(event: KeyboardEvent): boolean; paste(event: ClipboardEvent): boolean; keepsEditing(next: EventTarget \| null): boolean; compositionStart(range: { start: number; end: number } \| null): void; compositionEdit(): { start: number; end: number } \| undefined }`: what `ContentField` calls (DOM event types; the field passes `nativeEvent`) |
| `type LinkBarModel` | `{ value: string; refused: boolean; canApply: boolean; canRemove: boolean; left: number; change(value: string): void; submit(): void; apply(): void; remove(): void; close(): void }` |
| `type LinkCardModel` | `{ left: number; top: number; label: LinkLabel; editable: boolean; copy(): void; edit(): void; enter(): void; leave(): void; measure(element: HTMLElement \| null): void }` |
| `type LinkControls` | `{ link: LinkButtonState & { tooltip: string; run(): void }; copy: { shown: boolean; label: string; run(): void }; bar: LinkBarModel \| null }`: what `ContextBar` reads |
| `type LinkPages` | `{ id: string; openLink(page: string \| undefined, object: string \| undefined, source: "hash" \| "click"): void }`: what the hook needs of `usePages`' result |
| `BLOCKING_SURFACES` | `"[role=menu], [role=dialog], [role=listbox], .pages-panel, .swatches, .arrange-menu, .connector-popup, .image-description-panel, .context details[open]"` (LT7) |
| `blockingSurfaceOpen(root: ParentNode)` | True when `root.querySelectorAll(BLOCKING_SURFACES)` holds an element for which `element.checkVisibility({ visibilityProperty: true })` is true (so `display: none`, `[hidden]`, `visibility: hidden` and hidden ancestors do not count); where `checkVisibility` is missing, `getClientRects().length > 0` and a computed `visibility` of `visible` on it |

It imports only `nextphase-board-rules/*` (`document.ts`, `marks.ts`, `text-link.ts`, `styles.ts`,
`objects/registry.ts`), `./page-links.ts`, `./connectors.ts` (`hitObject`), `./text-runs.ts` and `./geometry.ts`
(`TEXT_INSET`, `TEXT_LAYOUT`, types), `./selection.ts` and `./view.ts` (types).

**`apps/web/src/state/use-text-links.ts`** — `useTextLinks(input: TextLinksInput)`, returning
`{ pointer, shortcut, editor, placed, controls, card }`:

| Returned | What |
| --- | --- |
| `pointer: LinkPointer` | Hover (LT7) and following (LT8) |
| `shortcut(): boolean` | Cmd/Ctrl+Shift+U from the canvas: runs the Link button's click when it is shown and enabled (LT2); answers whether it acted |
| `editor: EditorLinks` | The canvas editor's shortcut, paste onto words (LT5), the composition's edit range, the editor's outline and highlight range while the bar is open, and keeping the text session while focus is in the link bar |
| `placed(accepted: boolean): void` | Called by `useEditorPlacement` once it has decided whether the canvas editor fits: opens a pending link bar (accepted) or drops it (fallback) |
| `controls: LinkControls` | The Link button, Copy link to object (LT9) and the link bar (LT3, LT4) |
| `card: LinkCardModel \| null` | The hover card while it shows |

`TextLinksInput` is `{ hosted?: HostedBoard; pages: LinkPages; board; model; commit; objects; objectLayouts;
selected: Set<string>; select; textSelection: TextSelection | null; inline: boolean; edit: (target?: Item) => void;
editor: RefObject<HTMLTextAreaElement | null>; finishTextSession; scene: RefObject<HTMLDivElement | null>; readOnly:
boolean; busy: boolean; composing: boolean; tool: string; tidyOpen: boolean; barShown: boolean; commandReason: string; selectionReason:
string; ownCopy: (text: string) => boolean; view: View; size: Size; pos; setMessage }`. It holds, in state and refs:
the card (its object, run, label and measured size) and its two timers (the 300 ms show and the 200 ms hide); the link
bar (the object id, the range in code points, the object's `text` when it opened, the field text and whether the
refusal shows); a pending open (`{ id, start, end }`) waiting for the editor's placement; a recorded focus handoff; `followed`; and the composition's range.

- **The card.** `move` acts only for `pointerType` `mouse` or `pen` with no button held. A `linkUnder` hit of an object
  that is not being edited starts the 300 ms show timer (restarted when the run changes; a hit of the shown run cancels
  a pending hide). Leaving the run (no hit, another run) or `leave()` **cancels a pending show at once** and, when the
  card shows, starts the 200 ms hide timer (cancelled by `enter()`, or a new hit of the same run). Every `pointerdown`
  (the capture listener below) also cancels a pending show. When the show timer fires, the card shows only if, then:
  the Select tool, `!busy`, `!composing`, `!inline`, `!tidyOpen`, no voting mode (`hosted?.voting.mode`), no link bar,
  and `!blockingSurfaceOpen(document)`; otherwise the show is dropped (the pointer must leave and come back). The card and
  any pending show are read at render: when the key `[boardId, pages.id, view.x, view.y, view.z, selection key,
  inline]` they were armed with differs from the current one, when `busy`, `composing`, `inline`, `tidyOpen` or a link
  bar holds, or when the live layout no longer has the object's link run with the same range and stored address,
  the card is `null` and its state and timer are cleared during render (the pattern `useCanvasInput` uses for its
  hover), so pan, zoom, a page change, editing and a selection change
  hide it or cancel it at once with no effect. Its label is `linkLabel` of the current `board`; `editable` is
  `!readOnly`; its place is `cardPlace` of `pos` of the hit's `first` box (its bottom is the line's bottom) and the size
  the card's `measure` callback ref last read (`offsetWidth`, `offsetHeight`; state changes only when the size
  changes).
- **Pressing and following** (LT8, LT11). `press(point)` answers a `LinkPress` when `linkUnder` gives a hit of an
  object that is not being edited: the board's id, `pages.id`, the object's id, its saved `run`, the run's stored
  `href` and `location.href`, captured now. `follow(press, up)` acts only when, at the release: `!inline`, no composition
  (the latest `composing`), the board's id, `pages.id` and `location.href` still equal the captured ones, and
  `linkUnder(up)` gives a **live** hit of the same object whose saved run has the same `start`, `end` and `href`; so a
  link added, changed or replaced during the press is never followed. Same-board
  (`sameBoardLink`): an object link → `pages.openLink(page, object, "click")`; a page link to another page →
  `pages.openLink(page, undefined, "click")`; a page link to the page already open → nothing (the click stays an
  ordinary click; answers `false`). Otherwise, when `linkAddress(href)` passes again: `window.open(href, "_blank",
  "noopener,noreferrer")`, called synchronously inside the pointer handler. It writes nothing to the board and answers
  `true` when it navigated or opened, and then records `followed = { id, run, at }` (the release time).
  `repeats(press)` is true when `followed` is set, `press` names the same object and run, and the press starts within
  500 ms of `at` (the second press of a double-click on the link just followed); any other press clears `followed`.
- **The Link button** (`controls.link`) is `linkButton` of the selection with `selectionReason` and the editor's range
  (`textSelection` while `inline`, else the whole text). **Amendment A2 (2026-11-26).** The Link button stays in the
  regular bar's Formatting group independently of `barShown`. The bar's existing visibility, `aria-hidden` and
  `inert` control whether the button is seen or usable. With `!barShown` the shortcut does nothing. The button's
  click while editing opens the bar for the range (a collapsed caret inside a link: that whole run,
  `linkAt`). Not editing, it records a pending open for the whole text and calls `edit()` (the bar's **Edit text**
  route of `use-editor-placement.ts`, panel cleared and fallback included). **Edit link** on the card works for
  editors with any selection, including an empty one, when `commandReason` is empty and Tidy up is closed. It
  records a pending open for the run, calls `select(id)` and then
  `edit(object)`. The bar opens only from `placed(accepted)`, which `useEditorPlacement` calls from its existing fit
  effect after it has decided (that effect runs after its focus effect, so the canvas editor already has focus):
  `placed(true)` with a pending open for the selected object selects the pending range in the field
  (`setSelectionRange` through `toUnits`) and opens the bar; `placed(false)`, called **before** the Objects-panel
  fallback takes focus, drops the pending open and opens nothing. A pending open is also dropped at render when the
  selection no longer holds exactly its object or editing ended.
- **The link bar** (`controls.bar`) exists only while the bar is open, `inline` is true, exactly that object is
  selected, `!readOnly`, and the object's `text` equals the text recorded when the bar opened; otherwise it is `null`
  and its state is cleared during render, with no notice (LT3's "closes when editing ends by any other path", a role
  change, and a remote change of the text, which cancels the pending link), and a **focus handoff** is recorded. `left` is computed by the context bar (below). `submit()` is
  Return in the field: it applies when `linkAddress` passes; when the trimmed text is not empty and fails, it sets
  `refused`; when empty it does nothing. `apply()` and `remove()` call `finishTextSession()`, then one
  `commit({ ...model.current, objects }, true)` whose only change is that object's `marks`
  (`setLink(o.marks, o.text, start, end, href)` or `setLink(…, null)`), then close. `close()` (Escape, Apply, Remove,
  an outside press) clears the bar's state and records a focus handoff. Every close path hands focus off only **after
  the commit** (effect 2): to the editor with the stored range selected when the object is still being edited, else
  to the scene. `editor.open` is true while the bar is open and `editor.highlight` holds the stored range in code
  points. Opening the bar from inside a link with a collapsed caret also selects the run in the field.
- **Paste onto words** (`editor.paste`): only while `inline`, for a rich-text object with a non-empty range, no
  composition, no plain-text paste key noted by `editor.key` since the last paste, no file, `!ownCopy(text/plain)`
  (raw, untrimmed), and `pastedLink(text/plain)`: then `setLink` over the range in one commit, and it answers `true`
  (the field prevents the default; the text does not change, so no `remap` runs).
- **Copy link to object** (`controls.copy`): **Amendment A2 (2026-11-26).** With exactly one object selected, the
  button is part of the measured regular context bar, in every table mode as well, independently of `barShown`.
  The existing bar visibility, `aria-hidden` and `inert` govern whether the button is seen or usable. The button is
  absent from the Tidy up bar and the link bar. The fit rule, placement and App.tsx substitutions are unchanged.
  The label is `copyObjectLabel(objectKind(o.type).kind)`; its click calls `navigator.clipboard.writeText(pageLink(location.href,
  o.page, hosted?.boardId, o.id))` inside the click and then `setMessage` with `objectCopied(kind, !!hosted)` or
  `clipboardRefused`. The card's Copy link writes the stored `href` the same way, with `LINK_WORDS.copied`.

**Effects.** Exactly **two** passive effects and no layout effect:
1. **Listeners**, mounted once (empty dependencies; it reads the latest state through a ref): a `window` `keydown`
   listener that hides the card on Escape; a `window` `pointerdown` listener in the capture phase that cancels a
   pending show, hides the card when the press is outside it and, while the link bar is open, closes the bar when the
   press is outside `.link-bar`, stops that press (`preventDefault()` and `stopPropagation()`) and marks the next
   `click`; and a `window` `click` listener in the capture phase that, when marked, stops that one click
   (`preventDefault()`, `stopPropagation()`) and clears the mark, so the outside press does nothing else, a button
   under it included (LT3). Its cleanup removes the three listeners and clears both card timers.
2. **Focus handoff**, after every render (no dependency list): when a handoff is recorded it clears it and focuses the
   editor (`editor.current`, when `inline` and the bar's object is still the one selected and being edited) and selects
   the stored range in it (`setSelectionRange` through `toUnits`, clamped to the text), else `scene.current`. It does
   nothing else.

The address is **not** written here: `use-pages.ts` is its one writer (below).

It imports `react`, `../text-links`, `../page-links`, `nextphase-board-rules/*` and types only from
`../team/hosted-board`, `../view`, `../geometry` and `../text-runs`; never another state hook, `ui/` or `scene/`. It
holds no `sticky` word and no type-name comparison (the rules type-name guard covers state hooks).

**`apps/web/src/ui/link-bar.tsx`** — two exports, no hook or state, React imported only for types:
- `LinkGlyph({ name, size })`: interaction v53's 24-unit icons (`viewBox="0 0 24 24"`, `fill="none"`,
  `stroke="currentColor"`, `stroke-width="1.8"`, round caps and joins, `aria-hidden="true"`) for `name` `link` (the Link
  button), `copy-object` (Copy link to object), `unlink`, `apply`, `page`, `gone`, `outside` and `object`, at `size`
  px (20 in the context bar, 18 in the link bar and card buttons, 16 for the card's icon).
- `LinkBar({ bar, top })`: `<div class="link-bar" role="group" aria-label="Link">` at `left: bar.left`, `top`, holding
  the field (`input type="text" inputmode="url" autocomplete="off" spellcheck="false"`, `aria-label`, placeholder,
  `autoFocus`, `onFocus` selecting all of its text, `aria-invalid` and `aria-describedby="link-refusal"` while
  `refused`, and an `onKeyDown` on the **field only** that calls `bar.submit()` on Return and prevents its default),
  **Remove link** (`button.icon-button`, `onClick={bar.remove}`, disabled unless `canRemove`) and **Apply link**
  (`button.icon-button.link-apply`, `onClick={bar.apply}`, disabled unless `canApply`), each with its
  `<span class="tooltip">` and native Return and Space activation, and while `refused` the line
  `<p id="link-refusal" class="link-refusal">`. The bar's own `onKeyDown` handles only Escape (`bar.close()`, with
  `stopPropagation`) and keeps Tab and Shift+Tab inside the bar; it has no Return handler.

**`apps/web/src/ui/link-hover-card.tsx`** — `LinkHoverCard({ card })`, no hook or state: `null` when `card` is
`null`; otherwise `<div class="link-card" role="group" aria-label="Link details">` at `card.left`, `card.top`, with
`ref={card.measure}`, `onPointerEnter={card.enter}` and `onPointerLeave={card.leave}`, holding
`<span class="link-icon">` (the label's icon: `LinkGlyph` for `page`, `gone`, `outside` and for `object` with no
`tool`; for an object with a `tool`, the bottom palette's glyph: `Icon` for `Sticky`, `Shapes`, `Text`, `Section`,
`Table` and `Mind map`, `DrawingIcon` for `Draw`, and the Image button's glyph for `Image`), `<span class="link-label">`
(class `muted` when `label.muted`), `<span class="divider">`, **Copy link** (`button.icon-button`, the existing
`Duplicate` icon) and, when `card.editable`, **Edit link** (`button.icon-button`, the existing `pencil` icon), each
with its `<span class="tooltip">`. It imports `type LinkCardModel` from `../text-links`, `LinkGlyph` from
`./link-bar`, `Icon` from `../icons` and `DrawingIcon` from `./drawing-tools`.

#### Underlines: layout and drawing

**Links never change layout** (LT6). `layoutRuns` keeps splitting pieces by flags only (`RunStyle` stays
`Pick<Mark, Flag>`; a link-only mark gives its tokens no style), and `Piece` and `RunLine` keep their shapes, so line
breaks, widths, heights and every glyph's position are today's. In `use-object-layouts.ts` the choice between the plain
Konva text (`runs: null`) and `layoutRuns` tests **flag marks** (`marks.some(m => m.bold || m.italic || m.strike)` or
`usesShapePaint`), not `marks.length`, so a note with links but no flags keeps today's single drawing. For a
link-free document this is today's behaviour exactly (every stored mark has a flag).

**Spans.** `text-runs.ts` gains `type LinkSpan = { href: string; start: number; end: number; line: number; x: number;
width: number; lineWidth: number }`, `type LineSource = { start: number; length: number }` (the code points of `text`
that a drawn line shows, kept **separately from `Piece`**), and two pure functions:
- `lineSources(text, lineTexts: string[]): LineSource[]`: each **full** line (never an ellipsised one) is located in
  `text` by searching forward from the previous line's end for that line's text, which skips exactly the whitespace and
  line breaks a wrap or a paragraph consumed; `length` is the line text's code-point count.
- `linkSpans(text, marks, lines: RunLine[], sources: LineSource[], measure): LinkSpan[]`: for drawn line `i`, its
  pieces are walked from `sources[i].start`, and only their first `sources[i].length` code points are considered (so a
  synthetic `…` is never part of a span); for every maximal stretch of those code points that carry the same link
  (document v23's coverage), within each piece, `x = piece.x + measure(piece text before the stretch, piece.style)` and
  `width = measure(piece text through the stretch's end, piece.style) − measure(piece text before it, piece.style)` (the
  same font, so kerning across the boundary is the drawn one), and `lineWidth` is the line's width.

`use-object-layouts.ts` adds `links: LinkSpan[]` to every layout (`[]` unless the object is rich text and some mark has
a `link`), computed from the saved `o.text` and `o.marks` (underlines are not drawn for the object being edited):
- **notes with flag marks**: `lines = layoutRuns(...)` as drawn, `sources = lineSources(o.text, lines' texts)`;
- **shapes**: the drawn `lines` of `shapeTextLayout`, with `sources` from the **full** layout at the same width
  (`layoutRuns(o.text, o.marks, textBox(o).width, measure)`): drawn line `i` takes full line `i`'s source, except an
  ellipsised last line (its text differs from the full line's), whose `length` is its drawn text's code-point count
  minus one (the synthetic `…`);
- **the plain path**: a `Konva.Text` measured exactly as the plain drawing (`TEXT_LAYOUT`, the font size,
  `textBox(o).width`, the saved text), its `textArr` turned into one-piece `RunLine`s (`{ width, pieces: [{ text,
  style: {}, x: 0, width }] }`), with `sources = lineSources(o.text, textArr texts)`.

`ObjectLayout` (`scene/note-body.tsx`) gains `links: LinkSpan[]`; every other layout the hook makes carries
`links: []`. Hit boxes (`linkBoxes`) come from the same spans, so the `…` is never clickable.

**Drawing.** `NoteBody` and `ShapeBody` gain a `pixelScale: number` prop (screen pixels per board unit) and draw, after
their text, one Konva `Line` per span: `points` `[x, y, x + span.width, y]` with `x` as `linkBoxes` places it, `stroke`
the type's text colour (`objectType(o.type).textColor(o)`), `strokeWidth = t`, `lineCap="butt"`, `listening={false}`,
where `f = textUnits(o.textSize)`, `t = max(1, round(f × pixelScale / 16)) / pixelScale` and `y = lineTop + f × 1.45 / 2
+ 0.47 × f + t / 2` (LT6's top edge plus half the thickness, in board units; `lineTop` as `linkBoxes`). In `NoteBody` the
lines sit inside the existing clip `Group`; neither part draws them for an object being edited. Strikethrough keeps
its native `textDecoration="line-through"`; `textDecoration` never says `underline`. `BoardDrawing` gains an optional
`pixelScale?: number` and passes `pixelScale ?? view.z` to both parts; `scene/export-drawing.tsx` passes
`pixelScale={fit.scale}` (it draws at zoom 1 and is captured at `fit.scale`), so image and PDF exports draw LT6's
values at their own scale.

#### The text edit range

`remap(marks, before, after, edit?)` (document v23) gets the editor's actual edit when there is one; document v23 uses
it for **link** coverage only, and flags keep today's prefix/suffix diff exactly. `ContentField` gains an optional
`textSelection?: TextSelection | null` prop (the field's selection in code points, tracked today by `onSelect`
and `onFocus`, so at an `input` event it is still the selection **before** the change):
- **Typing, replacing, deleting (Backspace, Delete, word and line deletes) and pasting** reach `onChange`; the field
  calls `changeText(value, edit)` with `edit = editRange(textSelection, e.nativeEvent?.inputType, text, value)` when
  `textSelection` names this object and the field's value before the change (`text`) equals the object's saved text,
  else `edit` is `undefined`.
- **Composition**: `onCompositionStart` calls `links.compositionStart(textSelection)` (when it names this object), and
  `onCompositionEnd` passes `links.compositionEdit()` (that range, then forgotten) as the third argument of
  `commitText(selectedId, value, edit)`.
- **The link paste** (LT5) changes no text, so no `remap` runs.
- **Remote updates, Undo and Redo, and programmatic sets** (a page or history change, template and paste builders,
  `use-object-layouts.ts`' draft preview, `ui/format-preview.tsx`) pass no `edit`: the prefix/suffix fallback.

`use-geometry-edits.ts`: `changeText(input, edit?)` passes `edit` to `commitText(id, value, edit?)`, which calls
`remap(o.marks, o.text, value, edit)`. A mind node's newline replacement keeps the code-point count, so its range still
fits. Nothing else in the hook changes; still no effect.

#### The address and object links

**One writer.** `use-pages.ts` is the only module that writes the address (interaction v53 LT10–LT12):
`writeAddress(next, boardId)` writes `pageLink(location.href, next, hostedBoard, object)` where `object` is the **valid
live selection**: exactly one id in `getSelection().ids` that is an object of the open board on page `next`, not hidden
(`hiddenIds`), while no history preview is shown (`input.team?.history.previewing`); otherwise `undefined` (no
`object`). **Amendment A1 (2026-11-26).** The `settledObject` ref remembers the object id, or `undefined`, written by
the last write made while `getSelection().settled` was true. A write while the selection is unsettled leaves this ref
as it was. While `getSelection().settled` is false (a pointer gesture is in progress), selection-driven writes are
skipped and no write is made whose only difference is `object`. A required page-change or address-repair write uses
`settledObject` only if that id passes the same validity checks on page `next`, and otherwise omits `object`.
**Amendment A3 (2026-11-26).** Its existing per-render effect (the second one, no dependency list) also calls the writer
whenever the board has been shown (`addressReady`, below). It compares the board, page and object it would write
against what it last wrote (`addressBoard`, `addressPage` and `addressObject`). It writes with `replaceState` when
that tuple changes, subject to A1's rule for unsettled selection. This covers an adoption, page or selection change,
remote delete or hide, and entering or leaving a history preview. The effect does not compare against the current URL
or repair other navigation. Interaction v46's hashchange path still repairs the address as before. The writer sets
`input.team.addressObject` to the object it wrote (or `undefined`).
It writes nothing while an object open (below) is waiting for its layout, so an incoming `object` stays in the address
until adoption settles.

**`pageLink(address, page, hostedBoard?, object?)`** (`page-links.ts`) is the one serializer: team
`<origin><path>#/b/<board>?page=<page>` plus `&object=<object>` when given; single-user: the first `page` parameter
replaced in place (later ones dropped, appended when absent), then, with `object`, the first `object` parameter replaced
in place, later ones dropped, appended after `page` when absent; without `object`, every `object` parameter removed;
every other part kept as encoded.

**Opening** (LT11, LT13) in `use-pages.ts`: `openLinkedPage(value?, object?, source = "hash")`, exposed as `openLink`.
With an object that exists and is not hidden: the object's own page opens (`openPage(page, source === "click")`), then
`select(id)`, then the view is centred on its box; hidden: its page opens with nothing selected; missing: LT13 with
`missingObjectNotice` (one notice). For `"hash"` it refuses with `openingReason()` as today; for `"click"` the caller's
checks (made synchronously at the release, below) stand in for `openingReason()`, because the render's `busy` is still
the pressed state. On first show, `showOpeningPage(next, value, showNotice, object?)` opens the object's page and
records a **pending centre** `{ boardId, id }`; the per-render effect centres the view on the first render whose
`getObjects()` holds that object of that board (its layout box through `objectBox`, so connectors and drawn objects use
their drawn bounds), at that page's opening zoom, then clears it. A hashchange or click centres at once from
`getObjects()` at the current zoom (the layout is already shown). `changed` passes `pending?.object`; the local adoption
passes `adoption.object`. A page link without `object` keeps today's behaviour exactly.

**Team blocked leave** (`team-app.tsx`): the existing `history.pushState(null, "", ownLink)` with the page link is
unchanged; right after it, when `board.page` and `board.addressObject` are set, `history.replaceState(null, "",
pageLink(location.href, board.page, board.boardId, board.addressObject))` restores the settled object, so Stay keeps it.

#### Following on release

`use-canvas-input.ts` decides a follow from values read synchronously at the release, on **both** release paths (the
viewer path that returns without a drag record, and the editor path through today's tail):
- `pointerDown`, in the Select branch with a hit object, records `linkPress = { press, cx, cy, pointerId, crossed:
  false }` with `press = linkPointer().press(p)` when the primary button is pressed with `e.isPrimary`, no Shift, Alt,
  Cmd or Ctrl, `!inline`, no voting mode, Tidy up not open, `press` is defined and `!linkPointer().repeats(press)`;
  otherwise `linkPress` is `null`. Every `pointerDown` first clears it (and calls `repeats`, which clears a stale
  `followed`); `cancel` clears it.
- `pointerMove` sets `linkPress.crossed` once the pointer has moved 3 screen pixels or more from `cx, cy` (it stays set,
  so a gesture that crossed never follows, even back at its start).
- `pointerUp` reads, before today's body, whether the press qualifies: the same `pointerId`, `!crossed`, a release less
  than 3 px from the press, no modifier on the release event, the Select tool, `!inline`, no voting mode and Tidy up not
  open. It then runs today's body unchanged (both paths) and, when the press qualified, calls
  `linkPointer().follow(press, point(e))` (which makes the live-hit, address and composition checks above), so a
  followed object link's selection comes after today's click selection.
- **Double-click.** The second press of a double-click on a link just followed records no `linkPress` (`repeats`), and
  `doubleClick` returns at once when `linkPointer().doubled(point(e))` answers `true` (the hook's `followed` names the object under that point; it is then cleared), so no
  editing starts on a moved or replaced view. Any other click, including a quick click on a different link or object,
  behaves as today and may follow.

#### Changed files

Exactly these files change, each only as stated, with the five new modules above. This is the list the brief
carries.

**Rules package** (document v23):

| File | Change |
| --- | --- |
| `packages/board-rules/src/marks.ts` | `Mark` gains `link?: string`; formats (flags and link) in its coverage and spans; `validMarks`, `normalize`, `toggle`, `segments` and `remap(marks, before, after, edit?)` as document v23 states. It does not import `text-link.ts` |
| `packages/board-rules/src/document.ts` | Schema 17, `BoardV17` and the aliases, `markOf` copying `link`, `validate`'s link checks and their precedence, `upgrade`, `empty` and `add` at 17, as document v23 states |
| `packages/board-rules/src/platform.d.ts` | The `URL` declaration above |
| `packages/board-rules/src/objects/registry.ts` | New `objectKind(type: string): { kind: string; icon: string \| null }`: interaction v53's kind of each stored type (`sticky` → `sticky`, `shape` → `shape`, `text` → `text`, `section` → `section`, `table` → `table`, `mindNode` → `mind map node`, `image` → `image`, `video` → `video`, `link` → `link card`, `connector` → `connector`, `stroke` → `drawing`, `tape` → `washi tape`) and its bottom-palette icon name (`Sticky`, `Shapes`, `Text`, `Section`, `Table`, `Mind map`, `Image`, `Draw` for drawings; `null` for video, link card, connector and washi tape). The registry may name types; the web modules may not |

**Sync, room and server** (sync v19, API v17, team templates v5; schema 16 → 17 where each pins it):

| File | Change |
| --- | --- |
| `packages/board-sync/src/codec.ts` | Mark keys gain `link` and its checks, in sync v19's precedence; `DecodedBoard` and the accepted versions 10–17; `readLiveBoard` returns `BoardV17` |
| `packages/board-room/src/edits.ts` | Both schema checks expect 17: the one after `readBoard` and before `repair` and `validate` (line 36 at `5474239`) and the one after `validate` (line 44) |
| `packages/board-room/src/room.ts` | New boards at 17; created boards accept 13–17; load and `upgradeStored` narrow to and set 17 |
| `packages/board-room/src/history.ts` | Backup verification accepts 10–17; the capture's legacy comparison gains 16 (sync v19 **History**) |
| `apps/server/src/routes/boards.ts` | Create and import accept schema 13–17 |
| `apps/server/src/templates.ts` | Template objects validated in a version 17 wrapper |

`packages/board-sync/src/document-adapter.ts` (it writes `o.marks.map(markOf)`), `packages/board-room/src/repair.ts`
(it calls `normalize`), `packages/board-sync/src/session.ts` and `packages/board-sync/src/undo.ts` need no code change;
type-only edits in `session.ts` and `undo.ts` that follow `readLiveBoard`'s return type are allowed, with no behaviour
change.

**Web app:**

| File | Change |
| --- | --- |
| `apps/web/src/App.tsx` | Wiring only, by the substitutions below |
| `apps/web/src/page-links.ts` | `readHostedBoardLink(fragment)` reads `#/b/<uuid>` optionally followed by `?` and one or two parameters joined by `&`, each `page=<v>` or `object=<v>`, each name at most once, either order, `<v>` any run without `&` and `#` (kept raw, as today); it answers `{ board }`, `{ board, page }`, `{ board, object }` or `{ board, page, object }` with only the keys given (so `#/b/<uuid>` keeps `{ board }` exactly) and `undefined` for anything else. New `readObjectValue(address, hostedBoard?)` (as `readPageValue`, for `object`). `pageLink(address, page, hostedBoard?, object?)` as above. New `missingObjectNotice = "That object no longer exists."`. The startup record also captures `object` (`readObjectValue`), and `takeStartupAdoption` returns it |
| `apps/web/src/team/links.ts` | `TeamLink`'s board member gains `object?: string` (type only; `parseLink` passes `readHostedBoardLink`'s answer through, so `#/b/<uuid>` keeps `{ kind: "board", board }`) |
| `apps/web/src/team/hosted-board.ts` | `onLinkedPage?: (value?: string, object?: string) => void`; `pendingPage?: { value?: string; object?: string }`; `openLinkedPage(value?, object?)` stores or passes both; the constructor's `pendingPage` takes the link's `object` too; a new field `addressObject?: string` (set by `use-pages.ts`). Nothing else |
| `apps/web/src/team/team-app.tsx` | The same-board `hashchange` branch calls `board.openLinkedPage(target.page, target.object)`; the blocked-leave branch's restore above. Nothing else |
| `apps/web/src/state/use-pages.ts` | The one address writer, opening and the pending centre (above). Input gains `getSelection?: () => { ids: ReadonlySet<string>; settled: boolean }` (read only in effects and handlers). Its result gains `openLink` and the getter `addressReady` (on a team board when `arrival.board` is the board's id and no `pendingPage` waits; on a single-user board when the board is not the local placeholder and `!startupPagePending()`). Still exactly two passive effects |
| `apps/web/src/state/use-canvas-input.ts` | Input gains `linkPointer?: () => LinkPointer` (type from `../text-links`), called only inside event handlers. `pointerMove` calls `move(point(e), e)`; `pointerLeave` also calls `leave()`; the release rule and double-click rule above (`linkPress`). Still exactly two passive effects |
| `apps/web/src/state/use-page-keys.ts` | Input gains `openLink?: () => boolean`; in the existing non-text-field Cmd/Ctrl block, `isLinkShortcut(e)` with the scene as target and no composition calls it and prevents the default when it answers `true`. Still no effect |
| `apps/web/src/state/use-editor-placement.ts` | `edit(target?: Item)`: with `target`, its checks read `target` instead of the render's `item` (Edit link starts editing an object it has just selected); without it, unchanged. Input gains `placed?: (accepted: boolean) => void`: in its existing fit effect, for a rich-text object, `placed(false)` is called immediately before `fallbackEditor()` and `placed(true)` when the effect ends without falling back. Still exactly three passive effects |
| `apps/web/src/state/use-geometry-edits.ts` | `changeText(input, edit?)` and `commitText(id, value, edit?)` pass `edit` to `remap` (above). Still no effect |
| `apps/web/src/state/use-object-layouts.ts` | The flag-mark test for the plain path and `links` on every layout (above). Still no effect |
| `apps/web/src/text-runs.ts` | `LinkSpan`, `LineSource`, `lineSources` and `linkSpans` (above). `layoutRuns`, `Piece`, `RunLine`, `RunStyle`, `Measure` and `lineOffset` unchanged |
| `apps/web/src/scene/note-body.tsx` | `ObjectLayout` gains `links`; the `pixelScale` prop and the underline `Line`s inside the clip (above). Still no hook |
| `apps/web/src/scene/shape-body.tsx` | The `pixelScale` prop and the underline `Line`s (above). Still no hook |
| `apps/web/src/scene/board-drawing.tsx` | The optional `pixelScale` prop passed to `NoteBody` and `ShapeBody` as `pixelScale ?? view.z`. Still no hook |
| `apps/web/src/scene/export-drawing.tsx` | Passes `pixelScale={fit.scale}` to `BoardDrawing` |
| `apps/web/src/ui/context-bar.tsx` | A `textLinks: LinkControls` prop. The Link button after Strikethrough inside the Formatting group (`button.icon-button.link-button`, `LinkGlyph name="link" size={20}`, `aria-pressed`, `disabled`, `aria-describedby` `link-reason` or `selection-reason`, its `<span class="tooltip">`, its `mousedown` default prevented, no `title`). A `copyLink` element (the Copy link to object button: `button.icon-button`, `LinkGlyph name="copy-object" size={20}`, its tooltip, never disabled, its `mousedown` default prevented so the editor keeps focus and editing continues; only when `textLinks.copy.shown`) placed right after `moveToPage` in every branch: in `objectCommands` (default, link card and image bars, and the table bar's object mode for editors), as `TableControls`' new `copyLink` prop (below) and in the washi tape bar before Duplicate, and as `<>{moveToPage}{copyLink}</>` given to `StrokeControls` and `ConnectorControls` (so before Delete there; those two files do not change). While `textLinks.bar` is not `null` the section is hidden (`visible` false: `visibility: hidden`, `inert`, `aria-hidden`) and a sibling `<LinkBar bar={textLinks.bar} top={contextTop} />` follows it, with `bar.left = clamp(contextLeft + contextWidth / 2 − 178, 12, size.w − 368)` computed here (356 wide, its centre on the bar's centre, kept 12 px inside) |
| `apps/web/src/ui/table-controls.tsx` | A `copyLink?: ReactNode` prop, rendered in **every** mode, for editors and viewers: in the table (object) mode for editors it is already inside `children` (`arrangeTools` then `objectCommands`), so it is not added twice; in the table mode for viewers (where `children` is dropped), and in the cell, row, column and cell-editing modes, it is rendered **last**. No other change |
| `apps/web/src/ui/content-field.tsx` | Optional props `links?: EditorLinks` and `textSelection?: TextSelection \| null`, with no-op defaults: without `links` the field behaves as today (no shortcut, no paste-to-link, no outline class, blur unchanged), and without `textSelection` or a native `inputType` the edit is `undefined`, so existing callers and fixtures (`tests/connectors.test.mjs`) pass unchanged. With `links`, while `inline` and the object is rich text: in `onKeyDown`, `links.key(e.nativeEvent)` runs before the flag shortcuts and prevents the default when it answers `true`; `onPaste` calls `links.paste(e.nativeEvent)` and prevents the default when it answers `true`. `onBlur` returns at once, changing nothing, when `links.keepsEditing(e.relatedTarget)` (focus moved into `.link-bar`). The textarea has the class `link-open` while `links.open`. It draws the selection highlight described in Amendment A4. The edit range of **The text edit range** (`onChange`, composition). The table cell field is unchanged; the Objects panel's use gets no shortcut, paste-to-link or bar (`inline` false) and passes the edit range as the canvas editor does |
| `apps/web/src/ui/format-preview.tsx` | It ignores `link`: a preview is drawn only when some mark has a flag, and adjacent `segments` pieces with equal flags are joined before drawing, so the Objects panel's preview is today's |
| `apps/web/src/storage.ts` | As storage v6: the board list's `newer` test is `schemaVersion > 17` |
| `apps/web/src/board-file.ts` | As board file v7: the newer test is `schemaVersion > 17` |
| `apps/web/src/team/templates-rules.ts` | As team templates v5: `templateBoard` validates in a version 17 wrapper |
| `apps/web/style.css` | Only the twenty-one rules below, appended at the end of the file |

**Unchanged.** `clipboard.ts` (the object clipboard's `structuredClone` keeps each mark's `link`; `plainText` carries
text only); `state/use-editing-commands.ts` (`toggleFormat` keeps links through document v23's `toggle`; Duplicate and
paste copy marks whole); `state/use-hosted-board.ts` (centring waits for the layout in `use-pages.ts`);
`state/use-storage-session.ts` (the startup record is read and written in `page-links.ts`); `ui/objects-panel.tsx`,
`ui/stroke-controls.tsx`, `ui/connector-controls.tsx`, `ui/link-controls.tsx`, `scene/inline-editor.tsx`,
`icons.tsx`; `board-export.ts` (it passes `fit` to `drawExport` already); `table-csv.ts`; `link-cards.ts` and
`state/use-link-cards.ts` (they name `BoardV16`, `ItemV16`, which document v23 keeps as names of the current board and
item). No other web file changes.

#### Amendment A4 (2026-11-26)

While the link bar is open, `ui/content-field.tsx` puts an absolute, pointer-transparent, `aria-hidden` layer
behind the inline textarea. A hidden mirror keeps the field value in one text node, with the field's available
width, wrapping, padding, font, line height and alignment at the current zoom. The callback ref measures the
stored range with a DOM Range using UTF-16 offsets, draws opaque `#aec9f4` rectangles for the measured lines
and clips them to the field's scroll viewport. The rectangles follow field scrolling and resize. The textarea
draws its original text and colour. When the field has focus, CSS hides the layer and the native selection shows.
Closing the bar removes the layer and its ref disconnects the observer and scroll listener. The module and React
effect counts are unchanged.

The card's Edit link uses the existing `commandReason` through App.tsx substitution 6. The card also checks the
current layout and stored run before retaining a pending show or a visible card.

#### App.tsx wiring

App.tsx changes only on existing lines, so it keeps its 264 newlines and the budget test's limit stays **264**.
Exactly these substitutions, applied in this order to the current App.tsx (each `from` occurs once):

| # | From | To |
| --- | --- | --- |
| 1 | `import { useLinkCards } from "./state/use-link-cards";` | `import { useLinkCards } from "./state/use-link-cards"; import { useTextLinks } from "./state/use-text-links"; import { LinkHoverCard } from "./ui/link-hover-card";` |
| 2 | `getObjects: () => allDisplayedObjects,` | `getObjects: () => allDisplayedObjects, getSelection: () => ({ ids: selected, settled: !busy }),` |
| 3 | `edit, textEditing: !!textSession.current, invalidObjectText, animated: images.animated, bitmaps: images.bitmaps,` | `edit, textEditing: !!textSession.current, invalidObjectText, animated: images.animated, bitmaps: images.bitmaps, linkPointer: () => textLinks.pointer,` |
| 4 | `composing, busy, readOnly, pos, tableCell: tableEntry.draft?.cell, setView,` | `composing, busy, readOnly, pos, tableCell: tableEntry.draft?.cell, setView, placed: (accepted) => textLinks.placed(accepted),` |
| 5 | `command, clipboardCommand, openExport: exporter.open, toggleFormat,` | `command, clipboardCommand, openExport: exporter.open, openLink: () => textLinks.shortcut(), toggleFormat,` |
| 6 | `getView: () => view, scene, getStore: () => store.current, isAlive: () => alive.current });` | `getView: () => view, scene, getStore: () => store.current, isAlive: () => alive.current }); const textLinks = useTextLinks({ hosted: team?.hosted, pages, board, model, commit, objects: displayedObjects, objectLayouts, selected, select, textSelection, inline, edit, editor, finishTextSession, scene, readOnly, busy, composing, tool, tidyOpen: tidy.open, barShown: size.w >= 768 && contextFits, commandReason, selectionReason, ownCopy: tableData.ownCopy, view, size, pos, setMessage });` |
| 7 | `setTextSelection={setTextSelection} toggleFormat={toggleFormat}` | `setTextSelection={setTextSelection} toggleFormat={toggleFormat} links={textLinks.editor} textSelection={textSelection}` |
| 8 | `<span id="selection-reason" className="sr-only">{selectionReason}</span>` | `<span id="selection-reason" className="sr-only">{selectionReason}</span><span id="link-reason" className="sr-only">{textLinks.controls.link.own ? textLinks.controls.link.reason : ""}</span>` |
| 9 | `links={links.bar} tapeSelection={tapeSelection}` | `links={links.bar} textLinks={textLinks.controls} tapeSelection={tapeSelection}` |
| 10 | `<BoardQuestion {...boardQuestion} /><ExportDialog {...exporter.dialog} />` | `<BoardQuestion {...boardQuestion} /><ExportDialog {...exporter.dialog} /><LinkHoverCard card={textLinks.card} />` |

`textLinks` is declared on the hook-call line (6), after every value it takes; substitutions 2, 3, 4 and 5 read their
values only inside functions that run in effects or event handlers, never during render. The hook call stays
composition only (`useTextLinks` is imported from `./state/`), so "App.tsx is composition only" holds. In
`tests/modules.test.mjs` the App composition test is titled "0001-W27 App composition changes only its recorded
substitutions", its comment names web modules v51 too, and it gains these ten pairs, in this order, at the end of its
list; its line-count assertion is unchanged and must pass.

#### CSS

`apps/web/style.css` gains these **twenty-one** rules followed by the A4 selection highlight rules. Both blocks
follow every existing rule, so the prefix byte comparisons in `tests/pages.test.mjs` (everything before
`/* Pages:`) are untouched. Each override below is either of higher specificity or equal and later.

```css
.link-bar { position: absolute; display: flex; align-items: center; gap: 4px; box-sizing: border-box; width: 356px; height: 40px; padding: 6px; background: #302d36; color: white; border-radius: 10px; box-shadow: 0 4px 14px rgba(20,18,26,.22); z-index: 6; }
.link-bar input { box-sizing: border-box; width: 280px; height: 28px; padding: 0 8px; border: 1.5px solid #8a73e6; border-radius: 6px; background: #1d1b21; color: white; font: 13px system-ui; }
.link-bar input::placeholder { color: #8f8a96; }
.link-bar input:focus-visible { outline: none; }
.link-bar input[aria-invalid=true] { border-color: #ff8a80; }
.link-bar button, .link-card button { width: 28px; height: 28px; min-width: 28px; min-height: 28px; padding: 0; border: 0; border-radius: 6px; background: transparent; color: white; }
.link-bar button:disabled { opacity: .38; }
.link-bar .link-apply:not(:disabled) { background: #7051cf; }
.link-bar button:hover:not(:disabled), .link-card button:hover:not(:disabled) { background: #57525f; color: white; }
.link-bar .link-apply:hover:not(:disabled) { background: #6142be; }
.link-bar .link-refusal { position: absolute; left: 0; top: calc(100% + 4px); box-sizing: border-box; width: max-content; max-width: 360px; margin: 0; padding: 6px 10px; border-radius: 6px; background: #302d36; color: #ffb4ab; font: 12px/1.35 system-ui; }
.link-card { position: absolute; display: flex; align-items: center; gap: 2px; box-sizing: border-box; height: 36px; padding: 0 4px 0 10px; background: #302d36; color: white; border-radius: 8px; box-shadow: 0 4px 14px rgba(20,18,26,.22); white-space: nowrap; font: 500 13px/1 system-ui; z-index: 6; }
.link-card .link-icon { display: inline-flex; width: 16px; height: 16px; margin-right: 8px; color: #d9d6de; }
.link-card .link-icon svg { width: 16px; height: 16px; }
.link-card .link-label { max-width: 260px; margin-right: 8px; overflow: hidden; text-overflow: ellipsis; }
.link-card .link-label.muted { color: #b9b5bf; font-style: italic; }
.link-card .divider { width: 1px; height: 20px; margin: 0 4px; background: rgba(255,255,255,.18); }
.link-card button svg { width: 18px; height: 18px; }
.context button.link-button[aria-pressed=true] { background: #7051cf; color: white; border-radius: 6px; }
.context button.link-button[aria-pressed=true]:hover:not(:disabled) { background: #6142be; color: white; border-radius: 6px; }
.inline:has(textarea.link-open) { outline: 3px solid #7051cf; outline-offset: 4px; }
```

| Rule | Outranks | Specificity (a,b,c) |
| --- | --- | --- |
| `.link-bar input:focus-visible` | the shared `input:focus-visible` ring (the field shows focus by its border only) | 0,2,1 > 0,1,1 |
| `.link-bar button, .link-card button` | `.icon-button`'s 40 × 40 and the shared `button` rule's `min-width: 40px; min-height: 40px` (style.css lines 17–20 at `5474239`) | 0,1,1 > 0,1,0 and 0,0,1 |
| `.link-card button svg` | the reused `Icon` glyphs' 20 × 20 (`Duplicate`, `pencil`), so the card's Copy link and Edit link icons are 18 px | 0,1,2 over attributes |
| `.link-bar button:disabled` | the shared `button:disabled` opacity 0.45 | 0,2,1 > 0,1,1 |
| `.link-bar button:hover:not(:disabled)`, `.link-card button:hover:not(:disabled)` | the shared `button:hover:not(:disabled):not([aria-disabled=true])` `#f1eff5` | 0,3,1 = 0,3,1, later |
| `.link-bar .link-apply:hover:not(:disabled)` | the rule above for Apply link | 0,4,0 > 0,3,1 |
| `.link-card .divider` | the shared `.divider` | 0,2,0 > 0,1,0 |
| `.context button.link-button[aria-pressed=true]` | `.context button`'s transparent background | 0,3,1 > 0,1,1 |
| `.context button.link-button[aria-pressed=true]:hover:not(:disabled)` | `.context button:hover:not(:disabled)`'s `#29272e` icon (style.css line 293 at `5474239`) and the shared hover fill, so the hovered pressed Link keeps a white icon on `#6142be` | 0,5,1 > 0,3,1 |
| `.inline:has(textarea.link-open)` | none: it adds today's `.inline:focus-within` look while focus is in the bar | 0,3,1 |

##### Selection highlight CSS

Amendment A4 appends the following after the twenty-one link rules.

```css
.inline textarea.link-open { position: relative; z-index: 1; }
.link-selection { position: absolute; overflow: hidden; pointer-events: none; }
.link-selection-mirror { width: 100%; visibility: hidden; }
.link-selection span { position: absolute; background: #aec9f4; }
.inline textarea.link-open:focus + .link-selection { visibility: hidden; }
```

Focus-visible for every new button (Link, Copy link to object, Remove link, Apply link, the card's Copy link and Edit
link) is the shared `button:focus-visible` rule (3 px solid `#7051cf`, offset 3 px) and the shared
`.icon-button:focus-visible .tooltip`; no button has its own active (pointer-down) look. The unpressed Link button and
Copy link to object keep the bar's shared rest, hover and disabled looks. All buttons keep the class `icon-button`, so
the existing tooltip rule shows their `<span class="tooltip">`.

#### Effect guards and module lists

In `tests/modules.test.mjs`, titles that change say "through 0001-W27 v1", the new names inserted in sorted order:

| Test | Change |
| --- | --- |
| "the package holds exactly its modules" | Gains `text-link.ts` (between `styles.ts` and `transition.ts`): 19 files |
| "rules modules ask the registry instead of naming types" | `packageRules` is `["document.ts", "marks.ts", "styles.ts", "text-link.ts", "transition.ts"]` |
| screen parts | Thirty-seven modules, gaining `link-bar.tsx` and `link-hover-card.tsx` (around `link-controls.tsx`) |
| state hooks | Thirty hooks, gaining `use-text-links.ts` (after `use-text-entry.ts`) |
| New: "the text links hook holds exactly two passive effects" | `use-text-links.ts` has exactly two `useEffect(` and no `useLayoutEffect` |
| App budget | Unchanged: at most 264 newlines |
| App composition | The ten substitutions above |

Every other guard is unchanged and must pass: screen and scene parts hold no hook and import React only for types;
state hooks never import each other, `ui/` or `scene/`; no file but App imports `state/`; non-team files import
`team/` only as types; rules modules (`text-links.ts` among them) import no React or Konva and name no type
literally; scene parts stay 22, object-type modules 13 (`registry.ts` changes, no file is added), team modules 57; the
canvas input and Pages hooks still hold exactly two passive effects, the editor placement hook three; the page keys,
editing commands, geometry edits and object layouts hooks still hold none.

#### Counts

From v50: **30 state hooks**, 22 scene parts, **37 screen parts**, the rules package's **19 files** and 13
object-type modules; 57 team modules, the board-sync list (twelve modules) and every other effect count unchanged.

#### Tests

Two new unit files (`npm test`), each self-contained: every check is named (`X11-R01`… and `X11-W01`…) and imports the
module it tests dynamically inside the check, so on the baseline each fails by its own name instead of failing the
file.

**`tests/text-link-rules.test.mjs`** (rules package): document v23's **Verification** items for `linkAddress`,
`linkAt`, `touchesLink`, `setLink` (grapheme snapping, and none without `Intl.Segmenter`), `remap` with and without
`edit`, `toggle`, `normalize`, `segments`, `validMarks`, `validate` (schema 17, the rich-text rule, the address rule,
the normal form, a `link` at 16 refused, the error precedence) and `upgrade` 16 → 17; and that `text-link.ts` and
`marks.ts` load without the DOM (`globalThis.document` undefined).

**`tests/text-links.test.mjs`** (web): `readHostedBoardLink` and `parseLink` with `object` alone, `page&object`,
`object&page`, an empty value, a repeated name, a third parameter, a trailing `&` (bad) and `#/b/<uuid>` alone (exactly
`{ board }` and `{ kind: "board", board }`); `readObjectValue`; `pageLink` with and without `object` on both kinds,
including a single-user address with `object` before `page`, duplicate `page` and `object` keys, and encoded unrelated
parts kept as encoded; `sameBoardLink` for a team page link, object link and bare board link, another board, another
origin or path, a single-user link with the open board's key and with another key, and an unreadable `href`;
`objectKind` for every registry type and `copyObjectLabel`, `objectCopied` (both board kinds) and `capitalised`;
`linkLabel` for an outside link, a page link after the page is renamed, an object link (first non-empty line, the
61-code-point cut, an empty text and a whitespace-only text each giving the capitalised kind, an image), and missing page and object (muted gone);
`firstLine`; `linkTooltip`, `isMac`, `isLinkShortcut` (Shift+Cmd+U, Shift+Ctrl+U, no Shift, with Alt, composing) and
`isPlainPasteKey`; `layoutRuns` giving the same lines and pieces with and without a link-only mark; `linkSpans` for a
plain line, a flagged piece with a link inside it (measured prefix, the `AV` kerning measure), a link across a wrap
(the skipped space not underlined, two spans on two lines), a line after a blank paragraph, and a shape ellipsis line whose next, clipped line holds a literal `…` (the synthetic `…` never underlined, and no span or box from the clipped line); `lineSources`;
`linkBoxes` for a sticky and a shape at known positions (equal to the scene parts' formulas), a span partly below the
note's clip (cut) and wholly below it (left out); `linkUnder` choosing the topmost object, missing outside a box,
skipping the object being edited, and giving the saved maximal run for a link spanning two lines and two flag marks;
`cardPlace` at the left, right and bottom edges; `linkButton`'s four reasons in order, `own`, and `pressed` for a range
inside one link, across two, and a caret inside; `pastedLink` (one address, two tokens, a refused scheme);
`editRange` for typing, replacing a selection, Backspace, Delete, a word delete each way, an unknown `inputType` and
`historyUndo`; `toUnits` with astral characters; `blockingSurfaceOpen` on a small DOM double (a visible menu counts; one
hidden by `display: none`, `[hidden]`, `visibility: hidden` or a hidden ancestor does not). In the same file, source checks that `scene/note-body.tsx` and `scene/shape-body.tsx` never
write `underline` in a `textDecoration` and draw `Line`s from `layout.links`, and that `style.css` ends with the
twenty-one link rules followed by the A4 highlight rules.

Post-check coverage in the same file includes X11-W19 (Edit link from an empty, different or multiple selection,
the command reason, Tidy up and read-only), X11-W20 (the highlight's DOM presence, stored range, wrapped lines,
scroll and resize geometry, and removal on field focus or bar close), and X11-W21 (a pending or shown hover is
cleared on a range or address change or loss of the run from the layout, and resting again shows the current link).

Existing files: `tests/modules.test.mjs` as above; `tests/text-runs.test.mjs`, `tests/pages.test.mjs`,
`tests/page-links.test.mjs` and `tests/team.test.mjs` are unchanged and must pass (`Piece` keeps its shape, and the CSS
sits after the compared prefix); tests that pin the newest schema 16 follow document v23, sync v19, storage v6, board
file v7 and team templates v5 as the brief's dispositions list.

### Link cards (v50)

Replaces [web modules v49](0001-web-modules-v49.md), whose registry, import, composition, one-state-owner, team
guards, counts, seams, CSS and App.tsx rules remain word for word except as below. v49's own text follows as the part
**Team media transfers (v49)**, word for word with its headings one level lower.
[Interaction v52](0001-interaction-v52.md) adds link cards with **five new web source modules** (a rules module, a
client, a scene part, a screen part and a state hook). **App.tsx changes only by its wiring points** (below), on
existing lines, so its line count and budget stay; `style.css` gains **two rules** (the link controls' block).

#### Change note (v49 → v50)

- New part **Link cards (v50)**: the five modules and their exported names, the changed web files, App.tsx's exact
  substitutions, the two CSS rules, the arrival's gate and commit path (one retry on a matched refusal), the bounds
  helper, the face drawn inside the stored rectangle, Save a copy's cold-cache thumbnail, the new hook's effects, the
  guards and counts, and the tests.
- Counts: 29 state hooks, 22 scene parts, 35 screen parts, the rules package's 18 files and 13 object-type modules;
  57 team modules (unchanged).
- Nothing else in v49 changes.

#### Team media transfers (v49)

Replaces [web modules v48](0001-web-modules-v48.md), whose registry, import, composition, one-state-owner, team
guards, counts, seams, CSS and App.tsx rules remain word for word except as below.
[Interaction v51](0001-interaction-v51.md) lets team imports and team templates carry pictures and videos with
exactly **one new web source module**, a team module. **App.tsx does not change. No state hook, scene part, screen
part, CSS rule or effect is added**; one existing hook and one type gain a single property (below).

##### New module

`apps/web/src/team/media-transfer.ts` (header `// SPDX-License-Identifier: Apache-2.0`): every new request of
[hosted storage v15](0003-hosted-storage-v15.md) ("Web client transfers") and these pure helpers:

| Export | What |
| --- | --- |
| `mediaOf(objects, held?)` | The media files of an object array in media order (interaction v51, Terms): `{ hash, kind: "picture" \| "video" }[]`, each hash once |
| `percent(done, total)` | `Math.floor(done × 100 ÷ total)`, clamped to 0–100; `0` when `total` is 0 |
| `Progress` | A small class over a total byte count that keeps the highest `percent` reported (never decreasing) |
| `watchdog(ms, onStall)` | A restartable no-progress timer (`setTimeout`) with `poke()` and `stop()` |
| `runImport(…)`, `runTemplateSave(…)`, `runTemplateAdd(…)` | The three sequences of interaction v51, one file at a time, each taking its transfer calls as parameters (so tests pass doubles) and reporting `(percent)` and ending with `{ ok: true, … }` or `{ ok: false, reason }`, `reason` the exact interaction v51 text |
| `templateAdds(hosted)` | The board-lifetime add runner: one per `HostedBoard` object (a module-level `WeakMap`), so an add outlives the Templates panel that started it. It holds `adding` (read by every mounted panel; a change calls its listeners) and runs `runTemplateAdd`, sending the toast through `hosted.toast` |

It imports only `./api`, `./auth`, `./config`, `./pictures.ts`, `./templates-rules.ts`, `../board-file.ts` and
`nextphase-board-rules/*` (types aside). It holds no React.

##### Changed web files

| File | Change |
| --- | --- |
| `apps/web/src/team/import.ts` | `PICTURES_REASON` and the media refusal are removed. `importBoard(file, send)` keeps its signature and its no-media path word for word; for a file with media it returns, before sending, the board, the title and the bundle's pictures and videos as `media` (each `{ hash, type, bytes, blob }`), and refuses with board file v5's existing budget reasons. Its imports stay `../board-file.ts` and `nextphase-board-rules/*` only (the existing guard) |
| `apps/web/src/team/home-import.tsx` | For a file with media: `runImport` with the progress text `Importing “<file>”… <p>%` through the existing `notify(text, true)`; failures through today's `notify(…, false)` frame with interaction v51's reasons. The import is bound to the component's lifetime: its unmount (the existing `alive` flag's effect) aborts every transfer through one `AbortController`, and the finish is never sent after it. No-media path unchanged |
| `apps/web/src/team/templates-rules.ts` | `templateBoard` no longer throws for valid image and video objects (every other check, and the size check, unchanged); new pure `pictureLine(counts, bytes)` and `mib(bytes)` / `mibUp(bytes)` (interaction v51); `TEMPLATE_MEDIA_BYTES = 20_971_520`; `parseTemplate` unchanged (list and mutation answers keep their exact keys) and a new `parseTemplateDetail(value)` accepting exactly those keys plus `media` (an array of asset entries, each validated, sorted by hash). Still no React and no `./auth` import (the existing rules-file guard) |
| `apps/web/src/team/templates.ts` | The controller's save and replace take the media list and run `runTemplateSave`; its `pending` state carries the percentage; its error text follows interaction v51 for media saves (today's texts unchanged otherwise); `read` parses the detail with `parseTemplateDetail` and returns it (so it now carries `media`); Add decides on the **fresh** detail: with media it goes to `templateAdds(hosted)`, which calls today's `commands.insertStored` only on success; a template without media is added exactly as today (T8-S13's stale-card refresh unchanged) |
| `apps/web/src/team/templates-section.tsx` | The save and replace dialogs' picture line, the sizes request on open, `Saving… <p>%` / `Replacing… <p>%`, the error line's new texts; Add of a template with media calls `commands.closeTemplates()` and then starts `templateAdds(hosted)`; every card's Add is also disabled while `templateAdds(hosted).adding` |
| `apps/web/src/team/pictures.ts` | `upload`, `uploadVideo` and `download` gain an optional last `signal?: AbortSignal` (hosted storage v15); nothing else changes |
| `apps/web/src/activities.ts` | `TemplateCommands` gains `closeTemplates: () => void` (type only) |
| `apps/web/src/state/use-editing-commands.ts` | `templateCommands` gains `closeTemplates: () => setPanel("")`; nothing else changes (its effect count and imports unchanged) |

`apps/web/src/team/hosted-board.ts`, `home.tsx`, `team-app.tsx`, `ui/palette.tsx`, every other state hook, `App.tsx` and
`style.css` **do not change**. The add's progress uses the existing `hosted.toast(text)`; because the team toast
hides 5,000 ms after its last change, `runTemplateAdd` re-sends the current text at least every 2,000 ms while it
runs.

##### Counts and guards

From v48: **57 team modules** (`media-transfer.ts` added); 28 state hooks, 21 scene parts, 34 screen parts, the
rules package's 17 files and 12 object-type modules, the board-sync list and every effect count unchanged. In
`tests/modules.test.mjs` the team-module test lists `media-transfer.ts` in sorted order and its title says "through
0012-W6 v1"; the `import.ts` import guard and the rules-style list are unchanged and must pass. The "0012-W4 App
composition" test is unchanged and must pass (App.tsx is byte-identical to `ea4203c`).

##### Tests

New unit file `tests/team-media.test.mjs` (`npm test`): `mediaOf` order and kinds; `percent` and `Progress`
(rounding down, never decreasing, the add's half-and-half count); `watchdog` with a fake timer; `pictureLine` and
`mib`/`mibUp` texts (`Includes 1 picture (0.3 MiB …)`, `Includes 2 pictures and 1 video (…)`, `27 MiB` rounding
up); `importBoard` returning media for versions 2 and 3 and refusing over-budget files with the board file v5
reasons; each sequence with transfer doubles: every success and failure answer mapped to its exact text, one file at
a time, nothing finished, saved or inserted after a failure, the add's insert called once only after every upload
answered `ok`; a valid image object accepted by `templateBoard` and refused by `templateObjects(value)` without
`held`; `parseTemplateDetail` (the `media` key accepted only there); `templateAdds` outliving a panel and its `adding`
flag. Existing files updated as listed in the brief's dispositions.

#### Link cards (v50)

##### New modules

Each begins with `// SPDX-License-Identifier: Apache-2.0`. Every value they hold is interaction v52's.

**`apps/web/src/link-cards.ts`** — a rules module: no React, Konva or `react-dom` import, no value import from
`team/`, and it names object types only through the registry (`isLink`, `linkType()`, `typeForTool("Text")`), as the
existing rules-module guards require. It owns the paste test, the sizes, the looks, the card's states and texts, the
history amendment and the thumbnail.

| Export | What |
| --- | --- |
| `LINK_LOADING_MS` | `20_000`: the stale rule |
| `LINK_REQUEST_MS` | `15_000`: the request's abort |
| `LINK_ADDRESS_LIMIT` | `1_000`: the longest address the paste test accepts |
| `LINK_SIZES` | `{ loading: [306, 288], horizontal: [480, 114], titleVertical: [306, 100], titleHorizontal: [480, 64], linkOnly: [480, 64] }`; the vertical width `306` (the sizes a browser writes) |
| `CARD_SIZES` | The nine card sizes document v22 accepts with any state (the union), for the tests |
| `keepInBounds(rect)` | `rect` with `x` and `y` kept within the document bounds (interaction v52 **Document bounds**): `x = min(max(x, −1e6), 1e6 − width)`, the same for `y`; unchanged when already within |
| `faceLayout(look, width, height, lines?)` | Every part's box for a look's face drawn inside a stored rectangle of `width × height` (interaction v52 **Drawing at the stored size**); at the look's written size it equals `LINK_LOOK`'s values |
| `LINK_LOOK` | Every drawing value of interaction v52's looks table and common rules (colours, fonts, line heights, offsets, box widths, the glyph's two path strings), read by the scene part and the tests |
| `type LinkLook` | `"loading" \| "vertical" \| "horizontal" \| "titleVertical" \| "titleHorizontal" \| "linkOnly"` |
| `pastedAddress(text)` | Interaction v52 paste test step 4, the address rules and the `href` length: `{ kind: "card", url }` (the parsed `href`, only when the rules pass and `href.length <= 1000`), `{ kind: "text", text }` (the trimmed text, for a refused address or one whose `href` is longer than 1,000 characters) or `null` (not one address: today's path) |
| `addressAllowed(url: URL)` | Link preview v1's F1–F2 on a parsed URL |
| `linkLook(card, now)` | The card's look, the stale rule included |
| `verticalHeight(titleLines, descriptionLines)` | `210 + 20·Lt + (Ld > 0 ? 4 + 17·Ld : 0)` |
| `cardLines(card)` | `{ title, description }` read back from a vertical card's saved height (the inverse of `verticalHeight`); `{ title: 2, description: 2 }` for any other height. These are **caps** on the lines drawn, never a count to fill |
| `cardSize(look, lines?)` | `{ width, height }` of a look (`lines` for vertical) |
| `pasteCard(board, url, centre, page, now, service)` | `{ board, id }`: the new loading card (or, with `service` false, the link-only card) at the view centre, kept within the document bounds, in the section under its centre |
| `pasteText(board, text, centre, page, height)` | `{ board, id }`: the refused address's text object (interaction v52), kept within the document bounds |
| `type LinkResult` | `{ title: string; description: string; site: string; asset?: string } \| null` (`null`: the link-only finish) |
| `LINK_FINISH_KEYS` | `["title", "description", "site", "asset", "state", "layout", "width", "height"]`: the keys a finish sets |
| `finishCard(card, result, lines?)` | The finished card, built from `card` **as the board holds it at the commit**: ready (texts cut to 300/500/100 code points, `site` falling back to the host) or link-only, at its new size; it changes only `LINK_FINISH_KEYS`, and `x` and `y` only through `keepInBounds` |
| `withLayout(card, layout, lines?)` | The card with a new `layout` and that look's size, its `x` and `y` kept except through `keepInBounds` |
| `cardToText(board, id, height)` | `{ board, id }`: Change back to text, the text object in the card's place, kept within the document bounds |
| `amendHistory(history, card)` | A `History` (from `./history.ts`, type only) in which every version of that card (each `before` and `after` with the card's `id`, `url` and `requestedAt`), past and future, takes the card's `LINK_FINISH_KEYS` values and keeps its own `x`, `y` (through `keepInBounds` at its new size) and every other key, so a move recorded while the card loaded keeps both positions |
| `thumbnailSize(width, height)` | `{ width, height }`: at most 640 on the longer side, never enlarged |
| `makeThumbnail(bytes)` | `Promise<{ hash, picture } \| null>`: sniff, decode (a GIF's first frame), scale, PNG if any alpha below 255 else JPEG 0.85, SHA-256; `null` when it cannot. It takes optional `decode` and `encode` functions so unit tests run without a browser |
| `LINK_ABOUT_LOCAL`, `LINK_ABOUT_TEAM` | The two About texts, exactly |
| `aboutLine(hosted, service)` | `LINK_ABOUT_TEAM` on a team board, `LINK_ABOUT_LOCAL` with a service, else `""` |
| `type LinkBar` | The bar model: `{ only: boolean; count: number; look?: LinkLook; layout?: "vertical" \| "horizontal"; open(): void; setLayout(layout): void; toText(): void }` |

It imports only `nextphase-board-rules/*`, `./image-assets.ts`, `./sections.ts`, `./geometry.ts` and `./history.ts`
(types).

**`apps/web/src/link-preview-client.ts`** — the public route's client and the answer reader both routes share. No
React; no value import from `team/`.

| Export | What |
| --- | --- |
| `type LinkPreview` | `{ url: string; title: string; description: string; site: string; picture: { type: string; bytes: ArrayBuffer } \| null }` |
| `previewOrigin()` | The build's link preview origin: `typeof BOARD_LINK_PREVIEW_URL === "string" ? BOARD_LINK_PREVIEW_URL : ""` (toolchain v6's compile-time constant, `null` when unset; unit tests run without it) |
| `previewConfigured()` | `previewOrigin() !== ""` |
| `previewRequest(url, signal)` | The `RequestInit` both routes send: `POST`, body `JSON.stringify({ url })`, `Content-Type: application/json`, `credentials: "omit"`, `referrerPolicy: "no-referrer"`, `cache: "no-store"`, the signal |
| `readLinkPreview(reply)` | `Promise<LinkPreview \| null>`: a preview only for a 200 with a well-formed body (API v16), `bytes` decoded from base64 and at most 5,242,880; otherwise `null` |
| `requestLinkPreview(url, signal)` | The public route: `fetch(previewOrigin() + "/link-preview", previewRequest(url, signal))` through `readLinkPreview`; `null` when no service is configured, on any error and on abort |

**`apps/web/src/scene/link-body.tsx`** — `LinkBody({ object, bitmap, selected, zoom })`: draws one card in its look
(`linkLook(object, Date.now())`), its face laid out by `faceLayout(look, object.width, object.height,
cardLines(object))` inside the card's **stored rectangle** (which is also its hit area and outline), with
`react-konva` (`Group`, `Rect`, `Image`, `Text`, `Path`, `Circle`, `Arc`), the
picture cover-cropped through `Image`'s `crop` and clipped to the inner box (interaction v52: 1, 1, `width − 2` ×
`height − 2`, radius 7), every part at interaction v52's inside-the-border offsets, the 1-unit border stroked last,
texts with Konva's `wrap: "word"` and `ellipsis: true`, the site's and address's underline as its own 1-unit `Rect`
2 units below the alphabetic baseline (never Konva's `textDecoration`), and the selection outline (`stroke="#518de0"`, `strokeWidth={2 / zoom}`) as `ImageBody` draws a picture's. Like every scene
part it holds no hook or state, and it imports React only for types. It imports only `react-konva`,
`nextphase-board-rules/*` and `../link-cards`.

**`apps/web/src/ui/link-controls.tsx`** — `LinkControls({ bar, reason })`: the link bar's label, divider, Open link,
the `<span class="link-layout" role="group" aria-label="Link layout">` holding the two layout buttons, and Change
back to text, returned as a fragment so each is a direct child of `.context` except the two grouped buttons, with their inline SVG icons, labels, tooltips, `aria-pressed`,
`disabled` and `aria-describedby` exactly as interaction v52. No hook or state; it imports `type LinkBar` from
`../link-cards`.

**`apps/web/src/state/use-link-cards.ts`** — `useLinkCards(input: LinkCardsInput)`, returning
`{ paste, bar, aboutLine }`:

| Returned | What |
| --- | --- |
| `paste(next)` | The link step: wraps the next paste handler and passes the event to it untouched unless it acts (interaction v52) |
| `bar` | The `LinkBar` for the current selection |
| `aboutLine` | `aboutLine(!!hosted, previewConfigured())` |

`LinkCardsInput` is `{ hosted?: HostedBoard; page: string; board; model; commit; select; selected;
commandReason: string; tidyOpen: boolean; busy: boolean; composing: boolean; readOnly: boolean; editing: () =>
boolean; ownCopy: (text: string) => boolean; historyRef; updateHistory; lineCount; getView: () => View; scene;
getStore: () => LocalStore | null; isAlive: () => boolean }`. It owns the arrivals: one record per card it pasted (keyed by card id and
`requestedAt`, in a ref) holding its `AbortController`, its **opening** (the board's `boardId`, the `hosted` object,
and on a single-user board `getStore()`'s object) and its state (running, held, committed or ended). It measures `Lt`
and `Ld` with `Konva.Text` (`textArr.length`) in interaction v52's fonts and widths, as `use-object-layouts.ts`
measures text, and a text object's height with the passed `lineCount` and `savedHeight`. It asks the team route only
through `hosted.pictures.linkPreview(url, signal)` and uploads only through the existing
`hosted.pictures.upload(hash, bytes, signal)`; single-user boards ask through `requestLinkPreview` and store with the
existing `storePicture` and `tabPictures`.

**The gate, checks and holds** (interaction v52 **The arrival**). Before the upload and again before the finish's
commit it cancels the arrival (aborts, writes nothing) unless all of these hold: `isAlive()`; `board.boardId` equals
the opening's; `hosted` is the opening's object (both `undefined` on a single-user board); on a single-user board,
`getStore()` is the opening's object, `getStore().active` is true and `readOnly` is false (the active local writer);
on a team board, `hosted.snapshot.role` is `"owner"` or `"editor"`; and `model.current` holds a card with the
arrival's `id`, `url` and `requestedAt` in `state: "loading"`. On a team board, while `hosted.history.previewing` is
true (the board shown is a version preview, not the live document) the arrival holds at the gate; once
`Date.now() ≥ requestedAt + 15,000` with the preview still shown, it is cancelled. It holds a finish while `busy`,
`composing`, `editing()`, `tidyOpen` or `commandReason !== ""`, or, on a team board, while `!hosted.canEdit` (on a
single-user board a `readOnly` board cancels instead, above). On a single-user board it counts the picture budget
again at the finish (`boardPictures` of the board as it is then, plus the thumbnail, each hash once, against
`PICTURE_LIMIT`) and finishes without a picture when over.

**Commit path.** The finish is `finishCard` of the card read from `model.current` at the commit (so its `x` and `y`
are the board's then). On a single-user board it commits a finish with `commit(next)` (not recorded), then
`updateHistory(amendHistory(historyRef.current, card))`. On a team board it commits the finish with
`commit(next, false, undefined, undefined, undefined, undefined, card.id)`: the arrival option below, which ends in
`SharedUndo.amend` (sync v18) and is written as one update. On a team board it follows sync v18's **One retry**:
when `hosted.arrivalRefused(card.id)` answers `true` (the arrival's request was refused, synchronously or by the
room), it makes the link-only finish once by the same path, when the gate passes, the holds clear and the card is
still `loading` with the same `id`, `url` and `requestedAt`; after that it writes nothing more for that card.

**Change back to text** commits `cardToText`, selects the text object and then calls `scene.current?.focus()` (as the
Delete command returns focus), so an immediate Cmd/Ctrl+Z reaches `<main>`'s key handler.

It imports `react`, `konva`, `../link-cards`, `../link-preview-client`, `../image-assets`, `../table-csv`
(`isCanvasPasteTarget`), `../geometry` and types only from `../team/hosted-board`, `../history`, `../storage` and
`../view`; never another state hook.

**The arrival option** (the only path from the hook to `SharedUndo.amend`; every existing call keeps today's
behaviour because the new parameter is optional and last):

| File | Change |
| --- | --- |
| `apps/web/src/state/use-board-document.ts` | `commit(input, recordObject = false, orderIds?, opens?, movedPages?, tableHint?, arrivalOf?: string)`. With `arrivalOf` it records nothing locally, uses no group (neither `nameGroup` nor a text session's), leaves `pendingAdd` as it is, and calls `apply(next, undefined, movedPages, tableHint, arrivalOf)`; `apply` gains the same optional last parameter and passes it as `hosted.edit(next, group, movedPages, stepPage.current, tableHint, arrivalOf)`. On a single-user board `arrivalOf` changes nothing. Without it, `commit` and `apply` are unchanged |
| `apps/web/src/team/hosted-board.ts` | `edit(board, group?, movedPages?, page?, tableHint?, arrivalOf?: string)` passes `arrivalOf` to `session.edit` through the existing `deliberate`; its result is exactly today's (`false` when not admitted, else `deliberate`'s). In `changed`, a `refused` event whose `requestId` names a request in `session.requests` with `arrivalOf` (so a synchronous refusal, reported before `edit` returns, is matched too) runs today's refusal branch without the toast: `this.spotlight.clear(); this.clearPresence(); this.publish({ connected: false })` (no `words.refusedEdit`), and notes the card id in a private set. New `arrivalRefused(id): boolean` answers `true` once for a noted id and removes it (sync v18). Every other event is unchanged |
| `packages/board-sync/src/session.ts` | `Request` gains `arrivalOf?: string`. `edit(board, group?, movedPages?, page?, tableHint?, arrivalOf?: string)` passes it to `write(board, undefined, group, movedPages, page, tableHint, arrivalOf)`; `write` calls `this.history.amend(before, capture(this.doc), arrivalOf)` instead of `this.history.record(…)` when `arrivalOf` is set, and passes it to `sendEdit(update, group?, touched?, arrivalOf?)`, which sets it on the request object when it creates it, before storing it, the size check and `sendRequest` (sync v18). Otherwise unchanged; `undo`/`redo` never pass it |
| `packages/board-sync/src/undo.ts` | `SharedUndo.amend`, as sync v18 states |

**Effects.** Exactly **two** passive effects and no layout effect: (1) the lifetime effect, which aborts every
running arrival on unmount and on `pagehide`; (2) an effect after every render that makes held finishes when the
holds above have cleared (and the refused-arrival link-only finish), and arms one `setTimeout` for the next
`requestedAt + 20,000` among the board's loading cards (its firing re-renders, so every browser redraws a card that
turns stale, and the paster's browser makes the deadline's link-only finish). It never writes a card it did not paste.

##### Changed web files

Exactly these web files change, each only as stated (with the five new modules above and, outside `apps/web`, the
board-sync files of sync v18). This is the list the brief carries.

| File | Change |
| --- | --- |
| `apps/web/src/App.tsx` | Wiring only, by the substitutions below |
| `apps/web/src/clipboard.ts` | `plainText(snapshot)` also gives a card's `url` as its text (so a copied card is Board's own copy and pastes as a card) |
| `apps/web/src/board-file.ts` | As board file v6: a card's `asset` is carried and checked as a picture; schema 16 read |
| `apps/web/src/storage.ts` | As storage v5: the board list's `newer` test in `refreshList` becomes `schemaVersion > 16` (today `> 15`). Reading is unchanged: `decode` already accepts whatever document v22's `validate` accepts (schema 1–16) |
| `apps/web/src/state/use-board-document.ts` | The arrival option (above): an optional last `arrivalOf` on `commit` and `apply`. Behaviour of every existing call unchanged |
| `apps/web/src/team/hosted-board.ts` | The arrival option (above): an optional last `arrivalOf` on `edit`, and no refusal toast for an arrival's request. Behaviour of every existing call unchanged |
| `apps/web/src/state/use-editing-commands.ts` | `tableData` gains `ownCopy(text): boolean`, the table step's existing own-copy test (on the raw `text/plain`) moved into a named function (the table step calls it; behaviour unchanged). `changeStyle`'s two refusal checks (`!isMedia(o)`) also skip cards, so a selection mixing text and cards styles its text as one mixing text and pictures does. Still no effect |
| `apps/web/src/state/use-selection.ts` | `formattingIdeas` leaves out cards as it leaves out pictures and videos. Still no effect |
| `apps/web/src/state/use-object-layouts.ts` | `handlesVisible` is false when any selected rectangle is a card (`isLink`), beside the existing mind-node and tape conditions. Still no effect |
| `apps/web/src/state/use-geometry-edits.ts` | `resizeStart` leaves out cards (as tapes), and `resizedBoard` returns `model.current` unchanged when any selected object is a card (`isTape(o) \|\| isLink(o)` in its existing tape check), so no resize path changes a selection that holds a card. Still no effect |
| `apps/web/src/state/use-storage-session.ts` | `saveCopy` gathers every object's picture (`pictureOf(o) !== undefined`: images, videos' first frames and cards' thumbnails), reading or downloading a card's thumbnail as an image's picture. A card has no pixel size, so for a card's thumbnail **not in the tab's memory on a hosted board** (a cold cache) it downloads the bytes, sniffs the type (`signature`), **decodes them** (`decodePicture` on a provisional record, or `createImageBitmap`) to read the pixel width and height, builds `{ bytes, mime, pixelWidth, pixelHeight }`, validates it as a picture record (type sniffed equals `mime`, SHA-256 equals the hash, a decode of exactly that size), holds it in `tabPictures`, and only then writes its file entry; any failure is "a picture is unavailable". A thumbnail read from local storage or already held uses the stored record's own pixel size. The comparison with the object's pixel size and the JPEG check stay for images and videos only; the video step stays for videos only |
| `apps/web/src/ui/context-bar.tsx` | A `links: LinkBar` prop. When `links.only`, `<LinkControls bar={links} reason={selectionReason} />` takes the place the picture bar's `ImageControls` takes, followed by the existing arrange tools and object commands; Tidy up is not shown when `links.only` |
| `apps/web/src/ui/information-controls.tsx` | Takes `linkLine` and passes it to `InformationPanel` (App renders the popover only through it) |
| `apps/web/src/ui/information-panel.tsx` (the About popover) | A `linkLine: string` prop; when not empty, a second `<p>{linkLine}</p>` after the existing paragraph, with no class or style |
| `apps/web/src/ui/objects-panel.tsx` | `sizeReason` is `geometryReason`, else tape's existing text when the selection holds tape, else `Link cards can't be resized.` when **any** selected object is a card, else `""`; the size buttons' `title` follows the same order |
| `apps/web/src/scene/board-drawing.tsx` | `isLink(o)` dispatches to `<LinkBody object={o} bitmap={o.asset ? bitmaps.get(o.asset) : undefined} selected={selected.has(o.id)} zoom={view.z} />`, inside the existing `fade`, before the image branch. No new prop |
| `apps/web/src/team/pictures.ts` | `BoardPictures.linkPreview(url, signal)`: `POST <server>/boards/<board>/link-preview` with the bearer token and `previewRequest`, read by `readLinkPreview`; `null` on any error. (The team route needs the bearer token, which only team modules may import) |
| `apps/web/src/team/media-transfer.ts` | `mediaOf` lists a card's `asset` as a `"picture"`, in object order, so templates carry card thumbnails (team templates v4) |
| `apps/web/src/team/templates-section.tsx` | The picture line counts a card's thumbnail as a picture |
| `apps/web/src/team/import.ts` | As board file v6: a board whose only media are card thumbnails takes the media path; a card's thumbnail is decoded, size-checked and returned in `media` as a picture. Its imports stay `../board-file.ts` and `nextphase-board-rules/*` |
| `apps/web/src/team/templates-rules.ts` | As team templates v4: a valid `link` object is a valid template object and its `asset` is template media |
| `apps/web/style.css` | Only the link controls' block of two rules, placed together directly after `.context .paint-modes button[aria-pressed=true]`, exactly: `.context .link-layout { display: flex; align-items: center; gap: 4px; }` and `.context .link-layout button[aria-pressed=true] { background: #7051cf; border-radius: 6px; }` (interaction v52). No other rule changes |

**Unchanged.** `apps/web/index.html` (the build rewrites its CSP, toolchain v6); `state/use-context-bar.ts` (the
bar's existing `ResizeObserver` re-measures it when the layout buttons appear after the arrival); `state/use-export.ts`
(an export made before a card's thumbnail has decoded draws the card's picture box filled `#f1f0f3`);
`image-assets.ts` (`boardPictures`, `pictureBytes`, `writePictures` and `removeUnusedPictures` already follow the
registry's `pictureOf` and each object's `asset`, which now include a card's) and `board-export.ts` (it draws through
the scene's dispatch, which now draws cards): these two may take type-only edits if the compiler needs them, with no
behaviour change. No other web file changes.

##### App.tsx wiring

App.tsx changes only on existing lines, so it keeps its 264 newlines and the budget test's limit stays **264**. The
wiring points are **the paste step** (the import, the hook call and the paste chain), **the bar controls** and **the
About line**. The card body needs no App change: its drawing dispatch is in `scene/board-drawing.tsx`. Exactly these
substitutions, applied in this order to the current App.tsx (each `from` occurs once):

| # | From | To |
| --- | --- | --- |
| 1 | `import { VideoPlayer } from "./scene/video-player";` | `import { VideoPlayer } from "./scene/video-player"; import { useLinkCards } from "./state/use-link-cards";` |
| 2 | `pasteFiles: (files) => void images.pasted(files, () => clipboardCommand("Paste")), composing });` | `pasteFiles: (files) => void images.pasted(files, () => clipboardCommand("Paste")), composing }); const links = useLinkCards({ hosted: team?.hosted, page: pages.id, board, model, commit, select, selected, commandReason, tidyOpen: tidy.open, busy, composing, readOnly, editing: () => !!textSession.current, ownCopy: tableData.ownCopy, historyRef, updateHistory, lineCount, getView: () => view, scene, getStore: () => store.current, isAlive: () => alive.current });` |
| 3 | `onPaste={tableData.paste(hostedPaste ?? images.paste(() => clipboardCommand("Paste")))}` | `onPaste={tableData.paste(links.paste(hostedPaste ?? images.paste(() => clipboardCommand("Paste"))))}` |
| 4 | `          tapeSelection={tapeSelection} tidy={tidy} board={pages.canvas()} moveToPage=` | `          links={links.bar} tapeSelection={tapeSelection} tidy={tidy} board={pages.canvas()} moveToPage=` |
| 5 | `        infoButton={infoButton} panel={panel} busy={busy} composing={composing} toggle={toggle}` | `        infoButton={infoButton} panel={panel} busy={busy} composing={composing} toggle={toggle} linkLine={links.aboutLine}` |

The hook call stays composition only (`useLinkCards` is imported from `./state/`), so "App.tsx is composition only"
holds. In `tests/modules.test.mjs` the test "0012-W4 App composition changes only its recorded substitutions" gains
these five pairs, in this order, at the end of its list (its comment names web modules v50 too); its line-count
assertion is unchanged and must pass.

##### Effect guards and module lists

In `tests/modules.test.mjs`, titles saying "through 0012-W5 v1", the new names inserted in sorted order:

| Test | Change |
| --- | --- |
| "the package holds exactly its modules" | Gains `objects/link.ts` (document v22): 18 files |
| object types | Thirteen modules, gaining `link.ts` |
| scene parts | Twenty-two modules, gaining `link-body.tsx` |
| screen parts | Thirty-five modules, gaining `link-controls.tsx` |
| state hooks | Twenty-nine hooks, gaining `use-link-cards.ts` |
| New: "the link cards hook holds exactly two passive effects" | `use-link-cards.ts` has exactly two `useEffect(` and no `useLayoutEffect` |
| App budget | Unchanged: at most 264 newlines |
| App composition | The five substitutions above |

Every other guard is unchanged and must pass: screen and scene parts hold no hook and import React only for types;
state hooks never import each other, `ui/` or `scene/`; no file but App imports `state/`; non-team files import
`team/` only as types; rules modules (`link-cards.ts`, `link-preview-client.ts` among them) import no React or Konva
and name no type literally; the team module list stays 57; every other effect count holds (the editing commands,
selection, object layouts and geometry edits hooks still hold none).

##### Counts

From v49: **29 state hooks**, **22 scene parts**, **35 screen parts**, the rules package's **18 files** and **13
object-type modules**; 57 team modules, the board-sync list and every other effect count unchanged.

##### Tests

`tests/link-cards.test.mjs` (`npm test`, checks `X10-U00` onwards; each imports the new modules dynamically inside its
named check): `pastedAddress` (one address trimmed → card; whitespace inside, two addresses, plain words, `mailto:` →
`null`; `ftp://`, `127.0.0.1`, `0x7f.1`, `[::1]`, `localhost:8080`, a single-label name, a credentialed address, port
22 → text; 1,001 characters → `null`; an address of at most 1,000 characters whose `href` is longer, such as
`https://example.com/` followed by 330 `é`, → text); the link step passing a file paste, Board's own copy (compared
on the raw text, untrimmed) and a viewer's paste on untouched, and running before the picture and video step, which
would prevent even a file-less paste (X10-U00 with the table, picture and object paths); `linkLook` and the stale rule
at 19,999 and 20,000 ms; `verticalHeight`, `cardLines` and `cardSize` for every look; `faceLayout` equal to
`LINK_LOOK` at each written size, and at 306 × 288 for a stale card (the address row at 37, 136, 252 wide), a ready
vertical card (caps 2 and 2) and a title-only vertical card (site row at 255); `finishCard` and its cuts, reading `x`
and `y` from the card it is given and changing only `LINK_FINISH_KEYS` away from the edges; `withLayout` keeping `x`
and `y`; **document bounds edge regressions**: `keepInBounds`, and a 306-wide card at `x` 999,694 finished
link-only (480 wide), changed to horizontal, and changed back to text (each shifted left just enough: to `x`
999,520 for 480, 999,680 for the 320-wide text), a 480 × 64 card at `y` 999,936 changed back to a taller text object (shifted up), a paste with the view
centre beyond the edge (centred, then kept within), and `amendHistory` shifting only a version that would cross;
`cardToText` and its undo through `history.ts`; `amendHistory` over past and future, writing only `LINK_FINISH_KEYS`
(and the bounds shift); and through `history.ts`'s `record`, `undo` and `redo` with `amendHistory`, the
**single-user** rows of interaction v52's **Undo and Redo around an arrival**, as a local sequence separate from the
hosted ones (sync v18 **Verification**): paste → arrival → Undo → Redo; paste → move → arrival → Undo, Undo, Redo,
Redo (the move's positions kept, the finished card each time); paste → Undo before the arrival → Redo (same `id`,
finished when the arrival comes after); paste → Change back to text → Undo → arrival (same `id`, `url` and
`requestedAt`: the arrival **applies** to the restored card, and the finish reaches the conversion's versions, so Redo
and Undo of the conversion keep the finished card); Change back to text → arrival → Undo (nothing written; the restored
card stays `loading`); the gate: a single-user arrival cancelled (nothing stored or written) when the `LocalStore` is
closed or replaced or the board turns read-only, and a team arrival held while a version preview is shown and
cancelled at `requestedAt + 15,000`, finished when the live board returns before it; `thumbnailSize` and
`makeThumbnail` with doubles (640 px, JPEG 0.85, PNG when any alpha is below 255, a GIF's first frame, undecodable →
`null`); `readLinkPreview` for each status and malformed body; `aboutLine`'s three answers and texts.

**Amendment A5 (2026-11-25).** X10-U13 sends the concurrent move and arrival through the room in both save orders.
Case A accepts the move first and keeps the arrival's rectangle. Case B accepts the arrival first and keeps the
moved place at 306 × 288. In both cases every client converges to the same valid document with the finish keys.
In at least one case the save-order winner has the lower Yjs client ID (sync v18).
