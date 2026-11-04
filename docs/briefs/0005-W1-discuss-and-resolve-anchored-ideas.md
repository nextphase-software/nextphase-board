BRIEF VERSION: 0005-W1 v1 (2026-11-03)
# 0005-W1 — Discuss and resolve anchored ideas

Status: Draft. Contracts: [0005 comments v1](../architecture/0005-comments-v1.md) (new),
[0003 sync v6](../architecture/0003-sync-v6.md), [0003 access v5](../architecture/0003-access-v5.md),
[0003 hosted persistence v4](../architecture/0003-hosted-persistence-v4.md),
[0003 hosted storage v5](../architecture/0003-hosted-storage-v5.md),
[0001 interaction v30](../architecture/0001-interaction-v30.md) and
[0001 web modules v28](../architecture/0001-web-modules-v28.md) (new versions). Unchanged and
still in force: [0004 presence v1](../architecture/0004-presence-v1.md),
[0001 toolchain v5](../architecture/0001-toolchain-v5.md) with its
[lock v5](../architecture/0001-dependency-lock-v5.json),
[inventory v5](../architecture/0001-dependency-inventory-v5.json) and
[runtime notices v3](../architecture/0001-runtime-notices-v3.txt),
[0003 identity v3](../architecture/0003-identity-v3.md), [0003 API v4](../architecture/0003-api-v4.md),
[0003 self-host runner v1](../architecture/0003-self-host-runner-v1.md),
[0001 document v11](../architecture/0001-document-v11.md),
[0006 board file v2](../architecture/0006-board-file-v2.md) and
[0001 storage v3](../architecture/0001-storage-v3.md). Where an unchanged contract links an older
version of a contract replaced here, the version named in this brief applies.

## Outcome

Today a hosted board has no way to talk about an idea on it. This milestone adds comments:

- **Start a thread.** Pick the Comment tool (or press C), click a sticky, shape, text, drawing,
  section or an empty spot, type, and post. A round pin with your initial appears where you
  clicked. Anyone with a role on the board, viewers included, can comment.
- **Discuss.** Clicking a pin opens its thread card: the comments oldest first, a Reply field,
  and, for your own comments only, Edit and Delete. Deleting a thread's first comment deletes the
  thread. Every open tab sees each change.
- **Resolve.** Resolve hides the thread from the board and the list, with an Undo toast for your
  own resolve. "Show resolved comments" brings resolved threads back, faded, to reopen. A reply to
  a resolved thread reopens it.
- **Anchored.** A pin on an object moves with it (dragged, nudged, aligned, resized, or moved back
  by undo). When the object is deleted, the thread stays at the object's last place, marked
  detached, with every reply, and never attaches to another object, not even one undo brings back.
- **The list.** In comment mode a Comments panel on the right lists the threads, with filters
  "Show resolved comments" and "Only your threads". Shift+C hides or shows pins.
- **Truthful when things go wrong.** Concurrent actions end the same way on every tab, in the
  order the room saved them. An action on a deleted thread is refused and its author keeps the
  text. While disconnected, typed text stays with Post off; nothing is queued.

Comments live beside the board in the room's own database: they are not undone by Undo, not in
the board's file or JSON export, and not on local boards. The board document, the board file, the
API, identity and presence are unchanged; the room's storage (version 3), its protocol (sync v6)
and one access rule (viewers comment) change. With team features off the app looks and works
exactly as before.

## Read first and prerequisite contracts

- [Contributor guidance](../../CONTRIBUTING.md), [agent instructions](../../AGENTS.md) and
  [engineering standards](../../DESIGN.md).
- The new contracts above. They define every behaviour this brief asks for:
  - the comments contract is what a thread is: the store's meaning, anchors and detaching, the
    actions, the order, the limits and the order of checks;
  - sync v6 is the messages: `comment`, its answers, the snapshot after `joined`, the changes sent
    to everyone, retries, and the shared client's comment API;
  - access v5 is who may do what; hosted persistence v4 is the tables, storage version 3 and its
    migration, and backups;
  - hosted storage v5 is the web app's behaviour and every word; interaction v30 is where each
    part appears, its look as values, its keys, focus order and names; web modules v28 is where
    the code lives.

  Where this brief and a contract seem to differ, the contract wins; report the difference.
- [Sync v5](../architecture/0003-sync-v5.md) and [sync v4](../architecture/0003-sync-v4.md)
  ("Editing", "Retrying", "Waiting edits", "The shared client"), which v6 builds on; and
  [hosted persistence v3](../architecture/0003-hosted-persistence-v3.md) ("Storage version",
  "Backup envelope", "Restores and the restore fence").
- [The 0004-W2 brief](0004-W2-recover-shared-edits-after-interruption.md): the shared client's
  session, the progress deadline, and the scenario's runner drop and held drop, which this
  milestone reuses. [The 0004-W1 brief](0004-W1-edit-together-with-participant-presence.md): the
  server suite's `tests/server/shared.test.ts` and its people. [The 0003-W4
  brief](0003-W4-sign-in-share-and-see-access.md): the hosted board and the local stack.

## Deliverables and boundaries

The base is the main revision that holds this brief, recorded in the implementation record.
Every new source file starts with `// SPDX-License-Identifier: Apache-2.0`. Code follows the
repository's style ([engineering standards](../../DESIGN.md)): readable lines, small modules with
one job each, and comments where a reader needs the reason.

1. **The room** (comments contract; sync v6; access v5; hosted persistence v4), in
   `packages/board-room/src/`:
   - `storage.ts`: the four new tables, `receipts.kind`, and storage version 3 with its one-transaction
     migration ("Storage version"); a new room is created at version 3;
   - `backups.ts`: the two accepted envelope shapes ("Backup envelope");
   - `comments.ts` (new): the comment store. Checking an action in the comments contract's order,
     saving it with its receipt, sequence, ID record and count in one transaction, sending
     `comment_changed` and `comment_saved`, the retry answer, the snapshot, the limits, and the
     anchor work an edit's transaction calls;
   - `room.ts`: routes `comment` messages to the store before the edit path, sends the snapshot
     right after `joined`, and creates rooms at version 3;
   - `edit-session.ts`: keeps the anchors in the edit's own transaction (comments contract,
     "Detaching") and sends the detaching frames after `saved` and `update`;
   - `protocol.ts`: the attachment's comment times.

   Nothing else in `packages/board-room/` changes, and nothing in `apps/server/`: both runners use
   the shared room.
2. **The shared client and rules** (sync v6, "The shared client"; web modules v28):
   - `packages/board-sync/src/comments.ts` (new): the shared types and pure rules;
   - `packages/board-sync/src/session.ts`: the threads, `commentsReady`, `comment()`,
     `retryComment()`, the comment request states and their deadline. It keeps its public API for
     edits; nothing about edits, recovery or undo changes.

   `undo.ts`, `document-adapter.ts` and `packages/board-rules/` do not change.
