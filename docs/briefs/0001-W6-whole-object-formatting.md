BRIEF VERSION: 0001-W6 v1 (2026-10-25)
# 0001-W6 — Bold, italic and strikethrough for whole objects

Status: Draft. Implementation starts only after the maintainer commits this brief,
[0001 document v4](../architecture/0001-document-v4.md),
[0001 interaction v15](../architecture/0001-interaction-v15.md) and
[0001 web modules v13](../architecture/0001-web-modules-v13.md) to main.

## Outcome

A sticky or text object's text can be made **bold**, *italic* or ~~struck through~~,
in any combination, from three buttons in the selection context bar and in Objects.
The buttons format whole selected objects. The formatting:
- is saved as document v4 `marks` beside the unchanged plain `text`;
- is drawn on the canvas, and changes height growth when bold text needs more lines;
- stays on the same characters while text is edited;
- is undone and redone as one step;
- is copied, pasted and duplicated with its object.

The system clipboard stays plain text. Older boards open unchanged. Formatting part of
the text while editing is the next step (0001-W26), and not part of this brief.

Everything that is not formatted behaves, looks and is saved as at `333e9f4`, apart from
the three new buttons in each place, and the saved version number and empty `marks`.

## Read first and prerequisite contracts

- [Contributor guidance](../../CONTRIBUTING.md), [agent instructions](../../AGENTS.md)
  and [engineering standards](../../DESIGN.md).
- [0001 document v4](../architecture/0001-document-v4.md): the saved format, upgrade and
  adapter rules.
- [0001 interaction v15](../architecture/0001-interaction-v15.md): the controls, pressed
  state, activation, availability, drawing, how marks follow text edits, clipboard and
  history.
- [0001 web modules v13](../architecture/0001-web-modules-v13.md): the module inventory;
  v12's rules unchanged.
- [0001 storage v1](../architecture/0001-storage-v1.md) and
  [0001 toolchain v1](../architecture/0001-toolchain-v1.md): unchanged. No new dependency.
- [0001-W24 v1](0001-W24-selection-layouts-editor-hooks.md): its comparison procedure is
  reused below.

## Deliverables and boundaries

Paths are under `apps/web/` unless they start with `tests/`. "Today" means `333e9f4`.

1. **New rules module `src/marks.ts`:**
   - `FLAGS = ["bold", "italic", "strike"] as const`, `type Flag`, and
     `FLAG_LABELS: Record<Flag, string>` = Bold, Italic, Strikethrough.
   - `type Mark = { start: number; end: number; bold?: true; italic?: true; strike?: true }`.
   - `validMarks(value, length)`: true exactly for document v4's normalized form, including
     the 1,000-mark limit.
   - `normalize(marks, length)`: the normalized marks giving each code point the union of
     the flags of the marks covering it, clipped to the text.
   - `toggle(marks, length, start, end, flag)`: if any code point in `[start, end)` lacks
     the flag, add it to all of them; otherwise remove it from all of them. An empty range
     returns the normalized marks unchanged.
   - `formatted(marks, length, flag)`: true when `length > 0` and every code point has the
     flag.
   - `remap(marks, before, after)`: interaction v15's rule, in code points:
     - first the longest common start of the two texts;
     - then the longest common end within what remains of both texts after that start;
     - code points of the old text in neither are removed, with their flags;
     - each inserted code point takes the flags the old text has at the code point just
       before the change, or, when the change is at the very start, at the old text's
       first code point (none if the old text is empty).

     Equal texts return the marks; no marks return `[]`.

   All results are normalized.
