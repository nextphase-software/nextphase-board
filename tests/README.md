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

## Board Trash lifecycle (0006-W4 v1)

`tests/board-lifecycle.test.mjs` runs with `npm test` without a browser or
Supabase. L-U01–L-U10 import their subjects inside named cases. They cover exact
Trash TeamLink parsing, strict elapsed deadlines/local times, immutable request
identity, UTF-8 journal limits, ordered room freeze/history preservation, accepted
history intent exclusion, discarded callbacks, independent ledger rollback refusal,
late owner-response invalidation, GET-only resumed states and terminal clearing.
The existing M-U14 role-change/draft assertions remain unchanged.

`tests/server/lifecycle.test.ts` registers S195–S224 in both Vitest configurations.
Each case prints PASS/FAIL by ID and `SUMMARY-LIFECYCLE` records runner, actual
pass/fail counts and measured bytes/inventory. These checks use independent
synthetic fixtures, real SQL/HTTP/socket paths and deterministic clock/phase/RPC
failures. New test-only controls hold pre-queue room messages, release them after
a lifecycle fence, fail admission/fencing/discard/ledger reads, run the minute
pass and inspect physical discard without initializing a room. Node restart
resets process-local controls; cases explicitly reapply clocks/failures afterward.
Worker controls apply the deterministic clock to scheduled discovery as well.
S215's physical marked-volume subcase is Node-only; logical/recovery guards run
on both. Existing fixtures add only active lifecycle stubs, current table-count
expectations and cleanup of the three service tables.

The implementation session runs V1–V8 only. Registering/bundling server cases is
not a server PASS. The fresh full-access independent check owns V9–V13, writes
`tools/browser-compare/0006-w4-check.mjs` in its check tooling, runs T1 and the
independently installed baseline negative control, then the accepted both-runner
server, A–J-off, H1, C2, W5 and X1 ranges from the brief. Keep its explicit H1-S13/
S50 and W5-S24 ending→Home amendments, menu/sidebar/Tab allowances, and every
other functional assertion. No browser/Supabase CLI/schema application/deployment
runs in the implementation session.


## Shared workshop timer (0007-W1 v1)

`tests/workshop-timer.test.mjs` adds W1-U01–W1-U40 to `npm test`, importing
capabilities inside each named case. They cover strict actor-free wire shapes and
causes, bounded rolling budgets, input/monotonic clocks, queue races, expiry,
rollback, content isolation, restart and logical/explicit recovery. The paired
accepted-history-intent units distinguish ordinary preservation from marker-first
reset/reservation/retry. Controller checks cover pending readback without replay,
delayed End speech, result/state deduplication and reconnect suppression.
The Worker adapter units exercise the production fence and startup/time-entry guard
against independent SQLite stores: atomic SQL/KV reservation rollback, bounded
counters, marker-before-intent ordering, reset-once retry, ordinary-fence preservation
and acknowledgement of retained signals. Module guards require exactly 40 team
modules, 22 state hooks and unchanged App.tsx.
Controlled-clock cases cover exact mutation readback, sample/health and zero
deadlines independently of display ticks. Component layout-effect cases cover
post-joined/pre-sample connecting focus and confirmation control reuse/removal,
matching enabled focus and canvas focus preservation without a browser claim.

`tests/server/timer.test.ts` registers S225–S256 (32 common checks) on both runners,
printing PASS/FAIL per ID and `SUMMARY-TIMER` with actual runner counts and sizes.
S252's stopped-volume copy/real marking-script subcase is Node-only. The workerd
common case explicitly marks before eviction/load; it is not a claim of hosted
provider point-in-time recovery. S252 additionally simulates provider rewind using
only an independent `RestoreFence` recovery raise and actual workerd eviction,
with running/paused timers and accepted history intents. It retains the original
marked-load assertions, adds post-reservation/strict-replay failures, and completes
retry with timer writes blocked to prove no second reset.

New test-only controls inspect bounded timer attachment windows, reconstruct a
Node Room over its existing SQLite/connections, mark explicit recovery and inject
timer writes failing inside the real transaction. Workerd reconstruction uses
`evictDurableObject` with existing WebSockets. Node process restart remains the
separate S248 path; process-local clocks/failures are reapplied after restart.
S254 reports actual runner rows and serialization of maximal exact frame shapes;
these measurements are not server-suite results until the suite executes.

