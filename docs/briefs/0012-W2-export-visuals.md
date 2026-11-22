BRIEF VERSION: 0012-W2 v1 (2026-11-21)
# 0012-W2 — Export board and selection visuals

Status: Draft. Implementation has not started under this brief.

## Outcome and read first

One **Export** dialog downloads the selection or the open page, on local and team (hosted) boards alike:
- **Open it** with ⇧⌘E / Ctrl+Shift+E on the canvas (with or without a selection) or **Export…** in the board
  panel, right after `Save a copy to file`.
- **Choose** PNG, JPG, PDF or CSV. PNG takes a Grid, Transparent or Solid background; JPG a quality and a Grid or
  Solid background; PDF a quality (its background is white); CSV takes Tables or Stickies. Then `Selection only` or
  `Entire page`.
- **Export** downloads `<board name>.png` (or `.jpg`, `.pdf`, `.csv`) at once. Pictures are the content plus a
  128-unit margin at twice the board's size, and never show selection outlines, handles, bars, cursors or comment
  pins. The PDF is one page holding that picture, one point per board unit. CSV Tables writes whole tables only;
  part of a table exports nothing (`There are no tables to export.`).
- Viewers of a team board cannot export (`Only owners and editors can export this board.`). Export never changes
  the board and sends nothing. `Save a copy to file` is unchanged.

Read [AGENTS.md](../../AGENTS.md), [CONTRIBUTING.md](../../CONTRIBUTING.md), [DESIGN.md](../../DESIGN.md)
and these new contract files (prior versions remain untouched):

| Contract | New version / ownership |
| --- | --- |
| [Interaction](../architecture/0001-interaction-v48.md) | v48: opening, the dialog, its choices and memory, included objects, bounds, scale, backgrounds, PNG, JPG, PDF, CSV, file names, export rules and notices, Export…, the table tooltip, looks, keys, hosted boards |
| [Web modules](../architecture/0001-web-modules-v46.md) | v46: four new source modules (one hook, one screen part, one scene part, one rules module) and one test file, the changed web paths, the new counts, six App.tsx substitutions |

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

**Design.** The maintainer approved the look on 2026-11-21. Interaction v48 states every value of it: the dialog
takes the existing confirmation dialog's look with native radio buttons and a native select, Export… the board
panel's file-button look, and the notices are the app's existing notice.

## Deliverables and boundaries

Planning source baseline main **b3afc2c**. Use a fresh milestone worktree and branch from committed main
containing this packet, recording that prerequisite base separately from the behaviour baseline. New source
files carry `SPDX-License-Identifier: Apache-2.0`. Only these files may change, plus the append-only
Implementation record below.

**New (five).**
1. `apps/web/src/board-export.ts` (web modules v46)
2. `apps/web/src/state/use-export.ts`
3. `apps/web/src/ui/export-dialog.tsx`
4. `apps/web/src/scene/export-drawing.tsx`
5. `tests/board-export.test.mjs`

**Changed** (under `apps/web/src/` unless shown).

