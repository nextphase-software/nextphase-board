# 0001 — Interaction and browser contract

Contract version: 34 (for 0006-W4 brief v1, 2026-11-07). Status: Draft.
Replaces [interaction v33](0001-interaction-v33.md). Existing active-board history, Comments,
selection controls, toolbar and local/file controls retain v33 values. This version replaces
its no-Trash entry exclusion and adds the values below. Behaviour: [hosted storage v8](0003-hosted-storage-v8.md),
[lifecycle v2](0006-board-lifecycle-v2.md); modules [v32](0001-web-modules-v32.md).
Every value is concrete: equivalent structure with different values fails. CSS border-box,
system-ui, desktop 1280 × 800, narrow 375 × 812, device scale 1. No new font/hue/icon/animation.

## Sidebar and entries

Home sidebar x0/y0/w240/h800, padding12/gap4, white, border-right1px #e9e7ed. Existing workspace
order is retained. Immediately after EACH currently owned workspace row insert visible Trash,
accessible name Trash for {workspace}; then the next workspace row, before Boards in this browser.
No workspace-header Trash button. An owned Acme and Studio fixture yields Acme x12/y147/w215/h36,
Trash for Acme x12/y187/w215/h36, Studio x12/y227/w215/h36, Trash for Studio x12/y267/w215/h36.
The local footer keeps margin-top:auto/border-top1px #e9e7ed/padding-top8 at its existing bottom.
Trash uses the existing sidebar row: flex align-center/justify-start, full width, height/min-height36,
padding0/10, gap10, border0/radius8, transparent background, #29272e, 14px system-ui/400.
A decorative blank 20px slot aligns its text with workspace names; no new icon. Hover #f1eff5;
selected AND selected-hover #f5f0ff/#7051cf/600, aria-current=page only on the selected row.
On Trash the parent workspace/Recents is not selected. Non-owners see no Trash row.
At max-width599.98px preserve sidebar160, row padding0/4/gap6/height:auto/min-height36;
workspace-name wrapping and 10px role labels stay. New focus uses 3px #7051cf/offset3.

Owner Home card menu appends separator + Move to trash… after Show version history. In Recents
order is Show in workspace, Open, Open in new tab, Copy link, Rename, Show version history,
Move to trash…; workspace menus omit only Show in workspace. Non-owner menus omit Move.
Keep the 208px menu/padding6/border1px #e9e7ed/radius8/shadow0 2px 8px #29202e20; items min32,
padding6/10/6/28/radius6; hover/focus #f3f0f8. Move text #a32940, otherwise inherited transparent
background. Recents fixture menu x297/y169/w208/h303, Move x304/y433/w194/h32; original items
retain their positions. Details x12/y68/w288, padding18/gap12: owner Move after Show version
history at x31/y427/w250/h40; Close at y479, panel h470. Non-owner h418/Close y427.
Actual selected-object context bar x12/y134/w783.078125/h40, handles/name field remain, including
the existing overlap. No local-board lifecycle action. Board file bar/palette/zoom stay.

## Dialogs, Trash rows and state values

