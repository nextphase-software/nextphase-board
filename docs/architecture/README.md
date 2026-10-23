# Architecture contracts

Current accepted implementation contract set for 0001-W1 brief v6:

- [0001 document v1](0001-document-v1.md): identities, schema and limits.
- [0001 storage v1](0001-storage-v1.md): save ordering, writer ownership and recovery.
- [0001 interaction v4](0001-interaction-v4.md): full canvas, floating controls,
  native overlay/secondary-panel editing, placement, focus and browser evidence.
- [0001 toolchain v1](0001-toolchain-v1.md): exact pins, generated lock, notices,
  public-input verification and application commands.

[0001 interaction v5](0001-interaction-v5.md), accepted with 0001-W2, adds undo,
redo, duplicate and delete with session-only history and scene-scoped shortcuts,
and includes the 0001-W3 presentation. It replaces v4 for later work.

Draft for 0001-W4 brief v1: [0001 interaction v6](0001-interaction-v6.md) makes new
stickies square and lets notes grow taller to fit their text. It replaces v5 for
later work once accepted.

Document/storage/toolchain v1 are incorporated unchanged. Interaction v4 keeps
v3's functional behavior and records the explicit native OS IME deferral. Brief v6 supersedes prior broad verification prescriptions
with minimal change-scoped checks; broader testing needs explicit instruction.
Interaction v1/v2 remain historical for briefs
v2/v3 respectively; they do not override the current verification boundary.

Application implementation is authorized on its milestone branch. A dependency
smoke check does not establish application behavior or milestone acceptance; see
the brief implementation record for checks actually run.

Document the current system, supported interfaces, data formats, security
boundaries, configuration and build inputs here when an implementation needs
them. State behavior and constraints concretely, with public sources and dated
versions. Commit prerequisite contracts with or before their implementation brief.
Contributors must be able to build and verify the software from public material.
