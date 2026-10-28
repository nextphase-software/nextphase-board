# 0001 — Web app modules

Note version: 20 (for 0009-W1 brief v1, 2026-10-27). Status: Draft. When accepted it
replaces [web modules v19](0001-web-modules-v19.md) for later work. Its rules are v12's, with
rule 7's guard widened to the stroke type and its kinds. "Where the code is now" and "Planned
steps" are updated for drawing: one object-type module `objects/stroke.ts`, one rules module
`strokes.ts`, one scene part `scene/stroke-body.tsx` and two screen parts
`ui/drawing-tools.tsx` and `ui/stroke-controls.tsx`. It changes no behaviour, saved format or
contract of its own: [document v8](0001-document-v8.md), [interaction v22](0001-interaction-v22.md),
[storage v2](0001-storage-v2.md), [the board file contract](0006-board-file-v1.md),
[the activity catalogue contract](0008-activity-catalogue-v1.md) and
[toolchain v1](0001-toolchain-v1.md) govern what the app does.

## Why

v19's "Why" applies. A stroke is the first object whose shape is a list of points and the first
idea with no text, so the registry, not each caller, says whether an object has points, text or
can be a connector end. The point rules (smoothing, thinning, padding, hit tests, erasing,
scaling) are pure geometry with unit tests, so they sit in one rules module rather than in the
canvas input hook. The drawing bar and the stroke controls are new screen parts, kept out of
`App.tsx` and the existing palette and context bar.

## Where the code is now

v19's table applies, with these rows changed or added:

| Module | Layer | Owns |
| --- | --- | --- |
| `objects/stroke.ts` | Object types | New in 0009-W1: the stroke type's record (saved keys, validation of kind, colour, weight and points under document v8), its kinds, ink colours and their values, ink widths, the drawing tools' names and the default session style, and its label prefixes ("marker stroke", "highlight") and context label ("Marker", "Highlight") |
| `objects/registry.ts` | Object types | As in v19, plus the stroke type, a test for "has points", and the split of v19's eligible idea into **section idea** (an idea with a rectangle that is not a container: may join sections and groups) and **eligible idea** (a section idea without points: may be a connector end) |
| `strokes.ts` | Rules | New in 0009-W1: drawing points from pointer positions (the click rule, smoothing, thinning, straight lines), rounding and the rectangle with its pad, making a stroke, weight changes, painted-ink and 8-pixel hit tests, the eraser's swept test, box containment, and scaling on resize with the stroke floor |
| `document.ts` | Rules | As in v19, plus document v8: the stroke's keys and checks, version 1 to 7 reading and upgrade, canonical form, and the adapter's atomic points value |
| `board-file.ts`, `storage.ts`, `activities.ts` | Rules | As in v19, with document v8's version references (newer is above 8; activity files stay version 7). `activities.ts` reads a version 7 activity onto a version 8 board, and the board's box it places against includes strokes |
| `resize.ts` | Rules | As in v19, plus choosing the nearest corner when handle hit areas overlap |
| `scene/` | Scene parts | Nine modules: v19's eight plus `stroke-body.tsx` (one stroke's line, blending and selected outline) |
| `ui/` | Screen parts | Twenty-three modules: v19's twenty-one plus `drawing-tools.tsx` (the Draw button and the drawing bar) and `stroke-controls.tsx` (the stroke context bar controls and Objects' Colour and Weight fields). `palette.tsx` places the Draw button and the bar; `context-bar.tsx` and `objects-panel.tsx` place the stroke controls |
| `state/` | State | v19's nineteen hooks, unchanged in number. From 0009-W1 `use-gesture-state.ts` also holds the last drawing tool and the session style, and clears the selection when a drawing tool is armed; `use-canvas-input.ts` runs the drawing and erasing gestures and the drawing keys; `use-geometry-edits.ts` resizes strokes; `use-editing-commands.ts` changes stroke colour and weight |
| `App.tsx` | Composition | As in v19; from 0009-W1 it passes the drawing values to `Palette` and the stroke values to the context bar and Objects, and stays within its budget of 262 lines |

## Rules for every brief

v12's eight rules apply, with one change to rule 7's guard: the type names it forbids comparing
outside `objects/` now include `stroke`, and the kind names `marker` and `highlighter` join
`square` and `circle`. A module outside `objects/` asks the registry whether an object has
points, which ink colours and width a stroke has, and what its label is.

`strokes.ts` is a rules module: erasable TypeScript with no React, Konva or DOM imports.
`objects/stroke.ts` follows the other type records.

The unit tests that guard the modules change only as follows: object types are exactly seven,
adding `stroke.ts`; scene parts exactly nine, adding `stroke-body.tsx`; screen parts exactly
twenty-three, adding `drawing-tools.tsx` and `stroke-controls.tsx`; the type-name guard adds
`stroke`, `marker` and `highlighter` with examples of each. The state hooks stay nineteen and the
`App.tsx` budget 262.

## Planned steps

v19's steps are done; templates landed as 0008-W1. Drawing follows these rules (0009-W1). Partial
erasing, highlights that follow the object under them, and other pens are later work; each extends
`strokes.ts` and `objects/stroke.ts`. This note is updated as each step lands.
