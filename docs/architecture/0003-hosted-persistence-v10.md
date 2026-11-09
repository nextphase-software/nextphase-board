# 0003 — Hosted persistence contract

CONTRACT VERSION: 0003 hosted persistence v10 (2026-11-09)

Status: Draft for 0007-W2 v1. Replaces [persistence v9](0003-hosted-persistence-v9.md).
All16 service tables, independent fences, history/lifecycle metadata-only
journals, chunking, fingerprints and limits remain. Current room layout **7**
adds workshop_vote and workshop_vote_ballots beside workshop_timer. Initialize
and validate the current room layout transactionally; document schema stays10.
[Voting v1](0007-workshop-voting-v1.md) owns exact SQL columns, row/state invariants,
compact tuples, split versions, projections and ordered transaction boundaries.

| New stored value | Complete encoded UTF-8 bound and disposition |
| --- | --- |
| Session SQL row, including keys and escaped JSON TEXT columns | ≤65,536 bytes; one row; no copied object labels/document bytes |
| Ballot SQL row, including account/session UUID, private version/colour/targets | ≤4,096 bytes; ≤50 reserved identities/session, ≤20 unique targets each |
| Aggregate voting rows | ≤270,336 bytes, not a single combined SQL row |
| Mutation/read attachment budgets | Each ≤1,024 bytes, at most5 timestamps each; complete socket attachment ≤16,384 bytes |
| Recovery marker/reservation | Existing typed meta rows ≤1,024 bytes each; no voting payload added |

Each new SQL row is <131,072 bytes and below the inherited2 MB runner ceiling.
Measure maximal actual encodings on both runners. No vote journal/receipt/log.
Existing journal≤65,536, raw chunk≤1,048,576, canonical document≤2,097,152 and
whole logical backup≤16,777,216 remain. No limit increase. Validate before any
partial write; version overflow refuses atomically. Private rows are deleted
in reveal's transaction, retaining only anonymous aligned totals and target order.

Backup envelope stays1/current storage_version7. Explicitly omit both voting
tables, including empty tables, plus timer and explicit recovery marker keys.
Reject injected voting at top-level/table/meta/strict row fields with400
bad_request **before** any fence or write. Valid logical replacement resets
timer/voting together behind the fresh generation. It cannot overtake a pending
document-history intent. Preserve the accepted intent and its denial semantics.

Apply v9's explicit_recovery_pending/explicit_recovery_generation reservation
algorithm to **both** workshop records in the same local reset transaction,
before any history-intent shortcut/resume or serving. A reserved reset proves
timer idle/version0/null actor and voting idle/version0/no ballots. Retain marker,
reservation, denial and accepted intent/chunks on failure; advance higher live
floors without revival or repeated reset. Complete only after history completion
and strict live replay. Ordinary restart without explicit marker preserves live
records; restore_pending alone never means explicit recovery. Supported Workers
independent time signal is checked before room loading; Node marking script and
startup follow the same ordering. Trash clears behind its fence; purge/discard
erases all workshop tables and callbacks. Document-history restore preserves
live state and reconciles active target identities before any projection.
