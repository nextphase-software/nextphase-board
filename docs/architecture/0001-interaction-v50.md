# 0001 — Interaction

Contract version: 50 (for 0012-W4 brief v1, 2026-11-24). Status: Draft. When accepted it replaces
[interaction v49](0001-interaction-v49.md) for later work. Uses [document v21](0001-document-v21.md),
[storage v4](0001-storage-v4.md), [board file v5](0006-board-file-v5.md), sync v17, API v14 and hosted storage
v14; its modules are [web modules v48](0001-web-modules-v48.md).

Every rule in v49 (and, through it, v48 back to v4 and the 0001-W3 presentation) still applies except where this
version replaces or adds to it. This version adds **videos** on local and hosted boards: owners and editors add
MP4, MOV and WebM files by the **Media** button (the Image button renamed), its keys, paste or drop. A video
shows its first frame with a length badge; it plays, with sound, only after a press while it is the one selected
object, through Board's own control strip, on that person's screen only. A **video** is an **image** everywhere
v24 and v49 say image, except where this version says otherwise. It replaces:
- v24's and v49's **Image button** name, tooltip and picker list (see **The Media button**);
- v24's type reason `not a supported image (PNG, JPEG, GIF or WebP)`, on both kinds of board, by
  `not a supported image or video (PNG, JPEG, GIF, WebP, MP4, MOV or WebM)`;
- v24's success notice for a batch holding videos (see **Notices**);
- v24's context bar labels for a selection of media only (see **The context bar**);
- v49's rule that the hosted import notice is plain `Adding <names>…` throughout, for batches with videos.

## Terms

- **Local board**, **hosted board**, **can add pictures** and **importing is available** as v49; on a hosted
  board, can add pictures is also **can add videos**.
- **Media**: images and videos. **A video's first frame is drawn** when the tab holds a decoded bitmap for its
  `poster` whose size equals the video's own `pixelWidth` × `pixelHeight` (v24's rule, with `poster` for
  `asset`) **and** the tab's picture for `poster` is a JPEG (`mime` `image/jpeg`, storage v4). A first frame that
  is not a JPEG is never drawn for a video, on either kind of board: the video shows v24's `Image unavailable`
  box.
- **The tab's videos** (`tabVideos`): storage v4's tab-lifetime map of video records, shared by every board the
  tab opens.
- **Header**: storage v4's video header. **Signature**: storage v3's picture signature.
- **The target**: the one selected object (exactly one object selected) when it is a video on the open page
  whose first frame is drawn. There is at most one target, so at most one video plays.
- **An opening**: one load of a board into the page: opening a board, Reopen, opening a board file, and, on a
  hosted board, every full reload of its document (joining, a history preview or its end, a resync). A new
  opening ends everything playback started in the previous one.
