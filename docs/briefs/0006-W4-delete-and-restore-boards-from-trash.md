BRIEF VERSION: 0006-W4 v1 (2026-11-07)
# 0006-W4 — Delete and restore boards from Trash

Status: Draft. Implementation has not started under this brief.

Contracts (eleven new files; never edit their prior versions):
[0006-board-lifecycle-v2](../architecture/0006-board-lifecycle-v2.md),
[0003-hosted-storage-v8](../architecture/0003-hosted-storage-v8.md),
[0003-hosted-persistence-v8](../architecture/0003-hosted-persistence-v8.md),
[0003-api-v8](../architecture/0003-api-v8.md),
[0003-access-v8](../architecture/0003-access-v8.md),
[0003-sync-v9](../architecture/0003-sync-v9.md),
[0003-self-host-runner-v4](../architecture/0003-self-host-runner-v4.md),
[0005-comments-v4](../architecture/0005-comments-v4.md),
[0001-interaction-v34](../architecture/0001-interaction-v34.md),
[0001-web-modules-v32](../architecture/0001-web-modules-v32.md),
[0001-document-v13](../architecture/0001-document-v13.md).
Unchanged: [identity v4](../architecture/0003-identity-v4.md),
[presence v1](../architecture/0004-presence-v1.md), [local storage v3](../architecture/0001-storage-v3.md),
[board file v2](../architecture/0006-board-file-v2.md),
[toolchain v5](../architecture/0001-toolchain-v5.md), [lock v5](../architecture/0001-dependency-lock-v5.json),
[inventory v5](../architecture/0001-dependency-inventory-v5.json),
[runtime notices v3](../architecture/0001-runtime-notices-v3.txt).
Use this set wherever an inherited contract links a replaced version. Current saved document
is 10; room layout remains 5. All requirements/checks concern current clients/protocol/formats.

## Outcome

The current workspace owner can confirm moving a board to workspace Trash, restore it strictly
before 30 elapsed days, or permanently delete it. Nobody opens a board while in Trash. Restore
returns the same board/link/workspace with current comments, current rights and still-valid
history; old mention notices and protected pending work do not return. Permanent deletion and
expiry deny first, retry serving-store cleanup durably, and retain a content-free deleted-ID/
generation register that prevents recovery from reviving it. No dependency is added.

## Read first and prerequisite contracts

Read [AGENTS.md](../../AGENTS.md), [CONTRIBUTING.md](../../CONTRIBUTING.md), [DESIGN.md](../../DESIGN.md)
and all eleven contracts. Lifecycle v2 owns ordered transitions/retention/races; API v8 owns
routes/shapes/status; persistence v8/access v8 own the three service tables/privileges and live
gates; runner v4 owns minute work/discard/recovery; sync v9 distinguishes 4403 from 4423;
comments v4 distinguishes notice removal from document-restore carry; document v13 distinguishes
same-board access restoration from historical replacement. Hosted storage v8/interaction v34/
modules v32 own the complete browser contract. Report conflicts before dependent work.

[0006-W3](0006-W3-manage-board-history.md) supplies active-board history;
[0005-W2](0005-W2-mention-participants-in-board-discussions.md) supplies mention/inbox rules;
[0003-W5](0003-W5-find-create-and-reopen-boards.md) supplies Home;
[0006-W1](0006-W1-export-and-restore-a-portable-board.md) supplies import/creation compensation.
Build directly from these contracts; prove storage/failure/race values as implementation proceeds.
No feature prototype or existing new-scenario tool is an input.

## Deliverables and boundaries

Baseline source for planning is main **1eee468ca36d88aae5aaa3fcbffaa01c896dba4b**. Implementation
starts from committed main containing this packet; record that actual prerequisite base.
New source files carry // SPDX-License-Identifier: Apache-2.0. Only these implementation files
may change, for the stated lifecycle work:

1. **Room/sync:** new `packages/board-room/src/lifecycle.ts`; existing files under that same src:
   `room.ts`, `interfaces.ts`, `protocol.ts`, `storage.ts`, `history.ts`, `backups.ts`, `access.ts`,
   `edit-session.ts`, `edits.ts`, `snapshots.ts`, `tickets.ts`, `copies.ts`, `comments.ts`, `mentions.ts`.
   Connect one ordered queue/admission/freeze/phase bridge, active gates before receipts/captures,
   complete discard, current-format recovery guards and removed delivery. No new room layout/table
   or document field. Existing `packages/board-sync/src/session.ts` only for the 4403 split:
   role-change fresh authorization/reconnect with drafts kept versus confirmed unavailability's
   terminal clearing/Home/no replay, plus distinct 4423 behaviour; current joined/edit envelopes remain unchanged.
2. **Server:** new `apps/server/src/lifecycle.ts`, `apps/server/src/routes/lifecycle.ts`;
   existing files under server src: `app.ts`, `runtime.ts`, `supabase.ts`, `start-node.ts`,
   `worker.ts`, `worker-room.ts`, `worker-runtime.ts`, `delivery.ts`, `cursor.ts`,
   `routes/boards.ts`, `routes/history.ts`, `routes/lists.ts`, `routes/access.ts`,
   `routes/access-lists.ts`, `routes/invitations.ts`, `routes/mentions.ts`, `routes/operator.ts`.
   Wire the six API v8 routes and all active/owner gates, bounded list cursors, minute discovery,
   restart/phase/discard/independent register checks. Existing `apps/server/supabase/nextphase_board.sql`
   adds exactly three service-only tables (16 total), transition/discovery/cleanup functions and
   existing role/RLS/list/copy/notice/access predicates. `apps/server/README.md` documents current
   schema, cleanup and logical/volume/time/SQL recovery sequencing and external-copy limits only.
3. **Web:** new `apps/web/src/team/lifecycle.ts`, `trash.tsx`, `lifecycle-rules.ts` (last two in
   that same team folder); existing team files `home.tsx`, `home-menu.tsx`, `home-card.tsx`,
   `home-lists.ts`, `home-rules.ts`, `team-app.tsx`, `pages.tsx`, `hosted-board.ts`, `history.ts`,
   `history-panel.tsx`, `notices.ts`, `notifications.tsx`, `notification-navigation.ts`,
   `comments/layer.tsx`, `comments/card.tsx`, `comments/panel.tsx`, `comments/rules.ts`.
   Existing `apps/web/src/team/links.ts` alone owns the bounded TeamLink/parseLink addition:
   {kind:"trash",workspace:string} for exact #/files/<lowercase-UUID>/trash; keep all existing
   Home/board/invitation/local parsing and reject malformed/extra URL components. Wire pages/
   team-app to that kind; do not duplicate the parser in Home. New unit and T1 coverage below.
   Owner-only entries, workspace Trash route/states, confirmation/request identity, current-access
   restore, generic ending and protected draft/inbox/late-response cleanup only.
   `apps/web/src/ui/board-panel.tsx` adds the owner-only Move entry;
   `apps/web/src/state/use-hosted-board.ts` and `use-storage-session.ts` (same state folder) connect
   confirmed-loss terminal reset/Home navigation, retaining role-change 4403 reconnect/drafts
   and 4423 draft retention. `apps/web/style.css`
   adds interaction v34's exact values; existing unrelated rules stay. App.tsx unchanged/≤264 lines;
   exactly 22 state-hook modules and 37 team modules, with no new import exception.
4. **Tests/test-only controls:** new `tests/board-lifecycle.test.mjs`, `tests/server/lifecycle.test.ts`.
   New unit tests cover lifecycle/cycle/clock/request/fence rules, bounded journal values, protected
   clearing and exact local-time/state helpers; add focused parseLink/TeamLink cases for the
   exact Trash URL, missing/malformed/uppercase IDs, trailing slash/query/extra segment, retaining
   all prior route meanings. Import affected modules inside named cases so absence
   on baseline fails by name. New server file implements S195–S224 on both runners, printing each
   PASS/FAIL and SUMMARY-LIFECYCLE. `vitest.node.config.ts`, `vitest.workerd.config.ts` include it.
   `tests/modules.test.mjs` adds exactly three team names and v32 expectations, keeps all guards.
   Existing unit files `tests/room.test.mjs`, `removal.test.mjs`, `comments.test.mjs`, `mentions.test.mjs`,
   `presence.test.mjs`, `team-import.test.mjs`, `board-history.test.mjs` (all in tests) may add only
   active lifecycle service stubs/current table-count expectations to existing fixtures.
   Existing server files `tests/server/suite.test.ts`, `shared.test.ts`, `lists.test.ts`,
   `removal.test.ts`, `mentions.test.ts`, `history.test.ts` (same folder) may add only active authority
   fixtures and update 13→16 table inventory, retaining their functional assertions.
   Existing `tests/server/setup.ts`, `node-test.ts`, `worker-test.ts`, `driver-node.ts`,
   `driver-workerd.ts` add only deterministic lifecycle SQL/fence/clock/phase/hold/failure/restart/
   discard/ledger-recovery controls required below. Existing Node marked-volume controls remain
   isolated. `tests/README.md` documents the new cases/summary/fixture changes. No unrelated
   port/domain/driver rewrite or removal of existing functional assertions.
5. **Record:** append only this brief's Implementation record. These eleven contracts, this brief's
   requirements and both indexes are committed prerequisites, not implementation edits.
   Record-only commits between fix rounds are allowed by V8.

Outside the named new controls, the existing screens' markup stays exactly as at the base.
Named additions are owner Move entries, workspace sidebar Trash rows/view, confirmations/states,
protected 4403 clearing and neutral restored confirmation/empty-history copy. Other Home menus, name/file/
selection/context/handles, history, Comments/inbox and local/team-off behaviour retain their
existing look and function. A–J permits existing saved-time normalization only, no new mask.
No package/manifests/lock/inventory/notices/build scripts/App.tsx changes. Configuration is
unchanged except `vitest.node.config.ts` and `vitest.workerd.config.ts`, solely to include
`tests/server/lifecycle.test.ts` as authorized in deliverable 4. No other
file is implicitly allowed: report a concrete missing file before expanding. Keep settings/ports/
credentials/output in scratch. No hosted schema application/deployment, real content or invitations.
The independent check run writes `tools/browser-compare/0006-w4-check.mjs` in check/private tooling,
not public implementation. Its bounded menu/sidebar/Tab and explicitly amended final-loss
ending expectations in the four existing tools below also remain in that tooling, not the
public source diff. No prototype patch is promoted.

