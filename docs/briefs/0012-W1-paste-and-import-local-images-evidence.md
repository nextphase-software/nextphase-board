# 0012-W1 — evidence summary

Brief: [0012-W1-paste-and-import-local-images.md](0012-W1-paste-and-import-local-images.md). Reviewed commit `944a4b292faefde065c4b91d206281f42fb0aebf`, validated source `ef816a8935b0048c0ecf44d93d3f397cfa470d4f`, compared with `a8d3d3ed99f9ee046141180fc1924d1e29597415`.
Environment: node 24.22.1, chrome 156.0.8078.48.

## Acceptance criteria

| Criterion | Checks | Result |
| --- | --- | --- |
| 0012-W1-AC01 | T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T11, T12, T13, T14, T15, T16, T17, T18, T22, T23, T24, T25, T26, T31, T32, T33, T34, T35 and unit tests | PASS |
| 0012-W1-AC02 | T28, T29, T30, T36, T37, T38, T39, T40, T41, T42, T44, T47 and unit tests | PASS |
| 0012-W1-AC03 | T19, T20, T21, T27, T43, T45, T46, T48, T49, T50 and unit tests | PASS |

## Checks

| Check | Result | Counts |
| --- | --- | --- |
| Candidate dependency install | PASS |  |
| Type checking | PASS |  |
| Focused unit tests | PASS | 173 tests; 173 passed, 0 failed |
| Application build | PASS |  |
| Fixture build | PASS |  |
| Full unit tests | PASS | 641 tests; 641 passed, 0 failed |
| Baseline dependency install | PASS |  |
| Baseline application build | PASS |  |
| Baseline full unit tests | PASS | 598 tests; 598 passed, 0 failed |
| Public content boundary | PASS |  |
| Public content boundary | PASS |  |
| Image behavior | PASS | 50 checks; 50 passed, 0 failed |
| Image negative control | PASS | 50 checks; 2 passed, 48 failed; expected failures; final check reached |
| Baseline behavior capture | PASS | 109 checkpoints |
| Baseline behavior capture | PASS | 109 checkpoints |
| Baseline behavior capture | PASS | 109 checkpoints |
| Baseline behavior capture | PASS | 109 checkpoints |
| Candidate behavior capture | PASS | 109 checkpoints |
| Candidate behavior capture | PASS | 109 checkpoints |
| Repeated baseline comparison | PASS | 109 checkpoints; 0 markup, 0 focus, 0 canvas differences; 6/6 saved records equal |
| Unmasked candidate comparison | PASS | 109 checkpoints; 109 markup, 0 focus, 0 canvas differences; 0/6 saved records equal; expected differences |
| Normalize baseline behavior | PASS | 2 permitted masks; 0 saved versions, 0 buttons, 0 file inputs |
| Normalize baseline behavior | PASS | 2 permitted masks; 0 saved versions, 0 buttons, 0 file inputs |
| Normalize candidate behavior | PASS | 2 permitted masks; 6 saved versions, 109 buttons, 0 file inputs |
| Normalize candidate behavior | PASS | 2 permitted masks; 6 saved versions, 109 buttons, 0 file inputs |
| Normalized candidate comparison | PASS | 109 checkpoints; 0 markup, 0 focus, 0 canvas differences; 6/6 saved records equal |
| Connector styles | PASS | 70 checks; 70 passed, 0 failed |
| Connectors | PASS | 75 checks; 75 passed, 0 failed |
| Strokes | PASS | 59 checks; 59 passed, 0 failed |
| Shapes | PASS | 67 checks; 67 passed, 0 failed |
| Sections | PASS | 42 checks; 42 passed, 0 failed |
| Text formatting | PASS | 33 checks; 33 passed, 0 failed |
| Object controls | PASS | 21 checks; 21 passed, 0 failed |
| Board files | PASS | 54 checks; 54 passed, 0 failed |
| Templates | PASS | 25 checks; 25 passed, 0 failed |
| Fixture index page | PASS | 8 passed, 0 failed |
| Fixture regression page | PASS | 8 passed, 0 failed |
| Revision identities | PASS |  |
| Browser check tool changes | PASS |  |
| Candidate changed files | PASS |  |
| Application composition size | PASS | 262 lines |
| Page content policy | PASS |  |
| Normalization mask verification | PASS | 2 permitted masks; image-bearing record preserved |
| Scenario T | see notes | 50 of 50 lines |
| Scenario S | see notes | 70 of 70 lines |
| Scenario O | see notes | 75 of 75 lines |
| Scenario R | see notes | 59 of 59 lines |
| Scenario N | PASS | 67 of 67 lines |
| Scenario M | PASS | 42 of 42 lines |
| Scenario K | PASS | 33 of 33 lines |
| Scenario L | PASS | 21 of 21 lines |
| Scenario P | see notes | 54 of 54 lines |
| Scenario Q | see notes | 25 of 25 lines |

Negative control: on the baseline build, 48 of 50 criterion checks failed or were not reached, as expected; these passed there too: T12, T50.

## Not run

- Safari three-item sample: reserved for the maintainer before merge.

Raw output fingerprint (SHA-256): `127a91ad24485fa81780295ba71d370b19c0c6febd495e08b5ed54ab318ad31d`.
