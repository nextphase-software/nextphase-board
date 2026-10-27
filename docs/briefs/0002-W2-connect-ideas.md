BRIEF VERSION: 0002-W2 v1 (2026-10-27)
# 0002-W2 — Connect ideas

Status: Draft. Implementation starts only after the maintainer commits this brief,
[0001 document v7](../architecture/0001-document-v7.md),
[0001 interaction v19](../architecture/0001-interaction-v19.md) and
[0001 web modules v17](../architecture/0001-web-modules-v17.md) to main.

## Outcome

Ideas can be joined by **connectors**: grey lines with an arrow at one end and an optional
label. Select a sticky, text or shape, drag one of its four connection dots onto another
idea, and a connector joins them; or choose two ideas in Objects and press Connect. The line
leaves and enters the ideas at their nearest sides, turns at right angles with rounded
corners, and follows the ideas wherever they move. Its label sits on the line with the line
cut away behind it. Undo, Save and reopening keep every connector, its label and its ends,
and everything can be done from the keyboard through Objects.

- A connector is a board object of a new type, `connector`, with no rectangle: it stores its
  two ends, `from` and `to`, each naming an idea by its logical ID with anchor `auto`.
- Connectors never move on their own. Deleting an idea deletes its connectors in the same
  step; copying two connected ideas copies their connector.
- The saved format becomes document v7. Boards saved as v1 to v6 open unchanged and become v7
  at the next Save; older versions of the app show v7 boards in their unsupported-data view,
  read-only.
- While connection dots show, the selection's context bar sits 18 CSS pixels further from
  the selection so it never covers a dot.

"Today" means `a1526f3`. Boards without connectors look and behave as today, except for the
context bar's clearance and the new controls named in this brief.

## Read first and prerequisite contracts

- [Contributor guidance](../../CONTRIBUTING.md), [agent instructions](../../AGENTS.md) and
  [engineering standards](../../DESIGN.md).
- [0001 document v7](../architecture/0001-document-v7.md): the `connector` type, its ends,
  eligibility, the dangling rule, the upgrade, older apps and the adapter's ends.
- [0001 interaction v19](../architecture/0001-interaction-v19.md): connection dots and the
  bar's clearance, dragging, Connect, creating, the route, the look, the three bands, the
  label, selecting, moving and arranging, the context bar, deleting, sections and groups,
  copying, Objects, the keyboard route and history.
- [0001 web modules v17](../architecture/0001-web-modules-v17.md): the new modules, the
  registry's ends flag, and the guard changes; v12's rules unchanged.
- [0001 storage v1](../architecture/0001-storage-v1.md) and
  [0001 toolchain v1](../architecture/0001-toolchain-v1.md): unchanged. No new dependency.
- [0002-W4 v1](0002-W4-draw-basic-shapes.md), [0002-W1 v1](0002-W1-organize-sections.md),
  [0001-W6 v1](0001-W6-whole-object-formatting.md) and
  [0001-W26 v1](0001-W26-format-selected-text.md): their comparison procedure and scenarios
  N, M, K and L are reused by the reviewer.

## Deliverables and boundaries

Paths are under `apps/web/` unless they start with `tests/`. The contracts say what each
behaviour is; this list says where it goes. These are the only files that may change.

**New files (seven).**
1. **`src/objects/connector.ts`**: the connector type record: type `connector`, valid from
   version 7, has ends, no placement tool, kinds, drawing or Add option, not a container,
   plain text up to 100 code points, initial text empty, the fixed shared values (neutral,
   medium, center), label font size 18, line colour `#6b6b6b`, label colour `#2c2c2c`, extra
   keys `from` and `to`, and validation of the ends' shape and the fixed values. No React or
   Konva.
