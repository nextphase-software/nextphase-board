BRIEF VERSION: 0008-W2 v1 (2026-11-14)
# 0008-W2 — Save and reuse team activities

Status: Draft. Implementation has not started under this brief.

## Outcome and read first

A workspace's owners and editors can save the objects they selected on one of its hosted boards
(or the whole board, when nothing is selected) as a team template with a name and an optional
description. Every owner, editor and viewer of that workspace sees its templates in the Templates
panel, above Board's own activities, with who saved it and from which board. Add template inserts an
independent copy exactly as an activity is inserted. The template's creator and the workspace owner
can edit its details, replace its content or delete it; nothing they do changes boards that already
used it. Someone whose workspace role is removed or lowered loses those rights on their next request.

Read [AGENTS.md](../../AGENTS.md), [CONTRIBUTING.md](../../CONTRIBUTING.md),
[DESIGN.md](../../DESIGN.md) and these five new contract files (prior versions remain untouched):

| Contract | New version / ownership |
| --- | --- |
| [Team templates](../architecture/0008-team-templates-v1.md) | v1: the stored record, objects and validation, rights, limits, database functions, client rules |
| [API](../architecture/0003-api-v12.md) | v12: the five template routes, bodies, responses and refusals |
| [Access](../architecture/0003-access-v13.md) | v13: template rights per current workspace role; 17 service tables |
| [Interaction](../architecture/0001-interaction-v39.md) | v39: the team group, card menu, dialogs, words, notices, keys |
| [Web modules](../architecture/0001-web-modules-v37.md) | v37: three team modules and the panel, palette, editing-commands and server seams |

Use this set wherever inherited contracts link a replaced version. Unchanged:
[activity catalogue v1](../architecture/0008-activity-catalogue-v1.md) (its insertion rules are
reused as they stand),
[hosted storage v11](../architecture/0003-hosted-storage-v11.md),
[hosted persistence v10](../architecture/0003-hosted-persistence-v10.md) (except its service-table
count, now 17 per access v13),
[sync v13](../architecture/0003-sync-v13.md),
[presence v4](../architecture/0004-presence-v4.md),
[self-host runner v7](../architecture/0003-self-host-runner-v7.md),
[identity v4](../architecture/0003-identity-v4.md),
[voting v2](../architecture/0007-workshop-voting-v2.md),
[timer v2](../architecture/0007-workshop-timer-v2.md),
[board lifecycle v5](../architecture/0006-board-lifecycle-v5.md),
[document v15](../architecture/0001-document-v15.md),
[board file v4](../architecture/0006-board-file-v4.md),
[comments v4](../architecture/0005-comments-v4.md),
[local storage v3](../architecture/0001-storage-v3.md),
[toolchain v5](../architecture/0001-toolchain-v5.md),
[lock v5](../architecture/0001-dependency-lock-v5.json),
[inventory v5](../architecture/0001-dependency-inventory-v5.json),
[runtime notices v3](../architecture/0001-runtime-notices-v3.txt).
Document 10, fileVersion 2, room layout 7 and backup envelope 1 remain. The Supabase schema gains
one table and six functions; nothing else is stored. Templates add nothing to Yjs, revision,
edited-at, Undo/Redo (except the existing one step for Add template), history, file, export, backup,
room storage or browser disk.

Build directly; no prototype or scenario tool is an input. The build proves the stated values with
focused tests, followed by independent checks. Report a contract conflict before dependent work.

## Deliverables and boundaries

Planning source baseline main **2bbcc41**. Use a fresh milestone worktree and branch from committed
main containing this packet, recording that prerequisite base separately from the behaviour
baseline. New source files carry SPDX-License-Identifier: Apache-2.0. Only these files may change,
solely for this milestone and the named shared-path dispositions:

1. **Schema:** `apps/server/supabase/nextphase_board.sql` (the `templates` table, index, row level
   security, the six functions and their grants; idempotent).
2. **Server:** new `apps/server/src/routes/templates.ts` and `apps/server/src/templates.ts`;
   existing `apps/server/src/app.ts` (register the routes only), `apps/server/src/supabase.ts` and
   `apps/server/src/runtime.ts` (the six database calls and their types only). No room, socket,
   worker-room or adapter change.
3. **Web:** exactly three new files `apps/web/src/team/templates-rules.ts`, `templates.ts`,
   `templates-section.tsx`; existing `apps/web/src/team/team-app.tsx` (pass the section),
   `apps/web/src/ui/palette.tsx` and `apps/web/src/ui/templates-panel.tsx` (render the passed
   section before "Activities"), `apps/web/src/state/use-editing-commands.ts` (the
   `templateCommands` object of web modules v37), `apps/web/src/activities.ts` (insertion and
   preview take a parsed document 10 board) and `apps/web/style.css`. `apps/web/src/App.tsx` changes
   only on its two existing lines that pass `addActivity`, which carry `templateCommands` instead,
   with no added line (web modules v37).
