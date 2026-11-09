BRIEF VERSION: 0007-W2 v1 (2026-11-09)
# 0007-W2 — Vote and reveal workshop results

Status: Draft. Implementation has not started under this brief.

Contracts (fourteen new files; never edit prior versions):
[voting v1](../architecture/0007-workshop-voting-v1.md),
[timer v2](../architecture/0007-workshop-timer-v2.md),
[presence v2](../architecture/0004-presence-v2.md),
[sync v11](../architecture/0003-sync-v11.md),
[access v10](../architecture/0003-access-v10.md),
[API v10](../architecture/0003-api-v10.md),
[hosted persistence v10](../architecture/0003-hosted-persistence-v10.md),
[self-host runner v6](../architecture/0003-self-host-runner-v6.md),
[hosted storage v10](../architecture/0003-hosted-storage-v10.md),
[lifecycle v4](../architecture/0006-board-lifecycle-v4.md),
[board file v4](../architecture/0006-board-file-v4.md),
[document v15](../architecture/0001-document-v15.md),
[interaction v36](../architecture/0001-interaction-v36.md),
[web modules v34](../architecture/0001-web-modules-v34.md).
Unchanged: [identity v4](../architecture/0003-identity-v4.md),
[comments v4](../architecture/0005-comments-v4.md),
[local storage v3](../architecture/0001-storage-v3.md),
[toolchain v5](../architecture/0001-toolchain-v5.md),
[lock v5](../architecture/0001-dependency-lock-v5.json),
[inventory v5](../architecture/0001-dependency-inventory-v5.json),
[runtime notices v3](../architecture/0001-runtime-notices-v3.txt).
Use this set wherever inherited contracts link a replaced version. Current
document10/fileVersion2/room layout7/backup envelope1. All checks concern the
current application/protocol/formats. No dependency is added.

## Outcome and read first

An effective owner/editor asks one question and gives each voter a bounded
budget. Voters toggle one removable own-colour dot per eligible object. Until
confirmed End and reveal, server projections expose only the recipient's own
ballot; anonymous totals then remain in the panel and on surviving objects until
confirmed Clear results. Viewers read the session/results but cannot vote or
control it. The shared Timer and voting panel keeps the independent timer.
Workshop state never becomes document/history/file content.

Read [AGENTS.md](../../AGENTS.md), [CONTRIBUTING.md](../../CONTRIBUTING.md),
[DESIGN.md](../../DESIGN.md) and all fourteen contracts. Voting v1 is the complete
state/wire/storage/privacy/lifecycle and concrete design contract; companions
define integration. Report conflicts before dependent implementation. Build
directly; no prototype or prebuilt scenario tool is an input. Prove the stated
values in focused implementation tests and the independent check run.

## Deliverables and boundaries

Planning source baseline: main **752f79d3eb3c41f981673a1e512b581b9c72c919**.
Implementation uses a fresh milestone branch/worktree from committed main
containing this packet; record the actual prerequisite base. New source files
carry SPDX-License-Identifier: Apache-2.0. Only the following files may change,
solely for this voting work and the explicit shared-path dispositions below.

1. **Dedicated room/transport:** new `packages/board-room/src/voting.ts` and
   `packages/board-sync/src/voting.ts`; existing board-room src `room.ts`,
   `protocol.ts`, `interfaces.ts`, `storage.ts`, `backups.ts`, `access.ts`,
   `presence.ts`, `lifecycle.ts`, `history.ts`, `timer.ts`; existing
   `packages/board-sync/src/session.ts`. One ordered state machine, exact strict
   wire validators, recipient projections, bounded private storage, access/target
   pruning and recovery. Keep votes outside document edit/receipt/waiting queues.
   Timer changes only integrate shared reset, never its state machine/clock rights.
2. **Every runner recovery/admission path:** existing `apps/server/src/worker.ts`,
   `worker-room.ts`, `worker-runtime.ts`, `start-node.ts`, `node-storage.ts`,
   `runtime.ts`, `app.ts`, `lifecycle.ts`, `delivery.ts`; existing
   `apps/server/src/routes/operator.ts`, `access.ts`, `boards.ts`, `history.ts`,
   `lifecycle.ts`; existing `apps/server/scripts/mark-restored-volume.mjs` and
   `apps/server/README.md`. Allow only voting admission/reconciliation/storage/
   reset/discard/reconstruction wiring and corresponding documentation. In
   particular worker.ts's independent RestoreFence/time-recovery signal and
   BoardRoom pre-load path, worker-room restore-to-time/reconstruction, Node
   start-node recoveryGeneration/roomEntry/removeRoom and the real marking script
   are included. Do not stop at WorkshopTimer.recover or miss a history shortcut.
   No voting HTTP route, Supabase schema/function/table, deployment or permissions
   expansion; service-table count remains16. Do not edit service SQL.
3. **Dedicated web parts:** exactly five new files `apps/web/src/team/voting.ts`,
   `voting-rules.ts`, `voting-card.tsx`, `voting-overlay.tsx`, `workshop-panel.tsx`.
   Existing team `team-app.tsx`, `hosted-board.ts`, `timer.ts`, `timer-rules.ts`,
   `timer-panel.tsx`, `presence.ts`, `presence-layer.tsx`, `people.tsx`, `history.ts`,
   `history-panel.tsx`, `share-dialog.tsx`, `comments/panel.tsx`, `comments/layer.tsx`;
   existing `apps/web/src/ui/save-area.tsx`, `ui/context-bar.tsx`, `App.tsx`,
   `state/use-canvas-input.ts`, `state/use-page-keys.ts`, `state/use-object-layouts.ts`,
   `state/use-selection.ts`, `state/use-presence.ts`, `scene/board-drawing.tsx`,
   `scene/overlays.tsx`, `selection.ts`, `geometry.ts`, `text-runs.ts`, and
   `apps/web/style.css`. Own state/rules live in voting modules, never App.tsx or
   document-edit hooks. Input/layout seams delegate and expose actual displayed
   first-line geometry; App.tsx is composition-only/≤264 lines. Keep exactly22
   state hooks/45 team modules and existing import exceptions. Recompose the
   panel without duplicating timer controller/drafts/clock/focus ownership.
4. **Type eligibility:** existing `packages/board-rules/src/objects/registry.ts`,
   `sticky.ts`, `shape.ts`, `text.ts`, `image.ts`, `connector.ts`, `stroke.ts`,
   `section.ts`, solely for registry-owned voting eligibility. No new object/tool
   or saved fields. Include image's eligibility while preserving hosted image
   creation/import refusal. Current document validators need no voting field.
5. **Focused tests and controls:** new `tests/workshop-voting.test.mjs` and
   `tests/server/voting.test.ts`; existing `tests/modules.test.mjs`,
   `workshop-timer.test.mjs`, `room.test.mjs`, `removal.test.mjs`, `presence.test.mjs`,
   `comments.test.mjs`, `mentions.test.mjs`, `board-history.test.mjs`,
   `board-lifecycle.test.mjs`, `team-import.test.mjs`, `shared-editing.test.mjs`,
   `recovery.test.mjs`, `grouped-edits.test.mjs` (all under tests). Existing server
   `suite.test.ts`, `shared.test.ts`, `removal.test.ts`, `lists.test.ts`,
   `mentions.test.ts`, `history.test.ts`, `lifecycle.test.ts`, `timer.test.ts`,
   `setup.ts`, `node-test.ts`, `worker-test.ts`, `driver-node.ts`, `driver-workerd.ts`
   (all under tests/server). Amend only layout7/joined fixtures, module/table
   inventories, explicitly listed shared-path expectations, and deterministic
   clock/queue/authority/storage/frame/eviction/hibernation/restart/recovery
   controls needed for S257–S304. Preserve original functional assertions.
   Root `vitest.node.config.ts` and `vitest.workerd.config.ts` add only the new
   server-file include; `tests/README.md` records ranges/dispositions/limits.
   Dynamically import new capabilities within named tests so baseline absence
   fails by check name, not a top-level import abort.
