# 0003 — Hosted boards in the web app

CONTRACT VERSION: 0003 hosted storage v8 (2026-11-07)

Status: Draft for 0006-W4 v1. Replaces [hosted storage v7](0003-hosted-storage-v7.md).
Its active-board history preview, Pan/return, local-time formatter, save/name/document restore
and 4423 draft retention remain. [Interaction v34](0001-interaction-v34.md) owns exact rendering/
words/focus; [modules v32](0001-web-modules-v32.md) owns boundaries; [API v8](0003-api-v8.md),
[lifecycle v2](0006-board-lifecycle-v2.md), [sync v9](0003-sync-v9.md) own server outcomes.

## Home entries and Trash

Only current workspace owners see Move to trash… after Show version history in Home card
menus and before Close board details in board details. Use current workspace ownership, never
row effective board role alone. Owners see one visible Trash row immediately below each owned
workspace sidebar row, before the next workspace and Boards in this browser. Accessible name
Trash for {workspace}; route #/files/<workspaceId>/trash. No header Trash button. Non-owners
have no entry. Selected Trash does not select its workspace row or Recents. Normal workspace
route remains #/files/<workspaceId>, Home #/files, local board route empty hash.

Trash reuses the Home shell/content scroll column; heading Trash, topbar {workspace} · Trash.
Fetch all 50-row API pages using nextCursor, clear old rows on load/account/workspace/access
change. No counts/rows from a failed/denied read. Empty, loading, failed/Retry, denied/Back to
workspace, expired, pending and complete states follow interaction v34. Physical cleanup need
not finish for logical expiry: disable Restore at the server deadline, recheck on the server.
Use the v7 viewer-local Intl.DateTimeFormat with year numeric/month short/day numeric/hour
2-digit/minute 2-digit/timeZoneName short, no timeZone/hour12 override. Stored instants stay
server milliseconds; no calendar/DST arithmetic changes 2,592,000,000 ms.

On a fresh list/reload, moving and restoring rows are distinct resumed states: **Moving to
trash…** or **Restoring…**, with a single **Refresh status** button. No Restore, Retry, Cancel or
destructive control. Use the compact row shell and pending-row focus rule: focus Refresh status
for the resumed target row (first available action on initial list entry). Metadata comes only
from the current owner-authorized Trash list response; its moving/restoring shape has IDs/cycle/
generation but no title/dates. Render no cached title/deadline, status-response dates or fabricated
deletion explanation. Refresh performs status GET then refetches the authorized list if state
changed, never submits a new operation or invents a lost request ID. Owner/account/workspace
invalidation clears these rows before late responses. A resumed restore confirmed active uses
the same success receipt/neutral note, with heading Board restored when no authorized title is
available; it does not recover a title from stale state.

## Move, Restore and Delete

Move fetches owner lifecycle cycle before showing its confirmation. Cancel/Escape changes
nothing. Display the estimate as If moved now, restore before {time}. The server confirms the
exact deadline. Do not label that estimate the accepted deletion time. Submit one immutable
requestId/expectedCycle and retain it in tab memory until confirmed. In flight focus the dialog,
no Cancel/Escape dismissal. Proven pre-admission move_failed may say the board was not moved;
202 pending, lost answer and ordinary 503 remain unconfirmed with explicit same-request Retry.
A confirmed move refreshes active lists; an open board instead ends through the generic 4403
path. For a Home move, return focus to its workspace Trash row after the removed opener disappears.

Restore captures the listed cycle and one request ID, stays on Trash and focuses its heading
while waiting. A proven restore_failed leaves its Retry and Permanently delete… enabled;
uncertainty disables permanent deletion until resolved. Retry repeats the same path/body.
Confirmed active status shows a temporary {title} · Board restored receipt, Restored to
{workspace} · Same board and link, Open board and exact success note. This receipt is tab memory,
not a still-trashed API row; remove on next list refresh/navigation. Open board explicitly
fetches fresh access/ticket/session for the same ID, without old edits/drafts/notices. Current
comments and unexpired history remain; access restore creates no version. Every restored-board
confirmation appends **Some older versions may have expired.**, whether history is empty or not.
The illustrated empty-history state reached from that confirmed tab-memory receipt uses the
neutral interaction v34 text; other history empty states remain W3's. No claim about expiry
occurring during Trash, new authoritative expiry evidence or joined field is required. A failed
history read is never an empty result or evidence of expiry.

Delete confirms irreversibility and serving-store limits. Cancel/Escape returns to its row
opener before submission. Once purge is admitted, remove protected row metadata; show only
Deletion pending and Refresh status until confirmed complete. In the mixed Trash list use the
compact pending variant with no continuation note (77px desktop row). The standalone operation
result includes the continuation note; the same role/state does not force that note into lists. In-flight Permanently deleting…
never says complete. Status failure keeps pending/uncertain; Refresh is GET and never another
POST. Server minute retries continue independently. Complete focuses Board permanently deleted,
Back to workspace follows; no restore/recover action. Deadline expiry uses the same pending UI.
A generic HTTP failure is not evidence that an irreversible operation rolled back.

## Protected-state invalidation

Follow sync v9's 4403 split. A role/epoch-change close, including editor→viewer, first pauses
sends/old responses and freshly authorizes a board ticket/join; it is not proof of final access
loss. Keep tab-memory unposted drafts/ranges through reauthorization/reconnect and restore only
current-role UI after a fresh joined snapshot. Do not auto-send comments, replay stale privileged
work, show the terminal ending or route Home for that role change. Pending/503 authorization
keeps drafts in memory and no protected actions; it cannot grant cached access or assert loss.
Losing workspace ownership alone clears owner-only Trash/control/result state and rechecks board
access; it does not destroy ordinary board drafts if current effective access still permits the
board. Sign-out/account boundaries still clear protected state under their existing auth flow.

On confirmed whole-board unavailability (fresh current-board authorization/ticket 404, or a
confirmed authorized lifecycle transition; never just an expired-version 404), invalidate request
epochs and clear live/preview canvas/title, selection/tool/context, history rows/dialogs, discussion/
inbox previews, protected draft text/ranges and pending edit/comment/rename/history/lifecycle work.
No late response may paint, send or restore this state. Focus the generic ending h1, show
Returning to Home…, navigate #/files and focus generic This board is not available. status.
This is also the owner's open-board ending; it reveals no cause/deleter/deadline. A direct old
link shows generic unavailable plus Back to files, without automatic reopening. The transient
ending is cleared before Home paints; do not persist protected drafts or receipts to disk.
Ordinary active-board 4423 history restore still keeps tab drafts for explicit review.

Trash state typography/layout uses interaction v34's explicit variants: state headings14px/
21px/700; failed/denied/deleted state actions13px/19.5px/400/#79737f. Denied Trash omits the
workspace chip and retention explanation, placing its state at y136 on desktop, not below a
reserved explanation. This does not change the 24px/600 Trash heading or ordinary row buttons.

All successful operation notices use role=status, failures role=alert. Dialogs trap Tab in both
directions; disabled controls are skipped; unknown-result dialogs cannot Escape/cancel. Restore
success focuses Open board. Focus return and exact traversal are interaction v34's contract.
Team-off/local/file storage/exports remain as before, with no lifecycle HTTP requests or controls.
