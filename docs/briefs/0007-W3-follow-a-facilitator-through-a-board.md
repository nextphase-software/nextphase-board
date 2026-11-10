BRIEF VERSION: 0007-W3 v1 (2026-11-10)
# 0007-W3 — Follow a facilitator through a board

Status: Draft. Implementation has not started under this brief.

## Outcome and read first

Any admitted person on a hosted team board can press Spotlight me. Other people
get a short chance to decline, then follow that presenter's view. They can leave,
work independently and rejoin. One presenter, explicit takeover and bounded
connection lifetime keep the shared view understandable without editing content.

Read [AGENTS.md](../../AGENTS.md), [CONTRIBUTING.md](../../CONTRIBUTING.md),
[DESIGN.md](../../DESIGN.md) and these ten new contract files (prior versions
remain untouched):

| Contract | New version / ownership |
| --- | --- |
| [Presence](../architecture/0004-presence-v3.md) | v3: full state/wire/authority/membership/lifetime/bounds |
| [Sync](../architecture/0003-sync-v12.md) | v12: joined/dispatch/ordered sends and separate transport |
| [Access](../architecture/0003-access-v11.md) | v11: effective roles/current admission/terminal cleanup |
| [API](../architecture/0003-api-v11.md) | v11: existing socket only, no new HTTP/roster |
| [Hosted storage](../architecture/0003-hosted-storage-v11.md) | v11: page-memory controller/offer/health/rejoin |
| [Self-host runner](../architecture/0003-self-host-runner-v7.md) | v7: original close causes, live attachments/restart/recovery |
| [Voting](../architecture/0007-workshop-voting-v2.md) | v2: narrow ordered spotlight termination at running Start |
| [Board lifecycle](../architecture/0006-board-lifecycle-v5.md) | v5: terminate before lifecycle/recovery/4423 |
| [Interaction](../architecture/0001-interaction-v37.md) | v37: complete concrete words/look/placement/focus/speech |
| [Web modules](../architecture/0001-web-modules-v35.md) | v35: dedicated room/client/rules/presentation and guards |

Use this set wherever inherited contracts link a replaced version. Unchanged:
[timer v2](../architecture/0007-workshop-timer-v2.md),
[hosted persistence v10](../architecture/0003-hosted-persistence-v10.md),
[document v15](../architecture/0001-document-v15.md),
[board file v4](../architecture/0006-board-file-v4.md),
[identity v4](../architecture/0003-identity-v4.md),
[comments v4](../architecture/0005-comments-v4.md),
[local storage v3](../architecture/0001-storage-v3.md),
[toolchain v5](../architecture/0001-toolchain-v5.md),
[lock v5](../architecture/0001-dependency-lock-v5.json),
[inventory v5](../architecture/0001-dependency-inventory-v5.json),
[runtime notices v3](../architecture/0001-runtime-notices-v3.txt).
Current document10/fileVersion2/room layout7/backup envelope1; service tables16.
No stored-format/dependency change. Spotlight adds no SQLite table/meta row/
journal, Supabase row, backup field or browser disk value. Timer state,
persistence, roles, trigger, panel, title and independent announcements remain.
No spotlight in Yjs/document, revision/edited-at, Undo/Redo, history, file/export
or backup payload. Strict current document/file/backup validators remain.

Build directly; no prototype/scenario tool is an input. The build proves the
stated values with focused tests, followed by independent checks. Report a
contract conflict before dependent work. All checks concern the current app,
protocol and formats.

## Deliverables and boundaries

Planning source baseline main **e56e70e96f9ad35d4ec666a3c32a88bb42f4e730**.
Use a fresh milestone worktree/branch from committed main containing this packet,
recording that actual prerequisite base separately from the behavior baseline.
New source files carry SPDX-License-Identifier: Apache-2.0. Only the following
files may change, solely for this milestone and named shared-path dispositions.

1. **Dedicated room/transport:** new `packages/board-room/src/spotlight.ts` and
   `packages/board-sync/src/spotlight.ts`. Existing board-room src `room.ts`,
   `protocol.ts`, `interfaces.ts`, `presence.ts`, `access.ts`, `voting.ts`,
   `timer.ts`, `lifecycle.ts`, `history.ts`, `storage.ts`, `backups.ts`;
   existing `packages/board-sync/src/session.ts`. Spotlight logic belongs in
   its dedicated controller; room.ts only integrates dispatch/order/close/
   expiry/reconstruction/lifecycle. No document edit journal or storage schema.
2. **Complete recovery/close inventory, both runners:** existing
   `apps/server/src/worker.ts`, `worker-room.ts`, `worker-runtime.ts`,
   `start-node.ts`, `node-storage.ts`, `runtime.ts`, `app.ts`, `lifecycle.ts`,
   `delivery.ts`; `apps/server/src/routes/operator.ts`, `access.ts`, `boards.ts`,
   `history.ts`, `lifecycle.ts`; `apps/server/scripts/mark-restored-volume.mjs`
   and `apps/server/README.md`. Inspect worker.ts's BoardRoom.getRoom,
   reserveTimeRecovery/independent RestoreFence and websocket close/error
   delegation; worker-room.ts's live getWebSockets/attachment reconstruction,
   restore-to-time/discard/close/error; start-node.ts's start/roomEntry/
   recoveryGeneration/removeRoom and Node websocket callbacks; node-storage and
   actual stopped-volume marking. At baseline WorkerRoom.webSocketClose maps
   1006 to1001 for socket.close, Node's close handler drops code/reason and
   Room.closed(connection) takes no reason. Change to
   Room.closed(connection: Connection, code: number = 1006, reason: string = "").
   Worker webSocketClose(socket,code,reason) forwards original code/reason before
   separate1006→1001 socket-close normalization; Node close callback takes
   (code,reason), forwards code ?? 1006 and reason?.toString("utf8") ?? "". Recoverable
   client4410/retry_recovery and no-frame1006/missing code get grace; terminal
   overrides always win. Include worker.ts, idempotent error+close and stronger
   terminal overrides. Do not stop at the room-local reset or miss pre-load/
   pending-history shortcuts. Preserve accepted recovery intent/denial/chunks.
   Only integration/documentation changes; no HTTP/service SQL/deployment change.
3. **Dedicated web:** exactly three new files `apps/web/src/team/spotlight.ts`,
   `spotlight-rules.ts`, `spotlight-layer.tsx`. Existing team `hosted-board.ts`,
   `presence.ts`, `people.tsx`, `presence-layer.tsx`, `team-app.tsx`, `history.ts`,
   `history-panel.tsx`, `workshop-panel.tsx`, `timer.ts`, `timer-panel.tsx`,
   `voting.ts`, `voting-card.tsx`, `voting-overlay.tsx`, `share-dialog.tsx`,
   `comments/panel.tsx`, `comments/layer.tsx`; existing `apps/web/src/App.tsx`,
   `ui/save-area.tsx`, `ui/context-bar.tsx`, `ui/zoom-controls.tsx`,
   `ui/navigation-panel.tsx`, `state/use-presence.ts`, `state/use-viewport.ts`,
   `state/use-canvas-input.ts`, `state/use-page-keys.ts`, `state/use-selection.ts`,
   `state/use-board-document.ts`, `scene/overlays.tsx`, `scene/board-drawing.tsx`
   and `apps/web/style.css`. Session/rules/presentation stay in the dedicated
   spotlight modules, never App.tsx or document-edit hooks. Input/selection/
   preview hooks only delegate leave/stop/safety signals before their ordinary
   actions. Reuse existing presence.ts grouping/chooseFollow/fitFollow,
   hosted-board.ts manual Follow/reset, use-presence.ts latest view application
   and use-viewport.ts ownViewChange versus setFollowView. Extend existing
   BoardSession Transport.close and hosted WebSocket wrapper to carry reason;
   audit every endAttempt caller and HostedBoard.offline/finish retry branch so
   retry closes4410/retry_recovery are never overwritten by clean1000.
   App composition-only/
   ≤264 lines; exactly48 team modules/22 state hooks, existing import exceptions.
   No duplicated timer/voting controller, drafts, clocks, focus or speech owner.
