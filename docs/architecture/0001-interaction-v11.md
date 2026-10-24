# 0001 — Interaction and browser contract

Contract version: 11 (for 0001-W8 brief v1, 2026-10-23). Status: Draft. When
accepted it replaces [interaction v10](0001-interaction-v10.md) for later work. Uses
unchanged [document v2](0001-document-v2.md) and [storage v1](0001-storage-v1.md).

Every rule in v10 (and, through it, v9, v8, v7, v6, v5, v4 and the 0001-W3
presentation) still applies except where this version replaces or adds to it. This
version lets selected objects be resized. It replaces v6's and v8's rules that an
object's width never changes and that its height never decreases: both may now
change, but only by an explicit resize as below. It also replaces v4's statements
that selected corner marks cannot resize and that resizing is excluded: the handles
below are those corner marks. Text growth from editing and from choosing a larger
text size is unchanged. The last section corrects two sentences of v10 to match the
behaviour shipped with it.

## Terms

For an object, its **drawn rectangle** runs from `x` to `x + width` and from `y` to
`y + display height` (v6 and v8). Its **needed height at width *W*** is v8's needed
height for its own text and text size, wrapped at inner width *W* − 40. Its
**allowed height at *y*** is v6's `min(2000, 1000000 − y)`.

## Handles

When at least one object is selected, the Select tool is active and the view is
writable, the selection shows four **resize handles**, one at each corner: of the
object's drawn rectangle when one object is selected, and of the set's bounding box
(v10) when several are. Handles are hidden in read-only views, while the on-canvas
editor is open, during composition, and during any pointer gesture other than a
resize.

Each handle is an 8×8 CSS-pixel square centred on its corner, with a white fill and
a 1 CSS-pixel `#518de0` border, drawn above the objects and below every floating
control. Handles keep that size at every zoom. Each has a 16×16 CSS-pixel hit area
centred on its corner, and the pointer shows the matching diagonal resize cursor
over it. Handles are hidden from assistive technology; Objects is the accessible
route (see below).

A primary-button press inside a handle's hit area starts a resize. It takes priority
over the object or the empty canvas under it, with or without Shift. A press while
Space is held still pans, as v7 requires.

## Resizing one object

The corner opposite the dragged handle stays fixed. The starting rectangle is the
object's drawn rectangle. The pointer delta is divided by the zoom, frozen for the
gesture, as for moves. Before the 3 CSS-pixel threshold nothing changes; past it the
object follows the pointer, as follows. A delta of zero in both directions returns
the starting geometry unchanged; the steps apply only to a nonzero delta.

1. **Width.** The new width is the starting width plus or minus the horizontal
   delta, towards the dragged corner. It is limited to at least 80, or the starting
   width if that is already less than 80, and at most 2,000. With the left edge fixed,
   the right edge stays at most 1,000,000; with the right edge fixed, the left edge
   stays at least -1,000,000.
2. **Height.** The new height is the starting height plus or minus the vertical
   delta, likewise. It is limited to at least 40 and at most 2,000. With the top edge
   fixed, the bottom edge stays at most 1,000,000; with the bottom edge fixed, the top
   edge stays at least -1,000,000.
3. **Shift.** With Shift held when a step is computed, width and height are instead
   the starting width and height times one scale: whichever of the two raw ratios
   (new width over starting width, new height over starting height) differs more
   from 1, or the larger of the two when they differ equally. That scale is limited
   to the range in which both width and height stay within steps 1 and 2.
4. **Text floor.** Let *T* be the needed height at the new width, capped at 2,000.
   - With the top edge fixed, `y` does not change and the height becomes the larger
     of the height from steps 2–3 and the smaller of *T* and the allowed height at
     `y`.
   - With the bottom edge fixed at *b*, the height becomes the larger of the height
     from steps 2–3 and *T*, and `y` becomes *b* minus that height. If that `y` would
     be below -1,000,000, `y` is -1,000,000 instead, and the bottom edge moves down to
     -1,000,000 plus the height.

   Text therefore never hides because of a resize, unless it needs more than the
   allowed height, in which case v6's fade applies as before. In both cases the
   height is at most the allowed height at the resulting `y`, so v6's display rule
   draws exactly the resulting height.

The text size never changes. Narrowing rewraps the text and so can make the object
taller during the drag; widening leaves the height as dragged. On release after the
threshold, the new `x`, `y`, `width` and `height` are committed as one transaction,
and the saved height is the drawn height. Escape outside native text fields,
pointercancel, lost pointer capture or window blur restores the starting geometry.
A resize that ends where it started creates no transaction.

## Resizing a set

