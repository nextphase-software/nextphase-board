# 0001 — Interaction and browser contract

Contract version: 14 (for 0001-W11 brief v1, 2026-10-24). Status: Draft. When
accepted it replaces [interaction v13](0001-interaction-v13.md) for later work. Uses
unchanged [document v3](0001-document-v3.md) and [storage v1](0001-storage-v1.md).

Every rule in v13 (and, through it, v12, v11, v10, v9, v8, v7, v6, v5, v4 and the
0001-W3 presentation) still applies except where this version replaces or adds to
it. This version adds **Copy**, **Cut** and **Paste** for board objects. It replaces
v5's statement that Board never reads or writes the system clipboard: Board now
writes plain text to it on Copy and Cut, and still never reads it.

## The object clipboard

Board keeps one **object clipboard** per browser tab, in memory. It is empty when the
page loads, is replaced by each Copy or Cut, and is lost when the tab is closed or
reloaded; Reopen and Save do not change it. It is never saved and never sent
anywhere.

A Copy or Cut stores a **snapshot** of the selected objects, in reading order: each
object's `type`, `text`, `color`, `textSize`, `align`, `x`, `y`, `width` and saved
`height`, and its **group mark**: the object's group ID if every object holding that
ID was selected at that moment, otherwise `null`. It also stores:

- the **source box** of the selection's drawn rectangles (v11) at that moment, as
  four edges computed directly: `left`, the smallest `x`; `top`, the smallest `y`;
  `right`, the largest `x + width`; and `bottom`, the largest `y` + display height.
  The right and bottom edges are kept as computed, never rebuilt from a width or
  height;
- the **source identifiers**: every selected object's logical ID and generation and
  every non-null group mark, which the copies never use (see Paste);
- a **paste count** of 0.

The text stored is the committed text, not an editor draft.

## Copy, Cut and Paste

| Command | Effect |
| --- | --- |
| Copy | Stores the snapshot. Writes the plain text below to the system clipboard, as "Writing the plain text" says. Changes nothing on the board, creates no transaction or history step. Message: "Copied 1 object." or "Copied *N* objects." |
| Cut | Copy, then Delete as v10 specifies (the selection clears and focus moves to the scene), as one transaction and one history step. Delete's messages apply with "Cut" in place of "Deleted": "Cut *label*. Undo restores it." with Delete's object label, or "Cut *N* objects. Undo restores them." If Delete would be refused, Cut is refused with Delete's explanation: the object clipboard, the system clipboard and the board stay as they were |
| Paste | Adds one copy of every snapshot object, as below, as one transaction and one history step; the copies become the selection and focus stays where it is. Message: "Pasted 1 object." or "Pasted *N* objects." |

**The plain text** is the snapshot objects' texts, in the snapshot's order, skipping
objects whose text is empty, joined with two line feeds (`\n\n`). If every text is
empty, it is the empty string.

**Each Paste**, when it succeeds, first increases the paste count by 1 (to *n*), then
builds the copies:

1. **Identity.** Each copy gets a fresh logical ID and generation (document v3's
   fresh rule). Each distinct non-null group mark in the snapshot gets one fresh
   group ID for this paste; a copy's `group` is the fresh ID for its mark, or `null`
   for a `null` mark. Every new identifier must also differ from each of the
   snapshot's source identifiers, even when they are no longer on the board (after a
   Cut, Undo can bring the originals back).
2. **Content.** Each copy has its snapshot object's `type`, `text`, `color`,
   `textSize`, `align`, `width` and `height`.
3. **Position.** With v4's view `centerX`, `centerY` and `zoom` and scene size
   *W* × *H* at the moment of the Paste, the **view rectangle** has the edges
   `viewLeft = centerX − W / (2 × zoom)`, `viewRight = centerX + W / (2 × zoom)`,
   `viewTop = centerY − H / (2 × zoom)` and `viewBottom = centerY + H / (2 × zoom)`,
   each computed as written. The source box is **in view** when `viewLeft ≤ left`,
   `right ≤ viewRight`, `viewTop ≤ top` and `bottom ≤ viewBottom` all hold. If it is
   in view, each copy's `x` is its snapshot `x` + 24 × *n*, and its `y` its snapshot
   `y` + 24 × *n*. Otherwise, with `dx = centerX − (left + right) / 2` and
   `dy = centerY − (top + bottom) / 2`, each copy's `x` is its snapshot `x` + `dx`,
   and its `y` its snapshot `y` + `dy`. All arithmetic is double-precision floating
   point, evaluated in the order written.
