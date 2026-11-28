# 0008 — Team templates contract

CONTRACT VERSION: 0008 team templates v6 (2026-11-27)

Status: Draft for 0011-W3 v1. Replaces [team templates v5](0008-team-templates-v5.md), whose text is kept here in
full with its version numbers moved on only where this version requires it. **Changes from v5, in short:** template
objects are validated inside a version **18** wrapper ([document v24](0001-document-v24.md)), so every table a template
holds has `merges`, the list of its merged cells (`[]` when it has none), under document v24's merge rules. Saving
keeps each table's `merges` exactly as it keeps its cells; Add template inserts a table through the existing copy path
(`insertStored` → `copyObjects`), which gives the table, its rows and columns new ids and maps its merges to them
(`remapTable`, document v24). A merge is not media: it names no file, adds nothing to a template's store or its
20,971,520 bytes, and never makes a template need an upload; it counts toward the 262,144 bytes of content as every
value does. A table that breaks document v24's merge rules makes the object invalid, as any invalid object is today.
**Reads normalise, writes stay strict.** A table saved in a template before this version has no `merges`. When the web
app reads saved templates (the list, a template's detail and the answers to save, replace and rename), each such table
is read as if it held `merges: []` (**Reading saved templates**, below), so one older template never hides the others
and adds exactly as a new one does. Every write (Save as template, Replace with selection, the server's
`templateObjects`) stays strict: a table without `merges` is refused there as any invalid object is.

**v5's changes from v4:** template objects are validated inside a version **17** wrapper ([document v23](0001-document-v23.md)), so a template may hold
**links in text** (a `link` on a mark of a sticky, shape or text object). Saving and adding keep each object's marks,
links included, exactly as they keep its flags. A link is not media: it names no file, adds nothing to a template's
store or its 20,971,520 bytes, and never makes a template need an upload. A link that breaks document v23's rules (its
link address rule, or a link outside a rich-text object) makes the object invalid, as any invalid object is today.
Saving or adding a template never opens or fetches a link.

**v4's changes from v3:** a team
template may hold **link cards** ([document v22](0001-document-v22.md)). A card's **thumbnail** (its non-null `asset`)
is **template media of the picture kind**: it is counted in the 20 MiB a template holds, saved through the existing
template upload and added to a board through the existing picture upload, exactly as an image's picture is. A card
whose `asset` is `null` names no media. Saving or adding a template never asks the link preview service.

v3 replaced [team templates v2](0008-team-templates-v2.md), whose storage, rights, limits, server checks, wrapper
(document v18: stored objects carry no `page`), panel rules, saving with nothing selected and inserting remain word
for word except as below. A team template may hold **images and videos** (v3) and **link cards** (this version).

## What a template holds

- Its objects (unchanged limits: 1–250 objects, at most 262,144 bytes of content, 25 templates a workspace), which
  may include `image` and `video` objects ([document v21](0001-document-v21.md)) and `link` cards (document v22).
  The objects are validated inside a version **18** wrapper (v5: 17; v4: 16).
- When any object names media (an image, a video, or a card whose `asset` is not `null`), a **template store**
  ([hosted storage v15](0003-hosted-storage-v15.md)) holding every picture, first frame, card thumbnail and video
  they name, **at most 20,971,520 bytes in all**. The template row names it (`store`). A template without media has
  no store; a template whose only cards have `asset: null` and that holds no image or video is a template without
  media.
- A card's thumbnail is held in the store as a **picture** (its picture type), never as a video or a first frame. A
  hash that is both an image's picture and a card's thumbnail is one asset.

## Saving and replacing

1. The web app collects the media hashes of what is being saved (Save as template, or Replace with selection),
   cards' thumbnails included (`assetsOf`, document v22), asks the board for their sizes once when the dialog opens
   (API v15 `asset-sizes`) and shows the picture line ([interaction v52](0001-interaction-v52.md); a card's thumbnail
   counts as one picture in "Includes N pictures"). Over 20,971,520 bytes, nothing is sent.
2. On Save: open a template upload with the asset list (a thumbnail listed as a picture); for each file in media
   order, download it from the board (the existing picture `download` or `downloadVideo`; a thumbnail with
   `download`) and upload it to the template upload; then save (or replace) with `upload` set. Any failure ends the
   save with its reason and saves nothing; the staged store idles out.
