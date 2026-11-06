BRIEF VERSION: 0006-W3 v1 (2026-11-06)
# 0006-W3 — Manage board history

Status: Draft. Implementation has not started under this brief.
Contracts (new versions):
[0006-board-lifecycle-v1](../architecture/0006-board-lifecycle-v1.md),
[0003-hosted-storage-v7](../architecture/0003-hosted-storage-v7.md),
[0003-hosted-persistence-v7](../architecture/0003-hosted-persistence-v7.md),
[0003-api-v7](../architecture/0003-api-v7.md),
[0003-access-v7](../architecture/0003-access-v7.md),
[0003-sync-v8](../architecture/0003-sync-v8.md),
[0001-document-v12](../architecture/0001-document-v12.md),
[0005-comments-v3](../architecture/0005-comments-v3.md),
[0001-interaction-v33](../architecture/0001-interaction-v33.md),
[0001-web-modules-v31](../architecture/0001-web-modules-v31.md),
[0003-self-host-runner-v3](../architecture/0003-self-host-runner-v3.md).
Unchanged: [identity v4](../architecture/0003-identity-v4.md),
[presence v1](../architecture/0004-presence-v1.md), [storage v3](../architecture/0001-storage-v3.md),
[board file v2](../architecture/0006-board-file-v2.md),
[toolchain v5](../architecture/0001-toolchain-v5.md), [lock v5](../architecture/0001-dependency-lock-v5.json),
[inventory v5](../architecture/0001-dependency-inventory-v5.json), [runtime notices v3](../architecture/0001-runtime-notices-v3.txt).
Where an inherited functional contract links a version replaced above, use this set. All requirements
and checks concern the current client/protocol/formats; saved document is 10, room layout becomes 5.

## Outcome

Open a team board’s history, browse its newest 50 document versions from up to 30 elapsed days,
preview an earlier board, and return to current. Every current role, including granted guests,
may browse. Editors/owners can save a named point, name an existing version, or confirm restoring
one under the same board ID. Restore keeps the replaced board and current discussions/notices;
open tabs rejoin, clear board Undo/Redo and supersede stale edits without sending unposted text.
Every timestamp uses viewer-local time and time-zone/locale formatting. No dependency is added.

## Read first and prerequisite contracts

Read [AGENTS.md](../../AGENTS.md), [CONTRIBUTING.md](../../CONTRIBUTING.md), [DESIGN.md](../../DESIGN.md),
the eleven new contracts and linked unchanged functional contracts. Lifecycle v1 owns capture,
retention and document restore; API v7 owns exact routes/status/shapes; access v7 owns live rights
and service-only notice carry; persistence v7 owns layout 5/journals/backups; document v12 owns
only the authorized historical-identity exception; sync v8 owns stale-edit generation fences;
comments v3 distinguishes user document restore from operator room restore; hosted storage v7,
interaction v33 and web modules v31 own browser state, exact approved values/words/focus and
boundaries; self-host runner v3 covers current-format recovery. Report conflicts before dependent work.

The [0005-W2 brief](0005-W2-mention-participants-in-board-discussions.md) supplies current discussion/
notice semantics; [0006-W1](0006-W1-export-and-restore-a-portable-board.md) supplies current Home
import/file-copy behaviour; [0003-W5](0003-W5-find-create-and-reopen-boards.md) supplies Home menus;
[0004-W2](0004-W2-recover-shared-edits-after-interruption.md) supplies interrupted edit recovery.
Implement directly from this contract set; prove capture/restore choices while building.

## Deliverables and boundaries

Base is committed main containing this brief/prerequisites, recorded at implementation. New source
files carry `// SPDX-License-Identifier: Apache-2.0`. Only these implementation files may change:

1. **Room/shared rules and sync**:
   - New `packages/board-room/src/history.ts`: ordered capture, retention, metadata, request journal,
     restore-only replacement and completion. New `packages/board-sync/src/history.ts`: pure shapes/
     helpers. Existing `packages/board-rules/src/transition.ts`: a narrowly separate authorized
     replacement validator if needed; ordinary checkTransition unchanged, no browser import;
   - `packages/board-room/src/room.ts`, `storage.ts`, `backups.ts`, `interfaces.ts`, `protocol.ts`,
     `edit-session.ts`, `edits.ts`, `snapshots.ts`, `comments.ts`, `mentions.ts`, `access.ts`,
     `tickets.ts`, `copies.ts` (all names after the first relative to that same src folder): layout 5,
     history alarms/last-close/creation, durable last-capture hash/byte-count metadata, chunks,
     current backup validation, fences, pins, current notice carry,
     stale edit/comment/queued work, independent operation kind/phase and copying restored title;
   - `packages/board-sync/src/session.ts`: immutable edit-generation envelope, restore announcement,
     rejoin/drop and reset; `packages/board-sync/src/comments.ts` only if shared event types need it.
     Saved document codec/adapter and canonical export/file rules do not change.
2. **Server**:
   - New `apps/server/src/routes/history.ts`: API v7’s five history routes;
   - `apps/server/src/app.ts`, `runtime.ts`, `supabase.ts`, `start-node.ts`, `worker-room.ts`,
     `worker-runtime.ts`, `delivery.ts`, `routes/boards.ts`, `routes/operator.ts` (after the first,
     relative to server src): wire the shared history operations/alarms and live generation floors,
     serialize completion with projection/operator recovery, no new ordinary deletion route;
   - `apps/server/supabase/nextphase_board.sql`: only service-only carry_board_mentions, privileges
     and any existing function coordination needed to preserve current notification semantics;
   - `apps/server/README.md`: current layout/history/backup/restore setup and explicit budget only.
3. **Web**:
   - New `apps/web/src/team/history.ts`, `history-panel.tsx`, `history-rules.ts` (last two in same
     team folder), with web modules v31’s exact jobs;
   - Existing `apps/web/src/team/hosted-board.ts`, `team-app.tsx`, `home.tsx`, `home-menu.tsx`,
     `home-card.tsx`, `pages.tsx`, `notices.ts`, `comments/layer.tsx`, `comments/card.tsx`,
     `comments/panel.tsx`, `comments/rules.ts`, `notification-navigation.ts` (all after first relative
     to team): menu/panel/preview wiring, access-ending cleanup, retained unposted text and notices;
   - `apps/web/src/ui/board-panel.tsx`: one permitted Show version history entry;
     `apps/web/src/ui/palette.tsx`: preview-specific effective-editor toolbar rendering only:
     retain the drawn editing tools/Templates in place but disable all toolbar actions except
     Pan. Preserve ordinary viewer/guest/current-board/team-off/local palettes; no editing grant;
     `apps/web/src/state/use-storage-session.ts`, `use-hosted-board.ts` (same state folder):
     distinct read-only hosted preview/live handoff, explicit Pan activation and retention on
     return-current/restore-rejoin instead of generic forced Select, Undo reset and current-only file-copy guard;
   - `apps/web/style.css`: interaction v33’s values only, preserving existing unrelated rules.

   App.tsx is unchanged, at most 264 lines; exactly 22 state-hook modules and 34 team modules.
