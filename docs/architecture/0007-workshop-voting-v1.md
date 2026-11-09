# 0007 — Workshop voting contract

CONTRACT VERSION: 0007 workshop voting v1 (2026-11-09)

Status: Draft for 0007-W2 v1. This is the complete voting state, privacy,
transport, storage, lifetime and interface contract. The version set linked by
[the brief](../briefs/0007-W2-vote-and-reveal-workshop-results.md) governs inherited
references. Current document schema 10, fileVersion 2, room layout 7 and logical
backup envelope 1 apply. No dependency, service table or voting HTTP route is added.

## Authority, targets and ballot

One round belongs to an active hosted team board on either runner, including
solo hosted use. Currently admitted effective owners/editors may start, vote,
remove their own vote, reveal and clear, regardless of who started. Viewers read
session metadata and results only. A workspace guest needs an explicit board
grant yielding editor/viewer and follows that effective role. Ungranted guests,
outsiders and removed/disabled people receive no voting state. Local boards and
team-features-off builds have no voting controller, UI, requests or persistence.
Timer rights remain available to viewers and independent of voting rights.

Start trims Question; require valid Unicode, 1–240 Unicode code points after
trimming, and an integer budget 1–20, default 3, step 1. Reject lone surrogates.
Set-up is tab memory, retained across panel handoffs and reset by full reload.
No invitations, starter privilege, facilitator role or participant checklist.
Everyone eligible can opt into input mode at any time; Done voting only exits
that local mode and neither locks a ballot nor tells peers someone is done.

At Start snapshot every live eligible (object ID, generation) and its board
order, at most 250 targets. Order is the document's order, with UUID as its
deterministic tie fallback; assign captured startOrder 0–249. Sticky, shape and
text are eligible; image has the same eligibility rule but hosted image creation
and import remain refused. Connector, stroke, section and comments are excluded.
A group is not a target: each eligible member is independent. Do not reuse the
existing image-excluding eligibleIdea predicate unchanged. Empty target sets are
refused. Prompt, budget and snapshot membership cannot be extended while running.
New/duplicated objects never join an existing round.

Each verified account has one ballot and budget across all tabs. One vote per
target identity costs one unit; unvote refunds one. No stacking or client-chosen
person/colour. First admitted ballot access reserves that identity's row and
captures the connection's server-assigned presence colour for the whole session.
Keep it through tabs/reconnect. Colours may repeat; they do not identify people.
Use the presence palette: #2563eb, #dc2626, #16a34a, #9333ea, #ea580c, #0891b2,
#db2777, #4f46e5. A new row has private version 0 until its first mutation.
An eligible read/join returns an existing row or reserves an empty one. At 50
reserved identities a further identity receives only the recipient-specific
limit state below; it may still reveal. Empty/pruned/departed rows keep their
slot and version until reveal/clear/reset. They never grow beyond 50.

## State and exact projections

All UUIDs below are lowercase canonical UUID strings. All versions, epochs and
transport generations are nonnegative JS-safe integers. Object generation is
a UUID, not the integer transport generation. Strictly reject unknown keys.

`Target` is exactly the tuple `[objectId,objectGeneration,startOrder]`.
`BallotTarget` is exactly `[objectId,objectGeneration]`. Arrays contain unique
identities. `Session` is exactly
`{status,sessionId,sessionVersion,prompt,budget,targets,totals}`:

| State | Exact invariants |
| --- | --- |
| idle | sessionId null, prompt "", budget 0, targets [], totals null; sessionVersion initially 0 |
| running | server-created session UUID, trimmed prompt and budget above, 1–250 targets in captured order, totals null |
| revealed | same UUID/prompt/budget and surviving target snapshot; totals integer array aligned with targets, each 0–50; no ballots or person links |

Targets pruned before reveal stay absent, even after Undo/history restoration.
Running can therefore have zero targets after deletion. Revealing it yields
empty totals and an empty result list. A revealed target is retained even when
its document object later disappears; its count/order never changes.