4. **Focused tests/guards:** new `tests/workshop-spotlight.test.mjs` and
   `tests/server/spotlight.test.ts`; existing `tests/modules.test.mjs`,
   `presence.test.mjs`, `shared-editing.test.mjs`, `recovery.test.mjs`,
   `room.test.mjs`, `removal.test.mjs`, `grouped-edits.test.mjs`,
   `workshop-timer.test.mjs`, `workshop-voting.test.mjs`, `board-history.test.mjs`,
   `board-lifecycle.test.mjs`, `comments.test.mjs`, `mentions.test.mjs`,
   `team-import.test.mjs`; server `suite.test.ts`, `shared.test.ts`,
   `removal.test.ts`, `mentions.test.ts`, `history.test.ts`, `lifecycle.test.ts`,
   `timer.test.ts`, `voting.test.ts`, `setup.ts`, `peer.ts`, `node-test.ts`,
   `worker-test.ts`, `driver-node.ts`, `driver-workerd.ts` under tests/server.
   Root `vitest.node.config.ts` and `vitest.workerd.config.ts` add only the new
   server include; `tests/README.md` records ranges/dispositions/limits. Retain
   original functional assertions; amend only exact joined/attachment/module
   inventories and named dispositions, with deterministic clock/queue/admission/
   close/hibernation/restart controls for the new checks. Dynamically import new
   modules within named checks, never top-level, so baseline absence fails by
   check name rather than aborting the file. No invented stored layout bump.
5. **Record:** append only this brief's Implementation record, in a separate
   record commit, including later fix-round record commits. Requirements,
   contracts/indexes are prerequisites, never implementation edits. Distinguish
   validated source/test revision and record-inclusive tip. Existing untracked
   0007-W2 evidence summary is not a deliverable and stays untouched.

Outside the named new controls, the existing screens' markup stays exactly as at
the base: the reviewer's A–J comparison allows only the masks listed under
validation. Preserve file/name/selection/context/handles, save/Share/local/off
canvas and editing. The people-menu row, target Unfollow names/rings, single
follow banner/frame, identified spotlight speech and declared collision wiring
are the complete UI exception. No dependency/manifest/lock/inventory/notices/
build-script/service permission change or new import/hook. Ignored generated
build artifacts (including esbuild meta.json) never count as tracked changes.
Escalate a required file outside this allowlist; do not silently expand it.

## Required behavior and concrete design

Implement presence v3 and interaction v37 in full. In particular:

- One room-owned, exact-connection presenter, current effective owner/editor/
  viewer rights including granted guests; presenter-only Stop, deliberate
  expected-version takeover/new offers. Distinct follower people across tabs,
  independent connection membership; no public roster or own-person auto-offer.
- Visible/actionable 3,000 ms offer/full safe deferral and real fresh view,
  immediate safe Follow, Not now, local leave/rejoin/dismiss. Reuse normal fit,
  resize and .5–2 limits. No content/selection copying; leave before local work.
- Explicit lifetime event table, five-second abnormal-loss grace only for same
  page/current account/epoch/generation/key, clean departures and terminal
  overrides, fresh follower re-offer. Retrying client endAttempt closes send
 4410/retry_recovery; explicit leave/navigation/sign-out/Stop remain clean or
  explicitly invalidate before close. Missing-frame1006/missing Node code is
  abnormal;4403/4423/4401/4409 and all terminal causes bypass grace.
  Live DO attachment reconstruction versus
  absent-presenter reconstruction/actual Node restart ending, no database state.
- Single ordered queue/current recipient and presenter spatial admission,
  split control/member versions, strict separate frames/refusals, no replay.
  Active-entry commands reserve two controlVersion increments under presence v3;
  follow/internal resume-follow likewise reserve membershipVersion headroom for
  leave plus terminal cleanup. Both use spotlight_version_exhausted; explicit
  refused entries leave old state unchanged, exhausted automatic resume-follow
  uses the reserved leave transition, and mandatory cleanup always fits.
  Bounds/rates are presence v3's exact table; never raise landed runner limits.
  One pending mutation/one2s readback/15s reads/30s stale, no optimistic motion.
- Voting Start rejected before commit leaves spotlight unchanged. Committed
  Start ends spotlight/keys/offers/membership in the same ordered transition
  before any post-commit await/spatial delivery, even if later stamp,
  authorization or reply delivery fails. Start/join/resume refused while running.
  No reveal resume. Running redaction, timer state/title/announcements stay independent.
- One white presenter-accent banner for spotlight and ordinary Follow. Status
  directly precedes native controls, with no separator glyph. At widths600px
  and wider it hugs content capped at min(400px,viewport−24px) or the narrower
  left column beside a right panel/menu reserving its rectangle+8px; full width
  viewport−24px there is only for placement8px below a panel when the remaining
  column is under240px. Below600px it always has width viewport−24px, status on
  its own row/actions wrapping below, including without a panel; the under240px
  placement rule still applies. Base top also includes every visible hosted
  .team-banner/.team-notice-column surface bottom plus12px; notices retain their
  own CSS positions/internal8px gap, including narrow188px, never covered or
  moved by spotlight layout. These are interaction v37's rules. Derived positions
  allow0.5 CSS px, wrapped heights1px; use actual context/panel/font rectangles,
  not frozen coordinates or generic rules against styled elements.
- Native people/banner navigation, menu-first Escape, editor protection,
  disappearing-control focus fallback and one separately identified polite
  spotlight region, once-only transitions and no count/tick/view speech.

## Shared-path check dispositions

This inventory authorizes expectation changes, not additional historical runs.
Retain all functional checks and strict keys except joined's new spotlight
member/declared attachment fields. Current layout7 and stored inventories stay.

| Shared path / older checks | Disposition |
| --- | --- |
| Socket admission/close/current rights: S9,S16,S24–S30,S40–S50,S77–S101,S116–S120,S186–S187,S197,S218,S224,S241–S245,S277–S279,S287; room/removal/recovery/history/lifecycle units; W2-S1–W2-S21 | Keep origin/tickets/capacity/503 strict replay/outage phases, close codes and document waiting/held-edit behavior. Add original cause forwarding only; no wider cached HTTP gate. New spotlight grace must not delay terminal denial/expiry/epoch/generation. S40–S43/S70–S71 retain their existing intended room_locked/replay phases. New independent grace/revocation cases below cannot be satisfied by an unreachable W2 assertion. |
| Recoverable attempt closes: tests/recovery.test.mjs deadline, resend-deadline, send-failure and every-transport-close/interrupt tests; shared-editing session-close test; S116–S120; W2-S1/W2-S2/W2-S4/W2-S6–W2-S9/W2-S14–W2-S18/W2-S21 | Supersede only recovery paths' old wire1000 expectations with4410/retry_recovery; fake transports capture reason, include4410 in close matrix. Preserve local4000/answer_deadline and send-failure1006 events, silent interrupt, ten-second timing, all waiting bytes/counts/order/receipts/Yjs/Undo/epoch/generation fences. Terminal discard cases access_removed/signed_out/sign_in_expired/chosen_reason and shared-editing explicit close retain1000. S116–S120 keep every functional assertion; forward actual code/reason through adapters/drivers rather than silently defaulting closed(connection) after a known clean close. W2 retry rows retain statuses/edits/deadlines; access/restore/expiry/sign-out/leave rows keep terminal outcomes. No baseline repair/waiver. |
| Hosted notice/banner geometry: W2-S19/W2-S20 and W3-S32/W3-S36; P1-S10/P1-S14/P1-S17/P1-S21/P1-S22/P1-S40/P1-S46 | Replace W2-S19's fixed132px with measured final notice-column rectangle plus derived follow-banner top=max(bars/context/notices.bottom)+12px; retain notices' order/internal8px gap,128px no-follow fixture, inherited132px/188px with-follow CSS positions when applicable, widths/dismiss wrapping and all recovery assertions. W3-S32 replaces notice.top≥follow.bottom with follow.top≥max(bars/context,notice.bottom)+12px, keeping viewer/Follow behavior. Never move notices to satisfy it; derived positions±0.5px/wrapped heights±1px. No-notice P1-S21 remains351px and P1-S40's width branches unchanged; their base-top inputs now use v37's notice-aware rule, exercised in P1-S50. Amend W3-S36/W2-S20 only those dependent rectangles; functional/style assertions otherwise retained. |
| Dispatch/versions: S17–S21,S30,S34,S36,S38,S102–S120,S122–S132,S143–S167,S225–S304; room/shared-editing/recovery/grouped-edits/comments/mentions/timer/voting units | Separate spotlight kinds before edit fallback. Add exact joined projection; preserve every edit/comment/timer/vote key, receipt, retry/order and bound. No spotlight refusal becomes a document refusal. |
| Presence relay/reconstruction: S94–S101,S276,S290; presence/shared-editing units, W3-S2/W3-S3/W3-S18–W3-S23/W3-S28/W3-S29, Y1-S28/Y1-S29 | Preserve stamp/palette, frame/selection bounds/rates/expiry, ordinary spatial values and preference. Tighten only current-presenter admission and spotlight attachment reconstruction. Keep running voting redaction/avatars/heartbeat; no old hidden frame replay. |
| Viewport/ordinary Follow: presence/recovery units; 0004-W1 S94–S115; 0004-W2 S116–S120/W2 follow rows; 0004-W3 W3-S6–W3-S17/W3-S19/W3-S22/W3-S23/W3-S35 | Preserve active-then-latest choose once, exact connection pin, fit/resize/floor, target-left/reset, cursor preference exception and every own-view leave route. New spotlight membership delegates at these seams. Manual Follow's label remains Following <name>; its white banner changes, not fitting/function. |
| People menu: W3-S1/W3-S4/W3-S5/W3-S24/W3-S31/W3-S36, W2 right-bar/Tab rows, Y1-S29, Z1-S1/Z1-S27/Z1-S28 | New menuitem after own identity, before first remote row; menuitem counts increase by one when enabled/present. Home=own row; first ArrowDown=Spotlight me or Stop spotlight, next=first enabled remote; End=cursor switch. Change old first-ArrowDown/Enter follow choreography by one step only. Toolbar avatar/overflow/chevron stops stay. From chevron/menu Tab once Timer and voting trigger, twice Share; reverse unchanged. Followed-target accessible action/visible word becomes Unfollow, role/title stays. Disabled reasons are named in interaction v37. |
| Follow banner/frame: W3-S6/W3-S32/W3-S35/W3-S36 and W2 banner/geometry rows | Replace old full-colour/600-weight/centred/fixed8/70/126px expectations with interaction v37's white/regular/accent/banner placement/wrapping values. Keep words Following <name>, Stop following, exact3px frame, solid2px ring/offset1, current-view retention and leave assertions. Recompute dependent geometry with stated tolerances; never weaken function to fit changed geometry. |
| Voting privacy: Y1-S28/Y1-S29 and S273–S277 | Keep all raw per-recipient/no-other-ballot and placeholder assertions. Follow remains disabled/stopped during running; menu action now also disabled with exact reason. Fresh presence after reveal cannot silently restore following/spotlight. Preserve existing Y1 functional checks; new ordered spotlight×vote races below. |
| Timer shell/focus/speech: Z1-S1–Z1-S29/Z1-S31–Z1-S36, off Z1-S30 and End/reconnect | Keep Timer and voting / Close Timer and voting, timer state/time trigger prefix and Voting in progress suffix, panel timer-first/New vote-for-editor/shared Close/Share traversal, title/cause/clock/confirmation/health/speech counts. No new toolbar or panel Tab stop. Scope existing timer collectors to their already-landed timer identity; do not change/filter messages or assertions. Spotlight uses its own node. |
| Recovery/lifecycle/storage: S41–S44,S47,S68–S71,S88–S89,S116,S121,S127,S133–S134,S139,S158–S160,S168–S169,S189–S194,S210,S213–S220,S224,S247–S253,S256,S288–S300,S303; history/lifecycle/import/removal/timer/voting units | Retain layout7/SQL16-table count, exact stores, backups/fingerprints/receipt/intent/denial/physical exclusions and distinct timer/voting persistence/reset rules. Add zero spotlight stored bytes and terminal deadline/key cleanup, never expand stored formats. |
| Module/local shell: modules units, A–J off |45→48 team modules;22 state hooks/App≤264/composition/import guards unchanged. A–J off uses only existing saved-time normalization, no new mask. Other unreached unit assertions stay; no unrelated browser/harness/load campaign. |

