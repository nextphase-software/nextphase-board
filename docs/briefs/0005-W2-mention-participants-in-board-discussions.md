BRIEF VERSION: 0005-W2 v1 (2026-11-05)
# 0005-W2 — Mention participants in board discussions

Status: Draft. Implementation has not started under this brief.
Contracts (new versions):
[0005 comments v2](../architecture/0005-comments-v2.md),
[0003 access v6](../architecture/0003-access-v6.md),
[0003 identity v4](../architecture/0003-identity-v4.md),
[0003 sync v7](../architecture/0003-sync-v7.md),
[0003 API v6](../architecture/0003-api-v6.md),
[0003 hosted persistence v6](../architecture/0003-hosted-persistence-v6.md),
[0003 hosted storage v6](../architecture/0003-hosted-storage-v6.md),
[0001 interaction v32](../architecture/0001-interaction-v32.md),
[0001 web modules v30](../architecture/0001-web-modules-v30.md),
[0003 self-host runner v2](../architecture/0003-self-host-runner-v2.md).
Unchanged and still in force: [0004 presence v1](../architecture/0004-presence-v1.md),
[0001 document v11](../architecture/0001-document-v11.md),
[0001 storage v3](../architecture/0001-storage-v3.md),
[0006 board file v2](../architecture/0006-board-file-v2.md),
[0001 toolchain v5](../architecture/0001-toolchain-v5.md),
[lock v5](../architecture/0001-dependency-lock-v5.json),
[inventory v5](../architecture/0001-dependency-inventory-v5.json) and
[runtime notices v3](../architecture/0001-runtime-notices-v3.txt).
Where an inherited contract names an earlier version replaced here, the versions above apply.
This brief specifies current clients and formats. Requirements/checks for older clients,
older saved boards/files or old-binary upgrade order in inherited contracts/briefs do not apply;
preview data may be reset. Current-format persistence, restart, restore and access fences do apply.

## Outcome

Type @ in a hosted board's new comment, reply or own-comment edit, choose a permitted participant,
and insert their name as blue text. Viewers and granted guests can participate; the picker includes
people who are offline. Equal names remain distinguishable by board-person suffixes. Unpicked or
pasted @text is ordinary text. A mention grants no access or invitation.

Each distinct permitted recipient except the author gets one unread in-app mention notice on
Home, even when their board is closed. Notifications retains the latest 50 across workspaces,
with explicit read/unread, Mark all as read and dismissal. Opening a notice takes the person to
the current pin, thread and exact comment in this tab; only explicitly displayed comments become
read. Edits, deletion and access changes clean up notices without replay after dismiss/eviction.

The room stores comment ranges and durable pending work; Supabase stores reference-only account
inboxes and fences. Delivery may retry without duplicating or resurrecting notices. Offline
drafts stay in tab memory, never queued for automatic send. The existing 16 MiB backup envelope
may explicitly refuse a legal board; this milestone promises no universal backup fit. Local boards,
board JSON/file bytes, Undo and save states stay as they are. No dependency is added.

## Read first and prerequisite contracts

Read [CONTRIBUTING.md](../../CONTRIBUTING.md), [AGENTS.md](../../AGENTS.md),
[DESIGN.md](../../DESIGN.md), all ten new contracts above and their linked unchanged functional
prerequisites. Comments v2 owns range/lifecycle/check order; access v6 and identity v4 own the
roster and service-only projection; sync v7 owns immutable comment messages; API v6 owns routes;
hosted persistence v6 owns layout 4, bounded current notification state, backup refusal and restore;
hosted storage v6 owns browser state; interaction v32 carries the complete concrete look and words;
web modules v30 owns boundaries; self-host runner v2 covers both runners and two-store backups.
If this brief appears to differ from a contract, report it before dependent work.

The implemented [0005-W1 brief](0005-W1-discuss-and-resolve-anchored-ideas.md) supplies current
comment/anchor behaviour and the C1 regression. The [0006-W1 brief](0006-W1-export-and-restore-a-portable-board.md)
supplies current-format Home import/creation. The [0003-W4 brief](0003-W4-sign-in-share-and-see-access.md)
supplies the local-stack setup; the [0004-W2 brief](0004-W2-recover-shared-edits-after-interruption.md)
supplies immutable requests and the existing leave decision. Their older-format checks are not
new requirements here.

## Deliverables and boundaries

The base is the committed-main revision containing this brief, recorded in the implementation
record. New source files start with `// SPDX-License-Identifier: Apache-2.0`; use readable small
modules with the jobs below. Only the following implementation files may change.

1. **Server and service SQL**:
   - `apps/server/src/routes/mentions.ts` (new): the five API v6 routes, current access/target
     checks and account-owned actions. `apps/server/src/app.ts` wires them;
   - `apps/server/src/routes/boards.ts`: current sync v7 ticket/join wiring only; retain import
     and creation behaviour;
   - `apps/server/src/supabase.ts`: service roster/key projection, leases, reference reads/actions,
     projection and clear methods, and reads of the live document/mention generation checkpoints
     for marked-volume recovery; no browser service key;
   - `apps/server/src/runtime.ts`, `apps/server/src/start-node.ts`,
     `apps/server/src/worker-room.ts`, `apps/server/src/worker-runtime.ts`: room discussion reads,
     delivery/restore plumbing for the same shared room on both runners. Node marked-volume
     recovery advances its durable fence above both live checkpoints and restored room/fence
     generations before clearing/unlocking (hosted persistence v6); fail closed on either read;
   - `apps/server/src/delivery.ts`: shared minute notice retry, all live boards, concurrency 10,
     before the existing access pass;
   - `apps/server/supabase/nextphase_board.sql`: access v6's three tables, indices, RLS, explicit
     privileges, functions and access-change trigger, repeatable as the existing setup file;
   - `apps/server/README.md`: current schema setup, delivery and backup/restore instructions only.
2. **Room and shared client**, under the named folders:
   - `packages/board-room/src/mentions.ts` (new): atomic source work, current-target reconciliation,
     pending cap/cleanup and fenced projection;
   - `packages/board-room/src/comments.ts`, `access.ts`, `backups.ts`, `interfaces.ts`, `protocol.ts`,
     `room.ts`, `storage.ts`, `tickets.ts`: comments v2's check order, ranges, source transaction,
     lease pruning, current layout 4, current backup validation and restore locks. These filenames
     are all relative to `packages/board-room/src/`;
   - `packages/board-sync/src/mentions.ts` (new): pure range/participant/editor rules;
     `packages/board-sync/src/comments.ts` and `packages/board-sync/src/session.ts`: current
     mention-bearing records and immutable serialized requests with epoch/restore generation.

   Do not change board edit recovery, Undo, the document, its adapters or exported/file data.
