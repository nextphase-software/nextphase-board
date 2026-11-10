# 0001 — Interaction and browser contract

Contract version: 37 (for 0007-W3 brief v1, 2026-11-10). Status: Draft.
Replaces [interaction v36](0001-interaction-v36.md). All inherited editing,
selection, Home/Trash/history/Comments, timer and voting values stay except
the explicitly replaced follow banner and people-menu integration below.
[Presence v3](0004-presence-v3.md) owns state, protocol, lifetime and motion.
This file is the single source of spotlight presentation values.

## Offer, leaving and local work

Offer once per session/admitted follower connection. Begin the local 3,000 ms
decline window only when visible and actionable with a fresh real presenter view.
Display 3, 2, 1 seconds using ceiling of remaining milliseconds; zero requests
follow once, never paints optimistic following. Immediate Follow uses the same
safe join. No frame or camera movement before server-confirmed membership.

During a native editor's focus, IME composition, active drag/drawing/resize,
hidden tab or history preview, no countdown or automatic motion. Follow is
disabled during composition/gesture or preview. A deliberate Follow waits until
the person has finished native editing themselves; joining never forces a draft
commit or cancellation. Do not finish someone else's work to auto-join.
When work ends and the tab is visible/actionable, give a full window,
never accumulated hidden time. Entering preview leaves/stops and blocks new
participation until the current board returns.

Not now declines. Stop following, followed avatar/menu Unfollow, Escape outside
native/menu/dialog contexts, own wheel/pinch/pan/zoom/navigation, or starting a
selection/edit/draw/tool action leaves before the action. Preserve last view.
Remote setFollowView does not leave; native editor/panel scroll that does not
move the board does not leave. Pointer motion, cursor preference, opening Timer
and voting or using its timer controls do not leave. The presenter edits/selects
normally; never copy their selection/content commands. No global read-only mode.
After decline/leave show deliberate rejoin/dismiss, no repeated auto-offer on
that admitted connection. Dismiss is session/tab local until reload/reconnect;
people-menu/target avatar rejoin remains available. Fresh follower admission
forgets prior decline/dismissal and gives a fresh full offer, even for the same
session. Offline leave/dismiss suppresses only stale old-connection replies.
A replacement session may offer again. Ordinary manual Follow has the same single
banner surface, original words and unchanged chooseFollow/fit semantics.

## Words and phase controls

Status is followed directly by native buttons in the order below. No separator
glyph is rendered between status and actions or between actions. Accessible
banner label is Spotlight, or Following for ordinary manual Follow. × has the
accessible name Dismiss spotlight offer, not a multiplication-name control.

| Phase | Status text | Native controls in visible/Tab order |
| --- | --- | --- |
| Idle/current admission | No banner; own-person menu action Spotlight me | Spotlight me |
| Presenter before first follower | Waiting for followers… | Cancel |
| Presenter after first follower | 1 follower / N followers, including 0 followers after all leave | Stop |
| Actionable offer | Spotlight on <name>. Following in 3… (then 2… / 1…) | Follow, Not now |
| Deferred offer | Spotlight on <name> | Follow, Not now; safety disables as above |
| Confirmed follower | Spotlight on <name> | Stop following |
| Declined/left | Spotlight on <name> | Follow, × |
| Presenter grace, confirmed follower | Presenter reconnecting… | Stop following; no active frame; retain followed-target ring |
| Own connection uncertain | Spotlight disconnected. Reconnecting… | Stop following if formerly following, ×; both local; shared actions disabled |
| One pending mutation | Checking spotlight… | Available local leave/dismiss only; never optimistic success |
| Controller before first snapshot | Connecting spotlight… | Shared actions disabled; no false idle; controller need not exist before joined |
| Presenter clean/unrecoverable departure | No banner/frame; toast The presenter left the spotlight | No session action |
| Explicit Stop | Remove session UI; no departure toast | None |
| Ordinary manual Follow | Following <name> | Stop following |

Own-person menu uses Stop spotlight while presenting. During running voting,
Spotlight me and remote Follow are disabled with Spotlight is unavailable while
voting. In history preview use Back to current board to present. While presenting,
remote Follow is disabled with Stop presenting to follow someone. Uncertainty
uses the same disconnected sentence as its visible disabled reason. Show the
reason in-flow immediately after the Spotlight row, and associate it with that
row and affected remote actions via aria-describedby. Disabled remote Follow
words stay visible, never hover-only. Keep ordinary role wording owner / can
edit / can view and own <name> (you). Remote avatar accessible actions become
Unfollow <name>, <role words> when followed, otherwise Follow <name>, <role words>.
Unavailable remote avatars open the people menu using the existing
<name>, <role words>. Open people menu wording. Own avatar remains
<name> (you), <role words>. Open people menu. People group/menu title and chevron
remain People on this board / People on this board: N; overflow Show N more people.
Preserve avatar title <name> / <name> (you), and Show other people's cursors.

