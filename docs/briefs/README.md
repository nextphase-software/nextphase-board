# Implementation briefs

[0001-W1 v3 — Capture and reopen a board](0001-W1-capture-and-reopen-a-board.md)
is a revised prerequisite packet proposed for review on 2026-10-22. Three existing
criteria are unchanged. Interaction v2 specifies the public design and behavior;
document/storage/toolchain v1 remain unchanged. Accept and commit the revised
packet before a separate implementation handoff. A template is not authorization.

Each brief is a complete contributor-facing contract. Use this structure:

```text
BRIEF VERSION: <ID> v<integer> (<YYYY-MM-DD>)
# <ID> — <outcome>
Status: Draft | Accepted prerequisites | Ready | Implemented | Superseded

## Outcome
## Read first
## Prerequisite architecture contracts
## Deliverables
## Numbered acceptance criteria
## Applicable DESIGN.md guardrails
## Validation commands and expected evidence
## Exclusions and reasons
## Public references with retrieval dates
## Implementation record
Branch, validated source/test revision, commands and results, dependencies,
exclusions, final handoff reference.
```

An amendment retains the ID and increments the version. All requirements and
build inputs must be available in this repository or documented public sources.
Record the revision validation ran against; a subsequent implementation-record
commit has a different hash. UI briefs include approved design references.
