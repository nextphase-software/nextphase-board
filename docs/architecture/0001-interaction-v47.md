# 0001 — Interaction and browser contract

Contract version: 47 (for 0011-W2 brief v1, 2026-11-20). Status: Draft. When accepted it replaces
[interaction v46](0001-interaction-v46.md) for later work. Uses [document v20](0001-document-v20.md) and
[sync v15](0003-sync-v15.md), both unchanged.

Every rule in v46 (and, through it, v45 back to v4 and the 0001-W3 presentation) still applies except where
this version replaces or adds to it. This version adds **table data exchange**, on local and hosted boards
alike: a new table from spreadsheet data pasted on the board, from a CSV file pasted, dropped on the board or
chosen with Import CSV…; table cells copied as tab-separated text; and a table exported as a CSV file. A new
table is an ordinary table (v45): nothing new is stored, sent or recorded beyond the one edit that adds it.

## Words

- **Spreadsheet data**: the clipboard of a paste event when its `text/plain` value is not empty and either
  holds a tab character (U+0009) or its `text/html` value contains `<table` followed by whitespace or `>`
  (any letter case). The HTML value is only tested for that text: it is never parsed, read or used.
- **A CSV file**: a `File` whose name ends with `.csv` (any letter case) or whose `type` is `text/csv`.
- **A batch**: the files of one paste, one drop or one Import CSV… choice, in the order the browser lists
  them; or the spreadsheet data of one paste.
- **The data-exchange reason**: while Tidy up is waiting, its existing text `Apply or cancel Tidy up first.`;
  otherwise the text `editingCommandReason` gives today for the board's state (`Read-only: editing commands are
  unavailable.`, `Finish text composition before using editing commands.`, `Finish or cancel the pointer gesture
  before using editing commands.`, `Correct invalid drafts before using editing commands.`, or empty). It never
  depends on Board's object clipboard, so an empty object clipboard (`Nothing to paste.` for object Paste) does not
  block table data. The board **can add a table** when this reason is empty and the person is not in the voting
  mode (below).
- **Voting mode**: while the workshop voting mode is on for this person (`voting.mode`), table paste and table
  import do not apply (paste and drop go to today's route), Import CSV… is disabled, Export as CSV is disabled and
  ⇧⌘E keeps the existing voting key gate (it does nothing). No new text.
- **C × R**: a table's column count, the multiplication sign U+00D7 with a space each side, and its row count
  (`4 × 3` is four columns and three rows), as the existing table-size label writes it.

## Routing

Exactly one route handles each canvas paste or drop event. "Today" means the handler at the base handles the
event unchanged (local image paste and drop, local and hosted object paste, their refusals and silences).

| Event | Condition | Route |
| --- | --- | --- |
| paste | the event was already handled, or its target is outside the canvas element or is a text field (a `textarea`, an `input` or editable text) | today (a text field's own paste stays native) |
| drop | the event was already handled, or its target is a text field (a `textarea`, an `input` or editable text) | today |
| paste | `clipboardData.files` holds at least one CSV file | **table import** of all those files (non-CSV files in it refused); the event is consumed |
| paste | `clipboardData.files` holds files, none of them CSV (whatever the text values) | today |
| paste | no files; spreadsheet data; not Board's own copy (below) | **table paste** if the board can add a table; otherwise today |
| paste | anything else | today |
| drop | target is the canvas element or anything inside it (the scene's handles, add bars and other parts), and `dataTransfer.files` holds at least one CSV file | **table import** of all those files at the drop point, computed from the canvas element's rectangle (`currentTarget`) and the view, as the image drop computes it; the event is consumed |
| drop | no CSV file | today (image drops unchanged) |

Amendment A1 (0011-W2 review v1): a paste reaches the table rows when its target is the canvas element or any element inside it other than a text field, because a browser delivers ⌘V to the element holding the document's selection.

A **table import** or **table paste** that finds the data-exchange reason non-empty adds nothing and shows that
reason as the board notice (for a table paste the event goes to today's route instead, which shows today's
outcome: for example a viewer's paste shows `Read-only: editing commands are unavailable.`; for a table import it
is shown by the new route, so a viewer's CSV drop now shows that reason where the base showed nothing).

**Board's own copy.** The editing commands keep one **copy record**: for the latest Copy or Cut, its own id,
the text it asked the system clipboard to hold, and its write state, `pending`, `written` or `refused`. A newer
Copy or Cut replaces the record; a settling write updates the record only if the record's id is still its own.
Spreadsheet data is **Board's own copy** when Board's object clipboard holds a copy and either the record's text
equals the paste's `text/plain` value (any state) or the record's state is `refused`. So, while Board holds a
copy whose clipboard write was refused, a paste uses Board's copy even if the user has since copied a table in
another app; copying again in Board (or a write that succeeds) ends that. Writes made by Copy link to page,
Share and the home lists never touch the record or the object clipboard.

## Reading table data

One reader for both sources; only the separator differs: **tab** for spreadsheet data, **comma** for a CSV
file.

1. A CSV file is decoded as **UTF-8** with a fatal decoder; exactly one leading byte-order mark (U+FEFF) is
   removed (a second one is text). Spreadsheet data is the `text/plain` string as the browser gives it.
2. The text is scanned once from the start into **records** and **fields**:
   - A field that starts with `"` is **quoted**: it runs to the next `"` that is not doubled; inside it `""` is
     one `"`, and separators and line breaks are part of the text. After the closing `"` the next character
     must be the separator, a line break or the end of the text.
   - Any other field is **unquoted**: it runs to the next separator or line break; a `"` inside it is ordinary
     text.
   - A line break is CRLF, LF or a lone CR. One line break at the very end of the text ends the last record
     and adds no record.
   - The **first syntax error met in scan order** (an unclosed quoted field, or text after a closing quote)
     ends the scan and is the reported error.
