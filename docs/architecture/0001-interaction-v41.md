# 0001 — Interaction and browser contract

Contract version: 41 (for 0009-W3 brief v1, 2026-11-14). Status: Draft. When accepted it replaces
[interaction v40](0001-interaction-v40.md) for later work. Uses [document v17](0001-document-v17.md).

Every rule in v40 (and, through it, v39 back to v4 and the 0001-W3 presentation) still applies except
where this version replaces or adds to it. This version adds three things, on local and hosted boards
alike:

- **Washi tape**, a fourth drawing tool that lays straight strips of patterned tape;
- **twelve more shapes** in the shape menu, the Shapes panel and Objects;
- **Tidy up**, which previews three or more selected objects in an even grid, with editable columns
  and spacing, then applies it as one Undo step or cancels it.

Document v17's terms (tape, band, centreline, pad, length) are used throughout. Board units equal CSS
pixels at 100% zoom; sizes given in CSS pixels keep that screen size at every zoom, sizes in board
units scale with the board.

## Washi tape

### The tool

A **drawing tool** (interaction v22) is now the Marker, the Highlighter, the **Washi tape** or the
Eraser, in that order. Everything v22 says of drawing tools applies to the Washi tape: the Draw button
shows its icon when it was armed last, arming it empties the selection and ends any text session,
Escape on the canvas arms Select, and choosing another tool hides the drawing bar. **W** arms the
Washi tape under the conditions v22 gives for M: the key `w` or `W` without Shift, read the way M is
read; Shift+W does nothing. No other key changes.

The tool's icon (24 × 24 viewBox, stroke `currentColor`, round joins): the strip
`M3 9.5 4.2 8 3 6.5 20 3l1 4.5-1.2 1.5L21 10.5 4 14z` at width 1.8; the cuts
`M7 7.5l1.6 5.4M12 6.5l1.6 5.4M17 5.5l1.2 5` at width 1.2; the base line `M5 19h14` at width 2.4
with round caps.

### The drawing bar

The drawing bar's first group holds four buttons, **Marker**, **Highlighter**, **Washi tape**,
**Eraser**, each named by its tool with a tooltip of its name (the existing native `title`); each
button shows its own tool's icon, chosen by the tool's name. The Washi tape's `title` is
`Washi tape · W`. While the Washi tape is armed, the bar shows after the first group one divider and
then, in place of Thin, Thick, their divider and the colour dots, **six pattern buttons**: Stripes, Dots, Grid, Zigzag, Checks, Kraft, in that order. Each is at least
36 × 36 CSS pixels, shows a 22 × 22 swatch of its pattern with a 1 px `rgba(0,0,0,.15)` edge and a 5 px
corner radius, is named and has a tooltip by its pattern name, and is pressed (`aria-pressed`, the
`#e9e2fb` background of a pressed tool) for the session pattern; its hover and focus looks are the
drawing bar's shared button looks. Choosing one sets the session pattern
and moves focus to the canvas. The session pattern starts as **Stripes** and lasts like the ink
session style (v22); changing a selected tape's pattern does not change it.

### Drawing a tape

With the Washi tape armed, a primary-button press anywhere on the canvas starts a **tape gesture**, as
the Marker's press does. While it lasts a preview band is drawn from the press point to the pointer, in
the session pattern, in the tape look below. On release:

- **A drag** (the pointer moved 3 CSS pixels or more from the press point) saves a tape whose start
  is the press point and whose end is the release point, in board units. When the length would be under
  16 the end is first moved along the same direction to make it 16; over 2,000, to make it 2,000.
- **A click** saves a horizontal tape of length **160** whose start is 80 units left of the press point.

