# 0003 — Hosted boards in the web app

CONTRACT VERSION: 0003 hosted storage v1 (2026-11-01)

Status: Draft for 0003-W4 v1. This is the web app's side of a hosted board: how a build turns
team features on, how a person signs in and stays signed in, which links open a hosted board,
what the page keeps on the device, how it joins the board's room, and what it shows while it
saves or when it is refused. The server's side is unchanged: [identity v3](0003-identity-v3.md),
[access v4](0003-access-v4.md), [API v4](0003-api-v4.md), [sync v4](0003-sync-v4.md),
[hosted persistence v3](0003-hosted-persistence-v3.md) and
[self-host runner v1](0003-self-host-runner-v1.md). What each screen looks like and its exact
words are in [interaction v25](0001-interaction-v25.md); where the modules live is in
[web modules v25](0001-web-modules-v25.md); the dependency is in
[toolchain v5](0001-toolchain-v5.md).

Boards kept in the browser ("local boards") are unchanged: [storage v3](0001-storage-v3.md)
and [document v11](0001-document-v11.md) still govern them, and nothing here changes how they
are saved.

## Team features switch

Team features exist only in a build made with the environment variable
`BOARD_TEAM_FEATURES` set to exactly `on`. Unset, empty or any other value means off.

**On.** The build also needs:

| Variable | Value |
| --- | --- |
| `BOARD_SUPABASE_URL` | The Supabase project's origin, for example `http://127.0.0.1:55321` |
| `BOARD_SUPABASE_ANON_KEY` | The project's public (anon or publishable) key; it is meant to be public |
| `BOARD_SERVER_URL` | The Board server's origin, for example `http://127.0.0.1:8796` |

Both URLs must be `http:` or `https:` origins: no path other than `/`, no query, fragment,
user name or password. A trailing `/` is removed. A missing or malformed value stops the build
with an error naming the variable; nothing is written to the output folder in that case. The
three values are compiled into the bundle; the service role key and any other secret are never
an input to the web build.

On, the built `index.html` differs from the off build in exactly one place: its
Content-Security-Policy's `connect-src 'none'` becomes
`connect-src <Supabase origin> <server origin> <server WebSocket origin>`, the WebSocket origin
being the server origin with `http:` replaced by `ws:` (or `https:` by `wss:`). Nothing else in
the policy changes.

**Off.** The build is the web app as before:

- the bundle has no input under `node_modules/@supabase/` and no input from
  `apps/web/src/team/` (type-only imports are erased and are not inputs);
- the JavaScript contains none of the three variables' values, even when they are set;
- `index.html` (with `connect-src 'none'`) and `THIRD_PARTY_NOTICES.txt` (runtime notices v1)
  are byte-identical to the base build's;
- the page shows nothing new, ignores the address's fragment as before, and makes no request
  beyond the page's own files.

## Links

Two fragment forms open team features. `<uuid>` is a lower-case UUID
(`[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}`).

| Form | Means |
| --- | --- |
| `#/b/<board>` | Open hosted board `<board>` |
| `#/invite/<invitation>` or `#/invite/<invitation>?board=<board>` | Accept invitation `<invitation>`, then open a board |

A fragment that starts with `#/` and is not exactly one of these forms is a **bad link**: it
shows the not-found page (interaction v25). Any other fragment, and no fragment, opens the local
board as today. The page reads the fragment when it loads and on every `hashchange`. Opening a
link replaces the local board as reloading the page would; **Close this board** sets the
fragment to empty and opens the local board as at load.

Links the app writes are the page's address without query or fragment
(`location.origin + location.pathname`) followed by the fragment:

- **Copy link** (the board link): `#/b/<board>`. It carries no invitation, ticket or token and
  opens only for people who already have a role on the board.
- **An invitation link**: `#/invite/<invitation>?board=<board>`, where `<board>` is the board
  whose Share dialog made or copied it. The `board` part only chooses where to land; it grants
  nothing. After acceptance the app opens the reply's `boardId` when it is not `null`, else the
  link's `board`; with neither, it opens the local board.

## Signing in

Sign-in uses Supabase Auth's email one-time code through `@supabase/auth-js`'s `AuthClient`,
created once per page with:

| Option | Value |
| --- | --- |
| `url` | `<BOARD_SUPABASE_URL>/auth/v1` |
| `headers` | `{ apikey: <BOARD_SUPABASE_ANON_KEY> }` |
| `storageKey` | `nextphase-board/auth/v1` |
| `persistSession`, `autoRefreshToken` | `true` |
| `detectSessionInUrl` | `false` |

