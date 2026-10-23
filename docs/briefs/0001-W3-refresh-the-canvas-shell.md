BRIEF VERSION: 0001-W3 v1 (2026-10-22)
# 0001-W3 — Refresh the canvas shell

Status: Implemented. Independently reviewed and merged into main on 2026-10-22;
the implementation record below lists the validated revision.

## Outcome

Make the existing editor feel coherent without changing what it does. Compact the
upper-left board header, move routine local-storage guidance behind a quiet
information control, give the existing tools one independently authored SVG icon
set with consistent states, and place the existing selected-object controls next
to the selection. Document data, storage, saving, tools, geometry and the
keyboard/native editing routes stay exactly as 0001-W1 delivered them.

## Read first and prerequisite contracts

- [Contributor guidance](../../CONTRIBUTING.md), [agent instructions](../../AGENTS.md)
  and [engineering standards](../../DESIGN.md).
- [0001-W1 brief v6](0001-W1-capture-and-reopen-a-board.md): the behavior baseline.
- [0001 interaction v4](../architecture/0001-interaction-v4.md): governs all
  behavior. This brief replaces only the presentation rows and constants named in
  "Presentation delta"; every input, focus, composition, save and read-only rule
  in v4 still applies.
- [0001 document v1](../architecture/0001-document-v1.md),
  [0001 storage v1](../architecture/0001-storage-v1.md) and
  [0001 dependencies/toolchain v1](../architecture/0001-toolchain-v1.md):
  unchanged.

All requirements are in this repository. The wireframe and tables below are the
complete design reference; no external design file is a build input.

## Presentation delta to interaction v4

```text
+--------------------------------------------------------------------------+
| [N  Board title  v | Local | Objects]           [o status text | Save]   |
|                 [state message, only when attention or action is needed] |
|                                                                          |
|                   [ Sticky | Edit text | 12 / 1,000 ]   <- context bar   |
|                   +--------------------------------+                     |
|                   | selected object / native editor|                     |
|                   +--------------------------------+                     |
|                                                                          |
| [i]               [ Select  Pan | Sticky  Text ]      [ -  100%  + | Nav ]|
+--------------------------------------------------------------------------+
```

| Surface | Replaces in interaction v4 | Presentation |
| --- | --- | --- |
| Board bar | Board details row; Objects moves here from Actions | One upper-left surface, 48px tall: a Board details button holding a small dark square "N" mark, the title (ellipsized; "Untitled board" placeholder only) and a chevron icon; a "Local" text pill (not a button); a divider; an Objects icon button. |
| Board details panel | Board details panel contents | Board name input, code-point count and nonblank rule as today; the existing Reopen action moves here from the upper right; the local-storage explanation; Close board details. Reopen keeps its warning, focus and recovery rules. |
| Save area | Actions row | One upper-right surface: a small status icon, the status text (Unsaved, Saving, Locally saved, Save failed, with "· Invalid draft" when applicable) in the existing live status region, and the Save button. Save uses the purple primary style while the document is Unsaved; a quiet neutral style when Locally saved; Retry save uses an error style. Enablement and labels follow v4 unchanged. |
| State message | State message row | Same region and messages, except the routine "stored only in this browser profile" sentence and the save acknowledgement no longer appear there. The region is hidden when it has nothing to say. Validation, failure, read-only, recovery actions, placement instructions and the gesture notice still appear. The latest save acknowledgement becomes the save area's accessible description. |
| Information control | New | A 40px "i" icon button at the lower left, accessible name "About local storage", opening a small nonmodal popover with the existing explanation (one board per browser origin/profile; browser storage is not a backup) and a Close action. It follows v4's surface rules: opening it closes other surfaces, Escape outside native text input closes it, and focus returns to the trigger. |
| Palette | Palette row and its 56px bar | Same four tools in the same order: Select, Pan, a divider, Sticky, Text. Icon-only 40×40 buttons with 4px gaps in the 56px bar. A text label tooltip (the tool name, no shortcut letters) appears above the button on hover and on keyboard focus. Accessible names and pressed state as today. |
| View controls | View controls row | Zoom out and Zoom in icons, the percentage, a divider and a Navigation icon button with a tooltip. The navigation panel content is unchanged. No fit control. |
| Selection context | Selection context row | A dark compact bar, 40px tall, horizontally centred on the selected object's transformed bounds and 8px above them; when there is no room above, 8px below them. Clamped 12px inside the scene and never over the board bar, save area, state message or on-object editor. Contents: object type, a divider, a pencil icon with "Edit text" or "Done" (the same action as today), a divider, and the "n / 1,000" count. Below 768 CSS pixels it may stay hidden, as today; Objects remains the route. |

