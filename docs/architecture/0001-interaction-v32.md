# 0001 — Interaction and browser contract

Contract version: 32 (for 0005-W2 brief v1, 2026-11-05). Status: Draft.
Replaces [interaction v31](0001-interaction-v31.md). Its Home Import, menus and board interaction
rules, through v30's comments, remain except for these additions. Current behaviour/data are
[hosted storage v6](0003-hosted-storage-v6.md), [comments v2](0005-comments-v2.md),
[access v6](0003-access-v6.md), [identity v4](0003-identity-v4.md), [API v6](0003-api-v6.md)
and [sync v7](0003-sync-v7.md). Earlier-client and older-saved-format compatibility is not required.
With team features off there are no new controls, requests, markup/focus or saved-record changes.
Sizes are CSS border-box pixels, system-ui fonts, at 1280 × 800 unless stated. A matching structure
with different values does not meet this contract.

## Editor and picker

`@` at field start or after whitespace opens suggestions in new comment, Reply or own Edit.
Query label substring case-insensitively; sort label then person key, 20/page. Keep caret and field
focus through query results. Up/Down wrap within the current page. Tab/Enter/click inserts the
selected atomic `@label`; **that Enter never posts**. PageDown advances when More exists;
PageUp returns to the preceding page. Pointer More also advances. Escape closes, keeping text.
With no results, Enter never posts; Tab closes and moves to the next control. Input composition
consumes no picker commands until composition ends. A mention is removable as one chip by adjacent
Backspace; typing into it converts it to plain text. Selection replacement, plain copy/cut/paste
and editor-local Undo/Redo preserve text/caret without board actions. Outside an open picker,
Enter posts and Shift+Enter adds a line feed, as v30. No board shortcut acts in a textbox.

The mention has `#2563eb` text, transparent background, no border/padding/radius and inherited
font. Historical mentions look the same, with no role badge or profile action. Editor min-height
24, max-height 120, 14px/1.45 system-ui. Keep the **edit wrapper's** 1px `#7051cf` border,
radius 8 and 6px 8px padding; do not apply that padding twice to the inner editor.

Picker width 300, maximum viewport minus 24, white, 1px `#e9e7ed`, radius 8, shadow
`0 2px 8px #29202e20`, z-index 7. Left = clamp(field.left,12,viewport width−picker width−12).
Top = field.bottom+6, unless bottom would exceed viewport height−80; then use
max(72,field.top−picker height−6). Scroll body max-height 200; all 20 first-page rows exist.
Rows min-height 40, 24px avatars, gap 10, padding 6px 8px, radius 6; selected `#7051cf`
on `#f5f0ff`. Duplicate suffix is 12px `#79737f`, tabular numerals, aligned right.
The visible key hint remains exactly the copy below, including when PageDown/PageUp is available.
Use a listbox with selected options associated to the active textbox; pending fields expose
`aria-readonly`, not an editable appearance that falsely accepts another send.

## Bell, inbox and actions

Home's account/bell row gap is 4, min-height 44, margin-bottom 8. Account stays x12/y12/h44;
width becomes 171 desktop, 91 narrow. Bell x187/y14 desktop, x107/y14 narrow: 40 × 40,
transparent, no border/padding, radius 8, `#3b3a40`; expanded `#7051cf` on `#e9e2fb`.
Name it Notifications and expose `aria-expanded`. Dot: 8 × 8 red `#dc2626` content circle,
2px white border (12 × 12 total), top 7/right 7, no number. It uses last confirmed unread state
through loading/failure. Home's Import/New board retain v31's positions and sizes.

Panel fixed x12/y62/w400, max width viewport−24, max height 100dvh−74, overflow auto,
white, 1px `#e9e7ed`, radius 12, shadow `0 2px 8px #29202e20`, z-index 6; no backdrop.
Below 600 (`max-width:599.98px`), width viewport−24: x12/w351 at **375 × 812**.
Header padding 6px 6px 6px 14px, gap 6, title bold14, bottom border `#e9e7ed`.
Mark all min-height 32, 12px `#7051cf`, padding 4px 6px, no border/background, disabled opacity .45.
Close uses the existing 32px icon button. Limit line 12px `#79737f`, padding 8px 14px.

Rows grid 24px/minmax(0,1fr)/32px, gap 0 10px, padding 14, divider1px `#f0eff3`.
Unread background `#f5f0ff`, read white; 6 × 6 blue unread dot, margin-left 6, vertical-align1.
Actor line 13px/1.45 with label weight600; board/workspace and time 12px `#79737f`, margin-top 4;
preview 14px/1.45, margin-top 6, two-line clamp. Mention spans remain blue. Avatar margin-top 2.

