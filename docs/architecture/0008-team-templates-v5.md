# 0008 — Team templates contract

CONTRACT VERSION: 0008 team templates v5 (2026-11-26)

Status: Draft for 0001-W27 v1. Replaces [team templates v4](0008-team-templates-v4.md), whose text is kept here in
full with its version numbers moved on only where this version requires it. **Changes from v4, in short:** template
objects are validated inside a version **17** wrapper ([document v23](0001-document-v23.md)), so a template may hold
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
  The objects are validated inside a version **17** wrapper (v4: 16).
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

`templateBoard(objects)` in `apps/web/src/team/templates-rules.ts` validates inside a version 17 wrapper and no
longer throws for valid images, videos and link cards; every other check (an invalid object still throws, a `link`
object missing a key included), its content-size check (262,144 bytes) and its message are unchanged.
`templateObjects(value, held?)` in `apps/server/src/templates.ts` validates inside a version 17 wrapper; it refuses
media exactly as today when `held` is absent, where an object names media when `assetsOf(o).length > 0` (so a card
with a non-null `asset` is refused without `held`, and a card with `asset: null` is accepted); and it checks each
media hash against `held` (a map from hash to asset entry) when it is given, through `requireHeldMedia` (sync v18:
a card's thumbnail must be held with a picture type, else 400 `asset_missing`). A save or replace that sends
`upload` must hold at least one object that names media in the same sense (else 400 `bad_request`, as today for an
upload with no image or video).

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
