# 0004 — Presence and spotlight contract

CONTRACT VERSION: 0004 presence v3 (2026-11-10)

Status: Draft for 0007-W3 v1. Replaces [presence v2](0004-presence-v2.md),
inheriting [presence v1](0004-presence-v1.md). Ordinary stamped presence,
palette, strict five-key client frames, expiry and voting privacy remain.
This contract owns spotlight state, wire, bounds and lifetime;
[interaction v37](0001-interaction-v37.md) owns every concrete interface value.
Use the [brief's version set](../briefs/0007-W3-follow-a-facilitator-through-a-board.md)
for inherited references. No stored format changes.

## Authority and membership

One ephemeral spotlight belongs to an active hosted team-board room on either
runner, including solo use. Every currently admitted effective owner/editor/viewer,
including a guest with an editor/viewer board grant, can present or follow.
Ungranted guests, removed/disabled people and outsiders cannot read or participate.
No facilitator role or billing gate. Local boards and team-off builds have no
spotlight controller, UI or request.

The server creates the session UUID and stamps the presenter connection,
board-scoped person, verified label and presence colour. Pin that exact connection;
never choose another tab on ordinary presence updates. Starting first leaves
manual Follow. Another person's or another own tab's deliberate Spotlight me
takes over atomically: invalidate the prior session, capability, offers and
memberships, retain all current views, then offer the replacement. A displaced
presenter of a different person gets a fresh offer; the new presenter's other
tabs get no own-person auto-offer, including a displaced own tab. Repeated Start
from the presenter cannot reset the session/countdown.
Only the current presenter connection may Stop/Cancel. A presenter cannot follow
another person while presenting. There is no Ask to spotlight operation.

Each follower connection acknowledges its own membership. Count distinct admitted
follower people, excluding the presenter's person: two following tabs count once,
each can leave independently. Only the presenter receives the numeric count and
whether any follower has ever joined this session. Others receive only the
presenter and their own membership, never a follower roster or another person's
follow flag. No list of historical arrivals; all membership storage is bounded by
the existing 50 simultaneous room connections. Once someone has joined, zero
followers remains a count, not a new waiting phase or a renewed offer.

## Exact state and wire

Lowercase canonical UUIDs identify authority, session, connection and requests.
Versions, epochs, generations and timestamps are nonnegative JS-safe integers.
All objects below have exactly the listed keys; reject unknown keys and invalid
types. Names/colours reuse presence v1's verified label bound and palette.

`Session` is exactly `{authorityId,sessionId,controlVersion,phase,presenter,graceDeadline}`.
Idle has phase `idle`, sessionId/presenter/graceDeadline null. Live has phase
`active`, a UUID sessionId and presenter exactly `{connection,person,label,colour}`,
graceDeadline null. Suspended has phase `reconnecting`, the same logical session
and presenter identity, with an absolute server-time graceDeadline. An absent
presenter descriptor is never an independent source of coordinates.
`Own` is exactly `{membershipVersion,following}`; following is boolean.
`PresenterInfo` is exactly `{followers,hasHadFollower}`, followers integer 0–49
and hasHadFollower boolean. `Projection` is exactly
`{session:Session,own:Own,presenting:PresenterInfo|null}`. presenting is nonnull
only for the current presenter connection; idle own.following is false.

An idle room starts controlVersion 0 with a new random authorityId. Control
transitions Start/takeover/Stop/suspend/resume/end advance controlVersion once.
Membership changes advance only the sender's membershipVersion; presence/view
updates advance neither. Independent followers do not contend on a global
membership version. A new session resets membership versions to 0. Every
projection is composed at its ordered send point; preserve socket order for
equal-control-version membership/count updates. Never replace a newer accepted
membership with an older read/result. Incarnation/session IDs fence commands
across room replacement; no version wraps. Authority is retained only by valid
live-presenter attachment reconstruction, otherwise a fresh idle authority wins.

Let M = Number.MAX_SAFE_INTEGER (9,007,199,254,740,991). A successful
start/take_over/resume must leave controlVersion ≤ M−2, reserving one increment
for possible suspension and one for mandatory termination. After normal
admission/identity/version/presenter/phase checks, refuse those actions with
spotlight_version_exhausted when current controlVersion > M−3; do not change
state, invalidate the old session, rotate a key or retry. Compare before adding.
Active state therefore has controlVersion ≤ M−2; suspension advances it once to
at most M−1. Every terminal invalidation (Stop, committed voting Start,
revocation/removal, grace expiry, lifecycle close or last leave) advances once
to at most M and always clears the session/key/memberships/deadline. An accepted
take_over invalidates the old session in the same single increment that installs
the replacement; its headroom check precedes either change. Repeated terminal
callbacks on idle are no-ops, not increments. An exhausted idle authority stays
readable but cannot start again; never reset its version to evade exhaustion.
Validate these phase bounds on reconstructed attachments. No counter wraps and
no terminal invalidation is refused for controlVersion exhaustion.

Membership uses the same M and reserves two increments. A successful follow or
internal resume-follow after presenter rebind requires current membershipVersion
≤ M−3 and advances it once to at most M−2. Otherwise refuse exactly
spotlight_version_exhausted, never wrap or retry. Leave advances once to at most
M−1; subsequent mandatory cleanup advances once to at most M. Session end,
takeover, committed voting Start, revocation/removal, grace expiry and last leave
all invalidate each retained per-session membership record with that reserved
increment before clearing active membership. On a still-live connection retain
only its finalized nonfollowing version fence (at most M) until session replacement
or connection loss; it cannot follow again in that same connection/session.
This is at most one bounded record per current connection, never an arrival log.
Removed/finalized records and duplicate cleanup are no-ops; never increment an
already-invalidated record twice. A fresh session UUID or fresh admitted connection
may start membershipVersion 0; never reset within the same live connection/session.
Validate following≤M−2 and unfinalized nonfollowing≤M−1; finalized nonfollowing
may be M but cannot be re-enabled. Connection loss erases its fence metadata.

Resume-follow is an internal per-follower step, not a new wire action or queued
mutation. A suspended member keeps its version until rebind. If re-enabling its
following would exhaust headroom, remove that member using the reserved leave
increment, keep its view frozen/left and send that currently admitted connection
spotlight_refused with requestId:null/reason:spotlight_version_exhausted and its
current projection. Do not block other members or the presenter's valid rebind.
A subsequent session cleanup still has its final increment available. Explicit
follow exhaustion leaves the existing membership unchanged; local leave always
works. No membership refusal prevents terminal invalidation.

Mutation base is exactly
`{kind:"spotlight_command",requestId,epoch,restoreGeneration,authorityId,sessionId,action}`.

| Action | Additional keys / preconditions / effect |
| --- | --- |
| start | expectedControlVersion; idle/current authority, sessionId null; server creates a session for sender |
| take_over | expectedControlVersion; active or reconnecting current session; replace session/presenter and all offers/memberships; current presenter uses Stop instead |
| stop | expectedControlVersion; current session and presenter connection only; end, including waiting Cancel |
| follow | expectedMembershipVersion; active current session, sender not presenter's person, fresh real presenter presence accepted after Start/rebind; set sender following true |
| leave | expectedMembershipVersion; current active/reconnecting session; set sender following false, sender only |
| resume | expectedControlVersion, resumeKey; suspended current session, strictly before graceDeadline, same verified account/epoch/restoreGeneration and private tab capability, fresh real presence on new admitted connection; bind that connection and rotate key |

Read is exactly `{kind:"spotlight_read",requestId,epoch,restoreGeneration}`.
Reading or joining never acknowledges following. Joined adds `spotlight:Projection`;
it never exposes the resume capability. A presenter receives its new resumeKey
only in the successful start/take_over/resume result. Use a cryptographically
random 32-byte key encoded as 64 lowercase hex characters, compared without
logging/disclosing it to other connections. It lives only in presenter page
memory and server attachment/room memory, never a URL or browser storage.

| Frame | Exact keys |
| --- | --- |
| accepted command | {kind:"spotlight_result",requestId,spotlight:Projection,restoreGeneration,cause}, plus resumeKey only for successful start/take_over/resume |
| read reply | {kind:"spotlight_snapshot",requestId,spotlight:Projection,restoreGeneration} |
| publication | {kind:"spotlight_state",spotlight:Projection,restoreGeneration,cause} |
| refusal | {kind:"spotlight_refused",requestId,reason}, plus {spotlight:Projection,restoreGeneration} only after successful current admission |

cause is exactly start/take_over/stop/follow/leave/reconnecting/resume/left/voting/
preview/lifecycle/recovery. Never an actor or coordinate. Membership publication
goes only to that connection and refreshed presenter count; peers receive no
membership event. Fresh join/read/refusal seeds state without historical speech.
No capability in publication/snapshot/refusal/logs. requestId is null when a
valid UUID cannot be parsed. These are correlation IDs, never durable receipts.

Refusals are exactly spotlight_bad_message, spotlight_message_too_large,
spotlight_rate_limited, spotlight_stale_session, spotlight_stale_member,
spotlight_state, spotlight_not_presenter, spotlight_voting,
spotlight_version_exhausted, spotlight_access_changed, spotlight_unavailable.
Unknown keys/type/action/UUID use bad_message; session/authority/control mismatch uses stale_session;
membership mismatch uses stale_member; wrong phase, duplicate follow/leave,
own-person follow or no fresh view uses state; another connection's Stop uses
not_presenter. Check current admission first, running voting next for
start/take_over/follow/resume, then expected identity/control, membership,
presenter and phase, then the applicable control/member headroom rule above. Exhaustion uses
exactly spotlight_version_exhausted, not bad_message/state/unavailable. Failed
authority lookup returns unavailable without cached projection; failed access returns access_changed without protected fields and
the existing close policy. Outer malformed JSON/unknown kind/over-limit frame
retains bad_message/message_too_large without inferred protected data.

Use the single Room.ordered queue for awaited authorization, commands, reads,
membership, close/expiry/access/lifecycle and voting start. Recheck after awaits
and before any state change or recipient send. First valid control wins; stale
or duplicate commands refuse with current admitted state, never retry with
changed expectations. Delayed leave cannot undo a later join or another session.
No spotlight command enters edit/timer/voting receipts, journals or offline
waiting/replay. A resume is a fresh authenticated handshake, not Start replay.

## Bounds, motion and protected sends

| Value | Bound |
| --- | --- |
| Spotlight command/read, including whitespace | 1,024 UTF-8 bytes |
| Each spotlight result/state/snapshot/refusal and joined's added projection | 4,096 encoded UTF-8 bytes; not a cap on the document-bearing joined envelope |
| Descriptor/capability/membership metadata per attachment | 1,024 encoded bytes excluding existing fields and the separately bounded rate budgets |
| Mutation and read budgets | Separately 5 recognized attempts in rolling (t−1,000,t], invalid recognized attempts included; at most five timestamps each, each budget at most 1,024 encoded bytes |
| Full serialized connection attachment | 16,384 bytes including presence, all timer/voting budgets and spotlight metadata/budgets |
| Existing outer frame | 1,048,576 bytes; unchanged |

Measure maximal legal encodings on both runners and refuse overflow before any
partial transition. Over-limit attempts never grow counters or refresh token/
presence lifetime. One room descriptor, one private capability, at most one
bounded metadata entry and two bounded rate arrays per live connection; no
unbounded tombstones/arrival list. Expiry/close removes membership metadata and
rates; session end erases descriptor/key/memberships and drains grace deadlines.
No new SQLite table, meta row, journal, Supabase row, backup field or browser
disk value. Existing row ceiling 2 MB, journal 65,536, raw chunk 1,048,576,
document 2,097,152 and logical backup 16,777,216 bytes are unchanged and receive
zero spotlight bytes. Room layout 7 is unchanged.

Reuse ordinary presence: 100 ms coalescing/trailing send, 15 s heartbeat,
10 messages/1,000 ms, 12,288-byte presence frame, 250 selections, 30,000 ms
presence expiry and 50 connections. Cursor and view share that budget.
Apply latest accepted real view using existing fitFollow/setFollowView, centre
of presenter rectangle, zoom min(local width/presenter width, local height/
presenter height) clamped .5–2, centre clamped ±1,000,000. Resize refits. A small
screen may crop at the floor; panels do not shrink the scene. No interpolation,
extra coordinate transport, per-view acknowledgement or latency SLA.
Fresh accepted presence after Start/rebind is required even if active=false;
the joining placeholder cannot be treated as a real view. Ordinary manual
Follow retains chooseFollow's active-then-latest choice pinned once. During a
spotlight, following its presenter via avatar joins membership; following a
different person leaves membership and starts ordinary Follow independently.

Every spotlight command/read/join/publication/reconstruction requires current
token, strict access replay, effective role, epoch/restoreGeneration, active
lifecycle and no deletion marker. Gate the presenter's ordinary spatial relay
by the same current authority while spotlight runs; withheld authority must not
leak coordinates through a presence shortcut. A voting Start rejected before
commit leaves spotlight unchanged; a committed Start ends it in the same ordered
transition before any post-commit await or subsequent spatial delivery, even if
stamp/authorization/reply delivery later fails. The committed transition invalidates
offers/keys and refuses start/take_over/follow/resume. Leave/read remain safe;
read is idle. Keep cursor=null, selection=[], view={x:0,y:0,width:1,height:1} on
every running-vote join/relay/reconstructed attachment. Reveal/reset requests
fresh presence but never restores spotlight or manual Follow. Timer is independent.

## Lifetime event table

All endings retain each person's last current view and never edit content.
Interaction v37 specifies words, focus and speech for these transitions.

| Event | Required transition |
| --- | --- |
| Presenter Cancel/Stop | End immediately; clear offers/banner/frame/rings/key/memberships. No departure toast. |
| Clean tab close or deliberate board leave | End on clean departure; authorized peers get the presenter-left ending, no return resume. Best-effort navigation Stop is useful, never required for correctness. |
| Presenter reload | New page has no key and cannot resume. Clean close ends; if detected as abnormal, only the same bounded grace may delay ending. |
| Recoverable client close4410 / abnormal network/error interruption | Freeze followers, suspend frame, reserve exactly 5,000 ms from server detection; then end unless valid rebind. Existing presence expiry detects half-open sockets; no promise of cable-drop detection in five seconds. |
| Rebind before deadline | Same session, new stamped connection/colour, fresh real presence; rotate key, resume still-connected members who have not left, never pull still-connected decliners/leavers back in. A follower's own re-admission instead gets the fresh offer below. |
| Follower reload/reconnect | Clear old membership/follow/offer/decline/dismiss intent; fresh admission gets a full new offer even for the same session. Offline leave/dismiss only suppresses stale old-connection replies, never this offer. During presenter grace wait for active/fresh view. Never silently resume motion. |
| Late arrival | Fresh offer/full window once active/fresh view exists, no historical start/leave speech. |
| Presenter removed/disabled/access lost | End immediately at revocation processing, invalidate key, no grace; denied presenter gets no snapshot. Restored access does not start it. |
| Presenter role/epoch change with remaining access | End before 4403/4409 closure; fresh admitted role may start anew, never retain old key. |
| Follower access/token expiry/epoch change | Immediately remove membership/protected state. Fresh valid viewer admission may receive new offer; terminal loss gets none. Others continue. |
| Presenter token expiry | End before 4401 close, no grace or resume with old token authority. |
| Presenter presence expires with live socket | Suspend; fresh presence plus admitted resume before the grace deadline required. Expired follower presence removes membership/count. |
| Everyone leaves | End and forget, including grace reservation; no all-absent session. |
| DO memory rebuild/hibernation with live sockets | Reconstruct only from a still-live presenter's server-written attachment after current access/generation/voting revalidation; derive current memberships from follower attachments. Keep live spotlight, key and versions. |
| DO rebuild during absent-presenter grace / lost presenter socket | End grace; absent-presenter room-memory reservation is not reconstructed. Follower attachment can never elect a presenter. Publish/read idle. |
| Node room/process restart | Original surviving Room/connections retain state. Actual process/socket loss ends spotlight, fresh reconnect reads idle; no SQLite restoration. |
| History preview / document-history replacement | Local preview leaves membership or stops presentation and disables new participation. Actual restore/4423 ends globally before close; historical content never restores spotlight. Timer/voting retain their own policies. |
| Trash / discard / purge / logical, marked-volume or Workers time recovery | End before protected close/reset/pre-load shortcut; invalidate keys, drain deadlines. Restore/import/recovered storage starts with none; denial/pending recovery semantics remain. |

Forward original close/error classification end to end. Recoverable client
attempt endings that will retry use wire close code4410 with the fixed reason
retry_recovery. This includes send failure, progress deadline, offline, explicit
recoverable interrupt/reconnect and every other retrying endAttempt path; the
hosted retry cleanup must not overwrite it with1000. Sync v12 supersedes sync
v5's wire1000 rule for these paths. Local deadline event4000/answer_deadline and
send-failure event1006 remain local reports, not this wire code.

Explicit board leave/navigation, sign-out, terminal discard/close and tab close
stay clean1000/1001 (or an explicit leave/Stop message before close); Stop itself
ends the spotlight command without requiring the board socket to close. Actual
4410, missing-close-frame1006 (or a missing Node close code normalized to1006)
and nonterminal network/error loss are grace-eligible. A reason string alone
never converts a clean1000 into recovery. Revocation4403, lifecycle/generation
4423, expiry4401 and conflict/epoch4409, plus all known terminal causes, always
bypass grace even after an earlier recovery/error signal.

Change Room.closed to closed(connection: Connection, code: number = 1006,
reason: string = ""). WorkerRoom.webSocketClose(socket, code, reason) must pass
that original code/reason to Room.closed; only its separate socket.close call
may normalize1006 to1001. webSocketError forwards1011/error classification.
BoardRoom in worker.ts inherits this path. Node start-node.ts changes its
websocket.on("close", () => ...) to (code, reason) => ...closed(connection,
code ?? 1006, reason?.toString("utf8") ?? ""); do not drop the actual code. Its error
path must preserve error classification without consuming a later terminal
close. Make classification idempotent: error+close cannot start/extend grace
twice, while a stronger terminal cause still ends immediately. A reload cannot
reclaim a memory-only key; there is no reliable closed-versus-unplugged oracle.