Accepted targeted 0004-W3 browser rows are W3-S1,W3-S4–W3-S17,W3-S19–W3-S24,
W3-S28,W3-S29,W3-S31,W3-S32,W3-S35,W3-S36, with their existing setup dependencies.
Do not run W3-S25's seven-pointer performance campaign. Existing tools
0004-w3, 0004-w2, 0007-w2 Y1 and 0007-w1 Z1 need only the named expected
controls/words/titles/Tab positions and dependent banner geometry changes above,
plus the explicit recovery wire code/reason expectations and fixture forwarding;
retain functional assertions. Keep baseline tools' appropriate original
expectations when classifying baseline failures, never apply new CSS to baseline
and call that a regression. Record each tool expectation amendment and rule.

## Server checks

0007-W2 ended at S304. New **S305–S355 (51)** in
tests/server/spotlight.test.ts run on **both Node and workerd**. Print
PASS:/FAIL: with each full S ID and SUMMARY-SPOTLIGHT. Use actual socket frames,
current authority, controlled clock/queue/close/expiry/reconstruction/restart
and real storage inventories, never screenshots as proof. Reapply process-local
controls after Node restart. State runner mechanism honestly; a browser reload
is not hibernation/process-restart proof. Existing Node-only S37/S43/S70/S168
physical exclusions remain, not passes. New common rows all run on both;
physical marked-volume detail in S344 is explicitly Node-only.

