# 0001 — Interaction and browser contract

Contract version: 7 (revised for 0001-W13 brief v3, 2026-10-23: editor fallback
and board-edge rules made explicit; WebKit gesture events always cancelled and
zoomed from their scale). Status: Draft. When
accepted it replaces [interaction v6](0001-interaction-v6.md) for later work. Uses
unchanged [document v1](0001-document-v1.md) and [storage v1](0001-storage-v1.md).

Every rule in v6 (and, through it, v5, v4 and the 0001-W3 presentation) still
applies except where this version replaces it. This version changes navigation
only. In v4's "Navigation, save and read-only states", the zoom rule (0.25 steps
around the view centre) is replaced by the rules below. The Pan tool's drag and
cancellation, the directional pan actions, Reset view and the save and read-only
rules there are unchanged.

## View

The view is centre *x*, centre *y* and zoom *z*, starting at 0, 0, 1 as in v4,
with v4's mapping between scene-local pointer *u, v* (scene size *W × H*) and board
point: `x = cx + (u − W/2) / z`, `y = cy + (v − H/2) / z`.

Zoom may take **any value from 0.5 to 2.0** (v4 allowed only 0.25 steps). The
centre stays clamped to −1,000,000…1,000,000 on both axes. The percentage control
shows `round(z × 100)`%. The view is never saved, never advances the save revision,
never creates a history step and never changes selection. It moves keyboard focus
only through v4's clipped-editor fallback: if panning or zooming leaves an open
on-canvas editor clipped, outside the scene, obscured or below its minimum readable
size (font under 12 CSS pixels, so zoom below 2/3), editing moves to Objects with
the draft kept, exactly as v4 specifies. Otherwise focus stays where it is.

**Zoom around a point.** Zooming by factor *f* at scene point *u, v* sets
`z' = clamp(z × f, 0.5, 2.0)`, then moves the centre so the board point that was
under *u, v* stays under it:
`cx' = cx + (u − W/2) / z − (u − W/2) / z'` (and the same for *y* with *v, H*),
then clamps the centre. The point under *u, v* stays fixed except when that clamp
changes the centre, which can happen only near the board's ±1,000,000 edge. There
the centre stops at the edge and the point under the pointer shifts by the clamped
amount.

## Wheel and trackpad

These rules apply to `wheel` events whose target is the canvas scene or an object
drawn on it, including the on-canvas editor where stated. They never apply over
the file, actions, palette, view controls, selection context bar, Objects, board
details, navigation, notices or any other floating control or panel. Those keep
native scrolling.

**Pan.** A wheel event without Ctrl or Cmd pans: `cx' = cx + dx / z` and
`cy' = cy + dy / z`, then the centre is clamped, where *dx, dy* are the event's
converted horizontal and vertical deltas. This matches native page scrolling: a
positive vertical delta moves the content up. Deltas are converted to
CSS pixels first: pixel mode as is, line mode × 16, page mode × the scene's width
(horizontal) or height (vertical). With Shift held and only a vertical delta, that
delta pans horizontally. Two-finger trackpad scroll, including the platform's
momentum, arrives this way. Over the on-canvas native editor, a plain wheel event
is left to the browser so the editor can scroll; elsewhere on the scene it pans.

**Zoom.** A wheel event with Ctrl or Cmd held zooms around the pointer (*u, v* from
the event) by factor `exp(−d / 100)`, where *d* is the converted vertical delta
limited to −25…25 per event; its horizontal delta is ignored. Browsers report a
trackpad pinch as such an event with Ctrl set. It always applies over the whole
scene, including the on-canvas editor.

**Browser page zoom.** The scene's wheel listener is registered as non-passive and
cancels every Ctrl/Cmd wheel event over the scene, so pinch and Ctrl/Cmd+wheel
never zoom the browser page there. Plain wheel events that pan are cancelled too,
so the page never scrolls behind the scene. Keyboard page zoom (Cmd/Ctrl with + or
−) is still never captured, as v4 requires.

