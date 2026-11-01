BRIEF VERSION: 0003-W4 v1 (2026-11-01)
# 0003-W4 — Sign in, share and see access in the web app

Status: Draft. Contracts: [0003 hosted storage v1](../architecture/0003-hosted-storage-v1.md)
(new), [0001 interaction v25](../architecture/0001-interaction-v25.md),
[0001 web modules v25](../architecture/0001-web-modules-v25.md),
[0003 sync v4](../architecture/0003-sync-v4.md) and
[0001 toolchain v5](../architecture/0001-toolchain-v5.md) with its
[lock v5](../architecture/0001-dependency-lock-v5.json),
[inventory v5](../architecture/0001-dependency-inventory-v5.json) and
[runtime notices v3](../architecture/0001-runtime-notices-v3.txt). Unchanged and still in force:
[0003 identity v3](../architecture/0003-identity-v3.md),
[0003 access v4](../architecture/0003-access-v4.md), [0003 API v4](../architecture/0003-api-v4.md),
[0003 hosted persistence v3](../architecture/0003-hosted-persistence-v3.md),
[0003 self-host runner v1](../architecture/0003-self-host-runner-v1.md),
[0004 presence v1](../architecture/0004-presence-v1.md),
[0001 document v11](../architecture/0001-document-v11.md) and
[0001 storage v3](../architecture/0001-storage-v3.md). Where an unchanged contract links an older
version of a contract replaced here, the version named in this brief applies.

## Outcome

The server already checks Supabase tokens, works out each person's role, records invitations,
changes and removes roles, and runs each board's room. This milestone is the web app's half,
behind a build switch that is off by default:

- **Sign in.** With team features on, a person signs in with a 6-digit code emailed by Supabase
  Auth (no password) and signs out from the Board panel. The session renews itself, and an open
  board's connection is renewed before its token expires.
- **Open a hosted board by link.** A board link opens the board through the shared client;
  signed out, a gate asks for sign-in first. Owners and editors edit; viewers only look.
  Typing in one note is one undo step, as on a local board.
- **Share.** The workspace owner invites people to the board or the workspace by link (Board
  sends no email), sees who has access and whether each role comes from the workspace, this
  board or both, changes and removes roles, and cancels invitations. Everyone else sees Copy
  link and that only the owner changes access.
- **Say what is happening.** The hosted save states Saving…, Saved, View only, Offline — view
  only and Not saved, and one plain message for each refusal.

With team features off, the app looks and works exactly as before and makes no request beyond
its own files. Nothing is deployed; the server, the room and every saved format are unchanged.

## Read first and prerequisite contracts

- [Contributor guidance](../../CONTRIBUTING.md), [agent instructions](../../AGENTS.md) and
  [engineering standards](../../DESIGN.md).
- The five contracts above: they define every behaviour this brief asks for. Hosted storage v1
  is the behaviour, interaction v25 the screens and words, web modules v25 the module layout,
  sync v4 the one shared-client change, toolchain v5 the dependency and the build switch. Where
  this brief and a contract seem to differ, the contract wins; report the difference.
- [The 0004-W1 v1 brief](0004-W1-edit-together-with-participant-presence.md): the shared client
  (`packages/board-sync/src/session.ts`, `undo.ts`) and its unit tests, which this milestone
  uses and extends; [the 0003-W1 v1 brief](0003-W1-owner-editor-viewer-access.md) for the local
  Supabase stack, the Node runner and their settings.
- [API v4](../architecture/0003-api-v4.md) "Routes", "Join tickets", "Invitations" and
  "Changing and removing roles": every server call the app makes.

## Deliverables and boundaries

The base is the main revision that holds this brief, recorded in the implementation record.
Every new source file starts with `// SPDX-License-Identifier: Apache-2.0` (`<!-- … -->` in
HTML). Code follows the repository's style ([engineering standards](../../DESIGN.md)): readable
lines, small modules with one job each, and comments where a reader needs the reason.

1. **Dependency and build** (toolchain v5):
   - `apps/web/package.json` gains `"@supabase/auth-js": "2.118.0"` and nothing else;
     `package-lock.json` becomes byte-identical to lock v5, made with the recipe in toolchain v5;
   - `apps/web/tsconfig.json`: `"skipLibCheck": true`, nothing else;
   - `scripts/team-settings.mjs` (new), `scripts/build-web.mjs` and `scripts/check-notices.mjs`:
     the switch, the page policy, the fixture builds always off, and the notices rule
     (hosted storage v1 "Team features switch"; toolchain v5 sections 3 and 4).
