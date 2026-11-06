# 0001 — Interaction and browser contract

Contract version: 33 (for 0006-W3 brief v1, 2026-11-06). Status: Draft.
Replaces [interaction v32](0001-interaction-v32.md), preserving its existing comments/inbox,
Home and selection controls. History behaviour is [hosted storage v7](0003-hosted-storage-v7.md),
[lifecycle v1](0006-board-lifecycle-v1.md); modules [v31](0001-web-modules-v31.md).
This contract supplies concrete rendering values; matching structure with different values fails.
Sizes are CSS border-box pixels, system-ui, desktop 1280 × 800; narrow 375 × 812.

## Entries, geometry and controls

Board details retains its actual 288-wide panel/12 vertical gap and every existing name/file/
account control. Insert Show version history after the file commands and before Close board
details. Preserve real selected-object context bar/handles at their app positions, including
existing overlap. Home's 208-wide card menu retains Show in workspace, Open, Open in new tab,
Copy link and Rename, in that order with existing separators; append a separator and Show
version history. Bell/account/Import/New board stay unchanged. No Trash or deletion item.

History reuses the Comments slot: absolute top72/right12/bottom80, width296, white, 1px
#e9e7ed, radius12, shadow 0 2px 8px #29202e0a, overflow hidden, vertical flex. Desktop rectangle
x972/y72/w296/h648. Header padding6/6/6/14, title14/700, Close32. Below 767.98px use left/right12,
bottom80, height min(42dvh,320px), width auto: x12/y412/w351/h320 at 375 × 812. One panel only.
Rows scroll independently; selected row is scrolled into view, including in the narrow sheet.
Use sibling Open/More buttons, never nested buttons. Row wrapper has the CSS values below;
Open covers the flexible column and More the 32px column. Give Open the heading as accessible
name and More “More options for {heading}”. Close is named Close version history.
Open is visually unstyled: zero padding/border/radius/min-height, transparent background,
inherited colour/font/alignment, min-width 0, internal vertical gap4. More retains the existing
32px icon control. Preserve the row's drawn text geometry without applying shared 40px-button
padding to Open.

Shared buttons min40 × 40, padding8/12, radius8, 1px #e8e7ed; primary #7051cf/white;
disabled opacity .45. Icons32 square. Version menu shares Home's width208, padding6, radius8,
border1px #e9e7ed/shadow; left=max(12,More.right−208), top=More.bottom+6, z-index8; one item Name version…. Existing Home items min32/padding6/10/6/28.

Dialogs centre with backdrop #29272e66, padding24, radius12, border1px #e9e7ed, width
min(420px,100vw−24px), heading20. Actions flex right/gap8. Labels/fields/counts use CSS below.
Error notes: #a32940 on #fdf0f2, 1px #f2cdd5, radius8, padding8/10, 13px/1.4.
Amber notes: #936000 on #fff5da, same radius/padding/font. Preview bar left12/top72/right320,
z4; rejoining spans right12. Narrow bar top124/left12/right12, vertical gap8, Back align-start.
Denied ending: centre50%/50%/translate(-50%,-50%), min(420px,100vw−24px), padding24,
white/border1px #e9e7ed/radius12, centred text, heading20; remove protected board UI first.

## Focus and behaviour

History opening focuses its heading tabindex=-1; next Tab Close, Save when permitted, newest-first
Open/More pairs, Restore when a permitted retained preview is selected. Selecting a row focuses
the preview heading. Back to current version returns focus to that row. Close restores its exact
opener: board-details entry or, after Home navigation back to files, that card's menu entry.
Escape closes a row menu to More, then history to its opener. No new global shortcut.
Save/Name initially focus Name (optional); Tab description, Cancel, Save version/Save name.
Escape cancels to opener. Restore/reconfirm focus Cancel, then Restore this version. Changed
head focuses Review current version; show refreshed current board before reselect/reconfirm.
Pending/in-flight restore has no Cancel/Escape dismissal. Pending Retry is focused; known-failed
restore focuses Cancel. Focus ring 3px #7051cf/offset3; preserve existing focus styles elsewhere.

