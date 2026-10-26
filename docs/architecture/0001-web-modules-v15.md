# 0001 — Web app modules

Note version: 15 (for 0002-W1 brief v1, 2026-10-26). Status: Draft. When accepted it
replaces [web modules v14](0001-web-modules-v14.md) for later work. Its rules are v12's,
unchanged. "Why", "Where the code is now" and "Planned steps" are updated for the first new
object type, `section`: its type record `objects/section.ts`, its canvas body
`scene/section-body.tsx`, and a rules module for membership, `sections.ts`. The palette and
the canvas input now take their tools from the registry instead of naming them. It changes
no behaviour, saved format or contract of its own:
[document v5](0001-document-v5.md), [interaction v17](0001-interaction-v17.md),
[storage v1](0001-storage-v1.md) and [toolchain v1](0001-toolchain-v1.md) govern what the
app does.

## Why

v14's "Why" applies. 0002-W1 adds sections, the first object type since the registry
(0001-W16) and the first rule that ties objects to one another. Following rule 7, everything
that differs by type goes into the type records, so the save code, the palette, the canvas
input and the screen parts ask the registry; following rule 3, the membership rules go into
one rules module with unit tests; following rule 4, `App.tsx` does not grow.

## The target structure

v14's table and dependency direction apply unchanged. Layer 3's records now also hold, for
each type: the first document version it is valid in, which body draws it, whether it is a
container (holds members), whether its text takes formatting and text size, its text limit,
the text a new object starts with, its size range, and whether its tool draws by dragging.

## Where the code is now

v14's table applies, with these rows changed or added:

| Module | Layer | Owns |
| --- | --- | --- |
| `document.ts`, `storage.ts` | Rules | As in v14; from 0002-W1 `document.ts` also holds document v5 (the `section` key, the version rule, per-type limits read from the registry, the section rules, the upgrade from versions 1 to 4, the adapter's section value) |
| `sections.ts` (from 0002-W1) | Rules | Sections: the two order bands and order commands within them; the moved set (a selection plus its sections' members); the section at a point and where dropped ideas belong; moving with members; explicit assignment; placing an object (joining by centre, a new section taking in the ideas it covers); the drawing rectangle and its limits; wrapping a selection and the reasons it is refused; Objects' option labels; remapping membership for copies. Erasable TypeScript, no React or Konva, unit tests in `tests/sections.test.mjs` |
| `history.ts`, `clipboard.ts`, `group.ts`, `arrange.ts`, `resize.ts`, `context-bar-position.ts` | Rules | As in v14; from 0002-W1 Delete clears members' links, Cut, Copy and Duplicate use the moved set and remap membership, Paste inserts by band and finds its copies by their fresh IDs, Group refuses sections, the Arrange groups gain Section, resizing takes a per-type size range, and the context bar leaves room above a section's name |
| `objects/` | Object types | `sticky.ts`, `text.ts`, `section.ts` (from 0002-W1) and `registry.ts`: v14's contents plus the properties listed under "The target structure"; lookups by type and by tool, the placement tool for a tool name, the container type, and whether an object is a container |
| `scene/` | Screen parts | v14's modules plus `section-body.tsx` (from 0002-W1): a section's area, edge and name, its selected and drop-target look, and the "Joins" hint. `board-drawing.tsx` draws the bands and chooses each object's body through the registry; `overlays.tsx` draws the section drawing preview; `inline-editor.tsx` also places the compact name field |
| `ui/` | Screen parts | v14's fourteen modules, unchanged in number. From 0002-W1 the palette lists its object tools from the registry; the notice words a drawing tool's hint from it; the Content field takes its label and limit from the type; the context bar and Objects hide the text controls for sections; Objects adds the Section select and labels options through `sections.ts` |
| `state/` | State | v14's nineteen hooks, unchanged in number and ownership. From 0002-W1: `use-canvas-input.ts` draws sections, places through `sections.ts`, hit-tests by band and applies drop membership; `use-geometry-edits.ts` creates and moves through `sections.ts` and resizes with the type's range; `use-editing-commands.ts` adds wrapping and the Section select's assignment, order within bands, and the copied set for Cut, Copy and Duplicate; `use-selection.ts` says whether the selection takes text styles; `use-object-layouts.ts` uses a section's saved height; `use-editor-placement.ts` selects a new section's name; `use-command-reasons.ts` and `use-validity.ts` ask the registry for tools and text limits |
| `icons.tsx` | Screen part | Icon glyphs; from 0002-W1 also the Section tool's frame |
| `App.tsx` | Composition | As in v14; from 0002-W1 it passes the new values and actions on its existing lines and stays at 262 lines |

## Rules for every brief

v12's eight rules apply unchanged. Rule 7 is applied to the new type: no module outside
`objects/` compares a type name with `"section"`, or keeps a table keyed by type, and code
that treats sections differently asks the registry (the container predicate, the text and
size limits, the body, whether text takes formatting, whether the tool draws).

The unit tests that guard the modules change only as follows:
- the scene parts are exactly five modules, adding `section-body.tsx`;
- the object types are exactly four modules, adding `section.ts`;
- the type-name guards for composition, screen parts and rules modules also forbid comparing
  with `"section"`;
- the screen parts stay fourteen, the state hooks nineteen, and the `App.tsx` budget 262.

## Planned steps

v14's steps are done. The first new object type, sections, follows these rules (0002-W1).
Later types add a record, and a body under `scene/` when they draw differently. This note is
updated as each step lands.
