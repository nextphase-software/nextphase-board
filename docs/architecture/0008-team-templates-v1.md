# 0008 — Team templates contract

Contract version: 1 (for 0008-W2 brief v1, 2026-11-14). Status: Draft. Depends on
[the document contract](0001-document-v15.md), [the activity catalogue](0008-activity-catalogue-v1.md),
[API v12](0003-api-v12.md) and [access v13](0003-access-v13.md); presented by
[interaction v39](0001-interaction-v39.md); modules in [web modules v37](0001-web-modules-v37.md).

A **team template** is a set of board objects that a member of a workspace saved from one of that
workspace's hosted boards, so that the workspace's members can add independent copies of it to
their boards. It is stored on the server, per workspace. It is a frozen copy: nothing links a
template to the board it came from or to the copies made from it. Local boards and the
team-features-off build have no team templates.

## Stored record

One new service table, `nextphase_board.templates`, in `apps/server/supabase/nextphase_board.sql`.
The schema file stays idempotent: running it again on an installed schema changes nothing.

| Column | Type and rule |
| --- | --- |
| `id` | `uuid` primary key, `DEFAULT gen_random_uuid()` |
| `workspace_id` | `uuid NOT NULL REFERENCES nextphase_board.workspaces(id)` |
| `name` | `text NOT NULL`, 1–120 code points, at least one non-space character, no lone surrogate, no U+0000 (the board-title rule, `validTitle`) |
| `description` | `text NOT NULL`, 0–300 code points, no lone surrogate, no U+0000 |
| `objects` | `jsonb NOT NULL`: the template's objects (below) |
| `object_count` | `integer NOT NULL CHECK (object_count BETWEEN 1 AND 250)`, equals the number of objects |
| `content_bytes` | `integer NOT NULL CHECK (content_bytes BETWEEN 1 AND 262144)` |
| `creator_id` | `uuid NOT NULL REFERENCES nextphase_board.people(id)` |
| `creator_label` | `text NOT NULL`: the creator's participant label (`labelOf(email)`, identity v4) at save time |
| `source_board_id` | `uuid NOT NULL`, no foreign key (the board may later be trashed or deleted) |
| `source_title` | `text NOT NULL`: the source board's title at the last save or replace |
| `created_at`, `updated_at` | `timestamptz NOT NULL DEFAULT now()` |

An index on `(workspace_id, updated_at DESC, id)`. Row level security is enabled with no policy for
`authenticated`: only the server's service role reads or writes the table, through the functions
below. The table is not part of any board, room, Yjs document, history version, board file,
export or logical backup. The service-table count becomes **17**.

## Objects

`objects` is a JSON array of 1–250 board objects in the current document version (document 10),
each exactly as Copy puts it on the object clipboard (`buildSnapshot` in `apps/web/src/clipboard.ts`):
every field of the object except `generation` and `order`, with `section` set to `null` unless the
section is in the set, and `group` set to `null` unless the whole group is in the set. Array order
is the board's drawing order. No `image` object is allowed (team boards hold no pictures).

**Validation**, on the server for every save and replace, and in the client before sending: build
the document `{schemaVersion: 10, boardId: <a v4 UUID>, title: "Template", objects: <each object
with order = its index and a fresh v4 generation>, retiredGenerations: []}` and run `validate()`
from `packages/board-rules/src/document.ts`; it must pass, no object may have type `image`, and no
string anywhere in `objects` may contain U+0000 (PostgreSQL text cannot store it).
`content_bytes` is the UTF-8 byte length of `JSON.stringify(objects)` as received after parsing
(the canonical compact form) and must be at most 262,144. Failures refuse the request (API v12);
nothing is stored.

## Rights

