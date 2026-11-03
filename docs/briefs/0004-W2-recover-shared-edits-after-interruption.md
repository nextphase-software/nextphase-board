BRIEF VERSION: 0004-W2 v1 (2026-11-03)
# 0004-W2 — Recover shared edits after interruption

Status: Draft. Contracts: [0003 sync v5](../architecture/0003-sync-v5.md),
[0003 hosted storage v4](../architecture/0003-hosted-storage-v4.md) and
[0001 interaction v29](../architecture/0001-interaction-v29.md) (new versions). Unchanged and
still in force: [0001 web modules v27](../architecture/0001-web-modules-v27.md),
[0004 presence v1](../architecture/0004-presence-v1.md),
[0001 toolchain v5](../architecture/0001-toolchain-v5.md) with its
[lock v5](../architecture/0001-dependency-lock-v5.json),
[inventory v5](../architecture/0001-dependency-inventory-v5.json) and
[runtime notices v3](../architecture/0001-runtime-notices-v3.txt),
[0003 identity v3](../architecture/0003-identity-v3.md),
[0003 access v4](../architecture/0003-access-v4.md), [0003 API v4](../architecture/0003-api-v4.md),
[0003 hosted persistence v3](../architecture/0003-hosted-persistence-v3.md),
[0003 self-host runner v1](../architecture/0003-self-host-runner-v1.md),
[0001 document v11](../architecture/0001-document-v11.md) and
[0001 storage v3](../architecture/0001-storage-v3.md). Where an unchanged contract links an older
version of a contract replaced here, the version named in this brief applies.

## Outcome

Today, when a hosted board's room connection drops, every edit the room had not yet answered is
dropped. The tab rejoins with the room's board, the edit is gone from the screen unless the room
had saved it, and the status reads **Not saved**. A connection that goes silent without closing
leaves the status at **Saving…** forever. This milestone keeps that work in the open tab:

- **Noticed.** A drop is noticed when the connection closes, when the browser reports `offline`,
  or when an edit gets no progress for 10 seconds. The board turns view only and reads
  **Offline — 1 change waiting**. The banner says the change will be saved when the board is back.
- **Recovered.** On rejoin, if the board was not restored and the person's access did not change,
  the shared client sends each waiting edit again, in order, with its own request ID. The room
  saves each one once: an edit it had already saved is answered from its receipt. The status goes
  Saving… then Saved, and a toast says "Back online. Your change was saved."
- **Told the truth.** When the waiting work cannot be sent again, because the board was restored,
  the access changed or was removed, or the person signed out or could not stay signed in, a notice
  or the ending dialog says how many changes **may not have been saved**, and why. The tab cannot
  know whether the room stored an edit whose answer was lost, so it never says "wasn't saved" for
  them.
- **Asked before leaving.** While changes wait, Back to files, Close this board, Sign out, the
  browser's Back and a changed link ask "Leave before your change is saved?". Closing the tab gets
  the browser's own prompt.

The work stays in memory only: editing while disconnected and keeping work across a reload remain
out of scope (decision 0002). Undo and redo are cleared on every rejoin (sync v5 says why). The
room changes only by the restore generation it adds to `joined`. Access, the API, storage,
presence, every saved format and every dependency are unchanged. With team features off the app
looks and works exactly as before.

## Read first and prerequisite contracts

- [Contributor guidance](../../CONTRIBUTING.md), [agent instructions](../../AGENTS.md) and
  [engineering standards](../../DESIGN.md).
- The new contract versions above. They define every behaviour this brief asks for:
  - sync v5 is the shared client and the room: requests, ending an attempt, recovery, the progress
    deadline and `restoreGeneration`;
  - hosted storage v4 is the web app: one session per board, noticing a drop, counting changes,
    save states, rejoin outcomes, endings, leaving while changes wait, notices and messages;
  - interaction v29 is where each part appears and its look (colours, sizes, spacing, positions,
    focus).

  Where this brief and a contract seem to differ, the contract wins; report the difference.
- [Sync v4](../architecture/0003-sync-v4.md) "Editing" (receipts and "Retrying"), "Waiting edits",
  "Undo on a shared board" and "The shared client", which v5 builds on.
- [Hosted persistence v3](../architecture/0003-hosted-persistence-v3.md) "Restores and the restore
  fence", and [API v4](../architecture/0003-api-v4.md) `POST /operator/boards/:board/restore`.
- [The 0004-W1 brief](0004-W1-edit-together-with-participant-presence.md): the shared client, its
  unit tests and the server suite's `tests/server/shared.test.ts`, which this milestone extends.
- [The 0003-W4 brief](0003-W4-sign-in-share-and-see-access.md): the hosted board
  (`apps/web/src/team/hosted-board.ts`), its closes and retries, and the local stack.
- [The 0003-W5 brief](0003-W5-find-create-and-reopen-boards.md): Back to files, Home and the team
  app's link handling, which the leave question guards.

## Deliverables and boundaries

The base is the main revision that holds this brief, recorded in the implementation record.
Every new source file starts with `// SPDX-License-Identifier: Apache-2.0`. Code follows the
repository's style ([engineering standards](../../DESIGN.md)): readable lines, small modules with
one job each, and comments where a reader needs the reason.

1. **The room** (sync v5, "Joining"): `packages/board-room/src/room.ts` adds `restoreGeneration`,
   read with the existing `meta(storage, "restore_generation")`, to the `joined` it sends. Nothing
   else in `packages/board-room/` changes.
2. **The shared client** (sync v5, "The shared client", "Recovering after an interruption" and
   "The progress deadline"): `packages/board-sync/src/session.ts`. It keeps its public API and
   adds:
   - the request state `waiting`, and each request's group and touched objects;
   - `interrupt()`, `reconnect()`, `discard(reason)` and `restoreGeneration`;
   - the `recovered` and `discarded` reports, and the deadline's `close` report with code 4000 and
     reason `answer_deadline`.

   Timers come only from `options.clock`. `packages/board-sync/src/undo.ts` and
   `document-adapter.ts` do not change.
