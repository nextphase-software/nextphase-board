# Engineering and interaction standards

These are contributor guardrails, not a claim that the scaffold implements them.

- Make board content editable through keyboard-accessible controls and provide
  a usable alternative to pointer-only canvas interactions.
- Specify document identity, stable object identifiers, schema versions and
  migration behavior before persistence work.
- Make save, reconnect, conflict and failure states understandable. Never report
  an unsaved or partially completed action as successful.
- Define authorization for each board, asset, export and shared link when those
  surfaces are introduced. Test denied access as well as successful access.
- Demonstrations, fixtures and proof captures use synthetic content only.
- Keep external integrations optional. Specify permissions, user confirmation,
  retries, duplicate delivery, revocation and failure behavior in their briefs.
- Record measurable responsiveness and document-size targets before performance
  claims. Prove collaboration and recovery behavior with appropriate tests.
- Commit the editable source and documented inputs for shipped generated assets.
  Track third-party provenance, exact versions and licensing.

The [0001 contracts](docs/architecture/README.md) define the first browser-local
increment. Document/storage/toolchain v1 were accepted on 2026-10-22. Interaction
v4 and the matching 0001-W1 brief v5 were accepted for implementation on 2026-10-22.
The development build follows their public layout/input/focus reference. Milestone
acceptance requires the recorded browser/evidence matrix and independent review.
Deployment configuration and later team architecture are outside this increment.
