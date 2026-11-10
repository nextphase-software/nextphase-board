# 0006 — Board lifecycle contract

CONTRACT VERSION: 0006 board lifecycle v5 (2026-11-10)

Status: Draft for 0007-W3 v1. Replaces [lifecycle v4](0006-board-lifecycle-v4.md).
All owner-only transitions,30-day retention, denial/fences/permanent register,
journals and timer/voting recovery remain. [Presence v3](0004-presence-v3.md)
adds ephemeral spotlight termination, not stored workshop content.

End spotlight and invalidate descriptor/key/offers/memberships/deadline before
Trash fencing/peer closure, discard/purge, actual document-history replacement/
4423, logical/marked-volume/Workers time recovery and protected pre-load paths.
Access/expiry/role/generation/lifecycle closures bypass abnormal-loss grace.
Serialize with room commands/current admission; held tasks cannot revive it or
send protected projections after denial. Dispose grace callbacks before disposal
confirmation, preserving other boards. Existing pending recovery/denial retry
semantics and accepted document-history chunks/intent remain intact.

Local history preview leaves following or stops presentation and disables new
participation. History restore never copies a historical spotlight; Trash restore,
import and recovered storage start without one. Live timer/voting follow their
own distinct policies, including persistence on ordinary restart. Spotlight-only
work changes no document/selection/Undo/Redo/revision/edited-at/history count,
age/fingerprint, file/export or logical backup. No new storage table/meta/journal.