4. **Bounds.** Each copy is then clamped to the board as Duplicate clamps (v5): `x`
   becomes `max(−1,000,000, min(x, 1,000,000 − width))`, and `y` likewise with its
   saved height. If rounding then leaves `x + width` above 1,000,000, `x` moves to the
   largest representable value at which `x + width` is at most 1,000,000; likewise
   `y` with `y +` saved height. This replaces v12's rounding rule for Paste: a new
   copy has no display height before the command, so its saved height is used.
5. **Order.** The copies are appended after every existing object, in the snapshot's
   order.

A Paste that would take the board above 250 objects is refused with the existing
250-object explanation, changes nothing and leaves the paste count as it was.

## Where the commands come from

**On the canvas.** When a key press reaches the canvas scene itself (the scene is the
event's target), with Cmd or Ctrl held and neither Alt nor Shift, the C, X and V keys
run Copy, Cut and Paste, handled on the key press like v5's Duplicate shortcut. The
key press's default action is always prevented, whether or not the command is
available. When a command is unavailable, its reason is shown in the status region
and nothing else happens. Paste never reads the system clipboard; it uses only the
object clipboard.

**Everywhere else**, including every text field and Objects' list, those keys keep
their native behaviour, and the object clipboard is untouched. The browser's Edit
menu is not connected to these commands anywhere; it keeps its native behaviour.

**In Objects.** With Objects open, three buttons, **Copy**, **Cut** and **Paste**,
follow the Arrange group, named as shown. Each is unavailable, with its reason as
tooltip and description, exactly as the availability table below says. Focus stays
on the button used, except that Cut moves it to the scene as Delete does.

**Writing the plain text.** Copy and Cut, from the keys or the buttons, write the
plain text with the browser's asynchronous clipboard write, started in the same
event handler. The object clipboard is set, the board changes (for Cut) and the
message is shown at once. If the write is then refused, or the asynchronous
clipboard is not available, the same message is shown again with " Text could not
be placed on the system clipboard." appended, unless any message has been shown since
that Copy or Cut, including one with the same text from a later Copy; the object
clipboard and the board stay as they are.

## Availability

| Command | Unavailable when (first that applies) | Reason |
| --- | --- | --- |
| Copy | Any of v9's reasons other than read-only applies (composition, a pointer gesture, an invalid object-text draft), checked in v9's order | v9's reason |
| Copy | No object is selected | "Select an object to copy." |
| Cut | Any of v9's reasons applies | v9's reason |
| Cut | No object is selected | "Select an object to cut." |
| Paste | Any of v9's reasons applies | v9's reason |
| Paste | The object clipboard is empty | "Nothing to paste." |

Copy is available in read-only views. Cut and Paste are not, by v9's read-only reason.

## History

v13's history table gains rows: **Cut** and **Paste**, one step each; **Copy** never.
Undo of a Paste removes the copies, retiring their generations (v5), and selects as
v10 specifies; Undo of a Cut brings the objects back as Undo of a Delete does.

## Verification boundary

Desktop Chrome and Safari as installed. Unit tests cover the snapshot (reading order,
group marks for whole and partial groups, committed text, the source box's edges,
the source identifiers), the plain text (order, skipped empty texts, all empty), each
Paste's identities and group mapping (one fresh group ID per mark per paste; no
source identifier reused after a Cut, with the UUID source forced to offer one), the
offset cascade (*n* = 1, 2, 3) and centring, the in-view test at its edges including
a right edge that a width would rebuild differently, clamping and the rounding rule
at the board's edges with saved height, the 250 limit leaving the count unchanged,
and the availability reasons and their order.

Browser checks cover, each with the keys and with the buttons: copy and paste of a
set (cascading); panning away and pasting (centred); copying a whole group and
pasting (copies grouped, separately from the original); copying part of a group
(copies ungrouped); Cut and Undo; Paste and Undo. With the buttons only: the
availability reasons. With the keys only: pasting over the 250 limit refused; Paste
on the canvas after other text was placed on the system clipboard (the object
clipboard is used); Cmd/Ctrl+C, X and V inside a note's text and with focus in
Objects' list acting natively, with the object clipboard unchanged. Once each: the
copied text pasted into another application's text field; and, with the page's
asynchronous clipboard write replaced from the developer console, the failure rules
(a refused or missing write still sets the object clipboard, Cut still completes, and
the message gains the suffix; a refusal that arrives after a later Copy's identical
message leaves that later message unchanged). v13's remaining rows still describe
available coverage, not automatic gates.
