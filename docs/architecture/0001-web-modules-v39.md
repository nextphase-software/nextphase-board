# 0001 — Web app modules

Note version: 39 (for 0009-W3 brief v1, 2026-11-14). Status: Draft.
Replaces [web modules v38](0001-web-modules-v38.md), whose registry, import, composition,
one-state-owner and team guards remain word for word except as below. [Document v17](0001-document-v17.md)
and [interaction v41](0001-interaction-v41.md) add washi tape, twelve shape kinds and Tidy up with
exactly these eight new source modules and four new test files:

| Module | Responsibility |
| --- | --- |
| `packages/board-rules/src/objects/tape.ts` | The `tape` type record, modelled on the stroke's: `type` "tape", `label` "Washi tape", **`tool` null** (not a placement tool: no palette button, not in `ADD_OPTIONS`; "Washi tape" is a drawing tool in `DRAWING_TOOLS` only), `validFrom` 12, `body` "tape-body", `points` **false** (the flag stays the strokes' ink-points flag), `text` false, `ends` false, `container` false, `richText` false, `voting` false, `shapePaint` false, `growsWithText` false, `kinds` `[]`, `extraKeys` `["pattern", "points"]`, `savedKeys` in document v17 order, `validExtras` (the tape rules), `sizeRange` 28–2,028, `labelPrefix` "washi tape", `contextLabel` "Washi tape", and whatever other fields the registry reads from every record, with the stroke's values; the pattern list (`TAPE_PATTERNS`: value and name, document order), the band (28) and pad (14), length limits 16–2,000. Last in `OBJECT_TYPES`. Imports only siblings or `../styles.ts` |
| `apps/web/src/tape.ts` | Pure rules: a tape from two board points (whole units, rectangle and relative points by document v17, length clamped along the direction), the click strip, moving one end, the band polygon with its torn ends, hit and box tests, the selected outline and end-handle points. Asks the registry, never names a type |
| `apps/web/src/tidy-up.ts` | Pure rules: the placeable items of a selection (groups and sections as one item), their boxes, reading order, the grid (default columns, spacing bounds, cell sizes, centring, board edges, whole-unit offsets), spacing-handle places, the moved board for a preview or Apply, and whether an incoming change touches the placed items. No Konva, React or DOM |
| `apps/web/src/scene/tape-body.tsx` | One tape's band, torn ends, pattern fill (patterns drawn by the app into a canvas used as the fill pattern, turned with the band), selected outline and end handles (Konva); the preview band while drawing |
| `apps/web/src/scene/tidy-up-layer.tsx` | The preview's grid rectangle, the spacing handles and the dragging label (DOM elements placed with `pos` like the mind-map buttons, each handle a pointer target) |
| `apps/web/src/ui/tape-controls.tsx` | The context bar's tape controls (label, Pattern button and menu) and the Objects panel's pattern list |
| `apps/web/src/ui/tidy-up-bar.tsx` | The Tidy up bar of interaction v41 (label, Columns − field +, Spacing field, Cancel, Apply), placed by the context bar's rule |
| `apps/web/src/state/use-tidy-up.ts` | The one owner of Tidy up state: open or closed, columns, spacing, the handle drag, the preview board, the cancel rules (including incoming hosted changes, through `tidy-up.ts`) and Apply through `commit` |
| `tests/tape.test.mjs`, `tests/shape-kinds.test.mjs`, `tests/tidy-up.test.mjs`, `tests/server/drawing-layout.test.ts` | The unit and server test files named in the brief |

Counts: the rules package holds exactly **15** files (14 + `objects/tape.ts`); exactly **10**
object-type modules; exactly **15** scene parts (13 + 2); exactly **29** screen parts (27 + 2);
exactly **23** state hooks (22 + `use-tidy-up.ts`, with its own effect count of at most 2); every
other effect count unchanged. The package rules list stays `document.ts`, `marks.ts`, `styles.ts`,
`transition.ts`; the tape rules live in `objects/tape.ts` and the version gate of shape kinds in
`objects/shape.ts`.

