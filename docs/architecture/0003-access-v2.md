# 0003 — Access contract

CONTRACT VERSION: 0003 access v2 (2026-10-30)

Status: Draft for 0003-W3 v1. It replaces [access v1](0003-access-v1.md), adding who may list
workspaces, boards and recent boards and rename a board, the `board_opens` table, the board
row's copied fields, and their SQL functions. It defines workspaces, roles, how a person's role on a board is
worked out, how a change of access reaches the rooms, and what every operation needs. People
are defined in the [identity contract](0003-identity-v1.md), routes in the
[API contract](0003-api-v2.md), the room connection in the [sync contract](0003-sync-v1.md).

## Levels and roles

| Level | Roles | In this version |
| --- | --- | --- |
| Workspace | `owner`, `editor`, `viewer`, `guest` | Yes |
| Project (a group of boards) | `editor`, `viewer` | Reserved: no table yet |
| Board (a board grant) | `editor`, `viewer` | Yes |

- A workspace has exactly one `owner`, who is owner of every board in it.
- A workspace `editor` or `viewer` has that role on every board in the workspace.
- A `guest` is a member of the workspace with no role on any board unless a board grant gives
  one.
- A board grant gives one person `editor` or `viewer` on one board. A person who holds a
  board grant is always a member of the board's workspace (a `guest` at least).

## The highest role wins

A person's role on a board is the highest of every level that applies to them, in the order
`owner` > `editor` > `viewer` > none. Access only adds up; there is no rule that takes access
away. Examples: a workspace `viewer` with an `editor` grant on board X edits X and views every
other board; a `guest` with a `viewer` grant on board Y sees Y and no other board.

One SQL function, `nextphase_board.board_role(person uuid, board uuid)`, returns `owner`,
`editor`, `viewer` or null. The row rules and the server both use it, so the rule exists in one
place. Only the service role may ask about any person; for an authenticated caller it returns
null unless `person` is `auth.uid()`, so nobody can learn another person's role, or that a
board exists, through it. Adding projects later adds one level to this function and one table; nothing else
changes.

## Records in Supabase

Everything lives in the Postgres schema `nextphase_board`. Every table has row-level security
on. Authenticated people may only read, through the row rules below; every write goes through
the `SECURITY DEFINER` functions under "Writes", which only the service role may execute.