3. **The web app** (hosted storage v5, interaction v30, web modules v28):
   - `apps/web/src/team/comments/` (new): `rules.ts`, `icons.tsx`, `tool.tsx`, `layer.tsx`,
     `card.tsx` and `panel.tsx`, each with the one job web modules v28 gives it;
   - `apps/web/src/team/hosted-board.ts`: the comment API and its own subscription;
   - `apps/web/src/team/team-app.tsx`: `TeamParts.commentTool` and `commentsLayer` for hosted
     boards;
   - `apps/web/src/ui/palette.tsx`: draws the Comment tool last, in editable and view-only
     toolbars;
   - `apps/web/src/state/use-canvas-input.ts` and `apps/web/src/state/use-hosted-board.ts`: keep
     Comment as the armed tool where they would return to Select;
   - `apps/web/src/App.tsx`: wiring only, within 264 lines;
   - `apps/web/style.css`: the comment rules (interaction v30), added at the end; no existing rule
     changes.
4. **Tests**:
   - `tests/comments.test.mjs` (new), run by `npm test` without Supabase or a browser. Each test
     imports its module inside the test (dynamic `import()`), so a run against the base fails each
     test by name. It covers:
     - **anchors** (`packages/board-sync/src/comments.ts`): the topmost object with a box wins, by
       band then order; a grouped object attaches itself; a point on a connector gives a board point
       even inside a box, and so does an empty point; a point on a section's title outside its box gives a board point; `u` and `v`
       clamp to 0–1; the pin's point follows a move and a non-uniform resize from the saved box;
       a note's display growth is ignored;
     - **detaching**: a removed object detaches at its point on the board before the edit; a
       thread on an object an edit only moves stores the point after it; a detached thread stays
       at its point and never attaches, also when an object with its old ID, or any object, is
       at that point; a board point never changes; the object's label and type word follow
       "Naming the object";
     - **text**: normalising carriage returns and lone surrogates; empty text (spaces, tabs, line
       feeds); 4,000 and 4,001 code points, with an astral character counting 1; refused control
       characters;
     - **colours and lists**: the author colour for fixed person keys, and only the eight colours;
       the filters (open only, show resolved, only your threads by start or reply) and the order by
       sequence;
     - **words** (`apps/web/src/team/comments/rules.ts`): every message in hosted storage v5's
       table that has a rule (times at 59 seconds, 1, 59 and 60 minutes, 23 hours, yesterday, 2 and 6
       days and a week, in this and another year; reply counts 0, 1, 2 with and without Resolved;
       the delete question with 0, 1 and 2 replies; "4,012 / 4,000"), and the accessible names;
     - **placement**: the composer's and card's place on the right, flipped left, with and without
       the panel, clamped at each edge, and below 768 window width;
     - **the shared client**: `comment()` answers `join_required` before the snapshot's `done` (also after a retry's `reset`), and `empty_text` or `too_long` without sending;
       frames build and delete threads and comments in sequence order; `joined` and `reset` clear
       them; a saved or refused request never changes again; ending an attempt makes `sent`
       requests `unconfirmed`; `retryComment()` sends the identical message text again only under
       the same epoch and restore generation, and otherwise answers `join_required`,
       `not_retryable` or `access_changed`, in that order where more than one applies (each
       overlap tested); nothing is sent again by itself on a rejoin or after
       `recovered`; a `comment_refused` causes no rejoin and changes no edit request; the
       ten-second deadline ends the attempt;
     - **the room's storage**, on Node's SQLite: a fresh room at version 3; a version-2 layout
       migrated (receipts become `edit`); an unversioned room with a snapshot becomes 3; one with
       no snapshot stays uncreated; running the migration twice changes nothing;
   - `tests/modules.test.mjs`: the team module list and the import rule of web modules v28. No
     other assertion changes;
   - `tests/presence.test.mjs`: its storage migration test expects version 3 where it expected 2.
     No other assertion changes;
   - `tests/server/shared.test.ts`: the checks S121–S133 below, added after S120 on both runners,
     with `SUMMARY-SHARED` counting them. No existing check changes;
   - `tests/server/driver-workerd.ts` and `tests/server/node-test.ts`: one test control each that
     makes a board's storage look as an older version left it (the comment tables dropped,
     `receipts.kind` removed, `storage_version` set to 1, 2 or none), used by S121. Nothing else
     in them changes;
   - `tests/README.md` lists the new file and the new checks.
5. **Documentation**: `docs/architecture/README.md` lists, for 0005-W1 v1, the seven contracts
   above and that presence v1, toolchain v5, identity v3, API v4, self-host runner v1, document
   v11, board file v2 and storage v3 stay in force.

Outside the named new controls, the existing screens' markup stays exactly as at the base: the
reviewer's A–J comparison allows only the masks listed under validation. The named new controls
are the Comment tool, the attach outline, the pins, the composer, the thread card with its menus,
notes and delete questions, the comments panel with its filter menu, the resolve toast and the
refusal alert, all on hosted boards only. With team features off there is no new control, so the
A–J comparison (V12) adds no mask. Besides items 1 to 5, only this brief's implementation record
changes. If the work seems to need anything outside them, stop and report it.

Nothing else in `apps/server/`, `packages/`, `supabase/`, any `package.json`, `package-lock.json`,
`tests/server/setup.ts`, `tests/server/suite.test.ts`, the board document, the board file, the
export or any other existing test file changes. No hosted Supabase project, deployment or real
person is used.

## Server checks

Each check runs on both runners (`npm run test:server:node`, `npm run test:server:workerd`)
against the local stack, as 0004-W1's S94–S115 do: A and B are workspace editors and C a workspace
viewer, each a `BoardSession` over a transport the test can hold and release. "Saved" means
`comment_saved`; times use the suite's existing `fixedNow` control.

