# 0001 — Local persistence contract

Contract version: 5 (for 0012-W5 brief v1, 2026-11-25). Status: Draft. When accepted it replaces
[storage v4](0001-storage-v4.md) for later work. Depends on [document v22](0001-document-v22.md) and
[board file v6](0006-board-file-v6.md).

Every rule in v4 (and, through it, v3, v2 and v1) still applies except where this version replaces or adds to it.
The database, its one object store, its keys and every lock stay as v4 left them. This version only lets the local
store read and keep **schema 16** boards, whose `link` cards may name a thumbnail picture. It replaces:

- v4's version references:
  - **reading** keeps accepting exactly what document v22 accepts: a stored board whose `schemaVersion` is **1 to
    16**. `decode` (`apps/web/src/storage.ts`) already validates the payload with document v22's `validate`, so a
    legacy board (schema 1 and up, as `tests/storage.test.mjs` proves today) still opens, is upgraded in memory and is
    written at 16 only by the next explicit save (document v22);
  - **the board list**: an entry whose payload `schemaVersion` is a safe integer above **16** (v4: above 15) has state
    `newer`. This is the one code change in `storage.ts`: the `newer` test in `refreshList` becomes
    `b.schemaVersion > 16`;
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

## Changes from v4

- Reading still accepts schema 1–16 (document v22's range); the board list's `newer` is above 16.
- `link` card thumbnails are pictures of the board.
- A card's thumbnail is held before the card names it.

## Verification

`tests/storage.test.mjs`: the existing legacy reads (schema 1 and 2 boards) still decode; a correctly hashed
schema 16 board with a card decodes and keeps its canonical bytes; the "unknown document version" case moves from 16
to **17** (rejected, raw bytes unchanged); a board list entry whose payload is at 17 is `newer` and one at 16 with a
card is `valid`.
