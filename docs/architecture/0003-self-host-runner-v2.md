# 0003 — Self-host runner contract

CONTRACT VERSION: 0003 self-host runner v2 (2026-11-05)

Status: Draft for 0005-W2 v1. Replaces [self-host runner v1](0003-self-host-runner-v1.md).
V1's one-process data-folder ownership, ES256 keys, private settings, container build/run and
access-history backup procedure apply. Current contracts are [identity v4](0003-identity-v4.md),
[access v6](0003-access-v6.md), [API v6](0003-api-v6.md), [sync v7](0003-sync-v7.md),
[hosted persistence v6](0003-hosted-persistence-v6.md), [comments v2](0005-comments-v2.md) and
[toolchain v5](0001-toolchain-v5.md) (Node 26.13.0 / npm 11.20.0).

## Schema and delivery

Apply `apps/server/supabase/nextphase_board.sql` as database owner before exposing the current
service. It includes the three service-only mention tables, explicit privileges, RLS and functions
in access v6. This is the existing plain SQL setup file, not a new migrations workflow. A hosted
schema application or deployment is a separate operator action. Keep the service role key server-side.

Node and Workers use the same room `Mentions` source/projection rules. Both attempt delivery
after source saves and room loads, and run the shared minute retry pass, enumerating live boards
with at most 10 active attempts before access delivery. Node's interval is 60,000 ms; Workers'
cron is `* * * * *`. Durable pending work survives process restart and the recipient's board may
be closed. There is no email, push or account socket and no measured delivery-time guarantee.

## Backup and restore

Current rooms use layout 4. No older-client, older-file or old-binary upgrade-order requirement
applies. Preview data may be reset. Back up the room data folder **including independent restore
fences** and Supabase, which now also holds leases, projection checkpoints and reference-only
account inboxes. They are separate stores with no atomic distributed snapshot claim. Retain
access history for the oldest retained backup, as v1 requires.

A current logical room backup includes source mention tables and range JSON but not the account
inbox. Validate all current metadata before advancing the restore fence; suppress restored source
work and clear the board projection behind the new external generation. Replay access before
unlock. Supabase unavailability keeps the restored room locked, never publishes a stale preview.
Volume restore still stops the process and runs `mark-restored-volume.mjs` before restart.
On loading a marked room, read live `boards.document_generation` and
`mention_delivery.generation`; durably advance the independent generation above both, the
restored independent fence and the restored room's `meta.restore_generation`, as hosted
persistence v6 requires, **before** clearing or unlocking. A successfully read absent mention
checkpoint contributes 0; either unreadable checkpoint, a missing board row, invalid generation
or failed fence write keeps the room locked. The document copy can lag a successful mention clear;
its generation alone is not a sufficient floor. After advancement, clear the projection, replay
access and unlock only when each succeeds. S168 covers this current-format Node volume path.
The 16,777,216-byte aggregate backup ceiling and explicit 413 `backup_too_large` remain; this is
not a guarantee every legal board fits. No older backup or storage conversion is required.
