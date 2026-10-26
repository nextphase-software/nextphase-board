BRIEF VERSION: 0002-W1 v1 (2026-10-26)
# 0002-W1 — Organize ideas into sections

Status: Draft. Implementation starts only after the maintainer commits this brief,
[0001 document v5](../architecture/0001-document-v5.md),
[0001 interaction v17](../architecture/0001-interaction-v17.md) and
[0001 web modules v15](../architecture/0001-web-modules-v15.md) to main.

## Outcome

A **section** is a named area on the board that holds ideas. You draw one, or wrap the
selected notes in one, and give it a name; the notes inside belong to it. Moving the section
moves everything in it, and notes outside stay where they are. Undo, Save and reopening keep
all of it, and everything can be done from the keyboard through Objects.

- A section is a board object of a new type, `section`, with a name, a colour, a position and
  a size (200 to 10,000 units). It draws below every note as a lightly tinted area with
  rounded corners and its name above its top-left corner.
- Membership is stored on each member (`section`, one level only) and never recomputed from
  positions when a board opens.
- Ideas join or leave when dropped (by centre), when placed inside, when a drawn section
  surrounds them, with Section from selection, and with Objects' Section select.
- The saved format becomes document v5. Boards saved as v1 to v4 open unchanged and become
  v5 at the next Save; older versions of the app open v5 boards read-only.

"Today" means `ee37821`. Boards without sections look and behave as today, except for the
new controls named in this brief.

## Read first and prerequisite contracts

- [Contributor guidance](../../CONTRIBUTING.md), [agent instructions](../../AGENTS.md) and
  [engineering standards](../../DESIGN.md).
- [0001 document v5](../architecture/0001-document-v5.md): the `section` key and type,
  per-type limits, validation, the upgrade and older apps.
- [0001 interaction v17](../architecture/0001-interaction-v17.md): drawing, hit testing,
  creating, naming, joining and leaving, moving with members, order, groups, delete, copy,
  Objects, the keyboard route and history.
- [0001 web modules v15](../architecture/0001-web-modules-v15.md): the new modules and the
  guard changes; v12's rules unchanged.
- [0001 storage v1](../architecture/0001-storage-v1.md) and
  [0001 toolchain v1](../architecture/0001-toolchain-v1.md): unchanged. No new dependency.
- [0001-W6 v1](0001-W6-whole-object-formatting.md) and
  [0001-W26 v1](0001-W26-format-selected-text.md): their comparison procedure and scenarios
  K and L are reused by the reviewer.

## Deliverables and boundaries

Paths are under `apps/web/` unless they start with `tests/`. The contracts say what each
behaviour is; this list says where it goes. These are the only files that may change.

**New files (four).**
1. **`src/objects/section.ts`**: the section type record: type `section`, label `Section`,
   tool `Section`, valid from version 5, drawn by the section body, a container, no
   formatting or text size, text limit 100, initial text `Section`, a tool that draws by
   dragging, size range 200–10,000, default size 640 × 480, default style neutral, medium,
   left, its fill and edge from its colour, and name colour `#5f5b66`. No React or Konva.
2. **`src/sections.ts`**: a rules module (web modules v15) with, at least:
   - `bandOrder`, `orderInBands` and `orderParticipants`: the bands, order commands within
     them, and the positions an order step records (every position on an interleaved board);
   - `withMembers`: the moved set; `sectionAt`: the section at a point;
   - `dropTargets` and `dropped`: each moved idea's section after a drop (own centre, or a
     whole moving group's centre; members carried by a moving section excluded);
   - `moveWithMembers`: the moved set moved by one limited distance;
   - `assignSection`: the Section select's explicit assignment (ideas only);
   - `placeObject`: placing a new object (an idea joins by centre; a section enters its band;
     a new section, by any route, takes in the ideas whose centre it contains);
   - `drawRectangle`: a drawn rectangle with the type's limits and board bounds;
   - `wrapReason` and `wrapSelection`: Section from selection and its reasons;
   - `objectLabel`: Objects' option text, including "1 item" and "Empty";
   - `remapSection`: membership for copies.
   No React, Konva or type names (rule 7).
3. **`src/scene/section-body.tsx`**: `SectionBody` (area, edge, name; selected and drop-target
   looks; the name hidden while its editor is open) and `SectionDropHint` (the "Joins" label),
   with the values in interaction v17.