- **A press**: one activation of Play (strip button or play button). Every asynchronous step of playback
  (attaching the source, restoring a kept time, a download's completion, starting playback) belongs to the
  press, target and opening that started it and does nothing once any of the three is no longer current.
- **On-screen box**: the object's rectangle in CSS pixels (its board rectangle times the zoom).
- Times are written `m:ss` under one hour and `h:mm:ss` from one hour (`0:42`, `12:05`, `1:02:05`). A video's
  **length text** uses `max(1, round(durationMs ÷ 1000))` seconds; a **current time** uses
  `floor(ms ÷ 1000)` seconds, never above the length.

## The Media button

The palette's Image button is renamed **Media**: same place, same icon, same look and `disabled` rule; its
`aria-label` is `Media`, and its tooltip `Media ⇧⌘K` when `navigator.platform` contains `Mac`, `iPhone`, `iPad`
or `iPod`, otherwise `Media Ctrl+Shift+K`. Activating it, or ⌘⇧K / Ctrl+Shift+K, opens the file picker as
today, now with `accept="image/png,image/jpeg,image/gif,image/webp,video/mp4,video/quicktime,video/webm"`,
`multiple`, and the hidden input's `aria-label` `Choose images or videos`. A viewer's palette has no Media button
(v49). The Media button's hover, focus and pressed looks are the shared `.icon-button` ones in `style.css`.

## Paste and drop

A drop of files takes every file. A paste event's files are considered one at a time: a file whose declared type
starts `image/` or `video/` is taken without reading it; a file over **52,428,800 bytes** is never read to decide
(it is taken only when its declared type says so); any other file is read **once** with `arrayBuffer()` and taken
when its bytes have a picture signature or a video header (below). The paste event takes its files when any is
taken; otherwise object Paste runs as today. Bytes read for this decision are kept and used by the import, so no
file is ever read twice. CSV files and spreadsheet text are still taken first (v47). For a viewer, or while
importing is unavailable, they do nothing, as today.

Each taken file is **routed by its own bytes**, never by its name, in this order (the server's order, API v14):
1. **Size gate, before any read.** A file larger than **52,428,800 bytes** is refused unread. Its reason follows
   its declared `File.type`, the only place a declared type is used: a type starting `image/` gets today's
   picture reason (`file is larger than 20 MiB` local, `it is larger than 20 MiB` hosted); any other type, or
   none, gets the video reason (`file is larger than 50 MiB` local, `it is larger than 50 MiB` hosted).
2. Its bytes are read once with `arrayBuffer()` (or taken from the paste decision; nothing is read ahead with
   `slice`). If the read fails, the file is refused with today's mapping for a failed picture read: the type
   reason `not a supported image or video (PNG, JPEG, GIF, WebP, MP4, MOV or WebM)`, on both kinds of board.
3. **Picture signature first**, exactly API v14's routing definition (`pictureSignature`: PNG `89 50 4E 47 0D 0A
   1A 0A` with `IHDR` at bytes 12–15; GIF `GIF87a` or `GIF89a` with at least 10 bytes; JPEG `FF D8 FF`; WebP
   `RIFF` at 0 and `WEBP` at 8) → the picture steps of v24 and v49 **unchanged** (`prepareImage` and its own
   validators, in today's order: the 20,971,520-byte check, its signature, decoding), on the bytes already read.
   A picture's bytes are never tested for a video header.
4. Otherwise a video **header** (storage v4) → the video steps below.
5. Otherwise, neither: a file of more than 20,971,520 bytes whose declared type starts `image/` gets today's
   picture size reason (`file is larger than 20 MiB` / `it is larger than 20 MiB`), as the size-first picture
   check gave it before; every other file gets the type reason `not a supported image or video (PNG, JPEG, GIF,
   WebP, MP4, MOV or WebM)`.

So no picture refusal text changes: a picture file of 20 to 50 MiB is refused exactly as today, now after its
bytes are read, and a declared `image/` file over 20 MiB keeps the size reason whether or not its bytes are
recognised. A 20–50 MiB file that is neither, with any other declared type, now gets the type reason where it
used to get the 20 MiB reason (a recorded change). Pictures and videos may share one batch; files are taken one
at a time in order, and one import runs at a time (v24).

## Preparing a video

Both kinds of board prepare a video the same way, in the page, before any upload or write:

1. Its header, from the bytes already read, gives its type (`video/mp4`, `video/quicktime` or `video/webm`).
2. A `<video>` element is created and never attached to the document, with `muted`, `playsInline` and
   `preload="auto"`, and its `src` set to a `blob:` URL of a `Blob` of the bytes with that type.
3. Its `loadeddata` event must come within **15,000 ms** of setting `src`. Then `videoWidth` and `videoHeight`
   must be at least 1, `duration` finite and above 0, and `round(duration × 1000)` between 1 and 86,400,000.
4. `currentTime` is set to 0 and its `seeked` event must come within the same 15,000 ms.
5. The frame is drawn into a canvas of the **first frame's pixel size**: with `L = max(w, h)` for the element's
   `videoWidth` × `videoHeight`, the size is `w × h` when `L ≤ 1,920`, otherwise `max(1, round(w × 1920 ÷ L))` ×
   `max(1, round(h × 1920 ÷ L))`; it is encoded as `image/jpeg` at quality **0.90**. The result must have the JPEG
   signature and decode to exactly that pixel size.
6. The element's `src` is removed and the URL revoked, whatever the outcome.

An `error` event, the time limit, a zero size, a duration that is not finite or out of range, or any failure of
steps 2–5 refuses the file: on a local board `this browser cannot play this video`, on a hosted board
`this browser cannot play it`. The **video hash** is the SHA-256 of the file's bytes, unchanged; the **first
frame's hash** that of the JPEG bytes. `durationMs` is `round(duration × 1000)`; `pixelWidth` and `pixelHeight`
are the first frame's. The **landing size** is v24 step 4's, from `videoWidth` × `videoHeight` (so the object
has the video's own shape), with v24's 20,000-unit reason. The video's **name** (document v21) is the file's
name with every control character (U+0000–U+001F, U+007F–U+009F) and lone surrogate removed, cut to its first
255 code points; when that leaves nothing (a pasted file without a name), it is `Clipboard video`. The name is
never drawn; it is used only in notices.

## Adding videos on a local board

Each video file, after routing (**Paste and drop**; v24's picture steps stay for pictures):

1. Prepared as above (`this browser cannot play this video`).
2. Refused when adding it would take the board above 250 objects (`250 object limit reached`, counting files
   accepted earlier in this import); when the board's picture bytes (storage v4: first frames included) with
   this first frame and those accepted in this import would be above 52,428,800 (`pictures would exceed the
   50 MiB board limit`); or when the board's video bytes with this video and those accepted in this import would
   be above 104,857,600 (`videos would exceed the 100 MiB board limit`). Each hash counts once, as v24 step 7.
3. Its video record and first-frame picture record are written in one transaction (storage v4 **Importing a
   video**). If that fails: `video could not be stored in this browser`. Otherwise it is accepted, and its
   bytes and first frame enter the tab's videos and pictures.

The end of the import is v24's (stopping, adding as one transaction and one history step, selection, Select
tool, panel closed, focus on the canvas).

## Adding videos on a hosted board

v49's hosted import applies (one file at a time, stopping and disconnect rules, the 250-object check again at
the end, one hosted edit, no success notice) with, for each video file, after routing:

1. Prepared as above (`this browser cannot play it`).
2. v24's 250-object check, and the picture budget against the pictures the tab holds for this board with this
   first frame (`this board already holds 50 MiB of pictures`). The video budget is the server's (step 4): the
   tab does not know the sizes of videos it has not downloaded.
3. **The first frame is uploaded** (`PUT /boards/<board>/assets/<first frame's hash>`, v49's picture upload,
   120 s): 200 or 201 accepts it; 409 `board_pictures_full` → `this board already holds 50 MiB of pictures`;
   a network error → `you are offline`; anything else → `the server did not accept it`. A refusal here ends this
   file: its video is not uploaded.
4. **The video is uploaded** once (`PUT /boards/<board>/assets/<video hash>`, the file as the body, through the
   single-attempt `uploadVideo` of hosted storage v14, which reports `(loaded, total)` bytes sent; timeout **600
   seconds**): `ok` accepts it; `too_large` → `it is larger than 50 MiB`; `videos_full` (409
   `board_videos_full`) → `this board already holds 100 MiB of videos`; `network` → `you are offline`; `refused`
   (any other answer or the timeout) → `the server did not accept it`. A failed upload is not retried.
5. Accepted: its bytes enter the tab's videos and its first frame the tab's pictures.

The stopping checks of v49 also run right before and right after each of the two uploads. The edit is sent
only after both are stored (the room refuses a video whose two assets it does not hold, sync v17).

## Notices

In the board notice (`.notice`, `role="status"`), for owners and editors, built with v24's name rule (the first
three names, `a`, `a and b` or `a, b and c`, then ` and k more`) and the ellipsis U+2026. A file with an empty
name is called `Clipboard video` once its bytes have been read and routed to the video steps, and `Clipboard
image` otherwise: before it is read, when it is a picture, when it was refused before reading or unrecognised.
Nothing is read ahead to name a file, so a notice built before a file is read (v49's first hosted `Adding…`,
whose timing for a batch of pictures is unchanged) names an unnamed file `Clipboard image`; later notices of the
same import (progress and refusals) name it from its routing:

- **Local, while adding**: when the import reaches its first file that has a header, before preparing it, the
  notice reads `Adding <names>…` (names of the whole batch) and stays until the end notice replaces it. A batch
  of pictures only shows no adding notice (as today).
- **Hosted, while adding**: v49's `Adding <names>…`; once the first video upload starts it reads
  `Adding <names>… <p>%`, where `p = floor(100 × done ÷ batch)`, `batch` is the sum of the batch's file sizes
  (`File.size`) and `done` the sizes of the files already accepted or refused plus the uploading video file's
  size × `loaded ÷ total`, from every `uploadVideo` progress call `(loaded, total)` (`total` is that file's size;
  a call with `total` 0 counts as 0). `p` is rounded down and never above 99 while the import runs. It is updated
  at most once every
  **250 ms**. Batches of pictures only are as v49.
- While an import runs on a hosted board (v49), and while one runs on a local board **once it has met a video
  file**, the notice shows only this line (no busy, armed-tool or invalid-field line under it). A local batch of
  pictures only keeps today's notice exactly.
- **Local, at the end without refusals**: `Added 1 image.` / `Added n images.` (pictures only, unchanged),
  `Added 1 video.` / `Added n videos.` (videos only), `Added n items.` (both). Hosted boards: none (v49).
- **Refusals** (both kinds): v24's `Could not add <names>: <reasons>.` with the reasons above.

