# 0001 — Board document contract

CONTRACT VERSION: 0001 document v12 (2026-11-06)

Status: Draft for 0006-W3 v1. Replaces [document v11](0001-document-v11.md).
The saved document remains version **10**, with unchanged validation, canonical 2,097,152-byte
ceiling, JSON/file/local storage and object/reference rules. V11's ordinary transition and
server seen-identifier rules remain in force except for this narrow server-only action.

## Authorized history replacement

Only a currently authorized effective editor/owner restoring a retained version under
[lifecycle v1](0006-board-lifecycle-v1.md) may replace the current document with that version's
validated canonical content. Same board ID/schema; fresh Yjs state; new higher live revision and
external generation. The selected state supplies its title, objects, generations, retired set,
group/section membership and connectors. It may reinstate an ID/generation pair or retired-set
state forbidden by ordinary `checkTransition`; this exception does not change that function's
ordinary rules or accept a client-supplied replacement/update.

Preserve the server's union of every seen object ID/generation pair, including objects absent
from the selected state. Verify each reinstated pair against that board's retained history and
identifier record. An ID cannot acquire a different generation/type. Later normal additions
still cannot reuse a seen ID/generation, even one hidden by the restore. Server picture refusal,
no-hidden-Yjs-fields validation and canonical size/reference checks still apply. Reject invalid
history before fence advancement. This path is neither a normal edit nor board Undo/Redo;
clients clear their board history when rejoining the new generation. Comments/history/permissions
remain outside the saved document and its exports.