**Whole units.** Both points are then rounded to whole units (halves away from zero). While the length
is under 16, the end moves one unit further along the axis on which the direction's component is larger
(in that component's sign; x on a tie); while it is over 2,000, one unit back along that axis. So every
saved tape meets document v17's length rule.

Either way the tape's rectangle and relative points follow document v17's tape rules, it is added on
top of the stacking order like any new object, as one transaction and one Undo step, the Washi tape
stays armed and nothing is selected. Escape, `pointercancel`, lost capture or blur during the gesture
saves nothing.

### The tape look

A tape draws its **band**: the rectangle 28 board units across, centred on the centreline, from one
point to the other, whose two short ends are **torn**: each end is a zigzag of six equal steps across
the band, alternating 0 and 3 board units inward from the end (starting at 0 on the band's first long
edge). The band is filled with its pattern and drawn at **0.9 opacity** with a 1-unit
`rgba(0,0,0,.08)` edge. The pattern tiles below repeat along the band and turn with it, with the
tile's x axis along the centreline (start to end) and its origin at the start point. Tile sizes are in
board units:

| Pattern | Tile | Drawing in the tile |
| --- | --- | --- |
| Stripes | 10 × 10, turned 45° | `#fbe1d8` ground; a `#f19c86` band 5 wide |
| Dots | 10 × 10 | `#d7e7fb` ground; a `#5b93d6` dot of radius 2 at (5, 5) |
| Grid | 8 × 8 | `#d9f1e3` ground; `#66b88b` lines 1 wide along the tile's top and left edges |
| Zigzag | 12 × 8 | `#fcefc0` ground; a `#e0b52c` polyline 1.5 wide through (0, 6), (3, 2), (6, 6), (9, 2), (12, 6) |
| Checks | 12 × 12 | `#ebe4fa` ground; `#b9a6ea` squares 6 × 6 at (0, 0) and (6, 6) |
| Kraft | 6 × 6 | `#dcc3a1` ground; `#c9ab84` dots of radius 0.6 at (1, 2) and 0.5 at (4, 5) |

Patterns are drawn by the application (no image files). Every swatch in a bar or menu shows the same
tile, unturned, filling its square.

### Selecting, moving and the ends

- A press **hits** a tape when it is inside its band or within 4 CSS pixels of it, at any zoom; any
  other point of its rectangle is empty. Among ideas the topmost hit wins, as for strokes (v22).
- **Box selection** takes a tape only when its whole rectangle is inside the box, as for strokes.
- A selected tape draws a 1.5 CSS pixel `#518de0` outline on the band grown by 4 CSS pixels on every
  side, turned with it, and an **end handle** on each point: a 10 CSS pixel circle, white, with a 1.5
  CSS pixel `#518de0` ring, its press area 20 × 20 CSS pixels. It never shows resize handles,
  connection dots or a text editor; a selection that holds a tape shows no resize handles at all.
- Pressing and dragging the band moves the tape as any idea moves (v13), by its rectangle.
- Dragging an end handle (one tape selected) moves that point to the pointer, the other point fixed,
  with the length kept between 16 and 2,000 and the points made whole exactly as when drawing (the fixed
  point plays the start); the rectangle is recomputed by document v17. Release commits one transaction and one Undo
  step; Escape during the drag restores the tape with no change.

### Where tape stays out

- The **Eraser** never touches a tape: its gesture deletes marker and highlighter strokes only, as
  v22 says, whatever path crosses a tape.
- A tape is never a connector end (not an eligible idea: no connection dots, never a target, and the
  document refuses a connector end naming it); it is not votable; it has no text and no colour, weight,
  text, shape or size controls.
- A tape can be selected with other objects, moved, grouped and ungrouped, captured by a section,
  aligned and distributed by its rectangle, copied, cut, pasted and duplicated (v21; its points stay
  relative to its rectangle), deleted, and undone like any idea.

### The context bar for tapes

Placed by v19's rule at today's distances (no connection dots show).
- **One or more tapes only:** the label `Washi tape` for one tape, `<n> tapes` for several (white,
  13 CSS pixels, weight 600, 0 × 8 padding, as in the approved design); a divider; **Pattern**; a
  divider; **Duplicate**; **Delete** (the existing icon buttons).
- **Pattern** is built exactly as the strokes' Colour control (v22): a `details` whose `summary` has
  role `button`, the same keys, the same disabled rules and the same white menu container with its
  buttons and their pressed look. Its summary is named `Pattern: <name>` (`Pattern: Mixed` when the
  selected tapes differ) and shows the first tape's 22 × 22 swatch and the 20 × 20 chevron
  `m5 8 5 5 5-5` (stroke 1.75, round caps and joins), no text. Its menu lists the six patterns in
  order, each a button with its 22 × 22 swatch and name, pressed (`aria-pressed`) when every selected
  tape has it; choosing one sets it on every selected tape as one step and closes the menu.
- **Tapes with other objects:** the label `<n> objects` and today's controls for the selected ideas
  and sections; those controls never change a tape.

### Objects panel and names

Tapes are listed with the existing label pattern and the prefix `washi tape` (for example
`washi tape 3 · Stripes`, its pattern name in place of text). For one tape the panel shows what it
shows for one stroke except the stroke's Colour and Weight, plus a `Pattern` select (a native `select`
listing the six names); it has no text, text style, width or height fields. For any selection holding
a tape, Objects' Wider, Narrower, Taller and Shorter buttons are unavailable with the reason
`Washi tape can't be resized.`, and no resize ever changes a tape. A comment pinned to a tape names it
`washi tape`. The panel's Add list is unchanged (it offers no tape).

