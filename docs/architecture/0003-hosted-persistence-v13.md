# 0003 — Hosted persistence contract

CONTRACT VERSION: 0003 hosted persistence v13 (2026-11-25)

Status: Draft for 0012-W6 v1. Replaces [persistence v12](0003-hosted-persistence-v12.md), whose service tables,
fences, journals, chunking, fingerprints, limits, recovery reservation, workshop, picture and video rules remain word
for word except as below. Room layout stays **9**; document schema stays **15**. This version keeps the staging of a
board-file import and the pictures of team templates ([hosted storage v15](0003-hosted-storage-v15.md)).

## Service schema (`apps/server/supabase/nextphase_board.sql`)

The schema file stays one idempotent script, applied twice by `tests/server/setup.ts` (lines 21–23). Exactly these
changes, so that running the file again on a database that already has them changes nothing and leaves **one**
signature per changed function:

1. **`create_board`**: the file runs `DROP FUNCTION IF EXISTS nextphase_board.create_board(uuid, uuid, text);` and
   creates `create_board(workspace uuid, person uuid, title text, board uuid DEFAULT NULL)`. Without `board` it is
   today's function word for word (the id from `gen_random_uuid()`, the tombstone check raising
   `service_unavailable`; no role check, as today). With `board` it first locks the workspace row and raises
   `not_found` unless `person` is a member of the workspace who is not disabled, `role_too_low` (DETAIL `editor`)
   unless that member is an `owner` or `editor`, raises `board_exists` when a `boards` row has that id, raises `service_unavailable` when the id is in
   `deleted_board_ids`, and inserts the row with that id. Three-named-argument callers keep working (the default).
2. **`discard_import(board uuid, workspace uuid)`** (new, service role only): inserts `(board_id, workspace_id,
   generation) = (board, workspace, 0)` into `deleted_board_ids` with `ON CONFLICT (board_id) DO NOTHING`, then deletes any `boards` row with that id and its
   `board_lifecycle` row, in one transaction. Because `create_board` and the lifecycle trigger both refuse a tombstoned
   id, an insert that was still in flight when the server gave up can never commit a board afterwards.
3. **`templates.store uuid`** (nullable, no default): `ALTER TABLE nextphase_board.templates ADD COLUMN IF NOT EXISTS
   store uuid;`.
4. **Template functions**, each dropped by its exact old signature before it is created:
   - `save_template(person uuid, workspace uuid, board uuid, name text, description text, objects jsonb, object_count
     integer, content_bytes integer, creator_label text, source_title text)` becomes the same plus `store uuid DEFAULT
     NULL`, written to the row;
   - `replace_template(person uuid, workspace uuid, template uuid, board uuid, objects jsonb, object_count integer,
     content_bytes integer, source_title text)` becomes the same plus `store uuid DEFAULT NULL`; it writes `store`
     (null when not given) and its JSON answer gains `previousStore` (the old value, or null);
   - `delete_template(person uuid, workspace uuid, template uuid)` keeps its signature (`CREATE OR REPLACE`); its JSON
     answer gains `store`;
   - `get_template(person uuid, workspace uuid, template uuid)` keeps its signature; its answer includes `store`;
   - `list_templates(person uuid, workspace uuid)` keeps its signature and projects `to_jsonb(t) - 'store'`, so the
     list never carries `store`.
   Rights, limits (25 a workspace, 1–250 objects, 1–262,144 bytes) and errors are otherwise unchanged.

The file's blanket grants (`REVOKE ALL ON ALL FUNCTIONS … FROM PUBLIC, anon, authenticated; GRANT EXECUTE ON ALL
FUNCTIONS … TO service_role`, lines 1035–1036) stay last and cover the new signatures; nothing else in the file
changes. The service table count stays **17**. `apps/server/src/supabase.ts` passes the new arguments, reads `store`
and `previousStore`, maps `board_exists` to 409 `import_in_progress`, maps `create_board`'s `role_too_low` with its
DETAIL as `needed` (so `needed: "editor"`), adds `discardImport(board, workspace)`, and never puts `store` in a response body; its
other mappings are unchanged.

## How long staged files are kept

| Store | Kept while | Removed |
| --- | --- | --- |
| A room in the importing state | Until its deadline (hosted storage v15, "Staging deadlines"), or until `create` turns it into a board | At its deadline (60,000 ms after the last activity): the room's alarm answers discard and the runner erases it as `removeRoom` does (the Durable Object's `deleteAll()` and alarm deletion; on Node the `.sqlite`, `-wal` and `-shm` files). A failed finish erases it through API v15's existing clean-up |
| A template store in `staging` | Until its deadline | At its deadline: erased the same way (`TemplateMedia`'s `deleteAll()`; on Node its three files) |
| A committed template store | While a template row names it | When its template is deleted or replaced (API v15), or when the save that committed it is refused for certain (an unknown SQL outcome removes nothing) |

Assets of an imported board, once created, follow persistence v12's rules unchanged: the board refers to them, so they
are live; any staged asset the document does not name is an unused upload kept 24 hours from the create.

**Known limits (pre-launch, accepted at G1):**
- On Node, a runner stopped while a room or store is staging loses its in-memory timer; the staging file stays until
  something opens it (which re-arms the alarm and erases it at once, hosted storage v15) — there is no start-up sweep.
  Nothing in it is reachable: it has no board or template row.
- `apps/server/scripts/mark-restored-volume.mjs` (the Node volume-restore marker) skips, and deletes with its `-wal`
  and `-shm` files, every `boards/*.sqlite` whose `meta` holds `import` and no `storage_version`, so no recovery marker
  is ever written into a staging; it marks every other file exactly as today and counts only those.
- A committed store whose removal failed, or whose workspace was deleted with its templates, is left without a row
  that names it. It is unreachable and holds at most 20 MiB.

## Backups

Unchanged for boards: an imported board's pictures and videos are its own, backed up and restored by persistence
v12's rules. A room in the importing state has no board and is never backed up (the importing gate refuses `backup()` with 404,
hosted storage v15). **Template stores are not in the operator backup** (decision D8 of the scope, pre-launch): the
operator's backup and restore routes are unchanged, and a template whose store is lost still lists, but adding it
fails with `its pictures could not be loaded` ([interaction v51](0001-interaction-v51.md)).

## Limits

| Stored value | Bound |
| --- | --- |
| One import's opened list | 1 to 1,000 entries; pictures ≤ 52,428,800 bytes and videos ≤ 104,857,600 bytes in all (a board's budgets) |
| One template store | ≤ 20,971,520 bytes in all, pictures, first frames and videos together; 1 to 1,000 entries |
| Staging idle time | 60,000 ms (`UPLOAD_IDLE`, reused) |

Measure on both runners: an import of 52,428,800 bytes of pictures and 104,857,600 bytes of videos completes and the
board serves every file byte for byte; an import abandoned after its first upload leaves no row and no room storage
once the idle time and the alarm have passed; a template store of 20,971,520 bytes commits, reads back and is erased
when its template is deleted.
