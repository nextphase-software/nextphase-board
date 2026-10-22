BRIEF VERSION: 0001-W1 v5 (2026-10-22)
# 0001-W1 — Capture and reopen a board

Status: Accepted for implementation by the maintainer on 2026-10-22.
Implementation is authorized for this milestone branch. Merge and deployment
remain separate maintainer actions.
The development build is in progress; milestone acceptance remains pending.
The maintainer accepted v4's practical validation baseline and v5's native IME
deferral on 2026-10-22; all three
numbered criterion identities/texts and functional safety requirements are unchanged.

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
- [0001 interaction v4](../architecture/0001-interaction-v3.md).
- [0001 dependencies/toolchain v1](../architecture/0001-toolchain-v1.md).

This version incorporates document/storage/toolchain v1 unchanged from the
previously accepted v2 packet. Their original applicability/acceptance metadata
records that earlier packet; their same technical requirements apply here.
Interaction v4 replaces interaction v3 for this brief. Its complete layout and
input/focus rules were accepted for implementation on 2026-10-22. Prerequisites
were committed on the milestone branch before application source. This does not
reopen the accepted dependency graph or waive an existing acceptance evidence gate.
All requirements are in this repository and its public references; no external
planning system or design artifact is a build input.

## Design reference and interaction deliverables

The interaction v4 screen table, wireframe, dimensions and visual constants are
the complete public design reference. Build a scene-filling workspace with compact
floating Board details, Objects/status/Save, Select/Pan/Sticky/Text palette and
view controls. Selecting exposes contextual editing; a stable native textarea
provides on-object editing, with the secondary Objects selector/editor/move route.
Implement its placement/cancellation, focus return, composition/draft, responsive/
zoom and read-only behavior. No permanent editing column, demonstration content,
review ribbon or additional capability belongs in this increment.

Native text remains plain multiline text; Enter in its textarea is a newline.
Placement tools are one-shot and secondary native Add actions keep their centered
cascade. Selection, surfaces and navigation do not create document revisions.
All saving remains explicit and governed by the unchanged persistence contract.

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
| 0001-W1-AC01 | Both object types via pointer/keyboard palette placement and native Add actions; exactly-once creation; named board; stable IDs/reading order; native on-object/panel editor equivalence; emoji/accent/multiline/CJK Unicode editing and automated composition commit/cancel; 250/251-object and text/title boundaries; pointer/keyboard movement; cancelled drag; pan/zoom does not change saved geometry. |
| 0001-W1-AC02 | Fresh supported browser session; head/previous bytes and oncomplete receipt; reversed preparation delays across two saves; newer draft stays dirty; exclusive writer denial/takeover; CAS conflict; real transaction abort and failed-write retry; interrupted renderer; no backup/eviction guarantee. |
| 0001-W1-AC03 | Unsupported format/schema, malformed payload, duplicate identities, digest corruption and inconsistent pairs rejected before adoption/write; raw records preserved; disclosed read-only valid-snapshot recovery; complete keyboard object journey; stable native editor and panel/overlay focus transitions; retained invalid drafts; narrow/short layouts, visible focus and actual 200% browser page zoom. |

## Applicable standards and quality envelope

Apply all relevant DESIGN.md keyboard, identity, truthful-save, synthetic-data,
dependency and reproducible-source guardrails. Required browsers and
composition/zoom behavior are in the interaction contract. No screen-reader test
or conformance gate is added to this increment.

Use the installed Chrome and Safari versions available on the declared development
machine. Record exact browser builds, OS, hardware and viewport. Previous stable
versions, a fixed hardware class, multiple DPR configurations and formal latency
sampling are deferred beyond this preview.

For the 250-object responsiveness smoke check, load a disposable board with 250
objects and up to 1,000 code points each, edit text, move an object, pan/zoom,
Save and reopen/reload. All content must remain correct and controls usable without
a crash, stuck saving state or lost edit. Record any observed delay and diagnostic
timings with their measurement method; no p95/input-to-paint or speed guarantee is
required or implied. Repeat the journey in both installed browser families.

These are implementation-acceptance checks against the finished increment. Installed-browser behavior cannot be inferred from synthetic fixtures alone.
Native OS CJK IME testing is explicitly deferred as a manual follow-up for this
preview; automated composition regressions and Unicode editing in both browsers
remain required. Synthetic events and paste establish no native IME claim. Real transaction abort handling is required; injected quota/storage
errors must be labelled as injections. Native quota exhaustion, eviction recovery
and whole-browser/power-loss guarantees are outside this bounded local preview.
These exclusions were accepted on 2026-10-22; earlier unknowns do not become passing
proofs. If a required check cannot run, report it with evidence and obtain a
specific scope disposition before PASS. Acceptance grants no silent test waiver.

## Validation commands and expected evidence

The [toolchain contract](../architecture/0001-toolchain-v1.md) specifies exact
commands, manifest pins, lockfile and public-only dependency verification recipe.
The application commands are implemented. Their actual run results and remaining
browser evidence are recorded below; existence alone does not establish a pass.

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

Build record dated 2026-10-22. Branch: `codex/0001-W1-capture-and-reopen`.
Worktree: `.worktrees/codex-0001-W1`. Base: `a2280b5`; branch prerequisite commit:
`cdbc231`. Validated source/test revision:
`6a6a20650921d0f75d491838465352fcb9f28c43`. The checks below ran on the same
source/test bytes before that commit; no source or test edits followed. The final
branch tip includes this separate evidence-only documentation update.

Exact environment: Node 24.22.1 / npm 11.19.1; macOS 27.0.1 (26A434),
Mac17,2, 10 CPU cores, 24 GiB. Installed Chrome 155.0.8059.85 and Safari 27.0.1.
These installed builds do not establish current-and-previous stable coverage.