## Concrete look

All dimensions are border-box CSS px. Keep system-ui, no animation or sound.
CSS custom presenter colour comes only from the stamped session/presence palette.

| Surface/control | Exact treatment |
| --- | --- |
| People menu | Existing min(316px, viewport−24px) width, padding 8px, radius 12px, zero border, #2b2a30 / #fff, 14px system-ui, shadow 0 8px 24px rgba(0,0,0,.2), z-index 6, overflow auto/max-height viewport−160px. Origin derives from people-group bottom+14px and its actual right edge (existing desktop right=viewport−group.right−8px; below 768px right=12px). |
| Existing roster | Own first; up to three avatars at desktop, one below 768px, existing +N/chevron. Rows padding 7px 8px, gap 10px, radius 8px, ordinary hover/focus #45434d, inherited outline none. Dots 26×26, white 12px/600; role text 12px/#b9b6c3. Existing avatar 28×28, circular/2px white border, white 13px/600. No public follower roster. |
| New Spotlight me / Stop spotlight row | Immediately after own identity, before first remote person. Full available menu width, min-height 40px, padding 8px 12px, radius 8px, zero border, 13px/1.5 system-ui/400, #7051cf / #fff; enabled hover #6142be. |
| Disabled reason | Paragraph margin 4px 8px, 12px/1.45 system-ui/400, #b9b6c3, overflow-wrap:anywhere. Specific style, not generic dialog p. |
| Single follow/spotlight banner | Fixed, z-index 5, pointer-events:auto, white / #29272e, 1px solid #e9e7ed, radius 12px, padding 8px 12px, gap 8px, 13px/1.5 system-ui/400, inset 0 3px 0 presenter-colour plus 0 2px 8px #29202e0a shadow. flex/align-items:center/flex-wrap:wrap; overflow:auto. Size/placement below. |
| Banner status | flex:0 1 auto, min-width:0, overflow-wrap:anywhere; no nowrap/ellipsis clipping. |
| Banner actions | display:flex, align-items:center, flex-wrap:wrap, gap:8px, max-width:100%. |
| Neutral banner buttons | Cancel, Stop, Stop following, Not now, ×: white / #29272e, 1px solid #e8e7ed, radius 8px, min-height 40px, padding 8px 12px, same banner font, white-space:normal; enabled hover #f1eff5. × is exactly 40×40 with min-width 40px/padding 0. |
| Primary banner Follow | Same button geometry, #7051cf fill and border / white; enabled hover #6142be retaining purple border and white text. |
| New controls' disabled/focus/press | Disabled opacity .45, retaining family's base fill/border, no hover/activation. Focus-visible 3px solid #7051cf outline/3px offset, including new menu row; override inherited menu outline:none/hover specificity for that row only. Momentary pointer/key press adds no palette, latched aria-pressed, transform or animation. Focus never changes geometry. |
| Scene frame | Existing absolute inset:0, square corners, 3px solid presenter-colour, z-index 5, pointer-events:none. Show for live presenter and confirmed live follower only; suspend on own uncertainty or presenter grace. Scene dimensions stay unchanged. |
| Avatar rings | Presenter 2px dashed presenter-colour outline/1px offset; followed target retains 2px solid/1px offset, taking precedence on that follower's target avatar. Offers show the presenter's dashed ring without a following frame. Readable labels/status accompany colour. Other connections remain ordinary; no voter/follower-status ring. |
| Departure toast | Existing .team-toast, 5 s lifetime, bottom 86px desktop / 148px below 768px, centred; #f3f0f8 / #29272e, 1px solid #e1dce8, radius 10px, padding 10px 14px, 14px system-ui, z-index 4. Spotlight live region owns speech; toast must not announce it a second time. |

### Banner placement and wrapping

Left=12px. Base top=max(actual file-bar bottom, actions-bar bottom, visible
selected-object context-bar bottom, every visible hosted notice surface bottom)
+12px. Include standalone .team-banner and the complete .team-notice-column
(including .team-loss-notice children/reconnecting/view-only banners), measured
where their own existing state-responsive CSS renders them, including the narrow
188px top case. The 12px clearance continues the banner's bar/context gap; the
existing8px .team-notice-column gap is internal between notices and does not
apply between that separate column and this banner. Never cover a notice or
write its position from spotlight layout. Retain its existing CSS positions,
order and internal8px gap; calculate spotlight placement after those settle. At viewport widths 600px and wider,
hug content with width:max-content, max-width:min(400px, viewport−24px).
For a visible right panel or people menu
whose real rectangle competes at this vertical position, reserve that rectangle
plus 8px: left-column width=obstruction.left−8px−12px; cap banner to the smaller
of normal max-width and that column. If several surfaces matter, reserve their
union. When the remaining column is under 240px, move top to the greater of
base top and obstruction.bottom+8px. At widths 600px and wider, this below-panel
placement is the only full-width case: width/max-width:viewport−24px.
Below 600px, always use width/max-width:viewport−24px, including without a panel;
status takes its own row (flex-basis:100%), actions width:100% and wrap below.
The narrow rule overrides the 400px and left-column width caps; the under-240px
below-panel placement rule still applies. Max-height=viewport−
actual top−12px, internally scrollable. Recompute after resize, panel/menu/context
change, notice appearance/dismissal/wrapping and wrapped content layout.
Incoming offers never close an editor/panel or dismiss/move a notice.
Do not move toolbar/Share/context/handles or resize the scene to fit the banner.

