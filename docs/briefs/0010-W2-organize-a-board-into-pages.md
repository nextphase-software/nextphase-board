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


### 0010-W2 v1 implementation — 2026-11-16

- Branch: `codex/0010-W2-organize-a-board-into-pages`.
- Prerequisite base: `fa0ebf7c1424aecc116ff78c9bd6e3e8aaa96fd2`.
- Behaviour baseline: `076f82edb1dff6687e9c127edb6ce414870e05d2`.
- Validated source/test revision: `58f040433ba939891154929b4dec07d619728a96`
  (`fix(web): preserve page menu return focus`), following feature commit `4e381ea`
  (`feat(web): organize local boards into pages`). This append is a separate documentation commit;
  the final branch tip is reported separately in the handoff. No merge or push.
- Node `26.13.0`, npm `11.20.0`. Added dependencies: **none**; no version or licence changes.
- Implemented document v18/schema 13, local page operations and their whole-board history,
  per-page rendering/selection/placement/views, remembered page, cross-page find and the new controls.
  Hosted edits, imports, creates and history restores retain the single-page constraint.
- The approved design references and all eight approved screens were read before screen changes;
  interaction v43 supplies the implemented values. No font or image asset was added.

#### Authoritative V1–V8 results

Every row below is against the validated source/test revision above; these are implementation checks,
not independent acceptance. Synthetic build settings, for both web builds:

```sh
BOARD_SUPABASE_URL=http://127.0.0.1:55321
BOARD_SUPABASE_ANON_KEY=synthetic
BOARD_SERVER_URL=http://127.0.0.1:8796
```

| Row | Commands / inspection | Result and counts |
| --- | --- | --- |
| PASS: V1 | Byte-compare each tracked package manifest, root lock, versioned dependency lock/inventory and runtime notice against `fa0ebf7` using `git show` | 20/20 files identical; 0 added dependencies |
| PASS: V2 | `npm ci --ignore-scripts --no-audit --no-fund` in the clean candidate and an independent archive of `076f82e` | 2/2 installs exit 0; each installs 118 packages; the baseline runs no tests or builds |
| PASS: V3 | `npm run typecheck` | Exit 0 across all 5 workspace members |
| PASS: V4 | `npm test` | 1,242 tests: 1,242 pass, 0 fail, 0 skipped; includes 35 named `P2-U01`–`P2-U35` page checks and the module guards |
| PASS: V5 | `BOARD_TEAM_FEATURES=off npm run build` with the synthetic settings above; `npm run audit:licenses`; `cmp apps/web/dist/THIRD_PARTY_NOTICES.txt docs/architecture/0001-runtime-notices-v1.txt` | 3/3 commands exit 0; one local web build; notices byte-identical |
| PASS: V6 | `npm run build:fixtures`; `BOARD_TEAM_FEATURES=on npm run build` with the same settings; `npm run audit:licenses`; `cmp apps/web/dist/THIRD_PARTY_NOTICES.txt docs/architecture/0001-runtime-notices-v3.txt` | 4/4 commands exit 0; 7 fixture output files and one team web build; notices byte-identical |
| PASS: V7 | `npm run build:server`; `npm run audit:licenses`; `WRANGLER_SEND_METRICS=false npx wrangler deploy --dry-run --outdir <scratch> -c apps/server/wrangler.json` | 3/3 commands exit 0; Node and Worker bundles; Wrangler 4.156.0 dry run exits without deploying (1,379.76 KiB, gzip 283.95 KiB) |
| PASS: V8 | Inspect all source/test/documentation hunks; `git diff --name-status fa0ebf7..58f0404`; `git diff --check fa0ebf7..58f0404` | 85 files: 6 new and 79 modified, all within the deliverables/dispositions; diff check exit 0. This record adds only the brief append |

The authoritative V3–V7 command interval was **2026-11-16 06:30:30.432–06:30:42.244 UTC**.
`pmset -g batt` reported AC power and 100% charge; `caffeinate -dimsu` held keep-awake from
06:07:06 UTC through validation. `pmset -g log` inspection through 06:30:56 UTC found **0 actual
Sleep/Wake/DarkWake transitions** in that interval (assertion messages containing “Wake Lock” are not
sleep/wake events). No validation run overlapped sleep.

Focused development iterations preceded this final full run. The final focused page/module run passed;
intermediate fixture-version and harness-input failures were corrected within the stated dispositions.
There are no remaining unit or build failures from the authorized run.

#### Coverage and exclusions

The 35 page checks cover page/name/identity limits and every one-page reference rule; canonical key
orders for all nine persisted object types; upgrades from 7, 11 and 12; maximum legacy payload size;
codec/adapter recreation and unchanged atomic `pages`; names, reorder, duplicate/remapping, delete,
moved-set closure and connector removal; exact notice words; history pages and step page; all twelve
creation/edit isolation paths including interleaved other-page objects; cross-page find; current/newer
storage and files; production page/geometry/editing/keyboard/find/Tidy up handlers; view memory and
local-storage errors; and the room's refusal of page changes. All commits keep whole boards. Read-only
projections feed drawing, selection and list/placement reads.

- **Unrun V9:** `npm run test:server:node` and `npm run test:server:workerd`, including the six new
  S411–S416 checks. Both include lists contain `tests/server/pages.test.ts`. No Supabase CLI or stack
  was started; the separately owned server-only run must execute these checks.
- **Unrun V10–V13:** N1-S1–N1-S19, design captures/comparison, independent baseline named-failure
  checks, and A–J visual comparison. No browser was started. No Chrome/Safari, native IME,
  performance/load, accessibility or unrelated scenario campaign ran.
- Module guards pass with 15 rules files, 10 object-type modules, 16 scene parts, 32 screen parts and
  25 state hooks. `use-pages.ts` has **2 passive effects**; every other effect count is unchanged.
- No presence, comments, voting, timer, reactions or spotlight source changed. Their authorized
  fixture changes only make current hosted documents explicitly version 13 where needed.
- The try-and-test guide changes by exactly the brief's Pages row, immediately after Find and navigate.
  The named unrelated evidence document was not touched or staged.

#### Clarifications and environment limitations

- Document v18 explicitly permits a page id equal to a retired generation (including `boardId`),
  whereas V4's parenthetical list mentions that case among rejection cases. The explicit document
  rule governs: the focused check accepts retired-only collisions and rejects collisions with active
  object ids/generations. This discrepancy was reported before dependent implementation.
- Graph discovery and the required index attempt both returned an approval-required error under the
  sandbox's never-approve policy. Local source reads were used after those attempts; no exception,
  new tool or dependency was introduced.
- Both source commit hooks reported `PUBLIC BOUNDARY: PASS` twice. Git then reported a sandbox-denied
  packed-refs maintenance lock; the commit itself exited 0, and its branch ref, source SHA and clean
  status were verified. No hook was bypassed.

#### Additional allowed web seams and current type names

| File beyond the individually named web paths | Reason |
| --- | --- |
| `apps/web/src/gesture.ts` | Type-only: preserve the current object page through captured resize rectangles. |
| `apps/web/src/state/use-object-layouts.ts` | Read the open page for display, bounds and group numbers; retain all measured displayed objects for cross-page find. |
| `apps/web/src/state/use-page-keys.ts` | Select all reads only the open page; editing commands retain the whole model. |

The document exports `BoardV13`/`ItemV13` and retains `BoardV12`/`ItemV12` as current-type aliases so
unchanged shared consumers keep compiling. Existing files with explicit current-type renames in this
patch (renames have no independent behaviour change):

- `apps/server/src/routes/boards.ts`
- `apps/server/src/templates.ts`
- `apps/web/src/activities.ts`
- `apps/web/src/clipboard.ts`
- `apps/web/src/connectors.ts`
- `apps/web/src/images.ts`
- `apps/web/src/mind-map.ts`
- `apps/web/src/sections.ts`
- `apps/web/src/state/use-board-document.ts`
- `apps/web/src/state/use-canvas-input.ts`
- `apps/web/src/state/use-editing-commands.ts`
- `apps/web/src/state/use-find.ts`
- `apps/web/src/state/use-geometry-edits.ts`
- `apps/web/src/state/use-images.ts`
- `apps/web/src/state/use-object-layouts.ts`
- `apps/web/src/state/use-page-keys.ts`
- `apps/web/src/state/use-tidy-up.ts`
- `apps/web/src/strokes.ts`
- `apps/web/src/tape.ts`
- `apps/web/src/team/templates-rules.ts`
- `apps/web/src/ui/context-bar.tsx`
- `packages/board-room/src/edits.ts`
- `packages/board-room/src/history.ts`
- `packages/board-room/src/room.ts`
- `packages/board-sync/src/codec.ts`

