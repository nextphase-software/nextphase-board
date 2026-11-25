# 0001 — Dependency and toolchain contract

CONTRACT VERSION: 0001 toolchain v6 (2026-11-25)

Status: Draft for 0012-W5 v1. When accepted it replaces [toolchain v5](0001-toolchain-v5.md) for all later work.
Every rule of v5 (and through it v4, v3, v2 and v1) still applies except the one change in section 5 below: the web
build's **`BOARD_LINK_PREVIEW_URL`** setting and the `connect-src` origin it adds. No dependency, manifest, lock,
inventory or notices file changes: the lock stays [lock v5](0001-dependency-lock-v5.json), the inventory
[inventory v5](0001-dependency-inventory-v5.json) and the web notices runtime notices v1 (switch off) and v3 (switch
on). Sections 1 to 4 and the sections after them are v5's text.

**Carried from v5 (2026-11-01):** v5 replaced [toolchain v4](0001-toolchain-v4.md). Every rule of v4 (and through it
v3, v2 and v1) still applies except the four changes below: one web dependency, the web package's library declaration
check, the web build's team features switch, and the lock, inventory and web notices that follow.

## 1. One new web dependency

`apps/web`'s `dependencies` gain `@supabase/auth-js` **2.118.0** (exact), licence **MIT**. Its one
dependency is `tslib` **2.8.1**, licence **0BSD**. Both are already in the v4 lock (the server's
`@supabase/supabase-js` 2.118.0 uses them), so the lock gains no package entry or version: only
the `apps/web` workspace entry's `dependencies` gains the line. With it, v4's members table
reads, for `apps/web`: `@supabase/auth-js` 2.118.0, `konva` 10.9.0, `react` 19.3.1, `react-dom`
19.3.1, `react-konva` 19.3.2, `yjs` 13.6.33, `nextphase-board-rules` 0.1.0, `nextphase-board-sync`
0.1.0. Nothing else in any manifest changes.

The web app uses only `AuthClient` from it (hosted storage v1); it never uses Supabase's database,
storage, functions or realtime clients, and never imports `@supabase/supabase-js`.

## 2. Library declarations in the web package

`@supabase/auth-js` 2.118.0's WebAuthn declarations do not type-check against TypeScript 7.0.2's
DOM library (error TS2430). `apps/web/tsconfig.json` therefore sets `"skipLibCheck": true`
(it was `false`); every other option stays. This skips checking `.d.ts` files only: every
application source file in `apps/web/src` and `tests/browser` is still checked with `strict`.
The web package's second check (`tsc --noEmit -p ../../packages/board-rules`), the server and
the three packages keep `skipLibCheck` as in v4. No `@ts-ignore`, `@ts-expect-error` or
`any`-cast is used to silence an Auth JS type.

## 3. The web build and its switch

