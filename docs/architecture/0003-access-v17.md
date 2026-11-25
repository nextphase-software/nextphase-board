# 0003 — Access contract

CONTRACT VERSION: 0003 access v17 (2026-11-25)

Status: Draft for 0012-W5 v1. Replaces [access v16](0003-access-v16.md), whose directory, grants, epochs, removal,
lifecycle, timer, voting, spotlight, reaction, template, picture, video, import, template media and asset size rights
remain in force word for word. [API v16](0003-api-v16.md) adds the two link preview routes; this version gives their
rights and the rights over link cards. The new rules are in the section **Link previews and link cards (v17)**;
everything else below is v16's text.

**Carried from v16 (2026-11-25):** v16 replaced [access v15](0003-access-v15.md), whose directory, grants, epochs,
removal, lifecycle, timer, voting, spotlight, reaction, template, picture and video rights remain in force word for
word. [API v15](0003-api-v15.md) adds the staged import, template media and asset sizes; v16 gives their rights.
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

## Link previews and link cards (v17)

New in v17. The fetcher is [link preview v1](0012-link-preview-v1.md); the card is [document v22](0001-document-v22.md).

| Step | Owner or editor of the board | Viewer of the board | Not a member, or no token |
| --- | --- | --- | --- |
| Ask for a preview on a team board (`POST /boards/:b/link-preview`) | Yes, within 20 a minute per person and board (429 `rate_limited` beyond) | No: 403 `role_too_low` (`needed: "editor"`) | Not a member (or removed, or disabled): 404 `not_found`. No token: 401 |
| Make a link card, change its layout, change it back to text, move, duplicate, arrange or delete it | Yes, through the room's existing edit rules | No: viewers cannot edit (unchanged) | No (unchanged) |
| Store a card's thumbnail (`PUT /boards/:b/assets/:hash`) | Yes, the existing asset `PUT` | No: 403 (unchanged) | 404 (unchanged) |
| See a card and its thumbnail; Open link | Yes | Yes: **Open link only** (the viewer's own browser opens a new tab with `noopener,noreferrer`; nothing reaches the server) | No (unchanged) |

- **Team route.** The role is the board role the existing `authorize(…, "board", "editor")` reads, as for the board
  asset `PUT` (the existing `board_role` answer, guests by their board grant: an editor grant may ask, a viewer grant
  is 403). The route sits behind the existing lifecycle
  gate for `/boards/:board/*`: a board that is not active (trashed, moving, deleted) answers as that gate does for
  every other board route (404 `not_found`). The role is read in the route's own call; holding a card, a loading card
  or an earlier preview never counts as permission.
- **Public route.** `POST /link-preview` has **no account and reads no token**. Only the exact path `/link-preview` is
  public; it is answered by its own branch before the bearer middleware, and every near match (`/link-preview/`,
  another letter case, a longer path) still needs a token ([API v16](0003-api-v16.md)). It is open only when the
  operator lists browser origins in `linkPreviewOrigins` ([self-host runner v11](0003-self-host-runner-v11.md)) and
  the request's `Origin` equals one of them; otherwise it is 404. An `Origin` header is easy to set outside a browser,
  so the origin list keeps other web pages from using the route, and the **per-address limit** (10 a minute and 200 a
  day for each client address) is what bounds everyone else. The route fetches only names whose every DNS answer is
  globally reachable and outside the operator's deny prefixes, within the boundaries of
  [link preview v1](0012-link-preview-v1.md) "Known limits": on Workers, the accepted unpinned-connection limit; on
  Node, a network whose egress does not translate addresses, or whose translation prefixes are listed in
  `linkPreviewDenyPrefixes` or denied at its egress ([self-host runner v11](0003-self-host-runner-v11.md), operator
  note). It stores nothing, so it gives a caller no board, workspace or person data.
- **Arrival.** The answer goes only to the person who asked. The card is changed by that person's own edit, under the
  room's edit rules: a paster who loses the editor role before the answer arrives cannot complete the card, which is
  then drawn link-only after its loading time ([interaction v52](0001-interaction-v52.md)).
- **Viewers** may select a card and use Open link; every other card control is disabled for them, a viewer's paste
  of an address makes nothing, and any edit a viewer's client sends is refused by the room exactly as today.
- No service table, permission or grant changes; the service-table count stays **17**. `LinkLimits` holds counters
  keyed by person and board ids or by client address, and nothing else.
