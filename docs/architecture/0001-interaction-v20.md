# 0001 — Interaction and browser contract

Contract version: 20 (for 0006-W2 brief v1, 2026-10-27). Status: Draft. When
accepted it replaces [interaction v19](0001-interaction-v19.md) for later work. Uses
[document v7](0001-document-v7.md), [storage v2](0001-storage-v2.md) and
[the board file contract](0006-board-file-v1.md).

Every rule in v19 (and, through it, v18 back to v4 and the 0001-W3 presentation) still
applies except where this version replaces or adds to it. This version adds **board files and
several boards in one browser**: the Board panel saves a copy of the open board to a file,
opens a board file as a new board, and lists the boards kept in this browser. It replaces:
- the Board panel's contents and its footer text (see **The Board panel**);
- v19's list of commands that give "Connectors follow the ideas they join.": Section from
  selection also gives it (see **Connectors**).

Reopen, Retry editing, the recovery view, the notice's position and every other control are
unchanged.

## The Board panel

Top to bottom: the Board name label, field and counter (unchanged); **Save a copy to file**;
**Open board file…**; **Reopen** (unchanged); the heading "Boards in this browser" and the
**board list**; the footer "Boards are kept only in this browser profile, and browser storage
is not a backup. Save a copy to file to keep one."; **Close board details** (unchanged). The two
file commands are full-width buttons stacked one above the other, like Reopen. The panel keeps
its position, width, height cap and single scroll: when its contents are taller than the cap,
the whole panel scrolls; the list has no scroll area of its own.

## Save a copy to file

Downloads the open board as a board file named by the board file contract, through the
browser's own download (a link with the `download` attribute to a `Blob` of type
`application/octet-stream`). Nothing is saved and nothing changes. The file holds the board as
shown, unsaved edits included, as the board file contract's **Writing** says.

Available whenever a board is shown, read-only included, except while an editor draft is
invalid, a gesture is in progress, text is being composed, or a board or file is being opened;
then it is unavailable (`disabled`). If the board cannot be written within the file limit, the
notice reads "Could not save a copy to file: the board is larger than 4 MB." and nothing is
downloaded.

## Open board file…

Opens the browser's file picker for one file, accepting `.nextboard` and `.json`. Unavailable
while a gesture is in progress, text is being composed, or a board or file is being opened.
Available in a read-only tab: the file becomes a new board, which that tab then edits.

The chosen file is read and checked completely first (board file contract, **Reading**):
- **Refused:** the notice reads "“<file name>” was not opened: <reason>. Nothing changed." with
  the contract's reason. Nothing is written, no question is asked, and the open board, its
  drafts, selection, history and focus stay as they were.
- **Accepted:** if the open board has unsaved edits, the question below asks first; then the
  file becomes a new board (storage v2) and opens in this tab. The notice reads "Opened “<file
  name>” as a new board in this browser. Your other boards are unchanged." Focus stays on Open
  board file….

If the accepted file cannot be saved as a new board (its writer lock is not granted, or the
transaction fails), the notice reads "“<file name>” was not opened: the board could not be
saved in this browser. Nothing changed." and the open board stays as it was.

`<file name>` is the chosen file's name as the browser gives it.

## The board list

One row per entry of storage v2's board list, most recently saved first; entries with no saved
time last; ties in board key order. Each row is a button with the board's name on the first line
and a status line on the second. The name is the entry's title, or "Unnamed board" when it is
empty.

The status line joins, with " · ", these parts in this order, then capitalises its first
letter:
1. "open here" for the board open in this tab;
2. "open in another tab" when another tab holds that board's writer lock: for any other row, and
   for this tab's row when this tab is read-only;
3. for a valid board, "saved " and the saved time, or "saved time unavailable" when it is not
   known; for a board that is not valid, "damaged" or "made by a newer version of Board", and
   for a row other than this tab's, "can't be opened: " before it;
4. "from file" for a valid board marked so.