4. **Focused tests and guards:** new `tests/team-templates.test.mjs` and
   `tests/server/templates.test.ts`; existing `tests/modules.test.mjs`, `tests/activities.test.mjs`,
   server `suite.test.ts` (S48), `history.test.ts` (S192, S193), `lifecycle.test.ts` (S221) and
   `reactions.test.ts` (S372), table counts only, `setup.ts`, `node-test.ts`,
   `worker-test.ts`, `driver-node.ts`, `driver-workerd.ts` under `tests/server`. Root
   `vitest.node.config.ts` and `vitest.workerd.config.ts` add only the new server include;
   `tests/README.md` records ranges, dispositions and limits. Dynamically import new modules inside
   named checks, never at top level, so baseline absence fails by check name rather than aborting the
   file.
5. **Record:** append only this brief's Implementation record, in a separate record commit,
   including later fix-round record commits. Distinguish the validated source revision from the
   record-inclusive tip.

Outside the named new controls, the existing screens' markup stays exactly as at the base: the reviewer's A–J comparison allows only the masks listed under validation. The named new controls are the team group, its card menu and its four dialogs; the Templates panel on local boards and the off build is unchanged. No dependency, manifest, lock,
inventory, notices, build-script or service-permission change beyond the new table's grants, no new
import exception or state hook. Ignored build output never counts as a tracked change. Escalate a
required file outside this list; do not expand it.

## Required behavior and concrete design

Implement team templates v1, API v12, access v13, interaction v39 and web modules v37 in full. In
particular:

- Server: the table, its constraints and index; row level security on with no `authenticated`
  policy; functions executable by `service_role` only; every route reads the caller's current
  workspace role in the same function call that serves it; the 25 cap under a workspace-row lock.
- Objects: exactly the Copy snapshot form (no `generation`, no `order`), 1–250, no `image`,
  validated by `validate()` on a wrapped document 10 on both client and server; `content_bytes` at
  most 262,144; names and descriptions by code points.
- Responses: the exact template shape, newest `updatedAt` first, `limit: 25`, `canSave`,
  `canManage`; refusals exactly as API v12, nothing stored on any refusal.
- Client: the team group only for workspace owners, editors and viewers on hosted boards; list read
  on each panel open and after own changes; Save label by selection; four disabled reasons in order;
  the dialogs, menu, notices, words, colours and sizes of interaction v39; Add template re-reads the
  template then inserts by the unchanged activity insertion (one Undo step, fresh identities,
  remapped sections, groups and connector ends, selection, view, notice); refusals show the
  "no longer available" notice and refresh.
- Independence: no template id or provenance field on inserted objects; replacing or deleting a
  template, or editing a copy, never changes the other.

## Shared-path check dispositions

This inventory authorizes expectation changes, not additional historical runs.

| Shared path / older checks | Disposition |
| --- | --- |
| Service-table inventory: S48 (`suite.test.ts`, table count with row level security), S192 and S193 (`history.test.ts`, `pg_tables` and row-level-security counts), S221 (`lifecycle.test.ts`, "sixteen RLS service tables"), S372 (`reactions.test.ts`, service-table count) | 16 → 17 for the new `templates` table only, its name and the check's wording where it says sixteen; every function list, grant, `authenticated` refusal and other assertion stays |
| Module inventory: modules units | 51 → 54 team modules (the three named), 22 state hooks, App.tsx changed only as web modules v37 allows and at most 264 lines; `templates-rules.ts` joins the no-React/no-Auth list |
| Activities: `tests/activities.test.mjs` and 0008-W1 scenario Q | Catalogue, preview and insertion results for the three activities stay identical; only the function signatures that now also accept a parsed document 10 board may change |
| Templates panel on local boards and the off build: Q1–Q8, Q20–Q23 | Unchanged: no team group, no request |
| Local shell: A–J off | Off bundle unchanged; no new mask |

## Server checks

0007-W4 ended at S377. New **S378–S401 (24)** in `tests/server/templates.test.ts` run on **both
Node and workerd**. Print `PASS:`/`FAIL:` with each full S ID and `SUMMARY-TEMPLATES`. Use real HTTP
requests with real tokens against the local Supabase project; never screenshots as proof.

