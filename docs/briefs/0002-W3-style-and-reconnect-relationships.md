BRIEF VERSION: 0002-W3 v1 (2026-10-28)
# 0002-W3 — Style and reconnect relationships

Status: Draft. Implementation starts only after the maintainer commits this brief,
[0001 document v9](../architecture/0001-document-v9.md),
[0001 interaction v23](../architecture/0001-interaction-v23.md) and
[0001 web modules v21](../architecture/0001-web-modules-v21.md) to main.

## Outcome

A selected connector's context bar gets a connector toolbar: **Colour** (the shapes' 21
colours and a custom colour), **Line style** (Thin or Thick, Solid or Dashed), **Start point** and
**End point** (None, Line arrow, Solid arrow, Triangle, Circle, Diamond) and **Line shape**
(Elbowed, Curved, Straight), beside Add text and Delete. Dragging one of a selected connector's
end circles onto another idea, or onto another side of the same idea, moves that end there and
pins it to the side nearest the drop. Objects' new **Ends** fields do the same from the keyboard.
A new connector takes the last style chosen on the open board.

- A connector's style and pinned sides are saved in **document v9**. Boards saved by earlier
  versions open unchanged, their connectors in today's look, and are saved as version 9 at the
  next Save; an older copy of Board shows a version 9 board as unsupported and changes nothing.
- An end is never left free: a drop anywhere but an eligible idea puts it back.

"Today" means `47e1b62`. Boards look and behave as today except for the connector bar, connector
styles, reconnecting, Objects' Ends and what they bring with them (document version 9).

## Read first and prerequisite contracts

- [Contributor guidance](../../CONTRIBUTING.md), [agent instructions](../../AGENTS.md) and
  [engineering standards](../../DESIGN.md).
- [0001 document v9](../architecture/0001-document-v9.md): the style keys and their values, side
  anchors, version 1 to 8 reading and upgrade, older applications, the version references in board
  file v1, storage v2 and activity catalogue v1, and the adapter.
- [0001 interaction v23](../architecture/0001-interaction-v23.md): the connector bar and its
  popups; how a connector is drawn (line, dash, heads and insets); line shapes and pinned sides;
  label points; selecting; reconnecting; the remembered style; copies; Objects' Ends; history.
- [0001 interaction v19](../architecture/0001-interaction-v19.md)'s connector rules, which v23
  extends, and [v18](../architecture/0001-interaction-v18.md)'s Fill and Border panels and menu
  rules, which the popups reuse.
- [0001 web modules v21](../architecture/0001-web-modules-v21.md): the new modules and the guard
  change.
- [0001 storage v2](../architecture/0001-storage-v2.md),
  [0006 board file v1](../architecture/0006-board-file-v1.md),
  [0008 activity catalogue v1](../architecture/0008-activity-catalogue-v1.md) and
  [0001 toolchain v1](../architecture/0001-toolchain-v1.md): unchanged except for the version
  references document v9 lists. No new dependency.
- [0001-W24 v1](0001-W24-selection-layouts-editor-hooks.md)'s comparison procedure (scenarios
  A–J) is reused by the reviewer.

## Deliverables and boundaries

Paths are under `apps/web/` unless they start with `tests/`. The contracts say what each
behaviour is; this list says where it goes. These are the only files that may change.

**New files (six).**
1. **`src/connector-path.ts`**: the Curved cubic and its control points, the Straight segment
   between two outline points (coincident centres included), and shortening a path by its two
   insets in proportion when they exceed its length (an exact cubic for Curved). No React, Konva or
   DOM; no type-name comparison.
