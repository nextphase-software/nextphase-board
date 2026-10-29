# 0001 — Web app modules

Note version: 22 (for 0012-W1 brief v1, 2026-10-28). Status: Draft. When accepted it
replaces [web modules v21](0001-web-modules-v21.md) for later work. Its rules are v12's, with
rule 7's guard as v20 left it and widened below to the new type name. "Where the code is now" and
"Planned steps" are updated for images: an object type `objects/image.ts`, two rules modules
`images.ts` and `image-assets.ts`, a state hook `state/use-images.ts`, a scene part
`scene/image-body.tsx` and a screen part `ui/image-controls.tsx`. It changes no behaviour, saved
format or contract of its own: [document v10](0001-document-v10.md),
[storage v3](0001-storage-v3.md), [board file v2](0006-board-file-v2.md),
[interaction v24](0001-interaction-v24.md), [the activity catalogue
contract](0008-activity-catalogue-v1.md) and [toolchain v1](0001-toolchain-v1.md) govern what the
app does.

## Why

v21's "Why" applies. An image is a new object type, so its keys, labels and size range live in
`objects/` and every other module asks the registry about it. Reading, checking, scaling and
storing pictures are rules with unit tests, kept out of the hooks and the scene: `images.ts` holds
what turns files into images on the board, `image-assets.ts` what a picture record is and how
records are kept. The import routes (picker, paste, drop), the decoded pictures and the
Description draft are one concern, held by one new hook rather than spread through
`use-canvas-input.ts`, `use-page-keys.ts` and `App.tsx`.

## Where the code is now

v21's table applies, with these rows changed or added:

| Module | Layer | Owns |
| --- | --- | --- |
| `objects/image.ts` | Object types | New in 0012-W1: the image type record (type name, label, saved keys and their order, size range 1 to 20,000, the key checks of document v10, the Objects label prefix) |
| `objects/registry.ts` | Object types | As in v21, plus the image type: whether an object is an image, that images keep proportions when resized (as strokes do) and are not eligible ideas, and the image keys in the shared key handling |
| `images.ts` | Rules | New in 0012-W1: the accepted types, landing size, the row, the import limits, adding a batch of images to a board, preparing a file (signature, decode, scaling, encoding, hash) and decoding a picture, and the refusal notice text. Its decoding and scaling call the browser's `createImageBitmap` and canvas when they run, never when the module is imported |
| `image-assets.ts` | Rules | New in 0012-W1: picture signatures, the picture record and its validity, the tab's pictures in memory, the board's picture bytes, reading and writing picture records, and the removal of unused pictures inside a save transaction |
| `document.ts` | Rules | As in v21, plus document v10: the image keys, version 1 to 9 reading and upgrade, canonical form, the adapter's image values, the version 10 board types |
| `storage.ts` | Rules | As in v21, plus storage v3: a save and a creation write missing picture records and then remove unused ones in the same transaction; "newer" is above 10 |
| `board-file.ts` | Rules | Board file v2 in place of v1: writing the bundle with its pictures, reading file versions 1 and 2 with every refusal rule but decoding |
| `clipboard.ts` | Rules | As in v21, plus copies of images and the 50 MiB check on Paste |
| `strokes.ts`, `sections.ts`, `connectors.ts`, `activities.ts`, `group.ts`, `gesture.ts` | Rules | As in v21, with the version 10 types; `strokes.ts`'s proportional resize also takes images (floor 1); `sections.ts` gives an image's Objects label |
| `scene/` | Scene parts | Ten modules: v21's nine plus `image-body.tsx` (an image's picture or its "Image unavailable" box, its selection outline, and the accessible names beside the canvas). `board-drawing.tsx` draws images through it |
| `ui/` | Screen parts | Twenty-seven modules: v21's twenty-six plus `image-controls.tsx` (the Image button, the image bar's label and Description button and panel, and the Description field Objects reuses). `palette.tsx`, `context-bar.tsx` and `objects-panel.tsx` place them |
| `state/` | State | Twenty hooks: v21's nineteen plus `use-images.ts`, which owns the image picker, paste and drop handling, imports, the decoded pictures, and the Description panel and its draft. `use-page-keys.ts` lets the platform's paste key through and calls the picker on Cmd/Ctrl+Shift+K; `use-storage-session.ts` passes pictures to board files and to a board created from a file; `use-geometry-edits.ts` sends a selection holding an image to the proportional resize |
| `App.tsx` | Composition | As in v21; from 0012-W1 it calls `use-images.ts` and passes its values to the page keys, the scene, the context bar, Objects and the palette, attaches its paste, drag-over and drop handlers, and stays within its budget of 262 lines |

## Rules for every brief

v12's eight rules apply, with v20's guard widened to the name `image`: no module outside
`objects/` compares a type name (`sticky`, `text`, `section`, `shape`, `square`, `circle`,
`connector`, `stroke`, `image`, `marker` or `highlighter`); a module asks the registry whether an
object is an image.

`images.ts` and `image-assets.ts` are rules modules: erasable TypeScript with no React, Konva or
DOM imports and no type-name comparison.

The unit tests that guard the modules change only as follows: object types exactly eight, adding
`image.ts`; scene parts exactly ten, adding `image-body.tsx`; screen parts exactly twenty-seven,
adding `image-controls.tsx`; state hooks exactly twenty, adding `use-images.ts`; the type-name
guard's list adds `image`. The `App.tsx` budget stays 262.

## Planned steps

v21's steps are done; connector styles landed as 0002-W3. Images follow these rules (0012-W1).
Image export (0012-W2) and other media (0012-W3) are later work; each extends `images.ts`,
`image-assets.ts` and `objects/image.ts`. This note is updated as each step lands.