#### Exact App.tsx substitutions

Exactly **19 existing-line substitutions**, with **0 added lines** and **264 lines** before/after.
`tests/modules.test.mjs` reconstructs the expected App from `076f82e`, asserts each before string
occurs exactly once and checks exact text and line-count equality. Each entry below gives the base
line and literal before/after strings (JSON escaping only):

```json
[
  {
    "baseLine": 21,
    "before": "import { useObjectLayouts } from \"./state/use-object-layouts\"; import { useTidyUp } from \"./state/use-tidy-up\"; import { useFind } from \"./state/use-find\";",
    "after": "import { useObjectLayouts } from \"./state/use-object-layouts\"; import { useTidyUp } from \"./state/use-tidy-up\"; import { useFind } from \"./state/use-find\"; import { usePages } from \"./state/use-pages\";"
  },
  {
    "baseLine": 24,
    "before": "import { Overlays } from \"./scene/overlays\"; import { ConnectionDots } from \"./scene/connection-dots\"; import { MindMapButtons } from \"./scene/mind-map-buttons\"; import { TidyUpLayer } from \"./scene/tidy-up-layer\"; import { TidyUpBar } from \"./ui/tidy-up-bar\"; import { FindRings } from \"./scene/find-rings\"; import { FindBar } from \"./ui/find-bar\";",
    "after": "import { Overlays } from \"./scene/overlays\"; import { ConnectionDots } from \"./scene/connection-dots\"; import { MindMapButtons } from \"./scene/mind-map-buttons\"; import { TidyUpLayer } from \"./scene/tidy-up-layer\"; import { TidyUpBar } from \"./ui/tidy-up-bar\"; import { FindRings } from \"./scene/find-rings\"; import { FindBar } from \"./ui/find-bar\"; import { PagesPanel } from \"./ui/pages-panel\"; import { MoveToPage } from \"./ui/move-to-page\";"
  },
  {
    "baseLine": 51,
    "before": "    connectorStyle, shapeSession, board, setBoard, title, setTitle, drafts, setDrafts, history,",
    "after": "    stepPage, connectorStyle, shapeSession, board, setBoard, title, setTitle, drafts, setDrafts, history,"
  },
  {
    "baseLine": 54,
    "before": "  } = useBoardDocument({ readOnly, setStatus, hosted: team?.hosted, nameSent: team?.nameSent });",
    "after": "  } = useBoardDocument({ readOnly, setStatus, hosted: team?.hosted, nameSent: team?.nameSent }); const pages = usePages({ board, model, stepPage, hosted: !!team?.hosted, commit, finishTextSession, select, setMessage, getView: () => view, setView: value => setView(value), getObjects: () => allDisplayedObjects, openingReason: () => busy || composing || tidy.open ? \"Finish the current action first.\" : \"\", editingReason: () => commandReason || (tidy.open ? \"Apply or cancel Tidy up first.\" : \"\") });"
  },
  {
    "baseLine": 58,
    "before": "  } = useSelection({ board, drafts, textSelection }); const tidy = useTidyUp({ board, selected, commit, tool, setMessage, hosted: team?.hosted, scene, readOnly });",
    "after": "  } = useSelection({ board: pages.canvas(), drafts, textSelection }); const tidy = useTidyUp({ board, objects: pages.objects(), selected, commit, tool, setMessage, hosted: team?.hosted, scene, readOnly });"
  },
  {
    "baseLine": 62,
    "before": "  const images = useImages({ board, model, selected, readOnly: readOnly || !!team?.hosted, busy: gestureBusy, composing, invalidObjectText, pending,",
    "after": "  const images = useImages({ page: pages.id, board, model, selected, readOnly: readOnly || !!team?.hosted, busy: gestureBusy, composing, invalidObjectText, pending,"
  },
  {
    "baseLine": 66,
    "before": "    editorBox, resolvedItem, growHeight, growAvailable, lineCount, objectLayouts, displayedObjects, bounds, selectedGroups, numbers,",
    "after": "    editorBox, resolvedItem, growHeight, growAvailable, lineCount, objectLayouts, displayedObjects, allDisplayedObjects, bounds, selectedGroups, numbers,"
  },
  {
    "baseLine": 69,
    "before": "    board: tidy.board, selected: tidy.selected, selectedId, item, text, inline, textEditing: !!textSelection, invalidObjectText, tool, readOnly, composing, busy, drag,",
    "after": "    board: tidy.board, objects: pages.objects(tidy.board), selected: tidy.selected, selectedId, item, text, inline, textEditing: !!textSelection, invalidObjectText, tool, readOnly, composing, busy, drag,"
  },
  {
    "baseLine": 85,
    "before": "  const pos = (o: { x: number; y: number }) => screenPoint(o, view, size); const find = useFind({ boardId: board.boardId, displayedObjects, selected, select, view, setView, size, scene, composing, busy, tidy, finishTextSession, setInline });",
    "after": "  const pos = (o: { x: number; y: number }) => screenPoint(o, view, size); const find = useFind({ board, pages, allDisplayedObjects, boardId: board.boardId, displayedObjects, selected, select, view, setView, size, scene, composing, busy, tidy, finishTextSession, setInline });"
  },
  {
    "baseLine": 96,
    "before": "    shapeSession, model, commit, beginTextSession, finishTextSession, setDrafts, setMessage,",
    "after": "    page: pages.id, shapeSession, model, commit, beginTextSession, finishTextSession, setDrafts, setMessage,"
  },
  {
    "baseLine": 104,
    "before": "    voting: team?.hosted?.voting, drawing, tidy, find, connectorStyle, shapeSession, model, commit, setBoard, clearHistory, finishTextSession, setView, trackPointer,",
    "after": "    page: pages.id, voting: team?.hosted?.voting, drawing, tidy, find, connectorStyle, shapeSession, model, commit, setBoard, clearHistory, finishTextSession, setView, trackPointer,"
  },
  {
    "baseLine": 126,
    "before": "    tool, connectorStyle, shapeSession, growHeight, growAvailable, model, commit, historyRef, updateHistory, setDrafts, finishTextSession,",
    "after": "    pages, tool, connectorStyle, shapeSession, growHeight, growAvailable, model, commit, historyRef, updateHistory, setDrafts, finishTextSession,"
  },
  {
    "baseLine": 132,
    "before": "    voting: team?.hosted?.voting, chooseImages: images.chooseImages,",
    "after": "    page: pages.id, voting: team?.hosted?.voting, chooseImages: images.chooseImages,"
  },
  {
    "baseLine": 173,
    "before": "          faded={find.faded} bitmaps={images.bitmaps} connection={connection} preview={preview} size={size} view={view} board={tidy.board} objectLayouts={objectLayouts} selected={tidy.selected} inline={inline} movingIds={busy && drag.current?.crossed ? drag.current.ids ?? [] : []}",
    "after": "          faded={find.faded} bitmaps={images.bitmaps} connection={connection} preview={preview} size={size} view={view} board={pages.canvas(tidy.board)} objectLayouts={objectLayouts} selected={tidy.selected} inline={inline} movingIds={busy && drag.current?.crossed ? drag.current.ids ?? [] : []}"
  },
  {
    "baseLine": 180,
    "before": "        <ConnectionDots dots={dots} connection={connection} objects={displayedObjects} pos={pos} zoom={view.z} /><MindMapButtons board={board} objects={displayedObjects} selected={selected} inline={inline} pos={pos} zoom={view.z} busy={busy} composing={composing} readOnly={readOnly} command={command} /><TidyUpLayer tidy={tidy} pos={pos} view={view} /><FindRings find={find} pos={pos} zoom={view.z} />",
    "after": "        <ConnectionDots dots={dots} connection={connection} objects={displayedObjects} pos={pos} zoom={view.z} /><MindMapButtons board={pages.canvas()} objects={displayedObjects} selected={selected} inline={inline} pos={pos} zoom={view.z} busy={busy} composing={composing} readOnly={readOnly} command={command} /><TidyUpLayer tidy={tidy} pos={pos} view={view} /><FindRings find={find} pos={pos} zoom={view.z} />"
  },
  {
    "baseLine": 184,
    "before": "      <ImageNames board={board} /><FileBar team={team}",
    "after": "      <ImageNames board={pages.canvas()} /><PagesPanel pages={pages} /><FileBar team={team} pages={pages}"
  },
  {
    "baseLine": 196,
    "before": "      {!team?.hosted && <Notice",
    "after": "      {!team?.hosted && <Notice pages={pages}"
  },
  {
    "baseLine": 211,
    "before": "          duplicateReason={duplicateReason} board={board} busy={busy} composing={composing} setPanel={setPanel}",
    "after": "          duplicateReason={duplicateReason} board={pages.canvas()} busy={busy} composing={composing} setPanel={setPanel}"
  },
  {
    "baseLine": 223,
    "before": "          tapeSelection={tapeSelection} tidy={tidy} board={board} description={images.description} imageCount={images.count} imagesOnly={images.only} connectorCommands={connectorCommands} strokeSelection={strokeSelection} strokeCommands={strokeCommands} shapeSelection={shapeSelection} shapeCommands={shapeCommands} shapePopup={shapePopup} selectionFormats={selectionFormats} toggleFormat={toggleFormat} richText={richText}",
    "after": "          tapeSelection={tapeSelection} tidy={tidy} board={pages.canvas()} moveToPage={<MoveToPage pages={pages} selected={selected} reason={duplicateReason} />} description={images.description} imageCount={images.count} imagesOnly={images.only} connectorCommands={connectorCommands} strokeSelection={strokeSelection} strokeCommands={strokeCommands} shapeSelection={shapeSelection} shapeCommands={shapeCommands} shapePopup={shapePopup} selectionFormats={selectionFormats} toggleFormat={toggleFormat} richText={richText}"
  }
]
```

