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

Run the commands documented for the changed surface. The application validation
commands and browser procedures are in tests/README.md and the governing brief.
Do not report unrun checks as passed. UI changes need responsive,
keyboard and accessibility checks; persistence and collaboration changes need
data-loss, authorization and reconnect evidence where applicable.

Append the brief's implementation record with the branch, validated source/test
revision, commands, results, exclusions and added dependencies. Report the final
branch tip separately. A different session reviews the exact commit. An
implementation handoff does not authorize a merge or another milestone.

After any code, configuration, documentation or test change, include one concise
Conventional Commits recommendation near the end of the final response:

`Recommended commit message: type(scope): imperative summary`
