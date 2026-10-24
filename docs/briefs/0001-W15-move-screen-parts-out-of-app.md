BRIEF VERSION: 0001-W15 v1 (2026-10-24)
# 0001-W15 — Move the screen parts out of App.tsx

Status: Draft. Implementation starts only after the maintainer commits this brief
and [0001 web modules v1](../architecture/0001-web-modules-v1.md) to main.

## Outcome

The twelve screen parts around the canvas leave `apps/web/src/App.tsx` and render
from their own components under `apps/web/src/ui/`. Nothing a user can see or do
changes: every element, attribute, message, focus move and saved byte stays as it is
at `cc34381`. A unit test starts enforcing the web modules rules. This is step 1 of
the staged move described in web modules v1; the canvas scene, the inline editor,
object types and live state move in later steps.

## Read first and prerequisite contracts

- [Contributor guidance](../../CONTRIBUTING.md), [agent instructions](../../AGENTS.md)
  and [engineering standards](../../DESIGN.md).
- [0001 web modules v1](../architecture/0001-web-modules-v1.md): the governing note
  (layers, the rules for every brief, "moves are moves").
- [0001 interaction v14](../architecture/0001-interaction-v14.md),
  [0001 document v3](../architecture/0001-document-v3.md),
  [0001 storage v1](../architecture/0001-storage-v1.md) and
  [0001 toolchain v1](../architecture/0001-toolchain-v1.md): unchanged; they describe
  the behaviour that must stay identical. No new dependency.

## Deliverables and boundaries

1. Twelve new component modules in `apps/web/src/ui/`, each exporting one function
   component, with these file names, names and regions of `App.tsx` at `cc34381`:

   | File | Component | Region it renders |
   | --- | --- | --- |
   | `file-bar.tsx` | `FileBar` | `<section className="file floating">` (board name button, Objects, Undo, Redo) |
   | `save-area.tsx` | `SaveArea` | `<section className="actions floating">` (save status and Save) |
   | `notice.tsx` | `Notice` | `<aside className="notice">` |
   | `board-panel.tsx` | `BoardPanel` | `<section className="details floating">` |
   | `objects-panel.tsx` | `ObjectsPanel` | `<section className="objects floating">` |
   | `context-bar.tsx` | `ContextBar` | `<section className="context">` with its colour swatches and arrange menu |
   | `arrange-controls.tsx` | `ArrangeControls` | What the `arrangementControls` helper returns today |
   | `palette.tsx` | `Palette` | `<nav className="palette floating">` |
   | `zoom-controls.tsx` | `ZoomControls` | `<nav className="zoom floating">` |
   | `information-button.tsx` | `InformationButton` | The `information floating icon-button` button |
   | `information-panel.tsx` | `InformationPanel` | `<section className="information-panel floating">` |
   | `navigation-panel.tsx` | `NavigationPanel` | `<section className="navigation floating">` |

2. `apps/web/src/App.tsx`: each region above is replaced by its component, and the
   `arrangementControls` helper is replaced by `ArrangeControls` at both places that
   use it. Nothing else in `App.tsx` changes.
3. A new `tests/modules.test.mjs` with the checks listed under validation.

**How the move is done.** Each rule below has to hold; together they make the result
identical:

- **Markup.** Each component returns exactly the elements of its region, in the same
  order, with the same attributes, ids, classes, keys and text, and no added wrapper
  element. `ArrangeControls` returns the same list the helper returns.
- **Mounting conditions stay in `App.tsx`.** The expressions that decide whether a
  region is in the page at all stay in `App.tsx` around the component:
  `panel === "Board"`, `panel === "Objects"`, `selected.size > 0` (context bar),
  `panel === "Information"` and `panel === "Navigation"`. Every other region is always
  in the page, as today. Whenever `App.tsx` places a component, it renders its root
  element.
- **Visibility attributes move with their element.** Attributes that hide or disable
  an element that stays mounted keep their expressions, with the values passed in as
  props: the notice's `hidden={!showNotice}`, and the context bar's
  `aria-hidden={!contextFits}`, `inert={!contextFits}` and its `style` (position and
  `visibility`). They must not become mounting conditions.