## Server checks

W3 ended at S194. New **S195–S224**, 30 checks, execute on BOTH npm run test:server:node and
npm run test:server:workerd with independent synthetic accounts/boards. Use actual SQL rows,
canonical/wire bytes, fences, operation phases and request logs, not screenshots. A missing
runner-specific physical capability is not a pass; the common logical check still runs. After
Node restart reapply process-local test clock/failure/hold controls. Print every ID and summary.

| ID | Check |
| --- | --- |
| S195 | All six lifecycle routes: current owner succeeds; editor/viewer/creator/granted editor/viewer guest with identifiable current access gets 403 role_too_low/needed owner, outsider/disabled/missing/malformed/cross-workspace target generic 404, invalid bearer 401 first. Neither refusals nor failed lookups expose title/content/count/deadline or create rooms. Wrong keys/types/over-64-KiB bodies refuse as API v8; ownership repeats on retries. |
| S196 | Ordinary and imported creation atomically create active lifecycle authority; first lazy load checks it. Move never-opened board without manufacturing history; initialized board Move preserves its latest confirmed head and records server deletedAt/restoreBefore/cycle exactly once. Current active cycle required; state moves through moving→trashed only after confirmed phases. |
| S197 | Hold edits, saved/received receipt lookups, dependency waiting work, comments, captures and joins before the lifecycle fence; admit Move then release. No post-fence save/receipt success/application/capture, invalid old tickets, sockets 4403, cleared waiting. Separate active editor→viewer case still closes 4403 but fresh authorization/join succeeds with viewer rights; the close code alone never establishes deletion. Confirm actual document/history bytes/ordinals unchanged after the fence; no last-close checkpoint. |
| S198 | Hold accepted W3 restore in each durable intent/reserved/replaced phase. New Move returns 503 restore_pending before admission and preserves intent chunks. Complete restore, then retry Move successfully. Reverse order: after Move fence, held history restore/list/save/name/preview/accepted-receipt completion cannot mutate/expose/unlock, including after restart. |
| S199 | Moving/trashed/expired/restoring/purging/deleted IDs absent from ordinary lists/Recents/role/participants before paging/count; all ordinary protected content routes and all five history routes generic 404, tickets ticket_invalid; only the current-owner DELETE grant exception is permitted for retained unavailable states. Owner Trash/status alone returns exact permitted shapes, no expired preview/history. Seed 51 Trash rows to prove 50-row cursor paging/order/dedup, workspace isolation and no total disclosure; deleted/active receipts excluded. |
| S200 | In Trash reject automatic/manual/name/document restore; deletion's forced final close adds none. Retain current document/comments/grants/seen IDs and original history age/ordinal/cap/fingerprint/deadline. Expire/prune retained versions while unavailable, never renew; preserve newest-50 and fingerprint even after every version expires. |
| S201 | Move clears mention_targets, mention_pending, projected notices, leases/board delivery work behind higher fence while retaining comment text/historical ranges/delivered cutoff. Hold projection before admission and release after: no recreation/read-reset or cross-board effect. No participant/notification delivery while unavailable. |
| S202 | Inject failure before Move admission: proven move_failed and unchanged active state. Inject after durable moving fence, runner fencing/source clearing and projection clearing in turn; inspect durable identity/phase, denied access and pending result. Restart, reapply controls, retry same request/automatic tick to complete exactly once with original deadline, no false success/rollback. |
| S203 | Trash restore keeps exact board ID/link/workspace/current canonical document/revision, current comments and only unexpired history; generation strictly increases. Current membership/retained grants govern, revoked rights stay revoked; no clone, replacement or restore-only history capture. While trashed, revoke a retained guest grant through real DELETE /boards/:board/grants/:person as current owner: 200 with existing ID/removal shape only, SQL grant/access log/guest cleanup correct, no room/ticket/content/notice exposure. Hold the request while the service fixture demotes its owner to editor: former owner gets 403, outsider 404, invalid auth 401, outage 503; PUT remains denied. Serialize revoke versus restore in both orders, replay before active, and confirm revoked guest still denied after restoration; current fresh edits/comments work for permitted roles. |
| S204 | Restore admitted at restoreBefore−1 ms succeeds; at exact equality and +1 ms returns 409 trash_expired even with physical cleanup held. An already admitted restoring operation completes after equality; never re-admit or extend its deadline. Server elapsed time, not client locale/DST, decides. |
| S205 | Deterministically release restore-versus-expiry and restore-versus-owner-purge in both orders under locked admission. Exactly one transition wins; restore winner completes once, purge winner refuses restore forever. Repeated race after restart cannot produce active+deleted, new ID, two generations for one phase or renewed deadline. |
| S206 | Lose Move/Restore/Delete answers and retry identical request/path/body after restart. Same accepted operation advances once; changed body/operation gives request_id_reused; stale expectedCycle or old receipt in later Trash cycle gives lifecycle_changed. Repeat Move→Restore→Move, preserving distinct deadlines. Terminal purge uses register status without recreating journal. |
| S207 | Revoke/replace current owner in isolated service fixtures while confirmation/status/retry held; release after live change. Former owner gets role refusal/no Trash data or receipt, current owner can continue authorized work. Direct grants/creator/effective owner label alone cannot substitute for current workspace ownership; no product transfer feature. |
| S208 | Restore never recreates old read/unread/dismissed/evicted notices or pre-Trash pending delivery. Held older batches/leases stay fenced. Explicit fresh mention after opening restored board creates exactly one occurrence/notice; preserve old historical ranges as text. Active W3 document restore still carries current notices/read state. |
| S209 | Restore preserves original history ages/50 cap/fingerprint/persisted capture schedule. Restore alone adds zero; next overdue wake captures at most one genuinely changed head without interval backfill. Equal canonical head after all retained history expires adds none. Fresh changed edit then due checkpoint captures once. |
| S210 | Owner purge and expiry remove complete room-table inventory (including all four history tables/chunks/intents), SQLite/WAL/SHM or Durable Object storage/alarms/timers, any Board-managed copy and every board-specific SQL dependent row listed in lifecycle v2. After confirmed completion only deleted_board_ids board/workspace IDs and generation remain. No title/date/person/result/body retained. |
| S211 | Inject failure after purge denial, during drain/discard, after confirmed room removal, during dependent SQL cleanup and before final register/progress cleanup in turn. Restart each case; Deletion pending remains denied/content-free with durable phase; same request/status/tick retries to confirmed removal. Fail final SQL transaction: no partial marker/progress cleanup; no reinitialization between phases. |
| S212 | Never reopen an expired board. Minute discovery alone finds expiry and pending cleanup in 50-record batches, survives restart/downtime and drains all pages; relevant read/wake also schedules continuation. Equality blocks restore before tick. An overdue moving operation may be superseded only by automatic expiry under the same row lock, at a higher fence/same cycle; old Move retry reports purging/deleted, never reapplies; owner DELETE during overdue moving gets 503 lifecycle_pending and cannot supersede it. No physical completion-time promise; a tick failure keeps durable due work. |
| S213 | Node discard confirms closed DB and absent SQLite/WAL/SHM, cancelled per-room timer; Workers confirms deleteAll/absent rows and cancelled alarm. Hold queued/background callback before discard and release after; no storage/file/alarm recreation, capture or copied row. Both adapters drain/close sockets and remain denied. |
| S214 | Save current logical backup before Trash, complete purge, restart runner, attempt supported logical restore: register survives and blocks before room creation/write/intent replay. Repeat while trashed/purging. Active unrelated logical recovery still works; original history ages remain binding. Both runners execute. |
| S215 | Restore a saved runner state/time snapshot containing the deleted room/fence/accepted history intent; consult independent lifecycle/register before serving/replay, discard denied room and never revive notices/ID. Both runners execute their supported logical/time recovery guard; Node additionally executes marked-volume physical recovery with mark-restored-volume.mjs. Record that physical subcase as Node-only, never as a workerd pass. |
| S216 | Simulate SQL recovery from a pre-deletion copy: serving stays closed until latest independent deleted register and unresolved lifecycle ledger/phases/original deadlines are preserved/reapplied. Reapply, restart and verify deleted IDs stay denied, interrupted purge resumes, original Trash/history deadlines remain. Missing/unreadable ledger fails closed rather than inferring active. Both runner entry paths check it. |
| S217 | Hold copy_saved_board, ordinary/import initialization, invitations/access deliveries, projection and room rehydration before purge; release after completion. Register/lifecycle generation rejects every stale write/recreation. No deleted board row/grant/notice/room or revived accepted history result. |
| S218 | Inject authority/register/owner/checkpoint/fence read or write outages during lookup/transition/recovery. Return 503 (not empty/success/not_found) without granting cached access; denied state remains denied. Recover source, resume identical accepted operation, never lower any independent/room/directory/mention/lifecycle generation. |
| S219 | Persist maximal legal metadata/journal and 2,097,152-byte canonical history documents; measure raw version/intent chunks ≤1,048,576, history/lifecycle result UTF-8 ≤65,536 and every new complete encoded row <131,072 bytes. Over-limit journal/type/cursor rejects transaction without partial progress; no document/base64/identifier arrays in new journals. Register fields constant-size. Keep 16,777,216-byte backup aggregate refusal. |
| S220 | Small active current-format history-bearing backup/recovery after Trash restoration keeps original capture/deletion-cycle semantics and fingerprint; expired versions stay unavailable. Over-budget backup explicitly refuses. Do not infer any W3 supplemental runtime result from these new checks; compare actual baseline assertions if a failure predates W4. |
| S221 | Exactly 16 service tables with RLS; anon/authenticated cannot read/mutate/register/scan/call lifecycle functions. Fixed search paths/EXECUTE revocations verified. Existing roles/lists/projection/access functions enforce lifecycle; no frontend service key or customer data. |
| S222 | Concurrent same/different purge requests and expiry while purging all converge on one irreversible operation; fresh owner checks on status and retries. Content-free terminal GET/delete resolves register only for current owner of recorded workspace; outsiders/cross-workspace probes reveal nothing. No register removal or ID reuse. |
| S223 | Surround target with other boards/workspaces, memberships, grants/invitations, open rows/notices/read state and workspace-wide access history. Move/restore/purge changes only target-dependent rows. Actual table inventory demonstrates no orphan target rows and byte-identical unrelated records. |
| S224 | Restart at every nonterminal lifecycle state; restored room/history receipts/intents cannot bypass current lifecycle. Missing authority for known board returns service failure, missing/deleted unknown ID never initializes. Repeated failure/retry/recovery preserves the deleted-ID register and original deadline across both runners with no mixed active/deleted outcome. |