#### Shared-path changed line ranges

Ranges below are exact zero-context diff hunk ranges, **prerequisite-base lines → validated-source
lines**; `+0`/`-0` ranges denote insertions/deletions. They authorize only version-13/default-page,
legacy downgrade, current/newer-version, canonical-key/snapshot expectations and module inventory/App
guards. No historical acceptance campaign was added or run.

| Test / fixture file | Base ranges → source ranges |
| --- | --- |
| `tests/README.md` | `-669,0 → +670,2` |
| `tests/board-catalog.test.mjs` | `-8 → +8`, `-235 → +235`, `-322 → +322` |
| `tests/board-file.test.mjs` | `-1,0 → +2`, `-32 → +33`, `-42 → +43`, `-55 → +56`, `-78 → +79`, `-138 → +139` |
| `tests/board-history.test.mjs` | `-176 → +176` |
| `tests/clipboard.test.mjs` | `-34 → +34`, `-78 → +78`, `-80 → +80` |
| `tests/connector-styles.test.mjs` | `-1,0 → +2`, `-30 → +31`, `-44 → +45`, `-46 → +47`, `-48 → +49`, `-83 → +84`, `-87 → +88`, `-477 → +478`, `-538 → +539` |
| `tests/connectors.test.mjs` | `-1,0 → +2`, `-36,2 → +37,2`, `-39,2 → +40,2`, `-71 → +72`, `-94 → +95` |
| `tests/document.test.mjs` | `-1,0 → +2`, `-15,5 → +16,5`, `-42 → +43`, `-116 → +117`, `-131 → +132`, `-134 → +135`, `-143 → +144`, `-245 → +246`, `-264 → +265`, `-292 → +293`, `-359 → +360`, `-369 → +370`, `-374 → +375` |
| `tests/images.test.mjs` | `-1,0 → +2`, `-26,2 → +27,2`, `-53 → +54`, `-55 → +56` |
| `tests/import-fixture.mjs` | `-4,0 → +5,3`, `-14 → +17`, `-18 → +21`, `-26 → +29`, `-31 → +34`, `-34,0 → +38`, `-42 → +46,2`, `-47 → +52`, `-52 → +57,2` |
| `tests/mind-map.test.mjs` | `-1,0 → +2`, `-59 → +60`, `-65 → +66`, `-67 → +68`, `-69 → +70`, `-71,3 → +72,3`, `-76 → +77` |
| `tests/modules.test.mjs` | `-119 → +119`, `-138,0 → +139`, `-141,0 → +143`, `-241 → +243`, `-256,0 → +259`, `-591,3 → +594,3`, `-596,2 → +599,2`, `-600,2 → +603,2`, `-604,2 → +607,2`, `-608,2 → +611,2`, `-612,2 → +615,2`, `-616,2 → +619,2`, `-620,2 → +623,2`, `-624,2 → +627,2`, `-628,2 → +631,42`, `-632 → +674,0`, `-641,0 → +684,5` |
| `tests/server/drawing-layout.test.ts` | `-5,0 → +6`, `-82,2 → +83,2`, `-96,2 → +97,2`, `-102 → +103`, `-123 → +124`, `-133 → +134`, `-137 → +138`, `-144 → +145` |
| `tests/server/history.test.ts` | `-8 → +8`, `-43,3 → +43,3`, `-55 → +55`, `-140 → +140` |
| `tests/server/lifecycle.test.ts` | `-7 → +7`, `-56 → +56`, `-166 → +166` |
| `tests/server/mind-maps.test.ts` | `-5,0 → +6`, `-86,2 → +87,2`, `-105 → +106`, `-107 → +108`, `-114 → +115`, `-122 → +123`, `-175 → +176`, `-189 → +190`, `-213 → +214` |
| `tests/server/shared.test.ts` | `-8 → +8`, `-86 → +86`, `-89,2 → +89,2`, `-96,2 → +96,2`, `-104 → +104`, `-112 → +112`, `-279,4 → +279,4`, `-321 → +321`, `-861 → +861` |
| `tests/server/suite.test.ts` | `-482 → +482` |
| `tests/shape-kinds.test.mjs` | `-1,0 → +2`, `-14 → +15` |
| `tests/shapes.test.mjs` | `-39 → +39`, `-44 → +44` |
| `tests/shared-editing.test.mjs` | `-35 → +35`, `-77 → +77`, `-80 → +80`, `-82 → +82` |
| `tests/storage.test.mjs` | `-1,0 → +2`, `-4 → +5`, `-68 → +69`, `-76 → +77`, `-91 → +92`, `-104 → +105`, `-115 → +116`, `-125 → +126`, `-131 → +132`, `-139,2 → +140,2` |
| `tests/strokes.test.mjs` | `-1,0 → +2`, `-31,3 → +32,3`, `-89 → +90`, `-95 → +96`, `-204 → +205` |
| `tests/tape.test.mjs` | `-23,2 → +23,2` |
| `tests/team-import.test.mjs` | `-5 → +5`, `-43 → +43`, `-62 → +62`, `-64 → +64` |
| `tests/team-templates.test.mjs` | `-48 → +48` |
| `tests/tidy-up.test.mjs` | `-121 → +121` |
| `tests/transition.test.mjs` | `-20 → +20,2` |
| `tests/workshop-reactions.test.mjs` | `-18 → +18` |
| `tests/workshop-spotlight.test.mjs` | `-18 → +18` |
| `tests/workshop-voting.test.mjs` | `-18 → +18` |

The two Vitest configuration changes only add the new server test to `include`; no runner settings
change. `tests/find.test.mjs` stays byte-identical to the prerequisite base.

#### Complete validated-source file inventory

`A` = new, `M` = modified. The separate record commit changes only this brief's Implementation record.

