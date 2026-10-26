BRIEF VERSION: 0001-W26 v1 (2026-10-26)
# 0001-W26 — Format selected text while editing

Status: Draft. Implementation starts only after the maintainer commits this brief,
[0001 interaction v16](../architecture/0001-interaction-v16.md) and
[0001 web modules v14](../architecture/0001-web-modules-v14.md) to main.

## Outcome

While an object's text is being edited, the characters selected in the Content field or
the on-canvas editor can be made **bold**, *italic* or ~~struck through~~:
- with the three buttons (context bar and Objects);
- or with Cmd/Ctrl+B, Cmd/Ctrl+I and Cmd/Ctrl+Shift+X.

The editor stays open with its focus and selection. The buttons show the selection's
state, and Objects shows a formatted preview under the Content field. With only a caret, or
when not editing, the controls format whole objects as in 0001-W6. On the canvas, the
shortcuts format whole selected objects.

The saved format is unchanged (document v4). Boards without formatting look and behave
exactly as at `c211dee`.

## Read first and prerequisite contracts

- [Contributor guidance](../../CONTRIBUTING.md), [agent instructions](../../AGENTS.md)
  and [engineering standards](../../DESIGN.md).
- [0001 interaction v16](../architecture/0001-interaction-v16.md): when text is being
  edited, the selection rule, focus, pressed state, shortcuts, the preview and history.
- [0001 web modules v14](../architecture/0001-web-modules-v14.md): the module inventory;
  v12's rules unchanged.
- [0001 document v4](../architecture/0001-document-v4.md), [0001 storage v1](../architecture/0001-storage-v1.md)
  and [0001 toolchain v1](../architecture/0001-toolchain-v1.md): unchanged. No new
  dependency.
- [0001-W6 v1](0001-W6-whole-object-formatting.md): its scenario K is re-run unchanged,
  and its comparison procedure is reused.

## Deliverables and boundaries

Paths are under `apps/web/` unless they start with `tests/`. "Today" means `c211dee`.

1. **`src/marks.ts`** gains:
   - `type TextSelection = { id: string; start: number; end: number }`: a text field's
     selection in code points for the object `id`.
   - `formattedRange(marks, length, start, end, flag)`: true when `end > start` and every
     code point in `[start, end)` (clipped to the text) has the flag.
   - `codePointOffset(text, unit)`: the number of code points in `text.slice(0, unit)`.
   - `segments(text, marks)`: the text split into consecutive runs of equal flags, each
     `{ text, bold?, italic?, strike? }` with only true flags present. Unformatted runs are
     included, so the runs join back to `text`. Empty text gives `[]`.
2. **`src/state/use-text-entry.ts`** also owns
   `textSelection: TextSelection | null` (initially `null`) and returns it with
   `setTextSelection`. It imports the type from `../marks`.
3. **`src/ui/content-field.tsx`**:
   - Two new props: `setTextSelection` and `toggleFormat`.
   - A local `track(e)` sets the selection for the current item from the textarea's
     `selectionStart` and `selectionEnd`, converted with `codePointOffset`. It runs on
     focus (after `beginTextSession`) and on `onSelect`.
   - `onKeyDown`: only when not `composing` and not `nativeEvent.isComposing`, with Cmd or
     Ctrl held and without Alt, and the key (lower-cased) is `b` without Shift (bold), `i`
     without Shift (italic) or `x` with Shift (strike). It then calls `preventDefault()`
     and `toggleFormat(flag)`. Otherwise it does nothing.
   - `onBlur` calls `setTextSelection(null)` and then runs today's blur handling unchanged.
4. **`src/state/use-editing-commands.ts`**:
   - New input: `editor`.
   - `toggleFormat(flag)`:
     - It returns when `selectionReason` is set, then calls `finishTextSession()`.
     - The selected object is **being edited** when `editor.current` is
       `document.activeElement` and exactly one object is selected.
     - Its range is read live from the field's `selectionStart` and `selectionEnd`,
       converted with `codePointOffset`.
     - Being edited with `end > start`: it toggles the flag over `[start, end)` on that
       object with `toggle`, applies `savedHeight`, commits with history and returns. The
       inline editor stays open.
     - Otherwise it runs 0001-W6's whole-object path, except that it calls
       `setInline(false)` only when the object is not being edited.
5. **`src/state/use-selection.ts`**:
   - New input: `textSelection`.
   - While the single selected item is the selection's `id` and `end > start`, each flag of
     `selectionFormats` is `formattedRange(item.marks, count(item.text), start, end, flag)`.
     Otherwise it is computed as today.
