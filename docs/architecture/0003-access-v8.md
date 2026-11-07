# 0003 — Access contract

CONTRACT VERSION: 0003 access v8 (2026-11-07)

Status: Draft for 0006-W4 v1. Replaces [access v7](0003-access-v7.md). Highest effective
roles, epoch/revocation, participant rules and active-board history notice carry continue.
[API v8](0003-api-v8.md), [lifecycle v2](0006-board-lifecycle-v2.md),
[persistence v8](0003-hosted-persistence-v8.md) add current lifecycle gates.

| Caller | Ordinary active board/history | Owner lifecycle surface |
| --- | --- | --- |
| Current workspace owner | Existing owner rights | Read own workspace Trash/status; Move, Restore, Delete |
| Workspace editor/viewer or board-granted guest | Existing effective role on active boards only | 403 role_too_low / needed owner, no Trash metadata |
| Outsider, disabled person, missing/malformed target | Generic 404 not_found | Generic 404 not_found |

Invalid bearer is 401 before lookup/body. Required source failure is 503, never empty/404.
Non-active/deleted ordinary content/history access is generic 404 even for owners; the
current-owner DELETE grant exception below does not expose that content. Ticket refusal
is generic ticket_invalid; a lifecycle/final-loss close is 4403. A role-change 4403 requires
fresh authorization/reconnect with drafts kept unless unavailability is confirmed (sync v9). Status/list are separate current-owner
operations, checked again on retries and before returning receipt metadata. No creator exception.

Active authority and absence from deleted_board_ids are required before effective board-role
resolution, all RLS list/Recents/participant rows, board-grant/invitation acceptance and copied
board metadata. Filters must run before limit/cursor/count, not hide cards only in the browser.
Known non-active IDs may retain grants/memberships for later current-access restoration, but
these confer no document/history/realtime access while unavailable. Live membership/grant
revocation must still take effect during Trash. Never restore a permissions snapshot.

## Current-owner grant revocation while unavailable

The existing `DELETE /boards/:board/grants/:person` is a narrow administration exception for
retained grants in moving/trashed/restoring. It does not use active-only board_role to authorize:
after bearer/ID validation, the server resolves the immutable workspace from live lifecycle/
retained board authority and checks current enabled workspace ownership. Recheck that owner in
a service-only `revoke_unavailable_board_grant(board uuid, person uuid, caller uuid)` SQL function,
under the workspace and lifecycle row locks, in the same lock order as lifecycle transitions.
Require matching workspace/board identity, moving/trashed/restoring and no deleted marker, then
remove only the named grant using remove_grant's owner-row guard, access-change log and guest
cleanup rules. A concurrent restore serializes with this removal; if active wins, the same locked SQL call
rechecks current ownership and applies the existing active remove_grant logic before commit. Purging/deleted/missing targets return generic 404;
identifiable non-owners 403 role_too_low/needed owner, outsiders/disabled 404, invalid bearer 401,
required-source failure 503. No title, document, history, dates or count in the reply.

Retain the existing 200 {boardId,personId,removal} shape and durable removal accounting. A pending
access replay stays pending; do not fake done by skipping it. Never initialize/open the denied
room or recreate notices to remove a grant; complete current-access replay before restoration
can become active. PUT grant creation/changes and invitation acceptance remain active-only;
this exception creates no UI/role, content read, ticket or broader lifecycle permission.
Workspace membership revocation retains its existing owner-authorized path. The SQL function
has fixed search_path, service-only EXECUTE and explicit public/anon/authenticated revocations.

Add exactly the three service tables in persistence v8: 16 total, all with RLS and explicit
service-only privileges. No authenticated/anon table policy or direct function permission for
lifecycle/register/work discovery. Service-only functions perform owner admission, CAS state/
cycle/fence updates, phase completion and work scans with fixed search paths and explicit EXECUTE
revocations. Add live lifecycle predicates to existing service functions, including copied board,
notifications/access delivery, projection/leases and history carry. Returning a stale accepted
history receipt must not bypass lifecycle. No browser service key or register dump.

Move clears room mention targets/pending creations, projected notifications, leases and delivery
work behind a higher generation, preserving historical ranges and delivered cutoff. Drop held
projection/access batches from older cycles/generations; no new notices in Trash. Trash restore
starts fresh leases/current roles and never uses carry to recreate removed references. Later
explicit mention occurrences may deliver once. User document restore on an active board still
uses carry_board_mentions and preserves current notice/read state; operator restore clears.

Purge explicitly inventories all dependent SQL rows; workspace-wide records/other boards stay.
The permanent register stores only board/workspace IDs and generation; its workspace identifier
authorizes current-owner terminal status after the board row disappears. Owner loss clears
owner-only Trash metadata/results and invalidates its late responses; ordinary board drafts
survive a role-change reconnect when effective access remains. Account/sign-out or confirmed
whole-board loss clears protected drafts under hosted storage v8. Ordinary
denied responses expose no title, content, count, deadline or lifecycle distinction.
