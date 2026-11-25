BRIEF VERSION: 0012-W6 v1 (2026-11-25)
# 0012-W6 — Team import and templates with pictures

Status: Draft. Implementation has not started under this brief.

## Outcome and read first

**Pictures and videos travel into team workspaces.**
- **Importing a board file** (owners and editors of a team workspace, from the files page's Import board file…): a
  file holding pictures, GIFs or videos is no longer refused. The browser opens a **staged import**, uploads each
  file one at a time (`Importing “Offsite plan.nextboard”… 40%`), then sends the document; the server creates the
  board, with the staging's id as the board's id, only when every file it names has arrived. A failed, refused or
  abandoned import leaves no board, no row and no stored file (the staging is erased 60 s after its last activity).
- **Saving a team template** from a selection, page or board holding pictures or videos copies them into the
  template's own **store**, at most **20 MiB** a template. The Save as template dialog says how many pictures and
  videos it includes and how much of the 20 MiB they use, refuses before uploading when they exceed it, and counts
  up on its button while it saves (`Saving… 40%`). Replace with selection does the same.
- **Adding such a template** to a team board closes the panel, copies its files into that board first (`Adding
  “Offsite kit”… 40%` in the board's toast), then adds the objects by today's insertion, so everyone sees them with
  their pictures at once.
- Every failure names its reason in the existing notice; nothing is half-made. Viewers see no new control.
  Single-user boards do not change.

Read [AGENTS.md](../../AGENTS.md), [CONTRIBUTING.md](../../CONTRIBUTING.md), [DESIGN.md](../../DESIGN.md) and these
new contract files (prior versions remain untouched):

| Contract | New version / ownership |
| --- | --- |
| [Interaction](../architecture/0001-interaction-v51.md) | v51: the import, save, replace and add texts, percentages, reasons and checks; the picture line; the existing looks restated |
| [Web modules](../architecture/0001-web-modules-v49.md) | v49: one new team module, the changed web files, counts; App.tsx unchanged |
| [API](../architecture/0003-api-v15.md) | v15: the staged import routes and finish sequence, the template upload and asset routes, the sizes route, new reasons |
| [Hosted storage](../architecture/0003-hosted-storage-v15.md) | v15: staging deadlines, the room's importing state and its gate, the template store, the web client's transfers |
| [Hosted persistence](../architecture/0003-hosted-persistence-v13.md) | v13: the schema changes, keeping and erasing, the backup boundary, the restore marker, limits |
| [Access](../architecture/0003-access-v16.md) | v16: rights step by step |
| [Board lifecycle](../architecture/0006-board-lifecycle-v8.md) | v8: an imported board is born at the finish; refusals narrowed |
| [Self-host runner](../architecture/0003-self-host-runner-v10.md) | v10: the new room and runtime calls, `TemplateMedia`, expiry and erasing on each runner, proofs |
| [Team templates](../architecture/0008-team-templates-v3.md) | v3: templates with pictures and videos, saving, replacing, adding, deleting |

Use this set wherever inherited contracts link a replaced version. Unchanged: [document v21](../architecture/0001-document-v21.md),
[storage v4](../architecture/0001-storage-v4.md), [board file v5](../architecture/0006-board-file-v5.md) (its team
refusal superseded by lifecycle v8), [sync v17](../architecture/0003-sync-v17.md), [presence v5](../architecture/0004-presence-v5.md),
[comments v5](../architecture/0005-comments-v5.md), [identity v4](../architecture/0003-identity-v4.md),
[toolchain v5](../architecture/0001-toolchain-v5.md), [lock v5](../architecture/0001-dependency-lock-v5.json),
[inventory v5](../architecture/0001-dependency-inventory-v5.json) and [runtime notices v3](../architecture/0001-runtime-notices-v3.txt).
The room's stored layout stays 9 and the document schema 15; the service tables stay 17 (one column added).

Build directly; no prototype or scenario tool is an input. Prove the stated values with focused tests, followed by
independent checks. Report a contract conflict before dependent work.

**Design.** The maintainer approved the look on 2026-11-25. Interaction v51 states every value: the design adds no
control, panel or style, only text in existing places (the files page's `.home-toast`, the board's `.team-toast`, and
the template dialogs' `.team-template-hint` and `.team-template-error` lines and submit buttons) and the Add buttons'
`disabled` state while an add runs, each keeping today's element, class and style at `ea4203c`.

## Deliverables and boundaries

Planning source baseline main **ea4203c**. Use a fresh milestone worktree and branch from committed main containing
this packet, recording that prerequisite base separately from the behaviour baseline. New source files carry
`SPDX-License-Identifier: Apache-2.0`. Only these files may change, plus the append-only Implementation record below.

**Amendment A1 (2026-11-25).** A claimed import's expiry cleans up any board row before erasing the room and retries
when SQL cleanup fails. The documentation commit updates this brief and the API v15, hosted storage v15,
self-host runner v10 and board lifecycle v8 contracts before the source commit.

**New (seven files).**
1. `packages/board-room/src/template-store.ts` (hosted storage v15)
2. `apps/server/src/routes/imports.ts` (API v15, the import's open and upload)
3. `apps/server/src/routes/template-media.ts` (API v15, the template upload's open and upload, the asset read)
4. `apps/web/src/team/media-transfer.ts` (web modules v49)
5. `tests/team-media.test.mjs` (web unit, `npm test`)
6. `tests/room-imports.test.mjs` (room and template store unit, `npm test`)
7. `tests/server/imports.test.ts` (both runners)

**Changed** (room, server and schema).

| # | File |
| --- | --- |
| 8 | `packages/board-room/src/room.ts` (the importing state and its gate, the new methods, `create(document, importer?, token?)`, `assetSizes`, `schedule()` and `alarm()` for staging), `pictures.ts` (the store paths' admission and final-step checks made injectable for the importing state; the 410 invalidation) and `interfaces.ts` (type only, optional `AccessSource.discardImport`) |
| 9 | `apps/server/src/app.ts` (register `imports` and `template-media` after `templates`), `routes/boards.ts` (the optional `import` key and the finish sequence), `routes/pictures.ts` (the `asset-sizes` route; the asset `PUT`'s body handling shared with the import upload, its answers unchanged), `routes/templates.ts` and `templates.ts` (`upload`, `templateObjects(value, held?)`, commit, store removal, `media` in the detail `GET`) |
| 10 | `apps/server/src/runtime.ts`, `worker-runtime.ts`, `worker-room.ts` (the staging alarm path, erasing on `{ discard: true }`), `worker.ts` (the `TemplateMedia` class), `start-node.ts` (the `template-media` folder, stores, timers, re-arming on open, erasing) and `supabase.ts` (the new arguments, keys and `board_exists` mapping) |
| 11 | `apps/server/wrangler.json` (the `TEMPLATE_MEDIA` binding and the `v2` migration only) |
| 12 | `apps/server/supabase/nextphase_board.sql` (exactly hosted persistence v13's four numbered changes) |
| 13 | `apps/server/scripts/mark-restored-volume.mjs` (skip and delete staging files, hosted persistence v13) |

**Changed** (web): under `apps/web/src/team/`: `import.ts`, `home-import.tsx`, `templates-rules.ts`, `templates.ts`,
`templates-section.tsx`, `pictures.ts`; and `apps/web/src/activities.ts` (type only) and
`apps/web/src/state/use-editing-commands.ts` (one property) (14), only as web modules v49 says.

**Changed** (tests and docs).

| # | File |
| --- | --- |
| 15 | The existing tests listed under the dispositions; `tests/server/node-test.ts`, `driver-node.ts`, `driver-workerd.ts`, `driver-types.ts` and `worker-test.ts` (forwarding the new `RoomClient` and `Runtime` calls, the `TemplateMedia` class, non-creating inventory reads of rooms and template stores) |
| 16 | `vitest.node.config.ts`, `vitest.workerd.config.ts` (add `tests/server/imports.test.ts` to each `include`; the workerd config's `durableObjects` also gains `TEMPLATE_MEDIA: { className: "TemplateMedia", useSQLite: true }`) |
| 17 | `tests/README.md` (the new test files, appended after the 0012-W4 section) |
| 18 | `docs/guides/try-board.md` (Part 2: two existing rows gain a sentence and one row is added, below) |

The new inputs of existing functions are optional with defaults that keep today's behaviour, so existing harnesses
pass unchanged. Type-only changes in other files are allowed where the compiler needs them, with no behaviour change;
the record lists them. No dependency; no change to `apps/web/src/App.tsx`, `apps/web/style.css`, `ui/palette.tsx`, any
scene or screen part, or any state hook other than the one property above.

New tests import the new modules dynamically inside their named checks, never at top level, so on the ea4203c
baseline each check that proves new behaviour fails by name; the compatibility checks V12 names pass on both.

**Try-and-test guide (Part 2).** In the row "Import a board file", Try this gains at its end: " Then, on that board,
she clicks Media, adds a picture and drags it aside, chooses Save a copy to file again and imports the new file the same
way" and You should see gains at its end: " The second import shows a percentage, then opens with the picture, which
Ben and Mia see too". In the row "Team templates", Try this changes "Ana selects a few objects" to "Ana adds a picture
with Media, then selects it and a few objects" and "Mia opens Templates" to "Mia opens the board", and You should see
gains at its end: " The picture is in Ben's copy; Mia has no Templates button". One row is added at the end of Part 2's
table:

| Feature | Try this | You should see |
| --- | --- | --- |
| [Pictures in team imports and templates](../briefs/0012-W6-team-import-and-templates-with-pictures.md) | Ana makes an Example team board named "Offsite plan". She clicks Media and adds a picture, then drags it to the left; adds a second picture and drags it to the right; adds a short MP4 and drags it down. She opens the Board panel, chooses Save a copy to file, then Back to files, then Import board file… and picks the saved file. On the new board she clicks the first picture, Shift-clicks the second, opens Templates, chooses Save selection as template, names it "Offsite kit" and clicks Save template. Ben opens another Example team board, opens Templates and clicks Add template on "Offsite kit". Mia opens that board, then the imported board, clicks the video and presses Play (again if it stops after loading) | Ana sees "Importing “Offsite plan.nextboard”… N%" and then the new board with its pictures and video. The Save as template dialog says "Includes 2 pictures (… MiB of the 20 MiB a template can hold)." and the button counts up while it saves. Ben's Templates panel closes, he sees "Adding “Offsite kit”… N%", then the two pictures. Mia sees the pictures on both boards and the video plays for her; she has no Import board file… or Templates button |

Not allowed:
- a dependency, font, image or video file in the source tree, an object-store (R2) binding, a new room message,
  presence key or socket frame, a new service table;
- any change to App.tsx, style.css, `ui/palette.tsx`, a scene or screen part, or a state hook beyond the one property;
  new CSS;
- a board row created before `claimImport` passed; a staged file read by a board, sync, history or backup path; an
  importing room loaded as a board;
- a hidden or pending board state; a Cancel control; parallel uploads;
- a Worker or Durable Object reading a whole **import** video into memory (the import's video path is API v14's
  streamed path); template bodies are read whole, bounded by 20 MiB;
- template stores in the operator backup; single-user templates with pictures; link previews.

Outside the named new controls, the existing screens' markup stays exactly as at the base; this brief names no new
control, only the texts and the Add buttons' `disabled` state of interaction v51, and the reviewer's A–J comparison
allows no difference (V13).

## Required behavior and concrete design

Implement the nine contracts in full. In particular:

- **Staged import:** open, `beginImport`, upload (pictures whole, videos streamed, both into the future board's room,
  checked against the opened list and workspace), the finish sequence (claim, the row with the import's id through
  `create_board`'s new argument and its role re-check, `create(document, importer, token)` keeping the staged rows,
  the clean-up by id); the gate on every other room entry point; staging deadlines, alarms and erasing on both
  runners, including a cold alarm and a reopened file; 410 `upload_expired`; every step's role.
- **Template store:** open, begin, upload (whole, ≤ 20 MiB), save and replace with `upload` (commit once, check, row,
  erase on a certain refusal or after a replace), delete erasing, the detail `GET` with `media`, the asset read for
  workspace owners, editors and viewers; the `TemplateMedia` Durable Object and the Node files.
- **Schema:** hosted persistence v13's four changes, repeatable, one signature per changed function.
- **Sizes route** for the dialogs.
- **Web:** the three sequences, one file at a time, with interaction v51's checks, texts, percentages and reasons; the
  60,000 ms watchdog through abort signals; the board-lifetime add runner; the panel closing on Add; Add disabled
  while an add runs; the add's toast re-sent at least every 2,000 ms.

## Shared-path check dispositions

This inventory authorizes expectation changes, not additional historical runs.

| Shared path / older checks | Disposition |
| --- | --- |
| `tests/team-import.test.mjs` 29–40 (versions 1–3 holding media refused with `PICTURES_REASON`, line 38 pinning its text) | The loop keeps versions 1, 2 and 3; its 24-byte PNG header fixture is replaced, for the success cases, by a valid small PNG that decodes (the import decodes pictures before staging). For versions 2 and 3, `importBoard` with a file holding media does **not** call `send` and returns the board, title and `media` (hash, type, bytes); for version 1 (no bytes carried) it refuses with `a picture is unavailable`; the 24-byte header in a version 2 file is refused `it is damaged`. Line 38's text assertion and the `PICTURES_REASON` import are removed (the export is gone). 97–104 (`room_exists`) unchanged; must pass |
| `tests/team-templates.test.mjs` T8-U3 (52–58: invalid values, including a sticky with `type: "image"`, refused by both validators) | Unchanged; must pass (that object is still invalid). The new acceptance of a **valid** image is proved in `tests/team-media.test.mjs` |
| T8-U7 (86–91, exact response parsing) | Unchanged; must pass (`parseTemplate` keeps its keys) |
| T8-U10 (118–128, the controller re-reads on Add) | Its double's detail answer gains `"media": []`, and its deep comparison of `controller.read(t)` becomes a comparison with `{ ...t, media: [] }`; every other assertion unchanged |
| S386 (`tests/server/templates.test.ts` 137–138: the detail `GET` equals the `POST` answer) | Becomes: the detail without its `media` key equals the `POST` answer, and `media` deep-equals `[]`; every other assertion unchanged |
| The template route checks S378–S401 other than S386 (`tests/server/templates.test.ts` and `suite.test.ts`: shapes, rights, limits, exact list and mutation response keys, check 383's image without `upload` refused 400 `bad_request`, S397's service tables and functions, S398's reapplication, S399's induced failure), and S430 | Unchanged; must pass as written (no `upload`; list and mutation answers keep their keys; the file stays repeatable; existing rows get `store` null) |
| S7, S58, S134, S135, S136, S137 (936–961: compensation when the room create fails), S138, S139, S140, S141, S142 (the lost-reply row), S169, S182, S183, S191, S406, S410, S414 (`pages.test.ts` 116), S417 (`team-pages.test.ts` 84), S425: every create and import without `import` | Unchanged; must pass as written (a create without `import` is API v14's word for word, its clean-up `deleteBoard` + `removeRoom` included; an unknown body key other than `import` is still 400; legacy rights unchanged) |
| S451 (`tests/server/videos.test.ts` 243–249: a board import and a template holding a video, without `import` / `upload`) | Unchanged; must pass as written |
| Check 48 (`tests/server/suite.test.ts` 584–590: 17 tables with row security; functions not callable by `authenticated`; the file applied twice) | Unchanged; must pass |
| Callers of `create_board` with three named arguments: `tests/server/setup.ts` 122–123, `removal.test.ts` 358, `lifecycle.test.ts` 76, `mentions.test.ts` 98, `suite.test.ts` 606, 623 | Unchanged; must pass (the fourth argument defaults to null) |
| `tests/server/setup.ts` 218 (deleting a workspace's templates between checks) | Unchanged; stores left behind are unreachable test residue |
| `tests/modules.test.mjs` 562–597 (the exact team-module list, "through 0012-W3 v1") | `media-transfer.ts` inserted in sorted order; title "through 0012-W6 v1"; the `import.ts` and rules-style guards unchanged and must pass. The App composition test (605–765), the line budget (158–162), every count and every effect guard (316–376, 598–604) unchanged and must pass |
| `tests/team-pictures.test.mjs`, `tests/images.test.mjs`, `tests/video*.test.mjs`, `tests/room-pictures.test.mjs`, `tests/room-videos.test.mjs`, S431–S452 | Unchanged; must pass as written (`upload` and `uploadVideo` without a signal behave as today; the board store paths keep their answers) |
| The 0006-W1 scenario X1 | Rerun under V14 with these candidate expectations, and with the baseline-era assumptions it already carries read as 0012-W4 left them: the picker opened through **Media** (it says Image), files written at version 3 and schema 15 (X1-S6, X1-S7 expect version 2 without `pages`), 216 MiB and version 4 as newer (X1-S12, X1-S16). New: X1-S4 (a file holding pictures) now imports, showing a percentage, and opens a board with its pictures; X1-S17 (a picture file picked on Recents) now opens one staged import instead of no request; X1-S23 keeps its picker-cancel half, and its refusal-and-focus half uses `Invalid.json` (`it is not a Board file`) in place of the picture file. Every other row as written |
| The 0008-W2 scenario T8, the 0012-W3 scenario N7 and the 0012-W4 scenario N8 | Rerun under V14 as written (none asserts a media refusal in a team import or template); N7's baseline-era Image button and tooltip are read as **Media** and `Media ⇧⌘K`, as 0012-W4 renamed them |
| Local shell: A–J | No difference allowed (single-user is unchanged) |

The record lists every changed line range under `tests/`.

## Browser checks

New scenario **N9-S1–N9-S10**. N9 was unused as a scenario ID in existing public briefs when allocated. A fresh,
independent check run writes its tool from these clauses and the contract values. Each row prints its full ID,
`PASS:` or `FAIL:` and a summary, and keeps raw receipts and unrun rows.

Setup: 1440 × 900, scale 1, macOS Chrome, US keyboard layout. Rows on the local team stack started from the candidate
on its own uniquely owned local Supabase project (`npm run team:start`'s runner), with Ana (owner), Ben (editor) and
Mia (viewer) of Example team each in their own browser context, following the guide's Part 2 seed and sign-in steps,
rows in order; the source file is made in a fresh local-mode context. Real pointer and key events; files are given to
the app's own file picker. Progress receipts use Chrome DevTools Protocol `Network.emulateNetworkConditions` (upload
and download throughput 2 Mbit/s) for the stated row only. **Routing:** where a row says so, the check tool matches one
request by method and URL pattern (stated), answers, aborts or holds it (holds: neither continues nor answers), and
removes the route right after that attempt; a made-up answer carries the server's CORS headers for the app's origin;
between attempts the page is reloaded. The tool may read the local database (`boards`, `templates`) and the runner's
storage inventory by the test driver's non-creating means, read-only. Texts, colours and sizes exactly as interaction
v51. Captures are compared with the approved screens for the new parts at their places; names, counts, sizes and other
board content may differ from the approved screens (V11).

**Files** (made by the check tool): `photo.png` and `poster.png`, two different random-noise PNGs of 280 × 210 pixels
(about 177,000 bytes each); `clip.mp4` (0012-W4's recipe: H.264 with an AAC tone, 640 × 360, 12 s, at least 5,000,000
bytes); `big1.png`, `big2.png`, `big3.png`, three different random-noise PNGs of 9,300,000 ± 50,000 bytes each, at
most 4,096 px a side (together over 20 MiB, and their total rounded up is 27 MiB). **`Offsite plan.nextboard`** is
made by Ana on the candidate's team stack, at 100% zoom with the view as a new board opens: a team board `Offsite
plan`; Media → `photo.png` (it lands selected at the view centre), dragged by its centre to the screen point (220,
260); Media → `poster.png`, dragged to (220, 600); Media → `clip.mp4`, left at the view centre; three stickies with the
Sticky tool at the screen points (1200, 200), (1200, 450) and (1200, 700), each followed by Escape twice; click empty
canvas; Board panel → Save a copy to file (board file version 3). The tool reads each object's on-screen box from the
page wherever a row clicks an object.

| Row | Steps and pass condition |
| --- | --- |
| N9-S1 | Ben on Example team's files page, upload throughput emulated: Import board file…, pick `Offsite plan.nextboard`. The button reads `Importing…`, disabled, and New board is disabled (both `opacity: .45`); the toast (14px, `#29272e`) reads `Importing “Offsite plan.nextboard”… N%` at least twice with N whole and not decreasing and never 100 before the last upload `PUT …/imports/<id>/assets/<hash>` answered; capture ben-importing. No `boards` row with the opened id exists before the finish request is sent. Then the new board opens with nothing selected; its id equals the id the open answered; both pictures draw; Ben clicks the video and presses Play (again if it stops after loading) and it plays; Ben clicks empty canvas; capture imported-ben. Emulation off. Ana's files page lists the board. Mia opens it: both pictures draw, her read-only line shows; she clicks the video and presses Play (again if it stops after loading): it plays; she clicks empty canvas; capture imported-mia. Ana, with upload throughput emulated, imports the same file; capture ana-importing while N < 100; she lets it finish |
| N9-S2 | Ben imports `Offsite plan.nextboard` four times, one route each: `PUT **/imports/*/assets/*` (first match) aborted as a network failure → `Couldn't import “Offsite plan.nextboard”: you are offline.` (capture import-offline); the same held → after 60 s ± 5 s `…: the upload stopped.` (capture import-stalled); `POST **/workspaces/*/boards` answered 400 `{ "error": { "reason": "bad_request" } }` → `…: the server did not accept it.` (capture import-refused); the second `PUT **/imports/*/assets/*` answered 403 `{ "error": { "reason": "role_too_low" } }` → `…: you can no longer add boards here.` (capture import-no-longer). After each: the button reads `Import board file…` again, the workspace's `boards` row count is unchanged and the files list is as before |
| N9-S3 | Ben starts the import with the second `PUT **/imports/*/assets/*` held; once the first answered 201 and the second is held, the tool closes Ben's page. After 75 s: no `boards` row with the opened id, and that id's storage on the stack's runner is erased (no `meta`, `pictures` or `picture_parts` rows). A `PUT` to that import with Ben's token answers 410 `upload_expired`; afterwards the storage is still erased |
| N9-S4 | On the board Ben imported, Ben clicks `photo.png` at its centre, Shift-clicks `poster.png` at its centre and each of the three stickies 10 px inside its top-left corner, opens Templates and chooses Save selection as template: below the source line, `Includes 2 pictures (<s> MiB of the 20 MiB a template can hold).`, `<s>` the two files' bytes per interaction v51, 12 px `#6b6772`; capture tpl-save-dialog. Name `Offsite kit`; upload throughput emulated; Save template: the button reads `Saving… N%` at least twice, N not decreasing, the inputs read-only and both buttons disabled; capture tpl-saving. Then `Saved “Offsite kit” to Example team.` and the card first in the section; capture tpl-saved. Emulation off. Ben then selects only the video and saves it as `Clip kit`. Through the API with Mia's token: the template list holds both; `GET …/templates/<Offsite kit>/assets/<photo hash>` is 200 with the bytes; `POST …/template-uploads` is 403. Mia's board shows no Templates button |
| N9-S5 | Ben makes a team board `Big` (Home › New board), adds `big1.png`, `big2.png`, `big3.png` with Media, presses Cmd+A, opens Templates and chooses Save selection as template: the line reads `Includes 3 pictures (27 MiB of the 20 MiB a template can hold).`, the error line `This is too large for a template. Select fewer objects.` (12 px, `#a32940`), Save template disabled; no `template-uploads` request is sent; capture tpl-too-large |
| N9-S6 | On the imported board, Ben selects the same five objects as N9-S4 and opens Save selection as template four times, naming it `Kit 2`, one route each: `PUT **/template-uploads/*/assets/*` aborted → `Couldn't save the template: you are offline. Try again.` (capture tpl-offline); the same answered 410 `{ "error": { "reason": "upload_expired" } }` → `…: the upload stopped. Try again.` (capture tpl-stalled); `GET **/boards/*/assets/*` aborted (after the sizes request answered) → `…: a picture on this board couldn't be loaded. Try again.` (capture tpl-unloaded); `POST **/workspaces/*/templates` answered 400 `{ "error": { "reason": "bad_request" } }` → `…: the server did not accept it. Try again.` (capture tpl-refused). Each time the dialog stays open with `Kit 2` kept; Ben presses Cancel; the workspace's template count is unchanged |
| N9-S7 | Ana makes a team board `Team test board`; Ana, Ben and Mia open it. Ben, download throughput emulated: Templates → Add template on `Offsite kit`: the panel closes at once; the team toast reads `Adding “Offsite kit”… N%` at least twice, N not decreasing; no board shows a new object while it does; capture add-ben-adding. Then `Added “Offsite kit”: 5 objects.` and the five objects with both pictures, selected; capture add-ben-added (before any click). Within 3 s Ana and Mia see them; capture add-mia-sees. Emulation off. Ben presses Cmd+Z: within 3 s no board shows the five objects. Ana, with download throughput emulated, adds `Offsite kit` on the same board; capture add-ana-adding while N < 100; she lets it finish, then presses Cmd+Z: within 3 s the board is empty again |
| N9-S8 | Ben adds templates on `Team test board` six times, one route each: `PUT **/boards/*/assets/*` aborted → `Could not add “Offsite kit”: you are offline.`; `GET **/templates/*/assets/*` held → after 60 s ± 5 s `…: the upload stopped.`; `PUT **/boards/*/assets/*` answered 409 `{ "error": { "reason": "board_pictures_full" } }` → `…: this board already holds 50 MiB of pictures.`; adding `Clip kit` with its second `PUT **/boards/*/assets/*` (the video) answered 409 `{ "error": { "reason": "board_videos_full" } }` → `Could not add “Clip kit”: this board already holds 100 MiB of videos.`; `GET **/templates/*/assets/*` answered 404 → `…: its pictures could not be loaded.`; `PUT **/boards/*/assets/*` answered 400 → `…: the server did not accept it.` Captures add-offline, add-stalled, add-pictures-full, add-videos-full, add-unloaded, add-refused, each with nothing selected. After each, no board has a new object (each board's export compared before and after) |
| N9-S9 | Ana, on the imported board, selects only `poster.png`, opens Templates, More options on `Offsite kit` → Replace with selection: the confirmation shows `Includes 1 picture (<s> MiB …)` below its paragraph; Replace content: replaced. The `templates.store` value changed and the old store's storage is erased. Delete template on `Offsite kit`: its store's storage is erased. Mia on the files page has no Import board file… button; through the API Mia's `POST …/imports` is 403 |
| N9-S10 | The three Part 2 guide rows changed or added by this brief walked as written, on fresh boards and a fresh source file, with upload and download throughput emulated during each import, save and add so the percentages can be read: each `You should see` holds |

**Baseline (ea4203c).** Each of N9-S1, N9-S2, N9-S3, N9-S4, N9-S6, N9-S7, N9-S8 and N9-S9 fails on the baseline at its
first new assertion (the import is refused with "it holds pictures or videos…", or the dialog shows "Couldn't save the
template. Try again.", or the route answers 404); N9-S5 fails at the picture line; N9-S10 fails at the new row. The
check run records each row's baseline outcome.

## Acceptance criteria

- **0012-W6-AC01:** An owner or editor opens a board file (version 2 or 3, or version 1 without media) holding
  pictures, GIFs or videos into a team workspace. Every picture and video is stored with the new board and draws or
  plays for everyone, viewers included, within the board limits. The import shows its progress and, if it fails, why.
  Look matches the approved mock-up.
- **0012-W6-AC02:** Owners and editors save and replace team templates holding pictures and videos, up to 20 MiB of
  them. Anyone who can edit a team board adds such a template there, and everyone on the board sees its pictures.
  Saving and adding show their progress and every failure's reason; a template over the limit is refused before
  anything uploads.
- **0012-W6-AC03:** Every staging, upload, finish and read step checks the person's role. A failed, abandoned or
  refused import leaves no board, row or stored file behind; a failed save or add leaves no template and no objects.
  Deleting a template removes its pictures.

| Criterion | Evidence that shows it |
| --- | --- |
| 0012-W6-AC01 | N9-S1, N9-S2; S453, S454, S455, S465, S466; V4 |
| 0012-W6-AC02 | N9-S4, N9-S5, N9-S6, N9-S7, N9-S8; S458, S459, S460, S462; V4 |
| 0012-W6-AC03 | N9-S3, N9-S9; S455, S456, S457, S460, S461, S464; V4 |

## Applicable DESIGN.md guardrails

Fail-closed access, independent state owners and the existing notices apply. No new control, focus behaviour or
style; only texts and the Add buttons' `disabled` state change. Interaction v51 states every new word and value; never
infer generic styling.

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

The routes, the room's creation path, the schema and both runners change, so after the build a short server-only run
installs the schema and runs, on the exact candidate, the server checks the Checks workflow does not count (the speed
checks on both runners) plus, on each runner, the `import-full-size` proof (an import of 52,428,800 bytes of pictures
and 104,857,600 bytes of videos, every file read back byte for byte) and a template add of a 20,971,520-byte store; the
counted server suites, `tests/server/imports.test.ts` included, are taken from the Checks workflow run on the exact
candidate commit (V9). The check run starts the team stack on its own uniquely owned local Supabase project. Record
each long run's start and end and the host's sleep and wake events; a run that overlapped a sleep is INVALID and is
rerun awake. Three manual checks from this milestone are chosen only at Review.

| Check | Command/inspection and pass condition |
| --- | --- |
| V1 | Byte-compare manifests, locks, dependency inventory and runtime notices against the prerequisite base: unchanged, no new dependency |
| V2 | `npm ci --ignore-scripts --no-audit --no-fund` exits 0 on the clean candidate and on the independent baseline |
| V3 | `npm run typecheck` exits 0 across all five workspace members |
| V4 | `npm test` full suite exits 0. The new unit files prove each group below. Guards as web modules v49 |
| V5 | Team-off `npm run build` and `npm run audit:licenses` exit 0; notices equal runtime notices v1 (team off) |
| V6 | `npm run build:fixtures`, team-on `npm run build` and `audit:licenses` exit 0; team-on notices equal runtime notices v3 |
| V7 | `npm run build:server`, `audit:licenses` and the wrangler dry run exit 0, the dry run listing the `TEMPLATE_MEDIA` binding; no deploy |
| V8 | Inspect all hunks plus `git diff --name-status` and `git diff --check` over `<prerequisite-base>..<validated-source>`: only the deliverables, the dispositions and the append-only Implementation record; `apps/web/src/App.tsx`, `apps/web/style.css`, `ui/palette.tsx`, every scene and screen part and every state hook but `use-editing-commands.ts` byte-identical to the base, and that file differing only by the one property; `wrangler.json` only by the binding and the `v2` migration; the SQL file only by hosted persistence v13's four changes; no `arrayBuffer()`, `bytes()`, `text()` or `json()` on an import's video body (named in the record with file and line) |
| V9 | The Checks workflow's server suites (Node and workerd) pass on the exact candidate commit, S453–S466 included; the server-only run passes the uncounted speed checks, `import-full-size` and the 20 MiB template add on both runners |
| V10 | N9-S1–N9-S10 pass with the state captures and raw receipts, and the baseline outcomes are recorded |
| V11 | Design, one receipt per approved screen: home-ben-importing ↔ ben-importing, home-ana-importing ↔ ana-importing, imported-ben-board ↔ imported-ben, imported-mia-board ↔ imported-mia (N9-S1); home-ben-import-offline, -stalled, -refused, -no-longer ↔ the N9-S2 captures; tpl-ben-save-dialog, tpl-ben-saving, tpl-ben-saved ↔ tpl-save-dialog, tpl-saving, tpl-saved (N9-S4); tpl-ben-save-too-large ↔ tpl-too-large (N9-S5); tpl-ben-save-offline, -stalled, -unloaded, -refused ↔ the N9-S6 captures; add-ben-adding, add-ana-adding, add-ben-added, add-mia-sees ↔ the N9-S7 captures; add-ben-offline, -stalled, -pictures-full, -videos-full, -unloaded, -refused ↔ the N9-S8 captures. The reviewer compares the new parts' texts' form, places and looks with the approved design; names, counts and sizes may differ |
| V12 | Once, on an independent ea4203c source and build with the candidate's new unit files and `tests/server/imports.test.ts` copied in, and a test-only copy of both vitest configs whose `include` lists add `tests/server/imports.test.ts` (nothing else changed): every check that proves new behaviour fails by name (S453–S462, S464–S466 and every X9 check except X9-U00) and the new browser rows fail as "Baseline" says; a top-level setup or import abort does not count. The compatibility checks are separate named checks, so no earlier failure can stop them: **S463** and **X9-U00**; they pass on both revisions |
| V13 | Accepted A–J compare: baseline twice, then candidate and diffs, with existing normalization; no difference |
| V14 | Accepted regression runs: the full unit suite (V4), the server suites (V9), A–J (V13), the 0006-W1 scenario X1, the 0008-W2 scenario T8, the 0012-W3 scenario N7 and the 0012-W4 scenario N8 on the candidate, read with the dispositions above. Any row that also fails on ea4203c is a baseline finding |

**Server checks** in `tests/server/imports.test.ts`, each on both runners, named `S453` onwards. Self-host runner
v10's named proofs belong to these checks: S453 `import-roundtrip`; S454 `import-budgets`; S455 `import-missing`; S456
`import-other-person`, `import-demoted`, `import-workspace`; S457 `import-idle-drop`; S458 `template-media-roundtrip`;
S459 `template-media-limit`; S460 `template-media-replace-delete`, `template-media-refused-save`; S461
`template-media-idle-drop`; S462 `asset-sizes`; S465 `import-claim`; S466 `import-gate`. `import-full-size` belongs to
the server-only run.
- **S453** an import of a PNG picture, a JPEG first frame and an MP4 video, whose document holds an image (the PNG)
  and a video (the MP4 with the JPEG as `poster`): open 201 `{import}`; three `PUT`s 201; one repeated `PUT` 200;
  finish 201 for a document whose `boardId` and `title` differ from the finish's (its page ids kept). The board's id is
  the import id, its row and lifecycle row exist, `GET /boards/:b/assets/:hash` serves all three files byte for byte to
  its owner, an editor and a viewer; the board's export equals `canonical({ ...document, boardId: <import id>, title
  })`, page ids preserved.
- **S454** open refuses: a list of 0 or 1,001 entries, a repeated hash, a bad type or byte count (400); pictures
  summing 52,428,801 bytes (409 `board_pictures_full`); videos summing 104,857,601 (409 `board_videos_full`). An upload
  of a hash not in the list, or with another type or byte count, is 400 `bad_request` and stores nothing.
- **S455** a finish whose document names a hash that was not uploaded is 400 `asset_missing`; no `boards` row with that
  id exists and the import still accepts uploads and a later correct finish (201); a finish whose `poster` is held as a
  PNG is 400 `asset_missing`. A finish with `import` for an id never opened is 410 `upload_expired`, and that id's
  storage is erased afterwards.
- **S456** another editor's upload or finish to Ana's import is 403 `role_too_low`; a workspace viewer's and a workspace
  guest's open are 403 with `needed: "editor"`; a non-member's 404; a second `begin` while an upload holds the lease is
  409 `upload_in_progress`; Ben made a viewer between his last upload and his finish is refused 403 and
  no row exists; an opener who edits two workspaces using the other workspace's routes gets 410.
- **S457** an import opened, given one upload and left: once the check has waited 75,000 ms, the room's storage is
  erased and no row exists; a further `PUT` or finish answers 410 `upload_expired`, and the storage is still erased.
- **S458** a template upload of a PNG, a JPEG first frame and an MP4, then a save with `upload` whose objects are an
  image and a video naming them: 201; the detail `GET` has `media` with the three entries sorted by hash; the asset
  route serves each byte for byte to an owner, editor and viewer, 403 to a guest, 404 for an unknown hash; a save
  whose objects name a hash not uploaded is 400 `asset_missing` and its store is erased; a save with media and no
  `upload` is 400 `bad_request`, and so is a save with `upload` whose objects hold no media (that upload still
  commits afterwards); a second save with the same `upload` is 410, after which the first template's files still read
  back byte for byte.
- **S459** an open summing 20,971,521 bytes is 413 `template_too_large`; one of exactly 20,971,520 bytes (PNGs of
  random pixels) stores, commits and reads back exactly; an upload body of 20,971,521 bytes is 413 `body_too_large`.
- **S460** replace with a new `upload`: the detail's `media` is the new store's and the old store is erased; replace
  with a media-free selection (no `upload`): `media` is `[]` and the store is erased; delete: 204 and the store erased;
  a save refused by the 25-template limit (409 `template_limit`) erases its store.
- **S461** a template upload opened and left 75,000 ms is erased; its upload id then answers 410.
- **S462** `POST /boards/:b/asset-sizes` answers each held hash's entry in request order and leaves out the others, for
  a viewer too; a non-member 404; 1,001 hashes 400.
- **S463** compatibility (V12): a board create without `import` holding an image, and one holding a valid video, are
  400 `images_not_supported`; a template save without `upload` holding an image, and one holding a valid video, are
  400 `bad_request`; a create without media succeeds as today. It passes on ea4203c too.
- **S464** schema: after the file has been applied twice, `pg_proc` holds exactly one `create_board`, with the four
  arguments `(uuid, uuid, text, uuid)`, one `save_template` and one `replace_template` each ending in `store uuid`, one
  `discard_import(uuid, uuid)`, and one each of `delete_template`, `get_template` and `list_templates`; the column
  `templates.store` exists; `create_board` called through PostgREST with the named argument `board` creates a row with
  that id, and with three named arguments creates a board as today; `list_templates` never carries `store`.
- **S465** two finishes of one import sent together: one 201, the other 409 `import_in_progress`; a third after the
  201 is 409; exactly one row. A finish whose `create_board` reply is lost (the test proxy's `failAfter`) answers 503
  and leaves no row and no room; a finish whose `create_board` the proxy delays past the server's RPC timeout answers
  503, and once the delayed call has ended no row with that id exists (the tombstone refused it) and no room remains.
- **S466** while a room is importing, both before and after a board row with its id exists (the check claims the import
  through the room and inserts the row through the RPC, then probes before calling `create`): its socket join answers
  401; `GET /boards/:id/assets/:hash`, `/boards/:id/export`, its versions and the operator backup answer 404; none
  writes `storage_version` (inventory read); the `create` then succeeds.

**Unit checks**, named `X9-U00` onwards across the new unit files:
- `tests/team-media.test.mjs`: **X9-U00** (compatibility: a team import of a file without media sends today's single
  request with today's body) and the groups web modules v49 lists, with interaction v51's preflight reasons, the 99 %
  cap, the stall precedence and every reason row.
- `tests/room-imports.test.mjs`: the importing state on a Node SQLite fixture with runner v9's fake clock:
  `openImport` refusing a loaded or importing room; begin and end; staging a picture and a video (chunks) with the
  opener, a stranger (403), another workspace (410), an undeclared hash and a wrong size (400); `claimImport` (one
  claim at a time, `asset_missing` keeping the staging) and `releaseImport`; `create(document, importer, token)`
  keeping the rows, setting `uploaded_at`, removing `meta.import`, refusing a wrong importer or token; the gate on every
  other room method without writing `storage_version`; `schedule()` arming only the staging deadline; `alarm()`
  answering `{ discard: true }` only at the deadline and invalidating uploads with 410; the lease and the claim holding the deadline
  off; an unknown id answering 410 with discard; `TemplateStore` open, begin, stage, commit (one use, no expiry
  after), inventory, read, the 20 MiB sum, idle discard in staging only.
- **Amendment A1 (2026-11-25), `tests/room-imports.test.mjs`:** with fake access and clock, an expired claim calls
  `discardImport(id, workspace)` once before discard. A throwing call leaves the gate in place, makes begin,
  stage, claim and create refuse 410, and re-arms 60,000 ms later; the next successful alarm discards the staging.
  An absent method also keeps and re-arms the staging. Released and never-claimed stagings expire without an RPC.
  A promoted room has no finish mark.

A regression failure that also fails on ea4203c is a baseline finding to report, never fixed here.

## Review focus and public references

Review that:
- no `boards` row is ever inserted for an import before `claimImport` passed; a failed finish removes the row and the
  staged room together, and a refused one removes nothing that another finish owns;
- no entry point loads, backs up, joins or serves an importing room, and its staged files become the board's only at
  `create`;
- an import or template upload can be written only by its opener, in its workspace, with a current editor or owner
  role, at every step;
- stagings are erased after their deadline on both runners, cold or reopened, and probes leave nothing; committed
  template stores are erased on replace and delete;
- the add inserts objects only after every file is on the board; a failure inserts nothing;
- the schema file stays repeatable and leaves no function overload behind;
- App.tsx, style.css and every part and hook but the one property are unchanged.

Left for the check run and review after the second pre-commit read (the read cap): whether the workerd test driver can
claim an import and insert its row between `claimImport` and `create` (S466) and drop the Node room cache (S457)
without new driver actions beyond the listed driver files; whether `BoardRoom`'s recovery-free dispatch for stagings
needs any change to `RestoreFence`; the delayed-insert proxy timing in S465; and whether decoding pictures before
staging matches the local open path's reason for every damaged picture.

The public source basis is main ea4203c and the linked versioned contracts, read 2026-11-25. Outside facts relied on:
Cloudflare's published limits (an isolate's memory 128 MB, request bodies up to 100 MB on Free and Pro zones, a
Durable Object holds up to 10 GB, Durable Object alarms run at least once). No unresolved product decision is
delegated to implementation.

## Exclusions and reasons

- A Cancel control, parallel uploads and resuming an import: the import is seconds long for most boards.
- Template stores in the operator backup: pre-launch; a later change.
- A start-up sweep of staging files left by a stopped Node runner, and stores orphaned by an unknown SQL outcome, a
  failed removal or a deleted workspace: unreachable, bounded, pre-launch (hosted persistence v13, "Known limits").
- Single-user templates with pictures; link previews; the template preview drawing pictures.
- Repairs to separately tracked baseline failures.

## Implementation record

(Append-only; the implementer adds its source validation here.)
