BRIEF VERSION: 0002-W4 v1 (2026-10-26)
# 0002-W4 — Draw basic shapes

Status: Draft. Implementation starts only after the maintainer commits this brief,
[0001 document v6](../architecture/0001-document-v6.md),
[0001 interaction v18](../architecture/0001-interaction-v18.md) and
[0001 web modules v16](../architecture/0001-web-modules-v16.md) to main.

## Outcome

One **Shapes** tool draws squares and circles that hold text. You drag to draw one or click
to place it, type in it, change it from a square to a circle and back, and give it a fill and
a border with two separate controls. Long text never resizes a shape; it ends with an ellipsis,
and a small button grows the shape to fit. Undo, Save and reopening keep all of it, and
everything can be done from the keyboard through Objects.

- A shape is a board object of a new type, `shape`, with a kind (`square` or `circle`), a fill
  (Fill, Transparent or No fill, and a colour) and a border (Solid, Dashed or None, and a
  colour). Colours are 21 named swatches or a custom colour.
- A new shape is white with a dark gray border, Small text centred both ways; a click places
  it at 180 × 180.
- Shapes are ideas: they join sections, group, align, order, copy, delete and undo exactly as
  stickies do.
- The saved format becomes document v6. Boards saved as v1 to v5 open unchanged and become v6
  at the next Save; older versions of the app show v6 boards in their unsupported-data view,
  read-only.

"Today" means `74df93d`. Boards without shapes look and behave as today, except for the new
controls named in this brief.

## Read first and prerequisite contracts

- [Contributor guidance](../../CONTRIBUTING.md), [agent instructions](../../AGENTS.md) and
  [engineering standards](../../DESIGN.md).
- [0001 document v6](../architecture/0001-document-v6.md): the `shape` type and its keys,
  per-type key sets, validation, the upgrade and older apps.
- [0001 interaction v18](../architecture/0001-interaction-v18.md): the Shapes tool and panel,
  placing and drawing, the drawn look and colours, long text and Grow to fit text, the Shape
  menu, Fill and Border, session paint, Objects, the keyboard route and history.
- [0001 web modules v16](../architecture/0001-web-modules-v16.md): the new modules and the guard
  changes; v12's rules unchanged.
- [0001 storage v1](../architecture/0001-storage-v1.md) and
  [0001 toolchain v1](../architecture/0001-toolchain-v1.md): unchanged. No new dependency.
- [0002-W1 v1](0002-W1-organize-sections.md), [0001-W6 v1](0001-W6-whole-object-formatting.md)
  and [0001-W26 v1](0001-W26-format-selected-text.md): their comparison procedure and scenarios
  M, K and L are reused by the reviewer.

## Deliverables and boundaries

Paths are under `apps/web/` unless they start with `tests/`. The contracts say what each
behaviour is; this list says where it goes. These are the only files that may change.

**New files (five).**
1. **`src/objects/shape.ts`**: the shape type record: type `shape`, tool `Shapes`, valid from
   version 6, drawn by the shape body, not a container, formatting and text size, text limit
   1,000, initial text empty, a tool that draws by dragging, size range 40–2,000, default size
   180 × 180, default style neutral, Small, Centre, extra keys `shape`, `fill`, `border`,
   drawing preview radius 6, inline editor minimum 40 × 24 CSS pixels, and text that does not
   grow the shape; the two kinds with tools Square (key R) and Circle (key O); the 21 shape
   colours with labels and values (interaction v18); the fill modes and border styles;
   validation of the shape keys; the darkened border; the text colour; the text box; whether
   text fits and the Grow to fit height; kind, fill and border changes. No React or Konva.
2. **`src/scene/shape-body.tsx`**: `ShapeBody`: fill, border, text with its ellipsis, and the
   selected outline, with the values in interaction v18.
3. **`src/ui/shapes-panel.tsx`**: the Shapes panel.
4. **`src/ui/shape-controls.tsx`**: the Shape menu, the Fill and Border buttons and panels with
   Custom, the Objects shape fields (Shape, Fill, Fill colour, Border, Border colour), and the
   Grow to fit text button for the canvas and Objects.
