# 0001 — Interaction and browser contract

Contract version: 40 (for 0009-W2 brief v1, 2026-11-14). Status: Draft. When accepted it replaces
[interaction v39](0001-interaction-v39.md) for later work. Uses [document v16](0001-document-v16.md).

Every rule in v39 (and, through it, v38 back to v4 and the 0001-W3 presentation) still applies except
where this version replaces or adds to it. This version adds **mind maps**: a Mind map tool places a
starter map, round buttons and two keys add children and siblings, the map lays itself out after
every change, a node dragged onto another node moves there with its branch, a branch can be collapsed,
and every step is one Undo. Local and hosted boards behave the same. Document v16's **terms** (mind
node, root, children, descendants, map, first-level node) are used throughout.

A mind node is **not** an idea where v39 says idea, except that it is selected, deleted, copied,
pasted, duplicated, listed in Objects and undone as below. It is never grouped (Group is unavailable
whenever the selection holds a mind node, with the reason `Mind map nodes can't be grouped.`), never a section
member (a section never captures or carries it), never a connector end (no connection dots; never a
target), never voted on, has no resize handles and no Arrange menu. Whenever the selection holds a
mind node, wherever these commands appear (context bar, Objects panel) they are unavailable with
these reasons: Align, Distribute and Order `Mind map nodes are placed by their map.`; Section from
selection `Mind map nodes can't be put in a section.`; Connect `Mind map nodes can't be connected.`;
Group as above. Unavailable controls keep their existing disabled look and reason line.

## Terms

A node's **look**: a root uses Large (24) bold; any other node Medium (18) regular. Both use the text
font and line height of v21 (`system-ui`, 1.45) and the node's text colour; a node has no fill and no
border. A node's **outer side** is its first-level ancestor's side (the first-level node's own side
for itself); a root has two outer sides. A node is **visible** when no ancestor is collapsed. A
**hidden** node is not drawn, not hit, not selectable, not in Select All, Objects or the box
selection, and takes no part in layout; it stays in the document.

## The Mind map tool

The bottom toolbar gains a **Mind map** tool directly after the Section tool, the same icon button as
the other placement tools: accessible name "Mind map tool", tooltip "Mind map", `aria-pressed` while
armed, unavailable exactly when the other placement tools are. Its icon is three rounded boxes (one on
the left, two on the right) joined by two curves, stroke 1.75, `currentColor`, round caps and joins:
in a 20 × 20 viewBox, rects (2.5, 8, 5 × 4), (12.5, 3, 5 × 4) and (12.5, 13, 5 × 4), each rx 1, and
the path `M7.5 10c2.5 0 2.5-5 5-5M7.5 10c2.5 0 2.5 5 5 5`.

With the tool armed, a click on empty canvas, or Enter with the canvas focused (view centre), places
the **starter map**: a root "Main topic" and three right-side first-level nodes "First idea", "Second
idea", "Third idea" (ranks 0, 1, 2), laid out with the root's box centred on the click point. The
four nodes are added in one transaction with their layout. The tool returns to Select, the root is
selected and opens in the node editor with all its text selected, and the map frame shows.

## Layout

Every change to a map (adding, editing text, reparenting, detaching, deleting, collapsing, expanding,
moving a root) lays out **the whole map** and writes every visible node's `x`, `y`, `width` and
`height` in the same transaction; a map that loses or gains nodes in the same change is laid out too.
Hidden nodes keep their saved values. Laying out a map twice in a row changes nothing.

1. **Box.** Measure the text in the node's look with the app's text measurement, wrapping words at
   **320** px (a word longer than 320 breaks between characters). Width = the widest line, capped at
   320, plus **8** px on each side, rounded up. Height = lines × size × 1.45 plus **6** px top and
   bottom, rounded up. An empty node is measured as its placeholder "Add text".
2. **Order.** Siblings are ordered by `rank`, then `id`. After any change to a sibling list, the
   ranks of that list are rewritten 0, 1, 2… in that order.
