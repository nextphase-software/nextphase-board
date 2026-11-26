# 0001 — Interaction

Contract version: 53 (for 0001-W27 brief v1, 2026-11-26). Status: Draft. When accepted it replaces
[interaction v52](0001-interaction-v52.md) for later work. Uses [document v23](0001-document-v23.md),
[board file v7](0006-board-file-v7.md), [sync v19](0003-sync-v19.md), [API v17](0003-api-v17.md),
[team templates v5](0008-team-templates-v5.md), [storage v6](0001-storage-v6.md), and, unchanged,
[access v17](0003-access-v17.md), [link preview v1](0012-link-preview-v1.md), [toolchain v6](0001-toolchain-v6.md),
[hosted storage v15](0003-hosted-storage-v15.md) and [board lifecycle v8](0006-board-lifecycle-v8.md); its modules
are [web modules v51](0001-web-modules-v51.md).

Every rule in v52 (and, through it, v51 back to v4 and the 0001-W3 presentation) still applies except where this
version replaces or adds to it. v52's own text follows as the part **Link cards (v52)**, word for word except that its
first sentence says "Version 52", its **Not in this version (link cards)** sends hyperlinks inside text objects to this
version's part, and its headings are one level lower; v52's change note is not repeated, and v52's copy of v51's text
(**Team imports and templates with media (v51)**) is not repeated either: it still applies, read it in v52. Where a part
links an older contract, read the versions above. The page links of [interaction v46](0001-interaction-v46.md) (page
addresses, Copy link to page, opening a board on a page, a link to the board that is open, the address following the
open page, notice placement) still apply; this version extends them with an `object` value.

This version adds **links in text** (the part **Links in text**, values LT1–LT18): words in a sticky, a shape or a
text object can carry a web address, added with a new **Link** button in the context bar's Formatting group, its
shortcut, or by pasting an address onto selected words, and changed or removed in a new **link bar** that takes the
context bar's place. Linked words are underlined on the canvas. Resting the pointer on them shows a **hover card** with
the address, or, for a link to this board, the current name of its page or object. One click follows a link: a link to
this board in place, any other link in a new tab. It also adds **object links**: a **Copy link to object** button in
the context bar for any one selected object (viewers included), an `object` value in board addresses, opening a board
on a linked object, and an address that follows a single selected object. The saved form (a `link` on formatting runs,
schema 17) and the address rule are [document v23](0001-document-v23.md)'s; the room's handling is
[sync v19](0003-sync-v19.md)'s. The look was approved in mock-up v1 (approved design, 2026-11-26); every value is
restated below so it is checked, not inferred.

## Change note (v52 → v53)

- New part **Links in text** (LT1–LT18): which objects, the Link button and its shortcut with their enable rules and
  reasons, the link bar and its keys, the refusal, paste onto selected words, underlines, the hover card with its
  timings and labels, following a link, Copy link to object, object link addresses, opening an object link, the
  address following the selection, missing targets, Undo and edits, viewers, where links travel, accessibility, and
  what is not in this version.
- Interaction v46's page addresses gain an optional `object` value on both board kinds (LT10). v46's **Not in this
  version** items "Links inside text, stickies or shapes", "a link to a single object" and "the selection in the
  address" are now in this version.
- v52's **Not in this version (link cards)** no longer lists hyperlinks inside text objects.
- Two context-bar buttons are added (Link, Copy link to object); nothing else in v52 changes.

## Links in text

### Terms

- **Rich-text object**: an object whose registry type has `richText: true`: a sticky (`sticky`), a shape (`shape`)
  or a text object (`text`). No other type holds a link (LT1).
- **Link**: the optional `link` key of a formatting run (`Mark`, document v23): the full stored address. A **linked
  character** is a character covered by a mark with a `link`. A **link run** is a maximal run of consecutive
  characters that all carry the same `link`. Offsets are code points, as for every mark.
- **The address rule** is document v23's `linkAddress(raw)` (`packages/board-rules/src/text-link.ts`), restated
  here: trim the text; refuse it when it is empty, longer than 2,048 characters before parsing, or contains whitespace
  or a control character inside; if it does not start with a scheme (`/^[a-z][a-z0-9+.-]*:(?!\d)/i` does not match;
  a colon followed by a digit is a port, so `example.com:8080/x` becomes `https://example.com:8080/x`) and its host part (the text before the first `/`, `?` or `#`)
  contains a `.`, put `https://` in front; parse it with `URL`; accept it only when the protocol is `http:` or
  `https:`, the hostname is not empty, there is no username or password, and `href.length ≤ 2048`. The stored value
  is the parsed URL's `href`. Local and private hosts are accepted when the rule otherwise accepts them (`localhost:3000`
  has no scheme and no `.`, so it is refused; `http://localhost:3000` is accepted). An address that **passes** the rule
  is one the rule accepts.
- **The range**: while an object is being edited, the editor's selection (`selectionStart` to `selectionEnd`, as code
  points); otherwise the object's whole text. A **collapsed caret** is a selection whose start equals its end. The
  caret is **inside a link** when the characters on both sides of it belong to the same link run (at a link's start
  or end it is not inside, as document v23's text-edit rule). The link-range helpers are document v23's: `linkAt`
  (the whole link run that covers a range, or that a caret is inside), `touchesLink` (whether a range or a caret
  touches a linked character) and `setLink` (set or remove a link over a range, flags kept).
- **Editing** an object: the object's canvas editor is open (`inline`), as the bar's **Edit text** button or a
  double-click opens it.
- **Linked piece**: the drawn part of a linked span on one text line (LT6), inside the object's visible text area (the
  part clipped away is not a linked piece). Hover, following and Edit link identify the link by the **saved link run**
  that contains the character under the pointer (`linkAt` at that code point), never by the drawn piece.
- **Same-board link**: an address that, when used (hovered or clicked, never when saved), meets all of: its origin
  and pathname equal the app's (`location.origin` and `location.pathname`); and either, on a team board, its fragment
  reads as a board link (LT10) whose board id is **the open board's id** and that carries `page`, `object` or both;
  or, on a single-user board, its query's `board` value equals the open board's key and it carries `page`, `object`
  or both. A same-board link with `object` is an **object link**; one with only `page` is a **page link**. A bare
  board link of the open board (no `page`, no `object`) and any link to another board are ordinary links.
- **Kind** of an object, used in Copy link's words (LT9) and in the hover card (LT7):

| Type | Kind | Type | Kind |
| --- | --- | --- | --- |
| `sticky` | `sticky` | `image` | `image` |
| `shape` | `shape` | `video` | `video` |
| `text` | `text` | `link` | `link card` |
| `section` | `section` | `connector` | `connector` |
| `table` | `table` | `stroke` | `drawing` |
| `mindNode` | `mind map node` | `tape` | `washi tape` |

  The **capitalised kind** is the kind with its first letter in upper case (`Sticky`, `Link card`, `Mind map node`).
- **Editors**: people for whom the open board is not read-only (`readOnly` false): on a single-user board, the tab that
  holds the board; on a team board, an owner, an editor or a board guest with an editor grant. **Viewers**: everyone
  else who can open the board (a team viewer, or a board that is read-only for another reason).
- **The board notice**: the app's existing notice (`aside.notice`, `role="status"`, set with `setMessage`), placed as
  interaction v46's **Notice placement** says: at 1440 × 900 its box is 390, 68, 660 × 37, and on a viewer's team board
  390, 123 (8 px under the view-only banner).
- **Platform**: "Mac" is the test the Tidy up tooltip already uses, `/Mac|iPhone|iPad/` on `navigator.platform`.

### Words

Every text this part adds, exactly:

| Where | Text |
| --- | --- |
| Link button, `aria-label` | `Link` |
| Link button tooltip, enabled | `Link · ⇧⌘U` on Mac; `Link · Ctrl+Shift+U` elsewhere |
| Link button disabled reasons (LT2) | `Select one object to add a link`; `Add text first`; `Select words to link`; or the bar's existing selection reason |
| Link bar field, `aria-label` | `Link address` |
| Link bar field, placeholder | `Paste or type a link` |
| Link bar buttons, `aria-label` and tooltip | `Remove link`; `Apply link` |
| Refusal line (LT4) | `Use a web address starting with http:// or https://, or a link to this board.` |
| Copy link to object, `aria-label` and tooltip | `Copy link to <kind>` |
| Notice after Copy link to object | `Link to <kind> copied.` on a team board; `Link to <kind> copied. It opens in this browser only.` on a single-user board |
| Hover card buttons, `aria-label` and tooltip | `Copy link`; `Edit link` |
| Notice after the card's Copy link | `Link copied.` |
| Card label for a missing target | `Not on this board any more` |
| Notice for a missing object | `That object no longer exists.` |
| Notice when a clipboard write is refused | `Could not copy the link. Your browser blocked the clipboard.` (interaction v46's, unchanged) |

`<kind>` is the object's kind (Terms) in lower case, for example `Copy link to sticky`, `Link to table copied.`

### LT1 — Which objects

Links live only in the text of rich-text objects: stickies, shapes and text objects. Connector labels, mind-map nodes,
table cells, section names and every other type never hold a link, show no Link button and accept no paste-to-link.
Copy link to object (LT9) works for **every** type, because it links to the object, not to its text.

### LT2 — The Link button and its shortcut

**Place.** A new button in the context bar's existing Formatting group (`<span class="formats" role="group"
aria-label="Formatting">`), right after **Strikethrough**. It is shown whenever that group is shown (today: when the
selection's formatting objects are all rich-text objects) and nowhere else. The bar's existing placement (centred over
the selection, kept inside the window) applies to its new width: the bar is wider by the two new buttons (LT2, LT9)
and is centred again, not extended to one side. The existing fit rule applies unchanged to the new measured width: the
bar is shown only when the window is at least 768 px wide and the bar's width is at most the window's width minus 24 px
(and the existing height and editor-overlap tests pass); otherwise it is hidden as today. Because the bar is about 80 px
wider, it can now hide at a window about 80 px wider than before; nothing else changes.

**Look.** The bar's existing `button.icon-button` (40 × 40 in the 40-high context bar) with the existing
`<span class="tooltip">`, the bar's hover fill and its disabled look, and no `title` attribute. Its icon is 20 × 20:
`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"
stroke-linejoin="round" aria-hidden="true">` with the paths `M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1`
and `M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1`. Pressing it does not move focus out of the editor
(its `mousedown` default is prevented, as the formatting buttons do). The glyph is 20 px like every other bar icon;
the approved screen drew it larger only because the capture's SVG had no size (derived value).

**States** (approved design, 2026-11-26; every new button in this part uses the shared focus and active looks):

| State | Link button | Copy link to object |
| --- | --- | --- |
| Rest | transparent, white icon (the `.context button` rule) | the same |
| Hover | the bar's existing hover: background `#f1eff5` (shared `button:hover:not(:disabled):not([aria-disabled=true])`), icon `#29272e` (`.context button:hover:not(:disabled)`) | the same |
| Pressed (`aria-pressed="true"`) | background `#7051cf`, radius 6 px, white icon, by a new rule that outranks `.context button` (which today sets every bar button transparent, so the shared `button[aria-pressed=true]` fill does not show in the bar) | — (never pressed) |
| Hovered while pressed | background `#6142be`, radius 6 px, white icon | — |
| Disabled | the shared `button:disabled` (opacity 0.45), tooltip the reason | — (never disabled) |
| Focus-visible | the shared `button:focus-visible` ring (3 px solid `#7051cf`, offset 3 px), and the tooltip shows (`.icon-button:focus-visible .tooltip`) | the same |
| Active (pointer down) | no own look: the hover or pressed look stays | the same |

**Enabled.** For an editor, when the bar's existing selection reason is empty and either:
- not editing: exactly one rich-text object is selected and its text is not empty; or
- editing a rich-text object: the selection is not empty, or the collapsed caret is inside a link.

**Disabled reasons**, first match wins; the reason is the button's tooltip text:

| When | Reason |
| --- | --- |
| The bar's existing selection reason is not empty (a viewer, a read-only board, a composition, a pointer gesture, invalid drafts, Tidy up) | That reason, for example `Read-only: editing commands are unavailable.` for a viewer |
| More than one object is selected | `Select one object to add a link` |
| The one selected object's text is empty | `Add text first` |
| Editing, with a collapsed caret not inside a link | `Select words to link` |

While disabled by the selection reason the button has `aria-describedby="selection-reason"`, as the bar's other
editing buttons do; while disabled by one of the three new reasons it has `aria-describedby="link-reason"`, a new
visually hidden `<span id="link-reason" class="sr-only">` beside `selection-reason` that holds that reason (as
`duplicate-reason` does for Duplicate). Enabled, its tooltip is `Link · ⇧⌘U` on Mac and `Link · Ctrl+Shift+U`
elsewhere.

**Pressed.** `aria-pressed="true"` when the range lies inside one link run (while editing, a collapsed caret inside a
link counts), else `"false"`. With several objects selected it is `"false"`.

**Click.**
- Editing: opens the link bar (LT3) for the range.
- Not editing: starts editing the object through the bar's real **Edit text** route (which also closes any open side
  panel), selects all of its text in the editor, then opens the link bar for that whole range. The pending range is
  consumed (the bar opens) only **after** the editor placement has accepted the canvas editor. When that route falls
  back to the Objects panel's Content field because the canvas editor cannot fit, the pending range is cleared
  **before** the fallback takes focus, the fallback happens as it does for Edit text, and the link bar does not open;
  nothing else happens.

**Shortcut.** Cmd+Shift+U or Ctrl+Shift+U (`key` `u` in either case, Shift held, Cmd or Ctrl held, Alt not held), not
during a text composition, does exactly what the click does whenever the button is shown and enabled: from the canvas
(the scene has focus) and from the canvas editor. When the button is not shown or is disabled the shortcut does
nothing and shows nothing. The Objects panel's Content field does not take the shortcut in this version.

**Narrow windows.** When the context bar is not shown (below 768 px wide, or when it does not fit), the Link button and
its shortcut are not offered, as for every bar command (v52's **Narrow windows**).

### LT3 — The link bar

**Opening.** The link bar opens in the context bar's place: the context bar is hidden (`visibility: hidden`, `inert`,
`aria-hidden="true"`) while the link bar is open, and the link bar is centred on the context bar's box at that moment:
its centre is the bar's centre, its top the bar's top (both 40 high), kept 12 px inside the window horizontally. In
the approved design, editing "Lakeside Hall" at 1440 × 900, its box is 886, 282, 356 × 40. Viewers never see it.

**Editing continues** while it is open: moving focus into the bar does not end the text session, and the object stays
in its editing state with the range kept. While the bar is open:
- the canvas editor keeps its editing outline, 3 px solid `#7051cf` with a 4 px offset (the look of today's
  `.inline:focus-within`, kept by a class set on the editor while the bar is open, because focus has left it);
- the range stays selected in the editor's text field, which the browser shows with its own **inactive** selection
  look; the approved screen's blue highlight is the field's focused look, seen again when focus returns;
- the address field shows focus only by its own 1.5 px `#8a73e6` border: no extra focus ring (`outline: none`); its
  caret is the browser's native text caret (the approved screen drew a 1 × 15 px white stand-in for it).

**Contents**, left to right, in a `<div class="link-bar" role="group" aria-label="Link">`:
1. a text field: `<input type="text" inputmode="url" autocomplete="off" spellcheck="false">`, `aria-label="Link
   address"`, placeholder `Paste or type a link`. It is focused on opening and prefilled with the stored address of
   the link run that covers the whole range (or, with a collapsed caret, the link run the caret is inside): `linkAt`
   for the range; all of it selected; with no such link it is empty;
2. **Remove link**: an icon button, enabled only when `touchesLink` is true for the range (for a range, any of its
   characters is linked; the bar opens on a collapsed caret only when it is inside a link);
3. **Apply link**: an icon button, enabled only when the field's text passes the address rule.

Each button has the `aria-label` and a `<span class="tooltip">` with the same text.

**Look** (approved design, 2026-11-26):

