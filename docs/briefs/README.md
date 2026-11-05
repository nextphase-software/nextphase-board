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
in which a selected connector's bar sets its colour, line style, start and end heads and line
shape (elbowed, curved or straight); dragging an end circle, or Objects' Ends fields, moves that
end to another idea or side and pins it; new connectors take the last style chosen; styles and
sides are saved in document version 9, following
[document v9](../architecture/0001-document-v9.md),
[interaction v23](../architecture/0001-interaction-v23.md) and
[web modules v21](../architecture/0001-web-modules-v21.md), is implemented and merged into main.

[0012-W1 v1 — Paste and import local images](0012-W1-paste-and-import-local-images.md),
in which an Image button, pasting and dropping files put PNG, JPEG, GIF and WebP pictures on the
board as images that move, resize keeping their shape, copy and carry a description; each picture
is stored once in the browser beside the board, and board files carry the pictures, following
[document v10](../architecture/0001-document-v10.md),
[storage v3](../architecture/0001-storage-v3.md),
[board file v2](../architecture/0006-board-file-v2.md),
[interaction v24](../architecture/0001-interaction-v24.md) and
[web modules v22](../architecture/0001-web-modules-v22.md), is implemented and merged into main.

[0001-W12 v1 — Upgrade the toolchain to Node 26 LTS](0001-W12-upgrade-the-toolchain-to-node-26-lts.md)
in which the pinned toolchain moves from Node.js 24.22.1 to Node.js 26.13.0, the first
Node 26 LTS release, with its bundled npm 11.20.0; the dependency lock changes only in its root
`engines` values and the application, its dependencies and its behavior stay the same, following
[toolchain v2](../architecture/0001-toolchain-v2.md), is implemented and merged into main.

[0016-W2 v1 — Board rules move into a shared package](0016-W2-board-rules-package.md),
in which the saved document and its validation, text marks, the style palette and the eight
object types move from the web app into `packages/board-rules`, a package the web app links with
npm and imports by name, so that a server can later use the same rules; the Yjs adapter stays in
the web app and nothing a person sees or saves changes, following
[toolchain v3](../architecture/0001-toolchain-v3.md) and
[web modules v23](../architecture/0001-web-modules-v23.md), is implemented and merged into main.

[0003-W1 v1 — Enforce owner, editor and viewer access](0003-W1-owner-editor-viewer-access.md),
in which Board gets its server, in which the workspace owner invites people as editors,
viewers or guests of the workspace or of a single board, a person's role on a board is the
highest any level gives them, and the server refuses everything else with a reason; the same
room runs in a Cloudflare Durable Object and in a Node process for self-hosting, one test suite
checks both against a local Supabase stack, and the web app does not change, following the
[0003 identity](../architecture/0003-identity-v1.md), [access](../architecture/0003-access-v1.md),
[API](../architecture/0003-api-v1.md), [sync](../architecture/0003-sync-v1.md),
[hosted persistence](../architecture/0003-hosted-persistence-v1.md) and
[self-host runner](../architecture/0003-self-host-runner-v1.md) contracts,
[document v11](../architecture/0001-document-v11.md),
[toolchain v4](../architecture/0001-toolchain-v4.md) and
[web modules v24](../architecture/0001-web-modules-v24.md), is implemented and merged into main.

[0003-W3 v1 — Discover and reopen workspace boards](0003-W3-discover-and-reopen-workspace-boards.md),
in which the server lists a person's workspaces, the boards in a workspace on which they have
a role and the boards they opened most recently, an editor can rename a board, and a new board
can be created as "Untitled"; the board's room copies its saved name and last-edited time to
Supabase for the lists without ever holding up a save, and the web app does not change,
following the [0003 API v2](../architecture/0003-api-v2.md),
[access v2](../architecture/0003-access-v2.md) and
[hosted persistence v2](../architecture/0003-hosted-persistence-v2.md) contracts, is implemented
and merged into main.

[0003-W2 v1 — Revoke access across active sessions](0003-W2-revoke-access-across-active-sessions.md),
in which the workspace owner lowers or removes a person's workspace role or board grant, the
person's role on every board is worked out again from what is left, each board's room refuses
their edits, deletes their waiting edits and closes their connections within 2 seconds, nothing
gives the access back, the owner is told when every board has applied the change, a retry every
minute finishes what a board missed, and the operator can disable and enable a person; the web
app does not change, following the [0003 access v3](../architecture/0003-access-v3.md),
[API v3](../architecture/0003-api-v3.md), [sync v2](../architecture/0003-sync-v2.md) and
[identity v2](../architecture/0003-identity-v2.md) contracts, is implemented and merged into main.