4. **`tests/sections.test.mjs`**: as listed under validation.

**Changed rules modules.**
5. **`src/document.ts`**: document v5 (`ItemV5`, `BoardV5`), validation with the version rule,
   per-type text and size limits from the registry and the section rules, v5 canonical order,
   the upgrade from v1–v4 (keeping v3/v4 groups and v4 marks, adding `section: null`), new
   boards v5, `add` using the type's initial text and `section: null`, and the adapter's atomic
   `section` value.
6. **`src/history.ts`**: Delete clears the `section` of members of deleted sections in the same
   step; Duplicate uses the moved set, remaps membership and inserts by band.
7. **`src/clipboard.ts`**: the snapshot uses the moved set and records each object's source ID
   and kept section; Paste remaps membership and inserts by band.
8. **`src/group.ts`**: Group refuses a selection with a section ("Sections cannot be grouped.").
9. **`src/arrange.ts`**: a fifth Arrange group, Section, with Section from selection.
10. **`src/resize.ts`**: single and set resizing accept a per-type size range; notes keep
    today's limits and results.
11. **`src/context-bar-position.ts`**: the bar placed above a single selected section sits 30
    units (scaled) higher.
12. **`src/gesture.ts`**: the current document type only.

**Changed object types.**
13. **`src/objects/registry.ts`**: registers `section` after `text`; adds lookups for the
    placement tool of a tool name, the container type and whether an object is a container.
14. **`src/objects/sticky.ts`, `src/objects/text.ts`**: the new record properties with today's
    values (valid from version 1, note body, not a container, formatting, text limit 1,000,
    initial text empty, size range 40–2,000, a tool that places by click).

**Changed screen parts.**
15. **`src/scene/board-drawing.tsx`**: draws in bands, chooses the body through the registry,
    and draws drop targets and hints while a drag is in progress (from the moving IDs).
16. **`src/scene/overlays.tsx`**: the dashed drawing preview while a drawing tool is armed.
17. **`src/scene/inline-editor.tsx`**: the compact name field for types without formatting.
18. **`src/scene/note-body.tsx`**: the current document type only.
19. **`src/icons.tsx`**: the Section tool's glyph (a frame with a short title line).
20. **`src/ui/palette.tsx`**: object tools listed from the registry; read-only disables every
    placement tool.
21. **`src/ui/notice.tsx`**: the placement hint for any placement tool, worded for a drawing
    tool as interaction v17 says.
22. **`src/ui/content-field.tsx`**: the label (Content or Name), text limit and count from the
    type; formatting shortcuts only for types with formatting.
23. **`src/ui/context-bar.tsx`**: Edit name, the "/ 100" count, and no text controls when the
    selection includes a section.
24. **`src/ui/objects-panel.tsx`**: option labels through `objectLabel`; the Section select;
    text controls hidden when the selection includes a section.
25. **`src/ui/board-panel.tsx`, `src/ui/format-preview.tsx`**: the current document type only.
26. **`style.css`**: the drawing preview (`.selection-box.drawing`) and the compact name field.

**Changed state hooks** (each keeps its ownership, web modules v15):
27. **`src/state/use-canvas-input.ts`**: placement tools from the registry; drawing; hit
    testing by band; a press with a drawing tool armed always starts drawing; drops applying
    membership through `sections.ts` in the move's step.
28. **`src/state/use-geometry-edits.ts`**: create through `placeObject` (selecting the created
    object by ID, not by array position); moves through `moveWithMembers` (no step when
    nothing moves); resizing with the type's range; text limits from the type; a name never
    changes a section's height.
29. **`src/state/use-editing-commands.ts`**: Section from selection; `setSection`; order within
    bands; Cut deleting the moved set; Paste selecting its copies by fresh IDs; when the selection
    includes a section, the text-style and formatting commands change nothing at all (they
    are not shown, and their shortcuts do nothing).
30. **`src/state/use-selection.ts`**: returns whether every selected object takes formatting.
31. **`src/state/use-object-layouts.ts`**: a section's drawn height is its saved height; handles
    stay shown while a section's name is being edited.
