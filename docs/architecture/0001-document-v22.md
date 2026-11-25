# 0001 — Board document contract

CONTRACT VERSION: 0001 document v22 (2026-11-25)

Status: Draft for 0012-W5 v1. When accepted it replaces [document v21](0001-document-v21.md) for later work.
Every rule of v21 (and, through it, v20, v19 and v18) stays word for word except as below; v21's text is kept here
in full, with its version numbers moved on only where this version requires it. This version adds the **link**
object type (a **link card**) and **schema version 16**. How a card is pasted, drawn, filled in and changed back to
text is [interaction v52](0001-interaction-v52.md); how a card's page details are fetched is
[link preview v1](0012-link-preview-v1.md); how a card travels through a room is [sync v18](0003-sync-v18.md); in
files, [board file v6](0006-board-file-v6.md); in team templates, [team templates v4](0008-team-templates-v4.md).

**Changes from v21, in short.** A new `link` type, valid from schema 16; schema 16 is version 15 plus link cards, and
the upgrade from 15 to 16 changes nothing but `schemaVersion`. A card's `asset` (its thumbnail) is a **picture** of
the document, so `pictureOf`, `assetsOf` and "a document's pictures" include it; `isMedia` does not (a card is not an
image or a video). Every place that said 15 for the current or newest version now says 16.

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
- **Link card** (type `link`): an object that holds one web address, the page details Board's link preview service
  gave for it (title, description, site), the card's layout and its state, and optionally refers to a **thumbnail**
  by its hash.
- **Thumbnail**: a picture made in the paster's browser from the page's picture ([interaction v52](0001-interaction-v52.md):
  at most 640 px on its longer side), kept exactly as any picture is (document v10's picture: hash, bytes, pixel
  size) and of any picture type an image may have. The document holds only its hash. A card holds no pixel size of
  its own: the thumbnail is drawn inside the card's fixed picture area (interaction v52).
- **An object's picture**: an image's `asset`; a video's `poster`; a link card's `asset` when it is not `null`. Other
  objects, and a card whose `asset` is `null`, have none.
