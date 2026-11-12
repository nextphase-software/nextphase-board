# 0001 — Interaction and browser contract

Contract version: 38 (for 0007-W4 brief v1, 2026-11-11). Status: Draft.
Replaces [interaction v37](0001-interaction-v37.md). All inherited editing,
selection, Home/Trash/history/Comments, timer, voting and spotlight values stay
word for word. This version adds the reaction control, wheel, armed pointer and
burst. [Presence v4](0004-presence-v4.md) owns ids, wire, budget and relay.
This file is the single source of reaction presentation values. Hosted team
boards only; local boards and the team-features-off build show none of it and
bind no reaction key.

## Reactions button

- A native `button` with the existing `.icon-button` rules (40 × 40, hover
  `#f1eff5`, pressed `#7051cf` with a white icon, disabled opacity .45, focus
  outline 3px `#7051cf` offset 3px) in the bottom palette, placed **immediately
  before the Comment tool**. For owners and editors it follows Templates; for
  viewers, whose palette hides placement tools, it follows Pan. Viewers have it.
- Icon, 20 × 20, `viewBox="0 0 20 20"`, `fill="none"`, `stroke="currentColor"`:
  circle cx 10 cy 10 r 7.2 stroke-width 1.6; eyes: filled circles r 1 at
  (7.4, 8.4) and (12.6, 8.4); smile: path `M6.8 11.6c.7 1.4 1.9 2.1 3.2 2.1s2.5-.7 3.2-2.1`,
  stroke-width 1.6, round caps; the eyes have `stroke="none"`. `aria-hidden="true"`.
- Tooltip, in the existing `.tooltip`: `Reactions · E`.
- Accessible name `Reactions`; `aria-haspopup="menu"`, `aria-expanded` while the
  wheel is open. While a reaction is armed: `aria-pressed="true"` and accessible
  name `Reactions, <Name> armed` (for example `Reactions, Heart armed`); otherwise
  `aria-pressed="false"`.
- Disabled, with the reason as both tooltip text and `aria-describedby` text.
  When several apply, the first in this order wins:
  1. the board is locked (history restore in progress): `Reactions are off while the board is being restored`;
  2. the hosted session is not joined (connecting, reconnecting or offline): `Reactions are off until the board reconnects`;
  3. history preview is open: `Reactions are off while viewing history`;
  4. a voting round is running: `Reactions are off while voting`.
  The button stays visible in every state (it is never hidden on a hosted team
  board). Disabling disarms and closes the wheel.
- Activating the button opens the wheel; activating it while the wheel is open
  closes it; activating it while armed (wheel closed) disarms.

## Wheel

- One element with role `menu`, accessible name `Reactions`; a 224 × 224 disc,
  `border-radius: 50%`, background `#fff`, border 1px `#e9e7ed`, shadow
  `0 6px 20px #29202e1f`, stacked above the palette and every floating bar.
- Eight slots, each a native button with role `menuitemradio`,
  `aria-checked="true"` for the armed reaction only, accessible name the
  reaction's name from presence v4. Each slot is a 48 × 48 circle without border,
  transparent at rest, `#f1eff5` on hover, `#ece7fb` when armed, and the standard
  focus outline (3px `#7051cf`, offset 3px) on keyboard focus. Like the app's
  shared buttons, a slot has no separate look while the pointer or key is held. Its artwork is
  30 × 30, centred. The disc's children are laid out inside its 1px border, so
  their common centre is (disc.left + 113, disc.top + 113), where disc.left and
  disc.top are the disc's outer (border-box) corner. Slot centres lie on a circle
  of radius 80px around that point: slot n (1–8) at angle −90° + (n − 1) × 45°, so
  slot 1 is at the top and the order runs clockwise.
- On hover or keyboard focus a slot shows a label `<Name> · <n>` in the existing
  tooltip look (12px, line-height 1.35, the page's inherited font, background
  `#302d36`, white, 4px radius, padding 4px 8px),
  centred horizontally on the slot, its top 30px above the slot's top.