```text
M	apps/server/src/routes/boards.ts
M	apps/server/src/templates.ts
M	apps/web/src/App.tsx
M	apps/web/src/activities.ts
M	apps/web/src/board-file.ts
M	apps/web/src/clipboard.ts
M	apps/web/src/connectors.ts
M	apps/web/src/find.ts
M	apps/web/src/gesture.ts
M	apps/web/src/history.ts
M	apps/web/src/icons.tsx
M	apps/web/src/images.ts
M	apps/web/src/mind-map.ts
A	apps/web/src/pages.ts
M	apps/web/src/sections.ts
M	apps/web/src/state/use-board-document.ts
M	apps/web/src/state/use-canvas-input.ts
M	apps/web/src/state/use-editing-commands.ts
M	apps/web/src/state/use-find.ts
M	apps/web/src/state/use-geometry-edits.ts
M	apps/web/src/state/use-images.ts
M	apps/web/src/state/use-object-layouts.ts
M	apps/web/src/state/use-page-keys.ts
A	apps/web/src/state/use-pages.ts
M	apps/web/src/state/use-tidy-up.ts
M	apps/web/src/storage.ts
M	apps/web/src/strokes.ts
M	apps/web/src/tape.ts
M	apps/web/src/team/templates-rules.ts
M	apps/web/src/ui/connector-controls.tsx
M	apps/web/src/ui/context-bar.tsx
M	apps/web/src/ui/file-bar.tsx
M	apps/web/src/ui/find-bar.tsx
A	apps/web/src/ui/move-to-page.tsx
M	apps/web/src/ui/navigation-panel.tsx
M	apps/web/src/ui/notice.tsx
A	apps/web/src/ui/pages-panel.tsx
M	apps/web/src/ui/stroke-controls.tsx
M	apps/web/style.css
M	docs/guides/try-board.md
M	packages/board-room/src/edits.ts
M	packages/board-room/src/history.ts
M	packages/board-room/src/room.ts
M	packages/board-rules/src/document.ts
M	packages/board-rules/src/objects/image.ts
M	packages/board-rules/src/objects/registry.ts
M	packages/board-rules/src/objects/stroke.ts
M	packages/board-rules/src/objects/tape.ts
M	packages/board-sync/src/codec.ts
M	packages/board-sync/src/document-adapter.ts
M	tests/README.md
M	tests/board-catalog.test.mjs
M	tests/board-file.test.mjs
M	tests/board-history.test.mjs
M	tests/clipboard.test.mjs
M	tests/connector-styles.test.mjs
M	tests/connectors.test.mjs
M	tests/document.test.mjs
M	tests/images.test.mjs
M	tests/import-fixture.mjs
M	tests/mind-map.test.mjs
M	tests/modules.test.mjs
A	tests/pages.test.mjs
M	tests/server/drawing-layout.test.ts
M	tests/server/history.test.ts
M	tests/server/lifecycle.test.ts
M	tests/server/mind-maps.test.ts
A	tests/server/pages.test.ts
M	tests/server/shared.test.ts
M	tests/server/suite.test.ts
M	tests/shape-kinds.test.mjs
M	tests/shapes.test.mjs
M	tests/shared-editing.test.mjs
M	tests/storage.test.mjs
M	tests/strokes.test.mjs
M	tests/tape.test.mjs
M	tests/team-import.test.mjs
M	tests/team-templates.test.mjs
M	tests/tidy-up.test.mjs
M	tests/transition.test.mjs
M	tests/workshop-reactions.test.mjs
M	tests/workshop-spotlight.test.mjs
M	tests/workshop-voting.test.mjs
M	vitest.node.config.ts
M	vitest.workerd.config.ts
```

### Fix round 1 — server findings — 2026-11-16

- Branch: `codex/0010-W2-organize-a-board-into-pages`.
- Starting record tip: `11e689934e156a940f024f0294bc159db40a429e`.
- Validated source/test revision: `2ea990f601455cdd64d3f13471e0fbf74dc8de3f`
  (`test(pages): repair hosted fixtures and payload sizing`). This append is a separate record commit;
  its tip is reported separately. No push or merge. This fix round does not count toward the review cap.
- Read the supplied server findings and every named retry log. All 32 reproducible failures have
  **test fixture** causes. No product or check-tool change, dependency, licence change, screen change
  or `App.tsx` substitution in this round. The room/codec refusal rules remain intact.

#### Proven causes and expected server-check changes

| Failure IDs | Classification and proof | Fix and expected effect in the next server-only run |
| --- | --- | --- |
| S402, S407, S412 | **Test fixture.** Each seed used the current adapter (which upgrades to 13), reset the version, then deleted page fields. An encode/decode round trip retains each deleted object `page` in `Y.Map._map`, although `has("page")` is false. `codec.ts`'s exact legacy map check throws `invalid_update` in `Room.load`, before `upgradeStored`; export cannot serve the board. Isolated clean legacy maps for 10, 11, 12 and a maximum-size 12 board already loaded/exported as 13 with the unmodified product. | `storedBoardUpdate` copies live adapter entries into fresh legacy maps, never inserting `pages` or `page`, while cloning text and retaining style, geometry, order, identifiers and retired generations. All three server seeds use it. Expect older snapshots to export/join as 13 with the default page; S412 can now reach its maximum-size case. Four new room units prove two loads each, with revision 1 and an existing receipt unchanged, no edits, unchanged identifiers, history rows/chunks and restore generation. |
| S378–S401 | **Test fixture, version-13 disposition.** `content()` strips generation/order from objects made by `add()`, but retained the new `page`. `templateObjects` correctly rejects that forbidden stored-template field as `bad_request`. Both simple and full old fixtures reproduce the rejection; their corrected forms validate with 1 and 4 objects respectively. | Strip `page` alongside generation/order. Expect the 24 template checks to reach their intended role, CRUD, content and limit assertions. Product template validation and the deliberate forbidden-page check S416 are unchanged. |
| S33, S59 | **Test fixture, version-13 disposition.** The old large-board builders replaced `empty().boardId` but retained its original page id; `add()` then used the replacement board id for object pages. Both original builder functions reproduce `Invalid page reference` locally. These invalid references exist before the room sees an edit. | Share `largeTextBoard`, setting the default page id to the supplied board id before adding objects. The new room unit saves all 50 five-object increments, snapshots/reloads the complete board unchanged, then refuses a one-byte title growth without a receipt or revision. Thus the driven product edit/rename paths do not create the cross-page reference. Expect S33 persistence and S59 rename limits to run. |
| S140 | **Test fixture, version-13 disposition.** `sizedBoard()` already makes a 2,097,152-byte payload after excluding page metadata. Its serialized canonical JSON is 2,104,400 bytes, so the raw-length assertion was wrong. At 2,097,153 payload bytes the product still refuses `Board too large`. | Measure the assertion and evidence with document v18's `payloadBytes`. Extend P2-U05 to prove both current-version boundaries. `sizedBoard` itself and its modes are unchanged. Exact 2 MiB acceptance and one-more-byte refusal retain their meaning. |
| S38, S41 | **Test fixture dependency.** Both retry traces stop at `assert(large)`; `large` is assigned only after S33's successful persistence/export. Neither failure demonstrates a refusal/restore product bug. | Correcting S33 restores the prerequisite at its existing assignment. S38 and S41 assertions and bodies are unchanged. Expect them to reach their large-document refusal and restore checks. |
| workerd S93 | Timing flake reported as non-reproducible and also passing on the baseline. | Left untouched; no implementation claim or rerun in this sandbox. |

The corrected large text fixture measures **2,097,152 payload bytes** and **2,108,724 serialized
bytes**. It therefore occupies **3 JSON chunks**, not the pre-pages 2. S33 now asserts the exact
`ceil(serialized bytes / 1,048,576)` chunk count, separately asserting the exact payload boundary;
its Yjs multi-chunk and bounded-row assertions remain. The same physical/payload distinction is
covered by the new room unit. No brief acceptance assertion was relaxed.

#### Stack-free reproduction and validation

Before the helper fix, the unchanged deletion-based seed algorithm was mechanically extracted into
`storedBoardUpdate` and exercised by the four new room cases:

```sh
node --test --test-reporter=tap --test-name-pattern='stored version' tests/room.test.mjs
```

