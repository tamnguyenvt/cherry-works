A script or test fixture that prints for its reader uses `console.info`, never `console.log`: `console.log` is read as debug output left behind.

**Why:** On 2026-11-03, while finishing SDK Story 4, `sdd-clean` flagged 11 `console.log` lines in `scripts/release.ts` and `test/a-release.ts` as debug. Every one was meant output: the release's messages to the maintainer, and the stdout of the fake `npm` and `git`. The agent asked the user to accept them as findings. The user said to write them with `console.info` instead, since `console.log` counts as debugging.

**How to apply:**
- When code prints something on purpose, such as a script's report or a fake command's answer, write `console.info`. Keep `console.error` for errors.
- When `sdd-clean` flags a `console.log` that is meant output, change it to `console.info` rather than asking the user to accept it.
- Change only lines the change already touches; a `console.log` that was there before stays until that line is touched.
