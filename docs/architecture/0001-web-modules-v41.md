# 0001 — Web app modules

Note version: 41 (for 0010-W2 brief v1, 2026-11-15). Status: Draft.
Replaces [web modules v40](0001-web-modules-v40.md), whose registry, import, composition,
one-state-owner and team guards remain word for word except as below. [Interaction v43](0001-interaction-v43.md)
adds pages to local boards with exactly these four new source modules and two new test files;
[document v18](0001-document-v18.md) changes the rules package, the sync package and the room as listed.

| Module | Responsibility |
| --- | --- |
| `apps/web/src/pages.ts` | Pure page rules on a whole board, no Konva, React or DOM: the open page's objects; the next `Page <n>` name; adding, renaming (trim, 60 code points), moving (up, down, to an index), duplicating (copies with new ids, generations and group ids, references remapped, through the existing copy helpers) and deleting a page, each returning the next whole board; the moved set and moving it (interaction v43, through `copiedSet` in `connectors.ts` and the mind-map helpers), returning the next board, the moved count and the deleted connector count; the notice texts of interaction v43; the page a find result is on and the cross-page find order and first-current rule (with `find.ts`). Every function takes and returns whole boards; none drops another page's objects |
| `apps/web/src/state/use-pages.ts` | The one owner of page state: the open page id; each page's view for the tab; the remembered page (`localStorage` key `nextphase-board/page/v1/<boardId>`, read when a local board loads, written on each open, errors ignored); whether the list is open; the page whose menu is open; the page whose name field is open; a drag in progress. Opening a page (ending a text edit, clearing the selection, the view rule) and the page steps, each committed on the whole board through the existing `commit`, one history step each. At most **two** effects (for example the outside-pointer listener that closes the list) |
| `apps/web/src/ui/pages-panel.tsx` | The Pages button's list of interaction v43: header, Add page, rows, name field, drag line, and the page menu; keys inside them |
| `apps/web/src/ui/move-to-page.tsx` | The selection bar's Move to page button and its menu |
| `tests/pages.test.mjs` | The unit test file named in the brief |
| `tests/server/pages.test.ts` | The server checks S411–S416 named in the brief (both server runners) |

Counts: the rules package stays exactly **15** files; exactly **10** object-type modules; exactly **16**
scene parts; exactly **32** screen parts (30 + `pages-panel.tsx` + `move-to-page.tsx`); exactly **25**
state hooks (24 + `use-pages.ts`, with the effect count the implementation record states, at most 2);
every other effect count unchanged.

**The rules package** (`packages/board-rules/src/`). `document.ts`: version 13 in `validate` (the
top-level keys with `pages`, the page rules and the four reference rules of document v18), the
`Board`/`BoardV13`/`ItemV13` types (older names may remain as aliases), `upgrade` to version 13 (the
default page, every object on it), `empty()` at version 13 with the default page, `add()` taking the
page for the new object, and `canonical` with the new key orders. `objects/registry.ts`: `objectKeys`
inserts `page` after `type` for version 13; `objects/stroke.ts`, `image.ts`, `tape.ts`: their saved key
lists gain `page` after `type`. No new file.

**The sync package** (`packages/board-sync/src/`). `codec.ts` reads `pages` from the board map and
`page` from each object map (keeping the connector key handling correct), at version 13;
`document-adapter.ts` writes `pages` as one value when it differs by content and `page` with the plain
keys; `undo.ts` is unchanged (a hosted board's pages never change; an object's `page` is captured with
its other keys as today).

**The room and server.** `packages/board-room/src/room.ts`: new boards at version 13 with the default
page; a stored version 10, 11 or 12 board upgraded to 13 as document v18 says (the default page, each
object's `page`). `edits.ts`: an accepted edit is version 13 and its `pages` equals the room's current
`pages` (otherwise `invalid_document`). `history.ts`: history checks accept versions 10 to 13 and a
restore is served as 13; a restored document with other than one page is refused as an invalid
document. `apps/server/src/routes/boards.ts`: import and create accept version 13 with exactly one page
(otherwise `invalid_document`). `apps/server/src/templates.ts` and `apps/web/src/team/templates-rules.ts`:
the wrapper of document v18 (no `page` on stored objects; wrapped as version 13 with the default page).

**Web paths that read or write the document version or create objects**: `storage.ts` and
`board-file.ts` (newer above 13); `history.ts` (local Undo records a change of `pages` with the objects
and the open page of each step, and Undo and Redo report that page so `use-pages.ts` can open it);
`clipboard.ts` `copyObjects`, `connectors.ts` `createConnector`, `strokes.ts`, `tape.ts`, `images.ts`,
`mind-map.ts`, `activities.ts`, `state/use-geometry-edits.ts`, `state/use-canvas-input.ts` and
`state/use-editing-commands.ts`: new objects on the open page (passed in, never guessed from the
board), duplicates on their source's page; `find.ts` and `state/use-find.ts`: interaction v43's find
across pages (results from every page's displayed objects, the first-current rule, opening a result's
page through `use-pages.ts`, rings and fading for the open page, the page line). `sections.ts` (wrapping a selection in a new section on the open page; drop targets and placement into
sections among the open page's sections only), `state/use-images.ts` (passing the open page to
`addImages`) and `state/use-tidy-up.ts` (Tidy up reads the open page's objects and commits the whole
board). Any of these may change only as far as interaction v43 and document v18 need. Every hook that
commits gets the whole board, never the open page's objects alone.

**App.tsx** remains composition-only and at most 264 lines, with **no added line**. Its changes are
substitutions on existing lines only, each passing values App already has or calling `usePages`, and
together they: import `usePages` (appended to line 21) and the two new parts (appended to line 24); call
`usePages` once, on an existing line after `useBoardDocument`, with the whole board, `commit`, the history
and the other values it needs (values defined later in App are passed as functions, as `useImages` gets
`getView`); give the open page's objects, not the whole board's, to the hooks and parts that draw, hit,
select, lay out, tidy and list (interaction v43 "The open page"); and pass `pages` to `FileBar`,
`ContextBar` (for Move to page), `Notice` (for Go to) and `useFind`. The implementation record lists
every substitution with its 076f82e line and before and after text. The existing "0010-W1 App
composition" test in `tests/modules.test.mjs` is rewritten as "0010-W2 App composition": it derives the
expected App from 076f82e's App with exactly the recorded substitutions (each `from` text occurring
exactly once) and asserts the same line count.

Seams, and only these, besides the paths above:
- `ui/file-bar.tsx`: the Pages button (local boards only) and the pages list it opens.
- `ui/context-bar.tsx`, `ui/stroke-controls.tsx` and `ui/connector-controls.tsx`: Move to page in each
  variant (interaction v43; the last two only gain a slot before their Delete button), only with two or
  more pages on a local board.
- `ui/notice.tsx`: the Go to button while the move message is shown.
- `ui/navigation-panel.tsx`: the heading `Sections on this page` with two or more pages.
- `ui/find-bar.tsx`: the page line.
- `icons.tsx`: the pages, move-to-page, plus and "…" icons.
- `apps/web/style.css`: the Pages button's open look, the list, the name field, the drag line, the
  menus and the Move to page open look; the NextPhase values used by these rules are declared once as
  custom properties named `--np-…` on `:root` and used only by the new rules.

No dependency, font file, image file, service or import exception. The only new stored value is the
remembered page in `localStorage`.
