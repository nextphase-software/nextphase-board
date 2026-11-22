# 0001 — Web app modules

Note version: 47 (for 0012-W3 brief v1, 2026-11-22). Status: Draft.
Replaces [web modules v46](0001-web-modules-v46.md), whose registry, import, composition, one-state-owner,
team guards, counts and seams remain word for word except as below.
[Interaction v49](0001-interaction-v49.md) adds pictures on hosted boards and GIF playback with exactly four new
source modules (one rules module, one team module, one state hook, one scene part).

| Module | Responsibility |
| --- | --- |
| `apps/web/src/gif.ts` | Pure GIF reading, no React, DOM globals or Konva; imports nothing. **Grammar** (GIF89a, also accepting GIF87a): the 6-byte header `GIF87a` or `GIF89a`; the 7-byte logical screen descriptor (width, height, flags, background index, aspect); the global colour table if its flag is set (3 × 2^(n+1) bytes); then blocks until the trailer `3B`: an extension `21 <label>` followed by data sub-blocks (each a length byte then that many bytes, ended by a `00` length) — label `F9` the Graphic Control Extension (its first sub-block is 4 bytes: packed flags with disposal in bits 2–4 and the transparency flag in bit 0, delay as u16le, transparency index), label `01` Plain Text, any other label skipped; or an image `2C` (the 9-byte descriptor: left, top, width, height as u16le, flags with local table, interlace and table size), its local colour table if flagged, the LZW minimum code size byte (2–8), then its data sub-blocks. A Graphic Control Extension applies to the next image or Plain Text block only and is then discarded; a Plain Text block draws nothing, makes no frame and consumes it. **`gifInfo(bytes)`** walks the blocks without decoding and returns `{ width, height, frames, area }` (the logical screen size, the number of images whose descriptor and minimum code size byte are present, and the sum of those images' descriptor width × height) or `null` when the header or screen descriptor is missing or malformed. **`decodeGif(bytes, limit)`** first throws `Error("gif_too_large")`, before decoding, when `frames × width × height` or `area` exceeds `limit` (so a huge rectangle clipped to a small screen cannot make unbounded work); it throws `Error("gif_invalid")` when `gifInfo` is `null`, no image has any colour table, a minimum code size is outside 2–8, or the first image yields no pixel. Otherwise it returns `{ width, height, frames: { rgba, delay }[] }`, each frame the full logical screen as RGBA (`Uint8ClampedArray`, width × height × 4): the screen starts fully transparent; for each image, in order, its pixels are drawn over the screen as it stands (a pixel equal to the active transparency index is not drawn), its rectangle clipped to the screen, rows in interlaced order when flagged (passes starting at rows 0, 4, 2, 1 with steps 8, 8, 4, 2); the frame is a copy of the screen after drawing; then its disposal applies before the next image (0, 1 and 4–7 leave the screen; 2 clears the image's rectangle to transparent; 3 restores the screen as it was before this image). LZW: clear code `2^min`, end code `clear + 1`, codes from `min + 1` bits growing to at most 12; when the table is full, codes keep their width until a clear code. A pixel whose colour index is not in the active table is not drawn (left as the screen stood). **Early end**: when the bytes end (also inside an extension's sub-blocks), an end code or a short sub-block comes, or a code larger than the next table entry is read, before an image's pixels are all decoded, or when an image after the first has no colour table, the pixels decoded so far are drawn, the rest of its rectangle is left as the screen stood, that frame is the last, and decoding stops; bytes ending between blocks end decoding after the last complete frame. Delay: the Graphic Control Extension's value × 10 ms, a value below 2 counting as 100 ms (interaction v49); an image without one has 100 ms |
| `apps/web/src/team/pictures.ts` | The hosted picture transport, used through `HostedBoard`'s new `pictures` field. Class `BoardPictures` with `constructor(board: () => string)`; `upload(hash, bytes: ArrayBuffer)` → `Promise<{ ok: true } \| { ok: false; kind: "offline" \| "too_large" \| "full" \| "refused" }>` (`PUT` with `Content-Type: application/octet-stream`, 120 s timeout; 200 or 201 `ok`; a network error `offline`; 413 `too_large`; 409 whose error reason is `board_pictures_full` `full`; anything else or the timeout `refused`); `download(hash)` → `Promise<ArrayBuffer \| null>` (`GET`, the browser's default cache mode, 60 s timeout; any failure `null`; the caller checks the bytes). The sign-in token and server URL come from `auth.getSession()` and `settings.serverUrl` exactly as `team/api.ts` does; JSON-only `api()` is not used. Imports only `./auth` and `./config` |
| `apps/web/src/state/use-gif-playback.ts` | The GIF playback state owner. Input `{ objects, selected, animated, bitmaps, pressedPlay, setMessage }`. The **candidate** is the one selected object when it is an image in `objects` whose asset is in `animated` and whose bitmap in `bitmaps` has the image's pixel size. With reduced motion (`matchMedia("(prefers-reduced-motion: reduce)").matches`), the hook consumes each new `pressedPlay.sequence` at the first render that sees it (a ref keeps the last consumed one): if the candidate at that render is `pressedPlay.id`, it becomes the **target** until the candidate changes; otherwise the press is discarded. Without reduced motion the candidate is the target. Output `{ playing: { id, bitmap } \| undefined }`: the target's current frame once its frames exist. **One effect**, keyed on the target's id and asset: it decodes with `decodeGif` (limit 16,000,000) from the picture's bytes in `tabPictures`, makes one `ImageBitmap` per frame from its RGBA, then runs a `setTimeout` chain advancing the frame index (state) by each frame's delay, looping; its cleanup marks the run cancelled (a decode finishing after it is dropped and its bitmaps closed), clears the timer and sets the frame to none. The decoded frames of the most recent GIF are kept in a module-level cache of one entry (its bitmaps closed when replaced); the set of pictures that already showed `This GIF is too large to play.` is module-level for the tab. Imports `../gif.ts` and `../image-assets.ts` only, besides React and types |
| `apps/web/src/scene/gif-marks.tsx` | One component, `GifMarks`, with props `{ objects, animated, bitmaps, selected, hovered, pos, zoom }`: for each image in `objects` whose asset is in `animated`, whose bitmap in `bitmaps` has the image's pixel size, and which is not selected, a `div.gif-badge` holding `GIF` when its on-screen box is at least 40 × 28, and, when its id is `hovered`, a `div.gif-play` when its box is at least 56 × 56; both `aria-hidden="true"`, absolutely positioned in screen coordinates from `pos` and `zoom` as the existing overlays are. No state, no hooks |
| `tests/gif.test.mjs`, `tests/team-pictures.test.mjs`, `tests/room-pictures.test.mjs` | The unit test files named in the brief |

