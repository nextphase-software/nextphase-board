BRIEF VERSION: 0003-W3 v1 (2026-10-30)
# 0003-W3 — Discover and reopen workspace boards

Status: Draft. Implementation starts only after the maintainer commits this brief and its
contracts to main: [0003 API v2](../architecture/0003-api-v2.md),
[0003 access v2](../architecture/0003-access-v2.md) and
[0003 hosted persistence v2](../architecture/0003-hosted-persistence-v2.md). Unchanged and still
in force: [0003 identity v1](../architecture/0003-identity-v1.md),
[0003 sync v1](../architecture/0003-sync-v1.md),
[0003 self-host runner v1](../architecture/0003-self-host-runner-v1.md),
[0001 document v11](../architecture/0001-document-v11.md),
[0001 toolchain v4](../architecture/0001-toolchain-v4.md) with its lock, inventory and notices,
and [0001 web modules v24](../architecture/0001-web-modules-v24.md).

## Outcome

Board's server can now say which boards a person can find again. It lists the workspaces a
person belongs to, the boards in a workspace on which they have a role, and the boards they
opened most recently, each with their role, the board's name and when it was last edited. An
editor can rename a board, and a new board can be created without a name ("Untitled"). A board
on which a person has no role never appears in any of their lists.

A board's name lives in one place, its saved document. The board's room copies the saved name
and the time of the last saved edit to the board's row in Supabase, where the lists read them.
That copy never slows down, refuses or undoes a save: if Supabase is slow or down, edits are
saved exactly as before and the lists catch up later. After a restore the lists show the
restored board as it was.

Nothing is deployed and the web app does not change; a later milestone adds the screen that
uses these lists.

## Read first and prerequisite contracts

- [Contributor guidance](../../CONTRIBUTING.md), [agent instructions](../../AGENTS.md) and
  [engineering standards](../../DESIGN.md).
- The three v2 contracts above: they define every behaviour this brief asks for. Where this
  brief and a contract seem to differ, the contract wins; report the difference.
- [The 0003-W1 v1 brief](0003-W1-owner-editor-viewer-access.md): the server, the room, the local
  Supabase stack, the shared server suite S1–S54 and its six identities, which this milestone
  extends.
- [0001 web modules v24](../architecture/0001-web-modules-v24.md), rules 9 to 11: the room
  reaches Supabase, time and background work only through interfaces it defines; `worker.ts`
  and `node.ts` hold no test switch.

## Deliverables and boundaries

The base is the main revision that holds this brief, recorded in the implementation record.
Every new source file starts with the line `// SPDX-License-Identifier: Apache-2.0` (or
`-- SPDX-License-Identifier: Apache-2.0` in SQL). Code follows the repository's style
([engineering standards](../../DESIGN.md)): readable lines, small modules with one job each,
and comments where a reader needs the reason. No dependency is added or changed.

1. **The schema.** In `apps/server/supabase/nextphase_board.sql`, still plain SQL that runs
   again without error on a stack where it already ran (this or the base version):
   - `boards` gains `edited_at timestamptz NOT NULL` (existing rows take `created_at`; new rows
     default to the creation time), `document_generation bigint NOT NULL DEFAULT 0` and
     `document_revision bigint NOT NULL DEFAULT 0`;
   - the `board_opens` table of the access contract, primary key (`person_id`, `board_id`),
     removed with its board, with row-level security and the row rule "own rows";
   - indexes for each list order: (`workspace_id`, `edited_at`, `id`), (`workspace_id`,
     `created_at`, `id`), (`workspace_id`, the title order key of API v2, `title COLLATE "C"`,
     `id`) and `board_opens` (`person_id`, `opened_at DESC`, `board_id DESC`);
   - the functions `record_board_open`, `copy_saved_board`, `list_workspaces`, `list_boards` and
     `list_recent_boards` of the access contract, `SECURITY DEFINER` with an empty
     `search_path`, executable only by the service role, each list working out roles with
     `board_role`.
