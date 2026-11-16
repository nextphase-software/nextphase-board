# 0001 — Board document contract

Contract version: 18 (for 0010-W2 brief v1, 2026-11-15). Status: Draft. When accepted it replaces
[document v17](0001-document-v17.md) for later work.

Every rule in document v17 (and, through it, documents v16 back to v1) still applies except where
this version replaces it. This version, schema version **13**, adds **pages**:

- a board holds an ordered list of **pages**, each with a stable id and a name;
- every object belongs to exactly one page, named by its new `page` key;
- no reference between objects crosses a page.

It also defines how version 1 to 12 documents are read, how a hosted board keeps exactly one page, and
which other contracts now read "13" where they read "12". How a person works with pages is
[interaction v43](0001-interaction-v43.md).

## Terms

A **page** is a value `{"id": <UUID>, "name": <string>}`. The **pages** of a board are its `pages` array
in order; the first is the **first page**. An object's **page** is the page whose `id` equals the
object's `page` value. The **default page** of a board is `{"id": <the board's boardId>, "name": "Page 1"}`.

## Saved document (version 13)

A complete version 13 document has these top-level keys, in this order: `schemaVersion` (the integer
**13**), `boardId`, `title`, **`pages`**, `objects`, `retiredGenerations`. Every key other than `pages`
keeps its version 12 rule.

| Field | Required value |
| --- | --- |
| pages | An array of **1 to 50** pages. Each page is an object with exactly the keys `id` and `name`, in that order. `id` is a lowercase UUID as document v1 defines object ids; no two pages share an `id`, and no page `id` equals any object's `id` or `generation` (it may equal the `boardId`; retired generations are not compared, so a valid version 12 board whose `retiredGenerations` holds its `boardId` still upgrades). `name` is a string of **1 to 60** code points under document v1's text rules for the board title (no control characters), equal to itself with leading and trailing white space removed. Two pages may share a name |
| page (every object) | The `id` of one of the board's pages |

**Key order of an object.** Every type keeps its version 12 keys in their order, with **`page`
inserted immediately after `type`**. This holds for the types whose saved keys are a fixed list
(stroke, image, tape) and for the types whose keys are built by version.

**One page for every reference.** A version 13 document is rejected unless:
1. a connector's `from.object` and `to.object` are on the connector's page;
2. an object whose `section` is not null is on its section's page;
3. all objects with the same non-null `group` are on one page;
4. a mind node whose parent is not null is on its parent's page.

Validation checks the whole board before it is adopted; it never repairs a reference or moves an
object between pages.

## Limits

The 250-object limit counts every object on every page together. The **2,097,152-byte payload limit** is
checked on the canonical payload **with `pages` and every object's `page` key and value left out**, so
the upgrade below never changes a board's measured size and a version 12 board that fit still fits; the
pages add at most about 15 KB beyond it (50 pages and 250 `page` keys). Every check of that limit
(`canonical`, the room's edit, snapshot, import and restore checks, local storage and board files) uses
this measure. A board holds at most 50 pages.

## Canonical payload

A version 13 document is serialized as document v17 describes, with the top-level key order above,
each page's keys in the order `id`, `name`, and each object's keys in the order above. Pages are written
in their saved order. Version 1 to 12 documents are serialized as their own contracts describe; a board
keeps the version it was read with until it is saved.

## Reading version 1 to 12 documents

The decoder accepts version 1 to 12 documents exactly as their contracts define them, and a version
13 document as defined above. When a version 1 to 12 board is opened for editing it is upgraded **in
memory** to version 13 by the earlier steps and then: `pages` becomes `[<the default page>]` and every
object's `page` becomes the board's `boardId`. The upgrade is not an edit: no draft revision,
transaction or history step, the board is not marked Unsaved, and opening never writes storage. The
next explicit Save writes version 13. A new board, local or hosted, is version 13 with `pages` equal to
`[<the default page>]`. Because the default page's id is the `boardId`, reopening an unsaved upgraded
board gives the same page id again.

## Hosted boards: one page

A hosted board has **exactly one page** (team boards get several pages in a later version). The room
refuses, with its existing `invalid_document` reason, an edit whose `pages` differs in any way from the
room's current `pages`, and an import, create or restore whose `pages` does not hold exactly one page.
Its single page may have any valid id and name; a new hosted board and every upgraded stored board get
the default page.

## Older versions of the application

An application that implements only documents v1 to v12 treats a version 13 record as an unknown
version, as document v12 says for its own successor: it shows its unsupported-data view, disables
editing and Save, draws no object from the version 13 record, and changes no board record (its board
list may record the board as `newer`).

## Version references in other contracts

Each contract below keeps every rule except its document version, which now reads **13** where
document v17 made it read 12:

- [storage v3](0001-storage-v3.md) and [board file v4](0006-board-file-v4.md): a document version
  above **13** is newer; files and records of version 1 to 13 are read. A board file holds every page
  of its board; opening it locally keeps them.
- [hosted persistence v10](0003-hosted-persistence-v10.md), [hosted storage v11](0003-hosted-storage-v11.md),
  [sync v13](0003-sync-v13.md), [board lifecycle v5](0006-board-lifecycle-v5.md) and
  [API v12](0003-api-v12.md): a room's live board, every accepted edit, history snapshot, restore,
  import and new hosted board are document version **13**, with exactly one page (above). A room that
  loads a stored version 10, 11 or 12 board upgrades it to 13 before serving it or checking any edit
  (the default page, and every object's `page` set to the `boardId`), under the rules document v16 set
  for the version 10 upgrade: not a person's edit, no edits row, person or request id, no history
  version captured for the upgrade alone, and a reload with no edit in between serves version 13
  again. Stored version 10 to 12 history snapshots and backups stay readable (the room's history checks
  accept versions 10 to 13) and are restored as version 13. The room's repair step is unchanged.
- [sync v13](0003-sync-v13.md) adapter: the board map holds `pages` as one atomic value (the whole
  array), written only when it differs from the stored value by content; each object's map holds `page`
  as a plain value beside `group` and `section`. Projection to JSON and re-creation of the adapter from
  validated JSON include both.
- [team templates v1](0008-team-templates-v1.md): stored template objects carry **no** `page` key (an
  object holding one is rejected, as one holding `generation` or `order` is); wrapping stored objects
  for validation wraps them as a version **13** document with the default page of the wrapper's board
  id and gives every object that page. Inserting a template puts its objects on the open page.
- [activity catalogue v1](0008-activity-catalogue-v1.md): an activity's payload `schemaVersion`
  stays **7**; adding one copies its objects onto a version 13 board, on the open page.

## Identity, transactions and the adapter

Document v1's identity and transaction rules apply. Moving objects to another page changes their `page`
value and keeps their ids and generations. The `order` rule is unchanged: `order` is each object's index in
the whole board's `objects` array, across all pages, so a step that deletes or inserts objects renumbers
later objects on every page while keeping their relative order; nothing else of another page's objects
changes. Adding, renaming, reordering, duplicating and deleting
pages, and moving objects between pages, are semantic changes, each committed atomically as one
transaction with one draft revision (interaction v43 says which objects each one changes). A duplicated
page's objects are new objects under document v1's rules (new ids and generations). A deleted page's
objects are deleted objects (their generations retired as for any deletion), and restoring the page
restores them with their logical ids under document v1's rule.

## Public references

Document v1's references (retrieved 2026-10-22) apply. The page keys, the reference rules, the limits
and the compatibility rules above are this project's contract.
