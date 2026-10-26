# Try and test NextPhase Board

This guide is for anyone who has downloaded NextPhase Board and wants to run it, check
that it works on their machine, and try its features. It covers the development build
on `main`. There are no releases yet.

## Before you start: where your board is saved

NextPhase Board is an early, single-user preview. The local server only delivers the
app. Your board is saved inside your browser, not on the server and not in this folder.
There are no accounts, sharing or sync.

- **One board per browser profile and address.** A different browser, profile or
  device starts with an empty board, and nothing moves across.
- **Browser storage is not a backup.** Clearing site data, private browsing or the
  browser freeing up space can delete your board. Safari may remove data for sites you
  haven't opened for a while.
- **There is no export or import yet**, so you cannot back up or move a board. Use
  throwaway content, never anything you need to keep.
- **Use one tab at a time.** A second tab opens read-only.
- **Don't go back to an older version after saving with a newer one.** Newer versions
  open boards saved by older ones, but an older version may not open a newer board.

## What you need

- Git.
- **Node 24.22.1 and npm 11.19.1**, the exact versions in the
  [toolchain contract](../architecture/0001-toolchain-v1.md). A Node version manager
  makes it easy to switch to them.
- **Chrome or Safari** on the same computer.

## Run it

From a terminal:

```sh
git clone https://github.com/nextphase-software/nextphase-board.git
cd nextphase-board
npm --prefix apps/web ci --ignore-scripts --no-audit --no-fund
npm --prefix apps/web run build
npm --prefix apps/web run serve
```

Open **<http://127.0.0.1:4173>**. Type it exactly: the local server answers only to
`127.0.0.1:4173`, so `localhost:4173` or your computer's network address will be
refused. Stop the server with Ctrl+C.