3. **Columns.** Each side of a map is laid out on its own. Depth 1 is the root's children on that
   side. On the right, column *d* starts **72** px after the right edge of the widest box in column
   *d − 1* (column 0 is the root); a node's left edge sits on its column. On the left, mirrored: column
   *d* ends 72 px before the left edge of the widest box in column *d − 1*, and a node's right edge
   sits on its column.
4. **Blocks.** A node's block height is its own height when it has no visible children, otherwise the
   larger of its own height and the sum of its visible children's blocks plus **32** px between each
   two. Children are stacked top to bottom in order, the stack centred on the parent's block; a node
   is centred vertically on its block.
5. **Root.** The root's position is the map's anchor: it does not move during layout. Each side's
   stack of first-level blocks is centred on the root's vertical centre.
6. **Rounding.** Every position is computed without rounding from the root's stored integer `x`
   and `y` and the integer box sizes. Layout first rounds the root's `x` and `y` to integers (halves
   up) and writes them, because moves, pastes and insertions may leave them fractional; every other
   node's final `x` and `y` is then rounded **once** (halves up). No other rounded value feeds
   another node's computation.

**When layout runs.** The board's commit lays out, on the very document it is committing, every map
the commit changes, using the nodes' saved `width` and `height` (no measuring), except the map of a
node whose text session is open. Ending a text session, including when a commit ends it, lays that
map out in the same commit and step. Text is measured (with the app's measurement, in the node's
look) only where a box changes: on each keystroke of a node's text (its box is written grown from a
fixed corner: the left and top edges for the root and right-side nodes, the right and top edges for
left-side nodes; no other node moves), when a node is added, and when a node becomes or stops being
a root (detach, join, deleting a root, pasting or inserting as a root).
The starter map's and a detached root's position is computed (root box centred on the point) and
rounded once; after that a root's `x` and `y` change only when its map is moved.

## Branches

