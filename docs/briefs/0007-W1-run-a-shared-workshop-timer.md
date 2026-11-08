BRIEF VERSION: 0007-W1 v1 (2026-11-08)
# 0007-W1 — Run a shared workshop timer

Status: Draft. Implementation has not started under this brief.

Contracts (twelve new files; prior versions remain untouched):
[workshop timer v1](../architecture/0007-workshop-timer-v1.md),
[sync v10](../architecture/0003-sync-v10.md),
[access v9](../architecture/0003-access-v9.md),
[API v9](../architecture/0003-api-v9.md),
[hosted persistence v9](../architecture/0003-hosted-persistence-v9.md),
[self-host runner v5](../architecture/0003-self-host-runner-v5.md),
[hosted storage v9](../architecture/0003-hosted-storage-v9.md),
[interaction v35](../architecture/0001-interaction-v35.md),
[web modules v33](../architecture/0001-web-modules-v33.md),
[board lifecycle v3](../architecture/0006-board-lifecycle-v3.md),
[document v14](../architecture/0001-document-v14.md),
[board file v3](../architecture/0006-board-file-v3.md).
Unchanged: [presence v1](../architecture/0004-presence-v1.md),
[identity v4](../architecture/0003-identity-v4.md),
[local storage v3](../architecture/0001-storage-v3.md),
[comments v4](../architecture/0005-comments-v4.md),
[toolchain v5](../architecture/0001-toolchain-v5.md),
[lock v5](../architecture/0001-dependency-lock-v5.json),
[inventory v5](../architecture/0001-dependency-inventory-v5.json),
[runtime notices v3](../architecture/0001-runtime-notices-v3.txt).
Use this version set wherever inherited contracts link a replaced version.
Current saved document 10, fileVersion2, room layout 6, logical backup envelope 1.
All checks concern the current application/protocol/formats.

## Outcome and read first

Everyone currently admitted to an active team board can run one shared workshop
timer, including viewers and guests with board grants. The server orders commands,
stores time and supplies clock samples. Joining/reloading/starter departure or an
ordinary runner restart does not restart it. A small toolbar countdown stays
visible when its timer-only panel is closed. Timer work never edits board content.
No dependency is added.

Read [AGENTS.md](../../AGENTS.md), [CONTRIBUTING.md](../../CONTRIBUTING.md),
[DESIGN.md](../../DESIGN.md) and all twelve contracts first. Timer v1 is the
complete technical contract: exact wire keys/replies/refusals, state edges,
server/monotonic clock, bounds, schema, lifecycle and concrete look/words/focus.
The companion versions define integration with the existing system. Report a
conflict before dependent work. Build directly; no prototype or scenario-tool
implementation is an input. Prove the specified values while implementing.

## Deliverables and boundaries

Planning source baseline is main **42ad60873e867963704b979ccd3f8ed87df90867**.
Implementation starts from committed main containing this packet; record that
actual prerequisite base. New source files carry SPDX-License-Identifier: Apache-2.0.
Only these implementation files may change, solely for this timer:

1. **Room and sync:** new `packages/board-room/src/timer.ts` and
   `packages/board-sync/src/timer.ts`; existing board-room src `room.ts`,
   `protocol.ts`, `interfaces.ts`, `storage.ts`, `backups.ts`, `lifecycle.ts`,
   `history.ts`, `access.ts`; existing `packages/board-sync/src/session.ts`. Add
   dedicated state/wire validation, singleton storage, ordered
   admission/commands/read/samples/broadcast, bounded attachments, expiry deadlines,
   backup exclusion/strict restore validation, recovery versus history distinction.
   Keep timer work outside edits, document receipts, waiting queues and presence.
2. **Server adapters:** existing `apps/server/src/start-node.ts`, `worker-room.ts`,
   `worker-runtime.ts`, `runtime.ts`, `lifecycle.ts`, `routes/operator.ts` and
   `apps/server/README.md`; existing
   `apps/server/scripts/mark-restored-volume.mjs` solely for the explicit recovery
   marker transaction. Implement identical clock/storage/deadline/reconstruction/
   discard/recovery behavior on Node and workerd. No timer HTTP route, SQL service
   table/function or deployment. Current service-table count stays16. No edit to
   `apps/server/supabase/nextphase_board.sql` is necessary or allowed.
3. **Web:** exactly three new files `apps/web/src/team/timer.ts`, `timer-rules.ts`,
   `timer-panel.tsx` (all in team); existing team `team-app.tsx`, `hosted-board.ts`,
   `history.ts`, `history-panel.tsx`, `share-dialog.tsx`, `comments/panel.tsx`,
   `comments/layer.tsx`; existing `apps/web/src/ui/save-area.tsx` and
   `apps/web/style.css`. Dedicated controller, pure clock/draft rules and UI;
   optional TeamParts.timerControl rendered immediately before Share; exclusive
   Timer/History/Comments/Share handoff and current-access cleanup. No timer logic
   in App.tsx or document-edit hooks. App.tsx unchanged/≤264 lines; exactly 22
   state-hook modules, exactly 40 team modules, existing import exceptions only.
4. **Tests and test-only controls:** new `tests/workshop-timer.test.mjs` and
   `tests/server/timer.test.ts`; existing `tests/modules.test.mjs`, `room.test.mjs`,
   `removal.test.mjs`, `presence.test.mjs`, `comments.test.mjs`, `mentions.test.mjs`,
   `board-history.test.mjs`, `board-lifecycle.test.mjs`, `team-import.test.mjs`,
   `shared-editing.test.mjs`, `recovery.test.mjs`, `grouped-edits.test.mjs` (all under
   tests), only for current layout 6/joined timer
   fixtures, module guards, timer assertions and explicit shared-path dispositions
   below. Preserve existing functional assertions. Existing server `suite.test.ts`,
   `shared.test.ts`, `removal.test.ts`, `lists.test.ts`, `mentions.test.ts`, `history.test.ts`,
   `lifecycle.test.ts`, `setup.ts`, `node-test.ts`, `worker-test.ts`, `driver-node.ts`,
   `driver-workerd.ts` (all under tests/server) may add only layout/table/join fixture
   changes, enumerated socket-outage phase amendments and deterministic timer clock,
   queue hold, storage failure, server frame, eviction/hibernation/restart/recovery
   controls needed for S225–S256. Keep physical Node cases distinct. Import new
   capability modules inside named unit cases so absence on the baseline is a
   named failure, not a top-level import abort. Root
   `vitest.node.config.ts` and `vitest.workerd.config.ts` only include the new server
   file. `tests/README.md` documents ranges, summaries, fixtures and dispositions.
5. **Record:** append only this brief's Implementation record, including later
   fix-round record commits. Requirements/contracts/indexes are prerequisites,
   not implementation edits. Separate validated source/test SHA from final
   record-inclusive tip.

Outside the named new controls, the existing screens' markup stays exactly as at
the base. Preserve file/name/selection/context/handles, people/save status/Share,
canvas and local/off markup and function. Timer is the sole added toolbar slot;
its styles do not resize Share or generic buttons. No package/manifest/lock/
inventory/notices/build-script/App.tsx edits. Only the two test includes above
change configuration. Report any required file outside this list before expanding.
No hosted schema application, deployment, external messaging or extra feature.

The check run authors `tools/browser-compare/0007-w1-check.mjs` in its tooling,
not the public implementation. It may amend only the existing 0006-w4 and 0004-w2
tools' named expected controls/Tab positions below; keep functional assertions.

## Required behavior and concrete design

Implement timer v1 in full. In particular:

- Accept 00:01–99:59/default 03:00; per-tab idle draft; idle + 1 min is local;
  active +1 adds60,000ms capped at 5,999,000 remaining. Pause/Resume/End are server
  commands. Cancel/Escape sends none. End confirmation targets timerId/version;
  a remote change dismisses it to current state. No starter privilege.
