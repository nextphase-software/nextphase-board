BRIEF VERSION: 0016-W2 v1 (2026-10-29)
# 0016-W2 — Board rules move into a shared package

Status: Draft. Implementation starts only after the maintainer commits this brief,
[0001 toolchain v3](../architecture/0001-toolchain-v3.md), its
[lock v3](../architecture/0001-dependency-lock-v3.json) and
[inventory v3](../architecture/0001-dependency-inventory-v3.json), and
[0001 web modules v23](../architecture/0001-web-modules-v23.md) to main.

## Outcome

The rules that say what a board is move out of the web app into their own package,
`packages/board-rules`, named `nextphase-board-rules`: the saved document and its
validation, upgrade and canonical form (`document.ts`), text marks (`marks.ts`), the style
palette (`styles.ts`) and the eight object-type modules (`objects/`). The web app links the
package with npm and imports it by name. A server running in a Cloudflare Worker or in Node
can later import the same rules, because the package uses nothing from the browser beyond
two globals every one of those runtimes has.

Nothing a person sees or saves changes. Every element, attribute, focus move, drawn pixel
and saved byte stays as it is at `29e4280`, and every existing test keeps passing with only
its import lines changed.

## Read first and prerequisite contracts

- [Contributor guidance](../../CONTRIBUTING.md), [agent instructions](../../AGENTS.md)
  and [engineering standards](../../DESIGN.md).
- [0001 web modules v23](../architecture/0001-web-modules-v23.md): the governing note. It
  adds the board rules package as a layer, says what may go in it and how the web app
  reaches it, and lists the guard tests below.
- [0001 toolchain v3](../architecture/0001-toolchain-v3.md): the manifest's new link
  dependency and `typecheck` line, the accepted
  [lock v3](../architecture/0001-dependency-lock-v3.json) and
  [inventory v3](../architecture/0001-dependency-inventory-v3.json), and how the
  repository's own packages are treated. Every other toolchain v2 rule applies.
- [0001 document v10](../architecture/0001-document-v10.md),
  [0001 storage v3](../architecture/0001-storage-v3.md),
  [0006 board file v2](../architecture/0006-board-file-v2.md) and
  [0001 interaction v24](../architecture/0001-interaction-v24.md): unchanged.
- [0001-W24 v1](0001-W24-selection-layouts-editor-hooks.md): its comparison procedure is
  reused below.

## Deliverables and boundaries

The base is `29e4280`, and line numbers refer to it. "Moved unchanged" means `git diff -M` reports the file as a rename
with 100% similarity.

1. **The package.** Create:
   - `packages/board-rules/package.json`, exactly:

     ```json
     {
       "name": "nextphase-board-rules",
       "version": "0.1.0",
       "private": true,
       "license": "Apache-2.0",
       "type": "module",
       "exports": { "./*": "./src/*" }
     }
     ```

   - `packages/board-rules/tsconfig.json`, exactly:

     ```json
     {
       "compilerOptions": {
         "target": "ES2022",
         "module": "ESNext",
         "moduleResolution": "Bundler",
         "strict": true,
         "noEmit": true,
         "allowImportingTsExtensions": true,
         "lib": ["ES2022"],
         "types": [],
         "skipLibCheck": false
       },
       "include": ["src"]
     }
     ```

   - `packages/board-rules/src/platform.d.ts`, exactly:

     ```ts
     // SPDX-License-Identifier: Apache-2.0
     // The only globals the board rules use beyond ES2022. Browsers, Workers and Node all provide them.
     declare const crypto: { randomUUID(): `${string}-${string}-${string}-${string}-${string}` };
     declare class TextEncoder { encode(input?: string): Uint8Array }
     ```

   Delete `packages/.gitkeep`.
2. **Moved unchanged** into `packages/board-rules/src/`: `apps/web/src/marks.ts` and
   `apps/web/src/styles.ts`; and into `packages/board-rules/src/objects/`: all eight files
   of `apps/web/src/objects/` (`connector.ts`, `image.ts`, `registry.ts`, `section.ts`,
   `shape.ts`, `sticky.ts`, `stroke.ts`, `text.ts`). The folder `apps/web/src/objects/`
   no longer exists.
