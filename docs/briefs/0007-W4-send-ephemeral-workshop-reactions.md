BRIEF VERSION: 0007-W4 v1 (2026-11-11)
# 0007-W4 — Send ephemeral workshop reactions

Status: Draft. Implementation has not started under this brief.

## Outcome and read first

Anyone admitted to a hosted team board, viewers included, can pick one of eight
reactions from a wheel and send a short burst of it from their pointer. Everyone
else on the board sees the burst at the same board point for about a second and a
half. Nothing is saved, nothing is replayed later, sending is rate-limited, only
currently admitted people send or receive, and reactions are off while a vote runs.

Read [AGENTS.md](../../AGENTS.md), [CONTRIBUTING.md](../../CONTRIBUTING.md),
[DESIGN.md](../../DESIGN.md) and these five new contract files (prior versions
remain untouched):

| Contract | New version / ownership |
| --- | --- |
| [Presence](../architecture/0004-presence-v4.md) | v4: reaction ids, wire, bounds, budget, voting gate, relay, client rules |
| [Sync](../architecture/0003-sync-v13.md) | v13: `react`/`reacted` routing, fire-and-forget, no replay, refusals apart from documents |
| [Access](../architecture/0003-access-v12.md) | v12: send/receive rights per effective role, checked at relay and per recipient |
| [Interaction](../architecture/0001-interaction-v38.md) | v38: button, wheel, keys, focus, armed pointer, burst table, artwork, words |
| [Web modules](../architecture/0001-web-modules-v36.md) | v36: three team modules, two package modules, palette and presence-layer seams |

Use this set wherever inherited contracts link a replaced version. Unchanged:
[API v11](../architecture/0003-api-v11.md),
[hosted storage v11](../architecture/0003-hosted-storage-v11.md),
[self-host runner v7](../architecture/0003-self-host-runner-v7.md),
[voting v2](../architecture/0007-workshop-voting-v2.md),
[timer v2](../architecture/0007-workshop-timer-v2.md),
[board lifecycle v5](../architecture/0006-board-lifecycle-v5.md),
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
Document 10, fileVersion 2, room layout 7, backup envelope 1 and 16 service
tables remain. No stored-format or dependency change. Reactions add no SQLite
table, meta row, journal entry, Supabase row, backup field, joined field or
browser disk value, and nothing in Yjs, revision, edited-at, Undo/Redo, history,
file, export or backup.

Build directly; no prototype or scenario tool is an input. The build proves the
stated values with focused tests, followed by independent checks. Report a
contract conflict before dependent work.

## Deliverables and boundaries

Planning source baseline main **e88a690**. Use a fresh milestone worktree and
branch from committed main containing this packet, recording that prerequisite
base separately from the behaviour baseline. New source files carry
SPDX-License-Identifier: Apache-2.0. Only these files may change, solely for this
milestone and the named shared-path dispositions:

1. **Packages:** new `packages/board-sync/src/reactions.ts` and
   `packages/board-room/src/reactions.ts`; existing `packages/board-room/src/room.ts`
   (dispatch of `react` beside `presence` only), `protocol.ts` (attachment type),
   `presence.ts` (`currentAttachment` accepts the bounded `reactionTimes`) and
   `packages/board-sync/src/session.ts` (send `react`, report `reacted` to one
   subscriber, drop it while a vote runs). No storage, schema or journal change.
2. **Server adapters:** none expected; the runners already pass frames to the
   room. `apps/server/src/worker-room.ts` may change only if live attachment
   reconstruction rejects the new bounded field; state it in the record.
3. **Web:** exactly three new files `apps/web/src/team/reactions.ts`,
   `reactions-rules.ts`, `reactions-layer.tsx`; existing team `team-app.tsx`
   (pass the reaction tool and controller), `hosted-board.ts` (delegate send and
   subscription), `presence-layer.tsx` (compose the burst renderer), existing
   `apps/web/src/ui/palette.tsx` (render the team reaction tool immediately before
   the Comment tool), `team/spotlight-layer.tsx` (only the reaction exemption from
   local leave actions and Escape, interaction v38 "Keys and focus") and
   `apps/web/style.css`. `apps/web/src/App.tsx` does not
   change. Follow the Comment tool's pattern for the armed tool: the board tool
   value is `Reactions`, set through the palette's `setTool`; the reaction layer
   captures canvas pointer and key events while armed, before selection and
   placement handling, as the comments layer does for `Comment`.
