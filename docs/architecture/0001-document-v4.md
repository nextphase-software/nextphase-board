# 0001 — Board document contract

Contract version: 4 (for 0001-W6 brief v1, 2026-10-25). Status: Draft. When
accepted it replaces [document v3](0001-document-v3.md) for later work. Uses
unchanged [storage v1](0001-storage-v1.md).

Every rule in document v3 (and, through it, document v2 and v1) still applies except
where this version replaces it. This version adds one key to each object, `marks`,
which records inline formatting (bold, italic and strikethrough) over parts of the
object's text; defines how version 1, 2 and 3 documents are read; and adds the marks
value to the in-memory adapter. The object's `text` is unchanged: it still holds every
character, so the plain text never depends on the formatting.

## Saved document (version 4)

A complete version 4 document has the same top-level keys as version 3, in the same
order, with `schemaVersion` the integer **4**:

| Field | Required value |
| --- | --- |
| schemaVersion | Integer 4 |
| boardId, title, objects, retiredGenerations | As in document v1 |

Each version 4 object has exactly these keys, in this order:

| Field | Required value |
| --- | --- |
| id, generation, type, text | As in document v1 |
| color, textSize, align | As in document v2 |
| group | As in document v3 |
| marks | An array of at most 1,000 **marks**, as below; `[]` when the text has no formatting |
| x, y, width, height, order | As in document v1 |

A **mark** is an object with exactly these keys, in this order, with the optional
flags present only when true:

| Field | Required value |
| --- | --- |
| start | Integer, at least 0 |
| end | Integer, greater than `start` and at most the text's length |
| bold | Optional; when present, `true` |
| italic | Optional; when present, `true` |
| strike | Optional; when present, `true` |

`start` and `end` count Unicode code points of `text`, as document v1 counts text, and
a mark covers the code points from `start` up to but not including `end`. Each mark
has at least one flag. The array is **normalized**, so each formatting has exactly one
saved form:
- marks are sorted by `start` and do not overlap (each `start` is at least the
  previous `end`);
- two marks that touch (one's `end` equals the next one's `start`) never have the same
  flags; they would be one mark.

Any other value, a missing key, an extra key, a `false` flag, an empty or out-of-range
mark, or an unnormalized array is rejected, as are unknown schema versions. Every
other rule of document v1, v2 and v3 (limits, identities, generations, groups,
Unicode, bounds, the 2,097,152-byte payload limit) applies unchanged; the 1,000-code-
point limit still applies to `text`, and formatting never changes it.

## Canonical payload

A version 4 document is serialized exactly as document v1 describes, with the version 4
field orders above and each mark's keys in the order above. Version 1, 2 and 3
documents are serialized as their own contracts describe. **A board keeps the version
it was read with:** serializing a board read from a version 1, 2 or 3 payload produces
that payload byte for byte, which keeps storage v1's exact round-trip check valid for
older records.

## Reading version 1, 2 and 3 documents

The decoder accepts version 1, 2 and 3 documents exactly as their contracts define
them and a version 4 document as defined above. Nothing else is accepted, and the
decoder still validates the whole document before any live state changes.

When a version 1, 2 or 3 board is opened for editing, it is upgraded **in memory** to
version 4: a version 1 board first gets document v2's style defaults, a version 1 or 2
board gets `group` set to `null` as in document v3, and every object then gets `marks`
set to `[]`. This reproduces exactly how the board looked and behaved. As in document
v3, the upgrade is not an edit: it advances no draft revision, creates no transaction
or history step and does not mark the board Unsaved, and opening never writes storage.
The next explicit Save writes a version 4 document; storage v1 then keeps the earlier
record as its previous record, and both records validate. An older board shown
read-only, for example as a recovery snapshot, is shown the same way and never
rewritten.

A new board is version 4. An object created by placing it or by adding it starts with
`marks` set to `[]`; a copy made by Duplicate or Paste keeps its source's marks.

**Plain-text read path.** `text` always holds the object's complete text. Counting,
the system clipboard (interaction v14) and any reader that does not apply formatting
use `text` alone and lose no character.

## Older versions of the application

An application that implements only document v1 to v3 treats a version 4 record as an
unknown version. Under storage v1 it opens read-only, blocks writes, and may offer a
valid earlier previous record as a read-only snapshot. No record is changed. A board
saved as version 4 can therefore be edited only by applications that implement this
version or later.

## Identity, transactions and the adapter

Document v1's identity and transaction rules apply. Changing an object's marks is a
semantic change committed atomically that advances one draft revision. A text change
and the marks that follow it (interaction v15) are one change.

In the adapter, each live object map also holds one atomic **marks** value, the
normalized array, alongside its generation, type, text, order, style, group and
geometry. Projection to JSON and re-creation of the adapter from validated JSON include
it. A restored object gets back its marks with its other content.

## Public references

Document v1's references (retrieved 2026-10-22) apply. The marks key, its rules and the
compatibility rules above are this project's contract.
