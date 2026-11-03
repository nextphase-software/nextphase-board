# 0001 — Interaction and browser contract

Contract version: 28 (for 0003-W5 brief v1, 2026-11-02). Status: Draft. When accepted it
replaces [interaction v27](0001-interaction-v27.md) for later work. Uses the same contracts as
v27, with [0003 hosted storage v3](0003-hosted-storage-v3.md) in place of hosted storage v2.

Every rule in v27 (and, through it, v26, v25 and back to v4 and the 0001-W3 presentation) still
applies except where this version replaces or adds to it. This version adds **Home**, the page
where a signed-in person finds, creates, renames and reopens hosted boards, **Back to files** in
the Board panel, and an editable name on a hosted board for its owners and editors. Hosted
storage v3 defines the behaviour (routes, reads, paging, creation, both rename paths and held
names); this contract says what appears, where, how it looks and how it is used. It replaces
v25's rules that a hosted board's name field is read-only ("The Board panel") and that **Close
this board** opens the local board ("Dialogs that end a board").

**With team features off nothing in this contract applies**: the page's markup, focus order,
keys, drawing and saved records are v27's exactly, and `#/files` opens the local board.

Sizes are CSS pixels; the app's `box-sizing: border-box` applies to every box. Every Home
control whose hover, focus or disabled look this contract does not state takes the app's shared
rules: hover background `#f1eff5`, a 3-pixel `#7051cf` focus ring at offset 3 on `:focus-visible`,
and opacity 0.45 when unavailable. Nothing on Home has a pressed look of its own (the shared
`aria-pressed` rule is not used on Home). Fonts are the
app's `system-ui` stack. Colours are written as the stylesheet writes them. A screen that has
this contract's structure and words but not its values does not meet it.

## Terms

**Home** is the page at `#/files` (**Recents**) and `#/files/<workspace>` (a **workspace
page**). A **card** is one board on Home. **Your role** on a board is the row's `role`; **your
workspace role** is the workspace's `role` in `GET /workspaces`. The **role words** on Home are
capitalised: **Owner**, **Can edit**, **Can view**, and for a workspace role also **Guest**.
**Can create** in a workspace means your workspace role is `owner` or `editor`. **Can rename** a
board means your role on it is `owner` or `editor`.

## Home signed out

