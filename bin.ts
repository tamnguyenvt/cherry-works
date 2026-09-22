#!/usr/bin/env node
import packageJson from "./package.json" with { type: "json" };

/**
 * The `cw` command: the Node it is run on is checked before anything else is
 * loaded (FR-128).
 *
 * The check cannot be the first line of `main.ts`. An ES module's imports load
 * before any of its code runs, so on an old Node a dependency would fail first,
 * with an error naming neither `cw` nor a version. This file imports nothing
 * but the version it needs, and is built for old syntax, so it gets to say so.
 *
 * The version needed is the one `engines` declares, so the two cannot differ.
 * `main.js` is named by a variable so the bundler leaves it to be loaded after
 * the check rather than inlining it here.
 */
const neededMajor = Number(/\d+/.exec(packageJson.engines.node)?.[0]);
const runningMajor = Number(process.versions.node.split(".")[0]);

if (runningMajor < neededMajor) {
  process.stderr.write(
    `cw needs Node.js ${neededMajor} or later, and this is Node.js ${process.versions.node}.\n` +
      `Install Node.js ${neededMajor} or later, then run cw again.\n`,
  );
  process.exitCode = 1;
} else {
  const commandEntry = "./main.js";
  void import(commandEntry);
}
