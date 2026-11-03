BRIEF VERSION: 0003-W5 v1 (2026-11-02)
# 0003-W5 — Find, create and reopen boards in the web app

Status: Draft. Contracts: [0001 interaction v28](../architecture/0001-interaction-v28.md),
[0001 web modules v27](../architecture/0001-web-modules-v27.md) and
[0003 hosted storage v3](../architecture/0003-hosted-storage-v3.md) (new versions). Unchanged and
still in force: [0001 interaction v27](../architecture/0001-interaction-v27.md) (through v28),
[0004 presence v1](../architecture/0004-presence-v1.md),
[0003 sync v4](../architecture/0003-sync-v4.md),
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

The server can already list a person's workspaces, each workspace's boards and their recent
boards, create a board and rename one. Today a signed-in person reaches a hosted board only by
already holding its link, and closing one drops them on the local board. This milestone adds
**Home**, with team features on:

- **Find.** `#/files` shows **Recents** (the boards you opened most recently) and a page per
  workspace, as a grid of cards with each board's name, when it was last edited and your role on
  it. A workspace page sorts by name, date created or last modified, in either order, and loads
  more boards as you scroll.
- **Create.** **New board** creates an "Untitled" board in a workspace you can edit and opens it
  in the same tab.
- **Rename.** Owners and editors rename a board from its card's menu on Home and from the open
  board's name field, which is no longer read-only for them. Typing a name is one undo step.
- **Reopen.** A card opens its board; its menu also opens it in a new tab, copies its link, and
  (on Recents) shows its workspace. **Back to files**, first in the Board panel, returns to Home
  from any board, and closing a hosted board lands on Home.

With team features off the app looks and works exactly as before and makes no request beyond its
own files. The server, the room, the shared client, every saved format and every dependency are
unchanged.

## Read first and prerequisite contracts

- [Contributor guidance](../../CONTRIBUTING.md), [agent instructions](../../AGENTS.md) and
  [engineering standards](../../DESIGN.md).
- The new contract versions above: they define every behaviour this brief asks for. Hosted
  storage v3 is the behaviour (links, the reads and their failures, paging, creation, the two
  rename paths, held names, leaving a board for Home); interaction v28 the screens, words, keys
  and their look (colours, sizes, shapes, spacing, positions); web modules v27 the module layout
  and guards. Where this brief and a contract seem to differ, the contract wins; report the
  difference.
- [API v4](../architecture/0003-api-v4.md) "Routes", "Boards", "Renaming" and "Lists": every
  server call Home makes.
- [The 0003-W4 v1 brief](0003-W4-sign-in-share-and-see-access.md): the team modules, the hosted
  board (`apps/web/src/team/hosted-board.ts`), the gate and the local stack this milestone builds
  on; [the 0004-W3 v2 brief](0004-W3-see-who-is-on-a-board-and-where-they-are.md) for the latest
  team modules and their guards.
- Interaction v20, "The unsaved-edits question": the dialog Back to files reuses on a local board
  (`apps/web/src/state/use-storage-session.ts`, `apps/web/src/ui/board-question.tsx`).

## Deliverables and boundaries

The base is the main revision that holds this brief, recorded in the implementation record.
Every new source file starts with `// SPDX-License-Identifier: Apache-2.0`. Code follows the
repository's style ([engineering standards](../../DESIGN.md)): readable lines, small modules with
one job each, and comments where a reader needs the reason.

1. **Links and the team app** (hosted storage v3 "Links", "Leaving a hosted board", "Home" and
   "Held names"): `apps/web/src/team/links.ts` reads `#/files` and `#/files/<workspace>`;
   `apps/web/src/team/team-app.tsx` shows Home or its gate, keeps the held names, gives
   `backToFiles` to the team parts, and sends Close this board to Home;
   `apps/web/src/team/sign-in.tsx` gives the gate Home's title without the helper line.
2. **Home** (web modules v27, interaction v28): `apps/web/src/team/home-rules.ts`,
   `home-lists.ts`, `home-menu.tsx`, `home-card.tsx` and `home.tsx` (new).
