# 0008 — Team templates contract

CONTRACT VERSION: 0008 team templates v3 (2026-11-25)

Status: Draft for 0012-W6 v1. Replaces [team templates v2](0008-team-templates-v2.md), whose storage, rights,
limits, server checks, wrapper (document v18: stored objects carry no `page`), panel rules, saving with nothing
selected and inserting remain word for word except as below. A team template may now hold **images and videos**.

## What a template holds

- Its objects (unchanged limits: 1–250 objects, at most 262,144 bytes of content, 25 templates a workspace), which
  may now include `image` and `video` objects ([document v21](0001-document-v21.md)).
- When any object is an image or a video, a **template store** ([hosted storage v15](0003-hosted-storage-v15.md))
  holding every picture, first frame and video they name, **at most 20,971,520 bytes in all**. The template row names
  it (`store`). A template without media has no store.

## Saving and replacing

1. The web app collects the media hashes of what is being saved (Save as template, or Replace with selection),
   asks the board for their sizes once when the dialog opens (API v15 `asset-sizes`) and shows the picture line
   ([interaction v51](0001-interaction-v51.md)). Over 20,971,520 bytes, nothing is sent.
2. On Save: open a template upload with the asset list; for each file in media order, download it from the board
   (the existing picture `download` or `downloadVideo`) and upload it to the template upload; then save (or replace)
   with `upload` set. Any failure ends the save with its reason and saves nothing; the staged store idles out.
3. The server commits the store (one use), checks the objects against its inventory, writes the row, and erases the
   store on a certain refusal, or the replaced store after a replace (API v15). A replace with a media-free selection
   sends no `upload`; the row's `store` becomes null and its old store is erased.

`templateBoard(objects)` in `apps/web/src/team/templates-rules.ts` no longer throws for valid images and videos; every
other check (an invalid object still throws), its content-size check (262,144 bytes) and its message are unchanged. `templateObjects(value, held?)` in
`apps/server/src/templates.ts` refuses media exactly as today when `held` is absent, and checks each media hash
against `held` (a map from hash to asset entry) when it is given.

## Adding

Add template on a team board: read the template's fresh detail as today; when it holds no image and no video, add it
exactly as today. When it holds media: close the panel (`commands.closeTemplates()`), then, in the board-lifetime
runner (`templateAdds(hosted)`, web modules v49), using that detail's `media` list: check
that every media hash of its objects is in `media` with its kind; for each media file in order download it from the
template (`readTemplateAsset`) and upload it to the board (`upload` or `uploadVideo`); only when every file answered
`ok`, insert the objects through today's `insertStored` → `copyObjects` → commit, unchanged. A template without media
is added exactly as today. Each file
keeps its hash, so the inserted objects name files the board now holds and the room's `asset_missing` check passes.

## Preview and panel

The template preview keeps drawing images and videos as outlined boxes, as today. The panel, its cards, menus and
counts are unchanged; while an add runs, the cards' Add buttons are disabled (interaction v51).

## Deleting

Deleting a template erases its store. Boards that received its pictures keep their own copies.
