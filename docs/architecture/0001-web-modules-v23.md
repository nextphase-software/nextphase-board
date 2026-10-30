# 0001 — Web app modules

Note version: 23 (for 0016-W2 brief v1, 2026-10-29). Status: Draft. When accepted it
replaces [web modules v22](0001-web-modules-v22.md) for later work. It moves the rules that
say what a board is into their own package, `packages/board-rules` (`nextphase-board-rules`),
and records where they now live, what may go in the package, how the web app reaches it and
the tests that keep it that way. Its rules are v22's (v12's eight rules with v20's and v22's
widened type-name guard), with rules 2, 3 and 7 amended for the package and a ninth rule
added. It changes no behaviour, saved format or contract of its own:
[document v10](0001-document-v10.md), [storage v3](0001-storage-v3.md),
[board file v2](0006-board-file-v2.md), [interaction v24](0001-interaction-v24.md), [the
activity catalogue contract](0008-activity-catalogue-v1.md) and
[toolchain v3](0001-toolchain-v3.md) govern what the app does.

## Why

The saved document, its validation and upgrade, and the facts about each kind of object
are the rules every program that handles a board must apply in the same way. Until now they
lived inside the web app, so only the browser could use them. In their own package, with no
dependency on React, Konva, the DOM or any third-party package, a server running in a
Cloudflare Worker or in Node can import exactly the same files later. The rules for editing
a board (history, selection, sections, connectors and the rest) stay in the web app: only
the editor runs them.

## Layers

v12's table applies, with these rows changed or added:

| Layer | What it holds | Where | Rules |
| --- | --- | --- | --- |
| 1. Rules | Pure logic of the editor: storage, history, selection, geometry, view maths, arrangement, groups, clipboard, sections, connectors, strokes, images, command reasons, and the Yjs adapter for the live board | `apps/web/src/*.ts` (for example `history.ts`, `clipboard.ts`, `document-adapter.ts`) | As in v12 |
| 1a. Board rules (package) | What a board is: the saved document versions, validation, upgrade, canonical form, fresh identifiers and limits (`document.ts`); text marks (`marks.ts`); the style palette (`styles.ts`); and the object types (`objects/`) | `packages/board-rules/src/`, the package `nextphase-board-rules` | Imports only its own files: no React, Konva, DOM or third-party package. Beyond ES2022 it uses only `crypto.randomUUID()` and `TextEncoder`, declared in `src/platform.d.ts` and checked by the package's own type check, which has no browser types. Erasable TypeScript with unit tests under `tests/` |
| 3. Object types | As in v12 | `packages/board-rules/src/objects/`: one module per type and `registry.ts` | As in v12, and part of the board rules package |

Dependency direction: as in v12, and the whole web app may use the board rules package,
which uses nothing outside itself. Inside the package, object types import only each other
and `styles.ts`, which never imports them, and `document.ts` uses `marks.ts`, `styles.ts` and the registry,
so there is no import cycle.

## Where the code is now

v22's table applies, with these rows changed or added:

| Module | Layer | Owns |
| --- | --- | --- |
| `packages/board-rules/src/document.ts` | Board rules | As `document.ts` in v22, without the Yjs adapter and without `ResolvedItem`; it exports `styleOf` and `markOf`, which the adapter uses |
| `packages/board-rules/src/marks.ts`, `styles.ts` | Board rules | As in v22, moved unchanged |
| `packages/board-rules/src/objects/` | Object types | The eight modules of v22's `objects/`, moved unchanged |
| `packages/board-rules/src/platform.d.ts` | Board rules (types only) | The two globals the package may use |
| `apps/web/src/document-adapter.ts` | Rules | The Yjs adapter that mirrors the board into the live document, moved from `document.ts` unchanged. It stays in the web app because `yjs` is installed only there |
| `apps/web/src/geometry.ts` | Rules | As in v22, plus the `ResolvedItem` type (an object as drawn: its display height and connector layout), moved from `document.ts` |

The web app imports the package by name, `nextphase-board-rules/<path under src>.ts`; npm
links it into `apps/web/node_modules` (toolchain v3). Tests at the repository root import the
same files by path, `../packages/board-rules/src/<path>.ts`; both routes load one copy.

## Rules for every brief

v22's rules apply, with these changes:

- **Rule 2, new screen code goes in a screen part.** As in v12; a new object type's record goes in
  `packages/board-rules/src/objects/`.
- **Rule 3, new rules go in a rules module with unit tests.** As in v12. A rule about what a saved
  board is (its format, validation, upgrade, canonical form or a per-type fact) goes in the
  board rules package; a rule about how the editor changes a board goes in
  `apps/web/src/`.
- **Rule 7, ask the registry.** As in v22, and the board rules package's modules are rules modules:
  `document.ts`, `marks.ts` and `styles.ts` never compare a type name or keep a table keyed
  by type. Everything that differs by type lives in its record under
  `packages/board-rules/src/objects/`.
- **Rule 9, the board rules stay shared** (new in v23). A file in `packages/board-rules/src/`
  imports only other files there, adds no global beyond those in `platform.d.ts`, and never
  imports the web app. The web app reaches the package only by its name, never by a path
  into `packages/`, and keeps no copy of its modules. A brief that needs the package to use
  a third-party package or another global amends this note and toolchain v3 first.

## Guard tests

The unit tests that guard the modules change as follows: the object-type tests (exactly
eight types, import only siblings or `styles.ts`, no React or Konva, never import App,
licence header) read `packages/board-rules/src/objects/`; the type-name guard reads the
package's `document.ts`, `marks.ts` and `styles.ts` as well as `apps/web/src/*.ts` and
`state/`; the React and Konva guard for rules modules reads the package too. Four tests are
added: the package holds exactly its eleven modules and `platform.d.ts`, each with the
licence header; package files import only package files; the web app has no `document.ts`,
`marks.ts`, `styles.ts` or `objects/` of its own and imports the package only by name, with
names that exist; and each forbidden import form is caught by a sample. The package's type
check without browser types runs in `npm --prefix apps/web run typecheck`. The `App.tsx`
budget stays 262.

## Planned steps

The Yjs adapter joins the package, or a sibling package for the live room, with the first
server milestone, which also decides how server code installs `yjs`. Reading board files
and picture records may follow when a server needs them. Each such move is its own
milestone under these rules. This note is updated as each step lands.
