# 0005-W1 — evidence summary

Brief: [0005-W1-discuss-and-resolve-anchored-ideas.md](0005-W1-discuss-and-resolve-anchored-ideas.md). Reviewed commit `8d772ce019ebe6db31a14a8cd207ef3443f7ddb9`, validated source `f3cd847a0ebe6f25c0dcb35f3bb6d61800e260b5`, compared with `86fd7ab41d5a9ec1c243460374b13752362d1f1c`.
Environment: node v26.13.0, npm 11.20.0, chrome 156.0.8078.76, os macOS arm64, services local only, ports [4183, 4184, 4185, 8796].

## Acceptance criteria

| Criterion | Checks | Result |
| --- | --- | --- |
| 0005-W1-AC01 | C1-S1, C1-S2, C1-S3, C1-S4, C1-S7, C1-S8, C1-S9, C1-S14, C1-S16, C1-S17, C1-S19, C1-S20, S121, S122, S123, S126, S127, S129, S131, S132, S133 | PASS (see note) |
| 0005-W1-AC02 | C1-S5, C1-S6, C1-S7, C1-S16, S128 | PASS (see note) |
| 0005-W1-AC03 | C1-S10, C1-S11, C1-S12, C1-S13, C1-S15, C1-S21, C1-S22, C1-S23, S124, S125, S126, S130, V13 | PASS |

Note on 0005-W1-AC01: the look check C1-S19 compared about 6,700 computed values with the interaction contract and printed 45 failures. Each was the comparison script's reading, not the page: 40 read the text wrapping property as missing, though the stylesheet sets it to pre-wrap on both comment text rules; 5 expected a menu button as wide as its menu, though the menu's 6-pixel padding makes each button 12 pixels narrower, exactly as the contract's styles give. The independent review judged this check and this criterion PASS (the "reviewer adjudication" row below). This row was corrected by hand; the generated text read "GAP".

Note on 0005-W1-AC02: C1-S5 first stopped on the scenario script's selection of the wrong Align control; it passed on its one repeat on a fresh local stack, with every assertion unchanged. The brief's "a nudge with an arrow key" was checked with the board's own nudge, the Objects panel's Move object button, because arrow keys have never moved objects on the canvas. This row was corrected by hand; the generated text read "GAP".

## Checks

