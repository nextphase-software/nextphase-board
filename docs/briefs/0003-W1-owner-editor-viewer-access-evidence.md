# 0003-W1 — evidence summary

Brief: [0003-W1-owner-editor-viewer-access.md](0003-W1-owner-editor-viewer-access.md). Reviewed commit `c4cfb586793eb4c43c9c01a63ca9fdfb839f6d35`, validated source `508d00767a056afef23e868fc29f6b117375dd52`, compared with `d0976e6df03ce407321e62d5b21ce2a71ed917ea`.
Environment: node 26.13.0, npm 11.20.0, chrome 156.0.8078.48, docker_client 29.9.2, docker 29.5.2.

## Acceptance criteria

| Criterion | Checks | Result |
| --- | --- | --- |
| 0003-W1-AC01 | S1, S7, S12, S13, S14, S21, S22, S23, S24, S25, S26, S27, S31, S49 | PASS |
| 0003-W1-AC02 | S6, S7, S8, S9, S10, S11, S15, S16, S17, S18, S19, S21, S22, S23, S24, S25, S29, S33, S36, S37, S38, S39, S40, S41, S42, S43, S44, S45, S46, S48 | PASS |
| 0003-W1-AC03 | S2, S3, S4, S5, S7, S8, S9, S10, S11, S12, S13, S14, S15, S16, S17, S20, S29, S30, S34, S36, S38, S39, S41, S46 | PASS |

## Checks

| Check | Result | Counts |
| --- | --- | --- |
| Environment versions | PASS | Completed successfully |
| Initial local resources | PASS | Completed successfully |
| Isolated checkout | PASS | Completed successfully |
| Isolated checkout | PASS | Completed successfully |
| Isolated checkout | PASS | Completed successfully |
| Checkout revisions | PASS | Completed successfully |
| Baseline source equivalence | PASS | Completed successfully |
| Dependency lock regeneration | PASS | Completed successfully |
| Dependency lock identity | PASS | Completed successfully |
| Dependency installation | PASS | Completed successfully |
| Local signing key | PASS | Completed successfully |
| Local identity service startup | PASS | Completed successfully |
| Local identity service settings | PASS | Completed successfully |
| Local identity service status | PASS | Completed successfully |
| Workspace type checks | PASS | Completed successfully |
| Full unit suite | PASS | 662 passed, 0 failed, 0 skipped |
| Web build | PASS | Completed successfully |
| Fixture build | PASS | Completed successfully |
| Server build | PASS | Completed successfully |
| License checks | PASS | Completed successfully |
| Dependency advisory check | PASS | Completed successfully |
| Runtime dependency advisory check | PASS | Completed successfully |
| Deployment preparation without upload | PASS | Completed successfully |
| Primary server suite | PASS | 50 passed, 0 failed |
| Alternate server suite | PASS | 48 passed, 0 failed |
| Container server suite | PASS | 4 passed, 0 failed |
| Baseline install | PASS | Completed successfully |
| Baseline build | PASS | Completed successfully |
| Baseline fixtures | PASS | Completed successfully |
| Public content boundary | PASS | Completed successfully |
| Public content boundary | PASS | Completed successfully |
| Browser checkpoint capture | PASS | 109 checkpoints |
| Browser checkpoint capture | PASS | 109 checkpoints |
| Browser checkpoint capture | PASS | 109 checkpoints |
| Repeated baseline comparison | PASS | Completed successfully |
| Candidate browser comparison | PASS | Completed successfully |
| Browser fixture checks | PASS | 8 passed, 0 failed |
| Browser fixture checks | PASS | 8 passed, 0 failed |
| Web artifact identity | PASS | Completed successfully |
| Changed file scope | PASS | Completed successfully |
| Candidate documentation change | PASS | Completed successfully |
| Baseline rejects added checks | PASS | Expected nonzero exit; 1 |
| Baseline rejects added checks | PASS | Expected nonzero exit; 1 |
| Baseline has no server suite | PASS | Completed successfully |
| Local identity service shutdown | PASS | Completed successfully |
| Created resources removed | PASS | Completed successfully |
| Candidate changed files | PASS | Completed successfully |
| Existing unit tests retained | PASS | Completed successfully |
| Browser server shutdown | PASS | Completed successfully |
| Final local resource inventory | PASS | Completed successfully |
| Existing test changes | PASS | Completed successfully |
| Module guard changes | PASS | Completed successfully |
| lock matches v4; old web lock absent | PASS | 1 passed, 0 failed |
| clean dependency installation exits zero | PASS | 1 passed, 0 failed |
| all five workspace type checks pass | PASS | 1 passed, 0 failed |
| 662 unit tests pass; existing tests retained | PASS | 662 passed, 0 failed, 0 skipped |
| both web builds pass | PASS | 1 passed, 0 failed |
| both server bundles and notices are present | PASS | 1 passed, 0 failed |
| license checks pass | PASS | 1 passed, 0 failed |
| both audits report no high or critical advisories | PASS | 1 passed, 0 failed |
| deployment dry run passes without upload | PASS | 1 passed, 0 failed |
| 50 server checks pass; zero failures | PASS | 50 passed, 0 failed |
| 48 server checks pass; zero failures | PASS | 48 passed, 0 failed |
| 4 server checks pass; zero failures | PASS | 4 passed, 0 failed |
| 109 checkpoints match in both comparisons; both fixtures pass 8 of 8 | PASS | 109 matching checkpoints; 16 fixture checks passed |
| all four web artifact hashes match | PASS | 4 matching artifacts |
| 88 validated paths stay in scope; candidate changes only brief | PASS | 88 scoped entries |
| both added baseline tests fail as expected; no baseline server | PASS | 2 expected nonzero exits; server absent |
| Browser checkpoint capture | PASS | 109 checkpoints |
| Browser checkpoint capture | PASS | 109 checkpoints |
| Browser checkpoint capture | PASS | 109 checkpoints |
| Scenario V | see notes | 16 of 16 lines |
| Scenario S | see notes | 50 of 50 lines |
| Scenario S | see notes | 48 of 48 lines |
| Scenario S | see notes | 4 of 4 lines |

## Not run

- Safari acceptance remains with the maintainer.
- Hosted deployment and hosted point-in-time restore were excluded.
- Broader browser, accessibility and load testing were excluded.

Raw output fingerprint (SHA-256): `e977f91ae0590b8e558598fc9ac60214afe0e3638748e717e1bd1d83ab47edb6`.
