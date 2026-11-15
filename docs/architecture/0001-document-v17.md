# 0001 — Board document contract

Contract version: 17 (for 0009-W3 brief v1, 2026-11-14). Status: Draft. When accepted it replaces
[document v16](0001-document-v16.md) for later work.

Every rule in document v16 (and, through it, documents v15 back to v1) still applies except where
this version replaces it. This version, schema version **12**, adds:

- the **tape** type: a straight strip of patterned tape between two end points, saved with its
  pattern, its rectangle and its two points;
- **twelve shape kinds**, so a shape's `shape` value may name any of fourteen kinds.

It also defines how version 1 to 11 documents are read and which other contracts now read "12" where
they read "11". Tidy up ([interaction v41](0001-interaction-v41.md)) adds nothing to the saved
document: it changes objects' positions only.

## Terms

A **tape** is an object with `type` `"tape"`. Its **band** is 28 board units across: its
**centreline** is the straight segment between its two points, and its **pad** is **14**, half the
band. Its **length** is the centreline's length.

A tape is not an eligible idea in document v7's sense: a connector end may never name a tape. It may
be a member of a group and of a section, like a stroke (document v8).

## Saved document (version 12)

A complete version 12 document has the same top-level keys as version 11, in the same order, with
`schemaVersion` the integer **12**. Every type other than the tape has exactly its version 11 keys,
and a shape's `shape` value may also be any of the twelve kinds below. A tape has these keys, in this
order:

| Field | Required value |
| --- | --- |
| id, generation, type | As in document v11, with `type` also allowing `"tape"` |
| pattern | One of `"stripes"`, `"dots"`, `"grid"`, `"zigzag"`, `"checks"`, `"kraft"` |
| group, section | As in document v11 |
| x, y | As in document v11 (finite numbers; a moved or pasted tape may sit at a fractional position) |
| width, height | Safe integers in board units; the tape rules below; the board's edges as in document v1 |
| points | An array of exactly **2** points, each as document v8 defines a point (`[px, py]`, two safe integers relative to `x` and `y`) |
| order | As in document v11 |

A tape has no `text`, `textSize`, `align`, `marks`, `color`, `kind` or `weight`: those keys on a tape
are rejected, as is `pattern` on any other type, and a tape missing any of its keys. The `points` key
on a type other than a stroke or a tape is rejected. A tape in a version 1 to 11 document is rejected.

**Tape rules.** A version 12 document is rejected unless, for every tape:
1. every point has `0 ≤ px ≤ width` and `0 ≤ py ≤ height`;
2. the smallest `px` and the smallest `py` each equal the pad (14);
3. the largest `px` plus the pad equals `width`, and the largest `py` plus the pad equals `height`;
4. its length is at least **16** and at most **2,000** board units.

So a tape's rectangle is its centreline's bounds grown by 14 on every side, which holds the whole
band at any angle. Validation checks the whole board before it is adopted; it never repairs or drops
a tape.

**Shape kinds.** In a version 12 document a shape's `shape` value is one of, in this order:
`"square"`, `"circle"`, `"rounded-rectangle"`, `"diamond"`, `"triangle"`, `"inverted-triangle"`,
`"pentagon"`, `"octagon"`, `"star"`, `"cross"`, `"arrow-left"`, `"arrow-right"`, `"chevron"`,
`"speech-bubble"`. In a version 1 to 11 document only `"square"` and `"circle"` are accepted, as
before. A shape's other keys, values and limits are unchanged for every kind.

## Limits by type

Tapes count toward the 250-object limit, the 2,097,152-byte payload limit and the identity and
generation rules like any object.

## Canonical payload

A version 12 document is serialized as document v11 describes, with the tape key order above and
version 11's key orders for every other type; a tape's points are written in their saved order (start,
then end). Version 1 to 11 documents are serialized as their own contracts describe; a board keeps the
version it was read with until it is saved.

## Reading version 1 to 11 documents

The decoder accepts version 1 to 11 documents exactly as their contracts define them, and a version
12 document as defined above. When a version 1 to 11 board is opened for editing it is upgraded **in
memory** to version 12 by the earlier steps (a version 11 board needs none: no object changes). The
upgrade is not an edit: no draft revision, transaction or history step, the board is not marked
Unsaved, and opening never writes storage. The next explicit Save writes version 12. A new board,
local or hosted, is version 12.

## Older versions of the application

An application that implements only documents v1 to v11 treats a version 12 record as an unknown
version, as document v11 says for its own successor: it shows its unsupported-data view, disables
editing and Save, draws no object from the version 12 record, and changes no board record (its board
list may record the board as `newer`). A board saved as version 12 can be viewed and edited only by
applications that implement this version or later, whether or not it holds a tape or a new shape
kind.

## Version references in other contracts

Each contract below keeps every rule except its document version, which now reads **12** where
document v16 made it read 11:

- [storage v3](0001-storage-v3.md) and [board file v4](0006-board-file-v4.md): a document version
  above **12** is newer; files and records of version 1 to 12 are read.
- [hosted persistence v10](0003-hosted-persistence-v10.md), [hosted storage v11](0003-hosted-storage-v11.md),
  [sync v13](0003-sync-v13.md), [board lifecycle v5](0006-board-lifecycle-v5.md) and
  [API v12](0003-api-v12.md): a room's live board, every accepted edit, history snapshot, restore,
  import and new hosted board are document version **12**. A room that loads a stored version 10 or 11
  board upgrades it to 12 before serving it or checking any edit (no object change), under the same
  rules document v16 set for the version 10 upgrade: not a person's edit, no edits row, person or
  request id, no history version captured for the upgrade alone, and a reload with no edit in between
  serves version 12 again. Stored version 10 and 11 history snapshots and backups stay readable (the
  room's history checks accept versions 10, 11 and 12) and are restored as version 12. The room's
  repair step is unchanged (it never touches tapes or shape kinds).
- [team templates v1](0008-team-templates-v1.md): stored objects are validated as objects of a
  wrapped version **12** document; a template may hold tapes and any shape kind.
- [activity catalogue v1](0008-activity-catalogue-v1.md): an activity's payload `schemaVersion`
  stays **7**; adding one copies its objects onto a version 12 board. Activities hold no tapes and
  only squares and circles.

## Identity, transactions and the adapter

Document v1's identity and transaction rules apply. Placing a tape, changing its pattern, moving it,
moving one of its ends, and deleting it are semantic changes, each committed atomically as one
transaction with one draft revision. Changing a shape's kind is a semantic change as before.

In the adapter, each live tape's map holds generation, type, pattern, group, section and order, the
atomic **geometry** value (`x`, `y`, `width`, `height`) and one atomic **points** value holding the
whole points array, as a stroke's map holds them (document v8); points are never held one by one.
Tapes hold no text, style, marks, kind, colour or weight values; other objects hold no `pattern`
value. Projection to JSON and re-creation of the adapter from validated JSON include the pattern and
points. A restored tape gets back its pattern, points and position with its logical ID, and a fresh
generation under document v1's rule. A shape's kind is held as today, whatever its value.

## Public references

Document v1's references (retrieved 2026-10-22) apply. The tape keys, the tape rules, the shape kind
list and the compatibility rules above are this project's contract.
