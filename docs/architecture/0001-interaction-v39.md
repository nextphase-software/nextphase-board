# 0001 — Interaction and browser contract

Contract version: 39 (for 0008-W2 brief v1, 2026-11-14). Status: Draft.
Replaces [interaction v38](0001-interaction-v38.md). All inherited editing, selection, Templates
panel and activity insertion (v21), Home/Trash/history/Comments, timer, voting, spotlight and
reaction values stay word for word. This version adds the **team templates** group to the
Templates panel, its card menu, dialogs and notices. [Team templates v1](0008-team-templates-v1.md)
owns storage, rights, limits and the client rules. Hosted team boards only: local boards, the
team-features-off build and board-grant guests see the Templates panel exactly as in v21.

## The team group

Shown inside the existing Templates panel, between its header and the "Activities" heading, when
the open hosted board's workspace lists the person as owner, editor or viewer. The panel's size,
position, padding, scrolling, breakpoints, focus-on-open and closing rules are unchanged (v21).

- **Head row**: flex, `align-items: center`, gap 8px, margin `16px 0 12px`, height 32px.
  - The workspace's name in the existing panel `h3` look (13px, bold) with its margin reset to 0,
    `flex: 1`, `min-width: 0`, one line, ellipsis when long.
  - A count `<n> of 25`, 12px, colour `#6b6772`, no wrap.
  - The **Save** button: the default button with `min-height: 32px`, padding `5px 10px`, font
    12px, no wrap. Its label is `Save selection as template` while anything is selected, otherwise
    `Save board as template`. With nothing selected it shows the tip
    `Nothing is selected, so all <n> objects on this board are saved` on hover and keyboard focus.
- **Disabled Save** (`aria-disabled="true"`, still focusable, opacity .45, the reason as tip and as
  `aria-describedby` text), first applicable reason wins:
  1. whenever the panel's Add template buttons are disabled (the existing `disabled` state), with
     the existing command reason text that blocks editing (`commandReason` in
     `state/use-editing-commands.ts`), word for word;
  2. not allowed (`canSave` false): `Only workspace owners and editors can save templates`;
  3. at the limit: `<workspace> has 25 templates, the most it can keep. Delete one to save another.`;
  4. empty board: `Add something to the board first.`
- **Tip** (the Save tip and every disabled reason in this version): background `#302d36`, white,
  12px, line-height 1.35, padding `4px 8px`, radius 4px, max-width 240px, wrapping; fixed above
  the panel and menu; its top 8px below the control's bottom, horizontally centred on it and kept
  8px inside the viewport.
- **Cards**: the existing `.template-cards` grid and `.template-card` (preview, Add template, name
  `h4`, description `p`), newest change first. The preview is drawn from the template's objects by
  v21's preview rule.
- **Creator line**: the existing card `small` (12px), `display: block`, colour `#6b6772`, one line
  with ellipsis and the full text as `title`: `By <creatorLabel> · from <sourceTitle>`.
- **More options** (only when `canManage`): a native button 28 × 28px, `min-width`/`min-height`
  28px, padding 0, absolutely placed top 6px, right 6px inside the preview, background white,
  border 1px `#e9e7ed`, radius 6px, three filled dots of radius 1.4px at (3.5, 8), (8, 8) and
  (12.5, 8) in a 16 × 16 icon, colour `#3b3a40`. Always visible. Hover: the shared button hover
  background `#f1eff5`. Open (`aria-expanded="true"`), also while hovered: background and border
  `#e9e2fb`, dots `#7051cf`. Focus: the shared focus ring (3px `#7051cf`, offset 3px). No separate
  pressed look. Accessible name `More options: <name>`, `aria-haspopup="menu"`.
- **New card**: after the person's own save, that card is first and its preview has
  `box-shadow: 0 0 0 2px #7051cf` until the panel closes.
- **Status line** instead of cards, 12px, `#6b6772`, line-height 1.5, margin `0 0 4px`:
  - loading: `Loading team templates…`;
  - none: `No team templates yet. Select objects on this board, then choose Save selection as template.`;
  - failed: `Couldn't load team templates.` followed by a default button, `min-height: 32px`,
    padding `5px 10px`, 12px: **Try again**.

## Card menu

`role="menu"`, opened by More options; 200px wide, padding 6px, white, border 1px `#e9e7ed`,
radius 10px, shadow `0 6px 20px #29202e1f`, fixed above the panel. Its right edge is aligned with
the button's right edge, 4px below it; if it would leave the viewport it opens 4px above the
button. Items (`role="menuitem"`), 32px tall, full width, left-aligned, padding `6px 10px`, 13px,
radius 6px, no border, transparent. Hover and keyboard focus: background `#f1eff5`; keyboard focus
also draws the shared focus ring with offset `-3px` (inside the item). No separate pressed look.

