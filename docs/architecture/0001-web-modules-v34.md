# 0001 — Web app modules

Note version: 34 (for 0007-W2 brief v1, 2026-11-09). Status: Draft.
Replaces [web modules v33](0001-web-modules-v33.md). All existing registry/import/
composition/one-state-owner boundaries stay. [Voting v1](0007-workshop-voting-v1.md)
and [hosted storage v10](0003-hosted-storage-v10.md) add exactly five team modules:

| Module | Responsibility |
| --- | --- |
| team/voting.ts | Dedicated tab-memory controller, own projections/versions/commands/readback/health, local mode/draft, current-access cleanup and speech |
| team/voting-rules.ts | Pure prompt/budget/state/eligibility/labels/ranking/marker geometry and input decisions; no React/Auth/server import |
| team/voting-card.tsx | Native setup/selector/ballot/results/confirmations, precise copy/styles, focus identity and keyboard semantics |
| team/voting-overlay.tsx | Displayed dots/badges/hover/strip composition; no document mutation or second ballot state |
| team/workshop-panel.tsx | Shared neutral shell/header/one Close/surface handoff and focus delegation; timer and voting remain independent owners |

Exactly45 team modules (40+5), exactly22 state-hook modules. App.tsx remains
composition-only/≤264 lines; allow only explicit wiring, never ballot state,
protocol, storage, hit-test rules or effects. No voting logic in document-edit
hooks. Canvas/page-key hooks delegate to dedicated voting input/rules; object
layouts supply actual first-line geometry; shared registry owns per-type
eligibility, including the image rule without hosted-image implementation.
Use existing import exceptions only; pure modules import neutral types/rules,
never web from packages. No new hook/package/dependency/font/service.

New packages/board-sync/src/voting.ts owns browser/server-neutral strict wire
types, validation and bounds; new packages/board-room/src/voting.ts owns
transactional storage/projection/reconciliation in the single Room queue.
Existing session.ts/hosted-board keep voting subscription/refusal separate from
edits/retries. timer-panel.tsx becomes trigger/card content with original
controller/drafts/focus; shared shell composes it without duplicating ownership.
Existing optional timerControl slot before Share is retained. Update guards and
inventory exactly for these five files and authorized composition seams, keeping
off bundle free of team/Supabase/voting inputs. Only the two server-test includes
in the brief change configuration; no manifest/lock/deployment edit.