The current joined envelope has actor-free `timer` and `serverNowMs`; current
room fixtures expect layout 6, not an older-layout upgrade path. S121/S134/S159/
S169 and mention initialization fixtures retain their existing functional checks.
S160/S192 inspect the live singleton and verify backup exclusion. S40 retains
lifecycle-outage refusals after wake, restores both authorities, freshly joins
owner/editor/viewer, then disables access replay for cached existing-socket work
and new-join 503 proof. No pre-wake Node socket is reused. Invalid/consumed ticket
refusals and the locked recovery observations remain.

Implementation validation is V1–V8 only. The server-only handoff requires a fresh clean
candidate/install/local schema install+reapply, full Node then full workerd suites,
no browsers; return failures to the implementation session before check1. The fresh
independent check authors `tools/browser-compare/0007-w1-check.mjs` and owns V9–V13:
Z1-S1–S29/S31–S36 on, S30 off, the named baseline negative, accepted full unit/server,
A–J off, 0004-W2 recovery/presence and 0006-W4 T1 plus off sentinel. Removal remains
inside the full suites. Only the brief's named toolbar stops/outage phases change;
existing functional assertions stay. Baseline T1-S38/S39 and Node S181 require
source/test comparison, never blanket waivers. Registered or bundled checks are
not executed checks. No browser, Supabase CLI, deployment or extra campaign ran
in the implementation sandbox.


## 0007-W2 voting checks

`workshop-voting.test.mjs` adds W2-U01–W2-U37 for strict wire/projection rules,
Unicode/budget bounds, separate rates, account races, private publication,
transaction rollback, reconciliation, reconstruction/recovery, backup exclusion,
actual escaped SQLite row bounds, marker geometry, input decisions and client
readback/health/speech/cleanup. It uses synthetic identities and runs in `npm test`.
Current room fixtures use layout 7. Module guards retain exactly 45 team modules,
22 state hooks and the composition-only App limit of 264 lines; only App's former
byte-equality assertion is removed. Existing Timer focus/functional assertions
remain, with the shared title, Timer heading and Close control substitutions.
The S160/S192 inventories include both voting tables while excluding them from
logical backups. S40's current outage/rejoin phases remain intact.

`tests/server/voting.test.ts` registers S257–S304 (48 named common checks) and
`SUMMARY-VOTING` on both Node and workerd. Controls add voting storage failures,
complete attachment inspection, stale spatial reconstruction fixtures and bounded
synthetic voter creation. S295 separately identifies the actual stopped Node
volume copy/marking-script subcase; workerd runs the common explicit-marker guard.
S296 uses the independent Workers recovery signal before loading. Existing
S37/S43/S70/S168 physical exclusions stay. Registering checks is not execution.

Implementation runs V1–V8. The separate server-only handoff uses a clean candidate,
clean install, uniquely owned local stack, schema install/reapply, Node then
workerd, with complete command/count/log receipts and owned cleanup. It returns
failures before the independent check. Browsers and the Supabase CLI are unrun
in the implementation sandbox. The independent check authors
`tools/browser-compare/0007-w2-check.mjs`, runs V1–V13, Y1-S1–S44 (S43 off), the
new-capability negative on 752f79d once, and only the accepted regressions.
W2-S7/S8/S9/S16/S20/S21 and T1-S38/S39 retain their baseline-failure classification;
T1-S26/S29 remain unrun until their accepted prerequisites exist. No aggregate
green claim may hide a failed/unrun row or a new privacy/reconnect failure.

## Follow a facilitator (0007-W3 v1)

`workshop-spotlight.test.mjs` registers P1-U01–P1-U55 in `npm test` without
browsers or Supabase. Named dynamic imports exercise strict spotlight wire
shapes, per-connection membership and distinct-person counts, bounded metadata,
ordered authority, source outages, fresh real presence, grace/rebind/key rotation,
live attachment reconstruction, terminal overrides, voting's commit boundary,
zero stored spotlight bytes, control/member headroom, countdown safety, fresh
follower offers, stale replies, health/readback, speech and measured notice geometry.
P1-U46 retains local deadline4000/answer_deadline and send-failure1006 while
checking every retrying session close as4410/retry_recovery; explicit terminal
paths remain1000. P1-U49 checks original Worker close/error forwarding before
its separate1006 socket-close normalization. P1-U55 exercises the resulting
1001 cleanup callback against a real Room, preserving grace and terminal overrides.
These are unit results, not browser or both-runner acceptance.