`npm run build` reads `BOARD_TEAM_FEATURES`, `BOARD_SUPABASE_URL`, `BOARD_SUPABASE_ANON_KEY`
and `BOARD_SERVER_URL` from its environment, as [0003 hosted storage v1](0003-hosted-storage-v1.md)
"Team features switch" says. The settings are read and checked in `scripts/team-settings.mjs`
(new), which exports one function from the environment to either `null` (off) or the three
settings; `scripts/build-web.mjs` passes the result to esbuild as compile-time constants and,
when on, writes `index.html` with the widened `connect-src` instead of copying it. Off, the
build's outputs other than `app.js` and `meta.json` are as in v4: `index.html`, `style.css`
(which may gain the team features' rules) and the notices file. `npm run build:fixtures` always
builds with the switch off, whatever the environment says.

## 4. Lock, inventory and notices

The accepted lock is [0001-dependency-lock-v5.json](0001-dependency-lock-v5.json), SHA-256
`784f31095d70e1388d129d4d42cb3918dcdc44415c0a2d61a98851c1cc841c4c`: v4's lock with the one
added line (`"@supabase/auth-js": "2.118.0"` in `packages["apps/web"].dependencies`). The root
`package-lock.json` must be byte-identical to it. It is produced with the pinned npm by

```sh
npm install -w nextphase-board-web --save-exact @supabase/auth-js@2.118.0 --ignore-scripts --no-audit --no-fund
```

and regenerated afterwards only with v4's `npm install --package-lock-only` recipe.

The [v5 inventory](0001-dependency-inventory-v5.json) is v4's with `documentVersion` 5, its date
and status, `rootLockSha256` of the v5 lock, `web` added to the `artifacts` of
`@supabase/auth-js` 2.118.0 and `tslib` 2.8.1 (and to `summary.artifactPackages.web`), and the
dependency added to the `apps/web` workspace entry. The counts are unchanged: 217 third-party
entries, 23 shipped package versions, 90 development tools, 104 lock-only.

Notices for the web distribution:

| Build | `apps/web/dist/THIRD_PARTY_NOTICES.txt` |
| --- | --- |
| Switch off | [Runtime notices v1](0001-runtime-notices-v1.txt), byte for byte, as before |
| Switch on | [Runtime notices v3](0001-runtime-notices-v3.txt), byte for byte: v1 followed by the full licence texts of `@supabase/auth-js` 2.118.0 and `tslib` 2.8.1 |

The server notices ([runtime notices v2](0001-runtime-notices-v2.txt)) are unchanged.
`scripts/check-notices.mjs` checks the lock against lock v5 and bundles against inventory v5; it
expects runtime notices v3 when the web bundle has an input from `@supabase/auth-js`, and v1
otherwise. `npm run audit:licenses` therefore passes after either build.

## 5. The link preview service setting (v6)

New in v6. `npm run build` also reads **`BOARD_LINK_PREVIEW_URL`** from its environment, in `scripts/build-web.mjs`
(no new script file). It names the origin of the [link preview](0012-link-preview-v1.md) service that single-user
boards ask (`POST <origin>/link-preview`, [API v16](0003-api-v16.md)).

**Accepted values.** Unset or the empty string means **unset**. Otherwise the value must equal
`new URL(value).origin` exactly (no path, query, fragment, user name or trailing `/`) and be either:
- an `https:` origin, for example `https://board-api.example.com`; or
- for tests only, `http://127.0.0.1:<port>`, with that exact host and an explicit port.

Anything else **fails the build**: `build-web.mjs` exits non-zero before esbuild runs, with a message naming
`BOARD_LINK_PREVIEW_URL` (never echoing other settings).

**What it changes.**

| | Unset | Set to `<origin>` |
| --- | --- | --- |
| Compile-time constant `BOARD_LINK_PREVIEW_URL` (esbuild `define`, next to `BOARD_TEAM_SETTINGS`) | `null` | `"<origin>"` |
| Built `index.html`, team switch off | Copied unchanged: `connect-src 'none'` | `connect-src 'none'` replaced by `connect-src <origin>` (exactly that one origin) |
| Built `index.html`, team switch on | v5's `connect-src <supabaseUrl> <serverUrl> <ws serverUrl>` | v5's list with ` <origin>` appended, unless that exact origin is already in it |
| `img-src`, `media-src` and every other directive | Unchanged (`img-src 'self' data:`) | Unchanged: the page never loads a picture from a pasted site or from the service |
| Single-user boards | Make link-only cards at once and fetch nothing; the About popover's link line is not shown | The single-user app's preview client calls `<origin>/link-preview` (`POST`, `Content-Type: application/json`, `credentials: "omit"`, no `Authorization`); the About line names the service ([interaction v52](0001-interaction-v52.md)) |
| Team boards (switch on) | Unchanged by this setting: they call `POST <BOARD_SERVER_URL>/boards/:board/link-preview` with the person's bearer token | The same |

`npm run build:fixtures` always builds with the setting unset, whatever the environment says, as it does with the team
switch. The source `apps/web/index.html` is not edited; the build rewrites its copy in `dist`. The built `app.js` and
`meta.json` differ only by the constant; the notices file is chosen exactly as in section 4.

**Checks.** A team-off build without the setting keeps `connect-src 'none'`. With
`BOARD_LINK_PREVIEW_URL=http://127.0.0.1:<port>` its `connect-src` is exactly that origin and `img-src` is unchanged.
A team-on build's `img-src` is unchanged with or without it. `npm run audit:licenses` passes after each.

**Deployment note.** The setting is read only at build time, so a deployment's single-user build has previews only
when that build is **given** `BOARD_LINK_PREVIEW_URL`. A deployment that serves single-user boards with previews must:
1. pass `BOARD_LINK_PREVIEW_URL=<the server's https origin>` to the `npm run build` that produces the single-user
   app (a build run without it makes link-only cards and is not an error);
2. list the single-user app's origin in the server's `LINK_PREVIEW_ORIGINS` (Workers) or `linkPreviewOrigins` (Node)
   ([self-host runner v11](0003-self-host-runner-v11.md)), together with the server prerequisites there (the
   `LinkLimits` binding and migration, the compatibility flag);
3. after deploying, check two things on the deployed single-user app: the **served page's CSP** (the
   `Content-Security-Policy` of the `index.html` it actually serves) has a `connect-src` that lists that origin; and
   **one preview request from the deployed page's origin** (`POST <origin>/link-preview` with that page's `Origin`
   and `{"url": "<a public page>"}`) answers 200 with `Access-Control-Allow-Origin` equal to the page's origin.
   Either check failing means the build or the server setting is missing; the deployment is not complete until both
   pass.

## Security advisories

v4's rule applies. `npm audit` and `npm audit --omit=dev` report no high or critical advisory
with the v5 lock (no package version changed).

## Public references

Retrieved 2026-11-01: [@supabase/auth-js on npm](https://www.npmjs.com/package/@supabase/auth-js)
(version 2.118.0, MIT), [tslib on npm](https://www.npmjs.com/package/tslib) (2.8.1, 0BSD),
[TypeScript `skipLibCheck`](https://www.typescriptlang.org/tsconfig/#skipLibCheck) and
[esbuild `define`](https://esbuild.github.io/api/#define).
