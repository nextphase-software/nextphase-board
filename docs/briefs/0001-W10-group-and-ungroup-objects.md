BRIEF VERSION: 0001-W10 v1 (2026-10-24)
# 0001-W10 — Group and ungroup objects

Status: Implemented. Independently reviewed at `54fe133` (pass) and merged into
main on 2026-10-24 with [0001 document v3](../architecture/0001-document-v3.md) and
[0001 interaction v13](../architecture/0001-interaction-v13.md). The implementation
record below, which lists the validated revisions, was written before that review.

## Outcome

Selected objects can be grouped and ungrouped from the Arrange menu and Objects.
Clicking any member of a group, or touching one with a selection box, selects the
whole group, shown with a dashed outline, so moving, resizing, styling, arranging,
duplicating and deleting act on all of it. A double-click still edits one member,
and Objects' list still selects single objects. Groups are saved in a new document
version 3; boards saved earlier open unchanged, and nothing is written until the next
Save. Each Group or Ungroup is one undo step.

## Read first and prerequisite contracts

- [Contributor guidance](../../CONTRIBUTING.md), [agent instructions](../../AGENTS.md)
  and [engineering standards](../../DESIGN.md).
- [0001 document v3](../architecture/0001-document-v3.md): the saved format (the
  `group` key and its rules, reading and upgrading versions 1 and 2, per-version
  canonical output, fresh identifiers, the adapter's group value).
- [0001 interaction v13](../architecture/0001-interaction-v13.md): the governing
  behavior (expanding the selection, double-click, the group outline, Group and
  Ungroup and their reasons, Duplicate's group rule, the menu entries, Objects'
  labels, history, opening older boards).
- [0001 interaction v12](../architecture/0001-interaction-v12.md) and, through it,
  v11, v10, v5 and v4; [0001 document v2](../architecture/0001-document-v2.md); and
  [0001 storage v1](../architecture/0001-storage-v1.md) (unchanged; it validates
  through the document contract).
- [0001 toolchain v1](../architecture/0001-toolchain-v1.md): unchanged; no new dependency.

## Deliverables and boundaries

1. `apps/web/src/document.ts`: version 3 types; `validate` accepting versions 1, 2
   and 3 as document v3 defines them; `canonical` serializing each board in the
   version it carries; an upgrade from version 1 or 2 to version 3; `empty()` and
   `add()` producing version 3 with `group` null; the adapter's atomic group value.
2. `apps/web/src/history.ts`: fresh identifiers also avoid every group ID (document
   v3), and Duplicate applies interaction v13's group rule to the copies. Every other
   behaviour, and every existing case in `tests/history.test.mjs`, stays as it is.
3. A new pure module `apps/web/src/group.ts`, in erasable TypeScript, with: Group and
   Ungroup on a board; their availability reasons in interaction v13's order;
   expanding a set of objects to whole groups and the Shift toggle; the groups whole
   in a selection; and group numbering for labels.
4. `apps/web/src/arrange.ts`: only the addition of the menu's fourth group (Group,
   Ungroup) to its command list, if the menu is driven from there.