| ID | Required proof |
| --- | --- |
| S305 | Owner/editor/viewer each start/take_over/follow/leave/read; granted editor/viewer guests have effective rights, ungranted/outsider/removed/disabled receive no projection. Identity/connection/label/colour stamped, viewer still cannot edit. |
| S306 | One room singleton, simultaneous Starts at expected idle version in both orders yield one session and stale loser; current presenter duplicate Start never resets offers. |
| S307 | Competing take_over in both orders yields one new presenter/session; invalidate old offers/members/key, delayed old Stop/follow/resume cannot affect replacement. |
| S308 | Only current presenter connection Stop/Cancel; same account other tab/owner cannot Stop, may deliberately take over. Explicit Stop clears all state without departure cause. |
| S309 | Same-session repeat Stop, stale authority/control/session and duplicate delivery refuse atomically. Both runners: with M=Number.MAX_SAFE_INTEGER, otherwise-valid start/take_over/resume at current M−3 may advance to M−2; at M−2 or M−1 they refuse exactly spotlight_version_exhausted without invalidation/key rotation/retry. Seed valid active M−2, suspend to M−1, then force each Stop, committed voting Start, revocation/removal, grace expiry, lifecycle close and last leave to idle M with cleared key/membership/deadline. Accepted takeover ends its old session in its single replacement increment and reserves new headroom; refused takeover leaves it intact. Duplicate terminal callbacks do not increment idle. Exhausted idle cannot restart; no wrap or counter reset. |
| S310 | Independent followers at same control version both join; per-connection member version races follow/leave in both orders refuse stale member and delayed leave cannot undo later join. |
| S311 | Two tabs one follower person count once; independent leave/close removes count only after last membership. Presenter own-person tabs excluded/no auto-offer; no public roster. |
| S312 | Presenter gets0/waiting then1/2/0 with hasHadFollower retained; all other recipients get only own membership and presenter, no count or other's member version/key. |
| S313 | Held async admission serializes later command/read/close/vote; recheck rights/identity/versions after await and before transition/send. |
| S314 | Strict action-specific keys/types/UUID/versions; forged actor/role/person/colour/presenter/count/capability fields rejected; dedicated frames/refusals, not edit fallback. |
| S315 | Each read/success/publication/stale/refusal/join exact recipient projection whitelist; key only successful presenter start/take_over/resume result; no key/roster in peer/log/HTTP state. |
| S316 | Command/read1024 exact/1025 incl whitespace, response/projection4096 and outer1048576 limits; maximal valid escaping measured; no partial transition/protected denial data. |
| S317 | Separate mutation/read5-attempt rolling(t−1000,t] budgets; invalid recognized attempts count, sixth refuses, exact boundary expires, bounded arrays/no lifetime renewal. |
| S318 | Maximal descriptor/capability/member metadata≤1024, each rate budget≤1024/full attachment≤16384 including existing workshop/presence fields on both runners; no enlarged runner limit. |
| S319 | Fresh real presenter presence after Start required, placeholder not enough, active=false real view valid. Presenter cannot follow others; starting leaves manual Follow, choosing another person's manual Follow leaves spotlight without retargeting it. No extra coordinate channel, ordinary100ms/15s/10-per-second/12288/selection250 bounds retained. |
| S320 | Every presenter spatial relay checks current admission; held replay/role/lifecycle outage cannot send cached coordinates. Recover authority without replaying Start. |
| S321 | Presenter clean1000 close ends immediately; all eligible peers get left cause, views retained, no grace/key revival on return. |
| S322 | Presenter clean1001/tab/navigation leave likewise ends; best-effort Stop delivery absence does not break close correctness; explicit Stop has stop cause. |
| S323 | Presenter reload cannot resume without old page key; clean close ends, abnormal-looking reload expires within same bounded grace and new page cannot reclaim by session/account alone. |
| S324 | Original1006/error forwarded on both adapters before normalization; one suspend at detection, deadline+5000, repeated error/close cannot extend it. Nonterminal network/error only eligible. |
| S325 | At deadline−1 valid same-page key/current account/epoch/generation plus fresh admission/presence resumes same session on new connection/colour; key rotates, old key unusable. |
| S326 | At deadline or later resume refuses/end; grace cannot be prolonged by read/presence/key guessing or a different account/tab without capability. |
| S327 | Still-connected members resume after valid rebind/fresh view; still-connected leavers/decliners stay left, never pulled in. A follower reconnect/reload instead forgets old intent and gets a fresh full offer after admission; during grace wait for live fresh view. |
| S328 | Follower reconnect/reload clears old follow/offer/decline/dismiss intent; admitted current projection offers anew even for the same live session, with a fresh full countdown on the client. Read/join alone never follows. Offline leave/dismiss suppresses only stale old-connection replies, never the fresh offer; old connection leave/result cannot affect new membership. |
| S329 | Late join active gets current eligible session/no history replay; during grace waits; no offer to presenter's own other tab. |
| S330 | Presenter removal/disable/current effective access loss terminates before close/late send, no grace/projection/key, restoration never restarts. Test independently of old held-edit fixture. |
| S331 | Presenter owner/editor/viewer role/epoch change ends under4403/4409 despite continued presentation rights; new admission may start, old key never carries. |
| S332 | Presenter token expiry4401 and generation4423 bypass grace/end; stale token/epoch/generation resume cannot reclaim. |
| S333 | Follower removal/disable/expiry/epoch change removes membership/protected projection before late send; authorized fresh viewer may receive new offer; other followers continue. |
| S334 | Presenter presence expires at30000 on live socket: suspend then grace requires fresh presence+resume; expiry without resume ends. Follower presence expiry removes count; reads do not refresh liveness. |
| S335 | Everyone leaves, including last follower during presenter loss: no all-absent reservation/deadline, fresh arrival idle. Presenter alone with live socket may still wait indefinitely. |
| S336 | Actual DO live-socket reconstruction from server-written presenter attachment preserves session/key/control/member versions and derives current counts after strict admission; Node exercises equivalent attachment-validation guard. |
| S337 | Reconstruct with absent presenter during grace: idle/new authority, remove orphan follower metadata; stale/follower/corrupt/mismatched/voting-denied attachment never elects/revives presenter. |
| S338 | Actual Node process restart loses original sockets, reads idle/no SQLite restore; workerd common lost-socket room reconstruction also idle. Surviving original Room/connections keep live state. |
| S339 | Both runners, actual voting Start commit boundary: inject rejection/failure before commit and prove spotlight/session/key/membership/deadline unchanged. Separately commit Start then fail awaited stamp, subsequent authorization or reply delivery (including a vote_refused outcome): spotlight ended/keys/offers/membership/deadline invalidated in that same ordered transition before any post-commit await/spatial relay. Running voting/idle spotlight remain visible to authorized peers/readback, never rolled back or revived by post-commit failure. |
| S340 | Both orders of Start/take_over/follow/resume versus vote Start: room order wins, running refuses spotlight_voting. Leave/read safe/idle; stale client cannot bypass. |
| S341 | Running joined/relay/reconstructed attachments redact cursor/selection/view; reveal/reset fresh presence, no automatic spotlight/manual follow resume, timer independent. |
| S342 | Local preview leave/Stop command supported; actual history replacement/4423 ends spotlight before close, never restores historical spotlight; live timer/voting follow their own distinct rules. |
| S343 | Trash fence terminates/drains before close, held command cannot revive; restore starts none. Purge/discard disposes callbacks and other board remains intact. |
| S344 | Logical/marked-volume/Workers time recovery/pre-load/pending-history shortcuts terminate under fresh generation before serving; denial/intents/chunks preserved. Common guard both runners; real stopped marked Node-volume subcase identified separately. |
| S345 | Higher live generation/failed recovery/retry cannot revive descriptor/key/deadline; absence of stored spotlight survives ordinary and explicit storage reopen, no table/meta/journal change. |
| S346 | start/take_over/follow/leave/stop/resume/read activity leaves document canonical bytes/revision/edited-at/selection/Undo/Redo/history count/age/fingerprint/file/export/backup bytes identical on stable fixture. |
| S347 | Timer start/pause/extend/End/zero and spotlight lifecycle independent; waiting/following/Stop do not change voting state/ballots/results or timer persisted rows/title cause. |
| S348 | Board/account/connection/epoch/generation/authority old results ignored, terminal cleanup before held reply, new current admission never inherits lost follow intent. |
| S349 | Fresh strict socket admission outage remains503/no joined; read/command/publication/reconstructed-session source outage withholds protected state without partial transitions; new document recovery unchanged. |
| S350 | Read/snapshot does not join, renew presence/token or trigger global/control/member version changes; membership/counter traffic remains bounded at50 connections and discarded metadata does not accumulate. |
| S351 | Inject failure/terminal transition between admission and send/rebind/close; no partial key rotation/member/count/success, ordered terminal cleanup wins and no queued spotlight mutation replays. |
| S352 | Full event-table coverage receipt identifies each event and both runner mechanisms; independent focused grace/re-offer/revocation/expiry/generation cases reached even where older W2 rows fail; no baseline failure substitutes for proof. |
| S353 | Both runners with live presenter plus follower: drive actual BoardSession send throw, progress deadline, hosted offline and every other nonterminal retrying endAttempt/interrupt/reconnect path. Server receives4410/retry_recovery (never cleanup1000), enters one5000ms grace and same-tab fresh key/presence can rebind. Local deadline event remains4000/answer_deadline/send failure1006; document waiting IDs/bytes/order unchanged. Cover hosted finish's later cleanup and cause-aware terminal discard. |
| S354 | Both adapters: actual4410 and no-close-frame1006 (including missing-code fallback on Node) are grace-eligible; Worker1006 normalization cannot become clean policy. Explicit1000/1001/navigation/sign-out/leave/Stop ends without grace. Inject error then close in both orders; no grace extension, terminal4403/4423/4401/4409/revocation/lifecycle always wins and old key cannot resume. Capture code/reason reaching Room.closed, not only a mocked policy call. |
| S355 | Both runners: with M=Number.MAX_SAFE_INTEGER, otherwise-valid follow/internal resume-follow at current member M−3 advances to M−2. Explicit follow at nonfollowing M−2/M−1 and internal resume-follow at following M−2 refuse spotlight_version_exhausted; do not seed an invalid following M−1 record. Explicit refused follow unchanged; exhausted automatic resume-follow safely leaves to M−1/frozen view with exact recipient refusal, while other followers/presenter rebind succeed. Leave M−2→M−1 remains possible, then each session-end/takeover/committed-vote/revocation/grace-expiry/last-leave cleanup reaches M and clears active membership, retaining only its finalized version fence on any still-live connection. Duplicate cleanup no-ops, no wrap/reset within same live connection/session; fresh session UUID or fresh admitted connection resets0. Test stale delayed leave/result cannot undo later membership. |

## Browser checks

New scenario **P1-S1–P1-S50**:49 on checks, P1-S47 off only. P1 was unused in
existing public briefs/check tools when allocated; V names validation commands
and S names server checks. There is no prototype/tool. A fresh independent
check run writes its tool from these clauses/contract values; each row prints
its full ID/PASS:/FAIL: and SUMMARY, retaining raw receipts/failures/unrun rows.

Use three independently authenticated owner ana/editor ben/viewer mia contexts
from interaction v37's fixture, add a second ben tab and own ana tab only where
named. Use actual admitted sockets/controlled clocks and real events, never
painted successful DOM. New capability criteria also fail by name on independent
baseline e56e70e; setup abort/import error is separate. Snapshot/late-state
speech suppression must not make the negative control an empty run.
Save a real-state image for each first22 rows at1280×800/scale1, except21–22
at375×812; row19 saves the two real viewports separately. Review annotations,
insets and comparison crops never ship. Use ownText()/lookCheck() helpers for
exact words and only contract-stated styles. Derived positions±0.5 CSS px,
wrapped text heights±1px. Every base-top calculation includes visible hosted
banner/notice-column bottoms per v37; fixed example tops assume no lower notice.
P1-S21's351px width and P1-S40's approved width branches stay unchanged.
In existing rows inspect new button families at rest,
enabled hover, keyboard focus-visible, held pointer/key and disabled states;
no extra broad campaign. Scene frame/rings stay exact; do not shrink scene.