2. **`src/connectors.ts`**: the rules in web modules v17 (side midpoints, route, rounded
   path and hit samples, label point and box, arrow, drawn bounds, hit and box tests, cascade
   and its count, copied set and remapping, bands, Connect's reason, creating). No React or
   Konva.
3. **`src/connection-drag.ts`**: dot positions, the pressed dot, the drag state and its
   target. No React or Konva.
4. **`src/scene/connector-body.tsx`**: `ConnectorBody`, drawn in two passes (line and arrow;
   cutaway, label and selected end markers), with interaction v19's values.
5. **`src/scene/connection-dots.tsx`**: `ConnectionDots`: the dots, the dashed preview with
   its start circle, and the target outline.
6. **`src/ui/connector-controls.tsx`**: the connector context bar: "Connector" or "*N*
   connectors", Add text, Delete.
7. **`tests/connectors.test.mjs`**: as listed under validation.

**Changed rules modules.**
8. **`src/document.ts`**: document v7 (`ItemV7` as a union of rectangle and connector items,
   `BoardV7`, the resolved item type), connector validation through the registry, v7
   canonical order, the upgrade from v1–v6, new boards v7, and the adapter's atomic `ends`.
9. **`src/clipboard.ts`**: the snapshot keeps ends; Paste and Duplicate remap them.
10. **`src/history.ts`**: whole-connector records in create, label, delete and cut steps;
    `duplicate()` takes the copied set with its connectors, offsets only objects with a
    rectangle, and remaps copied connectors' ends to the copies.
11. **`src/sections.ts`**: membership never takes a connector; Objects' connector labels with
    their ends' names; the current document type.
12. **`src/group.ts`**: groups never take a connector.
13. **`src/arrange.ts`**: the Arrange controls' last group, **Connector**, with Connect (shown
    by the unchanged `ui/arrange-controls.tsx` in the menu and in Objects).
14. **`src/context-bar-position.ts`**: the 18-pixel dot clearance; drawn bounds for
    connectors.
15. **`src/gesture.ts`**: the connection drag gesture.

**Changed object types.**
16. **`src/objects/registry.ts`**: registers `connector` last; adds the lookups in web modules
    v17 (has ends, has a rectangle, eligible idea, order band, the type with ends, key sets
    without geometry for it); the palette, placement tools and Add options skip a type with no
    tool.
17. **`src/objects/sticky.ts`, `src/objects/text.ts`, `src/objects/section.ts`,
    `src/objects/shape.ts`**: the ends flag, false.

**Changed screen parts.**
18. **`src/scene/board-drawing.tsx`**: three bands and the connector band's two passes.
19. **`src/scene/inline-editor.tsx`**: the connector label editor at the label point.
20. **`src/scene/note-body.tsx`**: the current document type and the connector's layout on
    the scene item.
21. **`src/ui/context-bar.tsx`**: places the connector controls for connector-only
    selections; ideas' controls act on ideas only.
22. **`src/ui/objects-panel.tsx`**: connector labels, the connector Name field, the reason on
    move and size buttons.
23. **`src/ui/content-field.tsx`**: the Name field for a connector (plain text, 100 code
    points).
24. **`src/ui/palette.tsx`, `src/ui/board-panel.tsx`, `src/ui/format-preview.tsx`,
    `src/ui/shape-controls.tsx`**: the current document type, and the palette skipping a type
    with no tool.
25. **`style.css`**: the dots, the preview, the target outline and the label editor.

**Changed state hooks** (each keeps its ownership, web modules v17):
26. **`src/state/use-canvas-input.ts`**: pressing dots, the connection drag, line, label and
    box hit tests, double-click and Enter opening a label.
27. **`src/state/use-editing-commands.ts`**: Connect, the cascade and its notice, Copy, Cut and
    Duplicate refusing an empty copied set, and connectors left out of moves, resizes,
    arranging and style.
28. **`src/state/use-object-layouts.ts`**: connectors' routes and measured labels.
29. **`src/state/use-editor-placement.ts`**: the label editor's place and fallback.
30. **`src/state/use-selection.ts`**: the selection's ideas and connectors.
31. **`src/state/use-geometry-edits.ts`**: moving and resizing ideas only.
32. **`src/state/use-context-bar.ts`**: passes the dot clearance.
33. **`src/state/use-command-reasons.ts`**: the empty copied set's reason for Copy, Cut and
    Duplicate; the current document type.