| ID | Required proof |
| --- | --- |
| S378 | List as owner, editor and viewer: 200, exact keys `{templates, limit, canSave}`, `limit` 25, `canSave` true/true/false, templates newest `updatedAt` first then `id`, each with exactly API v12's template keys |
| S379 | An enabled guest member, with and without a board grant, gets 403 `role_too_low` with `needed: "viewer"` on all five routes; an outsider, a member removed without grants and a disabled person get 404 `not_found`; nothing changes |
| S380 | Save as owner and as editor from an active board of the workspace: 201 with the exact template; stored row has `creator_label` = `labelOf(email)`, `source_title` = the board title, `object_count`, `content_bytes` and `source_board_id`; it lists first |
| S381 | Save refusals: workspace viewer 403 `needed: "editor"`; a board of another workspace, a trashed board and an unknown board 404; a non-UUID `sourceBoard` 400; no row stored |
| S382 | Shape and text: missing, extra or misspelled keys, non-string name or description, blank name, 121 code points, a lone surrogate, U+0000 in name or description, a 301-code-point description, non-array objects → 400 `bad_request`; 120 astral code points accepted |
| S383 | Objects: 0 objects, 251 objects, an `image` object, a duplicate id, an object with `generation` or `order`, an unknown type, an invalid field and U+0000 in an object's text → 400; a set with a section, a group and a connector between two included stickies is accepted and returned unchanged |
| S384 | Size: objects whose compact JSON is exactly 262,144 bytes are accepted; 262,145 → 413 `template_too_large`; a body over 1,048,576 bytes → 413 `body_too_large` |
| S385 | Limit: the 25th save succeeds, the 26th returns 409 `template_limit`; from 23, five concurrent saves yield exactly two 201s and the count is 25 |
| S386 | Read one: exact template; another workspace's template id, an unknown id and a non-UUID id → 404 |
| S387 | Edit details by the creator (editor): 200, name and description changed, `updatedAt` later, objects, counts, creator and source unchanged; it lists first |
| S388 | Replace by the creator: objects, `objectCount` and `sourceTitle` replaced from the new `sourceBoard`; name, description, creator and `createdAt` unchanged |
| S389 | Manage rights: an editor who is not the creator, and a creator lowered to viewer, get 403 `needed: "owner"` on both PATCH forms and DELETE; the owner succeeds on another person's template; a replace by the creator naming a board where their role is viewer gets 403 `needed: "editor"` |
| S390 | Delete: 204 with empty body; then read 404 and the list omits it; at 25, deleting one lets the next save succeed |
| S391 | PATCH bodies: `{name, objects}`, `{}`, `{name}` alone and extra keys → 400; nothing changes |
| S392 | Removal: after `DELETE /workspaces/:workspace/members/:person` returns, a removed editor with no board grant is refused 404 on the very next list, read, save, PATCH and DELETE, and a removed editor who keeps a board grant (now a guest) is refused 403; no delay; their templates remain with `creator_label`, and the owner can edit and delete them |
| S393 | Lowering: editor → viewer can list but gets 403 on save and on managing their own template; editor → guest gets 403 on list |
| S394 | A disabled person gets 404 on all five routes |
| S395 | Independence from boards: around saves, replaces, edits and deletes, the source board's document bytes, revision, edited-at, history count and room storage inventory are unchanged, and no socket frame reaches its connected clients |
| S396 | Joined, tickets and every room snapshot carry no template field; inserted copies are not checked here (browser T8-S16, T8-S17) |
| S397 | Schema: `nextphase_board` has 17 tables, `templates` has row level security on, the existing `rls` helper with a member's token reads no `templates` row and cannot write one, and `anon`/`authenticated` cannot execute the six functions |
| S398 | Applying the schema file a second time succeeds and keeps every template row |
| S399 | A templates database failure (the test's own induced fault, for example a revoked function grant in the test's own project) returns 503 `service_unavailable` and stores nothing |
| S400 | CORS: the allowed origin receives the existing headers on all five routes and a preflight allowing PATCH and DELETE; another origin receives none |
| S401 | A non-ASCII email local part becomes the `creatorLabel` exactly; times are ISO 8601 UTC with milliseconds |

## Browser checks

New scenario **T8-S1–T8-S23**: 22 on checks, T8-S21 local and off. T8 was unused in existing
public briefs when allocated. A fresh independent check run writes its tool from these clauses and
the contract values; each row prints its full ID, `PASS:`/`FAIL:` and a summary, retaining raw
receipts and unrun rows.