3. **`apps/web/src/document.ts` moves to `packages/board-rules/src/document.ts`** with
   exactly these edits and no other:
   - line 2, `import * as Y from "yjs";`, is removed;
   - line 35, `export type ResolvedItem = …`, is removed (it moves to `geometry.ts`, item 5);
   - `function styleOf` and `function markOf` become `export function styleOf` and
     `export function markOf` (the adapter uses them);
   - the `Adapter` class (lines 228–290, from `export class Adapter {` to the end of the
     file) is removed (it moves to `document-adapter.ts`, item 4).
4. **New `apps/web/src/document-adapter.ts`**: the licence header, then exactly these
   imports, then the `Adapter` class from `document.ts` lines 228–290, unchanged:

   ```ts
   import * as Y from "yjs";
   import { markOf, styleOf, upgrade, type Board } from "nextphase-board-rules/document.ts";
   import { connectorStyleOf, extraValues, hasEnds, hasRectangle, hasText, isImage } from "nextphase-board-rules/objects/registry.ts";
   ```

   The adapter stays in the web app because `yjs` is installed only there.
5. **`apps/web/src/geometry.ts`** gains, after its licence header and before
   `export const TEXT_INSET`:

   ```ts
   import type { ItemV10 } from "nextphase-board-rules/document.ts";
   import type { Rectangle } from "nextphase-board-rules/objects/registry.ts";
   import type { ConnectorLayout } from "./connectors.ts";
   export type ResolvedItem = ItemV10 & Rectangle & { displayHeight: number; connectorLayout?: ConnectorLayout };
   ```

   The three imports are type-only, so nothing changes at run time.
6. **`apps/web/package.json`**: add `"nextphase-board-rules": "file:../../packages/board-rules"`
   to `dependencies` after `konva`, and make `typecheck`
   `"tsc --noEmit && tsc --noEmit -p ../../packages/board-rules"`. Nothing else changes.
   Regenerate the lock with the pinned npm:
   `npm --prefix apps/web install --package-lock-only --ignore-scripts --no-audit --no-fund`.
   `apps/web/package-lock.json` must then be byte-identical to
   `docs/architecture/0001-dependency-lock-v3.json`. If it is not, stop and report the
   difference instead of committing it.
7. **`scripts/check-notices.mjs`**: read `0001-dependency-lock-v3.json` and
   `0001-dependency-inventory-v3.json` in place of the v2 files. Nothing else changes.
