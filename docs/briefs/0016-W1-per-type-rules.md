BRIEF VERSION: 0016-W1 v1 (2026-10-25)
# 0016-W1 — Object types own their per-type rules

Status: Draft. Implementation starts only after the maintainer commits this brief
and [0001 web modules v12](../architecture/0001-web-modules-v12.md) to main.

## Outcome

Everything that differs between a sticky and a text object moves into that type's
record under `apps/web/src/objects/`, with no change in behaviour or saved format:

- each type's default size and default style;
- the style an object saved before styles existed (document version 1) gets when it is
  upgraded;
- each type's text colour.

The saved-document rules (`document.ts`) and the style rules (`styles.ts`) stop naming
types: `document.ts` asks the registry for the list of types and for each type's values,
and `styles.ts` keeps only the palette and the rules shared by every type. The two
canvas bodies that draw text ask the registry for the text colour, as they already do
for fill and edge.

A later object type is then one new record (plus a body under `scene/` if it draws
differently) instead of edits in the save code and the style rules. Every element,
attribute, focus move, drawn pixel and saved byte stays as it is at `fab9c76`.

## Read first and prerequisite contracts

- [Contributor guidance](../../CONTRIBUTING.md), [agent instructions](../../AGENTS.md)
  and [engineering standards](../../DESIGN.md).
- [0001 web modules v12](../architecture/0001-web-modules-v12.md): the governing note.
  Its rules are v11's, except that rule 7 loses its two exceptions (the default sizes in
  `document.ts` and the text colour in `styles.ts`) and now covers rules modules, and
  the dependency direction says that object types use `styles.ts` and that rules modules
  may ask the registry.
- [0001 interaction v14](../architecture/0001-interaction-v14.md),
  [0001 document v3](../architecture/0001-document-v3.md),
  [0001 storage v1](../architecture/0001-storage-v1.md) and
  [0001 toolchain v1](../architecture/0001-toolchain-v1.md): unchanged. No new
  dependency.
- [0001-W24 v1](0001-W24-selection-layouts-editor-hooks.md): its comparison procedure is
  reused below.

## Deliverables and boundaries

Line numbers refer to `fab9c76`.

1. **`apps/web/src/objects/sticky.ts`.** The module gains
   `const STICKY_TEXT = "#28272c";` (moved from `styles.ts:33`, not exported) above the
   record. The record gains, in this order around the existing fields:
   - after `tool`: `defaultSize: { width: 240, height: 240 }`,
     `defaultStyle: { color: "rose", textSize: "medium", align: "left" }` and
     `legacyStyle: { color: "rose", textSize: "medium", align: "left" }`;
   - after `edge`: `textColor: (_o: Pick<Style, "color">) => STICKY_TEXT`.

   It stays `as const`. Its imports do not change.
2. **`apps/web/src/objects/text.ts`.** The record gains, in the same places:
   - `defaultSize: { width: 320, height: 120 }`,
     `defaultStyle: { color: "neutral", textSize: "medium", align: "left" }` and
     `legacyStyle: { color: "neutral", textSize: "medium", align: "left" }`;
   - `textColor: (o: Pick<Style, "color">) => colorEntry(o.color).text`.

   Its import becomes `import { colorEntry, type Style } from "../styles.ts";`.

   `legacyStyle` has the same values as `defaultStyle` today, as `LEGACY_STYLES` did. It
   is a separate field so that changing a default later never changes how a version 1
   board reopens.
3. **`apps/web/src/objects/registry.ts`** does not change. `ObjectType`, `OBJECT_TYPES`,
   `objectType` (which throws on an unknown name) and `typeForTool` already provide
   what the other modules need.