5. **`tests/shapes.test.mjs`**: as listed under validation.

**Changed rules modules.**
6. **`src/document.ts`**: document v6 (`ItemV6`, `BoardV6`), key sets from the registry, shape
   validation, v6 canonical order, the upgrade from v1–v5, new boards v6, and the adapter's
   `shape`, `fill` and `border` values.
7. **`src/clipboard.ts`**: the snapshot keeps each object's extra keys through the registry.
8. **`src/sections.ts`**: `objectLabel` takes an idea's label prefix ("square", "circle", or
   the type name for other types) from the registry, keeping today's numbering, text, group and
   section parts; otherwise the current document type only. **`src/group.ts`,
   `src/context-bar-position.ts`, `src/gesture.ts`**: the current document type only.

**Changed object types.**
9. **`src/objects/registry.ts`**: registers `shape` after `sticky`; adds the lookups in web
   modules v16 (extra keys and key sets by version, kinds and their tools and keys, labels,
   text box and font size, Add options).
10. **`src/objects/sticky.ts`, `src/objects/text.ts`, `src/objects/section.ts`**: the new record
    properties with today's behaviour (no extra keys, no shape paint, today's text box, text
    colour and growth, square drawing preview, today's editor minimum).

**Changed screen parts.**
11. **`src/scene/board-drawing.tsx`**: chooses the shape body through the registry.
12. **`src/scene/overlays.tsx`**: the drawing preview's corner radius from the type.
13. **`src/scene/inline-editor.tsx`**: a shape's editor in its text box, centred, with the grey
    "Add text" placeholder.
14. **`src/scene/note-body.tsx`, `src/scene/section-body.tsx`**: the current document type only.
15. **`src/icons.tsx`**: the Shapes tool, Square, Circle and Border glyphs.
16. **`src/ui/palette.tsx`**: the Shapes tool after Sticky, pressed while a kind is armed.
17. **`src/ui/context-bar.tsx`**: for shapes, the Shape menu first and Fill and Border in place
    of Colour; Colour kept for the other ideas in a mixed selection.
18. **`src/ui/objects-panel.tsx`**: shape labels, the shape fields, Grow to fit text, and Add
    square and Add circle.
19. **`src/ui/content-field.tsx`, `src/ui/board-panel.tsx`, `src/ui/format-preview.tsx`**: the
    current document type only.
20. **`style.css`**: the Shapes panel, the dark Fill and Border panels and swatches, the grow
    button, and the centred shape editor.

**Changed state hooks** (each keeps its ownership, web modules v16):
21. **`src/state/use-canvas-input.ts`**: arming kinds, R and O, drawing and placing shapes, the
    panel closing when the tool returns to Select.
22. **`src/state/use-editing-commands.ts`**: Change shape, Change fill (with the darkened
    border), Change border and Grow to fit text, each one step on the selected shapes only.
23. **`src/state/use-board-document.ts`**: the session paint.
24. **`src/state/use-selection.ts`**: the selection's shapes and other ideas.
25. **`src/state/use-object-layouts.ts`**: shape text laid out in its text box without growth,
    and whether it fits.
26. **`src/state/use-editor-placement.ts`**: a shape's text box and editor minimum.
27. **`src/state/use-geometry-edits.ts`**: creating shapes with the session paint; text never
    resizes a shape; a shape's resize height floor is 40, not its text height (passed to the
    unchanged `resize.ts`, which keeps v11's width floor for every type).
28. **`src/state/use-context-bar.ts`** (one popup open at a time among Colour, Arrange, Shape,
    Fill and Border, and their closing rules), **`src/state/use-command-reasons.ts`,
    `src/state/use-validity.ts`, `src/state/use-page-keys.ts`,
    `src/state/use-storage-session.ts`**: the shape controls' state and reasons, and the
    current document type.

