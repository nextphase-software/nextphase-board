# 0003 — Hosted boards in the web app

CONTRACT VERSION: 0003 hosted storage v12 (2026-11-16)

Status: Draft for 0010-W3 v1. Replaces [hosted storage v11](0003-hosted-storage-v11.md), whose rules
remain word for word except as below. This version adds the room storage changes that pages on hosted
boards need ([document v19](0001-document-v19.md), [sync v14](0003-sync-v14.md),
[workshop voting v3](0007-workshop-voting-v3.md)).

## Room storage version 8

The room's `storage_version` meta value moves from **7 to 8**. A room accepts stored version 0 (new), 7
or 8, and refuses any other value with `storage_unsupported` as today.

| Change | Rule |
| --- | --- |
| `workshop_vote.page` | A new nullable `TEXT` column after `targets`: the running or revealed round's page id, null when idle. Storage initialization **ensures** it: a new table is created with it, and an existing table without it gains it (checked with `PRAGMA table_info`, so running twice changes nothing) |
| Upgrade from 7 | The physical column (above) and the stored version are separate. Whenever the room loads, or finishes restoring a backup, with `storage_version` 7 in its meta, it runs inside one transaction: **reset the round to idle** (the existing reset, which also clears its ballots; pre-launch, no round is carried over); convert the shared document's old `pages` value as sync v14 says; write a snapshot at the current revision; set `storage_version` to 8. None of this is a person's edit: no edits row, receipt, revision, history version or comment change |
| Backups | `decodeBackup` (`backups.ts`) accepts envelopes whose `storage_version` is **7 or 8**, with every other envelope and table check unchanged. A version 7 backup restores and then runs the upgrade above. A new backup records 8 |

No other table or column changes. The backup envelope stays version 1. The 17 service tables and their schema are
unchanged: no service migration.

## Web client

The hosted page state is the same `use-pages.ts` owner as for local boards
([web modules v42](0001-web-modules-v42.md)):
- the open page is per tab;
- the remembered page uses the same `localStorage` key, `nextphase-board/page/v1/<boardId>`, with errors
  ignored;
- a hosted board opens on the remembered page if it exists, else on the first page.

Opening a page is never sent to the room except as the presence frame's `page`
([presence v5](0004-presence-v5.md)). A history preview opens on the open page if the previewed version
has it, else on its first page. Leaving the preview returns to the page that was open before it, if it
still exists.
