# 0001 — Board document contract

Contract version: 5 (for 0002-W1 brief v1, 2026-10-26). Status: Draft. When
accepted it replaces [document v4](0001-document-v4.md) for later work. Uses
unchanged [storage v1](0001-storage-v1.md).

Every rule in document v4 (and, through it, document v3, v2 and v1) still applies except
where this version replaces it. This version adds a new object type, **section**: a named
area that holds ideas. It adds one key to each object, `section`, which records the section
an object belongs to; makes the size and text limits a rule of each type; defines how
version 1 to 4 documents are read; and adds the section value to the in-memory adapter.

## Terms

A **section** is an object whose `type` is `"section"`. An **idea** is an object of any
other type (today `"sticky"` and `"text"`). An idea is a **member** of a section when its
`section` key holds that section's logical ID. Membership is stored, one level only: a
section is never a member of anything.

## Saved document (version 5)

A complete version 5 document has the same top-level keys as version 4, in the same
order, with `schemaVersion` the integer **5**:

| Field | Required value |
| --- | --- |
| schemaVersion | Integer 5 |
| boardId, title, objects, retiredGenerations | As in document v1 |

Each version 5 object has exactly these keys, in this order:

| Field | Required value |
| --- | --- |
| id, generation | As in document v1 |
| type | `"sticky"`, `"text"` or `"section"`, subject to the version rule below |
| text | As in document v1, with the type's text limit below |
| color, textSize, align | As in document v2, with the section rule below |
| group | As in document v3, with the section rule below |
| marks | As in document v4, with the section rule below |
| section | `null`, or the logical ID of a section in the same document |
| x, y | As in document v1 |
| width, height | Finite numbers within the type's size range below; `x + width` and `y + height` at most 1,000,000, as in document v1 |
| order | As in document v1 |

The keys keep document v4's order, with `section` added after `marks`.

## Limits by type

Each type sets its own limits. Every other limit of document v1 to v4 is unchanged.

| Type | Valid from version | Text | Width and height, each |
| --- | --- | --- | --- |
| sticky | 1 | Up to 1,000 code points | 40 to 2,000 |
| text | 1 | Up to 1,000 code points | 40 to 2,000 |
| section | 5 | Its **name**: up to 100 code points, plain text | 200 to 10,000 |

**Version rule.** A type is valid only in documents of its version or later. A version 1,
2, 3 or 4 document that contains a `"section"` object is rejected.

A section's name follows document v1's text rules (Unicode, code-point counting) with the
100-code-point limit. It may be empty, may contain line breaks, and may repeat another
section's name.

Sections count toward the 250-object limit like any object.

## Section rules

A version 5 document is rejected unless all of the following hold:

1. **Sections hold no style of their own beyond colour.** A section's `marks` is `[]`, its
   `textSize` is `"medium"` and its `align` is `"left"`. Its `color` is any colour document
   v2 allows.
2. **Sections are not grouped.** A section's `group` is `null`.
3. **No nesting.** A section's `section` is `null`.
4. **No dangling links.** Every non-null `section` value is the `id` of an object of type
   `"section"` in the same document. An idea can never point to another idea, to itself,
   or to an ID that is absent.

A section's members may come before or after it in the array. The array is not required
to keep sections before ideas: a valid document may interleave them (interaction v17
says how they are drawn and when the order is normalized).

Any other value, a missing key or an extra key is rejected, as are unknown schema
versions.

## Membership is never inferred

Opening, validating, upgrading or serializing a document never computes membership from
positions. An idea whose rectangle lies inside a section but whose `section` is `null` is
not a member, and a member whose rectangle lies outside its section is still a member.
Only the commands in interaction v17 change membership.

## Canonical payload

A version 5 document is serialized exactly as document v1 describes, with the version 5
field orders above. A section is serialized with `marks` `[]`, `textSize` `"medium"`,
`align` `"left"`, `group` `null` and `section` `null`. Version 1 to 4 documents are
serialized as their own contracts describe. **A board keeps the version it was read
with:** serializing a board read from a version 1, 2, 3 or 4 payload produces that payload
byte for byte, which keeps storage v1's exact round-trip check valid for older records.

## Reading version 1 to 4 documents

The decoder accepts version 1 to 4 documents exactly as their contracts define them, and
a version 5 document as defined above. Nothing else is accepted, and the decoder still
validates the whole document before any live state changes.

When a version 1, 2, 3 or 4 board is opened for editing, it is upgraded **in memory** to
version 5: the earlier upgrade steps apply as before (style defaults for version 1,
`group` `null` for versions 1 and 2, `marks` `[]` for versions 1 to 3), a version 3 or 4
board keeps its groups, a version 4 board keeps its marks, and every object then gets
`section` set to `null`. The board looks and behaves exactly as before. As in document v3
and v4, the upgrade is not an edit: it advances no draft revision, creates no transaction
or history step and does not mark the board Unsaved, and opening never writes storage.
The next explicit Save writes a version 5 document; storage v1 then keeps the earlier
record as its previous record, and both records validate. An older board shown
read-only, for example as a recovery snapshot, is shown the same way and never
rewritten.

A new board is version 5. An object created by placing or adding it starts with
`section` set to `null` unless interaction v17 says it joins a section when it is
created. Copies made by Duplicate or Paste get the membership interaction v17 gives them.

## Older versions of the application

An application that implements only document v1 to v4 treats a version 5 record as an
unknown version. Under storage v1 it opens read-only, blocks writes, and may offer a
valid earlier previous record as a read-only snapshot. No record is changed. A board
saved as version 5 can therefore be edited only by applications that implement this
version or later.

## Identity, transactions and the adapter

Document v1's identity and transaction rules apply. Every change of membership is a
semantic change committed atomically that advances one draft revision. When one command
changes positions and membership together (a drop, interaction v17), or removes a section
and clears its members' links (Delete), both are one change.

In the adapter, each live object map also holds one atomic **section** value (`null` or
the section's logical ID), alongside its generation, type, text, order, style, group,
marks and geometry. Projection to JSON and re-creation of the adapter from validated JSON
include it. A restored object gets back its membership with its other content, and a
restored section keeps its logical ID, so links to it are valid again; it gets a fresh
generation under document v1's rule.

## Public references

Document v1's references (retrieved 2026-10-22) apply. The section type, the section key,
the per-type limits and the compatibility rules above are this project's contract.
