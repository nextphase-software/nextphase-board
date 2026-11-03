# 0003 — Hosted boards in the web app

CONTRACT VERSION: 0003 hosted storage v3 (2026-11-02)

Status: Draft for 0003-W5 v1. When accepted it replaces
[hosted storage v2](0003-hosted-storage-v2.md) for later work. Every rule of v2 (and through it
v1) still applies except where this version changes it. It adds **Home**, the page that lists a
signed-in person's hosted boards, and lets owners and editors **rename** a hosted board, from
Home and from the open board. Where each control appears, its look and its words are in
[interaction v28](0001-interaction-v28.md); where the modules live is in
[web modules v27](0001-web-modules-v27.md). The server's side is unchanged: every call below is a
route of [API v4](0003-api-v4.md), and [access v4](0003-access-v4.md),
[sync v4](0003-sync-v4.md), [hosted persistence v3](0003-hosted-persistence-v3.md) and
[presence v1](0004-presence-v1.md) still govern the server, the room and the shared client.

With team features off nothing here applies: the page ignores the address's fragment as v1 says,
so `#/files` opens the local board, and no request is made.

## Links

v1's table gains two forms. `<uuid>` is a lower-case UUID, as in v1.

| Form | Means |
| --- | --- |
| `#/files` | Home: **Recents** |
| `#/files/<workspace>` | Home: workspace `<workspace>`'s page |
| `#/b/<board>` | Open hosted board `<board>` (v1) |
| `#/invite/<invitation>` or `#/invite/<invitation>?board=<board>` | Accept an invitation, then open a board (v1) |

Any other fragment that starts with `#/` is a **bad link**, as in v1: `#/files/`,
`#/files/<workspace>/`, `#/files/<workspace>?sort=title`, a workspace that is not a lower-case
UUID, and `#/files?x` all are. Any other fragment, and no fragment, opens the local board.

## Leaving a hosted board

v1's sentence "**Close this board** sets the fragment to empty and opens the local board as at
load" is replaced: **Close this board**, wherever it appears (the pages and the dialogs that end
a board), and **Back to files** on a hosted board, stop the hosted board (its room connection is
closed with code 1000, its retries stop and nothing it reports later is shown) and then set the
fragment to `#/files`, which shows Home. An invitation link with no board to land on (v1,
"Links") still opens the local board.

