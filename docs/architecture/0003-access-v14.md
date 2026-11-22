# 0003 — Access contract

CONTRACT VERSION: 0003 access v14 (2026-11-22)

Status: Draft for 0012-W3 v1. Replaces [access v13](0003-access-v13.md), whose directory, grants, epochs,
removal, lifecycle, timer, voting, spotlight, reaction and template rights remain in force word for word.
[API v13](0003-api-v13.md) adds the picture routes; this version adds their rights.

| Board role (as `authorize()` reads it) | Add a picture (`PUT …/assets/:hash`) and add, paste or drop images | See pictures (`GET …/assets/:hash`) |
| --- | --- | --- |
| owner | Yes | Yes |
| editor, or a guest with an editor grant | Yes | Yes |
| viewer, or a guest with a viewer grant | No (403 `role_too_low`, `needed: "editor"`) | Yes |
| removed, disabled, outsider, no role | No (404) | No (404) |

Adding the image object itself is a board edit and needs edit rights as every edit does (sync v16). Every
picture request reads the role in its own `authorize()` call; no earlier answer, ticket, cached picture or
room admission counts. Removing a member or lowering their role needs no delivery for pictures: their next
picture request is refused. A browser may still show a picture it fetched before the change from its own
cache (the response is cached as private to that browser); nothing new is fetched.

Pictures are stored with the board, not the person who added them: they stay when that person leaves or is
removed, and only clean-up ([hosted persistence v11](0003-hosted-persistence-v11.md)) or the board's
deletion removes them. No service table, permission or grant changes; the service-table count stays **17**.
