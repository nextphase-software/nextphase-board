# 0001 — Web app modules

Note version: 45 (for 0011-W2 brief v1, 2026-11-20). Status: Draft.
Replaces [web modules v44](0001-web-modules-v44.md), whose registry, import, composition, one-state-owner,
team guards, counts and seams remain word for word except as below.
[Interaction v47](0001-interaction-v47.md) adds table data exchange with exactly one new source module and one
test file. No package, room or server file changes.

| Module | Responsibility |
| --- | --- |
| `apps/web/src/table-csv.ts` | Pure table-data rules, no React or DOM globals (the standard `TextDecoder` and `TextEncoder` are allowed): detecting spreadsheet data from a `text/plain` and a `text/html` string; telling a CSV file from its name and type; decoding a file's bytes (size rule, fatal UTF-8, byte-order mark); the reader (separator, quoting, line breaks, line numbers, padding); the refusal rules in interaction v47's order with their reason texts; building the board with the new tables (the document's table creation, cells, a row-growth function the caller passes, placement at a point, the 24-unit cascade, the Table tool's placement into sections and stacking order); the tab-separated text of a table; the CSV file text (byte-order mark, formula rule, quoting, CRLF) and file name; and every success and refusal notice text. Imports only `nextphase-board-rules` and the web `sections.ts` placement it reuses |
| `tests/table-csv.test.mjs` | The unit test file named in the brief |

**Counts.** Unchanged from v44: rules package 16 files, the object-module counts, 18 scene parts, 33 screen parts,
**25 state hooks (no new hook)**, the board-sync list, every effect count (`use-editing-commands.ts` keeps **no**
effect; `use-page-keys.ts` and the screen parts keep theirs), and the team module list. `table-csv.ts` is a web
`.ts` file, so the type-name guard applies to it.

**Web paths.**
- `state/use-editing-commands.ts` owns the exchange. Its input gains `tableMeasure` (the cell measure App
  already has from `use-object-layouts.ts`), used with `growTable` and `layoutTable` for the drawn box. It keeps
  one new ref, the **copy record** (interaction v47 "Board's own copy": the latest Copy or Cut's own id, asked
  text and write state; only the request whose id is current may update it), set inside `writePlainText`, which
  keeps today's notice sequencing. It returns one new value, `tableData`, holding:
  - `paste(next)`: a paste handler that runs interaction v47 "Routing" for paste and otherwise calls
    `next(event)` (the handler App passes today);
  - `drop(next)`: a drop handler that runs v47 "Routing" for drop and otherwise calls `next(event)`;
  - `importButton`: `{ shown, disabled, choose }` for the board panel (`shown` false only for a hosted viewer,
    from the hosted board's `snapshot.role === "viewer"`, never from `canEdit`; `disabled` while the data-exchange reason is not empty; `choose` records
    the view centre and opens a hidden `input type="file" multiple accept=".csv,text/csv"`, created and removed as
    `chooseImages` does; a non-empty result closes the panel with `setPanel("")`);
  - `exportTable()`: exports the one selected table under v47's export rule and returns whether it did.
  The data-exchange reason is computed from `clipboardState` with `editingCommandReason` and the Tidy up wait,
  never from `clipboardReason("Paste", …)`, plus the hosted board's voting mode (`hosted.voting.mode`). Reading files is asynchronous; each batch carries its board id, page
  id and anchor from its start and is added under v47 "The new table" ("When"), from `model.current`, as one
  `commit(next, true)` followed by `select`, `setTool("Select")`, `setPanel("")`, canvas focus and `setMessage`
  (the success text only when the commit took). The download uses a `Blob`, an object URL and a temporary
  `<a download>`, as `saveCopy` does.
- `state/use-images.ts` and `state/use-hosted-board.ts`: their paste handlers use amendment A1's target rule
  (amendment A2); nothing else changes.
- `clipboard.ts`: `plainText` includes each copied table as `table-csv.ts`'s tab-separated text, in object
  order, joined as today.
- `state/use-page-keys.ts`: ⇧⌘E / Ctrl+Shift+E on the canvas (v47 "Keys") calls the new input `exportTable` and
  prevents the default only when it returns true.
- `ui/table-controls.tsx`: Table mode gains the `Export as CSV` button after Add column, from a new optional
  `exportTable` prop (absent: no button), with the platform tooltip; it keeps every other button.
- `ui/context-bar.tsx`: passes its new `exportTable` prop to `TableControls`.
- `ui/board-panel.tsx`: the `Import CSV…` button last in `.board-file-commands`, from a new `importTable` prop
  (`{ shown, disabled, choose }`).
- `icons.tsx`: one new path icon, `Export as CSV` (v47).
- `apps/web/style.css`: only if a new part needs a rule to take the look v47 states; no new colour or size.

Each may change only as far as its contract needs.

**App.tsx** remains composition-only, **264 lines, no added line**. Exactly these substitutions on existing
lines of 0116263, each passing values App already has and the new return value of a hook App already calls:

| 0116263 line | Change |
| --- | --- |
| 125 | The `useEditingCommands` destructuring also takes `tableData` |
| 126 | The `useEditingCommands` input also passes `tableMeasure` |
| 133 | The `usePageKeys` input also passes `exportTable: tableData.exportTable` |
| 151 | `onPaste={tableData.paste(hostedPaste ?? images.paste(() => clipboardCommand("Paste")))}` and `onDrop={tableData.drop(images.drop)}`; the rest of the line unchanged |
| 205 | `BoardPanel` also gets `importTable={tableData.importButton}` |
| 225 | `ContextBar` also gets `exportTable={tableData.exportTable}` |

`tableMeasure` is already returned by `useObjectLayouts` before line 125 (App line 66 destructures it). The
"0011-W1 App composition" test in `tests/modules.test.mjs` is renamed "0011-W2 App composition": it keeps every
0011-W1 substitution and adds these six after them (each `before` is the exact 0116263 line), and still checks
the same line count. The implementation record lists every substitution with its before and after text.

No dependency, font file, image file, service, service migration or import exception. No stored value, no
room message, no presence key and no new kind of Undo step is added.
