BRIEF VERSION: 0010-W2 v1 (2026-11-15)
# 0010-W2 — Organize a board into pages

Status: Draft. Implementation has not started under this brief.

## Outcome and read first

A local board can hold several **pages**, each with its own canvas. A **Pages** button in the file bar
opens the list of pages: open a page by clicking it, add one with **+** (then type its name), rename by
double-clicking, reorder by dragging or with Move up and Move down, and duplicate or delete a page from
its "…" menu (deleting does not ask; Undo restores it). **Move to page** in the selection bar moves the
selected objects to the same place on another page; connectors to objects left behind are removed, as
Delete removes them. Find searches every page and opens the page of the result it steps to; the
Navigation panel lists the open page's sections. Pages are saved with the board (document version 13)
and in board files, every page step is one Undo step, and the board reopens on the last page opened in
this browser. Team (hosted) boards keep exactly one page and show none of this.

Read [AGENTS.md](../../AGENTS.md), [CONTRIBUTING.md](../../CONTRIBUTING.md),
[DESIGN.md](../../DESIGN.md) and these three new contract files (prior versions remain untouched):

| Contract | New version / ownership |
| --- | --- |
| [Document](../architecture/0001-document-v18.md) | v18, schema **13**: `pages`, each object's `page`, the four one-page reference rules, limits, reading versions 1–12, hosted boards with exactly one page, the version references of other contracts, the adapter |
| [Interaction](../architecture/0001-interaction-v43.md) | v43: the open page, opening a page and each page's view, the remembered page, the Pages button and list, the name field, the page menu, reordering, duplicate and delete, Move to page and the moved set, Undo and Redo, find with several pages, the Navigation panel's heading, hosted boards, looks and words |
| [Web modules](../architecture/0001-web-modules-v41.md) | v41: four new source modules and two test files, the counts, the rules package, sync, room and server changes, the web paths that create objects, the App.tsx substitutions and the seams |

Use this set wherever inherited contracts link a replaced version. Unchanged except for the version
numbers document v18 rewrites: [storage v3](../architecture/0001-storage-v3.md),
[board file v4](../architecture/0006-board-file-v4.md) (fileVersion 2), [sync v13](../architecture/0003-sync-v13.md),
[hosted persistence v10](../architecture/0003-hosted-persistence-v10.md),
[hosted storage v11](../architecture/0003-hosted-storage-v11.md), [board lifecycle v5](../architecture/0006-board-lifecycle-v5.md),
[API v12](../architecture/0003-api-v12.md), [team templates v1](../architecture/0008-team-templates-v1.md),
[activity catalogue v1](../architecture/0008-activity-catalogue-v1.md). Unchanged:
[presence v4](../architecture/0004-presence-v4.md), [access v13](../architecture/0003-access-v13.md),
[toolchain v5](../architecture/0001-toolchain-v5.md), [lock v5](../architecture/0001-dependency-lock-v5.json),
[inventory v5](../architecture/0001-dependency-inventory-v5.json) and
[runtime notices v3](../architecture/0001-runtime-notices-v3.txt). Room layout 7 and the 17 service tables
remain: no schema migration, no new table or column.

Build directly; no prototype or scenario tool is an input. Prove the stated values with focused
tests, followed by independent checks. Report a contract conflict before dependent work.

**Design.** The maintainer approved the look on 2026-11-15; interaction v43 states every value of it
(colours, sizes, shapes, spacing, positions, words). The approved design draws the new parts in Plus
Jakarta Sans; no font file is added, so the build shows the stack's fallback face, which is accepted.

## Deliverables and boundaries

Planning source baseline main **076f82e**. Use a fresh milestone worktree and branch from committed
main containing this packet, recording that prerequisite base separately from the behaviour baseline.
New source files carry `SPDX-License-Identifier: Apache-2.0`. Only these files may change, plus the
append-only Implementation record below.

**New (six).** 1. `apps/web/src/pages.ts`; 2. `apps/web/src/state/use-pages.ts`;
3. `apps/web/src/ui/pages-panel.tsx`; 4. `apps/web/src/ui/move-to-page.tsx` (all as web modules v41);
5. `tests/pages.test.mjs`; 6. `tests/server/pages.test.ts` (S411–S416 below).

