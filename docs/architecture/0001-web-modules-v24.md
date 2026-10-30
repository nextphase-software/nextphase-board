# 0001 — Web app modules

Note version: 24 (for 0003-W1 brief v1, 2026-10-30). Status: Draft. When accepted it replaces
[web modules v23](0001-web-modules-v23.md) for later work. The repository gains a server, so
this note now also says where the shared packages and the server live and what each may
import. It moves the Yjs adapter out of the web app into a new package, `packages/board-sync`,
unchanged. It changes no behaviour of the web app and no saved format:
[document v11](0001-document-v11.md), [storage v3](0001-storage-v3.md),
[board file v2](0006-board-file-v2.md), [interaction v24](0001-interaction-v24.md), the
[activity catalogue contract](0008-activity-catalogue-v1.md) and
[toolchain v4](0001-toolchain-v4.md) govern what the app does. The server's behaviour is in the
0003 contracts ([identity](0003-identity-v1.md), [access](0003-access-v1.md),
[API](0003-api-v1.md), [sync](0003-sync-v1.md), [hosted persistence](0003-hosted-persistence-v1.md),
[self-host runner](0003-self-host-runner-v1.md)).

## Packages and programs

| Folder | npm name | Holds | May import |
| --- | --- | --- | --- |
| `packages/board-rules` | `nextphase-board-rules` | What a board is (as in v23), plus `transition.ts` with `checkTransition` (document v11), which the web app does not import | Only its own files (rule 9, unchanged) |
| `packages/board-sync` | `nextphase-board-sync` | The Yjs mapping of a board: `document-adapter.ts` (moved from `apps/web/src/` byte for byte) and `codec.ts` (reads a Yjs document back into a board document and rejects Yjs data outside the mapping) | Its own files, `nextphase-board-rules` and `yjs` |
| `packages/board-room` | `nextphase-board-room` | The room, with no host code: order of edits and access changes, saved and waiting edits, the copy of access, join tickets, the restore lock and replay, snapshots, close codes | Its own files, `nextphase-board-rules`, `nextphase-board-sync`, `yjs`, `y-protocols` and `lib0` |
| `apps/web` | `nextphase-board-web` | The web app, as in v23 | As in v23, plus `nextphase-board-sync/document-adapter.ts` |
| `apps/server` | `nextphase-board-server` | The HTTP app (`src/app.ts`), the Cloudflare runner (`src/worker.ts`), the Node runner (`src/node.ts`), token checks, the Supabase calls, the schema SQL and the scripts | The three packages and its own dependencies (toolchain v4) |

Dependency direction: `board-rules` ← `board-sync` ← `board-room` ← `apps/server`, and
`board-rules` and `board-sync` ← `apps/web`. Nothing imports `apps/web` or `apps/server`, and
`apps/web` never imports `board-room`, `codec.ts` or anything in `apps/server`.

`board-room` reaches storage, the clock, Supabase and connections only through interfaces it
defines; each runner supplies them. It uses no Cloudflare, Node or browser API itself, so one
room serves both runners. Test drivers supply their own clock and failures through the same
interfaces; the production entry points (`worker.ts`, `node.ts`) contain no test switches.

## Where the code moved

| Module | Before | Now |
| --- | --- | --- |
| The Yjs adapter | `apps/web/src/document-adapter.ts` | `packages/board-sync/src/document-adapter.ts`, unchanged |

The web app imports it as `nextphase-board-sync/document-adapter.ts`. Root tests import the
packages by path (`../packages/<package>/src/<file>.ts`), as in v23.

## Rules for every brief

v23's rules apply, with these changes:

- **Rule 9, the board rules stay shared.** Unchanged for `board-rules`.
- **Rule 10, the room stays host-neutral** (new). A file in `packages/board-room/src/` or
  `packages/board-sync/src/` imports only what the table above allows and uses no global beyond
  those in `board-rules`' `platform.d.ts`, plus `TextDecoder` in `board-room`. Hashing and random
  bytes reach the room through its interfaces. Host code goes in `apps/server`.
- **Rule 11, new server code goes in its own module** (new). A route, a runner or a Supabase call
  is added to the matching module in `apps/server/src/`, not to `app.ts` when it can stand on
  its own; `app.ts` wires routes to handlers.
- **Rule 5, one brief at a time on shared files.** As before, and it now covers the root
  `package.json` and `package-lock.json`, which every program shares.

## Guard tests

v23's guard tests apply, reading the adapter from its new place; the package's module list adds
`transition.ts`, and the web app may not import it. Added: the web app imports
`board-sync` only as `nextphase-board-sync/document-adapter.ts` and never imports
`board-room` or `apps/server`; files in `board-sync` and `board-room` import only what the table
allows, each with the licence header; and `worker.ts` and `node.ts` contain none of the test
drivers' names.

## Planned steps

The web app's sign-in, sharing and hosted save states (the web client milestone) will import
`nextphase-board-sync` for the room connection; that milestone amends this note.
