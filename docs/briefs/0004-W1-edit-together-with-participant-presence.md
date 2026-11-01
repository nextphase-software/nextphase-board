BRIEF VERSION: 0004-W1 v1 (2026-10-31)
# 0004-W1 — Edit together with participant presence

Status: Implemented. Independently reviewed at `4b92783` (pass) and merged into main on
2026-10-31 ([evidence summary](0004-W1-edit-together-with-participant-presence-evidence.md)).
Contracts: [0004 presence v1](../architecture/0004-presence-v1.md) (new),
[0003 sync v3](../architecture/0003-sync-v3.md), [0003 API v4](../architecture/0003-api-v4.md),
[0003 identity v3](../architecture/0003-identity-v3.md),
[0003 access v4](../architecture/0003-access-v4.md) and
[0003 hosted persistence v3](../architecture/0003-hosted-persistence-v3.md). Unchanged and still
in force: [0003 self-host runner v1](../architecture/0003-self-host-runner-v1.md),
[0001 document v11](../architecture/0001-document-v11.md),
[0001 toolchain v4](../architecture/0001-toolchain-v4.md) with its lock, inventory and notices,
and [0001 web modules v24](../architecture/0001-web-modules-v24.md). Where an unchanged contract
links an older version of a contract replaced here, the version named in this brief applies.

## Outcome

Two or more people can already edit one hosted board through its room. This milestone makes
that work as shared editing, without a screen:

- **Presence.** Everyone on a board, viewers included, sees who else is connected, with a label,
  role and colour the room stamps, and each connection's cursor, selection, view and `active`
  flag. Presence is never stored, ends as soon as a connection closes or is closed, and expires
  30 seconds after a connection's last presence message.
- **Same-object edits.** Text typed by two people in one note merges by character; for every
  other property the edit the room saves last wins; a delete beats a concurrent change; and the
  room repairs the merges that two valid edits can produce (two new objects with the same order,
  marks past a shortened text, a connector to a deleted object, a member of a deleted section).
- **Undo per person.** Undo and redo take back only the connection's own steps, property by
  property, and leave other people's later changes alone; undo of a delete brings objects back
  with new IDs.
- **A shared client.** `packages/board-sync/src/session.ts` speaks the room protocol for one
  hosted board with no screen; the tests use it as each person, and a later milestone plugs the
  web app into it.

Nothing is deployed and nothing changes on screen. Boards kept in a browser save exactly the
same documents as before.

## Read first and prerequisite contracts

- [Contributor guidance](../../CONTRIBUTING.md), [agent instructions](../../AGENTS.md) and
  [engineering standards](../../DESIGN.md).
- The six contracts above: they define every behaviour this brief asks for. Where this brief and
  a contract seem to differ, the contract wins; report the difference.
- [The 0003-W1 v1 brief](0003-W1-owner-editor-viewer-access.md),
  [the 0003-W3 v1 brief](0003-W3-discover-and-reopen-workspace-boards.md) and
  [the 0003-W2 v1 brief](0003-W2-revoke-access-across-active-sessions.md): the server, the room,
  the local Supabase stack, the server checks S1–S93, their identities, drivers and test proxy,
  which this milestone extends.
- [0001 web modules v24](../architecture/0001-web-modules-v24.md), rules 9 to 11 and its guard
  tests: `board-sync` and `board-room` use no host API (no `setTimeout`, `fetch` or
  `WebSocket`), and `worker.ts` and `node.ts` hold no test switch.

## Deliverables and boundaries

The base is the main revision that holds this brief, recorded in the implementation record.
Every new source file starts with the line `// SPDX-License-Identifier: Apache-2.0`. Code
follows the repository's style ([engineering standards](../../DESIGN.md)): readable lines, small
modules with one job each, and comments where a reader needs the reason. No dependency is added
or changed.

1. **Text writes.** In `packages/board-sync/src/document-adapter.ts`, a text object's text is
   written as sync v3 "Text writes" says (common start and end kept, by grapheme cluster), and
   the board-level fields are assigned only when their value changes. Nothing else in the
   adapter's mapping changes.
2. **The room.** In `packages/board-room/src/`:
   - `presence.ts` (new): presence v1 as a whole: the placeholder at join, stamping, checks and
     refusals in the contract's order, the message bound, colours by ordinal, the person key,
     `present` and `left`, expiry, and the presence fields kept in the connection's attachment;
   - `conflicts.ts` (new): sync v3 "Editing", step 3 (last saved wins per property unit);
   - `repair.ts` (new): sync v3 "Repairs". It restates the rule a person's own delete applies on
     the web (connectors of a removed object go with it; members of a removed section are
     released); `board-room` may not import `apps/web`, and `packages/board-rules` keeps its four
     modules (its guard test lists them);
   - `room.ts`, `edits.ts`, `edit-session.ts`, `protocol.ts`, `access.ts`: the join with `self`,
     `present`, the 50-connection bound (held joins expire after 5 seconds) and 429 `room_full`;
     the `presence` kind; `left` before every close the room makes (4401, 4403, 4409, 4423, and
     every `left` before any close when a restore closes all); presence expiry in the room's
     existing scheduled wake-up; steps 3, 4 and 6 of sync v3 "Editing" with the room's own update
     stored, broadcast and returned in `saved`; a retry's `saved` with the whole current board;
   - `tickets.ts` and `storage.ts`: the label captured at ticket issue and 400 `invalid_label`
     (identity v3 "Labels", API v4 "Join tickets"); `tickets.label`, storage version 2 and the
     migration of hosted persistence v3 "Storage version".
   `apps/server/src/` changes only if the 429 answer or the attachment needs a line there; the
   Worker's attachment and alarm, and the Node runner's memory and timer, already host the room's
   connection state and wake-ups.