34. **`src/state/use-board-document.ts`,
    `src/state/use-page-keys.ts`, `src/state/use-storage-session.ts`,
    `src/state/use-validity.ts`**: the current document type.

**Composition.**
35. **`src/App.tsx`**: places `ConnectionDots` and passes the new values on existing lines.
    It stays at **262 lines**, its budget.

**Changed tests.**
36. **`tests/document.test.mjs`, `tests/storage.test.mjs`, `tests/objects.test.mjs`,
    `tests/modules.test.mjs`, `tests/shapes.test.mjs`, `tests/context-bar-position.test.mjs`**:
    as listed under validation.

No other module changes: no `resize.ts`, `selection.ts`, `commands.ts`, `storage.ts`,
`marks.ts`, `text-runs.ts`, `geometry.ts`, `styles.ts`, other hook, other screen part,
`icons.tsx`, `main.tsx`, packages, locks, contracts or other tests. If something seems to need
more, stop and report it.

New source files use `SPDX-License-Identifier: Apache-2.0`. Append the implementation record
below with the branch, validated revision, commands, results and exclusions; report the final
branch tip separately.

## Numbered acceptance criteria

- 0002-W2-AC01: Create a supported basic shape and attach a labelled connector to stable object endpoints.
- 0002-W2-AC02: Move/resize endpoints and save/reopen without a dangling connector; deletion follows the declared detach/remove rule.
- 0002-W2-AC03: Undo/redo and keyboard-accessible relationship controls preserve endpoint identity and labels.

| Criterion | Evidence that shows it |
| --- | --- |
| 0002-W2-AC01 | Scenario O: O1–O17 (dots, drag, invalid drops, creating, the look), O18–O26 (label routes, cutaway, limit); unit tests in `tests/connectors.test.mjs` |
| 0002-W2-AC02 | Scenario O: O27–O30 (moving and resizing ends), O56–O59 (sections), O60–O65 (cut, delete, cascade, undo, redo), O66–O67 (bands), O68–O73 (save, reopen, dangling record, upgrade, limit); unit tests in `tests/connectors.test.mjs`, `tests/document.test.mjs` and `tests/storage.test.mjs` |
| 0002-W2-AC03 | Scenario O: O31–O37 (Connect, Objects labels and Name, one-step undo), O38–O55 (arranging, hit testing, copying), O61, O63–O65 (same IDs, ends and labels after Undo and Redo); unit tests in `tests/connectors.test.mjs` |

## Validation commands and expected evidence

From the repository root with the pinned toolchain:

```sh
npm --prefix apps/web ci --ignore-scripts --no-audit --no-fund
npm --prefix apps/web run typecheck
node --test tests/connectors.test.mjs tests/document.test.mjs tests/storage.test.mjs tests/objects.test.mjs tests/modules.test.mjs tests/shapes.test.mjs tests/context-bar-position.test.mjs
npm --prefix apps/web test
npm --prefix apps/web run build
npm --prefix apps/web run build:fixtures
git diff --name-only main...HEAD
```

The change touches the saved format, history, the clipboard and `App.tsx`, so the implementer
runs the full unit suite (`npm --prefix apps/web test`) and reports any failure, saying whether
it also fails at `a1526f3`.

**`tests/connectors.test.mjs`** (new) covers:
- v7 validation: connector keys and their order; no `x`, `y`, `width`, `height` or other key on
  a connector; `from` and `to` with exactly `object` then `anchor`, anchor `auto` only; ends
  naming a missing object, a section, a connector, or the same object twice rejected; the
  fixed shared values (any other colour, text size, alignment, mark, group or section
  rejected); `from` and `to` rejected on other types; 100 and 101 code points; a connector
  rejected in v1–v6; two connectors on the same pair accepted;