## Browser scenario T1

The fresh check session writes tools/browser-compare/0006-w4-check.mjs from these rows. Use real
app/server operations, deterministic clocks, HTTP/socket holds and phase-failure controls. Never
inject DOM/paint to simulate lifecycle. Fresh fixtures per row; user events via page APIs only.
Print PASS/FAIL per ID and SUMMARY-T1; preserve requests/results and computed-value receipts.
The declared visual fixture is interaction v34: ana owner, ben editor, mia viewer, lee granted
guest; Acme/Studio, five Home titles, three exact Rose stickies, current saved root/reply and
Unposted private draft. unposted. Server example now 2026-11-07T15:00:00Z; Launch plan deleted
2026-11-06T15:00:00Z/cutoff 2026-12-06T15:00:00Z; Team retro deleted 2026-10-08T15:00:00Z/cutoff
2026-11-07T15:00:00Z. Create older unexpired/expired history separately without painting rows.
Use en-US/America/Panama and the exact local formatter for fixture dates. Keep independent base
and candidate stacks; no mixed schema/room artifacts. T1-S30 alone runs team off.

| ID | Required actions and assertions |
| --- | --- |
| T1-S1 | Directly enter and reload exact #/files/<Acme>/trash, resolving the new TeamLink kind to Trash (not bad/local); malformed variants are rejected by focused unit coverage. Owner Recents card menu: exact seven entries in interaction v34 order, initially Open; final Move to trash… #a32940. Open board details with selected sticky: Move between Show version history and Close, existing context/handles/name at declared positions. Sidebar Acme→Trash for Acme→Studio→Trash for Studio before Boards in this browser, exact x/y/36px/padding/hover/selected values; no header Trash button. Click Acme Trash: #/files/<Acme>/trash, only its Trash row aria-current=page, focus Trash h2. |
| T1-S2 | Ben/mia/granted lee Home/details: no Move to trash… or Trash sidebar rows for workspaces not owned; retain all old controls. Direct authenticated lifecycle request gets API v8's role refusal/no metadata; outsider generic refusal. Never infer authority from card role. |
| T1-S3 | From owner card then details separately open Move to trash?; exact title/workspace, everyone-loses-access, 30-day/history and If moved now paragraphs; estimated local Dec 7, 2026, 10:00 AM EST at fixture now. Cancel focused, Tab Move to trash, Shift+Tab Cancel, trap both ways. Cancel and Escape each send no POST and return exact opener. |
| T1-S4 | Confirm real Move, hold response: Moving to Trash… / Wait for Board to confirm. Everyone’s access is ending. / disabled Moving…, dialog focused with 3px #7051cf/offset3, no Cancel/Escape. Complete phases, release response: card absent Recents/workspace, focus its sidebar Trash row; open real Trash shows server-confirmed times, never the estimate. |
| T1-S5 | Inject known pre-admission move_failed: Couldn’t move board / exact no-move/service paragraphs, error #a32940/#fdf0f2/#f2cdd5; Cancel then destructive Retry (#fff on #a32940, border #a32940; same hover), not purple. Verify board still accessible. Clear failure, explicit Retry identical requestId/expectedCycle succeeds once. |
| T1-S6 | Lose Move answer after durable fence; Move not confirmed plus exact two uncertainty sentences, amber #fff5da/#936000, Retry focused/no Cancel. Compare identical retry method/path/body, no second cycle/deadline. Required-service failure cannot show a false restored access/empty list. |
| T1-S7 | Owner Trash via sidebar: Trash/{workspace} · Trash and exact retention explanation; Launch plan Deleted Nov 6, 2026, 10:00 AM EST / Restore before Dec 6, 2026, 10:00 AM EST; actions Restore/Permanently delete…. Mixed expired Team retro note exactly Restore deadline passed. Deletion pending.; content-free compact purging row is 77px desktop with no continuation note. Rows align-items:center. After reload separately hold moving/restoring phases: exact Moving to trash… / Restoring… and Refresh status only, target Refresh focused, no destructive/retry/cancel control or title/date absent from owner-authorized list. Ignore status dates/stale disk data, refresh via GET/refetch only; no new POST/request ID. All pages read, no stale previous workspace rows. Assert CSS in interaction v34, not fixed date strings in source. |
| T1-S8 | Hold actual Trash GET: Loading Trash… focused, no old rows/empty heading. Release and show actual list. |
| T1-S9 | Successful real empty list: Trash is empty / Boards you move to Trash appear here.; state heading14px/21px/700 focused, no manufactured cards/count. |
| T1-S10 | Fail actual Trash GET 503: Couldn’t load Trash / Board’s server didn’t answer. No cached boards are shown. / Retry. Focus failed heading14px/21px/700/#a32940, next Tab Retry13px/19.5px/400/#79737f; clear injection, Retry GET shows real rows, not a repeated mutation. |
| T1-S11 | Revoke owner/change account/workspace while GET/status held, release old response: clear rows/title/dates/actions first. Show Trash is not available / Only the current workspace owner can open Trash. / Back to workspace, focus heading14px/21px/700 then button13px/19.5px/400/#79737f. No workspace chip or retention explanation/reserved space; desktop state x272/y136/w976/h176.5, heading y176, button y232.5/h40. Non-owner sidebar entry gone; no late paint. |
| T1-S12 | Hold physical expiry cleanup, set server now at Team retro deadline: Restore disabled/skipped, Restore deadline passed Nov 7, 2026, 10:00 AM EST and exact cannot-be-restored note; only Refresh status enabled. POST restore refuses even before tick. Once purge admitted, title/dates disappear into content-free pending row. |
| T1-S13 | Restore Launch plan through real button, hold reply: heading focused, disabled Restoring…, no navigation. Complete/release: #/files/<Acme>/trash stays, Launch plan · Board restored / Restored to Acme · Same board and link; exact success note, #fff background/1px #e9e7ed/#29272e (not amber). Open board focused; success note ends Some older versions may have expired. for retained and empty history alike; no restore-only version. Click Open board: original #/b/<id>, fresh access/session/current document/comments; refresh Trash removes temporary receipt. |
| T1-S14 | Inject proven pre-admission restore_failed: exact The board is still in Trash… sentence, Retry focused then Permanently delete…, still real Trash. Clear injection, same-request Retry restores once. No rollback claim for later failures. |
| T1-S15 | Lose restore answer after admission: exact Board has not confirmed the result… sentence, amber; Retry focused, Permanently delete… disabled/skipped. No automatic navigation/retry/success. Explicit identical Retry/status confirms current result once; owner loss denies receipt and clears row. |
| T1-S16 | At deadline−1 ms allow actual restore; separate fixture at equality refuses and renders expiry/pending, no Open board. Hold real restore versus expiry/purge admission in both orders and correlate with S205; UI only shows winning authoritative state, no restored success after purge. |
| T1-S17 | Reopen restored board: exact three original sticky texts/IDs and saved root/reply, unsent Unposted private draft. absent. One fixture preserves unexpired original history ages/order; another has all prior versions expired, shows No retained versions / Some older versions may have expired. Restoring access does not renew history. on return from that confirmed tab-memory receipt. Every restoration confirmation includes Some older versions may have expired. without classifying when expiry happened. Reopen later after versions expire while active: no assertion they expired during Trash; ordinary W3 empty states remain unchanged. No new joined field/expiry evidence or restoration-only entry. |
| T1-S18 | Before Move create read/unread notices, pending and dismissed occurrences; after Move/restore open recipient Notifications without opening discussion. Old references/previews absent; held projection cannot repaint; explicit fresh mention after restore notifies once. Match actual service rows, not only screenshots. |
| T1-S19 | In valid Trash row open Permanently delete?: exact two paragraphs including serving-store/external-copy limits, Cancel focused then Permanently delete. Cancel/Escape separately send no delete POST, return exact row opener with restored focus. |
| T1-S20 | Confirm delete, hold answer: Permanently deleting… / Access has ended. Wait for Board to confirm deletion. / disabled Deleting…, dialog focus/no Cancel/Escape. Lose answer after purge admission: content-free Deletion pending and exact progress sentence; Refresh status focused; no title/time/Restore/recover. GET refresh never sends new POST; service failure retains pending. |
| T1-S21 | Inject purge cleanup failure, restart server/reapply controls, fresh browser enters real Trash: compact 77px Deletion pending persists without the continuation note; explicit status opens the standalone result with that note. Clear failure, minute tick/status finishes; Board permanently deleted / Deletion is complete. This board cannot be restored. / Back to workspace13px/19.5px/400/#79737f, heading14px/21px/700 focused, state starts y217. Real rows/files/alarms agree with S211. |
| T1-S22 | Owner has real open board/unposted reply; from a separate owner Home tab open the target card menu, choose Move to trash… and confirm Move to trash. This uses Home's actual Move control; permanent deletion is a later Trash action, after sessions end. Observe 4403, immediate protected clearing and generic ending: This board is not available. / You may not have access, or it may no longer be available. / Returning to Home…. Focus h1 then #/files generic status; removed board card. No protected title/canvas/draft/history/inbox preview between ending and Home. |
| T1-S23 | Ben open collaborator board with unsent draft, ana moves it. Same generic ending/4403/Home as T1-S22, no deleter/deadline/reason or automatic resend/rejoin. Reopening after restore requires fresh explicit access; old draft absent. |
| T1-S24 | Open actual W3 historical preview and restore confirmation with protected draft, then Move from another tab. Same generic ending/Home, clear preview/title/history/dialog/Comments/draft/Undo/pending requests. Release held preview/restore responses: no paint or old send/receipt. |
| T1-S25 | Direct #/b/<trashed-or-deleted-id> as owner/member/outsider: generic This board is not available. and exact explanation/Back to files; no title/count/deadline/Trash cause. Heading focused then Tab Back to files; click reaches #/files. |
| T1-S26 | First change a connected active editor to viewer: observe 4403, pause sends, fresh ticket/join under viewer rights, same board/URL with drafts/ranges retained and no Home/terminal ending or auto-send. Hold fresh authorization with 503: paused/unconfirmed, no protected actions or false draft clearing. Then confirm final access loss/Trash via current-board authorization 404: clear drafts/protected state and terminally end/Home; old responses cannot reopen it. Preserve mentions.test.mjs M-U14 unchanged. Hold list/status/restore/history/rename/mention responses, change account/sign out/revoke, release in reverse order: only current authorized state paints, no stale success/title/draft/notice. Confirmed mutation plus failed refresh retries GET only. Match request logs. |
| T1-S27 | Page keyboard-only sequence: account→Notifications→Recents→each workspace plus owned Trash→Boards in this browser→Import board file…→New board; no header Trash stop. Valid row Restore→Permanently delete…; pending Refresh; failure heading→Retry; success Open board; dialog traps forward/reverse and skips disabled controls. Assert shared hover/pointer-held rules for neutral #f1eff5, primary #6142be and destructive #a32940, menu #f3f0f8 and existing sidebar states; no command toggle/extra pressed style, disabled .45/default cursor/no activation. Exact focus ring 3px #7051cf/offset3; no OS keys/new shortcut. |
| T1-S28 | At 375×812 sidebar160/content215/usable191, actual Trash row dates wrap and actions stack/full-width, padding12/gap12; heading gap8/explanation10. Lower expired/pending rows reachable by content scroll, sidebar owned Trash rows reachable, footer usable. No sidebar removal or history-panel redesign. |
| T1-S29 | Current local board/file/export has no Trash/Move/lifecycle HTTP, no history/comments/permissions in file; local saved records unchanged. Current active team export is document-only; unavailable export refuses. Preserve 4423 history restore draft retention and active toolbar rules. |
| T1-S30 | Separate team-off build: no lifecycle control/request/team/Supabase input; existing A–J markup/focus/local saved records equal baseline using only saved-time normalization. |