3. **The web app** (hosted storage v4, interaction v29):
   - `apps/web/src/team/hosted-board.ts`: one session per open board, `reconnect()` for every
     retry, `interrupt()` on the window's `offline` event, `discard()` at the endings, the counts,
     the notices and their Dismiss, and the recovered toast;
   - `apps/web/src/team/notices.ts`, as pure functions: counting changes, the loss record and its
     clearing, the save-state rule, every new message, and the rule that a 1013 or
     `invalid_label` on a rejoin with changes waiting retries instead of ending;
   - `apps/web/src/team/pages.tsx`: the count in the dialogs that end a board, and the leave
     question;
   - `apps/web/src/team/team-app.tsx`: the notice column and banner, the leave question for Back
     to files, Close this board, Sign out and fragment changes, and the `beforeunload` handler;
   - `apps/web/src/state/use-hosted-board.ts`: clear the selection when a rejoined board replaces
     the board;
   - `apps/web/src/ui/board-panel.tsx`: Back to files on a hosted board closes the panel before it
     leaves or asks;
   - `apps/web/src/ui/save-area.tsx`: amber for both Offline states;
   - `apps/web/src/App.tsx`: wiring only, within 264 lines;
   - `apps/web/style.css`: the notice column, the notice, the two focus rings (interaction v29),
     added at the end; no existing rule changes.

   No team module or state hook is added, so web modules v27's guards hold unchanged.
4. **Tests**:
   - `tests/recovery.test.mjs` (new), run by `npm test` without Supabase or a browser. Shared-client
     tests use an injected clock and a transport the test drives; each imports its module inside
     the test (dynamic `import()`), so a run against the base fails each test by name. It covers:
     - **drops and order:** drops before `received`, after `received`, and after the room saved
       (answer lost). Each waiting request is sent again after a rejoin with the same request ID
       and byte-identical update. With three waiting requests, the second is not sent before the
       first is `saved`; a `received` does not advance the queue; the order is the original
       order;
     - **fences:** a rejoin with a different `restoreGeneration` drops with `board_restored` and
       sends nothing, and also wins when the epoch differs too. A different epoch (a raise or a
       lower), and the role `viewer` under the same epoch, drop with `access_changed` and send
       nothing;
     - **the deadline,** with a fixed clock:
       - a request still unanswered at 9,999 ms keeps its attempt; at 10,000 ms the attempt ends,
         the transport is closed with 1000 and the client reports code 4000 `answer_deadline`;
       - a `received` at 9,000 ms keeps the attempt until 18,999 ms and ends it at 19,000 ms;
       - a `saved` cancels the deadline;
       - after the deadline, a late `saved` on the old transport changes nothing;
       - a request sent again gets its own deadline;
     - **discard and close:** `discard(reason)` drops every outstanding request with that reason,
       clears undo and redo, and reports `discarded`; `close()` drops them with `session_ended`
       and nothing is sent again. Neither changes a request already `saved`, `refused` or
       `dropped`, or its reason; a late `saved` for a dropped request is ignored;
     - **ending an attempt:** a send that throws ends the attempt and reports one `close` with code
       1006; after any ending, a message or close from the old transport changes nothing;
     - **recovering:** after a rejoin under a fence, or with nothing waiting, the session is not
       recovering and reports no `recovered`; after a rejoin that sends two requests again it
       reports `recovered` once, with 2;
     - **a refusal during recovery:** an `epoch_changed` refusal makes that request `refused` and
       the rest `dropped` with `access_changed`;
     - **not kept:** a waiting change to an object whose generation the rejoined board retired is
       marked not kept and still sent; an added object absent from the rejoined board, with its
       generation not retired, is not;
     - **edits during recovery:** edits, undo and redo are refused with `join_required` until
       `recovered`, then work;
     - **undo after a rejoin:** undo and redo report `nothing_to_undo` after any rejoin;
     - **the client ID:** the document after a rejoin has a Yjs client ID different from the
       `clientId` option the first `joined` used;
     - **counting changes:** three requests of one group and two ungrouped requests are three
       changes; a group with one request `waiting` and one `saved` counts once as waiting;
     - **the loss record:** per-reason counts (an `access_changed` loss followed by a
       `board_restored` loss gives counts 1 and 1, not 2 for the restore); a recovery's own `saved`
       does not clear it; a deliberate edit created before the newest loss, saved later, does not
       clear it; one created after it, once saved, does, and sending it is not enough;
     - **the save state** (`notices.ts`): each of hosted storage v4's seven states, and each
       ordered pair of them where both apply (the first wins);
     - **every new message** in hosted storage v4's table for N = 1 and N = 2, character for
       character;
     - **the rejoin outcome rule:** a 1013 close and a 400 `invalid_label` on a rejoin with
       changes waiting give a retry; with nothing waiting, and on a first open, they give v1's
       endings; a first outcome already set is kept;
   - `tests/shared-editing.test.mjs`: its `joined` fixtures may gain `restoreGeneration: 0`. No
     existing assertion changes;
   - `tests/team.test.mjs`: the save-state precedence test follows hosted storage v4's order
     (**Not saved** above the Offline states), and the words test's key list gains the new
     message keys. No other existing assertion changes;
   - `tests/grouped-edits.test.mjs`: the test "the group never reaches the wire" sets the second
     connection's Yjs client ID to the first's after its second `joined`, because a rejoin now
     takes a fresh client ID. Nothing else in it changes;
   - `tests/server/shared.test.ts`: the checks S116–S120 below, added after S115 on both runners,
     with `SUMMARY-SHARED` counting them. No existing check changes;
   - `tests/README.md` lists the new file and the new checks.