## More shapes

### The kinds

A shape's **kind** is one of fourteen, in this order, with these names and outlines. Outlines are
closed paths in the shape's box, given as fractions of its width (x) and height (y):

| Kind | Name | Outline |
| --- | --- | --- |
| `square` | Square | The box with a 6-unit corner radius (unchanged) |
| `circle` | Circle | The ellipse in the box (unchanged) |
| `rounded-rectangle` | Rounded rectangle | The box with a corner radius of 18% of its shorter side |
| `diamond` | Diamond | (0.5, 0) (1, 0.5) (0.5, 1) (0, 0.5) |
| `triangle` | Triangle | (0.5, 0) (1, 1) (0, 1) |
| `inverted-triangle` | Inverted triangle | (0, 0) (1, 0) (0.5, 1) |
| `pentagon` | Pentagon | (0.5, 0) (1, 0.38) (0.81, 1) (0.19, 1) (0, 0.38) |
| `octagon` | Octagon | (0.29, 0) (0.71, 0) (1, 0.29) (1, 0.71) (0.71, 1) (0.29, 1) (0, 0.71) (0, 0.29) |
| `star` | Star | Ten points around (0.5, 0.54): the first straight up, then every 36° clockwise, alternating outer radius 0.5 and inner radius 0.2 (each multiplied by the width for x and the height for y) |
| `cross` | Cross | (0.33, 0) (0.67, 0) (0.67, 0.33) (1, 0.33) (1, 0.67) (0.67, 0.67) (0.67, 1) (0.33, 1) (0.33, 0.67) (0, 0.67) (0, 0.33) (0.33, 0.33) |
| `arrow-left` | Left arrow | (0, 0.5) (0.4, 0) (0.4, 0.28) (1, 0.28) (1, 0.72) (0.4, 0.72) (0.4, 1) |
| `arrow-right` | Right arrow | (1, 0.5) (0.6, 0) (0.6, 0.28) (0, 0.28) (0, 0.72) (0.6, 0.72) (0.6, 1) |
| `chevron` | Chevron | (0, 0) (0.7, 0) (1, 0.5) (0.7, 1) (0, 1) (0.3, 0.5) |
| `speech-bubble` | Speech bubble | (0, 0) (1, 0) (1, 0.78) (0.4, 0.78) (0.2, 1) (0.2, 0.78) (0, 0.78) |

Every kind is filled and bordered as Square is today: the fill and its modes, the 4-unit border in
its colour, solid or dashed (`14 9`) or none; polygon outlines use round line joins. Text colour,
size, alignment and formatting work for every kind as for Square. Each new kind's icon is its outline
drawn in an 18 × 18 box at (1, 1) inside the shared 20 × 20 icon viewBox, drawn by the app's shared
icon renderer (stroke `currentColor` 1.75, round joins, no fill); Square's and Circle's icons are
unchanged. A new kind has no key; its label prefix in Objects and messages is its name in lower case
(`diamond`, `left arrow`).

### Text in a shape

Each kind has a **text box**, the rectangle where its text is wrapped, aligned and centred
vertically, as Square's text box works today. Fractions of the shape's width (x) and height (y):

