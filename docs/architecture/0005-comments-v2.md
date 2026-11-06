# 0005 — Comments contract

CONTRACT VERSION: 0005 comments v2 (2026-11-05)

Status: Draft for 0005-W2 v1. Replaces [comments v1](0005-comments-v1.md).
V1's threads, authorship, text normalization, anchors, ordering, colours and limits apply,
except for the changes here. [Access v6](0003-access-v6.md), [identity v4](0003-identity-v4.md),
[sync v7](0003-sync-v7.md), [hosted persistence v6](0003-hosted-persistence-v6.md),
[hosted storage v6](0003-hosted-storage-v6.md) and [interaction v32](0001-interaction-v32.md)
apply in place of their earlier versions. Comments remain outside the board document,
its revision, edited time, Undo, JSON export, Board file and browser-local board records.

## Mention ranges

A comment's plain `text` gains `mentions`, an array of exactly these range keys:

```json
{"start":2,"end":6,"person":"0123456789abcdef0123456789abcdef","label":"ben"}
```

In `😀 @ben`, that range covers `@ben`. Offsets count normalized Unicode code points,
start inclusive and end exclusive. Ranges are sorted by start, nonoverlapping, in bounds,
and spell exactly `@` plus their `label`. `person` is 32 lowercase hexadecimal characters;
`label` is nonempty, well formed and at most 256 UTF-8 bytes (identity v4).
At most **20 ranges per comment**, including repeated recipients and self-mentions.
An omitted operation array means `[]`; `null`, extra range keys, wrong offsets/types,
overlap or spelling give `bad_mentions`. More than 20 gives `mention_limit`.
Every current comment record sent by the room includes the array, empty when there are none.
Plain or pasted `@text` has no range and never notifies.

For a newly introduced person/label pair the room resolves the board person key through
**the caller's current permitted roster**, verifies the chosen label and stamps its registered
label. It refuses a label mismatch rather than rewriting text and shifting offsets.
A retained person/label pair may move within edited text or change occurrence count without
being a new recipient. Retained ranges remain historical after access loss; they stay blue,
grant nothing and recreate no notification. Removing all ranges for a recipient and adding
one in a later saved edit is a new occurrence requiring current visibility.

The existing limits still apply: 4,000 normalized code points per comment, 2,000 current
comments per board, 4,194,304 UTF-8 bytes of plain comment text in total, 100 new comments
per person/board/UTC hour, 600 other actions per person/board/UTC hour, and 10 saved actions
per connection/1,000 ms. Metadata does not consume the plain-text byte count.

## Notification lifecycle

A saved comment creates one occurrence per distinct permitted recipient other than its author.
It may notify someone whose board is closed. Account identity is resolved server-side only.

| Event | Result |
| --- | --- |
| Repeated ranges for one recipient; self-mention | One occurrence; no self-notification |
| Edit retaining a recipient | Same occurrence ID, original creation time and read state; current preview on read; no repeat alert |
| Edit adding a recipient | Fresh occurrence, initially unread |
| Remove every range for a recipient | Remove its target, pending creation and retained inbox reference |
| Remove then add in a later saved action | New occurrence if currently visible; initially unread |
| Delete a reply | Remove all its targets, pending creations and read/unread notices |
| Delete the first comment or thread | Same cleanup for every comment in the thread |
| Resolve/reopen | Keep notices and read state; no new notice |
| Delete anchored object; board Undo | Keep occurrences and read state; use the thread's authoritative detached point |
| Dismiss | Delete only the caller's inbox reference; keep discussion and current source occurrence |
| Evict the oldest beyond 50/account | Permanently remove that reference; no backfill |
| Lose one role with another effective role remaining | Keep lease and notices |
| Lose final role or disable recipient | Remove lease/inbox references; prune source targets and pending work on access replay; regrant cannot revive them |
| Author loses access | Keep saved discussion and permitted recipients' notices; author cannot edit/delete without access |
| Restore room | Restore historical ranges, clear projection and source delivery work behind a new fence; no replay |

The source, pending work and receipt commit with the comment in one room transaction.
Supabase projection is retryable, with no cross-database atomicity claim. A delivery failure
leaves a saved comment saved and its work pending. Durable state and no-resurrection rules are
in hosted persistence v6; the pending creation cap is **1,000 pairs per board**, plus one
independent cleanup marker. At cap, refuse an action adding pairs with `mention_pending_limit`;
plain actions and cleanup that add no pairs remain possible.

## Checking an action

Replace v1's check order with the following; stop at the first refusal. A refused action stores
no comment, sequence, counter or receipt. Independent access cleanup may still proceed.

1. Envelope and operation shape, normalized text's character validity and IDs as v1:
   `bad_message`. Range content is checked at step 7. The current envelope's
   `restoreGeneration` is an integer (sync v7).
2. Effective access and current epoch: `no_access`, then `epoch_changed`.
3. Restore generation: `restore_changed` if different from the room's live generation.
4. Receipt: same request/digest answers from it; otherwise `request_id_reused`.
5. Text `empty_text`, then `too_long`; existence and identifier reuse in v1's original order.
6. Authorship: `not_author` under v1's rules.
7. Ranges: `mention_limit`, `bad_mentions`, newly introduced recipient/label unavailable or
   invisible `mention_unavailable`, then `mention_pending_limit`.
8. Anchor: `bad_anchor`, then `anchor_deleted`, as v1.
9. Board comment/text limits `comment_limit`, then existing saved-action `rate_limited`.

Only then save the action, receipt, changed rows, sequence, counters, targets and pending work
transactionally and broadcast as sync v7 says. No notification is reported delivered before
projection confirms it.

## Backup capacity

The aggregate serialized budget is the **entire UTF-8 JSON backup envelope**, including all
metadata, at most **16,777,216 bytes**. There is no additional metadata admission limit on a
comment save. A legal board can exceed that backup budget and gets 413 `backup_too_large`.
This is an explicit refusal boundary, not a guarantee that every legal board fits.
2,000 comments with 20 maximal 256-byte labels each would need 10,318,000 text bytes and is
not legal under 4 MiB. Capacity checks must combine legal text and ranges (hosted persistence v6).
Existing lifetime receipts and document history also consume backup space.

## Outside this version

Email, push, external messages, invitations, groups, text-object mentions, subscriptions,
notifications for ordinary unmentioned replies, rich text, local comments, file/export comments,
notification preferences, unlimited history and automatic offline replay.
