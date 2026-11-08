# 0007 — Workshop timer contract

CONTRACT VERSION: 0007 workshop timer v1 (2026-11-08)

Status: Draft for 0007-W1 v1. This contract owns timer state, transport, bounds,
clock, storage, lifetime and rendering. Partners are sync v10, access/API/hosted
persistence/hosted storage v9, runner v5, lifecycle v3, document v14, board file v3,
interaction v35 and web modules v33 in this directory. These versions replace
conflicting inherited statements for this milestone. Saved document stays 10;
current room layout is 6. No dependency or public HTTP timer route is added.

## Authority and lifetime

One timer belongs to an active hosted board on either runner, including a board
with one participant. Every currently admitted effective owner/editor/viewer may
set/start, pause/resume, extend and End. A workspace guest needs a board grant
yielding editor/viewer; guest alone grants nothing. The starter has no privilege.
Document read-only and history preview do not remove timer rights. Local boards
and team-features-off builds have no timer control, state or timer requests.

All timer operations run in Room.ordered, including asynchronous authorization.
Before joining with a timer snapshot, reading one, sampling, commanding or
publishing to a peer, require live active lifecycle/no deleted marker, current
token, access epoch, effective role and restoreGeneration. Recheck at the ordered
write/send boundary. Required lifecycle or strict access replay failure refuses
timer work; stored roles cannot authorize it. No timer snapshot is sent to a
removed, expired, obsolete-epoch or obsolete-generation connection. Preserve
ordinary edit/comment/presence admission policies outside this explicit gate.

Last-leave, reload, late join, starter departure, ordinary Node process restart,
Durable Object eviction/hibernation and ordinary restart preserve the record.
Running time elapses while absent; paused time has no inactivity TTL. Trash
admission clears it behind the lifecycle fence, before closing peers; discard,
purge and explicit operator logical/marked-volume/time recovery also clear it
before serving. Each reset establishes a fresh room generation, so delayed work
cannot target a replacement. Trash restore starts idle. User document-history
restore preserves the current live timer while changing transport generation;
it neither restores an earlier timer nor restarts its duration.

Explicit physical/time recovery is identified by the separate
explicit_recovery_pending marker and explicit_recovery_generation reservation in
[persistence v9](0003-hosted-persistence-v9.md), never by restore_pending alone.
Process the marker and fresh-fence/reset transaction before a pending-history
shortcut/resume. Marked recovery resets the timer even with such an intent;
ordinary restart without the marker preserves it while resuming that same intent.
Preserve the accepted document intent/chunks, gate serving until completion/replay,
and retain the reservation across failed attempts so each load does not reset again.
Logical operator restore has its explicit-entry reset. Exclude both marker keys
from logical backups and reject injection before fences; each encoded marker row
is ≤1,024 UTF-8 bytes. No earlier-volume compatibility work is required.

## Logical state and storage

Store exactly one row per initialized room in `workshop_timer`, outside Yjs,
document/history tables, receipts and meta. Layout 6 adds this table to layout 5's
table inventory. Initialize the row and storage_version 6 transactionally.

| SQL column | Type and invariant |
| --- | --- |
| singleton | INTEGER PRIMARY KEY, exactly 1 |
| status | TEXT, exactly idle/running/paused |
| duration_ms | INTEGER, 0 at idle; starting budget plus accepted extension deltas, positive JS-safe integer while active |
| ends_at_server_ms | INTEGER or NULL; nonnegative JS-safe Unix milliseconds only while running |
| remaining_ms | INTEGER or NULL; 1–5,999,000 only while paused |
| version | INTEGER, nonnegative JS-safe, initially 0; monotonic within the room generation |
| timer_id | TEXT or NULL; server-generated lowercase UUID for an active timer; NULL idle |
| last_actor | TEXT or NULL; verified person's UUID, at most 36 ASCII bytes, server-only; NULL initially/reset |

