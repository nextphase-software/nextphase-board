# 0001 — Web app modules

Note version: 28 (for 0005-W1 brief v1, 2026-11-03). Status: Draft. When accepted it replaces
[web modules v27](0001-web-modules-v27.md) for later work. It adds the comment modules and the one
shared comment module, and says how the Comment tool and the comments layer reach the board.
Behaviour is in [interaction v30](0001-interaction-v30.md),
[0003 hosted storage v5](0003-hosted-storage-v5.md) and the
[comments contract](0005-comments-v1.md). Every rule of v27 (and through it v26 back to v23)
still applies except where this note changes it.

## Packages and programs

v27's table applies. No package or dependency is added. `packages/board-sync/` gains one module:

| Module | Job |
| --- | --- |
| `packages/board-sync/src/comments.ts` | The comment types (thread, comment, anchor, operation) and the pure rules the room and the web app share: what a point attaches to (`anchorAt`), a pin's point (`anchorPoint`), detaching after an edit (`detachAnchor`), naming an object, the text rules (normalising, empty, length in code points), the author colour, and which threads the filters show in what order. It imports only `nextphase-board-rules` and nothing from the web app or the room |

`packages/board-room/src/comments.ts` (new) is the room's comment store: checking, saving and
sending comment actions, the snapshot, and the anchors kept in an edit's transaction. It is a room
module, not a web module.

## The team modules

`apps/web/src/team/` holds exactly **twenty-six** modules: v27's twenty and these six, in the
folder `team/comments/`. Each starts with `// SPDX-License-Identifier: Apache-2.0` and has one
job:

| Module | Job |
| --- | --- |
| `comments/rules.ts` | Pure comment rules for the screen: re-exports of the shared module's rules and types, the time words, reply counts, accessible names, every message, the composer's and card's place, and which note a request state or refusal shows |
| `comments/icons.tsx` | The comment icons: speech bubble, send arrow, check, filled check, unlink, more, filter, close |
| `comments/tool.tsx` | The Comment tool's button |
| `comments/layer.tsx` | The comments layer: comment mode, the attach outline, the pins, the composer, keys, and which card is open; it draws the card and the panel |
| `comments/card.tsx` | The thread card: its header, rows, menus, edit field, reply field, notes and the delete questions |
| `comments/panel.tsx` | The comments panel, its list and its filter menu |

`comments/rules.ts` imports neither React nor `team/auth.ts`, so the unit tests import it
directly (as `links.ts`, `roles.ts`, `notices.ts`, `presence.ts` and `home-rules.ts`). It is the
**only** web module that imports `nextphase-board-sync/comments.ts`; no other module under
`apps/web/src/` imports from `packages/board-sync/` except as v27 allows.

`team/hosted-board.ts` gives the comments layer the session's threads, `commentsReady`, the
person's own person key and label, `comment()`, `retryComment()` and the comment requests' states,
and a separate subscription for comment changes, so comment frames never run the edit
notifications (counts, notices, save state) of hosted storage v4.

## The team parts

`TeamParts` (in `team/team-app.tsx`) gains `commentTool?` and `commentsLayer?`, given for every
hosted board. `ui/palette.tsx` draws `commentTool` as the toolbar's last button when it is given
(also in a view-only toolbar). `App.tsx` draws `commentsLayer` over the board with what it needs
from the board's state (the board, view, size, tool and their setters, the canvas element,
selection and text editing).

## State

The hooks stay **twenty-two**; their names and the import rules are v27's.

- `state/use-canvas-input.ts`: when a gesture ends or is cancelled and the tool would return to
  Select, it keeps Comment when Comment is the armed tool.
- `state/use-hosted-board.ts`: when the board turns view only, it keeps Comment when Comment is
  the armed tool (otherwise Select, as before). It still has exactly one passive effect.

`App.tsx` stays composition only, within the **264**-line budget.

## Guard tests

v27's guard tests apply, with these changes:

- `team/` holds exactly the twenty-six modules above (the six in `team/comments/` counted by their
  path), each with the licence header;
- `team/comments/rules.ts` imports neither React nor `team/auth.ts`, and is the only web module
  that imports `nextphase-board-sync/comments.ts`;
- the `App.tsx` budget is still 264 lines.

Every other v27 guard is unchanged: twenty-two hooks, `use-hosted-board.ts` with one passive
effect, `state/use-presence.ts` imported only by `team/presence-layer.tsx`, and, outside `team/`
and `main.tsx`, imports from `team/` only with `import type`.

## Planned steps

Later comment work (mentions, for example) adds to `team/comments/` by amending this note.
