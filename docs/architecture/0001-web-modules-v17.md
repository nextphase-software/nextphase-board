# 0001 — Web app modules

Note version: 17 (for 0002-W2 brief v1, 2026-10-27). Status: Draft. When accepted it
replaces [web modules v16](0001-web-modules-v16.md) for later work. Its rules are v12's,
unchanged. "Why", "Where the code is now" and "Planned steps" are updated for the third new
object type, `connector`, the first with ends instead of a rectangle: its type record
`objects/connector.ts`, two rules modules `connectors.ts` and `connection-drag.ts`, two canvas
parts `scene/connector-body.tsx` and `scene/connection-dots.tsx`, and one screen part
`ui/connector-controls.tsx`. It changes no behaviour, saved format or contract of its own:
[document v7](0001-document-v7.md), [interaction v19](0001-interaction-v19.md),
[storage v1](0001-storage-v1.md) and [toolchain v1](0001-toolchain-v1.md) govern what the
app does.

## Why

v16's "Why" applies. Until now every object had a rectangle, and much of the code (moving,
resizing, box selection, sections, groups, the context bar, the editor) reads `x`, `y`,
`width` and `height` directly. A connector has none: its saved record holds two ends, and its
route, label box and drawn bounds are worked out from its ends' rectangles when it is drawn.
Following rule 7, code that must treat connectors differently asks the registry whether a
type has ends; following rule 4, `App.tsx` does not grow.

## The target structure

v16's table and dependency direction apply unchanged. Layer 3's records now also say whether
a type **has ends** instead of a rectangle (only the connector), and the registry answers,
from that and from `container`: whether an object has a rectangle, whether it is an
**eligible idea** (no ends and not a container), its **order band** (sections 0, connectors
1, ideas 2), and the type with ends. A type with ends has no placement tool, no kinds, no
drawing preview and no Add option.

The saved item type of document v7 is a true union: rectangle types and the connector type.
A **resolved item** adds, for display only, a connector's drawn bounds and label box; it is
never committed to the document, history or the adapter.

## Where the code is now

v16's table applies, with these rows changed or added:

| Module | Layer | Owns |
| --- | --- | --- |
| `document.ts` | Rules | As in v16; from 0002-W2 document v7: the union of rectangle and connector items, connector validation (ends, eligibility, distinct ends, fixed shared values, no geometry), v7 canonical order, the upgrade from versions 1 to 6, new boards v7, the resolved item type, and the adapter's atomic `ends` value |
| `connectors.ts` | Rules | New in 0002-W2: side midpoints, the route and its tie order, leads, rounded path and its hit samples, the label point and label box, the arrow, drawn bounds, line, label and box hit tests, the delete cascade and its count, the copied set and end remapping, the three bands, Connect's reason and creating a connector |
| `connection-drag.ts` | Rules | New in 0002-W2: where each selected eligible idea's dots are, which dot a point presses, the drag's state and its target |
| `clipboard.ts`, `history.ts`, `group.ts`, `sections.ts`, `arrange.ts`, `context-bar-position.ts`, `gesture.ts` | Rules | As in v16; from 0002-W2 the snapshot keeps ends and remaps them; history records connectors whole; groups and sections never take a connector; Objects' labels add connectors with their ends' names; the Arrange menu gains the Connector group; the context bar adds the dot clearance and uses drawn bounds; the rest follow the current document type |
| `objects/` | Object types | `sticky.ts`, `text.ts`, `section.ts`, `shape.ts`, `connector.ts` (from 0002-W2) and `registry.ts`: v16's contents plus the properties under "The target structure"; the connector record's fixed style, 100-code-point plain label, label font size, line colour and end validation; registry lookups for ends, rectangles, eligibility, bands, the type with ends, and key sets without geometry for a type with ends |
| `scene/` | Screen parts | v16's six modules plus `connector-body.tsx` (a connector's line, arrow, label cutaway, label and selected end markers, drawn in two passes) and `connection-dots.tsx` (the dots, the drag preview and the target outline), from 0002-W2. `board-drawing.tsx` draws the three bands and the connector band's two passes; `inline-editor.tsx` places a connector's label editor; `note-body.tsx` follows the current document type |
| `ui/` | Screen parts | Seventeen modules: v16's sixteen plus `connector-controls.tsx` (the connector context bar: its label, Add text and Delete). The context bar places it for connector-only selections; Objects adds Connect, connector labels and the connector Name field |
| `state/` | State | v16's nineteen hooks, unchanged in number and ownership. From 0002-W2: `use-canvas-input.ts` presses dots, runs the connection drag and hit-tests lines, labels and boxes; `use-editing-commands.ts` creates connectors, cascades delete and cut, and keeps connectors out of moves, resizes, arranging and style; `use-object-layouts.ts` resolves connectors' routes and measures their labels; `use-editor-placement.ts` places the label editor; `use-selection.ts` splits a selection into ideas and connectors; `use-geometry-edits.ts` moves and resizes ideas only; `use-context-bar.ts` passes the dot clearance; the others follow the current document type |
| `App.tsx` | Composition | As in v16; from 0002-W2 it places `ConnectionDots` and passes its values on its existing lines and stays at 262 lines |

## Rules for every brief

v12's eight rules apply unchanged. Rule 7 is applied to the new type: no module outside
`objects/` compares a type name with `"connector"`, or keeps a table keyed by type; code that
treats connectors differently asks the registry (whether a type has ends or a rectangle,
whether an object is an eligible idea, its band). Rules modules stay erasable TypeScript with
no React or browser canvas imports.

The unit tests that guard the modules change only as follows:
- the scene parts are exactly eight modules, adding `connector-body.tsx` and
  `connection-dots.tsx`;
- the object types are exactly six modules, adding `connector.ts`;
- the screen parts are exactly seventeen, adding `connector-controls.tsx`;
- the type-name guards for composition, screen parts and rules modules also forbid comparing
  with `"connector"`;
- the state hooks stay nineteen and the `App.tsx` budget 262.

## Planned steps

v16's steps are done; shapes landed as 0002-W4. Connectors follow these rules (0002-W2).
Connector variants (arrows at either end, line styles, line shapes, colour, fixed sides and
reconnecting an end) are 0002-W3; they extend the connector record and `connectors.ts`. This
note is updated as each step lands.