- v7 canonical order with every type together; the adapter's `ends` value, its changes and
  re-creation; no adapter write when an end moves;
- routes, dots and side midpoints using the drawn rectangle (a sticky saved at height 160
  and drawn at 171, as in `tests/geometry.test.mjs`);
- the route for ideas side by side, above and below, diagonal, perpendicular, same-facing,
  overlapping and coincident; the tie order; the lead length at its 12 and 24 limits; zero-
  length segments dropped; corner radius limited by half a segment; the label point by total
  length; the arrow's points and direction; drawn bounds with and without a label;
- hit testing at exactly 8 and at 8.01 CSS pixels at two zooms, on a rounded corner and on the
  arrow; a label winning over another line; ideas winning over connectors; box selection
  with the whole connector inside and with part outside;
- the cascade from deleting one and several ideas, its count including connectors already
  selected, and deleting a connector alone; Cut taking connectors to the cut ideas;
- the copied set (both ends, one end, a selected connector with an outside end, a section with
  its members) and remapped ends with fresh identities;
- the three bands, insertion of a new connector, and order commands within the connector band
  with exact undo of an interleaved array;
- Connect's reasons (one, three, a section, a connector, the 250 limit) and reading order;
  a dot drag needing only its source; Copy, Cut and Duplicate refusing an empty copied set
  and accepting an empty section;
- Objects labels for connectors with their ends' names, "Empty" for no label, and numbering;
- moves, resizes, Align, Distribute and Group leaving connectors out, with the reason for a
  connector-only selection; style commands leaving connectors unchanged.

**`tests/document.test.mjs`**: version 7 keys and order; the connector key set without
geometry; reading v1–v6 and the upgrade with no rewrite; v7 canonical output; existing cases
changed only to follow v7 becoming the current version.

**`tests/storage.test.mjs`**: a v7 head with a v6 previous record decodes without rewriting
either; existing cases changed only to follow v7.

**`tests/objects.test.mjs`**: the five records with the ends flag; the new lookups; the tool
and Add option loops skip the connector.

**`tests/shapes.test.mjs`**: the current version literal only (7).

**`tests/context-bar-position.test.mjs`**: the bar 66 CSS pixels above and 26 below a
selection while dots show, today's 48 and 8 without; a selection taller than the scene keeps
today's clamping.

**`tests/modules.test.mjs`**: scene parts eight (adding `connector-body.tsx` and
`connection-dots.tsx`), object types six (adding `connector.ts`), screen parts seventeen
(adding `connector-controls.tsx`), the type-name guards also forbid `"connector"`; hooks
nineteen and the `App.tsx` budget 262, unchanged.

Reviewer checks (not run by the implementer; browsers cannot start there):

