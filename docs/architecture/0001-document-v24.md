# 0001 — Board document contract

CONTRACT VERSION: 0001 document v24 (2026-11-27)

Status: Draft for 0011-W3 v1. When accepted it replaces [document v23](0001-document-v23.md) for later work.
Every rule of v23 (and, through it, v22, v21, v20, v19 and v18) stays word for word except as below; v23's text is kept
here in full, with its version numbers moved on only where this version requires it. This version adds **merged
cells** to tables (a table's `merges`), the **table rules** that choose, merge, split, move and duplicate rows,
columns and cells, and **schema version 18**. How cells are chosen, merged, moved and duplicated, and how a merged
cell is drawn, is [interaction v54](0001-interaction-v54.md); its modules are [web modules v52](0001-web-modules-v52.md);
how merges travel through a room is [sync v20](0003-sync-v20.md); in files, [board file v8](0006-board-file-v8.md); in
team templates, [team templates v6](0008-team-templates-v6.md); in the local store, [storage v7](0001-storage-v7.md);
through the server, [API v18](0003-api-v18.md).

v23 added **links in text** (an optional `link` on a formatting run of a rich-text object), the **link address rule**
and schema version 17. How a link is added, drawn, shown on hover and followed is
[interaction v53](0001-interaction-v53.md); its modules are [web modules v51](0001-web-modules-v51.md). Its rules stay
as written below. v22 added the **link** object type (a **link card**) and schema version 16. How a card is pasted,
drawn, filled in and changed back to text is [interaction v52](0001-interaction-v52.md); how a card's page details are
fetched is [link preview v1](0012-link-preview-v1.md). Its rules stay as written below.

**Changes from v23, in short.** A **table** (document v20) gains the key `merges`, written after `cells`: a list of
**merged cells**, each named by its top-left cell (its **anchor**) and how many rows and columns it covers. Merges
never overlap, cover at least two cells and stay inside the table, and a cell a merge covers (other than its anchor)
holds no text. Schema 18 is version 17 plus `merges`; the upgrade from 17 to 18 adds `merges: []` to every table and
changes nothing else, so, unlike the steps from 15 to 16 and from 16 to 17, it changes the tables of a document that
holds any. `objects/table.ts` gains pure rules to merge a rectangle (`mergeRange`), split a merge (`splitMerge`), move
a run of rows or columns (`moveAxis`) and duplicate one (`duplicateAxis`), with the checks that give their reasons
(`canMerge`, `canMove`, `canDuplicate`); `insertAxis` and `deleteAxis` grow and shrink merges, `setCell` refuses text
in a covered cell, `remapTable`, `canonicalTable` and `validTable` carry merges, and `nextCell` and `neighbourCell`
treat a merged cell as one cell. The table limits (1–50 rows, 1–20 columns, 1,000 code points a cell, 5,000 cells a
board, one object of the 250) are unchanged. Links in text stay valid at 18: `validate` refuses a `link` in a mark
only below version 17 (its test becomes `schemaVersion < 17`). Every place that said 17 for the current or newest
version now says 18.

**v23's changes from v22, in short.** A **mark** (a formatting run, document v4) may hold an optional `link`: the full web
address of the code points it covers. A mark is valid with at least one flag **or** a link; two touching marks merge
only when their flags and their links are both equal. Only marks of **rich-text** objects (sticky, shape, text) may
hold a link. A stored `link` must pass the new **link address rule** (`linkAddress` in
`packages/board-rules/src/text-link.ts`, a new rules-package file) and equal its own result. Schema 17 is version 16
plus links in marks, and the upgrade from 16 to 17 changes nothing but `schemaVersion`. `marks.ts` carries links
through text edits (`remap`), keeps them when a flag is toggled (`toggle`) and merges by flags and link (`normalize`).
A text link has nothing to do with a link card: the card's `url` and its rules are unchanged. Every place that said 16
for the current or newest version now says 17.

## Terms

- **Rich-text object**: an object whose type record has `richText: true`: today a sticky, a shape and a text object.
  Every other type (sections, connectors and their labels, mind-map nodes (`mindNode`), tables and their cells, and every type
  without text) is not.
- **Link** (in text, from version 17): a web address held by the `link` key of the marks that cover some code points
  of a rich-text object's `text`. **A link** of a text, as a range, is a maximal run of consecutive code points whose
  marks carry the same `link` value, whatever their flags: one link may span several marks (for example when part of
  it is bold). A text link is not a link card and never becomes one.
- **Index** (of a table's row or column): its position in the table's current order (`rows` top to bottom, `columns`
  left to right), from 0. A row's or column's **id** is stable; its index changes when rows or columns are inserted,
  deleted or moved.
- **Merge** (a **merged cell**, from version 18): one entry of a table's `merges`. It covers the rectangle of cells
  whose row indices are the anchor's row index to that plus `rows` − 1, and whose column indices are the anchor's
  column index to that plus `columns` − 1. Its **anchor** is its top-left cell, named by `row` and `column`; every
  other cell it covers is a **covered** cell. A merge's **span** on an axis is the run of indices it covers on that
  axis: `[a, a + rows − 1]` for rows, with `a` the anchor's row index (columns alike).
- **Run** (of rows, or of columns): a non-empty list of distinct ids of that axis whose indices, once sorted, are
  consecutive. Its **first** and **last** are its lowest and highest index. A merge lies **wholly inside** a run when its
  span on that axis lies within `[first, last]`; it **partly overlaps** the run when its span and the run share an
  index but it does not lie wholly inside.
- **Gap** (on an axis with `n` entries): an integer `g` from 0 to `n`, the place before the entry at index `g` (`n` is
  after the last entry). A gap `g` lies **strictly inside** a span `[a, b]` when `a < g ≤ b` (the entries on both of its
  sides are in the span).
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

## Saved document (version 17)

A version 17 document has exactly the keys, order and rules of a version 16 document (above), except that a **mark**
(document v4) may also hold `link`. A version 1 to 16 document holding a mark with a `link` key is rejected.

From version 17 a mark is an object with exactly these keys, in this order, with the optional keys present only as
below:

| Field | Required value |
| --- | --- |
| `start` | As in document v4 |
| `end` | As in document v4 |
| `bold`, `italic`, `strike` | As in document v4: optional; when present, `true` |
| `link` | Optional; when present, a string that the **link address rule** (below) accepts **unchanged**: `linkAddress(link)` answers `{ ok: true, href }` with `href === link` |

**Mark rules (version 17).** They replace document v4's "each mark has at least one flag" and "two marks that touch
never have the same flags"; every other rule of document v4 for marks stays (code points, sorted, non-overlapping, at
most 1,000 marks, `[]` for no formatting, a `false` flag or an unknown key rejected):
1. **At least one flag or a link.** Each mark has at least one flag, or a `link`, or both.
2. **Normal form.** Two marks that touch (one's `end` equals the next one's `start`) never have both the same flags
   and the same `link` (no `link` on either counts as the same); they would be one mark. So a link whose flags change
   part way is two or more touching marks with the same `link`, and two different links that touch are two marks.
3. **Rich text only.** A mark holding `link` is valid only on a rich-text object (sticky, shape, text). A `link` on
   any other object's marks (a connector's label, a mind-map node of type `mindNode`, a section) makes the document
   invalid. Sections' and `mindNode` objects' marks stay exactly `[]` as today; tables and types without text hold no
   `marks`.
