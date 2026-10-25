BRIEF VERSION: 0001-W17 v1 (2026-10-24)
# 0001-W17 — Move panel layout and context bar state into hooks

Status: Draft. Implementation starts only after the maintainer commits this brief
and [0001 web modules v3](../architecture/0001-web-modules-v3.md) to main.

## Outcome

Part 3a of step 3 of the staged move described in web modules v3, with no change in
behaviour:

- The calculation that places the context bar becomes a pure **rules module** with
  unit tests.
- The **panel layout** state (where the notice and panels start) and the **context
  bar's state** (its measured width and the colour and arrange menus) leave
  `App.tsx` for two hooks under `apps/web/src/state/`, each called where its effects
  used to be, so every effect still runs in the same order.

Every element, attribute, measured position, focus move, menu behaviour, drawn pixel
and saved byte stays as it is at `1d68c8e`.

## Read first and prerequisite contracts

- [Contributor guidance](../../CONTRIBUTING.md), [agent instructions](../../AGENTS.md)
  and [engineering standards](../../DESIGN.md).
- [0001 web modules v3](../architecture/0001-web-modules-v3.md): the governing note
  (layers, the rules for every brief, the state-hook rules).
- [0001 interaction v14](../architecture/0001-interaction-v14.md),
  [0001 document v3](../architecture/0001-document-v3.md),
  [0001 storage v1](../architecture/0001-storage-v1.md) and
  [0001 toolchain v1](../architecture/0001-toolchain-v1.md): unchanged; they describe
  the behaviour that must stay identical. No new dependency.

## Deliverables and boundaries

All line numbers refer to `apps/web/src/App.tsx` at `1d68c8e`.

1. **`apps/web/src/context-bar-position.ts`**, in erasable TypeScript that the Node
   test runner can load (relative imports with explicit `.ts` extensions), exporting
   `contextBarPosition(input)`. Its input has the fields `bounds`, `pos`, `view`,
   `size`, `contextWidth`, `layout`, `inline`, `item` and `itemHeight`, with the types
   these names have in `App.tsx` (`item` may be `undefined`, `bounds` may be `null`).
   Its body is lines 820–833 (`contextLeft`, `contextAbove`, `contextBelow`,
   `contextTop`, `overlapsEditor`, `contextFits`) moved verbatim, and it returns
   `{ contextLeft, contextTop, contextFits }`. It imports `clamp` from `document.ts`
   and nothing from React.

2. **`apps/web/src/state/use-panel-layout.ts`**, exporting `usePanelLayout(scene)`,
   where `scene` is the canvas element's ref created in `App.tsx`. It holds the
   `layout` state (line 185, same initial value) and the effect at lines 186–209,
   moved verbatim, and returns `layout`.

3. **`apps/web/src/state/use-context-bar.ts`**, exporting `useContextBar(input)`. It
   holds, moved verbatim and in this order:
   - the `swatchFor`, `arrangeFor`, `arrangeHeight` and `contextWidth` state (lines
     70–73, same initial values);
   - the layout effect at lines 811–819 that measures the bar;
   - a call to `contextBarPosition`, giving `contextLeft`, `contextTop` and
     `contextFits`;
   - `swatchOpen` (line 834) and the effects at lines 835–853;
   - `arrangeOpen` (line 854) and the effects at lines 855–881;
   - `closeArrange` (lines 905–908) and `closeSwatches` (lines 923–926).

   Its input carries what those lines read from `App.tsx` (`selectionKey`,
   `selected`, `selectionReason`, `bounds`, `pos`, `view`, `size`, `layout`,
   `inline`, `item`, `itemHeight`, and the refs `contextBar`, `colourControl`,
   `colourButton`, `swatches`, `arrangeControl`, `arrangeButton` and `arrangeMenu`,
   which stay created in `App.tsx`). It returns `contextWidth`, `contextLeft`,
   `contextTop`, `contextFits`, `swatchOpen`, `arrangeOpen`, `arrangeHeight`,
   `setSwatchFor`, `setArrangeFor`, `closeSwatches` and `closeArrange`.

