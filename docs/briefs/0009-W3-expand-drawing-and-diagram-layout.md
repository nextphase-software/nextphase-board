BRIEF VERSION: 0009-W3 v1 (2026-11-14)
# 0009-W3 — Expand drawing and diagram layout

Status: Draft. Implementation has not started under this brief.

## Outcome and read first

The drawing bar gets a fourth tool, **Washi tape** (W): dragging lays a straight strip of patterned
tape with torn ends in one of six original patterns, and a click lays a short one; a selected strip has
an end handle on each end and a small bar with its pattern, Duplicate and Delete; the eraser leaves tape
alone. The shape menu, the Shapes panel and Objects offer **twelve more shapes** with their own
outlines, text areas and connector ends. With three or more objects selected, **Tidy up** (button or
⌥⇧T) previews them in an even grid in reading order, with editable columns and spacing and a spacing
handle in every gap; Apply keeps it as one Undo step, Cancel puts everything back. Objects keep their
identities and connectors follow them, on local and hosted boards.

Read [AGENTS.md](../../AGENTS.md), [CONTRIBUTING.md](../../CONTRIBUTING.md),
[DESIGN.md](../../DESIGN.md) and these three new contract files (prior versions remain untouched):

| Contract | New version / ownership |
| --- | --- |
| [Document](../architecture/0001-document-v17.md) | v17: the `tape` type and its rules, the fourteen shape kinds, schema 12, reading 1–11, version references in other contracts, the room's load upgrade from 10 or 11, the adapter |
| [Interaction](../architecture/0001-interaction-v41.md) | v41: the Washi tape tool, drawing bar, gesture, look, selection, end handles, exclusions and bar; the kinds' outlines, text boxes, connectors, menu, panel and Objects; Tidy up's offer, order, grid, preview, bar, Apply, Cancel, hosted rules, keys and words |
| [Web modules](../architecture/0001-web-modules-v39.md) | v39: eight new source modules and four test files, the counts, the App.tsx substitutions, the seams, the registry changes and the type rename |

Use this set wherever inherited contracts link a replaced version. Document v17 states the only
change to [storage v3](../architecture/0001-storage-v3.md), [board file v4](../architecture/0006-board-file-v4.md),
[hosted persistence v10](../architecture/0003-hosted-persistence-v10.md),
[hosted storage v11](../architecture/0003-hosted-storage-v11.md), [sync v13](../architecture/0003-sync-v13.md),
[board lifecycle v5](../architecture/0006-board-lifecycle-v5.md), [API v12](../architecture/0003-api-v12.md),
[team templates v1](../architecture/0008-team-templates-v1.md) and the
[activity catalogue v1](../architecture/0008-activity-catalogue-v1.md) (document version 12; activities
stay 7). Unchanged: [access v13](../architecture/0003-access-v13.md),
[presence v4](../architecture/0004-presence-v4.md), [identity v4](../architecture/0003-identity-v4.md),
[self-host runner v7](../architecture/0003-self-host-runner-v7.md),
[voting v2](../architecture/0007-workshop-voting-v2.md) (tapes are not votable; every shape kind is, as
shapes are), [timer v2](../architecture/0007-workshop-timer-v2.md), [comments v4](../architecture/0005-comments-v4.md),
[toolchain v5](../architecture/0001-toolchain-v5.md), [lock v5](../architecture/0001-dependency-lock-v5.json),
[inventory v5](../architecture/0001-dependency-inventory-v5.json),
[runtime notices v3](../architecture/0001-runtime-notices-v3.txt). fileVersion 2, room layout 7, backup
envelope 1 and 17 service tables remain. Nothing new is stored outside the document; Tidy up stores
nothing of its own.

Build directly; no prototype or scenario tool is an input. Prove the stated values with focused
tests, followed by independent checks. Report a contract conflict before dependent work.

## Deliverables and boundaries

Planning source baseline main **5397b75**. Use a fresh milestone worktree and branch from committed
main containing this packet, recording that prerequisite base separately from the behaviour baseline.
New source files carry `SPDX-License-Identifier: Apache-2.0`. Only these files may change, plus the
append-only Implementation record below.

**New (twelve).**
1. `packages/board-rules/src/objects/tape.ts`; 2. `apps/web/src/tape.ts`; 3. `apps/web/src/tidy-up.ts`;
4. `apps/web/src/scene/tape-body.tsx`; 5. `apps/web/src/scene/tidy-up-layer.tsx`;
6. `apps/web/src/ui/tape-controls.tsx`; 7. `apps/web/src/ui/tidy-up-bar.tsx`;
8. `apps/web/src/state/use-tidy-up.ts` (all as web modules v39);
9. `tests/tape.test.mjs`; 10. `tests/shape-kinds.test.mjs`; 11. `tests/tidy-up.test.mjs`;
12. `tests/server/drawing-layout.test.ts` (Server checks).

**Changed: packages.**
13. `packages/board-rules/src/document.ts` (version 12, tape keys, `upgrade`, `empty`,
`BoardV12`/`ItemV12`); 14. `objects/registry.ts` (`OBJECT_TYPES`, `objectKeys`, the tape predicate,
`eligibleIdea` without tapes, `outlinePoint`, `toolForKey` skipping kinds without a key, `ADD_OPTIONS`
Square and Circle only); 15. `objects/shape.ts` (kinds, version gate, text
boxes, `fitHeight`); 16. `objects/stroke.ts` (`DRAWING_TOOLS`, `drawingKey`);
17. `packages/board-sync/src/codec.ts` (version 12); 18. `packages/board-sync/src/comments.ts` (a tape's
name); 19. `packages/board-room/src/edits.ts`; 20. `history.ts` (accepts 10, 11 and 12; the
upgrade-only capture rule of document v17); 21. `room.ts` (new boards 12; the load upgrade from 10 or 11).

**Changed: server.** 22. `apps/server/src/routes/boards.ts`, 23. `apps/server/src/templates.ts`
(version 12).

