# NextPhase Board agent instructions

Read README.md, CONTRIBUTING.md and DESIGN.md before working here.

## Scope and implementation

- Implement one current, versioned brief from docs/briefs/. Requirements must be
  complete in that brief and its committed public prerequisites. Report missing
  requirements before implementing dependent work.
- Bootstrap documentation and repository tooling may be prepared without an
  implementation brief. Until the maintainer's first commit, leave the scaffold
  uncommitted. Do not start an application milestone before that commit exists.
- After bootstrap, work on one branch and worktree per milestone from committed
  main: `<agent>/<ID>-<slug>` in `.worktrees/<agent>-<ID>`. Preserve unrelated work.
  Commit only on that branch using Conventional Commits. The maintainer owns main,
  merges and publication. Never use git stash or bypass Git hooks.
- Read files before editing them. Use codebase-memory-mcp graph tools first for
  code discovery. If this repository is unindexed, index it before code exploration.
- Do not introduce frameworks, services or dependencies without the governing
  brief and committed architecture contracts. Record exact dependency versions
  and licenses. New source files use `SPDX-License-Identifier: Apache-2.0` where
  their format supports comments.
- Use public source and contributor-facing requirements. Do not include non-public
  information, credentials, local machine paths, or real customer data in files,
  fixtures, logs, commit messages or pull requests.

## Evidence and review

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

Append the brief's implementation record with the branch, validated source/test
revision, commands, results, exclusions and added dependencies. Report the final
branch tip separately. A different session reviews the exact commit. An
implementation handoff does not authorize a merge or another milestone.

After any code, configuration, documentation or test change, include one concise
Conventional Commits recommendation near the end of the final response:

`Recommended commit message: type(scope): imperative summary`
