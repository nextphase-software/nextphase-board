# 0003 — Access contract

CONTRACT VERSION: 0003 access v10 (2026-11-09)

Status: Draft for 0007-W2 v1. Replaces [access v9](0003-access-v9.md).
All directory/grants/epochs/removal/lifecycle owner-only rights and timer rights
remain. [Voting v1](0007-workshop-voting-v1.md) adds these distinct rights:

| Effective current role | Read public session/results | Start/vote/unvote/reveal/clear |
| --- | --- | --- |
| owner/editor, including granted editor guest | Yes, plus own running ballot | Yes, only own ballot can be mutated |
| viewer, including granted viewer guest | Yes, no own ballot | No |
| ungranted guest/removed/disabled/outsider | No | No |

No facilitator/starter privilege or new service permission. Use effective board
role, never workspace-guest label. Every operation/publication requires current
token, strict access replay, epoch, generation and active lifecycle/no deleted
marker. Source outage withholds work; no cached successful projection.

Process rights changes for retained voters with no socket through existing
access replay/delivery. Lost owner/editor rights prune active ballots permanently
and refund them, retaining empty private version/slot until reveal. Before own
read/reconnect revalidate that person; before reveal revalidate every retained
person and fail closed on an unknown lookup. Mere token expiry/tab departure is
not access removal. Post-reveal totals remain anonymous and frozen.4403 downgrade
requires fresh viewer projection without old own state; terminal loss clears all
protected state. No new Supabase table/function/privilege; service tables stay16.