4. **`App.tsx`:** `usePanelLayout` is called at the place of line 185, and
   `useContextBar` at the place of line 811 (after the `latestAcknowledgement`,
   `visibleMessage` and `showNotice` lines, before `editingState`). The moved lines
   are removed; everything that used those names (the `select` function at lines
   275–281, the `main` element's style, the `ContextBar` props) uses the returned
   values under the same names. Nothing else changes.

5. **`tests/modules.test.mjs`** and a new **`tests/context-bar-position.test.mjs`**,
   as listed under validation.

**Effect order.** React runs effects in the order they are declared. After the
change, the declared order of every effect in the app, counting the effects inside
hooks at the place the hook is called, is the same as at `1d68c8e`. Moving `useState`
declarations into the hooks is allowed (their order does not change behaviour).

**How the move is done** (web modules v3, "moves are moves"): expressions, effects,
dependency lists and their order move as they are; only where each name comes from
changes (a parameter or returned value instead of a variable in `App.tsx`). The hooks
own the state they hold; `App.tsx` reads it through the returned values. No other
module (rules modules, `ui/`, `scene/`, `objects/`, `icons.tsx`, `main.tsx`),
`style.css`, package file, lock, contract or existing test other than
`tests/modules.test.mjs` changes. If something seems to need more, stop and report it.

New source files use `SPDX-License-Identifier: Apache-2.0`. Append the implementation
record below with the branch, validated revision, commands, results, the `App.tsx`
line counts before and after, and exclusions; report the final branch tip separately.

## Numbered acceptance criteria

- 0001-W17-AC01: The context bar's position is computed by a pure rules module with unit tests that returns exactly what App.tsx computed at 1d68c8e.
- 0001-W17-AC02: Panel layout and context bar state live in hooks under apps/web/src/state/, called where their effects were, with markup, measured positions, focus moves and menu behaviour identical to 1d68c8e.
- 0001-W17-AC03: Web modules v3 is published and enforced: the guardrail test covers state/, screen parts never import state/, the App.tsx budget is lowered, and the unit suite and browser checks pass unchanged.

| Criterion | Evidence that shows it |
| --- | --- |
| 0001-W17-AC01 | `tests/context-bar-position.test.mjs` passes; the moved lines match lines 820–833 |
| 0001-W17-AC02 | The two hooks exist and are called where line 185 and line 811 were; the comparison under validation finds no difference in markup, focus or drawing |
| 0001-W17-AC03 | Web modules v3 is on main with this brief; `tests/modules.test.mjs` passes with the new checks and budget; the full unit suite and the browser regression harness pass with no other test changed |

## Validation commands and expected evidence

From the repository root with the pinned toolchain:

```sh
npm --prefix apps/web ci --ignore-scripts --no-audit --no-fund
npm --prefix apps/web run typecheck
node --test tests/context-bar-position.test.mjs tests/modules.test.mjs
npm --prefix apps/web test
npm --prefix apps/web run build
git diff --name-only main...HEAD
```

The full unit suite runs here because code shared by every feature moves.

`tests/context-bar-position.test.mjs` calls `contextBarPosition` with a `pos` built as
`App.tsx` builds it (from `view` and `size`) and asserts literal expected values for:
no selection (`bounds` `null`); the bar above the selection when there is room below
the panels; the bar below the selection when there is not; the left edge clamped at
12 and the right edge clamped at `size.w - contextWidth - 12`; the top clamped at
`size.h - 52`; an inline editor under the bar (`contextFits` false); a measured width
of 0; a scene narrower than 768; a bar wider than `size.w - 24`; and a bar whose top
plus 40 passes `size.h - 12`.

`tests/modules.test.mjs` keeps its W15 and W16 checks and adds:

- **Line budget.** The literal budget for `App.tsx` becomes its newline count after
  this change.
- **State hooks.** Listing `apps/web/src/state/` recursively finds exactly
  `use-context-bar.ts` and `use-panel-layout.ts`. Each file: no `import` or
  `export … from` whose module path, after removing a `.ts`, `.tsx`, `.js` or `.jsx`
  extension, equals `App` or ends with `/App`, or contains `/ui/` or `/scene/`; the
  first line is `// SPDX-License-Identifier: Apache-2.0`.
- **Only `App.tsx` imports state.** No file under `apps/web/src/` other than
  `App.tsx` (rules modules, `icons.tsx`, `main.tsx`, `ui/`, `scene/`, `objects/` and
  `state/` itself) has an `import` or `export … from` whose module path contains a
  `state/` segment (it starts with `state/` or `./state/`, or contains `/state/`), and
  no file under `apps/web/src/state/` imports or re-exports another module from
  `state/` (no module path starting with `./`).
- **The position module is a rules module.** `apps/web/src/context-bar-position.ts`
  imports nothing from `"react"`.

Reviewer checks (not run by the implementer; browsers cannot start there):

- **Regression harness.** The eight PASS lines at `regressions.html`
  ([tests README](../../tests/README.md)), in a browser window that has focus.
- **Markup, focus and drawing comparison.** The procedure below runs on a build of
  `1d68c8e` twice (the two baseline runs must match each other exactly) and once on
  the candidate, each served on the same origin with the board's IndexedDB database
  deleted first, in a 1280 × 800 viewport, in the same browser with the same device
  pixel ratio and page zoom. **The page must be visible and animation frames must run
  for the whole run**; a run in which any animation frame fails to arrive within one
  second is discarded and repeated with the page visible. Before checkpoint 1 the
  reviewer waits until the Sticky tool button is enabled and the notice no longer
  shows "Opening local board…" or "Checking local storage and writer ownership…". At
  each checkpoint the reviewer waits two animation frames, then records:
  `document.querySelector("main").outerHTML` with every UUID
  (`/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g`) replaced by
  `id-1`, `id-2`, … in order of first appearance; the focused element's path from
  `main`, written as each element's lower-case tag name and its 1-based position
  among its parent's element children, joined by `>` (for example
  `section:5>span:3>div:1>button:2`), or `body` when focus is on the page; and the
  Konva stage's own render,
  `Konva.stages[0].toDataURL({ pixelRatio: 1 })`. The candidate must match the
  baseline at every checkpoint in all three, with no values set aside. Procedure:
  1. Load the page. **Checkpoint 1.**
  2. Open the board name panel from the file bar. **Checkpoint 2.** Close it with its
     Close button.
  3. Open Objects. **Checkpoint 3.**
  4. With the Sticky tool, focus the canvas and press Enter; type `Alpha`; choose Done.
     Repeat with `Beta`. With the Text tool, do the same with `Gamma`. Open Objects
     again, select `sticky 1` only, and wait until the context bar is visible and
     measured. **Checkpoint 4.**
  5. Open the colour control in the context bar. **Checkpoint 5.** Press Escape
     inside the swatches.
  6. Open the context bar's Arrange control (the button inside `.arrange-control`).
     **Checkpoint 6.** Press Escape inside the menu.
  7. In Objects' list select all three objects. **Checkpoint 7.**
  8. Select `sticky 1` and `sticky 2`; choose Group in Objects. **Checkpoint 8.**
  9. Open the information panel. **Checkpoint 9.** Close it.
  10. Open Navigation. **Checkpoint 10.** Close it.
  11. Name the board `Compare` in the board name panel and choose Save; wait until the
      save status reads "Locally saved". **Checkpoint 11.**
  12. Open Objects. Select `sticky 2` only and choose the colour Teal in Objects; then
      select `text 3` only and choose the colour Violet. **Checkpoint 12.**
  13. Select `sticky 1` only. Move focus to the canvas element with its `focus()`
      method and press Enter; the inline editor's container (`.inline`) must be
      present. **Checkpoint 13.** Choose Done in the context bar.
  14. Open the colour control, then dispatch a `pointerdown` event (bubbling) on the
      save status element (`.save-status`). **Checkpoint 14** (swatches closed).
  15. Open the colour control and press Escape inside the swatches. **Checkpoint 15**
      (focus back on the colour button).
  16. Open Objects (the inline editor closed it in step 13), then open the context
      bar's Arrange control. **Checkpoint 16** (focus inside the menu).
  17. Move focus to Objects' list with its `focus()` method. **Checkpoint 17** (menu
      closed).
