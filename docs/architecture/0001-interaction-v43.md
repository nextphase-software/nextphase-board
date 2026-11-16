# 0001 — Interaction and browser contract

Contract version: 43 (for 0010-W2 brief v1, 2026-11-15). Status: Draft. When accepted it replaces
[interaction v42](0001-interaction-v42.md) for later work. Uses [document v18](0001-document-v18.md).

Every rule in v42 (and, through it, v41 back to v4 and the 0001-W3 presentation) still applies except
where this version replaces or adds to it. This version adds **pages** to **local (single-user)
boards**: the Pages button and list, adding, renaming, reordering, duplicating, deleting and opening
pages, Move to page, and how find, the Navigation panel, Undo and the view behave with several pages.

**Hosted (team) boards are unchanged**: they have one page (document v18), and the Pages button, the
pages list and Move to page are not shown on them. A local board with one page looks and behaves as
today apart from the Pages button (below).

## Words

The **open page** is the page shown on the canvas. A **page step** is one of: add a page, rename a page,
move a page (drag, Move up, Move down), duplicate a page, delete a page, move objects to a page. **Editing
allowed** means what it means for Duplicate today: not read-only, no gesture in progress, not composing,
no Tidy up preview open; when it is not allowed, the controls below that make page steps are disabled
with the reason `commandReason` gives today as their tooltip.

## The open page

Everything that works on "the board" today works on the open page's objects only: drawing, hit
testing, the connection dots, box selection, Select all, the selection and its bars, the Objects panel's
list, Tidy up, the mind-map buttons, Zoom to fit, Zoom to selection, the Sections list, pasting and
placing (new objects are created on the open page; a duplicate goes on its source's page, which is the
open page), and inserting a template or activity (its objects go on the open page). Objects on other
pages are never drawn, selected or changed by these. Every edit is made on the **whole** board, so an
edit on one page leaves every other page's objects as they were, except their `order` number, which stays
the object's index in the whole board (document v18) and so may shift while their relative order stays.

**Opening a page** (from the list, the find bar, a notice's Go to button, Undo or Redo, or deleting the
open page) ends a text edit as a click elsewhere would, clears the selection, closes the colour,
arrange and connector popups, and then shows the page. It is not an edit: no Undo step, no change to the
save state, nothing stored in the document. It is not possible while a gesture is in progress, while
composing or while a Tidy up preview is open (the rows are disabled then). The find bar stays open.

**The view of each page.** While the tab is open each page keeps its own view: leaving a page remembers
its view, and returning shows that view again. A page opened for the first time in the tab shows the
**fit** (interaction v42) of all its objects' boxes, or `{x: 0, y: 0, z: 1}` when it has no objects. The
page a board opens on keeps today's opening view.

**Which page a board opens on.** Each time a page is opened on a local board, its id is written to
`localStorage` under the key `nextphase-board/page/v1/<boardId>` (failures to read or write are
ignored). When a local board is loaded it opens on the page stored there if that page exists, otherwise
on its first page. Nothing else is stored.

## The Pages button