4. **Focused tests and guards:** new `tests/workshop-reactions.test.mjs` and
   `tests/server/reactions.test.ts`; existing `tests/modules.test.mjs`,
   `presence.test.mjs`, `comments.test.mjs`, `workshop-voting.test.mjs`,
   `workshop-spotlight.test.mjs`, `recovery.test.mjs`; server `spotlight.test.ts` (S318 maximal
   attachment only), `setup.ts`, `peer.ts`, `node-test.ts`, `worker-test.ts`,
   `driver-node.ts`, `driver-workerd.ts` under `tests/server`. Root
   `vitest.node.config.ts` and `vitest.workerd.config.ts` add only the new server
   include; `tests/README.md` records ranges, dispositions and limits. Dynamically
   import new modules inside named checks, never at top level, so baseline absence
   fails by check name rather than aborting the file.
5. **Record:** append only this brief's Implementation record, in a separate
   record commit, including later fix-round record commits. Distinguish the
   validated source revision from the record-inclusive tip.

Outside the named new controls, the existing screens' markup stays exactly as at
the base: the reviewer's A–J comparison allows only the masks listed under
validation. The Reactions button, its wheel, the armed pointer and the bursts are
the complete UI exception; the off build has none of them. No dependency,
manifest, lock, inventory, notices, build-script or service-permission change, no
new import exception or state hook. Ignored build output never counts as a
tracked change. Escalate a required file outside this list; do not expand it.

## Required behavior and concrete design

Implement presence v4, sync v13, access v12, interaction v38 and web modules v36
in full. In particular:

- Eight reactions in the contract order, drawn from interaction v38's artwork
  table exactly; `me` uses the sender's presence label initial and colour.
- One Reactions palette button before Comment for every admitted role, always
  visible on a hosted team board, tooltip `Reactions · E`, armed state
  `aria-pressed="true"` with name `Reactions, <Name> armed` and Select unpressed,
  disabled with interaction v38's four reasons in their order (locked, not
  joined, history preview, voting).
- Reacting never leaves a followed spotlight or stops presenting; Escape goes to
  the wheel or the armed tool first (interaction v38).
- The 224px wheel with its slot geometry, labels, centre close, placement from
  the button or at the pointer for E, 12px viewport clamp, keys (arrows, Home,
  End, 1–8, Enter, Space, Tab containment, Escape), focus return, and E ignored
  in text fields, dialogs and composition.
- Armed: click or Shift-click sends one reaction at the board point, objects are
  not selected; Enter sends at the visible canvas centre; Escape, another tool or
  the button disarms. The 24px armed artwork beside the pointer.
- The burst table, motion, reduced-motion variant, drop shadow, presence-layer
  stacking, 20-burst cap, off-screen omission and no announcement.
- Room: budget 5 per rolling 1,000ms per connection, separate `reactionTimes`
  (at most five entries), silent drop over budget; 256-byte up frame and 512-byte
  down frame; refusals `reaction_too_large`, `bad_reaction`, `reactions_voting`;
  sender admission then per-recipient admission with the spotlight relay's
  current-access check; no echo to the sending connection; nothing stored, queued
  or replayed.
- Client: at most 4 sends per rolling 1,000ms, no local burst for an ignored
  attempt; own burst at once; incoming burst only for a known presence connection
  and no running vote; all bursts cleared at session end, board change, access
  loss and voting start; never queued or resent.

## Shared-path check dispositions

This inventory authorizes expectation changes, not additional historical runs.