| Kind | x | y | Kind | x | y |
| --- | --- | --- | --- | --- | --- |
| Square | 16 units in from each side | 12 units in | Octagon | 0.14–0.86 | 0.14–0.86 |
| Circle | Unchanged | Unchanged | Star | 0.32–0.68 | 0.38–0.72 |
| Rounded rectangle | As Square | As Square | Cross | 0.06–0.94 | 0.35–0.65 |
| Diamond | 0.25–0.75 | 0.25–0.75 | Left arrow | 0.40–0.96 | 0.30–0.70 |
| Triangle | 0.25–0.75 | 0.45–0.92 | Right arrow | 0.04–0.60 | 0.30–0.70 |
| Inverted triangle | 0.25–0.75 | 0.08–0.55 | Chevron | 0.32–0.72 | 0.10–0.90 |
| Pentagon | 0.18–0.82 | 0.32–0.92 | Speech bubble | 0.05–0.95 | 0.06–0.74 |

When a shape's text needs more height than its text box gives, its **Grow** button (v21) grows it so
the text's lines fit its kind's text box: for a fraction kind the new height is the text's height
divided by the kind's y fraction span, rounded up, never below 40 and never above the shape size limit
(Square, Rounded rectangle and Circle keep today's rule). The inline editor uses the same text box.

### Selecting and connecting

A selected shape of any kind shows Square's selection: the 2.5 CSS pixel `#518de0` outline on its box,
corner resize handles and connection dots at its box's four side midpoints. A press on any point of the
box hits the shape, as for Square. A connector attaches at the box's side midpoints as today.
- A **straight** connector keeps today's construction (the line between the two boxes' centres) and its
  visible ends are where that line leaves each kind's outline (today: the ellipse or the rounded
  rectangle); for a polygon kind the end is the crossing **farthest from the box's centre** along that
  line, toward the other box. Its end normal (which places the arrowhead) is the outward normal of the
  edge crossed; at a vertex, the normalised sum of its two edges' outward normals. Ellipse and rounded
  rectangles keep today's normals.
- A **curved** connector's visible end is where the segment from its side midpoint toward the box's
  centre first meets the kind's outline (for Square and Circle, today's ends); the curve keeps the side
  midpoint's normal.
- **Elbow** connectors keep today's routing from the side midpoints.

### Choosing a kind

- **The shape menu** (the selected shape's kind button in the context bar, `Shape: <Name>`) lists the
  fourteen kinds in **two equal columns** with a 2 CSS pixel gap, filled row by row in kind order, 360 CSS pixels wide, each
  item its icon and name, the selected kind pressed. Choosing one changes every selected shape's kind
  as one step, keeping its id, size, text, colours and connectors.
- **The Shapes panel** (v18) lists the fourteen kinds under Basic as a grid of **4 columns** of
  52 × 52 CSS pixel tiles with 8 CSS pixel gaps, each tile its icon only, drawn by the shared icon
  renderer at 24 × 24 CSS pixels, in kind order; a tile's accessible name is the kind's name
  (`aria-label`, for example `Diamond`) and its `title` the name, with ` · R` for Square and ` · O` for
  Circle as today; the armed kind's tile is pressed in the accent as today. A new kind's tool
  name is its kind name (for example the Diamond tool), so the placing hint reads `… place one diamond
  object …` as it does for Square. The panel keeps
  its width; its text below the grid is unchanged.
- **Objects:** a shape's kind list offers the fourteen kinds by name. The panel's Add list is
  unchanged: it still offers Square and Circle only.
- Placing a shape works for every kind as for Square (click for 180 × 180, drag to draw). R and O
  still arm Square and Circle; no other kind has a key.

## Tidy up

### When it is offered

The **placeable items** of a selection are its groups, each counting as one item, and its other
selected objects except connectors; a section counts as one item and carries its members, which are
then not items themselves. An item's **box** is its displayed rectangle (its displayed height, as
Arrange uses it; a group's box is the bounds of its members' displayed rectangles). Connectors are never
placed; they follow their ends.

