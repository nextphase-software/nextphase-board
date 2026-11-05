BRIEF VERSION: 0006-W1 v1 (2026-11-04)
# 0006-W1 — Export and restore a portable board

Status: Implemented. Independently reviewed at `5508924` (pass) and merged into main on
2026-11-05 ([evidence summary](0006-W1-export-and-restore-a-portable-board-evidence.md)).
Contracts: [0003 API v5](../architecture/0003-api-v5.md),
[0003 hosted persistence v5](../architecture/0003-hosted-persistence-v5.md),
[0001 interaction v31](../architecture/0001-interaction-v31.md) and
[0001 web modules v29](../architecture/0001-web-modules-v29.md) (new versions). Unchanged and still
in force: [0003 access v5](../architecture/0003-access-v5.md),
[0003 sync v6](../architecture/0003-sync-v6.md),
[0003 hosted storage v5](../architecture/0003-hosted-storage-v5.md),
[0005 comments v1](../architecture/0005-comments-v1.md),
[0004 presence v1](../architecture/0004-presence-v1.md),
[0001 toolchain v5](../architecture/0001-toolchain-v5.md) with its
[lock v5](../architecture/0001-dependency-lock-v5.json),
[inventory v5](../architecture/0001-dependency-inventory-v5.json) and
[runtime notices v3](../architecture/0001-runtime-notices-v3.txt),
[0003 identity v3](../architecture/0003-identity-v3.md),
[0003 self-host runner v1](../architecture/0003-self-host-runner-v1.md),
[0001 document v11](../architecture/0001-document-v11.md),
[0006 board file v2](../architecture/0006-board-file-v2.md) and
[0001 storage v3](../architecture/0001-storage-v3.md). Where an unchanged contract links an older
version of a contract replaced here, the version named in this brief applies.

## Outcome

A team board can already be saved to a file: **Save a copy to file** in the Board panel writes the
same Board file (`.nextboard`) a local board does, for anyone with a role on the board, viewers
included, and that file opens as a local board. What a team cannot do is bring a board **into** a
workspace. This milestone adds that:

- **Import board file…** on Home, beside New board, wherever New board is shown (a workspace you
  may create boards in). On Recents with more than one such workspace it asks **Import into**
  which one; otherwise it opens the browser's file picker at once.
- **The file becomes a new team board** in that workspace, with a new board ID, the file's title,
  and every sticky, shape, text, drawing, section, group and connector as in the file, each keeping
  its ID, so every membership and connector end is kept. It opens at once, as New board's board
  does, and is listed for everyone in the workspace. Importing the same file again makes another,
  independent board. No other board changes.
- **One request, all or nothing.** The tab reads and checks the file with the Board file's own
  reader, then sends one creation request carrying the document. The server checks it again,
  writes the board's row, and starts the board's room **with the document already in it**, at
  revision 0. If the room step fails, the server undoes the creation.
- **Refused with the reason, before anything is made**: a file too large to read, not a Board
  file, damaged, not a valid board (a board over 2 MiB included), made by a newer Board, or holding
  pictures (team boards hold none yet). The reason shows in Home's message place; nothing is
  created.

Saving a copy is unchanged: a team board's file carries no comments and no list of who has access.
The board document, the Board file, the room's storage layout, access, sync and the database schema
are unchanged. With team features off the app looks and works exactly as before.

## Read first and prerequisite contracts

- [Contributor guidance](../../CONTRIBUTING.md), [agent instructions](../../AGENTS.md) and
  [engineering standards](../../DESIGN.md).
- The new contracts above. They define every behaviour this brief asks for:
  - API v5 is the creation request with a document: its shapes, the order of its checks, every
    refusal and status, the 13 MiB body limit on that route, what is stored, and how a failure of
    the room step is undone, with the two gaps it does not close;
  - hosted persistence v5 is how a room starts from a document (the one creation step, the
    `identifiers` rows at revision 0, the `room_exists` refusal) and how a room is discarded;
  - interaction v31 is Import on Home: where it appears, its look as values, the menu, the picker,
    the importing state, the refusal words, the narrow layout, the CSS, keys and focus;
  - web modules v29 is where the web code lives.

  Where this brief and a contract seem to differ, the contract wins; report the difference.
- [API v4](../architecture/0003-api-v4.md) ("Boards"), [hosted persistence
  v3](../architecture/0003-hosted-persistence-v3.md) ("One database per board", "Snapshots") and
  [v4](../architecture/0003-hosted-persistence-v4.md), [interaction
  v28](../architecture/0001-interaction-v28.md) (Home), [hosted storage
  v3](../architecture/0003-hosted-storage-v3.md) ("Creating a board", "Messages") and [board file
  v2](../architecture/0006-board-file-v2.md) ("Reading"), which the new versions build on.
