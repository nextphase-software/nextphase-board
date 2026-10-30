# 0001 — Board document contract

CONTRACT VERSION: 0001 document v11 (2026-10-30)

Status: Draft for 0003-W1 v1. When accepted it replaces [document v10](0001-document-v10.md)
for later work. Every rule of document v10 (and, through it, v9 back to v1) still applies. This
version adds a rule about how a document may change from one state to the next, and the rules a
server applies to the documents it stores. **The saved format does not change**: a saved
document is still version 10, and nothing a browser saves or reads locally changes.

## The before/after rule

`checkTransition(before, after)` in `packages/board-rules/src/transition.ts` takes two documents
that each pass validation and throws if the change between them is not allowed:

1. `boardId` and `schemaVersion` are the same in both.
2. Every entry of `before.retiredGenerations` is still in `after.retiredGenerations`: a
   generation, once retired, stays retired.
3. An object present in both keeps its `generation` and its `type`.
4. An object in `after` may not use, as its `id` or its `generation`, a generation retired in
   `before`.
5. A new object (an `id` not in `before`) may not reuse an `id` or a `generation` of any object
   in `before`, in either role.
6. An object of `before` whose `id` and `generation` are not both in `after` has its generation
   in `after.retiredGenerations`: removing an object retires its generation.

A normal edit (changing an object's text, position or style, adding a new object, or removing
one and retiring its generation) passes. It lives in its own module so the web app, which does
not use it in this version, builds exactly as before.

Two neighbouring states cannot show an object ID that was removed several states ago, because a
document records retired generations, not retired IDs. A server that applies a sequence of
changes therefore also keeps a record of every object ID it has seen and its generation, and
refuses a new object whose `id` or `generation` is in that record ([hosted persistence
contract](0003-hosted-persistence-v1.md), table `identifiers`). That record is server storage,
not part of the document.

## Documents a server stores

A server stores only version 10 documents; it never stores a board in an older version or
mixes versions. Every state it saves:

- passes `validate` and the 2 MiB canonical size limit of document v10;
- passes `checkTransition` against the state it replaces, and the identifier record above;
- contains no image object. Images need hosted picture storage, which a later version adds;
  until then a server refuses any change that adds one. Boards kept in a browser keep their
  images as document v10 says.

A server also refuses a Yjs change that adds anything to the shared Yjs document outside the
fields the board's Yjs mapping uses ([web modules v24](0001-web-modules-v24.md)), so a document
cannot carry hidden data that validation never sees.

## Public references

None beyond those of document v10.
