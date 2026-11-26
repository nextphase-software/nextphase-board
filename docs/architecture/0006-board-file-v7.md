# 0006 — Board file contract

Contract version: 7 (for 0001-W27 brief v1, 2026-11-26). Status: Draft.
Replaces [board file v6](0006-board-file-v6.md). Depends on [document v23](0001-document-v23.md) and
[storage v6](0001-storage-v6.md) (whose picture and video records are storage v4's, unchanged); used by [interaction v53](0001-interaction-v53.md).

v6's text is kept here in full, with its version numbers moved on only where this version requires it. **Changes
from v6, in short:** a board file may hold **links in text** (document v23, schema 17): a `link` on a mark of a
sticky, shape or text object. A link is part of its object's `marks`, so it travels **inside the bundle's
`document`**, byte for byte, and needs no new key, entry or asset: a link names no picture or video, adds nothing to
`assets` and counts in no picture or video budget. The **file version stays 3** and the size limit stays 216 MiB.
Reading accepts documents of version **1 to 17**; a link that breaks document v23's rules (its link address rule, or
a link outside a rich-text object, or in a document below version 17) makes the document invalid under rule 11, "it
is not a valid board". Writing and reading never open, fetch or check the target of a link: a link to a page or
object of the board that wrote the file is kept as it is, and opens a new tab when used on another board
([interaction v53](0001-interaction-v53.md)). A team import carries links in its document unchanged; a link is not
media, so it never makes a document need staging.

**v6's changes from v5:** a board file may hold **link cards** (document v22, schema 16). The **file version stays 3**
and the size limit stays 216 MiB. Reading accepts documents of version **1 to 16**. A card's **thumbnail** (its
non-null `asset`) is one of the document's pictures, so it travels in the bundle's `assets` as a **picture entry**,
exactly as an image's picture does, and counts in the 50 MiB of pictures. Writing and reading never ask the link
preview service. A team import of a file with cards stages each thumbnail as a picture through the staged import
path of [board lifecycle v8](0006-board-lifecycle-v8.md), unchanged.

Every rule of v4 (and, through it, v3's and v2's) still applies except where this version replaces it: the
timer and voting exclusions stay word for word. A board file carries the board's **videos** and their first
frames, and its **link cards' thumbnails**, with its document, so a board with videos or cards moves to another
browser whole. It replaces:
- v2's **Format** and **Writing**: Board writes file version **3** (see **Format** and **Writing**);
- the size limit of 75,497,472 bytes: a file may be up to **226,492,416 bytes (216 MiB)**;
- v2's **Reading** table (see **Reading**);
- the document version range: a document in a file is at its own version, **1 to 17**.

## Format

The four outer keys are v2's (`format`, `fileVersion`, `payload`, `sha256`), with `fileVersion` the integer
`3`. The **bundle** is v2's (`document`, then `assets`), with `document` at its own `schemaVersion` (1 to 17) and
`assets` an array with one entry for each of the document's **assets** (document v22: its pictures, first frames
and link cards' thumbnails included, and its videos), sorted by `sha256` in code-unit order across both kinds; empty
when the document has no image, no video and no card with a thumbnail.

A **picture entry** is v2's, exactly: `sha256`, `mime`, `pixelWidth`, `pixelHeight`, `base64`, in that order.
A card's thumbnail has a picture entry like any other picture: its `mime` is the thumbnail's picture type and its
`pixelWidth` and `pixelHeight` are the thumbnail's own pixel size (a card holds no pixel size of its own). A hash
that is both an image's picture and a card's thumbnail has one entry.
A **video entry** is an object with exactly these keys in this order:

| Key | Value |
| --- | --- |
| `sha256` | The video hash (64 lowercase hex characters) |
| `mime` | As in a storage v4 video record |
| `durationMs` | As in a storage v4 video record |
| `base64` | The video's bytes in base64 (v2's alphabet, padding and no line breaks) |

