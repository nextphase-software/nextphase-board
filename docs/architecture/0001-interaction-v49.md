# 0001 — Interaction

Contract version: 49 (for 0012-W3 brief v1, 2026-11-22). Status: Draft. When accepted it replaces
[interaction v48](0001-interaction-v48.md) for later work. Uses [document v20](0001-document-v20.md),
[storage v3](0001-storage-v3.md) and [board file v4](0006-board-file-v4.md), all unchanged, and
[sync v16](0003-sync-v16.md), [API v13](0003-api-v13.md) and [hosted storage v13](0003-hosted-storage-v13.md).

Every rule in v48 (and, through it, v47 back to v4 and the 0001-W3 presentation) still applies except where
this version replaces or adds to it. This version adds two things:
- **Pictures on team boards.** Owners and editors add images on a hosted board as on a local board (v24); the
  picture is uploaded to the board's server first, and the image is added only once it is stored. Everyone who
  can open the board sees it, with a loading box until their copy arrives.
- **Animated GIFs play**, on local and hosted boards alike, only while a GIF is the one selected object.

It replaces:
- hosted storage v1's rule that images are not on hosted boards (the Image button absent, its keys and pasted
  or dropped files doing nothing);
- v24's rule that "GIFs are drawn still": an animated GIF plays as **GIFs** says.

## Terms

- **Local board** and **hosted board** as in v48. On a hosted board, **can add pictures** means the snapshot
  role is not `viewer` (owner, editor, or a guest with an editor grant) and **importing is available** (v24's
  rule; a hosted board is read-only while it is disconnected, previewing or locked, so importing is then
  unavailable and the Image button `disabled`).
- **The tab's pictures** are storage v3's tab-lifetime map (`tabPictures`), shared by every board the tab opens.
- An image's picture is **drawn** when the tab holds a decoded bitmap for its hash whose size equals the image's
  own pixel size (v24's rule).
- **Animated GIF**: an image whose picture is drawn, is a GIF (by signature), and whose bytes hold **two or more
  image descriptors** with a logical screen size equal to the image's pixel size, as `gifInfo()` reads them
  without decoding ([web modules v47](0001-web-modules-v47.md)). Any other GIF is an ordinary picture: one frame,
  drawn still, with no badge or play button.

## Adding pictures on a hosted board

**The Image button** (v24) is shown on a hosted board whenever the snapshot role is not `viewer`, in the same
place (directly after Templates, before Reactions and Comment) with the same look, tooltip and keys; it is
`disabled` while importing is unavailable. A viewer's palette has no Image button.

**Keys, paste and drop.** ⌘⇧K / Ctrl+Shift+K, the paste event carrying files and a drop of files work on a hosted
board exactly as v24 says for a local board, while the person can add pictures. For a viewer, or while importing
is unavailable, they do nothing, as today, and the existing read-only line stays the only text. A paste event
without files still runs object Paste; CSV files and spreadsheet text are still taken first, as v47 says.

**Importing** on a hosted board follows v24's **Importing** steps 1–7 unchanged (one import at a time, signature,
decoding, landing size, scaling to 4,096, hashing, the 250-object and 50 MiB checks against the pictures the tab
holds for this board) with these changes:

- At the start, before any file is read, the board notice reads **`Adding <names>…`** (on a hosted board, while the
  import runs, the notice shows only this line: the existing busy and armed-tool lines are not added under it), with *names* as v24's
  refusal notice names files (the first three, `a`, `a and b` or `a, b and c`, then ` and k more`; an empty name is
  `Clipboard image`) and the ellipsis U+2026.
- Step 8 is replaced: the picture is **uploaded** (`PUT /boards/<board>/assets/<hash>`, the stored bytes as the
  body, API v13), one file at a time in order. An answer of 200 or 201 accepts it and puts it in the tab's
  pictures. Nothing is written to IndexedDB.
- A file's refusal reasons on a hosted board (the notice is v24's `Could not add <names>: <reasons>.`):

  | Cause | Reason |
  | --- | --- |
  | Step 1 (over 20,971,520 bytes), or the server's 413 | `it is larger than 20 MiB` |
  | Step 7's 50 MiB check, or the server's 409 whose reason is `board_pictures_full` | `this board already holds 50 MiB of pictures` |
  | The upload fails without an answer (a network error), or the board is disconnected (below) | `you are offline` |
  | Any other answer, or no answer within 120 seconds | `the server did not accept it` |
  | Steps 2–4 and the 250-object check | v24's reasons, unchanged |

