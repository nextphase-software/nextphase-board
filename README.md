# NextPhase Board

A collaborative visual workspace for teams.

Board is built in the open, one reviewed milestone at a time. Today it has sticky notes,
text, shapes, sections, connectors, ready-made templates, and drawing with a marker,
highlighter and eraser. Boards are saved in your browser, and you can save a copy to a file
and open it again. There are no accounts and no server storage yet.

## Try the preview

**<https://board-preview.nextphase.software>**

This is an evolving preview, not a finished product. It is updated as each milestone is
reviewed and merged, so new features appear over time and existing ones may change. Your
boards stay in your browser on this device and are not sent anywhere; use Save a copy to
file if you want to keep one. Desktop Chrome and Safari are the browsers checked so far. The
[briefs](docs/briefs/README.md) describe what each milestone added.

## Run locally

Use **Node 26.13.0 and npm 11.20.0**, as specified in the
[toolchain contract](docs/architecture/0001-toolchain-v2.md). From the repository root:

```sh
npm --prefix apps/web ci --ignore-scripts --no-audit --no-fund
npm --prefix apps/web run build
npm --prefix apps/web run serve
```

Open <http://127.0.0.1:4173> in Chrome or Safari. Name the board through the upper-left
menu, place a Sticky or Text object, edit it and click Save. Objects provides native
selection, text editing, Add and movement controls. Keyboard Enter on the focused
canvas places an armed tool; Enter inside a text field inserts a newline.

Saving stores boards only in this origin and browser profile. Browser storage is
not a backup. A second tab on the same board is read-only until the writer closes and
Retry editing is selected. Use synthetic or disposable content in this development build.

To check that your setup works and try each feature, follow
[Try and test NextPhase Board](docs/guides/try-board.md).

## Verify and contribute

Read [CONTRIBUTING.md](CONTRIBUTING.md), [DESIGN.md](DESIGN.md), and
[AGENTS.md](AGENTS.md). [Tests and manual procedures](tests/README.md) document
commands and remaining acceptance checks. Implementation uses versioned,
self-contained [briefs](docs/briefs/README.md) and separate milestone branches.
All source and build inputs come from this repository and documented public dependencies.

## License

Licensed under the [Apache License, Version 2.0](LICENSE). See [NOTICE](NOTICE)
for attribution.
