# 0001 — Web app modules

Note version: 27 (for 0003-W5 brief v1, 2026-11-02). Status: Draft. When accepted it replaces
[web modules v26](0001-web-modules-v26.md) for later work. It adds the Home modules and says
where Back to files, the hosted board's editable name and the held names live. Behaviour is in
[interaction v28](0001-interaction-v28.md) and [0003 hosted storage v3](0003-hosted-storage-v3.md).
Every rule of v26 (and through it v25, v24 and v23) still applies except where this note changes
it.

## Packages and programs

v26's table applies unchanged. No package or dependency is added.

## The team modules

`apps/web/src/team/` holds exactly twenty modules: v26's fifteen and these five. Each starts with
`// SPDX-License-Identifier: Apache-2.0` and has one job:

| Module | Job |
| --- | --- |
| `home-rules.ts` | Pure Home rules: the row and workspace types, the role and sort words, who can create and rename, joining pages by ID, the held names (holding, applying and releasing, with the 120-second limit), the "Edited …" words, and where a menu is placed inside the window |
| `home-lists.ts` | Reading the workspace list and the board lists (Recents, a workspace's pages with sort, order and cursor), ignoring answers to older requests, the loading, not-found and failed states, and Try again |
| `home-menu.tsx` | Home's menus: items, group labels, dividers, placement, focus and keys |
| `home-card.tsx` | A card: selection, opening, the card menu's pointer and key events, and the rename field |
| `home.tsx` | Home: the sidebar, the top bar, the workspace head, the grid and its paging, the states, New board, the card menu's actions, renaming from Home and the toast |

`home-rules.ts` imports neither React nor `auth.ts` nor `api.ts`, so the unit tests import it
directly; the same holds for `links.ts`, which now also reads Home's two links.

`team/team-app.tsx` shows Home for Home's links and the gate for them when signed out, keeps the
held names for the page's lifetime (cleared on sign-out), records a held name when a hosted
board's state becomes Saved with a new title, and sends Close this board and Back to files to
Home. `team/sign-in.tsx`'s gate takes Home's title and leaves out its helper line for Home.

## The team parts

`TeamParts` (in `team/team-app.tsx`) gains `backToFiles?: () => void`, given when a person is
signed in: on a hosted board it is v28's leaving (stop the board, then `#/files`); on a local
board it sets `#/files`. `ui/board-panel.tsx` draws **Back to files** first when it is given. On
a local board the panel asks through the storage session (below) before calling it; on a hosted
board it calls it at once.

## State

The hooks stay **twenty-two**; their names and the import rules are v26's.

- `state/use-storage-session.ts`: the unsaved-edits question (interaction v20) gains a target
  that is not a board: a name and a function to call instead of opening a board. Back to files on
  a local board asks with the name "Recents" and `backToFiles`. Its existing targets behave as
  before.
- `state/use-board-document.ts`: a **name entry** on a hosted board, started when the Board name
  field gets focus and ended when it loses it, gives every change in between one new group (sync
  v4), as a text session does. On a local board it does nothing.
- `state/use-hosted-board.ts`: when the hosted board's board changes its title, the hook also
  sets the name field's title. It still has exactly one passive effect.

`App.tsx` stays composition only, within the **264**-line budget. It may pass the name entry's
start and end to the Board panel; it does no Home work.

## Guard tests

v26's guard tests apply, with these changes:

- `team/` holds exactly the twenty modules above, each with the licence header;
- `team/home-rules.ts` imports neither React nor `team/auth.ts` (as `links.ts`, `roles.ts`,
  `notices.ts` and `presence.ts`);
- the `App.tsx` budget is still 264 lines.

Every other v26 guard is unchanged: twenty-two hooks, `use-hosted-board.ts` with one passive
effect, `state/use-presence.ts` imported only by `team/presence-layer.tsx`, and, outside `team/`
and `main.tsx`, imports from `team/` only with `import type`.

## Planned steps

Home's later parts (thumbnails, search, Share from Home) add their modules to `team/` by
amending this note.