3. **Web app**, with team features on only:
   - `apps/web/src/team/comments/mention-editor.tsx`, `apps/web/src/team/notifications.tsx`,
     `apps/web/src/team/notification-navigation.ts` (new), with web modules v30's exact jobs;
   - `apps/web/src/team/comments/card.tsx`, `layer.tsx`, `panel.tsx`, `rules.ts` (last three names
     relative to that same comments folder): editors, saved spans, filters, explicit-display reads
     and landing/draft state;
   - `apps/web/src/team/home.tsx`, `home-menu.tsx`, `hosted-board.ts`, `team-app.tsx` (last three
     relative to `apps/web/src/team/`): wiring only;
   - `apps/web/style.css`: W2 rules from interaction v32, keeping existing v30/v31 values, the
     edit wrapper padding and unrelated rules. Preserve equivalent computed values.

   `App.tsx` stays unchanged and at most 264 lines; exactly 22 state hooks and 31 team modules.
4. **Tests and test-only controls**:
   - `tests/mentions.test.mjs` (new): pure code-point normalization/range validation (including
     non-BMP text, null, overlap, spelling, 20/21 ranges and 256-byte labels), candidate order/pages
     and suffixes, chip editing/plain paste/local undo, immutable request/body/epoch/generation,
     current-format room initialization and backup validation, no automatic comment replay, and
     unchanged canonical document/file/local records/board Undo. Import modules inside each test
     so the base can fail each new test by name. No browser/Supabase needed;
   - `tests/server/mentions.test.ts` (new): S143–S167 below on both runners and the focused Node-only S168, with
     `SUMMARY-MENTIONS` counting actual pass/fail results;
   - `vitest.node.config.ts`, `vitest.workerd.config.ts`: include that new server test file only;
   - `tests/modules.test.mjs`: only v30's module list/name and shared mentions import exception;
   - `tests/comments.test.mjs`, `tests/presence.test.mjs`, `tests/team-import.test.mjs`: only
     current layout-4 expectations, current backup table shape, the new restoreGeneration field
     in current message fixtures, and removed capability fields; keep functional assertions. Older-layout/backup fixtures are not required;
   - `tests/removal.test.mjs`: scheduler stubs return no boards for `mention_boards`, preserving
     access-delivery assertions;
   - `tests/server/suite.test.ts`: S48 expects 13 RLS-enabled service tables and denies writes to
     all three new ones; keep other assertions;
   - `tests/server/shared.test.ts`: S121 becomes current layout-4 creation/idempotence/restart
     with edits/receipts kept; S133's malformed backup checks use current layout-4 tables/ranges,
     and its small ordinary-label fixture remains under 16 MiB; S134 expects storage version 4.
     Current import assertions stay; update only shared comment fixture envelopes for the new
     restoreGeneration field. No older-format migration proof is required;
   - `tests/server/setup.ts`: add only proxy `holdBefore`/release control, alongside existing
     fail/failAfter/hold/delay and RPC log. Keep synthetic people's domains and existing ports;
   - `tests/server/node-test.ts`, `tests/server/driver-workerd.ts`: test-only ordered `roomSQL`,
     explicit `deliverMentions` and current-initialization failure injection; Node wrapper passes
     through discussion/delivery and adds test-only failure injection for each live checkpoint
     read. Existing access/restore/drop controls and the driver’s volumeCopy stay;
   - `tests/README.md`: document the new tests and current-format amendments.
5. **Documentation**: append only this brief's implementation record after implementation.
   Both index entries and the ten new contract files are prerequisites, not implementation edits.

Outside the named new controls, the existing screens' markup stays exactly as at the base.
The named changes are hosted comment textboxes/spans/picker, mention-only filter/sort/count,
notification landing/focus/highlight and Home account/bell/inbox/menu/status states. Existing
Import, New board, toolbar, avatars, Share, canvas and local boards retain their look and behaviour.
The team-off A–J comparison (V12) adds no mask. No private input is required to implement the
public contract. If another file or dependency is needed, stop and report the concrete reason.

Nothing else in `apps/`, `packages/`, `scripts/`, `supabase/`, any `package.json`, the lock,
test drivers, state hooks or existing test files changes. In particular, `supabase/config.toml`,
`tests/server/driver-node.ts`, build scripts and package manifests stay unchanged. Temporary local
ports/output directories belong to check-run scratch settings, not committed test configuration.
No hosted project, deployment, real customer content, invitation or external message is used.

## Server checks

Both `npm run test:server:node` and `npm run test:server:workerd` run S143–S167 against the local
stack with independent synthetic accounts/boards, ordered socket holds, fixed clock/SQL controls
and the proxy's failure/hold/release controls. Use existing fixture roles owner/editor/viewer/
granted/outsider, adding another granted guest and equal registered labels as needed. All IDs,
leases and offsets are checked from actual rows/wire, not a screenshot. “Unchanged” on refusal
means comment, receipt, sequence/count, targets/pending and inbox compared before/after, allowing
only independently necessary access cleanup. No case requires older clients/files/layouts. S168 is Node only: the physical data-folder
rewind uses the existing driver volumeCopy control and current layout-4 data.