1. `Edit details…`
2. `Replace with selection` — `aria-disabled` with the tip `Select objects to use as the new content`
   while nothing is selected; focusable, does nothing when chosen.
3. a 1px `#e9e7ed` rule, margin `4px 0`;
4. `Delete…` in `#a32940`.

Choosing an item closes the menu before its dialog opens.

## Dialogs

All use the existing `<dialog class="board-question">` (520px or the window width minus 24px,
padding 24px, radius 12px, backdrop `#29272e66`) opened with `showModal()`. Title (`h2`) 20px,
margin `0 0 4px`. Buttons right-aligned with gap 8px (`.board-question-actions`, margin-top 20px).

- **Save as template**: under the title a line, 13px, `#57535d`, margin 0: `Saved to <workspace>.
  Its owners, editors and viewers can see it; anyone who can edit a board there can add it.` Then:
  - label `Name`, `display: block`, 13px, weight 600, margin `14px 0 6px`; a text input (full width,
    border 1px `#d9d6df`, radius 8px, padding `8px 10px`, 14px), empty, with focus on open;
    counter `<n> / 120` (12px, `#6b6772`, margin `4px 0 0`);
  - label `Description` with ` (optional)` in weight 400 and `#6b6772`, same label look; a textarea
    with the input's look, its height the shared textarea minimum of 120px, no resize; counter
    `<n> / 300` as above;
  - the preview (v21's rule, aspect 200 : 130, margin-top 14px, the card preview's look) and under
    it, 12px `#6b6772`, margin `8px 0 0`: `<n> selected objects from <board title>` or
    `All <n> objects on <board title>`;
  - buttons **Cancel** and primary **Save template**.
  - A blank name shows `Enter a name.` (12px `#a32940`, margin `4px 0 0`, `role="alert"`) once the
    field has been left or Save was tried, and Save stays disabled while the name is blank. Content
    over 262,144 bytes shows `This is too large for a template. Select fewer objects.` the same way
    and keeps Save disabled. Enter in Name submits when valid.
- **Edit template details**: as Save, title `Edit template details`, the line `Changes the name
  and description only. Boards that already used it keep their copies.`, fields filled with the
  current values, no preview, primary **Save changes**.
- **Replace “<name>”?**: text `Its content becomes the <n> selected objects. Its name, description
  and creator stay. Boards that already used it keep their copies.`; **Cancel** and primary
  **Replace content**; focus starts on Cancel.
- **Delete “<name>”?**: text `<workspace> will no longer see it in Templates. Boards that already
  used it keep their copies. This can’t be undone.`; **Cancel** and `button.error` **Delete
  template**; focus starts on Cancel.

**Pending.** While a request is in flight both buttons are disabled (opacity .45), inputs are
read-only, and Escape and the dialog's cancel event do nothing; the dialog closes only when the
answer arrives. On success it closes. A refusal of the kinds in Notices closes it and shows that
notice. Any other failure keeps it open with `Couldn't save the template. Try again.` (Save, Edit),
`Couldn't replace the template. Try again.` or `Couldn't delete the template. Try again.` as its
alert line, and the buttons enabled again.

**Focus return.** Escape and Cancel close without change. When a dialog closes, focus goes to the
card's More options (Edit, Replace, a failed Delete), to the team group's Save button (Save, and a
successful Delete, whose card is gone), or, when that control no longer exists, to the panel's Close
button.

## Notices

Through the hosted board's existing toast (`.team-toast`, polite status, gone after 5 s):

| Event | Words |
| --- | --- |
| Saved | `Saved “<name>” to <workspace>.` |
| Details edited | `Updated “<name>”.` |
| Replaced | `Replaced “<name>” with <n> objects.` |
| Deleted | `Deleted “<name>”.` |
| Added | v21's `Added “<name>”: <n> objects.` |
| Gone (404 or 403 on read, add, edit, replace, delete) | `“<name>” is no longer available. Templates were refreshed.` |
| Save refused (403, or 404 for the workspace or board) | `You can no longer save templates in <workspace>. Templates were refreshed.` |
| Limit reached on save (409) | `<workspace> has 25 templates, the most it can keep. Delete one to save another.` |

After a save, the panel stays open; after Add template it closes as in v21.

## Keys and focus

Tab order inside the panel: Close, Save (or Try again), then for each team card Add template and
More options, then the activity cards as in v21. On More options, Enter, Space and ArrowDown open
the menu with focus on its first item; ArrowUp/ArrowDown move with wrap, Home/End jump, Enter or
Space picks, Escape or Tab closes the menu and returns focus to More options. Escape with no menu or
dialog open closes the panel as today.