3. **Line numbers** count line breaks from the start of the text (first line 1), including line breaks inside
   quoted fields.
4. Inside every field, CRLF and lone CR become LF (cells store LF, v45).
5. The table has as many **rows** as records and as many **columns** as the longest record; shorter records are
   padded with empty cells at the end. Every field is kept exactly as text: no trimming, no number or date
   reading, no formula evaluation; a leading `'` stays.
6. The first record is an ordinary first row (no header).

## Refusals

A batch is settled in two phases. **Reading:** each file, in order, is checked by rules 1, 2, 4 and 5 and then read
and parsed (rules 6–12); spreadsheet data by rules 2 and 6–12. An item that fails is refused with that reason;
the others are **parsed**. **Acceptance:** once every item is parsed or refused, one ordered pass over the parsed
items, against the live board at that moment, checks rules 3 and 13–16 for each item together with the items
already **accepted** in this pass; an item that passes is accepted, and only accepted items count towards the
byte total, the budgets and the cascade. Within each phase the first failing rule is the item's reason, and the
item is refused **whole**:

| # | Rule | Reason text |
| --- | --- | --- |
| 1 | A file that is not a CSV file | `it is not a CSV file` |
| 2 | A file larger than 393,216 bytes (384 KiB); spreadsheet data whose `text/plain` value is longer than 393,216 UTF-8 bytes | `the file is larger than 384 KiB` / `the data is larger than 384 KiB` |
| 3 | (acceptance) The bytes of the items accepted so far plus this item's would exceed 393,216 | `the files together are larger than 384 KiB` |
| 4 | A file the browser cannot read | `the file could not be read` |
| 5 | A file that is not valid UTF-8 | `the file is not UTF-8 text` |
| 6 | An unclosed quoted field (the first syntax error in scan order) | `line N has a quote that is not closed` (N: the line of that field's opening `"`) |
| 7 | Text after a closing quote (the first syntax error in scan order) | `line N has text after a closing quote` (N: the line of that character) |
| 8 | No field holds any character | `it holds no text` |
| 9 | More than 20 columns | `a table holds at most 20 columns, and this file has C` / `…, and this data has C` |
| 10 | More than 50 rows | `a table holds at most 50 rows, and this file has R` / `…, and this data has R` |
| 11 | A field longer than 1,000 characters (code points, as v45 counts cell text) | `a cell holds up to 1,000 characters, and row R, column C has N` |
| 12 | A field holding a lone UTF-16 surrogate | `row R, column C holds text a table cannot store` |
| 13 | (acceptance) The live board's table cells (every table's columns × rows, all pages) plus the accepted tables plus this one would exceed 5,000 | `a board holds at most 5,000 table cells, and this table would bring it to N` |
| 14 | (acceptance) The live board's objects (all pages) plus the accepted tables plus one would exceed 250 | `a board holds at most 250 objects` |
| 15 | (acceptance) The board with the accepted tables and this one would have a saved payload over 2,097,152 bytes: document v20's canonical form and byte measure (`payloadBytes`), measured with any blank title replaced by `x`, so an unnamed board is measured, not refused | `the board would be larger than 2 MiB` |
| 16 | (acceptance, hosted boards only) The batch's **edit estimate** with this table would exceed 1,048,576: ⌈4/3 × (B + 128 × N + 65,536)⌉, where B is the UTF-8 bytes of every accepted cell text and N the accepted tables' cells (columns × rows, empty cells included) | `the tables are too large to send in one edit` |