Use independently authenticated contexts in workspace "Example team": owner ana, editor ben,
viewer mia, and a guest with an editor grant on the main board where named. Fixtures, made before
T8-S1 and restored where a row says so: the main board "Team test board" holds two stickies and a
text and nothing else; a second board "Planning board" holds a section containing two stickies that
form one group, and a connector between those stickies. Through the API (not the UI), ben saves
"Weekly check-in" from the whole Planning board and then ana saves "Sprint kickoff" from the main
board's three objects, so the list shows "Sprint kickoff" then "Weekly check-in". Select all is
Cmd/Ctrl+A with the canvas focused; deselect is Escape with the canvas focused. Use real requests
and real events, never painted DOM. New capability criteria also fail by name on independent
baseline 2bbcc41. Save a real-state image for T8-S1–T8-S14 and T8-S16 at 1280 × 800, scale 1, and
T8-S15 at 375 × 812. Derived positions ±0.5 CSS px; colours and sizes exactly as interaction v39.
Fixture descriptions: "Sprint kickoff" — `Goals, risks and owners for a new sprint.`; "Weekly
check-in" — `Wins, blockers and next steps, one column each.` Names, descriptions, object counts and
preview drawings in the mock-up's PNGs come from its own sample data and are data, not values (for
example "inserted" shows 6 objects where T8-S16's fixture gives 4); every other look is a value. Its
notices appear in the hosted toast (interaction v39 Notices).

| ID | Scriptable behavior and expected result |
| --- | --- |
| T8-S1 | ana selects all (3 objects) and opens Templates: team group between header and Activities; head row, count `2 of 25`, `Save selection as template`; the two cards newest first with previews, creator lines and More options; Add template on hover. Capture panel-owner |
| T8-S2 | Save opens the dialog: focus in Name, counters, line, preview, `3 selected objects from Team test board`. Capture save-selection |
| T8-S3 | In the Save dialog, clear Name and press Tab: `Enter a name.` alert and Save disabled; typing a name enables it; then Cancel, which returns focus to Save. Capture save-name-required |
| T8-S4 | Focus the canvas and press Escape to deselect: the button reads `Save board as template` with its tip; its dialog says `All 3 objects on Team test board`. Capture save-board and save-board-dialog |
| T8-S5 | Saving `Sprint 15 kickoff`: real 201, the card first with the 2px ring, count `3 of 25`, toast `Saved “Sprint 15 kickoff” to Example team.`; reopening the panel after a reload shows it from the server. Capture saved |
| T8-S6 | ana deselects; More options on Weekly check-in opens the menu with its three items, rule and looks; Replace is disabled with its tip. Capture card-menu |
| T8-S7 | Edit details on Weekly check-in: fields prefilled, Save changes updates the card and shows the toast `Updated “…”.`; focus returns to More options. Capture edit-details |
| T8-S8 | ana double-clicks the sticky `Ship the beta`, types ` today` at the end, presses Escape, selects all, then Replace with selection on Sprint 15 kickoff: confirmation text, Replace content; the stored objects now hold `Ship the beta today`; toast `Replaced “Sprint 15 kickoff” with 3 objects.`. Capture replace-confirm |
| T8-S9 | ana adds Sprint 15 kickoff to the board (Add template), reopens Templates and deletes it: confirmation, Delete template; the card leaves, count −1, toast `Deleted “…”.`, focus on Save; the copy just added stays on the board. Capture delete-confirm |
| T8-S10 | A workspace with no templates shows the empty line. Capture empty |
| T8-S11 | Seeded through the API to 25 templates: Save is disabled with the limit reason as tip and description; afterwards the extra templates are deleted through the API. Capture limit |
| T8-S12 | Keyboard: Tab order Close, Save, then per card Add template and More options; menu opens with Enter, Space or ArrowDown, arrows wrap, Home/End, Enter picks, Escape returns focus to More options; a dialog returns focus to its opener. Capture keyboard-focus |
| T8-S13 | With Weekly check-in shown in ana's open panel, ben deletes it through the API; ana's Add template on it shows the toast `“Weekly check-in” is no longer available. Templates were refreshed.` and the card disappears; Weekly check-in is then re-seeded as in the fixtures. Capture unavailable |
| T8-S14 | ben (editor) sees no More options on ana's card and has them on his own. Capture editor |
| T8-S15 | 375 × 812: the one-column panel with the team group; head row fits; menu and dialogs stay inside the viewport. Capture narrow |
| T8-S16 | On the main board ana adds Weekly check-in (the Planning board's section, two grouped stickies and connector): v21 placement beside the content, all added objects selected, panel closed, view fitted, toast `Added “Weekly check-in”: 4 objects.`; the saved document holds the template's types, text and colours with new ids and generations; the added section contains the two added stickies, the two added stickies share one new group id, and the added connector's ends are the two added stickies; one Undo removes it, Redo restores it; a second Add gives a second independent copy. Capture inserted |
| T8-S17 | Editing an added copy leaves the template's stored objects unchanged; replacing and then deleting the template leaves the added copy unchanged; afterwards Weekly check-in is re-seeded through the API as ben from the Planning board |
| T8-S18 | mia (board viewer) has no usable Templates button as at the base and sends no template request |
| T8-S19 | A guest with a board editor grant opens Templates: Activities only, no team group, no template card |
| T8-S20 | ana removes ben (no board grant) from the workspace: ben's board session ends as today; in ana's list Weekly check-in keeps `By ben` and ana can still edit and delete it |
| T8-S21 | Local board on the team-on build and the team-off build: the Templates panel is exactly as at the base and no template request is made; the off bundle has none of the three team-template modules |
| T8-S22 | Raw requests from the UI for list, read, save, both PATCH forms and delete match API v12's bodies exactly; list, read, save, edit, replace and delete send no room socket frame (Add template's board edit and ordinary presence and connection traffic are expected) |
| T8-S23 | An intercepted 503 on save, replace and delete keeps the dialog open with its alert line; Escape closes it and returns focus |