| Shared path / older checks | Disposition |
| --- | --- |
| Room dispatch and refusals: S17–S21, S30, S34, S36, S38, S102–S133, S143–S167, S225–S355; room, shared-editing, recovery, comments, timer, voting and spotlight units | `react` routes before the edit fallback; keep every edit/comment/timer/vote/spotlight key, receipt, order, refusal and bound. No reaction refusal becomes a document refusal or a presence refusal |
| Presence attachment bound: S318 and presence units | S318's maximal attachment adds a maximal five-entry `reactionTimes`; the 16,384-byte cap and every other field stay. Presence relay, rates, expiry, palette and voting redaction unchanged |
| Voting privacy: Y1-S28, Y1-S29, S273–S277, P1-S42 | Keep every raw per-recipient and placeholder assertion. Reactions add the refusal and the disabled control; no reaction frame reaches anyone while running |
| Palette and toolbar arrays: C1-S1 (Comment tool position); 0004-W2 W2-S1, W2-S13, W2-S14, W2-S20 (palette while connecting, reconnecting or offline); P1-S45 "no new item in palette Tab arrays"; Z1 and Y1 toolbar Tab rows; any unit asserting the palette's buttons | The palette gains exactly one button, Reactions, immediately before Comment, for owners, editors and viewers, present in every hosted state and disabled with its reason while not joined. Amend only those order, count and disabled-state expectations; Comment, Templates and every other tool keep their behaviour. No change to the top bars, people menu or panel Tab order |
| Module inventory: modules units | 48 → 51 team modules (the three named), 22 state hooks, App.tsx unchanged and at most 264 lines; `reactions-rules.ts` joins the no-React/no-Auth list |
| Spotlight: S305–S355; P1-S25, P1-S26 and P1-S39 (local actions and Escape leave following); spotlight units for local actions | Reaction actions (button, wheel, E, armed click/Shift-click/Enter) are excluded from the local actions that leave following, and Escape with the wheel open or a reaction armed is consumed by reactions. Every other leave route and assertion is unchanged; reactions never start, stop or move a spotlight |
| Local shell: A–J off | Off bundle unchanged; no new mask |

## Server checks

0007-W3 ended at S355. New **S356–S377 (22)** in `tests/server/reactions.test.ts`
run on **both Node and workerd**. Print `PASS:`/`FAIL:` with each full S ID and
`SUMMARY-REACTIONS`. Use actual socket frames, current authority and a
controlled clock; never screenshots as proof.

| ID | Required proof |
| --- | --- |
| S356 | Owner, editor and viewer each send all eight ids; every other admitted connection gets exactly `{kind:"reacted",connection,reaction,x,y}` with the sender's stamped connection; the sender's connection gets nothing |
| S357 | Board-granted editor and viewer guests send and receive; ungranted guest, outsider, removed and disabled people neither send nor receive |
| S358 | Same person, two tabs: a reaction from tab 1 reaches tab 2 and everyone else, not tab 1 |
| S359 | Parsed frames with `kind:"react"`: exactly four keys accepted; a missing, extra or misspelled other key, unknown id, non-string id, `null`, a string, `1e309` (Infinity after parsing) and ±1,000,001 coordinates refuse `bad_reaction` with no relay. Unparseable text and unknown kinds keep the existing generic refusals (`bad_message`). NaN, which JSON cannot carry, is covered by the validator units in V4 |
| S360 | A maximal valid frame of exactly 256 bytes including whitespace relays; 257 bytes refuses `reaction_too_large`; the largest legal `reacted` frame is within 512 bytes |
| S361 | Budget: five frames in (t−1000,t] relay; the sixth is dropped with no relay and no refusal; at the exact boundary the oldest expires and the next relays; invalid frames count |
| S362 | The reaction budget and the presence budget are independent: 10 presence frames and 5 reactions in the same second all take effect |
| S363 | `reactionTimes` never exceeds five entries; a maximal attachment with it stays within 16,384 bytes on both runners |
| S364 | While a voting round runs every `react` refuses `reactions_voting` and nothing is relayed to anyone; after reveal or clear reactions relay again |
| S365 | A voting Start ordered after a reaction delivers that reaction first; a reaction ordered after the Start is refused |
| S366 | Sender removed or access-disabled: once the room has processed the change, a later or held `react` relays nothing |
| S367 | Recipient removed, expired, role-changed or epoch-changed: once processed, no later reaction reaches that connection while others still receive |
| S368 | A required access-source outage on the sender's check relays nothing; on one recipient's check it skips only that recipient while earlier deliveries stand; no retry, queue or cached success |
| S369 | Board locked (4423), Trash or lifecycle close: no reaction relays during or after closure |
| S370 | A connection that joins, reconnects or reloads after a reaction receives no earlier reaction; joined and every snapshot have no reaction field |
| S371 | Reaction activity leaves document bytes, revision, edited-at, Undo/Redo, history count and fingerprint, file/export and logical backup bytes identical on a stable fixture |
| S372 | No reaction-derived SQLite table, row, meta key or journal entry and no Supabase row exists after reaction activity; stored inventories unchanged apart from the access check's existing bookkeeping |
| S373 | Reactions never change timer, voting or spotlight state, versions or projections, and a running spotlight's followers receive reactions |
| S374 | Each refusal is the plain `refused` frame without `requestId`, sent to the sender only; it never enters document refusal handling |
| S375 | Room order: a reaction held behind an earlier ordered operation is relayed in order, rechecking admission after any await |
| S376 | Workerd live reconstruction with a stored `reactionTimes` keeps the budget bounded and relays no old reaction; Node restart relays no old reaction |
| S377 | 50 connections, all reacting at the budget: every relay stays bounded, no metadata accumulates, and closing connections removes their budgets |

