# 0004-W1 — evidence summary

Brief: [0004-W1-edit-together-with-participant-presence.md](0004-W1-edit-together-with-participant-presence.md). Reviewed commit `4b9278337cfcefc7564e2cf5656284284aa169b5`, validated source `3d41733b28b0f8dfe93cfe3b1475186356cc2eb0`, compared with `9c06551ad0aa27a0cee03c0c027f9a9dff6db88d`.
Environment: node 26.13.0, npm 11.20.0, docker 29.9.2, chrome 156.0.8078.48, docker_client 29.9.2, docker_server 29.5.2.

## Acceptance criteria

| Criterion | Checks | Result |
| --- | --- | --- |
| 0004-W1-AC01 | S94, S95, S96, S97, S98, S99, S100, S101 and unit tests | PASS |
| 0004-W1-AC02 | S103, S104, S105, S106, S107, S108, S109 and unit tests | PASS |
| 0004-W1-AC03 | S102, S106, S110, S111, S112, S113, S114, S115 and unit tests | PASS |

## Checks

| Check | Result | Counts |
| --- | --- | --- |
| Candidate clone | PASS |  |
| Validated clone | PASS |  |
| Baseline clone | PASS |  |
| environment | PASS |  |
| Initial container resource inventory | PASS |  |
| Initial container resource identifiers | PASS |  |
| Candidate clean install | PASS |  |
| Previous local database shutdown | PASS |  |
| Candidate local signing setup | PASS |  |
| Initial package listing attempt | FAIL |  |
| Unit test file changes | PASS |  |
| Validated file changes | PASS |  |
| Candidate documentation changes | PASS |  |
| Candidate local database startup | PASS |  |
| Candidate local database details | PASS |  |
| Candidate local database status | PASS |  |
| Type checks | PASS | 5 workspace members passed |
| V1 | PASS |  |
| Baseline unit test file list | PASS |  |
| Full unit suite | PASS | 726 passed, 0 failed, 0 skipped |
| Candidate web build | PASS |  |
| Publication boundary check | PASS |  |
| Candidate fixture build | PASS |  |
| Server build | PASS |  |
| License audit | PASS |  |
| Deployment packaging dry run | PASS |  |
| Publication boundary check | PASS |  |
| diff | PASS |  |
| Primary server suite | PASS | 111 passed, 0 failed |
| Original repository state | PASS |  |
| Alternate server suite | PASS | 108 passed, 0 failed; 1 skipped |
| Candidate local database shutdown | PASS |  |
| Baseline clean install | PASS |  |
| Baseline web build | PASS |  |
| Baseline fixture build | PASS |  |
| Between-run container resource inventory | PASS |  |
| Web asset hashes | PASS |  |
| Server output files | PASS |  |
| Baseline local signing setup | PASS |  |
| Baseline local database startup | PASS |  |
| Baseline local database details | PASS |  |
| Baseline local database status | PASS |  |
| Baseline test connection details | PASS |  |
| Baseline production files unchanged | PASS |  |
| Primary baseline negative control | PASS | 89 passed, 0 failed existing checks; new suite fails at module load; no new check passed |
| Alternate baseline negative control | PASS | 86 passed, 0 failed existing checks; new suite fails at module load; no new check passed; 1 skipped |
| Unit baseline negative control | PASS | 0 passed, 2 file-level failures at module load; individual cases not reached |
| Baseline local database shutdown | PASS |  |
| Baseline clone restoration | PASS |  |
| Restored baseline web build | PASS |  |
| Baseline negative control orchestration | PASS |  |
| Browser comparison | PASS |  |
| Browser comparison | PASS |  |
| Browser comparison | PASS |  |
| Browser comparison | PASS |  |
| Browser comparison | PASS |  |
| Browser comparison orchestration | PASS |  |
| Final container inventory | PASS |  |
| Final image inventory | PASS |  |
| Final volume inventory | PASS |  |
| Final network inventory | PASS |  |
| cleanup driver | PASS |  |
| original repository status final | PASS |  |
| original repository state comparison | PASS |  |
| base restored state | PASS |  |
| Validation 1 | PASS | 6 package manifests and lock unchanged |
| Validation 2 | PASS | clean install exits 0 |
| Validation 3 | PASS | all five workspace members pass |
| Validation 4 | PASS | 726 unit tests pass; existing files unchanged; only two named new unit files |
| Validation 5 | PASS | both web builds pass; HTML, CSS and notices hashes match; app hashes recorded |
| Validation 6 | PASS | server build and license audit pass; output files recorded |
| Validation 7 | PASS | dry run exits 0; nothing deployed |
| Validation 8 | PASS | 111/111 required server checks pass; 4 summaries |
| Validation 9 | PASS | 108/108 required server checks pass; 4 summaries |
| Validation 10 | PASS | 24 validated paths within scope; candidate delta is only brief |
| Validation 11 | PASS | new suites fail on missing asserted production modules; no new check passes on baseline |
| Validation 12 | PASS | 109 checkpoints per run; base repeat and candidate diffs identical |
| Browser comparison record | PASS | 109 checkpoints |
| Browser comparison record | PASS | 109 checkpoints |
| Browser comparison record | PASS | 109 checkpoints |
| Pinned revisions | PASS | 3 full revisions recorded |
| Validation scenario results | PASS | 12 checks |
| Negative control test inputs | PASS | 12 test and configuration files |
| Server check completeness | PASS | No non-PASS lines or missing required checks |
| Negative control evaluation | PASS | No new check passed on the baseline |
| Static comparison server | PASS | Started successfully; stopped intentionally with process exit -15 |
| Static comparison server | PASS | Started successfully; stopped intentionally with process exit -15 |
| Static comparison server | PASS | Started successfully; stopped intentionally with process exit -15 |
| Static comparison server shutdown | PASS | 3 processes stopped |
| Resource cleanup | PASS | Both local stacks and all static processes stopped; no created resources remain |
| Scenario V | see notes | 12 of 12 lines |
| Scenario S | see notes | 111 of 111 lines |
| Scenario S | see notes | 108 of 108 lines |

Negative control: on the baseline build, 22 of 22 criterion checks failed or were not reached, as expected.

## Not run

- Hosted deployment: excluded from this check run.
- Containerized application runner: excluded from this check run.
- Latency and cost measurements: excluded from this check run.
- Safari: reserved for the maintainer.

Raw output fingerprint (SHA-256): `045448a8272cb663cc5c77862024f72d6aae85cee8fcf2c6b2c78236f9c95377`.