| ID | Scriptable behavior and expected result |
| --- | --- |
| P1-S1 | Owner opens existing People on this board; own identity first, Spotlight me next before remote rows/cursor switch, exact new row/menu styles. Existing avatars/save/Timer and voting/Share remain. Capture menu-owner. |
| P1-S2 | Viewer mia has same own-area Spotlight me, can start real session while View only/content editing denial remains; Stop spotlight reachable. Separately editor ben also starts/stops. Capture menu-viewer before start. |
| P1-S3 | Start real running vote, open people: Spotlight me and remote Follow disabled, visible Spotlight is unavailable while voting described by aria-describedby; actual local voting strip and trigger suffix Voting in progress, no extra badge. Capture menu-disabled. |
| P1-S4 | No follower acknowledged yet: Waiting for followers… directly followed by Cancel, no glyph; own-colour inset accent/frame/dashed ring, timer/Share unchanged. Cancel clears all peers silently apart from Spotlight stopped announcement. Capture presenter-waiting before Cancel. |
| P1-S5 | Three contexts: ana starts, ben/mia independently confirm following, presenter1 follower then2 followers/Stop; peers no numeric count/roster, own menu Stop spotlight and disabled remote actions/reason Stop presenting to follow someone. Capture presenter-followers. |
| P1-S6 | Both followers leave:0 followers/Stop, never returns to waiting, no new countdown; last current views retained. Capture presenter-zero. |
| P1-S7 | Visible real fresh-view offer Spotlight on ana. Following in 3… with Follow→Not now; no separator/frame/motion before confirmation. Controlled2999ms no follow request;3000ms one follow request, await acknowledgement then motion. Capture offer-countdown first. |
| P1-S8 | Native second-note textarea retains focus/caret/draft as offer arrives; Spotlight on ana/Follow/Not now without countdown or motion. Stay beyond3s, user finishes normally, then full3000ms window. Composition/active gesture disables Follow without cancelling draft. Capture offer-deferred. |
| P1-S9 | Confirmed Spotlight on ana/Stop following, single white banner/accent, exact scene3px frame and target2px solid ring; real ana cursor remains visible with cursor preference off outside voting. Move presenter, follower fits exact connection only. Capture following. |
| P1-S10 | Presenter selects second note normally; full real Sticky/context/Edit text/Medium and handles unchanged, banner top=context.bottom+12 derived, no control overlap, own selection never copied to followers. Capture presenter-selected. |
| P1-S11 | Not now then explicit Follow and later own pan: Spotlight on ana/Follow/×; dismiss accessible Dismiss spotlight offer hides session banner, no auto-offer on reads/count/view updates. Target avatar/menu Follow rejoins; followed action Unfollow ana, owner leaves. Capture left-rejoin before dismissal. |
| P1-S12 | ben Spotlight me takes over; old offers/key/memberships clear, ana displaced and mia each fresh3s offer Spotlight on ben. Following in 3…, last view held before join; late old Stop cannot stop ben. Capture takeover. |
| P1-S13 | Actually close presenter tab cleanly, no unload dependency: The presenter left the spotlight toast5s, no banner/frame/rings, follower view retained; return/new page idle. Explicit Stop gets no departure toast. Capture presenter-left. |
| P1-S14 | Real timer running02:14 and combined panel open while following; Timer then Voting/New vote, one Close Timer and voting, normal panel and banner fit side by side. Actual positions from v37, no hard-coded total height; timer actions do not leave, panel scroll doesn't move scene. Capture with-panel. |
| P1-S15 | Start voting while spotlight active/offered: all session UI/frame/rings/offers removed in same ordered transition; Spotlight me/Follow disabled with reason, placeholders only, no reveal resume; timer unchanged. Capture voting-start. |
| P1-S16 | Abnormally interrupt only presenter transport: live followers frozen, Presenter reconnecting…/enabled Stop following, frame suspended/target ring retained. Real same-page fresh admission/key/view within5000ms resumes same session, no repeated offer for connected members; still-connected leaver stays left. Capture presenter-reconnecting. |
| P1-S17 | Own follower transport/authority loss: Spotlight disconnected. Reconnecting… with local Stop following and ×, no active frame, Start/Follow/takeover disabled. Place banner below every visible hosted notice using v37's12px derived clearance. Separately hold actual mutation answer: Checking spotlight…, at2000ms one spotlight_read/no resend. Pure pre-snapshot controller Connecting spotlight… tested without fabricated partial joined. Capture client-uncertain and separate pending/initial receipts. |
| P1-S18 | No spotlight: ordinary avatar Follow ana renders Following ana/Stop following in new white banner/accent, exact retained frame/ring/cursor/fitting; leave keeps view and no spotlight membership request. Capture manual-follow. |
| P1-S19 |1280×800 presenter versus375×812 follower: fit centre/clamp .5 despite cropping; inverse narrow presenter/wide follower clamps at2 if needed; resize refits, panels don't change scene dimensions or save view. Save unequal-screens real views plus geometry receipt. |
| P1-S20 | Menu own identity→ArrowDown Spotlight me/Stop spotlight→remote rows→cursor switch, Home/End/reverse; Enter/Space activate. Menu Tab→Timer and voting→Share, Shift+Tab reverses. Banner Follow→Not now or Follow→Dismiss / Stop following / Cancel/Stop according to phase, reverse works. Focus3px purple/offset3, no trap. Capture focus-order. |
| P1-S21 |375×812 following: real two toolbar rows/one avatar+overflow, status own row/actions below, width351/left12/top=max bars/context+12, wrapped heights derived; no overlap, Share reachable, scene/frame retain inherited dimensions. Capture narrow-following. |
| P1-S22 |375×812 real240-wide timer/voting panel: left column under240, banner full351/top=panel.bottom+8 or larger base top, status/actions separate rows; close panel rederives from bars. Native controls reachable/scrollable, Share unchanged. Capture narrow-panel. |
| P1-S23 | Granted editor and viewer guest present/follow via real effective board grants; ungranted/removed/disabled/denied socket gets no projection/control. Viewer raw Stop for another presenter refuses spotlight_not_presenter; current viewer presenter can Stop. Hosted solo starts/waits/Cancel. |
| P1-S24 | Add second ben tab: ben+mia count2, both ben tabs still2; one ben leaves still2, last ben leaves1. Both ben tabs independent offers/joins; ana other tab no own-person auto-offer but deliberate takeover works. |
| P1-S25 | Separate sessions exercise Stop following, avatar Unfollow, menu Unfollow, Escape, wheel pan/zoom, zoom controls, navigation, Space/Pan drag, pinch/gesture; each leaves before own view action with last-followed view retained until own action, remote updates never leave. Choosing another person's manual Follow leaves spotlight without retargeting it; starting Spotlight me clears manual Follow, presenter remote Follow stays disabled. |
| P1-S26 | Selection/edit/draw/tool start leaves before normal operation; presenter can edit without stopping. Spotlight-only sequence leaves all selections/bytes/revision/edited-at/Undo/Redo/history/file/export/backup unchanged on stable fixture; deliberate edit separately has ordinary effects. |
| P1-S27 | Hidden tab, IME, drag/drawing/resize and genuine history preview never count down or move; after safe visible completion full window, fresh real presenter view required even active=false. Hidden elapsed time never fires on return. |
| P1-S28 | Close/leave/reload presenter cleanly using real navigation/reload events: no same-page key in new page/storage/URL, no automatic restart. If closure classified abnormal, only bounded grace then left ending. Test losing best-effort navigation send. |
| P1-S29 | Independent controlled presenter loss tests4999ms eligible versus5000ms expiry and key rotation/wrong account/epoch/generation/takeover/Stop rejection, no reliance on broken W2 setup. Expiry produces once-only presenter-left toast and frozen final view. |
| P1-S30 | Independent follower reconnect/reload and late arrival get fresh full3000ms offer, no silent follow; during presenter grace wait. Reload/reconnect forgets this tab's old follow/offer/decline/dismiss intent even for the same session. Offline leave/dismiss suppresses stale old-connection replies only and cannot suppress the fresh re-admission offer; exercise both a prior decline and an offline dismissal. |
| P1-S31 | Independent live presenter/follower revoke/disable/role-change fixtures reach spotlight assertions: old protected state/key/motion cleared before held frame; presenter ending bypasses grace, remaining authorized peers notified. Fresh allowed viewer uses new offer/new Start only. |
| P1-S32 | Independent token-expiry/presence-expiry and restore-generation4423 fixtures: presenter expiry/terminal generation ends; presence expiry alone enters bounded grace, expired follower removes membership. No old generation/key/result can reapply. |
| P1-S33 | Poll reads on join/reconnect/foreground/every15000ms, one outstanding read; drop answers,30000ms stale freezes/disables spotlight even timer independently healthy. Read failure never optimistic idle; fresh admitted snapshot recovers without mutation replay. |
| P1-S34 | Raw owner/editor/viewer wire: exact command/response/snapshot/refusal keys and per-recipient membership/count/key whitelist; capture outgoing presence and incoming state, redact auth/key secrets in retained evidence. Same-person other tab cannot claim Stop using session alone. |
| P1-S35 | Controlled concurrent starts/takeovers/current-member follow/leave and delayed old results have one winner/no silent retry. Pending2s readback only; held read older than current membership cannot revert it. Browser uncertainty exact words/styles, document pending edits unaffected. |
| P1-S36 | Real preview enters leave/Stop and Back to current board to present disables participation; return never restarts. Genuine document-history restore/4423 ends globally and no historical spotlight appears; timer/voting keep their declared policies. |
| P1-S37 | Actual Trash→restore and permitted logical recovery clear session/keys/deadlines before close/reset; no old callbacks revive. Runner reconstruction/process/discard details proved separately by S336–S345, not inferred from reload. |
| P1-S38 | One exact spotlight polite/atomic node separate from timer/voting/save, including closed panel. Observe started/offer/Following/Stopped following/stopped/reconnecting/reconnected/left once using exact v37 words. Initial/late/read/duplicate delivery silent; no view/tick/count messages and no duplicate toast speech. Exercise timer/voting speech in both directions to prove channel isolation. |
| P1-S39 | Escape menu closes to opener without leaving/stopping; panel/dialog/native editor/IME gets its own Escape before global handler. Outside them offer declines/follow leaves/presenter Cancel/Stop works. Incoming/remote changes never blur editor; disappearing local/remote banner control gets only specified fallback. |
| P1-S40 | Open people versus Timer and voting/Comments/History/Share handoff: one transient right surface, no spotlight end solely from opening, drafts/clocks preserved. At viewport widths≥600px derive content-hugging cap from400px/viewport−24px/left column reserving rectangle+8px, full width only below-panel fallback under240px; below600px width is always viewport−24px/status own row/actions below, including no panel. Calculate actual menu/panel/context rectangles and below-panel position under240px; all within viewport. |
| P1-S41 | New row and banner controls rest/hover/focus/held/disabled families exactly v37, primary hover wins generic menu hover, no latched aria-pressed/geometry change; long disconnected/name text wraps anywhere, no separator glyph, minimum hits/dismiss exact, internal overflow reachable. |
| P1-S42 | Vote privacy raw frames and modified spatial presence during running: no hidden coordinates/selection/cursor or follower path, avatars/preferences retained. Reveal only fresh presence/no auto-resume; timer start/pause/End/expiry never ends/starts spotlight. |
| P1-S43 | Real-server live reconstruction and lost-process snapshots agree with S336–S338: frontend accepts surviving session only after admitted projection/fresh view, lost presenter reads idle/no camera movement. Reconnecting follower always offered afresh. Label runner mechanism, no browser-only substitute. |
| P1-S44 | Stable saved fixture spotlight-only cycle including takeover/rebind/reads leaves export/file payload/digest/backup/document/history/Undo/Redo identical, no save-state/capture trigger. No key/offer/membership in local/session storage/IndexedDB/URL. |
| P1-S45 | Team-on local board exposes no spotlight control/controller/request/banner; hosted solo viewer can present with content still View only. No new menu item in unrelated Home/details/dialog/palette Tab arrays. |
| P1-S46 | Narrow open people menu and long name/uncertainty, real selected-object context and panel states across resize: derive every banner position/cap/height with v37 tolerances, no toolbar/Share/context/handle relocation. Explicitly exercise left-column just above/below240 with actual surfaces. |
| P1-S47 | Team-off sentinel only: no spotlight/team/workshop controller/DOM/request, no team imports in bundle, local save/keyboard/toolbar/title NextPhase Board unchanged. |
| P1-S48 | Legal maximum recognized requests, rate/size/refusal and stale/capability faults show dedicated spotlight state, never document refused-save recovery; both new unit/server capability and browser criteria fail by name on baseline, not a setup error. All lifetime cases mapped/reached independently of known W2 failures. |
| P1-S49 | With real owner presenter and editor/viewer followers, independently trigger send throw, ten-second progress deadline and browser offline/retry; wire close4410/reason retry_recovery must reach server, not cleanup1000. Freeze within5000ms grace, same-page key/fresh admission rebind resumes only still-connected eligible members; follower own reconnect fresh full offer. Separate explicit navigation/sign-out/Stop ends without grace; terminal4403/4423/4401/4409 overrides win. Preserve local4000/answer_deadline and document waiting IDs/counts/ordered recovery replay; never replay spotlight mutations. Capture actual frames and runner close receipt, not a fake disconnected DOM. |
| P1-S50 | Real view-only, reconnecting and retained loss-notice fixtures (independent of broken W2 rows), at900×700 and375×812: include final .team-banner/.team-notice-column/.team-loss-notice rectangles, including inherited132px/188px notice tops where applicable. Follow/spotlight banner top=max(bars/context,all visible notice bottoms)+12px±0.5px, then any greater below-panel top; notices retain own CSS/order/internal8px gap and remain uncovered/unmoved by spotlight layout. Wrapped heights±1px. Dismiss notice/resize/reconnect/context/panel changes recalculate without oscillation. Check manual Follow plus offer/following/own-uncertain phases; width351 below600px, desktop hug/cap and P1-S40 branches unchanged. |

