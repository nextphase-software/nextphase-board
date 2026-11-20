# 0001 — Interaction and browser contract

Contract version: 46 (for 0010-W4 brief v1, 2026-11-20). Status: Draft. When accepted it replaces
[interaction v45](0001-interaction-v45.md) for later work. Uses [document v20](0001-document-v20.md) and
[sync v15](0003-sync-v15.md), both unchanged.

Every rule in v45 (and, through it, v44 back to v4 and the 0001-W3 presentation) still applies except where
this version replaces or adds to it. This version adds **links to a page**, on local and hosted boards
alike: copying a page's link from its menu, opening a board on the page a link names, and an address that
follows the open page. Nothing in this version is stored in the document, sent to the room or recorded as
an Undo step.

## Words

- **The address**: the tab's `location.href`.
- **The page value**: the `page` parameter of the address, as defined below for each mode. It names a page
  by the page's `id` (document v18), never by its name.
- **First shows a board**: local, the storage session's **initial load attempt** in the tab succeeding and
  adopting a board, whichever board today's load rule picks (the saved board the `board` key names; a key with
  no saved board, or no valid key, falls back as today to this tab's or this browser's last board or the
  original board). The startup placeholder shown before that adoption does not count. If the initial attempt
  fails, the page value is discarded; a later Retry editing, Reopen or a board chosen from the board list
  never reads it. Hosted, the first real document of the hosted board delivered to the page owner, whatever
  the origin of that delivery.

## Page addresses

**Hosted boards.** A board link is `<origin><path>#/b/<board id>` (unchanged). A page link is the board link
followed by `?page=<page id>`:

```
<origin><path>#/b/<board id>?page=<page id>
```

The fragment `#/b/<uuid>` may now end with `?page=<value>`, where `<value>` is any run of characters other
than `&` and `#` (it may be empty). Such a fragment is a **board link with a page value**; any other text
after the board id still makes the link bad, as today. Invitation, home, workspace and Trash fragments are
unchanged. `<origin><path>` is taken from the address as the board link takes it today (no query, no
fragment).

**Local boards.** The address keeps its existing `board=<board key>` parameter (written today when a board
opens). A page link is the address with its `page` parameter set to the page id and every other part of the
address unchanged:

```
<origin><path>?board=<board key>&page=<page id>
```

The page value is the `page` query parameter, decoded as the URL standard decodes it.

## Copy link to page

The page menu (v43 "The page menu") gains one item **first**, followed by a separator. Items, in order:

1. **Copy link to page**
2. separator
3. **Rename page**
4. **Duplicate page**
5. separator
6. **Move up**
7. **Move down**
8. separator
9. **Delete page**, text `#a3302a`

The new item has the menu's existing item look (36 px tall, radius 8 px, 14 px weight 400, padding 0 10 px,
text `#1b2433`, hover and focus fill `#eef1f5`, pressed fill `#d9dfe7`), and its separator the existing
separator look. Opening the menu moves focus to its first enabled item, which is now **Copy link to page**.
The menu stays 220 px wide, 4 px under its button, left edges aligned (kept inside the window).

Copy link to page is **never disabled**: not while editing is not allowed, not for a viewer, not during a
gesture, a composition or a Tidy up preview. It changes nothing on the board and saves nothing: a local link
names the page id, and opening it later reads the board as last saved in this browser (below).

**Choosing it** (click, or Return or Space on the focused item):
1. writes the page's link (above) to the system clipboard as plain text, with `navigator.clipboard.writeText`
   inside the choosing event;
2. closes the menu **and** the Pages list, and moves focus to the Pages button;
3. shows the app's existing notice message:
   - hosted: `Link to “<page name>” copied.`
   - local: `Link to “<page name>” copied. It opens in this browser only.`
   - when the clipboard write is refused (its promise rejects, or the API is missing):
     `Could not copy the link. Your browser blocked the clipboard.`

`<page name>` is the page's name at the moment of choosing, in curly quotes `“` `”`. Choosing it adds no Undo
step, leaves the save state unchanged and sends nothing to the room.

## The viewer's page menu

For a viewer, or while a hosted board is read-only for another reason, v44 "The viewer's pages list" changes
in one point: **each row has the "…" button**, with the same name (`Page options for <name>`), tooltip
(`Page options`), size, look, place and showing rule (current row, hover, focus) as an editor's row. A
viewer's row lays out exactly as an editor's: the 32 px "…" slot is kept when the button is hidden, and the
row's avatars sit 4 px before that slot (v44's "6 px from each row's right edge" no longer applies). Its menu
(`role="menu"`, name `Page options`) holds **only Copy link to page**, with no separator, in the same menu
look and place. While the menu is open, the row and its "…" button take the editor's open-menu look (row
fill `#eef1f5`, button fill `#d9dfe7`), whatever page is current, as the mock-up's recaptured viewer screen
shows.
Everything else in v44's viewer list stays: no Add page button, `View only` in the header, no name field, no
drag, no F2, no Move to page.

**Becoming read-only with a menu open.** When a hosted board turns read-only (a role change, the connection's
read-only states) while an editor's page menu is open, the menu closes, and an open name field, row drag or
Move to page menu closes as v44 says. The person can then open a viewer's one-item menu.