4. **Tests and test-only controls**:
   - New `tests/board-history.test.mjs`: focused capture/retention/code-point metadata, current layout-5
     validation/backup budget, restore identity union/pins, immutable edit/restore requests,
     no stale replay, expiry-surviving capture fingerprints and atomic updates/backup validation,
     namedBy-before-actor confirmation/null fallback, active Pan/return-current tool state,
     timezone/display rules and unchanged document/file/local boundaries.
     Import new modules inside each named test so base absence fails by name. Existing
     tests/history.test.mjs is the Undo/Redo regression suite: preserve it unchanged;
   - New `tests/server/history.test.ts`: S169–S194 below, each on both runners, actual pass/fail
     lines and SUMMARY-HISTORY. `vitest.node.config.ts`, `vitest.workerd.config.ts` only include it;
   - `tests/modules.test.mjs`: v31’s three modules, one import exception and unchanged guards;
   - Existing `tests/comments.test.mjs`, `tests/mentions.test.mjs`, `tests/presence.test.mjs`,
     `tests/team-import.test.mjs`: only current layout/backup table/meta/initial-history expectations
     and restoreGeneration in raw edit fixtures, preserving all functional assertions.
     In tests/comments.test.mjs only, replace hardcoded absolute-date strings with the viewer-local
     Intl formatter expectation from hosted storage v7 (including zone/date/time); preserve relative
     age thresholds, text/anchor/mention/retry and other functional coverage;
   - Existing `tests/room.test.mjs`, `tests/removal.test.mjs`: only add the captured joined
     restoreGeneration to raw edit envelopes; preserve ordering/waiting/deadline/receipt/access
     and revocation assertions. Existing `tests/grouped-edits.test.mjs`: seed the joined generation
     in both matching fixtures and expect exactly kind, epoch, requestId, update, restoreGeneration
     in wire-key order. Preserve byte equality with/without a group and every grouping/Undo/Redo
     assertion; the group still never reaches the wire;
   - Existing `tests/server/suite.test.ts`, `shared.test.ts`, `lists.test.ts`, `removal.test.ts`,
     `mentions.test.ts` (all after first under tests/server): current layout 5/backup keys/initial
     history and explicit edit-generation fixtures; preserve all functional assertions. SQL service
     table count stays 13. S168 remains Node-only and uses current-format history-bearing rooms;
   - `tests/server/setup.ts`, `node-test.ts`, `worker-test.ts`, `driver-node.ts`, `driver-workerd.ts`
     (all in tests/server): only named deterministic clock/SQL/alarm/close, proxy hold/release,
     before/after transaction/fence/carry failure and ordered-message controls for these checks;
     Node volumeCopy/mark-restored control remains isolated. No committed synthetic-account-domain,
     port or unrelated driver rewrite;
   - `tests/README.md`: new checks, current fixture amendments and summary format.
5. **Record**: append only this brief’s implementation record. Brief/index/eleven contracts are
   committed prerequisites, not implementation edits. Record-only commits may occur between fix
   rounds; V8 allows their record-only hunks inside the source validation range.

Outside the named new controls, the existing screens' markup stays exactly as at the base.
Named changes are hosted history menus/panel/preview/restore/denied states and draft retention;
selection context bars/handles, Home controls, comments/inbox and local boards otherwise retain
existing behaviour/look. Team-off A–J permits only existing saved-time normalization, no new mask.
No other source/test/build/config/dependency/lock/inventory/notice changes; in particular App.tsx,
package manifests, build scripts and supabase/config.toml stay unchanged. If a concrete extra file
is necessary, report it before expanding scope. Scratch ports/output/settings remain outside Git.
The fresh check run authors tools/browser-compare/0006-w3-check.mjs in its own scratch tooling,
not in this public implementation; it consumes these checks, not an existing feature patch.
No hosted schema application/deployment, real content, invitation or external message.

## Server checks

Next free number after 0005-W2’s S168 is **S169**. Both `npm run test:server:node` and
`npm run test:server:workerd` execute **S169–S194** with independent synthetic boards/accounts.
Use existing deterministic roomSQL/clock/alarm/socket/proxy controls, extending only item 4’s
named controls. Compare actual rows, wire envelopes, generation floors, canonical bytes and
request logs, not screenshots. A refusal means unchanged document/history/receipt/discussion,
except independently necessary access cleanup and a truthfully recorded monotonic pending fence.
Do not treat an uncertain partial restore as a proven rollback. Print PASS/FAIL for every ID.

