# 0001 — Board document contract

Contract version: 3 (for 0001-W10 brief v1, 2026-10-24). Status: Draft. When
accepted it replaces [document v2](0001-document-v2.md) for later work. Uses
unchanged [storage v1](0001-storage-v1.md).

Every rule in document v2 (and, through it, document v1) still applies except where
this version replaces it. This version adds one key to each object, `group`, which
records which objects belong together; defines how version 1 and version 2 documents
are read; and adds the group value to the in-memory adapter.

## Saved document (version 3)

A complete version 3 document has the same top-level keys as version 2, in the same
order, with `schemaVersion` the integer **3**:

| Field | Required value |
| --- | --- |
| schemaVersion | Integer 3 |
| boardId, title, objects, retiredGenerations | As in document v1 |

Each version 3 object has exactly these keys, in this order:

| Field | Required value |
| --- | --- |
| id, generation, type, text | As in document v1 |
| color, textSize, align | As in document v2 |
| group | `null`, or a canonical lowercase UUID v4 (the object's **group ID**) |
| x, y, width, height, order | As in document v1 |

`group` is required on every object. Objects that share a group ID form one group;
`null` means the object is in no group. One object alone may hold a group ID. A group
ID is never equal to the board ID, to any object's logical ID or active generation,
or to any retired generation. Groups are one level: a group holds objects, never
other groups, and nothing else in the document refers to a group ID. Any other
value, a missing key or an extra key is rejected, as are unknown schema versions.
Every other rule of document v1 and v2 (limits, identities, generations, Unicode,
bounds, the 2,097,152-byte payload limit) applies unchanged.

## Canonical payload

A version 3 document is serialized exactly as document v1 describes, with the
version 3 field orders above; `null` serializes as `null`. A version 2 document is
serialized exactly as document v2 describes, and a version 1 document exactly as
document v1 describes. **A board keeps the version it was read with:** serializing a
board read from a version 1 or version 2 payload produces that payload byte for byte,
which keeps storage v1's exact round-trip check valid for older records.

## Reading version 1 and version 2 documents

The decoder accepts a version 1 document exactly as document v1 defines it, a
version 2 document as document v2 defines it, and a version 3 document as defined
above. Nothing else is accepted, and the decoder still validates the whole document
before any live state changes.

When a version 1 or version 2 board is opened for editing, it is upgraded **in
memory** to version 3: a version 1 board first gets document v2's style defaults,
and every object of either then gets `group` set to `null`. This reproduces exactly
how the board looked and behaved. As in document v2, the upgrade is not an edit: it
advances no draft revision, creates no transaction or history step and does not mark
the board Unsaved, and opening never writes storage. The next explicit Save writes a
version 3 document; storage v1 then keeps the earlier record as its previous record,
and both records validate. A version 1 or 2 board shown read-only, for example as a
recovery snapshot, is shown the same way and never rewritten.

A new board is version 3. An object created by placing it or by adding it starts
with `group` set to `null`; a copy made by Duplicate gets the group ID the interaction
contract specifies for it.

## Older versions of the application

An application that implements only document v1 and v2 treats a version 3 record as
an unknown version. Under storage v1 it opens read-only, blocks writes, and may offer
a valid earlier previous record as a read-only snapshot. No record is changed. A
board saved as version 3 can therefore be edited only by applications that implement
this version or later.

## Identity, transactions and the adapter

Document v1's identity and transaction rules apply. Changing objects' groups is a
semantic change committed atomically that advances one draft revision. Every new
identifier the application creates — a logical ID, a generation or a group ID — is a
fresh UUID v4 that differs from the board ID, every logical ID, active generation,
retired generation and group ID in the board at that moment, and from every
identifier already created earlier in the same command.

In the adapter, each live object map also holds one atomic **group** value, the
group ID or `null`, alongside its generation, type, text, order, style and geometry.
Projection to JSON and re-creation of the adapter from validated JSON include it. A
restored object keeps its logical ID, gets a fresh generation as in document v1, and
gets back its group ID with its other content.

## Public references

Document v1's references (retrieved 2026-10-22) apply. The group key, its rules and
the compatibility rules above are this project's contract.