8. **Import lines in the web app.** In every file under `apps/web/src`, every import,
   re-export or `import("…")` type whose specifier points at a moved file names it as
   `nextphase-board-rules/<path under src>.ts` instead: for example `"../document"` and
   `"./document.ts"` become `"nextphase-board-rules/document.ts"`, and
   `"../objects/registry"` becomes `"nextphase-board-rules/objects/registry.ts"`. The
   bindings and their order stay as they are, with three exceptions:
   - `Adapter` (in `state/use-board-document.ts`) and `type Adapter` (in
     `state/use-storage-session.ts`) leave the `document` import and come from a new line
     directly after it: `import { Adapter } from "../document-adapter";` and
     `import type { Adapter } from "../document-adapter";`.
   - `ResolvedItem` (as itself or `as Item`) leaves the `document` import and comes from
     `geometry`. Where the file already imports from `geometry`
     (`state/use-object-layouts.ts`, `state/use-editing-commands.ts`,
     `scene/inline-editor.tsx`), it joins that import as `type ResolvedItem` or
     `type ResolvedItem as Item` at its end. Elsewhere (`context-bar-position.ts`,
     `state/use-editor-placement.ts`, `state/use-command-reasons.ts`,
     `state/use-canvas-input.ts`, `scene/connection-dots.tsx`) a new line directly after the
     `document` import reads `import type { ResolvedItem as Item } from "../geometry";`
     (`"./geometry.ts"` in `context-bar-position.ts`; plain `ResolvedItem` without `as Item`
     in `connection-dots.tsx`).
   - An import whose only binding moved away is replaced by its new line; in
     `scene/inline-editor.tsx` the `document` import line is removed.

   The files that change are exactly: `activities.ts`, `arrange.ts`, `board-file.ts`,
   `clipboard.ts`, `connection-drag.ts`, `connector-heads.ts`, `connectors.ts`,
   `context-bar-position.ts`, `geometry.ts`, `gesture.ts`, `group.ts`, `history.ts`,
   `image-assets.ts`, `images.ts`, `sections.ts`, `storage.ts`, `strokes.ts`, `text-runs.ts`;
   `scene/` `board-drawing.tsx`, `connection-dots.tsx`, `connector-body.tsx`,
   `image-body.tsx`, `inline-editor.tsx`, `note-body.tsx`, `overlays.tsx`,
   `section-body.tsx`, `shape-body.tsx`, `stroke-body.tsx`; `state/`
   `use-board-document.ts`, `use-canvas-input.ts`, `use-command-reasons.ts`,
   `use-editing-commands.ts`, `use-editor-placement.ts`, `use-geometry-edits.ts`,
   `use-gesture-state.ts`, `use-images.ts`, `use-object-layouts.ts`, `use-page-keys.ts`,
   `use-selection.ts`, `use-storage-session.ts`, `use-text-entry.ts`, `use-validity.ts`; and
   `ui/` `board-panel.tsx`, `connector-fields.tsx`, `connector-icons.tsx`,
   `connector-menu.tsx`, `content-field.tsx`, `context-bar.tsx`, `drawing-tools.tsx`,
   `format-preview.tsx`, `image-controls.tsx`, `navigation-panel.tsx`, `notice.tsx`,
   `objects-panel.tsx`, `palette.tsx`, `shape-controls.tsx`, `shapes-panel.tsx`,
   `stroke-controls.tsx`. Other files keep their bytes.
9. **Import lines in the tests.** In `tests/*.test.mjs` and `tests/browser/`, a path to a
   moved file under `apps/web/src/`, in an import statement or an `await import("…")` call,
   becomes the same path under
   `packages/board-rules/src/`, always ending in `.ts` (for example
   `"../apps/web/src/document.ts"` becomes `"../packages/board-rules/src/document.ts"`, and
   `"../../apps/web/src/document"` in `tests/browser/` becomes
   `"../../packages/board-rules/src/document.ts"`). Tests import by path, not by package
   name, because no `node_modules` folder sits above `tests/`; Node and esbuild resolve the
   link to the same files, so both routes load one copy of each module. Where a test imports
   `Adapter` from `document.ts`, `Adapter` leaves that import and a new line directly after
   it reads `import { Adapter } from "../apps/web/src/document-adapter.ts";` (in
   `connector-styles`, `connectors`, `document`, `geometry`, `history`, `images`, `resize`,
   `sections`, `shapes` and `strokes`). No other test line changes; the only lines inside test
   bodies that change are the `await import("…")` calls of moved files in `objects.test.mjs`
   and `storage.test.mjs`, whose path alone changes. Besides `modules.test.mjs`
   (item 10), the test files that change are exactly: `activities`, `board-catalog`,
   `board-file`, `clipboard`, `connector-styles`, `connectors`, `document`, `geometry`,
   `group`, `history`, `images`, `marks`, `objects`, `resize`, `sections`, `shapes`,
   `storage`, `strokes`, `styles` (each `.test.mjs`), and `tests/browser/fixtures.ts` and
   `tests/browser/app-regressions.mjs`.
10. **`tests/modules.test.mjs`**, as listed under validation: the existing guards read the
    package where the moved files now live, and four new tests guard the split.

**How the move is done** (web modules v23, rule 6 "moves are moves"): files move as they
are, and only where they are imported from changes. The only code edits are those stated
in items 3 to 5.

Outside the named new controls, the existing screens' markup stays exactly as at the base:
the reviewer's A–J comparison allows only the masks listed under validation. This brief
names no new controls, and its only mask is the saved-time text described in V12.

