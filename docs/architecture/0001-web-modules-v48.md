# 0001 — Web app modules

Note version: 48 (for 0012-W4 brief v1, 2026-11-24). Status: Draft.
Replaces [web modules v47](0001-web-modules-v47.md), whose registry, import, composition, one-state-owner, team
guards, counts and seams remain word for word except as below.
[Interaction v50](0001-interaction-v50.md) adds videos on local and hosted boards with exactly **three new web
source modules** (one rules module, one state hook, one scene part) and one new object-type module in the rules
package ([document v21](0001-document-v21.md)). The badge and hover play button extend the existing
`scene/gif-marks.tsx` rather than a new `video-marks.tsx`: `GifMarks` already owns the badge and play-button
geometry, the 40 × 28 and 56 × 56 thresholds and the `pos`/`zoom` placement, and App already passes it every
input a video's marks need (`objects`, `bitmaps`, `selected`, `hovered`), so extending it adds no mount, no prop
and no App change, where a second module would copy that geometry.

## New modules

| Module | Responsibility |
| --- | --- |
| `apps/web/src/video.ts` | Video rules and preparation; no React or Konva. Imports `./image-assets.ts`, `./images.ts` (`landingSize`, `decodePicture`, `IMAGE_REASONS`, `VIDEO_REASONS`), `nextphase-board-rules/objects/registry.ts` and types; `images.ts` imports only types from it, so there is no import cycle. Exports: `POSTER_SIDE = 1920`; `PREPARE_TIMEOUT = 15000`; `VIDEO_CANNOT_PLAY = "This video can't play in this browser."`; `loadFailedNotice(name: string): string` (`Could not load <name>. Press play to try again.`); `videoName(fileName: string): string` (interaction v50's name rule: control characters and lone surrogates removed, first 255 code points, `Clipboard video` when empty); `type PreparedVideo = { hash: string; video: VideoRecord; posterHash: string; poster: Picture; name: string; width: number; height: number }` (`width`/`height` the landing size); `posterPixels(width: number, height: number): { pixelWidth: number; pixelHeight: number }`; `prepareVideo(file: { name: string }, bytes: ArrayBuffer, mime: VideoMime): Promise<PreparedVideo>` (interaction v50 **Preparing a video** steps 2–6 on bytes the caller has already read and routed; never calls `arrayBuffer` or `slice`; throws `Error(VIDEO_REASONS.play)`, the caller mapping it to the hosted text; the canvas is an `OffscreenCanvas` encoded with `convertToBlob({ type: "image/jpeg", quality: .90 })`, checked with `signature` (must be `image/jpeg`) and `decodePicture`; the element's `src` is removed and its URL revoked in a `finally`); `isVideoKind(kind)` and `isPictureKind(kind)` are re-exported from `./image-assets.ts` for callers; `videoFrame(o: ItemV12, bitmaps: ReadonlyMap<string, ImageBitmap>, pictures = tabPictures): ImageBitmap \| undefined` (a video's drawn first frame: the `poster` bitmap when it has the video's pixel size and `pictures.get(poster)?.mime === "image/jpeg"`, else `undefined`); `clockText(ms: number): string` (`m:ss` / `h:mm:ss` of `floor(ms ÷ 1000)` seconds); `lengthText(durationMs: number): string` (`clockText(max(1, round(durationMs ÷ 1000)) × 1000)`); `currentText(ms: number, durationMs: number): string` (`clockText` of `ms`, never above the length); `hasPlayMark(o: ItemV12, animated: ReadonlySet<string>, bitmaps: ReadonlyMap<string, ImageBitmap>): boolean` (an image whose asset is in `animated` and whose bitmap has its pixel size, or a video with a `videoFrame`); `mediaLabel(images: number, videos: number): string` (`Image`, `n images`, `Video`, `n videos`, `n items`); `addedNotice(images: number, videos: number): string` (`Added 1 image.` … `Added n items.`); and the type `VideoPlayerState` (below), shared by the hook and the scene part |
| `apps/web/src/state/use-video-playback.ts` | The playback state owner. `useVideoPlayback(input: { opening: unknown; boardId: string; objects: readonly ItemV12[]; selected: ReadonlySet<string>; bitmaps: ReadonlyMap<string, ImageBitmap>; pressedPlay?: { id: string; sequence: number }; hosted?: HostedBoard; hidden: boolean; setMessage: (text: string) => void }): { player: VideoPlayerState \| undefined }`. **`opening`** is any value that changes on every opening (interaction v50 **An opening**); App passes `adapter.current`, the shared-document adapter instance that `useBoardDocument`'s `load()` replaces on every local open, Reopen, board-file open and hosted full reload (the same board id and hosted instance can survive a Reopen, so neither is used as the identity). The **target** is computed at each render with `videoFrame`. **All element control lives here**: a `useRef<HTMLVideoElement \| null>` filled by a stable callback ref handed to the scene part; the source is set imperatively (`element.src = url`), never as a prop; `play()`, `pause()`, `currentTime`, `muted`, `requestFullscreen()`, `document.exitFullscreen()` and the `fullscreenchange` listener (added on Full screen, removed on leaving: sets and clears `controls`) are called only here. **Tokens**: a ref holds the current `{ opening, target id, asset, press }` (press a counter raised by every Play); every asynchronous continuation (the `loadedmetadata` time restore, a download's completion, a `play()` promise, a deferred seek) captures the token when it starts and does nothing unless it is still current. **Module-level for the tab**: kept times `Map<string, number>` keyed `<boardId>/<objectId>`; the set of video hashes that showed `VIDEO_CANNOT_PLAY`; the Mute choice (starts `false`). **Per opening (refs)**: `blob:` URLs by hash; running downloads by hash (one per hash; a later press joins it and becomes the press it serves). **Press latch**: a ref keeps the last consumed `pressedPlay.sequence`; at the first render that sees a new one, if its id is the target's, a pending press is recorded; effect 1 consumes it. **Effect 1**, keyed on `opening` and the target's id and asset: on start, applies the Mute choice, on a local board sets the source from `tabVideos` (URL made once per hash per opening), restores the kept time on `loadedmetadata` (token-checked), and plays if a press is pending; its cleanup raises the token, pauses the element, leaves full screen if the element is the full-screen element, records its `currentTime` (the length when ended) as the kept time and resets the target's status, so a quick deselect and reselect always shows the strip paused. **Effect 2**, keyed on `opening`: adds a `pagehide` listener; its cleanup (and `pagehide`) revokes every URL of the opening and clears the URL and download maps (answers of ended downloads are dropped by the token). **Downloads are opening-scoped** (interaction v50 **Loading**): a ref map holds, per hash, one running download `{ controller: AbortController; timers: Set<timeout>; press: number }`; a press on a hash already downloading joins it (sets `press`). It calls the single-attempt `hosted.pictures.downloadVideo(hash, progress, controller.signal)` up to three times (waits 1,000 ms and 2,000 ms; each try also abandoned after 600 s), and runs to its end whatever the selection: a try counts only when it answers `ok` and the blob passes, in order, size in 1..52,428,800, `assetKind` of its bytes `isVideoKind` with a `mime` equal to `blob.type`, and `pictureHash` equal to the hash; then `holdVideo` caches it (first stored value wins, the object's `durationMs`). Effect 2's cleanup, `pagehide` and unmount call `controller.abort()` and clear every timer of every running download. **Press-scoped**: the `Loading video… p%` percentage (`p = min(99, floor(100 × loaded ÷ total))`, 0 while `total` is 0), the autoplay after success (only when the token captured at the press is still current), and the load-failed notice (`loadFailedNotice(target.name)`, once when the third try fails, for the press that started or last joined it, while the opening is current). **Attaching the source** follows interaction v50's order (Mute, URL, kept time on `loadedmetadata`, then Seek enabled and the pending play), each step token-checked. A `play()` rejected with `NotAllowedError` or `AbortError` leaves it paused with no notice (also right after a download); any other rejection or the element's `error` event shows `VIDEO_CANNOT_PLAY` once per hash per tab. **Full screen**: `fullScreen()` calls `requestFullscreen()`; the `fullscreenchange` listener sets the `fullScreen` state (the scene part then drops `aria-hidden` and sets `controls`), focuses the element on entry, and on exit focuses the strip's Full screen button (found from the element's parent) or, when the video is no longer the target, the canvas; effect 1's cleanup calls `document.exitFullscreen()` when the element is the full-screen element. `hidden` is passed through to the scene part (`player.hidden`); it never pauses. Imports `../video.ts`, `../image-assets.ts`, `nextphase-board-rules/objects/registry.ts`, `import type` from `../team/hosted-board`, React; no other hook |
| `apps/web/src/scene/video-player.tsx` | One component, `VideoPlayer`, props `{ player?: VideoPlayerState; pos: (point: { x: number; y: number }) => { left: number; top: number }; zoom: number }`; renders nothing without `player`. No state, refs or `use*()` call: it renders `div.video-player` (class `concealed` when `player.hidden`) at `pos(player.box)` with width and height times `zoom`, holding `<video ref={player.ref} playsInline preload="auto">` (`aria-hidden="true"` and no `controls` inline; when `player.fullScreen`, no `aria-hidden` and `controls`; class `shown` when `player.shown`; `muted={player.muted}`; the media event props `onLoadedMetadata`, `onLoadedData`, `onTimeUpdate`, `onPlaying`, `onPause`, `onEnded`, `onError` from `player`) and `div.video-strip` (`role="group"`, `aria-label="Video controls"`; class `narrow` under 240 px of on-screen width; width `max(120, w − 16)` and left `(w − width) ÷ 2`): `button.video-play` (`Play`/`Pause`), `span.video-time` (`currentText` and `span.video-total` with ` / ` and `lengthText`, or `Loading video… p%`), then, unless narrow, `span.video-seek-box` (style `--fill: <percent>%`) holding `span.video-track`, `span.video-fill` (width `--fill`) and, unless loading, `input.video-seek` (type `range`, `aria-label="Seek"`, `min` 0, `max` `durationMs`, `step` 1, `aria-valuetext`, `disabled` until `player.hasData`), then `button.video-button` (`Mute`/`Unmute`) and, when `player.canFullScreen`, `button.video-button` (`Full screen`, `disabled` until `player.hasData`). The strip stops `pointerdown` propagation; its `keydown` stops propagation of unmodified Arrow, Home, End, PageUp, PageDown, Space, Enter, Delete and Backspace keys (the seek input's arrows, Home and End call `player.seekKey(key)` and prevent the default when it returns `true`), and on Escape focuses `event.currentTarget.closest(".scene")` and stops propagation. Icons are interaction v50's inline SVGs (paths, view boxes and 1.6 px strokes as listed there) |

`VideoPlayerState` (exported type in `video.ts`): `{ id: string; box: { x: number; y: number; width: number;
height: number }; state: "paused" | "playing" | "ended" | "loading" | "unavailable"; timeMs: number; durationMs:
number; percent: number; shown: boolean; hidden: boolean; fullScreen: boolean; muted: boolean; hasData: boolean; canFullScreen:
boolean; ref: (element: HTMLVideoElement | null) => void; onLoadedMetadata, onLoadedData, onTimeUpdate,
onPlaying, onPause, onEnded, onError: () => void; play: () => void; pause: () => void; seek: (ms: number) =>
void; seekKey: (key: string) => boolean; toggleMute: () => void; fullScreen: () => void }`. `percent` is the
playback position (or, while `loading`, the download share) in 0–100; `unavailable` is a local board whose video
is not in `tabVideos` (Play `disabled`).

**Rules package.** `packages/board-rules/src/objects/video.ts` and the registry and `document.ts` changes are
document v21's.

## Changed web files

Each may change only as far as its contract needs.

- `image-assets.ts`: new `VIDEO_FILE_LIMIT = 52428800`, `VIDEO_LIMIT = 104857600`, `type VideoMime =
  "video/mp4" | "video/quicktime" | "video/webm"`, `type VideoRecord = { bytes: ArrayBuffer; mime: VideoMime;
  durationMs: number }`, `type Videos = Map<string, VideoRecord>`, `tabVideos: Videos` (tab lifetime),
  `videoHeader(bytes: ArrayBuffer): VideoMime | null` (storage v4's header; reads at most the first 64 bytes),
  `routingSignature(bytes: ArrayBuffer): Picture["mime"] | null` (exactly API v14's `pictureSignature` conditions:
  PNG with `IHDR` at bytes 12–15, GIF with at least 10 bytes, JPEG, WebP; used only to route, never to validate),
  `assetKind(bytes: ArrayBuffer): { picture: Picture["mime"] } | { video: VideoMime } | null` (**routing signature
  first**, then the header: the one classifier every web caller uses) with the predicates `isPictureKind(kind):
  kind is { picture: Picture["mime"] }` and `isVideoKind(kind): kind is { video: VideoMime }` (implemented with
  the `in` operator, so no caller compares a kind to a string literal),
  `holdVideo(hash, record, videos = tabVideos)` (sets only when absent), `validVideoRecord(key: unknown, value:
  unknown): Promise<boolean>` (classified with `assetKind`), `boardVideos(board): Set<string>`, `videoBytes(board,
  videos = tabVideos): number`, `readVideos(db, hashes, videos = tabVideos)` (as `readPictures`, its own readonly
  transaction, filling through `holdVideo`), and `storeVideo(db, hash, video, posterHash, poster, transactions)`
  (one strict transaction that writes each of the two records only when `getKey` finds its key absent).
  `boardPictures` becomes the distinct `pictureOf(o)` of every object (images' assets and videos' posters).
  `writePictures(store, board, pictures, videos = tabVideos)` writes missing picture and video records;
  `removeUnusedPictures` adds every string `poster` to the in-use set. `PICTURE_LIMIT`, `Picture`, `signature`
  and `validPicture` unchanged.
- `images.ts`: `IMAGE_ACCEPT` is replaced by `MEDIA_ACCEPT =
  "image/png,image/jpeg,image/gif,image/webp,video/mp4,video/quicktime,video/webm"`; `IMAGE_REASONS.type` becomes
  `not a supported image or video (PNG, JPEG, GIF, WebP, MP4, MOV or WebM)`; new `VIDEO_REASONS = { file: "file is
  larger than 50 MiB", play: "this browser cannot play this video", bytes: "videos would exceed the 100 MiB board
  limit", store: "video could not be stored in this browser" }`; `HOSTED_REASONS` gains `video_too_large: "it is
  larger than 50 MiB"`, `videos_full: "this board already holds 100 MiB of videos"` and `video_play: "this browser
  cannot play it"`; `PreparedVideo` and `VideoMime` are imported with `import type` from `./video.ts` and
  `./image-assets.ts`. `prepareImage(file, bytes?: ArrayBuffer)`: when `bytes` is given it is used instead of
  calling `file.arrayBuffer()`; its order (the 20,971,520 size check first, then signature, then decoding) and
  its reasons are unchanged. `fileNames` takes `readonly { name: string; video?: boolean }[]` and names an
  unnamed file `Clipboard video` when `video` is true and `Clipboard image` otherwise, used by `addingNotice` and
  `refusalNotice`; `addingNotice(files, percent?: number)` appends ` <percent>%` when given. `importReason(board,
  accepted, next, pictures = tabPictures, videos: ReadonlyMap<string, VideoRecord> | null = tabVideos)` takes
  `PreparedImage | PreparedVideo` items, counts first frames as pictures and, unless `videos` is `null`
  (hosted), checks the video budget with `VIDEO_REASONS.bytes`; `addImages(board, items: readonly (PreparedImage |
  PreparedVideo)[], centre, page)` adds an image or a video per item (a video: `asset` its hash, `poster`, the
  first frame's pixel size, `durationMs`, `name`, `description: ""`), one row as today; `describeImage` applies to
  `isMedia` objects.
- `state/use-images.ts`: `importFiles(files, centre, preRead?: ReadonlyMap<File, ArrayBuffer>)` keeps today's
  synchronous start (on a hosted board v49's first `Adding…` notice is set before anything is read, naming
  unnamed files `Clipboard image`, as X7-U08 asserts). Per file, in order (interaction v50 **Paste and drop**):
  over `VIDEO_FILE_LIMIT` it is refused unread, its reason by its declared `File.type` (`image/*` →
  `IMAGE_REASONS.file` / `HOSTED_REASONS.too_large`; else `VIDEO_REASONS.file` / `HOSTED_REASONS.
  video_too_large`); otherwise its bytes come from `preRead` or one `file.arrayBuffer()` (never `slice`), and a
  rejected read refuses it with `IMAGE_REASONS.type`; `assetKind` routes it and sets its `video` flag for the
  notices: `isPictureKind` → `prepareImage(file, bytes)` unchanged; `isVideoKind` → `prepareVideo(file, bytes,
  mime)` and interaction v50's video steps (`importReason`, then `storeVideo` locally, or on a hosted board
  `hosted.pictures.upload` for the first frame and then the single-attempt `hosted.pictures.uploadVideo(hash,
  file, progress)`, mapping `too_large`, `videos_full`, `network` and `refused` to `HOSTED_REASONS.
  video_too_large`, `.videos_full`, `.offline` and `.refused`; each `progress(loaded, total)` call updates the
  batch formula of interaction v50 and sets `addingNotice(files, p)` at most every 250 ms); neither → a declared
  `image/*` file over 20,971,520 bytes gets `IMAGE_REASONS.file` (hosted `HOSTED_REASONS.too_large`), every
  other file `IMAGE_REASONS.type`. The local adding notice is set when the first video is routed. Accepted first
  frames enter `tabPictures`, videos go through `holdVideo`; the end notice uses `addedNotice`. The `importing`
  state becomes `false | "pictures" | "with-videos"`: `"pictures"` from the start, `"with-videos"` once a file is
  routed to the video steps; every existing truthiness test is unchanged. `pasted(files, paste)` decides per
  file as interaction v50 says (a declared `image/`/`video/` type taken unread; over 52,428,800 bytes never read;
  otherwise one `arrayBuffer()` kept in a `Map<File, ArrayBuffer>`) and passes that map to `importFiles`, so no
  file is read twice; a rejected read there counts as not recognised. `chooseImages` uses `MEDIA_ACCEPT` and
  `aria-label` `Choose images or videos`. `ensureDecoded` also calls `readVideos` for `boardVideos(board)` on a
  local board. The description control's `image` is the one selected media object (`isMedia`), and it gains
  `label: string` (`mediaLabel`); `count` counts selected images and videos, `only` stays `count ===
  selected.size` (so a video with a sticky stays in the mixed bar, `n objects`). Its effect count stays **three**.
- `ui/notice.tsx`: the importing-only rule applies when `importing` is truthy and (`hosted` or `importing ===
  "with-videos"`); the prop type becomes `boolean | "pictures" | "with-videos"`. A local picture-only import
  renders exactly as today (X7-U14's local assertion unchanged).
- `state/use-canvas-input.ts`: the hover and press tests use `hasPlayMark(hit, animated, bitmaps)` (unselected,
  as today); hovering is allowed when `animated` is non-empty **or** `displayedObjects` holds a video. A press on
  the play button selects through the existing path (which sends the ordinary selection presence update).
  Outputs unchanged; nothing placed between `  function sceneKeyDown(` and `  function pointerDown(`; effect
  count stays 2.
- `state/use-editing-commands.ts`: in `clipboardCommand("Paste")`, the not-loaded check becomes "any copied
  object whose `pictureOf` is not in `tabPictures`, or, without `hosted`, any copied video whose asset is not in
  `tabVideos`"; `buildPaste` is called with `videos` `null` when `hosted` (no video-budget check on hosted
  boards); the colour and formatting skips at its two `!isImage(o)` tests use `!isMedia(o)`. No effect.
- `clipboard.ts`: `PASTE_VIDEOS_REASON = "Could not paste: the videos would exceed the 100 MiB board limit."`;
  `buildPaste` gains a last parameter `videos: ReadonlyMap<string, VideoRecord> | null = tabVideos` and, unless
  it is `null`, refuses when `videoBytes(next, videos) > VIDEO_LIMIT`.
- `state/use-storage-session.ts`: `openFile` takes the bundle's `videos` (file version 1: `readVideos` into a
  copy of `tabVideos` and the 100 MiB check); the open target carries `videos`; `created.create(board, pictures,
  videos)` and the videos enter the tab through `holdVideo`. `saveCopy` follows interaction v50 **Save a copy**
  exactly: it sets `operation.current` and `setOpening(true)` (cleared in a `finally`); captures the opening
  (`adapter.current`, already an input) and adds a `pagehide` listener for its own duration (removed in the
  `finally`; no new effect); walks `board.objects` in order and, per object, its picture then its video, each as
  one obtain-then-validate step (local: `readPictures`/`readVideos`; hosted: `hosted.pictures.download(hash)` once
  for a picture or first frame, `hosted.pictures.downloadVideo(hash, () => {}, controller.signal)` once for a
  video; validation: `pictureHash`, `decodePicture` to the object's pixel size and, for a first frame, `mime`
  `image/jpeg`; for a video the **Loading** checks); the first failing step throws `a picture is unavailable` or
  `a video is unavailable` and nothing after it runs. Whenever `adapter.current` differs from the captured
  opening, `alive.current` is false or `pagehide` fired, it aborts its fetch and returns with no file and no
  notice. Only after the walk does it call `writeBoardFile`. Effect count stays 2.
- `storage.ts`: `save(b, revision, creating = false, pictures = tabPictures, videos = tabVideos)` and
  `create(b, pictures = tabPictures, videos = tabVideos)` pass `videos` to `writePictures`.
- `board-file.ts`: board file v5: `FILE_LIMIT = 226492416`; `FILE_REASONS[0]` `it is larger than 216 MiB`;
  `writeBoardFile(shown, unchanged?, pictures = tabPictures, videos = tabVideos)` writes file version 3 (a video's
  first frame must be held as `image/jpeg`); `readBoardBundle` returns `{ board, pictures, videos, fileVersion }`,
  reads versions 1–3 and schema ≤ 15, classifies entry bytes with `assetKind` and refuses a non-JPEG first-frame
  entry; `readBoardFile(file, pictures = tabPictures, videos = tabVideos)` adds the version 1 video check.
- `state/use-export.ts`: the pictures-ready test covers `objects.filter(isMedia)`: an image's bitmap as today, a
  video's `videoFrame`.
- `state/use-selection.ts`: `formattingIdeas` leaves out `isMedia` objects.
- `strokes.ts`: the 1-unit width floor applies to `isMedia` objects.
- `sections.ts`: `objectLabel` uses `isMedia` where it uses `isImage` (description text and the ` · ` name part).
- `scene/board-drawing.tsx`: a video draws `ImageBody` with `bitmap={videoFrame(o, bitmaps)}` and
  `loading={loading?.has(o.poster)}` (never the GIF `playing` frame).
- `scene/image-body.tsx`: `ImageBody`'s `object` prop type widens to `Pick<ImageItem, "x" | "y" | "width" |
  "height" | "pixelWidth" | "pixelHeight">`; `ImageNames` covers `isMedia` objects. Drawing unchanged.
- `scene/gif-marks.tsx`: also, for each video with `hasPlayMark`: `div.video-badge` holding `lengthText` (same
  placement and 40 × 28 threshold as the GIF badge; left out only when the video is the one selected object), and
  for the `hovered` unselected video of at least 56 × 56 the existing `div.gif-play`. Props unchanged.
- `ui/image-controls.tsx`: `ImageButton` reads `aria-label="Media"` and the tooltip `Media ⇧⌘K` / `Media
  Ctrl+Shift+K`; `DescriptionControl.image` is `ImageItem | VideoItem | undefined` and gains `label: string`;
  `ImageControls` shows `control.label` in place of its own label. Names of the components unchanged.
- `team/pictures.ts`: hosted storage v14's two single-attempt calls, beside the unchanged `upload` and
  `download`: `uploadVideo(hash: string, file: Blob, progress: (loaded: number, total: number) => void):
  Promise<"ok" | "too_large" | "videos_full" | "refused" | "network">` and `downloadVideo(hash: string, progress:
  (loaded: number, total: number) => void, signal?: AbortSignal): Promise<{ kind: "ok"; blob: Blob } | { kind:
  "refused" | "network" }>`, with that contract's requests, progress and answers, and a 600,000 ms timeout each.
  The optional `signal` aborts the fetch and its reader (an aborted call answers `refused` and reports no more
  progress); hosted storage v14 is to list it. Neither retries; the playback hook owns the three download tries
  and Save a copy makes one.
- `team/import.ts`: refuses `isMedia` objects; `PICTURES_REASON` becomes `it holds pictures or videos, which team
  boards can't hold yet`.
- `team/templates-rules.ts`: refuses `isMedia` objects; `templateBoard` validates at `schemaVersion: 15`.
- `team/voting-rules.ts`: a video's description is its vote text as an image's is (`isMedia`).
- `team/comments/layer.tsx`: in the window-capture `keys` listener, beside the existing `target.closest(...)`
  early returns, the line `      if (target.closest(".video-strip")) return;` (six spaces, double quotes, after the
  `.comment-card,…` guard) before the Escape branch, so Escape and the other
  keys pressed in the video strip are left to the strip. Nothing else changes in it; its effect count is
  unchanged.
- `apps/web/index.html`: the CSP `content` gains `media-src 'self' blob:` after `img-src 'self' data:;` (interaction
  v50 **Page policy**); `scripts/build-web.mjs` unchanged.
- `apps/web/style.css`: the rules below, appended at the end of the file; no existing rule changes.

Unchanged: `App.tsx` beyond the substitutions below, `state/use-gif-playback.ts` (a video hash is never in
`animated`), `state/use-hosted-board.ts` (one effect), `state/use-page-keys.ts`, `ui/palette.tsx`,
`ui/context-bar.tsx`, `team/hosted-board.ts`, `gif.ts`.

## CSS appended to `apps/web/style.css`

Interaction v50's values; `position: absolute` with no `z-index` (their place in the scene, after `GifMarks` and
before `Overlays`, keeps them under the handles); the player wrapper is a `.scene > div` (pointer events none)
and the strip a two-class selector with `pointer-events: auto`. The seek input is 12 px wider than the visible
track (6 px past each end), so the native thumb's centre travels exactly from the track's start to its end;
the white fill is its own element with a rounded leading end (radius 2 at both ends), ending under the knob's
centre, as the approved picture draws it.

```css
.video-badge { position: absolute; pointer-events: none; display: inline-flex; align-items: center; gap: 3px; padding: 3px 5px 3px 4px; border-radius: 4px; background: #1e1c22cc; color: white; font: 700 10px/1 system-ui, sans-serif; letter-spacing: .02em; white-space: nowrap; transform: translateX(-100%); }
.video-badge::before { content: ""; border-style: solid; border-width: 4px 0 4px 6px; border-color: transparent transparent transparent white; }
.video-player { position: absolute; pointer-events: none; }
.video-player.concealed { visibility: hidden; }
.video-player::after { content: ""; position: absolute; inset: -1px; border: 2px solid #518de0; pointer-events: none; }
.video-player > video { display: block; width: 100%; height: 100%; object-fit: fill; visibility: hidden; }
.video-player > video.shown { visibility: visible; }
.video-player > video:fullscreen { visibility: visible; pointer-events: auto; object-fit: contain; background: black; }
.video-player > .video-strip { position: absolute; bottom: 8px; height: 36px; box-sizing: border-box; display: flex; align-items: center; gap: 10px; padding: 0 10px 0 6px; border-radius: 8px; background: #1e1c22cc; color: white; font: 500 12px/1 system-ui, sans-serif; font-variant-numeric: tabular-nums; pointer-events: auto; }
.video-player.concealed > .video-strip { visibility: hidden; }
.video-strip > button { flex: none; display: grid; place-items: center; width: 28px; height: 28px; min-width: 28px; min-height: 28px; padding: 0; border: 0; border-radius: 6px; background: transparent; color: white; }
.video-strip > button.video-play { background: #ffffff26; }
.video-strip > button:hover:not(:disabled):not([aria-disabled=true]) { background: #ffffff26; }
.video-strip > button.video-play:hover:not(:disabled):not([aria-disabled=true]) { background: #ffffff40; }
.video-strip > button:active:not(:disabled):not([aria-disabled=true]) { background: #ffffff40; }
.video-strip > button.video-play:active:not(:disabled):not([aria-disabled=true]) { background: #ffffff59; }
.video-strip > button:focus-visible { outline: 2px solid white; outline-offset: 1px; }
.video-time { flex: 0 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.video-strip.narrow > .video-time { flex: 1 1 auto; }
.video-total { color: #ffffffb3; }
.video-seek-box { position: relative; flex: 1 1 0; min-width: 24px; height: 12px; }
.video-track { position: absolute; left: 0; right: 0; top: 4px; height: 4px; border-radius: 2px; background: #ffffff4d; }
.video-fill { position: absolute; left: 0; top: 4px; width: var(--fill); height: 4px; border-radius: 2px; background: white; }
.video-seek { position: absolute; left: -6px; right: -6px; top: 0; width: calc(100% + 12px); height: 12px; margin: 0; appearance: none; -webkit-appearance: none; background: transparent; cursor: pointer; }
.video-seek:disabled { cursor: default; }
.video-seek::-webkit-slider-runnable-track { height: 12px; background: transparent; }
.video-seek::-moz-range-track { height: 12px; background: transparent; }
.video-seek::-webkit-slider-thumb { -webkit-appearance: none; width: 12px; height: 12px; border: 0; border-radius: 50%; background: white; }
.video-seek::-moz-range-thumb { width: 12px; height: 12px; border: 0; border-radius: 50%; background: white; }
.video-seek:hover:not(:disabled)::-webkit-slider-thumb { box-shadow: 0 0 0 4px #ffffff33; }
.video-seek:hover:not(:disabled)::-moz-range-thumb { box-shadow: 0 0 0 4px #ffffff33; }
.video-seek:active:not(:disabled)::-webkit-slider-thumb { box-shadow: 0 0 0 4px #ffffff4d; }
.video-seek:active:not(:disabled)::-moz-range-thumb { box-shadow: 0 0 0 4px #ffffff4d; }
.video-seek:focus-visible { outline: 2px solid white; outline-offset: 2px; }
```

## Counts and guards

From v47: **28 state hooks** (`use-video-playback.ts` added), **21 scene parts** (`video-player.tsx` added),
**56 team modules** and **34 screen parts** unchanged; the rules package **17 files** and **12 object-type
modules** (`objects/video.ts` added); the board-sync list unchanged. Effect counts: `use-video-playback.ts`
**two** effects; every existing hook's count unchanged (`use-images.ts` 3, `use-canvas-input.ts` 2,
`use-storage-session.ts` 2, `use-hosted-board.ts` 1, `use-gif-playback.ts` 1). `video.ts` is a web `.ts` file,
so the type-name guard applies to it. **Guard choice: a classifier predicate.** The type-name guard gains
`"video"` (its test data at line 236 and both matcher regexes at lines 449–450, unchanged in shape), so no
protected module (App, screen and scene parts, top-level web `.ts` files and state hooks) compares anything to the
literal `"video"`. Asset kinds are therefore tested only through `isPictureKind` / `isVideoKind` (whose `in`
tests name no literal) and object types through the registry (`isVideo`, `isMedia`); the `importing` values are
`"pictures"` and `"with-videos"`, which the matcher does not catch. The guard's self-test adds `"video"` to its
detected names and adds `isVideoKind(assetKind(bytes))` and `importing === "with-videos"` to its allowed sources.
In `tests/modules.test.mjs` the module-list tests name the new files in sorted order and say "through 0012-W4 v1"
in their titles; and a test asserts `use-video-playback.ts`
holds exactly two `useEffect` calls and no `useLayoutEffect`. The state hook imports only `../video.ts`,
`../image-assets.ts` and the rules registry besides React and types (no other hook, no scene or screen part); the
scene part holds no `use*()` call.

