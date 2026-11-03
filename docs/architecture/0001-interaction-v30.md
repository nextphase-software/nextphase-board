# 0001 — Interaction and browser contract

Contract version: 30 (for 0005-W1 brief v1, 2026-11-03). Status: Draft. When accepted it
replaces [interaction v29](0001-interaction-v29.md) for later work. Uses the same contracts as
v29, with [0003 hosted storage v5](0003-hosted-storage-v5.md) in place of hosted storage v4.

Every rule in v29 (and, through it, v28 back to v4 and the 0001-W3 presentation) still applies
except where this version replaces or adds to it. This version adds **comments** on a hosted
board: the Comment tool, the attach outline, pins, the composer, the thread card, its menus and
notes, the comments panel and its filter menu, the resolve toast, the delete questions, and their
keys, focus and names. Hosted storage v5 defines when each appears and its exact words; this
contract says where each appears, how it looks and how it is used.

**With team features off nothing in this contract applies**: the page's markup, focus order,
keys, drawing and saved records are v29's (and so v28's) exactly. A local board has no comment
control.

Sizes are CSS pixels with the app's `box-sizing: border-box`; v29's shared rules for ordinary
and primary buttons, focus rings and unavailable controls apply to every control whose look is
not stated here. Fonts are the app's `system-ui` stack; "semibold" is weight 600 and "bold" weight 700. Colours are
written as the stylesheet writes them. "The board area" is the element the canvas fills. A screen
that has this contract's structure and words but not its values does not meet it.

## The toolbar

- **The Comment tool** is a palette button like the other tools (40 × 40, corner radius 8), with
  a speech-bubble icon, the accessible name "Comment tool", `aria-pressed` true while comment mode
  is on, and the tooltip "Comment C". Pressed, it has background `#7051cf` and a white icon, and
  Select is not pressed.
- It is the **last** button of the bottom toolbar: after Templates on an editable hosted board,
  after Pan on a view-only one (hosted storage v5, "The toolbar"). v29's "The board while changes
  wait" is amended to match: while the connection is down or changes are sent again, the toolbar
  shows Select, Pan and Comment; every editing command, key and context-bar control stays
  unavailable.

## The attach outline

In comment mode, while the pointer is over an object a comment would attach to, and around the
new pin's object while the composer is open, a **2-pixel solid `#518de0`** outline with corner
radius 2 is drawn 2 pixels outside the object's saved box on screen. It takes no pointer events
and is drawn above the canvas at the pins' level. The hover outline follows the pointer and goes when it
leaves the object; the composer's object keeps its outline while the composer is open, wherever
the pointer is. Both go when comment mode ends.

## Pins

- A pin is a **32 × 32** button, background white, corner radii **16 16 16 3** (top-left,
  top-right, bottom-right, bottom-left: the bottom-left corner is pointed), shadow
  `0 2px 8px #29202e30`, no border. Its **bottom-left corner is at the pin's point** on screen
  (so its top is 32 above that point).
- Inside, centred, a **24-pixel circle** in the author's colour ([comments contract](0005-comments-v1.md),
  "Author colours") holds the first character of the author's label in upper case, **12 semibold
  white**.