## Acceptance criteria

- **0008-W2-AC01:** On a hosted team board on either runner, a workspace owner or editor with edit
  rights on the board saves the current selection, or the whole board when nothing is selected
  (1–250 objects, at most 262,144 bytes), as a template of that board's workspace with a name
  (1–120) and optional description (0–300). The server stores the objects, the creator's label and
  the source board's title, and refuses viewers, guests, a 26th template, oversize or malformed
  content and unknown fields. The card shows `By <label> · from <board>`. Look, focus and wording
  match interaction v39 and the approved design.
- **0008-W2-AC02:** The workspace's current owners, editors and viewers (never board-grant guests,
  other workspaces or signed-out people) see its templates, newest first, in the Templates panel's
  team group; local boards and the team-off build show none. Add template inserts a copy by 0008-W1's
  rules: fresh identities with internal references remapped, beside existing content, selected, one
  Undo removes it, and a second Add gives a second independent copy.
- **0008-W2-AC03:** Only the creator (while still an owner or editor) and the workspace owner may
  edit details, replace content or delete; others get no menu and the server refuses them. Edits to
  inserted copies never change the template, and replacing or deleting a template never changes
  boards that used it. A person whose workspace role is removed or lowered to guest is refused on
  their next list, read, add, save or change, and Add from an already open panel shows the "no
  longer available" notice; their own templates stay in the workspace. Proved on both runners.

| Criterion | Evidence that shows it |
| --- | --- |
| 0008-W2-AC01 | S378; S380–S385; S397–S398; S401; T8-S1–T8-S5; T8-S10–T8-S12; T8-S15; T8-S22–T8-S23; V4; V9 |
| 0008-W2-AC02 | S378–S379; S386; S396; T8-S1; T8-S14; T8-S16; T8-S18–T8-S19; T8-S21; V4; V9 |
| 0008-W2-AC03 | S387–S395; S399–S400; T8-S6–T8-S9; T8-S13; T8-S17; T8-S20; V4; V9; V11 |

## Applicable DESIGN.md guardrails

Canvas-first shell, native controls and visible focus, minimum action hits, protected native editing
and independent state owners apply. Interaction v39 states every new look, word and key; never infer
generic styling. No new sound or font. Preserve complete selection chrome and the inherited
Templates panel and activity insertion contracts.

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

Copy off and on outputs aside before rebuilding. After the build and before browser check 1, one
fresh server-only run clean-clones the candidate, installs, creates a uniquely owned local Supabase
project from committed config, installs the schema and runs Node then workerd. No browsers there;
failures go back once for a fix, then the check run's suites prove it. Existing setup machinery:

```sh
node tests/server/make-signing-key.mjs
npx supabase start
node tests/server/write-stack-info.mjs
npm run test:server:node
npm run test:server:workerd
npx supabase stop --no-backup
```

Record each long suite's start and end and the host's sleep and wake events; a suite that
overlapped a sleep is INVALID (host asleep), never a product result, and is rerun awake. Three Safari
checks from this milestone are chosen only at Review.

Independent scenario interface (tool written by the later check run):

```sh
node tools/browser-compare/0008-w2-check.mjs <served-on-origin> <T8-output> <local-stack-private-json>
node tools/browser-compare/0008-w2-check.mjs <baseline-on-origin> <T8-base-output> <baseline-stack-private-json> --negative
node tools/browser-compare/0008-w2-check.mjs <served-off-origin> <T8-off-output> <local-stack-private-json> --off
```

