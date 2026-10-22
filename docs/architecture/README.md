# Architecture contracts

Current accepted implementation contract set for 0001-W1 brief v3:

- [0001 document v1](0001-document-v1.md): identities, schema and limits.
- [0001 storage v1](0001-storage-v1.md): save ordering, writer ownership and recovery.
- [0001 interaction v2](0001-interaction-v2.md): full canvas, floating controls,
  native overlay/secondary-panel editing, placement, focus and browser evidence.
- [0001 toolchain v1](0001-toolchain-v1.md): exact pins, generated lock, notices,
  public-input verification and application commands.

Document/storage/toolchain v1 are incorporated unchanged from the packet accepted
on 2026-10-22. Interaction v2 was accepted for implementation on 2026-10-22 and replaces
[interaction v1](0001-interaction-v1.md) for brief v3. V1 remains
the historical accepted interaction contract for brief v2; it is not an alternative
layout for a v3 implementation. The dependency, format and storage contracts are unchanged.

Application implementation is authorized on its milestone branch. A dependency
smoke check does not establish application behavior or milestone acceptance; see
the brief implementation record for checks actually run.

Document the current system, supported interfaces, data formats, security
boundaries, configuration and build inputs here when an implementation needs
them. State behavior and constraints concretely, with public sources and dated
versions. Commit prerequisite contracts with or before their implementation brief.
Contributors must be able to build and verify the software from public material.
