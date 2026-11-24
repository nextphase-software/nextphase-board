# 0001 — Local persistence contract

Contract version: 4 (for 0012-W4 brief v1, 2026-11-24). Status: Draft. When accepted it replaces
[storage v3](0001-storage-v3.md) for later work. Depends on [document v21](0001-document-v21.md) and
[board file v5](0006-board-file-v5.md).

Every rule in v3 (and, through it, v2 and v1) still applies except where this version replaces or adds to it.
This version keeps each **video** a board's videos refer to once, by its hash, as its own record in the same
object store, beside the pictures; a video's first frame is an ordinary picture record. Boards' records, the
board list and every lock stay as v2 made them. It replaces:
- v3's picture-only view of `asset/` keys: an `asset/<hash>` key holds a **picture record** or a **video
  record** (see **Video records**);
- v3's **the board's pictures**, which now include its videos' first frames, and adds **the board's videos**
  and their own budget (see **Budgets**);
- v3's **Importing a picture**, **Writing pictures** and **Removing unused pictures**, which now cover videos
  (see below);
- the version references v3 carried: a board list entry whose payload `schemaVersion` is a safe integer above
  **15** has state `newer`.

## Video records

The database stays `nextphase-board` at **database version 1** with the one object store `boards`. No version
change, no new store and no index.

A **video record** has the key `asset/` followed by a video hash (document v21). Its value is a structured-clone
object with exactly these three properties:

| Property | Value |
| --- | --- |
| `bytes` | An `ArrayBuffer` of 1 to **52,428,800** bytes: the video file, unchanged |
| `mime` | `"video/mp4"`, `"video/quicktime"` or `"video/webm"`, the one its bytes' **video header** gives |
| `durationMs` | A safe integer 1 to 86,400,000: the length measured when the video was added |

A video record has no pixel size. A video's **header** is read from its first bytes:
- **MP4 / MOV**: bytes 4–7 are the ASCII text `ftyp`; then the major brand (bytes 8–11) `qt  ` (`q`, `t`, two
  spaces) is `video/quicktime`, and any other brand is `video/mp4`;
- **WebM**: bytes 0–3 are `1A 45 DF A3`, and within the first 64 bytes the EBML DocType element appears: the
  bytes `42 82`, then an EBML size of 4 (the byte `84`, or the 8-byte form `01 00 00 00 00 00 00 04`), then the
  ASCII text `webm`, all of it inside the first 64 bytes;
- anything else has no video header.

Bytes are classified with the **picture signature first**, using API v14's routing definition (`pictureSignature`:
PNG with `IHDR` at bytes 12–15, GIF with at least 10 bytes, JPEG, WebP): bytes with it are a picture (whose record
is then validated by v3's own rules) and are never tested for a video header (a WebP's `RIFF` size field could, by chance, read `ftyp` at bytes 4–7);
only bytes without one are tested for a header. A record's kind follows from its bytes by that order, exactly
as the server classifies an upload (API v14). A video record is **valid** when its key and value have exactly the form above, its
`mime` is its bytes' video header, and the SHA-256 digest of its bytes is the hash in its key. A video is
**available** in a tab when the tab holds a valid record's value for it (read from storage, imported, or read
from a board file). Availability never depends on whether this browser can play it (interaction v50). A record
is never changed in place: a key always holds the same bytes.

A **first frame** is stored as a v3 picture record (`mime` `"image/jpeg"`, its pixel size) under its own hash.
A video's first frame is **drawn for the video** only when its picture is drawn (v3) with the video's
`pixelWidth` × `pixelHeight` **and** its record's `mime` is `"image/jpeg"`; a valid PNG, GIF or WebP record under
a video's `poster` is never drawn for that video (it may still be drawn for an image that names it).

**Which `durationMs` a record holds.** A video record's `durationMs` is the length measured by the first
browser that stored those bytes. The **first stored value wins**: a later import of the same bytes (which may
measure a different length) never rewrites the record (**Importing a video**); the tab's memory takes a value
for a hash only when it holds none (an import, a read from storage, a board file or a download never replaces a
held one); and Save a copy writes the value the tab holds. A video object's own `durationMs` (document v21) is
what its badge and strip show; the record's value is never shown and never compared with it.
Recognised keys are v3's, with every `asset/<hash>` key holding either kind. As in v2, no code reads, changes or
deletes a key it does not recognise.

## Videos in the tab

