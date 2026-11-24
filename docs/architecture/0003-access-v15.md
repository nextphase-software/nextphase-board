# 0003 — Access contract

CONTRACT VERSION: 0003 access v15 (2026-11-24)

Status: Draft for 0012-W4 v1. Replaces [access v14](0003-access-v14.md), whose directory, grants, epochs,
removal, lifecycle, timer, voting, spotlight, reaction, template and picture rights remain in force word for word.
[API v14](0003-api-v14.md) lets the asset routes carry videos; this version adds their rights.

| Board role (as `authorize()` reads it) | Add a picture or video (`PUT …/assets/:hash`) and add, paste or drop images and videos | See pictures and first frames, download and play videos (`GET …/assets/:hash`) |
| --- | --- | --- |
| owner | Yes | Yes |
| editor, or a guest with an editor grant | Yes | Yes |
| viewer, or a guest with a viewer grant | No (403 `role_too_low`, `needed: "editor"`) | Yes |
| removed, disabled, outsider, no role | No (404) | No (404) |

Adding the video object itself is a board edit and needs edit rights as every edit does ([sync v17](0003-sync-v17.md)).
Every asset request reads the role in its own `authorize()` call; no earlier answer, ticket, cached file or room
admission counts. A video upload is checked again inside the room when it is admitted and again at its final step
([hosted storage v14](0003-hosted-storage-v14.md)), for a new video and for one the board already holds alike: a
role lowered or removed while the body arrives refuses it with 403 `role_too_low` (`needed: "editor"`) or 404
exactly as a new request would be refused, nothing is stored and no upload time is renewed. An upload of a video the
board already holds answers 200 only after its whole body has arrived and hashed to its hash.

**Playing** is each person's own: it reads the video through `GET` like any picture and sends nothing else (no
room message, presence key or edit). Anyone with a role may play, viewers included.

Removing a member or lowering their role needs no delivery for assets: their next asset request is refused. A
browser may still show a picture or play a video it fetched before the change (the response is cached as private
to that browser, and a downloaded video is kept for the tab); nothing new is fetched.

Videos and first frames are stored with the board, not the person who added them: they stay when that person
leaves or is removed, and only clean-up ([hosted persistence v12](0003-hosted-persistence-v12.md)) or the board's
deletion removes them. No service table, permission or grant changes; the service-table count stays **17**.