- **Stopping.** Checked before each file, after each file is prepared (read and decoded), right before each
  upload is sent, after each upload, and right before the images are added:
  - if the open board changed, the page is closing, the role became `viewer`, or a history preview or lock began,
    the import stops at once: nothing is added and the notice is cleared (set to empty); pictures already stored
    stay on the server until clean-up;
  - if the board cannot take an edit because it is disconnected, rejoining or recovering (the snapshot is not
    connected, or `HostedBoard` reports a rejoin or recovery), no further file is uploaded: every file not yet
    accepted and every file accepted so far is refused with `you are offline`. Once this happens the import stays
    stopped even if the board reconnects before it ends.
  A single upload's network error with the board still connected refuses that file only; the next file is tried.
- **Adding.** After the last file, the 250-object check is run again against the board as it is now (others may
  have added objects meanwhile), refusing the files over it in order with v24's reason. The accepted files are then
  added together as v24 says (one transaction, one history step, selected, Select tool, panel closed, focus on the
  canvas), sent as one hosted edit.
- **Notices at the end**: with any refusal, v24's refusal notice; otherwise the notice is cleared. There is no
  success notice on a hosted board (`Added n images.` stays for local boards only).

Other people on the board receive the image through the room like any edit; their copy of the picture loads as
**Seeing pictures** says.

## Seeing pictures on a hosted board

Each time the tab opens a hosted board (a new board, or the same one reopened), it starts one **loader** for that
opening. For every image on the shown board (the live board or a history preview) whose picture is not in the tab's
pictures, the loader queues its hash once, in board order, and loads it with `GET /boards/<board>/assets/<hash>`
(API v13), at most **four** requests at a time. A load succeeds when the answer is 200, its bytes' SHA-256 equals
the hash, they have a picture signature, and `createImageBitmap` decodes them; the picture (its bytes, signature
type and the decoded size as its pixel size) then enters the tab's pictures and is drawn as v24 says. A failed try
frees its slot and is retried after **1,000 ms**, then after **2,000 ms**; after the **third** failed try the
picture is **unavailable** for this opening. When the opening ends (another board opens, or this one is opened
again), its timers stop, its requests' answers are ignored, and its queue and tries are dropped; the tab's pictures
keep every picture already loaded.

While a picture is loading (queued, requested or waiting for a retry), its images draw the **loading box**: the
image's rectangle filled `#f1eff4` with `Loading image…` on one line centred in it, in the system UI font at 13
units with line height 1, colour `#57535d`, clipped to the rectangle. An unavailable picture draws v24's existing
missing-picture box (`#dedede`, `Image unavailable`, 14 units, `#5f5b66`). Either box stays selectable, movable,
resizable, describable and deletable, with v24's outline when selected. Local boards never show the loading box.

## Copying and pasting pictures

The object clipboard is unchanged: it lives as long as the open board's view (on a hosted board, until another
board opens), as today; nothing new carries it from one team board to another.

Object Paste (v14, by key or by the Objects panel), on local and hosted boards: if any copied image's picture is
not in the tab's pictures (it has not loaded, or is unavailable), nothing is pasted and the notice reads
**`Could not paste the image: it has not loaded yet.`** Otherwise v14's Paste runs as today. No paste, Duplicate,
Cut, Undo or Redo uploads a picture: each stays on the board that holds it ([sync v16](0003-sync-v16.md) says what
an old Undo step or paste can meet).

## GIFs

On local and hosted boards, for every **animated GIF** that is drawn on the open page:

- **Still**: it draws its first frame (v24's drawing), and, while it is not selected, a **badge** at its top
  right.
- **Hover**: while it is not selected and the pointer is over it (the topmost object under the pointer by the
  Select tool's hit test, with no button pressed, the Select tool armed and no gesture, text session or inline
  editor), a **play button** at its centre. The hover ends when the pointer leaves the canvas or moves off the
  GIF, and whenever the tool, the open board, the open page or the view changes.
- **Playing**: it plays only while it is **the one selected object** (exactly one object selected, and it is this
  GIF), and the person's system does not ask for reduced motion (`prefers-reduced-motion: reduce`).
- **Reduced motion**: selecting it does not start it. A plain primary press on its play button (within 20 CSS
  pixels of its on-screen centre, while the play button shows; no Shift, ⌘, Ctrl or Alt, not during a Space pan, and
  not while the workshop voting mode is on) that makes it the one selected object starts it; it then plays until it
  stops being the one selected object. A press that does not make it the one selected object starts nothing, now or
  later. Selecting it again by any other means (a press elsewhere on it, the keyboard, Objects) does not start it.
- Playing starts at frame 1 and shows each frame for its delay (the Graphic Control Extension's delay in
  hundredths of a second; a delay below 2 counts as 10), looping without end, whatever loop count the file holds.
  It stops, showing frame 1 again, as soon as the GIF is no longer the one selected object (another object or
  several objects are selected, the selection is cleared, the board or page changes). Frames decoded for a GIF
  that has stopped meanwhile are dropped, never shown.
- Frames are decoded from the picture's bytes by Board's own decoder the first time the GIF plays, and kept only
  while it is the most recent GIF played. A GIF whose frames come to more than **16,000,000 pixels** in all
  (frames × width × height) does not play; the first time it would start in this tab, the board notice reads
  **`This GIF is too large to play.`** (once per picture per tab), for owners, editors and viewers alike. A GIF that
  fails to decode stays still, with no notice.
- Playing is local: it changes nothing on the board, sends nothing, records no Undo step and is never saved. Every
  person's GIFs play only on their own screen, by their own selection; a viewer's selected GIF plays.
- **Never playing, badge or button**: Export (v48) draws frame 1 and no badge or play button; Save a copy to file
  writes the GIF's original bytes; a history preview plays like the live board.

## Looks

- **Badge**: the text `GIF`, white, system UI font 700 at 10 CSS px with line height 1 and letter spacing
  0.02em, padding 3 px top and bottom and 5 px left and right, background `#1e1c22cc`, radius 4. Its top right
  corner is 6 CSS px left of and below the GIF's on-screen top right corner: it is anchored by its right edge,
  whatever width the font gives it (about 28 × 16 px). This rule is authoritative where the approved design placed
  the badge by an assumed 25 px width (its right gap there is about 3 px). It does not scale with the
  zoom. Shown only when the GIF's on-screen box is at least 40 × 28 CSS px.
- **Play button**: a 40 × 40 CSS px circle, background `#1e1c22cc`, centred on the GIF's on-screen centre,
  holding a white right-pointing triangle 13 px wide and 16 px tall whose left edge is 16 px and top edge 12 px
  from the circle's top left. It does not scale with the zoom. Shown only when the GIF's on-screen box is at
  least 56 × 56 CSS px. It is not a control: it is never focused, has no hover or pressed look of its own, and
  stays drawn during a press until the press selects the GIF (then it is hidden because the GIF is selected).
- Badge and button are drawn above the board's drawing and below the selection handles, every other overlay,
  the bars, panels, palette and notices; they take no pointer events (a press goes to the canvas beneath) and
  are hidden from assistive technology (the image's existing `role="img"` name is unchanged).
- **Loading box**: as **Seeing pictures** says.
- **Notices**: the existing board notice. On a hosted board a viewer's `This GIF is too large to play.` shows in
  the notice under the read-only line, where the existing notice already shows for viewers.

## Keys

No new key. ⌘⇧K / Ctrl+Shift+K and the paste key reach images on hosted boards as above.

## Accessibility

The images keep v24's `role="img"` elements and names. The badge and play button are `aria-hidden`. Notices are
the existing `.notice` element (`role="status"`).

## Not in this version

Video; link previews; pictures inside a board file or a template brought into a team workspace (still refused,
[API v13](0003-api-v13.md)); carrying the object clipboard from one team board to another; a GIF playing while not selected; a pause or progress control; playing in Export or
Save a copy; sending playback to other people; queuing uploads while offline; a success notice on hosted
boards; larger limits on team boards.