- **Scenario O** (new behaviour), in a fresh context at 1280 × 800 and 100% zoom, with real
  mouse and keyboard input, once on the candidate and once on a build of `a1526f3` as a
  negative control: there Connect is absent, so the run marks every dependent check failed,
  runs O75, and exits with a failure. The board is named "Connectors scenario O". Saved
  records are read after each Save, waiting for "Locally saved". Synthetic stored records are
  used only for O70, O71 and O72–O74.

  The layout, all points in CSS pixels from the canvas centre: **A** is a sticky placed by a
  click at (−400, −110), text "Source sticky"; **T** a text placed at (−30, 210), text "Text
  idea"; **S** a square drawn from (100, −210) by (180, 120), text "Target shape". Every step a
  check makes is undone after it unless a later check uses it; the check run keeps the exact
  order in `connectors-check.mjs` and may adjust presses that land on a control, keeping each
  check's meaning.
  - **O1** No Connector palette tool and no Add connector button; Connect exists in Objects'
    Arrange controls.
  - **O2** A selected sticky shows four dots, 18 CSS pixels off its side midpoints, each the
    topmost element at its centre (the context bar does not cover it).
  - **O3** A selected text shows the same four dots.
  - **O4** A selected shape shows the same four dots.
  - **O5** Two selected ideas each show four dots.
  - **O6** A dot drag draws the blue dashed preview and outlines its eligible target.
  - **O7** Releasing on S creates one connector from A to S.
  - **O8** The new connector is selected with round end markers and its label closed.
  - **O9** Its context bar reads "Connector" with only Add text and Delete.
  - **O10** The saved v7 connector has `auto` ends, no geometry or route, and the fixed values.
  - **O11** The line is solid `#6b6b6b`, 3.5 units wide, with rounded corners.
  - **O12** One open chevron at `to`, pointing into S's side midpoint.
  - **O13** A drop on empty canvas creates nothing and shows no notice.
  - **O14** A drop on the source creates nothing and shows no notice.
  - **O15** A drop on a section creates nothing and shows no notice.
  - **O16** A drag from a text's dot creates a connector.
  - **O17** A drag from a shape's dot creates a connector.
  - **O18** Add text opens the label editor at the label point with "Add text".
  - **O19** A typed label is kept; Escape closes the editor.
  - **O20** A labelled connector's bar has no Add text and no style controls.
  - **O21** The label is drawn on a `#fafafa` cutaway with no border or corner, above every
    line.
  - **O22** A double-click on the line opens the existing label.
  - **O23** A click away closes it.
  - **O24** Enter on the selected connector opens its label and changes no end.
  - **O25** Exactly 100 code points (emoji) are saved.
  - **O26** 101 code points stay visible, invalid, with Save unavailable; correcting restores it.
  - **O27** Moving an end re-routes the line; the saved connector is unchanged.
  - **O28** One Undo and one Redo restore the move and the route.
  - **O29** Resizing an end re-routes the line; the saved connector is unchanged.
  - **O30** One Undo and one Redo restore the resize.
  - **O31** Connect in Objects' Arrange controls by keyboard joins two ideas in reading order and selects the
    closed connector.
  - **O32** Objects lists "connector 1 · leads to · sticky 1 to square 3".
  - **O33** For a connector Objects shows the Name field only.
  - **O34** Editing Name by keyboard keeps the connector's ID and ends.
  - **O35** That edit undoes and redoes in one step.
  - **O36** Connect in the Arrange menu does the same as O31.
  - **O37** Connect is unavailable for one idea, three ideas, an idea and a section, and two
    connectors.
  - **O38** A selected connector has no resize handles.
  - **O39** For a connector alone, move and size buttons are unavailable with "Connectors
    follow the ideas they join.".
  - **O40** Align, Distribute and Group are unavailable with the same reason.
  - **O41** Align on two ideas and a connector moves the ideas only.
  - **O42** Resize on the same mixed selection resizes the ideas only; handles are the ideas'.
  - **O43** Group on it groups the ideas only.
  - **O44** Colour on a sticky and a connector changes the sticky only.
  - **O45** Dragging a connector alone moves nothing and changes nothing.
  - **O46** A press 7 CSS pixels from the line selects it.
  - **O47** A press 9 CSS pixels from the line does not.
  - **O48** A press on the label selects its connector.
  - **O49** A box over part of a connector does not select it.
  - **O50** A box holding the whole route and label selects it.
  - **O51** Copy and Paste of both ends bring every connector between them, with fresh IDs and
    remapped ends.
  - **O52** Copy and Paste of one end bring no connector.
  - **O53** Copying a selected connector with one end outside leaves it out.
  - **O54** Duplicate of both ends brings their connectors with remapped ends and labels.
  - **O55** Duplicate of one end brings none.
  - **O56** A new section around the ideas takes the ideas and no connector.
  - **O57** Moving the section carries both ends and re-routes their connectors; no route is
    saved.
  - **O58** That move undoes and redoes in one step.
  - **O59** Duplicating the section copies its internal connectors, pointing at the copied
    members, and never makes them members.
  - **O60** Cutting T removes its connectors, with the count in the notice.
  - **O61** One Undo restores T and its connectors with the same IDs, ends and labels.
  - **O62** Deleting A removes its connectors, with the count in the notice.
  - **O63** One Undo restores A and every connector with the same IDs, ends and labels.
  - **O64** Redo deletes them again and Undo restores them again.
  - **O65** Deleting a connector removes only it; Undo restores its ID and ends.
  - **O66** Sections draw below connectors and connectors below ideas, in the list and on
    the canvas.
  - **O67** Bring to front and Send to back keep a connector within the connector band.
  - **O68** After Save and reload the v7 record, labels, IDs and ends are identical.
  - **O69** After the reload a connector re-routes when an end moves.
  - **O70** A stored record with a dangling end is rejected, its bytes unchanged.
  - **O71** A stored v6 record opens unchanged and saves as v7 after an edit.
  - **O72** At 249 objects one Connect reaches 250, and Connect is then unavailable.
  - **O73** At 250, Duplicate and Paste add nothing, with the limit's notice.
  - **O74** At 250, deleting an idea removes its connectors; Undo restores all 250.
  - **O75** No dialogs, page errors or console errors.