| Check | Command/inspection and pass condition |
| --- | --- |
| V1 | Byte-compare manifests, locks, dependency inventory and runtime notices against the prerequisite base: unchanged, no new dependency |
| V2 | `npm ci --ignore-scripts --no-audit --no-fund` exits 0 on the clean candidate and on the independent baseline |
| V3 | `npm run typecheck` exits 0 across all five workspace members |
| V4 | `npm test` full suite exits 0; focused team-templates units prove the snapshot and whole-board object sets, validation (counts, image refusal, wrapped `validate()`), byte size at 262,144/262,145, code-point counters, Save label and the four disabled reasons in order, response parsing, sorting, notice words, menu keys, and that inserted copies carry no template field. Guards: 54 team modules, 22 state hooks, App.tsx at most 264 lines and changed only on its two `templateCommands` lines; activities units unchanged in result |
| V5 | Team-off `npm run build` and `npm run audit:licenses` exit 0; index.html and notices byte-identical to baseline off; build metadata has no team or Supabase input and none of the three team-template modules |
| V6 | `npm run build:fixtures`, team-on `npm run build` and `audit:licenses` exit 0; index.html equals baseline on; notices equal runtime notices v3 |
| V7 | `npm run build:server`, `audit:licenses` and `WRANGLER_SEND_METRICS=false npx wrangler deploy --dry-run --outdir <scratch> -c apps/server/wrangler.json` exit 0; no deploy |
| V8 | Inspect all hunks plus `git diff --name-status` and `git diff --check` over `<prerequisite-base>..<validated-source>`: only deliverables 1–4 and the append-only Implementation record |
| V9 | T8-S1–T8-S20, T8-S22–T8-S23 on (22) and T8-S21 local and off (1) pass with the 17 state captures and raw receipts; S378–S401 reached on both runners |
| V10 | Once, on an independent 2bbcc41 source, build and fresh stack, the new template unit, server and browser capability checks fail by name; a top-level setup or import abort does not count |
| V11 | Full `npm run test:server:node` then `npm run test:server:workerd`: S1–S50 and S55–S401, with the existing workerd physical exclusions S37, S43, S70 and S168 and the Node-only S344 physical subcase as before. No new failures; no unrun case called passed |
| V12 | Accepted A–J team-off compare: baseline twice, then candidate and diffs; existing saved-time normalization only, no new mask |
| V13 | Accepted regression: 0008-W1 scenario Q on the candidate's local board and on 2bbcc41; amend only the declared expectations, keep functional assertions and classify every failure against 2bbcc41 |

Accepted additional-run allocations: full unit about 1 min; both server suites 23–28 min after the
shared schema; A–J off 3–4 min; Q 4–6 min (low confidence). Roughly 35–45 active minutes with shared
setup. No unrelated historical, harness, load, performance, browser-matrix or assistive campaign.

A Q failure that also fails on 2bbcc41 is a baseline finding to report, not a W2 failure, and is
never fixed here.

## Review focus and public references

Review the role read inside each database function (no stale role), the cap under the workspace-row
lock, validation by `validate()` on both sides with the image refusal and byte limit, the exact
response shape and refusals, and that no template action touches a board, room or socket first. Then
Add template's fresh read and unchanged insertion, the absence of any template field on copies, the
team group's role gating and refresh after refusals, the dialog and menu focus rules, and the module
seams with App.tsx changed only on its two `templateCommands` lines. Public source basis is main 2bbcc41 and the linked versioned contracts,
read 2026-11-14; no outside product is needed to implement this contract. No unresolved product
decision is delegated to implementation.

## Exclusions and reasons

- Templates on local boards or the team-off build; templates shared across workspaces, publicly or
  as files; importing or exporting templates.
- A live link between a template and its source board or its copies; publishing changes to copies.
- Uploaded thumbnails; pictures in templates; per-plan limits; an admin switch for all templates.
- A restore list for deleted templates; live push of template changes to other people's open panels.
- Repairs to separately tracked baseline failures (including Q rows failing on 2bbcc41).

## Implementation record

(Appended by the implementer.)

### Implementation — v1

Branch: `codex/0008-W2-save-and-reuse-team-activities`.
Prerequisite base: `415c2f2aaf35c3c2f60352b77bc2399cc8d9af63`.
Behaviour baseline: `2bbcc413a78bae192d876b0bf1c54450cddfc61d`.
Validated source/test revision: `5a491c46293e7df0b9eb207a8b4819db10e18e1e`
(`feat(templates): save and reuse workspace activities`). The implementation
record is a separate documentation commit; its record-inclusive tip is reported
separately in the handoff.

Implemented the workspace template table, six service-only database functions
and five HTTP routes; current membership checks, the serialized 25-template cap,
client/server document-10 object validation and the exact API response/refusal
forms. The hosted Templates panel gains the team group, previews, card menu and
four dialogs, with hosted toast notices and fresh reads before independent
insertion through the existing activity path. App.tsx changes only its two
permitted bindings and remains 264 lines. No dependency was added (there are no
new dependency versions or licenses to record), and no room, socket, adapter,
document, file or backup format changed.

All following commands ran with Node 26.13.0 and npm 11.20.0. Candidate checks
ran against the clean validated source revision above. The independent baseline
was extracted from the behaviour baseline into separate scratch, installed and
built off/on; its outputs were retained for byte comparisons. Candidate off and
on outputs were copied aside before subsequent builds.

