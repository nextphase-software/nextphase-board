# 0006 — Board file contract

Contract version: 2 (for 0012-W1 brief v1, 2026-10-28). Status: Draft. When accepted it
replaces [board file v1](0006-board-file-v1.md) for later work. Depends on
[document v10](0001-document-v10.md) and [storage v3](0001-storage-v3.md); used by
[interaction v24](0001-interaction-v24.md).

Every rule in v1 still applies except where this version replaces it. A board file now carries the
board's **pictures** with its document, so a board with images can be moved to another browser
and opened there with every picture. Files written by v1 still open. It replaces:
- v1's **Format** and **Writing**: Board writes file version 2 (see **Format** and **Writing**);
- v1's size limit of 4,194,304 bytes: a file may be up to **75,497,472 bytes (72 MiB)**;
- v1's **Reading** table (see **Reading**);
- v1's statement that a payload is at document version 1 to 7 (document v8 and v9 amended it to 8
  and 9): a document in a file is at its own version, **1 to 10**.

## Format

The file is UTF-8 text with no byte order mark: the JSON serialization, without indentation, of an
object with exactly these keys in this order (v1's four keys):

| Key | Value |
| --- | --- |
| `format` | The string `"nextphase-board"` |
| `fileVersion` | The integer `2` |
| `payload` | The **bundle** below **as a string** |
| `sha256` | Lowercase 64-character hex SHA-256 digest of the payload string's UTF-8 bytes |

The **bundle** is the JSON serialization, without indentation, of an object with exactly these
keys in this order:

| Key | Value |
| --- | --- |
| `document` | The board's canonical document JSON (document contract) **as a string**, at the document's own `schemaVersion` (1 to 10) |
| `assets` | An array with one **picture entry** for each of the document's pictures (document v10: the distinct `asset` hashes of its images), sorted by `sha256` in code-unit order; empty when the document has no image |

Each picture entry is an object with exactly these keys in this order:

| Key | Value |
| --- | --- |
| `sha256` | The picture's hash (64 lowercase hex characters) |
| `mime` | As in a storage v3 picture record |
| `pixelWidth`, `pixelHeight` | As in a storage v3 picture record |
| `base64` | The picture's bytes in base64 ([RFC 4648 section 4](https://www.rfc-editor.org/rfc/rfc4648#section-4): the standard alphabet with `=` padding, no line breaks or other characters) |

The whole file is at most 75,497,472 bytes. A board within its limits (document v10's payload,
storage v3's 50 MiB of pictures) normally fits; one that does not is not written (see
**Writing**). The file name is as in v1.

## Writing

Board always writes file version 2. The bundle's `document` is v1's payload rule, at version 10:
- when the open board has had no edit since it was opened or last saved, that board's document
  exactly as opened or saved (its own version), so an unedited board's file holds its saved
  payload byte for byte;
- otherwise the canonical form of the board as shown, at version 10, unsaved edits included.

Its `assets` hold every picture that document refers to, from the tab's memory (storage v3's
**Pictures in the tab**; a picture not yet in memory is first read from storage). A file is not
written when:
- any of the document's images has a picture that is not drawn for it (storage v3: unavailable,
  its bytes do not decode to its pixel size, or its pixel size differs from the image's; the page
  decodes each picture before writing), with the reason "a picture is unavailable";
- the board's picture bytes are above 52,428,800, with the reason "pictures exceed the 50 MiB
  board limit";
- the file would be above 75,497,472 bytes, with the reason "it is larger than 72 MiB".

A file is never written with a picture missing or cut short. Writing never saves, never changes
storage and never needs the writer lock.

## Reading

The rules below run in this order. The first rule whose condition holds refuses the file with its
reason, and no later rule runs; a file that no rule refuses is accepted. Rules 1 to 7 are v1's with
the new size and file version; rules 8 to 11 apply to the board's **document**: for file version 1,
the `payload` string itself; for file version 2, the bundle's `document` string.

