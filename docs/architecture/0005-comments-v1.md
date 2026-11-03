# 0005 — Comments contract

CONTRACT VERSION: 0005 comments v1 (2026-11-03)

Status: Draft for 0005-W1 v1. New. It defines comments on a hosted board: what a thread and a
comment hold, where they are stored, how a thread is anchored to an object or a board point, the
actions people take, the order the room saves them in, the limits, and what a client keeps. The
messages that carry them are in [sync v6](0003-sync-v6.md), "Comments"; who may take each action
is in [access v5](0003-access-v5.md); the tables, the storage version and backups are in
[hosted persistence v4](0003-hosted-persistence-v4.md); what the web app shows is in
[hosted storage v5](0003-hosted-storage-v5.md) and
[interaction v30](0001-interaction-v30.md).

Comments live **beside the board, not in it**. They are never part of the board's Yjs document,
its saved edits, its revision, its undo and redo, its canonical JSON, its export, a board file
([board file v2](0006-board-file-v2.md)) or a local board ([document v11](0001-document-v11.md)
and [storage v3](0001-storage-v3.md) are unchanged). A comment action never changes the board's
`revision`, its `last_edit_at`, the lists' edited time, or the web app's save state. Comments
exist only on hosted boards; with team features off nothing here applies.

## Threads and comments

A **thread** is a place on the board with an ordered list of comments. Its first comment is the
one that started it; the others are **replies**. A thread is **open** or **resolved**.

| Thread field | Meaning |
| --- | --- |
| `id` | A lower-case UUID the client chooses when it starts the thread |
| `person` | The author's person key on this board ([presence v1](0004-presence-v1.md), "What the room stamps") |
| `label` | The author's label when the thread was started ([identity v3](0003-identity-v3.md), "Labels") |
| `anchor` | Where the thread is ("Anchors") |
| `resolved` | `true` or `false` |
| `createdAt`, `updatedAt` | Milliseconds since 1970 by the room's clock: when the thread was started, and when an action last changed it |
| `sequence` | The comment sequence of the action that started it ("Order") |
| `firstComment` | The ID of the comment that started it |

