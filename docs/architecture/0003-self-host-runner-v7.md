# 0003 — Self-host runner contract

CONTRACT VERSION: 0003 self-host runner v7 (2026-11-10)

Status: Draft for 0007-W3 v1. Replaces [runner v6](0003-self-host-runner-v6.md).
Process/key/volume ownership, independent fences, deadlines, denial and disposal
remain. [Persistence v10](0003-hosted-persistence-v10.md) stays: layout7, no new
stored value. [Presence v3](0004-presence-v3.md) defines bounded connection-owned
spotlight and original-close policy on both adapters. Timer/voting persist as
before; spotlight does not persist in SQLite, Supabase, backups or browser disk.

Write spotlight descriptor/capability only into the live presenter's server-owned
attachment; follower attachment contains current membership only. DO hibernation
rebuild revalidates still-live presenter and follower sockets against current
access/generation/voting before reconstruction/send. No absent-presenter grace
restoration or follower-based election. Rebuild without presenter reads idle.
Original surviving Node Room/connections retain state, while actual process
restart loses sockets/spotlight. Node's in-memory Map is no durable session store.

Forward original code/reason/error before normalization from worker.ts through
worker-room.ts and from start-node.ts's websocket close/error callbacks into
Room.closed. worker.ts delegates websocket close/error at the public entry;
worker-room.ts currently maps1006 to1001 for socket.close. That normalized code
must never authorize clean-departure policy. Node currently drops the code and
Room.closed takes only connection; change it to closed(connection: Connection,
code: number = 1006, reason: string = ""). Worker webSocketClose(socket,code,reason)
passes original code/reason before separate1006→1001 socket-close normalization;
Node's close callback takes(code,reason), forwarding code ?? 1006 and UTF-8 reason.
Code4410/retry_recovery from retrying clients and no-frame1006/missing code get
grace; clean1000/1001 and terminal4401/4403/4409/4423 bypass it as presence v3
specifies. Handle error+close once without masking a later terminal cause.
Integrate grace with existing earliest-deadline scheduling, clear it on terminal
override/discard/all-leave, never reset/extend grace through repeated callbacks.

Complete recovery/close inventory (all named in the brief allowlist):
packages/board-room/src room.ts, interfaces.ts, protocol.ts, access.ts,
presence.ts, lifecycle.ts, history.ts, storage.ts, backups.ts, timer.ts,
voting.ts and new spotlight.ts; Workers apps/server/src worker.ts
(BoardRoom.getRoom/reserveTimeRecovery/independent RestoreFence and socket
delegation), worker-room.ts (getWebSockets/serializeAttachment/deserializeAttachment,
restore-to-time/discard/close/error), worker-runtime.ts; Node apps/server/src
start-node.ts (start/roomEntry/recoveryGeneration/removeRoom/websocket callbacks),
node-storage.ts and apps/server/scripts/mark-restored-volume.mjs; shared
apps/server/src runtime.ts, app.ts, lifecycle.ts, delivery.ts and routes/operator.ts,
access.ts, boards.ts, history.ts, lifecycle.ts. Inspect every seam before omitting
an edit; do not rely solely on room-local reset or the timer's recovery method.

End spotlight before actual history replacement/4423, Trash, discard/purge,
logical/marked-volume/supported Workers time recovery or pre-load shortcut.
Preserve accepted document-history intent/chunks, denial/reservation and timer/
voting recovery rules; spotlight adds no recovery marker/schema. No historical
spotlight restoration. Measure presence v3's metadata/messages/full-attachment
bounds on each runner without enlarging landed limits. Reapply process-local
test controls after Node restart; accurately distinguish real DO reconstruction,
Node process restart and browser reload proof. Real stopped-volume physical
checks remain Node-only; common terminal-generation checks execute on both.