The context bar's general branch for **two or more selected objects** gains a **Tidy up** button right
after the Arrange button, followed by a new divider, then Duplicate and Delete. It is never on a single
object's bar, nor on the images-only, stroke-only, tape-only or connector-only bars. When such a
selection holds a mind node (Arrange is not shown), Tidy up still shows, unavailable, in the same
place. It is an icon button built as the Arrange button is: accessible name `Tidy up`, `title` the
unavailable reason or `Tidy up`, a tooltip span reading `Tidy up · ⌥⇧T` (on other systems
`Tidy up · Alt+Shift+T`); icon (20 × 20 viewBox, stroke 1.75, round joins) four rounded squares `rect`
(2.5, 2.5), (11.5, 2.5), (2.5, 11.5), (11.5, 11.5), each 6 × 6, rx 1. It is available when the
selection has **three or more placeable items** and holds no mind node; otherwise it is unavailable,
with the reason `Select three or more objects to tidy up.` or, when a mind node is selected,
`Mind map nodes are placed by their map.` It is also unavailable whenever Arrange is (text being
edited, composing, read-only, a gesture in progress), with Arrange's reasons.

**⌥⇧T** (Alt+Shift+T: `code` `KeyT` with Alt and Shift and no other modifier, since the key's
character differs by layout) with the canvas focused opens the preview whenever the availability rule
above holds, whichever bar shows (for example for three selected strokes), and does nothing otherwise.
Opening the preview, by the button or the key, moves focus to the canvas. Under 768 CSS pixels wide no
context bar shows, so Tidy up is not offered there and ⌥⇧T does nothing.

### The order

Items are read in **reading order** of their boxes before tidying: the topmost unread item (smallest
top; ties by smaller left, then id) opens a row; every unread item whose vertical centre lies within
that item's top and bottom (inclusive) joins the row; the row is read left to right by horizontal
centre (ties by id); then the next row is opened from what remains. The grid is filled row by row in
that order.

### The grid

For `n` items and `c` columns (default `ceil(√n)`, between 1 and `n`), the grid has
`r = ceil(n / c)` rows. Column `j` is as wide as the widest item in it and row `i` as tall as the
tallest item in it. The **spacing** `s` (default **24**, between 0 and 400, whole units) separates
neighbouring columns and neighbouring rows. The grid's width is the sum of its column widths plus
`(c − 1) × s`, its height likewise. Its top-left is placed so the grid is centred on the centre of the
items' bounds before tidying, rounded to whole units (halves away from zero); if the grid would cross
the board's edge it is moved inside by the least distance. Each item's **offset** in each direction is
`round(target − current)` (halves away from zero), where the target is the position that centres its
box in its cell; every member of a group or section item moves by its item's offset. Positions that
were fractional stay fractional. The last row is filled from the left.

### The preview

Tidy up opens a **preview**. Nothing is saved, sent or recorded while it is open, and the board's save
state does not change.
- The items are drawn at their grid places, with their members and every connector that has an end on
  them following, as if moved. The other objects stay as they are.
- The selection's own chrome (outlines, handles, group outlines, connection dots) is hidden, and
  connection dots and connector ends take no presses; one 1.5 CSS pixel `#518de0` rectangle is drawn
  1 CSS pixel outside the grid.
- A **spacing handle** sits in every gap between two cells that both hold an item: between
  horizontally neighbouring cells, a vertical handle at the gap's centre and the row's vertical centre;
  between vertically neighbouring cells, a horizontal handle at the gap's centre and the column's
  horizontal centre. A handle is a 28 CSS pixel line across the gap, 2 CSS pixels wide, in the accent
  `#7051cf`, with a white circle of radius 4.5 CSS pixels (to the middle of its 2 CSS pixel accent ring)
  at its centre; its press area is 20 × 28 CSS pixels along the line. Handles are pointer targets only:
  not buttons, not focusable, no hover background, with the `ew-resize` (vertical handle) or
  `ns-resize` (horizontal handle) cursor; keyboard users use the Spacing field. While dragged its line
  is 3 CSS pixels wide and its circle radius 6, filled with the accent, and a label shows the spacing:
  accent background, white 12 CSS pixel text at normal weight, line height 1.35, 4 CSS pixel radius,
  4 × 8 padding, centred horizontally on the handle's centre with its top 14 CSS pixels below that
  centre.
- Dragging any handle sets the spacing to the value at the press plus the pointer's movement along the
  handle's axis (x for a vertical handle, y for a horizontal one) divided by the zoom, rounded, between
  0 and 400; the preview follows the pointer.