2. **`src/connector-heads.ts`**: each head's drawing for an end point, outward direction and
   weight (interaction v23's table: points, circle, fill, inset and extent), with the head scale.
   Same restrictions.
3. **`src/ui/connector-menu.tsx`**: the connector bar's Colour, Line style, Start point, Line shape
   and End point buttons and their popups, with mixed values.
4. **`src/ui/connector-fields.tsx`**: Objects' Ends group (From, From side, To, To side) and its
   keys.
5. **`src/ui/connector-icons.tsx`**: the head, line shape and line style icons.
6. **`tests/connector-styles.test.mjs`**: as listed under validation.

**Changed rules modules.**
7. **`src/document.ts`**: document v9 (the connector's style keys and side anchors, version 1 to 8
   reading and upgrade with the default style, canonical form, the adapter's atomic style value,
   the version 9 board types).
8. **`src/connectors.ts`**: side pairs with pinned ends; the layout for each line shape (end
   points, insets, heads, label point, drawn bounds); hit tests with heads and width; creating with
   a given style; style changes; reconnecting (no change when nothing changes; never the other
   end's idea; never an ineligible idea); copies keeping style and anchors.
9. **`src/connection-drag.ts`**: the pressed end circle, the reconnect target and the drop side.
10. **`src/board-file.ts`**, 11. **`src/storage.ts`**: "newer" is above 9.
12. **`src/activities.ts`**, 13. **`src/clipboard.ts`**, 14. **`src/group.ts`**,
    15. **`src/sections.ts`**, 16. **`src/strokes.ts`**: the version 9 types only (and, for
    `activities.ts`, a version 7 activity onto a version 9 board).

**Changed object types.**
17. **`src/objects/connector.ts`**: the style keys, values, labels, default style, end sides, line
    width and dash, and the saved keys for each version.
18. **`src/objects/registry.ts`**: the connector's style in the shared key handling and each
    eligible idea's outline point.

**Changed scene parts.**
19. **`src/scene/connector-body.tsx`**: the line's colour, width and dash, and the heads.
20. **`src/scene/connection-dots.tsx`**: the reconnect outlines, the target's dots and the
    enlarged drop side.
21. **`src/scene/board-drawing.tsx`**: the connector being reconnected, with its end at the
    pointer.

**Changed state hooks** (each keeps its ownership, web modules v21):
22. **`src/state/use-board-document.ts`**: the remembered style, reset when a board is opened.
23. **`src/state/use-canvas-input.ts`**: the end drag (press priority, capture, target, drop,
    every cancellation) and new connectors with the remembered style.
24. **`src/state/use-editing-commands.ts`**: connector style (one step for every selected
    connector; the remembered style), reconnecting from Objects, Connect with the remembered style.
25. **`src/state/use-context-bar.ts`**: the connector popups' open state, refs, focus return
    and dismissal, as it holds them for the shape popups today (v18's menu rules).
26–32. **`use-command-reasons.ts`**, **`use-geometry-edits.ts`**,
    **`use-object-layouts.ts`**, **`use-page-keys.ts`**, **`use-selection.ts`**,
    **`use-storage-session.ts`**, **`use-validity.ts`**: the version 9 types and passing the
    connector values only.

**Changed screen parts.**
33. **`src/ui/connector-controls.tsx`**: the connector bar in interaction v23's order.
34. **`src/ui/context-bar.tsx`**, 35. **`src/ui/objects-panel.tsx`**: place the connector menus
    and Ends.
36–39. **`src/ui/board-panel.tsx`**, **`content-field.tsx`**, **`format-preview.tsx`**,
    **`shape-controls.tsx`**: the version 9 types only (`shape-controls.tsx` may also export its
    custom colour control for reuse).
40. **`style.css`**: Ends, the reconnect outlines and enlarged dot, and the connector popups
    above the bottom toolbar.

**Composition.**
41. **`src/App.tsx`**: passes the connector values on existing lines or lines it needs. It must
    not exceed **262 lines**, its budget.

**Changed tests.**
42–50. **`tests/board-catalog.test.mjs`**, **`board-file.test.mjs`**, **`connectors.test.mjs`**,
    **`document.test.mjs`**, **`modules.test.mjs`**, **`objects.test.mjs`**, **`shapes.test.mjs`**,
    **`storage.test.mjs`**, **`strokes.test.mjs`**: version 9 where they assert the newest version,
    a future version of 10, the guard counts below, and connectors' default style where they build
    version 9 connectors.

No other module changes: no `history.ts`, `icons.tsx`, `gesture.ts`, `resize.ts`, other hook,
other scene or screen part, `main.tsx`, activity files, packages, locks, contracts, build scripts
or other tests. If something seems to need more, stop and report it.

New source files use `SPDX-License-Identifier: Apache-2.0`. Append the implementation record
below with the branch, validated revision, commands, results and exclusions; report the final
branch tip separately.

## Numbered acceptance criteria

- 0002-W3-AC01: Apply line and arrow variants to an existing connector.
- 0002-W3-AC02: Reconnect either endpoint without dangling references.
- 0002-W3-AC03: Preserve labels, endpoint identity and style through undo and save/reopen.

| Criterion | Evidence that shows it |
| --- | --- |
| 0002-W3-AC01 | Scenario S: S2–S47 (bar, popups, every value saved and drawn, mixed values, label points, selecting); unit tests in `tests/connector-styles.test.mjs` |
| 0002-W3-AC02 | Scenario S: S48–S61 (pointer and keyboard reconnecting, pinned sides, every cancellation); unit tests (reconnect rules, validation of ends, drop side) |
| 0002-W3-AC03 | Scenario S: S1, S49–S51, S60–S68 (Undo and Redo, copies, cascade, save and reopen, version 8 board, older application, board file); unit tests (document v9, adapter, canonical form) |

## Validation commands and expected evidence

From the repository root with the pinned toolchain:

```sh
npm --prefix apps/web ci --ignore-scripts --no-audit --no-fund
npm --prefix apps/web run typecheck
node --test tests/connector-styles.test.mjs tests/connectors.test.mjs tests/document.test.mjs tests/modules.test.mjs
npm --prefix apps/web test
npm --prefix apps/web run build
npm --prefix apps/web run build:fixtures
git diff --name-only main...HEAD
```

The change touches the saved format, storage, the registry and `App.tsx`, so the implementer runs
the full unit suite (`npm --prefix apps/web test`) and reports any failure, saying whether it also
fails at `47e1b62`.

**`tests/connector-styles.test.mjs`** (new) covers:
- document v9: a connector's exact keys and order; each style key's values (the 21 names and a
  lowercase custom colour accepted, an uppercase or short custom colour rejected); each anchor
  side; a missing style key, a style key on another type, a style key or a side anchor in a version
  8 document rejected; ends naming the same idea, a missing idea or a stroke rejected;
- canonical form and reading: a version 9 board with styled connectors round-trips byte for byte;
  each version 1 to 8 board reads unchanged and serializes byte for byte until edited; the upgrade
  gives every connector the default style and keeps `"auto"` anchors, and is not an edit;
- the adapter: the style held as one value; projection and re-creation give back style and
  anchors; Undo and Redo of a style change and of a reconnect;
- sides: with one end pinned, only that side's pairs; with both pinned, that pair; ties as v19;
- line shapes: the default style's layout equal to today's (path, chevron, label point, bounds);
  Curved's control points (reach 24 when close, half the distance otherwise); Straight's ends on a
  sticky's rectangle, a square's rounded corner and a circle's ellipse; coincident centres; the
  end-drag preview (a zero-size rectangle at the pointer, the drop side or `"auto"`) for each line
  shape, including a Straight preview with a head at the dragged end (end point at the pointer,
  `d` 0);
- heads: each head's points or circle at thin and thick (scale 1.6); Circle and Diamond touching
  the outline at the end point and lying outside it; on an oblique Straight end (a rectangle, a
  rounded square corner, an ellipse) every head moved outward by interaction v23's `d` and lying
  wholly outside the outline; insets; two insets longer than a short path scaled in proportion;
  a Curved path shortened as an exact cubic;
- dash: `5w` and `3w` for thin and thick; none for solid;
- label points: Elbowed at v19's point whatever the heads; Curved and Straight at half the drawn
  path;
- hit tests: within 8 pixels of a thin path at zoom 1 and 2; within half a thick line's width at
  high zoom; inside a filled head; on a dash gap; box selection only with the whole drawn bounds;
- drop side: the nearest edge for points near each side; ties; a dot's side winning;
- reconnecting: to another idea; to the same idea's other side; no change for the same idea and
  side (the same board returned); refused onto the other end's idea, a section, a stroke or a
  missing ID;
- style changes: every selected connector in one change; no change when all already have the
  value; refused when the selection holds anything but connectors;
- copies: style and anchors kept, ends remapped;
- creating: a given style with `"auto"` anchors.

**`tests/modules.test.mjs`**: screen parts twenty-six (adding `connector-fields.tsx`,
`connector-icons.tsx` and `connector-menu.tsx`); object types seven, scene parts nine, hooks
nineteen, the type-name guard and the `App.tsx` budget 262, unchanged.

**The other changed tests** assert version 9 where they assert the newest version and use 10 for a
future version; where they build version 9 connectors they give them the default style. Where an
existing assertion states what this version replaces, it moves to the new rule and keeps its
older-version coverage: in
`tests/connectors.test.mjs`, the rule that a current connector's anchor is only `"auto"` (a side
anchor is now valid in version 9 and still rejected in versions 7 and 8), the connector bar
holding only Add text and Delete (it now holds interaction v23's controls), and exact connector
key lists (version 9 adds the style keys; the version 7 and 8 lists stay). No other expectation
changes; `tests/activities.test.mjs` stays as it is (activity files are still read as version 7).

Reviewer checks (not run by the implementer; browsers cannot start there):

- **Scenario S** (new behaviour), with real mouse and keyboard input in fresh contexts at
  1280 × 800 and 100% zoom, once on the candidate and once on a build of `47e1b62` as a negative
  control: there the connector bar has no style controls, so the dependent checks fail and the run
  exits with a failure. Saved records are read after each Save, waiting for "Locally saved".
  Crafted stored records are used only for the starting ideas and connectors, the version 8 board
  (S1), the older application's round trip (S68), the board file (S67) and the 250-object board
  (S69). The tool is `tools/browser-compare/connector-styles-check.mjs` in the private repository;
  the check run keeps its order and may adjust its steps, keeping each check's meaning.
  - **S1** A version 8 board's connectors open in today's look with no storage write; Save writes
    version 9 with the default style.
  - **S2–S3** The connector bar's items and order (Add text while empty; no bend handle); each popup
    opens under the bar at its left edge, and Escape returns focus to its button.
  - **S4–S25** Each of the 21 colours and a custom colour: saved and drawn.
  - **S26–S29** Thin, Thick, Solid and Dashed: saved, and the drawn width and dash.
  - **S30–S41** Each head at the start and at the end: saved, drawn in the line colour, filled or
    not, scaled; Circle and Diamond whole, outside the outline.
  - **S42–S44** Elbowed, Curved and Straight: the drawn path, the label point (Elbowed at today's
    point), selecting on the path, box selection of the whole connector.
  - **S45–S47** A labelled connector keeps every style control; two connectors show Mixed and one
    change is one Undo for both; a mixed selection keeps the ideas' controls and changes no
    connector.
  - **S48–S52** Reconnecting each end by pointer to another idea pins the nearest side in one step,
    with Undo and Redo restoring style, label and identity; the same idea's other side; the same
    side makes no step; a dot's side; a pinned side kept after moving the idea.
  - **S53–S58** Empty canvas, the other end's idea, Escape, blur, pointer cancel and lost capture
    each put the end back with no step and no notice.
  - **S59–S61** Objects' Ends under Name (options in reading order, Objects labels, the other end
    left out); From, To, Side and Nearest side from the keyboard, one step each.
  - **S62–S63** The remembered style after Undo and a mixed change, for a dot drag and for Connect,
    with `"auto"` anchors.
  - **S64–S65** Copy, Paste and Duplicate keep style and pinned sides; deleting an idea removes its
    styled connectors, and one Undo restores them.
  - **S66–S68** Save and reopen keep everything and reset the remembered style; a board file with
    styled connectors opens; the `47e1b62` application shows a version 9 board as unsupported with
    Save unavailable and keeps the bytes.
  - **S69** At 250 objects Connect is unavailable and a dot drop, Duplicate or Paste adds nothing.
  - **S70** No dialogs, page errors or console errors.

Recommended regression checks, run only if the maintainer accepts them (this change touches the
saved format, storage, the registry, the canvas input, the context bar, Objects and `App.tsx`):

- **The full unit suite** in a clean clone, separating failures new to the candidate from
  failures that also occur at `47e1b62`.
- **Previous behaviour.** Scenarios A–J of the 0001-W24 v1 brief's comparison on a build of
  `47e1b62` and on the candidate, with 0002-W2's adjusted starts in both runs. Before comparing,
  both runs are normalized with exactly this mask and nothing else: a saved version 9 record that
  holds no connector is compared as the same record with `schemaVersion` 8. After the mask the
  candidate must match at every checkpoint in markup, focus, canvas drawing and saved records. The
  mask is `tools/browser-compare/connector-styles-normalize.mjs` in the private repository.
- **Earlier scenarios on the candidate**, each with its version assertions moved to 9 (and future
  data to 10): O (connectors: O9 and O20 expect the new bar's items, O10 and O71 version 9 with
  the default style), R (strokes: R16, R49, R50, R53), N (shapes, N56), M (sections, M3), K
  (formatting, K4), L (unchanged), P (board files with `--baseline` at a `47e1b62` build: P19 and
  P51 use version 10 as the future version; P46 and P47 check that the `47e1b62` application
  refuses the version 9 boards and keeps every board pair, then the candidate reopens them) and Q
  (templates, Q21 saves a version 7 board as version 9).
- **Regression harness.** The eight PASS lines at the fixture index page and at
  `regressions.html` ([tests README](../../tests/README.md)), in headless Chrome.

The maintainer checks three items drawn from scenario S in Safari: S29 (a thick dashed line),
S49 (reconnecting by pointer) and S40 (an end Circle drawn whole outside the outline). No browser matrix, accessibility audit, phone layout check or
performance test unless the maintainer asks.

## Exclusions and reasons

- A bend handle and saved bends; routing around other objects (0009-W3).
- Free ends; connectors to sections, strokes or other connectors.
- Further heads (crow's foot), the "Text background" toggle, label colour, size,
  formatting or position.
- Centre handles with dotted extensions on a selected Straight connector (Board keeps its
  end circles); connectors drawn above ideas.
- Connector tools in the Shapes panel; quick-create on empty canvas; connector-only Duplicate or
  moving a connector alone; style controls on mixed selections.
- Fixes for bugs noticed on the way (report them), including the known invisible zero-length
  Shift highlight, which belongs to the next drawing milestone.

## Public references with retrieval dates

None beyond the repository's own documents.

## Implementation record

### 2026-10-28 — Implementation handoff

- Brief implemented: **0002-W3 v1 only**, with document v9, interaction v23 and web modules
  v21 as committed on main. Base: `d9c0415ef0256fe7a382003902db2d44cbda8afe`.
- Branch: `codex/0002-W3-connector-styles`; worktree: `.worktrees/codex-0002-W3`.
- **Validated source/test revision:** `df8e77f91be18d127b83383bbabf3850f428f21d`
  (`feat(web): style and reconnect connector relationships`). The validation below ran with a
  clean worktree at that commit. This implementation record is a later documentation-only
  commit; its final branch tip is reported separately in the handoff.
- Implemented the connector toolbar, independent mixed style values, remembered style, both
  endpoint drag previews and reconnecting, Objects' Ends and direct select keys, pinned routes,
  three line shapes, head geometry/insets and hits, v9 canonical validation and legacy upgrades,
  atomic adapter style, and style/anchor preservation through copies and history.
- Scope inspection: exactly the six new files and forty-four changed implementation files
  authorized above. `App.tsx` remains 258 lines (budget 262); screen parts 26, object-type modules
  7, scene parts 9 and hooks 19. The existing module/type-name guards remain in force.
- Added dependencies: **none**. Dependency versions, lock, licenses, activity files, contracts
  and build scripts are unchanged.

Commands ran from the repository root with the shell selecting the pinned toolchain. Every
command below exited **0**:

| Exact command | Result at the validated revision |
| --- | --- |
| `node --version` | `v24.22.1` |
| `npm --version` | `11.19.1` |
| `npm --prefix apps/web ci --ignore-scripts --no-audit --no-fund` | Installed 19 packages successfully |
| `npm --prefix apps/web run typecheck` | Passed; no TypeScript diagnostics |
| `node --test tests/connector-styles.test.mjs tests/connectors.test.mjs tests/document.test.mjs tests/modules.test.mjs` | 177 passed, 0 failed, 0 skipped |
| `npm --prefix apps/web test` | 595 passed, 0 failed, 0 skipped |
| `npm --prefix apps/web run build` | Built application; accepted lock, runtime inventory and distributed notices verified |
| `npm --prefix apps/web run build:fixtures` | Built disposable fixtures; accepted lock, runtime inventory and distributed notices verified |
| `git diff --name-only main...HEAD` | 50 implementation paths, all authorized by this brief; this record adds only the brief itself |
| `git diff --check` | Passed |

The new test file contains 48 cases covering the v9 keys, all style values and anchors, invalid
ends, exact legacy bytes and upgrades, canonical styled records, atomic adapter values,
Undo/Redo and resurrection, pinned side pairs, default-layout equivalence, Curved control
points and exact cubic subdivision, Straight outline clipping and coincident centres, every
head at both weights and oblique offsets, proportional insets, dash/label/hit/bounds rules,
previews, drop sides, reconnect/style no-ops and refusals, copies, creation and v7 activity
insertion. Synthetic hook/screen tests also exercise remembered-style reset and history
independence, both creation routes, multi-connector style transactions, endpoint capture and
release, own-idea/dot drops, cancellation, toolbar order/mixed values and Ends labels/keys.
These synthetic surfaces are unit evidence, not real-browser evidence.

| Criterion | Implementer evidence | Remaining reviewer evidence |
| --- | --- | --- |
| 0002-W3-AC01 | Style/geometry/toolbar/mixed-value unit cases pass | Scenario S2–S47 in a browser |
| 0002-W3-AC02 | Reconnect rules, sides, previews, synthetic pointer and Ends-key cases pass | Scenario S48–S61, including real focus/capture and blur |
| 0002-W3-AC03 | Canonical legacy/current records, adapter, Undo/Redo, copies, activity and board-file tests pass | Scenario S1 and S60–S68, including actual storage reopening and older-application preservation |

**Exclusions and limitations.** No browser was launched and no browser comparison or regression
harness was run, including the fixture-page PASS checks. Scenario S, previous-behaviour
comparisons A–J, earlier browser scenarios and the Safari samples remain with the reviewer.
No browser matrix, accessibility audit, native IME check, performance/load test, merge, push or
publication was performed. The unit suite has no remaining failure at the validated revision,
so there was no failing case requiring comparison against `47e1b62`; that baseline was not run.
The known zero-length Shift-highlight concern and every feature exclusion above remain outside
this implementation.

Code-discovery graph listing/indexing calls were denied by the sandbox approval policy, so
local source inspection was used. The source commit's mandatory public-boundary hooks both
reported PASS, with no bypass. Git also emitted a sandbox denial for `packed-refs.lock` during
commit maintenance; the commit exited successfully and its branch reference was verified.