- [The 0003-W5 brief](0003-W5-find-create-and-reopen-boards.md): Home, its people and the W5
  scenario this milestone reruns. [The 0005-W1 brief](0005-W1-discuss-and-resolve-anchored-ideas.md):
  the server suite's `tests/server/shared.test.ts` and its drivers. [The 0003-W4
  brief](0003-W4-sign-in-share-and-see-access.md): the hosted board and the local stack.
  [The 0006-W2 brief](0006-W2-export-and-restore-board-file.md): the Board file, Save a copy to
  file and Open board file.

## Deliverables and boundaries

The base is the main revision that holds this brief, recorded in the implementation record.
Every new source file starts with `// SPDX-License-Identifier: Apache-2.0`. Code follows the
repository's style ([engineering standards](../../DESIGN.md)): readable lines, small modules with
one job each, and comments where a reader needs the reason.

1. **The server and the room** (API v5; hosted persistence v5):
   - `apps/server/src/routes/boards.ts`: the creation route takes `{ title, document }` with the
     13 MiB body limit (through the existing `body(context, limit)` in `routes/common.ts`, which
     does not change), runs API v5's checks in their order, writes the row, asks the room to start
     from the document as stored, and undoes the creation when the room step fails;
   - `apps/server/src/supabase.ts`: one new method that deletes a board's row by its ID, used only
     by that clean-up. Nothing else in the file changes;
   - `apps/server/src/runtime.ts`: `RoomClient` gains `create(document)`; `Runtime` gains
     `removeRoom(board)` (the discard);
   - `apps/server/src/start-node.ts`: the Node runner's `removeRoom` (hosted persistence v5,
     "Discarding a room", Node server);
   - `apps/server/src/worker-room.ts` and `apps/server/src/worker-runtime.ts`: the Cloudflare
     runner's `create` and discard, through the board's Durable Object;
   - `packages/board-room/src/room.ts`: `create(document)`, in the room's order, refusing
     `room_exists` when the storage is already created, and the creation step taking an optional
     document and writing the `identifiers` rows (hosted persistence v5, "How a room is created").

   Nothing else in `apps/server/` or `packages/` changes: the sync, access, storage, backup,
   snapshot, edit and comment modules are used as they are.
2. **The web app** (interaction v31; web modules v29):
   - `apps/web/src/team/import.ts` (new) and `apps/web/src/team/home-import.tsx` (new), each with
     the one job web modules v29 gives it;
   - `apps/web/src/team/home.tsx`: wiring only (web modules v29, "The team modules");
   - `apps/web/style.css`: interaction v31's rules, added at the end; no existing rule changes.

   `App.tsx`, `board-file.ts`, the Board panel, every other team module and every state hook stay
   as they are.