- **Saved record comparison.** After step 11 the reviewer reads the saved head record
  from IndexedDB in each run and checks that `formatVersion` and `storageRevision`
  are equal, that the two `payload` strings are equal after the same UUID replacement,
  and that each record's `sha256` is the SHA-256 of its own `payload`.
- **Chromium and Safari smoke.** The context bar with a selection near each edge of
  the screen and with the inline editor open; the colour and arrange menus opened and
  closed with the keyboard and with the mouse; the notice appearing and disappearing
  while a panel is open.

No browser matrix, fixtures sweep, accessibility audit or IME checks unless the
maintainer asks.

## Exclusions and reasons

Any change in behaviour or appearance; fixes for bugs noticed on the way (report
them); moving board, history, selection, drafts, storage, saving or messages (part
3b); moving view, gestures, pointer or keyboard handlers or actions (part 3c);
per-type saved data; new object types; contract changes; new dependencies.

## Public references with retrieval dates

None beyond the repository's own documents.

## Implementation record

Not started.

### 2026-10-24 — Implementer handoff

- Implemented **0001-W17 v1** with **web modules v3** on
  `codex/0001-W17-state-hooks`, based on committed main
  `7d6eb197a828b2bf5797737f6db573e18a3be69f`.
- Validated source/test revision:
  **`416bc8f588776c76357e04bf1451835ce6cd4f01`**. The final branch tip is reported
  separately in the handoff; the following documentation commit only appends this
  record.