**Composition.**
29. **`src/App.tsx`**: places the Shapes panel and passes the new values on existing lines. It
    stays at **262 lines**, its budget.

**Changed tests.**
30. **`tests/document.test.mjs`, `tests/storage.test.mjs`, `tests/objects.test.mjs`,
    `tests/modules.test.mjs`**: as listed under validation.

No other module changes: no `history.ts`, `arrange.ts`, `resize.ts`, `selection.ts`,
`commands.ts`, `storage.ts`, `marks.ts`, `text-runs.ts`, `geometry.ts`, `styles.ts`, other hook,
other screen part, `main.tsx`, packages, locks, contracts or other tests. If something seems to
need more, stop and report it.

New source files use `SPDX-License-Identifier: Apache-2.0`. Append the implementation record
below with the branch, validated revision, commands, results and exclusions; report the final
branch tip separately.

## Numbered acceptance criteria

- 0002-W4-AC01: Create a square or a circle, change its kind, type and format text in it, and set its fill and border.
- 0002-W4-AC02: Move, resize, undo/redo and save/reopen keep each shape's kind, text, style and geometry.
- 0002-W4-AC03: Keyboard users can add shapes and edit them through Objects.

| Criterion | Evidence that shows it |
| --- | --- |
| 0002-W4-AC01 | Scenario N: N1–N14 (tool, panel, keys, drawing, placing, editor, defaults, look), N15–N18 (Shape menu), N19–N31 (Fill and Border, colours, Custom, session paint), N60–N64 (long text and Grow to fit text); unit tests in `tests/shapes.test.mjs` |
| 0002-W4-AC02 | Scenario N: N45–N55 (move, resize, sections, groups, align and order, copy, paste, duplicate, delete, undo, redo), N56–N58 (save, reopen, session paint after reload); unit tests in `tests/shapes.test.mjs`, `tests/document.test.mjs` and `tests/storage.test.mjs` |
| 0002-W4-AC03 | Scenario N: N32–N44 (Objects labels, shape fields, text size and alignment, Add square and Add circle, move and size buttons), N48 (Section select), N65 (Grow to fit text in Objects), N59 (mixed selections); unit tests in `tests/shapes.test.mjs` |

## Validation commands and expected evidence

From the repository root with the pinned toolchain:

```sh
npm --prefix apps/web ci --ignore-scripts --no-audit --no-fund
npm --prefix apps/web run typecheck
node --test tests/shapes.test.mjs tests/document.test.mjs tests/storage.test.mjs tests/objects.test.mjs tests/modules.test.mjs
npm --prefix apps/web test
npm --prefix apps/web run build
npm --prefix apps/web run build:fixtures
git diff --name-only main...HEAD
```

The change touches the saved format, the clipboard and `App.tsx`, so the implementer runs the
full unit suite (`npm --prefix apps/web test`) and reports any failure, saying whether it also
fails at `74df93d`.

**`tests/shapes.test.mjs`** (new) covers:
- v6 validation: shape keys and their order, kinds, fill modes, border styles, the 21 names and
  lowercase custom colours (uppercase, short or named-but-unknown colours rejected), `color`
  fixed at neutral, the shape keys rejected on other types and missing on a shape, sizes
  40–2,000, a `shape` object rejected in v1–v5;
- v6 canonical order with shapes and other types together; the adapter's three shape values,
  their changes and re-creation;
- the darkened border for all 21 names and one custom colour (blue gives `#2e75b8`, white
  `#bfbfbf`); the text colour (white on blue and black, dark on white, yellow and every
  Transparent or No fill);
- the text box of a square and a circle; whether text fits, including a text box too small for
  one line (nothing drawn), a grapheme-safe ellipsis (taking the formatting before it, none
  when the line is "…" alone), and a box too narrow for "…" (nothing drawn); the fit height, including text that
  cannot fit within 2,000 and a shape near the board's bottom edge (`1,000,000 − y`), and when
  Grow to fit text is available;
- changing kind on one and several shapes keeping identity, text, marks, style, paint and
  geometry; changing fill (with the border) and border; each as one step with exact undo;