| ID | Check |
| --- | --- |
| S169 | Initial room and imported-document creation atomically capture exactly one initial version at revision 0/layout 5; repeated initialize/restart adds none; injected initialization failure leaves neither partial head nor history. |
| S170 | At persisted 1,800,000-ms deadlines capture only changed canonical heads; unchanged intervals add none; a late wake captures one actual current state without backfill. Fail capture transaction, restart, retry due deadline and capture once; failed writes leave the prior durable fingerprint intact. Expire/prune every retained version and old recovery snapshot, change title A→B→A at higher revisions, restart, then run due checkpoint and changed-last-close checks: the persisted SHA-256/byte count suppresses identical canonical content. A genuinely different head captures once and atomically advances fingerprint/revision/ordinal; manual equal-content save and final restored entry still set the last-capture fingerprint. |
| S171 | Changed last collaborator close captures once (including viewer closing last); unchanged last close adds none; remaining peers prevent last-close capture. Manual save captures even unchanged head; unconfirmed edits/comments never enter the document copy. |
| S172 | Save/name validate optional plain strings at exactly 100/500 code points, accepting non-BMP counted once and empty metadata; 101/501, ill-formed Unicode, prohibited controls, extra keys and wrong types give 400 with no capture/metadata mutation. Naming preserves capturedAt/ordinal/document. |
| S173 | Insert 51 versions: newest 50 ordered by ordinal, oldest metadata/chunks gone. Named/manual/automatic/before/restored entries share cap; naming pins nothing. Restore at cap copies selection before pruning and consumes exactly two entries. |
| S174 | At capturedAt+2,592,000,000−1 ms preview/name/restore allowed; at equality and later get 404 even before cleanup; list omits expired rows. Naming never renews; live board remains available. Server time, not viewer calendar, governs. |
| S175 | Every history route for owner/editor/viewer, editor/viewer granted guest, outsider and disabled person. All effective roles list/preview; owner/editor including editor guest mutate, viewer mutations 403 role_too_low; no-role/missing/malformed/expired 404 not_found; invalid bearer 401 before ID/body; no protected fields in errors. |
| S176 | Revoke while preview/restore request is held before authorization; release and observe generic 404/no mutation. Remove one of multiple roles and keep highest effective rights. A guessed version on another board never yields metadata/document/count. |
| S177 | Inject live access/room/checkpoint failure: retryable 503, no stale/partial list/preview or false success; recover and explicit retry succeeds. Service failure is distinct from a successful empty list. |
| S178 | Preview exact canonical selected title/object identities/generations/styles/groups/sections/connectors/retired set and 2 MiB bound; saved live head/revision/Undo not changed by preview. Reject invalid selected current-format data before advancing any fence. |
| S179 | Confirmed restore keeps same board ID; before entry equals latest replaced head, restored entry equals selected canonical content; revision old+1, external generation strictly higher, ordinals consecutive with restored newest even at identical timestamps. Other retained history stays subject to cap/age. |
| S180 | Two editors: hold confirmation, save another edit, restore with stale expected revision or generation gets 409 head_changed and no capture/document mutation. Re-read/reconfirm explicitly with new identity then succeeds and before entry equals latest head. No automatic retry with substituted expected values. |
| S181 | Lost manual-save answer and same identity/body retry after restart: exactly one version. Lost restore answer/same identity retry: one replacement/two entries and original result, including after selection eviction/expiry. Different body/path for same caller/request returns 409 request_id_reused; current access loss still denies receipt reads. |
| S182 | Inject known rollback before the durable intent/fence commits: document/history/identifiers/discussion unchanged and restore_failed only when proven. Inject failure after intent/fence/local commit/carry: restore_pending/503, locked room, no second restore; restart and retry same identity completes once. Backup while pending refuses 503 restore_pending. Use selected and replaced canonical documents each exactly 2,097,152 bytes; inspect history_intent_chunks (each ≤1,048,576 raw bytes) and metadata-only history_requests.result (≤65,536 UTF-8 bytes). Fail intent creation/completion-cleanup transactions: no partial journal/chunks, no orphan cleanup, pending chunks survive restart, terminal result/chunk deletion/unlock commit together. |
| S183 | Restore historical removed objects and memberships/connector references with fresh Yjs state. Identifier union includes later absent IDs/generations; ordinary edits still refuse resurrection/reuse/type substitution. Restore-only exception never accessible through an ordinary edit flag/upload. |
| S184 | Current root/replies/text/mentions/resolved states/counters/IDs survive document restore, deleted root/reply never returns. Matching anchor follows restored box; missing/mismatched object detaches at latest point; detached anchor remains detached when its object returns. |
| S185 | Prepare unread/read notices, dismissed and cap-evicted creations plus legitimate pending delivery. Restore document, carry checkpoint generation preserving cutoff/order/IDs/read/state_version, then deliver pending once. Hold/reorder old projection and lost carry answer: no revived/duplicate/read-reset reference; failed carry remains locked. |
| S186 | Current comments generation mismatch precedes receipts; current edits now carry restoreGeneration and mismatch precedes saved/received receipts and queued application. Hold a dependency-waiting update, restore and retry it: no stale write/receipt success. Rejoined new-generation edits/comments work. |
| S187 | Connected peers receive history_restoring actor then 4423; invalidate tickets/waiting. Rejoin exposes higher generation and restored head; missing announcement still fences stale work. Interrupted room remains locked until carry/access completion, never reports a saved unlocked partial restore. |
| S188 | Restart current layout 5 preserves versions/chunks/original ages/metadata/deadlines/results, last-capture SHA-256/byte count even with all captured documents expired, and new generation, with no duplicate initial/checkpoint capture. Normalized Home title copy uses new revision/generation; delayed older copy cannot replace restored title. |
| S189 | Small complete current logical backup/restore on each runner preserves valid history/original times and applies present age/cap gates. Operator restore still clears projected/source mention work while preserving historical ranges; distinguish it from user carry. Held earlier work cannot cross independent fence. |
| S190 | Malformed current layout-5 backup: missing history tables/keys, bad reason/name/counters, duplicate ordinal, wrong chunk order/size, mismatched board/references and invalid journal/mention shape, embedded journal documents, orphan intent chunks or dangling intent-chunk references each return 400 before fence/row changes. Missing/malformed fingerprint keys, invalid byte counts/capture ordinals/revisions and mismatch against a retained last-capture document also refuse before fence/write. A valid fingerprint whose document expired is accepted without requiring equality to the uncaptured live head; backup/restore preserves it. Current valid import/backup still succeeds. |
| S191 | Measure whole UTF-8 backup bytes including base64/metadata/history: small legal history succeeds; legal repeated large snapshots beyond 16,777,216 explicitly return 413 backup_too_large; restore over limit body_too_large. Print document count/chunk/aggregate sizes; do not raise cap or claim 50×2 MiB fits. |
| S192 | Print all room-table row/serialized-byte counts, history request/journal and intent-chunk row/byte sizes (each row below the 2 MB runner ceiling), independent fence and 13 service-table inventory. Confirm ≤50 retained versions, each ≤2,097,152 bytes/chunks≤1,048,576; history receipts/seen IDs/existing lifetime history are not called globally bounded. Expiry cleanup removes all orphan chunks. |
| S193 | carry_board_mentions is service-only: direct authenticated/anon execution denied; all 13 service tables remain RLS-enabled/no writes. It inserts no notices; repeated to-generation is idempotent, wrong/higher checkpoint conflict never lowers/clears state, absent checkpoint only accepted after successful read. |
| S194 | Exercise new routes through both actual HTTP adapters: exact API v7 keys/status/body limits, no deletion route, no client-supplied actor/time/document. History operations/preview do not change current JSON/file canonical export, permissions or notice read status. Ordinary current import starts its own initial history only. |

## Browser checks

New scenario **H1** runs in Chrome, team on, local Supabase and Node, allowedOrigin equal to page
origin. Default 1280 × 800/device scale 1; narrow 375 × 812. Page keyboard events only. The check
run writes **tools/browser-compare/0006-w3-check.mjs** and emits one `PASS: H1-S<n> <name>` or
`FAIL: H1-S<n> <name>` plus a machine-readable summary. Missing module/route/control fails its
own row; do not stop the whole run at the first missing feature. Never count setup failure as a
passed criterion. H1-S30 runs separately team off. Use separate fixture boards for destructive
retention/failure/restore cases; no row relies on another’s incidental unsaved state.

