# 0001 — Dependency and toolchain contract

CONTRACT VERSION: 0001 toolchain v4 (2026-10-30)

Status: Draft for 0003-W1 v1. When accepted it replaces [toolchain v3](0001-toolchain-v3.md) for
all later work. The runtime stays Node.js 26.13.0 with npm 11.20.0. The rules below replace v3's
rules on the repository's own packages, the manifest, the lock and inventory, and the commands;
every other rule of v3, and through it v2 and v1 (licensing, notices, build and serve
behaviour), still applies.

## One workspace, one lock

The repository root is an npm workspace with five members: `apps/web`, `apps/server`,
`packages/board-rules`, `packages/board-sync` and `packages/board-room`. There is one lock,
`package-lock.json` at the root; `apps/web/package-lock.json` is deleted. npm installs every
member's dependencies once, at the root, and links the members to each other.

The repository's own packages are Apache-2.0 source of this repository: each says
`"private": true`, is never published to a registry, and adds nothing to any notices file
(bundlers include their files as application source). Unlike v3, a package may declare
dependencies, because npm installs a workspace member's dependencies. A member depends on
another member by its name and its version, `0.1.0`.

## Manifests

The root `package.json`:

```json
{
  "name": "nextphase-board",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "license": "Apache-2.0",
  "engines": { "node": "26.13.0", "npm": "11.20.0" },
  "workspaces": ["apps/web", "apps/server", "packages/board-rules", "packages/board-room", "packages/board-sync"],
  "scripts": {
    "typecheck": "npm run typecheck --workspaces --if-present",
    "test": "node --test --test-reporter=tap tests/*.test.mjs",
    "test:server:node": "vitest run -c vitest.node.config.ts",
    "test:server:workerd": "vitest run -c vitest.workerd.config.ts",
    "build": "npm run build -w nextphase-board-web",
    "build:fixtures": "npm run build:fixtures -w nextphase-board-web",
    "build:server": "node scripts/build-server.mjs",
    "audit:licenses": "node scripts/check-notices.mjs"
  },
  "devDependencies": {
    "@cloudflare/vitest-plugin": "1.4.11",
    "@cloudflare/workers-types": "5.20261030.1",
    "@types/node": "26.0.0",
    "@types/ws": "8.18.2",
    "esbuild": "0.28.2",
    "supabase": "2.122.0",
    "typescript": "7.0.2",
    "vitest": "5.0.5",
    "wrangler": "4.156.0"
  }
}
```

The members' dependencies, all exact versions:

| Member | `dependencies` | `devDependencies` |
| --- | --- | --- |
| `apps/web` (`nextphase-board-web`) | `konva` 10.9.0, `react` 19.3.1, `react-dom` 19.3.1, `react-konva` 19.3.2, `yjs` 13.6.33, `nextphase-board-rules` 0.1.0, `nextphase-board-sync` 0.1.0 | `@types/react` 19.3.0, `@types/react-dom` 19.3.0, `esbuild` 0.28.2, `typescript` 7.0.2 |
| `apps/server` (`nextphase-board-server`) | `hono` 4.13.14, `@hono/node-server` 2.1.5, `jose` 6.2.14, `@supabase/supabase-js` 2.118.0, `ws` 8.22.0, `nextphase-board-rules` 0.1.0, `nextphase-board-sync` 0.1.0, `nextphase-board-room` 0.1.0 | none |
| `packages/board-rules` | none | none |
| `packages/board-sync` | `yjs` 13.6.33, `nextphase-board-rules` 0.1.0 | none |
| `packages/board-room` | `yjs` 13.6.33, `y-protocols` 1.0.7, `lib0` 0.2.119, `nextphase-board-rules` 0.1.0, `nextphase-board-sync` 0.1.0 | none |

Each member has `"name"`, `"version": "0.1.0"`, `"private": true`, `"license": "Apache-2.0"`
and `"type": "module"`; `board-sync` and `board-room` export `"./*": "./src/*"` as
`board-rules` does. `apps/web` keeps its `engines` field (Node 26.13.0, npm 11.20.0); no other
member has one. Every member with TypeScript has a `typecheck` script that runs `tsc
--noEmit` on its own `tsconfig.json`; `apps/web`'s also checks `packages/board-rules` without
browser types, as in v3. `apps/web` keeps v3's other scripts, with paths that work from its
folder.