Rights use the caller's **current** workspace membership, read in the same database function call
that reads or writes the rows (no earlier check is reused), directly from `workspace_members` and
`people`, not through `list_workspaces` (which hides guests without grants):
- no membership row, or a disabled person: **404 `not_found`** (the workspace is not shown);
- an enabled `guest` member, with or without board grants: **403 `role_too_low`**;
- an enabled `owner`, `editor` or `viewer`: the rights below.
`remove_member` (access v4) deletes the row of a member who holds no board grant, so their next
template request is 404; a member who keeps board grants becomes a `guest`, so it is 403.

| Action | Who |
| --- | --- |
| List, read one | The workspace's `owner`, `editor` and `viewer` members. A `guest` member (even with board grants), an outsider and a disabled person cannot |
| Save | `owner` or `editor` of the workspace whose effective role on the source board (an active board of that workspace) is `owner` or `editor` |
| Edit details, replace, delete | The template's creator while they are still the workspace's `owner` or `editor`, and the workspace's `owner` |
| Add a copy to a board | Anyone who may read it and holds edit rights on the open board (the Templates button already requires them) |

A person whose role is removed or lowered keeps nothing: their next request is refused. Templates
they saved stay in the workspace, keep their `creator_label`, and remain manageable by the
workspace owner. Copies already added to boards are ordinary objects and are never affected.

## Limits

At most **25** templates per workspace. The count check and the insert happen in one database
function under a lock on the workspace row, so concurrent saves cannot exceed 25. Name 1–120,
description 0–300, objects 1–250, `content_bytes` at most 262,144. The request body limit is the
server's default 1,048,576 bytes.

## Database functions

`SECURITY DEFINER`, `SET search_path = ''`, executable by `service_role` only, each taking the
caller's person id. Each reads the membership as stated under Rights and raises `not_found`,
`role_too_low`, `template_limit` or `bad_request`, which the routes map as API v12 says.

| Function | Does |
| --- | --- |
| `list_templates(person, workspace)` | The workspace's templates, newest `updated_at` first then `id`, each with `can_manage`, plus the caller's `can_save` (workspace owner or editor) |
| `get_template(person, workspace, template)` | One template with `can_manage` |
| `save_template(person, workspace, board, name, description, objects, object_count, content_bytes, creator_label, source_title)` | Checks the workspace role, the board's workspace, the board role (`board_role`) and the count, then inserts |
| `update_template_details(person, workspace, template, name, description)` | Manage right; sets name, description, `updated_at` |
| `replace_template(person, workspace, template, board, objects, object_count, content_bytes, source_title)` | Manage right plus the save rule's board check; replaces objects, counts, `source_board_id`, `source_title`, `updated_at` |
| `delete_template(person, workspace, template)` | Manage right; deletes the row permanently |

The server validates objects (above) before calling a writing function; the function re-checks
`object_count` and `content_bytes` bounds through the table's constraints.

## Client rules

- The team group exists only on a hosted team board whose workspace lists the caller as owner,
  editor or viewer. The list is read each time the Templates panel opens and after each of the
  caller's own successful changes; there is no live push between people.
- **Save** takes the current selection through `buildSnapshot`, or every object on the board when
  nothing is selected, validates it (above) and sends it with the open board as `sourceBoard`.
- **Add template** first reads that one template again (`GET .../templates/:template`), then
  inserts its objects with 0008-W1's insertion rules unchanged (interaction v21 "Adding an
  activity"): placement, fresh identities and remapped internal references through
  `copyObjects`, selection, view, the notice, one Undo step. The copy carries no template id,
  creator or other provenance field; the saved document is unchanged (document v15).
- A refused read, add or change (`404` or `403`) shows the matching notice (interaction v39) and
  reads the list again; if the list itself is refused the team group disappears.
- Notices go through the hosted board's existing toast (`HostedBoard.toast()`, shown as
  `.team-toast`), the notice surface of hosted boards; App's `.notice` is not rendered there.
- Saving, editing, replacing and deleting a template are not board edits: no Undo/Redo step,
  document revision, edited-at, history version or room message.

Pre-launch: stored templates use document 10. A later document version may reset them; there is
no migration.
