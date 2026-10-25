# Implementation briefs

[0001-W1 v6 — Capture and reopen a board](0001-W1-capture-and-reopen-a-board.md)
was accepted for implementation on 2026-10-22. Three existing
criteria are unchanged. Interaction v4 specifies the public design and behavior;
document/storage/toolchain v1 remain unchanged. It is implemented and merged into
main. A template is not authorization.

[0001-W3 v1 — Refresh the canvas shell](0001-W3-refresh-the-canvas-shell.md), a
presentation-only refresh of the 0001-W1 shell, is implemented and merged into main.

[0001-W2 v2 — Edit with explicit focus and undo](0001-W2-edit-with-explicit-focus-and-undo.md),
undo, redo, duplicate and delete for the existing objects under
[interaction v5](../architecture/0001-interaction-v5.md), is implemented and merged into main.

[0001-W4 v3 — Define note geometry and text growth](0001-W4-define-note-geometry-and-text-growth.md),
square stickies and notes that grow taller to fit their text under
[interaction v6](../architecture/0001-interaction-v6.md), is implemented and merged into main.

[0001-W13 v3 — Navigate the canvas with trackpad and mouse wheel](0001-W13-navigate-the-canvas-with-trackpad-and-mouse-wheel.md),
scroll to pan, pinch or Ctrl/Cmd+wheel to zoom around the pointer, and Space + drag
under [interaction v7](../architecture/0001-interaction-v7.md), is implemented and merged into main.

[0001-W5 v1 — Persist note colors and basic text styles](0001-W5-persist-note-colors-and-basic-text-styles.md),
eight colours, four text sizes and alignment saved through
[document v2](../architecture/0001-document-v2.md) under
[interaction v8](../architecture/0001-interaction-v8.md), is implemented and merged into main.

[0001-W14 v1 — Edit an unnamed board](0001-W14-edit-an-unnamed-board.md), an invalid
board name blocking only Save under
[interaction v9](../architecture/0001-interaction-v9.md), is implemented and merged into main.

[0001-W7 v1 — Select and move multiple objects](0001-W7-select-and-move-multiple-objects.md),
a selection box, Shift-click, select all and a multiple-selection Objects list, with
moves, commands and undo acting on the whole set under
[interaction v10](../architecture/0001-interaction-v10.md), is implemented and merged into main.

[0001-W8 v1 — Resize selected objects](0001-W8-resize-selected-objects.md), corner
handles for one object or a set, minimum sizes, a floor that keeps text visible within
the height limits, and size buttons in Objects under
[interaction v11](../architecture/0001-interaction-v11.md), is implemented and merged into main.

[0001-W9 v1 — Align and order selected objects](0001-W9-align-and-order-selected-objects.md),
aligning, distributing and restacking selected objects from an Arrange menu and
Objects under [interaction v12](../architecture/0001-interaction-v12.md), is implemented and merged into main.

[0001-W10 v1 — Group and ungroup objects](0001-W10-group-and-ungroup-objects.md),
one-level groups selected and edited together, saved through
[document v3](../architecture/0001-document-v3.md) under
[interaction v13](../architecture/0001-interaction-v13.md), is implemented and merged into main.

[0001-W11 v1 — Copy and paste board objects](0001-W11-copy-and-paste-board-objects.md),
copying, cutting and pasting selected objects within Board under
[interaction v14](../architecture/0001-interaction-v14.md), is implemented and merged into main.

[0001-W15 v1 — Move the screen parts out of App.tsx](0001-W15-move-screen-parts-out-of-app.md),
moving the bars and panels around the canvas into their own components with no change
in behaviour under [web modules v1](../architecture/0001-web-modules-v1.md), is implemented and merged into main.

[0001-W16 v1 — Object types and the canvas drawing](0001-W16-object-types-and-canvas-drawing.md),
an object-type registry and the canvas drawing in their own modules with no change in
behaviour under [web modules v2](../architecture/0001-web-modules-v2.md), is implemented and merged into main.

[0001-W17 v1 — Move panel layout and context bar state into hooks](0001-W17-panel-layout-and-context-bar-hooks.md),
the first state hooks and a tested context-bar position module with no change in
behaviour under [web modules v3](../architecture/0001-web-modules-v3.md), is implemented and merged into main.

[0001-W18 v1 — Move the board document and messages into hooks](0001-W18-board-document-and-messages-hooks.md)
is a draft: the board document and the messages in their own hooks and a tested
notice-message module, with no change in behaviour and no effect moved, following
[web modules v4](../architecture/0001-web-modules-v4.md).

Each brief is a complete contributor-facing contract. Use this structure:

```text
BRIEF VERSION: <ID> v<integer> (<YYYY-MM-DD>)
# <ID> — <outcome>
Status: Draft | Accepted prerequisites | Ready | Implemented | Superseded

## Outcome
## Read first
## Prerequisite architecture contracts
## Deliverables
## Numbered acceptance criteria
## Applicable DESIGN.md guardrails
## Validation commands and expected evidence
## Exclusions and reasons
## Public references with retrieval dates
## Implementation record
Branch, validated source/test revision, commands and results, dependencies,
exclusions, final handoff reference.
```

An amendment retains the ID and increments the version. All requirements and
build inputs must be available in this repository or documented public sources.
Record the revision validation ran against; a subsequent implementation-record
commit has a different hash. UI briefs include approved design references.
