# 0001 — Interaction and browser contract

Contract version: 19 (for 0002-W2 brief v1, 2026-10-27). Status: Draft. When
accepted it replaces [interaction v18](0001-interaction-v18.md) for later work. Uses
[document v7](0001-document-v7.md) and unchanged [storage v1](0001-storage-v1.md).

Every rule in v18 (and, through it, v17 back to v4 and the 0001-W3 presentation) still
applies except where this version replaces or adds to it. This version adds **connectors**:
lines that join two ideas, with an arrow at the `to` end and an optional label. It says how
they are created from connection dots or Objects, how they are routed and drawn, how their
label is edited, how they are selected, and what moving, arranging, deleting, ordering,
copying, Objects and history do with them. Stickies, text, shapes and sections behave as in
v18, except that the context bar moves further from a selection while connection dots show.
It replaces:
- v17's two order bands: there are now three (see **Order**);
- v17's copied set: it also takes connectors (see **Copy, Cut, Paste and Duplicate**);
- v10's rule that Delete removes exactly the selected objects: deleting an idea also deletes
  its connectors (see **Deleting**);
- the context bar's distance from a selection while dots show (see **Connection dots**).

## Terms

**Connector**, **ends**, `from`, `to` and **eligible idea** are document v7's. A connector's
**route** is the line drawn between its ends; its **label** is its `text`. A connector has no
rectangle; where earlier versions use an object's rectangle (for the context bar, the
selection outline or Objects' move and size buttons), a connector uses its **drawn bounds**:
the smallest rectangle holding its route, its arrow and, when it has text, its label box.
Drawn bounds are worked out when drawn and never saved.

An idea's **drawn rectangle** is its `x`, `y` and `width` with its drawn height: the height it
is drawn at after text growth (v4), which can exceed its saved `height` (for example a sticky
saved at 160 drawn at 171). Wherever this version speaks of an idea's rectangle or sides
(dots, routes, the drag target and its outline), it means the drawn rectangle. A **side
midpoint** is the middle of one of its four sides: left, right, top or bottom. A shape's sides
are its rectangle's, for circles too.

## Connection dots

With the Select tool active, every selected eligible idea shows four **connection dots**,
one 18 CSS pixels outside each side midpoint, at any zoom. A dot is a light-blue (#8fbdf5)
circle 10 CSS pixels across; a press within 8 CSS pixels of its centre presses it. Dots show
for every selected eligible idea in a selection of any size, including one that also holds
sections or connectors, and only while the board is editable, no text is being edited or
composed, and no pan or other pointer gesture is in progress. Sections and connectors show no
dots. Dots are screen controls, not saved, not in the tab order and hidden from screen
readers; the keyboard route is **Connect** (see **Connecting from Objects and Arrange**).

**Context bar clearance.** While dots show, the selection context bar keeps clear of them: it
sits 18 CSS pixels further from the selection than today, that is 66 CSS pixels above the
selection's top instead of 48, or, when it is placed below, 26 CSS pixels below the
selection's bottom instead of 8. Every other placement rule (section name field, clamping to
the scene, the editor overlap rule) is unchanged. When neither position fits and clamping
puts the bar back over a dot (a selection taller than the scene), the bar stays where
clamping puts it and covers that dot; the other dots and Connect stay available. Nothing is
hidden or moved further. Without dots (sections only, connectors
only, read-only, while editing) the bar keeps today's distances.

**Dragging from a dot.** A primary-button press on a dot starts a **connection drag** from
that idea. While dragging:
- a blue (#518de0) dashed preview line (3.5 units wide, dashes 10 and gaps 7 units, scaled by
  zoom) runs from the pressed side midpoint to the pointer, with a hollow blue circle of radius
  9 units at its start; the dots hide;
- the topmost eligible idea under the pointer, other than the source, is the **target** and
  is outlined in blue, 3 CSS pixels wide, along its rectangle.

Releasing over a target creates one connector from the source to the target (see
**Creating**). A dot drag needs only that one source idea; Connect's two-idea selection rule
does not apply to it. It can start whenever dots show and v9's editing-command reason does not
apply; the drag itself never counts as a gesture in progress for its own release. When the
board already holds 250 objects, releasing over a target creates nothing and shows the
250-object limit's notice (v4). Releasing anywhere else (empty canvas, the source itself, a section, a
connector or outside the scene), Escape, blur, pointer cancellation or lost pointer capture
creates nothing, removes the preview and shows no notice. The pressed dot chooses only the
source idea and the preview's start; the saved ends are `auto` (see **Route**).