5. **Documentation**: `docs/architecture/README.md` lists, for 0004-W2 v1, sync v5, hosted
   storage v4 and interaction v29, and that web modules v27, presence v1, toolchain v5, identity
   v3, access v4, API v4, hosted persistence v3, self-host runner v1, document v11 and storage v3
   stay in force.

Outside the named new controls, the existing screens' markup stays exactly as at the base: the
reviewer's A–J comparison allows only the masks listed under validation. The named new controls
are the new save states and banner words, the not-saved notices, the leave question, the counts in
the dialogs that end a board, the recovered toast and the two focus rings. With team features off there is no new control, so the A–J
comparison (V12) adds no mask. Besides items 1 to 5, only this brief's implementation record
changes. If the work seems to need anything outside them, stop and report it.

Nothing else in `apps/server/`, `packages/`, `supabase/`, any `package.json`, `package-lock.json`,
`tests/server/setup.ts`, the drivers, any saved format or any other existing test file changes. No
hosted Supabase project, deployment or real person is used.

## Server checks

Each check runs on both runners (`npm run test:server:node`, `npm run test:server:workerd`)
against the local stack, as 0004-W1's S94–S115 do: A and B are workspace editors and C a workspace
viewer, each a `BoardSession` over a transport the test can hold and release.

| ID | Check |
| --- | --- |
| S116 | A new board's `joined` carries `restoreGeneration` 0. An ordinary wake (on workerd, an eviction) leaves it unchanged. After the operator restore route restores the board, a new `joined` carries a different value, and A's session, which had a waiting sticky, drops it with `board_restored`: the board after the restore has no such object, and no receipt exists for its request ID |
| S117 | A's sticky is saved by the room while the test holds back its `saved`, and then A's connection is closed. After A's rejoin it sends the same request ID and update again and is answered `saved` from the receipt. The board has one copy of the sticky, the revision rose by one in all, and A, B and C end equal |
| S118 | A's edit sent again under an epoch the room no longer holds is refused with `epoch_changed`, and nothing is stored |
| S119 | A makes 80 edits while its connection is held, then drops and rejoins: the 80 are sent again one at a time and saved in order with consecutive revisions, no `resync` is sent, and no waiting edit is left in the room |
| S120 | Deterministic interleavings, each in three phases of A's drop (before `received`, after `received`, and after the room saved A's edit but before `saved` reached A): B deletes the object A changed; B sets the same property unit to another value after A's edit was made; B types in the note A typed in. After A rejoins and its edit is sent again, everyone ends equal and the board follows sync v4's rules: the delete wins (and A's session marks the request not kept), the edit saved last wins the unit, and both typings are kept by character |

## Browser checks

The scenario runs in Chrome against the local stack as the 0003-W4 brief sets it up. Supabase
comes from this repository's `supabase/config.toml`, and the Node runner from
`npm run build:server`, with `allowedOrigin` set to the page's origin. A team-on build is served
on that origin. Pages are 1280 × 800 unless a check names another size, with page key events.

The synthetic people, each in their own browser context, are:
- **Ana**, owner of the workspace Acme;
- **Ben**, an Acme editor;
- **Chen**, an Acme viewer.

They share the board "Launch plan". Two kinds of drop are used:

- A **runner drop** pauses the Node runner process (`SIGSTOP`) while an edit is in flight, then
  kills it (`SIGKILL`) and starts it again on the same data. Everyone is disconnected.
- A **held drop** affects one person only. The test intercepts that page's room WebSocket, holds
  back its next `edit` frame so the room never receives it, and closes the socket. It then holds
  every new connection from that page until it releases them. The others stay connected, so their
  edits, access changes and the operator restore are complete before the affected page rejoins.
  W2-S5–S7, S9 and S21 use it.

A check uses a runner drop unless it says otherwise. The checks never send operating-system
input.

Each check prints `PASS: W2-S<n> <name>` or `FAIL: W2-S<n> <name>`. The tool is
`tools/browser-compare/0004-w2-check.mjs` in the private repository. The check run keeps its
order, may adjust steps and keeps each check's meaning.

| ID | Check |
| --- | --- |
| W2-S1 | Ana pastes a copy of the sticky "Book the venue" (one change: a paste is one edit) and the runner drops: her status reads "Offline — 1 change waiting" in amber; the banner reads "Reconnecting… 1 change is waiting and will be saved when the board is back. You can look around until then."; the toolbar shows only Select and Pan; the pasted sticky stays. After the restart her status goes Saving… then Saved, the toast reads "Back online. Your change was saved.", and Ana, Ben and Chen each show the pasted sticky once, as does the board's export |
| W2-S2 | The test holds back the room's `saved` for Ana's sticky (the room stored it) and closes her socket. After the rejoin her page sends an `edit` with the same request ID and update, the answer is `saved`, the export holds the sticky once, and the board's revision rose by one in all |
| W2-S3 | The same request delivered twice is stored once (a control: the room already does this at the base) |
| W2-S4 | With the runner paused (`SIGSTOP`) and Ana's edit in flight, her status reads Saving… and then, between 10 and 12 seconds after the send, "Offline — 1 change waiting"; after `SIGCONT` the change is saved and the toast shows |
| W2-S5 | During Ana's held drop Ben deletes the sticky Ana moved: after her rejoin she sees "Someone deleted what you changed while you were offline, so 1 change wasn't kept.", the sticky is on no tab, Ana's selection is empty (no "1 objects" bar), and her status reads Saved |
| W2-S6 | During Ben's held drop Ana lowers Ben to viewer: after his rejoin Ben sees "Your access changed while you were offline, so 1 change may not have been saved." above the View only banner; his status reads Not confirmed; his change is on no tab |
| W2-S7 | During Ben's held drop Ana removes Ben's access: Ben sees "You no longer have access to this board" with "The owner of Acme removed your access before 1 change was confirmed, so it may not have been saved." and Close this board; no Reconnecting banner shows; his status reads Not confirmed |
| W2-S8 | During Ana's drop she signs out in another tab: the board tab shows "Sign in again" with "You signed out. Sign in again to keep working on this board. 1 change may not have been saved." |
| W2-S9 | During Ana's held drop the board is restored through the operator route (logical restore): after her rejoin she sees "This board was restored to an earlier version, so 1 change may not have been kept."; her status reads Not confirmed; the sticky is on no tab; her tools are editable at once. Dismiss removes the notice and focuses the canvas. She adds a sticky: while it is sent her status still reads Not confirmed, and once it is saved, Saved |
| W2-S10 | Back to files while Ana's change waits (runner stopped) opens "Leave before your change is saved?" with "1 change to “Launch plan” hasn't been confirmed yet. If you leave now, it may be lost.": Stay on this board has focus and its ring; Escape keeps the board and the change; asked again, Stay keeps them; after the restart the change is saved. In a second drop with a new change waiting, Back to files and then Leave anyway shows Recents with no WebSocket open |
| W2-S11 | After a page gesture and with a change waiting, closing the page raises a `beforeunload` dialog; the check dismisses it and the board is still open. With nothing waiting, no `beforeunload` dialog is raised |
| W2-S12 | After a drop, a rejoin and the toast "Back online. Your change was saved.", Undo and Redo are unavailable and Ctrl/Cmd+Z changes nothing; a new edit can then be undone |
| W2-S13 | Ana adds an empty sticky and waits for Saved, then the runner is paused and she types "Book the venue" into it one key at a time; after the drop her status reads "Offline — 1 change waiting" (one change, not one per key); after the restart the whole text is saved and the toast is singular |
| W2-S14 | Chrome's offline emulation (DevTools Protocol) on Ana's page with a change in flight ends her attempt ("Offline — 1 change waiting"); after it is lifted she rejoins and the change is saved. With nothing in flight, offline emulation shows "Offline — view only" |
| W2-S15 | With a 150-second local access token, Ana's drop lasts past its expiry: Auth renews the session, the next ticket carries the renewed token, and her change is saved |
| W2-S16 | The test holds back the `saved` of Ben's stored sticky, removes Ben's access and closes his socket: his dialog says "…before 1 change was confirmed, so it may not have been saved." (never "wasn't saved"), and the sticky stays on the board for Ana |
| W2-S17 | Browser Back while Ana's change waits asks the leave question; the board stays open with its own link in the address bar; Stay keeps it and its connection; asked again, Leave anyway shows the previous page with no WebSocket open |
| W2-S18 | Sign out in the Board panel while Ana's change waits asks the leave question; Stay keeps her signed in; Leave anyway signs her out and shows the gate |
| W2-S19 | With a restored notice kept from a rejoin (W2-S9's set-up, not dismissed) and then a new drop with a change waiting, at 900 × 700 and at 390 × 800 the notice and the Reconnecting banner stack from 128 below the top of the board area, notice first, 8 apart, each at most the area's width minus 24; at 390 the notice's words and Dismiss wrap. After the rejoin, connected, with the notice still shown and Ana following Ben at 900 × 700, the column's top is 132 |
| W2-S20 | The look matches every value in interaction v29, sections "The save status", "Banners and notices", "The toast", "The board while changes wait", "The leave question" and "Dialogs that end a board". It checks each element's computed style and bounding rectangle at 1280 × 800, in five set-ups: offline with a change waiting; the leave question; access removed with a count; the restored notice; recovered with the toast. Lengths and positions within 0.5 pixel; colours, font sizes and weights, `display` and alignment exactly as computed; text exactly; it prints each value with its result |
| W2-S21 | With a short-lived local access token (the stack's `config.toml` copy set as for W4-S15) and Auth's refresh requests aborted by the test (no answer, so Auth does not sign out), Ana's held drop lasts past the token's expiry while a change waits: the rejoin gets 401 and she sees "Sign in again" with "Your sign-in has expired. Sign in again to keep editing. 1 change may not have been saved."; no Reconnecting banner shows; her status reads Not confirmed; the change is on no other tab |

**The 0003-W4 checks, amended.** For V13, **W4-S14** reads instead:

> With the owner joined, the Node runner is paused (its connection stays open) and the owner adds
> a sticky: the status is Saving…; the runner is then stopped: "Offline — 1 change waiting" in
> amber with only Select and Pan and the banner "Reconnecting… 1 change is waiting and will be
> saved when the board is back. You can look around until then.", never Saved; after the runner
> restarts the tab rejoins by itself, the sticky is sent again and is on the board, the status
> reads Saved and the toast "Back online. Your change was saved." shows; the next edit shows Saved.

Every other W4 check is as that brief states, with the 0003-W5 brief's amendment of W4-S10 to
W4-S12.

## Numbered acceptance criteria

- 0004-W2-AC01: When a hosted board's connection drops and comes back (closed by the network or a server restart, or no answer within the deadline), the tab rejoins by itself and sends every edit that was not saved again, in order and with its request ID; each is saved exactly once, including one the room had saved before its answer was lost, and no saved edit is lost. While disconnected the board stays view only (decision 0002).
- 0004-W2-AC02: Resent edits meet changes others saved during the drop under sync's rules (last saved wins, a delete beats a change, text in one note merges by character), proven with deterministic interleavings: a drop before `received`, after `received`, and after the room saved the edit but before `saved` arrived, plus a duplicate delivery; a resent change to an object someone deleted is reported to its author, not silently lost.
- 0004-W2-AC03: Waiting edits are not applied when, on rejoining, the person's access changed or was removed, they signed out or their sign-in could not be renewed, or the board was restored; the tab says how many changes may not have been saved and why. The save status and banner say Offline with the number waiting, Saving…, Saved, Not confirmed or Not saved truthfully, and leaving the board or closing the tab while changes wait asks first.

| Criterion | Evidence that shows it |
| --- | --- |
| 0004-W2-AC01 | W2-S1, S2, S4, S12–S15, S20; S117, S119; V13; the drops, order, deadline, edits-during-recovery, undo, client-ID and counting tests in `tests/recovery.test.mjs` |
| 0004-W2-AC02 | W2-S3, S5; S117, S120; the not-kept test in `tests/recovery.test.mjs`; the 0004-W1 checks S94–S115 still passing (V11) |
| 0004-W2-AC03 | W2-S6–S11, S16–S21; S116, S118; the fences, discard, refusal, save-state, messages and rejoin-outcome tests in `tests/recovery.test.mjs` |

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
| V4 | `npm test` passes with 0 failed; every base test file passes unchanged except the changes item 4 names in `tests/shared-editing.test.mjs`, `tests/team.test.mjs` and `tests/grouped-edits.test.mjs`; `tests/recovery.test.mjs` is the only new test file |
| V5 | The off build (with the three settings set) exits 0; its `index.html` and `THIRD_PARTY_NOTICES.txt` are byte-identical to the base build's; its `meta.json` has no input under `node_modules/@supabase/` or `apps/web/src/team/`; `audit:licenses` exits 0 |
| V6 | `build:fixtures` exits 0; the on build exits 0, its `index.html` is byte-identical to the base's on build, and its notices are runtime notices v3 byte for byte; `audit:licenses` exits 0 |
| V7 | `build:server` and the Worker dry run exit 0, and `audit:licenses` exits 0 |
| V8 | `git diff --name-status <base>..<validated>` shows only files of items 1 to 5 (this brief changes only by its implementation record, in a later commit) |
| V9 | W2-S1–S21 pass on the candidate's team-on build |
| V10 | The new checks fail on the base (REC-019). On a fresh local stack started from a checkout of the base (never a stack the candidate used), with the base's team-on build served the same way, every one of W2-S1, S2 and S4–S21 fails. `tests/recovery.test.mjs` run against the base fails each of its tests by name. S116, S117, S119 and S120 fail on the base's server suite. W2-S3 and S118 check the room's existing receipts and epoch rule, which the base already meets, so they pass on both. A check that fails because a control, state or message it asserts is missing counts as failing |
| V11 | `test:server:node`: S1–S50, S55–S76, S77–S93 and S94–S120 pass. `test:server:workerd`: S1–S36, S38–S42, S44–S50, S55–S69, S71–S76, S77–S93 and S94–S120 pass (S37, S43 and S70 are Node only). Every summary line has `"fail": 0` |
| V12 | The A–J comparison of the off build against the base's build shows no difference at any checkpoint (markup, focus, canvas drawing and saved records), with only the comparison's existing normalization of a local board's saved-time text. No other mask |
| V13 | The 0003-W4 brief's checks W4-S1–S29, with W4-S10 to W4-S12 amended by the 0003-W5 brief and W4-S14 amended above, pass on the candidate's team-on build, set up as that brief says. A check that fails is run once more on its own on a fresh stack; both results are reported |
| V14 | The 0004-W3 v2 brief's checks W3-S1–S29 and W3-S31–S36 pass on the candidate's team-on build and W3-S30 on its team-off build, set up as that brief says. A check that fails is run once more on its own on a fresh stack; both results are reported |

**Who runs what.** The implementer runs V1–V8 and records them. Browsers cannot start there, and
the Supabase stack is not needed for them. The reviewer's check run repeats V1–V8 on a clean clone
and runs V9–V14. Each is reported as one `PASS: V<n>` or `FAIL: V<n>` line, with the scenario's
W2, W4 and W3 lines and the server suite's S lines and summary lines kept as evidence.

Regression runs accepted by the maintainer:
- the full unit suite (V4);
- the server suite on both runners (V11);
- the A–J comparison with team features off (V12);
- the 0003-W4 checks with W4-S14 amended (V13);
- the 0004-W3 checks (V14).

No hosted project, deployment, point-in-time restore, browser matrix, accessibility audit, load
test, physical keyboard, input method or screen-reader session unless the maintainer asks.

## Exclusions and reasons

- **Editing while disconnected**, and keeping waiting work across a reload, a tab close or on the
  device: decision 0002 keeps the board view only while disconnected. Such work fits a later
  Story.
- **Sending waiting work again across a restore, an access change, a sign-out or a sign-in that
  cannot be renewed:** the fences exist so that such edits never apply.
- **Keeping undo across a rejoin:** the tab cannot tell its own unanswered edit, which the room
  saved, from another person's later edit of the same value (sync v5). It needs an attributable
  history design.
- **Recovering the requests a `resync` drops:** v4's resync is unchanged. The ordered resend
  never reached it in the prototype's 80-edit run.
- **Asking the server whether an unanswered edit was stored:** this would need new API and access
  rules, so the words say "may not have been saved" instead.
- **A protocol ping**, and noticing a silent connection with no edit in flight before it closes.
- **Point-in-time restore runs:** every restore raises the same fence that `restoreGeneration`
  reports, and point-in-time restore cannot run locally.
- **Presence changes**, local boards, conflict review or version history, and measured scale or
  recovery-time targets.

## Public references with retrieval dates

Retrieved 2026-11-02:
- [MDN: `Window: beforeunload` event](https://developer.mozilla.org/en-US/docs/Web/API/Window/beforeunload_event)
- [MDN: `Navigator.onLine`](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/onLine)
- [MDN: `History.pushState()`](https://developer.mozilla.org/en-US/docs/Web/API/History/pushState)
- [Cloudflare: Durable Objects WebSockets](https://developers.cloudflare.com/durable-objects/best-practices/websockets/)
- [Cloudflare: SQLite storage API](https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/)
  (point-in-time restore is not supported in local development)
- [Supabase: user sessions](https://supabase.com/docs/guides/auth/sessions)
- [Yjs document updates](https://docs.yjs.dev/api/document-updates)

## Implementation record

### Implementation handoff — 2026-11-03

- Brief implemented: **0004-W2 v1 only**, with sync v5, hosted storage v4 and
  interaction v29 and the unchanged prerequisites listed above.
- Branch: `codex/0004-W2-recover-shared-edits-after-interruption`.
- Base revision: `bee6dd38fdc06ae158cde3d63a3d079fb0aea084` (committed main).
- Validated source/test revision: `8431816e30df1ae2c16b9a5137a85da4d986ea39`.
  All final source/test checks below describe this revision. This record is a
  later documentation-only commit; the final branch tip is reported separately
  in the handoff. No merge or push was performed.
- Dependencies added: **none**. Every manifest and the lock are unchanged.
- Discovery: the graph inventory call returned `MCP tool call requires approval,
  but approval policy is never`. Graph tools were unavailable; direct file
  reads and `rg`/`sed` were used instead.

Implementation keeps one session for the open board, retains unanswered requests,
ends old attempts before accepting another event, resends in order, and fences
recovery against restores and access changes. Every rejoin clears shared undo/redo
and takes a fresh Yjs client ID. The web app counts edit groups, keeps losses by
reason until a later deliberate edit is saved, and guards leaving while changes
wait. It clears selection on rejoin and adds the notice column, amended uncertainty
words, recovered toast, native leave question and both `:focus` rings. The notice's
button explicitly overrides the shared 40-pixel minimum with 28 pixels.

No unresolved brief/contract disagreement was found. For S120's answer-lost phase,
a receipt replay is not another save: the other editor's later saved property
remains the winner, as sync v4's receipt rule requires. Losses use hosted storage
v4's “may not have been saved” / “Not confirmed”; a saved not-kept request leaves
the save state alone. Sync v5 makes Undo unavailable after recovery.

```text
PASS: V1 every package.json and package-lock.json byte-identical to the base
PASS: V2 npm ci exited 0
PASS: V3 typecheck exited 0 for all five members
PASS: V4 npm test — 833 passed, 0 failed, 0 skipped
PASS: V5 off build, base byte comparisons, excluded inputs and license audit
PASS: V6 fixture/on builds, base HTML/runtime-notices-v3 comparisons and audit
PASS: V7 server build, license audit and Worker dry run
PASS: V8 committed source/test diff contains only the 18 permitted files
```

Commands and results (Node `v26.13.0`, npm `11.20.0`, with the pinned binaries
first on PATH for every command). `$W2_TMP` below denotes the one system-temporary
directory used for logs, scratch TypeScript inputs, copied builds and dry-run
output; its expanded machine-specific name is intentionally omitted.

1. `node --version` and `npm --version`: `v26.13.0` and `11.20.0`.
2. `npm ci --ignore-scripts --no-audit --no-fund`: exit 0, 118 packages installed.
3. Before source changes, the following captured both base builds, each exit 0:

   ```sh
   BOARD_TEAM_FEATURES=off BOARD_SUPABASE_URL=http://127.0.0.1:55321 BOARD_SUPABASE_ANON_KEY=synthetic BOARD_SERVER_URL=http://127.0.0.1:8796 npm run build
   cp -R apps/web/dist "$W2_TMP/base-off"
   BOARD_TEAM_FEATURES=on BOARD_SUPABASE_URL=http://127.0.0.1:55321 BOARD_SUPABASE_ANON_KEY=synthetic BOARD_SERVER_URL=http://127.0.0.1:8796 npm run build
   cp -R apps/web/dist "$W2_TMP/base-on"
   ```

4. Final `npm run typecheck`: exit 0; web, server, board-rules, board-room and
   board-sync all passed. Final `npm test`: exit 0, 833/833 passed. The only new
   unit test file is `tests/recovery.test.mjs`. Existing unit assertions changed
   only in the permitted save-precedence test and words-key list; the other two
   permitted files have only the joined fixture field and client-ID alignment.
5. V1's byte check used the base tree's manifest list and compared every file's
   bytes with `git show` (exit 0):

   ```python
   from pathlib import Path
   import subprocess
   base = "bee6dd38fdc06ae158cde3d63a3d079fb0aea084"
   files = subprocess.check_output(["git", "ls-tree", "-r", "--name-only", base], text=True).splitlines()
   for file in files:
       if Path(file).name in ["package.json", "package-lock.json"]:
           assert Path(file).read_bytes() == subprocess.check_output(["git", "show", base + ":" + file]), file
   ```

6. Final off-build commands, all exit 0:

   ```sh
   BOARD_TEAM_FEATURES=off BOARD_SUPABASE_URL=http://127.0.0.1:55321 BOARD_SUPABASE_ANON_KEY=synthetic BOARD_SERVER_URL=http://127.0.0.1:8796 npm run build
   cp -R apps/web/dist/. "$W2_TMP/candidate-off/"
   cmp apps/web/dist/index.html "$W2_TMP/base-off/index.html"
   cmp apps/web/dist/THIRD_PARTY_NOTICES.txt "$W2_TMP/base-off/THIRD_PARTY_NOTICES.txt"
   node --input-type=module -e 'import {readFileSync} from "node:fs"; import assert from "node:assert/strict"; const meta=JSON.parse(readFileSync("apps/web/dist/meta.json")); assert(!Object.keys(meta.inputs).some(path=>path.startsWith("node_modules/@supabase/")||path.startsWith("apps/web/src/team/")));'
   npm run audit:licenses
   ```

7. Final fixture/on-build commands, all exit 0:

   ```sh
   npm run build:fixtures
   BOARD_TEAM_FEATURES=on BOARD_SUPABASE_URL=http://127.0.0.1:55321 BOARD_SUPABASE_ANON_KEY=synthetic BOARD_SERVER_URL=http://127.0.0.1:8796 npm run build
   cp -R apps/web/dist/. "$W2_TMP/candidate-on/"
   cmp apps/web/dist/index.html "$W2_TMP/base-on/index.html"
   cmp apps/web/dist/THIRD_PARTY_NOTICES.txt docs/architecture/0001-runtime-notices-v3.txt
   npm run audit:licenses
   ```

8. Final server-artifact commands, all exit 0:

   ```sh
   npm run build:server
   npm run audit:licenses
   XDG_CONFIG_HOME="$W2_TMP/config" WRANGLER_LOG_PATH="$W2_TMP/wrangler-logs" WRANGLER_SEND_METRICS=false npx wrangler deploy --dry-run --outdir "$W2_TMP/worker-dry-run" -c apps/server/wrangler.json
   ```

   Wrangler 4.156.0 reported `--dry-run: exiting now.`; no deployment occurred.
9. `git diff --name-status bee6dd38fdc06ae158cde3d63a3d079fb0aea084..8431816e30df1ae2c16b9a5137a85da4d986ea39`:
   exit 0, only the 18 files of items 1–5. `git diff --check`: exit 0.
   A direct byte-prefix check also confirms that all base CSS and all server
   checks through S115 are unchanged, with additions only at their ends.
   `wc -l apps/web/src/App.tsx`: **264**. The full unit suite's module guards
   passed without adding a team module or a state hook. Ignored build outputs,
   including `meta.json`, are not counted as changed files.

S116–S120 are appended after S115 and use the unchanged `check()` registration,
so both runners and `SUMMARY-SHARED` include them. **They were not run.** A strict
scratch entry containing exactly these additions, importing the real production
session/document and driver types and declaring the unchanged harness signatures,
passed `./node_modules/.bin/tsc --noEmit -p "$W2_TMP/server-additions.tsconfig.json"`
(exit 0). This checks the added checks, not the runtime server suite.

A supplemental standalone strict check of the whole existing server test file
(`./node_modules/.bin/tsc --noEmit -p "$W2_TMP/server-checks.tsconfig.json"`) found
pre-existing errors in Vitest `inject` typing, circular `Client` inference and
unnarrowed `ItemV10` properties. The same check against the base copy
(`./node_modules/.bin/tsc --noEmit -p "$W2_TMP/server-base.tsconfig.json"`) reproduced
those errors. Existing server checks and their harness were preserved; workspace
V3 excludes this test file and passed normally. Initial development checks also
caught a temporary stop-method reference and the old Offline precedence
expectation; both were corrected before the validated revision and final checks.

Both mandatory public-boundary hook checks reported `PUBLIC BOUNDARY: PASS` on
the source commit. Git also printed a `packed-refs.lock` permission warning;
the commit succeeded, its branch tip was read back and its committed diff was
verified. No hook was bypassed.

**Review checks deliberately not run:** V9 (W2-S1–S21); V10 (fresh-base negative
control, including recovery units); V11 (server suite S116–S120 and existing
checks on both runners); V12 (A–J); V13 (amended 0003-W4 checks); V14 (0004-W3
checks). They remain the review's check run. No browser, Supabase CLI stack,
Docker, operating-system input, hosted project or additional acceptance sweep was
used. No dependency, saved format, access rule, API route or file in `apps/server/`
changed. The room's only change is `joined.restoreGeneration`. The implementation
record itself is the sole later file change.

### Fix round 1 — 2026-11-03

**Finding F1 (Major, contract).** Review of candidate
`6d28084881075aa6be397dc4467a97bf22ed738d` (validated source/tests
`8431816e30df1ae2c16b9a5137a85da4d986ea39`) found that a request created
as a deliberate edit after a loss retained its clearing eligibility when resent
in recovery. Its `saved` answer could therefore remove the loss and its notice.
Hosted storage v4's "Counting changes" forbids recovery saves from clearing the
loss record; the reported browser scenario was W2-S19.

**Change.** `hosted-board.ts` now gives `updateLossRecord` the recovery request IDs
it already tracks. The pure rule revokes those requests' deliberate status before
checking whether any saved request can clear losses, and retains that exclusion
after recovery finishes. Creation order against the newest loss, per-reason counts,
Dismiss and clearing when the board is left are unchanged. A further deliberate
edit saved on its first send can still clear the record. No screen markup, styles,
words, session protocol, dependency or saved format changed.

Three tests were appended to `tests/recovery.test.mjs`, each dynamically importing
its production modules. The restored and access-changed cases drive a real shared
session through a fenced loss, a subsequent deliberate edit, interruption, resend
and save; the loss count, notice and Not confirmed state remain. A further edit's
first-send save clears them. The third case preserves a recovered not-kept
request's own notice and Saved state. No existing test was edited.

- Branch: `codex/0004-W2-recover-shared-edits-after-interruption`.
- Original committed-main base: `bee6dd38fdc06ae158cde3d63a3d079fb0aea084`.
- Fix parent: `6d28084881075aa6be397dc4467a97bf22ed738d`.
- New validated source/test revision: `403113f9a1ab1d7937240a72a18651401344e219`.
- Final branch tip: reported separately in the handoff after this record-only
  commit. Its source/tests are the validated revision above.
- Added dependencies: none. No contract disagreement or scope exception was needed.

```text
PASS: V1 every package.json and package-lock.json byte-identical to bee6dd3
PASS: V2 npm ci exited 0
PASS: V3 typecheck exited 0 for all five members
PASS: V4 npm test — 836 passed, 0 failed, 0 skipped
PASS: V5 off build, fresh-base byte comparisons, excluded inputs and license audit
PASS: V6 fixture/on builds, fresh-base HTML/runtime-notices-v3 comparisons and audit
PASS: V7 server build, license audit and Worker dry run
PASS: V8 three-file fix; cumulative diff is items 1–5 plus the prior implementation record
```

Exact validation commands and results follow. The pinned binaries were first on
PATH throughout; `node --version` printed `v26.13.0`, `npm --version` printed
`11.20.0`. `$W2_TMP` denotes this round's system-temporary directory; all logs,
base sources, copied builds and dry-run output stayed there.

```sh
npm ci --ignore-scripts --no-audit --no-fund
node --test --test-reporter=tap --test-name-pattern=F1 tests/recovery.test.mjs
npm run typecheck
npm test
```

The install exited 0 (118 packages). The focused command, run before the fix with
the new cases added, reported 2 failures and 1 pass; after the fix it exited 0,
3 passed and 0 failed. The workspace typecheck exited 0 for web, server,
board-rules, board-room and board-sync. The full unit command exited 0,
836 passed, 0 failed and 0 skipped.

V1's byte comparison was rerun with `python3` using:

```python
from pathlib import Path
import subprocess
base = "bee6dd38fdc06ae158cde3d63a3d079fb0aea084"
for file in subprocess.check_output(["git", "ls-tree", "-r", "--name-only", base], text=True).splitlines():
    if Path(file).name in ["package.json", "package-lock.json"]:
        assert Path(file).read_bytes() == subprocess.check_output(["git", "show", base + ":" + file]), file
```

It exited 0. A separate byte/prefix assertion compared every test file with the
fix parent: only new trailing cases in `tests/recovery.test.mjs` differed.
`App.tsx` stayed at 264 lines. No team module or state hook was added.

Fresh base-build inputs were extracted from the original committed base:

```sh
mkdir "$W2_TMP/base"
git archive bee6dd38fdc06ae158cde3d63a3d079fb0aea084 | tar -x -C "$W2_TMP/base"
```

In that temporary base directory, the following all exited 0 (the install added
118 packages); no base tests or stack were run:

```sh
npm ci --ignore-scripts --no-audit --no-fund
BOARD_TEAM_FEATURES=off BOARD_SUPABASE_URL=http://127.0.0.1:55321 BOARD_SUPABASE_ANON_KEY=synthetic BOARD_SERVER_URL=http://127.0.0.1:8796 npm run build
cp -R apps/web/dist "$W2_TMP/base-off"
BOARD_TEAM_FEATURES=on BOARD_SUPABASE_URL=http://127.0.0.1:55321 BOARD_SUPABASE_ANON_KEY=synthetic BOARD_SERVER_URL=http://127.0.0.1:8796 npm run build
cp -R apps/web/dist "$W2_TMP/base-on"
```

Back in the milestone worktree, all these commands exited 0:

```sh
BOARD_TEAM_FEATURES=off BOARD_SUPABASE_URL=http://127.0.0.1:55321 BOARD_SUPABASE_ANON_KEY=synthetic BOARD_SERVER_URL=http://127.0.0.1:8796 npm run build
cp -R apps/web/dist "$W2_TMP/candidate-off"
cmp apps/web/dist/index.html "$W2_TMP/base-off/index.html"
cmp apps/web/dist/THIRD_PARTY_NOTICES.txt "$W2_TMP/base-off/THIRD_PARTY_NOTICES.txt"
node --input-type=module -e 'import {readFileSync} from "node:fs"; import assert from "node:assert/strict"; const meta=JSON.parse(readFileSync("apps/web/dist/meta.json")); assert(!Object.keys(meta.inputs).some(path=>path.startsWith("node_modules/@supabase/")||path.startsWith("apps/web/src/team/")));'
npm run audit:licenses
npm run build:fixtures
BOARD_TEAM_FEATURES=on BOARD_SUPABASE_URL=http://127.0.0.1:55321 BOARD_SUPABASE_ANON_KEY=synthetic BOARD_SERVER_URL=http://127.0.0.1:8796 npm run build
cp -R apps/web/dist "$W2_TMP/candidate-on"
cmp apps/web/dist/index.html "$W2_TMP/base-on/index.html"
cmp apps/web/dist/THIRD_PARTY_NOTICES.txt docs/architecture/0001-runtime-notices-v3.txt
npm run audit:licenses
npm run build:server
npm run audit:licenses
XDG_CONFIG_HOME="$W2_TMP/config" WRANGLER_LOG_PATH="$W2_TMP/wrangler-logs" WRANGLER_SEND_METRICS=false npx wrangler deploy --dry-run --outdir "$W2_TMP/worker-dry-run" -c apps/server/wrangler.json
git diff --check
git diff --name-status 6d28084881075aa6be397dc4467a97bf22ed738d..403113f9a1ab1d7937240a72a18651401344e219
git diff --name-status bee6dd38fdc06ae158cde3d63a3d079fb0aea084..403113f9a1ab1d7937240a72a18651401344e219
```

The fix-only committed diff lists exactly `apps/web/src/team/notices.ts`,
`apps/web/src/team/hosted-board.ts` and `tests/recovery.test.mjs`. The cumulative
diff lists the 18 files allowed by items 1–5 and the previous implementation
record; an assertion confirmed that nothing before this brief's implementation
record changed. Ignored build outputs do not count as changed files. The audits
verified the accepted lock, runtime inventory and complete notices. Wrangler
4.156.0 printed `--dry-run: exiting now.`; no deployment occurred.

Graph inventory was attempted first and again returned `MCP tool call requires
approval, but approval policy is never`; direct reads and search were used. The
approved design and its amendment and all five reference images were reread and
viewed before editing. Public-boundary hooks passed normally on the fix commit.
Git printed the same `packed-refs.lock` permission warning as before, but the
commit succeeded and its tip and diff were verified. No hook was bypassed.

**Not run:** V9–V14 remain for the review's check run: W2-S1–S21 (including
W2-S19), the fresh-base negative control, server suites on both runners, A–J,
amended 0003-W4 checks and 0004-W3 checks. S116–S120 are unchanged and were not
run this round. No browser, Supabase CLI, Docker or operating-system input was
used. No merge or push was performed. Only this appended implementation record
changes after the validated source/test revision.