- **A document's pictures**: the distinct hashes that are an object's picture (images' assets, videos' posters and
  link cards' thumbnails). **A document's videos**: the distinct `asset` values of its videos. **A document's
  assets**: both sets together.
- **Media**: images and videos (`isMedia`). A link card is not media: it has no description control, no play mark,
  no picture tools, and the bars and checks written for media do not apply to it. Where a rule concerns the files a
  document names, it says "assets" or "pictures" (above), which include a card's thumbnail.

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
4. **One hash, one kind.** In one document, no hash is both a picture (an image's `asset`, a video's `poster` or,
   from version 16, a link card's `asset`) and a video (a video's `asset`). A document that breaks this is invalid.
5. Several videos may refer to the same video hash (copies, Duplicate). They need not share their `poster` or
   `durationMs` (a first frame made by another browser may differ in bytes).
6. Duplicating a video, copying and pasting one, and Undo keep `asset`, `poster`, `pixelWidth`, `pixelHeight`,
   `durationMs`, `name` and `description`, with a fresh `id` and `generation`, as for images (v10). Templates and
   activities never hold a video: a template object list holding one is invalid, as for images. (Team templates
   hold images and videos since [team templates v3](0008-team-templates-v3.md), which replaces this sentence for
   team templates; catalogue activities still never do.)
7. A video's `generation` follows the existing generation rules: every change to any of its keys is a change
   of the object.

## Saved document (version 16)

A version 16 document has exactly the keys, order and rules of a version 15 document (above), and may also hold
link cards. A version 1 to 15 document holding a link card is rejected (`validFrom: 16`).

A link card has these keys, in this order:

| Field | Required value |
| --- | --- |
| `id` | As every object |
| `generation` | As every object |
| `type` | `"link"` |
| `page` | As every object (v18) |
| `group` | As every object |
| `section` | As every object |
| `url` | The web address: a string of **1 to 1,000** characters (the text object's limit, so Change back to text always fits; the paste checks the parsed `href`'s length before it makes a card, interaction v52) that the WHATWG URL parser (`new URL(url)`) reads as an absolute URL whose `protocol` is `http:` or `https:`, whose `username` and `password` are empty, and whose serialisation (`href`) is exactly `url` |
| `title` | The page's title: a string of at most **300** code points with no lone surrogate and no control character (U+0000–U+001F, U+007F–U+009F) |
| `description` | The page's short description: as `title`, at most **500** code points |
| `site` | The site's name: as `title`, at most **100** code points |
| `asset` | The thumbnail's hash (64 characters, each `0`–`9` or `a`–`f`), or `null` when the card has no thumbnail |
| `layout` | `"vertical"` or `"horizontal"` |
| `state` | `"loading"`, `"ready"` or `"linkOnly"` |
| `requestedAt` | A safe integer, at least 0: the time the card was pasted, in milliseconds since 1970-01-01T00:00:00Z on the paster's clock |
| `x`, `y`, `width`, `height` | The card's rectangle, as every rectangle (within the document bounds), with the size rule below |
| `order` | As every object |

A link card has no `text`, `color`, `textSize`, `align`, `marks`, `shape`, `fill`, `border`, `points`, `from`,
`to`, `pattern`, `poster`, `pixelWidth`, `pixelHeight`, `durationMs` or `name`. Every key above is always present:
"no thumbnail" is `asset: null`, never a missing key. `validate` checks keys, values and bounds; `canonical()`
writes the keys in the order above.

**State and keys.** Which keys may be empty depends only on `state`:

| `state` | `title` | `description`, `site` | `asset` | `layout` |
| --- | --- | --- | --- | --- |
| `loading` | `""` | `""` | `null` | `"vertical"` |
| `ready` | At least one character that is not white space (`/\S/u`) | Any value the field table allows, `""` included | A hash or `null` | Either |
| `linkOnly` | `""` | `""` | `null` | Either |

**Size rule.** A card's `width` × `height` must be one of the **card sizes**, the union of every size in the table
below: **306 × 100, 306 × 230, 306 × 250, 306 × 251, 306 × 268, 306 × 271, 306 × 288, 480 × 64 and 480 × 114**. Every
other size is invalid. Validity does **not** depend on `state`, `layout` or `asset`: any card size is valid with any
state and layout. So a merge of two concurrent edits, one writing the card's rectangle (a move) and one writing its
other keys and its size (an arrival or a layout choice), never makes an invalid card (sync v18). The table says which
size a browser **writes** when it writes a card's look (its state, layout and thumbnail); each value is a safe
integer. A card may still hold another card size (after such a merge); its face is then drawn inside its stored
rectangle (interaction v52), and nothing rewrites it:

| `state` | `asset` | `layout` | Size written (`width` × `height`) |
| --- | --- | --- | --- |
| `loading` | `null` | `vertical` | 306 × 288 |
| `ready` | a hash | `vertical` | 306 × one of **230, 250, 251, 268, 271, 288**: interaction v52's content-fit height `210 + 20·Lt + (Ld > 0 ? 4 + 17·Ld : 0)` for Lt title lines (1–2) and Ld description lines (0–2) |
| `ready` | a hash | `horizontal` | 480 × 114 |
| `ready` | `null` | `vertical` | 306 × 100 |
| `ready` | `null` | `horizontal` | 480 × 64 |
| `linkOnly` | `null` | either | 480 × 64 |

`x` and `y` follow the rule for every rectangle: the **document bounds** of `document.ts`, `x ≥ −1,000,000`,
`y ≥ −1,000,000`, `x + width ≤ 1,000,000` and `y + height ≤ 1,000,000`. A browser that gives a card a new size (an
arrival, a layout choice), or puts a text object in a card's place (Change back to text), shifts that object left
and/or up just enough to stay within the bounds; that is the only case where such an edit changes `x` or `y`
(interaction v52). The card's `sizeRange` is 64 to 480 in each direction, so the generic bounds hold; `validLink`
applies the card sizes.

**Link rules.**
1. A card is a rectangle whose written size only its state, layout and thumbnail decide (the size rule). It has no
   resize handles and does not keep proportions (`keepsProportions` is false); it is never scaled. A selection that
   holds a card cannot be resized at all, neither its cards nor its other objects (interaction v52, web modules v50);
   any edit that gives a card a size that is not one of the card sizes is invalid.
2. A card is never a container, a connector end or a mind-map node; a connector whose `from` or `to` names a card is
   invalid (`eligibleIdea` excludes it, as it excludes images). It may be a section's member exactly as an image is
   (`sectionIdea`). It may take part in workshop voting as an image does (`voting: true`).
3. A card counts as **one** object of the 250 (v18 "Limits"). Its keys, `url` and the texts included, count toward
   the 2,097,152-byte canonical payload as every value does; its thumbnail's bytes never do.
4. **Its thumbnail is a picture.** A card's non-null `asset` is one of the document's pictures for every rule that
   counts, keeps, sends or checks pictures: the 50 MiB of pictures a board (storage v5, board file v6, hosted
   storage), rule 4 above (one hash, one kind), files, templates and the room's held check (sync v18). Several cards,
   and cards and images, may name the same picture.
5. **Loading cards.** A card is written `loading` when it is pasted, and changed by one later edit, the **arrival**
   (sync v18, interaction v52), to `ready` (texts, possibly a thumbnail, its size) or `linkOnly` (its size); the
   arrival writes only `title`, `description`, `site`, `asset`, `state`, `layout` and the card's rectangle (`x`, `y`,
   `width`, `height`), with `x` and `y` as the paster's board holds them at the arrival, changed only by the bounds
   shift above. A card
   whose arrival never comes stays `loading` in the document. Every program that draws or acts on a card treats a
   `loading` card whose `requestedAt` is **20,000 ms** or more before its own clock's present time as `linkOnly`:
   it is drawn with the link-only face inside its stored rectangle (306 × 288, interaction v52) and offers what a
   link-only card offers. This is a reading rule, not an edit: nothing is written for it, and the stored card keeps
   its loading size. An edit a person makes to such a card (other than moving, arranging, grouping, sectioning or
   deleting it) writes it as `linkOnly` with the link-only size (480 × 64), its `x` and `y` kept except for the bounds
   shift, in the same edit.