1. The person types an email. The app calls `signInWithOtp({ email, options: { shouldCreateUser:
   false } })`: Supabase sends a 6-digit code to that address and never creates an account. An
   email with no account is refused (Supabase's `otp_disabled`, HTTP 422) and no account is made.
2. The person types the six digits. The app calls `verifyOtp({ email, token, type: "email" })`.
   On success Auth keeps the session.
3. A new code can be asked for 60 seconds after the last one (Supabase sends at most one a
   minute to an address). Each code works for one hour.

There is no password: none is chosen, typed or offered. (Supabase Auth may still store a
password hash it generated; the app never reads or sets one.) Accounts are created only by the
invitation routes (API v4, "Invitations").

**Signing out** calls `signOut()` (all of the person's sessions on this device's Auth client)
from the Board panel. **Sign in again** after an expired or ended session calls
`signOut({ scope: "local" })` and shows the sign-in page.

### Supabase setup the app relies on

- The Magic Link email template carries the code as `{{ .Token }}`; Supabase sends the code only
  if the template does. In this repository, `supabase/config.toml` sets
  `[auth.email.template.magic_link]` with `subject = "Your NextPhase Board sign-in code"` and
  `content_path = "./supabase/templates/magic-link.html"` (the Supabase CLI resolves the path
  from the repository root). The template shows the code, says it works for one hour, and keeps
  the sign-in link (`{{ .ConfirmationURL }}`).
- Sign-ups are off (`enable_signup = false`, as today).
- The Board server's `allowedOrigin` (self-host runner v1) is the web page's exact origin.
- A hosted project's own settings (its template, allowed origins and mail sender) are set by
  its operator, not by this repository.

## What the page keeps on the device

- **The Auth session**, and nothing else, in `localStorage`, under keys that begin with
  `nextphase-board/auth/v1`, written only by `AuthClient`. Every tab of the page's origin shares
  it: signing in, renewal and signing out in one tab reach the others (Auth's own storage
  events).
- **A hosted board is kept in memory only.** While a hosted board, the gate or any other team
  page (interaction v25, "Other pages") is shown, the page opens no IndexedDB database, writes no
  `localStorage` or `sessionStorage` key other than Auth's (Auth JS's own check that
  `localStorage` works, which writes a key starting `lswt-` and removes it at once, is allowed;
  no other key may remain), does not add the board to the local
  board list, does not record it as the last open board, does not change the address's query,
  and takes no local board's writer lock. Storage v3's startup does not run for it.
- Closing the tab loses nothing that was saved: a hosted board's saved state is the room's.

## Opening a hosted board

With a board link, or after an invitation is accepted:

1. **Signed out:** the gate (interaction v25); after sign-in, step 2.
2. `GET /boards/:board` (the board's details). 404 shows the not-found page; 401 shows
   **Sign-in expired**. The workspace's name is the `name` of the entry of `GET /workspaces`
   whose `id` is the details' `workspaceId` (`"Workspace"` if none matches). The details'
   `role` is the person's role on the board; `owner` means the workspace owner.
3. **Join.** `POST /boards/:board/join-tickets`, then a WebSocket to
   `<server WebSocket origin>/boards/:board/join?ticket=<ticket>`, through `BoardSession.join`
   from `nextphase-board-sync/session.ts` (sync v4, "The shared client"). Until the first
   `joined`, the page shows "Opening board…".
4. `joined` shows the board through the existing scene. The badge shows the workspace's name.

A step that fails is handled as "When joining fails" says.

### When joining fails

A **join attempt** is steps 2 and 3: the details, the workspace list, the ticket, the WebSocket
and its `joined`; for an invitation link that has not yet been accepted in this page, it starts
with the acceptance (safe to retry, API v4, so a lost reply is simply asked again). It happens when the board is first **opened** (nothing of it on screen yet) and
whenever an open board **reconnects** (after a close, or when the shared client reports
`join_failed` because its own rejoin after a refused edit failed). A browser cannot read why a
WebSocket upgrade was refused (API v4 answers 401, 403 or 429 before the upgrade; the page sees
only an error and close 1006), so when the WebSocket fails before `joined` the app asks for the
board's details once more and goes by that answer. A failed attempt is classified by the first
answer that failed.

**Time limits.** Every request to the Board server (each route call of the attempt, and every
other call the app makes) is abandoned after 15 seconds without an answer, and counts as "no
answer". A join attempt that has no outcome 15 seconds after it started (for example a
connection that opens and never sends `joined`) is abandoned the same way: its connection is
closed with code 1000, and anything it reports later is ignored.

