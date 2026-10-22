# 0001 — Board document contract

Contract version: 1. Status: Accepted on 2026-10-22. Applies to 0001-W1 brief v2.
This specifies the accepted application format; no application is implemented yet.

## Boundaries

The Board-owned JSON document is authoritative for persisted content. React and
Konva project it; Yjs is an in-memory transaction adapter behind this boundary.
Do not persist canvas-node serialization, component state or a Yjs binary update
as the application document. No network provider or collaboration transport is
part of this increment.

One browser origin/profile stores one board. A new unsaved draft starts with an
empty title and no objects. A complete saved document has exactly these keys:

| Field | Required value |
| --- | --- |
| schemaVersion | Integer 1 |
| boardId | Canonical lowercase UUID v4, created once with crypto.randomUUID() |
| title | Well-formed Unicode string, 1–120 Unicode code points, containing a non-whitespace character |
| objects | Array of 0–250 objects in ascending order |
| retiredGenerations | Array of 0–10,000 unique generation UUIDs, sorted lexically |

Each object has exactly these keys:

| Field | Required value |
| --- | --- |
| id | Stable logical UUID v4 |
| generation | UUID v4 for this live incarnation |
| type | sticky or text |
| text | Well-formed Unicode plain text, 0–1,000 code points; multiline allowed |
| x, y | Finite JSON numbers in board units; minimum -1,000,000 |
| width, height | Finite JSON numbers, each 40–2,000 inclusive |
| order | Integer matching the object's zero-based array position |

The right and bottom edges must be at most 1,000,000 board units. Logical IDs,
active generations and the board ID are distinct; logical IDs and active
generations are unique across all objects. No active generation is retired.
Reject duplicate order, unknown keys/types, missing fields, invalid UUIDs,
nonfinite/out-of-range numbers, unpaired UTF-16 surrogates and unknown versions.

Count code points, not UTF-16 code units. Preserve text exactly, including line
breaks and Unicode normalization form; never trim, truncate or silently normalize
a user's title/text. Blank or oversized editor drafts remain visible with an
explanation, and block Save until valid. Checking whitespace does not trim it.

## Identity and transactions

Creation assigns new logical and generation UUIDs. Editing and moving retain both.
Renderer indices and reading-order positions are never identity keys. Commit a
semantic change atomically and advance one session-local draft revision; viewport,
selection, focus and intermediate pointer previews do not advance it.

The adapter uses one Y.Doc with a board map and an objects map keyed by logical ID.
Each live object map contains its generation, type, text (Y.Text), order and one
atomic geometry value containing x/y/width/height. Retired generations are a
separate set/map. Project validated content to the JSON format above; re-create
the adapter from validated JSON on reopen. No networking is enabled.

Later restoration must retain the logical ID, assign a fresh generation, and
preserve every retired generation. A command targeting a retired incarnation
cannot affect its replacement. 0001-W1 has no delete, duplicate or undo/redo
controls; these invariants constrain format compatibility without adding them.

## Canonical payload

Construct a new plain object in the field order shown above; construct each
object in its field-table order; sort objects by order and retired generations
lexically. Serialize with JSON.stringify, without indentation. A numeric negative
zero serializes as zero. Encode with UTF-8 and reject payloads over 2,097,152 bytes.
Storage verifies the exact payload string and its SHA-256 before adopting it.

The decoder validates the whole document before mutating live state. Unsupported
or malformed saved bytes remain unchanged. There is no automatic schema migration
or silent initialization over an existing record. Future format extensions need
a versioned compatibility/migration contract.

## Public references

Retrieved 2026-10-22: [Y.Doc transactions](https://docs.yjs.dev/api/y.doc),
[IndexedDB](https://www.w3.org/TR/IndexedDB/). Numeric bounds, identity policy and
format choices above are this project's contract, rather than vendor guarantees.
