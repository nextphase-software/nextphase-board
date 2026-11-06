# 0003 — Hosted boards in the web app

CONTRACT VERSION: 0003 hosted storage v7 (2026-11-06)

Status: Draft for 0006-W3 v1. Replaces [hosted storage v6](0003-hosted-storage-v6.md).
Its Home/hosted states, mention editor/inbox and ordinary draft rules continue except for the
history additions here. [Interaction v33](0001-interaction-v33.md) owns exact words/look/focus;
[web modules v31](0001-web-modules-v31.md) owns boundaries. Server behaviour is
[lifecycle v1](0006-board-lifecycle-v1.md), [API v7](0003-api-v7.md), [sync v8](0003-sync-v8.md),
[comments v3](0005-comments-v3.md), [hosted persistence v7](0003-hosted-persistence-v7.md).

## History and preview state

Show version history appears in board details and Home's board card menu for all permitted roles.
Home opens the normal `#/b/<boardId>` board with a tab-memory history intent; no version URL.
One right-panel slot belongs to either Comments or Version history. Current-comments footer
explains the boundary; opening history marks nothing read. List newest first, select a row for
read-only preview. Keep the live session/model distinct; historical painting/title must never
be committed, copied to local storage or placed on board Undo. Preview stops following and
edit/comment/Undo/Redo controls; Pan/zoom work. Effective editors/owners retain their full drawn
toolbar, including disabled editing tools and Templates, through a preview-specific palette
state rather than ordinary hosted-readOnly hiding. Viewer/guest control sets remain unchanged;
preview grants no editing permission and Templates cannot open/load. Activate Pan on preview
entry (before request/paint), including viewer/guest previews, and keep it pressed through
loading/failure/expiry. Keep Pan on returning current by Back, preview Close, Review current
version or successful restore/rejoin of that previewing tab; never restore a prior tool or force Select during this
handoff. Current-role controls re-enable only on current content; later explicit tool choices
work normally. List-only history opening leaves the tool alone. Back to current version returns the latest live
content, not the head when history first opened. Save a copy continues to export current live
content only; disable it during preview to avoid implying a historical export capability.

List/preview loading or failure clears old rows/protected historical paint for that request,
without claiming empty/success. Keep Back to current available during preview loading/failure/
expiry. A 404 for a selected version clears its name/author/document and says unavailable;
whole-board access loss removes title/canvas/avatars/menus/counts/tools and focuses the generic
ending. Ignore late responses for an obsolete selection/account/access generation. Viewers and
granted viewer guests have no Save/Name/Restore controls; direct forbidden mutations get the
role refusal dialog. Refresh canonical list/head after confirmed writes.

## Save, name and restore

Optional plain-text 100/500-code-point fields and live counters follow lifecycle v1. Save uses
a once-generated request ID/body; Name is an absolute assignment to the selected retained ID.
No automatic mutation retries. Keep fields after failure/unconfirmed response for explicit Retry;
never label a version saved/named until confirmation. A failed refresh retries only its read.
Do not admit stale selection responses or names into a newly selected preview.

Restore first fetches a fresh live head, then confirms it. Where confirmation displays an
author, use selected namedBy before capture actor; both null mean time alone without a separator,
as interaction v33 defines. This is not the label of whoever now performs the restore. Cancel changes nothing. While in
flight lock editing/comments; do not dismiss by Cancel/Escape or announce success. On 409
head_changed, show the changed-head dialog, Review current version returns to refreshed live
content, then the person reselects/reconfirms with a new request/head. Never silently replace
the confirmation's expected values. An uncertain answer or restore_pending stays locked;
Retry uses the identical request/path/body. Only restore_failed (proven rollback) displays the
no-changes failure with Cancel/Retry. Retrying that failure keeps the same immutable request;
if its head changed, require review. API failures on save/name keep the dialog/fields and show
“Couldn’t save version. Your text is kept. Try again.” or
“Couldn’t save name. Your text is kept. Try again.” with Retry; no success claim.

After success show restored/current and Before restore rows in ordinal order. Other peers
show actor/Rejoining then Rejoined; rejoin clears board Undo/Redo, supersedes old edit recovery
and invalidates old comment retries. Keep unposted text/ranges in this tab for review, showing
“Unposted text kept in this tab. Nothing was sent.”; never post automatically or recreate a
deleted target. Stop following; return to current comments only after the fresh snapshot.
Sign-out/account switch/final access loss clears history and protected drafts. No history
state, pending writes or drafts are stored on disk. Team-off/local/file behaviour is unchanged.

## Local display times

Every displayed timestamp, including history rows, preview/confirmation/name dialogs, reviewed
current time and notices added here, uses the viewer's local time zone and locale. Format using
`Intl.DateTimeFormat(undefined,{year:"numeric",month:"short",day:"numeric",hour:"2-digit",
minute:"2-digit",timeZoneName:"short"})`, without setting timeZone or hour12. The browser chooses
the local zone, date order, punctuation and hour cycle. Include the zone label; no fixed UTC
suffix or hard-coded English date/time string. Use the same formatter for reviewed-at text.
Stored/API times remain server Unix milliseconds. Existing app-rendered relative comment ages
remain relative; any absolute time exposed there uses the same local-time rule. Date/time
length may wrap, preserving the approved layout widths. Retention uses elapsed server time,
never the viewer's calendar/date/DST arithmetic.