3. **The board screen**: `apps/web/src/ui/board-panel.tsx` (Back to files first; the hosted name
   field editable for owners and editors); `apps/web/src/state/use-board-document.ts` (the name
   entry's group); `apps/web/src/state/use-hosted-board.ts` (the field follows the board's title);
   `apps/web/src/state/use-storage-session.ts` (the unsaved-edits question's new kind of target);
   `apps/web/src/App.tsx` (wiring only, within 264 lines); `apps/web/style.css` (the Home and
   Back to files rules added at the end; no existing rule changes). Every new element has
   interaction v28's look, including its hover and focus.
4. **Tests**:
   - `tests/home.test.mjs` (new), run by `npm test` without Supabase or a browser. Each test
     imports `apps/web/src/team/links.ts` or `home-rules.ts` inside the test with a dynamic
     `import()`, not at the top of the file, so a run against the base fails each test by name.
     It covers:
     - links: `#/files` is Recents and `#/files/<uuid>` a workspace page; `#/files/`,
       `#/files/no`, an upper-case UUID, `#/files/<uuid>/`, `#/files/<uuid>?sort=title` and
       `#/files?x` are bad links; no fragment and `#notes` are local; `#/b/<uuid>` and both
       invitation forms parse as before;
     - joining pages: first-seen order kept, a repeated ID's card takes the later row's data in
       its first position, new IDs added at the end, two empty pages give none;
     - "Edited …": each row of interaction v28's table at its edges, for a fixed now: −1 and 0
       minutes (just now), 1, 59, 60, 119, 120 and 1,439 minutes, 1,440 (yesterday), 2,879,
       2,880, 10,079 (6 days), 10,080 (1 week), 20,159, 20,160 (2 weeks), 43,199, 43,200 (last
       month), 86,399, 86,400 (2 months), 525,599 (12 months), 525,600 (1 year), 1,051,200
       (2 years), and an unreadable time;
     - words: role words (Owner, Can edit, Can view, Guest), the sort words (Alphabetical, Date
       created, Last modified), who can create (workspace `owner` and `editor`, not `viewer` or
       `guest`) and who can rename (board `owner` and `editor`, not `viewer`);
     - held names, with a fixed clock: a held name replaces the row's title; a list showing the
       held name releases it; a list showing a name it replaced keeps it; a list showing a third
       name releases it and shows the third; after names A, B and C saved in turn, a list showing
       A or B keeps C; a name ABC held as replacing A and AB (sent before ABC was saved) is kept by
       a list showing AB; at 119,999 ms it still applies and at 120,000 ms it
       is released; a held name for a board not in the rows adds nothing; the rows' order, edited
       times and other fields are unchanged; the input rows and map entries for other boards are
       not changed;
     - menu placement: a menu that fits stays at its point; one that would cross the right or
       bottom edge is moved to the window's width or height minus its size minus 8; never left
       of or above 4;
   - `tests/modules.test.mjs`: the guards of web modules v27 (twenty team modules, `home-rules.ts`
     free of React and `auth.ts`); each other guard unchanged;
   - `tests/README.md` lists the new file.
5. **Documentation**: `docs/architecture/README.md` lists, for 0003-W5 v1, interaction v28,
   web modules v27 and hosted storage v3, and that interaction v27, presence v1, sync v4,
   toolchain v5, identity v3, access v4, API v4, hosted persistence v3, self-host runner v1,
   document v11 and storage v3 stay in force.

Outside the named new controls, the existing screens' markup stays exactly as at the base. With
team features off there are no new controls, so the A–J comparison (V12) adds no mask. Besides
items 1 to 5, only this brief's implementation record changes. If the work seems to need
anything outside them, stop and report it. Nothing in `apps/server/`,
`packages/`, `supabase/`, any `package.json`, `package-lock.json`, any saved format or any
existing test file other than `tests/modules.test.mjs` and `tests/README.md` changes. No hosted
Supabase project, deployment or real person is used.

## Browser checks

The scenario runs in Chrome against the local stack as the 0003-W4 brief sets it up (Supabase
from this repository's `supabase/config.toml`, the Node runner from `npm run build:server` with
`allowedOrigin` set to the page's origin, a team-on build served on that origin), at 1280 × 800
unless a check names another size, with page key events. Synthetic people, each in their own
browser context, with roles a real person can hold (access v4, "The highest role wins"):

- **Ana**, owner of three workspaces, Acme, Lab and Studio (so her role on every board in them is
  Owner); Lab never has a board;
- **Ben**, editor of Studio and a guest in Acme with a viewer grant on one Acme board (his cards
  show Can edit for Studio's boards and Can view for that Acme board);
- **Chen**, viewer of Acme and of Lab;
- **Dee**, a guest in Acme with an editor grant on one Acme board;
- **Eli**, signed in with no role anywhere.

Each check prints `PASS: W5-S<n> <name>` or `FAIL: W5-S<n> <name>`. The tool is
`tools/browser-compare/0003-w5-check.mjs` in the private repository; the check run keeps its order,
adds W5-S43 to W5-S45 as written here, and may adjust steps, keeping each check's meaning.

| ID | Check |
| --- | --- |
| W5-S1 | `#/files` opened signed out shows the gate titled "Sign in to see your boards" and no Home; after the code, Recents shows |
| W5-S2 | Ana's Recents lists the boards she opened, newest first, and none she has not opened |
| W5-S3 | Ben's Recents cards show each board's name, "<workspace> · Edited …" and his role: Can edit on Studio's boards, Can view on the granted Acme board; no other Acme board appears; the sidebar lists Acme with Guest and Studio with Can edit |
| W5-S4 | Ana's Acme page with Alphabetical, Oldest first requests `sort=title&order=asc` and shows the server's order |
| W5-S5 | The same with Alphabetical, Newest first (`sort=title&order=desc`) |
| W5-S6 | The same with Date created, Oldest first (`sort=created&order=asc`) |
| W5-S7 | The same with Date created, Newest first (`sort=created&order=desc`) |
| W5-S8 | The same with Last modified, Oldest first (`sort=edited&order=asc`) |
| W5-S9 | The workspace page opens with Last modified, Newest first ticked and requests `sort=edited&order=desc` |
| W5-S10 | Dee sees only Acme in the sidebar (Guest), only the granted board on Acme's page and in Recents (Can edit), and no New board |
| W5-S11 | Eli's sidebar lists no workspace; `#/files/<Acme>` says "This workspace doesn't exist, or you don't have access to it." with no card; no Acme board appears anywhere for Eli |
| W5-S12 | Chen sees no New board on Acme's page or on Recents and no Rename in a card menu; on an Acme board Chen's Board name field is read-only |
| W5-S13 | Ana's New board on Acme's page sends one `POST /workspaces/<Acme>/boards` with `{}`, opens `#/b/<id>` in the same tab with the name "Untitled" and Saved; after Back to files, Recents lists it |
| W5-S14 | Ben's New board on Recents creates in Studio, his only workspace he can create in, without a menu |
| W5-S15 | Ana's New board on Recents opens "New board in" with Acme, Lab and Studio in that order; choosing Studio creates the board in Studio |
| W5-S16 | Rename from a card menu shows the field with the whole name selected; typing a name and Enter sends one `PATCH /boards/<board>` with it, the card shows it at once, and focus returns to the card |
| W5-S17 | Leaving the rename field saves (one PATCH); Escape puts the name back and sends nothing |
| W5-S18 | A rename the server refuses (the test answers the PATCH with 409 and a reason) puts the old name back and shows "That name wasn't saved: <reason>." |
| W5-S19 | After a saved Home rename, a list answer still holding the old name (served by the test) shows the new name; the real lists then show it too |
| W5-S20 | Ana's Board name field on a hosted board is editable; typing a name sends document edits and no PATCH, shows Saving… then Saved; after Back to files, both lists show the new name |
| W5-S21 | Ben's name change on a Studio board saves the same way; an edit changing the title sent on Chen's open connection to an Acme board is refused by the room with `role_too_low` |
| W5-S22 | Back to files from a local board with no unsaved edits, and from a hosted board, shows Recents; afterwards no WebSocket is open or connecting |
| W5-S23 | Close this board on the not-found page shows Recents |
| W5-S24 | Close this board in the Access removed dialog shows Recents, with no open WebSocket |
| W5-S25 | Browser Back and Forward move between Home, a workspace page and a hosted board; each board's connection is closed when it is left |
| W5-S26 | With the Node runner stopped, Home shows "Couldn't load your boards", its hint and Try again, and no card; after the runner restarts, Try again shows the cards |
| W5-S27 | A workspace UUID nobody has shows the not-found words and no card |
| W5-S28 | A workspace with 250 boards loads 100, 100 and 50 as the last card comes into view, and shows each of the 250 IDs exactly once |
| W5-S29 | A right-click on a card selects it and opens the card menu at the pointer; Open opens the board; on Recents, Show in workspace opens its workspace page |
| W5-S30 | Shift+F10 and the context-menu key on a focused card open its menu with Open focused; Escape closes it and focus returns to the card |
| W5-S31 | In a menu, Down and Up wrap, Home and End go to the ends and Enter activates; Tab closes the menu and moves to the control after the card |
| W5-S32 | Copy link writes exactly `<origin><path>#/b/<board>` and shows "Link copied"; Open in new tab opens that link in a new page while the first stays on Home |
| W5-S33 | Recents with nothing opened shows "No recent boards" and "Boards you open appear here."; Lab's page shows Ana "No boards yet", "Everyone in Lab can open the boards made here." and New board; Lab's page shows Chen "No boards yet" only |
| W5-S34 | With the list answers held back, the body shows "Loading boards…" and no card until both answer |
| W5-S35 | Room title edits by an owner and an editor, and a PATCH rename, reach both lists (a server-side control, timings recorded) |
| W5-S36 | A board created on Home is not in Recents before it is opened, and is after it is opened and Back to files |
| W5-S37 | On Ana's Acme page, Tab from the account goes through Recents, each workspace, Boards in this browser, New board, the sort button, then the cards in reading order |
| W5-S38 | Home has three columns at 1280, two at 1000 and one at 700 window width; at 560 the sidebar is 160 wide |
| W5-S39 | When the second page of a workspace fails (the test refuses it), every card goes and the failure state shows; Try again starts again from the first page |
| W5-S40 | With team features off, `#/files` shows the local board, no Home, and no request beyond the page's own files |
| W5-S41 | Tab and Shift+Tab after closing a card menu, and after a rename, continue from that card to the next and previous card |
| W5-S42 | A name saved inside a hosted board shows on Home through a stale Recents answer (served by the test), then in the real workspace and recent lists |
| W5-S43 | On a hosted board, Ana types a new name into the Board name field one key at a time and leaves it: one Undo puts the whole old name back and the board's export, once saved, holds it; Redo brings the new name back |
| W5-S44 | On a local board with an unsaved edit, Back to files asks "Save your changes first?" naming “Recents”: Cancel stays on the board with the edit; Discard changes shows Recents; on a fresh edit, Save and open saves (the Save status acknowledges it) and shows Recents, and Boards in this browser then shows the edit |
| W5-S45 | The look matches every value in interaction v28, sections "Layout" (with "The sidebar", "Icons", "The main area", "Cards", "Menus", "The rename field", "New board", "States in the body", "The toast" and "Narrow windows") and "The Board panel". At 1280 × 800, in nine set-ups (Ana's Recents; Ana's Acme page with the sort menu open; a card menu open on a selected card; a rename field open; the New board in menu open; Lab's empty page for Ana; the failure state; the toast after Copy link; a local board's Board panel with Back to files), at 1000, 700 and 560 widths on Recents, and with New board, a menu item and the current sidebar item hovered, the check reads each element's computed style, SVG attributes and bounding rectangle and asserts each stated value: lengths, offsets and positions to within 0.5 pixel; colours, shadows, font weights and sizes, `z-index`, `display` and alignment exactly as computed; text exactly; SVG `width`, `height`, `viewBox`, path `d` and stroke width exactly. It prints each asserted value with its result |

**The 0003-W4 checks, amended.** For V13, three of the 0003-W4 brief's checks change, because
closing a hosted board now lands on Home: **W4-S10** ends with Close this board showing Recents
(`#/files`) instead of the local board; **W4-S11** signs the viewer out from Home's account menu
instead of the local board's Board panel; **W4-S12** is unchanged in meaning and runs after them.
Every other W4 check is as that brief states.

## Numbered acceptance criteria

- 0003-W5-AC01: With team features on, a signed-in person's Home lists their recent boards and, for each workspace they belong to, that workspace's boards they have a role on, each with its name, last edited time and their role; a workspace's boards sort by name, date created or last edited, in either order; with team features off nothing changes on screen or on the network.
- 0003-W5-AC02: From Home a workspace owner or editor creates a board, named "Untitled", which opens at once, and renames boards they can edit, from Home and from the open board's name; Back to files on any board returns to Home, and closing a hosted board lands there.
- 0003-W5-AC03: A board the person has no role on never appears; a list that cannot load says so, with Try again, instead of showing an empty or stale list.

| Criterion | Evidence that shows it |
| --- | --- |
| 0003-W5-AC01 | W5-S2–S9, S28, S33, S34, S37, S38, S40, S45; V5, V11, V12; the link, joining, "Edited …" and words tests in `tests/home.test.mjs`; `tests/modules.test.mjs` |
| 0003-W5-AC02 | W5-S1, S12–S25, S29–S32, S35, S36, S41–S44; V13, V14; the held-name and menu-placement tests in `tests/home.test.mjs` |
| 0003-W5-AC03 | W5-S3, S10, S11, S26, S27, S39 |

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
git diff --name-status <base>..<validated>
```

Copy `apps/web/dist` aside after each web build, since the next one replaces it. Files git
ignores in a build's output (for example esbuild's `meta.json`) never count as a change.

| Check | Pass condition |
| --- | --- |
| V1 | `package-lock.json` and every `package.json` are byte-identical to the base's |
| V2 | `npm ci` exits 0 |
| V3 | `npm run typecheck` exits 0 for all five members |
| V4 | `npm test` passes with 0 failed; every base test file passes unchanged except the guards item 4 names in `tests/modules.test.mjs`; `tests/home.test.mjs` is the only new test file |
| V5 | The off build (with the three settings set) exits 0; its `index.html` and `THIRD_PARTY_NOTICES.txt` are byte-identical to the base build's; its `meta.json` has no input under `node_modules/@supabase/` or `apps/web/src/team/`; `audit:licenses` exits 0 |
| V6 | `build:fixtures` exits 0; the on build exits 0, its `index.html` is byte-identical to the base's on build, and its notices are runtime notices v3 byte for byte; `audit:licenses` exits 0 |
| V7 | `build:server` exits 0 and `audit:licenses` exits 0 |
| V8 | `git diff --name-status <base>..<validated>` shows only files of items 1 to 5 (this brief changes only by its implementation record, in a later commit) |
| V9 | W5-S1–S39 and W5-S41–S45 pass on the candidate's team-on build; W5-S40 passes on its team-off build |
| V10 | The new checks fail on the base (REC-019): on a fresh local stack started from a checkout of the base (never a stack the candidate used), with the base's team-on build served the same way, every one of W5-S1–S34, S36–S39 and S41–S45 fails, and `tests/home.test.mjs` run against the base fails each of its tests by name. W5-S35 checks the server's lists, and W5-S40 a team-off build, which the base already meets, so they pass on both. A check that fails because a control, module or message it asserts is missing counts as failing |
| V11 | With team features off, opening the page, `#/files` and a board link requests only the page's own files, opens no WebSocket and shows no Home (W5-S40) |
| V12 | The A–J comparison of the off build against the base's build shows no difference at any checkpoint (markup, focus, canvas drawing and saved records), where the only normalization is the one the comparison already makes for every run: a local board's "saved today 14:05"-style time text is compared as one placeholder, since two runs minutes apart differ by the clock alone. No other mask |
| V13 | The 0003-W4 brief's checks W4-S1–S29, with W4-S10 to W4-S12 amended as above, pass on the candidate's team-on build, set up as that brief says. A check that fails is run once more on its own on a fresh stack; both results are reported |
| V14 | The 0004-W3 v2 brief's checks W3-S1–S29 and W3-S31–S36 pass on the candidate's team-on build and W3-S30 on its team-off build, set up as that brief says. A check that fails is run once more on its own on a fresh stack; both results are reported |

**Who runs what.** The implementer runs V1–V8 and records them (browsers cannot start there;
the Supabase stack is not needed for them). The reviewer's check run repeats V1–V8 on a clean
clone and runs V9–V14. Each is reported as one `PASS: V<n>` or `FAIL: V<n>` line, with the
scenario's W5, W4 and W3 lines kept as evidence. Regression runs accepted by the maintainer: the
full unit suite (V4), the A–J comparison with team features off (V12), the 0003-W4 checks (V13)
and the 0004-W3 checks (V14). No server suite runs: the server, the room and the shared client
do not change.

No hosted project, deployment, browser matrix, accessibility audit, load test, physical keyboard,
input method or screen-reader session unless the maintainer asks.

## Exclusions and reasons

- Thumbnails and a list view: Board draws no board previews yet; a plain tile stands in.
- Search, starring, drafts, folders, trash and deleting boards, duplicating and moving boards,
  Share from Home and Remove from recent: each needs a server change or a later milestone.
- Creating, renaming or setting up workspaces, and moving a local board into a workspace.
- Paging Recents: API v4 returns the newest 50 with no cursor.
- Reconciling a held name with list revisions: list rows carry no document revision; a held name
  is released by the rules of hosted storage v3 instead.
- Keeping the sort between visits, and a clock that redraws "Edited …".
- Leaving a local board with unsaved edits by the browser's Back button or by typing an address:
  unchanged from the base, which also does not ask.
- Dark mode (the app has none) and any server, schema or access change.

## Public references with retrieval dates

Retrieved 2026-11-02: [MDN: Intersection Observer API](https://developer.mozilla.org/en-US/docs/Web/API/Intersection_Observer_API),
[MDN: `Clipboard.writeText()`](https://developer.mozilla.org/en-US/docs/Web/API/Clipboard/writeText),
[MDN: `Window.open()`](https://developer.mozilla.org/en-US/docs/Web/API/Window/open),
[MDN: `KeyboardEvent.isComposing`](https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/isComposing),
[WAI-ARIA Authoring Practices: Menu Button pattern](https://www.w3.org/WAI/ARIA/apg/patterns/menu-button/)
and [WAI-ARIA Authoring Practices: Listbox pattern](https://www.w3.org/WAI/ARIA/apg/patterns/listbox/).

## Implementation record

(Filled in by the implementer.)