6. **Nothing fetches again. Amendment A1/A2 (2026-11-25).** Each path keeps `url`, `title`, `description`, `site`,
   `asset`, `layout`, `state` and `requestedAt`. Duplicate, copy and paste, Add template, and team Undo and Redo
   give the card a fresh `id` and `generation`. Single-user Undo and Redo keep its `id` and give it a fresh
   `generation`, as local history does today ([interaction v52](0001-interaction-v52.md)). Opening a board file,
   importing it into a team workspace, and writing a board file (including Save a copy) keep both the card's `id`
   and `generation` ([board file v6](0006-board-file-v6.md)). None asks the link preview service. A copied `loading`
   card stays `loading` and is drawn link-only once rule 5's 20,000 ms have passed. Team templates may hold cards
   ([team templates v4](0008-team-templates-v4.md)); catalogue activities never do (they stay at schema 7).
7. A card's `generation` follows the existing generation rules: every change to any of its keys is a change of the
   object.
8. **Opening the link** reads `url` only and changes nothing in the document.

## Object type module and registry

`packages/board-rules/src/objects/video.ts` (from v21, unchanged by this version) exports `VideoKeys` (`{ asset: string; poster: string;
pixelWidth: number; pixelHeight: number; durationMs: number; name: string; description: string }`), `validVideo(value: object):
boolean` (the field rules above) and the type record `video`:
`{ voting: true, type: "video", label: "Video", tool: null, validFrom: 15, body: "image-body", points: false,
text: false, ends: false, container: false, richText: false, extraKeys: ["asset", "poster", "pixelWidth",
"pixelHeight", "durationMs", "name", "description"], savedKeys: [the table's keys in order], validExtras: validVideo,
sizeRange: { min: 1, max: 20000 }, shapePaint: false, growsWithText: false, labelPrefix: () => "video" }`.

`packages/board-rules/src/objects/link.ts` (new, this version) exports:
- `LinkKeys`: `{ url: string; title: string; description: string; site: string; asset: string | null; layout:
  "vertical" | "horizontal"; state: "loading" | "ready" | "linkOnly"; requestedAt: number }`;
