BRIEF VERSION: 0012-W1 v1 (2026-10-28)
# 0012-W1 — Paste and import local images

Status: Implemented. Independently reviewed at `944a4b2` (pass) and merged into main
on 2026-10-29 with [0001 document v10](../architecture/0001-document-v10.md),
[0001 storage v3](../architecture/0001-storage-v3.md),
[0006 board file v2](../architecture/0006-board-file-v2.md),
[0001 interaction v24](../architecture/0001-interaction-v24.md) and
[0001 web modules v22](../architecture/0001-web-modules-v22.md). Its
[evidence summary](0012-W1-paste-and-import-local-images-evidence.md) maps each criterion to
its checks. The implementation record below, which lists the validated revisions, was
written before that review.

## Outcome

A picture from this computer can be put on the board three ways: paste it (⌘V on a Mac, Ctrl+V
elsewhere, after copying an image), drop image files onto the canvas, or pick files with a new
**Image** button after Templates (also ⌘⇧K / Ctrl+Shift+K). PNG, JPEG, GIF (shown still) and WebP
work, recognised by their content, not their name. A picture lands at its own pixel size, scaled
down if it is taller than 480 units, centred in the view or on the drop point; several land side by
side, all selected, in one history step. An image moves, resizes from its corners keeping its
shape, copies, groups, joins sections, undoes and deletes like any other idea, and has a
**Description** that is its accessible name and its label in Objects.

- Pictures stay in this browser. Each is stored once, by its SHA-256, beside the board
  (**storage v3**); the board's **document v10** holds only a reference to it. Save a copy to file
  writes **board file v2**, which carries the pictures; Open board file reads versions 1 and 2.
  Nothing is uploaded and the page's network policy does not change.
- Limits: a file up to 20 MiB; a picture longer than 4,096 pixels is scaled down to 4,096 before
  it is stored; up to 50 MiB of pictures on one board; images count toward the 250-object limit;
  a board file up to 72 MiB. A file that is not a supported image, or breaks a limit, is refused
  with a notice naming it; valid files in the same paste or drop are still added, and the board is
  otherwise left as it was.
- Boards saved by earlier versions open unchanged and are saved as version 10 at the next Save;
  an older copy of Board shows a version 10 board as unsupported and refuses a version 2 file,
  keeping every board and picture.

"Today" means `6339964`. Boards look and behave as today except for the Image button, pasting and
dropping image files, images and what they bring with them (document version 10, picture records,
board file version 2).

## Read first and prerequisite contracts

- [Contributor guidance](../../CONTRIBUTING.md), [agent instructions](../../AGENTS.md) and
  [engineering standards](../../DESIGN.md).
- [0001 document v10](../architecture/0001-document-v10.md): the image type and its keys, version
  1 to 9 reading and upgrade, older applications, the activity catalogue reference, and the
  adapter.
- [0001 storage v3](../architecture/0001-storage-v3.md): picture records, the pictures a tab
  holds, importing a picture, writing pictures with a save, removing unused pictures, and the board
  list refresh.
- [0006 board file v2](../architecture/0006-board-file-v2.md): the bundle with pictures, writing,
  the reading rules for file versions 1 and 2, and the 72 MiB limit.
- [0001 interaction v24](../architecture/0001-interaction-v24.md): the Image button and keys,
  paste, drop, importing and its notices, where images land, drawing, selecting, resizing, the
  context bar and Description, Objects, connectors, copies, board files and history.
- [0001 interaction v14](../architecture/0001-interaction-v14.md)'s clipboard rules, which v24
  changes for the paste key; [v18](../architecture/0001-interaction-v18.md)'s Fill and Border
  panels and menu rules, which the Description panel reuses; [v20](../architecture/0001-interaction-v20.md)'s
  board file commands; and [v22](../architecture/0001-interaction-v22.md)'s proportional resize
  for strokes, which images share.
- [0001 web modules v22](../architecture/0001-web-modules-v22.md): the new modules and the guard
  change.
