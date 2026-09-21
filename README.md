# Cherry Works

The charter engine: resolves a charter and compiles it into what a coding agent reads.

## Install `cw` from this checkout

The `cw` binary points at `dist/main.js`, so the build has to run before the link:

```bash
pnpm install
pnpm build
pnpm link --global
```

`pnpm link --global` symlinks `cw` into pnpm's global bin directory, which is already on `PATH`. Verify it:

```bash
which cw   # ~/Library/pnpm/cw on macOS
cw --help
```

The link points back at this working copy rather than a copy of it, so run `pnpm build` again after changing any source file for the global `cw` to pick the change up.

To remove it:

```bash
pnpm uninstall --global cherry-works
```

## Run `cw` without installing

From inside this repository, `pnpm cw <command>` runs the CLI straight from the TypeScript sources through `tsx`, with no build step.

## Run the tests

```bash
pnpm exec playwright install chromium   # once per machine
pnpm test
```

The portal's page is tested in a real browser, so `pnpm test` builds first and
opens what the build wrote in headless Chromium. Chromium is downloaded once and
kept outside this repository.
