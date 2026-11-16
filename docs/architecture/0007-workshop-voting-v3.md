# 0007 — Workshop voting contract

CONTRACT VERSION: 0007 workshop voting v3 (2026-11-16)

Status: Draft for 0010-W3 v1. Replaces [voting v2](0007-workshop-voting-v2.md). All v1 and v2 ballot,
privacy, rights, budget, projection, storage, retention, reveal, result, marker, panel, focus,
announcement and spotlight rules stay, except as below. A hosted board may now hold several pages
([document v19](0001-document-v19.md)); **a voting round belongs to the page it starts on**.
[Interaction v44](0001-interaction-v44.md) owns the looks and words.

## Start

The `start` command gains **`page`**, a lowercase UUID: the page open on the starter's client. The
request checks refuse it as they refuse any other malformed key. The room refuses `start` with
`vote_ineligible` when `page` is not one of the board's current pages. Otherwise the round's **targets
are the eligible objects whose `page` is that page**, in the existing order (`order`, then id),
numbered from 0. The existing 1-to-250 target rule applies to them. The round state gains **`page`**,
stored with it ([hosted storage v12](0003-hosted-storage-v12.md)) and carried in every projection,
snapshot, result and publication as a lowercase UUID, or null when idle.

## While a round runs

The existing target reconciliation also drops a target whose object is now on another page. Its votes
are refunded exactly as when a target is deleted, so moving an object off the round's page removes it
from the round. Objects moved onto the round's page do not join it. If the round's page is deleted, every
target drops by the same rule, and the round stays running with no targets until it is revealed (its
results may then be cleared), as a round whose targets were all deleted does today.

The client keeps a round's page from being deleted, and its objects from being moved off it, by
disabling Delete page and Move to page there (interaction v44). The room does not refuse such an edit;
the reconciliation above is its rule.

## Projections

Ballots, results and markers name targets as today. A client draws markers only on the round's page and
offers the ballot controls only while that page is open. On another page it shows the round's page and a
**Go to <page>** button instead (interaction v44). A revealed result naming an object on another page
opens that page before showing the object.

Presence redaction, ending a spotlight at Start, and the timer are unchanged. The timer is still one per
board.