| ID | Check |
| --- | --- |
| S143 | Effective-role roster includes offline owners/editors/viewers and permitted guests; guest caller excludes another guest but includes self; pending, disabled, ungranted and outsider absent; no-role GET is 404; page size 20 and more reaches every permitted candidate |
| S144 | Registered local-part labels, case-insensitive substring, label/person order, equal-label 8-hex suffix extending on collision, invalid/empty/over-256-byte labels excluded; public keys exactly person/label/suffix, no accounts/emails/leases |
| S145 | Pick then remove or hide a newly selected target before start/reply/edit: mention_unavailable, whole action unchanged; retained historical range is allowed; guessed invisible key and mismatched label refused with no partial comment |
| S146 | Save 😀 @ben with start2/end6; stored JSON text and current snapshot/change frames exactly match comments v2's shape/label/key; reopen/restart preserves them and plain comments have [] |
| S147 | Current protocol accepts structured ranges without capability negotiation; omitted array is plain [], explicit null/malformed metadata refused; a current join and snapshot always expose current records |
| S148 | Exercise ordered overlapping refusals: access/epoch, restore generation, receipt/digest, text, existence/authorship, mention limit/shape/availability/pending cap, anchor, board/rate limits; shifted retained ranges stay historical; no silent text/offset rewrite |
| S149 | Repeated ranges/self mentions, retained recipient edit (same occurrence/read/createdAt), added/removed recipients, remove-then-add fresh unread occurrence; unpicked @text and ordinary replies notify nobody |
| S150 | 51 notices across boards/workspaces leave latest 50/account ordered by creation time then delivery ordinal; oldest eviction/dismiss physically deletes, no backfill or resurrection; CAS obsolete read retry cannot reverse a newer unread |
| S151 | At 1,000 pending creation pairs, another adding action gets mention_pending_limit atomically; plain actions and delete/access cleanup still work, one cleanup marker only; source rows and receipt commit/rollback together |
| S152 | Reply deletion clears its pending and read/unread notices; root/thread deletion clears all replies' recipients; resolve/reopen keeps occurrences/read state |
| S153 | Save answer lost then explicit same-body/request/epoch/generation retry: one comment/receipt; delivery answer lost, restart, newer batch and retry: no duplicate or dismissed/evicted resurrection |
| S154 | Highest remaining role keeps lease/notices; final loss purges, new grant gets fresh lease and no old notices; removing author keeps permitted discussion/notices |
| S155 | All 13 tables RLS-enabled; new authenticated SELECT returns no rows, writes and new RPC execution denied; foreign guessed notice/open/actions reveal nothing; 404 denial differs from 503 service failure with no preview |
| S156 | Measure actual UTF-8 range/frame and aggregate backup bytes: 2,000 legal comments, exactly 4,194,304 text bytes, 812 with twenty maximal 256-byte labels, rest plain. Record complete-envelope bytes and assert 413 backup_too_large beyond 16,777,216; never raise the bound. Show 2,000×20 maximal-label text would be 10,318,000 bytes and is invalid. A small legal current backup succeeds |
| S157 | Panel/list/open reads have no read side effect; displayed route reads only supplied live comment IDs for caller; read/unread survive fresh reads; Mark all uses seen IDs/versions so concurrent new notice unread; obsolete CAS is no-op |
| S158 | Restart keeps saved comment/pending work; current-format logical restore validates first, raises independent fence, clears restored source/projection, keeps historical ranges with no replay; held older work cannot cross new generation; unavailable clear keeps room locked |
| S159 | Fresh current layout 4 creation is transactional/idempotent on this runner; forced current initialization write failure rolls back. Current backup malformed/missing tables, invalid range JSON and JSON null return400 before any fence/row change; valid current restore preserves ranges without delivery replay |
| S160 | Print rows and serialized bytes for every room table, runner fence and all three new SQL tables; prove at most40,000 current pairs/board,1,000 pending+one marker,50/account,one checkpoint/live board; lease rows follow current access. Identify existing lifetime-growing receipts/identifier/access/Yjs history, without claiming a global fixed bound |
| S161 | Author loss preserves discussion; every service-only mention function denies direct authenticated execution; server resolves current permitted data without leaking account IDs |
| S162 | Final-role loss/disable prunes pending/current pairs on room access replay even if recipient never joined; regrant gets a new lease and historical ranges produce no revived notice |
| S163 | Fail live authorized room read during list/open:503, no current preview and retained reference unchanged; recover and Retry succeeds; denial/deletion instead404/no preview |
| S164 | Hold/reorder creation, retained edit, removal, read/unread, dismiss and cap eviction; newer batches skip creations already covered by checkpoint; no removed/read/dismissed state is resurrected |
| S165 | Restart runner with durable pending work and closed recipient board; the actual Node 60,000ms pass / Workers scheduled dispatch enumerates every live board with concurrency≤10 and delivers before access pass; record functional wait without a latency target |
| S166 | Move/delete anchored object and board Undo/Redo: occurrence/read state unchanged, current attached point follows saved box, detached point remains authoritative after Undo |
| S167 | Measure actual serialized current request/frame for4,000 normalized code points and twenty256-byte labels (non-BMP and escaped characters included); each below 1,048,576 bytes and carrying all 20 exact stamped ranges; canonical board export unchanged |
| S168 | Node only, current-format volume restore: take a data-folder copy including the independent fence, then hold/fail document copying while successful logical restore/mention clearing advances live mention_delivery.generation above boards.document_generation. Assert that inequality before rewinding. Restore the copied room/fence with volumeCopy/mark-restored-volume.mjs and reopen: the new durable generation is strictly greater than both live checkpoints and both restored generations before clear/unlock; projection is cleared at that generation. A fresh explicit mention then delivers and held pre-rewind work cannot revive old notices. Separately fail each checkpoint read: room remains locked with no clear/unlock, then succeeds after explicit retry with reads restored. Record the before/after checkpoint/fence values; no older-format fixture |

## Browser checks

New scenario **C2** runs in Chrome on the candidate's team-on build against the local Supabase
stack and Node runner; `allowedOrigin` matches the page origin. Default window1280 × 800,
page keyboard events only; C2-S66 uses 375 × 812. Each row emits `PASS: C2-S<n> <name>` or
`FAIL: C2-S<n> <name>`. C2-S30 runs separately with team features off. The browser runner may
adjust choreography to real DOM but preserves each row's meaning and expected values.

Use interaction v32's complete synthetic fixture: Ana in Acme/Studio; Ben, viewer and granted
guests, equal alex labels and the full21-candidate roster; no-role and disabled accounts.
The three240 × 240 Rose stickies, root/reply texts, notice previews/times and all exact words are
in its Synthetic comparison fixture/Exact words sections. Synthetic key suffixes in drawings are
not literal live account keys. Set the clock relative to actual saved times for12 min ago,
2 min ago,1 hour ago,Yesterday; do not change the application's time rules to match a picture.
Use network holds/failures and actual app state for loading/pending/refusal screens, never painted
replacement controls. Compare declared computed values/rectangles within 0.5px, exact copy,
colours and font sizes/weights, with the corresponding approved state.

