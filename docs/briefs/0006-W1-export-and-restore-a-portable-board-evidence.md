# 0006-W1 — evidence summary

Brief: [0006-W1-export-and-restore-a-portable-board.md](0006-W1-export-and-restore-a-portable-board.md). Reviewed commit `55089243890ac5aef43f8db2d501dcfa86bbde28`, validated source `af8eb5d821a6cbf0200de7158a9959e8634f74bc`, compared with `e9779e588448b673d5857f65037056f345dec3dc`.
Environment: node 26.13.0, npm 11.20.0, chrome 156.0.8078.80, docker 29.9.3.
Assembled after the review from its saved outputs, which were not fingerprinted when they were made.

## Acceptance criteria

| Criterion | Checks | Result |
| --- | --- | --- |
| 0006-W1-AC01 | X1-S6, X1-S7 | PASS |
| 0006-W1-AC02 | X1-S1, X1-S2, X1-S3, X1-S5, X1-S8, X1-S9, X1-S10, X1-S11, X1-S25, X1-S134, X1-S138, X1-S139, X1-S140, X1-S141 | PASS (see note) |
| 0006-W1-AC03 | X1-S4, X1-S12, X1-S13, X1-S14, X1-S15, X1-S16, X1-S17, X1-S18, X1-S19, X1-S20, X1-S21, X1-S22, X1-S23, X1-S24, X1-S135, X1-S136, X1-S137, X1-S140, X1-S142 | PASS (see note) |

Note on 0006-W1-AC02 and AC03: the matrix shows a gap only because the server checks (S134 to S142) are not lines of the browser log. They ran in the server suites: Node 138 of 138 and Worker 135 passed with 1 skipped (a documented skip). One review finding (Minor, a test-only ordering defect in S140's rows comparison) was fixed in `af8eb5d`; the tip adds only the brief's record. Two browser-check tool errors in the first check run (a file built with the app's size-limited writer, and a wrong role route) were corrected in the tool, with every assertion's meaning kept. The negative control on the baseline fails 21 of 25 browser checks, as it should.

## Checks

| Check | Result | Counts |
| --- | --- | --- |
| Run local validation command | PASS | Command exited 0 |
| Run local validation command | PASS | Command exited 0 |
| Run local validation command | PASS | Command exited 0 |
| Run local validation command | PASS | Command exited 0 |
| Install accepted dependencies | PASS | Command exited 0 |
| Run local validation command | PASS | Command exited 0 |
| Check types for all five members | PASS | Command exited 0 |
| Full unit suite | PASS | 876 passed, 0 failed |
| Run local validation command | PASS | Command exited 0 |
| Run local validation command | PASS | Command exited 0 |
| Run local validation command | PASS | Command exited 0 |
| Run local validation command | PASS | Command exited 0 |
| Run local validation command | PASS | Command exited 0 |
| Run local validation command | PASS | Command exited 0 |
| Run local validation command | PASS | Command exited 0 |
| Run local validation command | PASS | Command exited 0 |
| Run local validation command | PASS | Command exited 0 |
| Run local validation command | PASS | Command exited 0 |
| Public boundary check, validated revision | PASS | PASS |
| Run local validation command | PASS | Command exited 0 |
| Run local validation command | PASS | Command exited 0 (second run) |
| Public boundary check, tip | PASS | PASS |
| Run local validation command | PASS | Command exited 0 |
| Run local validation command | PASS | Command exited 0 |
| Server regression on Node | PASS | 138 passed, 0 failed |
| Run local validation command | PASS | Command exited 0 |
| Run local validation command | PASS | Command exited 0 |
| Server regression on Worker | PASS | 135 passed, 0 failed, 1 skipped |
| Run local validation command | PASS | Command exited 0 |
| Run local validation command | PASS | Command exited 0 |
| Run local validation command | PASS | Command exited 0 |
| Run local validation command | PASS | Command exited 0 |
| Run local validation command | PASS | Command exited 0 |
| Run local validation command | PASS | Command exited 0 |
| Import browser checks | PASS | 25 passed, 0 failed |
| Run local validation command | PASS | Command exited 0 |
| Run local validation command | PASS | Command exited 0 |
| Run local validation command | PASS | Command exited 0 |
| Run local validation command | PASS | Command exited 0 |
| Run local validation command | PASS | Command exited 0 |
| Run local validation command | PASS | Command exited 0 |
| Import browser negative control | FAIL | 4 passed, 21 failed (expected on baseline) |
| Run local validation command | PASS | Command exited 0 |
| Run local validation command | PASS | Command exited 0 |
| Run local validation command | PASS | Command exited 0 |
| Run local validation command | PASS | Command exited 0 |
| Run local validation command | PASS | Command exited 0 |
| Server negative control | FAIL | 127 passed, 11 failed (9 shared, 1 storage, 1 lists) |
| Run local validation command | PASS | Command exited 0 |
| Run local validation command | PASS | Command exited 0 |
| Validation criterion 8: fix touches only the test file; tip adds only the brief | PASS | fix 1 test path; tip adds only the brief |
| Validation criterion 9: import browser checks | PASS | 25 of 25 pass |
| Validation criterion 11: server suite on both runners | PASS | Node 138 of 138; Worker 135 pass, 1 skipped |
| Scenario X1 | see notes | 25 of 25 lines |

Negative control: on the baseline build, 30 of 34 criterion checks failed or were not reached, as expected; these passed there too: X1-S6, X1-S7, X1-S20, X1-S21.

## Not run

- Safari and other desktop browsers: outside the requested Chrome checks
- A hosted deployment: only local services authorized
- Validation criterion 10 browser half on baseline: unchanged from check-1 (4 pass, 21 fail)
- Scenario V log and the original meta.json: the run ended before writing them
- Home regression W5-S: not rerun; the fix touches one test file only

Raw output fingerprint (SHA-256): `5fe19d5e0c1007a4c7f1c8b07272e3bc93bbacc8b17da451e4298b857dcc993d`.
