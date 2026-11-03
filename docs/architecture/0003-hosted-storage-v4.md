# 0003 — Hosted boards in the web app

CONTRACT VERSION: 0003 hosted storage v4 (2026-11-03)

Status: Draft for 0004-W2 v1. When accepted it replaces
[hosted storage v3](0003-hosted-storage-v3.md) for later work. Every rule of v3 (and through it
v2 and v1) still applies except where this version changes it.

This version **recovers a hosted board's unsaved edits after an interruption**. When the room
connection drops while edits are unanswered, the board stays view only and shows how many changes
are waiting. On rejoin the changes are sent again and saved (shared client, [sync v5](0003-sync-v5.md),
"Recovering after an interruption"). When they cannot be sent again, a notice says how many and
why. While changes wait, leaving the board asks first.

Where each state, notice and question appears, its look and its words are in
[interaction v29](0001-interaction-v29.md). The module layout is
[web modules v27](0001-web-modules-v27.md)'s, unchanged. The server's side is
[sync v5](0003-sync-v5.md) (one new `joined` field); [access v4](0003-access-v4.md),
[API v4](0003-api-v4.md), [identity v3](0003-identity-v3.md),
[hosted persistence v3](0003-hosted-persistence-v3.md) and [presence v1](0004-presence-v1.md) are
unchanged.

With team features off nothing here applies.

## One session per open board

A hosted board keeps one `BoardSession` from the moment it opens until it is stopped (left, closed
or ended). Every reconnect in v1's "Closes and refusals" and "When joining fails" uses that
session's `reconnect()`. It never builds a new session, so the session keeps its waiting requests
across rejoins. Stopping the board calls the session's `close()`. Retry waits (2, 4, 8, 16, 30,
30… seconds) and the 15-second join limit are v1's, unchanged.

## Noticing a drop

The board's connection counts as dropped, and the board becomes view only, when any of these
happens:

- the connection closes (v1, "Closes and refusals");
- the shared client reports its progress deadline (sync v5, "The progress deadline"); this is
  handled as "Any other close";
- the window's `offline` event fires while the board has an open connection. The app then calls
  the session's `interrupt()` and handles it as "Any other close". The event is only a hint: the
  app never reads `navigator.onLine`, and it retries through the normal ticket path whether or not
  the browser says it is online.

A silent connection with no unanswered edit is noticed only when it closes or the `offline` event
fires. Nothing needs saving then.

## Counting changes

A **change** is what the person did, not a message: requests that carry the same edit group
(sync v4, "Grouped edits": typing in one note, one name entry) count as **one** change, and each
request without a group counts as one change. A change with requests in more than one count below
counts once in each.

A **deliberate edit** is a request the person's own edit, undo or redo creates. A request the
session sends again during recovery is not a deliberate edit. The **loss record** holds the losses
counted below. It is cleared when a deliberate edit **created after the newest loss in the record**
is answered `saved`, and when the board is left. A recovery's own `saved` answers never clear it.

Every count on screen counts changes this way:

- **waiting**: changes with an outstanding request (`sent`, `received` or `waiting`);
- **not confirmed, by reason**: for each of `board_restored`, `access_changed`, `access_removed`,
  `signed_out` and `sign_in_expired`, the changes with a request the shared client dropped with
  that reason that are in the loss record. The **not-confirmed count** is the number of changes
  with any of these five reasons;