2. **New rules module `src/text-runs.ts`:**
   - `type RunStyle`, `Piece = { text, style, x, width }`, `RunLine = { width, pieces }`,
     and `Measure = (text, style) => number`.
   - `graphemes(text)`: the canvas library's own grapheme split. That is
     `Intl.Segmenter(undefined, { granularity: "grapheme" })` where available, otherwise
     Konva's fallback expression
     `/\p{RI}\p{RI}|\P{M}(?:\p{M}|\p{Emoji_Modifier}|️|‍\P{M})*|\p{M}+/gu`.
   - `layoutRuns(text, marks, maxWidth, measure)`, which mirrors Konva 10.9's `Text`
     word wrap, per paragraph (split on `\n`), over graphemes:
     - Each grapheme takes the flags of its first code point. The width of a span is the
       sum of `measure` over its runs of equal style.
     - A paragraph whose width is at most `maxWidth` is one untrimmed line.
     - Otherwise, repeat:
       - take the longest prefix that fits;
       - if none fits, stop the paragraph;
       - if it is the rest, add it untrimmed;
       - if the grapheme after it is not a break, move it back to just after the last
         break in it, when there is one;
       - add it with trailing whitespace graphemes removed;
       - skip whitespace graphemes before the next line.
     - A **break** is exactly the grapheme `" "` (U+0020) or `"-"` (U+002D), as in Konva;
       an en dash or a no-break space is not one. A **whitespace grapheme** is one whose
       JavaScript `trim()` is empty, which is Konva's `trimRight` and skip rule.
     - Each line holds its pieces (runs of equal style), each with its `x` and `width`
       within the line.
   - `lineOffset(align, maxWidth, lineWidth)`: 0, half the free width, or all of it.
3. **`src/document.ts`** (document v4):
   - It imports `validMarks` and `type Mark` from `./marks.ts`.
   - New types: `ItemV4 = ItemV3 & { marks: Mark[] }` and `BoardV4`. `Item` and `Board`
     include them, and `schemaVersion` may be 1–4.
   - `validate`:
     - It accepts version 4.
     - Object keys add `group` for versions 3 and 4, and `marks` for version 4.
     - For version 4 it throws `"Invalid marks"` unless
       `validMarks(o.marks, count(o.text))`, checked after the style check.
     - The group check runs for versions 3 and 4.
   - `canonical`: `group` for versions 3 and 4, then, for version 4, `marks` with each
     mark's keys in document v4's order (a `markOf` helper beside `styleOf`).
   - `upgrade` returns `BoardV4`:
     - a version 4 board is returned as it is;
     - otherwise each object gets the legacy style (version 1) or its own style, keeps
       its `group` (version 3) or gets `null`, and gets `marks: []`.
   - `empty()` is version 4, and `add` gives the new object `marks: []` after `group`.
   - The adapter sets a `marks` map entry beside `style`, only when it changed (compared
     as JSON of the canonical marks), in the same transaction.
4. **Type rename, mechanical.** Every import or use of `ItemV3` or `BoardV3` outside
   `document.ts` becomes `ItemV4` or `BoardV4`. That covers twenty-two modules today:
   - rules modules `context-bar-position.ts`, `group.ts`, `clipboard.ts` and `gesture.ts`;
   - `ui/board-panel.tsx`, `ui/objects-panel.tsx`, `ui/context-bar.tsx` and
     `ui/content-field.tsx`;
   - `scene/board-drawing.tsx`, `scene/inline-editor.tsx` and `scene/note-body.tsx`;
   - every `state/` hook that imports them (`use-board-document`, `use-canvas-input`,
     `use-command-reasons`, `use-editing-commands`, `use-editor-placement`,
     `use-geometry-edits`, `use-object-layouts`, `use-page-keys`, `use-selection`,
     `use-storage-session` and `use-validity`).

   Nothing else in those lines changes.
5. **`src/clipboard.ts`:** `buildSnapshot` copies `marks` with the other fields (after
   `group`). `buildPaste` already spreads each object.
6. **`src/state/use-geometry-edits.ts`:** `commitText` also sets
   `marks: remap(o.marks, o.text, value)` on the changed object, in the same object update.
