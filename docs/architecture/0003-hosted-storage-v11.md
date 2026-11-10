# 0003 — Hosted boards in the web app

CONTRACT VERSION: 0003 hosted storage v11 (2026-11-10)

Status: Draft for 0007-W3 v1. Replaces [hosted storage v10](0003-hosted-storage-v10.md).
Document recovery, Home/Trash/history/Comments, timer/voting controllers and
their storage/rights remain. [Presence v3](0004-presence-v3.md) owns spotlight
protocol/lifetime; [interaction v37](0001-interaction-v37.md) owns exact
words/look/offer/focus/speech rules. No local/off controller, DOM or request.

Own spotlight state in a dedicated tab-memory controller and pure rules, with
one presentation module; no state machine in App.tsx/document-edit hooks.
Keep session/own versions, offer/decline/leave/dismiss, pending/read health and
speech identities separate from ordinary manual Follow and pending edits.
Reuse presence.ts chooseFollow/fitFollow, hosted-board.ts follow/reset seams,
use-presence.ts remote fitting and use-viewport.ts ownViewChange/setFollowView
separation. Delegate local leave before content/selection/tool actions; do not
move session ownership into those hooks. Preserve normal follow reset on
clearPresence/beginAttempt/finish/every joined. Session membership acknowledgement
is never inferred from a merely selected followed-person flag.

One pending spotlight mutation; Checking spotlight… until confirmed. At 2,000 ms
without answer read once, never resend. One outstanding read, on fresh join/
reconnect/foreground and every15,000 ms connected;30,000 ms without admitted
read or failed transport/authority marks uncertainty. Freeze motion, cancel
auto-join and suspend frame; last view stays. Leave/dismiss remain local even
without a socket; no lost leave is queued against a replacement session.
Hosted offline/finish retry cleanup and the WebSocket Transport adapter preserve
wire4410/retry_recovery from sync v12; never replace it with an unconditional
clean1000. Explicit board navigation/sign-out/terminal discard/close stay clean,
with access/expiry/generation/conflict terminal overrides winning over retry.
Before a first snapshot use Connecting spotlight…, never false idle; an active
controller need not exist before joined. Ignore stale identities/replies and
seed speech suppression from initial/late snapshots.

Private resume key is page memory only, never sessionStorage/localStorage/
IndexedDB/URL/Auth storage. Only same-page recoverable presenter interruption
may use it in the bounded fresh-admission handshake. Full reload cannot reclaim
it. Follower reconnect/reload clears old follow/offer/decline/dismiss intent and,
after fresh admission, gets a fresh full offer even for the same live session.
An offline leave/dismiss suppresses only stale old-connection replies; it never
suppresses the offer from fresh admission. During presenter grace wait for active
fresh presence before offering. Still-connected followers of a successfully
rebound presenter may resume unless they left. Presenter Stop/takeover/vote/access/epoch/generation/lifecycle loss
invalidates it. Terminal loss/sign-out/account/board change clears protected
session, key, offers/countdown, pending work, banners/frame and speech before
late replies.4403/4409 fresh admission can offer a live different presenter's
session;4423 never restores the ended spotlight. No command replay.

Panel handoff closes other transient right surfaces without ending spotlight;
timer/voting retain their controller/drafts/focus. Native editors keep focus and
drafts on offers. Preview leaves/stops and disables participation. Voting start
ends spotlight, discards spatial state and blocks new joins; reveal never resumes
it. No saved camera, board bytes/revision/edited-at, selection copying, Undo/Redo,
history/file/export or backup change from spotlight-only activity.