Recommended regression checks, run only if the maintainer accepts them (this change touches
the saved format, history, the clipboard, the canvas input and `App.tsx`):

- **The full unit suite** in a clean clone, separating failures new to the candidate from
  failures that also occur at `a1526f3`.
- **Previous behaviour.** Scenarios A–J of the 0001-W24 v1 brief's comparison on a build of
  `a1526f3` and on the candidate, with one change made to both runs: I2's marquee, and any
  later step starting from the same point, starts from a point clear of the context bar's new
  position and covers the same rectangle, because the bar now sits where it started. Before
  comparing, both runs are normalized with exactly these masks, and nothing else:
  1. connection dots in the markup;
  2. the Arrange controls' Connector group, in Objects and in the menu popup;
  3. the markup's object-ID aliases renumbered after masks 1 and 2 (dots carry object IDs);
  4. a saved version 7 record holding no connector is compared as its version 6 form; a record
     holding a connector is never masked;
  5. the context bar's and the Arrange popup's positions, where each equals the position the
     placement rules give with the clearance (and, for the popup, with the Connector group);
     each is replaced by the position the same rules give without them. Positions that do
     not match that prediction are not masked.
  After the masks the candidate must match at every checkpoint in markup, focus, canvas
  drawing and saved records.
- **0002-W4's scenario N**, unchanged except: N47's section drag starts at (−465, 280), inside
  the same section and clear of the bar, instead of (−465, 55); N56's saved record is version
  7; N66 checks that scenario N's board holds no connector and that no quick-create arrow
  exists (connection dots now show on selected ideas).
- **0002-W1's scenario M**, unchanged except at M3: the saved record is version 7.
- **0001-W6's scenario K**, unchanged except in its step "Edit the sticky and append text":
  the saved record is version 7.
- **0001-W26's scenario L**, unchanged: all 21 checks pass.
- **Regression harness.** The eight PASS lines at the fixture index page and at
  `regressions.html` ([tests README](../../tests/README.md)), in headless Chrome.

The maintainer checks three items drawn from scenario O in Safari. No browser matrix,
accessibility audit, native IME check, phone layout check or performance test unless the
maintainer asks.

## Exclusions and reasons

- Connector variants: arrows at the start or none, line styles and widths, curved and straight
  lines, colour, the bend handle, fixed sides and reconnecting an end (0002-W3).
- Connectors with a free end, to a section or to another connector; creating an idea by
  dropping on empty canvas.
- Routing around other objects.
- A connector-only Arrange menu or Duplicate; moving a connector by itself.
- Formatted label text, label text size or position.
- Connectors across pages; mind maps (0009-W2).
- Fixes for bugs noticed on the way (report them).

## Public references with retrieval dates