32. **`src/state/use-editor-placement.ts`**: a new section's name is selected when its editor
    opens; for a section, whether the canvas field can be shown is decided from the name
    field's own rectangle and minimum (interaction v17), not the note editor's.
33. **`src/state/use-command-reasons.ts`, `src/state/use-validity.ts`**: placement tools and
    text limits from the registry.
34. **`src/state/use-board-document.ts`, `src/state/use-page-keys.ts`,
    `src/state/use-storage-session.ts`**: the current document type only.

**Composition.**
35. **`src/App.tsx`**: passes `richText`, `setSection`, the moving IDs and the tool to the parts
    that need them, on existing lines. It stays at **262 lines**, its budget.

**Changed tests.**
36. **`tests/document.test.mjs`, `tests/storage.test.mjs`, `tests/objects.test.mjs`,
    `tests/clipboard.test.mjs`, `tests/context-bar-position.test.mjs`,
    `tests/modules.test.mjs`**: as listed under validation.

No other module changes: no `selection.ts`, `commands.ts`, `storage.ts`, `marks.ts`,
`text-runs.ts`, `geometry.ts`, other hook, other screen part, `main.tsx`, packages, locks,
contracts or other tests. If something seems to need more, stop and report it.

New source files use `SPDX-License-Identifier: Apache-2.0`. Append the implementation record
below with the branch, validated revision, commands, results and exclusions; report the final
branch tip separately.

## Numbered acceptance criteria

- 0002-W1-AC01: Create and name a section and assign supported ideas with stable membership.
- 0002-W1-AC02: Move the section with its members while outside objects remain unchanged; undo/redo restores membership and geometry.
- 0002-W1-AC03: Save/reopen preserves supported membership and reading order; keyboard users can perform the same organization workflow.

| Criterion | Evidence that shows it |
| --- | --- |
| 0002-W1-AC01 | Scenario M: M1–M5 (draw, name, saved frame, context bar, drawn look), M6 (placing inside joins), M7–M9 (drop target, join and leave by drag), M20–M21 (Add section), M33–M34 (Section from selection), M35–M36 (tool click and Enter), M40 (a new section takes in what it covers); unit tests in `tests/sections.test.mjs`, `tests/document.test.mjs` and `tests/objects.test.mjs` |
| 0002-W1-AC02 | Scenario M: M10–M11 (undo and redo of a drop), M12–M14 (section drag with members, one undo, Escape), M16 (resizing keeps membership), M19 (keyboard move with members), M22–M23 (order bands), M24–M27 (groups), M28–M29 (delete and undo), M30–M32 (duplicate, copy and paste), M41 (cut takes members); unit tests in `tests/sections.test.mjs` and `tests/clipboard.test.mjs` |
| 0002-W1-AC03 | Scenario M: M15 (Objects Name field), M17–M18 (Section select by keyboard), M19 (keyboard move), M37 (labels), M38–M39 (save and reopen keep records, membership and order), M42 (no dialogs or errors); unit tests in `tests/document.test.mjs` and `tests/storage.test.mjs` |

## Validation commands and expected evidence

From the repository root with the pinned toolchain:

```sh
npm --prefix apps/web ci --ignore-scripts --no-audit --no-fund
npm --prefix apps/web run typecheck
node --test tests/sections.test.mjs tests/document.test.mjs tests/storage.test.mjs tests/objects.test.mjs tests/clipboard.test.mjs tests/context-bar-position.test.mjs tests/modules.test.mjs
npm --prefix apps/web test
npm --prefix apps/web run build
npm --prefix apps/web run build:fixtures
git diff --name-only main...HEAD
```

The change touches the saved format, history and `App.tsx`, so the implementer runs the full
unit suite (`npm --prefix apps/web test`) and reports any failure, saying whether it also fails
at `ee37821`.

**`tests/sections.test.mjs`** (new) covers:
- v5 validation of membership: one level, no dangling or idea targets, no grouped or styled
  sections, names up to 100 code points (blank, multiline and repeated allowed), sizes
  200–10,000 for sections and 40–2,000 for notes;
- membership stored and never inferred on reopening; the adapter's section value;
- placing a sticky and a text inside and outside a section; drawing limits and reverse drags;
- a new section taking in the ideas whose centre it contains, by every route (drawn, click,
  Enter, Add section, Section from selection), including an idea from another section, and
  none when it covers none;
