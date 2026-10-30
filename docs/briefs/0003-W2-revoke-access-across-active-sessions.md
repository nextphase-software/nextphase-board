BRIEF VERSION: 0003-W2 v1 (2026-10-30)
# 0003-W2 — Revoke access across active sessions

Status: Draft. Implementation starts only after the maintainer commits this brief and its
contracts to main: [0003 access v3](../architecture/0003-access-v3.md),
[0003 API v3](../architecture/0003-api-v3.md), [0003 sync v2](../architecture/0003-sync-v2.md)
and [0003 identity v2](../architecture/0003-identity-v2.md). Unchanged and still in force:
[0003 hosted persistence v2](../architecture/0003-hosted-persistence-v2.md),
[0003 self-host runner v1](../architecture/0003-self-host-runner-v1.md),
[0001 document v11](../architecture/0001-document-v11.md),
[0001 toolchain v4](../architecture/0001-toolchain-v4.md) with its lock, inventory and notices,
and [0001 web modules v24](../architecture/0001-web-modules-v24.md). Where an unchanged
contract links an older version of a contract replaced here, the version named in this brief
applies.

## Outcome

A workspace owner can now take access away, not only give it. The owner lowers or removes a
person's workspace role or board grant, and the server works out the person's role on every
board again from what is left: a workspace editor who loses a board grant stays an editor, and
someone removed from the workspace keeps a board they were invited to directly, as a guest.

Every board the change reaches applies it in its own room: from that moment the room refuses the
person's edits, deletes their edits still waiting, and closes their open connections within
2 seconds. Nothing gives the access back: not a new ticket, an old unused ticket, a reconnect,
an export, a list, a slow lookup racing the removal, nor a restore from an older backup. The
owner's reply says `done` once every affected board has applied the change and `pending` until
then; a retry every minute finishes any change a board missed. The operator can also disable a
person everywhere, and enable them again.

Nothing is deployed and the web app does not change; a later milestone adds the screens.

## Read first and prerequisite contracts

- [Contributor guidance](../../CONTRIBUTING.md), [agent instructions](../../AGENTS.md) and
  [engineering standards](../../DESIGN.md).
- The four new contracts above: they define every behaviour this brief asks for. Where this
  brief and a contract seem to differ, the contract wins; report the difference.
- [The 0003-W1 v1 brief](0003-W1-owner-editor-viewer-access.md) and
  [the 0003-W3 v1 brief](0003-W3-discover-and-reopen-workspace-boards.md): the server, the room,
  the local Supabase stack, the shared server suite S1–S54, the lists file S55–S76, their
  identities and the test proxy, which this milestone extends.
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
   - `people.disabled boolean NOT NULL DEFAULT false`;
   - the `access_deliveries` table of access v3, primary key (`change_number`, `board_id`),
     removed with its change or its board, with row-level security and no row rule, and an index
     on the deliveries not yet applied;
   - deliveries written in the same transaction as each access change (a trigger on
     `access_changes`, or the write functions themselves);
   - `write_member_role` and `write_board_grant` accepting a lower role and refusing the owner's
     rows with `owner_row_immutable`; the new functions `remove_member`, `remove_grant`,
     `disable_person`, `enable_person`, `record_access_receipt`, `pending_access_boards` and
     `pending_deliveries` of access v3; `accept_invitation` as access v3 "Invitations" says for
     the owner; `accept_invitation` refusing a disabled person with
     `account_disabled`; `board_role` returning null for a disabled person; every row rule
     returning no rows to a disabled person. New functions are `SECURITY DEFINER` with an empty
     `search_path`, executable only by the service role.
2. **The room.** In `packages/board-room/`:
   - replay, as access v3 "Taking access away" and "Replay" say: where a person's role falls, the
     lower role (or their removal from the copy), the raised epoch and the deletion of their
     connections' waiting edits in one storage transaction, then the closes; after every replay,
     the comparison of open connections with the copy and the close it calls for (4409 when the
     role is now higher than the one the connection joined under, 4403 otherwise);
   - the room's delivery entry point (today `changed()`) answers with the watermark only after a
     replay whose Supabase call succeeded, and with an error when the room is locked or could
     not reach Supabase.