`Own` is exactly `{ballotVersion,colour,targets,remaining}`: colour from the
palette, at most 20 unique BallotTargets from live session eligibility,
remaining = budget − targets.length, 0–20. `Projection` is exactly
`{session:Session,own:Own|null|{limited:true}}`. The limited form goes only to
an otherwise eligible running recipient without a slot, never to viewers.
Idle/revealed/viewer own is null. A recipient-specific capacity refusal discloses
no participant identity, ballot, completion state or numeric occupancy.

Before reveal, every recipient gets only public session metadata and, if
eligible, their own ballot/colour/version/budget. Nobody, including an owner or
starter, receives another person's ballot, count, participation flag, private
version, voter-row count or mutation event. Never serialize raw SQL rows.
No aggregate votes-cast counter or public counter changes on private activity.
Own updates go only to live-authorized connections of that same verified account.
Do not emit ballot details through application logs, edit receipts, refused-edit
UI, presence, notifications, directory metadata or HTTP responses.

## Commands, queue and wire fields

Use existing `POST /boards/:board/join-tickets` and
`GET /boards/:board/join?ticket=...`. Current joined gains exactly
`voting:Projection` beside the unchanged timer and other fields. The voting
member is bounded separately from the inherited joined/document envelope.

Mutation base keys are exactly
`{kind:"vote_command",requestId,epoch,restoreGeneration,sessionId,expectedSessionVersion,action}`.
requestId is a lowercase UUID for correlation, never a durable receipt.
Read is exactly `{kind:"vote_read",requestId,epoch,restoreGeneration}`.

| Action | Additional keys, expected state and effect |
| --- | --- |
| start | prompt, budget; idle, sessionId null; creates running UUID/targets, sessionVersion +1 |
| vote | objectId, objectGeneration, expectedBallotVersion; running/current identity/versions; adds one own target, own version +1 |
| unvote | same extra keys as vote; running/current identity/versions; removes an own target, refunds one, own version +1 |
| reveal | no extra keys; running/current session; revalidates all retained voter rights and targets, freezes anonymous totals, deletes every private row/link, sessionVersion +1, revealed in one transaction |
| clear | no extra keys; revealed/current session; clears session payload and all private rows, sessionVersion +1, idle |

All other edges refuse vote_state. No running clear/cancel or stopped-hidden
state exists. A new Start requires confirmed Clear results first. Ballot
versions do not bind reveal/clear confirmations. Private casts do not dismiss
those confirmations. Session replacement/reveal/clear invalidates them.

Room.ordered is the single order for commands, asynchronous authority reads,
access reconciliation, document deletion/history replacement and snapshots.
Recheck live admission, identities, versions, size and arithmetic after awaits
and before transaction/send. First valid queued command wins; a later authority
lookup cannot overtake an earlier entry. Different voters may both mutate at
the same sessionVersion. Two tabs of one person share expectedBallotVersion and
cannot double-spend. Duplicate/stale commands apply at most once; refuse rather
than merge/retry/update their expectations. A cast before reveal may count; one
after is refused. Storage/required authority failure cannot partially reveal,
delete private rows, consume budget or publish success.

Session version advances only on Start/reveal/clear/reset, never a private ballot
change. Pruning changes only affected private versions; visible target deletion
may update targets at the same session version. Versions never wrap. Reset in
a fresh transport generation initializes idle version 0; within a generation
they are monotonic. A new UUID plus generation fences replacement rounds.

| Frame | Exact keys |
| --- | --- |
| accepted command | {kind:"vote_result",requestId,voting:Projection,restoreGeneration,cause} |
| read reply | {kind:"vote_snapshot",requestId,voting:Projection,restoreGeneration} |
| publication | {kind:"vote_state",voting:Projection,restoreGeneration,cause} |
| refusal | {kind:"vote_refused",requestId,reason} plus {voting:Projection,restoreGeneration} only after successful current live admission |

cause is start/vote/unvote/reveal/clear/prune/targets/reset, at most 7 ASCII
bytes, never an actor. vote/unvote/prune causes are private to affected account
connections; targets is only a visible eligibility deletion. Public Start/reveal/
clear/reset publications are independently composed and authorized for every
recipient, never a shared raw frame. Replies/copies deduplicate speech using
generation/sessionVersion and, for own changes, ballotVersion. Joined/read/
refusal seed or refresh state without replaying transition speech.

