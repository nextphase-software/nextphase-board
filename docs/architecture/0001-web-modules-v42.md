# 0001 — Web app modules

Note version: 42 (for 0010-W3 brief v1, 2026-11-16). Status: Draft.
Replaces [web modules v41](0001-web-modules-v41.md), whose registry, import, composition, one-state-owner,
team guards, counts and seams remain word for word except as below.
[Interaction v44](0001-interaction-v44.md) brings pages to hosted boards with exactly these new modules
and test files. [Sync v14](0003-sync-v14.md), [presence v5](0004-presence-v5.md),
[comments v5](0005-comments-v5.md), [workshop voting v3](0007-workshop-voting-v3.md) and
[hosted storage v12](0003-hosted-storage-v12.md) change the packages and the room as listed.

| Module | Responsibility |
| --- | --- |
| `packages/board-sync/src/order-keys.ts` | Pure order keys of sync v14: comparing keys; the one deterministic key strictly between two neighbour keys (either may be absent); the keys to keep and to assign for a new page order (the longest increasing run rule); an even rebalance; the 64-character bound. No Yjs, DOM or clock |
| `apps/web/src/team/page-presence.ts` | Pure team page rules, no React or DOM: the other people on each page from the presence list (one per person, in file-bar avatar order, excluding your own person); the avatars' accessible name and `+<n>`; whether a presence, reaction or comment thread is on the open page; a thread's page and its location-line suffix or deleted-page line; the people-menu page words; the follow notice; the remote-delete notice and the page to open (the page before the deleted one in the list before the change); the voting page lines and whether Delete page and Move to page are disabled by a running round, with the reason |
| `tests/team-pages.test.mjs` | The unit test file named in the brief |
| `tests/server/team-pages.test.ts` | The server checks S417–S424 named in the brief (both server runners) |

Counts: the rules package stays exactly **15** files. The sync package gains `order-keys.ts`, and
`tests/modules.test.mjs` gains a new exact inventory test of `packages/board-sync/src/` (the ten existing
files plus `order-keys.ts`). Exactly **10** object types, **16** scene parts, **32** screen parts and **25** state hooks
remain. The team folder test's exact list gains `page-presence.ts`. Every effect count is unchanged:
`use-pages.ts` keeps at most **2**.

**The sync package.**
- `codec.ts` reads `pageMap` (sync v14), refuses the old `pages` key in a client update, and orders pages
  by order key then id through `order-keys.ts`.
- `document-adapter.ts` writes `pageMap` by sync v14's minimal-write rule.
- `undo.ts` adds the `page:<id>` units and reports each step's page.
- `session.ts` adds `page` to the presence frame (`checkPresence` with six wire keys) and to `Presence`.
- `comments.ts` adds `page` to `AnchorInput` and `page`, `pageName` to `Anchor`, gives `anchorAt` the open
  page's objects and page, and `detachAnchor` the page rules of comments v5.
- `voting.ts` adds `page` to the start command and round state.

**The room and server.**
- `room.ts`:
  - accepts several pages on create and load (document v19);
  - storage version 8 and the version 7 upgrade with the `pageMap` conversion (hosted storage v12);
  - the presence page check (presence v5).
- `edits.ts` drops the `pages` comparison; validation, size and transition checks remain.
- `history.ts` and its backup check accept any valid page count. The raw stored-document ceiling for history
  captures, history intents and backup fingerprint checks becomes **2,162,688 bytes** (2,097,152 + 65,536),
  which holds 50 pages and every object's `page`. The canonical payload limit measured without `pages` and
  `page` stays 2,097,152 (document v18).
- `conflicts.ts`: `promote()` also re-assigns `name` and `order` writes inside `pageMap` entries (sync
  v14), skipping deleted entries, as it does for object maps.
- `presence.ts` holds the page check.
- `comments.ts` holds the anchor page checks and `keepAnchors`' page rules (comments v5).
- `voting.ts` handles the start page, the page target filter and the reconciliation (voting v3).
- `storage.ts` holds the `workshop_vote.page` column (ensured idempotently) and version 8.
- `backups.ts`: `decodeBackup` accepts storage versions 7 and 8 (hosted storage v12).
- `edit-session.ts`: the `update` frame's `connection` (sync v14).
- `apps/server/src/routes/boards.ts` lifts the one-page check on import and create.
- `apps/server/src/templates.ts` is unchanged.

**Web paths.**
- `state/use-pages.ts`: hosted boards too (`local` is no longer `!hosted`: the Pages button and Move to
  page show on hosted boards). A `canEdit` input hides page steps for viewers, and the remembered page is
  read and written on hosted boards. It receives each hosted board change with its origin (sync v14:
  `own`, `remote` with its connection, `reload`) and applies interaction v44's rule for each: the
  remote-delete notice only for `remote`. Its effects stay at most 2.
- `ui/pages-panel.tsx`: the row avatars, the viewer header and the viewer's rows (no Add page, no "…",
  no name field, no drag).
- `ui/move-to-page.tsx`: shown on hosted boards for those who can edit; the vote reason.
- `team/hosted-board.ts` and `state/use-hosted-board.ts`: report each applied board change's origin
  (and an `update` frame's `connection`) to `use-pages.ts`, as a callback App passes by a recorded
  substitution.
- `team/presence.ts`, `team/hosted-board.ts`, `state/use-presence.ts` and `team/presence-layer.tsx`:
  - send `page`, and send at once on a page change;
  - draw only same-page cursors and selections;
  - following opens the followed page, with the follow notice.
- `team/people.tsx`: the people menu's page words.
- `team/reactions-layer.tsx`, `team/reactions.ts`: same-page bursts only.
- `team/comments/layer.tsx`, `team/comments/panel.tsx`, `team/comments/card.tsx`, `team/comments/rules.ts`:
  - open-page hit testing and pins;
  - the location suffix and deleted-page line;
  - opening a thread's page.
- `team/voting-card.tsx`, `team/voting-overlay.tsx`, `team/voting.ts`, `team/voting-rules.ts`:
  - the start page and the form's scope line;
  - the vote-elsewhere lines and Go to button;
  - markers on the round's page only;
  - opening a result's page.
- `team/templates-section.tsx`, `team/templates-rules.ts`: team templates v2's words and the open page's
  objects.
- `team/history-panel.tsx` and `state/use-board-document.ts`: only as hosted storage v12's preview page
  rule needs.

Each may change only as far as its contract needs. Every hook that commits still gets the whole board.

**App.tsx** remains composition-only, at most 264 lines, with **no added line**. Changes are substitutions
on existing lines only, each passing values App already has (for example the open page id, `pages` or
`canEdit` to the team parts, and the presence list or follow seam to `usePages`). The implementation
record lists every substitution with its e442c8a line and its before and after text. The "0010-W2 App
composition" test in `tests/modules.test.mjs` is rewritten as "0010-W3 App composition": it derives the
expected App from e442c8a's App with exactly the recorded substitutions (each `from` text occurring
exactly once) and asserts the same line count. If no App line needs to change, the test is renamed only.

Seams, and only these, besides the paths above:
- `ui/file-bar.tsx`: the Pages button on hosted boards.
- `ui/notice.tsx`: unchanged unless the remote-delete or follow notice needs a seam.
- `apps/web/style.css`: the row avatars, the viewer header and the vote-elsewhere button spacing, as
  rules on the existing classes plus new classes prefixed `pages-people` and `vote-elsewhere`.

No dependency, font file, image file, service, service migration or import exception. Stored values:
the remembered page in `localStorage` (now also for hosted boards), the room's storage version 8 column,
and the anchor keys of comments v5.