Idle has duration 0 and both time columns and timer_id NULL. Running has no
remaining_ms; paused has no end timestamp. Reject invalid combinations and unsafe
arithmetic before write; no partial version/state write or success publication.
last_actor records accepted participant mutations only, survives End/expiry until
the next participant action or reset, and never contains a label/email. It is not
serialized to clients, announced or used for control ownership. Expiry fabricates
no actor. No accumulated log, command journal or per-tick row is stored.

Every complete encoded timer row, including keys, must be **≤1,024 UTF-8 bytes**.
Every scalar above has a fixed enum, UUID or JS-safe integer bound, including the
cumulative duration budget. Measure the maximal legal encoded row on both runners.
This is below the inherited <131,072-byte new-row budget and 2 MB runner row ceiling;
it adds no journal. Existing journals remain ≤65,536 UTF-8 bytes, document chunks
≤1,048,576 raw bytes, canonical documents ≤2,097,152 bytes and complete logical
backup ≤16,777,216 bytes. Do not enlarge any inherited limit.

Logical backups explicitly omit workshop_timer, including an empty table; never
rely on the default registered-table copier. Backup envelope stays version 1,
with current meta.storage_version 6 and all other current backup tables/keys.
Restore validation rejects an injected workshop_timer table, timer meta key,
timer field in any strict row or extra top-level timer payload with 400 bad_request
before advancing fences or writing anything. A valid operator restore clears
the existing timer atomically with local replacement and keeps denial until its
fresh recovery fence/access replay succeeds. Physical recovery clears the recovered
row before serving. Document-history replacement must not use that reset path.

## State transitions and ordering

Start duration is an integer multiple of 1,000 ms in **1,000–5,999,000** (00:01–99:59).
Default tab draft is 03:00. All authoritative stamps use env.now(), never client
timestamps. Each accepted mutation and expiry normalization increments version
once in the same storage transaction. Broadcast only after commit.

| Current state | Command | Result at server time t |
| --- | --- | --- |
| idle | start(durationMs) | new timerId, running, durationMs accepted, end=t+durationMs |
| running before end | pause | paused, remaining=end−t; duration/timerId kept |
| paused | resume | running, end=t+remaining; duration/timerId kept |
| running before end / paused | extend | add min(60,000, 5,999,000−remaining) to remaining and duration; running end increases by that delta |
| running / paused, including zero window | end | idle, active fields cleared; last_actor becomes caller |
| running at/after end+2,500 | normalize on read/command/wake | idle, version+1, active fields cleared; last_actor retained |

At the extension cap refuse timer_bounds; do not consume a version with a zero
delta. In the running interval [end,end+2,500), zero is presentation of the expired
running record, not a fourth persisted status. Only End mutates there; pause,
resume, extend and start refuse timer_state. At end+2,500 normalize **before**
identity/version comparison or reply. A late wake normalizes once without replaying
completion. Pause/End racing expiry has exactly the state implied by its queue slot.
End of idle and all other missing edges refuse timer_state. There is no Reset
command: confirmed End returns shared state to idle; the next Start uses that
participant's own tab draft.

Commands carry expected timerId/version. First valid command in receipt/queue
order wins; recheck when it executes, including after an awaited authority read.
Two simultaneous Starts create one timer; two extends at the same version add
one minute, not two. Duplicate delivery cannot apply twice. A stale request is
refused with the current snapshot, without merging, automatic retry or rewriting
its expected version. No offline queue or durable mutation receipt exists.

## Exact socket protocol

Use existing authenticated `POST /boards/:board/join-tickets` and
`GET /boards/:board/join?ticket=...`. No new HTTP route or URL fragment.
Current joined adds `timer: Snapshot` and `serverNowMs`; restoreGeneration already
exists. Snapshot is exactly `{status,durationMs,endsAtServerMs,remainingMs,version,timerId}`
with the state invariants above; last_actor is excluded.

Client mutation is exactly
`{kind:"timer_command",requestId,epoch,restoreGeneration,timerId,expectedVersion,action}`,
plus `durationMs` only for action start. action is start/pause/resume/extend/end;
timerId is NULL for idle Start and the active lowercase UUID otherwise. requestId
is a lowercase UUID used only for reply correlation. Epoch/generation/version
are nonnegative JS-safe integers. No actor, role, end, remaining, client time or
unknown key is accepted. Mutation frame ceiling **1,024 UTF-8 bytes** includes JSON
whitespace; the inherited **1,048,576-byte** outer frame ceiling runs first.

