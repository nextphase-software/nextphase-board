# 0001 — Interaction and browser contract

Contract version: 45 (for 0011-W1 brief v1, 2026-11-17). Status: Draft. When accepted it replaces
[interaction v44](0001-interaction-v44.md) for later work. Uses [document v20](0001-document-v20.md) and
[sync v15](0003-sync-v15.md).

Every rule in v44 (and, through it, v43 back to v4 and the 0001-W3 presentation) still applies except where
this version replaces or adds to it. This version adds **tables**, on local and hosted boards alike. Table
sizes are canvas units at 100 % (CSS px), scaled with the view as every object is; chrome (bars, menus,
tooltips, notices, grabbers, add bars) is not scaled.

## The Table tool

- A palette `icon-button` **immediately after the Section tool**, accessible name `Table tool`, tooltip
  `Table · ⇧T` (the existing tooltip look). Icon (20 × 20 viewBox, stroke 1.75, `currentColor`, round caps and joins):
  `<rect x="3" y="4" width="14" height="12" rx="2"/><path d="M3 8.5h14M3 12.3h14M8 4v12"/>`. Hover, focus,
  pressed and armed looks are the palette's shared `.icon-button` rules, unchanged.
- **⇧T** arms it: `event.code === "KeyT"` with Shift and no Alt, Control or Meta, on the canvas (not while a
  text field has focus, a menu is open or an input method is composing). Alt+Shift+T stays Tidy up.
- **Enter** with the Table tool armed places a 2 × 2 table at the point where Enter places other armed tools
  today.
- On hosted boards it is shown and hidden exactly as the other placement tools are. Unlike Image, it is
  shown on hosted boards.

**Placing.**
- A **click** (within the existing click tolerance) places a **2 × 2** table, columns **192**, rows **64**
  (384 × 128), its top-left at the click point.
- A **drag** places whole 192 × 64 cells: columns = ceil(|dx| / 192), rows = ceil(|dy| / 64) (dx, dy in canvas
  units), each at least 1 and at most 20 columns and 50 rows; the table grows from the press point toward the
  pointer. While dragging, a ghost of those cells is drawn at 55 % opacity with the table's look, and a label
  `C × R` (12 px white on `#302d36`, radius 4, padding 4 8) sits 10 right of and below the ghost's
  bottom-right corner on screen, kept inside the canvas area (moved left and up as needed).
- **Escape** during the drag cancels it and places nothing; the tool stays armed.
- After placing, the tool returns to Select and the new table is selected. One Undo step.

## The table

- Fill `#ffffff`; outline and grid lines 1 px `#d9dfe7`; outer corners radius **12**.
- Text: the table's text size (Small 14, **Medium 18**, Large 24, Extra large 32), `system-ui`, `#28272c`,
  top-left in each cell with **20** padding on every side. **Line height** is round(size × 1.35): 19, 24, 32,
  43. Text wraps at word boundaries within the cell's width minus 40, breaking a word longer than a line, by
  the canvas text measurement the sticky body uses.
- **Text height** of a cell is its number of wrapped lines × the line height (an empty cell: one line). The
  **drawn height** of a row is max(set height, tallest text height in the row + 40). With Medium text one
  line fills a 64 row exactly and two lines need 88.
- **Row growth.** A step that commits cell text (an edit, Delete content excepted) or changes the text size
  raises the set height of every row of that table whose text now needs more, to min(text height + 40,
  1,000), in the **same step**. Nothing lowers a set height except a border drag or a corner resize.
- The **drawn box** (document v20) is used for hit testing, the selection outline and handles, the context
  bar's position, Arrange, Tidy up, sections, find and zoom to fit, and presence outlines. Comment anchoring,
  live pin placement and detachment keep using the **saved** box (the shared comment rules are unchanged); a
  saved box differs from the drawn one only in document v20's two cases. `use-object-layouts.ts` provides it as it provides text objects' measured layouts.
- No connection dots on a table; connectors cannot attach to one.

## Selecting

Four selection levels, one at a time: the **table**, a **cell**, a **row** or a **column**.

- A click on an unselected table selects the **table** (Shift-click adds it to a multiple selection, where it
  is one object).
- A click on a cell of the table that is the only selected object selects that **cell**.
- A double-click on any cell selects and **edits** it (editors only).
- With a cell, row or column selected, a click on another cell of the same table selects that cell; a click
  outside clears the selection as today.
- The grabbers select a whole **row** or **column** (editors only).
- **Anchors.** A selected row's anchor cell is its cell in the first column; a selected column's anchor cell
  is its cell in the first row. "The selected cell's row (column)" below means the anchor cell's for a row or
  column selection.
- When the selected table no longer exists (deleted, undone, moved to another page), the selection clears.