4. **Key order.** `canonical()` writes a mark's keys as `start`, `end`, `bold`, `italic`, `strike`, `link` (each
   optional key only when present). `markOf` copies `link`, after `strike`, when the mark has one.
5. **Limits.** A `link` counts toward the 2,097,152-byte canonical payload as every value does, never toward the
   text's code-point limit; the 1,000-mark limit is unchanged. `text` still holds the object's complete plain text
   (document v4's plain-text read path): counting, plain-text copies and readers that do not apply formatting lose no
   character and carry no link.
6. **Generations.** Setting, changing or removing a link changes the object's `marks`, so it is a change of the object
   under the existing generation rules, as a flag change is.
7. **No following in the document.** No document rule follows, fetches or checks a link's target. Whether a link
   points at this board is decided only when it is used ([interaction v53](0001-interaction-v53.md)), never when it
   is saved; a link to a page or object that no longer exists stays valid.

## Link address rule

`packages/board-rules/src/text-link.ts` (new; the rules package grows from 18 to 19 files) exports
`linkAddress(raw: string): { ok: true; href: string } | { ok: false }`. In this order:
1. `s` is `raw.trim()`.
2. Refused when `s` is empty, when `s.length` is above **2,048** (checked before parsing), or when `s` contains white
   space or a control character (`/[\s\p{Cc}]/u`, which after the trim means one inside it).
3. **A bare address gets `https://`.** When `s` does not start with a scheme (`/^[a-z][a-z0-9+.-]*:(?!\d)/i` does
   not match; a colon followed by a digit is a port, not a scheme) and its **host part** (the text of `s` before its first `/`, `?` or `#`; all of `s` when it has none)
   contains a `.`, `s` becomes `"https://" + s`. Otherwise `s` is kept as it is.
4. `url = new URL(s)` (the WHATWG URL parser, no base). Refused when it throws, when `url.protocol` is neither
   `"http:"` nor `"https:"`, when `url.hostname` is empty, when `url.username` or `url.password` is not empty, or when
   `url.href.length` is above 2,048.
5. Otherwise accepted: `{ ok: true, href: url.href }`. The stored value is always `url.href`, the parser's normalised
   form (for example `example.com` gives `https://example.com/`).

Everything else is refused (`{ ok: false }`): every other scheme (`javascript:`, `data:`, `file:`, `mailto:`, `ftp:`,
…), relative addresses and text with no `.` and no scheme. **Local and private hosts are accepted** (`localhost` with
a scheme, `127.0.0.1`, private ranges, `.local` names): the person's own browser opens the link, Board fetches
nothing. The function is pure: no network, no clock, no storage. It is checked **when a link is set**
(interaction v53), **when a document is read** (`validate`: local storage, board files, team templates, the room's
codec and its document check, sync v19) and **again just before a link is opened** (interaction v53).

This rule is a text link's only. A link card's `url` keeps document v22's rule (1 to 1,000 characters, no `https://`
added), and the link preview service keeps its own address check ([link preview v1](0012-link-preview-v1.md));
neither changes.

## Links in `marks.ts` and `text-link.ts`

**Formats.** Each code point of a text has a **format**: its flags and its link (none, or one string). Two formats
are equal when their flags are equal and their links are equal (none equals none). `marks.ts` keeps one internal
coverage step and one span step, now over formats:
- **coverage** gives each code point in `[0, length)` the union of the flags of every mark that covers it, and the
  `link` of the **last** mark in array order that covers it and has one (a valid array never overlaps, so this only
  decides what `normalize` makes of an invalid input);
- **spans** turns coverage back into marks: one mark for each maximal run of code points with equal formats, skipping
  runs with no flag and no link, its keys in the order of mark rule 4.