## Acceptance criteria

- **0007-W3-AC01:** On an active hosted team board on either runner, a currently
  admitted effective owner/editor/viewer, including a guest admitted by an
  editor/viewer board grant, can start one spotlight from their current view.
  Verify each role, granted/ungranted guest and removed/denied access. Presenter
  identity/connection/colour is server-stamped. Expected-version takeover
  produces one presenter and a fresh offer; only the current presenter can
  Stop/Cancel. No presenter-follow or Ask to spotlight. Hosted solo works;
  local/team-off exposes no control/controller/request. Running voting and
  history preview disable the applicable controls. Controls, focus, rings and
  states match interaction v37's complete design requirements.
- **0007-W3-AC02:** Participants are offered the current spotlight and may decline
  or leave at any time. A visible actionable offer auto-follows after3,000 ms
  unless declined; Follow joins immediately when safe. Defer countdown/motion
  during native editing/composition/gesture/hidden tab/history preview and wait
  for a fresh real presenter view. Reuse exact-connection presence fitting,
  resize and .5–2 clamp. Stop following, avatar/menu Unfollow, existing Escape/
  own-view routes and content interactions leave, keep the last view and permit
  Follow or × dismissal without repeated offers on the same admitted connection;
  follower reload/reconnect instead forgets prior intent and gets a fresh full
  offer after admission. Prove three people/two followers,
  distinct-person multi-tab count, decline/rejoin and displaced-presenter offer.
  Spotlight-only work changes no document bytes/revision/edited-at, own or others'
  selection, Undo/Redo/history/file/export/backup content. Reject and end spotlight
  during a vote without leaking remote view/cursor/selection, never resume after
  reveal, and leave timer behaviour unchanged. Announce transitions once, never
  views/countdown/counts, and never steal editor focus.
- **0007-W3-AC03:** Prove presence v3's complete lifetime event table on both
  runners: clean tab close/board leave/reload and Stop end with specified UI/no
  return resume; abnormal presenter interruption freezes views for at most5,000 ms
  after detection and admits only same-tab/current-account/epoch/generation
  rebind, never after takeover/Stop/revocation/vote. Followers reconnect/reload
  and late join through a fresh full offer, forgetting prior decline/dismissal
  on re-admission. Removed/expired/role-changed people lose
  old protected state before late frames; revocation and lifecycle overrides
  bypass grace. DO hibernation reconstructs only a live admitted presenter's
  attachment; reconstruction with absent presenter ends grace. Node process/
  socket loss ends spotlight, with no SQLite restoration. Presence expiry,
  all-leave, history preview/4423, Trash/discard and explicit recovery follow the
  event table without restoring historical spotlight. Bounds/order/refusals,
  attachment limits, uncertain/no-replay states and independent0004-W2 edit
  recovery pass. Failure evidence distinguishes known baseline rows from new
  failures; it never substitutes a baseline failure for reconnect proof.

| Criterion | Evidence that shows it |
| --- | --- |
| 0007-W3-AC01 | S355; P1-S50; S305–S309; S313–S320; S339–S342; P1-S1–P1-S5; P1-S12; P1-S20; P1-S23–P1-S24; P1-S34–P1-S36; P1-S39–P1-S41; P1-S45–P1-S48; V4; V9; V11 |
| 0007-W3-AC02 | S355; P1-S49–P1-S50; S310–S320; S327–S329; S339–S342; S346–S348; P1-S5–P1-S27; P1-S30; P1-S34–P1-S44; P1-S46; V4; V9; V11–V13 |
| 0007-W3-AC03 | S353–S355; P1-S49–P1-S50; S309; S321–S345; S348–S352; P1-S13; P1-S16–P1-S17; P1-S28–P1-S39; P1-S42–P1-S44; P1-S48; V4; V9–V11; V13 |

## Applicable DESIGN.md guardrails