No other file changes: no `App.tsx`, `main.tsx`, `icons.tsx`, `style.css`, `index.html`,
other script, contract, README or test, and no third-party dependency. If something seems
to need more, stop and report it.

Append the implementation record below with the branch, validated revision, commands,
results and exclusions; report the final branch tip separately.

## Numbered acceptance criteria

- 0016-W2-AC01: The board rules live in packages/board-rules as nextphase-board-rules, moved unchanged apart from the stated document.ts edits; the Yjs adapter and the drawn-item type stay in the web app; the web app imports the package only by name and the tests by path; the guard tests keep the split in place.
- 0016-W2-AC02: Toolchain v3 is in force: the regenerated lock is byte-identical to lock v3, the licence check reads lock and inventory v3, and the type check also checks the package without browser types; install, checks, unit tests and both builds pass.
- 0016-W2-AC03: Behaviour is unchanged: existing tests change only import lines and pass, and the running app matches 29e4280 in markup, focus, drawing and saved records.

| Criterion | Evidence that shows it |
| --- | --- |
| 0016-W2-AC01 | V1, V8, V9, V10, V11 and V14, and unit tests (the module guards) |
| 0016-W2-AC02 | V1, V2, V3, V4, V5, V6, V7 and V8, and unit tests |
| 0016-W2-AC03 | V6, V10, V12 and V13, and unit tests |

## Validation commands and expected evidence

From the repository root with the pinned toolchain (Node 26.13.0, npm 11.20.0):

```sh
npm --prefix apps/web install --package-lock-only --ignore-scripts --no-audit --no-fund
npm --prefix apps/web ci --ignore-scripts --no-audit --no-fund
npm --prefix apps/web run check:deps
npm --prefix apps/web run typecheck
node --test tests/modules.test.mjs tests/document.test.mjs tests/objects.test.mjs tests/styles.test.mjs tests/marks.test.mjs
npm --prefix apps/web test
npm --prefix apps/web run audit:licenses
npm --prefix apps/web run build
npm --prefix apps/web run build:fixtures
git diff --name-status -M <base>..HEAD
```

`<base>` is the main revision the branch starts from, recorded in the implementation
record. The full unit suite runs because the change touches the saved-document rules and
the build.

**`tests/modules.test.mjs`** changes as follows; its other tests stay as they are.

- It imports `existsSync` from `node:fs` alongside `readdirSync` and `readFileSync`, and
  defines `const rules = new URL("../packages/board-rules/src/", import.meta.url);` with
  `objects` now `new URL("objects/", rules)`. The tests that read `objects` (exactly eight
  object types; never import React or Konva; never import App; licence header; import
  only siblings or `../styles.ts`) therefore read the package. The siblings test reads
  `styles.ts` from `rules`.
- **Rules modules ask the registry** lists the `.ts` files directly in `apps/web/src/`
  (asserting `document-adapter.ts` is among them) and the `.ts` files directly in the
  package's `src/` other than declaration files (asserting they are exactly `document.ts`,
  `marks.ts` and `styles.ts`), and checks `typeNameUses` on both lists and on `state/` as
  before.
- **Rules modules never import React or Konva** checks the top-level `.ts` files of
  `apps/web/src` (asserting there is at least one) and every file in the package.
- Three helpers are added: `specifiers(content)`, every specifier of an `import` or
  `export … from` statement and of an `import("…")` type; `rulesImportProblems(content,
  file)`, the specifiers that do not start with `.` or do not resolve, from `file`, to a
  location inside `packages/board-rules/src/`; and `webImportProblems(content)`, the
  specifiers that contain a `packages/` path segment, or that start with
  `nextphase-board-rules/` and name a file the package does not have.
- New test: **the package holds exactly its modules**. The files under the package's
  `src/` are exactly `document.ts`, `marks.ts`, the eight `objects/` files,
  `platform.d.ts` and `styles.ts`, and each starts with the Apache-2.0 licence header.
- New test: **board rules import only their own files**. `rulesImportProblems` is empty
  for every package file.
- New test: **the web app keeps no copy and imports by name**. `document.ts`, `marks.ts`,
  `styles.ts` and `objects` do not exist under `apps/web/src`; `webImportProblems` is empty
  for every file there; and at least one file names `nextphase-board-rules/`.
