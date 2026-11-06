# 0003 — Hosted boards in the web app

CONTRACT VERSION: 0003 hosted storage v6 (2026-11-05)

Status: Draft for 0005-W2 v1. Replaces [hosted storage v5](0003-hosted-storage-v5.md).
V5's hosted-board endings, comment mode, pins, author controls, save states and explicit comment
retry apply except for the additions here. [Interaction v32](0001-interaction-v32.md) defines
all new copy, look, keys and focus; [web modules v30](0001-web-modules-v30.md) defines placement.
Server contracts are [API v6](0003-api-v6.md), [sync v7](0003-sync-v7.md),
[access v6](0003-access-v6.md), [identity v4](0003-identity-v4.md),
[comments v2](0005-comments-v2.md) and [hosted persistence v6](0003-hosted-persistence-v6.md).

## Editor and in-memory drafts

New comment, reply and own-comment edit fields are contenteditable textboxes with atomic
`contenteditable=false` blue mention spans. Typing `@` at field start or after whitespace opens
the permitted picker; insertion and editing follow interaction v32. Plain-text copy/cut/paste
never carries recipient metadata. Preserve actual line feeds (including native editable blocks),
normalize text before computing code-point ranges and preserve caret/focus through roster responses.
Board shortcuts, clipboard commands and Undo/Redo do not reach the board while editing a field.

The picker works only while joined with comments loaded and connected; reconnect refreshes
candidates. Post/Save are off while offline, before comments load and while sent/unconfirmed.
Keep text, chips and immutable unconfirmed request in tab memory; no automatic resend or disk
queue. Explicit Retry uses sync v7's exact stored message/epoch/generation. Refusals keep text
and ranges; newly unavailable recipients show the exact interaction v32 refusal. A retained
historical range is permitted, not a stale newly selected target. At pending cap show the pending
capacity words, without reporting the comment saved.

Notification navigation temporarily switching between threads on the **same board** keeps drafts
in tab memory and restores them on return, overriding v5's discard-on-switch rule for this path.
This includes using Board → Back to files while the draft's card remains open, opening another
notice, then returning through the original thread's notice in the same loaded tab. Ordinary
card Close/Escape still discards its draft as v5 specifies; a page reload does not preserve tab
memory. Notification navigation is not a general persistence exception for closed drafts.
Changing boards uses the existing board leave decision for unsaved edits; unposted comments do
not add a new leave question. Clear drafts, roster, inbox and pending actions on sign-out,
account change or known final access loss. Nothing is written to IndexedDB/localStorage beyond
existing Auth/settings. Local boards and team-off builds have no mention editor or inbox.

## Home Notifications

A Home-only bell beside the account control opens the account-wide latest 50 mention references.
Refresh on Home entry, focus/visibility, panel open and every **30 seconds while Home is visible**.
Unresolved actions survive those refreshes in memory. Opening the panel changes no read state.
The bell dot means at least one **last confirmed retained notice** is unread; loading/failure
keeps that last dot, clears previews and never claims a fresh empty list. The panel offers
per-row Mark as read/unread and Dismiss notification, plus Mark all as read for its retained
ID/version snapshot. No pagination, inline reply or preferences.

Until confirmation, rows and dots stay; pending/failure words and explicit Retry are visible.
Freeze an action's body for Retry. After confirmed POST, refresh the canonical list so an obsolete
CAS cannot falsely override a newer browser action. If that read fails, Retry the read only and
show no cached preview as current. Persisted state is per account and survives a new browser.
Newly arriving notices are outside a pending Mark-all cutoff and stay unread.

## Explicit display and navigation

Open via API v6 in this tab and use normal `#/b/<boardId>` board-open/access/leave handling.
After the comments snapshot finishes, enter comment mode, temporarily reveal the target pin
through hidden/resolved filters, pan to its authoritative current point, open the thread and
scroll to the exact comment. Keep zoom; apply the existing list-open centring (140 px left of
centre at width 768 or more). Focus heading first, then Reply, without typing, posting or
reopening. A resolved landing uses interaction v32's special resolved sentence. Detached landing
uses saved point and omits the redundant unlink icon in card/list while keeping the pin badge.
Escape returns to the source notice if still available, otherwise the canvas. Normal thread
entry keeps its existing Reply autofocus and header controls.

Only fully visible comment rows after an **explicit thread or notice open** are reported to
`POST /boards/:board/mentions/displayed`, using full-row IntersectionObserver visibility.
Only their retained mention references become read, after server confirmation. Merely opening
Comments, Home or the inbox reads none. Denied/deleted open shows the one generic unavailable
sentence, removes the stale item and reveals no title/author/text; service failure instead keeps
the reference and offers Retry without a current preview.

## Comments filters and unread

Only your threads means started, replied to **or mentioned in**, by the account's board person
key, including historical saved ranges. Unread badges/counts are retained **unread mention
notices**, never ordinary replies. Add the Oldest first / Unread mentions first radio sort group;
default Oldest first. Unread-first orders threads with unread mentions first, then uses thread
sequence within each group. It does not hide read threads. These filter/sort choices remain
per-open-tab memory and do not write a board edit. Exact words and states are interaction v32.