- Current owner/editor/viewer, including board-granted guest, all control. The
  document stays View only for viewers. No timer request/control on local/off.
- Atomic server status/duration/end-or-paused-remainder/version/timerId plus
  server-only last_actor; live strict access/lifecycle/epoch/generation/token gates.
  Five mutation attempts/rolling1,000ms/connection,1,024-byte frame; invalid attempts
  count, bounded hibernation-safe attachments. Separate bounded reads/samples.
- First valid expected-version command wins; duplicate/stale refusal returns
  current state only when authorized. No merged extends or automatic retries.
  One outstanding mutation, Checking timer… then2,000ms readback; no offline replay.
- Sample on join/reconnect/foreground/every15,000ms; monotonic midpoint estimate,
  no Date.now rendering; after same version/fresh samples two controlled clients
  differ≤1,000ms despite +300,000ms wall-clock skew. Failed/stale clock health
  freezes labelled state; no successful sample for 30,000ms disconnects timer UI.
- Persist last-leave/restart/eviction/hibernation; no inactivity TTL. Late wake
  normalizes at end+2,500 once. Explicit logical/marked/time recovery, Trash and
  discard clear; document-history restore preserves the current live timer.
  A distinct explicit_recovery_pending marker and durable generation reservation
  run before pending-history shortcuts; restore_pending alone is not that marker.
  Ordinary restart with an accepted history intent preserves the timer; a marked
  physical copy with the same intent resets it before serving, retaining the intent.
- No person's name/email anywhere in timer panel or timer announcements. Remove
  attribution and all reserved attribution space. Time/status block sits directly
  above control row with8px gap. Running has no status/byline; paused/zero retain
  Paused/Timer finished. Never remove those status lines to match running height.
- Timer button before Share: idle 98×40/active62×40, digits12px; panel240/right12/
  top toolbar-bottom+12/padding 12/gap 8; fields 79×68/digits48px; title 13px/600.
  Exact palette, glyphs, borders,33px visuals/40px hits, hover/focus, narrow layout
  and derived-position tolerances are timer v1 requirements. Specific timer
  status/confirmation styles override generic dialog paragraph expectations.
- Zero00:00 for 2,500ms, only End mutates, Close available; one silent300ms/±2px
  reduced-motion-aware shake, no replay/flash/sound. Title MM:SS – NextPhase Board
  running/paused/zero; base NextPhase Board idle/disconnected/leaving. Checking
  freezes its last confirmed prefixed title. No on-canvas title caption.
- Nonmodal labelled Timer dialog, no focus trap; exact per-state traversal,
  Enter/Space/Escape/arrows, exclusive panel handoff and one polite atomic timer
  status region. Actor-free cause on timer_state/timer_result distinguishes End
  from expiry; announce live transitions at most once per generation/version,
  reset silently, and no transition speech from a fresh snapshot. Reconnect
  announces only Timer reconnected. Never infer finish from elapsed/reply time;
  await committed expire cause at normalization. Digits/title ticks never speak.
  Do not steal canvas focus.

## Shared-path check dispositions

These explicit changes replace only the named expectations; do not silently waive
an older check or widen a gate on another path.

| Changed path | Older checks and disposition |
| --- | --- |
| Room message dispatch | S17–S21,S30,S34,S36,S38; the room/shared-editing/recovery/grouped-edits/presence/comments/mentions unit files named below: retain edit role/receipts/ordering, outer frame/unknown-kind refusals, renew/presence/comment strict keys and waiting semantics. Add timer kinds before edit fallback, never relax existing messages. Timer 1,024-byte overflow has timer-specific refusal below the outer ceiling. S225–S240/S254 prove separation. |
| Socket admission with timer snapshot | S9,S16,S24–S30,S40–S47; S77–S93 removal; S186–S187 history; S197/S218/S224 lifecycle. Retain auth/origin/ticket secrecy/one-use, epoch changes, expiry, lifecycle failure and removal assertions. Strict replay failure now refuses socket join 503 even if ordinary cached ticket/export policy permits it. S40 retains its complete lifecycle-outage refusals after driver.wake(). Node wake restarts the process and invalidates every pre-wake socket. After those refusals, restore lifecycle AND access replay, freshly join owner/editor/viewer and retain those new sockets; only then disable access replay again, keeping lifecycle available. On these post-restart prejoined sockets preserve the original owner/editor saved-edit and viewer role_too_low assertions, preserve cached HTTP/denied-guest assertions, and assert a new socket join returns 503 service_unavailable during replay failure. Restore replay before any further successful fresh join. Use the same phase sequence on workerd; never reuse a pre-wake socket or permit a fresh outage join. In S41–S43/S70–S71 retain locked/generic denial and recovered document/fence assertions; restore strict replay before any successful socket join, not before the intended locked observations. S45–S47/S50 unchanged beyond joined fixture fields. Do not turn all ordinary cached paths strict. S241–S245 prove timer removal/outage/epoch/generation behavior. |
| Backup restore validation | S41–S44,S47,S89,S168,S189–S192,S214–S220/S224 plus board-history/lifecycle units retain authentication, size, malformed/fingerprint/chunk/journal/fence/notice/denial assertions. Update current storage_version5→6 and table inventory only; backup table set excludes workshop_timer. Add strict rejection of timer top-level/table/meta/row injections before any fence/write in S250–S251; valid operator restore clears current timer, user document restore preserves it. |
| Right floating bar Tab order | T1-S1/S23/S27/S28/S31–S61 and 0004-W2 recovery/presence look/focus checks: insert Timer before Share only on hosted board. Retain each avatar/overflow/people-chevron stop. Two-person editor desktop order: ben (you), can edit. Open people menu (1) → Follow ana, owner (2) → People on this board: 2 (3) → Timer, idle, 03:00 (4) → Share (5), using current timer state/time. Narrow replaces stop2 with Show 1 more people; owner/viewer keep their own existing labels. Save status/divider have no Tab stop. From focused People on this board: 2 chevron, Tab once Timer, twice Share (Share was once). If Timer open, its exact state traversal precedes Share; opening Share closes it first. Existing details/menu/confirmation Tab positions stay unchanged. NewZ1-S17 covers panel traversal. No lost functional assertion or generic typography waiver. |

Existing tools may express accessible timer labels with the state/time from timer v1,
never a new hardcoded control name inferred from candidate DOM. 0004-W2's document
palette/leave-dialog control arrays do not gain timer entries: it belongs only to
the right floating actions bar. T1 Home/sidebar/details/dialog arrays likewise do
not gain Timer. Any assertion unreachable by this slot change remains byte-for-byte.

### Existing caller inventory

This inventory covers direct calls and shared fixture/helper calls in `tests/server/`
and `tests/`, and the accepted browser tools. It partitions every older server
check; rows including unaffected directory/authentication checks make exclusions
explicit. It authorizes no additional test run. **Unchanged** means keep every
functional assertion, refusal, bound, phase and race. The only common fixture
amendment is the current layout-6 schema and actor-free joined `timer`/`serverNowMs`
fields where a fixture constructs or validates that envelope. Mock server stamps
use the fixture's clock and a valid idle snapshot; do not change edit request bytes,
counts, retry/deadline/grouped-Undo assertions or introduce timer mutations into
edit fixtures. Do not loosen strict key checks; use the exact new key set.