- New test: **the import guards catch each forbidden form**. From the package's
  `document.ts`, each of `import * as Y from "yjs";`,
  `import { history } from "../../../apps/web/src/history.ts";`,
  `export { clamp } from "../../../scripts/build-web.mjs";`,
  `type T = typeof import("nextphase-board-rules/document.ts");` and
  `import { history } from "../history.ts";` yields a problem; from `objects/text.ts`,
  `import { colorEntry } from "../styles.ts";` and `export * from "./shape.ts";`, and from
  `document.ts`, `type T = typeof import("./objects/image.ts");` yield none.
  `webImportProblems` finds a problem in
  `import { add } from "../../../packages/board-rules/src/document.ts";`,
  `import { add } from "../../packages/board-rules/src/document";` and
  `import { add } from "nextphase-board-rules/history.ts";`, and none in
  `import { add } from "nextphase-board-rules/document.ts";`,
  `import type { Rectangle } from "nextphase-board-rules/objects/registry.ts";` and
  `import { record } from "../history";`.

The suite then has 645 tests: the 641 at the base and these four.

**Checks.** The implementer runs V1–V8 and V14 and records them; the reviewer's check run
repeats them on a clean clone and runs V9–V13. Each is reported as one `PASS: V<n>` or
`FAIL: V<n>` line.

| Check | Pass condition |
| --- | --- |
| V1 | `npm --prefix apps/web ci` exits 0, and `apps/web/node_modules/nextphase-board-rules` is a link to `packages/board-rules` |
| V2 | `apps/web/package-lock.json` is byte-identical to `docs/architecture/0001-dependency-lock-v3.json` (SHA-256 `0fc6385fe7d3c24ae7cbc2c7d5d77d7de7cfd9ebca9e6ab5814721f66fd31379`) after the regeneration command |
| V3 | `check:deps` exits 0 |
| V4 | `typecheck` exits 0, running both the app check and the package check |
| V5 | In a disposable copy of the tree, appending `export const probe = () => window.innerWidth;` to `packages/board-rules/src/marks.ts` makes `typecheck` fail with `Cannot find name 'window'` |
| V6 | The named test files and the full suite pass: 645 tests, 0 failed |
| V7 | `audit:licenses` exits 0 |
| V8 | Both builds exit 0; `apps/web/dist/meta.json` lists the eleven package modules as inputs under `../../packages/board-rules/src/` and no input under `node_modules/nextphase-board-rules` |
| V9 | `git diff -M --name-status <base>..<validated>` shows `marks.ts`, `styles.ts` and the eight `objects/` files as 100% renames, and `document.ts` as a rename whose content diff is exactly the edits of item 3 |
| V10 | In each test file changed under item 9, every line that differs between the base and validated versions belongs to an import statement, or is an `await import("…")` call whose only change is the path of a moved file |
| V11 | The validated `tests/modules.test.mjs`, run against a checkout of `<base>`, fails |
| V12 | Markup, focus and drawing comparison: scenarios A–J of the 0001-W24 v1 brief's comparison, unchanged, under its conditions, recorded values, DOM actions and validity rules, run on a build of `29e4280` twice (the two must match exactly) and once on the candidate; the candidate matches at every checkpoint, including the saved records, with no values set aside. The one mask: before comparing, each saved time the board panel shows (`saved today 18:42`, `saved yesterday 09:05`, `saved 3 Oct 18:42`, with or without a year) is written as `saved TIME`, because it reads the wall clock and two unchanged runs crossing a minute would differ |
| V13 | The regression harness's eight PASS lines at the fixture index page and at `regressions.html` ([tests README](../../tests/README.md)) |
| V14 | `git diff --name-status -M <base>..<validated>` lists exactly the files of items 1 to 10; the final tip adds only this brief's implementation record |

The built `app.js` is not compared byte for byte: moving modules changes their order in
the bundle, and the minifier's short names change with it. V12 and V13 compare behaviour.

No browser matrix, Safari check, accessibility audit or IME checks unless the maintainer
asks.

