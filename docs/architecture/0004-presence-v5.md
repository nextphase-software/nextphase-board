# 0004 — Presence, spotlight and reactions contract

CONTRACT VERSION: 0004 presence v5 (2026-11-16)

Status: Draft for 0010-W3 v1. Replaces [presence v4](0004-presence-v4.md), whose ordinary presence,
spotlight, voting redaction, reaction, bounds and lifetime rules remain word for word except as below.
[Interaction v44](0001-interaction-v44.md) owns every look and word. A hosted board may now hold several
pages ([document v19](0001-document-v19.md)), so presence says which page each connection has open.

## The `page` key

The client presence frame gains a sixth key, **`page`**: the id of the page the sender has open, a
lowercase UUID. The wire frame is exactly `{kind, cursor, selection, view, active, page}`. The local form
without `kind` has the other five. The cursor, selection and view are on that page. The existing checks
refuse it with their existing reasons: an unknown or extra key gives `presence_fields` on the wire; a
missing key, or a `page` that is not a lowercase UUID, gives `bad_presence`.

**The room's page check.** After those checks, the room accepts the frame only when `page` is one of its
board's current pages. Otherwise it drops the frame: nothing is relayed, the attachment keeps the previous
presence, and no refusal is sent. Such a frame is a stale one from a client that has not yet received a
page deletion; its next frame after that update is accepted. The frame still counts against the 10-per-
second budget.

The relayed `present` frame carries `page` with the other stamped fields. Its byte bound (12,288) is
unchanged; `page` adds at most 44 bytes. A reconstructed attachment without `page` is treated as having
no presence (it is not relayed) until the connection's next frame.

**When the page is sent.** When the open page changes, the client's next presence frame carries the new
page and skips the 100 ms throttle once:
- it is sent at once if this connection has sent fewer than 10 presence frames in the last 1,000 ms;
- otherwise it is sent as soon as that count drops below 10, and any presence change before then is
  merged into it (the latest values win; the page is never dropped).

The client keeps the times of its last 10 sends for this. The frame's cursor is `null` and its selection
empty, unless the pointer is over the canvas.

**Voting redaction is unchanged.** While a round runs, spatial presence (cursor, selection, view) is
cleared on relay and in attachments as today. `page` is **not** spatial: it is kept and relayed, so the
Pages list and people menu still show who is on which page during a vote.

## What a receiver draws

A receiver draws another connection's cursor, selection outline and reaction bursts **only when that
connection's `page` equals the receiver's open page**. A connection with no known page draws nothing.
This applies to every person, including the same person's other tabs. Avatars in the file bar and the
people menu list everyone, as today, with their page ([interaction v44](0001-interaction-v44.md)).

## Follow and spotlight

Following a person (manual Follow) or a spotlight's presenter (presence v3) now includes their page.
Whenever the followed connection's relayed `page` differs from the follower's open page, the follower
opens that page (interaction v44's opening rule) before applying the followed view. Starting a vote
still ends a spotlight and manual Follow, and Follow stays disabled while it runs (voting v2); `page` is
kept during the vote only so that the pages list and people menu can show who is where. No spotlight state, frame, version or capability changes: the page travels only in
ordinary presence. Stopping following leaves the follower on the page they are on.

## Reactions

The `react` and `reacted` frames are unchanged: no page key. A receiver draws a burst only when the
sender's connection is known from presence and is on the receiver's open page. Otherwise it drops the
frame, as it drops one from an unknown connection today. The room relays as today.