The bounding box's corner opposite the dragged handle stays fixed, at `fx`, `fy`.
The pointer delta gives raw horizontal and vertical scales: the box's new width over
its starting width, and its new height over its starting height, each changing
towards the dragged corner. With Shift, both scales are the one that differs more
from 1, or the larger when they differ equally.

Each selected object, starting from its drawn rectangle `x`, `y`, `w`, `h`, becomes:

- `x' = fx + (x − fx) × sx` and `width' = w × sx`;
- `y' = fy + (y − fy) × sy` and `height' = h × sy`, then raised, if needed, to its
  needed height at `width'`, capped at its allowed height at `y'`.

The fixed corner fixes these scaled positions. Text growth then extends a member
downward from `y'`, as v6's growth does, so with the box's bottom edge fixed, a grown
member can reach below it. The cap keeps every bottom edge within 1,000,000.

The scales are limited so that **every** selected object stays within these limits,
so the set stops as one, as v10's set moves do:

- `sx` is limited to the range in which every member's `width'` is at least 80 (or
  its starting width if already less) and at most 2,000, and its left and right
  edges stay within -1,000,000 and 1,000,000;
- `sy` is limited to the range in which every member's `h × sy` is at least 40 and at
  most 2,000, and its top and bottom edges, before the text floor, stay within
  -1,000,000 and 1,000,000;
- without Shift, each scale is limited to its own range, independently; with Shift,
  the one scale is limited to the overlap of both ranges.

Each range contains 1, the starting scale, so the overlap is never empty. Text sizes
never change.
Unselected objects never change. Release, cancellation and no-change behave as for
one object.

A resize, of one object or a set, is a pointer gesture: v4's and v7's gesture rules
apply (Save, tool, surface, selection and view controls paused; no wheel or pinch
view change; no temporary pan), and editing commands are unavailable with v9's
pointer-gesture reason. Committed positions and sizes are exact; they are not
rounded.

## Objects

Below the move buttons, Objects shows the size of the selection's drawn rectangle
(one object) or bounding box (several), as "W *width* · H *height*" rounded to whole
units, and four buttons with visible text **Wider**, **Narrower**, **Taller** and
**Shorter**. For one object they are named "Make object wider", "Make object
narrower", "Make object taller" and "Make object shorter"; for several, "Make objects
wider", "Make objects narrower", "Make objects taller" and "Make objects shorter".

Each press resizes by 10 board units in its direction with the top-left corner
fixed: one object as if its bottom-right handle were dragged by 10 board units; a set
as if its bounding box's bottom-right handle were dragged by 10 board units. Shift and
other modifiers are ignored: a button changes only its own direction before the text
floor. All the limits and the text floor above apply. Each press is one transaction and one history
step; a press that the limits reduce to no change creates none. The buttons are
unavailable exactly when the move buttons are.

## History

v10's history table gains a row: **Resize** (a completed handle drag or one size
button press), of one object or a set — one step each; a cancelled resize records
nothing. Undo and Redo restore or reapply every resized object's `x`, `y`, `width`
and `height` exactly, using v10's steps covering several objects, and select the
resized objects afterwards, as v10 specifies.

## Unchanged

Moving, the selection box, Shift and select-all rules, the bar's contents and
placement (it follows the new bounds after a resize), commands, styles, text growth
from editing or a larger text size, the saved format and storage.

## Corrections to v10

- **Selection box.** While the box is drawn, the selection itself follows it: it is
  always the selection a release would produce, and the bar and Objects show it
  (the bar's controls stay unavailable during the gesture). This replaces v10's
  sentence that only the selection stroke previews it. Release and cancellation are
  as v10 says.
- **Select all.** During a pointer gesture or on a board with no objects,
  Cmd/Ctrl+A on the scene is not intercepted. This replaces v10's "does nothing" for
  those cases.

## Verification boundary

Desktop Chrome and Safari as installed. Unit tests cover, with the needed height
supplied by the test:

- **One object:** each of the four corners; the width limits (80, the narrower
  starting width, 2,000), the height limits (40, 2,000) and each board edge; the text
  floor with the top and with the bottom edge fixed, its cap at the allowed height,
  and the bottom-fixed case at the top board edge; a zero delta; Shift keeping
  proportions, its
  tie-break, its limit, and the text floor overriding it; a resize ending where it
  started.
- **A set:** scaling about each fixed corner; each scale's limit at a member's width
  80 and 2,000, height 40 and 2,000 and a board edge, independently without Shift and
  together with Shift; the per-member text floor growing downward; Shift.
- **The size buttons:** each direction for one object and a set, and a press reduced
  to no change.

Browser checks cover each corner on a sticky and a text object with Undo, narrowing a
note full of text, Shift, a set resized and undone, Escape during a resize, the size
buttons, and save then reload keeping sizes. v10's remaining rows still describe
available coverage, not automatic gates.
