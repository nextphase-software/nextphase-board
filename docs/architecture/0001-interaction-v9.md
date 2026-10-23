# 0001 — Interaction and browser contract

Contract version: 9 (for 0001-W14 brief v1, 2026-10-23). Status: Draft. When
accepted it replaces [interaction v8](0001-interaction-v8.md) for later work. Uses
unchanged [document v2](0001-document-v2.md) and [storage v1](0001-storage-v1.md).

Every rule in v8 (and, through it, v7, v6, v5, v4 and the 0001-W3 presentation)
still applies except where this version replaces it. This version changes one
condition: which invalid drafts make editing commands unavailable.

## Invalid drafts and editing commands

v4 keeps two kinds of draft that can be invalid: the **board name** (blank, over
120 code points or invalid Unicode) and an **object's text** (over 1,000 code points
or invalid Unicode). Both are retained and explained, as v4 requires.

| Invalid draft | Save | Editing commands |
| --- | --- | --- |
| Board name | Blocked, as v4 requires | Available |
| Object text | Blocked, as v4 requires | Unavailable, with a reason |

**Editing commands** are Undo, Redo, Duplicate and Delete (v5) and the Colour, Text
size and Alignment controls (v8), wherever they appear. Where v5 and v8 make them
unavailable "while an invalid draft is active", that now means an invalid
object-text draft only. The other conditions are unchanged: a command stays
unavailable during composition, during a pointer gesture and in a read-only view.

The reason shown for an unavailable command is unchanged and checked in the same
order as before: read-only, then composition, then a pointer gesture, then an invalid
object-text draft. A blank or invalid board name alone never makes a command
unavailable and never gives a command reason.

Nothing else changes. The board-name explanation and the "Invalid draft" status
note still appear, and Save still stays unavailable until every draft is valid. The
board name is still not part of undo history (v5), so no editing command reads or
changes it.

## Verification boundary

Desktop Chrome and Safari as installed. The reason a command is unavailable needs
unit tests covering each of its conditions and their order. That the board name never
contributes to it is checked by source review and in the browser. Browser checks, on
a new unnamed board and again with a 121-character board name, cover the style
controls, Undo, Duplicate and Delete working; Save unavailable with its reason;
naming the board enabling Save; and an over-long object text still blocking
commands. v8's remaining rows still describe available coverage, not automatic gates.
