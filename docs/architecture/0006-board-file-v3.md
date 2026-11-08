# 0006 — Board file contract

Contract version: 3 (for 0007-W1 brief v1, 2026-11-08). Status: Draft.
Replaces [board file v2](0006-board-file-v2.md). Current fileVersion2, canonical
document 10, picture bundle, checksums and75,497,472-byte ceiling stay. This
amendment concerns only the workshop-state exclusion, with
[document v14](0001-document-v14.md) and [timer v1](0007-workshop-timer-v1.md).

Timer state/version/identity/actor, time samples, personal drafts and connection
counters never enter outer file keys, payload, document or assets. Existing exact
key validation refuses an injected timer payload. Timer-only activity leaves an
export's payload/digest and file bytes identical. Opening/importing a Board file
cannot start, restore or reset a live board timer; imported/new hosted board starts
idle by ordinary room initialization. Local boards expose no timer. No file-format
change, new asset or file persistence is introduced.