| ID | Check |
| --- | --- |
| S121 | Storage version 3 on open: a new room is at 3; a room made to look as version 2 left it (the test control) opens at 3 with its board, edits and receipts kept and every receipt `kind` `edit`; one made to look unversioned with a snapshot opens at 3; opening again changes nothing; a version-2 backup envelope (no comment tables, no `kind`) restores through the operator route and the room opens at 3 with no threads |
| S122 | A sends each action once (`start`, `reply`, `edit`, `resolve`, `reopen`, `move`, `delete_comment` of a reply, `delete_thread`): each is saved with the next sequence; A's connection gets the action's `comment_changed` before its `comment_saved`, and B's and C's each get it once; and the board's `revision`, `edits` rows, `last_edit_at` and A's undo steps do not change. Sending `start` again with the same request ID and operation answers `comment_saved` with its first sequence and a fresh snapshot, and stores nothing |
| S123 | C (viewer) starts a thread, replies, resolves and reopens: all saved; C's `edit` of the board is refused with `role_too_low` and nothing is stored. B's `edit` and `delete_comment` of A's comment, and `delete_thread` and `move` of A's thread, are refused `not_author`; the workspace owner's too. A's `delete_comment` of its first comment deletes the thread and B's and C's replies, for everyone |
| S124 | A and B reply to one thread at once (both frames in flight): both are saved, each once, and every connection holds the replies in the same sequence order. A `resolve` and a `reopen` sent at once end in the state saved last, on every connection. B's reply to a resolved thread reopens it |
| S125 | A's `reply` to a thread B deleted is refused `thread_deleted`, and A's `edit` of a comment B's thread no longer has is refused `comment_deleted` (or `thread_deleted` once the thread is gone); no receipt is stored, A's session does not rejoin, and A's outstanding edit requests are unchanged |
| S126 | After the owner lowers B to viewer and raises them again, B's comment under the old epoch is refused `epoch_changed`, including a retry of a request saved under that epoch; nothing is stored. After B's access is removed, B's connection is closed (4403) and B gets no thread on any later join attempt; a person with no role gets no `joined` and so no comment frame |
| S127 | After `joined` the room sends `comments_snapshot` `reset` (with the last sequence), every thread in sequence order, every comment in sequence order, then `done`, before any other frame. After the room is evicted or restarted, a new join gets the same threads. A logical restore through the operator route of a backup taken earlier brings back the threads, comments, resolved states, anchors and counts as they were, removes those made after it, and clients get them in their next snapshot |
| S128 | A's thread on a sticky: B moves and resizes the sticky, and A's stored point follows in the same transaction as B's saved edit; no comment frame is sent for it. B deletes the sticky: the thread is detached at the sticky's point before the delete, with the sticky's label and `sticky`, and each connection gets one detaching frame: B's after its `saved`, A's and C's after the `update` (each connection's own order). B's undo brings the sticky back (a new ID): the thread stays detached. The same holds for a thread on an object removed by undo of its addition, and by deleting the section it is in. Reopening keeps all of it. A's `move` of the detached thread onto another sticky leaves it detached at the new point. A `start` on an object no longer on the board is refused `anchor_deleted` |
| S129 | Text: whitespace only is refused `empty_text`; 4,001 code points `too_long`; 4,000 code points with an astral character saved; a control character other than tab and line feed `bad_message`; line feeds and leading spaces kept exactly |
| S130 | A's comment is saved while A's earlier incomplete edit waits in the room (sync v4, "Waiting edits"); the edit is then saved normally. A comment with a request ID A used for an edit is refused `request_id_reused`, and so is an edit with a request ID A used for a comment |
| S131 | Rate limits: A's 100 new comments in one UTC hour are saved, across two connections; the 101st is refused `rate_limited` and a refused attempt does not count; in the next hour A can post again and the earlier hour's count rows are gone. 600 other actions in one hour, then `rate_limited`. Eleven actions on one connection within 1,000 milliseconds: the eleventh is refused |
| S132 | Malformed operations (an unknown action, a missing or upper-case ID, text that is not a string, an anchor with `u` above 1, a coordinate above 1,000,000, a non-numeric value) are refused `bad_message` or `bad_anchor` as the comments contract orders them, with no receipt stored |
| S133 | Limits: a board's 2,001st comment is refused `comment_limit`; with 4 MiB of comment text, a post or an edit that would pass it is refused `comment_limit`. A backup envelope of a board at both limits, the 2,000 comments spread over 200 threads by A, B and C (the suite's own labels), each text made of quotes and line feeds, on a board of three stickies, is under 16 MiB (its size is printed). A version-3 envelope missing a comment table, and a version-2 envelope holding one, are refused 400 `bad_request` |

## Browser checks

The scenario runs in Chrome against the local stack as the 0003-W4 brief sets it up. Supabase
comes from this repository's `supabase/config.toml`, and the Node runner from
`npm run build:server`, with `allowedOrigin` set to the page's origin. A team-on build is served
on that origin. Pages are 1280 × 800 unless a check names another size, with page key events.

The synthetic people, each in their own browser context, are:
- **Ana**, owner of the workspace Acme;
- **Ben**, an Acme editor;
- **Chen**, an Acme viewer;
- **Dee**, signed in, with no role in Acme.

They share the board "Launch plan" with the stickies "Pick the launch date", "Book the venue" and
"Draft the invite", placed with the app's own Sticky tool. The **runner drop** and the **held
drop** are the 0004-W2 brief's. Each check prints `PASS: C1-S<n> <name>` or
`FAIL: C1-S<n> <name>`. The tool is `tools/browser-compare/0005-w1-check.mjs` in the private
repository. The check run keeps its order, may adjust steps and keeps each check's meaning.