- **Conditions inside a region move with it unchanged,** for example
  `selected.size > 0 &&` around the Objects styles, `item &&` in the context bar,
  `swatchOpen &&` and `arrangeOpen &&`.
- **Order in `App.tsx`.** The components are placed where their regions were, so the
  page's element order is unchanged. The three hidden reason elements
  (`undo-reason`, `redo-reason`, `selection-reason`), the canvas scene and the inline
  editor stay in `App.tsx` where they are.
- **Components are plain functions of their props.** Declared at module level; no
  React state, effect, memo, callback, reducer, ref or context hooks, and no
  `createContext`. Every value, handler and element they need comes in as a prop.
  Refs that `App.tsx` uses for focus or measuring (for example the board, Objects,
  navigation, information, colour and arrange buttons, the context bar, the swatches
  and arrange menu, the colour and arrange controls, the Objects selector) are created
  in `App.tsx` and passed in as props, and attached to the same elements as today.
  The shared text editor element that `App.tsx` builds (used by both Objects and the
  inline editor) is passed to `ObjectsPanel` as a prop.
- **Moved, not rewritten.** Inside each region the expressions, inline JSX handlers
  (for example the board name input's `onChange` and composition handlers, or the
  snapshot buttons' `onClick`) and their order move as they are; whatever they use
  from `App.tsx` (setters, `commit`, `model`, refs, values) comes in as props. Named
  functions declared in `App.tsx` (for example `command`, `save`, `toggle`, `arrange`,
  `changeStyle`, `clipboardCommand`, `select`, `move`, `resizeBy`, `create`, `reopen`,
  `adopt`, `edit`, `finishTextSession`, `closeSwatches`, `closeArrange`) stay in
  `App.tsx` and are passed in as props. Imports move with the code that uses them.
- **No other change.** No change to any other module (`document.ts`, `history.ts`,
  `storage.ts`, `selection.ts`, `resize.ts`, `arrange.ts`, `group.ts`, `clipboard.ts`,
  `geometry.ts`, `styles.ts`, `view.ts`, `commands.ts`, `icons.tsx`, `main.tsx`), to
  `style.css`, package files, the lock, any contract or any existing test. If a
  region seems to need a change beyond these rules, stop and report it.

New source files use `SPDX-License-Identifier: Apache-2.0`. Append the implementation
record below with the branch, validated revision, commands, results, the `App.tsx`
line counts before and after, and exclusions; report the final branch tip separately.

## Numbered acceptance criteria

- 0001-W15-AC01: The twelve screen parts render from stateless components under apps/web/src/ui/ with markup and behaviour identical to cc34381.
- 0001-W15-AC02: Web modules v1 is published and its guardrails are enforced by a unit test (App.tsx line budget; screen parts hold no state and never import App.tsx).
- 0001-W15-AC03: No change in behaviour is shown: the unit suite and browser regression harness pass unchanged, and page markup and saved bytes match cc34381 for a scripted session.

| Criterion | Evidence that shows it |
| --- | --- |
| 0001-W15-AC01 | The twelve files exist with the components above; `App.tsx` places them where the regions were; the markup comparison under validation finds no difference |
| 0001-W15-AC02 | Web modules v1 is on main with this brief; `tests/modules.test.mjs` passes and fails if `App.tsx` exceeds its budget or a screen part uses a hook or imports `App.tsx` |
| 0001-W15-AC03 | Full unit suite and the browser regression harness pass with no test changed; the scripted comparison finds identical markup at every checkpoint and identical saved records |

## Validation commands and expected evidence

From the repository root with the pinned toolchain:

```sh
npm --prefix apps/web ci --ignore-scripts --no-audit --no-fund
npm --prefix apps/web run typecheck
node --test tests/modules.test.mjs
npm --prefix apps/web test
npm --prefix apps/web run build
git diff --name-only main...HEAD
```

The full unit suite runs here (not only the new file) because code shared by every
feature moves.

`tests/modules.test.mjs` reads the files as text and asserts:

- **The screen parts exist.** Listing `apps/web/src/ui/` recursively finds exactly the
  twelve files in the table above, and no other file.
- **Line budget.** The number of newline characters in `apps/web/src/App.tsx` is at
  most a budget written in the test as a literal integer, equal to that count after
  this change.
- **Screen parts hold no state.** In every file under `apps/web/src/ui/`: no call of
  a React hook, meaning no match for `/\buse[A-Z]\w*\s*\(/`; no `createContext`;
  and every import from `"react"` is type-only (`import type …`), so hooks cannot be
  reached through an alias or a namespace import.
- **Dependency direction.** No `import` or `export … from` in a file under
  `apps/web/src/ui/` has a module path that, after removing a `.ts`, `.tsx`, `.js` or
  `.jsx` extension, equals `App` or ends with `/App`.
- **Licence header.** Every file under `apps/web/src/ui/` begins with the line
  `// SPDX-License-Identifier: Apache-2.0`.

Reviewer checks (not run by the implementer; browsers cannot start there):

- **Regression harness.** The eight PASS lines at `regressions.html`
  ([tests README](../../tests/README.md)).
- **Markup comparison.** The procedure below runs once on a build of `cc34381` and
  once on the candidate, each served on the same origin with the board's IndexedDB
  database deleted first, in a 1280 × 800 viewport. Before checkpoint 1 the reviewer waits until the Sticky
  tool button is enabled and the notice no longer shows "Opening local board…" or
  "Checking local storage and writer ownership…". At each checkpoint the reviewer
  waits two animation frames, takes `document.querySelector("main").outerHTML`, and
  replaces every UUID (`/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g`)
  by `id-1`, `id-2`, … in order of first appearance. The two runs must match at every
  checkpoint. Procedure and checkpoints:
  1. Load the page. **Checkpoint 1.**
  2. Open the board name panel from the file bar. **Checkpoint 2.** Close it with its
     Close button.
  3. Open Objects. **Checkpoint 3.**
  4. With the Sticky tool, focus the canvas and press Enter; type `Alpha`; choose Done.
     Repeat with `Beta`. With the Text tool, do the same with `Gamma`. Placing on the
     canvas closes Objects, so open Objects again, then in its list select `sticky 1`
     only. **Checkpoint 4** (context bar shown).
  5. Open the colour control in the context bar. **Checkpoint 5.** Press Escape.
  6. Open the Arrange control. **Checkpoint 6.** Press Escape.
  7. In Objects' list select all three objects. **Checkpoint 7.**
  8. Select `sticky 1` and `sticky 2`; choose Group in Objects. **Checkpoint 8.**
  9. Open the information panel. **Checkpoint 9.** Close it.
  10. Open Navigation. **Checkpoint 10.** Close it.
  11. Name the board `Compare` in the board name panel and choose Save; wait until the
      save status reads "Locally saved". **Checkpoint 11.**
- **Saved record comparison.** After step 11 the reviewer reads the saved head record
  from IndexedDB in each run and checks that `formatVersion` and `storageRevision`
  are equal, that the two `payload` strings are equal after the same UUID replacement,
  and that each record's `sha256` is the SHA-256 of its own `payload` (the digest
  covers the UUIDs, so the digests themselves differ between runs).
- **Chromium and Safari smoke.** Each moved region opened and used once: board name,
  Objects (select, style, move, size, arrange, copy and paste, add), context bar
  (edit, colour, size, alignment, arrange, duplicate, delete), palette, zoom,
  navigation, information, save, notice snapshot button where present.

No browser matrix, fixtures sweep, accessibility audit or IME checks unless the
maintainer asks.

## Exclusions and reasons

Any change in behaviour or appearance; fixes for bugs noticed on the way (report
them); renaming classes, ids or keys; moving the canvas scene, the inline editor,
state, effects or the named functions declared in `App.tsx` (later steps); object
types; document v4; contract changes; new dependencies.

## Public references with retrieval dates

None beyond the repository's own documents.

## Implementation record

Not started.
