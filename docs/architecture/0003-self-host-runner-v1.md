# 0003 — Self-host runner contract

CONTRACT VERSION: 0003 self-host runner v1 (2026-10-30)

Status: Draft for 0003-W1 v1. It defines how someone runs the Board server on their own
machine, with their own Supabase, and what they are responsible for. The server behaves as the
[identity](0003-identity-v1.md), [access](0003-access-v1.md), [API](0003-api-v1.md),
[sync](0003-sync-v1.md) and [hosted persistence](0003-hosted-persistence-v1.md) contracts say,
exactly as on Cloudflare.

## What runs

One Node.js process serves every route and every board's room. Each board is one SQLite file in
the data folder (`/data/boards/<board id>.sqlite` in the container), and the restore fences are
`/data/restore-fences.sqlite`. The process handles one board's messages one at a time, in
order.

**Only one server process may use a data folder.** Two processes on the same files can break the
order of edits and access changes; running several is not supported.

## Build

With Node.js 26.13.0 and npm 11.20.0 ([toolchain v4](0001-toolchain-v4.md)), from the
repository root:

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm run build:server
docker build -f apps/server/Dockerfile -t nextphase-board-server .
```

The Dockerfile's base image is pinned by digest. The project publishes no image; you build your
own.

## Supabase

Use a Supabase project of your own, hosted or self-hosted:

1. **Signing keys.** The project must sign access tokens with an asymmetric ES256 key and publish
   its public keys at `/auth/v1/.well-known/jwks.json`. A self-hosted stack set up only with the
   default shared (HS256) secret is not enough; add an asymmetric key as Supabase's self-hosting
   guide describes.
2. **Schema, then exposure.** Run `apps/server/supabase/nextphase_board.sql` against the
   database as plain SQL (for example with `psql`), as a database owner. Only after it succeeds,
   add `nextphase_board` to the schemas the Data API exposes. Never expose the schema first, and
   do not add the file to a migrations folder.
3. **Sign-ups.** Turn off "Allow new users to sign up" for the whole project. Do not turn off
   only the email provider's sign-up: that also stops existing people signing in by email. Keep
   email sign-in on. People get accounts only when the workspace owner invites them.
4. **The first workspace.** Run

   ```sh
   SUPABASE_URL=<url> SUPABASE_SERVICE_KEY=<service role key> \
   BOARD_OWNER_EMAIL=<email> BOARD_WORKSPACE_NAME=<name> \
   node apps/server/scripts/setup-workspace.mjs
   ```

   It creates the owner's account if there is none (confirmed, with no password; they sign in
   with a one-time code sent to that email), then the workspace with that person as owner. It refuses to run if the workspace
   already has an owner.

The service role key gives full access to the database. It belongs only in the server's
settings and in the setup command, never in a browser.

## Settings

The server reads one JSON file named by the `BOARD_SETTINGS` environment variable:

| Key | Value |
| --- | --- |
| `supabaseUrl` | The project's HTTPS URL |
| `issuer` | Optional; the `iss` its tokens carry, by default `<supabaseUrl>/auth/v1` (identity contract) |
| `serviceKey` | The service role key |
| `jwks` | The project's public keys as a JSON Web Key Set (the pinned set in the identity contract) |
| `allowedOrigin` | The one browser origin that may call the server, for example `https://board.example.com` |
| `operatorKey` | Optional; enables the operator routes |
| `dataDir` | The data folder (`/data` in the container) |
| `port` | The port to listen on (default 8788) |

Plain `http://` URLs are refused, except for `localhost`, `127.0.0.1` and
`host.docker.internal`, which only local tests use.

## Run

```sh
docker run --rm -p 8788:8788 \
  -v <boards volume>:/data \
  -v <settings file>:/app/settings.json:ro \
  -e BOARD_SETTINGS=/app/settings.json \
  nextphase-board-server
```

The container runs as the image's `node` user, which must be able to write the volume and read
the settings file. Put the server behind HTTPS, and keep the operator routes behind your own
access control as well as the operator key.

## Backups

Back up three things together: the data folder (board files and the fence file), and the
Supabase database (people, workspaces, roles and the access history). Keep the access history
at least as long as your oldest board backup (hosted persistence contract, "Keeping the access
history").

To restore a copy of the data folder: stop the server, put the files back, run
`node apps/server/scripts/mark-restored-volume.mjs <data folder>`, then start the server. Each
restored room stays locked until it has caught up with the access changes since its backup.

## Supabase's own components and licences

Supabase's Docker setup at commit `e79adc4a42c5020fc6c2ba74a3f6c9af57fb4ba5` of `supabase/supabase`
(`docker/docker-compose.yml`) uses these images. The licence of each, read from its project's
repository at that version, is:

| Component | Image | Licence |
| --- | --- | --- |
| Studio | `supabase/studio:2026.10.12-sha-3699278` | [Apache-2.0](https://github.com/supabase/supabase/blob/e79adc4a42c5020fc6c2ba74a3f6c9af57fb4ba5/LICENSE) |
| API gateway | `envoyproxy/envoy:v1.39.1` | [Apache-2.0](https://github.com/envoyproxy/envoy/blob/v1.39.1/LICENSE) |
| Auth | `supabase/gotrue:v2.197.0` | [MIT](https://github.com/supabase/auth/blob/v2.197.0/LICENSE) |
| Data API | `postgrest/postgrest:v14.18` | [MIT](https://github.com/PostgREST/postgrest/blob/v14.18/LICENSE) |
| Realtime | `supabase/realtime:v2.143.3` | [Apache-2.0](https://github.com/supabase/realtime/blob/v2.143.3/LICENSE) |
| Storage | `supabase/storage-api:v1.81.0` | [Apache-2.0](https://github.com/supabase/storage/blob/v1.81.0/LICENSE) |
| Image proxy | `darthsim/imgproxy:v3.31.4` | [MIT](https://github.com/imgproxy/imgproxy/blob/v3.31.4/LICENSE) |
| Database metadata | `supabase/postgres-meta:v0.100.0` | [Apache-2.0](https://github.com/supabase/postgres-meta/blob/v0.100.0/LICENSE) |
| Edge functions | `supabase/edge-runtime:v1.77.4` | [MIT](https://github.com/supabase/edge-runtime/blob/v1.77.4/LICENSE) |
| Database | `supabase/postgres:17.6.1.136` | [PostgreSQL](https://github.com/supabase/postgres/blob/17.6.1.136/LICENSE) |
| Connection pooler | `supabase/supavisor:2.9.13` | [Apache-2.0](https://github.com/supabase/supavisor/blob/v2.9.13/LICENSE) |

This lists component licences, not every package inside each image. Licences can change between
versions (the image proxy's main branch is now Apache-2.0), so check the versions you deploy.

## Public references

Retrieved 2026-10-30: [Supabase self-hosting with Docker](https://supabase.com/docs/guides/self-hosting/docker),
[Supabase self-hosted auth keys](https://supabase.com/docs/guides/self-hosting/self-hosted-auth-keys),
[Supabase using custom schemas](https://supabase.com/docs/guides/api/using-custom-schemas)
and [Node.js `node:sqlite`](https://nodejs.org/docs/latest-v26.x/api/sqlite.html).
