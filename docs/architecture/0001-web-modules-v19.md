# 0001 — Web app modules

Note version: 19 (for 0008-W1 brief v1, 2026-10-27). Status: Draft. When accepted it
replaces [web modules v18](0001-web-modules-v18.md) for later work. Its rules are v12's,
unchanged. "Where the code is now" and "Planned steps" are updated for templates: one rules
module `activities.ts`, a data folder `activities/`, and one screen part `ui/templates-panel.tsx`.
It changes no behaviour, saved format or contract of its own:
[document v7](0001-document-v7.md), [interaction v21](0001-interaction-v21.md),
[storage v2](0001-storage-v2.md), [the board file contract](0006-board-file-v1.md),
[the activity catalogue contract](0008-activity-catalogue-v1.md) and
[toolchain v1](0001-toolchain-v1.md) govern what the app does.

## Why

v18's "Why" applies. Adding an activity is Paste with a different source, place and view, so it
reuses the clipboard's copy step instead of a second copy of it, and keeps its own rules
(placement, view, preview) in a rules module with unit tests. Activities are data: they sit in
their own folder, outside the rules modules the type-name guard reads, so their board text may
name types.

## Where the code is now

v18's table applies, with these rows changed or added:

| Module | Layer | Owns |
| --- | --- | --- |
| `activities.ts` | Rules | New in 0008-W1: reading a catalogue entry's file (board file rules, version 7), the activity's box and its placement, adding it through the clipboard's copy step, the view and zoom after adding, and the preview's geometry |
| `activities/` | Data | New in 0008-W1: `catalog.ts` (the entries) and one module per activity (`retrospective.ts`, `brainstorm.ts`, `kanban.ts`), each exporting its board file text; no rules, no imports other than `catalog.ts` importing the activity files |
| `clipboard.ts` | Rules | As in v18; from 0008-W1 the copy step of `buildPaste` (fresh IDs and generations, group, section and end remapping, bounded positions, order) is its own exported function, which Paste and adding an activity both call; Paste's behaviour is unchanged |
| `ui/` | Screen parts | Twenty-one modules: v18's twenty plus `templates-panel.tsx` (the panel, its cards, previews and Add template buttons). `palette.tsx` adds the Templates button and places `TemplatesPanel` |
| `icons.tsx` | Screen parts | Adds the templates icon |
| `state/` | State | v18's nineteen hooks, unchanged in number. From 0008-W1 `use-editing-commands.ts` also adds an activity (one history step, selection, notice, view); `use-editor-placement.ts` owns the Templates button's element and returns focus to it; `use-page-keys.ts` returns focus to it on Escape |
| `App.tsx` | Composition | As in v18; from 0008-W1 it passes the Templates values to `Palette` (which places the panel), and stays within its budget of 262 lines |

## Rules for every brief

v12's eight rules apply unchanged. `activities.ts` is a rules module: erasable TypeScript with no
React, Konva or DOM imports, and, by rule 7, no comparison with a type name (it asks the registry
whether an object has a rectangle, ends or is a container). The `activities/` folder is data and
is not one of the rules modules the type-name guard reads.

The unit tests that guard the modules change only as follows: the screen parts are exactly
twenty-one, adding `templates-panel.tsx`. The state hooks stay nineteen and the `App.tsx` budget
262.

## Planned steps

v18's steps are done; board files landed as 0006-W2. Templates follow these rules (0008-W1).
Saving your own activities and team templates is 0008-W2; it extends the catalogue and
`activities.ts`. This note is updated as each step lands.
