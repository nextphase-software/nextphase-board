# 0001 — Interaction and browser contract

Contract version: 25 (for 0003-W4 brief v1, 2026-11-01). Status: Draft. When accepted it
replaces [interaction v24](0001-interaction-v24.md) for later work. Uses
[document v11](0001-document-v11.md), [storage v3](0001-storage-v3.md),
[board file v2](0006-board-file-v2.md), the
[activity catalogue contract](0008-activity-catalogue-v1.md) and
[0003 hosted storage v1](0003-hosted-storage-v1.md).

Every rule in v24 (and, through it, v23 back to v4 and the 0001-W3 presentation) still applies
except where this version replaces or adds to it. This version adds **team features**: signing
in, opening a **hosted board** by its link, the **Share** dialog, and the hosted save states and
messages. Hosted storage v1 defines the behaviour (the switch, links, session, saving, closes
and the words of every message); this contract says where each control and message appears and
how it is used.

**With team features off nothing in this contract applies**: the page's markup, focus order,
keys, drawing and saved records are v24's exactly.

## Terms

A **hosted board** is a board opened by a board or invitation link (hosted storage v1,
"Links"); every other board is a **local board**. A hosted board is **view only** when the
person's role is `viewer` or there is no open room connection. **The workspace** is the hosted
board's workspace and **<workspace>** its name. **Owner**, **editor**, **viewer** and **guest**
are access v4's roles; their words on screen are **owner**, **can edit**, **can view** and
**guest**.

A **team dialog** is a native `<dialog>` opened with `showModal()`: the sign-in dialog, Share,
and the dialogs that end a board. A **page** replaces the whole board screen (no canvas, no
floating panels): the gate, Opening, Can't open, Board full and the not-found page.

## The save panel

The save panel (top right) keeps its place and its status first.

- **A local board, signed out:** after the Save button, a **Sign in** button (accessible name
  "Sign in"). Activating it opens the sign-in dialog. Signed in, a local board's save panel is
  as in v24.
- **A hosted board:** no Save button (every change is sent). The status reads the save state of
  hosted storage v1 (**Saving…**, **Saved**, **View only**, **Offline — view only**,
  **Not saved**); **Offline — view only** is drawn in amber. The panel ends with a purple
  **Share** button (accessible name "Share"), which opens Share.

Later, presence avatars go before the status (not in this version).

## The file bar

On a hosted board the small grey label after the board's name shows **<workspace>** where a
local board shows **Local**. The Board button, Objects, Undo and Redo are unchanged; Undo and
Redo act on the shared client's steps (hosted storage v1, "Editing and saving").

## The Board panel

- With team features on and a person signed in, the Board panel starts with a row "Signed in
  as <email>" and a **Sign out** button, above the board's name. Sign out signs out (hosted
  storage v1) and, on a hosted board, shows the gate.
- On a hosted board the name field is read-only; **Save a copy to file** stays and writes the
  board as it is on screen (board file v2); **Open board file…**, **Reopen**, the local board
  list and the sentence about browser storage are not shown. The page's local notice is not
  shown on a hosted board.

## The palette and editing on a hosted board

- **Editors and owners** have every tool and command of a local board, except images: the
  Image button is not shown, and its keys, pasted files and dropped files do nothing. Pasting
  objects works.
- **View only** (a viewer, or no open connection): the bottom toolbar shows only **Select** and
  **Pan**; Templates and the Image button are not shown; the armed tool becomes Select. Every
  editing command, key and context-bar control is unavailable exactly as in a read-only tab
  (v24 and earlier), and nothing is sent.
- A **banner** sits at the top centre of the board area, above the canvas and below the top
  panels, with `role="status"`: for a viewer "View only" from hosted storage v1's messages; with
  no open connection "Reconnecting…" (amber), or "Restoring" while the room is locked. Below
  1,100 CSS pixels wide it moves below the top panels and is at most the window's width minus
  24 CSS pixels.
- A **toast** sits at the bottom centre, above the bottom toolbar, with `role="status"`, and
  disappears after 5 seconds or when another replaces it.

## Signing in

**The sign-in dialog** (a team dialog, at most 400 CSS pixels wide and never wider than the
window minus 24 CSS pixels):

1. **Email step.** Title "Sign in to NextPhase Board"; "We'll email you a 6-digit code. There is
   no password."; a label "EMAIL" and an email field (`id="team-email"`, placeholder
   "you@example.com", `autocomplete="email"`); a full-width **Continue with email** button,
   unavailable while the field is blank or a request is running; then "Only people invited to
   Board can sign in. Your local boards stay on this device either way." A close button
   "Close sign in" (×) ends the dialog.