As v3's **Pictures in the tab**, for videos: a tab keeps in memory (`tabVideos`) every video it has read from
storage, imported, downloaded or read from a board file, for as long as the page is open, whichever board is
open. On a single-user board, the videos a board needs are read from storage when the board opens and whenever
its videos refer to one the tab does not hold, in one readonly transaction (the pictures' read is v3's, its own
transaction). A record that is missing, invalid or of the other kind leaves that video unavailable; its videos
stay in the document, draw their first frames, and nothing is written or deleted because of it.

## Budgets

Counted per board over **distinct hashes**, each counted once however many objects refer to it, an unavailable
asset counting 0:
- **The board's pictures** are document v21's **document's pictures**: its images' assets and its videos'
  first frames. **The board's picture bytes** may be at most **52,428,800 bytes (50 MiB)**, as in v3: first
  frames count here.
- **The board's videos** are the document's videos (its videos' `asset`s). **The board's video bytes** are the
  sum of the `bytes` lengths of the available ones. They may be at most **104,857,600 bytes (100 MiB)**.

Per file: a picture at most 20,971,520 bytes (interaction v24, unchanged); a video at most 52,428,800 bytes.
Interaction v50 says which actions are refused to keep these.

## Importing a video

Before an imported video is added to the board (interaction v50), its video record **and** its first frame's
picture record are written together in one strict readwrite transaction (`durability: "strict"`), and the
video is added only after that transaction's `oncomplete`. If it fails (for example the browser's storage quota
is reached), that video is refused as interaction v50 says and neither record is written. A tab imports only
while its board is editable. The write never touches a board's records or the board list, and it is not a save.
When the key already exists, the existing records are kept as they are (the transaction writes only missing
keys), so the first stored `durationMs` stays.

## Writing assets

A board's save transaction and a board-creation transaction write, as v3 says for pictures, the record of each
of the board's pictures **and videos** that the tab holds and storage does not: they list the store's keys
inside the transaction and write only missing `asset/` keys, never reading or rewriting an existing record. An
asset the tab does not hold is not written, and the save still succeeds. Creating a board from a file writes,
in its one transaction, the record of each picture and video the file carried (board file v5) that storage does
not hold.

## Removing unused assets

v3's **Removing unused pictures** applies to both kinds with one change to step 2: every string value of an
`asset` **or `poster`** key on an object in a board record's `objects` array is **in use**, whatever the
document's version. Each `asset/<hash>` key whose hash is not in use is deleted, picture or video alike. So a
video and its first frame stay stored while any board's head or previous refers to them (by `asset` and
`poster`), and both go after the last reference goes. Removal never reads an asset record's value.

## The board list

v3's rule: a refresh never reads asset records, and an asset record written or removed between a refresh's read
and its write is not a change for the refresh's comparison.

## Applications built before this version

Pre-launch ([document v21](0001-document-v21.md)): nothing is promised. An application built before this
version treats a video record as an invalid picture (never drawn, never rewritten) and shows a version 15 board
as `newer`; its own removal step does not know `poster` and may remove a first frame that only a version 15
board refers to. The next save by this version writes it again from the tab's memory when the tab holds it.

## Required negative cases

v3's cases, plus: a video record with an extra or missing property, a `mime` that differs from its header, a
digest mismatch, more than 52,428,800 bytes, or a `durationMs` of 0 or a fraction is invalid and leaves its
video unavailable without being rewritten or deleted; a picture record under a video's key (and the reverse)
leaves that asset unavailable; bytes with both a WebP signature and `ftyp` at bytes 4–7 are a picture; a PNG
first frame is not drawn for its video; a second import of the same video bytes with another measured length
keeps the first record's `durationMs`; an import whose transaction fails writes neither the video nor its first frame;
two videos of one hash share one record; removal keeps a first frame referred to only by a `poster` and removes
a video and its first frame after the last reference goes; the picture budget counts first frames and the video
budget counts each video hash once; a save writes a missing video record once and never rewrites one; a board
created from a file writes its videos in the same transaction as its head.

## Public references

v3's references, and, retrieved 2026-11-24:
[ISO base media file format `ftyp` box (MDN: MP4 container)](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Formats/Containers#mpeg-4_mp4),
[QuickTime file format](https://developer.apple.com/documentation/quicktime-file-format),
[Matroska / WebM EBML header](https://www.matroska.org/technical/elements.html),
[MDN video codec guide](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Formats/Video_codecs).