Rules 1, 3, 4 and 5 apply only to files; the others to both. Rule 16 keeps one batch's hosted edit under the
session's 1,048,576-byte message limit; the brief's unit test proves the estimate bounds the real encoded edit. R and C in rules 11 and 12 are the 1-based row
and column of the **first** failing field in reading order. Numbers of four or more digits are written with a
comma (`5,012`). A file with an empty name is named `Clipboard file`. The notice for refused items is:

- paste of spreadsheet data: `Could not paste the table: <reason>.`
- one refused file: `Could not import “<file name>”: <reason>.` (curly quotes U+201C and U+201D)
- several refused files: as the image import's refusal list words it: `Could not import “a.csv”, “b.csv” and
  “c.csv”: <reason>; <reason>.` — at most three names, then ` and K more`; each distinct reason once, in item
  order, joined by `; `.

A refusal adds nothing, records no Undo step and sends nothing.

## The new table

Each accepted item becomes **one new table** on the batch's page, built as the Table tool builds one (v45 "The
Table tool"): the document's table creation with the data's column and row counts (columns 192, rows 64, text
size `medium`, fresh ids), then each non-empty field set in its cell (empty fields leave the cell empty), then
every row grown to fit its text as typing grows it (`growTable` with the app's cell measure). Then:

- **Anchor:** paste, file paste and Import CSV… use the **view centre** at the moment of the event or of the
  click that opened the file chooser; a drop uses the **drop point** (the canvas point under the pointer, as the
  image drop computes it). The batch keeps its board, its page and its anchor from that moment.
- **Where:** the i-th accepted table of the batch (i from 0) has its **drawn** box (the table layout's box with
  the same measure, v45) centred at the anchor plus (24 i, 24 i); its x and y are then rounded to whole units and
  kept inside the board's ±1,000,000 range with the **drawn** height (`boundTable(table, drawnHeight)`). Section membership and
  stacking order are then decided by the Table tool's placement (`placeObject`) on the table's saved box.
- **When:** reading files is asynchronous. The acceptance phase runs, and the batch is added, only if the tab still
  shows the same board **and the same page**, the editing hook is still mounted and the board can still add a
  table; otherwise the batch is dropped with no notice. The accepted tables are added to the live board
  (`model.current`), keeping every edit made meanwhile.
- **One step:** everything one batch adds is **one commit** and **one Undo entry**. Locally, one Undo removes
  every table of the batch (unless the existing retired-generation limit refuses it, with that limit's existing
  notice) and one Redo brings them back with the same table, row and column ids (fresh generations, as Redo always
  makes). On a hosted board it is one hosted edit; one Undo removes every table of the
  batch while nobody has changed them, and a table someone else has changed since follows the hosted Undo's
  existing per-object conflict rule (v45, sync v15).
- **Selection:** the new tables are selected (one table: the whole table, as after placing one with the Table
  tool); the tool returns to Select; any open side panel closes; focus goes to the canvas.
- **Notice**, shown when the commit applied (the new tables are in the board after it), as Board's other edits
  show theirs on a hosted board; a later refusal by the room is handled by the session's existing refusal and
  recovery, which replace the notice:
  - paste: `Added a C × R table.`
  - one table from a file: `Added a C × R table from “<file name>”.`
  - several tables from files: `Added N tables.`
  - when the batch also has refused files, the refusal notice follows the success text after one space, in the
    same notice. When every item is refused, only the refusal notice shows.

Existing cells of any table, including a selected one, never change. A paste or drop while a table, a cell, a
row or a column is selected still makes a new table.

## Import CSV…

- A button **Import CSV…** in the board panel's file buttons, **last** among them: after `Open board file…` on a
  local board, after `Save a copy to file` on a hosted board, so before `Reopen` (local) or `Show version
  history` (hosted).
- Shown on local boards and to hosted owners and editors (the hosted board's role is not `viewer`); **not shown to
  hosted viewers**, so an editor who is offline, recovering or previewing history still sees it. Disabled (the
  native `disabled` state, no tooltip) while the board cannot add a table.
- Choosing it opens the system file chooser for **one or more** files (`multiple`, `accept=".csv,text/csv"`).
  When the chooser returns one or more files, the board panel closes and the files are a batch at the view centre
  (even if every file is then refused). Cancelling leaves the panel open and changes nothing.

## Copy

Copy and Cut (⌘C/⌘X, Ctrl+C/Ctrl+X, and the existing buttons) keep today's behaviour for Board's object
clipboard, refusals and notices. The **text** they place on the system clipboard now also carries every copied
**table**, as tab-separated text, in the copied objects' order among the other copied texts (the existing joining
by an empty line is unchanged):

- rows in table order, joined by LF, with no line break after the last row;
- each row's cells in column order (every column, empty cells as empty text), joined by a tab;
- a cell holding a tab, LF, CR or `"` is written between `"` with each `"` doubled; other cells as they are;
- no formula rule: text is written as typed.

