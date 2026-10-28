# Implementation briefs

Brief and contract names start with the number of the feature they belong to: 0001 is
the first feature, "Capture and reopen ideas". A milestone is `<feature>-W<n>`, where W
stands for the web track and the number identifies the milestone; it is not the build
order. From 0016, structural work (refactors, toolchain and test support) has its own
feature number.

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

[0001-W18 v1 — Move the board document and messages into hooks](0001-W18-board-document-and-messages-hooks.md),
the board document and the messages in their own hooks and a tested notice-message
module with no change in behaviour under [web modules v4](../architecture/0001-web-modules-v4.md), is implemented and merged into main.

[0001-W19 v1 — Move the storage session into a hook](0001-W19-storage-session-hook.md),
the writer lock, opening, saving and reopening in their own hook with no change in
behaviour and one stale browser regression line fixed under [web modules v5](../architecture/0001-web-modules-v5.md), is implemented and merged into main.

[0001-W20 v1 — Move the editing commands into a hook](0001-W20-editing-commands-hook.md),
undo, redo, duplicate, delete, the clipboard, arrange and styles in their own hook with no
change in behaviour under [web modules v6](../architecture/0001-web-modules-v6.md), is implemented and merged into main.

[0001-W21 v1 — Move the viewport into hooks](0001-W21-viewport-hooks.md), the view with
wheel and trackpad zoom, and the canvas size, in two hooks each called where its effect
was, with no change in behaviour under [web modules v7](../architecture/0001-web-modules-v7.md), is implemented and merged into main.

[0001-W22 v1 — Move the geometry edits into a hook](0001-W22-geometry-edits-hook.md),
creating, moving and resizing objects and committing their text in their own hook, with no
change in behaviour and no effect moved under [web modules v8](../architecture/0001-web-modules-v8.md), is implemented and merged into main.

[0001-W23 v1 — Move the pointer and keyboard handlers into hooks](0001-W23-pointer-keyboard-hooks.md),
the canvas element's pointer and key handlers with their helpers and the two effects that
end a gesture in one hook called where they were, and the page's keyboard shortcuts in a
second, with no change in behaviour under [web modules v9](../architecture/0001-web-modules-v9.md), is implemented and merged into main.

[0001-W24 v1 — Move selection, object layouts, the editor and panels into hooks](0001-W24-selection-layouts-editor-hooks.md),
the selection values, the object layouts and resize handles, and where the text editor
opens with the panels and their three effects in three hooks, with no change in behaviour
under [web modules v10](../architecture/0001-web-modules-v10.md), is implemented and merged into main.

[0001-W25 v1 — Make App.tsx composition only](0001-W25-composition-only.md), owners for
the remaining state and element refs, the pure helpers as rules functions, the Content
field as a screen part and a check that `App.tsx` creates no React state of its own, with
no change in behaviour under [web modules v11](../architecture/0001-web-modules-v11.md),
is implemented and merged into main. With it the staged move out of `App.tsx` is complete.

[0016-W1 v1 — Object types own their per-type rules](0016-W1-per-type-rules.md), each
object type's default size and style, the style an old board gets on upgrade and its text
colour moved into the type's record, with the document rules asking the registry and the
style rules keeping only what every type shares, with no change in behaviour or saved
format under [web modules v12](../architecture/0001-web-modules-v12.md), is implemented
and merged into main.

[0001-W6 v1 — Bold, italic and strikethrough for whole objects](0001-W6-whole-object-formatting.md),
three buttons in the context bar and Objects formatting whole objects, saved as document
v4 marks beside the plain text, drawn on the canvas, kept on the same characters while
text is edited, and copied with the object, under
[document v4](../architecture/0001-document-v4.md),
[interaction v15](../architecture/0001-interaction-v15.md) and
[web modules v13](../architecture/0001-web-modules-v13.md), is implemented and merged into
main.

[0001-W26 v1 — Format selected text while editing](0001-W26-format-selected-text.md), the
buttons and Cmd/Ctrl+B, I and Shift+X formatting the text field's selection while editing,
with the editor kept open, the buttons showing the selection's state and a formatted preview
in Objects, under [interaction v16](../architecture/0001-interaction-v16.md) and
[web modules v14](../architecture/0001-web-modules-v14.md), is implemented and merged into
main.

