# 0003 — Hosted boards in the web app

CONTRACT VERSION: 0003 hosted storage v5 (2026-11-03)

Status: Draft for 0005-W1 v1. When accepted it replaces
[hosted storage v4](0003-hosted-storage-v4.md) for later work. Every rule of v4 (and through it
v3, v2 and v1) still applies except where this version changes it.

This version adds **comments** to hosted boards: comment mode, pins, the composer, the thread
card, the comments panel, resolving, and what the app does with each answer from the room. It
also changes one rule of v1 and v4: a **view-only toolbar is Select, Pan and Comment** ("The
toolbar"). Where each part appears, its look and its keys are in
[interaction v30](0001-interaction-v30.md); the module layout is
[web modules v28](0001-web-modules-v28.md). The server's side is [sync v6](0003-sync-v6.md),
[access v5](0003-access-v5.md), [hosted persistence v4](0003-hosted-persistence-v4.md) and the
[comments contract](0005-comments-v1.md); [API v4](0003-api-v4.md),
[identity v3](0003-identity-v3.md) and [presence v1](0004-presence-v1.md) are unchanged.

With team features off nothing here applies, and a local board has no comments.

## The toolbar

v1's and v4's view-only toolbar ("the toolbar shows only Select and Pan") is replaced: on a hosted
board that is **view only** (a viewer; no open connection; or recovering, v4 "When editing comes
back") the bottom toolbar shows **Select**, **Pan** and **Comment**, and nothing else. An editor's
or owner's editable toolbar gains **Comment** at its end. When a board turns view only, the armed
tool becomes Select as before, unless it is Comment, which stays.

## Comment mode

- **Comment mode** is on while the Comment tool is the armed tool. **C** arms it; pressing the
  Comment button arms it, or, when it is already armed, arms Select. Any other tool or its key
  leaves comment mode, as does Close in the panel. **Escape** first closes an open menu, then the
  composer or the thread card, and only then leaves comment mode for Select.
- Entering comment mode empties the selection and ends any text editing. In comment mode, objects
  cannot be selected, moved or edited: a primary-button press on the board opens the **composer**
  at that point instead (comments contract, "What a comment attaches to"); wheel, pinch and Space
  drag still move the view. While the pointer is over an object a comment would attach to, that
  object is outlined. There are no region comments.
- The **comments panel** shows only in comment mode.

## Pins

Every thread the filters show ("The panel and its filters") has a **pin** on the board at its
point (comments contract, "Anchors"), in every tool, comment mode or not, unless pins are hidden.
**Shift+C** hides or shows every pin; hidden pins stay listed in the panel, and the composer and
card still open. Pins start shown each time a board opens.

- A pin on an object follows the object as the tab's own board draws it: the person's own drag,
  resize or nudge moves their pins live; another person's move reaches the pin when that move is
  saved and arrives, together with the object.
- While the tab's board lacks the object of an attached thread (the person deleted it, or an
  `update` removed it) and no frame has detached the thread yet, the pin stays where it was last
  drawn and is drawn detached. The room's frame then decides (sync v6): a refused delete brings
  the object back and the pin follows it again.
- Clicking a pin, or Enter on a focused pin, opens its thread's card. The **author** of a thread
  can drag its pin to a new place, and move it with the arrow keys (interaction v30); either sends
  `move` with the anchor at the new place. A drag that moves less than 4 pixels is a click. Other
  people's pins do not move by drag.

## The composer

A press on the board in comment mode places a **new pin** at that point and opens the composer
beside it, with the field focused. The composer starts a thread:

- **Post** is available when the field holds text that is not empty, at most 4,000 code points
  (comments contract, "Text"), the board is connected with its comments loaded (`commentsReady`),
  and no comment request of this composer is in flight. Enter posts; Shift+Enter starts a new
  line; Enter while an input method is composing does neither.
- Past 4,000 code points the count shows under the field ("Messages") and Post is off.
- Posting sends `start` with new thread and comment IDs and the anchor at the new pin. While its
  request is `sent` or `unconfirmed`, the field is **read only** (its text is exactly what was
  sent) and Post is off; Retry is the only way to send it again. When it is saved, the composer
  closes and the new thread's card opens with its reply field focused. When it is refused for any
  reason but `thread_deleted` and `comment_deleted`, or Retry answers that it cannot be sent
  again, the field is editable and Post follows the rules above; a later Post is a new request.
  After `thread_deleted` or `comment_deleted` the field stays read only ("The thread card").
- The same holds for the card's reply field and for an edit's field.
- A press elsewhere on the board in comment mode moves the new pin there and keeps the typed
  text. Escape, Close or leaving comment mode closes the composer and its text is gone.

## The thread card

Opening a thread shows its **card**: the header (More for the thread's author only, Resolve or
Reopen, Close), its comments oldest first, each with its author, time and text, and a **Reply**
field with Post. Post follows the composer's rules and sends `reply`; once saved, the field
empties and keeps focus. A reply to a resolved thread reopens it (comments contract).

- **A comment's More** ("…") shows only on the person's own comments, with **Edit** and **Delete
  comment**. Edit turns the text into a field with **Cancel** and **Save** (Save follows Post's
  rules and sends `edit`); once saved the time reads "<time> · edited".
- **The thread's More** shows only to the thread's author, with **Delete thread…**.
- **Deleting asks first** ("Messages"): Delete thread… and Delete comment on the first comment ask
  the thread question and send `delete_thread` or `delete_comment`; Delete comment on a reply asks
  the comment question and sends `delete_comment`. Cancel and Escape send nothing.
- **Resolve** sends `resolve`. When the person's own resolve is saved, the card closes, the pin and
  the list item leave (unless resolved threads are shown) and the toast "Thread resolved" shows
  for 5 seconds with **Undo**, which sends `reopen`. **Reopen** (shown on a resolved thread) sends
  `reopen`.
- **Someone else resolves** the open thread: the card stays open with its typed text, and shows
  the resolved note ("Messages") above the reply field (the unnamed resolved note when the
  resolve came in a snapshot, which says nobody's name); the pin and list item leave as for an own
  resolve (unless resolved threads are shown). No toast. A reply then reopens the thread.
- **When the open thread is gone** (someone deleted it, a refusal says so, or a snapshot, once
  `done`, lacks it): if any field of the card holds text (the reply field or a comment's edit
  field) or a request of the card is `sent` or `unconfirmed`, the card stays with the
  thread-deleted note (naming the person when a frame with `by` said who, otherwise the gone
  note) and no comment rows, and keeps every typed text, read only, with Post and Save off: an
  edit's text in a field named "Unposted edit" under the note, then the reply field with its own
  text (empty if none). Otherwise the card closes and focus goes to the canvas.
- **When a comment being edited is gone** and its thread is not: the comment-deleted note takes
  the comment's place with the typed edit, read only; Save is off.
- **A detached thread's card** shows the detached note above its comments; the list item shows
  the detached line instead of "On …".

Only one composer or card is open at a time. Opening another closes the first; typed text in it is
gone.

## The panel and its filters

The **Comments** panel lists the threads the filters show, by the sequence that started them,
oldest first. Each item shows the author, the time of the first comment, its text, what the thread
is on ("On “<label>”", "On the board", or the detached line) and, when there are replies or it is
resolved, the count line. Choosing an item opens its card and moves the view so its pin is in view:
the view's centre goes to the pin (left of centre by 140 pixels when the window is at least 768
wide, so the card and panel do not cover it); the zoom is kept.

- **Filter** opens a menu with two choices, each ticked when on and both off when the board opens:
  **Show resolved comments** (resolved threads are listed, marked resolved, and their pins are
  drawn faded) and **Only your threads** (threads the person started or replied to, by person
  key).
- With nothing to list, the panel shows the first of these that applies ("Messages"): with Only
  your threads on, its empty words; else with Show resolved comments on, "No resolved threads.";
  else the empty panel's words.

## Answers from the room

| Answer | What the app does |
| --- | --- |
| `comment_saved` | As each part above says |
| `comment_refused` for an action with text (`start`, `reply`, `edit`) | The note for its reason shows in the composer or card; the text stays in its field; Post or Save is available again, except after `thread_deleted` and `comment_deleted` ("The thread card") |
| `comment_refused` for any other action | The note for its reason shows in the toast's place as an alert, with **Dismiss** |
| No answer (the request becomes `unconfirmed`, sync v6) for an action with text | The unconfirmed note shows with **Retry** while the board is connected; the text stays. Retry sends it again (`retryComment`). When the session answers `access_changed`, the note becomes the not-retryable note and Post is available again for a new request |
| No answer for any other action | Nothing is sent again; the thread shows as the room's next snapshot or change has it |

While the board has no open connection, or before its comments are loaded, every comment control
that sends is off and the offline note shows in an open composer or card, with any typed text
kept. **Nothing is queued**: the app never sends a comment by itself after a rejoin.

When a rejoin's or retry's snapshot, once `done`, lacks the open card's thread (for example after
a restore), the card follows "When the open thread is gone".

