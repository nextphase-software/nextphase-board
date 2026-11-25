BRIEF VERSION: 0012-W4 v1 (2026-11-24)
# 0012-W4 — Video files on single-user and team boards

Status: Draft. Implementation has not started under this brief.

## Outcome and read first

**Videos on any board.**
- **Adding** (owners and editors; everyone on a local board): the palette's picture button is now **Media** (same
  icon and place, ⌘⇧K / Ctrl+Shift+K), and its picker, drop and paste take **MP4, MOV and WebM** files as well as
  pictures. A video may be up to **50 MiB**, and a board may hold up to **100 MiB of video**, counted apart from its
  50 MiB of pictures. The browser opens each video to read its size and length and to take its **first frame**; a
  file it cannot open is refused with that reason. The notice reads `Adding clip.mp4…` (on team boards with the
  upload's percentage), then `Added 1 video.` on local boards.
- **Still until played**: an unselected video draws its first frame with a small dark badge showing ▶ and its length
  (`0:42`); hovering shows the round play button GIFs use. Pressing it selects the video and plays it.
- **Playing**: while a video is the one selected object, a dark **control strip** inside its bottom edge offers Play
  or Pause, the time, a seek slider, Mute and Full screen. It plays with sound, once, only when someone presses Play;
  selecting something else pauses it and keeps its place. Playback is each person's own: nothing is sent, and
  viewers may play too.
- **Team boards**: the first frame and the video are uploaded before the edit is sent, as pictures are; a video
  downloads only when someone first presses Play (`Loading video… 35%` in the strip). Uploads and downloads are
  streamed through the server part by part.
- Copy and paste on the same board, Duplicate, Undo, versions, restore, backups, Save a copy to file and Export keep
  working; Export draws the first frame. Board-file and template imports holding videos into a team workspace stay
  refused.

Read [AGENTS.md](../../AGENTS.md), [CONTRIBUTING.md](../../CONTRIBUTING.md), [DESIGN.md](../../DESIGN.md) and these
new contract files (prior versions remain untouched):

| Contract | New version / ownership |
| --- | --- |
| [Document](../architecture/0001-document-v21.md) | v21: schema 15 and the `video` object |
| [Storage](../architecture/0001-storage-v4.md) | v4: video records and budgets in the browser's store |
| [Board file](../architecture/0006-board-file-v5.md) | v5: file version 3, video entries, the 216 MiB limit |
| [Interaction](../architecture/0001-interaction-v50.md) | v50: the Media button, adding, the badge, playing, the strip, notices, looks |
| [Web modules](../architecture/0001-web-modules-v48.md) | v48: the new modules, changed web paths, counts, App.tsx substitutions |
| [API](../architecture/0003-api-v14.md) | v14: video types and limits on the asset routes; streamed bodies |
| [Sync](../architecture/0003-sync-v17.md) | v17: video edits accepted when the room holds both the video and its first frame |
| [Hosted storage](../architecture/0003-hosted-storage-v14.md) | v14: video rows in the picture tables (layout 9 unchanged), the streamed write and read, the web client's transfers |
| [Hosted persistence](../architecture/0003-hosted-persistence-v12.md) | v12: keeping and cleaning videos, unfinished uploads, backup limits |
| [Access](../architecture/0003-access-v15.md) | v15: video rights by board role |
| [Board lifecycle](../architecture/0006-board-lifecycle-v7.md) | v7: Trash, purge and delete with videos; import and template refusals restated |
| [Self-host runner](../architecture/0003-self-host-runner-v9.md) | v9: streamed bodies on each runner, the Node backup default |

Use this set wherever inherited contracts link a replaced version. Unchanged: [presence v5](../architecture/0004-presence-v5.md), [comments v5](../architecture/0005-comments-v5.md),
[workshop voting v3](../architecture/0007-workshop-voting-v3.md), [team templates v2](../architecture/0008-team-templates-v2.md)
(its picture refusal is widened to videos by board lifecycle v7), [identity v4](../architecture/0003-identity-v4.md),
[toolchain v5](../architecture/0001-toolchain-v5.md), [lock v5](../architecture/0001-dependency-lock-v5.json),
[inventory v5](../architecture/0001-dependency-inventory-v5.json) and [runtime notices v3](../architecture/0001-runtime-notices-v3.txt).
The room's stored layout stays 9; the 17 service tables remain: no service migration.

Build directly; no prototype or scenario tool is an input. Prove the stated values with focused tests, followed by
independent checks. Report a contract conflict before dependent work.

**Design.** The maintainer approved the look on 2026-11-24. Interaction v50 states every value of it: the Media
button is the existing picture button renamed, the badge and play button follow the GIF marks, the control strip sits
inside the video's bottom edge, and the notices are the app's existing notice.

## Deliverables and boundaries

Planning source baseline main **efa921f**. Use a fresh milestone worktree and branch from committed main containing
this packet, recording that prerequisite base separately from the behaviour baseline. New source files carry
`SPDX-License-Identifier: Apache-2.0`. Only these files may change, plus the append-only Implementation record below.

**New (eight files).**
1. `packages/board-rules/src/objects/video.ts` (document v21)
2. `apps/web/src/video.ts` (web modules v48: header rules, preparing a video, its first frame, the shared player type)
3. `apps/web/src/state/use-video-playback.ts` (two effects; all element control)
4. `apps/web/src/scene/video-player.tsx` (no hooks; a callback ref and plain props)
5. `tests/video.test.mjs`, `tests/video-playback.test.mjs` (web unit, `npm test`)
6. `tests/room-videos.test.mjs` (room unit, `npm test`)
7. `tests/server/videos.test.ts` (both runners)

**Changed** (rules, sync, room and server).

| # | File |
| --- | --- |
| 8 | `packages/board-rules/src/objects/registry.ts` (`video` after `image` in `OBJECT_TYPES`; `isVideo`, `isMedia`; proportions) and `packages/board-rules/src/document.ts` (schema 15) |
| 9 | `packages/board-sync/src/codec.ts` (the input matrix and `readLiveBoard`), `document-adapter.ts` (the media keys kept for videos), `session.ts` and `undo.ts` (only their runtime reads switched to `readLiveBoard`, sync v17) |
| 10 | `packages/board-room/src/pictures.ts` (video types and limits, `videoType`, per-type `complete()` and totals, `assets()` with `asset` and `poster`, staged uploads and the final step, streamed reads, restore checks per type) |
| 11 | `packages/board-room/src/room.ts` (schema 15; `storeVideo`; streamed `readPicture`), `edits.ts` (the video held check, sync v17), `history.ts` (schema and history checks), `backups.ts` (parts with a row only), `interfaces.ts` (`hasher()`, `timer()`) |
| 12 | `apps/server/src/routes/pictures.ts` (the head check, the video path, streamed `GET`) and `routes/common.ts` (`head()` and a stream reader) |
| 13 | `apps/server/src/runtime.ts`, `worker-runtime.ts`, `worker-room.ts` (the streamed video call and streamed read; `arrayBuffer()` kept for pictures only) and `start-node.ts` (the hasher; backup default 234,881,024) |
| 14 | `apps/server/src/routes/boards.ts` (schemas 13–15; images and videos refused) and `apps/server/src/templates.ts` (videos refused; wrapper schema 15) |

**Changed** (web, under `apps/web/` and `apps/web/src/` as shown).

| # | File |
| --- | --- |
| 15 | `src/image-assets.ts`, `src/images.ts`, `src/storage.ts`, `src/board-file.ts`, `src/clipboard.ts` (storage v4, board file v5, the media accept list and reasons) |
| 16 | `src/state/use-images.ts`, `src/state/use-canvas-input.ts`, `src/state/use-editing-commands.ts`, `src/state/use-storage-session.ts`, `src/state/use-export.ts`, `src/state/use-selection.ts` (only what web modules v48 names for each) |
| 17 | `src/strokes.ts`, `src/sections.ts` (`isMedia` only) |
| 18 | `src/scene/board-drawing.tsx`, `src/scene/image-body.tsx`, `src/scene/gif-marks.tsx` (the video branch, the widened body, the video badge and play mark) |
| 19 | `src/ui/image-controls.tsx` (Media name and tooltip; the label rules) and `src/ui/notice.tsx` (the importing rule on local boards) |
| 20 | `src/team/comments/layer.tsx` (only the `.video-strip` guard in its window Escape listener, web modules v48), `src/team/pictures.ts` (`uploadVideo`, `downloadVideo`), `src/team/import.ts`, `src/team/templates-rules.ts`, `src/team/voting-rules.ts` (`isMedia`, schema 15) |
| 21 | `index.html` (`media-src 'self' blob:` only), `style.css` (rules appended at the end only), `src/App.tsx` (only web modules v48's three substitutions) |

**Changed** (tests and docs).

| # | File |
| --- | --- |
| 22 | The existing tests and fixtures listed under the dispositions, and `tests/server/node-test.ts` (its `RoomClient` wrapper forwards `storeVideo` and the streamed read) |
| 23 | `vitest.node.config.ts`, `vitest.workerd.config.ts` (add `tests/server/videos.test.ts` to each `include` list) |
| 24 | `tests/README.md` (the new test files, appended after the 0012-W3 section) |
| 25 | `docs/guides/try-board.md` (two rows and four word changes, below) |

The new inputs of existing hooks and components are optional with defaults that keep today's behaviour, so existing
harnesses pass unchanged. Type-only changes in other files are allowed where the compiler needs them, with no
behaviour change; the record lists them. No file under `supabase/` changes; no `wrangler.json` change.

New tests import the new modules dynamically inside their named checks, never at top level, so on the efa921f
baseline each check that proves new behaviour fails by name; the compatibility checks V12 names pass on both (V12).

**Try-and-test guide.** One row at the end of Part 1's table and one at the end of Part 2's; in the three existing
rows that name the button (lines 140, 148, 249; four namings) "Image" becomes "Media". Nothing else in the guide changes.

Part 1 (local):

| Feature | Try this | You should see |
| --- | --- | --- |
| [Videos](../briefs/0012-W4-video-files.md) | Click Media (or press Cmd+Shift+K / Ctrl+Shift+K) and pick a short MP4. Click the empty canvas, hover the video, then click its round play button. Click the empty canvas again. Then pick an MP4 larger than 50 MiB | The video lands in the middle of the view showing its first frame. Unselected it shows a small label with ▶ and its length; hovering shows a round play button; clicking it selects the video and plays it with sound, with a dark strip of controls along its bottom; clicking the empty canvas pauses it. The large file is refused with a notice naming it and the 50 MiB limit |

Part 2 (team mode):

| Feature | Try this | You should see |
| --- | --- | --- |
| [Videos on team boards](../briefs/0012-W4-video-files.md) | Ana (owner), Ben (editor) and Mia (viewer) open the same team board. Ben clicks Media and picks a short MP4. Mia clicks the video, then Play in its strip. Ana does the same. Ben selects the video, presses Delete, then Cmd+Z (Ctrl+Z) | Ben sees "Adding …" with a percentage, then the video; Ana and Mia see it appear. Mia has no Media button but can play it; her strip first shows "Loading video…". Each person's playback stays on their own screen. Undo brings the video back for everyone |

Not allowed:
- a dependency, font, image or video file in the source tree, service, service migration, object-store binding or
  import exception;
- a new room layout, room message or presence key; a video or first frame in a socket frame; a hosted board's video
  or first frame written to IndexedDB;
- App.tsx beyond web modules v48's substitutions; effect counts other than web modules v48's;
- signed links, range requests, a public video address, streaming playback before the whole file has arrived,
  fetching or embedding anything from outside services;
- a Worker or Durable Object reading a whole video into memory (`arrayBuffer()`, `bytes()`, `text()` or `json()` on
  a video body, or assembling a video's parts into one array);
- starting playback on selection alone, looping, playing a video that is not the one selected object, a keyboard
  shortcut for Play, shared playback;
- importing a board file or template holding videos into a team workspace; link previews.

Outside the named new controls, the existing screens' markup stays exactly as at the base; the reviewer's A–J
comparison allows only the Media button's name and tooltip (V13).

## Required behavior and concrete design

Implement the twelve contracts in full. In particular:

- **Document:** schema 15 and the `video` object (document v21); its `pixelWidth`/`pixelHeight` are the first frame's
  pixels, so it draws through the image body with the first frame's bitmap.
- **Adding:** the Media button and picker; header rules; the browser check that opens the video (15 s) and takes the
  first frame (JPEG 0.90, longer side at most 1,920); landing as pictures land; local and hosted notices and reasons
  exactly as interaction v50; on team boards the first frame, then the video, then the edit.
- **Playing:** the badge and hover play button; the strip and its narrow form; playing only on a press while the one
  selected object; pause on any selection change keeping the time; end behaviour; one at a time; viewers too; nothing
  sent; the loading strip on team boards; the cannot-play notice once per video per tab and the load-failed notice once per press whose three tries all fail.
- **Server:** the streamed video path on both runners (parts as they arrive, hash as it goes, row last, nothing left
  on failure), per-type totals, streamed reads, `asset_missing` for videos, keeping and clean-up of both hashes and of
  unfinished uploads, backups with videos and the Node default limit.
- **Files and export:** board file version 3 with videos; Export draws first frames; the page policy gains
  `media-src 'self' blob:`.

## Shared-path check dispositions

This inventory authorizes expectation changes, not additional historical runs.

| Shared path / older checks | Disposition |
| --- | --- |
| Current-schema expectations reading **14** (a new, upgraded or loaded document, `empty()`, a written board): `tests/document.test.mjs` 117, 132, 135, 246, 293, 375; `tests/storage.test.mjs` 116, 132; `tests/pages.test.mjs` 26, 57, 213, 314; `tests/mind-map.test.mjs` 66, 70; `tests/shapes.test.mjs` 39; `tests/strokes.test.mjs` 32, 96; `tests/connectors.test.mjs` 37; `tests/connector-styles.test.mjs` 45, 84, 478, 539; `tests/tables.test.mjs` 34, 48, 408, 413; `tests/images.test.mjs` 27, 56; `tests/board-file.test.mjs` 56; `tests/room.test.mjs` 248; `tests/team-import.test.mjs` 64; `tests/team-templates.test.mjs` 48; `tests/server/mind-maps.test.ts` 105, 107, 114 (and its message "version 14"), 122, 189, 213; `tests/server/tables.test.ts` 115, 118, 122, 322, 353; `tests/server/drawing-layout.test.ts` 96, 97, 102, 133, 137, 144; `tests/server/pages.test.ts` 91, 99, 102, 129 | Each now reads **15**; a line that seeds or pins an older version is unchanged (next row). S425's title "schema-14" may stay |
| `tests/server/tables.test.ts` 328 (the wire delta's schema value `14`) | Becomes **15** |
| S438 (`tests/server/pictures.test.ts` 168–172) and X7-U21 (`tests/room-pictures.test.mjs` 78–89), which relabel a current backup as storage 8 (or 7) | A storage-8 relabel also rewrites its snapshot chunks (Yjs and JSON) to a schema-14 board, as the storage-7 branch already writes a schema-13 one, so the legacy load path is exercised; every assertion unchanged |
| X7-U26 (`tests/room-pictures.test.mjs` 158) | Its media gate keeps its own refusal: the fixture's restored head is built at the schema the room accepts, so the media-specific refusal, not a schema refusal, is what it proves; every assertion unchanged |
| Pinned older versions: `tests/activities.test.mjs` 49; `tests/tables.test.mjs` 46, 49, 388; `tests/images.test.mjs` 45, 48; `tests/tape.test.mjs` 32; `tests/strokes.test.mjs` 70; `tests/connectors.test.mjs` 85; `tests/shape-kinds.test.mjs` 15; `tests/mind-map.test.mjs` 81; `tests/server/shared.test.ts` 910; `tests/room.test.mjs` 225; `tests/server/pages.test.ts` 96–97 | Unchanged; must pass as written |
| Future-version refusals at **15**: `tests/document.test.mjs` 43; `tests/mind-map.test.mjs` 74; `tests/storage.test.mjs` 92; `tests/board-catalog.test.mjs` 235, 322; `tests/board-file.test.mjs` 79, 139; `tests/pages.test.mjs` 209–211 | The refused version becomes **16**; the assertions unchanged |
| `tests/pages.test.mjs` check 27 (203–214, "accept 13 and 14, classify 15 as newer") | Renamed "accept 13, 14 and 15, classify 16 as newer": the schema-13 assertion stays; an explicit `s.validate({...board, schemaVersion: 14}).schemaVersion === 14` is added; the current board reads 15; the newer payload is 16 |
| Edit fixtures at schema 14: `tests/workshop-spotlight.test.mjs` 18, `tests/workshop-voting.test.mjs` 18, `tests/workshop-reactions.test.mjs` 18 | Each becomes **15** (a live room's document is 15); `tests/page-links.test.mjs` 15 changes only if it reads the version, and the record says which |
| `tests/import-fixture.mjs` 86 (`sizedBoard(…, version = 14)`) and 19 (the storage-7 guard `=== 14`) | 86's default becomes 15 (S140 compares canonical bytes); 19 becomes `>= 14`; `richBoard` follows `empty()` |
| Object type lists: `tests/objects.test.mjs` 11 (literal list) and 44 (`eligibleIdea`); vote-eligible lists `tests/workshop-voting.test.mjs` 56 and `tests/server/voting.test.ts` 52 (S259); `tests/shared-editing.test.mjs` 74 (types `add()` cannot place) | `video` is inserted directly after `image` in `OBJECT_TYPES` (so `tests/tape.test.mjs` 15's `at(-1)` and `tests/mind-map.test.mjs` 43's `at(-2)` hold); 11 gains it after `image`; 44 gains `&& !isVideo(o)`; the two vote lists gain `video`; 74's exclusion filter gains `video` |
| `tests/images.test.mjs` 332–333 (the picker's accept list, the button's aria-label `Image` and tooltip `Image ⇧⌘K` / `Image Ctrl+Shift+K`) | The accept list becomes web modules v48's seven types; aria-label and tooltip `Media`; the input's own label as interaction v50 says; every other assertion unchanged |
| `tests/images.test.mjs` 296, 305 (`IMAGE_REASONS.type` by reference); `tests/team-pictures.test.mjs` 102 (`Added 1 image.`), 106, 111 (X7-U09 picture reasons), 173 (`ImageButton`) | Unchanged; must pass as written (a picture-only batch keeps its texts; the type reason is read by reference) |
| `tests/codec.test.mjs` 8–19 (round trip and the exact-map guards); `tests/board-export.test.mjs` 315, 414, 606 (export and drawing harnesses) | Unchanged; must pass as written (no fixture holds a video; the guard still rejects an unknown field; the new inputs are optional) |
| `tests/board-file.test.mjs` 43 (the round-trip loop over schemas 1–13) | Unchanged; schemas 14 and 15 with file version 3 are covered by the new board-file group in `tests/video.test.mjs` |
| `tests/board-file.test.mjs` 121–126 ("v2 bundle keeps one sorted entry per distinct picture…") | Renamed "v3 bundle …" (the writer writes version 3); every assertion unchanged (picture entries keep their keys) |
| `tests/team-import.test.mjs` 29–36 (`for (const version of [1, 2])`, version 2 built by `writeBoardFile`) | The loop becomes `[1, 2, 3]`: version 2 built as an explicit version-2 envelope (as `tests/board-file.test.mjs` 119's `v2` helper builds one), version 3 by `writeBoardFile`; the reason as the next row |
| Board file: `tests/board-file.test.mjs` 47 and `tests/activities.test.mjs` 53 (written `fileVersion` 2); `tests/board-file.test.mjs` 71, 85 (newer version 3); 93, 96, 177 ("72 MiB"); `tests/team-import.test.mjs` 19 (`75497473`, "72 MiB"), 23 (newer version 3), 29 (accepted versions) | Written version **3**; the newer version **4**; "**216 MiB**" and `226492417`; 29 lists `[1, 2, 3]`; `tests/board-file.test.mjs` 95, 192 (by reference), 84 and 125 unchanged |
| `tests/team-import.test.mjs` 37 (`PICTURES_REASON`) | Becomes `it holds pictures or videos, which team boards can't hold yet`; S135 (`tests/server/shared.test.ts` 913, `images_not_supported`), `tests/server/templates.test.ts` 113 and `tests/team-templates.test.mjs` 55 unchanged; must pass as written |
| `tests/team-pictures.test.mjs` 97–99 (X7-U08's first notice), 173–177 (the local notice branch), `tests/images.test.mjs` 300–307 and `tests/team-pictures.test.mjs` 52–74 (drop harnesses whose file doubles implement only `arrayBuffer()`) | Unchanged; must pass as written: picture-only batches keep today's notice timing and markup, and files are read only through `arrayBuffer()` |
| `tests/find.test.mjs` 220–234 (the extracted canvas handler), `tests/page-links.test.mjs` 196–255 (the storage hook), `tests/table-csv.test.mjs` 697–765 (the paste chain), `tests/workshop-spotlight.test.mjs` 87 (notice CSS), `tests/workshop-voting.test.mjs` 150 (App order), `tests/browser/app-regressions.mjs` 7–11 (App and storage), S39 (`tests/server/suite.test.ts` 464–469, an image edit without its picture) | Unchanged; must pass as written: the canvas handler's extracted range gains nothing, the storage hook's and paste chain's inputs are optional, CSS is appended, App's order is unchanged, and S39's image edit is still refused `asset_missing` |
| S259 (`tests/server/voting.test.ts`, the vote-eligible list) and `tests/board-file.test.mjs` 130–162, 187–192 (file-version-2 negative cases) | S259 gains `video` (above) and keeps its picture assertion; the version-2 negative cases unchanged; must pass as written |
| `tests/workshop-spotlight.test.mjs` (fake event targets in its comments-layer harness) | Each fake target's `closest()` answers `null` for `.video-strip` (the new guard); every assertion unchanged |
| A file of 20–50 MiB that is neither a picture nor a video and whose declared type is not `image/` | Its reason becomes the combined type reason (it was the 20 MiB reason); any older check asserting the old reason for such a file is updated, and the record names each (none is known at efa921f) |
| Backups: S437 (`tests/server/pictures.test.ts` 145–167, sets its own 96 MiB), `tests/room-pictures.test.mjs` 25, 119, 242 | Unchanged; must pass as written (no test reads the Node default) |
| Pictures on the server: S431–S441, X7-U20 (`pictureHeader` null cases) | Unchanged; must pass as written (no picture case carries a video header) |
| `tests/modules.test.mjs` | As web modules v48: rules files 16 → 17 (56–60); object types 11 → 12 and "through 0012-W4 v1" (216–217); the type-name guard list gains `video` (236) and both matcher patterns of `typeNameComparisons` gain `video` (449–450); the scene-part and state-hook lists name the new files (191–213, 248–277); "0012-W3 App composition" renamed "0012-W4 App composition" with the new substitutions appended at the end of its substitution array (751–752); the line budget (158–161, App at 264 lines) and every other guard unchanged and must pass |
| style.css guards: `tests/pages.test.mjs` 326–330, 389; `tests/workshop-spotlight.test.mjs` 294; `tests/workshop-voting.test.mjs` 140; `tests/tables.test.mjs` 463; `tests/tidy-up.test.mjs` 94 (TU-U11), 136 (TU-U14) | Unchanged; must pass as written: the new rules are appended at the end of `style.css`, add no `z-index`, leave `.scene > div` as it is, and give the strip `pointer-events: auto` through a two-class selector |
| `tests/tidy-up.test.mjs` 63 (`useContextBar` harness) and other harnesses of `useImages`, `useCanvasInput`, `BoardDrawing`, `ContextBar`, `Notice`, `useHostedBoard` | Unchanged; new inputs and props are optional |
| `docs/guides/try-board.md` 140, 148 (Part 1) and 249 (Part 2), which name the Image button (249 twice: "Ben clicks Image" and "Mia has no Image button") | Each naming of the button becomes "Media" (four in all); nothing else in those rows changes |
| The 0012-W1 scenario T | Rerun under V14 with these candidate expectations: T1–T4 the button `Media`, tooltip `Media ⇧⌘K` / `Media Ctrl+Shift+K`, the seven-type accept list (web modules v48); T19–T21 the reason `not a supported image or video (PNG, JPEG, GIF, WebP, MP4, MOV or WebM)` (the renamed text file and the damaged PNG as interaction v50 routes them); rows that read the written schema or file version expect schema **15** and file version **3**; T50 the page policy equal to `6339964`'s plus `media-src 'self' blob:`. Pinned legacy fixtures stay as they are: the version-9 board, version-1 and version-2 files, the `6339964` application. Every other row as written |
| The 0012-W2 scenario N6 | Rerun under V14 as written; its assertions unchanged |
| The 0012-W3 scenario N7 | Rerun under V14 as written with `Image` read as `Media` where a row names the button or its tooltip |
| Historical check tools (earlier scenario tools) | Not rerun except the regression runs named under validation |
| Local shell: A–J | Only difference allowed: the picture button's name and tooltip `Media`; the check run names each differing checkpoint and its cause |

The record lists every changed line range under `tests/`.

## Browser checks

New scenario **N8-S1–N8-S11**. N8 was unused as a scenario ID in existing public briefs when allocated. A fresh, independent check run writes its tool from these clauses and the
contract values. Each row prints its full ID, `PASS:` or `FAIL:` and a summary, and keeps raw receipts and unrun rows.

Setup: 1440 × 900, scale 1, macOS Chrome, US keyboard layout. Rows N8-S1–N8-S4 on the local app (single-user mode),
each in a fresh browser context; rows N8-S5–N8-S11 on the local team stack started from the candidate on its own
uniquely owned local Supabase project, with Ana (owner), Ben (editor) and Mia (viewer) each in their own browser
context, following the guide's Part 2 seed and sign-in steps, rows in order. Use real pointer and key events; files are
given to the app's own file picker, or as a drop or paste event carrying them. Pixels are read from the app's drawing
canvas for an unselected video and from the `<video>` element's current frame (drawn into a check canvas) while it
is selected, sampled away from the badge, the strip and any remote selection outline; a sampled colour matches when
each channel is within 12 of the stated value (video encoding is lossy). Progress receipts use the browser's network
emulation (Chrome DevTools Protocol `Network.emulateNetworkConditions`, upload and download throughput 2 Mbit/s) for
the stated row only, then turn it off. The check tool may delay, fail or answer a request through the browser
driver's request routing where a row says so, and installs a stated script before a page loads (the driver's init
script); an answer it makes up carries the server's CORS headers for the app's origin. Each row that changes routing,
emulation or init scripts removes them at its end and reloads the affected pages. New capability rows also fail by
name on the independent baseline efa921f. Colours, sizes and texts exactly as interaction v50. Captures are compared
with the approved screens for the new parts at their places; other board content may differ.

**Files** (made by the check tool with `ffmpeg` from colour sources): `clip.mp4`, H.264 with an AAC tone, 640 × 360,
25 fps, 12 s, encoded at a constant 4 Mbit/s so the file is at least 5,000,000 bytes (at 2 Mbit/s a transfer lasts
about 20 s, giving many progress readings 250 ms apart), the first 2 s with the left half `#FF0000` and the right half `#0000FF`, then `#00FF00`; `clip.webm`
(VP9, Opus) and `clip.mov` (QuickTime brand `qt  `, H.264), the same picture; `broken.mp4`, a valid `ftyp` box
(brand `isom`) followed by 4,000 random bytes; `big.mp4`, 52,428,801 bytes starting with a valid `ftyp` box;
`half-a.mp4` and `half-b.mp4`, valid H.264 files of 50,000,000 ± 500,000 bytes each (high bit rate), and
`small.mp4`, a valid 6 MiB file, all with different content, so the three together exceed 104,857,600 bytes;
`notes.txt`, a short text file.

| Row | Steps and pass condition |
| --- | --- |
| N8-S1 | Local board `Video check`. The palette's button has accessible name `Media` and, hovered, the tooltip `Media ⇧⌘K`; capture media-button. Pick `clip.mp4`: the notice reads `Adding clip.mp4…` until it lands, then `Added 1 video.`; capture adding while the first notice shows. It lands selected, centred, 640 × 360 units. While selected: one strip inside its bottom edge (computed background `rgba(30, 28, 34, 0.8)`, height 36px, radius 8px, 8 ± 1 px in from the video's left, right and bottom edges), its first button named `Play`, the time `0:00 / 0:12`; no badge; the frame stays first-frame red/blue for 1 s. Capture selected. Press `Play`: within 3 s the frame matches `#00FF00` and the time reads at least `0:02`; the button is named `Pause`; capture playing. Record the video element's `currentTime`, then click empty canvas: one badge reads `0:12` with computed background `rgba(30, 28, 34, 0.8)`, colour white, font size 10px, weight 700, radius 4px, its top right 6 ± 1 px left of and below the video's on-screen top right; capture still. Click the video 30 px inside its top-left corner: selected and paused, button `Play`; once its metadata has loaded, the element's `currentTime` equals the recorded one (± 0.1 s) and the time label shows the same whole second. Click empty canvas, hover the video: one play mark 40 × 40 (±1) centred (±1); capture hover. Press its centre: selected and playing within 1 s, from a time not earlier than the recorded one |
| N8-S2 | Same local board: pick `big.mp4`: `Could not add big.mp4: file is larger than 50 MiB.`; capture too-big. Drop `notes.txt` on the canvas: `Could not add notes.txt: not a supported image or video (PNG, JPEG, GIF, WebP, MP4, MOV or WebM).`; capture type. Pick `broken.mp4`: `Could not add broken.mp4: this browser cannot play this video.`; capture cannot-decode. Pick `half-a.mp4`, then `half-b.mp4` (each added; click empty canvas after each), then `small.mp4`: `Could not add small.mp4: videos would exceed the 100 MiB board limit.`; capture board-full. After each refusal no new object. Each capture is taken with nothing selected |
| N8-S3 | Fresh local board at 100% with the view centred on (0, 0): drop `clip.webm` at the screen point of board (−400, 0), then paste `clip.mov` (a paste event carrying it; it lands at the view centre, board (0, 0), clear of the first): two videos added, each `Added 1 video.`; each, selected and played, reaches `#00FF00`. Add a sticky with the Sticky tool at board (0, 400), press Escape twice to leave its text, click empty canvas; select one video and Shift-click the sticky: no strip, the context bar label reads `2 objects`. Select one video: label `Video`; Shift-click the other: `2 videos`. Click empty canvas, select the `clip.webm` video, press `Play`, and with it playing press ⇧⌘E, PNG, Selection only, Export: the exported video area matches the first frame (left half `#FF0000`). Click the video, Delete, Cmd+Z, click empty canvas, click the restored video: it plays when `Play` is pressed. With it selected, click it once more to focus the canvas, then Cmd+C, Cmd+V: a second copy, which plays. Save a copy to file: the file is version 3 and holds the videos' bytes (equal to the dropped and pasted files) and their first frames by hash. In a fresh browser context, Board › Open board file… with that file: the videos draw and play |
| N8-S4 | Fresh local context with an init script that replaces `HTMLMediaElement.prototype.play` by one that rejects with a `NotSupportedError`: pick `clip.mp4`, press `Play`: `This video can't play in this browser.`, the first frame stays and the button stays `Play`; press `Play` again: no second notice in that tab. Click empty canvas; capture cannot-play |
| N8-S5 | Team board `Videos team` (Ana makes it with Home › New board; everyone opens it). Ben's palette: `Media` with the tooltip `Media ⇧⌘K`; capture ben-palette. Mia's palette: no `Media`. With Ben's upload throughput emulated: Ben picks `clip.mp4`: Ben's notice reads `Adding clip.mp4… N%` at least twice with N whole and not decreasing; no board has a new object until both uploads answered; capture ben-adding. Then exactly two `PUT …/assets/<hash>` were sent (first frame, then video), Ben's board has the video selected and the notice is empty, and within 3 s Ana and Mia see it with its badge. Emulation off. Ben clicks empty canvas: capture ben-added |
| N8-S6 | With Ana's download throughput emulated, Ana clicks the video, then `Play`: while it downloads the strip's time area reads `Loading video… N%` at least twice with N not decreasing, and the track has no knob; capture ana-loading. When it has loaded it plays, or, if the strip shows `Play` (the browser refused to start sound after the download), Ana presses `Play` once more; then the frame matches `#00FF00`; capture ana-playing. Meanwhile Ben's and Mia's video areas stay the first frame for 1 s, Ana's selection colour on them; capture ben-while-ana-plays (Ben). Ana stays selected on the video and it keeps playing; the emulation and routes of this row are left in place until N8-S7 ends (no reload yet) |
| N8-S7 | Mia: ⌘⇧K opens no file chooser within 1 s; a drop of `clip.mp4` adds nothing on any board and sends no `PUT`; her read-only line is unchanged. Mia hovers the video: the play mark shows; capture mia-viewer (Ana's selection colour on it). Mia presses the mark: her video plays; capture mia-playing (her bar's editing buttons as the app shows them for a viewer). Ben's stays still. Immediately before it, Ana's video is checked to be playing (if it has ended, Ana presses `Play` again); Ana records `currentTime` and clicks empty canvas: her strip goes and the canvas frame is unchanged for 1 s; Ana clicks the video again: paused at the recorded time (± 0.1 s). Mia's press may need a second `Play` after her download, as Ana's did. Ana and Mia click empty canvas; N8-S6's emulation is turned off and both pages reload |
| N8-S8 | Ben, the routes below on video `PUT` requests only (a request whose body starts with a video header), each removed after its pick: pick `big.mp4`: `Could not add big.mp4: it is larger than 50 MiB.`, no `PUT`; capture too-big. With the next video `PUT` aborted as a network failure, pick `small.mp4`: `Could not add small.mp4: you are offline.`; capture offline. With it answered 409 `{ "error": { "reason": "board_videos_full" } }`, pick `small.mp4` again: `…: this board already holds 100 MiB of videos.`; capture board-full. With it answered 400, pick `small.mp4` again: `…: the server did not accept it.`; capture refused. Pick `broken.mp4`: `Could not add broken.mp4: this browser cannot play it.`, no `PUT`; capture cannot-decode. After each, no new object on any board; captures with nothing selected |
| N8-S9 | Ben and Mia each navigate afresh to `Videos team` with every `GET` for the video's hash failed by routing; once the first frame has drawn, each selects the video and presses `Play`: after the third failure (about 3 s) `Could not load clip.mp4. Press play to try again.`; each clicks empty canvas; captures load-failed (Ben) and load-failed-viewer (Mia, the notice under her read-only line). Routes removed. Each navigates afresh with N8-S4's init script installed; once the first frame has drawn, each selects the video and presses `Play` (it downloads first): `This video can't play in this browser.`; each clicks empty canvas; captures cannot-play (Ben) and cannot-play-viewer (Mia). Init scripts removed; both navigate afresh |
| N8-S10 | Ben clicks the video, presses Delete, waits until his save state reads saved, then Cmd+Z: within 3 s all three boards show it again; Ben clicks empty canvas, clicks the restored video and, with the canvas focused, presses Cmd+C, Cmd+V: one more video, no `PUT`. Ana, in a fresh context that has never loaded the video, chooses Save a copy to file: the file holds the video's bytes equal to `clip.mp4` and its first frame, by their hashes. Ana selects the video and exports it (⇧⌘E, PNG, Selection only): the exported area matches the first frame |
| N8-S11 | Both guide rows (Part 1, Part 2) walked as written, each on a fresh board (Part 2: a new team board made by Ana): each `You should see` holds |

## Acceptance criteria

- **0012-W4-AC01:** On both kinds of board, owners and editors add MP4, MOV or WebM videos within the limits by the
  Media button, ⌘⇧K, drop or paste; a file the browser cannot open is refused with its reason. Unselected, a video
  shows its first frame with its length badge; while it is the one selected object it plays on a press, with sound,
  through the strip, on that person's screen only. Adding, loading and every failure name the file and the reason
  (interaction v50). Look and placement match the approved design.
- **0012-W4-AC02:** Videos and their first frames are stored, kept, copied, versioned, restored, backed up, saved to
  and opened from board files, and removed under the picture rules, with the separate video budget (storage v4,
  board file v5, hosted storage v14, hosted persistence v12, lifecycle v7). Export draws the first frame.
- **0012-W4-AC03:** Every video upload and read checks the person's role on that board; viewers play but cannot add;
  removed people cannot load. Nothing is fetched from or embedded from outside services; board-file and template
  imports holding videos into a team workspace stay refused (access v15, lifecycle v7).

| Criterion | Evidence that shows it |
| --- | --- |
| 0012-W4-AC01 | N8-S1, N8-S2, N8-S4, N8-S5, N8-S6, N8-S7, N8-S8, N8-S9; V4 |
| 0012-W4-AC02 | N8-S3, N8-S10; S443, S444, S445, S447, S448, S449, S450; V4 |
| 0012-W4-AC03 | N8-S7, N8-S9; S446, S451; V4 |

## Applicable DESIGN.md guardrails

Canvas-first shell, native controls and visible focus, protected native editing, independent state owners and
fail-closed access apply. The badge and play mark are decorative, take no pointer events and are hidden from
assistive technology; the strip's controls are real buttons and a real slider with accessible names, reachable by
Tab, with visible focus. The video's own accessible name is its description, as an image's is. Interaction v50 states
every new word and value; never infer generic styling. No new sound, font, image or video file in the source tree.

## Validation commands and expected evidence

Use pinned Node 26.13.0 and npm 11.20.0 from the repository root. Source validation is not independent acceptance.
Each check run restates **every V row it reruns** as its own `PASS: Vn ...` / `FAIL: Vn ...` line with SHA, logs and
counts.

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm run typecheck
npm test
BOARD_TEAM_FEATURES=off BOARD_SUPABASE_URL=http://127.0.0.1:55321 BOARD_SUPABASE_ANON_KEY=synthetic BOARD_SERVER_URL=http://127.0.0.1:8796 npm run build
npm run audit:licenses
npm run build:fixtures
BOARD_TEAM_FEATURES=on BOARD_SUPABASE_URL=http://127.0.0.1:55321 BOARD_SUPABASE_ANON_KEY=synthetic BOARD_SERVER_URL=http://127.0.0.1:8796 npm run build
npm run audit:licenses
npm run build:server
npm run audit:licenses
npm run test:server:node
npm run test:server:workerd
WRANGLER_SEND_METRICS=false npx wrangler deploy --dry-run --outdir <scratch> -c apps/server/wrangler.json
git diff --name-status <prerequisite-base>..<validated-source>
git diff --check <prerequisite-base>..<validated-source>
```

The routes, the room's storage path and both runners change, so after the build a short server-only run installs the
schema and runs, on the exact candidate, the server checks the Checks workflow does not count (the speed checks on
both runners) plus one 50 MiB video upload and download on each runner; the counted server suites,
`tests/server/videos.test.ts` included, are taken from the Checks workflow run on the exact candidate commit (V9). The
check run starts the team stack on its own uniquely owned local Supabase project. Record each long run's start and end
and the host's sleep and wake events; a run that overlapped a sleep is INVALID and is rerun awake. Three manual checks
from this milestone are chosen only at Review.

| Check | Command/inspection and pass condition |
| --- | --- |
| V1 | Byte-compare manifests, locks, dependency inventory and runtime notices against the prerequisite base: unchanged, no new dependency |
| V2 | `npm ci --ignore-scripts --no-audit --no-fund` exits 0 on the clean candidate and on the independent baseline |
| V3 | `npm run typecheck` exits 0 across all five workspace members |
| V4 | `npm test` full suite exits 0. The new unit files prove each group below. Guards as web modules v48 |
| V5 | Team-off `npm run build` and `npm run audit:licenses` exit 0; notices equal runtime notices v1 (team off) |
| V6 | `npm run build:fixtures`, team-on `npm run build` and `audit:licenses` exit 0; team-on notices equal runtime notices v3 |
| V7 | `npm run build:server`, `audit:licenses` and the wrangler dry run exit 0; no deploy |
| V8 | Inspect all hunks plus `git diff --name-status` and `git diff --check` over `<prerequisite-base>..<validated-source>`: only the deliverables, the dispositions above and the append-only Implementation record; `apps/web/src/App.tsx` differs from the base only by web modules v48's substitutions; no `supabase/` or `wrangler.json` change; no `arrayBuffer()`, `bytes()`, `text()` or `json()` on a video body on either runner (named in the record with file and line) |
| V9 | The Checks workflow's server suites (Node and workerd) pass on the exact candidate commit, S443–S452 included; the server-only run passes the uncounted speed checks and the 50 MiB upload and download on both runners |
| V10 | N8-S1–N8-S11 pass with the state captures and raw receipts |
| V11 | Design, one receipt per approved screen: local-media-button ↔ media-button, local-adding ↔ adding, local-video-selected ↔ selected, local-video-playing ↔ playing, local-video-still ↔ still, local-video-hover ↔ hover (N8-S1); local-notice-too-big, -type, -cannot-decode, -board-full ↔ too-big, type, cannot-decode, board-full (N8-S2); local-notice-cannot-play ↔ cannot-play (N8-S4); team-ben-palette, team-ben-adding, team-ben-added ↔ ben-palette, ben-adding, ben-added (N8-S5); team-ana-loading, team-ana-playing, team-ben-while-ana-plays ↔ ana-loading, ana-playing, ben-while-ana-plays (N8-S6); team-mia-viewer, team-mia-playing ↔ mia-viewer, mia-playing (N8-S7); notice-team-editor-too-big, -offline, -board-full, -refused, -cannot-decode ↔ the N8-S8 captures; notice-team-editor-load-failed, notice-team-viewer-load-failed, notice-team-editor-cannot-play, notice-team-viewer-cannot-play ↔ the N8-S9 captures. The reviewer compares the new parts of each with the approved design |
| V12 | Once, on an independent efa921f source and build with the candidate's new unit files and `tests/server/videos.test.ts` copied in, and a test-only copy of `vitest.node.config.ts` and `vitest.workerd.config.ts` whose `include` lists add `tests/server/videos.test.ts` (nothing else changed): every check that proves new behaviour fails by name (S443–S451 and every X8 check except those named below) and the new browser capability rows fail; a top-level setup or import abort does not count. The compatibility checks are separate named checks, so no earlier failure can stop them: **S452** (a picture upload, read and edit beside the video routes, unchanged from today) and **X8-U00** (an existing picture-only batch's notices, routing and refusals unchanged); they pass on both revisions |
| V13 | Accepted A–J compare: baseline twice, then candidate and diffs, with existing normalization; only the differences the dispositions allow, each named |
| V14 | Accepted regression runs: the full unit suite (V4), the server suites (V9), A–J (V13), the 0012-W1 scenario T, the 0012-W2 scenario N6 and the 0012-W3 scenario N7 on the candidate, read with the dispositions above. Any row that also fails on efa921f is a baseline finding |

**Server checks** in `tests/server/videos.test.ts`, each on both runners, named `S443` onwards:
Self-host runner v9's named proofs belong to these checks: S443 `video-roundtrip`, `video-duplicate-renews` (its
`uploaded_at` compared before and after); S444 `video-oversized`, `video-duplicate-oversized`; S445
`video-budgets-apart`, `video-concurrent-staging`; S446 `video-hash-mismatch`, `video-duplicate-bad-body`,
`video-duplicate-demoted` (no renewal, compared by `uploaded_at`); S447 `video-asset-missing`,
`video-slow-upload-edit` (the slow upload ends 201 after the edit is saved); S448 `video-abort-cleanup` (a paced
body, `duplex: "half"` on Node, polling `rows` for the first staged part, then waiting at most 70,000 ms for the
server to settle before asserting); S449 `video-backup-node` (`backupLimit` reset in a `finally`),
`video-backup-workers-early`; S450 `video-trash-during-upload` (404 `not_found`), `video-erase` (inventory read only
after the purge).
- **S443** store and read: an MP4 `PUT` gives 201 with `{asset, type: "video/mp4", bytes}`; the same `PUT` again 200
  and nothing new stored; `GET` returns the bytes exactly (compared by length and SHA-256) with `Content-Type`,
  `Content-Length`, `Cache-Control: private, max-age=31536000, immutable` and `X-Content-Type-Options: nosniff`. A
  WebM and a MOV store as `video/webm` and `video/quicktime`.
- **S444** a 52,428,800-byte video (a valid `ftyp` box then filler) is stored in 50 parts and read back exactly;
  52,428,801 bytes is 413 `body_too_large`, after which no row and no part of that hash remain.
- **S445** the board's video total: videos adding up to 104,857,600 − 1,000 bytes are stored; two different 1,000-byte
  videos uploaded at the same time give exactly one 201 and one 409 `board_videos_full`, and no part of the refused one
  remains; a picture still stores (the picture budget is separate). On another board, pictures filled to 52,428,800:
  a video still stores, while a further picture is 409 `board_pictures_full`.
- **S446** refusals: a video whose bytes do not match the hash is 400 `picture_hash_mismatch` with no part left; bytes
  with neither a picture nor a video header 400 `unsupported_picture`; a viewer's `PUT` 403 `role_too_low` while
  their `GET` is 200; a non-member, a board in Trash and a removed person 404 `not_found`.
- **S447** a video edit whose video or first frame is not held is refused `asset_missing` and stores nothing; after both
  uploads the same update bytes, sent again with a fresh request ID (as S435 does), are saved and the other peer
  receives them; an edit moving that video later is saved; an edit whose `poster` is held as a PNG, not a JPEG, is
  refused `asset_missing`. While a 50 MiB video upload is in progress (sent slowly), an edit moving another object is
  saved before the upload ends.
- **S448** keeping: a version save keeps a video on the board, one removed but in a saved version, and one uploaded
  and never used (within 24 hours), with their first frames. An unfinished upload: the check waits until at least one
  staged part exists (the driver's inventory read), aborts the request, waits for it to settle, triggers clean-up (a
  version save) and finds no staging key and no part of that upload left. The 24-hour expiry is proved in the room
  unit test.
- **S449** backup and restore: a backup holds the video rows and restore re-creates them exactly. Node, with the
  `backupLimit` control set to 234,881,024 (and set back to 16,777,216 afterwards): a board holding 104,857,600 bytes
  of video and 52,428,800 of pictures backs up within that limit and restores. workerd: a board with more than 12 MiB
  of video answers 413 `backup_too_large`.
- **S450** lifecycle: in Trash both routes answer 404 for a video; after restore from Trash it is served again; after
  purge no row or part remains (the driver's inventory read).
- **S451** imports: the team board-file import of a document holding a valid video object (every field valid, so no
  other check can refuse it) is refused as one holding a picture is (same status and reason code); a team template
  holding a valid video object is refused. The existing picture refusal fixtures stay as they are.
- **S452** pictures unchanged (a compatibility check, V12): a picture `PUT`, `GET` and image edit behave exactly as
  S431 and S435 describe, on both runners; it passes on efa921f too.

**Unit checks**, named `X8-U01` onwards across the new unit files:
- `tests/video.test.mjs`: the document v21 rules for the video object (every field's valid and refused values, `poster` differing from `asset`, no hash both a picture and a video), board file version 3 (writing, reading versions 1–3, schemas 14 and 15, the video entries, the 216 MiB and budget refusals, a non-JPEG first frame refused), and the groups web modules v48 lists (header rules for MP4, MOV and WebM in both size forms,
  short, truncated and picture bytes; records; first-frame size; the length and time texts; labels; notices; the
  play-mark rule; adding and both budgets; storing, writing and clean-up with `poster`; preparing's refusals with a
  stubbed element, the 15 s limit included).
- `tests/video-playback.test.mjs`: the hook with a stubbed element (never starting on selection; the press latch;
  pause and kept time on deselect; end and restart; one target; a refused start after a download; the cannot-play
  notice once per video per tab; hosted download progress, three tries, the load-failed notice; URL release when the
  board changes); `VideoPlayer` markup (the strip, its narrow form, names, the loading form, nothing without a
  target).
- `tests/room-videos.test.mjs`: the upload idle refusal after 60,000 ms on the fake clock (`RoomEnvironment.timer`);
  restore re-checking each row's type against its bytes and the first-frame JPEG rule; the codec and room at schema 15 (sync v17's ranges per input, the adapter's video keys kept and removed); the room's video type rules and the classifier's precedence (a picture signature first; a RIFF/WebP head; a head split across chunks); a staged upload in chunks with a fake stream (parts
  written as they arrive, hashing as it goes, the 52,428,800-byte stop, a hash mismatch and a full board leaving no
  part, the final step's single transaction, an already-held hash drained then answered); concurrent uploads of the
  same hash and of different hashes at the board limit; per-type totals; clean-up of unfinished uploads sparing
  those in progress; keeping both hashes of a video with a fake clock (live, 24-hour upload, in a version); streamed
  reads in parts; backups and restore checks per type, hashing as a stream; the video held check for an added
  video, a changed `asset` and a changed `poster`, and none for an unchanged video; no `arrayBuffer()` on the video
  path (an instrumented request).

A regression failure that also fails on efa921f is a baseline finding to report, never fixed here.

## Review focus and public references

Review that:
- no video edit is saved unless the room holds both the video and its first frame, on either runner, and no video is
  served to someone without a role on the board;
- a video upload never holds the whole file in a Worker or Durable Object: parts are written as they arrive, the row
  last in one transaction, nothing visible or left after a refusal, and unfinished parts are cleaned;
- the board's video total cannot be passed by concurrent uploads, and pictures and videos are counted apart;
- an upload in progress cannot outlive a Trash, restore, backup restore or storage disposal of its board (its final step
  refuses and its staged parts go), and an already-held video is answered only after its body was hashed and the
  caller re-checked;
- pictures keep exactly today's upload and read paths;
- clean-up never removes a video or first frame the live board or a held version refers to;
- the web app never writes a hosted board's video or first frame to IndexedDB, never uploads on Paste, Duplicate,
  Undo or Redo, and never adds a video before both uploads answered;
- playback starts only on a press, stops on every selection change, sends nothing, and changes nothing on the board;
  Export and Save a copy never depend on a playing video;
- App.tsx changes only by web modules v48's substitutions; no state hook imports a scene part.

The public source basis is main efa921f and the linked versioned contracts, read 2026-11-24. Outside facts relied on:
Cloudflare's published limits (an isolate's memory 128 MB, request bodies up to 100 MB on Free and Pro zones, a
Durable Object SQLite value at most 8 MB), Cloudflare's `crypto.DigestStream`, and which video formats browsers play
(MDN's video codec guide). No unresolved product decision is delegated to implementation.

## Exclusions and reasons

- Streaming playback, range requests and signed links: a whole download within 50 MiB is enough for short clips.
- Shared playback for everyone at once; looping; trimming or cropping videos.
- Importing a board file or a template holding pictures or videos into a team workspace: separate work.
- Backups with videos above 16 MiB on the Cloudflare runner: its isolate memory; restore-to-time covers it.
- Link preview cards and videos from outside sites.
- Repairs to separately tracked baseline failures.

Amendment A1 (0012-W4 implement): an aborted `downloadVideo` answers `refused`, as web modules v48 says; hosted storage v14's table row is corrected to match.
Amendment A2 (0012-W4 implement): catalogue activities stay at schema 7 as today; document v21's reading-range sentence is corrected to match, and `apps/web/src/activities.ts` does not change.
Amendment A3 (0012-W4 implement): `ItemV14` follows the current object type alongside `BoardV14` so existing callers, including catalogue activities, keep their type imports. The decoder uses `StoredItemV14` for schema 14.

## Implementation record

(Append-only; the implementer adds its source validation here.)