[0002-W1 v1 — Organize ideas into sections](0002-W1-organize-sections.md), named sections
that hold ideas, created by drawing, placing, Add section or Section from selection, with ideas
joining and leaving by drop, placement and Objects' Section select and a section moving with
its members, saved as document v5 under [document v5](../architecture/0001-document-v5.md),
[interaction v17](../architecture/0001-interaction-v17.md) and
[web modules v15](../architecture/0001-web-modules-v15.md), is implemented and merged into
main.

[0002-W4 v1 — Draw basic shapes](0002-W4-draw-basic-shapes.md), one Shapes tool drawing
squares and circles that hold text, with a Shape menu, separate Fill and Border controls with 21
named colours and a custom colour, and long text that ends with an ellipsis and a button that
grows the shape to fit, saved as document v6 under
[document v6](../architecture/0001-document-v6.md),
[interaction v18](../architecture/0001-interaction-v18.md) and
[web modules v16](../architecture/0001-web-modules-v16.md), is implemented and merged into
main.

[0002-W2 v1 — Connect ideas](0002-W2-connect-ideas.md), connectors joining two ideas
(stickies, text or shapes), created by dragging a connection dot of a selected idea onto
another or by Connect in Objects, an elbowed grey line with an arrow at its `to` end and an
optional label on the line, routes that follow every move, and deleting an idea deleting its
connectors, saved as document v7 under [document v7](../architecture/0001-document-v7.md),
[interaction v19](../architecture/0001-interaction-v19.md) and
[web modules v17](../architecture/0001-web-modules-v17.md), is implemented and merged into
main.

[0006-W2 v1 — Export and restore a local Board file](0006-W2-export-and-restore-board-file.md),
in which Save a copy to file downloads the open board as a `.nextboard` file; Open board
file… checks a file completely and opens it as a new board in this browser, refusing damaged,
invalid or newer files with nothing changed; the Board panel lists the boards in this browser
and switches between them, asking first about unsaved edits; the board saved by earlier
versions stays where it is, following [storage v2](../architecture/0001-storage-v2.md),
[board file v1](../architecture/0006-board-file-v1.md),
[interaction v20](../architecture/0001-interaction-v20.md) and
[web modules v18](../architecture/0001-web-modules-v18.md), is implemented and merged into main.

[0008-W1 v1 — Insert a local editable activity](0008-W1-insert-a-local-editable-activity.md),
in which a Templates button opens a panel of three ready-made activities (Retrospective,
Brainstorm, Kanban, in [0008-W1-activities](0008-W1-activities/)); Add template copies an
activity's objects beside the existing content as ordinary, editable objects, selects them and
moves the view to them, in one history step, following
[activity catalogue v1](../architecture/0008-activity-catalogue-v1.md),
[interaction v21](../architecture/0001-interaction-v21.md) and
[web modules v19](../architecture/0001-web-modules-v19.md), is implemented and merged into main.

[0009-W1 v1 — Draw with pen, highlighter and eraser](0009-W1-draw-with-pen-highlighter-and-eraser.md)
in which a Draw button arms the Marker, the Highlighter or the Eraser, with a drawing bar for
weight and colour; drawn lines are saved as strokes in document version 8 and can be selected,
recoloured, resized, moved, copied, grouped and put in sections; the eraser removes whole strokes
and nothing else, following [document v8](../architecture/0001-document-v8.md),
[interaction v22](../architecture/0001-interaction-v22.md) and
[web modules v20](../architecture/0001-web-modules-v20.md), is implemented and merged into main.

[0002-W3 v1 — Style and reconnect relationships](0002-W3-style-and-reconnect-relationships.md)
is a draft: a selected connector's bar sets its colour, line style, start and end heads and line
shape (elbowed, curved or straight); dragging an end circle, or Objects' Ends fields, moves that
end to another idea or side and pins it; new connectors take the last style chosen; styles and
sides are saved in document version 9, following
[document v9](../architecture/0001-document-v9.md),
[interaction v23](../architecture/0001-interaction-v23.md) and
[web modules v21](../architecture/0001-web-modules-v21.md).

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