7. **`src/state/use-object-layouts.ts`:**
   - A measuring helper keeps one Konva `Text` per font style and size (`TEXT_LAYOUT`
     with `fontStyle`: "normal", "bold", "italic" or "italic bold"). It returns
     `measureSize(text).width`.
   - `runLines(object, text = object.text)`: the object's marks, remapped to `text` when
     it differs from `object.text`; `null` when there are none; otherwise
     `layoutRuns(text, marks, object.width − 2 × TEXT_INSET, measure)` at the object's
     text size.
   - `lineCount` returns `max(1, runLines.length)` when there are runs, and today's Konva
     count otherwise.
   - Each object layout gains `runs: runLines(o)`.
8. **`src/scene/note-body.tsx`:**
   - `ObjectLayout` gains `runs: RunLine[] | null`. Without runs the `Text` node is drawn
     exactly as today.
   - With runs, inside the same clip group, each piece of line *i* is one `Text` node with:
     - `fontFamily`, `lineHeight` and the object's `fontSize`;
     - `fontStyle` from the piece ("italic bold" when both), and `textDecoration`
       "line-through" when struck;
     - x at `o.x + TEXT_INSET + lineOffset(o.align, o.width − 2 × TEXT_INSET, line.width) + piece.x`;
     - y at `o.y + TEXT_INSET + i × fontSize × lineHeight`;
     - the piece's text and the object's text colour;
     - the fade as today, with its start and end points moved up by the line's top.
9. **`src/state/use-selection.ts`:** returns `selectionFormats: Record<Flag, boolean>`.
   A flag is true when at least one selected object has non-empty text and every such
   object is `formatted` for it.
10. **`src/state/use-editing-commands.ts`:** returns `toggleFormat(flag)`. It returns at
    once when `selectionReason` is set. Otherwise:
    - it ends the text session and closes the inline editor, as `changeStyle` does;
    - the targets are the selected objects with non-empty text. If all are already
      `formatted` it removes the flag, otherwise it adds it, toggling over each whole text
      only where needed;
    - each changed object gets `savedHeight(next, lineCount(next), textUnits(next.textSize))`;
    - it commits with history recorded.
11. **`src/ui/context-bar.tsx`:**
    - New props `selectionFormats` and `toggleFormat`.
    - After the alignment group, a `<span className="formats" role="group"
      aria-label="Formatting">` holds three icon buttons in `FLAGS` order. Each has
      `aria-label` and title from `FLAG_LABELS` (title is `selectionReason` when set),
      `aria-pressed` from `selectionFormats`, the same `disabled` and
      `aria-describedby` as the alignment buttons, the same tooltip span, and a click that
      focuses the button and calls `toggleFormat`.
