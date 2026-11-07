# 0001 — Board document contract

CONTRACT VERSION: 0001 document v13 (2026-11-07)

Status: Draft for 0006-W4 v1. Replaces [document v12](0001-document-v12.md). Its narrow
server-only authorized history replacement, seen-ID union, ordinary transition rules and
current version-10 canonical validation/2,097,152-byte ceiling remain.
[Lifecycle v2](0006-board-lifecycle-v2.md) gates that exception on active authority, including
pending replacement/result completion; a later lifecycle fence cannot be crossed by a restored
history intent. A pending accepted document restore settles before admitting Move.

Restoring from Trash is an availability transition on the same board ID/link/workspace. It
neither replaces nor clones the document, imports a file, changes its confirmed revision,
revives object IDs through the history exception nor creates a history checkpoint. Keep its
current objects/retired identities/identifier union and current discussion/history separately.
The higher transport/access generation fences old tickets/work without changing canonical
saved content. Permanent deletion removes document/recovery/identifier stores; initialization
or operator recovery cannot reuse a registered deleted board ID.

Local records, JSON exports and Board files continue to carry document content only, without
Trash, history, comments, grants or lifecycle registers. No document field or ordinary edit flag
can invoke deletion or history replacement. All validation concerns the current saved format.
