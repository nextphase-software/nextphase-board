# 0001 — Web app modules

Note version: 43 (for 0011-W1 brief v1, 2026-11-17). Status: Draft.
Replaces [web modules v42](0001-web-modules-v42.md), whose registry, import, composition, one-state-owner,
team guards, counts and seams remain word for word except as below.
[Interaction v45](0001-interaction-v45.md) adds tables with exactly these five new source modules and two test files.
[Document v20](0001-document-v20.md) and [sync v15](0003-sync-v15.md) change the packages and the room as
listed.

| Module | Responsibility |
| --- | --- |
| `packages/board-rules/src/objects/table.ts` | The `table` type record (as every type module: `voting: true`, `type: "table"`, `label: "Table"`, `tool: "Table"`, `validFrom: 14`, `text: false`, `ends: false`, `points: false`, `container: false`, `savedKeys` of document v20, `labelPrefix` `table`, no connection dots) and the pure table rules: validating a table (document v20); creating a C × R table; adding, inserting and deleting a row or column; setting a width or set height within bounds; scaling for a corner resize; setting and clearing a cell's text; reading a cell; the reading-order next and previous cell; the neighbour cell for an arrow; remapping ids for duplicate and paste. Imports only `./sibling.ts` and `../styles.ts`. No DOM, React, Konva or clock |
| `apps/web/src/table.ts` | Pure web table rules, no React or DOM: hit testing a board point against a table (cell, column or row border within 4, grabber, add bar); drawn row heights from measured text heights; the drag-to-place size and ghost; the selection level type (`table`, `cell`, `row`, `column`) and its validity after a board change (including interaction v45's remote-delete words); the context bar's mode and disabled reasons; the announcement and editor names |
| `apps/web/src/scene/table-body.tsx` | Draws a table on the canvas (Konva, as `mind-node-body.tsx`): fill, grid, rounded outline, cell texts, the cell/row/column selection and editing outlines, the resize line and the place-by-drag ghost (its `C × R` label is a DOM element in `table-buttons.tsx`) |
| `apps/web/src/scene/table-buttons.tsx` | The grabbers and add bars as DOM buttons over the canvas, placed with `pos` and the zoom exactly as `mind-map-buttons.tsx` places its buttons, children of `.scene` in the same stacking as `.mind-map-add` (no new z-index; `pointer-events` on the buttons only), shown only when interaction v45 says, and re-placed on every view, board and selection change as the mind-map buttons are |
| `apps/web/src/ui/table-controls.tsx` | The context bar contents for Table, Cell, Row and Column selections, and the Row options and Column options menus |
| `tests/tables.test.mjs` | The unit test file named in the brief |
| `tests/server/tables.test.ts` | The server checks named in the brief (both server runners) |

**Counts.** The rules package holds exactly **16** files (adding `objects/table.ts`). Exactly **11** object
types (the object-type list gains `table.ts`), **18** scene parts (gains `table-body.tsx` and
`table-buttons.tsx`), **33** screen
parts (gains `table-controls.tsx`) and **25** state hooks (no new hook). The board-sync list is unchanged.
Every effect count is unchanged. The type-name guard list gains `table`: App, screen and scene parts, rules
modules and web `.ts` and state files may not compare type names, and reach tables through the registry's
predicates (a new `isTable` beside `isImage`, `isMindNode` and `isTape`).

**The rules package.**
- `objects/registry.ts`: `table` joins `ObjectType` and the rectangle unions, and `OBJECT_TYPES` **directly
  after `section`** (which places the Table tool after the Section tool); `isTable`; `objectKeys` uses the
  record's `savedKeys`; `ADD_OPTIONS` excludes tables; `toolForKey` maps ⇧T to `Table`; `eligibleIdea` and
  connector-end validity exclude tables.
- `document.ts`: schema version 14 everywhere document v20 says (the version union, `validate`, the page
  rules for 13 and 14, `payloadBytes`, `canonical`, `upgrade`, `empty`, `add`), and table validation
  dispatched to `objects/table.ts`.

**The sync package.**
- `codec.ts` reads a table's map (sync v15) and accepts schema versions 13 and 14 where it accepted 13.
- `document-adapter.ts` writes `place`, `tableStyle`, `columnMap`, `rowMap` and `cells` by sync v15's
  rules (initialization, edits, cleanup), reusing `order-keys.ts` and the sticky text's grapheme diff.
- `session.ts` and the web's `state/use-board-document.ts`: the commit seam carries sync v15's typed **table
  order hint** (table id, axis, moved ids, and for Undo and Redo the exact order keys to restore) beside v42's
  moved pages and page orders, through commit, Undo and Redo. The `update` frame is unchanged.
- `undo.ts` records sync v15's **table steps** (before and after values of exactly what the step wrote, a
  compound guard) and applies them atomically; whole-table units stay object units (fresh table id on
  re-creation, nested ids kept).
