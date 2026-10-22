# 0001 — Interaction and browser contract

Contract version: 2. Status: Accepted for implementation on 2026-10-22.
Applies to 0001-W1 brief v3; replaces interaction v1 for that brief after acceptance.
Uses unchanged [document v1](0001-document-v1.md) and
[storage v1](0001-storage-v1.md). Implementation evidence is recorded in the governing brief.

## Screen structure and visual reference

The scene fills the workspace. Compact native DOM controls float above it;
there is no permanent editing column. This table, wireframe and dimensions are
the complete public design reference; no external design file is required.

```text
+-----------------------------------------------------------------------+
| [Board details: title | Local]            [Objects | status | Save]    |
|                         [state message, when needed]                   |
|                                                                       |
|                   [selected object's context controls]                 |
|                   +-------------------------------+                   |
|                   | object / native text editor   |                   |
|                   +-------------------------------+                   |
|                                                                       |
|                 [Select | Pan | Sticky | Text]       [- | % | + | Nav]|
+-----------------------------------------------------------------------+
```

| Surface | Placement and behavior |
| --- | --- |
| Board details | Upper left; title and Local indicator; button opens a labelled board-name input and local-storage explanation |
| Actions | Upper right; Objects toggle, text save status and Save or Retry save; reachable while panels are open |
| Palette | Bottom center; exactly Select, Pan, Sticky and Text; visible active state and accessible pressed state |
| View controls | Bottom right; Zoom out, percentage, Zoom in and Navigation toggle; navigation reveals four pan actions and Reset view |
| Selection context | Dark compact surface above the selected object, clamped inside the scene; type, Edit text or Done and text count |
| Objects | Secondary native panel; selector, textarea, four move actions and Add sticky/Add text; closed initially |
| State message | Readable region below upper controls; validation, save failure, read-only ownership and recovery explanations/actions |

At 1024×768 and 1440×900 CSS viewports, inset floating surfaces 12px from scene
edges with at least 8px gaps. Use minimum 40px action targets, a 56px palette,
12px rounded corners, white surfaces, a light border and restrained shadow.
Objects is a 288px-wide overlay at the upper right below Actions. Bound its height
above the lower tools and scroll its contents. It does not resize the scene or
change the viewport transform. Prevent overlapping controls/messages from hiding
each other's actions; expand the scrollable workspace when necessary.

Use system fonts and original CSS/text/SVG controls. Reference colors: near-white
scene #fafafa, subtle 24-board-unit dot grid #dddddf, purple active/save #7051cf,
rose sticky #f2dce5 and blue selection #518de0. Object text is 18 board-unit system
text, 1.45 line height and 20-unit inset; text objects have transparent fill.
These are renderer constants, not color/font/style tools. Selected corner marks
are decorative, hidden from accessibility APIs and cannot resize or connect.
No downloaded font/image/icon assets or new UI dependency is introduced.

Below 768 CSS pixels, stack Board details and Actions at the top, place the
palette above lower-right view controls, and use an Objects sheet with 12px side
insets and maximum width 360px. Allow vertical page/panel scrolling on narrow or
short viewports; every action and textarea remains reachable without a focus
trap or page-wide horizontal overflow at actual 200% browser page zoom. Scene
content may clip. Layer order is scene, selection/context/editor, secondary
panels, then persistent file/actions/tools/view controls and readable notices.

A new editable board has an empty title and no objects. Untitled board is only
a display placeholder, never persisted as the user's title. Explain origin/profile
local storage and that it is not a backup. No demonstration objects, review ribbon,
scenario controls, account or Share control belongs in the application.

## Selection, native editing and focus

Konva renders shapes/text and selection decoration; native HTML inputs perform
editing. Do not emulate a caret, selection or composition in canvas. Select by
logical UUID. In Select, an object click selects it and an empty-scene click
clears selection. Double-click an object to select and edit it; double-clicking
empty space does not insert an object. This replaces v1's empty-space shortcut.

Make the scene focusable with a visible label describing keyboard placement and
Objects. Enter on the focused scene with Select and an editable selected object,
or the contextual Edit text action, opens its on-object native textarea. Done
ends that view and focuses the selected scene. Ordinary blur ends it after
retaining the draft, with focus left at the destination action. Enter inside the
textarea inserts a newline. Escape, arrows, Delete and platform text/clipboard
shortcuts in native inputs keep native behavior; board commands do not consume
them. Do not capture browser page-zoom shortcuts.