- Centre: a 64 × 64 round native button centred on (disc.left + 113, disc.top + 113), background `#faf9fc`,
  border 1px `#e9e7ed`, an 18 × 18 × made of path `m5 5 10 10M15 5 5 15`
  (viewBox 0 0 20 20, `fill="none"`, stroke `#302d36`, stroke-width 1.8, round
  caps), accessible name
  `Close reactions`. It shows `#f1eff5` on hover and the standard focus outline on
  keyboard focus; no pressed state.
- Placement from the button: disc.left = button centre x − 112; the disc's
  bottom edge (disc.top + 224) is 12px above the palette's top edge. Placement
  from E: disc.left = pointer x − 112 and disc.top = pointer y − 112, from the
  pointer's last position over the canvas; with no
  pointer position over the canvas, use the button placement. In both cases the
  disc is then clamped to stay at least 12px inside every viewport edge.
  Positions depend on the palette's measured rectangle and are asserted with a
  0.5 CSS px tolerance.
- When the palette scrolls horizontally at narrow widths, opening from the
  button scrolls the Reactions button into view first, then places the wheel.

## Keys and focus

- `E` (no Ctrl, Meta or Alt; Shift ignored) opens the wheel when focus is on the
  canvas or the page body and the target is not an input, textarea, select,
  contenteditable element, dialog or alertdialog, no composition is active and
  the control is enabled. In those excluded places E types or does nothing as
  today. `E` while the wheel is open closes it.
- Opening moves focus to the armed slot, or slot 1 when nothing is armed.
  ArrowRight and ArrowDown move focus clockwise, ArrowLeft and ArrowUp
  anticlockwise, wrapping. Home goes to slot 1, End to slot 8. Digits 1–8 arm that
  slot directly. Enter or Space on a slot arms it. Arming closes the wheel and
  returns focus to the canvas. Tab and Shift+Tab move between the eight slots and
  the centre and do not leave the wheel; Escape, the centre, a click or tap
  outside the wheel, or choosing any other tool closes it without change and
  returns focus to the element that opened it (canvas or button).
- Arming sets the board tool to `Reactions` through the palette, as the Comment
  tool sets `Comment`; the Select tool and every other tool then show unpressed
  (only Reactions is pressed).
- While armed: a primary-button click, or Shift with a primary click, on the
  canvas sends one reaction at that board point; clicks on objects do not select
  them. Each press sends once; holding does not repeat. Enter with focus on the
  canvas sends one reaction at the board point under the centre of the visible
  canvas. Pan by Space-drag, trackpad and wheel works as with other tools.
  Escape, choosing Select or any other tool, or activating the button disarms.
- No focus move on receiving a reaction. Never steal focus from an editor.
- Following a spotlight is not left by reacting: pressing the Reactions button or
  a wheel slot or centre, E, a canvas click or Shift-click while armed, and Enter
  while armed are not the local actions that leave following in interaction v37,
  and the presenter keeps presenting. Escape is taken by reactions first: with the
  wheel open it closes the wheel, and with a reaction armed it disarms; in both
  cases it does not reach the spotlight's Escape handling. Every other v37 leave
  route is unchanged.

## Armed pointer

Over the canvas the system arrow pointer stays and the armed artwork is drawn
24 × 24 with its top-left corner 12px right of and 12px below the pointer's
hotspot, with `filter: drop-shadow(0 1px 2px #29202e33)`. It is pointer-transparent
and hidden while the pointer is outside the canvas. A CSS cursor image that looks
identical is allowed.

## Burst

- Origin: the sender's board point, converted to each viewer's screen with that
  viewer's own pan and zoom, giving screen point (x, y).
