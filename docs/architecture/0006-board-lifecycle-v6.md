# 0006 — Board lifecycle contract

CONTRACT VERSION: 0006 board lifecycle v6 (2026-11-22)

Status: Draft for 0012-W3 v1. Replaces [lifecycle v5](0006-board-lifecycle-v5.md), whose owner-only
transitions, 30-day retention, denial, fences, permanent register, journals, timer, voting and spotlight
rules remain word for word except as below. [Hosted storage v13](0003-hosted-storage-v13.md) keeps a board's
pictures inside the board's own room storage.

- **Trash and restore from Trash** fence the room as today and keep its pictures untouched. While a board is
  in Trash its picture routes answer 404 `not_found` through the existing lifecycle gate; after restore they
  serve the same pictures.
- **Purge, delete and discard** erase the board's room storage exactly as today (the Durable Object's
  `deleteAll()` on Cloudflare, the board's SQLite file and its `-wal` and `-shm` files on Node). The pictures
  go with it: there is no second store to clean. The existing check that no room table remains covers the two
  new tables.
- The lifecycle fence's history prune does **not** run the picture clean-up
  ([hosted persistence v11](0003-hosted-persistence-v11.md)): Trash keeps every picture the room holds.
- **Board import** (`POST /workspaces/:workspace/boards`) and **team templates** still refuse pictures as
  today (`images_not_supported`; a template's `bad_request`). A board file or template that holds pictures is
  not brought into a team workspace in this version.

No new lifecycle state, transition, journal, fence, meta key or service table.
