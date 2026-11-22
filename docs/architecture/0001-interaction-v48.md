# 0001 — Interaction

Contract version: 48 (for 0012-W2 brief v1, 2026-11-21). Status: Draft. When accepted it replaces
[interaction v47](0001-interaction-v47.md) for later work. Uses [document v20](0001-document-v20.md) and
[sync v15](0003-sync-v15.md), both unchanged.

Every rule in v47 (and, through it, v46 back to v4 and the 0001-W3 presentation) still applies except where
this version replaces or adds to it. This version adds **export**, on local and hosted boards alike: one Export
dialog that downloads the selection or the open page as a PNG, JPG or PDF picture, or the tables or stickies as a
CSV file. Nothing in this version is stored in the document, sent to the room or recorded as an Undo step.
"Save a copy to file" (board file v4) is unchanged and is not part of the dialog.

## Terms

- **Export choices**: the file type (`PNG`, `JPG`, `PDF`, `CSV`), the PNG background (`Grid`, `Transparent`,
  `Solid`), the JPG quality (`High`, `Medium`, `Low`), the JPG background (`Grid`, `Solid`), the PDF quality
  (`High`, `Medium`, `Low`), the CSV content type (`Tables`, `Stickies`) and the area (`Selection only`,
  `Entire page`). Defaults: `PNG`; PNG `Solid`; JPG `High` and `Solid`; PDF `Medium`; CSV `Tables`; area
  `Selection only`.
- **Has a selection**: at least one selected object on the open page when the dialog opens.
- **The area**: `Selection only` when the dialog opened with a selection and that option is chosen in its select;
  otherwise `Entire page`.