2. **The room.** In `packages/board-room/`:
   - a new module `src/copies.ts` that decides, from the room's saved state and `meta.copied`,
     whether to copy and what (the rules under "Names and edited times in lists" in hosted
     persistence v2: a changed name at once, the time at most once per 60 seconds, everything
     after a restore), keeps at most one copy in flight, folds later saves into the next copy,
     stores `meta.copied` only after success, and tells the room when its alarm is needed for a
     waiting time;
   - `src/interfaces.ts`: the room's environment gains an interface for the board rows (copy a
     saved state; record an open) and one for background work (a task the runner keeps alive
     without the room waiting for it). Both are optional, so a room without them behaves as in
     0003-W1;
   - `src/room.ts`: `meta.last_edit_at` set to the board's creation time when the room is
     created (and read as the creation time when a room created before this milestone lacks it);
     a copy started after every saved edit (once `saved` and `update` are sent), after a load,
     after replay unlocks a restored room, and on the alarm; recording an open after a join
     ticket is stored, without waiting and ignoring its failure; and `rename(person, title)`,
     which saves the title change as one edit through the existing edit path (a Yjs update
     setting the board map's `title`, validated by the document rules and `checkTransition`,
     with a server-made request ID and the person's current epoch, a receipt, and the `update`
     broadcast), answering with the new revision, or with the current revision and no edit when
     the title is unchanged;
   - the Node runner's handling of a room marked by `mark-restored-volume.mjs`: before replay,
     raise its fence above both its stored fence and the board row's `document_generation`; if
     Supabase cannot answer, stay locked (hosted persistence v2).

   The room may decide on a copy or an open record while it handles a message, but the call to
   Supabase is never awaited inside the room's order of messages or inside an edit's storage
   transaction, and a copy never starts before the edit's `saved` reply is sent. A thrown error
   or rejected promise from either is caught where it starts and changes nothing the room has
   saved or sent.
3. **The server.** In `apps/server/`:
   - routes for `GET /workspaces`, `GET /workspaces/:workspace/boards`, `GET /recent-boards` and
     `PATCH /boards/:board` as API v2 says, in a new handler module (for example
     `src/routes/lists.ts`); the creation route accepts `{}` and an absent title as API v2 says;
     `PATCH` added to the allowed CORS methods;
   - `src/cursor.ts`: encoding and checking the cursor of API v2;
   - `src/supabase.ts`: the calls to the new SQL functions, and the board-rows interface the room
     uses;
   - the Cloudflare runner gives the room the Durable Object state's `waitUntil` as its
     background interface (it keeps the object from being evicted until the task settles, for up
     to 15 minutes); the Node runner keeps a set of tasks in flight and waits for them before it
     stops.

   `worker.ts` and `node.ts` still contain no test switch, clock control or fault injection.
4. **Tests.**
   - `tests/server/lists.test.ts`: the checks S55–S76 below, run by the same two commands as
     the shared suite (add it to `include` in `vitest.node.config.ts` and
     `vitest.workerd.config.ts`); each prints `PASS: S<n> <name>` or `FAIL: S<n> <name>`, and the
     file ends with one JSON line `SUMMARY-LISTS {"runner", "checks", "pass", "fail",
     "measures"}`. With `BOARD_TEST_TARGET=docker` the file skips all its checks and prints
     nothing, so the container run stays S51–S54 as in 0003-W1.
   - `tests/server/suite.test.ts`: only two changes. S6 also covers the four new routes. S48
     expects the nine tables of access v2 (including `board_opens`) instead of eight, and also
     checks that an authenticated person cannot execute the five new functions; its other
     assertions stay as they are.
   - `tests/server/setup.ts`: the proxy in front of the stack can, on the test's request, fail
     calls to a named SQL function with 503 or delay them by a given number of milliseconds,
     and keeps a log of which functions were called and when; it also creates the six identities
     and the workspace of `lists.test.ts` (see "Server checks"). `worker-test.ts`, `node-test.ts` and
     the drivers gain only the controls the checks need (the injected clock already exists).
   - `tests/lists.test.mjs`: unit tests for the cursor (round trip, every refusal of API v2), the
     title order key, and the copy decision of `src/copies.ts` (first copy, name change within 60
     seconds, time after 60 seconds, restore, a failed copy stores nothing).
   - `tests/README.md` lists the new file.
5. **Documentation.** `docs/architecture/README.md` lists the three v2 contracts as the ones in
   force for the server; `apps/server/README.md` links API v2 instead of API v1 and changes
   nowhere else.

Outside the named new controls, the existing screens' markup stays exactly as at the base: the
reviewer's A–J comparison allows only the masks listed under validation. This milestone adds no
control and does not change the web app, so nothing on screen changes; V5's byte comparison of
the web build stands in for A–J.

If the work seems to need anything outside items 1 to 5, stop and report it. Nothing in
`apps/web/`, `package-lock.json`, any `package.json`, the toolchain, the sync or identity
contracts, or the saved document format changes.

## Server checks

Each check runs on both runners (`npm run test:server:node`, `npm run test:server:workerd`)
against the local stack, with the six identities of 0003-W1 (owner, editor, viewer, granted
guest with an `editor` grant on board A only, plain guest, outsider) and boards A and B in one
workspace. "Within a few seconds" means the check polls for at most 5 seconds. "Refused with R"
means the reply carries reason R.