Canvas-first shell, native controls and visible focus, no colour-only authority,
minimum action hits, protected native editing, bounded overlays and independent
state owners apply. Interaction v37 states every new look/word/focus value;
never infer generic styling from action names. Preserve complete selection
chrome and inherited timer/voting contracts. No new sound, motion or font.

## Validation commands and expected evidence

Use pinned Node26.13.0/npm11.20.0 from repository root. Source validation is not
independent acceptance. Each check run restates **every V row it reruns** as its
own `PASS: Vn ...` / `FAIL: Vn ...` line with SHA/complete logs/counts. Failed,
invalid and unrun subchecks stay explicit; no inherited aggregate green result.

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

Copy off/on outputs aside before rebuilding. Independent e56e70e source/install/
build/stack for negative checks, never candidate artifacts/schema reused there.
After build, before browser check1, a fresh server-only run clean-clones candidate,
installs, creates a uniquely owned LOCAL Supabase project from committed config,
installs and reapplies schema, runs Node then workerd sequentially. No browsers,
baseline or design work there; return failures for fixes before browser checks.
Existing setup machinery:

```sh
node tests/server/make-signing-key.mjs
npx supabase start
node tests/server/write-stack-info.mjs
npm run test:server:node
npm run test:server:workerd
npx supabase stop --no-backup
```

Record actual schema install/reapply, ports/config/Auth restoration and cleanup;
no hosted schema/deploy or secrets in logs. Reuse exact-source server-only proof
for V11 if no server/SQL/room/shared-package change intervened, otherwise both
suites rerun. Record each long suite/scenario start/end and host Sleep/Wake
events; overlap is INVALID (host asleep), never product PASS/FAIL, and rerun awake.
Register all criterion-bearing logs in evidence, server logs as scenario S.
Check1 is full; fix rechecks always clean install/typecheck/builds/full unit,
failed/unrun checks, both servers for server/shared changes, own scenario for web
changes and accepted regressions reached by diff. Explain every skipped item;
retain earlier valid proof and do not repeat a successful negative control by
default. Three Safari checks from this milestone are chosen only at Review.

Independent scenario interface (tool written by the later check run):

```sh
node tools/browser-compare/0007-w3-check.mjs <served-on-origin> <P1-output> <local-stack-private-json>
node tools/browser-compare/0007-w3-check.mjs <baseline-on-origin> <P1-base-output> <baseline-stack-private-json> --negative
node tools/browser-compare/0007-w3-check.mjs <served-off-origin> <P1-off-output> <local-stack-private-json> --off
```

| Check | Command/inspection and pass condition |
| --- | --- |
| V1 | Byte-compare manifests/locks/dependency inventory/runtime notices against prerequisite base: unchanged/no new dependency. |
| V2 | npm ci --ignore-scripts --no-audit --no-fund exits0 on clean candidate and independent baseline. |
| V3 | npm run typecheck exits0 across all five workspace members. |
| V4 | npm test full suite exits0; focused workshop-spotlight units prove wire/rules/countdown/health/focus/leave/notice geometry/lifetime, control/member exhaustion and retry4410/reason versus clean close. Recovery units preserve local4000/answer_deadline/send-failure1006 and all document assertions. Guards48 team/22 state/App≤264/composition/import retained; only listed older expectations amended. |
| V5 | Team-off npm run build and npm run audit:licenses exit0; index.html/notices byte-identical to baseline off, meta has no team/Supabase/spotlight input. |
| V6 | npm run build:fixtures, team-on npm run build and audit:licenses exit0; index.html equals baseline on, notices equal runtime notices v3; preserve off output. |
| V7 | npm run build:server/audit:licenses and WRANGLER_SEND_METRICS=false npx wrangler deploy --dry-run --outdir <scratch> -c apps/server/wrangler.json exit0; no deploy. |
| V8 | Inspect all hunks plus git diff --name-status and git diff --check <prerequisite-base>..<validated-source>. Only deliverables1–4 and append-only Implementation record, including earlier fix-round record commits inside this range, are valid. Keep original prerequisite base; never move it to hide edits. A later record-inclusive tip is reported separately; record commits do not fail the allowed-file check. Contracts/indexes/requirements remain prerequisites. |
| V9 | P1-S1–P1-S46/P1-S48–P1-S50 on(49), P1-S47 off(1),22 state captures and raw/value/keyboard/speech receipts pass; S305–S355 reached on both runners, including4410/clean/terminal routing and membership exhaustion. Any unproved criterion case prevents PASS. |
| V10 | Once on independent e56e70e source/build/fresh stack, new spotlight unit/server/browser capability checks fail by name. Missing new module inside named dynamic-import assertion counts; top-level setup/import abort does not. Unchanged/off/boundary-only checks may pass. |
| V11 | Full npm run test:server:node then npm run test:server:workerd: S1–S50/S55–S355, existing workerd physical exclusions S37/S43/S70/S168 remain. All S305–S355 common, S344 physical subcase Node-only. No new failures, no unrun case called passed; reuse server-only proof only as above. |
| V12 | Accepted A–J team-off compare: baseline twice then candidate/diffs, existing saved-time normalization only; no new masks/layout/control/focus changes. |
| V13 | Accepted presence/shared-editing units/S94–S115, recovery units/S116–S120, removal coverage already in full suites; browser W2-S1–W2-S21, targeted W3 rows listed above, full Y1 on/off (including Y1-S28/Y1-S29), full Z1 on/off and End/reconnect. Amend only declared expectations, preserve functional assertions and classify every failure against e56e70e/source. Baseline-proven failure/unrun remains FAIL/partial, never aggregate PASS. |

Accepted additional-run allocations: full unit10–20s execution/1min reporting;
both servers23–28min after shared schema; A–J off3–4min; W2 browser7–10min;
targeted W3 follow/people/leave3–5min (low-confidence allocation); full Y1 5–7min;
Z1 including off/End-reconnect4–6min. Presence/shared-editing/recovery/removal
inspection is inside accepted suites, no extra removal runtime. Roughly45–60
active minutes with shared setup. No unrelated historical/harness/load/
performance/browser-matrix/assistive audit.

Known baseline failures: **W2-S7, W2-S8, W2-S9, W2-S16, W2-S20, W2-S21** fail
identically on baseline e56e70e and are tracked separately/outside this milestone.
Do not fix them here, silently skip them, mark passed or use them as reconnect
proof. Compare exact signatures/source, run baseline as needed to classify new
differences. P1/S focused cases independently prove grace/rebind, follower
re-offer, revocation, expiry and generation cleanup even if an older fixture
never reaches its assertion. Any new/changed failure or unproved W3 criterion
blocks acceptance until fixed/classified. Boundary hooks and independent
publication read remain required; this draft makes no runtime PASS claim.

## Review focus and public references

Review raw projection/key isolation, one ordered queue/current presenter relay,
original-close propagation, every recovery/pre-load path, bounds/maximal encoded
attachments and independent grace/revocation/expiry cases first. Verify content-
hugging banner/no glyph/specific CSS precedence/derived geometry, menu-first
Escape, native draft protection and separately identified once-only speech.
Retain unchanged timer/voting privacy/title/function and all older functional
assertions. Public source basis is main e56e70e and the linked versioned contracts,
read2026-11-10; no outside product is needed to implement this contract.

Remaining runtime uncertainty for implementation review: actual browser/adapter
error-versus-close ordering and wrapped notice remeasurement are not yet proved.
S353–S355/P1-S49–P1-S50 must demonstrate retry4410/retry_recovery versus clean
and terminal endings, membership leave/cleanup headroom, and notice-aware top
without layout feedback or changed notice positions. Keep the declared bounded
abnormal-close policy when no clean frame arrives; never infer a close cause
from an offline label. The approved below600px full-width rule remains in force.
No unresolved product decision is delegated to implementation.

## Exclusions and reasons

- Local boards/team-off spotlight; no shared room authority there.
- Ask to spotlight, presenter following someone else, several simultaneous
  spotlights or spotlight across several boards, a new facilitator role.
- Persistence across actual server restart or in storage, history/Trash
  restoration of a spotlight, recording or replay.
- Offline mutation queues/retries, new coordinate channel/smoothing, HTTP/
  roster endpoints, dependencies, hosted schema application or deployment.
- Repairs to separately tracked baseline W2 failures or unrelated campaigns.

## Implementation record

(Appended by the implementer.)

### Implementation handoff — 2026-11-10

- Branch: `codex/0007-W3-follow-a-facilitator-through-a-board`.
- Prerequisite base: `197d7c7f6653ab34870d287136befaa8acca7a17`.
- Validated source/test revision: `c92907ccd3d75f708d71aa9e22ec8388a5f3ece7`.
- Independent behavior baseline: `e56e70e96f9ad35d4ec666a3c32a88bb42f4e730`,
  extracted and installed separately; no candidate build output was reused.