### Approved state comparisons

Reach each real state through the functional rows above, then compare all declared rectangles
within 0.5 CSS px plus exact words/colours/fonts/borders/spacing/focus from interaction v34.
Capture the named state in check scratch. The three rendering amendments are already included:
sidebar entry, neutral confirmation colours for success, Returning to Home…. Existing dynamic
relative comment ages may normalize; new absolute dates are asserted with Intl, never masked.

| ID | State / reach / explicit expected content and values |
| --- | --- |
| T1-S31 | home-owner, T1-S1: seven-item Recents menu, owner Move x304/y433/w194/h32/#a32940, all prior entries retained. |
| T1-S32 | details-owner, T1-S1: Move x31/y427/w250/h40, Close y479, panel h470, selected context/handles remain. |
| T1-S33 | home-trash-entry, T1-S1: sidebar Trash for Acme x12/y187/w215/h36 and Trash for Studio y267, hover #f1eff5/selected #f5f0ff/#7051cf/600; no header button. |
| T1-S34 | home-member, T1-S2: six existing editor card entries ending Show version history, no Move/Trash. |
| T1-S35 | details-member, T1-S2: existing h418 panel/Close y427, no lifecycle action, selection remains. |
| T1-S36 | move-confirm, T1-S3: Move to trash?, exact warning/estimate, 420px centred dialog/padding24, Cancel ring. |
| T1-S37 | moving, T1-S4: Moving to Trash…, exact ending-access sentence, disabled Moving…/.45, dialog ring. |
| T1-S38 | move-failed, T1-S5: Couldn’t move board, exact proven-no-move text, error note palette, Cancel focus; Retry white on #a32940/border #a32940 including hover, not purple. |
| T1-S39 | move-uncertain, T1-S6: Move not confirmed, exact same-request text, amber note, Retry focus. |
| T1-S40 | trash, T1-S7: exact explanation/three rows/local fixture times, row white/radius12/padding16/gap16/align-items:center, compact pending row77px/no continuation note, heading x272/y88. |
| T1-S41 | trash-empty, T1-S9: Trash is empty plus exact hint, in-flow centred state padding40/20/gap8, heading14px/21px/700 focus. |
| T1-S42 | trash-loading, T1-S8: Loading Trash… only, no rows/empty copy, heading14px/21px/700 focus. |
| T1-S43 | trash-failed, T1-S10: Couldn’t load Trash, exact no-cache hint; heading14px/21px/700/#a32940, Retry13px/19.5px/400/#79737f; state y217. |
| T1-S44 | trash-denied, T1-S11: Trash is not available, exact owner sentence/Back to workspace, no chip/explanation/protected rows; state x272/y136/w976/h176.5, heading14px/21px/700 at y176, button13px/19.5px/400/#79737f at y232.5/h40. |
| T1-S45 | trash-expired, T1-S12: Team retro original cutoff, disabled Restore/.45, Refresh status, exact cannot-be-restored amber note before purge transition. |
| T1-S46 | restoring, T1-S13: disabled Restoring… replaces actions, Trash heading focus; no premature success. |
| T1-S47 | restore-failed, T1-S14: exact still-in-Trash sentence, amber note, Retry focus then enabled delete. |
| T1-S48 | restore-uncertain, T1-S15: exact result-unknown sentence, amber note, focused Retry/disabled delete. |
| T1-S49 | restored, T1-S13: Launch plan · Board restored, exact same-link/success sentences, note #fff/#e9e7ed/#29272e ending Some older versions may have expired., Open board focus, same route. |
| T1-S50 | history-expired, T1-S17: No retained versions/Some older versions may have expired. Restoring access does not renew history. on confirmed Trash return in unchanged x972/y72/w296/h648 History panel. |
| T1-S51 | restored-open, T1-S17: actual original three stickies/root/reply and current Comments/card/pin geometry; no unsent draft replay. |
| T1-S52 | delete-confirm, T1-S19: Permanently delete?, exact irreversible/external-copy paragraphs, Cancel focus/destructive #a32940. |
| T1-S53 | deleting, T1-S20: Permanently deleting…/exact wait sentence/disabled Deleting…, dialog ring and content-free row behind. |
| T1-S54 | deletion-pending, T1-S20/T1-S21: standalone Deletion pending, exact two progress sentences including continuation note, Refresh status focus, no title/dates/restore; mixed-list variant omits that note and is 77px desktop. |
| T1-S55 | deleted, T1-S21: Board permanently deleted/exact completion hint/Back to workspace; heading14px/21px/700 focused, button13px/19.5px/400/#79737f, state y217. |
| T1-S56 | owner-ending, T1-S22: generic three elements including Returning to Home…, natural-height section centred, no protected UI. |
| T1-S57 | collaborator-ending, T1-S23: identical generic ending/values, no actor/reason or protected content. |
| T1-S58 | preview-ending, T1-S24: identical ending/values, no historical paint/dialog/draft. |
| T1-S59 | home-unavailable, T1-S22: generic This board is not available. toast/bottom24/#f3f0f8/1px #e1dce8, removed board. |
| T1-S60 | old-link, T1-S25: generic heading/explanation/Back to files, centred natural-height denied section, no disclosure. |
| T1-S61 | narrow-trash, T1-S28: 375×812/sidebar160/content215/usable191, exact local wrapped times/stacked actions and amended owner sidebar rows. |

## Existing regression-tool adjustments

Changes in existing check tooling are limited to the named controls/Tab positions and the
explicit final-loss ending amendments below. Preserve denial, clearing, socket and focus
assertions while replacing their obsolete persistent-dialog ending expectations; all other
functional assertions and existing textbox/ownText/aria-readonly/landing/menu corrections stay.
No public tool implementation or prototype is delivered here.

| Tool | Precisely allowed expectation change |
| --- | --- |
| tools/browser-compare/0006-w3-check.mjs (H1) | H1-S1/S2/S31/S32 owner details/menu includes final Move to trash…: details after Show version history/before Close; owner Recents seven entries. Non-owner arrays unchanged. Any Home sidebar traversal inserts Trash for {workspace} immediately after each owned row. History dialog/list/preview Tab order and capture/restore/notice assertions stay. Explicitly amend H1-S13 and H1-S50 for actual final access loss: arm focus/state capture before revoking the observed viewer's final membership/grant from a separate owner context; expect fresh board authorization 404, cleared canvas/title/history/palette/drafts and ignored held previews, then generic heading/explanation/Returning to Home… with h1 focus → automatic #/files/Recents and focused generic status notice. No persistent denied heading/focus or Back action is required for this already-open final-loss path. H1-S50 compares/captures both transient ending values and final Home, retaining the denied-state geometry/copy check at the transient stage. Keep no-repaint/access-refusal and closed/no-reopened board socket assertions; direct never-joined denied links still use Back to files. Do not assert another account lost access when only the viewer was revoked. |
| tools/browser-compare/0005-w2-check.mjs (C2) | Only a Home/sidebar or board-details inventory that traverses the added owner controls changes: insert Trash after each owned workspace and Move before Close details. C2 comment/picker/inbox/landing Tab positions are unchanged, especially target heading→Reply. Preserve all mention/read/lease/replay assertions and local/off controls. |
| tools/browser-compare/0003-w5-check.mjs (W5) | W5-S31 End/ArrowUp wraps to Move to trash… for owner, Show version history otherwise; owner Recents exact menu has seven entries. W5-S37 sidebar order adds Trash for each owned workspace immediately after it; same effect on W5-S41–S45 inventories. Full owner workspace fixture Acme/Lab/Studio order becomes account, Notifications, Recents, Acme, Trash for Acme, Lab, Trash for Lab, Studio, Trash for Studio, Boards in this browser, Import board file…, New board, Last modified, then cards. Recents omits Last modified. Explicitly amend W5-S24's final-loss ending: revoke the same open guest's final grant, observe 4403 and fresh board authorization 404, assert cleared protected UI/drafts and generic This board is not available. / You may not have access, or it may no longer be available. / Returning to Home… with h1 focus, then automatic #/files/Recents and focused generic status notice. Remove only the obsolete Access removed dialog/Close this board action expectation; preserve route/noSockets/zero open or connecting board sockets, final denial and no stale repaint. Initial direct-denied W5-S23 still uses Back to files. Existing Open/Home/rename/route/paging assertions otherwise stay. |
| tools/browser-compare/0006-w1-check.mjs (X1) | Owner sidebar inventory inserts owned Trash rows; Boards in this browser→Import board file…→New board remains adjacent. Import-into menu Acme/Studio and import/create/refusal/compensation assertions unchanged. Owner board-card/details inventories include Move only as above; do not change import/file expectations. |