A branch line is drawn from every visible non-root node to its parent, under all nodes, in the
connectors' band: colour `#6b6b6b`, width 3.5, round caps. It is the cubic curve from the middle of
the parent's box edge on the child's side to the middle of the child's box edge facing the parent,
with both control points halfway across horizontally (the first at the start's height, the second at
the end's). Lines are never selectable or hit.

## Selecting

A click on a visible node's box selects it; Shift-click toggles it into the selection; box selection
takes visible nodes by the app's existing box-selection rule; hidden nodes are never taken. A selected node shows the v21 selection
outline (2 px `#518de0` on its box) and **no** resize handles or connection dots.

With exactly one node selected, not while its text is being edited or a drag is in progress, and
only while the board is editable (not read-only, not a viewer, not previewing history), the canvas
shows its **add buttons**: 22 px circles, white fill, 1.5 px `#518de0` ring, a 10 × 10 plus in
`#518de0` (stroke 1.75, round caps); each is a `<button>` with a 28 × 28 hit area, `cursor:
pointer`, and a tooltip on hover and focus (12 px, line height 1.35, the app's interface font,
white on `#302d36`, radius 4, padding 4 px 8 px) whose top edge is 18 px below the button's centre,
centred on it. Hover: fill `#eef4fd`; pressed: fill `#dce8fb`; keyboard focus: 2 px `#518de0` outline
2 px out. The global button look does not apply: no other border, radius 50 %, padding 0, no minimum
size, white background. Disabled: the global disabled opacity (.45). They follow the scene in tab
order.
- A root shows two, centred **20** px outside its left and right box edges at mid-height, named
  "Add child on the left" and "Add child on the right", tooltip "Add child ⌘↩" (Ctrl+Enter off Mac).
- Any other node shows **add child** centred 20 px outside its outer box edge at mid-height (28 px
  further out when its collapse badge shows), named "Add child", tooltip "Add child ⌘↩" (Ctrl+Enter),
  and **add sibling** centred 20 px below its box at its horizontal centre, named "Add sibling",
  tooltip "Add sibling ⌘⇧↩" (Ctrl+Shift+Enter).

With a root selected, or while a map is dragged, the **map frame** shows: a 1 px `#8fbdf5` rectangle
16 px outside the bounds of the map's visible boxes, its edges on half pixels (crisp).

## Adding nodes

**Add child** (button or ⌘↩, Ctrl+Enter elsewhere, with one node selected or being edited) adds an
empty node as the last child; on a root, ⌘↩ adds on the side with fewer first-level nodes (right when
equal), and a root's button adds on its own side. Adding to a collapsed node expands it first, in the
same step. **Add sibling** (button or ⌘⇧↩) adds an empty node directly after the selected node under
the same parent (on the same side for a first-level node); on a root it does nothing. The new node is
laid out with its map, selected, and opens in the node editor. A new node is empty and neutral
(it does not take its parent's colour). Adding a node, the text typed into it until editing ends and
the layout at the end are **one** Undo step, locally and in shared Undo.

## Editing text

Double-click, Enter or Edit text opens the **node editor**: a textarea exactly over the node's box
(growing with it as above), with the box's 8 px side and 6 px top and bottom padding, the node's look
(24 bold or 18 regular, `system-ui`, line height 1.45, the node's colour), no border, background or
resize grip, wrapping at 320 px. Only the placement that creates a starter map opens its root with
all text selected; every other opening puts the caret at the end. Where the existing editor falls
back to the Objects panel (narrow screen, off screen, obscured, small zoom), a node's editor does the
same. Enter and Escape end editing (a node has no line breaks: pasted line
breaks become spaces). Text over 200 code points takes the existing over-limit state that text
objects have at 1,000 (the object is marked invalid and Save is refused until it is corrected). An
empty node shows "Add text" in `#79737f` as the editor's placeholder and on the canvas after editing;
empty nodes are kept.

## Moving and reparenting

Dragging starts as for any object. With **one** node pressed and dragged (alone, or the only selected
object):
- the node and all its descendants follow the pointer, the nodes at **60 %** opacity and the lines
  between them at full opacity; the dragged node shows no selection outline and no map frame shows;
  the rest of its map is drawn laid out without them for the drag (from saved boxes, nothing
  committed until release);
- the **target** is the topmost visible node whose box contains the pointer, never the dragged node or
  one of its descendants; over a target, a 3 px `#518de0` outline with corner radius 2 is drawn 1.5 px
  outside the target's box, and a 2 px dashed (6 4, round caps) `#518de0` curve, shaped as a branch,
  joins the target to the dragged node;
- **release over a target**: the node becomes the target's last child with its branch (on a root, on
  the side of the root's vertical centre line the pointer is on); a collapsed target expands. Status:
  `Moved “<node>” under “<target>”.`;
- **release elsewhere**: a non-root node becomes the root of a new map whose root box is centred where
  the dragged box's centre was. Status: `“<node>” is now
  a separate map.` Its children become first-level nodes on the **right**. A dragged root simply
  moves its map;
- Escape during the drag cancels it and changes nothing.

Any drag of a selection holding more than one object moves every map that has a selected node as a
whole, with the other selected objects, and never reparents. Dragging is not available while the board
is not editable.

**Cycle rule.** A node never becomes a child of itself or of one of its descendants: such targets are
never offered, and the document rules (v16) refuse any edit that would make a loop.

## Collapse

A non-root node with children can be collapsed and expanded with the context bar's **Collapse** /
**Expand** button. Collapsing hides its descendants and lays the map out again; expanding shows them.
A collapsed node with hidden descendants shows the **collapse badge**: a 20 px circle, white fill,
1.5 px `#6b6b6b` ring, centred 16 px outside its outer box edge at mid-height, holding the number of
hidden descendants (above 99, `99+`) in 11 px weight 600 `#3b3a40`. Its count uses `system-ui`. It is a `<button>` (drawn with the add buttons, 28 × 28 hit area,
`cursor: pointer`, named `Expand “<node>”, <n> hidden`, the same hover, pressed and focus looks as
the add buttons) and a click expands; while the board is not editable it is drawn but disabled (.45).
Comment pins anchored to a hidden node are drawn as today (a known limit of this version). Hidden selected nodes leave the selection. Status: `Collapsed “<node>”: <n> hidden.` and
`Expanded “<node>”.` Each is one Undo step.

## Deleting

Deleting a node with children moves its children up to its parent, in its place and order (with
their own branches), then lays the map out. Deleting a root makes each first-level node the root of
a separate map, its box centred where it was, its children on the right. When several nodes are
deleted together, each surviving child moves to its nearest surviving ancestor, and becomes a root
where it was if none survives. When a collapsed node is deleted, its children move up and are shown.
One Undo restores everything.

## Copy, paste and duplicate

Copy, cut, paste and duplicate (v21) carry mind nodes with their text, colour and collapse state.
Copying, cutting or duplicating a collapsed node also carries its hidden descendants (it stays
collapsed in the copy); cutting it removes them with it. Copies, team-template snapshots and saved
boxes of hidden nodes use their saved `x`, `y`, `width` and `height`.
The copied **snapshot** is already consistent: a node whose parent is also copied keeps that link;
any other copied node becomes a root (`parent` null, `side` null, `collapsed` false), its copied
children become first-level nodes on the right, and deeper copied nodes get `side` null. Pasting,
duplicating and inserting a saved team template remap ids as v21 does (so `parent` follows the new
ids) and lay out every inserted map with each root where the insertion puts it. Plain-text copy
writes a node's text like a text object's.

## Context bar

The v21 bar, placed by its existing rule (no connection dots, so 48 px above the selection, else 8
px below; hidden under 768 px wide). For one selected node: `Mind map node`, Edit text / Done,
`<n> / 200`, the text colour menu, then for a non-root node with children a divider and **Collapse**
(accessible name "Collapse branch") or, when collapsed, **Expand** ("Expand branch"), each in the
bar's shared button look, then Duplicate and Delete. The bar knows a node's children and collapse
state from the board App passes to it. In the Objects panel a single node shows its text field,
colour, the clipboard controls and the Arrange controls (unavailable, with the reasons above). No text size, alignment, formatting or Arrange
controls. Icons (20 × 20 viewBox, stroke 1.75, round caps and joins): Collapse `M4 10h5`, a circle at
(13.5, 10) r 3.5 and `M12 10h3`; Expand the same plus `M13.5 8.5v3`. For a selection of several mind
nodes, or mind nodes with other objects, the bar shows only what applies to every selected object.
A node's label in Delete and Duplicate messages follows the existing pattern with the prefix `mind
map node` (for example `Deleted mind map node 4 · First idea. Undo restores it.`).

## Objects panel

Visible mind nodes are listed with the existing label pattern and the prefix `mind map node` (as
text objects use `text`); hidden nodes are not listed. For a node the panel shows its text field and
colour, and no position, size, style or Arrange fields. The panel's Add list is unchanged: it offers
no mind map (the tool and Enter place one).

## Hosted boards

Every rule above applies on hosted boards; each change and its layout is one transaction and one
shared Undo step, and a text session's layout merges into that session's step. When two people
change one map at the same moment, the room repairs the merged nodes (document v16) and the last
layout written stands until the map's next change. A collaborator sees collapse states and
positions as saved. Shared Undo remaps `parent` like `section` when it restores objects, and also
within one step: when a step restores a node under a new identity, every `parent` in that step and in
older steps that names the old identity is rewritten to the new one (so undoing a delete that moved
children up puts them back under the restored node). A write that opens a node's first text session
right after the add of that node merges into the add's step, as does the layout written when that
session ends.

## Keys and announcements

⌘↩ / Ctrl+Enter and ⌘⇧↩ / Ctrl+Shift+Enter as above, with one node selected or being edited, the
canvas or the node editor focused (the page's key handler sees both; the canvas's Enter handling
ignores Enter with ⌘ or Ctrl). Enter edits; Escape ends editing or cancels a drag; Delete and
Backspace delete. Status messages go through the same path as the existing Delete message: the polite
notice on local boards; on hosted boards they are not shown, as Delete's message is not today: `Added a child to “<parent>”.` (`Added a node
to “<parent>”.` for a sibling), and the moving and collapse messages above. Node names in messages are
cut to 40 code points with `…`; an empty node is named `Empty`.