`Mark` gains `link?: string`. `FLAGS`, `Flag`, `FLAG_LABELS`, `TextSelection` and `codePointOffset` are unchanged; a
link is not a flag. The exported functions behave as follows; each keeps its current signature except `remap`, which
gains an optional last parameter:
- **`validMarks(value, length)`**: as today, and also accepts an own `link` key whose value is a non-empty string; a
  mark needs at least one `true` flag or a `link`; two touching marks are refused only when their formats are equal.
  It does not apply the link address rule or the rich-text rule: `validate` in `document.ts` does, after
  `validMarks`, for every mark of every object, and refuses with the existing "Invalid marks" error a `link` in a
  version 1 to 16 document, a `link` on an object whose type record has `richText: false`, and a `link` that
  `linkAddress` does not accept unchanged. (`text-link.ts` imports `marks.ts`; `marks.ts` does not import
  `text-link.ts`.)

  **Order of checks in `validate`** (unchanged order, the link checks added to the last step): for each object, its
  keys, then the generic value checks ("Invalid object"), then its type's `validExtras` ("Invalid object paint"), then
  its style, then its marks (`validMarks`, then the version, rich-text and address rules above, "Invalid marks").
  So an object whose `validExtras` already refuses any non-empty `marks` fails there first, before any link rule:
  a **connector** with a linked mark (even one whose `link` is well formed) is refused by the connector's
  `validExtras` (`objects/connector.ts`: its `marks` must be empty) and a `mindNode` with a linked mark by
  `validMindNode`'s `marks.length === 0` check, each as "Invalid object paint". A section (`validExtras` accepts it)
  with a linked mark is refused at the marks step ("Invalid marks"). Every
  one of these is the same refusal for each reader (an invalid document; in the room, `invalid_document`, sync v19,
  which also states where the room's codec checks a link first).
- **`normalize(marks, length)`**: `spans(coverage(marks, length))`. It keeps every link as given, clamps marks to
  `length`, and merges touching runs only when their formats are equal. The room's repair keeps valid links through
  it (sync v19).
- **`toggle(marks, length, start, end, flag)`**: as today, it adds the flag to every code point of the clamped range,
  or removes it when every code point there already has it. It changes only that flag: **every code point keeps its
  link**.
- **`formatted`** and **`formattedRange`**: unchanged; they read flags only and ignore links.
- **`segments(text, marks)`**: pieces split where the format changes, so by link as well as by flags; each piece is
  `{ text, bold?, italic?, strike?, link? }`, with `link` present when its code points carry one. Drawing and exports
  underline linked pieces (interaction v53).
- **`remap(marks, before, after, edit?: { start: number; end: number })`**: as today, no marks give `[]`, and an
  unchanged text gives the normalised marks. Otherwise it maps the **flags** and the **links** of `before` onto
  `after` separately, each through a **changed range** (a prefix length `P` and a suffix length `S`, in code points,
  such that `before` and `after` share their first `P` and their last `S` code points and `P + S` is at most the
  code-point count of each; the code points of `before` between them are removed and those of `after` between them
  are inserted), and then joins them code point by code point and normalises:
  - **Flags: today's rule, exactly.** The changed range is today's diff (`P` the longest common prefix, then `S` the
    longest common suffix of the rest), whether or not `edit` is given. Kept code points keep their flags; each
    inserted code point takes the flags of `before`'s code point `max(0, P − 1)`, or none when `before` is empty. So
    `remap` never changes how bold, italic or strikethrough move, links or not.
  - **Links: the actual edit when it fits.** With `edit` (the editor's actual edit: `start` and `end` are code-point
    offsets in `before` of the range the change replaced, so for typing or pasting the selection before the change, a
    caret being `start === end`), the changed range is `P = edit.start` and `S = count(before) − edit.end`, **when it
    fits**: `0 ≤ start ≤ end ≤ count(before)`, `count(after) ≥ P + S`, and `before`'s first `P` and last `S` code
    points equal `after`'s. Otherwise (`edit` absent or not fitting: a whole-value change such as a remote update,
    Undo or Redo, or a programmatic set) it is today's diff, as for flags. Kept code points keep their link; each
    inserted code point takes a link only when both neighbours of the change exist in `before` (its code point
    `P − 1`, so `P > 0`, and its code point `count(before) − S`, so `S > 0`) and carry the **same** link: then that
    link; otherwise none. This places a link's growth exactly where the text was typed, even among repeated
    characters. Which edits the editor passes, and how it derives a deletion's range, is
    [web modules v51](0001-web-modules-v51.md)'s.

  So typing or pasting strictly inside a link extends it; typing at a link's start or end does not (the new code
  points get no link, and their flags follow today's rule); deleting part of a link shortens it, and deleting every
  code point of a link removes it. For text without links the result is exactly today's, with or without `edit`.

**Link-range helpers** (`text-link.ts`, beside `linkAddress`). `start` and `end` are code point offsets, clamped to
`[0, length]`; a **caret** is `start === end`.
- **`linkAt(marks, length, start, end): { start: number; end: number; href: string } | null`**: for a range
  (`start < end`), the link that covers it, when every code point of the range carries the same `link`; for a caret,
  the link it is **inside**, when code points `start − 1` and `start` both exist and carry the same `link`. The answer
  is that whole link (its maximal run, **Terms**); otherwise `null`.
- **`touchesLink(marks, length, start, end): boolean`**: for a range, true when any of its code points carries a
  link; for a caret, true when code point `start − 1` or `start` carries one.
- **`setLink(marks, text, start, end, href: string | null): Mark[]`**: takes the object's `text` (its length is
  `count(text)`) so that it can **snap the range outward to grapheme boundaries**: `start` moves down to the start of
  the grapheme that contains code point `start`, and `end` moves up to the end of the grapheme that contains code point
  `end − 1`, so a link never starts or ends inside a grapheme (an emoji sequence, a letter with its combining marks).
  Graphemes come from `new Intl.Segmenter(undefined, { granularity: "grapheme" })` over `text`, as `objects/shape.ts`
  already uses it; when `Intl.Segmenter` is not available, every code point is its own grapheme (no snapping). Then it
  gives every code point of the snapped range the link `href` (replacing any link there), or no link when `href` is
  `null`, and keeps every flag; the result is normalised. A caret changes nothing. It does not check `href`: callers
  pass an `href` that `linkAddress` gave. Only `setLink` snaps: a saved link boundary inside a grapheme (written by an
  older client or by `remap`) stays valid and is drawn as interaction v53 says.

`linkAt`, `touchesLink` and `setLink` never change `text`. Which range a person's command acts on (the selection, or
the whole link around a caret) is interaction v53's.

## Saved document (version 18)

A version 18 document has exactly the keys, order and rules of a version 17 document (above), except that every
**table** (document v20) also has the key `merges`. A table in a version 14 to 17 document has no `merges` key; a table
in a version 18 document always has one (`[]` when it has no merged cell). A table whose keys are not exactly its
version's list is invalid ("Invalid object", the existing keys check).

From version 18 a table has these keys, in this order: `id`, `generation`, `type`, `page`, `columns`, `rows`, `cells`,
**`merges`**, `textSize`, `group`, `section`, `x`, `y`, `width`, `height`, `order`. Every key but `merges` keeps
document v20's rule word for word (1 to 20 columns and 1 to 50 rows with lowercase UUID ids and sizes 64–1,000, cells
of 1 to 1,000 code points, `width` and `height` the sums of the sizes).

| Field | Required value |
| --- | --- |
| `merges` | An array of **merge entries** (below), `[]` for none, under the merge rules below |

A merge entry is an object with exactly these keys:

| Field | Required value |
| --- | --- |
| `row` | The id of one of the table's `rows`: the anchor's row |
| `column` | The id of one of the table's `columns`: the anchor's column |
| `rows` | A safe integer, at least 1: how many rows the merge covers, counted from the anchor's row in the current order of `rows` |
| `columns` | A safe integer, at least 1: how many columns it covers, counted from the anchor's column in the current order of `columns` |

**Merge rules.**
1. **Exact keys.** Each merge entry has exactly the keys `row`, `column`, `rows` and `columns`. `validate` accepts them
   in any key order (as for `cells` entries, document v20); `canonical()` writes them in that order.
2. **At least two cells.** `rows × columns` is at least 2.
3. **Inside the table.** With `r` the anchor row's index and `c` the anchor column's index, `r + rows` is at most the
   number of rows and `c + columns` at most the number of columns.