Use role/name-qualified selectors for the existing workspace row when a broad sidebar selector
would now also match its Trash row's accessible name. This preserves the original route assertion;
it cannot skip it or silently select Trash. Menu dimensions may grow only by the specified added
separator/item; no new blanket screenshot mask. Record each changed control/Tab slot and the
three explicit final-loss ending amendments. Install focusin/state observation before revocation
to record the transient generic h1 and subsequent focused Home status; capture actual transition
values without a sleep that assumes the ending remains mounted. Do not add a product delay or
mask, remove denial/clearing/socket assertions, or require manual Close for automatic handoff.

## Numbered acceptance criteria

- **0006-W4-AC01:** Only current workspace owner confirms Move; cancellation changes nothing.
  Owner-only workspace-sidebar Trash, exact approved words/values/focus. Durable outside-room
  lifecycle/fence denies all ordinary/history/export/comment/participant/realtime access before
  further save/capture/receipt completion, invalidates tickets/4403/clears protected work. Keep
  current document/comments/grants/unexpired original-age history/fingerprint without deletion
  checkpoint. Remove delivery/notices. Record exact 2,592,000,000-ms deadline; interrupted Move
  remains denied/pending across restart and never discards an accepted pending W3 restore.
- **0006-W4-AC02:** Current owner restores only at server now < restoreBefore admission; one
  winner against expiry/purge, idempotent cycle-bound retries/current rights. Restore same ID/link/
  workspace/document/revision/current discussion/unexpired history at higher generation, no clone,
  old tickets/client work/notices or access rollback. No restore-only capture or age renewal/
  schedule backfill. Stay in Trash with exact Board restored confirmation palette and Open board.
- **0006-W4-AC03:** Owner permanent delete and expiry share durable irreversible deny-first
  cleanup of complete serving room/history/intent/discussion/notice/SQL/managed-copy inventory.
  Truthful content-free Deletion pending survives failure/restart, retries to confirmed completion;
  only content-free deleted-ID/generation register remains. Live access and every supported
  logical/volume/time/SQL recovery gate prevent revival, held-work replay or disclosure. Preserve
  401/403/404/503/ticket/4403 distinctions, 4423 document-restore behaviour, both runners and
  local/file/team-off boundaries. External-copy erasure is not promised.

| Criterion | Evidence that shows it |
| --- | --- |
| 0006-W4-AC01 | S195–S202; S207; S218; S221; S224; T1-S1–S12; T1-S22–S28; T1-S31–S45; T1-S56–S61; V4; V9 |
| 0006-W4-AC02 | S203–S209; S220; T1-S13–S18; T1-S26–S28; T1-S46–S51; V4; V9 |
| 0006-W4-AC03 | S195; S199; S205–S206; S210–S224; T1-S11–S12; T1-S16; T1-S18–S30; T1-S52–S61; V4; V9–V13 |

## Validation commands and expected evidence

From repository root, Node **26.13.0** / npm **11.20.0**:

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
npx wrangler deploy --dry-run --outdir <scratch folder> -c apps/server/wrangler.json
git diff --name-status <base>..<validated>
git diff --check <base>..<validated>
```

Copy apps/web/dist aside before each next build. Build base with its own clean install/source,
not candidate links. Ignored output/meta.json is not source. Fresh independent full-access check
owns disposable LOCAL candidate and baseline stacks, each using its own SQL schema and keys:

```sh
node tests/server/make-signing-key.mjs
npx supabase start
node tests/server/write-stack-info.mjs
npm run test:server:node
npm run test:server:workerd
npx supabase stop
```

No hosted schema application/deploy. Private local/Auth/service keys never enter logs/source/
evidence. The check run records actual commands/ports/output, preserving candidate/base artifacts.
From its tooling root, new scenario invocation shape (authored there, not available at drafting):

```sh
node tools/browser-compare/0006-w4-check.mjs <served-on-origin> <T1-output> <local-stack-private-json>
```

Repeat once on independent base origin/output/stack for negative control. A separate invocation
selects team-off T1-S30. Tool options may select rows/off/negative mode without changing meanings.
H1/C2/W5/X1/A–J invocations retain existing positional/options shape; record exact commands.

| Check | Pass condition |
| --- | --- |
| V1 | All package manifests/locks/dependency inventory/runtime notice bytes identical to base; zero new dependencies. |
| V2 | npm ci --ignore-scripts --no-audit --no-fund exits 0. |
| V3 | npm run typecheck exits 0 for all five workspace members. |
| V4 | Accepted full npm test exits 0; new tests/board-lifecycle.test.mjs passes, mentions.test.mjs M-U14 role-change reconnect/draft assertions unchanged, existing functional assertions retained with only deliverable 4's explicit active-authority/module/table-count fixture changes. |
| V5 | Off build/audit:licenses exit 0; index.html and THIRD_PARTY_NOTICES.txt byte-identical to independent base off; meta.json has no node_modules/@supabase/ or apps/web/src/team/ input. |
| V6 | build:fixtures/on build/audit:licenses exit 0; index.html equals base on; notices equal runtime notices v3. |
| V7 | build:server, Worker dry run and audit:licenses exit 0, no deployment. |
| V8 | Inspect git diff --name-status <base>..<validated> and every changed hunk: only deliverables 1–4 plus append-only Implementation record hunks in this brief. Earlier fix-round record-only commits inside that range are allowed and do not fail this check. No requirement/contract/index mutation. Record validated source/test revision separately from later record-inclusive branch tip; do not choose a later base to conceal earlier changes. git diff --check exits 0. |
| V9 | T1-S1–S29 and T1-S31–S61 pass team on, T1-S30 off; all 31 real state comparisons/exact amended values; both-runner S195–S224 evidence present. |
| V10 | Once on independently installed baseline source/stack, every new T1 behaviour/state row and new unit/server case fails by name for absent lifecycle capability; unchanged-boundary subassertions/T1-S29/S30 may pass. Distinguish real assertions from setup failures; an unchanged denial cannot make a new row pass. Keep actual evidence, never reuse candidate-schema SQL for baseline. |
| V11 | Accepted full server suites: Node S1–S50,S55–S224; workerd S1–S36,S38–S42,S44–S50,S55–S69,S71–S167,S169–S224. S37/S43/S70/S168 remain Node-only; S195–S224 common checks pass both, S215 physical marked-volume subcase Node-only. Summary fail 0; retain all original functional assertions. |
| V12 | Accepted A–J team-off comparison against baseline passes, no new mask, only existing saved-time normalization; markup/focus/canvas/local saved records unchanged. |
| V13 | Accepted history H1-S1–S29/H1-S31–S57 on, H1-S30 off; C2-S1–S29/C2-S31–S66 on, C2-S30 off; W5-S1–S39/W5-S41–S45 on, W5-S40 off; X1-S1–S25 on all pass. Permit only named menu/sidebar/Tab changes plus the explicit W5-S24 and H1-S13/S50 final-loss generic-ending→Home amendments above. Preserve fresh denial, clearing/no-repaint, transient h1→Home-status focus and socket assertions; all other functional assertions stay, including nonterminal role-change reconnect/draft retention. Classify each failure from actual baseline source/tests, never screenshots or presumed harness waivers. |

Implementer runs V1–V8 in workspace-write; browsers cannot start and Supabase CLI cannot run
there. Independent fresh full-access check repeats V1–V8 on clean clone, then V9–V13. Report
actual per-row outcomes/summaries and limitations. Accepted regressions are full unit, server
both runners, A–J off, H1, C2, W5 and X1 with exactly these ranges. No other campaign is authorized.
Safari's three milestone checks are selected at review under the workflow, not predetermined here.
Mandatory public-boundary hooks remain; source/record validation is not independent acceptance.

## Exclusions and reasons

- Local-board Trash, account/workspace erasure, ownership-transfer UI and a second recovery window.
- Historical exports/sharing/diff/branch/duplicate, new pictures/assets/routes or backup archive.
- Erasure of downloaded files/envelopes, operator-held offline copies or provider recovery copies.
- Document replacement/history capture solely to restore access, automatic reopening/resend, old notice replay.
- Distributed SQL/room atomicity, universal backup fit, physical purge latency/scale promises.
- Full prototype, hosted schema application/deployment, external messages/invitations, extra agents.
- Unaccepted browser matrices/interruption/C1/fixture sweeps, load/performance/native-input/screen-reader campaigns.

## Implementation record

(Appended by the implementer.)

### Implementation v1 — 2026-11-07

- Branch: `codex/0006-W4-delete-and-restore-boards-from-trash`.
- Actual committed prerequisite base: `cffffbdaf54d6286339a8ce3063775cfb2b820da`.
- Validated source/test revision: `9cd9c62610b3e7e52257b9857974822068e8d47e`.
  The later record-only tip is reported separately in the implementation handoff.
- Source scope: 58 files; lifecycle authority/routes/phase continuation, both runner
  adapters and independent metadata ledger, ordered room freeze/recovery gates,
  owner Trash/dialogs/sidebar, terminal protected clearing and current-format tests.
  No dependencies added. Only the two permitted Vitest includes change configuration.
  Saved document 10 / room layout 5, 22 state hooks and 37 team modules remain;
  `App.tsx`, all prerequisite contracts, indexes and dependency inputs are unchanged.

| Validation | Actual result |
| --- | --- |
| V1 | PASS. All 20 tracked manifest/lock/inventory/runtime-notice inputs equal the prerequisite base byte-for-byte; zero new dependencies. |
| V2 | PASS. `npm ci --ignore-scripts --no-audit --no-fund` exited 0 under Node 26.13.0 / npm 11.20.0, for the candidate and an independently extracted/installed prerequisite base. An initial shell selected another installed toolchain; PATH was corrected before validation. |
| V3 | PASS. `npm run typecheck` exited 0 for all five workspace members. |
| V4 | PASS. `npm test` exited 0: 923 tests, 923 passed, 0 failed/skipped. L-U01–L-U10 pass. Existing M-U14 reconnect/draft assertions are unchanged and pass; existing unit edits only add active-authority fixtures and the v32 module inventory. |
| V5 | PASS. Off build and license audit exited 0. Off `index.html` and `THIRD_PARTY_NOTICES.txt` equal the independently installed base; no team or Supabase bundle inputs. |
| V6 | PASS. Fixture build, on build and license audit exited 0. On `index.html` equals independent base; on notices equal base and runtime notices v3. |
| V7 | PASS. Node/Worker server build, license audit and Wrangler 4.156.0 deployment dry run exited 0. The dry run exited without deployment. |
| V8 | PASS. Inspected the complete base-to-validated changed-file list and implementation hunks; only deliverables 1–4 change. `git diff --check` on that exact committed range exits 0. This later append is the only record-inclusive difference. |

Validation commands (repository root, pinned toolchain):

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
git diff --name-status cffffbdaf54d6286339a8ce3063775cfb2b820da..9cd9c62610b3e7e52257b9857974822068e8d47e
git diff --check cffffbdaf54d6286339a8ce3063775cfb2b820da..9cd9c62610b3e7e52257b9857974822068e8d47e
```