Positions/heights derived from fonts or sizes allow ±0.5 CSS px for positions/
rectangles and ±1px for wrapped text heights. Fixed CSS tokens are exact. Derive
collision/height from current actual surfaces, never a fixture coordinate or
obsolete timer-only height. Never assert a generic selector's rule on a
specifically styled control/paragraph. Reference fixture: bars ending at 60
derive top 72 only without a lower notice; selected context bottom 174 derives
186 only without a lower notice; editor context bottom192 similarly derives204.
With a notice bottom B use max(bars/context bottoms,B)+12 instead, position
tolerance±0.5 CSS px/wrapped heights±1px. At375×812 without a lower notice,
actions bottom116 derives128; a panel bottom
451.390625 derives below-panel top 459.390625 and width 351. These are derived
examples, not universal coordinates. The existing narrow scene minimum height
900 remains; its frame follows the scene rather than a fabricated 812px edge.

## Keyboard, focus and speech

Tab reaches existing avatars/overflow/chevron in their existing order, then
Timer and voting, then Share. No new toolbar stop. In an open menu the own
identity is first; ArrowDown next reaches Spotlight me/Stop spotlight, then the
existing remote rows, then cursor switch. ArrowUp reverses, Home/End go to the
first/last enabled item; skip hidden/disabled controls. Enter/Space activates.
Escape closes menu to its actual opener; menu Tab continues after the people
group, Shift+Tab returns to chevron. Do not add positive tabindex, a global
shortcut, modal trap or a workshop item to Home/details/modal/palette arrays.
Banner native controls follow the phase table order; Shift+Tab reverses.

Outside menus/dialogs, Escape declines an offer, leaves a follower, or invokes
Cancel/Stop for a presenter. Native editors retain their Escape/IME semantics.
Local panel/menu key handlers must win over document-capture follow handling;
do not let use-presence consume their Escape. Remote start/stop/countdown/view
updates never focus/blur an editor. A locally activated disappearing control
returns to people opener/scene only if it owned focus; remote removal moves focus
only from a disappearing banner control to the still-present own-avatar opener.
Never focus a hidden/disabled row.

Exactly one mounted `.sr-only[data-workshop-status="spotlight"]` with role=status,
aria-live=polite, aria-atomic=true, separate from timer/voting/save even when
panels close. Announce once per relevant transition: Spotlight started;
Following <name>; Stopped following <name>; Spotlight stopped; Presenter
reconnecting; Spotlight reconnected; The presenter left the spotlight.
Offer availability speaks Spotlight on <name>. Choose Not now to stay here.
Seed suppression from initial/late snapshots; duplicate result/state/read cannot
repeat speech. Countdown visible text stays outside the live region. No view,
cursor, tick, follower count or repeated-read speech. Scope observers to each
channel's stable identity, never collect a combined stream and filter afterwards.

## Unchanged shell and deterministic fixtures

Timer v2 and voting v2 retain Timer and voting title, Timer first/Voting or Results
second, one Close Timer and voting, no byline. Trigger remains 98×40 idle/62×40
active immediately before Share; panel 240 wide/right12/top actions.bottom+12,
padding12/gap8/radius12/1px #e9e7ed/white/#29272e/shadow above/z4. Keep 79×68
fields/48px digits, 33px discs in40px hits and 68×24 extension visual. Trigger
accessible prefix Timer and voting and running suffix Voting in progress stay;
no extra visual voting badge. Timer title and once-only speech stay independent.
Voting retains 12px own dots/minimum24px counts, inside-corner and first-line
anchors and running spatial privacy. Existing selected-object context bar,
handles, file bar, save states, Share and cursor preference remain.

Use synthetic ana@example.com owner, ben@example.com editor, mia@example.com
viewer, verified labels ana/ben/mia and server blue/red/green. Acme / Launch plan:
Rose 240×240 notes at (−420,−200) and (−80,−200), Interview five customers and
Pick the launch date; empty Square at (−420,110),180×120; text Draft the pricing
page at (−240,80),320×120. Editing appends “ — next step” only in edit cases.
Coexistence timer starts 02:14; voting question Which idea should we try next?,
budget3. Fixture positions are test inputs, never product placement requirements.
Desktop1280×800/scale1; narrow375×812; unequal views exercise the unchanged zoom
floor in both directions. Do not ship explanatory captions, insets, comparison
crops or frozen timer digits.