`#/files` and `#/files/<workspace>` opened signed out show v25's gate with the title "Sign in to
see your boards" in place of "Sign in to open this board", and without the line "Only people
invited to it can open it."; the email and code steps are v25's. After sign-in, Home shows. Before
Auth has reported, the page (v25's team page background) shows only "Loading boards…".

## Layout

Home fills the window (`position: fixed; inset: 0`): a grid of two columns, the **sidebar**
(240) and the **main area** (the rest), background `#fafafa`, text `#29272e` at 14 on the app's
font.

### The sidebar

`<nav aria-label="Files">`: background `#fff`, a 1-pixel `#e9e7ed` line on its right, padding 12,
a column with gap 4. It scrolls by itself when taller than the window. From the top:

1. **Your account**: a button (`aria-haspopup="menu"`) with the app's shared look except: height
   44, padding 0 6, no border, items centred in a row with gap 8 and starting at the left, 8 below
   it. A 28 × 28 brand mark (background `#302d36`, white
   "N" at weight 700, corner radius 6, centred), your email (taking the rest of the row, its text aligned left,
   cut with "…" when long), and a chevron (below). It opens the **account menu**.
2. **Recents**: a sidebar item with the clock icon.
3. The label "Workspaces": 12, `#79737f`, margins 16 above, 10 at each side, 4 below.
4. One sidebar item per workspace of `GET /workspaces`, in its order: a 20 × 20 tile (corner
   radius 5, background `#ece9f2`, the workspace name's first character in `#45434d` at 11,
   weight 700, centred), the workspace's name, and your workspace role word at the item's right
   end (12, `#79737f`, weight 400).
5. At the foot (pushed to the bottom; a 1-pixel `#e9e7ed` line above it and 8 of padding below
   the line): **Boards in this browser**, a sidebar item with the device icon. It sets the
   fragment to empty, which opens the local board.

A **sidebar item** is a button exactly 36 high (its minimum height 36, not the shared 40) and the
sidebar's full width, padding 0 10, items centred
in a row with gap 10 and starting at the left, corner radius 8, no border, transparent. The item
of the page shown has `aria-current="page"`, background `#f5f0ff`, text `#7051cf` at weight 600,
also when hovered. Other items take the app's shared button hover (`#f1eff5`).

### Icons

Each is an SVG with `viewBox="0 0 20 20"`, `fill="none"`, `stroke="currentColor"`,
`stroke-width="1.75"`, round caps and joins, `aria-hidden="true"`:

| Icon | Size | Path |
| --- | --- | --- |
| Clock | 18 × 18 | `M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0M10 7v3l2 2` |
| Device | 18 × 18 | `M4 5h12v8H4zM2 16h16` |
| Plus | 16 × 16 (stroke width 2) | `M10 4v12M4 10h12` |
| Chevron | 14 × 14 | `m6 8 4 4 4-4` |
| Back | 16 × 16 | `m12 5-5 5 5 5` |

### The main area

A column. At its top, the **top bar**: height 64, padding 0 32, background `#fff`, a 1-pixel
`#e9e7ed` line below it, items centred in a row with gap 8. It holds the page's name as `<h1>`
(14, weight 600, taking the row's free width): "Recents", or the workspace's name, or
"Workspace" while the workspace is not (or not yet) in `GET /workspaces`. Then **New board**
where it is shown (see "New board").

Below it, the **body**: padding 24 32, scrolling by itself, holding on a workspace page the
**workspace head**, then the grid or a state.

**The workspace head** (only when the workspace is in `GET /workspaces`): a row with gap 10, its
items centred vertically (`align-items: center`), and 20 below it: the workspace's name as `<h2>` (24, weight 600), your workspace role as a chip, a
gap that takes the free width, and the **sort button**: a button with the app's shared look
showing the current sort's words and a chevron, items in a row with gap 6
(`aria-haspopup="menu"`).

**The grid** (`role="listbox"`, `aria-label="Boards"`): three equal columns with gap 32 in both
directions (two below 1,100 window width, one below 800).

### Cards

Each card is `role="option"` with `aria-label` the board's name and `aria-selected`, and
`tabindex="0"`: background `#fff`, a 1-pixel `#e9e7ed` border, corner radius 12, contents clipped
to it, shadow `0 2px 8px #29202e0a`.

- **The tile** (in place of a thumbnail): 168 high, the full width, a 1-pixel `#e9e7ed` line
  below, background `#fafafa` with the canvas's dots (`radial-gradient(#ddd 1px, transparent
  1px)` repeating every 24 × 24), and centred on it a 44 × 44 mark: background `#fff`, a 1-pixel
  `#e9e7ed` border, corner radius 10, "N" in `#b9b6c3` at 18, weight 700, centred, `aria-hidden`.
- **The details**: padding 12 14, a grid of three columns (20, the rest, then as wide as its
  content) and two rows, gaps 4 between rows and 10 between columns, items centred vertically:
  a 20 × 20 type mark spanning both rows (background `#302d36`, white "N" at 11, weight 700,
  centred both ways, corner radius 5, `aria-hidden`); in the first row the board's name (weight 600, one line, cut
  with "…"); in the second row the **edited line** (12, `#79737f`, one line, cut with "…"):
  "<workspace name> · Edited …" on Recents (the row's `workspaceName`) and "Edited …" on a
  workspace page; and your role on the board as a chip spanning both rows at the right.
- **A chip**: 12, `#45434d` on `#f3f0f8`, padding 2 8, a full pill (`border-radius: 999px`), no
  wrapping.
- **Selected**: a 2-pixel `#518de0` outline at offset −1. A card focused by keyboard
  (`:focus-visible`) has the same outline. Cards have no hover look.

**Edited …** is worked out from the row's `editedAt` each time the list is drawn (no clock timer
redraws it), in whole elapsed units, a time in the future counting as now:

| Elapsed | Words |
| --- | --- |
| under 1 minute | "Edited just now" |
| 1 to 59 minutes | "Edited 1 minute ago", "Edited 2 minutes ago", … |
| 1 to 23 hours | "Edited 1 hour ago", "Edited 2 hours ago", … |
| 24 to 47 hours | "Edited yesterday" |
| 2 to 6 days | "Edited 2 days ago", … |
| 7 to 29 days | whole weeks: "Edited 1 week ago" (7–13 days), "Edited 2 weeks ago", … |
| 30 to 59 days | "Edited last month" |
| 60 to 364 days | whole 30-day months: "Edited 2 months ago", … |
| 365 days or more | whole 365-day years: "Edited 1 year ago", "Edited 2 years ago", … |
| a time that cannot be read | "Edited time unavailable" |

