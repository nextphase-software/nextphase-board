# 0001 — Interaction and browser contract

Contract version: 44 (for 0010-W3 brief v1, 2026-11-16). Status: Draft. When accepted it replaces
[interaction v43](0001-interaction-v43.md) for later work. Uses [document v19](0001-document-v19.md).

Every rule in v43 (and, through it, v42 back to v4 and the 0001-W3 presentation) still applies except
where this version replaces or adds to it. This version brings **pages to hosted (team) boards**: v43's
whole pages behaviour now applies on hosted boards too, with the team rules below. v43's sections "Hosted
boards" and the hosted sentence of its opening are replaced. On local boards nothing changes.

## Pages on hosted boards

Everything in v43 about pages applies to hosted boards, word for word and with the same looks:
- the open page and opening a page;
- each page's view;
- which page a board opens on (the same `localStorage` key);
- the Pages button and list, the name field and the page menu;
- Move up, Move down and dragging;
- Duplicate page, Delete page and Move to page;
- Undo and Redo;
- find with several pages;
- the Navigation panel.

The exceptions follow.

**Who may make page steps.** An owner or editor makes page steps when editing is allowed (v43 "Words",
with a hosted board's own read-only reasons, as for Duplicate today). A **viewer** (or anyone whose
hosted board is read-only) opens pages but makes no page steps: see "The viewer's pages list".

**Undo and Redo on hosted boards** follow [sync v14](0003-sync-v14.md): each page step is one step of its
author's own history. Undo and Redo then open pages exactly as v43 says. Where someone else has since
changed what a step would change, that part is not undone and the existing notice
`Someone else changed that, so it was not undone.` shows.

**Another person's page steps** reach you as any other edit does ([sync v14](0003-sync-v14.md) origin
`remote`). Your list updates: rows are added,
renamed, reordered or removed in place, with no notice and no change to your open page, focus, open menu
or name field, except in these cases:
- **The page you have open is deleted by someone else.** The page that was before it in your list just
  before the change opens (the first page when it was first), by the opening rule. The notice reads
  `<label> deleted page “<name>”. You are now on “<page>”.`, where `<label>` is the presence label of the
  `update` frame's `connection`, or `Someone` when it is not known. When the open page disappears in a
  `reload` change (join, resync, recovery, restore, preview), the page before it opens with no notice; in
  an `own` change, v43's Undo and Redo rules apply. An open page menu, name field or drag for that page closes.
- **The page whose menu or name field you have open is deleted.** The menu or field closes; a typed
  name is not kept.
- **A page you are dragging is deleted.** The drag is cancelled.

**Disabled while a vote runs.** While a voting round runs on a page ([workshop voting v3](0007-workshop-voting-v3.md)):
- that page's **Delete page** is disabled with the tooltip `A vote is running on this page`;
- on that page, **Move to page** is disabled with the same tooltip.

## Who is on which page

**Avatars in the pages list.** Each row of the pages list shows the **other people** whose presence is
on that page ([presence v5](0004-presence-v5.md)). You are never shown, nor your other tabs. Each person
appears once however many tabs they have on that page.
- Each avatar is a 20 × 20 circle in the person's presence colour, holding the first character of their
  label, upper case, white, 11 px, weight 600, line height 20, centred, with a 2 px white ring
  (`box-shadow: 0 0 0 2px #ffffff`).
- Avatars are in the order of the file bar's avatars. From the second, each overlaps the one before by
  4 px (`margin-left: -4px`). At most **three** show; with more people, a fourth circle in `#525d6c`
  reads `+<n>` (11 px, weight 600).
- For an owner or editor the group sits 4 px before the row's **options slot**, the 32 px place of the
  "…" button, whether the button is showing (current row, hover, focus) or hidden. For a viewer, whose
  rows have no "…", it sits 6 px from the row's right edge. It is vertically centred in the 36 px row (its
  top 8 px below the row's top). It takes no
  pointer events and is not focusable.