- drops joining, leaving, on an edge, and onto overlapping sections (topmost wins);
- a whole group joining by its centre, a group straddling an edge, a member moved alone;
- Section from selection: 40-unit margins, a board edge, each reason in order, and a refusal
  changing nothing;
- moving a section with its members once (also when a member is selected too), the shared
  move limit, outsiders unchanged; one-step undo and redo of a drop;
- the four order commands within bands, with mixed selections; the first order command on an
  interleaved array and its exact undo; creating a section, creating an idea, Paste and
  Duplicate on an interleaved board (a stable partition first) and each one's exact undo;
- Delete keeping members and clearing links, Undo restoring them;
- Cut deleting a section with its members as one step, and Undo restoring all with links;
- Duplicate and Paste: members once, fresh IDs, remapped membership, whole and partial groups,
  member-only copies with no section, and Paste finding its copies by fresh IDs;
- the Section select's assignment (ideas only, nothing moves); `objectLabel` for sections
  (including "1 item", "3 items" and "Empty") and for members ("in *name*", with a group);
- resizing a section alone and in a set within 200–10,000 without changing membership.

**`tests/document.test.mjs`**: version 5 keys and order; a `section` object rejected in v1–v4;
per-type limits; reading v1–v4 and the upgrade (v3/v4 groups and v4 marks kept, `section`
null, no rewrite); v5 canonical output; existing cases changed only to follow v5 becoming the
current version.

**`tests/storage.test.mjs`**: a v5 head with a v2 previous record decodes without rewriting
either; existing cases changed only to follow v5.

**`tests/objects.test.mjs`**: the three records' new properties and the new lookups.

**`tests/clipboard.test.mjs`**: existing cases follow the snapshot's source IDs and v5.

**`tests/context-bar-position.test.mjs`**: the bar above a section leaves room for its name.

**`tests/modules.test.mjs`**: scene parts five (adding `section-body.tsx`), object types four
(adding `section.ts`), the type-name guards also forbid `"section"`; screen parts fourteen,
hooks nineteen and the `App.tsx` budget 262, unchanged.

Reviewer checks (not run by the implementer; browsers cannot start there):