- mixed selections changing only their own subsets (Colour for stickies, text and sections);
  each shape value shown as common or Mixed;
- session paint changed only by Change fill and Change border and their Undo and Redo (not by
  creating, Paste, Duplicate or Delete), and its reset;
- resizing a shape alone and in a set with no text height floor, and v11's width floor;
- placing and drawing limits, clamping and reverse drags; a new shape joining a section by
  its centre;
- copies keeping shape keys with fresh identities;
- Objects labels for squares and circles numbered among ideas.

**`tests/document.test.mjs`**: version 6 keys and order; per-type key sets; reading v1–v5 and
the upgrade with no rewrite; v6 canonical output; existing cases changed only to follow v6
becoming the current version.

**`tests/storage.test.mjs`**: a v6 head with a v5 previous record decodes without rewriting
either; existing cases changed only to follow v6.

**`tests/objects.test.mjs`**: the four records' new properties and the new lookups.

**`tests/modules.test.mjs`**: scene parts six (adding `shape-body.tsx`), object types five
(adding `shape.ts`), screen parts sixteen (adding `shapes-panel.tsx` and `shape-controls.tsx`),
the type-name guards also forbid `"shape"`, `"square"` and `"circle"`; hooks nineteen and the
`App.tsx` budget 262, unchanged.

Reviewer checks (not run by the implementer; browsers cannot start there):