- **Open** (its card is open): a 2-pixel `#7051cf` outline at offset 1.
- **New** (the composer's pin, not yet posted): the circle is `#e9e2fb` and the initial `#7051cf`.
  It is not a button and is hidden from screen readers.
- **Resolved**, when shown: opacity 0.55.
- **Detached**: background `#fff5da`, an inset 1.5-pixel `#936000` ring (with the shadow above),
  and an **18-pixel** `#936000` circle holding the white unlink icon, placed with its right edge
  6 outside the pin's right edge and its top edge 6 above the pin's top (`right: -6px;
  top: -6px`).
- Pins are drawn above the canvas and below the comments panel, the floating panels, the composer
  and the card (`z-index` 2). They do not move the view or the canvas's own focus target.

## The composer

- A row **300** wide: white, a **1.5-pixel `#7051cf`** border, corner radius **22**, padding
  **4 4 4 14**, shadow `0 2px 8px #29202e20`, gap 8, items centred vertically. It holds a text field (no border of its own,
  14 in size, line height 1.45) with the placeholder in `#79737f`, and **Post**.
- **Post** is a **32-pixel circle**, background `#7051cf` with a white arrow centred in it; off,
  background `#e8e7ed` with a `#79737f` arrow at full opacity. No border, padding 0, and its
  minimum size is its own 32 × 32 (overriding the shared button rules). Its accessible name is
  "Post".
- **Icon buttons** (the card's and panel's header buttons and a comment's More): no border,
  padding 0, the icon centred, and their minimum size is their own size (overriding the shared
  button rules); hover background `#f1eff5` as the shared rule.
- Under the row, when they apply: the length count (`#a32940`, 13 in size) and the notes ("Notes").
- `role="dialog"`, accessible name "New comment"; it does not trap focus.

## Text fields

The composer's field and the reply field are borderless text areas inside their box, which draws
the border and the focus look: transparent background, no border, no outline, ring or shadow of
their own (overriding the app's shared text-area rules), padding 2 0, 14 in size, line height
1.45, text `#29272e`, placeholder `#79737f` at full opacity (both fields), no resize handle, at least 24 high, growing with their text to at most 120
high and then scrolling. The edit field is the same with a 1-pixel `#7051cf` border, corner radius
8 and padding 6 8. A read-only field keeps this look.

## The thread card

- **320** wide, white, a 1-pixel `#e9e7ed` border, corner radius **12**, shadow
  `0 2px 8px #29202e20`; its height is limited as "Where the composer and the card go" says, and
  it scrolls inside. `role="dialog"`, accessible name "Comment thread" (`role="alertdialog"` while the
  thread-deleted note shows); it does not trap focus.
- **Header**: a row, centred vertically, gap 2, padding 6 6 6 14, a 1-pixel `#e9e7ed` bottom
  border; "Comment" **13 bold** filling the free width, then the **32 × 32** icon buttons (transparent, corner radius 8, icon `#3b3a40`): **More** (the
  thread's author only, name "More for this thread"), **Resolve** (an outlined check; name
  "Resolve") or, on a resolved thread, **Reopen** (a check in a filled `#16a34a` circle with a
  white tick; name "Reopen"), and **Close** (×, name "Close comment thread").
- **A comment row**: a grid of three columns, **24**, the free width and **32**, column gap 10,
  items centred vertically, padding 10 6 4 14. In the first row: the **24-pixel** avatar (as the
  pin's circle), the author's name **13 semibold** followed, 6 to its right, by the time **12 in
  `#79737f`**, and, on the person's own comments only, a **28 × 28** More (the header's icon-button look at that size; "…", name "More for
  comment by <label>") in the third column. The text spans the second and third columns below:
  **14 with line height 1.45**, keeping its line breaks and wrapping anywhere, margin 2 0 6.
- **Editing**: the row's text becomes a field with a 1-pixel `#7051cf` border, then **Cancel**
  (ordinary) and **Save** (primary).
- **The reply field**: a row, gap 8, items aligned to the bottom, margin 6 10 10, padding 6 6 6
  12, a 1-pixel `#e8e7ed` border, corner radius **10**, at least 44 high, holding the field and
  Post (as the composer's). While the field has focus: border `#7051cf` plus a 1-pixel `#7051cf`
  ring (`0 0 0 1px`). While it is read only (hosted storage v5, "The composer") it keeps its look
  and the text stays selectable.
- **A card whose thread was deleted** (the thread-deleted note) shows the header, the note, then,
  when an edit's text is kept, the "Unposted edit" field (the edit field's look, read only, margin
  0 10 10), then the reply field holding its kept text, and no comment rows.

## Notes

A note is a box: corner radius **8**, **13** in size, line height 1.4, padding 8 10, margin 0 10
10 (in the composer, under its row).

| Note | Colours | Place | Role |
| --- | --- | --- | --- |
| Offline, unconfirmed, not retryable | text `#936000` on `#fff5da` (not retryable: as refused) | below the reply field | `status` (not retryable: `alert`) |
| Thread deleted, thread gone | text `#a32940` on `#fdf0f2`, a 1-pixel `#f2cdd5` border; margin 10 10 10 | between the header and the reply field | `alert` |
| Refused (every other reason) | as thread deleted | above the reply field | `alert` |
| Comment deleted while editing | as thread deleted, holding the kept edit in a read-only field | in place of the edited comment's text | `alert` |
| Resolved by someone else | text `#79737f` on `#f5f4f7` | above the reply field | `status` |
| Detached | text `#936000` on `#fff5da`, line height 1.35; margin 10 10 0; a row, items centred vertically, gap 6: the unlink icon, then the words (which wrap) | between the header and the first comment | none |

In the composer every note sits under its row. **Retry** in the unconfirmed note is an
ordinary button at least 28 high with padding 2 10, 12 after the words.

## Where the composer and the card go

Both sit beside their pin, on the side with room, inside the board area:

- **Across.** With `P` the pin's left edge on screen, the box's left is `P + 44` (12 to the right
  of the 32-wide pin) when its right edge then stays inside the limit; otherwise `P − width − 12`.
  The limit is the board area's right edge minus 12, or minus 320 while the comments panel is
  shown and the window is at least 768 wide. The left is then kept between 12 and the area's width
  minus the width minus 12.
- **Down.** The card's top is level with the pin's top (the pin's point minus 32); the composer's
  is the pin's point minus 38, so its row is centred on the pin. Let **H** be the board area's
  visible height: its height clipped to the window's bottom edge. The card's top is kept between
  72 and H − 100, and its height is at most H minus its top minus 90 (it scrolls inside). The
  composer's top is kept between 72 and H − 90 − its measured height (notes included).
- Below 768 window width each is at most the area's width minus 24 wide.
- `z-index` 4 (5 below 768 window width), above the panel.

## The comments panel

- **296** wide, **72** from the top of the board area, **12** from its right, **80** from its
  bottom (the zoom bar stays visible), white, a 1-pixel `#e9e7ed` border, corner radius **12**,
  shadow `0 2px 8px #29202e0a`, `z-index` 3, below the people group and Share. An `aside` named
  "Comments".
- **Header**: a row, centred vertically, gap 2, padding 6 6 6 14, a 1-pixel `#e9e7ed` bottom
  border; "Comments" **14 bold** filling the free width;
  **Filter** (name "Filter comments", `aria-expanded`) and **Close** (name "Close comments") as
  the card's icon buttons. While the filter menu is open, Filter has background `#e9e2fb` and a
  `#7051cf` icon, also on hover and with focus (its focus ring as the shared rule).
- **The list** scrolls. An **item** is a button as wide as the list: a grid of the 24-pixel
  avatar and its text, gap 2 10, padding **12 14**, square corners, no border but a 1-pixel
  **`#f0eff3`** divider below, no minimum size (overriding the shared button rules), text
  left-aligned, 13 in size, `#29272e`, background white, hover `#f5f0ff`; its lines have no
  margins of their own. Lines: the author's name (bold) and, after a space, the
  time (12, `#79737f`); the first comment's text (line height 1.4, keeping line breaks); what it
  is on (12, `#79737f`), or the detached line (12, `#936000`; a row, items centred vertically,
  gap 4: the unlink icon, then the words, which wrap); the
  count line (**12 semibold `#7051cf`**). The open thread's item has background **`#f5f0ff`** and
  a **3-pixel `#7051cf`** bar at its left (`inset 3px 0 0`).
- **Empty**: padding 16 14, `#79737f`, 13 in size, line height 1.45; a row, items aligned to the
  top, gap 10: the speech-bubble icon, then the words.
- **Below 768 window width** the panel is a sheet: fixed, 12 from the left and right of the
  window, 80 from its bottom, height the smaller of 42 % of the dynamic viewport height and 320.

## Menus

The comment menus have the app's dark menu look: background **`#302d36`**, white text, corner
radius **12**, padding 6, shadow `0 2px 8px #29202e20`, at least 190 wide, `z-index` 6. Items are
buttons as wide as the menu: transparent, no border, no minimum size (overriding the shared button
rules), white text 13 in size, left-aligned, padding 8 10, corner radius 8, a row with gap 8; the
item under the pointer or with focus has background **`#7051cf`** and no focus ring of its own. `role="menu"` with `menuitem` items; the filter menu's items are
`menuitemcheckbox` with `aria-checked`, and a 14-wide column before each holds "✓" when it is on.

- A comment's menu opens under its More (6 from the card's right, 36 below the row's top); the
  thread's menu 6 from the card's right and 40 below its top.
- The filter menu's right edge is level with Filter's right edge and its top 4 below Filter's
  bottom. When its bottom would then pass the window's bottom minus 12 (as in the narrow sheet),
  it opens above Filter instead, its bottom 4 above Filter's top. It is kept at least 12 inside the
  window's left and right edges.

## The toast and alerts

- The resolve toast is v29's `team-toast` (place, colours, `role="status"`, 5 seconds), laid out
  as a row with items centred vertically and gap 12, holding
  "Thread resolved" and, 12 to its right, **Undo**: an ordinary button at least 28 high with
  padding 2 10.
- A refusal of an action without text shows in the same place, in the refused note's colours,
  with `role="alert"` and **Dismiss** (as Undo). It stays until Dismiss or until another toast
  replaces it.

## The delete questions

The delete questions are team dialogs with v25's look (`team-dialog`, as v29's "Dialogs that end
a board": white, a 1-pixel `#e9e7ed` border, corner radius 12, padding 24, title 20 in size,
backdrop `#29272e66`, width the smaller of 420 and the window's width minus 24). **Cancel** is
an ordinary button; **Delete thread** and **Delete comment** have background `#a32940` and white
text. Focus starts on Cancel; Escape is Cancel; afterwards focus returns to the card's field, or
to the canvas when the card closed.

## The values as CSS

The block below states, element by element, the computed values the sections above describe; it
is the approved drawing's stylesheet with the names made plain. Class names are illustrative: an
implementation may name and structure its rules as it likes, but each element's computed values
must be these, together with what the sections above add (the text fields, focus, the narrow
sheet, placement). Every `button` here overrides the app's shared button rules with its own
`border`, `padding`, `background` and `min-width`/`min-height`, as written.

```css
.attach-outline { position: absolute; border: 2px solid #518de0; border-radius: 2px; pointer-events: none; z-index: 2; }
button.pin { position: absolute; width: 32px; height: 32px; min-width: 32px; min-height: 32px; padding: 0; border: 0;
  border-radius: 16px 16px 16px 3px; background: white; box-shadow: 0 2px 8px #29202e30;
  display: grid; place-items: center; z-index: 2; }
.pin > .initial, .avatar { width: 24px; height: 24px; border-radius: 50%; color: white; font: 600 12px system-ui;
  display: grid; place-items: center; flex: none; }
.pin.resolved { opacity: .55; }
.pin.open { outline: 2px solid #7051cf; outline-offset: 1px; }
.pin.new > .initial { background: #e9e2fb; color: #7051cf; }
.pin.detached { background: #fff5da; box-shadow: 0 0 0 1.5px #936000 inset, 0 2px 8px #29202e30; }
.pin .badge { position: absolute; right: -6px; top: -6px; width: 18px; height: 18px; border-radius: 50%;
  background: #936000; color: white; display: grid; place-items: center; }
.composer { position: absolute; z-index: 4; display: flex; align-items: center; gap: 8px; width: 300px; background: white;
  border: 1.5px solid #7051cf; border-radius: 22px; padding: 4px 4px 4px 14px; box-shadow: 0 2px 8px #29202e20; }
.composer > textarea { flex: 1; }
button.post { width: 32px; height: 32px; min-width: 32px; min-height: 32px; padding: 0; border: 0; border-radius: 50%;
  display: grid; place-items: center; background: #7051cf; color: white; }
button.post:disabled { background: #e8e7ed; color: #79737f; opacity: 1; }
.card { position: absolute; z-index: 4; width: 320px; background: white; border: 1px solid #e9e7ed; border-radius: 12px;
  box-shadow: 0 2px 8px #29202e20; font-size: 14px; overflow: auto; }
.card-head, .panel-head { display: flex; align-items: center; gap: 2px; padding: 6px 6px 6px 14px; border-bottom: 1px solid #e9e7ed; }
.card-head > .title { flex: 1; font-size: 13px; font-weight: 700; }
.panel-head > .title { flex: 1; font-size: 14px; font-weight: 700; }
button.icon { width: 32px; height: 32px; min-width: 32px; min-height: 32px; padding: 0; border: 0; background: transparent;
  display: grid; place-items: center; color: #3b3a40; border-radius: 8px; }
button.icon:hover { background: #f1eff5; }
.row { display: grid; grid-template-columns: 24px 1fr 32px; gap: 0 10px; padding: 10px 6px 4px 14px; align-items: center; }
.row .who { font-size: 13px; } .row .who .name { font-weight: 600; } .row .who .time { color: #79737f; font-size: 12px; margin-left: 6px; }
.row .text { grid-column: 2 / 4; margin: 2px 0 6px; line-height: 1.45; white-space: pre-wrap; overflow-wrap: anywhere; }
.row button.icon { width: 28px; height: 28px; min-width: 28px; min-height: 28px; }
.reply { display: flex; align-items: flex-end; gap: 8px; margin: 6px 10px 10px; padding: 6px 6px 6px 12px;
  border: 1px solid #e8e7ed; border-radius: 10px; min-height: 44px; }
.reply > textarea { flex: 1; align-self: center; }
.reply:focus-within { border-color: #7051cf; box-shadow: 0 0 0 1px #7051cf; }
.note { margin: 0 10px 10px; padding: 8px 10px; border-radius: 8px; font-size: 13px; line-height: 1.4; }
.note.amber { color: #936000; background: #fff5da; }
.note.error { color: #a32940; background: #fdf0f2; border: 1px solid #f2cdd5; }
.note.neutral { color: #79737f; background: #f5f4f7; }
.detached-line { display: flex; gap: 6px; align-items: center; margin: 10px 10px 0; padding: 8px 10px; border-radius: 8px;
  color: #936000; background: #fff5da; font-size: 13px; line-height: 1.35; }
.panel { position: absolute; z-index: 3; top: 72px; right: 12px; width: 296px; bottom: 80px; background: white;
  border: 1px solid #e9e7ed; border-radius: 12px; box-shadow: 0 2px 8px #29202e0a; display: flex; flex-direction: column; overflow: hidden; }
.panel .list { overflow: auto; }
.empty { display: flex; align-items: flex-start; gap: 10px; padding: 16px 14px; color: #79737f; font-size: 13px; line-height: 1.45; }
button.item { display: grid; grid-template-columns: 24px 1fr; gap: 2px 10px; width: 100%; min-width: 0; min-height: 0;
  padding: 12px 14px; border: 0; border-bottom: 1px solid #f0eff3; border-radius: 0; background: white; color: #29272e;
  font-size: 13px; text-align: left; }
button.item:hover, button.item.current { background: #f5f0ff; }
button.item.current { box-shadow: inset 3px 0 0 #7051cf; }
.item .name { font-weight: 700; } .item .time { color: #79737f; font-size: 12px; }
.item .text { margin: 0; grid-column: 2; line-height: 1.4; white-space: pre-wrap; overflow-wrap: anywhere; }
.item .on { grid-column: 2; color: #79737f; font-size: 12px; }
.item .count { grid-column: 2; color: #7051cf; font-size: 12px; font-weight: 600; }
.item .detached { grid-column: 2; color: #936000; font-size: 12px; display: flex; gap: 4px; align-items: center; }
.menu { position: absolute; z-index: 6; background: #302d36; color: white; border-radius: 12px; padding: 6px;
  box-shadow: 0 2px 8px #29202e20; min-width: 190px; }
.menu button { display: flex; gap: 8px; align-items: center; width: 100%; min-width: 0; min-height: 0; padding: 8px 10px;
  border: 0; border-radius: 8px; background: transparent; color: white; font-size: 13px; text-align: left; }
.menu button:hover, .menu button:focus { background: #7051cf; outline: 0; }
.menu .tick { width: 14px; }
```

## Icons

Icons are inline SVG drawn in `currentColor` unless stated, each with `viewBox="0 0 20 20"`.
Every stroked circle and path has no fill (`fill="none"`), including Send, Unlink and Reopen's
tick; only More's three dots and Reopen's green circle are filled:

| Icon | Size | Drawing |
| --- | --- | --- |
| Speech bubble (the tool, the empty panel) | 20 | stroke 1.6, round joins, no fill: `M10 3.2c-4 0-7 2.6-7 6 0 1.6.7 3 1.9 4.1L4.3 17l3.6-1.6c.7.2 1.4.3 2.1.3 4 0 7-2.6 7-6.2s-3-6.3-7-6.3Z` |
| Check (Resolve) | 18 | stroke 1.6, no fill: a circle at 10, 10 of radius 7.2, and `m6.8 10.2 2.2 2.2 4.2-4.6` with round caps and joins |
| Filled check (Reopen) | 18 | a circle at 10, 10 of radius 8 filled `#16a34a`, and the same tick in white, stroke 1.8, round caps and joins |
| Close | 16 | stroke 1.8, round caps: `m5 5 10 10M15 5 5 15` |
| More | 18 | filled: three circles of radius 1.5 at 4.5, 10 and 15.5 across, 10 down |
| Send (Post) | 16 | stroke 2, round caps and joins: `M10 16V4M5 9l5-5 5 5` |
| Filter | 18 | stroke 1.6, round caps: `M3 5.5h14M5.5 10h9M8 14.5h4` |
| Unlink | 14 | stroke 1.8, round caps: `M8 12 6.5 13.5a2.5 2.5 0 0 1-3.5-3.5L5 8M12 8l1.5-1.5a2.5 2.5 0 0 1 3.5 3.5L15 12M3 3l14 14` |

## Keys

- **C** arms the Comment tool; **Shift+C** hides or shows pins. Neither acts while focus is in a
  text field, a text area or editable text, while an input method is composing, inside a dialog,
  or with Ctrl, Cmd or Alt held: Ctrl/Cmd+C still copies, and typing "c" or "C" in a field types
  it.
- **Escape**: closes an open menu (focus back to its button), else the composer (focus to the
  canvas) or the card (focus back to its pin, after the pin is drawn, or to the canvas when the
  pin is gone), else leaves comment mode.
- **Enter** with the canvas focused in comment mode opens the composer at the centre of the view.
  In the composer and the reply field, Enter posts and Shift+Enter starts a line (hosted storage
  v5).
- On a focused pin, **Enter** or **Space** opens its card. On the author's own focused pin the
  **arrow keys** move it 1 board pixel (10 with Shift) on screen at once; the `move` is sent when
  no arrow key has been pressed for 500 milliseconds, or when the pin loses focus.
- In a menu, **Up** and **Down** move between items (wrapping), **Home** and **End** go to the
  first and last; opening a menu focuses its first item.
- No key pressed in the composer, the card or a menu reaches the board's own key handling.

## Focus order and names

- After the canvas, Tab reaches the **pins**, then the **panel** (Filter, Close, then the items),
  in that order, before the controls that follow the canvas today. Pins come in board order: pins
  on objects by their object's drawing order, then board-point and detached pins by the sequence
  that started them. Pins are in a group named "Comment pins".
- When the composer or a card opens, its field takes focus. Inside, Tab follows the order on
  screen.
- A pin's and a list item's accessible name is "Comment thread by <label> on “<object label>”"
  or "Comment thread by <label> on the board", then ", 1 reply" or ", N replies" when there are
  replies, then ", detached" and ", resolved" when they apply (for example "Comment thread by ana
  on “Pick the launch date”, 2 replies").
- Notes use the roles in "Notes"; the length count has `role="status"`.

## Not in this version

Region comments, pin clusters, search, unread marks, mentions, reactions, rich text, a comment
history view, dark mode, and live movement of another person's pin while they drag.

## Verification boundary

The 0005-W1 brief's browser checks run in Chrome against the local Supabase stack and the Node
server at 1280 × 800 and at the narrow size they name, with page key events. A physical keyboard,
screen readers, input methods, mobile browsers, Safari and other browsers are checked only as the
maintainer asks.