- Seven copies, listed as (size px, sideways end offset px, start delay ms):
  (32, −2, 0), (26, 14, 40), (22, −16, 80), (18, 6, 110), (16, −10, 140),
  (14, 20, 170), (12, −22, 200). Every client uses this same table.
- Each copy, from its start: duration 1,400ms; p = (t − delay) / 1,400; e = 1 − (1 − p)²;
  its centre is at (x + offset × 1.1 × e, y − 8 − 160 × e), so its box is
  left = centre x − size/2, top = centre y − size/2, width = height = size;
  opacity is min(1, (1 − p) × 1.6); it is not drawn before its delay and is
  removed at p = 1. The whole burst is gone 1,600ms after it starts.
- Reduced motion (`prefers-reduced-motion: reduce`): one 32px copy centred at
  (x, y − 8), no movement, opacity 1 − p over 1,400ms.
- Copies carry `filter: drop-shadow(0 1px 2px #29202e33)`. Bursts are drawn
  inside the existing `.presence-layer` (z-index 5), so they stack exactly as
  remote cursors do today; no new z-index and no change to the layer or to other
  surfaces. They are `aria-hidden="true"` and pointer-transparent.
- At most 20 bursts are live per client; starting a 21st removes the oldest.
- A burst whose origin is outside the viewer's visible canvas is not drawn and
  has no edge marker. No sound. No announcement, for the sender or anyone else.

## Reaction artwork

All artwork is 24 × 24, `viewBox="0 0 24 24"`. Every shape and text listed below
carries a white outline drawn under its fill:
`paint-order="stroke" stroke="#fff" stroke-width="2.2" stroke-linejoin="round"`.
Text uses the page's inherited font.

| Id | Shapes |
| --- | --- |
| `thumbs-up` | path `M8.2 10.4 11.6 3.6c.3-.6 1-.9 1.6-.6 1.1.5 1.6 1.7 1.3 2.9l-.7 2.9h4.6c1.2 0 2.1 1.1 1.9 2.3l-1.2 7.1c-.2 1.1-1.1 1.8-2.2 1.8H8.2Z` fill `#f5b829`; rect x 3.2 y 10 width 4 height 10.4 rx 1.2 fill `#e0a312` |
| `plus-one` | text `+1`, x 12, y 17.4, centred, 15px, weight 800, fill `#7051cf` |
| `star` | path `m12 2.8 2.8 5.7 6.3.9-4.6 4.4 1.1 6.2L12 17.1 6.4 20l1.1-6.2-4.6-4.4 6.3-.9Z` fill `#f5b829` |
| `question` | text `?`, x 12, y 19, centred, 19px, weight 800, fill `#e8533c` |
| `thumbs-down` | the `thumbs-up` shapes rotated 180° about (12, 12), path fill `#5b8def`, rect fill `#3f73d6` |
| `dot` | circle cx 12 cy 12 r 8 fill `#e8533c`; highlight circle cx 9.4 cy 9.2 r 2.2 fill `#fff` opacity .35 (no outline) |
| `me` | circle cx 12 cy 12 r 9 filled with the sender's presence colour; their first label character, upper case, as text x 12, y 16.2, centred, 11.5px, weight 700, fill `#fff` (no outline). In the wheel the viewer's own initial and colour are shown |
| `heart` | path `M12 20.4s-7.8-4.6-7.8-10.2c0-2.6 2-4.6 4.4-4.6 1.5 0 2.7.7 3.4 1.9.7-1.2 1.9-1.9 3.4-1.9 2.4 0 4.4 2 4.4 4.6 0 5.6-7.8 10.2-7.8 10.2Z` fill `#f0707c` |

## Words

`Reactions`, `Reactions · E`, `Reactions, <Name> armed`, `Close reactions`,
`Reactions are off while voting`, `Reactions are off while viewing history`,
`Reactions are off while the board is being restored`,
`Reactions are off until the board reconnects`, the eight names and `<Name> · <n>`. No other
new visible or spoken words.