requestId is null in a refusal if no valid UUID can be parsed. Reasons are exactly
vote_bad_message, vote_message_too_large, vote_rate_limited, vote_stale_session,
vote_stale_ballot, vote_state, vote_bounds, vote_ineligible, vote_budget_spent,
vote_already_voted, vote_not_voted, vote_voter_limit, vote_unavailable,
vote_access_changed. Unknown keys/type/action/UUID use vote_bad_message; valid
shape but prompt/budget/arithmetic outside bounds uses vote_bounds; mismatched
session identity/version precedes state/ballot checks; own version mismatch uses
vote_stale_ballot. After versions, test eligibility, already/not voted, then
budget/capacity. No person's ballot can be named in a request. Outer malformed
JSON/unknown kind/over-1,048,576-byte frame keeps bad_message/message_too_large
with no inferred projection. Recognized smaller voting overflow uses its own
refusal. Required authority/storage failure uses vote_unavailable without cached
state. Access failure uses vote_access_changed without protected fields and the
existing close policy: 4401 expiry, 4403 downgrade/removal, 4409 upgrade, 4423
document replacement. No generic document refusal, waiting queue or replay.

A currently admitted viewer's forged mutation also refuses vote_access_changed
without a projection, but leaves that valid read-only socket open; there is no
role change to rejoin. Its ordinary vote_read still returns public metadata.
Actual downgrade/epoch/expiry/generation changes retain the close policy above.

Every join/read/mutation/publication requires active lifecycle/no deleted marker,
current token, strict current access replay, effective role, epoch and transport
generation, including reconstructed sockets. Recheck recipient rights at send.
Authority outage withholds voting; stored roles never authorize cached success.
Keep ordinary cached HTTP/edit policy outside this explicit gate.

## Bounds and stored values

Layout 7 adds two room SQLite tables, initialized and validated transactionally
with storage_version 7. No Supabase/Yjs/browser store or command journal.

| Table / columns | Typed bound |
| --- | --- |
| workshop_vote: singleton INTEGER PRIMARY KEY CHECK =1, status TEXT, session_id TEXT nullable, session_version INTEGER, prompt TEXT, budget INTEGER, targets TEXT, totals TEXT nullable | Exactly one row. Typed Session invariants; targets/totals are strict JSON arrays above, not escaped copies of documents/labels. Complete encoded row ≤65,536 UTF-8 bytes including keys. |
| workshop_vote_ballots: person_id TEXT PRIMARY KEY, session_id TEXT, version INTEGER, colour TEXT, targets TEXT | Verified account UUID/session UUID, safe version, palette colour, strict JSON BallotTarget array ≤20. At most 50 rows tied to the current running session. Complete encoded row ≤4,096 bytes including keys. No row survives reveal. |

Measure maximal legal SQL row JSON encodings (including the escaping of TEXT
JSON columns), not just a convenient fixture or projection. Compact target
tuples and aligned totals avoid storing a second identity list. Every new row
is <131,072 bytes and below the inherited 2 MB runner row ceiling. Aggregate
voting rows ≤65,536 + 50×4,096 =270,336 encoded bytes. No new journal; inherited
journal ≤65,536 bytes, raw chunk ≤1,048,576, canonical document ≤2,097,152 and
complete logical backup ≤16,777,216 remain. Refuse overflow before partial writes.
Existing explicit recovery marker/reservation rows remain ≤1,024 encoded bytes.

Voting command/read frames ≤4,096 UTF-8 bytes including whitespace. Each voting
reply/publication/refusal and joined's added voting projection ≤65,536 bytes;
measure maximal legal metadata plus own state. Keep the inherited joined and
outer document limits; do not apply the voting-only response bound to the entire
document-bearing joined frame. Count and validate before encoding/sending.

Each connection allows 5 recognized mutation attempts and separately 5 reads in
rolling interval (t−1,000,t], including invalid attempts. Keep at most five
recent timestamps per budget, each budget ≤1,024 encoded bytes in hibernation-safe
attachments; complete attachment remains ≤16,384 bytes with all existing fields.
Over-limit attempts do not grow counters or renew presence/token lifetime.

