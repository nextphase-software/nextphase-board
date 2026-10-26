# 0001 — Interaction and browser contract

Contract version: 15 (for 0001-W6 brief v1, 2026-10-25). Status: Draft. When
accepted it replaces [interaction v14](0001-interaction-v14.md) for later work. Uses
[document v4](0001-document-v4.md) and unchanged [storage v1](0001-storage-v1.md).

Every rule in v14 (and, through it, v13, v12, v11, v10, v9, v8, v7, v6, v5, v4 and the
0001-W3 presentation) still applies except where this version replaces or adds to it.
This version adds **Bold**, **Italic** and **Strikethrough** for whole objects: three
controls in the selection context bar and in Objects, the drawing of formatted text on
the canvas, and the rule that keeps formatting on the same characters while text is
edited. Formatting part of an object's text while editing it is later work.

## Formatting

An object's text may carry three kinds of inline formatting, in any combination:
**bold**, **italic** and **strikethrough**. Document v4 stores them as marks beside the
plain text. Stickies and text objects both take them; the text colour, size, alignment
and font are the object's, as before.

The editor is unchanged: the Content field and the on-canvas editor are the same native
text field (v4), which shows plain text. Formatting is visible on the canvas; while an
object's on-canvas editor is open, the editor covers it as before.

## Controls

The selection context bar shows, after the alignment group, a **Formatting** group of
three icon buttons, **Bold**, **Italic** and **Strikethrough**, in that order. They use
the 0001-W3 icon rules, tooltips and states, with those accessible names. Objects shows,
after Alignment, a labelled **Formatting** group of three native buttons with the same
names; it is the keyboard route and is equivalent to the bar, as v8 requires for the
style controls. When the bar does not fit, Objects is the route (v8).

Each button is **pressed** (`aria-pressed` true) when at least one selected object has
text and every selected object with text has that formatting over all of its text;
otherwise it is not pressed.

**Activation.** A button applies to whole objects:
- If every selected object with text already has that formatting over all of its text,
  it removes that formatting from all of their text.
- Otherwise it adds that formatting to all of the text of every selected object with
  text.

Objects with empty text are unchanged, and other formatting is kept. The change is one
semantic transaction on all affected objects, advancing the draft revision once and
marking the board Unsaved. When nothing would change, nothing is recorded.

**Availability.** The three buttons are unavailable, with their reason, exactly when the
style controls are (v8 as narrowed by v9): no selection, composition, a pointer gesture,
an invalid object-text draft, or a read-only view. An invalid board name alone does not
make them unavailable (v9).

**Focus.** After activation, focus stays on the button used. Selection does not change.

**Editing session.** As for the style controls (v8): using a formatting button while the
object's on-canvas editor is open closes the editor with the draft retained and ends the
text-editing session, so text typed so far is its own step, before the formatting step;
in Objects, leaving the Content field for a formatting button likewise ends the session.

## Drawing formatted text

An object with no marks is drawn exactly as before, with the same wrapping, clipping
and fade.

An object with marks is drawn as runs: each stretch of text with one combination of
formatting is drawn in the object's font family, size, line height, colour and
alignment, with **bold** weight, *italic* style and a line through the text as its
formatting says. Lines wrap by the same rules the canvas renderer applies to unformatted
text (v6 counts lines that way): lines break after a space or a hyphen-minus, a word
longer than the line breaks between characters, whitespace at a break is dropped, and each
newline starts a paragraph. Each run is measured in its own font, so bold text can wrap
sooner than the same text unformatted. A mark boundary
inside a grapheme cluster takes the formatting of the cluster's first code point, so a
cluster is never split. Alignment applies to each line. Clipping and the fade at a
limited height apply as before. The line count used for an object's height growth (v6,
v8) is the drawn line count.

**Height growth.** Adding or removing bold can change the line count. A formatting
change commits, in the same transaction, the height growth it needs, as a text size
change does (v8): the height grows to fit and never shrinks.

## Formatting while text changes

Every committed text change, including the adoption of a composition's final value
(v4), also moves the object's marks so that formatting stays on the same characters.
Counting in code points:
- The changed span is found by taking first the longest common start of the old and new
  text, then the longest common end within what remains of both.
- Characters before and after it keep their formatting.
- Removed characters take their formatting with them.
- Inserted characters take the formatting the old text has at the character just before
  the change; when the change is at the very start, the formatting of the old text's
  first character.

Each committed text change updates the text, its marks and any height growth in one
transaction. History is unchanged: as v5 specifies, a whole text-editing session is one
step, so Undo restores the text and marks from before the session.

## Copy, Duplicate and Paste

The object clipboard (v14) keeps each object's marks, and Paste and Duplicate give each
copy its source's marks. The system clipboard stays plain text: Copy and Cut write the
objects' `text` as v14 specifies.

## History

v14's history table gains a row: **Formatting change**, one step per activation. Undo
and Redo restore exactly the previous marks of the affected objects, and the height
growth the change caused, together. Text and every other object are untouched. An
object brought back by Undo or Redo also gets back its marks.

## Verification boundary

Desktop Chrome and Safari as installed. Unit tests cover:
- marks: validation of the normalized form; normalizing; toggling over a range; whether
  a formatting covers a whole text; moving marks across insertions, deletions and
  replacements, in code points;
- run layout: wrapping by the rules above, pieces with their own widths and positions,
  marks across paragraphs, clusters kept whole, and alignment offsets;
- document v4: validation, canonical order of objects and marks, reading and upgrading
  versions 1 to 3 byte for byte, and the adapter's atomic marks value;
- the object clipboard keeping marks while the system clipboard stays plain text.

Browser checks cover, in Chrome:
- each button from the context bar and from Objects, adding and removing, and the pressed
  state in both, including a mixed selection;
- formatted text wrapping exactly as the canvas library wraps the same text in the same
  font;
- Undo and Redo of a formatting change;
- typing at the end of formatted text continuing the formatting;
- a two-object selection;
- Copy and Paste keeping marks;
- the buttons unavailable while composing, and a composed text keeping its formatting and
  undone with it;
- reopening the page drawing the saved formatting;
- the previous behaviour unchanged elsewhere.

The maintainer checks the same formatting, Undo and reopening in Safari. v14's
remaining rows still describe available coverage, not automatic gates.