| Existing caller/checks | Path and disposition |
| --- | --- |
| `tests/server/suite.test.ts`: S1–S8,S10–S15,S31,S48–S49 | Authentication, directory/RLS and shared setup: unchanged; no new timer route, role, service table or privilege. |
| Same file: S9,S16–S30,S32–S39,S44–S46,S50 | Join/message/storage callers: unchanged functional assertions with current joined/layout fixtures only. Keep one-time/origin/expiry/role admission, edit ordering/receipt/waiting/outer-byte limits, unknown-kind refusal and replay/fanout assertions. |
| Same file: S40 | Exact post-wake restore-replay → fresh owner/editor/viewer joins → disable replay again → cached existing-socket edit assertions plus new join503 sequence above. Lifecycle-outage503 refusals and denied-guest cases remain. |
| Same file: S41–S43,S47 | Logical/physical backup/restore and validation: valid envelope now layout6 and excludes workshop_timer; keep authentication/body/aggregate bounds, locked-state/ticket invalidation, fence and recovered-content assertions. Clear replay failure only before a successful fresh socket join, after the intended locked observations. Node-only physical exclusions remain. |
| Same file: S51–S54 | Docker identity/edit/restart callers: unchanged current-protocol semantics. Docker checks remain outside the accepted Node/workerd runs; this inventory does not commission them. |
| `tests/server/lists.test.ts`: S55–S67,S72–S76 | Creation/opens/rename/copy/edit helpers reach room initialization/admission/dispatch: unchanged, current joined/layout fixtures only; no directory/list/table-count change. |
| Same file: S68–S71 | Logical/point-in-time/marked-volume recovery and locked rename: same valid layout6 backup exclusion; preserve original name/time/fence/room_locked/outage assertions. Restore replay before successful socket rejoin, not before locked observations. S70 stays Node-only. |
| `tests/server/removal.test.ts`: S77–S93 | Every removal/epoch/rejoin/held lookup/waiting/edit case unchanged. S88 restart and S89 backup recovery use layout6/excluded timer table; keep access, removed-ticket/refusal, receipts and copied content assertions. Timer-specific additions are S241–S245, not a waiver of these cases. The marking helper used by physical-recovery callers additionally writes the distinct marker; all existing access/content/fence assertions stay. |
| `tests/server/shared.test.ts`: S94–S101 | Socket/presence admission, capacity, labels/person stamps, hibernation and departures: unchanged, joined gains only exact actor-free timer/serverNowMs. Preserve S98 ticket consumption/capacity order and all presence frame/rate/expiry bounds; timer sampling never renews presence. |
| Same file: S102–S120 | Shared edit/Undo/receipt/recovery/epoch and unknown-kind dispatch: unchanged functional assertions, current joined fixture only. S116 operator restore uses layout6 valid backup; no edit/grouped-Undo wire or retry-count change. |
| Same file: S121 | Rename current-layout check title5→6 and change every storage_version expectation5→6 (initial, each reopen and after restore). Keep idempotence, canonical export, edits/receipts, empty discussion and meta equality assertions. Valid backup excludes workshop_timer. |
| Same file: S122–S132 | Discussion action/snapshot/authorization/ordering/anchor/text/rate/malformed-message dispatch: unchanged. S127 backup snapshot/count/anchor recovery uses the current valid envelope excluding workshop_timer. Never merge timer and comment budgets or receipt kinds. |
| Same file: S133 | Malformed-backup validation: keep all missing comments/missing mention_pending/malformed mentions refusals, comment/text and whole-backup bounds; valid source envelope uses layout6 and excludes workshop_timer. New timer-injection permutations belong to S251, without weakening these malformed cases. |
| Same file: S134 | Imported initialization: change values.storage_version5→6 only; retain revision0, board identity, canonical content and identifiers. |
| Same file: S135–S142 | Import validation/compensation/identifier/size/title/lost-reply callers: unchanged functional assertions; S139 backup/restore uses layout6/excludes workshop_timer, retaining revision0/identifier/empty-discussion assertions. |
| `tests/server/mentions.test.ts`: S143–S157 | Roster and comment/mention dispatch, restart, rate/byte/backup callers: unchanged functional assertions and exact ranges, text, reply order, notification and RLS bounds. S146 restart/current wire and S156 aggregate backup use current layout6/envelope without timer; do not raise any frame/backup ceiling. |
| Same file: S158 | Restart/backup/recovery caller: valid backup excludes workshop_timer; preserve held-project rejection, historical mention text, no replay, restore_pending/locked behavior and clear-notice retry. No assumption that pre-wake sockets survive. |
| Same file: S159 | Initialization rollback/validation before fence: change post-wake storage_version expectation5→6. Keep all four malformed-backup400/no-fence/no-clear assertions, rollback/meta equality, successful restore and historical ranges/no notices. Valid envelope excludes workshop_timer. |
| Same file: S160 | Add workshop_timer to the room-store measurement inventory by reading actual runner rows (it is absent from envelope.tables). Record row count≤1/encoded row≤1,024 bytes and explicit absence from backup. Preserve every existing store, lifetime-growing category and other bound; service tables remain16. |
| Same file: S161–S168 | Author-loss/held delivery/disabled/retry/Undo/maximal-frame and physical recovery: unchanged functional assertions with current protocol fixtures. S168 keeps Node-only marked-volume/checkpoint/fail-closed proof and uses the current valid backup boundary. The physical marking helper now sets explicit_recovery_pending separately from restore_pending, preserving all original checkpoint/outage assertions. |
| `tests/server/history.test.ts`: S169 | Change initialization storage_version expectation5→6; retain initial/imported capture, idempotent restart and capture-rollback/no-partial-store assertions. |
| Same file: S170–S188 | History capture/expiry/metadata/role/restore/epoch/receipt/restart callers: unchanged functional assertions, current layout/joined fixtures only. Preserve clock reapplication after Node wake, version journals/chunks and genuine capture/restore behavior. Document-history restore keeps the live timer; additional timer proof is S256. |
| Same file: S189–S191,S193–S194 | Backup/recovery/strict malformed-history validation/aggregate/API callers: current valid envelope layout6/excludes workshop_timer. Preserve notice clearing, every fingerprint/chunk/body/refusal-before-fence assertion,16MiB limit and service privileges; no generic validation relaxation. |
| Same file: S192 | Add workshop_timer to actual room-row inventory, row count≤1 and encoded row≤1,024 bytes; assert excluded backup table. Retain every existing store/chunk/new-row bound, history expiry/fingerprint evidence, independent fence and service-table count16. |
| `tests/server/lifecycle.test.ts`: S195–S224 | Lifecycle/room initialization/admission/held dispatch/backup/recovery callers: unchanged existing functional assertions, current layout/joined/envelope fixtures only. S210/S213 complete discard inventory includes workshop_timer; no residual row/file/alarm. S214–S220/S224 preserve authority-before-restore, deadline/ledger/denial/fingerprint/chunk/journal bounds; physical/time helper entry points stamp the explicit marker before load; timer is excluded from logical backups, no new service table or lifecycle permission. |
| `tests/room.test.mjs`: all cases | Direct Room join/connected/message/backup/restore/lookup: unchanged queue, receipts, waits, locked restore/export and overtaken-lookup assertions; current schema/joined fixtures only. |
| `tests/presence.test.mjs`: all cases | Direct storage/admission/dispatch/restore: created storage_version fixture/expectations5→6, uncreated remains0; preserve idempotence, holds, labels/roles, all close codes and existing presence limits. Keep the complete attachment≤16,384-byte bound with timer budget fields included; do not enlarge it. |
| `tests/comments.test.mjs`: all cases | Direct Room/BoardSession/storage/backup callers: created/current layout fixtures/expectations5→6; uncreated0 unchanged. Add exact idle timer/serverNowMs to synthetic joined frames only as needed. Preserve all comment/edit ordering, author/text/rate/count/receipt/strict malformed-backup assertions. |
| `tests/mentions.test.mjs`: M-U01–M-U15, including parameterized cases | All existing functional assertions unchanged. M-U05 valid layout fixture5→6 and unsupported-layout sentinel6→7; preserve initialization rollback/idempotence/refusal. M-U08 uses current backup without timer and keeps all malformed-range/table/pre-fence assertions. Other mocked joined frames may add exact current timer/serverNowMs; M-U14 reconnect/draft/terminal-loss proof remains. |
| `tests/removal.test.mjs`: all cases | Direct room epoch/removal/dispatch and delivery callers unchanged; current joined/layout fixtures only. No relaxation of old-epoch/removed authorization or held lookup/write fences. |
| `tests/team-import.test.mjs`: all cases | Current room import's storage_version expectation5→6; preserve transaction rollback, zero revision, identifiers, file validation/body/export and compensation assertions. Dynamic store inventory now includes singleton workshop_timer. |
| `tests/shared-editing.test.mjs`, `tests/recovery.test.mjs`, `tests/grouped-edits.test.mjs`: all cases | Real BoardSession fixture files: authorize only exact idle timer/serverNowMs additions to synthetic current joined frames if required. Keep all edit bytes/sent counts, retries,10s deadlines, order, recovery, Undo/Redo and grouping assertions. Pure adapter/rule cases unchanged; do not replace checks with timer-only cases. |
| `tests/board-history.test.mjs`: H-U01–H-U21 and parameterized cases | Direct Room/BoardSession/backup plus history UI/focus callers unchanged; current joined/layout/valid-envelope fixtures only. H-U10 retains all malformed fingerprint/no-fence/aggregate assertions. H-U14/H-U21 preview/Pan/modal Tab assertions unchanged: the toolbar slot does not change history modal traversal. |
| `tests/board-lifecycle.test.mjs`: L-U01–L-U10 and the four named Worker/focus/inspection regressions | Direct lifecycle/room/backup/BoardSession callers unchanged; current joined/layout fixtures only. Keep discard/recovery inspection/role-change versus final-loss and Cancel focus assertions. Complete discard includes the new room table; no new modal Tab stop. |
| `tests/modules.test.mjs`: all guards | Amend exactly37→40 team names/version32→33 and register three declared timer modules as required by modules v33; preserve all import/App.tsx/22-hook/shared-boundary/license/test-driver guards and save-area inventory. |
| `tests/team.test.mjs`: all cases; `tests/browser/app-regressions.mjs`: all fixture cases | Save state/role/auth/Share words and local SaveArea callers unchanged. No right-bar timer in these local fixtures, no altered local status selector or extra Tab stop; no file edit or additional fixture run authorized. Other test files do not call these changed paths. |
| Accepted private-tool T1-S1–S61 and0004-W2 existing rows; A–J off | Preserve every functional/denial/clearing/reconnect/focus assertion. Only hosted right-bar expected controls/Tab slots change as above; Home/details/dialog/palette arrays do not gain Timer. A–J off retains only existing saved-time normalization. The unchanged local fixture harness is not an additional accepted run. |

