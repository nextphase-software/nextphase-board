# 0001 — Board document contract

Contract version: 10 (for 0012-W1 brief v1, 2026-10-28). Status: Draft. When accepted it
replaces [document v9](0001-document-v9.md) for later work. Used by
[storage v3](0001-storage-v3.md) and [board file v2](0006-board-file-v2.md), which hold the
pictures this version's images refer to.

Every rule in document v9 (and, through it, documents v8 back to v1) still applies except where
this version replaces it. This version adds the **image** type: a picture placed on the board as
an idea, saved as a reference to its picture's bytes, the picture's pixel size and a description.
The bytes themselves are never in the document: storage v3 keeps them beside the board and board
file v2 carries them in a file. This version also defines how version 1 to 9 documents are read and
which earlier rules now read "10" where they read "9". It replaces:
- document v8's list of eligible ideas: images are not eligible ideas (see **Terms**);
- document v9's **Version references in other contracts**: storage v3 and board file v2 state
  their own version rules, and only the activity catalogue's reference is restated below.

## Terms

A **picture** is the bytes of one PNG, JPEG, GIF or WebP image file, as storage v3 stores them. Its
**hash** is the lowercase hexadecimal SHA-256 digest of those bytes (64 characters). Its **pixel
size** is the width and height in pixels of the picture's first frame as a browser decodes it.

An **image** is an idea in document v5's sense: it may be a member of a section and a member of a
group. It is **not** an eligible idea in document v7's sense: a connector end may never name an
image. Eligible ideas are still stickies, text objects and shapes.

## Saved document (version 10)

A complete version 10 document has the same top-level keys as version 9, in the same order, with
`schemaVersion` the integer **10**.

Stickies, text, sections, shapes, strokes and connectors in a version 10 document have exactly
their version 9 keys. An image has these keys, in this order:

| Field | Required value |
| --- | --- |
| id, generation, type | As in document v9, with `type` also allowing `"image"` |
| group, section | As in document v9 |
| asset | The hash of the image's picture: exactly 64 characters, each `0`–`9` or `a`–`f` |
| pixelWidth, pixelHeight | The picture's pixel size: safe integers, each 1 to 4,096 inclusive |
| description | Well-formed Unicode plain text, 0–1,000 code points; multiline allowed (document v1's `text` rule); `""` when the image has none |
| x, y | As in document v9 (finite numbers) |
| width, height | Finite numbers, each 1 to 20,000 inclusive; `x + width` and `y + height` at most 1,000,000, as in document v1 |
| order | As in document v9 |

An image has no `text`, `color`, `textSize`, `align`, `marks`, `kind`, `weight`, `points`,
`shape`, `fill`, `border` or connector key: any of those on an image is rejected, as are `asset`,
`pixelWidth`, `pixelHeight` and `description` on any other type, an image missing any of its
keys, and an image in a version 1 to 9 document.

The document does not tie an image's `width` and `height` to its pixel size: an image is drawn
to fill its rectangle (interaction v24), and the pixel size records which picture it shows. Two
images may have the same `asset`; each holds its own position, size and description. Nothing in
the document says whether the picture's bytes are present: a document is valid whether or not
storage or a file holds them (storage v3 and board file v2 say what happens when they are
missing).

## Limits by type

Images count toward the 250-object limit, the 2,097,152-byte payload limit and the identity and
generation rules like any object. The payload holds only each image's keys above, never picture
bytes, so the payload limit is unchanged. The limits on picture bytes (a 20 MiB file, 4,096 pixels
on the long side, 50 MiB of pictures on one board) are storage v3's and interaction v24's.

## Canonical payload

A version 10 document is serialized as document v9 describes, with the image key order above and
version 9's key orders for every other type. Version 1 to 9 documents are serialized as their own
contracts describe. As before, a board keeps the version it was read with until it is saved:
serializing a board read from a version 1 to 9 payload produces that payload byte for byte.

## Reading version 1 to 9 documents

The decoder accepts version 1 to 9 documents exactly as their contracts define them, and a
version 10 document as defined above. When a version 1 to 9 board is opened for editing it is
upgraded **in memory** to version 10 by the earlier steps (a version 9 board needs none: no object
changes). So an older board looks exactly as before. As before, the upgrade is not an edit: no
draft revision, transaction or history step, the board is not marked Unsaved, and opening never
writes storage. The next explicit Save writes version 10.

A new board is version 10.

## Older versions of the application

An application that implements only documents v1 to v9 treats a version 10 record as an unknown
version, as document v9 says for its own successor: it shows its unsupported-data view, disables
editing and Save, draws no object from the version 10 record, and changes no board record or
picture record (its advisory board list, storage v2, may record the board as `newer`). A board saved
as version 10 can be viewed and edited only by applications that implement this version or later,
whether or not it holds an image.

## Version references in other contracts

[Storage v3](0001-storage-v3.md) and [board file v2](0006-board-file-v2.md) replace storage v2 and
board file v1 and state their own version rules (a document version above 10 is newer). The
[activity catalogue v1](0008-activity-catalogue-v1.md) reference becomes: an activity's payload
`schemaVersion` stays **7**, and reading an activity file still gives its version 7 document.
Adding one copies its objects onto a version 10 board (interaction v21's copies, document v9's
default connector style). Activities hold no images.

## Identity, transactions and the adapter

Document v1's identity and transaction rules apply. Adding images (one or several at once),
moving or resizing them, and changing a description are semantic changes, each committed
atomically with one draft revision. Reading, decoding or storing a picture is never in the
document or the adapter, and neither is an image being imported (from the moment a file is
chosen, pasted or dropped until it is added).

In the adapter, each live image's map holds generation, type, group, section and order, the
atomic **geometry** value (`x`, `y`, `width`, `height`) that every object with a rectangle has
under document v1, and the values `asset`, `pixelWidth`, `pixelHeight` and `description`, each
held whole as a plain value (a description is never held as shared text). Images hold no text,
style, marks, kind, weight, points or connector values; other objects hold none of the image
keys. Projection to JSON and re-creation of the adapter from validated JSON include them. A
restored image gets back its asset, pixel size, description and position with its logical ID, and
a fresh generation under document v1's rule.

## Public references

Document v1's references (retrieved 2026-10-22) apply, and
[FIPS 180-4, Secure Hash Standard](https://csrc.nist.gov/pubs/fips/180-4/upd1/final) (SHA-256,
retrieved 2026-10-28). The image keys and the compatibility rules above are this project's
contract.
