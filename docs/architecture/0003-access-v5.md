# 0003 — Access contract

CONTRACT VERSION: 0003 access v5 (2026-11-03)

Status: Draft for 0005-W1 v1. When accepted it replaces [access v4](0003-access-v4.md) for later
work. Every role, rule, record and refusal of v4 still applies, word for word, except where this
version changes it. It adds **comments**: who may start, reply to, resolve, reopen, edit, delete
and move them, and what everyone on a board sees of them. No role, record, route or write
function changes. The room connection is [sync v6](0003-sync-v6.md); comments themselves are the
[comments contract](0005-comments-v1.md).

## Comments

Commenting is part of viewing: **a viewer comments**. A viewer's edits are still refused and never
saved (v4, "What each operation needs", "Send an edit"); a viewer's comment actions are checked by
the rules below, on the room's separate comment path (sync v6, "Comments").

- **Everyone with a role** on the board (owner, editor, viewer, and a guest through a board grant)
  can see every thread and comment, start a thread, reply, resolve and reopen.
- **Only the author** edits or deletes a comment, and only the author of a thread deletes or moves
  it. The author is the account that posted it, by account ID. The board's owner and the
  workspace's owner have no other power over other people's comments.
- **Deleting a thread's first comment** deletes the thread and every reply in it, whoever wrote
  the replies. It is the thread author's action.
- **Losing a role** keeps the person's comments on the board, under the label they were posted
  with. They can no longer see or change them; nobody else can edit or delete them.

**Checks.** The room checks a comment action against its copy of the person's role and epoch
(v4, "The room's copy"), before it looks up a receipt: a person with no role in the copy is
refused with `no_access`; a message whose epoch, or whose connection's epoch, is not the person's
current epoch is refused with `epoch_changed`, and nothing is stored. So a comment sent under an
old epoch never applies under a new one, as an edit does not. Taking access away closes the
person's connections as v4 says (4403 or 4409), and every comment action that reaches the room
after the room step is refused.

**What comments show.** Everyone connected to a board sees, for every comment, its author's label
as it was when posted and its author's person key on that board ([presence v1](0004-presence-v1.md)),
never an account ID or an email. A comment's label may name someone who no longer has access. A
person without a role learns nothing of a board's comments: they never get `joined` (sync v6,
"The snapshot").

## What each operation needs

v4's table applies, with these rows changed and added:

| Operation | Owner | Editor | Viewer | Guest with a grant in the workspace | No role (guest without a grant, or not a member) | No or bad token |
| --- | --- | --- | --- | --- | --- | --- |
| See a board's threads and comments | yes | yes | yes | (by board role) | — | — |
| Start a thread, reply, resolve, reopen | saved | saved | saved | (by board role) | — | — |
| Edit or delete a comment; delete or move a thread | saved for its author, otherwise refused (`not_author`) | as owner | as owner | (by board role) | — | — |
| Delete a board, images | not offered | | | | | |

"—" means the person has no room connection: a join is refused as v4 says. Comments have no HTTP
route: every route for comments still answers 404 ([API v4](0003-api-v4.md), "Common rules").

## Not in this version

v4's list, and: moderating or hiding other people's comments, comment permissions set per board
or per person, and comments by people without a role (for example by link).
