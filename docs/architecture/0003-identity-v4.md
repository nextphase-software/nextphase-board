# 0003 — Identity contract

CONTRACT VERSION: 0003 identity v4 (2026-11-05)

Status: Draft for 0005-W2 v1. Replaces [identity v3](0003-identity-v3.md).
V3's verified-token, renewal, disabled-person and presence-label rules apply unchanged.
[Access v6](0003-access-v6.md) determines visibility, [API v6](0003-api-v6.md) exposes candidates,
and [comments v2](0005-comments-v2.md) defines saved mention labels.

## Registered participant labels

The permission-limited roster includes permitted people who are offline or have never joined
the room. Read their last registered `nextphase_board.people.email`; take the substring before
its last `@`, without shortening or case changes. Exclude an empty, ill-formed or over-256-UTF-8-byte
label. This does not change v3's token-derived presence label or its ticket-time validation.
No new display-name field is written. Candidate enumeration intentionally exposes these labels
to permitted callers before the named people join; it exposes no full email address.

Derive `person` exactly as presence v1: SHA-256 of UTF-8 `presence:<board>:<account>`, first
32 lowercase hex characters. This identifies a person **on this board**, not their account in
another board. Labels are not unique. Sort by label then person key; search by case-insensitive
label substring. For equal labels, display a suffix of the first eight person-key hex characters,
extending until distinct within that equal-label group. A unique label has an empty suffix.
The public candidate is exactly `{person,label,suffix}`. Account UUIDs, emails, leases and raw
roster service rows never reach the browser.

The server re-resolves and stamps newly selected labels at save time. Saved historical ranges
keep their label snapshot after a registered email or access change, as comments v2 specifies.