`tests/server/mentions.test.ts` is explicitly allowed only these current-layout,
joined-fixture and timer-inventory amendments; all its functional assertions stay.
The three real client fixture files are allowed only the joined additions above,
not edit-request or recovery-policy changes. S225–S256 own new timer behavior.

## Server checks

0006-W4 ends atS224. New **S225–S256** (32 checks) run on both
`npm run test:server:node` and `npm run test:server:workerd`. New file prints
PASS/FAIL for each ID and SUMMARY-TIMER. Use actual storage/wire/authority,
deterministic clocks and queue holds, not screenshots. Only explicitly physical
Node subcases are Node-only; a common check still executes on both. Reapply
process-local test controls after Node restart. A skipped capability is not PASS.

| ID | Required proof |
| --- | --- |
| S225 | Effective owner/editor/viewer and board-granted editor/viewer guest each start/pause/resume/extend/End a non-starter's timer; guest without grant/outsider/disabled denied without timer state. Viewer document edit still role_too_low. |
| S226 | Start at server t with1,000,180,000,5,999,000ms yields exact status/duration/end/version/new UUID; idle snapshot shape has no actor. No client timestamp/remaining/role/actor accepted. |
| S227 | Pause at controlled t stores exact end−t, frozen across elapsed time; Resume stamps t+remaining, same timerId, version+1 each; no document revision increment. |
| S228 | Extend running/paused adds60,000ms or exact capped delta; duration budget increases by delta; cap refuses timer_bounds without version change; no reduction through typed active fields/wire. |
| S229 | Accepted End clears active fields/id and increments version once; server actor UUID changes, no label emitted. Idle End and invalid state edges refuse timer_state. |
| S230 | Hold two Starts with same idle identity/version; release in both receipt orders, one winner/new identity, loser timer_stale/current snapshot. No second row/timer. |
| S231 | Race Pause versus Pause/Extend/End on same version in both orders; exactly first valid transition, loser stale; awaited authority cannot let later queue entry overtake. |
| S232 | Race Resume versus Resume/Extend/End from paused, both orders; exact winning remainder/end/budget, loser stale. |
| S233 | Two extends same version add one minute; duplicate frame applies once; deliberate later request on new version adds another. Lost reply readback reports committed state without mutation retry or receipt row. |
| S234 | End→new Start; old timerId/version, delayed command and duplicates cannot affect replacement. Wrong ID/old version refuse timer_stale with authorized current snapshot. |
| S235 | Joined/sample/refusal remain cause-free; timer_result/timer_state have the exact actor-free cause enum and matching cause/version for each committed action, expiry or reset. Stamps are reply time, never event classification. No cause journal; invalid cause fails strict client validation. Preserve correlation, generation and no-version-change read assertions. |
| S236 | Strict keys/types/UUID/action and duration cases:00:00, nonwhole-second Start, negative/over5,999,000, unsafe arithmetic, forged stamp/actor/role, unknown keys. Exact timer_bad_message/timer_bounds and no partial storage/version/broadcast. |
| S237 | Recognized timer_command/read at 1,024 bytes allowed when otherwise valid (padding whitespace);1,025 refuses timer_message_too_large. Existing outer1,048,576 ceiling and bad JSON/unknown kind retain generic refusals and transport usability. Multibyte bytes measured. |
| S238 | Five mutation attempts in(t−1,000,t] allowed, sixth timer_rate_limited; invalid attempts counted; boundary at exactly 1,000 ages out. No growing timestamps/log and no presence/token renewal. |
| S239 | Hibernated socket attachment preserves mutation rate window; at most five timestamps/budget≤1,024 bytes. Separate read budget 5/1,000, excess refusal, reads cannot bypass mutation limit or change active timer. |
| S240 | Timer refused/unavailable/state/result traffic never enters edit receipts/waiting, edits/presence/comments keep their original strict envelopes/limits/authorization, same socket remains usable for legitimate work. |
| S241 | Fresh strict admission on join/read/sample/command/broadcast; hold live membership/grant lookup then remove access/disable, release: no state/control after loss,4403/4401 as applicable; other board unaffected. |
| S242 | Editor→viewer epoch change4403 requires fresh ticket/join; obsolete epoch cannot control/read, new viewer can Start/End and still cannot edit. Retain fresh-role/draft distinction, no facilitator restriction. |
| S243 | Expired token, old restoreGeneration, consumed/foreign/origin-mismatched ticket and removed connection cannot obtain timer snapshot or mutate. Reconstruct socket then repeat; current admitted connections only receive broadcasts. |
| S244 | Required access replay/lifecycle/fence failure refuses timer work/join with contract503 or timer_unavailable, no cached snapshot/success. Restore authority then fresh read succeeds. Prove inherited ordinary HTTP/existing-socket cached policies in their specified outage phase, rather than weakening them globally. |
| S245 | Timer command/read/broadcast held across Trash admission/purge/explicit recovery or board generation change never crosses fence or repaints; user document restore carries current timer under higher transport generation and rejects old commands. |
| S246 | Running then last-leave and late rejoin, starter departure and solo reload preserve same end/id/version; elapsed time recalculated. Paused last-leave/rejoin remains exact indefinitely until End; no inactivity reset. |
| S247 | Actual DO eviction/hibernation reconstruction preserves running end and paused remainder and rate attachments. Node ordinary Room reconstruction proves same storage semantics; additional actual Node process restart is required by S248, not claimed as hibernation. |
| S248 | Paired ordinary-restart case: persist a running timer, then a paused timer in a separate fixture, each with a real accepted document-history intent held in phase intent and restore_pending=1 but no explicit marker. Ordinary Node process restart and workerd room/isolate restart resume that intent without clearing/restarting timer end/remainder/id/version, finish its document operation once and refresh transport generation. Reapply process-local controls; prove no lost intent/chunks and preserve original restart assertions. S252 uses an equivalent pending-intent copy as the explicit-recovery pair. |
| S249 | At end−1/end/end+2,499/end+2,500 and much later: running/zero/normalized idle exactly, only End during zero, no pause/extend after end; late alarm/read/command normalizes once/version+1, no cue replay. Existing earlier presence/ticket/history deadline still wins scheduler. |
| S250 | Actual logical backup while running and paused omits workshop_timer entirely and has current storage_version6. No actor/timer metadata/clock/counter leakage; other document/history tables/fingerprints unchanged. Whole16,777,216-byte refusal retained. |
| S251 | Inject timer table/top-level payload/meta key/strict-row field or either explicit-recovery meta key separately into a valid current backup;400 bad_request before any fence, document, timer, marker or journal write. Backup excludes workshop_timer and explicit marker/reservation keys. Existing malformed history/fingerprint/chunk rejection still holds. |
| S252 | Retain valid logical operator restore and supported explicit time-recovery reset cases on both runners. A new logical restore while an accepted history intent is active still returns503 restore_pending, preserving that intent and timer. The paired physical-recovery case uses the same pending phase intent/timer fixtures as S248: Node-only physical subcase stops process, copies DB with accepted intent/chunks plus running/paused timer, executes the real mark-restored-volume.mjs and restarts. Distinct explicit marker must win over history-intent recoveryGeneration shortcut: reserve above all floors, reset once before serving, preserve/complete accepted history intent. Fail after reservation/reset and before completion, restart/retry: marker/reservation and denial persist, no repeated reset, no stale command succeeds; clear marker only after completion/strict replay. Prove malformed marker/floor failures stay locked. Never count Node physical marking as workerd PASS; ordinary-intent preservation is S248. |
| S253 | Trash admission clears side record before socket ending; restore same board idle. Discard/purge drains held timer callbacks, removes record/files/alarm, no late recreation. Denied lifecycle states never initialize a timer; unrelated board untouched. |
| S254 | Measure maximal timer row, each rate budget, each explicit marker/reservation meta row and complete timer_result/timer_state/sample/refusal frame≤1,024 encoded UTF-8 bytes including cause, UUIDs and maximal safe integers. No growing journal/set. Unsafe counter/duration/end/fence overflow or injected reset/mutation transaction failure leaves state/marker/version coherent with no premature success/broadcast; deliberate retry after recovery succeeds. Preserve existing atomic-failure proof. |
| S255 | Surround all timer-only mutations/reads/ticks/last-leave with canonical bytes/revision/edited-at/identifier/Undo-input/export and history count/fingerprint observations: unchanged. Independently due genuine document history work is distinguished; timer never triggers capture. |
| S256 | Actual document-history restore while running and paused preserves current live end/remainder/id/version, no historical timer in version; restart retains it, old-generation controls refuse, fresh controls succeed. File/JSON export remains content-only with identical bytes/digest for timer-only work. |

