# 0001 — Board document contract

Contract version: 6 (for 0002-W4 brief v1, 2026-10-26). Status: Draft. When
accepted it replaces [document v5](0001-document-v5.md) for later work. Uses
unchanged [storage v1](0001-storage-v1.md).

Every rule in document v5 (and, through it, documents v4, v3, v2 and v1) still applies except
where this version replaces it. This version adds a new object type, **shape**: a square or a
circle that holds text, with its own fill and border. It is the first type with keys of its
own, so the set of keys an object has now depends on its type. This version also defines how
version 1 to 5 documents are read and adds the shape values to the in-memory adapter.

## Terms

A **shape** is an object whose `type` is `"shape"`. Its **kind** is `"square"` or `"circle"`.
A shape is an idea in document v5's sense: it may be a member of a section and a member of a
group. Stickies, text and sections are unchanged.

## Saved document (version 6)

A complete version 6 document has the same top-level keys as version 5, in the same order,
with `schemaVersion` the integer **6**.

Each version 6 object has the keys of a version 5 object, in the same order, and a shape
also has three more keys, placed after `section` and before `x`:

| Field | Required value |
| --- | --- |
| id, generation, type, text, color, textSize, align, group, marks, section | As in document v5, with `type` also allowing `"shape"` and the shape rules below |
| shape (shapes only) | `"square"` or `"circle"` |
| fill (shapes only) | An object with exactly the keys `mode` then `color` |
| border (shapes only) | An object with exactly the keys `style` then `color` |
| x, y, width, height, order | As in document v5, with the shape's size range below |

A sticky, text or section in a version 6 document has exactly its version 5 keys; the three
shape keys on any other type are rejected, as is a shape without all three.

| Key | Values |
| --- | --- |
| fill.mode | `"fill"`, `"transparent"` or `"none"` |
| fill.color, border.color | A **shape colour**: one of the 21 names below, or a custom colour written `#` and six lowercase hexadecimal digits |
| border.style | `"solid"`, `"dashed"` or `"none"` |

The 21 shape colour names are `black`, `dark-gray`, `red`, `orange`, `yellow`, `green`, `teal`,
`blue`, `violet`, `pink`, `white`, `gray`, `light-gray`, `light-red`, `light-orange`,
`light-yellow`, `light-green`, `light-teal`, `light-blue`, `light-violet` and `light-pink`.
A colour is stored even when its mode or style is `"none"`, so turning the paint back on
restores it. How each colour is drawn is interaction v18's.

## Limits by type

Document v5's table gains one row. Every other limit is unchanged.

| Type | Valid from version | Text | Width and height, each |
| --- | --- | --- | --- |
| shape | 6 | Up to 1,000 code points, with marks as for a sticky | 40 to 2,000 |

**Version rule.** As in document v5: a version 1 to 5 document that contains a `"shape"`
object is rejected.

Shapes count toward the 250-object limit like any object.

## Shape rules

A version 6 document is rejected unless, for every shape:

1. Its `color` is `"neutral"`. A shape's paint is its `fill` and `border`; the shared `color`
   key is kept only so every idea has the same version 5 keys, and it has no effect.
2. Its `textSize`, `align` and `marks` follow document v2 and v4 as for a sticky.
3. Its `group` and `section` follow document v5 as for any idea.

## Canonical payload

A version 6 document is serialized as document v5 describes, with the key orders above:
`shape`, `fill` (`mode`, `color`) and `border` (`style`, `color`) after `section` for a shape,
and no extra keys for other types. Version 1 to 5 documents are serialized as their own
contracts describe. As in document v5, a board keeps the version it was read with until it is
saved: serializing a board read from a version 1 to 5 payload produces that payload byte for
byte.

## Reading version 1 to 5 documents

The decoder accepts version 1 to 5 documents exactly as their contracts define them, and a
version 6 document as defined above. When a version 1 to 5 board is opened for editing it is
upgraded **in memory** to version 6 by the earlier steps, unchanged (version 1 to 4 objects
still gain document v5's defaults, and version 5 membership is kept); no object gains a shape
key, because version 1 to 5 boards hold no shapes. As before, the upgrade is not an edit: no draft
revision, transaction or history step, the board is not marked Unsaved, and opening never
writes storage. The next explicit Save writes version 6; storage v1 keeps the earlier record
as its previous record, and both validate.

A new board is version 6. A new shape starts with the values interaction v18 gives it.

## Older versions of the application

An application that implements only documents v1 to v5 treats a version 6 record as an
unknown version, as document v5 says for its own successor: under storage v1 it shows its
unsupported-data view, disables editing and Save, and may offer a valid earlier previous record
as a read-only snapshot. It does not draw the board's shapes or any of its objects from that
record, and no record is changed. A board saved as version 6 can be viewed and edited only by
applications that implement this version or later.

## Identity, transactions and the adapter

Document v1's identity and transaction rules apply. Changing a shape's kind, fill or border,
or growing it to fit its text, is a semantic change committed atomically that advances one
draft revision; a shape keeps its logical ID when its kind changes.

In the adapter, each live shape's map also holds three atomic values, **shape**, **fill** and
**border**, alongside its generation, type, text, order, style, group, marks, section and
geometry; other objects hold none of them. Projection to JSON and re-creation of the adapter
from validated JSON include them. A restored shape gets back its kind, fill and border with its
other content and keeps its logical ID; it gets a fresh generation under document v1's rule.

## Public references

Document v1's references (retrieved 2026-10-22) apply. The shape type, its keys and values,
the per-type key sets and the compatibility rules above are this project's contract.
