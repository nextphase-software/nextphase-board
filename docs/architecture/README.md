# Architecture contracts

Current accepted implementation contract set for 0001-W1 brief v6:

- [0001 document v1](0001-document-v1.md): identities, schema and limits.
- [0001 storage v1](0001-storage-v1.md): save ordering, writer ownership and recovery.
- [0001 interaction v4](0001-interaction-v4.md): full canvas, floating controls,
  native overlay/secondary-panel editing, placement, focus and browser evidence.
- [0001 toolchain v1](0001-toolchain-v1.md): exact pins, generated lock, notices,
  public-input verification and application commands.

[0001 interaction v5](0001-interaction-v5.md), accepted with 0001-W2, adds undo,
redo, duplicate and delete with session-only history and scene-scoped shortcuts,
and includes the 0001-W3 presentation. It replaces v4 for later work.

[0001 interaction v6](0001-interaction-v6.md), accepted with 0001-W4, makes new
stickies square and lets notes grow taller to fit their text. It replaces v5 for
later work.

[0001 interaction v7](0001-interaction-v7.md), accepted with 0001-W13, adds
trackpad and mouse-wheel navigation: scroll to pan, pinch or Ctrl/Cmd+wheel to zoom
around the pointer, and Space + drag. It replaces v6 for later work.

[0001 document v2](0001-document-v2.md) and [0001 interaction v8](0001-interaction-v8.md),
accepted with 0001-W5, add each object's colour, text size and alignment to the
saved format, define how version 1 boards are read, and add the palette, sizes,
alignment and their controls. They replace document v1 and interaction v7 for later
work.

[0001 interaction v9](0001-interaction-v9.md), accepted with 0001-W14, lets an
invalid board name block only Save, so editing commands stay available on an
unnamed board. It replaces v8 for later work.

[0001 interaction v10](0001-interaction-v10.md), accepted with 0001-W7, lets
several objects be selected, with a selection box, Shift-click, Cmd/Ctrl+A or the
Objects list, and moved, styled, duplicated, deleted and undone together. It
replaces v9 for later work.

[0001 interaction v11](0001-interaction-v11.md), accepted with 0001-W8, adds corner
handles that resize one object or a set, with minimum sizes, a floor that keeps text
visible within the height limits and size buttons in Objects, and corrects two
sentences of v10. It replaces v10 for later work.

[0001 interaction v12](0001-interaction-v12.md), accepted with 0001-W9, adds
aligning, distributing and restacking selected objects, from an Arrange menu and
Objects, with order recorded in undo history. It replaces v11 for later work.

[0001 document v3](0001-document-v3.md), accepted with 0001-W10, adds each object's
group to the saved format and defines how version 1 and 2 boards are read;
[0001 interaction v13](0001-interaction-v13.md), accepted with it, adds grouping,
ungrouping and selecting groups. They replace document v2 and interaction v12 for
later work.

[0001 interaction v14](0001-interaction-v14.md), accepted with 0001-W11, adds
copying, cutting and pasting selected objects through a per-tab object clipboard,
with their text written to the system clipboard as plain text. It replaces v13 for
later work.

[0001 web modules v1](0001-web-modules-v1.md), accepted with 0001-W15, describes how
the web app's source is organised (rules, state, object types, screen parts and
composition), who owns what, and the rules every later brief follows. It changes no
behaviour or contract.

[0001 web modules v2](0001-web-modules-v2.md), accepted with 0001-W16, adds the
object-type registry under `objects/` and the canvas drawing under `scene/`, and the
rule that composition and screen parts ask the registry instead of comparing type
names. It replaces v1 for later work.

[0001 web modules v3](0001-web-modules-v3.md), accepted with 0001-W17, starts the
state layer under `state/` with the panel layout and the context bar, and adds the
state-hook rules (one owner per piece of state, explicit inputs, effect order kept,
calculations in tested rules modules). It replaces v2 for later work.

[0001 web modules v4](0001-web-modules-v4.md), accepted with 0001-W18, keeps v3's rules
unchanged and updates the module inventory for the board document and messages hooks
and the notice-message rules module. It replaces v3 for later work.

[0001 web modules v5](0001-web-modules-v5.md), accepted with 0001-W19, keeps v3's rules
unchanged and updates the module inventory for the storage session hook. It replaces v4
for later work.

[0001 web modules v6](0001-web-modules-v6.md), accepted with 0001-W20, keeps v3's rules
unchanged and updates the module inventory for the editing commands hook. It replaces v5
for later work.

[0001 web modules v7](0001-web-modules-v7.md), accepted with 0001-W21, keeps v3's rules
unchanged and updates the module inventory for the viewport and canvas size hooks. It
replaces v6 for later work.

