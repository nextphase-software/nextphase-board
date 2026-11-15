BRIEF VERSION: 0010-W1 v1 (2026-11-15)
# 0010-W1 — Find content and navigate sections

Status: Draft. Implementation has not started under this brief.

## Outcome and read first

**Find on board** (⌘F on macOS, Ctrl+F elsewhere) opens a small bar under the save area. Typing finds
stickies, shapes, text, section names, connector labels and mind-map nodes by their text; each result
gets a ring (the current one orange), everything else fades, and the bar counts "3 of 5". Return and
the arrows step through the results in reading order, moving the view to a result that is out of
sight; Escape closes the bar and leaves the current result selected. Results follow every change to the
board, and a removed current result is reported. The **Navigation panel** gains Find on board,
**Zoom to fit** (⇧1), **Zoom to selection** (⇧2) and a **Sections** list whose buttons fit a section in
view. One fit rule and one show rule decide where the view goes, and the zoom range becomes 10–200%.
None of this changes the board.

Read [AGENTS.md](../../AGENTS.md), [CONTRIBUTING.md](../../CONTRIBUTING.md),
[DESIGN.md](../../DESIGN.md) and these two new contract files (prior versions remain untouched):

| Contract | New version / ownership |
| --- | --- |
| [Interaction](../architecture/0001-interaction-v42.md) | v42: the zoom range and steps, the dot grid below 50%, the free area, the fit and show rules and the boxes they use, Find on board (keys, bar, search, matching, order, board changes, rings, fading, focus, announcements), the Navigation panel's rows, Shift+1 and Shift+2, and that none of it changes the board |
| [Web modules](../architecture/0001-web-modules-v40.md) | v40: four new source modules and one test file, the counts, `view.ts`'s changes, the nine App.tsx substitutions and the seams |

Use this set wherever inherited contracts link a replaced version. Unchanged: [document v17](../architecture/0001-document-v17.md)
and every contract it lists, [storage v3](../architecture/0001-storage-v3.md),
[board file v4](../architecture/0006-board-file-v4.md), [sync v13](../architecture/0003-sync-v13.md),
[presence v4](../architecture/0004-presence-v4.md) (following a presenter now fits within 10–200% through
the shared clamp; the presence message is unchanged), [access v13](../architecture/0003-access-v13.md),
[toolchain v5](../architecture/0001-toolchain-v5.md), [lock v5](../architecture/0001-dependency-lock-v5.json),
[inventory v5](../architecture/0001-dependency-inventory-v5.json) and
[runtime notices v3](../architecture/0001-runtime-notices-v3.txt). Document version 12, fileVersion 2,
room layout 7 and 17 service tables remain. Nothing new is stored, saved or sent.

Build directly; no prototype or scenario tool is an input. Prove the stated values with focused
tests, followed by independent checks. Report a contract conflict before dependent work.

## Deliverables and boundaries

Planning source baseline main **4f53e7f**. Use a fresh milestone worktree and branch from committed
main containing this packet, recording that prerequisite base separately from the behaviour baseline.
New source files carry `SPDX-License-Identifier: Apache-2.0`. Only these files may change, plus the
append-only Implementation record below.

**New (five).** 1. `apps/web/src/find.ts`; 2. `apps/web/src/state/use-find.ts`;
3. `apps/web/src/ui/find-bar.tsx`; 4. `apps/web/src/scene/find-rings.tsx` (all as web modules v40);
5. `tests/find.test.mjs`.

**Changed: web** (under `apps/web/src/`). 6. `view.ts` (the zoom range, `ZOOM_STEPS`, `stepZoom`,
`freeArea`, `fitView`, `showView`); 7. `App.tsx` (only the nine substitutions of web modules v40);
8. `state/use-canvas-input.ts` (Shift+1 and Shift+2 only); 9. `scene/board-drawing.tsx` (`faded` only);
10. `ui/navigation-panel.tsx`; 11. `ui/zoom-controls.tsx` (only if the new steps need it);
12. `icons.tsx` (search, chevron-up and close); 13. `apps/web/style.css` (the find bar, the rings, the
panel's new rows and pan grid, the find bar's narrow rule).

**Changed: hosted key guards.** 19. `team/reactions-layer.tsx`, 20. `team/comments/layer.tsx`,
21. `team/spotlight-layer.tsx`, 22. `state/use-presence.ts`: one guard each, as web modules v40, so
their keys ignore events from inside the find bar.

