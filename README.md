# NextPhase Board

A collaborative visual workspace for teams.

Board is built in the open, one reviewed milestone at a time. It is an early development
build, not a finished product.

## What it does today

**Editing.** Sticky notes, text, shapes, sections, connectors, drawing with a marker,
highlighter and eraser, pasted or imported images, and ready-made templates. Objects can
be formatted, resized, aligned, grouped, copied and pasted, with undo and redo. You can
save a board to a file and open it again.

**Working as a team.** In team mode people sign in with a one-time email code, share a
workspace or a single board as owner, editor or viewer, and edit the same board at the same
time. They see who is on the board and where their cursors are, can follow a person or ask
everyone to follow them (spotlight), and can discuss ideas in comments that mention people.
Boards keep a version history and a Trash, and a shared timer and voting help run a
workshop.

The [briefs](docs/briefs/README.md) describe what each milestone added.

## Two ways to run it

| | Local single-user mode | Team mode |
| --- | --- | --- |
| What runs | The web app only | The web app, the Board server and Supabase (sign-in and database) |
| Where boards are saved | In your browser on this device | On the Board server and in Supabase |
| Accounts and sharing | None | Sign-in, workspaces, roles, sharing |
| What you need | Node and a browser | Node, a browser and Docker Desktop |

## Try the preview

**<https://board-preview.nextphase.software>**

The preview serves the local single-user build: there is no sign-in, and your boards stay
in your browser on that device. Board's link preview service reads links you paste to fetch each
page's title, description and picture. Only the link is sent. Save a copy to a file if you want
to keep one. The preview is updated as milestones are reviewed and merged, so features
appear and change over time. Desktop Chrome and Safari are the browsers checked so far.
Team features are not on the preview yet; run team mode on your own computer to try them.

## Run locally

Use **Node 26.13.0 and npm 11.20.0**, as specified in the
[toolchain contract](docs/architecture/0001-toolchain-v5.md).

**Local single-user mode.** From the repository root:

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm run build
npm --prefix apps/web run serve
```

Open <http://127.0.0.1:4173> in Chrome or Safari.

**Team mode on your Mac.** Install and start Docker Desktop once, then run:

```sh
npm run team:start
```

It starts a local Supabase stack, the Board server and the team build of the app, with
three test people: Ana the owner, Ben an editor and Mia a viewer. `npm run team:code ana`
prints a sign-in code, so no email is needed. `npm run team:stop` stops everything.

[Try and test NextPhase Board](docs/guides/try-board.md) walks through both modes and every
feature, with what you should see.

To host the server yourself, follow the [server setup](apps/server/README.md) and the
[self-host runner contract](docs/architecture/0003-self-host-runner-v7.md).

Use synthetic or disposable content in this development build.

## Verify and contribute

Read [CONTRIBUTING.md](CONTRIBUTING.md), [DESIGN.md](DESIGN.md), and
[AGENTS.md](AGENTS.md). [Tests and manual procedures](tests/README.md) document
commands and remaining acceptance checks. Implementation uses versioned,
self-contained [briefs](docs/briefs/README.md) and separate milestone branches.
All source and build inputs come from this repository and documented public dependencies.

## License

Licensed under the [Apache License, Version 2.0](LICENSE). See [NOTICE](NOTICE)
for attribution.