Individual menu uses Home's 208px white menu, padding 6, 1px `#e9e7ed`, radius 8, same shadow,
z-index8; left=max(12,More.right−208), top=More.bottom+6; narrow right 20/left auto.
Items exactly Mark as read **or** Mark as unread, then Dismiss notification. Menu keys use
existing Home menu rules. The pending banner is grid columns2–4, margin-top 8, padding 8px 10px,
radius 8, `#936000` on `#fff5da`, 13px/1.4; Retry min-height 28, padding 2px 10px, margin-left 8.
Pending Mark all uses one shared amber note, margin10px 10px 0, disables Mark all while unresolved.
Rows and dots remain until confirmation. Confirmed actions fetch canonical state; failed refresh
clears previews and offers a read Retry. No optimism or automatic action replay.

Empty/loading/failure/unavailable state is centred vertical flex, gap 8, padding 40px 20px,
`#79737f`, line-height 1.5; heading bold14 `#29272e` (failed `#a32940`); paragraph13,
max-width 300, margin0. Retry uses the shared button. Loading/failure shows no placeholder/old
preview. Panel open alone marks none read.

Home Tab order begins account, **Notifications**, Recents, workspaces, Boards in this browser,
Import (when shown), New board (when shown), sort and cards, as v31 thereafter. Enter/Space opens
the bell; Close/Escape returns focus to it. Row Open and More are keyboard controls. Opening a
menu moves focus into it, and Escape returns to its More. No automatic read from focus alone.

## Landing and Comments

After permitted explicit open and snapshot completion, enter comment mode, reveal the target
through hidden/resolved filters, pan to the authoritative pin without changing zoom, scroll to
its exact comment, focus the thread heading (`tabindex=-1`). Header Resolve/More are outside
**this landing's** next Tab path so **Reply is next**; ordinary thread entry keeps v30 behaviour.
Heading ring 3px `#7051cf`, offset 3, radius 2. Target comment border-left 3px `#7051cf`,
background `#f5f0ff`, padding-left 11 instead of 14. No typing/posting/reopening.
Escape returns to the source notice when available, otherwise canvas. Drafts in another thread
stay in tab memory during same-board notification navigation; changing boards uses existing leave rules.

A resolved landing says **Resolved. Replying reopens this thread.** and retains faded pin opacity .55;
ordinary resolved entry retains v30's sentence. Detached card/list retain existing Detached words
without a redundant unlink icon; the pin keeps its existing badge/ring and saved point.
At the fixture's initial view the pin is x770/y298, 32 × 32, anchor corner (770,330), card x438/y298,
w320/max-height 412/overflow auto. Composer x458/y292, 300 × 42. Comments panel x972/y72,
296 × 648, bottom gap 80. These positions derive from the real anchor/view, never painted DOM pins.

Only your threads includes started/replied/mentioned threads. Unread badges count **mentions only**.
Filter menu fixed right 20/top 118, existing dark `#302d36`, min-width 190, padding 6, radius 12,
white13px items padding 8px 10px; Sort by label12px `#b9b6c3`, padding 6px 10px 4px, tick column14.
Add Oldest first / Unread mentions first as radio choices (default Oldest first); unread-first
retains read threads afterwards in sequence order. Summary uses existing neutral note margin10px 10px 0.
Unread line is 600 12px `#2563eb`; its dot margin-left 0/right 6. Existing comment avatar is 24 × 24,
white initial, 600 12px. Row grid 24px/flexible/32px, gap 10, padding 10px 6px 4px 14px;
body14px/1.45; card/panel headers bold13/bold14. Existing error note is `#a32940` on `#fdf0f2`,
border 1px `#f2cdd5`, radius 8, padding 8px 10px, font 13px/1.4; amber uses `#936000` on `#fff5da`.

## Exact words

| Control/state | Words |
| --- | --- |
| Picker heading | Mention a participant |
| Continued page heading / button | Mention a participant · More results / More |
| Normal hint | ↑ ↓ to choose · Tab or Enter to insert · Esc to close |
| No-match/loading/failure hint | Esc keeps your text |
| No match | No matching participants. |
| Loading roster | Loading participants… |
| Failed roster / button | Couldn’t load participants. Try again. / Retry |
| Inbox title / limit | Notifications / Latest 50 mentions · All workspaces |
| Actor | `<label> mentioned you` |
| Actions | Mark all as read / Mark as read / Mark as unread / Dismiss notification |
| Empty heading / body | No mentions yet / When someone mentions you in a board discussion, it will appear here. |
| Loading inbox | Loading notifications… |
| Failed inbox / body / button | Couldn't load notifications / Board’s server didn’t answer. Try again. / Retry |
| Pending read or failed Mark all / button | Read status not saved. Retry when you’re online. / Retry |
| Pending dismiss / button | Dismissal not saved. Retry when you’re online. / Retry |
| In-flight Mark all button / note | Marking… / Marking the retained list as read… |
| Denied/deleted target | This discussion is no longer available. |
| Failed target / body / button | Couldn't open this discussion / Board’s server didn’t answer. Try again. / Retry |
| Newly unavailable recipient | A selected person is no longer available. Your text is kept. Remove the mention or choose again. |
| Offline draft with mentions | You’re offline. Your reply and mentions stay here; post when the board is back. |
| Pending capacity refusal | Notifications are waiting to be saved. Try again later. Your text is kept. |
| Sort | Sort by / Oldest first / Unread mentions first |
| Unread line | 1 unread mention; N unread mentions |
| Only your threads empty | No threads you started, replied to or were mentioned in. |