A picture's hash has a picture entry and a video's hash a video entry; the key list tells them apart. The whole
file is at most 226,492,416 bytes: a board within its limits (document v22's payload, storage v4's 50 MiB of
pictures and 100 MiB of videos, base64 adding a third) fits. The file name is as in v1.

## Writing

Board always writes file version 3. The bundle's `document` follows v2's rule at version 17 (unedited: as
opened or saved, its own version; edited: canonical at version 17, links included). Its `assets` hold every picture and every
video that document refers to, from the tab's memory; a picture or video not yet in memory is first read from
storage (single-user boards) or downloaded (hosted boards, interaction v50 **Save a copy**). A card's thumbnail is
read or downloaded the same way as an image's picture, with one difference: a card holds no pixel size, so when a
hosted board's tab does not hold the thumbnail (a **cold cache**: another person's card, a reloaded tab, or a Save a
copy made at once after the arrival), the browser downloads its bytes, sniffs their type, **decodes them to read the
pixel width and height**, builds the picture record `{ bytes, mime, pixelWidth, pixelHeight }`, validates it as a
storage v5 picture record under `asset/<sha256>` (the sniffed type equals `mime`, the SHA-256 equals the hash, the
bytes decode to exactly that size), holds it in the tab's memory, and only then writes its picture entry. A thumbnail
read from local storage or already held keeps its record's own pixel size. A file is not written when, in this
order:
- any of the document's images or videos has a picture that is not drawn for it (v2's rule, with a video's
  first frame and the video's own pixel size, and for a video only a JPEG first frame, storage v4), or any link
  card's thumbnail is not available, does not decode, or is not a valid picture record (storage v5) under
  `asset/<sha256>`, with the reason "a picture is unavailable";
- any of the document's videos is not available (storage v4), with the reason "a video is unavailable";
- the board's picture bytes (first frames and cards' thumbnails included) are above 52,428,800, with the reason
  "pictures exceed the 50 MiB board limit";
- the board's video bytes are above 104,857,600, with the reason "videos exceed the 100 MiB board limit";
- the file would be above 226,492,416 bytes, with the reason "it is larger than 216 MiB".

Videos are never decoded or played to be written: a video this browser cannot play is written like any other.
A video entry's `durationMs` is the value the tab holds for that hash (storage v4: the first stored value wins);
it may differ from a video object's own `durationMs`, which the document carries.
**Writing never fetches.** A card is written with the keys it has: a `loading` card is written `loading` (with its
`requestedAt`), and no preview is requested for it or for any other card.
Writing never saves, never changes storage and never needs the writer lock.

## Reading

The rules run in this order; the first that holds refuses the file with its reason. Rules 1 to 7 apply to the
file; rules 8 to 11 to the board's **document** (for file version 1, the `payload` string; for file versions 2
and 3, the bundle's `document` string).