- `App.tsx` newline count: **1,305 before; 1,209 after**. The guardrail's literal
  budget is now 1,209; its W15 and W16 checks remain.
- Source inspection against `1d68c8e` confirms the position expressions, panel
  effect, menu effects, dependency lists, state initializers and close functions
  moved unchanged. Hook calls occupy the original effect locations, preserving
  layout/passive effect order. The markup and event-handler bodies remain unchanged.
  Runtime markup, focus, drawing and saved-record equivalence await reviewer checks.

All Node/npm commands used the maintainer-provided pinned toolchain PATH override;
its machine-specific location is omitted from this public record. Checks ran on
the source/test tree committed as the validated revision above, with no subsequent
source/test changes.

| Exact command from repository root | Result |
| --- | --- |
| `node --version` | Exit 0; `v24.22.1` |
| `npm --version` | Exit 0; `11.19.1` |
| `npm --prefix apps/web ci --ignore-scripts --no-audit --no-fund` | Exit 0; added 19 packages; no manifest or lock change |
| `npm --prefix apps/web run typecheck` | Exit 0; no diagnostics |
| `node --test tests/context-bar-position.test.mjs tests/modules.test.mjs` | Exit 0; 24 passed, 0 failed, 0 skipped |
| `npm --prefix apps/web test` | Exit 0; full unit suite: 248 passed, 0 failed, 0 skipped |
| `npm --prefix apps/web run build` | Exit 0; accepted lock, runtime inventory and complete distributed notices verified; application built |
| `git diff --check` | Exit 0; no whitespace errors |
| `git diff --cached --check` | Exit 0; no staged whitespace errors |
| `git diff --name-only main...HEAD` | Exit 0 at validated revision; exactly the six allowed source/test deliverables below |

Source/test scope at the validated revision:

```text
apps/web/src/App.tsx
apps/web/src/context-bar-position.ts
apps/web/src/state/use-context-bar.ts
apps/web/src/state/use-panel-layout.ts
tests/context-bar-position.test.mjs
tests/modules.test.mjs
```

Added dependencies: **none**. No other module, stylesheet, existing test, package,
lock or contract changed. This appended implementation record is the only
documentation change. Both public-boundary checks printed PASS during the source
commit, with hooks enabled. Git also printed a non-blocking
`packed-refs.lock: Operation not permitted` environment warning; the commit
succeeded (exit 0) and the worktree was clean afterward.

Not run: any browser, server, regression harness, markup/focus/drawing comparison,
saved-record comparison, Chromium/Safari smoke, fixture build/sweep, accessibility
audit, native IME check, performance/load test or other broader campaign. Browsers
cannot start in the implementer environment; the brief's browser procedures remain
assigned to the independent reviewer. AC01 has unit evidence; AC02's runtime
equivalence and AC03's browser evidence remain pending. No merge or push performed.
