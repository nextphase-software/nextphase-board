# 0001 — Web app modules

Note version: 18 (for 0006-W2 brief v1, 2026-10-27). Status: Draft. When accepted it
replaces [web modules v17](0001-web-modules-v17.md) for later work. Its rules are v12's,
unchanged. "Where the code is now" and "Planned steps" are updated for several boards and
board files: two rules modules `board-catalog.ts` and `board-file.ts`, and three screen parts
`ui/board-question.tsx`, `ui/boards-list.tsx` and `ui/information-controls.tsx`. It changes no
behaviour, saved format or contract of its own: [document v7](0001-document-v7.md),
[interaction v20](0001-interaction-v20.md), [storage v2](0001-storage-v2.md),
[the board file contract](0006-board-file-v1.md) and [toolchain v1](0001-toolchain-v1.md)
govern what the app does.

## Why

v17's "Why" applies. Storage and the storage session now serve several boards, a board list
and files from outside the app. The rules for keys, the list and the file format are kept out
of the session hook and out of components so they can be unit-tested; the hook keeps its
ownership (opening, saving and switching boards) and grows by that work only.

## Where the code is now

v17's table applies, with these rows changed or added:

| Module | Layer | Owns |
| --- | --- | --- |
| `board-catalog.ts` | Rules | New in 0006-W2: board keys, their record keys and lock names, the board list record's shape, parsing and serialization, entries, order, and the status line and saved-time wording |
| `board-file.ts` | Rules | New in 0006-W2: writing a board file, the ordered reading checks and their reasons, the file name |
| `storage.ts` | Rules | As in v17; from 0006-W2 a store opens one board's pair by board key, writes the list entry in each save transaction, creates a board from a file, and refreshes and repairs the list |
| `ui/` | Screen parts | Twenty modules: v17's seventeen plus `board-question.tsx` (the unsaved-edits question), `boards-list.tsx` (the board list's heading and rows) and `information-controls.tsx` (the Information button and panel placed together, moved out of `App.tsx` unchanged). `board-panel.tsx` adds the two file commands, the file input, the list and the new footer |
| `state/` | State | v17's nineteen hooks, unchanged in number. From 0006-W2 `use-storage-session.ts` also owns the open board's key, the start-up choice, switching boards, the board list and lock status, the question, opening a file and saving a copy |
| `App.tsx` | Composition | As in v17; from 0006-W2 it places `BoardQuestion` and passes the session's board-file values to `BoardPanel`; the Information pair moves into `InformationControls`, so it ends below its budget of 262 lines |

## Rules for every brief

v12's eight rules apply unchanged. `board-catalog.ts` and `board-file.ts` are rules modules:
erasable TypeScript with no React, Konva or DOM imports (they may use `TextEncoder`,
`crypto.subtle` through `storage.ts`'s digest, and `JSON`).

The unit tests that guard the modules change only as follows: the screen parts are exactly
twenty, adding `board-question.tsx`, `boards-list.tsx` and `information-controls.tsx`. The
state hooks stay nineteen and the `App.tsx` budget 262.

## Planned steps

v17's steps are done; connectors landed as 0002-W2. Several boards and board files follow these
rules (0006-W2). Deleting and renaming boards from the list is 0006-W3; it extends
`board-catalog.ts`, `storage.ts` and `ui/boards-list.tsx`. This note is updated as each step
lands.
