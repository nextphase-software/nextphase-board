# 0004-W2 — evidence summary

Brief: [0004-W2-recover-shared-edits-after-interruption.md](0004-W2-recover-shared-edits-after-interruption.md). Reviewed commit `2361eeb1a812ad913bba3cb413ac13e55b00aaa8`, validated source `403113f9a1ab1d7937240a72a18651401344e219`, compared with `bee6dd38fdc06ae158cde3d63a3d079fb0aea084`.
Environment: node v26.13.0, npm 11.20.0, os macOS 27.2 arm64, chrome Google Chrome 156.0.8078.76, services Local Supabase and Node only, origins ['http://127.0.0.1:4183'], server http://127.0.0.1:8796, auth http://127.0.0.1:55321, short_session_seconds 120, docker 29.5.2, docker_client 29.9.2, supabase 2.122.0, python Python 3.15.2, wrangler 4.156.0.

## Acceptance criteria

| Criterion | Checks | Result |
| --- | --- | --- |
| 0004-W2-AC01 | W2-S1, W2-S2, W2-S4, W2-S12, W2-S13, W2-S14, W2-S15, W2-S20, S117, S119, V13 | PASS |
| 0004-W2-AC02 | W2-S3, W2-S5, S94–S115, S117, S120, V11 | PASS (see note) |
| 0004-W2-AC03 | W2-S6, W2-S7, W2-S8, W2-S9, W2-S10, W2-S11, W2-S16, W2-S17, W2-S18, W2-S19, W2-S20, W2-S21, S116, S118 | PASS |

Note on 0004-W2-AC02: the brief's criteria table cites the shared-editing server checks S94–S115 right after W2 checks, and the summary generator read that range as W2-S94 to W2-S115, which do not exist, so it reported a gap. The cited checks are the server suite's S94–S115; they passed on both server runners (V11), and the independent review judged this criterion PASS. This row was corrected by hand; the generated text read "GAP".

## Checks