6. **Record:** append only this brief's Implementation record, including later
   fix-round record commits. Contracts/requirements/indexes are prerequisites,
   not implementation edits. Separate validated source/test SHA from record tip.

Outside the named new controls, the existing screens' markup stays exactly as at
the base. Preserve file/name/selection/context/handles, people/save status/Share,
local/off canvas and editing. The named shared panel/title/keyboard/overlay changes
are the complete UI exception. No manifest/lock/inventory/notices/dependency/build
script edits, extra hooks, imports, services or generic stamp infrastructure.
Only the two server-test includes change configuration. Report a required file
outside this allowlist before expanding. No source or application is changed by
preparing this brief. The existing W1 evidence summary is not an implementation
deliverable and must remain untouched.

## Required behavior and concrete design

Implement voting v1 in full, especially:

- Effective owner/editor controls; viewer sees No voting session. or Voting in
  progress. Only owners and editors can vote. and later results. Granted guests
  follow effective role; no starter privilege. Hosted solo allowed; local/off
  absent. Question1–240 valid trimmed code points; budget1–20/default3/step1;
  fixed whole-board eligible identity/order snapshot≤250/no empty Start.
- Click/Enter toggle one eligible topmost target/member, one account budget
  across tabs, no stacking; remove refunds even when budget spent. Pan/zoom/
  Space-drag/native fields/IME remain native. Outside local mode editing continues.
- Split session/private versions, one room queue including awaited authority,
  no private public-version increments, no mutation retry/replay. One pending
  mutation/Checking vote…,2,000ms readback/15,000ms reads/30,000ms freshness;
  labelled last-confirmed uncertainty and no optimistic dot. Exact refusals and
  separate five-attempt rolling1,000ms budgets follow voting v1.
- No other ballot/count/participation/version in any recipient frame before
  reveal. Join, reply, refusal, broadcast and reconstructed sockets all project
  server-side. Redact cursor=null/selection=[]/view={x:0,y:0,width:1,height:1};
  discard old spatial presence/stop and disable Follow, keep avatars/preference.
- Confirm End and reveal atomically reconciles/freezes anonymous totals and
  deletes private rows; Cancel sends nothing. Sort count descending/start order/
  UUID, include zero; current labels, Removed object fallback, missing has no
  navigation/badge. Post-reveal access/content changes do not recompute totals.
  Confirm Clear results before another Start. Only latest results, no results log.
- Persist last-leave, late join, ordinary Node restart and DO eviction/hibernation.
  Prune/refund disconnected people's lost voting rights and deleted generations;
  never revive via Undo/history. Preview disables input/overlays; live history
  restore preserves/reconciles. Trash/discard/purge/explicit logical/marked/time
  recovery clear behind fences; preserve accepted history intent/denial on failure.
- Layout7 singleton≤65,536/ballot≤4,096/50 identities/aggregate≤270,336 encoded
  bytes; command/read≤4,096/response≤65,536. Measure escaped SQL rows/maximal
  legal frames/full attachments≤16,384. Every new row<131,072 and below inherited
 2 MB ceiling; no new journal or raised journal/chunk/document/backup limit.
- Shared Timer and voting240-wide panel/right12/top actual bar bottom+12;
  Timer then Voting/Results,214 derived inner width, no extra card padding;
  original timer fields79×68/48px and33px circles in40px hits remain. One Close
  Timer and voting last in traversal. No attribution/reserved byline. Natural
  combined height; fixed palette/spacing/focus from voting v1. Timer expiry
  never reveals voting. Toolbar98×40 idle/62×40 active, no visual voting cue;
  exact accessible name prefix Timer and voting plus Voting in progress suffix
  while running. Browser title remains exclusively timer-driven.
- Button assignments follow voting v1's family table: primary New vote, Start
  voting, Vote and the End and reveal/Clear results **confirmation** buttons,
  with #7051cf fill/border-color and white text, hover #6142be. Cancel, Enter/Done
  voting, Remove vote, stepper and reveal/clear **openers** are neutral white/
  #29272e/#e8e7ed border, hover #f1eff5. Shared Close rests transparent/zero border;
  result-row label buttons also rest transparent/zero border. Both hover #f1eff5.
  Every family has3px #7051cf focus-visible outline/offset3; momentary press adds
  no latched palette/animation/transform or aria-pressed. Disabled .45 retains
  its family's base fill/border without hover. Named shared CSS inheritance and
  timer-specific exceptions are explicit in voting v1; generic hover must not
  override primary hover. No geometry change from focus/border state.
- Strip Voting · N of B votes remaining · Done voting derives top from actual
  context/bars. Dots12px/white2px; badges purple/min24px/white12px tabular.
  Corner badge right=object.right−8/top=object.top+8. Text dot left=line.right+6,
  badge left=line.right+8, vertically centred on first displayed line and clamped
  to object.right−8−marker.width; empty text uses corner rule. Recompute at every
  pan/zoom from actual rendered runs. Derived rectangles±0.5px/wrapped heights±1px;
  never apply generic paragraph rules against a specifically styled element.
- Native selector Eligible object, Your vote, Vote/Remove vote; exact setup/
  confirmation/result/health words and focus table in voting v1. Separate polite
  atomic region, own/start/reveal/clear/refusal/loss/recovery only; reconnect says
  Voting reconnected without replay. No remote-vote/per-row/tick speech.

## Shared-path check dispositions

Retain all older functional assertions. Only current layout6→7, joined's exact
voting member, complete store inventories and the explicitly named expectations
below change. No strict-key relaxation or blanket failure waiver. This is an
inventory/disposition, not authorization for extra historical scenarios.

| Shared path | Older checks and exact disposition |
| --- | --- |
| Room dispatch and response parsing | Server S17–S21,S30,S34,S36,S38,S102–S120,S122–S132,S143–S167 and S225–S256; room/shared-editing/recovery/grouped-edits/comments/mentions/presence/workshop-timer unit callers. Retain renew/edit/comment/timer keys, roles, bytes, receipts/waiting, ordering and retries. Insert separate voting kinds before edit fallback; only joined fixtures gain voting. Private ballot replies never become document receipts/refusals. Timer wire/cause/clock stays. |
| Socket admission and current access | S9,S16,S24–S30,S40–S50,S77–S101,S186–S187,S197,S218,S224,S241–S245; removal/presence/room/board-history/lifecycle units; W2-S1–W2-S21, Z1-S24/Z1-S33. Keep strict socket503 on replay outage already landed in W1; no wider cached-route gate. S40 retains lifecycle-outage refusals after wake, then restores lifecycle+replay, freshly joins owner/editor/viewer (Node restart invalidates old sockets), disables replay again for cached existing-socket edits/viewer refusal, asserts fresh join503, and restores replay before later joins. S41–S43/S70–S71 retain intended room_locked observations before replay recovery. Voting-specific downgrade/private pruning is new proof, not weakened removal/ticket checks. |
| Presence relay/reconstructed attachments | S94–S101 and every tests/presence.test.mjs bound/expiry/colour case; accepted W2 presence/follow rows, Z1 health rows. Their non-voting fixtures retain exact cursor/selection/view and10-message/12,288-byte/250-selection/30s-expiry behavior. Add running-only redaction to new checks, including stale attachment reconstruction, while retaining stamped avatars/heartbeat and full16,384-byte attachment ceiling. Do not globally blank ordinary presence or weaken Follow outside a running round. |
| Backup restore validation and recovery | S41–S44,S47,S68–S71,S88–S89,S116,S121,S127,S133–S134,S139,S158–S160,S168–S169,S189–S194,S210,S213–S220,S224,S247–S253,S256; board-history/lifecycle/import/mentions/removal/timer units. Valid envelopes use layout7 and exclude all workshop tables; injected voting must fail before fences/writes. Retain every malformed discussion/mention/history/fingerprint/chunk/journal/body/auth/denial assertion. Actual store inventories S160/S192 and discard S210/S213 add both voting tables, not backup rows. Explicit marker/reservation now reset both records; ordinary pending-history restart preserves both. S37/S43/S70/S168 physical exclusions stay. |
| Shared panel Tab order/title | Z1-S1–Z1-S29/Z1-S31–Z1-S36, especially S5–S22/S27–S29; T1-S1/S23/S27/S28/S31–S61; W2 right-bar/focus checks. Replace dialog Timer→Timer and voting and Close timer→Close Timer and voting, exact trigger prefix from voting v1; add Timer subheading and voting idle New vote before shared Close for owner/editor. Viewer has no idle voting control. Preserve timer opening focus and enabled order before voting controls, then shared Close→Share. Recalculate natural panel/card/field positions including Timer label; never assert standalone panel total height. Right bar's existing avatar/overflow/chevron stops and trigger stop4/Share5 in two-person fixture stay. From chevron Tab once trigger, twice Share. Home/details/modal/palette arrays do not gain workshop entries. Functional timer/Share/focus/reconnect assertions stay. |
| Canvas input/local behavior | A–J off; selection/grouped-edits/shared-editing/recovery units, existing page-key/gesture assertions, W2 pending-edit/follow rows, T1 canvas/focus rows, Z1-S15/Z1-S28/Z1-S35. Ordinary editing outside local voting mode and all local/off behavior stay. Only explicit local mode routes click/Enter through voting rules; preserve native fields/IME/modifiers/Space-drag, ignore repeats/drags and ineligible topmost hits. No grouped/multiple ballot and no deletion/Undo from vote input. |
| Timer speech selectors/observers | Z1-S29 and its --end-reconnect path: authorize replacing unscoped polite/.sr-only lookups with `.sr-only[data-workshop-status="timer"][role="status"][aria-live="polite"][aria-atomic="true"]`, including the shared page speech collector, __speech, __liveMutations observers and reconnect polling/text helpers. Assert one timer node, not one global polite node. Preserve every existing start/pause/resume/extend/End/expiry/cause, delayed-End, duplicate/no-premature-finish, actor/tick, reconnect/no-replay and motion assertion; no dropped/filtered timer messages or weaker expected counts. Voting has its own data-workshop-status="voting" node checked separately in Y1-S39; neither channel may contaminate or satisfy the other. |