**Counts.** From v46: **27 state hooks** (`use-gif-playback.ts` added), **20 scene parts** (`gif-marks.tsx`
added), **56 team modules** (`team/pictures.ts` added); 34 screen parts and every other count unchanged (rules
package 16 files, object modules, the board-sync list). Effect counts: `use-gif-playback.ts` **one** effect; every
existing hook's count unchanged (`use-canvas-input.ts` 2, `use-hosted-board.ts` 1, `use-images.ts` keeps its
three). `gif.ts` is a web `.ts` file, so the type-name guard applies to it. The module-list tests in
`tests/modules.test.mjs` name the new files in sorted order and say "through 0012-W3 v1" in their titles; the team
module list adds `pictures.ts`.

**Web paths.**
- `state/use-images.ts`: new optional input `hosted?: HostedBoard` (`import type` from `../team/hosted-board`;
  absent, everything is as today). On a hosted board: interaction v49's import (the `Adding…` notice; upload through
  `hosted.pictures.upload` instead of `storePicture`; the hosted reasons; the stopping, disconnect and adding rules,
  checked through `hosted.snapshot.connected`, `hosted.snapshot.role`, `hosted.history` and the board id rather than
  the `readOnly`-based `stillOpen()`; no success notice). The loader (interaction v49 **Seeing pictures**) runs inside
  the existing `ensureDecoded`, started by the same effect: one loader per opening (keyed by the hosted board
  instance and board id) holding its queue, its four slots, each hash's tries and retry timers (`setTimeout`), and an
  "ended" flag that makes later answers and timers do nothing; a new opening ends the old one. New outputs:
  `loading: ReadonlySet<string>` (hashes queued, requested or waiting to retry in the current opening), `animated:
  ReadonlySet<string>` (hashes whose picture is a GIF that `gifInfo` gives two or more frames and a screen size equal
  to the picture's pixel size, worked out when the picture is decoded, on local and hosted boards) and `pasted` (the
  existing function, now returned). No new effect.
- `images.ts`: the hosted reason texts, the `Adding <names>…` text (built with the same name rule as
  `refusalNotice`) and `Could not paste the image: it has not loaded yet.`; local texts unchanged.
- `state/use-editing-commands.ts`: in `clipboardCommand("Paste")` only, before `buildPaste`: when any copied image's
  asset is not in `tabPictures`, set that notice and return. Nothing else changes (Paste stays synchronous; no new
  input).
- `state/use-hosted-board.ts`: new optional input `pasteFiles?: (files: File[]) => void`. Its paste handler calls it
  with the event's files when it carries any and it is given; otherwise it behaves as today (files dropped, `paste()`
  without files).
