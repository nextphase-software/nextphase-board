# 0001 — Board document contract

Contract version: 8 (for 0009-W1 brief v1, 2026-10-27). Status: Draft. When accepted it
replaces [document v7](0001-document-v7.md) for later work. Uses unchanged
[storage v2](0001-storage-v2.md) and [the board file contract](0006-board-file-v1.md), with the
version references corrected below.

Every rule in document v7 (and, through it, documents v6 back to v1) still applies except where
this version replaces it. This version adds a new object type, **stroke**: a freehand line drawn
with the marker or the highlighter. It is the first type whose shape is a list of points, and the
first idea that holds no text. This version also defines how version 1 to 7 documents are read,
how the in-memory adapter holds the points, and which earlier rules now read "8" where they read
"7".

## Terms

A **stroke** is an object whose `type` is `"stroke"`. Its **kind** is `"marker"` or
`"highlighter"`; its **weight** is `"thin"` or `"thick"`. Its **ink width**, in board units, is:

| Kind | Thin | Thick |
| --- | --- | --- |
| marker | 4 | 10 |
| highlighter | 22 | 40 |

Its **pad** is half its ink width (2, 5, 11 or 20). Its **centreline** is the polyline through
its points.

A stroke is an idea in document v5's sense: it may be a member of a section and a member of a
group. It is **not** an eligible idea in document v7's sense: a connector end may never name a
stroke. Eligible ideas are now stickies, text objects and shapes.

## Saved document (version 8)

A complete version 8 document has the same top-level keys as version 7, in the same order, with
`schemaVersion` the integer **8**.

Stickies, text, sections, shapes and connectors in a version 8 document have exactly their
version 7 keys. A stroke has these keys, in this order:

| Field | Required value |
| --- | --- |
| id, generation, type | As in document v7, with `type` also allowing `"stroke"` |
| kind | `"marker"` or `"highlighter"` |
| color | One of its kind's eight **ink colour** names (below) |
| weight | `"thin"` or `"thick"` |
| group, section | As in document v7 |
| x, y | As in document v7 (finite numbers; a moved or pasted stroke may sit at a fractional position) |
| width, height | Safe integers in board units; the stroke's rules below; the board's edges as in document v1 |
| points | An array of 2 to 1,000 **points** |
| order | As in document v7 |

A stroke has no `text`, `textSize`, `align` or `marks`: those keys on a stroke are rejected, as
are `kind`, `weight` and `points` on any other type, and a stroke missing any of its keys. Its
`color` is an ink colour name, never a sticky or shape colour.

**Ink colours.** The names are, in this order:
- marker: `black`, `red`, `orange`, `yellow`, `green`, `blue`, `violet`, `white`;
- highlighter: `grey`, `pink`, `orange`, `yellow`, `green`, `cyan`, `violet`, `white`.

A name is valid only for its own kind (`grey` on a marker is rejected). The same name may draw a
different colour in each kind; how each is drawn is interaction v22's.

**Points.** Each point is an array of exactly two safe integers `[px, py]`, in board units,
relative to the stroke's `x` and `y`. Consecutive points may be equal (a dot is two equal
points).

## Stroke rules

A version 8 document is rejected unless, for every stroke:
1. every point has `0 ≤ px ≤ width` and `0 ≤ py ≤ height`;
2. the smallest `px` and the smallest `py` each equal the pad;
3. the largest `px` plus the pad equals `width`, and the largest `py` plus the pad equals
   `height`.

So a stroke's rectangle is exactly its centreline's bounds grown by the pad on every side; its
smallest possible size is the ink width in each direction. Validation checks the whole board
before it is adopted; it never repairs or drops a stroke.

## Limits by type

Document v7's table gains one row. Every other limit is unchanged.

| Type | Valid from version | Text | Width and height, each |
| --- | --- | --- | --- |
| stroke | 8 | None (no text keys) | From its ink width up to the board's edges (no 2,000 cap) |

