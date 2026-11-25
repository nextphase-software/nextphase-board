# 0001 — Board document contract

CONTRACT VERSION: 0001 document v21 (2026-11-24)

Status: Draft for 0012-W4 v1. When accepted it replaces [document v20](0001-document-v20.md) for later work.
Every rule of v20 (and, through it, v19 and v18) stays word for word except as below. This version adds the
**video** object type and **schema version 15**. How a video's bytes and first frame are kept is
[storage v4](0001-storage-v4.md) (local), [board file v5](0006-board-file-v5.md) (files) and hosted storage v14
(rooms); how a video is added, drawn and played is [interaction v50](0001-interaction-v50.md).

## Terms

- **Video**: an object that refers to a video file (MP4, MOV or WebM) by its hash, and to a still picture of
  that file's first frame (its **first frame**) by the first frame's hash.
- **Video hash**: the SHA-256 digest of the video file's bytes, as 64 lowercase hex characters (as an image's
  `asset`, document v10).
- **First frame**: a **JPEG** picture of the video's first frame, kept exactly as any picture is (document v10's
  picture: hash, bytes, pixel size). A video is **drawn** with its first frame, exactly as an image is drawn with
  its picture. The document holds only the hash, so it cannot check the JPEG rule; every place that holds the
  bytes does: storage v4 (a non-JPEG first frame is never drawn for a video), board file v5 (refused as damaged),
  interaction v50 (the browser draws only a JPEG first frame) and the room (API v14 and sync v17).
- **An object's picture**: an image's `asset`; a video's `poster`. Other objects have none.
- **A document's pictures**: the distinct hashes that are an object's picture (images' assets and videos'
  posters). **A document's videos**: the distinct `asset` values of its videos. **A document's assets**: both
  sets together.

## Saved document (version 15)

A version 15 document has exactly the keys, order and rules of a version 14 document (v20), and may also hold
videos. A version 1 to 14 document holding a video is rejected.

A video has these keys, in this order:

| Field | Required value |
| --- | --- |
| `id` | As every object |
| `generation` | As every object |
| `type` | `"video"` |
| `page` | As every object (v18) |
| `group` | As every object |
| `section` | As every object |
| `asset` | The video hash: 64 characters, each `0`–`9` or `a`–`f` |
| `poster` | The first frame's hash: 64 characters, each `0`–`9` or `a`–`f`, different from `asset` |
| `pixelWidth`, `pixelHeight` | Safe integers, each **1 to 1,920**: the first frame's pixel size (the video's own size scaled so its longer side is at most 1,920, same shape) |
| `durationMs` | A safe integer **1 to 86,400,000**: the video's length in milliseconds, rounded to the nearest millisecond when it was added |
| `name` | The added file's name: a string of **1 to 255** code points with no lone surrogate and no control character (U+0000–U+001F, U+007F–U+009F). It is not drawn on the board; interaction v50 uses it only in notices |
| `description` | As an image's: a string of at most 1,000 code points with no lone surrogate |
| `x`, `y`, `width`, `height` | The video's rectangle, as every rectangle |
| `order` | As every object |

A video has no `text`, `color`, `textSize`, `align`, `marks`, `shape`, `fill`, `border`, `points`, `from`, `to`
or `pattern`. `validate` checks keys, values and bounds; `canonical()` writes the keys in the order above. `name` is a
value like any other: it counts toward the payload and its change is a change of the object (rule 7), though
no control edits it after the video is added.

**Video rules.**
1. A video is a rectangle with `sizeRange` 1 to 20,000 in each direction, as an image. It keeps its proportions
   when resized (`keepsProportions` is true for it), as an image does.
2. A video is never a container, a connector end or a mind-map node; a connector whose `from` or `to` names a
   video is invalid. It may be a section's member exactly as an image is (`sectionIdea`), and is excluded from
   `eligibleIdea` as images are. It may take part in workshop voting as an image does (`voting: true`).
3. A video counts as **one** object of the 250 (v18 "Limits"). Its keys count toward the 2,097,152-byte
   canonical payload as every value does; its bytes and its first frame's bytes never do.