| # | File |
| --- | --- |
| 6 | `scene/board-drawing.tsx` (only the optional `stageRef` and `only`) |
| 7 | `scene/mind-map-layer.tsx` (only the optional `only`) |
| 8 | `state/use-page-keys.ts` |
| 9 | `state/use-find.ts`, `state/use-presence.ts`, `team/spotlight-layer.tsx`, `team/reactions-layer.tsx`, `team/comments/layer.tsx` (only the open-dialog early return in each capture-phase `keydown` handler, web modules v46) |
| 10 | `table-csv.ts` (only the two new exports, no behaviour change) |
| 11 | `ui/table-controls.tsx` (only the tooltip) |
| 12 | `ui/board-panel.tsx` |
| 13 | `App.tsx` (only the six substitutions of web modules v46) |
| 14 | `apps/web/style.css` (only new rules under the dialog's own class) |
| 15 | `tests/modules.test.mjs` (only the three module lists and the App composition test, as web modules v46 says) |
| 16 | `tests/table-csv.test.mjs` (only the expectations the dispositions name) |
| 17 | `tests/README.md` (the new test file) |
| 18 | `docs/guides/try-board.md` (two rows, below) |

Type-only changes in other web files are allowed where the compiler needs them, with no behaviour change;
the record lists them. **Every package, the room and the server do not change.**

New tests import the new modules dynamically inside their named checks, never at top level, so on the b3afc2c
baseline each new check fails by name (V12).

**Try-and-test guide.** One row at the end of Part 1's table and one at the end of Part 2's. Nothing else in
the guide changes.

Part 1 (local):

| Feature | Try this | You should see |
| --- | --- | --- |
| [Export the board or a selection](../briefs/0012-W2-export-visuals.md) | Add three stickies side by side and a table below them. Select the three stickies, press Cmd+Shift+E (Ctrl+Shift+E), keep PNG, Solid and Selection only, and click Export. Open the file. Click an empty part of the board, press Cmd+Shift+E again, choose PDF and click Export, and open the file. Then select the stickies, press Cmd+Shift+E, choose CSV and Tables, and click Export | The PNG shows only the three stickies on white with a margin round them, twice the board's size, with no blue outline or handles. The PDF is one page showing the stickies and the table. The CSV gives "There are no tables to export." and nothing downloads |

Part 2 (team mode):

| Feature | Try this | You should see |
| --- | --- | --- |
| [Export on team boards](../briefs/0012-W2-export-visuals.md) | Ana (owner), Ben (editor) and Mia (viewer) open the same team board with a few stickies on it. Ben opens the board panel, clicks Export…, chooses CSV and Stickies, and clicks Export. Mia selects a sticky and presses Cmd+Shift+E (Ctrl+Shift+E), then opens the board panel | Ben gets "<board name>.csv" with a Content header and one line per sticky; nothing changes for Ana and Mia. Mia sees "Only owners and editors can export this board.", no dialog opens, and her board panel has no Export… |

Not allowed:
- a dependency, font, image file, service, service migration or import exception;
- a stored value or saved-format change, a room message, a presence key, an Undo step;
- a change to a package, the room or the server; App.tsx beyond web modules v46's six substitutions; a changed
  effect count; a state hook with an effect;
- a PDF library or vector PDF output, SVG, a scale or size choice, picture metadata, several pages in one file,
  exporting part of a table, a right-click menu, remembering choices across reloads, a success notice.

Outside the named new controls, the existing screens' markup stays exactly as at the base; the reviewer's A–J
comparison allows only the new Export… button and the changed tooltip (V13).

## Required behavior and concrete design

Implement interaction v48 and web modules v46 in full. In particular:

- **Opening:** ⇧⌘E / Ctrl+Shift+E on the canvas opens the dialog with or without a selection, replacing v47's
  direct table export by key, under v48's six-row gate table; a viewer gets the export reason and no dialog. Export…
  is shown and disabled by the same table, closes the panel and opens the dialog; focus returns to the board name
  button.
- **Dialog:** the groups for each file type in v48's order; JPG's Transparent disabled; PDF's static `White`; the
  area select only with a selection; v48's memory rules; the close sequence and refocus; Tab wrapping; Return; key
  events inside the dialog reaching no board, Find, presence, spotlight, reaction or comment handler.
- **Included objects and size:** selected drawn objects plus the stored members of selected sections, or the open
  page; hidden mind-map branches left out; the bounds over every included drawn box (connectors included), grown by
  128; `Wp × Hp` rounded; the scale fit with the 16,384 and 268,435,456 limits, in 0.25 steps down to 0.5.
- **Drawing:** `BoardDrawing` with `only` and `stageRef`, a 2 × 2 stage and the view that puts `(L, T)` at the
  origin, through a detached root and `flushSync`, then `toCanvas` of the export rectangle; mind-map links only
  between included nodes; the root always unmounted; the background under it in an output canvas of exactly
  `Wp × Hp`; no control or mark of any kind.
- **Files:** PNG; JPG with quality argument 0.92 / 0.80 / 0.60; the one-page PDF 1.4 written exactly as v48 orders
  it, with the JPEG frame check and the 14,400-point page cap; CSV Tables (one byte-order mark, v47's table text, an
  empty line between tables) and Stickies (`Content` header, one line per sticky); the file name rule.
- **Run:** inputs frozen at Export; v48's six rules in order with their exact texts; no download if the board or the
  role changed; success shows nothing except the lowered-scale notice.
- **Table bar:** the tooltip `Export as CSV`; the button still downloads the whole table at once.

## Shared-path check dispositions

This inventory authorizes expectation changes, not additional historical runs.

| Shared path / older checks | Disposition |
| --- | --- |
| `tests/table-csv.test.mjs` X5-U17 | Its two tooltip assertions read `Export as CSV` (no shortcut) on both platforms; its disabled-reason tooltip and everything else unchanged and passing as written (its `BoardPanel` renders get no `exportButton`, so no Export…) |
| `tests/table-csv.test.mjs` X5-U18 | Split in two within the same test name. **The button's export rule:** every download, file name, blob type, byte, gate and URL revocation the test now reaches through ⇧⌘E is reached by calling `tableData.exportTable()` directly, with the same expectations (including its silence when blocked). **The key:** ⇧⌘E calls `openExport` and never `exportTable`, with the same key test (exact modifiers, canvas target, composing) and `preventDefault()` only when `openExport` returns true; with no selection or several objects selected it still calls `openExport` |
| Other `tests/table-csv.test.mjs` checks | Unchanged; they must pass as written (`tableCsv` keeps its bytes) |
| `tests/images.test.mjs` and `tests/pages.test.mjs` `usePageKeys` harnesses | Unchanged; they pass no export input and never press ⇧⌘E, and must pass as written |
| Tests of Find, presence, spotlight, reactions and comments keys | Unchanged; they must pass as written (only targets inside an open dialog are newly ignored) |
| `tests/modules.test.mjs` | The three module-list tests name the new hook, screen part and scene part and say "through 0012-W2 v1"; "0011-W2 App composition" is renamed "0012-W2 App composition" with web modules v46's six substitutions added after the earlier ones; every other module check (effects, imports, team list, line budget) unchanged and must pass |
| The 0011-W2 scenario N5 | Rerun under V14 as written except: in N5-S5 the bar click and its file `CSV check table.csv` (and the import round trip from it) are unchanged, and the two ⇧⌘E steps (after clicking one cell, and after clicking `Note`) now open the Export dialog: choosing CSV, Tables and Export gives `There are no tables to export.` and no file each time; the tooltip on hover (N5-S5, N5-S8) and on focus (N5-S7) reads `Export as CSV`; N5-S3's panel order is `Save a copy to file`, `Export…`, `Open board file…`, `Import CSV…`, `Reopen`; in N5-S7 the Tab path through the panel stops once more, on `Export…`, between `Save a copy to file` and `Open board file…`; in N5-S8 Ana's `Import CSV…` is after `Export…`; in N5-S9 Mia's ⇧⌘E now shows `Only owners and editors can export this board.` (no dialog, nothing changes) |
| The 0011-W1 scenario N3 | Rerun under V14 only, as written: its bar checks look for each named button; N3-S1's bar list is unchanged from 0011-W2's reading; its table and ghost drawing is unchanged (the canvas passes no new prop to `BoardDrawing`) |
| Earlier scenario tools for the board panel and board files | Not rerun. When run, for local boards and hosted owners and editors only: the panel gains `Export…` right after `Save a copy to file` (52 px more for every button after it: 0006-W4 T1-S1's geometry), and a keyboard path from `Save a copy to file` takes one more Tab (0006-W2 P45). A hosted viewer's panel is unchanged, and 0006-W1 X1-S7's viewer `Save a copy to file` keeps its behaviour. 0012-W1's image drawing cases keep their results |
| Historical check tools (earlier scenario tools) | Not rerun except the regression runs named under validation |
| Local shell: A–J | Only differences allowed: `Export…` in a board-panel checkpoint and the table tooltip text, if A–J shows either; the check run names each differing checkpoint and its cause |

The record lists every changed line range under `tests/`.

## Browser checks

New scenario **N6-S1–N6-S10**. N6 was unused in existing public briefs when allocated. A fresh, independent
check run writes its tool from these clauses and the contract values. Each row prints its full ID, `PASS:`
or `FAIL:` and a summary, and keeps raw receipts and unrun rows.

Setup: 1440 × 900, scale 1, macOS Chrome, US keyboard layout. Rows N6-S1–N6-S8 on the local app (single-user mode),
**each starting from a fresh Fixture L** in a new browser context unless the row says otherwise; rows N6-S9–N6-S10
on the local team stack started from the candidate on its own uniquely owned local Supabase project, with Ana
(owner), Ben (editor) and Mia (viewer) each in their own browser context. Downloads are caught by the browser
driver and read as bytes; PNG and JPEG pixels are read by decoding the file (any decoder); a PDF is read as bytes
and its objects parsed. **The canvas reference** for a picture at scale 2 is read, in a second browser context with device scale 2 and the
same board at 100 % with nothing selected, from the app's own drawing canvas (its pixels composited onto white, so
the CSS dot grid is not in it), panning so each compared region is on screen and clear of the palette and panels, and
registered to the picture through the board point under each pixel; samples compare within the stated tolerance. Objects are identified through the
Objects panel or by their drawn positions, never by DOM painted for the check. Use real pointer and key events
otherwise. "Open the dialog" means: click empty canvas only when the row says so, otherwise keep the selection; give
the canvas focus; press ⇧⌘E. New capability rows also fail by name on the independent baseline b3afc2c. Colours and
sizes exactly as interaction v48.

**Fixture L** (local): a new board named `Export check` holding the objects below, each made with its own tool
(the Objects panel has no position fields): a sticky by one Sticky tool click at the screen point of its centre; the
table with the Table tool and its cell editor; the image with Insert image (⇧⌘K), which places it at the view centre,
then a Select drag. Pan (Space-drag) before each placement so the target is clear of the palette and panels, then
Navigation › Reset view, click empty canvas so nothing is selected, and Save (`Locally saved`). Nominal top-left
positions (units):
- three stickies 240 × 240 at (−420, −120) `Café, naïve`, (−120, −120) `=1+1` and (180, −120) `Third note`, default
  colour;
- a 2 × 2 table at (−192, 330) with cells `Name`, `Note` / `Pear`, `Say "hi", ok`;
- an image from a 400 × 300 PNG whose left half is `#FF0000` and right half `#0000FF`, drawn 400 × 300 at
  (−200, 600).
The check run then downloads `Save a copy to file` and reads every object's actual position and size from it; every
expected picture size, PDF size and probe point below is computed from those actual values with interaction v48's
rules (the numbers given are the nominal results). Nominally the selection's bounds are 840 × 240 (picture box
1096 × 496 units) and the page's 840 × 1020 (picture box 1096 × 1276); a pixel `(px, py)` of a picture at scale `s`
shows the board point `(L + px / s, T + py / s)`.