3. **Tests**:
   - `tests/team-import.test.mjs` (new), run by `npm test` without Supabase or a browser. Each
     test imports the module it tests inside the test (dynamic `import()`), so a run against the
     base fails each test by name. It covers:
     - **the reader's refusals** (`team/import.ts`): a file over 72 MiB, not a Board file,
       damaged, not a valid board, and from a newer Board each end with its exact `FILE_REASONS`
       words, and the sending function is never called;
     - **pictures**: a version 1 and a version 2 file holding an image object end with "it holds
       pictures, which team boards can't hold yet", nothing sent;
     - **size**: a file whose document is 2,097,153 canonical bytes ends with "it is not a valid
       board" (the reader's words), nothing sent; a version 1 file whose upgraded document would
       be over 2 MiB ends with the same words, nothing sent;
     - **the body**: a current file sends exactly once, with exactly `{ title, document }`, the
       document equal to the file's (every object, membership, connector end and
       `retiredGenerations`); a file whose document has `schemaVersion` 9 sends a version 10 document
       whose objects equal the file's;
     - **the room** (`packages/board-room/src/room.ts`, on Node's SQLite as `tests/room.test.mjs`
       builds a room): `create` on a new room stores the document at revision 0 (its canonical
       JSON and its board read back equal the document), writes one `identifiers` row per object
       with `first_revision` 0, and a later load reads the same board; `create` on a room an
       ordinary open already created is refused 409 `room_exists` and changes no row of any table;
   - `tests/import-fixture.mjs` (new, not a test file): the synthetic boards the unit and server
     tests share: a rich board (a section holding a group of a sticky, a text with two lines and
     an emoji, and a shape; a connector between the sticky and the shape; a marker drawing; one
     retired generation), a board of exactly a given canonical size (2,097,152 bytes by default),
     and a board holding one image object;
   - `tests/modules.test.mjs`: the team module list and the import rule of web modules v29 (its
     test's name says v29). No other assertion changes;
   - `tests/server/shared.test.ts`: the checks S134–S142 below, added after S133 on both runners,
     with `SUMMARY-SHARED` counting them. No existing check changes;
   - `tests/server/node-test.ts` and `tests/server/worker-test.ts`: one test control,
     `failCreate`, with the values `before` (the room step fails before the room writes anything),
     `write` (the room's snapshot write fails inside its transaction), `after` (the room step fails
     after its transaction committed), `exists` (the room is opened the ordinary way, empty, just
     before the document arrives) and `""` (off). The Node test's room wrapper passes `create`
     through. Nothing else in them changes;
   - `tests/server/setup.ts`: its Supabase proxy gains one control, `failAfter` for an RPC (the
     call reaches Supabase and commits, then the server gets 503), and records the
     `create_board` RPC's reply in its log, so a check can find the board it made. Nothing else in
     it changes;
   - `tests/README.md` lists the new files and checks.
4. **Documentation**: `docs/architecture/README.md` already lists, for 0006-W1 v1, the four
   contracts above and those that stay in force; it does not change.

Outside the named new controls, the existing screens' markup stays exactly as at the base. The
named new controls are, on Home only (team features on): Import board file…, its Import into menu
and its file input. With team features off there is no new control, so the A–J comparison (V12)
adds no mask. Besides items 1 to 4, only this brief's implementation record changes. If the work
seems to need anything outside them, stop and report it.

Nothing else in `apps/server/`, `apps/web/`, `packages/`, `scripts/`, `supabase/`, any
`package.json`, `package-lock.json`, `tests/server/suite.test.ts`, the drivers
(`tests/server/driver-*.ts`), the board document, the Board file, the export or any other existing
test file changes. The test people's email domains stay as they are. No hosted Supabase project,
deployment or real person is used.

## Server checks

Each check runs on both runners (`npm run test:server:node`, `npm run test:server:workerd`)
against the local stack, as 0005-W1's S121–S133 do, with the suite's existing people (`owner`,
`editor`, `viewer`, `granted`, `outsider`) and helpers. "Nothing written" means what is stored
afterwards: the workspace's board rows are as before the request, and no room storage exists for
any new ID. For a refusal answered before the row's write (S135, S136, S141) the proxy's log also
holds no `create_board` call. Each check that needs a board file's document takes it from
`tests/import-fixture.mjs`, imported inside the check.

| ID | Check |
| --- | --- |
| S134 | The owner creates a board with `{ title: "Launch plan", document: <the rich board> }`: 201 with a new ID (not the document's `boardId`); the export is the document's canonical JSON with `boardId` replaced by the new ID; the original board's export is unchanged; the workspace's list shows the new board with its title to an editor; a join gets revision 0 and that board; the room's `identifiers` hold one row per object (`object_id`, `generation`, `first_revision` 0) and `meta` holds `storage_version` 3, `revision` 0 and the board's ID. After the room is evicted and opened again, the same revision, board and rows. It prints `EVIDENCE-S134` with the rows |
| S135 | Each of these answers 400 with its reason and writes nothing: `document` `{}` (`invalid_document`); a valid document of `schemaVersion` 9 (`invalid_document`); a document of 2,097,153 canonical bytes (`document_too_large`); a 2,097,152-byte document whose title is shorter than the request's 120-character title (`document_too_large`, from the document as stored); a document holding an image object (`images_not_supported`); `{ title, document, extra: true }` and `{ document }` without a title (`bad_request`). A body of 13,631,489 bytes answers 413 `body_too_large`, and one of 13,631,488 bytes is read (it answers 400, not 413) |
| S136 | With a document, the workspace viewer and the `granted` person (a guest with an editor grant on one of its boards) get 403 `role_too_low` with `needed` `editor`; the `outsider` gets 404 `not_found`; nothing is written |
| S137 | With the control `failCreate` set to `before`, then `write`, then `after`, the owner's creation with a document answers 503 `service_unavailable`, and afterwards no row exists for the ID the proxy's log shows and every room table (`meta`, `snapshot_chunks`, `identifiers`, `edits`, `threads`, `comments`) is empty for it. With `exists`, it answers 409 `room_exists` with the same result. With the proxy failing `create_board` before it reaches Supabase, it answers 503 and writes nothing. Each stage prints `EVIDENCE-S137` |
| S138 | A board created from a document of stickies: deleting one sticky, then adding a sticky with the deleted one's ID, is refused `identifier_reused` and nothing is saved. It prints `EVIDENCE-S138` |
| S139 | The operator backup of a board created from the rich board holds one `identifiers` row per object and empty `threads` and `comments`; after a later edit, restoring that backup brings the export back to the imported document and a join to revision 0 with no threads, and the `identifiers` rows equal the backup's |
| S140 | A document of exactly 2,097,152 canonical bytes is created (201, by the editor) and exported equal to it with the new ID; one of 2,097,153 bytes answers 400. It prints `MEASURE-S140` with the canonical bytes, the request's bytes, the object count and the creation's time |
| S141 | With a document, the titles `""`, `" "`, 121 characters and one holding U+0000 each answer 400 `bad_request` and write nothing; `{ title: "Chosen title", document }` whose document's title is "Launch plan" is created and its export's title is "Chosen title" |
| S142 | The gap API v5 keeps: with the proxy's `failAfter` on `create_board`, the creation with a document answers 503, the row for the ID in the proxy's log exists, and the room has no snapshot. It prints `FINDING-S142` and then deletes that row |

## Browser checks

The scenario runs in Chrome against the local stack as the 0003-W4 brief sets it up. Supabase
comes from this repository's `supabase/config.toml`, and the Node runner from
`npm run build:server`, with `allowedOrigin` set to the page's origin. A team-on build is served
on that origin. Pages are 1280 × 800 unless a check names another size, with page key events.
Files are chosen through the page's file input (Playwright's file chooser), never an operating
system dialog; downloads are read from the browser's download.

The synthetic people, each in their own browser context, are:
- **Ana**, owner of the workspaces Acme and Studio;
- **Ben**, an Acme editor (Acme is the only workspace he can create in);
- **Chen**, an Acme viewer;
- **Dee**, a guest in Acme with an editor grant on one Acme board;
- **Eli**, signed in, with no role anywhere.

Acme holds the board **Launch plan** with the rich board's objects (a section "Release" holding a
group of the sticky "Customer interviews", a two-line text and a shape; a connector from the
sticky to the shape; a marker drawing) and one comment thread; Studio holds one board. The check
makes the files it needs: **Launch plan.nextboard** (X1-S6), **Mood photos.nextboard** (a local
board with one picture, saved with Save a copy to file), one file for each reader refusal, and files
whose documents are 2,097,152 and 2,097,153 canonical bytes. Each check prints
`PASS: X1-S<n> <name>` or `FAIL: X1-S<n> <name>`. The tool is
`tools/browser-compare/0006-w1-check.mjs` in the private repository. The check run keeps its
order, may adjust steps and keeps each check's meaning. "Nothing created" means the workspace's
list (read through the API) is as before; for a refusal in the tab (X1-S4, X1-S12–S18) the page
also sent no creation request, and for X1-S19 it sent exactly one, which was refused or got no
answer.

