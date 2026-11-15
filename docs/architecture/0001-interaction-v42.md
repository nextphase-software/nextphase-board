# 0001 — Interaction and browser contract

Contract version: 42 (for 0010-W1 brief v1, 2026-11-15). Status: Draft. When accepted it replaces
[interaction v41](0001-interaction-v41.md) for later work. Uses [document v17](0001-document-v17.md), unchanged.

Every rule in v41 (and, through it, v40 back to v4 and the 0001-W3 presentation) still applies except
where this version replaces or adds to it. This version adds four things, on local and hosted boards
alike, none of which changes the board:

- the **zoom range 10–200%**;
- one **fit rule** and one **show rule** for moving the view to a box;
- **Find on board**, which finds objects by their text and steps through them;
- **Zoom to fit**, **Zoom to selection** and a **Sections** list in the Navigation panel.

Board units equal CSS pixels at 100% zoom. A view is `{x, y, z}`: the board point `(x, y)` sits at the
scene's centre and `z` is the zoom, so a board point `p` is drawn at scene pixel
`(W / 2 + (p.x − x) · z, H / 2 + (p.y − y) · z)` for a scene `W × H` CSS pixels (as today).

## Zoom range

The zoom is clamped to **0.1–2** (10%–200%) on every route: the zoom buttons, the wheel and pinch
rules of earlier versions, Reset view (which still sets zoom 1), following a presenter on a hosted board
(the presenter's view is fitted within 0.1–2) and the fits below. Pan limits are unchanged. The view an
inserted template or activity moves to keeps its own rule (zoom 0.5–1.75 in quarter steps).

The zoom buttons step through **10, 25, 50, 75, 100, 125, 150, 175 and 200%**. Zoom in goes to the
smallest step above the current zoom and Zoom out to the largest step below it; a zoom within 0.001 of a
step counts as that step. At 200% Zoom in and at 10% Zoom out leave the zoom unchanged (as at today's
limits). The zoom bar still shows the zoom as a whole percentage.

The dot grid is drawn at zoom 0.5 and above, exactly as today. Below 0.5 the scene shows its plain
background colour (`#fafafa`) with no dots.

## The free area

The **free area** is the part of the scene where nothing floats over the board. In scene CSS pixels:

- left 12; right `W − 12`;
- top 68 (8 below the 60 px top bars);
- bottom: the top of the board tools bar (the palette) minus 8;
- while the Navigation panel is open, right is the panel's left edge minus 12 when that is smaller.

When the free area is less than 160 px wide or less than 160 px tall (very small windows), the whole
scene less 12 px on each side is used instead.

## Moving the view to a box

A box is a rectangle in board units. The boxes used here are:

- an object's box: its displayed rectangle (`x`, `y`, `width` and its displayed height, as selection
  outlines use today);
- a section's box: its rectangle **plus the 26-unit band above it where its name is drawn**, that is
  `x`, `y − 26`, `width`, displayed height + 26;
- a connector's box: the union of its displayed bounds (its route with its heads) and, when it has a
  label, the label's box;
- several objects' box: the union of their boxes.

**Fit.** With the free area `F` and the box `B`:
`z = clamp(min((F.width − 96) / B.width, (F.height − 96) / B.height), 0.1, 2)` (a box side of 0 counts
as 1), and the view is set so that `B`'s centre is drawn at `F`'s centre:
`x = B.centreX − (F.centreX − W / 2) / z`, `y = B.centreY − (F.centreY − H / 2) / z`, then the view is
clamped as every view is (zoom 0.1–2, `x` and `y` within ±1,000,000), so centring yields to the board's
limits. So the box fills the free area with 48 px of padding, unless the limits stop it.

**Show.** If `B` drawn at the current view lies wholly inside `F`, the view does not change. Otherwise,
if `B` fits inside `F` less 48 px on each side at the current zoom, the zoom is kept and the view is
moved so `B`'s centre is drawn at `F`'s centre (the formula above with the current `z`, then clamped).
Otherwise the box is fitted.

Each fit or show is one view change and counts as the person's own view change, exactly like a pan
(on a hosted board it stops following a presenter, as any own view change does today). Neither ever
edits the board.

## Find on board

### Opening and closing