12. **`src/ui/objects-panel.tsx`:**
    - The same two props.
    - Inside `object-styles`, after the Alignment select: a
      `<span id="object-formats-label">Formatting</span>`, then a
      `<span className="object-formats" role="group" aria-labelledby="object-formats-label">`
      holding three native buttons labelled from `FLAG_LABELS`, with `aria-pressed`, the
      same `disabled`, `title` and `aria-describedby` as the selects, and a click that
      focuses the button and then calls `toggleFormat` (interaction v15's focus rule).
13. **`src/icons.tsx`:** three original glyphs, `bold`, `italic` and `strike`, in the
    existing 20 × 20 stroke style.
14. **`style.css`:** `.formats` joins the `.alignments, .colour-control` rule, and a new
    rule `.object-formats { display: flex; gap: 8px; flex-wrap: wrap; }` follows
    `.object-styles`.
15. **`src/App.tsx`:**
    - destructures `selectionFormats` from `useSelection` and `toggleFormat` from
      `useEditingCommands`;
    - passes both to `ContextBar` and `ObjectsPanel`;
    - adds one line per element: two placement lines (web modules rule 2), so `App.tsx` grows by two.
16. **Tests**, as listed under validation: new `tests/marks.test.mjs` and
    `tests/text-runs.test.mjs`; changes to `tests/document.test.mjs`,
    `tests/storage.test.mjs`, `tests/clipboard.test.mjs` and `tests/modules.test.mjs`.

No other module changes: no other `ui/`, `scene/` or `state/` module, `objects/`,
`history.ts`, `storage.ts`, `styles.ts`, `geometry.ts`, other rules modules, `main.tsx`,
packages, locks, other contracts or other tests. If something seems to need more, stop
and report it.

New source files use `SPDX-License-Identifier: Apache-2.0`. Append the implementation
record below with the branch, validated revision, commands, results and exclusions;
report the final branch tip separately.

## Numbered acceptance criteria

- 0001-W6-AC01: Apply the selected inline formatting subset through native text-compatible editing controls.
- 0001-W6-AC02: Persist formatted content with a declared plain-text and older-document read path.
- 0001-W6-AC03: Keep text selection, composition and undo scoped to the affected edit without silently dropping original content.

| Criterion | Evidence that shows it |
| --- | --- |
| 0001-W6-AC01 | Bold, Italic and Strikethrough buttons in the context bar and Objects (native buttons, keyboard route) format whole objects and show their state; formatted text is drawn and wraps as the canvas library wraps that font (scenario K) |
| 0001-W6-AC02 | Document v4 keeps `text` whole and adds normalized `marks`. Versions 1–3 read and upgrade byte for byte (unit tests), formatting survives save and reopen (K), and the system clipboard stays plain text |
| 0001-W6-AC03 | Marks follow text edits by the remap rule (unit tests; K typing at the end). Formatting is one undoable step (K), the buttons are unavailable while composing (K), and no character is ever removed by formatting (`text` unchanged) |

## Validation commands and expected evidence

From the repository root with the pinned toolchain:

```sh
npm --prefix apps/web ci --ignore-scripts --no-audit --no-fund
npm --prefix apps/web run typecheck
node --test tests/marks.test.mjs tests/text-runs.test.mjs tests/document.test.mjs tests/storage.test.mjs tests/clipboard.test.mjs tests/modules.test.mjs
npm --prefix apps/web test
npm --prefix apps/web run build
npm --prefix apps/web run build:fixtures
git diff --name-only main...HEAD
```

The full unit suite runs here because the saved format changes.

**`tests/marks.test.mjs`** (new):
- `FLAGS` and `FLAG_LABELS` order and labels.
- `validMarks` accepts `[]` (length 0), two touching marks with different flags, and one
  mark with all three flags.
- It rejects each of:
  - a non-array or an object;
  - an empty, reversed, too-long, negative or fractional range;
  - a mark without flags, or with `false` or a non-`true` value;
  - an unknown key, or a missing `start`;
  - unsorted, overlapping, or touching-with-equal-flags marks;
  - an array entry that is not an object;
  - 1,001 marks.
- `normalize` merges touching equal marks, splits overlaps into combined flags, and
  returns `[]` for `[]`.
- `toggle` adds over a partly formatted range, removes over a fully formatted range,
  leaves an empty range unchanged, and keeps other flags.
- `formatted` is true for full cover, and false for partial cover, another flag or
  empty text.
- `remap` covers:
  - an insertion before, inside, after and right after the span;
  - deletions inside, across the start and of the whole span;
  - a code point offset after an astral character;
  - an insertion at the start taking the first character's flags;
  - no marks, equal texts, and a result that is valid for the empty text;
  - overlap of the common start and end: `"aa"` → `"a"` keeps the first character's
    flags (bold on the first gives `[{0,1,bold}]`; bold on the second gives `[]`);
  - a replacement: `"abc"` → `"aXc"` drops the old middle character's flags, and `X`
    takes the flags of `a`.

**`tests/text-runs.test.mjs`** (new), with a measure that gives each grapheme width 10,
or 12 when bold:
- Unformatted wrapping:
  - a fitting paragraph;
  - a break at a space;
  - a break after a dash;
  - a long word broken between characters (`"one-two three"` at width 45 gives
    `one-`, `two`, `thre`, `e`; `"abcdefghij"` gives `abcd`, `efgh`, `ij`);
  - an empty paragraph, and empty text giving one empty line;
  - runs of spaces dropped at a break, and leading spaces kept;
  - nothing fitting giving no lines;
  - an en dash not being a break while a hyphen-minus is: `"ab–cdef"` at width 45 gives
    `ab–c`, `def`, and `"ab-cdef"` gives `ab-`, `cdef`;
  - a tab at a break dropped (`"abc\tdef"` at width 35 gives `abc`, `def`).
- Pieces with style, `x` and `width`.
- Bold text wrapping sooner than the same text unformatted.
- Marks across a paragraph break keeping code point offsets.
- A mark inside a family emoji cluster not splitting it.
- `lineOffset` for left, centre and right.

**`tests/document.test.mjs`:**
- The version helpers also strip `marks`; a `v3` helper is added; the version loop runs
  1–4; the "unknown version" mutation uses 5.
- Upgrades and `empty`/`add` expect version 4 and empty marks.
- The key-order checks include `group` for 3 and 4, and `marks` for 4. The
  style-combination test also checks a v3 copy.
- "Exact bytes survive decoding" runs for versions 1, 2 and 3 with the in-memory v4
  upgrade.
- The group key-order test lists `marks`.
- A new v4 marks test:
  - a valid round trip;
  - canonical order independent of input key order, with mark keys `start`, `end`,
    `bold`, `italic`, `strike`;
  - four unnormalized or invalid mark arrays rejected with "Invalid marks", and a missing
    `marks` rejected;
  - the adapter: `marks` is `[]` after `set`, and changing marks is one transaction that
    changes only the `marks` key.

**`tests/storage.test.mjs`:** its version helpers also strip `marks`; the unknown version
is 5; the grouped head is read back as version 4.

**`tests/clipboard.test.mjs`:** copying keeps each object's marks, pasting gives the copies
the same marks, the plain text is unchanged, and the pasted board validates.

**`tests/modules.test.mjs`:**
- The `App.tsx` budget becomes 261 (two placement lines).
- A new check: no `.ts` file directly in `apps/web/src/` (the rules modules, including
  the two new ones) imports `react`, `react-dom`, `react-konva` or `konva`.

The existing checks keep covering type names in rules modules, the unchanged
screen-part and state inventories, and the composition guard.

Reviewer checks (not run by the implementer; browsers cannot start there):

- **Regression harness.** The eight PASS lines at the fixture index page and at
  `regressions.html` ([tests README](../../tests/README.md)), in headless Chrome or a
  focused browser window.
- **Previous behaviour.** Scenarios A–J of the 0001-W24 v1 brief's comparison,
  unchanged, run once on a build of `333e9f4` (or reusing two identical earlier runs of
  it) and once on the candidate. They must match at every checkpoint in markup, focus,
  canvas drawing and saved records once only these expected differences are set aside:
  - the Formatting group in the context bar and in Objects;
  - the context bar's horizontal position and the Arrange menu's offset in it, which
    follow the bar's new width;
  - focus paths into the context bar after the new group, shifted by one;
  - saved records written as version 4 with `"marks":[]` on every object.

  Any other difference fails.
- **Scenario K** (new behaviour), in a fresh context, with real mouse and keyboard
  input:
  - Name a board. Place a sticky whose text is a long two-paragraph text (Latin, Chinese,
    an emoji) and a text object whose text is `Plain then strike`.
  - Select the sticky. The buttons start unpressed and available. Bold from the context
    bar: pressed, every drawn piece bold, and the drawn lines equal the lines Konva gives
    for the same text in bold at the same width.
  - Undo: the single unformatted text node returns. Redo: bold again.
  - Italic from Objects: pressed in Objects and the context bar, pieces "italic bold".
  - From the context bar:
    - Italic removes it (pieces "bold"), and again adds it back;
    - Bold removes it (pieces "italic"), and again adds it back.
  - In Objects, by keyboard on its native buttons:
    - Bold by Space removes it (unpressed, focus stays on Bold, pieces "italic"), and
      Space again adds it back;
    - Italic by Enter removes it (pieces "bold"), and Enter again adds it back.
  - Edit the sticky and append text: saved marks cover the whole new text with bold and
    italic, and the record is version 4.
  - Shift-select the text object. Strikethrough from the context bar: pressed, and the
    text object is drawn struck through. Again: removed from both (unpressed, not
    struck). Again: added back.
  - In Objects:
    - Strikethrough removes it from both (unpressed in both places), and again adds it
      back.
    - Bold is unpressed for the mixed selection. Bold adds it to the text object
      (pressed); Undo takes that back.
  - Select both again. Copy and Paste: the copies' marks equal their originals'.
  - Open the text object's editor. Start a composition and add `!`: Bold is unavailable.
    End the composition: the adopted text `Plain then strike!` is struck through over all
    18 code points. Undo restores `Plain then strike` struck through over all 17.
  - Save and reload: the sticky is drawn italic bold and struck through. No dialogs.

  That is 33 checks.

The maintainer checks scenario K's formatting, Undo and reopening in Safari. No browser
matrix, fixtures sweep, accessibility audit or native IME check unless the maintainer
asks.

## Exclusions and reasons

- Formatting part of the text while editing, and keyboard shortcuts for formatting
  (0001-W26).
- Lists, links, underline, per-word colour or size.
- WYSIWYG editing in the text field.
- Rich text on the system clipboard.
- Fixes for bugs noticed on the way (report them).
- New dependencies and contract changes beyond the three named.

## Public references with retrieval dates

None beyond the repository's own documents. Konva 10.9's `Text` behaviour (word wrap,
grapheme split, `fontStyle`, `textDecoration`, `measureSize`) is read from the locked
dependency in the repository.

## Implementation record

### 2026-10-25 — v1 implementation and non-browser validation

- Branch: `codex/0001-W6-whole-object-formatting`, in the milestone worktree,
  based on committed main `647d8a4637d4bd62ff8f86133b589c2c56effa5d`.
  That revision contains this v1 brief, document v4, interaction v15 and web
  modules v13. Only this milestone is implemented.
- Validated source/test revision: `b83f0bf9c4c9ea514abaa564d65265c995d5ca31`
  (`feat(web): add whole-object text formatting`). The checks below ran on
  identical source/test contents immediately before that commit. Only this
  implementation record changes afterward; the final branch tip is reported
  separately in the handoff.
- Added the two pure rules modules: normalized code-point marks, validation,
  whole-range toggling and edit remapping; and grapheme-based run layout with
  the locked Konva 10.9.0 segmentation, wrapping and whitespace rules. Runs
  retain their individual font measurements, positions and alignment offsets.
- Document v4 validates and canonically serializes marks. Versions 1–3 retain
  their exact original canonical bytes; editing upgrades them in memory to v4
  with empty marks, preserving existing styles and groups. The adapter stores
  canonical marks only when changed, alongside style in the same transaction.
- Both formatting groups expose Bold, Italic and Strikethrough with pressed
  state, existing availability reasons and button focus. Commands finish text
  sessions, preserve selection and plain text, record one history step and
  adopt any required height growth. Committed text edits remap marks in the
  same object update. Object copies retain marks; system clipboard text is
  unchanged. Formatted canvas pieces use their font style, strike, line
  alignment and line-relative fade. The unformatted drawing and measurement
  paths are retained.
- The twenty-two named modules use the v4 types. Fourteen modules with no
  additional behavior changes were compared against the base after only the
  permitted type-name substitutions; their remaining contents match exactly.
  `App.tsx` has **261 newlines**, up from **259**, with the two new prop
  placement lines. State and screen-part inventories are unchanged.
- Only the brief's allowed source/style files and six named test files changed
  in the validated revision. The later documentation change is confined to
  this implementation record. Dependencies added: **none**; packages, locks,
  other contracts and all other tests are unchanged. Installed dependencies
  and generated application/fixture builds are ignored and uncommitted.

The initial shell resolved Node `v26.11.1` / npm `11.20.0`. Its first install
exited 0 with an `EBADENGINE` warning. The pinned distribution was then selected
in `PATH`, and installation was repeated successfully with Node **24.22.1** /
npm **11.19.1**. All typechecking, tests, builds and commit hooks used that pinned
distribution. No machine-specific toolchain path is part of the implementation.

Commands ran from the repository root. Test output was captured in disposable
logs outside the repository; the table gives the exact validation invocations.

| Exact command | Result |
| --- | --- |
| `node --version` | Exit 0; initially `v26.11.1`, then pinned `v24.22.1` |
| `npm --version` | Exit 0; initially `11.20.0`, then pinned `11.19.1` |
| `npm --prefix apps/web ci --ignore-scripts --no-audit --no-fund` | Exit 0 on both invocations; 19 packages installed each time. Initial engine warning superseded by the pinned installation |
| `npm --prefix apps/web run typecheck` | Exit 0 on both invocations; no diagnostics |
| `node --test tests/marks.test.mjs tests/text-runs.test.mjs tests/document.test.mjs tests/storage.test.mjs tests/clipboard.test.mjs tests/modules.test.mjs` | Exit 0; **134 passed, 0 failed, 0 skipped** |
| `npm --prefix apps/web test` | Exit 0; **334 passed, 0 failed, 0 skipped** |
| `npm --prefix apps/web run build` | Exit 0; application built; accepted lock, runtime inventory and complete distributed notices verified |
| `npm --prefix apps/web run build:fixtures` | Exit 0; disposable fixtures built; accepted lock, runtime inventory and complete distributed notices verified |
| `git diff --check` | Exit 0; no whitespace errors |
| `git diff --cached --check` | Exit 0; no staged whitespace errors |
| `git commit -m 'feat(web): add whole-object text formatting'` | Exit 0; validated revision above created; both public-boundary hooks passed. Git also emitted a permission error for its packed-refs lock; the commit and branch ref were verified afterward. No hook was bypassed |
| `git rev-parse HEAD refs/heads/codex/0001-W6-whole-object-formatting main` | Exit 0; HEAD and milestone ref both equal the validated revision above; main remains the base revision above |
| `git diff --name-only main...HEAD` | Exit 0 after the source/test commit; exactly the 34 permitted implementation/test files. The final handoff additionally includes this brief's implementation record |
| `git status --short` | Exit 0; clean after the source/test commit |

Not run, per maintainer instruction and the environment's browser limitation:
any browser, the browser regression harness, either fixture page's runtime
checks, the A–J comparisons against two `333e9f4` baseline runs and the candidate,
and scenario K. The reviewer retains those checks, including button keyboard
activation/focus, mixed selections, composition, canvas/Konva wrap comparison,
Undo/Redo, copy/paste and saved-format reopening. Safari formatting, Undo and
reopening also remain for the maintainer. Fixture compilation is not a browser
fixture pass. Browser-dependent acceptance remains pending; no browser matrix,
accessibility audit, native IME, performance/load or unrelated acceptance sweep
was run.

Graph discovery and indexing were attempted first; both tools required approval
under a never-approve policy and were unavailable. Direct file reads were used
as the discovery fallback. No unrelated work was present or changed. No stash,
hook bypass, push or merge was performed. Independent review of the exact
revision remains pending; this handoff does not authorize a merge or another
milestone.