| ID | Check |
| --- | --- |
| C1-S1 | Ana's toolbar ends with the Comment tool (after Templates). C arms it: pressed look, Select not pressed, the panel shows the empty words. The pointer over "Pick the launch date" outlines it; a click there shows the new pin and the composer with Post off. The first Escape closes the composer and keeps comment mode; the second leaves it for Select. Pressing the Comment button twice arms and leaves comment mode |
| C1-S2 | Ana starts a thread on "Pick the launch date" and one on an empty spot. Each pin sits with its bottom-left corner at the click, with Ana's initial; Ben's tab shows both; the panel lists them oldest first, "On “Pick the launch date”" and "On the board" |
| C1-S3 | Ben opens Ana's thread and replies (Shift+Enter makes a second line, Enter posts): Ana's open card shows the reply under her comment with both lines, and the list item reads "1 reply" on both tabs |
| C1-S4 | Ana resolves her thread: her card closes, the pin and the item leave on both tabs, and only Ana sees "Thread resolved" with Undo, gone after 5 seconds. When Ana resolves it again and presses Undo within 5 seconds, it is open again on both tabs. With Show resolved comments on, the resolved pin is at opacity 0.55, its item reads "1 reply · Resolved", and its card shows Reopen; Reopen opens it on both tabs |
| C1-S5 | Ana drags "Pick the launch date": her pin moves with it during the drag; Ben's pin is at the new place once the move is saved. Ana resizes it to twice its width and height: the pin keeps its place relative to the sticky on both tabs. A nudge with an arrow key and an align with "Book the venue" move the pin too; Ana's undo of the align moves it back on both tabs; Ben's drag of the sticky moves the pin on both tabs once it is saved |
| C1-S6 | Ben deletes "Pick the launch date": on both tabs Ana's pin stays where it was, with the detached look; its card shows the detached note and the list "Detached: “Pick the launch date” was deleted", with the reply kept. Ben's Undo brings the sticky back and the thread stays detached. Ana starts a thread on "Book the venue" and deletes the sticky: its pin is detached at once on her tab, and on Ben's after the save |
| C1-S7 | Ana closes the board and opens it again: every thread, reply, place, detached and resolved state is as before |
| C1-S8 | Chen's toolbar shows Select, Pan and Comment only. Chen starts a thread on "Draft the invite" and replies to Ana's: both show on Ana's and Ben's tabs. Chen's board-editing keys do nothing and no `edit` frame leaves Chen's page |
| C1-S9 | On Ana's card, More shows on Ana's own comments only, and the thread's More (Delete thread…) on Ana's threads only; Ben sees no More on Ana's comment. Ana edits her comment: "· edited" shows on both tabs. Ana replies, then deletes her own reply after the comment question; Ben's reply has no More for her. Delete comment on her first comment asks the thread question with the reply count and deletes the thread, Ben's reply included, on every tab |
| C1-S10 | Ana has Ben's thread open with text typed; Ben resolves it: Ana's card stays with "ben resolved this thread. Replying reopens it." and her text, and Ana gets no toast. Ana posts: the thread is open again on both tabs |
| C1-S11 | Ana types a reply in Ben's thread; Ben deletes his thread: Ana's card shows "ben deleted this thread, so your reply wasn't posted. Your text is kept below." with her text in the field and Post off; the pin and item are gone. Then, in a second thread of Ben's, Ana posts a reply and the test holds back that outgoing `comment` frame (her socket stays open) while Ben deletes the thread, until Ben's deletion has reached Ana's page, then releases it: the room refuses it `thread_deleted`, and Ana sees the same note with Ben's name and her text kept |
| C1-S12 | Ana and Ben post a reply to one thread at the same moment (both frames released together): both tabs show both replies once, in the same order, and after a reload the order is the same |
| C1-S13 | With Ana's reply typed, the runner drops: the toolbar is Select, Pan and Comment, the status reads "Offline — view only", Post is off, the offline note shows and the text stays. After the restart nothing is posted by itself and no `comment` frame is sent; Ana posts and the reply shows once on both tabs |
| C1-S14 | Ana removes Ben's access while Ben's card is open: Ben sees today's ending dialog and nothing new. Dee opening the board's link gets no board, and no comment frame reaches Dee's page |
| C1-S15 | Keyboard: Tab from the canvas reaches the pins in board order, then Filter, Close and the list; each pin and item's name is the contract's ("Comment thread by ana on “Pick the launch date”, 1 reply"). Enter on a pin opens its card with Reply focused; Escape returns focus to the pin. In a menu, Down, Up, Home, End and Escape behave as interaction v30 says. Typing "c" and "C" in Reply types them; Shift+C outside a field hides and shows the pins. Arrow keys on Ana's own pin move it and send one `move` |
| C1-S16 | Ana drags her own empty-spot pin onto "Draft the invite": it attaches there and follows a later move of it. Ben cannot drag Ana's pin. Only your threads lists Ana's threads and those she replied to; with nothing to list, the filter's empty words show |
| C1-S17 | A comment with line breaks shows them; 4,001 characters show "4,001 / 4,000" in `#a32940` with Post off; 4,000 posts |
| C1-S18 | On the team-off build: no Comment tool, C does nothing, and no request leaves the page for comments |
| C1-S19 | The look matches every value of interaction v30 in these set-ups, each beside the approved mock-up's screen: the tool with the empty panel and outline; the composer; a thread card with two replies and the panel; a comment's menu; resolved with the toast and the filter menu; show resolved; offline; the thread-deleted note; detached. It checks each element's computed style and bounding rectangle at 1280 × 800: lengths and positions within 0.5 pixel; colours, font sizes and weights exactly as computed; text exactly; it prints each value with its result |
| C1-S20 | At 390 × 800 and at 767 × 800 the panel is the sheet (12 from the left and right, 80 from the bottom, height the smaller of 42 % of the viewport and 320) and an open card stays inside the window |
| C1-S21 | Ana starts editing her reply and changes its text; from Ana's second tab that reply is deleted: the first tab shows "This comment was deleted, so your edit wasn't saved. Your text is kept below." with the changed text kept in a read-only field |
| C1-S22 | Ana resolves Ben's thread and Ben deletes it before Ana presses the toast's Undo: the toast's place shows "This thread was deleted." as an alert with Dismiss |
| C1-S23 | The test holds back the room's `comment_saved` for Ana's reply (the room stored it) and closes her socket: the unconfirmed note with Retry shows and her text stays. After the rejoin Retry sends the same request ID, the answer is `comment_saved`, and the reply shows once on both tabs |

**The 0004-W2 checks, amended.** For V13, W2-S1's toolbar reads "the toolbar shows only Select,
Pan and Comment", and the toolbar lists that W2-S13, W2-S14 and W2-S20 assert are Select, Pan and
Comment (hosted storage v5, "The toolbar"; W2-S20's values follow interaction v30 where it amends
v29). Every other W2 check, W2-S5 included, is as the 0004-W2 brief states.

## Numbered acceptance criteria

- 0005-W1-AC01: On a hosted board, an owner, editor or viewer can start a thread on an object or an empty spot, reply, resolve and reopen it; only a comment's author can edit or delete it, and deleting a thread's first comment deletes the thread. Every open tab shows the result, and reopening the board shows the same threads. Someone without access sees no thread and every comment action of theirs is refused.
- 0005-W1-AC02: A thread on an object moves with it (dragged, nudged, aligned or resized by anyone, or moved back by undo) and keeps its place after the board is reopened. When the object is deleted, the thread and its replies stay at the object's last place, marked as detached, and never attach to another object, including one undo brings back.
- 0005-W1-AC03: Concurrent comment actions end the same way on every tab: replies keep the order the room saved them, each saved once; resolving and reopening go to the last saved; an action on a deleted thread or comment is refused and its author is told, with their text kept. While disconnected or after access is removed, posting is off or refused with a visible reason. Pins, the list and threads can be reached, read and operated by keyboard, with names a screen reader reads.

