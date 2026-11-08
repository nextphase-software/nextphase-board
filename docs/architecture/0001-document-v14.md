# 0001 — Board document contract

CONTRACT VERSION: 0001 document v14 (2026-11-08)

Status: Draft for 0007-W1 v1. Replaces [document v13](0001-document-v13.md).
All current version10 canonical validation,2,097,152-byte ceiling, identifier
history, lifecycle gates and narrow authorized history-replacement exception stay.
No schemaVersion change or timer field is added. [Timer v1](0007-workshop-timer-v1.md)
is room-side workshop state, outside document/Yjs/history/Undo/Redo/export/edited-at.

Timer transitions cannot change canonical bytes, confirmed document revision,
edited-at, retained-version count or capture fingerprint. Document-history restore
preserves the current live timer without importing a historical timer; Trash
restore starts idle. File import/export/JSON contain document content only.
Strict document validation rejects an injected timer field by its existing
extra-key rules. This changes no ordinary document editing or file behavior.