`lists.test.ts` uses six identities of its own, made by `setup.ts` in the same way and with the
same roles as 0003-W1's six (its own owner, editor, viewer, granted guest, plain guest and
outsider, independent accounts), in a workspace of its own with its own boards A and B. 0003-W1's
checks never use them, so whole-list checks see only what this file did; a check that needs a
clean list (S55, S57, S72) deletes that identity's `board_opens` rows with the service key first.

**Lists and their access**

| ID | Check |
| --- | --- |
| S55 | `GET /workspaces`: owner, editor and viewer see the workspace with their workspace role; the granted guest sees it with role `guest`; the plain guest and the outsider do not see it (the outsider sees only a second workspace they own); rows are ordered by name then ID |
| S56 | `GET /workspaces/:workspace/boards`: owner, editor and viewer get A and B with their role; the granted guest gets only A, with role `editor`; the plain guest, the outsider and a made-up workspace ID get 404 `not_found`; each row has exactly the fields of API v2 |
| S57 | `GET /recent-boards`: after each identity is issued a ticket for every board it may open, each sees exactly those boards, with `workspaceName`, newest first; the plain guest and the outsider get an empty list |
| S58 | Create: `{}` gives a board titled `Untitled`; `{ "title" }` keeps the title; `{ "title": null }`, an extra key, an array, a missing body: 400 `bad_request`; owner and editor 201; viewer and granted guest 403 `role_too_low` (`needed` `editor`); plain guest and outsider 404 |
| S59 | Rename: owner and editor 200 on A and B; the granted guest 200 on A and 404 on B; the viewer 403 `role_too_low` (`needed` `editor`); plain guest and outsider 404; a title of 121 characters, only spaces, `null`, holding U+0000, or an extra key: 400 `bad_request` (creation refuses U+0000 the same way); on a board near the 2 MiB limit, a rename that would pass it: 413 `document_too_large`, with the revision unchanged and nothing broadcast |
| S60 | Every new route refuses each bad token of S2–S4 with 401 before any lookup (also covered by S6) |

**One name, copied from the saved document**

| ID | Check |
| --- | --- |
| S61 | A rename answers only after it is saved: its `revision` is the previous revision plus one; a connected editor receives an `update` that sets the title; export and board details show the new name (details within a few seconds); both lists show it within a few seconds. Renaming to the same title answers the current revision and saves nothing |
| S62 | A title change sent as an ordinary edit over the room connection (as the web app does) reaches board details and both lists within a few seconds |
| S63 | A viewer's refused title edit changes neither the row's title nor its `edited_at`; neither does an edit that is refused for any other reason. A title holding U+0000 saved by an ordinary edit is copied with U+FFFD in its place, and the board's export keeps U+0000 |
| S64 | Edited time, with the injected clock, on a new board: wait until the proxy's log shows the room's first `copy_saved_board` call (made when the room first loads) and the row is unchanged by it apart from `edited_at`, then advance the clock 60 seconds. The first edit's time is copied; a second edit 10 seconds later does not change `edited_at`; when the clock passes 60 seconds after the first edit's copy, the room's alarm copies the second edit's time with no further edit; a name change within those 60 seconds is copied at once and leaves `edited_at` as it was. With copies failing, the alarm tries again 60 seconds after a failure |
| S65 | With every call to `copy_saved_board` failing (503 from the proxy), edits are saved and acknowledged with the same messages as without the failure, and the row does not change; once calls succeed again, the next save or alarm brings the row up to date |
| S66 | With calls to `copy_saved_board` delayed by 1,000 ms, ten edits in a row are each acknowledged within 200 ms of being sent (the largest time is recorded in `measures` as `ackMsWhileCopySlow`), and the row ends with the last saved name |
| S67 | `copy_saved_board` called directly with an older (generation, revision) than the row holds changes nothing; with the same or a newer pair it applies |

**Restores**