- **not kept**: changes with a request marked not kept (sync v5, "Recovering after an
  interruption", step 3.2) that are in the loss record;
- **recovered**: the changes among the requests the session sent again, when it reports
  `recovered`.

## Save states

v1's "Save states" is replaced. The save panel shows the first of these that applies, at every
moment, during recovery too:

| State | When |
| --- | --- |
| **Not saved** | The loss record holds a request that was `refused`, or `dropped` with any reason other than the five not-confirmed reasons and `session_ended` (for example `refused_edit`) |
| **Not confirmed** | The not-confirmed count is above 0 |
| **Offline — N changes waiting** | No open room connection and the waiting count N is above 0 ("Offline — 1 change waiting" when N is 1) |
| **Offline — view only** | No open room connection and nothing waiting |
| **Saving…** | A request is `sent` or `received` (including requests sent again) |
| **View only** | The person's role is `viewer` |
| **Saved** | Otherwise |

**Saved** still means only the room's `saved`. **Not saved** and **Not confirmed** last as long as
the loss record holds their losses. Sending the next deliberate edit is not enough to clear them:
it must be saved. A not-kept change does not change the state, because its request was saved (the
delete won).

## Rejoining with waiting changes

When the board rejoins, the session compares the new `joined` (sync v5):

| Outcome | What the app shows |
| --- | --- |
| Sent again and saved (`recovered`) | The state follows the table; the toast "Back online. Your change was saved." (recovered count 1) or "Back online. Your changes were saved." (above 1). With nothing sent again there is no `recovered` and no toast |
| Some sent again were not kept | The not-kept notice with the not-kept count, as well as the toast |
| `board_restored` | The restored notice with the `board_restored` count; the state **Not confirmed** |
| `access_changed`, still a role | The access-changed notice with the `access_changed` count; the state **Not confirmed**; a viewer then also sees v1's View only banner |

**When editing comes back.** While the session is recovering (sync v5), the board stays view only:
the toolbar shows only Select and Pan. After a rejoin that leaves the session not recovering
(a fenced outcome, or nothing waiting), and when it reports `recovered`, the board is editable at
once for an owner or editor, and stays view only for a viewer.

**The selection is cleared** whenever a `joined` board replaces the board on screen (every
rejoin), so that no object that the room's board lacks stays selected.

## Endings with waiting changes

v1's "Closes and refusals" applies, with these changes:

| Event | What the app does |
| --- | --- |
| Rejoin answered 404 (after a 4403 or any drop) | `discard("access_removed")`, then v1's **Access removed** with the count sentence (interaction v29) |
| Close 4401, or a 401 from a route, or renewal refused or failed | `discard("sign_in_expired")`, then **Sign-in expired** with the count sentence |
| `SIGNED_OUT` from Auth, not asked for by this tab | `discard("signed_out")`, then **Signed out** with the count sentence |
| A rejoin refused with 403 `account_disabled` | `discard("access_removed")`, then v1's account-disabled page, its words followed by a space and the count sentence |
| Close 1013 (board full), or a rejoin refused with 400 `invalid_label`, **while changes wait** | Not an ending: **Offline — N changes waiting**, the Reconnecting banner with the count, and the next attempt after v1's retry wait. With nothing waiting, v1's rule (the Board full or Can't join page) is unchanged |

**One ending.** v1's "One outcome per attempt" applies to these endings too: the first of them
to arrive wins, the waiting changes are discarded with its reason, and a later one changes
nothing. A failed renewal that Auth follows with `SIGNED_OUT` therefore shows **Sign-in expired**
when the failure is reported first (a 401, a 4401 close or the refused renewal), and **Signed out**
when Auth's `SIGNED_OUT` arrives first.

The count sentence uses the count of the ending's own reason (`access_removed`, `sign_in_expired`
or `signed_out`), and is left out when that count is 0. After an ending, no Reconnecting banner is
shown, because nothing will reconnect.

A token that Auth renews during a drop does not end the waiting work: the next ticket uses the
renewed token, and the changes are sent again if "Recovering after an interruption" allows it.

## Leaving while changes wait

While the waiting count is above 0 (including edits sent on an open connection that are not yet
answered), every way of leaving the open board **in this tab** asks the **leave question**
(interaction v29) first:

- **Back to files**, and **Close this board** wherever it shows;
- **Sign out** in this tab's Board panel. Leave anyway then signs out as v1 says;
- **a change of the address's fragment** (the browser's Back or Forward, or a typed or followed
  `#/…` link). The board stays open and on screen. The app puts the board's own link back with
  `history.pushState` (no reload, no new board session) and asks. The browser's history may
  hold the board's link one extra time afterwards.

**While the question is open**, its count follows the waiting count. When the count reaches 0
(the changes were saved, or a fence or ending dropped them), the question closes as Stay does: the
person stays on the board, a pending fragment change is not made, and any notice or ending dialog
that the same event brought then shows. No ending dialog opens over the question.

