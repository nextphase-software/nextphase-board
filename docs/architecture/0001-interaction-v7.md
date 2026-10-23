# 0001 — Interaction and browser contract

Contract version: 7 (for 0001-W13 brief v1, 2026-10-23). Status: Draft. When
accepted it replaces [interaction v6](0001-interaction-v6.md) for later work. Uses
unchanged [document v1](0001-document-v1.md) and [storage v1](0001-storage-v1.md).

Every rule in v6 (and, through it, v5, v4 and the 0001-W3 presentation) still
applies except where this version replaces it. This version changes navigation
only: v4's "Navigation, save and read-only states" pan and zoom rules are replaced
by the rules below; its save and read-only rules are unchanged.

## View

The view is centre *x*, centre *y* and zoom *z*, starting at 0, 0, 1 as in v4,
with v4's mapping between scene-local pointer *u, v* (scene size *W × H*) and board
point: `x = cx + (u − W/2) / z`, `y = cy + (v − H/2) / z`.

Zoom may take **any value from 0.5 to 2.0** (v4 allowed only 0.25 steps). The
centre stays clamped to −1,000,000…1,000,000 on both axes. The percentage control
shows `round(z × 100)`%. The view is never saved, never advances the save revision,
never creates a history step, and never changes selection or keyboard focus.

**Zoom around a point.** Zooming by factor *f* at scene point *u, v* sets
`z' = clamp(z × f, 0.5, 2.0)`, then moves the centre so the board point that was
under *u, v* stays under it:
`cx' = cx + (u − W/2) / z − (u − W/2) / z'` (and the same for *y* with *v, H*),
then clamps the centre.

## Wheel and trackpad

These rules apply to `wheel` events whose target is the canvas scene or an object
drawn on it, including the on-canvas editor where stated. They never apply over
the file, actions, palette, view controls, Objects, board details, navigation or
any other panel. Those keep native scrolling.

**Pan.** A wheel event without Ctrl or Cmd pans: the centre moves by the event's
horizontal and vertical deltas divided by *z*, in the same direction as native page
scrolling (positive delta moves the view right or down). Deltas are converted to
CSS pixels first: pixel mode as is, line mode × 16, page mode × the scene's width
(horizontal) or height (vertical). With Shift held and only a vertical delta, that
delta pans horizontally. Two-finger trackpad scroll, including the platform's
momentum, arrives this way. Over the on-canvas native editor, a plain wheel event
is left to the browser so the editor can scroll; elsewhere on the scene it pans.

**Zoom.** A wheel event with Ctrl or Cmd held zooms around the pointer (*u, v* from
the event) by factor `exp(−d / 100)`, where *d* is the converted vertical delta
limited to −25…25 per event. Browsers report a trackpad pinch as such an event
with Ctrl set; this applies over the whole scene, including the on-canvas editor.

**Browser page zoom.** The scene's wheel listener is registered as non-passive and
cancels every Ctrl/Cmd wheel event over the scene, so pinch and Ctrl/Cmd+wheel
never zoom the browser page there. Plain wheel events that pan are cancelled too,
so the page never scrolls behind the scene. Where the browser also dispatches the
WebKit `gesturestart`, `gesturechange` and `gestureend` events over the scene,
their default is cancelled. Their `scale` is used to zoom around the last known
pointer position only if no Ctrl wheel event arrived during that gesture, so each
pinch zooms exactly once. Keyboard page zoom (Cmd/Ctrl with + or −) is still never
captured, as v4 requires.

## Space + drag

While the canvas scene holds focus, no native text field or composition is
active, and no placement or object drag is in progress, pressing Space (ignoring
key repeats) starts a temporary pan. The scene shows a grab cursor (grabbing while
dragging), and Space's default page scroll is cancelled. A primary-pointer drag
anywhere on the scene then pans exactly as the Pan tool does, with pointer capture,
and never moves or selects objects. Releasing Space returns to the previously
active tool, including an armed Sticky or Text placement. Escape, pointercancel,
lost capture or window blur during the drag restores the view from the start of
that drag, as Pan cancellation does in v4. Space typed in any text field behaves
natively.

## Buttons and keyboard

Zoom in goes to the next multiple of 0.25 above the current zoom and Zoom out to
the next multiple below, within 0.5…2.0, around the view centre (from 1.1, in →
1.25 and out → 1.0). Directional pan actions, Reset view (0, 0, 1) and every
keyboard route are as in v4.

## Blocked moments

As with v4's view controls, no view change happens during a placement gesture or
an object drag. Wheel, gesture and Space events that arrive then make no change,
but Ctrl/Cmd wheel and gesture events are still cancelled so the page does not zoom.

## Verification boundary

Desktop Chrome and Safari as installed, with a trackpad. The pure view rules (pan
by delta at several zooms, delta-mode conversion, zoom around a point keeping it
fixed, clamping of centre and zoom, button steps from a non-0.25 zoom) need unit
tests. One browser pass per browser covers two-finger pan, pinch around the
pointer with no page zoom, plain and Shift mouse wheel, native scrolling in
Objects, Space + drag including return to an armed tool, and unchanged selection,
focus and save status. v6's remaining rows still describe available coverage, not
automatic gates.

## Public references (retrieved 2026-10-23)

- MDN, Element: wheel event — <https://developer.mozilla.org/en-US/docs/Web/API/Element/wheel_event>
  (wheel is cancelable; zooming with the wheel or trackpad fires `wheel` with
  `ctrlKey` true; `passive: false` to cancel).
- MDN, GestureEvent — <https://developer.mozilla.org/en-US/docs/Web/API/GestureEvent>
  (non-standard WebKit interface; `scale` relative to the gesture start).
- WebKit bug 145214 — <https://bugs.webkit.org/show_bug.cgi?id=145214> (pinch
  mapped to Ctrl wheel events in WebKit, as in Chrome).