| Check | Result | Counts |
| --- | --- | --- |
| Dependency manifests | PASS | 7 manifests and lock files unchanged |
| Clean install | PASS | clean install passed |
| Type checks | PASS | 5 workspaces passed |
| Unit checks | PASS | 863 passed, 0 failed; 3 allowed test paths |
| Feature off build | PASS | off build and audit passed; HTML and notices byte-identical; no forbidden inputs |
| Feature on build | PASS | fixtures, on build and audit passed; HTML and notices byte-identical |
| Server build | PASS | 3 checks passed |
| Changed file scope | FAIL | 28 scoped paths and 1 brief record; record awaits reviewer adjudication |
| Discussion checks | FAIL | on 20 passed, 2 failed; off 1 passed; isolated repeat 1 passed, 0 failed |
| Baseline controls | PASS | baseline rejects all 22 browser checks, 13 new server checks and 27 named unit tests |
| Server checks | PASS | Node 129 passed, 0 failed; workerd 126 passed, 0 failed |
| Existing board behavior | PASS | both comparisons identical at 109 checkpoints |
| Recovery checks | PASS | 21 passed, 0 failed; no repeats |
| Discussion behavior 1 | PASS | 1 passed, 0 failed |
| Discussion behavior 2 | PASS | 1 passed, 0 failed |
| Discussion behavior 3 | PASS | 1 passed, 0 failed |
| Discussion behavior 4 | PASS | 1 passed, 0 failed |
| Discussion behavior 5 | FAIL | 0 passed, 1 failed |
| Discussion behavior 6 | PASS | 1 passed, 0 failed |
| Discussion behavior 7 | PASS | 1 passed, 0 failed |
| Discussion behavior 8 | PASS | 1 passed, 0 failed |
| Discussion behavior 9 | PASS | 1 passed, 0 failed |
| Discussion behavior 10 | PASS | 1 passed, 0 failed |
| Discussion behavior 11 | PASS | 1 passed, 0 failed |
| Discussion behavior 12 | PASS | 1 passed, 0 failed |
| Discussion behavior 13 | PASS | 1 passed, 0 failed |
| Discussion behavior 14 | PASS | 1 passed, 0 failed |
| Discussion behavior 15 | PASS | 1 passed, 0 failed |
| Discussion behavior 16 | PASS | 1 passed, 0 failed |
| Discussion behavior 17 | PASS | 1 passed, 0 failed |
| Discussion behavior 18 | PASS | 1 passed, 0 failed |
| Discussion behavior 19 | FAIL | 0 passed, 1 failed |
| Discussion behavior 20 | PASS | 1 passed, 0 failed |
| Discussion behavior 21 | PASS | 1 passed, 0 failed |
| Discussion behavior 22 | PASS | 1 passed, 0 failed |
| Discussion behavior 23 | PASS | 1 passed, 0 failed |
| Repeated selection and movement | PASS | 1 passed, 0 failed |
| Design values | PASS | 253 passed, 0 failed |
| Design values | FAIL | 554 passed, 2 failed |
| Design values | FAIL | 895 passed, 6 failed |
| Design values | FAIL | 925 passed, 8 failed |
| Design values | FAIL | 872 passed, 6 failed |
| Design values | FAIL | 424 passed, 4 failed |
| Design values | FAIL | 874 passed, 6 failed |
| Design values | FAIL | 896 passed, 7 failed |
| Design values | FAIL | 856 passed, 6 failed |
| Design values | PASS | 151 passed, 0 failed |
| Clean dependency install | PASS | 1 passed, 0 failed |
| Type checks | PASS | 1 passed, 0 failed |
| Full unit suite | PASS | 863 passed, 0 failed |
| Feature off build | PASS | 1 passed, 0 failed |
| Feature off license check | PASS | 1 passed, 0 failed |
| Sample build | PASS | 1 passed, 0 failed |
| Feature on build | PASS | 1 passed, 0 failed |
| Feature on license check | PASS | 1 passed, 0 failed |
| Server build | PASS | 1 passed, 0 failed |
| Server license check | PASS | 1 passed, 0 failed |
| Worker package check | PASS | 1 passed, 0 failed |
| Validated change inventory | PASS | 1 passed, 0 failed |
| Candidate change inventory | PASS | 1 passed, 0 failed |
| Validated publication boundary | PASS | 1 passed, 0 failed |
| Candidate publication boundary | PASS | 1 passed, 0 failed |
| Execution environment | PASS | 1 passed, 0 failed |
| Selection event diagnosis | PASS | 1 passed, 0 failed |
| Discussion scenarios | FAIL | 20 passed, 2 failed |
| Feature off scenario | PASS | 1 passed, 0 failed |
| Style comparison diagnosis | PASS | 1 passed, 0 failed |
| Design comparisons | PASS | 1 passed, 0 failed |
| Repeated movement scenario | PASS | 1 passed, 0 failed |
| Implementation record changes | PASS | 1 passed, 0 failed |
| Dependency file inventory | PASS | 1 passed, 0 failed |
| Baseline discussion controls | PASS | 0 passed, 22 failed |
| Recovery scenarios | PASS | 21 passed, 0 failed |
| New server scenarios | PASS | 26 passed, 0 failed |
| Node server suite | PASS | 129 passed, 0 failed |
| Worker server suite | PASS | 126 passed, 0 failed |
| Validation scenarios | FAIL | 11 passed, 2 failed |
| Supporting evidence | PASS | recorded |
| Supporting evidence | PASS | recorded |
| Supporting evidence | PASS | recorded |
| Supporting evidence | PASS | recorded |
| Supporting evidence | PASS | recorded |
| Supporting evidence | PASS | recorded |
| Supporting evidence | PASS | recorded |
| Supporting evidence | PASS | recorded |
| Supporting evidence | PASS | recorded |
| Supporting evidence | PASS | recorded |
| Supporting evidence | PASS | recorded |
| Changed file inventory | PASS | recorded |
| Initial artifact verification | FAIL | 0 passed, 1 failed |
| Artifact verification | PASS | 5 checks passed |
| Initial table count | FAIL | 0 passed, 1 failed |
| Final artifact verification | PASS | checks passed |
| Changed-file check, reviewer adjudication | PASS | 28 allowed paths; the brief changes only in its implementation record |
| Look check, reviewer adjudication of the comparison tool's readings | PASS | 45 tool readings explained; every stated value correct |
| Scenario S | see notes | 26 of 26 lines |
| Scenario C1 | see notes | 20 of 22 lines |
| Scenario C1 | see notes | 1 of 1 lines |
| Scenario C1 | see notes | 1 of 1 lines |
| Scenario W2 | see notes | 21 of 21 lines |
| Scenario V | see notes | 13 of 13 lines |

Negative control: on the baseline build, 35 of 35 criterion checks failed or were not reached, as expected.

## Not run

- Safari and other browsers: outside this local Chrome run.
- Mobile browsers: outside the requested run.
- A physical keyboard and input methods: only page key events were requested.
- Screen readers: outside the requested run.
- A hosted deployment: local services only.
- A point-in-time restore: local logical restore checks only.
- An accessibility audit: outside the requested run.
- Load or latency measures: no separate measurement campaign was requested.
- A repeat of the design comparisons with the comparison script corrected: the review judged its 45 readings against the stylesheet instead (see the note on 0005-W1-AC01).

Raw output fingerprint (SHA-256): `ffd3895e2e9a55ddda7774d26214499003eb7606a257ccb324a6bbfc45ca992f`.