3. **The shared client.** In `packages/board-sync/src/`:
   - `session.ts` (new): sync v3 "The shared client". It exports `BoardSession`, created by
     `BoardSession.join(options)` with `options.ticket()` (resolves to a new join ticket),
     `options.open(ticket)` (resolves to a transport with `send(text)`, `close(code)`, and
     handlers for incoming text and the close code), `options.clock` (`now()` in milliseconds and
     `after(ms, run)` returning a cancel function) and an optional `options.clientId` (the Yjs
     client ID, for tests). It offers at least: the current board; `role`, `self` and the
     others' presence by connection; each request's state (`sent`, `received`, `saved`,
     `refused` with its reason, `dropped`); `edit(board)` returning the request ID; `undo()` and
     `redo()` returning the request ID sent or the reason nothing was sent (`changed_by_others`,
     `undo_invalid`, `nothing_to_undo`, `role_too_low`, `join_required`); `setPresence(input)`;
     a way to be told after every message it applies, a refusal and a close; and `close()`.
     Timers come only from `options.clock`.
   - `undo.ts` (new): sync v3 "Undo on a shared board", used by `session.ts`. The local-board
     history in `apps/web/src/history.ts` does not change.
   The web app does not import either module (web modules v24's guard already allows it only
   `document-adapter.ts`).
4. **Tests.**
   - `tests/server/shared.test.ts` (new): the checks S94–S115 below, run by the same two commands
     as the shared suite (add it to `include` in `vitest.node.config.ts` and
     `vitest.workerd.config.ts`). Each prints `PASS: S<n> <name>` or `FAIL: S<n> <name>`, and the
     file ends with one JSON line `SUMMARY-SHARED {"runner", "checks", "pass", "fail",
     "measures"}`. With `BOARD_TEST_TARGET=docker` the file skips all its checks and prints
     nothing. Every person in it is a `BoardSession`, over a transport the test can hold and
     release in each direction, so each interleaving is a fixed order of messages, not timing.
   - `tests/server/setup.ts`, the drivers (`driver-*.ts`, `node-test.ts`, `worker-test.ts`) and
     `peer.ts`: fresh independent identities for this file (two editors and a viewer per check
     unless the check says otherwise) in a workspace of its own, and only the controls the checks
     need: set a board room's clock and run its scheduled wake-up, and evict a Durable Object
     (where not already present). No existing check changes.
   - `tests/presence.test.mjs` and `tests/shared-editing.test.mjs` (new unit files, run by
     `npm test` without Supabase):
     - presence: each refusal and its order of precedence, the 12,288-byte edge (exactly allowed,
       one byte more refused), 250 and 251 IDs, repeats removed in place, number and view
       bounds; the sliding 1,000 ms window; ordinals, colour reuse and the empty-room reset; the
       person key's value for a fixed board and person; the label (before the last `@`; empty
       and 257-byte labels refused; a 256-byte label kept whole); the largest presence the
       contract allows, with a 256-byte label and every other attachment field at its largest,
       serialized in 16,384 bytes or less, also after a renewal (no email kept); the migration
       on a storage set up as the base creates it, both for a created room (column added,
       tickets deleted, version 2, a second run changes nothing) and for tables with no version
       (column added, still not created); on a room set up as `tests/room.test.mjs` does, `left`
       sent to the others before each close the room makes; a join whose 5-second hold ended
       before it opened is closed with 1013 when 50 others are open, and also when 49 are open and
       one other hold is unexpired (that hold's connection then opens); a connection whose
       attachment is in the base's format (no label, ordinal or presence) is closed with 1012 on
       the next wake, with no `left` and its waiting edits deleted;
     - text writes: insert, delete and replace at the start, middle and end; repeated text
       (`aaa` to `aa` deletes the last cluster, and a concurrent insertion at the start by
       another person survives with the same result in both save orders); surrogate pairs,
       letters with combining marks and joined emoji never split; an unchanged text writes
       nothing; a local board saved and read back through the adapter gives the same document as
       at the base for every object type;
     - last saved wins: for each unit of sync v3 "Property units", two concurrent assignments in
       both save orders and both Yjs client-ID orders keep the later saved; an equal value saved
       later still counts as later;
     - repairs: each of the three, in both save orders; a valid merge is left untouched; a
       connector added and repaired away in one edit has its ID and generation in the identifier
       record, and a later object reusing that ID is refused with `identifier_reused`;
     - undo: the cases of S110–S114 on documents without a room; two moves undone one after the
       other, and an undo after the room's own update reassigned the unit to the same value (the
       guard follows); A moves to G, B sets the same G, A moves to H and undoes to G, and A's next
       undo answers `changed_by_others` and leaves G (a dead guard stays dead); add, undo, redo (the note back with a new ID and generation); a step whose
       result fails validation is dropped with `undo_invalid`; the 100-step cap; two connections
       of one person keep separate steps;
     - the shared client, over a fake transport and clock: presence throttled to one per 100 ms
       with the latest held one sent after; the 15-second resend; presence refused locally;
       rejoin after a refused edit (the refused and dropped requests, cleared undo, the new
       board); `resync` marks the `received` requests `dropped`, sends one new request carrying
       them and leaves `sent` ones waiting; an edit over 1 MiB refused without sending; a `refused` with no `requestId`
       (rejoin, all unsaved dropped) and a presence refusal (reported only); a room close
       reported with its code and no rejoin.
   - `tests/README.md` lists the new files.
