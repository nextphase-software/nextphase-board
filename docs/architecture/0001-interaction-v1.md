# 0001 — Interaction and browser contract

Contract version: 1. Status: Accepted on 2026-10-22. Applies to 0001-W1 brief v2.
Depends on the [document](0001-document-v1.md) and
[storage](0001-storage-v1.md) contracts.

## Layout and native editing

Use an independently styled toolbar containing board name, Add sticky, Add text,
Save and status. A native HTML editing panel contains a labelled object selector,
a labelled multiline textarea, and labelled directional move controls. The scene
uses Konva shapes/text only; no canvas-rendered text input substitutes for the
native editor. Selection is keyed by logical UUID and follows reading order.

Provide a visible label for every input/action and a visible focus outline.
Keep native textarea editing, selection, paste and platform keyboard commands.
Do not intercept their arrows, Delete, Escape or text shortcuts as board commands.
Object deletion/undo shortcuts and controls are outside this milestone.

At 1024×768 and 1440×900 CSS viewports, use a 320px editing panel beside the scene,
with a wrapping toolbar. Below 768 CSS pixels, stack the panel above the scene.
Allow vertical scrolling so every control remains reachable; no page-wide
horizontal overflow at 200% browser zoom. The scene may clip its own content.
Use system fonts and text/CSS controls; no downloaded fonts or image assets.

Native DOM controls form the complete keyboard capture/edit/read/move path.
Tab/Shift-Tab, or Safari's default Option-Tab convention, reaches all actions.
Use a native select with visible options ordered by order; labels include type,
position and a short text preview. Give the selected object's textarea a stable
element key and label. Selecting changes no document data. Adding selects the new
object and focuses its textarea; save/reopen does not unexpectedly move focus.
After reopen, start with no selection and a labelled selector/reading path.

Keep composition text in an editor draft until compositionend. Do not update the
document, truncate, re-render over, or save an active composition. Then validate
the final textarea value once; cancelled composition must preserve the prior text.
Over-limit/invalid text stays visible with a message and blocks Save. Blur, title
editing and selection changes must not silently discard a draft. Native CJK
commit/cancel is a required implementation check; Unicode paste is a separate case.

## Coordinates and insertion

One board unit equals one CSS pixel at application zoom 100%. View state is
centerX, centerY and zoom; initial values are 0, 0, 1. With scene size W×H and
scene-local pointer coordinates u,v, map to board coordinates as:

x = centerX + (u - W/2) / zoom; y = centerY + (v - H/2) / zoom.

Add sticky creates a 240×160 object; Add text creates a 320×120 object. Both start
with empty text. Center button-created objects on the current view center plus
a 24-unit diagonal offset times (existing object count modulo 10). Clamp the final
top-left position so the full bounds fit the document coordinate range. Append
to reading order and allocate fresh IDs. Refuse object 251 without altering data.

Double-clicking empty scene space creates a sticky centered at that board point,
without the button cascade. Clicking an object selects it. Creating via toolbar
buttons works with pointer and keyboard. Sticky background is rose, text-object
background transparent; these styles are renderer constants, not a new style UI.

## Pointer movement and cancellation

For a primary-pointer drag on an object, select it, capture the pointer on the
scene, retain its original geometry and freeze the gesture's viewport transform.
Track a preview only; movement under 3 CSS pixels is selection without a move.
On pointerup, commit one final clamped geometry transaction for a real drag and
release capture. The committed position uses the pointer delta divided by the
frozen zoom. Keep width/height and logical/generation IDs unchanged.

Escape outside text composition, pointercancel, lost capture before pointerup or
window blur cancels the gesture and restores the original geometry. A normal
capture release after a completed commit must not undo it. If the object's
expected geometry changed during the gesture, cancel rather than overwrite it.
Save and viewport-changing actions are disabled with an explanation during a drag.
There is no persisted intermediate gesture and no application history UI.

Move left/right/up/down buttons commit a 10-unit board-coordinate step, clamped
to bounds. Verify equivalence with a pointer move of the same board distance.
Keep textarea arrows for caret movement.

## View navigation

Pan tool drags empty space with pointer capture and changes only the view center;
cancellation restores the starting view. Directional pan buttons move 100 board
units. Clamp the center to -1,000,000…1,000,000. Zoom buttons change zoom by 0.25
within 0.5…2.0, around the view center; Reset view restores 0,0,1. Show the zoom
percentage. These actions do not mutate geometry, create a save revision or
persist selection/view state. Do not capture browser page-zoom shortcuts.

## Browser and verification boundary

Desktop web Chrome and Safari, current and previous stable at acceptance, with
exact builds/OS recorded. No desktop wrapper, tablet or other browser matrix.
Keyboard, native controls, visible focus and actual 200% page zoom are required.
Screen-reader-specific testing is outside this milestone; make no screen-reader
or WCAG conformance claim.

Verify native Unicode/multiline input, CJK commit/cancel, complete keyboard
creation/selection/edit/move/save/reopen, pointer cancellation/out-of-bounds
release, view transforms, reading order and stable focus against the implementation.
A proof of platform primitives does not substitute for these application journeys.

## Public references

Retrieved 2026-10-22: [Pointer Events](https://www.w3.org/TR/pointerevents3/),
[UI/composition events](https://www.w3.org/TR/uievents/),
[React canvas bindings](https://konvajs.org/docs/react/index.html).
Layout, bounds and gesture policies above are project requirements.
