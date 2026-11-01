BRIEF VERSION: 0004-W1 v1 (2026-10-31)
# 0004-W1 — Edit together with participant presence

Status: Draft. Contracts: [0004 presence v1](../architecture/0004-presence-v1.md) (new),
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