Caller/fixture inventory completing those paths:

| Existing caller | Disposition |
| --- | --- |
| tests/server/suite.test.ts S1–S50; lists.test.ts S55–S76 | Directory/auth/RLS/list/rename/import remains; only layout/joined fixtures and named S40/outage/backup phases above. S51–S54 Docker cases remain outside accepted runs. |
| tests/server/removal.test.ts S77–S93 | Preserve epoch/revocation/held lookup/waiting/restart/fence/receipt assertions. Offline-voter pruning is S278, not a replacement. |
| tests/server/shared.test.ts S94–S142 | Retain capacity/ticket order/presence/edit/comment/import. S121 current layout7 at every reopen; S133 malformed-backup assertions retained; S134 imported layout7. |
| tests/server/mentions.test.ts S143–S168 | Preserve roster/ranges/author-loss/notification/RLS/retry/bounds. S159 layout7 rollback/no-fence checks, S160 actual rows, S168 Node-only marker proof stay. No service-table-count change. |
| tests/server/history.test.ts S169–S194 | Current layout7 at initialization, unchanged capture/restore/receipt/journal/50-version/fingerprint semantics; S192 actual voting row measurement/exclusion. |
| tests/server/lifecycle.test.ts S195–S224 | Unchanged authority/retention/deleted-register/phase/retry/fence assertions, current layout7/table inventory only; voting reset additions in new range. |
| tests/server/timer.test.ts S225–S256 | Preserve timer roles/order/clock/cause/limits/recovery proofs; only current layout/joined/inventory changes and additional shared reset assertions. |
| tests/room.test.mjs, removal.test.mjs, presence.test.mjs | Every original assertion retained; current layout/joined fixtures and complete attachment/store inventories only. |
| tests/comments.test.mjs, mentions.test.mjs, team-import.test.mjs | Exact current joined/layout7; mentions M-U05 supported7/unsupported8, uncreated0 unchanged. Retain all malformed/restoration rollback/compensation assertions; no voting in their command fixtures. |
| tests/shared-editing.test.mjs, recovery.test.mjs, grouped-edits.test.mjs | Synthetic joined adds exact idle voting projection; preserve edit bytes/counts,10s deadlines, retries/recovery/Undo and group semantics. |
| tests/board-history.test.mjs, board-lifecycle.test.mjs, workshop-timer.test.mjs | Current layout/joined and both-record cleanup; preserve existing preview/modal controls, timer controller/clock tests and pending-intent failure boundaries. |
| tests/modules.test.mjs | Exactly40→45 team names and modules version33→34,22 state hooks, App≤264/composition-only and existing import/license/package/driver guards retained. Remove only the obsolete assertion that `apps/web/src/App.tsx` is byte-identical to `20365d3:apps/web/src/App.tsx` (the permitted voting composition wiring changes it); the line budget and composition-only guards in the same test stay. |
| Other unit files; accepted browser tools | Unreached assertions unchanged. T1/W2 edits only named controls/titles/Tab/derived geometry above. Z1 additionally permits the timer-only speech selector/observer changes explicitly listed above, preserving every functional assertion. A–J off only existing saved-time normalization. No unrelated harness/H1 run commissioned. |

For Z1's existing enabled-control arrays, substitute the following exact names;
these are expectation updates, not new timer behavior. Each row continues to
Share, reverses with Shift+Tab, and skips controls disabled by the actual state.
Z1's timer speech selector/observer exception is separately authorized above;
it applies to the shared collector and --end-reconnect path as well as S29.
W2/T1 right-bar arrays keep their existing slots, replacing only the trigger's
prefix/Close/dialog names. Do not add a workshop entry to unrelated arrays.

| Existing Z1 panel state | Full owner/editor enabled traversal after composition |
| --- | --- |
| Idle valid | Minutes→Seconds→+ 1 min→Start timer→New vote→Close Timer and voting→Share |
| Invalid00:00 | Minutes→Seconds→+ 1 min→New vote→Close Timer and voting→Share |
| Running/paused | + 1 min→End timer→Pause timer or Resume timer→New vote→Close Timer and voting→Share |
| At cap | End timer→Pause timer or Resume timer→New vote→Close Timer and voting→Share |
| Zero | End timer→New vote→Close Timer and voting→Share |
| Timer confirmation | Cancel→Stop timer→New vote→Close Timer and voting→Share |
| Timer unavailable, voting independently ready/idle | New vote→Close Timer and voting→Share; unavailable timer controls stay skipped |
| Viewer in those states | Same timer sequence with New vote omitted; then Close Timer and voting→Share |

The New vote stop above assumes the Z1 fixture's idle voting card. When a new
voting fixture is deliberately running, use voting v1's running traversal after
timer controls instead. If both controllers are unavailable, only shared Close
and Share are enabled. Opening timer focus is unchanged in all these cases.

## Server checks

W1 ends atS256. New **S257–S304** are48 common checks in
tests/server/voting.test.ts on **both** Node and workerd. Print a named PASS/FAIL
for each and SUMMARY-VOTING. Use actual SQL/recipient raw frames/current authority,
deterministic clock/queue/storage holds, not screenshots. Reapply process-local
test controls after Node restart. S295's real physical volume subcase is Node-only;
its common explicit-recovery guard still runs on both. Existing Node-only
S37/S43/S70/S168 exclusions stay; no missing capability relabelled PASS.