| Check | Commands / inspection | Result and count |
| --- | --- | --- |
| V1 | Byte-compare tracked manifests, locks, dependency inventories and runtime notices with the prerequisite base | PASS: 20 files identical; zero added dependencies |
| V2 | `npm ci --ignore-scripts --no-audit --no-fund` on candidate and independent baseline | PASS: exit 0 on both; 118 packages each |
| V3 | `npm run typecheck` | PASS: all five workspace members, exit 0 |
| V4 | `npm test` | PASS: 1,124/1,124; zero failures, cancellations or skips; includes T8-U1–T8-U12 (12), unchanged activity assertions, 54 team modules, 22 state hooks and the exact two-line App guard |
| V5 | `BOARD_TEAM_FEATURES=off BOARD_SUPABASE_URL=http://127.0.0.1:55321 BOARD_SUPABASE_ANON_KEY=synthetic BOARD_SERVER_URL=http://127.0.0.1:8796 npm run build`; `npm run audit:licenses`; inspect metadata and byte-compare outputs | PASS: both exit 0; HTML and notices equal baseline off; 216 inputs, zero team or Supabase inputs, including zero new team-template modules |
| V6 | `npm run build:fixtures`; `BOARD_TEAM_FEATURES=on BOARD_SUPABASE_URL=http://127.0.0.1:55321 BOARD_SUPABASE_ANON_KEY=synthetic BOARD_SERVER_URL=http://127.0.0.1:8796 npm run build`; `npm run audit:licenses` | PASS: all exit 0; HTML equals baseline on; notices equal baseline on and runtime notices v3 |
| V7 | `npm run build:server`; `npm run audit:licenses`; `WRANGLER_LOG_PATH=<scratch>/wrangler.log WRANGLER_SEND_METRICS=false npx wrangler deploy --dry-run --outdir <scratch>/worker -c apps/server/wrangler.json` | PASS: all exit 0; dry-run upload 1,366.45 KiB (gzip 280.54 KiB); no deploy |
| V8 | Inspect all hunks; `git diff --name-status 415c2f2aaf35c3c2f60352b77bc2399cc8d9af63..5a491c46293e7df0b9eb207a8b4819db10e18e1e`; `git diff --check` over that range | PASS: 27 source/test/documentation files within deliverables 1–4; clean whitespace. This separate record adds only the append below the existing Implementation record heading |

Before the final clean-revision validation, focused units found two fixture
mistakes (object text above its type limit and an empty board title) and a test
assertion using `reason` instead of the error's `message`; those tests were
corrected. Typechecking found the document-10 preview needed to narrow text
objects before applying their paint functions; that source correction is in the
validated revision. The first dry run exited 0 but its default logger attempted
an unwritable directory; the recorded command redirects the log into scratch
and completed without that warning.

**Unrun:** V9–V13, including S378–S401 (24) on each server runner, all inherited
server suites, schema execution against Supabase, T8 browser scenarios and the
17 state captures, independent baseline capability failures, A–J off, activity
Q, Safari, native IME and browser focus/layout acceptance. Browsers and the
Supabase CLI cannot start in this implementation sandbox; none was attempted.
The new server cases are registered, not claimed passed. Unit controller checks
substitute the HTTP port and do not prove real database authorization or browser
rendering. No unrelated acceptance or performance campaign ran.

**Escalation for independent review:** S389 requests a creator whose effective
role on a source board of the same workspace is viewer. The inherited
`board_role` takes the strongest workspace/grant role, so a current workspace
editor remains editor even with a viewer board grant. A creator lowered to
workspace viewer is refused by the earlier manage check (`needed: "owner"`).
The required defensive source-board viewer guard is implemented, but that
particular natural fixture is unreachable without changing inherited access
policy. S389 and `SUMMARY-TEMPLATES` explicitly report this unproved subcase;
review must disposition it. No access policy was changed to manufacture it.

The code graph tool was unavailable under the run's approval policy; file-based
discovery was used after that refusal. Source commit privacy hooks passed. Git
emitted a sandbox `packed-refs.lock` maintenance warning after the hooks, while
the source commit succeeded. No hooks were bypassed, no stash was used, and no
push, merge, publication or deployment occurred. The unrelated 0007-W2 evidence
path was not read or changed.

Changed files in the validated source revision:

- Server: `apps/server/supabase/nextphase_board.sql`, `apps/server/src/app.ts`,
  `apps/server/src/runtime.ts`, `apps/server/src/supabase.ts`,
  `apps/server/src/templates.ts`, `apps/server/src/routes/templates.ts`.
- Web: `apps/web/src/App.tsx`, `apps/web/src/activities.ts`,
  `apps/web/src/state/use-editing-commands.ts`, `apps/web/src/team/team-app.tsx`,
  `apps/web/src/team/templates-rules.ts`, `apps/web/src/team/templates.ts`,
  `apps/web/src/team/templates-section.tsx`, `apps/web/src/ui/palette.tsx`,
  `apps/web/src/ui/templates-panel.tsx`, `apps/web/style.css`.
