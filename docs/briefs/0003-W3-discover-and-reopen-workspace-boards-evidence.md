# 0003-W3 — evidence summary

Brief: [0003-W3-discover-and-reopen-workspace-boards.md](0003-W3-discover-and-reopen-workspace-boards.md). Reviewed commit `5cb8f0bcd59d72b3b730ae02609f4782c8961c4b`, validated source `e3b5ad8e6029e7a38f9f7dc2d840e6228879b277`, compared with `be3272347581874319b773fa40dbc406013d2d36`.
Environment: node v26.13.0, npm 11.20.0, docker_client 29.9.2, docker_engine 29.5.2, platform darwin/arm64; Docker linux/arm64.

## Acceptance criteria

| Criterion | Checks | Result |
| --- | --- | --- |
| 0003-W3-AC01 | S55, S56, S57, S72, S73, S74, S75, S76 | PASS |
| 0003-W3-AC02 | S58, S59, S61, S62, S63, S64, S65, S66, S67, S68, S69, S70, S71 | PASS |
| 0003-W3-AC03 | S55, S56, S57, S58, S59, S60, S71, S73 | PASS |

## Checks

| Check | Result | Counts |
| --- | --- | --- |
| Runtime versions | PASS | exit 0 |
| Install dependencies | PASS | exit 0 |
| Generate local signing key | PASS | exit 0 |
| Start local test services | PASS | exit 0 |
| Write local test settings | PASS | exit 0 |
| Local test service status | PASS | exit 0 |
| Type checks | PASS | 5 members passed |
| Full unit suite | PASS | 671 passed, 0 failed, 0 skipped |
| Web build | PASS | 1 command passed |
| Fixture build | PASS | 1 command passed |
| Server build | PASS | 1 command passed |
| License audit | PASS | 1 command passed |
| Deployment preview | PASS | 1 command passed |
| Server checks on first runtime | PASS | 72 passed, 0 failed in scenario summaries |
| Server checks on second runtime | PASS | 69 passed, 0 failed in scenario summaries |
| Container server checks | PASS | 4 passed, 0 failed in scenario summaries |
| Baseline dependency installation | PASS | exit 0 |
| Baseline web build | PASS | 1 command passed |
| Baseline fixture build | PASS | 1 command passed |
| Baseline control dependency installation | PASS | exit 0 |
| Baseline control on first runtime (superseded: run against a database that held the candidate schema) | FAIL | 51 passed, 21 failed in scenario summaries; expected authentication check and one additional check pass |
| Baseline control on second runtime (superseded: run against a database that held the candidate schema) | FAIL | 49 passed, 20 failed in scenario summaries; expected authentication check and one additional check pass |
| Baseline control unit tests (superseded: run against a database that held the candidate schema) | FAIL | 0 passed, 9 failed; 9 lack required modules |
| Restore baseline checkout | PASS | exit 0 |
| Baseline checkout status | PASS | exit 0 |
| Stop local test services | PASS | exit 0 |
| Record remaining local resources | PASS | exit 0 |
| Record remaining local resources | PASS | exit 0 |
| Record remaining local resources | PASS | exit 0 |
| Record remaining local resources | PASS | exit 0 |
| Record remaining local resources | PASS | exit 0 |
| Record remaining local resources | PASS | exit 0 |
| Record remaining local resources | PASS | exit 0 |
| Record remaining local resources | PASS | exit 0 |
| Changed files and scope | PASS | exit 0 |
| Changed files and scope | PASS | exit 0 |
| Changed files and scope | PASS | exit 0 |
| Public boundary check | PASS | exit 0 |
| Public boundary check | PASS | exit 0 |
| Changed files and scope | PASS | exit 0 |
| Dependency manifest listing | PASS | 6 manifests |
| Dependency manifest listing | PASS | 6 manifests |
| Pinned source revisions | PASS | 3 pinned revisions |
| Dependency file hashes | PASS | 7 files |
| Baseline dependency file hashes | PASS | 7 files |
| Web artifact comparison | PASS | 4 pairs identical |
| Dependency consistency | PASS | all manifests and lock are identical |
| Dependency installation | PASS | dependency installation exit 0 |
| Type checks | PASS | type checks exit 0 |
| Unit behavior | PASS | 671 passed, 0 failed; only new root test file is lists |
| Web build consistency | PASS | both web builds passed; all four hashes identical |
| Server build and license coverage | PASS | server build and notices audit passed |
| Deployment preview | PASS | deployment preview exit 0 |
| Primary server runtime | PASS | 72/72 required checks passed; summaries zero failures |
| Secondary server runtime | PASS | 69/69 required checks passed; summaries zero failures |
| Container behavior | PASS | 4/4 required checks passed; summaries zero failures |
| Deliverable boundaries | PASS | 27 validated files within items 1 to 5; candidate adds only brief |
| Baseline comparison (superseded: run against a database that held the candidate schema) | FAIL | S60 and S67 pass on both baselines; nine unit failures require absent modules |
| Baseline control on first runtime, fresh database | PASS | authentication check passes; 21 new checks fail as expected; existing checks 50/50 |
| Baseline control on second runtime, fresh database | PASS | authentication check passes; 20 new checks fail as expected; existing checks 48/48 |
| Baseline control unit tests, fresh database | PASS | 9 new unit tests fail on the baseline with an assertion that their module is absent |
| Scenario V | see notes | 11 of 12 lines |
| Scenario S | see notes | 72 of 72 lines |
| Scenario S | see notes | 69 of 69 lines |
| Scenario S | see notes | 4 of 4 lines |

Negative control: on the baseline build, 21 of 22 criterion checks failed or were not reached, as expected; these passed there too: S60.

## Not run

- Browser checks, hosted deployment and a real hosted restore were excluded by request.
- Three server checks run only on the primary runtime and were omitted on the secondary runtime.
- Nine baseline unit behavior comparisons could not be established because required modules were absent.
- The full baseline unit suite was not run; the requested new-file unit command was used.

Raw output fingerprint (SHA-256): `ca68494522762b364ef1831182477eed96b1e2f951086e50bc570b06a9632981`.
