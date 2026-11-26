BRIEF VERSION: 0001-W27 v1 (2026-11-26)
# 0001-W27 — Links in text

Status: Draft. Implementation has not started under this brief.

## Outcome and read first

Words in stickies, shapes and text objects can carry a link, on single-user and team boards alike.
- An editor selects words while editing, or one whole sticky, shape or text, and presses the new **Link** button
  (Formatting group, after Strikethrough) or **⇧⌘U**. A link bar takes the context bar's place: paste or type an
  address, then Return. Pasting one address over selected words links them too. A bare domain gets `https://`; only
  `http` and `https` addresses are accepted.
- Linked words are underlined in the text colour. Resting the pointer on them shows a small dark card: the address,
  or for a link to a page or object of this board that page's or object's **current** name, with Copy link (everyone)
  and Edit link (editors).
- One click on a link to this board goes there in place (switches page, or selects the object and centres it, zoom
  unchanged). Any other link opens in a new tab with `noopener,noreferrer`.
- A new **Copy link to `<kind>`** button in the context bar (before Duplicate, viewers included) copies a link to the
  one selected object. Opening it shows the board on that object's current page with the object selected and in view.
  The address bar follows a single selected object.
- A link whose object no longer exists says so on hover and when followed.
- Setting, changing or removing a link is one Undo step and, on a team board, one synced edit; copying, hovering,
  following and address writes are not edits.

Read [AGENTS.md](../../AGENTS.md), [CONTRIBUTING.md](../../CONTRIBUTING.md), [DESIGN.md](../../DESIGN.md)
and these new contract files (prior versions remain untouched):

| Contract | New version / ownership |
| --- | --- |
| [Document](../architecture/0001-document-v23.md) | v23: `link` on formatting runs, schema 17 and its upgrade from 16, the link address rule (`linkAddress`) and the link-range helpers |
| [Interaction](../architecture/0001-interaction-v53.md) | v53: the part **Links in text**: the Link button and ⇧⌘U, the link bar, paste onto selected words, underlines, the hover card, following, Copy link to an object, object links, the address following the selection, missing targets, viewers |
| [Web modules](../architecture/0001-web-modules-v51.md) | v51: the new modules, the changed files, App.tsx's wiring, CSS rules, effects, counts and tests |
| [Sync](../architecture/0003-sync-v19.md) | v19: live board 17; the codec and the room's repair carry `link`; one update and one Undo step per link change |
| [Board file](../architecture/0006-board-file-v7.md) | v7: documents of version 1 to 17; links travel inside `document` (file version stays 3) |
| [Team templates](../architecture/0008-team-templates-v5.md) | v5: templates hold documents at schema 17 |
| [Storage](../architecture/0001-storage-v6.md) | v6: reading accepts schema 1–17; `newer` is above 17 |
| [API](../architecture/0003-api-v17.md) | v17: board create and import accept schema 13–17 |

Use this set wherever inherited contracts link a replaced version. Unchanged: [hosted storage v15](../architecture/0003-hosted-storage-v15.md),
[hosted persistence v13](../architecture/0003-hosted-persistence-v13.md), [board lifecycle v8](../architecture/0006-board-lifecycle-v8.md),
[access v17](../architecture/0003-access-v17.md), [link preview v1](../architecture/0012-link-preview-v1.md),
[presence v5](../architecture/0004-presence-v5.md), [comments v5](../architecture/0005-comments-v5.md),
[workshop voting v3](../architecture/0007-workshop-voting-v3.md), [toolchain v6](../architecture/0001-toolchain-v6.md),
[self-host runner v11](../architecture/0003-self-host-runner-v11.md), [lock v5](../architecture/0001-dependency-lock-v5.json),
[inventory v5](../architecture/0001-dependency-inventory-v5.json) and [runtime notices v1 and v3](../architecture/0001-runtime-notices-v3.txt).
The room's stored layout stays 9; the service tables stay 17: no service migration.

Build directly; no prototype or scenario tool is an input. Prove the stated values with focused tests, followed by
independent checks. Report a contract conflict before dependent work.

**Design.** The maintainer approved the look on 2026-11-26. Interaction v53 states every value of it: the two new
bar buttons take the bar's existing button, tooltip and disabled looks; the link bar, the underline and the hover
card have the exact values in its part **Links in text**; the notices are the app's existing notice.

## Deliverables and boundaries

Planning source baseline main **5474239**. Use a fresh milestone worktree and branch from committed main containing
this packet, recording that prerequisite base separately from the behaviour baseline. New source files carry
`SPDX-License-Identifier: Apache-2.0`. Only these files may change, plus the append-only Implementation record below.