| Cause | Local reason | Hosted reason |
| --- | --- | --- |
| A video over 50 MiB (or a file over 50 MiB whose declared type is not `image/`, before reading), or the server's 413 on a video | `file is larger than 50 MiB` | `it is larger than 50 MiB` |
| Neither signature nor header (and v24's decode failure of a picture) | `not a supported image or video (PNG, JPEG, GIF, WebP, MP4, MOV or WebM)` | the same |
| Preparing fails | `this browser cannot play this video` | `this browser cannot play it` |
| Video budget | `videos would exceed the 100 MiB board limit` | `this board already holds 100 MiB of videos` (409 `board_videos_full`) |
| Picture budget (first frames included) | `pictures would exceed the 50 MiB board limit` | `this board already holds 50 MiB of pictures` |
| Writing the records fails | `video could not be stored in this browser` | — |
| Network error, or disconnected (v49) | — | `you are offline` |
| Any other answer, or no answer within 120 s (first frame) or 600 s (video) | — | `the server did not accept it` |

A viewer's paste or drop of a video does nothing, and the existing read-only line stays the only text (v49).
Playback notices (**Errors**) show for every role; a viewer's sit under her read-only line, where the notice
already shows for viewers.

## Seeing videos

A video is drawn in the idea band exactly as an image (v24), with its **first frame** as its picture: stretched
to its rectangle, the `#518de0` 2-CSS-pixel outline and four corner handles when selected. On a hosted board its
first frame loads through v49's loader unchanged (the `Loading image…` box while loading, `Image unavailable`
after three failed tries); while the first frame is not drawn the video has no badge, play button or strip and
cannot play. The video's own bytes are not loaded to draw it.

**Badge.** While a video's first frame is drawn, it is not the target, and its on-screen box is at least 40 × 28
CSS px: a badge at its top right holding a white right-pointing triangle 6 px wide and 8 px tall, a 3 px gap,
then the length text, white, system UI font 700 at 10 CSS px with line height 1 and letter spacing 0.02em;
padding 3 px top, 5 px right, 3 px bottom, 4 px left; background `#1e1c22cc`; radius 4; contents centred
vertically. Its top right corner is 6 CSS px left of and below the video's on-screen top right corner (anchored
by its right edge). It does not scale with the zoom. A video in a selection of several objects keeps its badge.

**Play button.** While a video's first frame is drawn, it is not selected, it is hovered (v49's hover rule, for
videos as for animated GIFs) and its on-screen box is at least 56 × 56 CSS px: v49's GIF play button (40 × 40
circle `#1e1c22cc`, white 13 × 16 triangle) at its centre. A plain primary press within 20 CSS px of its
on-screen centre (v49's press rule: no Shift, ⌘, Ctrl or Alt, not during a Space pan, voting mode off) selects
the video and, when that makes it the target, **plays** it. The selection is the ordinary one: on a hosted board
it sends the ordinary selection presence update, and nothing about playback. Hovering videos works whatever the
system's motion setting.

Badge and play button follow v49's **Looks** placement: above the board's drawing, below the selection handles
and every other overlay; no pointer events; `aria-hidden`. Neither is drawn in Export or Save a copy.

**Accessible names.** Each video has v24's `role="img"` element beside the canvas, named by its whole
description or `No description`. Objects lists it as `video n`, then v24's group, description (first 36
characters, or `No description`) and section parts.

## Playing

- A video plays **only after a press**: Play in its strip, or its play button (above). Selecting it by any means
  never starts it. There is **no keyboard shortcut** (Space stays the pan key).
