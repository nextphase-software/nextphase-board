# 0008 — Activity catalogue contract

Contract version: 1 (for 0008-W1 brief v1, 2026-10-27). Status: Draft. Depends on
[the document contract](0001-document-v7.md) and [the board file contract](0006-board-file-v1.md);
used by [interaction v21](0001-interaction-v21.md).

An **activity** is a small, ready-made set of board objects that ships with the app and can be
added to any board. The activities are written for Board by NextPhase and licensed under the
repository's licence, Apache-2.0. No content from another product is used.

## Where activities live

Each activity is one source file, `apps/web/src/activities/<id>.ts`, holding exactly one export:

```ts
// SPDX-License-Identifier: Apache-2.0
export const file = "<the activity's board file, as text>";
```

The string is the complete text of a board file (board file v1): the same bytes Save a copy to
file would download. It is kept as a TypeScript string, not a `.nextboard` file next to the code,
because both the bundler and the unit tests load TypeScript modules only. Nothing else goes in
these files.

`apps/web/src/activities/catalog.ts` lists the activities in display order. Each entry has
exactly these fields:

| Field | Value |
| --- | --- |
| `id` | The file's name without `.ts`: lowercase letters and hyphens |
| `name` | Shown on the card; equals the board's title in the file |
| `description` | One sentence, at most 80 characters |
| `author` | `"NextPhase"` |
| `license` | The SPDX identifier `"Apache-2.0"` |
| `version` | The integer `1`; raised whenever the activity's content changes |
| `file` | The `file` export of `<id>.ts` |

The `activities/` folder holds data only: no rules, no imports other than `catalog.ts` importing
the activity files.

## What an activity file must be

- It passes every reading rule of board file v1.
- Its payload's `schemaVersion` is 7, the current document version.
- It holds at least 1 and at most 40 objects, of the types the current document supports.
- Its title equals the entry's `name`.

A unit test reads every catalogue entry with the board file rules and checks each point above, so
a broken activity fails the build. The app never changes an activity's file: adding an activity
to a board copies its objects (interaction v21) and leaves the file as it was.

## Provenance

The Templates panel shows each entry's author and licence ("By NextPhase · Apache-2.0"). Objects
added to a board carry nothing extra: they are ordinary objects and the saved document is
unchanged (document v7). The activity's own board ID, object IDs, generations and retired
generations are never used on a board.

## The first catalogue

| `id` | `name` | `description` | Content |
| --- | --- | --- | --- |
| `retrospective` | Retrospective | Look back together: what went well, what to improve, actions. | A title and three sections, "Went well", "To improve" and "Actions", each holding one prompt sticky |
| `brainstorm` | Brainstorm | A topic in the middle and ideas around it. | A title, a circle "Topic" and six "Idea" stickies, each joined from the topic by a connector |
| `kanban` | Kanban | Track work from to do, through doing, to done. | A title and three sections, "To do", "Doing" and "Done", holding example stickies |

The files themselves are the source of truth for exact positions, colours and text.

## Adding an activity later

Add `<id>.ts` and a catalogue entry; the unit test above must pass. Changing an activity's
content raises its `version`. Removing or renaming an activity changes nothing on boards that
already hold a copy.