On local boards only, the file bar gains a **Pages** button: the shared 40 × 40 file-bar icon button,
placed immediately after the file bar's divider and before **Objects**. Its accessible name and tooltip
are `Pages` (the file bar's shared tooltip below the bar); `aria-expanded` is true while the pages list
is open. Icon: a 20 × 20 view box, `currentColor` strokes 1.6 wide, round joins: a rectangle x 6.5, y 3.5,
10 × 11, radius 2, and the path `M13.5 16.5 h-8 a2 2 0 0 1 -2 -2 v-8`. While the list is open the button
has fill `#dceafb` and icon colour `#1665d8`. Its hover is fill `#eef1f5`; focus-visible is the shared
focus look. It toggles the list. It works whether or not editing is allowed (opening pages is not an
edit).

## The pages list

A popover under the file bar: its left edge at the Pages button's left edge, top 68 px, width 240 px,
padding 8 px; background `#ffffff`, 1 px `#d9dfe7` border, radius 12 px, shadow
`0 12px 30px rgb(21 32 51 / 0.08)`, `z-index: 5` (above the notices row, under menus). Text in
`"Plus Jakarta Sans", ui-sans-serif, system-ui, sans-serif` (a font the browser already has, or the
fallbacks: no font file is added), colour `#1b2433`. Its accessible name is `Pages`. Under 768 CSS
pixels of window width it spans from left 12 px to right 12 px. Its height is at most 360 px: past **eight** rows
the rows scroll inside it while the header stays in place.

**Header**, 36 px tall, 4 px above the rows: the heading `Pages` (13 px, weight 600) 8 px from the left,
and at the right **Add page** (accessible name and tooltip `Add page`): a 32 × 32 icon button with radius
8 px, no border, transparent fill, a plus icon (18 px; strokes 1.75, round caps: `M10 4.5 v11 M4.5 10 h11`).

**Rows**, one per page in page order, 36 px tall, 2 px apart, radius 8 px, padding 0 2 px 0 10 px, in a
list. A row holds the page's **name button** (no border, transparent fill, no minimum size, no padding) (the name, 13 px, weight 500, 10 px from the row's left, cut with an ellipsis when
too long; it fills the row) and, at its right, its **options button** (accessible name
`Page options for <name>`, tooltip `Page options`, 32 × 32, radius 8, a "…" icon: three filled circles of
radius 1.5 at (5, 10), (10, 10), (15, 10) in a 20 × 20 view box, drawn at 18 px). The heading's line height is 1.25. The list's own buttons (Add page, name and options buttons) drop
the shared button border, minimum size and padding; Add page and options buttons have hover fill `#eef1f5`
and pressed (`:active`) fill `#d9dfe7`; a row whose name button is pressed has fill `#d9dfe7`. The open
page's row has fill `#dceafb`, its name weight 600 and `aria-current="page"`, and always shows its options button.
Another row shows its options button while the row is hovered or has focus within it, or while its menu
is open; a row whose menu is open has fill `#eef1f5` and its options button fill `#d9dfe7`. Hover on any
row other than the open page's: fill `#eef1f5`. Focus-visible inside the list and its menus: a 3 px `#1665d8` outline
2 px outside the control, except the name field, whose 2 px border is its focus look (no outline).

Opening the list moves focus to the open page's name button. Keys handled inside the list, the field and
the menus (arrows, Home, End, Return, Space, Escape) go no further, so the board's own keys do not act on
them. Clicking a name button opens that page; the list stays open. Escape (with focus in the list and no
field or menu open), a pointer down outside the list and the Pages button, or the Pages button closes
it, and focus returns to the Pages button when it was inside the list. ArrowUp and ArrowDown move focus
between name buttons (without wrapping); Return and Space on a name button open its page.

### Add page

Add page appends a new page named `Page <n>`, where `<n>` is the smallest whole number from 1 up that
no page is named exactly `Page <n>`, with a new UUID id, opens it (empty, its view `{0, 0, 1}`), and turns
its row into the **name field** with the name selected. Adding is one page step. Disabled (tooltip
`A board holds at most 50 pages.`) when the board has 50 pages, and when editing is not allowed.

### The name field

The row becomes a text input, 36 px tall, padding 0 10 px, 2 px `#1665d8` border, radius 8 px, 13 px
weight 500, accessible name `Page name`, focused with its whole text selected. Return or a pointer down
outside it **keeps** the typed name: leading and trailing white space removed, cut to its first 60 code
points, and trimmed again; a blank result, one equal to the current name, or one that is still not a valid page name (document v18,
for example holding a control character such as a tab) changes nothing, with no step; otherwise the page
is renamed (one page step). Escape keeps the current name. Then the row is a row again with focus on its name
button. Double-clicking a name button, or **Rename page** in its menu, opens the field for that page
(renaming does not open the page).

### The page menu

The options button opens a menu (`role="menu"`, accessible name `Page options`) 4 px under the button,
its left edge at the button's left edge (kept inside the window): 220 px wide, padding 6 px, background
`#ffffff`, 1 px `#d9dfe7` border, radius 12 px, shadow `0 12px 30px rgb(21 32 51 / 0.08)`, `z-index: 7`.
Text in the list's font stack, line height 1.45. Items are `menuitem` buttons 36 px tall, radius 8 px,
14 px weight 400, padding 0 10 px, no border, transparent fill, text `#1b2433`; hover and focus fill
`#eef1f5`; pressed fill `#d9dfe7`; a disabled item keeps full opacity, text `#525d6c`, and no hover fill;
each item spans the menu's full content width, its contents vertically centred, its label left-aligned
and taking the remaining width, and any note (such as `This page`) right-aligned 8 px after the label; separators are 1 px `#d9dfe7` with 6 px above and below and
4 px side margins. Items, in order:

1. **Rename page**: the name field (above).
2. **Duplicate page** (below).
3. separator
4. **Move up**: disabled on the first page.
5. **Move down**: disabled on the last page.
6. separator
7. **Delete page**, text `#a3302a`: disabled on a board's only page (tooltip
   `A board needs at least one page.`).

Every item is disabled while editing is not allowed. Double-clicking a name button then does nothing, and a
name field that is open when editing stops being allowed closes as Escape would. Opening the menu moves focus to its first enabled item;
ArrowUp and ArrowDown move between enabled items (wrapping), Home and End to the first and last, Return or
Space chooses, Escape closes the menu and returns focus to the options button. Choosing Rename page closes the menu and opens the field; choosing any other item closes the
menu **and the list**.

### Move up, Move down and dragging

Move up swaps a page with the page before it, Move down with the page after it; each is one page step.
A row can also be **dragged**: a pointer pressed on a name button and moved at least 4 px vertically
starts a drag (the click does not open the page); the dragged row is drawn at 50% opacity and a 2 px
`#1665d8` line, the list's content width, shows the gap it will go to (the gap nearest the pointer).
Releasing puts the page there (one page step; nothing when the place is unchanged); Escape or a
cancelled pointer ends the drag with no change. Dragging is not possible while editing is not allowed.
The open page stays open; its id never changes.

### Duplicate page

Inserts, right after the page, a new page named `<name> copy` (cut to its first 60 code points and trimmed again), with a
new id, holding a copy of every object on the page: new ids and generations; the same positions, sizes,
text, styles and order relative to each other; connectors, section membership, groups (a new group id
for each copied group) and mind-map parents pointing at the copies, as Duplicate's copies do; then opens
it. One page step. The notice reads `Duplicated page “<name>” as “<copy name>”.` Disabled when the board
has 50 pages (tooltip `A board holds at most 50 pages.`) or when the copy would take the board over 250
objects (tooltip `A board holds at most 250 objects.`), and while editing is not allowed.

### Delete page

Deletes the page and every object on it, **without asking**. One page step: one Undo restores the page,
its place in the list and every object with its logical id. When the deleted page was open, the page
before it in the list opens (the new first page when it was first). The notice reads:

- `Deleted page “<name>” and its <n> objects. Undo restores it.` (`its 1 object` for one object;
  `Deleted page “<name>”. Undo restores it.` for an empty page),
- followed by ` Now on “<name of the opened page>”.` when the deleted page was open.

## Move to page

On a local board with **two or more pages**, every variant of the selection bar has a **Move to page**
button, immediately before its Duplicate button (before its Delete button in a variant without
Duplicate): the shared selection-bar icon button (its hover, focus and disabled looks are the bar's
shared ones), accessible name and tooltip `Move to page`, `aria-haspopup="menu"`, `aria-expanded` while
its menu is open; while open its fill is `#dceafb` and its icon `#1665d8`. Icon: 20 × 20, `currentColor`
strokes 1.6, round caps and joins: a rectangle x 3.5, y 3.5, 9 × 11, radius 2, and the path
`M10 11 h7 m-2.5 -2.5 L17 11 l-2.5 2.5`. It is disabled with Duplicate's reason when Duplicate is
disabled, and with `Select an object to move.` when the moved set (below) is empty. On a board with one
page, and on hosted boards, there is no such button and the selection bar is exactly as today.

Its menu (`role="menu"`, accessible name `Move to page`) opens 8 px under the button, its left edge at
the button's left edge (kept inside the window), in the page menu's look, with a heading `Move to page`
(12 px, weight 600, line height 1.4, `#525d6c`, padding 6 10 4 px) and one item per page in page order; the open page's
item is disabled (`aria-disabled`, text `#525d6c`) and shows `This page` (12 px, weight 500, `#525d6c`)
at its right. Choosing a page moves the moved set there. Its keys are the page menu's: focus on its first enabled item
when it opens, ArrowUp and ArrowDown (wrapping), Home, End, Return, Space, and Escape closing it with focus
back on the button; they go no further. While the menu is open the selection bar is raised to `z-index: 6`, as it is today while its
arrange menu is open, so the menu draws above the notices row and the pages list. Under 768 CSS pixels
the open pages list (`z-index: 5`) may cover the find bar (`z-index: 4`); both stay usable once the list
closes. Neither the drag line nor the dragged row's ghost takes pointer events.