- It plays **with sound** (unless Mute was chosen, below), **once**: at the end it stops, paused at the end;
  Play then starts again from 0:00.
- When it stops being the target (another object or several are selected, the selection is cleared, the page
  changes, a new opening begins, it is deleted, its first frame stops being drawn), it **pauses**, leaves full
  screen if it is in it, and its current time is kept for this tab, per video object (keyed by board and object
  id; the length when it had ended); becoming the target again shows the strip **paused** at that time, never
  playing, however quickly it is reselected. A press, a download or a time restore started for the earlier
  target does nothing to the new one (**An opening**, **A press**).
- Moving or resizing the target does not stop it (**The player** says what shows meanwhile).
- Playing is local: it changes nothing on the board, sends nothing (no room message, presence key or edit),
  records no Undo step and is never saved. Every person plays on their own screen; **viewers may play**.
- With the browser blocking sound playback (`play()` rejected with `NotAllowedError`), the video stays paused
  with no notice; the next press of Play plays it. This includes the start that follows a hosted download
  (**Loading**): if the browser refuses to start playback once the download completes, the strip shows Play, no
  notice is shown, and the next press plays.

## The player

While there is a target, a `<video>` element lies exactly over the target's on-screen box (positioned as the
existing overlays are, following pan and zoom), with `object-fit: fill`, `playsInline`, no `controls`, no `loop`,
not muted unless Mute was chosen, `preload="auto"` and `aria-hidden="true"`. It takes no pointer events: a press
or drag on the video's picture passes to the canvas, so it selects, moves and resizes as today. Its source is a
`blob:` URL of the video's bytes from the tab's videos: on a local board set when the video becomes the target;
on a hosted board after the download (**Loading**). One URL per video hash per opening; all of an opening's URLs
are revoked when the next opening begins or the page hides. The element is hidden (`visibility: hidden`, so the
canvas's first frame shows) until it has played since it became the target, or it has data for a kept time above
0; then it shows until the target changes. A 2-CSS-px `#518de0` border centred on the box's edge (1 px outside,
1 px inside) is drawn over the element so the selection outline stays visible.

**Layering.** The player lies above the board's canvas and below the app's overlays: the selection handles,
Find rings, Tidy up marks, other people's cursors and selections, comment pins, the context bar, panels, the
palette and notices stay above it. While it is the one selected object it covers any canvas object drawn above
the video in the board's order (accepted: the selected video is in front while it is the target). The whole
player, strip included, is hidden (`visibility: hidden`, playback and sound carrying on) while a Tidy up preview
is open, while the Find bar is open, and while a move, resize or other drag gesture other than a Space or Hand
pan is in progress; it shows again when that ends.

**Full screen** calls `requestFullscreen()` on the element. Inline, the element is decorative (`aria-hidden="true"`,
no `controls`). On entering full screen it is exposed: `aria-hidden` is removed, `controls` is set (the browser's
own native controls, with their own labels, keyboard handling and accessibility), it takes pointer events with
`object-fit: contain`, and focus moves to the element. On leaving full screen (Escape or the browser's control)
the decorative state is restored (`aria-hidden="true"`, no `controls`), it returns to the box playing or paused as
it was, and focus returns to the strip's Full screen button (to the canvas if the video is no longer the
target). When the video stops being the target while in full screen, the page leaves full screen
(`document.exitFullscreen()`).

## The control strip

Shown only while there is a target, inside the bottom of its on-screen box: its bottom 8 CSS px above the box's
bottom edge, its left and right 8 px in from the box's sides (width = box width − 16; when that is below 120 px,
the strip is 120 px wide, centred on the box), **36 px** tall, background `#1e1c22cc`, radius **8**, padding 0
10 px 0 6 px, gap 10 px between controls, contents centred vertically, white text in the system UI font 500 at 12
CSS px with line height 1 and tabular figures. It does not scale with the zoom and may extend past the box when
the box is smaller than the strip. Left to right:

| Control | Element and label | Look |
| --- | --- | --- |
| Play / Pause | `<button>` labelled `Play` (paused, ended or loading) or `Pause` (playing) | 28 × 28, radius 6, background `#ffffff26`; a white icon in a 14 × 16 box (`viewBox="0 0 14 16"`): Play the filled path `M1 1 13 8 1 15Z`; Pause two filled rectangles `x="1"` and `x="9"`, `y="1"`, 4 × 14, `rx="1"` |
| Time | text `<current> / <length>`, e.g. `0:12 / 0:42` | 12 px; ` / <length>` at 70% white (`#ffffffb3`) |
| Seek | `<input type="range">` labelled `Seek`, `min` 0, `max` `durationMs`, value the current time in ms, `aria-valuetext` `<current> of <length>` | flexible width; a 4 px track `#ffffff4d` with radius 2; a white **fill** bar over it, 4 px tall with radius 2 at both ends, from the track's start to the current time (width = track width × time ÷ length, 0 at 0:00), so its leading end is rounded as in the approved picture, not cut square; a 12 px white round knob whose centre lies on the current time (on the fill's end), so at 0:00 and at the end it is centred on the track's ends |
| Sound | `<button>` labelled `Mute` (sound on) or `Unmute` (muted) | 28 × 28, radius 6, transparent; an 18 × 16 icon (`viewBox="0 0 18 16"`, `fill="none"`, `stroke` white, `stroke-width="1.6"`): the speaker `M2 6h3l4-3v10L5 10H2Z` filled white, then, sound on, the two arcs `M12 5.5a3.5 3.5 0 0 1 0 5M14.5 3a7 7 0 0 1 0 10`, or, muted, the cross `M12 5.5l4 5M16 5.5l-4 5` |
| Full screen | `<button>` labelled `Full screen` | 28 × 28, radius 6, transparent; a 16 × 16 icon (`viewBox="0 0 16 16"`, `fill="none"`, `stroke` white, `stroke-width="1.6"`): `M2 6V2h4M10 2h4v4M14 10v4h-4M6 14H2v-4` |

The strip is a `role="group"` named `Video controls`.

- **Fit.** The buttons never shrink (28 px each). The seek track takes the remaining width but at least 24 px.
  The Time text takes what is left after the buttons, gaps, padding and that minimum; when it does not fit it is
  cut with an ellipsis (`…`, one line, no wrap). This holds for hour-format times (`1:02:05 / 1:30:00`) and for
  the loading text. At a box of exactly 240 px (strip 224 px) the wide form shows; the time gets 60 px.
- **Narrow form**: when the on-screen box is narrower than **240 px**, only Play / Pause and Time are shown; at
  the 120 px minimum strip the Time has 66 px and is cut with an ellipsis when longer.
- **Seek**: dragging or clicking moves the current time; the keys ←/↓ go back 5 seconds, →/↑ forward 5 seconds,
  Home to 0:00 and End to the end, each clamped. Seeking keeps the play state (an ended video becomes paused at
  the new time). Before the element has data for the video (no metadata yet), Seek is `disabled` and shows the
  kept time; its look is unchanged.
- **Mute / Unmute** sets the sound for every video for the rest of the tab's life; videos start with sound.
- **Full screen** is `disabled` until the element has data, including while loading (the shared disabled look,
  `opacity: .45`; this contract, not the approved loading picture's bright glyph, decides), and absent where the
  element has no `requestFullscreen`.
- On a local board whose video record is unavailable (storage v4), Play is `disabled` and nothing else changes.
- The strip takes pointer events: a press on it never selects, moves or deselects anything on the canvas. Plain
  keys pressed inside it (arrows, Home, End, Page Up, Page Down, Space, Enter, Delete, Backspace) act only on the
  focused control and never reach the canvas or page keys; Escape moves focus back to the canvas and does nothing
  else. On a hosted board the comments layer's window-level Escape handling ignores a key whose target is inside
  the strip, so it cannot close a comment card, cancel a composer or leave Comment mode first. Tab reaches its controls after the canvas.

**Hover, focus and pressed looks.** No strip control uses `aria-pressed`, so the shared purple pressed look
never applies; every control overrides the shared button's 40 px minimum size, white background, border and
hover colour.

| Control | Hover | Pressed (`:active`, held while hovered) | Focus (`:focus-visible`) | Disabled |
| --- | --- | --- | --- | --- |
| Play / Pause | background `#ffffff40` | background `#ffffff59` | 2 px solid white outline, offset 1 px | shared `opacity: .45` |
| Sound, Full screen | background `#ffffff26` | background `#ffffff40` | as Play | as Play |
| Seek | the knob gains a 4 px `#ffffff33` ring | the ring becomes `#ffffff4d` | 2 px solid white outline, offset 2 px | unchanged look, no ring |

**Two looks that differ from the approved pictures.** The badge's 6 px inset from the top-right corner, and Full
screen at the shared disabled look while loading, are this contract's values; the approved pictures placed the
badge from an assumed width (nearer the edge) and drew a bright Full screen glyph while loading. Both values here
are approved and final.

## Loading (hosted boards)

On a hosted board the video's bytes are downloaded only when someone presses Play (or its play button) on a
video the tab does not hold: `GET /boards/<board>/assets/<video hash>` with the sign-in, the whole file, through
the single-attempt `downloadVideo` of hosted storage v14 (600 s a try).

**A download belongs to the opening.** At most one download runs per video hash per opening; a press on a video
whose download is running joins it. It makes up to **three tries** (waits of **1,000 ms** then **2,000 ms**
between them) and runs to its end even if the video stops being the target or is reselected: a success is
**cached** in the tab's videos whatever the selection is then. It is **cancelled** (its request aborted and its
wait timers cleared, its answer ignored) only when its opening ends, the page hides, or the board view unmounts.