| ID | Check |
| --- | --- |
| X1-S1 | Ana imports Launch plan.nextboard on Acme's page: the page sends exactly one `POST /workspaces/<Acme>/boards`, whose body's keys are exactly `title` and `document`, with the file's title and its document |
| X1-S2 | On Ana's Recents (two workspaces she can create in): Import board file… is before New board, with every value of interaction v31's "The button" and "Where Import board file… appears" (x 958, y 12, 166 × 40; New board x 1132, 116 × 40); Tab from Boards in this browser reaches Import, then New board. Import has `aria-haspopup="menu"` and opens Import into at x 916, y 58 with the label and the items Acme, Studio, with the menu's values. Compared beside the approved import screen |
| X1-S3 | While Ana's import request is held: Import reads "Importing…", Import and New board are unavailable (opacity 0.45), and the toast says "Importing “Launch plan.nextboard”…" with `role="status"` and the toast's values. Compared beside the approved importing screen |
| X1-S4 | Ana imports Mood photos.nextboard on Acme's page: the toast says "Couldn't import “Mood photos.nextboard”: it holds pictures, which team boards can't hold yet."; Import and New board are available again; nothing created. Compared beside the approved refused screen |
| X1-S5 | At 375 × 812 on Ana's Acme page: Import is 40 × 40 with no words shown, its icon centred, named and titled "Import board file…"; Import x 199 and New board x 247, 116 wide, both y 12 and on one line; the page name ends in an ellipsis. Compared beside the approved narrow screen |
| X1-S6 | Ana, on Launch plan, uses Save a copy to file: the downloaded file is a Board file version 2 whose document holds every object, membership and connector end of the board, and no comment and no access list; opening it with Open board file on a local board shows every object |
| X1-S7 | Chen (viewer) uses Save a copy to file on Launch plan: the download's document equals Ana's (X1-S6) |
| X1-S8 | Ana imports Launch plan.nextboard on Acme's page: a board with a new ID opens in this tab (`#/b/<new id>`); its export equals the file's document with that ID, so every object, section and group membership and connector end is as in the file; the original Launch plan's export is unchanged; Acme's list shows both |
| X1-S9 | Ben (editor) sees the imported board on Acme's page and opens it; Ben imports the same file and gets another new board |
| X1-S10 | Ana imports the same file twice: two new boards with different IDs; a sticky moved on one is not moved on the other |
| X1-S11 | On Ana's Acme page and on Ben's Recents, Import has no `aria-haspopup` and opens the file picker at once, with no menu; Ben's import goes to Acme |
| X1-S12 | A file over 72 MiB: "Couldn't import “<file>”: it is larger than 72 MiB."; nothing created |
| X1-S13 | A file that is not a Board file: "…: it is not a Board file."; nothing created |
| X1-S14 | A damaged file (its checksum does not match): "…: it is damaged."; nothing created |
| X1-S15 | A file whose document is not a valid board: "…: it is not a valid board."; nothing created |
| X1-S16 | A file from a newer Board (`fileVersion` 3): "…: it was made by a newer version of Board."; nothing created |
| X1-S17 | Mood photos.nextboard on Recents for Acme: the pictures refusal; nothing created |
| X1-S18 | The file of 2,097,153 canonical bytes: "Couldn't import “<file>”: it is not a valid board."; nothing created |
| X1-S19 | The creation request aborted by the test (no answer): "Couldn't import “Launch plan.nextboard”: no answer."; nothing created. Ben's Home is open when Ana makes him an Acme viewer; Ben imports: "Couldn't import “Launch plan.nextboard”: role too low."; nothing created |
| X1-S20 | Chen and Dee see no Import on Recents or on Acme's page; a creation request with a document from each answers 403; nothing created |
| X1-S21 | Eli sees no Import; a creation request with a document for Acme answers 404; nothing created |
| X1-S22 | Ana's import request is held for 6 seconds: "Importing …" stays past 5 seconds with both buttons unavailable; Copy link on a card meanwhile does not replace it, and "Link copied" does not appear after the import ends |
| X1-S23 | Closing the picker without a file sends nothing, shows no toast and leaves focus on Import; after X1-S4's refusal, focus is on Import |
| X1-S24 | A refusal's toast is gone 5 seconds after it appears; then New board's own refusal (the test refuses its request) shows in the same place, and a later "Link copied" replaces it |
| X1-S25 | Ana imports the file of 2,097,152 canonical bytes: the board opens and its export equals the file's document with the new ID. It prints the file's bytes, the object count, and the read, request and end-to-end times |