5. `apps/web/src/App.tsx`: the version 3 board type; expanding the selection where
   interaction v13 says (presses, releases, Shift, the selection box and its live
   preview, an armed placement's click) and not elsewhere; the double-click rule;
   the group outline; Group and Ungroup in the menu and Objects; Objects' labels.
6. `apps/web/style.css`: the group outline and the menu's new group.
7. Tests: a new `tests/group.test.mjs`; added cases in `tests/document.test.mjs`,
   `tests/history.test.mjs` and `tests/storage.test.mjs`; and the existing-case
   updates listed under Validation, which only follow `add()`, `empty()` and
   `upgrade()` producing version 3 and version 3 becoming known.

New source files use `SPDX-License-Identifier: Apache-2.0`. Do not change
`storage.ts`, `geometry.ts`, `styles.ts`, `view.ts`, `commands.ts`, `selection.ts`,
`resize.ts`, storage rules, package files or the lock, and do not change any existing
test case except as listed under Validation. Importing from those modules is fine.
If a requirement seems to need another change, stop and report it.

Append the implementation record below with the branch, validated revision,
commands, results and exclusions; report the final branch tip separately.

## Numbered acceptance criteria

- 0001-W10-AC01: Create and dissolve a group with explicit membership and stable member identities.
- 0001-W10-AC02: Select and move a group coherently under declared nested-group limits.
- 0001-W10-AC03: Undo grouping and reopen saved groups without swallowing unrelated objects.

| Criterion | Evidence that shows it |
| --- | --- |
| 0001-W10-AC01 | Group gives the selected objects one new group ID and leaves every logical ID and generation unchanged; regrouping takes members from other groups and leaves those groups' other members grouped; Ungroup clears every member of each touched group, selected or not; Objects' labels show "Group N"; the reasons appear in v13's order; unit cases for each |
| 0001-W10-AC02 | Clicking one member selects the whole group with the outline; a box touching one member and Shift-click act on the whole group; moving the group moves every member and nothing else; double-click selects and edits one member; groups are one level (document v3 has no group of groups); unit cases for expansion |
| 0001-W10-AC03 | One Undo restores each Group and Ungroup exactly and Redo reapplies it; Duplicate of a whole group gives the copies a new group and of part of a group ungrouped copies; Save and reload keep groups and leave ungrouped objects ungrouped; a board saved by the previous build opens unchanged, with nothing written until Save, after which head is version 3 and previous the earlier record; unit cases for document v3, storage and history |

## Validation commands and expected evidence

From the repository root with the pinned toolchain:

```sh
npm --prefix apps/web ci --ignore-scripts --no-audit --no-fund
npm --prefix apps/web run typecheck
node --test tests/group.test.mjs tests/document.test.mjs tests/history.test.mjs tests/storage.test.mjs
npm --prefix apps/web test
npm --prefix apps/web run build
git diff --name-only main...HEAD
```

`group.test.mjs` is new; the other three cover the changed document and history
modules and storage's acceptance of version 3. The full unit suite,
`npm --prefix apps/web test`, is explicitly requested here because `document.ts` and
`history.ts` are shared by the whole application. Running anything broader needs an
explicit maintainer instruction (see [agent instructions](../../AGENTS.md)).

**Existing-case updates allowed** (only these, and no assertion removed or weakened):

- `tests/document.test.mjs`: the helpers that build older boards from `add()` and
  `empty()` also remove `group` (version 2) or `group` and the styles (version 1); the
  per-version loop covers versions 1, 2 and 3; the "unknown version" mutation uses
  version 4; the upgrade and `add()`/`empty()` cases expect version 3 with `group`
  null; the key-order assertion includes `group` for version 3 and keeps version 2's
  order for version 2.
- `tests/storage.test.mjs`: its older-board helper also removes `group`; the unknown
  version case uses version 4. Its mixed-record case keeps a version 2 head with a
  version 1 previous record.

Added unit cases:

- **`group.test.mjs`**: Group on two and several objects, including members of other
  groups (their remaining members keep their ID); Ungroup on a whole group and on one
  member of a group (every member cleared); the reasons in order, including "already
  one group"; expanding a press, Shift toggling a whole and a partly selected group,
  a box and Shift + box; the groups whole in a selection; numbering by lowest-ordered
  member, including a group of one.
- **`document.test.mjs`**: version 3 accepts `null` and valid group IDs, several
  objects sharing one and an object alone holding one; rejects a missing or extra
  key, a malformed ID, and a group ID equal to the board ID, a logical ID, an active
  generation or a retired generation; version 1 and 2 payloads round-trip byte for
  byte and upgrade to version 3 with `group` null; version 3 canonical key order; the
  adapter holds the group value.
- **`history.test.mjs`** (every existing case unchanged): a Group and an Ungroup step
  undone and redone exactly; Duplicate of a whole group (copies share a new ID) and of
  part of a group (copies `null`); fresh identifiers never equal an existing group ID.
- **`storage.test.mjs`**: a version 3 head with a version 2 previous record decodes,
  and the version 2 record's raw bytes stay exact.

One browser pass in Chrome and Safari, recorded by whoever can run those browsers,
starting from a new, unnamed board with a few stickies and text objects:

- **Grouping:** select two stickies, choose Group; click one (both selected, dashed
  outline); drag it (both move); undo; Ungroup and undo.
- **Selecting:** a box touching one member; Shift-click on the group; double-click a
  member to edit only it; Objects' labels show "Group 1".
- **Commands:** duplicate the group (copies form their own group); delete the group;
  each undone.
- **Persistence:** name the board, Save, reload; the group is kept.
- **Older boards:** a board saved by the build before this change opens unchanged,
  with its stored bytes unchanged and no Unsaved state until an edit; after Save, head
  is version 3 and previous the earlier record.

No browser matrix, fixtures sweep, accessibility audit or IME checks unless the
maintainer asks.

## Exclusions and reasons

Nested groups, entering a group, keyboard shortcuts, group names or colours, locking,
frames or sections, changing order when grouping, and new dependencies are out of
scope.

## Public references with retrieval dates

No new external reference. Document v1's and interaction v4's references (retrieved
2026-10-22) still apply.

## Implementation record

### Implementation handoff — 2026-10-24

- Brief: **0001-W10 v1** only, governed by document v3 and interaction v13.
- Branch: `codex/0001-W10-group`, based on committed main
  `d054d80c5681ad27e81a1efa6d82b9336e439d88`.
- Validated source/test revision:
  `b5fd4518d6a78bd9eccb4ca5618dde0bdfe71c4e`
  (`feat(web): group and ungroup board objects`). The later implementation-record
  commit changes this brief only; the final branch tip is reported separately in
  the handoff.
- Toolchain: Node **24.22.1**, npm **11.19.1**, with the pinned distribution
  selected through the session PATH before every Node/npm command.
- Implemented version 3 validation, per-version canonical output, in-memory
  upgrades and the adapter's atomic group value; Group/Ungroup and ordered
  availability reasons; group selection expansion, Shift toggling, live box
  selection, single-member double-click editing, dashed group outlines and
  Objects labels; fresh IDs and whole/partial-group Duplicate rules.
- Existing history cases are unchanged. Existing document/storage case updates
  are limited to the permitted version/default/helper/key-order changes; the
  mixed-record case still uses a version 2 head and version 1 previous record.

| Exact command from repository root | Result |
| --- | --- |
| `node --version` | Exit 0; `v24.22.1` |
| `npm --version` | Exit 0; `11.19.1` |
| `npm --prefix apps/web ci --ignore-scripts --no-audit --no-fund` | Exit 0; 19 packages installed. Ran before the source/test commit with the same unchanged manifest and lock |
| `npm --prefix apps/web run typecheck` | Exit 0 at the validated revision |
| `node --test tests/group.test.mjs tests/document.test.mjs tests/history.test.mjs tests/storage.test.mjs` | Exit 0 at the validated revision; 71 passed, 0 failed, 0 skipped |
| `npm --prefix apps/web test` | Exit 0 at the validated revision; 191 passed, 0 failed, 0 skipped |
| `npm --prefix apps/web run build` | Exit 0 at the validated revision; application built; accepted lock, runtime inventory and distributed notices verified |
| `git diff --check` | Exit 0 before the source/test commit |
| `git diff --name-only main...HEAD` | Exit 0 at the validated revision; the ten source/test deliverables only. The subsequent record commit adds this brief to that list |

The focused unit cases cover grouping and regrouping without identity changes,
whole and partial Ungroup, availability precedence, press/release and Shift/box
expansion, whole groups and numbering including singleton groups, exact Group and
Ungroup undo/redo with one transaction per command, Duplicate and resurrection,
forced identifier collisions, version 3 validation and adapter membership, exact
version 1/2 payloads and version 3 head/version 2 previous decoding. UI behavior
has source inspection and build evidence only, pending the browser pass.

**Exclusions:** No browsers, browser regression harness, fixture builds, browser
matrix, accessibility audit, native IME checks, performance/load tests or server
were launched. Chrome and Safari's W10 browser pass remains for the reviewer,
including pointer/focus behavior, outlines at zoom, save/reload and older-board
opening without writes or an Unsaved state. No claim of browser acceptance is made.
No new dependencies, package/lock changes, storage-rule changes, merge or push.
Only the brief's listed deliverables changed; the worktree started clean.

Graph discovery/indexing was attempted but unavailable because the tools required
approval under a policy that permits none; discovery used file reads and text
search instead. Normal Git/privacy hooks reported `PUBLIC BOUNDARY: PASS` on the
source/test commit. Git also emitted a nonfatal lock-permission diagnostic; the
commit succeeded with exit 0. No hook was bypassed. Independent review remains
pending against the exact source/test revision above.