Logical backups explicitly omit workshop_vote and workshop_vote_ballots, even
when empty, as well as workshop_timer and explicit recovery marker keys. Current
backup envelope 1 uses storage_version 7 and the remaining exact table/meta/row
sets. Reject voting table, top-level, meta and nested row injections with
400 bad_request before any restore fence/write. Never silently drop injected
data and accept it. File/document validators likewise reject extra voting keys.

## Reconciliation, presence and lifetime

Before returning a retained own ballot, reconnection and reveal, revalidate
required access; reveal checks every retained voter, even with no socket. The
existing access-change replay/delivery path prunes disconnected voters too.
Loss of effective owner/editor rights permanently empties their active ballot,
increments its private version and refunds its units. Keep the empty row/slot;
reauthorization does not revive votes. Mere tab close/token expiry leaves access
and ballot intact. Deletion/replacement of a target before reveal prunes its
eligibility and all referencing votes in the same room order, refunding affected
budgets/private versions once. Undo cannot revive them. Move/resize/content edit
of the same identity preserves eligibility/votes and updates displayed geometry.

While running, before every join/relay/reconstructed-attachment projection,
replace remote cursor with null, selection with [], view with
{x:0,y:0,width:1,height:1}. Keep stamped people/avatars, active heartbeat and
expiry. Sanitize retained attachment presence too; a modified client cannot
relay hidden coordinates. On running transition immediately discard existing
remote cursor/selection/view, stop following and disable Follow; suppress remote
selection outlines as well as cursors. Keep the show-cursors preference. On
reveal/reset get fresh presence; never replay stored hidden coordinates. Voting
traffic never refreshes presence. The timer neither ends nor reveals voting.

| Event | Required boundary |
| --- | --- |
| Reload/reconnect/late join/starter leaves/all leave | Fresh authorized recipient snapshot; same ballot/budget or frozen results; no inactivity TTL or mutation replay. |
| Ordinary Node restart/room reopen, DO eviction/hibernation/reconstruction | Preserve rows and reserved identities; restore bounded attachments; enforce running redaction before serving resumed sockets. |
| Revealed target edited/deleted or voter loses access | Counts/rank remain frozen; current labels may change; missing identity says Removed object without navigation/badge. Same identity reappearing may regain its badge; different generation never inherits it. |
| History preview | Panel status/results and owner/editor reveal/clear remain; target selector/actions/local mode disabled, no strip/dots/badges over historical pixels. Helper Back to current board to vote.; existing return button Back to current version. |
| Document-history restore / 4423 | Preserve live running/revealed state under fresh transport generation, reconcile missing/different targets before snapshot or votes; never import historical votes or revive pruned identities. |
| Trash admission/restore | Clear session/ballots/results at durable lifecycle fence before peers close. Failure retains denial and retry. Trash restore initializes idle. |
| Purge/discard | Delete side tables/rows and drain held callbacks; delayed work cannot recreate files/alarms/state. |
| Logical operator restore | Validate/exclude voting before fences; valid replacement resets both workshop records atomically behind fresh recovery generation. Preserve denial through replay. |
| Marked Node-volume / supported Workers time recovery | Process explicit_recovery_pending/reservation before history-intent shortcuts and before serving, reset timer and voting together locally, retain accepted history intent/chunks, denial/reservation across failures; retry never revives/repeatedly resets state. |
| Ordinary restart with pending history intent | Resume document intent, preserve/reconcile live voting, preserve timer. restore_pending alone is not explicit recovery. |
| File import/export, Undo/Redo, named/scheduled document capture | No workshop content or ballot mutation. Imported/new board starts idle. Voting-only work leaves canonical bytes/revision/edited-at/Undo/Redo/file bytes/digest/history count/fingerprint unchanged. |

Worker recovery includes the independent RestoreFence signal in worker.ts before
Room loading; a room-local reset alone is insufficient. Node includes start-node's
recoveryGeneration/roomEntry and the real stopped-volume marking script. Ordinary
restart and marked recovery must be paired with the same pending-history phase.
No per-vote alarm or inactivity expiration is added.

## Uncertain client and exact words

