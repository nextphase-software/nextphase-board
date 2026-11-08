# 0003 — Access contract

CONTRACT VERSION: 0003 access v9 (2026-11-08)

Status: Draft for 0007-W1 v1. Replaces [access v8](0003-access-v8.md).
All directory, lifecycle owner-only rights, grants, epochs and removal policies
continue. [Workshop timer v1](0007-workshop-timer-v1.md) adds a distinct room right:

| Effective current role | Timer read/start/pause/resume/extend/End | Document editing |
| --- | --- | --- |
| owner/editor | Allowed after live admission | Existing rights |
| viewer, including board-granted viewer guest | Allowed after live admission | Still refused |
| guest without board grant, removed/disabled/outsider | No state or control | Existing denial |

No facilitator/starter lease or new role. Do not gate timer by canEdit or infer
access from a workspace guest label. Repeat live active lifecycle/no deleted
marker, token, strict access replay, epoch and generation at ordered command/read/
send boundaries, including reconstructed sockets. Fail closed for timer work on
required-source failure. Socket join's strict replay gate is [sync v10](0003-sync-v10.md);
ordinary cached HTTP/edit policies remain outside it. Editor→viewer4403 fresh
authorization retains timer rights; confirmed effective access removal terminates
timer publication/control and protected client state. Refusals disclose no actor.
There is no new Supabase table/function/privilege; service-table count remains16.
