# 0001 — Interaction and browser contract

Contract version: 17 (for 0002-W1 brief v1, 2026-10-26). Status: Draft. When
accepted it replaces [interaction v16](0001-interaction-v16.md) for later work. Uses
[document v5](0001-document-v5.md) and unchanged [storage v1](0001-storage-v1.md).

Every rule in v16 (and, through it, v15, v14, v13, v12, v11, v10, v9, v8, v7, v6, v5, v4
and the 0001-W3 presentation) still applies except where this version replaces or adds
to it. This version adds **sections**: named areas that hold ideas. It says how sections
are created and named, how ideas join and leave them, how a section moves with its
members, how sections are ordered, grouped, deleted and copied, and how Objects shows
membership. It replaces:
- v10's rule that a drag moves exactly the selection: a selected section brings its
  members (see **Moving a section with its members**);
- v12's rule that one order decides drawing: sections always draw below ideas (see
  **Order**);
- v14's rules that a snapshot holds exactly the selection, that Cut deletes exactly the
  selection, and that Paste appends every copy (see **Copy, Cut, Paste and Duplicate**).

## Terms

**Section**, **idea** and **member** are document v5's. A section's **rectangle** is its
saved `x`, `y`, `width` and `height`; a section's drawn height is always its saved height.

An idea's **centre** is the centre of its saved rectangle: `x + width / 2`, `y + height / 2`,
using the saved height, not the display height. A group's **centre** is the centre of the
bounding box of its members' saved rectangles.

A section **contains** a point when the point lies inside its rectangle, edges included.
The **section at** a point is the topmost section that contains it (see **Order**), or none.

## Drawing a section

Sections draw below every idea. Each section draws:
- an area filled with its colour's fill at 55% opacity, corner radius 8 units;
- an edge 1 unit wide in its colour's edge colour, with the same radius;
- its **name** above its top-left corner, outside the area: left at `x + 2`, in the 26
  units above `y`, system font, 18 units, weight 600, colour `#5f5b66`, on one line: line breaks
  in the name are drawn as spaces, and a name wider than the section is cut off with an
  ellipsis at the section's width. An empty name draws nothing.

A new section's colour is the neutral colour. Corners are rounded for sections only; ideas
keep square corners.

**Selected.** A selected section's edge is `#518de0`, 2 units wide, and its name is
`#518de0`. The resize handles show at its corners as for any selected object (v8).

**Drop target.** While ideas are being dragged, each section they would join on release
(see **Joining and leaving**) draws its area filled `#e6eefb` at 55% opacity, its edge
`#518de0`, 2 units wide, dashed (6 units, gap 4), and its name `#518de0`. A **hint**
reading "Joins *name*" (the name drawn as above; "Joins section" for an empty name) is drawn
below the ideas: a dark rounded label (`#29272e`, height 34 units, corner radius 17 units)
whose width is the measured text width plus 16 units of padding on each side, at least 220
and at most 600 units; the text starts 16 units from its left edge, is centred vertically,
white, system font, 16 units, weight 500, and is cut off with an ellipsis when the label
reaches 600. Its left edge is 90
units left of the largest right edge of the ideas joining that section, and its top 10 units
below their largest bottom edge. The hint and the dashed edge are hidden from assistive
technology, like the rest of the canvas drawing.

**Drag look unchanged.** Apart from the drop target, a drag looks as it does today: the
dragged ideas are drawn as before (not lifted, no shadow, no change of opacity), the
gesture notice shows, and the context bar stays in place, unavailable, as v4 and v10 say.

## Hit testing

