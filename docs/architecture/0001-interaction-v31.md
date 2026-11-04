# 0001 — Interaction and browser contract

Contract version: 31 (for 0006-W1 brief v1, 2026-11-04). Status: Draft. When accepted it
replaces [interaction v30](0001-interaction-v30.md) for later work. Uses the same contracts as
v30, with [0003 API v5](0003-api-v5.md) in place of API v4.

Every rule in v30 (and, through it, v29, v28 and back to v4 and the 0001-W3 presentation) still
applies except where this version replaces or adds to it. This version adds **Import board file…**
on Home ([interaction v28](0001-interaction-v28.md), "Home"): the button, its **Import into** menu,
the file picker, Home while a file is imported, and the refusal message. Because the import is
Home's only new behaviour, this contract states its behaviour and its words as well as its look;
[hosted storage v5](0003-hosted-storage-v5.md) and its Home rules (from hosted storage v3) are
otherwise unchanged.

**With team features off nothing in this contract applies**: the page's markup, focus order,
keys, drawing and saved records are v30's exactly. Home does not exist then, and a local board's
**Open board file** and **Save a copy to file** are unchanged.

Sizes are CSS pixels with the app's `box-sizing: border-box`. Fonts are the app's `system-ui`
stack. Colours are written as the stylesheet writes them. Positions are for a 1280 × 800 window
unless stated, measured from the window's top-left corner to the element's border box. A screen
that has this contract's structure and words but not its values does not meet it.

## Where Import board file… appears

Import board file… is shown exactly where New board is shown (v28, "New board"): on a workspace
page when you can create in that workspace, and on Recents when you can create in at least one
workspace. Where New board is not shown (a viewer, a guest, someone with a grant only, a workspace
that is not found), Import is not shown either.

In the **top bar** it is the item immediately before New board, with the top bar's gap of 8
between them: page name, Import board file…, New board. In the empty-workspace state ("No boards
yet", v28 "States in the body") the body still shows only its own New board; Import stays in the
top bar.

At 1280 × 800 on a workspace page or on Recents: Import's border box is x 958, y 12, 166 × 40;
New board's is x 1132, y 12, 116 × 40, as before. (Import's width comes from its contents: 12 + 16
+ 6 + the words + 12, plus its two 1-pixel borders.)

## The button

Markup: `<button class="home-import">`, holding the icon and then the words in a `<span>`:
**Import board file…** (with the single character `…`, U+2026). It has `aria-label="Import board
file…"` and `title="Import board file…"` at every width and in every state, and
`aria-haspopup="menu"` only when it opens the Import into menu (below); otherwise it has no
`aria-haspopup`.

Look: the app's shared button (the base `button` rule in `apps/web/style.css`): background
`white`, a 1-pixel `#e8e7ed` border, corner radius 8, minimum width and height 40, padding 8 12,
14-pixel text in Home's text colour `#29272e`; and, added by `.home-import`, `display: flex`,
`align-items: center` and a gap of 6 between the icon and the words. Hovered, its background is
the shared `#f1eff5`; focused from the keyboard, the shared 3-pixel `#7051cf` ring at offset 3;
unavailable, the shared opacity 0.45. It has no pressed look.

**The icon** is drawn as New board's plus is (v28, "Icons"): an SVG 16 × 16 with
`viewBox="0 0 20 20"`, `fill="none"`, `stroke="currentColor"`, `stroke-width="2"`, round caps and
joins, `aria-hidden="true"`, one path: `M10 13V4M6.5 7.5 10 4l3.5 3.5M4 12.5V16h12v-3.5` (an
arrow up out of a tray).

## The Import into menu

When the page is Recents and you can create in **more than one** workspace, the button opens the
**Import into** menu. It is a Home menu (v28, "Menus": `role="menu"`, 208 wide, padding 6,
background `#fff`, a 1-pixel `#e9e7ed` border, corner radius 8, shadow `0 2px 8px #29202e20`,
`z-index: 5`), placed as Home's button menus are: its top 6 below the button's bottom and its
right edge on the button's right edge, then kept inside the window (v28, "Where a menu opens"). At
1280 × 800 its border box's top-left is x 916, y 58. It holds the group label **Import into**
(v28's label look: 12, `#79737f`, padding 6 10 4 28), then one item per workspace you can create
in, by name, in `GET /workspaces` order (v28's item look; no tick). Its keys and focus are v28's
("Keyboard and focus on Home", "Menus"): focus starts on the first item. Choosing an item closes
the menu, returns focus to Import, and opens the file picker for that workspace.

On a workspace page, and on Recents with exactly one workspace you can create in, the button
opens the file picker at once, for that workspace. This is New board's rule (v28, "New board").

## The file picker

The picker is the browser's own, opened from a file input that is never drawn: `<input
type="file" accept=".nextboard,.json" hidden>`, one file, outside the top bar (after Home's menu,
before its toast). It is not a Tab stop. Choosing no file (closing the picker) does nothing: no
message, no request, and focus goes back to Import.

## Importing

One creation runs at a time on Home, shared with New board (hosted storage v3, "Creating a board"): while
either runs, Import and New board are unavailable, and the other cannot start.

When a file is chosen:

1. **Home shows the import at once.** Import's words become **Importing…** (its `aria-label` and
   `title` stay "Import board file…"); Import, the top bar's New board and the empty state's New
   board are unavailable (the shared disabled look); the toast (v28, "The toast": `role="status"`,
   fixed 24 above the window's bottom, centred on the main area, padding 10 14, a 1-pixel `#e1dce8`
   border, corner radius 10, background `#f3f0f8`, `z-index: 6`) says **Importing “<file>”…**,
   where `<file>` is the chosen file's name as the browser gives it, between “ and ” (U+201C,
   U+201D). This toast does not disappear after 5 seconds: it stays until the import ends.