Icons: one set of inline SVG drawn for this project in source, on a 20×20 viewBox,
1.75px round-capped strokes in `currentColor`. Required glyphs: select arrow, hand,
sticky note, text "T", minus, plus, navigation (four-way arrows), objects (list),
chevron down, pencil, information and the status icon. Each SVG is `aria-hidden`;
its button carries the accessible name. No icon font, image file, icon library or
downloaded asset.

States for every icon button: hover background `#f1eff5`; active/pressed tool
background `#7051cf` with a white icon; keyboard focus keeps v4's 3px `#7051cf`
outline; disabled at 45% opacity with v4's text explanation. Tooltips appear on
hover and focus and never hide another control's action.

Spacing and surfaces: 12px scene inset, 8px gaps between surfaces, 4px gaps inside
them, minimum 40px targets, 12px surface radius, 8px button radius, and the
existing white surface, light border and restrained shadow. System font: 14px base,
12px for status, counts and tooltips. Colors, scene, dot grid, sticky fill, object
text and selection outline are unchanged from v4.

Below 768 CSS pixels: the board bar and save area stack at the top at full width,
the palette sits above the lower-right view controls, and the information control
stays at the lower left. The title ellipsizes; no action is hidden; there is no
page-wide horizontal overflow at 320px and 375px widths.

## Deliverables and boundaries

Change only presentation: `apps/web/src/App.tsx`, `apps/web/style.css`, and an
optional new `apps/web/src/icons.tsx` for the SVG set. New source files use
`SPDX-License-Identifier: Apache-2.0`. Do not change `document.ts`, `storage.ts`,
the document schema, persistence, explicit-save policy, object geometry,
placement, tool set, keyboard handling or focus rules, and do not add or update a
dependency, `package.json` or the lock file. If a requirement here seems to need a
behavior change, stop and report it instead of making the change.

Append the implementation record below with the branch, validated source revision,
commands, results and exclusions; report the final branch tip separately.

## Numbered acceptance criteria

- 0001-W3-AC01: Use the selected v3 compact header, coherent spacing and quiet browser-local storage guidance; preserve truthful explicit save states.
- 0001-W3-AC02: Replace inconsistent tool glyphs with independently authored SVG icons and consistent active, hover and focus states for existing tools only.
- 0001-W3-AC03: Place existing object controls near the selection while keeping native text editing and the Objects fallback usable; do not change document or save behavior.

"Selected v3 compact header" means the board bar and save area specified in
"Presentation delta". The cases below explain evidence; they are not extra
criteria and not an automatic checklist.

| Criterion | Evidence that shows it |
| --- | --- |
| 0001-W3-AC01 | Board bar and save area as specified; routine storage sentence gone from the state message and present in the information popover and Board details; status text moves Unsaved → Saving → Locally saved on a real save, Save failed/Retry save unchanged; Reopen works from Board details |
| 0001-W3-AC02 | The four tools and view controls use the SVG set; hover, pressed, focus and disabled states as specified; tooltips on hover and focus; no new tool or shortcut |
| 0001-W3-AC03 | Context bar centred above (or below) the selection and clamped; Edit text and Done open and close the native on-object editor; Objects still selects, edits and moves; the document diff shows no change to document, storage or save logic |

## Validation commands and expected evidence

Test only what this change touches, per [agent instructions](../../AGENTS.md).

- `npm --prefix apps/web ci --ignore-scripts --no-audit --no-fund`, then
  `npm --prefix apps/web run typecheck` and `npm --prefix apps/web run build`.
- `git diff --name-only main...HEAD` lists only the files allowed above plus this
  brief's implementation record.