**Fixture T** (team): the guide's Part 2 seed (Example team with Ana as owner, Ben as editor, Mia as viewer) and
sign-in steps; Ana chooses Home › New board and sets Board name to `Export team`; Ben adds two stickies `One` and
`Two, too` with the Sticky tool (`One` added first); everyone opens the board; every context at 100 % centred at (0, 0).

| ID | Scriptable behavior and expected result |
| --- | --- |
| N6-S1 | Fixture L. Click the first sticky and Shift-click the other two, then open the dialog: `dialog[open]`, accessible name `Export`, 440 × 328 (±2), its groups in order `File type` (`PNG` checked), `Background` (`Grid`, `Transparent`, `Solid`; `Solid` checked), `Export area` (a select showing `Selection only`, holding `Selection only` and `Entire page`), then `Cancel`, `Export` with focus on `Export`; under the backdrop the three stickies keep their selection and the `3 objects` bar. Capture dialog-png. Click Export: the dialog closes, one download `Export check.png` whose first 8 bytes are the PNG signature, nominally 2192 × 992 pixels; pixel (4, 4) is (255, 255, 255, 255); each sticky's centre equals the canvas reference within 2 per channel; at the middle of each sticky's four edges, the 3 × 3 pixels straddling the edge are each within 24 per channel of the canvas reference and none within 24 of the canvas's selection-outline colour (read from a capture with the stickies selected); the picture's bottom edge is above the table (nominally `T + H` = 248 < 330), and every pixel outside the three sticky boxes grown by 2 units is (255, 255, 255, 255) within 2. The board's objects, the Undo button, the save state and the notice text are unchanged; focus is back on the canvas |
| N6-S2 | Fixture L, the stickies selected. Open the dialog, `Transparent`, Export: pixel (4, 4) has alpha 0 and each sticky's centre is opaque. Open the dialog, `Grid`, Export: the pixel at the board point (−544, −240) (nominally (8, 16)) is `#C8C8C8` within 2 and the pixel 16 to its right is `#F5F5F5` within 2. Then click empty canvas, open the dialog (the area reads `Entire page`, static), `Solid`, Export: nominally 2192 × 2552 pixels; the pixel at the image's left-half centre is `#FF0000` within 3 and at its right-half centre `#0000FF` within 3; in a 24 × 8-unit region round the `Name` text (holding at least 20 pixels darker than (128, 128, 128) in the reference), the mean difference from the canvas reference is at most 24 per channel |
| N6-S3 | Fixture L, the stickies selected. Open the dialog, choose JPG: 440 × 385 (±2); groups `File type`, `Quality` (`High` checked), `Background` (`Grid`, `Transparent` disabled, `Solid`), `Export area`. Capture dialog-jpg. Export at High; open the dialog, Medium, Export; open the dialog, Low, Export: each `Export check.jpg` starts FF D8, decodes to the PNG's pixel size, pixel (4, 4) within 6 of white and each sticky's centre within 8 of the canvas reference |
| N6-S4 | Fixture L, click empty canvas. Open the dialog, choose PDF: 440 × 365 (±2), `Quality` (`Medium` checked), `Background` reading `White`, `Export area` reading `Entire page`. Capture dialog-pdf. Export: `Export check.pdf` begins `%PDF-1.4`; its objects 1–6 are, in order, the Catalog, Pages, Page, content stream, image and Info of v48; every cross-reference offset points at its `n 0 obj` and `startxref` at the table; the MediaBox is `[0 0 PW PH]` (nominally `[0 0 1096 1276]`); the image has `/Width` and `/Height` equal to the picture's (nominally 2192 × 2552) and `/Filter /DCTDecode`; `/Producer (NextPhase Board)`; `/Title` decodes as UTF-16BE to `Export check`. The image's JPEG pixel at the image's left-half centre is `#FF0000` within 8. Open the dialog, PDF High, Export: `/Width` nominally 3288; open it, Low, Export: nominally 1096; the MediaBox the same each time |
| N6-S5 | Fixture L. Click the table once (the whole table and the Table bar). Open the dialog, choose CSV: 440 × 328 (±2); groups `File type`, `Content type` (`Tables` checked), `Export area`, no Background. Capture dialog-csv. Export: `Export check.csv` bytes exactly EF BB BF + `Name,Note␍␊Pear,"Say ""hi"", ok"␍␊`. Click the first sticky and Shift-click the other two, open the dialog, CSV, Tables, Export: no download and the notice reads `There are no tables to export.` Capture no-tables. Open the dialog, CSV, Stickies, Export: bytes exactly EF BB BF + `Content␍␊"Café, naïve"␍␊'=1+1␍␊Third note␍␊`. Select only the table: open the dialog, CSV, Stickies, Export: `There are no stickies to export.`, no download. Pan so the table is clear of the palette, click it once, then click inside its `Pear` cell away from its borders (the Cell bar shows), open the dialog, CSV, Tables, Export: `There are no tables to export.` and no download. Press Escape on the canvas until the whole table is selected (the Table bar), ⌘D (a second table), click empty canvas, open the dialog, CSV, Tables (`Entire page`), Export: the first file's bytes followed by ␍␊ and the same two rows again, with one byte-order mark |
| N6-S6 | Fixture L. Click the board name: the panel shows `Save a copy to file`, `Export…`, `Open board file…`, `Import CSV…`, `Reopen` in that order, each 250 × 40, 12 apart. Capture panel. Click Export…: the panel closes and the dialog opens with `Entire page` static. Choose JPG, then Cancel: the dialog closes and focus is on the board name button. Click empty canvas, open the dialog: `PNG` checked. Choose JPG and Low, Export. Open the dialog: `JPG` and `Low` checked; press Escape: closed, no download. Open the dialog again (focus on `Export`): Tab reaches the checked `JPG` radio button, Shift+Tab from it returns to `Export`, and no Tab leaves the dialog; Tab again to `JPG`, press Left Arrow (`PNG` becomes checked and focused), press Return: one download `Export check.png`. Then open the Pages panel, add a page and open it, open the dialog, PNG, Export: no download and `There is nothing to export on this page.` Capture nothing |
| N6-S7 | Fixture L. Click the table once: hovering the bar's Export as CSV shows `Export as CSV`. Capture tooltip. Clicking it downloads `Export check table.csv` (v47's bytes) with no dialog. With the table still selected, open the dialog: it opens and nothing downloads; Cancel |
| N6-S8 | Fixture L plus a fourth sticky `Far` whose centre is at (9120, 0): Zoom out to the 10 % minimum, Space-drag until the board point (9120, 0) is on screen, add the sticky there with the Sticky tool and type `Far` (or set its text in the Objects panel's text field if the inline editor is too small), then Navigation › Reset view. Click empty canvas, open the dialog, PNG, Export: nominally 14874 × 1914 pixels and the notice `Exported at 1.5× because the page is too large for 2×.` Capture smaller. Zoom out to 10 % and Space-drag until both (−300, 0) and (9120, 0) are on screen, click the first sticky and Shift-click `Far`, open the dialog (`Selection only`), Export: nominally 14874 × 744 and `Exported at 1.5× because the selection is too large for 2×.` Click empty canvas, select `Far` alone and press Delete; at 10 % Space-drag until the board point (40120, 0) is on screen and add a sticky there with the Sticky tool; Navigation › Reset view, click empty canvas, open the dialog, PNG, Export: no download and `Could not export: the page is too large for one picture. Export a selection instead.` Every expected size here is recomputed from the measured positions |
| N6-S9 | Fixture T. Ben opens the board panel: `Export…` after `Save a copy to file`, before `Import CSV…`. Capture team-panel (Ben). Ben clicks Export…, chooses CSV and Stickies, Export: `Export team.csv` bytes exactly EF BB BF + `Content␍␊One␍␊"Two, too"␍␊`; within 3 s Ana's and Mia's boards and notices are unchanged. Ben selects `One` and `Two, too`, opens the dialog and chooses CSV and Stickies: capture team-stickies (the dialog); he chooses Tables and Export: `There are no tables to export.` and no download; capture team-no-tables. Mia opens the board panel: no `Export…`; she closes it, selects `One` and presses ⇧⌘E: no dialog, no download, and a notice `Only owners and editors can export this board.` shows under her read-only line. Capture viewer (Mia). All four captures are required |
| N6-S10 | Both guide rows (Part 1, Part 2) walked as written, opening each downloaded file: each `You should see` holds |

## Acceptance criteria

- **0012-W2-AC01:** On single-user and team boards, an owner or editor opens the Export dialog with ⇧⌘E /
  Ctrl+Shift+E or Export… and downloads the selection or the whole page as PNG, JPG, PDF or CSV under interaction
  v48. Look and placement match the approved design.
- **0012-W2-AC02:** Pictures are the bounds plus 128 units at 2× (lower only as v48's scale fit says), with the chosen
  background and quality, and contain no selection or interface marks. The PDF is one page at one point per unit
  holding that picture (a page whose longer side passes 14,400 points is scaled to fit, the picture unchanged). CSV
  writes whole tables or stickies under v48; part of a table exports nothing.
- **0012-W2-AC03:** `Save a copy to file` is unchanged and not in the dialog. On team boards viewers cannot open
  the dialog and get the export reason; export sends nothing and changes nothing.

| Criterion | Evidence that shows it |
| --- | --- |
| 0012-W2-AC01 | N6-S1, N6-S3, N6-S4, N6-S5, N6-S6, N6-S9; V4 |
| 0012-W2-AC02 | N6-S1, N6-S2, N6-S3, N6-S4, N6-S5, N6-S8; V4 |
| 0012-W2-AC03 | N6-S1, N6-S6, N6-S7, N6-S9; V4 |

## Applicable DESIGN.md guardrails

Canvas-first shell, native controls and visible focus, minimum action hits, protected native editing and
independent state owners apply. The dialog is a native modal `<dialog>` with native radio buttons, select and
buttons, reachable and leavable by keys. Interaction v48 states every new word; never infer generic styling. No
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
| V4 | `npm test` full suite exits 0. `tests/board-export.test.mjs` proves each group below. Guards as web modules v46 |
| V5 | Team-off `npm run build` and `npm run audit:licenses` exit 0; notices equal runtime notices v1 (team off) |
| V6 | `npm run build:fixtures`, team-on `npm run build` and `audit:licenses` exit 0; team-on notices equal runtime notices v3 |
| V7 | `npm run build:server`, `audit:licenses` and the wrangler dry run exit 0; no deploy |
| V8 | Inspect all hunks plus `git diff --name-status` and `git diff --check` over `<prerequisite-base>..<validated-source>`: only the deliverables, the dispositions above and the append-only Implementation record; no file under `packages/`, `apps/server/` or `supabase/`; `apps/web/src/App.tsx` differs from the base only by web modules v46's six substitutions |
| V9 | The Checks workflow's server suites (Node and workerd) pass on the exact candidate commit; any server check the workflow does not count is listed as not run |
| V10 | N6-S1–N6-S10 pass with the state captures and raw receipts |
| V11 | Design, one receipt per approved screen: local-png ↔ dialog-png (N6-S1); local-jpg ↔ dialog-jpg (N6-S3); local-pdf ↔ dialog-pdf (N6-S4); local-csv and local-no-tables ↔ dialog-csv and no-tables (N6-S5); local-panel and notice-local-nothing ↔ panel and nothing (N6-S6); local-table-tooltip ↔ tooltip (N6-S7); notice-local-smaller ↔ smaller (N6-S8); output-solid and output-grid ↔ the decoded Solid and Grid files of N6-S2; team-stickies, team-no-tables, team-panel and team-viewer ↔ N6-S9's four captures; notice-local-no-stickies ↔ N6-S5's DOM receipt of `There are no stickies to export.`; notice-local-failed and the team notice screens ↔ V4's notice tests (the same notice element and place as the captured ones). The reviewer compares each with the approved design |
| V12 | Once, on an independent b3afc2c source and build with the candidate's `tests/board-export.test.mjs` copied in: its checks and the new browser capability checks fail by name; a top-level setup or import abort does not count |
| V13 | Accepted A–J compare: baseline twice, then candidate and diffs, with existing normalization; only the differences the dispositions allow, each named |
| V15 | Canvas limits: a focused check in macOS's own WebKit browser (through its WebDriver; without that driver the row is recorded as not run, for review) makes and encodes a PNG at 16,384 × 16,384 and at 16,384 × 16,384's area limit; a refusal is a finding, and the fix round sets the measured smaller limits in `board-export.ts` and its tests |
| V14 | Accepted regression runs: the full unit suite (V4), A–J (V13), the 0011-W1 scenario N3 and the 0011-W2 scenario N5 on the candidate, read with the dispositions above. Any row that also fails on b3afc2c is a baseline finding |

`tests/board-export.test.mjs` is self-contained: it builds its own boards and, for the hook and screen parts, its
own harnesses (as the existing tests build theirs), so V12 copies only that file to the baseline. Its checks are
named `X6-U01` onwards. What it proves for V4:
- **Choices:** the defaults; the groups and the disabled `Transparent` per file type; the area shown only with a
  selection; v48's memory (per-type changes kept while open, what Export stores, static `Entire page` storing
  nothing, Cancel, Escape and a native close discarding changes).
- **Included objects:** a selection of each kind (connectors included); a selected section with its stored members;
  the open page only; hidden mind-map branches left out; whole tables, including a table inside a selected section,
  and the table named by a cell, row or column selection counting as none; stickies by `typeForTool("Sticky")`.
- **Size:** the bounds over every included drawn box (a mixed selection with a connector) and the 128 margin;
  `Wp` and `Hp` rounding; the scale fit at each boundary (16,384 per side, 268,435,456 in all, 0.25 steps, 0.5 floor,
  refusal below it); `S` and `R` as written in the notice.
- **Drawing inputs:** `drawExport`'s `BoardDrawing` props (empty selection, no fade, no ghost, `only`, the 2 × 2 size,
  the view putting `(L, T)` at the origin, the `toCanvas` rectangle and ratio) and the root unmounted after a throw;
  `BoardDrawing` and `MindMapLayer` with `only` drawing only included objects and links between two included nodes,
  on the whole page's side (a left-side pair without its root).