Result: **0 pass / 4 fail**, each `invalid_update` at `codec.ts` → `Room.load` → export. After the
fresh-map fix, the same command gave **4 pass / 0 fail**. The final focused command
`node --test --test-reporter=tap tests/room.test.mjs tests/pages.test.mjs` gave **44 pass / 0 fail**.
A scratch-only fixture probe evaluated the original builder functions from `11e6899` and the corrected
fixtures without loading Vitest or starting a stack: both template forms, both large builders, all
three legacy versions and both size boundaries reproduced the causes/fixes described above.

All authoritative rows below ran on `2ea990f601455cdd64d3f13471e0fbf74dc8de3f`, with Node **26.13.0**
and npm **11.20.0**. Times are UTC on 2026-11-16; these are implementation checks, not server acceptance.

| Result | Command | Counts | Start–end UTC | Raw receipt |
| --- | --- | --- | --- | --- |
| PASS: V3 | `npm run typecheck` | 5 workspace members; exit 0 | 07:37:19.608–07:37:22.364 | `V3.log` |
| PASS: V4 | `npm test` | **1,247 pass / 0 fail / 0 skip**; 5 new room units, extended P2-U05; exit 0 | 07:37:19.608–07:37:29.195 | `V4.log` |
| PASS: V7 build | `npm run build:server` | 2 bundles (Node/Worker), verified notices; exit 0 | 07:37:23.479–07:37:24.069 | `V7-build.log` |
| PASS: V7 audit | `npm run audit:licenses` | Lock, inventory and distributed notices verified; exit 0 | 07:37:29.265–07:37:29.413 | `V7-audit.log` |
| PASS: V7 dry run | `WRANGLER_SEND_METRICS=false WRANGLER_LOG_PATH=<scratch>/wrangler-logs npx wrangler deploy --dry-run --outdir <scratch>/worker-dry-run -c apps/server/wrangler.json` | Wrangler 4.156.0; 1,379.76 KiB, gzip 283.95 KiB; exit 0; no deploy | 07:38:28.609–07:38:29.417 | `V7-dry-run-final.log` |

V7 is **3/3 commands passed**. An earlier dry run also exited 0, but its default diagnostic-log write
was sandbox-denied. The final run above directs that log into writable scratch and completes cleanly.
AC power / 100% charge and the active `caffeinate -dimsu` process were recorded. `pmset -g log` found
**0 actual Sleep/Wake/DarkWake transitions** across 07:37:19.608–07:38:29.417 UTC; no validation overlapped
sleep. No unrelated suite, browser, Supabase CLI or stack was started.

Raw receipt SHA-256 values (receipts retained outside the repository; no host paths committed):

| Receipt | SHA-256 |
| --- | --- |
| `room-red.log` | `2670ba920569255ce1aad2158d4f4acd0e0ef69c79d7395290b087167e7a533c` |
| `room-green.log` | `ec131a73106875c5958da7d137383c34b806de7d58e0fa681c2b3be618a5faee` |
| `focused.log` | `24c498ed735cb1a816c2f09305ee18ead827d08a78f5734f0be70b640c6889ab` |
| `fixture-proof.log` | `22e58b24d66be3030c4202899c9faa867bb12f27eebd2dcc3e77deddd7a19e9b` |
| `V3.log` | `6401c42ca0f07cac1d8322415400ae67617315cf6ab2f3b79fc6046e6511c61f` |
| `V4.log` | `a46f01e8bdee983e8ebbfe58a16afdc5efed75be221652419993a3be1a07845c` |
| `V7-build.log` | `c8fbd0d3d1c9e3b383a2843ff5907b3e03ba87f828aa8e6dc764933a923bb5f4` |
| `V7-audit.log` | `7bf914273592848e5bf1987472a52faf6078fa65d6bcd8f1fc91fe29b8cccae1` |
| `V7-dry-run-final.log` | `d97ece32703ff0aa42eeab95757d00470b28f36a99adba87f02d7d9aba1fb60c` |

**Unrun:** V9 (`npm run test:server:node`, `npm run test:server:workerd`), including the 32 expected
fixture-related recoveries and workerd S93; the sandbox cannot start the required stack. V1/V2/V5/V6
and V10–V13 were not rerun in this fix round. No browser was started. The next independent server-only
run must validate the expected effects; no server failure is reported as passed here.

**Escalation:** none. Graph discovery/indexing remained approval-blocked under the sandbox's never
policy, so source reads supplied the evidence. The source commit's two privacy hooks passed; optional
Git packed-refs maintenance was denied after the successful commit, with its branch ref and clean
status verified. No hook was bypassed. The internal repository was read-only throughout; the unrelated
vote evidence document was not touched or staged.

#### Complete fix-round changed-path and line-range inventory

