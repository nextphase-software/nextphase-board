# 0001 — Interaction and browser contract

Contract version: 23 (for 0002-W3 brief v1, 2026-10-28). Status: Draft. When accepted it
replaces [interaction v22](0001-interaction-v22.md) for later work. Uses
[document v9](0001-document-v9.md), [storage v2](0001-storage-v2.md),
[the board file contract](0006-board-file-v1.md) and
[the activity catalogue contract](0008-activity-catalogue-v1.md).

Every rule in v22 (and, through it, v21 back to v4 and the 0001-W3 presentation) still applies
except where this version replaces or adds to it. This version adds **connector styles** and
**reconnecting**: a selected connector's context bar sets its colour, line style, a head at each
end and its line shape; dragging one of its end circles moves
that end to another idea or side; Objects does the same from the keyboard; and new connectors
take the last style chosen. It replaces:
- v19's **Look**: line, arrow and dash now come from the connector's style (see **How a connector
  is drawn**); the default style draws exactly v19's look;
- v19's **Route** step 1 for pinned ends, and its single elbowed route (see **Line shapes**);
- v19's **Label point** for Curved and Straight connectors (Elbowed keeps v19's);
- v19's **Selecting** distances and box rule, extended to heads and line width;
- v19's **The context bar** for selections of connectors only;
- v19's **Creating**: a new connector takes the remembered style (see **New connectors**);
- v19's **Copy, Cut, Paste and Duplicate**: copies keep each connector's style and anchors.

## Terms

**Style**, **default style**, **head** and **pinned** are document v9's. A connector's **end
point** is where its line meets its idea: a side midpoint for Elbowed and Curved, the outline
crossing for Straight (see **Line shapes**). An end's **outward direction** `n` is the unit vector
pointing away from its idea at the end point: the side's outward normal for Elbowed and Curved,
and, for Straight, the direction from that end's idea's centre toward the other idea's. Its
**across direction** `t` is `n` turned a quarter turn. The **line width** `w` is 3.5 units for
`thin` and 7 for `thick`; the **head scale** `s` is 1 for thin and 1.6 for thick.

## The connector bar

For a selection of **one or more connectors only**, the context bar shows, in this order:
1. the label "Connector" (or "*N* connectors");
2. **Colour**: a dot in the line colour and a chevron, named "Colour: *label*" (the shape colour's
   label, or a custom colour's `#rrggbb`, as Border names it);
3. **Line style**: a three-line icon and a chevron, named "Line style: *weight*, *dash*" (for
   example "Line style: Thin, Solid");
4. **Add text** (one connector with an empty label only), as v19;
5. a divider;
6. **Start point**: the start head's icon (mirrored) and a chevron, named "Start point: *head*";
7. **Line shape**: the line shape's icon and a chevron, named "Line shape: *shape*";
8. **End point**: the end head's icon and a chevron, named "End point: *head*";
9. a divider and **Delete**, as v19.

There is no bend handle, Duplicate, Arrange or text formatting. Labels: heads are **None**, **Line
arrow**, **Solid arrow**, **Triangle**, **Circle**, **Diamond**; line shapes are **Elbowed**,
**Curved**, **Straight**; weights **Thin**, **Thick**; dashes **Solid**, **Dashed**. All controls
are unavailable, with v9's editing-command reason, when that reason applies.

**Popups.** Each button opens its popup under the bar at the bar's left edge, as v18's Fill and
Border panels do:
- **Colour**: v18's Border panel without its row of styles: the 21 swatches in v18's order and
  **Custom colour**, each pressed when it is the current colour. A swatch and the colour picker
  behave as in v18 (one step; the picker commits once on its change event).
- **Line style**: two rows of toggle buttons, **Thin** and **Thick**, then **Solid** and
  **Dashed**, each pressed when it is the current value.
- **Start point** and **End point**: a menu of six radio items with icons, in the order above, the
  current one checked; Start point's icons are mirrored.
- **Line shape**: a menu of three radio items with icons, the current one checked.

Choosing an item applies it to every selected connector as one step, "Change connector style",
and closes the popup; a choice every selected connector already has changes nothing and makes no
step. **When the selected connectors differ** in a value, that value is shown as **Mixed** (the
button is named, for example, "End point: Mixed" and shows the first selected connector's value in
reading order) and no item is pressed or checked; choosing sets it on every selected connector.
Each value is shown independently. v18's **Menus and panels** rules apply to these popups (one
open at a time; Escape closes and returns focus; a press outside, focus leaving, a selection change
or the bar hiding closes without a change), and, as v22 says for the bar's menus, an open popup
draws above the bottom toolbar and the drawing bar.

**Mixed selections** (connectors with ideas or sections) are unchanged from v19: the bar shows the
ideas' controls, which never change a connector, and no connector controls.

## How a connector is drawn