Read/sample request is exactly
`{kind:"timer_read",requestId,epoch,restoreGeneration}`; same UUID/integer rules
and 1,024-byte bound. A client has one outstanding read, initiated on join/reconnect,
foreground return and every **15,000 ms** while connected. Each connection allows
at most **5 reads per rolling 1,000 ms**, separate from mutation budget. Sampling
never changes state/version except due expiry normalization, or renews presence.

| Server frame | Exact fields |
| --- | --- |
| command accepted | {kind:"timer_result",requestId,timer:Snapshot,serverNowMs,restoreGeneration,cause} |
| read/sample reply | {kind:"timer_sample",requestId,timer:Snapshot,serverNowMs,restoreGeneration} |
| committed state broadcast, sender included | {kind:"timer_state",timer:Snapshot,serverNowMs,restoreGeneration,cause} |
| refusal | {kind:"timer_refused",requestId,reason,...authorizedSnapshot} |

`cause` is exactly start/pause/resume/extend/end/expire/reset, an actor-free enum
of at most6 ASCII bytes, derived by the server from the committed transition.
Reject a missing/unknown cause on these frames without transition speech and
obtain a fresh read; do not route it through document-edit refusal handling.
Accepted command results use their command's cause; duplicate/stale commands
remain refusals, not replayed successful results. State broadcasts use the same
cause/version as the result for that transition. Expiry normalization at
end+2,500 uses expire; lifecycle/explicit recovery reset uses reset where a live
publication is eligible. serverNowMs is reply time and never determines cause.
Do not store an event log/cause journal or add it to Snapshot. Joined, timer_sample
and timer_refused have no cause and cannot replay an earlier announcement.
Each complete timer_result/timer_state/sample/refusal frame, including the enum,
UUIDs and maximal safe-integer fields, is ≤1,024 UTF-8 bytes; measure actual maxima.
Request and stored-row/attachment bounds remain unchanged at1,024 bytes.

requestId is NULL in refusals when it cannot be parsed as a valid UUID.
authorizedSnapshot is exactly `{timer,serverNowMs,restoreGeneration}` only after
successful live admission; otherwise it contributes no fields. reason is exactly
timer_bad_message, timer_message_too_large, timer_rate_limited, timer_stale,
timer_state, timer_bounds, timer_unavailable or timer_access_changed.
Unknown keys/types/action/UUID => timer_bad_message; valid shape but duration or
arithmetic outside bounds => timer_bounds; identity/version mismatch => timer_stale;
required authority/storage failure => timer_unavailable. No edit refused frame or
edit receipt/reconnect UI is used for these reasons. Outer overflow retains its
existing message_too_large refusal; malformed JSON/unrecognized kind retains
existing bad_message, with no inferred timer snapshot.

Allow **5 mutation attempts per connection per rolling 1,000 ms**, interval
(t−1,000,t]. Recognized timer_command attempts count, including invalid ones;
over-limit attempts refuse without growing stored counters. Keep at most five
recent timestamps per budget in socket attachment, surviving hibernation. Each
budget's encoded attachment data ≤1,024 UTF-8 bytes; no SQLite journal. Unauthorized
attempts cannot renew presence or token lifetime. Epoch/token/generation failure
follows existing 4403/4409/4401/4423 socket policy with no protected snapshot; where a
reply can precede closing use timer_access_changed without authorizedSnapshot.
Only live-admitted peers receive a state broadcast. If required authority is
unavailable, pause timer publication and commands; no cached successful snapshot.

## Clock and uncertain results