## Browser scenario Z1

Z1 is the timer scenario identifier. M1 is already an existing sections check;
Z1 has no prior check/brief use at drafting. Fresh check run writes
tools/browser-compare/0007-w1-check.mjs from this table. No prototype exists.
Use actual app commands/network/clock/storage controls, never injected DOM/paint.
Print PASS/FAIL per ID and SUMMARY-Z1. Match exact own text, read only specified
computed CSS, and save geometry/wire receipts. Expected values come from timer v1,
not candidate output. Use independent candidate/baseline accounts/stacks and two
separate browser contexts, not two pages sharing auth/tab state. Synthetic fixture
is timer v1: ana/ben/mia/lee@example.com, Acme, Launch plan and three named Rose
stickies; desktop1280×800/narrow375×812/scale 1/en-US/America/Panama.

For2:14 paused/illustrated states start03:00 at controlled server t, advance 46,000ms
and take a fresh sample; Pause when needed. Use a held monotonic/server test clock
only for still geometry receipts, preserving real clock behavior for sync tests.
No screenshot alone proves a state transition. Rows1–22 also save one screenshot
of each listed state with the actor line omitted. Derived coordinates use0.5px,
wrapped text height 1px; use specific status/confirmation styles, not generic p.

| ID | Required actions and expected assertions |
| --- | --- |
| Z1-S1 | Closed idle toolbar: Timer, idle, 03:00 before Share,98×40/white/grey12px/icon; actual people/status spacing; Share unchanged. Title NextPhase Board. |
| Z1-S2 | Start03:00 then46s elapsed: closed toolbar02:14, Timer, running, 02:14,62×40/#f5f0ff/#7051cf, no icon; canvas remains usable. |
| Z1-S3 | Pause at 02:14 then advance time: toolbar remains02:14/#79737f on same purple fill, no flash; exact paused accessible label. |
| Z1-S4 | Reach zero: toolbar00:00/purple, Share stationary during ±2px shake; end+2,500 returns own idle draft. Sample both deadline boundaries through deterministic controls. |
| Z1-S5 | Editor idle panel: title Timer, Minutes03/Seconds00, fields 79×68/48px, + 1 min/Start timer/Close timer exact sizes/palette. Panel240/right12/top72, derived h211.391, no person/email/attribution. |
| Z1-S6 | Set00:00: Start disabled/.45, no invented validation sentence; + 1 min/Close available, trigger Timer, idle, 00:00. Bad/empty/out-of-range text disables Start; valid00:01/99:59 permits it. |
| Z1-S7 | Non-starter editor running 02:14: read-only fields outside Tab, + 1 min/End timer/Pause timer/Close timer; no actor line or empty space. Time block→8px→controls, derived controls y230.391/h40, panel h211.391. |
| Z1-S8 | Paused02:14: grey fields, Paused status 12px/1.45, +1/End/Resume; status→8px→controls, no actor. Derived one-line h236.781/control y255.781. Resume creates advancing shared timer. |
| Z1-S9 | Viewer running panel identical title Timer/controls/authority, existing View only notice/document restrictions intact; viewer non-starter Pause/Resume/Extend/End works. No person/email within panel. |
| Z1-S10 | End opens inline Stop the timer? / This stops the timer for everyone, not just you. / Cancel / Stop timer. Cancel focused, Tab Stop timer→Close timer→Share; Escape returns End/no wire command. Actual confirm idles both contexts; Close never stops. Typography13px/1.5, purple confirm,3px focus ring/offset 3. |
| Z1-S11 | Zero panel00:00/Timer finished; +1/Pause disabled, End then Close only enabled traversal; at 2,500ms returns own input. No actor/reserved space; Timer finished line retains its real line box. |
| Z1-S12 | Hold initial joined/sample before confirmed timer: --:--, Connecting timer…, base title, no false03:00 shared state; all mutations disabled, heading initially focused/Tab Close only. Release fresh joined+sample restores current state. |
| Z1-S13 | Disconnect from confirmed02:14: frozen digits, Timer disconnected. Reconnecting…, disabled mutations/Close enabled, base title. Advance offline; reconnect fresh state reflects server elapsed time, zero outgoing mutation replay. |
| Z1-S14 | Hold a command answer: Checking timer…, frozen02:14, disabled mutations/Close enabled, last confirmed02:14 – NextPhase Board title. At2,000ms observe timer_read only; release correlated read confirms actual state, no second command. Timer refusal does not change document-save UI to refused. |
| Z1-S15 | Open running timer with Interview five customers selected: context(12,134,783.078,40), note(220,200,240,240), all four16×16 corner hit areas and other handles retained within 0.5px. Medium and Launch plan unchanged, no added name field. Running panel has no attribution gap. |
| Z1-S16 | Closed panel running 02:14, paused 02:14 and zero00:00 yield exact MM:SS – NextPhase Board title, one prefix only; idle/disconnect/leaving returns NextPhase Board. No screenshot-caption element ships. |
| Z1-S17 | Keyboard-only Enter/Space opens trigger. Idle Minutes→Seconds→+ 1 min→Start timer→Close timer→Share; active +1→End→Pause/Resume→Close→Share (opening focus Pause/Resume); invalid/cap/zero skip disabled as timer v1. Shift+Tab reverses. Start hit40×40 focus outline 3px #7051cf/offset 3, not33px disc. No trap/aria-modal/positive tabindex. Escape closes to Timer without ending; keys never edit canvas. |
| Z1-S18 |375×812 running panel x123/y128/w240, byline-free derived h211.391/control y286.391; actual second actions row y68/h48/avatar overflow retained; right/bottom12 containment/scroll, reachable Share, no collisions introduced. |
| Z1-S19 |375×812 closed running toolbar02:14 before Share; Timer 62×40/Share unchanged; keyboard self-avatar→Show 1 more people→People on this board: 2→Timer→Share reachable, no new horizontal clipping from timer. |
| Z1-S20 | Owner idle 03:00: same fields/controls/design and full Start/End authority; no owner/facilitator-only restriction or person text. |
| Z1-S21 | Viewer idle 03:00: editable fields/+1/Start despite View only; set01:00/Start, owner sees same timer; viewer confirmed End works. |
| Z1-S22 | Running99:59 immediately after fresh sample: extension disabled/.45, End/Pause available; exact cap accessible label. Paused cap stays capped, idle +1 from 99:30 yields99:59 locally. No actor/reserved space. |
| Z1-S23 | Two separately authenticated contexts; skew B Date.now by+300,000ms before timer sampling, then change its wall clock again while performance.now stays monotonic. A starts, B pauses/resumes/extends, await same version and fresh sample in both; compare estimated remaining at a common monotonic observation within 1,000ms and rendered seconds within one. Repeat closed-panel/background-foreground resample; assert no reset from wall-clock jump. Log versions/stamps/p0/p1/observations. |
| Z1-S24 | Granted editor guest then granted viewer guest each sets/starts and non-starter controls full sequence. Ungranted guest/denied caller gets no control/state; forged client role/actor fails. No person appears in panel or status announcements. |
| Z1-S25 | Coordinate simultaneous Starts and extends through two contexts using held sends: one winning version/id; stale loser sees authoritative current state, not extra minute or auto retry. Double click sends at most one outstanding mutation. Correlate with S230–S234, no fabricated UI result. |
| Z1-S26 | A draft04:30/B draft01:15. Idle +1 affects only caller/no frame; arrows±1/Shift±5 clamp00:00–99:59; Enter valid field starts. Remote Start/Extend/End/expiry restores each own draft. Full reload03:00. Active fields cannot type-reduce. |
| Z1-S27 | Open End confirmation, remote Pause/Extend/End/new Start changes identity/version: confirmation dismisses to current card, no old confirm can End replacement. Cancel/Escape send nothing and return correct focus. Remote transition preserves enabled panel focus/falls to Timer heading; canvas focus never stolen. |
| Z1-S28 | Open Timer from History/Comments, then each/Share from Timer: one transient surface only, unposted drafts preserved by controllers. Timer continues closed and controls work during genuine historical preview while document editing remains read-only. Existing Share modal trap works. |
| Z1-S29 | Inspect one timer role=status/aria-live=polite/aria-atomic=true region; exact cause-driven start/pause/resume/extend/End/expiry messages, no actor, no per-second speech across≥3 ticks; coalesce rapid changes. Two connected contexts start00:03 and await the same acknowledged Start version/fresh samples; then hold A’s incoming timer_state/timer_sample replies. B confirms End at t+1,000; release A’s authoritative cause end after t+6,000 (past the prior end+2,500). A announces Timer stopped exactly once and never Timer finished; duplicate delivery and B’s result/state pair cannot speak twice for the same version. Separate timer with no End expires: committed cause expire announces Timer finished once; elapsed zero/reply time alone does not. Reconnect each terminal fixture: fresh snapshot announces only Timer reconnected, no stop/finish replay or shake. Normal zero retains one300ms linear0,+2,−2,+2,0 cue, reduced motion suppresses it; no sound/flash. |
| Z1-S30 | Team-off sentinel: no timer DOM/control/prefix/requests, normal local save/toolbar/keys retained. Runs only off build. |
| Z1-S31 | Team-on app's local board and ordinary local view: no timer/control/requests; hosted solo participant still gets timer. File export/import does not import/start timer. |
| Z1-S32 | Running/paused reload, late join, starter leaves, then all contexts leave and fresh context joins: same authoritative end/remainder/id, running elapsed/paused fixed. Personal reload draft03:00; after late expiry idle, no completion replay. Server-runner restart evidence is S247–S248, not inferred from browser reload. |
| Z1-S33 | While timer panel/pending read/confirmation open, editor→viewer4403 reauthorizes/rejoins and keeps own draft/control rights; separately revoke effective access, release held replies: clear timer/panel/input/pending/title and no late paint or replay. Other participant continues. Distinguish503/unconfirmed authority from confirmed loss. |
| Z1-S34 | Actual Trash/restore and explicit operator recovery clear timer/current old commands; restored board fresh idle. User document-history restore instead retains live timer and fresh session/sample under new generation. Discard cannot return a stale panel. |
| Z1-S35 | Timer-only Start/Pause/Resume/Extend/End/expiry leaves canonical bytes/revision/edited-at/Undo/Redo/file export payload+digest/history count+fingerprint unchanged. Compare saved baseline first, no unrelated pending edit; separately due document checkpoint is not a timer capture. |
| Z1-S36 | Observe read samples on join/reconnect/foreground/15,000ms cadence, one outstanding read and strict correlation. Drop reads: at 30,000ms clock-health expiry frozen/disconnected/base title; release fresh sample/admission recovers without mutation replay or document-draft loss. |

