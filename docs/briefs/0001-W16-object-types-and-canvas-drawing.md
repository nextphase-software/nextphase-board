BRIEF VERSION: 0001-W16 v1 (2026-10-24)
# 0001-W16 — Object types and the canvas drawing

Status: Draft. Implementation starts only after the maintainer commits this brief
and [0001 web modules v2](../architecture/0001-web-modules-v2.md) to main.

## Outcome

Step 2 of the staged move described in web modules v2, with no change in behaviour:

- An **object-type registry** under `apps/web/src/objects/` answers every "is this a
  sticky or a text object?" question that is answered today by comparing type names in
  `App.tsx` and the screen parts.
- The **canvas drawing** (the Konva stage and each object's drawing), the three
  **overlays** (group outlines, resize handles, the selection box) and the **inline
  editor's container** leave `App.tsx` and render from stateless components under
  `apps/web/src/scene/`.

Every element, attribute, drawn pixel, message, focus move and saved byte stays as it
is at `437092b`.

## Read first and prerequisite contracts

- [Contributor guidance](../../CONTRIBUTING.md), [agent instructions](../../AGENTS.md)
  and [engineering standards](../../DESIGN.md).
- [0001 web modules v2](../architecture/0001-web-modules-v2.md): the governing note
  (layers, the rules for every brief, "moves are moves", the registry rule).
- [0001 interaction v14](../architecture/0001-interaction-v14.md),
  [0001 document v3](../architecture/0001-document-v3.md),
  [0001 storage v1](../architecture/0001-storage-v1.md) and
  [0001 toolchain v1](../architecture/0001-toolchain-v1.md): unchanged; they describe
  the behaviour that must stay identical. No new dependency.

## Deliverables and boundaries

1. **The registry**, three new modules in erasable TypeScript that the Node test
   runner can load the way the existing tests load `group.ts` (relative imports with
   explicit `.ts` extensions):

   | File | Exports |
   | --- | --- |
   | `apps/web/src/objects/sticky.ts` | `sticky`: `{ type: "sticky", label: "Sticky", tool: "Sticky", fill, edge }`, where `fill(o)` returns `colorEntry(o.color).fill` and `edge(o)` returns `colorEntry(o.color).edge` |
   | `apps/web/src/objects/text.ts` | `text`: `{ type: "text", label: "Text", tool: "Text", fill, edge }`, where `fill` and `edge` return `undefined` |
   | `apps/web/src/objects/registry.ts` | The `ObjectType` type of those records; `OBJECT_TYPES`, the records in the order sticky, text; `objectType(type)`, the record for a type name; `typeForTool(tool)`, the type name for a tool name. Both lookups throw an `Error` for a value no record has |

   `colorEntry` comes from `styles.ts`; the registry modules import nothing from
   React, react-konva or Konva.

2. **The five replacements.** Each type-name comparison below is replaced by the
   registry lookup shown, which returns exactly the value the comparison produced:

   | Where (at `437092b`) | Today | After |
   | --- | --- | --- |
   | `App.tsx`, canvas rectangle `fill` | `o.type === "sticky" ? colorEntry(o.color).fill : undefined` | `objectType(o.type).fill(o)` |
   | `App.tsx`, canvas rectangle `stroke` (unselected branch) | `o.type === "sticky" ? colorEntry(o.color).edge : undefined` | `objectType(o.type).edge(o)` |
   | `ui/context-bar.tsx`, label | `item.type === "sticky" ? "Sticky" : "Text"` | `objectType(item.type).label` |
   | `ui/objects-panel.tsx`, Add buttons | `(["sticky", "text"] as const).map(…)` | `OBJECT_TYPES.map((t) => t.type).map(…)`, with the same callback |
   | `App.tsx`, Enter placement and pointer placement | `tool === "Sticky" ? "sticky" : "text"` and `d.id === "Sticky" ? "sticky" : "text"` | `typeForTool(tool)` and `typeForTool(d.id)` |

   The tool-name conditions around the placements (`tool === "Sticky" || tool ===
   "Text"`, `d.id === "Sticky" || d.id === "Text"`), the palette's tool list and its
   icons stay as they are. The rows above for `App.tsx` apply where the code is after
   item 3 (the canvas rectangle moves to `scene/note-body.tsx`).

3. **The canvas modules**, four new components in `apps/web/src/scene/`:

   | File | Component | What it renders, from `App.tsx` at `437092b` |
   | --- | --- | --- |
   | `board-drawing.tsx` | `BoardDrawing` | The `<Stage>` element and everything inside it, with each object drawn by `NoteBody` |
   | `note-body.tsx` | `NoteBody` | One object's drawing: the `<Group key={o.id}>` block (rectangle and clipped text) inside the stage's object list, without the key, which moves to `<NoteBody key={o.id} …>` |
   | `overlays.tsx` | `Overlays` | The group outlines, resize handles and selection box that follow the stage inside the canvas element, returned in a fragment |
   | `inline-editor.tsx` | `InlineEditor` | The `<section className="inline">` element and its contents |

   Every current type is drawn by `NoteBody`; the first type that draws differently
   adds its own body and the lookup from type to body.

4. **`App.tsx`:** `BoardDrawing` and `Overlays` are placed where the stage and the
   overlays were inside the canvas element; `InlineEditor` is placed where the inline
   section was, inside the unchanged `inline && item &&` condition. Nothing else in
   `App.tsx` changes apart from the replacements in item 2 and imports.
5. **`tests/modules.test.mjs`** and a new **`tests/objects.test.mjs`**, as listed
   under validation.

**How the move is done** (as in web modules v2, "moves are moves"):

- **Markup and drawing.** Each component returns exactly the elements (and Konva
  nodes) it replaces, in the same order, with the same attributes, ids, classes, keys
  and text, and no added element or Konva node.
- **Components are plain functions of their props.** Declared at module level; no
  React state, effect, memo, callback, reducer, ref or context hooks; no
  `createContext`. Values, handlers, refs (`inlineSurface`), the shared text editor
  element, `objectLayouts`, `pos`, `trackPointer` and the other values they use come in
  as props.
- **Moved, not rewritten.** Inside each moved block the expressions, handlers and
  their order stay as they are, apart from the replacements in item 2; only where each
  name comes from changes. Imports move with the code that uses them.
- **What stays in `App.tsx`:** the canvas element itself (`<div ref={scene}
  className="scene">`) with all its handlers and attributes, all state, refs, effects,
  `objectLayouts`, `displayedObjects`, handle positions, `pos` and every named
  function.
- **No other change.** No change to rules modules (`document.ts`, `styles.ts`,
  `history.ts`, `storage.ts`, `selection.ts`, `resize.ts`, `arrange.ts`, `group.ts`,
  `clipboard.ts`, `geometry.ts`, `view.ts`, `commands.ts`), `icons.tsx`, `main.tsx`,
  any `ui/` file other than `context-bar.tsx` and `objects-panel.tsx`, `style.css`,
  package files, the lock, contracts or existing tests other than
  `tests/modules.test.mjs`. If something seems to need more, stop and report it.

New source files use `SPDX-License-Identifier: Apache-2.0`. Append the implementation
record below with the branch, validated revision, commands, results, the `App.tsx`
line counts before and after, and exclusions; report the final branch tip separately.

## Numbered acceptance criteria

- 0001-W16-AC01: Object types are defined in a registry under apps/web/src/objects/ and shared code no longer branches on a type name; each lookup returns exactly the value the replaced check returned.
- 0001-W16-AC02: The canvas drawing, overlays and inline editor container render from stateless components under apps/web/src/scene/ with markup and canvas pixels identical to 437092b.
- 0001-W16-AC03: Web modules v2 is published and enforced: the guardrail test covers scene/ and objects/, the App.tsx budget is lowered, and the unit suite and browser checks pass unchanged.

| Criterion | Evidence that shows it |
| --- | --- |
| 0001-W16-AC01 | `tests/objects.test.mjs` passes; the type-name check in `tests/modules.test.mjs` finds no comparison in `App.tsx`, `ui/` or `scene/`; the five replacements match the table above |
| 0001-W16-AC02 | The four `scene/` files exist and are placed as described; the markup and canvas comparison under validation finds no difference |
| 0001-W16-AC03 | Web modules v2 is on main with this brief; `tests/modules.test.mjs` passes with the new lists and budget; full unit suite and the browser regression harness pass with no other test changed |

## Validation commands and expected evidence

From the repository root with the pinned toolchain:

```sh
npm --prefix apps/web ci --ignore-scripts --no-audit --no-fund
npm --prefix apps/web run typecheck
node --test tests/objects.test.mjs tests/modules.test.mjs
npm --prefix apps/web test
npm --prefix apps/web run build
git diff --name-only main...HEAD
```

The full unit suite runs here because code shared by every feature moves.

`tests/objects.test.mjs` asserts:

- `OBJECT_TYPES.map((t) => t.type)` equals `["sticky", "text"]`.
- `objectType("sticky").label` is `"Sticky"`, `objectType("text").label` is `"Text"`;
  `typeForTool("Sticky")` is `"sticky"`, `typeForTool("Text")` is `"text"`; each
  lookup throws for a value no record has.
- For every colour in `COLORS`: `sticky.fill({ color })` equals
  `colorEntry(color).fill`, `sticky.edge({ color })` equals `colorEntry(color).edge`,
  and `text.fill({ color })` and `text.edge({ color })` are `undefined`.

`tests/modules.test.mjs` keeps its W15 checks (the twelve `ui/` files, the `ui/` hook,
import and licence rules) and adds:

- **Line budget.** The literal budget for `App.tsx` becomes its newline count after
  this change.
- **Scene parts.** Listing `apps/web/src/scene/` recursively finds exactly the four
  files above. Each file: no match for `/\buse[A-Z]\w*\s*\(/`; no `createContext`;
  every import from `"react"` is type-only; no `import` or `export … from` whose
  module path, after removing a `.ts`, `.tsx`, `.js` or `.jsx` extension, equals `App`
  or ends with `/App`; the first line is `// SPDX-License-Identifier: Apache-2.0`.
- **Object types.** Listing `apps/web/src/objects/` recursively finds exactly the three
  files above. Each file: no import from `"react"`, `"react-konva"` or `"konva"`; the
  same App-import and licence rules.
- **No type-name comparisons in composition or screen parts.** In `App.tsx` and every file under
  `apps/web/src/ui/` and `apps/web/src/scene/`: no match for
  `/===\s*["'](?:sticky|text)["']/`, for `/["']sticky["']\s*:\s*["']text["']/`, or for
  `/\[\s*["']sticky["']\s*,\s*["']text["']\s*\]/`.

Reviewer checks (not run by the implementer; browsers cannot start there):

- **Regression harness.** The eight PASS lines at `regressions.html`
  ([tests README](../../tests/README.md)), run in a browser window that has focus.
- **Markup and canvas comparison.** The procedure below runs on a build of `437092b`
  twice (the two baseline runs must match each other, which shows the procedure is
  repeatable) and once on the candidate, each served on the same origin with the
  board's IndexedDB database deleted first, in a 1280 × 800 viewport, in the same
  browser with the same device pixel ratio and page zoom for every run. The page stays
  visible for the whole run (a run during which the page was hidden is discarded and
  repeated), so animation frames run and Konva finishes drawing. Before checkpoint 1
  the reviewer waits until the Sticky tool button is enabled and the notice no longer
  shows "Opening local board…" or "Checking local storage and writer ownership…". At
  each checkpoint the reviewer waits two animation frames, then takes
  `document.querySelector("main").outerHTML` with every UUID
  (`/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g`) replaced by
  `id-1`, `id-2`, … in order of first appearance, and
  `document.querySelector(".scene canvas").toDataURL()`. The candidate must match the
  baseline at every checkpoint in both. Procedure and checkpoints:
  1. Load the page. **Checkpoint 1.**
  2. Open the board name panel from the file bar. **Checkpoint 2.** Close it with its
     Close button.
  3. Open Objects. **Checkpoint 3.**
  4. With the Sticky tool, focus the canvas and press Enter; type `Alpha`; choose Done.
     Repeat with `Beta`. With the Text tool, do the same with `Gamma`. Placing on the
     canvas closes Objects, so open Objects again, then in its list select `sticky 1`
     only, and wait until the context bar is visible and measured. **Checkpoint 4.**
  5. Open the colour control in the context bar. **Checkpoint 5.** Press Escape.
  6. Open the context bar's Arrange control (the button inside `.arrange-control`).
     **Checkpoint 6.** Press Escape.
  7. In Objects' list select all three objects. **Checkpoint 7.**
  8. Select `sticky 1` and `sticky 2`; choose Group in Objects. **Checkpoint 8.**
  9. Open the information panel. **Checkpoint 9.** Close it.
  10. Open Navigation. **Checkpoint 10.** Close it.
  11. Name the board `Compare` in the board name panel and choose Save; wait until the
      save status reads "Locally saved". **Checkpoint 11.**
  12. Open Objects (the board name panel from step 11 is still open; opening Objects
      replaces it). In Objects' list select `sticky 2` only and choose the colour Teal
      in Objects; then select `text 3` only and choose the colour Violet.
      **Checkpoint 12.**
  13. In Objects' list select `sticky 1` only. Move focus to the canvas element
      without a pointer press (for example with its `focus()` method), which keeps the
      selection, and press Enter; the inline editor's container (`.inline`) must be
      present. **Checkpoint 13.**
- **Saved record comparison.** After step 11 the reviewer reads the saved head record
  from IndexedDB in each run and checks that `formatVersion` and `storageRevision`
  are equal, that the two `payload` strings are equal after the same UUID replacement,
  and that each record's `sha256` is the SHA-256 of its own `payload`.
- **Chromium and Safari smoke.** Stickies and text objects drawn in several colours;
  selection outline; a group's dashed outline; resize handles dragged; box selection;
  inline editing opened and closed; placement with the Sticky and Text tools and with
  Objects' Add buttons.

No browser matrix, fixtures sweep, accessibility audit or IME checks unless the
maintainer asks.

## Exclusions and reasons

Any change in behaviour or appearance; fixes for bugs noticed on the way (report
them); moving the canvas element, its handlers, state, effects, `objectLayouts` or the
named functions declared in `App.tsx` (the next step); per-type saved data; new object
types; palette or icon changes; contract changes; new dependencies.

## Public references with retrieval dates

None beyond the repository's own documents.

## Implementation record

### 2026-10-24 — v1 implementation handoff

- Branch: `codex/0001-W16-object-types`, based on committed main
  `23ead7ac5ed43e38672db44fcc6bc0093f5007d1` in the designated milestone worktree.
- Validated source/test revision: `fd66a9c13e63cbb161dbfda9cf900028df420921`.
  Commands below ran against the source/test tree committed at that revision;
  only this implementation record changes afterward. The final branch tip is
  reported separately in the handoff, rather than claiming this record's commit
  was the tested source revision.
- Implemented the three object-type modules, four stateless scene components,
  the five registry replacements, and the two specified test files. State, refs,
  effects, layouts, named functions and canvas event handlers remain in `App.tsx`.
- `App.tsx` newline counts: **1,379 before; 1,305 after**. The literal module-test
  budget is **1,305**.
- Added dependencies: **none**. No package, lock, style, rules-module, contract or
  other existing test changes.

Commands ran from the repository root. Before every Node/npm invocation, the shell
PATH was prefixed with the maintainer-supplied pinned toolchain directory; that
machine-specific path is intentionally not recorded here.

| Exact command | Result |
| --- | --- |
| `node --version` | Exit 0; `v24.22.1` |
| `npm --version` | Exit 0; `11.19.1` |
| `npm --prefix apps/web ci --ignore-scripts --no-audit --no-fund` | Exit 0; 19 packages installed |
| `node --test tests/objects.test.mjs` | Exit 0; 10 passed, 0 failed (registry slice) |
| `npm --prefix apps/web run typecheck` | Exit 0 |
| `node --test tests/objects.test.mjs tests/modules.test.mjs` | Exit 0; 19 passed, 0 failed |
| `npm --prefix apps/web test` | Exit 0; 233 passed, 0 failed, 0 skipped |
| `npm --prefix apps/web run build` | Exit 0; accepted lock, runtime inventory and distributed notices verified; application built |
| `git diff 437092b..23ead7a --stat -- apps/web/src tests/modules.test.mjs` | Exit 0; empty (the starting source and module test match the drawing baseline) |
| `git diff --check` | Exit 0; no whitespace errors |
| `git diff --cached --check` | Exit 0 before each implementation commit; no whitespace errors |
| `git diff --name-only main...HEAD` | Exit 0 at the validated revision; exactly the 12 allowed source/test deliverables |

Source inspection compared each extracted block with `437092b`, ignoring moved
indentation and applying only the required registry substitutions and `NoteBody`
placement. The four blocks matched. Reinserting the original blocks and reversing
the two placement lookups reproduced the entire `App.tsx` body from `const CORNERS`
onward exactly. The changed-file allowlist and resulting newline count also matched.
This source inspection is not browser markup, pixel or saved-record evidence.

Normal Git/privacy hooks ran and reported `PUBLIC BOUNDARY: PASS`; no hooks were
bypassed. Git also emitted a non-fatal permission error while attempting to lock
packed refs; both implementation commits succeeded. Graph discovery and indexing
were attempted first but rejected because the MCP tools require approval and the
session disallows approval; file reads were used as the fallback.

Exclusions: no browsers were launched and no browser regression harness was run,
as instructed by the maintainer. The eight regression PASS lines, repeated-baseline
markup/canvas comparison, saved-record comparison, and Chromium/Safari smoke checks
remain for the independent reviewer. No browser matrix, fixtures sweep,
accessibility audit, IME, performance or unrelated checks ran. AC02's visual equality
and AC03's browser portion remain unverified pending that review. No merge or push.
