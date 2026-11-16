# 0005 — Comments contract

CONTRACT VERSION: 0005 comments v5 (2026-11-16)

Status: Draft for 0010-W3 v1. Replaces [comments v4](0005-comments-v4.md), whose ranges, limits, IDs,
authorship, pins, ordering, rates, mentions, lifecycle and restore rules remain word for word except as
below. A hosted board may now hold several pages ([document v19](0001-document-v19.md)), so **every
thread belongs to a page**. [Interaction v44](0001-interaction-v44.md) owns the looks and words.

## The anchor's page

The anchor sent with `start` and `move` gains a sixth key, **`page`**, a lowercase UUID:
`{x, y, objectId, u, v, page}`. The room refuses the operation with `bad_anchor` when:
- `page` is missing or is not a lowercase UUID;
- `page` is not one of the board's current pages;
- `objectId` is not null and that object's `page` is not `page`.

The existing checks (`bad_anchor`, `anchor_deleted`) run first and are unchanged.

The **stored** anchor gains `page` and **`pageName`** (the page's name when the anchor was last written)
beside its existing keys (`x`, `y`, `objectId`, `u`, `v`, `detached`, `objectLabel`, `objectType`).
Threads in the snapshot, `comment_changed` and history frames carry it as stored. A stored anchor without
`page` (written before this version) is read as being on the board's first page, with that page's name.

## Keeping anchors on edits

The existing `keepAnchors` step, inside each accepted edit's transaction, also keeps the page:
- **An anchor attached to an object** takes the object's page and that page's name. If the object moves
  to another page, the anchor's `page` changes with it.
- **A point anchor** (`objectId` null), or a **detached** one, keeps its `page`. Its `pageName` follows
  renames while the page exists.
- **When a page is deleted**, every thread whose anchor is on it keeps that `page` and its last `pageName`.
  Object anchors on it detach as today, because their objects are deleted with the page. In that edit the
  room sends `comment_changed` for **every thread on the deleted page**, whether or not its stored anchor
  changed, carrying the stored anchor with the authoritative last `pageName`. Anchor updates that only
  follow a rename or a move are stored without a frame, as position updates are today; a client therefore
  names an existing page from the board's pages, never from `pageName`.

Nothing about a thread is deleted with a page. When the page comes back (Undo, or a restored version),
threads with that page are on it again: point and detached anchors at their stored point, as today's
detached pins are.

## What a client shows

- A thread's page is its object's page while the anchor is attached and the object exists; otherwise
  it is the anchor's `page`.
- **New comments** hit-test only the open page's objects (`anchorAt` is given the open page's objects),
  and send the open page as `page`.
- **Pins** are drawn only for threads on the open page.
- **The comments panel** lists the threads of every page, ordered and filtered as today.
  - A thread on another page that exists adds ` · page <name>` to its location line.
  - A thread whose page no longer exists reads `On deleted page “<pageName>”` as its location line,
    and has no pin. It can be read, replied to, edited, resolved, reopened and deleted as today; `move`
    is not offered for it.
  - Choosing a thread on another page opens that page (interaction v44's opening rule), then shows
    the thread as today.

No table, column, receipt, rate or mention rule changes. The anchor is stored in the existing
`threads.anchor` text.
