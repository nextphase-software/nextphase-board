# 0001 — Interaction and browser contract

Contract version: 29 (for 0004-W2 brief v1, 2026-11-03). Status: Draft. When accepted it
replaces [interaction v28](0001-interaction-v28.md) for later work. Uses the same contracts as
v28, with [0003 hosted storage v4](0003-hosted-storage-v4.md) in place of hosted storage v3.

Every rule in v28 (and, through it, v27, v26, v25 and back to v4 and the 0001-W3 presentation)
still applies except where this version replaces or adds to it. This version adds what a hosted
board shows while **changes wait** after its connection drops: the save status with a count, the
Reconnecting banner with a count, the **not-saved notices**, the **leave question**, the count in
the dialogs that end a board, and the **recovered toast**. Hosted storage v4 defines when each
appears and its exact words; this contract says where each appears, how it looks and how it is
used.

**With team features off nothing in this contract applies**: the page's markup, focus order,
keys, drawing and saved records are v28's (and so v27's) exactly.

Sizes are CSS pixels, with the app's `box-sizing: border-box`. A control whose hover, focus or
disabled look this contract does not state takes the app's shared rules:
- an **ordinary button** is white with a 1-pixel `#e8e7ed` border, corner radius 8, padding 8 12,
  at least 40 × 40, hover background `#f1eff5`;
- a **primary button** (`primary`) has background `#7051cf` and white text, hover `#6142be`;
- both have a 3-pixel `#7051cf` focus ring at offset 3 on `:focus-visible`, and opacity 0.45 when
  unavailable.

No new control has a pressed look of its own. Fonts are the app's `system-ui` stack. Colours are written as the stylesheet writes
them. A screen that has this contract's structure and words but not its values does not meet it.

## The save status

The save panel's status keeps its place, icon and look (v25, "The save panel"). It reads hosted
storage v4's save state. **Offline — N changes waiting** is drawn in amber, as **Offline — view
only** is: the existing `team-amber` colours, text `#936000` on `#fff5da`. **Not confirmed** has
the look **Not saved** has (no amber). While the connection is down, the people group shows no avatars, as at the base.

## Banners and notices

The board area's top centre holds, in this order from the top, any **not-saved notices** and then
the current hosted **banner** (v25: View only, Reconnecting… or Restoring). They form one column:

- The column's top is 76 from the top of the board area; below 1,100 window width, 128. While a
  person is being followed (v27's following banner is shown), the column's top is 132 between 768
  and 1,099.98 window width and 188 below 768. At 1,100 and wider the following banner keeps its
  v27 place and the column stays at 76.
- The boxes are centred, 8 apart vertically, each as wide as its content and at most the board
  area's width minus 24. The column takes no pointer events outside its boxes. It is drawn above
  the canvas and the floating panels' level as v25's banner is (`z-index` 4), under team dialogs.
- With no notice, the banner alone is where v25 puts it. Its box and position are the same.

**The Reconnecting banner with changes waiting** is v25's amber banner (`team-banner team-amber`:
text `#936000`, background `#fff5da`, a 1-pixel `#e1dce8` border, corner radius 10, padding 10
14) with hosted storage v4's words. After an ending (hosted storage v4, "Endings with waiting
changes") no Reconnecting banner shows.

**A not-saved notice** is a box with `role="status"`: text `#a32940`, background `#fdf0f2`, a
1-pixel `#f2cdd5` border, corner radius 10, padding 10 14. It holds the notice's words and then,
12 to their right, a **Dismiss** button with the app's ordinary button look in the notice's text
colour, at least 28 high, padding 2 10. Its content is a row, centred vertically. Below 768
window width the words and the button wrap onto two lines when they do not fit. Several notices
show in hosted storage v4's table order: restored, access changed, then not kept.

- A notice that appears does not take focus. Tab reaches each notice's Dismiss in the column's
  order, before the canvas.
- **Dismiss** removes that notice and moves focus to the canvas.

## The toast

The recovered toast is v25's toast with hosted storage v4's words, unchanged in look:
- `team-toast`, `role="status"`, centred at the bottom, 86 above the window's bottom (148 below
  768 window width);
- background `#f3f0f8`, a 1-pixel `#e1dce8` border, corner radius 10, padding 10 14;
- as wide as its words and at most the window's width minus 24, `z-index` 4;
- gone after 5 seconds or when another toast replaces it.

## The board while changes wait

While the connection is down, and while the waiting changes are being sent again after a rejoin,
the board is view only exactly as v25 says: the bottom toolbar shows only Select and Pan, and
every editing command, key and context-bar control is unavailable. The objects of the waiting
changes stay on the board where the person put them.

After a rejoin the selection is empty: no context bar, handles or "<n> objects" bar remains for
an object the room's board lacks. Undo and Redo are unavailable (their existing disabled look)
until the person makes a new step, because a rejoin clears the steps (sync v5).

## The leave question

The leave question is the local board's unsaved-edits question's dialog (v20, "The unsaved-edits
question"; `board-question`): a native `<dialog>` opened with `showModal()`, with
`role="alertdialog"`, its title as the accessible name (`aria-labelledby`) and its body as the
description (`aria-describedby`). Width the smaller of 520 and the window's width minus 24;
padding 24; a 1-pixel `#e9e7ed` border; corner radius 12; text `#29272e`; backdrop `#29272e66`;
title 20 in size; buttons in a row at the right with gap 8, which wraps on narrow windows as the
question's row already does.

- The buttons are **Leave anyway** (the app's ordinary button) and then **Stay on this board**
  (the app's purple `primary` button), in that order.
- On opening, focus goes to **Stay on this board**, which shows the 3-pixel `#7051cf` ring at
  offset 3 **whenever it has focus** (`:focus`, not only `:focus-visible`).
- Escape does what Stay on this board does. Tab and Shift+Tab stay inside the dialog. No key
  pressed inside it reaches the board's own key handling.
- On closing by Stay, focus returns to the control that opened the question, if it is still on
  the page and can take focus; otherwise to the canvas. **Back to files** closes the Board panel
  before it asks, so after Stay focus goes to the canvas.
- The browser's own prompt on closing or reloading the tab (hosted storage v4) has the browser's
  look and words. It is not drawn by the app.

## Dialogs that end a board

v25's dialogs keep their place, size, title, buttons and keys, unchanged in look:
- `team-dialog team-ending`: white, text `#29272e`, a 1-pixel `#e9e7ed` border, corner radius 12,
  padding 24;
- width the smaller of 420 and the window's width minus 24; backdrop `#29272e66`;
- title 20 in size with 12 above and below; body line height 1.5;
- the × close button floated to the right, first in the dialog.

When hosted storage v4 gives a count, the body is hosted storage v4's words with the count. The
account-disabled page (v25, "Other pages") gets its count sentence the same way, with no other
change. The close button (×, "Close this
board"), which takes focus when the dialog opens, shows the 3-pixel `#7051cf` ring at offset 3
whenever it has focus.

## Not in this version

Editing while disconnected, a list of which changes were lost, a Review or version-history
action, keeping undo across a reconnect, a recovery state that survives a reload, and dark mode.

## Verification boundary

The 0004-W2 brief's browser checks run in Chrome against the local Supabase stack and the Node
server, at 1280 × 800 and at the narrow sizes they name, with page key events. The browser's own
leave prompt is checked only for being raised, not for its look. A physical keyboard, screen
readers, input methods, mobile browsers, Safari and other browsers are checked only as the
maintainer asks.
