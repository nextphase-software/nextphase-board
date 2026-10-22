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

The 0001 contracts in [docs/architecture/](docs/architecture/README.md) were
accepted on 2026-10-22 for the first browser-local increment. They define its
interaction, document, storage and dependency choices. Hosting and later team
architecture remain unselected. Application implementation requires a separate
maintainer handoff.
