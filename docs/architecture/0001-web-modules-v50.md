# 0001 — Web app modules

Note version: 50 (for 0012-W5 brief v1, 2026-11-25). Status: Draft.
Replaces [web modules v49](0001-web-modules-v49.md), whose registry, import, composition, one-state-owner, team
guards, counts, seams, CSS and App.tsx rules remain word for word except as below. v49's own text follows as the part
**Team media transfers (v49)**, word for word with its headings one level lower.
[Interaction v52](0001-interaction-v52.md) adds link cards with **five new web source modules** (a rules module, a
client, a scene part, a screen part and a state hook). **App.tsx changes only by its wiring points** (below), on
existing lines, so its line count and budget stay; `style.css` gains **two rules** (the link controls' block).

## Change note (v49 → v50)

- New part **Link cards (v50)**: the five modules and their exported names, the changed web files, App.tsx's exact
  substitutions, the two CSS rules, the arrival's gate and commit path (one retry on a matched refusal), the bounds
  helper, the face drawn inside the stored rectangle, Save a copy's cold-cache thumbnail, the new hook's effects, the
  guards and counts, and the tests.
- Counts: 29 state hooks, 22 scene parts, 35 screen parts, the rules package's 18 files and 13 object-type modules;
  57 team modules (unchanged).
- Nothing else in v49 changes.

## Team media transfers (v49)

Replaces [web modules v48](0001-web-modules-v48.md), whose registry, import, composition, one-state-owner, team
guards, counts, seams, CSS and App.tsx rules remain word for word except as below.
[Interaction v51](0001-interaction-v51.md) lets team imports and team templates carry pictures and videos with
exactly **one new web source module**, a team module. **App.tsx does not change. No state hook, scene part, screen
part, CSS rule or effect is added**; one existing hook and one type gain a single property (below).

### New module

`apps/web/src/team/media-transfer.ts` (header `// SPDX-License-Identifier: Apache-2.0`): every new request of
[hosted storage v15](0003-hosted-storage-v15.md) ("Web client transfers") and these pure helpers:

| Export | What |
| --- | --- |
| `mediaOf(objects, held?)` | The media files of an object array in media order (interaction v51, Terms): `{ hash, kind: "picture" \| "video" }[]`, each hash once |
| `percent(done, total)` | `Math.floor(done × 100 ÷ total)`, clamped to 0–100; `0` when `total` is 0 |
| `Progress` | A small class over a total byte count that keeps the highest `percent` reported (never decreasing) |
| `watchdog(ms, onStall)` | A restartable no-progress timer (`setTimeout`) with `poke()` and `stop()` |
| `runImport(…)`, `runTemplateSave(…)`, `runTemplateAdd(…)` | The three sequences of interaction v51, one file at a time, each taking its transfer calls as parameters (so tests pass doubles) and reporting `(percent)` and ending with `{ ok: true, … }` or `{ ok: false, reason }`, `reason` the exact interaction v51 text |
| `templateAdds(hosted)` | The board-lifetime add runner: one per `HostedBoard` object (a module-level `WeakMap`), so an add outlives the Templates panel that started it. It holds `adding` (read by every mounted panel; a change calls its listeners) and runs `runTemplateAdd`, sending the toast through `hosted.toast` |

It imports only `./api`, `./auth`, `./config`, `./pictures.ts`, `./templates-rules.ts`, `../board-file.ts` and
`nextphase-board-rules/*` (types aside). It holds no React.

### Changed web files

| File | Change |
| --- | --- |
| `apps/web/src/team/import.ts` | `PICTURES_REASON` and the media refusal are removed. `importBoard(file, send)` keeps its signature and its no-media path word for word; for a file with media it returns, before sending, the board, the title and the bundle's pictures and videos as `media` (each `{ hash, type, bytes, blob }`), and refuses with board file v5's existing budget reasons. Its imports stay `../board-file.ts` and `nextphase-board-rules/*` only (the existing guard) |
| `apps/web/src/team/home-import.tsx` | For a file with media: `runImport` with the progress text `Importing “<file>”… <p>%` through the existing `notify(text, true)`; failures through today's `notify(…, false)` frame with interaction v51's reasons. The import is bound to the component's lifetime: its unmount (the existing `alive` flag's effect) aborts every transfer through one `AbortController`, and the finish is never sent after it. No-media path unchanged |
| `apps/web/src/team/templates-rules.ts` | `templateBoard` no longer throws for valid image and video objects (every other check, and the size check, unchanged); new pure `pictureLine(counts, bytes)` and `mib(bytes)` / `mibUp(bytes)` (interaction v51); `TEMPLATE_MEDIA_BYTES = 20_971_520`; `parseTemplate` unchanged (list and mutation answers keep their exact keys) and a new `parseTemplateDetail(value)` accepting exactly those keys plus `media` (an array of asset entries, each validated, sorted by hash). Still no React and no `./auth` import (the existing rules-file guard) |
| `apps/web/src/team/templates.ts` | The controller's save and replace take the media list and run `runTemplateSave`; its `pending` state carries the percentage; its error text follows interaction v51 for media saves (today's texts unchanged otherwise); `read` parses the detail with `parseTemplateDetail` and returns it (so it now carries `media`); Add decides on the **fresh** detail: with media it goes to `templateAdds(hosted)`, which calls today's `commands.insertStored` only on success; a template without media is added exactly as today (T8-S13's stale-card refresh unchanged) |
| `apps/web/src/team/templates-section.tsx` | The save and replace dialogs' picture line, the sizes request on open, `Saving… <p>%` / `Replacing… <p>%`, the error line's new texts; Add of a template with media calls `commands.closeTemplates()` and then starts `templateAdds(hosted)`; every card's Add is also disabled while `templateAdds(hosted).adding` |
| `apps/web/src/team/pictures.ts` | `upload`, `uploadVideo` and `download` gain an optional last `signal?: AbortSignal` (hosted storage v15); nothing else changes |
| `apps/web/src/activities.ts` | `TemplateCommands` gains `closeTemplates: () => void` (type only) |
| `apps/web/src/state/use-editing-commands.ts` | `templateCommands` gains `closeTemplates: () => setPanel("")`; nothing else changes (its effect count and imports unchanged) |