| Part | Value |
| --- | --- |
| Bar | fill `#302d36` (the context bar's), shadow `0 4px 14px rgba(20,18,26,.22)`, radius 10 px, padding 6 px, gap 4 px, height 40 px, `display: flex`, `align-items: center`; width 356 px (6 + 280 + 4 + 28 + 4 + 28 + 6) |
| Field | 280 × 28 px, `box-sizing: border-box`, radius 6 px, border 1.5 px solid `#8a73e6`, fill `#1d1b21`, padding 0 8 px, text 13 px `system-ui` in white; placeholder `#8f8a96` |
| Remove link | 28 × 28 px, radius 6 px, transparent, white 18 px icon: paths `M10 14a4.5 4.5 0 0 0 6.4 0l1.2-1.2`, `M19.4 11l.1-.1a4.5 4.5 0 0 0-6.4-6.4l-1 1`, `M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1`, `M4 4l16 16` |
| Apply link | 28 × 28 px, radius 6 px, fill `#7051cf` when enabled, transparent when disabled; white 18 px icon: path `M5 12.5l4.5 4.5L19 7.5` |
| Disabled buttons | opacity 0.38 |
| Hover | Remove link and Apply link: background `#57525f`, white icon; Apply link (enabled) `#6142be` |
| Focus-visible | buttons: the shared `button:focus-visible` ring (3 px solid `#7051cf`, offset 3 px) and their tooltip shows; the field: see **Editing continues** (its border only) |
| Active (pointer down) | no own look |
| Icons | `viewBox="0 0 24 24"`, `fill="none"`, `stroke="currentColor"`, `stroke-width="1.8"`, round caps and joins, `aria-hidden="true"` |

**Keys and closing.**
- **Return** applies, or refuses (LT4), only while the **field** has focus. Return or Space on a focused Remove link or
  Apply link button activates that button natively; no Return handler sits on the bar itself.
- **Escape** closes the bar without a change.
- A pointer press outside the bar closes it without a change; that press does nothing else, and the `click` that
  follows it is consumed too, so no button or control under the pointer activates.
- Tab and Shift+Tab move between the field and the enabled buttons and stay inside the bar.
- **Focus after closing**, on every close path (Escape, Apply, Remove, an outside press, a text change, a role change,
  the editor gone): after any commit, focus goes to the editor with the same range selected when the object is still
  being edited (editing continues and the context bar shows again); otherwise to the canvas (the scene element).
- The bar also closes without a change, and nothing is written, when editing of the object ends by any other path
  (the selection changes, the object is deleted, the board turns read-only).
- It also closes without a change, and with no notice, when the object's text changes while it is open (for example a
  team member's edit arrives), so Apply never links other words than the ones selected.

**Grapheme boundaries.** Every range a link is set on or removed from (Apply, Remove, paste onto selected words) is
first widened outward to whole graphemes (document v23's `setLink` snaps it), so a link never starts or ends inside a
grapheme (an emoji with modifiers, a letter with combining marks).

**Apply.** Sets the field's address, as the address rule stores it (`href`), on every character of the range with
`setLink`, replacing any link inside the range; flags are kept (document v23: bold, italic and strikethrough are independent of links). With a
collapsed caret inside a link, it replaces that whole link run's address instead.

**Remove link.** Removes the link (`setLink` with `null`) from every character of the range (parts of a link run outside the range keep it);
with a collapsed caret inside a link, from that whole link run. Flags are kept.

Apply and Remove each commit as a Bold toggle while editing does: the text session's pending text is committed first,
then one commit changes the marks, one Undo step (LT14). Then the bar closes as above.

### LT4 — The refusal

Apply link is disabled (transparent, opacity 0.38) whenever the field's text, trimmed, does not pass the address rule
(checked on every input), so a half-typed address is never shown as an error. When Return is pressed and the text,
trimmed, is not empty and does not pass the rule, nothing is applied and the refusal shows:
- the field's border turns `#ff8a80`;
- one line appears under the bar, exactly `Use a web address starting with http:// or https://, or a link to this
  board.`: 12 px `system-ui`, line height 1.35, colour `#ffb4ab`, on the bar's fill `#302d36`, padding 6 px 10 px,
  radius 6 px, `box-sizing: border-box`, at most 360 px wide (it wraps inside), its left edge at the bar's left edge and
  its top 4 px under the bar's bottom edge;
- the field has `aria-invalid="true"` and `aria-describedby` naming the line's `id`.

An empty field shows no refusal (Return does nothing). The refusal stays until the field's text changes, then goes;
it also goes when the bar closes.

### LT5 — Paste onto selected words

While editing a rich-text object with a non-empty selection, a paste into the editor links the selection instead of
replacing it when all of these hold:
1. no text composition is running;
2. it is not a plain-text paste (Cmd+Shift+V or Ctrl+Shift+V, "paste and match style");
3. the clipboard holds no file and is not Board's own copy (the existing test: an object clipboard exists and the last
   copy's plain text equals the raw `text/plain`, or that copy was refused);
4. its `text/plain`, trimmed, contains no whitespace (one token) and passes the address rule.

Then the paste's default is prevented, the selection gets that link exactly as Apply link sets it (LT3), and the words
and the selection stay as they were. One Undo step. Every other paste behaves exactly as today.

### LT6 — Underlines

**Links never change layout.** Line breaks, line widths, the object's height, every glyph's position and the choice
between today's single text drawing and its run-by-run drawing are computed exactly as they would be without links:
the pieces used for layout are split by flags only, so a note with links but no flags keeps today's single drawing, and
adding, changing or removing a link never moves a letter. Each linked character is then underlined: one **underline
line per linked span per text line**, drawn as its own line (not the text library's `underline` decoration), its left
and right ends placed by measuring the line's text up to the span's first character and up to its end in the same font.
Strikethrough keeps today's native `line-through`; a linked struck-through span has both. Unlinked text draws exactly
as today. The editor's text field is unchanged: it shows plain text while editing, as it does for bold today, and the
underlines show on the canvas.

**Look**, in screen pixels, for a piece whose font is `F` px on screen (its font size in board units times the zoom)
on a text line whose top is at `Y` and whose height is `F × 1.45` (the text layout's line height):
- colour: the text's own colour (the object type's text colour, the same fill the piece's letters use);
- thickness: `max(1, round(F / 16))` px;
- position: the underline's top edge at `round(Y + F × 1.45 / 2 + 0.47 × F)`, across exactly the span's measured width.

On the canvas these are given in board units scaled by the current zoom, so they render at the stated screen pixels at
every zoom.

At 100 % zoom with Medium text (18 units) that is a 1 px line about 21 px below the line's top: in the approved design,
y 398 under "Lakeside Hall", whose line starts at 377. An underline that lands more than 1 screen pixel away from these
values, in position or thickness, does not meet this rule. Image and PDF exports draw the same underlines at the
export's own pixel scale `s` (the export draws at zoom 1 and is scaled `s` times when captured): `F` is the font size
times `s`, so the thickness in board units is `max(1, round(F / 16)) ÷ s`, and the position likewise.

### LT7 — The hover card

**When it shows.** The pointer (`pointerType` `mouse` or `pen`) rests for **300 ms** on a linked piece of a visible
rich-text object that is not being edited, on the current page. "Rests" means the pointer stays over linked characters
of the same saved link run (Terms: identified by its maximal run, not by the drawn piece); moving to another link run
restarts the 300 ms. At the moment it would show, it shows only when no pointer gesture is in progress, nothing is
being edited, no Tidy up preview, voting mode or link bar is open, and no **visible** blocker exists: an element
matching `[role=menu]`, `[role=dialog]`, `[role=listbox]`, `.pages-panel`, `.swatches`, `.arrange-menu`,
`.connector-popup`, `.image-description-panel`, or a `details[open]` inside `.context`, for which
`element.checkVisibility({ visibilityProperty: true })` is true (so one hidden by `display`, `visibility` or a hidden
ancestor does not count). A pending show is cancelled **at once** when the pointer leaves the link run (it does not
wait for the hide timer), when editing starts, and on every pointer press; if a blocker is visible at show time the
show is cancelled.

**When it hides.** **200 ms** after the pointer has left both the link run and the card (re-entering either within
200 ms keeps it), and at once on pan, zoom, a page change, the start of any editing, Escape, a pointer press outside
the card, or a selection change. At most one card shows at a time.

**Contents**, left to right: an icon, a label, a divider, **Copy link** (everyone), **Edit link** (editors only; absent
for viewers).

| The link | Icon | Label |
| --- | --- | --- |
| A page link whose page exists | page icon: paths `M7 3.5h7l4 4v13H7z` and `M14 3.5v4h4` | the page's current name |
| An object link whose object exists | the bottom palette's tool icon for that type (Sticky, Shapes, Draw, Text, Section, Table, Mind map, Image), else the generic object icon: `<rect x="4.5" y="4.5" width="15" height="15" rx="2.5">` | the object's first non-empty text line, else its capitalised kind |
| A same-board link whose object (object link) or page (page link) does not exist | gone icon: `<circle cx="12" cy="12" r="8.5">` and path `M8.5 8.5l7 7` | `Not on this board any more`, muted |
| Any other link | outside-link icon: path `M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5` (v52's Open link icon) | the stored address, as stored (for example `https://lakeside-hall.example/visit`) |

The **first non-empty text line** is read from the object's current `text` (types with text: sticky, shape, text,
section, connector, mind map node): the text is split at line breaks, the first line holding a non-whitespace character
is taken with its leading and trailing whitespace removed, and if it is longer than 60 code points it becomes its first
60 code points followed by `…`. When the text is empty or holds only whitespace (no such line), the label is the
capitalised kind. Labels are read from the board as it is at the moment the card shows, so a renamed page
or an edited object shows its current name.

**Look** (approved design, 2026-11-26):

| Part | Value |
| --- | --- |
| Card | height 36 px, `box-sizing: border-box`, radius 8 px, fill `#302d36` (the context bar's, as for the link bar; the approved screens that show a card with no bar on screen read `#2b2930`, a capture artefact), shadow `0 4px 14px rgba(20,18,26,.22)`, padding 0 4 px 0 10 px, `display: flex`, `align-items: center`, gap 2 px, `white-space: nowrap`, font `500 13px/1 system-ui` |
| Icon | 16 × 16 px, colour `#d9d6de`, `margin-right: 8px` in addition to the card's 2 px gap; same SVG attributes as the link bar's icons |
| Label | 13 px, weight 500, white, at most 260 px wide with `overflow: hidden` and `text-overflow: ellipsis`, `margin-right: 8px` in addition to the 2 px gap |
| Muted label | colour `#b9b5bf`, italic |
| Divider | 1 × 20 px, `rgba(255,255,255,.18)`, margin 0 4 px |
| Buttons | 28 × 28 px, radius 6 px, transparent, white 18 px icons: Copy link uses the bar's Duplicate icon, Edit link the bar's Edit text (pencil) icon; hover background `#57525f` with a white icon; focus-visible the shared `button:focus-visible` ring (3 px solid `#7051cf`, offset 3 px); active: no own look |

**Place.** Its left edge is at the first character of the link run on the hovered line, its top `round(line top + line
height + 6)` screen pixels (6 px under that line), then kept 12 px inside the window: `left = max(12, min(left,
innerWidth − width − 12))`. If its bottom would be closer than 12 px to the window's bottom, it is placed 6 px above the
line instead. In the approved design at 100 %: the card for "Lakeside Hall" is at 920, 408, 327 × 36.

**Copy link** writes the stored address to the clipboard with `navigator.clipboard.writeText` inside the click and
shows the board notice `Link copied.`; when the write is refused (its promise rejects, or the API is missing) the notice
is `Could not copy the link. Your browser blocked the clipboard.` Nothing is written to the board.

**Edit link** selects only that object, starts editing it through the real Edit text route, selects the link run under
the card in the editor, and opens the link bar (LT3) prefilled with that link. When the route falls back to the Objects
panel, the pending range is cleared before the fallback takes focus and the link bar does not open; the bar opens only
after the placement has accepted the canvas editor, as for the Link button (LT2). It is shown only to editors and works only when the
bar's selection reason would be empty; otherwise it does nothing.

### LT8 — Following a link

A **primary click** on a linked piece follows its link. **At the press** (a primary-button press on a linked character,
with the Select tool, no modifier key (Shift, Alt, Cmd, Ctrl) and nothing being edited) the board id, the open page,
the object's id, the saved link run (its start and end) and its stored address are recorded. Whether it follows is
decided **at the release**, for viewers (who have no drag) and editors alike, from values read at that moment: the
same board and page are open; a live hit test at the release point finds the **same object** and the **same saved run
with the same address** (so an edit that arrived during the press, adding, moving or changing a link there, cancels the
follow); the gesture **never** moved 3 screen pixels or more from the press (the canvas's existing drag threshold; a
gesture that crossed it never follows, even when released back at its start); no text composition is in progress; and
no voting mode or Tidy up preview is open. Otherwise nothing follows and the click is an ordinary click. Then:
- **An object link, or a page link to another page**: followed in place, on both board kinds: no new tab, no page
  load, no `hashchange`. An object link opens by LT11; a page link opens its page as interaction v46's link to the board
  that is open does (with nothing selected). In-place opening runs with its own guards (LT11 **While opening is not
  allowed**), not with any state captured during the click. The address is then rewritten with
  `history.replaceState` (LT12). The clicked object is not selected (an object link selects its target).
- **A page link to the page already open**: an ordinary click (the clicked object is selected as a click selects it;
  no navigation, no notice). A same-page `hashchange` keeps interaction v46's result.
- **Any other link that passes the address rule** (checked again now): `window.open(href, "_blank",
  "noopener,noreferrer")`, and the clicked object is selected as an ordinary click selects it.
- **A stored address that fails the address rule**: nothing opens; the click is an ordinary click.

**Double-clicks.** Following happens on the first click's release. When that click followed a link, only the second
click that belongs to it is suppressed, together with the browser's `dblclick` that follows: the next press counts as
that second click when it is on the same object and the same saved run and starts within 500 ms of the first click's
release (the double-click interval; browsers do not expose their own), and the `dblclick` the browser then fires is
suppressed with it. Suppressed means it neither follows again nor starts editing, so no editing starts
on a moved view or another page; for an outside link the tab has already opened. Every other click, including a quick
click on a different link or object, behaves normally (the 500 ms applies only to that one same-link press). To edit linked words, use Edit text, Edit
link, or a double-click on unlinked words of the object.

A drag that starts on a linked piece moves the object (editors) as today; a modifier click selects as today; while an
object is being edited, a click in its editor only places the caret, and a click on the canvas ends editing as today
and follows nothing. Viewers follow links too. Following adds no Undo step and sends no edit (a page switch sends
presence, as today).

### LT9 — Copy link to object

**Place.** A new context-bar button shown when **exactly one** object of **any** type is selected, right before
**Duplicate** (after **Move to page** when that is shown). In the bars that have no Duplicate (the drawing bar and the
connector bar) it sits right before **Delete**. It exists only where the regular context bar is shown: not for several
objects or none, not while Tidy up is open (its own bar replaces the regular one), and not when the context bar is not
shown (below 768 px wide, or when it does not fit).

**Look.** The bar's existing `button.icon-button` (40 × 40) with the existing `<span class="tooltip">` and no `title`;
icon 20 × 20 with the link bar's SVG attributes and the paths `M8.5 15.5l3.5-3.5`,
`M9.8 9.6l.9-.9a3.2 3.2 0 0 1 4.5 4.5l-.9.9`, `M10.7 18.4l-.9.9a3.2 3.2 0 0 1-4.5-4.5l.9-.9` and
`M15 3.5h5.5V9M20.5 3.5l-5 5`. `aria-label` and tooltip: `Copy link to <kind>`.

**Enabled** always, for every role, wherever it is shown: not disabled for a viewer, a read-only board, a gesture or a
composition. For a viewer it is the bar's one enabled control, except on a link card's bar, where v52's **Open link**
also stays enabled for viewers (an existing exception that this version keeps).

Pressing it does not move focus (its `mousedown` default is prevented), so when the selected object is being edited
the editor keeps focus and editing continues.

**Click.** Inside the click it writes the object's link (LT10, with `page` the object's own page) as plain text with
`navigator.clipboard.writeText`, then shows the board notice `Link to <kind> copied.` on a team board, or `Link to <kind>
copied. It opens in this browser only.` on a single-user board; when the write is refused (its promise rejects, or the
API is missing), `Could not copy the link. Your browser blocked the clipboard.` It adds no Undo step, changes nothing on
the board, leaves the save state unchanged and sends nothing to the room. The selection, focus and any editing stay.

### LT10 — Object link addresses

An **object link** is interaction v46's page link plus an `object` value naming the object's `id`:

```
team board:         <origin><path>#/b/<board id>?page=<page id>&object=<object id>
single-user board:  <origin><path>?board=<board key>&page=<page id>&object=<object id>
```

**Team boards.** The fragment `#/b/<uuid>` may end with `?` followed by one or two parameters joined by `&`, each
`page=<value>` or `object=<value>`, each name **at most once**, in either order, where `<value>` is any run of
characters other than `&` and `#` (it may be empty). Any other text after the board id (another name, a repeated name,
an empty part, a trailing `&`) makes the link bad, as today. `#/b/<uuid>` alone keeps its exact result today (a board
link with no page value and no object value). Copied and written links put `page` first. Invitation, home, workspace
and Trash fragments are unchanged.

**Single-user boards.** The `object` value is the `object` query parameter, decoded as the URL standard decodes it (its
first occurrence). A written link treats `object` exactly as interaction v46's page link treats `page`: the first
existing `object` parameter is replaced in place (wherever it stands, even before `page`), later `object` parameters
are dropped, and when there is none it is appended after `page`; `page` keeps v46's rule; every other part of the query
is kept as it is encoded, in its place. Writing an address **without** an object removes every `object` parameter. For
example, `?object=a&board=k&page=p&object=b` with object `c` becomes `?object=c&board=k&page=p`.

The board link copied from the Share dialog and the home lists stays the board link without a page or object value.

### LT11 — Opening an object link

An object link is opened at three moments: when the tab **first shows a board** (interaction v46's term) and its
address carries an `object` value; on a team board, when the fragment changes to a board link of the board open in this
tab carrying an `object` value (v46's **A link to the board that is open**, which keeps every rule it states: the board
is not stopped or reloaded, no leave question, the Undo history and connection stay, and before the first real
document has arrived the latest fragment's values wait and replace each other); and when an object link is followed by
a click (LT8). A single-user board's changed query is a new page load, so it is opened as the first show.

**The object exists** (an object with that `id` is on the board): its **own current page** opens, whatever `page`
says (it may have moved); only that object is selected (not its group or branch); and the view is centred on the
object's box (the centre of its box at the centre of the window): at the **current zoom** for a hashchange or a click,
at **that page's opening zoom** (today's opening view of that page) when the board is first shown. A page opened this
way opens as v46 says (no Undo step, no save state change, remembered for the board in this browser, carried by
presence on a team board).

**The object is hidden** in a collapsed mind-map branch: its page opens and nothing is selected, with no notice (the
branch is not expanded in this version).

**While opening is not allowed** (a pointer gesture, a composition, a Tidy up preview, as v46): for a hashchange or a
click, nothing changes and the board notice reads `Finish the current action first.`

Then the address is corrected with `history.replaceState` to the open page and the selection (LT12). A page link
without `object` keeps interaction v46's behaviour exactly.

### LT12 — The address follows the selection

Whenever the selection settles (after any change of the selected set, once no pointer gesture is in progress: a box
selection writes once, on release), the address is rewritten with `history.replaceState`: no new history entry, no
`hashchange`, no page load, no remount of the board route:
- exactly one object selected: the open page's link with `object=<its id>` (LT10);
- none or several: the open page's link with no `object`.

While the selection is **unsettled** (a pointer gesture is in progress), selection-driven writes are skipped entirely:
the address keeps the `object` it had, and is neither stripped at a drag's start nor restored at its release unless the
settled selection differs. Page changes and address repair still write while a gesture runs; they carry the `object`
of the last settled selection when it is still valid on the open page, else none.

Every address write of interaction v46's **The address follows the open page** uses the same form (a page change
clears the selection, so it writes no `object`). Nothing is written before the board is first shown, while a team
board's page value is still waiting for its first real document, or for the selection inside a history preview (the
address there carries no `object`). On a team board, no change of the `object` value, from a link or from these writes,
remounts the board (v46's **Route identity**). When a leave question opens, the address already shows the open page
and the selected object, and **Stay** keeps it.

### LT13 — Missing targets

**Opening a link to a missing object** (LT11): the page `page` names opens if it exists, else the board's first page;
nothing is selected; the view is that page's opening view (first show) or the page's view as v46 opens it (hashchange
or click; unchanged when it is already the open page); and the board notice reads `That object no longer exists.` Only
that one notice shows, even when the page is missing too. On first show it follows v46's **Order with the load's own
messages** exactly as the missing-page notice does (set after the load's own startup message; not shown when a local
load ends read-only or with a recovery message; shown to a team viewer under the team notice column). The address is
then corrected (LT12).

**The hover card** of a same-board link whose object (object link) or page (page link) is missing shows the gone icon
and the muted label `Not on this board any more`, with Copy link (everyone) and Edit link (editors). A page link to a
missing page keeps v46's notice when followed: `That page no longer exists. You are on “<first page name>”.`

### LT14 — Undo and edits

Setting, changing or removing a link (Apply link, Remove link, paste onto selected words) is **one Undo step** and,
on a team board, **one synced edit** of that object's marks, exactly as a Bold toggle is. Undo restores the marks
before the change, Redo reapplies them. Text edits carry links through document v23's rule: characters typed strictly
inside a link take it; characters typed at a link's start or end do not; deleting every linked character removes the
link. Bold, italic and strikethrough keep links; setting or removing a link keeps flags. Copying a link (either Copy
link), hovering, following and every address write add no Undo step, change no save state and send no edit (a page
switch sends presence, as today).

### LT15 — Viewers and roles

Viewers see the underlines, get the hover card with **Copy link** only (no Edit link), follow links (LT8), and use
**Copy link to object** (LT9). The Link button is shown to them disabled with the bar's selection reason
(`Read-only: editing commands are unavailable.`), its shortcut does nothing, they never see the link bar, and their
pastes never link words (they cannot edit text). The room refuses a viewer's mark edits as it refuses every viewer edit
(sync v19, unchanged access). Editors (owners, editors, board guests with an editor grant, and the single-user board's
holder) have every control in this part.

### LT16 — Where links travel

- **Kept:** object copy and paste (the object clipboard keeps each mark's `link`), Duplicate, board files (board file
  v7), team templates (save and add), undo history, and the room (sync v19).
- **Drawn:** image and PDF exports draw the underlines (LT6).
- **Dropped:** plain-text copies and CSV carry only the text.
- Every place that reads a document checks each link with the address rule (document v23); in a room, an update
  holding a mark that fails it is refused as `invalid_update` (sync v19).
- A pasted copy keeps its stored addresses unchanged. Same-board recognition happens only at use (Terms), so an object
  link copied onto another board is an ordinary link there and opens a new tab.

### LT17 — Accessibility

- The Link button is a labelled toggle button (`aria-pressed`) with its reason exposed through `aria-describedby`
  (LT2); Copy link to object is a labelled button.
- The link bar is a labelled group (`role="group"`, `aria-label="Link"`) whose field is labelled `Link address`; its
  focus is trapped by Tab and Shift+Tab, and closing returns focus to the editor, or to the canvas when the editor is
  gone or the board is read-only (LT3). The refusal line is tied to the
  field with `aria-describedby` and `aria-invalid` (LT4).
- The hover card is a `role="group"` with `aria-label="Link details"`; its buttons are labelled `Copy link` and `Edit
  link`. It is a pointer affordance: Escape hides it.
- Every notice is the board notice (`role="status"`).
- The shortcut gives keyboard access to adding, changing and removing links. Below 768 px the bar commands are not
  offered (LT2).

### LT18 — Not in this version (links in text)

Links in connector labels, mind-map nodes, table cells, section names or any non-rich-text object; showing links in the
editor while editing (a rich-text editor); turning a text link into a link card ("create preview"); a canvas
right-click menu; following, hovering or copying a text link from the keyboard; a Link control in the Objects panel, or
the shortcut in its Content field; the Link and Copy link controls in narrow windows (the context bar not shown);
opening a link in the same tab; expanding a collapsed mind-map branch to reveal a linked node; links to several objects
or a selection; Copy link for several objects; linking typed addresses automatically; `mailto:`, `tel:` and every other
scheme; touch hover.

## Link cards (v52)

Version 52 adds **link cards** (the part **Link cards**, values LC1–LC9): an owner or editor pastes one web address
on the canvas and gets a card that shows the page's picture, title, short description and site, read once by Board's
link preview service. It adds one object type (`link`, document v22), the bar's label `Link` / `<n> links` and four
context-bar buttons, the card's looks drawn on the canvas, and one line in the About popover. It adds exactly two CSS
rules (the layout group's row and its pressed button) and no notice, dialog or panel. The look was approved in the journey mock-up v1
(2026-11-25); every value is restated below so it is checked, not inferred.

### Link cards

#### Terms

- A **card** is an object of type `link` (document v22). Its own keys: `url`, `title`, `description`, `site`,
  `asset` (a picture hash, or `null`), `layout` (`vertical` | `horizontal`), `state` (`loading` | `ready` | `linkOnly`)
  and `requestedAt` (milliseconds since 1970 by the paster's clock, a whole number). Like a picture it also has `x`,
  `y`, `width`, `height`, `page`, `section`, `group` and `order`. Whenever a browser writes a card's look it writes
  that look's size (table below). The document accepts any **card size** with any state (document v22's size rule,
  the union of the table's sizes), so after two concurrent edits merge a card may hold another card size (sync v18).
- **Stored rectangle.** A card's saved `x`, `y`, `width` and `height`. It is always what is drawn, hit-tested and
  outlined, and where the context bar is anchored: the face of the card's look is drawn **inside** it (**Drawing at
  the stored size**), whatever its size.
- **Document bounds.** Every rectangle keeps `x ≥ −1,000,000`, `y ≥ −1,000,000`, `x + width ≤ 1,000,000` and
  `y + height ≤ 1,000,000` (document v22). When a card gets a new size (a finish, a layout choice, a stale card's
  edit), when Change back to text puts a text object in a card's place, and when a paste places a card or a text
  object, the object is **kept within the bounds**: `x` becomes `min(max(x, −1,000,000), 1,000,000 − width)` and `y`
  becomes `min(max(y, −1,000,000), 1,000,000 − height)`. A size change or a conversion can only cross the right or
  bottom edge, so it shifts the object left and/or up just enough; that is the only case where it changes `x` or
  `y`.
- **Units.** Every length below is in board units. At 100% zoom one unit is one screen pixel. The card is drawn on the
  canvas (Konva), as a picture's body is, so it scales with the zoom; only the selection outline keeps a constant
  screen width. Every offset is from the card's top-left corner (its saved `x`, `y`).
- **Stale.** A card whose `state` is `loading` is stale when `now ≥ requestedAt + 20,000` (now by the viewing
  browser's clock). A stale card is drawn and treated as link-only everywhere in this part; its face is drawn inside
  its stored rectangle (306 × 288).
- **Look.** Each card has exactly one look, from its keys and the clock:

| Look | When | Size written (width × height) |
| --- | --- | --- |
| loading | `state: "loading"`, not stale | 306 × 288 |
| vertical | `state: "ready"`, `asset` a hash, `layout: "vertical"` | 306 × `210 + 20·Lt + (Ld > 0 ? 4 + 17·Ld : 0)`: 230, 250, 251, 268, 271 or 288 |
| horizontal | `state: "ready"`, `asset` a hash, `layout: "horizontal"` | 480 × 114 |
| title-only vertical | `state: "ready"`, `asset: null`, `layout: "vertical"` | 306 × 100 |
| title-only horizontal | `state: "ready"`, `asset: null`, `layout: "horizontal"` | 480 × 64 |
| link-only | `state: "linkOnly"`, or stale | 480 × 64 |

  `Lt` is the number of lines the title takes (1 or 2) and `Ld` the description's (0, 1 or 2; 0 when it is empty),
  wrapped as drawn (below). The browser that writes a vertical card measures them; every browser that draws it reads
  them back from the saved height, which is unique for each pair (`Lt, Ld` → height: 1,0 → 230; 2,0 → 250;
  1,1 → 251; 1,2 → 268; 2,1 → 271; 2,2 → 288). The saved counts **cap** what is drawn: every viewer draws at most
  `Lt` title lines and `Ld` description lines, and a text cut at its cap ends its last drawn line with an ellipsis
  (`…`). A viewer whose fonts wrap a text into fewer lines draws fewer (the space below stays empty), never more.
  Different system fonts may therefore show different words; the card's size and rows do not change. A vertical
  card is never taller than 288.
- **Preview service.** Where the paster's browser asks (link preview v1, API v16): on a team board,
  `POST /boards/:board/link-preview` on the team server; on a single-user board, `POST <origin>/link-preview`, where
  `<origin>` is the build's link preview origin (toolchain v6's compile-time constant `BOARD_LINK_PREVIEW_URL`; in a
  team build its local boards are single-user boards and use the same constant). A build where that constant is
  `null` has **no preview service** for single-user boards; team boards always ask the team server.
- **The address rules** are link preview v1's F1–F2. The browser applies them to the parsed address before asking,
  and never asks for an address that fails them.

#### Pasting an address (LC1, LC4)

**Place in the paste chain.** This order is authoritative. The canvas's paste handler runs: (1) the table/CSV step
(unchanged); (2) **the link step (new)**; (3) the existing media and object path, unchanged: the team board's paste,
or the picture and video step, which ends in the object paste (`clipboardCommand("Paste")`). The link step must run
**before** the picture and video step, because that step calls `preventDefault()` on every canvas paste it receives,
even one whose clipboard holds no file. The link step passes the event on untouched whenever the clipboard holds any
file (so files keep their table, picture and video paths) and whenever it does not act (below), so every such paste
reaches the media and object path exactly as today.

The link step acts only when **all** of these hold; otherwise it passes the event on untouched and the paste behaves
exactly as today ("Nothing to paste." or the earlier copied objects):

1. The event targets the canvas (`isCanvasPasteTarget`), is not already handled (`defaultPrevented`), and no text
   composition is running. Nothing is being edited: a paste inside a text editor or field never reaches the canvas.
2. The clipboard holds no file.
3. Editing commands are available: the existing editing command reason is empty (not read-only, not composing, no
   pointer gesture, no invalid draft), Tidy up is not open, and on a team board the person can edit and no vote is
   running. A viewer's paste therefore takes today's path and adds nothing.
4. `text/plain`, with leading and trailing whitespace removed, is **one address**: it contains no whitespace; it
   starts with a scheme and `://` (a letter, then letters, digits, `+`, `-` or `.`, then `://`); `new URL()` accepts
   it; and it is at most **1,000** characters (the text object's limit, so every card can change back to text).
5. It is not Board's own copy: the table step's existing test, applied to the **raw** `text/plain` before any
   trimming (an object clipboard exists, and the last copy's plain text equals that raw text or that copy was
   refused). A clipboard holding Board objects keeps today's path.

When it acts it calls `preventDefault()` and, by the address rules on the parsed URL and the length of its `href`:

**Allowed address → a card.** When the address rules pass **and** `new URL(trimmed).href.length <= 1000`. (`new
URL()` can lengthen an address, for example by percent-encoding non-ASCII characters, and a card's `url` is its
`href`, which document v22 limits to 1,000 characters.) One commit, one undo step, no notice:
- `url` is the parsed URL's `href`; `title`, `description` and `site` are `""`; `asset: null`; `layout: "vertical"`;
  `state: "loading"`; `requestedAt` is `Date.now()`.
- 306 × 288, centred on the view centre: `x = round(view.x − 153)`, `y = round(view.y − 144)`, then kept within
  the **document bounds**; on the current page; in the section under its centre (as a pasted picture); no group; on
  top of its band.
- It is selected at once (within 200 ms of the key press), and the arrival starts.
- With **no preview service**, the card is made link-only at once instead: `state: "linkOnly"`, `layout:
  "horizontal"`, 480 × 64 centred on the view centre and kept within the document bounds. No request leaves the
  page.

**Refused address → a text object (LC4).** An address that fails the address rules (another scheme such as `ftp://`;
an IP literal of either family, in any form `new URL()` normalises, such as `127.0.0.1`, `0x7f.1` or `[::1]`;
`localhost`; a name ending `.localhost`, `.local`, `.internal` or `.home.arpa`; a single-label name; a port other than
80 or 443; a user name or password) becomes one **text object** holding the trimmed text exactly. It is made as
Change back to text makes one (below), except its place: its default 320-unit width and its grown height are centred
on the view centre, `x = round(view.x − 160)`, `y = round(view.y − height ÷ 2)`, then kept within the document
bounds. Selected, not opened for editing. One undo step, no notice, no request.

**Allowed address too long → the same text object.** An address that passes the address rules but whose `href` is
longer than 1,000 characters becomes the same text object, holding the trimmed text (which step 4 keeps within 1,000
characters), placed and selected as above. One undo step, no notice, no request.

Text that is not one address (plain words, two addresses, an address with a space inside, `mailto:…`) is not touched
by the link step.

#### The arrival (LC7)

Only the paster's browser runs it, once for each card it pasted. Viewing a card never asks; copies, duplicates, board
files, imports, templates, undo and redo never ask again.

**The same board, still editable (the gate).** When the card is pasted the browser notes the **opening**: the
board's `boardId`, the `HostedBoard` object on a team board (none on a single-user board) and, on a single-user board,
the `LocalStore` object. The gate runs **before the upload** (step 4) and **again before the finish** (step 5, at the
commit). It passes only when all of these hold:
- the page is still mounted and the open board has the same `boardId`;
- **single-user:** this tab is still the board's **active local writer** through the same opening: the `LocalStore`
  in use is the noted object, it is still open (`active`), and the board is not read-only (this tab still holds the
  writer ownership). If the writer was lost (another tab took it, storage changed under it, a save found the stored
  board changed, the page was hidden), the arrival is **cancelled**;
- **team:** the same `HostedBoard` object is in use, the person's role is still owner or editor, and the **live
  editable document** is shown. While a version preview is shown (the board drawn is the preview, not the live
  board), the arrival **holds** at the gate until the live board is shown again; if that has not happened by
  `requestedAt + 15,000` ms, the arrival is **cancelled**;
- the card is still on the board with the same `id`, `url` and `requestedAt`, in `state: "loading"` (checked before
  the upload too, so a card deleted, undone or changed back to text is never uploaded for).

A **cancelled** (ended) arrival aborts what is still running and writes nothing (no picture, no edit). The card stays
`loading` and is drawn link-only once it is stale. Other passing reasons that the board cannot take an edit *now* do
not end it; they hold the finish (step 8).

1. **Ask.** `POST` with the body `{ "url": <the card's url> }` (`Content-Type: application/json`, `credentials:
   "omit"`, `referrerPolicy: "no-referrer"`): a team board through the team route with the person's bearer token; a
   single-user board through the public route with no `Authorization`. The request is aborted after **15,000 ms**.
2. **Answer.** Only a 200 whose body is well formed (API v16: `url`, `title` non-empty, `description`, `site`, and
   `picture` either `null` or `{ type, bytes }` with `bytes` base64 of at most 5,242,880 bytes) is a preview. Any other
   status (403, 404, 413, 422 `address_refused` or `preview_unavailable`, 429 `rate_limited`, 502, 503), a malformed
   body, a network failure or the abort gives the **link-only finish**.
3. **Thumbnail.** With a `picture`, the browser decodes the bytes and makes the thumbnail (below). If they do not
   decode or do not encode, the card is finished **without a picture** (ready, title-only look).
4. **Hold the picture, then name it.** The thumbnail is stored as an ordinary board picture before the card names it
   (after the gate above):
   - single-user: when holding it keeps the board's pictures within 50 MiB (the existing `PICTURE_LIMIT`, counted as
     the board's picture bytes are counted today, each hash once), it is written to the local picture store
     (`asset/<hash>`) and the tab's picture map; otherwise the card is finished without a picture. A store failure
     gives the link-only finish. **At the finish the budget is counted again** on the board as it is then (each hash
     once, the thumbnail included); if it is then over 50 MiB, the card is finished without a picture, and the stored
     record, named by nothing, is removed by the next save's clean-up;
   - team: through the existing picture upload, `PUT /boards/:board/assets/:hash`. `ok` → named; `full` (409
     `board_pictures_full`) → finished without a picture; any other answer → the link-only finish.
5. **Finish.** After the gate above, one edit to the card, made only if a card with the same `id`, `url` and
   `requestedAt` is still on the board in `state: "loading"` (otherwise nothing is written; a team upload that ends
   unused is cleared after 24 h as today, a local one at the next save's clean-up):
   - **ready:** `title`, `description` and `site` from the answer (`site` empty → the url's host), each cut to 300,
     500 and 100 code points as a guard; `asset` when held; `state: "ready"`; `layout` as the card has it
     (`"vertical"`); the size of its new look;
   - **link-only finish:** `state: "linkOnly"`, `layout: "horizontal"`, 480 × 64; texts stay `""`, `asset: null`.

   The **finish keys** are exactly `title`, `description`, `site`, `asset`, `state`, `layout`, `width` and `height`.
   The finish is built from the card **as the board holds it at the commit**: its `x` and `y` are read then, so a
   move made while the card loaded is kept, and they change only when the new size would cross the document bounds
   (shifted left and/or up just enough). Every other key (`page`, `section`, `group`, `order`, `url`, `requestedAt`)
   stays as the board holds it then. The card keeps the pasted `url`; the answer's `url` is not used. The finish is
   **one commit**: on a team board the adapter writes the rectangle (`x`, `y`, `width`, `height`, one shared value)
   and the finish keys in **one shared-document transaction** (sync v18). A single-user board commits the finish
   without recording it (`commit(next)`); a team board commits it as an **arrival** (sync v18: `arrivalOf`).

   **A move by another person at the same instant (team).** When another person's move of the card is concurrent
   with the finish, the two edits merge; both outcomes are **accepted**: either the finish's rectangle wins (the card
   is finished at the place the paster's board held, and that move is lost), or the move's rectangle wins (the card is
   finished at the moved place and keeps the loading size, 306 × 288, which is a valid card size; its face is drawn
   inside it). Neither is refused by the room, and neither is repaired later. Sync v18 **Verification** proves both
   arrival orders with two clients.
6. **Not an undo step.** The finish amends the paste's undo history instead of adding a step:
   - single-user: the browser writes the eight finish keys into every version of that card (the same `id`, `url` and
     `requestedAt`) held in the board's undo history, past and future, each version keeping its own `x`, `y` and
     every other key; a version whose `x` or `y` would put the new size across the document bounds is shifted left
     and/or up just enough. So no undo or redo ever brings back the loading look, and a move made while the card
     loaded keeps both its positions;
   - team: sync v18's `SharedUndo.amend`. A step this person made while the card loaded whose entry the arrival's
     values changed follows the existing stale-guard rule: a move's `geometry` entry holds the card's `width` and
     `height` too, so when the finish changes the card's size, that move **may no longer undo** after the arrival
     (accepted; when the finished size is the loading size, 306 × 288, it undoes as usual).
7. **Deadline.** If the finish has not been made by `requestedAt + 20,000` ms, the browser aborts what is still
   running (the request or the upload) and makes the link-only finish (with the same gate and holds).
8. **Held, never mid-gesture.** A finish waits while the paster is in a pointer gesture, composing or editing text,
   Tidy up is open, or the board cannot take an edit for a passing reason (the existing editing command reason is not
   empty; on a team board, also while `hosted.canEdit` is false: reconnecting, rejoining or recovering; a version
   preview holds at the gate instead, with its own 15,000 ms limit). On a single-user board a read-only board is not a
   passing reason: it means the writer was lost, and the gate cancels. It is made at the first moment after all of
   these end. If that moment is past the deadline, the link-only finish is made instead.
9. **Refused by the room (team).** When an arrival's edit is refused, whether the session refuses it before sending
   (too large) or the room answers `refused`, the session's existing refusal handling runs (the edit is dropped and
   the board rejoins), but **no notice shows**: the hosted board's refusal toast (`words.refusedEdit`) is not shown
   for an arrival's request. What the paster's browser then writes is sync v18's **one retry** rule, stated there
   once: one silent link-only finish, then nothing more.

**Undo and Redo around an arrival.** Each sequence below is checked by name (web modules v50 **Tests**, sync v18
**Verification**). "Finished" is the card with its finish keys; positions are its own top-left.

| Sequence | Single-user board | Team board |
| --- | --- | --- |
| paste → arrival → Undo → Redo | Undo removes the finished card; Redo brings it back finished | Undo removes the finished card; Redo restores it finished, under a fresh `id` (as today) |
| paste → move → arrival → Undo → Undo → Redo → Redo | Undo 1 moves the finished card back; Undo 2 removes it; Redo 1 brings it back finished at its pasted place; Redo 2 moves it again | When the finish changed the size: Undo 1 is refused with today's changed-by-others notice and that step is gone; Undo 2 removes the finished card; Redo 1 restores it finished at its moved place under a fresh `id`; Redo 2 has nothing to redo. When the size did not change, as single-user |
| paste → Undo before the arrival | The card is removed; an arrival that reaches its finish now finds no card and writes nothing. Redo brings the loading card back under its **same** `id`: if the arrival has not yet reached its finish, it finishes that card; if it already ended, the card stays `loading` | Redo restores the loading card under a **fresh** `id`, so the arrival never finds it; it stays `loading` |
| paste → Change back to text → Undo → arrival (the conversion and its Undo both before the arrival) | The arrival **applies**: Undo restored the card under its same `id`, `url` and `requestedAt`, still `loading`, so the gate and the finish find it; the finish is also written into the conversion's versions, so Redo and Undo of the conversion keep the finished card | The arrival is **dropped**: Undo restored the card under a fresh `id`, so the gate finds no card with the arrival's `id` and writes nothing (no upload if the gate runs before it); the card stays `loading`, is drawn link-only once stale, and is never fetched again |
| Change back to text → arrival → Undo | The arrival finds no card and writes nothing; Undo restores the loading card, which stays `loading` | The same, under a fresh `id` |

A card left `loading` this way is **never fetched again**; it is drawn link-only once 20,000 ms are past its
`requestedAt`. The single-user rows are checked in web modules v50 **Tests** and the team rows in sync v18
**Verification**, each sequence separately for the two modes.

**Stale cards.** A card can be left loading (the paster closed the tab, an arrival ended or was dropped, or a copy was
made while it loaded). Nothing is written for it (document v22 rule 5, sync v18): every browser draws the link-only
face **inside its stored rectangle** (306 × 288, **Drawing at the stored size**) and offers the link-only bar; the
stored rectangle is its hit area, its selection outline and the bar's anchor, so what is seen, clicked and outlined
agree. An edit a person makes to it other than moving, arranging, grouping, sectioning or deleting (a layout choice)
writes it as `state: "linkOnly"` with the link-only size (480 × 64), its top-left kept (except for the document
bounds shift), in that same edit. Change back to text works on it as on any card.

**No notices.** Pasting a card or a text object, every finish, every failure and a refused arrival show no notice,
toast or error text. There is no retry control.

#### The thumbnail (LC8)

Made in the paster's browser from the answer's picture bytes:
- The type is sniffed from the bytes with the existing picture sniffer (PNG, JPEG, GIF, WebP); anything else means no
  picture. It is decoded with `createImageBitmap`; a GIF gives its **first frame**.
- Scale `s = min(1, 640 ÷ max(width, height))`; the thumbnail is `max(1, round(width × s))` × `max(1, round(height ×
  s))`: at most **640** on its longer side, never enlarged. It is drawn on a canvas with high-quality smoothing.
- It is encoded as **PNG** when any pixel of the drawn thumbnail has alpha below 255, otherwise as **JPEG at quality
  0.85**. The stored picture is `{ bytes, mime, pixelWidth, pixelHeight }` of the encoded thumbnail, named by the
  SHA-256 of its bytes, like any other picture (its type sniffed again equals `mime`).

#### The card's looks (LC2)

The approved mock-up drew each card as a CSS box with `box-sizing: border-box` and `border: 1px solid #e3e1e6`, so its
picture, dividers and body sit **inside the border**. Every value below is that approved box translated to canvas
coordinates, offsets from the card's top-left corner (its saved `x`, `y`), the 1-unit border already counted.

Common to every look:
- **Frame.** A rectangle of the look's size with corner radius **8**, filled `#ffffff`, and a **1-unit border**
  `#e3e1e6` lying inside the rectangle: drawn last, as a stroke of width 1 on the rectangle at 0.5, 0.5 of
  `width − 1` × `height − 1`, radius 7.5. No shadow.
- **Inner box.** The rectangle inside the border: 1, 1, `width − 2` × `height − 2`, corner radius 7. The picture, the
  dividers and every fill are clipped to it; nothing is drawn under the border.
- **Type.** Font family `system-ui`. Title: 14, line height 20, weight 600, `#1e1c22`. Description: 12, line height
  17, weight normal, `#5f5b66`. Site: 12, line height 16, `#5f5b66`, underlined. Address (link-only): 13, line height
  16, `#3d3942`, underlined. A text's position is the top of its first line box (Konva `Text` at that `y` with
  `lineHeight = line height ÷ font size`).
- **Underline.** The site and the address are underlined by a filled rectangle the card draws itself (not Konva's
  `textDecoration`): 1 unit tall, in the text's colour, from the text's left edge for the width of the drawn text (its
  ellipsis included), with its top edge **2 units below the text's alphabetic baseline** (the approved
  `text-underline-offset: 2px`). For a one-line text whose line box top is `t` and line height `L`, the baseline is
  `t + L ÷ 2 + (A − D) ÷ 2`, where `A` and `D` are the canvas `measureText` result's `fontBoundingBoxAscent` and
  `fontBoundingBoxDescent` in that font (the CSS line-box rule). In the approved capture the site's underline is the
  row 14 units below the site row's top.
- **Text cuts.** Text wraps at word boundaries (a word longer than the line breaks between characters) to the box
  width given, and is cut to the stated number of lines; a cut ends with an ellipsis (`…`). One-line texts never wrap.
- **Link glyph.** 14 × 14: the paths `M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1` and
  `M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1` in a 24-unit box scaled to 14, stroked `#8a8590`,
  width 2 (in the 24-unit box), round caps, no fill. It is centred on the 16-unit site row (its top 1 unit below the
  row's top) and its text starts 20 units right of the glyph's left (14 + a 6-unit gap). It stands in place of a site
  icon; no favicon is fetched.
- **Picture.** The card's `asset` picture, **cover-cropped** into its box: scaled by `max(boxW ÷ pixelWidth, boxH ÷
  pixelHeight)` and centred, the overflow cut. Until the picture is decoded (or if it never loads), its box is filled
  `#f1f0f3`, with no text.
- **Selection.** See **Selection, handles and keys**.

| Look | Parts (offsets from the card's top-left, inside the border) |
| --- | --- |
| loading | Picture box 1, 1, 304 × 159 filled `#f1f0f3`; a divider 1, 160, 304 × 1 `#efedf1`. A **spinner** centred at 153, 80.5 (the picture box's centre): a ring of radius 9.75, stroke 2.5, `#d8d5dc`, and over it an arc of the same ring in `#7051cf` spanning the top quarter (from −135° to −45°, 0° pointing right); it is still, not animated. Three bars, each 10 tall, radius 5, `#eeedf0`, at x 15: y 177 width 171, y 197 width 254, y 217 width 204 (62%, 92% and 74% of 276, rounded) |
| vertical | Picture 1, 1, 304 × 159; divider 1, 160, 304 × 1 `#efedf1`. Title at 15, 173, box width 276, at most 2 lines. Description at 15, `177 + 20·Lt`, width 276, at most 2 lines (none when empty). Site row top at `height − 25`: glyph at 15, `height − 24`; site text at 35, `height − 25`, width 256, one line |
| horizontal | Picture 1, 1, 111 × 112; divider 112, 1, 1 × 112 `#efedf1`. Title at 127, 11, width 338, one line. Description at 127, 35, width 338, one line (none when empty). Site row top at 87: glyph at 127, 88; site text at 147, 87, width 318, one line |
| title-only vertical | No picture, no description. Title at 17, 17, width 272, at most 2 lines. Site row top at 67: glyph at 17, 68; site text at 37, 67, width 252, one line |
| title-only horizontal | No picture, no description. Title at 17, 11, width 446, one line. Site row top at 37: glyph at 17, 38; site text at 37, 37, width 426, one line |
| link-only | Glyph at 17, 25; the card's full `url` at 37, 24, width 426, one line, in the address style. No title, picture or error text |

How the rows follow from the approved box: vertical body padding 12 / 14 / 14 below a 160-unit picture box that
includes its 1-unit divider (so the title starts at 1 + 160 + 12 = 173 and x 1 + 14 = 15), a 4-unit gap between
title, description and site, and 8 more above the site row; the content-fit height `210 + 20·Lt + (Ld > 0 ? 4 +
17·Ld : 0)` (230, 250, 251, 268, 271 or 288, kept) then leaves 8 units of padding below the site row, as the approved
288 capture shows. Horizontal: a 112-unit picture box that includes its 1-unit divider, body padding 10 / 14, the site
row at the bottom (113 − 10 − 16 = 87). Title-only vertical: padding 16, the site row at the bottom (99 − 16 − 16 =
67). Link-only: padding 16 left, the row centred in the inner box (1 + (62 − 16) ÷ 2 = 24). The title-only horizontal
look was not drawn in the mock-up; it takes the horizontal body's vertical padding (10) and the title-only look's
side padding (16).

A drawn line count is measured with the canvas's own wrapping in the font above (title box 276 wide; description box
276 wide). The site shown is the card's `site`.

#### Drawing at the stored size

The look (state, `asset`, `layout` and the stale rule) chooses the **face**; the stored rectangle `W × H` is its
frame. The values above are each look's at its written size (`w × h`, the looks table). At any other card size
(document v22) the same face is drawn in `W × H` by these rules, which give exactly the values above when `W × H` is
the written size:
- the frame and the inner box use `W` and `H` (as above); everything is clipped to the inner box;
- every left offset is kept; every box width (a text box, the vertical picture box and its divider, a loading bar)
  becomes its value plus `W − w`; the horizontal look's picture box and divider keep their left-hand place and width;
- rows measured from the top (the vertical picture box and divider, the title, the description, the loading bars and
  spinner) keep their offsets; the site row is anchored to the bottom, at `H − (h − its top)` (vertical:
  `H − 25`; horizontal and title-only horizontal: `H − 27`; title-only vertical: `H − 33`); the horizontal picture box
  and divider are `H − 2` tall;
- the link-only face's row is centred in the inner box: its top is `(H − 16) ÷ 2` and the glyph's top 1 unit below it,
  its left padding 16 (the address at 37, its box `W − 54` wide). A stale card at 306 × 288 so shows its address at
  37, 136 in a 252-unit box;
- a vertical face's line caps come from its stored height when it is one of the six content-fit heights (above), and
  are 2 and 2 at any other height.

The selection outline, the hit area and the bar's anchor are the stored rectangle in every case.

#### Selection, handles and keys

- **Outline.** A selected card is outlined like a picture: a rectangle at its stored rectangle, stroke `#518de0`,
  **2 screen pixels** at every zoom (`2 ÷ zoom` units), square corners, centred on the edge.
- **No resizing when a card is selected.** When **any** selected object is a card, no resize handles are shown and
  the selection cannot be resized by any path, for any role, in any look: neither its cards nor its other objects.
  The Objects panel's Wider, Narrower, Taller and Shorter are then disabled with the title `Link cards can't be
  resized.` (washi tape's text `Washi tape can't be resized.` wins when the selection also holds tape). Selections
  without cards keep today's handles and resizing, the tape and mind-node restrictions included (document v22 rule
  1). A card moves, arranges, joins sections, groups and pages as a picture does; it is never a connector end
  (document v22 rule 2).
- **Keys.** Delete and Backspace delete the selected cards (the existing Delete command and its text). Enter and a
  double-click do nothing on a card (as on a picture: there is no text to open). Cmd/Ctrl+C, X, V and D use the
  existing object clipboard and Duplicate; a copied card's plain text is its `url`, so a pasted copy is Board's own
  copy and is pasted as a card without asking again. A copy keeps every key, `state` and `requestedAt` included.

#### The context bar (LC3)

The existing context bar (`.context`) shows the link bar when **every** selected object is a card. A selection mixing
cards and other objects shows the generic bar exactly as today (label `<n> objects`, no link buttons).

| Selection | Bar, left to right |
| --- | --- |
| One card, loading look | `Link` · divider · **Open link** · **Change back to text** · the existing Arrange, Move to page (when shown today), Duplicate and Delete |
| One card, any other look | `Link` · divider · **Open link** · **Display vertical** · **Display horizontal** · **Change back to text** · Arrange, Move to page (when shown), Duplicate, Delete |
| Two or more cards | `<n> links` (for example `2 links`) · divider · Arrange, Move to page (when shown), Duplicate, Delete |

Tidy up is not shown on a link bar. The label is a `<span>` as the picture bar's `Image` is, followed by the existing
`<span class="divider">`. The bar is placed over the selection's stored rectangle, as for any object.

**Narrow windows.** When the context bar is not shown (below 768 px wide, or when it does not fit), as today for every
object, the link commands, like every bar command, are not offered: no other route offers Open link, the layout
buttons or Change back to text. This is a stated limit of this version; Delete, Duplicate and the keys keep their
existing routes.

**Buttons.** Each new button is the bar's existing `button.icon-button` (40 × 40) with an SVG icon of 20 × 20
(`viewBox="0 0 24 24"`, `fill="none"`, `stroke="currentColor"`, `stroke-width="1.8"`, `aria-hidden="true"`) and the
existing `<span class="tooltip">`:

| Button | `aria-label` and tooltip | Icon |
| --- | --- | --- |
| Open link | `Open link` | path `M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5`, round caps and joins |
| Display vertical | `Display vertical` | rect 6, 3, 12 × 18, `rx` 2; path `M6 11h12`; path `M9 15h6M9 18h4` with round caps |
| Display horizontal | `Display horizontal` | rect 2.5, 7, 19 × 10, `rx` 2; path `M9 7v10`; path `M12 10.5h6M12 13.5h4` with round caps |
| Change back to text | `Change back to text` | paths `M4 7V5h11v2M9.5 5v13M7.5 18h4` and `M15 14h5M18 11.5l2.5 2.5-2.5 2.5`, round caps and joins |

The two layout buttons sit together in one horizontal, labelled group, `<span class="link-layout" role="group"
aria-label="Link layout">`. The one matching the card's `layout` has `aria-pressed="true"`, the other
`aria-pressed="false"`. The group and the pressed button are drawn by exactly two new CSS rules, placed together
after `.context .paint-modes button[aria-pressed=true]` in `apps/web/style.css`:

```css
.context .link-layout { display: flex; align-items: center; gap: 4px; }
.context .link-layout button[aria-pressed=true] { background: #7051cf; border-radius: 6px; }
```

The first lays the pair out as a row with the bar's own 4 px gap, so the label, divider and all four link buttons
stand 4 px apart as in the approved bar (the mock-up placed them straight in `.context`, whose `gap` is 4px). The
second gives the pressed button the approved purple square with 6 px corners; its white icon comes from the existing
`button[aria-pressed=true]` rule. **Hover** is the bar's existing one, unchanged: an unpressed button gets the
`#f1eff5` background and a `#29272e` icon (`button:hover…` and `.context button:hover:not(:disabled)`); a pressed
button keeps its purple background and its icon turns `#29272e`, as the approved hover capture shows. No other rule
is added or changed.

**Enabled.** Open link is always enabled, for every role. Display vertical, Display horizontal and Change back to
text are disabled whenever the existing selection reason is not empty (a viewer, read-only, composing, a gesture);
then their tooltip shows that reason, and each carries `aria-describedby="selection-reason"`, as the bar's other
editing buttons do. Arrange, Duplicate and Delete keep their existing rules.

**Link-only look.** Both layout buttons are shown and the pressed one is the card's `layout` (`horizontal` after a
link-only finish). Choosing the other records the new `layout` (an undo step) while the link-only look stays 480 × 64
(there is one link-only look). On a stale card the choice also writes it link-only, as **Stale cards** says.

#### What the buttons do

- **Open link (LC6):** `window.open(url, "_blank", "noopener,noreferrer")`. Nothing is written, nothing is fetched by
  Board, and no notice shows. Viewers may use it.
- **Display vertical / Display horizontal:** one undo step setting `layout` and the size of the card's new look, its
  top-left (`x`, `y`) kept except for the document bounds shift. The browser that writes a vertical size measures
  `Lt` and `Ld`. Choosing the current layout does nothing.
- **Change back to text (LC5):** one undo step that removes the card and adds one **text object** in its place:
  - `text`: the card's `url`; no marks;
  - `x`, `y`: the card's saved top-left, kept within the document bounds (a card near the right or bottom edge
    gives a text object shifted left and/or up just enough); width **320** (the text tool's default width); height
    the existing grown height of that text in that width (as a text object's height grows with its lines);
  - text size **Medium**, colour neutral, alignment left (the text tool's defaults);
  - the card's page, section and group, and its place in the stacking order.

  The text object is selected and not opened for editing, and **focus moves to the canvas** (the scene element
  inside `<main>`, as Delete returns it), because the pressed button is removed with the link bar: an immediate
  Cmd/Ctrl+Z then reaches `<main>`'s key handler and undoes the conversion. One Undo removes the text object and
  restores the card
  exactly, thumbnail included (its picture stays held). It works in every look, loading included. A loading card
  changed back is gone, so an arrival that reaches its finish then finds no card with its `id` and `url` and writes
  nothing. Undo restores the card under its same `id` on a single-user board (an arrival that has not yet reached
  its finish still finishes it) and under a fresh `id` on a team board (no arrival ever finishes it); a restored card
  left `loading` is drawn link-only once 20,000 ms are past its `requestedAt` and is never fetched again (**Undo and
  Redo around an arrival**).

#### Viewers (LC6) and roles

Owners and editors (and board guests with an editor grant) paste cards, use the layout buttons and Change back to
text. A **viewer** who selects a card sees the same bar with only Open link enabled: both layout buttons (the current
one pressed, dimmed as disabled buttons are), Change back to text, Arrange, Duplicate and Delete are disabled, and no
handles show. A viewer's Cmd/Ctrl+V of an address adds nothing (today's path). The team route refuses viewers (access
v17); viewers' browsers never ask the preview service and never write a card.

#### The About line (LC9)

The About popover (the bottom-left "i", `section.information-panel`, label `About local storage`) keeps its existing
paragraph and gains a **second `<p>`**, directly after it, with no class and no inline style:

| Board | Second paragraph |
| --- | --- |
| Single-user board, with a preview service | `Links you paste are read by Board's link preview service, which fetches each page's title, description and picture. Only the link is sent, never your board.` |
| Single-user board, no preview service | None (the popover is as today) |
| Team board, every role | `Links pasted on team boards are read by Board's server, which fetches each page's title, description and picture. Only the link is sent.` |

Its look is the existing paragraph's, from existing rules only: 14 px `system-ui`, `#29272e`. The gap between the two
paragraphs is **14 px**: the first paragraph's default bottom margin (1em at 14 px), with `margin-top: 0` on the new
one from `.information-panel p`. That is the spacing the approved capture shows: the capture gave its added line an
inline `margin-top: 8px`, which collapses with the first paragraph's 14 px bottom margin, so the gap drawn was 14 px,
not 8. No margin, class or inline style is added. There is no consent prompt.

#### Accessibility

The new buttons are labelled buttons with tooltips; the layout pair is a labelled group with `aria-pressed`. No focus
moves on paste, arrival or a layout change; after Change back to text the selection moves to the text object as any
command's result does and focus moves to the canvas (above), so the keyboard keeps working. No live region or notice
is added. Below 768 px the link commands are not offered (**Narrow windows**).

#### Not in this version (link cards)

Interactive embeds, oEmbed and any HTML from a site; a native import from other whiteboard tools; a favicon; a retry control or any
failure notice; a consent prompt; hyperlinks inside text objects (see **Links in text**); pasting plain non-address text as text; resizing a
card; Open link, layout or Change back to text for several cards at once, or when the context bar is not shown (narrow
windows); an animated spinner; a server-side cache of previews; repairing a card whose concurrent move and finish
merged (both outcomes are accepted).
