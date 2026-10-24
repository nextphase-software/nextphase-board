# 0001 — Interaction and browser contract

Contract version: 13 (for 0001-W10 brief v1, 2026-10-24). Status: Draft. When
accepted it replaces [interaction v12](0001-interaction-v12.md) for later work. Uses
[document v3](0001-document-v3.md) and unchanged [storage v1](0001-storage-v1.md).

Every rule in v12 (and, through it, v11, v10, v9, v8, v7, v6, v5, v4 and the 0001-W3
presentation) still applies except where this version replaces or adds to it. This
version adds **groups**: objects that share a document v3 group ID are selected
together, and two commands, **Group** and **Ungroup**, create and dissolve groups.
It replaces v4's rule that a double-click edits "the selected object": a double-click
now edits the object under the pointer, as below.

## Terms

An object's **group** is the set of objects with the same group ID; an object whose
group ID is `null` is its own group. To **expand** a set of objects is to add every
object of each of their groups. A group is **whole** in the selection when every
object of it is selected.

## Selecting

Selection is expanded only where this section says; everything else that acts on
the selection (moves, resizing, styles, arrangement, Duplicate, Delete, Undo and
Redo's selection) acts on exactly the selected objects, as before.

The rows are checked in order, and the first that matches applies.

| Action | Selection afterwards |
| --- | --- |
| A press, in any view and without Shift, on the object that is already the only selected object | Unchanged: it stays selected alone, without expansion |
| Any other press or release that v10 says selects an object alone: a press on an unselected object, a release under 3 CSS pixels on a member of a larger selection, a press in a read-only view, and a click on an object while a placement is armed (v4) | That object's group, expanded |
| Shift-press on an object | If its group is whole in the selection, every object of the group is removed; otherwise every object of the group is added |
| A selection box (v10, with the live preview of v11) | The touched objects, expanded; with Shift, the previous selection plus the touched objects, expanded |
| Cmd/Ctrl+A on the scene | Every object, as before |
| Objects' list | Exactly the options chosen, without expansion; it is the route to select one member of a group |

A drag after a press moves exactly the objects selected at the start of the drag,
as v10 specifies, so moving a whole group moves all of it.

**Double-click.** A double-click on an object selects that object alone, without
expanding its group, and opens its on-canvas editor under v4's rules; in a
read-only view it only selects the object. The object is the topmost one under the
pointer, as for a press. A double-click on empty canvas does nothing, as before.
Pressing that object again keeps it selected alone (the table above), so it can then
be dragged on its own.

## Showing a group

For each group of two or more objects that is whole in the selection, a dashed
outline is drawn around the group's bounding box of drawn rectangles (v11): 1 CSS
pixel wide, `#518de0`, dashes and gaps of 4 CSS pixels, drawn above the objects and
below every floating control, hidden from assistive technology. It keeps that width
at every zoom. Each selected object also keeps its own selection stroke.

## Group and Ungroup

| Command | Effect |
| --- | --- |
| Group | Every selected object gets one new group ID (document v3's fresh identifier). Objects that were in other groups leave them; those groups keep their other members. Unselected objects never change |
| Ungroup | For every group ID held by at least one selected object, every object holding that ID, selected or not, gets `null` |

Each is one semantic transaction and one history step, advances the draft revision
once and leaves the board Unsaved. Neither changes order, positions, sizes, styles
or text, nor the selection; focus follows v12's rules for arrangement commands.

**Availability.** Both use v9's editing-command reasons first. Then Group needs two
or more selected objects ("Select two or more objects to group.") and is unavailable
when the selected objects already form exactly one whole group with no other members
("The selected objects are already one group."). Ungroup needs at least one selected
object with a group ID ("Select a grouped object to ungroup."). The first applicable
reason is shown, in that order.

## Duplicate and other commands

Duplicate keeps v10's rules and adds one: for each group ID among the duplicated
objects, if every object holding that ID is being duplicated, their copies all get
one new group ID (fresh, as above); otherwise their copies get `null`. Copies of
ungrouped objects are ungrouped.

Delete removes exactly the selected objects; the other members of their groups keep
their group ID, so a group may be left with one member. Undo and Redo restore every
object's group ID with the rest of its content (document v3).

## Controls

v12's Arrange menu and Objects' Arrange group gain a fourth group of buttons,
**Group**, after Order, with two buttons: **Group** and **Ungroup**. They follow v12's
menu rules (Tab, Escape, closing, focus back to Arrange, reasons as tooltip and
description). No keyboard shortcut is added.

## Objects' labels

Each option in Objects' list is labelled as before, with ` · Group N` inserted after
the type and position for an object that has a group ID: for example "sticky 2 ·
Group 1 · Plan". Groups are numbered from 1 in the order of their lowest-ordered
member, counting every group ID present, including groups of one.

## History

v12's history table gains a row: **Group**, **Ungroup**, one step each. Steps record
each changed object's group ID as part of the object, so Undo and Redo restore it
exactly, and select the step's objects afterwards as v10 specifies.

## Opening older boards

A board saved as document v1 or v2 opens with no groups and otherwise exactly as
before. Opening changes nothing: it is not Unsaved and adds no history. The first
Save after an edit writes document v3.

## Verification boundary

Desktop Chrome and Safari as installed. Unit tests cover document v3 (validation,
reading versions 1 and 2, per-version canonical output, the upgrade, the adapter's
group value), Group and Ungroup (regrouping members of other groups, ungrouping
partly selected groups, the reasons and their order), expanding a selection
(press, Shift, box, Shift + box), numbering, Duplicate's group rule, and history steps
for Group and Ungroup. Every existing history case stays unchanged; existing document
and storage cases change only as the brief lists, to follow version 3 becoming the
current version.

Browser checks cover grouping two objects and clicking one (both selected, outline
shown); moving the group and undoing; ungrouping and undoing; double-clicking a
member to edit only it; a box touching one member; Shift-click on a group; duplicating
and deleting a group; Objects' labels; saving and reloading with the group kept; and
a board saved by the build before this change opening unchanged, with nothing written
until Save. v12's remaining rows still describe available coverage, not automatic
gates.