3. The server commits the store (one use), checks the objects against its inventory, writes the row, and erases the
   store on a certain refusal, or the replaced store after a replace (API v15). A replace with a media-free selection
   sends no `upload`; the row's `store` becomes null and its old store is erased.

`templateBoard(objects)` in `apps/web/src/team/templates-rules.ts` validates inside a version 18 wrapper and no
longer throws for valid images, videos and link cards; every other check (an invalid object still throws, a `link`
object missing a key included), its content-size check (262,144 bytes) and its message are unchanged.
`templateObjects(value, held?)` in `apps/server/src/templates.ts` validates inside a version 18 wrapper; it refuses
media exactly as today when `held` is absent, where an object names media when `assetsOf(o).length > 0` (so a card
with a non-null `asset` is refused without `held`, and a card with `asset: null` is accepted); and it checks each
media hash against `held` (a map from hash to asset entry) when it is given, through `requireHeldMedia` (sync v18:
a card's thumbnail must be held with a picture type, else 400 `asset_missing`). A save or replace that sends
`upload` must hold at least one object that names media in the same sense (else 400 `bad_request`, as today for an
upload with no image or video).

**Reading saved templates (v6).** `apps/web/src/team/templates-rules.ts` gains the pure
`legacyTemplateObjects(objects: unknown): unknown`. When `objects` is an array, it answers a new array in which each
element that is a non-null, non-array object with `type === "table"` and **no own `merges` key** is copied with
`merges: []` added (its other keys and values unchanged); every other element, and every table that has a `merges` key
(whatever its value), is kept as it is. When `objects` is not an array it answers `objects` unchanged. It never adds
or removes a merge, a cell, a row or a column, and never changes a key that is present. `parseTemplate(value)` (used for
the list through `parseTemplates`, for a detail through `parseTemplateDetail`, and for the save, replace and rename
answers) applies it
to the answer's `objects` **before** `templateBoard` validates them, and returns the template with the normalised
`objects`, so the panel's preview and Add template (`templateBoard(fresh.objects)` → `insertStored`) only ever see
tables with `merges`.

**Byte cap on reading (v6).** The `merges: []` that `legacyTemplateObjects` adds is never counted on a read. The
262,144-byte content cap is measured on the **stored** objects: `parseTemplate` checks `contentBytes` of the answer's
objects **before** normalising them (above the cap: today's error and message), then validates the normalised objects
with `templateBoard(objects, true)`. `templateBoard(objects, read = false)` gains that optional second parameter: when
`read` is `true` it validates exactly as today but does not check the content cap (the read already measured it);
the panel's preview call (`templates-section.tsx`, a template's card) passes `true` too. Every other call keeps the
default and measures the objects as given, as today: Save as template and Replace (the selection) and **Add
template** (`templateBoard(fresh.objects)`, the normalised objects), and the server's `templateObjects` on every
write. So a template saved before this version at the cap is listed and previewed, and its Add may then be refused
with today's message "This is too large for a template. Select fewer objects."; nothing is trimmed. A table whose `merges` is present but breaks document v24's merge rules is not repaired: that
template is refused as an invalid template is today. Nothing writes the normalised objects back: the stored row keeps
its bytes until the template is replaced. Writes do **not** normalise: `templateBoard` called on a selection before
Save or Replace, and the server's `templateObjects`, validate the objects as given inside the version 18 wrapper, so
a table without `merges` is refused there (client: the existing error; server: 400 `bad_request`). The server reads
stored objects only to answer them (it does not validate them on reading), so it needs no normalisation.

A card is saved with all its keys, `state` and `requestedAt` included: a `loading` card is saved `loading`.

## Adding

Add template on a team board: read the template's fresh detail as today; when it holds no object that names media
(no image, no video, no card with a thumbnail), add it exactly as today. When it holds media: close the panel
(`commands.closeTemplates()`), then, in the board-lifetime runner (`templateAdds(hosted)`, web modules v49), using
that detail's `media` list: check that every media hash of its objects is in `media` with its kind (a card's
thumbnail with the picture kind); for each media file in order download it from the template (`readTemplateAsset`)
and upload it to the board (`upload` or `uploadVideo`; a thumbnail with `upload`); only when every file answered
`ok`, insert the objects through today's `insertStored` → `copyObjects` → commit, unchanged. A template without media
is added exactly as today. Each file keeps its hash, so the inserted objects name files the board now holds and the
room's `asset_missing` check passes.

