# 0001 — Local persistence contract

Contract version: 3 (for 0012-W1 brief v1, 2026-10-28). Status: Draft. When accepted it
replaces [storage v2](0001-storage-v2.md) for later work. Depends on
[document v10](0001-document-v10.md) and [board file v2](0006-board-file-v2.md).

Every rule in v2 (and, through it, v1) still applies except where this version replaces or adds to
it. This version keeps each picture that a board's images refer to **once**, by its hash, as its own
record in the same object store, beside the boards. Boards' records, the board list and every
lock stay as v2 made them, so an application built before this version still opens, edits and
saves its boards in a profile that holds pictures. It replaces:
- v2's list of recognised keys: picture records are recognised too (see **Picture records**);
- v2's rule that nothing but a board's own save writes or deletes records: a save also writes the
  pictures its board refers to and removes pictures no board refers to (see **Writing pictures**
  and **Removing unused pictures**), and importing a picture writes its record (see **Importing a
  picture**);
- the version references document v9 gave v2: a board list entry whose payload `schemaVersion` is
  a safe integer above **10** has state `newer`, and a board created from a file at an earlier
  version becomes version **10** at its first save after an edit.

## Picture records

The database stays `nextphase-board` at **database version 1** with the one object store
`boards`. No version change, no new store and no index.

A **picture record** has the key `asset/` followed by a picture's hash (document v10: 64
characters, each `0`–`9` or `a`–`f`). Its value is a structured-clone object with exactly these
four properties:

| Property | Value |
| --- | --- |
| `bytes` | An `ArrayBuffer` of 1 to 52,428,800 bytes: the picture |
| `mime` | `"image/png"`, `"image/jpeg"`, `"image/gif"` or `"image/webp"`, the one its bytes' **signature** gives |
| `pixelWidth`, `pixelHeight` | Safe integers, each 1 to 4,096: the picture's pixel size |

A picture's **signature** is read from its first bytes: `89 50 4E 47 0D 0A 1A 0A` is PNG;
`FF D8 FF` is JPEG; the ASCII text `GIF87a` or `GIF89a` is GIF; the ASCII text `RIFF` followed by
any four bytes and then `WEBP` is WebP. Any other start has no signature.

A picture record is **valid** when its key and value have exactly the form above, its `mime` is
its bytes' signature, and the SHA-256 digest of its bytes is the hash in its key. A picture is
**available** in a tab when the tab holds a valid record's value for it (read from storage,
imported, or read from a board file). It is **drawn** only when it is available and the browser
decodes its bytes to a first frame of exactly `pixelWidth` × `pixelHeight` pixels (interaction
v24). An image's picture is **drawn for that image** only when it is drawn and its record's
`pixelWidth` and `pixelHeight` equal the image's. A record is never changed in place: a key always
holds the same bytes.

Recognised keys are v2's and every `asset/<hash>` key as above. As in v2, no code reads, changes
or deletes a key it does not recognise.

## Pictures in the tab

A tab keeps in memory every picture it has read from storage, imported or read from a board file,
for as long as the page is open, whichever board is open: switching boards, Reopen and Undo never
drop one. The pictures a board needs are read from storage, in one readonly transaction, when the
board opens and whenever its images refer to a picture the tab does not hold. A record that is
missing or invalid leaves that picture unavailable; one whose bytes do not decode to its pixel size
is available but not drawn. Either way its images stay in the document, are drawn as interaction
v24 says for a missing picture, and nothing is written or deleted because of it.

**The board's pictures** are the distinct hashes its images refer to. **The board's picture
bytes** are the sum of the `bytes` lengths of the board's pictures that are available in the tab,
each hash counted once however many images refer to it; an unavailable picture counts 0. It may be
at most **52,428,800 bytes (50 MiB)**: interaction v24 says which actions are refused to keep it so.

## Importing a picture