Other comment refusals keep hosted storage v5's words; `restore_changed` uses its not-retryable
sentence. No upgrade-required copy is part of this version. Existing Resolve/Reopen, Edit,
Cancel, Save, Reply, Post and ordinary Comments empty words remain. Times use hosted storage v5.

## Synthetic comparison fixture

Acme and Studio; Home cards Launch plan, Brand moodboard, Q3 roadmap, Team retro,
Customer interviews (Ana is Owner). Stickies: Interview five customers at 220/200;
Pick the launch date at 560/200; Draft the pricing page at 390/510; each 240 × 240, default Rose.
The detached state removes Pick the launch date. Dynamic edited-age labels are not fixed time rules.

First candidate page: alex, alex, ana, ben, chris, dana, eli, faye, gabriel, hana, ines, jules,
kai, lee, mia, nico, omar, priya, ravi, sam. More reaches zoe. Equal-label drawing fixtures are
alex · 18b42ca1 and alex · 7c4e90bd (board-person suffixes, not account IDs). Live test suffixes
must derive from their actual board/person keys; do not hardcode these into identity logic.
Queries: @, @be, @al, @zz. Candidate avatars blue `#2563eb`, ben red `#dc2626`; synthetic
comment/notice avatars ana blue, ben red, mia `#16a34a`, lee `#9333ea`. Real colours use comments
v1's board-person algorithm; compare chosen keys or explicit isolated drawing fixtures.

| Fixture | Exact text and time |
| --- | --- |
| Ana root | @ben, can we lock this before the pricing page goes out? / 12 min ago |
| Ben reply | @ana, Friday works if legal signs off by Thursday. / 2 min ago |
| Panel detail | On “Pick the launch date” / 1 reply |
| New composing text | @ben, please check Friday. |
| Reply picker | @ben, @be |
| Edited or kept refusal/offline draft | @ben, please confirm Friday. |
| Saved edit time | 12 min ago · edited |
| Notice 1, unread | ben / Launch plan · Acme / @ana, Friday works if legal signs off by Thursday. / 2 min ago |
| Notice 2, unread | mia / Team retro · Acme / @ana, could you add the customer feedback before the retro? / 1 hour ago |
| Notice 3, read | lee / Brand moodboard · Studio / Thanks @ana, these colours work for the launch. / Yesterday |

## Values as CSS

Append these rules after the existing stylesheet; equivalent selectors may preserve these computed
values. Existing v30/v31 styles still supply wrappers and controls. A static drawn caret is not
an application blink-timing requirement.