The base was extracted with `git archive` at the exact prerequisite revision into
scratch and installed there without candidate dependency links. Off/on candidate
and base web artifacts were copied aside before replacement. Wrangler output/logs,
unit/typecheck logs, test-only adapter bundles and comparisons remain scratch output.
The new server test file and both test adapters also bundle successfully with the
existing esbuild; bundling is not server execution.

Byte-comparison receipts (SHA-256, identical candidate/base):

| Artifact | SHA-256 |
| --- | --- |
| Off index | `66f0d8d097b0c1b88dba01e2fe87c1233b576b3d0019e81401434a7f58a74c8e` |
| Off notices | `3367640f4a3b473755079ad41dc46c67bd65ed2dd21a0ca47edcd14944d3a91d` |
| On index | `9829ba305ce746513c6c6bcd3735b505123b2eecd96962d2573b3ef0a65886ee` |
| On notices / runtime notices v3 | `2c7ff36a2ae55948ac01928c713c7f203d1771198cfde411a845693750368c76` |

AS07–AS11 implementation evidence is bounded to source inspection, unit assertions
and the builds above: strict elapsed admission helpers, immutable retry/cycle state,
metadata-only bounded journals, original history fingerprint preservation across a
room fence, accepted-history-intent exclusion, discarded callbacks, resumed GET-only
rows, late-response invalidation and terminal request/document/draft clearing.
The independent journal validates nonnegative safe integers, refuses arrays, limits
UTF-8 to 65,536 bytes and checks the complete encoded row below 131,072 bytes. SQL
request constraints enforce journal and encoded-row bounds. Existing 1,048,576-byte
raw history/intent chunks, 2,097,152-byte canonical documents and 16,777,216-byte
backup refusal remain. Actual SQL maximal-row/chunk measurements and physical
both-runner proof are registered in S219/S210–S216, not claimed from these unit checks.

S195–S224 are registered on both runners, with individual PASS/FAIL and
`SUMMARY-LIFECYCLE` output when executed. They were **not run** here. V9–V13,
T1, its baseline negative control, both full server suites, browser state/value
comparisons and the accepted A–J/H1/C2/W5/X1 regressions remain for the fresh,
independent full-access check. No browser or Supabase CLI was started, no SQL schema
was applied and no deployment, external message, push or next milestone occurred.
No W3 supplemental runtime result is inferred. SQL/runner race, recovery and visual
acceptance remain unsettled until that check. SQL recovery requires the latest
independently preserved register and unresolved ledger to be reapplied before serving,
as documented in the server README; an older SQL copy cannot establish completeness.

Graph discovery/indexing tools were unavailable under the session's approval policy;
source inspection was the fallback. Both mandatory public-boundary commit hooks
passed. Git emitted a sandbox `packed-refs.lock` maintenance warning after the
source commit; the expected milestone ref, parent and source commit were verified.
No hook was bypassed and no unrelated files or checkpoints changed.

### Fix round 1 — SQL name resolution (2026-11-07)

- Branch: `codex/0006-W4-delete-and-restore-boards-from-trash`.
- Validated source/test revision: `baef687a87935066abd0ef0c403ce7c77e22e7cd`.
  This later implementation-record append is committed separately; the final tip
  is reported in the handoff.
- Independent check 1's V11 diagnostic identified the introduced installation
  failure: `lifecycle_recovery_request` compared UUID `r.operation_id` with the
  request table's text `operation` column instead of the UUID argument.
- `apps/server/supabase/nextphase_board.sql`: W4 function parameters are now
  function-qualified and local variables use `v_`. RPC signatures, argument names,
  argument types, defaults and server callers remain unchanged. No casts conceal
  the UUID/text error. No table, stored value, journal, runner limit, privilege or
  lifecycle transition changed.
- `tests/server/lifecycle.test.ts:S206`: added exact recovery-receipt assertions
  for a matching operation UUID, another board, an unknown operation UUID and the
  original UUID after a second operation on the same board. These assertions are
  registered on both runners, bundled successfully, and **not executed** here.

Audit covered every function added or changed since the prerequisite base (27):
`board_active`, `board_role`, `create_board`, `write_board_grant`,
`create_invitation`, `accept_invitation`, `record_board_open`, `copy_saved_board`,
`project_mentions`, `carry_board_mentions`, `mention_boards`, `lifecycle_value`,
`lifecycle_owner`, `admit_lifecycle`, `lifecycle_step`, `lifecycle_delivery_clear`,
`lifecycle_cleanup`, `lifecycle_due`, `lifecycle_tick`, `lifecycle_retry`,
`trash_page`, `revoke_unavailable_board_grant`, `lifecycle_recovery_request`,
`reapply_lifecycle`, `cleanup_recovered_deleted`, `lifecycle_request_status`,
`lifecycle_raise`. `mention_boards` has no parameters or locals and needed no edit.
Reviewed read/write table columns, aliases, INSERT/ON CONFLICT column lists and
UPDATE targets separately from value references. UUID comparisons use UUID
parameters/fields; operation/state/phase/digest comparisons use text; cycle,
generation, time and revision comparisons use bigint, with explicit JSON scalar
casts retained. Trash cursor tuples retain integer/bigint/UUID types. A scratch
source-token comparison confirmed that all function headers are unchanged and
body edits consist only of parameter qualification and local-variable renaming;
functions outside this audit set are byte-identical to the preceding tip.

**PostgreSQL proof: static audit only.** Attempted the permitted fresh cluster:

```sh
initdb -D .worktrees/w4-fix-1-pg/data -A trust --no-locale -U postgres
```

The installed Homebrew libpq 18.6_2 tool reported: `program "postgres" is needed
by initdb but was not found in the same directory`. No PostgreSQL server package
was present alongside it. The folder was verified ignored before the attempt and
removed afterward; its absence was checked. No cluster/server started, no auth
stubs were installed, and no schema parse, application or reapplication occurred.
Installation and reapplication therefore remain unproven pending independent
full-access verification. No Supabase CLI or browser was started.

| Validation | Fix-round result |
| --- | --- |
| V1 | PASS. All 20 manifest/lock/dependency-inventory/runtime-notice inputs equal `cffffbdaf54d6286339a8ce3063775cfb2b820da`; zero new dependencies. |
| V2 | PASS. `npm ci --ignore-scripts --no-audit --no-fund` exits 0 for candidate and freshly archived independent base; Node 26.13.0, npm 11.20.0. |
| V3 | PASS. `npm run typecheck` exits 0 for all five workspaces. |
| V4 | PASS. `npm test` exits 0: 923 passed, zero failed/skipped. No unit assertions changed this round. |
| V5 | PASS. Off build and license audit exit 0; index/notices equal independent base; meta inputs contain neither team source nor Supabase packages. |
| V6 | PASS. Fixture build, on build and license audit exit 0; on index/notices equal independent base and notices equal runtime notices v3. |
| V7 | PASS. Server build, license audit and Wrangler 4.156.0 Worker dry run exit 0 without deployment. |
| V8 | PASS. Complete prerequisite-base-to-validated revision remains within the permitted 59 files and append-only prior implementation record. This round changes only the SQL schema and S206; signatures and unrelated functions remain unchanged. Exact committed-range `git diff --check` exits 0. |