Objects opens and focuses its native selector. Options follow document order;
labels include type, one-based position and short text preview. Every object is
selectable/readable, including empty-text or clipped objects. The labelled Content
textarea shows full selected text. Selection alone never mutates the document.
Label the four move buttons and show x/y coordinates. Close returns focus to
Objects; Board details and Navigation return to their triggers on close. These
surfaces are nonmodal, have explicit close/toggle actions, and do not trap Tab.
Opening one closes the others after preserving drafts/composition. Escape closes
a surface only outside native text inputs when no composition is active.

Only one writable object-text textarea is active. Overlay and panel use the same
field draft. Opening Objects ends the overlay after composition settles; Edit
text ends panel editing before focusing the overlay. Keep the focused native
element/key stable through input, validation and rerender. Explicit surface
changes may transfer focus after preserving text and caret/selection. Save and
completion do not take focus. Reopen clears selection and leaves focus at its
initiating control. Tab/Shift-Tab, or Safari's default Option-Tab convention,
reaches every action; use visible labels and a 3px focus outline. Icon actions
need visible hover/focus labels and accessible names; disabled/read-only/error
state also has a text explanation.

Position the overlay at the object's transformed text bounds with its same font,
inset and line height. Hide duplicate canvas text only while editing; keep fill
and selection visible. Layout changes reposition the existing editor without
remounting or mutating geometry. If its visible, unobscured editing rectangle is
smaller than 120×60 CSS pixels, its font would be below 12 CSS pixels, or its text
area is clipped, retain the draft and focus Content in Objects after composition
settles. Do not alter object geometry to fit the editor. On-object editing
and the native panel must be equivalent routes to the same content.

## Drafts and composition

Retain title and per-object editor drafts separately from validated document data.
Preserve Unicode exactly and count code points using document v1. Valid changed
native input commits one semantic text transaction; an unchanged value is a no-op.
A blank title or any oversized/invalid field draft remains visible with an
explanation and globally blocks Save. Empty object text is valid. Never trim or
truncate drafts. Selection/surface/title changes and ordinary
blur retain invalid drafts for later correction; identify all outstanding fields.
Never label a document saved while an editor draft is invalid or unfinished.

At compositionstart retain the pre-composition value. Buffer native input without
document mutations, Save, forced blur, value replacement or editor unmount. Defer
selection/tool/surface/reopen actions until native composition ends. Browser/OS
termination still follows storage lifecycle and never persists the unfinished
buffer. Once compositionend and final native input settle, adopt the final value
once if valid and changed. Do not infer commit/cancel from event data alone.
Cancellation returning to the previous value is a no-op; an invalid final value
remains visible and blocks Save. Duplicate final input events cannot duplicate
transactions. Verify native CJK commit/cancel and focus transitions separately
from Unicode paste. The same rules apply to title composition.

## Coordinates, tools and insertion

One board unit is one CSS pixel at application zoom 100%. View centerX, centerY
and zoom start at 0,0,1. For scene size W×H and scene-local pointer u,v:

x = centerX + (u - W/2) / zoom; y = centerY + (v - H/2) / zoom.

Sticky creates 240×160 and Text 320×120, both with empty text. Center placement
bounds on the mapped pointer point, or centerX,centerY for keyboard placement.
Clamp top-left so full bounds fit the document range; append reading order and
allocate fresh logical/generation UUIDs. At 250 objects refuse creation without
changing data/selection; explain the limit and keep editing/navigation available.

Sticky/Text arms one placement and focuses the scene with an instruction. A
primary-pointer down/up on empty space with movement below 3 CSS pixels creates
exactly one object. Movement of 3px or more, pointercancel, lost capture or window blur creates none and
returns to Select. Clicking an existing object selects it and cancels placement.
Enter on the focused scene creates at view center. Escape outside native text/
composition cancels an armed tool. After creation select the object, return to
Select and focus its on-object textarea; suppress the placement click's default
focus so it cannot steal the editor. Keep pointer capture for the placement
sequence and map against its starting viewport. View changes are disabled during it.

Objects Add sticky/Add text actions support pointer/keyboard and create at the
view center plus a 24-unit diagonal offset times (existing count modulo 10),
then clamp. Select the new object and focus Content. Palette-center placement
has no cascade. Native/tool controls never bubble into scene placement. One
pointer sequence/Enter activation cannot create twice. Tool/surface changes alone
do not advance document revision. No global letter-key insertion shortcuts exist.

