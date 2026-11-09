# 0007-W1 — evidence summary

Brief: [0007-W1-run-a-shared-workshop-timer.md](0007-W1-run-a-shared-workshop-timer.md). Reviewed commit `752f79d3eb3c41f981673a1e512b581b9c72c919`, validated source `7f087803f505ba24fa3490aac6085a0ce94eda93`, compared with `20365d38a1255ab06ec7cc18f1e618494b67f7ae`.
Environment: node v26.13.0, chrome Google Chrome 156.0.8078.80, docker Docker version 29.9.3, build 5457199aa5.

## Acceptance criteria

| Criterion | Checks | Result |
| --- | --- | --- |
| 0007-W1-AC01 | Z1-S1, Z1-S2, Z1-S3, Z1-S4, Z1-S5, Z1-S6, Z1-S7, Z1-S8, Z1-S9, Z1-S10, Z1-S11, Z1-S12, Z1-S13, Z1-S14, Z1-S15, Z1-S16, Z1-S17, Z1-S18, Z1-S19, Z1-S20, Z1-S21, Z1-S22, Z1-S24, Z1-S25, Z1-S26, Z1-S27, Z1-S28, Z1-S30, Z1-S31, Z1-S33, S225, S226, S227, S228, S229, S230, S231, S232, S233, S234, S236, S237, S238, S239, S240, S241, S242, S243, S244, V4, V9 | GAP |
| 0007-W1-AC02 | Z1-S2, Z1-S3, Z1-S4, Z1-S7, Z1-S8, Z1-S9, Z1-S10, Z1-S11, Z1-S12, Z1-S13, Z1-S14, Z1-S16, Z1-S17, Z1-S22, Z1-S23, Z1-S25, Z1-S26, Z1-S27, Z1-S28, Z1-S29, Z1-S36, S226, S227, S228, S229, S230, S231, S232, S233, S234, S235, S236, S237, S238, S239, S240, S249, S254, V4, V9 | GAP |
| 0007-W1-AC03 | Z1-S13, Z1-S14, Z1-S28, Z1-S30, Z1-S31, Z1-S32, Z1-S33, Z1-S34, Z1-S35, Z1-S36, S241, S242, S243, S244, S245, S246, S247, S248, S249, S250, S251, S252, S253, S254, S255, S256, V4, V9, V10, V11, V12, V13 | GAP |

## Checks

| Check | Result | Counts |
| --- | --- | --- |
| Install | PASS |  |
| Typecheck | PASS |  |
| Unit full | PASS | 967 passed, 0 failed, 0 skipped |
| Off build | PASS |  |
| Off licenses | PASS |  |
| On build | PASS |  |
| On licenses | PASS |  |
| Fixtures | PASS |  |
| Server build | PASS |  |
| Server licenses | PASS |  |
| Worker dry | PASS |  |
| Docker before | PASS |  |
| Volumes before | PASS |  |
| Signing syntax | PASS |  |
| Signing | PASS |  |
| Stack start | PASS |  |
| Stack info syntax | PASS |  |
| Stack info | PASS |  |
| Browser prepare | PASS |  |
| Browser augment | PASS |  |
| Browser server | PASS |  |
| Live build | PASS |  |
| Boundary 7f08780 | PASS |  |
| Boundary 752f79d | PASS |  |
| Diff stat | PASS |  |
| Diff name | PASS |  |
| Diff full | PASS |  |
| Record diff | PASS |  |
| Diff check | PASS |  |
| Workshop timer browser checks | FAIL | 29 passed, 6 failed |
| Workshop timer browser checks | PASS | 1 passed, 0 failed |
| Workshop timer browser checks | FAIL | 11 passed, 1 failed |
| Workshop timer browser checks | FAIL | 5 passed, 1 failed |
| Scoped lifecycle browser regression checks | FAIL | 10 passed, 2 failed |
| Workshop timer browser checks | FAIL | 0 passed, 1 failed |
| Scoped lifecycle browser regression checks | PASS | 6 passed, 0 failed |
| Workshop timer browser checks | PASS | 1 passed, 0 failed |
| Workshop timer browser checks | PASS | 1 passed, 0 failed |
| Changed-file and record boundaries | PASS |  |
| Build inputs and notices comparison | PASS |  |
| Browser tool syntax checks | PASS |  |
| Browser tool undefined-name checks | PASS | 0 undefined names |
| Approved screen capture inventory | PASS | 22 captured, 0 missing |
| Workshop timer consolidated browser results | PASS | 36 passed, 0 failed |
| Owned-resource cleanup and repository preservation | PASS |  |
| Initial timing fixture attempt | FAIL |  |
| Scenario Z1 | see notes | 27 of 35 lines |
| Scenario Z1 | see notes | 7 of 10 lines |
| Scenario Z1 | see notes | 1 of 1 lines |
| Scenario S | see notes | 252 of 252 lines |
| Scenario S | see notes | 248 of 248 lines |
| Scenario Z1 | see notes | 1 of 1 lines |
| Scenario Z1 | see notes | 10 of 12 lines |
| Scenario Z1 | see notes | 2 of 4 lines |
| Scenario Z1 | see notes | 1 of 1 lines |
| Scenario Z1 | see notes | 0 of 1 lines |
| Scenario T1 | see notes | 56 of 60 lines |
| Scenario T1 | see notes | 1 of 1 lines |
| Scenario W2 | see notes | 15 of 21 lines |
| Scenario V | see notes | 11 of 13 lines |
| Scenario Z1 | see notes | 1 of 1 lines |
| Scenario Z1 | see notes | 29 of 35 lines |
| Scenario Z1-off | see notes | 1 of 1 lines |
| Scenario Z1-remaining | see notes | 11 of 12 lines |
| Scenario Z1-S12-retry | see notes | 5 of 6 lines |
| Scenario T1 | see notes | 10 of 12 lines |
| Scenario Z1-import-retry | see notes | 0 of 1 lines |
| Scenario T1-rightbar | see notes | 6 of 6 lines |
| Scenario Z1-viewer-ready | see notes | 1 of 1 lines |
| Scenario Z1-import-destination | see notes | 1 of 1 lines |
| Scenario Z1-final | see notes | 36 of 36 lines |

Negative control: on the baseline build, 68 of 68 criterion checks failed or were not reached, as expected.

## Not run

- Server suites: server, SQL, room and shared-package code is unchanged from the passing full check.
- Baseline negative control: omitted after the fix round under the scoped recheck policy.
- Team-off comparison campaign: timer modules are excluded and the earlier result is identical.
- Recovery and presence regression campaign: previous failures reproduced on the baseline and the changed timer files are outside its path.
- Two dialog geometry regression rows: the same baseline contract conflict remains.
- History-dependent role and local-export regression clauses: the required separate history scenario is not authorized; its evidence must not be fabricated.
- Unaffected lifecycle regression rows: outside the accepted scoped recheck.
- Safari spot check: reserved for the maintainer at the merge gate.

Raw output fingerprint (SHA-256): `3f0ac4cda564030a29605833a0a6efa935b3e313b98630a11d9722c881f5cdeb`.