One outstanding mutation per tab; immediately show Checking vote… and Last
confirmed, retain only confirmed own dots/budget at opacity .45 and disable voting
mutations, selector and local entry/exit controls. Do not optimistically paint a
new dot. After exactly 2,000 ms without answer send one vote_read, never resend
the command. One outstanding read; read on join/reconnect/foreground and every
15,000 ms connected. Failed read/transport/required authority or 30,000 ms without
a successful read shows Voting disconnected. Reconnecting… and Last confirmed ·
uncertain, with last confirmed state dimmed. Before confirmed snapshot show
Connecting voting…, no false idle/result. Timer and Close/navigation remain usable.
The shell may wait for joined before exposing workshop controls. Before that
admission there need be no toolbar/panel; never manufacture a partial joined
message to make the connecting label visible. An active controller with no
confirmed projection uses Connecting voting…, rather than invented idle state.
Discard pending work on fresh admission; no automatic retry/replay.

Fresh 4403 viewer rejoins with public metadata only and no voting input/own state;
timer rights remain. Confirmed loss/sign-out/account/board boundary clears voting
snapshot, own state, draft, overlay, mode, confirmation, pending work and speech
before delayed responses. Responses are scoped to board/account/connection/epoch/
generation; ignore obsolete or lower session/private versions. Equal session
versions may carry newer own versions or visible target reconciliation. Never
discard a legitimate own update because public version stayed constant.

| State | Exact card words and actions |
| --- | --- |
| idle owner/editor | Voting; New vote |
| idle viewer | Voting; No voting session. |
| expanded setup | Voting; Question; N / 240 counter; Votes per person; −; budget; +; All eligible objects on this board; Start voting; Cancel. No placeholder. |
| running voter | Voting; prompt; N of B votes remaining; Enter voting / Done voting; Eligible object; Your vote when the selected target is voted; Vote; Remove vote; End and reveal |
| running viewer | Voting; prompt; Voting in progress. Only owners and editors can vote. No budget, ballot or control. |
| own slot unavailable | Voting; prompt; This voting round has reached its participant limit.; End and reveal. No ballot input. |
| reveal confirmation | Voting; End voting for everyone?; This ends voting and reveals the results to everyone with access to this board.; Cancel; End and reveal |
| revealed | Results; prompt; Voting ended. Results revealed.; ranked labels/counts; Clear results for owner/editor only |
| clear confirmation | Voting; Clear voting results?; This removes the latest voting results for everyone.; Cancel; Clear results |

Hover/focus explanations are Add vote, Remove vote, Not eligible for this vote,
No votes remaining. Already-voted target disables Vote, enables Remove vote,
and exposes Your vote. At zero budget new casts disable, removals remain enabled.
Selector options are current labels in captured order; an empty square is Square.
Use current object text/type labels, never save full text/images in voting rows.
Results sort count descending, then captured startOrder, then UUID. Include zero;
rank is list order. Label buttons focus/navigate to current live objects without
editing. Removed object has no navigation action. No names, colours or breakdown
appear in results and no past-results tab exists.

## Concrete presentation and keyboard

All CSS dimensions are border-box and fixed CSS pixels unless marked derived.
Shared nonmodal dialog: title Timer and voting, Timer subheading/card first,
Voting/Results second, one Close Timer and voting. No person/actor/byline or
reserved attribution space in either card. Panel width 240, right 12, top actual
actions-bar bottom +12, max-width viewport−24, max-height viewport−top−12,
overflow:auto, z4, white/#29272e, border 1px #e9e7ed, radius12, padding12, gap8,
shadow 0 2px 8px #29202e0a. Cards add no second padding; inner width derives to214.
Header height40. Separator1px #e9e7ed with8px on each side. Children do not shrink.
Card column gap8/margin0/min-width0; system-ui13px/1.5; headings600; body
wrap:anywhere; labels/status/counter12px/1.45/#79737f and label gap4.

Controls min-height40, padding8px 12px, border1px #e8e7ed/radius8. The following
assignments are exhaustive for voting buttons; action names alone never imply
primary styling. A confirmation action is distinct from its neutral opener.