2. **The tab reads the file** with board file v2's reader as local **Open board file** starts
   it: `readBoardBundle` in `apps/web/src/board-file.ts`, which runs the Reading rules 1 to 12
   ([board file v2](0006-board-file-v2.md), "Reading"). Each of its refusals ends the import with
   that reason's words (below). Nothing is sent. Rule 13 (decoding pictures in the browser) and a
   version 1 file's picture lookup are not run: a board with pictures is refused next, whatever its
   pictures hold.
3. **Pictures.** If the board holds any picture (any object of type `image`), the import ends with
   "it holds pictures, which team boards can't hold yet". Nothing is sent.
4. **Older boards** (document versions 1 to 9, which the reader accepts) are brought to version
   10 with the document's own `upgrade`, as Open board file does. If the result's canonical JSON
   would be over 2 MiB, the import ends with the reader's "it is not a valid board". Nothing is
   sent.
5. **The request.** The tab sends `POST /workspaces/<workspace>/boards` with
   `{ "title": <the document's title>, "document": <the version 10 document> }` ([API
   v5](0003-api-v5.md), "Creating a board from a document"), through the team API helper
   (`team/api.ts`: the person's token, 15 seconds before "no answer").
6. **On 201** the tab opens the new board: the fragment becomes `#/b/<id>`, in this tab, as New
   board does. The new board is in its workspace's list for everyone there.
7. **On a refusal or no answer** the import ends with the server's reason (below).

**When an import ends without a board**, Import's words are "Import board file…" again, Import
and New board are available again, focus moves to Import, and the toast says **Couldn't import
“<file>”: <reason>.** for 5 seconds, as Home's other toasts (v28). The list is unchanged.

| The import ended because | `<reason>` |
| --- | --- |
| The file is over 72 MiB | it is larger than 72 MiB |
| It is not a Board file | it is not a Board file |
| It is damaged | it is damaged |
| It is not a valid board (including a board over 2 MiB) | it is not a valid board |
| A newer Board made it | it was made by a newer version of Board |
| It holds pictures | it holds pictures, which team boards can't hold yet |
| The server refused | the reply's reason with each `_` replaced by a space, as New board's words do (hosted storage v3, "Messages"); for example "role too low" |
| No answer | no answer |

The first five are the reader's own reasons (`FILE_REASONS`), so for a file without pictures
Open board file and Import say the same thing. (For a version 2 file whose picture passes rules 1
to 12 but does not decode, Open board file says "it is damaged" and Import gives the pictures
refusal.) A board over 2 MiB has no words of its own: the reader already
refuses it as not a valid board (document v11 limits every board to 2 MiB).

**Home's other messages while importing.** While the import's toast shows ("Importing …"), no other
Home message replaces it: a message Home would show meanwhile (for example "Link copied", or a
rename's refusal) is not shown, then or later. Once the import has ended, the toast works as v28
says: the newest message replaces the one shown.

**Leaving Home while importing** (opening a board, going back) does not cancel the request. Home
shows nothing more for it; a board made by it is in its workspace's list.

## Narrow windows

Below 600 window width (the same `max-width: 599.98px` query as v28's "Narrow windows"):

- Import is **40 × 40** with **no padding**, its icon centred (`justify-content: center`), and its
  words not shown (the `<span>` has `display: none`). Its name and tooltip are still "Import board
  file…".
- Import and the top bar's New board each have `flex-shrink: 0` and `white-space: nowrap`, so each
  keeps one line.
- The top bar's page name (`h1`) has `min-width: 0`, `overflow: hidden`, `text-overflow: ellipsis`
  and `white-space: nowrap`: it gives way, ending in "…", and the full name is still the
  workspace head's `h2` below it.

At 375 × 812 on Acme's page: Import x 199, New board x 247 and 116 wide, both y 12 and 40 high.

## The values as CSS

These rules are added at the end of `apps/web/style.css`; no existing rule changes:

```css
.home-import { display: flex; align-items: center; gap: 6px; }
@media (max-width: 599.98px) {
  .home-import { width: 40px; height: 40px; padding: 0; justify-content: center; }
  .home-import span { display: none; }
  .home-import, .home .home-new-board { flex-shrink: 0; white-space: nowrap; }
  .home-topbar h1 { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
}
```

Every other value (the button's base look, the menu, the label and items, the toast) is an
existing rule, used as it is.

## Keyboard and focus on Home

v28's section applies, with the Tab order amended: your account, Recents, each workspace in order,
Boards in this browser, **Import board file…** (when shown), New board (when shown), the sort
button (on a workspace page), then every card in reading order, then the states' buttons. Enter
and Space on Import do what a click does. The Import into menu closes as v28's menus do: Escape,
resizing the window and choosing an item return focus to Import; Tab and Shift+Tab move from
Import to the next or previous control; a pointer press outside closes it without moving focus.
After an item is chosen, the picker opens. Focus also returns to Import after the picker is closed
without a file, and after an import ends without a board.

## Not in this version

Dropping a file onto Home to import it; importing into an open board or replacing a board's
content; choosing the new board's name before importing; pictures, comments and access in an
import; and v30's list.

## Verification boundary

The 0006-W1 brief's browser checks run in Chrome against the local Supabase stack and the Node
server at 1280 × 800 and at the narrow size they name, with page key events, choosing files
through the page's file input (not an operating-system dialog). A physical keyboard, screen
readers, Safari and other browsers are checked only as the maintainer asks.