**The 0003-W5 checks, amended.** For V13, W5-S37's Tab order reads "the account, Recents, each
workspace, Boards in this browser, Import board file…, New board, the sort button, then the cards
in reading order" (interaction v31, "Keyboard and focus on Home"). The check tool's helper that
opens a workspace page waits for the page's heading, which is "Workspace" for someone who cannot
see the workspace (interaction v28, "The main area"), not for its name; W5-S11 used to time out
there on the base as well. Every other W5 check is as the 0003-W5 brief states.

## Numbered acceptance criteria

- 0006-W1-AC01: From a team board, anyone with a role, viewers included, saves a copy to a Board file (board file v2) holding the board as it shows: every object, its section and group membership and every connector reference, with no comments and no list of who has access. The file opens as a local board.
- 0006-W1-AC02: A workspace owner or editor imports a Board file from Home. It becomes a new team board in that workspace with a new ID, the file's title and every object, membership and connector reference as in the file (object IDs kept). It opens for them and appears in the workspace's list for everyone with access; no other board changes. Importing the same file again makes another board.
- 0006-W1-AC03: A file that is too large, not a Board file, damaged, not a valid board, made by a newer Board, holding pictures, or over a team board's 2 MiB is refused with its reason before anything is created; nothing is created or changed on any refusal or any failure the server sees, except the two gaps API v5 names: a lost database answer after the board's row is saved may leave an empty board with the file's title, as New board can; and a clean-up that itself fails (503 `creation_cleanup_failed`) may leave the board's row, its room or both. A board over 2 MiB is refused with the reader's "it is not a valid board". Someone who may not create boards in a workspace is offered no import there, and the server refuses theirs.

| Criterion | Evidence that shows it |
| --- | --- |
| 0006-W1-AC01 | X1-S6, X1-S7 |
| 0006-W1-AC02 | X1-S1–S3, X1-S5, X1-S8–S11, X1-S25; S134, S138–S141; the body and room tests in `tests/team-import.test.mjs` |
| 0006-W1-AC03 | X1-S4, X1-S12–S24; S135–S137, S140, S142; the refusal, picture and size tests in `tests/team-import.test.mjs` |

## Validation commands and expected evidence

