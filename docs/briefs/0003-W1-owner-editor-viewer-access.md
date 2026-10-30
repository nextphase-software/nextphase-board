BRIEF VERSION: 0003-W1 v1 (2026-10-30)
# 0003-W1 — Enforce owner, editor and viewer access

Status: Draft. Implementation starts only after the maintainer commits this brief and its
contracts to main: [0003 identity v1](../architecture/0003-identity-v1.md),
[0003 access v1](../architecture/0003-access-v1.md), [0003 API v1](../architecture/0003-api-v1.md),
[0003 sync v1](../architecture/0003-sync-v1.md),
[0003 hosted persistence v1](../architecture/0003-hosted-persistence-v1.md),
[0003 self-host runner v1](../architecture/0003-self-host-runner-v1.md),
[0001 document v11](../architecture/0001-document-v11.md),
[0001 toolchain v4](../architecture/0001-toolchain-v4.md) with
[lock v4](../architecture/0001-dependency-lock-v4.json),
[inventory v4](../architecture/0001-dependency-inventory-v4.json) and
[runtime notices v2](../architecture/0001-runtime-notices-v2.txt), and
[0001 web modules v24](../architecture/0001-web-modules-v24.md).

## Outcome

Board gets its server. A signed-in person can create a board in their workspace and open it by
link, and the server, not the browser, decides what each person may do. The workspace owner
invites people as editors, viewers or guests of the workspace, or as editors or viewers of a
single board. A person's role on a board is the highest role any level gives them. Editors
change boards, viewers only look, and anyone else gets nothing, not even the board's name.
Every refusal says why in a machine-readable reason, and a refused edit is never reported as
saved.

The same room code runs in a Cloudflare Durable Object (one per board) and in one Node process
for people who host Board themselves, and one test suite proves that both behave the same
against a local Supabase stack. Nothing is deployed, and the web app does not change: its
markup, behaviour, saved records and built files stay exactly as they are at the base. Sign-in,
sharing and hosted save states in the browser are a later milestone.

## Read first and prerequisite contracts

- [Contributor guidance](../../CONTRIBUTING.md), [agent instructions](../../AGENTS.md) and
  [engineering standards](../../DESIGN.md).
- The six 0003 contracts above: they define every behaviour this brief asks for. Where this
  brief and a contract seem to differ, the contract wins; report the difference.
- [0001 web modules v24](../architecture/0001-web-modules-v24.md): where each package and program
  lives and what each may import (rules 9 to 11).
- [0001 toolchain v4](../architecture/0001-toolchain-v4.md): the workspace, the exact manifests,
  lock v4, inventory v4, the notices for each artifact and the commands.
- [0001 document v11](../architecture/0001-document-v11.md): `checkTransition` and the rules for
  documents a server stores.
- [0001 storage v3](../architecture/0001-storage-v3.md),
  [0006 board file v2](../architecture/0006-board-file-v2.md) and
  [0001 interaction v24](../architecture/0001-interaction-v24.md): unchanged.
- [0016-W2 v1](0016-W2-board-rules-package.md): its V12 and V13 comparison procedure is reused
  below.

## Deliverables and boundaries

The base is the main revision that holds this brief, recorded in the implementation record.
"Moved unchanged" means `git diff -M` reports a 100% rename. Every new source file starts with
the line `// SPDX-License-Identifier: Apache-2.0` (or `-- SPDX-License-Identifier: Apache-2.0`
in SQL). Code follows the repository's style ([engineering standards](../../DESIGN.md)): readable
lines, small modules with one job each, and comments where a reader needs the reason.

1. **The workspace.** The root `package.json` exactly as in toolchain v4; each member's
   `package.json` as toolchain v4's table says; delete `apps/web/package-lock.json`; generate
   the root `package-lock.json` with toolchain v4's command, byte-identical to lock v4. Add
   `node_modules/`, `apps/server/dist/`, `.wrangler/`, `supabase/.temp/`, `supabase/.branches/`,
   `supabase/signing_keys.json` and `tests/server/.stack.json` to `.gitignore` where missing, and a
   root `.dockerignore` that leaves out `node_modules`, `dist` folders, `.git` and
   `supabase/.temp`.