**Changed: tests and guide.** 14. `tests/view.test.mjs` (the expectation changes in **Shared-path check dispositions** plus the
new `freeArea`, `fitView`, `showView` and `ZOOM_STEPS` checks V4 names); 15. `tests/web-presence.test.mjs`
(only as **Shared-path check dispositions**); 16. `tests/modules.test.mjs` (counts and the App test of web
modules v40); 17. `tests/README.md` (the new file); 18. `docs/guides/try-board.md` (Part 1, below).
New tests import the new modules dynamically inside their named checks, never at top level, so on the
4f53e7f baseline each new check fails by name (V10).

**Try-and-test guide (Part 1, single-user).** Add this row right after the "Pan and zoom" row, and in
the "Pan and zoom" row change `(50–200%)` to `(10–200%)`; nothing else in the guide changes:

| Feature | Try this | You should see |
| --- | --- | --- |
| [Find and navigate](../briefs/0010-W1-find-content-and-navigate-sections.md) | Add two sections and a few stickies, two of them containing "launch", one far off to the side, and click Save. Click an empty spot on the board so nothing is selected. Press Cmd+F (Ctrl+F) and type "launch". Press Return, then Escape. Click the Navigation button beside the zoom and choose a section. Click an empty spot on the board, then press Shift+1 | Both stickies get a ring, the current one orange, and the other objects fade; the bar counts "1 of 2", then "2 of 2" as the view moves to the far sticky. Escape closes the bar and leaves that sticky selected. Choosing a section fills the view with it; Shift+1 shows the whole board. Nothing is marked unsaved |

Not allowed: a dependency, font, image file, service, import exception, stored value, state hook or
screen part beyond web modules v40, or any change to the packages, the server, the room or the
document.

Outside the named new controls, the existing screens' markup stays exactly as at the base: the
reviewer's A–J comparison allows only the masks listed under validation.

## Required behavior and concrete design

Implement interaction v42 and web modules v40 in full. In particular:

- **Zoom.** 0.1–2 on every route (buttons, wheel, pinch, follow, fits); the steps
  10, 25, 50, 75, 100, 125, 150, 175, 200% with the 0.001 tolerance; no dots below 50%; Reset view 100%;
  the activity view's own rule unchanged.
