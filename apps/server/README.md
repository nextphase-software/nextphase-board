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

Follow the [self-host runner contract](../../docs/architecture/0003-self-host-runner-v1.md):
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

Set `BOARD_SETTINGS` to a JSON file with `supabaseUrl`, optional `issuer`,
`serviceKey`, pinned public `jwks`, `allowedOrigin`, optional `operatorKey`,
`dataDir` and optional `port` (8788 by default). Keep service/operator keys out
of the browser. HTTPS is required except on the documented local test hosts.

```sh
docker run --rm -p 8788:8788 \
  -v <boards volume>:/data -v <settings file>:/app/settings.json:ro \
  -e BOARD_SETTINGS=/app/settings.json nextphase-board-server
```

Only one process may use a data folder. The container's `node` user must be able
to read its settings and write the volume. Put the server behind HTTPS and keep
operator routes behind the deployment's own access control as well as their key.
No image or Worker is published by these commands.

Back up the data folder and Supabase database with enough access history for
all retained backups. To restore a volume, stop the server, restore the files,
run `node apps/server/scripts/mark-restored-volume.mjs <data folder>`, then start
it. Rooms stay locked until access replay succeeds. Logical restores use the
operator API and advance a separate restore fence. Real Cloudflare point-in-time
restore and deployment checks require the hosted service and remain separate.

The Worker reads `SUPABASE_URL`, optional `SUPABASE_ISSUER`, `JWKS`,
`ALLOWED_ORIGIN`, `SUPABASE_SERVICE_KEY` and optional `OPERATOR_KEY`. Set
`BOARD_JURISDICTION` to select the deployment's jurisdiction for both namespaces.
`wrangler.json` contains local bindings and SQLite migrations, without secrets.

See the [test guide](../../tests/README.md#server-validation-0003-w1) for the
shared server suite and the [API contract](../../docs/architecture/0003-api-v1.md)
for requests, refusals and operator controls.
