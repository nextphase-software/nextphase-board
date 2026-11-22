BRIEF VERSION: 0012-W3 v1 (2026-11-22)
# 0012-W3 — Images and animated GIFs on team boards

Status: Draft. Implementation has not started under this brief.

## Outcome and read first

**Pictures work on team boards, and animated GIFs play.**
- **Adding** (owners and editors): the Image button after Templates, ⌘⇧K / Ctrl+Shift+K, paste or drop, as on a
  local board. The browser uploads the picture to the board's server first; the board notice reads
  `Adding photo.png…`; the image appears only once the picture is stored. A refused file says which and why:
  `Could not add photo.png: you are offline.`, `…: it is larger than 20 MiB.`, `…: this board already holds 50 MiB
  of pictures.` or `…: the server did not accept it.`
- **Seeing** (everyone with a role): each person's tab fetches the picture from the server with their sign-in
  and draws it. Until it arrives the image is a grey `Loading image…` box; after three failed tries, the
  existing `Image unavailable` box. Viewers see pictures but have no Image button.
- **Keeping**: pictures are stored inside the board's own room storage (room layout 9), by hash, in 1 MiB
  parts; they stay while the board, a saved version or an upload of the last 24 hours refers to them; backups
  carry them; deleting the board removes them.
- **GIFs** (local and team boards): an animated GIF shows its first frame with a small `GIF` badge; hovering
  shows a play button; it plays in a loop only while it is the one selected object, on that person's screen
  only. A GIF too large to unpack says `This GIF is too large to play.`
- Copy and paste, Duplicate, Undo, versions, Save a copy to file and Export keep working with pictures; pasting an
  image whose picture has not loaded says `Could not paste the image: it has not loaded yet.` Board-file and
  template imports with pictures into a team workspace stay refused.

Read [AGENTS.md](../../AGENTS.md), [CONTRIBUTING.md](../../CONTRIBUTING.md), [DESIGN.md](../../DESIGN.md)
and these new contract files (prior versions remain untouched):

| Contract | New version / ownership |
| --- | --- |
| [API](../architecture/0003-api-v13.md) | v13: the two picture routes, picture types and header sizes, check order, refusals, caching headers |
| [Sync](../architecture/0003-sync-v16.md) | v16: image edits accepted when the room holds the picture; `asset_missing`; Undo and history with images |
| [Hosted storage](../architecture/0003-hosted-storage-v13.md) | v13: room layout 9 (`pictures`, `picture_parts`), upgrades from 7 and 8, storing and reading, backup envelopes 7–9, the web client's hosted pictures |
| [Hosted persistence](../architecture/0003-hosted-persistence-v11.md) | v11: how long a picture is kept, marking, clean-up, backup limits per runner, restore checks, limits |
| [Access](../architecture/0003-access-v14.md) | v14: picture rights by board role |
| [Board lifecycle](../architecture/0006-board-lifecycle-v6.md) | v6: Trash, purge and delete with pictures; import and template refusals restated |
| [Self-host runner](../architecture/0003-self-host-runner-v8.md) | v8: reaching the room's pictures on each runner, body limits, the version guard, proof |
| [Interaction](../architecture/0001-interaction-v49.md) | v49: adding and seeing pictures on hosted boards, pasting, GIFs, looks, notices |
| [Web modules](../architecture/0001-web-modules-v47.md) | v47: four new source modules and three test files, the changed web paths, new counts, ten App.tsx substitutions |

Use this set wherever inherited contracts link a replaced version. Unchanged: [document v20](../architecture/0001-document-v20.md),
[storage v3](../architecture/0001-storage-v3.md), [board file v4](../architecture/0006-board-file-v4.md),
[presence v5](../architecture/0004-presence-v5.md), [comments v5](../architecture/0005-comments-v5.md),
[workshop voting v3](../architecture/0007-workshop-voting-v3.md), [team templates v2](../architecture/0008-team-templates-v2.md),
[toolchain v5](../architecture/0001-toolchain-v5.md), [lock v5](../architecture/0001-dependency-lock-v5.json),
[inventory v5](../architecture/0001-dependency-inventory-v5.json) and [runtime notices v3](../architecture/0001-runtime-notices-v3.txt).
The 17 service tables remain: no service migration.

Build directly; no prototype or scenario tool is an input. Prove the stated values with focused tests,
followed by independent checks. Report a contract conflict before dependent work.

**Design.** The maintainer approved the look on 2026-11-22. Interaction v49 states every value of it: the Image
button is the existing local one, the loading box and the missing-picture box are drawn in the image's own
rectangle, the badge and play button are small dark marks over the GIF, and the notices are the app's
existing notice.

## Deliverables and boundaries

Planning source baseline main **ea0e2d4**. Use a fresh milestone worktree and branch from committed main
containing this packet, recording that prerequisite base separately from the behaviour baseline. New source
files carry `SPDX-License-Identifier: Apache-2.0`. Only these files may change, plus the append-only
Implementation record below.

**New (ten files).**
1. `packages/board-room/src/pictures.ts`: header sizes and picture types (API v13); store, read, held total,
   marking and clean-up (hosted storage v13, hosted persistence v11); the constants 1,048,576 (part),
   20,971,520 (picture), 52,428,800 (board), 86,400,000 (recent upload) and 4,096 (longer side)
2. `apps/server/src/routes/pictures.ts`: the two routes
3. `apps/web/src/gif.ts` (web modules v47)
4. `apps/web/src/team/pictures.ts`
5. `apps/web/src/state/use-gif-playback.ts`
6. `apps/web/src/scene/gif-marks.tsx`
7. `tests/gif.test.mjs`, `tests/team-pictures.test.mjs`, `tests/room-pictures.test.mjs` (unit, `npm test`)
8. `tests/server/pictures.test.ts` (both runners)