Topbar x240/y0/w1040/h64. Content x240/y64/w1040/h736, padding24/32, vertical scroll; content
origin x272/y88. Heading24px/600, workspace chip next to it/gap10/bottom20. Explanation padding12,
bottom16, #f3f0f8/#45434d, 1px #e9e7ed/radius8, 13px/1.5. List gap12. Rows grid flexible metadata
+ max-content actions/gap16/padding16/**align-items:center**, white/1px #e9e7ed/radius12/shadow0 2px 8px #29202e0a.
Metadata vertical gap4, title14px/600, body13px/1.5, times12px/#79737f/overflow-wrap:anywhere.
Standard row buttons min40×40/padding8/12/radius8/1px #e8e7ed; group flex-wrap/gap8.
Restore/Open board and Retry in Move-uncertain/Restore-failed/Restore-uncertain states use
#7051cf/white. Trash-list-failure Retry uses the state-action exception below: white with
#79737f text, 13px/19.5px/400. **Known Move failure Retry is destructive: #fff on #a32940,
border #a32940**, matching its Move confirmation, not the primary purple Retry. Disabled opacity
.45. Destructive outlined/menu/details text remains #a32940.
Pending/uncertain notes #936000 on #fff5da, 1px #e9e7ed/radius8/padding12/margin-top12,
13px/1.5; row notes span all columns, margin0. The Board restored success note instead uses
existing confirmation/panel colours: **#fff background, 1px #e9e7ed, #29272e text**; secondary
#79737f. Keep radius8/padding12/font13px/1.5. Do not apply the amber note palette to success.

Dialog centres at50%/50%, width min(420px,100vw−24px), max-height calc(100dvh−100px), overflow:auto,
padding24, border1px #e9e7ed/radius12/white, backdrop #29272e66; h1 20px/700/margin12/0.
Paragraph14px/1.5/margin14px/0 (override Home's paragraph reset); right actions/gap8.
Destructive confirm white on #a32940/border #a32940; hover same. Error note #a32940 on #fdf0f2,
1px #f2cdd5/radius8/padding8/10/font13px/1.4. Dialog amber #936000/#fff5da, same padding/font.

All new buttons follow the existing shared interaction rules explicitly: ordinary Cancel,
Refresh status, Back to files and outlined Permanently delete… are white with
#29272e text (destructive outlined text #a32940), border1px #e8e7ed; enabled hover #f1eff5 keeps
that text. Primary Restore/Open board and Move-uncertain/Restore-failed/Restore-uncertain Retry
hover #6142be/#fff. Destructive
Move/Permanently delete confirms and the known-Move-failure Retry keep #a32940/#fff/border
#a32940 on hover, using the drawn destructive override. Card menu items instead retain
#f3f0f8 on hover/focus; sidebar rows retain their exact hover/selected values above. No new
command button is a toggle or carries aria-pressed=true. Shared aria-pressed=true behaviour,
if used by existing toggles, is #7051cf/#fff including hover. Pointer :active adds no rule,
transform or persistent pressed state: retain that button's current hover palette while held.
Disabled/aria-disabled controls use opacity .45/cursor:default and never activate/hover-change;
enabled cursor:pointer. All new controls use focus-visible3px #7051cf/offset3 except the existing
card-menu focus fill/outline:none already specified. No pressed state replaces aria-current
selection on navigation rows. The failed/denied/deleted state-action exceptions below override
the shared text size/colour for Retry and Back to workspace, preserving their white fill/border,
neutral hover, focus and disabled rules.

Compact mixed-list purging rows contain only Deletion pending, the secondary line and Refresh
status; **no continuation note**. At desktop they are **77px** high: title14px/21px, secondary
12px/18px, metadata gap4 (43px), padding16 each side and 1px border. Actions align centre with
metadata. The standalone pending-result row additionally has the amber continuation note below
both columns, using the existing row gap16 and note padding12/radius8/font13px/1.5; its height
is content-driven. At narrow width both variants wrap/stack and height is auto. Resumed moving/
restoring rows use this compact row shell, label14px/600, Refresh status only, auto height with
min-height77px on desktop; no destructive/retry/cancel control, title or date not in the list.

Ordinary in-flow states below the explanation use flex-column/centre/gap8/padding40/20.
State headings (empty/loading/failed/denied/deleted) are **14px/21px/700**, #29272e except failed
#a32940; secondary text13px/19.5px/400/#79737f. This weight700 is specific to state headings:
the Trash page heading stays24px/600 and metadata row titles/labels stay14px/600. Actions inside
failed/denied/deleted states (Retry or Back to workspace) are **13px/19.5px/400/#79737f**, white,
min40px high, padding8/12, 1px #e8e7ed/radius8; neutral hover #f1eff5 retains #79737f text.
No spinner.

**Denied Trash layout exception:** retain the plain Trash title at x272/y88/w976/h28 with its
20px bottom margin, but omit both workspace chip and retention explanation entirely, with no
reserved gap. The state begins **x272/y136/w976/h176.5** at1280×800; padding40/20 puts the
14px/21px/700 heading at y176 and Back to workspace at y232.5/h40. Failed/deleted retain the
chip/explanation and state x272/y217/w976/h176.5; headings y257, actions y313.5/h40. Workspace
navigation/topbar retain only context independently authorized by current membership; no denied
board metadata is shown. At narrow375px the denied state starts x172/y136/w191, no chip/explanation,
uses state padding24/10 and natural height; text/buttons wrap under the existing narrow rules. Narrow content x160/y64/w215/h748,
padding24/12/usable width191; heading wraps/gap8, rows one column/padding12/gap12, actions stack
full-width, explanation padding10, state padding24/10. Dates wrap; lower rows scroll. History
keeps the existing panel rectangle x972/y72/w296/h648, narrow v33 sheet unchanged.

Generic ending is a SECTION of natural content height, centred50%/50%/translate−50%/−50%,
width min(420px,100vw−24px)/padding24/white/1px #e9e7ed/radius12/centred text/heading20px/700.
Never inherit viewport main height/min-height. Status line13px/1.5/#79737f says **Returning to Home…**.
Home unavailable toast: bottom24, left calc(50% +120px), translateX−50%, padding10/14,
1px #e1dce8/radius10/#f3f0f8, text #29272e; narrow left50%. It reveals no protected metadata.

## Exact words

{title}/{workspace} are authorized literal text. {time}, {deadline} use the viewer's full local
Intl output including zone from hosted storage v8. Separators below divide distinct elements.
All apostrophes/ellipsis/case are significant. Existing Back to files labels remain.

| State/control | Exact words |
| --- | --- |
| Sidebar / Trash heading / topbar | Trash / Trash / {workspace} · Trash |
| Move entry | Move to trash… |
| Explanation | Only workspace owners can open Trash. Boards stay here for 30 elapsed days. Nobody can open them until restored. History keeps its original expiry dates; old mention notices do not return. |
| Move confirmation | Move to trash? / {title} · {workspace} / Everyone will lose access, including people with this board open. / The current board, comments, permissions and unexpired history stay in Trash for 30 elapsed days. History keeps its original expiry dates. / If moved now, restore before {deadline}. The server confirms the exact deadline. / Cancel / Move to trash |
| Moving | Moving to Trash… / Wait for Board to confirm. Everyone’s access is ending. / Moving… |
| Known move failure | Couldn’t move board / The board was not moved. Everyone still has their current access. / Try again when Board’s server is available. / Cancel / Retry |
| Move uncertain | Move not confirmed / Board has not confirmed whether the move completed. Do not assume the board is available. / Retry checks the same move request. It will not move the board twice. / Retry |
| Valid row | {title} / Deleted {time} / Restore before {deadline} / Restore / Permanently delete… |
| Expired row | {title} / Restore deadline passed {deadline} / Restore / Refresh status / Restore deadline passed. Deletion pending. This board cannot be restored. |
| Mixed-list expired row | {title} / Deleted {time} / Restore deadline passed {deadline} / Refresh status / Restore deadline passed. Deletion pending. |
| Empty | Trash is empty / Boards you move to Trash appear here. |
| Loading | Loading Trash… |
| Failed | Couldn’t load Trash / Board’s server didn’t answer. No cached boards are shown. / Retry |
| Denied | Trash is not available / Only the current workspace owner can open Trash. / Back to workspace |
| Restoring | Restoring… |
| Known restore failure | The board is still in Trash. Nothing was restored. Retry when Board’s server is available. / Retry / Permanently delete… |
| Restore uncertain | Board has not confirmed the result. Retry checks the same restore request; it will not restore twice. / Retry / Permanently delete… |
| Restored | {title} · Board restored / Restored to {workspace} · Same board and link / Open board / The same board and link are available again. Current comments and unexpired history are kept. Old mention notices do not return. Some older versions may have expired. |
| Empty history after confirmed Trash return | No retained versions / Some older versions may have expired. Restoring access does not renew history. |
| Resumed moving row | Moving to trash… / Refresh status |
| Resumed restoring row | Restoring… / Refresh status |
| Delete confirmation | Permanently delete? / {title} · {workspace} / This cannot be undone. Everyone’s access has ended. Board will remove this board, its comments, history and Board-managed backup copies. / Downloaded files and provider recovery copies are not erased by this action. / Cancel / Permanently delete |
| Deleting | Permanently deleting… / Access has ended. Wait for Board to confirm deletion. / Deleting… |
| Compact list pending row | Deletion pending / Access has ended. Stored data is still being removed. / Refresh status |
| Standalone pending result | Deletion pending / Access has ended. Stored data is still being removed. / Refresh status / Deletion will continue automatically. Refresh checks progress; it does not start another deletion. |
| Deleted | Board permanently deleted / Deletion is complete. This board cannot be restored. / Back to workspace |
| Open-board ending | This board is not available. / You may not have access, or it may no longer be available. / Returning to Home… |
| Home notice | This board is not available. |
| Direct old link | This board is not available. / You may not have access, or it may no longer be available. / Back to files |

Every restored confirmation includes Some older versions may have expired., including a
non-empty retained-history result. This neutral wording claims no cause/time of expiry. When
resumed restoration lacks an authorized title, omit the {title} · prefix and show Board restored.
The empty-history wording above applies on return from the confirmed tab-memory receipt;
ordinary W3 empty states stay unchanged. Do not add stored/transport expiry evidence.
Known restore-failure and uncertainty row notes retain their drawn amber palette. The original
in-flight restore retains its authorized row metadata until purge/access loss; disabled
Restoring… replaces actions. After reload the distinct resumed row uses only the current
owner-authorized Trash list response, which supplies no title/dates for moving/restoring;
never substitute cached metadata or status dates. Refresh status GET/refetch resolves progress,
without a new mutation. Resumed moving never announces Deletion pending.
Restore-uncertain shows Permanently delete… disabled. Expired Restore is disabled/skipped.
Once purging starts replace all title/date-bearing row elements with the content-free pending
row; the mixed-list expired metadata is only for the pre-purge expired state. Successful restore
shows a temporary receipt, removed on next refresh/navigation. Complete deletion shows no title.

## Focus and state handoffs

Menu initially Open; arrow traversal includes owner-only final Move to trash…. Escape returns
to selected card. Details Tab order: Back to files → Sign out → Board name → Save a copy to file
→ Show version history → owner-only Move to trash… → Close board details. Local/member omit Move.
Home sidebar order from account: Notifications → Recents → Acme → Trash for Acme (owner only)
→ Studio → Trash for Studio (owner only) → Boards in this browser → Import board file… → New board.
Other workspace sets follow current order with Trash immediately after owned rows. No extra
header Tab stop. Enter Trash focuses h2 tabindex−1; next Tab first enabled row action. Loading/
empty focuses state heading; failure heading then Retry; denied heading then Back to workspace.

Confirmations focus Cancel → destructive confirm → Cancel, Shift+Tab reverses, Escape cancels
before submission and restores exact opener (reopen menu/details if needed). Moving/deleting
focus dialog tabindex−1; disabled progress skipped; no enabled actions means keep focus in the
dialog. No Cancel/Escape while unknown. Known Move failure Cancel → Retry; uncertainty Retry
loops to itself. Confirmed Home Move focuses workspace Trash row, since its card opener is gone.
Valid row Restore → Permanently delete…; expired/pending only Refresh status. Resumed moving/
restoring use the same pending-row focus rule, Refresh status focused for the target row,
including after reload; initial list entry selects its first available action. Original in-flight
Restoring focuses Trash heading. Known restore failure Retry → Permanently delete…; uncertain Retry skips disabled
delete. Success focuses Open board, next Tab follows normal Home. Pending deletion focuses
Refresh status; completion focuses status heading, then Back to workspace. Success role=status,
failure role=alert. New controls/heading focus use 3px #7051cf/offset3; preserve old menu styles.

A role-change 4403 alone never displays the terminal ending: freshly authorize/reconnect with
current permissions and tab drafts kept as sync v9 requires; no automatic comment resend. Only
confirmed whole-board unavailability on an owner, collaborator or history-preview/dialog 4403
path clears all protected paint/state,
including inbox/drafts/requests, focus generic h1 then route #/files and focus generic status
notice tabindex−1. Ignore late results; never resend. Old-link h1 then Tab Back to files.
After explicit restored Open board use normal fresh-board focus/current Comments. History-empty
uses unchanged W3 heading/Close traversal, with no Save action in that illustrated empty state.

## Deterministic fixture and verification

Owner ana, editor ben, viewer mia, granted guest lee at example.com. Acme and Studio; titles
Launch plan, Brand moodboard, Q3 roadmap, Team retro, Customer interviews. Launch plan has Rose
240×240 stickies at (−420,−200),(−80,−200),(−250,110); desktop (220,200),(560,200),(390,510), zoom100%:
Interview five customers; Pick the launch date; Draft the pricing page. Root Can we lock this
before the pricing page goes out? Reply Yes. Friday works if legal signs off by Thursday.
Both by ana. Ending begins with real unsent reply **Unposted private draft.**; preview ending
also begins with a real historical preview/restore confirmation. Never send that draft.

| Meaning | ISO server instant | en-US / America/Panama expected local output |
| --- | --- | --- |
| Launch plan deleted | 2026-11-06T15:00:00Z | Nov 6, 2026, 10:00 AM EST |
| Launch plan restore cutoff | 2026-12-06T15:00:00Z | Dec 6, 2026, 10:00 AM EST |
| Move example now | 2026-11-07T15:00:00Z | Nov 7, 2026, 10:00 AM EST |
| Move estimated cutoff | 2026-12-07T15:00:00Z | Dec 7, 2026, 10:00 AM EST |
| Team retro deleted | 2026-10-08T15:00:00Z | Oct 8, 2026, 10:00 AM EST |
| Team retro cutoff / example now | 2026-11-07T15:00:00Z | Nov 7, 2026, 10:00 AM EST |

These English strings are fixture assertions, never hardcoded UI. Use the viewer-local formatter,
without timeZone/hour12 options. For history-expired restore fixture, create old versions before
Trash so they expire before the board deadline; opening an overdue scheduler must not fabricate
restoration-only versions. Keep unchanged live controls, selection geometry and dynamic relative
ages app-rendered. Compare declared rectangles within 0.5 CSS px and exact computed colours,
font, spacing, disabled states, copy and focus. Script real application requests/holds/clock/
failure controls, never injected DOM. A screenshot alone proves no lifecycle transition.