`server/spotlight.test.ts` registers S305–S355 (51 common checks) and
`SUMMARY-SPOTLIGHT` in both existing runner configurations. S352 independently
executes its23 lifetime scenarios, including when selected alone. Spotlight close
checks await server callback/ordered cleanup separately from client close events;
S326 retains its suspended request identity across expiry/alarm ordering. S309/S355
assert terminal closes separately from still-live version fences. Node permission
and IPC control resets are separate so the fixed clock and faults are actually reset.
Test-only controls
inspect current attachments, seed bounded counters and reconstruct over live
connections. Node process wake remains distinct from live Room reconstruction;
workerd uses live server attachments and its existing eviction path. Private keys
may be asserted inside these disposable tests but must never be logged. Existing
physical exclusions S37/S43/S70/S168 stay separate; registering tests is not a pass.

Module guards now require48 team modules and22 state hooks; App stays composition
only and at most264 lines. Recovery/comment deadline expectations change only the
retrying wire close to4410; document timing, waiting bytes, ordered replay and
terminal close assertions remain. Manual Follow shares the white spotlight banner,
using measured bars/context/notices bottom+12px, without changing notice positions
or their internal8px gap. Browser expectation amendments belong to the fresh check
run, which authors `tools/browser-compare/0007-w3-check.mjs`.

Implementation validation is V1–V8 only. Browsers, Supabase CLI, schema application,
server suites, P1 browser checks, baseline capability negatives and A–J comparisons
remain unrun here. The server-only run and fresh independent check own V9–V13.
Known NB-108 W2-S7/S8/S9/S16/S20/S21 remain separately classified baseline failures;
none is a substitute for new reconnect proof. No publication or deployment is
part of this implementation handoff.

## Ephemeral reactions (0007-W4 v1)

`workshop-reactions.test.mjs` registers R4-U01–R4-U40 in `npm test`.
Named dynamic imports check the eight ids, strict wire shapes and byte bounds,
independent room/client rolling budgets, current sender and recipient admission,
source outages, voting refusal, unchanged storage/document bytes, no replay,
controller clearing, wheel geometry, burst frames at 80/600/1,200ms, reduced
motion, the 20-burst cap and E's protected targets. These checks run without a
browser or Supabase and do not constitute browser acceptance.

`server/reactions.test.ts` registers S356–S377 (22) and `SUMMARY-REACTIONS` in both
runner configurations. It uses real sockets, a controlled clock, ordered renewal
barriers, current authority, bounded attachment inspection and live reconstruction.
Test-only parameter-matched source failures let one recipient fail independently.
S318 now includes the maximal five-entry reaction budget in its full attachment.
No production adapter change is needed. Existing physical exclusions S37, S43,
S70 and S168 and the Node-only S344 physical subcase stay unchanged.

Module guards require 51 team modules and 22 state hooks; `reactions-rules.ts`
joins the pure-rule list. App.tsx and all other palette/control expectations stay
unchanged except the single Reactions tool before Comment, for every admitted
role. Reaction refusals remain separate from document recovery and presence
refusals. Reaction actions and their Escape handling preserve spotlight following.

The implementation runs V1–V8 only. Server suites, schema application, Supabase
CLI, browsers, R4-S1–R4-S24, baseline capability negatives, A–J and accepted
regression scenarios remain for the separate server-only and independent check
runs (V9–V13). Registering tests is not execution or acceptance. The six known
W2 baseline failures remain separately classified and outside this milestone.

Server fix round 1 keeps S369 on socket admission and relay: real reaction frames
are held until closure, old sockets close with their required codes, and a fresh
socket using an unused pre-closure ticket is refused or closed. Ticket HTTP
status is not admission proof. S372 compares all application tables, rows and
meta while excluding `_cf_*` and `sqlite_*` runtime tables on both runners; it
uses no application-table allowlist.

The reaction relay performs one fresh strict access replay per frame using the
existing Timer authority boundary. After its lifecycle/fence checks, a local
frame context supplies each sender/recipient admission read without further
storage or service I/O. The context is discarded after the synchronous relay.
S366 holds that replay before revocation. S368 fails the required replay source
for the sender, then fails only one recipient's synchronous admission read,
retaining earlier deliveries and proving no retry. S367/S375 keep their current
admission/order assertions. S377 retains 50 connections, 245 bursts each from 49
senders times five, 512-byte bounds, and closed-budget cleanup. R4-U34–R4-U40
cover the replay count, protected inventory fixture, pending admission at closure,
I/O-free recipient checks, a timed 12,250-relay Node unit harness, isolated read
failures and admission rechecks after the authority await. S80 is unchanged.

## Spotlight bug batch (0007-B1)

Bug-lane implementation against the existing [0007-W3 brief](../docs/briefs/0007-W3-follow-a-facilitator-through-a-board.md)
(P1-S27/S39/S40) and [interaction v37](../docs/architecture/0001-interaction-v37.md)
(including P1-S21). Branch `codex/0007-B1-fix-spotlight-follow-bugs`, prerequisite
main `11f4d0f7851efb644189a975a856d35e3a6e4fb0`; validated source/test revision
`89c922e2e8784c7c9475fafaf4ced6ce75b21537`. This separate record commit changes
documentation only; the record-inclusive branch tip is reported in the handoff.