- [0008 activity catalogue v1](../architecture/0008-activity-catalogue-v1.md) and
  [0001 toolchain v1](../architecture/0001-toolchain-v1.md): unchanged except for the version
  reference document v10 restates. No new dependency.
- [0001-W24 v1](0001-W24-selection-layouts-editor-hooks.md)'s comparison procedure (scenarios
  A–J) is reused by the reviewer.

## Deliverables and boundaries

Paths are under `apps/web/` unless they start with `tests/`. The contracts say what each
behaviour is; this list says where it goes. These are the only files that may change.

**New files (seven).**
1. **`src/objects/image.ts`**: the image type record (document v10's keys and checks, label,
   size range 1 to 20,000, Objects label prefix).
2. **`src/images.ts`**: the accepted types; landing size from the original size; the row
   (16-unit gaps, bottom-aligned, clamped); the import limits (250 objects, 50 MiB counting each
   picture once); adding a batch of images; preparing a file (signature, decode, scaling to 4,096
   with the transparency rule and JPEG quality 0.90, hash); decoding a picture; the refusal notice
   text. No React, Konva or DOM imports; no type-name comparison.
3. **`src/image-assets.ts`**: signatures; the picture record and its validity; the tab's pictures
   in memory; the board's picture bytes; reading and writing picture records; removing unused
   pictures inside a save transaction. Same restrictions.
4. **`src/state/use-images.ts`**: the picker, the paste and drop handlers, imports and their
   notices, the decoded pictures, and the Description panel and draft.
5. **`src/scene/image-body.tsx`**: an image's picture or its "Image unavailable" box, its
   selection outline, and the accessible names beside the canvas.
6. **`src/ui/image-controls.tsx`**: the Image button, the image bar's label and Description
   button and panel, and the Description field Objects reuses.
7. **`tests/images.test.mjs`**: as listed under validation.