**⌘F** on macOS and **Ctrl+F** elsewhere (the key `f` or `F`, without Alt; Shift ignored) opens Find
whenever a board is shown, wherever focus is on the page, including while text is being edited and in
an open panel. The browser's own find does not open. While an input method is composing, or while a
Tidy up preview is open, the key does nothing (and the browser's find is still prevented). If a text
edit is in progress it ends first exactly as when the canvas is pressed elsewhere. The Navigation
panel's **Find on board** button opens Find too.

Opening shows the **find bar** and focuses its field with its whole text selected. The field keeps the
**last query of this tab** (empty at first). Every opening of a closed bar runs that query as a query
change does: the first result becomes current and the view shows it. Opening while the bar is already
open only focuses the field and selects its text. Nothing about Find is saved or shared, and a reload
starts empty.

Ending a text edit on opening records that edit exactly as ending it any other way does (one ordinary
edit, as today); Find itself adds no edit.

**Closing**: Escape anywhere in the bar, or the **Close find** button. The bar, the rings and the fading
go and focus moves to the canvas. **If there is a current result, that object becomes the selection**
(it alone); without one the selection is unchanged. Opening another board closes the bar without
selecting.

### The find bar

A floating bar in the board's floating style (white, 1 px `#e9e7ed` border, 12 px radius, shadow
`0 2px 8px #29202e0a`): right 12 px, top 68 px, **290 px** wide; padding 3 px top and bottom, 6 px
right, 12 px left; text `#29202e` in the app's font, line height 1.2. With one row it is **48 px** tall.
Under 768 CSS pixels of window width it spans from left 12 px to right 12 px. It is drawn above the
notices row where they overlap. While its field has focus, the bar's border is `#7051cf` (the field
has no outline of its own); the buttons keep the shared focus look.

Its first row is 40 px tall, items centred vertically with 4 px gaps, in this order:

1. a search icon, 18 px, `#6f6876`, decorative;
2. the field: a text input with the accessible name **Find on board**, placeholder `Find…`, 14 px,
   padding 0 4 px, no border, background or outline of its own, at most 200 characters, taking the
   remaining width;
3. the counter, 13 px, `#6f6876`, tabular figures, no wrapping, 2 px right margin, in a polite live
   region;
4. **Previous result** and **Next result**: the shared 40 × 40 icon buttons (chevron up, chevron down),
   tooltips `Previous result · ⇧Return` and `Next result · Return`;
5. a 1 × 20 px `#e9e7ed` divider with 2 px margins on each side;
6. **Close find**: the shared 40 × 40 icon button (×), tooltip `Close find · Esc`.

The icon buttons use the shared icon-button looks (hover, focus-visible, pressed and the shared disabled
look, as every icon button today). Icons are 20 × 20 view boxes drawn with `currentColor` strokes,
width 1.75, round caps and joins: search `circle cx 9 cy 9 r 5.5` and the line from (13.2, 13.2) to
(17, 17), drawn at 18 px; chevron up `M5 12.5 L10 7.5 L15 12.5`; chevron down `M5 7.5 L10 12.5 L15 7.5`;
close `M5.5 5.5 L14.5 14.5 M14.5 5.5 L5.5 14.5`, drawn at 20 px.

The counter reads: nothing while the query is empty; `<n> of <m>` with a current result (n counted
from 1 in result order); `– of <m>` with results but no current one; `No results` when the query is not
empty and nothing matches. Previous and Next are disabled while there are no results.

A second row, 2 px below the first, 12 px `#6f6876`, its text aligned with the field's text (26 px from
the bar's content edge), wrapping within the bar, with 3 px more padding below, holds the **removed
line** (below), shown only while it applies, and is part of the same live region.

### What is searched

Every object whose type has text: **stickies, shapes, text objects, sections (their name), connectors
(their label) and mind-map nodes**, using the object's text as plain text (formatting ignored). Left
out: objects hidden inside a collapsed mind-map branch, and objects whose text is empty. Strokes,
tapes, images, comments, reactions, author names and the board's name are never searched.

### Matching and results

The query is the field's text with leading and trailing white space removed. An object **matches**
when the query is not empty and its text contains the query, both compared after
`normalize("NFC")` and `toLowerCase()`. Each matching object is **one result**, however often it
contains the query.

Results are in **reading order** of their boxes, by the reading-order rule Tidy up uses
(interaction v41): rows from the top by vertical-centre bands, left to right within a row, ties by id.
Results are worked out again on every change to the field.

When the query changes, the **first result becomes current** (none when there are none) and the view
**shows** its box (the show rule). **Next** (Return in the field, or the Next result button) makes the
following result current, wrapping from the last to the first; **Previous** (Shift+Return, or the
button) the preceding one, wrapping from the first to the last. Each step shows the new current box.
With no results these do nothing.

### Changes to the board while the bar is open

Results are worked out again, with the same query, on **every change to the board shown**: the
person's own edits, Undo and Redo, inserted templates and activities, and on hosted boards every
collaborator's change. The view does not move because of such a change.