2. **The Yjs adapter moves.** `apps/web/src/document-adapter.ts` moves unchanged to
   `packages/board-sync/src/document-adapter.ts`. The web app imports it as
   `nextphase-board-sync/document-adapter.ts` (in `state/use-board-document.ts`,
   `state/use-storage-session.ts` and anywhere else it is imported); root tests import it as
   `../packages/board-sync/src/document-adapter.ts`. Add `packages/board-sync/tsconfig.json`:
   `packages/board-rules/tsconfig.json`'s compiler options (no browser types) with
   `"skipLibCheck": true` (Yjs's own declarations name browser types) and
   `"include": ["src", "../board-rules/src/platform.d.ts"]`.
3. **The codec.** `packages/board-sync/src/codec.ts` reads a Yjs document built by the adapter
   back into a version 10 board document, and reports anything in the Yjs document outside the
   adapter's fields (another root type, or an unknown key in a mapped object) as an error. Unit
   tests: a board written by the adapter reads back equal to `canonical` of the original; a
   hidden root type and an unknown object key are reported.
4. **The before/after rule.** `checkTransition(before, after)` in a new module
   `packages/board-rules/src/transition.ts`, exactly as document v11's six points say, with unit
   tests in `tests/transition.test.mjs`: a normal edit passes; each of the six points has a
   failing case. The web app does not import `transition.ts`, and `document.ts` does not change.
5. **The room.** `packages/board-room/` with `package.json`, `tsconfig.json` and modules under
   `src/`, each with one job, for example: the room and its message order (`room.ts`); edits,
   receipts and waiting edits (`edits.ts`); the copy of access, epochs and replay (`access.ts`);
   join tickets (`tickets.ts`); snapshots and chunks (`snapshots.ts`); the storage interface and
   the table layout of the hosted persistence contract (`storage.ts`); messages and close codes
   (`protocol.ts`). The room implements the sync contract, the room parts of the access contract
   and the hosted persistence contract, and reaches storage, time, Supabase, the restore fence,
   hashing, random bytes and connections only through interfaces it defines (web modules v24,
   rule 10). Its `tsconfig.json` is board-sync's with `src/platform.d.ts` (declaring only
   `TextDecoder`) reached through `"src"`.
6. **The server.** `apps/server/` with:
   - `src/app.ts`: one hono app with every route of the API contract, wired to handler modules
     (`src/routes/…`);
   - `src/auth.ts`: the token checks and public-key handling of the identity contract, using
     `jose`;
   - `src/supabase.ts`: every Supabase call (the SQL functions over `@supabase/supabase-js`, and
     the Auth admin call that creates an invited person's account);
   - `src/fanout.ts`: calling the rooms a change reaches, at most 10 at a time;
   - `src/worker.ts`: the Cloudflare runner: the Worker entry, the `BoardRoom` Durable Object
     (SQLite storage, the WebSocket Hibernation API, the connection's person and expiry kept in
     its attachment, alarms for expiry, waiting deadlines and idle snapshots) and the
     `RestoreFence` Durable Object; both namespaces are used through
     `.jurisdiction(env.BOARD_JURISDICTION)` when that variable is set. Its settings come from
     the Worker's environment: `SUPABASE_URL`, `SUPABASE_ISSUER` (optional), `JWKS` and
     `ALLOWED_ORIGIN` as variables, and
     `SUPABASE_SERVICE_KEY` and `OPERATOR_KEY` (optional) as secrets;
   - `src/node.ts`: the Node runner: `@hono/node-server`, `ws` (with a 1 MiB + 64 KiB frame
     limit), one SQLite file per board through `node:sqlite`, `restore-fences.sqlite`, timers for
     expiry and deadlines, and one queue per board so its messages are handled in order;
   - `supabase/nextphase_board.sql`: the schema, tables, row rules, `board_role` and the write
     functions of the access contract, plain SQL that runs again without error on a stack where
     it already ran;
   - `scripts/setup-workspace.mjs` and `scripts/mark-restored-volume.mjs` as the self-host runner
     contract says;
   - `Dockerfile`: a two-stage build on `node:26.13.0-bookworm-slim` pinned by digest, running
     `dist/node.mjs` as the `node` user on port 8788; no image is pushed;
   - `wrangler.json`: the Worker's local configuration (entry, compatibility date, the two Durable
     Object classes as SQLite classes, no account, routes or keys, no `BOARD_JURISDICTION`);
   - `tsconfig.json` and `README.md`: the self-host steps in short, linking the self-host
     runner contract.

   `worker.ts` and `node.ts` contain no test switch, clock control or fault injection
   (web modules v24).