- **Drawn objects**: the open page's objects that the canvas draws now (objects in a collapsed mind-map branch are
  left out), with the drawn box and layout the canvas uses (each object's position, width and drawn height; a
  connector's drawn bounds and path, computed against the whole page).
- **Included objects**: for `Selection only`, every selected drawn object (of any kind) together with every drawn
  object whose stored section is a selected section; for `Entire page`, every drawn object.
- **The bounds**: the smallest box holding the drawn box of every included object, connectors included. Artwork
  that reaches outside a drawn box (a stroke's ink, a connector's head or label, tape edges, a section's title, a
  border) is covered by the margin, not by the bounds.
- **The picture box**: the bounds grown by **128 units** on each side; its left and top are `L` and `T`, its width
  and height in units `W` and `H`.
- **Whole tables**: every included table, except under `Selection only` the table named by the current table
  selection when that selection's kind is `cell`, `row` or `column` (such a table counts as no table).
- **Stickies**: included objects whose type is the Sticky tool's type (`typeForTool("Sticky")`).
- **Allowed to export**: a local board, or a hosted board whose snapshot role is `owner` or `editor` (an absent role is
  not). Online or offline does not matter.
- **Export reason**: on a hosted board whose snapshot role is `viewer`, the text `Only owners and editors can export
  this board.`; otherwise empty.

## Opening

**⇧⌘E / Ctrl+Shift+E** with focus on the canvas and exactly Shift and the platform modifier (⌘ on macOS, Ctrl
elsewhere), with or without a selection, replaces v47's ⇧⌘E table export. Checked in this order; the first that
applies ends it:

| # | State | Result |
| --- | --- | --- |
| 1 | The workshop voting mode is on | Nothing (the existing voting key gate; default not prevented) |
| 2 | Text is being typed or composed, a pointer gesture is under way, or images are being imported (the existing import key guard may already have prevented the default) | Nothing |
| 3 | Tidy up is waiting, the dialog is open, or an export is running | Nothing; default not prevented |
| 4 | A hosted board's history is previewed or locked | Nothing; default not prevented |
| 5 | The export reason is not empty | The board notice shows the export reason; no dialog; default prevented |
| 6 | Otherwise | The dialog opens; default prevented |

**Export…** in the board panel: shown unless the export reason is not empty; disabled in states 1–4 above.
Choosing it closes the panel and opens the dialog. Invalid drafts and a board file being opened do not disable it.

Opening never changes the selection, the view or the board. The element to refocus is recorded at opening: the
canvas for the key, the board name button for Export….

## The dialog

A modal dialog (the browser's `<dialog>` opened with `showModal()`), its accessible name the title `Export`. In
order:

1. **File type**: four radio buttons `PNG`, `JPG`, `PDF`, `CSV`.
2. For `JPG` and `PDF`: **Quality**, radio buttons `High`, `Medium`, `Low`.
3. **Background**: for `PNG` radio buttons `Grid`, `Transparent`, `Solid`; for `JPG` the same three with
   `Transparent` disabled; for `PDF` the static text `White`; for `CSV` no Background group.
4. For `CSV`: **Content type**, radio buttons `Tables`, `Stickies`.
5. **Export area**: with a selection, a select holding `Selection only` and `Entire page`; without one, the
   static text `Entire page`.
6. Buttons **Cancel** and **Export**, right-aligned in that order. Export has initial focus.

**Memory.** On opening, every choice shows its stored value (defaults until the first export in the tab). While the dialog is
open, changes are kept per file type, so switching file type and back shows the change. **Export** stores the
chosen file type and that type's own quality, background or content type, and the area only when the select was
shown; static `Entire page` changes nothing stored. Cancel, Escape and any other close discard the changes. The stored choices are kept for the tab's lifetime, across boards and board switches of every kind (a value held by
the module, not by a component), and are never saved.

**Closing.** Cancel, Escape (the dialog's `cancel` event, its default prevented) and Export set the dialog closed;
the dialog element is then removed, which ends modality, and focus moves to the recorded element (the canvas, or the
board name button). A native `close` event the app did not ask for is treated as Cancel.

**Keys in the dialog.** Tab from the last control (Export) moves to the checked File type radio button and Shift+Tab from that radio button
moves to Export, so focus stays in the dialog; arrow keys move and choose within a radio group (native). An unmodified Return exports when focus is
on a radio button or on Export, and cancels on Cancel; on the select it does what the select does natively. Every `keydown` whose target is inside the Export dialog (the element with class `export-dialog`) stays in it: the
board's key handlers, and the capture-phase `keydown` handlers of Find, presence, spotlight, reactions and comments,
ignore it. Their `keyup` handling and every other dialog are unchanged.

## The export

Choosing Export first freezes, for the whole run, the board's id, the open page, the included objects with their
layouts, the board's committed name (the document's `title`, never an uncommitted Board name draft) and the
choices. Exporting never changes the board. In order, the first rule that applies
ends the export with its notice (the board notice, replacing its text) and no download:

1. `CSV` · `Tables` and no whole table: `There are no tables to export.`
2. `CSV` · `Stickies` and no sticky: `There are no stickies to export.`
3. A picture type and no included object: `There is nothing to export on this page.`
4. A picture type and an included image whose picture is not ready (a loaded picture with the image's own pixel
   width and height, as the canvas requires): checked again every 250 ms for up to 5 seconds; still not ready:
   `Could not export: an image on the board has not loaded yet.`
5. A picture type and no scale fits (below): `Could not export: the page is too large for one picture. Export a
   selection instead.` for `Entire page`, `Could not export: the selection is too large for one picture.` for
   `Selection only`.
6. The browser fails to make the file (a canvas, encoder or JPEG check failure): `Could not export: the browser could
   not make the file.`

**Still current.** At Export and again before every notice or download the run ends with, the run checks that the
board's view is still mounted (the canvas element is still connected), that the open board is the frozen one, and
that the person is still allowed to export (read from the latest render). If not, the run stops with no download and
no notice. Otherwise the file downloads at once (a `Blob`, an object URL revoked after the
click, and a temporary `<a download>`, as Save a copy to file does). The board notice does not change, except when
the scale was lowered, when it reads `Exported at S× because the page is too large for R×.` (`the selection` for
`Selection only`), with `S` and `R` as the shortest decimal (`1.5`, `0.75`, `2`) and the multiplication sign U+00D7.
One export runs at a time.

### File name

`<board name>.png`, `.jpg`, `.pdf` or `.csv`, where characters a file name cannot hold are replaced exactly as
`Save a copy to file` names its file (`<>:"/\|?*`, control characters and a trailing space or dot become `_`; a
reserved device name gets a leading `_`; an empty name is `Untitled board`). The table bar's Export as CSV keeps
v47's `<board name> table.csv`.

### Pictures (PNG, JPG and the PDF's picture)

- **Requested scale `R`**: `2` for PNG and JPG; for PDF `3`, `2` or `1` for `High`, `Medium` or `Low`.
- **Pixel size** at a scale `s`: `Wp = round(W × s)` by `Hp = round(H × s)` (round half up).
- **Scale used `S`**: the largest of `R`, `R − 0.25`, `R − 0.5`, … down to `0.5` for which `Wp` and `Hp` are each at
  most **16,384** and `Wp × Hp` is at most **268,435,456**. None: rule 5. These are assumed browser limits: if a supported browser
  (Chrome, Safari) is measured to refuse a canvas within them, the smaller measured limits replace them.
- **Drawing**: the board's own drawing of the included objects only, exactly as the canvas draws them at 100 % with
  nothing selected and nothing dimmed, scaled by `S`, with the board point `(L, T)` at pixel `(0, 0)`. Mind-map links
  are drawn only between two included nodes, on the side the whole page gives them. No canvas or drawing surface
  larger than the output picture is made (the drawing stage itself stays a few pixels in size). Never drawn: selection
  outlines, handles, connector dots, add bars, table selection marks, table ghosts, drop hints, the context bar, the
  canvas dot grid, cursors, avatars, comment pins, reactions, votes, find rings, notices and any other control. The
  output picture is exactly `Wp × Hp`; the drawing is copied onto it 1:1 at the origin, never stretched, and a last
  row or column the drawing does not reach (its size is rounded down) shows the background, which lies in the margin.
- **Background**, drawn under the objects: `Solid` fills `#FFFFFF`; `Transparent` (PNG only) leaves every pixel
  outside the objects with alpha 0; `Grid` fills `#F5F5F5` and draws a filled, hard-edged `#C8C8C8` circle of radius 1 unit centred on every board point whose x and y are both
  multiples of 16 with `L ≤ x ≤ L + W` and `T ≤ y ≤ T + H`, clipped to the picture. The PDF's picture is always `Solid`. The approved Grid reference shows the look (colours, spacing,
  dot size); this rule, not the reference, fixes the dots' positions and their hard edge.
