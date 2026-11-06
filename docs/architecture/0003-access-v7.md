# 0003 — Access contract

CONTRACT VERSION: 0003 access v7 (2026-11-06)

Status: Draft for 0006-W3 v1. Replaces [access v6](0003-access-v6.md). Its highest-role,
epoch, revocation, participant visibility and account-owned notification rules continue.
Current routes are [API v7](0003-api-v7.md); storage is
[hosted persistence v7](0003-hosted-persistence-v7.md).

| Current effective board role | List / preview | Save / name / restore |
| --- | --- | --- |
| Owner or editor (including guest with editor grant) | Yes | Yes |
| Viewer (including guest with viewer grant) | Yes | 403 `role_too_low` |
| No role / disabled / missing board | Generic 404 `not_found` | Generic 404 `not_found` |

Authenticate before lookup; invalid authentication stays 401. Read current effective access on
every operation and on accepted-request retries before returning anything protected. Recheck
inside the ordered room restore before its durable intent. Retention is enforced even if cleanup
has not removed rows. Service failure stays 503, not 404 or an empty list. Revocation while history
is open discards protected names, counts, authors, preview document and cached response state.
An in-flight response from an invalidated account/access request cannot repaint that UI.

All existing 13 Supabase service tables retain RLS and their explicit service-only privileges.
No new Supabase table or authenticated policy is needed for room history. Add only this service
function, with the same fixed-search-path/EXECUTE revocations as v6:

| Function | Purpose |
| --- | --- |
| `carry_board_mentions(board uuid,from_generation bigint,to_generation bigint)` | Under the board lock, advance the mention checkpoint generation and retained references to `to_generation`, preserving source_order, notice IDs, original creation order, leases and read/state_version; never insert a notice |

For this function, reject a live generation other than the specified from generation or the
already-completed to generation; never lower a checkpoint or silently accept a still higher
one. Successful absence of a checkpoint contributes source order -1. A failure to read it is
not absence. Idempotent completion at to generation is harmless. Keep current access leases;
prune no-longer-permitted references using existing access rules. Keep the delivered cutoff so
a dismissed/evicted creation cannot return in a later projection. Only legitimate pending work
above the cutoff may create notices in the new generation. No browser may call this function.
The unchanged `clear_board_mentions` remains for operator whole-room restore; user document
restore uses carry, never clear. Service keys/account IDs stay out of public history responses.
