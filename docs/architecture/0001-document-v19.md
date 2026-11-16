# 0001 — Board document contract

CONTRACT VERSION: 0001 document v19 (2026-11-16)

Status: Draft for 0010-W3 v1. When accepted it replaces [document v18](0001-document-v18.md) for later
work. Every rule of v18 stays word for word except **"Hosted boards: one page"**, which this version
replaces. The saved format does not change: documents stay **schema version 13**, with the same keys, page
rules, reference rules, limits, canonical order and reading of versions 1 to 12. No other contract's
version reference changes because of this version.

## Hosted boards: several pages

A hosted board may hold **1 to 50 pages**, exactly as a local board (v18 "Pages"). The room accepts an edit
that adds, renames, reorders or deletes pages, or changes an object's `page`, when the resulting board
passes `validate` and the room's existing size and transition checks. It no longer compares `pages` with
its current value. An import, create or restore with any valid number of pages is accepted on the same
terms. A new hosted board still starts with the default page, and a stored older board still upgrades to
the default page (v18 "Reading versions 1 to 12").

An edit whose result would put an object on a page that does not exist fails `validate`. The room refuses
it with its existing `invalid_document` reason. This happens, for example, when someone adds an object to
a page that another person deleted at the same moment. The room never recreates a page or moves an object
to repair such an edit.

How `pages` is held in the room's shared document is [sync v14](0003-sync-v14.md)'s concern. The saved and
exported document is always the v18 `pages` array.

## References

Unchanged from v18. The team rules of pages (presence, comments, voting, templates) are in
[presence v5](0004-presence-v5.md), [comments v5](0005-comments-v5.md),
[workshop voting v3](0007-workshop-voting-v3.md), [team templates v2](0008-team-templates-v2.md) and
[interaction v44](0001-interaction-v44.md).
