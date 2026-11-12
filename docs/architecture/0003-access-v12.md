# 0003 — Access contract

CONTRACT VERSION: 0003 access v12 (2026-11-11)

Status: Draft for 0007-W4 v1. Replaces [access v11](0003-access-v11.md), whose
directory, grants, epochs, removal, lifecycle, timer, voting and spotlight rights
remain in force word for word. [Presence v4](0004-presence-v4.md) adds:

| Effective current admission | Send reactions | Receive reactions |
| --- | --- | --- |
| owner/editor/viewer, including board-granted editor/viewer guests | Yes, except while a voting round runs | Yes, except while a voting round runs |
| ungranted guest/removed/disabled/outsider | No | No |

Use the effective board role, never a workspace guest label or canEdit. Viewers
may react; reacting gives no content-editing right. The sender's admission is
checked before relay and each recipient's admission at its send, with the same
current-access check the spotlight relay uses. A removed, expired, disabled or
role-changed person whose change the room has processed neither sends nor
receives a reaction; no reaction is held back and delivered later. A
required-source outage on the sender's check relays nothing; on a recipient's
check it skips that recipient; there is no cached success. No service table,
permission or row is added; the service-table count remains 16.