Interaction v33 provides all exact words, CSS, fixture coordinates and instants. Seed via real app/
server operations, or isolated synthetic room fixtures for age/count/error states; capture actual
canonical records and HTTP responses. Never insert painted history UI or stub success. Exact fixture
history is five entries at 09:00Z,09:30Z,10:00Z,10:10Z,10:20Z on 2026-11-06; selected Ready for launch
at 10:00Z, restore10:25Z/review10:24Z. Display all as viewer-local formatted strings, not fixed UTC.
A deterministic server clock keeps these retained. Use ana/ben/mia/lee and roles/three stickies/root/
reply/draft as interaction v33 specifies. Runtime person IDs/colours derive from actual identities.
For rejoin/read-state assertions inspect before/after rows and observe actual requests; opening
current comments can legitimately mark fully displayed rows, so measure notice preservation first.

| ID | Action and required result |
| --- | --- |
| H1-S1 | Owner opens Launch plan, selects first sticky, opens board details. Existing context bar/handles stay in their real positions. Show version history follows file commands; activate by keyboard. Heading Version history focused, Close next Tab; existing name/account/file controls remain. |
| H1-S2 | From #/files select Launch plan card, Shift+F10. Preserve existing menu order (Show in workspace, Open, Open in new tab, Copy link, Rename) and separator, then Show version history. Activate: #/b/<same boardId>, history already open; close returns through Home to that card/menu opener, without a version route. |
| H1-S3 | With interaction v33’s five retained entries, verify exact newest-first headings and subtitles (Last collaborator left, Saved by ben, Named by ana · Automatic checkpoint, Checkpoint, Initial capture), limits Newest 50 versions · Up to 30 days and Named versions expire too.; each row has local captured time, no repeated Automatic subtitle on Automatic version. |
| H1-S4 | Open Ready for launch. Focus read-only heading, selected purple row scrolled into view, title Launch plan — draft, second sticky Launch on Thursday with unchanged IDs/geometry; Read-only preview and Back to current version visible. Try keyboard/pointer board edit and Comment: no edit/send; Pan tool is explicitly active with aria-pressed=true before preview request/paint, disabled Select tool has aria-pressed=false, Pan/zoom work, following stops; current Comments hidden and Undo/Redo unavailable. For editor/owner preview the full toolbar, including editing tools and Templates, stays in its drawn positions; all toolbar actions except Pan are disabled, Templates cannot open/load. Ordinary viewer preview retains its smaller palette. |
| H1-S5 | While preview open, ben saves a change to current board. Back to current version displays latest live content and focuses the selected row; Pan remains pressed (Select not pressed), with controls re-enabled by current role. Repeat Close/Review-current and successful restore/rejoin handoffs in that previewing tab; none restores an old tool or forces Select. A later explicit Comment/tool choice works normally; no historical paint was sent as edit. Open Comments closes history in the single panel slot. Opening history/preview alone issued no displayed-comment marking. |
| H1-S6 | Save version… opens focused Name (optional), description next. Fill Ready for review / Customer interviews complete.: counters 16 / 100 and 29 / 500; dialog explains server-confirmed-only capture. Cancel/Escape restores opener/no POST. Reopen/save through button: new confirmed row; no success before response. Force save failure, keep fields and exact save-failure words/Retry; explicit retry uses one request ID/body, no duplicate. |
| H1-S7 | Open selected row More, Name version…. Name field Ready for launch / description Launch on Thursday after review.: counters 16 / 100 and 32 / 500. Local original time and Naming this version does not renew its age. Save name updates same entry, not capturedAt/ordinal/document. Inject name failure: fields kept, exact name-failure copy and Retry; no extra capture. |
| H1-S8 | Use Name field with 100 non-BMP code points and description with 500: correct counts and save. Attempt 101/501: cannot submit invalid input; existing fields/canonical entry stay. Empty metadata permitted. Separate fixture with 51 captures displays newest 50; named oldest is evicted, original age never renewed. |
| H1-S9 | As mia and granted viewer guest lee, list/preview succeeds but no Save version…, More, Name version… or Restore this version; exact edit-access footer. Editor guest can save/name/restore. Guest history never grants access to other boards. |
| H1-S10 | Independent no-version fixture: successful [] shows No versions yet / Versions will appear after the first confirmed save. Hold real list response: Loading version history… with no stale rows/empty heading. Fail 503: Couldn’t load version history / Try again when Board’s server is available. / Retry. Retry actual route after recovery shows rows. |
| H1-S11 | Hold preview HTTP response: clear prior historical paint/rows, Loading version… and Back to current version. Fail 503: Couldn’t load this version / The preview is unavailable. Try again. / Retry, Back still works. Recover explicit Retry then paint only the selected document. |
| H1-S12 | Select retained version then advance server clock to its exact expiry before preview/restore. Generic 404 clears its title/author/document; show This version is no longer available. / Choose another version or return to current. / Back to current version. Live board remains available; no stale historical canvas. |
| H1-S13 | Hold a preview, revoke final access and release response. Clear title, history/counts/authors, canvas, avatars, tools and menus; focus This board is not available. Exact generic explanation and Back to files. Denied/missing board direct access shows same ending and no protected data; late response cannot repaint. |
| H1-S14 | While permitted viewer preview open, issue a direct real restore/save/name mutation from the page’s authenticated API caller. Observe 403 role_too_low. Surface Action not available / You need edit access to save, name or restore versions. Nothing was changed. / Back to history. No document/history write; Back focused on return. |
| H1-S15 | As editor select Ready for launch, Restore this version. Confirmation has local time followed by “ · ana” for Ready for launch (actor=null, namedBy=ana) and both exact preservation/session-warning paragraphs from interaction v33. Separate fixtures prove namedBy=ana overrides actor=ben, namedBy=null falls back to actor=ben, and both null show time alone without an author/separator; Cancel focused, Restore next Tab. Cancel then Escape on separate openings each makes no restore request/change. |
| H1-S16 | Open restore confirmation, have second editor save current text. Confirm old head: 409; The board changed and both exact explanatory sentences; Review current version focused. Click Review: show actual latest current text, then reselect historical row/reopen confirmation with new head. Reviewed-at local formatted instant appears in amended warning. Confirm only after this review. |
| H1-S17 | Complete restore at fixture 10:25Z. Same URL/ID, Launch plan — draft/Launch on Thursday, Version restored and exact success sentence. Top rows Restored from Ready for launch, Before restore, then previous five; equal local minute labels ordered by ordinal. Preview Before restore proves replaced current text was kept; newer history not erased beyond retention. |
| H1-S18 | Ben keeps actual open reply field @ana, please confirm Friday. (plain 28 code points), plus an unanswered edit, while ana restores. Ben sees exact Rejoining then Rejoined sentences, Undo/Redo disabled after rejoin, preserved reply and Unposted text kept in this tab. Nothing was sent. Observe no automatic comment send; old explicit retry blocked. Current root/reply/resolved state unchanged. |
| H1-S19 | Separate actual restore fixture with matching attached pin, missing object anchor, already detached pin and deleted reply. Restore: matching pin follows restored identity/box, missing anchor detaches at latest point, detached stays detached; current deleted reply never returns. Open current Comments after return to check actual saved state. |
| H1-S20 | Before restore create read and unread retained notices, dismissed/evicted creation and pending delivery; keep recipient Home closed. Restore through UI, then open Notifications in another account context without opening discussion. Same retained IDs/read states, pending notice delivered once; dismissed/evicted absent. Opening history never marks anything read. Correlate service rows with S185. |
| H1-S21 | Hold restore response while real operation runs: Restoring version… / exact two paragraphs / disabled Restoring…; Escape cannot dismiss or edit. Lose answer after commit/carry: Restore not confirmed, exact amber message and retry explanation; no Cancel, editing paused. Explicit Retry sends identical path/body/request ID, resolves once with two entries. |
| H1-S22 | Inject proven rollback before the durable intent/fence commits: Couldn’t restore version plus exact no-changes/service paragraphs; Cancel focused and Retry available. Compare document/history unchanged. Clear injection and Retry same request: one restore; distinguish any uncertain failure, which must stay H1-S21 pending instead of claiming rollback. |
| H1-S23 | After manual name/save and successful restore, restart Node without reloading tab memory as a persistence claim. Fresh browser opens board/history: same valid versions/names/capture ages/current content; no duplicate initial version. Current-format backup/restore link to S188–S190 (do not simulate with painted rows). |
| H1-S24 | Use same fixed instants in two Chrome contexts, en-US/America/Panama and en-GB/Europe/Berlin. Compare every row/preview/name/confirm/reconfirm absolute time with each context’s Intl.DateTimeFormat(undefined,{year:"numeric",month:"short",day:"numeric",hour:"2-digit",minute:"2-digit",timeZoneName:"short"}). No timeZone/hour12 option in app. Check local date/hour/minute/zone/locale order for 10:00Z and reviewed 10:24Z; stored instants identical. |
| H1-S25 | Keyboard-only page events through history row Open/More, menu Escape→More, selection→preview heading, Back→row, Save/Name name→description→Cancel→submit, restore Cancel→Restore, changed-head Review focus, pending Retry, denied heading. Tab traps dialogs, no nested buttons; focused ring 3px #7051cf/offset3. No global shortcut or OS-level keys. |
| H1-S26 | At 375×812 open selected Ready for launch after list scroll. History x12/y412/w351/h320 and selected row visible; preview bar top124/left12/right12 wraps, Back reachable; retention/Restore/footer visible in their scroll regions. Actual header/palette remain. Pan/zoom works; no history/comments overlap. |
| H1-S27 | Hold first selection’s preview, select a different version then release in reverse order: only newest selected content/title paint. Repeat sign-out/account change/final access loss while list/name response held; no protected state leaks or resurrects, drafts cleared for access ending. Confirmed save/name followed by failed refresh retries GET only. |
| H1-S28 | Hold pre-restore edit/recovery and unconfirmed comment, restore then rejoin. Capture wire restoreGeneration: no resend/application across new generation and no old receipt success. A fresh deliberate edit/comment works. No stale Yjs content after preview return. Correlate S186/S187, not a screenshot-only assertion. |
| H1-S29 | Current live Save a copy and JSON export contain document only, no history/comments/permissions; disable copy while previewing. Export after Back/restore equals actual current document. Local board has no history control or requests, and its saved records remain as base. This is an unchanged-boundary control. |
| H1-S30 | Separate team-off build: no history entry/control/request/team module in page; A–J markup/focus/local records unchanged with only existing saved-time normalization. This is an unchanged-boundary control. |