## Browser checks

New scenario **R4-S1–R4-S24**: 23 on checks, R4-S22 off only. R4 was unused in
existing public briefs when allocated. A fresh independent check run writes its
tool from these clauses and the contract values; each row prints its full ID,
`PASS:`/`FAIL:` and a summary, retaining raw receipts and unrun rows.

Use three independently authenticated contexts, owner ana, editor ben and viewer
mia, with a second ben tab where named, on one hosted team board with two notes.
Use real admitted sockets and real events, never painted DOM. New capability
criteria also fail by name on independent baseline e88a690. Save a real-state
image for R4-S1–R4-S13 at 1280 × 800, scale 1, and R4-S14 at 375 × 812. Derived
positions ±0.5 CSS px; colours and sizes exactly as interaction v38.

| ID | Scriptable behavior and expected result |
| --- | --- |
| R4-S1 | Owner palette: Reactions immediately before Comment, after Templates; rest, hover, focus-visible, pressed and disabled looks exact; tooltip `Reactions · E`. Capture palette-hover |
| R4-S2 | Button opens the wheel: 224px disc, eight slots in order at radius 80px, centre close, placement centred on the button with bottom 12px above the palette; slot hover label `Heart · 8`. Capture wheel-button |
| R4-S3 | E over the canvas opens the wheel centred on the pointer; near each edge it clamps 12px inside. Capture wheel-e |
| R4-S4 | Arming Heart: wheel closes, focus on the canvas, button pressed with name `Reactions, Heart armed`, Select unpressed, armed artwork 24px at +12/+12 from the pointer. Capture armed |
| R4-S5 | Click on the canvas while armed: one burst at the board point with the seven-copy table; receipts at 80, 600 and 1,200ms match the contract positions and opacity; gone by 1,600ms. Clicking a note does not select it. Capture sender-0080, -0600, -1200 |
| R4-S6 | Shift-click sends exactly as click; holding does not repeat; each press one burst |
| R4-S7 | Ben with a note selected sees ana's burst at ana's board point in Ben's own pan/zoom, stacked as cursors are, context bar and handles unchanged. Capture receiver |
| R4-S8 | ana and ben react at once; mia sees both at their senders' points. Capture two-at-once |
| R4-S9 | `Me` from ana and ben shows each sender's initial on their presence colour; in the wheel each person sees their own. Capture me-reaction |
| R4-S10 | Reduced motion emulated: one 32px copy fading in place over 1,400ms. Capture reduced-motion |
| R4-S11 | Viewer mia has Reactions after Pan and before Comment, can send, still cannot edit content. Capture viewer-palette |
| R4-S12 | Keyboard: E opens with focus on the armed slot or slot 1; arrows wrap both ways; Home/End; 1–8 arm directly; Enter and Space arm; Tab stays inside; Escape closes and returns focus; Enter on the armed canvas sends at the canvas centre. Capture keyboard-focus |
| R4-S13 | A real voting round running: button disabled, reason `Reactions are off while voting` as tooltip and `aria-describedby`, E does nothing, an armed tool is disarmed and live bursts cleared; after reveal and clear it works again. Capture vote-disabled |
| R4-S14 | 375 × 812: the scrolling palette reveals Reactions when opened from it; the wheel sits fully inside the viewport. Capture narrow |
| R4-S15 | E typed in a note editor, comment field, share dialog and during IME composition types or does nothing as today and opens no wheel |
| R4-S16 | Escape, choosing Select, choosing another tool and pressing the button each disarm; the wheel closes on outside click and centre close without change |
| R4-S17 | Client throttle: five clicks within one second send four frames and draw four bursts; the fifth draws none |
| R4-S18 | ben's second tab receives ben's first tab's reaction; the sending tab draws only its own local burst once |
| R4-S19 | Reload and late join: a newcomer or reloaded tab sees no earlier reaction; a burst in flight is cleared when its board session ends |
| R4-S20 | Removing mia's access during a session: mia's live bursts are cleared, she can no longer send, and later reactions never reach her; others continue |
| R4-S21 | History preview, a locked board and a session that is not joined each disable the button with interaction v38's reason in its precedence order; the button stays visible; the document, revision, Undo/Redo and export are unchanged by any reaction activity |
| R4-S22 | Team-off sentinel only: no Reactions button, no E binding, no reaction request or module in the off bundle |
| R4-S23 | Raw wire for owner, editor and viewer: exact `react` and `reacted` keys and sizes; refusals for a bad id and an oversized frame show no document recovery UI |
| R4-S24 | During a spotlight, followers see the presenter's and others' reactions; a follower who opens the wheel, arms, sends and presses Escape keeps following, and the presenter who reacts keeps presenting; reactions never change the follow state, timer or voting |

