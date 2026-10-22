# 0001 — Dependency and toolchain contract

CONTRACT VERSION: 0001 toolchain v1 (2026-10-22)

Status: Accepted on 2026-10-22; governing brief 0001-W1 v2. This selects the browser
toolchain, with no selected hosting service or application implementation yet.

## Runtime and exact inputs

Use Node.js **24.22.1 LTS** and its bundled npm **11.19.1**. Install the official
platform distribution and verify its checksum against that release's SHASUMS256.
No global package installation is required. Older experimental runtimes do not
establish the security or reproducibility of this version.

The future application manifest is **apps/web/package.json**, exactly as below.
Keep the manifest and npm-generated lock together there. The accepted lock is
[0001-dependency-lock-v1.json](0001-dependency-lock-v1.json); copy it unchanged to
apps/web/package-lock.json when implementation is authorized. Never hand-edit
integrity values or use --force/--legacy-peer-deps to suppress a conflict.

```json
{
  "name": "nextphase-board-web",
  "version": "0.1.0",
  "private": true,
  "license": "Apache-2.0",
  "type": "module",
  "engines": { "node": "24.22.1", "npm": "11.19.1" },
  "scripts": {
    "typecheck": "tsc --noEmit",
    "test": "node --test ../../tests/*.test.mjs",
    "check:deps": "npm ls --all",
    "audit:licenses": "node ../../scripts/check-notices.mjs",
    "build": "node ../../scripts/build-web.mjs",
    "build:fixtures": "node ../../scripts/build-web.mjs --fixtures",
    "serve": "node ../../scripts/serve-web.mjs",
    "serve:fixtures": "node ../../scripts/serve-web.mjs --fixtures"
  },
  "dependencies": {
    "konva": "10.9.0",
    "react": "19.3.1",
    "react-dom": "19.3.1",
    "react-konva": "19.3.2",
    "yjs": "13.6.33"
  },
  "devDependencies": {
    "@types/react": "19.3.0",
    "@types/react-dom": "19.3.0",
    "esbuild": "0.28.2",
    "typescript": "7.0.2"
  }
}
```

React supplies the DOM controls; Konva/react-konva draw the scene. The Board-owned
document remains authoritative. Yjs supplies only the specified in-memory typed
transaction adapter; no provider, websocket, collaboration, account or server is
introduced. Use browser entry points. Do not install node-canvas, Skia, an SSR
framework, font packages, a UI kit or a persistence adapter.

## Public-only dependency verification recipe

This recipe verifies dependency compatibility separately from the future app.
In a disposable directory, save the manifest block above as package.json and the
linked lock as package-lock.json. Save the following as smoke.tsx and tsconfig.json.
Use only these public files and official registry packages. No application or
non-public source is an input. The exports deliberately retain the imports in
the browser bundle. This does not verify the application or its acceptance criteria.

```tsx
// SPDX-License-Identifier: Apache-2.0
import { createRoot } from 'react-dom/client';
import Konva from 'konva';
import { Layer, Rect, Stage, Text } from 'react-konva';
import * as Y from 'yjs';
export { createRoot, Konva, Layer, Rect, Stage, Text };
export function checkTransaction(): string {
  const document = new Y.Doc();
  document.transact(() => document.getMap<string>('example').set('text', 'Example'));
  const result = document.getMap<string>('example').get('text')!;
  document.destroy();
  return result;
}
```

```json
{
  "compilerOptions": {
    "target": "ES2022", "module": "ESNext", "moduleResolution": "Bundler",
    "jsx": "react-jsx", "strict": true, "noEmit": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"], "skipLibCheck": false
  },
  "include": ["smoke.tsx"]
}
```