| Comment field | Meaning |
| --- | --- |
| `id` | A lower-case UUID the client chooses |
| `threadId` | Its thread |
| `person`, `label` | The author's person key and label when the comment was posted |
| `text` | Plain text ("Text") |
| `createdAt` | When it was posted (room's clock) |
| `editedAt` | When its text was last edited, or `null` |
| `sequence` | The comment sequence of the action that posted it |

The room stores the author's account ID beside each thread and comment, to decide who may edit or
delete it, and **never sends it**: a client sees only the person key and the label, as presence
shows them. A label is kept as it was when the comment was posted; a later renewal or change of
email does not rewrite it.

A thread or comment ID is used once on a board, ever: an ID that a thread or comment of the board
has used, even one since deleted, is refused (`identifier_reused`).

## Text

Text is plain: no formatting, links, mentions, emoji picker or images. It may hold any Unicode
character except a control character (U+0000 to U+001F and U+007F to U+009F) other than tab
(U+0009) and line feed (U+000A), and it must be well formed (no lone surrogate). Before sending,
the client turns each carriage return followed by a line feed, and each other carriage return,
into a line feed, and replaces each lone surrogate with U+FFFD; the room refuses text that still
breaks these rules with `bad_message`.

- Text whose only characters are spaces, tabs and line feeds (Unicode `White_Space`) is **empty**:
  refused with `empty_text`.
- Text longer than **4,000 code points** is refused with `too_long`. Length is counted in code
  points (an emoji made of one code point counts 1; a sequence of several counts each).
- Text is kept exactly as sent, leading and trailing spaces and line feeds included.

## Anchors

A thread's anchor is a JSON object:

| Field | Meaning |
| --- | --- |
| `objectId` | The object the thread is attached to, or `null` for a board point |
| `u`, `v` | For an attached thread, the pin's place inside the object's saved box as fractions of its width and height, each from 0 to 1; 0 and 0 for a board point |
| `x`, `y` | The last board point of the pin (board coordinates) |
| `detached` | `true` once the object it was attached to was deleted; never `false` again |
| `objectLabel` | How the object was named when the room last stamped it ("Naming the object") |
| `objectType` | The object's type word ("Naming the object"), or `""` for a board point |

**The pin's point.** For an attached thread whose object is on the board, the pin's point is
`(object.x + object.width × u, object.y + object.height × v)`, from the object's saved box (its
`x`, `y`, `width` and `height` in the document; a note's display-only growth is not part of it).
It therefore follows every move, nudge, align and resize of the object, and every undo or redo of
one. For a board point, and for a detached thread, the pin's point is `(x, y)`. The pin's point is
the pin's **anchor corner**: its pointed bottom-left corner (interaction v30).

**What a comment attaches to.** Placing a comment at a board point P attaches it to the topmost
object that has a box ([document v11](0001-document-v11.md): sticky, shape, text, drawn stroke,
section and image) and whose saved box holds P, borders included. Topmost means the highest
drawing band, then the highest `order`, as the board draws them. A group has no box of its own:
a comment on a grouped object attaches to that object. A connector has no box and is never
attached to: when the topmost object under the pointer, as the board's own pointer hit test finds
it for Select (its drawn line and ends, with that test's tolerance), is a connector, the click
makes a **board point**, even where a box under the connector holds P; so does a point that no box
holds. The web app decides this when it places or moves a pin and sends the anchor; the shared
rule (`anchorAt`) takes whether the point is on a connector as an input. A section's title, drawn outside its box,
is not part of it. On an attached thread, `u = (P.x − object.x) / object.width` and
`v = (P.y − object.y) / object.height`, each clamped to 0–1.

**Naming the object.** The type word is `sticky`, `shape`, `text`, `drawing` (a stroke),
`section` or `image`. The object's label is its text (the first 120 UTF-16 code units, each line
feed and every other control character replaced by a space) or, when it has no text or only white space, its type word with a
capital letter (`Sticky`). The room stamps `objectLabel` and `objectType` from its own board when
a thread is started or moved onto an object, and again when it detaches the thread, from the
object as it was just before the deletion. While a thread is attached, the web app names the
object from the live board instead, so a renamed sticky shows its new text.

**Detaching.** When a saved edit removes the object an open or resolved thread is attached to
(deleted by anyone, removed by an undo of its addition, or removed with a section or a group),
the room, **in the same storage transaction that saves the edit**, sets the thread's `x` and `y`
to the pin's point on the board **before** that edit, sets `detached` to `true` and stamps the
object's label and type word as they were. After every other saved edit that moves or resizes an
attached thread's object, the room stores the pin's point on the board after the edit as `x` and
`y` in the same transaction. The room works from its own saved boards, never from a place a
client reports. A detached thread keeps its replies and its state, stays at `(x, y)`, and never
attaches to any object again: not when undo brings the object back (hosted undo brings it back
with a new ID, [sync v4](0003-sync-v4.md), "Bringing an object back"), not when an object with
any ID is later at that point. Its `objectId` stays as it was, and nothing looks it up again.

**Restores are the exception.** A restore of the room ([hosted persistence v4](0003-hosted-persistence-v4.md))
puts back the board and its comments together, as they were at that point: a thread detached
after the backup is attached again in the restored room, because the restored board holds its
object. Board undo, redo and a board file never do this.

## Actions

| Action | Who ([access v5](0003-access-v5.md)) | What it does |
| --- | --- | --- |
| `start` | owner, editor, viewer | Starts a thread at an anchor, with its first comment. The thread is open |
| `reply` | owner, editor, viewer | Adds a comment at the end of the thread. A reply to a resolved thread **reopens it** |
| `edit` | the comment's author only | Replaces the comment's text and sets `editedAt` |
| `delete_comment` | the comment's author only | Deletes the comment. Deleting a thread's **first** comment deletes the whole thread with every reply |
| `delete_thread` | the thread's author only | Deletes the thread with every comment in it |
| `resolve` | owner, editor, viewer | Marks the thread resolved. Resolving a resolved thread saves and changes nothing else |
| `reopen` | owner, editor, viewer | Marks the thread open. Reopening an open thread saves and changes nothing else |
| `move` | the thread's author only | Moves the pin to a new anchor, by the rules of "What a comment attaches to". A detached thread stays detached at the new point, keeps its object's label and type word, and never attaches |

"Author" means the account that posted the comment or started the thread, by the stored account
ID, not by label. Nobody else, the board's owner included, edits, deletes or moves another
person's comment or thread. A deleted thread or comment is gone for everyone and cannot be
brought back by undo; only a restore of the room brings it back.

## Order

The room handles one message at a time ([sync v4](0003-sync-v4.md), "Editing"; [access v4](0003-access-v4.md),
"The room's copy", "Order"), comment actions included, in the order they reach it.

- Each saved comment action takes the next **comment sequence**, a counter that starts at 1 for the
  board's first saved action and goes up by one per saved action. A refused action takes none. The
  sequence is the board's one order of comment actions: replies are ordered by it, threads in the
  list are ordered by the sequence that started them, and every client applies changes in it.
- A comment action has no Yjs dependency. It is saved or refused at once and never waits: an
  incomplete edit waiting in the room ([sync v4](0003-sync-v4.md), "Waiting edits") does not hold
  it back, and it does not hold any edit back.
- **Last saved wins** for `resolved`: of two `resolve` and `reopen` actions, or a `reply` and a
  `resolve`, the one saved later decides the state. Of two edits of one comment, the one saved
  later is its text.
- An action on a thread or comment that is gone when the room reaches it is refused:
  `thread_deleted` when the thread is gone, `comment_deleted` when the comment is gone and its
  thread is not. Its author keeps their text (hosted storage v5).

## Limits

The room refuses, and saves nothing for, an action past one of these. A refused action counts
towards no limit. The numbers are starting values.

| Limit | Value | Refusal |
| --- | --- | --- |
| Text of one comment | 4,000 code points | `too_long` |
| Comment text a board holds: the UTF-8 bytes of the text of every comment on it | 4 MiB (4,194,304 bytes) | `comment_limit`, for a `start`, `reply` or `edit` that would pass it |
| Comments a board holds | 2,000 | `comment_limit`, for a `start` or `reply` that would pass it |
| New comments (`start` and `reply`) per person per board | 100 in each clock hour (UTC, from hh:00:00.000 to hh:59:59.999) | `rate_limited` |
| Other actions (`edit`, `delete_comment`, `delete_thread`, `resolve`, `reopen`, `move`) per person per board | 600 in each clock hour (UTC) | `rate_limited` |
| Actions per connection | 10 saved in any 1,000 milliseconds | `rate_limited` |

A person's hourly counts on a board hold across their connections and tabs and across the room
being evicted or restarted; counts of earlier hours are deleted. The per-connection count lives
with the connection only. Limits are per board: the room cannot count across boards.

The comment-text and comment-count limits bound how much comments add to the backup envelope
([hosted persistence v4](0003-hosted-persistence-v4.md), "Backup envelope"): at both limits, with
labels of ordinary email names and text that JSON escapes to twice its size, the comment tables
and their receipts add less than 12 MiB (the 0005-W1 brief's S133 measures it). They do not
guarantee a backup: labels that JSON escapes heavily, receipts of later actions (which grow with
use, as edit receipts do) and a large board document can still bring a board to 413
`backup_too_large`, as in v3.

## Checking an action

The room checks a `comment` message in this order and stops at the first refusal. Nothing is
stored for a refused action, not even a receipt.

1. The message's shape: `requestId` (1–100 characters), `epoch` (an integer) and `operation` as
   sync v6 defines it; `threadId` and `commentId` are lower-case UUIDs; `text` is a string where
   the action has one and meets "Text" apart from the empty and length rules; `anchor` is an
   object where the action has one. Otherwise `bad_message`. The anchor's contents are checked
   only at step 7.
2. Access: the person has no role on the board in the room's copy, `no_access`; the message's
   epoch or the connection's epoch is not the person's current epoch, `epoch_changed`
   ([access v5](0003-access-v5.md)).
3. The receipt ([sync v6](0003-sync-v6.md), "Retrying a comment"): a retry is answered from it, and
   a request ID used for anything else is refused with `request_id_reused`.
4. Text: `empty_text`, then `too_long`.
5. Existence: for `start`, a thread ID or comment ID used before on the board, or a `threadId`
   equal to the `commentId`, `identifier_reused`. For every other action, first the thread gone, `thread_deleted`; then,
   for `reply`, a comment ID used before, `identifier_reused`, and for `edit` and
   `delete_comment`, the comment gone or in another thread, `comment_deleted`.
6. Authorship: `edit` and `delete_comment` by anyone but the comment's author, and
   `delete_thread` and `move` by anyone but the thread's author, `not_author`.
7. The anchor, for `start` and `move`: `x`, `y`, `u` and `v` finite numbers, `x` and `y` at most
   1,000,000 from 0, `u` and `v` from 0 to 1, `objectId` `null` or a lower-case UUID, otherwise
   `bad_anchor`; an `objectId` that is not on the room's board, or names an object with no box,
   `anchor_deleted`.
8. Limits: `comment_limit`, then `rate_limited`.

Then the room saves the action, its receipt, the new comment sequence, the count and the changed
rows in one storage transaction, and only then sends anything about it (sync v6).

## What a client keeps

The shared client ([sync v6](0003-sync-v6.md), "The shared client") keeps the board's threads and
comments in the open tab's memory only, from the room's snapshot and changes. Nothing about
comments is written to the device. A client never shows a comment action as done before the
room's `comment_saved` or the change it broadcasts. **Nothing is queued while disconnected**: a
client sends a comment action only while it is joined and has the snapshot, and it never sends
one again by itself ([sync v6](0003-sync-v6.md)).

## Author colours

A thread's and a comment's avatar colour comes from its `person`, so a person's pins keep one
colour on a board whichever connection they use: start with h = 0; for each character of the
person key, in order, h = (h × 31 + the character's code point) modulo 2³²; the colour is
presence v1's colour number h modulo 8 (`#2563eb`, `#dc2626`, `#16a34a`, `#9333ea`, `#ea580c`,
`#0891b2`, `#db2777`, `#4f46e5`, from 0). Two people can share a colour. Presence keeps its own
colours per connection, which can differ.

## Not in this version

Mentions, notifications, unread state and Mark all as read; formatting, emoji pickers, links,
images and reactions; region comments; search; clusters of pins when zoomed out; comments on
local boards, in a board file or in the export; moderation of other people's comments by the
owner; queuing comment actions while disconnected; attaching a detached thread again; live
movement of another person's pin while they drag (pins follow saved moves); counting limits
across boards; and measured scale or latency targets.