**Shapes in the rules package.** `objects/shape.ts` gains the twelve kinds in `SHAPE_KINDS` (each
with its value, name, `key` null for the new ones, `validFrom` 12 for the new ones, its outline as
fractions or `round`/`rounded` for the ellipse and rounded rectangles, and its text box fractions);
`validShape` accepts a new kind only from schema 12 (a version-gated value, as `END_SIDES` in
`objects/connector.ts`); `shapeTextBox` and `fitHeight` read the kind's text box;
`registry.ts`'s `outlinePoint` clips to any kind's outline. `ADD_OPTIONS` keeps one entry for Square
and one for Circle only (kinds with a key); `toolForKey` skips kinds without a key; a new kind's
`labelPrefix` is its name in lower case.

**The registry.** `OBJECT_TYPES` gains `tape` last; `objectKeys` returns a record's own `savedKeys`
when it has them (no longer the stroke's keys for every pointed type); one predicate for tapes (for
example `isTape`); `eligibleIdea` excludes tapes through that predicate (so no connection dots, no
connector targets, and the document refuses a connector end naming a tape). `hasPoints` stays true for
strokes only, so the eraser, stroke colours and weights, proportional resize, stroke hits and the
stroke context bar never see a tape; tape hits and box selection are added beside the strokes' in
`connectors.ts`.

**App.tsx** remains composition-only and at most 264 lines, with **no added line**. Its only
permitted changes are these eleven substitutions on existing lines (5397b75 line numbers):
1. imports: `useTidyUp` appended to the line importing `useObjectLayouts` (21); `TidyUpLayer` and
   `TidyUpBar` appended to the line importing `Overlays`, `ConnectionDots` and `MindMapButtons` (24);
2. the `useSelection` destructuring (56–57) gains `tapeSelection`;
3. the statement ending the `useSelection` call (58) gains, after it on the same line,
   `const tidy = useTidyUp({ … });` passing only values App already has at that point (for example
   `board`, `selected`, `commit`, `tool`, `setMessage`, `hosted: team?.hosted`); `useTidyUp` returns at
   least `open`, `board` (the preview board while open, else `board`) and `selected` (an empty set while
   open, else `selected`);
4. the `useObjectLayouts` argument line (69) passes `board: tidy.board` and `selected: tidy.selected`
   in place of `board` and `selected`, so layouts, connector routes, outlines, handles and group
   outlines follow the preview;
5. the `useCanvasInput` argument line that passes `drawing` (104) gains `tidy`;
6. the `BoardDrawing` props line (173) passes `board={tidy.board}` and `selected={tidy.selected}`;
7. the `ConnectionDots`/`MindMapButtons` line (180) gains `<TidyUpLayer … />` and `<TidyUpBar … />`
   after `<MindMapButtons … />`, passing only values App already has;
8. the condition `selected.size > 0 &&` opening the `ContextBar` block (221) becomes
   `selected.size > 0 && !tidy.open &&`;
9. the first props line of `<ContextBar` (223) gains `tapeSelection={tapeSelection} tidy={tidy}`;
10. the first props line of `<ObjectsPanel` (210) gains `tapeSelection={tapeSelection} tidy={tidy}`;
11. the `useCommandReasons` argument line that passes `displayedObjects` (115) gains `tidy`, so the
    selection and clipboard reasons read `Apply or cancel Tidy up first.` while a preview is open.
The existing "0009-W2 App composition" test in `tests/modules.test.mjs` (583–602) is rewritten (not kept
beside a new one) to derive the expected App from 5397b75's App with exactly these eleven
substitutions. Line 180's elements get `pos`, `view`, `size` and `layout`, which App already has, so
`TidyUpBar` places itself with `contextBarPosition`.
The session pattern travels inside `drawing` (from `use-gesture-state.ts`), the tape pattern command
inside `strokeCommands` (from `use-editing-commands.ts`), and tape end moves inside `use-canvas-input.ts`
through `tape.ts` and `commit`, so none needs another App change.