**Changed** (packages and server).

| # | File |
| --- | --- |
| 9 | `packages/board-room/src/storage.ts` (the two tables in `initialize()` and `tables`; `binaryColumns`; stored versions 0, 7, 8, 9) |
| 10 | `packages/board-room/src/room.ts` (create at 9; upgrade 8 → 9; the store and read methods through `ordered()`, admitted as `export` is; clean-up after a restore; the boards passed to marking and clean-up) |
| 11 | `packages/board-room/src/edits.ts` (the image refusal replaced by the held check for added or changed images, sync v16) |
| 12 | `packages/board-room/src/history.ts` (the two image refusals removed; marking and clean-up in `capture()` and `automatic()`, none after `before_restore`; restore checks in `validateHistoryBackup`) |
| 13 | `packages/board-room/src/backups.ts` (envelopes 7, 8, 9 and their table sets; the early picture-size refusal) |
| 14 | `packages/board-room/src/edit-session.ts` (only if passing the room's storage to the held check needs it; no change to when edits are saved) |
| 15 | `packages/board-room/src/interfaces.ts` and `packages/board-room/src/protocol.ts` (only types and constants the above need) |
| 16 | `apps/server/src/app.ts` (register the picture routes) |
| 17 | `apps/server/src/routes/common.ts` (`bytes()` and the hash validator) |
| 18 | `apps/server/src/runtime.ts` (`RoomClient.storePicture`, `readPicture`; `Runtime.backupLimit`) |
| 19 | `apps/server/src/worker-runtime.ts`, `apps/server/src/worker-room.ts` (the two raw picture calls; `backupLimit`) |
| 20 | `apps/server/src/worker.ts` (the recovery guard accepts 7, 8, 9) |
| 21 | `apps/server/src/start-node.ts` (the Node room client's picture calls; default backup limit 100,663,296; `backupLimit` on the runtime) |
| 22 | `apps/server/src/routes/operator.ts` (restore body limit from `runtime.backupLimit`) |

**Changed** (web, under `apps/web/src/` unless shown).

| # | File |
| --- | --- |
| 23 | `state/use-images.ts` |
| 24 | `images.ts` (hosted texts only) |
| 25 | `state/use-editing-commands.ts` (only the not-loaded check at the start of `clipboardCommand("Paste")`) |
| 26 | `state/use-hosted-board.ts` (only the optional `pasteFiles` input and its paste handler) |
| 27 | `state/use-canvas-input.ts` (only the optional `animated` input and `hovered`, `pressedPlay`, `pointerLeave`; none of it between `  function sceneKeyDown(` and `  function pointerDown(`) |
| 28 | `scene/board-drawing.tsx` (only the optional `loading` and `playing`) |
| 29 | `scene/image-body.tsx` (only the optional `loading`) |
| 30 | `ui/palette.tsx` (only the Image button's condition) and `ui/notice.tsx` (only the optional `importing` prop) |
| 31 | `team/hosted-board.ts` (only the `pictures` field and its import) |
| 32 | `App.tsx` (only web modules v47's ten substitutions) |
| 33 | `apps/web/style.css` (only `.gif-badge`, `.gif-play` and `.gif-play::after`, appended at the end of the file, after every rule the existing CSS guards read) |

**Changed** (tests and docs).

| # | File |
| --- | --- |
| 34 | `tests/modules.test.mjs` (the module lists and the App composition test, as web modules v47 says) |
| 35 | `tests/server/suite.test.ts` (check 39, below) |
| 36 | The stored-layout expectations listed under the dispositions |
| 37 | `tests/server/node-test.ts` (only: its `RoomClient` wrapper (lines 54–68) forwards `storePicture` and `readPicture`; its `backupLimit` control also sets `app.runtime.backupLimit`, and rooms opened after the control take the current limit) |
| 37a | `tests/board-history.test.mjs` 136, `tests/mentions.test.mjs` 167, `tests/workshop-spotlight.test.mjs` 199 (only: each `team/config.ts` stub also exports `settings = { serverUrl: "" }`, which `team/pictures.ts` imports; every assertion unchanged) |
| 38 | `vitest.node.config.ts`, `vitest.workerd.config.ts` (add `tests/server/pictures.test.ts` to each `include` list) |
| 39 | `tests/README.md` (the new test files) |
| 40 | `docs/guides/try-board.md` (two rows, below) |

The new inputs of the existing hooks are optional with defaults that keep today's behaviour, so the many existing
harnesses that call `useCanvasInput`, `useEditingCommands`, `useHostedBoard` and `useImages` pass unchanged.
Type-only changes in other files are allowed where the compiler needs them, with no behaviour change; the record
lists them. No file under `supabase/` changes; no `wrangler.json` change.

New tests import the new modules dynamically inside their named checks, never at top level, so on the ea0e2d4
baseline each new check fails by name (V12).

**Try-and-test guide.** One row at the end of Part 1's table and one at the end of Part 2's. Nothing else in
the guide changes.

Part 1 (local):

| Feature | Try this | You should see |
| --- | --- | --- |
| [Animated GIFs](../briefs/0012-W3-team-images-and-gifs.md) | Click Image (or press Cmd+Shift+K / Ctrl+Shift+K) and pick an animated GIF. Click the empty canvas, hover the GIF, then click its play button. Add a sticky, press Escape to finish typing, then Shift-click the GIF so both are selected | Unselected, the GIF shows its first frame with a small "GIF" label; hovering shows a round play button; once it is the only thing selected it plays in a loop; with the sticky also selected it stops on its first frame |

Part 2 (team mode):

| Feature | Try this | You should see |
| --- | --- | --- |
| [Pictures on team boards](../briefs/0012-W3-team-images-and-gifs.md) | Ana (owner), Ben (editor) and Mia (viewer) open the same team board. Ben clicks Image and picks a photo and an animated GIF. Mia copies an image in another app and presses Cmd+V (Ctrl+V) on the canvas. Ana selects the GIF. Ben deletes the photo and presses Cmd+Z (Ctrl+Z) | Ben sees "Adding …" and then both pictures; Ana and Mia see them appear, briefly as a grey "Loading image…" box. Mia has no Image button and her paste adds nothing. Only Ana's screen plays the GIF. Undo brings the photo back for everyone |

Not allowed:
- a dependency, font, image file, service, service migration, object store binding or import exception;
- a change to document v20, storage v3 or board file v4; a room message or presence key; a picture in a socket
  frame; a picture written to IndexedDB for a hosted board;
- App.tsx beyond web modules v47's ten substitutions; a changed effect count other than the new hook's one;
- signed links, a public picture address, a second picture store, fetching anything from outside services;
- importing a board file or template with pictures into a team workspace; video; link previews; playing a GIF
  that is not the one selected object, in Export or in Save a copy.

Outside the named new controls, the existing screens' markup stays exactly as at the base; the reviewer's A–J
comparison allows only the Image button on team palettes, if A–J shows a team palette (V13).

## Required behavior and concrete design

Implement the nine contracts in full. In particular:

- **Server routes:** `PUT` and `GET /boards/:board/assets/:hash` in API v13's check order, with the raw-byte
  reader, the header sizes, the refusals and the caching headers; both runners through `RoomClient`, the Worker
  calls handled before `request.json()`.
- **Room:** layout 9, upgrades from 7 and 8, the store transaction (clean-up, held total, parts), `asset_missing`
  for every image whose picture is not held, history and restore accepting images, marking and clean-up at every
  capture, prune and store, backups of version 7–9, the per-runner backup limit and the restore checks.
- **Adding on hosted boards:** the Image button for every role but viewer; keys, paste and drop as on local
  boards; `Adding <names>…`; upload before the edit; the hosted reasons; the end rules; no success notice.
- **Seeing:** the loader (four at a time, 1 s and 2 s retries, three tries, the checks), the loading box and the
  missing-picture box; held pictures; nothing in IndexedDB.
- **Pasting:** the not-loaded refusal on both kinds of board; otherwise Paste as today, with no upload.
- **GIFs:** `gifInfo` and `decodeGif` exactly as web modules v47 says; badge, hover play button, playing only as
  the one selected object, reduced motion, the 16,000,000-pixel limit and its notice once per picture per tab;
  Export draws frame 1 with no marks; Save a copy writes the GIF's original bytes.

## Shared-path check dispositions

This inventory authorizes expectation changes, not additional historical runs.

| Shared path / older checks | Disposition |
| --- | --- |
| `tests/server/suite.test.ts` check 39 "hosted image edits are refused" | Renamed "hosted image edits without their picture are refused": the same image edit (asset `"a".repeat(64)`, no upload) is refused with `asset_missing` instead of `images_not_supported`; everything else in it unchanged |
| `tests/server/shared.test.ts` S135 (import with an image: `images_not_supported`; 13 MiB body) | Unchanged; must pass as written (import still refuses pictures) |
| `tests/server/templates.test.ts` check 383, `tests/team-templates.test.mjs` (image objects refused), `tests/team-import.test.mjs` (`it holds pictures, which team boards can't hold yet`) | Unchanged; must pass as written |
| Stored layout version, expectations of a current room or backup: `tests/team-import.test.mjs` 86; `tests/team-pages.test.mjs` 127, 204, 207; `tests/server/history.test.ts` 53; `tests/server/mentions.test.ts` 183; `tests/server/shared.test.ts` 603, 610, 620, 897; `tests/server/spotlight.test.ts` 185; `tests/server/tables.test.ts` 306; `tests/server/team-pages.test.ts` 135, 178, 182; `tests/server/timer.test.ts` 72; `tests/server/voting.test.ts` 86; `tests/workshop-timer.test.mjs` 41; `tests/workshop-voting.test.mjs` 70; `tests/server/driver-workerd.ts` 109, 110; `tests/server/node-test.ts` 158, 159 | Each expectation that a new, loaded, upgraded or restored room, or a new backup, reads `storage_version` **8** now reads **9**; a line that only reads the value through a helper, or seeds it, is unchanged. The record lists each line changed and each left as is, with the reason |
| Seeds of layout 7 or 8: `tests/mentions.test.mjs` 54 (`setMeta(…, 8)`), `tests/comments.test.mjs` 281, 283, 299, `tests/presence.test.mjs` 120, 123, 126, the version-7 legacy backups of `tests/team-pages.test.mjs` 205–207 and `tests/server/team-pages.test.ts` 179–182, S429's legacy document fixtures | Unchanged: they still seed 7 or 8. `comments.test.mjs` 281–283 call only `initialize()`, so they still read 8; 299 loads the room, so it reads **9**. The legacy backups keep their (now empty) picture tables, which a version 7 or 8 backup may carry (hosted storage v13) |
| Future-version refusals: `tests/mentions.test.mjs` 56 (`setMeta(…, 9)` then `storage_unsupported`), `tests/team-pages.test.mjs` 208 and `tests/server/team-pages.test.ts` 183 (`for (const version of [6, 9])`) | The future version becomes **10** (`[6, 10]`); the assertions unchanged |
| `tests/server/history.test.ts` 193–201 (S192's literal table inventory) | Its table list gains `pictures` and `picture_parts`; every assertion on the existing tables unchanged |
| `tests/server/history.test.ts` 189–190 (restore body over the limit gives 413) | Unchanged; must pass as written: both test runners start with a 16,777,216 limit (`tests/server/node-test.ts` passes `backupLimit: 16777216` to `startNode`, so the Node runtime's `backupLimit` is that value; Workers' is 16,777,216) |
| Unit room environments with `backupLimit: 16777216` (`mentions`, `presence`, `comments`, `removal`, `team-import` tests) and `board-history.test.mjs`'s `backupLimit = 10` | Unchanged; must pass as written |
| Backup checks that read named tables (`mentions.test.ts` 192–193, `timer.test.ts` 250, `spotlight.test.ts` 346, `templates.test.ts` 235) | Unchanged; must pass as written |
| `tests/table-csv.test.mjs` X5-U19–X5-U22 (nested canvas, hosted and viewer paste harnesses, including `useHostedBoard` without `pasteFiles`) | Unchanged; must pass as written (without `pasteFiles` the hosted handler drops files as today; CSV and spreadsheet text are still taken first) |
| `tests/workshop-reactions.test.mjs` 98–99 (the reaction tool before the comment tool in `palette.tsx`), `tests/workshop-voting.test.mjs` 150 (`<ContextBar` after `<team.votingLayer` in App.tsx), `tests/page-links.test.mjs` 528–531 (the hosted bundle) | Unchanged; must pass as written (the Image button stays before `team.reactionTool`; App's order is unchanged) |
| `tests/server/voting.test.ts` S259 (`image` among the vote-eligible types) and the history checks S170, S171, S173, S174 (capture, prune, preview, restore) | Unchanged; must pass as written (marking and clean-up add no version, row in an existing table or socket frame) |
| `tests/server/suite.test.ts` S41 (restore body cap, 492), `tests/server/history.test.ts` S189, S190 (logical restores), `tests/server/lifecycle.test.ts` S210 (purge inventory) | Unchanged; must pass as written (test runners keep a 16,777,216 restore limit; purge leaves no room table, the picture tables included) |
| `tests/server/mentions.test.ts` S160 (literal table inventory, 186) | Its table list gains `pictures` and `picture_parts`; every other assertion unchanged |
| `tests/page-links.test.mjs` 203 (an earlier `HostedBoard` bundle) | Unchanged; must pass as written (it bundles the real `team/config.ts`) |
| `tests/pages.test.mjs` 326, 389 and `tests/workshop-spotlight.test.mjs` 87, 292 (style.css guards) | Unchanged; must pass as written: the new rules are appended at the end of `style.css` |
| Tests rendering `Notice` | Unchanged; without `importing` the notice is as today |
| `tests/modules.test.mjs` | The state-hook, scene-part and team module lists name the new files and say "through 0012-W3 v1"; "0012-W2 App composition" is renamed "0012-W3 App composition" with the ten substitutions added after the earlier ones; every other module check (effects, imports, line budget) unchanged and must pass |
| `tests/find.test.mjs` F1-U14 (evaluates `use-canvas-input.ts` from `  function sceneKeyDown(` to `  function pointerDown(`) | Unchanged; nothing is added in that range |
| `tests/tidy-up.test.mjs` TU-U11, TU-U14 and `tests/tables.test.mjs` 463 (style.css rules) | Unchanged; the new rules add no `z-index` and do not touch `.scene > div` |
| `tests/images.test.mjs` (harnesses of `useImages`, `ImageButton`, the picker, signatures, decoding, the board's picture checks) | Unchanged; they pass no `hosted`, so local behaviour is as today |
| Harnesses of `useCanvasInput`, `useEditingCommands` and `BoardDrawing` (`connectors`, `connector-styles`, `shapes`, `tape`, `tables`, `tidy-up`, `find`, `pages`, `table-csv`, `board-export` tests) and of `useHostedBoard` (`board-history.test.mjs`) | Unchanged; the new inputs and props are optional |
| The 0012-W1 scenario T | Rerun under V14 as written except T17, "a still GIF" (a two-frame 1 × 1 GIF imported and sampled twice): the import leaves it selected, so it now plays; the check clicks empty canvas first, then expects the first frame at both samples. Its other image checks keep their results (T50's "no network request" holds on local boards) |
| The 0012-W2 scenario N6 | Rerun under V14 as written; its image (a 400 × 300 PNG) is not a GIF and draws as before |
| Earlier scenario tools that read a team palette or a team board's image refusals | Not rerun. When run: an owner's or editor's team palette has `Image` right after `Templates`, before Reactions and Comment; a viewer's palette is unchanged; the board-file import refusal for pictures (`it holds pictures, which team boards can't hold yet`) keeps its result |
| Historical check tools (earlier scenario tools) | Not rerun except the regression runs named under validation |
| Local shell: A–J | Only difference allowed: the Image button in a team palette, if A–J shows one; the check run names each differing checkpoint and its cause |

The record lists every changed line range under `tests/`.

## Browser checks

New scenario **N7-S1–N7-S10**. N7 was unused as a scenario ID in existing public briefs when allocated. A fresh,
independent check run writes its tool from these clauses and the contract values. Each row prints its full ID,
`PASS:` or `FAIL:` and a summary, and keeps raw receipts and unrun rows.

Setup: 1440 × 900, scale 1, macOS Chrome, US keyboard layout. Rows N7-S1–N7-S3 on the local app (single-user
mode), each in a fresh browser context; rows N7-S4–N7-S10 on the local team stack started from the candidate on
its own uniquely owned local Supabase project, with Ana (owner), Ben (editor) and Mia (viewer) each in their own
browser context, following the guide's Part 2 seed and sign-in steps, rows in order (each starts from the state the
last one left). Use real pointer and key events; files are given to the app's own file picker, or as a paste or drop
event carrying them. Pixels are read from the app's drawing canvas, sampled at a point **away from any text**
(for a loading box, the point 20 % in from its left and top edges); objects are identified through the Objects panel
or by their drawn positions, never by DOM painted for the check. Before pressing a play button the pointer hovers
the GIF until `.gif-play` shows, then presses its centre (the mark takes no pointer events, so the press reaches the
canvas). The check tool may delay, fail or answer a picture request through the browser driver's request routing
where a row says so; an answer it makes up carries the server's CORS headers for the app's origin. New capability
rows also fail by name on the independent baseline ea0e2d4. Colours and sizes exactly as interaction v49. Captures
are compared with the approved screens for the new parts (badge, play button, loading box, Image button, notices,
playing frame) at their places; other board content may differ.

**Files** (made by the check tool): `photo.png`, 400 × 300, left half `#FF0000`, right half `#0000FF`; `p2.png`,
the same with its top-left pixel `#00FF00`; `anim.gif`, 240 × 160, four frames filled `#FF0000`, `#00FF00`,
`#0000FF`, `#FFFF00`, each with delay 20, a global colour table and no loop extension; `big.gif`, 1000 × 1000, 17
frames (17,000,000 pixels); `fair.gif`, 900 × 900, 19 frames of changing colours with delay 5 (15,390,000 pixels);
`still.gif`, a one-frame 240 × 160 GIF; `huge.png`, 20,971,521 bytes starting with a valid PNG header.

| Row | Steps and pass condition |
| --- | --- |
| N7-S1 | Local board `GIF check`: Image, pick `anim.gif`: it lands selected; sampling its interior every 100 ms for 1.2 s shows at least three of its four colours. Click empty canvas: within 300 ms the interior is `#FF0000` and stays so for 1 s; one `.gif-badge` reads `GIF`, computed background `rgba(30, 28, 34, 0.8)`, colour white, font size 10px, weight 700, radius 4px, padding 3px 5px, its top right 6 ± 1 px left of and below the GIF's on-screen top right. Capture still. Hover the GIF: one `.gif-play` 40 × 40 (±1) centred (±1) on it, background `rgba(30, 28, 34, 0.8)`. Capture hover. Move the pointer off: no `.gif-play`. Hover again and press its centre: the context bar shows `Image`, no badge or play button, and the interior changes colour within 300 ms. Capture playing when its interior is `#0000FF` (frame 3, as approved). Add a sticky with the Sticky tool clear of the GIF, then Shift-click the GIF so both are selected: within 300 ms the interior is `#FF0000` and stays so for 1 s |
| N7-S2 | Local board: Space-drag 600 units left between picks so each file lands on clear canvas. Pick `big.gif`: it lands selected, the notice reads `This GIF is too large to play.` and its interior stays at its first frame for 1 s. Capture too-large. Pick `still.gif`, then click empty canvas: no badge on it, and selected it stays still. Pick `fair.gif`: it plays; while it stays selected, click Zoom in five times over 1 s: its frames keep advancing during that second, and no long task over 200 ms is recorded (a `PerformanceObserver` for `longtask`) after its first frame shows. With reduced motion emulated (`prefers-reduced-motion: reduce`), pick `anim.gif`, click empty canvas, then click the GIF 30 px from its centre: selected and still for 1 s; click empty canvas, hover it and press its play button's centre: it plays; click empty canvas, then select it from Objects: still |
| N7-S3 | Local board holding one image whose picture record is missing (seeded in IndexedDB as scenario T seeds its boards): it draws `Image unavailable`; select it, Cmd+C, Cmd+V: nothing pasted and the notice `Could not paste the image: it has not loaded yet.` Capture paste-not-loaded |
| N7-S4 | Team board `Pictures team` (Ana makes it; everyone opens it). Ben's palette: `Image` directly after `Templates`, tooltip `Image ⇧⌘K`. Capture ben-palette. Mia's palette: no `Image`. Ben's picture uploads are held 1.5 s by routing: Ben clicks Image and picks `photo.png` and `anim.gif` together: Ben's notice reads `Adding photo.png and anim.gif…`, and no board has a new object while held. Capture ben-adding. Then Ben's board has both images selected, the notice is empty, and exactly one `PUT …/assets/<hash>` per picture was sent; within 3 s Ana and Mia see two images. Ben clicks empty canvas: capture ben-added (both unselected, the GIF with its badge). Ben presses ⌘⇧K: the file chooser opens (cancel it). Ben Space-drags 500 units right; a paste event carrying `p2.png` on Ben's canvas adds one image (one `PUT`); Cmd+Z removes it on every board; a drop of `p2.png` adds one image again (a `PUT` answered 200); Cmd+Z; Ben waits until the save state reads saved and every board shows only the photo and the GIF, then pans back (Navigation › Reset view) |
| N7-S5 | Ana reloads with her `GET` for the photo's hash held 2 s by routing: during the hold the photo draws `#F1EFF4` (±2) at its sampling point and the GIF draws its first frame; capture ana-loading; then the photo's left-half centre is `#FF0000` and its right-half centre `#0000FF` |
| N7-S6 | Mia: ⌘⇧K opens no file chooser within 1 s; a paste event carrying `photo.png` and a drop of it add nothing on any board and send no `PUT`; her read-only line is unchanged. Mia hovers the GIF: `.gif-play` shows. Capture mia-viewer. Mia presses its centre: her GIF plays; Ana's and Ben's GIF interiors stay `#FF0000` for 1 s. Mia clicks empty canvas |
| N7-S7 | Ben: pick `huge.png`: `Could not add huge.png: it is larger than 20 MiB.`, no `PUT`. Capture too-big. With Ben's next `PUT` aborted as a network failure by routing, pick `p2.png`: `Could not add p2.png: you are offline.`; capture offline. With the next `PUT` answered 409 `{ "error": { "reason": "board_pictures_full" } }`: `…: this board already holds 50 MiB of pictures.`; capture board-full. With it answered 400: `…: the server did not accept it.`; capture refused. After each, no new object on any board. Ben Space-drags 800 units down and picks `big.gif`: it appears on all three boards, selected only on Ben's, and Ben's notice reads `This GIF is too large to play.`; capture team-gif-too-large (Ben). Mia selects it: her notice under her read-only line reads the same; capture team-gif-too-large-viewer (Mia). Ben selects it and presses Delete; everyone clicks empty canvas and Ben resets the view |
| N7-S8 | Ana selects the GIF: her interior changes colour within 300 ms; Ben's and Mia's stay `#FF0000`. With the GIF selected and playing on Ana's board, Ana presses ⇧⌘E, PNG, Selection only, Export: the picture's interior is `#FF0000` within 2. Ben selects the photo, presses Delete, waits until his save state reads saved, then Cmd+Z: within 3 s all three boards show the photo again with its left-half centre `#FF0000`. Ben selects the photo, Cmd+C, Cmd+V: one more photo, no `PUT`. Once every picture on Ben's board is drawn, Ben chooses Save a copy to file: the downloaded file holds exactly the photo's and the GIF's pictures by their hashes, the GIF's bytes equal `anim.gif`'s |
| N7-S9 | Ben reloads `Pictures team` with every `GET` for the GIF's hash failed by routing: the GIF draws `#F1EFF4` until the third failure (about 3 s), then `#DEDEDE` (`Image unavailable`). Ben selects it, Cmd+C, Cmd+V: `Could not paste the image: it has not loaded yet.` Capture team-paste-not-loaded |
| N7-S10 | Both guide rows (Part 1, Part 2) walked as written: each `You should see` holds |

## Acceptance criteria

- **0012-W3-AC01:** On team boards, owners and editors add pictures by the Image button, ⌘⇧K, paste or drop
  within the limits; the adder sees `Adding…` and others a `Loading image…` box until the picture arrives, and
  every failure names the file and the reason (interaction v49). On both kinds of board an animated GIF plays only
  while it is the one selected object and otherwise shows its first frame with its badge. Look and placement match
  the approved design.
- **0012-W3-AC02:** Team-board pictures are stored with their board, by hash, and kept while the board, a version
  or a recent upload refers to them; copies, Undo, versions, restore, backups, Save a copy and Export all find
  them; deleting the board removes them (hosted storage v13, hosted persistence v11, lifecycle v6). Local pictures
  stay local as today. Only pictures people add are stored; nothing is fetched from elsewhere.
- **0012-W3-AC03:** Every picture upload and read checks the person's role on that board; viewers cannot add
  pictures and removed people cannot load them (access v14). Board-file and template imports with pictures stay
  refused.

| Criterion | Evidence that shows it |
| --- | --- |
| 0012-W3-AC01 | N7-S1, N7-S2, N7-S4, N7-S5, N7-S6, N7-S7, N7-S9; V4 |
| 0012-W3-AC02 | N7-S3, N7-S8, N7-S9; S431, S432, S434, S435, S436, S437, S438, S439, S440; V4 |
| 0012-W3-AC03 | N7-S6; S433, S441; V4 |

## Applicable DESIGN.md guardrails

Canvas-first shell, native controls and visible focus, protected native editing, independent state owners and
fail-closed access apply. The badge and play button are decorative, take no pointer events and are hidden from
assistive technology; the image's own accessible name is unchanged. Interaction v49 states every new word and
value; never infer generic styling. No new sound, font or image file.

## Validation commands and expected evidence

Use pinned Node 26.13.0 and npm 11.20.0 from the repository root. Source validation is not independent
acceptance. Each check run restates **every V row it reruns** as its own `PASS: Vn ...` / `FAIL: Vn ...`
line with SHA, logs and counts.

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

The room, its storage layout, the API and both runners change, so after the build a short server-only run
installs the schema and runs, on the exact candidate, the server checks the Checks workflow does not count (the
speed checks on both runners); the counted server suites, `tests/server/pictures.test.ts` included, are taken
from the Checks workflow run on the exact candidate commit (V9). The check run starts the team stack on its
own uniquely owned local Supabase project. Record each long run's start and end and the host's sleep and wake
events; a run that overlapped a sleep is INVALID and is rerun awake. Three manual checks from this milestone are
chosen only at Review.

| Check | Command/inspection and pass condition |
| --- | --- |
| V1 | Byte-compare manifests, locks, dependency inventory and runtime notices against the prerequisite base: unchanged, no new dependency |
| V2 | `npm ci --ignore-scripts --no-audit --no-fund` exits 0 on the clean candidate and on the independent baseline |
| V3 | `npm run typecheck` exits 0 across all five workspace members |
| V4 | `npm test` full suite exits 0. The three new unit files prove each group below. Guards as web modules v47 |
| V5 | Team-off `npm run build` and `npm run audit:licenses` exit 0; notices equal runtime notices v1 (team off) |
| V6 | `npm run build:fixtures`, team-on `npm run build` and `audit:licenses` exit 0; team-on notices equal runtime notices v3 |
| V7 | `npm run build:server`, `audit:licenses` and the wrangler dry run exit 0; no deploy |
| V8 | Inspect all hunks plus `git diff --name-status` and `git diff --check` over `<prerequisite-base>..<validated-source>`: only the deliverables, the dispositions above and the append-only Implementation record; `apps/web/src/App.tsx` differs from the base only by web modules v47's ten substitutions; no `supabase/` or `wrangler.json` change |
| V9 | The Checks workflow's server suites (Node and workerd) pass on the exact candidate commit, S431–S441 included; the server-only run passes the uncounted speed checks on both runners |
| V10 | N7-S1–N7-S10 pass with the state captures and raw receipts |
| V11 | Design, one receipt per approved screen: local-gif-still, local-gif-hover, local-gif-playing ↔ still, hover, playing (N7-S1); local-gif-too-large ↔ too-large (N7-S2); local-paste-not-loaded ↔ paste-not-loaded (N7-S3); team-ben-palette, team-ben-adding, team-ben-added ↔ ben-palette, ben-adding, ben-added (N7-S4); team-ana-loading ↔ ana-loading (N7-S5); team-mia-viewer ↔ mia-viewer (N7-S6); notice-team-editor-too-big, -offline, -board-full, -refused ↔ too-big, offline, board-full, refused (N7-S7); notice-team-editor-gif-too-large ↔ team-gif-too-large and notice-team-viewer-gif-too-large ↔ team-gif-too-large-viewer (N7-S7); notice-team-editor-paste-not-loaded ↔ team-paste-not-loaded (N7-S9). The reviewer compares the new parts of each with the approved design |
| V12 | Once, on an independent ea0e2d4 source and build with the candidate's three new unit files and `tests/server/pictures.test.ts` copied in, and a test-only copy of `vitest.node.config.ts` and `vitest.workerd.config.ts` whose `include` lists add `tests/server/pictures.test.ts` (nothing else changed): the new checks and the new browser capability checks fail by name; a top-level setup or import abort does not count. Checks that prove unchanged behaviour (the import and template refusals, local images) pass on both revisions |
| V13 | Accepted A–J compare: baseline twice, then candidate and diffs, with existing normalization; only the differences the dispositions allow, each named |
| V14 | Accepted regression runs: the full unit suite (V4), the server suites (V9), A–J (V13), the 0012-W1 scenario T and the 0012-W2 scenario N6 on the candidate, read with the dispositions above. Any row that also fails on ea0e2d4 is a baseline finding |

**Server checks** in `tests/server/pictures.test.ts`, each on both runners, named `S431` onwards:
- **S431** store and read: `PUT` 201 with `{asset, type, bytes}`; the same `PUT` again 200 and nothing new stored;
  `GET` returns the bytes exactly with `Content-Type`, `Content-Length`, `Cache-Control: private,
  max-age=31536000, immutable` and `X-Content-Type-Options: nosniff`.
- **S432** a 20,971,520-byte picture (a valid header then filler) is stored in 20 `picture_parts` rows and read
  back byte for byte; 20,971,521 bytes is 413 `body_too_large` with nothing stored.
- **S433** refusals in API v13's order: a hash that is not 64 lowercase hex characters, a non-member and a board in
  Trash 404 `not_found` (a board in Trash with a bad hash too); a viewer's `PUT` 403 `role_too_low` with `needed:
  "editor"` (also with an oversized body) while their `GET` is 200; empty bytes and a text file 400
  `unsupported_picture`; a JPEG whose segments run past its end, and one reaching start of scan before a frame
  header, 400 `unsupported_picture`; a PNG header of 4,097 × 10 400 `picture_too_large`; a hash of other bytes 400
  `picture_hash_mismatch`; a removed person's next `GET` 404.
- **S434** the board total: pictures adding up to 52,428,800 − 1,000 bytes are stored; two different 1,000-byte
  pictures uploaded at the same time give exactly one 201 and one 409 `board_pictures_full`; a held one uploaded
  again is 200.
- **S435** an image edit adding a picture that is not held is refused `asset_missing` and stores nothing; after the
  upload the same edit is saved and the other peer receives it; an edit adding a second image on a held picture is
  saved; after a version restore to a board holding an image whose picture is not held, an edit moving another
  object and a rename are saved.
- **S436** clean-up: a version save keeps a picture on the board, one removed from the board but in a saved version,
  and one uploaded and never used (within 24 hours). The 24-hour expiry and the oldest-version rule are proved in
  `tests/room-pictures.test.mjs` with a fake clock.
- **S437** backup and restore: the backup holds both picture tables; restore re-creates the pictures byte for byte;
  a backup whose part indexes skip one, or that repeats a hash, is 400 `bad_request` and the fence is untouched; after
  a version restore to a board holding an image whose picture is not held, the board's backup restores. Node, with the `backupLimit` control set to 100,663,296: a board holding 52,428,800 bytes of pictures
  (small document, few versions) backs up within that limit and restores. workerd: a board with more than 12 MiB of
  pictures answers 413 `backup_too_large` (that no part was read is proved in `tests/room-pictures.test.mjs` with an
  instrumented storage).
- **S438** a new board's room reads `storage_version` 9. A version-8 backup (a current backup with
  `storage_version` set to 8 and its two picture tables removed, as `team-pages.test.ts` builds its legacy backup)
  restores through the operator route; after a join or export loads the room, it reads 9 with both picture tables
  empty.
- **S439** lifecycle: in Trash both routes answer 404; after restore from Trash the picture is served again; after
  purge no picture row remains, read with the driver's inventory read that does not open the room.
- **S440** history: restoring a version that holds an image succeeds and the image's picture is served.
- **S441** CORS: after a picture is uploaded, a preflight for `PUT` with `Content-Type` from the allowed origin
  passes; a `GET` from the allowed origin is 200 with its bytes and `Access-Control-Allow-Origin` set to that origin;
  the same `GET` from another origin is 200 without `Access-Control-Allow-Origin`.

**Unit checks**, named `X7-U01` onwards across the three new files:
- `tests/gif.test.mjs`: `gifInfo` on still, animated and malformed bytes; `decodeGif` for the grammar and outcomes of web modules v47 (an invalid code, an index outside the table, an image
  without a table after a valid frame, a huge clipped rectangle refused by `area`) (Graphic Control Extension scope, Plain Text blocks drawing nothing, application and comment extensions
  skipped), every disposal (0–3 and 4–7 as 1), transparency, local and global colour tables, interlaced rows, LZW
  minimum code sizes 2 and 8, the 12-bit and full-table cases, frames clipped to the screen, each early-end case
  (bytes ending in a sub-block, an end code before the last pixel, bytes ending between blocks), the delay rule (0
  and 1 become 100 ms; no extension 100 ms), `gif_too_large` thrown before decoding and each `gif_invalid` case.
- `tests/room-pictures.test.mjs`: header sizes for PNG, GIF, JPEG (APP segments, fill bytes, standalone markers,
  SOF0 and SOF2, EOI or SOS before a frame, a short segment) and WebP (`VP8 `, `VP8L`, `VP8X`) and each unreadable
  case; layout 9 on create and from 7 and 8 (one transaction, nothing else changed) and a version above 9 refused;
  the held predicate; store, parts, exists, full (clean-up kept) and read; every kept rule with a fake clock (live on
  any page, the 24-hour upload, in a version by ordinal, the oldest version pruned, versions kept out of ordinal
  order, no versions); marking with the board passed at each capture kind (initial at creation, before restore and
  restored); clean-up after capture, in `automatic()` when the capture is skipped, at store, once after a restore and
  never on the lifecycle fence; `asset_missing` for an added image and for a changed asset, and no refusal for an
  unchanged image whose picture is gone; history previews and restores with images; backup decoding of versions 7,
  8 (with and without empty picture tables, and a head holding an image refused) and 9 (duplicate hashes, non-integer
  or repeated indexes), each restore check leaving the fence untouched, the early refusal after the recovery checks
  and before any payload row is read (an instrumented storage), and an upload of a picture a held version refers to
  starting with `captured_ordinal` null; the per-runner backup
  limit.
- `tests/team-pictures.test.mjs`: `BoardPictures` upload and download with a stub `fetch` (headers, body, timeouts,
  each answer's kind, only `board_pictures_full` as `full`); `useImages` on a hosted board (the `Adding…` notice and
  its name rule, upload before the edit, each hosted reason, stopping at each check point (after preparing, before sending, after an upload, before adding), a disconnect or rejoin mid-import refusing the rest and staying stopped after a reconnect, a
  network error with the board connected refusing one file, the 250-object recheck, the cleared notice, nothing in
  IndexedDB) and on a local board (as today); the loader with fake timers (four at a time, slots freed on failure,
  the retry delays, the hash, signature and decode checks, the third failure, a new opening ending the old one and
  ignoring its answers, `loading`); `animated` (frame count and screen size); the Paste not-loaded refusal on local
  and hosted boards; `useHostedBoard`'s paste with and without files and without `pasteFiles`; `useCanvasInput`'s
  `hovered` (and its resets), `pressedPlay` (sequence; not for a modified press, a Space pan, voting mode or a GIF
  whose bitmap is not drawn) and `pointerLeave`; `Notice` with `importing` on hosted and local boards; `useGifPlayback` (the candidate and target
  rules, reduced motion with a fresh, a stale, a discarded (the press did not make it the one selected object) and no `pressedPlay`, frames advancing and looping with fake timers,
  stopping, a decode finishing after cancellation dropped, the too-large notice once per picture, a decode failure
  staying still, the effect's cleanup); `GifMarks` markup (thresholds, positions, `aria-hidden`, nothing for
  selected, still or not-drawn GIFs); `ImageBody` and `BoardDrawing` with `loading` and `playing`; the palette's
  Image button for owner, editor, guest and viewer; the hosted notices once for each role that sees them.

A regression failure that also fails on ea0e2d4 is a baseline finding to report, never fixed here.

## Review focus and public references

Review that:
- no image edit is saved for a picture the room does not hold, on either runner, and no picture is ever served to
  someone without a role on the board;
- every picture write is one transaction (parts and row together) and the board total cannot be passed by
  concurrent uploads;
- clean-up never removes a picture the live board or a held version refers to, and runs only where hosted
  persistence v11 says;
- the Worker never parses a picture body as JSON and the Durable Object reads it as raw bytes;
- the backup limit differs per runner only through `backupLimit`, and the restore route uses the same value;
- the web app never writes a hosted board's picture to IndexedDB, never uploads on Paste, Duplicate, Undo or Redo,
  and never adds an imported image before its upload answered;
- GIF playback changes nothing on the board, sends nothing and stops when the selection changes; Export and Save a
  copy use frame 1;
- App.tsx changes only by the ten substitutions; the new hook has one effect; no state hook imports a scene part.

Unresolved after read 2 (the read cap), for the check run and review to confirm:
- that App re-rendering once per GIF frame keeps editing responsive (N7-S2's long-task row); if not, the fix keeps
  frame changes out of App's render, within web modules v47's modules;
- that the supported browsers give an animated GIF's first-frame bitmap the logical screen size, so `animated` matches
  (a GIF whose first image is offset or smaller than its screen is the case to try);
- the Worker's raw picture calls (bytes in the body, the caller in `x-person`) and a 20 MiB body on workerd;
- the early backup refusal's read order (the room unit test's instrumented storage);
- the badge's right inset: the contract's 6 px against the approved capture's about 3 px (V11 compares its look and
  top inset, and the right inset by the contract).

Accepted as written: a version that refers to a picture the room did not hold when it was captured does not keep a
later upload of that picture (hosted persistence v11); a paste on a team board never reaches another team board,
because the object clipboard lives per opened board, as today.

The public source basis is main ea0e2d4 and the linked versioned contracts, read 2026-11-22. Cloudflare's published
limits (a Durable Object SQLite value at most 8 MB, an isolate's memory 128 MB, request bodies up to 100 MB on Free and
Pro zones) are the only outside facts relied on. No unresolved product decision is delegated to implementation.

## Exclusions and reasons

- Importing a board file or a template with pictures into a team workspace: it needs an upload step of its own.
- Video files and link preview cards: later work.
- Backups with pictures above 16 MiB on the Cloudflare runner: its isolate memory; restore-to-time covers it.
- Queuing uploads while offline; larger limits on team boards; playing GIFs that are not selected.
- Repairs to separately tracked baseline failures.

## Implementation record

(Append-only; the implementer adds its source validation here.)
