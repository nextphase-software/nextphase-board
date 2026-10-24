# 0001 — Interaction and browser contract

Contract version: 10 (for 0001-W7 brief v1, 2026-10-23). Status: Draft. When
accepted it replaces [interaction v9](0001-interaction-v9.md) for later work. Uses
unchanged [document v2](0001-document-v2.md) and [storage v1](0001-storage-v1.md).

Every rule in v9 (and, through it, v8, v7, v6, v5, v4 and the 0001-W3
presentation) still applies except where this version replaces or adds to it. This
version lets several objects be selected and acted on together. Where an earlier
version says "the selected object", a command, control or move now acts on every
selected object, as this version specifies. With exactly one object selected,
everything behaves as in v9.

## The selection

The selection is a set of zero or more objects, held by logical ID. As before it is
session-only: it is never saved, never enters history and never advances the draft
revision. Objects removed by any command leave it, and Reopen and reload clear it.
Every selected object shows v4's blue selection stroke.

## Selecting with the pointer

These rules apply to a primary-button press in the Select tool. A press with a
placement armed, in the Pan tool or during Space + drag behaves exactly as in v4 and
v7, and Shift changes nothing there. A press that closes the on-canvas editor, or
one made during composition, does nothing else, as today.

| Press | Result |
| --- | --- |
| On an object that is not selected | Selects it alone, at press. A drag of 3 CSS pixels or more moves it, as in v4 |
| On a selected object, with only that object selected | As in v4 |
| On a selected object, with several selected | No change at press. A drag of 3 CSS pixels or more moves every selected object. A release under 3 CSS pixels selects that object alone |
| On an object, with Shift | Adds the object to the selection, or removes it if it was selected, at press. Never starts a move |
| On empty canvas | Clears the selection at press, as today. A drag of 3 CSS pixels or more draws a selection box |
| On empty canvas, with Shift | No change at press. A drag of 3 CSS pixels or more draws a selection box. A release under 3 CSS pixels leaves the selection unchanged |

Which object a press hits is decided as today: the topmost object whose drawn
rectangle (its width and display height) contains the point.

In read-only views no press starts a move. A press on an object without Shift
selects it alone, at press; Shift and the selection box work as above.

Double-click keeps v4's meaning. Its first click selects the object alone by the
rules above, so a double-click on one member of a set opens that object's editor.

## The selection box

The box spans from the press point to the current pointer, in board coordinates.
The view is frozen for the gesture, as for an object drag. An object is **touched**
when its drawn rectangle, from `x` to `x + width` and from `y` to `y + display
height` (v6 and v8), intersects the box, edges included. A box with no height or
no width, from a purely horizontal or vertical drag, still touches every object it
crosses.

The box is drawn above the objects and below every floating control, with a 1 CSS
pixel `#518de0` border and a `#518de0` fill at 12% opacity, and is hidden from
assistive technology. While it is drawn, the objects that a release would select
show the selection stroke.

On release, the selection becomes every touched object, or, for a box started with
Shift, the previous selection plus every touched object. A box never changes the
document.

Escape outside native text fields, pointercancel, lost pointer capture or window
blur removes the box and restores the selection from before the press. The box
holds pointer capture on the scene, so a release outside the scene still completes
it.

The box is a pointer gesture. v4's and v7's rules for gestures apply to it: Save,
tool, surface, selection and view controls are paused, wheel and pinch make no view
change, and Space does not start a temporary pan. Editing commands are unavailable
with v9's pointer-gesture reason. The box works in read-only views.

## Moving a set

Dragging moves every selected object by the same board distance: the pointer delta
divided by the frozen zoom, as in v4. The distance is limited as one, so that every
selected object stays within the range a single move keeps today: `x` from
-1,000,000 to 1,000,000 minus its width, and `y` from -1,000,000 to 1,000,000 minus
its saved height. Relative positions therefore never change, and unselected objects
never move.

A release after a drag of 3 CSS pixels or more commits one transaction and records
one history step. Escape outside native text fields, pointercancel, lost pointer
capture or window blur restores every selected object to its starting position.

With several objects selected, each of Objects' move buttons moves the set 10 board
units, limited the same way, as one transaction and one step.

As in v4, a drag or button press that the limit reduces to no change creates no
transaction.

## Select all

Cmd/Ctrl+A, without Shift or Alt, while the canvas scene has focus selects every
object and prevents the browser's default there only. It does nothing during a
pointer gesture or on a board with no objects, and it works in read-only views. With
focus anywhere else it is not intercepted; in native text fields it selects text, as
always.

## Commands on a set

Each command below is one semantic transaction and one history step. It advances
the draft revision once and leaves the board Unsaved. With exactly one object
selected, each command, its result and its message are as in v5 and v8.

| Command | With several objects selected |
| --- | --- |
| Duplicate | Copies each selected object as v5 and v8 specify, each at its own `x + 24`, `y + 24`, clamped as in v5. The copies are appended in their sources' reading order and become the selection. Focus stays put. Message: "Duplicated *N* objects. Copies selected." Refused, with the existing 250-object explanation and no change, if the copies would take the board above 250 objects |
| Delete | Removes every selected object and retires each one's generation. The selection clears and focus moves to the scene. Message: "Deleted *N* objects. Undo restores them." Refused, with the existing retired-generation explanation and no change, if retiring them all would take `retiredGenerations` above 10,000 |
| Colour, Text size, Alignment | Applies the chosen value to every selected object that does not already have it. A larger text size grows each of them by v8's rule, in the same step. If every selected object already has the value, nothing changes and no step is recorded |

## History