### Menus

Home has four menus: the **card menu**, the **sort menu**, the **New board in** menu and the
**account menu**. Each is `role="menu"`, fixed to the window, 208 wide, padding 6, background
`#fff`, a 1-pixel `#e9e7ed` border, corner radius 8, shadow `0 2px 8px #29202e20`, above Home
(`z-index: 5`).

- **An item** is a button (`role="menuitem"`; `menuitemradio` with `aria-checked` in the sort
  menu), the menu's full width, with a minimum height of 32 (not the shared 40), padding 6 10 6 28, corner radius 6, no border,
  transparent, its text starting at the left. A hovered or focused item has background `#f3f0f8`
  and no outline. A chosen sort or order has a tick "✓" in `#7051cf` placed 9 from the item's
  left, `aria-hidden`.
- **A group label** ("Sort by", "Order", "New board in"): 12, `#79737f`, padding 6 10 4 28; it
  is not an item.
- **A divider**: a 1-pixel `#e9e7ed` line with 6 above and below.

| Menu | Items |
| --- | --- |
| Card menu, Recents | **Show in workspace**; divider; **Open**, **Open in new tab**; divider; **Copy link**; then, if you can rename the board and no rename of it is pending, a divider and **Rename** |
| Card menu, workspace page | **Open**, **Open in new tab**; divider; **Copy link**; then as above, a divider and **Rename** |
| Sort menu | "Sort by", **Alphabetical**, **Date created**, **Last modified**; divider; "Order", **Oldest first**, **Newest first** |
| New board in | "New board in", then one item per workspace you can create in, by name, in `GET /workspaces` order |
| Account menu | **Sign out** |

What the items do: **Show in workspace** opens the board's workspace page. **Open** opens the
board (`#/b/<board>`) in this tab. **Open in new tab** opens the board's link (v25's board link)
in a new tab with `noopener`; this tab stays on Home. **Copy link** writes the board's link with
the Clipboard API's `writeText` and shows the toast "Link copied", or "Couldn't copy the link.
Try again." when writing fails. **Rename** starts the rename field. The sort items set the sort
(`title`, `created`, `edited`) and the order items the order (`asc`, `desc`) and read the list
again (hosted storage v3). A workspace item of New board in creates a board there. **Sign out**
signs out (v25) and shows the gate.

**Where a menu opens.** The card menu opened by a right-click opens at the pointer; opened from
the keyboard, at 24 right of and 80 below the card's top-left corner. The other menus open below
their button: their top 6 below the button's bottom and their right edge at the button's right
edge. A menu is then moved, if needed, so that its left is at least 4 and at most the window's
width minus its width minus 8, and its top at least 4 and at most the window's height minus its
height minus 8.

### The rename field

Rename turns the card's name into a text field in place (`aria-label="Board name"`) holding the
name, with the whole name selected: the name's type (weight 600), no border except a 1-pixel
`#7051cf` line below, padding 0 0 1 0, no outline, transparent, the cell's full width; selected
text on `#e9e2fb`. When the name is saved (Enter, or leaving the field) the card shows the new
name at once, as hosted storage v3 says.

### New board