5. **Documentation.** `docs/architecture/README.md` lists the six contracts as in force for the
   server; `apps/server/README.md` links API v4 instead of API v3; nothing else in them changes.

Outside the named new controls, the existing screens' markup stays exactly as at the base: the
reviewer's A–J comparison allows only the masks listed under validation. This milestone adds no
control and changes no web source file, so nothing on screen changes; only the bundled adapter
in `apps/web/dist/app.js` differs, and A–J runs with no masks beyond those it already uses.

If the work seems to need anything outside items 1 to 5, stop and report it. Nothing in
`apps/web/src/`, `package-lock.json`, any `package.json`, the toolchain, the Supabase schema,
`supabase/config.toml`, the self-host runner contract, the backup format or the saved document
format changes.

## Server checks

Each check runs on both runners (`npm run test:server:node`, `npm run test:server:workerd`)
against the local stack, never both at once. "Within a few seconds" means the check polls for at
most 5 seconds. "Refused with R" means the reply carries reason R. "Everyone ends equal" means
every connection's board, read back as canonical JSON, and the board's export are byte-identical.
A, B and C are fresh identities per check: A and B workspace editors, C a workspace viewer, on a
board of the file's own workspace. "Held" messages are kept by the test's transport until it
releases them, so both people build their edits on the same board before either sees the other's.
Where a check says "the clock", it is the board room's clock, set by the driver, and "the
wake-up" is the room's scheduled wake-up run by the driver.

**Presence**

