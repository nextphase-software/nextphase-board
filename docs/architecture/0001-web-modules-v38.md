# 0001 — Web app modules

Note version: 38 (for 0009-W2 brief v1, 2026-11-14). Status: Draft.
Replaces [web modules v37](0001-web-modules-v37.md), whose registry, import, composition,
one-state-owner and team guards remain word for word except as below. [Document v16](0001-document-v16.md)
and [interaction v40](0001-interaction-v40.md) add mind maps with exactly these five new source
modules and two new test files:

| Module | Responsibility |
| --- | --- |
| `packages/board-rules/src/objects/mind-node.ts` | The `mindNode` type record: keys (document v16 order), `extraKeys` `parent`, `side`, `rank`, `collapsed`, defaults (`parent` null, `side` null, `rank` 0, `collapsed` false: a valid root), `validExtras`, text limit 200, `initialText` "", `richText` false, `growsWithText` false (layout owns the size), the node text box (8 / 6 insets), default style neutral / medium / left, `sizeRange` 1–20,000, `defaultSize` 120 × 39 (replaced by layout), `editorMinimum` 0 × 0 (the editor is the box), `fontSize` 24 for a root and 18 otherwise (the record reads `parent`; callers pass the object), `textColor` the text colour entry, no `fill` or `edge`, its own `body`, `draws` false, `previewRadius` 0, no `kinds`, `shapePaint` false, `legacyStyle` equal to the default style, `validFrom` 11, `tool` "Mind map", label "Mind map node", `labelPrefix` "mind map node", `voting` false, not a container, no ends, no points; last in `OBJECT_TYPES`. Imports only siblings or `../styles.ts` |
| `apps/web/src/mind-map.ts` | Pure rules: children, descendants, map of a node, root, outer side, visibility, hidden counts; the layout of interaction v40 with a **measuring callback** (no Konva, React or DOM); starter map; add child and sibling; reparent and detach; delete with children moving up; collapse and expand; rank rewriting; the copy remap of `parent`; drop targets; status words. Asks the registry, never names a type |
| `apps/web/src/scene/mind-node-body.tsx` | One node's text in its look, the placeholder and the selected outline (Konva) |
| `apps/web/src/scene/mind-map-layer.tsx` | Branch lines in the connectors' band, the map frame, the drop outline and the dashed preview curve (Konva) |
| `apps/web/src/scene/mind-map-buttons.tsx` | The add buttons and every visible collapse badge (DOM buttons with their tooltips and 28 × 28 hits), placed with `pos` like the connection dots; each calls `command()` |
| `tests/mind-map.test.mjs`, `tests/server/mind-maps.test.ts` | The unit and server test files named in the brief |

Counts: the rules package holds exactly 14 files (13 + `objects/mind-node.ts`); exactly **9**
object-type modules; exactly **13** scene parts (10 + 3); exactly 27 screen parts and 22 state hooks
(unchanged); every effect count unchanged. The registry gains one predicate for mind nodes (for
example `isMindNode`), and `sectionIdea`, `eligibleIdea` and `ADD_OPTIONS` exclude mind nodes. The package rules
list stays `document.ts`, `marks.ts`, `styles.ts`, `transition.ts`; the structure rule of document
v16 lives in `document.ts`.

**App.tsx** remains composition-only and at most 264 lines, with **no added line**. Its only
permitted changes are these six substitutions on existing lines:
1. the line importing `Overlays` and `ConnectionDots` gains `import { MindMapButtons } from
   "./scene/mind-map-buttons";` at its end;
2. the `useObjectLayouts` destructuring gains `measureNode` (the node measuring function);
3. the `useGeometryEdits` argument list gains `measureNode` on the line that passes `lineCount`;
4. the `useEditingCommands` argument list gains `measureNode` on the line that passes `lineCount`;
5. the `<ConnectionDots … />` line gains one `<MindMapButtons … />` element after it, passing only
   values App already has (for example `displayedObjects`, `selected`, `inline`, `pos`, `view`,
   `busy`, `composing`, `readOnly` and `command`);