Seams, and only these:
- `state/use-canvas-input.ts`: the W key; the tape gesture (preview, drag, click) through `tape.ts`;
  end-handle drags committed through `commit`; ⌥⇧T; Enter, Escape and canvas presses while a Tidy up
  preview is open (apply or cancel as interaction v41), through `tidy`; no connection dots and no dot
  or connector-end presses while `tidy.open`.
- `state/use-tidy-up.ts` also owns the Tidy up bar's element through a callback ref and its measured
  width (no extra effect), and moves focus to the canvas on open, Apply and Cancel.
- `state/use-command-reasons.ts`: with `tidy.open`, the selection and clipboard reasons are
  `Apply or cancel Tidy up first.`.
- `state/use-tidy-up.ts` closes the preview by itself when `tool` or `selected` changes, when the
  window narrows under 768 CSS pixels (its own window resize listener), and when `board` changes so that a placed item or a member of one changes
  (with the hosted toast on hosted boards); Escape and Enter inside its bar are handled by the bar.
- `state/use-gesture-state.ts`: the session pattern inside `drawing`, beside the ink session style.
- `state/use-selection.ts`: `tapeSelection` (the tape-only selection) beside `strokeSelection`.
- `state/use-object-layouts.ts`: no resize handles for a selection holding a tape; tape end-handle
  points.
- `state/use-editing-commands.ts`: the tape pattern command inside `strokeCommands`.
- `state/use-geometry-edits.ts`: shape growth by kind (`fitHeight`); `resizeBy` and every resize path
  never change a tape (Objects' size buttons unavailable for a selection holding one).
- `scene/board-drawing.tsx` (dispatches tapes to `tape-body.tsx`), `scene/shape-body.tsx` (draws every
  kind's outline), `scene/inline-editor.tsx` only if the editor box needs the kind's text box.
- `ui/drawing-tools.tsx` (four tools; icons by tool name, never by index; the pattern buttons),
  `ui/shape-controls.tsx` (two-column menu; fourteen kinds in the Objects select), `ui/shapes-panel.tsx`
  (the 4-column icon grid), `ui/context-bar.tsx` (tape branch; the Tidy up button), `ui/objects-panel.tsx`
  (tape label, the Pattern select, the size buttons' tape reason, Tidy up's unavailable state), `ui/palette.tsx` only if the Draw button's icon needs the tape tool.
- `strokes.ts` (the eraser keeps strokes only), `connectors.ts` (outline clipping by kind for straight
  and curved ends; tape hits and box selection beside the strokes' in `hitObject` and `selectInBox`),
  `sections.ts` (tape as a member; `objectLabel` for `washi tape <n> · <Pattern>`), `group.ts` (tape as a
  member, only if needed), `clipboard.ts` (tape points kept relative, only if needed),
  `icons.tsx` (the Washi tape, Tidy up and twelve kind icons), `storage.ts`, `board-file.ts`,
  `team/templates-rules.ts`: the version references and type support the brief lists.
- `vitest.node.config.ts` and `vitest.workerd.config.ts`: their include lists gain
  `tests/server/drawing-layout.test.ts` only; `tests/README.md` names the new files.

Packages: `board-rules` (`document.ts` version 12, `BoardV12`/`ItemV12`, the upgrade and `empty()`;
`objects/registry.ts`; `objects/shape.ts`; `objects/stroke.ts` `DRAWING_TOOLS` gains "Washi tape"
before "Eraser" and `drawingKey` maps W), `board-sync` (`codec.ts` version 12 and the tape keys;
`comments.ts` names a tape), `board-room` (`edits.ts` version 12; `history.ts` accepts 10, 11 and 12,
and its upgrade-only capture rule covers the 10 → 12 and 11 → 12 upgrades: a comparison copy at an
older version is prepared only when the board is valid at that version, that is, holds no object or
value that version lacks, so preparing it never throws; `room.ts` version 12 and the load
upgrade from 10 or 11), server (`routes/boards.ts`, `templates.ts` version 12). The type names
`BoardV11` and `ItemV11` become `BoardV12` and `ItemV12` everywhere; a file whose only change is that
rename (and a `schemaVersion` literal type 11 → 12) is a permitted rename-only file. No package,
dependency, font, image file, service or import exception.