| ID | Required proof |
| --- | --- |
| S257 | Owner/editor and granted editor guest start/cast/remove/non-starter reveal/clear. Viewer/granted viewer guest read metadata/results but cannot mutate; viewer document editing still refused. Ungranted/removed/disabled/outsider get no projection. |
| S258 | Trimmed valid Unicode prompt1/240 code points accepted,0/241/lone surrogate/whitespace rejected; budget1/20 accepted,0/21/fraction/string refused. Defaults3; exact vote_bounds/bad-message distinction; no partial state. |
| S259 | Snapshot all eligible sticky/shape/text/image identities/order≤250, no connector/stroke/section/group/comment target, no empty Start. New/duplicate/different generation cannot enter; hosted images still refused. |
| S260 | One target/person, spend one, repeated vote refused, own unvote/refund once; exhausted budget refuses new casts but permits remove. No other-person field accepted. |
| S261 | Same verified person/two tabs sharing ballotVersion race last budget unit on different objects in both orders: one winner, stale loser/no double-spend; all same-account admitted tabs see identical own budget/version. |
| S262 | Different people cast at same sessionVersion, both succeed independently; no unrelated own-version conflict, public sessionVersion unchanged. |
| S263 | Simultaneous Starts/current idle version in both orders produce one UUID/row and stale loser. New Start refused running/revealed until clear. |
| S264 | Hold an awaited authority lookup on earlier command; later command cannot overtake. Recheck rights/versions after await and before write/send. |
| S265 | Reveal/clear/new Start versus delayed old identity/sessionVersion/transport generation cannot target replacement; safe version overflow refuses without wrapping. |
| S266 | Own stale version/duplicate delivery/unvote race, including empty row after prune/reauthorization, cannot remove twice or revive votes. No mutation auto-retry or durable vote receipt. |
| S267 | Strict action-specific keys and UUID/integer types, forged role/person/colour/totals/client version fields, read mutation keys and unknown kind: exact voting/outer refusals, no edit-path response. |
| S268 | Command/read4096 exact/4097 including whitespace; outer1,048,576 bound first; correct reason/no partial write/no protected fields to denied caller. |
| S269 | Separate mutation/read5-attempt windows(t−1000,t], invalid recognized attempts count;6th refused, exact boundary expires, no unbounded timestamps or presence/token renewal. |
| S270 | Sequentially reserve50 identities despite departures;51st gets own limited state/refusal and can reveal, no numerical occupancy/other ballot exposed. Empty/revoked rows keep slots until reveal/clear; row count bounded. |
| S271 | Maximal legal SQL encodings on each runner: session≤65536, each ballot≤4096/50 rows/aggregate≤270336; escaped JSON TEXT included. New rows<131072/below2 MB; no new journal, inherited limits unchanged. |
| S272 | Maximal vote replies/refusals/publications≤65536; joined voting member measured separately with inherited document envelope bounds retained. Complete attachment≤16384/all four workshop rate budgets included; reject overflow atomically. |
| S273 | Raw frames to owner/starter, editor/non-starter and viewer during another person's casts expose no other targets/colour/private version/count/participation/event; public metadata/version unchanged and no vote broadcast to unrelated accounts. |
| S274 | Repeat projection whitelist/privacy for success, stale/version/budget/cap/refusal and vote_read, including forged fields. Unauthorized/unavailable response has no cached projection. No edit receipt/presence/log side channel containing ballots. |
| S275 | Join/reload/reconnect/late viewer/editor and reconstructed sockets get only their own authorized projection; same-person second tab shares ballot. No raw SQL person IDs/other rows serialized. |
| S276 | Running transition drops old spatial presence; modified full presence and reconstructed attachments relay null/[]/placeholder only, avatars/heartbeat/expiry stay. After reveal/reset only fresh presence returns, no hidden replay. |
| S277 | Per-command/read/per-recipient publication admission: token expiry4401, effective role/epoch4403/4409, generation4423, active lifecycle/deleted marker; held stale sends cannot disclose state. |
| S278 | Remove/disable/downgrade a voter with no open socket through access replay/delivery: permanently prune/refund and private version+1; restored editor rights start empty, post-reveal totals frozen. Tab close/token expiry alone retains ballot. |
| S279 | Required role/replay/lifecycle/storage source failure withholds vote read/mutation/reveal/publication and no cached success; restore sources and fresh rejoin, no implicit mutation replay. |
| S280 | Delete/replace target ordered before later cast/read/reveal, prune eligibility/all own references and refund versions once; Undo/history cannot revive. No global vote counter/private event. |
| S281 | Same identity move/resize/text edit preserves ballot; new/duplicate identity excluded. At most250 targets, correct captured order despite later document reordering. |
| S282 | Confirmed reveal freezes aligned anonymous totals incl zero; deterministic descending/start-order/UUID ranking; no stopped-hidden phase. No creator/voter name/link retained in result. |
| S283 | Cast/unvote versus reveal in both receipt orders: only pre-reveal accepted ballot changes count, post-reveal refused. Concurrent reveals yield one transition/version and stale loser. |
| S284 | Reveal transaction deletes every private row/identity link atomically with totals. Inject storage/authorization failure before commit: running/private rows unchanged, no partial result/publication; retry explicit current command succeeds once. |
| S285 | Revealed deletion/role loss/text edit/reorder leaves frozen totals/order; missing identity resolves Removed object/no badge, same generation return may regain badge, different generation cannot. |
| S286 | Clear only revealed/current identity/version; removes payload/ballots/results, sessionVersion+1/idle. Cancel is client-only; duplicate/late clear cannot affect a new round. |
| S287 | Fresh epoch/generation and board/account boundary clear/no protected late projection, including4403 viewer rejoin versus terminal removal. Old commands never act on replacement. |
| S288 | Starter leaves, everyone leaves, late join: exact running session/private versions/slots or revealed results persist without TTL. No last-leave reveal or ballot loss. |
| S289 | Ordinary Node restart/room reopen persists running ballots and revealed totals; reapply controls, reauthorize sockets, no false idle. Common ordinary storage reopen proof also runs on workerd. |
| S290 | Actual DO eviction/hibernation/reconstruction preserves rows and bounded budget attachments; redaction before resumed socket publication. Node executes corresponding connection reconstruction guard; label mechanism accurately. |
| S291 | Ordinary restart with accepted pending document-history intent preserves timer and running/revealed voting, reconciles targets, retains intent/chunks and fresh generation. restore_pending alone never resets workshop. |
| S292 | Valid logical operator restore resets both workshop records atomically behind fresh fence and strict replay; competing history intent refuses restore_pending without loss/reset. |
| S293 | Logical backup exact table/meta sets omit both voting tables even empty, timer and recovery markers; vote-only activity leaves payload unchanged. No private data in document/history/export. |
| S294 | Inject voting top-level/table/meta/nested strict row fields into otherwise valid backup:400 bad_request before any fence/write/content change. Reject file/document voting fields too, preserving existing malformed/fingerprint/chunk checks. |
| S295 | Explicit marked-recovery common marker/reservation/intent guard both runners; actual stopped Node DB copy marked by real script resets voting/timer before serving despite same history intent, retains chunks. Physical Node subcase identified, not faked on workerd. |
| S296 | Supported Workers time-recovery entry/independent RestoreFence signal in worker.ts marks reset before load/history shortcut; common stale-generation/fail-closed recovery guard on Node. Ordinary hibernation does not stamp marker. |
| S297 | Trash admission clears both workshop records/private rows at fence before close; held vote/reveal/read cannot pass; Trash restore fresh idle. Cleanup failure retains denial/pending retry. |
| S298 | Purge/discard inventory drains callbacks and erases voting/timer rows/tables/file/alarm; old tasks cannot recreate them, other board intact. |
| S299 | Genuine document-history restore preserves current round/results across4423, prunes missing/different active targets/refunds, never imports historical votes or revives pruned eligibility. Frozen totals remain frozen. |
| S300 | Vote-only start/cast/remove/reveal/clear/read leaves canonical bytes/revision/edited-at,Undo/Redo,file payload/digest/bytes,retained history count/age/fingerprint unchanged; no vote capture trigger. |
| S301 | Concurrent timer commands/expiry and vote lifecycle independent; viewers retain timer authority while voting forbidden; both records reset together only at declared reset boundaries. |
| S302 | Stable first-access own colour/version across tabs/reconnect; all palette values valid, no client colour accepted, no colour/person breakdown after reveal/private deletion. |
| S303 | Crash/failure after explicit reservation/reset and before history/replay completion: retain denial/marker/intent, retry no repeat reset/revival/lowered fence. Test both runners and higher live floor. |
| S304 | Inject failures in private cast/unvote/prune/storage admission, including held target/access change: no partial budget/version/eligibility update or success publication; explicit current read recovers committed state. |