2. **Code step.** Title "Check your email" with a back button "Change email" (‹) that returns to
   the email step; "Enter the 6-digit code we sent to <email>. It works for one hour."; six
   one-digit boxes with accessible names "Digit 1" to "Digit 6" (`inputmode="numeric"`, the first
   with `autocomplete="one-time-code"`). Typing a digit moves to the next box; Backspace in an
   empty box moves to the previous one; pasting or typing several digits fills from that box on
   (non-digits ignored, at most six). **Sign in** is available only when all six boxes hold a
   digit. Below it: "No email? Check spam, or resend the code in <n> s." counting down from 60,
   then "No email? Check spam, or resend the code." where "resend the code" is a button. Focus
   starts in Digit 1.
3. On success the dialog closes and the save panel's Sign in goes away.

Errors appear in the dialog with `role="alert"`, in place of nothing else:

| Answer | Words |
| --- | --- |
| No account for the email (`otp_disabled`) | "There is no Board account for this email. Ask the owner of a board to invite you." |
| Wrong or expired code | "That code is wrong or has expired. Check it, or send a new one." |
| Too many requests (HTTP 429) | "Wait a minute before asking for another code." |
| Anything else, or no answer | "Could not sign in. Try again." |

**The gate** is a page shown when a board or invitation link is opened signed out: the brand
mark, the title "Sign in to open this board", "Only people invited to it can open it.", then the
same email and code steps as the dialog, without a close button. After a successful sign-in the
link opens (hosted storage v1, "Opening a hosted board"). Nothing of the board is shown behind
it.

## Other pages

All are centred on a plain background, with the same card as the gate.

| Page | Shows |
| --- | --- |
| Opening | "Opening board…" |
| Can't open | "Can't open" from hosted storage v1's messages, while it tries again |
| Restoring | "Restoring", while it tries again, with **Close this board** |
| Not found | "Not found", or an invitation's message, with **Sign in as someone else** (signs out and shows the gate for the same link) and **Close this board** |
| Board full | "Board full", with **Close this board** |
| Can't join | "Can't join", with **Sign in as someone else** and **Close this board** |
| Account disabled | "Account disabled", with **Sign in as someone else** and **Close this board** |

A page that tries again shows the board by itself as soon as an attempt succeeds (hosted storage
v1, "When joining fails").

## Share

**Share** is a team dialog (at most 480 CSS pixels wide, never wider than the window minus 24
CSS pixels), placed below the save panel at the right (70 CSS pixels from the top, 12 from the
right; below 768 CSS pixels wide, 128 from the top). Its content scrolls inside it when it is
taller than the window minus 100 CSS pixels. Its accessible name is its title.

### As the owner

**Header:** title "Share this board"; a **Copy link** button ("↗ Copy link") that copies the
board link; a close button "Close sharing" (×).

**Invite:** a field (accessible name and placeholder "Add an email to invite") and an
**Invite** button, available when the field is not blank. When the field holds text, a role
picker (a `<select>`, accessible name "Invitation role") appears inside the field at its right,
with **can edit** (the default) and **can view**. Invite creates a board invitation (`POST /boards/:board/invitations`),
copies its link, empties the field, marks the new row "✓ Link copied", and shows the toast
"Invitation link copied. Send it to <email> yourself." If the reply has `accountCreated: false`,
the dialog also says "The invitation was saved, but Board could not create a sign-in account for
<email>. Cancel it and invite again."

**Who has access** (a heading), broadest first:

1. **The workspace row**, a button: an icon, "People from <workspace>" over the grey line
   "Workspace editors and viewers", and "can access ›" at the right. It opens the workspace view.
2. **The owner**: a row with the avatar (first letter of the email), the part of the email
   before its last `@` with " (you)" on your own row, the email below in grey, and **owner** at
   the right, with no menu.
3. **One row per grant on this board** (`GET /workspaces/:workspace/grants`, rows of this
   board), in the order the server lists them: avatar, name, then a grey line with the email and
   where the role comes from: "this board", or "also editor in <workspace>" or "also viewer in
   <workspace>" when the person also has that workspace role (a guest's workspace role gives no
   board role, so a guest's line reads "this board"). At the right, the **role menu**: its button shows the higher of the two roles.

**Invited** (a heading, only when there are any): one row per pending invitation of this board
(not accepted, not cancelled, not expired): a mail icon, the email, and "Invited to this board ·
<role words> · expires in <n> days" (n rounded up, at least 1); then **Copy link** (the
invitation link; it reads "✓ Link copied" after copying) and **Cancel** (`DELETE
/invitations/:invitation`, then the row goes).