- **Grid:** the dot positions (multiples of 16 inside the picture box) and the radius.
- **PDF:** the exact bytes for a given JPEG, pixel size, `W`, `H` and name: the header, objects 1–6 in v48's order,
  each `/Length`, the MediaBox and `cm` with the same numbers (two decimals, no trailing zeros), the 14,400-point
  cap, the image dictionary, `/Producer`, a non-ASCII `/Title` as UTF-16BE with a byte-order mark, every
  cross-reference offset and `startxref`; the JPEG frame check (C0, C1, C2; three components; matching size) and its
  refusal.
- **CSV:** Tables with one table, two tables (one byte-order mark, one empty line between) and `tableCsv`'s bytes
  unchanged; Stickies with the formula rule, quoting, an empty sticky and marks ignored; `csvField` and
  `tableCsvBody`.
- **Rules and notices:** v48's six rules in order with their exact texts, including the 250 ms recheck and the
  5-second limit with a fake clock (a picture of the wrong pixel size counting as not ready), `the page` and `the
  selection`, the inputs frozen at Export, no download after a board switch or a change to viewer, and success leaving
  the notice alone except the lowered-scale text; the JPEG encoder called with 0.92, 0.80, 0.60 and 0.90.
- **File names:** every replaced character, a reserved device name, an empty name.
- **Opening and keys** (with a hook harness for `use-export.ts` and `use-page-keys.ts`): ⇧⌘E only on the canvas
  with exactly Shift and the platform modifier; every row of v48's gate table in order with its default handling;
  the viewer's reason with the default prevented, online and offline; one export at a time; the close sequence and
  refocus (canvas; board name button); Export… `{ shown, disabled }` for every gate row, a local board and a hosted
  owner, editor and viewer; a `keydown` inside an open dialog ignored by the Find, presence, spotlight, reactions and
  comments capture handlers, and the same key outside it handled as before.