2. **The team modules** (web modules v25): `apps/web/src/team/` with exactly its twelve modules,
   and `apps/web/src/main.tsx` loading `apps/web/src/team/team-app.tsx` only when the switch is on.
3. **The board screen** on a hosted board (hosted storage v1, interaction v25):
   `apps/web/src/state/use-hosted-board.ts` (new); `use-board-document.ts`,
   `use-command-reasons.ts`, `use-editing-commands.ts`, `use-storage-session.ts` and
   `use-panel-layout.ts` in `apps/web/src/state/`; `apps/web/src/ui/save-area.tsx`,
   `file-bar.tsx`, `board-panel.tsx` and `palette.tsx`; `apps/web/src/App.tsx` (wiring only,
   within 262 lines); `apps/web/style.css` (the team rules added at the end; no existing rule
   changes).
4. **Grouped edits** (sync v4 "Grouped edits"): `packages/board-sync/src/session.ts` and
   `undo.ts`. `edit(board)` without a group behaves exactly as at the base; nothing else in
   either file changes, and the room never sees the group.
5. **Supabase setup**: in `supabase/config.toml`, only the new
   `[auth.email.template.magic_link]` section of hosted storage v1 (project ID, ports,
   `site_url`, `jwt_expiry` and sign-ups unchanged); `supabase/templates/magic-link.html` (new),
   holding the subject's heading, `{{ .Token }}` in its own `<p>`, "This code works for one
   hour." and the `{{ .ConfirmationURL }}` link.