[0004-W1 v1 — Edit together with participant presence](0004-W1-edit-together-with-participant-presence.md),
in which everyone connected to a hosted board sees who else is there, with a label, role and
colour the room stamps and each connection's cursor, selection and view; presence is never stored
and expires after 30 seconds; text typed by two people in one note merges by character, the last
saved value wins for every other property, a delete beats a concurrent change, and the room
repairs the merges two valid edits can produce; undo and redo take back only a person's own
steps; and a shared client speaks the room protocol with no screen. Nothing changes on screen,
following the new [0004 presence v1](../architecture/0004-presence-v1.md) contract and the
[0003 sync v3](../architecture/0003-sync-v3.md), [API v4](../architecture/0003-api-v4.md),
[identity v3](../architecture/0003-identity-v3.md), [access v4](../architecture/0003-access-v4.md)
and [hosted persistence v3](../architecture/0003-hosted-persistence-v3.md) contracts, is implemented and
merged into main.

[0003-W4 v1 — Sign in, share and see access in the web app](0003-W4-sign-in-share-and-see-access.md)
in which, with team features switched on at build time (off by default), a person signs in
with a 6-digit code emailed by Supabase Auth, opens a hosted board by its link (a signed-out
person is asked to sign in first), edits as an owner or editor or only views as a viewer, and
sees the hosted save states and a plain message for every refusal; the workspace owner invites
people by link, sees who has access and where each role comes from, changes and removes roles
and cancels invitations from a Share dialog. With team features off nothing changes, following
the new [0003 hosted storage v1](../architecture/0003-hosted-storage-v1.md) contract and
[interaction v25](../architecture/0001-interaction-v25.md),
[web modules v25](../architecture/0001-web-modules-v25.md),
[0003 sync v4](../architecture/0003-sync-v4.md) and
[toolchain v5](../architecture/0001-toolchain-v5.md), is implemented and merged into main.

[0004-W3 v2 — See who is on a board and where they are](0004-W3-see-who-is-on-a-board-and-where-they-are.md)
in which, on a hosted board, everyone sees an avatar per person before the save status (at
most three, then "+N") with a people menu, and each other connection's cursor, name pill and
selection outline in its colour; clicking a person follows their view until you stop, move the
view yourself or they leave; **Show other people's cursors** (⌥⌘\ / Ctrl+Alt+\) hides cursors
for you only and is remembered on the device. Presence never changes the board or the save
state. It uses [interaction v26](../architecture/0001-interaction-v26.md) with its look in
[interaction v27](../architecture/0001-interaction-v27.md),
[web modules v26](../architecture/0001-web-modules-v26.md) and
[0003 hosted storage v2](../architecture/0003-hosted-storage-v2.md), with no server, room,
shared-client or dependency change, is implemented and merged into main.

[0003-W5 v1 — Find, create and reopen boards in the web app](0003-W5-find-create-and-reopen-boards.md)
in which, with team features on, a signed-in person's Home at `#/files` shows their recent
boards and one page per workspace as a grid of cards (name, last edited, their role), sorted by
name, date created or last modified; owners and editors create "Untitled" boards that open at
once, and rename boards from a card's menu or from the open board's name field; a card opens its
board, in this tab or a new one, and copies its link; **Back to files** in the Board panel and
closing a hosted board return to Home. It uses
[interaction v28](../architecture/0001-interaction-v28.md),
[web modules v27](../architecture/0001-web-modules-v27.md) and
[0003 hosted storage v3](../architecture/0003-hosted-storage-v3.md), with no server, room,
shared-client or dependency change, is implemented and merged into main.

[0004-W2 v1 — Recover shared edits after interruption](0004-W2-recover-shared-edits-after-interruption.md)
in which, when a hosted board's connection drops, the edits the room had not answered stay in
the open tab, which is view only and says how many changes wait; on rejoin the shared client sends
them again in order under their own request IDs, and the room saves each once. After a restore, an
access change or removal, a sign-out or a sign-in that could not be renewed, nothing is sent again
and the tab says how many changes may not have been saved and why. Leaving the board while changes
wait asks first. It uses [0003 sync v5](../architecture/0003-sync-v5.md) (`joined` gains
`restoreGeneration`), [0003 hosted storage v4](../architecture/0003-hosted-storage-v4.md) and
[interaction v29](../architecture/0001-interaction-v29.md), with no access, API, storage format or
dependency change, is implemented and merged into main.

[0005-W1 v1 — Discuss and resolve anchored ideas](0005-W1-discuss-and-resolve-anchored-ideas.md)
in which anyone with a role on a hosted board, viewers included, starts a comment thread on an
object or an empty spot, replies, resolves and reopens it, and only a comment's author edits or
deletes it. Threads live beside the board in the room's database, follow their objects, and stay
where they were, marked detached, when the object is deleted. Plain text, a comments panel with
filters, and nothing queued while offline. It uses [0005 comments v1](../architecture/0005-comments-v1.md)
(new), [0003 sync v6](../architecture/0003-sync-v6.md), [0003 access v5](../architecture/0003-access-v5.md),
[0003 hosted persistence v4](../architecture/0003-hosted-persistence-v4.md) (storage version 3),
[0003 hosted storage v5](../architecture/0003-hosted-storage-v5.md) and
[interaction v30](../architecture/0001-interaction-v30.md), with no dependency change, is implemented
and merged into main.

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
