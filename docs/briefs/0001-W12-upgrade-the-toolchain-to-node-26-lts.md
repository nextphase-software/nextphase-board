BRIEF VERSION: 0001-W12 v1 (2026-10-22)
# 0001-W12 — Upgrade the toolchain to Node 26 LTS

Status: Draft. Implementation starts only after the maintainer commits this brief
and [0001 toolchain v2](../architecture/0001-toolchain-v2.md) to main.

## Outcome

Move the pinned development toolchain from Node.js 24.22.1 (LTS, in maintenance
since 2026-10-20) to Node.js **26.13.0**, the first Node 26 LTS release, with
its bundled npm **11.20.0**. The application, its dependencies and its
behavior do not change.

## Read first and prerequisite contracts

- [Contributor guidance](../../CONTRIBUTING.md), [agent instructions](../../AGENTS.md)
  and [engineering standards](../../DESIGN.md).
- [0001 toolchain v2](../architecture/0001-toolchain-v2.md): the new pin. It
  replaces toolchain v1 for future work and keeps every other v1 rule.
- [0001 toolchain v1](../architecture/0001-toolchain-v1.md), the
  [v1 dependency lock](../architecture/0001-dependency-lock-v1.json) and
  [v1 inventory](../architecture/0001-dependency-inventory-v1.json): the baseline.

## Deliverables and boundaries

1. Install the official Node.js 26.13.0 distribution for your platform and
   verify it against that release's SHASUMS256, as toolchain v2 requires.
2. In `apps/web/package.json`, set `"engines": { "node": "26.13.0", "npm": "11.20.0" }`.
   Change nothing else in the manifest.
3. Regenerate `apps/web/package-lock.json` with the pinned npm using
   `npm --prefix apps/web install --package-lock-only --ignore-scripts --no-audit --no-fund`.
   The lock diff must be limited to the root package's `engines` values. If npm
   changes anything else (versions, integrities, resolved URLs, lockfile version,
   package set), stop and report it instead of committing it.
4. Add `docs/architecture/0001-dependency-lock-v2.json`, byte-identical to the
   regenerated lock, and `docs/architecture/0001-dependency-inventory-v2.json`:
   the v1 inventory with `documentVersion` 2, today's date, a status naming this
   brief, `node` and `npm` set to the new pin, and `lockSha256` set to the new lock's
   SHA-256. Package entries stay unchanged.
5. Point `scripts/check-notices.mjs` at the v2 lock and v2 inventory. Runtime
   notices v1 stay in use unchanged.
6. Update the toolchain references in `README.md`, `CONTRIBUTING.md`,
   `docs/guides/try-board.md` and `docs/architecture/README.md` to Node 26.13.0 /
   npm 11.20.0 and toolchain v2.

Do not change application source, tests, dependency versions, build or serve
behavior, or any other script. Keep v1 contract files in place as history. No CI,
deployment or hosting change. Outside the named new controls, the existing screens' markup stays
exactly as at the base: this brief names no new controls, so the built application stays the same.

Append the implementation record below with the branch, validated revision,
commands, results and exclusions; report the final branch tip separately.

## Numbered acceptance criteria

- 0001-W12-AC01: Pin the first Node 26 LTS release and its bundled npm in the toolchain contract, engines field, lock root and accepted dependency snapshots.
- 0001-W12-AC02: Install, dependency checks, typecheck, unit tests, licence audit and both builds pass on the new pin from public inputs alone.
- 0001-W12-AC03: Change no application source, dependency version or behavior; contributor docs point to the new contract.

| Criterion | Evidence that shows it |
| --- | --- |
| 0001-W12-AC01 | `node --version` and `npm --version` print the pin; engines, lock root, v2 lock and v2 inventory agree; v2 lock byte-identical to `apps/web/package-lock.json` |
| 0001-W12-AC02 | Every command in the sequence below exits 0 on the new pin, with no engine warning |
| 0001-W12-AC03 | On the validated commit, with `git status --porcelain` empty, `git diff --name-only <base>..HEAD` lists only the files named above; the lock diff touches only root `engines`; the build comparison below matches |

## Validation commands and expected evidence

This change replaces the runtime every command uses, so the toolchain sequence is
the smallest check that shows it works. From the repository root, on the new pin:

```sh
node --version
npm --version
npm --prefix apps/web ci --ignore-scripts --no-audit --no-fund
npm --prefix apps/web run check:deps
npm --prefix apps/web run typecheck
npm --prefix apps/web test
npm --prefix apps/web run audit:licenses
npm --prefix apps/web run build
npm --prefix apps/web run build:fixtures
git status --porcelain
git diff --name-only <base>..HEAD
```

`<base>` is the main revision the branch starts from, recorded in the implementation
record. Also run `npm --prefix apps/web audit --package-lock-only --audit-level=low` and
record its date and result. It queries the live registry and does not depend on the
runtime, so it is not part of AC02: an advisory is reported to the maintainer, never
fixed here, because a dependency change needs its own contract.

Build comparison, to show the application bytes do not change. In two clean clones, one
at `<base>` on Node 24.22.1 / npm 11.19.1 and one at the validated commit on the new pin,
delete `apps/web/node_modules`, `apps/web/dist` and `apps/web/dist-fixtures`, then run the
`ci`, `build` and `build:fixtures` commands above. In each, list every file under
`apps/web/dist` and `apps/web/dist-fixtures` as its path relative to `apps/web` with its
SHA-256, sorted by path. Each list must hold exactly these 12 paths, and the two lists must
be equal:

```text
dist/THIRD_PARTY_NOTICES.txt  dist/app.js  dist/index.html  dist/meta.json  dist/style.css
dist-fixtures/THIRD_PARTY_NOTICES.txt  dist-fixtures/app.js  dist-fixtures/index.html
dist-fixtures/meta.json  dist-fixtures/regressions.html  dist-fixtures/regressions.js
dist-fixtures/style.css
```

Browser fixtures, the browser matrix and manual app journeys do not run for this change
unless the maintainer asks, because identical bytes cannot behave differently.

## Exclusions and reasons

No dependency upgrade, application change, new script, test framework, CI,
deployment or Node 25 use. Odd-numbered Node lines are never LTS.

## Public references with retrieval dates

Retrieved 2026-10-22: [Node.js release schedule](https://github.com/nodejs/Release#release-schedule)
(Node 26 LTS from 2026-10-28, end of life 2029-04-30; Node 24 maintenance from
2026-10-20, end of life 2028-04-30) and the [Node.js release index](https://nodejs.org/dist/index.json).
Retrieved 2026-10-28: [Node.js 26.13.0 release notes](https://nodejs.org/en/blog/release/v26.13.0)
(the first Node 26 LTS release, with npm 11.20.0).

## Implementation record

Not started.
