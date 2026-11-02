BRIEF VERSION: 0004-W3 v2 (2026-11-02)
# 0004-W3 — See who is on a board and where they are

Status: Draft. Version 2 adds the approved look (interaction v27) and check W3-S36; see "Changes in
v2". Contracts: [0001 interaction v27](../architecture/0001-interaction-v27.md) (v26's rules plus the
look), [0001 interaction v26](../architecture/0001-interaction-v26.md),
[0001 web modules v26](../architecture/0001-web-modules-v26.md) and
[0003 hosted storage v2](../architecture/0003-hosted-storage-v2.md) (new versions). Unchanged and
still in force: [0004 presence v1](../architecture/0004-presence-v1.md),
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

The room already knows who is on a hosted board, where each pointer is, what each connection has
selected and what part of the board each one is looking at, and the web app's shared client
already receives all of it. Nothing draws it yet. This milestone draws it, on hosted boards only:

- **People.** Avatars in the top-right panel before the save status: you first, at most three,
  then "+N", and a people menu listing everyone with their role.
- **Cursors and selections.** For each other connection, an arrow with a name pill and an outline
  around what it has selected, in that connection's colour. A viewer's pill says so.
- **Following.** Clicking someone's avatar, or Follow in the people menu, fits your view to
  theirs until you stop, move the view yourself, or they leave.
- **Hiding cursors.** **Show other people's cursors** in the people menu, with ⌥⌘\ on macOS and
  Ctrl+Alt+\ elsewhere, hides other people's cursors for you only, and is remembered on this
  device.

Presence never changes the board or the save state, including when a presence message is refused.
Local boards, and every board with team features off, look and work exactly as before. The
server, the room, the shared client and every saved format are unchanged, and no dependency is
added.

## Read first and prerequisite contracts

- [Contributor guidance](../../CONTRIBUTING.md), [agent instructions](../../AGENTS.md) and
  [engineering standards](../../DESIGN.md).
- The new contract versions above: they define every behaviour this brief asks for.
  Interaction v26 is the screens, words, keys and following, and interaction v27 their look
  (colours, sizes, shapes, spacing, positions); hosted storage v2 the stored switch
  and the presence refusals; web modules v26 the module layout and guards. Where this brief and a
  contract seem to differ, the contract wins; report the difference.
- [Presence v1](../architecture/0004-presence-v1.md): what the room stamps, what a connection
  sends, the limits and refusals, and expiry.
- [The 0003-W4 v1 brief](0003-W4-sign-in-share-and-see-access.md): the team modules, the hosted
  board (`apps/web/src/team/hosted-board.ts`) and the local stack this milestone builds on;
  [the 0004-W1 v1 brief](0004-W1-edit-together-with-participant-presence.md) for the shared
  client's presence (`packages/board-sync/src/session.ts`: `self`, `present`, `setPresence`).

## Deliverables and boundaries

The base is the main revision that holds this brief, recorded in the implementation record.
Every new source file starts with `// SPDX-License-Identifier: Apache-2.0`. Code follows the
repository's style ([engineering standards](../../DESIGN.md)): readable lines, small modules with
one job each, and comments where a reader needs the reason.

1. **Pure presence rules**: `apps/web/src/team/presence.ts` (new), as web modules v26 lists.
2. **The presence channel** in `apps/web/src/team/hosted-board.ts`: a presence snapshot with its
   own subscription; `present` and `left` notify only it and never the board's listeners; the
   four presence refusals are silent (hosted storage v2); the order presence was received in, for
   following; sending through `BoardSession.setPresence`; follow, stop following and the switch,
   read from and written to the one `localStorage` key of hosted storage v2.
3. **The screen**: `apps/web/src/team/people.tsx` and `presence-layer.tsx` (new);
   `apps/web/src/state/use-presence.ts` (new); `apps/web/src/state/use-viewport.ts` (the two
   setters of web modules v26); `apps/web/src/team/team-app.tsx` (the two new team parts);
   `apps/web/src/ui/save-area.tsx` (the people group and its divider before the status);
   `apps/web/src/App.tsx` (wiring only, within 264 lines); `apps/web/style.css` (the presence rules
   added at the end; no existing rule changes). Every presence element has interaction v27's look.
4. **Tests**:
   - `tests/web-presence.test.mjs` (new), run by `npm test` without Supabase or a browser. Each
     test imports `apps/web/src/team/presence.ts` inside the test with a dynamic `import()`, not
     at the top of the file, so a run against the base fails each test by name. It covers:
     - grouping: your own person first; two connections with one `person` key make one person
       with both connections; people in the order their first connections were learnt of; when a
       person's first connection leaves, the next one supplies the label, role and colour;
     - avatars: one to five people at 1280 CSS pixels (all shown up to three, then three and
       "+N"); at 767 CSS pixels one, then "+N"; at 768 the wide rule;
     - pill words: "ben.okafor" for an editor or owner, "chen · viewer" for a viewer;
     - the cut: 251 selected IDs send the first 250 in their order; 250 or fewer are sent as they
       are;
     - what is sent: a view centred on (100, −50) at zoom 2 in a 1280 × 800 scene is sent as
       `{ x: -220, y: -250, width: 640, height: 400 }`; one centred on (−999,900, 0) at zoom 0.5
       as `{ x: -1000000, y: -800, width: 2560, height: 1600 }`; a cursor at (1,000,500, 0) as
       (1,000,000, 0);
     - which connection a follow chooses: an active one over inactive ones, even one received
       from more recently; among active ones
       the most recently received; none active, the most recently received; one connection, that
       one;
     - the fit: a 1280 × 800 view in a 1280 × 800 scene gives zoom 1 and its centre; a
       1280 × 800 view in a 900 × 700 scene gives zoom 0.703125; a 2560 × 1600 view in a
       900 × 700 scene gives zoom 0.5 (the floor) centred on the view; a 100 × 100 view in a
       1280 × 800 scene gives zoom 2 (the ceiling);
     - presence refusals: each of the four reasons with no `requestId` is a presence refusal;
       the same reasons with a `requestId`, and `message_too_large` or any other reason with
       none, are not;
     - the stored switch's key is exactly `nextphase-board/presence/show-cursors/v1`;
   - `tests/modules.test.mjs`: the guards of web modules v26 (fifteen team modules, twenty-two
     hooks, the one import of `use-presence.ts`, `presence.ts` free of React and `auth.ts`, the
     264-line `App.tsx` budget); each other guard unchanged;
   - `tests/README.md` lists the new file.