## Browser checks

Scenario **Y1-S1–Y1-S44**:43 on checks, Y1-S43 off only. Y1 was unused in
existing briefs/check tools when allocated; V remains validation-command naming.
No scenario tool exists as an input. The independent check run authors its
voting tool from these rows. Each row prints its full ID and PASS/FAIL, saves
raw facts/frames/value receipts, then SUMMARY. A baseline missing capability
must fail by name; setup/import abort is not a product negative control.

Use independent owner ana/editor ben/viewer mia browser contexts (synthetic
example.com people); add a second editor tab for account races. Reuse controlled
local stack and server queue/clock controls, never painted DOM or fake successful
snapshots. Read expected words/styles from voting v1, use ownText()/lookCheck()
helpers for text/declared properties. Save22 real-state images in rows1–22,
1280×800/scale1 except21–22 at375×812. Fixture geometry/labels/budget/colour and
the separate five-target results fixture are defined in voting v1. Wait for
actual committed snapshots and account-role evidence. Derived rectangles±0.5px,
wrapped text heights±1px; do not turn fixture-dependent Share x or total panel
height into generic constants. No screenshot-only acceptance.

Within the existing control rows, check each voting button family's rest, enabled
hover, keyboard focus-visible and pointer/key-held states against voting v1's
family table, including purple primary borders, neutral openers, transparent/
borderless result labels and Close, disabled states and no latched aria-pressed.
Use the existing setup/running/confirmation/results/strip states; no new scenario
or broader regression run. Scope speech observers by the stable timer/voting
identities, not all polite regions or post-hoc filtering of combined speech.

