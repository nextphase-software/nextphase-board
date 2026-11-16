BRIEF VERSION: 0010-W3 v1 (2026-11-16)
# 0010-W3 — Pages on team boards

Status: Draft. Implementation has not started under this brief.

## Outcome and read first

A **team (hosted) board** gets the pages a local board has. Owners and editors use the Pages list to add,
rename, reorder, duplicate and delete pages, and Move to page in the selection bar; find searches every
page. Viewers open pages but make no page steps. Two people changing different pages at the same moment
both keep their change.

Several people on several pages see only what is on their own page:
- cursors, selections, reactions and comment pins show only on their page;
- the Pages list shows who is on each page, and the people menu says which page each person is on;
- following someone, or a spotlight, takes you to their page;
- the comments panel lists every page's threads and opens another page's thread on its page;
- a vote covers the page it starts on, and people elsewhere get **Go to <page>**;
- if someone deletes the page you are on, you land on the page before it, with a notice;
- the timer stays one per board.

Read [AGENTS.md](../../AGENTS.md), [CONTRIBUTING.md](../../CONTRIBUTING.md), [DESIGN.md](../../DESIGN.md)
and these new contract files (prior versions remain untouched):

| Contract | New version / ownership |
| --- | --- |
| [Document](../architecture/0001-document-v19.md) | v19: hosted boards hold 1–50 pages; schema stays 13; no repair of an object left on a deleted page |
| [Sync](../architecture/0003-sync-v14.md) | v14: `pageMap` with order keys and minimal writes, concurrent merge, the stored-room conversion, hosted Undo page units |
| [Presence](../architecture/0004-presence-v5.md) | v5: the presence `page` key, the room's page check, same-page drawing, follow and spotlight across pages, same-page reactions |
| [Comments](../architecture/0005-comments-v5.md) | v5: the anchor's `page` and `pageName`, keeping anchors on edits and page deletion, open-page hit testing, the panel |
| [Workshop voting](../architecture/0007-workshop-voting-v3.md) | v3: a round's page, its targets, reconciliation when objects leave the page |
| [Hosted storage](../architecture/0003-hosted-storage-v12.md) | v12: room storage version 8 (`workshop_vote.page`, the upgrade from 7), the hosted page state, history preview |
| [Team templates](../architecture/0008-team-templates-v2.md) | v2: saving the open page with nothing selected |
| [Interaction](../architecture/0001-interaction-v44.md) | v44: every look, word and rule of pages on hosted boards |
| [Web modules](../architecture/0001-web-modules-v42.md) | v42: two new source modules and two test files, the counts, the package, room and web paths, App.tsx substitutions and seams |

Use this set wherever inherited contracts link a replaced version. Unchanged: [document v18](../architecture/0001-document-v18.md)'s
saved format (schema 13), [storage v3](../architecture/0001-storage-v3.md), [board file v4](../architecture/0006-board-file-v4.md),
[hosted persistence v10](../architecture/0003-hosted-persistence-v10.md), [board lifecycle v5](../architecture/0006-board-lifecycle-v5.md),
[API v12](../architecture/0003-api-v12.md), [access v13](../architecture/0003-access-v13.md),
[activity catalogue v1](../architecture/0008-activity-catalogue-v1.md), [workshop timer v2](../architecture/0007-workshop-timer-v2.md),
[toolchain v5](../architecture/0001-toolchain-v5.md), [lock v5](../architecture/0001-dependency-lock-v5.json),
[inventory v5](../architecture/0001-dependency-inventory-v5.json) and [runtime notices v3](../architecture/0001-runtime-notices-v3.txt).
The 17 service tables remain: no service migration.

Build directly; no prototype or scenario tool is an input. Prove the stated values with focused tests,
followed by independent checks. Report a contract conflict before dependent work.

**Design.** The maintainer approved the look on 2026-11-16. Interaction v44 states every value of it
(sizes, colours, positions, words). New parts inside the pages list use v43's NextPhase values. Parts that
join an existing component (the people menu, comments panel, voting card and notice) use that component's
existing look.

## Deliverables and boundaries

Planning source baseline main **e442c8a**. Use a fresh milestone worktree and branch from committed main
containing this packet, recording that prerequisite base separately from the behaviour baseline. New
source files carry `SPDX-License-Identifier: Apache-2.0`. Only these files may change, plus the
append-only Implementation record below.

**New (four).**
1. `packages/board-sync/src/order-keys.ts`
2. `apps/web/src/team/page-presence.ts` (both as web modules v42)
3. `tests/team-pages.test.mjs`
4. `tests/server/team-pages.test.ts` (S417–S424 below)

**Changed: packages and server.**