- **Scenario M** (new behaviour), in a fresh context at 1280 × 800, with real mouse and
  keyboard input, once on the candidate and once on a build of `ee37821` as a negative
  control: there M1 must fail because the Section tool does not exist, the checks that depend
  on it are reported as unavailable, and the run must exit with a failure. Name a board. Saved records are read after each Save. The layout is fixed so each
  check is independent: at 100% zoom with the board origin at the canvas centre, Plan is drawn
  from (−520, −240) to (−40, 250) in CSS pixels from the centre; "Inside" (sticky) is placed at
  (−300, −30), "Text idea" (text) at (−280, 150) and "Outside" (sticky) at (300, 0). Before
  Add section (M20) the view is panned 600 pixels so the new section covers no idea, and
  panned back after M21. Every check that reads a record is preceded by Save and waits for
  "Locally saved"; M38 reloads only after such a Save. Steps that would change later checks
  are undone right after their check, with no other edit in between: M30, M31 and M32 are
  each undone after they pass, and so are M35 and M36 (a new section takes in what it
  covers, so they must not stay). Before M40, Inside alone is set to None with the Section select, so
  it has no section while Text idea is still a member of another section; M40 then draws from
  (−500, −220) over 520 × 490 pixels, which covers Inside and Text idea but not Outside, and
  after its Undo places a section by a click at (300, 0), over Outside. Before M41, Inside and
  Text idea are made members of Plan again with the Section select.
  - **M1** The Section tool draws a dashed blue preview while dragging.
  - **M2** On release the name editor opens with "Section" selected and focused.
  - **M3** Name it "Plan"; saved: version 5, type `section`, `section` null, the exact drawn
    rectangle.
  - **M4** The context bar has Edit name, "4 / 100", Colour and the shared commands, and no Text
    size, Alignment or Formatting.
  - **M5** Selected: edge `#518de0` 2 units, radius 8, fill opacity 0.55, name weight 600 in
    `#518de0`.
  - **M6** A sticky and a text placed inside join Plan; a sticky placed outside has no section.
  - **M7** Dragging the outside sticky over Plan shows "Joins Plan" and a dashed blue edge.
  - **M8** Dropping it inside makes it a member.
  - **M9** Dragging it back out clears its membership.
  - **M10** Undo restores its position and membership together.
  - **M11** Redo restores the leave.
  - **M12** Dragging Plan moves it and its two members once by the same distance; the outside
    sticky is unchanged.
  - **M13** One Undo restores every position.
  - **M14** Escape during a section drag restores every position.
  - **M15** In Objects, for Plan: Name, "4 / 100 code points", Colour, and no text size,
    alignment or formatting.
  - **M16** Make object wider on Plan widens only Plan; every idea is unchanged.
  - **M17** With the outside sticky chosen in Objects' list by keyboard, typing in the Section
    select (options "section *n* · *name*") assigns Plan without moving it.
  - **M18** Choosing None the same way clears it.
  - **M19** Objects' Move object right on Plan moves Plan and its members 10 units; the outside
    sticky is unchanged.
  - **M20** Add section by keyboard opens the Name field with "Section" selected.
  - **M21** That section is 640 × 480.
  - **M22** Bring to front on Plan puts it last among sections, still before every idea.
  - **M23** Send to back on the outside sticky puts it first among ideas, after every section.
  - **M24** Grouping Plan's two members keeps their membership.
  - **M25** Group is unavailable with Plan and a member selected.
  - **M26** Dragging the whole group out moves both members out together.
  - **M27** Dragging it back in makes both members of Plan again.
  - **M28** Deleting Plan keeps its members in place with no section.
  - **M29** Undo restores Plan and both memberships.
  - **M30** Duplicate on Plan adds three objects; the copied members point to the copied section.
  - **M31** Copy and Paste on Plan do the same.
  - **M32** Copy and Paste of a member alone gives a copy with no section.
  - **M33** Section from selection in Objects wraps the outside sticky with a 40-unit margin and
    makes it a member.
  - **M34** Section from selection in the Arrange menu wraps a member of Plan into the new
    section and opens its name.
  - **M35** A click with the Section tool places a 640 × 480 section.
  - **M36** Enter with the Section tool places a section.
  - **M37** Objects' labels name each member's section and each section's item count
    ("Plan · 1 item").
  - **M38** After a reload the saved board is identical.
  - **M39** After the reload Objects' labels are identical.
  - **M40** Drawing a section with the Section tool around two ideas, one with no section and
    one a member of another section, makes both members of the new section and changes no
    other idea; one Undo removes it and restores both earlier memberships. A section placed
    by a click over an idea takes it in the same way.
  - **M41** Cut on a section with two members removes all three ("Cut 3 objects. Undo restores them."); Paste adds
    three copies whose members point to the pasted section; Undo twice restores the originals
    with their membership.
  - **M42** No dialogs and no page errors.

Recommended regression checks, run only if the maintainer accepts them (this change touches
the saved format, history and `App.tsx`):

- **The full unit suite** in a clean clone, separating failures new to the candidate from
  failures that also occur at `ee37821`.
- **Previous behaviour.** Scenarios A–J of the 0001-W24 v1 brief's comparison, unchanged, on a
  build of `ee37821` and on the candidate. Before comparing, both runs are normalized with
  exactly these masks, and nothing else:
  1. the Section tool button in the palette markup;
  2. a saved version 5 record whose objects are all ideas with `section` null is compared as
     its version 4 form (no `section` key, version 4); a record holding a section or a
     membership is never masked;
  3. Objects' Section label and select;
  4. the Section group (its heading and Section from selection) in the Arrange menu and in
     Objects' Arrange group;
  5. Objects' Add section button;
  6. the Arrange menu's top offset at the two checkpoints where the extra group moves it.
  After the masks the candidate must match at every checkpoint in markup, focus, canvas
  drawing and saved records.
- **0001-W6's scenario K**, unchanged except at one point: in its step "Edit the sticky and
  append text", the saved record must be version 5 instead of version 4, the intended change;
  every other expectation stays as written.
- **0001-W26's scenario L**, unchanged: all 21 checks pass.
- **Regression harness.** The eight PASS lines at the fixture index page and at
  `regressions.html` ([tests README](../../tests/README.md)), in headless Chrome.

