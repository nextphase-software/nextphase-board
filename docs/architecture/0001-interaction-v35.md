# 0001 — Interaction and browser contract

Contract version: 35 (for 0007-W1 brief v1, 2026-11-08). Status: Draft.
Replaces [interaction v34](0001-interaction-v34.md). Its Home/Trash, selection,
file, history, Comments, canvas and local/off values stay. The only toolbar
addition is Timer immediately before Share. All concrete new values are in
[timer v1](0007-workshop-timer-v1.md), sections Approved interface values through
Derived geometry and fixture, incorporated as requirements here, not examples.

Timer logic is independent of document editing. Every admitted effective role
gets the same Timer title/controls. Panel never shows a person's name/email or
attribution/reserved gap; time/status block directly precedes controls by 8px.
Running with no status has derived panel height 211.391/controls y230.391 desktop,
y286.391 narrow. Paused/zero/connection states retain their actual status line,
derived height 236.781 for a single line. Do not remove Paused/Timer finished to
imitate running height. Font-dependent rectangles allow0.5px; wrapped text height
allows1px, derived from specified font/text/width. Specific timer text styles win
over generic dialog paragraph rules. Every other exact word, colour, size, SVG,
hover/focus, motion, title and role is the timer contract's concrete requirement.

Closed right-bar keyboard order retains each existing people button, then Timer
and Share (save status/divider are not focus stops). In the two-person editor
fixture: ben (you), can edit. Open people menu (1) → Follow ana, owner (2) →
People on this board: 2 (3) → Timer, idle, 03:00 (4) → Share (5). Substitute
the timer's current state/time label. Narrow keeps ben's self button (1) →
Show 1 more people (2) → People on this board: 2 (3) → Timer (4) → Share (5).
Owner/viewer retain their existing self/follow labels and all three people stops.
From the people chevron, one Tab reaches Timer and the next Share. For other
presence counts, Timer follows the last existing people button; never remove or
collapse those stops. Open-panel enabled traversal/focus/confirmation is the timer
contract's table, continuing to Share without a trap. Share's modal behavior
stays. Local/off right-bar order and all functional assertions stay unchanged.
Opening History/Comments/Share closes Timer; preserve controller drafts, selection
chrome and history-preview timer authority. One polite atomic timer status region,
no per-second speech, no actor names or sound. Caption text used to illustrate the
browser title is not a shipped on-canvas element.
