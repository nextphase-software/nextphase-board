# 0006 — Board file contract

Contract version: 4 (for 0007-W2 brief v1, 2026-11-09). Status: Draft.
Replaces [board file v3](0006-board-file-v3.md). FileVersion2/document10/picture
bundle/checksums/75,497,472-byte ceiling remain. With
[document v15](0001-document-v15.md) and [voting v1](0007-workshop-voting-v1.md),
exclude Question, round UUID/version, targets, ballots/versions/colours/budget,
results, local mode/drafts/health and counters from every outer/file/document/
asset field. Timer exclusion remains.

Strict extra-key validation rejects injected voting payload rather than silently
dropping it. Voting-only activity leaves file bytes/payload/digest identical.
Opening/importing a file cannot control/restore a live workshop; a new imported
hosted board initializes voting idle. No voting file-format or asset addition.
Hosted image import remains refused; image eligibility adds no hosted image path.
