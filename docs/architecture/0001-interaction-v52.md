# 0001 — Interaction

Contract version: 52 (for 0012-W5 brief v1, 2026-11-25). Status: Draft. When accepted it replaces
[interaction v51](0001-interaction-v51.md) for later work. Uses [document v22](0001-document-v22.md),
[board file v6](0006-board-file-v6.md), [API v16](0003-api-v16.md), [access v17](0003-access-v17.md),
[sync v18](0003-sync-v18.md), [link preview v1](0012-link-preview-v1.md), [toolchain v6](0001-toolchain-v6.md),
[hosted storage v15](0003-hosted-storage-v15.md), [team templates v4](0008-team-templates-v4.md) and
[board lifecycle v8](0006-board-lifecycle-v8.md); its modules are [web modules v50](0001-web-modules-v50.md).

Every rule in v51 (and, through it, v50 back to v4 and the 0001-W3 presentation) still applies except where this
version replaces or adds to it. v51's own text follows as the part **Team imports and templates with media (v51)**,
word for word except that its first sentence says "Version 51", its **Not in this version** sends link previews to
this version's part, and its headings are one level lower; where it links an older contract, read the versions above.

This version adds **link cards** (the part **Link cards**, values LC1–LC9): an owner or editor pastes one web address
on the canvas and gets a card that shows the page's picture, title, short description and site, read once by Board's
link preview service. It adds one object type (`link`, document v22), the bar's label `Link` / `<n> links` and four
context-bar buttons, the card's looks drawn on the canvas, and one line in the About popover. It adds exactly two CSS
rules (the layout group's row and its pressed button) and no notice, dialog or panel. The look was approved in the journey mock-up v1
(2026-11-25); every value is restated below so it is checked, not inferred.

## Change note (v51 → v52)

- New part **Link cards**: the paste step and its place in the paste chain, addresses that become text, the arrival
  and its gate, the 20,000 ms loading rule, the thumbnail, the card's looks with exact values and how a face is drawn
  inside its stored rectangle, the document bounds shift, selection, the bar, Open link, Display vertical /
  horizontal, Change back to text and its focus, undo, viewers, keyboard, narrow windows, and the About line.
- v51's **Not in this version** no longer lists link previews.
- Nothing else in v51 changes.

## Team imports and templates with media (v51)

Version 51 lets **team** workspaces take board files and templates that hold
pictures, GIFs and videos. It adds no control, panel, dialog or style: it changes only the **text** of existing
places — the files page's import toast, the board's team toast, and the Save as template and Replace confirmation
dialogs — and, while an add runs, the `disabled` state of the template cards' Add buttons. Every look below is the
existing element's own at public main `ea4203c` (`apps/web/style.css`), restated so it is checked, not restyled:

| Element | Look at `ea4203c` (unchanged) |
| --- | --- |
| Files page toast `.home-toast` | `position: fixed`, `bottom: 24px`, `left: calc(50% + 120px)` (centred on the main area beside the 240 px sidebar; `left: 50%` below 600 px), `transform: translateX(-50%)`, padding 10px 14px, 1px solid `#e1dce8`, radius 10px, background `#f3f0f8`, `max-width: calc(100% - 32px)`, z-index 6 (lines 1029, 1046) |
| Board toast `.team-toast` | `position: fixed`, `bottom: 86px` (148px below 768 px), `left: 50%`, `transform: translateX(-50%)`, padding 10px 14px, 1px solid `#e1dce8`, radius 10px, background `#f3f0f8`, `width: max-content`, `max-width: calc(100% - 24px)`, z-index 4 (lines 716–721); it hides 5,000 ms after its last change (`team-app.tsx`) |
| Dialog lines | `.team-template-dialog .team-template-hint`: 12px, `#6b6772`, margin 4px 0 0; `.team-template-error`: 12px, `#a32940`, margin 4px 0 0; `.team-template-what`: 12px, `#6b6772`, margin 8px 0 0 (lines 1494–1497) |
| Text | The toasts inherit the page's `14px system-ui` and colour `#29272e` (`style.css` 5–29) |
| Disabled buttons | The shared disabled button rules (`opacity: .45`), unchanged. While an import runs both **Importing…** and **New board** are disabled, as today |

It replaces:
- the team import reason **"it holds pictures or videos, which team boards can't hold yet"** (board lifecycle v7):
  it is gone; such a file is imported (see **Importing a board file**). This supersedes board file v5's statement that
  such a file is refused by a team workspace;
- team templates v2's refusal of a selection holding an image or a video (see **Saving a template**);
- the plain `Importing “<file>”…` text for a file holding pictures or videos (it gains a percentage);
- the wait between pressing Add and `Added “<template>”: <n> objects.` for a template holding pictures or videos (it
  gains `Adding “<template>”… <p>%`, and the panel closes at once).

### Terms

- **Media** of a board file or template: its picture, first-frame and video **files**, each counted once by hash, in
  the order the objects first name them (an image's `asset`; a video's `poster`, then its `asset`). A **media byte**
  is a byte of one of those files.
- **`<p>`** is a whole number from 0 to 100, rounded down, that never decreases while one task runs. It is at most
  **99** until the last upload has answered `ok`; it reads 100 only after that (and through the import's finish).
- A transfer with progress events (an XHR upload, a streamed download) counts its bytes as they move; one without
  (the board's picture `upload` and `download`) counts nothing until it ends, then all its bytes.
- **MiB** in text is `bytes ÷ 1,048,576` with one decimal, rounded half up (`0.3`, `27.0`), except the limit itself,
  written `20 MiB`, and the too-large line's total, rounded **up** to a whole number with no decimal (`27 MiB`), so a
  total just over the limit never reads `20.0`.
- A **network** answer is the transfer answer `"network"` (hosted storage v15); **stalled** is the watchdog's
  `"stalled"`; it wins over any answer its own abort produced.

### Importing a board file (team workspace)

Who: an owner or editor of the workspace, from the files page's existing **Import board file…** button (viewers and
guests have no button, as today). The file is read exactly as today (board file v5: versions 1, 2 and 3; at most
216 MiB; today's reasons). Then, for a file whose board holds images or videos:

**Checks before anything is sent.** The reader (`readBoardBundle`) already refuses a malformed bundle and one over
the board budgets with `it is damaged` (board file v5), and those stay its answers. Then, in this order, each refusing
in today's frame `Couldn't import “<file>”: <reason>.`:

| Reason | When |
| --- | --- |
| `a picture is unavailable` / `a video is unavailable` (board file v5's texts) | The board names a picture or video whose bytes the file does not carry (a version 1 file naming media) |
| `it is damaged` | A picture does not decode in the browser: each picture is decoded exactly as the local open path decodes it (board file v5 rule 13, `use-storage-session.ts`), before the staging is opened |
| `a picture is larger than 20 MiB` | A picture file over 20,971,520 bytes |
| `a video is larger than 50 MiB` | A video file over 52,428,800 bytes |
| `it holds too many pictures and videos` | More than 1,000 media files |

**Progress (U1).** While the import runs, the `.home-toast` shows:

| File | Text |
| --- | --- |
| No media | `Importing “<file>”…` (today's, unchanged; one request, as today) |
| With media | `Importing “<file>”… <p>%`, `<p>` over all media bytes (Terms). It reads `0%` once the staging is open, and `100%` from the last upload's `ok` answer through the finish |

`<file>` is the file's name as today. Files upload **one at a time**, in media order. The button reads `Importing…` and
is disabled until the task ends, as today. On success the new board opens, as today.

**Failures (U2).** Today's frame `Couldn't import “<file>”: <reason>.`, the first matching row winning:

| Reason | When |
| --- | --- |
| `the upload stopped` | Stalled (no progress for 60,000 ms), or any step answers `"expired"` / 410 `upload_expired` |
| `you are offline` | Any step answers network (the finish's `ApiError` `no_answer` included) |
| `you can no longer add boards here` | Any step answers `"gone"` (403, or 404 `not_found`) |
| `the server did not accept it` | Any other refusal |

After any failure nothing is left: no board appears and the files list is as before. The button is enabled again.

### Saving a template (team board)

The existing **Save as template** dialog (0008-W2) now accepts a selection, page or board holding images and videos.

**Picture line (U3).** When what is being saved holds media, one new `<p className="team-template-hint">` line sits
directly below the dialog's `.team-template-what` line (`<n> selected objects from <board title>` or its page and
board forms):

`Includes <counts> (<size> MiB of the 20 MiB a template can hold).`

`<counts>` lists, in this order and joined by ` and `, the non-zero ones of `1 picture` / `<n> pictures` and `1 video`
/ `<n> videos`. Pictures are image objects' files; a video's first frame is counted in its bytes but not as a picture.
`<size>` is all media bytes in MiB (Terms). No line when there are no media.

**Sizes.** The sizes come from the server (`POST /boards/:board/asset-sizes`, [API v15](0003-api-v15.md)), asked once
when the dialog opens, for the media hashes being saved. Until they arrive the line reads only `Includes <counts>.` and
the submit button is disabled (a planner refinement, not drawn in the mock-up; usually well under a second). If the
request fails or a hash is missing from the answer, the error line reads `Couldn't save the template: a picture on
this board couldn't be loaded. Try again.` and the submit button stays disabled until the dialog is opened again.

**Too large (U5).** When all media bytes exceed **20,971,520**: the line shows the total rounded up (`Includes 3
pictures (27 MiB of the 20 MiB a template can hold).`); below it the existing `.team-template-error` line reads `This
is too large for a template. Select fewer objects.` (the existing text); the submit button is disabled. Nothing is
uploaded.

**Saving (U4).** Pressing **Save template** with media puts the dialog in its existing pending state (inputs
read-only, both buttons disabled), and the submit button reads `Saving… <p>%`, where each file's download from the
board counts as half its bytes and its upload to the template's staging as the other half (Terms). Without media the
button keeps today's text. On success the dialog closes and today's `Saved “<name>” to <workspace>.` toast shows.

**Failures (U6).** The existing error line shows `Couldn't save the template: <reason>. Try again.`; the dialog returns
to its normal state with the name and description kept. Nothing is saved. The first matching row wins:

| Reason | When |
| --- | --- |
| `the upload stopped` | Stalled, or `"expired"` / 410 |
| `a picture on this board couldn't be loaded` | A download from the board ends in any answer but `ok` (network included) |
| `you are offline` | Any other step answers network |
| `the server did not accept it` | Any other refusal (403 included) |

A 409 `template_limit` on the final save keeps today's behaviour (the limit toast).

**Replace with selection.** The existing confirmation (title `Replace “<name>”?`, its paragraph, **Replace content**)
follows the same rules: the picture line directly below its paragraph, the sizes request when it opens, the too-large
line and disabled **Replace content**, the pending label `Replacing… <p>%`, and failures `Couldn't replace the
template: <reason>. Try again.` with the reasons above. A selection without media replaces as today (and drops the
template's pictures).

### Adding a template (team board)

Pressing **Add template** reads the template's fresh detail first, as today. When the **fresh detail** holds no image
and no video, the add is exactly today's (insert, the panel closes after the insertion, `Added “<template>”: <n>
objects.`, a refused read refreshing the stale card as today). When it holds media:

**Progress (U7).** The Templates panel closes as soon as the fresh detail is read. The board's `.team-toast` reads
`Adding “<template>”… <p>%` (each file's download from the template counted as half its bytes and its upload to the
board as the other half), re-sent at least every 2,000 ms so it does not hide, until the objects land; then today's
`Added “<template>”: <n> objects.` (from the existing insertion) replaces it. While an add runs, every **Add template**
button on the panel's cards is `disabled`, also when the panel is reopened.

Order: read the template (its `media`); check that every media hash of its objects is in `media` with its kind (else
the unloaded failure below); then, one file at a time, download it from the template and upload it to the board (the
existing picture `upload`, or `uploadVideo`; both answer `ok` when the board already holds the file). Only when every
file answered `ok` are the objects inserted, by today's insertion. If that insertion itself refuses (for example the
board's object limit), its existing message is the only notice; the uploaded files stay unused.

**Failures (U8).** The toast shows the team-board frame of 0012-W3/W4 `Could not add “<template>”: <reason>.` Nothing
is added. Files that did upload stay unused on the board and are cleared after 24 h (hosted persistence v12). The first
matching row wins:

| Reason | When |
| --- | --- |
| `the upload stopped` | Stalled |
| `its pictures could not be loaded` | The template's `media` lacks a file its objects need, or a download from the template ends in any answer but `ok` (network included) |
| `you are offline` | An upload to the board answers network (`offline` / `"network"`) |
| `this board already holds 50 MiB of pictures` | An upload answers `full` (409 `board_pictures_full`) |
| `this board already holds 100 MiB of videos` | An upload answers `videos_full` (409 `board_videos_full`) |
| `the server did not accept it` | Any other refusal |

### Roles

Viewers see no new control and none of these notices: they have no Import board file… button and no Templates button
on a team board (as today), so they never save or add. A board guest with an editor grant keeps today's Templates
panel with its Activities and no team section (team templates need workspace membership); nothing changes for them.
Adding a team template needs both: reading the workspace's templates and editing the board. What a viewer sees changes only in that an
imported board and an added template carry their pictures and videos, which draw and play for them as on any team
board.

### Accessibility

The toasts, the dialog's lines and the buttons keep their existing elements, roles and attributes; only their text and
the Add buttons' `disabled` change. No focus moves.

### Not in this version

A Cancel control; parallel uploads; resuming an import; template pictures in single-user mode; the template preview
drawing pictures (it keeps drawing them as outlined boxes). Link previews: see **Link cards**.

## Link cards

### Terms

- A **card** is an object of type `link` (document v22). Its own keys: `url`, `title`, `description`, `site`,
  `asset` (a picture hash, or `null`), `layout` (`vertical` | `horizontal`), `state` (`loading` | `ready` | `linkOnly`)
  and `requestedAt` (milliseconds since 1970 by the paster's clock, a whole number). Like a picture it also has `x`,
  `y`, `width`, `height`, `page`, `section`, `group` and `order`. Whenever a browser writes a card's look it writes
  that look's size (table below). The document accepts any **card size** with any state (document v22's size rule,
  the union of the table's sizes), so after two concurrent edits merge a card may hold another card size (sync v18).
- **Stored rectangle.** A card's saved `x`, `y`, `width` and `height`. It is always what is drawn, hit-tested and
  outlined, and where the context bar is anchored: the face of the card's look is drawn **inside** it (**Drawing at
  the stored size**), whatever its size.
- **Document bounds.** Every rectangle keeps `x ≥ −1,000,000`, `y ≥ −1,000,000`, `x + width ≤ 1,000,000` and
  `y + height ≤ 1,000,000` (document v22). When a card gets a new size (a finish, a layout choice, a stale card's
  edit), when Change back to text puts a text object in a card's place, and when a paste places a card or a text
  object, the object is **kept within the bounds**: `x` becomes `min(max(x, −1,000,000), 1,000,000 − width)` and `y`
  becomes `min(max(y, −1,000,000), 1,000,000 − height)`. A size change or a conversion can only cross the right or
  bottom edge, so it shifts the object left and/or up just enough; that is the only case where it changes `x` or
  `y`.
- **Units.** Every length below is in board units. At 100% zoom one unit is one screen pixel. The card is drawn on the
  canvas (Konva), as a picture's body is, so it scales with the zoom; only the selection outline keeps a constant
  screen width. Every offset is from the card's top-left corner (its saved `x`, `y`).
- **Stale.** A card whose `state` is `loading` is stale when `now ≥ requestedAt + 20,000` (now by the viewing
  browser's clock). A stale card is drawn and treated as link-only everywhere in this part; its face is drawn inside
  its stored rectangle (306 × 288).
- **Look.** Each card has exactly one look, from its keys and the clock:

| Look | When | Size written (width × height) |
| --- | --- | --- |
| loading | `state: "loading"`, not stale | 306 × 288 |
| vertical | `state: "ready"`, `asset` a hash, `layout: "vertical"` | 306 × `210 + 20·Lt + (Ld > 0 ? 4 + 17·Ld : 0)`: 230, 250, 251, 268, 271 or 288 |
| horizontal | `state: "ready"`, `asset` a hash, `layout: "horizontal"` | 480 × 114 |
| title-only vertical | `state: "ready"`, `asset: null`, `layout: "vertical"` | 306 × 100 |
| title-only horizontal | `state: "ready"`, `asset: null`, `layout: "horizontal"` | 480 × 64 |
| link-only | `state: "linkOnly"`, or stale | 480 × 64 |

  `Lt` is the number of lines the title takes (1 or 2) and `Ld` the description's (0, 1 or 2; 0 when it is empty),
  wrapped as drawn (below). The browser that writes a vertical card measures them; every browser that draws it reads
  them back from the saved height, which is unique for each pair (`Lt, Ld` → height: 1,0 → 230; 2,0 → 250;
  1,1 → 251; 1,2 → 268; 2,1 → 271; 2,2 → 288). The saved counts **cap** what is drawn: every viewer draws at most
  `Lt` title lines and `Ld` description lines, and a text cut at its cap ends its last drawn line with an ellipsis
  (`…`). A viewer whose fonts wrap a text into fewer lines draws fewer (the space below stays empty), never more.
  Different system fonts may therefore show different words; the card's size and rows do not change. A vertical
  card is never taller than 288.
- **Preview service.** Where the paster's browser asks (link preview v1, API v16): on a team board,
  `POST /boards/:board/link-preview` on the team server; on a single-user board, `POST <origin>/link-preview`, where
  `<origin>` is the build's link preview origin (toolchain v6's compile-time constant `BOARD_LINK_PREVIEW_URL`; in a
  team build its local boards are single-user boards and use the same constant). A build where that constant is
  `null` has **no preview service** for single-user boards; team boards always ask the team server.
- **The address rules** are link preview v1's F1–F2. The browser applies them to the parsed address before asking,
  and never asks for an address that fails them.

### Pasting an address (LC1, LC4)

**Place in the paste chain.** This order is authoritative. The canvas's paste handler runs: (1) the table/CSV step
(unchanged); (2) **the link step (new)**; (3) the existing media and object path, unchanged: the team board's paste,
or the picture and video step, which ends in the object paste (`clipboardCommand("Paste")`). The link step must run
**before** the picture and video step, because that step calls `preventDefault()` on every canvas paste it receives,
even one whose clipboard holds no file. The link step passes the event on untouched whenever the clipboard holds any
file (so files keep their table, picture and video paths) and whenever it does not act (below), so every such paste
reaches the media and object path exactly as today.

The link step acts only when **all** of these hold; otherwise it passes the event on untouched and the paste behaves
exactly as today ("Nothing to paste." or the earlier copied objects):

1. The event targets the canvas (`isCanvasPasteTarget`), is not already handled (`defaultPrevented`), and no text
   composition is running. Nothing is being edited: a paste inside a text editor or field never reaches the canvas.
2. The clipboard holds no file.
3. Editing commands are available: the existing editing command reason is empty (not read-only, not composing, no
   pointer gesture, no invalid draft), Tidy up is not open, and on a team board the person can edit and no vote is
   running. A viewer's paste therefore takes today's path and adds nothing.
4. `text/plain`, with leading and trailing whitespace removed, is **one address**: it contains no whitespace; it
   starts with a scheme and `://` (a letter, then letters, digits, `+`, `-` or `.`, then `://`); `new URL()` accepts
   it; and it is at most **1,000** characters (the text object's limit, so every card can change back to text).
5. It is not Board's own copy: the table step's existing test, applied to the **raw** `text/plain` before any
   trimming (an object clipboard exists, and the last copy's plain text equals that raw text or that copy was
   refused). A clipboard holding Board objects keeps today's path.

When it acts it calls `preventDefault()` and, by the address rules on the parsed URL and the length of its `href`:

**Allowed address → a card.** When the address rules pass **and** `new URL(trimmed).href.length <= 1000`. (`new
URL()` can lengthen an address, for example by percent-encoding non-ASCII characters, and a card's `url` is its
`href`, which document v22 limits to 1,000 characters.) One commit, one undo step, no notice:
- `url` is the parsed URL's `href`; `title`, `description` and `site` are `""`; `asset: null`; `layout: "vertical"`;
  `state: "loading"`; `requestedAt` is `Date.now()`.
- 306 × 288, centred on the view centre: `x = round(view.x − 153)`, `y = round(view.y − 144)`, then kept within
  the **document bounds**; on the current page; in the section under its centre (as a pasted picture); no group; on
  top of its band.
- It is selected at once (within 200 ms of the key press), and the arrival starts.
- With **no preview service**, the card is made link-only at once instead: `state: "linkOnly"`, `layout:
  "horizontal"`, 480 × 64 centred on the view centre and kept within the document bounds. No request leaves the
  page.

**Refused address → a text object (LC4).** An address that fails the address rules (another scheme such as `ftp://`;
an IP literal of either family, in any form `new URL()` normalises, such as `127.0.0.1`, `0x7f.1` or `[::1]`;
`localhost`; a name ending `.localhost`, `.local`, `.internal` or `.home.arpa`; a single-label name; a port other than
80 or 443; a user name or password) becomes one **text object** holding the trimmed text exactly. It is made as
Change back to text makes one (below), except its place: its default 320-unit width and its grown height are centred
on the view centre, `x = round(view.x − 160)`, `y = round(view.y − height ÷ 2)`, then kept within the document
bounds. Selected, not opened for editing. One undo step, no notice, no request.

**Allowed address too long → the same text object.** An address that passes the address rules but whose `href` is
longer than 1,000 characters becomes the same text object, holding the trimmed text (which step 4 keeps within 1,000
characters), placed and selected as above. One undo step, no notice, no request.

Text that is not one address (plain words, two addresses, an address with a space inside, `mailto:…`) is not touched
by the link step.

### The arrival (LC7)

Only the paster's browser runs it, once for each card it pasted. Viewing a card never asks; copies, duplicates, board
files, imports, templates, undo and redo never ask again.

**The same board, still editable (the gate).** When the card is pasted the browser notes the **opening**: the
board's `boardId`, the `HostedBoard` object on a team board (none on a single-user board) and, on a single-user board,
the `LocalStore` object. The gate runs **before the upload** (step 4) and **again before the finish** (step 5, at the
commit). It passes only when all of these hold:
- the page is still mounted and the open board has the same `boardId`;
- **single-user:** this tab is still the board's **active local writer** through the same opening: the `LocalStore`
  in use is the noted object, it is still open (`active`), and the board is not read-only (this tab still holds the
  writer ownership). If the writer was lost (another tab took it, storage changed under it, a save found the stored
  board changed, the page was hidden), the arrival is **cancelled**;
- **team:** the same `HostedBoard` object is in use, the person's role is still owner or editor, and the **live
  editable document** is shown. While a version preview is shown (the board drawn is the preview, not the live
  board), the arrival **holds** at the gate until the live board is shown again; if that has not happened by
  `requestedAt + 15,000` ms, the arrival is **cancelled**;
- the card is still on the board with the same `id`, `url` and `requestedAt`, in `state: "loading"` (checked before
  the upload too, so a card deleted, undone or changed back to text is never uploaded for).

A **cancelled** (ended) arrival aborts what is still running and writes nothing (no picture, no edit). The card stays
`loading` and is drawn link-only once it is stale. Other passing reasons that the board cannot take an edit *now* do
not end it; they hold the finish (step 8).

1. **Ask.** `POST` with the body `{ "url": <the card's url> }` (`Content-Type: application/json`, `credentials:
   "omit"`, `referrerPolicy: "no-referrer"`): a team board through the team route with the person's bearer token; a
   single-user board through the public route with no `Authorization`. The request is aborted after **15,000 ms**.
2. **Answer.** Only a 200 whose body is well formed (API v16: `url`, `title` non-empty, `description`, `site`, and
   `picture` either `null` or `{ type, bytes }` with `bytes` base64 of at most 5,242,880 bytes) is a preview. Any other
   status (403, 404, 413, 422 `address_refused` or `preview_unavailable`, 429 `rate_limited`, 502, 503), a malformed
   body, a network failure or the abort gives the **link-only finish**.
3. **Thumbnail.** With a `picture`, the browser decodes the bytes and makes the thumbnail (below). If they do not
   decode or do not encode, the card is finished **without a picture** (ready, title-only look).
4. **Hold the picture, then name it.** The thumbnail is stored as an ordinary board picture before the card names it
   (after the gate above):
   - single-user: when holding it keeps the board's pictures within 50 MiB (the existing `PICTURE_LIMIT`, counted as
     the board's picture bytes are counted today, each hash once), it is written to the local picture store
     (`asset/<hash>`) and the tab's picture map; otherwise the card is finished without a picture. A store failure
     gives the link-only finish. **At the finish the budget is counted again** on the board as it is then (each hash
     once, the thumbnail included); if it is then over 50 MiB, the card is finished without a picture, and the stored
     record, named by nothing, is removed by the next save's clean-up;
   - team: through the existing picture upload, `PUT /boards/:board/assets/:hash`. `ok` → named; `full` (409
     `board_pictures_full`) → finished without a picture; any other answer → the link-only finish.
5. **Finish.** After the gate above, one edit to the card, made only if a card with the same `id`, `url` and
   `requestedAt` is still on the board in `state: "loading"` (otherwise nothing is written; a team upload that ends
   unused is cleared after 24 h as today, a local one at the next save's clean-up):
   - **ready:** `title`, `description` and `site` from the answer (`site` empty → the url's host), each cut to 300,
     500 and 100 code points as a guard; `asset` when held; `state: "ready"`; `layout` as the card has it
     (`"vertical"`); the size of its new look;
   - **link-only finish:** `state: "linkOnly"`, `layout: "horizontal"`, 480 × 64; texts stay `""`, `asset: null`.

   The **finish keys** are exactly `title`, `description`, `site`, `asset`, `state`, `layout`, `width` and `height`.
   The finish is built from the card **as the board holds it at the commit**: its `x` and `y` are read then, so a
   move made while the card loaded is kept, and they change only when the new size would cross the document bounds
   (shifted left and/or up just enough). Every other key (`page`, `section`, `group`, `order`, `url`, `requestedAt`)
   stays as the board holds it then. The card keeps the pasted `url`; the answer's `url` is not used. The finish is
   **one commit**: on a team board the adapter writes the rectangle (`x`, `y`, `width`, `height`, one shared value)
   and the finish keys in **one shared-document transaction** (sync v18). A single-user board commits the finish
   without recording it (`commit(next)`); a team board commits it as an **arrival** (sync v18: `arrivalOf`).

   **A move by another person at the same instant (team).** When another person's move of the card is concurrent
   with the finish, the two edits merge; both outcomes are **accepted**: either the finish's rectangle wins (the card
   is finished at the place the paster's board held, and that move is lost), or the move's rectangle wins (the card is
   finished at the moved place and keeps the loading size, 306 × 288, which is a valid card size; its face is drawn
   inside it). Neither is refused by the room, and neither is repaired later. Sync v18 **Verification** proves both
   arrival orders with two clients.
6. **Not an undo step.** The finish amends the paste's undo history instead of adding a step:
   - single-user: the browser writes the eight finish keys into every version of that card (the same `id`, `url` and
     `requestedAt`) held in the board's undo history, past and future, each version keeping its own `x`, `y` and
     every other key; a version whose `x` or `y` would put the new size across the document bounds is shifted left
     and/or up just enough. So no undo or redo ever brings back the loading look, and a move made while the card
     loaded keeps both its positions;
   - team: sync v18's `SharedUndo.amend`. A step this person made while the card loaded whose entry the arrival's
     values changed follows the existing stale-guard rule: a move's `geometry` entry holds the card's `width` and
     `height` too, so when the finish changes the card's size, that move **may no longer undo** after the arrival
     (accepted; when the finished size is the loading size, 306 × 288, it undoes as usual).
7. **Deadline.** If the finish has not been made by `requestedAt + 20,000` ms, the browser aborts what is still
   running (the request or the upload) and makes the link-only finish (with the same gate and holds).
8. **Held, never mid-gesture.** A finish waits while the paster is in a pointer gesture, composing or editing text,
   Tidy up is open, or the board cannot take an edit for a passing reason (the existing editing command reason is not
   empty; on a team board, also while `hosted.canEdit` is false: reconnecting, rejoining or recovering; a version
   preview holds at the gate instead, with its own 15,000 ms limit). On a single-user board a read-only board is not a
   passing reason: it means the writer was lost, and the gate cancels. It is made at the first moment after all of
   these end. If that moment is past the deadline, the link-only finish is made instead.
9. **Refused by the room (team).** When an arrival's edit is refused, whether the session refuses it before sending
   (too large) or the room answers `refused`, the session's existing refusal handling runs (the edit is dropped and
   the board rejoins), but **no notice shows**: the hosted board's refusal toast (`words.refusedEdit`) is not shown
   for an arrival's request. What the paster's browser then writes is sync v18's **one retry** rule, stated there
   once: one silent link-only finish, then nothing more.

**Undo and Redo around an arrival.** Each sequence below is checked by name (web modules v50 **Tests**, sync v18
**Verification**). "Finished" is the card with its finish keys; positions are its own top-left.

| Sequence | Single-user board | Team board |
| --- | --- | --- |
| paste → arrival → Undo → Redo | Undo removes the finished card; Redo brings it back finished | Undo removes the finished card; Redo restores it finished, under a fresh `id` (as today) |
| paste → move → arrival → Undo → Undo → Redo → Redo | Undo 1 moves the finished card back; Undo 2 removes it; Redo 1 brings it back finished at its pasted place; Redo 2 moves it again | When the finish changed the size: Undo 1 is refused with today's changed-by-others notice and that step is gone; Undo 2 removes the finished card; Redo 1 restores it finished at its moved place under a fresh `id`; Redo 2 has nothing to redo. When the size did not change, as single-user |
| paste → Undo before the arrival | The card is removed; an arrival that reaches its finish now finds no card and writes nothing. Redo brings the loading card back under its **same** `id`: if the arrival has not yet reached its finish, it finishes that card; if it already ended, the card stays `loading` | Redo restores the loading card under a **fresh** `id`, so the arrival never finds it; it stays `loading` |
| paste → Change back to text → Undo → arrival (the conversion and its Undo both before the arrival) | The arrival **applies**: Undo restored the card under its same `id`, `url` and `requestedAt`, still `loading`, so the gate and the finish find it; the finish is also written into the conversion's versions, so Redo and Undo of the conversion keep the finished card | The arrival is **dropped**: Undo restored the card under a fresh `id`, so the gate finds no card with the arrival's `id` and writes nothing (no upload if the gate runs before it); the card stays `loading`, is drawn link-only once stale, and is never fetched again |
| Change back to text → arrival → Undo | The arrival finds no card and writes nothing; Undo restores the loading card, which stays `loading` | The same, under a fresh `id` |

A card left `loading` this way is **never fetched again**; it is drawn link-only once 20,000 ms are past its
`requestedAt`. The single-user rows are checked in web modules v50 **Tests** and the team rows in sync v18
**Verification**, each sequence separately for the two modes.

**Stale cards.** A card can be left loading (the paster closed the tab, an arrival ended or was dropped, or a copy was
made while it loaded). Nothing is written for it (document v22 rule 5, sync v18): every browser draws the link-only
face **inside its stored rectangle** (306 × 288, **Drawing at the stored size**) and offers the link-only bar; the
stored rectangle is its hit area, its selection outline and the bar's anchor, so what is seen, clicked and outlined
agree. An edit a person makes to it other than moving, arranging, grouping, sectioning or deleting (a layout choice)
writes it as `state: "linkOnly"` with the link-only size (480 × 64), its top-left kept (except for the document
bounds shift), in that same edit. Change back to text works on it as on any card.

**No notices.** Pasting a card or a text object, every finish, every failure and a refused arrival show no notice,
toast or error text. There is no retry control.

### The thumbnail (LC8)

Made in the paster's browser from the answer's picture bytes:
- The type is sniffed from the bytes with the existing picture sniffer (PNG, JPEG, GIF, WebP); anything else means no
  picture. It is decoded with `createImageBitmap`; a GIF gives its **first frame**.
- Scale `s = min(1, 640 ÷ max(width, height))`; the thumbnail is `max(1, round(width × s))` × `max(1, round(height ×
  s))`: at most **640** on its longer side, never enlarged. It is drawn on a canvas with high-quality smoothing.
- It is encoded as **PNG** when any pixel of the drawn thumbnail has alpha below 255, otherwise as **JPEG at quality
  0.85**. The stored picture is `{ bytes, mime, pixelWidth, pixelHeight }` of the encoded thumbnail, named by the
  SHA-256 of its bytes, like any other picture (its type sniffed again equals `mime`).

### The card's looks (LC2)

The approved mock-up drew each card as a CSS box with `box-sizing: border-box` and `border: 1px solid #e3e1e6`, so its
picture, dividers and body sit **inside the border**. Every value below is that approved box translated to canvas
coordinates, offsets from the card's top-left corner (its saved `x`, `y`), the 1-unit border already counted.

Common to every look:
- **Frame.** A rectangle of the look's size with corner radius **8**, filled `#ffffff`, and a **1-unit border**
  `#e3e1e6` lying inside the rectangle: drawn last, as a stroke of width 1 on the rectangle at 0.5, 0.5 of
  `width − 1` × `height − 1`, radius 7.5. No shadow.
- **Inner box.** The rectangle inside the border: 1, 1, `width − 2` × `height − 2`, corner radius 7. The picture, the
  dividers and every fill are clipped to it; nothing is drawn under the border.
- **Type.** Font family `system-ui`. Title: 14, line height 20, weight 600, `#1e1c22`. Description: 12, line height
  17, weight normal, `#5f5b66`. Site: 12, line height 16, `#5f5b66`, underlined. Address (link-only): 13, line height
  16, `#3d3942`, underlined. A text's position is the top of its first line box (Konva `Text` at that `y` with
  `lineHeight = line height ÷ font size`).
- **Underline.** The site and the address are underlined by a filled rectangle the card draws itself (not Konva's
  `textDecoration`): 1 unit tall, in the text's colour, from the text's left edge for the width of the drawn text (its
  ellipsis included), with its top edge **2 units below the text's alphabetic baseline** (the approved
  `text-underline-offset: 2px`). For a one-line text whose line box top is `t` and line height `L`, the baseline is
  `t + L ÷ 2 + (A − D) ÷ 2`, where `A` and `D` are the canvas `measureText` result's `fontBoundingBoxAscent` and
  `fontBoundingBoxDescent` in that font (the CSS line-box rule). In the approved capture the site's underline is the
  row 14 units below the site row's top.
- **Text cuts.** Text wraps at word boundaries (a word longer than the line breaks between characters) to the box
  width given, and is cut to the stated number of lines; a cut ends with an ellipsis (`…`). One-line texts never wrap.
- **Link glyph.** 14 × 14: the paths `M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1` and
  `M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1` in a 24-unit box scaled to 14, stroked `#8a8590`,
  width 2 (in the 24-unit box), round caps, no fill. It is centred on the 16-unit site row (its top 1 unit below the
  row's top) and its text starts 20 units right of the glyph's left (14 + a 6-unit gap). It stands in place of a site
  icon; no favicon is fetched.
- **Picture.** The card's `asset` picture, **cover-cropped** into its box: scaled by `max(boxW ÷ pixelWidth, boxH ÷
  pixelHeight)` and centred, the overflow cut. Until the picture is decoded (or if it never loads), its box is filled
  `#f1f0f3`, with no text.
- **Selection.** See **Selection, handles and keys**.

| Look | Parts (offsets from the card's top-left, inside the border) |
| --- | --- |
| loading | Picture box 1, 1, 304 × 159 filled `#f1f0f3`; a divider 1, 160, 304 × 1 `#efedf1`. A **spinner** centred at 153, 80.5 (the picture box's centre): a ring of radius 9.75, stroke 2.5, `#d8d5dc`, and over it an arc of the same ring in `#7051cf` spanning the top quarter (from −135° to −45°, 0° pointing right); it is still, not animated. Three bars, each 10 tall, radius 5, `#eeedf0`, at x 15: y 177 width 171, y 197 width 254, y 217 width 204 (62%, 92% and 74% of 276, rounded) |
| vertical | Picture 1, 1, 304 × 159; divider 1, 160, 304 × 1 `#efedf1`. Title at 15, 173, box width 276, at most 2 lines. Description at 15, `177 + 20·Lt`, width 276, at most 2 lines (none when empty). Site row top at `height − 25`: glyph at 15, `height − 24`; site text at 35, `height − 25`, width 256, one line |
| horizontal | Picture 1, 1, 111 × 112; divider 112, 1, 1 × 112 `#efedf1`. Title at 127, 11, width 338, one line. Description at 127, 35, width 338, one line (none when empty). Site row top at 87: glyph at 127, 88; site text at 147, 87, width 318, one line |
| title-only vertical | No picture, no description. Title at 17, 17, width 272, at most 2 lines. Site row top at 67: glyph at 17, 68; site text at 37, 67, width 252, one line |
| title-only horizontal | No picture, no description. Title at 17, 11, width 446, one line. Site row top at 37: glyph at 17, 38; site text at 37, 37, width 426, one line |
| link-only | Glyph at 17, 25; the card's full `url` at 37, 24, width 426, one line, in the address style. No title, picture or error text |

How the rows follow from the approved box: vertical body padding 12 / 14 / 14 below a 160-unit picture box that
includes its 1-unit divider (so the title starts at 1 + 160 + 12 = 173 and x 1 + 14 = 15), a 4-unit gap between
title, description and site, and 8 more above the site row; the content-fit height `210 + 20·Lt + (Ld > 0 ? 4 +
17·Ld : 0)` (230, 250, 251, 268, 271 or 288, kept) then leaves 8 units of padding below the site row, as the approved
288 capture shows. Horizontal: a 112-unit picture box that includes its 1-unit divider, body padding 10 / 14, the site
row at the bottom (113 − 10 − 16 = 87). Title-only vertical: padding 16, the site row at the bottom (99 − 16 − 16 =
67). Link-only: padding 16 left, the row centred in the inner box (1 + (62 − 16) ÷ 2 = 24). The title-only horizontal
look was not drawn in the mock-up; it takes the horizontal body's vertical padding (10) and the title-only look's
side padding (16).

A drawn line count is measured with the canvas's own wrapping in the font above (title box 276 wide; description box
276 wide). The site shown is the card's `site`.

### Drawing at the stored size

The look (state, `asset`, `layout` and the stale rule) chooses the **face**; the stored rectangle `W × H` is its
frame. The values above are each look's at its written size (`w × h`, the looks table). At any other card size
(document v22) the same face is drawn in `W × H` by these rules, which give exactly the values above when `W × H` is
the written size:
- the frame and the inner box use `W` and `H` (as above); everything is clipped to the inner box;
- every left offset is kept; every box width (a text box, the vertical picture box and its divider, a loading bar)
  becomes its value plus `W − w`; the horizontal look's picture box and divider keep their left-hand place and width;
- rows measured from the top (the vertical picture box and divider, the title, the description, the loading bars and
  spinner) keep their offsets; the site row is anchored to the bottom, at `H − (h − its top)` (vertical:
  `H − 25`; horizontal and title-only horizontal: `H − 27`; title-only vertical: `H − 33`); the horizontal picture box
  and divider are `H − 2` tall;
- the link-only face's row is centred in the inner box: its top is `(H − 16) ÷ 2` and the glyph's top 1 unit below it,
  its left padding 16 (the address at 37, its box `W − 54` wide). A stale card at 306 × 288 so shows its address at
  37, 136 in a 252-unit box;
- a vertical face's line caps come from its stored height when it is one of the six content-fit heights (above), and
  are 2 and 2 at any other height.

The selection outline, the hit area and the bar's anchor are the stored rectangle in every case.

### Selection, handles and keys

- **Outline.** A selected card is outlined like a picture: a rectangle at its stored rectangle, stroke `#518de0`,
  **2 screen pixels** at every zoom (`2 ÷ zoom` units), square corners, centred on the edge.
- **No resizing when a card is selected.** When **any** selected object is a card, no resize handles are shown and
  the selection cannot be resized by any path, for any role, in any look: neither its cards nor its other objects.
  The Objects panel's Wider, Narrower, Taller and Shorter are then disabled with the title `Link cards can't be
  resized.` (washi tape's text `Washi tape can't be resized.` wins when the selection also holds tape). Selections
  without cards keep today's handles and resizing, the tape and mind-node restrictions included (document v22 rule
  1). A card moves, arranges, joins sections, groups and pages as a picture does; it is never a connector end
  (document v22 rule 2).
- **Keys.** Delete and Backspace delete the selected cards (the existing Delete command and its text). Enter and a
  double-click do nothing on a card (as on a picture: there is no text to open). Cmd/Ctrl+C, X, V and D use the
  existing object clipboard and Duplicate; a copied card's plain text is its `url`, so a pasted copy is Board's own
  copy and is pasted as a card without asking again. A copy keeps every key, `state` and `requestedAt` included.

### The context bar (LC3)

The existing context bar (`.context`) shows the link bar when **every** selected object is a card. A selection mixing
cards and other objects shows the generic bar exactly as today (label `<n> objects`, no link buttons).

| Selection | Bar, left to right |
| --- | --- |
| One card, loading look | `Link` · divider · **Open link** · **Change back to text** · the existing Arrange, Move to page (when shown today), Duplicate and Delete |
| One card, any other look | `Link` · divider · **Open link** · **Display vertical** · **Display horizontal** · **Change back to text** · Arrange, Move to page (when shown), Duplicate, Delete |
| Two or more cards | `<n> links` (for example `2 links`) · divider · Arrange, Move to page (when shown), Duplicate, Delete |

Tidy up is not shown on a link bar. The label is a `<span>` as the picture bar's `Image` is, followed by the existing
`<span class="divider">`. The bar is placed over the selection's stored rectangle, as for any object.

**Narrow windows.** When the context bar is not shown (below 768 px wide, or when it does not fit), as today for every
object, the link commands, like every bar command, are not offered: no other route offers Open link, the layout
buttons or Change back to text. This is a stated limit of this version; Delete, Duplicate and the keys keep their
existing routes.

**Buttons.** Each new button is the bar's existing `button.icon-button` (40 × 40) with an SVG icon of 20 × 20
(`viewBox="0 0 24 24"`, `fill="none"`, `stroke="currentColor"`, `stroke-width="1.8"`, `aria-hidden="true"`) and the
existing `<span class="tooltip">`:

| Button | `aria-label` and tooltip | Icon |
| --- | --- | --- |
| Open link | `Open link` | path `M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5`, round caps and joins |
| Display vertical | `Display vertical` | rect 6, 3, 12 × 18, `rx` 2; path `M6 11h12`; path `M9 15h6M9 18h4` with round caps |
| Display horizontal | `Display horizontal` | rect 2.5, 7, 19 × 10, `rx` 2; path `M9 7v10`; path `M12 10.5h6M12 13.5h4` with round caps |
| Change back to text | `Change back to text` | paths `M4 7V5h11v2M9.5 5v13M7.5 18h4` and `M15 14h5M18 11.5l2.5 2.5-2.5 2.5`, round caps and joins |

The two layout buttons sit together in one horizontal, labelled group, `<span class="link-layout" role="group"
aria-label="Link layout">`. The one matching the card's `layout` has `aria-pressed="true"`, the other
`aria-pressed="false"`. The group and the pressed button are drawn by exactly two new CSS rules, placed together
after `.context .paint-modes button[aria-pressed=true]` in `apps/web/style.css`:

```css
.context .link-layout { display: flex; align-items: center; gap: 4px; }
.context .link-layout button[aria-pressed=true] { background: #7051cf; border-radius: 6px; }
```

The first lays the pair out as a row with the bar's own 4 px gap, so the label, divider and all four link buttons
stand 4 px apart as in the approved bar (the mock-up placed them straight in `.context`, whose `gap` is 4px). The
second gives the pressed button the approved purple square with 6 px corners; its white icon comes from the existing
`button[aria-pressed=true]` rule. **Hover** is the bar's existing one, unchanged: an unpressed button gets the
`#f1eff5` background and a `#29272e` icon (`button:hover…` and `.context button:hover:not(:disabled)`); a pressed
button keeps its purple background and its icon turns `#29272e`, as the approved hover capture shows. No other rule
is added or changed.

**Enabled.** Open link is always enabled, for every role. Display vertical, Display horizontal and Change back to
text are disabled whenever the existing selection reason is not empty (a viewer, read-only, composing, a gesture);
then their tooltip shows that reason, and each carries `aria-describedby="selection-reason"`, as the bar's other
editing buttons do. Arrange, Duplicate and Delete keep their existing rules.

**Link-only look.** Both layout buttons are shown and the pressed one is the card's `layout` (`horizontal` after a
link-only finish). Choosing the other records the new `layout` (an undo step) while the link-only look stays 480 × 64
(there is one link-only look). On a stale card the choice also writes it link-only, as **Stale cards** says.

### What the buttons do

- **Open link (LC6):** `window.open(url, "_blank", "noopener,noreferrer")`. Nothing is written, nothing is fetched by
  Board, and no notice shows. Viewers may use it.
- **Display vertical / Display horizontal:** one undo step setting `layout` and the size of the card's new look, its
  top-left (`x`, `y`) kept except for the document bounds shift. The browser that writes a vertical size measures
  `Lt` and `Ld`. Choosing the current layout does nothing.
- **Change back to text (LC5):** one undo step that removes the card and adds one **text object** in its place:
  - `text`: the card's `url`; no marks;
  - `x`, `y`: the card's saved top-left, kept within the document bounds (a card near the right or bottom edge
    gives a text object shifted left and/or up just enough); width **320** (the text tool's default width); height
    the existing grown height of that text in that width (as a text object's height grows with its lines);
  - text size **Medium**, colour neutral, alignment left (the text tool's defaults);
  - the card's page, section and group, and its place in the stacking order.

  The text object is selected and not opened for editing, and **focus moves to the canvas** (the scene element
  inside `<main>`, as Delete returns it), because the pressed button is removed with the link bar: an immediate
  Cmd/Ctrl+Z then reaches `<main>`'s key handler and undoes the conversion. One Undo removes the text object and
  restores the card
  exactly, thumbnail included (its picture stays held). It works in every look, loading included. A loading card
  changed back is gone, so an arrival that reaches its finish then finds no card with its `id` and `url` and writes
  nothing. Undo restores the card under its same `id` on a single-user board (an arrival that has not yet reached
  its finish still finishes it) and under a fresh `id` on a team board (no arrival ever finishes it); a restored card
  left `loading` is drawn link-only once 20,000 ms are past its `requestedAt` and is never fetched again (**Undo and
  Redo around an arrival**).

### Viewers (LC6) and roles

Owners and editors (and board guests with an editor grant) paste cards, use the layout buttons and Change back to
text. A **viewer** who selects a card sees the same bar with only Open link enabled: both layout buttons (the current
one pressed, dimmed as disabled buttons are), Change back to text, Arrange, Duplicate and Delete are disabled, and no
handles show. A viewer's Cmd/Ctrl+V of an address adds nothing (today's path). The team route refuses viewers (access
v17); viewers' browsers never ask the preview service and never write a card.

### The About line (LC9)

The About popover (the bottom-left "i", `section.information-panel`, label `About local storage`) keeps its existing
paragraph and gains a **second `<p>`**, directly after it, with no class and no inline style:

| Board | Second paragraph |
| --- | --- |
| Single-user board, with a preview service | `Links you paste are read by Board's link preview service, which fetches each page's title, description and picture. Only the link is sent, never your board.` |
| Single-user board, no preview service | None (the popover is as today) |
| Team board, every role | `Links pasted on team boards are read by Board's server, which fetches each page's title, description and picture. Only the link is sent.` |

Its look is the existing paragraph's, from existing rules only: 14 px `system-ui`, `#29272e`. The gap between the two
paragraphs is **14 px**: the first paragraph's default bottom margin (1em at 14 px), with `margin-top: 0` on the new
one from `.information-panel p`. That is the spacing the approved capture shows: the capture gave its added line an
inline `margin-top: 8px`, which collapses with the first paragraph's 14 px bottom margin, so the gap drawn was 14 px,
not 8. No margin, class or inline style is added. There is no consent prompt.

### Accessibility

The new buttons are labelled buttons with tooltips; the layout pair is a labelled group with `aria-pressed`. No focus
moves on paste, arrival or a layout change; after Change back to text the selection moves to the text object as any
command's result does and focus moves to the canvas (above), so the keyboard keeps working. No live region or notice
is added. Below 768 px the link commands are not offered (**Narrow windows**).

### Not in this version (link cards)

Interactive embeds, oEmbed and any HTML from a site; a native import from other whiteboard tools; a favicon; a retry control or any
failure notice; a consent prompt; hyperlinks inside text objects; pasting plain non-address text as text; resizing a
card; Open link, layout or Change back to text for several cards at once, or when the context bar is not shown (narrow
windows); an animated spinner; a server-side cache of previews; repairing a card whose concurrent move and finish
merged (both outcomes are accepted).