## Acceptance criteria

These are the approved three criteria, stated as public requirements. References
to the controls, clock/bounds and lifetime mean timer v1's complete sections.

- **0007-W1-AC01:** On an active hosted board, every currently admitted effective
  owner/editor/viewer, including a guest admitted through a board grant, can set/start
  one timer, pause/resume, add one minute and confirm End. No starter privilege exists.
  Verify each role, a non-starter and denied/removed access. Start accepts00:01–99:59,
  default 03:00; extension caps at 99:59 remaining. Cancel changes nothing; confirmed
  End idles everyone while preserving each tab's own idle input. Local/team-off
  boards have no control or timer requests. The specified controls, confirmation
  and keyboard/focus behavior pass; viewer title is Timer.
- **0007-W1-AC02:** The server room stamps and stores status/duration/end-or-paused-
  remaining/version/timerId/last actor, independent of document revision. Connected
  clients render from measured server time, including after skewing a client's wall
  clock; after both receive the same version they differ by at most1,000ms in the
  controlled check. Server receipt order plus expected identity/version chooses one
  winner for simultaneous Start/Pause/Resume/Extend/End; stale/duplicate commands
  cannot apply twice. Clock sampling, limits and refusals follow timer v1. Offline
  or uncertain clients show the labelled frozen/pending state, cannot mutate or
  replay, and recover from a fresh snapshot. Toolbar and title show time even with
  the panel closed. At zero show00:00 for 2,500ms, one reduced-motion-aware cue and
  polite completion, then idle; no sound. Last actor stays server-only.
