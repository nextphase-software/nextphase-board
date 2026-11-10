# 0003 — Access contract

CONTRACT VERSION: 0003 access v11 (2026-11-10)

Status: Draft for 0007-W3 v1. Replaces [access v10](0003-access-v10.md).
Directory/grants/epochs/removal, lifecycle owner-only rights, timer and voting
rights remain. [Presence v3](0004-presence-v3.md) adds these distinct rights:

| Effective current admission | Read/start/take_over/follow/leave | Stop/Cancel | Resume |
| --- | --- | --- | --- |
| owner/editor/viewer, including board-granted editor/viewer guests | Yes, subject to session/voting state | Only current presenter connection | Same verified account/epoch/generation, private key and live grace only |
| ungranted guest/removed/disabled/outsider | No protected state or operation | No | No |

Use effective board role, never workspace guest label or canEdit as a presentation
gate. No facilitator/starter privilege, public follower roster, service permission
or service table is added; service-table count remains16. Manual content editing
rights do not change when presenting/following. Viewers still cannot edit content.

Every spotlight command/read/join/recipient publication, reconstructed session
and presenter's spatial relay requires active lifecycle/no deleted marker,
current token, strict replay, effective role, epoch and restoreGeneration.
Required-source outage withholds protected state and motion, no cached success.
Socket replay outage retains503 service_unavailable; ordinary HTTP cached policy
stays. Loss, expiry, role/epoch change and generation/lifecycle closures remove
old membership/key before late work. Presenter loss ends immediately with no
grace; follower loss removes only that membership. Even role changes that still
permit presenting require fresh admission/new Start, not old-key continuity.
Restore access never automatically restores following or presentation.