## Acceptance criteria

- **0007-W4-AC01:** On an active hosted team board on either runner, a currently
  admitted owner, editor or viewer (including a guest admitted by a board grant)
  opens the reaction wheel by the Reactions button or E, arms one of the eight
  Board-authored reactions, and sends a burst by click, Shift-click or Enter.
  Unknown ids, extra fields and frames over 256 bytes are refused by the room.
  Local boards and the team-off build show no control and send nothing. Controls,
  wheel, focus and keyboard match interaction v38 and the approved design.
- **0007-W4-AC02:** Every other currently admitted connection, the sender's other
  tabs included, sees the burst at the sender's board point within the existing
  presence latency, with interaction v38's look and reduced-motion variant; the
  sender sees it at once. A reaction never changes the document, its revision or
  edited-at, selection, Undo/Redo, history, file export or logical backup, and the
  room writes no row for it.
- **0007-W4-AC03:** The room relays at most 5 reactions per connection per
  rolling 1,000ms and drops the rest without relaying; the client sends at most 4
  and draws no burst for an ignored click. Each burst is gone 1,600ms after it
  starts. A reconnect, reload or late join receives no earlier reaction. A removed,
  expired, ungranted or denied person neither sends nor receives one after the
  room has processed that change, and frames queued behind it are not delivered
  to them. While a voting round runs the room relays none and the controls are
  disabled with their reason. Proved on both runners.

| Criterion | Evidence that shows it |
| --- | --- |
| 0007-W4-AC01 | S356–S360; S374; R4-S1–R4-S4; R4-S6; R4-S11–R4-S16; R4-S22–R4-S23; V4; V9 |
| 0007-W4-AC02 | S356; S358; S371–S373; R4-S5; R4-S7–R4-S10; R4-S18; R4-S21; R4-S24; V4; V9 |
| 0007-W4-AC03 | S361–S370; S375–S377; R4-S13; R4-S17; R4-S19–R4-S20; V4; V9; V11 |

## Applicable DESIGN.md guardrails

Canvas-first shell, native controls and visible focus, minimum action hits,
protected native editing and independent state owners apply. Interaction v38
states every new look, word, key and motion value; never infer generic styling.
Reduced motion is honoured. No new sound or font. Preserve complete selection
chrome and the inherited timer, voting and spotlight contracts.

## Validation commands and expected evidence

Use pinned Node 26.13.0 and npm 11.20.0 from the repository root. Source validation
is not independent acceptance. Each check run restates **every V row it reruns**
as its own `PASS: Vn ...` / `FAIL: Vn ...` line with SHA, logs and counts.

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

Copy off and on outputs aside before rebuilding. After the build and before
browser check 1, one fresh server-only run clean-clones the candidate, installs,
creates a uniquely owned local Supabase project from committed config, installs
the schema and runs Node then workerd. No browsers there; failures go back once
for a fix, then the check run's suites prove it. Existing setup machinery:

```sh
node tests/server/make-signing-key.mjs
npx supabase start
node tests/server/write-stack-info.mjs
npm run test:server:node
npm run test:server:workerd
npx supabase stop --no-backup
```

Record each long suite's start and end and the host's sleep and wake events; a
suite that overlapped a sleep is INVALID (host asleep), never a product result,
and is rerun awake. Three Safari checks from this milestone are chosen only at
Review.

Independent scenario interface (tool written by the later check run):

```sh
node tools/browser-compare/0007-w4-check.mjs <served-on-origin> <R4-output> <local-stack-private-json>
node tools/browser-compare/0007-w4-check.mjs <baseline-on-origin> <R4-base-output> <baseline-stack-private-json> --negative
node tools/browser-compare/0007-w4-check.mjs <served-off-origin> <R4-off-output> <local-stack-private-json> --off
```