| Criterion | Evidence that shows it |
| --- | --- |
| 0005-W1-AC01 | C1-S1–S4, C1-S7–S9, C1-S14, C1-S16, C1-S17, C1-S19, C1-S20; S121–S123, S126, S127, S129, S131–S133; the text, colour, list and words tests in `tests/comments.test.mjs` |
| 0005-W1-AC02 | C1-S5–S7, C1-S16; S128; the anchor and detaching tests in `tests/comments.test.mjs` |
| 0005-W1-AC03 | C1-S10–S13, C1-S15, C1-S21–S23; S124–S126, S130; the shared-client tests in `tests/comments.test.mjs`; V13 |

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
| V4 | `npm test` passes with 0 failed; every base test file passes unchanged except the changes item 4 names in `tests/modules.test.mjs` and `tests/presence.test.mjs`; `tests/comments.test.mjs` is the only new test file |
| V5 | The off build (with the three settings set) exits 0; its `index.html` and `THIRD_PARTY_NOTICES.txt` are byte-identical to the base build's; its `meta.json` has no input under `node_modules/@supabase/` or `apps/web/src/team/`; `audit:licenses` exits 0 |
| V6 | `build:fixtures` exits 0; the on build exits 0, its `index.html` is byte-identical to the base's on build, and its notices are runtime notices v3 byte for byte; `audit:licenses` exits 0 |
| V7 | `build:server` and the Worker dry run exit 0, and `audit:licenses` exits 0 |
| V8 | `git diff --name-status <base>..<validated>` shows only files of items 1 to 5 (this brief changes only by its implementation record, in a later commit) |
| V9 | C1-S1–S17 and C1-S19–S23 pass on the candidate's team-on build, and C1-S18 on its team-off build |
| V10 | The new checks fail on the base (REC-019). On a fresh local stack started from a checkout of the base (never a stack the candidate used), with the base's team-on build served the same way, every one of C1-S1–S17 and C1-S19–S23 fails. `tests/comments.test.mjs` run against the base fails each of its tests by name. S121–S133 fail on the base's server suite. A check that fails because a control, state, message or table it asserts is missing counts as failing |
| V11 | `test:server:node`: S1–S50, S55–S76, S77–S93 and S94–S133 pass. `test:server:workerd`: S1–S36, S38–S42, S44–S50, S55–S69, S71–S76, S77–S93 and S94–S133 pass (S37, S43 and S70 are Node only). Every summary line has `"fail": 0` |
| V12 | The A–J comparison of the off build against the base's build shows no difference at any checkpoint (markup, focus, canvas drawing and saved records), with only the comparison's existing normalization of a local board's saved-time text. No other mask |
| V13 | The 0004-W2 brief's checks W2-S1–S21, with the toolbar lists amended above, pass on the candidate's team-on build, set up as that brief says, with the stack's access-token life set short for W2-S21 as that check needs. A check that fails is run once more on its own on a fresh stack; both results are reported |

**Who runs what.** The implementer runs V1–V8 and records them. Browsers cannot start there, and
the Supabase stack is not needed for them. The reviewer's check run repeats V1–V8 on a clean clone
and runs V9–V13. Each is reported as one `PASS: V<n>` or `FAIL: V<n>` line, with the scenario's
C1 and W2 lines and the server suite's S lines and summary lines kept as evidence.

Regression runs accepted by the maintainer:
- the full unit suite (V4);
- the server suite on both runners (V11);
- the A–J comparison with team features off (V12);
- the 0004-W2 checks with the toolbar lists amended (V13).

No hosted project, deployment, point-in-time restore, browser matrix, accessibility audit, load
test, physical keyboard, input method or screen-reader session unless the maintainer asks.

## Exclusions and reasons

- **Mentions, notifications, unread state and Mark all as read**: a later Story of the same
  feature.
- **Rich text, emoji pickers, links, images and reactions**: plain text is enough to discuss and
  resolve; images would need hosted pictures, which do not exist yet.
- **Region comments, search and pin clusters when zoomed out.**
- **Comments on local boards, in a board file or in the export**: comments live in the room; how a
  file carries them is a later decision.
- **Queuing comments while disconnected, or resending them by the client itself**: the composer
  keeps the text, and Retry is the person's own choice.
- **Attaching a detached thread again**: hosted undo brings an object back with a new ID (sync
  v4), so re-attaching would need undo to report old and new IDs.
- **Live movement of another person's pin while they drag**: a move reaches others when it is
  saved, as the object itself does today; a live drag would need presence to carry it.
- **Moderation** of other people's comments by the owner; limits counted across boards; measured
  scale or latency targets.

## Public references with retrieval dates