6. **`src/state/use-page-keys.ts`**:
   - New input: `toggleFormat`.
   - Inside the existing Cmd/Ctrl block, before the copy, cut and paste check, it handles
     only when the target is the scene, not `composing` and not `nativeEvent.isComposing`:
     `b` without Shift, `i` without Shift, and `x` with Shift call `preventDefault()` and
     `toggleFormat(flag)`. `x` without Shift stays Cut.
7. **`src/ui/context-bar.tsx` and `src/ui/objects-panel.tsx`**:
   - Each formatting button gets `onMouseDown={(e) => e.preventDefault()}`, so pressing it
     with the pointer leaves focus in a text field being edited.
   - Its click focuses the button only when `document.activeElement` is not a textarea,
     then calls `toggleFormat`.
   - `objects-panel.tsx` also takes `item` and `text`, and renders
     `<FormatPreview item={item} text={text} />` right after the native editor when exactly
     one object is selected and `item` is set.
8. **New screen part `src/ui/format-preview.tsx`**, `FormatPreview({ item, text })`:
   - The marks are `item.marks` when `text === item.text`, otherwise
     `remap(item.marks, item.text, text)`. With no marks it renders nothing.
   - Otherwise it renders `<p className="format-preview" aria-hidden="true">` with one
     `<span>` per `segments(text, marks)` run. Each span is styled `fontWeight: 700`,
     `fontStyle: "italic"` and `textDecoration: "line-through"` as its flags say, with no
     style for unset flags.
   - React is imported only for types (none needed).
9. **`style.css`:** a rule after `.object-formats`:
   `.format-preview { margin: 0; white-space: pre-wrap; overflow-wrap: anywhere; font-size: 13px; color: #4b4752; }`.
10. **`src/App.tsx`:**
    - It destructures `textSelection` and `setTextSelection` from `useTextEntry`, passes
      `textSelection` to `useSelection`, `editor` to `useEditingCommands`, and
      `toggleFormat` to `usePageKeys`.
    - The `nativeEditor` element moves to just after the `usePageKeys` call, because it now
      needs `toggleFormat`, and gains `setTextSelection` and `toggleFormat`.
    - `item` and `text` go to `ObjectsPanel`.
    - `App.tsx` grows by one line, the new props line on the Content field (placement,
      rule 2); everything else goes on existing lines.
11. **Tests:** `tests/marks.test.mjs` and `tests/modules.test.mjs`, as listed under
    validation.

No other module changes: no `document.ts`, `text-runs.ts`, other rules module, other hook,
`scene/` part, other `ui/` part, `main.tsx`, packages, locks, other contracts or other
tests. If something seems to need more, stop and report it.

New source files use `SPDX-License-Identifier: Apache-2.0`. Append the implementation
record below with the branch, validated revision, commands, results and exclusions;
report the final branch tip separately.

## Numbered acceptance criteria

- 0001-W26-AC01: With text selected in the Content field or the inline editor, the buttons and shortcuts toggle formatting over exactly the selected characters, keeping the editor open with its focus and selection; with only a caret or when not editing they act on whole objects as in 0001-W6.
- 0001-W26-AC02: The buttons' pressed state follows the selection while editing, Objects shows a formatted preview of the text, each formatting command is one undo step, native text undo in the field is unchanged, and the commands are unavailable while composing.

| Criterion | Evidence that shows it |
| --- | --- |
| 0001-W26-AC01 | Scenario L: L2, L5, L6 and L14 (shortcuts and the pointer in both editors, focus and selection kept), L7 and L8 (saved marks and drawing), L11 (a caret formats the whole object), L12 (offsets after an emoji), L17 (a canvas shortcut formats the whole object) and L20 (reopening) |
| 0001-W26-AC02 | Scenario L: L1, L3, L4 and L13 (pressed state follows the selection), L15 (the preview), L16 (leaving the field), L9 and L10 (Undo and Redo of one step), L18 and L19 (composing); the unchanged v5 rule for native text undo; unit tests for the helpers |

## Validation commands and expected evidence

From the repository root with the pinned toolchain:

```sh
npm --prefix apps/web ci --ignore-scripts --no-audit --no-fund
npm --prefix apps/web run typecheck
node --test tests/marks.test.mjs tests/modules.test.mjs
npm --prefix apps/web test
npm --prefix apps/web run build
npm --prefix apps/web run build:fixtures
git diff --name-only main...HEAD
```

