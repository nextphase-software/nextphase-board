# Try and test NextPhase Board

This guide is for anyone who has downloaded NextPhase Board and wants to run it, check
that it works on their machine, and try its features. It covers the development build
on `main`. There are no releases yet.

It has two parts:

- [Part 1: local single-user mode](#part-1-local-single-user-mode). Only the web app
  runs, boards are saved in your browser, and there is no sign-in. Start here.
- [Part 2: team mode on your Mac](#part-2-team-mode-on-your-mac). One command starts a
  local sign-in service, database and Board server with three test people, so you can try
  sharing, roles, live editing, comments, history, Trash, the timer, voting and spotlight.

Use made-up content throughout. This is a development build.

## What you need

- Git.
- **Node 26.13.0 and npm 11.20.0**, the exact versions in the
  [toolchain contract](../architecture/0001-toolchain-v5.md). Node 26.13.0 includes npm
  11.20.0. A Node version manager makes it easy to switch to them.
- **Chrome or Safari** on the same computer.
- For Part 2 only: **Docker Desktop** for Mac.

Get the code:

```sh
git clone https://github.com/nextphase-software/nextphase-board.git
cd nextphase-board
```

Run every command in this guide from that folder.

## Part 1: local single-user mode

### Where your boards are saved

The local server only delivers the app. Your boards are saved inside your browser, not on
the server and not in this folder. There are no accounts, sharing or sync in this mode.

- **Boards belong to one browser profile and address.** You can keep several boards; the
  Board panel (click the board name at the upper left) lists them under "Boards in this
  browser". A new board comes from Open board file…. A different browser, profile or device
  starts empty, and nothing moves across.
- **Browser storage is not a backup.** Clearing site data, private browsing or the browser
  freeing up space can delete your boards. Safari may remove data for sites you haven't
  opened for a while. Use **Save a copy to file** in the Board panel to keep a copy, and
  **Open board file…** to open it again.
- **Use one tab per board.** A second tab on the same board opens read-only.

### Run it

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm run build
npm --prefix apps/web run serve
```

Open **<http://127.0.0.1:4173>**. Type it exactly: the local server answers only to
`127.0.0.1:4173`, so `localhost:4173` or your computer's network address will be
refused. Stop the server with Ctrl+C.

The build checks every bundled dependency against the accepted list and copies the
third-party notices next to the app. If it reports an unreviewed or uncovered package,
stop and report it (see [Report a problem](#report-a-problem)).

**To update:** stop the server, run `git pull`, then repeat the three commands. Your
boards stay, because the address is the same.

**Other computers and phones aren't supported in this mode.** The local server works only
on the machine it runs on, by design. Don't put the build on a network over plain HTTP:
browsers then block features the app needs, so editing is disabled and the app may not
start. To host the server, see the [server setup](../../apps/server/README.md).

### Check that your setup works

Do these once after installing, and again after updating.

**1. Automated checks (no browser needed).**

```sh
npm run typecheck
npm test
npm run audit:licenses
```

All three should finish without errors.

**2. In-browser checks.** These run real storage, tab-locking and recovery tests in your
own browser. They use a separate, throwaway database and never touch your boards. Build
and serve them in a second terminal:

```sh
npm run build:fixtures
npm --prefix apps/web run serve:fixtures
```

Open <http://127.0.0.1:4174>, then <http://127.0.0.1:4174/regressions.html>. Every line
on both pages should read **PASS**, and none should read **FAIL**. If a page warns that
lifecycle events are suppressed, try again in a clean browser profile with no
extensions. [tests/README.md](../../tests/README.md) explains what each check covers.

**3. A quick look at the app.** Open <http://127.0.0.1:4173>. A new board should
appear with a save status, and the toolbar at the bottom should respond.

### Try the editing features

Each row says what to do and what you should see. The linked brief has the full behaviour
if something looks different. The same features work in team mode.

| Feature | Try this | You should see |
| --- | --- | --- |
| [Capture and reopen](../briefs/0001-W1-capture-and-reopen-a-board.md) | Name the board in the Board panel (click the board name at the upper left), add a Sticky and a Text object, type in them, move them, click Save, then reload the page | The board reopens with the same name, objects and text. The status reads "Locally saved" |
| [Second tab](../briefs/0001-W1-capture-and-reopen-a-board.md) | Open the same address in a second tab | On the same board, the second tab is read-only and says "Another tab is editing. This board is read-only." Close the first tab, then choose Retry editing in the second. A second tab can open a different board from Boards in this browser and edit it |
| [Unnamed board](../briefs/0001-W14-edit-an-unnamed-board.md) | On a new board with no name, add and change objects, then try Save | Editing works. Save and Save a copy to file stay blocked until the board has a valid name |
| [Undo, duplicate, delete](../briefs/0001-W2-edit-with-explicit-focus-and-undo.md) | Edit an object, then Undo and Redo. Duplicate and Delete an object | Each step reverses and replays. Text fields keep their own typing undo |
| [Pan and zoom](../briefs/0001-W13-navigate-the-canvas-with-trackpad-and-mouse-wheel.md) | Scroll with two fingers or the wheel. Pinch, or Ctrl/Cmd+wheel. Hold Space and drag | The canvas pans and zooms (10–200%) around the pointer. The browser page itself doesn't zoom, and nothing on the board changes |
| [Find and navigate](../briefs/0010-W1-find-content-and-navigate-sections.md) | Add two sections and a few stickies, two of them containing "launch", one far off to the side, and click Save. Click an empty spot on the board so nothing is selected. Press Cmd+F (Ctrl+F) and type "launch". Press Return, then Escape. Click the Navigation button beside the zoom and choose a section. Click an empty spot on the board, then press Shift+1 | Both stickies get a ring, the current one orange, and the other objects fade; the bar counts "1 of 2", then "2 of 2" as the view moves to the far sticky. Escape closes the bar and leaves that sticky selected. Choosing a section fills the view with it; Shift+1 shows the whole board. Nothing is marked unsaved |
| [Pages](../briefs/0010-W2-organize-a-board-into-pages.md) | Add three stickies saying "budget", "plan" and "notes", and click Save. Click Pages (beside the board name), then **+**, type "Ideas" and press Return. Click "Page 1" in the list, select the "budget" and "plan" stickies and choose Move to page (in the selection bar), then "Ideas". Click "Go to Ideas" in the notice. Open Pages and click "Page 1"; press Cmd+F (Ctrl+F), type "budget" and press Return. Press Escape, open Pages, choose "…" on Ideas, then Delete page, then click the board and press Cmd+Z. Click Save and wait for "Locally saved", then reload the page | The list shows Page 1 and Ideas, with Ideas open and empty. The two stickies leave Page 1 and the notice offers "Go to Ideas"; on Ideas they sit where they were. On Page 1 find counts "– of 1"; Return opens Ideas with "budget" ringed and "On page “Ideas”" under the counter. Deleting Ideas removes it and its stickies with a notice; Cmd+Z brings both back and opens Ideas. After the reload the board opens on Ideas |
| [Note size and text growth](../briefs/0001-W4-define-note-geometry-and-text-growth.md) | Add a sticky and type several lines | New stickies are square and grow taller to show all their text. Width and font size stay the same |
| [Colours and text styles](../briefs/0001-W5-persist-note-colors-and-basic-text-styles.md) | Select an object, change its colour, text size and alignment, then save and reload | The changes show at once and come back after reload |
| [Bold, italic, strikethrough](../briefs/0001-W6-whole-object-formatting.md) | Select an object and use the bold, italic and strikethrough buttons | The whole object's text changes style. Undo reverses it in one step |
| [Format selected text](../briefs/0001-W26-format-selected-text.md) | While editing text, select a few characters and press Cmd/Ctrl+B, Cmd/Ctrl+I or Cmd/Ctrl+Shift+X | Only the selected characters change. The editor stays open |
| [Select several objects](../briefs/0001-W7-select-and-move-multiple-objects.md) | Drag a box on empty canvas, Shift-click, or press Cmd/Ctrl+A on the canvas. Drag one of the selected objects | All selected objects move together and keep their spacing |
| [Resize](../briefs/0001-W8-resize-selected-objects.md) | Drag a corner handle of a selected object. Hold Shift to keep proportions. Press Escape mid-drag | The object resizes but never hides text that fits. Escape cancels |
| [Align, distribute, order](../briefs/0001-W9-align-and-order-selected-objects.md) | Select several objects and use the Arrange menu | They line up, spread out evenly, or move in front of or behind each other |
| [Tidy up](../briefs/0009-W3-expand-drawing-and-diagram-layout.md) | Scatter six stickies, select them all (Cmd/Ctrl+A on the canvas) and click Tidy up on the bar, or press ⌥⇧T (Alt+Shift+T). Change Columns with − and +, type a Spacing, or drag a purple handle between two stickies. Click Cancel. Do it again, click Apply, then Undo | A preview shows them in an even grid, in the order they were read left to right and top to bottom, before anything is saved. Cancel (or Escape) puts everything back. Apply (or Enter) arranges them, and one Undo restores where they were. Connectors follow their objects. Tidy up needs three or more objects and isn't offered in a window narrower than 768 px |
| [Group and ungroup](../briefs/0001-W10-group-and-ungroup-objects.md) | Select several objects and choose Group in Arrange, then click one member | The whole group is selected, with a dashed outline, and moves as one. Double-click still edits one member. Ungroup separates them |
| [Copy, cut, paste](../briefs/0001-W11-copy-and-paste-board-objects.md) | Select objects, press Cmd/Ctrl+C then Cmd/Ctrl+V on the canvas. Try Cmd/Ctrl+X | A copy appears next to the original. Cut removes the objects. Their text can also be pasted into other apps as plain text. Pasting a copied picture adds an image |
| [Sections](../briefs/0002-W1-organize-sections.md) | Choose the Section tool and drag on empty canvas, then type a name. Drag a sticky into the section, then drag the section. Or select a few stickies, open Arrange and choose Section from selection | A lightly tinted area appears, with its name above its top-left corner. While you drag the sticky over it, a "Joins …" label shows. Moving the section moves the sticky too. Objects outside it stay where they are |
| [Connect ideas](../briefs/0002-W2-connect-ideas.md) | Select a sticky and drag one of the dots on its sides onto another sticky. Or select two ideas and choose Connect in Arrange. Move one sticky. Select the connector and choose Add text | A grey line with an arrow joins them. It meets each idea at the nearest side, with right-angle turns, and follows the sticky when it moves. The label sits on the line. Deleting a sticky deletes its connectors too |
| [Style and reconnect connectors](../briefs/0002-W3-style-and-reconnect-relationships.md) | Select a connector and use Colour, Line style, Start point, End point and Line shape. Drag one of its end circles onto another idea. Then make a new connector | Each change shows at once. The dragged end moves to the new idea, on the side nearest where you dropped it. Dropped on empty canvas, it goes back. A new connector uses the last style you chose |
| [Shapes](../briefs/0002-W4-draw-basic-shapes.md) | Choose the Shapes tool, or press R for a square or O for a circle. Drag to draw one, or click to place one. Type in it, then use Shape, Fill and Border on its bar. Type a lot of text | A white shape with a dark grey border and centred text. Fill and Border change separately. Long text ends with "…" and the shape keeps its size; Grow to fit text makes it big enough |
| [More shapes](../briefs/0009-W3-expand-drawing-and-diagram-layout.md) | Choose the Shapes tool and pick a kind from the grid in its Shapes panel, for example Diamond or Star, then drag or click to place it. Type in it. Select a shape and use Shape on its bar to switch kind. Connect two of the new shapes | The panel shows 14 kinds: square, circle, rounded rectangle, diamond, triangle, inverted triangle, pentagon, octagon, star, cross, left and right arrows, chevron and speech bubble. Text stays inside each outline, so it doesn't spill out of a diamond or triangle. Connectors meet the shape's real edge |
| [Mind maps](../briefs/0009-W2-build-and-restructure-mind-maps.md) | Choose Mind map in the bottom toolbar and click the board, then type the main topic. Select an idea and use its round + buttons, or press Cmd/Ctrl+Enter for a child and Cmd/Ctrl+Shift+Enter for a sibling. Drag one idea onto another, then drag one onto empty board. Select an idea that has children and choose Collapse. Delete an idea. Save and reload | A starter map: a bold main topic with three ideas on its right. The map lays itself out again after every change. A dragged idea moves with everything under it; dropped on empty board it becomes a separate map, and an idea can never go under its own children. Collapse hides a branch behind a badge counting what is hidden. Deleting an idea moves its children up. Every step is one Undo, and the map reopens exactly as it was |
| [Templates](../briefs/0008-W1-insert-a-local-editable-activity.md) | Click Templates in the bottom toolbar, then Add template on Retrospective, Brainstorm or Kanban. Press Undo once | The activity's objects appear to the right of what is already on the board, all selected, and the view moves to them. They edit like any other object. One Undo removes the whole activity |
| [Draw](../briefs/0009-W1-draw-with-pen-highlighter-and-eraser.md) | Click Draw in the bottom toolbar, or press M (Shift+M for the highlighter). In the bar above it, pick Marker or Highlighter, Thin or Thick, and a colour. Drag on the canvas. Then choose Eraser and drag across a line | A smooth line follows the pointer. Highlighter ink is wide and see-through, so text under it stays readable. The eraser removes every line it touches, whole, in one Undo step, and never erases other objects. Escape returns to Select |
| [Washi tape](../briefs/0009-W3-expand-drawing-and-diagram-layout.md) | Click Draw, choose Washi tape (or press W) and pick one of the six patterns in the bar. Drag across the corner of a sticky, then click once on empty canvas. Select a strip, drag one of its end handles, and use its bar. Then try the Eraser on it | A patterned strip of tape lies where you dragged; a click lays a short strip. A selected strip has a handle at each end and a bar with its pattern, Duplicate and Delete. The eraser leaves tape alone |
| [Images](../briefs/0012-W1-paste-and-import-local-images.md) | Copy an image in another app and press Cmd/Ctrl+V on the canvas. Or drop PNG, JPEG, GIF or WebP files on the canvas, or click Media (Cmd/Ctrl+Shift+K) and pick files. Select an image and click Description | The picture lands in the middle of the view, or where you dropped it, already selected. Tall pictures are scaled down. It resizes from its corners keeping its shape. The description becomes its name in Objects. A file that isn't a supported image, or is too large, shows a notice naming it |
| [Save and open a board file](../briefs/0006-W2-export-and-restore-board-file.md) | Click the board name to open the Board panel. Click Save a copy to file. Then click Open board file… and pick that file | A `<board name>.nextboard` file downloads. Opening it adds a new board and says it opened as a new board in this browser, with your other boards unchanged. It shows under Boards in this browser marked "From file" |
| [Switch boards](../briefs/0006-W2-export-and-restore-board-file.md) | In the Board panel, edit something, then choose another board under Boards in this browser | You're asked "Save your changes first?" with Save and open, Discard changes and Cancel. The list shows the most recently saved board first, each with its saved time, and the open one says "Open here" |
| Keyboard route | Without a mouse, use the Objects panel to select, edit, move and resize objects | Objects has buttons for selecting, adding, editing, moving, resizing, styling, arranging, grouping and copy and paste, plus fields for sections, connector ends, shape fill and border, drawing colour and weight, and image descriptions |
| [Tables](../briefs/0011-W1-tables.md) | Choose the Table tool (after Section) and click the board. Click the table's top-left cell, press Return, type "Task", press Tab and type "Owner", then press Escape twice. Click Add row in the bar. Click the "Owner" cell and choose Column options › Add column to the left. Drag the border right of "Task" to the right. Click the new empty column's top cell, then the small grabber above that column, and press Delete; then press Cmd+Z (Ctrl+Z). Click Save, wait for "Locally saved" and reload | A 2 × 2 table appears where you clicked, selected. "Task" and "Owner" fill the first row; the first Escape leaves the "Owner" cell selected and the second the whole table. A third row appears at the bottom. A new empty column appears left of "Owner"; widening "Task" leaves the other columns as they were. Delete removes the empty column and Cmd+Z brings it back, with "Task" and "Owner" still in their cells. After the reload the table is the same |
| [Link to a page](../briefs/0010-W4-link-to-a-page.md) | On a board with two pages, "Page 1" and "Ideas", click Save. Open Pages, choose "…" on Ideas, then Copy link to page. Open Page 1, paste the link into the address bar and press Return. Then open Pages, choose "…" on Ideas, choose Delete page and click Save; paste the link into the address bar again and press Return | "Link to “Ideas” copied. It opens in this browser only." The board reopens on Ideas, and the address bar now ends with Ideas' page id. After the delete, the link opens the board on Page 1 with "That page no longer exists. You are on “Page 1”." |
| [Tables from spreadsheets and CSV](../briefs/0011-W2-table-csv.md) | In a spreadsheet, copy a block of 3 columns and 3 rows holding plain words (no formulas) and press Cmd+V (Ctrl+V) on an empty part of the board. With the new table selected, click Export as CSV in its bar. Open the board panel, choose Import CSV… and pick the file that downloaded. Select one of the tables, press Cmd+C (Ctrl+C) and paste into the spreadsheet. Finally import a CSV file with 60 rows | A 3 × 3 table appears in the middle of the view, selected, with "Added a 3 × 3 table." A file "<board name> table.csv" downloads. The import adds a second table with the same text and "Added a 3 × 3 table from “<board name> table.csv”." The spreadsheet paste fills 3 × 3 cells. The 60-row file gives "Could not import “<file name>”: a table holds at most 50 rows, and this file has 60." and the board does not change |
| [Export the board or a selection](../briefs/0012-W2-export-visuals.md) | Add three stickies side by side and a table below them. Select the three stickies, press Cmd+Shift+E (Ctrl+Shift+E), keep PNG, Solid and Selection only, and click Export. Open the file. Click an empty part of the board, press Cmd+Shift+E again, choose PDF and click Export, and open the file. Then select the stickies, press Cmd+Shift+E, choose CSV and Tables, and click Export | The PNG shows only the three stickies on white with a margin round them, twice the board's size, with no blue outline or handles. The PDF is one page showing the stickies and the table. The CSV gives "There are no tables to export." and nothing downloads |
| [Animated GIFs](../briefs/0012-W3-team-images-and-gifs.md) | Click Media (or press Cmd+Shift+K / Ctrl+Shift+K) and pick an animated GIF. Click the empty canvas, hover the GIF, then click its play button. Add a sticky with the Sticky tool, click the empty canvas, click the sticky, then Shift-click the GIF so both are selected | Unselected, the GIF shows its first frame with a small "GIF" label; hovering shows a round play button; once it is the only thing selected it plays in a loop; with the sticky also selected it stops on its first frame |
| [Videos](../briefs/0012-W4-video-files.md) | Click Media (or press Cmd+Shift+K / Ctrl+Shift+K) and pick a short MP4. Click the empty canvas, hover the video, then click its round play button. Click the empty canvas again. Then pick an MP4 larger than 50 MiB | The video lands in the middle of the view showing its first frame. Unselected it shows a small label with ▶ and its length; hovering shows a round play button; clicking it selects the video and plays it with sound, with a dark strip of controls along its bottom; clicking the empty canvas pauses it. The large file is refused with a notice naming it and the 50 MiB limit |

This table grows as features are added. Each new feature adds its own row.

## Part 2: team mode on your Mac

Team mode runs everything on your own computer: a local Supabase stack in Docker for
sign-in and the database, the Board server, and the app built with team features on.
Nothing is sent outside your computer, and no real email is sent.

### 1. Install Docker Desktop once

Install Docker Desktop for Mac from the Docker website, open it, and wait until it says
Docker is running. You don't need a Docker account.

### 2. Start team mode

```sh
npm run team:start
```

The first run installs the dependencies, downloads the Supabase images (a few minutes)
and builds the app. Later runs take under a minute. It then:

- starts local Supabase and sets up the Board database;
- creates the workspace **Example team** with three test people:

  | Person | Email | Role |
  | --- | --- | --- |
  | Ana | `ana@example.com` | Owner |
  | Ben | `ben@example.com` | Editor |
  | Mia | `mia@example.com` | Viewer |

- creates a shared board, **Team test board**;
- starts the Board server on port 8788 and the app on <http://127.0.0.1:4173>.

When it finishes it prints the app address, the three emails and the next steps. Running
it again is safe: it reuses what is already there and restarts the server and the app.
Everything it creates on disk is in the `.local/team/` folder, which Git ignores; the logs
are in `.local/team/logs/`.

If it stops with a message, do what the message says. The common ones: the wrong Node
version, Docker not running, or a port already in use by another local Supabase stack.

### 3. Sign in as Ana, Ben and Mia

Each person needs a separate browser session, because a browser profile holds one
sign-in. Use:

- **Ana** in a normal Chrome window;
- **Ben** in a Chrome private window (File > New Incognito Window);
- **Mia** in Safari.

For each person:

1. Open <http://127.0.0.1:4173> and choose **Sign in** at the top right.
2. Enter the person's email and choose **Continue with email**.
3. In a terminal, run `npm run team:code ana` (or `ben`, `mia`). It prints a 6-digit
   code. Type it into the six boxes and choose **Sign in**.
4. Click the board name at the upper left to open the Board panel and choose **Back to
   files**. If it asks about the empty local board, choose **Discard changes**.
5. Under Workspaces, choose **Example team** and open **Team test board**.

Ask for the code after choosing Continue with email: each new code replaces the one
before. No email is needed. The app's own email, with the older code, still arrives in the
local inbox at <http://127.0.0.1:55324> if you want to see it. A code works for one hour;
`team:code` gives a fresh one at any time.

To sign in someone Ana has invited from **Share**, run `npm run team:code` with their
email address; see [Invite a fourth person](#invite-a-fourth-person).

### 4. Try the team features

With all three people on Team test board, the avatars at the top right show three people.

| Feature | Try this | You should see |
| --- | --- | --- |
| [Owner, editor and viewer access](../briefs/0003-W1-owner-editor-viewer-access.md) | Ana adds a sticky. Ben moves it. Mia selects it, presses Delete and tries to drag it | Ana and Ben see "Saving…" then "Saved". Mia's status stays "View only", her toolbar shows only Select, Pan and Comment, and the sticky doesn't change |
| [Take access away](../briefs/0003-W2-revoke-access-across-active-sessions.md) | With the board open in Ben's window, Ana opens Share, then "People from Example team", and changes Ben from "can edit" to "can view", then back | Ana sees "Access updated." or "Takes effect within a minute". Ben's window turns "View only" without a reload, then becomes editable again |
| [Find boards again](../briefs/0003-W3-discover-and-reopen-workspace-boards.md) | Ana renames the board in the Board panel's "Board name" field, then chooses Back to files | The board's card shows the new name and "Edited just now" |
| [Sign in, share and see access](../briefs/0003-W4-sign-in-share-and-see-access.md) | Ana clicks Share. Ben and Mia each click Share too | Ana sees "Share this board" and "Who has access", with an invite field. Ben and Mia see only their own row, "Copy link" and "Only the owner of Example team can invite people and change who has access." Mia's banner reads "You can view this board. Ask the owner of Example team if you need to edit it." |
| [Find, create and reopen boards](../briefs/0003-W5-find-create-and-reopen-boards.md) | Everyone chooses Back to files. Ana clicks New board, goes back, then right-clicks a card. Mia looks for New board | New board opens "Untitled" in the same tab. Cards show "Example team · Edited …" and a role (Owner, Can edit, Can view). The card menu has Open, Open in new tab, Copy link and Rename. Mia has no New board and no Rename |
| [Edit together](../briefs/0004-W1-edit-together-with-participant-presence.md) | Ana and Ben type into the same sticky at the same time, then Ana presses Undo | Both typings merge on both screens. Undo takes back only Ana's own steps. Where Ben changed the same thing since, Ana sees "Someone else changed that, so it was not undone." |
| [Recover after a dropped connection](../briefs/0004-W2-recover-shared-edits-after-interruption.md) | In Ben's window, open DevTools, set Network to Offline, then back to No throttling | The status reads "Offline — view only" with "Reconnecting… You can look around; editing comes back when the board does." Back online, the board rejoins by itself and reads "Saved" |
| [See who is here and follow](../briefs/0004-W3-see-who-is-on-a-board-and-where-they-are.md) | All three move their pointers. Ben selects a sticky. Ana clicks Ben's avatar, then Stop following. Ana presses ⌥⌘\ | Avatars sit at the top right, your own first. Cursors carry name labels; Mia's reads "mia · viewer". Ben's selection is outlined in his colour. Ana sees "Following ben" with Stop following. ⌥⌘\ hides the other cursors for Ana only, like "Show other people's cursors" in the people menu |
| [Comments](../briefs/0005-W1-discuss-and-resolve-anchored-ideas.md) | Ana picks the Comment tool (speech bubble, or C), clicks a sticky, types and presses Enter. Ben opens the pin and replies. Mia adds a comment. Ana resolves her thread. Ben deletes the sticky | A pin with the author's initial appears on every screen and replies show live. Ana gets "Thread resolved" with Undo, and "Show resolved comments" brings the thread back. After the sticky is deleted, its pin stays where it was, marked as detached |
| [Mentions](../briefs/0005-W2-mention-participants-in-board-discussions.md) | In a comment, Ana types @, picks ben and posts. Ben chooses Back to files and clicks the bell | Ana sees the "Mention a participant" list, and "@ben" turns blue. Ben's bell has a dot, and Notifications shows "ana mentioned you" with "Team test board · Example team". Clicking it opens the board at that comment |
| [Import a board file](../briefs/0006-W1-export-and-restore-a-portable-board.md) | In the Board panel, Ana chooses Save a copy to file. On the files page she chooses Import board file… and picks that file | A new team board with the same content opens and appears for everyone in Example team. Mia has no Import board file… |
| [Board file in this browser](../briefs/0006-W2-export-and-restore-board-file.md) | On a local board (Boards in this browser on the files page), choose Open board file… in the Board panel and pick the same file | The file opens as a separate local board, listed under Boards in this browser. Team boards don't change |
| [Version history](../briefs/0006-W3-manage-board-history.md) | In the Board panel, Ana chooses Show version history, then Save version…, names it and clicks Save version. Ben edits a sticky. Ana opens the saved version, chooses Restore this version and confirms. Mia opens the history too | Ana's open version reads "… · Read-only preview" with "Back to current version". After the restore Ana sees "Version restored", and Ben sees "ana restored this board · Rejoining…", then "Rejoined". Mia can browse but sees "You can browse history. Saving, naming and restoring require edit access." |
| [Trash](../briefs/0006-W4-delete-and-restore-boards-from-trash.md) | Ana makes a New board. On the files page she right-clicks its card, chooses Move to trash…, then Move to trash. She opens Trash under Example team, chooses Restore, then Open board | The card leaves Recents. Trash lists it with "Restore before …". Restore shows "Board restored" and "Restored to Example team · Same board and link". Anyone who had the board open sees "This board is not available." Ben and Mia have no Move to trash… and no Trash |
| [Shared timer](../briefs/0007-W1-run-a-shared-workshop-timer.md) | Mia clicks the timer button ("03:00", left of Share) and starts it. Ben pauses, then resumes. Ana clicks "+ 1 min", then stops it and confirms Stop timer | All three countdowns match, in the "Timer and voting" panel and in the browser tab title. Paused shows "Paused". At 00:00 the panel shows "Timer finished". "Stop the timer?" warns that it stops the timer for everyone |
| [Voting](../briefs/0007-W2-vote-and-reveal-workshop-results.md) | In the timer panel, Ana clicks New vote, types a question and clicks Start voting. Ana and Ben click Enter voting, click stickies, then Done voting. Ana clicks End and reveal and confirms; later she uses Clear results | Each voter's strip reads "Voting · 2 of 3 votes remaining · Done voting", and each person sees only their own dots until the reveal. Mia sees "Voting in progress. Only owners and editors can vote." After the reveal everyone sees "Results" and count badges on the stickies |
| [Spotlight](../briefs/0007-W3-follow-a-facilitator-through-a-board.md) | In the people menu (the arrow next to the avatars), Ana chooses Spotlight me. Ben clicks Follow; Mia waits. Ana then clicks Stop | Ben and Mia see "Spotlight on ana. Following in 3…" with Follow and Not now, then follow Ana's view with Stop following. Ana sees "Waiting for followers…" with Cancel, then "2 followers" with Stop |
| [Reactions](../briefs/0007-W4-send-ephemeral-workshop-reactions.md) | Each person clicks Reactions (left of Comment), or presses E, and picks one of the eight reactions on the wheel. Click or Shift-click the board; press Escape to stop. Then Ana starts a vote and everyone tries again | Everyone else sees a short burst of that reaction at the same spot on the board for about a second and a half. Clicking doesn't select objects. Nothing is saved or shown again later. Reactions are off while a vote is running |
| [Team templates](../briefs/0008-W2-save-and-reuse-team-activities.md) | Ana selects a few objects, opens Templates and clicks Save selection as template (with nothing selected it reads Save board as template), names it and saves. Ben opens Templates and clicks Add template on it, then edits the copy. Ana opens More options on the card and tries Edit details, Replace with selection and Delete template. Mia opens Templates | The Templates panel has an Example team section with the count ("1 of 25") and the new card first. Ben's copy is independent: editing it never changes the template, and deleting the template leaves copies already on boards. Owners and editors of Example team can save templates; Mia, the viewer, can't |
| [Pages on team boards](../briefs/0010-W3-pages-on-team-boards.md) | Ana clicks Pages, then **+**, types "Ideas" and presses Return, then adds a sticky saying "dinner". Ben opens Pages and clicks "Ideas"; Mia opens Pages. Ana goes back to "Page 1" and clicks Ben's avatar. Ben starts a vote from Timer and voting. Ana, on Page 1, opens Timer and voting. Ben chooses End and reveal and confirms, then opens "…" on Ideas, chooses Delete page, clicks the board and presses Cmd+Z | Ben sees Ideas appear in his list and the "dinner" sticky on it. Ana's list shows Ben's avatar beside Ideas, and his cursor is not on Page 1. Mia's list has no + and says "View only"; her "…" menus hold only Copy link to page. Clicking Ben's avatar takes Ana to Ideas with "Following ben to “Ideas”". Ana's voting card says "This vote is on page “Ideas”" with Go to Ideas. While the vote runs, Ideas' Delete page is disabled with "A vote is running on this page"; after Ben ends it, Delete page removes Ideas for everyone, and Cmd+Z brings it back for everyone |
| [Tables on team boards](../briefs/0011-W1-tables.md) | Open the same team board in two browsers, signed in as two editors. In browser A place a table, click its top-left cell, press Return and type "Task". In browser B click the table, click its top-right cell, press Return and type "Owner", press Escape twice and click Add row. In browser B click a cell of the new bottom row, press Return and start typing; while B types, in browser A press Escape twice, click a cell of that bottom row, click the grabber left of the row and press Delete. Reload both | Both browsers show "Task" and "Owner" in their cells. The new row appears in both. When A deletes the row, B's typing stops, B's whole table is selected and B sees "<A's name> deleted a row you were editing."; the rest of the table is unchanged in both. After the reload both show the same table |
| [Link to a page on team boards](../briefs/0010-W4-link-to-a-page.md) | Ana adds a page "Ideas" to a team board (Pages, then **+**, type "Ideas", Return) and, in the Pages list, chooses "…" on Ideas, then Copy link to page, and sends the link to Ben and Mia (for example in a chat). Ben, with the board open on Page 1, pastes the link into his address bar and presses Return; Mia opens it in a new tab. Mia opens Pages and chooses "…" on Page 1. Ana then deletes Ideas, and Ben pastes the link into his address bar again and presses Return | Ana sees "Link to “Ideas” copied." Ben moves to Ideas without the board reloading, and Mia's board opens on Ideas. Mia's menu has only Copy link to page. After the delete, Ben stays on the board, on Page 1, with "That page no longer exists. You are on “Page 1”." |
| [Tables from spreadsheets and CSV on team boards](../briefs/0011-W2-table-csv.md) | Ana (owner), Ben (editor) and Mia (viewer) open the same team board. Ben copies a block of 3 columns and 3 rows in a spreadsheet and presses Cmd+V (Ctrl+V) on the board, then Cmd+Z (Ctrl+Z), then Cmd+Shift+Z (Ctrl+Shift+Z). Mia opens the board panel, then selects the table and presses Cmd+V (Ctrl+V) | Ben sees "Added a 3 × 3 table."; the table appears for Ana and Mia, goes away and comes back. Mia's board panel has no Import CSV…, her table bar has no Export as CSV, and her paste gives the board's read-only notice and changes nothing |
| [Export on team boards](../briefs/0012-W2-export-visuals.md) | Ana (owner), Ben (editor) and Mia (viewer) open the same team board with a few stickies on it. Ben opens the board panel, clicks Export…, chooses CSV and Stickies, and clicks Export. Mia selects a sticky and presses Cmd+Shift+E (Ctrl+Shift+E), then opens the board panel | Ben gets "<board name>.csv" with a Content header and one line per sticky; nothing changes for Ana and Mia. Mia sees "Only owners and editors can export this board.", no dialog opens, and her board panel has no Export… |
| [Pictures on team boards](../briefs/0012-W3-team-images-and-gifs.md) | Ana (owner), Ben (editor) and Mia (viewer) open the same team board. Ben clicks Media and picks a photo and an animated GIF. Mia copies an image in another app and presses Cmd+V (Ctrl+V) on the canvas. Ana selects the GIF. Ben deletes the photo and presses Cmd+Z (Ctrl+Z) | Ben sees "Adding …" and then both pictures; Ana and Mia see them appear, briefly as a grey "Loading image…" box. Mia has no Media button and her paste adds nothing. Only Ana's screen plays the GIF. Undo brings the photo back for everyone |
| [Videos on team boards](../briefs/0012-W4-video-files.md) | Ana (owner), Ben (editor) and Mia (viewer) open the same team board. Ben clicks Media and picks a short MP4. Mia clicks the video, then Play in its strip. Ana does the same. Ben selects the video, presses Delete, then Cmd+Z (Ctrl+Z) | Ben sees "Adding …" with a percentage, then the video; Ana and Mia see it appear. Mia has no Media button but can play it; her strip first shows "Loading video…". Each person's playback stays on their own screen. Undo brings the video back for everyone |

Mia, the viewer, can still comment and reply, mention people, send reactions, run the shared
timer, use Spotlight me and Follow, browse version history and save a copy to a file.

### Invite a fourth person

Board sends no email; the owner shares the invitation link. To try it with a fourth
person, Lee:

1. As Ana, open Share on Team test board, type `lee@example.com`, leave "can edit" and
   click Invite. You should see "Invitation link copied. Send it to lee@example.com
   yourself." Lee is listed under "Invited".
2. Open a browser session that is not signed in yet (for example a Safari private window)
   and paste the copied link. It shows "Sign in to open this board".
3. Enter `lee@example.com`, choose Continue with email, run
   `npm run team:code lee@example.com` and type the code. The invitation is accepted
   and the board opens with Lee's role. Lee sees only this board on the files page.
4. As Ana, open Share and choose Remove on Lee's row. Lee sees "You no longer have access
   to this board" with "Close this board".

Inviting from the main Share view gives access to that board only. Inviting from
"People from Example team" makes the person a workspace editor or viewer.

### 5. Stop and clean up

```sh
npm run team:stop
```

This stops the app, the Board server and Supabase. Your people and boards are kept, and
the next `npm run team:start` brings them back.

To delete everything and start from scratch:

```sh
npm run team:stop -- --wipe
```

This deletes the local Supabase data and the `.local/team/` folder. It touches only the
Docker containers and volumes of this local team stack (project `nextphase-board-local`),
never other Docker projects. Quit Docker Desktop afterwards if you like.

## Known limits

- Local single-user mode keeps boards only in the browser, on `127.0.0.1` on your own
  computer.
- Team mode here runs on one Mac only, with test people and no real email. Hosting it for
  other people needs the [server setup](../../apps/server/README.md) with HTTPS.
- Tested in Chrome and Safari. Other browsers may work, but aren't checked.

## Report a problem

Open an issue in the project's GitHub repository with:

- the version: the output of `git rev-parse --short HEAD`;
- your browser and its version, and your operating system;
- whether you used local mode or team mode;
- what you did, step by step;
- what you expected and what happened;
- the results of the checks above, if any failed.

Use made-up content in screenshots and descriptions, and never paste anything from
`.local/team/` (it holds local keys). For a security problem, follow
[SECURITY.md](../../SECURITY.md) instead of opening a public issue.