**A try succeeds** when `downloadVideo` answers `ok` and the blob passes, in order: its size is above 0, at most
**52,428,800** and equal to the answer's length (the transport checks `Content-Length`); its bytes, classified
picture signature first, have a video header; that header's type equals the blob's type; and their SHA-256
equals the hash. Only then is the record cached (storage v4: the first stored value wins, with the video
object's `durationMs`). Anything else, `refused` or `network` is a failed try.

**What the person sees** belongs to the press. While the download runs and its video is the target, the strip's
Time reads `Loading video… <p>%` (white), with `p = floor(100 × loaded ÷ total)` from the latest progress call
`(loaded, total)`, 0 before the first call or while `total` is 0, and never above 99 until the bytes are
verified; the Seek control is replaced by the 4 px track with the white fill to `p` and no knob; Play / Pause
shows Play and a further press changes nothing; Full screen is `disabled`. When the download succeeds and the
press that started or last joined it is still current (same opening, the video has stayed the target since the
press, no other press), the source is attached and it plays at once (if the browser refuses that start,
**Playing** says what happens: Play shows, no notice). Otherwise the bytes stay cached and the strip shows
paused; the next press plays at once. When all three tries fail, the strip returns to paused at its kept time
and **Errors** gives the notice.

**Attaching the source** (both kinds of board, each time the video becomes the target or its download
completes for the current press), in this order: the Mute choice is applied; the opening's `blob:` URL for the
hash (made once per hash per opening) is set as the source; when the element's metadata arrives, the kept time
is restored (the end when it had ended); only then is Seek enabled and a pending press's playback started. A
step whose press, target or opening is no longer current does nothing. Local boards read the tab's videos at
once and never show loading.

## Errors

- `This video can't play in this browser.` — when the element fires `error`, or `play()` is rejected with
  anything but `NotAllowedError` or `AbortError`: the video pauses, the element hides (its first frame shows) and
  the notice shows **once per video hash per tab**. A later press tries again without a second notice.
- `Could not load <name>. Press play to try again.` (the video's name, e.g. `Could not load demo.mp4. Press play
  to try again.`) — **once per press whose three tries all fail**: when a download's third try fails, once, for
  the press that started it or last joined it, while its opening is current. A later press starts a new
  download with three new tries.
- Both show for owners, editors and viewers; a viewer's under her read-only line. A notice from an opening that
  has ended is never shown.

## The context bar

For a selection of media only: one image `Image`, several images `n images` (unchanged); one video `Video`,
several videos `n videos`; images and videos together (and nothing else) `n items`. **Description** follows the
label only when one object is selected (one image or one video), with v24's panel, draft and commit rules. Then,
as today, Arrange, Move to page, Duplicate and Delete. A selection holding a video and any object that is not an
image or a video uses today's mixed-selection bar unchanged (`n objects`, v24 **Mixed selections**). Objects shows
Description for one selected video as for one image. v24's **Mixed selections**, **Resizing** (proportional,
1-unit floor) and **Connectors and images** rules apply to videos as to images. A viewer's bar is today's, with
its editing buttons disabled.

## Copy, Cut, Paste, Duplicate, Undo and history

Videos are copied as images are (v24, v49): a copy keeps `asset`, `poster`, pixel size, `durationMs`, `name`,
description and size, with a fresh id and generation; no bytes are copied or uploaded. Object Paste: if any
copied video's first frame is not in the tab's pictures, or, on a local board, its video is not in the tab's
videos, nothing is pasted and the notice reads v49's `Could not paste the image: it has not loaded yet.`. A
Paste after which the board's picture bytes would be above 52,428,800 is refused with v24's notice. On a **local**
board, a Paste after which its video bytes would be above 104,857,600 is refused, changes nothing, and the notice
reads `Could not paste: the videos would exceed the 100 MiB board limit.`. On a **hosted** board Paste makes no
video-budget check (the clipboard holds only this board's objects, so a paste adds no new video hash and
uploads nothing). Undo, Redo, history previews and restore treat videos as images; a history preview plays like
the live board.

## Export, Save a copy and board files

- **Export** to PNG, JPG and PDF (v48) draws each video's first frame, with no badge, play button, strip or
  playing frame; it waits for first frames as it waits for pictures. CSV export (of a table) is unchanged.
- **Save a copy to file** writes board file v5 with each video's bytes and first frame. It walks the board's
  objects **in order** and, for each object, its assets in the order picture (an image's `asset`, a video's
  `poster`) then video (a video's `asset`). For each asset, as one step: if the tab does not hold it, it is
  obtained (local board: read from storage; hosted board: fetched **once**, a picture or first frame with v49's
  picture `GET`, 60 s, a video with `downloadVideo`, 600 s, no retry, no progress shown); then it is validated
  (a picture: SHA-256 equals the hash and it decodes to the object's pixel size; a video's first frame also has
  `mime` `image/jpeg`; a video: `ok`, the length, header, type and hash checks of **Loading**). The **first
  failing step in that walk**, whether it failed to obtain or to validate, decides the reason: `a picture is
  unavailable` for a picture or first frame, `a video is unavailable` for a video; nothing after it is fetched,
  no file is saved, and the notice reads `Could not save a copy to file: <reason>.` (for example `Could not save
  a copy to file: a video is unavailable.`). Only when every step passes do board file v5's writing checks run
  (budgets, then size). While it runs, Save a copy holds the Board panel's existing busy state (the one Open
  board file… uses: Save a copy to file, Open board file… and Reopen are `disabled` until it ends). It belongs to
  its opening: if a new opening begins (including a hosted full reload), the page hides or the board view
  unmounts meanwhile, its fetches are abandoned and it ends with no file and no notice. Assets it fetched and
  validated stay in the tab's pictures and videos. Writing reasons are board file v5's, in v20's notice `Could
  not save a copy to file: <reason>.` (new: `a video is unavailable`, `videos exceed the 100 MiB board limit`,
  `it is larger than 216 MiB`).
- **Open board file…** uses board file v5's reasons (new: `it is larger than 216 MiB`, `its videos exceed the
  100 MiB board limit`); a version 3 file's first frames are decoded before any question; its videos are never
  played to open it; the new single-user board is created with its videos (storage v4). Into a team workspace a
  file or template holding a picture or video stays refused: `it holds pictures or videos, which team boards
  can't hold yet`.

## Page policy

The page's Content Security Policy (`apps/web/index.html`) gains `media-src 'self' blob:` so the player can use
`blob:` URLs; nothing else in it changes. Its content becomes `default-src 'self'; connect-src 'none'; style-src
'self' 'unsafe-inline'; img-src 'self' data:; media-src 'self' blob:; object-src 'none'; base-uri 'none'` (the
team build still replaces `connect-src 'none'` as today).

## Keys

No new key. ⌘⇧K / Ctrl+Shift+K opens the Media picker. The strip's controls take the keys above while focused.

## Accessibility

Strip controls are real buttons and a slider with the labels above, reachable by Tab, with visible focus. The
`<video>` element, badge and play button are `aria-hidden`; each video keeps its `role="img"` name. Notices are
the existing `.notice` element (`role="status"`).

## Not in this version

Link previews; a board file or template with pictures or videos brought into a team workspace; shared ("watch
together") playback; playing before the whole file is downloaded (streaming or range requests); videos from
other sites; looping, playback speed, volume levels or captions; a keyboard shortcut to play; a success notice on
hosted boards; queuing uploads while offline.