Retrieved 2026-11-03:
- [MDN: `KeyboardEvent.isComposing`](https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/isComposing)
- [MDN: `String.prototype.toWellFormed()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/toWellFormed)
- [MDN: ARIA `menu` role](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Roles/menu_role)
- [Cloudflare: SQLite storage API](https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/)
  (transactions; point-in-time restore is not supported in local development)
- [Cloudflare: Durable Objects limits](https://developers.cloudflare.com/durable-objects/platform/limits/)
  (the row size limit)

## Implementation record

(Appended by the implementer.)


### Implementation — 2026-11-03

- Brief implemented: **0005-W1 v1 only**.
- Base: `86fd7ab41d5a9ec1c243460374b13752362d1f1c` (committed main).
- Branch: `codex/0005-W1-discuss-and-resolve-anchored-ideas`.
- Validated source/test revision: **`ed18861c10e03bc7ef5ca8d0b36fa705823393a7`**
  (`feat(comments): add anchored hosted discussion`). All final checks below refer to
  this source/test tree. This record is appended in a later documentation-only commit;
  the final branch tip is reported separately in the handoff.
- No dependencies, manifest, lock, inventory or notice changes. No publication or push.
- The seven new contracts and required predecessor sections were read before changes.
  No brief/contract disagreement was found. The existing architecture index already
  lists all seven versions and all the unchanged prerequisites, so it needed no edit.
- Graph discovery was attempted first. The tool returned
  `MCP tool call requires approval, but approval policy is never`.
  Direct reads and `rg` were used instead, as this run permits.

The room now stores comments separately from board edits, with positive comment
sequences, receipt kinds, permanent ID history, pruned hourly counts, both capacity
limits and atomic anchor maintenance. The shared client retains serialized messages
for explicit retries and gives comment requests their own states and deadlines. The
web app uses exactly the six comment modules, a separate comment subscription, live
object names, saved order, author-only menus, retained text and the interaction-v30
values. Comment frames return before hosted edit notifications; no edit recovery or
undo rule was changed. `App.tsx` remains **264 lines**.

`tests/comments.test.mjs` adds **27 dynamically imported tests**. S121–S133 are
appended after S120 in the shared server suite; its existing summary counts them.
Only the two specified existing unit-test changes were made: module/import guards
and the migration's expected storage version. Both legacy-storage controls are in
the named test drivers. The CSS and shared server checks retain the base content as
an exact prefix. The validated diff contains **28 paths**, all within items 1–5.

#### Commands and results

Every shell command used the pinned Node bin directory first on PATH. `node --version`
printed `v26.13.0`; `npm --version` printed `11.20.0`. In the commands below,
`W1_TMP` denotes the system temporary directory created with
`mktemp -d -t board-0005-w1`; it holds all scratch sources, logs and build copies.
No machine-specific path is recorded here.

The base builds were made before source changes, using the same settings as the
candidate, and copied with `cp -R apps/web/dist "$W1_TMP/base-off"` and
`cp -R apps/web/dist "$W1_TMP/base-on"` after their respective builds. Each build
command exited 0. The final candidate commands were:

```sh
node --version
npm --version
npm ci --ignore-scripts --no-audit --no-fund
# exit 0; 118 packages installed

git diff --exit-code 86fd7ab -- package-lock.json ':(glob)**/package.json'
# exit 0
npm run typecheck
# exit 0 for all five workspaces
npm test
# exit 0; 863 tests, 863 passed, 0 failed, 0 skipped

BOARD_TEAM_FEATURES=off BOARD_SUPABASE_URL=http://127.0.0.1:55321 BOARD_SUPABASE_ANON_KEY=synthetic BOARD_SERVER_URL=http://127.0.0.1:8796 npm run build
cmp apps/web/dist/index.html "$W1_TMP/base-off/index.html"
cmp apps/web/dist/THIRD_PARTY_NOTICES.txt "$W1_TMP/base-off/THIRD_PARTY_NOTICES.txt"
node --input-type=module -e 'import {readFileSync} from "node:fs"; import assert from "node:assert/strict"; const inputs=Object.keys(JSON.parse(readFileSync("apps/web/dist/meta.json")).inputs); assert(!inputs.some(p => p.startsWith("node_modules/@supabase/") || p.startsWith("apps/web/src/team/")));'
npm run audit:licenses
cp -R apps/web/dist "$W1_TMP/validated-off"
# each exit 0

npm run build:fixtures
BOARD_TEAM_FEATURES=on BOARD_SUPABASE_URL=http://127.0.0.1:55321 BOARD_SUPABASE_ANON_KEY=synthetic BOARD_SERVER_URL=http://127.0.0.1:8796 npm run build
cmp apps/web/dist/index.html "$W1_TMP/base-on/index.html"
cmp apps/web/dist/THIRD_PARTY_NOTICES.txt docs/architecture/0001-runtime-notices-v3.txt
npm run audit:licenses
cp -R apps/web/dist "$W1_TMP/validated-on"
# each exit 0

npm run build:server
npm run audit:licenses
WRANGLER_LOG_PATH="$W1_TMP/wrangler-final.log" npx wrangler deploy --dry-run --outdir "$W1_TMP/validated-worker" -c apps/server/wrangler.json
# each exit 0; Wrangler 4.156.0, dry run only

git diff --check
git diff --cached --check
git commit -m 'feat(comments): add anchored hosted discussion'
# exit 0; both public-boundary hooks PASS

git diff --name-status 86fd7ab41d5a9ec1c243460374b13752362d1f1c..ed18861c10e03bc7ef5ca8d0b36fa705823393a7
# exit 0; only the 28 permitted paths
```

```text
PASS: V1 manifests and lock byte-identical to base
PASS: V2 implementer's npm ci exited 0
PASS: V3 all five workspaces typechecked
PASS: V4 863 unit tests passed, 0 failed
PASS: V5 off build, base HTML/notices comparisons, excluded inputs and license audit
PASS: V6 fixture/on builds, base HTML comparison, runtime notices v3 and license audit
PASS: V7 server build, Worker dry run and license audit
PASS: V8 exact validated commit contains only item-1-to-5 paths
```

Supplemental focused checks:

- `node --test --test-reporter=tap tests/comments.test.mjs` — final run: 27 passed,
  0 failed, including real Node SQLite migration rollback and comment-store actions.
- `node --test --test-reporter=tap tests/comments.test.mjs tests/recovery.test.mjs`
  — 65 passed, 0 failed after removing a redundant comment reset.
- `node --test tests/shapes.test.mjs` — 22 passed, 0 failed after the placement fix.
- `node "$W1_TMP/check-server-additions.mjs"`, then
  `node node_modules/typescript/bin/tsc --noEmit -p "$W1_TMP/additions.tsconfig.json"`
  — both exit 0. The scratch generator copies S121–S133 and their new helpers
  verbatim, with typed declarations for the existing harness, and copies the new
  Worker control verbatim. It checks those plus the complete Node test driver with
  strict ES2022/Bundler settings and the installed Node/Worker/test declarations.
  This checks the additions without changing existing checks. It does **not** run
  any server check.

The normal workspace typecheck excludes server-test files. A supplemental strict
compile of the whole existing server-test harness failed on the candidate and on
scratch copies from the base: the old Vitest `inject<T>` calls, the circular `Client`
return inference and the existing Worker `rows` generic are examples. Those existing
checks were preserved; the successful focused typecheck above is not a claim that
the entire old harness typechecks.

Development failures were corrected before the validated revision: library declarations
lack `toWellFormed`/`isWellFormed`, so the shared module uses an equivalent surrogate
normalization; Node's strip-only loader rejects parameter properties, so the room
uses explicit fields; and an overbroad functional-setter change made one existing
shape-placement test fail (860/861 passed in that intermediate run). The placement
path was restored without changing the test. Final results are the PASS lines above.

Git printed a nonfatal sandbox denial while trying to create `packed-refs.lock`.
The commit exited 0, its full hash and branch were verified, and the worktree was
clean before this record was appended. No hook was bypassed.

#### Deferred review checks and exclusions

**V9–V13 were not run and remain the review's check run:** V9 is C1-S1–S23 on the
specified builds; V10 is the fresh-base negative control (browser, unit and server);
V11 is the complete server suite on both runners, including S121–S133 and its summary
lines; V12 is A–J with team features off; V13 is W2-S1–S21 with the four toolbar lists
amended. In particular, W2-S5 has no browser result from this implementation run.

No browser was launched; no Supabase start, stop or status command was run; no stack
or Docker was used; no operating-system keys or events were sent. Browser appearance,
focus, A–J and interruption scenarios are unverified here. No hosted project,
deployment, server suite, accessibility audit, performance campaign or broader matrix
was run. The dry run uploaded nothing. Ignored build metadata is not a changed file.


### Fix round 1 — 2026-11-03

Review v1 assessed candidate `8f0639e96b0b91a586419341c29ee10edcaf7cb5`, whose validated
source/test revision was `ed18861c10e03bc7ef5ca8d0b36fa705823393a7`, as NEEDS WORK.
The review reported two Major test findings; product code was not in question.

| Finding | Reported failure | Fix |
| --- | --- | --- |
| F1 | S130 failed on both runners: after the correct `request_id_reused` refusal, `rawComment` incorrectly required the saved edit's receipt to be absent | S130 opts into an existing-edit-receipt path. Before sending, it requires that receipt's `kind` to be `edit` and captures all receipts and `comment_sequence`. After the expected refusal it requires both snapshots to be unchanged, preserving the original kind, digest and revision. Every other caller retains the original receipt-absence assertion |
| F2 | S121 failed on workerd because `legacyStorage` evicted the room and S121's following `wake()` attempted to evict it again | The control leaves eviction to S121's existing `wake()`, so the next open constructs the room from the legacy storage and runs migration. The storage mutation and S121 assertions are unchanged |

Both checks were read against this brief's S121 and S130 rows and the comments
contract's refusal rule and sync v6's receipt rule. Neither requires a contract
exception. The fix changes only `tests/server/shared.test.ts` (the helper and its
S130 call) and `tests/server/driver-workerd.ts` (the legacy-storage control).
`tests/server/node-test.ts`, every other numbered check, production files,
dependencies, screens and approved interaction requirements are unchanged.

- Branch: `codex/0005-W1-discuss-and-resolve-anchored-ideas`.
- New validated source/test revision: **`2065d73e9537124fa02c9073eb24936ef58bc896`**
  (`test(comments): fix refusal receipts and migration wake checks`).
- Final branch tip: the later documentation-only commit appending this record,
  reported separately by full hash in the handoff. It changes no validated test
  or production source. No push or publication is authorized or performed.

#### Fix round 1 commands and results

The pinned Node bin directory was first on PATH for every command. Versions were
`v26.13.0` and `11.20.0`. Below, `FIX_TMP` denotes the system temporary directory
created for this round by `mktemp -d -t board-0005-w1-fix1`. `BASE_TMP` denotes the
previous implementation's system temporary evidence directory, which still holds
the original `86fd7ab` base builds and the focused typecheck generator. All new
scratch files and build copies stay in `FIX_TMP`; no machine-specific path or
scratch file is committed.

```sh
node --version
npm --version
npm ci --ignore-scripts --no-audit --no-fund
# exit 0; 118 packages installed

git diff --exit-code 86fd7ab -- package-lock.json ':(glob)**/package.json'
# exit 0
cp "$BASE_TMP/check-server-additions.mjs" "$FIX_TMP/check-server-additions.mjs"
node "$FIX_TMP/check-server-additions.mjs"
node node_modules/typescript/bin/tsc --noEmit -p "$FIX_TMP/additions.tsconfig.json"
# each exit 0; focused strict typecheck of S121–S133 and the driver controls
node "$FIX_TMP/check-refusal-helper.mjs"
# exit 0; 9 isolated helper controls, no server or stack
npm run typecheck
# exit 0 for all five workspaces
npm test > "$FIX_TMP/unit.tap"
rg '^not ok|^# tests|^# pass|^# fail' "$FIX_TMP/unit.tap"
# exit 0; 863 tests, 863 passed, 0 failed

BOARD_TEAM_FEATURES=off BOARD_SUPABASE_URL=http://127.0.0.1:55321 BOARD_SUPABASE_ANON_KEY=synthetic BOARD_SERVER_URL=http://127.0.0.1:8796 npm run build
cmp apps/web/dist/index.html "$BASE_TMP/base-off/index.html"
cmp apps/web/dist/THIRD_PARTY_NOTICES.txt "$BASE_TMP/base-off/THIRD_PARTY_NOTICES.txt"
node --input-type=module -e 'import {readFileSync} from "node:fs"; import assert from "node:assert/strict"; const inputs=Object.keys(JSON.parse(readFileSync("apps/web/dist/meta.json")).inputs); assert(!inputs.some(p => p.startsWith("node_modules/@supabase/") || p.startsWith("apps/web/src/team/")));'
npm run audit:licenses
cp -R apps/web/dist "$FIX_TMP/off"
# each exit 0

npm run build:fixtures
BOARD_TEAM_FEATURES=on BOARD_SUPABASE_URL=http://127.0.0.1:55321 BOARD_SUPABASE_ANON_KEY=synthetic BOARD_SERVER_URL=http://127.0.0.1:8796 npm run build
cmp apps/web/dist/index.html "$BASE_TMP/base-on/index.html"
cmp apps/web/dist/THIRD_PARTY_NOTICES.txt docs/architecture/0001-runtime-notices-v3.txt
npm run audit:licenses
cp -R apps/web/dist "$FIX_TMP/on"
# each exit 0

npm run build:server
npm run audit:licenses
WRANGLER_LOG_PATH="$FIX_TMP/wrangler.log" npx wrangler deploy --dry-run --outdir "$FIX_TMP/worker" -c apps/server/wrangler.json
# each exit 0; Wrangler 4.156.0, dry run only

git diff --exit-code 8f0639e -- apps packages supabase package.json package-lock.json tests/server/node-test.ts
git diff --check
git diff --cached --check
git commit -m 'test(comments): fix refusal receipts and migration wake checks'
# each exit 0; both public-boundary hooks PASS

git diff --name-status 8f0639e..2065d73
git diff --name-status 86fd7ab..2065d73
# exit 0; fix is exactly the two permitted test paths; overall milestone scope unchanged
```

```text
PASS: V1 every manifest and package-lock.json byte-identical to the original base
PASS: V2 npm ci exited 0
PASS: V3 npm run typecheck exited 0 for all five workspaces
PASS: V4 863 unit tests passed, 0 failed
PASS: V5 off build, original base HTML/notices, excluded inputs and license audit
PASS: V6 fixture/on builds, original base HTML, runtime notices v3 and license audit
PASS: V7 server build, Worker dry run and license audit
PASS: V8 validated fix changes only the two permitted test files; overall milestone scope preserved
```

The focused server typecheck uses the previous record's method: the S121–S133
section and Worker control are copied verbatim, the unchanged harness is represented
by typed declarations, and the complete Node test driver is included. It passed
with the revised helper. In this checkout, `npm run typecheck` covers the five
workspace sources but its configs exclude server-test files; the previous record's
whole-harness typing limitation is unchanged. No config or pre-existing check was
changed to hide it, and no server suite was executed.

The temporary refusal-helper harness extracts and runs the revised helper with
in-memory driver responses. Its nine controls accept an unchanged existing edit
receipt and an absent fresh receipt, and require assertion failures for a newly
stored refused receipt, a changed digest, revision or kind, a removed original
receipt, an extra receipt, or an advanced comment sequence. These are helper
controls, not results for S121 or S130 against either real runner.

Scope inspection verified that all other numbered checks are byte-identical to
the reviewed candidate, the Worker's existing `wake()` and other controls are
unchanged, the Node driver is unchanged, and production files have no diff from
that candidate. Graph discovery remained unavailable under the approval policy;
direct reads were used. Git again printed a nonfatal `packed-refs.lock` permission
warning, but the fix commit exited 0 and its branch and full hash were verified.
No hooks were bypassed.

**V9–V13 remain for the review's check run**, including both server runners and the
rechecks of S121 and S130. No claim is made here that those runner checks pass.
No browser, Supabase CLI command, Docker, stack, operating-system input, deployment,
new dependency, production change, merge or push was used in this round.


### Fix round 2 — 2026-11-03

Review v2 assessed candidate `b6d79ab28d03a33610c93384ee83cc9c167657a4`, whose validated
revision was `2065d73e9537124fa02c9073eb24936ef58bc896`, as NEEDS WORK for F3
(Minor, contract). It reported that fix round 1's S121 and S130 now pass on both
runners; those server checks were not rerun here.

**Finding.** The card menus' absolute offsets were measured inside the card's 1 px
border. C1-S19 reported a comment menu right edge of 751 where interaction v30's
outer-edge measurement required 752, outside its 0.5 px tolerance. The same border
also added 1 px to the thread menu's top offset.

**Change.** In `apps/web/src/team/comments/card.tsx`, the shared right offset for
these two card menus is now 5 px inside the padding edge, yielding 6 px from the
card's outer right edge. The thread menu's top offset is now 39 px inside the
padding edge, yielding 40 px from the outer top. A comment explains the border
adjustment. The comment menu's existing `row.offsetTop + 36 - node.scrollTop`
expression is unchanged, so its row-relative top placement stays unchanged.
The filter menu, shared menu component, stylesheet and every other screen control
are unchanged. No base style rule was edited. This meets interaction v30's
"Menus" section without a contract exception.

- Branch: `codex/0005-W1-discuss-and-resolve-anchored-ideas`.
- New validated source revision: **`f3cd847a0ebe6f25c0dcb35f3bb6d61800e260b5`**
  (`fix(web): align comment menus with card border edges`). Tests are unchanged
  from the reviewed candidate. The fix's entire source diff is one file.
- Final branch tip: the later documentation-only commit appending this record,
  reported separately by full hash in the handoff. It changes no validated source.
  No push or publication was performed.

#### Fix round 2 commands and results

Every command used the pinned Node bin directory first on PATH. `node --version`
printed `v26.13.0`; `npm --version` printed `11.20.0`. `FIX_TMP` below denotes the
system temporary directory created by `mktemp -d -t board-0005-w1-fix2`.
`BASE_TMP` denotes the original implementation's preserved system temporary
base-build directory. New build copies and logs are outside tracked paths.

```sh
node --version
npm --version
npm ci --ignore-scripts --no-audit --no-fund
# exit 0; 118 packages installed

git diff --exit-code 86fd7ab -- package-lock.json ':(glob)**/package.json'
# exit 0
npm run typecheck
# exit 0 for all five workspaces
npm test > "$FIX_TMP/unit.tap"
rg '^not ok|^# tests|^# pass|^# fail' "$FIX_TMP/unit.tap"
# exit 0; 863 tests, 863 passed, 0 failed

BOARD_TEAM_FEATURES=off BOARD_SUPABASE_URL=http://127.0.0.1:55321 BOARD_SUPABASE_ANON_KEY=synthetic BOARD_SERVER_URL=http://127.0.0.1:8796 npm run build
cmp apps/web/dist/index.html "$BASE_TMP/base-off/index.html"
cmp apps/web/dist/THIRD_PARTY_NOTICES.txt "$BASE_TMP/base-off/THIRD_PARTY_NOTICES.txt"
node --input-type=module -e 'import {readFileSync} from "node:fs"; import assert from "node:assert/strict"; const inputs=Object.keys(JSON.parse(readFileSync("apps/web/dist/meta.json")).inputs); assert(!inputs.some(p => p.startsWith("node_modules/@supabase/") || p.startsWith("apps/web/src/team/")));'
npm run audit:licenses
cp -R apps/web/dist "$FIX_TMP/off"
# each exit 0

npm run build:fixtures
BOARD_TEAM_FEATURES=on BOARD_SUPABASE_URL=http://127.0.0.1:55321 BOARD_SUPABASE_ANON_KEY=synthetic BOARD_SERVER_URL=http://127.0.0.1:8796 npm run build
cmp apps/web/dist/index.html "$BASE_TMP/base-on/index.html"
cmp apps/web/dist/THIRD_PARTY_NOTICES.txt docs/architecture/0001-runtime-notices-v3.txt
npm run audit:licenses
cp -R apps/web/dist "$FIX_TMP/on"
# each exit 0

npm run build:server
npm run audit:licenses
WRANGLER_LOG_PATH="$FIX_TMP/wrangler.log" npx wrangler deploy --dry-run --outdir "$FIX_TMP/worker" -c apps/server/wrangler.json
# each exit 0; Wrangler 4.156.0, dry run only

git diff --check
git diff --cached --check
git commit -m 'fix(web): align comment menus with card border edges'
# each exit 0; both public-boundary hooks PASS

git diff --name-status 86fd7ab..f3cd847
git diff --name-status b6d79ab..f3cd847
# each exit 0; original milestone scope preserved; this round changes only card.tsx
```

```text
PASS: V1 every manifest and package-lock.json byte-identical to the original base
PASS: V2 npm ci exited 0
PASS: V3 all five workspaces typechecked
PASS: V4 863 unit tests passed, 0 failed
PASS: V5 off build, original base HTML/notices, excluded inputs and license audit
PASS: V6 fixture/on builds, original base HTML, runtime notices v3 and license audit
PASS: V7 server build, Worker dry run and license audit
PASS: V8 validated fix changes only card.tsx; overall milestone scope preserved
```

Scope inspection compared the complete card file with the reviewed candidate and
verified exactly the two offset changes and explanatory comment. The stylesheet
and filter panel are byte-identical to that candidate, and the stylesheet still
retains the original `86fd7ab` content as its exact prefix. All tests and other
source files are unchanged. Graph discovery again returned the approval-policy
rejection, so direct reads were used. Git printed its nonfatal `packed-refs.lock`
permission warning; the commit exited 0, its branch and full hash were verified,
and no hooks were bypassed.

**V9–V13 remain for the review's check run.** In particular, C1-S19's real browser
geometry has not been measured here; typechecking, unit tests and successful builds
do not substitute for that check. No browser, Supabase CLI, stack, Docker,
operating-system input, server suite, deployment, new dependency, merge or push
was used in this round.