[0001 web modules v8](0001-web-modules-v8.md), accepted with 0001-W22, keeps v3's rules
unchanged, updates the module inventory for the geometry edits hook and records the
five-step plan for input and actions. It replaces v7 for later work.

[0001 web modules v9](0001-web-modules-v9.md), accepted with 0001-W23, keeps v3's rules
unchanged and updates the module inventory for the canvas input and page keys hooks. It
replaces v8 for later work.

[0001 web modules v10](0001-web-modules-v10.md), accepted with 0001-W24, keeps v3's rules
unchanged, updates the module inventory for the selection, object layouts and editor
placement hooks, and records the last part of the move in two steps. It replaces v9 for
later work.

[0001 web modules v11](0001-web-modules-v11.md), accepted with 0001-W25, records
`App.tsx` as composition only, amends rule 8 with one sentence (a value derived inline in
a hook may stay there; a named helper goes to a rules module) and marks the staged move
complete. It replaces v10 for later work.

[0001 web modules v12](0001-web-modules-v12.md), accepted with 0016-W1, amends rule 7
(no exceptions: everything that differs by object type lives in its record, and rules
modules ask the registry too), records that object types use `styles.ts` and that rules
modules may ask the registry, and updates the inventory. It replaces v11 for later work.

[0001 document v4](0001-document-v4.md), accepted with 0001-W6, adds each object's inline
formatting (`marks`, beside the unchanged plain text) to the saved format and defines how
version 1 to 3 boards are read; [0001 interaction v15](0001-interaction-v15.md), accepted
with it, adds Bold, Italic and Strikethrough for whole objects, the drawing of formatted
text and how formatting follows text edits; and [0001 web modules v13](0001-web-modules-v13.md)
adds the two new rules modules to the inventory with v12's rules unchanged. They replace
document v3, interaction v14 and web modules v12 for later work.

[0001 interaction v16](0001-interaction-v16.md), accepted with 0001-W26, lets the
formatting controls act on the text field's selection while editing, keeps the editor
open, adds Cmd/Ctrl+B, I and Shift+X and a formatted preview under the Content field; and
[0001 web modules v14](0001-web-modules-v14.md) adds the preview part and the selection to
the inventory with v12's rules unchanged. They replace interaction v15 and web modules v13
for later work.

[0001 document v5](0001-document-v5.md), accepted with 0002-W1, adds sections to the
saved format (a `section` type, each idea's `section` key, per-type size and text limits) and
defines how version 1 to 4 boards are read; [0001 interaction v17](0001-interaction-v17.md)
says how sections are drawn, created, named, joined and left, moved with their members,
ordered, grouped, deleted and copied, and how Objects shows membership; and
[0001 web modules v15](0001-web-modules-v15.md) adds the section type, its scene body and the
sections rules module to the inventory. They replace document v4, interaction v16 and web
modules v14 for later work.

[0001 document v6](0001-document-v6.md), accepted with 0002-W4, adds shapes to the saved
format (a `shape` type with its own `shape`, `fill` and `border` keys, so each type now has its
own key set) and defines how version 1 to 5 boards are read;
[0001 interaction v18](0001-interaction-v18.md) says how shapes are drawn, placed and coloured,
how their kind, fill and border change, what happens to long text, and how Objects shows them;
and [0001 web modules v16](0001-web-modules-v16.md) adds the shape type, its scene body and two
screen parts to the inventory. They replace document v5, interaction v17 and web modules v15
for later work.

Drafts for 0002-W2 brief v1: [0001 document v7](0001-document-v7.md) adds connectors to the
saved format (a `connector` type with `from` and `to` ends in place of a rectangle, the
eligibility and dangling rules) and defines how version 1 to 6 boards are read;
[0001 interaction v19](0001-interaction-v19.md) says how connectors are created from
connection dots or Connect, routed, drawn, labelled, selected, ordered, deleted and copied, and
how Objects shows them; and [0001 web modules v17](0001-web-modules-v17.md) adds the connector
type, two rules modules, two canvas parts and one screen part to the inventory. They replace
document v6, interaction v18 and web modules v16 for later work once accepted.

Document/storage/toolchain v1 are incorporated unchanged. Interaction v4 keeps
v3's functional behavior and records the explicit native OS IME deferral. Brief v6 supersedes prior broad verification prescriptions
with minimal change-scoped checks; broader testing needs explicit instruction.
Interaction v1/v2 remain historical for briefs
v2/v3 respectively; they do not override the current verification boundary.

Application implementation is authorized on its milestone branch. A dependency
smoke check does not establish application behavior or milestone acceptance; see
the brief implementation record for checks actually run.

Document the current system, supported interfaces, data formats, security
boundaries, configuration and build inputs here when an implementation needs
them. State behavior and constraints concretely, with public sources and dated
versions. Commit prerequisite contracts with or before their implementation brief.
Contributors must be able to build and verify the software from public material.
