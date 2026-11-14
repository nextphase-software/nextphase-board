BRIEF VERSION: 0009-W2 v1 (2026-11-14)
# 0009-W2 — Build and restructure mind maps

Status: Draft. Implementation has not started under this brief.

## Outcome and read first

A **Mind map** tool in the bottom toolbar places a starter map: a bold main topic with three ideas
on its right, the topic's text ready to type over. Round add buttons beside a selected node, and
⌘/Ctrl+Enter and ⌘/Ctrl+Shift+Enter, add children and siblings. The map lays itself out after every
change. Dragging a node onto another node moves it there with everything under it; dropping it on
empty board makes it a separate map; a node can never go under itself or its own descendants. A
branch can be collapsed behind a badge that counts what is hidden. Every step is one Undo, and a
saved board reopens with the same nodes, parents and layout, on local and hosted boards.

Read [AGENTS.md](../../AGENTS.md), [CONTRIBUTING.md](../../CONTRIBUTING.md),
[DESIGN.md](../../DESIGN.md) and these three new contract files (prior versions remain untouched):

| Contract | New version / ownership |
| --- | --- |
| [Document](../architecture/0001-document-v16.md) | v16: the `mindNode` type, schema 11, the structure rule, reading 1–10, version references in other contracts, the room's load upgrade and mind-node repair, the adapter |
| [Interaction](../architecture/0001-interaction-v40.md) | v40: the tool, starter map, layout, branches, selection and add buttons, adding, editing, moving and reparenting, collapse, deleting, copies, context bar, Objects, hosted, keys and words |
| [Web modules](../architecture/0001-web-modules-v38.md) | v38: five new source modules and two test files, the counts, the six App.tsx substitutions, the seams and the type rename |

Use this set wherever inherited contracts link a replaced version. Document v16 states the only
change to [storage v3](../architecture/0001-storage-v3.md), [board file v4](../architecture/0006-board-file-v4.md),
[hosted persistence v10](../architecture/0003-hosted-persistence-v10.md),
[hosted storage v11](../architecture/0003-hosted-storage-v11.md), [sync v13](../architecture/0003-sync-v13.md),
[board lifecycle v5](../architecture/0006-board-lifecycle-v5.md), [API v12](../architecture/0003-api-v12.md),
[team templates v1](../architecture/0008-team-templates-v1.md) and the
[activity catalogue v1](../architecture/0008-activity-catalogue-v1.md) (document version 11; activities
stay 7). Unchanged: [access v13](../architecture/0003-access-v13.md),
[presence v4](../architecture/0004-presence-v4.md), [identity v4](../architecture/0003-identity-v4.md),
[self-host runner v7](../architecture/0003-self-host-runner-v7.md),
[voting v2](../architecture/0007-workshop-voting-v2.md) (mind nodes are not votable),
[timer v2](../architecture/0007-workshop-timer-v2.md), [comments v4](../architecture/0005-comments-v4.md),
[toolchain v5](../architecture/0001-toolchain-v5.md), [lock v5](../architecture/0001-dependency-lock-v5.json),
[inventory v5](../architecture/0001-dependency-inventory-v5.json),
[runtime notices v3](../architecture/0001-runtime-notices-v3.txt). fileVersion 2, room layout 7, backup
envelope 1 and 17 service tables remain. Nothing new is stored outside the document.

Build directly; no prototype or scenario tool is an input. Prove the stated values with focused
tests, followed by independent checks. Report a contract conflict before dependent work.

## Deliverables and boundaries

Planning source baseline main **9f843d0**. Use a fresh milestone worktree and branch from committed
main containing this packet, recording that prerequisite base separately from the behaviour baseline.
New source files carry `SPDX-License-Identifier: Apache-2.0`. Only these files may change, plus the
append-only Implementation record below.

**New (seven).**
1. `packages/board-rules/src/objects/mind-node.ts` (web modules v38).
2. `apps/web/src/mind-map.ts`.
3. `apps/web/src/scene/mind-node-body.tsx`.
4. `apps/web/src/scene/mind-map-layer.tsx`.
5. `apps/web/src/scene/mind-map-buttons.tsx` (add buttons and collapse badges).
6. `tests/mind-map.test.mjs`. 7. `tests/server/mind-maps.test.ts` (Server checks).

**Changed: packages.**
8. `packages/board-rules/src/document.ts` (version 11, mind-node keys and structure rule, `upgrade`,
   `empty`, `add` with record defaults, `BoardV11`/`ItemV11`); 9. `packages/board-rules/src/objects/registry.ts`
   (type list, the mind-node predicate, `sectionIdea`, `eligibleIdea` and `ADD_OPTIONS` exclude mind nodes);