Run from that directory with the exact runtime:

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm ls --all
npm exec -- tsc --noEmit
npm exec -- esbuild smoke.tsx --bundle --platform=browser --format=esm --target=es2022 --minify --legal-comments=eof --metafile=meta.json --outfile=smoke.js
npm audit --package-lock-only --audit-level=low
```

Record runtime versions, lock SHA256, exit codes, dependency/peer problems, audit
date and browser-bundle inputs. npm audit sends package names/versions to the
registry; its result is a dated advisory snapshot, not a security guarantee.
Installation uses --ignore-scripts: esbuild and the TypeScript compiler resolve
their platform packages without executing arbitrary install hooks in this recipe.

## Licensing, notices and distribution boundary

The [inventory](0001-dependency-inventory-v1.json) enumerates the complete lock,
integrities, license declarations and notice checks. All five direct runtime
libraries declare MIT; TypeScript declares Apache-2.0. Other declarations and
embedded notices must be retained rather than relabelled as Board's Apache-2.0.

[Runtime notices](0001-runtime-notices-v1.txt) contain the exact distributed MIT
license texts for the runtime package graph. The implemented build must put an
equivalent THIRD_PARTY_NOTICES.txt in dist/ and verify that every package in the
browser metafile is covered. Preserve legal comments, license texts and copyright
holders. The project's own LICENSE and NOTICE do not replace dependency notices.

esbuild and TypeScript include native platform-specific development executables.
The esbuild platform tarball relies on the parent package's MIT license text.
TypeScript's LICENSE and NOTICE.txt also cover third-party materials, including
Unicode/W3C/WHATWG declarations and Go/BSD/MIT/Apache notices. Keep those files in
developer installations; a future toolchain redistribution must include the full
upstream notices and be reviewed separately. Neither native compiler, Node/npm,
type definitions nor node_modules may enter the browser distribution. Other OS/
CPU optional packages are locked but are not claimed as executed on this machine.

Use system fonts and independently authored UI. There are no external font,
image, icon or template assets in this increment. A new asset or dependency needs
an amended contract, exact source/version/license and a notice review.

## Future application commands and build behavior

The implementer must create apps/web/tsconfig.json with the same strict compiler
options and the app/test source includes, plus the scripts referenced above.
From the repository root the required sequence is:

```sh
npm --prefix apps/web ci --ignore-scripts --no-audit --no-fund
npm --prefix apps/web run check:deps
npm --prefix apps/web run typecheck
npm --prefix apps/web test
npm --prefix apps/web run audit:licenses
npm --prefix apps/web run build
npm --prefix apps/web run build:fixtures
npm --prefix apps/web run serve
# In a separate terminal, when exercising disposable browser fixtures:
npm --prefix apps/web run serve:fixtures
```

These commands are implementation deliverables. They do not exist in the scaffold.
build-web.mjs resolves paths from its own file URL, bundles the app as production
ESM targeting ES2022 with esbuild, and copies the authored index.html, CSS and
notices into apps/web/dist/. Generate a metafile there; emit no source maps or
fixture code in the normal build. The fixture mode builds only synthetic browser
cases into apps/web/dist-fixtures/ using the same tested modules.

serve-web.mjs binds only 127.0.0.1:4173 for the app, :4174 for fixtures. Reject
traversal and non-loopback Host values; serve only the chosen output directory,
with correct MIME types, no directory listings and no write endpoint. A port
conflict is an error. Do not deploy or silently select another origin: IndexedDB
is scoped to its origin. Browser fixtures allocate disposable database names;
they never overwrite the app's stored board.

Use Node's built-in test runner and explicit assertions. TypeScript may be
precompiled for tests or use Node's supported type stripping only for erasable
syntax; do not add a test framework or browser automation dependency by assumption.
Document the public manual/browser procedure, commands and synthetic fixtures in
the implementation. The complete application and test suite must be reproducible
from the public repository alone before implementation acceptance.

## Public references

Retrieved 2026-10-22:
[Node 24.22.1](https://nodejs.org/en/blog/release/v24.22.1),
[security release](https://nodejs.org/en/blog/vulnerability/october-2026-security-releases),
[React](https://react.dev/), [Konva React](https://konvajs.org/docs/react/index.html),
[Yjs](https://docs.yjs.dev/api/y.doc), [TypeScript](https://www.typescriptlang.org/),
[esbuild](https://esbuild.github.io/getting-started/),
[npm lockfiles](https://docs.npmjs.com/cli/v11/configuring-npm/package-lock-json),
[Node test runner](https://nodejs.org/docs/latest-v24.x/api/test.html).
Exact package provenance is recorded in the linked registry-generated lock and
inventory. These tools were accepted for 0001-W1 v2 on 2026-10-22.