- `validLink(value: object): boolean`: the field table, the state-and-keys table and the size rule above (any card
  size, whatever the state; it reads the object's `width` and `height`, as `validTape` does);
- the type record `link`:
  `{ voting: true, type: "link", label: "Link", tool: null, validFrom: 16, body: "link-body", points: false,
  text: false, ends: false, container: false, richText: false, extraKeys: ["url", "title", "description", "site",
  "asset", "layout", "state", "requestedAt"], savedKeys: ["id", "generation", "type", "page", "group", "section", "url",
  "title", "description", "site", "asset", "layout", "state", "requestedAt", "x", "y", "width", "height", "order"],
  validExtras: validLink, sizeRange: { min: 64, max: 480 }, shapePaint: false, growsWithText: false,
  labelPrefix: () => "link" }`.

`objects/registry.ts`:
- Video is already registered (v21) and stays as it is. `ObjectType` gains `typeof link`; `RectangleType` gains
  `typeof link.type`; every `Exclude<…>` list that names `typeof video` also names `typeof link` (`TextRectangleType`,
  `placementTool`, `hasText`, `ADD_OPTIONS`), so a card is neither placed by a tool nor in `ADD_OPTIONS`.
- `OBJECT_TYPES` inserts `link` **directly after `video`**, so it reads, in full: `[sticky, shape, text, section,
  table, stroke, connector, image, video, link, mindNode, tape]` (every other position as today).
- Exports from v21, unchanged: `isVideo(o)`, `isMedia(o)` (`isImage(o) || isVideo(o)`: a card is not media) and
  `videoType()`.
- New exports: `isLink(o)` (type guard: `o.type === link.type`, narrowing to `LinkKeys & Rectangle`) and `linkType()`
  (returns `link`).
- Changed exports: `pictureOf(o): string | undefined` is an image's `asset`, a video's `poster`, a card's `asset`
  when it is not `null`, otherwise `undefined`; `assetsOf(o): string[]` is `[asset]` for an image, `[asset, poster]`
  for a video, `[asset]` for a card whose `asset` is not `null`, and `[]` otherwise.
- `eligibleIdea` also excludes cards (`!isLink(o)` beside its existing `!isMedia(o)`);
  `keepsProportions` stays `hasPoints(o) || isMedia(o)` (false for a card); `extraValues` accepts `VideoKeys` and
  `LinkKeys`.

A caller that uses `isMedia` to mean "this object names a stored file" (rather than "this is an image or a video")
uses `assetsOf(o).length > 0` or `pictureOf(o)` instead wherever a card must be included; sync v18, board file v6
and team templates v4 name those places.

The registry and `document.ts` keep asking the type record rather than comparing type names.

## Canonical payload

As v20, with a video's keys and a card's keys in the orders above. No other sorting.

## Reading version 1 to 15 documents

`upgrade` reads a version 1 to 14 document exactly as v18, v19, v20 and v21 say (to version 15), and a version 15
document as it is, then sets `schemaVersion` to **16**. No other key changes: the step from 15 to 16 adds nothing.
`empty` and `add` create version 16 documents. A version 16 document is not upgraded. Opening an older board follows
v18's rule word for word with 16 for 13: the upgrade happens **in memory**, is not an edit, never writes storage,
and the next explicit Save writes version 16. An unedited board's export and its canonical bytes are those of its own
version (v1–15 round trips stay byte-exact); an edited one exports version 16. `payloadBytes` excludes `pages` and
every `page` for versions 13, 14, 15 and 16 alike. The "one hash, one kind" check (video rule 4) runs for versions 15
and 16.

**Types.** `document.ts` keeps v21's `VideoItem` (the video table's keys, `page: string`, and `text?`, `color?`,
`textSize?`, `align?`, `marks?`, `shape?`, `fill?`, `border?` as `never`). It renames v21's concrete schema-15 union
to **`StoredItemV15 = StoredItemV14 | VideoItem`** (where `StoredItemV14` is the previous schema-14 union) and adds
**`LinkItem`** (the card table's keys, `page: string`, and `text?`, `color?`, `textSize?`, `align?`, `marks?`,
`shape?`, `fill?`, `border?` as `never`), **`ItemV16 = StoredItemV15 | LinkItem`** and **`BoardV16`**
(`schemaVersion: 16`). `Board["schemaVersion"]` gains 16 and `Item` gains `LinkItem`. The **current-document**
aliases follow the newest version, as `BoardV12` already does: `BoardV12`, `BoardV14` and `BoardV15` become aliases
of `BoardV16`, and `ItemV12`, `ItemV14` and `ItemV15` of `ItemV16`, so the callers that name the current board keep
their names. A reader that can return an older version does not use those aliases: the **one decoded type** is sync
v18's `DecodedBoard` (exported from `packages/board-sync/src/codec.ts`: the union of this contract's board shapes for
versions 10 to 16 exactly as stored, unpaged for 10–12 and paged for 13–16, its version 15 member built from
`StoredItemV15`), returned by `readBoard`; `readLiveBoard` returns `BoardV16`. `validate` accepts `schemaVersion` 1
to 16; `upgrade`, `empty` and `add` return `BoardV16`.

## Older versions of the application