None beyond the repository's own documents.

## Implementation record

### 2026-10-27 — W2 v1 implementation

- Branch: `codex/0002-W2-connect-ideas`; worktree: `.worktrees/codex-0002-W2`.
- Committed-main prerequisite revision: `d863738afb2b659d94a6e930f2fcc828881f8fa1`.
  Implemented this brief v1 with document v7, interaction v19 and web modules v17.
- Validated source/test revision: `143f8b73753fa2dc3a4b466c76683a4c90b12638`
  (`feat(web): connect ideas with labelled connectors`). The checks below ran on
  the source/test tree committed unchanged at that revision. The later handoff
  commit adds only this record; its final branch tip is reported separately.
- Implemented document validation and canonical v7 output, legacy adoption,
  atomic adapter ends, derived routes and label bounds, connection dots and drag,
  Connect in the shared Arrange controls, label editing and Objects controls,
  hit/box selection, three drawing/order bands, copy/remapping, delete/cut
  cascades, and whole-connector history. No route or display geometry is saved.
- Dependencies added: none. The manifest, lock, architecture contracts and all
  modules outside the deliverables are unchanged. `App.tsx` remains 262 lines;
  the module guards retain nineteen hooks and check eight scene parts, six
  object-type modules and seventeen UI parts.

Commands ran from the repository root with Node `24.22.1` and npm `11.19.1`
selected on `PATH`. The official runtime archive's SHA-256 matched its release
`SHASUMS256.txt`. The final results, after implementation corrections, were:

| Exact command | Result |
| --- | --- |
| `node --version` | `v24.22.1` |
| `npm --version` | `11.19.1` |
| `npm --prefix apps/web ci --ignore-scripts --no-audit --no-fund` | Exit 0; 19 packages installed |
| `npm --prefix apps/web run typecheck` | Exit 0; no type errors |
| `node --test tests/connectors.test.mjs tests/document.test.mjs tests/storage.test.mjs tests/objects.test.mjs tests/modules.test.mjs tests/shapes.test.mjs tests/context-bar-position.test.mjs` | Exit 0; 186 passed, 0 failed, 0 skipped |
| `npm --prefix apps/web test` | Exit 0; 458 passed, 0 failed, 0 skipped |
| `npm --prefix apps/web run build` | Exit 0; application built; accepted lock, runtime inventory and distributed notices verified |
| `npm --prefix apps/web run build:fixtures` | Exit 0; disposable fixtures built; accepted lock, runtime inventory and distributed notices verified |
| `git diff --check` | Exit 0 |
| `git diff --cached --check` | Exit 0 before the implementation commit |
| `git diff --name-only main...HEAD` | Exit 0; at the validated revision, all 50 changed paths are in this brief's deliverables; the handoff adds this brief's record only |
| `git commit -m "feat(web): connect ideas with labelled connectors"` | Exit 0; both mandatory public-boundary hooks reported PASS |

The implementation commit also emitted a non-fatal sandbox denial for automatic
`packed-refs.lock` creation. The commit succeeded, its branch reference resolved
to the validated revision, and the worktree was clean afterward. No hook was
bypassed. Graph discovery and indexing were attempted first, but the MCP service
required approval unavailable in this session; repository reads were the fallback.

Earlier focused development runs exposed and corrected test expectations for
panel clamping and section-induced array ordering, and a server-rendered hook
test's missing `document.activeElement` stub. The final focused and full-suite
runs have no failures; no failure comparison at `a1526f3` was needed.

Not run: browsers, servers, scenario O or its negative control, previous-behaviour
comparisons A–N, the browser regression harness, Safari spot checks, accessibility
audits, native IME, phone layouts or performance/load tests. Browser startup is
unavailable in the implementer's sandbox; browser acceptance and independent
review of the exact source revision remain with the reviewer. React server-rendered
unit checks exercise state commands and static controls without launching a browser.
No push, merge, publication or later milestone was performed.