Stamp replies when constructing them after ordered work, using server Unix ms.
For a matched sample take client monotonic send/receive p0/p1 and server stamp s;
estimate serverNow = s + (performance.now()−(p0+p1)/2). Do not use Date.now() for
rendering or let an old response reanchor a newer sample. Render running seconds
as ceil(max(0,end−estimatedServerNow)/1,000); paused uses ceil(remainingMs/1,000).
Same-generation lower versions are ignored; equal-version sample replies may
refresh the clock, never revert state. Different-generation responses require a
fresh joined session. A sample belongs to its board/account/connection epoch.

Two controlled connected browser contexts with the same acknowledged version and
fresh samples must differ by **≤1,000 ms**, including a client wall clock skewed
by +300,000 ms and a later wall-clock jump. This is a controlled check, not a
network-latency promise. Use monotonic anchors in both contexts.

One outstanding mutation per client. Immediately show Checking timer… and freeze
the last confirmed time; disable mutations until a correlated reply/current read.
After **2,000 ms** without its answer issue timer_read, never resend the mutation.
A failed read, closed transport, failed authority or no successful sample for
**30,000 ms** shows Timer disconnected. Reconnecting…, frozen last confirmed
display and no title prefix. Recovery requires fresh admission/snapshot/sample;
discard pending mutation and do not replay. Before any confirmed snapshot show
--:-- / Connecting timer…. A stale confirmation closes to the current card when
timerId/version changes. Timer refusals do not discard queued document edits.

Schedule end and then end+2,500 with the existing earliest-deadline scheduler,
alongside history/presence/ticket/wait/copy deadlines. No per-second server wake;
a late load/read/command/wake computes elapsed time from persisted end.

## Approved interface values

All CSS px are border-box, system-ui/tabular digits. Timer occupies the optional
toolbar slot immediately before Share, after people/divider/save status. Idle
button 98×40, white, #79737f digits/icon, 8px icon gap; active button 62×40,
#f5f0ff fill, running/zero #7051cf digits, paused/uncertain #79737f. Border 1px
#e8e7ed, radius 8, padding 0, digits12px. Idle has timer icon plus own draft;
active has digits only. No continuous flash.

Panel: fixed, width 240, right12, top actual actions-bar bottom+12, max-width
viewport−24, max-height viewport−top−12, overflow:auto, z-index4. White/#29272e,
border 1px #e9e7ed/radius 12, padding 12, gap 8, shadow `0 2px 8px #29202e0a`.
Title Timer for every role, 13px/600/1.5; header height 40/gap 8. All margins0.
Minutes/Seconds labels12px/1.45/#79737f, label-to-field gap 4. Centered field grid
79/16/79 with 8px gaps; field boxes79×68, padding 0, border 1px #e9e7ed/radius 8,
white/#29272e, centered48px/1 tabular. Colon slot16×68, grey48px/1. Paused and
uncertain field digits #79737f. Active fields are read-only and skipped in Tab.

**The panel never contains a person's name/email, attribution line or reserved
attribution space, in any state or role.** Running time block sits directly above
the control row with gap 8; paused/zero/connection status is part of that block,
followed directly by gap 8 and controls. Status12px/1.45/#79737f, centered,
overflow-wrap:anywhere. With no running status line, remove its entire line box
and gap. Do not retain an empty element. No client surface or announcement names
a timer actor.

Control row centered/gap 8; + 1 min visual68×24 inside68×40 hit area, border 1px
#e8e7ed/radius 8, white/dark12px. Action circles33×33 in40×40 transparent hit areas,
neutral white/#29272e/border 1px #e8e7ed; primary #7051cf/#fff/border 0. Circle radius 50%,
hit radius 8/padding 0. Close24×24 SVG in40×40 transparent/border 0 hit area. Neutral
hover #f1eff5; primary hover #6142be/#fff. Disabled opacity .45. Focus-visible
outline 3px solid #7051cf, offset 3, on hit area, not only the smaller visual.
Confirmation buttons13px/1.5/padding 8px 12px/min-height 40/border 1px #e8e7ed/radius 8;
right-aligned gap 8, primary purple. Confirmation body13px/1.5, heading600.