### Approved state comparisons

Each row below is also an independent H1 check. Reach the actual state using the functional
steps above and real request/failure/clock controls. Capture it; compare all declared CSS/rectangles
within 0.5px and exact copy/colours/font/spacing with interaction v33. Capture files use the state
name below, in check scratch. Existing relative ages may normalize; new absolute times are asserted
against the local formatter, never masked. Automatic version subtitles are the approved wording fix.
Do not change app geometry to compensate for faulty setup; use authoritative view/object geometry.

| ID | State and required comparison |
| --- | --- |
| H1-S31 | board-menu: interaction v33’s complete 1280 × 800 state; exact controls/copy, local timestamps, geometry, colours and focus; underlying live board controls remain app-rendered. |
| H1-S32 | home-menu: interaction v33’s complete 1280 × 800 state; exact controls/copy, local timestamps, geometry, colours and focus; underlying live board controls remain app-rendered. |
| H1-S33 | history: interaction v33’s complete 1280 × 800 state; exact controls/copy, local timestamps, geometry, colours and focus; underlying live board controls remain app-rendered. |
| H1-S34 | preview: interaction v33’s complete 1280 × 800 state; exact controls/copy, local timestamps, geometry, colours and focus; underlying live board controls remain app-rendered. |
| H1-S35 | version-menu: interaction v33’s complete 1280 × 800 state; exact controls/copy, local timestamps, geometry, colours and focus; underlying live board controls remain app-rendered. |
| H1-S36 | save-version: interaction v33’s complete 1280 × 800 state; exact controls/copy, local timestamps, geometry, colours and focus; underlying live board controls remain app-rendered. |
| H1-S37 | name-version: interaction v33’s complete 1280 × 800 state; exact controls/copy, local timestamps, geometry, colours and focus; underlying live board controls remain app-rendered. |
| H1-S38 | restore-confirm: interaction v33’s complete 1280 × 800 state; exact controls/copy, local timestamps, geometry, colours and focus; underlying live board controls remain app-rendered. |
| H1-S39 | after-restore: interaction v33’s complete 1280 × 800 state; exact controls/copy, local timestamps, geometry, colours and focus; underlying live board controls remain app-rendered. |
| H1-S40 | rejoining: interaction v33’s complete 1280 × 800 state; exact controls/copy, local timestamps, geometry, colours and focus; underlying live board controls remain app-rendered. |
| H1-S41 | collaborator: interaction v33’s complete 1280 × 800 state; exact controls/copy, local timestamps, geometry, colours and focus; underlying live board controls remain app-rendered. |
| H1-S42 | viewer: interaction v33’s complete 1280 × 800 state; exact controls/copy, local timestamps, geometry, colours and focus; underlying live board controls remain app-rendered. |
| H1-S43 | guest: interaction v33’s complete 1280 × 800 state; exact controls/copy, local timestamps, geometry, colours and focus; underlying live board controls remain app-rendered. |
| H1-S44 | empty: interaction v33’s complete 1280 × 800 state; exact controls/copy, local timestamps, geometry, colours and focus; underlying live board controls remain app-rendered. |
| H1-S45 | loading: interaction v33’s complete 1280 × 800 state; exact controls/copy, local timestamps, geometry, colours and focus; underlying live board controls remain app-rendered. |
| H1-S46 | failed: interaction v33’s complete 1280 × 800 state; exact controls/copy, local timestamps, geometry, colours and focus; underlying live board controls remain app-rendered. |
| H1-S47 | preview-loading: interaction v33’s complete 1280 × 800 state; exact controls/copy, local timestamps, geometry, colours and focus; underlying live board controls remain app-rendered. |
| H1-S48 | preview-failed: interaction v33’s complete 1280 × 800 state; exact controls/copy, local timestamps, geometry, colours and focus; underlying live board controls remain app-rendered. |
| H1-S49 | expired: interaction v33’s complete 1280 × 800 state; exact controls/copy, local timestamps, geometry, colours and focus; underlying live board controls remain app-rendered. |
| H1-S50 | denied: interaction v33’s complete 1280 × 800 state; exact controls/copy, local timestamps, geometry, colours and focus; underlying live board controls remain app-rendered. |
| H1-S51 | role-denied: interaction v33’s complete 1280 × 800 state; exact controls/copy, local timestamps, geometry, colours and focus; underlying live board controls remain app-rendered. |
| H1-S52 | stale-restore: interaction v33’s complete 1280 × 800 state; exact controls/copy, local timestamps, geometry, colours and focus; underlying live board controls remain app-rendered. |
| H1-S53 | reconfirm: interaction v33’s complete 1280 × 800 state; exact controls/copy, local timestamps, geometry, colours and focus; underlying live board controls remain app-rendered. |
| H1-S54 | restoring: interaction v33’s complete 1280 × 800 state; exact controls/copy, local timestamps, geometry, colours and focus; underlying live board controls remain app-rendered. |
| H1-S55 | restore-pending: interaction v33’s complete 1280 × 800 state; exact controls/copy, local timestamps, geometry, colours and focus; underlying live board controls remain app-rendered. |
| H1-S56 | restore-failed: interaction v33’s complete 1280 × 800 state; exact controls/copy, local timestamps, geometry, colours and focus; underlying live board controls remain app-rendered. |
| H1-S57 | narrow-history: interaction v33’s complete 375 × 812 state; exact controls/copy, local timestamps, geometry, colours and focus; underlying live board controls remain app-rendered. |

