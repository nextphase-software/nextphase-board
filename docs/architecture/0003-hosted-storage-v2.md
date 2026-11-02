# 0003 — Hosted boards in the web app

CONTRACT VERSION: 0003 hosted storage v2 (2026-11-02)

Status: Draft for 0004-W3 v1. When accepted it replaces
[hosted storage v1](0003-hosted-storage-v1.md) for later work. Every rule of v1 still applies
except where this version changes it. It changes two things for presence on screen
([interaction v26](0001-interaction-v26.md)): the page may keep one setting on the device, and a
refused presence is told apart from a refused edit. The server's side, the shared client and
every saved format are unchanged: [sync v4](0003-sync-v4.md) and
[presence v1](0004-presence-v1.md) still govern them.

## What the page keeps on the device

v1's section applies, with one more key allowed in `localStorage`:

- **`nextphase-board/presence/show-cursors/v1`**, the **Show other people's cursors** switch
  (interaction v26), with the value `"true"` or `"false"`. It is written only when the person
  flips the switch (from the people menu or its shortcut) and read when a hosted board opens; a
  missing key, any other value, or a `localStorage` that throws reads as on. When writing throws,
  the switch keeps its state in memory for this tab. It is per origin and browser profile, shared
  by every hosted board; a tab already open keeps its own state when another tab writes the key.
  It holds no board data, name or person.

Every other rule of v1's section stands: no IndexedDB database, no `sessionStorage` key, no
other `localStorage` key except Auth's (and Auth's own `lswt-` check), and a hosted board is kept
in memory only.

## Closes and refusals

v1's table applies, with its last row narrowed and one row added:

| Event | What the app does |
| --- | --- |
| A refused edit: `refused` carrying a `requestId` | As v1's "A refused edit" says (Not saved, the toast, the shared client rejoins) |
| A refused presence: `refused` with no `requestId` and the reason `presence_too_large`, `presence_fields`, `presence_selection_limit` or `bad_presence`, from the room or from the shared client's own check | Nothing: no toast, no change to the save state, the connection or the tools, and no reload of the board. The next presence is sent as usual |

Any other `refused` keeps v1's behaviour. A refusal the room cannot tie to presence (for example
`message_too_large`, for a message over the room's frame limit) is not a refused presence; the
page's presence stays far below that limit (presence v1 caps it at 12 KiB and 250 IDs).

## Presence and the board

Presence messages (`present` and `left`) change only what interaction v26 draws for presence.
They never reload the board into the page, change the save state or the connection, or start a
retry; the board on screen changes only through edits, as v1 says.

## Verification

The 0004-W3 brief's unit tests and browser checks cover this version's changes: the stored
switch, the silent presence refusals (from the room and from the client) and presence traffic
leaving the board and the save state unchanged. v1's checks (the 0003-W4 brief) still cover the
rest.
