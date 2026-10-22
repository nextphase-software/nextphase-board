BRIEF VERSION: 0001-W1 v2 (2026-10-22)
# 0001-W1 — Capture and reopen a board

Status: Prerequisites accepted on 2026-10-22. Application implementation and
deployment require separate authorization.
The first repository commit is a scaffold; this brief describes a future increment.

## Outcome

Create one named browser-local board, capture sticky notes and plain text, move
them, pan/zoom, explicitly save, and reopen the latest completed local revision.
Provide a native keyboard editing and object-reading path. Clearly explain local
storage scope and failures. No account or external service is required.

## Read first and prerequisite contracts

- [Contributor guidance](../../CONTRIBUTING.md), [agent instructions](../../AGENTS.md)
  and [engineering standards](../../DESIGN.md).
- [0001 document v1](../architecture/0001-document-v1.md).
- [0001 local storage v1](../architecture/0001-storage-v1.md).
- [0001 interaction v1](../architecture/0001-interaction-v1.md).
- [0001 dependencies/toolchain v1](../architecture/0001-toolchain-v1.md).

These contracts were accepted on 2026-10-22. Committed prerequisites and a separate
maintainer handoff precede an implementation branch. All requirements are in this
repository and its public references; no external planning system is a build input.

## Deliverables and boundaries

Implement the complete behavior in these contracts with one board per origin/
profile, at most 250 sticky/text objects, 120 title code points and 1,000 text
code points per object. Start a new Unsaved draft when both storage records are
absent. Require a nonblank valid name before saving. Never truncate an invalid
draft or report it as saved.

Use the exact reviewed dependency graph/toolchain and commit apps/web/package.json,
apps/web/package-lock.json, TypeScript/build/serve scripts, source, synthetic tests and
applicable dependency notices. The application must install, build and validate
from public repository inputs alone. Implement each command in the toolchain
contract; a missing command is a failed deliverable, not a passed check.

Source belongs in apps/web/src/ with pure document/interaction/storage boundaries;
Node scripts in scripts/; synthetic unit cases in tests/; browser-only fixtures
in tests/browser/. Fixtures are built separately and excluded from the normal
application build. They expose only disposable synthetic databases on a loopback
origin. Do not add a backend, network persistence, analytics or hosted service.

New source uses SPDX-License-Identifier: Apache-2.0 where comments are supported.
Use system fonts, native controls and independently authored CSS/canvas styling.

## Numbered acceptance criteria

- 0001-W1-AC01: Create a named board and sticky/text objects with stable IDs using pointer and keyboard controls; edit Unicode and multiline text.
- 0001-W1-AC02: Reopen a fresh supported browser session and recover the last durably acknowledged revision; expose pending, saved and failed states accurately.
- 0001-W1-AC03: Reject malformed or unsupported saved data without overwriting the recoverable board; preserve focus and a usable accessible object-reading path.

The three identities/texts above are unchanged. The cases below explain evidence;
they do not create extra milestone claims or replace a numbered criterion.

| Criterion | Required evidence from the built application |
| --- | --- |
| 0001-W1-AC01 | Both object types via pointer/keyboard; named board; stable IDs and reading order; emoji/accent/multiline/CJK input; 250/251-object and text/title boundaries; pointer/keyboard movement; cancelled drag; pan/zoom does not change saved geometry. |
| 0001-W1-AC02 | Fresh supported browser session; head/previous bytes and oncomplete receipt; reversed preparation delays across two saves; newer draft stays dirty; exclusive writer denial/takeover; CAS conflict; real transaction abort and failed-write retry; interrupted renderer; no backup/eviction guarantee. |
| 0001-W1-AC03 | Unsupported format/schema, malformed payload, duplicate identities, digest corruption and inconsistent pairs rejected before adoption/write; raw records preserved; disclosed read-only valid-snapshot recovery; complete keyboard object journey, visible focus and 200% browser zoom. |

## Applicable standards and quality envelope

Apply all relevant DESIGN.md keyboard, identity, truthful-save, synthetic-data,
dependency and reproducible-source guardrails. Required browsers and native
composition/zoom behavior are in the interaction contract. No screen-reader test
or conformance gate is added to this increment.

At 250 objects with up to 1,000 code points each, target trusted input-to-paint p95
at most 100ms and locally available reload-to-editable at most 2s. Measure three
30-sample runs on a declared 4-core/8-GiB-class environment at DPR1 and DPR2,
foreground throughout. Record browser builds, OS, hardware, sample method and
all samples. A double-rAF or mount-elapsed proxy is not an input-to-paint or
reload-ready measurement. Unsupported instrumentation remains UNVERIFIED and
requires explicit maintainer disposition; do not invent a pass.

These are implementation-acceptance checks against the finished increment. Current/
previous browser coverage and full native CJK cannot be inferred from synthetic
fixtures. Real transaction abort handling is required; injected quota/storage
errors must be labelled as injections. Native quota exhaustion, eviction recovery
and whole-browser/power-loss guarantees are outside this bounded local preview.
These exclusions were accepted on 2026-10-22; earlier unknowns do not become passing
proofs. If a required check cannot run, report it with evidence and obtain a
specific scope disposition before PASS. Acceptance grants no silent test waiver.

## Validation commands and expected evidence

The [toolchain contract](../architecture/0001-toolchain-v1.md) specifies exact
commands, manifest pins, lockfile and public-only dependency verification recipe.
The application commands are implementation deliverables and do not exist
in the scaffold yet. Do not report them as already passed.

After implementation run the complete command sequence, then execute the browser
fixture/manual matrix in both browser families. Unit tests must assert persisted
records and state/receipts, with deliberate failures and negative controls.
Screenshots supplement those assertions; they do not establish persistence logic.
No test-only controls or fixture content may enter the normal built application.

Before handoff, review public output for privacy, source completeness and notices.
Record each criterion's evidence and all unresolved checks. A different session
reviews the exact implementation commit; maintainer merge and validation on the
merged revision precede completion.

## Exclusions and reasons

One local disposable-content preview. No accounts, team editing/sharing, comments,
sections, shapes/connectors, drawing, formatting/style UI, duplicate/delete/undo/
redo controls, multiple boards/pages, import/export, desktop/tablet or integrations.
The document identity foundation supports later work without delivering those
controls here. Browser storage is not a backup; avoid irreplaceable content until
a separately specified portability capability exists.

No automatic migration, destructive reset, damaged-record replacement, native
storage-pressure guarantee, browser-process/power-loss guarantee or deployment.
Explicit unknown-data preservation and accurate local acknowledgement are required.

## Public references with retrieval dates

Retrieved 2026-10-22: [IndexedDB](https://www.w3.org/TR/IndexedDB/),
[Web Locks](https://www.w3.org/TR/web-locks/),
[Pointer Events](https://www.w3.org/TR/pointerevents3/),
[UI Events](https://www.w3.org/TR/uievents/). Library references/pins are in the
toolchain contract. Project-specific limits and behavior are specified above.

## Implementation record

Unstarted. Append branch/worktree, tested exact source/test revision, commands and
results, per-criterion evidence, dependency/notice inventory, excluded checks and
scope dispositions. Report final branch tip separately from the tested revision.
No implementation PASS, merge, publication or later milestone is claimed.