**`tests/marks.test.mjs`** gains three tests:
- `formattedRange`:
  - true for the whole bold range and for a range inside it;
  - false for a range starting before it, for another flag, and for an empty range.
- `codePointOffset`:
  - `"abc"` at 2 is 2;
  - `"🧭 note"` at 2 is 1, at 3 is 2, at 7 is 6;
  - `""` at 0 is 0.
- `segments`:
  - `"Alpha beta"` with bold 6–10 gives `{ text: "Alpha " }, { text: "beta", bold: true }`;
  - `"🧭ab"` with italic and strike on 0–1 gives the emoji with both flags, then `"ab"`;
  - empty text gives `[]`.

**`tests/modules.test.mjs`:**
- the screen-parts inventory becomes fourteen modules, adding `format-preview.tsx` (its
  title names 0001-W26 v1);
- the `App.tsx` budget becomes 262.

The existing checks cover the new part (no React state, React only as types, licence
header, no `App` import) and the hooks (no imports of each other).

Reviewer checks (not run by the implementer; browsers cannot start there):

- **Regression harness.** The eight PASS lines at the fixture index page and at
  `regressions.html` ([tests README](../../tests/README.md)), in headless Chrome or a
  focused browser window.
- **Previous behaviour.** Scenarios A–J of the 0001-W24 v1 brief's comparison, unchanged,
  on a build of `c211dee` twice (the two must match exactly) and once on the candidate.
  None of A–J formats text, so the preview never shows. The candidate must match at every
  checkpoint in markup, focus, canvas drawing and saved records, with nothing set aside.
- **0001-W6's scenario K**, unchanged: all 33 checks pass.
- **Scenario L** (new behaviour), in a fresh context, with real mouse and keyboard input.
  Text is selected as a keyboard user does: caret placed, then Shift+ArrowRight per
  grapheme. Name a board; place a sticky `Alpha beta gamma` and a text object
  `🧭 note here`.
  - In the sticky's on-canvas editor:
    - **L1** Select `beta`: Bold unpressed.
    - **L2** Ctrl+B: the editor stays open, with focus and the selection `beta`.
    - **L3** Bold is pressed.
    - **L4** Select `Alpha`: Bold unpressed.
    - **L5** Italic with the pointer in the context bar: the editor keeps focus and the
      selection.
    - **L6** Select `gamma`, Ctrl+Shift+X; select `beta`, Ctrl+B: Bold unpressed
      (removed). Ctrl+B again; Done; save.
    - **L7** Saved marks are italic 0–5, bold 6–10, strike 11–16.
    - **L8** The canvas draws `Alpha` italic, `beta` bold, `gamma` struck through, with
      plain spaces.
  - **L9** The Undo button removes only bold 6–10 (saved).
  - **L10** The Redo button puts it back (saved).
  - In the text object's editor:
    - **L11** A caret alone and Ctrl+I: the whole object is italic and the editor stays
      open (Ctrl+I again removes it).
    - **L12** Select `note`, Ctrl+B; saved marks: bold 2–6.
  - In Objects, with the sticky selected and focus in the Content field:
    - **L13** Select `gamma`: Objects' Bold unpressed.
    - **L14** Ctrl+B: Bold pressed, focus and the selection kept.
    - **L15** The preview shows `Alpha` italic, `beta` bold, `gamma` bold and struck
      through.
    - **L16** Tab out of the field: Bold shows the whole object again (unpressed).
  - **L17** Select the text object on the canvas, Ctrl+Shift+X: the whole object is struck
    through (saved).
  - In the sticky's editor, select `Alpha` and start a composition:
    - **L18** Ctrl+B: Bold unavailable.
    - **L19** End the composition, Escape: saved marks unchanged.
  - Reload:
    - **L20** Each word keeps its style.
    - **L21** No dialogs.

The maintainer checks the shortcuts, a selection formatted from the context bar, the
preview and reopening in Safari. No browser matrix, fixtures sweep, accessibility audit or
native IME check unless the maintainer asks.

## Exclusions and reasons

- A WYSIWYG editor (`contenteditable`); formatting shown inside the text field.
- Pending formatting for the next typed text; formatting the word at the caret.
- Intercepting Cmd/Ctrl+Z in text fields.
- Lists, links, underline, per-word colour or size.
- Rich text on the system clipboard; any saved-format change.
- Fixes for bugs noticed on the way (report them).

## Public references with retrieval dates

None beyond the repository's own documents.

## Implementation record
