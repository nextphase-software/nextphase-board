# 0001 — Interaction and browser contract

Contract version: 18 (for 0002-W4 brief v1, 2026-10-26). Status: Draft. When
accepted it replaces [interaction v17](0001-interaction-v17.md) for later work. Uses
[document v6](0001-document-v6.md) and unchanged [storage v1](0001-storage-v1.md).

Every rule in v17 (and, through it, v16 back to v4 and the 0001-W3 presentation) still
applies except where this version replaces or adds to it. This version adds **shapes**:
squares and circles that hold text, with their own fill and border. It says how shapes are
drawn, placed and named in the interface, how their kind, fill and border change, what
happens when their text does not fit, and how Objects shows them. A shape is an **idea**
everywhere v17 says idea: it joins and leaves sections, groups, aligns, distributes, orders,
moves, resizes, copies, pastes, duplicates, deletes and undoes exactly as a sticky does. It
replaces:
- v4's rule that a placed idea is a sticky or text of the type's default size: a shape has
  its own size (see **Placing and drawing**);
- v8's single Colour control: shapes have Fill and Border instead (see **Fill and Border**);
- v4's rule that an idea grows to fit its text, and v11's text floor when resizing: a shape
  keeps its size, and resizing it keeps only v11's width floor (see **Long text**).

## Terms

**Shape**, **kind**, **fill** and **border** are document v6's. A shape's **paint** is its fill
and border. Its **text box** is the area its text is laid out in:
- a square: inset 16 units left and right and 12 units top and bottom;
- a circle: the rectangle inscribed in its ellipse, inset 6 units more left and right and 4
  more top and bottom; that is, `x + w(1 − 1/√2)/2 + 6` to the matching right edge, and `y +
  h(1 − 1/√2)/2 + 4` to the matching bottom edge.

Its **text fits** when every line of its text, laid out in the text box, fits the text box's
height.

## The Shapes tool and panel

The palette gains a **Shapes tool** button after the Sticky tool and before the Text tool,
named "Shapes tool", with an icon of a small square overlapping a circle, and a tooltip
"Shapes · R". It is pressed while a shape kind is armed and unavailable in read-only views.

Pressing it arms **Square** and opens the **Shapes panel**: a floating panel at the left of
the canvas, below the file bar, named "Shapes", with a Close button, a heading "Basic", and
two tiles: **Square** (tooltip "Square · R") and **Circle** (tooltip "Circle · O"), each a
button with an outline icon and its name, pressed when its kind is armed. Below them it reads
"Drag on the board to draw, or click for a 180 × 180 shape." Choosing a tile arms that kind
and returns focus to the scene. Close, Escape on the scene, or the tool returning to Select
for any reason closes the panel and arms Select.

**Keys.** With the scene focused, no text being edited, no pointer gesture in progress, not
composing, not read-only and no modifier held, **R** arms Square and **O** arms Circle, each
opening the panel. No other key changes. These are the first single-letter tool keys; they
do nothing anywhere else (text fields, menus, Objects).

While a kind is armed the notice reads today's drawing-tool hint with the kind's name:
"Drag to draw, click or press Enter to place one square object. Escape cancels." (or
"circle").

## Placing and drawing

All routes create one shape as one semantic transaction and one history step, and are
unavailable exactly when placing a sticky is. The new shape takes the session's shape paint
(see **Session paint**) and today's text defaults for shapes: text size Small, alignment
Centre, no marks. It is appended at the end of the idea band, joins a section by its centre
as any new idea does (v17), becomes the selection alone, and its text editor opens empty with
a grey **"Add text"** placeholder, centred in the text box. After any route the tool returns
to Select and the panel closes.

With a kind armed, a primary-button press anywhere on the canvas (on an object or not) starts
drawing, as the Section tool does (v17):
- A drag of 3 CSS pixels or more shows the drawing preview of v17 with corners rounded to 6
  units (scaled by zoom), for either kind. On release the shape spans the press and release
  points; its width and height are each clamped to 40–2,000 and it is clamped to the board as
  a drawn section is.