| ID | Scriptable behavior and expected values |
| --- | --- |
| Y1-S1 | Idle editor: open toolbar dialog Timer and voting, Timer then Voting/New vote, one Close Timer and voting; timer03:00/fields79×68/digits48px. Panel240/right12/top72, natural derived323.391 high; no name/email/byline. Capture idle-editor. |
| Y1-S2 | Click New vote focuses Question; empty counter0 / 240, default3, stepper names Decrease/Increase votes per person, scope All eligible objects on this board, Start voting disabled/.45, Cancel available. Textarea96px/no placeholder. Capture setup-default. |
| Y1-S3 | Fill Which idea should we try next? →30 / 240; increase3→5; Start voting enabled/3px focus outline+3px offset. Cancel discards expanded setup without command, re-enter local draft preserved during handoff. Capture setup-valid before Start. |
| Y1-S4 |240 valid code points show240 / 240,20 disables Increase; at1 Decrease disabled, no wrap; whitespace/241/invalid budget block Start,1/20 and nonblank1/240 pass. Use non-BMP characters to count code points. Empty eligible board refuses. Capture setup-bounds; exact setup words retained. |
| Y1-S5 | Viewer idle has No voting session., no New vote/Question; View only remains and timer03:00/Start/Pause/End still usable. Capture idle-viewer. |
| Y1-S6 | Owner starts real5-budget round; non-starter editor opts in and casts on second note/square/text, each await confirmation. Card/strip2 of 5 votes remaining; selector Pick the launch date, Your vote, Vote disabled/Remove vote enabled/End and reveal. Three own12px dots, no other dots; exact corner/first-line anchors from voting v1 ±0.5px, colour#dc2626 fixture. Capture running-voter. |
| Y1-S7 | Hover first unvoted note:2px #7051cf outline/Add vote tooltip at object.bottom+8. Separately hover actual Section: Not eligible for this vote in grey#79737f and computed outline-style none; no vote through it. Capture running-hover with actual separate-state receipts; no illustrative inset ships. |
| Y1-S8 | Select second note in real panned viewport x−110; preserve full context/Medium/handles, strip top=context.bottom+8=182 in fixture, dot shifts−110. No voting chrome obscures context/handles; no document movement from ballot click. Capture running-selected. |
| Y1-S9 | Viewer during running sees prompt and Voting in progress. Only owners and editors can vote.; no own budget/dot/input/reveal. Avatars remain; no remote cursor/selection/follow view. Timer controls still available. Capture running-viewer. |
| Y1-S10 | Separate budget3 round/three casts shows0 of 3 votes remaining, No votes remaining on new target, Vote disabled, own Remove vote/reveal enabled. Remove gives1 of 3 and one fewer dot, no other budget change. Capture budget-spent before removal. |
| Y1-S11 | Reserve50 synthetic identities through sequential real admissions, close unused sockets;51st eligible participant sees This voting round has reached its participant limit. and End and reveal, no own input/strip. No numerical roster or ballot state. Capture participant-limit. |
| Y1-S12 | End and reveal opens Voting / End voting for everyone? / This ends voting and reveals the results to everyone with access to this board.; Cancel first/focused, Tab confirm then shared Close→Share. Escape/Cancel no command/ballot change; Timer remains usable. Another person's cast does not dismiss; remote reveal/replacement does. Capture reveal-confirm. |
| Y1-S13 | Real five-target result fixture: achieve totals3,3,2,1,0, reveal then delete third-ranked object. Results/prompt/Voting ended. Results revealed.; rows Interview five customers3, Pick the launch date3, Removed object2, Square1, Draft the pricing page0. Four surviving badges incl zero, no dots/names. Tie uses start order; missing is not a button. Capture revealed. |
| Y1-S14 | Viewer sees identical frozen rows/counts/badges but no Clear results; still View only. Corner badges inside right−8/top+8; text zero badge first-line+8/centred/clamped. Purple#7051cf/white12px tabular/min24×24/radius12. Capture revealed-viewer. |
| Y1-S15 | Clear results opens Voting / Clear voting results? / This removes the latest voting results for everyone.; Cancel focused first, Escape sends nothing; confirm clears everyone to role-specific idle/no markers and permits New vote, timer unaffected. Capture clear-confirm before confirm. |
| Y1-S16 | Hold answer to an actual cast/removal: Checking vote…/Last confirmed, confirmed budget/dots only/dots opacity.45, selector/mutations/entry/exit disabled, Close/Timer available. At exactly2,000ms one vote_read and no second vote_command. Capture checking before release. |
| Y1-S17 | Lose transport/authority after confirmed state: Voting disconnected. Reconnecting…/Last confirmed · uncertain, confirmed dimmed dots/budget and disabled voting, Close usable. Rejoin actual current own projection, no mutation replay or document refused-save state. Capture reconnecting. |
| Y1-S18 | While voting runs, timer idle03:00 toolbar98×40, active02:14 toolbar62×40; no voting icon/badge/count/colour cue or Share resize. Names Timer and voting, idle, 03:00, Voting in progress and Timer and voting, running, 02:14, Voting in progress. Title remains timer-only. Capture toolbar-during-vote (one actual toolbar at a time, second state's receipt separately). |
| Y1-S19 | Keyboard focus native Eligible object and ring3px #7051cf/offset3. Running order Enter/Done voting→Eligible object→Vote→Remove vote→End and reveal→shared Close→Share; skip disabled Vote when already voted, reverse with Shift+Tab. Timer controls precede card. Capture focus-order. |
| Y1-S20 | Genuine retained history preview: existing Back to current version plus Back to current board to vote.; entry/selector/Vote/Remove disabled, no strip/dots/badges over historical pixels, End and reveal enabled for editor, timer usable. Capture history-preview. |
| Y1-S21 |375×812 actual second actions row/avatar overflow, panel x123/y128/w240/natural running height567.062; strip x12/y128/w103/derived149.5 high,8px gap, wrapped Done button padding8px4px. Shared Close/selector/Share keyboard reachable and panel scrolls at max-height; no invented narrow context chrome. Capture narrow-open. |
| Y1-S22 |375×812 close panel without ending: strip x12/y128/w351/derived85.5 high, Done on second row. Own dots still anchor to displayed note/text with clamping; Share unchanged/reachable. Capture narrow-canvas. |
| Y1-S23 | Owner/editor/non-starter/granted editor guest control versus viewer/granted viewer guest/ungranted/removed denial. Forge vote via real socket as viewer: refusal/no state leak; UI role rights match current admission. |
| Y1-S24 | Click versus drag/empty/ineligible overlapping topmost target, grouped members separately: one vote per eligible click, no vote-through/group expansion/duplicate. Pan/zoom/Space-drag still navigate, outside mode editor edits normally. Ballot clicks do not move/resize/edit. |
| Y1-S25 | Enter voting finishes text/gesture; native selector choose target/Vote/Remove via Enter/Space; canvas unmodified Enter toggles one focused/sole selected eligible target, repeat/modifiers/IME/native field input send no extra vote. Multi-selection with no single focused target casts nothing; Escape exits mode without unvote. |
| Y1-S26 | Two tabs same editor account, hold outgoing commands on same own version/last unit, release both orders: one accepted/one vote_stale_ballot, one unit spent, both tabs same own state/colour. Duplicate delivery never spends/removes twice; no automatic retry. |
| Y1-S27 | Owner and editor independently vote at same public sessionVersion; both succeed/no cross-voter conflict; owner cannot see editor's own version or vice versa. Simultaneous Starts/reveal with held sends resolve in server order without duplicate round. |
| Y1-S28 | Capture unfiltered incoming raw socket frames for all three roles and outgoing requests (redact auth secrets only). During editor casts compare exact projection keys/public metadata and all non-voting frames: no other ballot/count/participation/version/person link anywhere, no unrelated voting event. Repeat read/stale refusal/late join and second same-person tab. |
| Y1-S29 | Publish cursor/selection/view before Start, then Start: immediate remote spatial clearing, Follow disabled/stopped, avatars/heartbeat retained. Modified full presence during running relays placeholders only. Reveal requests fresh presence and reapplies saved show-cursors preference, never old hidden location. |
| Y1-S30 | Other editor moves/edits same target: dots follow without ballot loss; deletes voted identity: refund/private version and remove eligibility. Undo/recreate different generation cannot revive; new object excluded. Revealed deletion/edits retain frozen ranking/counts. |
| Y1-S31 | Close voter tab then revoke/downgrade effective role: server prunes offline ballot, no peer activity disclosure; reauthorize editor returns empty/refunded ballot/new private version. Live4403 viewer rejoins without own state/mode, timer rights intact. Terminal removal clears protected card/draft/overlays/pending/announcements before held reply released. |
| Y1-S32 | Hold the complete initial joined frame: before admission no workshop controls or outgoing vote command, never invented idle/results. Release valid joined and confirm its actual personalized projection. If an active controller is rendered before its first confirmed projection, its label is Connecting voting… with mutations disabled; prove that pure initial state in voting units as well. Do not manufacture partial joined or require toolbar before joined. Separately reject a pending mutation's2s readback: no success/optimistic dot; fresh admitted snapshot recovers without replay. |
| Y1-S33 | Observe correlated vote_read on join/reconnect/foreground/every15,000ms, one outstanding read; drop replies, after30,000ms voting disabled/disconnected, timer independently healthy. Recover with fresh snapshot/no mutation replay/draft loss. |
| Y1-S34 | Running/revealed reload, late join, starter leaves, all leave then fresh join: same session/own budget or frozen results, no TTL/reveal. Full reload setup draft resets/default3. Server restart proof is S289–S291, not inferred from reload. |
| Y1-S35 | Actual document-history restore through current version route/4423 preserves live session and reconciles missing/different targets/refunds; preview cannot vote, reveal/clear still work. Do not substitute an edited banner for genuine preview/restore. |
| Y1-S36 | Actual Trash→restore starts idle/no stale marker/state. Valid operator logical recovery clears both workshop states; held old commands cannot return them. Purge/discard/recovery runner-specific proof is S292–S298/S303. |
| Y1-S37 | Saved stable fixture/no pending document edit: compare canonical/export/file bytes+digest/revision/edited-at/history count/fingerprint/Undo/Redo before and after Start/cast/remove/reveal/clear/reads; all identical. No own activity triggers capture or save-status change. |
| Y1-S38 | Simultaneous timer+vote: timer controls/expiry never reveal; voting lifecycle never changes timer. Drafts survive shared panel History/Comments/Share handoff, one surface only; remote voting updates do not steal timer/canvas focus. Timer confirmation changes only Timer card. |
| Y1-S39 | Assert one `.sr-only[data-workshop-status="voting"][role="status"][aria-live="polite"][aria-atomic="true"]` and a distinct timer identity, including panel closed. Bind voting text/mutation observer only to its voting node. Live Start exact Voting started. Open Timer and voting to participate.; own N of B votes remaining; reveal Voting ended. Results revealed.; clear Voting results cleared.; recovery Voting reconnected. Duplicate result/state speaks once; initial/late/rejoin snapshot silent except recovery. No remote vote/count/person/per-row/read/tick speech. Exercise timer speech while observing voting and voting speech while observing timer: no cross-channel mutations/messages. Keep Z1's complete timer assertions separately. Lost logical control falls to voting heading only when focus inside; no reused-DOM wrong focus. |
| Y1-S40 | Reveal/clear confirmations bind sessionId/sessionVersion, not own version. Other voter activity retains confirmation; remote reveal/clear/new Start dismisses it safely; old confirm cannot affect replacement. Cancel/Escape returns correct opener, no send. |
| Y1-S41 | Team-on local board has no voting DOM/request/mode; hosted solo editor gets normal voting. File export/import carries no workshop fields and imported hosted board starts idle; strict injected voting fields refused. |
| Y1-S42 | Budget1/20 maximal bounds,240-code-point prompt, cap participant message and malformed raw commands all show contract-defined result/refusal, never generic refused-edit recovery. Exercise the20-unit budget with legal eligible targets; no load/performance campaign. |
| Y1-S43 | Team-off sentinel only: no voting controller/strip/marker/card/trigger addition/requests; local save, toolbar and canvas keyboard unchanged, ordinary title NextPhase Board. Existing timer absent too. |
| Y1-S44 | At real pan/zoom and different text size/alignment/wrapping, independently derive first displayed line from stored content/runs/view. Assert dot+6/badge+8/line centre/right clamp±0.5px, empty-text corner fallback, fixed12/min24 CSS sizes and no selection/context overlap. Do not assert a universal top-right against styled text. |

## Acceptance criteria

Approved wording is stated here as public requirements; named sections refer to
voting v1's complete rules, rather than a separate private specification.

- **0007-W2-AC01:** On an active hosted board on either runner, a currently
  admitted effective owner/editor starts one round, with nonblank1–240-code-point
  prompt, integer budget1–20/default3, whole-board snapshot of eligible sticky/
  shape/text/image identities and start order, and no empty round. Current
  owner/editors, including granted editor guests and late joiners, can opt to
  vote; viewers see status/results only. Test every role, non-starter control,
  ungranted/removed denial, target exclusions, one-round refusal and bounds.
  Local/team-off shows nothing and sends no voting requests. Set-up and shared
  timer/voting panel match the specified design and keyboard/assistive semantics.
- **0007-W2-AC02:** A voter uses click or the specified keyboard route to cast/
  remove one vote per eligible object, within one account-shared budget across
  tabs; each confirmed removal refunds one. Budget-spent input still removes.
  Server personalization withholds every other person's ballots/counts/
  participation/version before reveal, including from the starter, viewers and
  reconnects; running privacy redacts remote cursor/selection/view while
  retaining avatars. Prove raw recipient frames, own-colour/accessible own state,
  two-tab double-spend, two-voter concurrency, expected versions, stale/duplicate
  refusals, specified sizes/rates/cap and uncertain/no-replay behaviour. Ordinary
  canvas editing outside local mode and timer controls remain independent.
- **0007-W2-AC03:** Confirmed owner/editor End and reveal atomically freezes
  anonymous totals, ends voting and shows deterministic ranked panel results
  plus canvas counts. Cancel changes nothing; cast/reveal races follow server
  order. Private voter rows disappear at reveal; only latest aggregate result
  remains until confirmed clear. Reload, late join, starter/all departure and
  ordinary DO/Node reconstruction preserve the declared live state. Prove
  current-access/4403 cleanup, offline voter removal, target deletion/edit/move,
  Undo/history-preview/history-restore rules and frozen-result treatment.
  Trash/discard/purge and explicit logical/marked-volume/Workers time recovery
  clear workshop state behind fresh fences; Trash restore/import starts idle.
  Voting-only work never changes canonical document/revision/edited-at, Undo/
  Redo, file/export bytes, retained history/fingerprint or logical backup payload.
  Reject injected voting data before restore fences/writes; identify runner-only
  physical cases. Reveal, focus, budget and reconnect announcements follow the
  specified keyboard/assistive rules.

| Criterion | Evidence that shows it |
| --- | --- |
| 0007-W2-AC01 | S257–S259; S263; S267–S272; S277; S301–S302; Y1-S1–Y1-S5; Y1-S9; Y1-S11–Y1-S12; Y1-S18–Y1-S25; Y1-S41–Y1-S43; V4; V9; V11 |
| 0007-W2-AC02 | S260–S281; S287; S302; S304; Y1-S6–Y1-S11; Y1-S16–Y1-S19; Y1-S23–Y1-S33; Y1-S38–Y1-S39; Y1-S42; Y1-S44; V4; V9–V11 |
| 0007-W2-AC03 | S278–S304; Y1-S12–Y1-S17; Y1-S20–Y1-S22; Y1-S30–Y1-S41; Y1-S44; V4; V9–V13 |

## Validation commands and expected evidence

Use Node26.13.0/npm11.20.0, repository root. Source validation is not independent
acceptance. Every check run restates **each V row it reruns** as its own
`PASS: Vn ...` or `FAIL: Vn ...` line, with exact source SHA/logs/counts. Retain
failed/unrun subchecks explicitly; no inherited aggregate PASS from a prior run.

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
git diff --name-status <prerequisite-base>..<validated-source>
git diff --check <prerequisite-base>..<validated-source>
```

Copy off/on outputs aside before rebuilding. Baseline752f79d has its own clean
install/source/build/local stack; no candidate schema/artifacts reused on base.
After build and before independent browser check1, a fresh full-access
server-only run clean-clones candidate, installs, creates a uniquely owned LOCAL
Supabase stack from committed config, installs/reapplies schema, runs Node then
workerd sequentially, saves complete logs and returns failures for fixes. No
browsers/baseline/design in that run. Setup uses existing machinery:

```sh
node tests/server/make-signing-key.mjs
npx supabase start
node tests/server/write-stack-info.mjs
npm run test:server:node
npm run test:server:workerd
npx supabase stop --no-backup
```

Record schema install/reapply/actual ports/Auth-config restore and owned cleanup;
never log signing/service secrets. No hosted schema application or deployment.
Exact-source server-only logs can satisfy V11 if no server/SQL/room/shared-package
change intervened; otherwise rerun both full suites. Independent check1 runs clean
V1–V8, new Y1/baseline negative, accepted regressions and boundary. After fixes,
always clean install/typecheck/builds/full unit; rerun failed/unrun checks, both
servers for server/shared changes, own scenario for web changes, accepted
regressions reached by diff. State each skipped item/reason, retain earlier proof;
do not automatically repeat a successful baseline negative control.

Independent tooling scenario interface (tool authored by check run, outside the
public implementation):

```sh
node tools/browser-compare/0007-w2-check.mjs <served-on-origin> <Y1-output> <local-stack-private-json>
node tools/browser-compare/0007-w2-check.mjs <baseline-on-origin> <Y1-base-output> <baseline-stack-private-json> --negative
node tools/browser-compare/0007-w2-check.mjs <served-off-origin> <Y1-off-output> <local-stack-private-json> --off
```

| Check | Command/inspection and pass condition |
| --- | --- |
| V1 | Byte-compare manifests/locks/inventory/runtime notices to prerequisite base; no changes/new dependency. |
| V2 | npm ci --ignore-scripts --no-audit --no-fund exits0 in clean candidate and independent baseline. |
| V3 | npm run typecheck exits0 across all five workspace members. |
| V4 | npm test full suite exits0, workshop-voting units cover pure rules/wire/versions/input/geometry/cleanup; module guards45 team/22 state/App≤264/composition-only. Removal and all inherited functional assertions retained with only listed fixture/disposition amendments. |
| V5 | Team-off npm run build and npm run audit:licenses exit0; index.html/notices byte-identical to base off; meta has no team/Supabase/voting inputs. |
| V6 | npm run build:fixtures, team-on npm run build and audit:licenses exit0; index.html equals base on, notices equal runtime notices v3. Off output preserved before rebuild. |
| V7 | npm run build:server, audit:licenses and WRANGLER_SEND_METRICS=false npx wrangler deploy --dry-run --outdir <scratch> -c apps/server/wrangler.json exit0; no deploy. |
| V8 | Inspect every hunk and git diff --name-status <prerequisite-base>..<validated-source>, plus git diff --check. Only deliverables1–5 and append-only Implementation record allowed. Earlier fix-round record commits inside the full range are valid and must not fail this check. Requirements/contracts/indexes remain prerequisites. Keep original prerequisite base; never advance it to hide changes. Record validated source/test SHA separately from later record tip. |
| V9 | Y1-S1–Y1-S42/Y1-S44 on(43), Y1-S43 off(1),22 captures and concrete value/raw-frame/keyboard receipts pass; all common S257–S304 proven both runners. Any unrun/failed criterion check prevents PASS. |
| V10 | Once on independent752f79d source/build/stack, new voting unit/server/browser capability checks fail by name. Local/off/boundary-only assertions may pass. Missing-import/setup abort is distinct and never substituted for criterion negative proof. |
| V11 | Full npm run test:server:node then npm run test:server:workerd: Node S1–S50/S55–S304; workerd same except S37/S43/S70/S168 physical exclusions. S257–S304 all common, S295 physical subcase Node-only. No new failures; no skips called passes. Reuse exact-source server-only proof only as above. |
| V12 | Accepted A–J team-off compare: two baseline runs then candidate, existing saved-time normalization only, no new mask/changed canvas/save/controls/focus. |
| V13 | Accepted Z1-S1–Z1-S29/Z1-S31–Z1-S36 on, Z1-S30 off; W2-S1–W2-S21; T1-S1–T1-S29/T1-S31–T1-S61 on and T1-S30 off; removal units/server S77–S93 inside full suites. Amend only named title/controls/Tab/derived panel positions and the explicit Z1 timer-only speech selectors/observers (shared collector, S29 and --end-reconnect). Preserve every timer speech/functional assertion; compare each failure with current baseline source/results. Baseline-proven failures and unrun cases remain failures/unrun, never aggregate PASS. |

Accepted regression budget: full unit10–20s plus1min reporting; both servers
18–22min after schema setup; A–J off2–4min; Z1 including off5–8min; W2 7–10min;
removal included in suites plus1–2min inspection; T1 including off5–8min.
Allocations total roughly40–55 active minutes with shared setup, low confidence,
excluding product fixes. No extra harness/historical scenario/load/performance/
browser matrix or assistive audit. Three Safari milestone spot checks are chosen
only at Review.

Known caveats: W2-S7/W2-S8/W2-S9/W2-S16/W2-S20/W2-S21 failed identically on the
previous baseline and are tracked separately; compare against current752f79d and
candidate, report original signatures separately from new failures. T1-S38/T1-S39
are baseline-proven; T1-S26/T1-S29 were unrun because they consumed an unaccepted
history-scenario log. Do not commission that unrelated scenario to fill them,
claim the entire T1 green or waive voting/privacy/reconnect failures. Preserve
the distinction between baseline-proven and currently unclassified behavior.
Public boundary hooks and an independent publication read remain mandatory.

## Review focus

Review raw per-recipient frames, split-version races/account-shared budgets,
offline-person pruning, all recovery entry paths and maximal actual stored
encodings first. Check inside-corner/first-line marker geometry, specific
typography/derived tolerance, independent timer controller/drafts/focus and the
shared Tab order, results-row and badge alignment, and that the App.tsx module test
loses only its byte-equality assertion. Verify each older check disposition against source/tests,
baseline caveats versus new failures, complete rerun V lines and empty-versus-
missing private-row cleanup. No runtime evidence is asserted by this draft.

## Exclusions and reasons

- Local boards and team-features-off voting; no shared server voting authority.
- General stamp tool/new persistent object type; voting dots are ephemeral UI.
- Named/per-person results, participant completion roster, past-results history.
- Invitations, several simultaneous rounds, facilitator/starter lease or role.
- Timed auto-reveal or timer/vote cross-control; end/reveal is explicit.
- Hosted images; image eligibility does not add hosted image creation/import.
- Ballots/results/prompt in document/Undo/history/file/logical backup/browser disk.
- Offline queued mutations, automatic replay/retry, new HTTP route/dependency.
- Prototype, hosted schema application/deployment, external messaging/agent dispatch.
- Extra historical/harness/browser matrix/load/performance/assistive campaigns.

## Implementation record

(Appended by the implementer.)


### Implementation — 2026-11-09

- Branch: `codex/0007-W2-vote-and-reveal-workshop-results`.
- Prerequisite base: `536487da100678d220192593cb6534782d5feabc`.
- Validated source/test revision: `3807d4ba761c6019a8eb769932690b0d1e82b236`.
  Validation ran on the identical source tree before this commit; only this record
  remained uncommitted afterward. This append-only record is a separate commit;
  its final branch tip is reported separately in the handoff.
- Toolchain: Node 26.13.0 / npm 11.20.0. Added dependencies: none. All 20 tracked
  manifests, lock/inventory and runtime-notice inputs are byte-identical to the
  prerequisite base.

Implemented dedicated room/protocol and web voting modules, strict personalized
frames, split versions/account budgets, atomic private writes/reveal, access and
target pruning, running spatial redaction, bounded storage and recovery resets.
The shared shell retains Timer's controller/drafts/clock/focus and separate speech
identity. Voting has its own native card, uncertainty/readback, input delegation,
first-displayed-line geometry, measured badge width and narrow strip containment.
The final access-cleanup follow-up clears protected voting state immediately
on 4403, including draft/refusal text and pending speech, before fresh viewer
admission restores public metadata only (W2-U37).
The nine declared new source/test files are present. App remains composition-only
at 264 lines, with 45 team modules and 22 state modules. No document/file field,
service SQL table, dependency, voting route or persistent browser ballot is added.

All commands below exited 0 on the validated source. Build environment for both
web variants was `BOARD_SUPABASE_URL=http://127.0.0.1:55321`,
`BOARD_SUPABASE_ANON_KEY=synthetic`, `BOARD_SERVER_URL=http://127.0.0.1:8796`.
Off/on outputs were preserved separately before rebuilding. The clean baseline
install/build comparison used a separate public Git archive of
`752f79d3eb3c41f981673a1e512b581b9c72c919` and its own dependency install.
It did not run the independent new-capability negative control.

| Row | Commands / inspection | Result |
| --- | --- | --- |
| V1 | Byte comparison against prerequisite base for every tracked package manifest/lock, dependency inventory/lock and runtime notice | PASS: 20/20 unchanged; no added dependency |
| V2 | `npm ci --ignore-scripts --no-audit --no-fund` on candidate and separate clean baseline | PASS: both exit 0; 118 packages installed in each |
| V3 | `npm run typecheck` | PASS: all five workspace members |
| V4 | `npm test` | PASS: 1,004 tests, 1,004 passed, 0 failed/skipped; includes W2-U01–W2-U37 and all 967 inherited tests |
| V5 | `BOARD_TEAM_FEATURES=off npm run build`; `npm run audit:licenses`; inspect preserved output and compare baseline | PASS: index/notices byte-identical to baseline off; 216 bundle inputs with no team/Supabase/voting module inputs |
| V6 | `npm run build:fixtures`; `BOARD_TEAM_FEATURES=on npm run build`; `npm run audit:licenses`; compare preserved output | PASS: index/notices equal baseline on; notices equal runtime notices v3 |
| V7 | `npm run build:server`; `npm run audit:licenses`; `WRANGLER_SEND_METRICS=false npx wrangler deploy --dry-run --outdir <scratch> -c apps/server/wrangler.json` | PASS: Node/Worker bundles and notices; dry run only, two unchanged Durable Object bindings |
| V8 | Inspect every hunk; `git diff --name-status 536487da100678d220192593cb6534782d5feabc..3807d4ba761c6019a8eb769932690b0d1e82b236`; `git diff --check` over the same range; working-tree and revision public-boundary checks | PASS: 58 allowed source/test/documentation files; nine declared new files; requirements/contracts/indexes unchanged; this record only is appended afterward |

Final command receipts and complete logs are retained in the implementation
scratch artifact set `0007-w2-validation`: `final-commands.json`,
`final-install.log`, `final-typecheck.log`, `final-unit.log`,
`final-build-off.log`, `final-audit-off.log`, `final-fixtures.log`,
`final-build-on.log`, `final-audit-on.log`, `final-server.log`,
`final-audit-server.log`, `final-worker-dry-run.log`,
`final-server-tests-node-typecheck.log`, `final-diff-check.log`,
`final-boundary.log`, `source-name-status.txt`, and baseline install/build logs.
Logs and generated bundles are not committed. An additional isolated TypeScript
check of the new Node server tests and changed Node controls passed. Its initial
attempt found two test typing issues, which were fixed; a combined DOM/Workers
scratch configuration also lacked the runtime's `cloudflare:test` declarations
and conflicted on globals. It is not Worker-runner evidence.

Focused native SQLite measurements (W2-U23) were 23,503 bytes for the maximal
running singleton, 24,103 for the revealed singleton, 1,844 per private ballot,
and 115,703 aggregate running bytes with 50 maximal ballots. These include escaped
JSON TEXT columns. All remain below the specified limits; actual measurements
on both server runners and full attachment proof remain pending S271/S272.
The 48 common S257–S304 tests and both includes are authored, with named result
lines and SUMMARY-VOTING. Registration/source compilation is not a server pass.

Unrun here: Supabase CLI, local-stack/schema installation and reapplication,
full Node/workerd server suites (including S257–S304 on each), all browsers/Y1
and 22 captures, the independent baseline capability negative, and accepted
A–J/Z1/W2/T1 browser regressions (V9–V13). Browsers and Supabase CLI cannot start
in this implementation sandbox. The next operator-launched run is the fresh
full-access server-only clean candidate/install/unique local stack/schema
install+reapply, Node then workerd, with owned cleanup and failures returned
before the fresh independent check. No check tool, server run or agent is
launched by this handoff. Existing W2-S7/S8/S9/S16/S20/S21 and T1-S38/S39
baseline-failure caveats remain separately tracked; T1-S26/S29 remain unrun.
No new privacy/reconnect failure is waived and no milestone acceptance is claimed.

No contract/allowlist/dependency escalation was needed. Graph MCP discovery and
indexing were blocked by the session's approval policy; source-file discovery
was used as the permitted fallback. Git's hooks both passed on the source commit;
Git also emitted a non-fatal `packed-refs.lock` permission warning. The commit,
branch tip and clean worktree were verified; no shared-ref maintenance or hook
bypass was attempted. Internal planning/design artifacts and the existing W1
evidence summary were not edited. No main mutation, push, merge or deployment.
