# 0001 — Board document contract

CONTRACT VERSION: 0001 document v23 (2026-11-26)

Status: Draft for 0001-W27 v1. When accepted it replaces [document v22](0001-document-v22.md) for later work.
Every rule of v22 (and, through it, v21, v20, v19 and v18) stays word for word except as below; v22's text is kept here
in full, with its version numbers moved on only where this version requires it. This version adds **links in text**
(an optional `link` on a formatting run of a rich-text object), the **link address rule** and **schema version 17**.
How a link is added, drawn, shown on hover and followed is [interaction v53](0001-interaction-v53.md); its modules
are [web modules v51](0001-web-modules-v51.md); how links travel through a room is [sync v19](0003-sync-v19.md); in
files, [board file v7](0006-board-file-v7.md); in team templates, [team templates v5](0008-team-templates-v5.md); in
the local store, [storage v6](0001-storage-v6.md).

v22 added the **link** object type (a **link card**) and schema version 16. How a card is pasted, drawn, filled in
and changed back to text is [interaction v52](0001-interaction-v52.md); how a card's page details are fetched is
[link preview v1](0012-link-preview-v1.md). Its rules stay as written below.

**Changes from v22, in short.** A **mark** (a formatting run, document v4) may hold an optional `link`: the full web
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

## Object type module and registry

**New in v23.** `objects/registry.ts` exports `objectKind(type: string): { kind: string; icon: string | null }`: the
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

As v20, with a video's keys and a card's keys in the orders above. No other sorting.

## Reading version 1 to 16 documents

`upgrade` reads a version 1 to 15 document exactly as v18, v19, v20, v21 and v22 say (to version 16), and a version
16 document as it is, then sets `schemaVersion` to **17**. No other key changes: the step from 16 to 17 adds nothing
(a version 16 document holds no link, so its marks are already version 17 marks). `empty` and `add` create version
17 documents. A version 17 document is not upgraded. Opening an older board follows v18's rule word for word with 17
for 13: the upgrade happens **in memory**, is not an edit, never writes storage, and the next explicit Save writes
version 17. An unedited board's export and its canonical bytes are those of its own version (v1–16 round trips stay
byte-exact); an edited one exports version 17. `payloadBytes` excludes `pages` and every `page` for versions 13, 14,
15, 16 and 17 alike. The "one hash, one kind" check (video rule 4) runs for versions 15, 16 and 17.

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

## Older versions of the application

A board file or a saved local board whose `schemaVersion` is greater than **17** is "made by a newer version of
Board", with the existing words (board file v7, storage v6). An application built before this version refuses a
version 17 document in the same way; pre-launch, nothing more is promised.

## Version references in other contracts

New and edited documents are **17** everywhere. What each input **accepts on reading** keeps its own range:
saved boards and board files accept **1 to 17** (this contract, [storage v6](0001-storage-v6.md), board file v7):
the local read is `validate`'s range, and only the board list's `newer` state moves from above 16 to above 17. Catalogue activities stay at schema 7 as today (`apps/web/src/activities.ts` stays unchanged; an activity never holds a link). Every
room input (client updates and the live board, stored snapshots by storage version, history versions, backups by
storage version, created and imported boards, team templates) accepts exactly the range in **sync v19's single
input matrix** ("Input matrix"), which this contract does not restate. Every input is validated at its declared
version first. Only what becomes the live board is then upgraded to 17 (a stored room adopted at load, a created or
imported board, a version restore); a history preview, the capture comparison and a backup's inputs keep their
declared versions (sync v19). Team templates validate their objects inside a version **17** wrapper (team
templates v5); a board create or import through the server accepts the range [API v17](0003-api-v17.md) states,
which is sync v19's.

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
15 and 16 cases kept) and keeps v22's additions:
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

This version adds:
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

## References

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