4. **No overlap.** No cell is covered by two merges (counting each merge's anchor as covered by it). So two merges never
   share an anchor, and no merge's anchor lies inside another merge.
5. **Covered cells hold no text.** No `cells` entry has the address of a covered cell. A merge's anchor may hold text
   (a `cells` entry, as any cell) or none; the merged cell's text is its anchor's.
6. **Order.** `validate` requires no order of the entries; `canonical()` sorts them by the anchor row's index, then by
   the anchor column's index (rule 4 makes this order strict).
7. **Limits.** A merge is not an object: it counts no object toward the 250 (v18 "Limits") and adds no cell to the
   board's 5,000 table cells (still the sum of rows × columns, document v20). Its keys count toward the
   2,097,152-byte canonical payload as every value does. Rule 4 bounds a table's merges to at most
   `⌊rows × columns / 2⌋` entries (500 for a 50 × 20 table).
8. **Generations.** Adding, changing or removing a merge changes the table's `merges`, so it is a change of the table
   under the existing generation rules, as any change of its keys is.
9. **Copies.** Document v20's table rule 3 also maps each merge's `row` and `column` to the copy's new ids and keeps its
   `rows` and `columns` (`remapTable`, below). Copying and pasting a whole table, Duplicate, Add template
   ([team templates v6](0008-team-templates-v6.md); catalogue activities stay at schema 7 and hold no table), board files ([board file v8](0006-board-file-v8.md)),
   single-user history and Undo, the room's history, Undo and backups ([sync v20](0003-sync-v20.md)) and the local
   store ([storage v7](0001-storage-v7.md)) all keep `merges`; only the copy paths give them new ids.
10. **Text in other formats.** A merged cell's text is its anchor's everywhere: CSV export writes it in the anchor's
    place and leaves every covered cell's place empty; a table made by CSV paste or import has `merges: []`
    ([interaction v54](0001-interaction-v54.md)).

`validTable` checks today's rules and then the merge rules above, in that order; a table that breaks any of them is
refused by its type's `validExtras` ("Invalid object paint", as every table rule today). It treats a table that has no
own `merges` key as having none: that case is reached only by a version 14 to 17 table, because from version 18 the
keys check requires `merges` before `validExtras` runs and, below 18, refuses a table that has it.

**Drawn heights.** A row's set height is still the stored `height`; merges change only how its **drawn** height is
found (document v20's terms; how text is measured is [interaction v54](0001-interaction-v54.md)). First every row's
drawn height is found as today from its set height and the texts of its **unmerged** cells (a merge's anchor and its
covered cells take no part). Then, for each merge in canonical order, its anchor's text is measured across the merge's
total width (the sum of its columns' widths); when that text needs more height than the sum of its rows' drawn heights
so far, the difference is added to the drawn height of the **last row of its span**. No saved size changes.

How a table's merges are kept in a room's shared document (`mergeMap`) and checked there is [sync v20](0003-sync-v20.md);
the saved and exported document is always the shape above.

## Table rules in `objects/table.ts`

All of the functions below are in `packages/board-rules/src/objects/table.ts` (re-exported by `objects/registry.ts`, as
today), so the rules package keeps its 19 files. Each is pure: no clock, no storage, no randomness except the id
functions passed in (default `crypto.randomUUID()`, as `remapTable` today). A function that changes a table returns a
new table; when it **refuses** it returns its input `t` itself, unchanged (the same reference), and never throws
(`createTable` keeps its one `throw`). The words index, merge, anchor, covered, span, run, gap, wholly inside, partly
overlaps and strictly inside are those of **Terms**. A changed table's `width` and `height` are its sums again
(`sizeTable`). A function may leave `merges` in any order; `canonicalTable` sorts them.

**New types.**
- `TableMerge = { row: string; column: string; rows: number; columns: number }`.
- `TableKeys` gains `merges: TableMerge[]`, after `cells`: `{ columns; rows; cells; merges; textSize; width; height }`.
- `CellRange = { from: CellAddress; to: CellAddress }`: two cells of one table, in either order, as opposite corners.
- `TableBounds = { top: number; left: number; bottom: number; right: number }`: row and column indices, each bound
  included.
- `TableRefusal = "invalid" | "notRun" | "edge" | "merge" | "limit" | "single"`: why a check refuses. The words a
  person reads for each are [interaction v54](0001-interaction-v54.md)'s.

**New functions.**
- **`mergeOf(t, cell: CellAddress): TableMerge | undefined`**: the merge that covers `cell` (its anchor included), or
  `undefined` when none does or `cell` is not a cell of `t`.
- **`rangeBounds(t, range: CellRange): TableBounds | undefined`**: the smallest rectangle that holds both cells,
  **grown** until every merge that covers any of its cells lies wholly inside it (repeatedly, since growing may touch
  another merge); `undefined` when either address is not a cell of `t`. A range from a merged cell to itself is that
  merge's rectangle.
- **`canMerge(t, range: CellRange): TableRefusal | null`**: `"invalid"` when `rangeBounds` is `undefined`; `"single"`
  when the bounds hold fewer than 2 cells or are exactly one existing merge's rectangle; otherwise `null`.
- **`mergeRange(t, range: CellRange)`**: refused when `canMerge` is not `null`. Otherwise, with `b` the result of
  `rangeBounds(t, range)`: every merge lying inside `b` is removed; every `cells` entry inside `b` is removed except the one at
  (`rows[b.top]`, `columns[b.left]`), which is kept as it is (an empty anchor stays empty); and the merge
  `{ row: rows[b.top].id, column: columns[b.left].id, rows: b.bottom − b.top + 1, columns: b.right − b.left + 1 }` is
  added. Merging a whole row, column or run is merging the range from its first cell to its last.
- **`splitMerge(t, anchor: CellAddress)`**: refused when no merge has exactly this anchor (a covered cell is not an
  anchor). Otherwise that merge is removed; `cells` is unchanged (the text stays in the anchor, the other cells empty).
- **`canMove(t, axis: TableAxis, ids: string[], toIndex: number): TableRefusal | null`**, checked in this order:
  `"invalid"` when `ids` is empty, repeats an id or names an id that is not an entry of that axis, or `toIndex` is not
  a safe integer; `"notRun"` when `ids` is not a run; `"edge"` when `toIndex` is below 0 or above the axis's entry
  count, or lies from `first` to `last + 1` (the run's own place: moving there changes nothing); `"merge"` when a merge
  partly overlaps the run on that axis, or gap `toIndex` lies strictly inside a merge's span on that axis; otherwise
  `null`. Moving a run up (left) one place is `toIndex = first − 1`; down (right) one place is `toIndex = last + 2`.
- **`moveAxis(t, axis, ids, toIndex)`**: refused when `canMove` is not `null`. Otherwise the run's entries, in their
  current order and with their ids and sizes, are taken out and put back at gap `toIndex` (counted before the move):
  the new order is the entries below index `toIndex` that are not in the run, then the run, then the remaining entries.
  `cells` and `merges` are unchanged: they name ids, and the refusals keep every merge's covered rows (columns)
  consecutive with its anchor first. The entry count, `width` and `height` are unchanged.
- **`canDuplicate(t, axis: TableAxis, ids: string[]): TableRefusal | null`**: the caller first checks the
  board-wide cell limit (5,000), using the number of entries requested even if they do not form a run. After that,
  `canDuplicate` checks in this order: `"invalid"` as for `canMove` (without `toIndex`); `"limit"` when the
  axis's entry count plus the number of entries requested is above `MAX_ROWS` (50) or `MAX_COLUMNS` (20);
  `"notRun"`; `"merge"` when a merge partly overlaps the run on that axis; otherwise `null`.
- **`duplicateAxis(t, axis, ids, newId: () => string = () => crypto.randomUUID())`**: refused when `canDuplicate` is
  not `null`, or when an id `newId` returns is not a lowercase UUID (`TABLE_ID`), is already a row or column id of `t`,
  or repeats one it returned before in the same call. `newId` is called once for each entry of the run, in the run's
  order. Otherwise a copy of each run entry (the new id, the same size) is inserted at gap `last + 1`, in the run's
  order; each `cells` entry whose id on that axis is in the run is copied with that id mapped to its copy's (the other
  id and the text kept); and each merge lying wholly inside the run on that axis is copied with its anchor's id on that
  axis mapped to its copy's (the other id, `rows` and `columns` kept). Nothing else changes.

**Changed functions.**
- **`insertAxis(t, axis, id, at = <entry count>, size = axis === "row" ? ROW_HEIGHT : COLUMN_WIDTH)`**: gains the
  optional last parameter `size`, stored as `axisSize(size)` (64–1,000); without it the new entry has today's size.
  **Refused** (the table unchanged) when `id` is already a row or column id of `t` (as today), when the axis is at its
  limit (as today), or when `size` is given and is not a finite number (`Number.isFinite(size)` is false: `NaN`,
  `Infinity`, a string) or lies outside **64 to 1,000**, checked on the value as given, **before** any rounding (so 63,
  63.9 and 1,000.1 are refused, not clamped; 64.4 is accepted and stored as 64 by `axisSize`). **Effective gap.** The new entry's index is the gap `g` that `Array.prototype.splice` makes
  of `at`, computed first: `x = Math.trunc(Number(at))`, with `NaN` counted as 0; then `g = max(n + x, 0)` when
  `x < 0` and `g = min(x, n)` otherwise, `n` being the axis's entry count (so `Infinity` gives `n` and `-Infinity` 0).
  The new entry goes at index `g`, as today; then every merge whose span on that axis gap `g` lies strictly inside
  grows by one on that axis (`rows` or `columns` + 1). Spans are always tested against `g`, never the raw `at`. A
  merge with `g` at its first index or just past its last is unchanged (an insert at a merge's edge does not grow it).
  The new entry's cells hold no text, so a grown merge's new covered cells are empty.
- **`deleteAxis(t, axis, id)`**: refusals unchanged (the last entry of that axis, or an unknown id). The entry and every
  `cells` entry on it are removed, as today. Each merge whose span on that axis holds the deleted entry's index `i`
  then changes: when its span on that axis is that entry alone, the merge is removed; otherwise its count on that axis
  drops by one, and when `i` is the anchor's index on that axis the anchor moves on that axis to the entry that was at
  `i + 1` (the next of its span). The anchor's text was on the deleted entry, so it is lost with it, as any cell's text
  is, and the merged cell is then empty (its new anchor was a covered cell). A merge left covering one cell is removed.
- **`setCell(t, at, text)`**: also refused when `text` is not empty and `at` is a covered cell. Clearing a cell and
  setting an anchor's text are as today.
- **`remapTable(t, id?)`**: also maps each merge's `row` and `column` through the same maps as `rows`, `columns` and
  `cells`, keeping `rows` and `columns`.
- **`canonicalTable(t)`**: also rebuilds each merge entry with its keys as `row`, `column`, `rows`, `columns`, sorted
  by merge rule 6, and returns `merges` after `cells`.
- **`validTable(value)`**: as above (**Saved document (version 18)**).
- **`createTable(...)`**: returns `merges: []`. **`sizeTable`** carries `merges` unchanged, as every other key.
  **`resizeAxis`** and **`scaleTable`** change sizes only, so `merges` is unchanged.
- **`nextCell(t, at, direction)`** (Tab): a merged cell is one cell; a covered `at` is first replaced by its merge's
  anchor. The cells of `t` are taken in reading order (rows
  top to bottom, each row left to right) **leaving out covered cells**, so each merged cell is visited once, at its
  anchor's place. The answer is the cell `direction`
  places after (1) or before (−1) it in that order; `undefined` past either end or when `at` is not a cell of `t`, as
  today.
- **`neighbourCell(t, at, arrow)`** (arrow keys): first, when `at` is a covered cell, it is replaced by its merge's
  anchor (as `nextCell` does), so a covered address and its anchor give the same answer. Then `at`'s **box** is its
  merge's rectangle when `mergeOf(t, at)` is a merge, otherwise `at` alone. `ArrowDown` goes to row index
  `box.bottom + 1` and `ArrowUp` to `box.top − 1`, both in the anchor's column (`at`'s own when unmerged);
  `ArrowRight` goes to column index `box.right + 1` and `ArrowLeft` to `box.left − 1`, both in the anchor's row. So moving from a merged cell always leaves it. When the cell reached is covered, the answer is its
  merge's anchor; outside the table, `undefined`, as today. Any other `arrow` value answers as today.
- `cellAt`, `cellIndex`, `cellText` (`""` for a covered cell, which holds no text), `cellKey`, `axisSize` and
  `validCellText` are unchanged.

**Limits** (unchanged): 1–50 rows, 1–20 columns, 1,000 code points a cell; no function above makes a table break them
(`insertAxis` and `duplicateAxis` refuse at the limit; `moveAxis`, `mergeRange` and `splitMerge` change no count). The
board's 5,000-cell limit is `validate`'s, as for `insertAxis` today; callers check it before an edit as they do today.

## Object type module and registry

**New in v24.** The table type record's `savedKeys` gains `"merges"` after `"cells"` (the version 18 order above), and
`objectKeys("table", version)` leaves `merges` out for versions below 18, so a version 14 to 17 table keeps exactly
its v23 keys. `table`'s other fields (`validFrom: 14`, `validExtras: validTable`, `sizeRange`, …) are unchanged.

**From v23, unchanged.** `objects/registry.ts` exports `objectKind(type: string): { kind: string; icon: string | null }`: the
lower-case kind interaction v53 names for each type (`sticky`, `shape`, `text`, `section`, `table`, `mind map node`,
`image`, `video`, `link card`, `connector`, `drawing`, `washi tape`) and its bottom-palette icon name, or `null`, exactly
as [web modules v51](0001-web-modules-v51.md) lists them. It changes no stored value. The rules package's
`platform.d.ts` gains a minimal `URL` declaration, so `text-link.ts` compiles against the package's ES2022 globals.

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

As v20, with a video's keys and a card's keys in the orders above and, from version 18, a table's `merges` after its
`cells`, each merge entry's keys as `row`, `column`, `rows`, `columns` and the entries in merge rule 6's order (the
anchor row's index, then the anchor column's index). No other sorting.

## Reading version 1 to 17 documents

`upgrade` reads a version 1 to 16 document exactly as v18 to v23 say (to version 17), and a version 17 document as it
is, then **adds `merges: []` to every table** (after its `cells`) and sets `schemaVersion` to **18**. No other key
changes. This is the first step since tables arrived that changes an object: a version 14 to 17 table has no `merges`.
A document that holds no table (every version 1 to 13 document among them) changes only `schemaVersion`. A version 17
document's marks, links included, are already version 18 marks. `empty` and `add` create version 18 documents (`add`
of a table: `createTable`, so `merges: []`). A version 18 document is not upgraded. Opening an older board follows
v18's rule word for word with 18 for 13: the upgrade happens **in memory**, is not an edit, never writes storage, and
the next explicit Save writes version 18. An unedited board's export and its canonical bytes are those of its own
version (v1–17 round trips stay byte-exact, a version 14 to 17 table without `merges`); an edited one exports version
18. `payloadBytes` excludes `pages` and every `page` for versions 13, 14, 15, 16, 17 and 18 alike. The "one hash, one
kind" check (video rule 4) runs for versions 15, 16, 17 and 18. `validate`'s link check refuses a mark's `link` only
in a version 1 to 16 document (`schemaVersion < 17`), so links in text are valid at 17 and 18 alike.

**Byte cap across the upgrade.** The `merges: []` that the upgrade adds makes a document's canonical payload larger
(by the bytes of `,"merges":[]` for each table). The 2,097,152-byte cap is therefore measured on the **stored** form
whenever a version 14 to 17 document is **read** (its own canonical form at its own version, `canonical(b)` before
`upgrade`): reading and upgrading never measure the upgraded form and never refuse for its size, so a stored board at
the cap opens. Every later **write** measures the upgraded form exactly as today: the next explicit Save (local
storage), a board file written from the edited board, a room's first edit after adopting it (the snapshot the room
writes when it loads and upgrades a stored board is not a write here: sync v20 writes it uncounted), and a
create or import through the server canonicalise at 18 and refuse a payload above the cap with today's words for that
path ("Board too large" in `canonical()`, and each path's existing message or reason). So a legacy board at the cap
may open and then be refused when it is next written; nothing is trimmed. Where the room measures a stored snapshot on
load is [sync v20](0003-sync-v20.md)'s, under this rule.

**Types (v22, kept).** `document.ts` keeps v21's `VideoItem` (the video table's keys, `page: string`, and `text?`, `color?`,
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

**Types (v23).** `Mark` (`marks.ts`) gains `link?: string`. No object type changes, so `ItemV16` stays the current
item union (its `marks` are `Mark[]`). `document.ts` adds **`BoardV17`** (`BoardFields & { schemaVersion: 17; pages:
Page[]; objects: ItemV16[] }`); `Board["schemaVersion"]` gains 17. The current-document aliases follow the newest
version: `BoardV12`, `BoardV14`, `BoardV15` **and `BoardV16`** become aliases of `BoardV17`, so the callers that name
the current board keep their names. `BoardV16` is therefore no longer the stored version 16 shape: sync v19's
`DecodedBoard` builds its version 16 member as `StoredBoard<16, ItemV16>` with `pages` (as v22 built version 15) and
adds `BoardV17`; `readLiveBoard` returns `BoardV17`. `validate` accepts `schemaVersion` 1 to 17; `upgrade`, `empty`
and `add` return `BoardV17`. The paragraph above is v22's and is read with these changes.

**Types (v24).** `TableItem` keeps its definition, so with `TableKeys`' new `merges` it is the **version 18** table.
`document.ts` adds **`TableItemV14 = Omit<TableItem, "merges">`**, the table as stored at versions 14 to 17, and
changes the unions so that each stored version keeps its own table:
- **`StoredItemV14 = ItemV13 | TableItemV14`** (v23: `ItemV13 | TableItem`); `StoredItemV15 = StoredItemV14 |
  VideoItem` keeps its text, so its table is the stored one too;
- **`StoredItemV16 = StoredItemV15 | LinkItem`**: v23's `ItemV16`, now the item union stored at versions 16 and 17;
- **`ItemV18 = ItemV13 | TableItem | VideoItem | LinkItem`**, the current item union; `ItemV16`, `ItemV15`, `ItemV14`
  and `ItemV12` become aliases of `ItemV18`, so the callers that name the current item keep their names;
- **`BoardV18`** (`BoardFields & { schemaVersion: 18; pages: Page[]; objects: ItemV18[] }`); `BoardV12`, `BoardV14`,
  `BoardV15`, `BoardV16` **and `BoardV17`** become aliases of `BoardV18`; `Board["schemaVersion"]` gains 18 and `Item`
  gains `TableItemV14`.

`BoardV17` is therefore no longer the stored version 17 shape: sync v20's `DecodedBoard` builds its members for
versions 14, 15, 16 and 17 with `pages` from `StoredItemV14`, `StoredItemV15`, `StoredItemV16` and `StoredItemV16`
(`StoredBoard<17, StoredItemV16>`), and adds `BoardV18`; `readLiveBoard` returns `BoardV18`. `validate` accepts
`schemaVersion` 1 to 18; `upgrade`, `empty` and `add` return `BoardV18`. The paragraphs above are v22's and v23's and
are read with these changes.

## Older versions of the application

A board file or a saved local board whose `schemaVersion` is greater than **18** is "made by a newer version of
Board", with the existing words (board file v8, storage v7). An application built before this version refuses a
version 18 document in the same way; pre-launch, nothing more is promised.

## Version references in other contracts

New and edited documents are **18** everywhere. What each input **accepts on reading** keeps its own range:
saved boards and board files accept **1 to 18** (this contract, [storage v7](0001-storage-v7.md),
[board file v8](0006-board-file-v8.md)): the local read is `validate`'s range, and only the board list's `newer` state
moves from above 17 to above 18. Catalogue activities stay at schema 7 as today (`apps/web/src/activities.ts` stays
unchanged; an activity never holds a link or a table). Every
room input (client updates and the live board, stored snapshots by storage version, history versions, backups by
storage version, created and imported boards, team templates) accepts exactly the range in **sync v20's single
input matrix** ("Input matrix"), which this contract does not restate. Every input is validated at its declared
version first. Only what becomes the live board is then upgraded to 18 (a stored room adopted at load, a created or
imported board, a version restore); a history preview, the capture comparison and a backup's inputs keep their
declared versions (sync v20), so a version 14 to 17 history version or backup holds tables without `merges`. Team
templates validate their objects inside a version **18** wrapper ([team templates v6](0008-team-templates-v6.md)), so
a template table carries `merges`; a board create or import through the server accepts the range
[API v18](0003-api-v18.md) states, which is sync v20's.

## Verification

Unit tests cover: a valid video at schema 15 and its canonical key order; each field refused out of bounds
(hashes not 64 lowercase hex, `poster` equal to `asset`, pixel sizes 0 and 1,921, `durationMs` 0 and
86,400,001, a `name` that is empty, of 256 code points, or holds a control character or a lone surrogate, a description of 1,001 code points or with a lone surrogate, an extra or missing key); a video in a
version 14 document refused; a hash used as both a picture and a video refused; a connector to a video refused;
a video in a section accepted; `upgrade` of versions 1, 13 and 14 to 15 changing nothing else; `empty()` at 15;
`isVideo`, `isMedia`, `pictureOf`, `assetsOf`, `keepsProportions` and `eligibleIdea` for every object type; the
local reading range (1–15 accepted, 16 refused) with an explicit schema 13 case kept.

Document v22 replaced the last three items above with their version 16 forms and added the items below; document
v23 replaces those three items again with their **version 17** forms (`upgrade` of versions 1, 13, 14, 15 and 16 to
17 changing nothing else; `empty()` at 17; the local reading range 1–17 accepted, 18 refused, with explicit schema 13,
15 and 16 cases kept) and keeps v22's additions; document v24 replaces them once more with their **version 18** forms
(`upgrade` of versions 1, 13, 14, 15, 16 and 17 to 18 adding `merges: []` to each table and changing nothing else;
`empty()` at 18; the local reading range 1–18 accepted, 19 refused, with explicit schema 13, 15, 16 and 17 cases kept)
and keeps v22's and v23's additions. v22's additions:
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

Document v23 added:
- a sticky, a shape and a text object at schema 17 each with a linked mark (a link with no flag, and a link with
  bold), and the canonical key order (`link` after `strike`);
- a mark with `link` in a version 16 document refused; the same document at 17 accepted;
- a well-formed `link` on a connector's label refused by the connector's `validExtras` ("Invalid object paint"), a
  `mindNode` with a linked mark refused by `validMindNode` ("Invalid object paint"), both before any link rule, and a
  `link` on a section refused at the marks step ("Invalid marks");
- `link` values refused: not a string, empty, not equal to its own `linkAddress` result (`example.com`,
  `HTTP://Example.com/`), `javascript:alert(1)`, `data:text/html,x`, `mailto:a@example.com`, `ftp://example.com/`,
  with a user name or a password, with white space or a control character inside, an `href` of 2,049 characters;
- the normal form: two touching marks with the same flags and the same link refused; the same flags and different
  links accepted; the same link and different flags accepted;
- `linkAddress`: `example.com` → `https://example.com/`; `  https://Example.com/a  ` → `https://example.com/a`;
  `http://localhost:3000/x`, `http://127.0.0.1/` and `https://192.168.1.10/` accepted; `localhost`, `notes`,
  `//example.com`, `javascript:alert(1)`, `data:,x`, `https://user:pw@example.com/` and `https://exa mple.com/`
  refused; `example.com:8080/x` → `https://example.com:8080/x` (a colon followed by a digit is a port, step 3); `localhost:3000`
  refused (no `.` in its host part); an input of 2,048 characters
  whose `href` is at most 2,048 accepted, 2,049 refused before parsing, and a bare input whose `https://` makes its
  `href` longer than 2,048 refused;
- `remap`: inserting strictly inside a link extends it; inserting at its start and at its end does not (the inserted
  code points keep today's flags); replacing part of a link inside it keeps one link; deleting part shortens it;
  deleting every linked code point removes it; two links of different addresses that touch stay two;
- `remap` with `edit`: in `aaaa` with the mark `{ start: 0, end: 3, link }`, typing `a` with `edit`
  `{ start: 1, end: 1 }` gives `aaaaa` with `{ start: 0, end: 4, link }`, while the same change without `edit` (the
  fallback) treats it as an append and keeps `{ start: 0, end: 3, link }`; **flags unchanged by `edit`**: in `aaaa`
  with `{ start: 0, end: 3, bold: true }`, the same typing gives `{ start: 0, end: 3, bold: true }` with and without
  `edit` (today's result), and with `{ start: 0, end: 3, bold: true, link }` it gives
  `[{ start: 0, end: 3, bold: true, link }, { start: 3, end: 4, link }]`; a selection replaced inside a link (`edit` `{ start: 1, end: 2 }`) keeps one link; a
  deletion with its range given; an `edit` that does not fit (out of range, or prefix or suffix not equal) falling back
  to the diff; and every existing `remap` test passing unchanged without `edit`;
- `toggle` of each flag over part of a link keeps the link on every code point; `formatted` and `formattedRange`
  unaffected by links;
- `normalize` keeping links, merging touching runs with equal formats and keeping apart runs whose link differs; and,
  for an overlapping input, the last mark's link winning;
- `segments` splitting by link and carrying `link` on linked pieces;
- `setLink` over a range that covers two links (both replaced), with `null` (removed, flags kept), and with a caret
  (no change); grapheme snapping: a range starting inside `👍🏽` (thumbs up with a skin tone, two code points) or between
  `e` and a combining accent grows to the whole grapheme at both ends, a range already on boundaries is unchanged, and,
  with `Intl.Segmenter` removed, no snapping; `linkAt` for a range inside one link, a range across two links (`null`), a caret inside, at a link's
  start and at its end (`null`); `touchesLink` for the same cases (true at the start and end);
- `upgrade` of a version 16 document with marks to 17 changing only `schemaVersion`.

Document v24 adds (in `tests/tables.test.mjs` and `tests/document.test.mjs`; CSV export in `tests/table-csv.test.mjs`):
- a version 18 table with `merges: []` and one with merges, and the canonical order: `merges` after `cells`, each
  entry's keys as `row`, `column`, `rows`, `columns`, entries sorted by anchor row index then anchor column index
  (an input with entries and keys out of order accepted by `validate` and rewritten by `canonical()`);
- a table with a `merges` key in a version 17 document refused, and a version 18 table without one refused ("Invalid
  object");
- each merge rule refused ("Invalid object paint"): an extra or missing key; `row` or `column` not an id of the table
  (a column id given as `row`); `rows` or `columns` 0, −1, 1.5 or a string; a 1 × 1 merge; a merge running past the
  last row and one past the last column (and one ending exactly on them accepted); two overlapping merges, two with the
  same anchor, and an anchor inside another merge; a `cells` entry on a covered cell (and one on the anchor accepted);
- `upgrade` of a version 17 document with two tables (and of a version 14 one) to 18 adding `merges: []` to each and
  changing nothing else; an unedited version 17 board's canonical bytes unchanged; `payloadBytes` at 18;
- the byte cap across the upgrade: a version 17 document with tables whose canonical payload is exactly 2,097,152 bytes
  validates and upgrades (the upgraded form, a few bytes larger, is not measured), and `canonical()` of the upgraded
  board throws "Board too large"; one at 2,097,152 bytes minus the added bytes upgrades and canonicalises at 18 within
  the cap;
- `rangeBounds`: two corners in either order; a range touching a merge grown to hold it; a chain where growing touches
  a second merge grown again; an unknown cell `undefined`;
- `mergeRange` and `canMerge`: a 2 × 2 range keeping the anchor's text and removing the other three; an empty anchor
  staying empty; a range holding a smaller merge replacing it; a 1 × 1 range and a range equal to one merge refused
  (`"single"`); an unknown cell refused (`"invalid"`); a whole row and a run of columns merged;
- `splitMerge`: the merge removed and `cells` unchanged; a covered cell and an unmerged cell refused;
- `insertAxis`: a row inserted strictly inside a merge's span growing it by one, at its first index and just past its
  last not growing it; the same for columns; the new `size` argument (the row above's height) stored through
  `axisSize`, and the default size without it; the effective gap: `at` 1.5 treated as 1, `NaN` as 0, −1 as
  `n − 1`, `Infinity` and `n + 5` as `n`, a merge growing or not by `g` (for a merge over rows 1–2, `at` −2 in a
  4-row table is gap 2 and grows it); `size` `NaN`, `Infinity`, `"80"`, 63, 63.9, 1,000.1 and 1,001 refused, the table
  unchanged, and 64 and 1,000 accepted; an id in use refused;
- `deleteAxis`: a covered row shrinking the merge; the anchor's row moving the anchor to the next row and losing its
  text; the anchor's column likewise; a 2 × 1 merge whose row is deleted removed; a merge whose only row on that axis
  is deleted removed;
- `canMove` and `moveAxis`: a row moved up and down one place (`toIndex` `first − 1` and `last + 2`), and to the first
  and last gaps; a run of two rows and of two columns moved; the texts staying with their ids; `"edge"` at the first
  and last row and for the run's own place; `"notRun"` for ids that are not consecutive; `"invalid"` for an unknown
  id, a repeated id and `toIndex` 1.5; `"merge"` for a run that partly overlaps a merge and for a gap strictly inside a
  merge's span; a run that holds a whole merge moved with it, and a row moved past a whole merge (the merge unchanged);
- `canDuplicate` and `duplicateAxis`: one row and a run of rows copied right after the run with new ids, the same sizes
  and texts; a merge wholly inside the run copied with mapped ids; `"limit"` at 50 rows and 20 columns; `"merge"` for
  a run that partly overlaps a merge; an id from `newId` already in use refused;
- `setCell` refusing text in a covered cell and accepting it in an anchor;
- `remapTable` mapping every merge's `row` and `column` with the rows and columns, keeping `rows` and `columns`;
- `nextCell` over a table with a merge: Tab and Shift+Tab visiting the merged cell once at its anchor's place, and Tab
  from a covered cell going on from its anchor; `neighbourCell` leaving a merged cell on every side from its anchor,
  arriving on a covered cell answering the anchor, and stopping at the table's edges; every arrow from a covered
  address answering exactly what it answers from the merge's anchor (for a merge over rows 0–1 and columns 0–1, `at`
  at row 1, column 1 with `ArrowDown` goes to row 2, column 0);
- CSV export of a merged table writing the merged cell's text in its anchor's place and covered places empty;
- the drawn-height rule (`layoutTable`, `tests/tables.test.mjs`): a merged cell whose text needs more than its rows' total
  height growing only the last row of its span, an unmerged row unchanged, and the saved heights unchanged.

## References

Merged cells and the table rules: how cells are chosen, merged, split, moved and duplicated, how a merged cell is drawn
and named, and the words for each `TableRefusal`, are [interaction v54](0001-interaction-v54.md); their modules are
[web modules v52](0001-web-modules-v52.md); in rooms (`mergeMap`, the room's check, order keys for moves)
[sync v20](0003-sync-v20.md); in files [board file v8](0006-board-file-v8.md); in team templates
[team templates v6](0008-team-templates-v6.md); in the local store [storage v7](0001-storage-v7.md); through the server
[API v18](0003-api-v18.md). The rest is unchanged from v23.

Links in text: how they are added, drawn, shown and followed is [interaction v53](0001-interaction-v53.md); their
modules are [web modules v51](0001-web-modules-v51.md); in rooms [sync v19](0003-sync-v19.md); in files
[board file v7](0006-board-file-v7.md); in team templates [team templates v5](0008-team-templates-v5.md); in the local
store [storage v6](0001-storage-v6.md). The WHATWG URL Standard defines `new URL` and `href`. The rest is
unchanged from v22, which kept v21's. A video's look, words and keys are [interaction v50](0001-interaction-v50.md); its modules
are [web modules v48](0001-web-modules-v48.md); its shared-document handling is sync v17. A link card's look, words
and states are [interaction v52](0001-interaction-v52.md); its modules are [web modules v50](0001-web-modules-v50.md);
its page details come from [link preview v1](0012-link-preview-v1.md); its shared-document handling is
[sync v18](0003-sync-v18.md); in files [board file v6](0006-board-file-v6.md); in team templates
[team templates v4](0008-team-templates-v4.md).
