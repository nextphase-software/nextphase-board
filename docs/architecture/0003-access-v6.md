# 0003 — Access contract

CONTRACT VERSION: 0003 access v6 (2026-11-05)

Status: Draft for 0005-W2 v1. Replaces [access v5](0003-access-v5.md).
V5's board roles, highest effective role, epochs, room access replay, authorship and viewer
comment rights apply unchanged. The new reads/actions are [API v6](0003-api-v6.md).
The owner-only members list is not widened to provide the roster.

## Participant visibility

Every candidate must be enabled, registered with a valid label (identity v4), have accepted
membership/grants and currently have effective access to this board.

| Caller | Permitted candidates |
| --- | --- |
| Workspace owner, editor or viewer | Workspace owners/editors/viewers and guests granted this board |
| Workspace guest with an editor or viewer board grant | Workspace owners/editors/viewers and self; no other guest |
| No effective board role | None; 404 `not_found` |

Pending invitations, disabled people, another workspace's people and guests without this board's
grant never appear. Presence is not a directory. Being a viewer does not prevent mentioning or
being mentioned. Self-picking is permitted and creates no notice. A guessed hidden key is refused
at save time; it cannot become an invitation or grant. Historical ranges grant no access.

## Account notification rights

A signed-in person lists/opens/marks/dismisses only their retained references. Every preview and
open rechecks live board access, the current lease, occurrence, comment and restore fence before
returning title, author or text. Denial/deletion/missing target is the same 404 `not_found`,
with no preview. A service failure is 503 `service_unavailable`; it does not erase a valid
reference. Missing/foreign action IDs are indistinguishable idempotent no-ops (204).
An open alone has no read side effect. Displayed-comment marking is confined to the caller's
accessible retained references. It cannot mark another account's inbox.

## Service-only projection

All tables below are in `nextphase_board`, have RLS enabled, and no authenticated row policy.
Allow authenticated SELECT only to demonstrate an empty result under RLS; revoke authenticated
and anon writes and function execution. Grant table/sequence/function privileges explicitly to
`service_role`; revoke function EXECUTE from PUBLIC, anon and authenticated. Functions use the
existing service-only schema conventions and fixed search paths. No browser database client or
service key is introduced. The source/projection transaction rules are in
[hosted persistence v6](0003-hosted-persistence-v6.md).

| Table | Columns and constraints |
| --- | --- |
| `mention_leases` | `(board_id,person_id)` primary key; `lease uuid DEFAULT gen_random_uuid()`; board and person foreign keys cascade |
| `mention_delivery` | `board_id` primary key and cascading board FK; `generation bigint`, `source_order bigint` |
| `mention_inbox` | `id uuid` primary key (occurrence); `recipient uuid`, `board_id uuid` cascading FKs; `thread_id uuid`, `comment_id uuid`, `lease uuid`, `generation bigint`, `source_order bigint`, `created_at bigint`, identity `delivered_order bigint`, `is_read boolean DEFAULT false`, `state_version bigint DEFAULT 0`; indices `(recipient,delivered_order DESC)` and `(board_id)` |

No title, author or comment body is copied to these tables. The inbox retains at most **50 per
account across workspaces**, ordered by `created_at` descending, then `delivered_order` descending.
Physical deletion on eviction/dismissal/withdrawal has no backfill or tombstone.

Service functions (parameters are exact):

| Function | Purpose |
| --- | --- |
| `refresh_mention_leases(board uuid)` | Keep current effective-access leases and delete mismatched inbox rows under the board lock |
| `mention_access_changed()` | Trigger on inserted `access_changes`; refresh affected boards in ID order |
| `mention_roster(board uuid,caller uuid)` | Service-only registered identity/lease rows; apply participant visibility before public projection |
| `valid_mention_targets(board uuid,targets jsonb)` | Return still-current source occurrence IDs for pruning |
| `project_mentions(board uuid,generation bigint,source_order bigint,active jsonb,creates jsonb)` | Reconcile current board references, create new still-leased occurrences, checkpoint and evict atomically |
| `clear_board_mentions(board uuid,generation bigint)` | Clear references and advance checkpoint to `(generation,-1)`; ignore older generations |
| `list_mentions(person uuid)` | Return only this person's accessible current-lease references |
| `act_mentions(person uuid,action text,seen jsonb)` | Account-owned versioned read/unread and idempotent dismiss |
| `mention_boards()` | Return all live board IDs as JSON for scheduler enumeration, without a table page-limit truncation |

A surviving highest effective role keeps the lease. Final role loss/disable removes it and its
inbox rows; regrant gets a fresh lease, fencing held work even before the room next loads.
Access replay deletes invalid current targets and pending creations, leaving one cleanup marker.
Removing an author keeps their saved discussion for permitted recipients. No access or comment
rule gives an owner moderation rights over someone else's comment.

Current board/person leases scale with current access; they have no fixed total count. There is
one projection checkpoint per live board. Existing access history is unchanged, not reused as
notification history.
