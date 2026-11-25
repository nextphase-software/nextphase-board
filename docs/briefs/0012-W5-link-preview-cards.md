BRIEF VERSION: 0012-W5 v1 (2026-11-25)
# 0012-W5 — Link preview cards on single-user and team boards

Status: Draft. Implementation has not started under this brief.

## Outcome and read first

**A pasted web address becomes a link card.**
- An owner or editor presses Cmd+V (Ctrl+V) on the canvas, with nothing being edited, while the clipboard holds one
  absolute `http`/`https` address. A **`link`** card appears at once, selected and centred in the view, **loading**.
- Board's **link preview fetcher** reads the page **on the server**, once:
  - team boards use `POST /boards/:board/link-preview` (owner or editor);
  - single-user boards, the public preview included, use `POST /link-preview` (no sign-in, limited per address).

  The fetcher answers with the page's title, description, site and picture bytes, and **stores nothing**.
- The **paster's browser** makes a thumbnail of at most 640 px and stores it as an **ordinary board picture**:
  - single-user: in the local picture store;
  - team: through the existing `PUT /boards/:board/assets/:hash`.

  It then marks the card ready. Viewing a card never fetches. Everyone on a team board sees the loading card, then the
  finished one.
- **The card:**
  - picture, title, description and site, in two layouts (vertical and horizontal);
  - title and site only when the page has no picture;
  - the address alone when no preview can be made, with no error message.
- **The bar:** Link · Open link · Display vertical · Display horizontal · Change back to text, then the existing
  arrange, duplicate and delete. A card has no resize handles. Viewers can only Open link.
- **Change back to text** turns the card into an ordinary text object holding the address; one Undo restores the card.
- **Addresses that are never fetched paste as plain text:** another scheme, an IP literal, `localhost`, a local name.
- **Declared fetcher:** the About popover (bottom-left "i") gains one line naming who reads pasted links. There is no
  consent prompt (maintainer decision).

Read [AGENTS.md](../../AGENTS.md), [CONTRIBUTING.md](../../CONTRIBUTING.md), [DESIGN.md](../../DESIGN.md) and these
new contract files (prior versions remain untouched):

| Contract | New version / ownership |
| --- | --- |
| [Link preview](../architecture/0012-link-preview-v1.md) | **New**, v1. The fetcher: address rules, resolution and pinning, redirects, limits, metadata extraction, the picture, the answer shape, rate limits, logging, both runners |
| [Document](../architecture/0001-document-v22.md) | v22: the `link` type, schema 16, upgrade from 15 |
| [Interaction](../architecture/0001-interaction-v52.md) | v52: paste, the card's looks and states, the bar, Open link, Change back to text, undo, viewers, the About line |
| [Web modules](../architecture/0001-web-modules-v50.md) | v50: the new web modules, the changed files, App.tsx wiring, counts |
| [API](../architecture/0003-api-v16.md) | v16: the two routes, their bodies, answers and CORS |
| [Access](../architecture/0003-access-v17.md) | v17: who may call each route; viewers only open |
| [Sync](../architecture/0003-sync-v18.md) | v18: `link` through the codec, adapters and undo; the arrival amending the paste's undo entry |
| [Board file](../architecture/0006-board-file-v6.md) | v6: link cards and their thumbnails in files (file version stays 3); schema 16 accepted |
| [Team templates](../architecture/0008-team-templates-v4.md) | v4: templates may hold link cards; a card's thumbnail is template media as a picture is |
| [Toolchain](../architecture/0001-toolchain-v6.md) | v6: `BOARD_LINK_PREVIEW_URL` and its `connect-src` origin |
| [Self-host runner](../architecture/0003-self-host-runner-v11.md) | v11: `linkPreviewOrigins`, the Node transport, `LinkLimits`, the Worker's `LINK_LIMITS` binding and compatibility flag, proofs |
| [Storage](../architecture/0001-storage-v5.md) | v5: reading still accepts schema 1–16; the board list's `newer` is above 16; card thumbnails are the board's pictures, held before a card names them |

Use this set wherever inherited contracts link a replaced version. Unchanged: [hosted storage v15](../architecture/0003-hosted-storage-v15.md), [hosted persistence v13](../architecture/0003-hosted-persistence-v13.md),
[board lifecycle v8](../architecture/0006-board-lifecycle-v8.md), [presence v5](../architecture/0004-presence-v5.md),
[comments v5](../architecture/0005-comments-v5.md), [identity v4](../architecture/0003-identity-v4.md),
[lock v5](../architecture/0001-dependency-lock-v5.json), [inventory v5](../architecture/0001-dependency-inventory-v5.json)
and [runtime notices v1 and v3](../architecture/0001-runtime-notices-v3.txt). The room's stored layout stays 9; the
service tables stay 17.

Build directly; no prototype or scenario tool is an input. Prove the stated values with focused tests, followed by
independent checks. Report a contract conflict before dependent work.

**Design.** The maintainer approved the look on 2026-11-25 (journey mock-up v1). Interaction v52 states every value:
- the card's sizes, colours, type and states;
- the bar's label and four buttons, using the existing context bar, `icon-button` and tooltip, with the current layout
  pressed in `#7051cf` as the bar's paint modes are;
- the selection outline: the picture's `#518de0`, 2 px, with no handles;
- the About line, under the popover's existing text in its style.

## Deliverables and boundaries

Planning source baseline main **6029f6a**. Use a fresh milestone worktree and branch from committed main containing
this packet, recording that prerequisite base separately from the behaviour baseline. New source files carry
`SPDX-License-Identifier: Apache-2.0`. Only these files may change, plus the append-only Implementation record below.

