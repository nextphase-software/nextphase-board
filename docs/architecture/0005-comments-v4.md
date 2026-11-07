# 0005 — Comments contract

CONTRACT VERSION: 0005 comments v4 (2026-11-07)

Status: Draft for 0006-W4 v1. Replaces [comments v3](0005-comments-v3.md). Existing current
ranges, limits, IDs/authorship, pins, ordering, rates and active-board history restore continue.
Partners: [lifecycle v2](0006-board-lifecycle-v2.md), [access v8](0003-access-v8.md),
[sync v9](0003-sync-v9.md), [persistence v8](0003-hosted-persistence-v8.md).

| Operation | Discussion and delivery |
| --- | --- |
| Active-board user document restore | Keep current discussion, legitimate pending work and notices/read state; use existing carry checkpoint. |
| Operator whole-room restore of an active board | Restore saved discussion/ranges, suppress restored delivery, clear projection behind a higher fence. |
| Move to Trash | Keep current discussion/ranges/counters/identifier history; remove mention targets/pending creations, projected notices, leases and delivery work behind a higher fence. No discussion access in Trash. |
| Restore from Trash | Keep current discussion/ranges and current rights, no content replacement; do not revive removed delivery/notices or old client retries. Later explicit new mention occurrences can notify once. |
| Permanent deletion / expiry | Remove discussion, identifiers, mention source/pending work, notices, leases/checkpoints and every board-specific delivery/access row; only the content-free deleted register remains. |

Check current lifecycle before comment/mention receipts, waiting application, participant search,
notice projection/display and held batches. Higher generation/cutoff/fresh leases reject old
creation replay, including read/dismissed/evicted references. A service failure cannot fabricate
an empty inbox or restore access. W3 carry is not a Trash restoration mechanism. Keep unaffected
boards' notices/read state and workspace-wide access records.

A 4403 role/epoch change is nonterminal until fresh authorization proves otherwise: pause
sends, retain tab-memory unposted text/ranges, reconnect with current rights and keep drafts for
explicit review, with no automatic comment resend. Preserve existing role-change reconnect/draft
assertions. Only confirmed whole-board unavailability after 4403 clears unposted reply/edit/new-comment text, structured ranges, pending sends,
comment targets and inbox previews, including an open history preview/dialog. Ignore late
responses; never resend after Home navigation or reopening the same board. 4423 document restore
continues to keep tab drafts for explicit review under the prior contract. Trash creates no
comment rollback and no historical recipients are replayed. Current comments after restoration
show saved threads, not the cleared protected draft.