| Check | Command/inspection and pass condition |
| --- | --- |
| V1 | Byte-compare manifests, locks, dependency inventory and runtime notices against the prerequisite base: unchanged, no new dependency |
| V2 | `npm ci --ignore-scripts --no-audit --no-fund` exits 0 on the clean candidate and on the independent baseline |
| V3 | `npm run typecheck` exits 0 across all five workspace members |
| V4 | `npm test` full suite exits 0; focused workshop-reactions units prove ids/order, frame validation and sizes, client throttle, wheel placement and clamp, slot geometry, burst table positions/opacity at named times, reduced motion, 20-burst cap and clearing rules. Guards: 51 team modules, 22 state hooks, App.tsx unchanged; only the listed older expectations amended |
| V5 | Team-off `npm run build` and `npm run audit:licenses` exit 0; index.html and notices byte-identical to baseline off; build metadata has no team, Supabase or reaction input |
| V6 | `npm run build:fixtures`, team-on `npm run build` and `audit:licenses` exit 0; index.html equals baseline on; notices equal runtime notices v3 |
| V7 | `npm run build:server`, `audit:licenses` and `WRANGLER_SEND_METRICS=false npx wrangler deploy --dry-run --outdir <scratch> -c apps/server/wrangler.json` exit 0; no deploy |
| V8 | Inspect all hunks plus `git diff --name-status` and `git diff --check` over `<prerequisite-base>..<validated-source>`: only deliverables 1–4 and the append-only Implementation record |
| V9 | R4-S1–R4-S21, R4-S23–R4-S24 on (23) and R4-S22 off (1) pass with the 15 state captures and raw receipts; S356–S377 reached on both runners |
| V10 | Once, on an independent e88a690 source, build and fresh stack, the new reaction unit, server and browser capability checks fail by name; a top-level setup or import abort does not count |
| V11 | Full `npm run test:server:node` then `npm run test:server:workerd`: S1–S50 and S55–S377, with the existing workerd physical exclusions S37, S43, S70 and S168 and the Node-only S344 physical subcase as before. No new failures; no unrun case called passed |
| V12 | Accepted A–J team-off compare: baseline twice, then candidate and diffs; existing saved-time normalization only, no new mask |
| V13 | Accepted regressions: full Y1 on and off, full Z1 on and off with End and reconnect, the targeted 0007-W3 rows P1-S1, P1-S9, P1-S13, P1-S21, P1-S25–P1-S27, P1-S39, P1-S40, P1-S42 and P1-S45 on and P1-S47 off, and browser W2-S1–W2-S21. Amend only the declared expectations, keep functional assertions and classify every failure against e88a690 |

Accepted additional-run allocations: full unit about 1 min; both server suites
23–28 min after the shared schema; A–J off 3–4 min; Y1 5–7 min; Z1 4–6 min;
targeted P1 15–25 min including writing those rows (low confidence: never run
before); W2 7–10 min. Roughly 65–85 active minutes with shared setup. The other
P1 rows are not run here. No unrelated historical, harness, load,
performance, browser-matrix or assistive campaign.

Known baseline failures: **W2-S7, W2-S8, W2-S9, W2-S16, W2-S20, W2-S21** fail
identically on the baseline and are tracked separately, outside this milestone.
Do not fix them here, skip them silently, mark them passed or use them as proof
for any reaction criterion. Run them on e88a690 as needed to classify. P1 has
never been run in a check: a P1 failure that also fails on e88a690 is a baseline
finding to report, not a W4 failure, and is never fixed here.

## Review focus and public references

Review the relay order and per-recipient admission, the budget's independence
from presence, silent over-budget drop, the voting gate on both sides, no echo,
no storage and no replay first. Then the armed tool's event capture (no object
selection, E ignored while editing), the burst table and stacking, focus return
and Tab containment, and the palette order for each role. Public source basis is
main e88a690 and the linked versioned contracts, read 2026-11-11; no outside
product is needed to implement this contract. No unresolved product decision is
delegated to implementation.

## Exclusions and reasons

- Local boards and team-off reactions: no shared room there.
- Stamps or any reaction saved on the board; more than eight reactions; custom or
  uploaded reactions; hold-to-repeat or drag spraying.
- Names or labels drawn with bursts; off-screen markers; sound; announcements.
- Reactions during a voting round, replay on join, or any reaction history.
- Repairs to separately tracked baseline W2 failures or to P1 baseline findings.

## Implementation record

(Appended by the implementer.)