**Changed: web** (under `apps/web/src/`). 24. `storage.ts`, 25. `board-file.ts`,
26. `team/templates-rules.ts` (version 12); 27. `strokes.ts` (the eraser keeps strokes only);
28. `connectors.ts` (outline clipping by kind; tape hits and box selection in `hitObject` and
`selectInBox`); 29. `sections.ts` (tape as a member; `objectLabel` for tapes); 30. `group.ts` (tape as a
member, only if needed); 31. `clipboard.ts` (only if tape points need it); 32. `icons.tsx` (the Washi
tape, Tidy up and twelve kind icons); 33. `state/use-canvas-input.ts`, 34. `state/use-board-document.ts` (only if a commit path needs the
preview closed first), 35. `state/use-gesture-state.ts`, 36. `state/use-selection.ts`, 37. `state/use-object-layouts.ts`,
38. `state/use-editing-commands.ts`, 39. `state/use-geometry-edits.ts`, 40. `state/use-command-reasons.ts`
(the Tidy up preview reason); 41. `scene/board-drawing.tsx`, 42. `scene/shape-body.tsx`,
43. `scene/inline-editor.tsx` (only if the editor box needs the kind's text box);
44. `ui/drawing-tools.tsx`, 45. `ui/shape-controls.tsx`, 46. `ui/shapes-panel.tsx`, 47. `ui/context-bar.tsx`,
48. `ui/objects-panel.tsx`, 49. `ui/palette.tsx` (only if the Draw button's icon needs the tape tool);
50. `App.tsx` (only the eleven substitutions of web modules v39); 51. `apps/web/style.css` (the drawing bar's
pattern buttons, the two-column shape menu, the Shapes panel grid, the tape bar, the Tidy up button,
bar and handles).

**Changed: tests and test configuration.** 52. `tests/modules.test.mjs` (counts and App test of web
modules v39); 53. `tests/objects.test.mjs` (type list, predicates, `objectKeys`, `labelPrefix`) and `tests/shared-editing.test.mjs` (the every-type loop); 54. `tests/strokes.test.mjs`
(only the `DRAWING_TOOLS`/`drawingKey` expectations that gain the tape); 55. `tests/shapes.test.mjs`
(only expectations that list the kinds); 56. `vitest.node.config.ts` and 57. `vitest.workerd.config.ts`
(include `tests/server/drawing-layout.test.ts` only); 58. `tests/README.md` (the new files); and the
version and rename-only test edits in **Shared-path check dispositions**. New tests import the new
modules dynamically inside their named checks, never at top level, so on the 5397b75 baseline each new
check fails by name (V10).

**Rename-only files.** Any other file whose diff only replaces `BoardV11`/`ItemV11` with
`BoardV12`/`ItemV12` (and a `schemaVersion` literal type 11 → 12). V8 inspects every hunk.

Not allowed: a dependency, font, image file, service, import exception, state hook or screen part
beyond web modules v39, room layout or service-table change.

Outside the named new controls, the existing screens' markup stays exactly as at the base: the
reviewer's A–J comparison allows only the masks listed under validation.

## Required behavior and concrete design

Implement document v17, interaction v41 and web modules v39 in full. In particular:

- **Schema.** The tape's keys, values and order; the tape record of web modules v39 (`tool` null,
  `points` false, `kinds` empty, `sizeRange` 28–2,028); the tape rules (pad 14, exactly two points,
  length 16–2,000); tapes not eligible ideas; the fourteen kinds, the twelve new ones only from 12; 1–11 read and upgraded in memory;
  new boards 12; "newer" above 12; the 5397b75 app shows a 12 board as newer.
- **Tape.** W and the drawing bar's fourth tool (icons chosen by tool name, never by position); six
  pattern buttons with the session pattern (Stripes first); drag, click (160), the 16/2,000 clamp and
  the whole-unit rule that keeps every saved length valid;
  the band 28 with torn ends (six steps, 3 deep), 0.9 opacity, the hairline edge and the six pattern
  tiles of interaction v41 drawn by the app and turned with the band; hits within 4 CSS px of the band;
  the selected outline and 10 px end handles; end drags; no resize handles in any selection holding a
  tape; the tape bar (`Washi tape` / `<n> tapes`, `Pattern: <name>` with its menu, Duplicate, Delete);
  the Objects label and pattern list; the comment name; the eraser never touching a tape.
- **Shapes.** The twelve outlines, the round joins, Square's paint and text styling for every kind; the
  per-kind text boxes and Grow by kind; straight ends on the centre line and curved ends from the side
  midpoint, both clipped to the kind's outline; the two-column menu
  (360 px); the 4-column 52 px Shapes panel grid with names in tooltips and accessible names; the
  Objects select of fourteen; the Add list unchanged.
- **Tidy up.** Placeable items (groups and sections one item each, connectors never); the reading
  order; the grid (`ceil(√n)` columns 1–n, spacing 24 in 0–400, cells by widest and tallest, centred on
  the old bounds, inside the board, offsets `round(target − current)` shared by members); the preview (grid rectangle, handles in every
  occupied gap, the dragging label, nothing saved or recorded, the selection chrome hidden through the
  preview selection); the bar and its fields; Apply as one transaction and one Undo step changing
  positions only; every Cancel route; any other edit applying to the real board and closing the
  preview when it touches a placed item; the reasons; ⌥⇧T; nothing
  under 768 px; hosted: local preview, one edit, cancel with the toast when a collaborator touches a
  placed item.
- **Hosted.** One transaction and one shared Undo step per change; the room's load upgrade from 10 or
  11 (no edits row, no history version); history snapshots 10, 11 and 12.

## Shared-path check dispositions

This inventory authorizes expectation changes, not additional historical runs.

| Shared path / older checks | Disposition |
| --- | --- |
| Document version in units: `document.test.mjs` (:19–20 the `[1..11]` loop and `versioned` helper, the invalid version at :42 becomes 13, :116, :131, :134, :245, :292, :374), `mind-map.test.mjs` (:65, :66–69, :73), `shapes.test.mjs:39`, `connectors.test.mjs:36`, `strokes.test.mjs:31, :95`, `images.test.mjs:26, :55`, `connector-styles.test.mjs:44, :83, :477, :538`, `storage.test.mjs:91, :115, :131`, `board-file.test.mjs:42, :55, :78, :138`, `board-catalog.test.mjs:235, :322`, `team-import.test.mjs:64`, `team-templates.test.mjs:48` | 11 → 12 and the "newer" probe 12 → 13; every other assertion stays. `mind-map.test.mjs`'s upgrade loop covers 1–11 |
| Version 11 boards handed to Room or Adapter: `mentions.test.mjs:175`, `board-history.test.mjs:143`, `board-lifecycle.test.mjs:86`, `workshop-voting.test.mjs:18`, `workshop-reactions.test.mjs:18`, `workshop-spotlight.test.mjs:18, :91` | 11 → 12 (or kept at 11 where the test is about the load upgrade); results unchanged |
| Import fixture: `tests/import-fixture.mjs:26` (`sizedBoard` default version) | 11 → 12 only; its other callers keep their results |
| Server suites: `tests/server/mind-maps.test.ts` (:105, :107, :114, :122, :189, :213 assert 11; :86–87 and :175 stay 10), `history.test.ts:43–44, :55, :140`, `lifecycle.test.ts:56, :166`, `shared.test.ts` (`sizedBoard` default at :911–912, :992, :997; the `BoardV11` type) | 11 → 12 where a check asserts or imports the current version; a check about a stored or upgraded older version keeps it; assertions otherwise unchanged. `shared.test.ts:910` (version 9 refused) and `transition.test.mjs:20` unchanged |
| Module inventory: `tests/modules.test.mjs` | 15 package files, 10 object types, 15 scene parts, 29 screen parts, 23 state hooks, `use-tidy-up.ts` effects at most 2, other effect counts unchanged; the "0009-W2 App composition" test (:583–602) rewritten to base 5397b75 with the eleven substitutions of web modules v39 |
| Object registry: `tests/objects.test.mjs` | :11 the type list gains `tape` last; the `OBJECT_TYPES` loops include it (`points` flag false for tape); :45's `eligibleIdea` expectation also excludes tapes (`&& !isTape(o)`); :114's placement expectations unchanged (tape `tool` null); :128 unchanged; :147–152 loop over all fourteen kinds (`kindForTool` by name, each new kind's tool being its name; `toolForKey` only R and O; :150's `labelPrefix` expectation becomes the kind's name in lower case, which differs from the kind value for the five hyphenated kinds); :155 `ADD_OPTIONS` labels unchanged |
| Mind map: `tests/mind-map.test.mjs:42` (`OBJECT_TYPES.at(-1)`) | Becomes the mind node's index before tape (for example `OBJECT_TYPES.at(-2)`); nothing else |
| Shapes: `tests/shapes.test.mjs` (:58, :165 loops over `SHAPE_KINDS`; :63's invalid-kind probe `"triangle"`; :390 the Square and Circle pointer-placement loop; :452–462 `ShapeControls`) | Loops cover all fourteen kinds with their own expectations; the :63 probe becomes `"hexagon"` (triangle is valid at 12); :165's minimality probe (`height − 1e-6` must not fit) applies to Square, Rounded rectangle and Circle only, and fraction kinds instead assert their height is the smallest whole height that fits; :390 unchanged; any expectation listing the menu's names becomes the fourteen names; `Shape: Square` unchanged |
| Strokes: `tests/strokes.test.mjs` (:177–191 `erasedStrokes`, :336–346 `drawingKey`) | Unchanged results; W added to the `drawingKey` table; a tape beside the strokes is never erased |
| Voting: `workshop-voting.test.mjs:56`, `server/voting.test.ts:52` | Unchanged (tapes not votable) |
| Every-type loop: `shared-editing.test.mjs:74` | The loop's filter also skips `tape` (as it skips the stroke), and the test pushes one literal valid tape (as it pushes the literal stroke at :79); the round trip assertion unchanged |
| Activities and Templates: `activities.test.mjs`, 0008-W1 Q | Activities stay version 7 and insert unchanged onto a 12 board |
| Mind maps: 0009-W2 M9 | Its version expectations move 11 → 12; every other row unchanged |
| Local shell: A–J | Unchanged; a screen that shows the drawing bar or the Shapes panel is the one declared mask on that region |

## Server checks

New `tests/server/drawing-layout.test.ts`, run on both runners by the existing suites:

| ID | Check |
| --- | --- |
| S407 | A room whose stored state holds a version 11 board (seeded into the room's storage directly, as `mind-maps.test.ts` seeds version 10) serves it as version 12 with the same objects; a reload with no edit serves 12 again; the upgrade adds no edits row and no history version; an edit adding a tape and a diamond is accepted, and a reload serves 12 with both |
| S408 | Edits whose result holds a tape with three points, a length of 15, a pattern `"plaid"`, a `color` key, or a shape of kind `"hexagon"` are each refused and change nothing; an edit whose document sets `schemaVersion` 11 and adds a diamond is refused |
| S409 | A stored version 11 history snapshot restores as a version 12 board; a version 12 snapshot with a tape and a star restores them with their keys |
| S410 | The board import route accepts a version 12 board holding a tape and all fourteen kinds, and refuses one holding a tape whose points break the tape rules |

## Browser checks

New scenario **D9-S1–D9-S26**. D9 was unused in existing public briefs when allocated. A fresh
independent check run writes its tool from these clauses and the contract values; each row prints its
full ID, `PASS:`/`FAIL:` and a summary, retaining raw receipts and unrun rows. Local board unless a row
says hosted: a new local board named "Layout check". 1280 × 800, scale 1, 100% zoom, unless stated. Use
real pointer and key events, never painted DOM. New capability rows also fail by name on independent
baseline 5397b75. Derived positions ±0.5 CSS px (from the saved objects by the contracts' rules);
colours and sizes exactly as interaction v41; canvas pixel colours ±8 per channel. Save a real-state
image for D9-S1, S5, S11, S12, S13, S17, S18, S20, S21 and S24 at 1280 × 800 (S24 also at 375 × 812).
Texts, positions and sizes in the mock-up's PNGs are sample data; every look is a value.

| ID | Scriptable behavior and expected result |
| --- | --- |
| D9-S1 | The Draw button opens the drawing bar with Marker, Highlighter, Washi tape, Eraser (the Washi tape's `title` `Washi tape · W`); W on the canvas arms Washi tape; the bar then shows one divider and the six pattern buttons by name in order, Stripes pressed, and no Thin, Thick, second divider or colour dots; each tool button shows its own icon (the Eraser's unchanged from 5397b75). Capture washi-bar |
| D9-S2 | A drag of 200 CSS px at 20° saves one `tape` with pattern `stripes`, points at the press and release made whole by interaction v41's rule, its rectangle by document v17 (pad 14); the tool stays armed and nothing is selected; one Undo removes it. A 5 px drag at 20° saves a tape of length at least 16 (end made whole by the rule); a click saves a horizontal 160-unit tape starting 80 units left of the press |
| D9-S3 | Choosing Dots, then Marker, then Washi tape again keeps Dots pressed; a new tape is `dots`; the session pattern is unchanged after changing a selected tape's pattern |
| D9-S4 | Three tapes over three stickies: canvas pixels at each band's centre line show its pattern's ground or foreground at 0.9 over the sticky; a pixel 1.5 units inside a torn end at a tooth valley shows what is under the tape; the 0.9 opacity holds for every pattern |
| D9-S5 | Select a tape: outline 4 px outside the band, end handles 10 px at both points, no resize handles or connection dots; bar items exactly `Washi tape`, `Pattern: Stripes`, Duplicate, Delete, placed by the context bar's rule. Capture washi-selected |
| D9-S6 | The Pattern menu lists the six patterns by name with swatches, the current one pressed; choosing Grid sets `grid`, one Undo restores; two tapes of different patterns show `Pattern: Mixed` and the label `2 tapes` |
| D9-S7 | Dragging the end handle moves only that point; the rectangle follows document v17; dragging it 5 units from the other end stops at length 16; Escape during the drag changes nothing; release is one Undo step |
| D9-S8 | A press on the band selects the tape; a press on an empty corner of its rectangle over a sticky selects the sticky; dragging the band moves the tape (points unchanged relative, x and y moved) |
| D9-S9 | An Eraser gesture crossing a tape and a marker stroke deletes the stroke only; one Undo restores it; the tape is untouched throughout |
| D9-S10 | With one tape selected, Objects shows the stroke's controls minus Colour and Weight plus a `Pattern` select, and its size buttons are unavailable with `Washi tape can't be resized.`. With a tape and a sticky: Group then Ungroup work; copy and paste and Duplicate keep the tape's relative points and pattern; a section drawn around it captures it; Objects lists `washi tape <n> · Stripes` with its pattern list; no connection dots on the tape and a connector dragged from the sticky cannot end on it; with the tape selected with a sticky, no resize handles show |
| D9-S11 | On a selected square the shape menu shows fourteen kinds in two columns, row by row in kind order, 360 px wide; choosing Diamond keeps the id, size, text, colours and its connector, sets `diamond`, one Undo restores; the bar reads `Shape: Diamond`. Capture shape-menu |
| D9-S12 | The Shapes panel shows fourteen 52 × 52 icon tiles in 4 columns with 8 px gaps; tooltips and accessible names are the kind names (`Square · R`, `Circle · O` tooltips); clicking Star arms it and a canvas click places a 180 × 180 `star`. Capture shapes-panel |
| D9-S13 | Each of the twelve new kinds placed at 180 × 180 with the text `Two lines` + `of text` (Small): canvas pixels on each outline's vertices (or arc midpoints) show the border colour and the text's ink lies inside the kind's text box. Capture new-shapes |
| D9-S14 | After typing a long text into a diamond and ending the edit, its Grow button grows it by the kind's rule (height from its y span, rounded up); a square keeps today's growth |
| D9-S15 | A rounded rectangle and a triangle whose centres differ by 120 units vertically, joined right dot to left dot: as a straight connector, its drawn end at the triangle is where the centre-to-centre line leaves the triangle's outline; switched to curved, where the segment from the triangle's left side midpoint toward its centre meets the outline (±1 px each); switched to elbow, today's route |
| D9-S16 | Objects' kind select for a shape offers the fourteen names; its Add list still offers Square and Circle only; R and O still arm Square and Circle |
| D9-S17 | Six scattered stickies selected: the multi-object bar shows Tidy up right after Arrange, then a new divider, then Duplicate; its tooltip span reads `Tidy up · ⌥⇧T`; with two stickies it is unavailable and its `title` is `Select three or more objects to tidy up.`; with three stickies and a mind node, it shows unavailable in the same place with `Mind map nodes are placed by their map.`; a single sticky's bar and a three-stroke bar show no Tidy up, and ⌥⇧T with three strokes selected opens the preview. Capture tidy-select |
| D9-S18 | Tidy up on the six: the preview shows them in 3 columns by reading order, spacing 24, centred on the old bounds' centre; the grid rectangle; 7 handles (4 vertical, 3 horizontal); bar items exactly `Tidy up`, `Columns`, `Fewer columns`, `3`, `More columns`, `Spacing`, `24`, `Cancel`, `Apply`; no saved change, no history step, save state unchanged. Capture tidy-preview |
| D9-S19 | + and − change columns between 1 and 6 (− unavailable at 1, + at 6), the preview following; typing 2 then Enter gives 2 columns; typing 9 or `x` puts the value back; Spacing typed 0 and 400 accepted, 401 put back |
| D9-S20 | Dragging the first vertical handle 16 CSS px right at 100% zoom sets spacing 40 with the label `40` beside it during the drag, the line 3 px and the circle filled. Capture tidy-spacing |
| D9-S21 | Apply: one transaction changes only the six stickies' `x` and `y` (ids, order, text, groups, sections and a connector between two of them unchanged; the connector follows); the notice `Tidied 6 objects into 3 columns.`; the six stay selected with the normal bar; one Undo restores every old position, Redo the grid. Capture tidy-applied |
| D9-S22 | While the preview is open Duplicate, Delete and Copy are unavailable with `Apply or cancel Tidy up first.`, and focus is on the canvas. Each Cancel route (the button, Escape, a canvas press off the handles, choosing the Sticky tool) leaves every object where it was with no history step; the button and Escape show `Tidy up cancelled.`; with a preview open after an earlier move of one sticky, ⌘Z undoes that move on the real board and closes the preview |
| D9-S23 | A selection of a group of two stickies, a section holding a shape, a marker stroke, a tape and a connector between the group and the shape: four items are placed (group and section whole, members moving with them), the connector is not placed and follows |
| D9-S24 | ⌥⇧T opens the preview for the six; at 375 × 812 no bar shows and ⌥⇧T does nothing; narrowing the window under 768 during a preview cancels it. Capture narrow |
| D9-S25 | Hosted (team stack, ana and ben on "Team test board"): ana's tape and diamond appear for ben; ana's Tidy up preview is not seen by ben; ana's Apply reaches ben as one change and ana's one Undo reverts it for both; while ana previews, ben moving one placed sticky cancels ana's preview with the toast `Tidy up was cancelled because the objects changed.` |
| D9-S26 | Save, reload: tapes, patterns, points and every kind identical; Save a copy to file and open it: identical; opening that file in the 5397b75 app (served separately) shows the existing "made by a newer version" refusal and changes nothing; a board file saved by the 5397b75 app (version 11, a sticky and a mind map) opens unchanged in the candidate and saves as version 12 |

## Acceptance criteria

- **0009-W3-AC01:** On local and hosted boards, Washi tape (W) draws straight 28 px strips in the six
  original patterns by drag or click; a strip's ends and pattern can be changed; the eraser leaves tape
  alone. The shape menu, the Shapes panel and the Objects panel offer the 12 new kinds, each drawn with
  its outline, its text box, Square's paint options and connectors clipped to its outline. Tape and the
  new kinds save, reopen and sync at schema 12, and the rules refuse them below 12. Look and placement
  match the approved design.
- **0009-W3-AC02:** With 3 or more placeable items selected, Tidy up (button or ⌥⇧T) previews them in
  a grid by the reading order and grid rules of interaction v41; Columns (1 to n), Spacing (0–400) and
  the spacing handles change the preview at once; connectors follow; mind nodes refuse it; nothing is
  saved or sent while it is open.
- **0009-W3-AC03:** Apply commits one edit that changes only the placed items' positions; one Undo
  restores every old position and Redo the grid, locally and hosted; ids, text, groups, stacking,
  sections and connectors are unchanged. Cancel, Escape, a click on empty board or another tool restore
  the old places with no edit; a collaborator's change to a previewed item cancels the preview with a
  notice.

| Criterion | Evidence that shows it |
| --- | --- |
| 0009-W3-AC01 | D9-S1–D9-S16; D9-S25; D9-S26; S407–S410; V4; V9 |
| 0009-W3-AC02 | D9-S17–D9-S20; D9-S23–D9-S24; V4; V9 |
| 0009-W3-AC03 | D9-S21–D9-S22; D9-S25; V4; V9 |

## Applicable DESIGN.md guardrails

Canvas-first shell, native controls and visible focus, minimum action hits, protected native editing
and independent state owners apply. Interaction v41 states every new look, word and key; never infer
generic styling. No new sound, font or image file. Preserve the complete selection chrome of every
other type.

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

After the build and before browser check 1, one fresh server-only run clean-clones the candidate,
installs, creates a uniquely owned local Supabase project from committed config, installs the schema
and runs Node then workerd (`node tests/server/make-signing-key.mjs`, `npx supabase start`,
`node tests/server/write-stack-info.mjs`, `npm run test:server:node`, `npm run test:server:workerd`,
`npx supabase stop --no-backup`). No browsers there. Record each long suite's start and end and the
host's sleep and wake events; a suite that overlapped a sleep is INVALID and rerun awake. Three
Safari checks from this milestone are chosen only at Review.

Independent scenario interface (tool written by the later check run):

```sh
node tools/browser-compare/0009-w3-check.mjs <served-origin> <D9-output> [<local-stack-private-json>]
node tools/browser-compare/0009-w3-check.mjs <baseline-origin> <D9-base-output> --negative
```

| Check | Command/inspection and pass condition |
| --- | --- |
| V1 | Byte-compare manifests, locks, dependency inventory and runtime notices against the prerequisite base: unchanged, no new dependency |
| V2 | `npm ci --ignore-scripts --no-audit --no-fund` exits 0 on the clean candidate and on the independent baseline |
| V3 | `npm run typecheck` exits 0 across all five workspace members |
| V4 | `npm test` full suite exits 0; `tests/tape.test.mjs` proves the tape record and keys, each tape rule's refusal, the version gate, the click strip, the 16 and 2,000 clamps, end moves, the band polygon with torn ends, hits within 4 px, box selection, the eraser leaving tapes, the codec and adapter round trip of `pattern` and `points`, and `objectKeys`; `tests/shape-kinds.test.mjs` proves the fourteen kinds, their order and names, the version gate, each outline's vertices, each text box, the fit growth, outline clipping of a connector end for each kind, and `ADD_OPTIONS`; `tests/tidy-up.test.mjs` proves placeable items (groups, sections, connectors), the reading order (including a band, ties and a lone row), the default and bounded columns and spacing, cell sizes, centring, the board edge, whole-unit offsets, handle places, the applied board changing only positions (members of sections too), and the hosted-change test on placed ids. Guards as web modules v39 |
| V5 | Team-off `npm run build` and `npm run audit:licenses` exit 0; notices equal runtime notices v3 |
| V6 | `npm run build:fixtures`, team-on `npm run build` and `audit:licenses` exit 0 |
| V7 | `npm run build:server`, `audit:licenses` and the wrangler dry run exit 0; no deploy |
| V8 | Inspect all hunks plus `git diff --name-status` and `git diff --check` over `<prerequisite-base>..<validated-source>`: only the deliverables, the dispositions above, rename-only files (every hunk only the rename) and the append-only Implementation record |
| V9 | D9-S1–D9-S26 pass with the state captures and raw receipts |
| V10 | Once, on an independent 5397b75 source and build with the candidate's `tests/tape.test.mjs`, `tests/shape-kinds.test.mjs`, `tests/tidy-up.test.mjs`, `tests/server/drawing-layout.test.ts` and the two config include lines copied in, the new unit, server and browser capability checks fail by name; a top-level setup or import abort does not count |
| V11 | Full `npm run test:server:node` then `npm run test:server:workerd`: S1–S50 and S55–S410, with the existing workerd physical exclusions S37, S43, S70 and S168 and the Node-only S344 physical subcase as before. No new failures; no unrun case called passed |
| V12 | Accepted A–J compare: baseline twice, then candidate and diffs; existing normalization plus the declared masks (a region showing the drawing bar or the Shapes panel, if any A–J screen shows one) |
| V13 | Accepted regression: scenarios O, N, M, K, L, P, Q and M9 and the fixture pages on the candidate and on 5397b75, with only their document version expectations moved to 12; every functional assertion kept and every failure classified against 5397b75 |

A regression failure that also fails on 5397b75 is a baseline finding to report, never fixed here.

## Review focus and public references

Review the tape rules and version gates in `objects/tape.ts`, `objects/shape.ts` and `document.ts`;
that `hasPoints` stays stroke-only and every caller listed by web modules v39 keeps tapes out (eraser,
colour, weight, resize, stroke bar, hits); `objectKeys` from each record; the room's load upgrade from 10
or 11 and history reading 10, 11 and 12; that every literal 11 site moved and nothing else changed
version; the drawing bar's icons by name; outline clipping and text boxes for every kind; Tidy up's
determinism (pure `tidy-up.ts`, reading order ties, offsets shared by members), that the preview never
commits or sends, that the chrome follows the preview through `tidy.board` and `tidy.selected`, that Apply is one transaction and one Undo step changing positions only, every cancel route,
and the hosted cancel; and App.tsx changed only by the eleven substitutions of web modules v39. Unresolved after the final
read, for review to watch: the pattern fill turned with the band in other
browser engines (D9-S4); the hosted cancel's detection of a change to placed items through App's `board` (D9-S25);
focus after opening and closing the preview; and the arrowhead normal at polygon vertices (D9-S15). Public source basis is
main 5397b75 and the linked versioned contracts, read 2026-11-14; no outside product is needed to
implement this contract. No unresolved product decision is delegated to implementation.

## Exclusions and reasons

- Users' own tape images, freehand or curved tape, tape colours or widths, and a Shift angle snap.
- Shape libraries beyond the basic fourteen, shape rotation, and keys for the new kinds.
- Layouts other than the grid (a single row or column, a tree, a radial or force layout), automatic
  tidying of mind maps, and tidying at once without a preview.
- Locking objects for collaborators during a preview, and a compact Tidy up bar for narrow windows.
- Repairs to separately tracked baseline failures.

## Implementation record

(Appended by the implementer.)

### 2026-11-14 — implementation handoff

- Brief: **0009-W3 v1**; document v17, interaction v41 and web modules v39.
- Branch: `codex/0009-W3-expand-drawing-and-diagram-layout`.
- Committed prerequisite base: `5afd4fa9d204f281851817f8d2db5548935fe333`.
- Behaviour baseline: `5397b75d231f5b541909075c96e2fe7446cd22ad`.
- Validated source/test revision: **`6a5c2ecd48eb7aa31f5fc8ab29353a5b9f458a20`**. Commands below ran on the
  same source bytes before the source commit; V8 inspected the committed range.
- Scope: tape, fourteen shape kinds, schema 12, Tidy up preview/Apply/Cancel,
  and the declared unit/server tests. Source/tests are committed separately from
  this append-only record. No merge or push was performed.
- Dependencies added: **none**. No new font, image file, service, import exception,
  saved layout state, room layout or service table.

| Check | Commands / inspection | Result and counts |
| --- | --- | --- |
| V1 | Byte comparison of `git show 5afd4fa9d204f281851817f8d2db5548935fe333:<path>` with each candidate manifest, root lock, dependency lock v5, inventory v5 and runtime notices v3 | **PASS**: 10 files identical; 0 added dependencies |
| V2 | `npm ci --ignore-scripts --no-audit --no-fund` on the candidate and a clean archive of behaviour baseline `5397b75` | **PASS**: both exit 0, 118 packages each, Node 26.13.0 / npm 11.20.0. The baseline install is implementation evidence; fresh independent acceptance remains separate |
| V3 | `npm run typecheck` | **PASS**: exit 0 across all 5 workspace members |
| V4 | `npm test` | **PASS**: exit 0; **1,179 passed, 0 failed, 0 skipped**. Includes 10 tape, 5 shape-kind and 10 Tidy up checks (25 focused checks), plus the module guards |
| V5 | Team-off `npm run build`; `npm run audit:licenses` | **PASS**: 1 application build, 1 audit; complete notices verified against runtime notices v3 |
| V6 | `npm run build:fixtures`; team-on `npm run build`; `npm run audit:licenses` | **PASS**: 1 fixture build, 1 application build, 1 audit |
| V7 | `npm run build:server`; `npm run audit:licenses`; Wrangler dry run below | **PASS**: Node and Worker bundles built, 1 audit, 1 dry run; no deployment |
| V8 | All non-rename hunks inspected; each rename-only file compared byte-for-byte after only the two type-name substitutions; `git diff --name-status 5afd4fa9d204f281851817f8d2db5548935fe333..6a5c2ecd48eb7aa31f5fc8ab29353a5b9f458a20` and matching `git diff --check` | **PASS**: 111 source/test files (12 new, 99 modified); 39 exact rename-only files, 60 other modified files; 0 whitespace errors; App remains 264 lines; module counts 15/10/15/29/23; Tidy up has 2 passive effects and all other effect counts are unchanged |

The web build commands used these explicit synthetic settings (once with `off`,
once with `on`):

```sh
BOARD_TEAM_FEATURES=off BOARD_SUPABASE_URL=http://127.0.0.1:55321 BOARD_SUPABASE_ANON_KEY=synthetic BOARD_SERVER_URL=http://127.0.0.1:8796 npm run build
BOARD_TEAM_FEATURES=on BOARD_SUPABASE_URL=http://127.0.0.1:55321 BOARD_SUPABASE_ANON_KEY=synthetic BOARD_SERVER_URL=http://127.0.0.1:8796 npm run build
WRANGLER_LOG_PATH=.local/0009-W3/wrangler-log WRANGLER_SEND_METRICS=false npx wrangler deploy --dry-run --outdir .local/0009-W3/wrangler -c apps/server/wrangler.json
```

The new units exercise actual tape gestures/end drags and local Undo, adapter
round trips, the contract's polygon/text-box/clipping values, deterministic grid
positions and shared member offsets. The actual Tidy up state owner is also
exercised without a browser: preview commits nothing; Apply calls `commit` once;
Cancel, tool/selection changes and narrowing discard it; hosted changes to
placed objects cancel with the declared toast while unrelated changes remain.
These are implementation checks, not independent browser or server acceptance.

#### App substitutions (web modules v39)

1. Append `useTidyUp` to the `useObjectLayouts` import line, and append
   `TidyUpLayer` / `TidyUpBar` to the existing overlays import line.
2. Add `tapeSelection` to `useSelection`'s destructuring.
3. Append `useTidyUp` immediately after `useSelection` on the same line,
   passing existing `board`, `selected`, `commit`, `tool`, `setMessage`, hosted
   board, canvas ref and read-only state.
4. Pass `tidy.board` and `tidy.selected` to `useObjectLayouts`.
5. Pass `tidy` on the `useCanvasInput` argument line holding `drawing`.
6. Pass `tidy.board` and `tidy.selected` to `BoardDrawing`.
7. Append `TidyUpLayer` and `TidyUpBar` after `MindMapButtons`, using existing
   `pos`, `view`, `size` and `layout` values.
8. Add `!tidy.open` to the ContextBar rendering condition.
9. Pass `tapeSelection` and `tidy` on ContextBar's first props line.
10. Pass `tapeSelection` and `tidy` on ObjectsPanel's first props line.
11. Pass `tidy` on the `useCommandReasons` line holding `displayedObjects`.

The rewritten composition guard derives the entire App from `5397b75` using
only these substitutions and verifies identical line count.

#### Unrun checks and escalation

- **V9–V13 unrun**: D9-S1–D9-S26, independent negative controls, Node and
  workerd server suites (including S407–S410), A–J, the accepted browser
  regression scenarios and fixture-page browser assertions. No browser or
  Supabase CLI was started. These require the later server-only/check runs.
- The 9 approved design PNGs and their source/capture files were read before
  screen implementation. Browser-engine pattern rendering, focus and visual
  conformance still require independent browser evidence.
- **Escalation: grid capacity.** Interaction v41 requires the prescribed grid
  to lie inside the board, but valid large objects can produce a grid wider
  or taller than its 2,000,000-unit extent. V1 supplies no refusal or alternate
  placement rule. This was reported to the maintainer; no new refusal wording
  or alternate layout was introduced without a contract decision. Oversized
  grids remain a review item; no capacity acceptance is claimed for that case.
- Graph discovery was unavailable under the execution policy, so source
  discovery used the repository file-search fallback.
- The source commit's privacy hooks both reported **PUBLIC BOUNDARY: PASS**.
  Git also reported a denied `packed-refs.lock` housekeeping write under the
  sandbox; the commit exited 0 and the branch ref was verified at `6a5c2ecd48eb7aa31f5fc8ab29353a5b9f458a20`.
  Wrangler's initial global log write was similarly denied; its final dry run
  used the writable log path above and exited 0. The baseline's initial
  non-pinned install invocation was discarded and rerun with pinned tools.
- No unrelated evidence file was staged or changed. No hooks were bypassed.

#### Files changed in the validated source/test commit

New files (12):

```text
apps/web/src/scene/tape-body.tsx
apps/web/src/scene/tidy-up-layer.tsx
apps/web/src/state/use-tidy-up.ts
apps/web/src/tape.ts
apps/web/src/tidy-up.ts
apps/web/src/ui/tape-controls.tsx
apps/web/src/ui/tidy-up-bar.tsx
packages/board-rules/src/objects/tape.ts
tests/server/drawing-layout.test.ts
tests/shape-kinds.test.mjs
tests/tape.test.mjs
tests/tidy-up.test.mjs
```

Changed implementation, tests and configuration (60):

```text
apps/server/src/routes/boards.ts
apps/server/src/templates.ts
apps/web/src/App.tsx
apps/web/src/board-file.ts
apps/web/src/connectors.ts
apps/web/src/icons.tsx
apps/web/src/scene/board-drawing.tsx
apps/web/src/scene/shape-body.tsx
apps/web/src/sections.ts
apps/web/src/state/use-canvas-input.ts
apps/web/src/state/use-command-reasons.ts
apps/web/src/state/use-editing-commands.ts
apps/web/src/state/use-geometry-edits.ts
apps/web/src/state/use-gesture-state.ts
apps/web/src/state/use-object-layouts.ts
apps/web/src/state/use-selection.ts
apps/web/src/storage.ts
apps/web/src/team/templates-rules.ts
apps/web/src/ui/context-bar.tsx
apps/web/src/ui/drawing-tools.tsx
apps/web/src/ui/objects-panel.tsx
apps/web/src/ui/shapes-panel.tsx
apps/web/style.css
packages/board-room/src/edits.ts
packages/board-room/src/history.ts
packages/board-room/src/room.ts
packages/board-rules/src/document.ts
packages/board-rules/src/objects/registry.ts
packages/board-rules/src/objects/shape.ts
packages/board-rules/src/objects/stroke.ts
packages/board-sync/src/codec.ts
packages/board-sync/src/comments.ts
tests/README.md
tests/board-catalog.test.mjs
tests/board-file.test.mjs
tests/board-history.test.mjs
tests/board-lifecycle.test.mjs
tests/connector-styles.test.mjs
tests/connectors.test.mjs
tests/document.test.mjs
tests/images.test.mjs
tests/import-fixture.mjs
tests/mentions.test.mjs
tests/mind-map.test.mjs
tests/modules.test.mjs
tests/objects.test.mjs
tests/server/history.test.ts
tests/server/lifecycle.test.ts
tests/server/mind-maps.test.ts
tests/shapes.test.mjs
tests/shared-editing.test.mjs
tests/storage.test.mjs
tests/strokes.test.mjs
tests/team-import.test.mjs
tests/team-templates.test.mjs
tests/workshop-reactions.test.mjs
tests/workshop-spotlight.test.mjs
tests/workshop-voting.test.mjs
vitest.node.config.ts
vitest.workerd.config.ts
```

Exact `BoardV11` / `ItemV11` rename-only files (39):

```text
apps/server/src/runtime.ts
apps/web/src/activities.ts
apps/web/src/clipboard.ts
apps/web/src/geometry.ts
apps/web/src/group.ts
apps/web/src/images.ts
apps/web/src/mind-map.ts
apps/web/src/scene/image-body.tsx
apps/web/src/scene/mind-map-buttons.tsx
apps/web/src/scene/mind-map-layer.tsx
apps/web/src/state/use-board-document.ts
apps/web/src/state/use-hosted-board.ts
apps/web/src/state/use-images.ts
apps/web/src/state/use-page-keys.ts
apps/web/src/state/use-storage-session.ts
apps/web/src/state/use-validity.ts
apps/web/src/strokes.ts
apps/web/src/team/comments/layer.tsx
apps/web/src/team/comments/panel.tsx
apps/web/src/team/comments/rules.ts
apps/web/src/team/history.ts
apps/web/src/team/hosted-board.ts
apps/web/src/team/import.ts
apps/web/src/team/timer-panel.tsx
apps/web/src/team/voting-card.tsx
apps/web/src/team/voting-rules.ts
apps/web/src/team/voting.ts
apps/web/src/ui/board-panel.tsx
apps/web/src/ui/connector-fields.tsx
apps/web/src/ui/content-field.tsx
apps/web/src/ui/format-preview.tsx
apps/web/src/ui/shape-controls.tsx
packages/board-room/src/comments.ts
packages/board-room/src/edit-session.ts
packages/board-room/src/repair.ts
packages/board-room/src/snapshots.ts
packages/board-sync/src/session.ts
packages/board-sync/src/undo.ts
tests/server/shared.test.ts
```

The record-only commit changes this brief alone. Its final branch tip is reported
separately in the handoff so the validated source SHA stays unambiguous.

### Fix round 1 — 2026-11-14

- Addresses independent review v1 (**NEEDS WORK**) of record tip
  `b0da5266b36843f07140b4a649388bc70cfd37ab`, findings **F1–F4 only**.
- Branch: `codex/0009-W3-expand-drawing-and-diagram-layout`.
- Validated source/test/contract revision:
  **`f0d8e4a81a4d9910a45e9b47832dbfe00c879307`**. V3–V7 ran on exactly
  the committed source bytes. V8 verified the committed range from prerequisite
  `5afd4fa9d204f281851817f8d2db5548935fe333`; the inspected patch equals
  that committed patch byte-for-byte.
- Dependencies added: **none**. No new source module, test file, service or
  import exception. This section is appended in a separate record-only commit;
  the final branch tip is reported separately. No push or merge.

| Finding | Change and evidence | Focused check |
| --- | --- | --- |
| F1 — D9-S20 | `apps/web/style.css:1523`: only `.scene > .tidy-handle` takes pointer presses, with specificity above `.scene > div`. Grid outline and dragging label remain pointer-free. | TU-U11 checks the override selector and pointer-free grid/label declarations. Browser hit testing remains unrun here. |
| F2 — D9-S19 | `apps/web/src/App.tsx:180` appends only `TidyUpLayer`; line 221 renders `TidyUpBar` beside ContextBar, outside the scene. Its existing `context` class supplies ContextBar's stacking above palette/zoom. | The rewritten composition guard in `tests/modules.test.mjs:589` derives App from the baseline with exactly the amended eleven substitutions, no added line, 264 lines. |
| F3 — V12 | `apps/web/src/ui/objects-panel.tsx:196`: move buttons have no title outside a preview; during a preview their title is `Apply or cancel Tidy up first.`. | TU-U12 renders the actual Objects panel and checks all four disabled move buttons, with and without a preview. |
| F4 — grid capacity | `apps/web/src/tidy-up.ts:61` exposes grid fit against 2,000,000 units per axis; existing clamping pins an oversized dimension to the board's left/top edge. `state/use-tidy-up.ts:39` refuses Apply; `ui/tidy-up-bar.tsx:26` disables Apply with `The grid doesn't fit on the board.` until the grid fits. | TU-U13 uses valid large strokes: width and height overflow, each recovering through columns or spacing (4 cases). It checks the rendered button, refused Apply and the actual canvas Enter handler, zero commits/messages, unchanged input, then one valid commit after recovery. |

The only contract edits are the authorized amendments to interaction v41
(handle presses, bar placement and grid capacity) and web modules v39
(substitutions 7–8 and the bar's existing position inputs), plus one amendment
line at the top of each. No other contract text was changed. These amendments
resolve the prior grid-capacity escalation; no further product decision is
requested in this round.

App substitutions **7 and 8** supersede their descriptions in the first record:

7. Only `TidyUpLayer` follows `MindMapButtons` on line 180, using existing `tidy`,
   `pos` and `view`.
8. Line 221 begins `{tidy.open && <TidyUpBar … />}{selected.size > 0 && !tidy.open && (`;
   the bar receives existing `tidy`, `pos`, `view`, `size` and `layout`.

Substitutions 1–6 and 9–11 are unchanged. The composition guard remains a
single rewritten guard, and Tidy up still owns exactly two passive effects.

| Check | Commands / inspection | Result and counts |
| --- | --- | --- |
| Focused regression | Command below, before and after the fixes | Before: 4 failed at the expected findings. After: **4 passed, 0 failed, 0 skipped** (three new units and the updated composition guard). |
| V3 | `npm run typecheck` | **PASS**, exit 0 across all **5** workspace members. |
| V4 | `npm test` | **PASS**, exit 0; **1,182 passed, 0 failed, 0 skipped**. Includes **13** Tidy up, **10** tape and **5** shape-kind checks, plus module guards. |
| V5 | Team-off `npm run build`; `npm run audit:licenses` | **PASS**: **1** web build and **1** audit; complete distributed notices verified. |
| V6 | `npm run build:fixtures`; team-on `npm run build`; `npm run audit:licenses` | **PASS**: **1** fixture build, **1** web build and **1** audit. |
| V7 | `npm run build:server`; `npm run audit:licenses`; Wrangler command below | **PASS**: Node and Worker bundles, **1** audit and **1** dry run; no deployment. |
| V8 | Every hunk of `git diff --no-ext-diff --unified=2 5afd4fa9d204f281851817f8d2db5548935fe333..f0d8e4a81a4d9910a45e9b47832dbfe00c879307`; matching `git diff --name-status` and `git diff --check` | **PASS**: **330 hunks**, **114 files** (12 new, 102 modified), including **39** byte-verified type-rename-only files (96 hunks) and **75** remaining files (234 hunks), comprising milestone deliverables, the original append-only record and the 2 authorized contracts. This round changes **10** files / **17** hunks; **0** whitespace errors. |

Exact focused/build settings and dry-run command:

```sh
node --test --test-reporter=tap --test-name-pattern='TU-U1[123]|0009-W3 App composition' tests/tidy-up.test.mjs tests/modules.test.mjs
BOARD_TEAM_FEATURES=off BOARD_SUPABASE_URL=http://127.0.0.1:55321 BOARD_SUPABASE_ANON_KEY=synthetic BOARD_SERVER_URL=http://127.0.0.1:8796 npm run build
BOARD_TEAM_FEATURES=on BOARD_SUPABASE_URL=http://127.0.0.1:55321 BOARD_SUPABASE_ANON_KEY=synthetic BOARD_SERVER_URL=http://127.0.0.1:8796 npm run build
WRANGLER_LOG_PATH=.local/0009-W3/fix-1/wrangler-log WRANGLER_SEND_METRICS=false npx wrangler deploy --dry-run --outdir .local/0009-W3/fix-1/wrangler -c apps/server/wrangler.json
```

Unrun in this fix round: **V1–V2** (no dependency/install changes; not requested
again), **V9–V13**, Node/workerd server suites including S407–S410, D9 browser
scenarios including D9-S19/S20, A–J checkpoints and fixture-page browser checks.
No browser or Supabase CLI was started, as required by the sandbox handoff.
The CSS/composition/markup checks above do not replace independent browser proof.

The source commit's two privacy hooks reported **PUBLIC BOUNDARY: PASS**.
Git reported a sandbox-denied `packed-refs.lock` housekeeping write; the commit
exited 0 and the branch ref was verified at the validated source SHA above.
No hook was bypassed, no unrelated evidence file was changed, and the internal
repository remained read-only.

Files changed in the fix source/test/contract commit (10):

```text
apps/web/src/App.tsx
apps/web/src/state/use-tidy-up.ts
apps/web/src/tidy-up.ts
apps/web/src/ui/objects-panel.tsx
apps/web/src/ui/tidy-up-bar.tsx
apps/web/style.css
docs/architecture/0001-interaction-v41.md
docs/architecture/0001-web-modules-v39.md
tests/modules.test.mjs
tests/tidy-up.test.mjs
```

The separate record commit changes only this brief, appending this section.
