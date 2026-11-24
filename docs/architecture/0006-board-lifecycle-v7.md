# 0006 — Board lifecycle contract

CONTRACT VERSION: 0006 board lifecycle v7 (2026-11-24)

Status: Draft for 0012-W4 v1. Replaces [lifecycle v6](0006-board-lifecycle-v6.md), whose owner-only
transitions, 30-day retention, denial, fences, permanent register, journals, timer, voting, spotlight and picture
rules remain word for word except as below. [Hosted storage v14](0003-hosted-storage-v14.md) keeps a board's
videos beside its pictures inside the board's own room storage.

- **Trash and restore from Trash** fence the room as today and keep its pictures and videos untouched. While a
  board is in Trash its asset routes answer 404 `not_found` through the existing lifecycle gate; after restore
  they serve the same pictures and videos.
- **Uploads in progress.** Each video upload is bound at admission to the room's upload cycle and recovery
  generation and holds a cancellation handle ([hosted storage v14](0003-hosted-storage-v14.md), "The upload
  registry"). The lifecycle fence (Trash and restore from Trash), backup restore, restore to time and disposal each
  cancel every upload in progress inside their ordered step, before they replace or dispose of any storage, whether
  it is staging, draining, waiting for its next chunk or waiting for another upload: its reader and idle timer are
  cancelled, its staged parts deleted, and it answers, the first event deciding: Trash **404 `not_found`**; restore
  from Trash, backup restore, restore to time and disposal **503 `service_unavailable`**. Nothing is stored and
  nothing renewed.
- **Purge, delete and discard** erase the board's room storage exactly as today (the Durable Object's
  `deleteAll()` on Cloudflare, the board's SQLite file and its `-wal` and `-shm` files on Node), after
  `Room.discardLifecycle` has invalidated every upload in progress. Videos, first frames and any staged rows go
  with it: there is no second store to clean. The existing check that no room table remains is unchanged.
- The lifecycle fence's history prune does **not** run the clean-up
  ([hosted persistence v12](0003-hosted-persistence-v12.md)): Trash keeps every asset the room holds.
- **Board import** (`POST /workspaces/:workspace/boards`) accepts a document of declared schema version 13, 14 or
  15 and refuses one that holds an `image` or a `video` object with 400 `images_not_supported` (the reason code
  is unchanged; `apps/server/src/routes/boards.ts`). **Team templates** refuse an `image` or a `video` object with
  400 `bad_request` and validate their objects inside a version 15 wrapper (`apps/server/src/templates.ts`); the
  web app's template rule (`apps/web/src/team/templates-rules.ts`) refuses a video as it refuses an image.
- In the web app, importing a board file into a team workspace ends, when the board holds any `image` or `video`
  object, with the reason **"it holds pictures or videos, which team boards can't hold yet"** (today's "it holds
  pictures, which team boards can't hold yet", widened; `PICTURES_REASON` in `apps/web/src/team/import.ts`),
  in the import's existing message. Nothing is sent. A board file or template that holds pictures or videos is
  not brought into a team workspace in this version.

No new lifecycle state, transition, journal, fence, meta key or service table.