| ID | Check |
| --- | --- |
| C2-S1 | Every permitted online/offline role, guest isolation and duplicate labels match access v6/identity v4; page20 and More reach zoe, no full emails/accounts/leases |
| C2-S2 | Newly chosen stale/hidden recipient on post/reply/edit refuses atomically, keeps @ben, please confirm Friday. and chip with exact unavailable-recipient sentence; no outgoing plain fallback |
| C2-S3 | New comment @ query, Up/Down wrap, PageDown/PageUp, @be and Enter insert @ben without posting; caret/focus and blue transparent unpadded mention match interaction v32 |
| C2-S4 | Pointer, Tab and Enter select in Reply and own Edit; @ben, @be keeps first chip while second query active; insertion never submits and Cancel/Save remain |
| C2-S5 | @zz shows No matching participants.; Enter never posts, Tab moves, Escape preserves query; loading/failure hints and composition command guards work |
| C2-S6 | Atomic adjacent Backspace, typing into chip, selection replacement, plain copy/cut/paste and local Undo/Redo; board objects/Undo unchanged; actual multiline text preserved |
| C2-S7 | Save/reload exact code-point ranges,20 accepted/21 refused; self and repeated targets obey grouping; plain @text sends no notice; historical range stays blue |
| C2-S8 | Current joined client sends immutable mention-bearing requests, explicit null/malformed ranges refuse without erasing metadata; no capability/older-client setup required |
| C2-S9 | Before/after comment/mention actions compare canonical export, current Board file bytes, local records, board Undo and save state: unchanged |
| C2-S10 | Closed-board recipient receives one notice; latest 50 account-wide across Acme/Studio;51st evicts oldest permanently; no self/plain-text/ordinary-reply notice |
| C2-S11 | Panel open marks none read; per-row read/unread and dismissal update only after confirmation; a new browser sees saved state |
| C2-S12 | Hold Mark all request while a new notice arrives: Marking…/Marking the retained list as read…; new notice remains unread after retained cutoff confirms |
| C2-S13 | Pointer notice open uses same-tab #/b/<boardId>, waits snapshot, reveals current pin/exact reply, focuses heading then Reply, posts nothing; Escape returns source notice/canvas |
| C2-S14 | Keyboard notice open reaches resolved/detached threads through filters, keeps state/saved point; exact resolved sentence, no redundant card/list unlink icon, pin badge retained |
| C2-S15 | Retained edit preserves occurrence/read state; adding recipient notifies once; removal withdraws; remove-then-add gets fresh unread occurrence |
| C2-S16 | Reply, root and thread deletion remove exactly their recipients' references, including read/pending; others remain |
| C2-S17 | Resolve/reopen keeps notice; object deletion/Undo/Redo keeps authoritative detached pin and occurrence/read state |
| C2-S18 | Dismiss only this account's notice; discussion and another recipient remain; repeated delivery cannot revive it |
| C2-S19 | Surviving role keeps notice; final loss clears board/draft/inbox memory; old link generic unavailable; regrant does not revive |
| C2-S20 | Author loss keeps permitted discussion; foreign IDs deny without preview; failed inbox/open reads show exact failure+Retry with no cached preview as current |
| C2-S21 | Read current both-runner S151 evidence for atomic source/cap/cleanup; missing or failing evidence fails this row, never inferred from browser pictures |
| C2-S22 | Explicit lost-save Retry uses identical request/body/epoch/generation once; read both-runner S153 restart/lost-delivery evidence; no duplicate/resurrection |
| C2-S23 | Read both-runner S158/S162/S164 held-work restore/regrant fences; missing evidence fails |
| C2-S24 | Read both-runner S159 current initialization/backup validation evidence and S151 cleanup-at-cap; no older-layout fixture |
| C2-S25 | Read both-runner S156/S160/S167 actual serialized byte/inventory evidence; assert the explicit backup refusal, no universal-fit claim |
| C2-S26 | Only your threads includes mentioned recipient; Unread mentions first sorts but retains read threads;1 unread mention, plural and exact empty words; ordinary unmentioned replies add no unread |
| C2-S27 | Keep the first thread card open with its text/chip draft; use Board → Back to files to navigate to Home in the same loaded tab (no ordinary card Close/Escape and no page reload). Open Notifications and keyboard-open the second thread's notice, Escape back to its source inbox, then keyboard-open the first thread's notice. The first draft’s exact text and one chip return, and outgoing comment count is unchanged; cross-board path uses existing leave decision |
| C2-S28 | Offline field keeps @ben, please confirm Friday. and chip; exact offline-with-mentions sentence, Post/Save off; reconnect refreshes candidates without auto-send |
| C2-S29 | Fail read/unread/dismiss/Mark all actions: row/dot remain, exact pending words+Retry; no automatic replay. Confirmed action followed by failed canonical read retries only the read; obsolete CAS never falsely wins |
| C2-S30 | Team off: no bell/editor/picker/Comment tool, no mention/inbox/application request; local controls and records as base |
| C2-S31 | Visual state **picker-empty**: 20 first-page rows, More,300px picker/max viewport−24, scroll max200,40px rows, selected #7051cf on #f5f0ff; exact heading/hint. All other values/copy are interaction v32’s corresponding section |
| C2-S32 | Visual state **picker-matches**: @be matches ben, no post on insertion; exact heading/hint. All other values/copy are interaction v32’s corresponding section |
| C2-S33 | Visual state **picker-equal**: @al has two distinct alex options with 8-hex board-key suffixes; literal drawing suffixes18b42ca1/7c4e90bd only in isolated visual fixture. All other values/copy are interaction v32’s corresponding section |
| C2-S34 | Visual state **picker-more**: More/PageDown reaches zoe, continued heading Mention a participant · More results; PageUp returns. All other values/copy are interaction v32’s corresponding section |
| C2-S35 | Visual state **picker-no-match**: @zz, No matching participants., Esc keeps your text. All other values/copy are interaction v32’s corresponding section |
| C2-S36 | Visual state **picker-loading**: held roster: Loading participants…, query kept, no old candidates. All other values/copy are interaction v32’s corresponding section |
| C2-S37 | Visual state **picker-failed**: failed roster: Couldn’t load participants. Try again., Retry, Esc keeps your text. All other values/copy are interaction v32’s corresponding section |
| C2-S38 | Visual state **composer-chip**: @ben, please check Friday.; blue transparent atomic text, composer300 ×42 at 458/292. All other values/copy are interaction v32’s corresponding section |
| C2-S39 | Visual state **reply-picker**: @ben, @be; first chip, active query, same picker in Reply. All other values/copy are interaction v32’s corresponding section |
| C2-S40 | Visual state **edit-chip**: @ben, please confirm Friday.; edit wrapper border 1px#7051cf/radius 8/padding 6px8px, inner editor min 24, Cancel/Save. All other values/copy are interaction v32’s corresponding section |
| C2-S41 | Visual state **posted**: exact root/reply text blue in card and panel; author-only menus. All other values/copy are interaction v32’s corresponding section |
| C2-S42 | Visual state **edited**: @ben, please confirm Friday.;12 min ago · edited. All other values/copy are interaction v32’s corresponding section |
| C2-S43 | Visual state **landing**: heading3px#7051cf focus ring/offset 3/radius 2; target3px left border/#f5f0ff/padding-left 11; exact reply and Reply next. All other values/copy are interaction v32’s corresponding section |
| C2-S44 | Visual state **landing-resolved**: Resolved. Replying reopens this thread.; faded pin .55, state remains resolved. All other values/copy are interaction v32’s corresponding section |
| C2-S45 | Visual state **landing-detached**: Detached notes, no redundant card/list unlink icon; pin badge and saved point kept. All other values/copy are interaction v32’s corresponding section |
| C2-S46 | Visual state **comments-unread**: 1 unread mention; dark menu right 20/top 118, Sort by, Oldest first/Unread mentions first radio group. All other values/copy are interaction v32’s corresponding section |
| C2-S47 | Visual state **comments-filter-empty**: No threads you started, replied to or were mentioned in.. All other values/copy are interaction v32’s corresponding section |
| C2-S48 | Visual state **stale-recipient**: newly selected recipient revoked: exact refusal; complete draft/chip kept. All other values/copy are interaction v32’s corresponding section |
| C2-S49 | Visual state **stale-edit**: first make root plain, then newly choose target and revoke before Save: exact refusal and kept edit; never reject historical range as new. All other values/copy are interaction v32’s corresponding section |
| C2-S50 | Visual state **historical-mention**: retained saved @ben remains blue with no role badge after target loss. All other values/copy are interaction v32’s corresponding section |
| C2-S51 | Visual state **offline-draft**: You’re offline. Your reply and mentions stay here; post when the board is back.; Post off, draft/chip retained. All other values/copy are interaction v32’s corresponding section |
| C2-S52 | Visual state **bell-unread**: bell40 ×40 at 187/14, red content8 ×8 +white border 2, account171 ×44 at 12/12; Import/New board unchanged. All other values/copy are interaction v32’s corresponding section |
| C2-S53 | Visual state **bell-read**: same bell with no dot when all retained notices read. All other values/copy are interaction v32’s corresponding section |
| C2-S54 | Visual state **notifications-mixed**: panel x12/y62/w400; latest three fixture notices across Acme/Studio, two unread backgrounds/dots and one read; open marks none. All other values/copy are interaction v32’s corresponding section |
| C2-S55 | Visual state **notifications-actions**: 208px Home menu, More.bottom+6/right aligned; Mark as read then Dismiss notification. All other values/copy are interaction v32’s corresponding section |
| C2-S56 | Visual state **notifications-all-read**: no bell/row unread dots, white rows; Mark as unread then Dismiss notification. All other values/copy are interaction v32’s corresponding section |
| C2-S57 | Visual state **notifications-empty**: No mentions yet / When someone mentions you in a board discussion, it will appear here.. All other values/copy are interaction v32’s corresponding section |
| C2-S58 | Visual state **notifications-loading**: Loading notifications…; last confirmed bell dot, previews cleared. All other values/copy are interaction v32’s corresponding section |
| C2-S59 | Visual state **notifications-failed**: Couldn't load notifications / Board’s server didn’t answer. Try again. / Retry; no previews. All other values/copy are interaction v32’s corresponding section |
| C2-S60 | Visual state **notifications-pending-read**: Read status not saved. Retry when you’re online. / Retry; unread row/dot retained. All other values/copy are interaction v32’s corresponding section |
| C2-S61 | Visual state **notifications-pending-dismiss**: Dismissal not saved. Retry when you’re online. / Retry; row retained. All other values/copy are interaction v32’s corresponding section |
| C2-S62 | Visual state **notifications-mark-all**: Marking… / Marking the retained list as read…; shared amber note, rows/dots retained. All other values/copy are interaction v32’s corresponding section |
| C2-S63 | Visual state **notifications-mark-all-failed**: Read status not saved. Retry when you’re online. / Retry; shared banner and retained cutoff. All other values/copy are interaction v32’s corresponding section |
| C2-S64 | Visual state **discussion-unavailable**: This discussion is no longer available.; no target title/author/text, remove denied board card. All other values/copy are interaction v32’s corresponding section |
| C2-S65 | Visual state **discussion-open-failed**: Couldn't open this discussion / Board’s server didn’t answer. Try again. / Retry; no target preview. All other values/copy are interaction v32’s corresponding section |
| C2-S66 | Visual state **narrow-notifications**: 375 ×812: inbox x12/y62/w351, bell x107/y14, account91 wide; Import x199/y12/40 ×40, New board x247/y12/116 ×40. All other values/copy are interaction v32’s corresponding section |

