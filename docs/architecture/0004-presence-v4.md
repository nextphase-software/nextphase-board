# 0004 — Presence, spotlight and reactions contract

CONTRACT VERSION: 0004 presence v4 (2026-11-11)

Status: Draft for 0007-W4 v1. Replaces [presence v3](0004-presence-v3.md), whose
ordinary presence, spotlight, bounds, voting redaction and lifetime event table
remain in force word for word. This version adds ephemeral **reactions** only.
[Interaction v38](0001-interaction-v38.md) owns every concrete reaction look,
word, key and motion value. Use the
[brief's version set](../briefs/0007-W4-send-ephemeral-workshop-reactions.md)
for inherited references. No stored format changes.

## Reaction set

A reaction is one id from this fixed, ordered list. The order is the wheel's
clockwise order from the top and the digit key 1–8 that picks it.

| # | Id | Name |
| --- | --- | --- |
| 1 | `thumbs-up` | Thumbs up |
| 2 | `plus-one` | Plus one |
| 3 | `star` | Star |
| 4 | `question` | Question |
| 5 | `thumbs-down` | Thumbs down |
| 6 | `dot` | Dot |
| 7 | `me` | Me |
| 8 | `heart` | Heart |

The wire carries the id, never artwork or text. `me` is drawn by each receiver
from the sender's stamped presence `label` (first character, upper case) and
`colour`; it adds no wire field.

## Authority

Every currently admitted effective owner, editor or viewer of an active hosted
team board, including a guest admitted by an editor or viewer board grant, may
send and receive reactions ([access v12](0003-access-v12.md)). Local boards and
the team-features-off build have no reaction transport.

## Wire

Client to room, on the existing authenticated room socket:

```json
{ "kind": "react", "reaction": "<id>", "x": <number>, "y": <number> }
```

Exactly these four keys. `reaction` is an id from the list; `x` and `y` are
finite numbers in board coordinates, each within ±1,000,000 (the presence
coordinate clamp). The whole frame, including whitespace, is at most
**256 UTF-8 bytes**.

Room to every other eligible connection:

```json
{ "kind": "reacted", "connection": "<sender connection id>", "reaction": "<id>", "x": <number>, "y": <number> }
```

Exactly these five keys, at most **512 UTF-8 bytes**. `connection` is the
sender's stamped presence connection id; the room never echoes a reaction to the
sending connection. The sender's other tabs are other connections and receive it.

Refusals go to the sender only, as the existing `{ "kind": "refused", "reason" }`
frame without `requestId`:

| Reason | When |
| --- | --- |
| `reaction_too_large` | Frame over 256 bytes |
| `bad_reaction` | Not exactly the four keys, unknown id, non-finite or out-of-range coordinate |
| `reactions_voting` | A voting round is running |

A refusal is never a document refusal and never changes save, recovery or
presence state. The over-budget case sends **no** refusal (below).

## Rate budget

Each connection has its own reaction budget: at most **5** `react` frames in the
rolling window (t − 1,000 ms, t], counted on arrival in room order. Every frame
whose `kind` is `react` counts, invalid ones included. The sixth and later frames
in a window are dropped silently: no relay, no refusal, no counter growth beyond
the five stored timestamps. The budget is a separate array `reactionTimes` of at
most five safe non-negative integers in the connection attachment, beside and
independent of `presenceTimes` (10 per 1,000 ms), so reactions never consume the
cursor budget and cursors never consume the reaction budget. The full serialized
attachment stays within presence v3's 16,384 bytes; `reactionTimes` adds at most
the bytes of five timestamps. Reconstruction may keep or drop `reactionTimes`;
it never relays an old reaction.

## Relay

The room handles `react` inside its ordered queue, after the existing load,
expiry, lock (4423) and outer-frame checks, before the edit-only fallback:

1. Count the frame against the sender's budget; drop silently if over.
2. Validate size and shape; refuse as above.
3. If a voting round is running (the same predicate that redacts spatial
   presence), refuse `reactions_voting` and relay nothing.
4. Confirm the sender's current effective admission with the same current-access
   check the spotlight relay applies to a recipient. On failure relay nothing;
   the existing access paths close or deny that connection.
5. Send `reacted` to every other open connection that has a presence attachment,
   checking each recipient's current admission with the same check immediately
   before its send. Recipients are checked independently: a failed check or a
   required-source outage for one recipient skips that recipient only, and
   deliveries already made stand. Nothing is retried or queued for anyone.

Nothing about a reaction is stored: no reaction-derived SQLite table, row, meta
key or journal entry, no Supabase row,
no backup field, no browser disk value, no joined or snapshot field, no document
or history change. The access check's own existing bookkeeping (for example
replay watermarks) is unchanged in kind and is not reaction data. A reconnecting, reloading or late-joining connection receives
only reactions sent after its admission. Offline or uncertain clients neither
queue nor replay reactions.

## Client rules

The client sends a reaction only while joined on a hosted team board, not during
a running vote, history preview or lock, and at most **4** sends in its own
rolling (t − 1,000 ms, t] window; a fifth attempt in the window is ignored with
no local burst. A sent reaction draws the sender's own burst at once; it is not
redrawn on any reply. On `reacted`, the client draws the burst only if it knows
the sender's connection from presence and no voting round is running; otherwise
it drops the frame. All live bursts are removed when the hosted board session
ends, the board closes, access is lost or a voting round starts.