5. **Documentation**: `docs/architecture/README.md` lists, for 0004-W3 v2, interaction v27 and
   v26, web modules v26 and hosted storage v2, and that presence v1, sync v4, toolchain v5,
   identity v3, access v4, API v4, hosted persistence v3, self-host runner v1, document v11 and
   storage v3 stay in force.

Outside the named new controls, the existing screens' markup stays exactly as at the base: the
reviewer's A–J comparison allows only the masks listed under validation. With team features off
there are no new controls, so the A–J comparison (V12) adds no mask. If the work seems to need
anything outside items 1 to 5, stop and report it. Nothing in `apps/server/`,
`packages/board-room/`, `packages/board-rules/`, `packages/board-sync/`, `supabase/`, any
`package.json`, `package-lock.json`, any saved format or any existing test file other than
`tests/modules.test.mjs` and `tests/README.md` changes. No hosted Supabase project, deployment or
real person is used.

## Browser checks

The scenario runs in Chrome against the local stack as the 0003-W4 brief sets it up (Supabase
from this repository's `supabase/config.toml`, the Node runner from `npm run build:server` with
`allowedOrigin` set to the page's origin, a team-on build served on that origin), at 1280 × 800
unless a check names another size. Seven synthetic people on one hosted board, each in its own
browser context: the workspace owner, an editor, a viewer, two more editors and two more
viewers; a second tab of the editor where a check says so. Each check prints
`PASS: W3-S<n> <name>` or `FAIL: W3-S<n> <name>`. The tool is
`tools/browser-compare/0004-w3-check.mjs` in the private repository; the check run keeps its
order and may adjust its steps, keeping each check's meaning.

| ID | Check |
| --- | --- |
| W3-S1 | Owner, editor and viewer on the board: each sees three avatars, their own first, before the status, in a list named "People on this board" |
| W3-S2 | Each sees the other two connections' cursors in their stamped colours with name pills; the viewer's pill reads "<label> · viewer"; no tab draws its own cursor |
| W3-S3 | The editor selects a sticky: the others show a 2-pixel outline in the editor's colour around the same box their own selection box would have, with no handles and no context bar |
| W3-S4 | The people menu: rows with labels and role words (owner, can edit, can view), "(you)" on your own; Down, Up, Home, End and Enter work; Escape closes it and returns focus to the chevron |
| W3-S5 | Tab reaches each avatar, then the chevron; each has interaction v26's accessible name |
| W3-S6 | The owner clicks the editor's avatar: the frame and the banner "Following <label>" with its Stop following button in the editor's colour, the avatar's ring, and the editor's cursor |
| W3-S7 | At 1280 × 800 the owner's view matches the fit rule as the editor's view moves |
| W3-S8 | At 900 × 700, following a 1280 × 800 window, the zoom is 0.703125 and the centres match |
| W3-S9 | Following stops on Escape |
| W3-S10 | Following stops on a wheel pan |
| W3-S11 | Following stops on a zoom button |
| W3-S12 | Following stops on a Navigation panel pan |
| W3-S13 | Following stops on Navigation panel Reset view |
| W3-S14 | Following stops on a Pan tool drag |
| W3-S15 | Following stops on a Space drag |
| W3-S16 | Following stops on a Ctrl+wheel (pinch) zoom |
| W3-S17 | Following stops on the browser's gesture events (`gesturestart`, `gesturechange`) |
| W3-S18 | ⌥⌘\ (macOS) hides other people's cursors and pills in that tab only; outlines stay; the other tabs still show them |
| W3-S19 | With cursors hidden, the followed connection's cursor and pill still show |
| W3-S20 | The menu item toggles the switch; after a reload of the board the switch keeps its state; `localStorage` holds `nextphase-board/presence/show-cursors/v1` and, besides Auth's keys, nothing else |
| W3-S21 | With a non-Mac platform, Ctrl+Alt+\ reaches the page and toggles the switch |
| W3-S22 | The editor in two tabs: one avatar, two cursors. Follow picks the tab interaction v26 names: when one tab's latest presence says inactive (its page hidden) and the other's active, the active one, even if the inactive one's message arrived later; when both are active, the one the follower received a presence from most recently |
| W3-S23 | The editor's first tab closes: the avatar takes the second tab's colour, and a follow of the closed tab stops |
| W3-S24 | Seven people: three avatars and "+4"; the menu lists all seven with their role words |
| W3-S25 | Six tabs move their pointers for at least five seconds: the observer receives presence messages from all six during that time (at least 20 from each), and meanwhile its status stays Saved and the board is not republished, the scene not re-rendered and the canvas not redrawn (counted by the check's own instrumented build) |
| W3-S26 | A selection of 251 IDs sent on the open socket, bypassing the client's check: the room refuses it with `presence_selection_limit` and no `requestId`; the status stays Saved, the tools stay, and no toast appears |
| W3-S27 | The shared client's own check refuses a presence: nothing on screen changes and the board is unchanged |
| W3-S28 | A person with one tab selects a sticky and closes the tab: within 3 seconds their cursor, outline and avatar are gone and the people menu lists one person fewer |
| W3-S29 | A tab whose scripts are paused, its socket left open, disappears from the others 30 seconds after its last presence (not before 29.9 seconds) |
| W3-S30 | With team features off, opening the page and a board link creates no presence element and sends no presence or other request beyond the page's own files |
| W3-S31 | At 600 × 800, following someone: one avatar and "+N"; the save panel lies below the file bar and the following banner below the save panel |
| W3-S32 | At 900 × 700 the viewer follows someone: the following banner sits below both top panels and the View only banner below it, without overlap |
| W3-S33 | Following stops when Zoom out is activated from the keyboard |
| W3-S34 | Following stops when a Navigation panel pan button is activated from the keyboard |
| W3-S35 | The editor zooms out to 50% at 1280 × 800 (a 2560 × 1600 view); the owner follows from 900 × 700: the owner's zoom is 50% and the view the owner sends is smaller than the editor's |
| W3-S36 | The look matches every value in interaction v27, sections "Stacking", "The people group", "The people menu", "Cursors and outlines" and "Following". At 1280 × 800, in four set-ups (owner, editor and viewer present with the editor's sticky selected and pointer over the board; the people menu opened from the chevron with its second row focused; the owner following the editor; seven people present), and at 320 × 800 with the people menu open (its width 296 and its right edge 12 pixels from the window's), the check reads each element's computed style, SVG attributes and bounding rectangle and asserts each stated value: lengths, offsets and positions to within 0.5 pixel; colours, shadows, font weights and sizes, `z-index`, `display` and alignment exactly as computed; text exactly; SVG `width`, `height`, `viewBox`, path `d`, stroke colour and stroke width exactly. It prints each asserted value with its result |

## Numbered acceptance criteria

- 0004-W3-AC01: With team features on, everyone on a hosted board, viewers included, sees one avatar per person in the top-right panel before the save status (you first, at most three, then "+N") and, for each other connection, a cursor with a name pill and an outline around what it has selected, in that connection's colour; a viewer's pill says so; someone who leaves disappears within the presence contract's limits.
- 0004-W3-AC02: Clicking another person's avatar, or Follow in the people menu, follows their view until Stop following, until you move the view yourself, or until they leave; **Show other people's cursors** in the people menu (⌥⌘\ / Ctrl+Alt+\) hides other people's cursors for you only.
- 0004-W3-AC03: Presence never changes the board or the save state, including when a presence message is refused; the avatars and the people menu are reachable by keyboard and named for assistive technology; with team features off nothing appears and nothing is sent.

| Criterion | Evidence that shows it |
| --- | --- |
| 0004-W3-AC01 | W3-S1–S3, S22–S24, S28, S29, S31, S36; the grouping, avatar, pill and cut tests in `tests/web-presence.test.mjs` |
| 0004-W3-AC02 | W3-S6–S23, S32–S36; the follow choice and fit tests in `tests/web-presence.test.mjs` |
| 0004-W3-AC03 | W3-S4, S5, S25–S27, S30; V5, V11, V12, V13; the refusal and key tests in `tests/web-presence.test.mjs`; `tests/modules.test.mjs` |

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
| V4 | `npm test` passes with 0 failed; every base test file passes unchanged except the guards item 4 names in `tests/modules.test.mjs`; `tests/web-presence.test.mjs` is the only new test file |
| V5 | The off build (with the three settings set) exits 0; its `index.html` and `THIRD_PARTY_NOTICES.txt` are byte-identical to the base build's; its `meta.json` has no input under `node_modules/@supabase/` or `apps/web/src/team/` and does not include `apps/web/src/state/use-presence.ts`; `audit:licenses` exits 0 |
| V6 | `build:fixtures` exits 0; the on build exits 0, its `index.html` is byte-identical to the base's on build, and its notices are runtime notices v3 byte for byte; `audit:licenses` exits 0 |
| V7 | `build:server` exits 0 and `audit:licenses` exits 0 |
| V8 | `git diff --name-status <base>..<validated>` shows only files of items 1 to 5 |
| V9 | W3-S1–S29 and W3-S31–S36 pass on the candidate's team-on build; W3-S30 passes on its team-off build |
| V10 | The new checks fail on the base (REC-019): on a fresh local stack started from a checkout of the base (never a stack the candidate used), with the base's team-on build served the same way, every one of W3-S1–S29 and W3-S31–S36 fails, and `tests/web-presence.test.mjs` run against the base fails each of its tests by name. W3-S30 checks that a team-off build sends nothing, which the base already meets, so it passes on both. A check that fails because a control, module or message it asserts is missing counts as failing |
| V11 | With team features off, opening the page and a board link (`#/b/<board>`) requests only the page's own files, opens no WebSocket and shows no presence element (W3-S30) |
| V12 | The A–J comparison of the off build against the base's build shows no difference at any checkpoint (markup, focus, canvas drawing and saved records), where the only normalization is the one the comparison already makes for every run: a local board's "saved today 14:05"-style time text is compared as one placeholder, since two runs minutes apart differ by the clock alone. No other mask |
| V13 | The 0003-W4 brief's checks W4-S1–S29 pass on the candidate's team-on build, set up as that brief says. A check that fails is run once more on its own on a fresh stack; both results are reported |

**Who runs what.** The implementer runs V1–V8 and records them (browsers cannot start there;
the Supabase stack is not needed for them). The reviewer's check run repeats V1–V8 on a clean
clone and runs V9–V13. Each is reported as one `PASS: V<n>` or `FAIL: V<n>` line, with the
scenario's W3 and W4 lines kept as evidence. Regression runs accepted by the maintainer: the full
unit suite (V4), the A–J comparison with team features off (V12) and the 0003-W4 checks (V13).
No server suite runs: the server, the room and the shared client do not change.

No hosted project, deployment, browser matrix, accessibility audit, load test, physical keyboard
or touchpad run, Windows run or screen-reader session unless the maintainer asks.

## Exclusions and reasons

- Spotlight, cursor chat, reactions and audio: later milestones.
- Another person's text caret or live typing: text still arrives as saved edits.
- Idle or away styles beyond `active`, and spoken join or leave announcements: with up to 50
  connections they would talk over the board; they can come later on request.
- A main or View menu: Board has none; the cursor switch lives in the people menu.
- Showing all of a followed view when it needs less than 50% zoom: Board's zoom range is not this
  milestone's; the view is centred and may crop.
- Choosing which of a person's tabs to follow, and a fixed colour per person.
- A refusal the room cannot tie to presence (`message_too_large` over 1 MiB): telling it apart
  would change the shared client and the room's messages; the page never sends one.
- Presence on local boards, dark mode, recovery after a disconnect.

## Changes in v2

Version 1 was implemented as written; its review found that the screens did not match the approved
presence design, because v1 gave the screens' structure and words but not their look. Version 2:

- adds [interaction v27](../architecture/0001-interaction-v27.md), which keeps every v26 rule and
  states the look: the people group's overlapping avatars, +N pill, chevron and divider; the dark
  people menu; the cursor arrow, the rounded name pill and the outline's position; the follow frame
  and banner with its Stop following button;
- drops the "·" after the label in the following banner, as the approved design shows (W3-S6's
  words follow);
- adds check W3-S36 for those values, and the divider to item 3;
- changes nothing else: every other v1 behaviour, check and boundary stands.

An implementation of v1 continues on its branch: it adds the look and the divider, re-runs V1–V8,
and appends a v2 section to the implementation record. Every statement in the record names who
gave an instruction as the record's evidence shows it.

## Public references with retrieval dates

Retrieved 2026-11-02: [MDN: `KeyboardEvent.code`](https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/code),
[MDN: `Document.visibilityState`](https://developer.mozilla.org/en-US/docs/Web/API/Document/visibilityState),
[WAI-ARIA Authoring Practices: Menu Button pattern](https://www.w3.org/WAI/ARIA/apg/patterns/menu-button/)
and [MDN: ARIA `menuitemcheckbox` role](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Roles/menuitemcheckbox_role).

## Implementation record

To be completed by the implementer: branch, base, validated source/test revision, commands and
results (V1–V8), files changed, and what was not run.


### Implementation handoff (2026-11-02)

- Branch: `codex/0004-W3-see-who-is-on-a-board`.
- Base (committed main): `3b00e7378840e6d045998315e11d23fe90217f0f`.
- Validated source/test revision: `7b45a40e330b6978c6eaeb5718afbf04ae2e59d0`.
  Checks ran against the source/test tree committed at this revision;
  `git diff --exit-code 7b45a40e330b6978c6eaeb5718afbf04ae2e59d0`
  subsequently confirmed identical tracked bytes and exited 0. This appended record
  is a separate documentation commit; the final branch tip is reported separately
  in the handoff. No merge, push or publication was performed.
- Toolchain: `node --version` printed `v26.13.0`; `npm --version` printed `11.20.0`.
  Every shell command put the supplied pinned toolchain's bin directory first on
  `PATH`. No dependencies were added or changed. The six manifests and root lock
  are byte-identical to the base; the lock also matches lock v5.
- Discovery: codebase-memory `list_projects` and `index_repository` both returned
  `MCP tool call requires approval, but approval policy is never`. Per the
  planner's explicit continuation instruction, direct reads and searches
  (`cat`, `sed`, `rg`) replaced unavailable graph discovery. No graph result was
  claimed. The public brief and contracts governed the implementation.

The implementation adds the pure rules, people group/menu, cursor/selection layer
and presence hook named in items 1–3. Hosted presence has its own snapshot and
subscription; `present`/`left` never publish the board, and identifiable presence
refusals notify neither subscription. Outgoing numbers are clamped before sending.
Follow uses receipt order among currently active connections, pins the chosen
connection, and fits through the separate follow setter. The cursor preference
uses only the contracted key, with memory fallback on storage errors. The menu
keeps the shortcut available while containing other keys.

`App.tsx` is 263 lines, composition only, with no presence state. Only
`team/presence-layer.tsx` imports the presence hook. Other state hooks still have
only `App.tsx` as an importer; outside team modules all team imports remain type
only. CSS is append-only and its new rules match presence elements only. The
architecture index and test guide list the new contracts and coverage.

#### Commands and final results

Build settings below are synthetic compilation inputs only; no server or stack
was started and no request was sent to those addresses. `$evidence` denotes the
system temporary directory created with `mktemp -d -t board-w3-evidence`; its
concrete machine path is omitted. Both base builds were made at the clean base
before source edits, with the same settings as the candidate, and copied aside:

```sh
node --version
npm --version
npm ci --ignore-scripts --no-audit --no-fund
BOARD_TEAM_FEATURES=off BOARD_SUPABASE_URL=http://127.0.0.1:55321 BOARD_SUPABASE_ANON_KEY=synthetic BOARD_SERVER_URL=http://127.0.0.1:8796 npm run build
cp -R apps/web/dist "$evidence/base-off"
BOARD_TEAM_FEATURES=on BOARD_SUPABASE_URL=http://127.0.0.1:55321 BOARD_SUPABASE_ANON_KEY=synthetic BOARD_SERVER_URL=http://127.0.0.1:8796 npm run build
cp -R apps/web/dist "$evidence/base-on"
```

Candidate commands (each successful command exited 0):

```sh
node --test --test-reporter=tap tests/web-presence.test.mjs
npm run typecheck
npm test
BOARD_TEAM_FEATURES=off BOARD_SUPABASE_URL=http://127.0.0.1:55321 BOARD_SUPABASE_ANON_KEY=synthetic BOARD_SERVER_URL=http://127.0.0.1:8796 npm run build
cp -R apps/web/dist "$evidence/candidate-off"
cmp apps/web/dist/index.html "$evidence/base-off/index.html"
cmp apps/web/dist/THIRD_PARTY_NOTICES.txt "$evidence/base-off/THIRD_PARTY_NOTICES.txt"
node --input-type=module <<'JS'
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const inputs = Object.keys(JSON.parse(readFileSync('apps/web/dist/meta.json', 'utf8')).inputs);
assert.deepEqual(inputs.filter((input) => input.startsWith('node_modules/@supabase/') || input.startsWith('apps/web/src/team/') || input === 'apps/web/src/state/use-presence.ts'), []);
console.log('Off HTML/notices match base; off metadata excludes all presence/team/Auth inputs.');
JS
npm run audit:licenses
npm run build:fixtures
BOARD_TEAM_FEATURES=on BOARD_SUPABASE_URL=http://127.0.0.1:55321 BOARD_SUPABASE_ANON_KEY=synthetic BOARD_SERVER_URL=http://127.0.0.1:8796 npm run build
cp -R apps/web/dist "$evidence/candidate-on"
cmp apps/web/dist/index.html "$evidence/base-on/index.html"
cmp apps/web/dist/THIRD_PARTY_NOTICES.txt docs/architecture/0001-runtime-notices-v3.txt
npm run audit:licenses
npm run build:server
npm run audit:licenses
cmp package-lock.json docs/architecture/0001-dependency-lock-v5.json
git diff --check
git diff --name-status 3b00e7378840e6d045998315e11d23fe90217f0f..7b45a40e330b6978c6eaeb5718afbf04ae2e59d0
```

The byte audit ran with `python3 -` and this standard-library script:

```python
import subprocess
from pathlib import Path
base='3b00e7378840e6d045998315e11d23fe90217f0f'
tracked=subprocess.check_output(['git','ls-tree','-r','--name-only',base],text=True).splitlines()
manifests=[name for name in tracked if name.endswith('/package.json') or name in ('package.json','package-lock.json')]
for name in manifests:
    assert Path(name).read_bytes()==subprocess.check_output(['git','show',f'{base}:{name}']), name
print('V1 evidence: all six package.json files and package-lock.json match the base byte for byte.')
for name in tracked:
    if name.startswith('tests/') and name not in ('tests/modules.test.mjs','tests/README.md'):
        assert Path(name).read_bytes()==subprocess.check_output(['git','show',f'{base}:{name}']), name
assert Path('apps/web/style.css').read_bytes().startswith(subprocess.check_output(['git','show',f'{base}:apps/web/style.css']))
print('Existing tests outside the permitted guards and README are unchanged; CSS is append-only.')
```

```text
PASS: V1 — All six package.json files and package-lock.json match the base byte for byte.
PASS: V2 — npm ci exited 0; installed 118 packages with the pinned toolchain.
PASS: V3 — Typecheck exited 0 for all five workspace members.
PASS: V4 — 761 tests passed, 0 failed; 13 new presence tests. Only the named module guards changed among existing tests.
PASS: V5 — Off build and license audit exited 0; HTML/notices match base; metadata excludes Supabase, team modules and the presence hook.
PASS: V6 — Fixture and on builds and license audit exited 0; on HTML matches base and notices match runtime notices v3.
PASS: V7 — Node/Worker server builds and license audit exited 0.
PASS: V8 — Base-to-validated diff contains only the 14 implementation files in items 1–5; this record adds only the brief itself.
```

Before the final successful runs, the first typecheck exposed TS2559 at the
presence-refusal call; passing its explicitly named fields resolved it. The first
full unit run passed 760/761 tests and failed the existing team-import guard:
`use-presence.ts` imported pure team rules by value. Moving those calls behind
`HostedBoard` resolved that failure without weakening the guard. Typecheck and the
full suite were then rerun successfully. The focused presence run passed 13/13.
No other existing test needed a change. The only new test file is
`tests/web-presence.test.mjs`, and each test dynamically imports the pure module
inside its own callback.

Source/test commit used `git commit -m "feat(web): show board people cursors and following"`.
Both public-boundary hook checks printed PASS. Git additionally printed a
nonfatal `packed-refs.lock` permission warning; the commit succeeded, the branch
ref resolved to the validated revision, and the worktree was clean. No hook was
bypassed and no stash was used.

Changed implementation files: `apps/web/src/team/presence.ts`, `hosted-board.ts`,
`people.tsx`, `presence-layer.tsx`, `team-app.tsx`; `apps/web/src/state/use-presence.ts`,
`use-viewport.ts`; `apps/web/src/ui/save-area.tsx`; `apps/web/src/App.tsx`;
`apps/web/style.css`; `tests/web-presence.test.mjs`, `tests/modules.test.mjs`,
`tests/README.md`; and `docs/architecture/README.md`. This record changes only this
brief. No server, package, Supabase, manifest, lock, saved format or dependency
changed. Ignored build metadata is not counted as a changed file.

#### Deferred to the independent review check run

V9–V13 were not run: W3-S1–S35; the negative control on a fresh base stack
(including each new unit test failing by name there); the team-off network check;
the team-off A–J comparison with no new masks; and W4-S1–S29, including the
specified isolated fresh-stack retry if a check fails. These are the review's
checks, not claimed passes. No browser was launched, no Supabase CLI command or
stack was run, and no Docker, operating-system input, server integration suite,
deployment, hosted project or real-person data was used. No additional browser
matrix, accessibility audit, load/performance campaign, physical input or
screen-reader session was run. Implementation is handed off for exact-commit
review, not merged or accepted.


### Version 2 — Fix round 1 (2026-11-02)

- Branch: `codex/0004-W3-see-who-is-on-a-board`.
- Version 2 prerequisite base on committed main:
  `705a7da4c6c5fc05bf5d25c16f73e4eca318d902` (brief v2 and interaction v27).
- Starting branch tip: merge `9b32c835b6bdbec6c17fe7967607f4c433a790cf`,
  which brought that main revision into the v1 implementation branch.
- Validated source/test revision: `8abdbbe5b977aebed5d6cc7af698366995c1c419`.
  The final typecheck and 761-test run completed on that commit. The record-only
  commit follows separately, and its branch tip is reported in the handoff.
- Toolchain: `node --version` returned `v26.13.0`; `npm --version` returned
  `11.20.0`. Every shell command put the supplied pinned toolchain bin first on
  `PATH`. No dependency, manifest, lock or saved format changed.
- Discovery: codebase-memory `list_projects` again returned
  `MCP tool call requires approval, but approval policy is never`. Direct reads
  and searches continued under the planner's instruction. The v1 Discovery
  attribution has been corrected from maintainer to planner (m1).

Read-only design preparation included reading the approved mock-up note,
opening and inspecting all four approved screens (together, people, following,
overflow), and reading their drawing generator. These references were not copied
into the repository. Public interaction v27 supplied the implementation values.
Its banner words take precedence over any older caption describing a separator.

F1: the save panel's existing `.divider` is explicitly rendered after the people
node and before the status, with `aria-hidden="true"`; its original 1 × 20 CSS
pixel rule is unchanged. F2: avatars are 28 × 28 with white 2-pixel borders and
6-pixel overlap, the follow ring is 2 pixels, overflow is a pill, and the bare
chevron uses the prescribed SVG. The menu has v27's dark colours, row/dot/type
values, spacing, shadow, width and offsets, including the 12-pixel narrow-window
right inset. The cursor arrow and pill use the prescribed path, sizes, offsets,
rounded corners and shadow. Selection outline left/top are each shifted by
−2 CSS pixels while keeping the selection rectangle's width/height. The layer,
frame and banner use layer 5; the menu uses layer 6. The following banner reads
`Following <label>` with no separator and has the darker Stop following button.

The menu is portalled outside the save panel's stacking context so layer 6 can
sit above presence without raising that whole panel. Outside presses and focus
leaving still close it; Escape still returns focus to the opener. Tab resumes
from the menu's logical place after the chevron, rather than from the portal at
the end of the document. Its existing menu navigation, Follow actions and cursor
shortcut remain in place. Browser confirmation is deferred, not claimed here.

Only `people.tsx`, `presence-layer.tsx`, `save-area.tsx`, the existing appended
presence CSS block, the architecture index, test guide and this brief changed
in this round. The architecture index names v2 and interaction v27; the test
guide includes W3-S36. No unit test asserted the old following-banner words, so
no test source needed changing. `App.tsx` remains 263 lines. Presence rules,
hosted-board state/subscriptions, the presence hook, viewport setters, team-app
wiring and module guards are byte-identical to the round's starting revision.
All source and tests under the protected server/package/Supabase trees are
unchanged. The stylesheet from prerequisite main is an unchanged byte prefix.

#### Commands and results

`$board_w3_evidence` below is the system temporary directory created by
`mktemp -d -t board-w3-v2-evidence`; its concrete machine path is omitted.
All build copies, archived source and logs were kept in that directory.
The settings are synthetic compilation inputs; nothing was sent to their URLs.

From the implementation worktree:

```sh
node --version
npm --version
npm ci --ignore-scripts --no-audit --no-fund
mkdir "$board_w3_evidence/base-source"
git archive 705a7da4c6c5fc05bf5d25c16f73e4eca318d902 | tar -x -C "$board_w3_evidence/base-source"
cp -R node_modules "$board_w3_evidence/base-source/node_modules"
```

In the archived prerequisite main source (`cd "$board_w3_evidence/base-source"`):

```sh
BOARD_TEAM_FEATURES=off BOARD_SUPABASE_URL=http://127.0.0.1:55321 BOARD_SUPABASE_ANON_KEY=synthetic BOARD_SERVER_URL=http://127.0.0.1:8796 npm run build
cp -R apps/web/dist "$board_w3_evidence/main-off"
BOARD_TEAM_FEATURES=on BOARD_SUPABASE_URL=http://127.0.0.1:55321 BOARD_SUPABASE_ANON_KEY=synthetic BOARD_SERVER_URL=http://127.0.0.1:8796 npm run build
cp -R apps/web/dist "$board_w3_evidence/main-on"
```

Back in the implementation worktree, the final candidate commands were:

```sh
npm run typecheck
npm test > "$board_w3_evidence/unit-final.log" 2>&1
tail -n 12 "$board_w3_evidence/unit-final.log"
BOARD_TEAM_FEATURES=off BOARD_SUPABASE_URL=http://127.0.0.1:55321 BOARD_SUPABASE_ANON_KEY=synthetic BOARD_SERVER_URL=http://127.0.0.1:8796 npm run build
cp -R apps/web/dist "$board_w3_evidence/candidate-off-final"
cmp apps/web/dist/index.html "$board_w3_evidence/main-off/index.html"
cmp apps/web/dist/THIRD_PARTY_NOTICES.txt "$board_w3_evidence/main-off/THIRD_PARTY_NOTICES.txt"
node --input-type=module <<'JS'
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const inputs = Object.keys(JSON.parse(readFileSync('apps/web/dist/meta.json', 'utf8')).inputs);
assert.deepEqual(inputs.filter((input) => input.startsWith('node_modules/@supabase/') || input.startsWith('apps/web/src/team/') || input === 'apps/web/src/state/use-presence.ts'), []);
console.log('Off metadata excludes Supabase, team modules and the presence hook.');
JS
npm run audit:licenses
npm run build:fixtures
BOARD_TEAM_FEATURES=on BOARD_SUPABASE_URL=http://127.0.0.1:55321 BOARD_SUPABASE_ANON_KEY=synthetic BOARD_SERVER_URL=http://127.0.0.1:8796 npm run build
cp -R apps/web/dist "$board_w3_evidence/candidate-on-final"
cmp apps/web/dist/index.html "$board_w3_evidence/main-on/index.html"
cmp apps/web/dist/THIRD_PARTY_NOTICES.txt docs/architecture/0001-runtime-notices-v3.txt
npm run audit:licenses
npm run build:server
npm run audit:licenses
cmp package-lock.json docs/architecture/0001-dependency-lock-v5.json
git diff --check
git diff --name-status 705a7da4c6c5fc05bf5d25c16f73e4eca318d902..8abdbbe5b977aebed5d6cc7af698366995c1c419
```

The final byte/scope audit used `python3 -` with the following script, before
appending this record; all assertions passed and the clean-tree check exited 0:

```python
import subprocess
from pathlib import Path
base='705a7da4c6c5fc05bf5d25c16f73e4eca318d902'
round_base='9b32c835b6bdbec6c17fe7967607f4c433a790cf'
validated='8abdbbe5b977aebed5d6cc7af698366995c1c419'
allowed={
 'apps/web/src/team/presence.ts','apps/web/src/team/hosted-board.ts',
 'apps/web/src/team/people.tsx','apps/web/src/team/presence-layer.tsx',
 'apps/web/src/state/use-presence.ts','apps/web/src/state/use-viewport.ts',
 'apps/web/src/team/team-app.tsx','apps/web/src/ui/save-area.tsx',
 'apps/web/src/App.tsx','apps/web/style.css','tests/web-presence.test.mjs',
 'tests/modules.test.mjs','tests/README.md','docs/architecture/README.md',
 'docs/briefs/0004-W3-see-who-is-on-a-board-and-where-they-are.md',
}
changed=set(subprocess.check_output(['git','diff','--name-only',f'{base}..{validated}'],text=True).splitlines())
assert changed <= allowed, changed-allowed
tracked=subprocess.check_output(['git','ls-tree','-r','--name-only',base],text=True).splitlines()
for name in tracked:
    protected=name.endswith('/package.json') or name in ('package.json','package-lock.json') or name.startswith(('apps/server/','packages/','supabase/'))
    if protected or name.startswith('tests/') and name not in ('tests/modules.test.mjs','tests/README.md'):
        assert Path(name).read_bytes()==subprocess.check_output(['git','show',f'{base}:{name}']), name
assert Path('apps/web/style.css').read_bytes().startswith(subprocess.check_output(['git','show',f'{base}:apps/web/style.css']))
assert len(Path('apps/web/src/App.tsx').read_text().splitlines())==263
for name in ('apps/web/src/App.tsx','apps/web/src/state/use-presence.ts','apps/web/src/state/use-viewport.ts','apps/web/src/team/hosted-board.ts','apps/web/src/team/presence.ts','apps/web/src/team/team-app.tsx','tests/web-presence.test.mjs','tests/modules.test.mjs'):
    assert Path(name).read_bytes()==subprocess.check_output(['git','show',f'{round_base}:{name}']), name
subprocess.run(['git','diff','--exit-code',validated],check=True)
print('PASS: V1 — manifests and lock match committed main.')
print('PASS: V8 — only brief items 1–5 changed; protected trees, base CSS prefix and module boundaries are preserved.')
```

```text
PASS: V1 — Six package.json files and package-lock.json match prerequisite main byte for byte; lock v5 also matches.
PASS: V2 — npm ci exited 0 and installed 118 packages without dependency changes.
PASS: V3 — Typecheck exited 0 for all five workspace members at the validated revision.
PASS: V4 — 761 tests passed, 0 failed, including all 13 presence tests; no test source changed this round.
PASS: V5 — Final off build, metadata assertions, HTML/notices comparisons and license audit exited 0.
PASS: V6 — Final fixture and on builds, base on-HTML comparison, runtime notices v3 comparison and license audit exited 0.
PASS: V7 — Node and Worker server builds and license audit exited 0; no server suite was run.
PASS: V8 — Main-to-validated diff lists only items 1–5; all protected trees, unchanged base CSS bytes and module boundaries are preserved.
```

Setup note: the first archived-main build tried a symlink to the installed
`node_modules`; its bundle inventory check rejected paths resolving outside the
archive as `Unreviewed bundle input`. The temporary symlink was removed with
`unlink` and replaced by the copied, already installed dependencies shown above.
Both archived-main builds then passed normally; no guard or hook was bypassed.
The starting merge also built successfully in both modes before edits. Candidate
checks passed; the web builds were repeated after the final focused-row styling
adjustment, and typecheck/unit tests were repeated on the committed revision.

The fix commit used
`git commit -m "fix(web): match approved board presence design"`.
Both public-boundary hooks printed PASS. Git again printed a nonfatal
`packed-refs.lock` permission warning; the commit succeeded and resolved to the
validated revision. No stash, push, merge, publication or hook bypass occurred
in this fix round. No dependency was added.

V9–V13 remain unrun and assigned to the independent review check run, including
W3-S36's computed styles/SVG/rectangle assertions and candidate-versus-approved
screens, all W3-S1–S35 behaviour checks, the fresh-base negative control, team-off
network check, team-off A–J comparison and W4-S1–S29 with its specified isolated
retry if needed. No browser, Supabase CLI/stack, Docker or operating-system input
was started. No server integration suite, hosted project, deployment, real
person, browser matrix, physical-input run, screen-reader session, accessibility
audit or performance/load campaign was used. These deferred checks are not
reported as passes.

- Ring-offset follow-up (2026-11-02): made the followed avatar's existing 1-pixel stylesheet offset explicit inline in `people.tsx` (`outlineOffset: 1`), with no other source change; validated revision `7c42a362f7eb9f4ddded8bfd947f883bc12e2e9d`; PASS: V2 (`npm ci --ignore-scripts --no-audit --no-fund`, exit 0); PASS: V3 (`npm run typecheck`, all five members, exit 0); PASS: V4 (`npm test`, 761 passed, 0 failed); PASS: V8 (`git diff --name-status 705a7da4c6c5fc05bf5d25c16f73e4eca318d902..7c42a362f7eb9f4ddded8bfd947f883bc12e2e9d`, only approved files; `git diff --name-only b3476134ba7bbe2c6eb63004d06602778c2db984..7c42a362f7eb9f4ddded8bfd947f883bc12e2e9d`, only `apps/web/src/team/people.tsx`); V1 and V5–V7 were not rerun, V9–V13 remain deferred to review; no push.

- Fix round 2, F3 (2026-11-02): added only two presence-block hover selectors, specificity (0,5,1) versus the unchanged shared rule's (0,3,1), keeping the chevron transparent and +N `#ece9f2`; validated revision `3875245fa5d413119113815711ec3b9d85dbd70d`; PASS: V2 (`npm ci --ignore-scripts --no-audit --no-fund`, exit 0); PASS: V3 (`npm run typecheck`, all five members, exit 0); PASS: V4 (`npm test`, 761 passed, 0 failed); PASS: V5 (`BOARD_TEAM_FEATURES=off BOARD_SUPABASE_URL=http://127.0.0.1:55321 BOARD_SUPABASE_ANON_KEY=synthetic BOARD_SERVER_URL=http://127.0.0.1:8796 npm run build`, exit 0; copied dist to system temporary storage; `cmp` of index.html and THIRD_PARTY_NOTICES.txt against the archived prerequisite-main off build both exited 0; `node --input-type=module` assertions also matched those bytes to main `705a7da4c6c5fc05bf5d25c16f73e4eca318d902` and excluded Supabase/team/presence-hook metadata inputs; `npm run audit:licenses`, exit 0); PASS: V8 (`git diff --name-status 705a7da4c6c5fc05bf5d25c16f73e4eca318d902..3875245fa5d413119113815711ec3b9d85dbd70d`, approved files only; `git diff --name-only df45ce0b34e3a9388b4e7983e6660c77a37cbb0a..3875245fa5d413119113815711ec3b9d85dbd70d`, only apps/web/style.css; byte assertions confirmed exactly the two added rules and the unchanged base CSS prefix); V1 and V6–V7 were not rerun, V9–V13 including browser hover checks remain deferred to review; no push.