| # | Refused when | Reason |
| --- | --- | --- |
| 1 | The file's size is above 226,492,416 bytes (checked before it is read, and again on the bytes read) | it is larger than 216 MiB |
| 2 | v2's rule 2 | it is not a Board file |
| 3 | v2's rule 3 | it is not a Board file |
| 4 | v2's rule 4 | it is not a Board file |
| 5 | `fileVersion` is a safe integer above **3** | it was made by a newer version of Board |
| 6 | `fileVersion` is not 1, 2 or 3, or `payload` or `sha256` is not a string | it is not a Board file |
| 7 | v2's rule 7 | it is damaged |
| 8 | File versions 2 and 3: v2's rule 8 | it is damaged |
| 9 | The document does not parse as JSON | it is not a valid board |
| 10 | Its `schemaVersion` is a safe integer above **17** | it was made by a newer version of Board |
| 11 | It does not validate as a document of its own version, or its canonical form differs from the document string | it is not a valid board |
| 12 | File versions 2 and 3: `assets` is not an array; an entry is not a picture entry or a video entry with exactly its keys in order (file version 2: a picture entry); an entry's `sha256` is not a string greater than the previous entry's; its `base64` is not base64 as v2 says, or does not encode back to exactly itself; a picture entry's decoded bytes with its `mime`, `pixelWidth` and `pixelHeight` do not form a valid storage v4 picture record under `asset/<sha256>`, or a video entry's decoded bytes with its `mime` and `durationMs` do not form a valid storage v4 video record under `asset/<sha256>`; the picture entries' hashes are not exactly the document's pictures (cards' thumbnails included), or the video entries' hashes are not exactly the document's videos; an image's or a video's `pixelWidth` or `pixelHeight` differs from its picture's entry (a card has no pixel size, so its thumbnail's entry is not compared with the card); a video's `poster` entry's `mime` is not `image/jpeg`; the picture entries' bytes add up to more than 52,428,800; or the video entries' bytes add up to more than 104,857,600 | it is damaged |
| 13 | File versions 2 and 3: a picture's bytes (first frames and cards' thumbnails included) do not decode in the browser to a first frame of exactly its `pixelWidth` × `pixelHeight` pixels (checked before anything is asked or changed) | it is damaged |

The budgets are checked on the running totals while entries are read, so an oversized file stops at the first
entry past a limit. Rules 1 to 12 are pure checks on the bytes; rule 13 needs the browser's picture decoder.
Videos are never decoded on reading: a file whose videos this browser cannot play opens, and those videos show
their first frames (interaction v50).

A file version 1 file supplies no assets: if its document holds images, videos or cards with thumbnails (a version 1
file can hold a card only if its document is at version 16 or 17), the new board uses the pictures and videos the tab
already holds or storage already has for those hashes (storage v4), and only objects whose assets neither has are
unavailable (a card whose thumbnail is unavailable shows the missing-picture box, interaction v52). Before anything
is asked or changed, the page reads them; if the board's picture bytes would then be above 52,428,800, the file is
refused with "its pictures exceed the 50 MiB board limit", and if its video bytes would be above 104,857,600, with
"its videos exceed the 100 MiB board limit". A file version 2 or 3 file is refused whole if any asset is missing or
damaged: Board never opens part of a file.

Reading never writes and **never fetches**: a card opens with the keys the file gives it, a `loading` card stays
`loading` and is drawn link-only once document v22's 20,000 ms have passed. A file that passes every check is a
valid board document at its own version with its assets; storage v4's **Writing assets** says how the new board is
created with them in one transaction (a card's thumbnail is written as a picture record, storage v5). The tab keeps the file's
pictures and videos in memory once the board is created, except that a hash the tab or storage already holds keeps
its existing record (storage v4: the first stored `durationMs` wins). Entry bytes are classified picture signature
first, as storage v4 says.

**Team workspaces.** v5's refusal ("it holds pictures or videos, which team boards can't hold yet") is superseded by
[board lifecycle v8](0006-board-lifecycle-v8.md): a team import of a file holding pictures or videos is staged
([API v15](0003-api-v15.md), [hosted storage v15](0003-hosted-storage-v15.md)). This version adds link cards to that
path, unchanged:
- A document **holds media** for the import when any object names an asset (`assetsOf(o).length > 0`, document v22):
  an image, a video, or a card whose `asset` is not `null`. A document whose only cards have `asset: null` and that
  holds no image or video is imported exactly as a media-free document is, with no staging.
- Each card's thumbnail is opened in the staging's asset list as a **picture** (its hash, picture type and byte
  count), checked in the browser as every staged picture is (it decodes to its entry's pixel size; at most
  20,971,520 bytes), and staged with the existing picture call (`stageImport`, `stageImportPicture`). A hash that is
  both an image's picture and a card's thumbnail is staged once. The room's claim and create check it with
  `requireHeldMedia` (sync v18: held with a picture type, else 400 `asset_missing`).
- Without `import`, a document holding a card with a non-null `asset` is refused 400 `images_not_supported`, as a
  document holding images or videos is (lifecycle v8).
- The import never asks the link preview service; cards keep their keys.

## Applications built before this version

An application that implements only v2 to v4 refuses a version 3 file without changing anything: one of at most
75,497,472 bytes reaches its rule 5, "it was made by a newer version of Board"; a larger one is refused by its
rule 1, "it is larger than 72 MiB". An application that implements v5 **accepts** version 3 files whose documents are
at versions 1 to 15 and **refuses** one whose document is at version 16 or above by its rule 10, "it was made by a
newer version of Board". An application that implements v6 **accepts** version 3 files whose documents are at
versions 1 to 16 and **refuses** one whose document is at version 17 or above by its rule 10, with the same reason;
so a file this version writes is opened by a v6 application only if its document is still at version 16 or below
(an unedited older board), and a file with any link (version 17) is refused by it whole, without changing anything.

## Identity

v1's rules apply. Pictures (cards' thumbnails included) and videos are identified by their hash, so opening the same
file twice gives two boards that share each record (storage v4).

## Verification

Unit tests cover: writing a board of each version 1 to 17 and reading it back, the document byte for byte; a
board with videos: one video entry per distinct video and one picture entry per distinct picture (first frames
included), all sorted together, base64 that decodes to the stored bytes; each writing refusal (an unavailable
first frame, an unavailable video, each budget, the size limit); each reading rule with a file only that rule
refuses, including a file version 4, a schema version 18, a video entry in a file version 2, a video entry with
keys out of order or an extra key, a video entry whose bytes have no video header or whose `mime` disagrees, a
`durationMs` of 0, a video hash given a picture entry (and the reverse), a missing and an extra video entry, a
video whose pixel size differs from its first frame's entry, a video whose first frame's entry is a valid PNG, video bytes above 104,857,600 in all, and picture
bytes (first frames included) above 52,428,800; the size limit at exactly 226,492,416 and 226,492,417 bytes; a
version 1 file whose document holds a video, resolved from storage and refused when its videos exceed 100 MiB;
a 50 MiB video written and read back. Rule 13 is covered by the browser checks.

This version adds: a board with link cards in every state (`loading`, `ready` with and without a thumbnail,
`linkOnly`) written and read back byte for byte, with one picture entry per distinct thumbnail, sorted with the other
entries, and a thumbnail shared with an image written once; a card whose thumbnail is unavailable refusing the write
with "a picture is unavailable"; cards' thumbnails counted in the 50 MiB picture budget on writing and reading; a
missing and an extra thumbnail entry, a thumbnail entry whose bytes are not a picture, and a thumbnail hash given a
video entry, each refused as damaged; a version 1 file with a card resolved from storage; no network request made by
writing or reading (a stub that fails on any `fetch`); and the team import's staging list holding each thumbnail once
as a picture, a file whose only card has `asset: null` sent without staging. Save a copy on a hosted board with a
**cold cache**: a downloaded thumbnail decoded for its pixel size and validated before its entry is written (with a
download double: the entry's `pixelWidth` and `pixelHeight` are the decoded bytes' own; bytes that do not decode, or
whose hash or type disagrees, refuse the write with "a picture is unavailable"); and, as a browser check, an
**immediate hosted Save a copy after an arrival**, made by a second editor's tab that never held the thumbnail (and by
the paster's tab), writes a file that reads back with the card and its thumbnail entry.

Version 7 adds: a board with links in a sticky, a shape and a text object (a link with no flag, a link with bold,
two touching links) written and read back byte for byte, with no asset entry for any link and the same `assets` as
the board without links; a file whose document is at version 16 and holds a link, one at 17 with a link that the
link address rule refuses (`javascript:alert(1)`), one with a link not equal to its own result (`example.com`), and
one with a link on a connector's label, each refused "it is not a valid board" (rule 11); a version 16 file read and
written back unedited at 16, and edited at 17; no network request made by writing or reading a board with links (the
same `fetch` stub); and a team import of a file with links sending them unchanged, without staging when the document
names no media.