**Version rule.** As in document v7: a version 1 to 7 document that contains a `"stroke"` object
is rejected.

Strokes count toward the 250-object limit, the 2 MiB payload and the identity and generation
rules like any object. A board of 250 strokes of 1,000 points each can pass 2 MiB; document v1
rejects any payload over 2,097,152 bytes, so such a board cannot be saved, like any other board
over the limit.

## Rules that depend on eligible ideas

Document v7's connector rules apply with this version's eligible ideas: a version 8 document is
rejected when a connector's `from.object` or `to.object` names a stroke. Version 7 documents hold
no strokes, so no version 7 board changes meaning.

## Canonical payload

A version 8 document is serialized as document v7 describes, with the key order above for a
stroke and version 7's key orders for every other type. A point is written `[px,py]`, and
`points` in its saved order. Version 1 to 7 documents are serialized as their own contracts
describe. As before, a board keeps the version it was read with until it is saved: serializing a
board read from a version 1 to 7 payload produces that payload byte for byte.

## Reading version 1 to 7 documents

The decoder accepts version 1 to 7 documents exactly as their contracts define them, and a
version 8 document as defined above. When a version 1 to 7 board is opened for editing it is
upgraded **in memory** to version 8 by the earlier steps, unchanged; no object changes, because
version 1 to 7 boards hold no strokes. As before, the upgrade is not an edit: no draft revision,
transaction or history step, the board is not marked Unsaved, and opening never writes storage.
The next explicit Save writes version 8.

A new board is version 8. A new stroke starts with the values interaction v22 gives it.

## Older versions of the application

An application that implements only documents v1 to v7 treats a version 8 record as an unknown
version, as document v7 says for its own successor: it shows its unsupported-data view, disables
editing and Save, draws no object from the version 8 record, and changes no record. A board saved
as version 8 can be viewed and edited only by applications that implement this version or later.

## Version references in other contracts

These rules of contracts that this version does not otherwise change now name version 8:
- [Board file v1](0006-board-file-v1.md): a file's `payload` is at its own `schemaVersion`, 1 to
  **8**; an edited board is written to a file at version **8** (an unedited one still at its own
  version, byte for byte); check 9 refuses a payload whose `schemaVersion` is a safe integer above **8** ("it was made by
  a newer version of Board"). A file holding a version 8 board opens as any other.
- [Storage v2](0001-storage-v2.md): a board list entry whose payload `schemaVersion` is a safe
  integer above **8** has state `newer`; a board created from a file at an earlier version becomes
  version **8** at its first save after an edit.
- [Activity catalogue v1](0008-activity-catalogue-v1.md): an activity's payload `schemaVersion`
  stays **7**, and reading an activity file still gives its version 7 document. Activity files hold
  no strokes; adding one copies its objects onto a version 8 board (interaction v21's copies).

Nothing else in those contracts changes: storage v2's records and board file v1's envelope carry
any document version.

## Identity, transactions and the adapter

Document v1's identity and transaction rules apply. Drawing a stroke, erasing strokes, changing a
stroke's colour or weight, and moving or resizing it are semantic changes, each committed
atomically with one draft revision. A stroke in progress (while the pointer is down) is never in
the document or the adapter.

In the adapter, each live stroke's map holds generation, type, kind, color, weight, group,
section and order, the atomic **geometry** value (`x`, `y`, `width`, `height`) that every object
with a rectangle has under document v1, and one more atomic value, **points**, holding the whole
points array; points are never held one by one. Strokes hold no text, style or marks values; other
objects hold no kind, weight or points. Projection to JSON and re-creation of the adapter from
validated JSON include the points. A restored stroke gets back its kind, colour, weight and
points with its logical ID, and a fresh generation under document v1's rule.

## Public references

Document v1's references (retrieved 2026-10-22) apply. The stroke type, its keys, ink colours,
point and padding rules and the compatibility rules above are this project's contract.