- `comments.ts`: unchanged (a table is named by its type through the existing rule).

**The room and server.**
- `conflicts.ts`: `promote()` also re-assigns `order`, `width` and `height` writes inside `columnMap` and
  `rowMap` entries, skipping deleted entries.
- `room.ts`: new boards at 14; the load-time upgrade table of sync v15 (three branches, unchanged revision);
  the version check after `validate` expects 14.
- `edits.ts` expects 14 after an edit; `history.ts` reads 10–14, its legacy comparison gains version 13
  (keeping `pages` and `page`), and captures, restore and backups upgrade 13 to 14 before applying;
  `backups.ts` only if it checks the schema version. `packages/board-rules/src/transition.ts` is unchanged.
  Image refusals are unchanged.
- `apps/server/src/routes/boards.ts` (create and import: accept 13 or 14, upgrade 13 before checking for
  tables) and `apps/server/src/templates.ts` (templates at 14): the same version change. (The room package
  has no templates module.)

**Web paths.**
- `state/use-selection.ts` holds the table selection level (interaction v45) beside the object selection,
  with one owner, and clears or moves it on board changes by `table.ts`'s rule.
- `state/use-canvas-input.ts`: ⇧T; placing by click and drag; cell, grabber and add-bar clicks; border
  drags; the table, cell and row/column keys of interaction v45.
- `state/use-geometry-edits.ts` and `state/use-text-entry.ts`: editing a cell (the open cell, its draft,
  composition) as sticky text is edited, with the row growth in the same step.
- `state/use-object-layouts.ts`: a table's drawn row heights and drawn box (interaction v45), from the canvas
  text measurement; `state/use-editor-placement.ts`: placing the cell editor (today it refuses objects without
  text); `context-bar-position.ts`: the 26 / 48 offsets above the table's drawn top.
- `state/use-validity.ts`: the cell draft's over-limit state and notice.
- `scene/board-drawing.tsx` draws tables through `table-body.tsx`; `scene/inline-editor.tsx` places the
  cell editor; `scene/connection-dots.tsx` draws none for tables.
- `ui/context-bar.tsx` shows `table-controls.tsx` when the only selected object is a table;
  `ui/content-field.tsx`: Return, Tab, Shift+Tab and Escape in a cell editor; `ui/objects-panel.tsx` and
  `sections.ts`: the `table N` name and its `C × R`.
- `state/use-editing-commands.ts`: the table actions (add, delete, Delete content) and the selection after
  Undo and Redo (interaction v45).
- `ui/table-controls.tsx` owns its menus' open state and focus, as `ui/move-to-page.tsx` owns its menu's.
- `history.ts`, `clipboard.ts` and `activities.ts` (`copyObjects`): duplicate, paste and template or
  activity insertion remap table ids (document v20 rule 3); `resize.ts`:
  the corner scaling (single and multiple selection); `connectors.ts`: no attachment to tables;
  `ui/objects-panel.tsx`: the size fields scale a table as a corner resize.
- `board-file.ts` and `storage.ts`: "newer" means a version above 14.
- `team/templates-rules.ts`, `team/import.ts`: the version change only.
- `state/use-hosted-board.ts` / `team/hosted-board.ts`: pass each change's origin and connection to
  `use-selection.ts` as they pass it to `use-pages.ts` (v42), for interaction v45's remote-delete rule.
- `apps/web/style.css`: the table, grabbers, add bars, resize line, ghost and menus, as new classes prefixed
  `table-`.

Each may change only as far as its contract needs. Every hook that commits still gets the whole board.

**App.tsx** remains composition-only, at most 264 lines, with **no added line**. Changes are substitutions
on existing lines only. A substitution may pass values App already has and **new return values of hooks App
already calls** on those lines (for example the table selection from `use-selection.ts`, the cell editor's
placement from `use-editor-placement.ts`, table actions from `use-editing-commands.ts`). `table-buttons.tsx`
is imported on the line that imports `MindMapButtons` and mounted on the line that mounts it, beside it. The implementation record lists every
substitution with its 3f4ad48 line and its before and after text. The "0010-W3 App composition" test in
`tests/modules.test.mjs` is rewritten as "0011-W1 App composition": it derives the expected App from
3f4ad48's App with exactly the recorded substitutions (each `from` text occurring exactly once) and asserts
the same line count. If no App line needs to change, the test is renamed only.

No dependency, font file, image file, service, service migration or import exception. Stored values: the
document v20 table keys and nothing else.