| Family | Actions | Resting treatment | Enabled hover / focus / pressed treatment |
| --- | --- | --- | --- |
| Primary card actions | New vote; Start voting; Vote; End and reveal **inside its confirmation**; Clear results **inside its confirmation** | Background #7051cf, text #fff, 1px solid border with **border-color:#7051cf**, radius8 | Hover background #6142be, retaining white text and purple border. Focus-visible outline3px solid #7051cf/offset3px. Momentary pointer/key press adds no latched colour, transform or animation; current rest/hover colours remain. |
| Neutral card/strip actions | Cancel in setup and both confirmations; Enter voting; Done voting in card and strip; Remove vote; End and reveal **opener**; Clear results **opener**; Decrease votes per person; Increase votes per person | Background #fff, text #29272e, 1px solid #e8e7ed border/radius8; stepper keeps40×40/padding0, strip retains its narrow padding rules | Hover background #f1eff5, text/border unchanged. Focus-visible outline3px solid #7051cf/offset3px. Momentary press adds no further styling or latched state. |
| Shared neutral Close | Close Timer and voting | Inherit `.w1-panel button.w1-close` in apps/web/style.css: transparent background, zero border,40×40 hit/padding0,24px glyph, text/currentColor #29272e | Inherit `.w1-panel button:hover:not(:disabled)` (#f1eff5) and `.w1-panel :focus-visible` (3px solid #7051cf/offset3px). Momentary press adds no further styling or latched state. |
| Result-row label navigation | Each surviving current-object label; Removed object is plain text, never a button | **Transparent background, zero border**, text #29272e, padding8px 0,13px/1.5, remaining row width | Enabled hover background #f1eff5 from shared `button:hover:not(:disabled):not([aria-disabled=true])` / `.w1-panel button:hover:not(:disabled)`; zero border and text unchanged. Focus-visible inherits `.w1-panel :focus-visible` (3px solid #7051cf/offset3px). Momentary press adds no further styling or latched selection. |

These action families use native momentary buttons, **no aria-pressed**; Enter/
Done voting expresses the local mode through its label, not a latched pressed
button. Thus shared `button[aria-pressed=true]` rules do not apply. `:active`
does not introduce another palette; focus-visible still applies during keyboard
activation. Primary hover must explicitly take precedence over the neutral
shared-panel hover rule. For every family, disabled opacity .45 and no hover/
activation apply; disabled primary buttons retain their purple fill/white text/
purple border before opacity. Focus outlines do not change border or dimensions.
Existing timer buttons retain timer v2/v1's named `.w1-hit`, `.w1-disc`,
`.w1-add`, `.w1-confirm-row .primary` hover/focus treatments; no voting rule
restyles them. Question textarea height
and min-height96, resize:none, full width; select height40; both same border,
radius, padding and13px/1.5 font. Counter right aligned using actual code-point
count. Stepper grid40px/1fr/40px gap8, buttons40×40/padding0, centred tabular
output; names Decrease votes per person / Increase votes per person.
Vote/Remove row natural flex widths/gap8/min-width0; Start voting and Cancel each
have a full-width row, as does End and reveal. Confirmation row natural widths,
right aligned/gap8, Cancel first. Results list max-height280/overflow:auto/gap8;
rows min-height40, horizontal flex/gap8/no extra padding or border, with row
contents vertically centred (`align-items: center`). Label action
flexes with padding8px 0/13px/1.5, transparent resting background and zero border
as specified above, and its text is left-aligned (`text-align: left`); missing
label #79737f. Count min-width24/height24,
padding0 6px/radius12/#7051cf/#fff/12px tabular, numeral centred horizontally and
vertically inside the badge (`display: grid; place-items: center`); allow width to
grow for two digits. Canvas result badges use the same numeral centring.

Timer keeps its dedicated controller/drafts/clock/focus, 79×68 fields/48px digits,
33px circles in40px hits and68×24 + 1 min visual in68×40 hit. Timer-only behavior,
status typography, confirmations, announcements and title prefix are unchanged.
Its toolbar remains immediately before Share, idle98×40/active62×40, no visual
voting cue. Exact accessible label is the former timer label with prefix changed
to Timer and voting, e.g. Timer and voting, idle, 03:00; append , Voting in
progress only while voting runs. Connecting timer becomes Timer and voting,
Connecting timer. Timer and voting, running, 02:14, Voting in progress is one
complete example. Voting never changes the browser title or timer state/time.