NB-110: repeated history emits during an existing preview declined a newly deferred
offer. Apply the local preview action only on preview entry. Separately, late
presenter presence/readback could reschedule the 100ms offer tick beyond the
3,000ms deadline; cap its next delay to the remaining deadline. The deterministic
hidden-return regression proves that timing failure, not a permanent hidden-state
deadlock. NB-111: People already uses `showSurface`, but the comment layer's
surface gate omitted People; add it while retaining drafts and clocks. NB-112 is
not a product bug in either tested ordering: an idle frame clears pending/confirmed
spotlight UI and no manual follow remains. No product code changed for NB-112;
the browser check must await the received idle state. NB-113 here changes only the
narrow status `flex-basis:100%`, as already required by v37.

`workshop-spotlight.test.mjs` adds these state/controller/CSS checks. The comment
check evaluates the production visibility gate with actual HostedBoard state;
it does not mount React or provide browser rendering/focus proof.

| New check name | Base source | Fixed source |
| --- | --- | --- |
| P1-U57 NB-110 preview history emits preserve a new deferred offer until current board and full window | FAIL: no follow | PASS |
| P1-U58 NB-110 hidden return follows exactly at the full safe deadline despite late presence and readback | FAIL: no follow at deadline | PASS |
| P1-U59 NB-111 People hides comment surfaces and keeps drafts clock and spotlight on reopening | FAIL: surface still visible | PASS |
| P1-U60 NB-112 presenter Stop clears banner and manual follow while follow is pending | PASS | PASS |
| P1-U61 NB-112 presenter Stop clears banner and manual follow right after confirmation | PASS | PASS |
| P1-U62 NB-113 narrow spotlight status explicitly occupies its own flex row | FAIL: missing basis | PASS |

Commands/results: `npm ci --ignore-scripts --no-audit --no-fund` passed with Node
26.13.0/npm 11.20.0; `npm run typecheck` passed all five workspaces; `npm test`
ran once, 1,110/1,110 passed, zero failures/skips. Focused execution used
`node --test --test-reporter=tap --test-name-pattern='NB-11[0-3]' tests/workshop-spotlight.test.mjs`.
After the issue commits, `git checkout 11f4d0f --` restored only
`apps/web/src/team/spotlight.ts`, `apps/web/src/team/comments/layer.tsx` and
`apps/web/style.css`, retaining all new tests: the four failures above occurred by
name, both NB-112 checks passed. `git checkout HEAD --` restored those same files;
the focused six passed and `git status --short` was empty. `git diff --check` and
mandatory public-boundary hooks passed. Git also emitted a sandbox-denied
`packed-refs.lock` maintenance warning; all commits succeeded.

No dependencies added; no contracts/check scripts/server/packages changed.
Browsers and Supabase CLI cannot start in this sandbox and remain unrun; no DOM
rendering, focus/IME, browser acceptance, builds or server suites ran. Server
suites were not required because no server/package source changed. No escalation,
push, merge or publication.

Fix round 1: prerequisite/source base `f1854821a451806410eaa93b5cdfc0060d7c0c1b`,
same branch; validated source/test revision
`3ff5a7bb794baf5647b46ead2a8357b318357aab`. NB-111's capture-phase Escape handler
still closed a hidden card and deleted its retained reply, before the People menu
could handle Escape. The small pure `commentInputBlocked` rule now gates comment
keyboard/pointer input while People, Timer, Share or History owns the surface.
Hidden card/composer drafts remain; visible comment Escape retains its existing
close behavior. The regression executes the production capture callbacks against
state ports, including the real `closeCard`/`place` code, without a DOM.

P1-S39's separate editor step expected Escape to close a sticky's inline editor. Interaction v4
keeps native Escape behaviour inside native text inputs, so the sticky editor staying open is the
contracted behaviour, not a product bug. The fix-round change that closed every inline editor on
Escape (`3ff5a7b`, with its check P1-U64) was reverted in `1bdd937`; the check script's
expectation is corrected instead. The remote Stop verdict above remains unchanged.

| New check name | f185482 source | Fixed source |
| --- | --- | --- |
| P1-U63 NB-111 hidden comment inputs preserve card and composer drafts until Comments reopens | FAIL: People Escape closed hidden card | PASS |
| P1-U64 NB-112 sticky editor Escape closes after remote Cancel while retaining text and IME protection | FAIL: sticky remained inline | Reverted with `3ff5a7b` (see above) |