- This append-only record is a separate documentation commit. Its final tip is
  reported separately in the handoff; it does not change the validated source.
- Read the brief, all ten linked contracts and the complete approved design
  inventory, including all22 images, before implementation. Presence v3 owns
  authority/lifetime/bounds and interaction v37 owns presentation.

Implemented dedicated room, neutral-wire and client/rules/presentation modules;
expected-version control and per-connection membership; distinct-person counts;
fresh-presence admission; fresh follower offers; same-page5000ms rebind/key
rotation; terminal overrides; live-attachment reconstruction; no durable
spotlight state; and notice-aware banner/menu/focus/speech integration. Existing
manual Follow/fitting/own-view seams and document recovery remain in use.
Retrying attempts close4410/`retry_recovery`; clean/terminal paths retain1000.
Both adapters forward original code/reason before normalization. Voting Start
ends spotlight synchronously after commit, before its first post-commit await.
Native/hidden/gesture safety freezes motion; voting retains the client controller
so a later fresh Start remains available. Equal fitted views retain their current
object instead of causing presence echoes between followers.

No dependencies, manifest/lock/inventory/notices, schema/storage-layout, build
scripts, application milestone outside0007-W3, or public requirements changed.
Added dependency versions/licenses: **none**. Existing exact versions/licenses
remain those in the committed dependency inventory. No merge/push/publication.

#### V1–V8 commands and receipts

Toolchain: Node26.13.0 and npm11.20.0. Scratch locations are deliberately
normalized below as `$W3_SCRATCH`; they are not repository deliverables. Both
web outputs were copied aside before the next build. Every listed process
completed with exit0. Final full-unit receipt is1062/1062, fail0/skip0.

| Row | Commands / inspection | Result and counts |
| --- | --- | --- |
| V1 | Byte-compare `git show 197d7c7:<path>` with each tracked package manifest, root lock and `docs/architecture/0001-dependency-*` / `0001-runtime-notices-*` file. | PASS;20/20 files byte-identical; added dependencies0. |
| V2 | `npm ci --ignore-scripts --no-audit --no-fund`, separately in clean candidate and independent baseline. | PASS;2/2 installs,118 packages each; candidate3s, baseline2s. |
| V3 | `npm run typecheck` | PASS;5/5 workspace members. |
| V4 | `npm test` | PASS;1062 passed,0 failed,0 skipped, including54/54 named P1-U01–P1-U54 checks. Existing recovery assertions and48-team/22-state/App composition/line/import guards pass. |
| V5 | Team-off build command below; `npm run audit:licenses`; compare off `index.html` and `THIRD_PARTY_NOTICES.txt` to independent baseline off; inspect `meta.json`. | PASS; build/audit2/2, byte comparisons2/2, team/Supabase/spotlight inputs0; off output preserved. |
| V6 | `npm run build:fixtures`; team-on build command below; `npm run audit:licenses`; compare on HTML/notices with baseline on and notices with runtime notices v3. | PASS; commands3/3, byte comparisons3/3; on/off outputs preserved separately. |
| V7 | `npm run build:server`; `npm run audit:licenses`; Worker dry-run command below. | PASS; commands3/3,2 server bundles with verified notices; dry-run exited without deploying. |
| V8 | Inspect every changed/new hunk; `git diff --name-status 197d7c7f6653ab34870d287136befaa8acca7a17..c92907ccd3d75f708d71aa9e22ec8388a5f3ece7`; same range with `git diff --check`; explicit brief allowlist and private-path checks. | PASS;33/33 allowed source/test files,7 new and26 modified; whitespace errors0/private-path matches0. This record adds only the brief append in its separate commit. |

Exact web build environments and dry-run invocation (scratch paths normalized):

```sh
BOARD_TEAM_FEATURES=off BOARD_SUPABASE_URL=http://127.0.0.1:55321 BOARD_SUPABASE_ANON_KEY=synthetic BOARD_SERVER_URL=http://127.0.0.1:8796 npm run build
BOARD_TEAM_FEATURES=on BOARD_SUPABASE_URL=http://127.0.0.1:55321 BOARD_SUPABASE_ANON_KEY=synthetic BOARD_SERVER_URL=http://127.0.0.1:8796 npm run build
WRANGLER_SEND_METRICS=false npx --no-install wrangler deploy --dry-run --outdir "$W3_SCRATCH/worker-dry-run" -c apps/server/wrangler.json
```

```text
PASS: V1 source=c92907ccd3d75f708d71aa9e22ec8388a5f3ece7 files=20 unchanged=20
PASS: V2 source=c92907ccd3d75f708d71aa9e22ec8388a5f3ece7 installs=2 packages=118 each
PASS: V3 source=c92907ccd3d75f708d71aa9e22ec8388a5f3ece7 workspaces=5
PASS: V4 source=c92907ccd3d75f708d71aa9e22ec8388a5f3ece7 pass=1062 fail=0 skip=0 spotlight=54
PASS: V5 source=c92907ccd3d75f708d71aa9e22ec8388a5f3ece7 comparisons=2 forbidden-inputs=0
PASS: V6 source=c92907ccd3d75f708d71aa9e22ec8388a5f3ece7 commands=3 comparisons=3
PASS: V7 source=c92907ccd3d75f708d71aa9e22ec8388a5f3ece7 commands=3 server-bundles=2 deployments=0
PASS: V8 source=c92907ccd3d75f708d71aa9e22ec8388a5f3ece7 allowed-files=33 whitespace-errors=0
```

Focused measurements: maximal escaped-label spotlight metadata959 bytes;
full attachment with250 selections and maximal workshop/rate arrays12889 bytes;
one maximal five-entry rate budget86 bytes. These remain below1024/16384/1024.
Units exercise control/member reserved headroom, forced terminal increments,
voting post-commit failure, zero stored spotlight bytes, source-outage retention,
fresh Start presence, foreground health, late Escape/authority replies and safe
motion. Pure geometry/source checks cover600px/240px/notice rules; they do not
prove actual browser rectangles, wrapped heights, focus or assistive speech.

#### Unrun checks and limits

V9–V13 are **unrun**, not passed. Browsers and Supabase CLI cannot start in this
sandbox. No schema install/reapply, live Node/workerd server suite, browser
comparison, P1 on/off journey,22 state capture, baseline new-capability negative,
Safari check or A–J/W2/W3/Y1/Z1 runtime campaign ran. S305–S355 are registered as
51 common checks in both runner configurations, with deterministic attachment,
counter, actual adapter-event/close-capture and voting-boundary controls; their
runtime result remains0/102 executed. New server/harness TypeScript files passed
syntax checks only. The server-only run and subsequent independent check must
establish those results on this exact source; registration is not acceptance.
The later check run still owns `tools/browser-compare/0007-w3-check.mjs`.

NB-108 W2-S7/S8/S9/S16/S20/S21 retain their separately classified baseline
failures; they were neither run nor repaired here and are not reconnect proof.
Existing Node-only physical exclusions S37/S43/S70/S168 remain separate. The
new S344 physical marked-volume subcase is Node-only and unrun.

No scope or requirements escalation. Tooling limitation: code-graph discovery/
indexing was unavailable under the sandbox approval policy, so file reads were
used. Normal public-boundary Git hooks passed. The source commit emitted a
nonfatal sandbox denial for Git's packed-ref maintenance lock; the commit,
branch reference and clean worktree were independently verified afterwards.

#### Changed-file inventory

Source/test commit (33 files):

```text
apps/server/src/start-node.ts
apps/server/src/worker-room.ts
apps/server/src/worker.ts
apps/web/src/state/use-presence.ts
apps/web/src/team/hosted-board.ts
apps/web/src/team/people.tsx
apps/web/src/team/presence-layer.tsx
apps/web/src/team/spotlight-layer.tsx
apps/web/src/team/spotlight-rules.ts
apps/web/src/team/spotlight.ts
apps/web/src/team/team-app.tsx
apps/web/style.css
packages/board-room/src/access.ts
packages/board-room/src/presence.ts
packages/board-room/src/protocol.ts
packages/board-room/src/room.ts
packages/board-room/src/spotlight.ts
packages/board-room/src/timer.ts
packages/board-room/src/voting.ts
packages/board-sync/src/session.ts
packages/board-sync/src/spotlight.ts
tests/README.md
tests/comments.test.mjs
tests/modules.test.mjs
tests/recovery.test.mjs
tests/removal.test.mjs
tests/server/driver-workerd.ts
tests/server/node-test.ts
tests/server/peer.ts
tests/server/spotlight.test.ts
tests/workshop-spotlight.test.mjs
vitest.node.config.ts
vitest.workerd.config.ts
```

Record-only commit: `docs/briefs/0007-W3-follow-a-facilitator-through-a-board.md`.
