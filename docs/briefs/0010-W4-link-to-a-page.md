BRIEF VERSION: 0010-W4 v1 (2026-11-20)
# 0010-W4 — Link to a page

Status: Draft. Implementation has not started under this brief.

## Outcome and read first

A page of a board can be linked to, on local and team (hosted) boards alike.
- Every page's "…" menu starts with **Copy link to page**. Choosing it copies the page's link, closes the
  menu and the Pages list and shows a notice. Viewers of a team board get a "…" whose menu holds only this
  item.
- A team board's page link (`#/b/<board>?page=<page id>`) opens the board on that page for anyone who can
  open the board, after any sign-in. A local board's page link (`?board=<key>&page=<page id>`) opens that
  board on that page in the same browser, as the board was last saved there.
- The address bar follows the open page, so reloading or bookmarking keeps the page.
- A link to a page that no longer exists opens the board's first page with a notice.
- On a team board, a page link to the board already open switches page in place, without reopening the
  board.
- Copying and opening a link add no Undo step, change nothing saved and send no edit.

Read [AGENTS.md](../../AGENTS.md), [CONTRIBUTING.md](../../CONTRIBUTING.md), [DESIGN.md](../../DESIGN.md)
and these new contract files (prior versions remain untouched):

| Contract | New version / ownership |
| --- | --- |
| [Interaction](../architecture/0001-interaction-v46.md) | v46: page addresses, Copy link to page, the viewer's page menu, opening a board on a page, a link to the open board, the address following the open page, the notices |
| [Web modules](../architecture/0001-web-modules-v44.md) | v44: one new source module and one test file, the changed web paths, unchanged counts, no App.tsx change |

Use this set wherever inherited contracts link a replaced version. Unchanged: [document v20](../architecture/0001-document-v20.md),
[sync v15](../architecture/0003-sync-v15.md), [presence v5](../architecture/0004-presence-v5.md),
[comments v5](../architecture/0005-comments-v5.md), [workshop voting v3](../architecture/0007-workshop-voting-v3.md),
[team templates v2](../architecture/0008-team-templates-v2.md), [hosted storage v12](../architecture/0003-hosted-storage-v12.md),
[storage v3](../architecture/0001-storage-v3.md), [board file v4](../architecture/0006-board-file-v4.md),
[hosted persistence v10](../architecture/0003-hosted-persistence-v10.md), [board lifecycle v5](../architecture/0006-board-lifecycle-v5.md),
[API v12](../architecture/0003-api-v12.md), [access v13](../architecture/0003-access-v13.md),
[toolchain v5](../architecture/0001-toolchain-v5.md), [lock v5](../architecture/0001-dependency-lock-v5.json),
[inventory v5](../architecture/0001-dependency-inventory-v5.json) and [runtime notices v3](../architecture/0001-runtime-notices-v3.txt).
The 17 service tables remain: no service migration.

Build directly; no prototype or scenario tool is an input. Prove the stated values with focused tests,
followed by independent checks. Report a contract conflict before dependent work.

**Design.** The maintainer approved the look on 2026-11-20. Interaction v46 states every value of it: the
new item and separator take the page menu's existing look (v43), the viewer's "…" button takes the
editor's, and the notices are the app's existing notice.

## Deliverables and boundaries

Planning source baseline main **7de5c14**. Use a fresh milestone worktree and branch from committed main
containing this packet, recording that prerequisite base separately from the behaviour baseline. New source
files carry `SPDX-License-Identifier: Apache-2.0`. Only these files may change, plus the append-only
Implementation record below.

**New (two).**
1. `apps/web/src/page-links.ts` (web modules v44)
2. `tests/page-links.test.mjs`

**Changed** (under `apps/web/src/` unless shown).