- A release under 3 CSS pixels places a **180 × 180** shape centred on the press point,
  clamped to the board.
- Enter on the focused scene places a 180 × 180 shape centred on the view's centre.

**The shape editor** opens on the canvas over the text box, under v8's rules for when the
canvas editor is used or Objects' Content field is used instead, with one change: the text
box's size, at least 40 × 24 CSS pixels, replaces the note editor's 120 × 60 minimum. The
12 CSS pixel minimum font size still applies, so at 75% zoom a Small shape (10.5 pixels) edits
in Objects, as a Small sticky does today.

Escape, pointercancel, lost capture or blur during a draw removes the preview and creates
nothing. **Add square** and **Add circle** in Objects (see **Objects**) place a 180 × 180
shape where Add sticky places a sticky, and its text opens in Objects' Content field.

## Drawing a shape

Shapes draw in the idea band like stickies. Each shape draws:
- **Fill:** for mode `fill`, its fill colour; for `transparent`, its fill colour at 45%
  opacity; for `none`, nothing. A square's fill has corner radius 6 units; a circle's is
  the ellipse filling its rectangle.
- **Border:** 4 units wide, centred on the outline, in its border colour; solid for `solid`,
  dashed (14 units, gap 9) for `dashed`, nothing for `none`. Same radius as the fill.
- **Text:** in the text box, the same font, sizes and line height as a sticky's (Small 14,
  Medium 18, Large 24, Extra large 32 units; line height 1.45), with its alignment and
  marks, centred vertically in the text box. Its colour is **derived**, never stored: for
  mode `fill`, `#ffffff` when the fill colour's relative luminance (sRGB channels made
  linear, then 0.2126 R + 0.7152 G + 0.0722 B) is below 0.4, otherwise `#2c2c2c`; for
  `transparent` and `none`, always `#2c2c2c`.

**Shape colours.** Each name in document v6 is drawn as:

| Name | Colour | Name | Colour |
| --- | --- | --- | --- |
| black | `#1e1e1e` | gray | `#b3b3b3` |
| dark-gray | `#6b6b6b` | light-gray | `#dedede` |
| red | `#e5483b` | light-red | `#fbcfca` |
| orange | `#f5953b` | light-orange | `#fde0c5` |
| yellow | `#f7c744` | light-yellow | `#fdf0c4` |
| green | `#5cc96b` | light-green | `#d3f2d4` |
| teal | `#4fcdc4` | light-teal | `#ccf3ef` |
| blue | `#3d9cf5` | light-blue | `#cfe5fb` |
| violet | `#8b5cf6` | light-violet | `#e2d8fb` |
| pink | `#ec4fae` | light-pink | `#fbd4ec` |
| white | `#ffffff` | | |

A custom colour is drawn as written. Their labels are the names with a capital first letter
and spaces for hyphens ("Dark gray", "Light blue").

**Selected.** A selected shape draws a `#518de0` outline 2.5 CSS pixels wide on its
rectangle (a circle's bounding rectangle), 1.5 while its text is being edited, and the
resize handles of v11 at its corners. Its own border is drawn as above.

**Hit testing** is v17's, using the shape's rectangle: a press anywhere in a circle's
bounding rectangle hits the circle, as for every other type.

## Long text

A shape never changes size because of its text: typing, Paste, text size and formatting
leave its width and height as they are (v4's growth applies to stickies and text only).
Resizing a shape, alone, in a set (v11) or with Objects' size buttons, has no text floor: its
height may shrink to 40 whatever its text needs. Its width keeps v11's resize floor (80, or its
current width if smaller), as every type's does; drawing may still create a shape as narrow as
40. Width and height stay within 2,000 and the board.

Its text is laid out in the text box as a sticky's is. When the layout cannot place all of
the text in the text box's height, the text **does not fit**:
- if at least one line fits, the last line that fits is cut at a grapheme boundary so that it
  ends with "…" within the text box's width, and the lines after it are not drawn; the "…"
  takes the formatting of the character before it, or no formatting when the line is "…"
  alone;
- if no line fits (a text box less than one line high, or narrower than one grapheme), or "…"
  alone is wider than the text box, no text is drawn.
While editing, the editor shows all the text and scrolls within it.

**Grow to fit.** A shape's **fit height** is the smallest height at which its text fits,
limited to `min(2,000, 1,000,000 − y)`. Grow to fit text is **available** when the selection is
exactly one object and it is a shape, v9's editing-command conditions hold (not read-only, not
composing, no text being edited, no pointer gesture in progress), its text does not fit, and its
fit height is greater than its height. Then a **grow button** shows centred on its
bottom edge: a 24 × 24 CSS pixel `#518de0` square with corner radius 6 and a white downward
chevron, named "Grow to fit text", above the canvas and below floating controls. Pressing it
sets the shape's height to its fit height, keeping its `x`, `y` and width, as one step, "Grow
to fit text". When the text still does not fit at that height (the limit was reached), the
shape keeps the ellipsis and the button does not show again until its size, text or style
changes. The same command is in Objects (see **Objects**), available exactly when the button
is.