- If the current result is still a result it stays current (its number may change).
- If the current object was removed or no longer matches, there is **no current result**. While other
  results remain, the counter reads `– of <m>` and the removed line reads
  `The result you were on was removed. Return goes to the next one.`. Find remembers the removed
  result's last box and id; Next and Previous then put that box among the current results' boxes, order
  them all by the reading-order rule, and make current the result just after it (Next) or just before it
  (Previous), wrapping. When no results remain the counter reads `No results` and there is no removed
  line.
- A result that appears (for example after Undo) is counted but does not become current.
- With results but no current one and no removed place (for example results that appear after a query
  matched nothing), Next makes the first result current and Previous the last.
- If the removed object is a result again before Next or Previous is used (for example after Undo), it
  is no longer a removed place: Next or Previous makes that object current.

The removed line goes as soon as a result becomes current or the query changes.

### Rings and fading

While the bar is open, every result has a **ring** drawn outside its box, in screen pixels that stay the
same at every zoom, over the board and under the floating bars and panels:

- the **current** result: a 3 px `#f08c00` line 5 px outside the box, corner radius 7 px, with a 3 px
  `rgba(240, 140, 0, 0.18)` halo outside it;
- **other** results: a 2 px `#fcc419` line 4 px outside the box, corner radius 6 px.

While there are results and **nothing is selected**, every object that is neither a result nor a
section is drawn at **40% opacity**. With a selection, or with no results, nothing is faded.

Rings and fading never take pointer events. Pressing an object on the board selects it exactly as
without Find, and the bar stays open.

### Keys and focus in the bar

Tab moves through the field, Previous result, Next result and Close find. In the field, Return is
Next, Shift+Return is Previous and Escape closes; the field's own text editing (including ⌘Z/Ctrl+Z,
copy and paste) is the browser's, never the board's. On hosted boards, the reactions, comments and
spotlight keys, and the follow keys, ignore every key event that starts inside the find bar. Escape on a bar button also closes. An Escape,
Return or Shift+Return handled by the bar goes no further: it does not close an open panel, change the
tool or reach the canvas's keys.

## Navigation panel

The panel (opened by the Navigation button beside the zoom, heading `Move around the board`) holds, in
this order, using the panel's existing button look:

1. **Find on board** followed by the hint `⌘F` (macOS) or `Ctrl+F` (elsewhere), 12 px `#6f6876`, 6 px
   after the label: opens Find (the panel stays open);
2. a row of two equal buttons, 8 px apart, each with padding 6 px 4 px and line height 1.2: **Zoom to
   fit** and **Zoom to selection**, each label followed on its own line by its hint (`⇧1`, `⇧2`), 11 px
   `#6f6876`, 2 px below the label;
3. the heading `Sections` (13 px, weight 600, 6 px above it and none below), then a list of full-width
   buttons 6 px apart, one per section, in reading order of their boxes, its text the section's name
   with white space trimmed or `Untitled section` when the name is empty, its accessible name
   `Go to section <that text>`; with no sections, the text `No sections yet` (13 px, `#6f6876`);
4. the heading `Move` (13 px, weight 600, 6 px above it and none below), then Pan left, Pan right, Pan up and Pan down
   in a 2 × 2 grid with 8 px gaps, behaving as today;
5. Reset view and Close navigation, as today.

The panel's existing 12 px gap stays between these items. Every button keeps the shared button looks
(hover, focus-visible with its 3 px outline, the shared disabled look). The panel keeps its position
and its scrolling rule.

- **Zoom to fit** fits the box of every object on the board. With no objects it is disabled, with the
  tooltip `Add something to the board first`.
- **Zoom to selection** fits the box of the selected objects. With nothing selected it is disabled,
  with the tooltip `Select something to zoom to`.
- A **section button** fits that section's box, using the free area that leaves out the open panel.
  The panel stays open, focus stays on the button and the selection does not change.

## Keys

- ⌘F / Ctrl+F: Find (above).
- **Shift+1**: Zoom to fit. **Shift+2**: Zoom to selection. Read from the physical keys `Digit1` and
  `Digit2` with Shift and without Ctrl, ⌘ or Alt, when focus is on the canvas and no text is being
  edited, no input method is composing, no drag is in progress and no Tidy up preview is open.
  Zoom to selection does nothing with an empty selection; Zoom to fit does nothing on an empty board.

No other key changes.

## Kept apart from the board

Find, the fits, the show rule, the Sections list and the zoom range never change the board: no edit,
no Undo step, no change to the save state, nothing sent to collaborators and nothing stored. The only
lasting effect is the ordinary selection made by closing Find with a current result. On hosted boards
every person, viewers included, can use them; closing Find selects for a viewer only as a viewer can
select today.

## Announcements

The counter and the removed line are one polite live region, so changes are read out as they appear
(`3 of 5`, `No results`, the removed line). The fits announce nothing; the zoom bar shows the new zoom.