## Pointer movement and cancellation

In Select, a primary-pointer object drag selects it, retains original geometry,
captures the pointer on the scene and freezes the viewport transform. Track only
preview geometry; movement below 3 CSS pixels is selection. On pointerup commit
one final clamped geometry transaction for a real drag, then release capture.
Divide delta by frozen zoom; retain size and both IDs. Native textareas and
floating controls cannot start object drags.

Escape outside native text/composition, pointercancel, lost capture before up or
window blur restores original geometry. Normal capture release after a commit
must not undo it. Cancel if expected geometry changed during the gesture. Disable
Save, tool/surface/selection changes and view changes during drag, with an
explanation. Retained capture permits a release outside scene bounds to commit
the clamped result. No intermediate gesture is persisted or added to a history UI.

Native directional moves commit 10 board units, clamped to bounds. A clamped
no-op creates no transaction. Verify pointer equivalence at the same board
distance. Textarea arrows remain caret movements.

## Navigation, save and read-only states

Pan drags empty scene with pointer capture, changing only view center; cancel
restores the starting view. Object hits in Pan do not move objects. Directional
pan actions move the center 100 board units, clamped to -1,000,000…1,000,000.
Zoom changes by 0.25 within 0.5…2.0 around view center; Reset view is 0,0,1.
Show the percentage. Navigation/panel visibility does not mutate geometry, advance
save revision or persist selection/view state.

Storage v1 governs real Unsaved/Saving/Locally saved/Save failed, explicit retry
and disclosed reopen/recovery. Native editing alone never acknowledges durability.
Invalid drafts, composition and gestures block Save. A newer edit stays Unsaved
when an older capture completes. Before explicit reload/reopen discards retained
unsaved drafts, warn and require affirmative action; cancel preserves draft/view.

Writer-denied/unavailable and valid-snapshot views disable creation, title/text
editing, moves and Save with a reason. Objects still offers native selection and
readonly text; navigation works. Do not expose Edit text/Done as writable actions.
Retry editing/recovery follows storage v1 without replacing drafts or repairing
unknown records. Becoming read-only cancels gestures/placement without a write.

## Verification boundary

Desktop web Chrome and Safari, current and previous stable at acceptance; record
exact builds/OS. Exercise 1024×768, 1440×900, 320px/375px widths, short-view
scrolling and actual 200% browser page zoom. Keyboard/native controls, visible
focus and native CJK composition are required. Firefox, desktop wrappers, tablet
and screen-reader-specific testing are excluded; make no conformance claim.

| Existing criterion | Required application journey |
| --- | --- |
| 0001-W1-AC01 | Both placement tools and native Add actions via pointer/keyboard; exactly-once creation; bounds/order/IDs; overlay/panel equivalence; Enter/newline; Unicode/CJK commit/cancel; invalid draft retention; drag commit/cancel and 10-unit moves |
| 0001-W1-AC02 | Truthful save during/after editing/composition; newer draft versus older receipt; reopen/discard warning; unchanged storage v1 FIFO/CAS/writer/abort cases |
| 0001-W1-AC03 | Complete keyboard selector/read/edit/move/save/reopen; surface focus return; stable editor under rerender; clipped-editor fallback; narrow/short/200% reachability; read-only navigation with writes disabled |

These rows elaborate existing criteria, not new milestone claims. Use source/state
assertions and browser evidence against the application. Design approval and
primitive proofs establish no runtime acceptance. Required composition/gesture/
performance evidence stays unverified until run or explicitly disposed. No new
dependency, formatting, resize, delete, duplicate, undo/redo, sharing or integration.

## Public grounding

Retrieved 2026-10-22: [native DOM editing with Konva](https://konvajs.org/docs/sandbox/Editable_Text.html),
[HTML textarea](https://html.spec.whatwg.org/multipage/form-elements.html#the-textarea-element),
[composition events](https://developer.mozilla.org/en-US/docs/Web/API/Element/compositionend_event),
[pointer capture](https://developer.mozilla.org/en-US/docs/Web/API/Element/setPointerCapture),
[Pointer Events](https://www.w3.org/TR/pointerevents3/) and
[UI Events](https://www.w3.org/TR/uievents/). Native editor/pointer primitives are
public platform/library facilities. Layout, tool policies, constants, limits and
evidence obligations above are project requirements, not vendor guarantees.
