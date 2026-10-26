# 0001 — Interaction and browser contract

Contract version: 16 (for 0001-W26 brief v1, 2026-10-26). Status: Draft. When
accepted it replaces [interaction v15](0001-interaction-v15.md) for later work. Uses
unchanged [document v4](0001-document-v4.md) and [storage v1](0001-storage-v1.md).

Every rule in v15 (and, through it, v14, v13, v12, v11, v10, v9, v8, v7, v6, v5, v4 and
the 0001-W3 presentation) still applies except where this version replaces or adds to it.
This version lets the formatting controls act on **part of an object's text** while it is
being edited, adds three **keyboard shortcuts**, and adds a **formatted preview** under
the Content field. It replaces v15's rule that using a formatting button closes the
on-canvas editor. The editor is still the native text field (v4), which shows plain text.

## While editing: the selection

An object's text is **being edited** while its Content field or on-canvas editor has
focus. While it is being edited:

- **With characters selected** in the field, Bold, Italic and Strikethrough apply only to
  the selected characters. If every selected character already has that formatting, it is
  removed from them; otherwise it is added to all of them. Other formatting is kept. The
  selection is counted in code points (document v4), so an emoji or other astral character
  counts once.
- **With only a caret** (nothing selected), they apply to the whole object, as when it is
  not being edited (v15).

Either way the on-canvas editor stays open; v15's rule that a formatting button closes it
no longer applies while the object is being edited. When it is not being edited, v15's
rules are unchanged.

**Focus.** Pressing a formatting button with the pointer does not take focus from the text
field: the field keeps focus and its selection, and the button acts on that selection. A
keyboard user formats a selection with the shortcuts below, without leaving the field.
Moving focus out of the field by any other means is an ordinary blur (v4, v5): editing
ends, the editing session ends and the on-canvas editor closes. The buttons, reached that
way, act on whole objects as v15 says, with focus staying on the button.

**Pressed state.** While characters are selected in the field being edited, a button is
pressed when every selected character has that formatting. Otherwise, including with only
a caret, it is pressed as v15 says for whole objects.

## Keyboard shortcuts

| Shortcut | Effect |
| --- | --- |
| Cmd/Ctrl+B | Bold |
| Cmd/Ctrl+I | Italic |
| Cmd/Ctrl+Shift+X | Strikethrough |

In a text field being edited they act as the buttons do on the field's selection (or the
whole object with only a caret), and the browser's own action for the key, if any, is
prevented. On the canvas, with objects selected, they act on the whole selected objects, as
the buttons do. Cmd/Ctrl+X without Shift stays Cut (v14). They are unavailable exactly
when the buttons are (v15 as narrowed by v9). While text is being composed they do nothing
at all, and the key keeps its browser behaviour. Cmd/Ctrl+Z in a text field stays the
browser's own text undo (v5).

## Formatted preview

When the selected object has formatting, Objects shows, under the Content field, a
read-only preview of its text with each run in bold, italic or struck through, in the
panel's own font. It follows the field's text as it is typed (marks moved by v15's rule).
It is hidden from assistive technology because it repeats the Content field's text, and
shown only when there is formatting to show.

## History

A formatting command while editing first ends the current editing session, so text typed so
far is its own step (v5), then records itself as one step (v15's **Formatting change**).
The editor stays open, and the next typing starts a new session. Undo and Redo restore marks
and any height growth as v15 says. Cmd/Ctrl+Z inside the text field remains native text
undo and does not undo formatting; the Undo button does.

## Verification boundary

Desktop Chrome and Safari as installed. Unit tests cover:
- formatting a range;
- whether a range has a formatting throughout;
- converting a text field's UTF-16 offsets to code points;
- splitting text into runs for the preview.

Browser checks cover, in Chrome:
- in the on-canvas editor: each shortcut on a selection, the editor staying open with focus
  and selection, the pressed state following the selection, a button with the pointer
  keeping focus, and removing formatting from a formatted selection;
- the saved marks and the canvas drawing each word in its own style;
- Undo and Redo of one formatting step;
- a caret formatting the whole object;
- offsets after an emoji;
- in Objects: the pressed state for the Content selection, a shortcut in the Content field
  keeping focus, the preview, and leaving the field ending the selection;
- a shortcut on the canvas formatting whole objects;
- shortcuts changing nothing while composing;
- reopening the page;
- 0001-W6's whole-object behaviour unchanged, and the previous behaviour unchanged
  elsewhere.

The maintainer checks the shortcuts, a selection formatted from the context bar, the
preview and reopening in Safari. v15's remaining rows still describe available coverage,
not automatic gates.