**Amendment A1 (2026-11-26).** Interaction v53 LT12 governs address writes while the selection is unsettled. The
amended address rule in [web modules v51](../architecture/0001-web-modules-v51.md#the-address-and-object-links)
retains the last settled object in a required page-change or address-repair write only while that object is still
valid for the page being written. Add X11-W cases for repair to another page, same-page repair before and after the
last settled object is deleted or hidden, suppression of object-only writes during an unsettled selection, and a
settled single selection writing its object. This note and the web modules v51 amendment are committed together
before the source changes.

**New (eight).**
1. `packages/board-rules/src/text-link.ts` (document v23, web modules v51)
2. `apps/web/src/text-links.ts`
3. `apps/web/src/state/use-text-links.ts`
4. `apps/web/src/ui/link-bar.tsx`
5. `apps/web/src/ui/link-hover-card.tsx`
6. `tests/text-link-rules.test.mjs`
7. `tests/text-links.test.mjs`
8. `tests/server/text-links.test.ts` (S479)

**Changed**, each only as web modules v51 **Changed files** states.

| # | File |
| --- | --- |
| 9 | `packages/board-rules/src/marks.ts`, `document.ts`, `platform.d.ts`, `objects/registry.ts` |
| 10 | `packages/board-sync/src/codec.ts` |
| 11 | `packages/board-room/src/edits.ts`, `room.ts`, `history.ts` |
| 12 | `apps/server/src/routes/boards.ts`, `apps/server/src/templates.ts` |
| 13 | `apps/web/src/App.tsx` (the ten wiring substitutions only) |
| 14 | `apps/web/src/page-links.ts`, `text-runs.ts`, `storage.ts`, `board-file.ts` |
| 15 | `apps/web/src/team/links.ts`, `team/hosted-board.ts`, `team/team-app.tsx`, `team/templates-rules.ts` |
| 16 | `apps/web/src/state/use-pages.ts`, `state/use-canvas-input.ts`, `state/use-page-keys.ts`, `state/use-editor-placement.ts`, `state/use-geometry-edits.ts`, `state/use-object-layouts.ts` |
| 17 | `apps/web/src/scene/note-body.tsx`, `scene/shape-body.tsx`, `scene/board-drawing.tsx`, `scene/export-drawing.tsx` |
| 18 | `apps/web/src/ui/context-bar.tsx`, `ui/content-field.tsx`, `ui/format-preview.tsx` (links ignored, equal-flag spans recombined), `ui/table-controls.tsx` (only the Copy link slot) |
| 19 | `apps/web/style.css` (only the twenty-one link rules, appended at the end of the file) |
| 20 | `vitest.node.config.ts`, `vitest.workerd.config.ts` (only: `tests/server/text-links.test.ts` added to `include`) |
| 21 | `tests/modules.test.mjs` and the schema-pinning tests (only the dispositions below) |
| 22 | `tests/README.md` (the new test files) |
| 23 | `docs/guides/try-board.md` (two rows, below) |

Type-only edits that follow `readLiveBoard`'s return type in `packages/board-sync/src/document-adapter.ts`,
`packages/board-sync/src/session.ts` and `packages/board-sync/src/undo.ts` are allowed, with no behaviour change. **No other package, server,
`supabase/` or manifest file changes.**

Type-only changes in other web files are allowed where the compiler needs them, with no behaviour change; the record
lists them.

New tests import the new modules dynamically inside their named checks, never at top level, so on the 5474239
baseline each new check fails by name (V12).

**Try-and-test guide.** One row at the end of Part 1's table and one at the end of Part 2's. Nothing else in the
guide changes.

Part 1 (local):

| Feature | Try this | You should see |
| --- | --- | --- |
| [Links in text](../briefs/0001-W27-links-in-text.md) | On a board with pages "Page 1" and "Ideas", add a sticky, type "Lunch at Lakeside Hall" and click Done; add a second sticky "Budget review" and a text object "See the budget", clicking Done after each. Double-click the first sticky to edit, select "Lakeside Hall", press ⇧⌘U, type `example.com`, press Return, click Done, then click empty canvas. Rest the pointer on "Lakeside Hall", then click it, and come back to the Board tab. Select "Budget review" and click Copy link to sticky. Double-click the text object to edit, select "budget", paste (⌘V), click Done, click empty canvas, rest the pointer on "budget" until the card shows, then click "budget" | "Lakeside Hall" is underlined; the card shows `https://example.com/`; the click opens it in a new tab. "Link to sticky copied. It opens in this browser only."; the pasted address links the word instead of replacing it; resting on the word shows the sticky's text; clicking it selects that sticky and brings it into view |

Part 2 (team mode):

| Feature | Try this | You should see |
| --- | --- | --- |
| [Links in text on team boards](../briefs/0001-W27-links-in-text.md) | Ben selects a sticky "Budget review" and clicks Copy link to sticky, then double-clicks another sticky to edit it, selects a word, pastes (⌘V), clicks Done and clicks empty canvas. Mia (viewer) rests the pointer on that word, clicks it, then selects any sticky and clicks Copy link to sticky. Ana deletes "Budget review"; Mia clicks the word again | Ben sees "Link to sticky copied." and the word underlined; within a few seconds Mia sees the underline. Her card shows "Budget review" with Copy link only; her click selects "Budget review" in place; "Link to sticky copied." shows under her view-only banner. After the delete, "That object no longer exists." |

Not allowed:
- a dependency, font, image file, service, service migration or import exception;
- a new stored value other than a mark's `link` (document v23), a room message, a presence key, or an Undo step for
  copying, hovering, following or the address;
- a canvas right-click menu; a rich text editor (the text field stays a plain `textarea`); links in connector labels,
  mind-map nodes, table cells or names; a preview card made from a text link;
- the address written with `pushState` or `location.hash`;
- a state hook, scene part or screen part beyond web modules v51, or effect counts other than its.

Outside the named new controls, the existing screens' markup stays exactly as at the base. The reviewer's A–J
comparison reads DOM and pixels (not stored bytes or the address); on its captures where the context bar is visible (a
selected sticky, captures 4–7) the union of the bar's baseline and candidate rectangles is masked and the new
`#link-reason` node is normalised away, because the bar now holds Link and, for one object, Copy link and is wider;
everything else is compared unmasked. The existing fit rule applies to the bar's new width, so the bar hides about
80 px sooner on narrow windows (interaction v53).

## Required behavior and concrete design

Implement document v23, sync v19, board file v7, interaction v53 and web modules v51 in full. In particular:

- **The saved form:** a mark may carry `link` (document v23), alone or with flags; marks merge only when flags and
  link are equal; schema 17, upgraded from 16 by its number only. Invalid links fail validation wherever a document
  is read, and the room treats them as an invalid update.
- **The address rule** (`linkAddress`, rules package): trim; refuse empty, over 2,048 characters, or with whitespace
  or control characters inside; add `https://` only when there is no scheme and the host part contains a dot; accept
  only `http:` or `https:`, a non-empty host, no user name or password, `href` at most 2,048 characters; store
  `href`. Local and private hosts are accepted. Checked when set, when read and before opening.
- **Text edits:** characters inserted strictly inside a link join it; at its start or end they do not. Formatting
  toggles keep links; link changes keep flags.
- **The Link button and ⇧⌘U**, the **link bar** (Return, Escape, Apply, Remove, the refusal) and **paste onto selected
  words** exactly as interaction v53, each change one Undo step.
- **Drawing:** linked pieces underlined in the text colour (also with strikethrough), in exports too; the text field
  unchanged.
- **The hover card**: 300 ms rest, 200 ms grace, live names for this board's pages and objects, the muted missing
  label, Copy link and (editors) Edit link.
- **Following** (interaction v53, LT8): in place for this board's links, `window.open(href, "_blank", "noopener,noreferrer")` for any
  other address that passes the rule, the clicked object selected; drags, modifier clicks and clicks while editing
  behave as today.
- **Object links**: `object=<id>` beside NB-118's `page`, on both board kinds; opening one shows the object's current
  page, selected and centred (current zoom in the board, the page's opening zoom on first show); a missing object
  gives `That object no longer exists.` The address follows a single selection with `replaceState` only.
- `parseLink("#/b/<uuid>")` stays exactly `{ kind: "board", board }`; `?page=` links keep 0010-W4's results.

## Shared-path check dispositions

This inventory authorizes expectation changes, not additional historical runs.

| Shared path / older checks | Disposition |
| --- | --- |
| Tests pinning the current schema 16 or a newer-than-current fixture at 17 (`tests/document*.test.mjs`, `board-file.test.mjs`, `connector-styles.test.mjs`, `connectors.test.mjs`, `images.test.mjs`, `link-cards.test.mjs` X10-U08, `mind-map.test.mjs`, `pages.test.mjs`, `shapes.test.mjs`, `strokes.test.mjs`, `tables.test.mjs`, `video.test.mjs`, `storage.test.mjs`, `board-catalog.test.mjs`, `sync*.test.mjs`, `room*.test.mjs`, `team-import.test.mjs`, `team-templates.test.mjs`, and every server check that asserts the current schema number) | Every assertion of the **current** document schema moves from 16 to 17 and every **newer-than-current** fixture from 17 to 18; historical fixtures keep their declared versions; the count of 17 service tables is unrelated and unchanged. In `room-videos.test.mjs:163–166` the iteration over live schemas gains 17 and its live-schema predicate becomes `=== 17`. Every other assertion unchanged; must pass. The record lists each changed line |
| `tests/marks.test.mjs` (marks without links: validation, `normalize`, `toggle`, `remap`, `segments`) | Unchanged; must pass as written (links are additive) |
| `tests/page-links.test.mjs` P4-U01–P4-U15 and `parseLink` checks in `tests/team.test.mjs`, `home.test.mjs`, `board-lifecycle.test.mjs` | Unchanged; must pass as written: `?page=` links and bare links keep their exact results, `?x=1` stays bad |
| Tests listing the context bar's buttons in order for a rich-text selection, if any | The Formatting group gains `Link` after `Strikethrough`; `Copy link to <kind>` comes right before `Duplicate` for a single selection; nothing else changes |
| Tests asserting the address after a selection change, if any | A settled address with exactly one selected object carries `object=<id>` (interaction v53) |
| Module inventory `tests/modules.test.mjs` | Counts, lists and effects as web modules v51 |
| The scene's paste chain (`tableData.paste`, `links.paste`, the hosted and image pastes in `App.tsx`) | Unchanged: each already returns for a paste whose target is the editor's text field (`isCanvasPasteTarget`) or whose default is prevented, so the editor's own link paste (interaction v53, LT5) never reaches them; must pass as written |
| `tests/find.test.mjs` F1-U14 (slices `sceneKeyDown` out of `use-canvas-input.ts` up to `function pointerDown(`) | `sceneKeyDown` stays unchanged and still ends right before `function pointerDown(`; must pass as written |
| Server and room tests that seed stored older boards | They keep building older boards in the old shape at their declared versions; a stored schema-16 board loads and upgrades to 17 (X11-R01 group) |
| `tests/text-runs.test.mjs` | Unchanged; must pass as written (`layoutRuns` and `Piece` keep their shapes; link spans come from the new `linkSpans`) |
| `tests/board-export.test.mjs:385–392` (X6-U09, the complete `BoardDrawing` props) | The expected props gain `pixelScale: fit.scale`; nothing else changes |
| `tests/workshop-voting.test.mjs:150` (App order assertion) and the `style.css` source checks in `tables`, `tidy-up`, `video-playback`, `workshop-voting` and `workshop-spotlight` tests | Unchanged; must pass as written |
| `tests/connectors.test.mjs:518–528` (calls `ContentField` without the new props) | Unchanged; must pass as written: `links` and `textSelection` are optional with no-op defaults |
| `tests/pages.test.mjs:343,442` (prefix byte comparisons of `style.css`) | Unchanged; must pass as written: the new rules are appended after every existing rule |
| `ui/format-preview.tsx`'s Objects-panel preview | Unchanged output for every existing document: links are ignored and spans of equal flags recombined |
| Historical browser scenarios (V14) | Read with these dispositions; any row that also fails on 5474239 is a baseline finding |

## Browser checks

New scenario **N11-S1–N11-S11**. N11 was unused as a scenario ID in existing public briefs when allocated. A fresh,
independent check run writes its tool from these clauses and the contract values. Each row prints its full ID,
`PASS:` or `FAIL:` and a summary, and keeps raw receipts and unrun rows.

Setup: 1440 × 900, scale 1, macOS Chrome, US keyboard layout, clipboard read and write granted to the app's origin.
Rows N11-S1–N11-S9 on the local app (single-user mode); N11-S10–N11-S11 on the local team stack started from the
candidate on its own uniquely owned local Supabase project, with Ana (owner), Ben (editor) and Mia (viewer) each in
their own browser context. Real pointer and key events, never painted DOM. `window.open` is intercepted in the page
(its URL, target and features recorded; no outside site is loaded). "Within 3 s" means the change shows within 3
seconds. Texts, colours and sizes exactly as interaction v53. Each row sets up its own state from its fixture, so on
the baseline every row fails by its own first new check.

**Fixture L** (local): a new board `Link check` with pages `Page 1` and `Ideas`; on Page 1 the stickies `Lunch at noon
at Lakeside Hall` (A) and `Budget review` (B) side by side, and a text object `Agenda in Ideas` + new line +
`Before lunch: Budget review` (T); on Ideas a sticky `Two`. Saved (`Locally saved`), view 100 % at (0, 0), Page 1 open,
nothing selected.
**Fixture T** (team): the guide's Part 2 seed; Ana makes the board `Link check` with Fixture L's objects and pages;
Ben and Mia open it on Page 1; every context at 100 %.

| ID | Scriptable behavior and expected result |
| --- | --- |
| N11-S1 | Fixture L. Select A: the bar's Formatting group ends `Bold`, `Italic`, `Strikethrough`, `Link`, and `Copy link to sticky` sits right before `Duplicate`; hovering Link shows `Link · ⇧⌘U`; `aria-pressed="false"`. Capture local-button (Link hovered). Press ⇧⌘U: editing starts with all of A's text selected and the link bar opens in the bar's place (the bar hidden), the field focused and empty with its placeholder, Remove link and Apply link disabled. Escape: the bar returns, the editor keeps the same selection, the Undo button's state is unchanged |
| N11-S2 | Fixture L. Edit A, select `Lakeside Hall`, click Link, type `lakeside-hall.example` and Apply link is enabled; select all and type `https://lakeside-hall.example/visit`; capture local-link-bar. Return: the bar closes and the editor keeps the selection. Click Done, then empty canvas (nothing selected): `Lakeside Hall` is underlined in the text colour at interaction v53's offset and thickness (pixel check across the words; none under `Lunch`), and A's saved mark carries `link: "https://lakeside-hall.example/visit"`. With the scene focused, ⌘Z removes the link (text unchanged); ⇧⌘Z restores it. Double-click A to edit it, then click inside `Lakeside` (caret, no selection): Link is enabled and pressed; ⇧⌘U opens the bar prefilled with the address, all selected, Remove link enabled; Escape |
| N11-S3 | Fixture L. Edit A, select `Lunch`, open the bar. For each of `javascript:alert(1)`, `data:text/html,x`, `ftp://files.example/`, `https://user:pw@files.example/`, `http://`, `localhost` and a 2,049-character `https://` address: Apply link is disabled while typing; Return applies nothing, turns the field's border red and shows the exact refusal line under the bar; typing one more character removes the line. Capture local-refused (with `javascript:alert(1)`). Then `HTTP://Example.COM` applies and is stored `http://example.com/`; with `Lunch` still selected, ⇧⌘U reopens the bar (prefilled): select all, type `http://localhost:5173/x`, Return: it replaces the link; ⇧⌘U again and Remove link removes it. Click Done: the board's Undo history holds one step for each of the three changes |
| N11-S4 | Fixture L. The tool writes `https://example.org/agenda` to the clipboard. Double-click T to edit, select `Agenda`, press ⌘V: the text is unchanged and `Agenda` carries the link. Click Done; with the scene focused ⌘Z removes the link, the text unchanged. Double-click T again, select `Agenda`, press ⇧⌘V: `Agenda` is replaced by the address (today's plain paste). Click Done, ⌘Z (the text is back), double-click T, select `Agenda` again, the tool writes `two words`, press ⌘V: the selection is replaced by `two words` (today's paste) |
| N11-S5 | Fixture L with A's link from N11-S2 made by the row's own steps. Nothing selected; the pointer rests on `Lakeside Hall`: after 300 ms (not before 250 ms) the card shows under the line with the link icon, `https://lakeside-hall.example/visit`, Copy link and Edit link, at interaction v53's values; capture local-outside-hover. The pointer moves to empty canvas: the card is gone within 500 ms. Rest on `Lakeside Hall` again until the card shows and click its Copy link: the clipboard holds the address, notice `Link copied.`. Rest again until the card shows and click Edit link: A is being edited with `Lakeside Hall` selected and the bar open, prefilled and all selected |
| N11-S6 | Fixture L. Select B, click `Copy link to sticky`: the clipboard holds the address with `page=<Page 1 id>&object=<B id>` (and the same `board`), notice `Link to sticky copied. It opens in this browser only.`; capture local-copied (the button hovered). Link `Budget review` in T to that address, and `Ideas` in T to Ideas' page link (Pages, "…", Copy link to page). Rest on `Ideas`: the page icon and `Ideas`; capture local-page-hover. Rename the page `Ideas 2` (Pages, "…", Rename page, Return) and close the Pages list; rest on `Ideas` again: the card says `Ideas 2`. Rest on T's `Budget review`: the sticky icon and `Budget review`; capture local-object-hover |
| N11-S7 | Fixture L with A's link (N11-S2's steps) and T's two links (N11-S6's steps) made by the row's own steps. Move B 1,200 px to the right of T (drag), zoom in twice from 100 % (150 %), and pan so T is in view and B is off screen. Click T's `Budget review`: only B is selected, its box centre within 2 px of the view centre, zoom still 150 %, the address carries `object=<B id>`, `history.length` and the Undo button unchanged; capture local-followed. Pan back so T is in view (Pan tool, then the Select tool) and click T's `Ideas`: Ideas opens in place. Open Page 1 from the Pages list and close the list; pan so A is in view; click A's `Lakeside Hall`: `window.open` was called with the address, `_blank` and `noopener,noreferrer`, and A is selected. Drag from `Lakeside Hall` 40 px: A moves and `window.open` is not called. Click empty canvas, click A (A selected), then Shift-click T's `Budget review`: T joins the selection, nothing opens. Edit T and click `Ideas`: the caret moves, no page change |
| N11-S8 | Fixture L. Select B: the address carries `object=<B id>`; add A to the selection: no `object`; click empty canvas: no `object`; `history.length` unchanged throughout. Navigate the tab to B's object link: the board loads on Page 1 with B selected and centred at today's opening zoom. Move B to Ideas (Move to page), Save, navigate to the same link: Ideas opens with B selected. Select B, click Delete in the context bar, Save, navigate to the link: Page 1 opens with `That object no longer exists.`, nothing selected, and the address has no `object`. The same notice for `object=nonsense`. With T's `Budget review` linked to B's link (made before the delete): click it: the same notice; then, while the notice shows, rest on it again: the muted `Not on this board any more`; capture local-missing (card and notice) |
| N11-S9 | Fixture L with A's and T's links made by the row's own steps. Copy T and paste: the copy's links hover and follow as T's do. Duplicate A: the duplicate keeps its link. Click Save and wait for `Locally saved`; Board, Save a copy to file; Board, Open board file… with that file: the links are kept. Export the board as PNG: the underline pixels show under `Lakeside Hall` |
| N11-S10 | Fixture T. Ben double-clicks A, selects `Lakeside Hall`, links it to `https://lakeside-hall.example/visit` and clicks Done; within 3 s Ana and Mia see the underline. Mia rests on it: the card has Copy link and no Edit link; capture mia-hover. Mia selects B: every bar control disabled except `Copy link to sticky`; Link is disabled with the bar's read-only reason; ⇧⌘U changes nothing. Mia clicks Copy link: `Link to sticky copied.` 8 below her view-only banner, and the clipboard holds `<origin>/#/b/<board>?page=<page>&object=<B id>`; capture mia-copied. Ana and Ben each select B and click `Copy link to sticky`: their clipboards hold B's link (checked by B's id); captures ana-copied, ben-copied. Ben clicks empty canvas (the scene focused) and presses ⌘Z: within 3 s nobody sees the underline; ⇧⌘Z: back for everyone |
| N11-S11 | Fixture T. Ben links A's `Lakeside Hall` to `https://lakeside-hall.example/visit` and T's `Budget review` to B's object link (Copy link to sticky); within 3 s Mia sees both underlines. Mia clicks T's `Budget review`: B selected and centred in place, her address carries `object=<B id>`. Mia clicks A's `Lakeside Hall`: `window.open` intercepted as N11-S7. A fresh signed-in context of Ana opens B's link: the board opens with B selected. In her first context Ana selects B and clicks Delete; within 3 s B is gone for Ben and Mia; then Ana, Ben and Mia each click T's `Budget review`: `That object no longer exists.` (captures ana-missing, ben-missing, mia-missing). Then both guide rows (Part 1, Part 2) walked as written, with `window.open` intercepted in place of the new tab: each `You should see` holds |

**Baseline (5474239).** Each row fails at its first new assertion or at the first step that needs a new control,
which is then the row's named expected failure: N11-S1–S4 and S10 at the Link button or ⇧⌘U (absent); S5, S7, S9 and
S11 at seeding a link (Link absent); S6 at `Copy link to sticky` (absent); S8 at the address after selecting B (no
`object`). The check run records each row's baseline outcome and the step it failed at.

## Acceptance criteria

- **0001-W27-AC01:** Words in stickies, shapes and text objects can carry a link, added, changed and removed with the
  Link button, ⇧⌘U or by pasting an address onto selected words; linked words are underlined in the text colour;
  links are saved, synchronised and kept in copies, board files and templates; each change is one Undo step. Look
  matches the approved design.
- **0001-W27-AC02:** Hovering a link shows its card: the live name of a page or object of this board, otherwise the
  address; Copy link for all, Edit link for editors. One click follows a link to this board in place and opens any
  other link in a new tab. Only `http` and `https` addresses are accepted, checked when saved, read and opened.
- **0001-W27-AC03:** Copy link copies a link to any single selected object, for viewers too; it opens the board on the
  object's current page with the object selected and in view; the address follows a single selection; a link to a
  deleted object says so.

| Criterion | Evidence that shows it |
| --- | --- |
| 0001-W27-AC01 | N11-S1–N11-S4, N11-S9, N11-S10; X11-R01; X11-W01; S479; V4 |
| 0001-W27-AC02 | N11-S3, N11-S5–N11-S7, N11-S10, N11-S11; X11-R01; X11-W01; V4 |
| 0001-W27-AC03 | N11-S6, N11-S8, N11-S10, N11-S11; X11-W00; X11-W01; V4 |

## Applicable DESIGN.md guardrails

Canvas-first shell, native controls and visible focus, minimum action hits, protected native editing and independent
state owners apply. The two new bar buttons are the bar's own buttons, reachable by keys; the link bar is a native
input with labelled buttons. Interaction v53 states every new word and value; never infer generic styling. No new
sound, font or image file.

## Validation commands and expected evidence

Use pinned Node 26.13.0 and npm 11.20.0 from the repository root. Source validation is not independent acceptance.
Each check run restates **every V row it reruns** as its own `PASS: Vn ...` / `FAIL: Vn ...` line with SHA, logs and
counts.

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
npm run test:server:node
npm run test:server:workerd
WRANGLER_SEND_METRICS=false npx wrangler deploy --dry-run --outdir <scratch> -c apps/server/wrangler.json
git diff --name-status <prerequisite-base>..<validated-source>
git diff --check <prerequisite-base>..<validated-source>
```

The room's codec and repair change, so the counted server suites (S479 included) are taken from the Checks workflow
run on the exact candidate commit (V9), and a short server-only run checks on both runners only what that workflow
does not count. The check run starts the team stack on its own uniquely owned local Supabase project. Record each
long run's start and end and the host's sleep and wake events; a run that overlapped a sleep is INVALID and is rerun
awake. Three manual checks from this milestone are chosen only at Review.

| Check | Command/inspection and pass condition |
| --- | --- |
| V1 | Byte-compare manifests, locks, dependency inventory and runtime notices against the prerequisite base: unchanged, no new dependency |
| V2 | `npm ci --ignore-scripts --no-audit --no-fund` exits 0 on the clean candidate and on the independent baseline |
| V3 | `npm run typecheck` exits 0 across all five workspace members |
| V4 | `npm test` full suite exits 0, X11-R and X11-W included. Guards as web modules v51 |
| V5 | Team-off `npm run build` and `audit:licenses` exit 0; notices equal runtime notices v1 (team off) |
| V6 | `npm run build:fixtures`, team-on `npm run build` and `audit:licenses` exit 0; team-on notices equal runtime notices v3 |
| V7 | `npm run build:server`, `audit:licenses` and the wrangler dry run exit 0; no deploy |
| V8 | Inspect all hunks plus `git diff --name-status` and `git diff --check` over `<prerequisite-base>..<validated-source>`: only the deliverables, the dispositions and the append-only Implementation record; App.tsx differing only by web modules v51's wiring points; `style.css` only by its rules; no `window.open` in `apps/web/src` for a text link other than the one LT8 call with `noopener,noreferrer`; no `pushState` or `location.hash` write for the object value |
| V9 | The Checks workflow's server suites (Node and workerd) pass on the exact candidate commit, S479 included; the server-only run passes on both runners |
| V10 | N11-S1–N11-S11 pass with the state captures and raw receipts, and the baseline outcomes are recorded |
| V11 | Design, one receipt per approved screen: local-1-button ↔ local-button; local-2-link-bar ↔ local-link-bar; local-3-outside-hover ↔ local-outside-hover; local-4-page-hover ↔ local-page-hover; local-5-object-hover ↔ local-object-hover; local-6-followed ↔ local-followed; local-7-copied ↔ local-copied; local-8-refused ↔ local-refused; local-9-missing ↔ local-missing; team-1-mia-hover ↔ mia-hover; team-2-ana/ben/mia-copied ↔ ana-copied, ben-copied, mia-copied; team-3-ana/ben/mia-missing ↔ ana-missing, ben-missing, mia-missing. Texts and positions may differ by the fixture |
| V12 | Once, on an independent 5474239 source and build with the candidate's new unit test files and S479's test file copied in, both Vitest configs' `include` lists given that file (a test-only change), and **no** candidate runtime source: every check that proves new behaviour fails by name; a top-level setup or import abort does not count. X11-W00 passes on both |
| V13 | Accepted A–J compare: baseline twice, then candidate and diffs, with existing normalization; only the context bar's box masked where it is visible (Deliverables) |
| V14 | Accepted regression runs: V4, V9, V13 and the 0010-W4 scenario N4 on the candidate, read with the dispositions above. Any row that also fails on 5474239 is a baseline finding |

Server check (both runners, in `tests/server/text-links.test.ts`):
- **S479** links in a room: a client's update setting a mark with a valid `link` is
accepted, stored and sent to the other clients; on a rich-text object a malformed `link` (`javascript:`, a user name,
over 2,048 characters, a non-normalised value) is `invalid_update`; a normalised `link` on a connector's marks is
`invalid_document` (`Invalid object paint`, as today's rule that connector marks are empty); the room's repair keeps
valid links through `normalize`; creating a board with links and importing a board at schema 17 with links keep them;
a team template upload holding a linked sticky is accepted and one holding a bad link refused; a stored schema-16
history capture produces no new capture after the board is upgraded to 17. Fixtures: boards built in their declared
shapes (never by deleting keys from a current board).

**Unit checks** (web modules v51 **Tests**; each named, importing new modules inside the check):
- `tests/text-link-rules.test.mjs`, checks **X11-R01** onward: document v23's Verification items for `linkAddress`
  (including `example.com:8080/x` → `https://example.com:8080/x`), `linkAt`, `touchesLink`, `setLink`, `remap`,
  `toggle`, `normalize`, `segments`, `validMarks`, `validate` (schema 17, rich text only, the address rule, the normal
  form, a `link` at 16 refused, a linked `mindNode` refused) and `upgrade` 16 → 17; `remap` with the editor's edit range
  and its fallback; `setLink` snapping to graphemes; readback of links through local storage (`storage.ts`), a board
  file (`board-file.ts`) and a team template save and add (`team/templates-rules.ts`); a history preview and capture
  keeping links (`packages/board-room/src/history.ts`); a real board-sync session (`packages/board-sync/src/session.ts`)
  setting, changing and removing a link with Undo and Redo, and a concurrent text edit by a second session, as sync v19
  states; a room board stored at schema 16 (built in the old shape, not by
  deleting keys) loads through `packages/board-room` and upgrades to 17 without the stack; the two modules load without
  the DOM.
- `tests/text-links.test.mjs`, checks **X11-W01** onward: every item of web modules v51's list for that file (address
  reading and building with `object`, same-board recognition, kinds and notices, live labels, the shortcut, pieces split
  by `linkSpans`, hit-testing, the card's placement, the Link button's reasons and pressed state, paste onto
  words, the scene parts' underline).
- **X11-W00** (compatibility, V12): `parseLink` and `readHostedBoardLink` give 0010-W4's exact results for a bare board
  link and a `?page=` link, using only modules that exist at 5474239. Passes on both revisions.

A regression failure that also fails on 5474239 is a baseline finding to report, never fixed here.

## Review focus and public references

Review that:
- the address rule runs at every entry (set, paste, read from storage, file, template, codec, repair) and again before
  `window.open`, and nothing but `http`/`https` can be opened;
- a link is never followed while editing, on a drag or on a modifier click, and following adds no Undo step;
- the hover card never shows over an object being edited and hides on pan, zoom and selection changes;
- the object value in the address is written only with `replaceState`; Back and Forward history is unchanged;
- `parseLink` and 0010-W4's page-link results are unchanged for links without `object`;
- viewers can copy object links and follow links but never add, change or remove one by any path;
- App.tsx and `style.css` change only as stated.
- moving focus to the link bar's field does not end editing (today the editor's blur ends it), and the selected
  words stay visibly selected while the bar is open, as the approved screen shows (interaction v53, LT3);
