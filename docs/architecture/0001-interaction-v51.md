# 0001 — Interaction

Contract version: 51 (for 0012-W6 brief v1, 2026-11-25). Status: Draft. When accepted it replaces
[interaction v50](0001-interaction-v50.md) for later work. Uses [document v21](0001-document-v21.md),
[board file v5](0006-board-file-v5.md), [API v15](0003-api-v15.md), [hosted storage v15](0003-hosted-storage-v15.md),
[team templates v3](0008-team-templates-v3.md) and [board lifecycle v8](0006-board-lifecycle-v8.md); its modules are
[web modules v49](0001-web-modules-v49.md).

Every rule in v50 (and, through it, v49 back to v4 and the 0001-W3 presentation) still applies except where this
version replaces or adds to it. This version lets **team** workspaces take board files and templates that hold
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

## Terms

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

## Importing a board file (team workspace)

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

## Saving a template (team board)

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

## Adding a template (team board)

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

## Roles

Viewers see no new control and none of these notices: they have no Import board file… button and no Templates button
on a team board (as today), so they never save or add. A board guest with an editor grant keeps today's Templates
panel with its Activities and no team section (team templates need workspace membership); nothing changes for them.
Adding a team template needs both: reading the workspace's templates and editing the board. What a viewer sees changes only in that an
imported board and an added template carry their pictures and videos, which draw and play for them as on any team
board.

## Accessibility

The toasts, the dialog's lines and the buttons keep their existing elements, roles and attributes; only their text and
the Add buttons' `disabled` change. No focus moves.

## Not in this version

A Cancel control; parallel uploads; resuming an import; template pictures in single-user mode; the template preview
drawing pictures (it keeps drawing them as outlined boxes); link previews.