Which object a press, double-click or click hits is decided as before (v10), with sections
below ideas: the topmost idea whose drawn rectangle contains the point; if none, the
topmost section whose rectangle contains the point; otherwise empty canvas. A section's
name above its corner is not part of it. So, in the Select tool:
- a press on empty space inside a section selects the section (v13's selection rules); a
  drag from there moves it;
- a selection box (v10) starts only from a press outside every object, sections included.
  A box touches a section when the box intersects its rectangle, as for any object.

With the Sticky or Text tool armed, a press inside a section that hits no idea is a press
on empty canvas: it places the new idea there. A press on an idea keeps v4's meaning.

## Creating a section

All routes below create one section as one semantic transaction and one history step, and
are unavailable exactly when placing a sticky is (v4, v9). The new section is inserted at
the top of the section band (see **Order**), becomes the selection alone, and its name
editor opens with the name **"Section"** fully selected, so typing replaces it.

**The Section tool.** The palette gains a **Section tool** button after the Text tool,
named "Section tool", with an icon of a frame with a short title line above it. It is
pressed while armed, like the other tools, and unavailable in read-only views. While it is
armed, the notice reads "Drag to draw, click or press Enter to place one section object.
Escape cancels."

With the Section tool armed, a primary-button press anywhere on the canvas (on an object or
not) starts drawing:
- A drag of 3 CSS pixels or more shows a **drawing preview**: a rectangle from the press
  point to the pointer with a 1.5 CSS pixel dashed `#518de0` border and a `#518de0` fill at
  6% opacity, above the objects and below every floating control, hidden from assistive
  technology. On release, the section's rectangle spans the press and release points in
  board coordinates. Its width and height are each clamped to 200–10,000; its left and top
  are the smaller press or release coordinate, then clamped so the section stays within
  the board (`x` from −1,000,000 to 1,000,000 − width, and `y` likewise).
- A release under 3 CSS pixels places a section of 640 × 480 centred on the press point,
  clamped to the board as v4 clamps a placed sticky.
- Enter on the focused scene places a section of 640 × 480 centred on the view's centre, as
  Enter places a sticky (v4).

Escape outside native text fields, pointercancel, lost pointer capture or window blur during
a draw removes the preview and creates nothing, as a cancelled placement does today. After
any route the tool returns to Select.

**A new section takes in what it covers.** Whatever route creates a section (drawing,
a click, Enter, Add section or Section from selection), every idea whose own centre the new
section contains joins it, in the same step; groups are not considered as a whole here (the
new section is the topmost section, so an idea already in another section moves to the new
one). Ideas
whose centre lies outside keep their membership.

**Add section.** Objects' add buttons gain **Add section**, after the existing ones. It
places a 640 × 480 section where those buttons place a sticky. Its name opens in Objects'
Name field with "Section" selected.

**Section from selection.** v12's Arrange menu and Objects' Arrange group gain a fifth group
of buttons, **Section**, after Group, with one button: **Section from selection**. It
follows v12's menu rules. It wraps the selected ideas in a new section:
- The new section's rectangle is the bounding box of the selected ideas' drawn rectangles
  (v11), extended by 40 units on each side, then clamped as a drawn section is (sizes
  200–10,000, within the board). At a board edge the margin may be less than 40.
- Every selected idea becomes a member of the new section, leaving any section it was in,
  and so does any other idea whose centre the new section contains (see above).
- From the Arrange menu the name editor opens on the canvas; from Objects it opens in
  Objects' Name field.

It is unavailable, with the first reason that applies:
1. v9's editing-command reasons, then "Select an object to duplicate or delete." with
   nothing selected (v10);
2. "Sections cannot contain sections." when any selected object is a section;
3. "250 object limit reached" when the board already has 250 objects;
4. "The selection with its margin exceeds the 10,000-unit section limit." when the bounding
   box's width or height plus 80 exceeds 10,000.

## Naming a section

A section's name is its text (document v5): plain text, up to 100 code points. It is edited
like a note's text (v4, v5), with these differences:
- **On the canvas** the name editor is a compact field over the name, above the section's
  top-left corner: left at `x + 2`, top at `y − 34`, 28 units high and as wide as the
  section up to 200 units, all scaled by the zoom; white background, 2 CSS pixel `#518de0`
  border with radius 4, weight 600. While it is open the drawn name is hidden and the resize
  handles stay shown. It is shown on the canvas when this field's own rectangle lies fully
  inside the visible canvas, outside the floating controls, and is at least 16 CSS pixels
  high; the note editor's minimum sizes (0001-W24) do not apply to it.
- **The context bar** for one selected section reads, in order: "Section"; **Edit name**
  (or **Done** while editing); the count "*N* / 100"; Colour; Arrange; Duplicate; Delete. It
  has no Text size, Alignment or Formatting. Placed above, it sits a further 30 units
  (scaled) higher so it does not cover the name.
- **In Objects** the field is labelled **Name**, with "*N* / 100 code points" under it.
- The name editor opens by Edit name, Enter on the focused scene with only that section
  selected, or a double-click on the section (v13), as a note's editor does. When the
  on-canvas field cannot be shown by the rule above, Objects' Name field is used instead, as
  for a note (0001-W24).
- A name never changes the section's size. Text over 100 code points is refused as text over
  1,000 is for a note (v5's invalid draft). Formatting buttons, shortcuts, the formatted
  preview, text size and alignment do not apply to a name: none is shown for a section, and
  the formatting shortcuts do nothing while a section's name is being edited or a section is
  selected.

Text sessions, history and the editing session follow v5 unchanged.

## Joining and leaving

Membership changes only by the routes below. Resizing a section never changes membership.
Align, Distribute (v12) and resizing (v11) act on exactly the selected objects and never
change membership.

**On a drop.** When a pointer drag of 3 CSS pixels or more that moves at least one object
is released, each moved idea that is not carried by a moving section (see below) gets the
section at a point, in the same step as the move:
- if every member of its group is moving, the point is the centre of the bounding box of
  those group members that are not carried by a moving section, and all of those members
  get the same section;
- otherwise (an ungrouped idea, or a member moved without the rest of its group) the point
  is its own centre.

Carried members always keep their membership: a group member carried by a moving section
stays in that section even when the rest of its group joins another.

An idea dropped where no section contains the point leaves its section. Membership is
decided from the positions after the move. A cancelled drag, or a drag that the move limit
reduces to no change, changes nothing.

**Placing an idea.** A sticky or text placed by the palette (click or Enter) or added in
Objects joins the section at its centre, in the creation step.

**Creating a section** takes in the ideas it covers, as that heading says.

**Section from selection** makes the selected ideas members, as above.

**The Section select (keyboard route).** In Objects, with one or more ideas selected, a
native select labelled **Section** follows Colour. Its options are **None**, then every
section in reading order, labelled "section *n* · *name*" with its number and name as in the
list (see **Objects**), so sections with an empty or repeated name stay distinct. Its value is the selected ideas' shared section, or
None when they share none; when they differ it shows **Mixed**, as an option that cannot be
chosen. Choosing an option sets or clears the membership of every selected idea, and only
of ideas: selected sections are ignored, nothing moves and groups are not expanded. It is
one step; a choice that changes nothing records nothing. It is unavailable, with the
reason, exactly when Colour is. With only sections selected the select is not shown.

## Moving a section with its members

The **moved set** of a move is the selection plus every member of every selected section,
each object once.

- **Dragging** moves the moved set by the same board distance, limited as one set (v10), so
  relative positions never change. Members carried this way keep their membership. Objects
  outside the moved set never move.
- **Objects' move buttons** move the moved set 10 board units, limited the same way, and
  never change membership (there is no drop).
- A completed move, with any membership a drop changes, is one transaction and one history
  step. Escape outside native text fields, pointercancel, lost pointer capture or window
  blur restores every object of the moved set to its starting position and membership, and
  records nothing.

A member can still be selected and moved alone (pressing it, or choosing it in Objects); it
then follows **On a drop**.

## Order

The objects form two **bands**: sections, then ideas. Sections always draw below every idea,
and hit testing follows the same bands. Within each band, objects keep their relative array
order: later ones draw on top.

**Reading order.** v12's one array order still decides Objects' list and Save. Every command
that adds objects (creating a section or an idea, Section from selection, Paste and
Duplicate) first puts the array in bands if it is interleaved: a stable partition, sections
then ideas, each band keeping its relative order. It then inserts new sections after the
last section and appends new ideas at the end, so a board edited here stays in bands:
sections first in the list. That step records every position it changed, so Undo restores
the exact earlier array. A valid saved board whose sections and ideas are interleaved opens as
saved, with its list in the saved order, and draws in bands.

**Order commands.** Bring to front, Bring forward, Send backward and Send to back (v12) apply
within each band separately: selected sections move only among sections and selected ideas
only among ideas, each by v12's rule. An idea can therefore never be sent below a section.
The result is in bands. On an interleaved board the first order command also puts the whole
array in bands, in the same step, and records every object's position, so Undo restores the
exact earlier array. Undo of any step restores the array order from before it. Recording
positions does not change what Undo and Redo select: they select the objects the command
acted on, as v12 says (for an order command, the arranged objects), never every object
whose position was restored.

## Groups

Groups and sections are independent. An idea can be in a group and a section; a group may
have members in different sections or in none. Selecting by press, Shift and box (v13)
expands groups as before; a section never has a group.

**Group** is unavailable when any selected object is a section, with the reason "Sections
cannot be grouped.", checked after v9's reasons and before "Select two or more objects to
group.". Ungroup is unchanged.

## Deleting

Delete removes exactly the selected objects (v10). Deleting a section keeps its members where
they are and clears their `section` to `null`, in the same step. Undo brings the section back
with its logical ID and restores every member's link, as one step.

## Copy, Cut, Paste and Duplicate

The **copied set** of Copy, Cut and Duplicate is the moved set: the selection plus every
member of every selected section, each once, in reading order.

- **Copy** stores v14's snapshot of the copied set. Each snapshot object also records its
  section, kept only when that section is in the copied set (otherwise `null`). Group marks
  are computed over the copied set (v14). The plain text is v14's, over the copied set;
  section names are text like any other.
- **Cut** copies as above, then deletes the copied set: the section and its members, as one
  transaction and one step. Delete's messages and refusals apply to the copied set. Undo of
  Cut brings them all back with their membership.
- **Paste** builds v14's copies with fresh identities. Each copied section gets one fresh
  logical ID, and each copy whose snapshot section is that section points to the copy. A
  copy whose snapshot section is `null` gets `null`. Paste never decides membership from
  position. Copied sections enter at the top of the section band and copied ideas are
  appended, each in snapshot order; the copies become the selection.
- **Duplicate** copies the copied set as v10 and v13 say (`x + 24`, `y + 24`, group rule),
  with the same membership mapping and insertion as Paste.

Copying members without their section therefore gives copies with no section. The 250-object
limit and the source-identifier rules (v14) apply to the copied set.

## Objects

Objects stays one flat native multiple-selection list in reading order (v10). Options are
labelled:
- an idea: its type and number, its group (v13), and its text as today, then ` · in `
  and its section's name when it is a member, for example
  "sticky 2 · Draft the survey · in Plan";
- a section: "section *n* · *name* · *k* items", with "1 item" for one member and "Empty" for
  an empty name, for example "section 1 · Plan · 3 items".

Sections are numbered among sections and ideas among ideas, each from 1 in reading order, so
a board without sections keeps today's labels. A section's name in any label, in the Section
select and after "in" is shortened as Objects shortens an idea's text today: its first 36
UTF-16 code units, with line breaks shown as spaces, and "Empty" for an empty name. Screen readers get the option text.

For one selected section Objects shows the Name field and Colour only; no Section select,
Text size, Alignment or Formatting. For a selection that includes a section and ideas, Colour
and the Section select (for the ideas) are shown, and Text size, Alignment and Formatting are
hidden. Colour applies to every selected object.

## Keyboard route

Everything above can be done from the keyboard: the Section tool and Enter; Objects' Add
section; Section from selection in Objects; choosing a section in the list and naming it in
the Name field; joining and leaving with the Section select; moving a section with its
members with Objects' move buttons; the order, Duplicate, Delete, Copy, Cut and Paste
buttons. No new keyboard shortcut is added.

## History

v14's history table gains rows, one step each: **Create section** (any route, including the
ideas it takes in), **Section from selection**, **Section select**. A move's step
includes the membership its drop changes. Delete, Cut, Paste, Duplicate and order steps
include the membership and order changes above. Steps record each changed object's
membership as part of the object, so Undo and Redo restore it exactly, and select as v10
says. A name edit is a text session (v5).

## Opening older boards

A board saved as document v1 to v4 opens with no sections and otherwise exactly as before.
Opening changes nothing: it is not Unsaved and adds no history. The first Save after an edit
writes document v5.

## Verification boundary

Desktop Chrome and Safari as installed. Unit tests cover:
- document v5: validation (keys and order, the version rule, per-type limits, section style,
  no grouping, no nesting, no dangling or idea targets), reading versions 1 to 4, per-version
  canonical output, the upgrade, the adapter's section value, and membership never inferred;
- placing an idea inside and outside a section; drawing limits and reverse drags; a drawn
  section, a placed one and a wrapped one taking in ideas by centre, including one from
  another section;
- drops joining, leaving, at an edge, and onto overlapping sections; whole groups by group
  centre, a group straddling a section edge, and a member moved alone;
- Section from selection: margins, clamping, the reasons in order, refusal changing nothing;
- moving a section with its members once, the shared move limit, outsiders unchanged;
- one-step undo and redo of a drop's move and membership;
- order commands within bands for each command and mixed selections, the first order command
  on an interleaved board and its exact undo;
- Delete clearing links and Undo restoring them; Cut taking members and its Undo;
  Duplicate and Paste remapping membership, fresh identities, member-only copies with no
  section, and groups;
- the Section select's explicit assignment; option labels and counts;
- resizing a section within 200–10,000 without changing membership.

Browser checks cover, in Chrome: drawing, naming and the drawn look of a section; placing
ideas inside; the drop target and joining and leaving by drag, with Undo and Redo; moving a
section with its members, with Undo and Escape; resizing; the Objects Name field and Section
select by keyboard; keyboard moves; Add section; order; groups; Delete and Undo; Duplicate,
Copy and Paste, Cut and Paste; Section from selection from Objects and the Arrange menu; the
tool's click and Enter; a new section taking in the ideas it covers; Objects' labels; and Save and reload
keeping records, membership and order. The previous behaviour elsewhere is unchanged.

The maintainer checks three of these in Safari. v16's remaining rows still describe
available coverage, not automatic gates.
