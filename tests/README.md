# 0001-W1 validation

Use the exact Node/npm versions in the toolchain contract. From the repository
root:

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

Open <http://127.0.0.1:4174> in each supported browser. Expect four PASS lines:
immutable capture/FIFO receipts, actual transaction abort with preserved records
and retry, complete-pair compare-and-swap rejection with writer invalidation,
and fresh-connection recovery. A FAIL line is a failed check. The abort is
deliberately triggered in a real IndexedDB transaction; it is not evidence of
native quota exhaustion. The fixture uses a uniquely named disposable database
and never writes the application database. Never use production content in
fixtures.

At <http://127.0.0.1:4174/regressions.html>, expect three PASS lines for the
single-editor, placement-cancellation and unavailable-writer recovery regressions.
They mount the production App, redirect its default IndexedDB name to a unique
disposable database, and verify real stored bytes. Input events are synthetic;
pointer capture is stubbed only for synthetic pointers. These integration tests
do not replace trusted pointer, keyboard, native IME or page-zoom checks. Test
code is built only by build:fixtures and never enters the application bundle.

At <http://127.0.0.1:4173>, verify the following against the brief's existing
criteria:

| Criterion    | Manual procedure                                                                                                                                                                                                                                                                                                                                                              |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0001-W1-AC01 | Name a new board; create each type via palette pointer/Enter and native Add; enter multiline Unicode; edit through both routes; move by pointer and directional controls; cancel a gesture; verify navigation leaves geometry unchanged. Check native CJK commit/cancel separately from paste.                                                                                |
| 0001-W1-AC02 | Save, edit a newer draft during an earlier save, reopen and reload; verify saved content and statuses. Open another tab, verify read-only controls, close the writer and explicitly retry. Exercise lifecycle interruption and the fixture negative controls.                                                                                                                 |
| 0001-W1-AC03 | Tab through selector/read/edit/move/save/reopen; inspect visible focus and surface-close focus return. Retain a 1,001-code-point draft, switch objects, and correct it before Save. Check clipped-editor fallback, narrow/short viewports and actual 200% browser page zoom. Unknown stored formats are decoder negatives; full app recovery journeys need separate evidence. |

Record exact installed Chrome and Safari builds, OS, hardware, viewport,
source/test revision and results. Browser-family coverage, native IME and
performance cannot be inferred from unit or fixture passes. The brief specifies
the 250-object responsiveness smoke journey and exclusions. Leave unavailable checks
UNVERIFIED; do not mark the milestone accepted until its required evidence and
independent review are complete. No test requires Firefox or
screen-reader-specific validation.
