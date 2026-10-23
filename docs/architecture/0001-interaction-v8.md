# 0001 — Interaction and browser contract

Contract version: 8 (for 0001-W5 brief v1, 2026-10-23). Status: Draft. When
accepted it replaces [interaction v7](0001-interaction-v7.md) for later work. Uses
[document v2](0001-document-v2.md) and unchanged [storage v1](0001-storage-v1.md).

Every rule in v7 (and, through it, v6, v5, v4 and the 0001-W3 presentation) still
applies except where this version replaces or adds to it. This version adds object
colour, text size and alignment. It replaces v4's statement that object colours and
the 18-unit font are renderer constants rather than style tools, and v6's rule that
the font size never changes.

## Styles

Each object has a colour, a text size and an alignment, stored as document v2
names. Text uses the system font, line height 1.45 times the text size, and the
20-unit inset on every side, as before.

**Colours.** On a sticky the colour sets its fill and edge, and its text is always
`#28272c`. On a text object the colour sets its text; its fill stays transparent.

| Name | Label | Sticky fill | Sticky edge | Text-object colour |
| --- | --- | --- | --- | --- |
| `rose` | Rose | `#f2dce5` | `#e8cdd7` | `#8d2036` |
| `yellow` | Yellow | `#f8e9a6` | `#e9db9c` | `#6b5200` |
| `orange` | Orange | `#f9d9bd` | `#eaccb2` | `#8a3f0a` |
| `green` | Green | `#d6ecc9` | `#c9debd` | `#2f6431` |
| `teal` | Teal | `#cbe9e3` | `#bfdbd5` | `#1f5f57` |
| `blue` | Blue | `#d4e3f8` | `#c7d5e9` | `#2a55a0` |
| `violet` | Violet | `#e2dbf6` | `#d4cee7` | `#5b3fb5` |
| `neutral` | Neutral | `#e9e7ed` | `#dbd9df` | `#28272c` |

Every sticky fill gives `#28272c` text a contrast of at least 11:1, and every
text-object colour gives at least 6.7:1 on the `#fafafa` board, above WCAG's 4.5:1
for normal text. A selected object keeps v4's blue selection stroke.

**Text sizes.**

| Name | Label | Size (board units) |
| --- | --- | --- |
| `small` | Small | 14 |
| `medium` | Medium | 18 |
| `large` | Large | 24 |
| `extra-large` | Extra large | 32 |

**Alignment.** `left`, `center` or `right` aligns each line horizontally within the
object's inner width. Text always starts at the top inset.

**New objects.** A new sticky is `rose`, `medium`, `left`; a new text object is
`neutral`, `medium`, `left`. That is exactly how all objects looked before this
version. Duplicate copies the style along with the type, text, width and height
(replacing v5's list of copied fields).

## Text fits its object, with sizes

v6's sizing rules apply with the object's own text size *s* in place of 18:

- **Needed height** is `ceil(L × s × 1.45) + 40`, where *L* is the number of lines
  the canvas renderer wraps the text into at inner width *W* − 40 with that size.
  Alignment does not change wrapping. Empty text counts as one line.
- Allowed height, saved height after a committed text edit, display height and the
  limit fade are as in v6 and v7, using this needed height. The fade covers the last
  visible line, whose height is `s × 1.45`, and uses the object's text colour.
- Width never changes, and the font size changes only when someone chooses a text
  size.

**Changing the text size** commits, in the same transaction, the new size and a
saved height of `min(allowed height, max(current height, needed height at the new
size))`. A larger size can therefore grow the object; a smaller size never shrinks
it. Changing colour or alignment never changes geometry.

## Style controls

**Selection context bar.** For one selected object, the bar keeps its v5 and
0001-W3 contents and placement rules and adds, after the character count and before
Duplicate and Delete:

1. **Colour**: a button showing the current colour, with the accessible name and
   tooltip "Colour: *label*". It opens a swatch popover attached to the bar and kept
   within the scene, with eight buttons, one per colour, each named and tooltipped
   with its label and the current one marked by a visible ring and as pressed. Tab
   and Shift+Tab move between swatches. Choosing a swatch applies it and closes the
   popover; Escape closes it without a change; both return focus to the Colour
   button. A click or focus move outside the popover closes it without a change and
   leaves focus where it went. The popover also closes, without a change, when the
   bar is hidden or the selection changes.
2. **Text size**: a native select, or a button that opens a menu, showing the
   current size label and offering the four sizes. Choosing a size applies it.
3. **Alignment**: three icon buttons (Align left, Align centre, Align right), the
   current one pressed.

The bar's width follows its contents. It still centres above or below the selection,
clamps within the scene and is hidden when it does not fit or at narrow widths, as
in 0001-W3. Objects is then the route.

**Objects panel.** When an object is selected, Objects shows three labelled native
controls for it, Colour, Text size and Alignment, offering the same values. They are
the keyboard route and are equivalent to the bar, as v4 requires.

**Availability.** A style control is unavailable, with its reason, exactly when
Duplicate and Delete are: no selection, composition, a pointer gesture, an invalid
draft or a read-only view.

**Focus.** After a style change, focus stays on the control used: the Colour
button, for a swatch. Selection does not change.

## Transactions and history

A style change is one semantic transaction, advancing the draft revision once and
marking the board Unsaved. v5's history table gains a row: **Style change**, one
step each. Choosing the value an object already has changes nothing and records no
step.

Undo and Redo restore exactly the previous style of the one affected object; a text
size change and the height growth it caused are undone and redone together. Text,
geometry (other than that growth) and every other object are untouched. v5's
generation rule applies, and an object brought back by Undo or Redo also gets back
its style.

Using a style control while that object's on-canvas editor is open moves focus out
of the editor. As v4 specifies for ordinary blur, that closes the editor with the
draft retained and focus at the control, and, as in v5, it ends the text-editing
session. A text change made so far is therefore its own step, before the style step.
Edit text reopens the editor, drawn with the new style. In Objects, leaving the
Content field for a style control likewise ends that session, and the field stays
visible.

## Editor

The on-canvas editor uses the object's text size times zoom, its alignment, its
text colour (`#28272c` on stickies) and line height 1.45, so it stays aligned with
the drawn text. v4's clipped-editor fallback applies with the object's own size:
the editor moves to Objects when `s × z` would be under 12 CSS pixels (for Small,
below about 86% zoom), or under any other v4 fallback condition.

## Opening boards saved before this version

Boards saved as document v1 are drawn with document v2's defaults and therefore
look exactly as before. Opening one changes nothing: it is not Unsaved and adds no
history. The first Save after an edit writes document v2.

## Verification boundary

Desktop Chrome and Safari as installed. Unit tests cover document v2 validation,
the version 1 read rule and per-version canonical output, needed height per text
size, and a style change as one undoable step. Browser checks cover each control in
the bar and in Objects on a sticky and a text object; a larger size growing a full
note with one undo reverting both; save and reload keeping styles; a board saved
before this version opening unchanged with nothing written until Save; and Escape
closing the swatch popover. v7's remaining rows still describe available coverage,
not automatic gates.

## Public references

WCAG 2.2, success criterion 1.4.3 Contrast (Minimum), and its relative-luminance
definition — <https://www.w3.org/TR/WCAG22/#contrast-minimum> (retrieved
2026-10-23). The palette, sizes and controls are this project's design.