| Check | Actual result |
| --- | --- |
| Exact-runtime `ci --ignore-scripts --no-audit --no-fund` | PASS |
| `check:deps`, `typecheck`, `test` | PASS; six unit tests |
| `audit:licenses`, `build`, `build:fixtures` | PASS; metafile packages covered and complete notices copied |
| `npm --prefix apps/web audit --package-lock-only --audit-level=low` | PASS; zero reported vulnerabilities on 2026-10-22 |
| Chrome disposable IndexedDB fixture | PASS: immutable capture/FIFO receipts, real save-transaction abort/retry, complete-pair CAS conflict and queued rejection, fresh-connection recovery |
| Chrome application | Sticky/text creation, native multiline/Unicode editing, pointer movement, keyboard-activated directional move/Save, real save/reopen, second-tab writer denial, oversized-draft retention/global Save block and correction verified |
| Safari application | Native multiline/Unicode sticky editing, real save/reopen and editable reload after own-lock-release fix verified |
| Chrome layout/focus | 320×568, 375×667, 1024×768, 1440×900 verified without page-wide horizontal overflow; action/status/panel separation and Escape focus return verified; zero captured warning/error entries |
| Loopback server | App/notices GET200; invalid Host/write method403; traversal/metafile404 |
| Source completeness/privacy and whitespace | PASS; no fixture bundle, dependency installation, private research or generated output committed |

| Existing criterion | Evidence disposition |
| --- | --- |
| 0001-W1-AC01 | PARTIAL: model/schema/limits/adapter identity tests and actual capture/edit/move journeys above. Full native CJK, both palette keyboard routes and cancellation/boundary journeys remain unverified. |
| 0001-W1-AC02 | PARTIAL: actual acknowledged saves/reopen in both browsers, Chrome writer denial and real fixture failures. Full writer takeover, reversed preparation-delay, newer-draft/older-receipt and renderer lifecycle matrix remain unverified. |
| 0001-W1-AC03 | PARTIAL: decoder negatives, retained invalid drafts, native selector/editor, visible focus return and responsive geometry. Full application damaged-data recovery, actual 200% browser page zoom and native composition/focus matrix remain unverified. |

Actual 200% browser page zoom was not established: key attempts did not change
measured page dimensions, and native desktop access subsequently reported a locked
session. Safari's expanded fixture run was also not completed after that point.
The full 250-object input-to-paint/reload performance protocol and current/previous
browser matrix are UNVERIFIED. No proxy timing or Unicode paste is substituted.

The accepted exact dependency lock is unchanged; no dependency or external asset
was added. The application build uses independently authored source, system fonts,
DOM inputs, the selected renderer and in-memory transaction adapter. Browser tests
use synthetic content in disposable fixture databases; application test content
also remains synthetic. See [reproducible checks](../../tests/README.md).

Milestone remains in progress. Independent review must cover the exact source/test
revision and resolve missing acceptance evidence before PASS/merge. No acceptance,
merge, publication, deployment or later milestone is claimed.

### Follow-up source revision

Latest source/test revision: `54c29bdc2e6567a012e90901a7aa6e724069f8c8`.
This follow-up recreates the in-memory adapter on adoption/reopen and destroys it
on unmount, as required by the document contract. `typecheck`, all six unit tests,
`build` (including bundle/notice checks), both commit hooks and Chrome real
reload/explicit reopen passed after the change. The complete command batch above
applies to baseline `6a6a206`; dependencies, storage and fixture sources are unchanged.
Safari observations above came from an earlier development iteration and require
revalidation against this final source revision. No additional acceptance gate
is closed. The final branch tip is reported separately from this tested revision.

### Additional browser smoke evidence — 2026-10-22

Application source/test revision remains
`54c29bdc2e6567a012e90901a7aa6e724069f8c8`. Additional smoke checks exercised the
same application bytes delivered over HTTPS. Delivery adds no account system,
server storage, shared editing or runtime dependency to this increment.

| Browser | Bounded observed result |
| --- | --- |
| Chrome155.0.8059.85 | PASS: both object types, multiline/Unicode native editing, pointer/directional movement, explicit Save/Reopen/reload, application zoom, competing-tab read-only and writer takeover; zero captured warning/error entries |
| Safari27.0.1 | PASS: both object types, multiline/Unicode native editing, directional movement, explicit Save/Reopen/reload; exact recovered object contents and sticky coordinates verified through native controls |

These checks revalidate the current application revision in Safari and add Chrome
writer-takeover evidence. Boards remain scoped to each browser origin/profile.
Unicode paste is not native IME composition; application zoom is not200% browser
page zoom. Full current/previous coverage, performance and the remaining required
acceptance matrix remain unverified. Independent review and merge remain pending.
This evidence-only update changes no criterion, application source or dependency.

### Validation baseline amendment — brief v4

On 2026-10-22 the maintainer requested acceptance parameters matching the available
preview environment. Brief v4 and interaction v4 use installed Chrome/Safari and
a practical 250-object responsiveness/recovery journey. Earlier current/previous,
fixed-hardware, DPR and formal timing gaps above are historical v3 gates, now
superseded by this explicit amendment. Native editing/composition, keyboard/focus,
200% browser zoom, truthful saves, malformed-data preservation and all other
functional requirements remain. This amendment is not a functional PASS.

### Validation baseline amendment — brief v5

On 2026-10-22 the maintainer explicitly approved automated composition coverage
and deferral of native OS IME testing. Interaction v4 records this disposition.
All three criterion identities/texts, composition behavior and data safety remain
unchanged. Native IME remains unverified as a manual follow-up, rather than PASS.
