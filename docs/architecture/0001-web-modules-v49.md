# 0001 — Web app modules

Note version: 49 (for 0012-W6 brief v1, 2026-11-25). Status: Draft.
Replaces [web modules v48](0001-web-modules-v48.md), whose registry, import, composition, one-state-owner, team
guards, counts, seams, CSS and App.tsx rules remain word for word except as below.
[Interaction v51](0001-interaction-v51.md) lets team imports and team templates carry pictures and videos with
exactly **one new web source module**, a team module. **App.tsx does not change. No state hook, scene part, screen
part, CSS rule or effect is added**; one existing hook and one type gain a single property (below).

## New module

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

## Changed web files

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

## Counts and guards

From v48: **57 team modules** (`media-transfer.ts` added); 28 state hooks, 21 scene parts, 34 screen parts, the
rules package's 17 files and 12 object-type modules, the board-sync list and every effect count unchanged. In
`tests/modules.test.mjs` the team-module test lists `media-transfer.ts` in sorted order and its title says "through
0012-W6 v1"; the `import.ts` import guard and the rules-style list are unchanged and must pass. The "0012-W4 App
composition" test is unchanged and must pass (App.tsx is byte-identical to `ea4203c`).

## Tests

New unit file `tests/team-media.test.mjs` (`npm test`): `mediaOf` order and kinds; `percent` and `Progress`
(rounding down, never decreasing, the add's half-and-half count); `watchdog` with a fake timer; `pictureLine` and
`mib`/`mibUp` texts (`Includes 1 picture (0.3 MiB …)`, `Includes 2 pictures and 1 video (…)`, `27 MiB` rounding
up); `importBoard` returning media for versions 2 and 3 and refusing over-budget files with the board file v5
reasons; each sequence with transfer doubles: every success and failure answer mapped to its exact text, one file at
a time, nothing finished, saved or inserted after a failure, the add's insert called once only after every upload
answered `ok`; a valid image object accepted by `templateBoard` and refused by `templateObjects(value)` without
`held`; `parseTemplateDetail` (the `media` key accepted only there); `templateAdds` outliving a panel and its `adding`
flag. Existing files updated as listed in the brief's dispositions.