**Footer**, after a rule: "Only people invited to this board and editors and viewers of
<workspace> can open it. Board does not send email: copy each invitation link and send it
yourself."

### The workspace view

The workspace row replaces the dialog's content with the workspace view; Escape or the back
button "Back to board access" (‹) returns to the main view.

- Title "People from <workspace>", no Copy link.
- "Editors and viewers of <workspace> can open every board in it. Guests open only the boards
  shared with them."
- The invite field "Add an email to invite to <workspace>" with the same role picker (can edit,
  can view) and Invite: it creates a workspace invitation (`POST
  /workspaces/:workspace/invitations`) and behaves as above.
- **Members** (a heading): one row per member (`GET /workspaces/:workspace/members`): avatar,
  name, email; a guest's grey line adds "guest, only boards shared directly"; the owner's row
  shows **owner**; others have the role menu with **can edit**, **can view**, **guest** and
  **Remove**.
- **Invited**: the pending workspace invitations, as above, with "Invited to the workspace".

### The role menu

A button showing the role words and "⌄"; activating it opens a menu (`role="menu"`) under it:
the role choices as `menuitemradio`, the current one ticked (✓), then, after a rule, **Remove**
(`menuitem`, red). In the main view the menu changes the **grant** (`PUT` or `DELETE
/boards/:board/grants/:person`) and the tick marks the grant's role; in the workspace view it
changes the **workspace role** (`PUT` or `DELETE /workspaces/:workspace/members/:person`). The
menu closes when a choice is made, on Escape (focus returns to its button) or when focus leaves
it. While a request runs, every menu and button that changes access is unavailable.

After a change: the toast "Takes effect within a minute" when the reply's `removal` is
`pending`, otherwise "Access updated."; the lists are read again. A row whose `role` is `null`
reads "Removing · takes effect within a minute" in its grey line and has no menu; while any row
is pending and the dialog is open, the lists are read again every 2.5 seconds. A refusal shows its
message (hosted storage v1, "Messages") in the dialog with `role="alert"`.

**No answer.** When a Share request gets no answer (hosted storage v1, "Time limits", or a
network error), the dialog says "No answer from the server. Check the list before trying again."
with `role="alert"`, every control is available again, the rows already shown stay, and the
lists are read once more. A change, an invitation or a cancellation is never sent again by
itself: an invitation that the server did record appears in Invited after that read, with its
Copy link. A failed read of the lists keeps the rows already shown and shows the same message.

### As an editor or viewer

Title "Share this board" with Copy link and the close button; one row for yourself (avatar,
name " (you)", email, and your role words at the right, no menu); then, after a rule, "Only the
owner of <workspace> can invite people and change who has access." No list of other people, no
invite field. No list route is called.

### Copying

Copy link and every invitation link use the asynchronous Clipboard API's `writeText`. Copy link
shows the toast "Board link copied.". If writing fails, the dialog says "Could not copy the link.
Select and copy it below." and shows a read-only field "Link to copy" holding the link,
selected when focused.

## Dialogs that end a board

Team dialogs over a dimmed board, at most 420 CSS pixels wide:

| Dialog | Title | Body | Buttons |
| --- | --- | --- | --- |
| Access removed | "You no longer have access to this board" | The rest of "Access removed" | **Close this board** |
| Sign-in expired | "Sign in again" | "Sign-in expired" | **Sign in again**, **Close this board** |
| Signed out | "Sign in again" | "Signed out" | **Sign in again**, **Close this board** |

**Sign in again** shows the gate for the same board; **Close this board** opens the local
board (hosted storage v1, "Links"). Escape and the close button (×, "Close this board") do
what Close this board does.

## Focus and keys in team dialogs

- On opening, focus goes to the first field, or else the first button. Tab and Shift+Tab move
  only among the dialog's enabled, visible controls and wrap from last to first and first to
  last.
- Escape closes an open role menu first; otherwise it leaves the workspace view; otherwise it
  closes the dialog (for the sign-in dialog and Share; for dialogs that end a board, as above).
- No key pressed inside a team dialog reaches the page's own key handling: Delete, arrows,
  Undo, Redo, tool letters and the other board keys do nothing to the board while a team dialog
  is open.
- On closing, focus returns to the control that opened the dialog (Sign in, Share), if it is
  still on the page.

## Not in this version

Dark mode (the app has none), presence on screen, creating, renaming and listing hosted boards,
Google or single sign-on, public links, and sharing by anyone but the owner.

## Verification boundary

The 0003-W4 brief's browser checks run in Chrome at 1280 × 800 against the local Supabase stack
and the Node server. Narrow-window placement, Safari and other browsers are checked only as the
maintainer asks.