## Numbered acceptance criteria

- **0006-W3-AC01:** Anyone with current effective access to a team board can list/preview retained
  document versions. Initial, changed 30-minute, changed last-close and manual captures follow
  lifecycle v1; unchanged automatic intervals add none. Editors/owners save/name optional plain
  100/500-code-point metadata; viewers cannot. Newest 50/30 elapsed days apply to every kind,
  naming never renews, oldest eviction/expiry blocks read/restore while live content remains.
  Approved panel/preview/focus and every timestamp’s local display match interaction v33.
- **0006-W3-AC02:** Confirm current revision/generation before same-ID document restore. Preserve
  replaced current document, append selected content as a new top version at a higher revision/
  generation, retaining identities/references and other history within retention. Changed heads
  require review/fresh confirmation; identical retries restore once. Keep current discussion,
  pins, ranges, resolved state, legitimate pending delivery and retained notices/read state;
  never revive deleted/dismissed/evicted content. Rejoin/clear Undo, block stale edit/comment/
  recovery work and retain unposted tab text for review without automatic send. Known rollback
  changes no document/history; uncertain/partial operation stays truthfully locked pending.
- **0006-W3-AC03:** Every route enforces live access before protected metadata/content: generic
  404 denied/missing/expired, viewer mutation 403, invalid authentication 401, service failure
  retryable 503. Revoke/direct/guessed/stale requests cannot leak or restore. Current-format
  restart/backup/runner recovery preserves valid history/original ages/fences, with explicit
  16,777,216-byte aggregate backup refusal. Both runners agree; local/file/team-off boundaries
  remain. Trash and board deletion/routes are excluded for 0006-W4.

| Criterion | Evidence that shows it |
| --- | --- |
| 0006-W3-AC01 | S169–S178; H1-S1–S12; H1-S24–S26; H1-S31–S48; H1-S57; V4 |
| 0006-W3-AC02 | S179–S187; H1-S15–S23; H1-S27–S28; H1-S34–S43; H1-S52–S56; V4 |
| 0006-W3-AC03 | S175–S177; S181–S182; S186–S194; H1-S9–S14; H1-S21–S30; H1-S44–S57; V4; V9–V13 |

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

Copy apps/web/dist aside before each subsequent build. Ignored generated output/meta.json is
not a source change. Build the base in a separate clean checkout/install, never candidate source
links. The fresh full-access check session owns a disposable local stack per candidate/base:

```sh
node tests/server/make-signing-key.mjs
npx supabase start
node tests/server/write-stack-info.mjs
npm run test:server:node
npm run test:server:workerd
npx supabase stop
```

Use the suites’ current SQL setup, synthetic identities and existing test ports or scratch-only
settings. Never reuse candidate-schema Supabase for baseline negative controls. Private local/Auth/
service keys stay out of source/log/evidence. The browser invocation from the check tooling root is:

```sh
node tools/browser-compare/0006-w3-check.mjs <served-on-origin> <H1-output> <local-stack-private-json>
```

Repeat that tool once with the base origin/output/its independently created stack; H1-S30 gets
the served team-off origin in a separate invocation. Tool options may select rows/off mode without
changing criterion meanings. The check session records exact commands for X1/C2/W5/A–J tools and
serves copied base/candidate artifacts separately with their own runtime origins.

