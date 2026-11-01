# 0003 — Access contract

CONTRACT VERSION: 0003 access v4 (2026-10-31)

Status: Draft for 0004-W1 v1. It replaces [access v3](0003-access-v3.md), adding what presence
shows to the other people on a board (see "What presence shows"); no role, rule or record
changes. It defines workspaces,
roles, how a person's role on a board is worked out, how a change of access reaches the rooms,
and what every operation needs. People are defined in the [identity contract](0003-identity-v3.md),
routes in the [API contract](0003-api-v4.md), the room connection in the
[sync contract](0003-sync-v3.md).

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
`editor`, `viewer` or null; it returns null for a disabled person (see "Disabled people"). The row rules and the server both use it, so the rule exists in one
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
| `people` | `id` (the Auth user's UUID), `email` (lower case), `created_at`, `disabled` (boolean, false by default) |
| `workspaces` | `id`, `name`, `created_at` |
| `workspace_members` | `workspace_id`, `person_id`, `role` (`owner`, `editor`, `viewer`, `guest`); one row per person and workspace |
| `boards` | `id`, `workspace_id`, `title`, `created_by`, `created_at`, `edited_at`, `document_generation`, `document_revision` (the last three, and later values of `title`, are copied from the board's room: [hosted persistence contract](0003-hosted-persistence-v3.md)) |
| `board_opens` | `person_id`, `board_id`, `opened_at`; one row per person and board (the person's last open) |
| `board_grants` | `board_id`, `person_id`, `role` (`editor`, `viewer`); one row per person and board |
| `invitations` | `id`, `workspace_id`, `board_id` (null for a workspace invitation), `email` (lower case), `role`, `created_by`, `created_at`, `expires_at`, `accepted_at`, `accepted_by`, `cancelled_at` |
| `access_changes` | `number` (an increasing identity), `workspace_id`, `board_id` (null for a workspace-level change), `person_id`, `kind` (`member`, `grant`), `role` (the role written at that level, or null when the level was removed or the person disabled), `created_at` |
| `access_deliveries` | `change_number`, `board_id`, `applied_at` (null until the board's room has applied the change), `applied_watermark`; one row per change and board the change reaches, removed with its change or board (see "Delivery") |
| `access_log_floor` | `workspace_id`, `lowest_kept`: every change of the workspace numbered at or above it is kept. It starts at 1 when the workspace is created and rises only when history is deleted, which this version never does. Numbers may have gaps (other workspaces share the sequence, and a rolled-back write uses up a number); a gap is never missing history |

Row rules for an authenticated person (a disabled person reads no rows at all):

- `boards`: rows where `board_role(auth.uid(), id)` is not null. A guest therefore sees only
  the boards granted to them.
- `workspaces`, `workspace_members`, `board_grants`: the workspace owner reads every row of their
  workspace; anyone else reads only rows about themself.
- `invitations`: only the workspace owner. An invited person learns which workspace or board an
  invitation is for only by accepting it.
- `people`: the person's own row; the workspace owner also reads the members of their workspace.
- `board_opens`: the person's own rows.
- `access_changes`, `access_log_floor`, `access_deliveries`: no rows (the service role reads them).

## Writes

Each write is one SQL function, so the change and its record commit in one transaction or not
at all:

| Function | Does |
| --- | --- |
| `bootstrap_workspace(name, owner_id, owner_email)` | Creates the workspace, the owner's person and member rows and their access change |
| `remember_person(person, email)` | Inserts the person's row or updates its email ([identity contract](0003-identity-v3.md)) |
| `create_board(workspace, person, title)` | Creates the board row |
| `write_member_role(workspace, person, role)` | Sets a member's role, higher or lower, and appends a `member` access change (see "Changing and removing roles") |
| `write_board_grant(board, person, role)` | Sets a grant, higher or lower (making the person a `guest` first if they are not a member), and appends a `grant` access change for each row written |
| `remove_member(workspace, person)` | Removes the person's workspace role (see "Changing and removing roles") |
| `remove_grant(board, person)` | Removes the person's grant on the board (same section) |
| `disable_person(person)`, `enable_person(person)` | See "Disabled people" |
| `record_access_receipt(board, through)` | Marks applied every delivery of the board numbered at or below `through` (see "Delivery") |
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
| `list_workspaces(person)` | The rows of `GET /workspaces` ([API contract](0003-api-v4.md)) |
| `list_boards(person, workspace, sort, direction, after_key, after_id)` | One page of the workspace's boards on which the person has a role, plus one more row to tell whether a next page exists |
| `list_recent_boards(person)` | The person's recent boards on which they still have a role, at most 50 |
| `pending_access_boards()` | The boards that have at least one delivery not yet applied |
| `pending_deliveries(person, workspace, board)` | The deliveries not yet applied (change number and board ID) of the person's access changes, limited to that workspace and to that board when they are not null |

Every function that writes access first locks the workspace's row (`SELECT … FOR UPDATE`) and
only then takes access-change numbers, so within one workspace a change with a higher number
always commits after every lower one. A room therefore never sees change N+1 while N is still
to come, and its watermark never skips one.

Every write that changes a person's access records its access change and that change's
deliveries in the same transaction (see "Delivery").

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

## Changing and removing roles

Only the workspace owner changes or removes roles. The owner's own workspace row, and any grant
on the owner, cannot be changed or removed: the write functions refuse with
`owner_row_immutable`. `owner` is never a value written by them.

- `write_member_role` sets `editor`, `viewer` or `guest`, higher or lower than before. Setting the
  role the member has writes nothing. A person who is not a member: `person_not_found`.
- `write_board_grant` sets `editor` or `viewer`, higher or lower. Setting the grant the person has
  writes nothing.
- `remove_member` removes the workspace level only. An `editor` or `viewer` who holds a grant on a
  board of the workspace becomes a `guest` and keeps those grants; one who holds none leaves the
  workspace (the row is deleted). A `guest` with no grant leaves the workspace; a `guest` who
  still holds grants is refused with `guest_has_grants` (their grants are removed one by one).
  A person who is not a member: `not_found`.
- `remove_grant` deletes the grant. If the person is a `guest` and this was their last grant in
  the workspace, the guest row is deleted too. No such grant: `not_found`.

Every row written or deleted gets its own access change in the same transaction: the new role, or
null for a level removed. A person's role on each board is then worked out again from what is
left: removing a grant from a workspace `editor` leaves them an editor; removing the workspace
role of someone with an `editor` grant on board X leaves them editor of X only.

## Taking access away

Taking access away writes Supabase first, then tells the rooms, as giving access does:

1. The write function locks the workspace row, writes the role rows, and commits them with their
   access changes and deliveries in one transaction. From this moment `board_role` and the row
   rules give the person the lower access everywhere outside the rooms.
2. The server delivers the change (see "Delivery"). Each room it reaches replays: it recomputes
   the person's role on its board with `board_role`. Where the role fell, in one storage
   transaction the room stores the lower role (or removes the person from its copy), raises the
   person's epoch, and deletes the waiting edits of every connection the person holds; then it
   closes those connections with 4403. This is the room step: from it, every edit the person
   sends under the old epoch is refused with `epoch_changed`, and nothing of theirs that was
   waiting is saved. Their open connections are closed within 2 seconds of the room step on a
   healthy network.
3. Where the person's role on a board is unchanged (another level still gives the same role),
   the room records the change number and leaves the epoch and connections alone.

Each board's room step stands on its own: a workspace change reaches its boards in parallel, at
most 10 at a time, and the 2-second close applies to each board from its own room step. Until a
board's room step, a person who is already connected to that board keeps the access the room's
copy gives; a failure at any point leaves the person with less access than before, never more.

## Giving access

Giving access writes Supabase first, then tells the rooms:

1. The write function commits the role, its access change and deliveries.
2. The server delivers the change (see "Delivery").
3. Each room recomputes the person's role with `board_role`. If the role rose, it closes the
   person's connections with 4409 ("access changed"); the client joins again and gets the new
   role. A raise never closes with 4403.

## Delivery

A delivery is one row of `access_deliveries`: one change and one board it reaches. A board-level
change reaches its board; a workspace-level change reaches every board of the workspace that
exists when it commits. The rows are written in the change's own transaction. A board created
later needs none: its room starts empty at the workspace's `latest` and looks people up. A delivery never creates a board's room. A room with no stored state is the one exception to the
replay rule below: it reads the workspace's `latest` from Supabase (as `access_changes_after`
reports it), answers with it as its watermark and stores nothing, on both runners; it starts at
its `latest` when first opened. If that read fails, it answers with an error.

To deliver, the server takes the boards of `pending_access_boards()` and calls each board's room,
at most 10 at a time. The room replays (see "Replay") and answers with its watermark, the highest
change number it has now applied. It answers only after a replay whose call to Supabase
succeeded; a room that is locked, or that opened with its copy because Supabase could not be
reached, answers with an error and acknowledges nothing. The server then calls
`record_access_receipt(board, watermark)`. A room never answers with a watermark it has not
stored.

A change is done when every one of its deliveries is applied; a change that reaches no board is
done at once. For a person and a scope, removal is `done` when `pending_deliveries` for that
person and scope returns nothing, and `pending` otherwise, or when it cannot be read. The scope
is: the workspace, for a member route and a member row; the board, for a grant route and a grant
row; every workspace, for disabling and enabling. A receipt lost after the room applied the change leaves
the change `pending`; the next delivery replays (which changes nothing in the room) and records
it. A room also replays when anyone joins it, which keeps its copy current, but only a delivery
records receipts.

The server delivers:

- after every access write (the routes of "Changing and removing roles", raising, invitation
  acceptance, disabling and enabling), before it replies;
- once a minute: on Cloudflare a Cron Trigger `* * * * *` calls the Worker's `scheduled()`
  handler; on the Node server a one-minute timer, stopped when the server stops.

Deliveries may run at the same time in different Worker isolates: each room applies a change
once and receipts are idempotent. Within one Node process or one Worker isolate, a delivery asked
for while another runs starts when it ends.

**One server per dataset.** One server (one Worker deployment, or one Node process) answers for
the rooms of the boards in one Supabase dataset. Two servers against the same dataset are not
supported: each would acknowledge deliveries from its own rooms.

## Disabled people

The operator can disable a person (API contract, "Operator routes"):

- `disable_person(person)` locks every workspace row in ID order, sets `people.disabled`, and
  appends a `member` access change with role null, with its deliveries, for each workspace the
  person belongs to. Their member rows and grants are kept. An unknown person:
  `person_not_found`; a person already disabled: nothing is written.
- While disabled, `board_role` is null for them on every board, every workspace role the server
  works out for them is none (so the list functions return them nothing and the owner routes
  refuse them), the row rules return them no rows, and accepting an invitation is refused with
  `account_disabled`. Delivery takes them out
  of every room's copy and closes their connections with 4403, as for any removal.
- `enable_person(person)` takes the same locks, clears `people.disabled`, and appends a `member`
  access change with the person's current role for each workspace they belong to; it is
  delivered as giving access. A person not disabled: nothing is written.

Every function that writes a person's access locks the workspace row first, so a write for a
person never commits between a disable or enable and its access changes.

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
- A disabled person cannot accept an invitation: `account_disabled`, and nothing is written.
- The workspace owner can accept an invitation (one sent to their own email): the acceptance is
  recorded and no role row is written, because the owner's role is already the highest; the
  owner-row protection of "Changing and removing roles" applies to the routes, not to this.
- Cancelling a board invitation is checked against that board: a person with no role on the
  board gets 404, as for any other route on it.

## Replay

A room that loads from storage, and a room that is delivered to or joined, asks
`access_changes_after(board, watermark)` and applies every change in order before it serves
anyone. Applying a change recomputes the person's role with
`board_role`, whether the change raised or lowered it: a restored room may hold a role that was
taken away after its backup. If a recomputed role is lower than the stored one and the person
has an open connection, the room closes it with 4403 (the room step of "Taking access away");
a person with no role left is removed from the copy and refused on their next join. Every
replay, including one that finds no new change, then compares each open connection with the
copy: a connection whose person is no longer in it, or whose epoch is not the person's current
epoch, has its waiting edits deleted and is closed, with 4409 when the person's role is now
higher than the role the connection joined under and 4403 otherwise. A close lost when a server
stopped after the room step is therefore made by the next replay. If `lowest_kept` is above its watermark plus one, the
changes it needs are gone, and it stays locked with reason `access_log_pruned` ([hosted
persistence contract](0003-hosted-persistence-v3.md)).

If Supabase cannot be reached:

- After an ordinary wake (no restore), the room opens with its copy. People in the copy keep
  their stored role; anyone else gets 404, because their role cannot be looked up.
- After a restore, the room stays locked until replay succeeds. A person in its copy gets 503
  `room_locked` ("retry later"); anyone else gets 404, so a locked room never confirms that a
  board exists to someone who may have no role on it.

## What presence shows

Everyone connected to a board, viewers included, sees for every other connection of that board
its label (the part of the person's email before the last `@`: [identity contract](0003-identity-v3.md),
"Labels"), its role, its colour, its person key, and its cursor, selection, view and `active` flag
([presence contract](0004-presence-v1.md)), for as long as both are connected and the presence
has not expired. Nobody sees another person's account ID, full email or other boards through
presence: the person key is derived from the person and the board and differs on every board.
This is new: before presence, a person who was not the workspace owner could not read anyone
else's `people` row, and the row rules above still do not let them.

Presence grants nothing. A viewer's presence is relayed like anyone's and the viewer still cannot
edit; no presence message can carry an edit (sync contract).

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
| Send presence, and see the others' presence | yes | yes | yes | (by board role) | — | — |
| Export the board as JSON | yes | yes | yes | (by board role) | 404 | 401 |
| List members, board grants or invitations | yes | 403 | 403 | 403 | 404 | 401 |
| Invite to the workspace or to a board, cancel an invitation | yes | 403 | 403 | 403 | 404 | 401 |
| Raise, lower or remove a role (workspace role; board grant) | yes | 403 | 403 | 403 | 404 | 401 |
| Accept an invitation | the signed-in person whose email matches it, whatever their role, unless disabled | | | | | 401 |
| Disable or enable a person | operator key only (API contract) | | | | | |
| Delete a board, images, comments | not offered | | | | | |

A refusal is 401 for a token failure, 404 when the person has no role (so a stranger or a
guest cannot learn that a board or workspace exists), and 403 with the role needed when they
have a role that is not enough: `{ "error": { "reason": "role_too_low", "needed": "<role>" } }`.

## Not in this version

Projects as an access level, rules that deny access, editors inviting or removing others,
deleting a board, and more than one server answering for one dataset are later work.

## Public references

Retrieved 2026-10-30: [Supabase row level security](https://supabase.com/docs/guides/database/postgres/row-level-security),
[Supabase: securing your API](https://supabase.com/docs/guides/api/securing-your-api) and
[Cloudflare Cron Triggers](https://developers.cloudflare.com/workers/configuration/cron-triggers/)
(a cron expression runs the Worker's `scheduled()` handler, down to every minute; local
development does not fire them by itself, and a change can take up to 15 minutes to reach the
network).
