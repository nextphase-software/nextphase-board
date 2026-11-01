# 0004 — Presence contract

CONTRACT VERSION: 0004 presence v1 (2026-10-31)

Status: Draft for 0004-W1 v1. New. It defines presence on a hosted board: who else has the board
open, where their pointer is, what they have selected and what part of the board they are
looking at. Presence travels on the room connection ([sync contract](0003-sync-v3.md)); the
label it shows comes from the person's verified token ([identity contract](0003-identity-v3.md));
who sees it is in the [access contract](0003-access-v4.md). This version defines the messages,
the rules and the bounds; no screen draws them yet.

## One presence per connection

Every open room connection has one presence, viewers included. Two tabs of one person are two
connections, each with its own presence, colour and cursor; they share a person key (below), so a
screen can show the person once.

A presence is never stored with the board: not in the document, its saved edits, snapshots,
receipts, waiting edits, backups or Supabase. It never changes the board's `revision`, never
produces `received`, `saved` or `update`, and never changes what the board's lists show. The room
keeps it with the connection only (on Cloudflare, in the WebSocket's serialized attachment; on
the Node server, in the connection's memory), so it survives the room being evicted from memory
while the connection stays open.

## What the room stamps

| Field | Value |
| --- | --- |
| `connection` | The connection's ID, a lower-case UUID the room gives at join |
| `person` | The person key: the first 32 characters of the lower-case hexadecimal SHA-256 of the UTF-8 text `presence:<board ID>:<person ID>` (both lower-case UUIDs). The same person on the same board always has the same key; it differs from board to board and is not the account ID |
| `label` | The label captured when the connection's join ticket was issued (identity contract, "Labels"). Renewal never changes it |
| `role` | The role the connection joined under: `owner`, `editor` or `viewer` |
| `colour` | One of eight colours (below) |

A client never chooses any of these; a presence message that names one is refused (see
"Refusals").

## What the client sends

```json
{ "kind": "presence", "cursor": { "x": 0, "y": 0 }, "selection": ["<object ID>"],
  "view": { "x": 0, "y": 0, "width": 1, "height": 1 }, "active": true }
```

| Field | Rule |
| --- | --- |
| `cursor` | `null` (no pointer over the board) or an object with exactly `x` and `y`, numbers in board units |
| `selection` | An array of at most 250 object IDs, each a lower-case UUID; repeats are removed, keeping the first of each in its place. An ID need not name an object that exists |
| `view` | An object with exactly `x`, `y`, `width` and `height` in board units: the board rectangle the client shows; `width` and `height` are greater than 0 |
| `active` | `true` or `false`: whether the client is being used (the screen decides what that means) |

Every number is finite and between −1,000,000 and 1,000,000 inclusive. The message has exactly
these five keys. Each message replaces the connection's whole presence; nothing is merged with
the previous one.

## Joining

When a connection joins, the room gives it a placeholder presence: `cursor` `null`, `selection`
empty, `view` `{ "x": 0, "y": 0, "width": 1, "height": 1 }`, `active` `false`, with its stamped
fields. The `joined` message carries `self` (this connection's stamped presence) and `present`
(the presence of every other connection whose presence is visible, in no particular order); the
room sends `present` with the new connection's placeholder to every other connection.

## What the room relays

When a presence message is accepted, the room sends every other connection of the board
`{ "kind": "present", "connection", "person", "label", "role", "colour", "cursor", "selection",
"view", "active" }`, with the selection after repeats are removed. The sender gets no reply.

`{ "kind": "left", "connection" }` tells the others that a connection's presence has ended. The
room sends it once per ending, before the connection is closed when the room closes it:

- the connection closes, or its transport reports an error;
- the room closes it with 4401, 4403, 4409 or 4423 ([sync contract](0003-sync-v3.md), "Close
  codes"). When a restore closes every connection, the room sends every `left` to every
  connection before it closes any;
- its presence expires (below).

## Expiry

A presence expires 30,000 milliseconds after the connection's last accepted presence message (or
its join, before the first). Nothing else renews it: not an edit, a renewal, a dropped or refused
presence message. When it expires the room sends `left` and stops listing it; the connection
stays open, keeps its role and may still edit, and its next accepted presence message makes it
visible again (a `present` to the others).

The room checks expiry with the same scheduled wake-up it uses for its other deadlines (on
Cloudflare, the Durable Object's alarm), never with a timer that would keep it from hibernating.
Expiry is therefore checked when that wake-up runs: at or after the deadline, never before.

A client that wants to stay visible sends its presence at least every 15 seconds, even when
nothing changed (the shared client does: [sync contract](0003-sync-v3.md), "The shared client").

## Bounds

| Bound | Value | When it is passed |
| --- | --- | --- |
| Messages | 10 presence messages per connection in any 1,000 milliseconds | The 11th and later in that window are dropped without a reply. Every presence message that reaches this rule counts, including one a later rule refuses. The count survives the room being evicted from memory |
| Size | 12,288 bytes: the whole message as received, in UTF-8, white space included | Refused with `presence_too_large` |
| Selection | 250 IDs, counted before repeats are removed | Refused with `presence_selection_limit` |
| Connections | 50 per board, counting every open connection (with or without visible presence) and every join between its ticket check and its WebSocket upgrade | The 51st join is refused over HTTP with 429 `room_full` ([API contract](0003-api-v4.md)) |

A join that passed its checks holds its place for at most 5 seconds while its WebSocket upgrade
completes. When the 5 seconds pass first, the hold ends and the place is free. If that
connection opens later, it takes a place again only if the board's other open connections and
unexpired holds together number fewer than 50; otherwise the room closes it at once with 1013
(try again later), sending it nothing, and it never counts as present.

## Refusals

A presence message is checked in this order; the first rule it breaks decides the answer, which
is `{ "kind": "refused", "reason": "<reason>" }` with no `requestId`. The connection stays open,
nothing is relayed, and the connection's presence is unchanged.

1. Over 1 MiB: `message_too_large` (sync contract, "Size").
2. Over the message bound: dropped, no reply.
3. Over 12,288 bytes: `presence_too_large`.
4. Any key other than the five above (for example `person`, `label`, `role`, `colour`,
   `connection` or `update`): `presence_fields`.
5. More than 250 entries in `selection`: `presence_selection_limit`.
6. Any other break of "What the client sends" (a wrong type, a number out of range, a `view`
   whose `width` or `height` is not greater than 0, an ID that is not a lower-case UUID):
   `bad_presence`.

## Colours

The room gives each connection a colour at join and keeps it for the life of the connection.
The eight colours, in order:

| Ordinal mod 8 | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Colour | `#2563eb` | `#dc2626` | `#16a34a` | `#9333ea` | `#ea580c` | `#0891b2` | `#db2777` | `#4f46e5` |

A joining connection's ordinal is one more than the largest ordinal among the board's open
connections and held joins, or 0 when there are none; its colour is the colour of that ordinal
modulo 8, so the ninth connection shares the first colour. The ordinal is kept with the
connection, so the room waking from hibernation never changes a colour.

## Not in this version

Drawing presence on screen, following another person's view, spotlight, cursor chat, reactions,
idle or away states beyond `active`, a typing caret, and audio.

## Public references

Retrieved 2026-10-31: [Cloudflare Durable Objects WebSockets](https://developers.cloudflare.com/durable-objects/best-practices/websockets/)
(hibernation, `serializeAttachment` keeping up to 16,384 bytes per WebSocket across hibernation,
and the advice to batch high-rate messages every 50 to 100 ms),
[Cloudflare Durable Object lifecycle](https://developers.cloudflare.com/durable-objects/concepts/durable-object-lifecycle/)
(timers keep an object from hibernating; alarms wake it),
[Cloudflare Durable Objects pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/)
(incoming WebSocket messages billed at 20 to 1) and
[y-protocols 1.0.7 awareness](https://raw.githubusercontent.com/yjs/y-protocols/v1.0.7/awareness.js)
(a 30-second timeout for remote states, renewed every 15 seconds).
