# 0003-W4 — evidence summary

Brief: [0003-W4-sign-in-share-and-see-access.md](0003-W4-sign-in-share-and-see-access.md). Reviewed commit `b96a3562d6c692ca5650e3d7d51e5f5eae6145e4`, validated source `24e4a261437d724ce546c7d942ace4a205e7387d`, compared with `095beed9b5ab26e96720ae4477b7ee726d916ad2`.
Environment: node 26.13.0, npm 11.20.0, chrome 156.0.8078.76, docker 29.9.2.

## Acceptance criteria

| Criterion | Checks | Result |
| --- | --- | --- |
| 0003-W4-AC01 | S1, S2, S3, S6, S7, S16, S19, S20, S21, S22, S23, S24, S27, S29, V5, V11, V12 | PASS |
| 0003-W4-AC02 | S4, S5, S6, S7, S8, S9, S10, S11, S13, S18, S25 | PASS |
| 0003-W4-AC03 | S9, S10, S11, S12, S14, S15, S17, S25, S26, S28 | PASS |

## Checks

| Check | Result | Counts |
| --- | --- | --- |
| Dependency lock and manifests | PASS | 1 permitted dependency line |
| Clean install | PASS | exit 0 |
| Workspace type checks | PASS | 5 workspaces passed |
| Full unit suite and test changes | PASS | 748 passed, 0 failed |
| Team features off build | PASS | 2 identical artifacts; no team inputs |
| Team features on build and setting validation | PASS | 2 expected build refusals |
| Server build and notices | PASS | 2 unchanged server notice files |
| Changed file boundaries | PASS | 40 scoped files; 1 later brief file |
| Candidate browser checks | PASS | 29 passed, 0 failed |
| Baseline negative control | PASS | 27 expected browser failures; 2 backend passes; 5 expected unit failures |
| Team features off network isolation | PASS | 6 static requests; 0 WebSockets |
| Unchanged local board behavior | PASS | 109 checkpoints each; 2 identical comparisons |
| Supporting command receipt | PASS |  |
| Supporting command receipt | PASS |  |
| Full unit suite | PASS | 748 passed, 0 failed |
| Supporting command receipt | PASS |  |
| Supporting command receipt | PASS |  |
| Supporting command receipt | PASS |  |
| Supporting command receipt | PASS |  |
| Supporting command receipt | PASS |  |
| Supporting command receipt | PASS |  |
| Supporting command receipt | PASS |  |
| Supporting command receipt | PASS |  |
| Supporting command receipt | PASS |  |
| Supporting command receipt | PASS |  |
| Supporting command receipt | PASS |  |
| Supporting command receipt | PASS |  |
| Supporting command receipt | PASS |  |
| Initial local schema setup | FAIL | schema cache was not yet ready; corrected setup succeeded |
| Supporting command receipt | PASS |  |
| Supporting command receipt | PASS |  |
| Supporting command receipt | PASS |  |
| Supporting command receipt | PASS |  |
| Supporting command receipt | PASS |  |
| Supporting command receipt | PASS |  |
| Supporting command receipt | PASS |  |
| Supporting command receipt | PASS |  |
| Supporting command receipt | PASS |  |
| Supporting command receipt | PASS |  |
| Expected dependency lock difference | PASS | expected nonzero exit |
| Supporting command receipt | PASS |  |
| Supporting command receipt | PASS |  |
| Supporting command receipt | PASS |  |
| Supporting command receipt | PASS |  |
| Supporting command receipt | PASS |  |
| Supporting command receipt | PASS |  |
| Supporting command receipt | PASS |  |
| Supporting command receipt | PASS |  |
| Supporting command receipt | PASS |  |
| Reject missing server origin | PASS | expected nonzero exit |
| Reject server origin with a path | PASS | expected nonzero exit |
| Supporting command receipt | PASS |  |
| Supporting command receipt | PASS |  |
| Supporting command receipt | PASS |  |
| Supporting command receipt | PASS |  |
| Supporting command receipt | PASS |  |
| Supporting command receipt | PASS |  |
| Supporting command receipt | PASS |  |
| Supporting command receipt | PASS |  |
| Supporting command receipt | PASS |  |
| Supporting command receipt | PASS |  |
| New unit checks against the baseline | PASS | 8 passed, 5 expected failures |
| Supporting command receipt | PASS |  |
| Supporting command receipt | PASS |  |
| Supporting command receipt | PASS |  |
| Supporting command receipt | PASS |  |
| Supporting command receipt | PASS |  |
| Supporting command receipt | PASS |  |
| No remaining test listeners | PASS | expected nonzero exit |
| Supporting command receipt | PASS |  |
| Supporting command receipt | PASS |  |
| Initial browser checks | FAIL | 22 passed, 7 harness failures |
| Selected browser checks after harness corrections | PASS | 8 passed, 0 failed |
| Candidate browser checks | PASS | 29 passed, 0 failed |
| Baseline browser negative control | PASS | 27 expected failures, 2 passed |
| Team features off network check | PASS | 6 static requests, 0 WebSockets |
| Supporting evidence artifact | PASS | recorded |
| Supporting evidence artifact | PASS | recorded |
| Supporting evidence artifact | PASS | recorded |
| Supporting evidence artifact | PASS | recorded |
| Supporting evidence artifact | PASS | recorded |
| Supporting evidence artifact | PASS | recorded |
| Supporting evidence artifact | PASS | recorded |
| Supporting evidence artifact | PASS | recorded |
| Supporting evidence artifact | PASS | recorded |
| Supporting evidence artifact | PASS | recorded |
| Evidence and cleanup verification | PASS | verified |
| No remaining started server processes | PASS | verified |
| Scenario V | see notes | 12 of 12 lines |
| Scenario W4 | see notes | 29 of 29 lines |

Negative control: on the baseline build, 27 of 29 criterion checks failed or were not reached, as expected; these passed there too: S20, S22.

## Not run

- Server integration suites: excluded because this change leaves the server and room unchanged.
- Safari and other browsers: outside this Chrome check run.
- Hosted deployment: local services only were authorized.
- Accessibility audit: outside the requested checks.
- Load or latency measures: outside the requested checks.

Raw output fingerprint (SHA-256): `b3d25786573b45b71e671aaf9be20b4d894dc1e0279a2f39590ee1d9682671c3`.