Ranges before → after refer to `11e6899` → `2ea990f`; deleted helper bodies are listed explicitly.
All ten source/test paths are within the brief's fixture/test dispositions. `git diff --check
11e6899..2ea990f` exits 0; every hunk and `git diff --name-status` were inspected. The record commit
adds only the append below the prior 693 lines.

| Changed path | Before → after lines | Disposition |
| --- | --- | --- |
| `tests/import-fixture.mjs` | 2 → 2; after 3 → 4–5; after 7 → 10–51 | Add existing dependency imports, fresh legacy snapshot encoder, shared default-page text fixture sized without page metadata. `sizedBoard` algorithm unchanged. |
| `tests/pages.test.mjs` | after 81 → 82–83 | Extend P2-U05 with the current exact-2-MiB and plus-one boundaries. |
| `tests/room.test.mjs` | after 88 → 89–167 | Four legacy-load regressions and the hosted large-fixture edit/persist/reload/rename regression. |
| `tests/server/drawing-layout.test.ts` | 6 → 6; 81 → 81; 84–85 → 84 | S407 uses the clean legacy seed helper. |
| `tests/server/lists.test.ts` | after 9 → 10; 167–188 deleted (after 167 in candidate) | S59 uses the shared corrected `fullBoard` alias instead of its stale-page/raw-size builder. |
| `tests/server/mind-maps.test.ts` | 6 → 6; 85 → 85; 88–89 → 88 | S402 uses the clean legacy seed helper. |
| `tests/server/pages.test.ts` | 75 → 75; 77–79 → 77 | S412 uses the clean legacy seed helper, including the maximum-size v12 case. |
| `tests/server/shared.test.ts` | 993 → 993–994; 998 → 999 | S140 assertion/evidence measure the v18 payload. |
| `tests/server/suite.test.ts` | 9 → 9–10; 368–384 deleted (after 368 in candidate); 396 → 380; 403 → 387 | Shared corrected `largeBoard`, explicit payload boundary, physical chunk count. S38/S41 bodies unchanged. |
| `tests/server/templates.test.ts` | 49 → 49 | Omit `page` from stored-template fixture objects. |
| `docs/briefs/0010-W2-organize-a-board-into-pages.md` | append after 693 → 694–800 | This separate Fix round 1 implementation record; earlier content unchanged. |

### Fix round 2 — stored snapshot seed statement size — 2026-11-16

- Branch: `codex/0010-W2-organize-a-board-into-pages`.
- Starting record tip: `70df72979c7b6fc958df0acee5f1443854523dc0`.
- Validated source/test revision: `b17fea949fe684ea07f1c31768b379d7a6f65c21`
  (`test(pages): bound stored snapshot seed statement size`). This append is a separate record commit;
  the final tip is reported in the handoff. This fix round is outside the review cap. No push or merge.
- Classification: **test fixture/helper**. Read the supplied workerd S412 retry log: `SQLITE_TOOBIG`
  occurs while `seedStored` executes the maximum-size v12 snapshot inserts, before any upgrade assertion.
  A 1 MiB byte chunk becomes a **2,097,201-byte SQL statement** after hex encoding and SQL syntax.
  Cloudflare documents a **100 KB SQL statement limit** for SQLite-backed Durable Objects:
  [Durable Objects limits](https://developers.cloudflare.com/durable-objects/platform/limits/).
- Fix: only `seedStored` now writes **32 KiB** byte chunks, giving a maximum statement length of
  **65,585 bytes**. Revision/kind/index bindings, byte contents and contiguous chunk indexes retain
  their meaning. S412 assertions, all other checks and all product files are byte-identical outside
  the helper; no new dependencies or licence/version changes.

#### Driver and stored-layout proof

`tests/server/driver-node.ts:29–31` forks without an advanced serialization option; `47–49` sends the
control object over IPC. The installed Node declarations document JSON as the serialization default.
`tests/server/node-test.ts:164` passes received `roomSQL` bindings straight to storage, with no binary
revival. A `Uint8Array` binding therefore is not carried as binary end to end on Node. The workerd
path (`tests/server/driver-workerd.ts:118–124`) likewise forwards the supplied bindings to storage.
Changing drivers to carry binary would exceed this helper-only fix. The smaller hex statements keep
SQL strings and primitive bindings compatible with both existing paths.

The stored layout permits smaller rows: `packages/board-room/src/snapshots.ts:24–42` reads the latest
revision's Yjs chunks by `chunk_index`, concatenates all bytes and applies the result; it assumes no
fixed row length. `packages/board-room/src/history.ts:30–40,301–306` requires contiguous indexes,
nonempty rows and a **maximum**, not an exact size, of 1 MiB, then concatenates JSON/Yjs chunks.
`NodeStorage.exec` and `WorkerStorage.exec` each execute the supplied SQL unchanged. No product or
storage format change is required. An upgrade writes its normal production snapshot afterward.

A scratch-only probe extracted the actual helper and exercised the maximum-size version 12 fixture,
with a 100,000-byte statement guard before executing its SQL through `NodeStorage`. The old helper
fails that guard (the independent workerd retry supplies the actual runtime failure). The corrected
helper passes: **64 JSON rows + 44 Yjs rows**, maximum row 32 KiB, **2,097,152 payload bytes**. A JSON
round trip of the SQL/control arguments models the Node IPC transport. Existing `documentBytes` and
`loadDocument` reconstruct the unchanged legacy document; two room export/load cycles serve version
13, with **0 edits, 0 receipts, revision 0 and unchanged history rows**. This probe is stack-free proof
of statement size and layout compatibility, not a workerd/server-suite pass.

Other literal seeding was inspected: `tests/server/mind-maps.test.ts` and
`tests/server/drawing-layout.test.ts` use one-sticky legacy snapshot/history fixtures; S415 in
`tests/server/pages.test.ts` seeds an empty history document. None of these literal seeds currently
carries a payload large enough to cross the statement limit. They remain unchanged; no additional
server check was reported failing because of them.

#### Authoritative validation on the source revision above

Node **26.13.0**, npm **11.20.0**. UTC times below are on 2026-11-16.

| Result | Command | Counts | Start–end UTC | Receipt |
| --- | --- | --- | --- | --- |
| PASS: V3 | `npm run typecheck` | All **5** workspace members; exit 0 | 08:29:59.278–08:30:01.507 | `V3.log` |
| PASS: V4 | `npm test` | **1,247 pass / 0 fail / 0 skip**; exit 0 | 08:29:59.279–08:30:06.992 | `V4.log` |

AC power / 100% charge and `caffeinate -dimsu` were recorded. `pmset -g log` found **0 actual
Sleep/Wake/DarkWake transitions** during 08:29:59.278–08:30:06.992 UTC. No run overlapped sleep.
Raw receipts are retained outside the repository, without committing host paths:

| Receipt | SHA-256 |
| --- | --- |
| `seed-red.log` | `dd9a3ff813160744ab1ab5d8a63a5579e5e11b2ceba2aa19c973a36ca5bb9f8f` |
| `seed-green.log` | `ee91a4e54e5243326423296990702b10a58cba03821f58394d267c4339886190` |
| `V3.log` | `6401c42ca0f07cac1d8322415400ae67617315cf6ab2f3b79fc6046e6511c61f` |
| `V4.log` | `fb19da3c995bae1598592d0edcf41014ee113c40bf2e102974599c1ae3da3bad` |

**Unrun:** V9, both `npm run test:server:node` and `npm run test:server:workerd`; the required stack
cannot start in this sandbox. S412's workerd recovery is expected from bounded statements and remains
for the independent server run to prove. V1/V2/V5–V8 and V10–V13 were not rerun as validation rows;
the fix hunks, path list and diff whitespace were inspected. No browser, Supabase CLI or server stack
was started. The internal repository remained read-only; unrelated work was preserved.

**Escalation:** none. Graph discovery/indexing remained approval-blocked, so source reads supplied the
trace. Both source-commit privacy hooks passed. Optional packed-refs maintenance was sandbox-denied
after the successful commit; the branch ref and clean state were verified. No hook was bypassed.

| Complete changed-path inventory | Before → after lines | Scope |
| --- | --- | --- |
| `tests/server/pages.test.ts` | `70df729` lines 80–81 → `b17fea9` lines 80–84 | Only the `seedStored` chunk-size constant, its explanation and its loop/slice bounds. Assertions/product unchanged. |
| `docs/briefs/0010-W2-organize-a-board-into-pages.md` | append after 800 → 801–887 | This separate Fix round 2 record; the preceding 800 lines are unchanged. |

`git diff --check 70df729..b17fea9` exits 0. The fix commit changes one helper in one test file;
the separate record commit changes only this append.

### Review fix round 1 — page control states and find rings — 2026-11-16

- Branch: `codex/0010-W2-organize-a-board-into-pages`.
- Starting record tip: `2a1ad32aaf7b2a62e71c51328cfdcf2c031015ff`.
- Validated source/test revision: `4e1c7ae948bf404d166727779f9cbc8fbb45d675`
  (`test(pages): keep ring regression with cross-page checks`), following product commit
  `193e192af780f9fb1d47a0f48d464feb5923d43b`
  (`fix(web): preserve page control states and scope find rings`). This append is a separate record
  commit; the handoff reports its tip separately. This is review fix round **1 of at most 3**.
- Read the review and check evidence and inspected all three supplied failure captures. Re-read the
  approved pages, page-menu and move-menu images and interaction v43 lines 54–58, 80–84, 117–121 and
  172–178 before changing CSS. The public interaction contract supplies the values; no design change,
  font/image asset, dependency, version or licence change. No push or merge.

#### Findings and resulting behavior

| Finding | Cause | Fix and focused proof |
| --- | --- | --- |
| F1 — product | The shared `button:hover:not(:disabled):not([aria-disabled=true])` rule has specificity (0,3,1), beating the new Pages/open/pressed styles. The context bar also overrides the open Move button's icon colour. | Scope stronger enabled-state selectors to Pages and its list icons, plus the open Move button. Pages closed hover is `#eef1f5`; open Pages and Move keep `#dceafb` / `#1665d8` under hover. Add/options hover is `#eef1f5`, pressed is `#d9dfe7`; a menu-open row stays `#eef1f5` and its options button `#d9dfe7`. Menu-open options outrank both hover and pressed selectors. The CSS regression checks the exact tokens, specificity/source-order precedence and byte-identical shared CSS before the Pages block. No other button selector changes; closed Move hover/focus/disabled and all focus outlines retain their shared rules. |
| F2 — product | `FindRings` mapped the whole cross-page result array, so a match on another page still drew a ring even with no current match on the open page. | Give the renderer the open page id and filter only its rendering projection. Both current and other rings require `result.page === page`; the full Find state, counters, page line and stepping remain intact. The regression renders the actual component with matches on three pages, proves `– of 1` with no ring on a page without matches, filters off-page current and other matches, checks next/previous, full-result counters/page labels, unchanged board bytes and closed Find. |

Both new named regressions are in `tests/pages.test.mjs`, following the brief's shared-path
instruction. They were run against an archive of the starting `2a1ad32` product with the final test
file copied in: **0 pass / 2 fail**, by name (missing stronger CSS state rule; off-page ring present).
The same final checks on the fix give **2 pass / 0 fail**:

```sh
node --test --test-reporter=tap --test-name-pattern='0010-W2 F[12]' tests/pages.test.mjs
```

This is focused before/after proof, not a rerun of V12 on the behavior baseline. The first source
commit's Find-file regression was moved into the page checks in `4e1c7ae`; `tests/find.test.mjs` is
byte-identical to the starting tip. No existing one-page Find assertion changed.

