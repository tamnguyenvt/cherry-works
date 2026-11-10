# Cherry Works

This folder holds the charter that governs the coding agents working in this repository, kept by [Cherry Works](https://github.com/tamnguyenvt/cherry-works). It was set up with `cw` 0.9.0.

- `charter/` — the charter: `primitive/` for what this repository authors, one folder per kind; `test/` and `eval/` for its tests and eval cases; `vendor/` for charters and skills installed with `cw vendor add`, read-only.
- `out/` — what `cw build` compiles the charter to; never edit it.
- `settings.json` — what this repository was set up with.

## Author it

- Ask your agent to run the `/cw-author` skill: it asks what a primitive needs and writes it.
- Or run `cw portal` and author it in the browser.

Then run `cw build` to lay the charter out for every agent.