| Table | Holds |
| --- | --- |
| `people` | `id` (the Auth user's UUID), `email` (lower case), `created_at` |
| `workspaces` | `id`, `name`, `created_at` |
| `workspace_members` | `workspace_id`, `person_id`, `role` (`owner`, `editor`, `viewer`, `guest`); one row per person and workspace |
| `boards` | `id`, `workspace_id`, `title`, `created_by`, `created_at`, `edited_at`, `document_generation`, `document_revision` (the last three, and later values of `title`, are copied from the board's room: [hosted persistence contract](0003-hosted-persistence-v2.md)) |
| `board_opens` | `person_id`, `board_id`, `opened_at`; one row per person and board (the person's last open) |
| `board_grants` | `board_id`, `person_id`, `role` (`editor`, `viewer`); one row per person and board |
| `invitations` | `id`, `workspace_id`, `board_id` (null for a workspace invitation), `email` (lower case), `role`, `created_by`, `created_at`, `expires_at`, `accepted_at`, `accepted_by`, `cancelled_at` |
| `access_changes` | `number` (an increasing identity), `workspace_id`, `board_id` (null for a workspace-level change), `person_id`, `kind` (`member`, `grant`), `role`, `created_at` |
| `access_log_floor` | `workspace_id`, `lowest_kept`: every change of the workspace numbered at or above it is kept. It starts at 1 when the workspace is created and rises only when history is deleted, which this version never does. Numbers may have gaps (other workspaces share the sequence, and a rolled-back write uses up a number); a gap is never missing history |

Row rules for an authenticated person:

- `boards`: rows where `board_role(auth.uid(), id)` is not null. A guest therefore sees only
  the boards granted to them.
- `workspaces`, `workspace_members`, `board_grants`: the workspace owner reads every row of their
  workspace; anyone else reads only rows about themself.
- `invitations`: only the workspace owner. An invited person learns which workspace or board an
  invitation is for only by accepting it.
- `people`: the person's own row; the workspace owner also reads the members of their workspace.
- `board_opens`: the person's own rows.
- `access_changes`, `access_log_floor`: no rows (the service role reads them).

## Writes

Each write is one SQL function, so the change and its record commit in one transaction or not
at all:

| Function | Does |
| --- | --- |
| `bootstrap_workspace(name, owner_id, owner_email)` | Creates the workspace, the owner's person and member rows and their access change |
| `remember_person(person, email)` | Inserts the person's row or updates its email ([identity contract](0003-identity-v1.md)) |
| `create_board(workspace, person, title)` | Creates the board row |
| `write_member_role(workspace, person, role)` | Sets a member's role and appends a `member` access change |
| `write_board_grant(board, person, role)` | Sets a grant (making the person a `guest` first if they are not a member) and appends a `grant` access change for each row written |
| `create_invitation(workspace, board, email, role, by)` | Records an invitation that expires 7 days after it is made |
| `cancel_invitation(invitation)` | Marks it cancelled |
| `accept_invitation(invitation, person, email)` | See "Invitations" |
| `access_changes_after(board, after)` | Returns the board's workspace-level and board-level changes numbered above `after`, in order, the workspace's `lowest_kept`, and `latest`, the workspace's highest change number |
| `record_board_open(person, board, opened_at)` | Inserts the person's open of the board, or moves `opened_at` to the later of the stored and the given time |
| `copy_saved_board(board, title, edited_at, generation, revision)` | Copies a saved state of the board from its room: sets `title`, `edited_at` (kept as it is when `edited_at` is null), `document_generation` and `document_revision`, only when (`generation`, `revision`) is not older than the stored pair, compared generation first |

Reads that the server makes as the service role, each working out roles with `board_role` so
the rule stays in one place:

| Function | Returns |
| --- | --- |
| `list_workspaces(person)` | The rows of `GET /workspaces` ([API contract](0003-api-v2.md)) |
| `list_boards(person, workspace, sort, direction, after_key, after_id)` | One page of the workspace's boards on which the person has a role, plus one more row to tell whether a next page exists |
| `list_recent_boards(person)` | The person's recent boards on which they still have a role, at most 50 |

Every function that writes access first locks the workspace's row (`SELECT … FOR UPDATE`) and
only then takes access-change numbers, so within one workspace a change with a higher number
always commits after every lower one. A room therefore never sees change N+1 while N is still
to come, and its watermark never skips one.

In this version the role-writing functions only raise access: they refuse to lower or remove a
role (see "Not in this version").

## The room's copy

Each board's room keeps a copy of the access it needs: for each person it has seen, their role
on that board as `board_role` computed it, a grant epoch, and the number of the last access
change applied for them. It also keeps a watermark: the highest access-change number it has
replayed completely.

- **Lookup on join.** A person not in the copy is looked up with `board_role` when they join or
  ask for a ticket. A role is stored; "no role" is never stored, so the copy holds only people
  who have a role on the board, and a refused person leaves no trace in it.
- **A new room** starts with an empty copy and its watermark at the `latest` of its workspace
  when it is created: access given before then reaches it through lookups.
- **Epoch.** When a person's role on the board changes, their epoch goes up by one and every
  connection they hold under the old epoch is closed. A change that leaves their role on this
  board the same (for example a board grant to someone who is already a workspace editor)
  records its number but leaves the epoch and their connections alone.
- **Order.** Joins, edits and access changes for one room are handled one at a time, in the
  order they reach it. A lookup that started before a newer change for the same person is
  discarded and repeated, and a change numbered at or below the one already applied for that
  person is ignored.

## Giving access

Giving access writes Supabase first, then tells the rooms:

1. The write function commits the role and its access change.
2. The server calls each room the change reaches: one room for a board grant, every board in
   the workspace for a workspace role. It calls at most 10 rooms at a time.
3. Each room recomputes the person's role with `board_role`. If the role rose, it closes the
   person's connections with 4409 ("access changed"); the client joins again and gets the new
   role. A raise never closes with 4403.

If a room cannot be reached in step 2, nothing is lost: the room replays the change the next
time it starts or the person joins (see "Replay").

## Invitations

- Only the workspace owner invites, lists and cancels invitations.
- A workspace invitation offers `editor`, `viewer` or `guest`; a board invitation offers
  `editor` or `viewer` on one board.
- An invitation is single use, expires 7 days after it is made, and can be accepted only by a
  signed-in person whose verified email matches the invited email, ignoring letter case. The
  invitation's ID alone grants nothing.
- Accepting a workspace invitation sets the person's workspace role to the higher of the role
  they have and the role offered. Accepting a board invitation makes someone outside the
  workspace a `guest` and gives the grant; for a member, it sets the grant to the higher of
  the existing grant and the role offered. Acceptance never lowers a role. Every row written
  gets its own access change, in the same transaction.
- If the accepting person already has a row in a room's copy, acceptance tells the rooms it
  reaches as in "Giving access", so a cached role cannot stay lower than the new one.
- Cancelling a board invitation is checked against that board: a person with no role on the
  board gets 404, as for any other route on it.

## Replay

A room that loads from storage asks `access_changes_after(board, watermark)` and applies every
change in order before it serves anyone. Applying a change recomputes the person's role with
`board_role`, whether the change raised or lowered it: a restored room may hold a role that was
taken away after its backup. If a recomputed role is lower than the stored one and the person
has an open connection, the room closes it with 4403; a person with no role left is removed from
the copy and refused on their next join. In this version no route lowers a role, so only access changes written outside
the API can cause this; the removal milestone adds the routes. If `lowest_kept` is above its watermark plus one, the
changes it needs are gone, and it stays locked with reason `access_log_pruned` ([hosted
persistence contract](0003-hosted-persistence-v2.md)).

If Supabase cannot be reached:

- After an ordinary wake (no restore), the room opens with its copy. People in the copy keep
  their stored role; anyone else gets 404, because their role cannot be looked up.
- After a restore, the room stays locked until replay succeeds. A person in its copy gets 503
  `room_locked` ("retry later"); anyone else gets 404, so a locked room never confirms that a
  board exists to someone who may have no role on it.

## What each operation needs

The role is the person's role on the board named in the route, or, for a workspace route,
their workspace role.

| Operation | Owner | Editor | Viewer | Guest with a grant in the workspace | No role (guest without a grant, or not a member) | No or bad token |
| --- | --- | --- | --- | --- | --- | --- |
| Create a board in the workspace | yes | yes, if a workspace editor; 403 if the editor role comes only from a grant | 403 | 403 | 404 | 401 |
| List my workspaces | yes | yes | yes | yes (only workspaces with a granted board) | an empty list | 401 |
| List a workspace's boards | yes | yes | yes | yes (only the granted boards) | 404 | 401 |
| List my recent boards | yes | yes | yes | (by board role) | an empty list | 401 |
| Read board details | yes | yes | yes | (by board role) | 404 | 401 |
| Rename a board | yes | yes | 403 | (by board role) | 404 | 401 |
| Get a join ticket and join the room | yes | yes | yes | (by board role) | 404 | 401 |
| Send an edit | saved | saved | refused, never saved | (by board role) | — | — |
| Export the board as JSON | yes | yes | yes | (by board role) | 404 | 401 |
| List members, board grants or invitations | yes | 403 | 403 | 403 | 404 | 401 |
| Invite to the workspace or to a board, cancel an invitation | yes | 403 | 403 | 403 | 404 | 401 |
| Raise a role (workspace role; add or raise a board grant) | yes | 403 | 403 | 403 | 404 | 401 |
| Accept an invitation | the signed-in person whose email matches it, whatever their role | | | | | 401 |
| Lower or remove a role, disable an account, delete a board, images, comments | not offered | | | | | |

A refusal is 401 for a token failure, 404 when the person has no role (so a stranger or a
guest cannot learn that a board or workspace exists), and 403 with the role needed when they
have a role that is not enough: `{ "error": { "reason": "role_too_low", "needed": "<role>" } }`.

## Not in this version

Lowering or removing a role at any level, and its timing on open connections, belong to the
removal milestone. When it comes, removal recomputes the role rather than deleting it:
removing a board grant from a workspace editor leaves them an editor, and removing a workspace
role leaves any board grants they hold. Projects as an access level, rules that deny access,
and editors inviting others are also later work.

## Public references

Retrieved 2026-10-30: [Supabase row level security](https://supabase.com/docs/guides/database/postgres/row-level-security)
and [Supabase: securing your API](https://supabase.com/docs/guides/api/securing-your-api).