## Shape menu

For a selection whose shapes are all of one kind, the context bar for shapes starts with a
**Shape** button showing that kind's icon, its name and a chevron, named "Shape: Square" (or
"Circle"); for a mixed selection it reads "Shape: Mixed". It opens a menu, "Shape", of two
radio items with icons, **Square** and **Circle**, the current one checked. Choosing one sets
every selected shape's kind, keeping each one's logical ID, text, marks, text style, paint,
position, size, group and section, as one step, "Change shape". Escape or a press outside
closes the menu without a change; choosing closes it.

## Fill and Border

For shapes, the context bar's Colour button (v8) is replaced by two buttons:
- **Fill**, a dot showing the fill colour (outlined when the mode is `none`) and a chevron,
  named "Fill: *label*" or "Fill: None";
- **Border**, a three-line icon and a chevron, named "Border: *style*, *label*".

Each opens a dark panel (background `#1f1f22`, corner radius 12, below the bar) with:
1. a row of three toggle buttons, pressed for the current value: **Fill**, **Transparent**,
   **No fill** in the Fill panel; **Solid**, **Dashed**, **None** in the Border panel;
2. the 21 shape colours as round swatches in two rows, in the order of the table above read
   down each pair of columns: black, dark-gray, red, orange, yellow, green, teal, blue, violet,
   pink, white; then gray, light-gray, light-red, light-orange, light-yellow, light-green,
   light-teal, light-blue, light-violet, light-pink; each named by its label and pressed when
   it is the current colour;
3. a **Custom** swatch (a colour wheel) at the end of the second row, named "Custom colour",
   pressed when the current colour is custom. It opens the browser's colour picker
   (`input type="color"`) with the current colour; the chosen value is stored in lowercase.

Choosing a mode or style changes it and keeps the panel open. Choosing a swatch changes it and
closes the panel. Each change applies to every selected shape as one step: "Change fill" or
"Change border". The colour picker commits once, when the browser reports the chosen value
(its change event, not each input event), as one step that closes the panel; dismissing the
picker without choosing changes nothing and leaves the panel open.

**When the selected shapes differ.** Each of kind, fill mode, fill colour, border style and
border colour is shown independently: its common value when every selected shape has the
same one, otherwise **Mixed**. With a mixed value no toggle or swatch is pressed, the button
is named "Fill: Mixed" or "Border: Mixed" (its dot or icon shows the first selected shape's
value in reading order), and the colour picker opens with the first selected shape's colour.
Choosing a value sets it on every selected shape.

**Menus and panels.** At most one of the Colour, Arrange, Shape, Fill and Border popups is open
at a time; opening one closes the others. Escape closes the open one and returns focus to its
button. Focus leaving the popup and its button, a press outside them, a change of selection,
or the context bar hiding closes it without a change.

**A fill colour darkens the border.** Choosing a fill colour (a swatch or custom) also sets
the border colour of each changed shape to the fill colour with each red, green and blue
channel multiplied by 0.75 and rounded, written as a custom colour (blue `#3d9cf5` gives
`#2e75b8`; white gives `#bfbfbf`), in the same step. The border style is unchanged. Choosing
a border colour afterwards replaces it.