- `state/use-canvas-input.ts`: new optional inputs `animated` (default empty) and `bitmaps` (default empty), giving the same "drawn, animated, unselected" test `GifMarks` uses; new outputs `hovered: string`
  (interaction v49's hover: the topmost object by the existing hit test under the pointer on `pointerMove` with
  `buttons === 0`, the Select tool and no gesture, text session or inline editor; `""` otherwise, and reset to `""`
  when the tool, board, page or view changes), `pressedPlay: { id: string; sequence: number }` (on a plain primary
  `pointerDown` (no Shift, Meta, Ctrl or Alt, no Space pan, the voting mode off) with the Select tool within 20 CSS
  px of the on-screen centre of the `hovered` image when it is drawn, unselected, its asset is in `animated` and its
  on-screen box is at least 56 × 56: `id` is that image and `sequence` grows by one; otherwise unchanged) and `pointerLeave` (sets `hovered` to `""`). None of this is placed
  between `  function sceneKeyDown(` and `  function pointerDown(`. Its effect count stays 2.
- `scene/board-drawing.tsx`: two new optional props, `loading?: ReadonlySet<string>` and `playing?: { id: string;
  bitmap: ImageBitmap }`, passed to `ImageBody` as `loading={loading?.has(o.asset)}` and, for the playing id, the
  frame instead of the still bitmap. Export passes neither (frame 1, no loading box).
- `scene/image-body.tsx`: new optional prop `loading`; when the bitmap is not drawn and `loading` is true, the
  loading box (interaction v49) instead of the missing-picture box. Nothing else changes.
- `ui/notice.tsx`: new optional prop `importing`; when it and `hosted` are true, the notice shows only
  `visibleMessage` (not the busy line, the armed-tool line, the invalid-field lines or the Go to button). Nothing else
  changes.
- `ui/palette.tsx`: the Image button's condition becomes `!team?.hosted || team.hosted.snapshot.role !== "viewer"`.
- `team/hosted-board.ts`: one new field, `pictures = new BoardPictures(() => this.boardId)`, and its import.
- `apps/web/style.css`: `.gif-badge` and `.gif-play` (with its `::after` triangle) at interaction v49's values,
  `position: absolute`, no `z-index` (their place in the scene, before the overlays, keeps them under the
  handles), `pointer-events: none`; no change to existing rules.

Each may change only as far as its contract needs.

**App.tsx** remains composition-only, **264 lines, no added line**. Exactly these substitutions on existing
lines of ea0e2d4, each passing values App already has (every name is declared on an earlier line or, for `gif`,
`hovered`, `pressedPlay` and `pointerLeave`, on line 101 or 125, before their use on lines 125, 170, 173, 175 and 198):

| ea0e2d4 line | Before (exact, once in the file) | After |
| --- | --- | --- |
| 2 | `import { ImageNames } from "./scene/image-body";` | `import { ImageNames } from "./scene/image-body"; import { useGifPlayback } from "./state/use-gif-playback"; import { GifMarks } from "./scene/gif-marks";` |
| 62 | `readOnly: readOnly \|\| !!team?.hosted,` | `readOnly, hosted: team?.hosted,` |
| 101 | `pointerMove, pointerUp, doubleClick,` | `pointerMove, pointerUp, doubleClick, hovered, pressedPlay, pointerLeave,` |
| 108 | `textEditing: !!textSession.current, invalidObjectText,` | `textEditing: !!textSession.current, invalidObjectText, animated: images.animated, bitmaps: images.bitmaps,` |
| 125 | `  const exporter = useExport({` | `  const gif = useGifPlayback({ objects: displayedObjects, selected, animated: images.animated, bitmaps: images.bitmaps, pressedPlay, setMessage }); const exporter = useExport({` |
| 136 | `paste: () => clipboardCommand("Paste"), composing });` | `paste: () => clipboardCommand("Paste"), pasteFiles: (files) => void images.pasted(files, () => clipboardCommand("Paste")), composing });` |
| 170 | `onLostPointerCapture={lostPointerCapture}` | `onLostPointerCapture={lostPointerCapture} onPointerLeave={pointerLeave}` |
| 173 | `bitmaps={images.bitmaps} connection` | `bitmaps={images.bitmaps} loading={images.loading} playing={gif.playing} connection` |
| 175 | `        <Overlays` | `        <GifMarks objects={displayedObjects} animated={images.animated} bitmaps={images.bitmaps} selected={selected} hovered={hovered} pos={pos} zoom={view.z} /><Overlays` |
| 198 | `busy={busy} tool={tool} readOnly={readOnly} snapshots={snapshots} reopen={reopen}` | `busy={busy} tool={tool} readOnly={readOnly} snapshots={snapshots} reopen={reopen} importing={images.importing}` |

The "0012-W2 App composition" test in `tests/modules.test.mjs` is renamed "0012-W3 App composition": it keeps
every earlier substitution and adds these ten after them, and still checks the same line count. The
implementation record lists every substitution with its before and after text.

No dependency, font file, image file, service, service migration or import exception. No stored value in the
browser, room message, presence key or Undo step is added by the web app; the only new requests are the two
picture routes of [API v13](0003-api-v13.md).