- **PNG**: the browser's PNG encoder (`image/png`).
- **JPG**: the browser's JPEG encoder (`image/jpeg`) with quality argument `0.92`, `0.80` or `0.60` for `High`,
  `Medium` or `Low`.
- The app adds no metadata of its own; whatever the browser's encoder writes is allowed.

### PDF

One page holding exactly one image, the picture above at `S`, encoded by the browser's JPEG encoder with quality
argument `0.90`. Before embedding, the JPEG is checked: the blob's type is `image/jpeg`, it starts with FF D8, and its first
start-of-frame segment is `C0`, `C1` or `C2` with sample precision 8, three components and the picture's `Wp` and `Hp`;
anything else is rule 6.

The page size in points is `PW = W` and `PH = H` (one point per board unit); when the longer of them is over
**14,400**, both are multiplied by `14,400 / longer`, so the page fits a PDF reader's largest page; the picture is
unchanged and no notice is shown. Each is then rounded half up to two decimals and written without trailing zeros or a
trailing point (`1096`, `1276.5`, `14400`); the same two numbers are used in the MediaBox and in `cm`.

The file is PDF 1.4, exactly these bytes: the header `%PDF-1.4` LF, then `%` and the bytes E2 E3 CF D3, LF; then the
six objects below, each written `n 0 obj` LF, its dictionary on one line exactly as written below, LF, for a stream
`stream` LF, the bytes, LF `endstream` LF, then `endobj` LF; then `xref` LF, `0 7` LF, `0000000000 65535 f ` LF and one
20-byte entry per object (`nnnnnnnnnn 00000 n ` with the object's 10-digit byte offset, then LF); then `trailer` LF,
`<< /Size 7 /Root 1 0 R /Info 6 0 R >>` LF, `startxref` LF, the byte offset of `xref`, LF, `%%EOF` LF. The objects, in
this order:

1. `<< /Type /Catalog /Pages 2 0 R >>`
2. `<< /Type /Pages /Kids [3 0 R] /Count 1 >>`
3. `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 PW PH] /Resources << /XObject << /Im0 5 0 R >> >> /Contents 4 0 R >>`
4. `<< /Length n >>` with the stream `q PW 0 0 PH 0 0 cm /Im0 Do Q`
5. `<< /Type /XObject /Subtype /Image /Width Wp /Height Hp /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length n >>` with the JPEG bytes
6. `<< /Producer (NextPhase Board) /Title <FEFF…> >>`, the title the board's committed name as UTF-16BE in uppercase
   hex after the byte-order mark

`n` is the stream's exact byte count. Numbers are written without exponents. Text is part of the picture and
cannot be selected or searched.

### CSV

- **Tables**: every whole table, in object order (the order of the board's objects), as one file: a single UTF-8
  byte-order mark, then each table exactly as v47's Export as CSV writes it without its own byte-order mark (comma,
  CRLF after every row, minimal quoting, the formula rule), the tables separated by one extra CRLF (an empty line).
- **Stickies**: a UTF-8 byte-order mark, the header `Content`, CRLF, then one line per sticky in object order: the
  sticky's text (its `text` value, formatting marks ignored) with v47's formula rule and then its quoting, followed by
  CRLF. A sticky with no text gives an empty line. No other column.

## Board panel

**Export…**: a board-file button (the existing look) right after `Save a copy to file`, on local boards and for hosted
owners and editors, so before `Open board file…` (local) or `Import CSV…` (hosted). Shown and disabled as under
Opening. A hosted viewer's panel is unchanged.

## Table bar

v47's Export as CSV button is unchanged except its enabled tooltip, now `Export as CSV` on every platform (no
shortcut); a disabled button still shows its reason.
Clicking it still downloads the whole table at once with no dialog.