7. **The build.** `scripts/build-server.mjs` (the Node and Worker bundles and their notices, as
   toolchain v4 says) and `scripts/check-notices.mjs` extended to check all three artifacts
   against inventory v4 and runtime notices v2. `scripts/build-web.mjs` changes only as the
   workspace needs (esbuild's working directory and module resolution from the root), and the
   web build's output files must stay byte-identical (V14).
8. **The local Supabase stack.** The suite runs against a Supabase CLI stack started from the
   repository root:
   - `supabase/config.toml`: `project_id = "nextphase-board-test"`; API port 55321 with
     `schemas = ["public", "graphql_public"]` (the suite exposes `nextphase_board` itself, after
     creating it); database port 55322 (shadow 55325, major version 17); the mail catcher on at
     55324; studio, storage, the pooler, edge functions and analytics off; under `[auth]`,
     `enable_signup = false`, `jwt_expiry = 3600` and `signing_keys_path = "./signing_keys.json"`;
     under `[auth.email]`, `enable_signup = true` and `enable_confirmations = false` (with the
     global switch off, this keeps email sign-in working); sign-in rate limits raised for tests.
   - `tests/server/make-signing-key.mjs`: writes `supabase/signing_keys.json` (ignored by git), a
     JSON array holding one P-256 private key as a JWK made with Node's `crypto`, with a random
     `kid`, `"alg": "ES256"`, `"use": "sig"` and `"key_ops": ["sign", "verify"]` (Supabase Auth
     signs only with a key whose `key_ops` holds `sign`); it leaves an existing file alone.
   - `tests/server/write-stack-info.mjs`: after `npx supabase start`, writes
     `tests/server/.stack.json` (ignored by git) from `npx supabase status -o json`:
     `{ "apiUrl", "anonKey", "serviceRoleKey", "jwtSecret", "mailUrl", "dbContainer",
     "signingKeyPath" }`.
   - The suite reads that file, or the file named by `BOARD_TEST_STACK`, and never runs the
     Supabase CLI itself. It applies `apps/server/supabase/nextphase_board.sql` with
     `docker exec -i <dbContainer> psql -U postgres -v ON_ERROR_STOP=1`, then exposes the schema
     (adding it to the Data API's schemas and reloading), in that order.
   - Checks that need Supabase or its key endpoint to be unreachable (S5, S40, S41) point the
     server under test at a small proxy in front of the stack and cut the proxy; the stack itself
     keeps running. The server's issuer setting stays the stack's real issuer, so tokens still
     verify. The Docker run reaches the stack at `host.docker.internal` the same way. S44's
     unreadable fence is a separate fault: `worker-test.ts` makes the fence's reads fail, and on
     the Node runner the test makes `restore-fences.sqlite` unreadable.
9. **The shared server suite.** `tests/server/`:
   - `suite.test.ts`: the checks S1–S54 below, written once and run unchanged against both
     runners; each prints `PASS: S<n> <name>` or `FAIL: S<n> <name>`, and the run ends with one
     JSON line `SUMMARY {"runner", "checks", "pass", "fail", "measures"}` holding the measured
     values the checks below name;
   - `setup.ts`: starts nothing itself; checks that the local stack is up, applies the schema then
     exposes it, creates the identities below with the Auth admin API, and signs them in;
   - `tokens.ts`: makes the bad tokens the checks need (expired, wrong audience or issuer,
     tampered, HS256 with the stack's shared secret, unknown key ID) using the local stack's
     signing key, which exists only in the test stack;
   - `driver-node.ts` and `node-test.ts`: the driver starts `node-test.ts` in a child process on a
     free port with a temporary data folder, and can stop and restart it. `node-test.ts` starts the
     same server as `node.ts` (both call one start function in `apps/server/src/`, which takes the
     clock and the Supabase, fence and limit settings as arguments) with a controllable clock and
     the faults the checks need, controlled by the driver over the child process's IPC channel;
     `node.ts` passes the real ones;
   - `driver-workerd.ts` and `worker-test.ts`: run the Worker in workerd through
     `@cloudflare/vitest-plugin`; `worker-test.ts` re-exports the production classes and adds
     only what tests need (an injected clock, a way to stop Supabase calls, fence faults,
     simulated restores, a lower backup limit);
     the driver evicts the Durable Object between messages with `evictDurableObject` (WebSockets
     hibernate);
   - `vitest.node.config.ts` and `vitest.workerd.config.ts` at the root.

   The six identities, each an independent Supabase account: **owner** (workspace owner),
   **editor** and **viewer** (workspace roles), **granted guest** (a guest with an `editor` grant
   on board A only), **plain guest** (a guest with no grant) and **outsider** (not a member). The
   workspace has boards A and B.
10. **Existing tests.** Change existing test files only where the move requires: the adapter's
    import path, and paths into `apps/web/node_modules` that now resolve from the root (for
    example `tests/shapes.test.mjs` loads `esbuild`, `react` and `react-dom/server` by name).
    `tests/modules.test.mjs` asserts that `document-adapter.ts` is no longer in `apps/web/src/`
    and is in `packages/board-sync/src/`, adds `transition.ts` to the board rules package's
    module list, and gains the web modules v24 guard tests. A new
    `tests/room.test.mjs` unit-tests the room against an in-memory storage: ordering, receipts,
    waiting limits with an injected clock, snapshots every 100 edits, and the restore lock.
    `tests/README.md` lists the new suites and how to run them.
11. **Documentation.** `README.md` "Run locally" uses the toolchain v4 commands and links the
    self-host runner contract for the server; `CONTRIBUTING.md` changes only where it names the
    old lock or commands; `docs/architecture/README.md` lists the new contracts.

Outside the named new controls, the existing screens' markup stays exactly as at the base: the
reviewer's A–J comparison allows only the masks listed under validation. This milestone adds no
control, so nothing on screen changes.

Nothing else changes: no file under `apps/web/src/` other than the import lines of item 2, no
other contract, and no change to stored browser data, board files or picture records. If the
work seems to need anything outside items 1 to 11, stop and report it.

## Server checks

Each check runs on both runners (`npm run test:server:node`, `npm run test:server:workerd`)
against the local stack. "Refused with R" means the reply or room message carries reason R; a
status code is the HTTP status.

**Identity**

| ID | Check |
| --- | --- |
| S1 | Each identity's ES256 token is accepted (owner reads board A's details: 200) |
| S2 | No token: 401 `token_missing`; a header that is not a JWS: 401 `token_malformed` |
| S3 | Tampered signature: 401 `token_signature`; HS256 token signed with the stack's shared secret: 401 `token_algorithm` |
| S4 | Expired token: 401 `token_expired`; wrong `aud`: 401 `token_audience`; wrong `iss`: 401 `token_issuer` |
| S5 | With the key endpoint unreachable: a token with a pinned `kid` is accepted; a token with an unknown `kid` gets 503 `signing_keys_unavailable` |
| S6 | Every route of the API contract that needs a token refuses each bad token of S2–S4 with 401 before any board lookup (the reply is the same for an existing and a made-up board ID) |

**Route by route** (each check covers all six identities on boards A and B, and the expected
status of the access contract's table for each)

| ID | Check |
| --- | --- |
| S7 | Create a board: owner and editor 201; viewer, granted guest 403 `role_too_low` (`needed` `editor`); plain guest and outsider 404; a title of 121 characters or only spaces: 400 `bad_request` |
| S8 | Board details: by board role; the granted guest gets 200 on A and 404 on B |
| S9 | Join tickets and join: by board role; refused people get 404 before any upgrade |
| S10 | Export: by board role; the export equals the room's canonical document |
| S11 | List members, grants and invitations: owner 200; editor, viewer and granted guest 403; plain guest and outsider 404 |
| S12 | Invite to the workspace and to a board, and cancel: as S11; a guest granted only board A cancelling a board B invitation gets 404; an invited person reading `invitations` through the Data API gets no rows |
| S13 | Raise a member and a grant: as S11; a lower role 409 `lowering_not_offered`; the same role 200 with no access change written |
| S14 | Accept: only the matching email (403 `invitation_email_mismatch` otherwise); expired, used and cancelled invitations 410; a retry by the same person gets the same 200, with the offered role, also after their role was raised since |
| S15 | Unknown routes, `DELETE /boards/:board`, and image and comment routes: 404 `not_found` for every identity |

**Rooms**

| ID | Check |
| --- | --- |
| S16 | Outsider and plain guest: the join-ticket reply is the 404 body `{"error":{"reason":"not_found"}}` and nothing else; no ticket, no upgrade, and no byte of board content (title, objects, IDs) in any reply |
| S17 | A viewer's edit is refused with `role_too_low`, gets no `received` or `saved`, and leaves the revision and export unchanged |
| S18 | An editor's complete edit gets `saved` with the next revision; a second connection gets `update` only after `saved` |
| S19 | An incomplete edit gets `received` and no `saved`; once the edit it depends on arrives, both are `saved`, in order |
| S20 | Retrying a request ID with the same update returns the stored `saved` and adds no revision; with a different update, `request_id_reused` |
| S21 | Highest role wins: the workspace viewer, given an `editor` grant on A, edits A and is refused on B |
| S22 | The granted guest joins A and gets 404 on B; reading `boards` through the Data API as that person returns only A |
| S23 | A board invitation accepted by the outsider makes them a guest with that grant: they join that board and get 404 on the other |
| S24 | Raising the workspace viewer to editor closes their connections on every board with 4409, never 4403; after rejoining they edit |
| S25 | A board grant raise closes connections only in that board's room; their connections to other boards stay open |
| S26 | The viewer, already in a room's copy, accepts an editor invitation: that room closes their connection with 4409, and their role is the higher one |
| S27 | A board grant to someone who is already a workspace editor writes its access change but leaves their epoch and connections alone |
| S28 | If a room cannot be reached during a raise, the raise is still committed, and the person's next join gets the new role |
| S29 | Join tickets: a ticket works once; a used, expired (after 30 seconds on the injected clock), unknown or other-board ticket, or one whose token expired before it was used, gets 401 `ticket_invalid`; a wrong `Origin` gets 403 `origin_not_allowed`; no request URL in the run contains an access token |
| S30 | Renewal: a fresh same-person token gets `renewed`; another person's token closes with 4401; without renewal the connection closes with 4401 at expiry, also after the room was evicted (workerd); a renewal after expiry cannot reopen it |
| S31 | Inviting an email with no account creates a confirmed account with no password and sends no email; signing in with a one-time code from the mail catcher, with sign-ups off, works; that person then accepts the invitation. Signing in with an email that has no account is refused |
| S32 | A new board's room starts empty with the board's ID and title; creating the room again (a second first open) changes nothing |

**Storage, limits and edits**

| ID | Check |
| --- | --- |
| S33 | A 250-object board whose canonical JSON is exactly 2 MiB is saved, the room is evicted (workerd) or the server restarted (Node), and the export after reloading is byte-identical. Measures: JSON and Yjs chunk counts, the largest stored row in bytes (under 1.1 MiB), reload time |
| S34 | A message over 1 MiB is refused with `message_too_large`; the connection stays open and the next edit is saved |
| S35 | A snapshot is written after 100 saved edits, and on idle (last connection closed; 60 seconds without an edit on the injected clock); edit rows at or below the previous snapshot are deleted; the board reloads equal |
| S36 | Waiting edits: the 65th waiting edit on a connection triggers `resync` `waiting_count`; passing 4 MiB triggers `waiting_bytes`; 30 seconds on the injected clock triggers `waiting_timeout`; none is ever `saved`; a waiting edit and its deadline survive eviction (workerd) |
| S37 | On the Node runner, a restart while edits wait deletes them; after rejoining, the client resends and they are saved |
| S38 | Hostile edits are refused with their reasons and store nothing: a revived retired generation and a changed generation (`invalid_transition`), reuse of an ID deleted several revisions earlier (`identifier_reused`), a hidden Yjs root or field (`invalid_update`), a document over 2 MiB (`document_too_large`) |
| S39 | An edit that adds an image object is refused with `images_not_supported` |

**Restores, replay and setup**

| ID | Check |
| --- | --- |
| S40 | Ordinary wake with Supabase unreachable: cached owners and editors join and their edits are saved; cached viewers join and read, and their edits are refused; anyone without a cached role gets 404 |
| S41 | Logical restore with Supabase unreachable: the restore answers 200 with `locked: true`; connections open at the restore close with 4423; a join with a ticket issued before the restore gets 401 `ticket_invalid`; a person in the copy gets 503 `room_locked` on the ticket and export routes; anyone else gets 404, including an outsider who was refused a join before the restore; after Supabase returns, the room replays and opens, and each person needs a new ticket. The 2 MiB board of S33 is backed up and restored this way (an envelope over 1 MiB), and an envelope over 16 MiB gets 413 `body_too_large` |
| S42 | Simulated point-in-time restore, in the restore-to-time route's order: the fence is raised first, then the board's storage is rewound to an earlier copy, including `restore_generation` (workerd: then evicted; Node: the board file replaced, then the room reloaded): the room is locked until replay. A rewind without raising the fence is an ordinary wake and opens. The restore-to-time answer (202 with `undoBookmark`) is checked only at the first hosted deploy, because point-in-time restore does not run locally |
| S43 | A volume copy (Node): stop the server, put back an older copy of the data folder including the fence file, run `mark-restored-volume.mjs`, start: locked until replay |
| S44 | The restore fence cannot be read (an injected fence fault, not a Supabase outage): the room stays locked; once the fence reads again, it opens |
| S45 | Replay applies lowered roles that the test writes directly in the database (no route lowers roles), each in one transaction with its `access_changes` row: an editor lowered to viewer is closed with 4403 and rejoins as a viewer whose edits are refused; a granted guest whose only grant is deleted is closed with 4403 and gets 404 on rejoin |
| S46 | A restored room with `lowest_kept > watermark + 1` stays locked and its routes give 503 `access_log_pruned`; with `lowest_kept = watermark + 1` it replays and opens |
| S47 | Operator routes are refused with 401 `operator_key_invalid` with a missing or wrong key, and 404 when no key is set; `restore-to-time` is 404 on the Node runner; with the backup limit lowered by the test bootstrap, a backup over it gets 413 `backup_too_large` and no envelope |
| S48 | A fresh stack set up in the self-host order (schema, then exposure): every table has row-level security; an authenticated person cannot execute any write function or write any table |
| S49 | `setup-workspace.mjs` on a fresh stack creates the workspace and its owner; run again, it refuses |
| S50 | Fanout timing (information only, no pass threshold): raising a workspace role reaching 1, 10 and 50 boards with a connection each; the measures hold each time in milliseconds |

**Docker and the self-hosted identity check**

| ID | Check |
| --- | --- |
| S51 | The image builds from `apps/server/Dockerfile` (`docker build --pull=false`) |
| S52 | The container, started with a settings file pointing at the local stack, passes S1, S3, S9, S16, S17 and S18 |
| S53 | After `docker restart`, the same board reloads identical and S18 passes again |
| S54 | Against the local stack (which runs Supabase's own containers with an ES256 key), ES256 tokens are accepted and HS256 tokens refused through the container |

S51–S54 run with `BOARD_TEST_TARGET=docker npm run test:server:node`, which runs the same suite
file against the container instead of a child process.

## Numbered acceptance criteria

- 0003-W1-AC01: An owner can grant the agreed editor/viewer access to an authorized test identity using the selected identity boundary.
- 0003-W1-AC02: Read/write roles are enforced on every exposed document, asset, comment, export and transport operation; denied identities cannot read board content.
- 0003-W1-AC03: The server explains every denial with a machine-readable reason and never acknowledges a refused edit as saved; permission tests use independent identities.

Assets and comments are not exposed in this version; their routes answer 404 for everyone
(S15), and an edit that adds an image is refused (S39).

| Criterion | Evidence that shows it |
| --- | --- |
| 0003-W1-AC01 | S1, S7, S12, S13, S14, S21–S27, S31, S49 |
| 0003-W1-AC02 | S6–S11, S15–S19, S21–S25, S29, S33, S36–S46, S48 |
| 0003-W1-AC03 | S2–S5, S7–S17, S20, S29, S30, S34, S36, S38, S39, S41, S46 and the six independent identities of item 9 |

## Validation commands and expected evidence

From the repository root with Node 26.13.0 and npm 11.20.0, with Docker running:

```sh
npm install --package-lock-only --ignore-scripts --no-audit --no-fund
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
npm audit --audit-level=high
npm audit --omit=dev --audit-level=high
npx wrangler deploy --dry-run --outdir <scratch folder> -c apps/server/wrangler.json
npm run test:server:node
npm run test:server:workerd
BOARD_TEST_TARGET=docker npm run test:server:node
git diff -M --name-status <base>..<validated>
```

Stop the stack afterwards with `npx supabase stop` (for this project only).

| Check | Pass condition |
| --- | --- |
| V1 | The root `package-lock.json` is byte-identical to lock v4 (SHA-256 `0c0f248e512964df1f89b3c437ee3a25d17a18b25dab3527c17c97893c447d6d`) after the regeneration command; `apps/web/package-lock.json` does not exist |
| V2 | `npm ci` exits 0 |
| V3 | `npm run typecheck` exits 0 for all five members |
| V4 | `npm test` passes with 0 failed; every test of the base suite still passes, and the base's test files differ only as item 10 allows |
| V5 | `npm run build` and `npm run build:fixtures` exit 0 |
| V6 | `npm run build:server` exits 0 and writes `node.mjs`, `worker.mjs` and their notices files |
| V7 | `npm run audit:licenses` exits 0 |
| V8 | Both `npm audit` commands report no high or critical advisory |
| V9 | The Wrangler dry run exits 0 and uploads nothing |
| V10 | `test:server:node`: S1–S50 pass; the summary line has `"fail": 0` |
| V11 | `test:server:workerd`: S1–S36, S38–S42 and S44–S50 pass (S37 and S43 are Node only); the summary line has `"fail": 0` |
| V12 | `BOARD_TEST_TARGET=docker npm run test:server:node`: S51–S54 pass |
| V13 | The 0016-W2 v1 brief's V12 comparison (scenarios A–J, with its one saved-time mask) on a build of the base twice and on the candidate once: identical at every checkpoint, including the saved records; and its V13 harness: eight PASS lines on both pages |
| V14 | `apps/web/dist/app.js`, its CSS, `index.html` and `THIRD_PARTY_NOTICES.txt` are byte-identical to the base build's |
| V15 | `git diff -M --name-status <base>..<validated>` shows the adapter as a 100% rename, `apps/web/package-lock.json` deleted, and otherwise only files of items 1 to 11 |
| V16 | On a checkout of the base, the new `tests/modules.test.mjs` guard tests and `tests/transition.test.mjs` fail, and the server suite cannot start (there is no server) |

**Who runs what.** The implementer runs V1–V12, V14 and V15 and records them; the reviewer's
check run repeats them on a clean clone and runs V13 and V16. Each is reported as one
`PASS: V<n>` or `FAIL: V<n>` line, with the server suite's S lines and summary kept as evidence.

No hosted deployment, Safari check, browser matrix, accessibility audit or load test unless the
maintainer asks.

## Exclusions and reasons

- Lowering or removing roles, disabling accounts and their timing: the removal milestone.
- Projects as an access level, deny rules, editors inviting others, listing boards: later
  milestones (the access contract reserves room for them).
- Sign-in, sharing screens, refused states and hosted save states in the web app: the web
  client milestone. The web app's code and output do not change here.
- Hosted pictures and comments: their own milestones; images are refused on hosted boards.
- Presence, offline editing and recovery screens.
- Email sending (invitations are links the owner shares), public or anonymous links, billing,
  enterprise groups.
- Any hosted deployment, scheduled backups to R2, and a real point-in-time restore: they need
  the hosted service and are a separate, approved step.
- Publishing a Docker image.

## Public references with retrieval dates

Retrieved 2026-10-30: the public references of the contracts listed above, and
[Workers Vitest integration: test APIs](https://developers.cloudflare.com/workers/testing/vitest-integration/test-apis/)
(`evictDurableObject` and the WebSocket options for eviction).

## Implementation record

### 2026-10-30 — implemented and validated

- Governing brief: 0003-W1 v1 and only its listed prerequisite versions.
- Branch: `codex/0003-W1-owner-editor-viewer-access`.
- Base: `d0976e6df03ce407321e62d5b21ce2a71ed917ea` (committed main).
- Validated source/test revision: `508d00767a056afef23e868fc29f6b117375dd52`.
- Validated tree: `6a88032e4ba2d32456865a38a433e74ee4437b0e`. The committed tree
  is byte-identical to the index tree used for the full validation below.
- This record is committed separately. The final branch tip is reported in the
  implementation handoff, separately from the validated source/test revision.

The initial CRLF-notices stop was resolved by the planner's 2026-10-30 ruling:
hash original licence bytes, then normalize CRLF and lone CR to LF; no contract,
accepted notices or inventory file was changed.

The first commit attempt was blocked by the public allowlist and retried successfully after the maintainer's 2026-10-30 change; hooks remained enabled.

**Commit and V15.**
`git commit -m "feat(server): enforce owner editor and viewer access"` exited 0
and created `508d00767a056afef23e868fc29f6b117375dd52`; the boundary hooks reported
PASS. Git also printed a `packed-refs.lock` permission warning. The commit's
branch reference and tree were then verified successfully.

`git diff -M --name-status d0976e6..508d00767a056afef23e868fc29f6b117375dd52`
exited 0. Inspection found 88 scoped entries, the adapter's R100 rename, and
`apps/web/package-lock.json` deleted; every other path belongs to items 1–11.
The implementation was unchanged on retry. No application tests or builds were
repeated for this record-only completion, and nothing was pushed, merged or
published.

**Delivered source.** The workspace and accepted root lock; byte-preserving
adapter move and two web import changes; strict codec and transition rules;
host-neutral room modules for ordered edits, receipts, durable waiting, access
replay/epochs, tickets, chunks, snapshots and restores; shared Hono routes,
Supabase SQL and identity boundary; Worker/Node runners and restore fences;
self-host scripts, Dockerfile, local stack configuration/helpers, build/notices
checks, unit/module guards, both shared-suite drivers and contributor docs.
No source under the web app changed beyond the adapter move and those imports.
The new test bootstraps contain the injected clock and faults; production
`worker.ts` and `node.ts` contain none of their switches or names.

**Environment and commands.** Every command used the supplied Node 26.13.0
installation first on PATH; `node --version` printed `v26.13.0`, and
`npm --version` printed `11.20.0`. The supplied stack settings file was passed
through `BOARD_TEST_STACK`. Machine-specific paths are parameterized below:
`$W1_EVIDENCE` is a folder in the system temporary directory. Program names,
arguments and flags are the ones executed.

| Gate | Commands | Final result |
| --- | --- | --- |
| V1 | `npm install --package-lock-only --ignore-scripts --no-audit --no-fund`; `cmp package-lock.json docs/architecture/0001-dependency-lock-v4.json`; absence check for `apps/web/package-lock.json` | All exit 0; SHA-256 `0c0f248e512964df1f89b3c437ee3a25d17a18b25dab3527c17c97893c447d6d` |
| V2 | `npm ci --ignore-scripts --no-audit --no-fund` | Exit 0; 118 packages installed |
| V3 | `npm run typecheck` | Exit 0; all five members |
| V4 | `npm test` | Exit 0; 662 passed, 0 failed, 0 skipped; all 645 base tests retained |
| V5 | `npm run build`; `npm run build:fixtures` | Both exit 0; fixture pages built, not launched |
| V6 | `npm run build:server` | Exit 0; Node/Worker bundles and both notices written and checked |
| V7 | `npm run audit:licenses` | Exit 0; all three artifacts covered; original installed licence bytes hashed before LF normalization |
| V8 | `npm audit --audit-level=high`; `npm audit --omit=dev --audit-level=high` | Both exit 0; both report 0 vulnerabilities on 2026-10-30 |
| V9 | `WRANGLER_LOG_PATH="$W1_EVIDENCE/wrangler.log" npx wrangler deploy --dry-run --outdir "$W1_EVIDENCE/wrangler" -c apps/server/wrangler.json` | Exit 0; dry-run only, nothing uploaded; log redirected to the temporary folder |
| V10 | `npm run test:server:node` with the supplied `BOARD_TEST_STACK` | Exit 0; S1–S50, 50 passed, 0 failed |
| V11 | `npm run test:server:workerd` with the supplied `BOARD_TEST_STACK` | Exit 0; 48 passed, 0 failed; S37/S43 are Node only |
| V12 | `BOARD_TEST_TARGET=docker npm run test:server:node` with the supplied `BOARD_TEST_STACK` | Exit 0; S51–S54, 4 passed, 0 failed |
| V14 | Base/candidate byte comparison of the four distribution files below | Identical |
| V15 | `git diff -M --name-status d0976e6..508d00767a056afef23e868fc29f6b117375dd52` and scoped file/import inspection | Exit 0; 88 entries within items 1–11, adapter R100, old web lock deleted |

Final gate lines:

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
PASS: V12
PASS: V14
PASS: V15
```

V13 and V16 were not run and remain assigned to the review's check run. No
browser, regression harness, Safari/IME/accessibility matrix, hosted deploy,
actual hosted point-in-time restore, or broader load/performance campaign ran.
The local point-in-time rewind is a simulation; its actual hosted
`undoBookmark`/abort lifecycle still requires the first hosted deployment check.

The Supabase stack was already running. No Supabase CLI start, stop or status
command was executed, and neither stack helper was executed here; their clean
clone exercise remains with review. Suite setup applies the schema twice
before exposure, creates independent disposable identities and workspaces, and
cleans up its data. The Docker driver creates its own image, container and
named data volume, sends its temporary settings file with `docker cp`, and
refreshes the selected port after restart. All of those resources were removed;
the supplied base image and stack containers, volumes and networks were left
alone. Read-only image/volume listings found no remaining test-owned resources.

The knowledge-graph index call was blocked by this session's approval policy
(`MCP tool call requires approval, but approval policy is never`), so code
discovery used direct reads. Development failures were corrected before the
validated tree: test-key import usage, guard false positives, workerd cleanup,
Docker settings/port handling, and the simulated rewind's queued-close ordering.
The full requested command sequence was then rerun on the tree named above.

**V14 base build.** A disposable checkout of `d0976e6` was made with
`git archive d0976e6` into the system temporary directory. In that checkout,
`npm --prefix apps/web ci --ignore-scripts --no-audit --no-fund` and
`npm --prefix apps/web run build` both exited 0. The final candidate matches:

| File | Bytes | SHA-256 of both builds |
| --- | ---: | --- |
| `apps/web/dist/app.js` | 841801 | `e2e3fdbfa681ac1a7e01d325a353043b8bb88f5902dc1de64f87293e9271db7f` |
| `apps/web/dist/style.css` | 19837 | `c1bd44f1005f7d36e5814ffea0a239a14940c0dbac7144203b8a42a245829f2c` |
| `apps/web/dist/index.html` | 576 | `66f0d8d097b0c1b88dba01e2fe87c1233b576b3d0019e81401434a7f58a74c8e` |
| `apps/web/dist/THIRD_PARTY_NOTICES.txt` | 16169 | `3367640f4a3b473755079ad41dc46c67bd65ed2dd21a0ca47edcd14944d3a91d` |

**Dependencies.** No dependency outside toolchain v4 was introduced. The root
lock is byte-identical to lock v4. The complete transitive versions, integrity
and licence records remain inventory v4 (217 third-party entries plus 11
workspace entries); neither it nor the accepted notices was edited.

New server runtime dependencies are `hono` 4.13.14, `@hono/node-server` 2.1.5,
`jose` 6.2.14, `@supabase/supabase-js` 2.118.0 and `ws` 8.22.0, all MIT.
The room declares `y-protocols` 1.0.7 (MIT), `lib0` 0.2.119 (MIT) and
`yjs` 13.6.33 (MIT); lib0/Yjs were already in the web graph. The new private
`nextphase-board-sync` and `nextphase-board-room` packages are version 0.1.0,
Apache-2.0 source of this repository. Root development tools, including the
existing compiler/bundler now hoisted to the workspace, are:

| Tool | Exact version | Declared licence |
| --- | --- | --- |
| `@cloudflare/vitest-plugin` | 1.4.11 | MIT |
| `@cloudflare/workers-types` | 5.20261030.1 | MIT OR Apache-2.0 |
| `@types/node` | 26.0.0 | MIT |
| `@types/ws` | 8.18.2 | MIT |
| `esbuild` | 0.28.2 | MIT |
| `supabase` | 2.122.0 | MIT |
| `typescript` | 7.0.2 | Apache-2.0 |
| `vitest` | 5.0.5 | MIT |
| `wrangler` | 4.156.0 | MIT OR Apache-2.0 |

**Shared server-suite evidence.** These are the final runs' S and SUMMARY
lines, preserved without merging results across runners. Storage row bytes
measure column payload; fanout milliseconds are informational, with no pass
threshold.

**Node — V10.**

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
SUMMARY {"runner":"node","checks":50,"pass":50,"fail":0,"measures":{"storage":{"jsonChunks":2,"yjsChunks":2,"largestRowBytes":1048596,"reloadMs":224.94087500000023},"fanoutMs":{"1":33.78295799999978,"10":78.6706669999985,"50":99.1057499999988}}}
```

**workerd — V11.**

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
SUMMARY {"runner":"workerd","checks":48,"pass":48,"fail":0,"measures":{"storage":{"jsonChunks":2,"yjsChunks":2,"largestRowBytes":1048596,"reloadMs":67},"fanoutMs":{"1":18,"10":67,"50":119}}}
```

**Docker — V12.**

```text
PASS: S51 Docker image builds with the pinned digest
PASS: S52 container passes identity join secrecy and edit checks
PASS: S53 Docker restart preserves the board and permits another saved edit
PASS: S54 self-hosted Supabase accepts ES256 and refuses HS256
SUMMARY {"runner":"docker","checks":4,"pass":4,"fail":0,"measures":{}}
```