**Changed: packages and server.** 7. `packages/board-rules/src/document.ts`;
8. `packages/board-rules/src/objects/registry.ts`; 9. `objects/stroke.ts`; 10. `objects/image.ts`;
11. `objects/tape.ts` (and `objects/shape.ts` only if its version default must name 13);
12. `packages/board-sync/src/codec.ts`; 13. `packages/board-sync/src/document-adapter.ts`;
14. `packages/board-room/src/room.ts`; 15. `packages/board-room/src/edits.ts`;
16. `packages/board-room/src/history.ts`; 17. `apps/server/src/routes/boards.ts`;
18. `apps/server/src/templates.ts`. Type-only renames (`BoardV12` to the version 13 type) in other
package, server and web files are allowed where the compiler needs them, with no behaviour change; the
record lists them.

**Changed: web** (under `apps/web/src/`). 19. `App.tsx` (only the substitutions of web modules v41);
20. `storage.ts`; 21. `board-file.ts`; 22. `history.ts`; 23. `clipboard.ts`; 24. `connectors.ts`;
25. `strokes.ts`; 26. `tape.ts`; 27. `images.ts`; 28. `mind-map.ts`; 29. `activities.ts`;
30. `find.ts`; 31. `state/use-find.ts`; 32. `state/use-board-document.ts` (only as history needs);
33. `state/use-geometry-edits.ts`; 34. `state/use-canvas-input.ts`; 35. `state/use-editing-commands.ts`;
36. `team/templates-rules.ts`; 37. `ui/file-bar.tsx`; 38. `ui/context-bar.tsx`; 39. `ui/notice.tsx`;
40. `ui/navigation-panel.tsx`; 41. `ui/find-bar.tsx`; 42. `icons.tsx`; 43. `apps/web/style.css`;
48. `sections.ts`; 49. `state/use-images.ts`; 50. `state/use-tidy-up.ts`; 51. `ui/stroke-controls.tsx`
and 52. `ui/connector-controls.tsx` (only a slot for Move to page before Delete); all as web modules v41.
Other files under `apps/web/src/` may change only where they create objects, look up sections or drop
targets, or commit a board, to make that page-aware while committing the whole board, or to receive the
open page's objects instead of the whole board (web modules v41, App substitutions); the record lists
each with its reason.

**Changed: tests and guide.** 44. `tests/modules.test.mjs` (counts and the App test of web modules
v41); 45. `tests/README.md` (the two new files); 46. the version-13 fixture updates under **Shared-path
check dispositions**; 47. `docs/guides/try-board.md` (Part 1, below); 53. `vitest.node.config.ts` and
54. `vitest.workerd.config.ts` (only adding `tests/server/pages.test.ts` to each `include` list). New web tests import the new
modules dynamically inside their named checks, never at top level, so on the 076f82e baseline each new
check fails by name (V12).

**Try-and-test guide (Part 1, single-user).** Add this row right after the "Find and navigate" row;
nothing else in the guide changes:

| Feature | Try this | You should see |
| --- | --- | --- |
| [Pages](../briefs/0010-W2-organize-a-board-into-pages.md) | Add three stickies saying "budget", "plan" and "notes", and click Save. Click Pages (beside the board name), then **+**, type "Ideas" and press Return. Click "Page 1" in the list, select the "budget" and "plan" stickies and choose Move to page (in the selection bar), then "Ideas". Click "Go to Ideas" in the notice. Open Pages and click "Page 1"; press Cmd+F (Ctrl+F), type "budget" and press Return. Press Escape, open Pages, choose "…" on Ideas, then Delete page, then click the board and press Cmd+Z. Click Save and wait for "Locally saved", then reload the page | The list shows Page 1 and Ideas, with Ideas open and empty. The two stickies leave Page 1 and the notice offers "Go to Ideas"; on Ideas they sit where they were. On Page 1 find counts "– of 1"; Return opens Ideas with "budget" ringed and "On page “Ideas”" under the counter. Deleting Ideas removes it and its stickies with a notice; Cmd+Z brings both back and opens Ideas. After the reload the board opens on Ideas |