- **Moving the view.** The free area (12 px sides, top 68, the palette's top − 8, the open panel's
  left − 12, the 160 px fallback) measured at each move; the boxes (displayed rectangles, a section's
  26-unit name band, a connector's bounds with its label box, unions); fit with 48 px padding, clamped,
  centred on the free area; show that leaves an in-view box alone, centres a box that fits and fits
  one that does not; every move an own view change, never an edit.
- **Find.** ⌘F / Ctrl+F from anywhere on a shown board (the browser's find prevented; nothing while
  composing or during a Tidy up preview; a text edit ended first); the bar's exact layout, words,
  tooltips and live region; the last query kept for the tab and re-run; searchable types and the
  hidden-node exclusion; trimmed, NFC, lower-case substring matching, one result per object; reading
  order; the first result current on a query change; Next and Previous with wrapping and the show rule;
  results recomputed on every board change with the current one kept, removed (`– of <m>` and the
  removed line, Next and Previous from its place) or `No results`; a returning result counted but not
  current; rings in screen pixels with the two looks; 40% fading of non-results other than sections
  only while nothing is selected; no pointer events on rings; Escape or Close find selecting the
  current result and focusing the canvas.
- **Navigation panel.** Find on board (with the platform's hint), Zoom to fit and Zoom to selection
  with hints and their disabled tooltips, the Sections list (reading order, trimmed name or
  `Untitled section`, `Go to section <name>`, `No sections yet`), section buttons fitting with the panel
  open and keeping focus and selection, the Move heading and the 2 × 2 pan grid, Reset view and Close
  navigation as today.
- **Keys.** Shift+`Digit1` and Shift+`Digit2` on the canvas under interaction v42's conditions.
- **Kept apart.** No edit, Undo step, save-state change, hosted edit or stored value from any of it,
  local or hosted; viewers can use all of it.

## Shared-path check dispositions

This inventory authorizes expectation changes, not additional historical runs.

| Shared path / older checks | Disposition |
| --- | --- |
| Zoom floor and steps: `tests/view.test.mjs` (:40 the expected zoom formula's floor `.5`; :59 `clampView` of `z: .1`; :98–106 the `stepZoom` table) | The floor becomes 0.1 (so :59 expects `z: .1`) and the step table follows `ZOOM_STEPS` (for example from 0.5 down to 0.25, from 0.25 down to 0.1, from 0.1 up to 0.25, from 2 down to 1.75); every other assertion stays |
| Follow view: `tests/web-presence.test.mjs:105` (`fitFollow` expecting `z: .5` for a view that needs `min(900 / 2560, 700 / 1600)`) | Expects `{ x: 80, y: 100, z: 0.3515625 }` (now inside the range); :106–107 (the 2 maximum) unchanged |
| Activity view: `tests/activities.test.mjs:209–220` | Unchanged (the activity view keeps its own 0.5–1.75 quarter steps) |
| Module inventory: `tests/modules.test.mjs` | 15 package files, 10 object types, 16 scene parts, 30 screen parts, 24 state hooks, `use-find.ts` exactly 1 effect, other effect counts unchanged; the "0009-W3 App composition" test (588–648) rewritten as "0010-W1 App composition" from base 4f53e7f with the nine substitutions of web modules v40 |
| Connectors at zooms: `tests/connectors.test.mjs:118, :191` | Unchanged (they loop 0.5 and 2, both still valid) |
| Local shell: A–J | Unchanged; a screen that shows the Navigation panel, if any, is the one declared mask on that region |

## Browser checks

New scenario **F1-S1–F1-S17**. F1 was unused in existing public briefs when allocated. A fresh
independent check run writes its tool from these clauses and the contract values; each row prints its
full ID, `PASS:`/`FAIL:` and a summary, retaining raw receipts and unrun rows. 1280 × 800, scale 1,
macOS Chrome (so the key is ⌘F and the hint `⌘F`), unless a row says otherwise. Use real pointer and key
events, never painted DOM. New capability rows also fail by name on independent baseline 4f53e7f.
Derived positions ±0.5 CSS px (from the objects by the contracts' rules); colours and sizes exactly as
interaction v42; canvas pixel colours ±8 per channel. Save a real-state image for F1-S1, S3, S7, S8, S9,
S11, S12, S13 and S16. Texts, positions and sizes in the mock-up's PNGs are sample data; every look is a
value.

**Fixture F.** A local board named "Find check", opened from a board file the check tool writes to
document v17 and board file v4 and opens through the Board panel's Open board file… (no other route),
then saved once with Save, holding (box
`x, y, width, height` in board units, sections' members by `section`):

| Id | Object | Box | Text |
| --- | --- | --- | --- |
| f01 | section | −680, −200, 640, 480 | `Discovery` |
| f02 | section | 40, −200, 640, 480 | `Retro zone` |
| f03 | sticky in f01 | −640, −80, 240, 240 | `Interview five customers` |
| f04 | sticky in f01 | −320, −80, 240, 240 | `Launch checklist draft` |
| f05 | sticky in f02 | 80, −80, 240, 240 | `What went well at launch` |
| f06 | sticky in f02 | 400, −80, 240, 240 | `Launch slipped a week` |
| f07 | sticky | 1140, −80, 240, 240 | `Launch party ideas` |
| f08 | sticky | −120, 300, 240, 240 | `Budget` |
| f09 | text | −160, −390, 320, 120 | `Q4 launch plan` |
| f10 | square shape | −560, 600, 180, 180 | `Metrics board` |
| f11 | connector f08 → f10 | — | label `next path` |
| f12 | mind-map root | 400, 640 (its own size) | `Roadmap map` |
| f13 | child of f12, collapsed | (laid out) | `Roadmap branch` |
| f15 | child of f13 (hidden) | (laid out) | `roadmap detail` |
| f14 | sticky | 700, 300, 240, 240 | `CAFE` + U+0301 + ` plan` (decomposed) |

**Entry state.** Unless a row says it continues from the row before it, a row starts from the saved
Fixture F board opened in a new tab from Boards in this browser: view 100% at (0, 0), nothing selected,
no panel open, Find closed with no last query. F1-S4 and F1-S5 continue from the row before each.
Board Undo is the file bar's Undo button or ⌘Z with focus on the canvas, never in the find field.

| ID | Scriptable behavior and expected result |
| --- | --- |
| F1-S1 | With focus on the canvas, ⌘F's keydown is default-prevented and opens the bar: right 12, top 68, width 290, height ≥ 48; the field focused, empty, placeholder `Find…`, accessible name `Find on board`; Previous result, Next result and Close find present with tooltips `Previous result · ⇧Return`, `Next result · Return`, `Close find · Esc`; Previous and Next disabled; the counter empty; no rings and nothing faded. Capture find-open |
| F1-S2 | ⌘F also opens the bar (and is default-prevented) with focus in (a) a sticky's text editor, whose edit ends with its typed text kept, (b) an Objects panel field, (c) the page body; with a Tidy up preview open, ⌘F is default-prevented and opens nothing |
| F1-S3 | Typing `launch`: counter `1 of 5`; rings on f09, f04, f05, f06, f07 only (current f09); the view shows f09 by the show rule (ring centred at (640, 396) at 100%); f03, f08, f10, f12, f13 and f14 are drawn at 40% (canvas pixels inside them), f01 and f02 are not faded; the counter is inside a polite live region. Capture find-results |
| F1-S4 | Return four times makes current f04, f05, f06, f07 in turn (`2 of 5` … `5 of 5`), each step moving the view only as the show rule says from the previous view (f05 is already in view after f04, so the view does not move for it); a fifth Return wraps to f09 `1 of 5`; Shift+Return from there gives f07 `5 of 5`; the Previous and Next buttons do the same as the keys |
| F1-S5 | Ring looks by computed style: the current ring 3 px `#f08c00` 5 px outside the box, radius 7 px, with the 3 px `rgba(240, 140, 0, 0.18)` halo; the others 2 px `#fcc419` 4 px outside, radius 6 px; ring widths unchanged at 50% and 200% (zoom buttons); `pointer-events: none`. Then Reset view (Navigation panel, then close it), click the find field and press Shift+Return twice (f05 current and shown); a click on f05 through its ring selects f05; the bar stays open; f03 is drawn at full colour again while the rings remain |
| F1-S6 | Other types and the rule: `metrics` → f10 only; `path` → f11 only, its ring around its bounds and label box; `retro` → f02 only, its ring's top edge 26 board units plus 5 px above the section's top; `roadmap` → f12 and f13 (`1 of 2`; f15 hidden in the collapsed branch is not a result); `café` (precomposed) → f14; `  LAUNCH  ` → the same five as `launch`; an empty field → counter empty, no rings, nothing faded, arrows disabled |
| F1-S7 | `launch`, Return twice (f05 current), Escape: the bar, rings and fading are gone, f05 alone is selected with its context bar, and focus is on the canvas. ⌘F again shows `launch`, all selected, and runs it: `1 of 5`, f09 current, the view showing f09. Return three times (f06 current), Close find: f06 alone selected. ⌘F, type `zzz`, Escape: the selection stays f06. Capture find-closed |
| F1-S8 | The query `zzz`: counter `No results`, Previous and Next disabled, nothing faded, Return changes nothing. Capture find-none |
| F1-S9 | `launch`, Return twice (f05 current); click f05 and press Delete: counter `– of 4`, the removed line `The result you were on was removed. Return goes to the next one.` in the live region, four rings, the view unchanged. Capture find-removed. Click the find field, Return: f06 current (`3 of 4`). Board Undo (the Undo button) restores f05: `4 of 5`, f06 still current, f05 ringed yellow. Shift+Return in the field twice: f04 current (`2 of 5`); select f04, end any edit, and change its text through its text editor to `Checklist draft`: `– of 4` and the removed line; click the field, Shift+Return: f09 current (`1 of 4`). Then delete f09, f05, f06 and f07 with the bar open: `No results`, no removed line |
| F1-S10 | Across F1-S1, F1-S3–F1-S8, F1-S12–F1-S14 and F1-S16, and F1-S11 before its rename (the steps that edit nothing; F1-S2's ended edit is an ordinary edit and is excluded), from the saved entry state: the save state stays `Locally saved`, Undo and Redo stay as they were before the row, and the saved board in local storage is byte-identical before and after |
| F1-S11 | Navigation panel: heading `Move around the board`, then Find on board with the hint `⌘F`, Zoom to fit with `⇧1` and Zoom to selection with `⇧2` side by side (Zoom to selection disabled with nothing selected, its tooltip `Select something to zoom to`), the heading `Sections`, buttons `Discovery` then `Retro zone` (accessible names `Go to section Discovery`, `Go to section Retro zone`), the heading `Move`, Pan left, Pan right, Pan up, Pan down in a 2 × 2 grid, Reset view, Close navigation; pan buttons pan by 100 units as before. Renaming f01 to empty shows `Untitled section`; a board with no sections shows `No sections yet`. Find on board opens the find bar with the panel still open. Capture navigation |
| F1-S12 | `Retro zone` with the panel open fits f02's box with its band (40, −226, 640, 506) into the free area that ends 12 px left of the panel: zoom and the section's drawn corners (canvas pixels) as the fit rule gives; the panel stays open, focus stays on the button, the selection is unchanged. Capture section-fit |
| F1-S13 | Shift+1 on the canvas with no panel open fits the union of every object's box (sections with their bands): the zoom bar's percentage and the drawn corners of f01 and f07 as the fit rule gives for the full free area. With the Navigation panel open, its Zoom to fit gives the fit for the free area that ends 12 px left of the panel. With f07 selected, Shift+2 (panel closed) gives 200% with f07 centred in the free area, and the panel's Zoom to selection gives the same for the panel-open area. With nothing selected Shift+2 does nothing; on an empty new board the panel's Zoom to fit is disabled with `Add something to the board first` and Shift+1 does nothing; Shift+1 in the find field types its character. Capture zoom-fit (after the panel-closed Shift+1) |
| F1-S14 | From 100%, Zoom out gives 75, 50, 25, 10 then stays 10; Zoom in from 10 gives 25 then 50; after Ctrl+wheel to 110%, Zoom in gives 125; Ctrl+wheel out stops at 10%; at 25% the scene has no dot grid (`background-image` none and plain `#fafafa` pixels), at 50% the dots are back; Reset view gives 100% |
| F1-S15 | Hosted (team stack, ana and ben on "Team test board" holding stickies `launch one`, `launch two`, `other`): ana's Find `launch` shows `1 of 2`; ben deletes ana's current sticky and ana sees `– of 1` and the removed line; ana's Find, Next, Escape (selecting the remaining result), Zoom to fit and a section or selection fit produce no edit (ben's board and the room's history unchanged) |
| F1-S16 | At 375 × 812: ⌘F's bar spans from left 12 to right 12 at top 68; typing `launch` rings results as at full width. Capture narrow |
| F1-S17 | The two rows of `docs/guides/try-board.md` this milestone adds or changes, walked as written on the served candidate: each `You should see` holds |

## Acceptance criteria

- **0010-W1-AC01:** ⌘F / Ctrl+F (or the panel's Find on board) opens the find bar; typing finds
  stickies, shapes, text, section names, connector labels and visible mind-map nodes by trimmed,
  case-insensitive text, rings them, counts them and steps through them in reading order (Return,
  Shift+Return, the arrows, wrapping); an off-screen result is brought into view by the show rule;
  Escape or Close find selects the current result and returns focus to the board. Look and placement
  match the approved design.
- **0010-W1-AC02:** The Navigation panel lists sections by name in reading order and choosing one fits
  it by the fit rule; Zoom to fit (Shift+1, panel) and Zoom to selection (Shift+2, panel; disabled
  with nothing selected) fit by the same rule, within the 10–200% zoom range.
- **0010-W1-AC03:** Find, the Sections list and the zooms add no Undo step, leave the save state
  unchanged and send no edit, locally and hosted; results follow every board change; a removed current
  result shows `– of <m>` and the removed line and Return goes on; `No results` when none remain; a
  restored result counts again without becoming current.

| Criterion | Evidence that shows it |
| --- | --- |
| 0010-W1-AC01 | F1-S1–F1-S8; F1-S16; F1-S17; V4; V9 |
| 0010-W1-AC02 | F1-S11–F1-S14; V4; V9 |
| 0010-W1-AC03 | F1-S9–F1-S10; F1-S15; V4; V9 |

## Applicable DESIGN.md guardrails

Canvas-first shell, native controls and visible focus, minimum action hits, protected native editing
and independent state owners apply. The keyboard route: Find, the panel's buttons and Escape reach
everything Find and the fits do. Interaction v42 states every new look, word and key; never infer
generic styling. No new sound, font or image file. Preserve the complete selection chrome of every
type.

## Validation commands and expected evidence

Use pinned Node 26.13.0 and npm 11.20.0 from the repository root. Source validation is not
independent acceptance. Each check run restates **every V row it reruns** as its own
`PASS: Vn ...` / `FAIL: Vn ...` line with SHA, logs and counts.

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

No server, room or package source changes, so no server-only run follows the build and the server
suites are not run. The check run starts a team stack only for F1-S15, on its own uniquely owned local
Supabase project, and stops on any failed setup step. Record each long run's start and end and the
host's sleep and wake events; a run that overlapped a sleep is INVALID and rerun awake. Three Safari
checks from this milestone are chosen only at Review.

Independent scenario interface (tool written by the later check run):

```sh
node tools/browser-compare/0010-w1-check.mjs <served-origin> <F1-output> [<local-stack-private-json>]
node tools/browser-compare/0010-w1-check.mjs <baseline-origin> <F1-base-output> --negative
```

| Check | Command/inspection and pass condition |
| --- | --- |
| V1 | Byte-compare manifests, locks, dependency inventory and runtime notices against the prerequisite base: unchanged, no new dependency |
| V2 | `npm ci --ignore-scripts --no-audit --no-fund` exits 0 on the clean candidate and on the independent baseline |
| V3 | `npm run typecheck` exits 0 across all five workspace members |
| V4 | `npm test` full suite exits 0; `tests/find.test.mjs` proves the searchable types and the hidden-node exclusion, the matching rule (trim, NFC, case, one result per object, empty query), reading order, each box (section band, connector label union, union of several), the first current result, Next and Previous with wrapping, recomputation keeping, removing and restoring a current result, Next and Previous from a removed place, the counter texts and the removed line, the faded ids (sections never, none with a selection), and the sections list labels; `tests/view.test.mjs` proves the 0.1 floor, `ZOOM_STEPS` and `stepZoom` with its tolerance, `freeArea` (panel and fallback), `fitView` (padding, clamps, zero sides, centring) and `showView` (in view: the same object; centring; fitting). Guards as web modules v40 |
| V5 | Team-off `npm run build` and `npm run audit:licenses` exit 0; notices equal runtime notices v3 |
| V6 | `npm run build:fixtures`, team-on `npm run build` and `audit:licenses` exit 0 |
| V7 | `npm run build:server`, `audit:licenses` and the wrangler dry run exit 0; no deploy |
| V8 | Inspect all hunks plus `git diff --name-status` and `git diff --check` over `<prerequisite-base>..<validated-source>`: only the deliverables, the dispositions above and the append-only Implementation record |
| V9 | F1-S1–F1-S17 pass with the state captures and raw receipts |
| V10 | Once, on an independent 4f53e7f source and build with the candidate's `tests/find.test.mjs` copied in, its checks and the new browser capability checks fail by name; a top-level setup or import abort does not count |
| V11 | Accepted A–J compare: baseline twice, then candidate and diffs; existing normalization plus the declared mask (a region showing the Navigation panel, if any A–J screen shows one) |

A regression failure that also fails on 4f53e7f is a baseline finding to report, never fixed here.

## Review focus and public references

Review that `find.ts` and `view.ts` are pure and decide every rule (matching, order, boxes, removed
place, free area, fit and show); that `use-find.ts` is the only Find state owner with its one effect;
that the ⌘F listener prevents the browser's find in every focus case yet leaves the field's own keys
alone; that results come from the displayed objects, so hidden mind-map nodes and Tidy up previews are
handled; the removed-place, restored-result and no-current rules for Next and Previous; the four
hosted key guards (reactions, comments, spotlight, follow) leaving those features otherwise unchanged; that nothing reaches `commit`, the history, the save state or a hosted edit; that closing
selects through the existing selection path; that the free area reads the palette and an open panel at
the moment of each move; the zoom floor on every route, including follow; and App.tsx changed only by
the nine substitutions of web modules v40. Public source basis is main 4f53e7f and the linked versioned
contracts, read 2026-11-15; no outside product is needed to implement this contract. No unresolved
product decision is delegated to implementation.

## Exclusions and reasons

- Replace and Replace all, match-case and whole-word options, and highlighting the matched words
  inside text (results are ringed as whole objects).
- Searching comments, image descriptions, author names or the board's name; opening collapsed mind-map
  branches to reach a result.
- Links to sections, a minimap, and pages (a later milestone).
- Changing how voting results and comments move the view.
- Repairs to separately tracked baseline failures.

## Implementation record

(Appended by the implementer.)