**Adding never fetches a preview.** Inserted cards keep every key the template holds (document v22 link rule 6): a
`ready` card is added ready, a `linkOnly` card link-only, and a `loading` card stays `loading` and is drawn link-only
once document v22's 20,000 ms past its `requestedAt` have passed. No arrival edit is written for an added card.

## Preview and panel

The template preview keeps drawing images and videos as outlined boxes, as today, and draws link cards the same way
(an outlined box at the card's stored rectangle). The panel, its cards, menus and counts are unchanged; while an add runs, the
cards' Add buttons are disabled (interaction v51).

## Deleting

Deleting a template erases its store. Boards that received its pictures (cards' thumbnails included) keep their own
copies.

## Verification

In addition to v3's checks, in two separate groups.

**Server checks** (the server's transfer and storage path): a template holding link cards in every state saved and
listed; `templateObjects` accepting a valid card and refusing a `link` object missing a key or whose size is not a
card size (document v22); a card with a thumbnail refused without `upload` (400 `bad_request`) and accepted with an
upload whose store holds it as a picture; a store holding the thumbnail as a video or not at all refused 400
`asset_missing`; an upload whose only media is a card's thumbnail accepted; adding such a template puts the thumbnail
on the target board.

**Client checks** (the web app's own path, unit tests with transfer doubles and a `fetch` stub that fails on any
request to a link preview route): `templateBoard` accepting a valid card and refusing a `link` object missing a key;
the thumbnail counted in the 20,971,520 bytes and in the picture line; Save as template downloading the thumbnail with
`download` and sending it as a picture; and, named **X10-U15**, **client Add template with a card**: `runTemplateAdd`
with a template whose card has a thumbnail downloads it from the template and uploads it to the target board through
the existing picture `upload` (kind `"picture"`) before `insertStored` inserts the card with every key kept, a
media-free card template inserted directly, and no request to either link preview route during save or add.

**Version 5 adds**, in the same two groups. Server: `templateObjects` accepting a sticky, a shape and a text object
whose marks hold valid links inside the version 17 wrapper, without `upload`; and refusing (400 `bad_request`) a link
the link address rule refuses, a link not equal to its own result, and a link on a connector's label. Client:
`templateBoard` accepting and refusing the same objects; Save as template and Add template keeping every mark with
its `link` byte for byte; a template whose only "extra" content is links counted as a template without media (no
upload, no store).

**Version 6 adds**, in the same two groups. Server: `templateObjects` accepting, inside the version 18 wrapper and
without `upload`, a table with `merges: []` and one with a 2 × 2 merge whose anchor holds text; and refusing (400
`bad_request`) a table without a `merges` key, one with two overlapping merges, one with a merge past the table's last
row, one with a 1 × 1 merge and one with text in a covered cell. Client: `templateBoard` accepting and refusing the
same objects; Save as template keeping a table's `merges` byte for byte; Add template inserting the table with new
table, row and column ids and its merges mapped to them (the same `rows` and `columns`, the anchor's text in the new
anchor); a template whose only "extra" content is merges counted as a template without media (no upload, no store).
`legacyTemplateObjects`: a table without `merges` gaining `merges: []` and nothing else; a table with `merges` (valid,
and invalid) kept unchanged; a non-table object, a `null` element and a non-array input kept unchanged. A **mixed
catalogue**: `parseTemplates` (and `parseTemplate` on each entry) over a list holding a template saved before this
version with a table without `merges`, one with a merged table, and one with no table, accepting all three, the first
answered with `merges: []`; its preview drawn and Add template inserting its table with `merges: []` and new ids; a
list whose one template holds a table with overlapping merges still refused as today; and Save as template and the
server's `templateObjects` refusing a table without `merges` (no normalisation on writes). Fixtures at the cap: a
stored template whose objects (one table without `merges`) are exactly 262,144 bytes is listed, its detail parsed and
its preview drawn, while its Add is refused with today's message; one at 262,144 bytes minus the added bytes is listed
and added; and a stored template of 262,145 bytes is refused on reading as today.