**The moved set.** Start from the objects Duplicate would copy for the selection (the selection with the
hidden descendants of collapsed mind-map nodes, the members of selected sections, and the connectors
whose two ends are both in it). Add, until nothing changes: every node of a mind map one of whose nodes
is in the set (its root and all its descendants); every object sharing a non-null `group` with an object
in the set; the members of every section in the set; every connector whose two ends are both in the set.
Then remove every connector whose two ends are not both in the set. If nothing is left, there is nothing
to move.

**Moving.** In one page step on the whole board: every object of the moved set gets the chosen page; each
keeps its id, generation, position, size, relative drawing order and every other value, except that an
object whose section is not in the set gets `section: null` (and `order` numbers close the gaps of deleted
connectors, document v18); every connector **not** in the set with exactly one end
in the set is **deleted** (as Delete deletes a deleted idea's connectors). The open page stays open and
its selection is cleared. The notice reads `Moved <n> objects to “<page>”. Undo moves them back.`
(`Moved <label> to “<page>”. Undo moves it back.` for one object, `<label>` as Delete's notice names
one object), followed by ` 1 connector to an object left on this page was removed.` or
` <k> connectors to objects left on this page were removed.` when connectors were deleted. While that
message is the notice, the notice holds a **Go to <page>** button (the notice's shared button look) that
opens the page; it disappears with the message.

## Undo and Redo

Every page step is one Undo step on local boards (opening a page never is). Each Undo step, page step or
not, remembers the page that was open when it was made (its **step page**). Undo and Redo apply the step
on the whole board; then, if the open page no longer exists, the page that was before it in the list
opens (the first page when it was first); then, if the step page exists and is not open, it opens. Every
opening here follows the opening rule. So Undo of Move to page puts the objects back with their previous
values and restores the deleted connectors, with their page open; Undo of Delete page restores the page
at its place with its objects (and opens it when it was the open page when deleted); Undo of Add page and
Duplicate page removes the page and opens the page that was open when it was added; Undo of a move
restores the order. Each page step marks the board Unsaved as any edit does; Save saves every page.

## Find on board with several pages

Find searches the displayed objects of **every page** (each page's objects as that page would display
them: mind-map layout and hidden nodes by the same rules). Results are ordered by **page order, then
reading order** within each page (interaction v42's rule), and the counter counts all of them.

- When the query changes, the current result is the first result **on the open page**; when the open
  page has none, there is no current result (`– of <m>`) and the view does not move.
- With no current result after a query change, Next goes to the first result on the first page after the
  open page that has one (wrapping to the first page), and Previous to the last result on the nearest page
  before it that has one (wrapping). Otherwise Next, Previous and the removed-place rule work on the whole
  ordered list as in v42, wrapping.
- Making a result on another page current **opens its page** (the opening rule: selection cleared, the
  page's view), then shows the result by the show rule.
- Rings and fading apply to the open page's objects: its results are ringed (orange for the current
  one), its non-results other than sections fade while nothing is selected.
- When the board has two or more pages and there is a current result, the bar's second row (where the
  removed line goes) reads `On page “<name of the current result's page>”`, in the same live region; the
  removed line takes the row's place while it applies. On a board with one page the bar is exactly as
  in v42.
- The current result stays current while it is still a result, wherever it is: opening another page
  from the list, or moving the result to another page, does not change it (the page line names its page,
  and Next and Previous go on from it).
- When the current result is removed and its page no longer exists, Next and Previous work as with no
  current result after a query change; otherwise v42's removed-place rule applies within the whole
  ordered list.
- Escape or Close find selects the current result when it is on the open page, and nothing otherwise.

## Navigation panel with several pages

When the board has two or more pages the Sections heading reads `Sections on this page`; the list holds
the open page's sections. Zoom to fit and Zoom to selection fit the open page's objects. With one page
the panel is exactly as in v42.

## Hosted boards

A hosted board shows no Pages button, no pages list and no Move to page button; find and the Navigation
panel behave as in v42. The room refuses page changes (document v18).

## Announcements

The notices above are the app's existing notice messages (`role="status"`). The pages list's rows are a
list, so assistive technology reads each row's position; the open page's row is `aria-current="page"`.

## Keys

No new board-wide shortcut. Inside the pages list and the menus: the keys above. Shift+1 and Shift+2
(v42) work on the open page.
