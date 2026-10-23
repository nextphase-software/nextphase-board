# 0001 — Board document contract

Contract version: 2 (for 0001-W5 brief v1, 2026-10-23). Status: Draft. When
accepted it replaces [document v1](0001-document-v1.md) for later work. Uses
unchanged [storage v1](0001-storage-v1.md).

Every rule in document v1 still applies except where this version replaces it.
This version adds three style keys to each object, defines how a version 1
document is read, and adds the style value to the in-memory adapter.

## Saved document (version 2)

A complete version 2 document has the same top-level keys as version 1, in the
same order, with `schemaVersion` the integer **2**:

| Field | Required value |
| --- | --- |
| schemaVersion | Integer 2 |
| boardId, title, objects, retiredGenerations | As in document v1 |

Each version 2 object has exactly these keys, in this order:

| Field | Required value |
| --- | --- |
| id, generation, type, text | As in document v1 |
| color | One of `rose`, `yellow`, `orange`, `green`, `teal`, `blue`, `violet`, `neutral` |
| textSize | One of `small`, `medium`, `large`, `extra-large` |
| align | One of `left`, `center`, `right` |
| x, y, width, height, order | As in document v1 |

All three style keys are required on every object of either type. Any other value,
a missing key or an extra key is rejected, as are unknown schema versions. The
document stores these names, never colour values or point sizes; their meaning on
screen is defined by the interaction contract. Every other v1 rule (limits,
identities, generations, Unicode, bounds, the 2,097,152-byte payload limit) applies
unchanged.

## Canonical payload

A version 2 document is serialized exactly as document v1 describes, with the
version 2 field orders above. A version 1 document is serialized exactly as
document v1 describes, with no style keys. **A board keeps the version it was read
with:** serializing a board read from a version 1 payload produces that version 1
payload byte for byte. This keeps storage v1's exact round-trip check valid for
version 1 records.

## Reading a version 1 document

The decoder accepts a version 1 document exactly as document v1 defines it, and a
version 2 document as defined above. Nothing else is accepted, and the decoder still
validates the whole document before any live state changes.

When a version 1 board is opened for editing, it is upgraded **in memory** to
version 2 by giving every object these explicit defaults:

| Object type | color | textSize | align |
| --- | --- | --- | --- |
| sticky | `rose` | `medium` | `left` |
| text | `neutral` | `medium` | `left` |

These defaults reproduce exactly how version 1 objects are drawn. This is the
versioned compatibility rule that document v1 requires for format extensions: no
stored record is migrated or rewritten without an explicit Save. The upgrade is
not an edit: it advances no draft revision, creates no transaction or history step
and does not mark the board Unsaved. Opening never writes storage, as storage v1
requires. The next explicit Save writes a version 2 document. Storage v1 then keeps
the earlier version 1 record as its previous record, and both records validate.

A version 1 board shown read-only, for example as a recovery snapshot, is shown
with the same defaults and is never rewritten.

## Older versions of the application

An application that implements only document v1 treats a version 2 record as an
unknown version. Under storage v1 it opens read-only, blocks writes, and may offer
a valid version 1 previous record as a read-only snapshot. No record is changed.
A board saved as version 2 can therefore be edited only by applications that
implement this version or later.

## Identity, transactions and the adapter

Document v1's identity and transaction rules apply. Changing an object's style is a
semantic change committed atomically that advances one draft revision. A change
that also changes the object's height (a larger text size, see the interaction
contract) is one transaction for both.

In the adapter, each live object map also holds one atomic **style** value
containing `color`, `textSize` and `align`, alongside its generation, type, text,
order and geometry. Projection to JSON and re-creation of the adapter from validated
JSON include it. A restored object keeps its logical ID, gets a fresh generation as
in document v1, and gets back its style with its other content.

## Public references

Document v1's references (retrieved 2026-10-22) apply. The style names, defaults
and compatibility rules above are this project's contract.
