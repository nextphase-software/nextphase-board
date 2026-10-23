# 0001 — Interaction and browser contract

Contract version: 6 (revised for 0001-W4 brief v3, 2026-10-22: growth stops at the
document's bottom edge, and the display rule names that limit). Status: Draft. When accepted it replaces
[interaction v5](0001-interaction-v5.md) for later work. Uses unchanged
[document v1](0001-document-v1.md) and [storage v1](0001-storage-v1.md).

Every rule in v5 (and, through it, v4 and the 0001-W3 presentation) still applies
except where this version replaces it.

## Default sizes

Sticky creates **240×240** board units (replacing v4's 240×160). Text keeps
**320×120**. Placement, centring, clamping, reading order and identities are as
in v4. Duplicate copies the current size, as in v5.

## Text fits its object

Object text is drawn as in v4: system font, 18 board units, line height 1.45,
20-unit inset on every side, wrapped to the object's inner width. The canvas hides
text only past an object's allowed height, as **Limit** below describes.

**Needed height.** For an object of width *W*, the needed height is
`ceil(L × 18 × 1.45) + 40`, where *L* is the number of lines the canvas renderer
wraps the text into at inner width *W* − 40 with the font, size and line height
above. Empty text counts as one line.

**Allowed height.** For an object at *y*, the allowed height is
`min(2000, 1000000 − y)`: document v1's 2,000-unit limit and its rule that the
bottom edge is at most 1,000,000. A valid saved object's height never exceeds it.
Growth never moves an object; *x* and *y* stay as they are.

**Saved height (grow only).** When a text edit is committed, the object's saved
height becomes `min(allowed height, max(current height, needed height))`. Width never changes
and the font size never changes. The height change is part of the same semantic
text transaction: it advances the draft revision once with the text and is undone
or redone with it (one history step per editing session, as in v5). A height never
decreases automatically; deleting text leaves the height as it is. Selection, view,
opening an editor, reopening a board or saving never change a height.

**Display height.** The canvas draws each object at
`min(allowed height, max(saved height, needed height))`, with the needed height
measured in the current browser: never shorter than its saved height, and as tall
as its text needs up to its allowed height, even when that is taller than its
saved height. This display-only extra is never saved and never creates a transaction. It
covers small font differences between browsers.

**Limit.** Heights stay within document v1's 40–2,000 range and bottom-edge rule.
When text needs more than the allowed height, the object is drawn at the allowed
height with the last visible line faded to show there is more; the full text stays
readable and editable in the on-canvas editor and the Objects panel.

**Editor.** The on-canvas native editor uses the displayed height and grows with it
while typing, keeping v4's alignment of font, inset and line height with the drawn
text. The clipped-editor fallback to Objects (v4) still applies.

## Existing saved objects

Saved objects keep their exact saved width and height when a board is opened; there
is no migration. A saved 240×160 sticky stays 240×160 unless its text needs more
room, in which case the grow-only rule applies at its next committed text edit, and
the display rule applies whenever it is drawn.

## Verification boundary

Desktop Chrome and Safari as installed. The pure sizing rule needs unit tests with
injected line counts. Browser checks cover a new square sticky, typing past the box
with the editor aligned, an existing 240×160 sticky opening unchanged, and save then
reload keeping sizes. v5's remaining rows still describe available coverage, not
automatic gates.