Before an imported image is added to the board (interaction v24), its picture's record is written
in its own strict readwrite transaction (`durability: "strict"`), and the image is added only after
that transaction's `oncomplete`. If the transaction fails (for example the browser's storage quota
is reached), that picture is refused as interaction v24 says and nothing else changes. A tab
imports only while its board is editable (so while it holds that board's writer lock). The write
never touches a board's records or the board list, and it is not a save: the board stays unsaved
until the next Save. Writing a record whose key already exists is allowed: the value is the same.

## Writing pictures

A board's save transaction (v1's strict readwrite transaction, as v2 extends it) also writes the
record of each of the board's pictures that the tab holds and storage does not: it lists the
store's keys inside the transaction and writes only missing `asset/` keys, never reading or
rewriting an existing picture record. A picture the tab does not hold is not written, and the save
still succeeds (its images stay unavailable). All of this is one transaction with the head,
previous and board list writes: either all of it is stored or none of it.

Creating a board from a file (v2's step 3) writes, in its one transaction, the board's head, its
list entry and the record of each picture the file carried (board file v2) that storage does not
hold. So a board created from a file is never stored without its pictures.

## Removing unused pictures

At the end of each save transaction and each board-creation transaction, after its writes, the
transaction removes the picture records no board refers to:
1. It lists the store's keys, without reading any picture record's value.
2. It reads every board record (each board key's head and previous, the original board's
   included) and, for each, parses the envelope's `payload` as JSON. Every string value of an
   `asset` key on an object in that document's `objects` array is **in use**, whatever the
   document's version.
3. If any board record cannot be parsed so (its value is not a JSON string of an object with a
   string `payload`, or that payload is not JSON of an object with an `objects` array), nothing is
   removed.
4. Otherwise each `asset/<hash>` key whose hash is not in use is deleted.

So a picture stays stored while any board's head or previous refers to it: deleting an image and
saving once keeps the picture (the previous record still refers to it), and a second save removes
it when no other board refers to it. Removing never changes a board record or the board list, and
never drops a picture from any tab's memory: Undo can bring an image back after its picture was
removed, and the next Save writes the record again from memory. Picture records are never removed
anywhere else; a refresh of the board list neither reads nor writes them.

## The board list

v2's rules apply with one change: a refresh reads and compares the board list record and the board
records only. It never reads picture records, and a picture record written or removed between a
refresh's read and its write is not a change for the refresh's comparison.

## Applications built before this version

An application built before this version reads only its own recognised keys, so it never reads,
changes or removes picture records: it opens, edits and saves a version 1 to 9 board in a profile
that holds them, and shows a version 10 board in its unsupported-data view (document v10) without
changing any board record or picture record; its board list refresh may record that board as
`newer` (v2's advisory list). Its saves never remove pictures; the next save by this version does.

## Required negative cases

v2's cases, plus: an import whose picture transaction fails adds nothing and changes no record;
two images of one picture, a copy and a duplicate all share one record; a save writes a missing
picture once and never rewrites an existing one; a save whose tab lacks a picture still succeeds and
writes no record for it; removal keeps a picture referred to by any board's head or previous, by a
board of a future version or by another board, removes it after the last reference goes, and
removes nothing while any board record cannot be parsed; removal never reads a picture value; a
failed save leaves every picture record as it was; a missing, invalid (wrong keys, wrong `mime`,
digest mismatch) or undecodable record leaves its images unavailable and is never rewritten or
deleted on that account; a board created from a file writes its pictures in the same transaction
as its head; an application built from the version before this contract keeps working on a
version 9 board with picture records present and changes none of them.

## Public references

v2's references (retrieved 2026-10-27), and, retrieved 2026-10-28:
[HTML: structured clone of `ArrayBuffer`](https://html.spec.whatwg.org/multipage/structured-data.html),
[PNG signature](https://www.w3.org/TR/png-3/#5PNG-file-signature),
[JPEG (ITU-T T.81)](https://www.w3.org/Graphics/JPEG/itu-t81.pdf),
[GIF89a](https://www.w3.org/Graphics/GIF/spec-gif89a.txt),
[WebP container](https://developers.google.com/speed/webp/docs/riff_container).
