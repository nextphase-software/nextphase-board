# 0001 — Board document contract

Contract version: 16 (for 0009-W2 brief v1, 2026-11-14). Status: Draft. When accepted it replaces
[document v15](0001-document-v15.md) for later work.

Every rule in document v15 (and, through it, documents v14 back to v1) still applies except where
this version replaces it. This version adds the **mind node** type, schema version **11**: a node of
a mind map, saved with the identity of its parent, its side, its order among its siblings and whether
its branch is collapsed. Branch lines between nodes are never saved: they are drawn from the parent
references ([interaction v40](0001-interaction-v40.md)). This version also defines how version 1 to
10 documents are read and which other contracts now read "11" where they read "10".

## Terms

A **mind node** is an object with `type` `"mindNode"`. A **root** is a mind node whose `parent` is
null. A node's **children** are the mind nodes whose `parent` is its id; its **descendants** are its
children, their children and so on. A **map** is a root and all its descendants. A **first-level
node** is a child of a root.

A mind node is **not** an eligible idea in document v7's sense: a connector end may never name a mind
node. Eligible ideas stay stickies, text objects and shapes. A mind node is never a member of a group
or a section.

## Saved document (version 11)

A complete version 11 document has the same top-level keys as version 10, in the same order, with
`schemaVersion` the integer **11**. Every type other than the mind node has exactly its version 10
keys. A mind node has these keys, in this order:

| Field | Required value |
| --- | --- |
| id, generation, type | As in document v10, with `type` also allowing `"mindNode"` |
| text | Well-formed Unicode plain text, **0–200** code points, with no line break (no U+000A, U+000D, U+2028 or U+2029) |
| color | One of the colour names a text object's `color` allows |
| textSize | Exactly `"medium"` |
| align | Exactly `"left"` |
| group | Exactly `null` |
| marks | Exactly `[]` |
| section | Exactly `null` |
| parent | `null`, or the id of another mind node in the same document |
| side | `"left"` or `"right"` when the node is a first-level node; otherwise exactly `null` |
| rank | A safe integer, 0 to 9,999 inclusive |
| collapsed | `true` or `false`; always `false` on a root |
| x, y, width, height | As a text object's in document v10 (finite numbers; width and height each 1 to 20,000; `x + width` and `y + height` at most 1,000,000) |
| order | As in document v10 |

`parent`, `side`, `rank` and `collapsed` on any other type are rejected, as is a mind node missing any
of its keys, carrying any other key, or appearing in a version 1 to 10 document.

**Structure.** A document is rejected when any mind node's `parent` names itself, an id that is not
in the document, or an object that is not a mind node; or when following `parent` from any mind node
does not reach a root (a loop). Two siblings may share a `rank`: siblings are ordered by `rank`, then
by `id` in code-unit order.

The document does not tie a node's `x`, `y`, `width` and `height` to its text: interaction v40 lays
every map out and writes them, so a reopened map is drawn exactly where it was saved.

## Limits by type

Mind nodes count toward the 250-object limit, the 2,097,152-byte payload limit and the identity and
generation rules like any object. There is no separate limit on nodes per map or on depth.

## Canonical payload

A version 11 document is serialized as document v10 describes, with the mind-node key order above and
version 10's key orders for every other type. Version 1 to 10 documents are serialized as their own
contracts describe; a board keeps the version it was read with until it is saved.

## Reading version 1 to 10 documents

The decoder accepts version 1 to 10 documents exactly as their contracts define them, and a version
11 document as defined above. When a version 1 to 10 board is opened for editing it is upgraded **in
memory** to version 11 by the earlier steps (a version 10 board needs none: no object changes). The
upgrade is not an edit: no draft revision, transaction or history step, the board is not marked
Unsaved, and opening never writes storage. The next explicit Save writes version 11. A new board,
local or hosted, is version 11.

## Older versions of the application

An application that implements only documents v1 to v10 treats a version 11 record as an unknown
version, as document v10 says for its own successor: it shows its unsupported-data view, disables
editing and Save, draws no object from the version 11 record, and changes no board record (its board
list may record the board as `newer`). A board saved as version 11 can be viewed and edited only by
applications that implement this version or later, whether or not it holds a mind node.

## Version references in other contracts

Each contract below keeps every rule except its document version, which now reads **11** where it
read 10:

- [storage v3](0001-storage-v3.md) and [board file v4](0006-board-file-v4.md): a document version
  above **11** is newer; files and records of version 1 to 11 are read.
- [hosted persistence v10](0003-hosted-persistence-v10.md), [hosted storage v11](0003-hosted-storage-v11.md),
  [sync v13](0003-sync-v13.md), [board lifecycle v5](0006-board-lifecycle-v5.md) and
  [API v12](0003-api-v12.md): a room's live board, every accepted edit, history snapshot, restore,
  import and new hosted board are document version **11**. A room that loads a stored version 10
  board upgrades it to 11 before serving it or checking any edit (no object change). The upgrade is
  not a person's edit: it adds no edits row, person or request id, and no history version is
  captured for the upgrade alone; a reload with no edit in between serves version 11 again, and the
  room's next accepted edit is stored as version 11 like any edit. Stored version 10
  history snapshots and backups stay readable (the room's history checks accept versions 10 and
  11) and are restored as version 11. The room's repair step runs on **every** incoming edit
  before validation, as today (it already removes connectors whose ends are gone); it also repairs
  mind nodes, whether the break came from a concurrent merge or from one edit, in this order: a node whose `parent` is missing or
  is not a mind node becomes a root; while a loop remains, the node with the smallest `id` in it
  becomes a root; every root gets `side` null and `collapsed` false; a first-level node without a
  side gets `"right"`; any other non-root node gets `side` null. The repair never moves a node
  (the map's next change lays it out). An edit that is still invalid after the repair is refused
  as those contracts already refuse invalid edits.
- [team templates v1](0008-team-templates-v1.md): stored objects are validated as objects of a
  wrapped version **11** document; a template may hold mind nodes.
- [activity catalogue v1](0008-activity-catalogue-v1.md): an activity's payload `schemaVersion`
  stays **7**; adding one copies its objects onto a version 11 board. Activities hold no mind nodes.

## Identity, transactions and the adapter

Document v1's identity and transaction rules apply. Adding nodes (one or several at once), editing a
node's text, moving, reparenting, detaching, collapsing, expanding and deleting are semantic changes.
Each is committed atomically **together with the layout of every map it changes** (interaction v40),
as one transaction with one draft revision.

In the adapter, each live mind node's map holds generation, type, group, section and order, the
atomic **geometry** value (`x`, `y`, `width`, `height`), its text as a text object holds it, its
style values (`color`, `textSize`, `align`) and marks as a text object holds them, and the values
`parent`, `side`, `rank` and `collapsed`, each held whole as a plain value. Other objects hold none of
the four mind-node values. Projection to JSON and re-creation of the adapter from validated JSON
include them. A restored mind node gets back its text, colour, parent, side, rank, collapse state and
position with its logical ID, and a fresh generation under document v1's rule.

## Public references

Document v1's references (retrieved 2026-10-22) apply. The mind-node keys, the structure rule and the
compatibility rules above are this project's contract.
