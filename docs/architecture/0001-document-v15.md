# 0001 — Board document contract

CONTRACT VERSION: 0001 document v15 (2026-11-09)

Status: Draft for 0007-W2 v1. Replaces [document v14](0001-document-v14.md).
All schema10 canonical validation,2,097,152-byte ceiling,250-object limit,
identifier history, lifecycle gates and narrow history-replacement exception
remain. No voting schema/key is added. [Voting v1](0007-workshop-voting-v1.md)
owns room-side session/private rows and anonymous totals, outside Yjs/document/
Undo/Redo/canonical bytes/revision/edited-at/history/files/exports.

Strict extra-key rules reject injected prompt/ballot/result/session fields.
Voting-only work cannot trigger capture or alter history count/fingerprint.
Document deletion/replacement is serialized with ballot target pruning/refund;
same identity moves/resizes/edits retain votes, new generations never inherit
them. Undo cannot revive pruned ballots. User document-history restore preserves
and reconciles the live round, never restores historical votes. Frozen revealed
counts remain frozen; missing label/badge behavior is voting v1. Imported/new
boards initialize idle; Trash/explicit recovery reset workshop side records.