| # | File |
| --- | --- |
| 5 | `packages/board-sync/src/codec.ts` |
| 6 | `document-adapter.ts` |
| 7 | `undo.ts` |
| 8 | `session.ts` |
| 9 | `comments.ts` |
| 10 | `voting.ts` |
| 11 | `packages/board-room/src/room.ts` |
| 12 | `edits.ts` |
| 13 | `history.ts` |
| 14 | `presence.ts` |
| 15 | `comments.ts` |
| 16 | `voting.ts` |
| 17 | `storage.ts` |
| 18 | `conflicts.ts` (`promote()` for `pageMap` entries) |
| 19 | `apps/server/src/routes/boards.ts` |
| 19a | `packages/board-room/src/backups.ts` (storage versions 7 and 8) |
| 19b | `packages/board-room/src/edit-session.ts` (the `update` frame's `connection`) |

Type-only changes in other package, server and web files are allowed where the compiler needs them,
with no behaviour change; the record lists them.

**Changed: web** (under `apps/web/src/`).

| # | File |
| --- | --- |
| 20 | `App.tsx` (only the substitutions of web modules v42) |
| 21 | `state/use-pages.ts` |
| 22 | `ui/pages-panel.tsx` |
| 23 | `ui/move-to-page.tsx` |
| 24 | `ui/file-bar.tsx` |
| 25 | `ui/notice.tsx` (only if needed) |
| 26 | `team/presence.ts` |
| 27 | `team/hosted-board.ts` and `state/use-hosted-board.ts` (change origins) |
| 28 | `state/use-presence.ts` |
| 29 | `team/presence-layer.tsx` |
| 30 | `team/people.tsx` |
| 31 | `team/reactions-layer.tsx` |
| 32 | `team/reactions.ts` |
| 33 | `team/comments/layer.tsx` |
| 34 | `team/comments/panel.tsx` |
| 35 | `team/comments/card.tsx` |
| 36 | `team/comments/rules.ts` |
| 37 | `team/voting-card.tsx` |
| 38 | `team/voting-overlay.tsx` |
| 39 | `team/voting.ts` |
| 40 | `team/voting-rules.ts` |
| 41 | `team/templates-section.tsx` |
| 42 | `team/templates-rules.ts` |
| 43 | `team/history-panel.tsx` and `state/use-board-document.ts` (only as hosted storage v12's preview rule needs) |
| 44 | `apps/web/style.css` |

All change as web modules v42 says.

**Changed: tests and guide.**
- 45. `tests/modules.test.mjs`: the team folder list, the sync folder test, and the App test of web
  modules v42.
- 46. `tests/README.md`: the two new files.
- 47. The fixture and expectation updates under **Shared-path check dispositions**.
- 48. `docs/guides/try-board.md`: Part 2, below.
- 49. `vitest.node.config.ts` and 50. `vitest.workerd.config.ts`: only adding
  `tests/server/team-pages.test.ts` to each `include` list.

New tests import the new modules dynamically inside their named checks, never at top level, so on the
e442c8a baseline each new check fails by name (V12).

**Try-and-test guide (Part 2, team mode).** Add this row at the end of Part 2's table; nothing else in
the guide changes:

| Feature | Try this | You should see |
| --- | --- | --- |
| [Pages on team boards](../briefs/0010-W3-pages-on-team-boards.md) | Ana clicks Pages, then **+**, types "Ideas" and presses Return, then adds a sticky saying "dinner". Ben opens Pages and clicks "Ideas"; Mia opens Pages. Ana goes back to "Page 1" and clicks Ben's avatar. Ben starts a vote from Timer and voting. Ana, on Page 1, opens Timer and voting. Ben chooses End and reveal and confirms, then opens "…" on Ideas, chooses Delete page, clicks the board and presses Cmd+Z | Ben sees Ideas appear in his list and the "dinner" sticky on it. Ana's list shows Ben's avatar beside Ideas, and his cursor is not on Page 1. Mia's list has no + and no "…" and says "View only". Clicking Ben's avatar takes Ana to Ideas with "Following ben to “Ideas”". Ana's voting card says "This vote is on page “Ideas”" with Go to Ideas. While the vote runs, Ideas' Delete page is disabled with "A vote is running on this page"; after Ben ends it, Delete page removes Ideas for everyone, and Cmd+Z brings it back for everyone |

Not allowed:
- a dependency, font, image file, service, service migration or import exception;
- a stored value other than those web modules v42 lists;
- a state hook, scene part or screen part beyond web modules v42;
- any change to the timer, access, lifecycle, the board file, local-board behaviour (other than shared
  modules keeping it exactly as v43 says), or the spotlight's state and frames.

Outside the named new controls, the existing screens' markup stays exactly as at the base: the
reviewer's A–J comparison allows only the masks listed under validation.

## Required behavior and concrete design

Implement document v19, sync v14, presence v5, comments v5, workshop voting v3, hosted storage v12, team
templates v2, interaction v44 and web modules v42 in full. In particular:

- **Room.** Several pages on edits, create, import, history, restore and backup. Storage version 8 with
  `workshop_vote.page` and the version 7 upgrade: reset the round, convert `pages` to `pageMap`, write a
  snapshot, not an edit. Edits leaving an object on a missing page are refused `invalid_document`.
- **Sync.**
  - `pageMap` entries `{name, order}`. The codec refuses other shapes and the old key in client updates.
  - Pages are read by order key then id.
  - The adapter makes minimal writes: keep the longest increasing run of keys, give fresh keys between
    neighbours, rebalance past 64 characters.
  - Concurrent adds, renames, moves and deletes of different pages all survive the room's arrival-order
    rule; for the same page the later write wins, and a delete wins over a rename.
  - Hosted Undo has `page:<id>` units, with the existing guard and "Someone else changed that…" rules,
    and Undo and Redo report the step's page.
- **Presence.**
  - Six-key frames with `page`. The room drops a frame whose page is not current, and keeps `page`
    through voting redaction.
  - Clients send at once on a page change and draw cursors, selections and bursts only for the same page.
  - Avatars in the list rows; the people menu's page words.
  - Following and spotlight open the followed page, with the follow notice; opening a page yourself stops
    following.
- **Pages UI on hosted boards.**
  - v43's whole behaviour for owners and editors.
  - Viewers get the read-only list with `View only`, no page steps and no Move to page.
  - When someone else deletes your open page: the page before it opens, with the remote-delete notice;
    menus, fields and drags on deleted pages close.
  - The remembered page works on hosted boards too.
  - While a round runs on a page, its Delete page and Move to page are disabled with
    `A vote is running on this page`.
- **Comments.**
  - Anchors carry `page` (and `pageName` when stored). The room checks the page and keeps anchors on
    moves, renames and deletes, with frames on page deletion.
  - Clients hit-test the open page only and draw pins only for it.
  - The panel lists every page, with ` · page <name>` and `On deleted page “<name>”`; opening a thread on
    another page opens its page.
- **Voting.**
  - `start` carries the open page; targets are that page's eligible objects; state and projections
    carry `page`.
  - Reconciliation drops targets that left the page.
  - The form's scope line, the vote-elsewhere card with **Go to <page>**, markers only on the round's
    page, and a result on another page opening it.
- **Templates.** `Save page as template` and its tip and dialog line with two or more pages; insertion
  on the open page.

## Shared-path check dispositions

This inventory authorizes expectation changes, not additional historical runs.

| Shared path / older checks | Disposition |
| --- | --- |
| One-page server checks: `tests/server/pages.test.ts` S413 and S414 | S413 becomes: an edit that adds, renames, reorders or deletes a page, or moves an object to another existing page, is **accepted**; an edit that moves an object to a page id that does not exist is refused `invalid_document`. S414: a version 13 document with two pages is **accepted** on import and create; one with 51 pages, or an object on a missing page, is refused `invalid_document`; version 12 is still refused. S411, S412, S415 and S416 keep their meaning; any expectation of the old `pages` board-map value becomes `pageMap` (sync v14) |
| `tests/pages.test.mjs` checks 32 and 33 | 32: hosted controls now show pages (`local` true), with `canEdit` false hiding page steps. 33: room evaluation now accepts page changes and refuses only an object on a missing page. Their other assertions stay |
| `tests/room.test.mjs` (124, 142), `tests/team-import.test.mjs` (64) | Unchanged: they assert the projected or imported JSON `pages` array, which keeps document v18's format |
| `tests/team-import.test.mjs` (86) | Its `storage_version === 7` becomes 8; the import and reload assertions are unchanged |
| `tests/pages.test.mjs` P2-U04 | It observes the shared board map for a rename; it now observes the renamed page's `pageMap` entry and expects one `name` change and no other write |
| `tests/import-fixture.mjs` (16) and its callers | Builds genuine legacy shared documents (a live `pages` array, no `pageMap`) for the stored-older-board seeds of S412 and its other callers, and current documents with `pageMap` otherwise; never a `pageMap` inside a legacy fixture |
| `tests/codec.test.mjs` and any test that builds or asserts the shared document's board map or the five-key presence frame | The board map's page data is `pageMap` (sync v14) and the presence frame has six keys (presence v5); fixtures building them gain these. No assertion changes for any other reason |
| `tests/mentions.test.mjs` M-U04, M-U08, M-U13 (anchors) and M-U05 (refuses storage version 8 as unsupported); `tests/server/mentions.test.ts` (its anchor helper, S159); `tests/server/history.test.ts` (its anchor helper, S169); `tests/server/lifecycle.test.ts` (its comment helper); `tests/server/timer.test.ts` S240 and S250; `tests/workshop-timer.test.mjs` U20 | Anchor fixtures gain `page` (the board's first page). An expectation of storage version 7 becomes 8, and the unsupported-version assertion moves from 8 to 9 with its refusal precedence unchanged. No assertion changes for any other reason |
| Comment, voting, reaction, spotlight, presence and team-template tests (`tests/comments*.test.mjs`, `workshop-voting.test.mjs`, `workshop-reactions.test.mjs`, `workshop-spotlight.test.mjs`, `team-templates.test.mjs`, `tests/server/voting.test.ts`, `reactions.test.ts`, `spotlight.test.ts`, `templates.test.ts`, `shared.test.ts`, `suite.test.ts`) | Fixtures gain the anchor `page`, the start command's `page`, the vote state's `page`, the presence `page` and storage version 8 where they build them. A one-page board's behaviour and words are unchanged; no other assertion changes |
| Module inventory: `tests/modules.test.mjs` | Team list gains `page-presence.ts`; the sync folder gains `order-keys.ts`; other counts unchanged; "0010-W2 App composition" becomes "0010-W3 App composition" from base e442c8a with the recorded substitutions |
| Local shell: A–J | Unchanged (no hosted screens), with no new mask |

The record lists every changed line range under `tests/`.

## Browser checks

New scenario **N2-S1–N2-S14**. N2 was unused in existing public briefs when allocated. A fresh,
independent check run writes its tool from these clauses and the contract values. Each row prints its
full ID, `PASS:` or `FAIL:` and a summary, and keeps raw receipts and unrun rows.

Setup: 1440 × 900, scale 1, macOS Chrome (so ⌘ keys), on the local team stack started from the
candidate on its own uniquely owned local Supabase project. Ana (owner), Ben (editor) and Mia (viewer)
each use their own browser context. Use real pointer and key events, never painted DOM. New capability
rows also fail by name on the independent baseline e442c8a. Derived positions ±0.5 CSS px; colours and
sizes exactly as interaction v44. "Within 3 s" means the change shows on the other screen within 3
seconds. Save a real-state image for N2-S1, S2, S5, S6, S7, S8 (form and elsewhere) and S9.

**Fixture T.** Ana imports, through Home's existing import, a board file the tool writes: document v18
(schema 13), named "Team pages check", in Example team. Ben and Mia then open it.

Pages in order:
- `Agenda`, whose id is the board id: section a01 `Morning` (−680, −200, 640, 480); stickies a02
  `Welcome and goals` (−640, −80, 240, 240) and a03 `Budget review` (−320, −80, 240, 240) in a01; sticky
  a04 `Lunch at noon` (200, −80, 240, 240); connector a05 a03 → a04.
- `Ideas`: stickies i01 `Budget for the venue` (−640, −80, 240, 240), i02 `Invite a guest speaker`
  (−320, −80, 240, 240) and i03 `Team dinner` (200, −80, 240, 240).
- `Retro`: stickies r01 `Went well` (−320, −80, 240, 240) and r02 `To improve` (40, −80, 240, 240).

**Entry state.** Unless a row continues from the one before it: the fixture board as imported, every
context reloaded with `nextphase-board/page/v1/…` keys cleared (all on Agenda, view 100% at (0, 0)), no
panel open, timer idle, no vote, no comments.

| ID | Scriptable behavior and expected result |
| --- | --- |
| N2-S1 | Ben opens Ideas from his list and moves his pointer over the canvas; Mia moves hers over the canvas on Agenda. Ana clicks Pages and moves her pointer off the list. Her list shows Agenda (current), Ideas and Retro. Agenda's row holds one 20 × 20 avatar of Mia's colour with `M`, 4 px before its "…" button, with the accessible name `mia on this page`. Ideas' row holds Ben's avatar (`B`) at the same x, 4 px before the hidden options slot. Retro's row has none. Ana's own avatar is in no row. On Ana's canvas Mia's cursor and pill are drawn and Ben's are not. Capture pages-people |
| N2-S2 | Continuing from N2-S1 (Ben on Ideas, Mia on Agenda): Ana closes the list and opens the people menu: Ben's second line reads `can edit · on Ideas`, Mia's `can view · this page`, her own row unchanged. Capture people-menu |
| N2-S3 | Ana adds a page and names it `Notes`; within 3 s Ben's and Mia's lists show `Notes` last, and neither person's open page changes. Ben renames Ideas to `Ideas 2` while Ana moves Retro up (each within 100 ms of the other): within 3 s, all three lists read Agenda, Retro, `Ideas 2`, Notes. Ana and Ben each press Add page within 100 ms of each other, then each presses Escape (keeping the default name) and clicks the canvas: within 3 s, both new pages are in every list (six pages). Ana presses ⌘Z: only her add is undone, and Ben's page stays |
| N2-S4 | Ben, on Ideas, selects i03 and chooses Move to page › Agenda: within 3 s, i03 is on Ana's Agenda at its box and gone from Ben's Ideas; after Ana reloads, the board served to her has i03's `page` = Agenda's id. Ben clicks empty canvas, then presses ⌘Z: i03 is back on Ideas for both |
| N2-S5 | Ben on Ideas; Ana on Agenda clicks Ben's avatar. Ana's open page becomes Ideas, the follow frame and banner show, and the notice reads `Following ben to “Ideas”.` Ben opens Retro: within 3 s, Ana is on Retro with `Following ben to “Retro”.` Ana opens Agenda from her list: following ends (no frame or banner) and she stays on Agenda. Capture following (after the first notice) |
| N2-S6 | Mia clicks Pages: her list has no Add page button and no "…" on any row (hovered too), and `View only` is at the header's right (12 px, weight 500, `#525d6c`). Double-clicking `Ideas` opens no field; dragging Retro up 40 px changes nothing; clicking Ideas opens it. Mia selecting a sticky gets no Move to page anywhere. Capture viewer |
| N2-S7 | Ana, on Agenda, with the Comment tool, clicks at board point (−200, 40) (inside a03; i02 lies under it on Ideas) and posts `Keep it short`. Ben, on Ideas, comments on i03 `Book a table`. Ana's panel lists both threads: hers reads `On “Budget review”`, Ben's `On “Team dinner” · page Ideas`. Ana's canvas shows her pin and not Ben's. Ana chooses Ben's thread: Ideas opens and the thread shows at i03. The room's stored anchor of Ana's thread has `page` = Agenda's id and `objectId` = a03. Capture comments (before choosing) |
| N2-S8 | Ben, on Ideas, opens Timer and voting, New vote: the scope line reads `All eligible objects on this page (“Ideas”)`. Capture vote-form. He starts the vote `Which first?`. Ana, on Agenda, opens Timer and voting: the card shows the question, the remaining votes, `This vote is on page “Ideas”.` and a full-width **Go to Ideas** (no Enter voting). Capture vote-elsewhere. In Ana's pages list, Ideas' "…" › Delete page is disabled with the tooltip `A vote is running on this page`. On Ideas, Move to page for i01 is disabled with the same tooltip. Ana clicks Go to Ideas: Ideas opens and voting is entered. She votes for i02 and Ben reveals: markers are on Ideas only, and the result for i02 opens Ideas for anyone on another page who chooses it |
| N2-S9 | After the vote is cleared: Ana opens Retro (its first-open fit) and posts a point comment at board point (0, 40), an empty spot between r01 and r02. Ben deletes Retro. Within 3 s, Ana is on the page that was before Retro in her list, with the notice `ben deleted page “Retro”. You are now on “<that page>”.` Her panel shows the point thread as `On deleted page “Retro”` with no pin. Capture page-deleted. Ben clicks empty canvas and presses ⌘Z: within 3 s, Retro is back in every list (same page id). Ana opens Retro: `Went well` and `To improve` are at their boxes (new object ids, as hosted Undo re-creates deleted objects), and the point pin is at (0, 40) |
| N2-S10 | Ben, on Ideas, sends a reaction over the canvas; Mia, on Agenda, sends one. Ana, on Agenda, sees Mia's burst and not Ben's |
| N2-S11 | Ana, on Agenda, with nothing selected, opens Templates. The save button reads `Save page as template`, its tip `Nothing is selected, so all 5 objects on this page are saved`, and the dialog's source line `All 5 objects on “Agenda” of Team pages check`. Cancel |
| N2-S12 | Ana reloads while on Ideas: the board opens on Ideas. On a one-page team board (a new board): the Pages list shows one row and the selection bar has no Move to page (v43's rule) |
| N2-S13 | Ana opens version history and previews the version captured at import: the preview shows the page she had open, and leaving the preview returns her to it. Restoring that version brings back the three pages and their objects for everyone within 3 s |
| N2-S14 | The row of `docs/guides/try-board.md` this milestone adds, walked as written on the served candidate: each `You should see` holds |

## Acceptance criteria

- **0010-W3-AC01:** On a team board, owners and editors use every page action of local boards (add,
  rename, reorder, duplicate, delete, Move to page, find across pages), each one Undo step for its author;
  every member sees each change. Two people adding, renaming, reordering or deleting different pages at
  the same time keep both changes. Someone on a deleted page lands on the page before it with a notice.
  History, restore, import and create accept several pages. Look and placement match the approved design.
- **0010-W3-AC02:** Cursors, selections, reactions and comment pins show only on their own page. The
  pages list and the people menu show who is on which page. Following and spotlight take followers to
  the presenter's page. Comments belong to a page, hit-test only the open page, and the panel names and
  opens another page's thread. A vote covers the page it starts on, and other pages offer Go to that page.
- **0010-W3-AC03:** The room refuses any page change from a viewer and accepts it from owners and editors.
  Viewers open pages, find across them, follow and comment, with a read-only pages list. Presence frames
  carry a page id of the board; the room refuses malformed ones and drops those naming no current page.

| Criterion | Evidence that shows it |
| --- | --- |
| 0010-W3-AC01 | N2-S3, N2-S4, N2-S9, N2-S12, N2-S13, N2-S14; S417–S420, S424; V4 |
| 0010-W3-AC02 | N2-S1, N2-S2, N2-S5, N2-S7, N2-S8, N2-S10, N2-S11; S421–S423; V4 |
| 0010-W3-AC03 | N2-S6; S418, S421; V4; V9 |

## Applicable DESIGN.md guardrails

Canvas-first shell, native controls and visible focus, minimum action hits, protected native editing and
independent state owners apply. The pages list keeps v43's keyboard route. The row avatars are not
interactive and are named for assistive technology. Interaction v44 states every new look, word and key;
never infer generic styling. No new sound, font or image file.

## Validation commands and expected evidence

Use pinned Node 26.13.0 and npm 11.20.0 from the repository root. Source validation is not independent
acceptance. Each check run restates **every V row it reruns** as its own `PASS: Vn ...` / `FAIL: Vn ...`
line with SHA, logs and counts.

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
WRANGLER_SEND_METRICS=false npx wrangler deploy --dry-run --outdir <scratch> -c apps/server/wrangler.json
npm run test:server:node
npm run test:server:workerd
git diff --name-status <prerequisite-base>..<validated-source>
git diff --check <prerequisite-base>..<validated-source>
```

The room, sync and storage change, so a short server-only run follows the build. It installs the schema
on its own uniquely owned local Supabase project and runs both server suites on the candidate (V9),
stopping on any failed setup step. The check run starts the team stack on its own uniquely owned local
Supabase project. Record each long run's start and end and the host's sleep and wake events; a run that
overlapped a sleep is INVALID and is rerun awake. Three Safari checks from this milestone are chosen only
at Review.

**New server checks** (`tests/server/team-pages.test.ts`, both runners). Server tests seed stored older
rooms in their old shape, never by deleting new keys, in rows under the runners' statement limit.

| ID | Check |
| --- | --- |
| S417 | Create and import a version 13 document with three pages: accepted, served with the same pages in order. With 51 pages, or an object on a missing page: refused `invalid_document` |
| S418 | An editor's edits that add, rename, reorder and delete pages, and move an object to another page, are each accepted and served to a second editor connection. A viewer's edit doing any of them is refused `role_too_low` (as every viewer edit is) |
| S419 | Concurrency, from one base state on two editor connections: (a) both add a different page, and both pages exist; (b) both rename different pages, and both names are kept; (c) one renames page X while the other deletes X: X is gone and both edits are accepted; (f) both add pages between the same two pages, and both are kept, ordered by id when their keys are equal; (d) one deletes X while the other adds an object on X: the second edit is refused `invalid_document`, and no object is on a missing page; (e) one moves page X while the other renames Y, and both are kept. Each in both arrival orders |
| S420 | A stored storage-version-7 room seeded in its old shape (live `pages` value, no `workshop_vote.page` column, a running vote) loads as version 8: `pageMap` gives the same pages in order, `pages` is only a tombstone, the vote is idle with no ballots, no edits row, receipt, revision or history version was added, and a reload serves the same. A client update carrying a live `pages` value is refused `invalid_update` |
| S421 | Presence: a six-key frame with a current page is relayed with `page`; a frame without `page` is refused `bad_presence` and one with an extra key `presence_fields`; a non-UUID page is refused; a frame naming a deleted page is dropped (no relay, no refusal, previous presence kept). During a running vote the relayed frame keeps `page` and clears the spatial keys |
| S422 | Comments: `start` without `page`, with a page that is not current, or with an object on another page is refused `bad_anchor`. A valid thread stores `page` and `pageName`. Moving its object to another page updates the stored anchor's page. Deleting a page sends `comment_changed` for every thread on it (point, attached and detached), each with that `page` and its last `pageName` (after a rename, the new name). A stored anchor without `page` is read as the first page |
| S423 | Voting: `start` with page Ideas has exactly Ideas' eligible objects as targets and carries `page` in its result and publication. A page that is not current gives `vote_ineligible`. Moving a voted target to another page drops it and refunds its votes. Deleting Ideas drops every target, and the round stays running until revealed or cleared |
| S424 | History and backup: a captured version with three pages restores with them; a new backup records storage version 8 and restores; a storage-version-7 backup (old `pages` value) restores into a version 8 room and upgrades; a storage-version-6 or -9 backup is refused as today |

| Check | Command/inspection and pass condition |
| --- | --- |
| V1 | Byte-compare manifests, locks, dependency inventory and runtime notices against the prerequisite base: unchanged, no new dependency |
| V2 | `npm ci --ignore-scripts --no-audit --no-fund` exits 0 on the clean candidate and on the independent baseline |
| V3 | `npm run typecheck` exits 0 across all five workspace members |
| V4 | `npm test` full suite exits 0. `tests/team-pages.test.mjs` proves each group below. Guards as web modules v42 |
| V5 | Team-off `npm run build` and `npm run audit:licenses` exit 0; notices equal runtime notices v1 (team off) |
| V6 | `npm run build:fixtures`, team-on `npm run build` and `audit:licenses` exit 0; team-on notices equal runtime notices v3 |
| V7 | `npm run build:server`, `audit:licenses` and the wrangler dry run exit 0; no deploy |
| V8 | Inspect all hunks plus `git diff --name-status` and `git diff --check` over `<prerequisite-base>..<validated-source>`: only the deliverables, the dispositions above and the append-only Implementation record |
| V9 | Server-only run: `npm run test:server:node` and `npm run test:server:workerd` exit 0 on the candidate against a fresh local stack, including S417–S424 (the implementer cannot start the stack: unrun in implementation) |
| V10 | N2-S1–N2-S14 pass with the state captures and raw receipts |
| V11 | Design: the captures of N2-S1, S2, S5, S6, S7, S8 and S9 show every look interaction v44 states, and the reviewer compares them with the approved design |
| V12 | Once, on an independent e442c8a source and build with the candidate's `tests/team-pages.test.mjs` copied in: its checks and the new browser capability checks fail by name; a top-level setup or import abort does not count |
| V13 | Accepted A–J compare: baseline twice, then candidate and diffs, with existing normalization and no new mask |

What `tests/team-pages.test.mjs` proves for V4:
- **Order keys:** with moved pages given, only the moved page's key is written (B up in A, B, C keeps A's
  and C's keys); `between` for absent bounds, adjacent keys (`A`/`A1`), keys near `0`, equal bounds
  (none) and the 64-character bound (none); determinism; the rebalance; the longest-increasing-subsequence
  choice and its tie rule; no order write when the order is unchanged (equal keys included); the minimal
  writes of add, rename, move and delete.
- **Codec and adapter:** reading and refusing `pageMap` shapes and the old key.
- **Merge:** two Yjs docs from one base merging each S419 case through the room's `promote()` with the
  stated result.
- **Hosted Undo:** page units for add, delete with objects (re-created with fresh ids), rename, move and
  Move to page, and the per-value guard when someone else wrote the value (a same-value write included).
- **Change origins:** the hosted session reports `own`, `remote` (with the `update` frame's `connection`)
  and `reload`; the remote-delete notice only for `remote`, the silent fallback for `reload`.
- **Presence:** `checkPresence` with six keys and the page.
- **Comments:** anchors with page (`anchorAt` on the open page's objects; `detachAnchor`'s page rules).
- **`page-presence.ts`:** people per page (one per person, own person excluded, `+<n>` past three, the
  accessible name); same-page filters for presence, reactions and threads; the people-menu words; the
  follow notice; the remote-delete detection and page choice; the comment location words; the voting
  lines and the vote-disabled reasons.
- **Voting rules:** the start page and the scope line.
- **Stored room upgrade without the stack:** a room unit check loads a storage-version-7 room seeded in its
  old shape (the old `pages` value and a running vote), and asserts version 8, `pageMap`, the idle vote
  and no edit, on the in-memory storage the room tests use.
- **Team templates:** the save words and the open page's objects.
- **Viewers:** `use-pages.ts` keeps local boards exactly as v43 says and hides page steps when it cannot
  edit.

A regression failure that also fails on e442c8a is a baseline finding to report, never fixed here.

## Review focus and public references

Review that:
- `pageMap` writes are minimal (a rename, move, add or delete touches only its own entry or key), so
  concurrent page changes merge, and the reading order is deterministic;
- the room still refuses an object on a missing page and never repairs it;
- the version 7 upgrade is not an edit;
- the room's presence page check drops rather than refuses a stale page;
- voting redaction keeps `page`;
- every drawing of another person's cursor, selection, burst or pin is filtered by page;
- following opens the followed page before applying the view;
- comment hit testing uses only the open page's objects, and `keepAnchors` keeps `page` and `pageName`
  through moves, renames and deletion;
- vote targets come only from the round's page and reconcile when objects leave it;
- the remote-delete rule runs only for another person's change, never for this tab's own Delete page
  (which follows v43);
- viewers can make no page step through any control or key;
- local boards behave exactly as v43 says;
- page steps pass their moved pages through the commit seam to the hosted edit, so a move writes only
  that page's order key;
- history captures, intents and backup checks use the 2,162,688-byte raw ceiling while the payload limit
  stays 2,097,152;
- App.tsx changed only by the recorded substitutions.

The public source basis is main e442c8a and the linked versioned contracts, read 2026-11-16. No outside
product is needed to implement this contract, and no unresolved product decision is delegated to
implementation.

## Exclusions and reasons

- Copying a link to a page and opening a shared link on a page: a later milestone.
- Divider pages, renaming several pages at once, a page-switching shortcut, a confirmation before
  deleting a page, per-page timers.
- Templates with several pages.
- Repairs to separately tracked baseline failures.

## Implementation record

Append-only. The implementer appends its record here in a separate commit after the source commit.


### 2026-11-16 — implementation candidate (V1–V8)

- Branch: `codex/0010-W3-pages-on-team-boards`.
- Committed prerequisite: `a46a6a13d017022454ea92601077b25c148be67a`. Behaviour baseline: `e442c8a157024ff069d66a4924d1c6d810db8b0a`.
- Validated source/test revision: **`42c2387a6744c52bf1e0e753d5bd7ba470f01d7b`**. This record is committed separately;
  its branch tip is reported in the handoff, not substituted for the validated source.
- Result: **not ready for acceptance**. V4 has three failures requiring changes outside this
  brief's allowed file list. No merge, push, deployment, server-stack or browser run occurred.
- Added dependencies: **none**. Node 26.13.0 and npm 11.20.0 were used. The four new files have Apache-2.0 SPDX headers.

| Check | Commands / inspection | Result and counts |
| --- | --- | --- |
| V1 | Byte comparison with prerequisite; `git diff --exit-code a46a6a1 -- package.json package-lock.json '**/package.json' 'docs/architecture/0001-dependency-*' 'docs/architecture/*runtime-notices*'` | PASS: 20 tracked manifests, locks, inventories and notices unchanged; no dependency |
| V2 | `npm ci --ignore-scripts --no-audit --no-fund` in the initially clean candidate and an independent e442c8a archive | PASS: exit 0 in both; 118 packages installed in each |
| V3 | `npm run typecheck` | PASS: exit 0 across all five workspace members |
| V4 | `npm test` | FAIL: exit 1; 1,273 tests, 1,270 pass, 3 fail, 0 skipped. P3-U01–P3-U22 all pass. Failures and baseline discrimination below |
| V5 | Team-off `npm run build`; `npm run audit:licenses`; `cmp apps/web/dist/THIRD_PARTY_NOTICES.txt docs/architecture/0001-runtime-notices-v1.txt` | PASS: all three exit 0 |
| V6 | `npm run build:fixtures`; team-on `npm run build`; `npm run audit:licenses`; `cmp apps/web/dist/THIRD_PARTY_NOTICES.txt docs/architecture/0001-runtime-notices-v3.txt` | PASS: all four exit 0 |
| V7 | `npm run build:server`; `npm run audit:licenses`; `WRANGLER_SEND_METRICS=false npx wrangler deploy --dry-run --outdir <scratch> -c apps/server/wrangler.json` | PASS: all three exit 0; dry run only |
| V8 | All source/test hunks inspected; `git diff --name-status a46a6a1..42c2387a6744c52bf1e0e753d5bd7ba470f01d7b` and `git diff --check a46a6a1..42c2387a6744c52bf1e0e753d5bd7ba470f01d7b` | PASS for candidate scope and whitespace: 73 files, four new; the only additional file is type-only `apps/web/src/find.ts`. This append-only record adds one documentation file at the separate record tip |

Both web builds used `BOARD_SUPABASE_URL=http://127.0.0.1:55321`,
`BOARD_SUPABASE_ANON_KEY=synthetic`, `BOARD_SERVER_URL=http://127.0.0.1:8796`, with
`BOARD_TEAM_FEATURES=off` for V5 and `on` for V6. No real credential was used.
Final build/typecheck validation ran 2026-11-16 19:34:31–19:34:43 UTC. The final full
unit run, after the last test-fixture correction, ran **19:36:03–19:36:12 UTC**.
The host's `pmset -g log` Sleep/Wake inspection showed no sleep overlapping these intervals.
No long stack or browser run was started.

Additional focused validation: `node --test tests/team-pages.test.mjs` passed its 22 checks;
`node --test tests/pages.test.mjs` passed 38/38. The earlier focused seam run
(`node --test tests/board-history.test.mjs tests/modules.test.mjs tests/team-pages.test.mjs`)
passed 81/81 at that stage. `npx esbuild tests/server/team-pages.test.ts --bundle
--platform=node --format=esm --external:vitest --external:board-test-driver --outfile=<scratch>`
exited 0; this is a syntax/bundle check, **not** a server test result.

#### V4 failures and escalations

1. **F1-U13**, `tests/find.test.mjs`: requires the complete bodies of four team files to
   equal its older baseline, except for the find-bar guard. V42 requires page behavior in
   three of those files. The guard remains in each file. Updating this historical
   whole-file assertion is outside the listed test dispositions, so it was escalated and
   left unchanged pending approval.
2. **W1-U32 and W1-U33**, `tests/workshop-timer.test.mjs`: both fail `room_locked` because
   `apps/server/src/worker.ts:42` accepts only storage version 7 during retained recovery.
   The required storage version is now 8. The needed 7-or-8 check is outside the allowed
   behavior files; it was escalated and left unchanged pending approval.
3. **V42 count discrepancy**: the prerequisite sync folder has 11 existing files, rather
   than the stated ten. Adding `order-keys.ts` makes 12. The new inventory test enumerates
   those exact 12 files, preserving every existing module. The contract count needs correction.

These are candidate failures, not baseline failures: an independent e442c8a archive ran
`node --test tests/find.test.mjs` (14/14 pass) and `node --test tests/workshop-timer.test.mjs`
(41/41 pass). The full baseline suite was not run. The source commit's mandatory pre-commit
and commit-message public-boundary hooks both passed. Git also printed a non-fatal
`packed-refs.lock` sandbox maintenance error; the branch ref and clean source commit were verified.

Unrun: V9 and S417–S424 on both server runners (`npm run test:server:node`,
`npm run test:server:workerd`), Supabase CLI/schema/stack setup, V10's N2-S1–N2-S14,
V11's runtime design comparison, V12's independent negative checks, V13's A–J comparison,
earlier team scenarios, local N1 browser scenarios and Safari. Browsers and Supabase CLI
cannot start in this implementation sandbox; these checks belong to the separate runs.
All eight approved design images were read before screen implementation; no runtime visual
match is claimed here. Graph discovery was unavailable because the tool required approval
under the session's never-approval policy; direct public source reads were used.

#### Composition, state and type seams

App.tsx remains 264 lines, with five existing-line substitutions and no added line.
The 15 rules files, 10 object types, 16 scene parts, 32 screen parts and 25 state hooks remain;
all effect-count guards pass, including the two effects in `use-pages.ts`. Team runtime code
still enters only through the guarded team build: non-team modules have type-only team imports.
`apps/web/src/find.ts` gains only the structural `Pages` type members for `canEdit`,
page people and voting reasons, and a type-only Presence import; it has no runtime change.
The existing document commit seam passes moved page IDs and the step's open page to hosted edits.
History-preview page preservation is handled by the existing page owner and hosted callback;
`team/history-panel.tsx` needs no change.

Exact App substitutions from e442c8a:

**e442c8a line 54.** Before:

```tsx
  } = useBoardDocument({ readOnly, setStatus, hosted: team?.hosted, nameSent: team?.nameSent }); const pages = usePages({ board, model, stepPage, hosted: !!team?.hosted, commit, finishTextSession, select, setMessage, getView: () => view, setView: value => setView(value), getObjects: () => allDisplayedObjects, openingReason: () => busy || composing || tidy.open ? "Finish the current action first." : "", editingReason: () => commandReason || (tidy.open ? "Apply or cancel Tidy up first." : "") });
```

After:

```tsx
  } = useBoardDocument({ readOnly, setStatus, hosted: team?.hosted, nameSent: team?.nameSent }); const pages = usePages({ board, model, stepPage, hosted: !!team?.hosted, team: team?.hosted, canEdit: !team?.hosted || !readOnly, commit, finishTextSession, select, setMessage, getView: () => view, setView: (value, following) => following ? setFollowView(value) : setView(value), getObjects: () => allDisplayedObjects, openingReason: () => busy || composing || tidy.open ? "Finish the current action first." : "", editingReason: () => commandReason || (tidy.open ? "Apply or cancel Tidy up first." : "") });
```

**e442c8a line 136.** Before:

```tsx
  const hostedPaste = useHostedBoard({ hosted: team?.hosted, model, load, setBoard, setTitle, setDrafts, setReadOnly, setTool, setInline, select, paste: () => clipboardCommand("Paste"), composing });
```

After:

```tsx
  const hostedPaste = useHostedBoard({ hosted: team?.hosted, model, load, onChange: pages.changed, setBoard, setTitle, setDrafts, setReadOnly, setTool, setInline, select, paste: () => clipboardCommand("Paste"), composing });
```

**e442c8a line 182.** Before:

```tsx
      {team?.commentsLayer && team.hosted && <team.commentsLayer hosted={team.hosted} board={board} objects={displayedObjects} view={view} size={size} tool={tool} setTool={setTool} setView={setView} scene={scene} select={select} setInline={setInline} />}{team?.presenceLayer && team.hosted && <team.presenceLayer hosted={team.hosted} scene={scene} selected={selected} objects={displayedObjects} view={view} size={size} setFollowView={setFollowView} />}
```

After:

```tsx
      {team?.commentsLayer && team.hosted && <team.commentsLayer page={pages.id} openPage={pages.openPage} hosted={team.hosted} board={board} objects={displayedObjects} view={view} size={size} tool={tool} setTool={setTool} setView={setView} scene={scene} select={select} setInline={setInline} />}{team?.presenceLayer && team.hosted && <team.presenceLayer page={pages.id} hosted={team.hosted} scene={scene} selected={selected} objects={displayedObjects} view={view} size={size} setFollowView={setFollowView} />}
```

**e442c8a line 183.** Before:

```tsx
      {team?.votingLayer && team.hosted && <team.votingLayer hosted={team.hosted} objects={displayedObjects} view={view} size={size} finishTextSession={finishTextSession} cancel={cancel} setInline={setInline} setTool={setTool} select={select} setView={setView} />}
```

After:

```tsx
      {team?.votingLayer && team.hosted && <team.votingLayer page={pages.id} openPage={pages.openPage} allObjects={allDisplayedObjects} hosted={team.hosted} objects={displayedObjects} view={view} size={size} finishTextSession={finishTextSession} cancel={cancel} setInline={setInline} setTool={setTool} select={select} setView={setView} />}
```

**e442c8a line 196.** Before:

```tsx
      {!team?.hosted && <Notice pages={pages}
```

After:

```tsx
      {(!team?.hosted || !!visibleMessage) && <Notice pages={pages} hosted={!!team?.hosted}
```

#### Changed test line ranges

Ranges are from `git diff --unified=0 a46a6a1..42c2387a6744c52bf1e0e753d5bd7ba470f01d7b -- tests/`; zero-length ranges denote insertions/deletions.

| File | Prerequisite ranges | Validated source ranges |
| --- | --- | --- |
| `tests/README.md` | 671 (0) | 672–680 |
| `tests/comments.test.mjs` | 30, 281, 283, 291, 299, 323 (0) | 30, 281, 283, 291, 299, 324 |
| `tests/import-fixture.mjs` | 10, 16, 18 (0), 20 | 10–11, 17, 20, 22 |
| `tests/mentions.test.mjs` | 54, 56, 76 | 54, 56, 76 |
| `tests/modules.test.mjs` | 558, 594–596, 599–600, 603–604, 607–608, 611–612, 615–672, 698 (0) | 558, 594–596, 599–600, 603–604, 607–608, 611–612, 615–616, 643–646 |
| `tests/pages.test.mjs` | 63, 74–75, 294, 297, 300–301 | 63, 74–75, 294, 297, 300–301 |
| `tests/presence.test.mjs` | 11 | 11 |
| `tests/server/history.test.ts` | 39, 53 | 39, 53 |
| `tests/server/lifecycle.test.ts` | 34 | 34 |
| `tests/server/mentions.test.ts` | 17–18, 19 (0), 182 | 17–18, 20, 183 |
| `tests/server/pages.test.ts` | 105–113, 114 (0), 116–119 | 105–111, 113–114, 116–120 |
| `tests/server/reactions.test.ts` | 42, 50, 96 | 42, 50, 96 |
| `tests/server/shared.test.ts` | 17, 547, 603, 610, 620, 729, 744, 758, 897 | 17, 547, 603, 610, 620, 729, 744, 758, 897 |
| `tests/server/spotlight.test.ts` | 42, 58, 185 | 42, 58, 185 |
| `tests/server/team-pages.test.ts` | 0 (0) | 1–181 |
| `tests/server/timer.test.ts` | 61, 72 | 61, 72 |
| `tests/server/voting.test.ts` | 30, 33, 65, 69, 86 | 30, 33, 65, 69, 86 |
| `tests/shared-editing.test.mjs` | 211 | 211 |
| `tests/team-import.test.mjs` | 86 | 86 |
| `tests/team-pages.test.mjs` | 0 (0) | 1–211 |
| `tests/web-presence.test.mjs` | 7, 64–65 | 7, 64–65 |
| `tests/workshop-reactions.test.mjs` | 33, 44, 69, 71, 111 | 33, 44, 69, 71, 111 |
| `tests/workshop-spotlight.test.mjs` | 33, 70, 126 | 33, 70, 126 |
| `tests/workshop-timer.test.mjs` | 41 | 41 |
| `tests/workshop-voting.test.mjs` | 29, 37, 49, 69–70, 88, 92, 94, 96, 99–100, 119, 161, 163 | 29, 37, 49, 69–70, 88, 92, 94, 96, 99–100, 119, 161, 163 |

All other historical assertion changes are limited to the brief's pageMap, presence page, anchor page, vote page, storage-version and named page-test dispositions.

#### Files changed in the source commit

```text
M	apps/server/src/routes/boards.ts
M	apps/web/src/App.tsx
M	apps/web/src/find.ts
M	apps/web/src/state/use-board-document.ts
M	apps/web/src/state/use-hosted-board.ts
M	apps/web/src/state/use-pages.ts
M	apps/web/src/state/use-presence.ts
M	apps/web/src/team/comments/card.tsx
M	apps/web/src/team/comments/layer.tsx
M	apps/web/src/team/comments/panel.tsx
M	apps/web/src/team/comments/rules.ts
M	apps/web/src/team/hosted-board.ts
A	apps/web/src/team/page-presence.ts
M	apps/web/src/team/people.tsx
M	apps/web/src/team/presence-layer.tsx
M	apps/web/src/team/presence.ts
M	apps/web/src/team/reactions-layer.tsx
M	apps/web/src/team/reactions.ts
M	apps/web/src/team/templates-rules.ts
M	apps/web/src/team/templates-section.tsx
M	apps/web/src/team/voting-card.tsx
M	apps/web/src/team/voting-overlay.tsx
M	apps/web/src/team/voting-rules.ts
M	apps/web/src/team/voting.ts
M	apps/web/src/ui/move-to-page.tsx
M	apps/web/src/ui/notice.tsx
M	apps/web/src/ui/pages-panel.tsx
M	apps/web/style.css
M	docs/guides/try-board.md
M	packages/board-room/src/backups.ts
M	packages/board-room/src/comments.ts
M	packages/board-room/src/conflicts.ts
M	packages/board-room/src/edit-session.ts
M	packages/board-room/src/edits.ts
M	packages/board-room/src/history.ts
M	packages/board-room/src/presence.ts
M	packages/board-room/src/room.ts
M	packages/board-room/src/storage.ts
M	packages/board-room/src/voting.ts
M	packages/board-sync/src/codec.ts
M	packages/board-sync/src/comments.ts
M	packages/board-sync/src/document-adapter.ts
A	packages/board-sync/src/order-keys.ts
M	packages/board-sync/src/session.ts
M	packages/board-sync/src/undo.ts
M	packages/board-sync/src/voting.ts
M	tests/README.md
M	tests/comments.test.mjs
M	tests/import-fixture.mjs
M	tests/mentions.test.mjs
M	tests/modules.test.mjs
M	tests/pages.test.mjs
M	tests/presence.test.mjs
M	tests/server/history.test.ts
M	tests/server/lifecycle.test.ts
M	tests/server/mentions.test.ts
M	tests/server/pages.test.ts
M	tests/server/reactions.test.ts
M	tests/server/shared.test.ts
M	tests/server/spotlight.test.ts
A	tests/server/team-pages.test.ts
M	tests/server/timer.test.ts
M	tests/server/voting.test.ts
M	tests/shared-editing.test.mjs
M	tests/team-import.test.mjs
A	tests/team-pages.test.mjs
M	tests/web-presence.test.mjs
M	tests/workshop-reactions.test.mjs
M	tests/workshop-spotlight.test.mjs
M	tests/workshop-timer.test.mjs
M	tests/workshop-voting.test.mjs
M	vitest.node.config.ts
M	vitest.workerd.config.ts
```


### Planner amendments A1–A3 (fix round 1)

The planner approved the three implementation escalations as amendments to brief v1.
These amendments supersede the pending-approval status in the preceding record; that record
remains unchanged.

- **A1 — F1-U13.** The find-bar guard must still occur exactly once in all four files.
  `team/reactions-layer.tsx`, `team/comments/layer.tsx` and `state/use-presence.ts` received
  the page changes authorized by web modules v42, so their obsolete whole-file comparisons
  are removed. `team/spotlight-layer.tsx` was not changed; its existing whole-file comparison
  remains. Only the comparison line in F1-U13 changes; nothing else in that test changes.
- **A2 — retained recovery.** `apps/server/src/worker.ts` is added to the allowlist for the
  version guard only. Its retained-recovery check now accepts storage versions **7 or 8**;
  every other condition is unchanged. Searching all of `apps/server/src` and `scripts`
  (`rg -n 'storage_version|storageVersion|!== ?7|=== ?7' apps/server/src scripts`) found no
  other matching guard in the Node runner, its startup/scripts, Worker entry points or
  operator routes. No other entry-point file needed a change.
- **A3 — sync inventory.** The effective web modules v42 count is **11 existing files plus
  `order-keys.ts`, 12 total**. The exact twelve-file inventory test is retained unchanged.

Branch: `codex/0010-W3-pages-on-team-boards`.
Fix-round prerequisite / prior record tip: `5c2c6cf6772c0bb55a93d446c29540e313317e82`.
New validated source/test revision: **`926d95afc151274e62c63048a29cac7abd1143f6`**.
Source/test and this append-only record are separate commits; the final record tip is reported
in the handoff. No merge, push or deployment occurred. Added dependencies: none.

| Check | Commands / inspection | Fix-round result |
| --- | --- | --- |
| V3 | `npm run typecheck` | **PASS**: exit 0; all five workspace members |
| V4 | Full `npm test` | **PASS**: exit 0; 1,273 tests, 1,273 pass, 0 fail, 0 skipped. All 22 P3 checks pass; F1-U13 and W1-U32/U33 now pass |
| V5 | Team-off `npm run build`; `npm run audit:licenses`; `cmp apps/web/dist/THIRD_PARTY_NOTICES.txt docs/architecture/0001-runtime-notices-v1.txt` | **PASS**: 3/3 commands exit 0 |
| V6 | `npm run build:fixtures`; team-on `npm run build`; `npm run audit:licenses`; `cmp apps/web/dist/THIRD_PARTY_NOTICES.txt docs/architecture/0001-runtime-notices-v3.txt` | **PASS**: 4/4 commands exit 0 |
| V7 | `npm run build:server`; `npm run audit:licenses`; `WRANGLER_SEND_METRICS=false npx wrangler deploy --dry-run --outdir <scratch> -c apps/server/wrangler.json` | **PASS**: 3/3 commands exit 0; no deploy |
| V8 | All fix hunks inspected; `git diff --name-status 5c2c6cf6772c0bb55a93d446c29540e313317e82..926d95afc151274e62c63048a29cac7abd1143f6`; `git diff --check 5c2c6cf6772c0bb55a93d446c29540e313317e82..926d95afc151274e62c63048a29cac7abd1143f6` | **PASS**: only the two amended source/test lines below; this record is appended separately |

Both web builds used the brief's synthetic settings:
`BOARD_SUPABASE_URL=http://127.0.0.1:55321`, `BOARD_SUPABASE_ANON_KEY=synthetic`,
`BOARD_SERVER_URL=http://127.0.0.1:8796`, and `BOARD_TEAM_FEATURES=off` or `on` respectively.
Node 26.13.0 and npm 11.20.0 were unchanged. All twelve validation commands above exited 0.
Validation started **2026-11-16T19:40:08.103211+00:00** and ended **2026-11-16T19:40:19.241376+00:00**;
the full unit run was **2026-11-16T19:40:09.055292+00:00–2026-11-16T19:40:17.157784+00:00**.
The host's `pmset -g log` Sleep/Wake inspection showed no sleep overlapping this interval.
The source commit's pre-commit and commit-message public-boundary hooks passed. Git again
reported the non-fatal `packed-refs.lock` sandbox maintenance error; the committed source ref
and clean source worktree were verified.

#### Fix-round changed-file and line-range inventory

Ranges compare the prior record tip to this round's source or record commit. Each source/test
change replaces one line (two insertions and two deletions in total). The brief change is append-only.

| File | Before | After | Change |
| --- | --- | --- | --- |
| `apps/server/src/worker.ts` | 41 | 41 | Accept versions 7 and 8; retain all other recovery conditions |
| `tests/find.test.mjs` | 213 | 213 | Retain the whole-file assertion only for unchanged spotlight-layer; keep all four exact-once guards |
| `docs/briefs/0010-W3-pages-on-team-boards.md` | Insertion after 674 | 675–739 | This fix-round record only |

No App, dependency, inventory, other test or runtime file changed in this round.
V1 and V2 were not rerun; their preceding results remain recorded. Still unrun in this sandbox:
Supabase CLI/schema/stack setup, V9 and S417–S424 on both server runners
(`npm run test:server:node`, `npm run test:server:workerd`), and V10–V13, including N2,
runtime design comparison, independent negative checks and A–J/browser checks. Browsers and
Supabase CLI cannot start here. V3–V8 are now clear; independent server/browser acceptance remains.


### Server fix round — 0010-W3 v1

Maintainer-authorized server diagnosis and test fixes, outside the review cap. Branch:
`codex/0010-W3-pages-on-team-boards`. Prior record tip / round base:
`daad0de6391cc57bfebdbd58e674cc92a6af95da`. Validated source/test revision:
**`0bc7dac8eba4b30b8ca3c7f5a73b8fc01c304143`**. The source/test and append-only record commits are separate;
the final record tip is reported in the handoff. No product source, dependency, schema,
runner, S93 timing assertion or timing threshold changed. No merge, push or deployment.

#### Failure causes, fixes and limits

| Failure | Proven cause or investigation result | Fix / focused evidence |
| --- | --- | --- |
| Node S421 | The test selected another connection's legitimate `present` frame. `seed()` leaves an editor connection on the first page; vote start relays every connection's retained presence, including that placeholder. The sender's page remains correct. Filtering only by person would also be insufficient because the seed and sender are the same person's separate connections | S421 now filters initial, stale-page and redacted frames by `a.joined.self.connection`. P3-U23 reproduces three connections, including two for one person: the first relayed frame belongs to the seed on the first page; the sender retains Ideas. A stale-page frame consumes its budget without changing retained presence, relaying or refusing; real vote-start redaction clears cursor, selection and view while retaining the sender's page. Fresh input during the vote also keeps that page. Product presence v5 is unchanged |
| Node S424; workerd S423/S424 | S421 freezes the runner clock at `Date.now()+2000` and never resets it. Later `removal-fixture` calls mint fresh sign-in tokens using real time. Once real time overtakes the frozen value, their `iat` is in the server's future, so the existing Auth check correctly returns `token_malformed`. The tokens are fresh per fixture, rather than module-load tokens; this is neither expiry nor a wrong-runner issuer/key | The page suite resets `fixedNow` to `null` and `offset` to 0 before each fixture and in an `afterEach` finally block. P3-U24 loads the actual page-suite helper callbacks, uses the real JWT signer and Auth verifier, and deterministically reproduces the same future-iat rejection. It failed with `token_malformed` before the helper fix, then passed for two successive fixtures and cleanup resets. No authentication product change |
| workerd S93 | **No product cause found; timing remains unproven here.** The supplied Node run passed S93 at 1/10/50 boards (57.49 / 102.27 / 466.96 ms). The workerd run failed the two-second assertion; 27,864 ms is the whole scenario duration, including setup, and the failure does not identify the board count or print its per-count timing. The termination warnings occur at shutdown for other test files; they do not establish a cause for S93 | Seven removal/delivery/support files and five relevant Room methods are byte-for-byte unchanged from e442c8a (listed below). P3-U25 exercises actual access delivery and close callbacks for warm and reconstructed version-8 rooms: each closes the removed peer with 4403, clears presence, and during delivery performs zero page conversions, snapshot replacements, vote resets or backups. Access-source calls are 2 warm / 3 reconstructed. No S93 or product fix was made; workerd timing still requires the server-only rerun |

Baseline-equality inspection covered these seven whole files:
`packages/board-room/src/access.ts`, `spotlight.ts`, `copies.ts`,
`apps/server/src/delivery.ts`, `apps/server/src/routes/access.ts`,
`tests/server/removal.test.ts` and `tests/server/peer.ts`.
The five unchanged Room methods are `close`, `closeAll`, `refresh`, `changed` and `closed`.
The version-7 conversion is guarded by the stored version and finishes at 8; P3-U15 also
continues to prove conversion happens once. Fresh/current version-8 delivery does not enter it.
The added `initialize()` table-info read is bounded and issues no ALTER on a current room;
no evidence ties it to the workerd timing failure. Ordinary last-close history/snapshot behavior
remains the baseline behavior; the no-snapshot observation above refers to access delivery.
These room-level checks do not measure Durable Object/WebSocket transport or Supabase latency.

#### Commands and results

| Check | Command / inspection | Result |
| --- | --- | --- |
| Focused reproduction | `node --test --test-reporter=tap --test-name-pattern='P3-U2[345]' tests/team-pages.test.mjs` before the helper fix | Expected failure: 3 tests, 2 pass, 1 fail; P3-U24 reports `token_malformed`; P3-U23 and P3-U25 pass with the product unchanged |
| Focused verification | Same command after the fix | **PASS**: exit 0; 3/3 tests, 0 fail, 0 skipped |
| V3 | `npm run typecheck` | **PASS**: exit 0 across all five workspace members |
| V4 | Full `npm test` | **PASS**: exit 0; 1,276 tests, 1,276 pass, 0 fail, 0 skipped; P3-U01–P3-U25 all pass |
| V8 | Round hunks inspected; `git diff --name-status daad0de6391cc57bfebdbd58e674cc92a6af95da..0bc7dac8eba4b30b8ca3c7f5a73b8fc01c304143`; `git diff --check daad0de6391cc57bfebdbd58e674cc92a6af95da..0bc7dac8eba4b30b8ca3c7f5a73b8fc01c304143`; cumulative inventory and whitespace inspected with the same two commands over `a46a6a1..0bc7dac8eba4b30b8ca3c7f5a73b8fc01c304143` | **PASS**: this round changes only the two authorized test files below, with no new file; 104 insertions / 7 deletions. Earlier milestone inventory is unchanged. This record is appended separately |

Final focused/V3/V4 validation ran from **2026-11-16T20:37:49.204725+00:00** to **2026-11-16T20:37:59.908940+00:00** UTC;
the full unit run was **2026-11-16T20:37:50.497602+00:00** to **2026-11-16T20:37:59.908940+00:00** UTC.
No stack, browser, Supabase CLI or server suite was started. The source commit's pre-commit
and commit-message public-boundary hooks both passed. Git printed the existing non-fatal
`packed-refs.lock` sandbox maintenance error; the new source ref and clean worktree were verified.
Added dependencies: none. No new scope escalation; S93 remains an unresolved server acceptance item.

#### Round changed-file and line-range inventory

Ranges are relative to `daad0de6391cc57bfebdbd58e674cc92a6af95da`.

| File | Before | After | Change |
| --- | --- | --- | --- |
| `tests/server/team-pages.test.ts` | 13; 71; 137–138; 140; 142 | 13–16; 74; 140–141; 143; 145 | Reset suite clock before fixture and after cleanup; select presence by sender connection |
| `tests/team-pages.test.mjs` | 115; insertion after 211 | 115; 212–305 | Permit the fixture's same-person second connection; add P3-U23/U24/U25 |
| `docs/briefs/0010-W3-pages-on-team-boards.md` | Insertion after 739 | 740–807 | Append this server-fix record only |

#### Remaining independent validation

Both full server suites remain **unrun in this sandbox**:
`npm run test:server:node` and `npm run test:server:workerd` on the validated source above
with a fresh stack. They must recheck S421, S423 and S424, the unchanged S93 two-second
1/10/50-board check, and worker shutdown. The supplied preceding server run on daad0de
was Node **418 pass / 2 fail / 0 skipped**, workerd **413 pass / 3 fail / 2 skipped**;
those are not results for this fix. S411–S420 and S422 passed on both in that run.
V1/V2 and V5–V7 were not repeated this round. Browser acceptance, V10–V13 and the other
previously unrun independent checks remain unrun; browsers and Supabase CLI cannot start here.


### Review fix round 1 — F1–F4 (0010-W3 v1)

Branch: `codex/0010-W3-pages-on-team-boards`. Reviewed candidate / round base:
`52e05840f7d3c4e03b239e753c5d237d9f638cff`. New validated source/test revision:
**`f81befe546dde68307c1b16747b77256223867fa`**. Source/tests and this append-only record are separate
commits; the final record tip is reported in the handoff. No merge, push or deployment.
All changes are in the brief's existing allowlist. No new file, dependency or stored key.

#### Findings, causes and fixes

| Finding | Cause established by source and focused regression | Fix and proof |
| --- | --- | --- |
| F1 — team template capture | The page-save call intentionally supplies no canvas geometry. `buildSnapshot` can use saved rectangles, but a connector has no saved `x`/`y` box. Its missing display box causes the exact undefined-`x` exception before the dialog is set | `templateSnapshot` fills missing connector boxes using the existing connector layout and saved endpoint geometry, retaining supplied display boxes and the existing Copy normalization. The placement box is not stored in a template. P3-U26 exercises the actual section click, dialog rendering, source line, preview and Save handler/controller: five open-page objects including a connector, four preview rectangles and one line, exact source words, and a five-object request payload with no `page`, `order` or `generation`; the other page is excluded |
| F2 — remembered hosted page | On the initial hosted handoff, the old model is a placeholder. The page-change callback applies deletion fallback to that placeholder's page and `openPage` writes the first page over the real board's remembered preference before the next render | `usePages` distinguishes the first reload arrival for each hosted board and chooses `remembered(next)` before ordinary deletion fallback. Later reloads retain the live-page/preceding-page rule. P3-U27 fails before the fix for the lost remembered page and passes after it for both a different-id placeholder and a one-page same-id placeholder, subsequent reload deletion, and direct local/hosted remembered-page opening |
| F3 — hosted notice visibility and navigation | The hosted-only early return bypasses `showNotice` and drops the existing Move-to-page Go button. Hosted startup also retains the local-only opening message | Remove the early return: the existing notice markup, `hidden={!showNotice}` gate and Go control serve both routes. Clear the local startup message once on hosted mount through the existing message setter. Follow and remote-delete messages continue through that setter. P3-U28 proves the false visibility gate, enabled/disabled Go button and its action, and both page notices; P3-U29 also proves the opening message is absent before hosted chrome commits |
| F4 — candidate-only board-details/spotlight layout | The injected startup notice changes an input to the existing `usePanelLayout` mount effect. That effect captures the notice element once and adds its height plus 8 px to the board-details offset. This creates a persistent candidate-only offset relative to the previously notice-free hosted mount; spotlight geometry and board-details markup are unchanged | Clear the local startup message during the hosted render handoff, before chrome measurement, restoring the baseline captured inputs. P3-U29 uses the real messages/pages/notice/panel-layout code with synthetic measured rectangles: before the fix the panel offset is 116 px rather than 68 px; afterward it is 68 px and stays there when the viewer's later read-only message appears. The existing spotlight geometry remains unchanged. **This proves the layout-input regression and its repair, not a browser pointer hit-test: the exact P1-S45 Close-board-details click still requires the independent browser rerun** |

For F4, whole-file equality against e442c8a was verified for
`apps/web/src/state/use-panel-layout.ts`, `apps/web/src/team/spotlight-layer.tsx`,
`apps/web/src/team/spotlight-rules.ts` and `apps/web/src/ui/board-panel.tsx` (4/4 unchanged).
The single-page presenter case does not enter the new cross-page follow branch.
No spotlight state, frame, collision formula, stacking or CSS changed in this round.
App.tsx retains its exact five recorded substitutions and 264 lines. All file counts and
passive-effect guards remain unchanged, including the two effects in `use-pages.ts`.

#### Focused discrimination and validation

The new tests were written before the product fixes. With the three implementation files
at the reviewed 52e0584 content, all four checks fail by name: F1 undefined-`x`, F2 wrong
page, F3 ignored visibility, F4 panel offset 116 instead of 68. No import/setup abort counts
as a negative. The implementation files were restored after this negative verification;
no unrelated work was changed and no stash or hook bypass was used.

| Check | Commands / inspection | Result |
| --- | --- | --- |
| Focused, before fix | `node --test --test-reporter=tap --test-name-pattern='P3-U2[6789]' tests/team-pages.test.mjs` with reviewed product content | Expected failure: 4 tests, 0 pass, 4 fail, 0 skipped |
| Focused, after fix | Same command on the validated source | **PASS**: exit 0; 4/4, 0 fail, 0 skipped |
| V3 | `npm run typecheck` | **PASS**: exit 0 across all five workspace members |
| V4 | Full `npm test` | **PASS**: exit 0; 1,280 tests, 1,280 pass, 0 fail, 0 skipped; all P3-U01–P3-U29 pass |
| V5 | Team-off `npm run build`; `npm run audit:licenses`; `cmp apps/web/dist/THIRD_PARTY_NOTICES.txt docs/architecture/0001-runtime-notices-v1.txt` | **PASS**: 3/3 commands exit 0 |
| V6 | `npm run build:fixtures`; team-on `npm run build`; `npm run audit:licenses`; `cmp apps/web/dist/THIRD_PARTY_NOTICES.txt docs/architecture/0001-runtime-notices-v3.txt` | **PASS**: 4/4 commands exit 0 |
| V7 | `npm run build:server`; `npm run audit:licenses`; `WRANGLER_SEND_METRICS=false npx wrangler deploy --dry-run --outdir <scratch> -c apps/server/wrangler.json` | **PASS**: 3/3 commands exit 0; no deploy |
| V8 | Every round hunk inspected; `git diff --name-status 52e05840f7d3c4e03b239e753c5d237d9f638cff..f81befe546dde68307c1b16747b77256223867fa` and `git diff --check 52e05840f7d3c4e03b239e753c5d237d9f638cff..f81befe546dde68307c1b16747b77256223867fa`; cumulative inventory and whitespace inspected with the same two commands over `a46a6a1..f81befe546dde68307c1b16747b77256223867fa` | **PASS**: four authorized source/test files, no added file; 141 insertions / 7 deletions. This record is appended separately |

Both web builds used synthetic settings: `BOARD_SUPABASE_URL=http://127.0.0.1:55321`,
`BOARD_SUPABASE_ANON_KEY=synthetic`, `BOARD_SERVER_URL=http://127.0.0.1:8796`, and
`BOARD_TEAM_FEATURES=off` or `on` respectively. Node 26.13.0 / npm 11.20.0 unchanged.
All thirteen focused/V3–V7 commands exited 0. They ran from **2026-11-16T22:03:56.526335+00:00** to
**2026-11-16T22:04:15.921627+00:00** UTC; the full unit run was **2026-11-16T22:03:58.708581+00:00** to **2026-11-16T22:04:13.469468+00:00** UTC.
The source commit's pre-commit and commit-message public-boundary hooks both passed.
The existing non-fatal `packed-refs.lock` sandbox maintenance error was printed; the source
ref and clean worktree were verified. Added dependencies: none. No scope escalation.

#### Round changed-file and line-range inventory

Ranges compare 52e0584 with the source or separate record commit.

| File | Before | After | Change |
| --- | --- | --- | --- |
| `apps/web/src/state/use-pages.ts` | Insertions after 39, 156, 162 | 40–42; 160; 167 | Hosted startup message handoff and first-arrival preference restoration |
| `apps/web/src/team/templates-rules.ts` | 3; insertion after 4; insertion after 28; 30 | 3; 5; 30–36; 38 | Supply missing connector geometry to the normalized page snapshot |
| `apps/web/src/ui/notice.tsx` | 25; 27 | 25; old 27 deleted | Remove hosted-only rendering branch and use the shared notice path |
| `tests/team-pages.test.mjs` | 144; insertion after 150; 154–155; insertion after 305 | 144; 151; 155–156; 307–427 | Seed page preferences in the existing hook harness; focused component harness and P3-U26/U27/U28/U29 |
| `docs/briefs/0010-W3-pages-on-team-boards.md` | Insertion after 807 | 808–882 | This append-only review-fix record |

#### Unrun and handoff

Browsers and Supabase CLI cannot start in this sandbox. On this source, the two full server
suites and V9–V13 remain unrun here. The independent check run must confirm N2-S11's real
modal/preview/save, N2-S12's reload, the notice/Go behavior and approved captures, and the
exact P1-S45 click while a solo viewer presents. Local A–J and baseline-negative browser
checks likewise require that run. No browser pass or P1-S45 pointer success is claimed from
the stack-free regressions. V1/V2 were not repeated this round; dependencies are unchanged.