| Check | Pass condition |
| --- | --- |
| V1 | All package.json/package-lock.json/dependency inventory/runtime notice bytes identical to base; no new dependency |
| V2 | npm ci exits 0 |
| V3 | npm run typecheck exits 0 for all five workspace members |
| V4 | Accepted full npm test exits 0, new tests/board-history.test.mjs passes, existing functional assertions retained with only item 4’s explicit current-format/module/edit-envelope/absolute-date amendments |
| V5 | Off build exits 0; index.html and THIRD_PARTY_NOTICES.txt byte-identical to base off artifacts; meta.json has no node_modules/@supabase/ or apps/web/src/team/ input; audit:licenses exits 0 |
| V6 | build:fixtures/on build exit 0; index.html equals base on; notices equal runtime notices v3; audit:licenses exits 0 |
| V7 | build:server, Worker dry run and audit:licenses exit 0, no deployment |
| V8 | Inspect git diff --name-status <base>..<validated> and every changed hunk: only deliverables 1–4 plus append-only Implementation record hunks in this brief are allowed. Record-only commits from earlier fix rounds may lie inside this range and are not failures. No brief requirement/contract/index mutation is allowed. Record the validated source/test revision and later record-inclusive branch tip separately; git diff --check exits 0 |
| V9 | H1-S1–S29 and H1-S31–S57 pass team on, H1-S30 team off, all 27 actual state comparisons and both-runner S169–S194 evidence present |
| V10 | Once on independent fresh base stack/build, new H1-S1–S28 and H1-S31–S57 fail by name for missing behaviour; H1-S29/S30 unchanged-boundary portions may pass, while preview-specific portions of S29 may fail. New tests/board-history.test.mjs cases and S169–S194 fail by name for missing behaviour; the existing tests/history.test.mjs Undo/Redo suite is unchanged regression coverage, not a new negative control; unchanged refusal subassertions can pass but cannot make their whole new row pass. Keep actual result/setup failures distinct. No mixed-stack negative control |
| V11 | Accepted full server suites: Node S1–S50,S55–S194; workerd S1–S36,S38–S42,S44–S50,S55–S69,S71–S167,S169–S194. S37/S43/S70/S168 remain Node-only. New S169–S194 pass on both; every suite summary fail 0. Current-layout/immutable edit fixture amendments only; preserve original functional assertions |
| V12 | Accepted A–J team-off comparison against base passes with no new mask, only existing saved-time normalization; markup/focus/canvas/local saved records unchanged |
| V13 | Accepted X1-S1–S25 team on; C2-S1–S29,C2-S31–S66 team on and C2-S30 off; W5-S1–S39,W5-S41–S45 team on and W5-S40 off pass with their accepted review corrections (current textbox/ownText/aria-readonly/landing/menu helpers). Home menu now has exactly the v33 history entry and separator; adapt only affected expected menu/Tab positions, retain all prior functional assertions. Each failure is reported and classified from actual base source/tests, never waived as a harness issue without evidence |

Implementer runs V1–V8 in workspace-write; browsers cannot start and Supabase CLI cannot run there,
and those checks require neither. Fresh independent full-access check run repeats V1–V8 on clean
clone, then V9–V13; report every V/H1/S/regression line and summary. Do not claim missing evidence
passed. Accepted regressions are full unit/server suites on both runners, A–J off, X1, C2 and W5.
No full interruption-recovery browser replay, C1 replay, fixture-harness sweep, load/performance,
browser matrix, native input method or screen-reader campaign. The new checks are functional,
not latency/scale promises. Safari samples are chosen at review. Boundary hooks remain mandatory.

## Exclusions and reasons

- Trash, board deletion/restoration from Trash, purge and deletion routes: 0006-W4.
- Local-board history, historical sharing links, version diff/branch/duplicate and historical export.
- Hosted pictures/assets, history/comments/permissions in JSON/Board files, account/workspace erasure.
- Comment rollback on user restore, revived old notifications or automatic resend of unposted text.
- A distributed room/Supabase transaction, a global lifetime-storage bound or universal backup fit.
- A full feature prototype, deployment/schema application and external messages/invitations.

## Implementation record

(Appended by the implementer.)


### 2026-11-06 — v1 implementation handoff

- Base committed main: `48f80523421e51fde429bab81f9aefa9b2ebdee5`.
- Branch: `codex/0006-W3-manage-board-history` in the supplied fresh linked milestone worktree;
  the starting worktree was clean. No unrelated work was present or changed.
- Validated source/test revision: `b53b4d6e8608fa98381f8fc8a37c72816a906e9c`.
  Production implementation commit: `f6810123cdfd0023fc5525e0e10bc6be2b6f8bc4`;
  the later source/test revision adds the focused live-role refusal test only.
  Build inputs are identical between those two revisions.
- Record-inclusive final branch tip is reported separately in the handoff after
  this append is committed. This record does not assert independent acceptance.
- Toolchain used for final checks: Node `26.13.0`, npm `11.20.0`.
  The initial shell's older toolchain was replaced for validation using an isolated
  scratch installation; no repository manifest, lock or inventory changed.
- Added dependencies: **none**. Saved document remains 10; current room layout is 5.
- Scope is this v1 brief and its eleven committed contracts. Approved local-time,
  Automatic-version subtitle, palette, shadow, chunked-intent, fingerprint,
  confirmation-author and Pan corrections are included. No prototype, extra
  agent, checkpoint, schema application, deployment, push or next milestone.
- Graph discovery was attempted first, but the MCP approval policy rejected it;
  direct repository inspection supplied the fallback. No hook was bypassed.

#### Implementer validation (V1–V8)

All commands below ran from the milestone worktree with the exact toolchain above,
except the independent base builds, which ran in a clean archived checkout of the
base revision with its own `npm ci`. Scratch output locations are omitted from
public evidence; no source links to the candidate were used for base builds.

| Check | Command / inspection | Actual result |
| --- | --- | --- |
| V1 | Compare Git base blobs with current bytes for every package.json, package-lock.json, dependency lock/inventory and runtime notices | PASS: all 20 protected files identical; zero new dependencies |
| V2 | `npm ci --ignore-scripts --no-audit --no-fund` | PASS, exit 0; 118 packages installed with Node 26.13.0/npm 11.20.0 |
| V3 | `npm run typecheck` | PASS, exit 0, all five workspace members |
| V4 | `npm test` | PASS, exit 0: 912 tests, 912 pass, 0 fail/cancelled/skipped/todo; new H-U01–H-U20 all pass |
| V5 | Off build command below; `npm run audit:licenses`; compare copied off artifacts and inspect meta.json | PASS, both exits 0; index.html and THIRD_PARTY_NOTICES.txt identical to base off; no team or Supabase inputs |
| V6 | `npm run build:fixtures`; on build command below; `npm run audit:licenses` | PASS, all exits 0; index.html identical to base on; distributed notices equal runtime notices v3 |
| V7 | `npm run build:server`; `npm run audit:licenses`; `npx wrangler deploy --dry-run --outdir <scratch> -c apps/server/wrangler.json` | PASS, all exits 0; Node and Worker bundles built; dry run explicitly exited without deployment |
| V8 | `git diff --name-status 48f80523421e51fde429bab81f9aefa9b2ebdee5..b53b4d6e8608fa98381f8fc8a37c72816a906e9c` and every changed hunk; `git diff --check 48f80523421e51fde429bab81f9aefa9b2ebdee5..b53b4d6e8608fa98381f8fc8a37c72816a906e9c` | PASS: 52 permitted deliverables 1–4 files only; diff check exit 0; this brief's only later change is the append-only record |