- the underline's place and thickness come from interaction v53's values (±1 px), not from the canvas library's own
  underline.

Left for the check run and review after the second pre-commit read (the read cap):
- the press record's live-hit match at release when a remote edit lands during the press, and the one same-link press
  within 500 ms suppressed with its `dblclick` (interaction v53, LT8);
- the hover card's show and cancel timing against menus and panels that open and close during the 300 ms rest;
- the edit range passed to `remap` for word and line deletes, composition and paste (web modules v51), proved with
  links inside, at the start and at the end of a run;
- the selected words' inactive-selection look and the kept editor outline while the bar is open, against the approved
  `local-2-link-bar` screen (the approved screen shows the focused blue highlight);
- the underline's place and thickness within ±1 px at 100 % and 150 % and in a PNG export;
- the wider context bar's fit (it can hide about 80 px sooner) and the A–J mask;
- Copy link in every table mode for a viewer;
- history previews and backups at their declared versions after the upgrade to 17.

The public source basis is main 5474239 and the linked versioned contracts, read 2026-11-26. Outside facts relied on:
the WHATWG URL standard (`URL`, `href` serialisation) and the HTML standard's `noopener` and `noreferrer` window
features. No unresolved product decision is delegated to implementation.

## Exclusions and reasons

- A canvas right-click menu: Copy link is a context-bar button instead.
- Underlines inside the text field while editing: the field stays plain text, as for bold today.
- Links in connector labels, mind-map nodes, table cells and names.
- A preview card made from a text link; a page value or object in the Share dialog's and home lists' Copy link.
- Repairs to separately tracked baseline failures.

## Implementation record

Append-only. The implementer adds dated sections here.
