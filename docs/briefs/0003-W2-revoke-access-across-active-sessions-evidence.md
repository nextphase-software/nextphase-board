# 0003-W2 — evidence summary

Brief: [0003-W2-revoke-access-across-active-sessions.md](0003-W2-revoke-access-across-active-sessions.md). Reviewed commit `e98dc39d5e413ccd6d7e3bc9abd430d33cf8438b`, validated source `cbfbd60dafe216253fd06be1426ea5c5df4143b0`, compared with `7f6140fc96a28e540ec626e085e3d9ae1b18b187`.
Environment: node 26.13.0, docker 29.5.2, docker_client 29.9.2, npm 11.20.0.

## Acceptance criteria

| Criterion | Checks | Result |
| --- | --- | --- |
| 0003-W2-AC01 | S77, S78, S79, S80, S82, S83, S86, S87, S90, S93 | PASS |
| 0003-W2-AC02 | S81, S84, S85, S86, S87, S88, S89, S91, S92 | PASS |
| 0003-W2-AC03 | S80, S82, S93; hosted timing at 10 and 50 boards | PASS |

## Checks

| Check | Result | Counts |
| --- | --- | --- |
| Runtime versions | PASS | exit 0 |
| Clean dependency installation | PASS | exit 0 |
| Local signing key creation | PASS | exit 0 |
| Candidate data service startup | PASS | exit 0 |
| Candidate connection information | PASS | exit 0 |
| Candidate data service status | PASS | exit 0 |
| Workspace type checks | PASS | exit 0 |
| Full unit suite | PASS | 678 passed, 0 failed |
| Web application build | PASS | exit 0 |
| Web fixture build | PASS | exit 0 |
| Server bundles and notices | PASS | exit 0 |
| License notice audit | PASS | exit 0 |
| Deployment rehearsal without upload | PASS | exit 0 |
| First server runtime suite | PASS | 89 passed, 0 failed |
| Second server runtime suite | PASS | 86 passed, 0 failed, 1 skipped |
| Container server suite | PASS | 4 passed, 0 failed, 39 skipped |
| Candidate data service shutdown | PASS | exit 0 |
| Baseline dependency installation | PASS | exit 0 |
| Baseline web application build | PASS | exit 0 |
| Baseline web fixture build | PASS | exit 0 |
| Initial dependency path listing | FAIL | initial listing failed; corrected listing and byte comparison passed |
| Validated changed paths | PASS | exit 0 |
| Candidate record changed paths | PASS | exit 0 |
| Baseline signing key creation | PASS | exit 0 |
| Baseline data service startup | PASS | exit 0 |
| Baseline initial connection information | PASS | exit 0 |
| Baseline test overlay | PASS | exit 0 |
| Baseline refreshed connection information | PASS | exit 0 |
| First baseline server negative control | PASS | 17 new checks failed as expected; 72 existing checks passed; 1 unhandled error |
| Second baseline server negative control | PASS | 17 new checks failed as expected; 69 existing checks passed; 1 skipped; 1 unhandled error |
| Baseline unit negative control | PASS | 0 passed, 1 failed file; expected missing baseline module |
| Baseline data service shutdown | PASS | exit 0 |
| Baseline checkout restoration | PASS | exit 0 |
| Validated publication boundary | PASS | exit 0 |
| Candidate publication boundary | PASS | exit 0 |
| Changed file inventory | PASS | exit 0 |
| Dependency file comparison | PASS | exit 0 |
| Validation 1 | PASS | manifest and lock bytes and manifest paths match |
| Validation 2 | PASS | clean install exited zero |
| Validation 3 | PASS | five workspace members typechecked |
| Validation 4 | PASS | 678 unit tests passed; zero failed; only new root test is removal |
| Validation 5 | PASS | both web builds passed; four artifact hashes match |
| Validation 6 | PASS | both server bundles and notices exist; license audit passed |
| Validation 7 | PASS | dry run exited zero; nothing uploaded |
| Validation 8 | PASS | 89/89 scenario checks passed; all summaries zero failures |
| Validation 9 | PASS | 86/86 scenario checks passed; all summaries zero failures |
| Validation 10 | PASS | 4/4 scenario checks passed; all summaries zero failures |
| Validation 11 | PASS | 30 validated paths within items 1 to 5; candidate adds only brief |
| Validation 12 | PASS | both baseline runners and new unit tests fail; no S77 to S93 passes |
| Web artifact equality | PASS | 4 matching files |
| Dependency manifest path equality | PASS | 6 manifests in each tree |
| Local resource cleanup | PASS | all created resources removed |
| Clone commit identities | PASS | 3 matching revisions |
| Baseline manifest listing | PASS | 6 manifests |
| Candidate manifest listing | PASS | 6 manifests |
| Repository preservation | PASS | all preservation checks passed |
| Scenario V | see notes | 12 of 12 lines |
| Scenario S | see notes | 89 of 89 lines |
| Scenario S | see notes | 86 of 86 lines |
| Scenario S | see notes | 4 of 4 lines |

Negative control: on the baseline build, 17 of 17 criterion checks failed or were not reached, as expected.

## Not run

- Browsers: this milestone changes no screens.

## Hosted timing (after review)

A temporary hosted Worker built from the reviewed commit, with a development data service in the
same region, on 31 October 2026. The editor had a connection open on every board of the workspace;
the owner removed their workspace role with one request. Times are measured from that request.

| Boards | Runs | Owner's reply | Close code | First close | Last close |
| --- | --- | --- | --- | --- | --- |
| 10 | 2 | 0.77–0.87 s, removal done | 4403 on every board | 0.33–0.43 s | 0.78–0.91 s |
| 50 | 4 | 2.1–3.8 s, removal done | 4403 on every board | 0.36–0.39 s | 2.1–3.8 s |

Rooms are told at most 10 at a time, so 50 boards close in five waves; no wave spanned more than
0.46 s. Each board's connections closed well inside 2 seconds of its own room step, the target
the access contract sets. Measured from the owner's request, the last boards of a 50-board
workspace closed after 2 seconds.

A removal written directly to the data service, with no request to the Worker, was delivered by
the scheduled retry about 10.6 minutes after the deployment, inside the time the platform allows a
new schedule to take effect: all three connections closed with 4403 and every delivery was
recorded. The temporary Worker, test accounts and data were removed afterwards.

Raw output fingerprint (SHA-256): `550911ea55d764aa1e0ecfc005e018ab69ebd3ce1d567be32c88ef77e641ac3b`.
