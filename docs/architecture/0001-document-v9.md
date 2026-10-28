# 0001 — Board document contract

Contract version: 9 (for 0002-W3 brief v1, 2026-10-28). Status: Draft. When accepted it
replaces [document v8](0001-document-v8.md) for later work. Uses unchanged
[storage v2](0001-storage-v2.md) and [the board file contract](0006-board-file-v1.md), with the
version references corrected below.

Every rule in document v8 (and, through it, documents v7 back to v1) still applies except where
this version replaces it. This version gives a **connector** a saved **style** (line colour,
weight, dash, a head at each end and a line shape) and lets each end be **pinned** to one side of
its idea. It also defines how version 1 to 8 documents are read, how the in-memory adapter holds
the style, and which earlier rules now read "9" where they read "8". It replaces:
- document v7's connector rule 3, that a connector is drawn in one fixed look: its look now comes
  from its style (interaction v23);
- document v7's end anchor table, that an anchor is always `"auto"`.

## Terms

A connector's **style** is its six style keys below. Its **default style** is `lineColor`
`"dark-gray"`, `lineWeight` `"thin"`, `lineDash` `"solid"`, `startHead` `"none"`, `endHead`
`"line-arrow"`, `lineShape` `"elbowed"`: the look every connector had under document v7 and v8.

A **pinned** end is one whose `anchor` names a side (`"top"`, `"right"`, `"bottom"` or
`"left"`); an end with anchor `"auto"` takes its idea's nearest side when drawn, as before.

## Saved document (version 9)

A complete version 9 document has the same top-level keys as version 8, in the same order, with
`schemaVersion` the integer **9**.

Stickies, text, sections, shapes and strokes in a version 9 document have exactly their version
8 keys. A connector has these keys, in this order:

| Field | Required value |
| --- | --- |
| id, generation, type, text, color, textSize, align, group, marks, section | As in document v7, with its connector rules (rule 3 for the shared keys only) |
| from, to | An end, as in document v7, with the anchor values below |
| lineColor | A **shape colour** (document v6): one of the 21 names or a custom `#` and six lowercase hexadecimal digits |
| lineWeight | `"thin"` or `"thick"` |
| lineDash | `"solid"` or `"dashed"` |
| startHead | A **head**: `"none"`, `"line-arrow"`, `"solid-arrow"`, `"triangle"`, `"circle"` or `"diamond"` |
| endHead | A head, as for `startHead` |
| lineShape | `"elbowed"`, `"curved"` or `"straight"` |
| order | As in document v7 |

| Key | Values |
| --- | --- |
| end.anchor | `"auto"`, `"top"`, `"right"`, `"bottom"` or `"left"` |

A version 9 connector missing any style key is rejected, as is a style key on any other type, or
a connector key in a version 1 to 8 document that its version does not define (a style key, or an
anchor other than `"auto"`). The shared keys keep document v7's fixed values (`color`
`"neutral"`, `textSize` `"medium"`, `align` `"center"`, `marks` empty, `group` and `section`
`null`); the line's colour is `lineColor`, never `color`. A connector still has no rectangle,
route, label position, bend or free end.

Document v7's connector rules 1 and 2 (both ends name different eligible ideas in the same
document; eligible ideas as document v8 defines them) apply unchanged: a pinned end names an
eligible idea like any end, and two ends may be pinned to any sides, the same side included.

## Limits by type

No limit changes. Connectors count toward the 250-object limit, the 2 MiB payload and the
identity and generation rules as before.

## Canonical payload

A version 9 document is serialized as document v8 describes, with the connector key order above
(the six style keys after `to`, in the table's order) and version 8's key orders for every other
type. Version 1 to 8 documents are serialized as their own contracts describe. As before, a board
keeps the version it was read with until it is saved: serializing a board read from a version 1
to 8 payload produces that payload byte for byte.

## Reading version 1 to 8 documents

The decoder accepts version 1 to 8 documents exactly as their contracts define them, and a
version 9 document as defined above. When a version 1 to 8 board is opened for editing it is
upgraded **in memory** to version 9 by the earlier steps and then by giving every connector the
default style; its ends keep anchor `"auto"`, and no other object changes. So an older board looks
exactly as before. As before, the upgrade is not an edit: no draft revision, transaction or
history step, the board is not marked Unsaved, and opening never writes storage. The next explicit
Save writes version 9.

A new board is version 9. A new connector starts with the style interaction v23 gives it and both
anchors `"auto"`.

## Older versions of the application

An application that implements only documents v1 to v8 treats a version 9 record as an unknown
version, as document v8 says for its own successor: it shows its unsupported-data view, disables
editing and Save, draws no object from the version 9 record, and changes no record. A board saved
as version 9 can be viewed and edited only by applications that implement this version or later.

## Version references in other contracts

These rules of contracts that this version does not otherwise change now name version 9:
- [Board file v1](0006-board-file-v1.md): a file's `payload` is at its own `schemaVersion`, 1 to
  **9**; an edited board is written to a file at version **9** (an unedited one still at its own
  version, byte for byte); check 9 refuses a payload whose `schemaVersion` is a safe integer above
  **9** ("it was made by a newer version of Board"). A file holding a version 9 board opens as any
  other.
- [Storage v2](0001-storage-v2.md): a board list entry whose payload `schemaVersion` is a safe
  integer above **9** has state `newer`; a board created from a file at an earlier version becomes
  version **9** at its first save after an edit.
- [Activity catalogue v1](0008-activity-catalogue-v1.md): an activity's payload `schemaVersion`
  stays **7**, and reading an activity file still gives its version 7 document. Adding one copies
  its objects onto a version 9 board (interaction v21's copies); its connectors take the default
  style and keep anchor `"auto"`.

Nothing else in those contracts changes: storage v2's records and board file v1's envelope carry
any document version.

## Identity, transactions and the adapter

Document v1's identity and transaction rules apply. Changing a connector's style and moving one of
its ends to another idea or side are semantic changes, each committed atomically with one draft
revision. An end being dragged (while the pointer is down) is never in the document or the
adapter.

In the adapter, each live connector's map holds what document v7 gave it (the atomic **ends**
value with both ends, anchors included) and one more atomic value, **connectorStyle**, holding the
six style keys; style keys are never held one by one. Other objects hold no connector style.
Projection to JSON and re-creation of the adapter from validated JSON include the style. A
restored connector gets back its ends, anchors, label and style with its logical ID, and a fresh
generation under document v1's rule.

## Public references

Document v1's references (retrieved 2026-10-22) apply. The style keys, head and line shape names,
anchor sides and the compatibility rules above are this project's contract.