Independently drawn icons: SVG viewBox 0 0 20 20, currentColor, stroke 1.75,
round caps/joins, ordinary size16×16. Timer circle(10,11,r6), path
`M8 2h4m-2 0v3m0 3v4l2 1`; play filled triangle `M7 4L15 10L7 16Z`;
pause `M7 4v12m6-12v12`; stop filled rect x5/y5/w10/h10/r1;
Close24×24 path `M5 5L15 15M15 5L5 15`. No external icon/font input.

## Words, input and focus

Visible title Timer; labels Minutes/Seconds; button text + 1 min. Icon accessible
names Start timer, Pause timer, Resume timer, End timer, Close timer. Confirmation
replaces card body: **Stop the timer?** / **This stops the timer for everyone, not
just you.** / **Cancel** / **Stop timer**. Exact status lines: Paused; Timer finished;
Connecting timer…; Timer disconnected. Reconnecting…; Checking timer….

Separate numeric text fields, zero-pad valid values on blur, minutes0–99/seconds0–59.
Empty/non-digit/out-of-range input disables Start without adding an error sentence;
00:00 also disables Start. Idle +1 adds60,000 locally, capped99:59, no wire command.
Each tab retains its own draft through Start/remote action/End/expiry/panel handoff;
full reload defaults03:00. Active +1 extends server remaining, not the saved draft.
Input ArrowUp/Down changes total ±1 minute, Shift ±5, clamped00:00–99:59; valid
field Enter starts. Preserve native selection; consume timer keys before canvas.

Trigger aria-haspopup=dialog/aria-expanded/aria-controls=w1-panel; labels exactly
Timer, idle, 03:00; Timer, running, 02:14; Timer, paused, 02:14; Timer, finished, 00:00;
Timer, Connecting timer; Timer, disconnected, 02:14; Timer, checking, 02:14, with
actual time substituted. Invalid uses Timer, idle, 00:00; cap uses Timer, running, 99:59.
Nonmodal role=dialog named Timer, id=w1-panel, no aria-modal or trap/positive tabindex.

| State | Opening focus | Forward panel traversal, then Share |
| --- | --- | --- |
| idle | Minutes | Minutes → Seconds → + 1 min → Start timer → Close timer |
| invalid 00:00 | Minutes | Minutes → Seconds → + 1 min → Close timer |
| running | Pause timer | + 1 min → End timer → Pause timer → Close timer |
| paused | Resume timer | + 1 min → End timer → Resume timer → Close timer |
| maximum | Pause timer | End timer → Pause timer → Close timer |
| zero | End timer | End timer → Close timer |
| connecting/disconnected/checking | Timer heading tabindex−1 | Close timer |
| confirmation | Cancel | Cancel → Stop timer → Close timer |

Closed right-bar traversal preserves every existing avatar/overflow/people-chevron
stop. With two people, editor desktop order is ben (you), can edit. Open people
menu (1), Follow ana, owner (2), People on this board: 2 (3), Timer's current
state/time label (4), Share (5). Narrow replaces the second avatar with
Show 1 more people at position2. From the chevron one Tab reaches Timer, two
reach Share. Save status/divider add no stop. Other presence counts retain their
existing stops with Timer immediately before Share.

Shift+Tab reverses enabled order. Escape in confirmation cancels to End without
sending; elsewhere Escape/Close closes panel, returns Timer focus, never ends.
Enter/Space opens trigger. Remote transitions preserve matching enabled focus or
fall back to Timer heading if focus was within panel; never steal canvas focus.
Opening Timer closes History/Comments; opening either or Share closes Timer.
Their controllers preserve drafts. Timer remains usable during history preview.

One timer role=status aria-live=polite aria-atomic=true region, separate from save
status, uses these exact announcement strings:

| Transition | Announcement |
| --- | --- |
| Start | Timer started |
| Pause | Timer paused |
| Resume | Timer resumed |
| Extend | Timer extended |
| End | Timer stopped |
| Expiry | Timer finished |
| Disconnect | Timer disconnected. Reconnecting… |
| Fresh recovery | Timer reconnected |

