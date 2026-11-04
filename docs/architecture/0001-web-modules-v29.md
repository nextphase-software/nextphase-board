# 0001 — Web app modules

Note version: 29 (for 0006-W1 brief v1, 2026-11-04). Status: Draft. When accepted it replaces
[web modules v28](0001-web-modules-v28.md) for later work. It adds the two Home import modules.
Behaviour is in [interaction v31](0001-interaction-v31.md) and [0003 API v5](0003-api-v5.md).
Every rule of v28 (and through it v27 back to v23) still applies except where this note changes
it.

## Packages and programs

v28's table applies. No package or dependency is added, and no package module is added: the
server's creation route and the room's start from a document live in the existing
`apps/server/src/` and `packages/board-room/src/room.ts` (the 0006-W1 brief names the files).

## The team modules

`apps/web/src/team/` holds exactly **twenty-eight** modules: v28's twenty-six and these two. Each
starts with `// SPDX-License-Identifier: Apache-2.0` and has one job:

| Module | Job |
| --- | --- |
| `team/import.ts` | The import's rules, with no screen: read a file with board file v2's reader (`readBoardBundle` from `../board-file.ts`), refuse a board holding pictures with interaction v31's words, bring an older document to version 10 (`upgrade`), refuse one whose canonical JSON is over 2 MiB with the reader's "it is not a valid board", and hand the request body `{ title, document }` to a sending function it is given. It exports the pictures refusal's words |
| `team/home-import.tsx` | Home's import, for Home to draw: the Import board file… button, the hidden file input, the busy state, sending the body through `team/api.ts`, opening the new board, the refusal words, and where focus goes. It tells Home's toast what to show through a function Home gives it |

`team/import.ts` imports neither React nor `team/auth.ts` nor `team/api.ts`, so the unit tests
import it directly (as `links.ts`, `roles.ts`, `notices.ts`, `presence.ts`, `home-rules.ts` and
`comments/rules.ts`). It imports only `../board-file.ts` and `nextphase-board-rules` modules.

`team/home.tsx` stays Home's page: it draws Import from `team/home-import.tsx` in the top bar
before New board, adds the **Import into** menu to its menus, shares its one-creation-at-a-time
flag with the import, and lets its toast hold a message that does not time out (interaction v31,
"Importing"). It gains no other job.

## State

The hooks stay **twenty-two**; their names and the import rules are v28's. The import's busy
state lives in `team/home-import.tsx`, not in a hook under `state/`.

`App.tsx` does not change and stays within the **264**-line budget.

## Guard tests

v28's guard tests apply, with these changes:

- `team/` holds exactly the twenty-eight modules above (v28's twenty-six, `home-import.tsx` and
  `import.ts`), each with the licence header;
- `team/import.ts` imports neither React, `team/auth.ts` nor `team/api.ts`;
- the `App.tsx` budget is still 264 lines.

Every other v28 guard is unchanged: `team/comments/rules.ts` imports neither React nor
`team/auth.ts` and is the only web module that imports `nextphase-board-sync/comments.ts`;
twenty-two hooks; `use-hosted-board.ts` with one passive effect; `state/use-presence.ts` imported
only by `team/presence-layer.tsx`; and, outside `team/` and `main.tsx`, imports from `team/` only
with `import type`.

## Planned steps

Dropping a file onto Home, or moving a local board to a workspace without a file, would extend
`team/home-import.tsx` and `team/import.ts` by amending this note.