## Exclusions and reasons

- Any change in behaviour, appearance or saved format.
- Moving the Yjs adapter, editing rules (history, sections, connectors and the rest),
  storage, board files or picture records into the package: each waits for the work that
  needs it on a server.
- npm workspaces, a server, a Worker or a Docker setup.
- Renames, refactors or fixes inside the moved files (report anything noticed).
- New third-party dependencies or other contract changes.

## Public references with retrieval dates

Retrieved 2026-10-29: [npm `file:` dependencies](https://docs.npmjs.com/cli/v11/configuring-npm/package-json#local-paths)
and [package `exports`](https://nodejs.org/docs/latest-v26.x/api/packages.html#subpath-patterns).

## Implementation record

### 2026-10-29 — Implementation of v1

- Branch: `codex/0016-W2-board-rules-package`.
- Base revision: `1c7e72d4830b77693359dfd2e95ec47aa064204c` (committed main,
  including this v1 brief and its v3/v23 contracts).
- Validated source/test revision: `02f13f1f24a133cfe885f9d2972ee4649296853d`,
  `refactor(web): extract shared board rules package`. The checks below ran on the
  identical source/configuration/test tree immediately before that commit; V14
  checked the resulting commit. The final branch tip is reported separately in the
  implementation handoff and adds only this implementation record.
- Implemented items 1–10: the shared rules package, web-only adapter and drawn-item
  type, import changes, toolchain v3 wiring and four module guard tests.
- Added dependency: repository-owned `nextphase-board-rules` 0.1.0, Apache-2.0,
  private `file:../../packages/board-rules` link. No third-party dependency added
  or changed.

Commands below ran from the repository root with the pinned toolchain first on
`PATH`. `node --version` printed `v26.13.0`; `npm --version` printed `11.20.0`.

| Exact command | Result |
| --- | --- |
| `npm --prefix apps/web install --package-lock-only --ignore-scripts --no-audit --no-fund` | Exit 0. |
| `cmp apps/web/package-lock.json docs/architecture/0001-dependency-lock-v3.json` | Exit 0; byte-identical. |
| `shasum -a 256 apps/web/package-lock.json` | Exit 0; `0fc6385fe7d3c24ae7cbc2c7d5d77d7de7cfd9ebca9e6ab5814721f66fd31379`. |
| `npm --prefix apps/web ci --ignore-scripts --no-audit --no-fund` | Exit 0; package link verified by the assertion below. |
| `npm --prefix apps/web run check:deps` | Exit 0; no required dependency or peer problem. Optional packages for other platforms and Konva's optional native canvas providers remain uninstalled. |
| `npm --prefix apps/web run typecheck` | Exit 0; both app and package compiler invocations ran. |
| `node --test tests/modules.test.mjs tests/document.test.mjs tests/objects.test.mjs tests/styles.test.mjs tests/marks.test.mjs` | Exit 0; 153 passed, 0 failed. |
| `npm --prefix apps/web test` | Exit 0; exactly 645 tests, 645 passed, 0 failed, 0 cancelled, 0 skipped, 0 todo. |
| `npm --prefix apps/web run audit:licenses` | Exit 0; accepted lock, inventory and distributed notices verified. |
| `npm --prefix apps/web run build` | Exit 0; application built. |
| `npm --prefix apps/web run build:fixtures` | Exit 0; fixtures and regression bundle built; browser execution deferred. |
| `git diff --check` | Exit 0. |
| `git diff --name-status -M 1c7e72d4830b77693359dfd2e95ec47aa064204c..02f13f1f24a133cfe885f9d2972ee4649296853d` | Exit 0; exactly the items 1–10 allowlist: 99 change entries, 110 old/new paths when rename endpoints are expanded. No other path changed. |
| `git diff --name-status 02f13f1f24a133cfe885f9d2972ee4649296853d..HEAD` | Final handoff check: only this brief's implementation record. |

V1 link assertion (exit 0):

```sh
node --input-type=module - <<'JS'
import assert from 'node:assert/strict';
import { lstatSync, realpathSync } from 'node:fs';
assert(lstatSync('apps/web/node_modules/nextphase-board-rules').isSymbolicLink());
assert.equal(realpathSync('apps/web/node_modules/nextphase-board-rules'), realpathSync('packages/board-rules'));
console.log('PASS: V1');
JS
```

V5 disposable-copy command (exit 0). The copy was outside the worktree, the probe's
`typecheck` exited 1 with `error TS2304: Cannot find name 'window'` in package
`marks.ts`, and the temporary directory was confirmed deleted. The working tree
was never given the probe.

```sh
python3 - <<'PY'
from pathlib import Path
import shutil, subprocess, tempfile
source = Path.cwd()
with tempfile.TemporaryDirectory(prefix='nextphase-board-v5-') as temporary:
    copy = Path(temporary) / 'tree'
    assert not copy.is_relative_to(source)
    shutil.copytree(source, copy, symlinks=True, ignore=shutil.ignore_patterns('.git', '.worktrees', 'node_modules', 'dist', 'dist-fixtures', '.codebase-memory'))
    shutil.copytree(source / 'apps/web/node_modules', copy / 'apps/web/node_modules', symlinks=True)
    with (copy / 'packages/board-rules/src/marks.ts').open('a') as marks:
        marks.write('\nexport const probe = () => window.innerWidth;\n')
    result = subprocess.run(['npm', '--prefix', 'apps/web', 'run', 'typecheck'], cwd=copy, text=True, capture_output=True)
    assert result.returncode != 0, result.stdout + result.stderr
    assert "Cannot find name 'window'" in result.stdout + result.stderr, result.stdout + result.stderr
    print(result.stdout.strip())
    print('Probe typecheck exit:', result.returncode)
assert not Path(temporary).exists()
print('Disposable copy deleted.')
print('PASS: V5')
PY
```

V8 metafile assertion (exit 0):

```sh
node --input-type=module - <<'JS'
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const inputs = Object.keys(JSON.parse(readFileSync('apps/web/dist/meta.json', 'utf8')).inputs);
const prefix = '../../packages/board-rules/src/';
const expected = ['document.ts', 'marks.ts', 'styles.ts', ...['connector', 'image', 'registry', 'section', 'shape', 'sticky', 'stroke', 'text'].map((name) => `objects/${name}.ts`)].sort();
assert.deepEqual(inputs.filter((name) => name.startsWith(prefix)).map((name) => name.slice(prefix.length)).sort(), expected);
assert(!inputs.some((name) => name.includes('node_modules/nextphase-board-rules')));
console.log('Eleven package modules are bundle inputs at their canonical source paths.');
console.log('PASS: V8');
JS
```

Check results (one line per authorized check):

```text
PASS: V1 — clean install and correct package symlink.
PASS: V2 — regenerated lock byte-identical to lock v3 and its accepted SHA-256.
PASS: V3 — dependency check exited 0.
PASS: V4 — app and browser-free package type checks exited 0.
PASS: V5 — disposable-copy browser-global probe failed as required; copy deleted.
PASS: V6 — named tests passed; full suite exactly 645 tests with 0 failed.
PASS: V7 — licence audit exited 0.
PASS: V8 — both builds exited 0; eleven canonical package inputs, no linked node_modules inputs.
PASS: V14 — exact items 1–10 file list; final tip adds only this implementation record.
```

V9–V13 were not run: the rename/content and test-diff checks (V9–V10), guard
failure against the base (V11), A–J browser comparison against `29e4280` (V12),
and browser regression harness (V13) are left to the independent review's check
run, as instructed. Browsers cannot start in this sandbox. No browser matrix,
Safari, accessibility, IME, performance or unrelated checks ran. Behavioural
acceptance remains subject to that review; builds do not establish browser parity.

Codebase-memory discovery and indexing were attempted first but unavailable
because the tool required approval and this sandbox permits none; local reads
were used instead. Mandatory public-boundary Git hooks ran normally and passed;
no hooks were bypassed. The source commit succeeded despite a nonfatal sandbox
denial of Git's `packed-refs.lock` creation. No push or merge was performed.