**Looks.**
- Table selected: the app's 1 px `#518de0` outline and four 8 × 8 corner handles (white, 1 px `#518de0`); no
  side handles.
- Cell, row or column selected: a **2 px `#518de0`** outline over its edges. Editing: the same in `#7051cf`.
- **Grabbers** (cell, row or column selected; not editing; editors only), DOM buttons over the canvas. With
  a cell selected both show (its column's above, its row's at the left); with a row selected only that row's;
  with a column selected only that column's:
  - closed: a pill 20 × 6 (the row's 6 × 20), radius 3, fill `#8fbdf5`, centred **14** outside the table's
    top edge over the anchor cell's column and 14 outside its left edge beside the anchor cell's row; hit
    area 28 × 28 centred on it;
  - selected (its row or column is the selection): 16 × 16, radius 4, fill `#518de0`, a white grip of six
    2 × 2 dots in two columns and three rows, 2 apart, centred;
  - hover: fill `#518de0` (closed pill); focus-visible: 2 px `#518de0` outline, offset 2; active: fill
    `#3f78c9`;
  - names `Select row R` / `Select column C` (1-based); tooltip as the mind-map tip (12 px on `#302d36`,
    radius 4, 18 below).
- **Add bars** (table selected; or a cell, row or column selected whose anchor cell is in the last column
  (right bar) or last row (bottom bar); never while editing or dragging; editors only), DOM buttons: 24 thick,
  **8** from the table's drawn edge, the edge's full length, radius 6, fill `#dceafb`, a 14 px plus in
  `#1665d8` (stroke 2.2) centred; hover fill `#c6dcf7`; active `#b3d0f4`; focus-visible 2 px `#518de0`
  outline, offset 2. Names `Add column` (right) and `Add row` (bottom).
- Grabbers and add bars are children of `.scene` in the same stacking as `.mind-map-add` (v41), with
  `pointer-events` on the buttons only, placed with the view as the mind-map buttons are.

## Context bars

All use the live `.context` element (v44: fill `#302d36`, radius 12, height 40, padding 0 8, gap 4, white
14 px `system-ui`) with the existing viewport fit (`context-bar-position.ts`). Horizontally it is centred on
the table's drawn box with the table selected; on the selected cell's column with a cell selected or while
editing; on the selected column; and on the table with a row selected. Its bottom is **26** above the table's
drawn top with the table selected or while editing, and **48** above it with a cell, row or column selected
and not editing (clearing the column grabber). It is hidden while a border or corner is dragged.

| State | Bar, left to right (│ = the existing `.context` divider) |
| --- | --- |
| Table | `Table` │ Text size (the existing list) · `Add row` · `Add column` │ Arrange · Move to page (where shown today) · Duplicate · Delete (the live buttons) |
| Cell | `Cell` │ `Edit text` │ `n / 1,000` · `Row options` · `Column options` · `Delete content` |
| Editing | `Cell` │ `Done` │ `n / 1,000` |
| Row | `Row` │ `Row options` · `Delete row` |
| Column | `Column` │ `Column options` · `Delete column` |

Glyphs (20 × 20 viewBox, stroke 1.75, `currentColor`, round caps and joins), in buttons of the existing
`.context` look:
- `Edit text`: a text button, glyph then the words: `<path d="m4 12 9-9 4 4-9 9-5 1ZM11 5l4 4"/>`.
- `Done`: a text button, glyph then the word: `<path d="m4.5 10.5 3.5 3.5 7.5-8"/>`.
- `Add row`: icon button `<rect x="3" y="3" width="14" height="8" rx="1.5"/><path d="M3 7h14M10 13.5v4M8 15.5h4"/>`.
- `Add column`: icon button `<rect x="3" y="3" width="8" height="14" rx="1.5"/><path d="M7 3v14M13.5 10h4M15.5 8v4"/>`.
- `Row options`: icon button `<rect x="2.5" y="7" width="15" height="6" rx="1.5"/><path d="M6 3.5h8M6 16.5h8"/>`
  followed by a 12 px chevron (`<path d="m6 8 4 4 4-4"/>`, stroke 2).
- `Column options`: `<rect x="7" y="2.5" width="6" height="15" rx="1.5"/><path d="M3.5 6v8M16.5 6v8"/>` and the
  chevron.
- `Delete content`: icon button, eraser `<path d="m8 16-4-4 7.5-7.5 4 4L8 16Zm0 0h8M6 10l4 4"/>`.
- `Delete row` and `Delete column`: icon buttons, `<path d="M4 6h12M8 6V4h4v2m-6 0 .7 10h6.6L14 6"/>`.
- Icon buttons carry their name as `aria-label` and tooltip. Every bar control's hover, focus and pressed looks
  are the shared `.context` rules, unchanged.

**Row options** menu (heading `Row`): `Add row above` ⌥⇧↩ · `Add row below` ⌥↩ │ `Delete row` ⌫.
**Column options** menu (heading `Column`): `Add column to the left` ⌥[ · `Add column to the right` ⌥] │
`Delete column` ⌫.
- Look (NextPhase tokens, as v43's Move to page menu): 248 wide, padding 6, surface `#ffffff`, 1 px `#d9dfe7`,
  radius 12, shadow `0 12px 30px rgb(21 32 51 / 0.08)`; heading 12 px / 600 `#525d6c`, padding 8 10 6; items 36
  high, padding 0 10, radius 8, 14 px `#1b2433`, the shortcut 12 px / 500 `#525d6c` at the right; │ is a 1 px
  `#d9dfe7` separator with 6 margin above and below; the Delete item's text `#a3302a`.
- Item states are the existing `.page-menu` item rules: hover and focus fill `--np-sunken`, active fill
  `--np-line`, focus-visible the existing outline; a disabled item is at 40 % opacity, not focusable by arrows,
  with its reason as its tooltip.
- It opens 8 below its button, left edges aligned, in the stacking of `.page-menu`, with focus on its first
  enabled item. Arrow keys move between items, Return chooses, Escape closes and returns focus to the button;
  while a menu is open, keys go to it only.
- Its button is drawn white with ink `#29272e`, radius 8 while open, **including while hovered**: the open rule
  `.context button.table-menu-button[aria-haspopup][aria-expanded="true"]` (specificity 0,4,1) outranks the
  shared `.context button:hover:not(:disabled)` (0,3,1).

**Disabled.** `Delete row` / `Delete column` (bar, menu, key): disabled with the tooltip `A table needs at
least one row` (`…one column`) when the table has only one. Adding: disabled at 50 rows / 20 columns with
`A table holds at most 50 rows` (`…20 columns`).

## Adding, deleting, resizing

- **Add row / Add column** (bar or add bar) appends one at the end: a row of set height 64, a column of width
  192, empty. **Add row above / below** and **Add column to the left / right** insert one beside the anchor
  cell's row or column. The selection becomes the new row's cell in the anchor's column (the first column when
  the table was selected), or the new column's cell in the anchor's row (the first row).
- **Keys** with a cell, row or column selected (not editing), matched by `event.code` with exactly these
  modifiers: ⌥↩ (`Enter`, Alt) add row below; ⌥⇧↩ (`Enter`, Alt+Shift) add row above; ⌥] (`BracketRight`,
  Alt) add column to the right; ⌥[ (`BracketLeft`, Alt) add column to the left.
- **Delete or Backspace**: with a row or column selected, deletes it; the selection becomes the cell in the
  anchor's column (row) of the row (column) now at that place, or the one before when it was last. With a cell
  selected, clears its text (`Delete content`). With the table selected, deletes the table as today.
- **Border drags** (editors; table, cell, row or column of it selected): within 4 of a column border (inner or
  right edge) the pointer is `col-resize`; dragging sets that column's width (64–1,000); the others keep theirs
  and the table grows or shrinks on the right. Row borders likewise with `row-resize`; the minimum is
  max(64, min(1,000, the row's tallest text height + 40)). While dragging, a 2 px `#518de0` line over the
  border extends 6 past the table at each end. One Undo step on release; the selection is unchanged.
- **Corner handles**: every column width and row set height scales by the drag's factor in that direction,
  rounded to whole units and clamped to its bounds; then row growth applies. The table is then placed so that
  the corner of its **drawn** box opposite the dragged one is where it was before the drag. In a multiple
  selection resized together, a table scales the same way and its top-left follows the selection's existing
  resize rule. A table is kept inside the board's coordinate limits as every rectangle is today.
- **Column width changes** (border drag, corner resize, the Objects panel controls) apply row growth in the
  same step, so a narrower column that makes text wrap raises its rows' set heights.
- **Keyboard size route.** The Objects panel's existing **Wider**, **Narrower**, **Taller** and **Shorter**
  controls (10 units each) resize a selected table as a corner resize by 10 units with the top-left fixed.
  Individual row and column borders, and selecting a whole row or column, are pointer-only in this version;
  every action on a row or column also has a menu or key route from a selected cell.

## Keys and editing

**Table selected:** Return selects the top-left cell. Escape clears the selection.

**Cell selected (not editing):**
- Return, double-click or `Edit text` edits it (editors). Typing a character does not start editing; the
  existing canvas letter keys act as they do with any selection.
- Arrow keys select the neighbouring cell, stopping at the edges. Tab / Shift+Tab select the next / previous
  cell in reading order, with no wrap past the last or first cell. Escape selects the table.

**Row or column selected:** arrows, Tab and Return do nothing; Escape selects the table.

Every key a table, cell, row or column selection handles is consumed (`preventDefault` and stopped) before
the page's commands see it; keys it does not handle reach them as today. **Focus:** after a grabber or add-bar
click, a bar button, a menu choice or Escape out of a menu item's action, focus returns to the canvas, so the
table keys keep working; a menu closed with Escape returns focus to its button. The bar's controls are reached
by the existing context-bar keyboard route.

**Editing a cell.**
- A native text field exactly over the cell's text box (inset 20, the table's text size, line height and
  look), caret at the end. An empty cell shows the placeholder `Add text` in `#79737f`. Accessible name
  `Row R, column C of <the table's Objects-panel name>`.
- Return inserts a line break. Tab / Shift+Tab end this cell's edit and edit the next / previous cell in
  reading order; in the last (first) cell, Tab (Shift+Tab) ends editing with that cell selected. Escape or
  `Done` ends editing with the cell selected. Arrow keys, Home, End and selection keys stay inside the text.
  While an input method is composing, none of these act.
- **Commits.** The draft belongs to one cell (table id, row id, column id). Each change that is valid and not
  composing commits, as sticky text does today, all of one editing session forming one Undo step; at
  composition end the text is validated and committed.
- **Over 1,000 code points.** The count shows in `#a3302a`, the draft is not committed, and Tab, Shift+Tab,
  Escape and `Done` keep editing with the notice `A cell holds up to 1,000 characters.` Any other exit
  (clicking elsewhere, blur, switching page, Save, a reload or a remote delete of the cell) ends editing and
  discards the uncommitted part: the cell keeps its last committed text.
- **Others' changes to the cell you edit** (hosted boards): exactly the existing rule for an edited sticky
  (the hosted board clears drafts and the field shows the board's text), except during a composition: the
  field is not replaced while composing (native input-method editing continues; table keys stay suppressed).
  At composition end the composed string is inserted into the **live** text at the composition's start
  position mapped through the other person's change (an insertion before it shifts it; a deletion that
  covered it moves it to the deletion's start), replacing nothing of the other person's text; the caret goes
  after it. Then the field shows the live text.
- **Focus look.** The 2 px `#7051cf` cell outline is the only focus treatment: the inline editor's and
  textarea's inherited focus outlines are suppressed for cell editors.
- **Small or clipped cells.** When the cell's on-screen text box is narrower than 40 or lower than 24 px, or
  not fully inside the canvas area, Return or `Edit text` first moves and zooms the view as find's zoom to an
  object does, to show the cell at 100 %, then opens the editor.

**Announcements.** Moving the selected cell announces `Row R, column C: <text>` (or `…: empty`) through the
existing polite notice path.

## Undo

One Undo step each: placing a table; each add or delete of a row or column; each border drag; each corner or
Objects-panel resize; a text size change; Delete content; each cell's editing session. Undo and Redo restore
cells by their row and column ids, so no other cell's text moves. After an Undo or Redo the selection is the
table when it still exists, and clears otherwise. Hosted Undo is atomic per step ([sync v15](0003-sync-v15.md)).

## Other features

A table works as one object for Duplicate (new ids throughout, document v20), copy and paste, Arrange, Tidy
up, sections (as a shape: dropped into, wrapped by, moved with), groups, Move to page, board files, find (which
does **not** search cells), presence and selection, comments (attached to the table, named `Table`) and voting
(one target). The Objects panel names it `table N` (numbered as other objects) followed by ` · C × R`, and does
not offer it among its Add options. The context bar and vote label is `Table`.

## Tables on hosted boards

Everything above applies to owners and editors. **Viewers** can select a table and its cells (to read); they
get no grabbers (so no row or column selection), add bars, border or corner drags, editing, menus or table
keys, and their cell bar shows only `Cell` and the count.

Other people's changes reach you as any other edit ([sync v15](0003-sync-v15.md)). Your selection and editing
stay, except:
- **The row or column holding your selected or edited cell, or your selected row or column, is deleted by
  someone else** (origin `remote`): your editor, menu or drag on it closes, the selection becomes the table,
  and the notice reads `<label> deleted a row you were editing.` (`…a column you were editing.`; `…a row you had
  selected.` / `…a column you had selected.` when not editing), `<label>` as v44's remote-delete notice. In a
  `reload` change the selection becomes the table with no notice. Your own delete never shows it.
- **The table is deleted:** the selection clears (existing object rule).

Others see your selection as the existing presence outline round the **whole table**; no cell is highlighted
for them.