3. **The server.** In `apps/server/`:
   - the routes of API v3 "Changing and removing roles" (the two `PUT` routes now lowering, the
     two `DELETE` routes, `removal` in their replies and in the members and grants lists, the
     rows with `role` null while a removal is pending) and the operator routes
     `POST /operator/people/:person/disable` and `/enable`;
   - delivery as access v3 "Delivery" says, in a module that replaces `src/fanout.ts` (for
     example `src/delivery.ts`): the boards with deliveries not yet applied, at most 10 rooms at a
     time, receipts through each room's watermark, one delivery at a time per process, and the
     `done` or `pending` answer for a person and a scope;
   - the Worker's `scheduled()` handler running a delivery, and `"triggers": { "crons":
     ["* * * * *"] }` in `apps/server/wrangler.json`; on the Node server a one-minute timer that
     runs a delivery and is stopped when the server stops. The timer's interval may be an option
     of `startNode` for tests, as the clock already is; `worker.ts` and `node.ts` still contain no
     test switch, clock control or fault injection.
4. **Tests.**
   - `tests/server/removal.test.ts`: the checks S77–S93 below, run by the same two commands as
     the shared suite (add it to `include` in `vitest.node.config.ts` and
     `vitest.workerd.config.ts`); each prints `PASS: S<n> <name>` or `FAIL: S<n> <name>`, and the
     file ends with one JSON line `SUMMARY-REMOVAL {"runner", "checks", "pass", "fail",
     "measures"}`. With `BOARD_TEST_TARGET=docker` the file skips all its checks and prints
     nothing.
   - `tests/server/suite.test.ts`: only four changes. S6 also covers the two `DELETE` routes.
     S13 becomes "Change a member and a grant: as S11; a higher or lower role 200 with
     `removal`; the same role 200 with no access change written". S47 also covers the two new
     operator routes. S48 expects the ten tables of access v3 (including `access_deliveries`) and
     also checks that an authenticated person cannot execute the new functions; its other
     assertions stay as they are. No other existing check changes, including the outage checks
     S5 and S40–S44 and the lists file's S70 and S71.
   - `tests/server/setup.ts`: makes fresh independent identities for each removal check that
     needs them (access is taken away, so no check may reuse another's identities), in a workspace
     of the removal file's own. The test proxy can already fail or delay a named SQL function; it
     also gains a hold: keep a named function's reply, after Supabase has computed it, until the
     test releases it. The drivers (`worker-test.ts`, `node-test.ts`, `driver-*.ts`) gain only the controls the checks
     need: make one board's room fail delivery, restart the Node server or evict a Durable
     Object, call the Worker's `scheduled()` handler and await what it started, and restart the
     Node server with a given timer interval. The test Node server runs with its timer off unless
     a check turns it on, so no existing check sees a delivery it did not ask for; local
     development never fires the Cron Trigger.
   - `tests/removal.test.mjs`: unit tests that run without Supabase: rooms called at most 10 at a
     time, a receipt only for a room that answered with a watermark, a second delivery waiting for
     the first, `done` and `pending` from a list of changes, the 4409/4403 close choice, and, on a
     room set up as `tests/room.test.mjs` does, a person's lower role stored with their waiting
     edits deleted in one storage transaction, and a connection left open after that transaction
     (as when a server stops before closing it) closed by the next replay that finds no new
     change.
   - `tests/README.md` lists the new files.
5. **Documentation.** `docs/architecture/README.md` lists the four new contracts as in force for
   the server; `apps/server/README.md` links API v3 instead of API v2 and says that one server
   answers for one Supabase dataset (access v3, "One server per dataset"); nothing else in them
   changes.

Outside the named new controls, the existing screens' markup stays exactly as at the base: the
reviewer's A–J comparison allows only the masks listed under validation. This milestone adds no
control and does not change the web app, so nothing on screen changes; V5's byte comparison of
the web build stands in for A–J.

If the work seems to need anything outside items 1 to 5, stop and report it. Nothing in
`apps/web/`, `package-lock.json`, any `package.json`, the toolchain, the hosted persistence or
self-host runner contracts, the backup format or the saved document format changes.

## Server checks

Each check runs on both runners (`npm run test:server:node`, `npm run test:server:workerd`)
against the local stack. The two runners never run at the same time against the same stack
(access v3, "One server per dataset"). "Within a few seconds" means the check polls for at most
5 seconds. "Refused with R" means the reply carries reason R. "Removal done" means the reply's
`removal` is `done`.

`removal.test.ts` uses a workspace of its own with boards A and B, an owner, and fresh identities
per check: a workspace editor, viewer or guest with grants as each check states. Connections are
opened through tickets and joins as the web app does.

**Changing and removing roles**

| ID | Check |
| --- | --- |
| S77 | Lowering, each 200 with removal done: the owner sets a workspace editor to `viewer` (board details show `viewer` at once); a workspace viewer with no grant to `guest` (board details are 404 and the workspace leaves their `GET /workspaces` at once); a guest's `editor` grant on A to `viewer` (details of A show `viewer` at once). The same calls by a workspace editor, a viewer and a guest with a grant: 403 `role_too_low` (`needed` `owner`); by a plain guest and an outsider: 404. The owner's own member row, and a grant given to the owner: 409 `owner_row_immutable`; `"role": "owner"`: 400 `bad_request`; setting the role a person has: 200 with no access change written |
| S78 | Removing a workspace role: an editor with no grant leaves the workspace (it leaves their `GET /workspaces`; their board list for it is 404); an editor with an `editor` grant on A becomes a `guest` who edits A and gets 404 on B; a guest with no grant leaves the workspace; a guest with a grant: 409 `guest_has_grants`; the owner: 409 `owner_row_immutable`; someone not in the workspace: 404 `not_found` |
| S79 | Removing a grant: from a workspace editor, they stay `editor` on that board; from a guest's last grant, the guest leaves the workspace and its `GET /workspaces`; no such grant: 404 `not_found`; once each removal is done, the members and grants lists no longer hold the removed rows, and every row still listed has `removal` `done` |

**Open connections**

| ID | Check |
| --- | --- |
| S80 | A workspace editor connected to A sends an edit every 10 ms; the owner removes their workspace role. Every edit of theirs answered `saved` is in A's export and no other edit of theirs is (an edit sent after the room step is refused with `epoch_changed` or never answered); their connection is closed with 4403 within 2,000 ms of the owner's request being sent (the time is recorded in `measures` as `closeMs`); the owner's reply says removal done |
| S81 | The same editor has an edit waiting on A (sent before an update it depends on); after their removal, another editor sends the missing update: the waiting edit is never saved and is not in A's export |
| S82 | An editor lowered to `viewer` while connected is closed with 4403; they rejoin, `joined` says `viewer`, an edit is refused with `role_too_low` (`needed` `editor`) and export still works; raised back to `editor`, their connection is closed with 4409 and they rejoin as editor |
| S83 | A workspace editor connected to A who also holds an `editor` grant on A loses the grant: their connection stays open, its epoch is unchanged, and their next edit is saved |

**No way back**

| ID | Check |
| --- | --- |
| S84 | For a connected workspace editor and a connected workspace viewer, each with a ticket for A issued and not yet used: removing their workspace role (removal done) closes their connections with 4403; then a new ticket for A (a reconnect), a join with the unused ticket, export, board details and the workspace's board list are 404, and their recent boards no longer hold A |
| S85 | A workspace editor who has no entry in B's copy asks for a ticket for B; the proxy holds `board_role`'s answer for them (computed while they still had the role). The owner then sends the removal of their workspace role, and as soon as the test sees the removal committed (its access change, read with the service key) it releases the held answer, within 1,000 ms of holding it and so before the server's Supabase timeout. The ticket is refused with 404, the removal then answers with removal done, B's copy does not hold them, and a later ticket for B is also 404 |
| S86 | Delivery to B fails (driver control): removing a connected editor's workspace role answers removal `pending`; the members list shows their row with `"role": null` and `"removal": "pending"`; board details, the board list and a new ticket for A are refused at once; once delivery to B works again, one retry (the Node timer or the Worker's `scheduled()`) closes their B connection with 4403, removal becomes `done` and the row leaves the members list |
| S87 | With `record_access_receipt` failing (503 from the proxy), a removal is applied by the room (the person's connection is closed) but answers `pending`; once the function works again, the next retry makes it `done`, and the room raised the person's epoch once |
| S88 | After a room step whose receipt was not written (as in S87), the Node server is restarted (Node) or the Durable Object evicted (workerd) before any further message; the next retry records the receipt, the room's copy is unchanged by it, and the person is still refused |
| S89 | Board A is backed up while a person is its editor; their workspace role is removed (removal done); the backup is restored: once replayed, a ticket for A is 404 for them and their old ticket cannot join |
| S90 | Retry hosts: on the Node runner, restarted with a 200 ms timer interval, a change left `pending` by a failed delivery becomes `done` with no further request, and the server is restarted again with the timer off; on workerd, one call of the Worker's `scheduled()` handler does the same; `apps/server/wrangler.json` holds the cron `* * * * *` |

**Disabled people**

| ID | Check |
| --- | --- |
| S91 | The operator disables a person who is a workspace editor connected to A and B: 200 with removal done; both connections close with 4403; tickets, export and board details are 404; `GET /workspaces` and `GET /recent-boards` answer 200 with empty lists (the token still verifies); accepting a new invitation is 403 `account_disabled`; disabling them again answers 200 and writes no access change; a person unknown to Board is 404 `person_not_found`; a missing or wrong operator key is 401 `operator_key_invalid` |
| S92 | Enabling the person restores their workspace role and grants: 200 with removal done, a ticket and join for A work and `joined` says `editor` |

**Timing**

| ID | Check |
| --- | --- |
| S93 | A workspace with 1, 10 and 50 boards, one connection of the same editor on each: removing their workspace role closes every connection with 4403 within 2,000 ms of the request; the time until the last close is recorded in `measures` as `removalMs` for each size |

## Numbered acceptance criteria

- 0003-W2-AC01: An owner lowers or removes a person's workspace role or board grant, and the server recomputes the person's role from the levels left; from the moment a board's room applies the change, that board refuses their edits and closes their open connections with 4403 within 2 seconds, on both runners; the owner's reply says `done` only when every affected room has applied it, otherwise `pending`, and a retry completes every pending change.
- 0003-W2-AC02: After a removal no route restores access: join tickets, joins, reconnects, export, board details, lists and recent boards refuse with 404 (or 403 `role_too_low` after a lowering), including when a role lookup races the removal, a room was unreachable at the time, or the room is restored from an older backup; the waiting edits of a closed connection are deleted, never saved; a disabled account is refused everywhere while its token is still valid.
- 0003-W2-AC03: Synthetic tests with independent identities cover a prior editor and a prior viewer: neither receives `saved` for an edit sent after the room step, each sees the close code and refusal reason the contract names, and the workspace-wide removal is timed at 10 and 50 boards on a hosted Worker with every board inside the 2-second target.

AC02's disabled account is refused by every board's room from its room step and at once by every
route that works out roles in Supabase (identity v2, "Disabled people"). AC03's hosted timing is
not part of this implementation: the maintainer runs it after review on a temporary deployment,
with S93's local timing as its baseline; S77–S93 are this implementation's evidence.

| Criterion | Evidence that shows it |
| --- | --- |
| 0003-W2-AC01 | S77–S80, S82, S83, S86, S87, S90, S93 |
| 0003-W2-AC02 | S81, S84–S89, S91, S92 |
| 0003-W2-AC03 | S80, S82 and the fresh identities per check; S93 locally (hosted timing after review) |

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
| V4 | `npm test` passes with 0 failed; every test of the base suite still passes, and `tests/removal.test.mjs` is the only new test file |
| V5 | `npm run build` and `npm run build:fixtures` exit 0, and `apps/web/dist/app.js`, its CSS, `index.html` and `THIRD_PARTY_NOTICES.txt` are byte-identical to the base build's |
| V6 | `npm run build:server` exits 0 and writes `node.mjs`, `worker.mjs` and their notices files; `npm run audit:licenses` exits 0 |
| V7 | The Wrangler dry run exits 0 and uploads nothing |
| V8 | `test:server:node`: S1–S50 (S6, S13, S47 and S48 as amended), S55–S76 and S77–S93 pass; all three summary lines have `"fail": 0` |
| V9 | `test:server:workerd`: S1–S36, S38–S42, S44–S50, S55–S69, S71–S76 and S77–S93 pass (S37, S43 and S70 are Node only); all three summary lines have `"fail": 0` |
| V10 | `BOARD_TEST_TARGET=docker npm run test:server:node`: S51–S54 pass |
| V11 | `git diff --name-status <base>..<validated>` shows only files of items 1 to 5 |
| V12 | On a fresh local stack started from a checkout of the base (never a stack the candidate has used), with the candidate's test files added (`tests/server/removal.test.ts`, `setup.ts`, the drivers, `node-test.ts`, `worker-test.ts`, both configs, `tests/removal.test.mjs`) and the base's production code and schema kept, run both server commands and `npm test`: the new checks fail on the base, every one of S77–S93 and the new unit tests. A check that fails because a module or route it asserts is missing counts as failing |

**Who runs what.** The implementer runs V1–V11 and records them; the reviewer's check run
repeats them on a clean clone and runs V12. Each is reported as one `PASS: V<n>` or
`FAIL: V<n>` line, with the server suite's S lines and summary lines kept as evidence.

No hosted deployment, browser comparison, Safari check, browser matrix, accessibility audit or
load test unless the maintainer asks.

## Exclusions and reasons

- Any screen: the web client milestones show removal and its states; the web app does not
  change here.
- Deleting a board and its trash: a later milestone.
- Projects as an access level, rules that deny access, editors removing others: later.
- Erasing what a person already exported or downloaded: not possible and not promised.
- More than one server answering for one Supabase dataset: not supported (access v3).
- Any hosted deployment, including the timing of AC03 and a real Cron Trigger firing: a separate
  step after review, approved by the maintainer.

## Public references with retrieval dates

Retrieved 2026-10-30: [Cloudflare Cron Triggers](https://developers.cloudflare.com/workers/configuration/cron-triggers/)
(a cron expression runs the Worker's `scheduled()` handler, down to every minute; local
development does not fire them by itself) and
[Supabase: signing out](https://supabase.com/docs/guides/auth/signout) (signing out everywhere
revokes refresh tokens; access tokens stay valid until they expire).