The build checks every bundled dependency against the accepted list and copies the
third-party notices next to the app. If it reports an unreviewed or uncovered package,
stop and report it (see [Report a problem](#report-a-problem)).

**To update:** stop the server, run `git pull`, then repeat the `ci`, `build` and
`serve` commands. Your board stays, because the address is the same.

**Other computers, phones or servers aren't supported yet.** The local server works
only on the machine it runs on, by design. Don't put the build on a network over plain
HTTP: browsers then block features the app needs, so editing is disabled and the app may
not start. A container setup and server instructions are planned for a later release.

## Check that your setup works

Do these once after installing, and again after updating.

**1. Automated checks (no browser needed).** From the repository folder:

```sh
npm --prefix apps/web run typecheck
npm --prefix apps/web test
npm --prefix apps/web run audit:licenses
```

All three should finish without errors.

**2. In-browser checks.** These run real storage, tab-locking and recovery tests in your
own browser. They use a separate, throwaway database and never touch your board. Build
and serve them in a second terminal:

```sh
npm --prefix apps/web run build:fixtures
npm --prefix apps/web run serve:fixtures
```

Open <http://127.0.0.1:4174>, then <http://127.0.0.1:4174/regressions.html>. Every line
on both pages should read **PASS**, and none should read **FAIL**. If a page warns that
lifecycle events are suppressed, try again in a clean browser profile with no
extensions. [tests/README.md](../../tests/README.md) explains what each check covers.

**3. A quick look at the app.** Open <http://127.0.0.1:4173>. A new board should
appear with a save status, and the palette and Objects panel should respond.

## Try the features

Use throwaway content. Each row says what to do and what you should see. The linked
brief has the full behaviour if something looks different.

| Feature | Try this | You should see |
| --- | --- | --- |
| [Capture and reopen](../briefs/0001-W1-capture-and-reopen-a-board.md) | Name the board in the upper-left menu, add a Sticky and a Text object, type in them, move them, click Save, then reload the page | The board reopens with the same name, objects and text. The status reads "Locally saved" |
| [Second tab](../briefs/0001-W1-capture-and-reopen-a-board.md) | Open the same address in a second tab | The second tab is read-only and says another tab is editing. Close the first tab, then choose Retry editing in the second |
| [Unnamed board](../briefs/0001-W14-edit-an-unnamed-board.md) | On a new board with no name, add and change objects, then try Save | Editing works. Only Save is blocked until the board has a valid name |
| [Undo, duplicate, delete](../briefs/0001-W2-edit-with-explicit-focus-and-undo.md) | Edit an object, then Undo and Redo. Duplicate and Delete an object | Each step reverses and replays. Text fields keep their own typing undo |
| [Pan and zoom](../briefs/0001-W13-navigate-the-canvas-with-trackpad-and-mouse-wheel.md) | Scroll with two fingers or the wheel. Pinch, or Ctrl/Cmd+wheel. Hold Space and drag | The canvas pans and zooms (50–200%) around the pointer. The browser page itself doesn't zoom, and nothing on the board changes |
| [Note size and text growth](../briefs/0001-W4-define-note-geometry-and-text-growth.md) | Add a sticky and type several lines | New stickies are square and grow taller to show all their text. Width and font size stay the same |
| [Colours and text styles](../briefs/0001-W5-persist-note-colors-and-basic-text-styles.md) | Select an object, change its colour, text size and alignment, then save and reload | The changes show at once and come back after reload |
| [Bold, italic, strikethrough](../briefs/0001-W6-whole-object-formatting.md) | Select an object and use the bold, italic and strikethrough buttons | The whole object's text changes style. Undo reverses it in one step |
| [Format selected text](../briefs/0001-W26-format-selected-text.md) | While editing text, select a few characters and press Cmd/Ctrl+B, Cmd/Ctrl+I or Cmd/Ctrl+Shift+X | Only the selected characters change. The editor stays open |
| [Select several objects](../briefs/0001-W7-select-and-move-multiple-objects.md) | Drag a box on empty canvas, Shift-click, or press Cmd/Ctrl+A on the canvas. Drag one of the selected objects | All selected objects move together and keep their spacing |
| [Resize](../briefs/0001-W8-resize-selected-objects.md) | Drag a corner handle of a selected object. Hold Shift to keep proportions. Press Escape mid-drag | The object resizes but never hides text that fits. Escape cancels |
| [Align, distribute, order](../briefs/0001-W9-align-and-order-selected-objects.md) | Select several objects and use the Arrange menu | They line up, spread out evenly, or move in front of or behind each other |
| [Group and ungroup](../briefs/0001-W10-group-and-ungroup-objects.md) | Select several objects and choose Group in Arrange, then click one member | The whole group is selected, with a dashed outline, and moves as one. Double-click still edits one member. Ungroup separates them |
| [Copy, cut, paste](../briefs/0001-W11-copy-and-paste-board-objects.md) | Select objects, press Cmd/Ctrl+C then Cmd/Ctrl+V on the canvas. Try Cmd/Ctrl+X | A copy appears next to the original. Cut removes the objects. Their text can also be pasted into other apps as plain text |
| Keyboard route | Without a mouse, use the Objects panel to select, edit, move and resize objects | Objects has buttons for selecting, editing, moving, resizing, styling, arranging, grouping and copy and paste |

This table grows as features are added. Each new feature adds its own row.

## Known limits

- Single user, one board per browser and address, saved only in the browser.
- No export, import, accounts, sharing or collaboration yet.
- Runs only on `127.0.0.1` on your own computer. No container, server or sub-path
  hosting yet.
- Tested in Chrome and Safari. Other browsers may work, but aren't checked.

## Report a problem

Open an issue in the project's GitHub repository with:

- the version: the output of `git rev-parse --short HEAD`;
- your browser and its version, and your operating system;
- what you did, step by step;
- what you expected and what happened;
- the results of the checks above, if any failed.

Use made-up content in screenshots and descriptions. For a security problem, follow
[SECURITY.md](../../SECURITY.md) instead of opening a public issue.