4. **`apps/web/src/document.ts`:**
   - Line 3 becomes two imports: `import { OBJECT_TYPES, objectType, type ObjectType }
     from "./objects/registry.ts";` and `import { ALIGNMENTS, COLORS, TEXT_SIZES, type
     Style } from "./styles.ts";`.
   - Line 7: `type: ObjectType["type"];`.
   - Line 72: `!["sticky", "text"].includes(o.type)` becomes
     `!OBJECT_TYPES.some((t) => t.type === o.type)`.
   - Line 139: `LEGACY_STYLES[o.type]` becomes `objectType(o.type).legacyStyle`.
   - Lines 166–167 become `const { width, height } = objectType(type).defaultSize;`.
   - Line 176: `...DEFAULT_STYLES[type],` becomes `...objectType(type).defaultStyle,`.

   Nothing else in `document.ts` changes: validation order, error messages, the
   canonical payload, limits and the adapter stay as they are. `objectType` is reached
   only with a registered name: `upgrade` runs on boards that `validate` accepted, and
   `add` is called only from `create` in `use-geometry-edits.ts` and from
   `use-canvas-input.ts`, whose types come from `typeForTool` (Enter, or a click on the
   canvas, with the Sticky or Text tool armed) or from the Objects panel's list of `OBJECT_TYPES`.
5. **`apps/web/src/styles.ts`:** `DEFAULT_STYLES`, `LEGACY_STYLES` and `STICKY_TEXT`
   (lines 28–33) and `textColor` (36–37) are removed. Everything else stays, including
   `colorEntry`, `textUnits` and `commonStyle`.
6. **`apps/web/src/scene/note-body.tsx`:** the import from `../styles` becomes
   `{ textUnits }`; each of the three `textColor(o)` calls (lines 55 and 59) becomes
   `objectType(o.type).textColor(o)`. `objectType` is already imported.
7. **`apps/web/src/scene/inline-editor.tsx`:** it imports `objectType` from
   `../objects/registry` (after the `../geometry` import); the import from `../styles`
   becomes `{ textUnits }`; `textColor(item)` (line 34) becomes
   `objectType(item.type).textColor(item)`.
8. **Tests:** `tests/objects.test.mjs`, `tests/styles.test.mjs`,
   `tests/document.test.mjs` and `tests/modules.test.mjs`, as listed under validation.

**How the move is done** (web modules v12, "moves are moves"): values move as they are,
and only where each one comes from changes. The exceptions are those stated above:
`STICKY_TEXT` becomes private to `sticky.ts`, `textColor` becomes one function per type,
the size becomes a destructuring of `defaultSize`, and the type check asks the registry.

No other module changes: no `ui/` part, other `scene/` part, state hook, `App.tsx`,
other rules module, `icons.tsx`, `main.tsx`, `style.css`, package files, locks,
contracts or other tests. If something seems to need more, stop and report it.

Append the implementation record below with the branch, validated revision, commands,
results and exclusions; report the final branch tip separately.

## Numbered acceptance criteria

- 0016-W1-AC01: The type modules hold every per-type rule; document.ts and the scene bodies ask the registry, styles.ts holds only the rules shared by every type and never imports object types, and none of them names a type; markup, focus, drawing and saved records identical to fab9c76.
- 0016-W1-AC02: Web modules v12 is published with rule 7's exceptions removed and the dependency direction recorded; the guard test covers the rules modules; the moved values are pinned by unit tests; the unit suite and browser checks pass.

| Criterion | Evidence that shows it |
| --- | --- |
| 0016-W1-AC01 | The modules have the contents listed above; the rules-module check passes; the comparison under validation finds no difference |
| 0016-W1-AC02 | Web modules v12 is on main with this brief; the four test files pass with the new checks; the full unit suite and both browser fixture pages pass |

## Validation commands and expected evidence

From the repository root with the pinned toolchain:

```sh
npm --prefix apps/web ci --ignore-scripts --no-audit --no-fund
npm --prefix apps/web run typecheck
node --test tests/objects.test.mjs tests/styles.test.mjs tests/document.test.mjs tests/modules.test.mjs
npm --prefix apps/web test
npm --prefix apps/web run build
npm --prefix apps/web run build:fixtures
git diff --name-only main...HEAD
```

The full unit suite runs here because the saved-document rules change.

**`tests/objects.test.mjs`** gains:

- the `luminance` and `contrast` helpers, moved from `tests/styles.test.mjs` unchanged,
  and `textUnits` in its import from `styles.ts`;
- one test per colour: `sticky.textColor({ color })` is `"#28272c"` and
  `text.textColor({ color })` is that colour's `text` entry;
- the contrast test moved from `tests/styles.test.mjs`, reading the sticky ink from
  `sticky.textColor(c)` and the text colour from `text.textColor({ color: c.name })`,
  with the same 4.5 thresholds against each fill and against `#fafafa`;