10. `packages/board-sync/src/codec.ts` (version 11); 11. `packages/board-sync/src/undo.ts` (`parent`
   remap and retargeting as `section`, within a step too; an add merges with its first text session); 12. `packages/board-sync/src/comments.ts` (a node's name);
13. `packages/board-room/src/edits.ts`, 14. `history.ts` (its checks at :33 and :301 accept 10 and 11;
restores 11), 15. `room.ts` (new boards 11; the load upgrade; `edit-session.ts` too, only if the upgrade's
outcome in document v16 needs it), 16. `repair.ts` (mind-node
repair on every edit, document v16).

**Changed: server.** 17. `apps/server/src/routes/boards.ts`, 18. `apps/server/src/templates.ts` (version 11).

**Changed: web** (under `apps/web/src/`). 19. `storage.ts`, 20. `board-file.ts`,
21. `team/templates-rules.ts` (version 11); 22. `history.ts` (delete moves children up; duplicate
remap); 23. `clipboard.ts` (the consistent snapshot of interaction v40); 24. `sections.ts` (never
captures or carries mind nodes; whole-map moves; the `mind map node` label prefix); 25. `group.ts`,
26. `arrange.ts` (refusals and reasons); 27. `gesture.ts` (drag target); 28. `icons.tsx` (Mind map,
Collapse and Expand icons);
29. `state/use-editing-commands.ts`, 30. `state/use-canvas-input.ts`, 31. `state/use-geometry-edits.ts`,
32. `state/use-object-layouts.ts`, 33. `state/use-page-keys.ts`, 34. `state/use-board-document.ts`
(text-session ending lays out; add plus first session one step), 35. `state/use-editor-placement.ts`,
36. `state/use-command-reasons.ts` (only if a reason must name mind nodes); 37. `scene/board-drawing.tsx`,
38. `scene/inline-editor.tsx` (the node editor); 39. `ui/context-bar.tsx`, 40. `ui/content-field.tsx`,
41. `ui/objects-panel.tsx`; 42. `App.tsx` (only the six substitutions of web modules v38);
43. `apps/web/style.css` (button, badge, tooltip and node editor classes).

**Changed: tests and test configuration.** 44. `tests/modules.test.mjs` (counts and App test of web
modules v38); 45. `tests/objects.test.mjs` (type list, predicates); 46. `vitest.node.config.ts` and
47. `vitest.workerd.config.ts` (include `tests/server/mind-maps.test.ts` only); 48. `tests/README.md`
(the new files); and the version and rename-only test edits in **Shared-path check dispositions**.
New tests import the new modules dynamically inside their named checks, never at top level, so on the
9f843d0 baseline each new check fails by name (V10).

**Rename-only files.** Any other file whose diff only replaces `BoardV10`/`ItemV10` with
`BoardV11`/`ItemV11` (and a `schemaVersion` literal type 10 → 11). V8 inspects every hunk.

Not allowed: a dependency, font, service, import exception, new state hook, new screen part, room
layout or service-table change.

Outside the named new controls, the existing screens' markup stays exactly as at the base: the reviewer's A–J comparison allows only the masks listed under validation.

## Required behavior and concrete design

Implement document v16, interaction v40 and web modules v38 in full. In particular:

- **Schema.** The mind-node keys, values and order; the structure rule (missing, self, non-node
  parent; loops; side only and always on first-level nodes; roots never collapsed); 1–10 read and
  upgraded in memory; new boards 11; "newer" above 11; the 9f843d0 app shows an 11 board as newer.
- **Layout.** The six steps of interaction v40 with the app's own text measurement: 320 wrap, 8/6
  insets, rounded up; 72 px columns from the widest box; 32 px block gaps; parents centred; root
  fixed; ranks rewritten; integers. The whole map in the same transaction as each change; laying
  out twice changes nothing. During text editing only the edited box grows; layout on finish.
- **Look.** Root 24 bold, others 18 regular, `system-ui`, 1.45, node colour, no fill; branches
  `#6b6b6b` 3.5 round under nodes; outline 2 px `#518de0`; add buttons 22 px white, 1.5 px
  `#518de0`, 10 px plus, at 20 px (28 more past a badge, 20 below for sibling), 28 × 28 hits,
  tooltips 18 px below; button and badge hover, pressed and focus looks, names and tab order as v40;
  frame 1 px `#8fbdf5` at 16 px; badge 20 px, 1.5 px `#6b6b6b`, 11 px 600 `#3b3a40` at 16 px,
  `99+`; drag 60 %, 3 px `#518de0` target outline 1.5 px outside with radius 2, 2 px dashed `6 4`
  round-capped preview; placeholder `#79737f`; the node editor as v40.
- **Actions.** Starter map; add child and sibling (buttons and keys, collapsed parent expands);
  reparent, detach, root move and join, multi-selection whole-map move, Escape cancels; the cycle
  rule; collapse and expand (bar and badge); delete moves children up (root: separate maps);
  copy remap; exclusions (group, section, connectors, voting, resize, Arrange); words exactly as v40.
- **Hosted.** One transaction and one shared Undo step per change; the room's load upgrade and repair;
  history snapshots 10 and 11.

## Shared-path check dispositions

This inventory authorizes expectation changes, not additional historical runs.

| Shared path / older checks | Disposition |
| --- | --- |
| Document version in units: `document.test.mjs` (the `[1..10]` loop, the invalid version at :42 becomes 12, :116, :131, :134, :245, :292, :374), `shapes.test.mjs:39`, `connectors.test.mjs:36`, `strokes.test.mjs:31, :95`, `images.test.mjs:26, :55`, `connector-styles.test.mjs:44, :83, :477, :538`, `storage.test.mjs:91, :115, :131`, `board-file.test.mjs:42, :55, :78, :138`, `board-catalog.test.mjs:235, :322`, `team-import.test.mjs:64`, `team-templates.test.mjs:48` | 10 → 11 and the "newer" probe 11 → 12; every other assertion stays |
| Version 10 boards handed to Room or Adapter: `mentions.test.mjs:175`, `board-history.test.mjs:143`, `board-lifecycle.test.mjs:86`, `workshop-voting.test.mjs:18`, `workshop-reactions.test.mjs:18`, `workshop-spotlight.test.mjs:18, :91` | 10 → 11 (or kept at 10 where the test is about the load upgrade); results unchanged |
| Server suites: `tests/server/history.test.ts:44, :55, :140`, `lifecycle.test.ts:56, :166` | 10 → 11; a check about stored history may keep a version 10 snapshot to prove it still restores; assertions otherwise unchanged. `shared.test.ts:910` and `transition.test.mjs:20` unchanged |
| Module inventory: `tests/modules.test.mjs` | 14 package files, 9 object types, 13 scene parts, 27 screen parts, 22 state hooks, effect counts unchanged; the App test as web modules v38 |
| Object registry: `tests/objects.test.mjs` | The type list gains `mindNode`; `eligibleIdea` and `sectionIdea` exclude it; `ADD_OPTIONS` leaves it out, so the Add labels at :155 stay unchanged |
| Voting: `workshop-voting.test.mjs:56`, `server/voting.test.ts:52` | Unchanged (mind nodes not votable) |
| Every-type loop: `shared-editing.test.mjs:74` | Unchanged expectations; the mind node's defaults make `add()` produce a valid root, so the loop passes with the new type included |
| Activities and Templates: `activities.test.mjs`, 0008-W1 Q | Activities stay version 7 and insert unchanged onto an 11 board |
| Local shell: A–J | Unchanged apart from the palette, whose buttons all shift because it is centred: the whole palette region is the one declared mask |

## Server checks

New `tests/server/mind-maps.test.ts`, run on both runners by the existing suites:

| ID | Check |
| --- | --- |
| S402 | A room whose stored state holds a version 10 board (seeded into the room's storage directly, as the existing history and lifecycle server tests seed stored state) serves it as version 11 with the same objects; a reload with no edit serves version 11 again; the upgrade adds no edits row and no history version; an edit adding a starter map (four mind nodes) is accepted, and a reload serves version 11 with the map |
| S403 | An edit whose result has a mind-node loop, a missing parent, a first-level node without a side or a collapsed root is accepted **repaired** exactly as document v16 orders (smallest id in a loop becomes a root; no node moves), and an edit still invalid after the repair (for example a 201-code-point node) is refused and changes nothing |
| S404 | Two clients concurrently make A a child of B and B a child of A: after the merge the room's document is valid, the node with the smaller id is a root, and both clients converge |
| S405 | A stored version 10 history snapshot restores as a version 11 board; a version 11 snapshot with mind nodes restores them with their parents |
| S406 | The board import route accepts a version 11 board holding a map and refuses one holding a loop |

## Browser checks

New scenario **M9-S1–M9-S26**. M9 was unused in existing public briefs when allocated. A fresh
independent check run writes its tool from these clauses and the contract values; each row prints its
full ID, `PASS:`/`FAIL:` and a summary, retaining raw receipts and unrun rows. Local board unless a
row says hosted: a new local board named "Planning map" with one sticky "Launch in March" at the
top left. The **grown map** used from M9-S8 on is built through the UI from a starter map: root
"Launch plan"; right: "Goals" [ "Grow sign-ups", "Keep costs flat" ], "Risks" [ "Late design
sign-off", "Server limits" [ "Load tests" ] ], "Owners"; left: "Questions" [ "Which regions first?",
"Do we need a beta?" ]. Rows that change it restore it (Undo) before the next row unless they say
otherwise. 1280 × 800, scale 1, 100% zoom, unless stated. Use real pointer and key events, never
painted DOM. New capability rows also fail by name on independent baseline 9f843d0. Derived
positions ±0.5 CSS px (layout from the saved widths and heights by the v40 steps); colours and sizes
exactly as interaction v40. Save a real-state image for M9-S1, S2, S4, S5, S6, S8, S11, S13, S16 and
S18 at 1280 × 800 and M9-S23 at 375 × 812. Node texts, map shapes and positions in the mock-up's
PNGs are sample data; every look is a value.

| ID | Scriptable behavior and expected result |
| --- | --- |
| M9-S1 | The palette shows "Mind map tool" directly after "Section tool" (tooltip "Mind map"); pressing it sets `aria-pressed`. Capture tool |
| M9-S2 | A click on empty canvas places the starter map: four mind nodes saved with root `parent` null, three children with `side` "right" and ranks 0–2, the root's box centred on the click; heights 47 and 39, children 72 px right of the root, 71 px apart; the root is in the editor with all text selected, the frame shows, the tool is Select. One Undo removes all four. Capture placed |
| M9-S3 | With the tool armed, Enter on the focused canvas places the starter map centred on the view centre |
| M9-S4 | Select the root: 2 px outline, add buttons 20 px outside both edges, frame 16 px out, no handles or connection dots; bar items exactly `Mind map node`, Edit text, `10 / 200`, colour, Duplicate, Delete, 48 px above. Hover shows "Add child ⌘↩". Capture root-selected |
| M9-S5 | Select "Second idea": add child 20 px right, add sibling 20 px below, "Add sibling ⌘⇧↩" on hover; no Collapse. Capture child-selected |
| M9-S6 | Its add child button adds an empty node in the editor with "Add text" in `#79737f`; the map is laid out; typing "Child" then Escape; one Undo removes the node and its text. Capture new-child |
| M9-S7 | ⌘/Ctrl+Enter and ⌘/Ctrl+Shift+Enter work while selected and while editing; on the root ⌘⇧↩ does nothing and ⌘↩ adds on the side with fewer first-level nodes |
| M9-S8 | Build through the UI the mock-up's "grown" map (both sides, three levels): every saved position equals the v40 layout of the saved boxes; a further no-op layout (select and Escape) writes nothing. Capture grown |
| M9-S9 | A 60-character node wraps within 320 px; a 201st code point puts the node in the existing over-limit state (marked invalid, Save refused until corrected); pasting `a\nb` gives `a b`; an empty node keeps its placeholder after editing |
| M9-S10 | Canvas pixels at three branch mid-curves read `#6b6b6b` (±8 per channel); branches are not hit by clicks |
| M9-S11 | Drag "Server limits" (with "Load tests") over "Goals": 60 % branch, target outline and dashed preview (capture reparent-drag); release: `parent` is Goals' id, last rank, "Load tests" still its child, status `Moved “Server limits” under “Goals”.`, re-laid out (capture reparented); one Undo restores the previous parents and positions |
| M9-S12 | Drag "Risks" over its own child: no outline or preview; release there detaches Risks as a separate map; one Undo puts it back. A board file holding a loop is refused on open with the existing invalid-file message |
| M9-S13 | Drag "Questions" to empty canvas: a separate map in root look, centred at the release, children on the right, status `“Questions” is now a separate map.`; select its root to see frame and both buttons. Capture detached |
| M9-S14 | Dragging a root moves its whole map; releasing it on a node of another map joins it there as the last child |
| M9-S15 | Box-select two nodes of two maps plus the sticky and drag: both maps and the sticky move, no parent changes |
| M9-S16 | On "Risks" (three descendants) the bar shows Collapse (capture branch-selected); Collapse: descendants hidden, badge `3`, the map closes up, the bar shows Expand, add child 28 px further out, status `Collapsed “Risks”: 3 hidden.`; hidden nodes are not in Select All or Objects. Capture collapsed |
| M9-S17 | Clicking the badge expands; adding a child to a collapsed node expands it; dropping onto a collapsed node expands it; each one Undo step |
| M9-S18 | Delete "Risks": its two children take its place under the root in order, re-laid out (capture deleted-promote); one Undo restores Risks and its children. Delete a root: each first-level node becomes a separate map centred where it was |
| M9-S19 | Copy "Server limits" and "Load tests" and paste: the copy keeps Load tests under the new Server limits, which is a root; Duplicate of a lone child gives a separate one-node map |
| M9-S20 | Exclusions: with a node and the sticky selected, the Objects panel's Group control is unavailable with `Mind map nodes can't be grouped.`; no connection dots on nodes and a connector dragged from the sticky cannot end on one; no Arrange in the bar for a node; a map dragged over a section (added for this row) is never captured; no resize handles |
| M9-S21 | Save, reload: identical saved nodes, parents, sides, ranks, collapse states and positions; Save a copy to file and open it: identical; opening that file in the 9f843d0 app (served separately) shows the existing "made by a newer version" refusal and changes nothing |
| M9-S22 | A board file saved by the 9f843d0 app (document version 10, one sticky) opens unchanged in the candidate and saves as version 11 at the next Save |
| M9-S23 | 375 × 812: no context bar, add buttons shown for a selected node. Capture narrow |
| M9-S24 | Hosted (team stack, ana on "Team test board"): the starter map appears for ben with the same positions; ana's reparent reaches ben; ana's one Undo reverts it for both; a reload keeps it |
| M9-S25 | Every status message of v40, and the node Delete message, appears word for word in the polite notice on a local board; on a hosted board none is shown (as Delete's message at 9f843d0) |
| M9-S26 | Enter edits a node, Escape ends it; Escape during a node drag cancels it with no change |

## Acceptance criteria

- **0009-W2-AC01:** On local and hosted boards, the Mind map tool places the starter map (root and
  three children) and the add buttons and ⌘Return / ⌘⇧Return add children and siblings, each a
  `mindNode` with its own id, its `parent` set to the parent's id (null for a root), `side` on the
  root's children and a sibling `rank`; branches are drawn from the parents. The schema 11 rules
  refuse a missing, self or non-mind-node parent, a loop, and a first-level node without a side.
  Look and placement match the approved design.
- **0009-W2-AC02:** Dropping a node on another node makes it that node's last child with its whole
  branch; dropping it on empty board makes it a separate map; dragging a root moves its map or joins
  it to a node of another map. A node is never placed under itself or a descendant (not offered while
  dragging, refused by the document rules and repaired by the hosted room). Collapse and Expand on a
  non-root node with children hide and show its descendants with the counting badge; collapse is
  saved; adding to or dropping on a collapsed node expands it. Deleting a node moves its children up.
- **0009-W2-AC03:** Every add, text change, move, reparent, detach, delete, collapse and expand lays
  out the map by the interaction v40 rules in the same edit and is one Undo (Redo restores it).
  Saving and reopening (local save, board file, hosted reload) gives the same nodes, parents, sides,
  ranks, collapse states and positions; laying out the reopened map again changes nothing. Boards from
  schema 1–10 open and save as 11; the 9f843d0 app shows an 11 board as made by a newer version and
  changes nothing.

| Criterion | Evidence that shows it |
| --- | --- |
| 0009-W2-AC01 | M9-S1–M9-S7; M9-S9–M9-S10; M9-S23–M9-S25; S403; S406; V4; V9 |
| 0009-W2-AC02 | M9-S11–M9-S20; S403–S404; V4; V9 |
| 0009-W2-AC03 | M9-S2; M9-S6; M9-S8; M9-S11; M9-S18; M9-S21–M9-S22; M9-S24; S402; S405; V4; V9; V11 |

## Applicable DESIGN.md guardrails

Canvas-first shell, native controls and visible focus, minimum action hits, protected native editing
and independent state owners apply. Interaction v40 states every new look, word and key; never infer
generic styling. No new sound or font. Preserve the complete selection chrome of every other type.

## Validation commands and expected evidence

Use pinned Node 26.13.0 and npm 11.20.0 from the repository root. Source validation is not
independent acceptance. Each check run restates **every V row it reruns** as its own
`PASS: Vn ...` / `FAIL: Vn ...` line with SHA, logs and counts.

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm run typecheck
npm test
BOARD_TEAM_FEATURES=off BOARD_SUPABASE_URL=http://127.0.0.1:55321 BOARD_SUPABASE_ANON_KEY=synthetic BOARD_SERVER_URL=http://127.0.0.1:8796 npm run build
npm run audit:licenses
npm run build:fixtures
BOARD_TEAM_FEATURES=on BOARD_SUPABASE_URL=http://127.0.0.1:55321 BOARD_SUPABASE_ANON_KEY=synthetic BOARD_SERVER_URL=http://127.0.0.1:8796 npm run build
npm run audit:licenses
npm run build:server
npm run audit:licenses
WRANGLER_SEND_METRICS=false npx wrangler deploy --dry-run --outdir <scratch> -c apps/server/wrangler.json
git diff --name-status <prerequisite-base>..<validated-source>
git diff --check <prerequisite-base>..<validated-source>
```

After the build and before browser check 1, one fresh server-only run clean-clones the candidate,
installs, creates a uniquely owned local Supabase project from committed config, installs the schema
and runs Node then workerd (`node tests/server/make-signing-key.mjs`, `npx supabase start`,
`node tests/server/write-stack-info.mjs`, `npm run test:server:node`, `npm run test:server:workerd`,
`npx supabase stop --no-backup`). No browsers there. Record each long suite's start and end and the
host's sleep and wake events; a suite that overlapped a sleep is INVALID and rerun awake. Three
Safari checks from this milestone are chosen only at Review.

Independent scenario interface (tool written by the later check run):

```sh
node tools/browser-compare/0009-w2-check.mjs <served-origin> <M9-output> [<local-stack-private-json>]
node tools/browser-compare/0009-w2-check.mjs <baseline-origin> <M9-base-output> --negative
```

| Check | Command/inspection and pass condition |
| --- | --- |
| V1 | Byte-compare manifests, locks, dependency inventory and runtime notices against the prerequisite base: unchanged, no new dependency |
| V2 | `npm ci --ignore-scripts --no-audit --no-fund` exits 0 on the clean candidate and on the independent baseline |
| V3 | `npm run typecheck` exits 0 across all five workspace members |
| V4 | `npm test` full suite exits 0; `tests/mind-map.test.mjs` proves the record and keys, the structure rule (each refusal), reading 1–10 and upgrade, the layout steps on fixed measurements (box, wrap, columns both sides, blocks, centring, rounding, idempotence), starter map, add child and sibling ranks, reparent and detach, the cycle refusal, collapse and hidden counts, delete moving children up (and root split), the copy remap, the codec and adapter round trip of the four keys, shared Undo's `parent` remap, and the room repair cases of document v16. Guards as web modules v38 |
| V5 | Team-off `npm run build` and `npm run audit:licenses` exit 0; notices equal runtime notices v3 |
| V6 | `npm run build:fixtures`, team-on `npm run build` and `audit:licenses` exit 0 |
| V7 | `npm run build:server`, `audit:licenses` and the wrangler dry run exit 0; no deploy |
| V8 | Inspect all hunks plus `git diff --name-status` and `git diff --check` over `<prerequisite-base>..<validated-source>`: only the deliverables, the dispositions above, rename-only files (every hunk only the rename) and the append-only Implementation record |
| V9 | M9-S1–M9-S26 pass with the state captures and raw receipts |
| V10 | Once, on an independent 9f843d0 source and build with the candidate's `tests/mind-map.test.mjs`, `tests/server/mind-maps.test.ts` and the two config include lines copied in, the new unit, server and browser capability checks fail by name; a top-level setup or import abort does not count |
| V11 | Full `npm run test:server:node` then `npm run test:server:workerd`: S1–S50 and S55–S406, with the existing workerd physical exclusions S37, S43, S70 and S168 and the Node-only S344 physical subcase as before. No new failures; no unrun case called passed |
| V12 | Accepted A–J compare: baseline twice, then candidate and diffs; existing normalization plus the one declared mask over the whole palette region |
| V13 | Accepted regression: scenarios O, N, M, K, L, P and Q and the fixture pages on the candidate and on 9f843d0, with only their document version expectations moved to 11; every functional assertion kept and every failure classified against 9f843d0 |

A regression failure that also fails on 9f843d0 is a baseline finding to report, never fixed here.

## Review focus and public references

Review the structure rule and its single home in `document.ts`; the room's load upgrade, history
reading and repair (smallest id breaks a loop; no node moved); that every literal 10 site moved and
nothing else changed version; the layout's determinism and idempotence (measurement only through the
callback); that each action commits its layout in the same transaction and Undo step (local and
shared); reparent, detach and the cycle rule in the drag; delete moving children up; the `parent`
remap in copy, duplicate and shared Undo; hidden nodes absent from hits, selection, Select All and
Objects and carried by copies of a collapsed node; the exclusions and their reasons; and App.tsx
changed only by its six substitutions. Unresolved after the final read, for review to watch: the
hosted load upgrade's mechanism is left to the implementer within document v16's stated outcome
(S402 proves it on both runners); comment pins on hidden nodes still draw (stated limit). Public source basis is main 9f843d0
and the linked versioned contracts, read 2026-11-14; no outside product is needed to implement this
contract. No unresolved product decision is delegated to implementation.

## Exclusions and reasons

- Sticky or shape nodes, per-node text size, alignment or formatting, and line style or colour:
  later diagram work.
- Automatic layout of non-mind-map content, other map shapes (tree down, radial) and manual node
  placement.
- Connectors to or from nodes, grouping nodes, nodes in sections, voting on nodes.
- AI generation of nodes, outline import or export, keyboard navigation between nodes.
- Live re-layout of collaborators' concurrent changes beyond the repair (the last layout stands).
- Repairs to separately tracked baseline failures.

## Implementation record

(Appended by the implementer.)

### Build (implement 1)

Branch: `claude/0009-W2-build-and-restructure-mind-maps`. Prerequisite base (this
brief and its three contracts): `cf64aea9b30c7efd838537c2d76ba81665481acd`.
Behaviour baseline: `9f843d0babc6645d7c40fca432b483ecf6bf9bfd`. Validated
source/test revision: `0cedeb07c3d121c6ae5e0bf0212cd3b80b2de72c`
(`feat(mindmaps): build and restructure mind maps`). This record is appended in a
separate commit; its tip is reported in the handoff.

Validation used Node 26.13.0 and npm 11.20.0 on the clean source commit above,
with `BOARD_SUPABASE_URL=http://127.0.0.1:55321 BOARD_SUPABASE_ANON_KEY=synthetic
BOARD_SERVER_URL=http://127.0.0.1:8796` for both web builds:

| Check | Command / inspection | Result |
| --- | --- | --- |
| V1 | `git diff --quiet cf64aea..0cedeb0` over every `package.json`, `package-lock.json`, the dependency lock v5, inventory v5 and runtime notices v3 | PASS: unchanged; no dependency added |
| V2 | `npm ci --ignore-scripts --no-audit --no-fund` | PASS: exit 0 on the candidate (the independent baseline install belongs to the check run) |
| V3 | `npm run typecheck` | PASS: exit 0, all five workspace members |
| V4 | `npm test` | PASS: exit 0, 1,147/1,147 (1,130 existing plus MM-U1–MM-U17 in `tests/mind-map.test.mjs`); no failures, cancellations or skips. Module guards: 14 rules files, 9 object types, 13 scene parts, 27 screen parts, 22 state hooks, effect counts unchanged, App equal to 9f843d0's App with the six substitutions |
| V5 | `BOARD_TEAM_FEATURES=off npm run build`; `npm run audit:licenses` | PASS: exit 0 / exit 0; lock, runtime inventory and distributed notices verified |
| V6 | `npm run build:fixtures`; `BOARD_TEAM_FEATURES=on npm run build`; `npm run audit:licenses` | PASS: exit 0 each |
| V7 | `npm run build:server`; `npm run audit:licenses`; `WRANGLER_SEND_METRICS=false npx wrangler deploy --dry-run --outdir <scratch> -c apps/server/wrangler.json` | PASS: exit 0 each; dry run only, no deploy |
| V8 | Every hunk; `git diff --name-status cf64aea..0cedeb0` (98 files: 7 added, 91 modified); `git diff --check` over that range | PASS: no whitespace errors. Changed files are the brief's deliverables, the listed shared-path dispositions (only the named lines; history/lifecycle server tests also carry the import rename) and rename-only files, each checked mechanically: reversing `BoardV11`/`ItemV11` reproduces the base byte for byte |

**Unrun:** V9 (M9-S1–M9-S26), V10, V11 (both server suites, including the new
S402–S406 in `tests/server/mind-maps.test.ts`, which was only syntax-checked),
V12 (A–J) and V13 (O, N, M, K, L, P, Q and fixture pages), browser rendering and
focus, Safari, native IME and the Supabase CLI. These belong to the later
server-only and check runs; none was started here.

**Interpretations within the contracts** (for review):
- Hosted load upgrade: on load, a stored version 10 board has its board map's
  `schemaVersion` set to 11 in the room's document, and a snapshot is written at the
  current revision (no edits row, receipt or revision change). Automatic history
  capture treats a board without mind nodes whose version 10 serialization equals
  the last capture as unchanged, so the upgrade alone captures no version.
  `edit-session.ts` needed no change.
- History restore: the selected document is upgraded before its restore intent is
  prepared and before the snapshot and live board are written; previews return the
  stored document as stored.
- One step for an add and its first text session: locally, the add's commit records
  a step that the node's first text session replaces, starting from the board before
  the add; on hosted boards the add carries a fresh group that the session reuses, and
  shared Undo starts a group on an add-only step that adds a mind node (an add of any
  other type still ends a group, as the existing grouped-edit checks require).
- A dragged root moves its map with the map frame shown; a dragged non-root node shows
  no frame and no selection outline.
- A lone collapsed non-root node copied, cut into the clipboard or duplicated becomes a
  root, so it is expanded (a root is never collapsed); it stays collapsed when its
  parent is copied with it.
- Add buttons, badges, tooltips, the frame margin, the drop outline and the dashed
  preview keep their stated screen sizes at every zoom (like the connection dots);
  branch width 3.5 scales with the board like connector lines.
- The `mindNode` record's `fill` and `edge` return nothing, as the text record's do.
- In the Objects panel a selection holding a mind node shows no position or size
  fields; Arrange stays, unavailable with the stated reasons.
- Enter or Escape in the canvas node editor returns focus to the canvas so the node
  keys keep working; the node's field is labelled Content with the "Add text"
  placeholder.

No escalation. Mandatory hooks ran (public boundary passed); no hook was bypassed,
no stash was used, and nothing was pushed, merged, published or deployed. The
unrelated 0007-W2 evidence path was not read or changed.

### Fix round 1 (server)

Branch: `claude/0009-W2-build-and-restructure-mind-maps`. Fix base: record tip
`33b89d63352b18cb7cfe90f4ffe4a5ff35105367` (validated source `0cedeb0`).
Validated source/test revision for this round:
`3adc3ece00ea095bf3bc3cabee60740b989c1c1d`
(`test(mindmaps): seed S405 history metadata and size imports at version 11`).
This section is appended in a separate record commit.

The independent server-only run on the preceding candidate reported three Node
failures (its workerd suite was invalid because the host slept):

- **S405** answered `restore_pending` (503) on its first restore. Root cause: the
  test fixture, not the product. The seed inserted a stored version with ordinal
  max + 1 without raising the room's `history_ordinal`. A restore's first capture
  (`before_restore`) takes ordinal `history_ordinal + 1`, and `versions.ordinal` is
  `UNIQUE`, so that insert failed inside `resume` and the restore stayed pending.
  Every real stored version is written by the room's capture, which raises
  `history_ordinal` in the same transaction, so the product cannot reach this
  state. Evidence: on a local stack the unchanged seed reproduces the 503, and the
  corrected seed passes. A direct SQLite probe of the committed schema refuses a
  second row at that ordinal (`UNIQUE constraint failed: versions.ordinal`). The
  seed now sets `history_ordinal`, `history_revision`, `history_capture_sha256` and
  `history_capture_bytes` as a real capture of that version would. No product code
  changed.
- **S135 and S140** received `invalid_document` because `tests/import-fixture.mjs`
  `sizedBoard()` defaulted to document version 10, which the import route no longer
  accepts. Planner-approved disposition amendment (a version-literal file the
  dispositions above missed): only that default moves from 10 to 11. Its other
  callers keep their results: the team-import units (including the explicit
  version 8 case) pass in `npm test`, and S135/S140 pass on both runners.

| Check | Command / inspection | Result |
| --- | --- | --- |
| V3 | `npm run typecheck` | PASS: exit 0, all five workspace members |
| V4 | `npm test` | PASS: exit 0, 1,147/1,147 |
| Filtered Node | `npx vitest run -c vitest.node.config.ts -t <id>` for S135, S140, S402, S403, S404, S405, S406, each separately | PASS: 7/7, exit 0 each |
| Filtered workerd | `npx vitest run -c vitest.workerd.config.ts -t "S40[2-6] "` and `-t "S13[5] import\|S140 editor"` | PASS: 5/5 and 2/2, exit 0 |

The stack was a uniquely named local Supabase project in a scratch clone of the
fix commit. It was started from the committed config with only `project_id`
changed, the committed schema was installed, and the stack was stopped with
`--no-backup`. Container and volume listings matched before and after; the
clone, including its signing key, was removed. No host sleep fell inside the run
window. The full server suites, V1, V2, V5–V7 and V9–V13 were not rerun here; the
next independent check run owns them. No new escalation. No hook was bypassed, no
stash was used, and nothing was pushed, merged, published or deployed.
