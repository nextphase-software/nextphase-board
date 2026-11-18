# 0001 — Board document contract

CONTRACT VERSION: 0001 document v20 (2026-11-17)

Status: Draft for 0011-W1 v1. When accepted it replaces [document v19](0001-document-v19.md) for later work.
Every rule of v19 (and, through it, v18) stays word for word except as below. This version adds the
**table** object type and **schema version 14**. How a table lives in a hosted room's shared document is
[sync v15](0003-sync-v15.md)'s concern; the saved and exported document is always the shape below.

## Terms

- **Table**: an object that holds an ordered list of **columns** and of **rows**, each with a stable id and
  a size, and **cells** addressed by (row id, column id).
- **Cell**: the text at one row and column. A cell that holds no text is not stored.
- **Set height**: the height stored for a row. A row is drawn at least as tall as its tallest cell's text
  ([interaction v45](0001-interaction-v45.md)); the drawn height may therefore be larger, but only when the
  text needs more than 1,000 or another person's merged text has not yet been committed with a step.
- **Saved box** and **drawn box**: the saved `x`, `y`, `width`, `height`; and the box with the drawn row
  heights, which interaction v45 uses for every geometric purpose in the app.

## Saved document (version 14)

A version 14 document has exactly the keys, order and rules of a version 13 document (v18, v19), and may
also hold tables. A version 1 to 13 document holding a table is rejected.

A table has these keys, in this order:

| Field | Required value |
| --- | --- |
| `id` | As every object |
| `generation` | As every object |
| `type` | `"table"` |
| `page` | As every object (v18) |
| `columns` | An array of 1 to **20** entries `{id, width}`, in display order (left to right). `id` is a lowercase UUID, unique within the table; `width` an integer **64–1,000** |
| `rows` | An array of 1 to **50** entries `{id, height}`, in display order (top to bottom). `id` is a lowercase UUID, unique within the table and different from every column id; `height` (the set height) an integer **64–1,000** |
| `cells` | An array of entries `{row, column, text}`: `row` the id of one of `rows`, `column` the id of one of `columns`, `text` a non-empty string of at most **1,000** code points with no lone surrogate (`validText`). At most one entry per (row, column). Entries are in row order, then column order |
| `textSize` | One of the text size names (`small`, `medium`, `large`, `extra-large`) |
| `group` | As every object |
| `section` | As every object |
| `x`, `y` | The table's top-left corner, as every rectangle |
| `width` | Exactly the sum of the column widths |
| `height` | Exactly the sum of the rows' set heights |
| `order` | As every object |

A table has no `text`, `color`, `align`, `marks`, `fill`, `border`, `points`, `from` or `to`. Its keys
inside each column, row and cell entry are exactly those listed. `validate` checks keys, values, bounds and
references only; it does not require any key order or any order of `cells` entries. `canonical()` rebuilds
every column, row and cell entry with its keys in the order listed and sorts `cells` in row order, then
column order.

**Table rules.**
1. A table is a rectangle with `sizeRange` 64 to 50,000 in each direction (20 × 1,000 and 50 × 1,000). It
   is never a container, a connector end or a mind-map node; a connector whose `from` or `to` names a table
   is invalid. It may be a section's member exactly as a shape is (`sectionIdea`: dropped into, wrapped by
   and moved with a section, saved `section`), and is excluded from `eligibleIdea` as images are.
2. A table counts as **one** object of the 250 (v18 "Limits"). Its cells count toward the 2,097,152-byte
   canonical payload as every value does. A board holds at most **5,000 cells** (the sum of rows × columns
   over all its tables, empty cells included), which bounds a hosted room's shared document (sync v15 keeps
   one text per cell) well inside the room's backup limit.
3. Duplicating a table, copying and pasting one, and inserting one from a template or activity (the shared
   copy path) give the copy new ids for itself, every column and every row, and map its cells to the new ids;
   texts and sizes are kept. Inserting the same template twice gives two tables with different nested ids.
   Only hosted Undo of a deleted table keeps nested ids (sync v15).
4. A table's `generation` follows the existing generation rules: every change to any of its keys is a
   change of the object.

## Canonical payload

As v18, with the table's keys in the order above, its `columns` and `rows` in display order, and `cells`
in row order then column order (the order of `rows`, then of `columns`). No other sorting.

## Reading version 1 to 13 documents

`upgrade` reads a version 1 to 13 document exactly as v18 and v19 say, then sets `schemaVersion` to 14. No
other key changes. `empty` and `add` create version 14 documents. A version 14 document is not upgraded.
Opening an older board follows v18's rule word for word with 14 for 13: the upgrade happens **in memory**,
is not an edit, never writes storage, and the next explicit Save writes version 14. An unedited board's
export and its canonical bytes are those of its own version (v1–13 round trips stay byte-exact); an edited
one exports version 14. `payloadBytes` excludes `pages` and every `page` for versions 13 and 14 alike, so
the 2,097,152-byte limit is measured as v18 says.

## Older versions of the application

A board file or a saved local board whose `schemaVersion` is greater than **14** is "made by a newer
version of Board", with the existing words (board file v4, storage v3). An application built before this
version refuses a version 14 document in the same way; pre-launch, nothing more is promised.

## Version references in other contracts

Wherever another contract names schema version 13 as the current version (the room's create, import,
history, restore and backup checks; team templates; board files; local storage), read **13 or 14** on
reading; new and edited documents are **14**. Sync v15 says this for the room.

## References

Unchanged from v19. The table's look, words and keys are [interaction v45](0001-interaction-v45.md); its
shared-document shape and concurrent merge are [sync v15](0003-sync-v15.md); its modules are
[web modules v43](0001-web-modules-v43.md).
