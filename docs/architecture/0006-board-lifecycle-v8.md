# 0006 — Board lifecycle contract

CONTRACT VERSION: 0006 board lifecycle v8 (2026-11-25)

Status: Draft for 0012-W6 v1. Replaces [lifecycle v7](0006-board-lifecycle-v7.md), whose owner-only transitions,
30-day retention, denial, fences, permanent register, journals, timer, voting, spotlight, picture and video rules
remain word for word except as below.

- **A board made by a staged import** ([API v15](0003-api-v15.md)) is born at the finish step, active, exactly as a
  board made by today's create: its row (with the upload id as its id), the `board_lifecycle` row the insert trigger
  writes, and its room holding the document, its pictures and its videos. Before the finish there is **no board**:
  no row, no lifecycle row, no listing, no join, no Trash. The room in the importing state is not a board in any
  lifecycle sense; it is erased by its idle expiry or by a failed finish's clean-up, never moved to Trash.
- **A failed or abandoned import leaves nothing**: no board row, no lifecycle row and no room storage, once its idle
  expiry has passed or its finish has failed (the existing clean-up of `deleteBoard` and `removeRoom`). A finish
  refused before the row is inserted (410, 403, 400) inserts nothing.
  **Amendment A1 (2026-11-25).** When the server stops after the insert and before promotion, the board remains listed
  but cannot be opened while the importing gate is in force. At expiry, at most 600 s after the claim and longer
  only while the service cannot be reached, cleanup removes the board and lifecycle rows before erasing room storage.
- **Board import** (`POST /workspaces/:workspace/boards`): **with** `import`, a document holding images and videos is
  accepted when the staging holds every file it names; **without** `import`, lifecycle v7's refusal stays word for
  word (400 `images_not_supported`). In the web app the reason "it holds pictures or videos, which team boards can't
  hold yet" is **removed**: a team import of a file holding pictures or videos is staged
  ([interaction v51](0001-interaction-v51.md)).
- **Team templates** accept images and videos when saved or replaced with an `upload` whose store holds every file
  they name ([team templates v3](0008-team-templates-v3.md)); without `upload` they refuse them with 400
  `bad_request` as in v7. The web app's template rule (`apps/web/src/team/templates-rules.ts`) no longer refuses
  them.
- Trash, restore, purge and delete of a board are unchanged, and never touch a template store: a template's pictures
  are its own copies.

No new lifecycle state, transition, journal, fence, meta key of the lifecycle or service table.