Not allowed: a dependency, font, image file, service, import exception, database migration, new table or
column, stored value other than the remembered page, state hook or screen part beyond web modules v41,
or any change to presence, comments, voting, the timer, reactions or spotlight.

Outside the named new controls, the existing screens' markup stays exactly as at the base: the
reviewer's A–J comparison allows only the masks listed under validation.

## Required behavior and concrete design

Implement document v18, interaction v43 and web modules v41 in full. In particular:

- **Document.** Version 13 with `pages` and `page`; the page rules (1–50 pages, UUID ids distinct from
  object ids and generations, 1–60 code-point trimmed names); `page` right after `type` in every key
  order; the four one-page reference rules; upgrade of versions 1–12 to one default page whose id is the
  `boardId`; new boards with the default page; canonical order.
- **Hosted.** One page always: new and upgraded rooms get the default page; an edit changing `pages`, or
  an import, create or restore without exactly one page, is refused `invalid_document`; templates wrap as
  version 13 and stored template objects never carry `page`. No Pages button or Move to page on hosted
  boards; find and the panel as in v42.
- **The open page.** Drawing, hits, dots, selection, Select all, the bars, the Objects panel, Tidy up,
  fits, sections and placing work on the open page; new objects on the open page; every edit on the whole
  board, so other pages never change by an edit made on this one. Opening a page: text edit ended,
  selection cleared, popups closed, per-page view (first open: fit, or 100% at the origin when empty;
  the page a board opens on keeps today's opening view), the remembered page in `localStorage`, never an
  edit.
- **Pages button and list.** Exact placement, sizes, colours, words, keys, focus, outside-pointer and
  Escape closing; Add page (`Page <n>`, opens it, the name field); the name field's keep and cancel
  rules; the page menu's items, separators and disabled states with their tooltips; Move up, Move down
  and dragging with the 4 px threshold, the drop line and cancelling; Duplicate page (`<name> copy`,
  copies with remapped references, opens it, the notice, the 50-page and 250-object limits); Delete page
  (no confirmation, the page before opens, the notices).
- **Move to page.** Only with two or more pages on a local board; the button before Duplicate (or
  Delete) in every selection-bar variant, its open look and menu with `This page`; the moved set
  (Duplicate's set grown by whole mind maps, whole groups, section members and both-ended connectors,
  less half-selected connectors); moving keeps ids, positions and order, clears sections left behind,
  deletes connectors with one end moved; the notices and the Go to button.
- **Undo and Redo.** One step per page step; each step remembers its open page (its step page); Undo and
  Redo apply the step, then open the fallback page if the open page is gone, then the step page;
  Unsaved after each page step; Save saves every page.
- **Find.** Every page's displayed objects; page order then reading order; first current result on the
  open page (else none); Next and Previous across pages; opening a result's page; rings and fading on
  the open page; the `On page “…”` line only with two or more pages.
- **Navigation panel.** `Sections on this page` only with two or more pages; the open page's sections and
  fits.

## Shared-path check dispositions

This inventory authorizes expectation changes, not additional historical runs.

| Shared path / older checks | Disposition |
| --- | --- |
| Version-13 fixtures: every test file under `tests/` (and `tests/server/`) whose fixture builds or expects a version 12 board, document or object, a canonical key order, the newest version, or a newer-than-current version (12 + 1 becomes 13 + 1), including `tests/import-fixture.mjs`, `shared-editing.test.mjs`, `tidy-up.test.mjs`, `tape.test.mjs`, `transition.test.mjs`, `board-catalog.test.mjs`, `server/suite.test.ts` and `tests/board-file.test.mjs`, `board-history.test.mjs`, `board-lifecycle.test.mjs`, `connector-styles.test.mjs`, `connectors.test.mjs`, `document.test.mjs`, `images.test.mjs`, `mentions.test.mjs`, `mind-map.test.mjs`, `shape-kinds.test.mjs`, `shapes.test.mjs`, `storage.test.mjs`, `strokes.test.mjs`, `team-import.test.mjs`, `team-templates.test.mjs`, `workshop-reactions.test.mjs`, `workshop-spotlight.test.mjs`, `workshop-voting.test.mjs`, `tests/codec.test.mjs`, `tests/room.test.mjs`, and `tests/server/drawing-layout.test.ts`, `history.test.ts`, `lifecycle.test.ts`, `mind-maps.test.ts`, `shared.test.ts`, `templates.test.ts` | Where a fixture builds a version 12 board, document or object for a path that now writes, serves or requires version 13, it becomes version 13 with the default page (`pages: [{ id: <boardId>, name: "Page 1" }]`, `page: <boardId>` on each object, right after `type`), or is passed through `upgrade` first; an assertion that the current or written version is 12 now asserts 13; an expected canonical payload or key list gains `pages` and `page` in document v18's order; a newer-than-current fixture moves up by one; an assertion that a version 12 document is read, upgraded or refused as newer keeps its meaning with 13 as the new newest. No assertion changes for any other reason; the record lists every changed line range |
| Module inventory: `tests/modules.test.mjs` | 15 package files, 10 object types, 16 scene parts, 32 screen parts, 25 state hooks, `use-pages.ts` with the recorded effect count (at most 2), other effect counts unchanged; the "0010-W1 App composition" test (591–641) rewritten as "0010-W2 App composition" from base 076f82e with the recorded substitutions |
| Find: `tests/find.test.mjs` | Unchanged for one-page boards; new cross-page checks go in `tests/pages.test.mjs` |
| Local shell: A–J | Unchanged except the file bar region (the Pages button shifts Objects, Undo and Redo right by the button's width), the one declared mask |

## Browser checks

New scenario **N1-S1–N1-S19**. N1 was unused in existing public briefs when allocated. A fresh
independent check run writes its tool from these clauses and the contract values; each row prints its
full ID, `PASS:`/`FAIL:` and a summary, retaining raw receipts and unrun rows. 1440 × 900, scale 1, macOS
Chrome (so ⌘ keys), unless a row says otherwise. Use real pointer and key events, never painted DOM. New
capability rows also fail by name on independent baseline 076f82e. Derived positions ±0.5 CSS px;
colours and sizes exactly as interaction v43; canvas pixel colours ±8 per channel. Save a real-state image
for N1-S1, S4, S8, S10, S11, S13 and S18.

**Fixture P.** A local board named "Pages check", opened from a board file the check tool writes to
document v18 and board file v4 and opens through the Board panel's Open board file… (no other route),
then saved once with Save. Pages in order: `Agenda` (id = the boardId), `Ideas`, `Retro`. Objects (box
`x, y, width, height` in board units):

| Id | Page | Object | Box | Text / links |
| --- | --- | --- | --- | --- |
| a01 | Agenda | section | −680, −200, 640, 480 | `Morning` |
| a02 | Agenda | sticky in a01 | −640, −80, 240, 240 | `Welcome and goals` |
| a03 | Agenda | sticky in a01 | −320, −80, 240, 240 | `Budget review` |
| a04 | Agenda | sticky | 200, −80, 240, 240 | `Lunch at noon` |
| a05 | Agenda | connector a03 → a04 | — | — |
| a06 | Agenda | text | −560, −390, 320, 120 | `Offsite agenda` |
| a07, a08 | Agenda | square shapes, one group | 560, 300, 160, 160 and 760, 300, 160, 160 | `Group A`, `Group B` |
| a09 | Agenda | mind-map root | 200, 640 (its own size) | `Plan` |
| a10 | Agenda | child of a09 | (laid out) | `Venue` |
| i01 | Ideas | section | −320, −200, 640, 480 | `Parking lot` |
| i02 | Ideas | sticky in i01 | −280, −80, 240, 240 | `Budget for the venue` |
| i03 | Ideas | sticky in i01 | 40, −80, 240, 240 | `Invite a guest speaker` |
| r01–r05 | Retro | stickies in a row from x −600, step 260, y −120, 240 × 240 | | `Went well`, `Budget overrun`, `Too long`, `Good food`, `Next time` |

**Entry state.** Unless a row says it continues from the row before it, a row starts from the saved
Fixture P board opened in a new tab from Boards in this browser, with `localStorage` cleared of
`nextphase-board/page/v1/…` keys: Agenda open, view 100% at (0, 0), nothing selected, no panel open.
Board Undo is the file bar's Undo button or ⌘Z with focus on the canvas.

| ID | Scriptable behavior and expected result |
| --- | --- |
| N1-S1 | The file bar holds, in order after the divider, Pages (40 × 40, tooltip and name `Pages`, `aria-expanded="false"`), Objects, Undo, Redo. Only Agenda's objects are shown: the Objects panel lists exactly a01–a10 (none of i01–i03, r01–r05); then close it. Clicking Pages: `aria-expanded="true"`, fill `#dceafb`, icon `#1665d8`; the list at left = the button's left, top 68, width 240, padding 8, `#ffffff`, 1 px `#d9dfe7`, radius 12, the shadow and `z-index` 5; header `Pages` 13 px 600 and `Add page` 32 × 32; rows Agenda, Ideas, Retro, 36 px tall, 2 px apart; Agenda's row fill `#dceafb`, weight 600, `aria-current="page"`, its options button shown; the other rows' options buttons hidden until hover. Capture pages |
| N1-S2 | Click Ideas: the list stays open, Ideas' row is current, the selection is empty, and the view is the fit of i01–i03 (the fit rule of interaction v42 on their union with the section band); `localStorage["nextphase-board/page/v1/<boardId>"]` is Ideas' id. Pan by 100 with the Navigation panel, click Agenda: view 100% at (0, 0); click Ideas: the panned view again. Reload: the board opens on Ideas. Across the row the save state stays `Locally saved`, Undo and Redo are as before and the saved board in local storage is byte-identical |
| N1-S3 | Add page: a fourth row `Page 1` at the end opens (the canvas empty, view 100% at (0, 0)) and is a field (2 px `#1665d8`, radius 8, name `Page name`) with `Page 1` selected; type `Notes`, Return: the row reads `Notes`, focus on its name button; Undo renames it back to `Page 1`, Undo again removes it and opens Agenda. Add page again, type `   ` and Return: the name stays `Page 1`; double-click it, type 70 `x`, Return: the name is 60 `x`; double-click, type `Other`, Escape: unchanged |
| N1-S4 | "…" on Ideas: the menu 4 px under the button, 220 × the items, padding 6, `#ffffff`, `#d9dfe7`, radius 12, `z-index` 7; items Rename page, Duplicate page, separator, Move up, Move down, separator, Delete page (`#a3302a`); Ideas' row fill `#eef1f5` and its options button `#d9dfe7`; ArrowDown moves between items, Escape returns focus to the options button. On Agenda the menu's Move up is disabled; on Retro, Move down. Capture page-menu |
| N1-S5 | Ideas › Move down: order Agenda, Retro, Ideas; Undo: Agenda, Ideas, Retro. Drag Retro's name button up past Agenda's middle: during the drag Retro's row is at 50% opacity and a 2 px `#1665d8` line shows the first gap; release: Retro, Agenda, Ideas, the open page still Agenda. A drag of 3 px opens Retro instead of moving it; Escape during a drag leaves the order |
| N1-S6 | Ideas › Duplicate page: a row `Ideas copy` after Ideas opens, holding a section and two stickies at i01–i03's boxes and texts, with new ids; the copied stickies' `section` is the copied section's id (saved board); notice `Duplicated page “Ideas” as “Ideas copy”.`; Undo removes it and Agenda (the page open when duplicating) opens |
| N1-S7 | Open Retro, Retro › Delete page with no confirmation: the list shows Agenda, Ideas; Ideas is open; notice `Deleted page “Retro” and its 5 objects. Undo restores it. Now on “Ideas”.`; Undo: Retro back third with r01–r05 (same ids) and open. Delete Ideas while Agenda is open: notice `Deleted page “Ideas” and its 3 objects. Undo restores it.`, Agenda still open. On a new board with one page, Delete page is disabled with `A board needs at least one page.` Capture page-deleted (after the first delete) |
| N1-S8 | Select a03 and a07: the selection bar holds Move to page immediately before Duplicate (`Move to page`, `aria-haspopup="menu"`); click it: open look `#dceafb` / `#1665d8`; the menu 8 px under it with heading `Move to page` (12 px 600 `#525d6c`) and Agenda (disabled, `This page`), Ideas, Retro. Capture move-menu. Choose Ideas: a03, a07 and a08 leave Agenda, a05 is gone, a04 stays; notice `Moved 3 objects to “Ideas”. Undo moves them back. 1 connector to an object left on this page was removed.` with a `Go to Ideas` button; Agenda still open with nothing selected. Capture moved. Go to Ideas: a03, a07, a08 at their old boxes, a03's `section` null, a07 and a08 still grouped (saved board) |
| N1-S9 | Continuing: Undo opens Agenda and puts a03, a07, a08 and a05 back with their ids, a03 in a01. Select a10 only and Move to page › Retro: a09 and a10 both move (notice `Moved 2 objects to “Retro”. …`). Select a05 alone: Move to page is disabled with `Select an object to move.` On a one-page board the selection bar has no Move to page |
| N1-S10 | ⌘F, `budget`: `1 of 3`, a03 ringed orange, second row `On page “Agenda”`; Return: Ideas opens, i02 current `2 of 3`, `On page “Ideas”`; Return: Retro, r02 `3 of 3`; Return: Agenda, a03 `1 of 3`. Escape after stepping to i02: Ideas open, i02 selected. With Retro open and query `welcome`: `– of 1`, no ring, the view unchanged; Return opens Agenda with a02 current. Capture find-pages (at `2 of 3`) |
| N1-S11 | Navigation panel on Agenda: heading `Sections on this page`, one button `Morning`; on Ideas, `Parking lot`. Zoom to fit on Ideas fits only i01–i03. On a one-page board: heading `Sections`. Capture navigation |
| N1-S12 | On Agenda, move a04 by drag; open Ideas; Undo: Agenda opens and a04 is back. Redo: a04 moves again with Agenda open. Each page step (S3, S5, S6, S7, S8) marks the save state `Unsaved` |
| N1-S13 | After S8 and Save: the saved payload in local storage is version 13 with `pages` (`id`, `name`), each object's `page` right after `type`, a03, a07, a08 on Ideas. Export board file, open it as a new board: same pages, order and objects |
| N1-S14 | Board files the tool writes with (a) a connector across pages, (b) a section member on another page, (c) a split group, (d) a mind node apart from its parent, (e) 51 pages, (f) a page name of 61 code points, (g) an object's `page` naming no page: each refused through Open board file… with the existing invalid-file message; a version 12 file opens as one page `Page 1` |
| N1-S15 | Four subcases, each from the entry state and saved after: (a) ⌘A on the canvas selects exactly Agenda's objects, then Delete; (b) select a02, a03 and a04, Tidy up, Apply; (c) select a04, ⌘C, ⌘V; (d) insert the first template from the palette's Templates. After each, every Ideas and Retro object in the saved board equals its entry value apart from `order`, and their relative order is unchanged; the pasted and template objects are on Agenda |
| N1-S16 | Hosted (team stack, ana on "Team test board"): no Pages button in the file bar; a selected sticky's selection bar has no Move to page; find and the Navigation panel as v42 (heading `Sections`); an edit by ana (a new sticky) reaches ben as today |
| N1-S17 | Keys: Tab to Pages, Return opens the list; ArrowDown moves from Agenda to Ideas; Return opens Ideas; Escape closes the list and focus returns to Pages |
| N1-S18 | At 375 × 812: the list spans left 12 to right 12 at top 68; menus stay inside the window. Capture narrow |
| N1-S19 | The row of `docs/guides/try-board.md` this milestone adds, walked as written on the served candidate: each `You should see` holds |

## Acceptance criteria

- **0010-W2-AC01:** On a single-user board, the Pages button opens the pages list; a person can add,
  rename, reorder by drag or Move up / Move down, duplicate and open pages; page ids stay the same through
  rename, reorder, Undo and reload; the board reopens on the last page opened in this browser. Look and
  placement match the approved design.
- **0010-W2-AC02:** Move to page moves the moved set to the same place on the chosen page with its ids;
  connectors with both ends moved go along, connectors with one end moved are deleted, sections and
  groups follow the rules; no saved reference crosses a page (validation rejects one); find searches every
  page and opens a result's page.
- **0010-W2-AC03:** Each page step is one Undo step, saved with the board and in board-file export and
  restore; Delete page deletes the page and its objects without asking and one Undo restores both;
  documents are version 13, version 1–12 documents open as one page; team boards keep one page.

| Criterion | Evidence that shows it |
| --- | --- |
| 0010-W2-AC01 | N1-S1–N1-S7; N1-S17–N1-S19; V4 |
| 0010-W2-AC02 | N1-S8–N1-S11; N1-S14; N1-S15; V4 |
| 0010-W2-AC03 | N1-S12–N1-S14; N1-S16; V4; V9 |

## Applicable DESIGN.md guardrails

Canvas-first shell, native controls and visible focus, minimum action hits, protected native editing
and independent state owners apply. The keyboard route: the Pages button, the list's keys, the menus and
Move up / Move down reach everything dragging does. Interaction v43 states every new look, word and key;
never infer generic styling. No new sound, font or image file. Preserve the complete selection chrome of
every type.

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
npm run test:server:node
npm run test:server:workerd
git diff --name-status <prerequisite-base>..<validated-source>
git diff --check <prerequisite-base>..<validated-source>
```

The room, sync and server change, so a short server-only run follows the build: it installs the schema
on its own uniquely owned local Supabase project and runs both server suites on the candidate (V9),
stopping on any failed setup step. The check run starts a team stack only for N1-S16, on its own uniquely
owned local Supabase project. Record each long run's start and end and the host's sleep and wake events;
a run that overlapped a sleep is INVALID and rerun awake. Three Safari checks from this milestone are
chosen only at Review.

**New server checks** (`tests/server/pages.test.ts`, both runners):

| ID | Check |
| --- | --- |
| S411 | A new hosted board is version 13 with exactly the default page |
| S412 | A stored version 12 board (and a version 11 board, and a version 12 board at the maximum payload size) is served as version 13 with the default page and every object's `page` the `boardId`, with no edits row, receipt, revision or history version for the upgrade; a reload serves 13 again |
| S413 | An edit that adds a page, renames or re-ids the page, or moves an object to another page id is refused `invalid_document`; an ordinary edit on version 13 is accepted |
| S414 | Import and create: a version 13 document with one page is accepted, with two pages refused `invalid_document`; a version 12 document is refused `invalid_document` (only the current version is accepted, as only 12 was before) |
| S415 | History: a stored version 12 snapshot restores as version 13 with the default page; a version 13 snapshot round-trips |
| S416 | Templates: a stored template object holding `page` is refused `bad_request`; a template inserted into a version 13 board validates |

| Check | Command/inspection and pass condition |
| --- | --- |
| V1 | Byte-compare manifests, locks, dependency inventory and runtime notices against the prerequisite base: unchanged, no new dependency |
| V2 | `npm ci --ignore-scripts --no-audit --no-fund` exits 0 on the clean candidate and on the independent baseline |
| V3 | `npm run typecheck` exits 0 across all five workspace members |
| V4 | `npm test` full suite exits 0; `tests/pages.test.mjs` proves: validation of every document v18 rule (each rejection case of N1-S14, duplicate page ids, a page id equal to an object id, generation or retired generation, a name not equal to its trim, 0 and 51 pages, `page` key order for each type); `upgrade` from versions 7, 11 and 12 to the default page; `empty()`; canonical key order; codec and adapter round trip of `pages` and `page` (and that an unchanged `pages` is not rewritten); `Page <n>` naming; rename trim, 60-code-point cut and trim again, and a name still invalid (a tab inside) kept unchanged with no step; the payload limit measured without `pages` and `page` (a version 12 board at the maximum size upgrades and still passes `canonical`); move up, down and to an index; duplicate (new ids, generations and group ids, remapped connectors, sections and parents, `<name> copy` cut to 60, the 50-page and 250-object limits); delete and the page that opens; the moved set (Duplicate's set, whole maps, whole groups, section members, both-ended connectors, half-selected connectors removed, empty set) and moving (section cleared, one-ended connectors deleted, ids, positions and order kept, counts); every notice text; local history recording `pages` and each step's page, Undo and Redo reporting it; the open page's objects and that an edit through each creation path (place, paste, duplicate, template, activity, image, stroke, tape, connector, mind node, wrap in a section) lands on the open page and leaves other pages' objects identical apart from `order` with their relative order kept, as does Tidy up's Apply; find order across pages, the first-current rule, Next and Previous across pages and the page line; `storage.ts` and `board-file.ts` treating 14 as newer and 13 as current. Guards as web modules v41 |
| V5 | Team-off `npm run build` and `npm run audit:licenses` exit 0; notices equal runtime notices v1 (team off) |
| V6 | `npm run build:fixtures`, team-on `npm run build` and `audit:licenses` exit 0; team-on notices equal runtime notices v3 |
| V7 | `npm run build:server`, `audit:licenses` and the wrangler dry run exit 0; no deploy |
| V8 | Inspect all hunks plus `git diff --name-status` and `git diff --check` over `<prerequisite-base>..<validated-source>`: only the deliverables, the dispositions above and the append-only Implementation record |
| V9 | Server-only run: `npm run test:server:node` and `npm run test:server:workerd` exit 0 on the candidate against a fresh local stack, including S411–S416 (the implementer cannot start the stack: unrun in implementation) |
| V10 | N1-S1–N1-S19 pass with the state captures and raw receipts |
| V11 | Design: the captures of N1-S1, S4, S7, S8, S10 and S11 show every look interaction v43 states, and the reviewer compares them with the approved design (the fallback face accepted) |
| V12 | Once, on an independent 076f82e source and build with the candidate's `tests/pages.test.mjs` copied in, its checks and the new browser capability checks fail by name; a top-level setup or import abort does not count |
| V13 | Accepted A–J compare: baseline twice, then candidate and diffs; existing normalization plus the declared mask (the file bar region) |

A regression failure that also fails on 076f82e is a baseline finding to report, never fixed here.

## Review focus and public references

Review that no path commits a page-filtered board (every page step and every edit goes through the whole
board, and V4's isolation checks cover each creation and edit path); that `pages.ts` is pure and decides
every page rule; that `use-pages.ts` is the only page state owner; the document v18 rules in `validate`
and their key orders; the upgrade's default page and its determinism (the `boardId`); the codec and
adapter (`pages` as one value, written only on a content change; `page` kept through the connector key
handling); the room's one-page rule on edits, imports, creates and restores, and its stored-version
upgrade without an edit; the template wrapper; history recording `pages` and each step's page; find's
cross-page order and the first-current rule; the hosted boards showing nothing new; that every payload-limit check (`canonical`, the room's edit,
snapshot, import and restore, local storage, board files) measures without `pages` and `page`, so a
maximum-size version 12 board upgrades without failing; that a name still invalid after trimming keeps
the previous name; and App.tsx changed only by the recorded substitutions. Public source basis is main 076f82e and the linked versioned
contracts, read 2026-11-15; no outside product is needed to implement this contract. No unresolved
product decision is delegated to implementation.

## Exclusions and reasons

- Pages on team (hosted) boards, and page-aware presence, spotlight, comments and voting: a later
  milestone.
- Divider pages, copying a link to a page, renaming several pages at once, a page-switching shortcut,
  a confirmation before deleting a page.
- Moving objects to another board, a minimap.
- A font file for the new parts (the stack's fallback face is shown).
- Repairs to separately tracked baseline failures.

## Implementation record

(Appended by the implementer.)