- One browser inspection in Chrome at 1440×900 and 375×667: the header, save area,
  palette, view controls, information popover and context bar in their default,
  hover, focus and pressed states; one route of select → Edit text → type → Done;
  one real save showing Unsaved → Locally saved. Repeat the same screen once in
  Safari. Whoever can run a browser (implementer or reviewer) records it.

Unit tests, browser fixtures, the browser matrix, zoom sweeps, accessibility audits
and IME checks do not run for this change unless the maintainer asks. If logic
outside presentation changes after all, add a focused regression and say why.

## Exclusions and reasons

Square or resized notes, note colors or text styles, rich text, resize handles or
multi-select, new tools or illustrated future tools, letter shortcuts, placement
previews, fit-to-board, drawing, sections, connectors, accounts, sharing, avatars,
presence and collaboration are separate milestones. No schema, persistence,
explicit-save policy, renderer rewrite, dependency, deployment or hosting change.

## Public references with retrieval dates

No new external reference. Interaction v4's references (retrieved 2026-10-22)
apply. Layout, constants and icon rules above are project requirements.

## Implementation record

Implementation handoff dated 2026-10-22 for **0001-W3 v1**.
Branch: `codex/0001-W3-canvas-shell`; worktree: `.worktrees/codex-0001-W3`.
Committed main base: `3db15eb56a3e225cc905a7236e5ddc7fec254dfb`.
Validated source revision: `59b7409382564db3c3124d2d7400c7953f8e4f8e`.
Checks ran against these same source bytes before the source commit. This record
is a separate documentation commit; the final branch tip is reported separately.

The three permitted source files implement the compact board bar, relocated
Reopen, quiet storage explanation, save presentation, original inline SVG set,
tooltip states and transformed selection context. Context positioning reserves
the top controls/message region, clamps inside the scene and suppresses the bar
if it cannot fit without covering the native editor; Objects remains available.
The information popover uses the existing surface toggle and Escape focus-return
routes. Document, storage, saving, geometry, placement and native input handlers
are unchanged. No dependency, external asset, manifest or lock change was added.

The supplied runtime was selected in the shell before every npm invocation;
its machine-specific location is deliberately omitted from this public record.

| Exact command | Actual result |
| --- | --- |
| `node --version` | PASS: `v24.22.1` |
| `npm --version` | PASS: `11.19.1` |
| `npm --prefix apps/web ci --ignore-scripts --no-audit --no-fund` | PASS, exit 0; added 19 packages |
| `npm --prefix apps/web run typecheck` | First run failed with TS2339 on the notice element's `hidden` property. Corrected the DOM query type; subsequent runs, including final source bytes, PASS, exit 0. |
| `npm --prefix apps/web run build` | PASS, exit 0; accepted lock, runtime inventory and complete distributed notices verified; application built. Repeated after source corrections, with the final run on validated source bytes. |
| `git diff --check` | PASS, exit 0 before source commit |
| `git diff --cached --stat` | Inspected: only App.tsx, icons.tsx and style.css in source commit |
| `git commit -m "feat(web): refresh the canvas shell presentation"` | Source commit succeeded; both mandatory public-boundary hooks reported PASS. Git also reported a sandbox-denied `packed-refs.lock` creation; the commit exists and no hook was bypassed. |
| `git diff --name-only main...HEAD` | PASS after record commit: only the three allowed source files and this brief |
| `git status --short` | Clean after record commit |

No browser was launched: the maintainer reports browsers cannot start in this
environment. Chrome at 1440×900 and 375×667, Safari inspection, hover/focus/pressed
appearance, native select/edit/type/Done and actual save transition observations
are **UNVERIFIED**, left to the independent reviewer. No browser evidence from W1
is claimed for this revision. No unit tests, browser fixtures/matrices, zoom
sweeps, accessibility audits, performance checks or native IME checks ran.

Source review confirms the implementation is limited to presentation and the
specified information surface. AC01–AC03 runtime/visual acceptance remains pending
review of the exact validated source revision. Graph indexing was attempted but
unavailable under the environment's approval policy; source was read directly.
No push, merge, publication, deployment or later milestone was performed.