Commands ran from the repository root with the pinned toolchain; the same web
build variables were used in the fresh independent `git archive` base, installed
without candidate dependency links:

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
WRANGLER_SEND_METRICS=false WRANGLER_LOG_PATH=<scratch-log> npx wrangler deploy --dry-run --outdir <scratch> -c apps/server/wrangler.json
node_modules/.bin/esbuild tests/server/lifecycle.test.ts --bundle --platform=node --external:board-test-driver --external:vitest --outfile=<scratch>/lifecycle-test.cjs
git diff --name-status cffffbdaf54d6286339a8ce3063775cfb2b820da..baef687a87935066abd0ef0c403ce7c77e22e7cd
git diff --check cffffbdaf54d6286339a8ce3063775cfb2b820da..baef687a87935066abd0ef0c403ce7c77e22e7cd
```

Fresh artifact comparisons reproduced the four SHA-256 receipts above exactly:
off index `66f0d8d097b0c1b88dba01e2fe87c1233b576b3d0019e81401434a7f58a74c8e`,
off notices `3367640f4a3b473755079ad41dc46c67bd65ed2dd21a0ca47edcd14944d3a91d`,
on index `9829ba305ce746513c6c6bcd3735b505123b2eecd96962d2573b3ef0a65886ee`,
on notices `2c7ff36a2ae55948ac01928c713c7f203d1771198cfde411a845693750368c76`.

V9–V13, both full server suites, new S206 assertions, T1, the negative control,
accepted regressions and SQL runtime behavior were not run or claimed passed.
There was no deployment, push, external message, checkpoint edit or next milestone.
Both mandatory source-commit boundary hooks passed; Git again emitted the sandbox
`packed-refs.lock` maintenance warning after creating the expected commit.

### Fix round 2 — cleanup, focus and regression boundaries (2026-11-07)

- Branch: `codex/0006-W4-delete-and-restore-boards-from-trash`.
- Validated source/test revision: `6c6ffed65c721bd2e451b70af52321e7e9244417`.
  The record append is a separate later commit; its tip is reported in the handoff.
- Scope this round: twelve source/test files; no new dependencies, stored fields,
  journals, formats, module files or runner limits. The complete prerequisite-base
  range now touches 60 permitted files including this append-only brief.
- Read independent check 2's failure table, both full server logs/failure traces,
  eviction retry, final T1 results and both X1 setup traces. Its successful schema
  install/reapply and both-runner S206 result describe the preceding revision;
  they are not fresh proof for this revision.

Findings, changes and remaining limits, in requested order:

1. **Older server checks — partially resolved, not claimed closed.**
   S74 directly bulk-inserts directory rows, bypassing the RPC-only lifecycle
   insertion. `nextphase_board.initialize_board_lifecycle` now creates initial
   authority in an AFTER INSERT trigger in the same transaction. `create_board`
   relies on that trigger. No missing authority is inferred active on lookup, no
   backfill occurs, and deleted markers reject insertion. S216's deliberate SQL
   rewind fixture tolerates the trigger's identical initial row with ON CONFLICT
   DO NOTHING; its denial/recovery assertions are unchanged.
   S33's immediate snapshot inspection could overtake the close callback's new
   asynchronous authority checks. `tests/server/node-test.ts` row reads and
   `driver-workerd.ts:rows` now join the room's ordered queue, retaining every S33
   chunk/count assertion. This addresses the S38/S41 fixture cascade, but does not
   prove their later offline assertions.
   S44's fence-file read failed first in the new ledger guard and lost the prior
   `room_locked` classification. `startNode` classifies that file-read failure,
   and `RoomLifecycle.active` preserves it while still denying access. Late Node
   close-callback failures are caught rather than left unhandled.
   A focused actual Node HTTP run with a controlled database source returned
   `503 room_locked` with the fence file unreadable, then 200 for that board and a
   fresh board after permissions were restored; its temporary SQLite files and
   server were removed. This does not reproduce the independent suite's unexplained
   S45/S46/S47/S50 failures. Their underlying cause remains unsettled here.

   **Contract conflict remains:** S40/S41/S42/S43/S70/S71 take the entire SQL proxy
   offline while expecting cached joins/content or protected recovery. Lifecycle v2
   requires Supabase authority and the independent fence to be read, and sync v9
   explicitly says an unavailable required service cannot authorize a cached join
   or save. No product fallback or older assertion was weakened to conceal this
   conflict. Those expectations need maintainer adjudication; no such authorization
   was received in this run. Real SQL/server reproduction for item 1 remains for
   the next independent check; the Supabase CLI cannot start here.

2. **S192/S193 fixture inventory:** changed only their service-table expectations
   and reported inventory count from 13 to 16 in `tests/server/history.test.ts`.
   There was no separate service-table name list in these checks to amend. Room
   table inventory, size limits, privilege assertions and carry assertions remain.
   Both-runner runtime proof remains for the next check; Supabase CLI unavailable.

3. **S204 token fixture:** `fresh(at)` can mint at the controlled server time;
   S204 refreshes after advancing to the second restore deadline, approximately
   60 days ahead. The equality/plus-one assertions still require 409 trash_expired.
   Both-runner runtime proof remains for the next check; Supabase CLI unavailable.

4. **Worker drain/eviction and scheduled completion:**
   `workerRuntime.removeRoom` did not consume the internal discard response body,
   including failure bodies, leaving an active request reference. It now drains
   the body before returning or throwing; the ledger response is drained too.
   `WorkerRoom.webSocketMessage` drops late messages after discard without reading
   metadata or recreating storage, and closes failed callbacks without an uncaught
   promise. The S212 scheduler adapter called the async test handler without
   awaiting the point where it registers waitUntil; `driver-workerd.ts:control`
   now awaits that handler and then its execution context. Production scheduled
   handling already registers waitUntil synchronously and was unchanged.
   Exact body-reference and late-callback unit regressions each failed before
   their fix and passed after. Actual S211/S212/S224 eviction/expiry proof remains
   for the next independent check; no Supabase CLI or full workerd suite ran here.

5. **T1-S19 focus:** `BoardLifecycle.cancel` used to focus synchronously while the
   modal was still mounted. It now records a one-shot return action;
   `LifecycleDialog` performs it in an effect after modal unmount and parent layout
   focus. Controller invalidation cancels the deferred action. The focused unit
   failed before and passed after; actual dialog focus/trap/Escape proof remains
   for the next check because browsers cannot start here.

6. **X1 setup — diagnosis narrowed, production behavior unchanged.**
   `BoardSession.join` resolves at joined; comment requires commentsReady, which
   becomes true only at comments_snapshot done. W4 adds an asynchronous lifecycle
   lookup in `Room.load` before connected publication, changing frame timing.
   A controlled split-frame replay against both the independently installed
   prerequisite base and candidate produced exactly `join_required`, zero outgoing
   frames before snapshot done, then `saved`, one frame after done. This proves
   that API readiness gap exists in both revisions. It does not establish that
   the supplied X1 run actually returned join_required: those traces did not record
   the return value. The proposed next-check diagnostic is to record that value,
   await commentsReady, then create the explicit setup comment. No private X1 tool,
   snapshot guard, automatic resend rule or join API was changed. Actual X1 cause
   and all 25 cases remain unsettled; browsers/Supabase CLI cannot start here.

7. **T1-S40 ordering:** API v8 requires pending rows first by boardId, then trashed
   rows by deletedAt descending/boardId ascending. A compact pending first row is
   therefore correct; its 77px versus a trashed row's 99px does not justify changing
   layout to match a pending-last mockup fixture. A separate product defect did
   exist: `trash_page` sorted pending rows by their retained deletion time before
   boardId. Its sort and cursor predicate now use a zero time key for pending rows.
   S199 adds 51 pending rows with conflicting time/ID ordering and asserts exact
   page continuation. That SQL/HTTP regression is registered, bundled and unrun;
   runtime list/geometry proof remains for the next check because Supabase CLI and
   browsers cannot start here. T1-S31 geometry and C2 cleanup were left unchanged.

Validation ran under Node 26.13.0 / npm 11.20.0:

| Validation | Fix-round result |
| --- | --- |
| V1 | PASS. All 20 manifest/lock/inventory/runtime-notice inputs equal the prerequisite base; zero new dependencies. |
| V2 | PASS. Candidate and fresh independent base npm ci --ignore-scripts --no-audit --no-fund exit 0. |
| V3 | PASS. npm run typecheck exits 0 for all five workspace members. |
| V4 | PASS. npm test exits 0: 926 passed, zero failed/skipped, including three added focused regressions. Existing M-U14 is unchanged this round. |
| V5 | PASS. Off build/license audit exit 0, index/notices equal independent base, no Supabase/team bundle inputs. |
| V6 | PASS. Fixture/on builds/license audit exit 0; on index/notices equal independent base, notices equal runtime notices v3. |
| V7 | PASS. Server build/license audit and Wrangler 4.156.0 Worker dry run exit 0 without deployment. |
| V8 | PASS. Inspected full prerequisite-base-to-source changed-file list and fix hunks; all 60 files are permitted and prior brief changes append-only. Exact committed-range diff --check exits 0. |

The V2–V7 commands and synthetic off/on build variables are the same as in fix
round 1, rerun rather than inferred. A fresh `git archive` of
`cffffbdaf54d6286339a8ce3063775cfb2b820da` was independently installed and built.
The four artifact SHA-256 comparisons reproduce the exact receipts above.
Additional commands/evidence:

```sh
node --test --test-name-pattern='Worker purge consumes' tests/board-lifecycle.test.mjs
node --test --test-name-pattern='Worker discarded' tests/board-lifecycle.test.mjs
node --test --test-name-pattern='lifecycle Cancel' tests/board-lifecycle.test.mjs
node <scratch>/comment-readiness.mjs <candidate-root>
node <scratch>/comment-readiness.mjs <independent-base-root>
node <scratch>/fence-recovery.mjs <candidate-root>
node_modules/.bin/esbuild tests/server/lifecycle.test.ts tests/server/history.test.ts tests/server/node-test.ts tests/server/worker-test.ts tests/server/driver-workerd.ts --bundle --format=esm --platform=node --external:board-test-driver --external:vitest --external:cloudflare:test --outdir=<scratch>/test-bundles
git diff --name-status cffffbdaf54d6286339a8ce3063775cfb2b820da..6c6ffed65c721bd2e451b70af52321e7e9244417
git diff --check cffffbdaf54d6286339a8ce3063775cfb2b820da..6c6ffed65c721bd2e451b70af52321e7e9244417
```

Each of the three focused tests was run red before the corresponding product fix
and green after; the final full unit run includes all three. An initial extra
server-adapter bundling command omitted format=esm and failed on existing top-level
await; the corrected command above exits 0 for all five entries. Bundling is not
server execution. SQL edits were statically reviewed: the new trigger has no
parameters/locals and uses NEW-qualified fields; existing function-qualified
parameters and explicit bigint/UUID comparisons remain. No schema was applied or
reapplied in this round. No full server suite, browser, Supabase CLI, V9–V13,
negative-control acceptance run or accepted browser regression suite ran here.
The unresolved item 1 cases and item 6 diagnosis mean this record is **not** a
claim that every requested round-2 finding is closed. Both mandatory source commit
hooks passed; the same sandbox packed-refs.lock maintenance warning followed a
successful commit. No push, deployment, external message, checkpoint edit or
next milestone occurred.

### Fix round 3 — fail-closed decision and recovery inspection (2026-11-07)

- Branch: `codex/0006-W4-delete-and-restore-boards-from-trash`.
- Validated source/test revision: `d899ce311c320933edaae217d73a42eae5a2c98a`.
  This record is appended in a separate later commit; its final tip is reported
  separately in the handoff.
- Six test/adapter files change this round. Application, room, sync, schema,
  dependency, format, journal and limit files are byte-identical to the preceding
  tip. No new stored values or dependencies. The full prerequisite-base range is
  61 permitted files including this append-only record.
- Check 3 finished both server suites before the maintainer paused the independent
  run: Node 212 passed/8 failed; workerd 211 passed/5 failed/2 skipped. Read both
  failure outputs, diagnostic invocations, request logs and the additional X1
  scenario/client/server network traces. These are preceding-revision results,
  not fresh runtime acceptance for this revision.

**Maintainer decision (2026-11-07): “Yes, fail closed.”** Lifecycle v2 and sync v9
remain unchanged: unavailable SQL lifecycle authority returns retryable
503 service_unavailable, with no cached join, content or save. This resolves the
contract-adjudication item left open in the preceding record. `suite.test.ts`
and `lists.test.ts` now distinguish a complete SQL outage from an access-replay
RPC outage after lifecycle authority has returned. The latter isolates the older
cached-role/restore-lock assertions without making authority unavailable.

| Check / runners | Explicit amended outage expectation and retained recovery proof |
| --- | --- |
| S40 / Node, workerd | During complete outage after wake, all six role fixtures' ticket/export requests require 503 service_unavailable. Once lifecycle SQL returns, fail only access_changes_after and retain owner/editor saved edits, viewer role_too_low refusal and unknown/uncached-role 404 assertions. |
| S41 / Node, workerd | Offline operator restore, old-ticket upgrade and owner/outsider ticket/export require 503 service_unavailable. Once lifecycle SQL returns, perform the original restore with access replay isolated as unavailable: retain 200/locked response, 4423 close, consumed/invalidated-ticket 401, stored-owner room_locked, outsider 404, exact large canonical recovery and oversized-body 413. |
| S42 / Node, workerd | An offline fenced restore control must reject service_unavailable and export must return that 503. After lifecycle SQL returns, execute the same fenced rewind, retain room_locked during isolated replay failure, then the original recovered title. The ordinary unmarked rewind also denies export while SQL is offline and retains the original recovered-title assertion after it returns. |
| S43 / Node | Offline export requires 503 service_unavailable. Run the marked-volume copy after lifecycle authority returns; retain room_locked while access replay alone is unavailable, followed by successful export after replay recovers. |
| S70 / Node | Rename attempts while all SQL is unavailable require 503 service_unavailable, both inside the newer-state callback and after the marked rewind. Bring lifecycle SQL back before protected recovery; retain the original room_locked assertion under isolated replay failure, exact Volume X recovery, strictly higher generation and stored-generation equality. |
| S71 / Node, workerd | Offline operator restore and owner/outsider rename require 503 service_unavailable. After lifecycle SQL returns, perform the original restore with replay unavailable; retain room_locked for owner, generic outsider 404 and unchanged receipts. |

Both files reset the access_changes_after fault after each case. A scratch source
comparison confirms that all 20 original assert/refused calls in those six cases
remain, with the authorized outage expectations added and the older assertions
executed in the corresponding recovered-authority/replay state. S45–S47/S50,
S192/S193, S204 and S211/S212/S224 case bodies remain byte-identical to the preceding
passing revision. Runtime proof for these amended checks remains for the next
independent check; the Supabase CLI cannot start in this environment.

**S199 — test SQL syntax, not an API/storage mismatch.** Both runner traces stop
at the test helper SQL with `syntax error at or near "FROM"`, at the bare `at`
alias after row_number(). The Node request log records that helper call returning
500, before the pending-page requests can execute. `lifecycle.test.ts:S199` now
uses `AS pending_time` and `x.pending_time`. All ordering, 50-row paging, cursor,
foreign-workspace and filtering assertions remain; production `trash_page` and
its API v8 pending-first/boardId ordering are unchanged. Actual SQL execution and
both-runner S199 proof remain for the next check; no Supabase CLI/schema run here.

**S168 — introduced adapter observation deadlock.** The two intentional checkpoint
read failures correctly return room_locked. On the final retry, the request log
shows clear_board_mentions held until its three-second HTTP timeout, followed by
another room_locked ticket response. Round 2 had changed every adapter row read
into an ordered room operation. S168 intentionally reads restore_pending while
that same room queue is waiting for the held clear, and releases the clear only
AFTER that read: the observation could not finish before the timeout.
`node-test.ts` and `driver-workerd.ts:rows` now provide nonblocking, synchronous
inspection again. A separate explicit `settled` barrier joins the room queue for
S33's last-close snapshot inspection. No S168 assertion or product recovery code
changed. The new regression uses the actual Room queue/storage and the actual
workerd adapter with only platform ports replaced: it failed before the adapter
fix, then passed with immediate pending-state inspection and a barrier that waits
until held work is released. Real Node marked-volume/checkpoint/old-projection
proof and S33's both-runner snapshot proof remain for the next check; Supabase CLI
unavailable here. Existing Worker scheduler/body-drain fixes remain untouched.

**X1 — check-caller readiness, with additional check-3 evidence.** The scenario
again stops before X1-S1. The client network trace receives joined at
22:12:38.437 UTC, then comments_snapshot reset/done at 22:12:38.441; the server
trace contains no incoming comment frame between that join and the setup timeout.
The helper awaits BoardSession.join and immediately calls comment, although join
resolves on joined and comment requires snapshot completion. The separated frame
callbacks expose that readiness gap; no comment is sent. A controlled replay on
both candidate and fresh independent prerequisite base reproduces
`join_required`, zero outgoing frames before snapshot done, then `saved`, one
frame after done. No production snapshot guard, join semantics or resend behavior
was weakened.

The required correction is in the independent check's X1 setup helper, which is
outside this brief's permitted public files. No private tool was edited. The next
check must insert this wait between openRoom returning and the explicit comment:

```js
await until(() => room.commentsReady);
```

After creating the comment, it must assert that the returned ID exists in
commentRequests before waiting for saved; capture that returned value, readiness,
ordered joined/snapshot-done/comment-send/saved-or-refused frames and close codes.
This gives a concrete setup amendment and detects any remaining product failure
without waiting on a nonexistent request. All original X1 assertions remain
required. Actual corrected X1 setup and X1-S1–S25 proof remain for the independent
check: browsers and Supabase CLI cannot start here. The private tool amendment
and its runtime result are explicitly outstanding, not reported as passed.

| Validation | Fix-round result |
| --- | --- |
| V1 | PASS. All 20 manifests/locks/inventory/runtime-notice inputs match prerequisite base; zero new dependencies. |
| V2 | PASS. Candidate and fresh independent base npm ci --ignore-scripts --no-audit --no-fund exit 0; Node 26.13.0/npm 11.20.0. |
| V3 | PASS. npm run typecheck exits 0 for all five workspaces. |
| V4 | PASS. npm test exits 0: 927 passed, zero failed/skipped, including the new nonblocking-inspection/barrier regression. |
| V5 | PASS. Off build/license audit exit 0; index/notices equal independent base; no team/Supabase bundle inputs. |
| V6 | PASS. Fixture/on builds/license audit exit 0; on index/notices equal independent base and notices equal runtime notices v3. |
| V7 | PASS. Server build/license audit and Wrangler 4.156.0 Worker dry run exit 0 without deployment. |
| V8 | PASS. Full prerequisite-base-to-validated changed-file list and all fix hunks inspected; only 61 permitted files including earlier append-only records. Exact committed-range diff --check exits 0. |

The V2–V7 commands and synthetic off/on variables recorded above were rerun. The
independent base was freshly extracted with git archive at
`cffffbdaf54d6286339a8ce3063775cfb2b820da` and installed without candidate links.
All four index/notices SHA-256 receipts reproduce the exact values above.
Additional focused commands:

```sh
node --test --test-name-pattern='recovery inspection stays' tests/board-lifecycle.test.mjs
node <scratch>/comment-readiness.mjs <candidate-root>
node <scratch>/comment-readiness.mjs <independent-base-root>
node_modules/.bin/esbuild tests/server/suite.test.ts tests/server/lists.test.ts tests/server/lifecycle.test.ts tests/server/mentions.test.ts tests/server/node-test.ts tests/server/driver-workerd.ts --bundle --format=esm --platform=node --external:board-test-driver --external:vitest --external:cloudflare:test --outdir=<scratch>/test-bundles
git diff --name-status cffffbdaf54d6286339a8ce3063775cfb2b820da..d899ce311c320933edaae217d73a42eae5a2c98a
git diff --check cffffbdaf54d6286339a8ce3063775cfb2b820da..d899ce311c320933edaae217d73a42eae5a2c98a
```

The focused inspection regression ran red then green. All six server test/adapter
bundles compile; bundling is not server execution. An optional scratch assertion
inventory probe first attempted the unavailable TypeScript compiler JS API; it was
replaced with a balanced-call source comparison, which verified all retained
assertions and the unchanged case bodies listed above. No production fix was
inferred from that probe. No full server suite, V9–V13, browser/acceptance run,
Supabase CLI, schema application, deployment, push, external message, checkpoint
edit or next milestone occurred. Both mandatory source-commit hooks passed;
Git's sandbox packed-refs.lock maintenance warning followed a successful commit.