## Connecting from Objects and Arrange

**Connect** joins exactly two selected eligible ideas, from the earlier to the later in
reading order. It is one button, named "Connect", in a new last group of the Arrange
controls (v12), labelled **Connector**. The Arrange controls are shared, so the group appears
both in the context bar's Arrange menu and in Objects' Arrange controls; Objects has no
other Connect button. It is unavailable, with its reason as tooltip and description:
- while v9's editing-command reason applies, with that reason;
- unless exactly two objects are selected and both are eligible ideas: "Select exactly two
  ideas to connect.";
- when the board already holds 250 objects: the 250-object limit's reason (v4).

There is no Connector tool in the palette and no Add connector button.

## Creating

Both routes (a dot drag and Connect) create one connector as one semantic transaction and
one history step, available as **Connection dots** and **Connecting from Objects and Arrange**
say. The new connector has empty text,
document v7's fixed shared values, `from` and `to` naming the two ideas with anchor `auto`,
and is placed at the end of the connector band (see **Order**). It becomes the selection
alone, **selected, not opened**: its label editor does not open, and focus returns to the
scene (or stays on Objects' list for the keyboard route). After a dot drag the tool stays
Select.

## Route

A connector's route is worked out from its two ends' current rectangles each time it is
drawn, so it follows every move and resize of either end, including Undo and Redo, a section
moving its members, and a reload; nothing is saved for it.

1. **Sides.** Of the 16 pairs (a side midpoint of `from`, a side midpoint of `to`), the route
   uses the pair with the shortest straight distance `d`. Pairs are compared in the order
   left, right, top, bottom for `from`, and within each the same order for `to`; a later pair
   replaces the kept one only when strictly shorter. Call the chosen points `a` (on `from`)
   and `b` (on `to`), and the sides' outward unit normals `n` and `m` (left (−1, 0), right
   (1, 0), top (0, −1), bottom (0, 1)).
2. **Facing sides.** When `m = −n` and `(b − a) · n > 0`, the vertices are, for left or right
   sides, `a, (h, a.y), (h, b.y), b` with `h = (a.x + b.x) / 2`, and for top or bottom sides
   `a, (a.x, v), (b.x, v), b` with `v = (a.y + b.y) / 2`: out, across at the middle, in.
3. **Every other pair** (perpendicular sides, sides facing the same way, or sides that do not
   face across a gap, for example overlapping ideas): with the lead `L = min(24, max(12,
   d / 4))`, let `p = a + L·n` and `q = b + L·m`. The vertices are:
   - both sides left or right: `a, p, (h, p.y), (h, q.y), q, b` with `h = (p.x + q.x) / 2`;
   - both sides top or bottom: `a, p, (p.x, v), (q.x, v), q, b` with `v = (p.y + q.y) / 2`;
   - `from` left or right, `to` top or bottom: `a, p, (q.x, p.y), q, b`;
   - `from` top or bottom, `to` left or right: `a, p, (p.x, q.y), q, b`.
4. A vertex equal to the one before it is dropped; nothing else is dropped or merged. The
   route does not avoid other objects.
5. **Corners.** The path starts at the first vertex. At each inner vertex `c`, with previous
   vertex `u` and next vertex `w`, let `r = min(14, |uc| / 2, |cw| / 2)`. When `r < 1` the path
   runs straight to `c`. Otherwise it runs straight to `c − r·(c − u)/|uc|`, then follows a
   quadratic curve with control point `c` to `c + r·(w − c)/|cw|`. The path ends with a
   straight run to the last vertex. A vertex where the route turns back on itself is rounded
   by the same construction.

The **label point** is halfway along the route's unrounded vertices, measured by total
length, leads included. Hit tests sample each quadratic curve at 16 equal parameter steps.

## Look

- **Line:** solid, #6b6b6b (the shapes' default Dark gray border), 3.5 units wide, round caps
  and joins, scaled with zoom.
- **Arrow:** an open chevron at the `to` end only, the same grey and width, unfilled, its tip
  on `to`'s side midpoint, pointing into that side, reaching 16 units back along the route
  and 11.2 units to each side. No arrow at `from`.