4. **One hash, one kind.** In one document, no hash is both a picture (an image's `asset` or a video's
   `poster`) and a video (a video's `asset`). A document that breaks this is invalid.
5. Several videos may refer to the same video hash (copies, Duplicate). They need not share their `poster` or
   `durationMs` (a first frame made by another browser may differ in bytes).
6. Duplicating a video, copying and pasting one, and Undo keep `asset`, `poster`, `pixelWidth`, `pixelHeight`,
   `durationMs`, `name` and `description`, with a fresh `id` and `generation`, as for images (v10). Templates and
   activities never hold a video: a template object list holding one is invalid, as for images.
7. A video's `generation` follows the existing generation rules: every change to any of its keys is a change
   of the object.

## Object type module and registry

`packages/board-rules/src/objects/video.ts` (new) exports `VideoKeys` (`{ asset: string; poster: string;
pixelWidth: number; pixelHeight: number; durationMs: number; name: string; description: string }`), `validVideo(value: object):
boolean` (the field rules above) and the type record `video`:
`{ voting: true, type: "video", label: "Video", tool: null, validFrom: 15, body: "image-body", points: false,
text: false, ends: false, container: false, richText: false, extraKeys: ["asset", "poster", "pixelWidth",
"pixelHeight", "durationMs", "name", "description"], savedKeys: [the table's keys in order], validExtras: validVideo,
sizeRange: { min: 1, max: 20000 }, shapePaint: false, growsWithText: false, labelPrefix: () => "video" }`.

`objects/registry.ts`:
- `ObjectType` gains `typeof video`; `RectangleType` gains `typeof video.type`; every `Exclude<…>` list that
  names `typeof image` also names `typeof video` (`TextRectangleType`, `placementTool`, `hasText`,
  `ADD_OPTIONS`), so a video is never placed by a tool and is not in `ADD_OPTIONS`.
- `OBJECT_TYPES` inserts `video` **directly after `image`**, so it reads, in full:
  `[sticky, shape, text, section, table, stroke, connector, image, video, mindNode, tape]` (`shape` second, as
  today; `mindNode` and `tape` stay last).
- New exports: `isVideo(o)` (type guard: `o.type === video.type`), `isMedia(o)` (`isImage(o) || isVideo(o)`),
  `pictureOf(o): string | undefined` (an image's `asset`, a video's `poster`, otherwise `undefined`) and
  `assetsOf(o): string[]` (`[asset]` for an image, `[asset, poster]` for a video, `[]` otherwise), and
  `videoType()` (returns `video`).
- `eligibleIdea` excludes videos (`!isMedia(o)` in place of `!isImage(o)`); `keepsProportions` is
  `hasPoints(o) || isMedia(o)`; `extraValues` accepts `VideoKeys`.

The registry and `document.ts` keep asking the type record rather than comparing type names.

## Canonical payload

As v20, with a video's keys in the order above. No other sorting.

## Reading version 1 to 14 documents

`upgrade` reads a version 1 to 14 document exactly as v18, v19 and v20 say, then sets `schemaVersion` to 15. No
other key changes. `empty` and `add` create version 15 documents. A version 15 document is not upgraded. Opening
an older board follows v18's rule word for word with 15 for 13: the upgrade happens **in memory**, is not an
edit, never writes storage, and the next explicit Save writes version 15. An unedited board's export and its
canonical bytes are those of its own version (v1–14 round trips stay byte-exact); an edited one exports version
15. `payloadBytes` excludes `pages` and every `page` for versions 13, 14 and 15 alike.

**Types.** `document.ts` adds `VideoItem` (the table's keys, `page: string`, and `text?`, `color?`, `textSize?`,
`align?`, `marks?`, `shape?`, `fill?`, `border?` as `never`), `ItemV15 = StoredItemV14 | VideoItem` (where `StoredItemV14` is the previous schema-14 union) and `BoardV15`
(`schemaVersion: 15`). `Board["schemaVersion"]` gains 15 and `Item` gains `VideoItem`. The **current-document**
aliases follow the newest version, as `BoardV12` already does: `BoardV12` and `BoardV14` become aliases of
`BoardV15`, and `ItemV12` and `ItemV14` of `ItemV15`, so the 40-odd callers that name the current board keep their names.
A reader that can return an older version does not use those aliases: the **one decoded type** is sync v17's
`DecodedBoard` (exported from `packages/board-sync/src/codec.ts`: the union of this contract's board shapes for
versions 10 to 15 exactly as stored, unpaged for 10–12 and paged for 13–15), returned by `readBoard`; `readLiveBoard` returns `BoardV15`. `validate` accepts `schemaVersion` 1 to 15; `upgrade`, `empty` and `add` return `BoardV15`.

## Older versions of the application

A board file or a saved local board whose `schemaVersion` is greater than **15** is "made by a newer version of
Board", with the existing words (board file v5, storage v4). An application built before this version refuses a
version 15 document in the same way; pre-launch, nothing more is promised.

## Version references in other contracts

New and edited documents are **15** everywhere. What each input **accepts on reading** keeps its own range:
saved boards and board files accept **1 to 15** (this contract, storage v4, board file v5). Catalogue activities
stay at schema 7 as today (`apps/web/src/activities.ts` stays unchanged). Every room input (client updates and the live board, stored snapshots by storage version, history
versions, backups by storage version, created and imported boards, team templates) accepts exactly the range in
**sync v17's single input matrix** ("Input matrix"), which this contract does not restate. Every
input is validated at its declared version first, then upgraded to 15.

## Verification

Unit tests cover: a valid video at schema 15 and its canonical key order; each field refused out of bounds
(hashes not 64 lowercase hex, `poster` equal to `asset`, pixel sizes 0 and 1,921, `durationMs` 0 and
86,400,001, a `name` that is empty, of 256 code points, or holds a control character or a lone surrogate, a description of 1,001 code points or with a lone surrogate, an extra or missing key); a video in a
version 14 document refused; a hash used as both a picture and a video refused; a connector to a video refused;
a video in a section accepted; `upgrade` of versions 1, 13 and 14 to 15 changing nothing else; `empty()` at 15;
`isVideo`, `isMedia`, `pictureOf`, `assetsOf`, `keepsProportions` and `eligibleIdea` for every object type; the
local reading range (1–15 accepted, 16 refused) with an explicit schema 13 case kept.

## References

Unchanged from v20. A video's look, words and keys are [interaction v50](0001-interaction-v50.md); its modules
are [web modules v48](0001-web-modules-v48.md); its shared-document handling is sync v17.