Local voting strip: Voting · N of B votes remaining · Done voting; fixed left12,
top actual context-bar bottom+8 when visible, otherwise maximum actual top-bar
bottom+12; z3, panel surface/font/shadow, padding8px 12px/gap8, max-width
viewport−24, flex wrap. At widths below600px, closed panel strip width viewport−24
and Done voting takes a full second flex row. Open panel reserves8px between it
and strip: width=min(viewport−24,panel.left−12−8), derived103 at375px. Done button
width100%, padding8px 4px/normal wrapping. Do not hard-code a universal y or panel
height. Keep real selected-object context/handles at their current positions.

Own dots: fixed12×12 including2px white border, radius50%, stable own colour,
z2/pointer-events:none; CSS size does not scale with zoom. Result badge uses
the count style above, z2. For sticky/shape/image (and empty text), dot left =
object.right−8−12, top =object.top+8. Badge right =object.right−8, top =object.top+8;
min24×24 means left =object.right−32 when width24. **Text with glyphs anchors to
the end of its first displayed line:** dot left =line.right+6; badge left
=line.right+8; both top =line.box.centerY−marker.height/2. Clamp left to at most
object.right−8−marker.width. Derive first-line geometry from actual rendered runs,
font, alignment, wrapping and view transform, not the text box's top-right or
glyph-ink guess. Recompute at pan/zoom/move/edit, without document geometry changes.
Markers must not cover selection handles/context controls; ordinary viewport/
panel occlusion is allowed. No results marker on a missing/different generation.