During an effective editor/owner's history preview, retain the full editor toolbar exactly as
on the current board, including editing tools and Templates at their existing positions. Disable
every toolbar action except Pan, including Select, placement/drawing tools, Templates and Comment;
Templates stays visible but cannot open/load. On entering any historical preview, including
viewer/guest previews, explicitly activate Pan before the preview request/paint: Pan tool has
aria-pressed=true, Select tool has aria-pressed=false and is disabled. Pan stays active through
preview loading/failure/expiry and selection changes. Zoom remains usable. A preview-specific state must
override palette hiding without giving edit permission; ordinary viewer/guest palettes retain
their existing smaller control set, with their edit/comment actions disabled during preview.
On Back to current version, closing a selected preview, Review current version or a successful
restore/rejoin of that previewing tab, keep Pan as the active tool; do not restore the previous tool or automatically
press Select/Comment. Once current content is available, enable controls by the current role;
a later explicit tool choice may replace Pan. Entering the history list alone does not change
the current tool. The hosted hook's generic forced-Select path must not override this preview/
return handoff. Non-previewing collaborators retain their ordinary current tool/draft behaviour;
outside the preview handoff, ordinary hosted readOnly behaviour remains unchanged.
History preview disables board editing and board Undo/Redo; presence following stops. Current comments are hidden; return to current to display them. Viewers/granted
viewer guests have no Save/Name/Restore/More controls. Current access loss clears protected
paint/copy immediately and focuses the generic heading. All timestamp surfaces use hosted
storage v7's viewer-local Intl formatter, including reviewed-at text; allow wrapping. Stored/API
instants are server values, never a painted fixed UTC label.

## Exact words and row metadata

`{time}` and `{reviewedAt}` mean the local formatter's full output including local zone;
`{actor}` is the board label appropriate to that row/event; `{heading}` is the selected version
display heading. For the restore confirmation's author fragment only, derive the view-only
`{confirmationAuthor}` as selectedVersion.namedBy ?? selectedVersion.actor: a non-null naming
label takes precedence over capture actor even when both differ. If namedBy is null, use the
capture actor; if both are null, show time alone, with no author placeholder or dangling “ · ”.
This derived label changes no API/stored metadata and never replaces the actual restoring actor
in Restored by / Rejoining / Rejoined copy. Fresh confirmation keeps its drawn heading/time
layout without adding an author fragment.
Automatic version subtitles carry the save reason only, avoiding a second Automatic.

| Control/state | Exact words (separate elements divided by /) |
| --- | --- |
| Entry / heading | Show version history / Version history |
| Limits | Newest 50 versions · Up to 30 days / Named versions expire too. |
| Actions | Save version… / Name version… / Restore this version / Back to current version |
| Automatic headings / reasons | Automatic version / Checkpoint (reason checkpoint); Last collaborator left (reason last_close) |
| Other generated headings | Initial version / Manual version / Before restore / Restored from {sourceName} |
| Initial / manual / named metadata | Initial capture / Saved by {actor} / Named by {actor} · Automatic checkpoint |
| Restore metadata | Replaced state · Automatic checkpoint / Restored by {actor} · Current version |
| Preview heading / secondary | {heading} · Read-only preview / {time} · Board: {title} |
| Normal footer | Current comments appear after you return to the current version. |
| After restore footer | Current comments are kept. Close history to open Comments. |
| Viewer/guest footer | You can browse history. Saving, naming and restoring require edit access. |
| Save dialog | Save version / Save the latest server-confirmed board. Unposted comments and unsaved tab edits are not included. / Name (optional) / Description (optional) / Cancel / Save version |
| Name dialog | Name version / {time}. Naming this version does not renew its age. / Name (optional) / Description (optional) / Cancel / Save name |
| Restore confirmation | Restore this version? / {heading} / {time} · {confirmationAuthor} / The current board will be kept as “Before restore”. This version becomes a new current version on the same board. / Current comments and mention read status are kept. Everyone will rejoin; board Undo and Redo will be cleared. / Cancel / Restore this version |
| Restored banner | Version restored / {heading} is current. The replaced board is kept as Before restore. |
| Rejoining | {actor} restored this board · Rejoining… / Edits and comments are paused. Previous edits will not be resent. Unposted text is kept for review. |
| Rejoined | {actor} restored this board · Rejoined / Board Undo/Redo cleared. Earlier unsaved edits were not applied. Your unposted comment is kept; review it before posting. |
| Kept draft note | Unposted text kept in this tab. Nothing was sent. |
| Empty | No versions yet / Versions will appear after the first confirmed save. |
| List loading | Loading version history… |
| List failed | Couldn’t load version history / Try again when Board’s server is available. / Retry |
| Preview loading | Loading version… / Back to current version |
| Preview failed | Couldn’t load this version / The preview is unavailable. Try again. / Retry / Back to current version |
| Expired | This version is no longer available. / Choose another version or return to current. / Back to current version |
| Board denied | This board is not available. / You may not have access, or it may no longer be available. / Back to files |
| Role denied | Action not available / You need edit access to save, name or restore versions. Nothing was changed. / Back to history |
| Stale confirmation | The board changed / Someone edited the current board after you opened the confirmation. Nothing was restored. / Review the latest current version before confirming again. / Cancel / Review current version |
| Fresh confirmation | Restore this version? / {heading} · {time} / The current board changed. You reviewed it at {reviewedAt}. Restore now keeps that latest state as “Before restore”. / Current comments are kept. Everyone will rejoin with board Undo/Redo cleared. / Cancel / Restore this version |
| In flight | Restoring version… / Edits and comments are paused while Board keeps the current state and restores the selected version. / Wait for confirmation before editing. / Restoring… |
| Uncertain | Restore not confirmed / Board has not confirmed whether the restore completed. Editing stays paused. / Retry checks the same restore request. It will not restore twice. / Retry |
| Known failed | Couldn’t restore version / The restore failed. The current board and its history were not changed. / Try again when Board’s server is available. / Cancel / Retry |
| Save/name failure | Couldn’t save version. Your text is kept. Try again. / Couldn’t save name. Your text is kept. Try again. / Retry |