Viewers copy as today; their copied text now includes tables too.

## Export as CSV

- **Who and when (one rule for the button and the key):** exactly one object is selected and it is a table (the
  table, or one of its cells, rows or columns, selected), the board is not read-only, and there is no composition,
  no pointer gesture, no Tidy up wait and no voting mode. Export never depends on whether a row or column can be added, on cell
  drafts or on Board's object clipboard.
- **Button:** in the Table context bar (v45 Table mode: the whole table selected), a `button.icon-button` with
  accessible name `Export as CSV`, **immediately after Add column**, before the bar's divider. Shown only where the
  Table mode's edit buttons show (not to viewers or on a read-only board); disabled when the rule above fails
  (its tooltip then shows the existing reason text).
- **Icon:** 20 × 20, viewBox `0 0 20 20`, `fill="none"`, `stroke="currentColor"`, **stroke width 1.6**, round caps
  and joins (as the Pages icon), path `M10 3.5v9m-3.5-3.5 3.5 3.5 3.5-3.5M4 13.5v2a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-2`
  (a downward arrow into a tray).
- **Tooltip:** `Export as CSV ⇧⌘E` on macOS, `Export as CSV Ctrl+Shift+E` elsewhere, in the existing tooltip look
  (shown on hover and focus-visible, above the button).
- **Key:** on the canvas only, `key` `e` or `E` with Shift and exactly the platform's command modifier (⌘ alone on
  macOS, Ctrl alone elsewhere), no Alt, not composing: when the rule above holds it exports and calls
  `preventDefault()`; otherwise it does nothing new and does not prevent the default.
- **What it does:** downloads the whole table at once, with no dialog and **no notice** (an earlier notice stays as
  it was), and changes nothing on the board.