**WebKit gesture events.** Safari also dispatches the non-standard
`gesturestart`, `gesturechange` and `gestureend` events for a trackpad pinch, and
follows each one with a synthesized Ctrl wheel event only when that gesture event
is not cancelled (WebKit's wheel-from-gesture test). Gesture events whose target is
the scene or an object drawn on it, including the on-canvas editor, are always
cancelled. That stops both the browser page zoom and the synthesized wheel events,
so in Safari a pinch zooms only through these rules:

- At `gesturestart` the previous scale is set to 1.
- Each `gesturechange` with a finite, positive `scale` *s* zooms by factor
  *s / previous* around the last pointer position over the scene (taken from
  pointer events, or the view centre if none is known), and *s* becomes the
  previous scale. Any other `scale` value is ignored.
- `gestureend` changes nothing. If a `gestureend` never arrives, the next
  `gesturestart` resets the previous scale, so no other state carries between
  gestures.

Browsers without these events, such as Chrome, report a pinch only as Ctrl wheel
events, which the zoom rule above handles. Because Safari's synthesized wheel
events are suppressed, a pinch zooms exactly once in each browser.

## Space + drag

While the canvas scene holds focus, no native text field or composition is
active, and no placement gesture, object drag or pan drag is in progress, pressing
Space (ignoring key repeats) starts a temporary pan. The scene shows a grab cursor
(grabbing while dragging), and Space's default page scroll is cancelled. A
primary-pointer drag anywhere on the scene then pans exactly as the Pan tool does,
with pointer capture, and never moves, selects or places objects, even with a
placement armed. Releasing the pointer ends that drag and keeps the view; while
Space is still held another drag can start. Releasing Space returns to the
previously active tool, including an armed Sticky or Text placement. If Space is
released during a drag, the drag ends at the current view and the previous tool
returns. Escape, pointercancel, lost capture or window blur during the drag
restores the view from the start of that drag, as Pan cancellation does in v4;
window blur also ends the temporary pan. Escape with no drag in progress keeps its
v4 meaning for the previous tool (for example cancelling an armed placement), and
the temporary pan lasts until Space is released. Space typed in any text field
behaves natively.

## Buttons and keyboard

Zoom in goes to the next multiple of 0.25 above the current zoom and Zoom out to
the next multiple below, within 0.5…2.0, around the view centre (from 1.1, in →
1.25 and out → 1.0). A zoom within 0.001 of a multiple counts as that multiple, so
from 1.0004 Zoom out goes to 0.75 and Zoom in to 1.25. Directional pan actions,
Reset view (0, 0, 1) and every keyboard route are as in v4.

## Blocked moments

As with v4's view controls, no wheel or gesture view change happens during a
placement gesture, an object drag or a pan drag (Pan tool or Space + drag), and
Space does not start a temporary pan then. Events that arrive then make no view
change, but they are cancelled exactly as at other times, so the page neither
scrolls nor zooms. A `gesturechange` then still updates the previous scale, so a
pinch that outlasts the blocked moment does not jump when zooming resumes.

## Verification boundary

Desktop Chrome and Safari as installed, with a trackpad. The pure view rules (pan
by delta at several zooms, delta-mode conversion, zoom around a point keeping it
fixed away from the edge, the clamped shift at the edge, clamping of centre and
zoom, button steps from a non-0.25 zoom and near a multiple) need unit tests, as
does the gesture-scale ratio with its reset at each `gesturestart`. One browser
pass per browser covers two-finger pan, pinch around the pointer with no page zoom and one
zoom per pinch, plain and Shift mouse wheel, native scrolling in Objects, Space +
drag including return to an armed tool and release of Space mid-drag, no zoom
during a pan drag, unchanged selection and save status, focus
unchanged with no editor open, and the v4 fallback to Objects when zooming below
2/3 with an editor open. v6's remaining rows still describe available coverage, not
automatic gates.

## Public references (retrieved 2026-10-23)

- MDN, Element: wheel event — <https://developer.mozilla.org/en-US/docs/Web/API/Element/wheel_event>
  (wheel is cancelable; zooming with the wheel or trackpad fires `wheel` with
  `ctrlKey` true; `passive: false` to cancel).
- MDN, GestureEvent — <https://developer.mozilla.org/en-US/docs/Web/API/GestureEvent>
  (non-standard WebKit interface; `scale` relative to the gesture start).
- WebKit bug 145214 — <https://bugs.webkit.org/show_bug.cgi?id=145214> (pinch
  mapped to Ctrl wheel events in WebKit, as in Chrome).
- WebKit layout test wheel-from-gesture —
  <https://github.com/WebKit/WebKit/blob/main/LayoutTests/fast/events/gesture/wheel-from-gesture.html>
  and its expected output (uncancelled gesture events are followed by Ctrl wheel
  events; cancelled ones are not).
