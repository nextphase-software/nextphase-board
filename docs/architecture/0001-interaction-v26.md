# 0001 — Interaction and browser contract

Contract version: 26 (for 0004-W3 brief v1, 2026-11-02). Status: Draft. When accepted it
replaces [interaction v25](0001-interaction-v25.md) for later work. Uses
[document v11](0001-document-v11.md), [storage v3](0001-storage-v3.md),
[board file v2](0006-board-file-v2.md), the
[activity catalogue contract](0008-activity-catalogue-v1.md),
[0003 hosted storage v2](0003-hosted-storage-v2.md) and
[0004 presence v1](0004-presence-v1.md).

Every rule in v25 (and, through it, v24 back to v4 and the 0001-W3 presentation) still applies
except where this version replaces or adds to it. This version adds **presence on screen** for
hosted boards: who is on the board, each other connection's cursor and selection, following
another person's view, and a switch that hides other people's cursors. Presence v1 defines what
the room stamps and what each connection sends; hosted storage v2 says how the page keeps the
switch; this contract says what appears, where, and how it is used. It replaces v25's sentence
"Later, presence avatars go before the status (not in this version)" (see **People**).

**On a local board, and with team features off, nothing in this contract applies**: the page's
markup, focus order, keys, drawing and saved records are v25's exactly.

## Terms

A **connection** is one open room connection, as in presence v1: two tabs of one person are two
connections. Each connection has a **presence**: what the room stamps (`connection`, `person`,
`label`, `role`, `colour`) and what the connection last sent (`cursor`, `selection`, `view`,
`active`). **Your connection** is this tab's; **others** are every other connection on the board,
including other tabs of your own person.

A **person** is every connection with the same `person` key. A person's **first connection** is
the one of that person's surviving connections this tab learnt of first (in the `joined` list, in
its order, then in the order `present` messages first named each connection). The person's
avatar label, role and colour are those of their first connection; when it leaves, the next one
supplies them, so an avatar's colour can change while the person stays. Cursors and outlines
always keep their own connection's colour. Two tabs may list people in a different order and
may show a different avatar colour for the same person; nothing promises otherwise.

The **role words** are v25's: **owner**, **can edit**, **can view**.

## What this tab sends

A hosted board sends its presence through the shared client (sync v4, "The shared client"),
which already sends at most one presence per 100 ms and repeats it every 15 seconds. The page
sends a new presence whenever one of these changes. Viewers send presence too.

| Field | Value |
| --- | --- |
| `cursor` | The pointer in board units while it is over the scene (the canvas area) or over the text field of an idea being edited in place; `null` when it is over a floating control or panel, outside the page, or the page has had no pointer yet |
| `selection` | The first 250 selected object IDs, in the selection's own order (presence v1 refuses more than 250) |
| `view` | The board rectangle the scene shows: `x` and `y` are its top-left corner, `width` and `height` the scene's CSS size divided by the zoom. For example a view centred on (100, −50) at zoom 2 in a 1280 × 800 scene sends `{ "x": -220, "y": -250, "width": 640, "height": 400 }` |
| `active` | `true` while the page is visible (`document.visibilityState` is `visible`), else `false`. It is not keyboard focus or recent input |

Presence v1 allows numbers between −1,000,000 and 1,000,000 only. Before sending, the page clamps
`cursor.x`, `cursor.y`, `view.x` and `view.y` to that range and `view.width` and `view.height` to
at most 1,000,000, so a view near the board's edge is sent a little smaller than it is. Nothing is
sent while the hosted board has no open connection.

## People

In the save panel, on a hosted board, the **people group** comes first, before the status (the
place v25 reserved), then a thin divider, then the status and Share as in v25.

- One round **avatar** per person, filled with the person's colour and showing the first letter
  of the label in upper case. Your own person comes first, then the others in the order this tab
  learnt of their first connections.
- At most **three** avatars (one when the window is narrower than 768 CSS pixels); when more
  people are on the board, a **+N** button follows (N is the number not shown).
- Then a chevron button that opens the **people menu**.
- The group is a list (`<ul>` named "People on this board") of buttons:
  - your own avatar: name "<label> (you), <role words>. Open people menu"; activating it opens the
    people menu;
  - another person's avatar: name "Follow <label>, <role words>"; activating it follows that
    person (see **Following**);
  - +N: name "Show <N> more people"; it opens the people menu;
  - the chevron: name "People on this board: <number of people>"; it opens the people menu.
  +N and the chevron have `aria-haspopup="menu"` and `aria-expanded`. Each avatar's tooltip
  (`title`) is the label, with " (you)" on your own.
- While following, the followed person's avatar has a ring in their connection's colour.
- No live region: joins and leaves are not announced.

## The people menu

A popup under the people group, `role="menu"`, named "People on this board":

1. One row per person (`menuitem`), in the avatars' order: the colour dot with the initial, the
   label (your own followed by " (you)") and below it the role words. Another person's row also
   shows **Follow** at its end on hover and focus; activating the row follows that person and
   closes the menu. Your own row does nothing.
2. A divider.
3. **Show other people's cursors** (`menuitemcheckbox`, `aria-checked` the switch's state), with
   a check mark when on and the shortcut at its end: **⌥⌘\\** on macOS, **Ctrl+Alt+\\** elsewhere.
   Activating it flips the switch and leaves the menu open.