- one test that pins the values literally: `sticky.defaultSize` is
  `{ width: 240, height: 240 }`; `text.defaultSize` is `{ width: 320, height: 120 }`;
  `sticky.defaultStyle` is `{ color: "rose", textSize: "medium", align: "left" }`;
  `text.defaultStyle` is `{ color: "neutral", textSize: "medium", align: "left" }`;
  each `legacyStyle` equals its `defaultStyle`; and the three appearance checks of the
  old defaults test (rose fill `#f2dce5`, rose edge `#e8cdd7`, medium text 18 units),
  read from `sticky.defaultStyle`.

**`tests/styles.test.mjs`** loses what moved: `DEFAULT_STYLES`, `LEGACY_STYLES`,
`STICKY_TEXT` and `textColor` leave its import; the two `textColor` lines leave the
tables test; the helpers, the contrast test and the defaults test leave the file. Its
other checks stay.

**`tests/document.test.mjs`** imports `objectType` from `objects/registry.ts` instead of
`DEFAULT_STYLES`:

- the version 1 upgrade test compares with `objectType("sticky").legacyStyle` and
  `objectType("text").legacyStyle` (lines 117 and 122);
- the style-combinations test compares with `objectType(type).defaultStyle[key]`
  (line 132);
- the atomic style test compares with `objectType("sticky").defaultStyle` (line 185).

**`tests/modules.test.mjs`** keeps its existing checks and adds:

- **Object types do not import other rules.** Every `import` or `export … from` in a
  module under `objects/` names either a sibling (`./<name>.ts`) or `../styles.ts`, and
  `styles.ts` names nothing under `objects/`. This keeps the registry free of a cycle
  with the document rules.
- **Rules modules ask the registry.** The test lists the `.ts` files directly in
  `apps/web/src/` (the rules modules; it asserts that `document.ts` and `styles.ts` are
  among them). A helper, `typeNameUses(source)`, returns the patterns that match:
  - `/\bsticky\b/`: any use of the word, which covers a type union, a list of type names
    and a table keyed by type;
  - `/[=!]==\s*["'](?:sticky|text)["']/` and `/["'](?:sticky|text)["']\s*[=!]==/`: a
    comparison with either type name.

  The test asserts that the list is empty for every rules module. `"text"` as a field
  name (`document.ts` lines 61 and 209–216, `clipboard.ts`) is not a match.

  It also checks the helper on fixed source strings. Each pattern has a sample that only
  it catches:
  - `type: "sticky" | "text";`, `const width = type === "sticky" ? 240 : 320;`,
    `!["sticky", "text"].includes(o.type)` and
    `const DEFAULT = { sticky: { color: "rose" } };` each yield a match;
  - `if (o.type !== "text") return;` yields a match (only the second pattern applies);
  - `if ("text" === o.type) return;` yields a match (only the third applies);
  - `const keys = ["id", "type", "text"];`, `let text = m.get("text");`,
    `objects.map(({ type, text }) => ({ type, text }))` and
    `const STICKY_TEXT = "#28272c";` yield none.

Reviewer checks (not run by the implementer; browsers cannot start there):

- **Regression harness.** The eight PASS lines at the fixture index page and at
  `regressions.html` ([tests README](../../tests/README.md)), in headless Chrome or a
  focused browser window.
- **Markup, focus and drawing comparison.** Scenarios A–J of the 0001-W24 v1 brief's
  comparison, unchanged, under its conditions, recorded values, DOM actions and validity
  rules. Run them on a build of `fab9c76` twice (the two must match exactly) and once on
  the candidate. The candidate must match at every checkpoint, including the saved
  records, with no values set aside.

No browser matrix, Safari check, fixtures sweep, accessibility audit or IME checks
unless the maintainer asks.

## Exclusions and reasons

- Any change in behaviour, appearance or saved format.
- Fixes for bugs noticed on the way (report them).
- New object types, rich text and changes to how loading treats an unknown type.
- Moving `fill` and `edge` (already in the type records) or changing `objectType`.
- Other contract changes and new dependencies.

## Public references with retrieval dates

None beyond the repository's own documents.

## Implementation record