A board file or a saved local board whose `schemaVersion` is greater than **16** is "made by a newer version of
Board", with the existing words (board file v6, storage v5). An application built before this version refuses a
version 16 document in the same way; pre-launch, nothing more is promised.

## Version references in other contracts

New and edited documents are **16** everywhere. What each input **accepts on reading** keeps its own range:
saved boards and board files accept **1 to 16** (this contract, [storage v5](0001-storage-v5.md), board file v6):
the local read is `validate`'s range, and only the board list's `newer` state moves from above 15 to above 16. Catalogue activities stay at schema 7 as today (`apps/web/src/activities.ts` stays unchanged). Every
room input (client updates and the live board, stored snapshots by storage version, history versions, backups by
storage version, created and imported boards, team templates) accepts exactly the range in **sync v18's single
input matrix** ("Input matrix"), which this contract does not restate. Every input is validated at its declared
version first, then upgraded to 16.

## Verification

Unit tests cover: a valid video at schema 15 and its canonical key order; each field refused out of bounds
(hashes not 64 lowercase hex, `poster` equal to `asset`, pixel sizes 0 and 1,921, `durationMs` 0 and
86,400,001, a `name` that is empty, of 256 code points, or holds a control character or a lone surrogate, a description of 1,001 code points or with a lone surrogate, an extra or missing key); a video in a
version 14 document refused; a hash used as both a picture and a video refused; a connector to a video refused;
a video in a section accepted; `upgrade` of versions 1, 13 and 14 to 15 changing nothing else; `empty()` at 15;
`isVideo`, `isMedia`, `pictureOf`, `assetsOf`, `keepsProportions` and `eligibleIdea` for every object type; the
local reading range (1–15 accepted, 16 refused) with an explicit schema 13 case kept.

This version replaces the last three items above with their version 16 forms (`upgrade` of versions 1, 13, 14 and
15 to 16 changing nothing else; `empty()` at 16; the local reading range 1–16 accepted, 17 refused, with explicit
schema 13 and 15 cases kept) and adds:
- a valid card at schema 16 in each row of the size rule, and its canonical key order;
- a card in a version 15 document refused;
- each field refused out of bounds:
  - `url`: empty, 1,001 characters, relative, `ftp:`, `javascript:`, with a user name or password, not equal to
    its own `href` (for example `HTTP://Example.com`);
  - `title` of 301, `description` of 501 and `site` of 101 code points, each with a control character or a lone
    surrogate;
  - `asset` not 64 lowercase hex, and a missing `asset` key (not `null`);
  - an unknown `layout` or `state`; `requestedAt` −1, 1.5 and 2^53;
  - an extra or missing key;
- the state-and-keys table: a `loading` or `linkOnly` card with a non-empty text or a non-null `asset` refused; a
  `ready` card with an empty or white-space-only `title` refused; a `ready` card with empty `description` and `site`
  accepted; a `loading` card with `layout: "horizontal"` refused;
- the size rule: each of the nine card sizes accepted, and accepted with every state (among them a `linkOnly` card
  at 306 × 288, a `ready` card with a thumbnail and `layout: "horizontal"` at 306 × 288, and a `loading` card at
  480 × 114); each neighbouring size refused whatever the state (305 × 288, 306 × 287, 306 × 289, 306 × 252,
  306 × 300.5, 306 × 114, 306 × 64, 480 × 65, 480 × 100, 480 × 288);
- the document bounds at the edge: a 306-wide card at `x` 999,694 accepted and a 480-wide card at the same `x`
  refused; a 288-tall card at `y` 999,712 accepted and the same card at `y` 999,713 refused;
- a card whose `asset` is also a video's `asset` refused; a card and an image sharing a picture accepted;
- a connector to a card refused; a card in a section accepted;
- `isLink`, `linkType`, `pictureOf`, `assetsOf` (a card with and without `asset`), `isMedia` (false for a card),
  `keepsProportions` (false) and `eligibleIdea` (false) for a card.

## References

Unchanged from v21. A video's look, words and keys are [interaction v50](0001-interaction-v50.md); its modules
are [web modules v48](0001-web-modules-v48.md); its shared-document handling is sync v17. A link card's look, words
and states are [interaction v52](0001-interaction-v52.md); its modules are [web modules v50](0001-web-modules-v50.md);
its page details come from [link preview v1](0012-link-preview-v1.md); its shared-document handling is
[sync v18](0003-sync-v18.md); in files [board file v6](0006-board-file-v6.md); in team templates
[team templates v4](0008-team-templates-v4.md).
