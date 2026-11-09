# 0007 — Workshop timer contract

CONTRACT VERSION: 0007 workshop timer v2 (2026-11-09)

Status: Draft for 0007-W2 v1. Replaces [timer v1](0007-workshop-timer-v1.md).
All timer state, roles, bounds, wire keys, expected-version ordering, persistence,
clock samples, deadlines, recovery, drafts, status lines, title and announcements
remain. The current version set is in [the brief](../briefs/0007-W2-vote-and-reveal-workshop-results.md).
Room layout is7; document10/fileVersion2/backup envelope1 stay.

The former timer-only panel is recomposed as the shared nonmodal **Timer and
voting** dialog defined in [voting v1](0007-workshop-voting-v1.md), Concrete
presentation and keyboard / Derived geometry and deterministic fixtures. Those
sections replace v1's standalone panel title/total heights/Close/traversal only.
Keep Timer subheading/card first and voting second; one **Close Timer and voting**
at the end of traversal. Timer retains its dedicated controller, local drafts,
focus identity and independent health/confirmation. Timer confirmation replaces
only its own card body, never the voting card or shared header. Voting's
confirmation similarly leaves Timer usable. Opening focus remains timer-specific.

The toolbar geometry, glyphs, digits, title prefix and no-byline presentation
stay exactly v1. Accessible labels replace initial Timer with Timer and voting
and append , Voting in progress while a round runs; see voting v1's exact
examples. No visual vote indicator or new toolbar stop. Existing enabled timer
controls precede voting controls, then shared Close, then Share. Panel height
derives from both cards and their actual text/status lines; the old timer-only
211.391/236.781 total heights no longer describe the combined surface.

Voting start/reveal/clear never mutates timer. Timer start/pause/resume/extend/End/
expiry never starts/ends/reveals voting. Viewers keep full timer rights while
being non-voters. History preview retains timer controls. Both records persist
ordinary restart/last-leave; both reset in the same explicit-recovery/lifecycle
transaction. Logical backups exclude all workshop tables. Timer-only behavior
and current-access gates are otherwise unchanged.

The timer's existing hidden polite atomic region gains the stable identity
`.sr-only[data-workshop-status="timer"]`, with role=status, aria-live=polite and
aria-atomic=true unchanged. Keep exactly one timer region mounted while the
hosted workshop control is active, including when its panel closes. The separate
voting region uses data-workshop-status="voting"; save status remains separate.
Timer lookups and speech collectors/mutation observers must select the timer
identity, not the first/all global polite or .sr-only regions. Preserve every
timer v1 speech assertion: cause-derived start/pause/resume/extend/End/expiry,
delayed End past its old deadline, once-only result/state delivery, no premature
finish, no actor/tick speech, reconnect-only recovery and no terminal replay.
The separate voting checks cannot replace or satisfy timer speech evidence.
