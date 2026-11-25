# 0003 — Access contract

CONTRACT VERSION: 0003 access v16 (2026-11-25)

Status: Draft for 0012-W6 v1. Replaces [access v15](0003-access-v15.md), whose directory, grants, epochs, removal,
lifecycle, timer, voting, spotlight, reaction, template, picture and video rights remain in force word for word.
[API v15](0003-api-v15.md) adds the staged import, template media and asset sizes; this version gives their rights.
Every step reads the role in its own call; no earlier step, upload id or staged file counts as permission.

**Amendment A3 (2026-11-25).** For the import and template upload routes below, the workspace `authorize()`
check follows the existing board create rules (S58). This also clarifies the route role check in API v15.

| Step | Owner of the workspace | Editor of the workspace | Viewer of the workspace or a workspace guest | Outsider, removed or disabled |
| --- | --- | --- | --- | --- |
| Open an import; upload to it; finish it (`…/imports…`, `POST …/boards` with `import`) | Yes, only their own import | Yes, only their own import | 403 `role_too_low` (`needed: "editor"`) for every viewer and for guests with a board grant. 404 `not_found` for guests without a board grant | No: 404 `not_found` |
| Open a template upload; upload to it | Yes, only their own | Yes, only their own | 403 `role_too_low` (`needed: "editor"`) for every viewer and for guests with a board grant. 404 `not_found` for guests without a board grant | No: 404 `not_found` |
| Save or replace a template with `upload` | As today's save and replace rights (team templates v2), plus: the upload is their own (else 403) | Same | No (today) | No (today) |
| Read a template's assets (`GET …/templates/:t/assets/:hash`) | Yes | Yes | Viewer: yes. Guest: 403 `role_too_low` (the `get_template` rights) | 404 |

| Step | Any board role (owner, editor, viewer, guest with a grant) | No role |
| --- | --- | --- |
| Ask a board's asset sizes (`POST /boards/:b/asset-sizes`) | Yes, as the board asset `GET` | 404 |
| Add a template's pictures to a board | The existing asset `PUT` (board editor or owner; a viewer 403), then the edit | 404 |

The finish re-checks the role twice: in the route's `authorize()` and inside `create_board`'s insert, under a lock on
the workspace row ([hosted persistence v13](0003-hosted-persistence-v13.md)), so a role lowered between the two cannot
create the board.

"Their own" means the person id recorded when the import or upload was opened (hosted storage v15). A person who loses
the editor role, leaves the workspace or is disabled between steps is refused at the next step exactly as a new
request would be, and nothing more is stored: for an import, no board row is created; for a template upload, no
template is saved. Their staged files are erased by the idle expiry. An import's board, once created, belongs to the
workspace like any board; its creator is the opener (`created_by`).

Pictures copied into a template are the template's, not the person's: they stay when that person leaves, and go only
when the template is replaced or deleted. No service table, permission or grant changes beyond the functions named in
[hosted persistence v13](0003-hosted-persistence-v13.md); the service-table count stays **17**.
