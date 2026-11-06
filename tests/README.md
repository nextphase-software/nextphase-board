# Validation policy and available checks

## Default: minimal testing for the current change

Test only the behavior directly affected by the current change, using the smallest
check that demonstrates it works. For a bug fix, add or run a focused regression
when useful. For documentation-only changes, inspect the diff and links; do not
run application tests or builds. Do not automatically run full suites, browser
matrices, performance/load tests, accessibility audits, native IME checks, unrelated
edge cases, or repeated acceptance sweeps. Broader testing requires an explicit
maintainer instruction. Existing checklists describe available coverage and do
not authorize executing it. State what ran and what did not; never report an
unrun check as passed. If a change reveals a concern outside its scope, report it
without expanding the test campaign or implementation. Mandatory Git/privacy hooks
still run normally; never bypass them.

## Reference commands and coverage

`home.test.mjs` covers 0003-W5's Home links, page joining, edited-time words, role and
sort words, creation and rename permissions, held names and menu placement. It runs
with `npm test` without Supabase or a browser.

`comments.test.mjs` covers 0005-W1's shared anchor, detach, Unicode text, author colour,
filter, screen-word and placement rules, comment request lifecycle and current layout-4
initialization. It runs with `npm test` without Supabase or a browser. Each test imports its
subject dynamically, so the missing feature fails each test by name on the base.

`tests/server/shared.test.ts` adds S121–S133 on both runners for current comment initialization,
actions, permissions, ordering, deletion, epochs, snapshots/restores, anchors, text,
waiting edits, receipts, rate limits, malformed messages and board/backup capacity.
Its existing `SUMMARY-SHARED` counts these checks. S121 checks current layout-4
creation/idempotence/restart with edits and receipts kept; S133 uses current
backup tables and ranges, and S134 expects layout 4. Comment fixtures include
`restoreGeneration`. Older-format migration checks are outside this milestone.
These server checks require the local stack and belong to the review's V11 run.
The 0005-W1 browser scenario, base negative control, A–J comparison and amended
0004-W2 checks belong to the review's V9–V13 run; they are not unit-test results.

`team-import.test.mjs` covers 0006-W1's exact reader refusals, picture and size
refusals, current and upgraded request bodies, and revision-zero room creation,
identifier rows, reload and `room_exists` immutability. `import-fixture.mjs` shares
synthetic rich, exact-size and picture boards with the unit and server checks.
These tests run with `npm test` without Supabase or a browser.

`tests/server/shared.test.ts` adds S134–S142 on both runners for creation, ordered
validation, access, compensating cleanup, identifier reuse, backup/restore, the
2 MiB boundary, title precedence and the documented lost-database-answer gap.
`SUMMARY-SHARED` counts them. The runners' `failCreate` and proxy's `failAfter`
controls exercise the failure stages. The 0006-W1 implementer runs V1–V8 only;
V9–V13, including these server checks and the browser scenarios, remain for the
review's check run with its local stack.