So: "Open here · saved today 10:42 · from file", "Saved yesterday 16:05", "Open in another tab ·
saved 24 Oct 09:30", "Saved time unavailable", "Can't be opened: damaged".

The saved time is in the viewer's local time, 24-hour, hours and minutes with two digits each:
"today 10:42" on the current local date, "yesterday 16:05" on the day before, "24 Oct 09:30"
earlier in the current year, and "24 Oct 2025 09:30" in an earlier year or at any time later
than now (for example after the clock was set back). Months are English three-letter
abbreviations. A saved time the browser cannot turn into a date is shown as unknown ("saved
time unavailable").

The row of the board open in this tab is highlighted and has `aria-current="true"`; activating
it does nothing. The row of a board that is not valid and not open here has
`aria-disabled="true"`; activating it does nothing. Activating any other row opens that board in
this tab (storage v2 **Opening a board** and switching), after the question below when the open
board has unsaved edits. While it opens, the panel's file commands, Reopen and the rows are
unavailable. Once open, the row is the "Open here" row and keeps focus; the board opens
editable, or read-only with v1's explanation when another tab holds its lock, or in the
recovery view when its records are damaged.

The list is refreshed at storage v2's refresh points. Who holds which lock is read with
`navigator.locks.query()` when the panel opens, at each list refresh and every second while the
panel is open; when it is not available, no row says "open in another tab".

## The unsaved-edits question

Opening another board from the list, or an accepted board file, while the open board has
unsaved edits (its draft revision differs from the last acknowledged save, or a draft is
invalid) first shows an in-app modal dialog (`dialog` opened with `showModal()`, role
`alertdialog`):

- title "Save your changes first?";
- text "“<board name>” has changes that are not saved in this browser yet. Save them before
  opening “<target>”?", where `<target>` is the list row's name or the file's name;
- buttons, in this order: **Cancel**, **Discard changes**, **Save and open** (primary). Focus
  starts on Save and open.

Cancel and Escape close the dialog and change nothing. Discard changes closes it and opens the
target; the open board's saved records are untouched and its unsaved edits are lost. Save and
open saves as Save does. While that save is pending, the three buttons are unavailable and
Escape does nothing. When the save is acknowledged and no newer edit is pending, the dialog
closes and the target opens; if the save fails, the dialog closes, Save shows Save failed as
today, and nothing is opened. Save and open is unavailable (`aria-disabled="true"`, focusable, does
nothing) while a draft is invalid, a gesture is in progress, text is being composed or the tab
is read-only. While the target opens, the three buttons are unavailable. When the dialog closes
without opening anything, focus returns to the element that had it before. Below a 400-pixel
viewport width the three buttons wrap onto more than one line inside the dialog.

Reopen is unchanged: it keeps the browser's own confirmation "Discard unsaved drafts and reload
the saved board?".

## Opening a board

Opening another board in a tab clears its undo history, text session, selection, inline editing
and view, as Reopen does. The address's `board` parameter changes to the board's key without a
new history entry (storage v2). Loading or reloading the page opens the board storage v2 names.

## Connectors

v19's reason "Connectors follow the ideas they join." is also given by Section from selection
when the selection holds only connectors.

## Verification boundary

Desktop Chrome and Safari as installed. Unit tests cover the board file contract's
verification list, storage v2's keys, locks, list writing, refresh and repair, and the status
line and time wording.

Browser checks cover, in Chrome: the panel's order and wording; Save a copy to file (name,
bytes, unsaved edits, unavailability, read-only); Open board file… with a valid file (new
board, identities, notice, list row), the same file twice, and each refusal; files at versions
1 and 6; switching from the list; the question's three answers, Escape, focus and a failed save;
two tabs on two boards and on one board; reload and per-tab board choice; the list's wording,
times, order, damaged and newer rows; list repair; the keyboard route through the panel; and
an older app on the original board in the same profile. The maintainer checks three of these
in Safari. v19's remaining rows still describe available coverage, not automatic gates.