- Tests and guards: `tests/team-templates.test.mjs`, `tests/modules.test.mjs`,
  `tests/server/templates.test.ts`, `tests/server/setup.ts`,
  `tests/server/suite.test.ts`, `tests/server/history.test.ts`,
  `tests/server/lifecycle.test.ts`, `tests/server/reactions.test.ts`,
  `vitest.node.config.ts`, `vitest.workerd.config.ts`, `tests/README.md`.
- Record commit only: `docs/briefs/0008-W2-save-and-reuse-team-activities.md`.

### Server fix round 1

Branch: `codex/0008-W2-save-and-reuse-team-activities`.
Fix base: record tip `f9ada0f11be3c2f68c097d5e967c9ea346e790e3`, whose
validated source was `5a491c46293e7df0b9eb207a8b4819db10e18e1e`.
Validated source/test revision for this round:
`8f5a82d6557d7fdf524c5d0c1264fbf702193274`
(`test(templates): exclude backup time from S395 equality`). This section is
appended in a separate record commit; its tip is reported in the handoff.

The supplied independent server receipts for the preceding candidate showed
Node: 395 passed, 2 failed, 0 skipped; workerd: 391 passed, 2 failed, 2 skipped.
Templates were 23 passed / 1 failed on each runner. S395 failed on both full
runs and both filtered retries because the backup envelope's `createdAt`
changes when the backup is produced, even for an unchanged room. The filtered
Node retry differed only by 100 ms in that envelope timestamp. The production
backup implementation confirms it uses the current time for that field.

Changed only S395 in `tests/server/templates.test.ts`: each backup's envelope
`createdAt` must be a string that round-trips through `Date.toISOString()`, and
only that top-level field is excluded from the before/after equality. Every
other envelope field and every backup table remain in the comparison. The
source export/document, board rows (including revision and edited-at), versions,
room inventory comparison, saves/edits/replaces/deletes and no-socket-frame
assertion are otherwise exactly as before. No product code, schema, dependency,
manifest, lock or other test changed. No dependency versions or licenses were
added.

S170 (Node) and S93 (workerd) each failed once in the supplied full-run receipts,
then passed their filtered candidate retry and all three filtered baseline
retries on `2bbcc413a78bae192d876b0bf1c54450cddfc61d`. They remain unchanged;
the independent check run must rerun both full suites. S389, its UNPROVED
message and its summary remain unchanged; review owns that disposition. The
17-table checks S48, S192, S193, S221 and S372 passed in the supplied receipts.
Those results describe the preceding candidate, not a server run of this fix.

Validation used Node 26.13.0 and npm 11.20.0 on the clean test commit above:

| Check | Command / inspection | Result |
| --- | --- | --- |
| Local reproduction and focused probe | `node <scratch>/0008-W2-server-fix-1-probe.mjs` | PASS: reproduced the original equality failure using the production backup function and unchanged in-memory SQLite storage, with reads 100 ms apart. The actual S395 helper extracted from the test passed 11 checks: changing envelope time is accepted, invalid/missing/non-string timestamps are refused, all 16 logical-backup tables are retained, and payload, table inventory and nested timestamp changes still differ |
| V3 | `npm run typecheck` | PASS: exit 0, all five workspace members |
| V4 | `npm test` | PASS: exit 0, 1,124/1,124; zero failures, cancellations or skips; includes the existing 12 focused template units |
| V8 | Inspect every hunk; `git diff --name-status f9ada0f11be3c2f68c097d5e967c9ea346e790e3..8f5a82d6557d7fdf524c5d0c1264fbf702193274`; `git diff --check` over that range | PASS: exactly one changed file, `tests/server/templates.test.ts`, with changes confined to S395. Prefix/suffix comparison confirms every other check is byte-identical. This separate record commit changes only this brief's appended record |

**Unrun in this fix round:** S395 through authenticated HTTP on either runner,
Supabase/schema checks, both full server suites and their filtered retries,
browser acceptance and builds. Supabase CLI and browsers cannot start in this
sandbox; none was attempted. The local probe verifies the production backup
behavior and the comparison helper, not template HTTP operations, socket
silence or full S395 acceptance. V1, V2, V5–V7 and V9–V13 were not rerun; this
round was limited to the requested V3, V4, V8 and focused local reproduction.
No new escalation was introduced.

Mandatory privacy hooks passed for the test commit. Git emitted the same
sandbox `packed-refs.lock` maintenance warning while the commit succeeded.
No hooks were bypassed, no stash was used, and no push, merge, publication or
deployment occurred. The unrelated 0007-W2 evidence path was not read or changed.
