# 0001 — Dependency and toolchain contract

CONTRACT VERSION: 0001 toolchain v3 (2026-10-29)

Status: Draft for 0016-W2 v1. When accepted it replaces
[toolchain v2](0001-toolchain-v2.md) for all later work. Only the rules below change; every
other v2 rule, and through it every v1 rule (runtime Node.js 26.13.0 with npm 11.20.0,
dependency set, verification recipe, licensing and notices, application commands, build and
serve behavior), applies unchanged.

## The repository's own packages

Code shared by more than one program in this repository lives in a package under
`packages/`. The first is `packages/board-rules`, named `nextphase-board-rules`. Such a
package:

- is Apache-2.0 source of this repository, not a third-party package: it is never published
  to a registry, and its `package.json` says `"private": true`;
- declares no dependencies of its own, because npm does not install the dependencies of a
  package linked by local path;
- is linked into the application with an npm `file:` dependency, which npm installs as a
  link in `apps/web/node_modules`;
- adds no file to the browser distribution's notices: the bundler resolves the link to the
  package's own files, so they are bundled as application source.

## Manifest

The v1 manifest, as amended in v2, applies with two changes:

```json
"typecheck": "tsc --noEmit && tsc --noEmit -p ../../packages/board-rules",
```

```json
"dependencies": {
  "konva": "10.9.0",
  "nextphase-board-rules": "file:../../packages/board-rules",
  "react": "19.3.1",
  "react-dom": "19.3.1",
  "react-konva": "19.3.2",
  "yjs": "13.6.33"
}
```

The second type check uses the package's own `tsconfig.json`, which has no browser types, so
the package cannot start using a browser API unnoticed.

The public-only dependency verification recipe of v1 keeps using the v2 manifest and the
[v2 lock](0001-dependency-lock-v2.json): it checks the third-party set, which v3 does not
change, in a folder that has no `packages/board-rules` to link.

## Accepted lock and inventory

The accepted lock is [0001-dependency-lock-v3.json](0001-dependency-lock-v3.json), SHA-256
`0fc6385fe7d3c24ae7cbc2c7d5d77d7de7cfd9ebca9e6ab5814721f66fd31379`.
`apps/web/package-lock.json` must stay byte-identical to it. It differs from the v2 lock only
by the root package's new dependency line and two entries for the link:
`node_modules/nextphase-board-rules` (`"resolved": "../../packages/board-rules"`,
`"link": true`) and `../../packages/board-rules` (its name, version and licence). Every
third-party package, version, integrity and resolved URL is the same.

The [v3 inventory](0001-dependency-inventory-v3.json) is the v2 inventory with its document
version, status and lock hash updated. Its package entries, `packageCount` (63) and
`bundlePackages` are unchanged: they count third-party packages, and the two link entries
are not third-party. [Runtime notices v1](0001-runtime-notices-v1.txt) remain the
distributed notices. `scripts/check-notices.mjs` reads the v3 lock and inventory.

Regenerate the lock only with the pinned npm and
`npm --prefix apps/web install --package-lock-only --ignore-scripts --no-audit --no-fund`.
A change to anything beyond the lines above is a dependency change and needs its own
amended contract.

## Public references

Retrieved 2026-10-29: [npm local paths](https://docs.npmjs.com/cli/v11/configuring-npm/package-json#local-paths)
(a `file:` dependency; packages linked by local path do not have their own dependencies
installed) and [Node.js subpath patterns](https://nodejs.org/docs/latest-v26.x/api/packages.html#subpath-patterns)
(the `"./*"` export the package uses).