**C1 regression amendments.** Run C1-S1–S23 from the 0005-W1 brief with its accepted review
corrections, preserving posting, anchors, detach, resolve, authorship, deletion, immutable retry
and no-access assertions. Read textboxes as actual `innerText` when contenteditable, retaining
textarea reads where used; check `aria-readonly` for editable fields. Use control-excluding own
text for notes with fields (especially C1-S21). Change only the intentional interaction v32
Only-your empty sentence, new radio sort menu, and notification-landing heading→Reply sequence;
ordinary C1 pin/thread entry retains its prior focus path. C1-S19 compares declared look properties
against v32 where replaced and v30 elsewhere, including wrapper/inner editor geometry, with no
unsupported shorthand aliases. Do not erase unrelated look failures. C1-S18 uses team off.
No W2 recovery or W5 Home scenario replay is part of this milestone.

## Numbered acceptance criteria

- **0005-W2-AC01:** Every permitted owner/editor/viewer/granted guest can choose an online or
  offline participant under the declared visibility rules in a new comment, reply or own edit.
  Keyboard/pointer insert the correct blue atomic mention, including equal labels; plain @text
  does not notify. Invalid/newly unavailable/invisible/over-limit selections refuse the whole
  action with drafts kept. Saved ranges retain identity after reopen. Board document, file/export,
  local records, Undo and save state stay unchanged.
- **0005-W2-AC02:** A saved mention yields one unread notice per distinct permitted non-author
  recipient, even with the board closed. Home retains latest 50 across workspaces,51st evicting
  oldest. Panel open reads none; explicit fully displayed target comments, per-row actions and
  Mark all persist per account, and concurrent new notices remain unread. Open reaches exact
  current comment/pin/thread in this tab with heading then Reply focus, including resolved and
  detached states without reopening or posting. Mention-only unread/filter/sort and approved
  desktop/narrow states match interaction v32.
- **0005-W2-AC03:** Edit/remove/delete/dismiss/resolve/access events obey comments v2's complete
  lifecycle. Denied/foreign/stale targets reveal no discussion content; regrant revives nothing.
  Source save/receipt/pending work is atomic and survives restart; retries and held/reordered work
  never duplicate or resurrect removed/dismissed/evicted occurrences. Offline states are truthful,
  keep drafts and send nothing automatically. Current-format restore validates before fences,
  clears/suppresses historical delivery and stays locked on service failure. A current Node volume
  restore raises its durable generation above the document and mention checkpoints and restored
  room/fence generations before clearing/unlocking; either checkpoint read failure keeps it locked. Backup capacity is
  the explicit16,777,216-byte aggregate/refusal boundary, not universal fit. No outside delivery.

| Criterion | Evidence that shows it |
| --- | --- |
| 0005-W2-AC01 | S143–S148; S167; C2-S1–S9; C2-S28; C2-S31–S42; C2-S48–S51; V4 |
| 0005-W2-AC02 | S149–S150; S157; S166; C2-S10–S14; C2-S26–S27; C2-S43–S47; C2-S52–S66 |
| 0005-W2-AC03 | S149–S168; C2-S15–S25; C2-S28–S30; C2-S48–S51; C2-S58–S65; V4; V11–V13 |

## Validation commands and expected evidence

