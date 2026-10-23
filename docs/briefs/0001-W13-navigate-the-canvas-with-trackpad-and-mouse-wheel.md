BRIEF VERSION: 0001-W13 v1 (2026-10-23)
# 0001-W13 — Navigate the canvas with trackpad and mouse wheel

Status: Draft. Implementation starts only after the maintainer commits this brief
and [0001 interaction v7](../architecture/0001-interaction-v7.md) to main.

## Outcome

Two-finger trackpad scroll and the mouse wheel pan the canvas. Pinch and
Ctrl/Cmd+wheel zoom it around the pointer instead of zooming the browser page, with
smooth zoom inside the existing 50–200% range. Holding Space and dragging pans from
any tool. Navigation never changes selection, focus or saved content, and the
saved document format and saving behavior do not change.

## Read first and prerequisite contracts

- [Contributor guidance](../../CONTRIBUTING.md), [agent instructions](../../AGENTS.md)
  and [engineering standards](../../DESIGN.md).
- [0001 interaction v7](../architecture/0001-interaction-v7.md): the governing
  behavior for this brief (view, zoom around a point, wheel and trackpad, browser
  page zoom, Space + drag, buttons, blocked moments).
- [0001 document v1](../architecture/0001-document-v1.md) and
  [0001 storage v1](../architecture/0001-storage-v1.md): unchanged; the view is
  never saved.
- [0001 toolchain v1](../architecture/0001-toolchain-v1.md): unchanged; no new dependency.

## Deliverables and boundaries

1. A new pure module `apps/web/src/view.ts` with the view rules from interaction
   v7: clamping, pan by a screen delta, wheel delta conversion (pixel, line and
   page modes), zoom by a factor around a scene point, the Ctrl/Cmd wheel zoom
   factor, and the next and previous 0.25 button steps. No React, DOM or storage
   code in it; erasable TypeScript only, so the Node test runner can load it the way
   the existing tests load `document.ts`.
2. `apps/web/src/App.tsx`: a non-passive `wheel` listener on the scene for pan and
   zoom, with v7's targeting rules (panels native, plain wheel over the on-canvas
   editor native); cancellation of Ctrl/Cmd wheel and WebKit gesture events over
   the scene, with gesture `scale` used only when no Ctrl wheel event arrived in
   that gesture; Space + drag with return to the previous tool; the zoom buttons
   stepping to the next 0.25 mark; the rounded percentage; no view change during
   placement or object drags.
3. `apps/web/style.css` only if needed for the grab and grabbing cursors.
4. A new `tests/view.test.mjs` with the unit cases listed under validation.

New source files use `SPDX-License-Identifier: Apache-2.0`. Do not change
`document.ts`, `storage.ts`, `history.ts`, `geometry.ts`, the saved format,
persistence, explicit-save policy, placement or movement rules, other tools,
package files or the lock. If a requirement seems to need any of those, stop and
report it.

Append the implementation record below with the branch, validated revision,
commands, results and exclusions; report the final branch tip separately.

## Numbered acceptance criteria

- 0001-W13-AC01: Pan the canvas with two-finger trackpad scroll and the mouse wheel without changing selection, focus or saved content.
- 0001-W13-AC02: Zoom with trackpad pinch and Ctrl/Cmd+wheel around the pointer within the supported range, without zooming the browser page over the canvas.
- 0001-W13-AC03: Keep native scrolling over panels and text editors, and block navigation during placement and drag gestures as the existing view controls do.

| Criterion | Evidence that shows it |
| --- | --- |
| 0001-W13-AC01 | Two-finger scroll and the mouse wheel pan in both directions (Shift+wheel horizontally); Space + drag pans from Select and from an armed Sticky tool, which stays armed afterwards; selection, focus, Save status and revision are unchanged |
| 0001-W13-AC02 | Pinch and Ctrl/Cmd+wheel zoom smoothly between 50% and 200% while the board point under the pointer stays put; the browser page does not zoom over the canvas; − / + step to the next 25% mark; keyboard page zoom still zooms the page |
| 0001-W13-AC03 | The Objects panel and other panels scroll natively; a plain wheel over the open on-canvas editor is left to the editor; wheel, pinch and Space make no view change during a placement gesture or object drag, while the page still does not zoom |

## Validation commands and expected evidence

From the repository root with the pinned toolchain:

```sh
npm --prefix apps/web ci --ignore-scripts --no-audit --no-fund
npm --prefix apps/web run typecheck
node --test tests/view.test.mjs
npm --prefix apps/web run build
git diff --name-only main...HEAD
```

Run only the new unit test file: this change adds the view module and leaves the
code covered by the other test files untouched. Running anything broader needs an
explicit maintainer instruction (see [agent instructions](../../AGENTS.md)).

`tests/view.test.mjs` asserts: pan by a screen delta at zoom 0.5, 1 and 2; line and
page delta conversion; Shift turning a vertical delta horizontal; zoom around a
point keeps that board point under the same scene point (including at the zoom
limits, where the factor is clamped); the Ctrl/Cmd zoom factor limit of ±25 per
event; centre clamping at ±1,000,000; and button steps from 1.0, 1.1, 0.5 and 2.0.

One browser pass in Chrome and Safari with a trackpad, recorded by whoever can run
those browsers: two-finger pan; pinch around the pointer with no page zoom; plain
and Shift mouse wheel; native scrolling in Objects; Space + drag, including
returning to an armed tool; unchanged selection, focus and Save status; no view
change during an object drag. No browser matrix, fixtures sweep, accessibility
audit, touch-screen or IME checks unless the maintainer asks.

## Exclusions and reasons

A wider zoom range, zoom to fit or to selection, a minimap, touch-screen gestures,
saving the view per board, inertia tuning beyond what the platform supplies, and
section or page navigation are later or out of scope.

## Public references with retrieval dates

Interaction v7 lists the references it relies on (MDN wheel event, MDN
GestureEvent, WebKit bug 145214), all retrieved 2026-10-23. Interaction v4's
references (retrieved 2026-10-22) still apply.

## Implementation record

Not started.