- **The Tidy up bar** replaces the context bar: a `section` with the context bar's class and look,
  rendered inside the scene (so a press on it is not a canvas press), placed by the context bar's rule
  with the grid's screen bounds, as for a selection with no connection dots, no single item and no
  inline editor, using its own measured width. Left to right: the label `Tidy up` (white, 13 CSS
  pixels, weight 600, 0 × 8 padding); a divider; a **Columns** group: the text `Columns` (`#d9d6de`,
  13 CSS pixels), a **−** button (`Fewer columns`, 24 × 28, 16 CSS pixel glyph `−`, white, no
  background), the column count in a field (`Columns`) and a **+** button (`More columns`, as −); a
  **Spacing** group: the text `Spacing` and the spacing in a field (`Spacing`); a divider; **Cancel**
  (white 13 CSS pixel weight 600 text, no background, 32 CSS pixels high, 0 × 10 padding, radius 6);
  **Apply** (white 13 CSS pixel weight 600 text on `#7051cf`, 30 CSS pixels high, 0 × 14 padding,
  radius 6, 4 CSS pixels left margin; hover `#6142be`, the shared primary hover, whatever the bar's own
  button rules say). Each group lays out its parts with 6 CSS pixel gaps and 0 × 6 padding. Each field
  is a text input 28 CSS pixels high and at least 34 wide, 1 CSS pixel `#57525f` border, radius 6,
  white 13 CSS pixel centred text, no background. The other buttons and fields use the bar's shared
  hover and the app's shared focus outline. − is unavailable at 1 column and + at `n`. A field takes a
  whole number on Enter or when it loses focus; a value outside its range or not a number is put back.
  Every change updates the preview at once. Tab moves through the bar; Escape in the bar cancels.
- **Apply** (the button, or Enter with the canvas focused) commits **one transaction**: every placed
  item, and every member of a placed group or section, moved by its item's offset, and nothing else;
  one Undo step (one shared Undo step on hosted boards). Ids, stacking order, groups, section
  membership, text, styles and connectors' ends are unchanged. After Apply the items stay selected with
  the normal context bar, and the notice `Tidied <n> objects into <c> columns.` is shown, `<n>` counting
  items (a group or section is one).
- **Cancel** (the button; Escape, on the canvas or in the bar; a press anywhere on the canvas that is
  not on a spacing handle; choosing a tool; the window narrowing under 768 CSS pixels; the selection
  changing) closes the preview: everything is drawn where it was, nothing is recorded, and the
  selection stays. When the person cancels with the button or Escape the notice `Tidy up cancelled.`
  is shown. After Apply or Cancel from the bar, focus returns to the canvas.
- **Commands that read positions are unavailable** while the preview is open, with the reason
  `Apply or cancel Tidy up first.`: Arrange, Section from selection, Group and Ungroup, Duplicate,
  Delete, Copy, Cut and Paste, and Objects' position and size controls; Objects' geometry readout shows
  its no-value dash.
- **Undo, Redo, a Templates insert and a collaborator's change** apply to the board as it is without
  the preview, as they would with no preview open; when one changes a placed item or a member of one, it
  also closes the preview. So Undo during a preview undoes the last real step and closes the preview.

### Hosted boards

The preview stays on the person's own screen: collaborators see nothing until Apply, which sends one
edit. When the board changes while the preview is open (a collaborator's change, or the person's own
Undo, Redo or Templates insert) so that any placed item, or any member of a placed group or section,
moves, changes or is deleted, the preview closes and the notice `Tidy up was cancelled because the
objects changed.` is shown on that person's screen as a hosted toast (the path the Templates panel's
hosted messages use). Collaborators' changes to other objects apply as usual during the preview.
Viewers cannot tidy up. Shared Undo reverts an applied Tidy up as one step, for its author, as any edit.

## Keys and announcements

New keys: **W** (Washi tape, as above) and **⌥⇧T** (Tidy up). In the Tidy up preview, Enter applies
and Escape cancels. The messages `Tidied <n> objects into <c> columns.` and `Tidy up cancelled.` go
through the same path as the existing Delete message (the polite notice on local boards; not shown on
hosted boards, as Delete's message is not); the hosted cancel message above is shown on hosted boards.
