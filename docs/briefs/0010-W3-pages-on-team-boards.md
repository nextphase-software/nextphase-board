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