**Changed rules modules.**
8. **`src/document.ts`**: document v10 (image keys, version 1 to 9 reading and upgrade, canonical
   form, the adapter's image values, the version 10 board types).
9. **`src/storage.ts`**: storage v3 (missing picture records written and unused ones removed in
   the save and creation transactions; "newer" is above 10).
10. **`src/board-file.ts`**: board file v2 (writing with pictures and its three reasons; reading
    versions 1 and 2; 72 MiB).
11. **`src/clipboard.ts`**: copies of images; Paste refused above 50 MiB of pictures.
12. **`src/strokes.ts`**: the proportional resize also takes images (floor 1, ceiling 20,000).
13. **`src/sections.ts`**: an image's Objects label.
14. **`src/connectors.ts`**, 15. **`src/activities.ts`**, 16. **`src/group.ts`**,
    17. **`src/gesture.ts`**: the version 10 types only (and, for `gesture.ts`, an image as a
    resize start).

**Changed object types.**
18. **`src/objects/registry.ts`**: the image type in the registry, the shared key handling,
    "keeps proportions" and eligible ideas (images are not).

**Changed scene parts.**
19. **`src/scene/board-drawing.tsx`**: draws images through `image-body.tsx`.
20. **`src/scene/section-body.tsx`**: the version 10 types only.

**Changed state hooks** (each keeps its ownership, web modules v22):
21. **`src/state/use-page-keys.ts`**: the platform's paste key let through; Cmd/Ctrl+Shift+K.
22. **`src/state/use-storage-session.ts`**: board file v2 writing (each picture decoded first) and
    reading with pictures, its messages, and a board created from a file with its pictures.
23. **`src/state/use-geometry-edits.ts`**: a selection holding an image takes the proportional
    resize.
24. **`src/state/use-editing-commands.ts`**: the version 10 types, the Paste refusal message, and
    Text size, Alignment and Formatting leaving images out of their availability test in a mixed
    selection (interaction v24's **Mixed selections**).
25. **`src/state/use-selection.ts`**: the version 10 types, and images left out of the rich-text
    test that shows Text size, Alignment and Formatting.
26–30. **`use-board-document.ts`**, **`use-canvas-input.ts`**, **`use-command-reasons.ts`**,
    **`use-object-layouts.ts`**, **`use-validity.ts`**: the version 10 types only.

**Changed screen parts.**
31. **`src/ui/palette.tsx`**: places the Image button after Templates.
32. **`src/ui/context-bar.tsx`**, 33. **`src/ui/objects-panel.tsx`**: place the image bar and the
    Description field.
34–38. **`src/ui/board-panel.tsx`**, **`connector-fields.tsx`**, **`content-field.tsx`**,
    **`format-preview.tsx`**, **`shape-controls.tsx`**: the version 10 types only.
39. **`style.css`**: the Description panel and its field; the bottom toolbar scrolling sideways
    inside itself below 480 CSS pixels wide when its buttons do not fit.

**Composition.**
40. **`src/App.tsx`**: calls `use-images.ts`, passes its values, and attaches its paste,
    drag-over and drop handlers. It must not exceed **262 lines**, its budget.

**Changed tests.**
41–51. **`tests/activities.test.mjs`**, **`board-catalog.test.mjs`**, **`board-file.test.mjs`**,
    **`connector-styles.test.mjs`**, **`connectors.test.mjs`**, **`document.test.mjs`**,
    **`modules.test.mjs`**, **`objects.test.mjs`**, **`shapes.test.mjs`**,
    **`storage.test.mjs`**, **`strokes.test.mjs`**: as listed under validation.

No other module changes: no `history.ts`, `icons.tsx`, `resize.ts`, other hook, other scene or
screen part, `main.tsx`, `index.html` (its content security policy stays exactly as it is: no
`blob:` source and `connect-src 'none'`), activity files, packages, locks, contracts, build scripts
or other tests. Pictures are never fetched, uploaded or drawn through a URL: they are decoded with
`createImageBitmap` from a `Blob` and drawn from the resulting bitmap. Outside the named new
controls, the existing screens' markup stays exactly as at the base: the reviewer's A–J comparison
allows only the masks listed under validation. If something seems to need more, stop and report
it.

New source files use `SPDX-License-Identifier: Apache-2.0`. Append the implementation record
below with the branch, validated revision, commands, results and exclusions; report the final
branch tip separately.

## Numbered acceptance criteria

- 0012-W1-AC01: Paste or choose supported image files and place an image object with declared
  size/type limits.
- 0012-W1-AC02: Move and resize the image while retaining its asset reference through supported
  local save/reopen and portability.
- 0012-W1-AC03: Reject unsupported input without replacing recoverable content; do not upload
  images to an external service.

| Criterion | Evidence that shows it |
| --- | --- |
| 0012-W1-AC01 | Scenario T: T1–T18 (the Image button, keys, picker, paste, drops, landing sizes, each format, a still GIF, a renamed file), T22–T26 (the file, board and object limits, scaling), T31–T35 (the image bar, Description, Objects); unit tests in `tests/images.test.mjs` |
| 0012-W1-AC02 | Scenario T: T28–T30 (moving, proportional resizing, Objects' size buttons), T36–T42 (copies sharing one picture, save and reopen, removal of unused pictures and Undo after it, a version 9 board, board files of both versions), T44 (a missing picture), T47 (connectors refused); unit tests in `tests/images.test.mjs`, `tests/board-file.test.mjs`, `tests/board-catalog.test.mjs` and `tests/document.test.mjs` |
| 0012-W1-AC03 | Scenario T: T19–T21 (refused files beside a valid one), T27 (a failed store), T43 and T49 (damaged files), T45 and T46 (an older application), T48 (the notice), T50 (no network request, no dialog, the page policy unchanged); unit tests in `tests/images.test.mjs` and `tests/board-file.test.mjs` |

## Validation commands and expected evidence

From the repository root with the pinned toolchain:

```sh
npm --prefix apps/web ci --ignore-scripts --no-audit --no-fund
npm --prefix apps/web run typecheck
node --test tests/images.test.mjs tests/board-file.test.mjs tests/board-catalog.test.mjs tests/document.test.mjs tests/storage.test.mjs tests/modules.test.mjs
npm --prefix apps/web test
npm --prefix apps/web run build
npm --prefix apps/web run build:fixtures
git diff --name-only main...HEAD
```

The change touches the saved format, storage, the board file, the registry, the page keys and
`App.tsx`, so the implementer runs the full unit suite (`npm --prefix apps/web test`) and reports
any failure, saying whether it also fails at `6339964`.

**`tests/images.test.mjs`** (new) covers:
- document v10: an image's exact keys and order; `asset` (64 lowercase hex accepted; uppercase,
  short or non-hex rejected); pixel sizes 1 and 4,096 accepted, 0, 4,097 and fractions rejected;
  a description of 1,000 code points with astral characters accepted, 1,001 and a lone surrogate
  rejected; width and height 1 and 20,000 accepted, 0.5 and 20,001 rejected; a text, colour or
  style key on an image, an image key on another type, a missing key and an image in a version 9
  document rejected; a connector end naming an image rejected;
- canonical form and reading: a version 10 board with images round-trips byte for byte; each
  version 1 to 9 board reads unchanged and serializes byte for byte until edited; the upgrade is
  not an edit;
- the adapter: image values held whole; projection and re-creation give back asset, pixel size,
  description and rectangle; Undo and Redo of adding, describing and resizing an image;
- signatures: PNG, JPEG, GIF87a, GIF89a and WebP recognised; a short file, `RIFF` without
  `WEBP`, and text rejected;
- landing size: 300 × 200, 800 × 600, 6000 × 1000 (2880 × 480, from the original size) and
  600 × 3000; a landing side above 20,000 refused; the scaled pixel size of 6000 × 1000 (4096 ×
  683) and of a tall picture;
- the row: two and three images, 16-unit gaps, bottom-aligned, centred, the worked example in
  interaction v24, clamping at the board's edges;
- limits: the 250th object accepted and the 251st refused; exactly 52,428,800 bytes of pictures
  accepted and one more byte refused; a picture already on the board or earlier in the batch
  adding nothing; a hash on the board whose picture is unavailable adding its bytes when
  imported (45 MiB available plus a 10 MiB picture for an unavailable image is refused); copies adding nothing; Paste refused above the limit with no change;
- the refusal notice: one, two, three and five names, "Clipboard image" for an empty name, and
  distinct reasons in order;
- picture records: validity (exact keys, `mime` against signature, digest against key, pixel
  bounds); a missing or invalid record leaves its images unavailable and is not rewritten; a valid
  record whose pixel size differs from an image's is not drawn for that image, and Save a copy
  refuses it as "a picture is unavailable";
- adding images: fresh IDs and generations, empty description, the section by centre, appended at
  the end of the idea band, one transaction;
- resizing: a selection holding an image scales by one factor with Shift or without; the floor of
  1 and the ceiling of 20,000; Objects' size buttons keep proportions; a mixed selection with a
  sticky and an image;
- Objects' label: "image *n*" numbered with the other ideas, with group, description (first 36
  characters) or "No description", and section;
- registry: an image is not an eligible idea; Connect refused with an image;
- copies: asset, pixel size and description kept, remapped group and section, no text in the
  plain text;
- mixed selections: with a sticky and an image selected, Text size, Alignment and Formatting are
  available and change the sticky only, the image unchanged; with a stroke added they are hidden
  as before; Colour changes the sticky only;
- the paste key: the platform's paste key on the scene keeps its default, the other modifier and
  a script-created key run object Paste;
- the Description draft: cut to 1,000 code points; committed once; no step when unchanged; not
  applied to another board.

**`tests/board-file.test.mjs`** covers board file v2 as its **Verification** section lists, moving
v1's assertions that a written file is version 1 and that the limit is 4,194,304 bytes to version 2
and 75,497,472 bytes, and keeping its version 1 reading cases.

**`tests/board-catalog.test.mjs`** covers storage v3's writing and removal: a save writes a missing
picture once and never rewrites one; a picture kept while the previous record or another board
refers to it and removed after the last reference; nothing removed while a board record cannot be
parsed; a failed save leaves every record as it was; removal never reads a picture value; a board
created from a file stored with its pictures; the refresh ignoring picture records; a future
version 11 board listed as newer.

**`tests/modules.test.mjs`**: object types eight (adding `image.ts`), scene parts ten (adding
`image-body.tsx`), screen parts twenty-seven (adding `image-controls.tsx`), hooks twenty (adding
`use-images.ts`), the type-name guard's list with `image`, and the `App.tsx` budget 262,
unchanged.

**`tests/activities.test.mjs`** keeps reading activity files as version 7. Its assertion that
writing an activity's board gives back the activity file byte for byte (a version 1 file) moves to
board file v2: the written file is version 2, its bundle's `assets` is empty, and its `document` is
the activity file's version 7 payload byte for byte.

**The other changed tests** assert version 10 where they assert the newest version and use 11
for a future version (and 3 for a future board file version). `tests/objects.test.mjs` also
lists the image type last among the registered types, finds the connector's record by its ends
rather than by its position, and expects images not to be eligible ideas, keeping every existing
type's coverage. No other expectation changes.

Reviewer checks (not run by the implementer; browsers cannot start there):

- **Scenario T** (new behaviour), with real mouse and keyboard input and synthetic pictures drawn
  in the page in fresh contexts at 1280 × 800 and 100% zoom, once on the candidate and once on a
  build of `6339964` as a negative control: there the page has no Image button and does not import
  files, so the dependent checks fail and the run exits with a failure. Saved records and picture
  records are read after each Save, waiting for "Locally saved". Clipboard images arrive as a real
  `paste` event carrying files; drops as real `drop` events. Crafted stored records are used only
  for the starting ideas, the version 9 board (T39), a missing picture (T44), the older
  application (T45, T46) and the 250-object board (T26). The tool is
  `tools/browser-compare/images-check.mjs` in the private repository; the check run keeps its
  order and may adjust its steps, keeping each check's meaning.
  - **T1–T4** The Image button after Templates, its tooltip, accept list and several-file picker;
    the picker adds several files in one step, selected, on top; Cmd+Shift+K and Ctrl+Shift+K.
  - **T5–T6** A paste event carrying image files adds them at the view centre; the platform's paste
    key reaches the paste event, and the other modifier, Copy and Cut keep v14's behaviour.
  - **T7–T12** Drops of 300 × 200, 800 × 600, 6000 × 1000 and 600 × 3000 land at their landing
    sizes centred on the drop point; a drop of two files forms the bottom-aligned row with one
    Undo; dragging over the canvas draws nothing and changes nothing.
  - **T13–T18** PNG, JPEG, GIF and WebP are accepted and drawn; a two-frame GIF stays on its first
    frame; a PNG named `.txt` with type `text/plain` is accepted.
  - **T19–T21** A text file, a renamed text file and a damaged PNG are refused with the
    supported-format notice while a valid file beside them is added; one Undo removes only that.
  - **T22–T27** A file over 20 MiB refused and a 20 MiB one accepted and carried through a board
    file; the 50 MiB board limit counting a repeated picture once; scaling to 4,096 as JPEG and as
    PNG with transparency; the 250-object limit; a failed store leaving the board unchanged.
  - **T28–T30** Moving keeps asset and pixel size; four corner handles, no connection dots,
    proportional with or without Shift; Objects' size buttons keep proportions, one step each.
  - **T31–T35** The one-image and several-image bars; the Description panel, its count, one step on
    leaving, the accessible name and Objects label; the 1,000-code-point limit with astral
    characters and no step for an unchanged close; Objects' Description field and no styling
    fields.
  - **T36–T38** Copy, Paste and Duplicate share one picture record; Save and reopen write version
    10 and one picture record and draw again; removal waits for the previous record, then removes
    the bytes, and Undo after it draws and the next Save stores the record again.
  - **T39–T43** A version 9 board opens without a write and saves as version 10; Save a copy to
    file writes version 2 with each picture once and the digest over the whole payload; opening it
    creates a new board with its pictures; a version 1 file still opens; a damaged version 2 file is
    refused with every record unchanged.
  - **T44–T46** A missing picture draws "Image unavailable" and the image can be described, moved
    and deleted; the `6339964` application shows a version 10 board as unsupported, keeps every
    byte and picture record, keeps working on a version 9 board beside picture records, and refuses
    a version 2 file as newer.
  - **T47–T50** Connectors never end on images and mixed controls leave images unchanged; the
    notice names at most three files; a version 2 file whose picture passes its digest but does not
    decode is refused; the page policy is identical to `6339964`'s, with no request beyond the
    page's own files, no dialog, page error or console error.

Recommended regression checks, run only if the maintainer accepts them (this change touches the
saved format, storage, the board file, the registry, the page keys, the clipboard, the context bar,
Objects and `App.tsx`):

- **The full unit suite** in a clean clone, separating failures new to the candidate from
  failures that also occur at `6339964`.
- **Previous behaviour.** Scenarios A–J of the 0001-W24 v1 brief's comparison on a build of
  `6339964` and on the candidate, with 0002-W2's adjusted starts in both runs. Before comparing,
  both runs are normalized with exactly these two masks and nothing else: the bottom toolbar's
  Image button (and, if present, the picker's hidden file input) is removed from the markup; and a
  saved version 10 record that holds no image is compared as the same record with
  `schemaVersion` 9. After the masks the candidate must match at every checkpoint in markup, focus,
  canvas drawing and saved records. The masks are `tools/browser-compare/images-normalize.mjs` in
  the private repository.
- **Earlier scenarios on the candidate**, each with its version assertions moved to 10 (and future
  data to 11): S (connector styles: S1, S66–S68), O (connectors: O10, O71), R (strokes: R16, R49,
  R50, R53), N (shapes, N56), M (sections, M3), K (formatting: K4; K6 checks that object Paste with
  the other platform's modifier still works), L (unchanged), P (board files with `--baseline` at a
  `6339964` build: a written file is version 2 and is unwrapped to its document before comparing;
  the size limit is 72 MiB; a future document is version 11 and a future file version 3) and Q
  (templates, Q21 saves a version 7 board as version 10).
- **Regression harness.** The eight PASS lines at the fixture index page and at
  `regressions.html` ([tests README](../../tests/README.md)), in headless Chrome.

The maintainer then checks three items from scenario T in Safari before the merge: the reviewer
picks the one most likely to differ there and two are drawn at random. No browser matrix,
accessibility audit, phone layout check or performance test unless the maintainer asks.

## Exclusions and reasons

- Replace image, crop, rotate, border, AI tools and image filters; animated GIF playback.
- HEIC, TIFF, SVG, PDF and video; images from web addresses, or dragged from other pages as links
  or HTML; pasting an image held only as HTML.
- Connector ends on images.
- Image export and other media (later milestones of this feature).
- Pasting images into sticky, text or Description editing; copying images out to other
  applications (Copy keeps writing plain text only).
- Sharing pictures between browsers other than through a board file; any upload or network use.
- Fixes for bugs noticed on the way (report them).

## Public references with retrieval dates

Retrieved 2026-10-28: [HTML: `createImageBitmap`](https://html.spec.whatwg.org/multipage/imagebitmap-and-animations.html),
[HTML: the `paste` event and `DataTransfer`](https://html.spec.whatwg.org/multipage/dnd.html),
[Clipboard API and events](https://www.w3.org/TR/clipboard-apis/),
[RFC 4648, base64](https://www.rfc-editor.org/rfc/rfc4648), and the format references in
[storage v3](../architecture/0001-storage-v3.md).

## Implementation record

### 2026-10-28 — v1 implementation handoff

- Branch: `codex/0012-W1-images`; worktree: `.worktrees/codex-0012-W1`.
- Committed main prerequisite/base: `a8d3d3ed99f9ee046141180fc1924d1e29597415`.
- Validated source/test revision: `ef816a8935b0048c0ecf44d93d3f397cfa470d4f`
  (`feat(web): import and persist local images`). The record is a separate
  documentation commit; the final branch tip is reported separately in the handoff.
- Scope: this brief v1 with document v10, storage v3, board file v2, interaction
  v24 and web modules v22. All seven new files and the 44 permitted existing
  source/test files are included. `App.tsx` remains 262 lines. No dependencies
  were added, removed or updated; manifests, locks, contracts and CSP are unchanged.
- Runtime: Node `24.22.1`, npm `11.19.1`, with the official platform archive
  checksum matched to its release checksum file. All final commands below ran
  from the repository root with that distribution's `bin` directory on `PATH`.

| Exact command | Result at the validated revision |
| --- | --- |
| `npm --prefix apps/web ci --ignore-scripts --no-audit --no-fund` | Exit 0; 19 packages installed |
| `npm --prefix apps/web run typecheck` | Exit 0 |
| `node --test tests/images.test.mjs tests/board-file.test.mjs tests/board-catalog.test.mjs tests/document.test.mjs tests/storage.test.mjs tests/modules.test.mjs` | Exit 0; 173 passed, 0 failed, 0 skipped |
| `npm --prefix apps/web test` | Exit 0; 641 passed, 0 failed, 0 skipped |
| `npm --prefix apps/web run build` | Exit 0; application built; accepted lock, runtime inventory and distributed notices verified |
| `npm --prefix apps/web run build:fixtures` | Exit 0; disposable fixtures built; accepted lock, runtime inventory and distributed notices verified |
| `git diff --name-only main...HEAD` | Exit 0; exactly the 51 permitted source/test files before this record; the final tip additionally includes this brief's record |
| `git diff --check main...HEAD` | Exit 0 |
| `git status --short` | Exit 0; clean after the implementation commit and validation |

The image tests cover schema and adapter boundaries, legacy payload preservation,
signature detection, landing/scaling arithmetic and encoding choices, row placement,
unique-byte and object limits, notices, unavailable pictures, history, copies,
proportional resize, mixed text controls, paste-key routing and Description drafts.
Server-rendered hooks use synthetic surfaces; their event, picker and decoder doubles
are unit evidence, not browser evidence. Storage tests cover strict picture import,
atomic save/creation, conservative collection and list refresh isolation. Board-file
tests cover v1 compatibility, v2 bundles and refusal ordering, malformed picture
entries, pixel mismatches, the 50 MiB and 72 MiB boundaries and a 20 MiB round-trip.

During implementation, an earlier full unit run failed only a new image-resize test
that compared a computed double to an exact integer. The assertion now uses a
numeric tolerance while retaining the proportion and board-edge checks. That new
test is absent at `6339964`; no existing test failed in that run. There are no
remaining failures. No baseline test campaign was needed. An initial installation
used the shell's Node 26 and emitted an engine warning; installation and every final
check were repeated successfully with the pinned toolchain.

Exclusions: no browser was launched, no browser regression harness ran, and no
scenario T, A–J comparison, other browser scenario, Safari check, browser matrix,
accessibility audit, native IME check or performance/load test is claimed. Those
browser checks remain with the independent reviewer, including the required negative
control at `6339964`. The three acceptance criteria have unit evidence; final browser
acceptance and review of the exact revision remain pending.

The graph discovery and indexing MCP calls were unavailable under the sandbox's
approval policy; source inspection was used after both attempts were rejected.
Mandatory public-boundary hooks passed on the implementation commit. Git printed a
nonfatal sandbox warning while trying to lock packed refs; the commit, branch tip
and clean worktree were verified afterward. No hooks were bypassed, no stash was
used, and nothing was pushed, merged or published.