## Comments and the rest of the board

- Comment requests are not **changes** (v4, "Counting changes"): they never count as waiting,
  never change the save state, never add to a not-saved notice and never raise the leave question.
  Leaving the board with an unposted comment loses it without asking.
- Comments are never undone by Undo or redone by Redo, and never change the board's lists.
- The endings of v1 to v4 (access removed, signed out, sign-in expired, account disabled, board
  closed) end comments too, with no new words.
- Nothing about comments is kept on the device: threads, filters, hidden pins and typed text are
  in memory only.

## Messages

v4's table applies, with these added. `<name>` is the label sent with the change (sync v6, `by`);
`<label>` and `<type>` are the comments contract's object label and type word.

| Name | Words |
| --- | --- |
| Comment tool (tooltip) | "Comment C" |
| Composer placeholder | "Add a comment" |
| Reply placeholder | "Reply" |
| Panel title | "Comments" |
| Panel empty | "No comments yet. Click a sticky, shape or empty spot to start a thread. Press Esc to stop commenting." |
| Panel empty, Only your threads | "No threads you started or replied to." |
| Panel empty, Show resolved comments | "No resolved threads." |
| On an object | "On “<label>”" |
| On a board point | "On the board" |
| Detached (list) | "Detached: “<label>” was deleted" |
| Detached (card) | "Detached. The <type> “<label>” was deleted; this thread stays where it was." |
| Reply count | none for 0 replies; "1 reply"; "N replies"; resolved adds " · Resolved" ("2 replies · Resolved", or "Resolved" alone) |
| Edited | "<time> · edited" |
| Times | "Just now" (under a minute), "N min ago" (under an hour), "1 hour ago", "N hours ago" (under 24 hours); then by calendar days in the browser's time zone: "Yesterday", "N days ago" (2 to 6), then the date ("Oct 28"; "Oct 28, 2025" in another year), in English |
| Too long | "N / 4,000" (N with a thousands comma, for example "4,012 / 4,000") |
| Offline | "You're offline. Your reply stays here; post it when the board is back." |
| Resolved by someone else | "<name> resolved this thread. Replying reopens it." |
| Resolved by someone else, name unknown (seen in a snapshot) | "This thread was resolved. Replying reopens it." |
| Thread deleted, text kept | "<name> deleted this thread, so your reply wasn't posted. Your text is kept below." |
| Thread gone, text kept (no name known) | "This thread was deleted, so your reply wasn't posted. Your text is kept below." |
| Thread deleted (no text) | "This thread was deleted." |
| Comment deleted while editing | "This comment was deleted, so your edit wasn't saved. Your text is kept below." |
| Comment limit | "This board has reached its comment limit." |
| Rate limit | "You're commenting too fast. Try again in a few minutes." |
| Access changed | "Your access changed, so this wasn't saved." with " Your text is kept below." when there is text |
| Object deleted before posting (`anchor_deleted` for `start`; for `move` the "Any other refusal" words) | "The object you clicked was deleted, so your comment wasn't posted. Your text is kept below." |
| Any other refusal | "Something went wrong, so this wasn't saved." with " Your text is kept below." when there is text |
| Unconfirmed | "Your comment may not have been posted. Your text is kept below." and **Retry** |
| Not retryable | "Your access or the board changed, so this can't be sent again. Check the thread before posting it again." |
| Resolve toast | "Thread resolved" and **Undo** |
| Delete thread question | Title "Delete this thread?"; body "This deletes the comment and its N replies for everyone. You can't undo this." ("…and its 1 reply…"; with no replies "This deletes the comment for everyone. You can't undo this."); buttons **Cancel** and **Delete thread** |
| Delete comment question | Title "Delete this comment?"; body "You can't undo this."; buttons **Cancel** and **Delete comment** |
| Edit buttons | **Cancel**, **Save** |
| Menu items | **Edit**, **Delete comment**, **Delete thread…**; filter **Show resolved comments**, **Only your threads** |

"Access changed" is for `no_access` and `epoch_changed`; the board's own access handling (v1)
follows the room's close.

## Verification

The 0005-W1 brief's unit tests, server checks and browser checks cover this version. The 0004-W2
brief's checks still cover v4, with the 0005-W1 brief's amendment of the four checks that list the
view-only toolbar (W2-S1, W2-S13, W2-S14 and W2-S20).

## Public references

v4's references apply. Retrieved 2026-11-03: [MDN: `KeyboardEvent.isComposing`](https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/isComposing).