#### App substitution (one existing line, no added line)

`apps/web/src/App.tsx` remains **264 lines**. Only line **180** changes in this round, by adding
`page={pages.id}` to `FindRings`; all other characters on that line remain. The baseline composition
still consists of the same **19 substituted lines**, with this substitution's final value updated in
`tests/modules.test.mjs:656`. The module guard reconstructs the complete App from `076f82e` and passes.
No hook, state owner or effect changed; the 15/10/16/32/25 module counts and two Pages effects remain.

Before, complete line 180:

```tsx
        <ConnectionDots dots={dots} connection={connection} objects={displayedObjects} pos={pos} zoom={view.z} /><MindMapButtons board={pages.canvas()} objects={displayedObjects} selected={selected} inline={inline} pos={pos} zoom={view.z} busy={busy} composing={composing} readOnly={readOnly} command={command} /><TidyUpLayer tidy={tidy} pos={pos} view={view} /><FindRings find={find} pos={pos} zoom={view.z} />
```

After, complete line 180:

```tsx
        <ConnectionDots dots={dots} connection={connection} objects={displayedObjects} pos={pos} zoom={view.z} /><MindMapButtons board={pages.canvas()} objects={displayedObjects} selected={selected} inline={inline} pos={pos} zoom={view.z} busy={busy} composing={composing} readOnly={readOnly} command={command} /><TidyUpLayer tidy={tidy} pos={pos} view={view} /><FindRings find={find} page={pages.id} pos={pos} zoom={view.z} />
```

#### Authoritative V3–V6 validation on `4e1c7ae`

Node **26.13.0**, npm **11.20.0**. Both builds use these synthetic settings:

```sh
BOARD_SUPABASE_URL=http://127.0.0.1:55321
BOARD_SUPABASE_ANON_KEY=synthetic
BOARD_SERVER_URL=http://127.0.0.1:8796
```

| Result | Commands | Counts | UTC start–end, 2026-11-16 |
| --- | --- | --- | --- |
| PASS: V3 | `npm run typecheck` | All **5** workspace members; exit 0 | 09:01:46.247–09:01:48.488 |
| PASS: V4 | `npm test` | **1,249 pass / 0 fail / 0 skip**, including both new named regressions; exit 0 | 09:01:46.247–09:01:54.110 |
| PASS: V5 | `BOARD_TEAM_FEATURES=off npm run build`; `npm run audit:licenses`; `cmp apps/web/dist/THIRD_PARTY_NOTICES.txt docs/architecture/0001-runtime-notices-v1.txt` | **3/3 commands** exit 0; one local web build, notices byte-identical | 09:01:47.450–09:01:48.411 |
| PASS: V6 | `npm run build:fixtures`; `BOARD_TEAM_FEATURES=on npm run build`; `npm run audit:licenses`; `cmp apps/web/dist/THIRD_PARTY_NOTICES.txt docs/architecture/0001-runtime-notices-v3.txt` | **4/4 commands** exit 0; **7 fixture output files**, one team web build, notices byte-identical | 09:01:52.912–09:01:53.647 |

Earlier verification on `193e192` also passed V3–V6 (1,249/0/0 units), during
08:58:48.991–08:59:06.439 UTC. The final runs above followed the test-placement commit and are the
source-revision results for handoff. Both sets of raw logs are retained. AC power / 100% charge and
`caffeinate -dimsu` were recorded; `pmset -g log` found **0 actual Sleep/Wake/DarkWake transitions**
across 08:58:48.991–09:01:54.110 UTC. No validation overlapped sleep.

Raw receipt hashes (receipts are outside the repository; no host paths committed):

| Receipt | SHA-256 |
| --- | --- |
| `red-final.log` | `1732a04df0d215131c9ed3950a1c4e4434b8a75bea33b47d914e2be6b1a22efc` |
| `green-final.log` | `bf70bf3c1e9f91bc7f3e2d153470c973c83e62b02c573abe2fbeb45b9a7c83b0` |
| `V3-final.log` | `6401c42ca0f07cac1d8322415400ae67617315cf6ab2f3b79fc6046e6511c61f` |
| `V4-final.log` | `99fc7ea72aade5e5e519cda12756f1c6d8ec8f2faf43202adba0d273af67a57b` |
| `V5-build-final.log` | `f487d01a4726454336e262b2b9527dea58dea559d4c18b471064b309a01dfba6` |
| `V5-audit-final.log` | `7bf914273592848e5bf1987472a52faf6078fa65d6bcd8f1fc91fe29b8cccae1` |
| `V5-notices-final.log` | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `V6-fixtures-final.log` | `d10037338e529c19d7af2318453d4c4603374a35d994d35be70a785b31c340f4` |
| `V6-build-final.log` | `f487d01a4726454336e262b2b9527dea58dea559d4c18b471064b309a01dfba6` |
| `V6-audit-final.log` | `7bf914273592848e5bf1987472a52faf6078fa65d6bcd8f1fc91fe29b8cccae1` |
| `V6-notices-final.log` | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |

**Unrun:** browsers, new captures/design comparison, the N1 scenario/scoped recheck, both server
suites, Supabase CLI/stack, and validation rows V1/V2/V7–V13. The local fix diff and path list were
inspected and whitespace checked. The CSS test proves rule precedence, not browser-computed pixels;
N1-S1/S4/S8 and the affected design compares require the independent recheck. F2's N1-S10 browser
result also remains for that recheck. No runtime acceptance or milestone approval is claimed here.

**Escalation:** none. Graph discovery/indexing remained approval-blocked under the sandbox's never
policy, so source reads supplied the trace. All source-commit privacy hooks passed; optional Git
packed-refs maintenance was sandbox-denied after successful commits, with refs and clean status
verified. No hook was bypassed. The internal repository was read-only; unrelated work and the vote
evidence document were not touched or staged.

#### Complete final changed-path and line-range inventory

Ranges compare `2a1ad32` with `4e1c7ae`; the record append is separate. There are **5 net source/test
paths**, plus this brief. `tests/find.test.mjs:235–262` was added in `193e192` and removed in `4e1c7ae`;
its final contents equal `2a1ad32`. Both regressions reside only in the page test file.

| Changed path | Before → after lines | Scope |
| --- | --- | --- |
| `apps/web/src/App.tsx` | 180 → 180 | The exact renderer page-prop substitution above, within the existing line. |
| `apps/web/src/scene/find-rings.tsx` | 4–5 → 4–5; 8 → 8 | Required open-page prop and rendering-only result filter; no state change or new scene part. |
| `apps/web/style.css` | 1582–1583 → 1582–1583; 1599–1601 → 1599–1603 | Only the named Pages controls/menu-open row and open Move state precedence. Shared styling unchanged. |
| `tests/modules.test.mjs` | 656 → 656 | Update the existing line-180 substitution's expected final value. |
| `tests/pages.test.mjs` | after 320 → 321–383 | Two focused regressions: CSS state precedence and actual ring rendering across pages. |
| `docs/briefs/0010-W2-organize-a-board-into-pages.md` | append after 887 → 888–1009 | This separate Review fix round 1 record; earlier content unchanged. |

`git diff --check 2a1ad32..4e1c7ae` exits 0. All final hunks and `git diff --name-status` were inspected.

### Review fix round 2 — transparent page names and menu state precedence — 2026-11-16

- Branch: `codex/0010-W2-organize-a-board-into-pages`.
- Starting record tip: `7d5e618c6a031b9dac7c8297302205d6362038c3`.
- Validated source/test revision: `11fb52734e48752551cf8e89755c80a7305fb13f`
  (`fix(web): preserve page name and menu state styling`). This append is a separate record commit;
  the handoff reports its tip separately. This is review fix round **2 of at most 3**; one remains.
- Read review v2, the check report and both N1-S33 receipt copies. Re-read the approved Pages image
  and interaction v43 lines 75–83 before edits; the page-menu and move-menu images and menu state
  clauses were also re-read for the requested audit. No design, asset, dependency or licence change.
  No push or merge. The internal repository was read-only.

#### F1b and the complete list/menu button audit