## App.tsx

App.tsx remains composition-only, **264 lines, no added line**. Exactly these substitutions on existing lines of
efa921f, each "before" occurring exactly once in the file and each line staying one line, each passing values App
already has (`team` line 42, `gestureBusy` 45, `drag` 46, `setMessage` 49, `board` 51, `adapter` 52, `selected`
56, `tidy` 58, `images` 62, `displayedObjects` 66, `pos` and `find` 85, `pressedPlay` 101):

| efa921f line | Before (exact, once in the file) | After |
| --- | --- | --- |
| 2 | `import { GifMarks } from "./scene/gif-marks";` | `import { GifMarks } from "./scene/gif-marks"; import { useVideoPlayback } from "./state/use-video-playback"; import { VideoPlayer } from "./scene/video-player";` |
| 125 | `  const gif = useGifPlayback({` | `  const video = useVideoPlayback({ opening: adapter.current, boardId: board.boardId, objects: displayedObjects, selected, bitmaps: images.bitmaps, pressedPlay, hosted: team?.hosted, hidden: tidy.open \|\| find.open \|\| (gestureBusy && !drag.current?.pan), setMessage }); const gif = useGifPlayback({` |
| 175 | `zoom={view.z} /><Overlays` | `zoom={view.z} /><VideoPlayer player={video.player} pos={pos} zoom={view.z} /><Overlays` |