**Line.** The connector's path (see **Line shapes**), in its line colour (the shape colour's value
or the custom colour), `w` units wide, scaled with zoom, round caps and joins. **Dashed** draws
dashes `5w` long with gaps `3w` (painted about `6w` and `2w` with round caps); **Solid** draws a
continuous line. The path starts and ends `inset` units along itself from each end point, where
`inset` is the end's head's below (0 for None and Line arrow); when the two insets together exceed
the path's length, both are scaled down in proportion.

**Heads.** Each end draws its head at its end point `p`, in the line colour, using `n`, `t` and `s`
for that end. A point "`a` back, `b` across" is `p + a·s·n + b·s·t`.

| Head | Drawn | Inset |
| --- | --- | --- |
| None | nothing | 0 |
| Line arrow | v19's open chevron: lines from 16 back, 11.2 across to `p`, and from `p` to 16 back, −11.2 across; `w` wide, unfilled | 0 |
| Solid arrow | a filled triangle: `p`, (18 back, 10 across), (18 back, −10 across); outlined 2 units in the line colour | 18·s |
| Triangle | a filled triangle pointing back: (0, 10 across), (18 back, 0), (0, −10 across); outlined 2 units | 18·s |
| Circle | a filled circle of radius 8·s centred 8 back, so it touches the outline at `p` and shows whole | 16·s |
| Diamond | a filled diamond: `p`, (10 back, 9 across), (20 back, 0), (10 back, −9 across), touching the outline at `p` | 20·s |

**Heads on an oblique line.** For Elbowed and Curved, `n` is the side's outward normal and the
table places every head on the outer side of the outline, Circle and Diamond touching it at `p`.
For Straight, `n` follows the line and need not be the outline's normal at `p`. Let `N` be the
outline's outward unit normal at `p`: a rectangle side's normal (at an exact corner, the
normalized sum of the two sides' normals); on a rounded corner or an ellipse, the curve's normal
at `p`. The head drawn by the table is then moved outward along `n` by
`d = max(0, −m) / (n · N)`, where `m` is the smallest value of `(q − p) · N` over the head's points
`q` (for Circle, its centre's value minus its radius), and the end's inset grows by `d`. Every
outline is convex, so the moved head lies wholly outside its idea; when `n` is the outline's
normal, `d` is 0. Unit tests cover an oblique Straight end on a rectangle, a rounded square corner
and an ellipse for every head.

So with the default style (thin, solid, dark-gray, None to Line arrow, Elbowed) a connector is
drawn exactly as v19 draws it. Connectors stay in v19's connector band, below ideas; no head
reaches inside its idea.

**Selected.** v19's hollow end circles are drawn at the two end points, for every line shape.

**Drawn bounds** (v19) hold the drawn path, both heads and, when the label is not empty, its
cutaway.

## Line shapes

**Sides.** Elbowed and Curved use one side of each idea, chosen by v19's **Route** step 1 among
the pairs whose `from` side is `from.anchor`'s when that end is pinned (any side when `auto`), and
likewise for `to`; with both ends pinned there is one pair. The end points are those side
midpoints (`a` and `b`) and the outward directions their normals (`n` and `m`).

**Elbowed** is v19's route (steps 2 to 5) from those sides.

**Curved** is one cubic Bézier curve from `a` to `b` with control points `a + L·n` and `b + L·m`,
where `L = max(24, d / 2)` and `d` is the straight distance from `a` to `b`. It leaves and enters
perpendicular to the sides.

**Straight** is the line between the two ideas' drawn rectangles' centres, from the point where it
crosses `from`'s outline to the point where it crosses `to`'s outline. The outline is: a sticky's or
text object's drawn rectangle; a square shape's rectangle with its rounded corners as drawn
(v18); a circle shape's ellipse inscribed in its rectangle. When the two centres coincide the line
runs horizontally, `from` toward the right. Straight ignores the ends' anchors, but they are kept
and saved, and used again if the connector becomes Elbowed or Curved.

**Label point.** For Elbowed, v19's: halfway along the route's unrounded vertices between the side
midpoints, whatever the heads. For Curved and Straight: halfway along the drawn path (after the
insets). The label, its cutaway and its editor are otherwise v19's, at that point.

A route is still worked out each time it is drawn and never saved; it follows every move and
resize of either idea.

## Selecting

- A press selects a connector when it is within 8 CSS pixels at any zoom, or within half its line
  width (`w / 2` units, scaled by zoom) when that is larger, of
  its drawn path (rounded corners and curves included; dash gaps count as path), of a head's lines
  or outline, or inside a filled head, or inside its label's cutaway when it has text. Curves and
  rounded corners are tested at v19's 16 steps per quadratic and 256 steps along a cubic.
- **Box selection** takes a connector only when its whole drawn bounds are inside the box.
- v19's other selecting rules (ideas above connectors, cutaways first, Shift-press, no moving by
  dragging a connector) apply.

## Reconnecting

With the Select tool, one connector selected alone, the board editable, no text being edited or
composed and no other pointer gesture in progress, a primary-button press within 12 CSS pixels of
one of its end circles' centres starts an **end drag** of that end (the nearer one; `from` on a
tie). This press is tested before ideas and connectors under it. The pointer is captured.