Unnamed automatic entries use Checkpoint or Last collaborator left as their subtitle; naming
such an entry uses Named by {actor} · Automatic checkpoint as drawn. Initial/manual/restore
metadata retain the words above. Outside the confirmation-specific fallback defined above,
null actor omits its own row/event fragment rather than inventing an author; named metadata
uses namedBy. For Ready for launch, actor=null and namedBy=ana, so the confirmation shows the
local time followed by “ · ana”. A named manual version with namedBy=ana and actor=ben also
attributes confirmation to ana; with namedBy=null/actor=ben it shows ben, and both null show
time alone. Blank-name restored sources use their generated heading. User text always renders
literally. Counter pattern is `{codePoints} / 100` or `{codePoints} / 500`.

## Synthetic fixture and time assertions

Workspace Acme, second workspace Studio; Home titles Launch plan, Brand moodboard, Q3 roadmap,
Team retro, Customer interviews. Owner ana, editor ben, viewer mia, granted viewer guest lee;
accounts use example.com. Launch plan contains Rose stickies 240 × 240 at board coordinates
(-420,-200),(-80,-200),(-250,110), shown at desktop (220,200),(560,200),(390,510), zoom100%:
Interview five customers; Pick the launch date; Draft the pricing page. Named preview/restored
state is Launch plan — draft and changes the second text to Launch on Thursday, same IDs/geometry.

Current root: Can we lock this before the pricing page goes out? Reply: Yes. Friday works if legal
signs off by Thursday. Both by ana. Ben's unposted plain text is @ana, please confirm Friday.
(28 code points, no picked mention). Comment pin at x770/y298/w32/h32, authoritative corner
(770,330); card x438/y298/w320. Card grows for draft note without changing its anchored position.
App-rendered relative comment ages/colours use existing rules, not fixed screenshot ages.

Use these server instants for deterministic comparisons, without hardcoding their display strings:

| Newest first heading | ISO instant | Reason / subtitle |
| --- | --- | --- |
| Automatic version | 2026-11-06T10:20:00Z | last_close / Last collaborator left |
| Manual version | 2026-11-06T10:10:00Z | manual / Saved by ben |
| Ready for launch | 2026-11-06T10:00:00Z | checkpoint, named by ana / Named by ana · Automatic checkpoint |
| Automatic version | 2026-11-06T09:30:00Z | checkpoint / Checkpoint |
| Initial version | 2026-11-06T09:00:00Z | initial / Initial capture |