From the repository root with Node 26.13.0 and npm 11.20.0:

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm run typecheck
npm test
BOARD_TEAM_FEATURES=off BOARD_SUPABASE_URL=http://127.0.0.1:55321 BOARD_SUPABASE_ANON_KEY=synthetic BOARD_SERVER_URL=http://127.0.0.1:8796 npm run build
npm run audit:licenses
npm run build:fixtures
BOARD_TEAM_FEATURES=on BOARD_SUPABASE_URL=http://127.0.0.1:55321 BOARD_SUPABASE_ANON_KEY=synthetic BOARD_SERVER_URL=http://127.0.0.1:8796 npm run build
npm run audit:licenses
npm run build:server
npm run audit:licenses
npx wrangler deploy --dry-run --outdir <scratch folder> -c apps/server/wrangler.json
git diff --name-status <base>..<validated>
```

The server suite needs the local stack:

```sh
node tests/server/make-signing-key.mjs
npx supabase start
node tests/server/write-stack-info.mjs
npm run test:server:node
npm run test:server:workerd
npx supabase stop
```

Copy `apps/web/dist` aside after each web build, since the next one replaces it. Files git
ignores in a build's output (for example esbuild's `meta.json`) never count as a change.

| Check | Pass condition |
| --- | --- |
| V1 | `package-lock.json` and every `package.json` are byte-identical to the base's |
| V2 | `npm ci` exits 0 |
| V3 | `npm run typecheck` exits 0 for all five members |
| V4 | `npm test` passes with 0 failed; every base test file passes unchanged except the change item 3 names in `tests/modules.test.mjs`; `tests/team-import.test.mjs` is the only new test file |
| V5 | The off build (with the three settings set) exits 0; its `index.html` and `THIRD_PARTY_NOTICES.txt` are byte-identical to the base build's; its `meta.json` has no input under `node_modules/@supabase/` or `apps/web/src/team/`; `audit:licenses` exits 0 |
| V6 | `build:fixtures` exits 0; the on build exits 0, its `index.html` is byte-identical to the base's on build, and its notices are runtime notices v3 byte for byte; `audit:licenses` exits 0 |
| V7 | `build:server` and the Worker dry run exit 0, and `audit:licenses` exits 0 |
| V8 | `git diff --name-status <base>..<validated>` shows only files of items 1 to 3 (this brief changes only by its implementation record, in a later commit) |
| V9 | X1-S1–S25 pass on the candidate's team-on build |
| V10 | The new checks fail on the base (REC-019). On a fresh local stack started from a checkout of the base (never a stack the candidate used), with the base's team-on build served the same way, every one of X1-S1–S5, X1-S8–S19 and X1-S22–S25 fails; X1-S6 and X1-S7 (Save a copy to file, which the base has) and X1-S20 and X1-S21 (no import for people who cannot create, which the base already meets) pass on both. `tests/team-import.test.mjs` run against the base fails each of its tests by name. S134, S135 and S137–S142 fail on the base's server suite; S136 (refusals the base already gives) passes on both. A check that fails because a control, module, route or answer it asserts is missing counts as failing |
| V11 | `test:server:node`: S1–S50, S55–S76, S77–S93 and S94–S142 pass. `test:server:workerd`: S1–S36, S38–S42, S44–S50, S55–S69, S71–S76, S77–S93 and S94–S142 pass (S37, S43 and S70 are Node only). Every summary line has `"fail": 0` |
| V12 | The A–J comparison of the off build against the base's build shows no difference at any checkpoint (markup, focus, canvas drawing and saved records), with only the comparison's existing normalization of a local board's saved-time text. No other mask |
| V13 | The 0003-W5 brief's checks W5-S1–S39 and W5-S41–S45, with W5-S37 amended and the helper fixed as above, pass on the candidate's team-on build, and W5-S40 on its team-off build, set up as that brief says. A check that fails is run once more on its own on a fresh stack; both results are reported |

**Who runs what.** The implementer runs V1–V8 and records them. Browsers cannot start there, and
the Supabase stack is not needed for them. The reviewer's check run repeats V1–V8 on a clean
clone and runs V9–V13. Each is reported as one `PASS: V<n>` or `FAIL: V<n>` line, with the
scenario's X1 and W5 lines and the server suite's S lines and summary lines kept as evidence.

Regression runs accepted by the maintainer:
- the full unit suite (V4);
- the server suite on both runners (V11);
- the A–J comparison with team features off (V12);
- the 0003-W5 checks with W5-S37 amended (V13).

No hosted project, deployment, browser matrix, accessibility audit, load test, physical keyboard
or screen-reader session unless the maintainer asks. X1-S25's and S140's times are one local
sample each, not targets.

## Exclusions and reasons

- **Pictures on team boards**: a file with pictures is refused, not imported without them; team
  boards need a hosted picture store first.
- **Comments and access in a file**: a Board file carries neither, and an imported board starts
  with none.
- **Replacing an existing team board's content, and version history**: a later Story of the same
  feature.
- **Moving a local board to a workspace without a file, and dropping a file onto Home**: later
  additions on top of this import.
- **A setting that stops viewers saving copies**.
- **Other products' file formats; image, PDF and CSV export.**
- **Closing API v5's two gaps** (a lost database answer, a failed clean-up): it needs a board row
  hidden until its room is filled, a database schema change.
- **Measured scale or latency targets.**

## Public references with retrieval dates

Retrieved 2026-11-04:
- [MDN: `<input type="file">`](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input/file)
  (the `accept` attribute and the `cancel` event when the picker closes without a file)
- [Cloudflare: Durable Object Storage `deleteAll()`](https://developers.cloudflare.com/durable-objects/api/storage-api/)

## Implementation record

(Appended by the implementer.)

### v1 implementation — 2026-11-05

- Branch: `codex/0006-W1-export-and-restore-a-portable-board`, in the milestone's
  designated worktree, from committed main
  `e9779e588448b673d5857f65037056f345dec3dc` (base).
- Validated source/test revision: `c84f006674561811db7a09ff1478e395d35dcc5b`.
  The later implementation-record commit changes only this section; the final
  branch tip is reported separately in the handoff.
- Implemented API v5's ordered checks, creation with a document, both cleanup
  attempts and cleanup failure reporting; revision-zero room snapshots and
  identifiers; Node and Durable Object discards; and interaction v31's Home
  button, menu, picker, shared creation lock, persistent progress, refusals,
  toast priority and focus. The CSS is appended verbatim from interaction v31.
  The approved design amendment's 16 × 16 icon and reader size-refusal words
  are used. The existing export and local file paths are unchanged.
- Added the shared synthetic fixture and 13 unit tests, updated the v29 module
  guard, and appended S134–S142 with the specified test-only failure controls.
  No dependency was added or changed; all manifests and the lock are unchanged.

Validation used Node **26.13.0**, npm **11.20.0** and the accepted dependencies.
The pinned Node/npm installation was selected on `PATH`. The following shell
settings were used for the checks below. `BOARD_W1_CHECK` was set to disposable
evidence storage outside the checkout, not a shipped input; its machine-specific
location is omitted here. The base commands below use that variable for the
same evidence directory.

```sh
export BOARD_SUPABASE_URL=http://127.0.0.1:55321
export BOARD_SUPABASE_ANON_KEY=synthetic
export BOARD_SERVER_URL=http://127.0.0.1:8796
```

The base was extracted with `git archive` into disposable storage and installed
and built there with the same settings. Each build was copied aside before the
next build replaced it:

```sh
mkdir -p "$BOARD_W1_CHECK/base"
git archive e9779e588448b673d5857f65037056f345dec3dc | tar -x -C "$BOARD_W1_CHECK/base"
# From the extracted base:
npm ci --ignore-scripts --no-audit --no-fund
BOARD_TEAM_FEATURES=off npm run build
cp -R apps/web/dist "$BOARD_W1_CHECK/base-off"
BOARD_TEAM_FEATURES=on npm run build
cp -R apps/web/dist "$BOARD_W1_CHECK/base-on"
```

All base preparation commands exited 0. Candidate commands, from the worktree
root, and their results:

| Check | Exact commands and result |
| --- | --- |
| V1 | `git diff --exit-code e9779e588448b673d5857f65037056f345dec3dc c84f006674561811db7a09ff1478e395d35dcc5b -- package.json package-lock.json ':(glob)**/package.json'` exited 0 with no diff. A byte comparison of every base manifest and the lock against `git show <base>:<path>` also passed. |
| V2 | `npm ci --ignore-scripts --no-audit --no-fund` exited 0. |
| V3 | `npm run typecheck` exited 0 for web, server, board-rules, board-room and board-sync. |
| V4 | `npm test` exited 0: **876 tests, 876 passed, 0 failed, 0 skipped**. `git diff --name-status e9779e588448b673d5857f65037056f345dec3dc..c84f006674561811db7a09ff1478e395d35dcc5b -- 'tests/*.test.mjs'` showed only modified `tests/modules.test.mjs` and added `tests/team-import.test.mjs`; all other base unit test files are unchanged. The module guard changes only its version, module list and import rule. |
| V5 | The off-build commands below all exited 0. Index and notices were byte-identical to the base off build; its metadata had no team or Supabase inputs. |
| V6 | The fixture/on-build commands below all exited 0. Index was byte-identical to the base on build; notices were runtime notices v3 byte for byte. |
| V7 | The server-build, license-audit and Worker dry-run commands below all exited 0. Wrangler 4.156.0 reported `--dry-run: exiting now.` No deployment occurred. |
| V8 | `git diff --name-status e9779e588448b673d5857f65037056f345dec3dc..c84f006674561811db7a09ff1478e395d35dcc5b` exited 0 and showed exactly the 19 allowed source/test/documentation files in items 1–3, including the four new files. No brief change is in that revision. |

V5 commands:

```sh
BOARD_TEAM_FEATURES=off npm run build
cp -R apps/web/dist "$BOARD_W1_CHECK/candidate-off"
cmp apps/web/dist/index.html "$BOARD_W1_CHECK/base-off/index.html"
cmp apps/web/dist/THIRD_PARTY_NOTICES.txt "$BOARD_W1_CHECK/base-off/THIRD_PARTY_NOTICES.txt"
node --input-type=module -e 'import fs from "node:fs"; const m=JSON.parse(fs.readFileSync("apps/web/dist/meta.json")); if (Object.keys(m.inputs).some(p=>p.includes("node_modules/@supabase/")||p.includes("apps/web/src/team/"))) throw Error("Team input in off build");'
npm run audit:licenses
```

V6 commands:

```sh
npm run build:fixtures
BOARD_TEAM_FEATURES=on npm run build
cp -R apps/web/dist "$BOARD_W1_CHECK/candidate-on"
cmp apps/web/dist/index.html "$BOARD_W1_CHECK/base-on/index.html"
cmp apps/web/dist/THIRD_PARTY_NOTICES.txt docs/architecture/0001-runtime-notices-v3.txt
npm run audit:licenses
```

V7 commands:

```sh
npm run build:server
npm run audit:licenses
WRANGLER_SEND_METRICS=false WRANGLER_LOG_PATH="$BOARD_W1_CHECK/wrangler-logs" npx wrangler deploy --dry-run --outdir "$BOARD_W1_CHECK/worker-dry-run" -c apps/server/wrangler.json
```

Each command's output was captured under `BOARD_W1_CHECK`: `ci.log`,
`typecheck.log`, `unit.log`, `off-build.log`, `off-audit.log`,
`fixtures-build.log`, `on-build.log`, `on-audit.log`, `server-build.log`,
`server-audit.log`, `worker-dry-run.log` and `scope.log`. The validation runner
exited 0 and emitted:

```text
PASS: V1
PASS: V2
PASS: V3
PASS: V4
PASS: V5
PASS: V6
PASS: V7
PASS: V8
```

Before the validated commit, a focused `node --test tests/team-import.test.mjs`
run exposed fixture errors (connector section membership, oversized text fields,
and SQLite row prototypes), which were corrected. An initial typecheck exposed
that React's declarations do not provide the file input's `onCancel` prop; the
input now listens for the native `cancel` event. An initial full unit run had one
module-list ordering failure, corrected before the final run above. These were
new implementation/test failures, not base failures. No failing check remains
within V1–V8.

Exclusions: **V9–V13 were not run**. This includes the X1 browser checks, base
negative controls, both Supabase-backed server suites (S134–S142 included), the
A–J comparison and the amended W5 scenario. They remain for the review's check
run; no visual/runtime acceptance is claimed from the builds or unit tests.
No browser or Supabase CLI was started, no hosted project was used, and no push,
merge or publication was performed. API v5's lost-database-answer and failed-cleanup
gaps remain as specified.

The graph tools were unavailable because they required approval under a session
policy that disallows approval; discovery used direct reads and searches.
Both mandatory boundary hooks passed on the implementation commit. Git emitted
a non-fatal packed-refs lock permission warning, but the successful commit and
its exact branch tip were verified. Hooks were not bypassed and no stash was used.

### Fix round 1 — 2026-11-05

- Branch: `codex/0006-W1-export-and-restore-a-portable-board`, continuing from
  `15a6ff2384c443218d029a08054ba7845e6410b7`.
- Finding F1 (Minor, test defect): `workspaceRows` returned board rows in database
  order. The review's workerd S140 run compared the same three rows in a different
  order when `created_at` values tied within a millisecond window, causing a false
  failure in a "nothing was written" comparison.
- Change: `tests/server/shared.test.ts` now awaits the rows and sorts them by
  string `id` with `localeCompare` before returning them. Every row and every
  assertion is preserved; no check's meaning or production code changed.
- Validated source/test revision (fix commit):
  `af8eb5d821a6cbf0200de7158a9959e8634f74bc`
  (`test(server): compare workspace rows in a stable order`). The subsequent
  record commit changes only this implementation record; the final branch tip
  is reported separately in the handoff.
- Validation used Node **26.13.0** and npm **11.20.0**, selected on `PATH`:
  - `npm run typecheck` exited 0 for all five workspace members.
  - `npm test` exited 0: **876 tests, 876 passed, 0 failed, 0 skipped**.
  - `git diff --check` exited 0 before the fix commit. The fix diff contains only
    the `workspaceRows` ordering change. The record diff was inspected; no links
    were added or changed, and application tests were not rerun for this documentation.
- Exclusions: no browser checks, Supabase CLI, Supabase-backed Node/workerd server
  suites, builds or other acceptance checks were run in this fix round. The
  workerd S140 rerun remains for review; the unit run does not claim that evidence.
- Dependencies: none added or changed. No stash, hook bypass, push, merge or
  publication. Both boundary hooks passed on the fix commit. Git emitted a
  non-fatal packed-refs lock permission warning; the successful commit and its
  exact revision were verified.