In the top bar, when shown: the app's shared button with background `#7051cf`, white text, no
border, the plus icon and "New board" in a row with gap 6; hovered, background `#6142be`; while a
creation is pending it is unavailable (the app's shared disabled look). It is shown on a
workspace page when you can create in that workspace, and on Recents when you can create in at
least one workspace. On a workspace page, and on Recents with one such workspace, it creates at
once; on Recents with several it opens the New board in menu.

### States in the body

A state is centred in the body (both ways, over the whole body), a column with gap 8, text
centred. Its box does not take the pointer outside its own words and buttons, so the workspace
head above stays usable:

| State | Shows |
| --- | --- |
| Loading | "Loading boards…" (`role="status"`) and no card |
| Empty workspace, you can create | "No boards yet" (bold, 14); "Everyone in <workspace> can open the boards made here." (`#79737f`, line height 1.5, at most 380 wide, 8 below); **New board** with the app's primary look (`.primary`, hover `#6142be`), which creates in this workspace |
| Empty workspace, you cannot create | "No boards yet" only |
| Empty Recents | "No recent boards" (bold, 14); "Boards you open appear here." |
| Workspace not found | "This workspace doesn't exist, or you don't have access to it." (`role="status"`) |
| Failed | "Couldn't load your boards" (bold, 14, `#a32940`, `role="alert"`); "Board's server didn't answer. Try again in a moment." (as the empty hint); **Try again** with the app's shared button look |

While a later page of a workspace loads, "Loading boards…" (`role="status"`) shows below the grid.

### The toast

Home's toast (`role="status"`) is fixed 24 above the window's bottom, centred on the main area
(120 right of the window's centre; on the window's centre below 600 window width), above Home's
menus (`z-index: 6`): padding 10 14, a 1-pixel `#e1dce8` border, corner radius 10, background
`#f3f0f8`, at most the window's width minus 32. It disappears after 5 seconds or when another
replaces it.

### Narrow windows

Below 1,100 window width the grid has two columns, below 800 one. Below 600: the sidebar is 160
wide; the top bar and the body have 12 at each side instead of 32; sidebar items have gap 6,
padding 0 4 at the sides, their height set by their content, names wrapping anywhere, and role
words at 10; the workspace head wraps; the toast centres on the window.

Home uses these light colours whatever the system's colour scheme, as the rest of the app does.

## Keyboard and focus on Home

- **Tab order**: your account, Recents, each workspace in order, Boards in this browser, New
  board (when shown), the sort button (on a workspace page), then every card in reading order
  (left to right, then down), then the states' buttons. Every card is a Tab stop.
- **Cards**: a card is selected when it gets focus or is clicked; one card at most is selected.
  Enter or a double-click opens it. Shift+F10 or the context-menu key opens its card menu; a
  right-click selects it, focuses it and opens its card menu.
- **Menus**: focus starts on **Open** in a card menu, on the chosen sort in the sort menu, and on
  the first item otherwise. Down and Up move to the next and previous item, wrapping; Home and
  End go to the first and last; Enter activates. Escape closes the menu and returns focus to its
  opener (the card or the button). Tab and Shift+Tab close it and move from the opener to the
  next or previous control. A pointer press outside the menu closes it without moving focus;
  resizing the window closes it and returns focus to the opener. Activating an item closes the
  menu, returning focus to its opener, and then does what the item does. Keys pressed in a menu do nothing else.
- **The rename field**: Enter saves and returns focus to the card; Escape puts the name back and
  returns focus to the card; leaving the field (a click elsewhere, Tab) saves and focus goes where
  it was going. While an input method is composing, Enter and Escape belong to it. Keys pressed
  in the field do nothing else.

## The Board panel

With team features on and a person signed in, the Board panel starts with **Back to files**,
then v25's "Signed in as <email>" row with Sign out, then the existing contents, on local and
hosted boards. **Back to files** is a button with the app's shared look (white, a 1-pixel
`#e8e7ed` border, corner radius 8, padding 8 12, at least 40 high, hover `#f1eff5`, the shared
focus ring), the back icon and "Back to files" in a row with gap 8 starting at the left. It
leaves the board for Home as hosted storage v3 says ("Leaving a hosted board"), asking first on a
local board with unsaved edits.

On a hosted board, the **Board name** field is editable for an owner or editor while the board
is not view only, and read-only otherwise. It keeps the field's existing look, counter
("<n> / 120 · nonblank name required") and rule (a change is sent only while the name is 1 to
120 characters and not only white space, and not while an input method is composing). Each
change is an edit (hosted storage v3, "Renaming"): the save status shows Saving… and then Saved
as for any edit.

## Dialogs that end a board

v25's **Close this board** (on the pages and in the dialogs that end a board, and the dialogs'
Escape and ×) now goes to Home (`#/files`) instead of the local board.

## Not in this version

Thumbnails and a list view, search, starring, drafts, folders, trash and deleting boards,
duplicating and moving boards, Share from Home, Remove from recent, creating, renaming or setting
up workspaces, moving a local board into a workspace, a card "…" button, keeping the sort, a
clock that redraws "Edited …", and dark mode.

## Verification boundary

The 0003-W5 brief's browser checks run in Chrome against the local Supabase stack and the Node
server, at 1280 × 800 and at the narrow sizes they name, with page key events. A physical
keyboard, screen readers, input methods, Safari and other browsers are checked only as the
maintainer asks.