| # | File |
| --- | --- |
| 3 | `state/use-pages.ts` |
| 4 | `ui/pages-panel.tsx` |
| 5 | `team/links.ts` |
| 6 | `team/hosted-board.ts` |
| 7 | `team/team-app.tsx` |
| 8 | `ui/notice.tsx` (Retry editing only off hosted boards) |
| 9 | `state/use-panel-layout.ts` (the notice below the team notice column, within its one effect) |
| 10 | `state/use-storage-session.ts` (only: discard the startup page value when the initial load fails) |
| 11 | `apps/web/style.css` (only if interaction v46's viewer "…" or avatar spacing needs a rule) |
| 12 | `tests/pages.test.mjs` and `tests/team-pages.test.mjs` (only the dispositions below) |
| 13 | `tests/README.md` (the new test file) |
| 14 | `docs/guides/try-board.md` (two rows and one sentence, below) |

Type-only changes in other web files are allowed where the compiler needs them, with no behaviour change;
the record lists them. **App.tsx, every package, the room and the server do not change.**

New tests import the new module dynamically inside their named checks, never at top level, so on the 7de5c14
baseline each new check fails by name (V12).

**Try-and-test guide.** One row at the end of Part 1's table and one at the end of Part 2's. In Part 2's
existing "Pages on team boards" row, the sentence `Mia's list has no + and no "…" and says "View only".`
becomes `Mia's list has no + and says "View only"; her "…" menus hold only Copy link to page.` Nothing else
in the guide changes.

Part 1 (local):

| Feature | Try this | You should see |
| --- | --- | --- |
| [Link to a page](../briefs/0010-W4-link-to-a-page.md) | On a board with two pages, "Page 1" and "Ideas", click Save. Open Pages, choose "…" on Ideas, then Copy link to page. Open Page 1, paste the link into the address bar and press Return. Then open Pages, choose "…" on Ideas, choose Delete page and click Save; paste the link into the address bar again and press Return | "Link to “Ideas” copied. It opens in this browser only." The board reopens on Ideas, and the address bar now ends with Ideas' page id. After the delete, the link opens the board on Page 1 with "That page no longer exists. You are on “Page 1”." |

Part 2 (team mode):

| Feature | Try this | You should see |
| --- | --- | --- |
| [Link to a page on team boards](../briefs/0010-W4-link-to-a-page.md) | Ana adds a page "Ideas" to a team board (Pages, then **+**, type "Ideas", Return) and, in the Pages list, chooses "…" on Ideas, then Copy link to page, and sends the link to Ben and Mia (for example in a chat). Ben, with the board open on Page 1, pastes the link into his address bar and presses Return; Mia opens it in a new tab. Mia opens Pages and chooses "…" on Page 1. Ana then deletes Ideas, and Ben pastes the link into his address bar again and presses Return | Ana sees "Link to “Ideas” copied." Ben moves to Ideas without the board reloading, and Mia's board opens on Ideas. Mia's menu has only Copy link to page. After the delete, Ben stays on the board, on Page 1, with "That page no longer exists. You are on “Page 1”." |

Not allowed:
- a dependency, font, image file, service, service migration or import exception;
- a stored value, a room message, a presence key or an Undo step;
- a change to App.tsx, a package, the room or the server;
- a state hook, scene part or screen part beyond web modules v44, or a changed effect count;
- a page value in the Share dialog's or the home lists' Copy link; links inside text; links to one object;
  the selection in the address; a preview card for a pasted link (a later milestone).

Outside the named new controls, the existing screens' markup stays exactly as at the base: the reviewer's
A–J comparison allows no mask.

## Required behavior and concrete design

Implement interaction v46 and web modules v44 in full. In particular:

- **Copy link to page** first in every page menu, then a separator; never disabled; the clipboard text, the
  closing of the menu and the list, focus on the Pages button and the three notices, exactly as v46 words
  them.
- **Viewers**: the "…" button on every row with an editor's name, look, place and showing rule; the menu
  with only Copy link to page; nothing else of v44's viewer list changes.
- **Opening on a page**: the page value read once, when the tab first shows the board (local initial
  adoption, hosted first real document); the linked page, or the first page with the missing-page notice, or
  today's remembered page with no value; today's opening view at that first show (a same-board link switches
  page with the Pages list's view rule: remembered view in the tab, else the fit); the page becomes the
  remembered one; on hosted boards presence carries it; after sign-in the link still applies.
- **A link to the open hosted board** switches page in place: no stop, no reopen, no leave question, Undo
  history kept; no page value changes nothing.
- **The address** rewritten with `history.replaceState` on every page change and when a board is first
  shown: no history entry, no `hashchange`, no page load.
- `parseLink("#/b/<uuid>")` stays exactly `{ kind: "board", board }`.

## Shared-path check dispositions

This inventory authorizes expectation changes, not additional historical runs.

| Shared path / older checks | Disposition |
| --- | --- |
| Tests listing the page menu's items in order, if any | The list gains `Copy link to page` and a separator first; nothing else in the order changes |
| Tests asserting a viewer's list has no "…" button, if any | The viewer's rows now have the "…" button, whose menu holds only `Copy link to page`; the other viewer assertions (no Add page, `View only`, no rename, no drag, no Move to page) stay |
| Tests asserting the address or fragment after a board or page opens | A **settled** address now carries the open page's value (interaction v46); the links copied by Share and the home lists, and the navigation targets set by notifications, history and import, stay bare board links; no other change |
| The hook harnesses of `tests/pages.test.mjs` and `tests/team-pages.test.mjs` | Each harness gets its own isolated `location` and `history` fake (an address string and a recording `replaceState`), reset per test, where `use-pages.ts` now reads and writes the address; no assertion changes for that reason |
| `tests/pages.test.mjs` P2-U28, P2-U32, P2-U35, F1 and F1b, and `tests/team-pages.test.mjs` checks 17, 18 and 27–29 (view memory, focus, CSS precedence, role changes, the placeholders, preview, startup notices) | Unchanged; they must pass as written (only the harness fake above is added) |
| `tests/board-lifecycle.test.mjs`, `tests/team.test.mjs` ("team links are strict…", line 28) and `tests/home.test.mjs` ("Home links are exact…", line 12): `parseLink`, `boardLink`, invitation links | Unchanged; they must pass as written: bare links keep their exact `deepEqual` results and `?x=1` stays bad |
| Module inventory: `tests/modules.test.mjs` | Unchanged; it must still pass as written (counts, effects, team list, App composition) |
| `tests/pages.test.mjs` P2-U29, P2-U30 and P2-U31 (page changes through Undo, Find and the page hook) | Unchanged; they must pass as written, with the harness fake |
| Earlier scenario tools and helpers that read the board id from the address or compare the fragment to `#/b/<id>` exactly (home and new-tab, notifications, import, history and denial, Trash, the voting, reaction and spotlight helpers) | Not rerun except V14. When run, they take the board id as the text before `?page=` and compare only the board part of the fragment; a settled address carries the page value, while clipboard and navigation targets stay bare. No other change |
| Historical check tools (earlier scenario tools) | Not rerun except the regression runs named under validation |
| Local shell: A–J | No mask. The addresses differ only by the page value, which the compare does not read; if it does, the check run reports it |

The record lists every changed line range under `tests/`.

## Browser checks

New scenario **N4-S1–N4-S9**. N4 was unused in existing public briefs when allocated. A fresh, independent
check run writes its tool from these clauses and the contract values. Each row prints its full ID, `PASS:`
or `FAIL:` and a summary, and keeps raw receipts and unrun rows.

Setup: 1440 × 900, scale 1, macOS Chrome, US keyboard layout, clipboard read and write permission granted to
the app's origin (except where a row denies it). Rows N4-S1–N4-S4 on the local app (single-user mode). Rows
N4-S5–N4-S9 on the local team stack started from the candidate on its own uniquely owned local Supabase
project, with Ana (owner), Ben (editor) and Mia (viewer) each in their own browser context. Use real pointer
and key events, never painted DOM. New capability rows also fail by name on the independent baseline 7de5c14.
Colours and sizes exactly as interaction v46. "Within 3 s" means the change shows within 3 seconds. Save a
real-state image for N4-S1, N4-S5, N4-S7 and N4-S9. Each row sets up its own state from its fixture (ids read
from the list rows' `data-page` and the board link), so on the baseline every row runs its own steps and fails
by its own check, never by a missing clipboard value from an earlier row; on the candidate the clipboard chain
is checked end to end. Rows N4-S1–N4-S3 share one Fixture L board and N4-S4 has its own; rows N4-S5–N4-S9 share
one Fixture T board (the positive clipboard chain stays within those groups).

**Fixture L** (local): a new board named `Link check` with pages `Page 1` and `Ideas` (added with the Pages
list's + and named), one sticky `One` on Page 1 and one sticky `Two` on Ideas, saved (`Locally saved`), view
100 % at (0, 0), Page 1 open, nothing selected.
**Fixture T** (team): the guide's Part 2 seed (Example team with Ana as owner, Ben as editor, Mia as viewer)
and sign-in steps; Ana chooses Home › New board, sets Board name to `Link check`, adds the page `Ideas` and a
sticky `Two` on it, and a sticky `One` on Page 1; Ben and Mia open the board (Page 1); every context at 100 %.

| ID | Scriptable behavior and expected result |
| --- | --- |
| N4-S1 | Fixture L. Open Pages and click Ideas (the list stays open); click the now current Ideas row's `Page options for Ideas` button: the menu (220 wide, 4 below the button, left edges aligned) holds, in order, `Copy link to page`, a separator, `Rename page`, `Duplicate page`, a separator, `Move up`, `Move down`, a separator, `Delete page`; focus is on `Copy link to page` with the focus fill `#eef1f5`; the row has the open-menu look. Capture local-menu. Press Return: the menu and the Pages list close, focus is on the Pages button, the notice reads `Link to “Ideas” copied. It opens in this browser only.` (capture local-copied) and the clipboard text equals the address with `page` set to Ideas' id and the same `board` value. The Undo button's state, the save state and `history.length` are unchanged |
| N4-S2 | Fixture L, on Ideas (the address's `page` is Ideas' id). Open Page 1 from the list: the address's `page` becomes Page 1's id and `history.length` is unchanged. Navigate the tab to the Ideas link (candidate: the text N4-S1 copied; both runs: the address with `page` set to Ideas' id read from the list's `data-page`): the board loads on Ideas (`Two` visible, Ideas current in the list) with today's opening view `{x: 0, y: 0, z: 1}`. Reload: still Ideas. Open Page 1 from the list: the address follows |
| N4-S3 | Fixture L; note Ideas' id. Delete Ideas from its menu and click Save. Navigate to the address with `page` set to the noted id: the board loads on Page 1 with the notice `That page no longer exists. You are on “Page 1”.`, and the address's `page` value is Page 1's id. The same notice for `page=nonsense` and for `page=` (empty). Then add a page `Later` without saving, copy its link and navigate to it: Page 1 and the same notice (the page was never saved) |
| N4-S4 | Fixture L, with the clipboard write made to fail (permission denied, or `navigator.clipboard.writeText` replaced by a rejecting function before the app loads). On Page 1, using keys only: focus the Pages button, press Return, ArrowDown to Ideas' name, Tab to its `Page options for Ideas` button, press Return, press Return on `Copy link to page`: the notice reads `Could not copy the link. Your browser blocked the clipboard.` and the list is closed |
| N4-S5 | Fixture T. Ana opens Pages and clicks Ideas (the list stays open), then clicks the current Ideas row's "…": the menu as N4-S1's. Capture team-menu. She chooses `Copy link to page`: notice `Link to “Ideas” copied.`; the clipboard text is `<origin>/#/b/<board id>?page=<Ideas id>` (origin and path as the board link's), and Ana's address shows the same fragment. Capture team-copied. She opens Pages again: no other change; the list stays open for N4-S6 |
| N4-S6 | Fixture T, Ben on Page 1, Ana's Pages list open. The tool transfers the Ideas link (candidate: Ana's copied text; both runs: built from the board id and Ideas' `data-page`) and sets a marker on Ben's `window`. Ben places an empty sticky on Page 1 (the tool records its object id) and waits until saved. Ben's fragment is set to the Ideas link (as the address bar does): within 1 s Ben is on Ideas, the marker is still set, and within 3 s Ana's Pages list shows Ben's avatar on Ideas. Ben opens Page 1 and presses ⌘Z: the recorded sticky is removed (his Undo history survived). Then, while Ben stays connected, the tool holds his outgoing socket messages (an init script queues the socket's sends while a flag is set), Ben places another sticky and the save area shows one change waiting; his fragment is set to the Ideas link: he moves to Ideas with no leave question; his fragment is then set to `#/files`: the leave question shows and the address already shows Ideas' link; he chooses Stay on this board: the address still shows Ideas' link, not the bare board link. The tool releases the held messages last and the sticky saves. Mia, in a new tab of her context, opens the Ideas link: her board opens on Ideas |
| N4-S7 | Fixture T, Mia (viewer) on Ideas. She opens Pages: each row lays out as an editor's (the "…" slot kept, the avatars 4 before it), the current row's "…" showing, named `Page options for <name>`; the header says `View only`; there is no Add page. She opens the current Ideas row's menu: it holds only `Copy link to page`, and the row has the open-menu look. Capture viewer-menu. Escape; she opens Page 1's menu and chooses `Copy link to page`: notice `Link to “Page 1” copied.` 8 below the `You can view this board…` banner, and the clipboard holds Page 1's link. She opens Pages again and double-clicks a name: no field opens |
| N4-S8 | Fixture T's board. A fresh, signed-out context opens the Ideas link (built from ids): the sign-in shows; signing in as Ben (code from `npm run team:code ben`) opens the board on Ideas |
| N4-S9 | Fixture T. The tool sets a fresh marker on Ben's tab; Ben opens Pages, clicks Ideas, confirms Ideas is current and closes the list. Ana deletes Ideas from its menu: Ben gets the existing remote-delete notice and Page 1. Ben's fragment is set to the Ideas link (built from the noted id): Ben stays on the board (marker still set), on Page 1, with `That page no longer exists. You are on “Page 1”.`, and his address shows Page 1's value. A fresh signed-in context of Mia opening the same link: Page 1 and the same notice. Capture missing (Ben). Then both guide rows (Part 1, Part 2) and the corrected sentence of the "Pages on team boards" row, walked as written: each `You should see` holds |

## Acceptance criteria

- **0010-W4-AC01:** On a team board every page's "…" menu starts with Copy link to page, for owners, editors
  and viewers. The copied link opens the board on that page for anyone who can open the board, after any
  sign-in. The address follows the open page; a page link for the board already open switches page in place.
  Copying and opening add no Undo step and send no edit. Look and placement match the approved design.
- **0010-W4-AC02:** A link whose page no longer exists, or whose page value is not a page of that board, opens
  the board on its first page with `That page no longer exists. You are on “<first page>”.`, and the address
  shows the first page.
- **0010-W4-AC03:** On a single-user board the same menu item copies a link that opens that board on that page
  in the same browser, with the notice `… It opens in this browser only.`; the address follows the page.

| Criterion | Evidence that shows it |
| --- | --- |
| 0010-W4-AC01 | N4-S5, N4-S6, N4-S7, N4-S8, N4-S9; V4 |
| 0010-W4-AC02 | N4-S3, N4-S9; V4 |
| 0010-W4-AC03 | N4-S1, N4-S2, N4-S4; V4 |

## Applicable DESIGN.md guardrails

Canvas-first shell, native controls and visible focus, minimum action hits, protected native editing and
independent state owners apply. The new item is a menu item of an existing menu, reachable by keys; the
viewer's "…" is the editor's button. Interaction v46 states every new word; never infer generic styling. No
new sound, font or image file.

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
git diff --name-status <prerequisite-base>..<validated-source>
git diff --check <prerequisite-base>..<validated-source>
```

No server, room or package file changes, so there is no separate server run: the server suites are taken
from the repository's Checks workflow run on the exact candidate commit (V9). The check run starts the team
stack on its own uniquely owned local Supabase project. Record each long run's start and end and the host's
sleep and wake events; a run that overlapped a sleep is INVALID and is rerun awake. Three manual checks from
this milestone are chosen only at Review.

| Check | Command/inspection and pass condition |
| --- | --- |
| V1 | Byte-compare manifests, locks, dependency inventory and runtime notices against the prerequisite base: unchanged, no new dependency |
| V2 | `npm ci --ignore-scripts --no-audit --no-fund` exits 0 on the clean candidate and on the independent baseline |
| V3 | `npm run typecheck` exits 0 across all five workspace members |
| V4 | `npm test` full suite exits 0. `tests/page-links.test.mjs` proves each group below. Guards as web modules v44 |
| V5 | Team-off `npm run build` and `npm run audit:licenses` exit 0; notices equal runtime notices v1 (team off) |
| V6 | `npm run build:fixtures`, team-on `npm run build` and `audit:licenses` exit 0; team-on notices equal runtime notices v3 |
| V7 | `npm run build:server`, `audit:licenses` and the wrangler dry run exit 0; no deploy |
| V8 | Inspect all hunks plus `git diff --name-status` and `git diff --check` over `<prerequisite-base>..<validated-source>`: only the deliverables, the dispositions above and the append-only Implementation record; no file under `packages/`, `apps/server/` or `supabase/`, and `apps/web/src/App.tsx` unchanged |
| V9 | The Checks workflow's server suites (Node and workerd) pass on the exact candidate commit; any server check the workflow does not count is listed as not run |
| V10 | N4-S1–N4-S9 pass with the state captures and raw receipts |
| V11 | Design: the captures of N4-S1, N4-S5, N4-S7 and N4-S9 show every look interaction v46 states, and the reviewer compares them with the approved design |
| V12 | Once, on an independent 7de5c14 source and build with the candidate's `tests/page-links.test.mjs` copied in: its checks and the new browser capability checks fail by name; a top-level setup or import abort does not count |
| V13 | Accepted A–J compare: baseline twice, then candidate and diffs, with existing normalization and no mask |
| V14 | Accepted regression runs: the full unit suite (V4), A–J (V13), and the earlier pages scenarios N1 (single-user pages, 0010-W2 brief) and N2 (team pages, 0010-W3 brief) on the candidate, with these expectation changes only: N1-S4's item list starts with `Copy link to page` and a separator (three separators in all), and from the focused first item one ArrowDown focuses `Rename page`; N2-S6's "no "…" on any row" becomes "each row has the "…" (v46's showing rule) whose menu holds only `Copy link to page`"; N2's setup takes the board id from the address as the text before `?page=`; N2-S14 walks the guide row as now worded; N1-S16 (hosted boards without pages) was superseded by 0010-W3 and is not rerun. N1-S13's schema-13 assertion fails on 7de5c14 too (the schema is 14 since 0011-W1): a baseline finding. Any other row that also fails on 7de5c14 is a baseline finding |

`tests/page-links.test.mjs` is self-contained: it builds its own hook and render harnesses (as the existing
pages tests build theirs, with isolated `location` and `history` fakes), so V12 copies only that file to the
baseline. What it proves for V4:
- **Reading:** the page value of hosted fragments (`#/b/<uuid>?page=<id>`, empty, malformed, other
  parameters bad as today) and of local addresses (`?board=<key>&page=<id>`, encoded values, absent); no page
  value from other fragment kinds.
- **`parseLink`:** `#/b/<uuid>` gives exactly `{ kind: "board", board }`; `#/b/<uuid>?page=<value>` adds
  `page`; `#/b/<uuid>?x=1` and `#/b/<uuid>?page=a&x=1` stay bad; invitation, home, workspace and Trash links
  unchanged.
- **Building:** a hosted page link from an address with any query or fragment gives
  `<origin><path>#/b/<board>?page=<id>`; a local page link keeps every other part of the address and sets
  `page`.
- **Resolving:** a known page id opens that page with no notice; unknown, malformed and empty values open the
  first page with the missing-page notice; no value gives today's remembered page, else the first page.
- **Words:** the three notices, each exactly as interaction v46, with curly quotes.
- **Pages state** (with its own hook harness and address fakes): choosing Copy link to page closes
  the menu and the list and sets the notice; the menu opens for viewers; an editor's open menu closes when
  the board turns read-only; the page value is resolved on the first adoption or first snapshot only, never on
  a later board; the address is written with `replaceState` on every page change, never with `pushState` or
  `location.hash`; `use-pages.ts` keeps exactly two passive effects.
- **Panel markup** (rendering the real `PagesPanel` to static markup, as other screen-part tests render
  theirs): the item order with `Copy link to page` and its separator first; the item never disabled (editor,
  viewer, editing not allowed); a viewer's menu holding only it; a viewer's rows with the "…" button.
- **Notice:** `ui/notice.tsx` renders no Retry editing on a hosted board.
- **Same-board link:** with a hosted board open, a `hashchange` to a link of the same board calls
  `openLinkedPage` and never stops the board or asks to leave; to another board it behaves as today.

A regression failure that also fails on 7de5c14 is a baseline finding to report, never fixed here.

## Review focus and public references

Review that:
- the page value is read only when the tab first shows the board the address names, and in the same-board
  `hashchange` path; a board chosen later from the board list never reads a stale value;
- the address is written only with `replaceState`, so no `hashchange` reaches the team route from the app's
  own writes, and Back and Forward history is unchanged;
- the same-board `hashchange` path runs before the leave question and never stops the hosted board;
- `parseLink` keeps its exact old results for every fragment without `?page=`;
- Copy link to page is never disabled and is the only item a viewer can reach; viewers still make no page
  step through any control or key;
- choosing it writes the clipboard inside the user's event and shows the refused notice when the write fails;
- opening a page by link is not an edit (no Undo step, save state unchanged, nothing sent beyond presence);
- the missing-page notice also corrects the address;
- App.tsx, the packages, the room and the server are unchanged.

Unresolved after read 2 (the read cap), for the check run and review to confirm:
- the local startup page value's hand-off (set at start, taken at the initial adoption, discarded on a failed
  initial load) against Retry editing, Reopen and the board list;
- the hosted pending page value from construction to the first real document, including a link that arrives
  while joining and a remote update arriving before the page owner's first delivery;
- route identity for a session started from an invitation, and the restart after signing in again;
- the notice placement under the team notice column (only the notice moves; panels and selection controls do
  not);
- the held-socket technique of N4-S6 for a waiting edit.

The public source basis is main 7de5c14 and the linked versioned contracts, read 2026-11-20. No outside
product is needed to implement this contract, and no unresolved product decision is delegated to
implementation.

## Exclusions and reasons

- Links inside stickies, shapes and text, links to one object, and the selection in the address: a later
  milestone.
- A preview card for a pasted board link; a page value in the Share dialog's and home lists' Copy link.
- Repairs to separately tracked baseline failures.

## Implementation record

### Source validation on 2026-11-20

- Branch `codex/0010-W4-link-to-a-page`.
- Prerequisite commit `b5a5c28b4c99d586511d8a0764dd3491fa768d7b`.
- Behaviour baseline `7de5c1413bbcf0ed8b48834e768aa74075510a1c`.
- Validated source and tests `6e689c9153ed40541a35f9223af702b243d49276`.
- Toolchain Node 26.13.0 and npm 11.20.0. Dependencies added: zero.

| Check | Result | Command and evidence |
| --- | --- | --- |
| V1 | Pass | Byte-compared the two Git revisions. All 20 inputs match, including six manifests, the package lock, five contract locks, five inventories and three runtime notice files. |
| V2 | Pass | `npm ci --ignore-scripts --no-audit --no-fund` installed 118 packages on the clean candidate and 118 in a separate archive of the behaviour baseline. Both exited 0. |
| V3 | Pass | `npm run typecheck` exited 0 for all five workspace members. |
| V4 | Pass | `npm test` passed 1,311 of 1,311 checks, including all 14 new `P4-U01`–`P4-U14` checks and the existing module, import, effects and App composition guards. Zero failures or skips. The existing page and route tests passed with their assertions unchanged. |
| V5 | Pass | `BOARD_TEAM_FEATURES=off npm run build` with the validation settings above built one web app. `npm run audit:licenses` exited 0 and `cmp apps/web/dist/THIRD_PARTY_NOTICES.txt docs/architecture/0001-runtime-notices-v1.txt` matched. |
| V6 | Pass | `npm run build:fixtures` and `BOARD_TEAM_FEATURES=on npm run build` with the validation settings above built the disposable fixtures and team web app. `npm run audit:licenses` exited 0 and `cmp apps/web/dist/THIRD_PARTY_NOTICES.txt docs/architecture/0001-runtime-notices-v3.txt` matched. |
| V7 | Pass | `npm run build:server` built the Node and Worker servers. `npm run audit:licenses` passed. `WRANGLER_SEND_METRICS=false npx wrangler deploy --dry-run --outdir <scratch> -c apps/server/wrangler.json` exited 0, producing three scratch files with two Durable Object bindings. |
| V8 | Pass | Reviewed the hunks and ran `git diff --name-status b5a5c28..6e689c9` and `git diff --check b5a5c28..6e689c9`. The source commit has two added and twelve modified files within the brief. A path-scoped `git diff --exit-code` confirmed the App, packages, server and Supabase files match the prerequisite. `use-pages.ts` has two passive effects and `use-panel-layout.ts` has one. No type-only or CSS changes were needed. |

Run windows (UTC−05:00) were 13:31:58–13:32:00 for the baseline install and
13:39:34–13:39:36 for the candidate install. Typecheck ran 13:39:50–13:39:53,
the full unit suite 13:39:50–13:39:58, and the builds, audits and dry run
13:39:50–13:39:55. The host log reports zero sleep or wake events in those windows.

Changed test paths and candidate line ranges:

| File | Lines | Change |
| --- | --- | --- |
| [`tests/page-links.test.mjs`](../../tests/page-links.test.mjs) | 1–505 | New page-link checks with isolated hook, route and render harnesses. |
| [`tests/pages.test.mjs`](../../tests/pages.test.mjs) | 227, 233–235 | Isolated address and recording `replaceState` fake. |
| [`tests/team-pages.test.mjs`](../../tests/team-pages.test.mjs) | 150, 153–155, 407, 412–414 | Isolated address and recording `replaceState` fakes, including the hosted layout harness. |
| [`tests/README.md`](../../tests/README.md) | 685–688 | Coverage and command for the new test file. |

The public-boundary hooks passed on the source commit. Git reported that it
could not lock the shared packed refs after committing. The source commit
and branch ref were present and verified. No milestone escalation was needed.

V9 is reserved for the cloud Checks workflow. Browsers and the Supabase CLI
were unrun in the implementation sandbox. V10–V13 and the browser regressions
of V14 are reserved for an independent check run. No separate server test
runner, push or deployment was performed.

### Review fix round 1 — 0010-W4 v1

Branch `codex/0010-W4-link-to-a-page`. Review base
`76d40d71060feb5a4d276b14757317498c525e53`. Validated fix source and tests
`ca654bd63cfad07c6466e469ed0dfbc41a29906b`. Node 26.13.0 and npm 11.20.0.
Zero dependencies added.

| Finding | Fix | Regression checks |
| --- | --- | --- |
| F1 | The initial storage adoption hands off the adopted board and its notice eligibility to the page owner. The startup page value survives placeholder repaints and is consumed once. Failed initial loads discard it before Retry. | P4-U06, P4-U07. P4-U15 covers later board-list choices and Retry. |
| F2 | The panel uses the baseline measurement and resize signals. Team notice column changes update only the notice offset. | P4-U13 checks 68 px with the notice hidden, 113 px at the same geometry with it shown, and the team column appearing, resizing and disappearing. |
| F3 | The blocked hosted leave path restores the open page's address with `history.pushState`. Same-board links still use the page owner's `replaceState`. | P4-U14 checks the pushed URL, Stay and the unchanged same-board route. |

| Check | Result | Command and evidence |
| --- | --- | --- |
| Focused | Pass | `node --test --test-reporter=tap tests/page-links.test.mjs`. With only the regression tests changed on `76d40d7`, P4-U06, P4-U07, P4-U13 and P4-U14 failed at their behavior assertions. The other 11 checks passed. With the fix, all 15 passed. |
| V3 | Pass | `npm run typecheck` exited 0 for all five workspace members. |
| V4 | Pass | `npm test` passed 1,312 of 1,312 checks, including all 15 page-link checks. Zero failures or skips. |
| V8 | Pass | Inspected all six fix hunks by file. `git diff --name-status` and `git diff --check` passed for `76d40d7..ca654bd` and `b5a5c28..ca654bd`. The cumulative diff has 15 authorized files, including the original record. The path-scoped diff for the App, manifests, lock, server, packages and Supabase was empty. Effect and state hook counts were unchanged. |

The only test file changed was [`tests/page-links.test.mjs`](../../tests/page-links.test.mjs).
Candidate hunk ranges are 90, 158–159, 164, 167–171, 174, 176, 180, 196,
199–201, 209, 215–234, 236, 239, 241–258, 269–278, 286–312, 315–326, 329–335,
338–344, 486, 488–489, 491, 494–495, 502–510, 513, 515–518, 526, 570–571,
575–576 and 591–615.

On 2026-11-20 (UTC−05:00), typecheck ran 14:09:24–14:09:26 and the
full unit suite ran 14:09:24–14:09:31. The host log shows zero sleep or
wake events in those windows. Public-boundary hooks passed. Git reported a
shared packed-refs lock permission error after committing. The fix commit
and branch ref were verified.

Browser rechecks and the Supabase CLI were unrun in the implementation
sandbox. Validation in this round was limited to the named unit checks and
V3, V4 and V8. The branch remains local.
