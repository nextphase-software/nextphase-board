# 0001 — Web app modules

Note version: 44 (for 0010-W4 brief v1, 2026-11-20). Status: Draft.
Replaces [web modules v43](0001-web-modules-v43.md), whose registry, import, composition, one-state-owner,
team guards, counts and seams remain word for word except as below.
[Interaction v46](0001-interaction-v46.md) adds links to a page with exactly one new source module and one
test file. No package, room or server file changes.

| Module | Responsibility |
| --- | --- |
| `apps/web/src/page-links.ts` | Pure page-link rules, no React or DOM globals (callers pass the address as a string): reading the page value from an address (hosted fragment or local query, interaction v46 "Page addresses"); building a page link from an address and a page id for each mode; resolving a page value against a board's pages to the page to open and whether the missing-page notice applies; the copied, missing-page and clipboard-refused notice texts. Besides these pure functions it holds one
module-level **startup page value** for the local initial load: set once from the address at the tab's
start, taken once by `use-pages.ts` at the initial adoption, or discarded by `use-storage-session.ts` when the
initial attempt fails. Imports only `nextphase-board-rules` types, if any |
| `tests/page-links.test.mjs` | The unit test file named in the brief |

**Counts.** Unchanged from v43: rules package 16 files, 11 object types, 18 scene parts, 33 screen parts,
25 state hooks, the board-sync list, every effect count (`use-pages.ts` keeps **exactly two** passive
effects and no layout effect; `use-panel-layout.ts` keeps exactly one), and the team module list (no new
file under `team/`). `page-links.ts` is a
web `.ts` file, so the type-name guard applies to it.

**Web paths.**
- `state/use-pages.ts` owns the page part of the address. At the moment interaction v46 calls "first shows a
  board" (local: the initial adoption, taking `page-links.ts`'s startup page value; hosted: the first real
  document it receives, whatever its change origin, taking the hosted board's pending page value), it resolves
  that value instead of the remembered page, and shows the missing-page notice when it applies and the load
  did not end in one of interaction v46's local failures. It rewrites the address with
  `history.replaceState` whenever the open page changes, from an event handler or one of its two existing
  effects (no new effect). It adds `Copy link to page` to `choose()` (clipboard, closing the list, focus,
  notice), lets the menu open for viewers holding only that item (`showMenu`, the closing rule of its focus
  effect and the returned `menu` no longer depend on `canEdit` for that item), and gives the hosted board an
  `openLinkedPage(value)` callback beside `openPage` (interaction v46 "A link to the board that is open").
  When the hosted board turns read-only with an editor's menu open, the menu closes (interaction v46); the
  viewer's one-item menu may open afterwards.
- `ui/pages-panel.tsx`: the new first item and separator; the "…" button on every row for viewers; for
  viewers the menu renders only Copy link to page; the item is never disabled.
- `team/links.ts`: `parseLink` reads `#/b/<uuid>?page=<value>` as `{ kind: "board", board, page }`, with the
  `page` key present only when the fragment has `?page=` (so `parseLink("#/b/<uuid>")` stays exactly
  `{ kind: "board", board }`); `boardLink` and the other link kinds are unchanged.
- `team/hosted-board.ts`: a **pending page value** receiver that exists from construction (initialised from
  the link it is constructed with), so `team-app.tsx` can call it at any time; before the page owner has the
  first real document it only stores the latest value (a bare link clears it); after that it forwards to the
  `openLinkedPage` callback that `use-pages.ts` sets, as `openPage` is set today.
- `state/use-storage-session.ts`: when its initial load attempt fails (no board adopted), it discards
  `page-links.ts`'s startup page value; nothing else changes.
- `team/team-app.tsx`: the `hashchange` handler checks, before anything else, whether the new fragment is a
  board link to the open hosted board; if so it calls that board's `openLinkedPage(page)` (which, before the
  first real document, replaces the pending value), and returns without stopping the board or asking to
  leave. For the life of a board session, `HostedRoute` is never remounted by a page value (from a link or
  from the app's own address writes; including a session that started from an invitation); a route restart
  (the epoch) opens the address as it is then. When the leave question opens, the address already shows the
  open page's link, and Stay keeps it. Every other fragment is handled as today.
- `ui/notice.tsx`: **Retry editing** shows only when the board is not hosted (its existing `hosted` prop).
- `state/use-panel-layout.ts`: inside its one existing effect, the **notice** top (only) also accounts for the
  team notice column (`.team-notice-column`) when it is showing: 8 px below its bottom edge (interaction v46
  "Notice placement"), re-measured when the column appears, changes size or goes. The `panel` value keeps
  today's calculation. Its effect count stays one.
- `apps/web/style.css`: only if the viewer's "…" button or the avatars before it need a rule to match
  interaction v46; new or changed rules keep the existing `page-` class names.

Each may change only as far as its contract needs.

**App.tsx** does not change: the address is read and written inside `use-pages.ts` and the team files. The
"0011-W1 App composition" test in `tests/modules.test.mjs` stays as it is and must still pass.

No dependency, font file, image file, service, service migration or import exception. No stored value, no
room message and no Undo step is added.