| Answer | Opening | Reconnecting |
| --- | --- | --- |
| 401 | **Sign-in expired** (on the gate) | **Sign-in expired** dialog |
| 404 | The not-found page (for the acceptance: Unknown invitation) | **Access removed** dialog |
| 410, 403 `invitation_email_mismatch` (the acceptance) | Its message on the not-found page | (cannot happen: acceptance is only while opening) |
| 400 `invalid_label` (the ticket route) | The **Can't join** page | **Can't join** page in place of the board |
| 403 `account_disabled` | The **Account disabled** page | **Account disabled** page in place of the board |
| 503 `room_locked` or `access_log_pruned` | The **Restoring** page, and try again | The board stays, view only, with the **Restoring** banner, and try again |
| No answer, any other status (503 `service_unavailable` included), the details succeeding after a failed WebSocket, or `join_failed` | The **Can't open** page, and try again | The board stays, view only (**Offline — view only**), with the **Reconnecting** banner, and try again |

"Try again" means a new join attempt after 2 seconds, the wait doubling after each failed
attempt up to 30 seconds; a `joined` resets it. Retries stop when the board is closed, when a
page or dialog that ends the board is shown, or when the person signs out. A page that tries
again shows the board as soon as an attempt succeeds.

An invitation link, signed in, first calls `POST /invitations/:invitation/accept`; a 200
continues at step 2 with the board chosen as "Links" says, and every failure is handled by
"When joining fails".

## Editing and saving