**Leave anyway** stops the board as v3 says ("Leaving a hosted board"), which ends its session,
and then goes where the person was going: Home for Back to files and Close this board, the gate
for Sign out, and for a fragment change the fragment the person was going to. The waiting changes
are not sent, and are gone from this tab. **Stay on this board**, and Escape,
close the question and change nothing.

**Closing or reloading the tab**, or going to another site, while the waiting count is above 0:
the page's `beforeunload` handler calls `preventDefault()` and sets `returnValue` to `""`, so the
browser asks with its own words. With nothing waiting, the handler does nothing. Browsers show
this only after the person has interacted with the page, and not reliably on mobile (MDN,
`beforeunload`).

With nothing waiting, every way of leaving works as in v3, with no question.

## What the page keeps on the device

v2's section applies unchanged. Waiting changes, their counts and the notices are in memory only:
a reload, a tab close or a crash loses them.

## Notices

A **not-saved notice** reports changes that a rejoin could not save, one notice per reason, each
with its count:

| Reason | Words |
| --- | --- |
| `board_restored` | "This board was restored to an earlier version, so N changes may not have been kept." ("…so 1 change may not have been kept.") |
| `access_changed` | "Your access changed while you were offline, so N changes may not have been saved." ("…so 1 change may not have been saved.") |
| not kept | "Someone deleted what you changed while you were offline, so N changes weren't kept." ("…so 1 change wasn't kept.") |

Each notice shows its own reason's count ("Counting changes"). A notice stays until its
**Dismiss** or until the loss record is cleared (a later deliberate edit saved, or the board left).
A new loss for a reason whose notice was dismissed shows that notice again, with the reason's
count. Dismiss hides
that notice only. It does not change the save state.

## Messages

v3's table applies, with these added and changed (interaction v29 says where each appears). "N
changes" is "1 change" when N is 1, with the verbs as shown in brackets:

| Name | Words |
| --- | --- |
| Offline with changes waiting (status) | "Offline — N changes waiting" ("Offline — 1 change waiting") |
| Reconnecting with changes waiting (banner) | "Reconnecting… N changes are waiting and will be saved when the board is back. You can look around until then." ("1 change is waiting") |
| Reconnecting with nothing waiting | v1's words, unchanged |
| Not confirmed (status) | "Not confirmed" |
| Recovered (toast) | "Back online. Your change was saved." / "Back online. Your changes were saved." |
| Access removed, with changes | Title as v1; body "The owner of <workspace> removed your access before N changes were confirmed, so they may not have been saved." ("…before 1 change was confirmed, so it may not have been saved.") |
| Sign-in expired, with changes | v1's words, a space, then "N changes may not have been saved." ("1 change may not have been saved.") |
| Signed out, with changes | v1's words, a space, then the same sentence |
| Account disabled, with changes | v1's words, a space, then the same sentence |
| Leave question | Title "Leave before your changes are saved?" ("…your change is saved?"); body "N changes to “<board>” haven't been confirmed yet. If you leave now, they may be lost." ("1 change to “<board>” hasn't been confirmed yet. If you leave now, it may be lost."); buttons **Leave anyway** and **Stay on this board** |
| Dismiss | "Dismiss" |

`<board>` is the board's title as the Board name field shows it.

## Verification

The 0004-W2 brief's unit tests, server checks and browser checks cover this version. The 0003-W4
brief's checks still cover v1, with the 0004-W2 brief's amendment of W4-S14 (a change in flight
during a restart is now saved). The 0003-W5 and 0004-W3 briefs' checks still cover v3 and
presence.

## Public references

Retrieved 2026-11-02: [MDN: `Window: beforeunload` event](https://developer.mozilla.org/en-US/docs/Web/API/Window/beforeunload_event)
(the browser's own words, a prior user interaction, mobile limits),
[MDN: `Navigator.onLine`](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/onLine) and
[MDN: `History.pushState()`](https://developer.mozilla.org/en-US/docs/Web/API/History/pushState).
