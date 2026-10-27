# 0001 — Interaction and browser contract

Contract version: 21 (for 0008-W1 brief v1, 2026-10-27). Status: Draft. When accepted it
replaces [interaction v20](0001-interaction-v20.md) for later work. Uses
[document v7](0001-document-v7.md), [storage v2](0001-storage-v2.md),
[the board file contract](0006-board-file-v1.md) and
[the activity catalogue contract](0008-activity-catalogue-v1.md).

Every rule in v20 (and, through it, v19 back to v4 and the 0001-W3 presentation) still applies
except where this version replaces or adds to it. This version adds **templates**: a Templates
button in the bottom toolbar opens a Templates panel listing the catalogue's activities, and Add
template copies an activity's objects onto the board as ordinary, editable objects. It replaces
nothing: Paste, the toolbar's tools and every other panel behave as in v20.

## Terms

An activity's **objects** are the objects in its board file. A set of objects' **box** is the
smallest rectangle holding the saved rectangles (`x`, `y`, `width`, `height`) of those of its
objects that have a rectangle; connectors are left out. The **board's box** is the box of all
objects on the board.

## The Templates button

The bottom toolbar gains a **Templates** button directly after the last object tool (Section).
It is not a tool: it never changes the armed tool except as below. Its accessible name is
"Templates", its tooltip "Templates", and it shows the templates icon (a square divided into a
header row and two columns). It has `aria-expanded` and `aria-pressed` true while the Templates
panel is open, false otherwise. It is unavailable (`disabled`) while the tab is read-only, a
gesture is in progress or text is being composed.

Activating it opens the Templates panel, or closes it when it is open. The Templates panel shares
the panel state with Board, Objects, Navigation and Information, so opening any of them closes
the others, as those four close each other today. Opening the Templates panel also arms the
Select tool, so the Shapes panel (which shows while a shape tool is armed) closes; arming a tool
later, from the toolbar or a shortcut, leaves the Templates panel open.

## The Templates panel

A floating panel above the toolbar, to the right of the toolbar's centre: its left edge at the
middle of the window plus 40 CSS pixels, its bottom edge 10 CSS pixels above the toolbar's top
edge (the toolbar is 56 pixels tall and sits 12, 72 or 76 pixels above the window's bottom by
today's layout, so the panel's bottom is 78, 138 or 142 pixels above it: above 1000 pixels of
width, from 768 to 1000, and up to 767), 448 CSS pixels wide, at most the window height minus 170 CSS pixels tall, scrolling inside when
taller. Below a 1000-pixel window width (where that box would come within 12 pixels of the right edge)
it spans the
width with 12-pixel margins instead, keeping two cards per row; below a 600-pixel width it is
also at most the window height minus 300 CSS pixels tall and shows one card per row.

Top to bottom: a header with the heading "Templates" and a **Close** button; the heading
"Activities"; one **card** per catalogue entry, in catalogue order, two per row. A card holds:
- a **preview**: a drawing of the activity's objects, without text. Its drawing area has
  200 : 130 proportions; the activity's box plus 40 board units on each side is scaled uniformly
  to fit it and centred (an SVG `viewBox` of that box with `preserveAspectRatio` "xMidYMid
  meet"). Each container (section) is a light frame: fill #f0eff3, outline #dbd9df. Each other
  object with a rectangle is a rectangle: filled with the fill colour it is drawn with on a board
  when it has one; otherwise outlined in the border colour it is drawn with when it has one;
  otherwise outlined in #dedede (text). Each connector is a straight #6b6b6b line between the
  centres of its two ends' rectangles. Colours come from the existing style helpers through the
  registry, not from type names;
- the entry's name, its description, and "By <author> · <license>" ("By NextPhase · Apache-2.0");
- an **Add template** button over the preview's centre, shown while the pointer is over the card
  or while the button has keyboard focus, and always in the tab order; its accessible name is
  "Add template: <name>".

Focus: opening the panel moves focus to the first card's Add template. Close, Escape (as for the
other panels) and activating the Templates button again close it and return focus to the
Templates button, or to the canvas when the button is unavailable (for example after the tab
became read-only while the panel was open). Adding an activity closes it as below. The panel stays open while the pointer
is used elsewhere on the page.

## Adding an activity

Add template adds the activity's objects to the board in one step:
1. **Placement.** If the board has no object with a rectangle, the activity's box is centred on
   the current view's centre. Otherwise the activity is moved so that its box's left edge is 120
   board units to the right of the board's box's right edge and its top edge equals the board's
   box's top edge. Each moved rectangle is then kept inside the board's coordinate limits as
   Paste keeps it.
2. **Copies.** Every object is copied as Paste copies (interaction v14, with v17's sections and
   v19's connectors): a new ID and a
   new generation for each object, a new ID for each group, section membership and connector
   ends pointing at the copies, the three order bands kept, the copies after the existing objects
   in each band. The activity's board ID, retired generations and IDs are not used.
3. **History.** The whole addition is one history step: one Undo removes every added object and
   one Redo restores them with the same IDs; generations follow today's history rules for Undo
   and Redo. Undo and Redo do not move the view.
4. **Selection and view.** Every added object is selected; the Templates panel closes; focus
   moves to the canvas. The view's centre moves to the centre of the added objects' box. The zoom
   stays the same when that box, with 48 CSS pixels to spare on each side, fits the canvas at the
   current zoom; otherwise it becomes the largest quarter step (a multiple of 25%, from 175% down
   to 50%) that is below the current zoom and at which it fits, or 50% when it fits at none.
5. **Notice.** "Added “<name>”: <n> objects." with `n` the number of objects added.

Adding the same activity twice gives two independent copies; the second is placed to the right of
the first, as the first was placed to the right of the existing content.

Add template is unavailable (`disabled`) while the tab is read-only, a gesture is in progress or
text is being composed. When the board would pass 250 objects, nothing is added, the panel stays
open, and the notice is the one Paste gives at the limit. If an activity's file cannot be read
(it fails a board file rule; the catalogue test prevents this), nothing is added and the notice
reads "Could not add “<name>”: <reason>.".

Added objects are ordinary objects: everything that applies to stickies, text, shapes, sections
and connectors applies to them, and nothing records where they came from.

## Verification boundary

Desktop Chrome and Safari as installed. Unit tests cover the activity catalogue contract's checks,
placement on an empty and a non-empty board, the copies' identities and references (sections,
groups, connector ends), one history step, the view and zoom rule, the preview's geometry, the
250-object limit, and that Paste is unchanged.

Browser checks cover, in Chrome: the button, its tooltip and state; the panel's content, position,
focus, Close and Escape; adding each activity on an empty and a non-empty board; placement, view,
selection and the notice; the saved record; Undo and Redo; adding twice; editing the added
objects; the read-only state; the 250-object limit; the keyboard route; the narrow layout. The
maintainer checks three of these in Safari. v20's remaining rows still describe available
coverage, not automatic gates.