| ID | Check |
| --- | --- |
| S68 | Logical restore: back up board A at name X; rename it to Y and wait for the row to show Y and a later `edited_at`; restore the backup; after the first request that reaches the room, the row shows X and X's last edit time (earlier than before) within a few seconds; a copy from before the restore that the test delays until after it does not overwrite the row |
| S69 | Simulated point-in-time restore in the order of S42 (fence raised, storage rewound): the same result as S68 |
| S70 | Node only: a marked volume copy (S43's steps) after a rename: once replayed, the room's fence is above the row's `document_generation` it read, and the row shows the restored name; with Supabase unreachable when the room starts, it stays locked |
| S71 | While a room is locked after a restore, rename answers 503 `room_locked` to a person in its copy and 404 to the outsider, before anything is saved |

**Recent boards, paging and order**

| ID | Check |
| --- | --- |
| S72 | Opens: a ticket sets `openedAt`; a later ticket moves the board to the top; two boards opened in one millisecond are ordered by ID, descending; with `record_board_open` failing, the ticket is still issued and the join works, and the next successful ticket records the open; after the owner opens 55 boards, the list holds the 50 newest |
| S73 | The granted guest's grant on A is deleted with the service key (no route removes access): A leaves the guest's recent boards and the workspace leaves their `GET /workspaces` at once, and their board list for the workspace is 404 |
| S74 | Paging: in a workspace of 250 boards, for each of the six sort and order pairs, following `nextCursor` gives pages of 100, 100 and 50 with every board exactly once and `nextCursor` null on the last page, including boards that share an `edited_at` and boards whose titles are equal or differ only in case |
| S75 | Cursor refusals: a cursor that is not base64url, decodes to something else, carries an unknown key, or was made for another workspace, sort or order; an unknown `sort` or `order`: each 400 `bad_request` |
| S76 | Title order: titles `banana`, `Apple`, `cherry`, `apple` ascending come back `Apple`, `apple`, `banana`, `cherry` (A–Z read as a–z, then the title byte by byte, then ID); descending is the exact reverse |

S70 is Node only.

## Numbered acceptance criteria

- 0003-W3-AC01: The server lists the caller's workspaces, the boards in a workspace on which the caller has a role, and the caller's recently opened boards, each with the caller's role; a board appears in a list only while the caller has a role on it.
- 0003-W3-AC02: A workspace owner or editor creates a board, named or "Untitled", in a named workspace, and a board editor renames it; the name and last-edited time in every list come from the board's saved document, never from an edit that was not saved.
- 0003-W3-AC03: List, recent, create and rename routes refuse with 404 when the caller has no role and 403 with the role needed when the role is too low; tests use independent identities and run on both runners.

AC03's "no role" follows access v2: a person with no role in a workspace gets 404 on its board
list; the two lists that name no workspace or board (`GET /workspaces`, `GET /recent-boards`)
answer such a person with an empty list.

| Criterion | Evidence that shows it |
| --- | --- |
| 0003-W3-AC01 | S55–S57, S72–S76 |
| 0003-W3-AC02 | S58, S59, S61–S71 |
| 0003-W3-AC03 | S55–S60, S71, S73 and the six independent identities |

## Validation commands and expected evidence

From the repository root with Node 26.13.0 and npm 11.20.0, with Docker running:

```sh
npm ci --ignore-scripts --no-audit --no-fund
node tests/server/make-signing-key.mjs
npx supabase start
node tests/server/write-stack-info.mjs
npm run typecheck
npm test
npm run build
npm run build:fixtures
npm run build:server
npm run audit:licenses
npx wrangler deploy --dry-run --outdir <scratch folder> -c apps/server/wrangler.json
npm run test:server:node
npm run test:server:workerd
BOARD_TEST_TARGET=docker npm run test:server:node
git diff --name-status <base>..<validated>
```

Stop the stack afterwards with `npx supabase stop` (for this project only).

| Check | Pass condition |
| --- | --- |
| V1 | `package-lock.json` and every `package.json` are byte-identical to the base's |
| V2 | `npm ci` exits 0 |
| V3 | `npm run typecheck` exits 0 for all five members |
| V4 | `npm test` passes with 0 failed; every test of the base suite still passes, and `tests/lists.test.mjs` is the only new test file |
| V5 | `npm run build` and `npm run build:fixtures` exit 0, and `apps/web/dist/app.js`, its CSS, `index.html` and `THIRD_PARTY_NOTICES.txt` are byte-identical to the base build's |
| V6 | `npm run build:server` exits 0 and writes `node.mjs`, `worker.mjs` and their notices files; `npm run audit:licenses` exits 0 |
| V7 | The Wrangler dry run exits 0 and uploads nothing |
| V8 | `test:server:node`: S1–S50 (S6 and S48 as amended) and S55–S76 pass; both summary lines have `"fail": 0` |
| V9 | `test:server:workerd`: S1–S36, S38–S42, S44–S50, S55–S69 and S71–S76 pass (S37, S43 and S70 are Node only); both summary lines have `"fail": 0` |
| V10 | `BOARD_TEST_TARGET=docker npm run test:server:node`: S51–S54 pass |
| V11 | `git diff --name-status <base>..<validated>` shows only files of items 1 to 5 |
| V12 | On a checkout of the base with the candidate's test files added (`tests/server/lists.test.ts`, `setup.ts`, the drivers, `node-test.ts`, `worker-test.ts`, both configs, `tests/lists.test.mjs`) and the base's production code and schema kept, run both server commands and `npm test`: S60 passes (authentication is unchanged); every other check of S55–S76 and the new unit tests fail on an assertion or a refused request. A check that fails because a test file cannot load on the base is reported by name and does not count as failing |

**Who runs what.** The implementer runs V1–V11 and records them; the reviewer's check run
repeats them on a clean clone and runs V12. Each is reported as one `PASS: V<n>` or
`FAIL: V<n>` line, with the server suite's S lines and summary lines kept as evidence.

No hosted deployment, browser comparison, Safari check, browser matrix, accessibility audit or
load test unless the maintainer asks.

## Exclusions and reasons

- Any screen: the web client milestones show these lists; the web app does not change here.
- Thumbnails, search, starring, folders (the reserved project level), personal drafts,
  duplicating, moving, trash and deletion: later milestones.
- Removing a board from one's recent boards: later.
- Removing or lowering access and its effect on open rooms: the removal milestone (S73 deletes a
  grant directly only to show that lists follow access).
- Any hosted deployment and a real point-in-time restore: a separate, approved step.

## Public references with retrieval dates

Retrieved 2026-10-30: [PostgreSQL row comparisons](https://www.postgresql.org/docs/current/functions-comparisons.html#ROW-WISE-COMPARISON)
(comparing (key, id) pairs for keyset paging), [PostgreSQL collation support](https://www.postgresql.org/docs/current/collation.html)
(the `C` collation compares bytes), and
[Durable Objects: `waitUntil`](https://developers.cloudflare.com/durable-objects/api/state/#waituntil)
(a promise passed to it prevents eviction until it settles or for up to 15 minutes, and does not
affect when a request completes).

## Implementation record

Implemented 2026-10-30 on `codex/0003-W3-discover-and-reopen-workspace-boards`.

- Governing brief: 0003-W3 v1, with API/access/hosted persistence v2 and exactly
  the unchanged prerequisite versions listed above.
- Base: `be3272347581874319b773fa40dbc406013d2d36` (committed main).
- Validated source/test revision: `e3b5ad8e6029e7a38f9f7dc2d840e6228879b277`.
- Validated source/test tree: `d98b41b5d9e91ec1ae93dbb11e078eb6bf36024e`; the committed tree matches the index
  tree used for the final validation runs.
- This implementation record is committed separately. The final branch tip is
  reported separately in the handoff; no merge, push or publication is authorized.

Delivered repeatable schema upgrades, service-only list/open/copy functions and
indexes; authenticated discovery, paging, recents, optional creation titles and
room-backed renames; saved-state copies through optional host interfaces; and
restore reconciliation with the Node volume fence raised above the board row.
The document remains authoritative. Copies and opens run outside the room queue,
and the runners retain background work. The copy checkpoint is `meta.copied`.
Guests without grants are hidden, and title ordering folds only ASCII A–Z.

No dependencies were added or changed. Manifests, lock, toolchain v4, inventory,
notices inputs, document format and web source are unchanged. Existing server
checks changed only at S6 and S48, as authorized; all 662 base unit checks remain,
with nine new unit checks in `tests/lists.test.mjs`.

**Environment and commands.** Node `v26.13.0` and npm `11.20.0` were checked,
with the supplied pinned toolchain directory first on PATH for every command.
Machine-specific environment values are parameterized here: `W3_TOOLCHAIN_BIN`
is that directory, `W3_STACK` is the supplied stack settings file, and `W3_BASE`
and `W3_DRYRUN` are disposable folders in the system temporary directory. The
commands below preserve the executed program names, arguments and flags without
publishing local paths or credentials.

```sh
export PATH="$W3_TOOLCHAIN_BIN:$PATH"
node --version
npm --version
export BOARD_TEST_STACK="$W3_STACK"
```

| Gate | Commands and inspection | Result |
| --- | --- | --- |
| V1 | `git diff --exit-code be32723 -- package-lock.json package.json ':(glob)**/package.json'`; byte comparison of every tracked manifest and the root lock against the base | Exit 0; byte-identical |
| V2 | `npm ci --ignore-scripts --no-audit --no-fund` | Exit 0; 118 packages installed |
| V3 | `npm run typecheck` | Exit 0 for all five workspaces |
| V4 | `npm test` | Exit 0; 671 passed, 0 failed, 0 skipped; only `tests/lists.test.mjs` is new in the root unit suite |
| V5 | `npm run build`; `npm run build:fixtures`; base archive/build and byte comparison described below; `git diff --exit-code be32723 -- apps/web` | Exit 0; all four web artifacts byte-identical |
| V6 | `npm run build:server`; `npm run audit:licenses` | Both exit 0; `apps/server/dist/node.mjs`, `worker.mjs`, `NODE_NOTICES.txt` and `WORKER_NOTICES.txt` written and verified |
| V7 | `WRANGLER_LOG_PATH="$W3_DRYRUN/wrangler.log" npx wrangler deploy --dry-run --outdir "$W3_DRYRUN/bundle" -c apps/server/wrangler.json` | Exit 0; dry run only; nothing uploaded |
| V8 | `npm run test:server:node` with the supplied `BOARD_TEST_STACK` | Exit 0; S1–S50 and S55–S76 pass; both summaries have zero failures |
| V9 | `npm run test:server:workerd` with the supplied `BOARD_TEST_STACK` | Exit 0; 48 W1 checks and 21 list checks pass; S37, S43 and S70 are Node only |
| V10 | `BOARD_TEST_TARGET=docker npm run test:server:node` with the supplied `BOARD_TEST_STACK` | Exit 0; S51–S54 pass; lists file skips every check and emits no summary |
| V11 | `git diff --name-status be32723..e3b5ad8e6029e7a38f9f7dc2d840e6228879b277`; precommit scope inspection; `git diff --check` | Exit 0; 27 source/test/README files, all within deliverables 1–5; this record adds only the brief itself |

```text
PASS: V1
PASS: V2
PASS: V3
PASS: V4
PASS: V5
PASS: V6
PASS: V7
PASS: V8
PASS: V9
PASS: V10
PASS: V11
```

V12 was not run: it is assigned to the independent review's check run.
No browser was launched. No browser comparison, Safari/IME/accessibility matrix,
hosted deployment, real hosted point-in-time restore, or broader load test ran.
The required S69 is a storage-rewind simulation with an external fence.

The stack was already running: no Supabase CLI start, stop or status command,
signing-key helper or stack-file helper was run. Setup applies the plain SQL
twice, uses independent synthetic W1/list identities and cleans up its data.
The Docker driver removes only its own image, container and named volume; the
supplied stack and base image are left alone. Temporary inputs and logs stay in
the system temporary directory.

Development checks included
`node --test tests/lists.test.mjs tests/room.test.mjs` (13 passed), and both
server commands filtered with `-- -t '^S(5[5-9]|6[0-9]|7[0-6]) '`.
Early failures were a TypeScript parameter property unsupported by Node's
strip-only loader and two assertions treating peer history as an unread queue;
these were corrected. The focused workerd run passed all 21 applicable checks.
After final inspection removed a redundant restore cancellation call, the final
unit/typecheck/build checks and all three server commands were run again on the
source/test tree above. No existing assertion outside S6/S48 needed changing.

The graph discovery tool was unavailable under this session's approval policy
(`MCP tool call requires approval, but approval policy is never`); discovery
therefore used direct reads. Workerd prints network-connection-lost diagnostics
while outage checks deliberately reset proxy connections. Those diagnostics are
retained in the temporary raw logs; every required assertion and both summaries
still passed. They are not reported as additional passing checks.

**Base web build.** `git archive be32723 | tar -x -C "$W3_BASE"` created a
clean disposable base checkout. In it,
`npm ci --ignore-scripts --no-audit --no-fund` and `npm run build` both exited 0.
A Python byte comparison read each base/candidate artifact and asserted equality.
The candidate's source under `apps/web` is also unchanged.

| Artifact under `apps/web/dist` | Bytes | SHA-256 of both builds |
| --- | ---: | --- |
| `app.js` | 841801 | `e2e3fdbfa681ac1a7e01d325a353043b8bb88f5902dc1de64f87293e9271db7f` |
| `style.css` | 19837 | `c1bd44f1005f7d36e5814ffea0a239a14940c0dbac7144203b8a42a245829f2c` |
| `index.html` | 576 | `66f0d8d097b0c1b88dba01e2fe87c1233b576b3d0019e81401434a7f58a74c8e` |
| `THIRD_PARTY_NOTICES.txt` | 16169 | `3367640f4a3b473755079ad41dc46c67bd65ed2dd21a0ca47edcd14944d3a91d` |

**Final server evidence.** S lines and both summary lines are preserved below
for each runner, without combining separate runs.

**Source commit.** `git commit -m "feat(server): add workspace board discovery and rename"`
exited 0, with both mandatory public-boundary hooks reporting PASS. Git printed
an advisory `packed-refs.lock` permission error; `git show-ref --verify` confirmed
the branch reference at the validated commit, and its tree matches the validated
index tree. No hook was bypassed.

**node**

```text
PASS: S1 independent ES256 identities
PASS: S2 missing and malformed tokens
PASS: S3 tampering and shared-secret algorithms
PASS: S4 expiry audience and issuer
PASS: S5 pinned keys survive endpoint failure
PASS: S6 every protected route checks tokens before lookups
PASS: S7 create route role matrix and titles
PASS: S8 board details role matrix
PASS: S9 ticket and join role matrix
PASS: S10 canonical export role matrix
PASS: S11 owner lists members grants and invitations
PASS: S12 invitation create cancel matrix and private rows
PASS: S13 raise matrix no-op and lowering refusals
PASS: S14 invitation acceptance identity expiry cancellation and retries
PASS: S15 unoffered routes return not found
PASS: S16 refused joins disclose no board content
PASS: S17 viewer edits are never acknowledged
PASS: S18 saved precedes broadcast
PASS: S19 incomplete edits wait until dependencies arrive
PASS: S20 receipt retry is idempotent and bound to update bytes
PASS: S21 highest board role wins
PASS: S22 guest access and Data API rows agree
PASS: S23 board invitations add an outsider as a guest
PASS: S24 workspace raises close all affected boards with 4409
PASS: S25 a board raise leaves other rooms connected
PASS: S26 acceptance refreshes a cached viewer
PASS: S27 a redundant effective grant leaves epoch and connection alone
PASS: S28 failed fanout is recovered on next join
PASS: S29 tickets are one-time short-lived and origin-bound
PASS: S30 renewal and expiry survive hibernation
PASS: S31 invited confirmed account signs in once without sign-ups
PASS: S32 new rooms are empty and first open is idempotent
PASS: S33 exact 2 MiB board persists in bounded chunks
PASS: S34 oversized message leaves transport usable
PASS: S35 hundred-edit and idle snapshots retain two generations
PASS: S36 waiting count bytes deadline and hibernation
PASS: S37 Node restart drops waits and clients resend
PASS: S38 hostile transitions hidden fields history and size store nothing
PASS: S39 hosted image edits are refused
PASS: S40 ordinary wakes retain cached access during outage
PASS: S41 large logical restore locks until replay and clears tickets
PASS: S42 physical rewind respects an external fence
PASS: S43 copied Node volume requires replay after marking
PASS: S44 unreadable fence fails closed independently of Supabase
PASS: S45 replay lowers and removes cached effective roles
PASS: S46 access history floor enforces the inclusive replay boundary
PASS: S47 operator authentication limits and runner-specific routes
PASS: S48 schema is repeatable and authenticated writes are denied
PASS: S49 workspace setup creates its owner and refuses a second run
PASS: S50 fanout timing for 1 10 and 50 connected boards
SUMMARY {"runner":"node","checks":50,"pass":50,"fail":0,"measures":{"storage":{"jsonChunks":2,"yjsChunks":2,"largestRowBytes":1048596,"reloadMs":179.23583300000064},"fanoutMs":{"1":22.285499999998137,"10":48.445958000003884,"50":60.515833999997994}}}
PASS: S55 workspace discovery follows workspace roles and granted boards
PASS: S56 board lists apply roles hide missing access and expose exact fields
PASS: S57 recent boards include only opened accessible boards newest first
PASS: S58 creation supports Untitled validates bodies and preserves role refusals
PASS: S59 rename role matrix title rules and document size limit
PASS: S60 new routes authenticate every invalid token before looking up resources
PASS: S61 rename saves once broadcasts exports and reaches every list
PASS: S62 ordinary title edits reach board details and both lists
PASS: S63 refused edits copy nothing and ordinary NUL titles keep their document
PASS: S64 edited times throttle idle flush and failed copies retry after sixty seconds
PASS: S65 copy failure cannot refuse or undo edits and recovery catches up
PASS: S66 slow copies leave ten save acknowledgements below two hundred milliseconds
PASS: S67 saved row writes compare generation before revision and accept equal pairs
PASS: S68 logical restore rewinds name and edit time and fences delayed copies
PASS: S69 point in time rewind reconciles names with an external fence
PASS: S70 marked Node volume raises above row generation and stays locked offline
PASS: S71 locked rename hides boards from outsiders and stores no edit
PASS: S72 opens reorder tie by descending ID survive failure and cap at fifty
PASS: S73 removing the last guest grant removes board and workspace discovery
PASS: S74 all six sort directions page 250 tied boards exactly once
PASS: S75 cursor shape context and unknown sort directions are refused
PASS: S76 title order folds ASCII then compares original bytes and reverses exactly
SUMMARY-LISTS {"runner":"node","checks":22,"pass":22,"fail":0,"measures":{"ackMsWhileCopySlow":0.8468330000000606}}
```

**workerd**

```text
PASS: S1 independent ES256 identities
PASS: S2 missing and malformed tokens
PASS: S3 tampering and shared-secret algorithms
PASS: S4 expiry audience and issuer
PASS: S5 pinned keys survive endpoint failure
PASS: S6 every protected route checks tokens before lookups
PASS: S7 create route role matrix and titles
PASS: S8 board details role matrix
PASS: S9 ticket and join role matrix
PASS: S10 canonical export role matrix
PASS: S11 owner lists members grants and invitations
PASS: S12 invitation create cancel matrix and private rows
PASS: S13 raise matrix no-op and lowering refusals
PASS: S14 invitation acceptance identity expiry cancellation and retries
PASS: S15 unoffered routes return not found
PASS: S16 refused joins disclose no board content
PASS: S17 viewer edits are never acknowledged
PASS: S18 saved precedes broadcast
PASS: S19 incomplete edits wait until dependencies arrive
PASS: S20 receipt retry is idempotent and bound to update bytes
PASS: S21 highest board role wins
PASS: S22 guest access and Data API rows agree
PASS: S23 board invitations add an outsider as a guest
PASS: S24 workspace raises close all affected boards with 4409
PASS: S25 a board raise leaves other rooms connected
PASS: S26 acceptance refreshes a cached viewer
PASS: S27 a redundant effective grant leaves epoch and connection alone
PASS: S28 failed fanout is recovered on next join
PASS: S29 tickets are one-time short-lived and origin-bound
PASS: S30 renewal and expiry survive hibernation
PASS: S31 invited confirmed account signs in once without sign-ups
PASS: S32 new rooms are empty and first open is idempotent
PASS: S33 exact 2 MiB board persists in bounded chunks
PASS: S34 oversized message leaves transport usable
PASS: S35 hundred-edit and idle snapshots retain two generations
PASS: S36 waiting count bytes deadline and hibernation
PASS: S38 hostile transitions hidden fields history and size store nothing
PASS: S39 hosted image edits are refused
PASS: S40 ordinary wakes retain cached access during outage
PASS: S41 large logical restore locks until replay and clears tickets
PASS: S42 physical rewind respects an external fence
PASS: S44 unreadable fence fails closed independently of Supabase
PASS: S45 replay lowers and removes cached effective roles
PASS: S46 access history floor enforces the inclusive replay boundary
PASS: S47 operator authentication limits and runner-specific routes
PASS: S48 schema is repeatable and authenticated writes are denied
PASS: S49 workspace setup creates its owner and refuses a second run
PASS: S50 fanout timing for 1 10 and 50 connected boards
SUMMARY {"runner":"workerd","checks":48,"pass":48,"fail":0,"measures":{"storage":{"jsonChunks":2,"yjsChunks":2,"largestRowBytes":1048596,"reloadMs":181},"fanoutMs":{"1":9,"10":44,"50":84}}}
PASS: S55 workspace discovery follows workspace roles and granted boards
PASS: S56 board lists apply roles hide missing access and expose exact fields
PASS: S57 recent boards include only opened accessible boards newest first
PASS: S58 creation supports Untitled validates bodies and preserves role refusals
PASS: S59 rename role matrix title rules and document size limit
PASS: S60 new routes authenticate every invalid token before looking up resources
PASS: S61 rename saves once broadcasts exports and reaches every list
PASS: S62 ordinary title edits reach board details and both lists
PASS: S63 refused edits copy nothing and ordinary NUL titles keep their document
PASS: S64 edited times throttle idle flush and failed copies retry after sixty seconds
PASS: S65 copy failure cannot refuse or undo edits and recovery catches up
PASS: S66 slow copies leave ten save acknowledgements below two hundred milliseconds
PASS: S67 saved row writes compare generation before revision and accept equal pairs
PASS: S68 logical restore rewinds name and edit time and fences delayed copies
PASS: S69 point in time rewind reconciles names with an external fence
PASS: S71 locked rename hides boards from outsiders and stores no edit
PASS: S72 opens reorder tie by descending ID survive failure and cap at fifty
PASS: S73 removing the last guest grant removes board and workspace discovery
PASS: S74 all six sort directions page 250 tied boards exactly once
PASS: S75 cursor shape context and unknown sort directions are refused
PASS: S76 title order folds ASCII then compares original bytes and reverses exactly
SUMMARY-LISTS {"runner":"workerd","checks":21,"pass":21,"fail":0,"measures":{"ackMsWhileCopySlow":2}}
```

**docker**

```text
PASS: S51 Docker image builds with the pinned digest
PASS: S52 container passes identity join secrecy and edit checks
PASS: S53 Docker restart preserves the board and permits another saved edit
PASS: S54 self-hosted Supabase accepts ES256 and refuses HS256
SUMMARY {"runner":"docker","checks":4,"pass":4,"fail":0,"measures":{}}
```