The commands and matrix below are a catalog, not a default execution checklist.
Run a broader set only when explicitly requested. Use the exact Node/npm versions
in the toolchain contract. From the repository root:

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm --prefix apps/web run check:deps
npm run typecheck
npm test
npm run audit:licenses
npm run build
npm run build:fixtures
```

The unit suite covers document identity, canonical Unicode serialization,
malformed/unsupported input, geometry and content boundaries, and envelope/pair
validation. License audit verifies the unchanged accepted lock and complete
runtime notices; each build checks every bundled dependency against the accepted
inventory and distributes the complete notice file. The fixture bundle is
separate from the normal application.

In two terminals:

```sh
npm --prefix apps/web run serve
npm --prefix apps/web run serve:fixtures
```

Open <http://127.0.0.1:4174> in each supported browser. Expect eight PASS lines:
immutable capture/FIFO receipts, actual transaction abort with preserved records
and retry, complete-pair compare-and-swap rejection with writer invalidation,
fresh-connection recovery, same-counter payload conflicts, delayed preparation,
injected quota/unavailable failures and interrupted-writer preservation. A FAIL line is a failed check. The abort is
deliberately triggered in a real IndexedDB transaction; it is not evidence of
native quota exhaustion. The fixture uses a uniquely named disposable database
and never writes the application database. Never use production content in
fixtures.

At <http://127.0.0.1:4174/regressions.html>, expect eight PASS lines for the
single-editor, placement-cancellation, unavailable-writer recovery, object/title
composition, older-save/newer-draft lifecycle, narrow-editor focus and damaged-head
recovery checks. Run in a clean profile when an extension suppresses lifecycle
events; the fixture explicitly detects suppressed synthetic pagehide dispatch.
They mount the production App, redirect its default IndexedDB name to a unique
disposable database, and verify real stored bytes. Input events are synthetic;
pointer capture is stubbed only for synthetic pointers. These integration tests
do not establish trusted pointer, keyboard or page-zoom evidence. Native OS IME is a deferred manual follow-up,
not established by these synthetic composition events. Test
code is built only by build:fixtures and never enters the application bundle.

When explicitly requested, the manual coverage catalog at
<http://127.0.0.1:4173> maps to the existing criteria:

| Criterion    | Manual procedure                                                                                                                                                                                                                                                                                                                                                              |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0001-W1-AC01 | Name a new board; create each type via palette pointer/Enter and native Add; enter multiline Unicode; edit through both routes; move by pointer and directional controls; cancel a gesture; verify navigation leaves geometry unchanged. Check Unicode editing and automated composition commit/cancel; native OS IME is deferred.                                                                                |
| 0001-W1-AC02 | Save, edit a newer draft during an earlier save, reopen and reload; verify saved content and statuses. Open another tab, verify read-only controls, close the writer and explicitly retry. Exercise lifecycle interruption and the fixture negative controls.                                                                                                                 |
| 0001-W1-AC03 | Tab through selector/read/edit/move/save/reopen; inspect visible focus and surface-close focus return. Retain a 1,001-code-point draft, switch objects, and correct it before Save. Check clipped-editor fallback, narrow/short viewports and actual 200% browser page zoom. Unknown stored formats are decoder negatives; full app recovery journeys need separate evidence. |

Record exact installed Chrome and Safari builds, OS, hardware, viewport,
source/test revision and results. Browser-family coverage, native OS IME and
performance cannot be inferred from unit or fixture passes. The brief specifies
the 250-object responsiveness smoke journey and exclusions. Leave unavailable checks
UNVERIFIED. Unexecuted catalog entries do not authorize extra testing or become
automatic blockers; report the bounded evidence and any actual defect for review. No test requires Firefox or
screen-reader-specific validation.

For the disposable 250-object smoke journey, open
<http://127.0.0.1:4174/regressions.html?workload=w1-smoke>. The query key names
a disposable fixture database, retained for reload. Edit/move/pan/zoom/save and
reload; Inspect saved fixture reads its persisted contents. Close this workload
tab before the regression fixture so its writer lock cannot block the tests.
Diagnostic mount-to-load time is not input-to-paint or a performance guarantee.

## Server validation (0003-W1)

The shared suite uses six independent Supabase Auth identities and the same S checks
on Node and workerd. It requires Docker and an already running, disposable local
stack from `supabase/config.toml`. Provision that stack outside the suite:

```sh
node tests/server/make-signing-key.mjs
npx supabase start
node tests/server/write-stack-info.mjs
npm run test:server:node
npm run test:server:workerd
BOARD_TEST_TARGET=docker npm run test:server:node
```

Set `BOARD_TEST_STACK` to use an existing stack settings JSON instead of
`tests/server/.stack.json`. Settings and signing keys are ignored; they contain
local test credentials. The suite never invokes the Supabase CLI. Setup applies
the plain SQL before exposing the schema, creates disposable accounts/workspaces,
and cleans up its own data. Each driver uses free ports and system temporary
directories. Docker checks create and remove their own image and container.

`tests/transition.test.mjs`, `tests/codec.test.mjs` and `tests/room.test.mjs` cover
state transitions, strict Yjs projection and the host-neutral room with in-memory
SQLite storage and an injected clock. They run with `npm test`. The workerd driver
evicts Durable Objects with WebSockets hibernated; S37 and S43 are Node only.
S51–S54 run only with the Docker target. Each executed S check prints one PASS or
FAIL line; each suite ends with a JSON SUMMARY including measured storage and
fanout values. Test clocks, faults and rewinds live only in the test bootstraps.

## Workspace discovery checks (0003-W3)

`tests/lists.test.mjs` covers cursor validation, ASCII title order and saved-state
copy decisions in `npm test`. `tests/server/lists.test.ts` adds S55–S76 to both
server commands, using independent identities, an injected clock and named RPC
failures/delays. It prints `SUMMARY-LISTS` and is silent for the Docker target.
S70 runs only on Node; V12 belongs to the independent review check run.

## Access removal checks (0003-W2)

`tests/removal.test.mjs` covers delivery concurrency, receipts, scoped removal
status and atomic room steps in `npm test`. `tests/server/removal.test.ts` adds
S77–S93 to both server commands with fresh identities for each check. It prints
`SUMMARY-REMOVAL` and is silent for the Docker target. The proxy can hold a
computed RPC reply until released to exercise the lookup/removal race.
Run Node and workerd sequentially against one dataset. V12 is left to the
independent review check run; hosted timing remains a separate maintainer step.

## Shared editing and presence checks (0004-W1)

`tests/presence.test.mjs` covers presence validation, bounds, attachment size,
labels, storage migration, join holds and departure ordering. The new
`tests/shared-editing.test.mjs` covers grapheme writes, conflict ordering,
repairs, guarded undo and the shared client's injected transport and clock.
Both run with `npm test` without Supabase.

`tests/server/shared.test.ts` adds S94–S115 to both server commands, using
fresh independent identities per check and held transport queues for deterministic
interleavings. It prints `SUMMARY-SHARED` and is silent for the Docker target.
Run Node and workerd sequentially. V11 (fresh-base negative control) and V12
(A–J web comparison) belong to the independent review check run.

## Web team features (0003-W4)

`npm test` also runs `tests/team.test.mjs` (switch settings, links, role sources,
invitation expiry, save precedence, join outcomes, renewal and exact messages) and
`tests/grouped-edits.test.mjs` (group boundaries, guarded text undo/redo, the step
cap and unchanged edit wire bytes). Both use the production modules directly,
without a browser or Supabase stack. The brief records V1–V8; the independent
review's check run owns V9–V12, including W4-S1–S29 and the team-off A–J comparison.

## Web presence (0004-W3)

`tests/web-presence.test.mjs` runs with `npm test` without a browser or Supabase.
Each test dynamically imports the pure presence rules inside the test. Coverage
includes grouping and first-connection promotion, avatar overflow, pill words,
selection limits, outgoing coordinate clamps, follow choice and fit, silent
presence refusals and the stored cursor-switch key. Module guards enforce the
fifteen team modules, twenty-two hooks and sole presence-hook import.
The implementer runs V1–V8; the review check run owns V9–V13, including
W3-S1–S36 (including the interaction v27 design check), the fresh-base negative
control, team-off network behaviour, the A–J comparison and W4-S1–S29. Unrun browser checks are not acceptance evidence.

## Shared-edit recovery (0004-W2)

`tests/recovery.test.mjs` runs with `npm test` without a browser or Supabase.
It dynamically imports the production modules inside each test, with a fixed
clock and driven transport for drops, ordered replay, restore/access fences,
deadlines, final requests, discard/close, undo reset and fresh client IDs. Pure
notice rules cover grouped counts, loss records, save-state precedence, exact
singular/plural messages and retry outcomes.

`tests/server/shared.test.ts` adds S116–S120 after S115 on both runners and
includes them in `SUMMARY-SHARED`: restore generations, lost saved answers and
receipt replay, stale epochs, 80 serially recovered edits, and deterministic
three-phase delete/property/text interleavings. They require the local stack;
typechecking these additions does not count as running the server suite.

The implementer records V1–V8. The review's check run owns V9–V14: W2-S1–S21,
the fresh-base negative control, both server runners, A–J, the amended 0003-W4
checks and the 0004-W3 checks. No browser or Supabase stack is needed for V1–V8.

## Discussion mentions (0005-W2)

`tests/mentions.test.mjs` runs without a browser or Supabase in `npm test`.
Each test imports its subject inside the test, so a missing feature fails by name.
It covers normalized code-point ranges, null/malformed metadata, 20/21 ranges,
256-byte labels, paging/suffixes, chip replacement/plain paste, immutable
request/epoch/generation retry, no automatic replay, current initialization and
backup validation, unchanged canonical document/file/local records/board Undo,
and Node's marked-volume generation floor and failed checkpoint reads/writes.

`tests/server/mentions.test.ts` supplies S143–S167 on both runners and S168 on
Node only. `SUMMARY-MENTIONS` counts actual passes/failures, with measured UTF-8
request/frame/backup sizes and durable store inventory. Test-only controls add
ordered room SQL, explicit delivery, initialization failure, pre-forward RPC
hold/release, fence inspection and Node failures for each live checkpoint read.
Existing synthetic identity domains, ports and production settings are retained.

S168 uses the existing Node `volumeCopy` control and marking script on current
layout-5 data. It first demonstrates a live mention generation ahead of the
failed document copy, then checks recovery above both checkpoints and both
restored generations before clear/unlock, held-work fencing, fresh delivery,
and separate fail-closed document/mention checkpoint reads with explicit retry.
It is not executed on workerd.

The implementer runs only V1–V8 from the versioned brief. A fresh independent
full-access session repeats those checks and owns V9–V13: C2 (including corrected
open-card/same-tab C2-S27), base negative controls, both server suites, team-off
A–J and amended C1. The focused C2-S27 rerun from planning is not a full scenario
or new implementation validation. No hosted schema application or deployment is
part of these commands.

## Manage board history (0006-W3 v1)

`tests/board-history.test.mjs` runs in `npm test` without browsers or Supabase.
Named tests dynamically import the new production history modules. They cover
canonical capture fingerprints through expiry/restart, transactional rollback,
retention and metadata code points, same-ID restore and request identities,
chunked pending intents/atomic cleanup, current backup fingerprints/budget,
confirmation-author fallback, local time formatting and immutable edit generations.
`tests/history.test.mjs` remains unchanged Undo/Redo regression coverage.

`tests/server/history.test.ts` registers S169–S194 on both Node and workerd. Each
prints `PASS: S<n> <name>` or `FAIL: S<n> <name>` from actual assertions, then
`SUMMARY-HISTORY` with runner/pass/fail and measured inventory/size fields. They use
independent synthetic fixtures and actual HTTP adapters, deterministic clocks,
room SQL/alarms, socket close, pre-forward RPC hold/release and named history
transaction/fence failures. Current accepted fixtures carry the joined edit
restoreGeneration and expect layout 5. Absolute comment dates use viewer-local
Intl formatting; relative thresholds and existing functional assertions stay.

Implementation runs V1–V8 only. A fresh independent full-access run authors H1,
executes all 27 state comparisons, the baseline negative control, S169–S194 on
both runners and the accepted unit/server/A–J/X1/C2/W5 regressions (V9–V13).
Server checks being registered or typechecked is not evidence that they ran.
No browser, Supabase CLI, schema application, deployment or broader test campaign
is authorized by the implementer's V1–V8 command set.