- Its accessible name is `<label>, <label> on this page` (all the people, not only the three shown).
  Each avatar's `title` is the label.
- The row's name button keeps its full width up to the group; a long name ellipsises before it.

**The people menu.** In each other person's row, the existing second line (their role words) becomes
`<role words> · on <page name>` when their page is not your open page, and `<role words> · this page`
when it is. Your own row is unchanged. When a person's page is not known (no presence yet), the line
is as today.

**Cursors, selections and reactions** of people on another page are not drawn (presence v5). The
`Show other people's cursors` switch keeps its meaning for those on your page.

## Following someone to their page

Following a person (clicking their avatar or their row) or following a spotlight takes you to the page
they are on. Whenever the followed person's page is not your open page, that page opens by the opening
rule, then their view applies as today. Each such change while you follow shows the notice
`Following <label> to “<page name>”.` The existing follow frame and bar are unchanged. Stopping following
leaves you on the page you are on. While following you may still open the pages list; opening another
page yourself stops following, as moving the view yourself does today.

## The viewer's pages list

For a viewer, or while the hosted board is read-only for another reason:
- the Pages button and list show and work for opening pages;
- the list has **no Add page button and no "…" buttons**, on any row, hovered or not;
- double-clicking a name does not open the name field, dragging a row does nothing, and F2 does nothing;
- the header shows `View only` at its right, in place of Add page: 12 px, weight 500, line height 32,
  `#525d6c`, 8 px from the list's inner right edge;
- the avatars in the rows sit 6 px from each row's right edge;
- Move to page is never shown to them.

When a board turns read-only while the list is open, an open menu, name field or drag closes or cancels
at once.

## Comments on pages

Following [comments v5](0005-comments-v5.md):
- Placing a new comment hit-tests only the open page's objects.
- Pins show only for threads on the open page.
- The comments panel lists every page's threads. A thread on another page has ` · page <name>` after its
  location line's text (`On “<label>” · page Ideas`, `On the board · page Ideas`, or the detached line
  followed by ` · page Ideas`), in the same style.
- A thread whose page was deleted reads `On deleted page “<pageName>”` as its location line and has no
  pin; Move is not offered for it.
- Choosing a thread on another page opens that page by the opening rule, then selects and shows the
  thread as today.

## Voting on pages

Following [workshop voting v3](0007-workshop-voting-v3.md):
- **The new-vote form's** scope line reads `All eligible objects on this page (“<page name>”)` when the
  board has two or more pages, and `All eligible objects on this board` with one page, as today.
  **Start voting** is disabled when the open page has no eligible object, as it is today for the board.
- **While a round runs** and your open page is not its page, the voting card shows the existing question
  line and the lines it shows today for your state, then the line `This vote is on page “<page name>”.`
  (the card's existing status style), then a full-width primary button **Go to <page name>** (the card's
  existing primary button look, with `margin-top: 8px` added to the card's existing 8 px gap, 16 px in
  all). For an owner or editor who has a ballot, the existing lines are the remaining votes, and the
  button opens the page by the opening rule and then does what Enter voting does today; the card shows no
  Enter voting button or ballot controls. For a viewer (`Voting in progress. Only owners and editors can
  vote.`) or a participant past the limit (`This voting round has reached its participant limit.`), the
  existing line stays and the button only opens the page. End and reveal stays for owners and editors.
- If the round's page no longer exists, the line reads `This vote's page was deleted.`, with no Go to
  button.
- **Markers** draw only on the round's page.
- **A revealed result** naming an object on another page opens that page by the opening rule before
  showing the object.

## Templates

Saving a team template with nothing selected follows [team templates v2](0008-team-templates-v2.md).
Inserting a template or activity puts it on the open page (v43).

## Announcements and keys

The new notices are the app's existing notice messages (`role="status"`). The `View only` text is plain
text in the list's header. No new keys: v43's keys apply, without the page-step keys for viewers.
