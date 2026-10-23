BRIEF VERSION: 0001-W13 v3 (2026-10-23)
# 0001-W13 — Navigate the canvas with trackpad and mouse wheel

Status: Draft. Implementation starts only after the maintainer commits this brief
and [0001 interaction v7](../architecture/0001-interaction-v7.md) to main.

## Outcome

Two-finger trackpad scroll and the mouse wheel pan the canvas. Pinch and
Ctrl/Cmd+wheel zoom it around the pointer instead of zooming the browser page, with
smooth zoom inside the existing 50–200% range. Holding Space and dragging pans from
any tool. Navigation never changes selection or saved content, and moves focus
only when an open note editor would become clipped or too small to read, in which
case editing moves to Objects as it does today. The saved document format and
saving behavior do not change.

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
   factor, the gesture-scale ratio, and the next and previous 0.25 button steps.
   No React, DOM or storage code in it; erasable TypeScript only, so the Node test
   runner can load it the way the existing tests load `document.ts`.
2. `apps/web/src/App.tsx`: a non-passive `wheel` listener on the scene for pan and
   zoom, with v7's targeting rules (panels native, plain wheel over the on-canvas
   editor native); cancellation of Ctrl/Cmd wheel events and of WebKit gesture
   events over the scene, with gesture events zooming by their scale ratio; Space +
   drag with return to the previous tool; the zoom buttons stepping to the next
   0.25 mark; the rounded percentage; no view change during placement, object or
   pan drags (v7 "Blocked moments").
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

- 0001-W13-AC01: Pan the canvas with two-finger trackpad scroll and the mouse wheel without changing selection or saved content, moving focus only through the existing clipped-editor fallback.
- 0001-W13-AC02: Zoom with trackpad pinch and Ctrl/Cmd+wheel around the pointer within the supported range, without zooming the browser page over the canvas.
- 0001-W13-AC03: Keep native scrolling over panels and text editors, and block navigation during placement and drag gestures as the existing view controls do.

| Criterion | Evidence that shows it |
| --- | --- |
| 0001-W13-AC01 | Two-finger scroll and the mouse wheel pan in both directions (Shift+wheel horizontally); Space + drag pans from Select and from an armed Sticky tool, which stays armed afterwards; selection, Save status and revision are unchanged; focus is unchanged when no note editor is open |
| 0001-W13-AC02 | Pinch and Ctrl/Cmd+wheel zoom smoothly between 50% and 200% while the board point under the pointer stays put (except where the view stops at the board's edge); each pinch zooms once; the browser page does not zoom over the canvas; − / + step to the next 25% mark; keyboard page zoom still zooms the page |
| 0001-W13-AC03 | The Objects panel and other panels scroll natively; a plain wheel over the open on-canvas editor is left to the editor; zooming below 2/3 with an editor open moves editing to Objects with the draft kept, as v4 specifies; wheel and pinch make no view change during a placement gesture, object drag or pan drag, and Space does not start a pan during any of them, while the page still neither scrolls nor zooms |

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
limits, where the factor is clamped), and shifts it only by the clamped amount at
the board's edge; the Ctrl/Cmd zoom factor limit of ±25 per event; the gesture-scale
ratio (1 → 1.2 → 1.44 zooms by 1.2 twice; a non-positive or non-finite scale is
ignored; the previous scale resets to 1 at each `gesturestart`); centre
clamping at ±1,000,000; and button steps from 1.0, 1.1, 0.5, 2.0 and 1.0004.

One browser pass in Chrome and Safari with a trackpad, recorded by whoever can run
those browsers: two-finger pan; pinch around the pointer with no page zoom and one
zoom per pinch; plain and Shift mouse wheel; native scrolling in Objects; Space +
drag, including returning to an armed tool and releasing Space mid-drag; no wheel
or pinch view change during an object or pan drag; unchanged selection and Save
status; focus unchanged with no editor open, and the fallback to Objects when
zooming below 2/3 with an editor open. No browser matrix, fixtures sweep,
accessibility audit, touch-screen or IME checks unless the maintainer asks.

## Exclusions and reasons

A wider zoom range, zoom to fit or to selection, a minimap, touch-screen gestures,
saving the view per board, inertia tuning beyond what the platform supplies, and
section or page navigation are later or out of scope.

## Public references with retrieval dates

Interaction v7 lists the references it relies on (MDN wheel event, MDN
GestureEvent, WebKit bug 145214 and WebKit's wheel-from-gesture layout test), all
retrieved 2026-10-23. Interaction v4's
references (retrieved 2026-10-22) still apply.

## Version history

- v3 (2026-10-23): interaction v7 now always cancels WebKit gesture events over
  the canvas and zooms from their scale ratio. WebKit's own test shows this
  suppresses its synthesized Ctrl wheel events, so v2's first-source and
  page-session rules are removed, and Ctrl/Cmd wheel always zooms. v7 also states
  which v4 navigation rules stay, the pan formula, the selection context bar among
  the native-scrolling controls, no wheel or pinch zoom during a pan drag, Space
  released mid-drag, Escape and clicks while Space is held, and a 0.001 tolerance
  for the zoom buttons. Evidence and unit
  cases follow. No scope change.
- v2 (2026-10-23): interaction v7 is revised to say that v4's clipped-editor
  fallback can still move focus to Objects during navigation, that the point under
  the pointer can shift where the view stops at the board's edge, and exactly how
  WebKit gesture events zoom (first source wins, scale ratio, page-session rule).
  The outcome, AC01 wording, deliverables, evidence and unit cases follow. No scope
  change.

## Implementation record

Not started.
