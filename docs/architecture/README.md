# Architecture contracts

The following prerequisites for 0001-W1 v2 were accepted on 2026-10-22:

- [0001 document v1](0001-document-v1.md): identities, schema and limits.
- [0001 storage v1](0001-storage-v1.md): save ordering, writer ownership and recovery.
- [0001 interaction v1](0001-interaction-v1.md): pointer, keyboard and text behavior.
- [0001 toolchain v1](0001-toolchain-v1.md): exact pins, generated lock, notices,
  public-input verification and future application commands.

These contracts select the browser-local stack and behavior for this increment.
Application implementation requires committed prerequisites and a separate
maintainer handoff. A dependency smoke check does not establish application
behavior or milestone acceptance.

Document the current system, supported interfaces, data formats, security
boundaries, configuration and build inputs here when an implementation needs
them. State behavior and constraints concretely, with public sources and dated
versions. Commit prerequisite contracts with or before their implementation brief.
Contributors must be able to build and verify the software from public material.