- **Screen parts** (rendering to static markup and with a small DOM harness for the dialog's handlers):
  `ExportDialog` closed (nothing) and for each file type (fieldsets and legends, checked and disabled choices, the
  select or the static area, the buttons in order); `showModal()` called once; `cancel` prevented and closing; Tab
  and Shift+Tab wrapping; Return on a radio button, on Export and on Cancel; `BoardPanel` with `Export…`
  right after `Save a copy to file`, hidden when absent or not shown, disabled when disabled; `TableControls` with
  the tooltip `Export as CSV` on both platforms.
- **Download:** the file name, the blob type (`image/png`, `image/jpeg`, `application/pdf`,
  `text/csv;charset=utf-8`) and one object URL revoked after the click.

A regression failure that also fails on b3afc2c is a baseline finding to report, never fixed here.

## Review focus and public references

Review that:
- no export path changes the board, adds an Undo step, sends a hosted edit or touches storage;
- nothing of the selection or the interface reaches a picture: the off-screen drawing gets no selection, no fade
  and no table selection, and the canvas's own drawing is untouched;
- the off-screen root is always unmounted and its element removed, also after a failure, and no stage or canvas
  larger than the output picture is made;
- the scale fit never makes a canvas over the stated limits, and a refusal downloads nothing;
- the PDF's cross-reference offsets are byte-exact for any title;
- viewers cannot reach the dialog by key or by panel;
- App.tsx changes only by the six substitutions; the new hook has no effect; no state hook imports a scene part.

Unresolved after read 2 (the read cap), for the check run and review to confirm:
- whether `flushSync` mounts the Konva stage synchronously in a detached root in Chrome and WebKit (read 1 found
  react-konva 19.3.2 flushes its child reconciler in a layout effect, which `flushSync` runs); if it does not, the
  implementer stops and reports, and does not render the drawing inside the visible app instead;
- whether the WebKit browser accepts a canvas at the stated limits (V15);
- the PDF byte layout and the JPEG frame check against real Chrome and WebKit JPEGs (V4 and N6-S4);
- the module-level stored choices against the one-state-owner rule (web modules v46 names the exception);
- the "Still current" check after a hosted route change or access loss mid-run (V4 hook harness).

The public source basis is main b3afc2c and the linked versioned contracts, read 2026-11-21. No outside product
is needed to implement this contract, and no unresolved product decision is delegated to implementation.

## Exclusions and reasons

- A PDF with selectable text, vector PDF and SVG: later work if wanted.
- A scale or size choice, picture metadata, several pages in one file, remembering choices across reloads.
- Exporting part of a table; a right-click Export selection (no canvas right-click menu exists).
- Repairs to separately tracked baseline failures.

## Implementation record

(Append-only; the implementer adds its source validation here.)
