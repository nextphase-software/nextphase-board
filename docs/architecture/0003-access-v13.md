# 0003 — Access contract

CONTRACT VERSION: 0003 access v13 (2026-11-14)

Status: Draft for 0008-W2 v1. Replaces [access v12](0003-access-v12.md), whose directory, grants,
epochs, removal, lifecycle, timer, voting, spotlight and reaction rights remain in force word for
word. [Team templates v1](0008-team-templates-v1.md) adds workspace-level rights:

| Current workspace role | List and read | Save | Manage own | Manage others' |
| --- | --- | --- | --- | --- |
| owner | Yes | Yes (with owner/editor role on the source board) | Yes | Yes |
| editor | Yes | Yes (with owner/editor role on the source board) | Yes | No |
| viewer | Yes | No | No (a viewer cannot have saved one; a creator lowered to viewer loses it) | No |
| guest, with or without board grants | No | No | No | No |
| removed, disabled, outsider | No | No | No | No |

Adding a template's copy to a board is a board edit and needs edit rights on that board as today.
Every template route reads the role in the same database call that serves it; no earlier answer,
ticket or room admission counts. Removing a member or lowering their role needs no room delivery
for templates: their next template request is refused. Their templates stay with the workspace.
The new table is service-role only with row level security on and no `authenticated` policy. The
service-table count becomes **17**; no other table, permission or grant changes.
