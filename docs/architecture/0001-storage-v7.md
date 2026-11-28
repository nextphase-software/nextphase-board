# 0001 — Local persistence contract

Contract version: 7 (for 0011-W3 brief v1, 2026-11-27). Status: Draft. When accepted it replaces
[storage v6](0001-storage-v6.md) for later work. Depends on [document v24](0001-document-v24.md) and
[board file v8](0006-board-file-v8.md).

v6's text is kept here in full, with its version numbers moved on only where this version requires it. **Changes from
v6, in short:** the local store reads and keeps **schema 18** boards, whose tables hold `merges`, the list of their
merged cells (document v24). Merges are part of the stored document; they are not pictures, add no record, key or
budget, and are checked by `decode` through document v24's `validate` (its merge rules included). Reading accepts
schema **1 to 18**; a stored board at 14 to 17 is upgraded in memory (each table gains `merges: []`) and written at 18
only by the next explicit save. The board list's `newer` state moves from above 17 to above 18, so the one code change
in `storage.ts` is the `newer` test in `refreshList`, which becomes `b.schemaVersion > 18`. Removing unused pictures
never looks at merges.

**v6's changes from v5:** the local store reads and keeps **schema 17** boards, whose rich-text objects' marks may hold a
`link` (document v23). A link is part of the stored document; it is not a picture, adds no record, key or budget, and
is checked by `decode` through document v23's `validate` (its link address rule included). Reading accepts schema
**1 to 17**; the board list's `newer` state moves from above 16 to above 17, so the one code change in `storage.ts`
is the `newer` test in `refreshList`, which becomes `b.schemaVersion > 17`. Removing unused pictures never looks at
links.

v5's own text follows.

Every rule in v4 (and, through it, v3, v2 and v1) still applies except where this version replaces or adds to it.
The database, its one object store, its keys and every lock stay as v4 left them. v5 only lets the local
store read and keep **schema 16** boards, whose `link` cards may name a thumbnail picture. It replaces:

- v4's version references:
  - **reading** keeps accepting exactly what document v24 accepts: a stored board whose `schemaVersion` is **1 to
    18** (v6: 1 to 17; v5: 1 to 16). `decode` (`apps/web/src/storage.ts`) already validates the payload with document v24's `validate`, so a
    legacy board (schema 1 and up, as `tests/storage.test.mjs` proves today) still opens, is upgraded in memory and is
    written at 18 only by the next explicit save (document v24);
  - **the board list**: an entry whose payload `schemaVersion` is a safe integer above **18** (v6: above 17; v5: above 16; v4: above 15) has state
    `newer`. This is the one code change in `storage.ts`: the `newer` test in `refreshList` becomes
    `b.schemaVersion > 18`;
- v4's **the board's pictures**: they also include each `link` card's non-null `asset` (document v22's
  `assetsOf`). A card's thumbnail is an ordinary **picture record**, counted in the board's picture budget, written
  with the board and removed by **Removing unused pictures** when no object names it any more, exactly as an image's
  picture is;
- v4's **Writing pictures**: a card's thumbnail is written as a picture record **before** the edit that sets the
  card's `asset` is saved, so a stored board never names a thumbnail the store does not hold. The budget is counted
  when the thumbnail is stored and again when the card is finished (interaction v52); a thumbnail stored but then
  not named (the second count was over, or the card was gone) is removed by the next save's clean-up.

Nothing else changes: no new record kind, no new key, no new budget. A thumbnail is at most 640 pixels on its
longer side (interaction v52), so it fits every existing picture limit.

## Changes from v6

- Reading accepts schema 1–18 (document v24's range); the board list's `newer` is above 18.
- Tables' merges are stored with the document, and checked when it is decoded.

## Changes from v5 (v6)

- Reading accepted schema 1–17 (document v23's range); the board list's `newer` was above 17.
- Marks with links are stored with the document, and checked when it is decoded.

## Changes from v4 (v5)

- Reading accepted schema 1–16 (document v22's range); the board list's `newer` was above 16.
- `link` card thumbnails are pictures of the board.
- A card's thumbnail is held before the card names it.

## Verification

`tests/storage.test.mjs`: the existing legacy reads (schema 1 and 2 boards) still decode; a correctly hashed
schema 16 board with a card decodes and keeps its canonical bytes; the "unknown document version" case moves from 18
to **19** (v6: from 17 to 18; v5: from 16 to 17; rejected, raw bytes unchanged); a board list entry whose payload is at 19 is `newer` and
one at 16 with a card is `valid`. Version 6 adds: a correctly hashed schema 17 board whose sticky, shape and text
object hold linked marks decodes and keeps its canonical bytes; a board list entry at 17 is `valid`; a stored board
at 17 whose link the link address rule refuses, or at 16 holding a link, does not decode (raw bytes unchanged). Version 7 adds: a
correctly hashed schema 18 board whose tables hold merges (and one with `merges: []`) decodes and keeps its canonical
bytes; a board list entry at 18 is `valid`; a stored board at 17 with a table decodes, is upgraded in memory with
`merges: []` and keeps its stored bytes until an explicit save writes it at 18; a stored board at 18 with overlapping
merges or text in a covered cell, at 18 with a table without `merges`, or at 17 with a table holding `merges`, does not
decode (raw bytes unchanged).