- **0007-W1-AC03:** Reload, late join and starter departure read the same running end
  time or paused remainder without restarting it. Last departure, Durable Object
  eviction/hibernation/ordinary restart and Node restart preserve the side record;
  elapsed running time is recalculated, paused time stays paused, and a late wake/read
  normalizes expired state. Timer-only actions never change canonical document/
  revision/edited-at, Undo, board-file export or retained history/fingerprint. Logical
  backups exclude timer state. Document-history restore preserves the current live
  timer without restoring a historical one; Trash/discard/explicit operator recovery
  clears it, and Trash restore starts idle. Fresh access gates every reconnect;
  removed/denied callers get no timer state or control, and delayed old results
  cannot repaint it. Prove these boundaries on both runners, with Node-only physical
  recovery cases identified.

| Criterion | Evidence that shows it |
| --- | --- |
| 0007-W1-AC01 | S225–S234; S236–S244; Z1-S1–S22; Z1-S24–S28; Z1-S30–S31; Z1-S33; V4; V9 |
| 0007-W1-AC02 | S226–S240; S249; S254; Z1-S2–S4; Z1-S7–S14; Z1-S16–S17; Z1-S22–S23; Z1-S25–S29; Z1-S36; V4; V9 |
| 0007-W1-AC03 | S241–S256; Z1-S13–S14; Z1-S28; Z1-S30–S36; V4; V9–V13 |

## Review focus

Read 2 was the last pre-commit read; the fixes for its two findings (explicit-recovery marker; transition cause) were not re-read: verify them first at review.

## Validation commands and expected evidence

From repository root with Node 26.13.0/npm11.20.0:

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm run typecheck
npm test
BOARD_TEAM_FEATURES=off BOARD_SUPABASE_URL=http://127.0.0.1:55321 BOARD_SUPABASE_ANON_KEY=synthetic BOARD_SERVER_URL=http://127.0.0.1:8796 npm run build
npm run audit:licenses
npm run build:fixtures
BOARD_TEAM_FEATURES=on BOARD_SUPABASE_URL=http://127.0.0.1:55321 BOARD_SUPABASE_ANON_KEY=synthetic BOARD_SERVER_URL=http://127.0.0.1:8796 npm run build
npm run audit:licenses
npm run build:server
npm run audit:licenses
WRANGLER_SEND_METRICS=false npx wrangler deploy --dry-run --outdir <scratch> -c apps/server/wrangler.json
git diff --name-status <base>..<validated>
git diff --check <base>..<validated>
```

Copy off/on dist aside before next build. Baseline has its own independent install,
source and stack, never candidate links/schema. Ignored artifacts are not source.
Fresh full-access server-only check after build, before browser check1: clean
candidate clone/install, unique disposable LOCAL Supabase stack, schema install
and reapply, Node suite then workerd sequentially, no browsers/baseline/design.
Return failures for fixes and repeat affected server proof before browser check1.
Schema setup uses the existing setup machinery:

```sh
node tests/server/make-signing-key.mjs
npx supabase start
node tests/server/write-stack-info.mjs
npm run test:server:node
npm run test:server:workerd
npx supabase stop --no-backup
```

Use unique project ID/config, save/reinstate committed Auth settings, record actual
ports and schema install/reapply receipts, never log private service/signing keys.
No hosted schema application/deployment. Full independent check repeats V1–V8 on
clean candidate, then V9–V13. Exact-candidate server-only results may satisfy V11
without automatically repeating both suites if no server/SQL/room/shared-package
change intervened; name source SHA and reused logs. Any reachable fix reruns both.
After fix rounds clean install/typecheck/builds/full unit always; rerun failed/unrun
checks, new scenario for web changes and regressions reached by changed paths.
Do not repeat a successful baseline negative control without a new reason.

Tooling-root scenario invocation, authored by the independent check run:

```sh
node tools/browser-compare/0007-w1-check.mjs <served-on-origin> <Z1-output> <local-stack-private-json>
node tools/browser-compare/0007-w1-check.mjs <baseline-on-origin> <Z1-base-output> <baseline-stack-private-json> --negative
node tools/browser-compare/0007-w1-check.mjs <served-off-origin> <Z1-off-output> <local-stack-private-json> --off
```

| Check | Pass condition |
| --- | --- |
| V1 | All manifests/locks/inventory/runtime notices byte-identical to prerequisite base; zero new dependency. |
| V2 | npm ci --ignore-scripts --no-audit --no-fund exits0 on clean candidate and independent baseline. |
| V3 | npm run typecheck exits0 for all five workspace members. |
| V4 | Accepted full npm test exits0; workshop-timer units prove clock/input/edges/wire validation/order/cleanup and unchanged content. Module guards enforce40 team/22 state hooks/App.tsx unchanged. Removal units and existing assertions remain, with only named fixture/outage amendments. |
| V5 | Off build/audit exit0; index.html and THIRD_PARTY_NOTICES.txt byte-identical to base off; build meta has no team/Supabase inputs or timer modules. |
| V6 | Fixtures/on build/audit exit0; index.html equals independent base on; notices equal runtime notices v3. |
| V7 | Server build/Worker dry run/license audit exit0 without deployment. |
| V8 | Inspect full git diff --name-status <base>..<validated> and every hunk: only deliverables1–4 plus append-only Implementation record in this brief. Earlier fix-round record commits inside this range are allowed; they do not fail scope validation. No requirement/contract/index edits. Keep actual prerequisite base, do not move it forward to hide changes. Record validated source/test SHA separately from later record-inclusive tip. git diff --check exits0. |
| V9 | Z1-S1–S29/Z1-S31–S36 team on (35), Z1-S30 team off (1) pass,22 real state screenshots/value receipts including omitted attribution; both-runner S225–S256 evidence. |
| V10 | Once on independent baseline42ad608 source/build/stack, new timer unit/server/browser capability assertions fail by name. Existing boundary-only/local/off subassertions may pass. Missing import/setup failure is reported distinctly, never substituted for a product negative control. Do not run candidate-schema artifacts on base. |
| V11 | Accepted full suites: Node S1–S50,S55–S256; workerd S1–S36,S38–S42,S44–S50,S55–S69,S71–S167,S169–S256. S37/S43/S70/S168 Node-only; S225–S256 common checks required both, S252 physical subcase Node-only. Fail0, no skips relabelled passes; retain all older functional assertions except explicit shared-path dispositions. Reuse exact-source server-only proof where permitted above. |
| V12 | Accepted A–J team-off compare: two baseline runs then candidate, only existing saved-time normalization, no new masks or altered controls/focus/local save/canvas. |
| V13 | Accepted0004-W2 recovery/presence tool (all its existing rows, including real token-expiry waits) and0006-W4 T1-S1–S29/T1-S31–S61 on, T1-S30 off. Removal tests/removal.test.mjs and server S77–S93 included in full suites. Amend only named right-bar controls/Tab positions, preserve functional assertions. Classify failures against current baseline source/tests; known T1-S38/S39 geometry/typography conflict and intermittent Node S181 are caveats to investigate, never waivers for new failures. |

Only these regressions are accepted: full unit, both full server suites, A–J off,
0004-W2 recovery/presence,0003-W2 removal inside those suites,0006-W4 T1 with off
sentinel. No additional historical scenario or fixture sweep. Safari's three
milestone spot checks are selected at review, not predetermined here. Public
boundary hooks remain mandatory. Source validation is not independent acceptance.

## Exclusions and reasons

- Local-board and team-off timers; no server authority in those modes.
- Sound, music, voting, presets, facilitator role/starter ownership or new permissions UI.
- Timer state in document/Undo/history/files/logical backup or a second authority.
- Offline queued controls, automatic mutation replay, new HTTP route/dependency/font.
- Full prototype, hosted schema application/deployment, external messaging/agent dispatch.
- Extra browser matrix, load/performance/native-input/screen-reader campaigns.

## Implementation record

(Appended by the implementer.)


### Implementation candidate — 2026-11-08

Branch: `codex/0007-W1-run-a-shared-workshop-timer`.
Actual prerequisite base: `20365d38a1255ab06ec7cc18f1e618494b67f7ae`.
Validated source/test revision: `717efbfca5cbb31d465c47ad2f76946240795de4`.
This record is a separate commit; its final tip is reported in the handoff.
Source validation is not independent acceptance. The candidate has the unresolved
Workers time-recovery entry-path issue below.

Node 26.13.0 / npm 11.20.0 were used for final validation. An initial install under
the shell's older toolchain emitted engine warnings; the install was repeated with
the contracted toolchain. Baseline web builds used an independent source export
of the prerequisite revision and its own clean dependency installation.

| Gate | Command / inspection | Result |
| --- | --- | --- |
| V1 | Byte-compare every manifest, lock, dependency inventory and runtime notice to the prerequisite base | PASS: 20 files unchanged; zero added dependency. |
| V2 | `npm ci --ignore-scripts --no-audit --no-fund` in candidate and independent baseline | PASS, exit 0 for both contracted-toolchain installs. |
| V3 | `npm run typecheck` | PASS, exit 0 for all five workspace members. |
| V4 | `npm test` | PASS: 957 tests, fail/cancel/skip 0; 30 named workshop-timer units. Guards retain 40 team modules, 22 state hooks and byte-identical App.tsx. |
| V5 | `BOARD_TEAM_FEATURES=off BOARD_SUPABASE_URL=http://127.0.0.1:55321 BOARD_SUPABASE_ANON_KEY=synthetic BOARD_SERVER_URL=http://127.0.0.1:8796 npm run build`; `npm run audit:licenses` | PASS, exit 0; HTML/notices byte-identical to independent off baseline; off metafile excludes team/Supabase/timer inputs. |
| V6 | `npm run build:fixtures`; same build environment as V5 with `BOARD_TEAM_FEATURES=on`; `npm run audit:licenses` | PASS, exit 0; on HTML byte-identical to independent on baseline; notices equal runtime notices v3. Off output was preserved before rebuilding on. |
| V7 | `npm run build:server`; `npm run audit:licenses`; `WRANGLER_SEND_METRICS=false npx wrangler deploy --dry-run --outdir <scratch> -c apps/server/wrangler.json` | PASS, exit 0; no deployment. |
| V8 | Inspect every staged hunk and `git diff --name-status 20365d3..717efbf`; `git diff --check` / staged check | PASS: 40 source/test/configuration/documentation files in the implementation allowlist; this record adds only the brief's append-only record. No requirement, contract, index, App.tsx, dependency or service-schema edit. Mandatory public-boundary hooks passed normally. |