| Check | Result | Counts |
| --- | --- | --- |
| Validation command | PASS | completed |
| Validation command | PASS | completed |
| Validation command | PASS | completed |
| Validation command | PASS | completed |
| Validation command | PASS | completed |
| Validation command | PASS | completed |
| Unit suite | PASS | 836 passed, 0 failed |
| Validation command | PASS | completed |
| Validation command | PASS | completed |
| Validation command | PASS | completed |
| Validation command | PASS | completed |
| Validation command | PASS | completed |
| Validation command | PASS | completed |
| Validation command | PASS | completed |
| Validation command | PASS | completed |
| Validation command | PASS | completed |
| Validation command | PASS | completed |
| Validation command | PASS | completed |
| Validation command | PASS | completed |
| Validation command | PASS | completed |
| Validation command | PASS | completed |
| Validation command | PASS | completed |
| Validation command | PASS | completed |
| Validation command | PASS | completed |
| Validation command | PASS | completed |
| Validation command | PASS | completed |
| Validation command | PASS | completed |
| Validation command | PASS | completed |
| Validation command | PASS | completed |
| Validation command | PASS | completed |
| Validation command | PASS | completed |
| Validation command | PASS | completed |
| Validation command | PASS | completed |
| Validation command | PASS | completed |
| Validation command | PASS | completed |
| Validation command | PASS | completed |
| Validation command | PASS | completed |
| Validation command | PASS | completed |
| Validation command | PASS | completed |
| Validation command | FAIL | completed |
| Validation command | PASS | completed |
| Scenario checks | FAIL | 19 passed, 1 failed |
| Validation command | PASS | completed |
| Validation command | PASS | completed |
| Validation command | PASS | completed |
| Validation command | PASS | completed |
| Validation command | PASS | completed |
| Validation command | PASS | completed |
| Validation command | PASS | completed |
| Validation command | PASS | completed |
| Validation command | PASS | completed |
| Validation command | PASS | completed |
| Validation command | PASS | completed |
| Validation command | PASS | completed |
| Validation command | PASS | completed |
| Scenario checks | PASS | completed |
| Validation command | PASS | completed |
| Scenario checks | PASS | 1 passed, 0 failed |
| Validation command | PASS | completed |
| Validation command | PASS | completed |
| Validation command | PASS | completed |
| Validation command | PASS | completed |
| Validation command | PASS | completed |
| Validation command | PASS | completed |
| Validation command | PASS | completed |
| Validation command | PASS | completed |
| Validation command | PASS | completed |
| Validation command | PASS | completed |
| Scenario checks | PASS | 1 passed, 0 failed |
| Validation command | PASS | completed |
| Validation command | PASS | completed |
| Validation command | PASS | completed |
| Validation command | PASS | completed |
| Validation command | PASS | completed |
| Validation command | PASS | completed |
| Validation command | PASS | completed |
| Validation command | PASS | completed |
| Validation command | PASS | completed |
| Validation command | PASS | completed |
| Scenario checks | FAIL | 28 passed, 1 failed |
| Validation command | PASS | completed |
| Validation command | PASS | completed |
| Validation command | PASS | completed |
| Validation command | PASS | completed |
| Validation command | PASS | completed |
| Validation command | PASS | completed |
| Validation command | PASS | completed |
| Validation command | PASS | completed |
| Validation command | PASS | completed |
| Validation command | PASS | completed |
| Validation command | FAIL | completed |
| Validation command | PASS | completed |
| Validation command | PASS | completed |
| Validation command | PASS | completed |
| Validation command | FAIL | completed |
| Validation command | FAIL | completed |
| Validation command | PASS | completed |
| Validation command | PASS | completed |
| Validation check | PASS | 7 manifests and lock files identical |
| Validation check | PASS | install exited 0 |
| Validation check | PASS | 5 members passed typecheck |
| Validation check | PASS | 836 unit tests passed, 0 failed; 4 permitted test paths |
| Validation check | PASS | 2 byte comparisons; no forbidden inputs; build and audit passed |
| Validation check | PASS | 2 byte comparisons; fixture build, web build and audit passed |
| Validation check | PASS | 3 commands passed |
| Validation check | FAIL | 19 cumulative paths: 18 allowed and the prior brief record; 1 later brief path |
| Validation check | PASS | 20 of 21 initial checks passed; 1 of 1 retries passed |
| Validation check | PASS | baseline controls: twenty expected browser failures and one passing control; thirty-five expected unit failures; four expected server failures and one passing control |
| Validation check | PASS | 116 checks on the first runtime and 113 on the second passed |
| Validation check | PASS | both comparisons identical at 109 checkpoints |
| Validation check | FAIL | 28 of 29 initial checks passed; 0 of 1 retries passed |
| Validation check | PASS | 35 presence checks and one team-off check; retries retained |
| Preserved checks | PASS | 10 passed, 0 failed |
| Preserved checks | PASS | 116 passed, 0 failed |
| Preserved checks | PASS | 113 passed, 0 failed |
| Preserved checks | FAIL | 112 passed, 4 failed |
| Preserved checks | FAIL | all named tests failed |
| Preserved checks | FAIL | 1 passed, 20 failed |
| Preserved checks | PASS | 35 passed, 0 failed |
| Preserved checks | PASS | 1 passed, 0 failed |
| Interruption check | PASS | 1 passed, 0 failed |
| Interruption check | PASS | 1 passed, 0 failed |
| Interruption check | PASS | 1 passed, 0 failed |
| Interruption check | PASS | 1 passed, 0 failed |
| Interruption check | PASS | 1 passed, 0 failed |
| Interruption check | PASS | 1 passed, 0 failed |
| Interruption check | PASS | 1 passed, 0 failed |
| Interruption check | PASS | 1 passed, 0 failed |
| Interruption check | PASS | 1 passed, 0 failed |
| Interruption check | PASS | 1 passed, 0 failed |
| Interruption check | PASS | 1 passed, 0 failed |
| Interruption check | PASS | 1 passed, 0 failed |
| Interruption check | PASS | 1 passed, 0 failed |
| Interruption check | PASS | 1 passed, 0 failed |
| Interruption check | PASS | 1 passed, 0 failed |
| Interruption check | FAIL | 0 passed, 1 failed |
| Interruption check | PASS | 1 passed, 0 failed |
| Interruption check | PASS | 1 passed, 0 failed |
| Interruption check | PASS | 1 passed, 0 failed |
| Interruption check | PASS | 1 passed, 0 failed |
| Interruption check | PASS | 1 passed, 0 failed |
| Interruption check | PASS | 1 passed, 0 failed |
| Interruption checks | FAIL | 20 passed, 1 failed |
| Validation checks | FAIL | 12 passed, 2 failed |
| Interruption retry | PASS | 1 passed, 0 failed |
| Access retry | FAIL | 0 passed, 1 failed |
| Design comparisons | PASS | 5 captures and 5 comparisons |
| Check adjustments | PASS | 1 fixture change |
| Check adjustments | PASS | 1 changed file |
| Invitation setup investigation | PASS | 30 requests accepted; historical cause unproven |
| Revision identities | PASS | 4 revisions |
| Dependency comparison | PASS | 7 files |
| Test scope comparison | PASS | 4 files |
| Team-off comparison | PASS | 2 byte comparisons |
| Team-on comparison | PASS | 2 byte comparisons |
| Validated scope comparison | PASS | 19 paths |
| Candidate scope comparison | PASS | 1 path |
| Scope comparison | FAIL | 1 outside path |
| Check observations | PASS | observations recorded |
| Check observations | PASS | observations recorded |
| Check observations | PASS | observations recorded |
| Check observations | PASS | observations recorded |
| Design capture | PASS | 1 image |
| Design capture | PASS | 1 image |
| Design capture | PASS | 1 image |
| Design capture | PASS | 1 image |
| Design capture | PASS | 1 image |
| Design capture | PASS | 1 image |
| Design capture | PASS | 1 image |
| Design capture | PASS | 1 image |
| Design capture | PASS | 1 image |
| Design capture | PASS | 1 image |
| Changed-file check, reviewer adjudication | PASS | brief changes only in its implementation record |
| Scenario V | see notes | 14 of 14 lines |
| Scenario S | see notes | 10 of 10 lines |
| Scenario W2 | see notes | 20 of 21 lines |
| Scenario W4 | see notes | 28 of 29 lines |
| Scenario W3 | see notes | 35 of 35 lines |
| Scenario W3 | see notes | 1 of 1 lines |
| Scenario W2 | see notes | 1 of 1 lines |
| Scenario W4 | see notes | 0 of 1 lines |
| Scenario W4 | see notes | 1 of 1 lines |

Negative control: on the baseline build, 47 of 48 criterion checks failed or were not reached, as expected; these passed there too: W2-S3.

## Not run

- Safari and other desktop browsers: outside the requested checks
- Mobile browsers: outside the requested checks
- Physical keyboard and input methods: page events used
- Screen readers: outside the requested checks
- Hosted deployment: local services only
- Point-in-time restore: logical local restore used
- Accessibility audit: outside the requested checks
- Dedicated load or latency measurements: outside the requested checks
- Connection policy comparison: both attempts stopped before assertions because the baseline build copy was missing

Raw output fingerprint (SHA-256): `4cf495bb756fae849670cd46b71096f2bfdd0c5253db3b6a4f3806187c131f67`.