`apps/web/src/team/hosted-board.ts`, `home.tsx`, `team-app.tsx`, `ui/palette.tsx`, every other state hook, `App.tsx` and
`style.css` **do not change**. The add's progress uses the existing `hosted.toast(text)`; because the team toast
hides 5,000 ms after its last change, `runTemplateAdd` re-sends the current text at least every 2,000 ms while it
runs.

### Counts and guards

From v48: **57 team modules** (`media-transfer.ts` added); 28 state hooks, 21 scene parts, 34 screen parts, the
rules package's 17 files and 12 object-type modules, the board-sync list and every effect count unchanged. In
`tests/modules.test.mjs` the team-module test lists `media-transfer.ts` in sorted order and its title says "through
0012-W6 v1"; the `import.ts` import guard and the rules-style list are unchanged and must pass. The "0012-W4 App
composition" test is unchanged and must pass (App.tsx is byte-identical to `ea4203c`).

### Tests

New unit file `tests/team-media.test.mjs` (`npm test`): `mediaOf` order and kinds; `percent` and `Progress`
(rounding down, never decreasing, the add's half-and-half count); `watchdog` with a fake timer; `pictureLine` and
`mib`/`mibUp` texts (`Includes 1 picture (0.3 MiB …)`, `Includes 2 pictures and 1 video (…)`, `27 MiB` rounding
up); `importBoard` returning media for versions 2 and 3 and refusing over-budget files with the board file v5
reasons; each sequence with transfer doubles: every success and failure answer mapped to its exact text, one file at
a time, nothing finished, saved or inserted after a failure, the add's insert called once only after every upload
answered `ok`; a valid image object accepted by `templateBoard` and refused by `templateObjects(value)` without
`held`; `parseTemplateDetail` (the `media` key accepted only there); `templateAdds` outliving a panel and its `adding`
flag. Existing files updated as listed in the brief's dispositions.

## Link cards (v50)

### New modules

Each begins with `// SPDX-License-Identifier: Apache-2.0`. Every value they hold is interaction v52's.

**`apps/web/src/link-cards.ts`** — a rules module: no React, Konva or `react-dom` import, no value import from
`team/`, and it names object types only through the registry (`isLink`, `linkType()`, `typeForTool("Text")`), as the
existing rules-module guards require. It owns the paste test, the sizes, the looks, the card's states and texts, the
history amendment and the thumbnail.

| Export | What |
| --- | --- |
| `LINK_LOADING_MS` | `20_000`: the stale rule |
| `LINK_REQUEST_MS` | `15_000`: the request's abort |
| `LINK_ADDRESS_LIMIT` | `1_000`: the longest address the paste test accepts |
| `LINK_SIZES` | `{ loading: [306, 288], horizontal: [480, 114], titleVertical: [306, 100], titleHorizontal: [480, 64], linkOnly: [480, 64] }`; the vertical width `306` (the sizes a browser writes) |
| `CARD_SIZES` | The nine card sizes document v22 accepts with any state (the union), for the tests |
| `keepInBounds(rect)` | `rect` with `x` and `y` kept within the document bounds (interaction v52 **Document bounds**): `x = min(max(x, −1e6), 1e6 − width)`, the same for `y`; unchanged when already within |
| `faceLayout(look, width, height, lines?)` | Every part's box for a look's face drawn inside a stored rectangle of `width × height` (interaction v52 **Drawing at the stored size**); at the look's written size it equals `LINK_LOOK`'s values |
| `LINK_LOOK` | Every drawing value of interaction v52's looks table and common rules (colours, fonts, line heights, offsets, box widths, the glyph's two path strings), read by the scene part and the tests |
| `type LinkLook` | `"loading" \| "vertical" \| "horizontal" \| "titleVertical" \| "titleHorizontal" \| "linkOnly"` |
| `pastedAddress(text)` | Interaction v52 paste test step 4, the address rules and the `href` length: `{ kind: "card", url }` (the parsed `href`, only when the rules pass and `href.length <= 1000`), `{ kind: "text", text }` (the trimmed text, for a refused address or one whose `href` is longer than 1,000 characters) or `null` (not one address: today's path) |
| `addressAllowed(url: URL)` | Link preview v1's F1–F2 on a parsed URL |
| `linkLook(card, now)` | The card's look, the stale rule included |
| `verticalHeight(titleLines, descriptionLines)` | `210 + 20·Lt + (Ld > 0 ? 4 + 17·Ld : 0)` |
| `cardLines(card)` | `{ title, description }` read back from a vertical card's saved height (the inverse of `verticalHeight`); `{ title: 2, description: 2 }` for any other height. These are **caps** on the lines drawn, never a count to fill |
| `cardSize(look, lines?)` | `{ width, height }` of a look (`lines` for vertical) |
| `pasteCard(board, url, centre, page, now, service)` | `{ board, id }`: the new loading card (or, with `service` false, the link-only card) at the view centre, kept within the document bounds, in the section under its centre |
| `pasteText(board, text, centre, page, height)` | `{ board, id }`: the refused address's text object (interaction v52), kept within the document bounds |
| `type LinkResult` | `{ title: string; description: string; site: string; asset?: string } \| null` (`null`: the link-only finish) |
| `LINK_FINISH_KEYS` | `["title", "description", "site", "asset", "state", "layout", "width", "height"]`: the keys a finish sets |
| `finishCard(card, result, lines?)` | The finished card, built from `card` **as the board holds it at the commit**: ready (texts cut to 300/500/100 code points, `site` falling back to the host) or link-only, at its new size; it changes only `LINK_FINISH_KEYS`, and `x` and `y` only through `keepInBounds` |
| `withLayout(card, layout, lines?)` | The card with a new `layout` and that look's size, its `x` and `y` kept except through `keepInBounds` |
| `cardToText(board, id, height)` | `{ board, id }`: Change back to text, the text object in the card's place, kept within the document bounds |
| `amendHistory(history, card)` | A `History` (from `./history.ts`, type only) in which every version of that card (each `before` and `after` with the card's `id`, `url` and `requestedAt`), past and future, takes the card's `LINK_FINISH_KEYS` values and keeps its own `x`, `y` (through `keepInBounds` at its new size) and every other key, so a move recorded while the card loaded keeps both positions |
| `thumbnailSize(width, height)` | `{ width, height }`: at most 640 on the longer side, never enlarged |
| `makeThumbnail(bytes)` | `Promise<{ hash, picture } \| null>`: sniff, decode (a GIF's first frame), scale, PNG if any alpha below 255 else JPEG 0.85, SHA-256; `null` when it cannot. It takes optional `decode` and `encode` functions so unit tests run without a browser |
| `LINK_ABOUT_LOCAL`, `LINK_ABOUT_TEAM` | The two About texts, exactly |
| `aboutLine(hosted, service)` | `LINK_ABOUT_TEAM` on a team board, `LINK_ABOUT_LOCAL` with a service, else `""` |
| `type LinkBar` | The bar model: `{ only: boolean; count: number; look?: LinkLook; layout?: "vertical" \| "horizontal"; open(): void; setLayout(layout): void; toText(): void }` |

It imports only `nextphase-board-rules/*`, `./image-assets.ts`, `./sections.ts`, `./geometry.ts` and `./history.ts`
(types).

**`apps/web/src/link-preview-client.ts`** — the public route's client and the answer reader both routes share. No
React; no value import from `team/`.

| Export | What |
| --- | --- |
| `type LinkPreview` | `{ url: string; title: string; description: string; site: string; picture: { type: string; bytes: ArrayBuffer } \| null }` |
| `previewOrigin()` | The build's link preview origin: `typeof BOARD_LINK_PREVIEW_URL === "string" ? BOARD_LINK_PREVIEW_URL : ""` (toolchain v6's compile-time constant, `null` when unset; unit tests run without it) |
| `previewConfigured()` | `previewOrigin() !== ""` |
| `previewRequest(url, signal)` | The `RequestInit` both routes send: `POST`, body `JSON.stringify({ url })`, `Content-Type: application/json`, `credentials: "omit"`, `referrerPolicy: "no-referrer"`, `cache: "no-store"`, the signal |
| `readLinkPreview(reply)` | `Promise<LinkPreview \| null>`: a preview only for a 200 with a well-formed body (API v16), `bytes` decoded from base64 and at most 5,242,880; otherwise `null` |
| `requestLinkPreview(url, signal)` | The public route: `fetch(previewOrigin() + "/link-preview", previewRequest(url, signal))` through `readLinkPreview`; `null` when no service is configured, on any error and on abort |

**`apps/web/src/scene/link-body.tsx`** — `LinkBody({ object, bitmap, selected, zoom })`: draws one card in its look
(`linkLook(object, Date.now())`), its face laid out by `faceLayout(look, object.width, object.height,
cardLines(object))` inside the card's **stored rectangle** (which is also its hit area and outline), with
`react-konva` (`Group`, `Rect`, `Image`, `Text`, `Path`, `Circle`, `Arc`), the
picture cover-cropped through `Image`'s `crop` and clipped to the inner box (interaction v52: 1, 1, `width − 2` ×
`height − 2`, radius 7), every part at interaction v52's inside-the-border offsets, the 1-unit border stroked last,
texts with Konva's `wrap: "word"` and `ellipsis: true`, the site's and address's underline as its own 1-unit `Rect`
2 units below the alphabetic baseline (never Konva's `textDecoration`), and the selection outline (`stroke="#518de0"`, `strokeWidth={2 / zoom}`) as `ImageBody` draws a picture's. Like every scene
part it holds no hook or state, and it imports React only for types. It imports only `react-konva`,
`nextphase-board-rules/*` and `../link-cards`.

**`apps/web/src/ui/link-controls.tsx`** — `LinkControls({ bar, reason })`: the link bar's label, divider, Open link,
the `<span class="link-layout" role="group" aria-label="Link layout">` holding the two layout buttons, and Change
back to text, returned as a fragment so each is a direct child of `.context` except the two grouped buttons, with their inline SVG icons, labels, tooltips, `aria-pressed`,
`disabled` and `aria-describedby` exactly as interaction v52. No hook or state; it imports `type LinkBar` from
`../link-cards`.

**`apps/web/src/state/use-link-cards.ts`** — `useLinkCards(input: LinkCardsInput)`, returning
`{ paste, bar, aboutLine }`:

| Returned | What |
| --- | --- |
| `paste(next)` | The link step: wraps the next paste handler and passes the event to it untouched unless it acts (interaction v52) |
| `bar` | The `LinkBar` for the current selection |
| `aboutLine` | `aboutLine(!!hosted, previewConfigured())` |

`LinkCardsInput` is `{ hosted?: HostedBoard; page: string; board; model; commit; select; selected;
commandReason: string; tidyOpen: boolean; busy: boolean; composing: boolean; readOnly: boolean; editing: () =>
boolean; ownCopy: (text: string) => boolean; historyRef; updateHistory; lineCount; getView: () => View; scene;
getStore: () => LocalStore | null; isAlive: () => boolean }`. It owns the arrivals: one record per card it pasted (keyed by card id and
`requestedAt`, in a ref) holding its `AbortController`, its **opening** (the board's `boardId`, the `hosted` object,
and on a single-user board `getStore()`'s object) and its state (running, held, committed or ended). It measures `Lt`
and `Ld` with `Konva.Text` (`textArr.length`) in interaction v52's fonts and widths, as `use-object-layouts.ts`
measures text, and a text object's height with the passed `lineCount` and `savedHeight`. It asks the team route only
through `hosted.pictures.linkPreview(url, signal)` and uploads only through the existing
`hosted.pictures.upload(hash, bytes, signal)`; single-user boards ask through `requestLinkPreview` and store with the
existing `storePicture` and `tabPictures`.

**The gate, checks and holds** (interaction v52 **The arrival**). Before the upload and again before the finish's
commit it cancels the arrival (aborts, writes nothing) unless all of these hold: `isAlive()`; `board.boardId` equals
the opening's; `hosted` is the opening's object (both `undefined` on a single-user board); on a single-user board,
`getStore()` is the opening's object, `getStore().active` is true and `readOnly` is false (the active local writer);
on a team board, `hosted.snapshot.role` is `"owner"` or `"editor"`; and `model.current` holds a card with the
arrival's `id`, `url` and `requestedAt` in `state: "loading"`. On a team board, while `hosted.history.previewing` is
true (the board shown is a version preview, not the live document) the arrival holds at the gate; once
`Date.now() ≥ requestedAt + 15,000` with the preview still shown, it is cancelled. It holds a finish while `busy`,
`composing`, `editing()`, `tidyOpen` or `commandReason !== ""`, or, on a team board, while `!hosted.canEdit` (on a
single-user board a `readOnly` board cancels instead, above). On a single-user board it counts the picture budget
again at the finish (`boardPictures` of the board as it is then, plus the thumbnail, each hash once, against
`PICTURE_LIMIT`) and finishes without a picture when over.

**Commit path.** The finish is `finishCard` of the card read from `model.current` at the commit (so its `x` and `y`
are the board's then). On a single-user board it commits a finish with `commit(next)` (not recorded), then
`updateHistory(amendHistory(historyRef.current, card))`. On a team board it commits the finish with
`commit(next, false, undefined, undefined, undefined, undefined, card.id)`: the arrival option below, which ends in
`SharedUndo.amend` (sync v18) and is written as one update. On a team board it follows sync v18's **One retry**:
when `hosted.arrivalRefused(card.id)` answers `true` (the arrival's request was refused, synchronously or by the
room), it makes the link-only finish once by the same path, when the gate passes, the holds clear and the card is
still `loading` with the same `id`, `url` and `requestedAt`; after that it writes nothing more for that card.

**Change back to text** commits `cardToText`, selects the text object and then calls `scene.current?.focus()` (as the
Delete command returns focus), so an immediate Cmd/Ctrl+Z reaches `<main>`'s key handler.

It imports `react`, `konva`, `../link-cards`, `../link-preview-client`, `../image-assets`, `../table-csv`
(`isCanvasPasteTarget`), `../geometry` and types only from `../team/hosted-board`, `../history`, `../storage` and
`../view`; never another state hook.

**The arrival option** (the only path from the hook to `SharedUndo.amend`; every existing call keeps today's
behaviour because the new parameter is optional and last):

| File | Change |
| --- | --- |
| `apps/web/src/state/use-board-document.ts` | `commit(input, recordObject = false, orderIds?, opens?, movedPages?, tableHint?, arrivalOf?: string)`. With `arrivalOf` it records nothing locally, uses no group (neither `nameGroup` nor a text session's), leaves `pendingAdd` as it is, and calls `apply(next, undefined, movedPages, tableHint, arrivalOf)`; `apply` gains the same optional last parameter and passes it as `hosted.edit(next, group, movedPages, stepPage.current, tableHint, arrivalOf)`. On a single-user board `arrivalOf` changes nothing. Without it, `commit` and `apply` are unchanged |
| `apps/web/src/team/hosted-board.ts` | `edit(board, group?, movedPages?, page?, tableHint?, arrivalOf?: string)` passes `arrivalOf` to `session.edit` through the existing `deliberate`; its result is exactly today's (`false` when not admitted, else `deliberate`'s). In `changed`, a `refused` event whose `requestId` names a request in `session.requests` with `arrivalOf` (so a synchronous refusal, reported before `edit` returns, is matched too) runs today's refusal branch without the toast: `this.spotlight.clear(); this.clearPresence(); this.publish({ connected: false })` (no `words.refusedEdit`), and notes the card id in a private set. New `arrivalRefused(id): boolean` answers `true` once for a noted id and removes it (sync v18). Every other event is unchanged |
| `packages/board-sync/src/session.ts` | `Request` gains `arrivalOf?: string`. `edit(board, group?, movedPages?, page?, tableHint?, arrivalOf?: string)` passes it to `write(board, undefined, group, movedPages, page, tableHint, arrivalOf)`; `write` calls `this.history.amend(before, capture(this.doc), arrivalOf)` instead of `this.history.record(…)` when `arrivalOf` is set, and passes it to `sendEdit(update, group?, touched?, arrivalOf?)`, which sets it on the request object when it creates it, before storing it, the size check and `sendRequest` (sync v18). Otherwise unchanged; `undo`/`redo` never pass it |
| `packages/board-sync/src/undo.ts` | `SharedUndo.amend`, as sync v18 states |

**Effects.** Exactly **two** passive effects and no layout effect: (1) the lifetime effect, which aborts every
running arrival on unmount and on `pagehide`; (2) an effect after every render that makes held finishes when the
holds above have cleared (and the refused-arrival link-only finish), and arms one `setTimeout` for the next
`requestedAt + 20,000` among the board's loading cards (its firing re-renders, so every browser redraws a card that
turns stale, and the paster's browser makes the deadline's link-only finish). It never writes a card it did not paste.

### Changed web files

Exactly these web files change, each only as stated (with the five new modules above and, outside `apps/web`, the
board-sync files of sync v18). This is the list the brief carries.

| File | Change |
| --- | --- |
| `apps/web/src/App.tsx` | Wiring only, by the substitutions below |
| `apps/web/src/clipboard.ts` | `plainText(snapshot)` also gives a card's `url` as its text (so a copied card is Board's own copy and pastes as a card) |
| `apps/web/src/board-file.ts` | As board file v6: a card's `asset` is carried and checked as a picture; schema 16 read |
| `apps/web/src/storage.ts` | As storage v5: the board list's `newer` test in `refreshList` becomes `schemaVersion > 16` (today `> 15`). Reading is unchanged: `decode` already accepts whatever document v22's `validate` accepts (schema 1–16) |
| `apps/web/src/state/use-board-document.ts` | The arrival option (above): an optional last `arrivalOf` on `commit` and `apply`. Behaviour of every existing call unchanged |
| `apps/web/src/team/hosted-board.ts` | The arrival option (above): an optional last `arrivalOf` on `edit`, and no refusal toast for an arrival's request. Behaviour of every existing call unchanged |
| `apps/web/src/state/use-editing-commands.ts` | `tableData` gains `ownCopy(text): boolean`, the table step's existing own-copy test (on the raw `text/plain`) moved into a named function (the table step calls it; behaviour unchanged). `changeStyle`'s two refusal checks (`!isMedia(o)`) also skip cards, so a selection mixing text and cards styles its text as one mixing text and pictures does. Still no effect |
| `apps/web/src/state/use-selection.ts` | `formattingIdeas` leaves out cards as it leaves out pictures and videos. Still no effect |
| `apps/web/src/state/use-object-layouts.ts` | `handlesVisible` is false when any selected rectangle is a card (`isLink`), beside the existing mind-node and tape conditions. Still no effect |
| `apps/web/src/state/use-geometry-edits.ts` | `resizeStart` leaves out cards (as tapes), and `resizedBoard` returns `model.current` unchanged when any selected object is a card (`isTape(o) \|\| isLink(o)` in its existing tape check), so no resize path changes a selection that holds a card. Still no effect |
| `apps/web/src/state/use-storage-session.ts` | `saveCopy` gathers every object's picture (`pictureOf(o) !== undefined`: images, videos' first frames and cards' thumbnails), reading or downloading a card's thumbnail as an image's picture. A card has no pixel size, so for a card's thumbnail **not in the tab's memory on a hosted board** (a cold cache) it downloads the bytes, sniffs the type (`signature`), **decodes them** (`decodePicture` on a provisional record, or `createImageBitmap`) to read the pixel width and height, builds `{ bytes, mime, pixelWidth, pixelHeight }`, validates it as a picture record (type sniffed equals `mime`, SHA-256 equals the hash, a decode of exactly that size), holds it in `tabPictures`, and only then writes its file entry; any failure is "a picture is unavailable". A thumbnail read from local storage or already held uses the stored record's own pixel size. The comparison with the object's pixel size and the JPEG check stay for images and videos only; the video step stays for videos only |
| `apps/web/src/ui/context-bar.tsx` | A `links: LinkBar` prop. When `links.only`, `<LinkControls bar={links} reason={selectionReason} />` takes the place the picture bar's `ImageControls` takes, followed by the existing arrange tools and object commands; Tidy up is not shown when `links.only` |
| `apps/web/src/ui/information-controls.tsx` | Takes `linkLine` and passes it to `InformationPanel` (App renders the popover only through it) |
| `apps/web/src/ui/information-panel.tsx` (the About popover) | A `linkLine: string` prop; when not empty, a second `<p>{linkLine}</p>` after the existing paragraph, with no class or style |
| `apps/web/src/ui/objects-panel.tsx` | `sizeReason` is `geometryReason`, else tape's existing text when the selection holds tape, else `Link cards can't be resized.` when **any** selected object is a card, else `""`; the size buttons' `title` follows the same order |
| `apps/web/src/scene/board-drawing.tsx` | `isLink(o)` dispatches to `<LinkBody object={o} bitmap={o.asset ? bitmaps.get(o.asset) : undefined} selected={selected.has(o.id)} zoom={view.z} />`, inside the existing `fade`, before the image branch. No new prop |
| `apps/web/src/team/pictures.ts` | `BoardPictures.linkPreview(url, signal)`: `POST <server>/boards/<board>/link-preview` with the bearer token and `previewRequest`, read by `readLinkPreview`; `null` on any error. (The team route needs the bearer token, which only team modules may import) |
| `apps/web/src/team/media-transfer.ts` | `mediaOf` lists a card's `asset` as a `"picture"`, in object order, so templates carry card thumbnails (team templates v4) |
| `apps/web/src/team/templates-section.tsx` | The picture line counts a card's thumbnail as a picture |
| `apps/web/src/team/import.ts` | As board file v6: a board whose only media are card thumbnails takes the media path; a card's thumbnail is decoded, size-checked and returned in `media` as a picture. Its imports stay `../board-file.ts` and `nextphase-board-rules/*` |
| `apps/web/src/team/templates-rules.ts` | As team templates v4: a valid `link` object is a valid template object and its `asset` is template media |
| `apps/web/style.css` | Only the link controls' block of two rules, placed together directly after `.context .paint-modes button[aria-pressed=true]`, exactly: `.context .link-layout { display: flex; align-items: center; gap: 4px; }` and `.context .link-layout button[aria-pressed=true] { background: #7051cf; border-radius: 6px; }` (interaction v52). No other rule changes |

**Unchanged.** `apps/web/index.html` (the build rewrites its CSP, toolchain v6); `state/use-context-bar.ts` (the
bar's existing `ResizeObserver` re-measures it when the layout buttons appear after the arrival); `state/use-export.ts`
(an export made before a card's thumbnail has decoded draws the card's picture box filled `#f1f0f3`);
`image-assets.ts` (`boardPictures`, `pictureBytes`, `writePictures` and `removeUnusedPictures` already follow the
registry's `pictureOf` and each object's `asset`, which now include a card's) and `board-export.ts` (it draws through
the scene's dispatch, which now draws cards): these two may take type-only edits if the compiler needs them, with no
behaviour change. No other web file changes.

### App.tsx wiring

App.tsx changes only on existing lines, so it keeps its 264 newlines and the budget test's limit stays **264**. The
wiring points are **the paste step** (the import, the hook call and the paste chain), **the bar controls** and **the
About line**. The card body needs no App change: its drawing dispatch is in `scene/board-drawing.tsx`. Exactly these
substitutions, applied in this order to the current App.tsx (each `from` occurs once):

| # | From | To |
| --- | --- | --- |
| 1 | `import { VideoPlayer } from "./scene/video-player";` | `import { VideoPlayer } from "./scene/video-player"; import { useLinkCards } from "./state/use-link-cards";` |
| 2 | `pasteFiles: (files) => void images.pasted(files, () => clipboardCommand("Paste")), composing });` | `pasteFiles: (files) => void images.pasted(files, () => clipboardCommand("Paste")), composing }); const links = useLinkCards({ hosted: team?.hosted, page: pages.id, board, model, commit, select, selected, commandReason, tidyOpen: tidy.open, busy, composing, readOnly, editing: () => !!textSession.current, ownCopy: tableData.ownCopy, historyRef, updateHistory, lineCount, getView: () => view, scene, getStore: () => store.current, isAlive: () => alive.current });` |
| 3 | `onPaste={tableData.paste(hostedPaste ?? images.paste(() => clipboardCommand("Paste")))}` | `onPaste={tableData.paste(links.paste(hostedPaste ?? images.paste(() => clipboardCommand("Paste"))))}` |
| 4 | `          tapeSelection={tapeSelection} tidy={tidy} board={pages.canvas()} moveToPage=` | `          links={links.bar} tapeSelection={tapeSelection} tidy={tidy} board={pages.canvas()} moveToPage=` |
| 5 | `        infoButton={infoButton} panel={panel} busy={busy} composing={composing} toggle={toggle}` | `        infoButton={infoButton} panel={panel} busy={busy} composing={composing} toggle={toggle} linkLine={links.aboutLine}` |

The hook call stays composition only (`useLinkCards` is imported from `./state/`), so "App.tsx is composition only"
holds. In `tests/modules.test.mjs` the test "0012-W4 App composition changes only its recorded substitutions" gains
these five pairs, in this order, at the end of its list (its comment names web modules v50 too); its line-count
assertion is unchanged and must pass.

### Effect guards and module lists

In `tests/modules.test.mjs`, titles saying "through 0012-W5 v1", the new names inserted in sorted order:

| Test | Change |
| --- | --- |
| "the package holds exactly its modules" | Gains `objects/link.ts` (document v22): 18 files |
| object types | Thirteen modules, gaining `link.ts` |
| scene parts | Twenty-two modules, gaining `link-body.tsx` |
| screen parts | Thirty-five modules, gaining `link-controls.tsx` |
| state hooks | Twenty-nine hooks, gaining `use-link-cards.ts` |
| New: "the link cards hook holds exactly two passive effects" | `use-link-cards.ts` has exactly two `useEffect(` and no `useLayoutEffect` |
| App budget | Unchanged: at most 264 newlines |
| App composition | The five substitutions above |

Every other guard is unchanged and must pass: screen and scene parts hold no hook and import React only for types;
state hooks never import each other, `ui/` or `scene/`; no file but App imports `state/`; non-team files import
`team/` only as types; rules modules (`link-cards.ts`, `link-preview-client.ts` among them) import no React or Konva
and name no type literally; the team module list stays 57; every other effect count holds (the editing commands,
selection, object layouts and geometry edits hooks still hold none).

### Counts

From v49: **29 state hooks**, **22 scene parts**, **35 screen parts**, the rules package's **18 files** and **13
object-type modules**; 57 team modules, the board-sync list and every other effect count unchanged.

### Tests

`tests/link-cards.test.mjs` (`npm test`, checks `X10-U00` onwards; each imports the new modules dynamically inside its
named check): `pastedAddress` (one address trimmed → card; whitespace inside, two addresses, plain words, `mailto:` →
`null`; `ftp://`, `127.0.0.1`, `0x7f.1`, `[::1]`, `localhost:8080`, a single-label name, a credentialed address, port
22 → text; 1,001 characters → `null`; an address of at most 1,000 characters whose `href` is longer, such as
`https://example.com/` followed by 330 `é`, → text); the link step passing a file paste, Board's own copy (compared
on the raw text, untrimmed) and a viewer's paste on untouched, and running before the picture and video step, which
would prevent even a file-less paste (X10-U00 with the table, picture and object paths); `linkLook` and the stale rule
at 19,999 and 20,000 ms; `verticalHeight`, `cardLines` and `cardSize` for every look; `faceLayout` equal to
`LINK_LOOK` at each written size, and at 306 × 288 for a stale card (the address row at 37, 136, 252 wide), a ready
vertical card (caps 2 and 2) and a title-only vertical card (site row at 255); `finishCard` and its cuts, reading `x`
and `y` from the card it is given and changing only `LINK_FINISH_KEYS` away from the edges; `withLayout` keeping `x`
and `y`; **document bounds edge regressions**: `keepInBounds`, and a 306-wide card at `x` 999,694 finished
link-only (480 wide), changed to horizontal, and changed back to text (each shifted left just enough: to `x`
999,520 for 480, 999,680 for the 320-wide text), a 480 × 64 card at `y` 999,936 changed back to a taller text object (shifted up), a paste with the view
centre beyond the edge (centred, then kept within), and `amendHistory` shifting only a version that would cross;
`cardToText` and its undo through `history.ts`; `amendHistory` over past and future, writing only `LINK_FINISH_KEYS`
(and the bounds shift); and through `history.ts`'s `record`, `undo` and `redo` with `amendHistory`, the
**single-user** rows of interaction v52's **Undo and Redo around an arrival**, as a local sequence separate from the
hosted ones (sync v18 **Verification**): paste → arrival → Undo → Redo; paste → move → arrival → Undo, Undo, Redo,
Redo (the move's positions kept, the finished card each time); paste → Undo before the arrival → Redo (same `id`,
finished when the arrival comes after); paste → Change back to text → Undo → arrival (same `id`, `url` and
`requestedAt`: the arrival **applies** to the restored card, and the finish reaches the conversion's versions, so Redo
and Undo of the conversion keep the finished card); Change back to text → arrival → Undo (nothing written; the restored
card stays `loading`); the gate: a single-user arrival cancelled (nothing stored or written) when the `LocalStore` is
closed or replaced or the board turns read-only, and a team arrival held while a version preview is shown and
cancelled at `requestedAt + 15,000`, finished when the live board returns before it; `thumbnailSize` and
`makeThumbnail` with doubles (640 px, JPEG 0.85, PNG when any alpha is below 255, a GIF's first frame, undecodable →
`null`); `readLinkPreview` for each status and malformed body; `aboutLine`'s three answers and texts.

**Amendment A5 (2026-11-25).** X10-U13 sends the concurrent move and arrival through the room in both save orders.
Case A accepts the move first and keeps the arrival's rectangle. Case B accepts the arrival first and keeps the
moved place at 306 × 288. In both cases every client converges to the same valid document with the finish keys.
In at least one case the save-order winner has the lower Yjs client ID (sync v18).