For live timer transitions, derive announcements only from cause on a committed
timer_state/timer_result: start/pause/resume/extend/end/expire map respectively
to the first six rows above. reset is silent. Announce at most once per
(board,restoreGeneration,version), including when the result and broadcast both
arrive; retain a bounded version high-water mark, not an accumulating event set.
Ignore lower-version/obsolete-session causes. An equal-version result/broadcast
pair must carry the same cause; conflicting cause is a protocol failure requiring
a fresh read, never a second announcement. A read/sample alone changes display,
not transition speech; a same-version live cause can announce only if not already
announced or suppressed by a fresh-join snapshot baseline.

Initial joined snapshots are silent. On reconnect, seed the suppression baseline
to the fresh snapshot's version and announce only Timer reconnected, once for
that successful recovery; never reconstruct start/stop/finish from it. Also
suppress causes at/below that baseline from delayed frames. Disconnect/reconnect
messages are once per connection-loss/recovery episode, independent of timer
versions. A pending readback/snapshot does not invent a transition cause.

The zero time/status and silent motion still begin at the authoritative deadline,
but never announce Timer finished solely from extrapolated time, a zero display
or reply time. Wait for cause expire at server expiry normalization (end+2,500);
its arrival may be later. A delayed remote cause end must announce Timer stopped
once even when it arrives after the previously known deadline/zero window; it
must never be misclassified as expiry. If a fresh reconnect snapshot supersedes
that event, only Timer reconnected is spoken. Do not replay the zero shake.

Coalesce rapid transitions to newest status, never announce per-second digits,
title ticks or a person's name. Keep digits outside live regions.

Zero displays00:00 for 2,500 ms from authoritative end; +1/Pause disabled, only End
mutates, Close enabled. One silent300ms horizontal ±2px shake, linear keyframes
0%/100%=0,25%=+2px,50%=−2px,75%=+2px, suppressed by prefers-reduced-motion:reduce.
No repeat/flash/sound/replay after late reconnect or background return. Title is
MM:SS – NextPhase Board while running/paused/zero; NextPhase Board at idle/initial
connect/disconnect/leave. Checking freezes the last confirmed prefixed title.
Replace one prefix; no extra caption is shipped.

## Derived geometry and fixture

At1280×800, actions y12/h48, panel x1028/y72/w240. At375×812 preserve the real
second toolbar row x12/y68/w351/h48 and avatar overflow; panel x123/y128/w240.
Share remains reachable and unchanged, desktop x1200.734/y16/w63.266/h40,
narrow x295.734/y72/w63.266/h40. These font-dependent positions are **derived**;
assert within 0.5 CSS px after applying the concrete styles. Desktop timer x1098.734
idle/x1134.734 active, narrow active x216.141; same tolerance. Desktop inner header
x1041/y85/w214/h40, fields x1053 and1164/y154.391/w79/h68. Running without a status
line has controls y230.391 and derived panel height 211.391. A single status line
has height 17.391 plus8px gap: controls y255.781/panel height 236.781. Narrow adds56px
to these y positions; running controls y286.391/height 211.391. Status-bearing
panels retain their line; do not subtract its height a second time. Wrap-dependent
status/confirmation heights are derived from specified text/width/font within 1px,
never a generic dialog-p rule overriding timer-specific typography.

Fixture: ana owner, ben editor/non-starter, mia viewer, lee granted editor/viewer
at example.com, Acme, Launch plan. Three Rose240×240 stickies at document
(−420,−200),(−80,−200),(−250,110), desktop origins(220,200),(560,200),(390,510),
zoom100%: Interview five customers; Pick the launch date; Draft the pricing page.
Selected first note remains(220,200,240,240), Medium, context(12,134,783.078,40),
corner hit areas(212,192,16,16),(452,192,16,16),(212,432,16,16),(452,432,16,16),
derived within 0.5px. Preserve all handles and file title; no sticky-name field is
added. Existing viewer View only notice stays. Narrow retains existing hidden
context bar and main min-height 900; no new narrow selection chrome. Use real
server clock/commands to produce03:00,00:00,02:14,99:59; no painted DOM fixture.
