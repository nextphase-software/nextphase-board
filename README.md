# NextPhase Board

A collaborative visual workspace for teams.

The first development build implements [0001-W1 v6](docs/briefs/0001-W1-capture-and-reopen-a-board.md):
one browser-local board with sticky notes, plain text, pointer and keyboard editing,
movement, pan/zoom and explicit save/reopen. Full milestone acceptance and independent
implementation review are pending. This increment requires no hosting provider,
account system or server storage.

## Run locally

Use **Node 24.22.1 and npm 11.19.1**, as specified in the
[toolchain contract](docs/architecture/0001-toolchain-v1.md). From the repository root:

```sh
npm --prefix apps/web ci --ignore-scripts --no-audit --no-fund
npm --prefix apps/web run build
npm --prefix apps/web run serve
```

Open <http://127.0.0.1:4173> in Chrome or Safari. Name the board through the upper-left
menu, place a Sticky or Text object, edit it and click Save. Objects provides native
selection, text editing, Add and movement controls. Keyboard Enter on the focused
canvas places an armed tool; Enter inside a text field inserts a newline.

Saving stores one board only in this origin and browser profile. Browser storage is
not a backup. A second tab is read-only until the writer closes and Retry editing
is selected. Use synthetic or disposable content in this development build.

## Verify and contribute

Read [CONTRIBUTING.md](CONTRIBUTING.md), [DESIGN.md](DESIGN.md), and
[AGENTS.md](AGENTS.md). [Tests and manual procedures](tests/README.md) document
commands and remaining acceptance checks. Implementation uses versioned,
self-contained [briefs](docs/briefs/README.md) and separate milestone branches.
All source and build inputs come from this repository and documented public dependencies.

## License

Licensed under the [Apache License, Version 2.0](LICENSE). See [NOTICE](NOTICE)
for attribution.