**Mixed selections.** When the selection holds shapes and other objects (stickies, text or
sections), the bar shows Colour for the other objects and Shape, Fill and Border for the
shapes; each control changes only its own objects. Text size, alignment and formatting apply to every selected
idea as today. A section in the selection hides text controls as v17 says.

## Session paint

The **session paint** is the fill and border a new shape gets. It starts as fill mode `fill`,
colour `white`, border style `solid`, colour `dark-gray`. Only Change fill and Change border
change it: after one is committed, undone or redone, the session paint becomes the resulting
paint of the last shape that command changed, in reading order. Creating, Paste, Duplicate,
Delete, Undo or Redo of any other step, and selecting a shape do not change it. It is not
saved: a reload resets it; opening another board in the same page keeps it.

## Objects

Objects' list labels a shape "square *n* · *text*" or "circle *n* · *text*", numbered among
ideas as v17 says, with the group and section parts as for any idea.

For a selection holding shapes, Objects shows, in this order, after Content: **Shape**
(Square, Circle, or Mixed), **Fill** (Fill, Transparent, No fill), **Fill colour** and
**Border** (Solid, Dashed, None) and **Border colour**, each a select acting as the
matching context-bar control. The colour selects list the 21 labels and **Custom…**; a
custom current colour shows as its own option, labelled "Darker *fill label* (from fill)"
when it equals the darkened colour of the selection's common fill colour, otherwise as its
value (the "from fill" label only in Border colour); Custom… opens the browser's colour
picker. Mixed values show as **Mixed** as in **Fill and Border**. Colour (v8) is shown for the
other objects in the selection (stickies, text and sections) exactly as today, and not for
shapes. Text size, Alignment, Formatting and Section are as today.

Objects shows a **Grow to fit text** button after the size buttons whenever Grow to fit text is
available (see **Long text**).

Objects' add buttons become Add sticky, Add text, **Add square**, **Add circle**, Add section.

## Keyboard route

Everything above can be done from the keyboard: R and O on the scene, the Shapes panel's
tiles, and Enter to place; Objects' Add square and Add circle; the Shape, Fill, Fill colour,
Border and Border colour selects; Grow to fit text; and every existing route for ideas.

## History

v17's history table gains rows, one step each: **Create shape** (any route), **Change
shape**, **Change fill** (including the darkened border), **Change border** and **Grow to
fit text**. Steps record each changed object as a whole, so Undo and Redo restore kind,
paint, text, style and geometry exactly and select as v10 says.

## Opening older boards

A board saved as document v1 to v5 opens with no shapes and otherwise exactly as before.
Opening changes nothing; the first Save after an edit writes document v6.

## Verification boundary

Desktop Chrome and Safari as installed. Unit tests cover:
- document v6: shape keys, order, values and per-type key sets; the version rule; `color`
  fixed at neutral; custom colours lowercase; reading versions 1 to 5 and canonical output for
  each; the adapter's shape values;
- the darkened border for every named colour and a custom one; the text colour rule; the
  text box of each kind; whether text fits, with no line and with the ellipsis; the fit height
  with its 2,000 and board limits, and when Grow to fit text is available;
- changing kind, fill and border on one and several shapes, mixed selections and Mixed values,
  and their one-step undo; session paint after Change fill and Change border and their Undo
  and Redo, and unchanged by other steps;
- resizing a shape with no text floor;
- placing, drawing limits and clamping; a new shape joining a section by its centre;
- copies keeping shape keys with fresh identities.

Browser checks cover, in Chrome: the Shapes tool, panel and R/O keys; drawing and placing;
the Add text editor; the drawn look of each paint; the Shape, Fill and Border controls and
menus; Custom; session paint; long text with its ellipsis and Grow to fit text; Objects'
fields and Add buttons by keyboard; a shape in a section and a group; Copy, Paste, Duplicate,
Delete, Undo and Redo; Save and reload keeping records; and mixed selections. The previous
behaviour elsewhere is unchanged.

The maintainer checks three of these in Safari. v17's remaining rows still describe available
coverage, not automatic gates.
