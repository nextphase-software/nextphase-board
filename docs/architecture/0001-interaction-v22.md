# 0001 — Interaction and browser contract

Contract version: 22 (for 0009-W1 brief v1, 2026-10-27). Status: Draft. When accepted it
replaces [interaction v21](0001-interaction-v21.md) for later work. Uses
[document v8](0001-document-v8.md), [storage v2](0001-storage-v2.md),
[the board file contract](0006-board-file-v1.md) and
[the activity catalogue contract](0008-activity-catalogue-v1.md).

Every rule in v21 (and, through it, v20 back to v4 and the 0001-W3 presentation) still applies
except where this version replaces or adds to it. This version adds **drawing**: a Draw button in
the bottom toolbar arms the **Marker**, **Highlighter** or **Eraser**, a drawing bar above the
toolbar chooses weight and colour, and press-and-drag draws a **stroke** (document v8) or erases
whole strokes. A stroke is an **idea** everywhere v21 says idea, except where this version says
otherwise: it moves, groups, orders, joins sections, copies, pastes, duplicates, deletes and undoes
as a sticky does. It has no text and is never a connector end. It replaces:
- v18's rule that every idea's width keeps the 80-unit resize floor: a stroke has its own floor
  (see **Resizing**);
- v11's rule that a corner drag keeps proportions only with Shift: a selection holding a stroke
  always resizes proportionally (see **Resizing**);
- v19's rule that a connector's box selection is the only "whole object inside" rule: strokes use
  it too (see **Selecting**).

## Terms

**Stroke**, **kind**, **weight**, **ink width**, **pad**, **centreline**, **ink colour** and
**points** are document v8's. A **drawing tool** is the Marker, the Highlighter or the Eraser.
A stroke's **painted ink** is the area it is drawn on: the centreline widened by half the ink
width on each side, with the ends below (round for the marker, flat for the highlighter).

## The Draw button

The bottom toolbar gains a **Draw** button directly after the Shapes tool and before the Text
tool. Its accessible name is "Draw" and its tooltip "Draw". It shows the icon of the **last
drawing tool** armed in this tab: the Marker until any drawing tool has been armed, then whichever
was armed last, the Eraser included. It has `aria-pressed` true while a drawing tool is armed. It
is unavailable (`disabled`) while the tab is read-only, a gesture is in progress or text is being
composed.

Activating it arms the last drawing tool and moves focus to the canvas. Activating it while a
drawing tool is armed keeps that tool armed.

