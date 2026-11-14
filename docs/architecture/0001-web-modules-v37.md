# 0001 — Web app modules

Note version: 37 (for 0008-W2 brief v1, 2026-11-14). Status: Draft.
Replaces [web modules v36](0001-web-modules-v36.md), whose registry, import, composition and
one-state-owner guards remain word for word. [Team templates v1](0008-team-templates-v1.md) and
[interaction v39](0001-interaction-v39.md) add exactly three team modules:

| Module | Responsibility |
| --- | --- |
| team/templates-rules.ts | Pure: objects from a snapshot or a whole board, the validation of team templates v1 (via `validate()`), byte size, counters and limits, the Save label and disabled reason, the response parser, sorting and notice words. No React, Auth or server import |
| team/templates.ts | Page-memory controller: list, read one, save, edit details, replace, delete through `team/api.ts`; status (loading, none, failed, refused); the new-card mark; refresh after refusals. No React import |
| team/templates-section.tsx | The team group rendered into the Templates panel (head row, cards, More options, card menu, the four dialogs) and its keys. No second controller |

Exactly **54 team modules** (51 + 3) and exactly 22 state-hook modules. App.tsx remains
composition-only and at most 264 lines. Its only permitted change is on the two existing lines that
take `addActivity` from `useEditingCommands` and pass it to the palette: they carry one
`templateCommands` object instead (activity insertion, the snapshot function and the
stored-objects insertion), adding no line.

Seams, and only these:
- `ui/templates-panel.tsx` renders an optional team section, passed in, between its header and the
  "Activities" heading; with none it renders exactly as at the base.
- `ui/palette.tsx` passes that section through to the panel with `templateCommands`; the section
  component comes from `team/team-app.tsx` as a new `TeamParts` member, through the same team slot
  that carries the Comment and Reactions tools.
- `state/use-editing-commands.ts` exposes two functions to the team section: one returning the
  current selection's snapshot (or every object's, when nothing is selected) with the board title,
  and one inserting a list of stored template objects by the existing activity insertion. The
  insertion path in `activities.ts` takes a parsed document 10 board as well as a catalogue activity;
  `activityPreview` is reused for team cards. No new state hook.
- `team/hosted-board.ts` is read for the open board's workspace id and name, and its existing
  `toast()` shows every template notice (interaction v39); it gains no template state. The
  stored-objects insertion in `templateCommands` shows its `Added …` notice through that toast too,
  because App's `.notice` is not rendered on hosted boards; built-in activity insertion is unchanged.

Server: new `apps/server/src/routes/templates.ts` (the five routes) and
`apps/server/src/templates.ts` (pure validation of a request's objects with
`nextphase-board-rules/document.ts`); `app.ts` registers the routes; `supabase.ts` and `runtime.ts`
gain the six database calls. No package, dependency, font, service or import exception. The off
bundle remains free of team and Supabase inputs and of the three team-template modules (the built-in
Templates panel and activities stay); `templates-rules.ts` joins the no-React/no-Auth list.