The maintainer checks three items drawn from scenario M in Safari. No browser matrix,
accessibility audit, native IME check, phone layout check or performance test unless the
maintainer asks.

## Exclusions and reasons

- Nested sections, and sections inside groups (one level only).
- Multiple pages, auto-layout or tidy-up, hiding or collapsing a section's contents, locking.
- Presenting or navigating by section; connectors.
- Membership decided from positions on load, or by Align, Distribute, resizing or Objects'
  move buttons.
- Formatting, text size or alignment for section names.
- A change to how a drag looks, other than the drop target.
- A new keyboard shortcut.
- Fixes for bugs noticed on the way (report them).

## Public references with retrieval dates

None beyond the repository's own documents.

## Implementation record

### 2026-10-26 — Codex implementation handoff

- Implemented **0002-W1 v1 only**, with document v5, interaction v17 and web modules v15.
- Branch: `codex/0002-W1-organize-sections`; worktree: `.worktrees/codex-0002-W1`.
  Started clean from committed main `1c7e1597e7d2e5cc5e805e1ef09e5ef1bb9e16de`.
- Validated source/test revision: **`5122f717f05586a146dbf70142202a563d1eec09`**.
  The final checks below ran on the source/test tree committed at this revision;
  `git write-tree` before committing and `git rev-parse HEAD^{tree}` afterward both
  returned `1e8fd8479eebb9b41c10e0a215a3f3ba1b1a3772`. No source or test edits
  followed validation. This implementation record is a later documentation-only commit;
  its final branch tip is reported separately in the handoff.
- Added dependencies: **none**. Packages, lock, architecture contracts and unlisted
  modules/tests were unchanged. New source files have the Apache-2.0 SPDX header.
- Implementation includes stored membership and v5 compatibility, banded drawing and
  order, drawing/placing/wrapping sections, compact names, drop targets, movement with
  members, explicit keyboard assignment, copy/cut/paste/duplicate membership, and history.
  `App.tsx` remains exactly **262 lines**; module guards pass.

Commands ran from the repository root using pinned **Node v24.22.1 / npm 11.19.1**.
Installation ran before implementation against the unchanged manifest and lock. All other
final checks used the source/test tree identified above.

| Exact command | Result |
| --- | --- |
| `node --version` | Exit 0; `v24.22.1` |
| `npm --version` | Exit 0; `11.19.1` |
| `npm --prefix apps/web ci --ignore-scripts --no-audit --no-fund` | Exit 0; 19 packages installed |
| `npm --prefix apps/web run typecheck` | Exit 0; no diagnostics |
| `node --test tests/sections.test.mjs tests/document.test.mjs tests/storage.test.mjs tests/objects.test.mjs tests/clipboard.test.mjs tests/context-bar-position.test.mjs tests/modules.test.mjs` | Exit 0; **164 passed, 0 failed** across the seven named files |
| `npm --prefix apps/web test` | Exit 0; **379 passed, 0 failed**, no skipped tests |
| `npm --prefix apps/web run build` | Exit 0; application built; accepted lock, runtime inventory and complete distributed notices verified |
| `npm --prefix apps/web run build:fixtures` | Exit 0; disposable fixtures built; accepted lock, runtime inventory and complete distributed notices verified |
| `git diff --check` | Exit 0; no whitespace errors |
| `git diff --name-only main...HEAD` | Exit 0 at the validated source revision; all 46 changed source/test paths are within this brief's allowlist |

Development checks also ran `node --test tests/document.test.mjs tests/objects.test.mjs tests/clipboard.test.mjs tests/storage.test.mjs`
(88 passed), and `node --test tests/sections.test.mjs` (final result 31 passed). The first
sections run had five assertions incorrectly expecting an outsider's reading-order index
to stay fixed when a section was inserted before ideas; those assertions now allow the
required renumbering while checking unchanged content, geometry and membership.

The first full candidate suite had **375 passed / 1 failed**: the existing
`tests/history.test.mjs` case “fresh IDs for add, grouping, duplicate and resurrection
avoid group IDs and all same-command IDs”. This was a new regression in Duplicate's
allocation sequence. It was fixed in `history.ts` by retaining the earlier per-object
logical-ID/generation sequence while preparing the membership mapping. That test file
was not edited. A subsequent full run passed all 376 tests then present, and the final
suite above passes all 379. Source review also corrected Delete to preserve surviving
objects' reading order while clearing their links; the section regression verifies it.