Eligible hover outline2px #7051cf/z1; no purple outline for ineligible hover.
Tooltip left=actual object.left, top=actual object.bottom+8, white/#29272e
(ineligible #79737f), padding4px 8px/border1px #e9e7ed/radius8/font12px/1.45/z3.
No new voting animation, pulse,
sound or flash. Keep the timer's independent reduced-motion-aware cue.

Pointer primary click uses Board hit testing on the topmost actual object;
toggles one eligible member, never through an ineligible object or by group
expansion. Empty/ineligible click and drag cast nothing. Pan/zoom/Space-drag stay
navigation. Finish text entry/gestures before mode entry. Ballot clicks do not
move/resize/edit content. Outside local mode ordinary editing remains available.

Native single-select Eligible object supplies keyboard target access. In local
mode unmodified canvas Enter toggles one focused/sole selected eligible target;
ignore repeat, IME/composition, modifiers and native text fields. Space remains
pan. Native buttons retain Enter/Space. No multi-cast. Canvas Escape exits mode
without unvote; panel Escape/Close returns toolbar focus. Confirmation Escape/
Cancel sends nothing and returns opener. Closing/handoff does not end a round.

| Focus phase | Enabled forward order (reverse with Shift+Tab) |
| --- | --- |
| shared opening | Timer opening focus as timer v1: idle Minutes, active Pause/Resume, zero End, unavailable Timer heading; no focus trap/aria-modal/positive tabindex |
| timer traversal | Idle Minutes→Seconds→+ 1 min→Start timer; active + 1 min→End timer→Pause/Resume; skip disabled cap/zero/health controls, then voting controls |
| voting idle/setup | New vote; expanding focuses Question. Question→Decrease votes per person→Increase votes per person→Start voting→Cancel |
| voting running | Enter/Done voting→Eligible object→Vote→Remove vote→End and reveal; skip disabled/already-voted/empty-budget controls |
| revealed | Live result label actions in ranked order→Clear results (owner/editor); missing labels not controls |
| reveal/clear confirmation | Cancel initially focused→End and reveal or Clear results; timer card remains usable |
| end of panel | One Close Timer and voting→normal Share; viewer skips unavailable voting actions |

The one Close remains last in DOM traversal even if visually in the shared header.
Remote changes preserve an enabled logical control; if focused within the voting
card and it disappears/disables, focus Voting/Results heading tabindex−1. Preserve
control meaning, not a reused DOM node. Never steal canvas focus. Scroll focused
rows into view. Existing History/Comments/Share exclusive handoffs keep controller
drafts. History preview disables target controls/entry/overlays, not reveal/clear.

One separate `.sr-only[data-workshop-status="voting"]` region with role=status/
aria-live=polite/aria-atomic=true, outside timer/save regions and kept mounted
while the hosted workshop control is active, including with the panel closed.
Timer has the distinct data-workshop-status="timer" region defined in timer v2.
Assert exactly one of each **by identity**, never one global polite region.
Voting text assertions and mutation observers target only the voting node;
timer assertions/observers target only the timer node. Do not collect both and
filter strings afterwards. Exercise both channels independently so timer speech
cannot satisfy or contaminate a voting assertion, nor voting speech a timer one.
Exact live Start: Voting started. Open Timer and voting to
participate.; own budget: N of B votes remaining; reveal: Voting ended. Results
revealed.; clear: Voting results cleared.; recovery: Voting reconnected (no
period). Loss uses Voting disconnected. Reconnecting…. Capacity and budget
refusals use their exact visible sentences/hover words above; other admitted
refusals use Voting could not be updated. Try again. Reset is silent. Coalesce
rapid own changes, deduplicate reply/state copies with bounded high-water marks.
No remote vote/count/person/cursor/per-row/read/timer-tick speech. Fresh snapshot
seeds suppression; reconnect announces only Voting reconnected, never old Start/
reveal/own changes. Colour is supplemented by Your vote and readable budget.

## Derived geometry and deterministic fixtures

Font/size-dependent positions and rectangles are **derived**, tolerance0.5 CSS px;
wrapped text heights allow1px. Specific timer/voting text styles override generic
dialog paragraph styles. Measure from the prescribed styles, not candidate
values or a fixed overall timer-only panel height.

At1280×800 actions bottom60 yields panel x1028/y72/w240; at375×812 preserve the
actual second actions row y68/h48 and avatars/overflow, panel x123/y128/w240.
Inner header desktop(1041,85,214,40); Timer subheading y133/h19.5; fields top160.5,
input y181.891/79×68 at x1053/1164; controls y257.891/h40; separator y305.891/h1;
voting card y314.891. Narrow adds56 to these y values. Header/Timer label are
present even in timer confirmation; its card's own content determines height.
Combined height for timer idle or running without status =255.890625 + voting
card natural height, then clamp/scroll to panel max-height. Example heights:
idle editor323.391, idle viewer300.781, setup616.953, running voter567.062,
viewer345.672, capacity393.672, reveal confirmation417.391, results616.281,
viewer results568.281, clear confirmation397.891, checking/reconnecting617.844,
history preview592.453. Timer Paused/Timer finished/health lines add their actual
line boxes/gaps; never reuse a generic height from a different timer state.

Synthetic running fixture: ana owner, ben editor/non-starter, mia viewer, Acme /
Launch plan; Question Which idea should we try next? is **30** code points;
budget5, own votes on second note/square/text,2 remaining, colour #dc2626.
Desktop notes(220,200,240,240),(560,200,240,240), square(220,510,180,120),
text(400,480,320,120), labels Interview five customers / Pick the launch date /
Square / Draft the pricing page. Text18px system-ui/1.45/inset20 yields first
line right≈595.193/centreY≈513.05: dot≈(601.188,507.047,12,12), zero badge≈
(603.188,501.047,24,24). These are receipts within tolerance, not universal anchors.
Second note dot(780,208,12,12), result badge(768,208,24,24). Pan x−110 shifts all
object/marker x by−110; selected second-note context≈(178.438,134,783.078,40),
strip top182; preserve16×16 corner hits and existing mid-edge controls. At narrow
closed, strip(12,128,351,85.5); open strip(12,128,103,149.5). Recompute fonts/views.

For results, create a fifth eligible target before Start; achieve totals
3,3,2,1,0 by real ballots, reveal, then delete only the third-ranked target.
Expected list: Interview five customers3; Pick the launch date3; Removed object2;
Square1; Draft the pricing page0. Four surviving badges, no dots, no attribution.
For spent fixture use budget3 and three own targets:0 of 3 votes remaining.
Set-up counter examples0 / 240,30 / 240,240 / 240 use actual code points.
No fixture caption, crop, second toolbar frame or explanatory inset ships.
