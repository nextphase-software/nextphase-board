# 0001 — Web app modules

Note version: 46 (for 0012-W2 brief v1, 2026-11-21). Status: Draft.
Replaces [web modules v45](0001-web-modules-v45.md), whose registry, import, composition, one-state-owner,
team guards, counts and seams remain word for word except as below.
[Interaction v48](0001-interaction-v48.md) adds export with exactly four new source modules (one state hook, one
screen part, one scene part, one rules module) and one test file. No package, room or server file changes.

| Module | Responsibility |
| --- | --- |
| `apps/web/src/board-export.ts` | Pure export rules, no React, DOM globals or Konva: the export choices, their defaults, which groups each file type shows and which choices are disabled, and the memory rules; the opening gates in interaction v48's order; the export reason; the included objects (the selected drawn ids plus the drawn objects whose stored section is selected); whole tables (with the table-selection exception); stickies (`typeForTool("Sticky")`); the JPEG frame check; the bounds (`selection.ts` `boundingBox`) and the picture box; the scale fit; the grid dot positions; the JPEG qualities; the PDF file bytes from the JPEG bytes, the pixel size, `W`, `H` and the board name; the Tables and Stickies CSV text (through `table-csv.ts`); the file names; the order of interaction v48's export rules and every notice text. Imports only `nextphase-board-rules` and the web `selection.ts`, `table.ts`, `board-file.ts` and `table-csv.ts` |
| `apps/web/src/scene/export-drawing.tsx` | One function, `drawExport`, that returns the drawing of the included objects as a canvas element: it renders `BoardDrawing` into a detached element through a `react-dom/client` root inside `flushSync`, with the frozen page board (all its objects, so connector and mind-map layouts come from the whole page), `only` set to the included ids, the frozen layouts and pictures, an empty selection, `inline` false, no fade, no table selection or cell, `tableGesture` with no ghost and no border, no connection, no preview, no moving ids, `size` `{ w: 2, h: 2 }` and `view` `{ x: L + 1, y: T + 1, z: 1 }` (so the board point `(L, T)` is the stage origin and the stage stays 2 × 2); takes the Konva stage through `BoardDrawing`'s new `stageRef`; calls `toCanvas({ x: 0, y: 0, width: Wp / S, height: Hp / S, pixelRatio: S })` (Konva rounds its size down, so the
result may be one pixel short; the caller copies it 1:1 at the origin and never stretches it); and in a `finally` unmounts the root and removes the element. It holds no React state and adds no effect |
| `apps/web/src/state/use-export.ts` | The export's state owner: whether the dialog is open, the shown choices (the stored choices are one module-level value, kept for the tab's lifetime across App mounts, never React state and never saved), the element to refocus, whether an export is running; `open()` for the key; the Export… button's `{ shown, disabled, open }`; the dialog's props (including `close` for Cancel, Escape and a native close, and the refocus after the dialog is removed); the export run (freezing its inputs, the rules in `board-export.ts`, the drawing through its `draw` input, the output canvas of exactly `Wp × Hp` with the background, the encoders, the 250 ms image recheck through refs to the latest pictures, board id and role assigned during render, interaction v48's "Still current" check (the canvas element still connected, the same board, still allowed) at Export and before every notice or download, the download and `setMessage`). State hooks never import scene parts (the existing guard), so App passes `drawExport` as the input `draw`, whose type `board-export.ts` declares. No effect |
| `apps/web/src/ui/export-dialog.tsx` | The dialog's markup from its props: `null` while closed; otherwise the native `<dialog>` with the class `export-dialog`, a ref callback that calls `showModal()` once, its `cancel`, `close` and `keydown` handlers (Return, the Tab wrap and the stop of propagation) and the controls of interaction v48. No React state |
| `tests/board-export.test.mjs` | The unit test file named in the brief |

**Counts.** From v45: **26 state hooks** (`use-export.ts` added), **34 screen parts** (`export-dialog.tsx`
added), **19 scene parts** (`export-drawing.tsx` added); every other count unchanged (rules package 16 files, the
object-module counts, the board-sync list, the team module list) and every effect count unchanged, with
`use-export.ts` holding **no** effect. `board-export.ts` is a web `.ts` file, so the type-name guard applies to it.
The three module-list tests in `tests/modules.test.mjs` name the new file in sorted order and say "through 0012-W2
v1" in their titles.

**Web paths.**
- `scene/board-drawing.tsx`: two new optional props. `stageRef`, passed to its `Stage` as `ref`; and `only`, a set of
  ids: when given, only objects in it are drawn (layouts and drop targets still come from the whole board) and it is
  passed on to `MindMapLayer`. Nothing else changes; the canvas passes neither.
- `scene/mind-map-layer.tsx`: one new optional prop, `only`: when given, a link is drawn only when both its nodes are
  in it, on the side the whole board gives it. Without it, nothing changes.
- `state/use-find.ts`, `state/use-presence.ts`, `team/spotlight-layer.tsx`, `team/reactions-layer.tsx` and
  `team/comments/layer.tsx`: each capture-phase `keydown` handler returns at its start, doing nothing, when the event's target is inside the
  Export dialog (`closest(".export-dialog")`). Their `keyup` handlers and their handling of every other dialog do not
  change; nothing else in these files changes; their effect counts stay.
- `state/use-page-keys.ts`: the input `exportTable` is replaced by `openExport: () => boolean`; ⇧⌘E / Ctrl+Shift+E
  on the canvas (the same key test as today) calls it and prevents the default only when it returns true.
- `table-csv.ts`: two new exports with no behaviour change: `csvField(text)` (v47's formula rule, then its CSV
  quoting, for one field) and `tableCsvBody(table)` (`tableCsv` without its byte-order mark); `tableCsv` returns the
  byte-order mark followed by `tableCsvBody`.
- `ui/table-controls.tsx`: the Export as CSV tooltip reads `Export as CSV` on every platform.
- `ui/board-panel.tsx`: the `Export…` button right after `Save a copy to file` in `.board-file-commands`, from a new
  optional `exportButton` prop (`{ shown, disabled, open }`; `open` receives the clicked button; absent or not
  shown: no button).
- `apps/web/style.css`: rules for the dialog's groups, choices, select and static values at interaction v48's
  values, scoped under the dialog's class `export-dialog`; no change to existing rules.

Each may change only as far as its contract needs. `state/use-editing-commands.ts` does not change: its
`tableData.exportTable` stays the table bar button's action.

**App.tsx** remains composition-only, **264 lines, no added line**. Exactly these substitutions on existing
lines of b3afc2c, each passing values App already has:

| b3afc2c line | Change |
| --- | --- |
| 22 | `import { useEditorPlacement } from "./state/use-editor-placement"; import { useExport } from "./state/use-export"; import { drawExport } from "./scene/export-drawing";` |
| 38 | `import { BoardQuestion } from "./ui/board-question"; import { ExportDialog } from "./ui/export-dialog";` |
| 125 | Prefixed with `const exporter = useExport({ page: pages.id, board: pages.canvas(tidy.board), objects: displayedObjects, objectLayouts, selected, tableSelection, bitmaps: images.bitmaps, hosted: team?.hosted, busy, composing, tidyOpen: tidy.open, setMessage, scene, setPanel, boardButton, draw: drawExport }); ` after its two leading spaces; the rest of the line unchanged |
| 133 | `exportTable: tableData.exportTable` becomes `openExport: exporter.open`; the rest unchanged |
| 205 | `BoardPanel` also gets `exportButton={exporter.button}`, right after `importTable={tableData.importButton}` |
| 253 | `      <BoardQuestion {...boardQuestion} /><ExportDialog {...exporter.dialog} />` |

Every value on line 125's prefix is declared on an earlier line. The "0011-W2 App composition" test in
`tests/modules.test.mjs` is renamed "0012-W2 App composition": it keeps every earlier substitution and adds these
six after them (each `before` the exact b3afc2c line), and still checks the same line count. The implementation
record lists every substitution with its before and after text.

No dependency, font file, image file, service, service migration or import exception (`react-dom/client` and
`konva` are existing dependencies). No stored value, room message, presence key or Undo step is added.