After restore at 2026-11-06T10:25:00Z insert Restored from Ready for launch, then Before restore,
above those five. The expected reviewed-at instant is 2026-11-06T10:24:00Z. Server test clock must
remain inside the 30-day window. Generate real capture events or isolated synthetic room fixtures;
never paint DOM to simulate history. All displayed times equal the browser's local formatter.
Check an en-US/America/Panama context and en-GB/Europe/Berlin context using identical instants;
assert each local date/minute/zone and locale order, not an English fixed UTC string. This is a
focused timezone assertion in Chrome, not a browser matrix. Restore metadata order uses ordinal,
not equal minute labels. The capture at 10:20 is last-close, not a 20-minute automatic interval.

Save fields: Ready for review (16 / 100), Customer interviews complete. (29 / 500).
Name fields: Ready for launch (16 / 100), Launch on Thursday after review. (32 / 500).
Counts of these strings are Unicode code points. Ready for launch/Ready for review are 16
including spaces; preserve exact strings and do not change a counter to match an assumed count.

## Values as CSS

Equivalent selectors must preserve computed values below. Use a row wrapper with sibling Open
and More controls; the wrapper receives the row grid/spacing/background. Inherit the existing
Comments shell/header and shared modal/buttons with the explicit geometry above.

```css
.history-limit { padding:8px 14px; border-bottom:1px solid #f0eff3; font-size:12px; line-height:1.45; color:#79737f; }
.history-actions { padding:10px 14px; border-bottom:1px solid #e9e7ed; }
.history-actions button { width:100%; }
.history-list { overflow:auto; }
.history-row { display:grid; grid-template-columns:minmax(0,1fr) 32px; gap:4px 6px; width:100%; min-width:0; padding:12px 14px; border:0; border-bottom:1px solid #f0eff3; border-radius:0; background:white; text-align:left; font-size:13px; line-height:1.45; }
.history-row.current { background:#f5f0ff; color:#7051cf; box-shadow:inset 3px 0 #7051cf; }
.history-row strong { font-weight:600; }
.history-row small { grid-column:1; font-size:12px; color:#79737f; }
.history-row .comment-icon { grid-column:2; grid-row:1 / 4; }
.history-footer { padding:12px 14px; border-top:1px solid #e9e7ed; margin-top:auto; display:flex; flex-direction:column; gap:8px; }
.history-footer p { margin:0; color:#79737f; font-size:12px; line-height:1.45; }
.history-state { display:flex; flex-direction:column; align-items:center; gap:8px; padding:40px 20px; text-align:center; color:#79737f; font-size:13px; line-height:1.5; }
.history-state strong { color:#29272e; font-size:14px; }
.history-state.error strong { color:#a32940; }
.history-state p { margin:0; }
.history-banner { position:absolute; top:72px; left:12px; right:320px; z-index:4; display:flex; align-items:center; gap:12px; padding:12px; background:white; border:1px solid #e9e7ed; border-radius:12px; box-shadow:0 2px 8px #29202e20; font:13px/1.45 system-ui; }
.history-banner .history-summary { flex:1; min-width:0; }
.history-banner strong,.history-banner small { display:block; }
.history-banner small { color:#79737f; font-size:12px; }
.history-banner.amber { background:#fff5da; color:#936000; }
.history-banner.wide { right:12px; }
.history-dialog { width:min(420px,calc(100vw - 24px)); }
.history-dialog p { line-height:1.5; }
.history-dialog label { display:block; margin:12px 0 6px; font-weight:600; font-size:13px; }
.history-field { display:block; width:100%; min-height:40px; padding:8px 12px; border:1px solid #e8e7ed; border-radius:8px; background:white; }
textarea.history-field { height:96px; resize:none; }
.history-count { display:block; margin-top:4px; color:#79737f; font-size:12px; text-align:right; }
.history-dialog .comment-note { margin:12px 0; }
.history-unposted { margin:0 10px 10px; }
.history-focus { outline:3px solid #7051cf; outline-offset:3px; }
@media(max-width:767.98px) {
 .history-banner { top:124px; right:12px; align-items:stretch; flex-direction:column; gap:8px; }
 .history-banner button { align-self:flex-start; }
}
```

## Verification boundary

The brief defines 27 state comparisons, behaviour/focus and race assertions, including narrow
history. Compare declared rectangles within 0.5 CSS px, exact computed colour/font/spacing and
exact words apart from locally formatted timestamps and existing dynamic relative-age labels.
The browser check emits a failure for missing controls/states; a screenshot alone proves no
transaction, permission or retry. Safari samples are selected at review.