**Keys.** With the canvas focused, no text being edited, no pointer gesture in progress, not
composing and not read-only (the conditions of v18's R and O), **M** arms the Marker,
**Shift+M** the Highlighter, and **Shift+Delete** or **Shift+Backspace** the Eraser. No other key
changes. These keys do nothing anywhere else (text fields, menus, Objects).

**Arming.** Arming a drawing tool, by any route, empties the selection and ends any text session
(as a click on empty canvas does), so no context bar or editor shows while drawing. While a drawing
tool is armed, Undo and Redo restore and remove objects as v10 says but select nothing, so the tool
stays armed. Any other route that selects objects while a drawing tool is armed (Select all,
choosing in Objects' list, Paste, adding a template) first arms Select, hiding the drawing bar, and
then selects as today. **Escape** on
the canvas while no pointer gesture is in progress arms Select. Choosing another tool (Select,
Pan, Sticky, Shapes, Text, Section, or their keys) arms that tool. Either way the drawing bar
hides. The Templates panel behaves as v21 says for arming a tool: it stays open.

## The drawing bar

While a drawing tool is armed, the **drawing bar** shows: a floating toolbar (`role` "toolbar",
accessible name "Drawing tools") positioned in the same container as the bottom toolbar, centred
horizontally, its bottom edge 10 CSS pixels above the toolbar's top edge (78, 138 or 142 CSS pixels
above that container's bottom, by v21's three widths, as the Templates panel), at most the
container's width minus 24 CSS pixels wide. Left to right it holds:
1. **Marker**, **Highlighter**, **Eraser**: buttons named by their tool, each with its icon and a
   tooltip of its name, pressed when armed; choosing one arms it and moves focus to the canvas;
2. a divider, then **Thin** and **Thick**: buttons with a thin and a thick wavy-line icon,
   pressed for the armed kind's current weight;
3. a divider, then the armed kind's **eight colour dots**, in document v8's order, each a
   22-pixel circle filled with that colour, named by its label ("Black", "Red", … for the
   marker; "Grey", "Pink", … for the highlighter), pressed for the armed kind's current colour
   (drawn with a 2-pixel #7051cf ring outside it).

Buttons are at least 36 × 36 CSS pixels; a pressed tool or weight has a #e9e2fb background. When
the bar's content is wider than the bar, the bar scrolls sideways inside itself and stays one row
(at 390 CSS pixels wide, for example, it spans the window between 12-pixel margins). It never
covers the toolbar.

While the **Eraser** is armed, Thin, Thick and the colour dots show the marker's values but are
unavailable (`disabled`), drawn at 35% opacity, and none is pressed.

**Session style.** Each kind keeps its own colour and weight for the tab: the marker starts
**thin black**, the highlighter **thin yellow**. Choosing a weight or colour changes the armed
kind's value for later strokes and changes no stroke on the board. Values last until the page is
reloaded; switching tools, closing the bar or opening another board keeps them. Changing a
selected stroke's colour or weight (see **The context bar**) does not change them.

## Drawing a stroke

With the Marker or Highlighter armed, a primary-button press anywhere on the canvas (on an object
or not) starts a **drawing gesture**, as the Section tool's press does (v17). While it lasts, the
line is drawn through the pointer's positions in the stroke's own look (below) above every
object; nothing is saved, recorded or selected.

On release:
- **A click** (the pointer never moved 3 CSS pixels or more from the press point): the Marker
  saves a **dot**, a stroke whose two points are both the press point; the Highlighter saves
  nothing.
- **Otherwise** the stroke's points are worked out from the positions in board units: the press
  point, each pointer position and the release point, in order.
  - With **Shift** held at release, the points are the first and the last position only: a
    straight line.
  - Without Shift: one smoothing pass replaces each position except the first and last by
    (previous + 2 × this + next) ÷ 4; then, when there are more than 1,000, exactly 1,000 are kept,
    the *i*-th kept being the position at index round(*i* × (*n* − 1) ÷ 999) of the *n*, so the
    first and last are kept.
  - Each point is rounded to whole board units, kept within the board's edges less the pad, and
    the stroke's rectangle and relative points follow document v8's rules.

The new stroke takes the armed kind and its session colour and weight, is appended at the end of
the idea band, and joins a section by its rectangle's centre as any new idea does (v17). Drawing
it is one semantic transaction and one history step. Nothing is selected and no editor opens. The
tool stays armed, so the next press draws again.

**Escape**, `pointercancel`, lost pointer capture or blur during a drawing gesture removes the line
and saves nothing; the tool stays armed. A drawing gesture is unavailable exactly when placing a
sticky is (read-only, composing, an invalid text draft). At 250 objects a drawing gesture saves
nothing and shows the existing 250-object explanation.

## How a stroke is drawn

Strokes draw in the idea band, in array order, like other ideas, so a later idea covers an
earlier stroke and a later stroke covers an earlier idea. Each stroke draws its centreline:
- **Marker:** its ink colour, its ink width, round ends and round joins, normal blending.
- **Highlighter:** its ink colour, its ink width, flat ends and round joins, blended with what is
  under it by multiplying (so text under it stays readable), at full opacity.

**Ink colours.** Each name in document v8 is drawn as:

| Marker | Colour | Highlighter | Colour |
| --- | --- | --- | --- |
| black | `#1e1e1e` | grey | `#b3b3b3` |
| red | `#e5483b` | pink | `#f7a8d8` |
| orange | `#f5953b` | orange | `#fdb46b` |
| yellow | `#f7c744` | yellow | `#fff04d` |
| green | `#5cc96b` | green | `#a6ef6b` |
| blue | `#3d9cf5` | cyan | `#7cf2ec` |
| violet | `#8b5cf6` | violet | `#c6a6ff` |
| white | `#ffffff` | white | `#ffffff` |

Labels are the names with a capital first letter.

**Selected.** A selected stroke draws a `#518de0` outline 2.5 CSS pixels wide on its rectangle
and v11's four corner resize handles. It never shows connection dots, side handles or a text
editor.

## Erasing

With the Eraser armed, the canvas pointer is a circle 12 CSS pixels across (white at 40% opacity
with a #5f5b66 outline) centred on the pointer. A primary-button press anywhere on the canvas
starts an **erasing gesture**. The eraser's path is the press point, each pointer position and the
release point, joined in order by straight segments. A stroke is **touched** when its painted ink
comes within 6 CSS pixels, at any zoom, of that path (a click is a path of one point). Nothing
changes during the gesture.

On release every touched stroke is deleted **whole**, by v10's Delete with its section and group
rules, as one semantic transaction and one history step; one Undo restores them all with their
logical IDs, points and positions in the array. When no stroke was touched nothing changes and no
step is recorded. Stickies, text, shapes, sections and connectors are never touched or changed,
whatever the path crosses. No notice is shown. Escape, `pointercancel`, lost capture or blur during
the gesture erases nothing; the Eraser stays armed.

## Selecting

With the Select tool:
- A press **hits** a stroke when it is on the stroke's painted ink or within 8 CSS pixels, at any
  zoom, of its centreline. Any other point of its rectangle is **empty**: a press there does not
  hit it.
- Among ideas the topmost hit in band order wins, as today, so a stroke drawn over a sticky is
  selected when the press hits it, and the sticky when the press is on an empty part of the
  stroke's rectangle.
- Shift-press adds and removes strokes as for any object (v13). Pressing and dragging a stroke
  moves it as for any idea.
- **Box selection** first takes a stroke only when its whole rectangle is inside the box (other
  ideas and sections keep v10's intersection rule; connectors keep v19's), then expands the result
  through groups as v13 says, unchanged: a stroke grouped with a sticky the box takes is selected
  with it, wherever the stroke is.

## Resizing

A corner drag on a selection that holds a stroke is **proportional**, as Shift makes it for other
ideas (v11), whether Shift is held or not.
- Each stroke's centreline is scaled by the selection's factor: every point's offset from the
  centreline's bound at the corner opposite the dragged handle is multiplied by the factor, then
  rounded to whole units. Its weight and pad do not change, and its rectangle is recomputed from the
  rounded points (document v8) and placed with that opposite corner where v11's proportional
  resize puts the stroke's opposite corner (for one stroke, where it was). So the centreline keeps
  its proportions, within rounding, while the rectangle's proportions can change by the fixed pad.
- **A stroke's floor:** the factor stops where the stroke's larger centreline side would be 8
  units (its rectangle is then 8 units plus its ink width on that side); a stroke whose larger
  side is already below 8 does not shrink. v11's 80-unit width floor does not apply to strokes.
  Other selected ideas keep their own floors; the factor stops at the first floor reached.
- A stroke never grows past the board's edges.
- When two corner handles' press areas overlap (a thin stroke), the handle nearest the press wins;
  an exact tie takes the first in the order north-west, north-east, south-west, south-east.

Objects' size buttons resize a selection holding a stroke by the same rules, as a drag of the
south-east handle by the button's step (10 units on the named side) would: the factor comes from
that step, so after rounding and the fixed pad a stroke's own sides can change by a different
amount (a 12 × 12 thin marker stroke made Wider becomes 19 × 19, not 22 × 22).

## The context bar

- **One or more strokes only:** the label "Marker" or "Highlight" for one stroke, "*N* strokes"
  for several; **Colour**, a button showing the first stroke's colour dot that opens a menu of
  its kind's eight colours (each a dot and its label, pressed when every selected stroke has it),
  unavailable when the selection holds both kinds; **Weight**, a button that opens a menu of
  Thin and Thick (pressed when every selected stroke has it); and **Delete**. Choosing an item
  applies it to every selected stroke as one step and closes the menu. No Arrange, Duplicate,
  text or shape controls.
- **Strokes with other objects:** the label "*N* objects" and today's controls for the selected
  ideas and sections; those controls never change a stroke (see **Mixed selections**).
- The context bar places itself as v19 says: with v19's clearance while connection dots show
  (for the eligible ideas of a mixed selection), and at today's distances when none show (a
  selection of strokes only).
- **Weight** keeps the centreline where it is and grows or shrinks the rectangle by the change in
  pad on every side. A weight change that would take a stroke past the board's edges changes
  nothing and shows "The stroke would exceed the board edges.".

While the context bar's Arrange menu or a Colour or Weight menu is open, the menu draws above the
bottom toolbar and the drawing bar, so a click on a menu item is never taken by the toolbar.

## Mixed selections

In a selection holding strokes and other ideas or sections:
- Objects' ordinary **Colour** and the context bar's colour controls change the other ideas only;
  a stroke's ink colour changes only through the stroke Colour controls, and only when every
  selected stroke is of one kind.
- **Weight** changes the strokes only.
- **Text size**, **Alignment** and **Formatting** are not shown, in Objects or the context bar,
  while any stroke is selected.
- Move, Align, Distribute, Group, the order commands, Duplicate, Copy, Cut, Delete and Section
  from selection use every selected stroke's rectangle as they use an idea's.
- **Connect** is unavailable whenever a stroke is one of the two objects, with v19's reason
  "Select exactly two ideas to connect.". Connection dots never show for a stroke.

## Objects

Objects' list (v17) gains strokes, numbered together with the other ideas in reading order. A
stroke's option reads "marker stroke *n*" or "highlight *n*", followed by " · Group *g*" when it
is in a group and " · in *section name*" when it is in a section, as for any idea; it has no
text part.

For a selection holding strokes Objects shows **Stroke colour** (a select of the kind's eight
labels, unavailable when both kinds are selected, with the reason "Select strokes of one kind to
change colour.") and **Stroke weight** (a select of Thin and Thick), named so in a mixed selection
too, where the ordinary Colour field still acts on the other ideas; the move and size buttons, and the order,
Group, Duplicate, Delete, Copy, Cut and Paste commands. It shows no Content, Text size,
Alignment, Formatting, Shape, Fill or Border for them. In the Stroke colour and Stroke weight selects, Arrow Up,
Arrow Down, Home and End choose the previous, next, first and last value directly, one step each.
Drawing itself needs a pointer: Objects has no Add stroke.

## Copy, Cut, Paste and Duplicate

Strokes are copied as ideas are (v14, v17, v19): a copy keeps kind, colour, weight and points,
with a fresh ID and generation, group and section remapped, at the copy's position, at the end of
the idea band. The 250-object limit counts them. In the plain text Copy and Cut also write
(v14), strokes contribute neither text nor a separator; copying strokes only writes an empty
string.

## Templates

v21's **board's box** is the box of every object with a rectangle, so it includes strokes: an
activity is placed to the right of drawings as of any other content. Activities hold no strokes.

## Keyboard route

Everything except drawing and erasing can be done from the keyboard: arming the tools (M,
Shift+M, Shift+Delete, Escape) and choosing weight and colour in the drawing bar; choosing a
stroke in Objects' list; its Colour and Weight; move, size, order, Group, Section from selection,
Duplicate, Delete, Cut, Copy and Paste. Drawing and erasing need a pointer.

## History

v19's history table gains rows, one step each: **Draw stroke** (one stroke), **Erase** (every
stroke touched by one gesture), **Stroke colour** and **Stroke weight** (every selected stroke).
Moving, resizing, grouping, ordering, copying and deleting strokes are the existing rows. Steps
record each changed stroke as a whole, with its points. Drawing and erasing previews, the eraser
pointer and the session style are never recorded.

## Opening older boards

A board saved as document v1 to v7 opens with no strokes and otherwise exactly as before. Opening
changes nothing; the first Save after an edit writes document v8.

## Verification boundary

Desktop Chrome and Safari as installed. Unit tests cover document v8's checks; drawing (the click
rule, smoothing, thinning, straight lines, rounding, padding, the board's edges); painted-ink and
8-pixel hit tests including flat ends and a fast sweep between pointer events; erasing; resize
scaling, rounding and the stroke floor; nearest-handle choice; weight changes; mixed-selection
rules; copies; the adapter's points value; and that version 1 to 7 boards are unchanged.

Browser checks cover, in Chrome: the Draw button, its icon and keys; the drawing bar's content,
position, session style and the eraser's unavailable controls; drawing with each kind, a click, a
Shift line, a long drag and Escape; erasing by click and drag with one Undo; selecting by line and
box; the context bar's Colour and Weight; resizing and the stroke floor; moving, copying, grouping,
ordering and sections; Connect refused; Objects' labels, fields and keyboard route; mixed
selections; the 250-object limit; save, reopen, a version 7 board, an older application and a
board file; the narrow layout. The maintainer checks three of these in Safari. v21's remaining rows
still describe available coverage, not automatic gates.