**Back to files** on a local board sets the fragment to `#/files` too. When the local board has
unsaved edits it first asks the existing unsaved-edits question (interaction v20, "The
unsaved-edits question"), with **Recents** as the target's name; Discard changes and a saved
Save and open then go to Home, and Cancel stays.

While Home is shown the page has no room connection: every hosted board left for Home has been
stopped first.

## Home

Home is shown for `#/files` and `#/files/<workspace>` when team features are on.

1. **Before Auth has reported** whether a session exists, Home's page shows "Loading boards…".
2. **Signed out**, the gate is shown (interaction v28, "Home signed out"); after sign-in, Home.
   When Auth reports `SIGNED_OUT` while Home is shown (this tab's Sign out or another tab's),
   the gate is shown.
3. **Signed in**, Home reads, at the same time:
   - `GET /workspaces`, for the sidebar, the page's name and who may create; and
   - on Recents, `GET /recent-boards`; on a workspace page,
     `GET /workspaces/<workspace>/boards?sort=<sort>&order=<order>` with the page's current sort
     and order (at first `edited` and `desc`).

### What Home shows from the answers

- **Cards appear only when both reads answered 200.** Until then the body shows "Loading
  boards…" and no card.
- **A workspace page whose board read answers 404** (whatever the workspace read answers, and
  in whichever order they arrive) shows "This workspace doesn't exist, or you
  don't have access to it." and no card, no sort button and no New board.
- **Any other failure** of either read (any other status, including 401, or no answer within v1's 15 seconds)
  shows the failure state (interaction v28) and no card: never an empty list, a part of a list
  or the cards of an earlier answer. If `GET /workspaces` answered 200, the sidebar lists its
  workspaces; otherwise the sidebar shows Recents and Boards in this browser only. **Try again**
  reads both again from the first page.
- The cards are the board rows in the order the server sent them. Home never sorts, filters or
  reorders rows itself, never adds a row the server did not send, and never shows a row of an
  earlier route, sort or order: an answer to a request made for another page, sort or order is
  ignored when it arrives.

### Pages of a workspace's boards

A workspace page reads the next page (the same query with `&cursor=<nextCursor>`, the cursor
encoded as a URI component) when its last card comes into view inside Home's body and the last
answer's `nextCursor` is not `null`; one page is read at a time. Pages are joined by board ID: a
row whose ID is already shown replaces that card's data in its first position, and a new ID is
added at the end. A later page that fails clears every card and shows the failure state; Try
again starts again at the first page. Recents is the server's newest 50 with no cursor and is
never paged.

Changing the sort or order reads the workspace's boards again from the first page. The sort and
order are not kept: each workspace page opens with Last modified, newest first.

### Creating a board

**New board** sends `POST /workspaces/<workspace>/boards` with the body `{}` (the board is named
"Untitled"), and on the 201 sets the fragment to `#/b/<id>`, opening the new board in the same
tab as v1 says. One creation runs at a time: New board is unavailable while one is pending. A
refusal or no answer shows the toast "Couldn't create that board: <reason>." and nothing opens.

The workspace is the page's own on a workspace page. On Recents it is the only workspace whose
`role` in `GET /workspaces` is `owner` or `editor`; with several such workspaces the person
chooses one from the "New board in" menu (interaction v28); with none, New board is not shown.

A new board is listed on its workspace page at once. It enters Recents when it is opened (API
v4, "Opening": recorded when its join ticket is issued, best effort).

## Renaming

A board's name can be changed by its workspace's owners and editors, and by a guest whose board
grant is `editor`: everyone whose `role` on the board is `owner` or `editor`. There are two
paths, and neither sends the other's request.

- **From Home** (which has no room connection): `PATCH /boards/<board>` with `{ "title": <name> }`.
  A 200 means the room saved the edit (API v4, "Renaming"). A refusal or no answer puts the card's
  previous name back and shows the toast "That name wasn't saved: <reason>.". A name that is
  empty or only white space sends nothing and keeps the previous name. A name equal to the card's
  current name sends nothing.
- **Inside a hosted board**: v1's rule "The board's title is not editable on a hosted board" is
  withdrawn. For an owner or editor with an open connection, the Board panel's name field is
  editable and a change to it is an edit of the board document like any other (v1, "Editing and
  saving"): its `title` changes, it is sent through `BoardSession.edit`, saved or refused as any
  edit is, and broadcast to the other connections. A refused name edit is taken back and shows
  v1's refused-edit toast. For a viewer, and while the board is view only, the field stays
  read-only; a viewer's edit that reached the room would be refused (`role_too_low`).
- **One undo step per name entry.** On a hosted board, every change made in the name field from
  the moment it gets focus until it loses focus is sent with one group (sync v4, "Grouped
  edits"), a new group for each entry, as typing in one note already is (v1). One Undo takes the
  whole entry back. A local board's name field is unchanged.
- **The field follows the board.** When an `update` changes the board's title (someone else's
  edit, or a rename from Home), the name field shows the new title.

The lists' copies of a name follow a save rather than come with it (API v4, "Boards"; hosted
persistence v3, "Names and edited times in lists"), so Home holds the names the person set.

### Held names

The page keeps, in memory only, a **held name** per board: the name the person set, the **names
it replaced**, and when it was held.

- A Home rename holds its name when the PATCH is sent; it replaced the card's name when Rename
  began. A refusal removes it. A 200 keeps it, with the reply's `title`.
- A name entry inside a hosted board holds its name when the hosted board's state becomes
  **Saved** with a title different from the title of its previous Saved state (at the first, the
  title in its `joined`); it replaced that previous title and every other title this tab sent in
  a name edit since that previous Saved state (edits can be saved while later ones are still
  pending, so the lists may have copied any of them).
- A newer held name for a board replaces the older one and also keeps every name the older one
  replaced, and the older name itself, as names it replaced. So after A, B and C are saved in
  turn, C is held and A and B are names it replaced.

Wherever Home shows a card for a board with a held name, the card shows the held name instead of
the row's title, until the held name is **released**. It is released when a list answer shows the
row with the held name (the list caught up), when a list answer shows the row with a name that is
neither the held name nor one of the names it replaced (someone renamed it since), when 120 seconds have
passed since it was held (checked whenever Home draws a list; a held name is shown only while
younger than 120 seconds), on sign-out, and on a reload. A held name never adds a card, never
shows a board the list does not list, and never changes a card's edited time or position.

## What the page keeps on the device

v2's section applies unchanged: Home adds no `localStorage`, `sessionStorage` or IndexedDB key
and keeps no list or board on the device. The held names, the lists and the sort are in memory
only.

## Messages

v1's table applies, with these added (interaction v28 says where each appears):

| Name | Words |
| --- | --- |
| Loading | "Loading boards…" |
| List failed | "Couldn't load your boards", then "Board's server didn't answer. Try again in a moment." |
| Workspace not found (404) | "This workspace doesn't exist, or you don't have access to it." |
| Rename refused | "That name wasn't saved: <reason>." |
| Creation refused | "Couldn't create that board: <reason>." |
| Link copied | "Link copied" |
| Link not copied | "Couldn't copy the link. Try again." |

`<reason>` is the reply's reason with each `_` replaced by a space, or "no answer" when no reply
came.

## Verification

The 0003-W5 brief's unit tests and browser checks cover this version: the routes, the reads and
their failures, paging, creation, both rename paths and their undo step, held names, leaving a
board for Home, and nothing changing with team features off. The 0003-W4 and 0004-W3 briefs'
checks still cover v1 and v2, with the 0003-W5 brief's amendment of W4-S10 to W4-S12 (closing a
hosted board lands on Home).
