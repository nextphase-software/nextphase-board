# 0001 — Web app modules

Note version: 25 (for 0003-W4 brief v1, 2026-11-01). Status: Draft. When accepted it replaces
[web modules v24](0001-web-modules-v24.md) for later work. It adds the web app's team modules
(signing in, hosted boards and Share), lets the web app use the shared client
`nextphase-board-sync/session.ts`, and adds one state hook. Behaviour is in
[0003 hosted storage v1](0003-hosted-storage-v1.md), [interaction v25](0001-interaction-v25.md),
[0003 sync v4](0003-sync-v4.md) and [toolchain v5](0001-toolchain-v5.md). Every rule of v24
(and through it v23) still applies except where this note changes it.

## Packages and programs

v24's table applies with two changes:

| Folder | npm name | Change |
| --- | --- | --- |
| `apps/web` | `nextphase-board-web` | May also import `nextphase-board-sync/session.ts` (only from `src/team/hosted-board.ts`) and `@supabase/auth-js` (only from `src/team/auth.ts`) |
| `packages/board-sync` | `nextphase-board-sync` | `session.ts` and `undo.ts` gain "Grouped edits" (sync v4); still no host API, rule 10 unchanged |

`apps/web` still never imports `board-room`, `codec.ts` or anything in `apps/server`.

## The team modules

`apps/web/src/team/` holds exactly these twelve modules. Each starts with
`// SPDX-License-Identifier: Apache-2.0` and has one job:

| Module | Job |
| --- | --- |
| `config.ts` | The three build settings compiled in by the switch (hosted storage v1), read nowhere else |
| `auth.ts` | The one `AuthClient` and its options |
| `api.ts` | Calls to the Board server with the current access token; turns an error reply into its reason |
| `links.ts` | Parses the two link forms and writes board and invitation links |
| `roles.ts` | The role words and where a role comes from (workspace, this board, both), pending invitations |
| `notices.ts` | The save state from the requests, the close table and the outcome of a failed join attempt, the renewal timer's delay, and every message's words |
| `hosted-board.ts` | One hosted board: details, joining through `BoardSession`, renewal, retries, closes, edits with their group, undo and redo |
| `dialog.tsx` | The team dialog: `showModal`, focus wrap, Escape order, keys kept from the page, focus return |
| `sign-in.tsx` | The sign-in dialog and the gate (email and code steps) |
| `share-dialog.tsx` | Share: owner view, workspace view, role menu, invitations, copying, non-owner view |
| `pages.tsx` | The full pages: Opening, Can't open, Not found, Board full |
| `team-app.tsx` | The team entry: reads links, holds the Auth session, opens a hosted board or the local one, and renders `App` with the team parts; exports the type of those parts |

Pure rules (`links.ts`, `roles.ts`, `notices.ts`) import neither React nor `auth.ts`, so the
unit tests import them directly. A module may split further only by amending this note.

`apps/web/src/main.tsx` loads `team/team-app.tsx` with a dynamic `import()` only when the build
switch is on, and renders `App` as before when it is off. Outside `team/`, the app imports
team modules for types only (`import type`), so an off build contains none of them. `App`
receives the team parts (the hosted board, the save panel's Sign in or Share, the account row,
the banner) as one optional prop; with it absent `App` behaves as in v24.

## State

`apps/web/src/state/` gains `use-hosted-board.ts`: it loads a hosted board's current board into
the existing board document state whenever the shared client reports a change, and sets view
only from the role and connection. It holds exactly one passive effect. The hooks become
twenty-one. `use-board-document.ts`, `use-command-reasons.ts`, `use-editing-commands.ts`,
`use-storage-session.ts` and `use-panel-layout.ts` take the hosted board where hosted storage v1
needs it (sending each change with its text session's group; Undo and Redo through the shared
client; no storage startup for a hosted board; a layout that works without the local notice).

`App.tsx` stays composition only, within its **262**-line budget.

## Guard tests

v24's guard tests apply, with these changes:

- the web app may import `nextphase-board-sync/session.ts`, only from `team/hosted-board.ts`;
  `@supabase/auth-js` only from `team/auth.ts`; any other `nextphase-board-sync` module than
  `document-adapter.ts` and `session.ts` stays forbidden;
- `team/` holds exactly the twelve modules above, each with the licence header;
- outside `team/` and `main.tsx`, a web source file imports from `team/` only with
  `import type`; `main.tsx` imports `team/team-app.tsx` only by a dynamic `import()`;
- `state/` holds exactly the twenty-one hooks, `use-hosted-board.ts` with exactly one passive
  effect.

## Planned steps

Home, creating and renaming hosted boards (0003-W5) and presence on screen (0004-W3) add their
modules to `team/` by amending this note.