6. **Tests**:
   - `tests/team.test.mjs` (new), run by `npm test` without Supabase or a browser, importing
     `links.ts`, `roles.ts`, `notices.ts` and `scripts/team-settings.mjs` directly:
     - the switch: off for no variable, `""`, `ON`, `true`, `1` and `on ` (with a space), even
       with the three settings set; on needs all three; each URL refused with a path, a query, a
       fragment, a user name, `ftp:`; a trailing `/` removed;
     - links: both forms parsed; an invitation with and without `?board=`; refused (bad link):
       upper-case UUIDs, a trailing `/`, an extra query key, `?board=` not a UUID, `#/b/`,
       `#/x`; no fragment and `#notes` are not team links; written board and invitation links
       for an origin with and without a path;
     - where a role comes from: every pair of workspace role (`owner`, `editor`, `viewer`,
       `guest`, none) and grant (`editor`, `viewer`, none), the role shown (the higher; a guest
       gives none) and its source (workspace, this board, both, none); pending invitations
       (accepted, cancelled, expired at and after `expiresAt`);
     - the save state: each row of hosted storage v1 "Save states" and every precedence pair
       (offline over Not saved, Not saved over Saving…, Saving… over View only, View only over
       Saved); a `sent` or `received` request never Saved;
     - the close table: 4401, 4403, 4409, 1012, 4423, 1013, 1000, 1001 and 1006; the failed
       join table of hosted storage v1 "When joining fails" (401, 404, 400 `invalid_label`, 403
       `account_disabled`, 503 `room_locked`, `access_log_pruned` and `service_unavailable`, no
       answer, `join_failed`, and the acceptance's 404, 410 and `invitation_email_mismatch`),
       for opening and for reconnecting; the retry waits (2, 4, 8, 16, 30, 30 seconds); one
       outcome per attempt: a close 1013 before `joined` followed by the join's rejection gives
       Board full and no retry, a close 1006 followed by `join_failed` gives one retry, a close
       4401 before `joined` gives Sign-in expired, and any event after a board-ending outcome
       changes nothing (the classification is a pure function in `notices.ts`);
     - the renewal timer: the delay for remaining lifetimes of 3,600, 120, 60, 10 and 0 seconds
       (`min(60 s, half)` before expiry, never negative);
     - every message of hosted storage v1 "Messages" and of interaction v25 (sign-in errors,
       toasts, Share's words, the no-answer message) with a sample workspace name and reason, character for character;
   - `tests/grouped-edits.test.mjs` (new), on `BoardSession` over a fake transport and clock as
     `tests/shared-editing.test.mjs` does: three grouped edits of one note's text make one step
     and one undo brings back the text before the first; undo then redo gives the last text;
     a different group, no group, an undo, a redo and a rejoin each start a new step; a grouped
     edit that adds or deletes an object makes its own step and the group's next edit starts a
     new one; another
     connection's edit to that text between grouped edits leaves the joined step's text guard
     dead (undo answers `changed_by_others`); a grouped step counts once toward the 100-step
     cap; the `edit` message sent is byte-identical with and without a group;
   - `tests/modules.test.mjs`: the guards of web modules v25 (imports, the twelve team modules,
     twenty-one hooks, `use-hosted-board.ts` with one passive effect), the `App.tsx` budget
     still 262; each existing guard otherwise unchanged;
   - `tests/README.md` lists the two new files.
7. **Documentation**: `docs/architecture/README.md` lists, for 0003-W4 v1, the five contracts
   and that identity v3, access v4, API v4, hosted persistence v3, self-host runner v1, presence
   v1, document v11 and storage v3 stay in force.

Outside the named new controls, the existing screens' markup stays exactly as at the base: the
reviewer's A–J comparison allows only the masks listed under validation. With team features off
there are no new controls, so the A–J comparison (V12) adds no mask. If the work seems to need anything outside items 1 to
7, stop and report it. Nothing in `apps/server/`, `packages/board-room/`, `packages/board-rules/`,
`packages/board-sync/src/document-adapter.ts` or `codec.ts`, the Supabase schema, any saved
format or any other `package.json` changes. No hosted Supabase project, deployment or real
person is used.

## Browser checks

The scenario runs in Chrome at 1280 × 800 against the local stack: Supabase started from this
repository's `supabase/config.toml` (its mail catcher on), the Node runner from
`npm run build:server` with `allowedOrigin` set to the page's origin, and a team-on build served
on that origin. For W4-S15 and W4-S16 only, the stack's copy of `config.toml` sets
`jwt_expiry = 120`. Four synthetic people: the workspace owner (made by the self-host runner's
workspace setup), a person invited as editor, one invited as viewer, and a stranger with an
account and no role. Codes are read from the mail catcher's API. Each check prints
`PASS: W4-S<n> <name>` or `FAIL: W4-S<n> <name>`. The tool is
`tools/browser-compare/0003-w4-check.mjs` in the private repository; the check run keeps its
order and may adjust its steps, keeping each check's meaning.

| ID | Check |
| --- | --- |
| W4-S1 | Signed out on a local board, the save panel ends with Sign in; the email step and the code step show interaction v25's words; the code read from the mail signs in; the Board panel shows "Signed in as <email>"; Sign out returns Sign in |
| W4-S2 | A board link opened signed out shows the gate and no canvas; after the code, the board opens as its owner with the workspace's name in the badge, Share in the save panel and no Save button |
| W4-S3 | The owner adds a sticky with text: the status is Saving… until the room's `saved`, then Saved; the board's export holds the sticky |
| W4-S4 | Share as owner shows Who has access with the workspace row ("Workspace editors and viewers"), the owner row and the footer; Invite with an email (role can edit) copies a link ending in `?board=<board>`, shows the toast and lists the person as Invited to this board |
| W4-S5 | The workspace view shows its words for guests; inviting with the role picker set to can view creates a workspace invitation whose link lands on this board, listed as Invited to the workspace |
| W4-S6 | The editor opens their link signed out, signs in with the invited email, accepts, and reaches the board with Saved and every tool; the editor moves a sticky: Saving…, then Saved, and the board's export holds the new position |
| W4-S7 | The viewer does the same and reaches the board with View only, only Select and Pan in the toolbar, and the View only banner; the viewer selects a sticky and presses Delete, an arrow key, Cmd+D and Undo and drags it: no `edit` message is sent, the status stays View only, and the export is unchanged |
| W4-S8 | The owner's list shows the editor with "this board", and after the owner gives the editor a workspace viewer role, "also viewer in <workspace>" and can edit shown; the workspace view lists the viewer with can view |
| W4-S9 | The owner lowers the editor's grant to can view: the editor's open tab becomes View only with only Select and Pan, without reloading |
| W4-S10 | The owner removes the viewer's workspace role: the viewer's open tab shows the Access removed dialog; Close this board opens the local board |
| W4-S11 | An invitation the owner cancelled: its link, after sign-in with its email, shows the cancelled message |
| W4-S12 | The stranger opening the board link sees the not-found page with Sign in as someone else |
| W4-S13 | Share as the editor shows only their own row, Copy link and the owner-only sentence; no list route is called |
| W4-S14 | With the owner joined, the Node runner is paused (its connection stays open) and the owner adds a sticky: the status is Saving…; the runner is then stopped: Offline — view only with only Select and Pan and the Reconnecting banner, never Saved; after the runner restarts the tab rejoins by itself, the unsaved sticky is not on the board, the status is Not saved, and the next edit shows Saved |
| W4-S15 | With Auth's refresh blocked, the open board shows the Sign-in expired dialog when the room closes the connection with 4401 at the token's expiry |
| W4-S16 | Two tabs of the owner share one Auth session (same user and refresh token); both open rooms receive a `renew` with the new token before the old token's `exp` and answer `renewed` |
| W4-S17 | Sign out in one tab shows the Signed out dialog in the other tab, whose board stops sending |
| W4-S18 | With Share open over the board, 20 Tab presses keep focus inside it; Delete, arrows, Undo, Redo and a tool letter change nothing on the board (its export unchanged); Escape closes it and focus returns to Share |
| W4-S19 | The code email from the local stack holds a 6-digit code in its own paragraph |
| W4-S20 | A code requested for an email with no account is refused and no account is created |
| W4-S21 | The editor's account was created by the invitation route, confirmed, and is the account the code signed in |
| W4-S22 | The server answers a CORS preflight from the page's origin with that origin, and from another origin with no allow header |
| W4-S23 | In a fresh browser context opened directly on the board link and signed in, the page holds only Auth's `localStorage` key (keys starting `nextphase-board/auth/v1`), no `sessionStorage` key and no IndexedDB database. In a context that had a local board open first, opening the board link adds no IndexedDB database or record and no storage key other than Auth's, and the local board list afterwards lists exactly the boards it listed before |
| W4-S24 | Copy link copies exactly `<origin><path>#/b/<board>` |
| W4-S25 | The cancelled invitation's link opened while signed in as another person shows the other-email message |
| W4-S26 | An edit the room refuses (the test transport corrupts its update): the status is Not saved, the toast names the reason, the change is taken back on screen, and the export is unchanged |
| W4-S27 | The owner types "Interview" into a note one key at a time and leaves it; one Undo removes the whole word in one step, and the export, once saved, matches; Redo brings it back |
| W4-S28 | With the board's WebSocket upgrade refused by the test (details still answer), the link shows the Can't open page; when the upgrade is allowed again, the board opens by itself. Then, with the test accepting the WebSocket but never passing on `joined`, a fresh open shows the Can't open page about 15 seconds after it began; released, the board opens by itself |
| W4-S29 | The team-on `index.html`'s policy differs from the base's only in `connect-src`, which is exactly the Supabase origin, the server origin and its `ws:` origin |

## Numbered acceptance criteria

- 0003-W4-AC01: With team features on, a person signs in with an emailed one-time code and opens a hosted board by its link, editing as an owner or editor and only viewing as a viewer; a signed-out person who opens the link is asked to sign in first and then sees the board. With team features off the app looks and works as before and makes no Supabase or server request.
- 0003-W4-AC02: From the Share dialog the workspace owner invites a person to the board or to the workspace as editor or viewer, copies the invitation link, and sees who has access: each person's role and whether it comes from the workspace, this board, or both; pending invitations; and can change or remove a role and cancel an invitation. The invited person opens the link, signs in with the invited email and reaches the board with the offered role. People who are not the owner see Copy link and that only the owner can invite and change access.
- 0003-W4-AC03: The app explains every refusal (not found, view only, access removed, signed out, token expired) and never shows a refused or unacknowledged edit as saved; the hosted save states are Saving…, Saved, Offline — view only, and Not saved.

| Criterion | Evidence that shows it |
| --- | --- |
| 0003-W4-AC01 | W4-S1–S3, S6, S7, S16, S19–S24, S27, S29; V5, V11, V12; the switch, link and renewal tests in `tests/team.test.mjs`; `tests/grouped-edits.test.mjs` |
| 0003-W4-AC02 | W4-S4–S11, S13, S18, S25; the role-source and pending-invitation tests in `tests/team.test.mjs` |
| 0003-W4-AC03 | W4-S9–S12, S14, S15, S17, S25, S26, S28; the save-state, close-table, failed-join and message tests in `tests/team.test.mjs` |

## Validation commands and expected evidence

From the repository root with Node 26.13.0 and npm 11.20.0:

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
git diff --name-status <base>..<validated>
```

Copy `apps/web/dist` aside after each web build, since the next one replaces it.

| Check | Pass condition |
| --- | --- |
| V1 | `package-lock.json` is byte-identical to lock v5; `apps/web/package.json` differs from the base's by the one dependency line; every other `package.json` is byte-identical to the base's |
| V2 | `npm ci` exits 0 |
| V3 | `npm run typecheck` exits 0 for all five members |
| V4 | `npm test` passes with 0 failed; every base test passes unchanged except the guards item 6 names in `tests/modules.test.mjs`; `tests/team.test.mjs` and `tests/grouped-edits.test.mjs` are the only new test files |
| V5 | The off build (with the three settings set) exits 0; its `index.html` and `THIRD_PARTY_NOTICES.txt` are byte-identical to the base build's; `meta.json` has no input under `node_modules/@supabase/` or `apps/web/src/team/`; `app.js` contains none of the three settings' values; `audit:licenses` exits 0 |
| V6 | `build:fixtures` exits 0. The on build exits 0; its `index.html` differs from the off build's only in `connect-src` as hosted storage v1 says; its notices are runtime notices v3 byte for byte; `audit:licenses` exits 0. An on build missing any one setting, or with a URL holding a path, exits non-zero naming the variable |
| V7 | `build:server` exits 0 and `audit:licenses` exits 0 (server notices unchanged from runtime notices v2) |
| V8 | `git diff --name-status <base>..<validated>` shows only files of items 1 to 7 |
| V9 | W4-S1–S29 pass on the candidate |
| V10 | Negative control (REC-019): on a fresh local stack started from a checkout of the base (never a stack the candidate used), with the base's web build served the same way, the scenario's checks fail: every one of W4-S1–S29 except W4-S20 and W4-S22, and the new unit tests run against the base's production code. W4-S20 (Supabase refuses a code for an unknown email) and W4-S22 (the server's CORS) check unchanged server and Supabase behaviour the web app relies on, so they pass on both. A check that fails because a control, module or message it asserts is missing counts as failing |
| V11 | With team features off, opening the page and a board link (`#/b/<board>`) requests only the page's own files, opens no WebSocket, shows no Sign in button, and leaves the page policy at `connect-src 'none'` |
| V12 | The A–J comparison of the off build against the base's build shows no difference at any checkpoint (markup, focus, canvas drawing and saved records), where the only normalization is the one the comparison already makes for every run: a local board's "saved today 14:05"-style time text is compared as one placeholder, since two runs minutes apart differ by the clock alone. No other mask |

**Who runs what.** The implementer runs V1–V8 and records them (browsers cannot start there;
the Supabase stack is not needed for them). The reviewer's check run repeats V1–V8 on a clean
clone and runs V9–V12. Each is reported as one `PASS: V<n>` or `FAIL: V<n>` line, with the
scenario's W4 lines kept as evidence. Regression runs accepted by the maintainer: the full unit
suite (V4) and the A–J comparison with team features off (V12). No server suite runs: the
server, the room and the adapter do not change.

No hosted project, deployment, browser matrix, accessibility audit, load test or latency measure
unless the maintainer asks.

## Exclusions and reasons

- Home, creating, renaming and listing hosted boards: the next web milestone; until then a
  hosted board is opened by its link.
- Presence on screen (avatars, cursors): a later milestone; its avatars go before the save
  status.
- Keeping or recovering unsaved work after a disconnect, offline editing: a later milestone;
  this one never resends (hosted storage v1).
- Telling a full board apart on the first join: the browser cannot read the room's 429 before
  the upgrade; the app says "Can't open" and retries. A room that accepts and then closes with a
  reason would be a server change for a later milestone.
- Google and single sign-on, invitation email, public or "Anyone" links, editors inviting, a
  display name, moving a local board to a workspace, images on hosted boards.
- A hosted Supabase project's settings and real people: outside this repository.

## Public references with retrieval dates

Retrieved 2026-11-01: [Supabase passwordless email logins](https://supabase.com/docs/guides/auth/auth-email-passwordless),
[Supabase `signInWithOtp`](https://supabase.com/docs/reference/javascript/auth-signinwithotp),
[`verifyOtp`](https://supabase.com/docs/reference/javascript/auth-verifyotp),
[`onAuthStateChange`](https://supabase.com/docs/reference/javascript/auth-onauthstatechange),
[MDN: `HTMLDialogElement.showModal()`](https://developer.mozilla.org/en-US/docs/Web/API/HTMLDialogElement/showModal),
[MDN: `Clipboard.writeText()`](https://developer.mozilla.org/en-US/docs/Web/API/Clipboard/writeText),
[MDN: WebSocket close event](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket/close_event)
and [MDN: CSP `connect-src`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Security-Policy/connect-src).

## Implementation record

Not started.