No dependency talks to Postgres directly: the server reaches Supabase only through
`@supabase/supabase-js` over HTTPS. The Cloudflare test tool is `@cloudflare/vitest-plugin`; the
retired `@cloudflare/vitest-pool-workers` package is not used.

## Accepted lock and inventory

The accepted lock is [0001-dependency-lock-v4.json](0001-dependency-lock-v4.json), SHA-256
`0c0f248e512964df1f89b3c437ee3a25d17a18b25dab3527c17c97893c447d6d`. The root
`package-lock.json` must be byte-identical to it. Regenerate it only with the pinned npm and

```sh
npm install --package-lock-only --ignore-scripts --no-audit --no-fund
```

at the root. A change to anything in the lock is a dependency change and needs its own amended
contract.

The [v4 inventory](0001-dependency-inventory-v4.json) lists every entry of the lock (217
third-party entries and 11 workspace entries) with its version, integrity, declared licence,
whether its npm tarball has a licence file (with each file's SHA-256), and its class:

- **shipped** (23 package versions): in at least one distributed artifact, with the artifacts
  named (`web`, `node`, `worker`);
- **development tool only, not distributed** (90): installed for building or testing;
- **lock-only, not installed here, not distributed** (104): optional platform packages for other
  systems.

Every shipped package has its licence text in its npm tarball. Packages without a licence file
are all development tools or their platform binaries, and none is distributed.

## Notices for each artifact

| Artifact | Notices file | Content |
| --- | --- | --- |
| Web distribution (`apps/web/dist`) | `THIRD_PARTY_NOTICES.txt` | [Runtime notices v1](0001-runtime-notices-v1.txt), byte for byte, as before |
| Node server bundle (`apps/server/dist/node.mjs`) | `apps/server/dist/NODE_NOTICES.txt` | The "Third-party notices for NODE" section of [runtime notices v2](0001-runtime-notices-v2.txt) |
| Worker bundle (`apps/server/dist/worker.mjs`) | `apps/server/dist/WORKER_NOTICES.txt` | The "Third-party notices for WORKER" section of runtime notices v2 |

`npm run build:server` bundles both server entry points with esbuild and writes each notices
file from the bundle's own list of packages: for each package, in name order, a line
`===== <name> <version> =====`, its declared licence, and the full text of every licence file in
its folder. The build fails if a bundled package has no licence file or is not listed as
shipped for that artifact in the inventory. `npm run audit:licenses` checks all three
artifacts that exist: the web notices against v1 byte for byte, and each server notices file
against its bundle and its section of v2. A section runs from its "Third-party notices for" line
to the next such line or the end of the file; the comparison ignores blank lines at the end of
the section and of the generated file. Notices files use LF line endings: a licence file is
checked against the inventory by the SHA-256 of its original bytes, and only then written into
the notices file with every CRLF and lone CR turned into LF.

## Security advisories

`npm audit` (all dependencies) and `npm audit --omit=dev` both report no high or critical
advisory. An advisory in a development tool with no fixed version needs a written exception
accepted with the brief that meets it; no exception may cover shipped code.

## Commands

From the repository root:

| Command | Does |
| --- | --- |
| `npm ci --ignore-scripts --no-audit --no-fund` | Installs everything from the lock |
| `npm run typecheck` | Type-checks every member |
| `npm test` | The unit suite (`tests/*.test.mjs`) |
| `npm run build`, `npm run build:fixtures` | The web distribution and its fixture pages, as before |
| `npm run build:server` | The Node and Worker bundles and their notices |
| `npm run test:server:node`, `npm run test:server:workerd` | The shared server suite against each runner (needs a local Supabase stack) |
| `npm run audit:licenses` | The notices check above |

`npm --prefix apps/web <script>` keeps working for the web app's own scripts.

## Public references

Retrieved 2026-10-30: [npm workspaces](https://docs.npmjs.com/cli/v11/using-npm/workspaces),
[npm audit](https://docs.npmjs.com/cli/v11/commands/npm-audit) and
[Cloudflare Workers Vitest integration](https://developers.cloudflare.com/workers/testing/vitest-integration/).
