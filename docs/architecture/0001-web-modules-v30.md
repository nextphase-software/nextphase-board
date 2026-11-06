# 0001 — Web app modules

Note version: 30 (for 0005-W2 brief v1, 2026-11-05). Status: Draft.
Replaces [web modules v29](0001-web-modules-v29.md). Its module/import/state rules apply
except for the additions below. Behaviour is [interaction v32](0001-interaction-v32.md),
[hosted storage v6](0003-hosted-storage-v6.md) and [comments v2](0005-comments-v2.md).

## Team modules

Exactly **31** team modules: v29's 28 plus these three, each with an Apache-2.0 SPDX header:

| Module | Job |
| --- | --- |
| `team/comments/mention-editor.tsx` | Atomic plain-text/mention contenteditable editor; caret, composition, selection, picker and permission-limited page reads; emits normalized text/ranges |
| `team/notifications.tsx` | Home bell, retained inbox, live reads, versioned actions, pending/retry states and notification-open intent |
| `team/notification-navigation.ts` | Tab-memory notification target/source intent and draft-preserving same-board thread navigation; no persisted board data |

Existing `comments/card.tsx`, `comments/layer.tsx`, `comments/panel.tsx` and `comments/rules.ts`
wire editors, historical spans, display reads, navigation, sort and counts. `home.tsx` mounts the
bell beside the account; `home-menu.tsx` supplies its existing menu positioning; `hosted-board.ts`
and `team-app.tsx` connect session/navigation. No new job moves to `App.tsx` or a state hook.
Only `team/comments/rules.ts` may import/re-export shared pure rules from
`nextphase-board-sync/comments.ts` and the new `nextphase-board-sync/mentions.ts`; it imports
neither React nor Auth. Every other web import boundary stays unchanged.

## Shared and server modules

`packages/board-sync/src/mentions.ts` holds range types/validation, normalized code-point rules,
participant paging and pure mention editor helpers. `packages/board-room/src/mentions.ts` owns
room source targets/pending work and projection coordination; it does not own the board document.
`apps/server/src/routes/mentions.ts` owns the five mention/inbox HTTP routes. Existing runtime,
Supabase adapter and shared delivery scheduler connect both runners to the same behaviour.
No dependency, package manifest, lock, inventory or notice change.

## State and guards

Keep **22** state hooks, the passive-effect and presence import rules from v29, and every other
guard. `App.tsx` stays unchanged within **264 lines**. Update the exact module list and the
single shared-mentions import exception in `tests/modules.test.mjs`, named web modules v30.
The off bundle must contain no team or Supabase module. Inbox/roster/drafts remain tab memory.