From repository root with Node 26.13.0 / npm11.20.0:

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
```

Copy each `apps/web/dist` aside before the next build. Generated ignored output (including
`meta.json`) is not a source change. The full-access check run starts its own local stack:

```sh
node tests/server/make-signing-key.mjs
npx supabase start
node tests/server/write-stack-info.mjs
npm run test:server:node
npm run test:server:workerd
npx supabase stop
```

The suite applies the current plain SQL schema through its normal setup. Use independently
owned disposable stacks/contexts and scratch outputs; never candidate-schema state for the base.
Public files and logs contain synthetic values only. Keep service/local Auth keys out of evidence.

| Check | Pass condition |
| --- | --- |
| V1 | Every package.json and package-lock.json byte-identical to base; no added dependency/inventory/notice |
| V2 | npm ci exits 0 |
| V3 | npm run typecheck exits 0 for all five members |
| V4 | npm test has 0 failures; tests/mentions.test.mjs passes; existing assertions unchanged except item 4's exact current-format/module/scheduler amendments. No new older-format acceptance requirement |
| V5 | Off build exits 0; index.html and THIRD_PARTY_NOTICES.txt byte-identical to base off build; meta.json has no node_modules/@supabase/ or apps/web/src/team/ input; audit:licenses exits 0 |
| V6 | build:fixtures and on build exit 0; index.html equals base on build; notices equal runtime notices v3; audit:licenses exits 0 |
| V7 | build:server, Worker dry run and audit:licenses exit 0; no deployment |
| V8 | git diff --name-status <base>..<validated> contains only items 1–4; this brief's record is a later documentation-only commit |
| V9 | C2-S1–S29 and C2-S31–S66 pass on team on, C2-S30 on team off; all 36 state comparisons and current both-runner proof links present |
| V10 | Once on a fresh stack from a checkout of base, all new team-on C2 checks fail by name (including missing routes/modules/controls); C2-S9 and C2-S30 are unchanged-boundary controls and may pass on both. New mention unit tests, S143–S167 on both runners and S168 on Node fail by name for missing new behaviour. Use current-format base fixtures only, never mixed client/server or old-file upgrade checks; keep every actual result, do not label an unrun row passed |
| V11 | Accepted full server suites: Node S1–S50,S55–S168; workerd S1–S36,S38–S42,S44–S50,S55–S69,S71–S167, with S37/S43/S70/S168 Node-only. Item4's current-format amendments apply, and earlier-format-only subchecks are excluded from acceptance. S143–S167 pass on both and S168 passes on Node; all suite summary lines have fail 0 |
| V12 | Accepted A–J off-build comparison against base: no markup/focus/canvas/saved-record difference, only existing saved-time normalization; no new mask |
| V13 | Accepted amended C1-S1–S17,C1-S19–S23 on team on and C1-S18 on team off pass; preserve every original functional assertion, change only the explicit amendments above. Classify failures from actual base source/tests; do not turn a harness failure into a pass |

The implementer runs V1–V8 and records exact commands/results. Browsers cannot start and the
Supabase CLI cannot run in its workspace-write environment; neither is needed for those checks.
A fresh independent full-access check run repeats V1–V8 on a clean clone, then runs V9–V13,
reporting one PASS/FAIL V-line per row plus every C2/C1/S line and summary. Record validated
source/test revision separately from later implementation-record tip. Missing evidence stays missing.

Accepted regression runs are the full unit suite, full server suites on both runners, A–J
team off and the amended C1 scenario. No fixture-harness sweep, W2/W5 replay, browser matrix,
load/performance, native input-method or screen-reader campaign. Existing compatibility-only
checks, if incidentally executed by a full suite, do not establish an acceptance obligation.
A Safari sample is chosen at review, not fixed here. Boundary hooks remain mandatory.

## Exclusions and reasons

- Email, push, external messages/invitations, group and text-object mentions: in-app discussions only.
- Ordinary-reply subscriptions, preferences, inline inbox reply, pagination, expiry and backfill:
  latest 50 mention references only.
- Rich text, reactions, images, local-board comments and comment/inbox data in board JSON/files/Undo.
- Automatic offline comment or account-action replay, or an on-device comment/inbox database.
- Older-client/saved-board/file compatibility, older-backup conversion and old-binary upgrade order.
- A distributed transaction between room and Supabase, globally bounded lifetime history, guaranteed
  backup of every legal board, measured latency/scale, and hosted schema application/deployment.

## Implementation record

(Appended by the implementer.)

### Implementation handoff — 2026-11-05

- Brief: **0005-W2 v1**, with exactly the ten replacement contract versions named above.
- Branch: `codex/0005-W2-mention-participants-in-board-discussions`.
- Committed-main base: `b6f83e4c0f2f84e448094995fb47c5aafccdcfd0`; the milestone worktree
  started clean at that revision. No unrelated work was present or changed.
- **Validated source/test revision: `b36c78e5c1b2a2ccef8586870514a8a8564597ce`.**
  The implementation-record commit follows it and changes only this brief. The final
  record-inclusive branch tip is reported separately in the handoff.
- Added dependencies: **none**. Package manifests, lock, dependency inventories and notices
  are byte-identical to the base. `App.tsx`, state hooks, board document/adapters/export/file
  code, `supabase/config.toml` and `tests/server/driver-node.ts` are unchanged.

The implementation adds current-protocol mention ranges, the permission-limited participant
picker, atomic room targets/pending work, reference-only account notifications and versioned
read/unread/dismissal actions. It keeps the approved W2 stylesheet values and edit-wrapper
padding. Same-board notification navigation retains open-thread drafts, chips and immutable
unconfirmed requests through Back to files in the loaded tab; ordinary card Close/Escape
still discards that draft. Confirmed inbox writes followed by a failed canonical refresh retry
only the read. Current layout-4 creation, backup validation and restore fencing replace the
starting implementation's older-format/capability paths.

Node marked-volume recovery reads both live checkpoints and advances the durable independent
fence above their maximum and both restored generations before clearing/unlocking. A failed
checkpoint read, invalid generation or failed durable advancement fails closed. An absent
mention checkpoint contributes zero only after a successful read. Focused unit checks cover
those floors, failures and explicit retry; **the physical S168 scenario is added but unrun**.
S143–S167 and the current-format amendments are prepared for the independent server session.

#### Commands and results

All commands below ran with Node **26.13.0** and npm **11.20.0** selected on `PATH`;
`node --version` and `npm --version` printed those versions. `$W2_TMP` denotes this run's
disposable system-temporary output directory, not a repository directory. The revisions used were:

```sh
W2_BASE=b6f83e4c0f2f84e448094995fb47c5aafccdcfd0
W2_SOURCE=b36c78e5c1b2a2ccef8586870514a8a8564597ce
```

| Check | Exact commands / inspection | Result |
| --- | --- | --- |
| V1 | `git diff --exit-code "$W2_BASE" "$W2_SOURCE" -- package.json package-lock.json ':(glob)**/package.json' ':(glob)docs/architecture/*dependency*' ':(glob)docs/architecture/*notices*'`; additionally compared each committed manifest/lock/inventory/notice blob byte for byte with its worktree file | PASS, exit 0; no dependency, inventory or notice addition |
| V2 | `npm ci --ignore-scripts --no-audit --no-fund` | PASS, exit 0; 118 packages installed |
| V3 | `npm run typecheck` | PASS, exit 0 for all five workspace members |
| V4 | `npm test` | PASS, exit 0; **890 tests, 890 pass, 0 fail, 0 skipped**, including all **15** mention unit cases |
| V5 | Team-off build, copy, audit and comparisons below | PASS; build/audit/comparisons exit 0; off index/notices match the independently built base; metafile contains no team or Supabase input |
| V6 | Fixture build, team-on build, copy, audit and comparisons below | PASS; exit 0; on index matches the independently built base, notices equal runtime notices v3 |
| V7 | `npm run build:server`; `npm run audit:licenses`; `WRANGLER_LOG_PATH="$W2_TMP/wrangler.log" npx wrangler deploy --dry-run --outdir "$W2_TMP/worker-dry-run" -c apps/server/wrangler.json` | PASS, each exit 0; Node/Worker notices verified; Wrangler reports `--dry-run: exiting now.`; no deployment |
| V8 | `git diff --name-status "$W2_BASE" "$W2_SOURCE"`; inspect every path against deliverables 1–4; `git diff --check "$W2_BASE" "$W2_SOURCE"` | PASS, exit 0; exactly **48** permitted implementation/test/guide files; this record is excluded from that revision |

The V5/V6 commands, run from the candidate root, were:

```sh
BOARD_TEAM_FEATURES=off BOARD_SUPABASE_URL=http://127.0.0.1:55321 BOARD_SUPABASE_ANON_KEY=synthetic BOARD_SERVER_URL=http://127.0.0.1:8796 npm run build
cp -R apps/web/dist/. "$W2_TMP/off/"
npm run audit:licenses
npm run build:fixtures
BOARD_TEAM_FEATURES=on BOARD_SUPABASE_URL=http://127.0.0.1:55321 BOARD_SUPABASE_ANON_KEY=synthetic BOARD_SERVER_URL=http://127.0.0.1:8796 npm run build
cp -R apps/web/dist/. "$W2_TMP/on/"
npm run audit:licenses
cmp "$W2_TMP/off/index.html" "$W2_TMP/base-off/index.html"
cmp "$W2_TMP/off/THIRD_PARTY_NOTICES.txt" "$W2_TMP/base-off/THIRD_PARTY_NOTICES.txt"
node --input-type=module -e 'import { readFileSync } from "node:fs"; import assert from "node:assert/strict"; const inputs = Object.keys(JSON.parse(readFileSync(process.argv[1], "utf8")).inputs); assert(!inputs.some(p => p.includes("node_modules/@supabase/") || p.includes("apps/web/src/team/")));' "$W2_TMP/off/meta.json"
cmp "$W2_TMP/on/index.html" "$W2_TMP/base-on/index.html"
cmp "$W2_TMP/on/THIRD_PARTY_NOTICES.txt" docs/architecture/0001-runtime-notices-v3.txt
```

Both distribution directories were copied aside before another build replaced them.
For the comparison baseline, `git archive b6f83e4 | tar -x -C "$W2_TMP/base"` extracted
committed main into an independent scratch tree. In that tree, the same `npm ci` and literal
team-off/team-on build commands above each exited 0; each output was copied to `base-off`
and `base-on`. Its workspace dependencies came from its own install, without candidate
source links. The final comparisons above also exited 0 after the last team-on wiring change.

Additional focused checks:

- `node --test tests/mentions.test.mjs`: exit 0, **15 pass, 0 fail**. These include exact
  code-point ranges and normalization, null/malformed/20/21/256-byte cases, ordering/pages/
  suffixes, replacement/plain paste, immutable retries and no replay, unchanged document/file/
  local records/board Undo, current backup validation, same-board tab memory and Node floors.
- `node --check tests/server/mentions.test.ts`, `node --check tests/server/node-test.ts` and
  `node --check tests/server/driver-workerd.ts`: each exit 0. These are syntax checks, **not
  execution or acceptance of S143–S168**.
- `git diff --exit-code "$W2_BASE" "$W2_SOURCE" -- apps/web/src/App.tsx supabase/config.toml tests/server/driver-node.ts`:
  exit 0. Existing test identity domains and ports were preserved; no private tools or scratch
  settings were included. Module guards retain exactly 22 state hooks and 31 team modules.
- Source pre-commit and commit-message privacy hooks both printed `PUBLIC BOUNDARY: PASS`.
  Git also printed a nonfatal `packed-refs.lock` permission error; the
  source commit, branch reference and clean worktree were verified afterward. Hooks were
  not bypassed, and no stash, push, merge or publication was performed.

Initial diagnostics are not hidden: the first typecheck found an implicit array type and an
unavailable `String.isWellFormed` declaration in the room's ES2022 library. Explicit typing
and surrogate validation corrected these without a configuration change. The first unit run
was 886/888, with two new fixture failures caused by an unbound `crypto.randomUUID`; binding
that callback corrected them. The focused run and final 890/890 run above supersede those
failed diagnostics. No pre-existing unit failure remained.

#### Exclusions and remaining acceptance

**V9–V13 were not run.** No browser, local Supabase stack, Supabase CLI, server suite,
base negative-control suite, C1/C2 scenario, screenshot comparison or A–J comparison ran in
this workspace-write session. S168's physical volume rewind, actual minute scheduler dispatch,
service SQL/RLS execution, live concurrency and server byte/inventory measurements remain
unverified until that fresh independent full-access check. Earlier exploratory results and
focused C2-S27 choreography evidence are not counted as implementation validation. The
corrected open-card/same-loaded-tab C2-S27 procedure remains the required independent check.

No new prototype, hosted schema application/deployment, external notification, browser matrix,
fixture-harness sweep, native IME, accessibility, load/performance or unrelated scenario campaign
was performed. Older clients/boards/files and old-binary upgrade ordering are excluded; current
format persistence and both restore fences remain implemented requirements. The 16 MiB backup
ceiling remains an explicit refusal boundary, with no universal-fit claim. This is an
implementation handoff for independent review of the exact source revision, not a merge or
milestone acceptance. The record-only commit receives diff/link inspection, without rerunning
application checks for documentation.

### Fix round 1 — 2026-11-06

Branch: `codex/0005-W2-mention-participants-in-board-discussions`.
Validated source/test revision: **`3b1f48f1c56144a58f6701cc5345365c9257922a`**.
The later record-only commit is reported separately as the final branch tip; it is not
the source/test revision. The round started clean at
`bf2d45bec6c9b045ab58694e4ab76905a976605f`, retaining the original implementation and record.

| Finding | Classification and correction | Focused evidence |
| --- | --- | --- |
| S146 | Server-test helper defect. Compute the real board person key from the board/account IDs, then select that exact roster person. Remove the empty-key stub and email-label fallback. Product identity behavior is unchanged. | S146's body and assertions are byte-identical to the round-start revision. The helper follows identity v4's SHA-256 person-key rule, including after the registered label changes. Server execution remains blocked below. |
| C2-S19 | Product defect. A terminal access loss cleared the shared draft map but left stateful discussion editors mounted. Unmount that subtree and clear retained threads, unconfirmed comment requests, drafts and unread references after a terminal ending. A reconnect/epoch change alone keeps drafts. | Hosted storage v6 requires clearing draft/roster/inbox/pending memory on known final access loss (lines 37–38). New M-U14 exercises offline retention, a nonterminal 4403 change, then a canonical 404 terminal loss through the real hosted controller and discussion boundary. |
| C2-S26 additional clause | Product defect. Explicit Comments entry now refreshes retained notices; an older overlapping response cannot overwrite a newer confirmed count or restore read/dismissed references. No stylesheet or active discussion geometry changed. | Hosted storage v6 lines 78–83 define retained unread mention references, excluding ordinary replies. New M-U15 delivers two confirmed references before a stale single-reference response, and confirms read/dismissed references cannot return through an older response. The clause correctly waits for `2 unread mentions`; the timeout's `1 unread mention` was its last observed value. |

Before the fixes, `node --test --test-name-pattern='M-U14|M-U15' tests/mentions.test.mjs`
exited 1: **2 tests, 0 pass, 2 fail** (discussion boundary still rendered; late singular
snapshot replaced the retained pair). After the fixes, the identical command exited 0:
**2 tests, 2 pass, 0 fail**. An earlier harness diagnostic treated a 4403 reconnect as terminal;
the test was corrected to follow it with the canonical 404 before the accepted red/green run.
These are unit regressions, not new browser scenario passes.

#### Repeated V1–V8

Commands ran with Node **26.13.0** / npm **11.20.0** on `PATH`.
`$W2_FIX_TMP` denotes this round's disposable system-temporary output directory.

```sh
W2_MAIN=b6f83e4c0f2f84e448094995fb47c5aafccdcfd0
W2_FIX_START=bf2d45bec6c9b045ab58694e4ab76905a976605f
W2_FIX_SOURCE=3b1f48f1c56144a58f6701cc5345365c9257922a
```

| Check | Exact commands / inspection | Result |
| --- | --- | --- |
| V1 | `git diff --exit-code "$W2_MAIN" "$W2_FIX_SOURCE" -- package.json package-lock.json ':(glob)**/package.json' ':(glob)docs/architecture/*dependency*' ':(glob)docs/architecture/*notices*'`; compare all 20 corresponding tracked manifest/lock/inventory/notice files against their committed-main blobs | PASS, exit 0; byte-identical; no added dependency or notice |
| V2 | `npm ci --ignore-scripts --no-audit --no-fund` | PASS, exit 0; 118 packages installed |
| V3 | `npm run typecheck` | PASS, exit 0 for all five workspace members |
| V4 | `npm test` | PASS, exit 0; **892 tests, 892 pass, 0 fail, 0 skipped**, including all **17** mention unit cases |
| V5 | Team-off build, copy, audit and comparisons below | PASS, all exit 0; off index/notices equal the fresh committed-main build; no team/Supabase input |
| V6 | Fixture build, team-on build, copy, audit and comparisons below | PASS, all exit 0; on index equals the fresh committed-main build; notices equal runtime notices v3 |
| V7 | `npm run build:server`; `npm run audit:licenses`; `WRANGLER_LOG_PATH="$W2_FIX_TMP/wrangler.log" npx wrangler deploy --dry-run --outdir "$W2_FIX_TMP/worker-dry-run" -c apps/server/wrangler.json` | PASS, all exit 0; verified Node/Worker notices; `--dry-run: exiting now.`; no deployment |
| V8 | `git diff --name-status "$W2_FIX_START" "$W2_FIX_SOURCE"`; inspect against deliverables 1–4; `git diff --check "$W2_FIX_START" "$W2_FIX_SOURCE"` | PASS, exit 0; exactly four allowed source/test files. The earlier record remains in ancestry; this round's record is a later documentation-only commit. |

V5/V6 candidate commands were:

```sh
BOARD_TEAM_FEATURES=off BOARD_SUPABASE_URL=http://127.0.0.1:55321 BOARD_SUPABASE_ANON_KEY=synthetic BOARD_SERVER_URL=http://127.0.0.1:8796 npm run build
cp -R apps/web/dist "$W2_FIX_TMP/off"
npm run audit:licenses
npm run build:fixtures
BOARD_TEAM_FEATURES=on BOARD_SUPABASE_URL=http://127.0.0.1:55321 BOARD_SUPABASE_ANON_KEY=synthetic BOARD_SERVER_URL=http://127.0.0.1:8796 npm run build
cp -R apps/web/dist "$W2_FIX_TMP/on"
npm run audit:licenses
cmp "$W2_FIX_TMP/off/index.html" "$W2_FIX_TMP/base-off/index.html"
cmp "$W2_FIX_TMP/off/THIRD_PARTY_NOTICES.txt" "$W2_FIX_TMP/base-off/THIRD_PARTY_NOTICES.txt"
node --input-type=module -e 'import { readFileSync } from "node:fs"; import assert from "node:assert/strict"; const inputs = Object.keys(JSON.parse(readFileSync(process.argv[1], "utf8")).inputs); assert(!inputs.some(p => p.includes("node_modules/@supabase/") || p.includes("apps/web/src/team/")));' "$W2_FIX_TMP/off/meta.json"
cmp "$W2_FIX_TMP/on/index.html" "$W2_FIX_TMP/base-on/index.html"
cmp "$W2_FIX_TMP/on/THIRD_PARTY_NOTICES.txt" docs/architecture/0001-runtime-notices-v3.txt
```

For an independent comparison baseline, `mkdir -p "$W2_FIX_TMP/base"` and
`git archive b6f83e4 | tar -x -C "$W2_FIX_TMP/base"` extracted committed main into a fresh
scratch tree. From that tree, the same `npm ci` and literal team-off/team-on build commands
above exited 0, with outputs copied by `cp -R apps/web/dist ../base-off` and
`cp -R apps/web/dist ../base-on`. Its install has no candidate source links. All comparison
commands exited 0; on notices also equal the baseline's on notices.

Additional checks and exact exclusions:

- `node --check tests/server/mentions.test.ts`: exit 0, syntax only.
- `npm run test:server:node -- tests/server/mentions.test.ts -t '^S146 '`: exit 1 during
  setup, **zero tests executed**, because `tests/server/.stack.json` does not exist.
  This is blocked execution, not an S146 pass or assertion failure. Neither runner's S146
  was executed in this session; the next independent full-access check must run both.
- `git diff --exit-code "$W2_FIX_START" "$W2_FIX_SOURCE" -- apps/web/src/App.tsx apps/web/src/style.css supabase/config.toml tests/server/driver-node.ts docs/architecture`:
  exit 0. All contract prerequisites, existing stylesheet, settings and driver remain unchanged.
  Unit module guards still pass at 22 state hooks / 31 team modules.
- Four source/test paths changed: `apps/web/src/team/comments/layer.tsx`,
  `apps/web/src/team/hosted-board.ts`, `tests/mentions.test.mjs`,
  `tests/server/mentions.test.ts`. No private tooling or scratch configuration was copied.
  Both source commit hooks printed `PUBLIC BOUNDARY: PASS`; Git again printed the nonfatal
  `packed-refs.lock` permission error. The source commit, branch ref and clean source worktree
  were verified. No hook was bypassed.
- **V9–V13 were not rerun.** No browser could start in this sandbox; no local stack,
  Supabase CLI, Docker server suite, schema application, deployment, browser scenario or
  screenshot comparison was attempted. Prior independent check and prototype results are
  not counted as new implementation validation. C2-S28/S46/S49 and C1-S19 check-tool defects
  were left untouched for the independent checker.
- No compatibility work, new prototype, unrelated test campaign, stash, push, merge or main
  modification. Current-format persistence and restore fences remain unchanged. This record
  receives diff/link inspection only; the next full-access session reviews the exact source
  revision above and separately reports the record-inclusive branch tip.