6. the first props line of `<ContextBar` gains `board={board}`.

The 0008-W2 composition test is replaced by one that derives the expected App from 9f843d0's App with
exactly these six substitutions.

Seams, and only these:
- `state/use-editing-commands.ts`: `command()` gains the names `Add child`, `Add child left`, `Add
  child right`, `Add sibling`, `Collapse` and `Expand`; its existing Delete, Duplicate and clipboard
  paths apply the mind-map rules (children move up; `parent` remap). Layout runs inside each
  command's commit.
- `state/use-canvas-input.ts`: its Enter handling ignores Enter with ⌘ or Ctrl; the single-node drag
  target and the drag's preview value (carrying the drop target and the drag-time drawing from saved
  boxes); whole-map moves for multi selections; the drop itself goes through `movedBoard` (from
  `use-geometry-edits.ts`, which has `measureNode`), so this hook needs no measuring function.
- `state/use-geometry-edits.ts`: placement creates the starter map; `commitText` writes the edited
  node's measured box on each keystroke; `movedBoard` applies reparent, detach and root join,
  measuring nodes whose role changes.
- `state/use-object-layouts.ts`: `displayedObjects` leaves hidden nodes out; no resize handles on mind
  nodes; it defines and returns `measureNode` (Konva text measurement in the node look), which App
  passes to the geometry-edits and editing-commands hooks for `mind-map.ts`'s callback.
- `state/use-page-keys.ts`: ⌘/Ctrl+Enter and ⌘/Ctrl+Shift+Enter (canvas or node editor focused) call
  `command()`; Select All leaves hidden nodes out.
- `state/use-board-document.ts`: `commit` lays out, on the document it commits, every map the commit
  changes (from saved boxes, through `mind-map.ts`, no measuring), except the map of a node whose
  text session is open; ending a session, including inside `commit`, lays out that map in the same
  commit; the add of a node and its first text session form one local step.
- `state/use-editor-placement.ts` and `scene/inline-editor.tsx`: the node editor's box, font, padding,
  placeholder and select-all rule of interaction v40 (distinct from the section name field).
- `scene/board-drawing.tsx`: draws `mind-map-layer.tsx` and dispatches mind nodes to
  `mind-node-body.tsx`.
- `ui/context-bar.tsx` (receives `board`; the node bar and its Collapse/Expand), `ui/content-field.tsx`
  (Enter and Escape end a node's editing), `ui/objects-panel.tsx` (label, hidden-node filter, node
  fields, unavailable Arrange with reasons).
- `group.ts`, `arrange.ts`, `sections.ts` (also the `mind map node` label prefix in its labels),
  `history.ts`, `clipboard.ts` (the consistent snapshot, hidden nodes from saved boxes), `gesture.ts`,
`icons.tsx` (the Mind map, Collapse and Expand icons), `storage.ts`,
  `board-file.ts`, `team/templates-rules.ts`: the refusals, remaps, drag shape, icon and version
  references the brief lists.
- `vitest.node.config.ts` and `vitest.workerd.config.ts`: their include lists gain
  `tests/server/mind-maps.test.ts` only; `tests/README.md` names the new files.

Packages: `board-rules` (`document.ts` version 11, structure rule, `BoardV11`/`ItemV11`;
`objects/registry.ts`), `board-sync` (`codec.ts` version 11; `undo.ts` remaps `parent`, within a step
too, and merges an add with its first text session;
`comments.ts` names a node), `board-room` (`edits.ts`; `history.ts` accepts 10 and 11; `room.ts`
version 11 and the load upgrade, with `edit-session.ts` only if the upgrade needs it; `repair.ts` the mind-node repair on every edit), server (`routes/boards.ts`, `templates.ts` version
11). The type names `BoardV10` and `ItemV10` become `BoardV11` and `ItemV11` everywhere; a file whose
only change is that rename (and a `schemaVersion` literal type 10 → 11) is a permitted rename-only
file. No package, dependency, font, service or import exception.