## Looks

- **Dialog**: the existing `.board-question` dialog look (1 px `#e9e7ed` border, radius 12, padding 24, the
  `#29272e66` backdrop) at width `min(440px, 100% − 24px)`, centred by the browser. Title `Export` 20 px, margin 0
  above and 18 below. Each group is a `fieldset` with no border, margin 0 0 16, padding 0; its label a `legend`
  (display block, padding 0, margin 0 0 8, 13 px weight 600). Choices sit in a wrapping row with gaps 6 (between rows)
  and 18 (between choices); each choice is a `label` (inline-flex, centred vertically, gap 6, 14 px, pointer cursor)
  holding a native radio button 16 × 16 with margin 0 and accent `#7051cf`; a disabled choice's text `#a19da8` with the
  default cursor. The area group is a `div` with no border, padding 0 and margin 0 0 16, its label a `label` styled as a legend; its
  select is native, full width, 1 px `#d9d6df`
  border, radius 8, padding 8 × 10, 14 px, white background, text `#29272e`. Static values (`White`, `Entire page`)
  14 px `#57535d`. The buttons are the existing `.board-question-actions` (gap 8, right-aligned), margin 22 above;
  Cancel the app's shared button and Export the existing `.primary` look, both with the app's shared hover and
  focus-visible looks and the browser's own pressed look (no override); Export's focus ring shows when the dialog
  opens. Native radio and select hover and pressed looks; the app's shared focus-visible outline. At 1440 × 900 the
  dialog measures 440 × 328 for PNG and CSV with the area select, 440 × 385 for JPG with the select and 440 × 365 for
  PDF with the static area (±2).
- **Export…**: the existing board-file button, 250 × 40, 12 from its neighbours, with that button's shared hover and
  focus looks and the browser's own pressed look.
- **Notices**: the existing board notice. On a hosted board a viewer's export reason shows in the notice under the
  read-only line, where the existing notice already shows for viewers.

## Keys

⇧⌘E / Ctrl+Shift+E as under Opening; in the dialog as under The dialog. No other new key.

## Accessibility

The dialog is a native modal `<dialog>` labelled by its title; each group is a `fieldset` with its label as the
`legend` (the area's label is a `label` for its select). The notices are the existing `.notice` element
(`role="status"`). Export… is a native button in the panel's tab order after `Save a copy to file`.

## Hosted boards

Export sends nothing, changes nothing and works offline. It draws this person's own current copy of the board.
Viewers: no Export…, ⇧⌘E shows the export reason, the table bar's Export as CSV stays hidden (v47).

## Not in this version

A PDF with selectable or searchable text; vector PDF; SVG; a scale, size or DPI choice; metadata the app adds;
several pages in one file; exporting part of a table; a right-click Export selection; remembering choices across
reloads; a success notice.