Additional focused checks: timer units were run during development; the new server
file bundled with esbuild. A temporary TypeScript check of the new server cases,
Node bootstrap and Node driver passed. An additional cross-runner test-driver
static check reported TS2589 in the existing workerd inventory helper and TS18046
in its existing roomSQL helper; the independent prerequisite source reports the
same errors. These are outside the workspace typecheck and do not count as server
execution. Graph discovery/indexing tools were unavailable under the approval
policy, so code discovery fell back to file reads. Git reported a sandbox
permission warning for packed-refs housekeeping after the successful source
commit; the branch commit exists and hooks were not bypassed.

Measured by the Node SQLite unit fixture, encoded UTF-8 bytes including keys:
maximal legal timer row 251; maximal complete timer_result 347, timer_state 295,
timer_sample 330, timer_refused 366; explicit marker/reservation rows 45/63;
maximal encoded timerTimes/timerReadTimes attachment windows 101/105. These are
unit measurements, not measurements from both running server adapters. S254 is
registered to record actual runner rows and maximal exact frame serialization.

The read-2 corrections have focused unit proof: the real stopped-volume script
writes the distinct marker and preserves a reservation on repeated marking;
accepted-history-intent restart preserves the live timer, whereas marked recovery
resets before resume, retains denial/reservation through failure and resets once.
Committed actor-free causes drive speech, with generation/version deduplication,
silent snapshots/reset, delayed End classified as stopped, and reconnect suppression.
The byline and its gap are absent; Paused/Timer finished status remains. Browser
geometry, focus, motion and two-context clock tolerance still require independent
runtime evidence.

Unresolved contract/file-list conflict: production Workers provider point-in-time
recovery rewinds both SQL and KV, including a marker written only in that room.
It needs an independently retained recovery signal, stamped into the recovered
room before load/history-intent resume. The existing independent RestoreFence is
in `apps/server/src/worker.ts`, outside this brief's implementation allowlist.
That file is unchanged; no alternative recovery store was introduced. The allowed
common marker path and Node marking are implemented, but the provider entry path
must be settled before acceptance. The workerd S252 common marked-load control
is explicitly not a hosted provider-recovery claim.

Handoff: a fresh full-access server-only run must clean-install this candidate,
install and reapply the local schema, then run `npm run test:server:node` followed
by `npm run test:server:workerd`, with no browsers. Return failures to this session
before check1. S225–S256 are registered (32 common cases, physical S252 subcase
Node-only); neither full suite was run here. Browsers, Supabase CLI/schema setup,
V9–V13, the independent scenario/baseline negative and accepted browser regressions
are unrun. The fresh independent check authors `0007-w1-check.mjs`. T1-S38/S39 and
Node S181 remain caveats requiring source/test comparison, not waivers. No private
artifact, tracker, mirror, main branch, push or merge was changed. No next milestone
is authorized. Added dependencies: none.

### Fix round 1 — 2026-11-08

Maintainer ruling: **“Allow worker.ts”** (2026-11-08), solely for the Workers
point-in-time recovery guard. This resolves the entry-path/file-list conflict
reported above. Branch: `codex/0007-W1-run-a-shared-workshop-timer`.
Validated source/test revision: `a08c2f7305d6be20b164809e32be0d574dee7d77`;
the record-inclusive tip is reported separately in the handoff.

The existing independent RestoreFence atomically retains the recovery generation
before provider scheduling. A reconstructed room checks it before load/history
resume, stamps the distinct marker, and uses the existing floor reservation,
reset-once retry and strict-replay denial. Ordinary fence raises do not mark
recovery; an acknowledged retained signal does not reset a later live timer.
No new store, namespace, dependency or client surface was introduced.

V1–V8 were repeated with Node 26.13.0/npm 11.20.0: clean candidate and independent
baseline `npm ci --ignore-scripts --no-audit --no-fund`; `npm run typecheck`;
`npm test` (**962 pass**, fail/cancel/skip 0); off build/audit, fixtures/on
build/audit, server build/audit and Worker dry run using the command set above
all exited 0. The 20 dependency files, off HTML/notices and on HTML comparisons
pass; on notices equal v3, off inputs exclude team/Supabase/timer, App.tsx is
unchanged. Full prerequisite-range scope and whitespace checks pass with the
single ruled file exception. Eight files changed in this source commit, plus
this separate append-only record; mandatory privacy hooks passed normally.

W1-U31–U35 add independent fence rollback/bounds, running/paused accepted intents,
post-reservation failure/retry, ordinary preservation and time-entry ordering
proof (35 focused timer units pass). S252 adds an independent-signal/actual
workerd-eviction simulation with both timer states and timer writes blocked
through retry; all original assertions remain. The new server test bundles and
its focused TypeScript check pass; server cases were not executed here.

The supplied REC-046 results at `b8bcb50` were Node 252/0/0 and workerd 248 pass,
0 fail, 2 declared skips (S70/S168), with S225–S256 passing on both. This reachable
server change requires fresh Node-then-workerd proof on the new revision before
check1. Supabase/schema setup, both server suites, browsers and V9–V13 remain
unrun in this sandbox; simulated recovery is not hosted provider PITR evidence.
No push, merge, main/private-artifact edit or further milestone was performed.