**New.**
0. `tests/browser/link-preview-stack.mjs` (test only: the Node runner with the link preview test seam and the fixture
   page servers, for the browser checks; self-host runner v11)
1. `packages/board-rules/src/objects/link.ts` (document v22)
2. `apps/web/src/link-cards.ts` (paste test, sizes, the card's states and texts, the thumbnail; web modules v50)
3. `apps/web/src/link-preview-client.ts` (the two routes' client; web modules v50)
4. `apps/web/src/scene/link-body.tsx` (drawing the card on the canvas)
5. `apps/web/src/ui/link-controls.tsx` (the bar's four buttons)
6. `apps/web/src/state/use-link-cards.ts` (paste, arrival, layout, Change back to text, Open link)
7. `apps/server/src/link-preview/fetcher.ts` (address rules, hops, metadata, picture; link preview v1)
8. `apps/server/src/link-preview/transport-node.ts` (`node:http`/`node:https` with a vetted `lookup`)
9. `apps/server/src/link-preview/transport-worker.ts` (DNS-over-HTTPS check, then `fetch` with `redirect: "manual"`)
10. `apps/server/src/link-preview/limits.ts` (the counter rule shared by both runners)
11. `apps/server/src/routes/link-preview.ts` (the two routes and their cancellable body reader; `routes/common.ts` unchanged)
12. `tests/link-cards.test.mjs` (web and rules unit, `npm test`)
13. `tests/link-preview-fetcher.test.mjs` (fetcher unit with a fake transport and clock, `npm test`)
14. `tests/server/link-preview.test.ts` (both runners)

**Changed** (rules, sync, room, server).

| # | File |
| --- | --- |
| 15 | `packages/board-rules/src/objects/registry.ts` (`link` in `OBJECT_TYPES`; `isLink`; `pictureOf` and `assetsOf` include a card's `asset`), `document.ts` (`LinkItem`, `ItemV16`, `BoardV16`, schema 16, the upgrade) |
| 16 | `packages/board-sync/src/codec.ts`, `document-adapter.ts`, `undo.ts`, `session.ts` (the `arrivalOf` option; sync v18) |
| 17 | `packages/board-room/src/room.ts` (`requireHeldMedia` checks a card's non-null `asset` is a picture type), `edits.ts` (the same on edits), `history.ts` (the history version range reaches 16; the capture comparison includes 15) |
| 18 | `apps/server/src/app.ts` (`/link-preview` exempt from bearer auth; CORS for `linkPreviewOrigins` on that path only; register `linkPreviewRoutes` after `templateMediaRoutes`), `runtime.ts` (`Runtime.linkPreview`, `Runtime.linkPreviewOrigins`), `settings.ts` (`linkPreviewOrigins`, optional), `worker-runtime.ts` and `worker.ts` (the Worker transport, the `LinkLimits` class), `start-node.ts` (the Node transport, in-memory limits), `templates.ts` (a template object of type `link` is valid; its `asset` is template media), `routes/templates.ts` (an upload whose only media is card thumbnails is valid), `routes/boards.ts` (import accepts schema 13–16; a card with a thumbnail sent without `import` answers `images_not_supported`, as an image does) |
| 19 | `apps/server/wrangler.json` (the `LINK_LIMITS` binding, the `v3` migration and the `global_fetch_strictly_public` compatibility flag only) |

**Changed** (web): `apps/web/src/App.tsx` (wiring only: the paste step, the bar controls, the About line), `clipboard.ts`,
`board-file.ts`, `state/use-board-document.ts` and `team/hosted-board.ts` (the `arrivalOf` option, default unchanged), `state/use-editing-commands.ts`, `state/use-selection.ts`, `state/use-object-layouts.ts` (no handles
for cards), `state/use-geometry-edits.ts` (cards left out of resizing), `state/use-storage-session.ts` (Save a copy
carries card thumbnails), `storage.ts` (the list's `newer` test above 16), `ui/context-bar.tsx`, `ui/information-controls.tsx`,
`ui/objects-panel.tsx`, `team/pictures.ts` (the team route's client), `team/media-transfer.ts` (`mediaOf` includes
card thumbnails), `team/templates-section.tsx`, `scene/board-drawing.tsx`, `ui/information-panel.tsx` (the About
line), `team/import.ts`, `team/templates-rules.ts` and `apps/web/style.css` (the link controls' two rules only, as web modules
v50 states them); type-only edits allowed in `image-assets.ts` and `board-export.ts`
(20). Each only as web modules v50 says. `apps/web/index.html` does not change; the build rewrites its copy.

**Changed** (build, tests and docs).

| # | File |
| --- | --- |
| 21 | `scripts/build-web.mjs` (toolchain v6) |
| 22 | The existing tests listed under the dispositions; `tests/server/setup.ts` (starts the fixture page servers and passes their ports: `LINK_FIXTURE_HTTP_PORT`/`LINK_FIXTURE_HTTPS_PORT` to Node, the `LINK_FIXTURE_PORT` binding to workerd); `tests/server/node-test.ts`, `driver-node.ts`, `driver-workerd.ts`, `driver-types.ts` and `worker-test.ts` (a local page server and a fake resolver the transports can be pointed at; the `LinkLimits` class) |
| 23 | `vitest.node.config.ts`, `vitest.workerd.config.ts` (add `tests/server/link-preview.test.ts`; the workerd config's `durableObjects` gains `LINK_LIMITS: { className: "LinkLimits", useSQLite: true }` and its compatibility settings become `wrangler.json`'s, `global_fetch_strictly_public` included); new test-only `tests/server/link-preview-fixtures.ts` and the committed TLS fixtures under `tests/server/fixtures/link-preview-tls/` (self-host runner v11) |
| 24 | `tests/README.md` (the new test files, after the 0012-W6 section) |
| 25 | `docs/guides/try-board.md` (Part 1 and Part 2 rows, below) |
| 26 | `README.md` (the preview's privacy sentence names the link preview service) |

No dependency. Type-only changes elsewhere are allowed where the compiler needs them, with no behaviour change; the
record lists them. New tests import the new modules dynamically inside their named checks, so on the 6029f6a baseline
each check that proves new behaviour fails by name.

**Try-and-test guide.** Part 1, after the Videos row:

| Feature | Try this | You should see |
| --- | --- | --- |
| [Link cards](../briefs/0012-W5-link-preview-cards.md) | On the preview site, copy a web address such as `https://en.wikipedia.org/wiki/Whiteboard`, click an empty spot on the board and press Cmd+V (Ctrl+V). Click the card, then Display horizontal, then Change back to text, then press Cmd+Z (Ctrl+Z). Paste `http://127.0.0.1/`. Open the "i" at the bottom left | A card appears at once with a grey loading picture, then shows the page's picture, title, a short description and "en.wikipedia.org". Horizontal makes it wide and short. Change back to text leaves the address as plain text, and Cmd+Z brings the card back. The 127.0.0.1 address pastes as plain text with no card. The "i" says pasted links are read by Board's link preview service |

Part 2, after the "Pictures in team imports and templates" row:

| Feature | Try this | You should see |
| --- | --- | --- |
| [Link cards on team boards](../briefs/0012-W5-link-preview-cards.md) | Ana (owner), Ben (editor) and Mia (viewer) open the same team board. Ben copies a web address and presses Cmd+V (Ctrl+V) on the canvas. Mia selects the card and clicks Open link. Ben pastes `https://intranet.example/plan` | Everyone sees the card appear loading and then with its picture and title. Mia's bar has only Open link working, and the page opens in a new tab. The intranet.example card shows just the address, for everyone, with no error message |

Not allowed:
- a dependency; an embed, `<iframe>`, oEmbed request or any HTML from a site rendered anywhere; a favicon fetch;
- the browser contacting a pasted site for anything but Open link (the CSP's `img-src` stays `'self' data:`);
- the server storing, caching or logging a page, a picture, a URL or a title (counts and outcome classes only);
- a server request to an address that fails the link preview contract's address rules, at any hop;
- a new room message, presence key or socket frame; a new service table; a change to hosted storage or persistence;
- a retry control or an error notice for a failed preview; resize handles on a card;
- any change to App.tsx beyond the three wiring points (paste step, bar controls, About line), or to `style.css` beyond the link controls' two rules.

Outside the named new controls, the existing screens' markup stays exactly as at the base: the reviewer's A–J
comparison allows only the masks listed under validation.

## Required behavior and concrete design

Implement the twelve contracts in full. In particular:

- **Paste (interaction v52):**
  - the order is: the table/CSV step, then the new link step, then the existing picture, video and object path (the
    picture handler prevents the event even for zero files, so the link step must run before it);
  - Board's own-copy comparison uses the raw clipboard text, before trimming;
  - it acts only for an editor, with nothing being edited, when `text/plain` is exactly one absolute address once
    trimmed, and no Board objects are on the clipboard;
  - an address failing the address rules, or whose `new URL(text).href` is longer than 1,000 characters, becomes a
    text object holding the trimmed text instead.
- **Card (document v22):** `type: "link"` with `url`, `title`, `description`, `site`, `asset` (a picture hash or `null`, never absent), `layout`
  (`vertical` | `horizontal`), `state` (`loading` | `ready` | `linkOnly`) and `requestedAt`. Sizes per interaction v52.
  A card loading for 20,000 ms past `requestedAt` is drawn and treated as `linkOnly`.
- **Arrival:**
  1. The paster's browser calls the route for its mode, with a 15,000 ms abort.
  2. It makes the thumbnail and stores it: local store, or hosted `PUT` with the existing upload code.
  3. Only then does it update the card in one edit: texts, `asset`, `state: "ready"`.
  4. That edit amends the paste's undo entry (sync v18 through `use-board-document.ts`, `team/hosted-board.ts` and
     the sync session's `arrivalOf` option; local history through `amendHistory`). Any failure gives `state:
     "linkOnly"`, committed silently.
  - **The gate** (interaction v52), before the upload and again before the commit: the same board is open; single-user,
    this tab still holds the local writer (else cancel); team, the live editable document is shown (during a version
    preview, hold until live up to `requestedAt + 15,000` ms, else cancel); the card still exists with the same id,
    url and `state: "loading"`. A cancelled arrival does nothing, and the card is drawn link-only once stale. The local
    picture budget is recomputed at commit.
  - **The finish** reads the card's current `x` and `y` at commit and writes the rectangle and the finish keys (title,
    description, site, asset, state, layout) in one update. `x` or `y` change only when the new size would cross the
    document bounds (shifted left or up just enough), the same rule as layout changes, paste and Change back to text.
    A move by another person in the same instant may lose to the finish or keep the old size; both are accepted and
    valid, because a card's size may be any of the card sizes whatever its state (document v22).
  5. A full board picture budget gives a ready card without `asset`.
- **Fetcher (link preview v1):**
  - the address rules F1–F2;
  - resolution with every answer checked, and the connection pinned on Node;
  - DNS-over-HTTPS before each hop on Workers;
  - manual redirects, at most 3, each re-checked;
  - the address policy: only globally reachable addresses (IANA special-purpose registries), NAT64 refused, every A
    and AAAA answer of every page and picture hop checked;
  - the 1 MiB / 5 s page and 5 MiB / 5 s picture limits, within 12 s in all;
  - metadata in the stated order;
  - the picture sniffed with the existing sniffer;
  - the answer `{ url, title, description, site, picture: { type, bytes } | null }`, where `bytes` is base64.
- **Limits:** both routes count in `LinkLimits` (a Durable Object on Cloudflare, memory on Node). The team route
  allows 20 a minute per person and board, keyed `person:<person>:<board>`. The public route allows 10 a minute and 200
  a day per client address, keyed `address:<CF-Connecting-IP or the socket address>`. Over a limit: 429 `rate_limited`.
- **Routes (API v16):**
  - The team route needs the board's editor role (403 `role_too_low`) and the board active.
  - The public route needs `linkPreviewOrigins` to list the request's `Origin`; otherwise it answers 404 `not_found`.
    It needs no `Authorization`. Its CORS allows only `POST, OPTIONS` and `Content-Type`.
  - Bodies are `{ "url": string }` only (400 `bad_request` otherwise).
  - Every answer is in link preview v1's one status matrix: 200 only when the page gave a title (`picture: null` when
    it had none or any picture step failed, a refused picture hop included); 400, 401, 403, 404, 413; 422
    `address_refused` (the pasted address or a page hop refused); 422 `preview_unavailable`; 429; 502
    `preview_failed`; 503. The browser maps any non-200 to a link-only card.
- **Build (toolchain v6):** when `BOARD_LINK_PREVIEW_URL` is set (an absolute https origin, or http on 127.0.0.1 for
  tests), the built `index.html`'s `connect-src` gains that origin and the single-user app calls `<it>/link-preview`.
  When it is unset, the single-user app makes link-only cards and fetches nothing, and the About line is not shown.
  The team build uses `BOARD_SERVER_URL`.
- **Board files, templates, export, copy:** a card travels with its thumbnail as a picture does (board file v6, team
  templates v4). Copy, paste of a copied card, duplicate, import and template add never fetch. Export draws the card.

## Shared-path check dispositions

This inventory authorizes expectation changes, not additional historical runs.

| Shared path / older checks | Disposition |
| --- | --- |
| Tests pinning `OBJECT_TYPES`, the current schema 15 or a "newer" fixture at 16: `tests/document*.test.mjs`, `board-file.test.mjs`, `storage.test.mjs` (92–132), `board-catalog.test.mjs` (235, 322), `room-videos.test.mjs` (159–166), `pages.test.mjs` (209–214), `room-imports.test.mjs`, `mind-map.test.mjs`, `resize.test.mjs`, `tables.test.mjs`, `connectors.test.mjs`, `connector-styles.test.mjs`, `images.test.mjs`, `video.test.mjs`, `video-playback.test.mjs`, `strokes.test.mjs`, `sync*.test.mjs`, `team-import.test.mjs` (84), `team-templates.test.mjs` (48), `objects.test.mjs` (11, Amendment A1/A2 (2026-11-25): the exact registry order gains `link` directly after `video`), `room.test.mjs` (248), `shapes.test.mjs` (39), and every server check that asserts the current schema number (listed by the record) | The type list gains `link`; every assertion of the **current** schema moves from 15 to 16 and every **newer-than-current** fixture from 16 to 17; historical fixtures keep their declared versions. Every other assertion unchanged; must pass. The record lists each changed line |
| `tests/modules.test.mjs` (the exact module lists, the App composition test, the line budget, counts and effect guards) | The new modules inserted in sorted order; title "through 0012-W5 v1". App.tsx's budget and composition change only by web modules v50's three wiring points. Every other guard unchanged; must pass |
| `tests/pages.test.mjs` (0010-W2 F1 and F1b stylesheet comparisons) | **Amendment A4 (2026-11-25).** Exclude precisely the two link-control rule lines specified by web modules v50 from the current stylesheet, asserting that each occurs exactly once. The remaining prefix before `/* Pages:` must match each historical reference byte for byte. Every other assertion stays unchanged |
| `tests/workshop-voting.test.mjs` (W2-U07) | **Amendment A4 (2026-11-25).** Add `link` immediately after `video` in the eligible type list, as document v22 gives cards `voting: true`. No other assertion changes |
| Paste checks (`tests/clipboard*.test.mjs`, table/CSV paste, picture paste) | Unchanged; must pass. A clipboard holding Board objects, a table or a file still takes its existing path |
| Board file and team import checks (`tests/team-import.test.mjs`, board file tests) | Unchanged for files without cards apart from the schema row above; must pass |
| The 0001-W11 brief's AC02 ("canvas paste reads only Board's own clipboard") | Amended by this brief: system-clipboard text that is exactly one address now makes a card (or text); any other system-clipboard text is still ignored, and Board's own copy keeps its path |
| Template validators (`tests/team-templates.test.mjs` T8-U3 (its malformed-image case retained as written), server S378–S401, S458–S462) | Unchanged; must pass (a sticky with `type: "link"` and missing keys is still invalid; a valid card is proved in the new files) |
| Server suites S1–S467 | Unchanged apart from the schema-number assertions in the row above; must pass, S60 (bearer) and S400/S441 (CORS) included. The bearer rule holds for every path but the exact `/link-preview`, join and `/operator/`; CORS for every other path still allows only `allowedOrigin` |
| Historical browser scenarios (V14) | 0006-W1 X1 read as 0012-W6's dispositions left it, with boards written at schema **16** in file version 3; 0012-W3 N7 with the picker named **Media** and `Media ⇧⌘K`; 0008-W2 T8, the 0011-W2 CSV scenario and the 0001-W11 copy-and-paste scenario as written, with CSV and own-copy pastes taking their existing paths before the link step. Scenario scripts are rerun at the revisions 0012-W6's check run used, with the adaptations named here. The older `boards-check` script, which derives future-schema fixtures from an old default, is outside V14. Any other baseline-era difference is a baseline finding |
| Local shell: A–J | No difference allowed outside the new card, bar and About line, which none of A–J shows |

The record lists every changed line range under `tests/`.

**Amendment A4 (2026-11-25).** Any other existing assertion of a list derived from `OBJECT_TYPES` may change on one recorded line to include `link` in registry order when document v22 makes it eligible for the list, and stays unchanged when the list's flag is false for cards.

## Browser checks

New scenario **N10-S1–N10-S9**. N10 was unused as a scenario ID in existing public briefs when allocated. A fresh,
independent check run writes its tool from these clauses and the contract values. Each row prints its full ID,
`PASS:` or `FAIL:` and a summary, and keeps raw receipts and unrun rows.

Setup:
- 1440 × 900, scale 1, macOS Chrome, US keyboard layout.
- Two local page servers on 127.0.0.1 serve synthetic sites:
  - `fieldnotes.test`: a page with `og:title` "How we run a five-day design sprint with a small remote team", an
    `og:description`, `og:site_name` absent, and an `og:image` PNG of 1200 × 630;
  - `hall.test`: a page with a `<title>` only;
  - `slow.test`: a page answering after 8 s;
  - `large.test`: a 2 MiB page whose tags come after 1 MiB;
  - `hops.test`: a redirect chain of 4.
- **The preview server** for every row is `tests/browser/link-preview-stack.mjs` (self-host runner v11): the Node
  runner started with the link preview test seam, on the check run's isolated local team stack settings (its own
  uniquely owned local Supabase project, as `npm run team:start` makes one), with `linkPreviewOrigins` listing the
  single-user build's origin. Its seam resolves `*.test` to declared test addresses, which alone bypass the address
  policy and are dialled to the fixture page servers on 127.0.0.1 (a self-signed CA the seam trusts). The real address
  rules still refuse 127.0.0.1 itself; production `node.ts` never sets the seam. It is started as
  `BOARD_SETTINGS=<file> node tests/browser/link-preview-stack.mjs`; page servers listen on `127.0.0.1:8797` (http)
  and `:8798` (https); it resolves `fieldnotes.test`, `hall.test`, `slow.test`, `large.test` and `hops.test` to
  `192.0.2.10`–`.14` (allowlisted) and `intranet.example` to `10.0.0.5`, and gives every other name no answer. It is
  **one process** that owns the only fixture listener pair and the one preview server: it replaces the team stack's
  server on that stack's port, and the single-user build's `BOARD_LINK_PREVIEW_URL` is that same origin (listed in
  its `linkPreviewOrigins`). The fixture holds `/sprint`'s reply until the check tool calls
  `POST http://127.0.0.1:8797/__release` (test only); the tool releases within 4,000 ms of the paste so the card
  becomes ready.
- Single-user rows run on a candidate build with `BOARD_LINK_PREVIEW_URL` set to that server's origin. Team rows run
  the team app against that same server, with Ana (owner), Ben (editor) and Mia (viewer) each in their own browser
  context.
- The browsers never resolve `*.test`. Open link is checked by intercepting `window.open` in the page (its URL and
  features), not by loading the site.
- Where a row says so, the check tool matches one request by method and URL pattern, answers it (with the server's
  CORS headers) and removes the route after that attempt.
- Real pointer and key events. The clipboard is written by the tool through the page's own clipboard API, then Cmd+V
  is pressed with nothing selected and the pointer over empty canvas. Before each paste the tool pans so the view
  centre is empty canvas at least 400 × 400 px wide, as the approved screens show. Texts, colours and sizes exactly as
  interaction v52.

| Row | Steps and pass condition |
| --- | --- |
| N10-S1 | Single-user, with the fixture holding `/sprint`'s reply (released by the tool after the capture): paste `https://fieldnotes.test/sprint`. Within 200 ms a selected `link` card at the view centre, 306 × 288 loading look, bar `Link · Open link · Change back to text` + arrange, duplicate, delete; capture local-loading. Then the ready card: the picture, the two-line title, description, `fieldnotes.test`; no request from the page to `fieldnotes.test` (network log); the picture held in the local store as a JPEG at most 640 px; capture local-card (after a click on empty canvas) and local-selected (selected, Open link hovered). Press Save, wait for the `Locally saved` receipt, reload: the card draws from the local store with no request to the preview service |
| N10-S2 | Click the card to select it, hover Display horizontal and click it: 480 × 114, Display horizontal pressed; capture local-horizontal. Display vertical restores it |
| N10-S3 | Pan to empty canvas at least 600 × 400 px. Paste `https://hall.test/visit`: a title-only card 306 × 100; capture local-title-only. Delete it. Paste, one at a time and deleting each before the next: `https://slow.test/`, `https://large.test/`, `https://hops.test/` and `https://no-such-host.invalid/x`: each a link-only card 480 × 64 showing its address, no notice; capture local-link-only (one of them, Change back to text hovered) |
| N10-S4 | Pan back and click the fieldnotes card to select it. Change back to text: a text object with the URL at the card's top-left, selected; capture local-back-to-text. Cmd+Z at once (focus is back on the canvas): the card back with its picture; Cmd+Shift+Z: the text again; Cmd+Z again |
| N10-S5 | Pan to empty canvas. Paste `http://127.0.0.1/`, `http://[::1]/`, `http://localhost:8080/`, `ftp://fieldnotes.test/`: each a text object; no request to the preview service (network log). Delete those four texts and the fieldnotes card; with nothing selected, open the "i": the single-user About line; capture local-about. A build without `BOARD_LINK_PREVIEW_URL`: pasting `https://fieldnotes.test/sprint` makes a link-only card at once and no request leaves the page; the About line is absent |
| N10-S6 | Team, with the fixture holding `/sprint`'s reply until the loading captures are taken: Ben pastes `https://fieldnotes.test/sprint`. Ana and Mia see the loading card within 3 s (captures ben-loading, ana-loading), then the ready card (ben-card, ana-card). Ana's and Mia's pages make no request to the preview route or to `fieldnotes.test`. Right after the card is ready, Ana (with nothing cached) opens the Board panel and chooses Save a copy: the file holds the card and its thumbnail with its pixel size |
| N10-S7 | Mia selects the card: the bar shows Open link enabled and the other link buttons, arrange, duplicate and delete disabled, no handles; capture mia-selected (Open link hovered). Open link calls `window.open` with the card's URL, `_blank` and the features `noopener,noreferrer` (intercepted). Mia's Cmd+V of an address adds nothing. Through the API with Mia's token, the team route answers 403 |
| N10-S8 | Ben deletes the fieldnotes card, then pastes `https://intranet.example/plan`: a link-only card for everyone (captures ben-link-only, mia-link-only). With the team route's next request answered 429 `rate_limited` by the tool, Ben pastes `https://fieldnotes.test/again`: link-only. Ben deletes every card on the board; then, with nothing selected, open the "i" as Ana, Ben and Mia: the team About line for each (captures about-ana, about-ben, about-mia) |
| N10-S9 | The two guide rows walked as written on fresh boards, both with `https://fieldnotes.test/sprint` in place of the outside address (no outside site is fetched; the fixture releases at once), the Part 1 row on the candidate build pointed at the launcher; Mia's Open link verified by the intercepted `window.open` call as in N10-S7: each `You should see` holds |

**Hosting note.** A deployed single-user preview shows cards only once (1) its build is given
`BOARD_LINK_PREVIEW_URL` and (2) its server lists the preview's origin in `linkPreviewOrigins` and carries the
`LINK_LIMITS` binding, its migration and the compatibility flag (self-host runner v11, toolchain v6). After deploying,
the served page's CSP lists that origin and one preview request from the deployed preview answers 200. That is an operator step after merge, outside this brief; the Part 1 guide row is walked on the deployed preview
only after it.

**Baseline (6029f6a).** Each of N10-S1 to N10-S8 fails at its first new assertion: the paste shows "Nothing to paste."
or pastes earlier objects, and the routes answer 404. N10-S9 fails at the new rows. The check run records each row's
baseline outcome.

## Acceptance criteria

- **0012-W5-AC01:** An editor pastes a web address on a single-user or team board and gets a card at once. It shows
  loading, then the page's picture, title, short description and site; or the link alone when no preview can be made.
  The card has two layouts, opens the link, and turns back into text, with Undo restoring it. Everyone on a team board
  sees the same card. Look matches the approved mock-up.
- **0012-W5-AC02:** Page details are fetched only by Board's declared fetcher (named in the About popover and the
  README), never by the viewer's browser, with no consent prompt. It fetches only public `http`/`https` addresses,
  checking every redirect, within the link preview contract's size, time and rate limits. Only the link is sent. Only
  the title, description, site and a thumbnail of at most 640 px are kept; nothing is cached on the server.
- **0012-W5-AC03:** Only owners and editors make or change cards, and the team route checks it. Viewers can only open
  the link. No embeds, oEmbed or HTML from a site, and no native import from other whiteboard tools.

| Criterion | Evidence that shows it |
| --- | --- |
| 0012-W5-AC01 | N10-S1–N10-S4, N10-S6; X10-U01–X10-U09, X10-U13–X10-U16; S477; V4 |
| 0012-W5-AC02 | N10-S1, N10-S3, N10-S5, N10-S6, N10-S8; S468–S476, S478; X10-U10–X10-U12; V4 |
| 0012-W5-AC03 | N10-S7, N10-S8; S470, S474; V8 |

## Applicable DESIGN.md guardrails

Fail-closed access and outbound requests, independent state owners, the existing context bar and notices apply. The
new controls are the bar's four buttons and the About line only. Interaction v52 states every new value; never infer
generic styling.

## Validation commands and expected evidence

Use pinned Node 26.13.0 and npm 11.20.0 from the repository root. Source validation is not independent acceptance.
Each check run restates **every V row it reruns** as its own `PASS: Vn ...` / `FAIL: Vn ...` line with SHA, logs and
counts.

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm run typecheck
npm test
BOARD_TEAM_FEATURES=off BOARD_SUPABASE_URL=http://127.0.0.1:55321 BOARD_SUPABASE_ANON_KEY=synthetic BOARD_SERVER_URL=http://127.0.0.1:8796 npm run build
npm run audit:licenses
BOARD_TEAM_FEATURES=off BOARD_LINK_PREVIEW_URL=http://127.0.0.1:8796 npm run build
npm run build:fixtures
BOARD_TEAM_FEATURES=on BOARD_SUPABASE_URL=http://127.0.0.1:55321 BOARD_SUPABASE_ANON_KEY=synthetic BOARD_SERVER_URL=http://127.0.0.1:8796 npm run build
npm run audit:licenses
npm run build:server
npm run audit:licenses
npm run test:server:node
npm run test:server:workerd
WRANGLER_SEND_METRICS=false npx wrangler deploy --dry-run --outdir <scratch> -c apps/server/wrangler.json
git diff --name-status <prerequisite-base>..<validated-source>
git diff --check <prerequisite-base>..<validated-source>
```

Both runners gain an outbound fetch and a public route. So after the build, a short server-only run checks, on the
exact candidate and on each runner, what the cloud Checks cannot reach:
- the address rules against a local resolver that answers private, mapped and rebinding addresses;
- slow and huge pages, redirect chains and the 12 s ceiling;
- the limits over a real minute.

The counted server suites, `tests/server/link-preview.test.ts` included, are taken from the Checks workflow run on the
exact candidate commit (V9). The check run starts the team stack on its own uniquely owned local Supabase project.
Record each long run's start and end and the host's sleep and wake events; a run that overlapped a sleep is INVALID and
is rerun awake. Three manual checks from this milestone are chosen only at Review.

| Check | Command/inspection and pass condition |
| --- | --- |
| V1 | Byte-compare manifests, locks, dependency inventory and runtime notices against the prerequisite base: unchanged, no new dependency |
| V2 | `npm ci --ignore-scripts --no-audit --no-fund` exits 0 on the clean candidate and on the independent baseline |
| V3 | `npm run typecheck` exits 0 across all five workspace members |
| V4 | `npm test` full suite exits 0, X10 groups included. Guards as web modules v50 |
| V5 | Team-off `npm run build` and `audit:licenses` exit 0; the built `index.html` keeps `connect-src 'none'`. With `BOARD_LINK_PREVIEW_URL`, its `connect-src` is exactly that origin and `img-src` is unchanged. An invalid setting (a path, a query, `http://` other than 127.0.0.1, not a URL) fails the build |
| V6 | `npm run build:fixtures`, team-on `npm run build` and `audit:licenses` exit 0; team-on notices equal runtime notices v3; `img-src` unchanged. A team-on build with `BOARD_LINK_PREVIEW_URL` equal to `BOARD_SERVER_URL` lists that origin once, and with a different origin appends it; the fixtures build ignores the setting; a team-on build's local (single-user) boards use the setting when it is given |
| V7 | `npm run build:server`, `audit:licenses` and the wrangler dry run exit 0, the dry run listing the `LINK_LIMITS` binding and the `global_fetch_strictly_public` flag; no deploy |
| V8 | Inspect all hunks plus `git diff --name-status` and `git diff --check` over `<prerequisite-base>..<validated-source>`: only the deliverables, the dispositions and the append-only Implementation record; App.tsx differing only by the three wiring points; `style.css` only by the link controls' two rules; `wrangler.json` only by the binding, the `v3` migration and the flag; no `fetch(` to a pasted address in `apps/web/src` other than Open link's `window.open`; no logging of a URL, title or body in `apps/server/src/link-preview/` |
| V9 | The Checks workflow's server suites (Node and workerd) pass on the exact candidate commit, S468–S478 included; the server-only run passes on both runners (the S473 ceiling in real time) |
| V10 | N10-S1–N10-S9 pass with the state captures and raw receipts, and the baseline outcomes are recorded |
| V11 | Design, one receipt per approved screen (journey mock-up v1): local-1-loading ↔ local-loading; local-2-card ↔ local-card; local-3-selected ↔ local-selected; local-4-horizontal ↔ local-horizontal; local-5-title-only ↔ local-title-only; local-6-link-only ↔ local-link-only; local-7-back-to-text ↔ local-back-to-text; local-8-about ↔ local-about; team-1-ben-loading, team-2-ana-loading, team-3-ben-card, team-4-ana-card, team-5-mia-selected, team-6-ben-link-only, team-7-mia-link-only, team-8-ana/ben/mia-about ↔ the N10-S6 to N10-S8 captures. Names, sites and pictures may differ |
| V12 | Once, on an independent 6029f6a source and build with the candidate's new unit files, `tests/server/link-preview.test.ts`, its test harness changes (`tests/server/setup.ts`, `node-test.ts`, `driver-*.ts`, `worker-test.ts`, `link-preview-fixtures.ts`, `tests/server/fixtures/link-preview-tls/`, `tests/browser/link-preview-stack.mjs`) and a test-only copy of both vitest configs (adding the file; the workerd copy **leaves out** the `LINK_LIMITS` binding, whose class does not exist on the baseline) copied in, and **no** candidate runtime source: every check that proves new behaviour fails by name (S468–S477 and X10-U01–X10-U16; S478 and X10-U00 are compatibility checks that pass on both); a top-level setup or import abort does not count. **X10-U00** and **S478** pass on both |
| V13 | Accepted A–J compare: baseline twice, then candidate and diffs, with existing normalization; no difference |
| V14 | Accepted regression runs: V4, V9, V13, the 0001-W11 copy-and-paste scenario, the 0011-W2 CSV paste scenario, the 0012-W3 scenario N7, the 0006-W1 scenario X1 and the 0008-W2 scenario T8 on the candidate, read with the dispositions above. Any row that also fails on 6029f6a is a baseline finding |

**Server checks** in `tests/server/link-preview.test.ts`, each on both runners unless marked, named `S468` onwards:
**S468–S476 and S478 are exactly the rows of [link preview v1](../architecture/0012-link-preview-v1.md) section 16**
(team route, address rules, rights, address policy and pinning, redirects and picture hops, page and picture limits and
the 12 s ceiling, the public route and CORS, rate limits, nothing kept, manual redirects in the production
configuration). Their names, for the evidence bundle:
- **S468** team route for an editor; **S469** address rules; **S470** rights; **S471** address policy, pinning and
  DoH; **S472** redirects and picture hops; **S473** page and picture limits and the 12 s ceiling; **S474** the public
  route and CORS; **S475** rate limits; **S476** nothing kept; **S478** manual redirects in the production
  configuration.

S477 is this brief's:
- **S477** card media in imports and templates: a staged import whose document holds a card with a thumbnail stores
  it as a picture and the board serves it; a create without `import` holding such a card → 400 `images_not_supported`;
  a template upload whose only media is card thumbnails saves, and adding it puts the thumbnail on the target board.
**Unit checks** in `tests/link-cards.test.mjs` and `tests/link-preview-fetcher.test.mjs`, one named check each:
- **X10-U00** compatibility (V12): a paste of plain non-address text, of copied Board objects and of a picture file
  takes today's path. Passes on both revisions.
- **X10-U01** the paste test: one address, trimmed, makes a card; whitespace inside, two addresses, more than 1,000
  characters, or Board objects on the clipboard do not.
- **X10-U02** the client's address rules: each address N10-S5 names becomes text; a short input whose serialised `href`
  is longer than 1,000 characters becomes text; an input longer than 1,000 characters is not an address (today's path).
- **X10-U03** sizes for every state and layout, and the six content-fit heights.
- **X10-U04** the 20,000 ms loading rule.
- **X10-U05** the thumbnail: at most 640 px, JPEG 0.85, PNG when transparent, a GIF's first frame.
- **X10-U06** single-user: paste → arrival → Undo removes the finished card, Redo restores it; paste → move → arrival →
  Undo/Redo with sync v18's stated outcomes; paste → Change back to text → Undo → arrival applies to the restored card
  (same id).
- **X10-U07** Change back to text and its Undo.
- **X10-U08** the `link` validator (the union of card sizes, a `linkOnly` card at 306 × 288 included) and the upgrade
  from 15.
- **X10-U09** board file and template round trips with a card and its thumbnail.
- **X10-U10** the fetcher's metadata order, entity decoding and cut lengths.
- **X10-U11** picture sniffing and the 5 MiB limit.
- **X10-U12** redirect counting and every deadline, with a fake transport and clock.
- **X10-U13** team, through the real commit path (`use-board-document.ts` → `team/hosted-board.ts` → a real
  `BoardSession` with `arrivalOf`): paste → arrival → Undo/Redo; paste → move → arrival → Undo/Redo; a synchronous
  refusal matched and retried once; two clients with the move and the arrival in both orders, with sync v18's stated
  outcomes.
- **X10-U14** team: Change back to text before the arrival, then Undo (the card returns under a new id): the arrival
  is dropped and the card is drawn link-only once stale, with no new request.
- **X10-U16** document bounds: a card at the right and bottom edges changed to horizontal, finished and changed back to
  text is shifted left or up just enough, and stays valid.
- **X10-U15** client Add template with a card (team templates v4): its thumbnail goes on the target board through the existing template-add
  upload path, with no preview request.

A regression failure that also fails on 6029f6a is a baseline finding to report, never fixed here.

## Review focus and public references

Review that:
- no outbound request is made to an address the rules refuse, at any hop, on either runner, and that Node's
  connection uses the vetted address;
- the public route is the only new unauthenticated path and is closed when `linkPreviewOrigins` is empty;
- nothing from a page is stored on the server or logged;
- the browser never contacts a pasted site except through Open link;
- a card's thumbnail is held before the card names it, and undo, files, templates and copies never fetch again;
- viewers cannot make or change cards by any path;
- App.tsx and `style.css` change only as stated.

**Known limits.** Below 768 px the context bar is inert for every object, so the link commands are not offered there
(interaction v52). A move by another person landing in the same instant as an arrival may be lost or keep the old
size (sync v18). **Link preview v1 section 15:** Workers do not pin the connection; a name that rebinds between the DoH
check and the platform's lookup can reach only addresses the platform itself will connect to. Node pins every
connection; on a host whose egress translates addresses (NAT64 with its own prefix), the operator lists the
translation prefixes in `linkPreviewDenyPrefixes` or denies private destinations at egress (self-host runner v11). The
server Worker's Supabase must be on another zone than the Worker's own.

Left for the check run and review after the second pre-commit read (the read cap):
- the stale face, hit area and outline at the stored rectangle, and the line caps, in the visual comparison;
- the fixture's release timing in N10-S1 and N10-S6, and the S473 ceiling in real time on both runners;
- whether local workerd with `global_fetch_strictly_public` still reaches the loopback Supabase proxy and the page
  servers (if not, stop and report; do not drop the flag);
- whether the test resolver can be injected on workerd without driver actions beyond the listed driver files;
- whether every supported browser's canvas encodes JPEG at the stated quality.

The public source basis is main 6029f6a and the linked versioned contracts, read 2026-11-25. Outside facts relied on:
- the Open Graph protocol (ogp.me);
- OWASP's SSRF prevention cheat sheet (an allow list, resolve-then-connect, re-checked redirects);
- IANA's IPv4 and IPv6 special-purpose address registries;
- Cloudflare's Workers documentation:
  - fetch reaches URLs, not IP addresses;
  - `redirect` accepts "follow" and "manual";
  - 50 subrequests a request on Free, each redirect counting;
  - `global_fetch_strictly_public`;
- Node's `dns.Resolver` and the `lookup` option of `http.request`;
- Facebook's crawler guidance that tags appear within the first 1 MB.

No unresolved product decision is delegated to implementation.

## Exclusions and reasons

- Interactive embeds, oEmbed and native import from other whiteboard tools: AC03.
- A favicon: one more fetch and picture a card (scope D11).
- A consent prompt: the maintainer's decision; the fetcher is declared instead.
- A retry control or error notices: a failed preview shows the link alone.
- Hyperlinks inside text objects; pasting plain non-address text as text.
- A server-side cache of previews.
- Repairs to separately tracked baseline failures.

## Implementation record

Append-only. The implementer adds dated sections here.