`npm run typecheck` passed all five workspaces. `npm test` ran once this round:
1,112/1,112 passed, zero failures/skips. Focused command:
`node --test --test-reporter=tap --test-name-pattern='P1-U6[34]' tests/workshop-spotlight.test.mjs`.
After both issue commits, `git checkout f185482 --` restored only
`apps/web/src/team/comments/layer.tsx`, `apps/web/src/team/comments/rules.ts` and
`apps/web/src/ui/content-field.tsx`, leaving the tests in place: both failed by
name. Restoring those files with `git checkout HEAD --` passed both tests and
left `git status --short` empty. Diff checks and mandatory public-boundary hooks
passed; the sandbox's packed-refs maintenance warning persisted without preventing
commits. This separate documentation commit records the results; its final tip is
reported in the handoff. No dependencies, contracts, internal check scripts,
server or package source changed. Browsers, Supabase CLI, browser rendering/focus,
native IME checks, builds and server suites remain unrun; no escalation, push,
merge or publication.

## Team templates (0008-W2 v1)

`team-templates.test.mjs` adds T8-U1–T8-U12 (12 focused units): Copy selection
and whole-board sets, client/server wrapped document-10 validation, counts and
image refusal, compact UTF-8 content at 262,144/262,145 bytes, code-point limits,
Save labels and disabled-reason precedence, exact response parsing and order,
notice words, menu movement, independent insertion without provenance, and the
page-memory controller's role gate, fresh reads, refresh, refusals and pending
requests. Controller tests replace the HTTP port; they do not prove browser
rendering, modal focus or real server authorization.

`server/templates.test.ts` registers S378–S401 (24) and `SUMMARY-TEMPLATES` for
both Node and workerd. They use the existing real-token HTTP drivers and the
owned Supabase fixture, including its proxy for an induced database failure.
The setup helper reapplies the committed schema for S398 and removes templates
before workspace cleanup. S48, S192, S193, S221 and S372 change only their service
table count from 16 to 17; their other assertions and grants are retained.
Module guards expect 54 team modules, 22 state hooks, and only the two permitted
App.tsx substitutions. Existing activity assertions retain their results.

Implementation validation is limited to V1–V8 in the brief: install, typecheck,
the full unit suite, off/on web builds with license audits, fixtures, server
build and deployment dry run, dependency byte comparisons and diff inspection.
No deployment occurs. S378–S401 and the inherited server suites require the
later server-only/check runs; T8-S1–T8-S23, the off A–J comparison, activity Q
and independent baseline capability failures require the later check run.
Browser focus, the 17 visual captures, native IME and Safari acceptance are not
proved by these unit checks. Existing runner exclusions remain unchanged; no
whole-case server exclusion is introduced. S389 reports one unproved subcase:
a current workspace editor inherits editor on every same-workspace board, even
with a viewer grant, so a creator with a viewer source-board role cannot be
constructed under the inherited access contract. The defensive board-role check
is retained; independent review must disposition that requested subcase.

## Mind maps (0009-W2 v1)

`mind-map.test.mjs` adds MM-U1–MM-U17 (17 focused units): the `mindNode` record,
its keys and defaults; schema 11, reading versions 1–10 and their in-memory
upgrade; each refusal of the structure rule (missing, self and non-node parents,
loops, sides, collapsed roots, text and key limits); the layout on fixed
measurements (box, wrap at 320, columns on both sides, blocks, centring, one
rounding, rank rewriting and idempotence); the starter map; add child and
sibling; reparent, detach, join, drop targets and the cycle rule; collapse,
hidden nodes and counts; delete moving children up and root splits; the
consistent copy snapshot, paste and duplicate remap of `parent`; the codec and
adapter round trip of the four keys; shared Undo's `parent` remap and the add
that joins its first text session; the room's repair order through the edit
check; the commit's layout of changed maps; and the words and exclusions. Each
test imports its subject dynamically, so on the baseline it fails by name.

`server/mind-maps.test.ts` registers S402–S406 and `SUMMARY-MIND-MAPS` for both
Node and workerd: a stored version 10 board served as version 11 with no edits
row or history version, the room's repair of merged nodes and refusal of edits
still invalid after it, concurrent reparenting, history restores of version 10
and 11 snapshots, and the import route. Existing server checks change only their
document version from 10 to 11.

Implementation validation is limited to V1–V8 in the brief. S402–S406, the
inherited server suites, the M9 browser scenario, A–J and the accepted
regression scenarios require the later server-only and check runs.
