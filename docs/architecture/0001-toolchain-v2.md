# 0001 — Dependency and toolchain contract

CONTRACT VERSION: 0001 toolchain v2 (2026-10-22)

Status: Draft for 0001-W12 v1. When accepted it replaces
[toolchain v1](0001-toolchain-v1.md) for all later work. Only the rules below
change; every other v1 rule (dependency set, verification recipe, licensing and
notices, application commands, build and serve behavior) applies unchanged.

## Runtime

Use Node.js **26.13.0 LTS** and its bundled npm **11.20.0**. Install the
official platform distribution and verify its checksum against that release's
SHASUMS256. No global package installation is required. Node 24 entered
maintenance on 2026-10-20; Node 26 is supported as LTS until 2029-04-30.

The manifest in v1 applies with one change:

```json
"engines": { "node": "26.13.0", "npm": "11.20.0" }
```

## Accepted lock and inventory

The accepted lock is [0001-dependency-lock-v2.json](0001-dependency-lock-v2.json),
SHA-256 `ea98496119115189d32eab507ac3a2fdae35f148f15a40fcbab316b7d668e650`. It differs from the v1 lock only in the root package's
`engines` values; every dependency, version, integrity and resolved URL is the
same. `apps/web/package-lock.json` must stay byte-identical to it. The
[v2 inventory](0001-dependency-inventory-v2.json) records the new runtime and lock
hash with the same package entries. [Runtime notices v1](0001-runtime-notices-v1.txt)
remain the distributed notices, because the package graph is unchanged.

Regenerate the lock only with the pinned npm and
`npm install --package-lock-only --ignore-scripts`. A change to anything beyond
the root `engines` values is a dependency change and needs its own amended contract.

## Public references

Retrieved 2026-10-22: [Node.js release schedule](https://github.com/nodejs/Release#release-schedule),
[Node.js release index](https://nodejs.org/dist/index.json). Retrieved 2026-10-28:
[Node.js 26.13.0 release notes](https://nodejs.org/en/blog/release/v26.13.0).
