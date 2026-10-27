# 0001 — Web app modules

Note version: 16 (for 0002-W4 brief v1, 2026-10-26). Status: Draft. When accepted it
replaces [web modules v15](0001-web-modules-v15.md) for later work. Its rules are v12's,
unchanged. "Why", "Where the code is now" and "Planned steps" are updated for the second new
object type, `shape`: its type record `objects/shape.ts`, its canvas body
`scene/shape-body.tsx`, and two new screen parts, the Shapes panel and the shape controls.
The registry now also owns each type's extra saved keys. It changes no behaviour, saved
format or contract of its own: [document v6](0001-document-v6.md),
[interaction v18](0001-interaction-v18.md), [storage v1](0001-storage-v1.md) and
[toolchain v1](0001-toolchain-v1.md) govern what the app does.

## Why

v15's "Why" applies. 0002-W4 adds shapes, the first type with saved keys of its own (kind,
fill and border) and the first with two kinds behind one tool. Following rule 7, everything
that differs by type stays in the type records: the save code, the clipboard and the adapter
ask the registry which extra keys a type has, and the palette, canvas input and screen parts
ask it about tools, kinds, text boxes and paint. Following rule 4, `App.tsx` does not grow.

## The target structure

v15's table and dependency direction apply unchanged. Layer 3's records now also hold, for
each type: its extra saved keys (none except for shapes), whether it uses shape paint, its
text box, its text colour, whether its text grows it, its drawing preview radius and its
inline editor minimum. The shape record also lists its kinds with their tools and keys, the
shape colours, the fill modes and border styles, and the rules for the darkened border, the
text colour, whether text fits and Grow to fit text.

## Where the code is now

v15's table applies, with these rows changed or added:

| Module | Layer | Owns |
| --- | --- | --- |
| `document.ts` | Rules | As in v15; from 0002-W4 document v6: per-type key sets from the registry, shape validation, v6 canonical order, the upgrade from versions 1 to 5, new boards v6, and the adapter's shape values |
| `clipboard.ts`, `history.ts`, `group.ts`, `sections.ts`, `context-bar-position.ts`, `gesture.ts` | Rules | As in v15; from 0002-W4 the snapshot keeps each object's extra keys through the registry, Objects' labels take a shape's kind as their prefix from the registry, and the rest follow the current document type |
| `objects/` | Object types | `sticky.ts`, `text.ts`, `section.ts`, `shape.ts` (from 0002-W4) and `registry.ts`: v15's contents plus the properties under "The target structure"; lookups for a type's extra keys and key set by version, the tool for a kind and a key, the kind for a tool, labels for Objects, and a type's text box and font size |
| `scene/` | Screen parts | v15's five modules plus `shape-body.tsx` (from 0002-W4): a shape's fill, border, text with its ellipsis, and selected look. `board-drawing.tsx` chooses it through the registry; `overlays.tsx` rounds the drawing preview by the type's radius; `inline-editor.tsx` centres a shape's editor and its placeholder |
| `ui/` | Screen parts | Sixteen modules: v15's fourteen plus `shapes-panel.tsx` (the Shapes panel) and `shape-controls.tsx` (the Shape menu, Fill and Border buttons and panels, the Objects shape fields and the Grow to fit text button). The palette adds the Shapes tool from the registry; the context bar and Objects place the shape controls and keep Colour for other ideas; Objects adds Add square and Add circle |
| `state/` | State | v15's nineteen hooks, unchanged in number and ownership. From 0002-W4: `use-canvas-input.ts` draws and places shapes and handles R and O; `use-editing-commands.ts` changes kind, fill and border and grows a shape to fit; `use-board-document.ts` keeps the session paint; `use-selection.ts` splits a selection into shapes and other ideas; `use-object-layouts.ts` lays out shape text without growth and says whether it fits; `use-editor-placement.ts` uses a shape's text box and minimum; the others follow the current document type |
| `icons.tsx` | Screen part | Icon glyphs; from 0002-W4 also the Shapes tool, Square, Circle and Border glyphs |
| `App.tsx` | Composition | As in v15; from 0002-W4 it places the two new parts and passes their values on its existing lines and stays at 262 lines |

## Rules for every brief

v12's eight rules apply unchanged. Rule 7 is applied to the new type: no module outside
`objects/` compares a type name with `"shape"`, a kind name with `"square"` or `"circle"`,
or keeps a table keyed by type or kind; code that treats shapes differently asks the registry
(whether a type uses shape paint, its extra keys, its kinds and their tools and keys, its text
box, text colour and growth).

The unit tests that guard the modules change only as follows:
- the scene parts are exactly six modules, adding `shape-body.tsx`;
- the object types are exactly five modules, adding `shape.ts`;
- the screen parts are exactly sixteen, adding `shapes-panel.tsx` and `shape-controls.tsx`;
- the type-name guards for composition, screen parts and rules modules also forbid comparing
  with `"shape"`, `"square"` and `"circle"`;
- the state hooks stay nineteen and the `App.tsx` budget 262.

## Planned steps

v15's steps are done. Shapes follow these rules (0002-W4). Connectors (0002-W2) are the next
type, with ends instead of a rectangle; they add a record, a body and the rules module
their scope names. This note is updated as each step lands.