- **File name:** the board name with each of `< > : " / \ | ? *` and control characters U+0000–U+001F and
  U+007F replaced by `_`, trailing spaces and dots replaced by one `_`, a `_` put before a Windows reserved
  name (CON, PRN, AUX, NUL, COM0–COM9, LPT0–LPT9, with or without an extension, any case), `Untitled board`
  when empty; then ` table.csv`. (The same rule as `Save a copy to file`, with ` table.csv` in place of
  `.nextboard`.)
- **File bytes:** UTF-8 with a byte-order mark (EF BB BF) first. Every row of the table, in order, each row's
  cells in column order (every column), cells separated by `,`, **every row ending with CRLF** (the last
  included). Each cell is first given the **formula rule**, then written as is, or between `"` with each `"`
  doubled when it holds `,`, `"`, CR or LF. Cell line breaks are written as stored.
- **Formula rule:** a cell whose first character is `=`, `+`, `-`, `@`, a tab or CR gets `'` before it, unless the
  whole cell matches the ASCII number pattern `^[+-]?(?:[0-9]+(?:\.[0-9]+)?|\.[0-9]+)(?:[eE][+-]?[0-9]+)?$`. So
  `=SUM(A1:A2)` is written `'=SUM(A1:A2)`, `@x` as `'@x`, `-1.` as `'-1.`, while `-5`, `+3.2`, `.5` and `-2.5E-3`
  are written as they are.
- The file's media type is `text/csv;charset=utf-8`.
- **Round trip:** importing an exported file, where the destination board admits the new table (rules 13–16), gives
  back every cell's text, except: a cell the formula rule changed
  keeps its `'` (and a 1,000-character such cell becomes 1,001, so that file is refused by rule 11); a stored CR
  reads back as LF; a table with no text exports a file that rule 8 refuses; and a file over 384 KiB is refused by
  rule 2.

## Looks

Every new part takes an existing look; no new colour, size or font:

| Part | Look |
| --- | --- |
| Import CSV… | A plain `<button>` inside `.board-file-commands`, like `Save a copy to file`: no class of its own and no new rule, so it takes the app's shared button rules (hover background `#f1eff5` when enabled, the shared focus-visible ring, no latched pressed state) and the column's 12 px gap: 250 × 40 at 1440 × 900, 12 px below the button before it |
| Export as CSV | A `button.icon-button` inside the Table context bar, exactly as Add column is: `.icon-button` (40 × 40) and `.context button` (flex, `0 4px` padding, transparent, white icon) apply as they do to Add column, with no new rule; hover (enabled) `#f1eff5` background and `#29272e` icon, the shared focus-visible ring and momentary press, as Add column; 4 px after Add column, so the bar is 44 px wider and stays centred on the table; its `.tooltip` span in the existing look, above the button |
| Notices | The existing board notice (v46 "Notice placement"); one line is 37 px tall at 1440 wide |

## Keys

⇧⌘E / Ctrl+Shift+E as above. No other new key. Paste and Copy keep their existing keys.

## Accessibility

The new notices are the existing board notice's messages (the `.notice` element, `role="status"`), so assistive
technology announces them; no screen-reader-only text is added. Import CSV… is a native button in the panel's tab
order after the button before it; Export as CSV is a native button in the context bar's tab order after Add
column, with its accessible name `Export as CSV`. The file chooser is the browser's own.

## Hosted boards

A new table batch is one ordinary hosted edit (sync v15 unchanged): others see it within the usual delay. Rule 16 keeps
one batch's edit under the session's 1 MiB message limit. Copy and export send nothing.
Viewers: no Import CSV…, no Export as CSV, ⇧⌘E does nothing, a paste of spreadsheet data gets today's
`Read-only: editing commands are unavailable.`, a CSV drop or CSV file paste now shows the same text (the base
showed nothing for a drop), and their Copy
places tables' text on the clipboard.

## Not in this version

Pasting into existing cells; copying or exporting part of a table; an export dialog; other separators (`;`) or
encodings; spreadsheet files (`.xlsx`, `.numbers`, `.ods`); formatting from spreadsheets; stickies as CSV;
converting a table to stickies.