While dragging:
- the connector is drawn in its style by this version's rules with the dragged end's idea
  replaced by a zero-size rectangle at the pointer, so all four of its side midpoints are the
  pointer, with the four sides' normals as usual; that end's anchor is the drop side while there
  is a target (below) and `"auto"` otherwise, and the other end keeps its own anchor. So the side
  pairs, the Elbowed route, the Curved control points, the Straight line (from the other idea's
  outline to the pointer) and the heads all follow the same rules as a saved connector. A
  zero-size rectangle has no outline, so at the dragged end of a Straight preview the end point is
  the pointer, `N` is taken as `n` and `d` is 0 (coincident centres keep the horizontal rule);
  nothing is saved;
- every eligible idea except the other end's idea is outlined in blue (#518de0), 1 CSS pixel;
- the **target** is the eligible idea, other than the other end's idea, whose connection dot (v19's
  positions, 8 CSS pixels) is under the pointer, or otherwise the topmost one whose drawn rectangle
  holds the pointer. It shows its four connection dots, and the dot of the **drop side** is
  enlarged to 24 CSS pixels with a 3-pixel blue ring;
- the drop side is the pressed dot's side, or otherwise the side of the drawn rectangle whose edge
  is nearest the pointer (ties: left, right, top, bottom).

Releasing over a target sets the dragged end to `{ object: target, anchor: drop side }` as one
step, "Reconnect": the end is pinned, and keeps that side when ideas move. Releasing on the end's
own idea changes only the side; when the side is also the same nothing changes and no step is
made. Releasing anywhere else (empty canvas, the other end's idea, a section, a connector, a stroke
or outside the scene), Escape, blur, pointer cancellation or lost pointer capture puts the end back
with no change, no step and no notice. There are no free ends. The connector stays selected, with
its label, style and logical ID.

Connectors made by a dot drag or Connect keep v19's rule: both anchors `"auto"`.

## New connectors

Each open board has a **remembered style**, held in memory only: never saved, never in history.
It is the default style when a board is opened or created. Each choice in the connector bar's
popups sets that one value of the remembered style (even when it changed nothing on the board);
nothing else changes it: not Undo or Redo, copying, reconnecting, Objects' Ends, or another
board's choices. A connector created by a dot drag or Connect takes the remembered style, with both
anchors `"auto"`. Connectors added by Paste, Duplicate or a template keep their own style (a
template's connectors have the default style, document v9).

## Copy, Cut, Paste and Duplicate

v19's rules apply; a copied connector keeps its style and both anchors, with its ends remapped to
the copies of its ideas.

## Objects

For one selected connector, Objects shows under **Name** a group **Ends** with two rows:
- **From** (a select of every eligible idea except the `to` idea, in reading order, each by its
  Objects option text, v19) and **From side** (Nearest side, Top, Right, Bottom, Left);
- **To** and **To side**, likewise, excluding the `from` idea.

Choosing an idea moves that end to it and keeps its side; choosing **Nearest side** sets the anchor
to `"auto"` and any other side pins it. Each change is one "Reconnect" step. In these selects
Arrow Up, Arrow Down, Home and End choose the previous, next, first and last value directly, one
step each, as v22's stroke fields do. They are unavailable with v9's editing-command reason. For
several connectors Objects shows no Ends. Objects has no style fields: style is set in the
connector bar.

## Keyboard route

Everything above can be done from the keyboard except dragging an end: the connector bar's popups
(Tab to a button, Enter or Space to open, the items, Escape), and Objects' From, To and their Side
fields. v19's and v22's keyboard routes apply.

## History

v22's history table gains rows, one step each: **Change connector style** (every selected
connector) and **Reconnect** (one end, by pointer or Objects). Steps record each changed connector
whole, with its ends, anchors, label and style. End-drag previews, outlines, enlarged dots and the
remembered style are never recorded.

## Opening older boards

A board saved as document v1 to v8 opens with every connector in the default style and both
anchors `"auto"`, so it looks and behaves exactly as before. Opening changes nothing; the first
Save after an edit writes document v9.

## Verification boundary

Desktop Chrome and Safari as installed. Unit tests cover document v9's checks; the side pairs with
pinned ends; the three line shapes (Curved control points, Straight clipping for each outline kind,
coincident centres); head shapes, insets and their proportional scaling on short paths; the dash;
label points; hit tests and drawn bounds for each head and weight; the drop side; reconnect and
style changes, including no-change cases; copies; the adapter's style value; and that version 1 to 8
boards are unchanged.

Browser checks cover, in Chrome: the connector bar's items and order; each popup and each value
with the saved record and the drawn result; mixed values; several connectors in one step; label
points; selecting by path and box; reconnecting each end by pointer (another idea, the same idea's
other side, a dot, a pinned side kept after moving, every cancellation); reconnecting from Objects;
the remembered style for dot drags and Connect and its reset; copies; the delete cascade; save,
reopen, a version 8 board, an older application and a board file; the 250-object limit. The
maintainer checks three of these in Safari. v22's remaining rows still describe available coverage,
not automatic gates.
