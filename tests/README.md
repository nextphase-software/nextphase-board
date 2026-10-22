# Validation policy and available checks

## Default: minimal testing for the current change

Test only the behavior directly affected by the current change, using the smallest
check that demonstrates it works. For a bug fix, add or run a focused regression
when useful. For documentation-only changes, inspect the diff and links; do not
run application tests or builds. Do not automatically run full suites, browser
matrices, performance/load tests, accessibility audits, native IME checks, unrelated
edge cases, or repeated acceptance sweeps. Broader testing requires an explicit
maintainer instruction. Existing checklists describe available coverage and do
not authorize executing it. State what ran and what did not; never report an
unrun check as passed. If a change reveals a concern outside its scope, report it
without expanding the test campaign or implementation. Mandatory Git/privacy hooks
still run normally; never bypass them.

## Reference commands and coverage

The commands and matrix below are a catalog, not a default execution checklist.
Run a broader set only when explicitly requested. Use the exact Node/npm versions
in the toolchain contract. From the repository root:

```sh
npm --prefix apps/web ci --ignore-scripts --no-audit --no-fund
npm --prefix apps/web run check:deps
npm --prefix apps/web run typecheck
npm --prefix apps/web test
npm --prefix apps/web run audit:licenses
npm --prefix apps/web run build
npm --prefix apps/web run build:fixtures
```

The unit suite covers document identity, canonical Unicode serialization,
malformed/unsupported input, geometry and content boundaries, and envelope/pair
validation. License audit verifies the unchanged accepted lock and complete
runtime notices; each build checks every bundled dependency against the accepted
inventory and distributes the complete notice file. The fixture bundle is
separate from the normal application.

In two terminals:

```sh
npm --prefix apps/web run serve
npm --prefix apps/web run serve:fixtures
```

Open <http://127.0.0.1:4174> in each supported browser. Expect eight PASS lines:
immutable capture/FIFO receipts, actual transaction abort with preserved records
and retry, complete-pair compare-and-swap rejection with writer invalidation,
fresh-connection recovery, same-counter payload conflicts, delayed preparation,
injected quota/unavailable failures and interrupted-writer preservation. A FAIL line is a failed check. The abort is
deliberately triggered in a real IndexedDB transaction; it is not evidence of
native quota exhaustion. The fixture uses a uniquely named disposable database
and never writes the application database. Never use production content in
fixtures.

At <http://127.0.0.1:4174/regressions.html>, expect eight PASS lines for the
single-editor, placement-cancellation, unavailable-writer recovery, object/title
composition, older-save/newer-draft lifecycle, narrow-editor focus and damaged-head
recovery checks. Run in a clean profile when an extension suppresses lifecycle
events; the fixture explicitly detects suppressed synthetic pagehide dispatch.
They mount the production App, redirect its default IndexedDB name to a unique
disposable database, and verify real stored bytes. Input events are synthetic;
pointer capture is stubbed only for synthetic pointers. These integration tests
do not establish trusted pointer, keyboard or page-zoom evidence. Native OS IME is a deferred manual follow-up,
not established by these synthetic composition events. Test
code is built only by build:fixtures and never enters the application bundle.

When explicitly requested, the manual coverage catalog at
<http://127.0.0.1:4173> maps to the existing criteria:

| Criterion    | Manual procedure                                                                                                                                                                                                                                                                                                                                                              |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0001-W1-AC01 | Name a new board; create each type via palette pointer/Enter and native Add; enter multiline Unicode; edit through both routes; move by pointer and directional controls; cancel a gesture; verify navigation leaves geometry unchanged. Check Unicode editing and automated composition commit/cancel; native OS IME is deferred.                                                                                |
| 0001-W1-AC02 | Save, edit a newer draft during an earlier save, reopen and reload; verify saved content and statuses. Open another tab, verify read-only controls, close the writer and explicitly retry. Exercise lifecycle interruption and the fixture negative controls.                                                                                                                 |
| 0001-W1-AC03 | Tab through selector/read/edit/move/save/reopen; inspect visible focus and surface-close focus return. Retain a 1,001-code-point draft, switch objects, and correct it before Save. Check clipped-editor fallback, narrow/short viewports and actual 200% browser page zoom. Unknown stored formats are decoder negatives; full app recovery journeys need separate evidence. |

Record exact installed Chrome and Safari builds, OS, hardware, viewport,
source/test revision and results. Browser-family coverage, native OS IME and
performance cannot be inferred from unit or fixture passes. The brief specifies
the 250-object responsiveness smoke journey and exclusions. Leave unavailable checks
UNVERIFIED. Unexecuted catalog entries do not authorize extra testing or become
automatic blockers; report the bounded evidence and any actual defect for review. No test requires Firefox or
screen-reader-specific validation.

For the disposable 250-object smoke journey, open
<http://127.0.0.1:4174/regressions.html?workload=w1-smoke>. The query key names
a disposable fixture database, retained for reload. Edit/move/pan/zoom/save and
reload; Inspect saved fixture reads its persisted contents. Close this workload
tab before the regression fixture so its writer lock cannot block the tests.
Diagnostic mount-to-load time is not input-to-paint or a performance guarantee.