| ID | Check |
| --- | --- |
| S94 | A, B and C join in that order. Each `joined` holds `self` with the room's stamps (a lower-case UUID `connection`, `person` equal to the contract's key for that board and person, `label` equal to the part of the person's email before its last `@`, its `role`, its colour) and the placeholder state; B's `present` lists A, C's lists A and B; each earlier connection receives `present` for each later join. A sends a presence with two repeated IDs in its selection: B and C receive `present` with A's stamps and the repeat removed, A receives nothing. C's presence reaches A and B with `role` `viewer`. A second connection of A gets a new `connection` and colour and the same `person`; on a second board A's `person` differs. No presence message carries A's account ID or full email |
| S95 | After 20 presence messages each from A, B and C (paced under the bound), nobody has received `received`, `saved` or `update`, a new join's `revision` equals the revision before, and the export is byte-identical to the export before |
| S96 | A presence naming `label`, `person`, `role`, `colour`, `connection` or `update` (one per message) is refused with `presence_fields` each time and nothing is relayed; A's next valid presence reaches B with the room's stamps |
| S97 | With the clock fixed, A sends 11 presence messages: B receives 10 and A no refusal; after the clock moves 1,000 ms, the next is relayed. On workerd the Durable Object is evicted between the 5th and 6th message and the 11th is still dropped. A presence of exactly 12,288 bytes (250 IDs, padded with spaces) is relayed; one of 12,289 bytes is refused with `presence_too_large`; 251 IDs under 12,288 bytes are refused with `presence_selection_limit`; a message both over 12,288 bytes and with an extra key is refused with `presence_too_large`; a `view` with `width` 0, a coordinate of 1,000,001, an upper-case ID and a string `active` are each refused with `bad_presence` |
| S98 | 50 connections join one board (A's identity may hold several). The 51st ticket's join is answered 429 `room_full` before any upgrade, and the same ticket then gets 401 `ticket_invalid`; after one connection closes, a new ticket joins. The first eight connections' colours are the contract's eight in order and the ninth's equals the first's |
| S99 | B observes A, C observes too. A's connection closes normally: B and C receive `left` with A's `connection`. In turn, a fresh A connection is closed by the room with 4401 (a renewal with another person's token), 4403 (the owner removes the workspace role of a fresh editor, then lowers another fresh editor to viewer), 4409 (a fresh viewer connection whose person is raised to editor) and 4423 (an operator restore): each time the others receive `left` for it and the closed connection receives its code; on the restore, each connection receives `left` for every other connection before its own close. (That the room sends `left` before it closes the connection is a unit test: messages on different sockets have no order between them.) |
| S100 | With the clock fixed at T, A sends a presence. At T + 29,999 the wake-up runs and nobody receives `left`; at T + 30,000 it runs and B and C receive `left` for A. An edit by A and a renewal by A between T and T + 30,000 do not move the deadline. A's connection stays open: its next edit is saved and its next presence reaches B and C as `present`. On workerd the Durable Object is evicted between the presence and the first wake-up |
| S101 | A sends a presence; on workerd the Durable Object is then evicted (on Node, nothing happens between); A sends a second presence: B receives it with A's colour, label and person unchanged, and a new connection D's `joined.present` holds A's second presence |
| S102 | C (viewer) sends a raw `edit`: refused with `role_too_low`, `needed` `editor`; nothing is saved and A and B receive nothing. C's `BoardSession` refuses `edit`, `undo` and `redo` with `role_too_low` and sends nothing |

**Two people, one board** (every case in both save orders unless it says otherwise)

| ID | Check |
| --- | --- |
| S103 | One note's text `abcd`; A and B edit it with held messages: A `Xabcd`, B `abcdY` → `XabcdY`; A `abXcd`, B `abcYd` → `abXcYd`; both insert at the same place (A `abXcd`, B `abYcd`) → both letters kept, the same order in both save orders; `a😀b`: A `a😀Xb`, B `a😀b🚀` → `a😀Xb🚀`; `éx` with é as `e` plus U+0301: A prefixes `A`, B appends `B` → `AéxB`. Everyone ends equal after each case |
| S104 | A moves note N while B edits its text; A changes N's style while B moves it; A edits note N while B edits note M: both changes kept each time; everyone ends equal |
| S105 | A and B move N to different places: the later saved geometry is N's on every connection, in both save orders, with A's and B's Yjs client IDs fixed so that in one of the two orders Yjs alone would keep the value saved first. A changes only N's `x` and B only its `width`: the later saved edit's whole geometry wins. A and B rename the board: the later saved title wins. Everyone ends equal |
| S106 | A deletes N while B edits N's text, in both save orders: both edits are `saved`, N is on no connection, everyone ends equal. A then undoes: N is back on every connection with a new `id` and a new `generation`, its text as A last saw it, and its old `id` is on no connection |
| S107 | Repairs, in both save orders, every edit answered `saved` and everyone ending equal; a `saved` carries `update` exactly when the room promoted or repaired something in that edit, and the check asserts which: (a) A and B each add a note with the same next `order`: both notes kept, the one saved first keeps that order and the other takes the next; (b) N's text is `abcdef`; A shortens it to `ab` while B makes characters 3 to 5 bold: N's marks are cut to its text; (c) A deletes note N while B adds a connector from N to M: the connector is on no connection and its generation is retired; (d) A deletes section S while B moves note M into S: M's `section` is `null`; (e) A deletes note N, which connector K joins to M, while B changes K's style: K is on no connection, and neither `saved` carries `update` (A's own delete removed K; B's change has no effect). In (a)–(d) the edit saved second is answered `saved` with `update`, and its author's board then equals the room's |
| S108 | A and B each add 600 characters to one note whose text limit is 1,000, held: the later edit is refused with `invalid_document`. That person's `BoardSession` reports the request `refused` with that reason and every other request of theirs not yet saved `dropped`, joins again with a new ticket by itself, and then holds the room's board; its `undo()` answers `nothing_to_undo`. The other person's edit stays saved; everyone ends equal |
| S109 | A sends an edit and receives `saved`; A sends the same request ID with the same update again: `saved` with the same revision and `update` holding the whole current board, and nothing new is stored (revision unchanged, export unchanged); the same request ID with a different update is refused with `request_id_reused` |

**Undo per person**

| ID | Check |
| --- | --- |
| S110 | A moves N; B edits N's text; A undoes: N's position is back and B's text kept on every connection. A redoes: N is where A moved it and B's text is still kept. Everyone ends equal after each step |
| S111 | A moves N and changes its colour in one step; B then moves N; A undoes: B's position kept, the colour back. A redoes: only the colour is A's again; B's position stays |
| S112 | A deletes note N, which connector K joins to M (both go); B edits M's text; A undoes: N and K are back with new IDs and generations, K joins the new N to M, B's text on M is kept, and neither old ID is on any connection. A redoes: N and K (under their new IDs) are gone again, and every object on the board, with every property, is as it was just before A's undo (B's text on M included); everyone ends equal. A undoes again: N and K come back with further new IDs |
| S113 | A sets N's geometry to G while B, holding A's update, sets the same G; A's edit is saved first, then B's; A undoes: N stays at G, nothing is sent, and A's `BoardSession` reports `changed_by_others` |
| S114 | A adds a note P; B edits P's text; A undoes: P stays with B's text on every connection, nothing is sent, and A's `BoardSession` reports `changed_by_others` |
| S115 | C (viewer) cannot change the board by any message: a raw `edit` (refused `role_too_low`), a `presence` with an `update` key (refused `presence_fields`), and an unknown kind (refused `bad_message`) leave the revision and the export unchanged, and A and B receive no `update` |

## Numbered acceptance criteria

- 0004-W1-AC01: Two editors and a viewer with independent identities join one hosted board, on both runners; each receives the others' presence (person, label, role, colour, cursor, selection, view) as the room stamps it, and each sees the others' edits once saved. Presence is never stored, never changes the revision or a save state, ends as soon as its connection closes or is closed, and expires 30 seconds after its last message; the bounds of presence v1 hold.
- 0004-W1-AC02: Edits to separate objects and to the same object converge to the same board on every connection under the declared rule, with the room's repairs: text in one note merges by character, any other property keeps the value the room saved last, a delete beats a concurrent change, and concurrent adds, marks past a shortened text, connectors to a deleted object and members of a deleted section are repaired rather than refused; no `saved` edit is lost except by a later saved change to the same property, a delete or a repair. Proven with deterministic interleavings, not timing.
- 0004-W1-AC03: Each person's undo and redo take back only their own steps and leave another person's later changes in place; undo of a delete brings the objects back with new IDs and generations, and undo then redo leaves the board's objects as they were; a viewer cannot change the board by any message.

The on-screen presence (avatars, cursors, selection outlines, following) is a later milestone.

| Criterion | Evidence that shows it |
| --- | --- |
| 0004-W1-AC01 | S94–S101; the presence unit tests in `tests/presence.test.mjs` |
| 0004-W1-AC02 | S103–S109; the text-write, last-saved and repair unit tests in `tests/shared-editing.test.mjs` |
| 0004-W1-AC03 | S102, S106, S110–S115; the undo unit tests in `tests/shared-editing.test.mjs` |

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
git diff --name-status <base>..<validated>
```

Stop the stack afterwards with `npx supabase stop` (for this project only).

| Check | Pass condition |
| --- | --- |
| V1 | `package-lock.json` and every `package.json` are byte-identical to the base's |
| V2 | `npm ci` exits 0 |
| V3 | `npm run typecheck` exits 0 for all five members |
| V4 | `npm test` passes with 0 failed; every test of the base suite still passes unchanged, and `tests/presence.test.mjs` and `tests/shared-editing.test.mjs` are the only new test files |
| V5 | `npm run build` and `npm run build:fixtures` exit 0; `apps/web/dist/index.html`, its CSS and `THIRD_PARTY_NOTICES.txt` are byte-identical to the base build's (`app.js` differs by the adapter only) |
| V6 | `npm run build:server` exits 0 and writes `node.mjs`, `worker.mjs` and their notices files; `npm run audit:licenses` exits 0 |
| V7 | The Wrangler dry run exits 0 and uploads nothing |
| V8 | `test:server:node`: S1–S50, S55–S76, S77–S93 and S94–S115 pass; all four summary lines have `"fail": 0` |
| V9 | `test:server:workerd`: S1–S36, S38–S42, S44–S50, S55–S69, S71–S76, S77–S93 and S94–S115 pass (S37, S43 and S70 are Node only); all four summary lines have `"fail": 0` |
| V10 | `git diff --name-status <base>..<validated>` shows only files of items 1 to 5 |
| V11 | On a fresh local stack started from a checkout of the base (never a stack the candidate has used), with the candidate's test files added (`tests/server/shared.test.ts`, `setup.ts`, the drivers, `node-test.ts`, `worker-test.ts`, `peer.ts`, both configs, both new unit files) and the base's production code kept, run both server commands and `npm test`: the new checks fail on the base, every one of S94–S115 and the new unit tests. A check that fails because a module, field or message it asserts is missing counts as failing |
| V12 | The A–J comparison of the candidate's web build against the base's shows no difference |

**Who runs what.** The implementer runs V1–V10 and records them; the reviewer's check run
repeats them on a clean clone and runs V11 and V12. Each is reported as one `PASS: V<n>` or
`FAIL: V<n>` line, with the server suite's S lines and summary lines kept as evidence.

No hosted deployment, Docker run, browser matrix, accessibility audit, load test or latency
measure unless the maintainer asks.

## Exclusions and reasons

- Any screen (avatars, cursors, selection outlines, following, hiding cursors): a later
  milestone, after the web app can sign in and open a hosted board.
- Spotlight, cursor chat, reactions and audio: later milestones.
- Offline editing, recovering unsaved edits after a disconnect or a refused edit, and delete or
  edit races while disconnected: the next shared-editing milestone.
- A display name stored for a person: later; the label is the email's local part.
- Idle or away states beyond `active`, a typing caret: later.
- Images on hosted boards: still refused (sync v3, step 5).
- Hosted deployment, measured latency or cost, and the Docker runner: not needed for this
  change; the maintainer may ask for them separately.

## Public references with retrieval dates

Retrieved 2026-10-31: [Cloudflare Durable Objects WebSockets](https://developers.cloudflare.com/durable-objects/best-practices/websockets/)
(hibernation; `serializeAttachment` keeps up to 16,384 bytes per WebSocket),
[Cloudflare Durable Object lifecycle](https://developers.cloudflare.com/durable-objects/concepts/durable-object-lifecycle/)
(timers keep an object from hibernating; alarms wake it),
[Yjs document updates](https://docs.yjs.dev/api/document-updates) (updates, and concurrent text insertions kept by both
sides),
[Yjs Y.UndoManager](https://docs.yjs.dev/api/undo-manager) (undo by transaction origin, which
this milestone does not use) and
[Intl.Segmenter on MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/Segmenter)
(grapheme clusters).

## Implementation record (2026-10-31)

Base revision: `9c06551ad0aa27a0cee03c0c027f9a9dff6db88d`.
Branch: `codex/0004-W1-edit-together-with-participant-presence`.
Worktree: `.worktrees/codex-0004-W1`. The worktree was clean at entry.

Validated source/test revision: `3d41733b28b0f8dfe93cfe3b1475186356cc2eb0`
(`feat(sync): add participant presence and shared editing`). All 24 files of that commit
match the source/test snapshot used for the validation below. Its SHA-256 manifest is
recorded at the end; the manifest's SHA-256 is
`150b29dbeb0ac9e66c3a224a072ad8552a83949df3ef972c2d1733df7ab113cd`.
This implementation record is a separate documentation commit after the validated revision;
the final branch tip is reported separately at handoff. No push, merge or publication was made.

**Planner ruling applied.** The initial stop on `apps/web/dist/meta.json` was resolved by
the maintainer's planner ruling: this ignored esbuild metafile records the bundle's inputs
and output sizes, and its change is part of the expected `app.js` change. V5 compares only
`index.html`, the CSS and `THIRD_PARTY_NOTICES.txt`; all three are byte-identical to the
base build. No web source or build script changed. The metafile's only changed source input
is `packages/board-sync/src/document-adapter.ts` (2,875 to 3,711 source bytes); the bundled
application changes from 841,801 to 842,178 bytes. No metadata was removed or rewritten.
No source/test file changed between the recorded Node/unit validation and the resumed
workerd run; the recorded file hashes were verified again before and after committing.

**Work completed.** Grapheme-preserving adapter writes; room-stamped presence and bounds;
join reservations; departure/expiry handling; label capture and storage-version migration;
save-order property promotion, repairs, canonical saved updates and retry replies;
injected-clock shared sessions and per-connection guarded undo; the two unit files and
S94–S115 through BoardSession transports with queues in each direction; independent test
identities; and the specified documentation links. No dependency was added or changed.
No manifest, lock, Supabase schema, backup format, document format, web source or production
runner file changed. Existing S check bodies and base unit tests are unchanged. No unrelated
work was present or changed. The prototype's report and contract notes were read for context;
no prototype source or patch was imported. Graph discovery/index calls required approval
that this environment could not grant, so source discovery used file reads as fallback.

**Commands and results.** Every shell command put the maintainer-provided pinned toolchain
bin directory first on PATH. `node --version` printed `v26.13.0`; `npm --version` printed
`11.20.0`, including on resume. `BOARD_TEST_STACK` was set to the maintainer-provided external
stack settings file for each server command; its machine-specific value is omitted under
AGENTS.md's public-source rule. Node finished with exit 0 and completed cleanup before
workerd was started. Temporary builds, raw logs and comparisons used system temporary
folders, with no temporary files added to the repository.

```text
PASS: V1 byte-compare package-lock.json and every package.json to git show 9c06551:<path>: all 7 identical, verified again on resume
PASS: V2 npm ci --ignore-scripts --no-audit --no-fund: exit 0, 118 packages installed by the implementer
PASS: V3 npm run typecheck: exit 0, all five workspace members
PASS: V4 npm test: exit 0, 726 passed, 0 failed; 678 unchanged base tests and 48 new tests in the two required unit files
PASS: V5 npm run build and npm run build:fixtures: exit 0; index.html, style.css and THIRD_PARTY_NOTICES.txt byte-identical to the base build
PASS: V6 npm run build:server and npm run audit:licenses: exit 0; node.mjs, worker.mjs and both notices files written and verified
PASS: V7 WRANGLER_SEND_METRICS=false WRANGLER_LOG_PATH="$scratch/wrangler.log" npx wrangler deploy --dry-run --outdir "$scratch/out" -c apps/server/wrangler.json: exit 0, uploads nothing
PASS: V8 npm run test:server:node: exit 0, 111 passed, all four summaries have fail 0
PASS: V9 npm run test:server:workerd: exit 0, 108 applicable checks passed, all four summaries have fail 0; S37, S43 and S70 are Node only
PASS: V10 git diff --name-status 9c06551..3d41733b28b0f8dfe93cfe3b1475186356cc2eb0: only the 24 implementation files of items 1–5
```

The base artifact comparison used `git archive 9c06551`, extraction into a system temporary
folder, then `npm ci --ignore-scripts --no-audit --no-fund` and `npm run build` there (both
exit 0), followed by byte comparisons of the generated files. V1 and V5 byte comparisons
were repeated on resume without rerunning application tests or builds, since the tested
source/test files had not changed. `git diff --check` and `git diff --cached --check` pass.
The largest-presence unit assertion passes with 250 IDs, a 256-byte label, maximal numeric
attachment fields and ten rate timestamps, both before and after renewal; serialized
attachment size is within 16,384 bytes and no renewal email is retained.

The implementation was committed with
`git commit -m "feat(sync): add participant presence and shared editing"` (exit 0).
Both PUBLIC BOUNDARY hook checks passed. Git also printed a nonfatal permission warning
for `packed-refs.lock`; the branch reference, resulting commit and all 24 committed file
hashes were verified afterwards. No hook was disabled or bypassed.

Development diagnostics before the final checks included `npm run typecheck` (pass),
`npm test` before adding the new unit files (678 passed), focused runs of
`node --test tests/presence.test.mjs`,
`node --test tests/shared-editing.test.mjs tests/presence.test.mjs` and
`node --test tests/shared-editing.test.mjs`. Initial new-unit failures exposed invalid
synthetic fixture values, an incorrect fixed-key expectation and lazy Yjs root types;
these were corrected before the final 726-test pass. The first full Node run had all
89 base checks pass and four new-check failures (S96, S98, S99, S115): an initial-presence
barrier was missing, Node fetch rejected a test Upgrade header, the shared fixture retained
a redundant direct grant, and an untracked raw edit refusal was treated as an unmatched
no-request-ID refusal. These were corrected before the final 111-check pass below.
No existing check needed changing. The workerd run printed network-loss diagnostics during
injected outage/eviction coverage; it exited 0 with every applicable S check passing.

**Exclusions.** V11, the negative control on a fresh base stack, and V12, the A–J comparison,
are left to the independent review check run. No browser was launched. No Supabase CLI
command, Docker runner, hosted deployment, load/latency campaign or unrelated acceptance
sweep ran. The already-running stack and all its containers, volumes and networks were
left running and unchanged by infrastructure commands. Both drivers completed their own
cleanup. No dependency was added; pinned versions and licensing remain as in toolchain v4.
This handoff does not authorize a merge or another milestone.

### Final Node server evidence

```text
PASS: S94 stamped join and relayed presence never disclose account identity
PASS: S95 presence changes neither revision nor exported board
PASS: S96 presence rejects forged fields and preserves server stamps
PASS: S97 presence bounds and sliding window survive hibernation
PASS: S98 fifty connections consume tickets before refusing the next upgrade
PASS: S99 normal and forced departures carry left and the declared close code
PASS: S100 expiry leaves editing open and only accepted presence renews the deadline
PASS: S101 hibernation retains stamps and the latest presence
PASS: S102 viewer raw and local edit undo redo cannot write
PASS: S103 concurrent text keeps both insertions in every save order
PASS: S104 separate objects and property units keep both edits
PASS: S105 later saved geometry and title beat Yjs client ordering
PASS: S106 delete dominates concurrent text and undo restores a new incarnation
PASS: S107 repairs are saved with the room update only when changed
PASS: S108 invalid text merge refuses then rejoins and drops unsaved work
PASS: S109 receipt retry returns the whole board and rejects reused IDs
PASS: S110 undo redo geometry preserves another writer's text
PASS: S111 partial undo and redo skip another writer's later geometry
PASS: S112 delete undo restores fresh linked IDs and redo preserves the present
PASS: S113 a later equal-valued assignment kills the first writer's guard
PASS: S114 undo add preserves an object another writer edited
PASS: S115 viewer edit forged presence and unknown kind never update a board
SUMMARY-SHARED {"runner":"node","checks":22,"pass":22,"fail":0,"measures":{}}
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
PASS: S13 change a member and a grant with removal and no-op
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
SUMMARY {"runner":"node","checks":50,"pass":50,"fail":0,"measures":{"storage":{"jsonChunks":2,"yjsChunks":2,"largestRowBytes":1048596,"reloadMs":183.4867919999997},"fanoutMs":{"1":107.46333400000003,"10":23.443916999996873,"50":141.22091699999874}}}
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
SUMMARY-LISTS {"runner":"node","checks":22,"pass":22,"fail":0,"measures":{"ackMsWhileCopySlow":0.6347500000001673}}
PASS: S77 lowering roles authorization owner protection and no-op
PASS: S78 removing workspace access preserves direct grants and removes empty guests
PASS: S79 grant removal keeps the highest role and lists omit completed removals
PASS: S80 active edits stop at the room step and saved edits match export
PASS: S81 removal deletes waiting edits before another editor supplies their dependency
PASS: S82 lowering closes 4403 and raising closes 4409 with the new join role
PASS: S83 removing a redundant grant preserves the epoch connection and edits
PASS: S84 removed editors and viewers cannot reuse tickets reconnect export or discover boards
PASS: S85 a held role lookup computed before removal cannot return stale access
PASS: S86 failed delivery leaves a pending removed row until a retry closes its room
PASS: S87 lost receipts remain pending and retry does not advance the epoch twice
PASS: S88 restart after a room step preserves the copy while retry records its receipt
PASS: S89 an older backup cannot restore removed access or unused tickets
PASS: S90 the retry host completes pending delivery without an HTTP access write
PASS: S91 disable removes all board access while tokens still verify and RLS reads vanish
PASS: S92 enable restores the retained workspace role and grants
PASS: S93 workspace removal closes every connection within two seconds at 1 10 and 50 boards
SUMMARY-REMOVAL {"runner":"node","checks":17,"pass":17,"fail":0,"measures":{"closeMs":16.170874999999796,"removalMs":{"1":12.552749999998923,"10":23.25920800000131,"50":59.0500409999986}}}
```

### Final workerd server evidence

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
PASS: S13 change a member and a grant with removal and no-op
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
SUMMARY {"runner":"workerd","checks":48,"pass":48,"fail":0,"measures":{"storage":{"jsonChunks":2,"yjsChunks":2,"largestRowBytes":1048596,"reloadMs":58},"fanoutMs":{"1":50,"10":34,"50":94}}}
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
PASS: S94 stamped join and relayed presence never disclose account identity
PASS: S95 presence changes neither revision nor exported board
PASS: S96 presence rejects forged fields and preserves server stamps
PASS: S97 presence bounds and sliding window survive hibernation
PASS: S98 fifty connections consume tickets before refusing the next upgrade
PASS: S99 normal and forced departures carry left and the declared close code
PASS: S100 expiry leaves editing open and only accepted presence renews the deadline
PASS: S101 hibernation retains stamps and the latest presence
PASS: S102 viewer raw and local edit undo redo cannot write
PASS: S103 concurrent text keeps both insertions in every save order
PASS: S104 separate objects and property units keep both edits
PASS: S105 later saved geometry and title beat Yjs client ordering
PASS: S106 delete dominates concurrent text and undo restores a new incarnation
PASS: S107 repairs are saved with the room update only when changed
PASS: S108 invalid text merge refuses then rejoins and drops unsaved work
PASS: S109 receipt retry returns the whole board and rejects reused IDs
PASS: S110 undo redo geometry preserves another writer's text
PASS: S111 partial undo and redo skip another writer's later geometry
PASS: S112 delete undo restores fresh linked IDs and redo preserves the present
PASS: S113 a later equal-valued assignment kills the first writer's guard
PASS: S114 undo add preserves an object another writer edited
PASS: S115 viewer edit forged presence and unknown kind never update a board
SUMMARY-SHARED {"runner":"workerd","checks":22,"pass":22,"fail":0,"measures":{}}
PASS: S77 lowering roles authorization owner protection and no-op
PASS: S78 removing workspace access preserves direct grants and removes empty guests
PASS: S79 grant removal keeps the highest role and lists omit completed removals
PASS: S80 active edits stop at the room step and saved edits match export
PASS: S81 removal deletes waiting edits before another editor supplies their dependency
PASS: S82 lowering closes 4403 and raising closes 4409 with the new join role
PASS: S83 removing a redundant grant preserves the epoch connection and edits
PASS: S84 removed editors and viewers cannot reuse tickets reconnect export or discover boards
PASS: S85 a held role lookup computed before removal cannot return stale access
PASS: S86 failed delivery leaves a pending removed row until a retry closes its room
PASS: S87 lost receipts remain pending and retry does not advance the epoch twice
PASS: S88 restart after a room step preserves the copy while retry records its receipt
PASS: S89 an older backup cannot restore removed access or unused tickets
PASS: S90 the retry host completes pending delivery without an HTTP access write
PASS: S91 disable removes all board access while tokens still verify and RLS reads vanish
PASS: S92 enable restores the retained workspace role and grants
PASS: S93 workspace removal closes every connection within two seconds at 1 10 and 50 boards
SUMMARY-REMOVAL {"runner":"workerd","checks":17,"pass":17,"fail":0,"measures":{"closeMs":21,"removalMs":{"1":14,"10":34,"50":113}}}
```

### Validated file scope

```text
M	apps/server/README.md
M	docs/architecture/README.md
M	packages/board-room/src/access.ts
A	packages/board-room/src/conflicts.ts
M	packages/board-room/src/edit-session.ts
M	packages/board-room/src/edits.ts
A	packages/board-room/src/presence.ts
M	packages/board-room/src/protocol.ts
A	packages/board-room/src/repair.ts
M	packages/board-room/src/room.ts
M	packages/board-room/src/storage.ts
M	packages/board-room/src/tickets.ts
M	packages/board-sync/src/document-adapter.ts
A	packages/board-sync/src/session.ts
A	packages/board-sync/src/undo.ts
M	tests/README.md
A	tests/presence.test.mjs
M	tests/server/driver-types.ts
M	tests/server/peer.ts
M	tests/server/setup.ts
A	tests/server/shared.test.ts
A	tests/shared-editing.test.mjs
M	vitest.node.config.ts
M	vitest.workerd.config.ts
```

### Validated source/test manifest

SHA-256 followed by repository-relative path; the separate implementation-record commit is excluded:

```text
076862eb416a6005d8ae41472ff4993d5dd552163e7dc359da56f516511b5c51  apps/server/README.md
2b09848eb859b61a58e14c73ece93216f7726cb00b7fa0716f7f625cbe759f44  docs/architecture/README.md
29e36c736c9df81ec205e4231b2f47dd2ef20e7676de9a1437669d3b4ad478a7  packages/board-room/src/access.ts
49c40f7bbbb31030ff1237cdf0943ac48cce658c311fa9f3782a260800fe38a1  packages/board-room/src/conflicts.ts
a3bd66183608a2a5c8768bb375315121327930b1f522c19f94cdd4324a8a9cc0  packages/board-room/src/edit-session.ts
94f7069d307ea8bfb2691e9c6d186fa8f69a2ba8a7f70b9d04259333e1d33d48  packages/board-room/src/edits.ts
c45d18cdaaf167e62fec37dc2b176c84398c9c4aa2d53d5610e4a6cdb47d12e2  packages/board-room/src/presence.ts
67a86a22480c9cc87e2d37e04fe0e22faca9348425e57664091666b6bd1483c0  packages/board-room/src/protocol.ts
1157289cf770d872ec956622b33d49d90a42b071bcb4223ac43f4ef9e2ea41b2  packages/board-room/src/repair.ts
2a443a8d0c11233649317aaed6b47da56425fd03d2c0845fdd966d4b0d38085f  packages/board-room/src/room.ts
10bacd81edd50e9158241a179f55ead0ba157cb6fec6014c86249eb0706cc73e  packages/board-room/src/storage.ts
eceda7e848d29c9683f93c8805d187902addc05b0ce1bb27f969f9daa1e291eb  packages/board-room/src/tickets.ts
d377c3bf17863bf33bad173ae28402922ffac6375539bef7900f235fcd3e1177  packages/board-sync/src/document-adapter.ts
6483ce97948792e78e4afeaa26c974c13f25622733a6161b981ce9508537fc7e  packages/board-sync/src/session.ts
cd30466486ba469b955347341b85b94663968de0ac06d31f9a26198a98a58c12  packages/board-sync/src/undo.ts
78fb3b3296a2a89ee4bb010689d7ff6554ff7266fefa3fce2bcd32d84574b5e5  tests/README.md
23c9a4450cb273e048bd6347db06ddd3d18e8edc9858a192f1bd9bb495524151  tests/presence.test.mjs
d2c980db8f736d3a631722b5b49b6e9bdd1792754728794922c8081cb60bd0fd  tests/server/driver-types.ts
721dd667385783b20c5022ea2ab7927e77c5e72d034ea79c2ff78b167f4006ea  tests/server/peer.ts
4b6071694cd6c922e9d2c9803354a870e3717ef12d0914023ed0166eaee6376a  tests/server/setup.ts
7e50631df24e62f6f1f37b68bc072cc785025b0f307f27cf2850671d56948913  tests/server/shared.test.ts
6da4f221092c4f7f170b1c1900d0d20b20f71174057910c82b019ba67a80bd8b  tests/shared-editing.test.mjs
5df3e21b2587d2db9dde156f5e7bdf804b7f25a66c8113dad4f0be9ee69e0e84  vitest.node.config.ts
11f02c0f0a79dd9566682859935bd085fe9e3df844dba01d79c1be35b30ea4fc  vitest.workerd.config.ts
```