- **Label:** when its text is not empty, drawn centred on the label point in 18-unit system
  text, line height 1.45, colour #2c2c2c, centred, every line shown. Behind it a **cutaway**
  in the canvas colour (#fafafa), with no border, corner or shadow, hides the line: its width
  is the widest line's measured width plus 24 units, at least 90; its height is the number of
  lines × 26.1 units, at least 34. An empty label draws nothing.
- **Selected:** a selected connector shows a hollow circle at each end of its route, radius 9
  units, white fill, blue (#518de0) stroke 3 CSS pixels wide. It shows no resize handles and
  no dots.

## Order

The objects form three **bands**: sections, then connectors, then ideas. Sections draw below
connectors and connectors below ideas, so lines never cover an idea's text; hit testing
follows the same bands. Within the connector band, all lines and arrows draw first, then all
labels and selected end markers, each in band order, so another connector's line never
paints across a label.

v17's reading-order and order-command rules apply with three bands in place of two: commands
that add objects put an interleaved array in bands (sections, connectors, ideas, each keeping
its relative order) and insert new connectors after the last connector; order commands move
selected connectors only among connectors. Undo restores the exact earlier array as v17 says.

## Label

**Opening.** With one connector selected and the board editable, the label editor opens by:
- **Add text** in its context bar (shown only while its label is empty);
- **Enter** on the focused scene;
- a **double-click** on its line, arrow or label (the hit rules in **Selecting**).

The editor is a plain text box centred on the label point, with the cutaway's background, a
blue (#518de0) 1.5-pixel border, and a grey **"Add text"** placeholder when empty. Its
**editing rectangle**, in board units, is `max(90, 24 + 10 × c)` wide, where `c` is the code
point count of the draft's longest line (0 when empty), and `max(34, lines × 26.1)` high,
scaled by zoom; the note editor's 120 × 60 minimum does not apply. Its text is 18 units × zoom. It holds plain text: no formatting
controls, marks or text size. Enter inside it inserts a line break, as in a sticky. Escape, a
click elsewhere, or focus leaving the editor finishes the text session and closes it. v8's
rules for when the canvas editor is used apply to the editing rectangle and the 18-unit font:
it moves to Objects when `18 × zoom` would be under 12 CSS pixels or under v4's clipped-editor
fallback for that rectangle; Objects' **Name** field is then used, as for other ideas.

**Limit.** Up to 100 code points, counted as document v7 counts. A longer draft stays visible
and invalid with a notice that it exceeds 100 characters, and Save is unavailable until it is
corrected (document v1's invalid draft rule); nothing is cut.

One text session is one history step (v14).

## Selecting

- A press selects a connector when it is within 8 CSS pixels, at any zoom, of the centre line
  of its route (rounded corners included) or of its arrow, or inside its label's cutaway when
  it has text.
- Ideas are above connectors: a press on an idea's rectangle selects the idea. Among
  connectors, a press inside a label's cutaway selects that label's connector before any
  line; otherwise the topmost in band order wins.
- Shift-press adds and removes connectors as for any object (v13).
- **Box selection** takes a connector only when its whole route, its arrow and, when it has
  text, its whole label cutaway are inside the box. Ideas and sections keep v10's intersection
  rule.
- Pressing and dragging a connector selects it and never moves it; no marquee starts.

## Moving and arranging

A connector never moves on its own; it follows its ends.
- Every move route (pointer drag and Objects' move buttons) moves the other selected objects and leaves selected connectors unchanged; a section's move
  carries its members once, and their routes follow.
- Resize handles, Objects' size buttons, Align, Distribute and Group use only the selected
  ideas (and sections where they apply today); a mixed selection's handles and bounds are the
  ideas' only.
- When only connectors are selected, the move buttons, size buttons, Align, Distribute and
  Group are unavailable with the reason **"Connectors follow the ideas they join."** No resize
  handles show.
- Colour, Text size, Alignment, Formatting, Shape, Fill and Border apply only to the ideas in
  a mixed selection and never change a connector; a connector's shared values stay document
  v7's.

## The context bar

- **One or more connectors only:** the label "Connector" (or "*N* connectors"), **Add text**
  (one connector with an empty label only), and **Delete**. No Colour, text, Arrange, Duplicate
  or style controls.
- **Connectors with ideas or sections:** the label "*N* objects" counting every selected
  object, and today's controls for the selected ideas and sections. Geometry and style
  controls act on the ideas and sections only (see **Moving and arranging**); Delete removes
  every selected object with the cascade (see **Deleting**), Duplicate uses the copied set,
  and the order commands act within each band.

## Deleting

Deleting removes the selected objects (v10) and, in the same transaction and step, every
connector with an end on a deleted idea. When any connector is removed this way, or was
selected with a deleted idea, the result notice ends with " *N* connector removed with the
ideas." or " *N* connectors removed with the ideas.", where *N* counts every connector the
step removes. Deleting only connectors removes only them, with today's notice. Undo restores
every object of the step with its logical ID, ends, label and position in the array, as one
step; Redo removes them again.

## Sections and groups

A connector is never a member of a section or a group. A new or moved section never takes a
connector; Section from selection and the Section select ignore connectors; Group ignores them
(see **Moving and arranging**). A connector's two ends may be in different sections, or in a
section and a group. Group expansion (v13) never adds connectors.

## Copy, Cut, Paste and Duplicate

The **copied set** of Copy, Cut and Duplicate is v17's copied set of the selected ideas and
sections (the selection plus every member of every selected section), plus every connector
whose two ends are both in it, selected or not. A selected connector with an end outside it is
left out.
- **Copy** stores the copied set in v14's snapshot, connectors with their ends and labels.
- When the copied set is empty (the selection holds only connectors), **Copy**, **Cut** and
  **Duplicate** are unavailable with the reason "Select both ideas to copy their connector.",
  checked after v9's reasons. Using one anyway (a shortcut) shows that reason as the notice
  and changes nothing: board, clipboard, history and selection stay as they were. A selected
  empty section is a copied set as today.
- **Cut** copies as above, then deletes the copied set and, by **Deleting**, every other
  connector with an end on a deleted idea, as one step, with Deleting's notice.
- **Paste** and **Duplicate** create copies with fresh identities (v14); each copied
  connector's ends name the copies of its ends. Copied connectors enter at the end of the
  connector band in snapshot order; the copies become the selection.
- The 250-object limit counts copied connectors; a Paste or Duplicate that would pass it adds
  nothing, with the limit's notice.

## Objects

Objects' list (v17) gains connectors, numbered among connectors from 1 in reading order. Ideas
are numbered together, and sections among sections, as v17 and v18 say. A connector's option
reads "connector *n* · *label* · *from* to *to*", where *label* is shortened as an idea's text
is (v17), "Empty" when empty, and *from* and *to* are each end's own label prefix and number,
for example "connector 1 · leads to · sticky 1 to square 3".

For a selection of one connector Objects shows the **Name** field (its label, plain text, as
for a section's name) and no Colour, Text size, Alignment, Formatting, Section, Shape, Fill or
Border. For several connectors it shows none of those fields. Move and size buttons follow
**Moving and arranging**; order, Duplicate, Delete, Copy, Cut and Paste are as for any
selection, with this version's rules.

## Keyboard route

Everything above can be done from the keyboard: choosing two ideas in Objects' list and
Connect in Objects or the Arrange menu; choosing a connector in the list; its Name field;
Enter on the scene to open its label; Delete, Cut, Copy, Paste, Duplicate and the order
buttons. Connection dots are pointer-only.

## History

v18's history table gains rows, one step each: **Create connector** (either route), **Label**
(one text session, from the canvas editor or the Name field), and the connector cascade
inside **Delete** and **Cut**. Steps record each changed connector as a whole, with its ends
and label, so Undo and Redo restore them exactly and select as v10 says. Moving or resizing
an idea records only that idea. Routes, label boxes, drawn bounds, dots and previews are
never recorded.

## Opening older boards

A board saved as document v1 to v6 opens with no connectors and otherwise exactly as before.
Opening changes nothing; the first Save after an edit writes document v7.

## Verification boundary

Desktop Chrome and Safari as installed. Unit tests cover:
- document v7: connector keys and order, no geometry keys, ends and their order, `auto`
  anchors, eligibility, distinct ends, missing ends, the fixed shared values, the version rule,
  reading versions 1 to 6 and canonical output for each, the adapter's ends;
- the route for facing, perpendicular, same-facing and overlapping ideas, the tie order, the
  lead length, corner rounding, the label point and the arrow;
- hit testing at exactly 8 and just over 8 CSS pixels, label priority, box selection;
- the cascade and its count; the copied set and remapped ends; the three bands and order
  commands; Connect's reasons; the 250-object limit;
- the context bar's clearance with and without dots.

Browser checks cover, in Chrome: dots on each eligible type and several ideas; a dot drag
with preview, target outline and every invalid drop; the look; the label routes, limit and
cutaway; routes following moves, resizes and a section move; Connect in Objects and Arrange;
Objects' labels and Name; moving and arranging leaving connectors out with the reason; hit
testing and box selection; copy, paste, duplicate, cut and delete with Undo and Redo; bands
and order; Save and reload; a rejected dangling record; an upgraded v6 record; the 250-object
limit. The previous behaviour elsewhere is unchanged apart from the context bar's clearance.

The maintainer checks three of these in Safari. v18's remaining rows still describe available
coverage, not automatic gates.
