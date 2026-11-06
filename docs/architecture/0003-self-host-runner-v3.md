# 0003 — Self-host runner contract

CONTRACT VERSION: 0003 self-host runner v3 (2026-11-06)

Status: Draft for 0006-W3 v1. Replaces [self-host runner v2](0003-self-host-runner-v2.md).
Its process ownership, private keys/settings, separate Supabase backup, access retention,
minute delivery and current volume-recovery rules remain. Current partners:
[hosted persistence v7](0003-hosted-persistence-v7.md), [access v7](0003-access-v7.md),
[API v7](0003-api-v7.md), [sync v8](0003-sync-v8.md), [comments v3](0005-comments-v3.md),
[lifecycle v1](0006-board-lifecycle-v1.md); unchanged toolchain v5 (Node 26.13.0/npm 11.20.0).

Both Node SQLite and Durable Object SQLite implement room layout 5, retained history chunking,
30-minute alarms, last-close captures, role checks and ordered document restore. Normal restart
preserves original capture ages/deadlines and request receipts. The server-only SQL setup adds
carry_board_mentions with explicit service privileges; no history Supabase tables or browser
service key. Schema application/deployment remains a separate operator action.

Back up current room tables including retained versions, original capture ages, request results
and independent fences, plus Supabase as a separate store. Logical room backup stays envelope 1
with layout 5 and the complete 16,777,216-byte budget/refusal. No universal backup-fit promise.
Validate before advancing a fence. Operator logical restore keeps valid retained history but
clears restored mention delivery/projection; user document restore instead carries current
notices/read state and pending work. Persist the operation kind/phase so a crash cannot confuse
the two; a failure stays locked pending explicit retry, never reports false success.

Node volume recovery stops the process, restores its data folder including independent fences,
runs mark-restored-volume.mjs, then restarts. Before clearing/carrying/unlocking, read both live
boards.document_generation and mention_delivery.generation; durably advance above both and
restored room/independent generations. Absent mention row contributes 0 only after a successful
read; either read failure/invalid value/missing board/fence-write failure keeps it locked.
For a pending user operation, carry from the live proven checkpoint to the reserved new generation
without recreating notices; for operator recovery, retain clear-notices semantics. Preserve
history age/count gates under the current server clock. Both runners' logical restart/restore
checks and Node's physical marked-volume check remain distinct evidence.