```css
.w2-editor { width:100%; min-width:0; min-height:24px; max-height:120px; overflow:auto; flex:1; align-self:center; font:14px/1.45 system-ui; color:#29272e; white-space:pre-wrap; overflow-wrap:anywhere; outline:none; }
.w2-mention { color:#2563eb; background:transparent; border:0; padding:0; border-radius:0; font:inherit; }
.w2-picker { position:fixed; width:300px; max-width:calc(100vw - 24px); z-index:7; background:white; border:1px solid #e9e7ed; border-radius:8px; box-shadow:0 2px 8px #29202e20; overflow:hidden; font:13px system-ui; color:#29272e; }
.w2-picker-label { padding:10px 12px 6px; font-size:12px; color:#79737f; }
.w2-options { max-height:200px; overflow:auto; padding:4px 6px; }
.w2-option { display:flex; align-items:center; gap:10px; min-height:40px; padding:6px 8px; border-radius:6px; }
.w2-option[aria-selected=true] { color:#7051cf; background:#f5f0ff; }
.w2-option small { color:#79737f; font-size:12px; margin-left:auto; font-variant-numeric:tabular-nums; }
.w2-picker-foot { padding:6px; border-top:1px solid #e9e7ed; }
.w2-picker-foot button { width:100%; min-height:32px; font-size:13px; }
.w2-picker-keys { padding:6px 12px 10px; font-size:12px; color:#79737f; line-height:1.4; }
.w2-picker-state { padding:16px 12px; color:#79737f; font-size:13px; line-height:1.45; }
.w2-picker-state.error { color:#a32940; }
.w2-picker-state button { margin-top:10px; min-height:32px; }
.w2-account-row { display:flex; align-items:center; gap:4px; min-height:44px; flex-shrink:0; margin-bottom:8px; }
.w2-account-row .home-account { flex:1; width:0; min-width:0; margin-bottom:0; }
button.w2-bell { position:relative; flex:none; display:grid; place-items:center; width:40px; height:40px; min-width:40px; min-height:40px; padding:0; border:0; border-radius:8px; background:transparent; color:#3b3a40; }
button.w2-bell[aria-expanded=true] { color:#7051cf; background:#e9e2fb; }
.w2-bell-dot { position:absolute; top:7px; right:7px; width:8px; height:8px; border-radius:50%; background:#dc2626; border:2px solid white; box-sizing:content-box; }
.w2-inbox { position:fixed; left:12px; top:62px; width:400px; max-width:calc(100vw - 24px); max-height:calc(100dvh - 74px); z-index:6; border:1px solid #e9e7ed; border-radius:12px; background:white; box-shadow:0 2px 8px #29202e20; overflow:auto; font:14px system-ui; color:#29272e; }
.w2-inbox-head { display:flex; align-items:center; gap:6px; padding:6px 6px 6px 14px; border-bottom:1px solid #e9e7ed; }
.w2-inbox-head strong { flex:1; font-size:14px; font-weight:700; }
.w2-mark-all { min-height:32px; min-width:0; padding:4px 6px; border:0; background:transparent; color:#7051cf; font-size:12px; white-space:nowrap; }
.w2-limit { padding:8px 14px; font-size:12px; color:#79737f; border-bottom:1px solid #f0eff3; }
.w2-notice { position:relative; display:grid; grid-template-columns:24px minmax(0,1fr) 32px; gap:0 10px; align-items:start; padding:14px; border-bottom:1px solid #f0eff3; }
.w2-notice.unread { background:#f5f0ff; }
.w2-notice .comment-avatar { margin-top:2px; }
.w2-notice-open { display:block; min-width:0; min-height:0; padding:0; border:0; border-radius:0; background:transparent; color:inherit; text-align:left; font:13px/1.45 system-ui; }
.w2-notice-open:hover { background:transparent !important; }
.w2-notice-open strong { font-weight:600; }
.w2-notice-open small { display:block; font-size:12px; color:#79737f; margin-top:4px; }
.w2-preview { display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; margin-top:6px; font-size:14px; line-height:1.45; }
.w2-unread-dot { display:inline-block; width:6px; height:6px; margin-left:6px; border-radius:50%; background:#2563eb; vertical-align:1px; }
.w2-notice-status { grid-column:2 / 4; margin-top:8px; padding:8px 10px; border-radius:8px; background:#fff5da; color:#936000; font-size:13px; line-height:1.4; }
.w2-notice-status button { min-height:28px; padding:2px 10px; margin-left:8px; }
.w2-inbox-state { display:flex; flex-direction:column; align-items:center; gap:8px; padding:40px 20px; text-align:center; color:#79737f; line-height:1.5; }
.w2-inbox-state strong { font-size:14px; color:#29272e; }
.w2-inbox-state.error strong { color:#a32940; }
.w2-inbox-state p { margin:0; max-width:300px; font-size:13px; }
.w2-action-menu { z-index:8; }
.w2-target { border-left:3px solid #7051cf; background:#f5f0ff; padding-left:11px; }
.comment-title.w2-heading:focus { outline:3px solid #7051cf; outline-offset:3px; border-radius:2px; }
.w2-unread-line { grid-column:2; color:#2563eb; font-size:12px; font-weight:600; }
.w2-sort-label { padding:6px 10px 4px; font-size:12px; color:#b9b6c3; }
.w2-filter-menu { position:fixed; right:20px; top:118px; }
.w2-short-note { margin:10px 10px 0; }
@media (max-width:599.98px) { .w2-inbox { width:calc(100vw - 24px); } .w2-action-menu { left:auto; right:20px; } }
```

Bell SVG (original Board drawing):

```html
<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7.7 16.3a2.4 2.4 0 0 0 4.6 0M4 13.8h12l-1.5-2.3V8a4.5 4.5 0 0 0-9 0v3.5L4 13.8Z"/></svg>
```

## Verification boundary

The 0005-W2 brief supplies one focused Chrome scenario, including all 36 named visual states
and the375 × 812 inbox. Compare declared computed values/rectangles within 0.5px; exact copy,
colours, font sizes and weights. Runtime read/permission/retry checks accompany pictures.
No browser matrix, physical keyboard, native input method or screen-reader campaign is required.