The supplied receipts show the row fills already correct while the name button covers them with
`#f1eff5`: the open row is `#dceafb`, other-row hover `#eef1f5`, and name-pressed rows `#d9dfe7`.
The name's transparent base rule loses to shared button hover. The repair adds an unconditional,
background-only selector with specificity (0,3,1), equal to shared hover but later in source order.
It stays transparent on hover, active, focus and disabled states without overriding font weight,
border/padding/minimum-size resets or the focus-visible outline. Row fills themselves are unchanged.

Every button family in the list and both menus was traced from its markup to its CSS states:

| Button family | Audit result / repair |
| --- | --- |
| Page name buttons, open and other rows | **Fixed F1b:** add `.pages-panel .page-row button.page-name { background: transparent; }`. The row's existing hover/pressed/open fill remains visible. |
| Add page and Page options buttons | **Already correct:** the previous enabled hover/active selectors beat shared hover; menu-open options retain `#d9dfe7`. No selector, token or declaration changed. |
| Page options menu: Rename page, Duplicate page, Move up/down, Delete page | Ordinary hover/focus `#eef1f5`, pressed `#d9dfe7` and disabled transparent/muted/full-opacity states already have correct precedence. **Additional cascade repair:** Delete page's `#a3302a` text was overridden by the ordinary hover/focus ink colour; strengthen its colour selector with `:not(:disabled)` so it wins by equal specificity and later order. Disabled Delete page still uses the unchanged muted rule. |
| Move to page menu: target-page items and disabled current page | Hover/focus and disabled states already correct. **Additional cascade repair:** the ordinary pressed selector (0,3,1) lost to context-menu hover (0,4,1). Add the context-qualified active selector (0,4,1) to the existing pressed-fill rule, after hover, so a pressed hovered item keeps `#d9dfe7`. |
| Focus-visible in the list and both menus | Existing 3 px `#1665d8` outline with 2 px offset remains byte-identical. All disabled styles and normal/open row name weights remain byte-identical. |

Complete changed-selector list:

1. **Added:** `.pages-panel .page-row button.page-name` — only `background: transparent`.
2. **Added to the existing pressed rule:** `.context .page-menu button:active:not(:disabled)` —
   `background: var(--np-line)`; `.page-menu button:active:not(:disabled)` and its declaration remain.
3. **Strengthened:** `.page-menu button.page-danger` →
   `.page-menu button.page-danger:not(:disabled)` — the existing `color: var(--np-critical)` value.

Nothing outside these state repairs changes. Shared CSS before the Pages block remains byte-identical.
No TypeScript/TSX source changed. In particular, the lone-connector Move to page reason is untouched:
`apps/web/src/ui/move-to-page.tsx` is byte-identical to `7d5e618`. `App.tsx` is also byte-identical;
it remains **264 lines**, with the existing **19 substitutions** and no new substitution this round.

#### Focused regression

The new named CSS check in `tests/pages.test.mjs` checks specificity/source order for all three
repairs; ordinary menu hover/focus/pressed behavior; unchanged row, Add/options, name-weight, focus
and disabled declarations; the background-only name override; and unchanged shared CSS. It uses
source rules, not a browser-computed-style simulation.

```sh
node --test --test-reporter=tap --test-name-pattern='0010-W2 F1b' tests/pages.test.mjs
```

Before: **0 pass / 1 fail**, reporting all four losing comparisons (name vs shared hover; Move item
pressed vs context hover; Delete colour vs menu hover and vs focus). The final check copied beside
the starting stylesheet reproduces the same failures without editing the worktree. After:
**1 pass / 0 fail**. These focused receipts do not claim a browser or independent acceptance pass.

#### Authoritative V3–V6 validation on `11fb527`

Node **26.13.0**, npm **11.20.0**. Both web builds use the synthetic settings below:

```sh
BOARD_SUPABASE_URL=http://127.0.0.1:55321
BOARD_SUPABASE_ANON_KEY=synthetic
BOARD_SERVER_URL=http://127.0.0.1:8796
```

| Result | Commands | Counts | UTC start–end, 2026-11-16 |
| --- | --- | --- | --- |
| PASS: V3 | `npm run typecheck` | All **5** workspace members; exit 0 | 09:20:44.150–09:20:47.084 |
| PASS: V4 | `npm test` | **1,250 pass / 0 fail / 0 skip**, including the new F1b check; exit 0 | 09:20:44.153–09:20:53.730 |
| PASS: V5 | `BOARD_TEAM_FEATURES=off npm run build`; `npm run audit:licenses`; `cmp apps/web/dist/THIRD_PARTY_NOTICES.txt docs/architecture/0001-runtime-notices-v1.txt` | **3/3 commands** exit 0; one local web build, notices byte-identical | 09:20:49.767–09:20:50.391 |
| PASS: V6 | `npm run build:fixtures`; `BOARD_TEAM_FEATURES=on npm run build`; `npm run audit:licenses`; `cmp apps/web/dist/THIRD_PARTY_NOTICES.txt docs/architecture/0001-runtime-notices-v3.txt` | **4/4 commands** exit 0; **7 fixture output files**, one team web build, notices byte-identical | 09:20:56.241–09:20:56.912 |

AC power / 100% charge and `caffeinate -dimsu` were recorded. `pmset -g log` found **0 actual
Sleep/Wake/DarkWake transitions** across 09:20:44.150–09:20:56.912 UTC. No validation overlapped sleep.
Raw receipts remain outside the repository; no host paths are committed:

| Receipt | SHA-256 |
| --- | --- |
| `red-final.log` | `1f3f29ecb9ffe2964d0bd343101f1b5f880f7c17bdffd4ab774e99f21a041849` |
| `green.log` | `98e3ba34052f5ef1d469edd82205c7fcf43a3b9c2b03a75cbfdb211a2dc2b225` |
| `V3.log` | `6401c42ca0f07cac1d8322415400ae67617315cf6ab2f3b79fc6046e6511c61f` |
| `V4.log` | `5ad75e7cd7176f919f3e96b46ba36a6953445589eedcf78d6288d33d9e94c7a2` |
| `V5-build.log` | `f487d01a4726454336e262b2b9527dea58dea559d4c18b471064b309a01dfba6` |
| `V5-audit.log` | `7bf914273592848e5bf1987472a52faf6078fa65d6bcd8f1fc91fe29b8cccae1` |
| `V5-notices.log` | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `V6-fixtures.log` | `d10037338e529c19d7af2318453d4c4603374a35d994d35be70a785b31c340f4` |
| `V6-build.log` | `f487d01a4726454336e262b2b9527dea58dea559d4c18b471064b309a01dfba6` |
| `V6-audit.log` | `7bf914273592848e5bf1987472a52faf6078fa65d6bcd8f1fc91fe29b8cccae1` |
| `V6-notices.log` | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |

**Unrun:** browsers, N1-S33/scoped recheck, new design captures/comparisons, both server suites,
Supabase CLI/stack and validation rows V1/V2/V7–V13. The fix's path list/hunks and diff whitespace were
inspected. The CSS regression supplies rule-level proof; computed styles and the approved look still
require the independent browser recheck. No milestone or runtime acceptance is claimed here.

**Escalation:** none. Graph discovery/indexing remained approval-blocked under the never policy,
so source reads supplied the trace. Both source-commit privacy hooks passed. Optional packed-refs
maintenance was sandbox-denied after the successful commit; the branch ref and clean status were
verified. No hook was bypassed. Unrelated work and the vote evidence document were not touched/staged.

| Complete changed-path inventory | Before → after lines | Scope |
| --- | --- | --- |
| `apps/web/style.css` | after 1596 → 1597; 1616 → 1617; 1618 → 1619 (`7d5e618` → `11fb527`) | The three selector changes listed above; existing state values retained. |
| `tests/pages.test.mjs` | after 383 → 384–427 | One new focused F1b/list/menu CSS regression; existing checks unchanged. |
| `docs/briefs/0010-W2-organize-a-board-into-pages.md` | append after 1009 → 1010–1123 | This separate Review fix round 2 record; all earlier content unchanged. |

`git diff --check 7d5e618..11fb527` exits 0. All hunks and `git diff --name-status` were inspected;
the fix changes only CSS and its focused test, and the separate record commit only this append.