Keys: on opening, focus goes to the first row. Down and Up move to the next and previous item
and wrap; Home and End go to the first and last; Enter and Space activate the focused item;
Escape closes the menu and returns focus to the button that opened it; Tab closes the menu and
moves on as usual. A pointer press outside the group, or focus leaving it, closes the menu. The
cursor switch's shortcut works in the menu as it does elsewhere (the menu stays open and the
item's check mark follows); every other key pressed in the menu never reaches the page's own key
handling.

## Cursors and selections of others

A layer over the canvas, which never takes the pointer and is hidden from assistive technology
(`aria-hidden`), draws for each of the others:

- **Its selection:** a 2 CSS pixel outline in the connection's colour around the same box your
  own selection box would have for those objects (the box of the rectangle objects when the
  selection has any, else of all of them), with no handles and no context bar. IDs of objects not
  on this board are skipped; with none left, nothing is drawn.
- **Its cursor**, when its `cursor` is not `null`: an arrow in the connection's colour with a white
  edge, and beside it a name pill in that colour with white text: the label, followed by
  " · viewer" when its role is `viewer`.

Your own connection is never drawn. Outlines and cursors follow your view as the board does. The
board's own drawing and the canvas are not redrawn for presence: only this layer changes.

## Showing other people's cursors

**Show other people's cursors** is on by default. Off, the layer draws no cursor or name pill,
except the cursor and pill of the connection you are following. Selection outlines always show.
The switch affects this tab only; it is remembered on this device as hosted storage v2 says and
read when a hosted board opens (another tab already open keeps its own state).

The shortcut toggles it anywhere on a hosted board, the people menu included, except inside a
team dialog: **Option+Command+\\** on macOS and **Ctrl+Alt+\\** elsewhere, with no Shift. It matches the
physical key (`KeyboardEvent.code` `"Backslash"`), not the character: on macOS, Option changes
the character (for example to "«"). The key's default action is prevented. It does nothing while
an input method is composing.

## Following

**Follow** (another person's avatar, or their row in the people menu) follows one connection of
that person: the one whose latest presence this tab received says `active: true`, and among
those the one this tab most recently received a presence from (a 15-second repeat counts); when
none is active, the one most recently received from. The choice is made once, when Follow is
activated, and stays on that connection until following ends; it does not move to another tab of
the person.

While following:

- Your view fits theirs: its centre is the centre of their `view` (`x + width / 2`,
  `y + height / 2`), kept within Board's ±1,000,000 as any view is, and its zoom is the smaller of
  (your scene's width ÷ their width) and (your scene's height ÷ their height), kept within Board's
  50% to 200%. At 50%, part of their view may lie outside yours; your view stays centred on
  theirs. It moves each time a new presence of theirs arrives.
- A 3 CSS pixel **frame** in their colour lines the board area (it takes no pointer).
- A **banner** in their colour at the top centre of the board area reads "Following <label> ·"
  followed by a **Stop following** button (white text). It has no live-region role.
- Their cursor and name pill show even when **Show other people's cursors** is off.

Following ends when:

- you activate **Stop following**, or press Escape (outside a menu or team dialog);
- you move your own view in any way: wheel or touchpad pan and zoom, pinch, Ctrl/Cmd+wheel, the
  browser's gesture events, the Pan tool or Space drag, the zoom buttons, the Navigation panel's
  pan and Reset view, and each of those controls when activated from the keyboard. Your view
  moving because theirs moved never ends it;
- that connection leaves the board (it closes, or its presence expires after 30 seconds without
  a message, presence v1).

Following someone else ends the current follow and starts the new one. When following ends the
frame, the banner and the ring go and your view stays where it is.

## Narrow windows

v25's placement of the top panels and the hosted banner applies, with the following banner added:

| Window width (CSS pixels) | Following banner top | Hosted banner top (with a following banner) |
| --- | --- | --- |
| 1,100 or more | 8 (between the file bar and the save panel) | as v25 (below the top panels) |
| 768 to 1,099 | 70 | 132 |
| below 768 | 126 | 188 |

Both banners are at most the window's width minus 24 CSS pixels, centred, and a long label is cut
with an ellipsis. Below 768 CSS pixels the people group shows one avatar, then +N. The scene's
existing minimum height (900 CSS pixels in narrow windows) is unchanged, so part of the board area
may lie below the browser window; the follow fit uses the scene's size.

## Presence refusals

A refusal of presence is not a refused edit. The room refuses a presence with `refused` and one
of the reasons `presence_too_large`, `presence_fields`, `presence_selection_limit` or
`bad_presence`, with no `requestId` (presence v1); the shared client's own check before sending
refuses with the same reasons. Either way the page shows nothing: no toast, no change to the save
state, the connection, the banner or the editing tools, and the board is not reloaded. A refused
edit (it carries the edit's `requestId`) keeps hosted storage v2's behaviour.

## Not in this version

Spotlight, cursor chat and reactions, audio, another person's text caret or typing, idle or away
styles beyond `active`, join and leave announcements, a main or View menu, dark mode (the app has
none), presence on local boards, and choosing which of a person's tabs to follow.

## Verification boundary

The 0004-W3 brief's browser checks run in Chrome against the local Supabase stack and the Node
server, at 1280 × 800 and at the narrow sizes they name. The shortcut is checked with one
operating-system key event on macOS and with page key events for the other branch; a physical
keyboard, Windows, a physical touchpad pinch, screen readers, Safari and other browsers are
checked only as the maintainer asks.
