# 0005 — Comments contract

CONTRACT VERSION: 0005 comments v3 (2026-11-06)

Status: Draft for 0006-W3 v1. Replaces [comments v2](0005-comments-v2.md). Its ranges,
limits, authorship, ordering, rate checks and notification lifecycle continue. Current partners
are [access v7](0003-access-v7.md), [sync v8](0003-sync-v8.md),
[hosted persistence v7](0003-hosted-persistence-v7.md), [hosted storage v7](0003-hosted-storage-v7.md).

## Two distinct restore operations

| Operation | Current discussion and delivery |
| --- | --- |
| User document history restore | Keep today's threads/replies/text/ranges/resolved state/comment identifier history/counters; never revive deleted comments. Carry current occurrences, legitimate pending work and projected notices/read state into the higher generation, preserving the delivered cutoff and order. No duplicate/revived/dismissed/evicted notices. |
| Operator whole-room restore | Restore the backed-up discussion/ranges; suppress restored delivery work and clear projection behind the higher external fence, as v2 specifies. Historical ranges remain plain historical recipients without replay. |

On document restore, a pin attached to a matching restored object ID/generation follows its
restored box/relative point. If absent or mismatched, detach at its latest authoritative point
from before replacement. Already detached pins remain detached at that point even when their
object returns. Keep unchanged root/reply IDs, authors, edit times, mention ranges and resolved
state. Current comments are hidden while previewing history; list/preview/restore reads never
mark notices read. Normal explicit comment display after return uses existing marking rules.

Pause comment sends during restore; check current access/epoch and restore generation before
any comment receipt under v2's check order. Old unconfirmed messages cannot be replayed across
the new generation. Keep unposted reply/edit/new-comment text and ranges only in tab memory for
review, with no automatic send. Reconcile its target against today's discussion; a deleted target
stays deleted. Clear protected text on access loss/sign-out. Board Undo/Redo clearing affects no
saved discussion or notice read state.
