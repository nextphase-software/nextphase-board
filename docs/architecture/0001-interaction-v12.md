# 0001 — Interaction and browser contract

Contract version: 12 (for 0001-W9 brief v1, 2026-10-24). Status: Draft. When
accepted it replaces [interaction v11](0001-interaction-v11.md) for later work. Uses
unchanged [document v2](0001-document-v2.md) and [storage v1](0001-storage-v1.md).

Every rule in v11 (and, through it, v10, v9, v8, v7, v6, v5, v4 and the 0001-W3
presentation) still applies except where this version adds to it. This version adds
twelve **arrangement commands**: six that align selected objects, two that distribute
them, and four that change their order.

## Terms

An object's **drawn rectangle** is v11's: `x` to `x + width`, `y` to `y + display
height`, the display height measured before the command. The **box** is the
selection's bounding box of drawn rectangles (v10): its left and top edges are the
smallest `x` and `y`, its right and bottom edges the largest `x + width` and
`y + display height`, its width its right edge minus its left edge and its height its
bottom edge minus its top edge. An object's **order** is
document v1's: its position in the saved array. Objects later in the order draw on
top of earlier ones and are listed later in Objects, as before; there is one order
for both.

## Align

Each align command needs two or more selected objects. It moves each selected object
so that one of its edges or centres matches the box's, and changes nothing else:

| Command | New `x` or `y` of each object (width *w*, display height *h*) |
| --- | --- |
| Align objects left | `x` = the box's left edge |
| Align objects centre | `x` = the box's left edge + (the box's width − *w*) / 2 |
| Align objects right | `x` = the box's right edge − *w* |
| Align objects top | `y` = the box's top edge |
| Align objects middle | `y` = the box's top edge + (the box's height − *h*) / 2 |
| Align objects bottom | `y` = the box's bottom edge − *h* |

Every result lies inside the box and so inside the board (see **Rounding** below).
Positions are not rounded to whole units. The display heights used are those measured
before the command; an
object whose text was cut off at the board's bottom edge (v6's limit) may be drawn
taller after it moves up, as v6's display rule says.

The commands are named "Align objects …" to keep them distinct from v8's text
alignment controls, "Align left", "Align centre" and "Align right".

## Distribute

Each distribute command needs three or more selected objects whose sizes fit inside
the box along that direction, as below. It changes only that direction's positions.

**Distribute horizontally.** Sort the selected objects by `x`, ties by order. The
sum of the widths is
accumulated one object at a time in sorted order, starting from zero. Let the free
space be the box's width minus that sum. If it is negative, the
command is unavailable. Otherwise the gap is the free space divided by one less than
the number of objects; the first object's `x` becomes the box's left edge, and each
next object's `x` becomes the previous object's new `x` plus its width plus the gap,
computed in that sequence. The last object therefore ends at the box's right edge,
up to the rounding rule below.

**Distribute vertically.** The same with `y`, display heights (accumulated the same
way) and the box's height.

## Order

Each order command needs one or more selected objects. It changes the order only;
positions and sizes stay as they are.

| Command | New order |
| --- | --- |
| Bring to front | The unselected objects in their order, then the selected objects in their order |
| Send to back | The selected objects in their order, then the unselected objects in their order |
| Bring forward | For each position from the second-highest down to the lowest, in that sequence: if the object now at that position is selected and the object now just above it is unselected, they swap places |
| Send backward | For each position from the second-lowest up to the highest, in that sequence: if the object now at that position is selected and the object now just below it is unselected, they swap places |

Selected objects therefore never pass each other, and unselected objects keep their
order among themselves. Objects' list and its labels ("sticky 3") follow the new
order, as v4 requires.

## Rounding

Positions are computed in double-precision floating point, in the order written
above. If rounding would leave an object's left or top edge before the box's, or its
right or bottom edge (its new `x` plus its width, or its new `y` plus its display
height measured before the command) after the box's, its new `x` or `y` is moved to
the nearest representable value at which it is inside the box. Because a saved
height never exceeds the display height, this also keeps every object within the
document's range. It applies to every align and distribute result.