| # | Refused when | Reason |
| --- | --- | --- |
| 1 | The file's size is above 75,497,472 bytes (checked before it is read, and again on the bytes read) | it is larger than 72 MiB |
| 2 | Its bytes do not decode as UTF-8 (fatal decoding; a byte order mark is kept and so fails JSON parsing), or do not parse as JSON | it is not a Board file |
| 3 | It is not an object with exactly the four keys in order, or does not serialize back without indentation to exactly the decoded text | it is not a Board file |
| 4 | `format` is not `"nextphase-board"` | it is not a Board file |
| 5 | `fileVersion` is a safe integer above 2 | it was made by a newer version of Board |
| 6 | `fileVersion` is not 1 or 2, or `payload` or `sha256` is not a string | it is not a Board file |
| 7 | `sha256` is not 64 lowercase hex characters, or differs from the payload's digest | it is damaged |
| 8 | File version 2 only: the payload does not parse as JSON, is not an object with exactly the keys `document` and `assets` in that order, does not serialize back without indentation to exactly the payload, or its `document` is not a string | it is damaged |
| 9 | The document does not parse as JSON | it is not a valid board |
| 10 | Its `schemaVersion` is a safe integer above 10 | it was made by a newer version of Board |
| 11 | It does not validate as a document of its own version, or its canonical form differs from the document string | it is not a valid board |
| 12 | File version 2 only: `assets` is not an array; an entry is not an object with exactly the five keys in order; an entry's `sha256` is not a string greater than the previous entry's (code-unit order, so sorted and unique); its `base64` is not base64 as above, or does not encode back to exactly itself after decoding; its decoded bytes with its `mime`, `pixelWidth` and `pixelHeight` do not form a valid storage v3 picture record under the key `asset/<sha256>`; the entries' hashes are not exactly the document's pictures; an image's `pixelWidth` or `pixelHeight` differs from its picture entry's; or the pictures' bytes add up to more than 52,428,800 | it is damaged |
| 13 | File version 2 only: a picture's bytes do not decode in the browser to a first frame of exactly its `pixelWidth` × `pixelHeight` pixels (checked before anything is asked or changed) | it is damaged |

Rules 1 to 12 are pure checks on the bytes; rule 13 needs the browser's decoder. A file version 1
file supplies no pictures: if its document (at any version 1 to 10) holds images, the new board
uses the pictures the tab already holds or storage already has for those hashes (storage v3), and
only images whose picture neither has are unavailable. Before anything is asked or changed, the
page reads those pictures; if the board's picture bytes would then be above 52,428,800, the file is
refused with the reason "its pictures exceed the 50 MiB board limit". A file version 2 file is refused whole if any picture is
missing or damaged: Board never opens part of a file.

Reading never writes. A file that passes every check is a valid board document at its own version
with its pictures; storage v3's **Creating a board from a file** (v2's steps, with the pictures
written in the creation transaction) says what happens next. The tab keeps the file's pictures in
memory (storage v3) once the board is created.

## Applications built before this version

An application that implements only v1 refuses a version 2 file without changing anything: a file
of at most 4,194,304 bytes reaches its own rule 5, "it was made by a newer version of Board"
(the four outer keys are v1's); a larger file is refused earlier by its own rule 1, "it is larger
than 4 MB".

## Identity

v1's rules apply. Pictures are identified by their hash, so opening the same file twice gives two
boards that share each picture record (storage v3).

## Verification

Unit tests cover: writing a board of each version 1 to 10 and reading it back, the document byte
for byte; the unedited-versus-edited document rule; a board with images: one entry per distinct
picture, sorted, with base64 that decodes to the stored bytes, and the digest over the whole
payload; each refusal reason when writing (an unavailable picture, the size limit); each rule in
the table with a file that only that rule refuses, including v1's cases, a file version 3, a
schema version 11, a bundle with keys out of order or an extra key, an unsorted or repeated entry,
non-canonical base64 (line breaks, missing padding, a character outside the alphabet), bytes whose
digest, signature or `mime` disagree, a missing and an extra entry, an image whose pixel size
differs from its entry's, and pictures above 52,428,800 bytes in all; the size limit at exactly
75,497,472 and 75,497,473 bytes; a version 1 file still read, including one whose document holds
an image, and refused when the pictures it resolves exceed 52,428,800 bytes; writing refused for
an image whose pixel size differs from its picture's; a 20 MiB picture written and read back.
Rule 13 is covered by the browser checks.
