# 0001 — Board document contract

Contract version: 7 (for 0002-W2 brief v1, 2026-10-27). Status: Draft. When
accepted it replaces [document v6](0001-document-v6.md) for later work. Uses
unchanged [storage v1](0001-storage-v1.md).

Every rule in document v6 (and, through it, documents v5 back to v1) still applies except
where this version replaces it. This version adds a new object type, **connector**: a line
that joins two ideas. It is the first type with no rectangle: in place of `x`, `y`, `width`
and `height` it stores its two ends. This version also defines how version 1 to 6 documents
are read and how the in-memory adapter holds the ends.

## Terms

A **connector** is an object whose `type` is `"connector"`. Its **ends** are `from` and `to`.
Each end names one **eligible idea**: a sticky, a text object or a shape (document v6). A
section, a connector or an ID that is not in the board is not eligible. A connector is not an
idea in document v5's sense: it is never a member of a section or of a group.

## Saved document (version 7)

A complete version 7 document has the same top-level keys as version 6, in the same order,
with `schemaVersion` the integer **7**.

Stickies, text, sections and shapes in a version 7 document have exactly their version 6 keys.
A connector has these keys, in this order:

| Field | Required value |
| --- | --- |
| id, generation, type, text, color, textSize, align, group, marks, section | As in document v6, with `type` also allowing `"connector"` and the connector rules below |
| from | An end: an object with exactly the keys `object` then `anchor` |
| to | An end, as for `from` |
| order | As in document v6 |

A connector has no `x`, `y`, `width` or `height`, and no route, label position or bend; any of
those keys on a connector is rejected, as are `from` and `to` on any other type, and a
connector missing either end.

| Key | Values |
| --- | --- |
| end.object | The logical ID of an eligible idea in the same document |
| end.anchor | The string `"auto"` (the line's end point is worked out when it is drawn; interaction v19) |

## Limits by type

Document v6's table gains one row. Every other limit is unchanged.

| Type | Valid from version | Text | Width and height |
| --- | --- | --- | --- |
| connector | 7 | Up to 100 code points, plain (no marks); empty and multiline allowed | None (no rectangle) |

**Version rule.** As in document v6: a version 1 to 6 document that contains a `"connector"`
object is rejected.

Connectors count toward the 250-object limit, the 2 MiB payload and the identity and
generation rules like any object.

## Connector rules

A version 7 document is rejected unless, for every connector:

1. `from.object` and `to.object` each name an eligible idea in the same document;
2. `from.object` and `to.object` differ;
3. its `color` is `"neutral"`, `textSize` `"medium"`, `align` `"center"`, `marks` an empty
   array, and `group` and `section` both `null`. These shared keys are kept only so every
   object has document v5's keys; they have no effect, and a connector is drawn in one fixed
   look (interaction v19).

Two connectors may join the same two ideas, in either direction. Validation checks the whole
board before it is adopted; it never drops or repairs a connector. A board whose connector
names a missing or ineligible object is invalid, so a saved board can never hold a dangling
connector.

## Canonical payload

A version 7 document is serialized as document v6 describes, with the key order above for a
connector (`from` and `to` after `section`, each as `object` then `anchor`) and version 6's key
orders for every other type. Version 1 to 6 documents are serialized as their own contracts
describe. As in document v6, a board keeps the version it was read with until it is saved:
serializing a board read from a version 1 to 6 payload produces that payload byte for byte.

## Reading version 1 to 6 documents

The decoder accepts version 1 to 6 documents exactly as their contracts define them, and a
version 7 document as defined above. When a version 1 to 6 board is opened for editing it is
upgraded **in memory** to version 7 by the earlier steps, unchanged; no object changes,
because version 1 to 6 boards hold no connectors. As before, the upgrade is not an edit: no
draft revision, transaction or history step, the board is not marked Unsaved, and opening
never writes storage. The next explicit Save writes version 7; storage v1 keeps the earlier
record as its previous record, and both validate.

A new board is version 7. A new connector starts with the values interaction v19 gives it.

## Older versions of the application

An application that implements only documents v1 to v6 treats a version 7 record as an
unknown version, as document v6 says for its own successor: under storage v1 it shows its
unsupported-data view, disables editing and Save, and may offer a valid earlier previous record
as a read-only snapshot. It does not draw any object from the version 7 record, and no record
is changed. A board saved as version 7 can be viewed and edited only by applications that
implement this version or later.

## Identity, transactions and the adapter

Document v1's identity and transaction rules apply. Creating a connector, changing its label
and deleting it are semantic changes, each committed atomically with one draft revision.
Deleting an idea deletes every connector with an end on it in the same transaction. Moving or
resizing an idea changes only that idea: its connectors' saved records do not change, because
their routes are worked out when drawn and never saved.

In the adapter, each live connector's map holds generation, type, text, order, style, group,
marks, section and one atomic value, **ends**, holding `from` and `to`; it holds no geometry.
Other objects hold no ends. Projection to JSON and re-creation of the adapter from validated
JSON include the ends. A restored connector gets back its label and its two ends with their
logical IDs, and a fresh generation under document v1's rule. Drawing or re-routing a
connector never writes the adapter.

## Public references

Document v1's references (retrieved 2026-10-22) apply. The connector type, its ends, the
eligibility and dangling rules and the compatibility rules above are this project's contract.