No fourth substitution is needed: the opening identity and the hidden flag ride on the line 125 call. The
"0012-W3 App composition" test in `tests/modules.test.mjs` is renamed "0012-W4 App composition": it keeps the base
`3f4ad48` and every earlier substitution, appends these three at the end of the substitution array (after its
current last entry, lines 751–752), and still checks the same line count. The implementation record lists every
substitution with its before and after text.

## Tests

New unit files: `tests/video.test.mjs` (`videoHeader` for MP4, MOV, WebM with the 1- and 8-byte size, short,
truncated and picture bytes; `routingSignature` (API v14's conditions: a PNG without `IHDR` is not routed as a picture) and `assetKind`'s
signature-first order with `isPictureKind`/`isVideoKind`, including a WebP whose size field reads `ftyp`;
`holdVideo` keeping the first `durationMs`; `validVideoRecord`; `posterPixels`; `videoFrame` refusing a PNG
first frame; `clockText`, `lengthText`, `currentText`; `mediaLabel`; `addedNotice`; `videoName`;
`loadFailedNotice`; `fileNames`, `addingNotice` and `refusalNotice` naming an unnamed video file `Clipboard
video` and an unnamed picture or unrecognised file `Clipboard image`; `hasPlayMark`; `addImages` and
`importReason` with videos and both budgets; `buildPaste` with `videos` `null`; `storeVideo` keeping existing
keys, `writePictures` and `removeUnusedPictures` with `poster`; `prepareVideo`'s refusals with a stubbed element;
routing through `importFiles` with file doubles that implement only `arrayBuffer()`, including a file over
52,428,800 bytes refused unread with the 20 MiB reason when its type is `image/png` and the 50 MiB reason when it
is `video/mp4` or empty, a 30 MiB unrecognised file refused with the 20 MiB reason when typed `image/png` and the
type reason when typed `application/octet-stream`, a rejected `arrayBuffer()` refused with the type reason, and a
pasted file read once for the paste decision and not read again, on local and hosted boards) and
`tests/video-playback.test.mjs` (the hook with a stubbed element: never starts on selection; the press latch;
pause, full-screen exit and kept time on deselect; a quick deselect and reselect showing paused; a stale
`loadedmetadata` or `play()` from an earlier token doing nothing; a download that completes after deselection
cached but not played; a download aborted (signal and timers) on a new `opening`, `pagehide` and unmount; the
download percentage capped at 99 and 0 while `total` is 0; a blob whose type differs from its header, or of 0 or
52,428,801 bytes, not cached; full-screen entry exposing the element (`aria-hidden` removed, `controls`, focus)
and exit restoring it and focusing Full screen; a new `opening` with the same board
id revoking URLs; end and restart; one target; `NotAllowedError` after a download; cannot-play once per hash;
load-failed once per press whose three tries all fail (once for joined presses); `hidden` passed through without pausing). Existing files updated as
their contracts need: `document.test.mjs`, `objects.test.mjs` (`eligibleIdea` excludes videos),
`images.test.mjs` (the accept list, `Media` labels, the combined reason, `Choose images or videos`),
`board-file.test.mjs`, `storage.test.mjs`, `clipboard.test.mjs`, `team-pictures.test.mjs` (X7-U08's first notice
and X7-U14's local branch kept as they are), `team-import.test.mjs`, `team-templates.test.mjs`, `find.test.mjs` F1-U13 (source-text check of the comments listener: unchanged, it counts only the
find-bar and export-dialog guards) and `workshop-spotlight.test.mjs` (runs the listener's callbacks in a VM:
its fake targets' `closest` must answer `null` for `.video-strip`, and a case with a target inside `.video-strip`
pressing Escape asserts nothing changes),
`modules.test.mjs`, and `tests/import-fixture.mjs` (schema 15 where it pins 14).

No dependency, font file, image file, service migration or import exception. No stored value in the browser
beyond storage v4's video records, and no room message, presence key or Undo step is added by playback; the
only new requests are the video uses of the two asset routes of API v14.
