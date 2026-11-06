# Board server

The same HTTP app and board room run in a Cloudflare Durable Object and one Node
process. The web preview remains local-only; sign-in and hosted save screens are
not part of this server milestone.

Use Node 26.13.0 and npm 11.20.0. From the repository root:

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm run build:server
docker build -f apps/server/Dockerfile -t nextphase-board-server .
```

Follow the [self-host runner contract](../../docs/architecture/0003-self-host-runner-v3.md):
configure Supabase with ES256 signing keys and global sign-ups disabled, apply
`supabase/nextphase_board.sql` as database owner, then expose `nextphase_board`
through the Data API. Bootstrap the workspace:

```sh
SUPABASE_URL=<url> SUPABASE_SERVICE_KEY=<service role key> \
BOARD_OWNER_EMAIL=<email> BOARD_WORKSPACE_NAME=<name> \
node apps/server/scripts/setup-workspace.mjs
```

The owner signs in with an email one-time code. Invitations create confirmed
accounts without passwords and send no email; owners share invitation IDs.
The setup script refuses a workspace that already has an owner.

The repeatable SQL setup includes the service-only `mention_leases`,
`mention_delivery` and `mention_inbox` tables, their RLS, explicit privileges,
functions and access-change trigger. Apply the complete file as database owner
before exposing this service. The browser receives neither service credentials
nor inbox table access. Applying a hosted schema is a separate operator action.

Both runners try mention delivery after saved discussion actions and room loads.
The shared retry pass enumerates all live boards, with at most ten simultaneous
attempts, before the access-delivery pass. Node runs it every 60,000 ms; Workers
uses `* * * * *`. Pending work survives restart, including when the recipient has
no open board. This interval is not a delivery-time guarantee.

Set `BOARD_SETTINGS` to a JSON file with `supabaseUrl`, optional `issuer`,
`serviceKey`, pinned public `jwks`, `allowedOrigin`, optional `operatorKey`,
`dataDir` and optional `port` (8788 by default). Keep service/operator keys out
of the browser. HTTPS is required except on the documented local test hosts.

```sh
docker run --rm -p 8788:8788 \
  -v <boards volume>:/data -v <settings file>:/app/settings.json:ro \
  -e BOARD_SETTINGS=/app/settings.json nextphase-board-server
```

One server (one Worker deployment or one Node process) answers for one Supabase
dataset. Only one process may use a data folder. The container's `node` user must be able
to read its settings and write the volume. Put the server behind HTTPS and keep
operator routes behind the deployment's own access control as well as their key.
No image or Worker is published by these commands.

Back up the data folder, including `restore-fences.sqlite`, and the Supabase
database with enough access history for all retained backups. Supabase holds
the mention leases, delivery checkpoints and reference-only account inboxes;
these are separate stores, with no atomic distributed snapshot. Current rooms
use layout 5; preview data may be reset and older-format conversion is not required.

To restore a volume, stop the server, restore the files,
run `node apps/server/scripts/mark-restored-volume.mjs <data folder>`, then start
it. Before clearing or unlocking a marked room, Node reads both live
`boards.document_generation` and `mention_delivery.generation` and durably
advances the independent fence above both and the restored fence/room generations.
A successfully read absent mention checkpoint contributes zero. Either failed
read, a missing board, an invalid generation or a failed fence write keeps the
room locked. A document copy can lag a successful mention clear.

Logical restores use the operator API, validate the complete current envelope
before advancing the independent fence, and suppress restored source delivery
work. Historical mention ranges remain, without notification replay. Projection
clear at the new generation and access replay must both succeed before unlock;
service failure keeps the room locked. The complete UTF-8 backup envelope is
limited to 16,777,216 bytes: a legal board can receive 413 `backup_too_large`.
The account inbox is not part of a room backup. Real Cloudflare point-in-time
restore and deployment checks require the hosted service and remain separate.

The Worker reads `SUPABASE_URL`, optional `SUPABASE_ISSUER`, `JWKS`,
`ALLOWED_ORIGIN`, `SUPABASE_SERVICE_KEY` and optional `OPERATOR_KEY`. Set
`BOARD_JURISDICTION` to select the deployment's jurisdiction for both namespaces.
`wrangler.json` contains local bindings and SQLite migrations, without secrets.

See the [test guide](../../tests/README.md#server-validation-0003-w1) for the
shared server suite and the [API contract](../../docs/architecture/0003-api-v7.md)
for requests, refusals and operator controls.

## Document version history

Current layout 5 stores canonical document versions in `versions` and
`version_chunks`, separately from recovery snapshots and discussion. Captures are
initial, changed 30-minute checkpoints, changed last-collaborator close and manual.
Every kind shares the newest-50 / 30-elapsed-day retention gates. The durable
last-capture SHA-256 and byte count survive expiry, eviction and snapshot pruning.

User document restore keeps the board ID, current discussion and notice read state.
It raises the independent fence, closes old sessions and completes the service-only
`carry_board_mentions` operation before unlocking. `history_requests` holds bounded
metadata/results; selected/replaced intent documents live in at-most-1-MiB raw
`history_intent_chunks` rows. A pending operation refuses backup with
503 `restore_pending`; explicit identical retry resumes it. Terminal result,
intent-chunk deletion and local unlock commit together. Operator whole-room restore
instead clears mention source/projection. Keep these recovery paths distinct.

Logical backups include valid retained history with original capture times and
fingerprint metadata. The complete serialized UTF-8 envelope, including base64 and
all metadata, remains limited to 16,777,216 bytes. Fifty 2-MiB documents alone are
100 MiB: legal history can explicitly refuse backup with 413 `backup_too_large`.
An oversized restore body returns 413 `body_too_large`. This is no universal backup
fit guarantee. Current restart and supported recovery retain history age gates;
no older-client, board/file conversion, schema application or deployment is part
of implementation validation.
