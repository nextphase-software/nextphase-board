BRIEF VERSION: 0011-W2 v1 (2026-11-20)
# 0011-W2 — Exchange table data using CSV

Status: Draft. Implementation has not started under this brief.

## Outcome and read first

Table data moves in and out of boards, on local and team (hosted) boards alike.
- **In:** spreadsheet data or a CSV file pasted on the board (⌘V / Ctrl+V), a CSV file dropped on the board, or
  files chosen with **Import CSV…** in the board panel each make a **new** table, centred in the view (a drop: at the drop
  point), selected, as one Undo step, with a notice such as `Added a 4 × 3 table.`
- **Out:** copying a table puts its cells on the clipboard as tab-separated text, so a spreadsheet paste fills
  cells; **Export as CSV** (a context-bar button, or ⇧⌘E / Ctrl+Shift+E) downloads the whole table as a UTF-8
  CSV file in which cells starting with `=`, `+`, `-`, `@`, a tab or CR (other than plain numbers) get a leading `'`,
  so no spreadsheet runs them as formulas.
- Malformed or oversized data (over 20 columns, 50 rows, 1,000 characters in a cell, 384 KiB of input, or the
  board's own limits) is refused whole with a notice that names the reason, and the board does not change. Cell content is only ever text: nothing is evaluated, and clipboard HTML is never parsed.
- Viewers of a team board get no Import CSV… and no Export as CSV; their paste of spreadsheet data is refused as
  today, and a CSV drop or file paste now shows the same read-only notice.

Read [AGENTS.md](../../AGENTS.md), [CONTRIBUTING.md](../../CONTRIBUTING.md), [DESIGN.md](../../DESIGN.md)
and these new contract files (prior versions remain untouched):

| Contract | New version / ownership |
| --- | --- |
| [Interaction](../architecture/0001-interaction-v47.md) | v47: spreadsheet data, CSV files, the reader, the refusals, the new table, paste, drop, import, Import CSV…, copy, Export as CSV, looks, keys, hosted boards |
| [Web modules](../architecture/0001-web-modules-v45.md) | v45: one new source module and one test file, the changed web paths, unchanged counts (no new state hook), six App.tsx substitutions |

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

**Design.** The maintainer approved the look on 2026-11-20. Interaction v47 states every value of it: the
Import CSV… button takes the board panel's file-button look, Export as CSV the Table context bar's icon-button
look and tooltip, and the notices are the app's existing notice.

## Deliverables and boundaries

Planning source baseline main **0116263**. Use a fresh milestone worktree and branch from committed main
containing this packet, recording that prerequisite base separately from the behaviour baseline. New source
files carry `SPDX-License-Identifier: Apache-2.0`. Only these files may change, plus the append-only
Implementation record below.

**New (two).**
1. `apps/web/src/table-csv.ts` (web modules v45)
2. `tests/table-csv.test.mjs`

**Changed** (under `apps/web/src/` unless shown).

| # | File |
| --- | --- |
| 3 | `state/use-editing-commands.ts` |
| 4 | `clipboard.ts` |
| 5 | `state/use-page-keys.ts` |
| 6 | `ui/table-controls.tsx` |
| 7 | `ui/context-bar.tsx` |
| 8 | `ui/board-panel.tsx` |
| 9 | `icons.tsx` |
| 10 | `App.tsx` (only the six substitutions of web modules v45) |
| 11 | `apps/web/style.css` (only if a new part needs a rule for v47's look) |
| 12 | `tests/modules.test.mjs` (only the App composition test, as web modules v45 says) |
| 13 | `tests/README.md` (the new test file) |
| 14 | `docs/guides/try-board.md` (two rows, below) |

Type-only changes in other web files are allowed where the compiler needs them, with no behaviour change;
the record lists them. **Every package, the room and the server do not change.**

New tests import the new module dynamically inside their named checks, never at top level, so on the 0116263
baseline each new check fails by name (V12).

**Try-and-test guide.** One row at the end of Part 1's table and one at the end of Part 2's. Nothing else in
the guide changes.

Part 1 (local):

| Feature | Try this | You should see |
| --- | --- | --- |
| [Tables from spreadsheets and CSV](../briefs/0011-W2-table-csv.md) | In a spreadsheet, copy a block of 3 columns and 3 rows holding plain words (no formulas) and press Cmd+V (Ctrl+V) on an empty part of the board. With the new table selected, click Export as CSV in its bar. Open the board panel, choose Import CSV… and pick the file that downloaded. Select one of the tables, press Cmd+C (Ctrl+C) and paste into the spreadsheet. Finally import a CSV file with 60 rows | A 3 × 3 table appears in the middle of the view, selected, with "Added a 3 × 3 table." A file "<board name> table.csv" downloads. The import adds a second table with the same text and "Added a 3 × 3 table from “<board name> table.csv”." The spreadsheet paste fills 3 × 3 cells. The 60-row file gives "Could not import “<file name>”: a table holds at most 50 rows, and this file has 60." and the board does not change |

Part 2 (team mode):

| Feature | Try this | You should see |
| --- | --- | --- |
| [Tables from spreadsheets and CSV on team boards](../briefs/0011-W2-table-csv.md) | Ana (owner), Ben (editor) and Mia (viewer) open the same team board. Ben copies a block of 3 columns and 3 rows in a spreadsheet and presses Cmd+V (Ctrl+V) on the board, then Cmd+Z (Ctrl+Z), then Cmd+Shift+Z (Ctrl+Shift+Z). Mia opens the board panel, then selects the table and presses Cmd+V (Ctrl+V) | Ben sees "Added a 3 × 3 table."; the table appears for Ana and Mia, goes away and comes back. Mia's board panel has no Import CSV…, her table bar has no Export as CSV, and her paste gives the board's read-only notice and changes nothing |

Not allowed:
- a dependency, font, image file, service, service migration or import exception;
- a stored value or saved-format change, a room message, a presence key, a new kind of Undo step;
- a change to a package, the room or the server; a new state hook; App.tsx beyond web modules v45's six
  substitutions; a changed effect count;
- parsing clipboard HTML; evaluating a cell's text; a `;` separator or another encoding; spreadsheet files
  (`.xlsx`, `.numbers`, `.ods`); pasting into existing cells; exporting part of a table; an export dialog;
  stickies as CSV (later milestones).

Outside the named new controls, the existing screens' markup stays exactly as at the base; the reviewer's A–J
comparison allows only the new buttons (V13).

## Required behavior and concrete design

Implement interaction v47 and web modules v45 in full. In particular:

- **Reading:** one reader with a tab (paste) or comma (file) separator; quoted fields only when they start with
  `"`; CRLF, LF or CR line breaks, normalized to LF inside cells; one final line break ignored; short rows
  padded; text kept exactly; line numbers counting breaks inside quotes.
- **Refusals** in v47's order with its exact reason texts and notice frames; nothing changes on refusal.
- **The new table:** built as the Table tool builds one, cells set, rows grown; centred on the view centre
  (paste, Import CSV…) or the drop point; several tables cascade 24 right and 24 down; one commit, one Undo step,
  one hosted edit; selected; the notices exactly as v47 words them.
- **Routing:** interaction v47's routing table, one route per event: CSV files first (paste and drop), files
  without a CSV file and every blocked text paste to today's handler, spreadsheet data that is not Board's own copy
  (the copy record with its own id and write state) to a new table. The data-exchange reason never uses Board's
  object clipboard.
- **Batches:** board, page and anchor fixed when the batch starts; files read asynchronously; the live board
  rechecked (editability, rules 13–15) just before the single commit; the success notice only when it took.
- **Copy:** tables' tab-separated text in the copied text, quoting only cells with a tab, LF, CR or `"`.
- **Export as CSV:** one rule for the button and the key; the button after Add column (icon stroke 1.6) with the
  platform tooltip; ⇧⌘E / Ctrl+Shift+E with one table selected; the file name rule; byte-order mark, comma, CRLF
  after every row, the formula rule (ASCII number pattern) before quoting; no notice.
- **Import CSV…** last in the board panel's file buttons, hidden for hosted viewers, disabled while the
  data-exchange reason is not empty; several files at once; a non-empty choice closes the panel, cancel does not.

## Shared-path check dispositions

This inventory authorizes expectation changes, not additional historical runs.

| Shared path / older checks | Disposition |
| --- | --- |
| `tests/clipboard.test.mjs` (including the empty-clipboard `Nothing to paste.` assertion and the delayed clipboard-write check), `tests/images.test.mjs` (paste target and already-handled events, blocked drops, image paste and drop), `tests/strokes.test.mjs` | Unchanged; they must pass as written: object Copy, Paste and their refusals, image paste and drop keep their behaviour, and none of them copies a table |
| `tests/pages.test.mjs` page-isolated Copy and Paste (around line 270), `tests/connectors.test.mjs` connector-only Copy and Cut refusal (around line 458), `tests/page-links.test.mjs` clipboard isolation of Copy link to page (around line 402) | Unchanged; they must pass as written |
| `tests/tables.test.mjs` (T-U12 and the other table checks) | Unchanged; they must pass as written: T-U12 lists the canvas add bars, not the context bar |
| `tests/modules.test.mjs` App composition | Renamed "0011-W2 App composition" with the six substitutions of web modules v45 added after 0011-W1's; every other module check (counts, effects, imports, team list) unchanged and must pass |
| Unit tests rendering `TableControls` or `BoardPanel` and listing their buttons | None found at 0116263; any such test keeps its list with `Export as CSV` after `Add column` and `Import CSV…` last in the file buttons |
| The 0011-W1 scenario N3 | Rerun under V14 only, as written: its bar checks look for each named button and stay true with `Export as CSV` added, and N3-Identity's table Copy and Paste in one tab is Board's own copy, so it keeps its result. Read with this brief, N3-S1's bar list is `Table`, Text size `Medium`, `Add row`, `Add column`, `Export as CSV`, Arrange, Duplicate, Delete |
| Object Copy and Paste checks for sections, shapes, connector styles, washi tape and mind maps (their unit tests and earlier scenarios) | Unchanged; they keep their results: Board's own copy still pastes as objects |
| The 0001-W11 browser checks (copy and paste board objects): the delayed clipboard-write rejection and "the system clipboard is ignored" | Not rerun. The delayed rejection keeps its result (the copy record only adds ids). "System clipboard ignored" keeps its result for ordinary outside text; outside **spreadsheet data** (a tab, or a table in the HTML) now makes a table, so such a check uses text without a tab |
| Earlier scenario tools for image paste and drop, and board files | Not rerun. When run they keep their results: image-only clipboards and drops go to today's handler; the board-file keyboard check reaches `Open board file…` and then one more stop (`Import CSV…`) before the rows, so its Tab count is one higher; the board panel keeps its order with `Import CSV…` after `Open board file…` |
| The 0006-W4 Trash scenario's hosted board-panel geometry | Not rerun. For owners and editors the panel is 52 px taller and every button after `Save a copy to file` sits 52 px lower; viewers' panel is unchanged |
| Historical check tools (earlier scenario tools) | Not rerun except the regression runs named under validation |
| Local shell: A–J | Only differences allowed: the new `Import CSV…` button in a board-panel checkpoint and `Export as CSV` in a Table context-bar checkpoint, if A–J shows either; the check run names each differing checkpoint and its cause |

The record lists every changed line range under `tests/`.

## Browser checks

New scenario **N5-S1–N5-S10**. N5 was unused in existing public briefs when allocated. A fresh, independent
check run writes its tool from these clauses and the contract values. Each row prints its full ID, `PASS:`
or `FAIL:` and a summary, and keeps raw receipts and unrun rows.

Setup: 1440 × 900, scale 1, macOS Chrome, US keyboard layout, clipboard read and write permission granted to
the app's origin. Rows N5-S1–N5-S7 on the local app (single-user mode), **each starting from a fresh Fixture L**
in a new browser context unless the row says otherwise; rows N5-S8–N5-S10 on the local team stack started from
the candidate on its own uniquely owned local Supabase project, with Ana (owner), Ben (editor) and Mia (viewer)
each in their own browser context. A **clipboard paste** brings the actor's page to the front, writes the system
clipboard with `navigator.clipboard.write` (a `ClipboardItem` with the named `text/plain` and, where named,
`text/html` values) and awaits it, clicks empty canvas at screen (1100, 700), then presses the real ⌘V. A
**drop** dispatches `dragenter`, `dragover` and `drop` on the canvas at the named screen point with a
`DataTransfer` holding the named files. A **file choice** answers the file chooser that Import CSV… opens.
Downloads are caught by the browser driver. Objects are identified through the Objects panel or by their drawn
positions, never by DOM painted for the check. Use real pointer and key events otherwise. New capability rows
also fail by name on the independent baseline 0116263. Colours and sizes exactly as interaction v47. "Within
3 s" means the change shows within 3 seconds. Save a real-state image for N5-S1, N5-S3, N5-S5, N5-S6, N5-S8,
N5-S9 and N5-S10.

**Fixtures.**
- **Fixture L** (local): a new board named `CSV check`, one sticky `Note` at (−600, −300), saved
  (`Locally saved`), view 100 % centred at (0, 0), nothing selected, no table.
- **Sheet data** (4 columns, 3 rows): `text/plain` =
  `Task⇥Owner⇥Note⇥Cost⏎Book venue⇥Ana⇥"Line one⏎line ""two"""⇥-5⏎Order lunch⇥⇥=SUM(1,2)⇥@team` (⇥ tab,
  ⏎ LF, no final line break) and `text/html` = `<table><tr><td>x</td></tr></table>`.
- **Guide data** (3 columns, 3 rows, no formula-like cell): `text/plain` = `A1⇥B1⇥C1⏎A2⇥B2⇥C2⏎A3⇥B3⇥C3` and the
  same `text/html` as Sheet data.
- **File `tasks.csv`**: the bytes EF BB BF, then
  `Task,Owner,Note,Cost␍␊Book venue,Ana,"Line one␍␊line ""two""",-5␍␊Order lunch,,"=SUM(1,2)",@team␍␊`
  (␍␊ CRLF). Its expected cells equal Sheet data's (the line break inside the quoted cell stored as LF).
- **Fixture T** (team): the guide's Part 2 seed (Example team with Ana as owner, Ben as editor, Mia as viewer)
  and sign-in steps; Ana chooses Home › New board, sets Board name to `CSV team` and adds a second page `Later`
  (so the hosted table bar shows Move to page); everyone opens the board on the first page; every context at
  100 % centred at (0, 0).

| ID | Scriptable behavior and expected result |
| --- | --- |
| N5-S1 | Fixture L. Clipboard paste of Sheet data: one new table, 4 columns × 3 rows, columns 192, its drawn box centred on the view centre within 1 unit, the whole table selected, the tool Select; every cell's text equals the expected cell (`Line one⏎line "two"` in row 2, column 3; `=SUM(1,2)` and `@team` as text; row 3, column 2 empty); row 2 grown to fit two lines; the notice (`.notice[role="status"]`) reads `Added a 4 × 3 table.` Capture added now. Then ⌘Z removes the table (`Note` unchanged) and ⇧⌘Z brings it back with the same table, row and column ids |
| N5-S2 | Each part starts from a fresh Fixture L. (a) Clipboard paste of `text/plain` `a⇥b⏎c⇥d` with no `text/html`: a new 2 × 2 table. (b) Clipboard paste of `one⏎two` with `text/html` `<TABLE class="x"><tr><td>one</td></tr></TABLE>`: a 1 × 2 table. (c) Select `Note`, ⌘C, click empty canvas, ⌘V: `Pasted 1 object.` and no table is added. (d) Clipboard paste of `a⇥b⏎c⇥d`, then select that table and `Note` together (Shift-click), ⌘C: the clipboard `text/plain` is exactly `Note⏎⏎a⇥b⏎c⇥d`; ⌘V adds 2 objects (`Pasted 2 objects.`), not a table from text. (e) Clipboard paste of Sheet data, select the table, ⌘C: the clipboard text equals Sheet data's `text/plain` exactly |
| N5-S3 | Fixture L. Click the board name: the board panel shows `Save a copy to file`, `Open board file…`, `Import CSV…`, `Reopen` in that order, each 250 × 40, 12 apart. Capture import (the panel). Choose Import CSV… and cancel the chooser: the panel stays open and nothing changes. Choose it again and answer with `tasks.csv`: the panel closes, a 4 × 3 table's drawn box is centred on the view centre with N5-S1's cells exactly, selected, and the notice reads `Added a 4 × 3 table from “tasks.csv”.` One ⌘Z removes it |
| N5-S4 | Fixture L. Drop `tasks.csv` and `photo.png` (any 1 × 1 PNG) at screen point (1000, 600): one 4 × 3 table whose drawn box is centred on the board point under (1000, 600) within 1 unit, no image added, and the notice reads `Added a 4 × 3 table from “tasks.csv”. Could not import “photo.png”: it is not a CSV file.` ⌘Z removes it. Drop `tasks.csv` and a copy named `more.csv` at the same point: two tables, the second's drawn box 24 right and 24 down of the first's, both selected, `Added 2 tables.`; one ⌘Z removes both. A drop of only `photo.png` behaves as today (an image is added). Then a `paste` event whose `clipboardData` holds the file `tasks.csv`, dispatched on the mounted canvas element: one more 4 × 3 table centred on the view centre and `Added a 4 × 3 table from “tasks.csv”.` A CSV dropped onto the selected table's add bar is imported the same way (not refused as an image) |
| N5-S5 | Fixture L; clipboard paste of Sheet data, then click empty canvas and click the table's outline to select the whole table. The bar reads `Table`, Text size `Medium`, `Add row`, `Add column`, `Export as CSV`, Arrange, Duplicate, Delete, centred on the table; the Export button is 40 × 40, 4 after Add column; hovering it shows `Export as CSV ⇧⌘E` and the hover look. Capture export (tooltip showing). Click it: one download named `CSV check table.csv` whose bytes are exactly EF BB BF + `Task,Owner,Note,Cost␍␊Book venue,Ana,"Line one⏎line ""two""",-5␍␊Order lunch,,"'=SUM(1,2)",'@team␍␊` (the cell line break LF); the board, the Undo button, the save state and the notice text (`Added a 4 × 3 table.`) are unchanged. Click one cell of the table and press ⇧⌘E: the same file again. Click `Note` and press ⇧⌘E: no download. Import the downloaded file with Import CSV…: a 4 × 3 table whose cells equal N5-S1's except `'=SUM(1,2)` and `'@team` |
| N5-S6 | Fixture L (no table cells). Refusals, each leaving the board's objects, the Undo button and the save state unchanged with no download: Import CSV… with a file of 21 columns (each field `x`) → `Could not import “wide.csv”: a table holds at most 20 columns, and this file has 21.`; 51 rows of `x` → `Could not import “long.csv”: a table holds at most 50 rows, and this file has 51.` (capture rejected); one cell of 1,001 `x` in row 2, column 1 → `Could not import “big-cell.csv”: a cell holds up to 1,000 characters, and row 2, column 1 has 1,001.`; `a,b␍␊c,"d␍␊e,f␍␊` → `Could not import “open.csv”: line 2 has a quote that is not closed.`; `"a"b,c` → `Could not import “after.csv”: line 1 has text after a closing quote.`; an empty file → `Could not import “empty.csv”: it holds no text.`; the bytes `61 FF 62` → `Could not import “latin.csv”: the file is not UTF-8 text.`; a 393,217-byte file → `Could not import “huge.csv”: the file is larger than 384 KiB.`; clipboard paste of `a⇥"b⏎c` → `Could not paste the table: line 1 has a quote that is not closed.` Then choose five files of 20 × 50 at once, each with `x` in every cell: five tables, `Added 5 tables.`, one new Undo step; note that state. Import `tasks.csv` → `Could not import “tasks.csv”: a board holds at most 5,000 table cells, and this table would bring it to 5,012.` and the board equals the noted state |
| N5-S7 | Fixture L, keys only. Focus the board name button and press Return: the panel opens; Tab to `Open board file…`, Tab to `Import CSV…`, Return: the chooser opens; cancel it; Escape (focus returns to the board name button). Write Sheet data to the clipboard, Tab or Shift+Tab until the canvas has focus, and press ⌘V there: the table is added with the whole table selected. Tab through the context bar from `Add column`: the next stop is `Export as CSV` (accessible name `Export as CSV`), with the focus-visible look and its tooltip. Each new notice in N5-S1–N5-S6 was the `.notice[role="status"]` element's text |
| N5-S8 | Fixture T. Ben makes a clipboard paste of Sheet data: Ben sees `Added a 4 × 3 table.` and the table selected; within 3 s Ana and Mia see the same table (same cells) at the same place, with no notice. Ben hovers Export as CSV: capture team-added (Ben; the bar also shows Move to page). Ben presses ⌘Z: within 3 s the table is gone for all three; ⇧⌘Z: back for all three. Ana opens the board panel: `Import CSV…` after `Save a copy to file`, before `Show version history`. Capture team-import (Ana). Ben then dispatches a `paste` event whose `clipboardData` holds the file `tasks.csv` on his mounted canvas element: a second table, `Added a 4 × 3 table from “tasks.csv”.`, seen by Ana and Mia within 3 s |
| N5-S9 | Fixture T with N5-S8's table (on the baseline, where N5-S8 cannot make it, Ben makes the same 4 × 3 table with the Table tool and the cell editor, so this row fails at Mia's copy or CSV-drop assertion, not in setup). Mia opens the board panel: no `Import CSV…`; she closes it. Mia selects the table: the bar reads `Table` only (no Export as CSV); ⇧⌘E does nothing. Mia makes a clipboard paste of Sheet data: the notice reads `Read-only: editing commands are unavailable.` (as on the baseline) and no table is added for anyone. Mia selects the table and presses ⌘C (the notice changes to the copy notice); she drops `tasks.csv` at screen (1000, 600): the notice now reads `Read-only: editing commands are unavailable.` and all three boards are unchanged. The clipboard text from her ⌘C is Sheet data's `text/plain`. Capture viewer (Mia) |
| N5-S10 | Fixture T. Ben makes a clipboard paste of `a⇥b⏎c⇥"d⏎e`: Ben sees `Could not paste the table: line 2 has a quote that is not closed.`; within 3 s Ana's and Mia's boards are unchanged. Capture team-rejected (Ben). Then both guide rows (Part 1, Part 2) walked as written, with Guide data as the spreadsheet's clipboard and the step "paste into the spreadsheet" checked as a readback of the clipboard's nine tab-separated fields: each `You should see` holds |

## Acceptance criteria

- **0011-W2-AC01:** On single-user and team boards, an owner or editor makes a new editable table from
  spreadsheet data or a CSV file pasted with ⌘V / Ctrl+V, a CSV file dropped on the board, or Import CSV…. It lands centred in
  the view (a drop: at the drop point), selected, as one Undo step, with the stated notice; others on a team board
  see it. Cell text matches the source exactly under interaction v47's reading rules.
- **0011-W2-AC02:** Copying a table puts its cells on the clipboard as tab-separated text. Export as CSV and
  ⇧⌘E / Ctrl+Shift+E download the whole table with v47's encoding, separator, line-end, quoting and formula
  rules. Viewers get neither Import CSV… nor Export as CSV. Look and placement match the approved design.
- **0011-W2-AC03:** Malformed or oversized data is refused whole with a notice naming the reason, and the board
  is unchanged. No cell content is ever evaluated, and clipboard HTML is never parsed.

| Criterion | Evidence that shows it |
| --- | --- |
| 0011-W2-AC01 | N5-S1, N5-S2, N5-S3, N5-S4, N5-S8; V4 |
| 0011-W2-AC02 | N5-S2, N5-S5, N5-S7, N5-S9; V4 |
| 0011-W2-AC03 | N5-S6, N5-S10; V4 |

## Applicable DESIGN.md guardrails

Canvas-first shell, native controls and visible focus, minimum action hits, protected native editing and
independent state owners apply. Import CSV… is a native button and Export as CSV a native icon button, both
reachable by keys. Interaction v47 states every new word; never infer generic styling. No new sound, font or
image file.

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
| V4 | `npm test` full suite exits 0. `tests/table-csv.test.mjs` proves each group below. Guards as web modules v45 |
| V5 | Team-off `npm run build` and `npm run audit:licenses` exit 0; notices equal runtime notices v1 (team off) |
| V6 | `npm run build:fixtures`, team-on `npm run build` and `audit:licenses` exit 0; team-on notices equal runtime notices v3 |
| V7 | `npm run build:server`, `audit:licenses` and the wrangler dry run exit 0; no deploy |
| V8 | Inspect all hunks plus `git diff --name-status` and `git diff --check` over `<prerequisite-base>..<validated-source>`: only the deliverables, the dispositions above and the append-only Implementation record; no file under `packages/`, `apps/server/` or `supabase/`; `apps/web/src/App.tsx` differs from the base only by web modules v45's six substitutions |
| V9 | The Checks workflow's server suites (Node and workerd) pass on the exact candidate commit; any server check the workflow does not count is listed as not run |
| V10 | N5-S1–N5-S10 pass with the state captures and raw receipts |
| V11 | Design: the captures of N5-S1, N5-S3, N5-S5, N5-S6, N5-S8, N5-S9 and N5-S10 show every look interaction v47 states, and the reviewer compares them with the approved design |
| V12 | Once, on an independent 0116263 source and build with the candidate's `tests/table-csv.test.mjs` copied in: its checks and the new browser capability checks fail by name; a top-level setup or import abort does not count |
| V13 | Accepted A–J compare: baseline twice, then candidate and diffs, with existing normalization; only the differences the dispositions allow, each named |
| V14 | Accepted regression runs: the full unit suite (V4), A–J (V13) and the 0011-W1 scenario N3 (0011-W1 brief) on the candidate, as written (the dispositions explain N3-S1's bar list). Any row that also fails on 0116263 is a baseline finding |

`tests/table-csv.test.mjs` is self-contained: it builds its own boards and, for the hook and screen parts, its
own harnesses (as the existing tests build theirs), so V12 copies only that file to the baseline. Its checks are
named `X5-U01` onwards. What it proves for V4:
- **Detection:** spreadsheet data with a tab; with `<table>` / `<TABLE ...>` HTML and no tab; not for empty
  plain text, plain text without a tab and HTML without a table; CSV files by name (any case) or type.
- **Reader:** both separators; quoted commas, tabs, line breaks and doubled quotes; a `"` inside an unquoted
  field kept; CRLF, LF and CR; CRLF and CR inside a quoted cell stored as LF; one final line break ignored, a
  second giving an empty last row; padding; the byte-order mark removed; text kept exactly (spaces, `'`, `=`).
- **Refusals:** every v47 rule in order (1–15) with its exact reason and line number (including line numbers after
  a quoted line break and the first syntax error in scan order), the first failing field's row and column, the
  comma in four-digit numbers, the 384 KiB single and batch rules, the 5,000-cell, 250-object and 2 MiB rules
  counting all pages and the items accepted earlier in the same batch (clipboard files included), rule 15 on an
  unnamed board (measured, not refused), rule 16's estimate against the real encoded hosted edit (built with the
  sync package's adapter on a test document) for at least: five 20 × 50 tables of 76 ASCII characters per cell
  (about 385 KB of input, a real edit over 1 MiB: refused by rule 16 before any edit), one 20 × 50 table at the
  384 KiB limit, and 5,000 single-character cells — the estimate is never below the real edit size, `Clipboard file` for
  an empty name, exactly one byte-order mark removed, and the three notice frames with curly quotes, three names
  and ` and K more`.
- **New tables:** the document table creation's sizes, fresh ids and text size; non-empty cells only; the row
  growth with the passed measure; the drawn box centred on the anchor plus (24 i, 24 i) before rounding and
  `boundTable(table, drawnHeight)` (a table whose drawn height exceeds its saved height, near the lower board edge); section membership and stacking order from `placeObject` on the saved box; one board in, one board
  out with nothing else changed.
- **Writers:** the tab-separated text (quoting only tab, LF, CR, `"`; no formula rule; no final line break); the
  CSV bytes (byte-order mark, CRLF after every row, the formula rule before quoting `,` `"` CR LF, the formula
  rule on `=`, `+`, `-`, `@`, tab and CR, the ASCII number pattern leaving `-5`, `+3.2`, `.5`, `1e3` and `-2.5E-3`
  alone and prefixing `-1.`); the file name rule; the round trip and each of v47's stated exceptions.
- **Copy text:** `plainText` with a table alone, a table among stickies in object order, an empty table.
- **Routing and batches** (with a hook harness for `use-editing-commands.ts`): every row of v47's routing table,
  including clipboard files with and without a CSV file, PNG plus tab-separated text, and each blocked state (the
  data-exchange reason never `Nothing to paste.`); the copy record (own id; pending, written and refused; a late
  settlement of an older request not changing a newer record); one `commit(next, true)` per batch; the batch's
  anchor kept across a pan during reading; a batch dropped with no notice when the board or the open page changes or
  the board turns read-only before it settles; the two phases (an item refused at acceptance not charging bytes,
  budgets or the cascade); rules 3 and 13–16 against the live board; voting mode routing to today's handler and
  disabling Import CSV… and Export; the Import CSV… button shown for a hosted editor who is offline or previewing
  and hidden for a viewer; the success notice only when the
  commit took; the panel closing on a non-empty choice and staying open on cancel.
- **Screen parts** (rendering to static markup): `TableControls` Table mode with `Export as CSV` after `Add
  column` and the macOS and other tooltips, and no button without `exportTable` or when read-only; `BoardPanel`
  with `Import CSV…` last, hidden when not shown and disabled when disabled.
- **Export rule and keys:** one rule for the button and ⇧⌘E / Ctrl+Shift+E (one table selected; not read-only,
  composing, busy or waiting for Tidy up; independent of row and column capacity); the key only on the canvas
  with exactly Shift and the platform modifier, `preventDefault()` only after an export.

A regression failure that also fails on 0116263 is a baseline finding to report, never fixed here.

## Review focus and public references

Review that:
- clipboard HTML is only tested for `<table`, never parsed, and no cell text reaches a formula, HTML or URL
  handler;
- a refusal changes nothing (no commit, no Undo step, no hosted edit), and a successful paste, drop or choice is
  exactly one commit and one Undo step;
- Board's own copy still pastes as objects (the copy record with ids), and image paste and drop keep their
  behaviour;
- the 384 KiB input rules keep one batch's hosted edit under the 1 MiB message limit, and the 2 MiB board rule is
  checked before commit;
- files are read asynchronously but added only if the same board is still open and editable;
- Export as CSV and ⇧⌘E never change the board and are unreachable for viewers;
- App.tsx changes only by the six substitutions, and no new state hook or effect appears.

Unresolved after read 2 (the read cap), for the check run and review to confirm:
- rule 16's edit estimate (128 bytes per cell plus 64 KiB): the unit test must show it bounds the real encoded
  edit for the named batches; if it does not, the implementer stops and reports, not changes the constants;
- the success notice on a hosted board shows on local apply, as other hosted edits do; a later room refusal is
  left to the session's existing path;
- drops on canvas parts (handles, add bars) reach the CSV route, and image-only drops stay unchanged;
- voting mode leaves every table route inactive.

The public source basis is main 0116263 and the linked versioned contracts, read 2026-11-20. No outside
product is needed to implement this contract, and no unresolved product decision is delegated to
implementation.

## Exclusions and reasons

- Pasting into existing cells, copying or exporting part of a table, and an export dialog: later milestones.
- Stickies as CSV, converting a table to stickies, spreadsheet files and other separators or encodings.
- Repairs to separately tracked baseline failures.

## Implementation record

(Append-only; the implementer adds its source validation here.)
