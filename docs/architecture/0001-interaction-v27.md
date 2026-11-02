# 0001 — Interaction and browser contract

Contract version: 27 (for 0004-W3 brief v2, 2026-11-02). Status: Draft. When accepted it
replaces [interaction v26](0001-interaction-v26.md) for later work. Uses the same contracts as v26.

Every rule in v26 (and, through it, v25 back to v4 and the 0001-W3 presentation) still applies,
except one: the following banner's words are "Following <label>" with no "·" after the label (see
**Following**). This version adds **the look** of presence on screen: the colours, sizes, shapes, spacing and
positions of the approved presence design, which v26 described only by structure and words. A
screen that follows v26's structure but not these values does not meet this contract. Fonts are
the app's own `system-ui` stack unless a value below says otherwise. Sizes are CSS pixels, and the
app's `box-sizing: border-box` applies to every box.

## Stacking

The cursor, pill and outline layer, the follow frame and the following banner sit at `z-index: 5`
in the board area, above the canvas and the floating panels' own layers; the people menu sits at
`z-index: 6`. The layer and the frame never take the pointer.

## The people group

- The group is a row inside the save panel, `align-items: center`, height 32 CSS pixels, padding 0
  6 pixels on the right and 2 on the left, with no gap between its items.
- **Avatars:** 28 × 28 CSS pixels including a 2-pixel white (`#ffffff`) border, a full circle, filled
  with the person's colour; the initial in white, 13-pixel type at weight 600, centred. Every avatar
  after the first overlaps the one before by 6 pixels (`margin-left: -6px`), so they read as one
  stack. The followed person's avatar has a 2-pixel outline in the followed connection's colour (which
  can differ from the avatar's fill when the person has two tabs), 1 pixel outside the white border.
- **+N:** height 28, at least 28 wide, padding 0 6 pixels, a full pill (`border-radius: 999px`),
  background `#ece9f2`, text `#3b3a40` at 12 pixels, weight 600, centred both ways, with the same 2-pixel white
  border and the same 6-pixel overlap.
- **Chevron:** an SVG 16 × 16 pixels with `viewBox="0 0 20 20"`, `fill="none"` and the path
  `m6 8 4 4 4-4`, stroked `#3b3a40` at 1.75 view-box units with round caps and joins; 4 pixels after
  the last avatar or +N, with no box, border or background of its own.
- **The divider** after the group is the save panel's existing `.divider` element (1 × 20 pixels,
  `#e8e7ed`), `aria-hidden`, before the status.

## The people menu

- 316 CSS pixels wide (at most the window's width minus 24), background `#2b2a30`, white text at
  14 pixels, corner radius 12, padding 8, shadow `0 8px 24px rgba(0, 0, 0, 0.2)`. Its top is 14
  pixels below the people group and its right edge 8 pixels right of the group's right edge (at
  the window's right edge minus 12 below 768 pixels).
- **Rows:** `display: flex`, `align-items: center`, gap 10, padding 7 × 8 pixels, corner radius 8; the hovered or focused
  row has background `#45434d`. The colour dot is 26 × 26, a full circle in the person's colour, its
  initial in white at 12 pixels, weight 600, centred both ways. The label block takes the row's
  remaining width (`flex: 1`); the label is in white; the role words below it in
  `#b9b6c3` at 12 pixels. **Follow** is `#d6d1ff` at 13 pixels.
- **Divider:** 1 pixel, `#45434d`, with 6 pixels above and below and 4 pixels in from each side.
- **The switch row:** as a row; the check mark sits centred in a 26-pixel column; the item's name takes the
  remaining width; the shortcut at the row's
  end in `#b9b6c3` at 12 pixels.

## Cursors and outlines

- **Cursor arrow:** an SVG 18 × 20 pixels with `viewBox="0 0 18 20"`, `display: block`, and the
  path `M1.5 1.5 L1.5 16 L5.6 12.4 L8.4 18.4 L11 17.2 L8.3 11.3 L14 11.1 Z`, filled with the
  connection's colour, with a 1.5-unit white stroke and round joins. The SVG's top-left corner is at
  the pointer's position on screen.
- **Name pill:** 14 pixels right of and 16 pixels below the arrow's top-left corner; background the
  connection's colour, white text at 12 pixels, weight 600, line height 1, padding 4 × 7 pixels, a
  full pill (`border-radius: 999px`), no wrapping, shadow `0 1px 2px rgba(0, 0, 0, 0.18)`.
- **Outline:** a 2-pixel solid border in the connection's colour with corner radius 2, in a box
  whose outer rectangle has its left and top 2 pixels left of and above the selection box's screen
  rectangle and the same width and height as that rectangle (with `border-box`, its right and
  bottom edges are therefore 2 pixels inside the box's right and bottom edges).

## Following

- **Frame:** a 3-pixel solid border in the followed connection's colour along all four edges of the
  board area, inside it.
- **Words:** "Following <label>" (no "·"), then the **Stop following** button. This replaces v26's
  "Following <label> ·".
- **Banner:** `display: flex`, `align-items: center`, background the followed connection's colour, white text at 13 pixels, weight 600,
  padding 5 pixels top and bottom, 6 on the right and 12 on the left, corner radius 8, gap 8 between
  the words and the button. **Stop following** is a button inside it: background
  `rgba(0, 0, 0, 0.28)`, white text in the banner's font, no border, corner radius 6, padding 4 × 10
  pixels.

## Verification boundary

As v26. The 0004-W3 brief v2's check W3-S36 compares these values with the page's computed
styles, and the review puts each candidate screen beside the approved design.
