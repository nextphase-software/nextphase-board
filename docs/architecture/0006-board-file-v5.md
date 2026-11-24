# 0006 — Board file contract

Contract version: 5 (for 0012-W4 brief v1, 2026-11-24). Status: Draft.
Replaces [board file v4](0006-board-file-v4.md). Depends on [document v21](0001-document-v21.md) and
[storage v4](0001-storage-v4.md); used by [interaction v50](0001-interaction-v50.md).

Every rule of v4 (and, through it, v3's and v2's) still applies except where this version replaces it: the
timer and voting exclusions stay word for word. A board file now carries the board's **videos** and their first
frames with its document, so a board with videos moves to another browser whole. It replaces:
- v2's **Format** and **Writing**: Board writes file version **3** (see **Format** and **Writing**);
- the size limit of 75,497,472 bytes: a file may be up to **226,492,416 bytes (216 MiB)**;
- v2's **Reading** table (see **Reading**);
- the document version range: a document in a file is at its own version, **1 to 15**.

## Format

The four outer keys are v2's (`format`, `fileVersion`, `payload`, `sha256`), with `fileVersion` the integer
`3`. The **bundle** is v2's (`document`, then `assets`), with `document` at its own `schemaVersion` (1 to 15) and
`assets` an array with one entry for each of the document's **assets** (document v21: its pictures, first frames
included, and its videos), sorted by `sha256` in code-unit order across both kinds; empty when the document has
no image or video.

A **picture entry** is v2's, exactly: `sha256`, `mime`, `pixelWidth`, `pixelHeight`, `base64`, in that order.
A **video entry** is an object with exactly these keys in this order:

| Key | Value |
| --- | --- |
| `sha256` | The video hash (64 lowercase hex characters) |
| `mime` | As in a storage v4 video record |
| `durationMs` | As in a storage v4 video record |
| `base64` | The video's bytes in base64 (v2's alphabet, padding and no line breaks) |

A picture's hash has a picture entry and a video's hash a video entry; the key list tells them apart. The whole
file is at most 226,492,416 bytes: a board within its limits (document v21's payload, storage v4's 50 MiB of
pictures and 100 MiB of videos, base64 adding a third) fits. The file name is as in v1.

## Writing

Board always writes file version 3. The bundle's `document` follows v2's rule at version 15 (unedited: as
opened or saved, its own version; edited: canonical at version 15). Its `assets` hold every picture and every
video that document refers to, from the tab's memory; a picture or video not yet in memory is first read from
storage (single-user boards) or downloaded (hosted boards, interaction v50 **Save a copy**). A file is not
written when, in this order:
- any of the document's images or videos has a picture that is not drawn for it (v2's rule, with a video's
  first frame and the video's own pixel size, and for a video only a JPEG first frame, storage v4), with the reason "a picture is
  unavailable";
- any of the document's videos is not available (storage v4), with the reason "a video is unavailable";
- the board's picture bytes (first frames included) are above 52,428,800, with the reason "pictures exceed the
  50 MiB board limit";
- the board's video bytes are above 104,857,600, with the reason "videos exceed the 100 MiB board limit";
- the file would be above 226,492,416 bytes, with the reason "it is larger than 216 MiB".

Videos are never decoded or played to be written: a video this browser cannot play is written like any other.
A video entry's `durationMs` is the value the tab holds for that hash (storage v4: the first stored value wins);
it may differ from a video object's own `durationMs`, which the document carries.
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
| 10 | Its `schemaVersion` is a safe integer above **15** | it was made by a newer version of Board |
| 11 | It does not validate as a document of its own version, or its canonical form differs from the document string | it is not a valid board |
| 12 | File versions 2 and 3: `assets` is not an array; an entry is not a picture entry or a video entry with exactly its keys in order (file version 2: a picture entry); an entry's `sha256` is not a string greater than the previous entry's; its `base64` is not base64 as v2 says, or does not encode back to exactly itself; a picture entry's decoded bytes with its `mime`, `pixelWidth` and `pixelHeight` do not form a valid storage v4 picture record under `asset/<sha256>`, or a video entry's decoded bytes with its `mime` and `durationMs` do not form a valid storage v4 video record under `asset/<sha256>`; the picture entries' hashes are not exactly the document's pictures, or the video entries' hashes are not exactly the document's videos; an image's or a video's `pixelWidth` or `pixelHeight` differs from its picture's entry; a video's `poster` entry's `mime` is not `image/jpeg`; the picture entries' bytes add up to more than 52,428,800; or the video entries' bytes add up to more than 104,857,600 | it is damaged |
| 13 | File versions 2 and 3: a picture's bytes (first frames included) do not decode in the browser to a first frame of exactly its `pixelWidth` × `pixelHeight` pixels (checked before anything is asked or changed) | it is damaged |

The budgets are checked on the running totals while entries are read, so an oversized file stops at the first
entry past a limit. Rules 1 to 12 are pure checks on the bytes; rule 13 needs the browser's picture decoder.
Videos are never decoded on reading: a file whose videos this browser cannot play opens, and those videos show
their first frames (interaction v50).

A file version 1 file supplies no assets: if its document holds images or videos, the new board uses the
pictures and videos the tab already holds or storage already has for those hashes (storage v4), and only objects
whose assets neither has are unavailable. Before anything is asked or changed, the page reads them; if the
board's picture bytes would then be above 52,428,800, the file is refused with "its pictures exceed the 50 MiB
board limit", and if its video bytes would be above 104,857,600, with "its videos exceed the 100 MiB board
limit". A file version 2 or 3 file is refused whole if any asset is missing or damaged: Board never opens part
of a file.

Reading never writes. A file that passes every check is a valid board document at its own version with its
assets; storage v4's **Writing assets** says how the new board is created with them in one transaction. The tab
keeps the file's pictures and videos in memory once the board is created, except that a hash the tab or storage
already holds keeps its existing record (storage v4: the first stored `durationMs` wins). Entry bytes are
classified picture signature first, as storage v4 says.

**Team workspaces.** Opening a board file into a team workspace stays refused when its document holds any image
or video, with the reason "it holds pictures or videos, which team boards can't hold yet" (widened from "it
holds pictures, …"); the check runs on the document after reading, so no asset is sent.

## Applications built before this version

An application that implements only v2 to v4 refuses a version 3 file without changing anything: one of at most
75,497,472 bytes reaches its rule 5, "it was made by a newer version of Board"; a larger one is refused by its
rule 1, "it is larger than 72 MiB".

## Identity

v1's rules apply. Pictures and videos are identified by their hash, so opening the same file twice gives two
boards that share each record (storage v4).

## Verification

Unit tests cover: writing a board of each version 1 to 15 and reading it back, the document byte for byte; a
board with videos: one video entry per distinct video and one picture entry per distinct picture (first frames
included), all sorted together, base64 that decodes to the stored bytes; each writing refusal (an unavailable
first frame, an unavailable video, each budget, the size limit); each reading rule with a file only that rule
refuses, including a file version 4, a schema version 16, a video entry in a file version 2, a video entry with
keys out of order or an extra key, a video entry whose bytes have no video header or whose `mime` disagrees, a
`durationMs` of 0, a video hash given a picture entry (and the reverse), a missing and an extra video entry, a
video whose pixel size differs from its first frame's entry, a video whose first frame's entry is a valid PNG, video bytes above 104,857,600 in all, and picture
bytes (first frames included) above 52,428,800; the size limit at exactly 226,492,416 and 226,492,417 bytes; a
version 1 file whose document holds a video, resolved from storage and refused when its videos exceed 100 MiB;
a 50 MiB video written and read back. Rule 13 is covered by the browser checks.