- **Scenario N** (new behaviour), in a fresh context at 1280 × 800, with real mouse and
  keyboard input, once on the candidate and once on a build of `74df93d` as a negative
  control: there N1 must fail because the Shapes tool does not exist, the checks that depend
  on it are reported as failing or unavailable, and the run must exit with a failure. Name a
  board. Saved records are read after each Save, waiting for "Locally saved".

  The layout is fixed so each check is independent. At 100% zoom with the board origin at the
  canvas centre (all points in CSS pixels from the centre):
  - **A** is the square drawn in N3–N4 from (−420, −220) to (−200, −80), with the text
    "Recruit 20 pilot users" typed in N8; **B** is the circle placed in N9 by a click at
    (200, −150), with the text "Pilot goes live". A is reselected by a click at (−300, −150)
    before each check that names it.
  - Before N47, **S** is a sticky placed with the Sticky tool at (200, 150) and **P** a section
    drawn with the Section tool from (−480, 40) to (−40, 300).
  - Every step a check makes is undone right after it, newest first, unless the next check
    names it; so after each check the board holds only A, B and, from N47, S and P, with A in its
    N4 state and B in its N9 state until its paint changes before N56. In particular:
    - N14's shape, N41's square, N42's circle, N51's paste, N52's duplicate and N60's circle are
      each removed by one Undo after their check;
    - N31: A's fill is set to Blue (its border `#2e75b8`); a square C is drawn from (0, −180) to
      (100, −120) and checked; Undo removes C and a second Undo restores A's fill; a square D
      drawn the same way is checked for White and Dark gray, then removed by Undo;
    - N45 and N46 end with the Undo they check, leaving A as before;
    - N47: a square E is drawn from (−300, 120) to (−180, 200), inside P, and P is dragged
      by (0, 40); after the check Undo restores P's position, and E stays for N48–N50;
    - N48's two Section select changes are undone; N49 groups E and S, drags the group by
      (40, 0), and both steps are undone; N50 aligns A and E left, undone, then sends E to
      back, undone; then one Undo removes E;
    - before N56, B's fill is set by Custom to `#7a3cf0` and its border to Dashed with Custom
      `#204060`; these stay for the rest of the scenario;
    - N61 places a 180 × 180 square F by a click at (−20, 100) (its centre outside P, clear of
      S; F and its grow button stay above the palette) and pastes the text "one two three
      four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen
      seventeen eighteen nineteen twenty twenty-one twenty-two twenty-three twenty-four
      twenty-five twenty-six"; N62–N65 use F; after N65 Undo removes the growth and the text,
      and one more Undo removes F.
  - **N1** One Shapes tool follows Sticky, named "Shapes tool", tooltip "Shapes · R".
  - **N2** Pressing it opens the Shapes panel (Basic; Square armed and pressed; tooltips
    "Square · R" and "Circle · O").
  - **N3** Dragging shows the drawing preview with rounded corners.
  - **N4** The drag creates a square of exactly the dragged size.
  - **N5** The tool returns to Select, the panel closes and the editor opens with "Add text".
  - **N6** Saved defaults: fill `fill`/`white`, border `solid`/`dark-gray`, text size Small,
    alignment Centre, `color` neutral.
  - **N7** Drawn: corner radius 6, border 4 units, `#6b6b6b` border, white fill.
  - **N8** Typing and formatting a selected word in the shape's editor are kept.
  - **N9** With Circle, a click places a 180 × 180 circle and opens "Add text".
  - **N10** A circle's text is laid out in its inscribed text box and centred.
  - **N11** R on the focused board arms Square and opens the panel.
  - **N12** O arms Circle.
  - **N13** R and O do nothing while text is being edited.
  - **N14** Enter places the armed kind at 180 × 180 at the view's centre.
  - **N15** With A selected, the context bar starts with "Shape: Square", offering Square and
    Circle.
  - **N16** Choosing Circle makes A a circle and keeps its ID, text, marks, style, paint and
    geometry.
  - **N17** One Undo restores the square only.
  - **N18** One Redo makes it a circle again.
  - **N19** The Fill panel is dark, with Fill, Transparent and No fill and the 21 swatches in
    order with their labels.
  - **N20** Transparent draws the fill at 45% opacity.
  - **N21** No fill draws no fill.
  - **N22** Fill restores the opaque fill.
  - **N23** Each of the 21 fill swatches stores its name and sets the darkened border.
  - **N24** Text is white on Blue and dark on White.
  - **N25** The Border panel is dark, with Solid, Dashed and None and the 21 swatches.
  - **N26** Dashed draws dashes of 14 units with gaps of 9.
  - **N27** None draws no border.
  - **N28** Solid restores the border.
  - **N29** Each of the 21 border swatches changes only the border.
  - **N30** Custom opens the browser's colour picker and saves lowercase `#rrggbb` for fill and
    for border.
  - **N31** After A's fill is set to Blue (its border becoming `#2e75b8`), the next square drawn
    by pointer gets fill Blue and that border; Undo of the fill change makes the following
    shape white with a dark gray border again.
  - **N32** Objects labels squares and circles numbered among ideas ("square 3 · …").
  - **N33** Objects' Shape select by keyboard changes the kind, keeping ID, text, style and size.
  - **N34** That change undoes and redoes in one step.
  - **N35** Objects' Fill select works by keyboard.
  - **N36** Objects' Fill colour select darkens the border.
  - **N37** Objects' Border select works by keyboard.
  - **N38** Objects' Border colour select changes only the border, and the darkened colour is
    labelled "Darker *colour* (from fill)".
  - **N39** Objects' Text size select changes text size and not the shape's size.
  - **N40** Objects' Alignment select works.
  - **N41** Add square by keyboard places 180 × 180 and opens Content.
  - **N42** Add circle by keyboard does the same.
  - **N43** Each Objects move button moves the shape 10 units, keeping its shape keys.
  - **N44** Each Objects size button resizes it 10 units, keeping its shape keys.
  - **N45** A pointer move, with one-step Undo and Redo, keeps kind, text, style, paint and
    geometry.
  - **N46** A pointer resize, with one-step Undo and Redo, keeps them.
  - **N47** E, drawn inside P, is a member of P and moves with P by (0, 40).
  - **N48** Objects' Section select clears and restores E's membership.
  - **N49** E groups with S and moves with the group.
  - **N50** Align left on A and E, and Send to back on E (first among ideas, after P), treat
    shapes as ideas.
  - **N51** Copy and Paste keep the shape keys with fresh identities.
  - **N52** Duplicate does the same.
  - **N53** Delete removes the shape.
  - **N54** Undo restores its logical ID, text, style, paint and geometry.
  - **N55** Redo deletes it and Undo restores it again.
  - **N56** Save writes a version 6 record with the shape keys only on shapes.
  - **N57** After a reload the saved board is identical: kinds, text, marks, style, paint
    (including B's custom fill and dashed custom border), geometry and order.
  - **N58** After the reload a square G drawn from (0, −180) to (100, −120) is white with a dark
    gray solid border, although B's paint was the last change; Undo removes G.
  - **N59** With a sticky and a shape selected, the bar and Objects show Colour for the sticky
    and Shape, Fill and Border for the shape, each changing only its own object.
  - **N60** A new circle's editor opens on the canvas, centred in its text box, at 100% zoom.
  - **N61** Text longer than a 180 × 180 square ends with "…" and the shape keeps its size.
  - **N62** Selected, that shape shows the Grow to fit text button centred on its bottom edge.
  - **N63** Pressing it grows only the height so the text fits (no "…"), keeps `x`, `y` and
    width, and the button disappears.
  - **N64** One Undo restores the height and the button.
  - **N65** Objects' Grow to fit text by keyboard does the same.
  - **N66** No connectors, connection dots or quick-create arrows exist.
  - **N67** No dialogs, page errors or console errors.

Recommended regression checks, run only if the maintainer accepts them (this change touches
the saved format, the clipboard and `App.tsx`):

- **The full unit suite** in a clean clone, separating failures new to the candidate from
  failures that also occur at `74df93d`.
- **Previous behaviour.** Scenarios A–J of the 0001-W24 v1 brief's comparison, unchanged, on a
  build of `74df93d` and on the candidate. Before comparing, both runs are normalized with
  exactly these masks, and nothing else:
  1. the Shapes tool button in the palette markup;
  2. Objects' Add square and Add circle buttons;
  3. a saved version 6 record holding no shape is compared as its version 5 form (version 5);
     a record holding a shape is never masked.
  After the masks the candidate must match at every checkpoint in markup, focus, canvas
  drawing and saved records.
- **0002-W1's scenario M**, unchanged except at M3: the saved record is version 6 instead of 5.
- **0001-W6's scenario K**, unchanged except in its step "Edit the sticky and append text": the
  saved record is version 6.
- **0001-W26's scenario L**, unchanged: all 21 checks pass.
- **Regression harness.** The eight PASS lines at the fixture index page and at
  `regressions.html` ([tests README](../../tests/README.md)), in headless Chrome.

The maintainer checks three items drawn from scenario N in Safari. No browser matrix,
accessibility audit, native IME check, phone layout check or performance test unless the
maintainer asks.

## Exclusions and reasons

- Shapes other than square and circle, a shape library or search; rotation.
- Connectors, connection dots on selected objects and quick-create arrows (0002-W2).
- Border width, a stored text colour, recently used custom colours.
- A change to stickies', text's or sections' colours or Colour menu.
- Hit testing by a circle's outline instead of its rectangle.
- A shape growing while its text is typed (only Grow to fit text grows it).
- Single-letter keys other than R and O.
- Fixes for bugs noticed on the way (report them).

## Public references with retrieval dates

None beyond the repository's own documents.

## Implementation record

### 2026-10-26 — Codex implementation handoff

- Brief: **0002-W4 v1 only**, with document v6, interaction v18 and web modules v16.
- Branch: `codex/0002-W4-draw-basic-shapes`; worktree: `.worktrees/codex-0002-W4`.
- Committed main/base: `eb79dca0a1c63d4f87d1922c730fe6da8d81c952`.
- Validated source/test revision: `8731f441a8e34001eb7bc3a1e9f8245366ec4b57`
  (`feat(web): add basic shapes with text and paint`). The final checks below ran on
  its identical source/test tree before that commit. This record is a subsequent
  documentation-only commit; the final branch tip is reported separately in the handoff.
- Added dependencies: **none**. Packages, lock, contracts, browser fixtures and browser
  regression harness are unchanged. Builds verified the accepted lock and distributed notices.
- Scope: five new files and forty changed files, all on this brief's allowlist, before
  appending this record. `App.tsx` remains exactly 262 lines; module guards retain nineteen
  state hooks and enforce the six scene, five object-type and sixteen screen-part modules.

Commands were run from the repository root with Node **24.22.1** and npm **11.19.1**
selected in `PATH`. These are the final results for the validated source/test tree:

| Exact command | Result |
| --- | --- |
| `node --version` | Exit 0; `v24.22.1`. |
| `npm --version` | Exit 0; `11.19.1`. |
| `npm --prefix apps/web ci --ignore-scripts --no-audit --no-fund` | Exit 0; 19 packages installed, manifest and lock unchanged. |
| `npm --prefix apps/web run typecheck` | Exit 0. |
| `node --test tests/shapes.test.mjs tests/document.test.mjs tests/storage.test.mjs tests/objects.test.mjs tests/modules.test.mjs` | Exit 0; **127 passed, 0 failed**. |
| `npm --prefix apps/web test` | Exit 0; **412 passed, 0 failed**. No full-suite failure required comparison at `74df93d`. |
| `npm --prefix apps/web run build` | Exit 0; application built; lock, inventory and notices verified. |
| `npm --prefix apps/web run build:fixtures` | Exit 0; disposable fixtures built; lock, inventory and notices verified. |
| `git diff --check` | Exit 0; no whitespace errors. |
| `git diff --name-only main...HEAD` | Exit 0 at the validated revision; all 45 listed source/test files are allowed by this brief. Rechecked after the record commit for the final handoff. |

`tests/shapes.test.mjs` includes pure document/paint/layout/history checks and direct unit
calls to the actual editing, geometry and canvas input hooks using React's server renderer.
Those tests use synthetic events and no DOM or browser. They cover pointer and Enter
creation, R/O restrictions, session paint through history, mixed selections, fixed geometry
during text/style edits, Grow to fit text, and the rendered native controls.

Development checks before the final results above:

- The first `npm --prefix apps/web run typecheck` failed on layout-map inference,
  context-position declaration order and history endpoint typing. Those errors were fixed;
  subsequent invocations passed.
- The first five-file command above passed 117/120 tests. Its three new-test failures were
  incorrect expected channel rounding, a non-additive ellipsis measurement stub and a
  creation-undo assertion that incorrectly expected retired generations to disappear. The
  assertions were corrected to the contracts. Later runs passed 120, then 123, then 127 tests
  as focused coverage was added.
- `node --test tests/shapes.test.mjs` initially passed 18 tests with a duplicate-Yjs warning
  from its hook compilation. Sharing the installed Yjs module removed the warning. A later
  run failed while loading bundled JSX because React's JSX runtime was not externalized;
  sharing that installed runtime fixed the test loader. The final isolated run passed all
  **22** tests without those diagnostics.
- An earlier `npm --prefix apps/web test` passed all 408 tests, and both earlier build
  commands passed. The final 412-test run and both builds followed the last UI corrections
  and additional direct-handler coverage.

Review and exclusions:

- **Not run:** browsers, browser regression harness, Scenario N (including its `74df93d`
  negative control), the existing comparison scenarios M/K/L, Safari checks, native IME
  checks, or any other browser acceptance sweep. These remain for the independent reviewer;
  unit tests and fixture compilation do not establish browser acceptance.
- No baseline full-suite run was needed because the candidate full suite passed. No merge,
  push, publication or subsequent milestone was performed. The worktree began clean.
- Codebase-memory `list_projects` and `index_repository` were attempted first, but both
  tool calls were rejected because they required approval unavailable in this sandbox.
  Repository reads were used for discovery after that rejection.
- Both public-boundary checks passed during the source/test commit. Git also emitted a
  sandbox permission diagnostic for `packed-refs.lock`; the commit succeeded (exit 0), its
  full ID was verified, and the working tree was clean before this record was appended.