Every editing command of the existing app works on a hosted board as on a local one, except
those interaction v25 removes ("The Board panel" and "The palette and editing on a hosted
board"), and each change is sent to the room at once:

- **One edit per change.** Each change the app would make to a local board (each call that
  changes the board document) becomes one `BoardSession.edit(board)`. A change that leaves the
  board as it was sends nothing.
- **Typing is one undo step.** From the moment a text session starts on a note, shape or text
  (the existing text session) until it ends, every change it makes is sent at once, each with
  the same group (sync v4, "Grouped edits"), so Undo takes the whole session back in one step,
  as on a local board. Each text session uses a new group.
- **Undo and Redo** call `BoardSession.undo()` and `redo()`, never the local history. When the
  answer is not a request ID: `nothing_to_undo` keeps Undo's existing "Nothing to undo."
  (Redo's "Nothing to redo."); `changed_by_others` and `undo_invalid` show the toast "Someone
  else changed that, so it was not undone." (or "…not redone.") and send nothing; `role_too_low`
  and `join_required` do nothing.
- **Images** are not on hosted boards (sync v4 still refuses them): the Image button is absent,
  and its keys and pasted or dropped files do nothing. Pasting objects works as on a local board.
- **The board's title** is not editable on a hosted board (renaming is later work); the Board
  panel shows it read-only.

### Save states

The save panel shows one of these, in this order of precedence:

| State | When |
| --- | --- |
| **Offline — view only** | No open room connection (before the first `joined`, after a close, while retrying) |
| **Not saved** | A request was `refused` or `dropped` since the person's last deliberate edit |
| **Saving…** | A request is `sent` or `received` |
| **View only** | The person's role is `viewer` |
| **Saved** | Otherwise: every request is `saved` |

`Saved` means only the room's `saved`: a request that is `sent` or `received` is never shown as
saved. **Not saved** stays until the person's next deliberate edit (an edit, undo or redo that
sends a request) or a reload; that edit clears the old `refused` and `dropped` requests from
the count.

### No resending after a disconnect

When the connection closes, every request not yet `saved` becomes `dropped` (sync v4, "The
shared client"). The web client does **not** send them again. On rejoin the board on screen is
the room's board from the new `joined`: a dropped change is on screen afterwards only if the room
had saved it (its `saved` may have been lost with the connection). The **Not saved** state comes
from the requests alone: after a close with no request `sent` or `received`, the rejoined board
shows **Saved** (or **View only**). The fact that a request was refused or dropped is kept by
the hosted board across rejoins (each rejoin may use a new `BoardSession`), so **Not saved**
stays until the next deliberate edit. Sync v4's "Waiting edits" allows a client to resend; this
client does not. Keeping or recovering unsaved work is later work.

### A refused edit

When the room answers an edit with `refused`, the shared client takes it back by rejoining
(sync v4). The status becomes **Not saved** and the toast says "That change wasn't saved:
<reason>." (the refusal's reason with each `_` replaced by a space).

## Staying signed in on an open board

The room connection lasts until its token's `exp` unless renewed (identity v3, "Renewal on an
open room connection"). The web client renews it without the shared client's help:

- **Every newer token is sent.** When Auth reports a session (on sign-in, refresh, or a change
  in another tab) whose access token expires later than the one the connection holds, the app
  sends `{ "kind": "renew", "token": <the new access token> }` on the open connection and the
  connection now holds that expiry. The room's `renewed` acknowledges it.
- **A fallback timer.** After each join and each renewal, a timer fires when
  `min(60 seconds, half the remaining lifetime)` is left before the held token's `exp`. If Auth
  already has a later token, it is sent; otherwise the app asks Auth to refresh the session
  (`refreshSession()`), and the newer token is sent when Auth reports it.
- **Never inside Auth's callback.** Work started from an `onAuthStateChange` callback is
  queued (for example with `queueMicrotask`) and never awaits an Auth call inside the callback,
  which holds Auth's lock.
- **Expiry.** A close with 4401, or a 401 from any route, shows **Sign-in expired**. Editing
  stops until the person signs in again.
- **Signed out elsewhere.** When Auth reports `SIGNED_OUT` that this tab did not ask for
  (another tab signed out, or Auth ended the session), the room connection is closed and
  **Signed out** is shown. In the tab where the person chose Sign out, the connection is closed
  and the gate is shown for the same link.

## Closes and refusals

| Event | What the app does |
| --- | --- |
| Close 4401 | **Sign-in expired** |
| Close 4403 | Stop editing at once and reconnect (a new join attempt at once, then as "When joining fails"): a role remains, so the board rejoins with the new role (a person lowered to `viewer` sees it view only); a 404 shows **Access removed** |
| Close 4409 or 1012 | Reconnect at once |
| Close 4423 | The **Restoring** banner, view only, and reconnect as "When joining fails" says for 503 |
| Close 1013 | The **Board full** page in place of the board |
| Any other close (1000, 1001, 1006 and others) | **Offline — view only**, the **Reconnecting** banner, and reconnect after 2 seconds as "When joining fails" says |
| `join_failed` from the shared client | As a failed reconnect attempt |
| `SIGNED_OUT` from Auth, not asked for by this tab | **Signed out** |
| A refused edit | As "A refused edit" says |

**One outcome per attempt.** A close code in this table (1012, 1013, 4401, 4403, 4409, 4423) is
handled by this table whether it arrives before or after `joined`; "When joining fails" applies to
a WebSocket that ends before `joined` only when its close carries none of these codes. Each join
attempt has exactly one outcome: the shared client may report a close and then reject the join
(or report `join_failed`) for the same attempt, and the later report changes nothing. Once a
page or dialog that ends the board is shown, later events change nothing and no retry starts.

## Messages

The named states above, with the exact words (interaction v25 says where each appears):

| Name | Words |
| --- | --- |
| Not found (API 404, a bad link) | "This board doesn't exist, or you don't have access to it." |
| Sign-in expired | "Your sign-in has expired. Sign in again to keep editing." |
| Signed out | "You signed out. Sign in again to keep working on this board." |
| Access removed | Title "You no longer have access to this board", then "The owner of <workspace> removed your access. Edits you made after that were not saved." |
| View only | "You can view this board. Ask the owner of <workspace> if you need to edit it." |
| Restoring | "This board is being restored. It will be back shortly." |
| Board full | "This board has the most people it can hold (50). Try again later." |
| Can't open | "Can't open this board right now. Trying again…" |
| Reconnecting | "Reconnecting… You can look around; editing comes back when the board does." |
| Invitation expired, used, cancelled (410) | "This invitation has expired. Ask the owner for a new one." / "This invitation was already used. Ask the owner for a new one." / "This invitation was cancelled. Ask the owner for a new one." |
| Invitation for another email (403 `invitation_email_mismatch`) | "This invitation is for another email address. Sign in with that one." |
| Unknown invitation (404) | As Not found |
| Account disabled (403 `account_disabled`) | "This account can't open boards right now. Ask the owner of the workspace." |
| Can't join (400 `invalid_label`) | "This board can't be opened with this account's email address." |
| Owner only (403 `role_too_low` with `needed` `owner`) | "Only the owner of <workspace> can invite people and change who has access." |
| Guest still holds grants (409 `guest_has_grants`) | "Remove this person's board access before removing them from the workspace." |
| Refused edit | "That change wasn't saved: <reason>." |
| Any other refusal from a Share action | "That didn't work: <reason>." |

`<workspace>` is the workspace's name; `<reason>` is the reply's reason with each `_` replaced
by a space.

## Verification

The 0003-W4 brief's unit tests and browser checks cover this contract: the switch and its
settings, the page policy, the links, the storage rules, the save states and their precedence,
renewal before expiry across two tabs, the close table and the messages.

## Public references

Retrieved 2026-11-01: [Supabase passwordless email logins](https://supabase.com/docs/guides/auth/auth-email-passwordless)
(the code needs `{{ .Token }}` in the Magic Link template; one request a minute; codes last
up to an hour; `shouldCreateUser`),
[Supabase JavaScript `signInWithOtp`](https://supabase.com/docs/reference/javascript/auth-signinwithotp),
[`verifyOtp`](https://supabase.com/docs/reference/javascript/auth-verifyotp) and
[`onAuthStateChange`](https://supabase.com/docs/reference/javascript/auth-onauthstatechange)
(do not await Auth calls inside the callback), and
[MDN: WebSocket close event](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket/close_event)
(a failed connection reports close code 1006 with no reason).
