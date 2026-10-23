# 0001 — Interaction and browser contract

Contract version: 5. Status: Draft for 0001-W2 brief v1. When accepted it replaces
[interaction v4](0001-interaction-v4.md) for later work. Uses unchanged
[document v1](0001-document-v1.md) and [storage v1](0001-storage-v1.md).

Every rule in v4 still applies except where this version replaces or adds to it.
The presentation delta in the [0001-W3 brief](../briefs/0001-W3-refresh-the-canvas-shell.md)
is part of this contract: board bar, save area, information control, icon palette,
icon view controls and the selection context bar as built there.

## Editing commands

Four commands act on the existing sticky and text objects: **Undo**, **Redo**,
**Duplicate** and **Delete**. Each completed command is one semantic document
transaction: it advances the draft revision once and leaves the board Unsaved.

| Command | Effect |
| --- | --- |
| Duplicate | Copies the selected object's type, text, width and height into a new object with a new logical ID and generation, placed at x+24, y+24 board units and clamped to the document range, appended last in reading order, then selected. At 250 objects it is refused with the existing limit explanation and no change. |
| Delete | Removes the selected object and adds its generation to `retiredGenerations`. Selection clears. A status message names the object and says Undo restores it. No confirmation dialog. |
| Undo | Reverts the most recent history step and moves it to the redo list. |
| Redo | Reapplies the most recently undone step. |

**Generation rule.** Any command that removes an object (Delete, Undo of a create
or duplicate, Redo of a delete) retires that object's current generation. Any
command that brings an object back (Undo of a delete, Redo of a create or
duplicate) keeps its logical ID, assigns a fresh generation and restores its type,
text, geometry and reading-order position. Retired generations are never reused or
removed. If retiring a generation would exceed document v1's 10,000 limit, the
command is refused with an explanation and no change.

## History

Board owns one linear history of document transactions, held in memory for the
current session only. It is never persisted, and Reopen, reload, page hide and any
change of writer ownership clear it. Reopening restores the last saved board
exactly as storage v1 specifies.

| Steps recorded | One step each |
| --- | --- |
| Create (palette placement or Objects Add) | yes |
| Move (completed drag, 10-unit native move) | yes; a cancelled drag records nothing |
| Text edit | one step per editing session: from opening an object's text on the canvas or in Objects until it closes, selection changes or focus leaves the field |
| Duplicate, Delete | yes |
| Board title, view, selection, panels, Save, Reopen | never |

History keeps at most 100 steps; the oldest is dropped first. A new recorded step
clears Redo. Save never clears history; undoing after a save produces an ordinary
Unsaved change. Undo and Redo are disabled, with a text reason, when their list is
empty, and every command is blocked with a reason while composition, a pointer
gesture or an invalid draft is active and in read-only views, matching Save.

## Keyboard and clipboard

| Keys | When focus is on the focused scene or a Board control | When focus is in a native text field |
| --- | --- | --- |
| Cmd/Ctrl+Z | Undo | Native text undo; not intercepted |
| Shift+Cmd/Ctrl+Z, Ctrl+Y | Redo | Native redo; not intercepted |
| Delete, Backspace | Delete the selected object (scene only) | Native character delete; not intercepted |
| Cmd/Ctrl+D | Duplicate the selected object (scene only); prevents the browser's bookmark default there only | Not intercepted |

This replaces v4's sentence that board commands never consume Delete: they still
never do inside native inputs. No letter shortcut is added; page-zoom and other
browser shortcuts stay uncaptured. Board does not read or write the system
clipboard in this version; copy, cut and paste in text fields stay native.

## Controls and focus

Undo and Redo are icon buttons in the board bar after Objects. Duplicate and Delete
are icon buttons in the selection context bar and buttons in the Objects panel.
They use the 0001-W3 icon rules, tooltips and states, with accessible names.

After Undo or Redo, the affected object is selected when it exists and focus stays
on the initiating control or scene; when the step removed the selected object,
selection clears and focus moves to the scene. After Delete, selection clears and
focus moves to the scene. After Duplicate, the copy is selected and focus stays
put. Status messages for commands use the existing live status region.

## Removed exclusion

v4 excluded delete, duplicate and undo/redo. This version adds exactly the commands
above. Multi-select, group actions, object copy/paste, collaborative or persisted
history and rich text remain excluded.

## Verification boundary

Desktop Chrome and Safari as installed. Pure history and command logic needs unit
tests with assertions on document state, generations and revision counts. Browser
checks cover each command by button and by shortcut on the scene, native text
undo inside a field, focus after each command, and save then reload. v4's
remaining verification rows still describe available coverage, not automatic gates.