Exact web build commands:

```sh
BOARD_TEAM_FEATURES=off BOARD_SUPABASE_URL=http://127.0.0.1:55321 BOARD_SUPABASE_ANON_KEY=synthetic BOARD_SERVER_URL=http://127.0.0.1:8796 npm run build
BOARD_TEAM_FEATURES=on BOARD_SUPABASE_URL=http://127.0.0.1:55321 BOARD_SUPABASE_ANON_KEY=synthetic BOARD_SERVER_URL=http://127.0.0.1:8796 npm run build
```

Each generated web dist was copied to isolated scratch before the next build.
Base and candidate artifacts were compared as raw bytes, without normalization.
SHA-256 receipts:

| Artifact | SHA-256 |
| --- | --- |
| Off index.html (base = candidate) | `66f0d8d097b0c1b88dba01e2fe87c1233b576b3d0019e81401434a7f58a74c8e` |
| Off notices (base = candidate) | `3367640f4a3b473755079ad41dc46c67bd65ed2dd21a0ca47edcd14944d3a91d` |
| On index.html (base = candidate) | `9829ba305ce746513c6c6bcd3735b505123b2eecd96962d2573b3ef0a65886ee` |
| On notices (base = candidate = runtime notices v3) | `2c7ff36a2ae55948ac01928c713c7f203d1771198cfde411a845693750368c76` |
| Unchanged App.tsx | `051bd75f08fbceabb02390f2eb9c359f99986063af3c4211f09e01feb2f92bfd` |
| Unchanged tests/history.test.mjs | `a73b4131fb93e16f5f8284fe4717e0034eaf0d3d775832ac808a4af2ff938066` |

The new server test/control files also passed `node --check` source syntax
inspection; this did **not** execute a server test or apply SQL. Both Vitest
configurations include S169–S194, with independent fixture setup for each ID and
actual PASS/FAIL plus SUMMARY-HISTORY output when the independent run executes them.

#### Focused implementation evidence and approved choices

| Choice / review focus | Evidence actually run |
| --- | --- |
| AS01 capture timing, confirmed-only manual capture and metadata | H-U01/U03/U05/U16; transactional capture failure preserves fingerprint/deadline, manual equality captures, 100/500 code points, current canonical bytes |
| AS02 newest 50 / 30 elapsed days | H-U02/U04/U10; naming does not renew; expiry gates reads and retains the durable fingerprint |
| AS03 effective access | H-U20 actual room operations: viewer list/preview permitted, viewer mutations 403, no role 404, service failure 503 without empty success or mutation; full HTTP/guest/auth matrix remains S175–S177 |
| AS04 same-ID restore, before state, head conflict and retry | H-U06–U10/U16/U18; fresh revision/generation, consecutive entries, exact retry result after restart/expiry, atomic rollback/pending/cleanup and ordinary seen-ID reuse refusal |
| AS05 current discussion and stale work | H-U13/U16–U18 plus accepted unit regressions; immutable edit generation before receipts, current comments retained, matching/missing/detached anchors reconciled, current identifiers union retained; real notice carry and open-tab proof remains S184–S187/H1 |
| AS06 panel/preview handoff | H-U12/U14/U15/U19 inspect the actual hosted hook/controller and confirmation render: Pan before HTTP, current/viewer/restore handoffs, newer selection wins, cleared access cannot repaint, confirmed-write refresh retries GET only; full geometry/focus/runtime comparison remains H1 |
| AS11 truthful refusals | H-U07–U10/U19/U20; stale head 409, known intent rollback restore_failed, durable/uncertain carry/cleanup restore_pending with lock and backup refusal, no false success |
| Final Read 2: durable canonical fingerprint | H-U02/U03/U10: expiry of all copies, A→B→A at higher revisions/restart, automatic suppression, failed capture atomicity, required current-backup hash/count validation |
| Final Read 2: confirmation attribution | H-U11/U15: namedBy precedes actor, null namedBy falls back to actor, both null render time alone without separator |
| Final Read 2: active Pan | H-U12/U14: production hook before-request activation and passive readOnly-cancellation handoff; Pan retained on current/viewer/restore return with later explicit tools allowed |

H-U16 measured two valid canonical documents of exactly 2,097,152 bytes each:
intent chunks were `[1048576,1048576,1048576,1048576]`, and the metadata-only
journal was **759 UTF-8 bytes**. Completion deleted all four intent rows with the
terminal result and unlock in one transaction. H-U08 separately injected cleanup
failure and verified the pending journal, lock and complete chunks stayed durable.
No document bodies or identifier union are embedded in the journal.

#### Files, limits and next independent run

The validated implementation changes 52 files across:
`apps/server`, `apps/server/src`, `apps/server/src/routes`,
`apps/server/supabase`, `apps/web`, `apps/web/src/state`, `apps/web/src/team`,
`apps/web/src/team/comments`, `apps/web/src/ui`, `packages/board-room/src`,
`packages/board-sync/src`, `tests`, `tests/server`, and the root Vitest configs.
This append adds one file in `docs/briefs` for 53 record-inclusive files. All
numbered requirements, eleven contracts and brief/index bytes before the
Implementation record remain unchanged. App.tsx stays unchanged and within its
264-line budget; module guards pass for 22 hooks and 34 team modules.

V9–V13 were **not run**. No browser, Supabase CLI/stack or hosted schema was used.
S169–S194 are authored for both runners, **not claimed passed**. A fresh independent
full-access check run must write its H1 scenario tool and run H1 (all 27 states,
locales and the three final review focuses in the running build), the independent
base negative control and accepted full unit/server/A–J/X1/C2/W5 regressions.
No older-client/board/file conversion, upgrade, extra browser matrix, load/native
input or unrelated acceptance sweep was run. No new requirement was assumed or
waived; runtime visual and two-store claims remain unverified here.

Mandatory public-boundary hooks printed PASS on the implementation/test commits.
Git emitted a non-fatal packed-refs.lock sandbox permission warning during commit
maintenance; both commits succeeded, branch refs were verified and worktree status
was clean. No permissions or hooks were bypassed. The maintainer retains merge and
publication; this is implementation evidence only.
