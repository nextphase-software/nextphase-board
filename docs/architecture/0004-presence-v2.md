# 0004 — Presence contract

CONTRACT VERSION: 0004 presence v2 (2026-11-09)

Status: Draft for 0007-W2 v1. Replaces [presence v1](0004-presence-v1.md).
All stamped people, palette, per-connection lifetime,50-connection capacity,
10-message/1,000ms rate,12,288-byte frame,250-selection bound, heartbeat/expiry
and strict client key rules stay. [Voting v1](0007-workshop-voting-v1.md) adds
running-round privacy, on both runners and every reconstructed connection.

While voting runs, before joined.self/present and every present relay, cursor is
null, selection [], view {x:0,y:0,width:1,height:1}. Sanitize retained attachment
presence as well as outgoing messages. Keep person/label/role/colour/connection,
active and liveness; no vote/completion/participation field. Modified clients
sending real coordinates cannot relay them. Do not change presence refusals,
expiry or rates, or renew presence from voting reads/mutations.

On running transition clients immediately discard remote pointer/selection/view,
stop following and disable Follow. Suppress remote selections and followed
cursors too; hiding the cursor glyph alone is insufficient. Retain show-cursors
preference. On leaving running obtain fresh presence, never replay a retained
hidden coordinate. Keep avatars/people and normal heartbeats. Ordinary presence
outside running is unchanged; no extra server presence storage/roster API.
The full serialized socket attachment including both workshop budgets remains
≤16,384 bytes. Voting v1 and sync v11 govern current recipient admission.