A history step can cover several objects. v5's history table now reads:

| Steps recorded | One step each |
| --- | --- |
| Create (palette placement or Objects Add) | yes |
| Move (completed drag, 10-unit native move), of one object or a set | yes; a cancelled drag records nothing |
| Text edit | one step per editing session, as in v5 |
| Duplicate, Delete, of one object or a set | yes |
| Style change, of one object or a set | yes, as in v8 |
| Board title, view, selection, panels, Save, Reopen | never |

Undo and Redo restore or reapply every object of a step together, or refuse the
whole step with no change to the board or history.

- **Generation rule, per object.** v5's rule applies to each object of the step:
  each object it removes retires that object's current generation; each object it
  brings back keeps its logical ID, gets a fresh generation and gets back its type,
  text, geometry, style and reading-order position. Objects brought back together
  return to their former reading-order positions.
- **Limits.** A step that would take the board above 250 objects, or
  `retiredGenerations` above 10,000, is refused whole with the existing explanation.
- **Incarnations.** If any object of the step is no longer the incarnation the step
  recorded, the whole step is refused with the existing explanation.
- **Length.** A step covering several objects counts as one of the 100 kept steps.

**Selection and focus after Undo or Redo.** The step's objects that exist afterwards
become the selection, and focus stays on the initiating control or the scene. The
message ends "Affected object selected." for one object or "*N* affected objects
selected." for several. When none of them exist afterwards, the objects the step
removed leave the selection:

- If that empties the selection, focus moves to the scene and the message ends
  "Selection cleared."
- If the selection shrinks but is not empty, the message ends "Removed objects
  deselected."
- Otherwise the message ends "Selection unchanged."

## The bar for a set

With several objects selected, the selection context bar shows, in order: the label
"*N* objects" in place of the type; Colour; Text size; Alignment; Duplicate; Delete.
It has no Edit text or Done and no character count.

A control whose value differs across the set shows **Mixed**:

- The Colour button is named and tooltipped "Colour: Mixed". Its dot is filled
  with a conic gradient of the eight sticky fills in palette order, and no swatch is
  marked as pressed.
- Text size shows "Mixed" as its current value, as an entry that cannot be chosen.
- No alignment button is pressed.

Choosing a value applies it to the whole set.

The bar centres above or below the set's bounding box: left at the smallest `x`,
right at the largest `x + width`, top at the smallest `y` and bottom at the largest
`y + display height`. It clamps within the scene and hides when it does not fit or at
narrow widths, as in 0001-W3 and v8; Objects is then the route. The swatch popover
closes, without a change, whenever the selection changes.

## Objects for a set

Objects' selector becomes a native multiple-selection list labelled "Selected
objects". It keeps v4's option labels and order, has no placeholder option, shows at
least five rows and scrolls. Choosing options in it is equivalent to selecting on
the canvas. The browser's own list conventions apply, and a contiguous range must
be selectable from the keyboard: in Chrome and Safari, with Shift and the arrow
keys. With nothing
selected, Objects is as today: the Content field is disabled, there are no style
controls and the coordinates read "—".

With several objects selected:

- The Content field and its count are replaced by the text "*N* objects selected".
- Colour, Text size and Alignment show "Mixed", as an entry that cannot be chosen,
  when the value differs across the set. Choosing a value applies it to all.
- Duplicate and Delete act on the set.
- The move buttons are named "Move objects left", "Move objects up", "Move objects
  down" and "Move objects right", and move the set.
- The coordinates line shows the set's smallest `x` and smallest `y`.

## Editing text

Text is edited only with exactly one object selected. Enter on the focused scene,
with no placement armed and several objects selected, opens no editor and shows
"Select one object to edit its text." in the status region. A double-click that
leaves several objects selected opens no editor either. Any change of selection ends the text-editing session,
as in v5.

## Keyboard

| Keys | When focus is on the focused scene or a Board control | When focus is in a native text field |
| --- | --- | --- |
| Cmd/Ctrl+A | Select all objects (scene only) | Native select-all; not intercepted |
| Delete, Backspace | Delete every selected object (scene only) | Native; not intercepted |
| Cmd/Ctrl+D | Duplicate every selected object (scene only) | Not intercepted |

Undo and Redo keep v5's keys. Escape does not clear the selection.

## Availability

Editing commands (v9's list) on a set use v9's reasons in v9's order. With nothing
selected, Duplicate, Delete and the style controls keep today's reason, "Select an
object to duplicate or delete." Selecting, by any route above, stays available in
read-only views and is paused during composition and pointer gestures.

## Verification boundary

Desktop Chrome and Safari as installed. Unit tests cover:

- **The box:** an object inside it, partly inside, touching only at an edge or a
  corner, and outside; an object whose display height is taller than its saved
  height; a box with no height.
- **The set move limit:** relative positions kept; each of the four bounds; no
  change at a bound.
- **History steps covering several objects:** a set move, a set style change with
  growth, a set duplicate and a set delete each recorded as one step and undone and
  redone exactly; reading order restored; generations retired and renewed per
  object; the 250 and 10,000 limits and the incarnation check refusing the whole
  step with no change; a set step counting once toward 100.
- **Existing single-object history behaviour,** unchanged.

Browser checks cover the box with and without Shift, Shift-click, moving a set and
undoing it, a set move cancelled with Escape, Duplicate, Delete and each style
control on a set (each undone), Cmd/Ctrl+A, selecting a range in Objects with the
keyboard, and Cmd/Ctrl+A, Delete and Backspace inside a note's text acting on the
text only. v9's remaining rows still describe available coverage, not automatic
gates.
