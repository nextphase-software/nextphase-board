# 0006 — Board file contract

Contract version: 1 (for 0006-W2 brief v1, 2026-10-27). Status: Draft. Depends on
[the document contract](0001-document-v7.md); used by [storage v2](0001-storage-v2.md) and
[interaction v20](0001-interaction-v20.md).

A **board file** is one board saved outside the browser: Board's own open format, readable as
JSON. It holds the board's document only: no undo history, view, selection, comments or other
boards.

## Format

The file is UTF-8 text with no byte order mark: the JSON serialization, without indentation, of
an object with exactly these keys in this order:

| Key | Value |
| --- | --- |
| `format` | The string `"nextphase-board"` |
| `fileVersion` | The integer `1` |
| `payload` | The board's canonical document JSON (document contract) **as a string**, at the document's own `schemaVersion` (1 to 7) |
| `sha256` | Lowercase 64-character hex SHA-256 digest of the payload string's UTF-8 bytes |

The whole file is at most 4,194,304 bytes. The file name is the board's title with each of
`< > : " / \ | ? *`, each control character U+0000–U+001F and U+007F replaced by `_`, trailing
spaces and dots replaced by one `_`, a leading `_` added when the name is a reserved Windows
device name (CON, PRN, AUX, NUL, COM0–COM9, LPT0–LPT9, alone or before a dot, any case),
`Untitled board` when empty, then `.nextboard`.

## Writing

The payload is:
- when the open board has had no edit since it was opened or last saved, that board's document
  exactly as opened or saved (its own version), so an unedited board's file holds its saved
  payload byte for byte;
- otherwise the canonical form of the board as shown, at version 7, unsaved edits included.

A board that cannot be written in 4,194,304 bytes is not written. Writing never saves, never
changes storage and never needs the writer lock.

## Reading

The rules below run in this order. The first rule whose condition holds refuses the file with
its reason, and no later rule runs; a file that no rule refuses is accepted:

| # | Refused when | Reason |
| --- | --- | --- |
| 1 | The file's size is above 4,194,304 bytes (checked before it is read) | it is larger than 4 MB |
| 2 | Its bytes do not decode as UTF-8 (fatal decoding; a byte order mark is kept and so fails JSON parsing), or do not parse as JSON | it is not a Board file |
| 3 | It is not an object with exactly the four keys in order, or does not serialize back without indentation to exactly the decoded text | it is not a Board file |
| 4 | `format` is not `"nextphase-board"` | it is not a Board file |
| 5 | `fileVersion` is a safe integer above 1 | it was made by a newer version of Board |
| 6 | `fileVersion` is not 1, or `payload` or `sha256` is not a string | it is not a Board file |
| 7 | `sha256` is not 64 lowercase hex characters, or differs from the payload's digest | it is damaged |
| 8 | The payload does not parse as JSON | it is not a valid board |
| 9 | Its `schemaVersion` is a safe integer above 7 | it was made by a newer version of Board |
| 10 | It does not validate as a document of its own version, or its canonical form differs from the payload | it is not a valid board |

Reading never writes. A file that passes every check is a valid board document at its own
version; storage v2's "Creating a board from a file" says what happens next.

## Identity

Opening a board file always creates a new board with a new board ID (storage v2). Everything
else in the document is kept, including object IDs, generations and retired generations: IDs
only need to be unique within a board, and opening a file is not the restoration of a deleted
object (document v1's fresh-generation rule applies within a board). Opening the same file
twice gives two boards. A file holds no reference to the board it came from.

## Verification

Unit tests cover: writing a board of each version 1 to 7 and reading it back byte for byte; the
unedited-versus-edited payload rule; each rule in the table with a file that only that rule
refuses, including a wrong key order, an extra key, indentation, a byte order mark, invalid
UTF-8, a future `fileVersion`, an upper-case digest, a payload in another version's canonical
form and a future `schemaVersion`; the size limit at exactly 4,194,304 and 4,194,305 bytes; the
file name rules for each replaced character, trailing dots and spaces, each device name and
an empty title.
