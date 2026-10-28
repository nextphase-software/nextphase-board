# 0001 — Web app modules

Note version: 21 (for 0002-W3 brief v1, 2026-10-28). Status: Draft. When accepted it
replaces [web modules v20](0001-web-modules-v20.md) for later work. Its rules are v12's, with
rule 7's guard as v20 left it. "Where the code is now" and "Planned steps" are updated for
connector styles and reconnecting: two rules modules `connector-path.ts` and `connector-heads.ts`
and three screen parts `ui/connector-menu.tsx`, `ui/connector-fields.tsx` and
`ui/connector-icons.tsx`. It changes no behaviour, saved format or contract of its own:
[document v9](0001-document-v9.md), [interaction v23](0001-interaction-v23.md),
[storage v2](0001-storage-v2.md), [the board file contract](0006-board-file-v1.md),
[the activity catalogue contract](0008-activity-catalogue-v1.md) and
[toolchain v1](0001-toolchain-v1.md) govern what the app does.

## Why

v20's "Why" applies. A connector's look is now data: its style says how it is drawn, which side an
end takes and which path it follows. The path and head geometry are pure rules with unit tests, so
they sit in rules modules beside `connectors.ts` rather than in the scene or the canvas input hook.
The connector bar's popups and Objects' Ends fields are new screen parts, kept out of `App.tsx`,
`context-bar.tsx` and `objects-panel.tsx`, which only place them.

## Where the code is now

v20's table applies, with these rows changed or added:

| Module | Layer | Owns |
| --- | --- | --- |
| `objects/connector.ts` | Object types | As in v20, plus document v9: the style keys, their values and labels (heads, line shapes), the default style, the end sides, the line width and dash for a style, and the saved keys for each version |
| `objects/registry.ts` | Object types | As in v20, plus each eligible idea's **outline point** toward a given point (rectangle, rounded square, ellipse), from the type records' own shape data |
| `connectors.ts` | Rules | As in v20, plus the side pairs with pinned ends, the connector layout for each line shape (end points, insets, label point, drawn bounds), hit tests with heads and width, style changes and reconnecting |
| `connector-path.ts` | Rules | New in 0002-W3: the Curved cubic, the Straight segment between outline points, and shortening a path by the insets (an exact cubic for Curved) |
| `connector-heads.ts` | Rules | New in 0002-W3: each head's points, circle, fill, inset and extent for an end point, direction and weight |
| `connection-drag.ts` | Rules | As in v20, plus the pressed end circle, the reconnect target and the drop side |
| `document.ts` | Rules | As in v20, plus document v9: the connector's style keys and side anchors, version 1 to 8 reading and upgrade, canonical form, and the adapter's atomic style value |
| `board-file.ts`, `storage.ts`, `activities.ts` | Rules | As in v20, with document v9's version references (newer is above 9; activity files stay version 7) |
| `scene/` | Scene parts | Nine modules, unchanged in number: `connector-body.tsx` draws the style (width, dash, heads); `connection-dots.tsx` the reconnect outlines, target dots and drop side; `board-drawing.tsx` the connector being reconnected |
| `ui/` | Screen parts | Twenty-six modules: v20's twenty-three plus `connector-menu.tsx` (the connector bar's Colour, Line style, Start point, Line shape and End point buttons and popups), `connector-fields.tsx` (Objects' Ends) and `connector-icons.tsx` (head, line shape and line style icons). `connector-controls.tsx` lays out the connector bar; `context-bar.tsx` and `objects-panel.tsx` place them |
| `state/` | State | v20's nineteen hooks, unchanged in number. From 0002-W3 `use-board-document.ts` also holds the remembered style and resets it when a board is opened; `use-canvas-input.ts` runs the end drag; `use-editing-commands.ts` changes connector style and reconnects ends |
| `App.tsx` | Composition | As in v20; from 0002-W3 it passes the connector commands and the end drag to the context bar, Objects and the scene, and stays within its budget of 262 lines |

## Rules for every brief

v12's eight rules apply, with v20's guard unchanged: no module outside `objects/` compares a type
name; a module asks the registry whether an object has ends and what its outline point is.

`connector-path.ts` and `connector-heads.ts` are rules modules: erasable TypeScript with no React,
Konva or DOM imports and no type-name comparison.

The unit tests that guard the modules change only as follows: screen parts exactly twenty-six,
adding `connector-menu.tsx`, `connector-fields.tsx` and `connector-icons.tsx`. Object types stay
seven, scene parts nine, state hooks nineteen and the `App.tsx` budget 262.

## Planned steps

v20's steps are done; drawing landed as 0009-W1. Connector styles and reconnecting follow these
rules (0002-W3). A saved bend and expanded diagram layout are later work (0009-W3); each extends
`connector-path.ts` and `objects/connector.ts`. This note is updated as each step lands.