## Opening a board on a page

When the tab **first shows a board** (above) and the address has a page value (hosted: the fragment names
that board; local: any page value, whichever board the load rule picked):
- a page value that is the `id` of one of the board's pages: that page opens;
- a page value that is not (unknown, malformed, empty, or a page added after the board was last saved in this
  browser): the board's **first page** opens and the notice reads
  `That page no longer exists. You are on “<first page name>”.`

With no page value, today's page and view rules apply unchanged (the page last opened in this browser, else
the first page, with today's opening view).

The page value is read **only** at that moment and in "A link to the board that is open" below; a board
adopted later in the same tab never reads it.

The page opened this way opens as every page opens (v43 "Opening a page"): it is not an edit, no Undo step,
no save state change. Its view is **today's opening view**, exactly as when that page is the remembered one
(v43 "The view of each page": the page a board opens on keeps today's opening view). It becomes the page
remembered for that board in this browser (v43 "Which page a board opens on"). On a hosted board the
person's presence carries that page as soon as it opens (v44).

**Order with the load's own messages.** The page is resolved against the board's first real document (local:
the adopted board; hosted: the first snapshot), never the placeholder. The missing-page notice is set after
the load's own startup message, so it replaces a normal load's informational message. When the load ends
read-only or with a recovery message (another tab owns the board, an invalid or unreadable board, editing
paused), that message stays and the missing-page notice is not shown; the first page still opens and the
address is still corrected. Only those local failures suppress it: on a hosted board, a viewer (read-only by
role) gets the missing-page notice, below the team notice column (see "Notice placement"). The notice and the address are set from an event handler or an existing effect
after render, never during render.

Opening a hosted page link while signed out shows today's sign-in; after signing in, the board opens on the
linked page by the rule above. Access is unchanged: someone who cannot open the board gets today's outcome.

## A link to the board that is open (hosted boards)

When the fragment changes (the person pastes a link into the address bar, or Back, Forward or the app sets
the fragment) and the new fragment is a board link to **the board open in this tab**:
- the board is **not** stopped, reopened or reloaded; no leave question is asked, even with changes waiting
  to be saved; the Undo history, the selection rules and the connection stay;
- with a page value naming one of its pages: that page opens as opening it from the Pages list does (v43: its
  remembered view in this tab, or the fit when opened for the first time in the tab), unless it is already
  open;
- with a page value that names none of its pages: the first page opens with the notice above;
- with no page value: nothing changes;
- while opening a page is not allowed (a gesture, a composition or a Tidy up preview, v43): the page does not
  change and the notice reads `Finish the current action first.`;
- before the board's first real document has arrived: the new fragment's page value replaces the one waiting
  to be applied (a link with no page value clears it), and only the latest applies when the document arrives;
  the address is not rewritten until a real page is open.

In each case the address is then rewritten to the open page (below). **Route identity.** For the life of a
board session (one that started from a board link or from an accepted invitation), no change of page value,
from a link or from the app's own address writes, remounts the board. When the route restarts (for example
after signing in again), it opens the address as it is at that moment, which is the open page's resolved
link. When a leave question opens, the address already shows the open page's link (not the bare board link),
and **Stay** keeps it. A fragment naming any other board, or any other kind of fragment, behaves as today.

Local boards: a changed `page` query parameter is a new page load by the browser, so the board loads anew and
"Opening a board on a page" applies.

## The address follows the open page

Whenever the open page changes (any way of opening a page, including a remote delete of the open page, Undo
or Redo, following someone, opening a link), and when a board is first shown, the address is rewritten to
that page's link with `history.replaceState`: no new history entry, no page load, no `hashchange`. While a
history preview is open (v44), the address follows the page shown in the preview. Nothing else about the
address changes (a local address keeps its `board` parameter; a hosted address keeps its origin and path).

The board link copied from the Share dialog and the home lists stays the board link without a page value.

## Keys

No new key. v43's page menu keys apply to the new item and to the viewer's menu: ArrowUp and ArrowDown move
between enabled items (wrapping), Home and End to the first and last, Return or Space chooses, Escape closes
the menu and returns focus to its "…" button.

## Notice placement

The notices of this version are the app's existing board notice: centred, `min(660px, 100% − 24px)` wide,
its top at the existing `--notice-top` (68 px at 1440 × 900 with nothing else above the canvas); a one-line
notice such as these at 1440 wide is 37 px tall (a long page name or the notice's other content may wrap it).
On a hosted board, when the team notice column is showing (for example a viewer's `You can view this board…`
banner, or a loss notice), the board notice's top is **8 px below that column's bottom edge**, so the two
never overlap; this applies to every board notice, not only this version's. Only the board notice moves: the
panels and selection controls keep today's placement. On a hosted board the notice never shows the local
**Retry editing** button.

## Accessibility

The new notices are the app's existing notice messages (`role="status"`). The viewer's "…" button and menu
use the same roles and names as an editor's.

## Not in this version

Links inside text, stickies or shapes; a link to a single object; the selection in the address; a preview
card for a pasted board link; a page value in the Share dialog's or home list's Copy link.