For comparison, a disposable archive of **`ee3782119d74fd963a8cbc956badb13b9dbc0fb6`**
used the same pinned toolchain and installed dependencies. With `validation_baseline`
pointing to that temporary directory, these commands ran:

```sh
git archive ee37821 | tar -x -C "$validation_baseline"
ln -s "$PWD/apps/web/node_modules" "$validation_baseline/apps/web/node_modules"
npm --prefix "$validation_baseline/apps/web" test
```

The baseline full suite exited 0: **337 passed, 0 failed**, including the UUID test above.
No pre-existing unit failure was observed.

**Exclusions and review boundary:** no browser was launched, no server was started, and
no browser regression harness, scenario M, A–J comparison, scenario K/L, Safari check,
accessibility audit, native IME check or performance test was run. Building fixtures is
not evidence that browser fixtures passed. Browser interaction and visual acceptance
remain for the independent reviewer of the exact source revision. This handoff does
not close browser acceptance, authorize a merge or start another milestone.

Both implementation commits ran the mandatory privacy hooks normally: `PUBLIC BOUNDARY:
PASS`. No stash, hook bypass, main commit, merge or push was performed.

### Fix round 1 — 2026-10-26

- Branch: `codex/0002-W1-organize-sections`; worktree: `.worktrees/codex-0002-W1`.
  Started clean at `d8ad15f7557ba01362ee0ab6c9048fa46221bbd8`.
- Addressed only the three review findings: idea labels preserve line breaks in their
  first 36 UTF-16 code units (including drafts), while section names retain their
  existing shortening; the drawn name's width is `o.width - 2`; drop highlights and
  hints use only ideas newly joining a section. The complete drop-membership calculation
  remains the default for applying a drop, including leaving a section.
- Added two regressions in `tests/sections.test.mjs`: idea/section line-break handling
  and preview filtering for staying, leaving and newly joining ideas.
- Validated source/test revision: **`de67a6daba07c6dccf047ce924d9588ce4d0dfe7`**.
  The checks below ran on the tree committed at this revision. `git write-tree` before
  the commit and `git rev-parse HEAD^{tree}` afterward both returned
  `147ed2bc8162a57f0b87321e78d990c626250988`. No source/test edits followed validation.
  The final branch tip includes this later documentation-only record and is reported
  separately in the handoff.
- Only `src/sections.ts`, `src/scene/section-body.tsx`, `src/scene/board-drawing.tsx`
  (under `apps/web/`) and `tests/sections.test.mjs` changed in the fix commit.
  Added dependencies: **none**.

Commands ran from the repository root using **Node v24.22.1 / npm 11.19.1**:

| Exact command | Result |
| --- | --- |
| `node --version` | Exit 0; `v24.22.1` |
| `npm --version` | Exit 0; `11.19.1` |
| `node --test tests/sections.test.mjs` | Before the fix, exit 1 as expected: 31 passed and the two new regressions failed |
| `npm --prefix apps/web run typecheck` | Exit 0; no diagnostics |
| `node --test tests/sections.test.mjs tests/document.test.mjs tests/storage.test.mjs tests/objects.test.mjs tests/clipboard.test.mjs tests/context-bar-position.test.mjs tests/modules.test.mjs` | Exit 0; **166 passed, 0 failed**, including both new regressions |
| `npm --prefix apps/web test` | Exit 0; **381 passed, 0 failed**, no skipped tests |
| `npm --prefix apps/web run build` | Exit 0; application built; accepted lock, runtime inventory and complete distributed notices verified |
| `npm --prefix apps/web run build:fixtures` | Exit 0; disposable fixtures built; accepted lock, runtime inventory and complete distributed notices verified |
| `git diff --check` | Exit 0; no whitespace errors |
| `git diff --cached --check` | Exit 0 before the fix commit |

No browser, server or browser regression harness was launched. Visual/browser checks
remain with the reviewer; the width correction was inspected in source. The mandatory
privacy hooks ran normally and reported `PUBLIC BOUNDARY: PASS`. No stash, hook bypass,
merge or push was performed. No additional milestone or unrelated fix was started.