## Every arrangement command

- A command that would change nothing (objects already aligned, already in front)
  creates no transaction and records nothing. Otherwise it is one semantic
  transaction, advances the draft revision once and leaves the board Unsaved.
- It is available exactly when the other editing commands are (v9's reasons), and
  in addition only with the number of selected objects it needs; an align or
  distribute command that lacks them is unavailable with the reason "Select two or
  more objects to align.", "Select three or more objects to distribute.", "The
  objects don't fit side by side to distribute." (horizontally) or "The objects
  don't fit one above another to distribute." (vertically). The first applicable
  reason is shown, in that order.
- Selection does not change. Focus stays on the control used, or returns to the
  Arrange button when the command came from its menu.

## History

v11's history table gains a row: **Arrangement** (any of the twelve commands), one
step each. An align or distribute step records the moved objects' positions. An order
step records each selected object with its order before and after; Undo and Redo put
every one back at its recorded order, so the whole order is restored exactly. The
renumbering of other objects is not recorded, as before. Recording a removal still
ignores the renumbering it causes. Undo and Redo select the arranged objects
afterwards, as v10 specifies.

## The Arrange menu

With one or more objects selected, the selection context bar shows an **Arrange**
icon button after the alignment buttons and before Duplicate, named and tooltipped
"Arrange". It opens a popover attached to the bar and kept within the scene, like
v8's colour swatches, with three labelled groups of buttons. Like the Colour
button, Arrange is unavailable, with the reason, while v9's editing-command reason
applies.

1. **Align:** Align objects left, Align objects centre, Align objects right, Align
   objects top, Align objects middle, Align objects bottom.
2. **Distribute:** Distribute horizontally, Distribute vertically.
3. **Order:** Bring to front, Bring forward, Send backward, Send to back.

Tab and Shift+Tab move between the buttons. An unavailable button is disabled, with
its reason as its tooltip and description. Choosing a button applies it and closes
the menu; Escape closes it without a change; both return focus to Arrange. A click
or focus move outside the menu closes it without a change and leaves focus where it
went. The menu also closes, without a change, when the bar is hidden or the
selection changes. At most one of the swatch popover and the Arrange menu is open.

## Objects

With one or more objects selected, Objects shows an **Arrange** group below the size
buttons with the same twelve buttons, the same names and the same availability. It
is the keyboard route, equivalent to the menu, as v4 requires.

## Verification boundary

Desktop Chrome and Safari as installed. Unit tests cover:

- **Align:** each of the six commands for two and for several objects, including an
  object whose display height is taller than its saved height.
- **Distribute:** both directions with different sizes, ties sorted by order, zero
  free space, negative free space refused, and a set at the board's right or bottom
  edge whose arithmetic would round past it (for example four 80-unit-wide objects
  at x = 999001, 999300, 999600 and 999920).
- **Rounding:** right and centre alignment at the board's right edge stay inside it;
  bottom alignment of an object whose display height is far above its saved height
  keeps its drawn bottom inside the box (for example box bottom 100.1, display height
  1006, saved height 40); the free space is accumulated in sorted order (for example
  widths 80, 80.2 and 80.1 at x = 0, 80 and 160.2 give zero free space).
- **Order:** each of the four commands for one object and for a set, including a set
  with unselected objects between its members, objects already at the top or bottom,
  and a command that changes nothing.
- **History:** an order step undone and redone exactly for front, back, forward and
  backward; an align step undone and redone; every existing history case unchanged.

Browser checks cover each command from the menu on a box-selected set, each undone;
the order commands visibly restacking and renumbering Objects' list; the menu by
keyboard (Tab, Escape); the Objects group; and save then reload keeping order and
positions. v11's remaining rows still describe available coverage, not automatic
gates.
