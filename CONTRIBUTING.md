# Contributing

NextPhase Board is licensed under Apache-2.0. Contributions submitted for inclusion
are offered under that license unless explicitly stated otherwise. Preserve
applicable copyright and attribution notices.

The first development application uses the exact stack in the
[0001 toolchain v4 contract](docs/architecture/0001-toolchain-v4.md)
(Node 26.13.0 / npm 11.20.0). Use only the minimum
[focused checks](tests/README.md) needed for the changed behavior. Broader testing
requires an explicit maintainer instruction. Each implementation
brief identifies its prerequisites and numbered acceptance criteria. Do not add
dependencies or expand the scope without the governing contract.

Keep a change focused on one brief, use a separate branch/worktree, and explain
what changed, why, the evidence and any limitations. Use Conventional Commits.
An independent reviewer checks the exact source revision before merge.

Use synthetic boards and identities in examples and tests. Keep credentials and
real customer content out of commits, issue reports and logs. See [SECURITY.md](SECURITY.md)
for handling a security concern.

Public implementation requirements must be sufficient for a contributor to build,
run, verify and modify the software from this repository alone.
