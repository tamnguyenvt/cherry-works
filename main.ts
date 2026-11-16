#!/usr/bin/env node
import { homedir } from "node:os";
import { pathToFileURL } from "node:url";
import packageJson from "./package.json" with { type: "json" };
import { composeApplications } from "./src/module/composition.js";
import { StderrReporter } from "./src/module/shared/module.js";
import { Commander } from "./src/presentation/cli/cli.commander.js";

/**
 * COMPOSITION ROOT — where this command line is put together: the workspace
 * module, which keeps the repository's settings, and the engine composed of
 * the charter and runtime over the default adapters, set up on where it was
 * run, for the settings the workspace module answers (CORE-FR-231).
 */

/** Where this was run, as the adapters take a repository: a directory, so it
 *  ends in a separator. Known here and by the adapters set up on it, and by
 *  nothing inside the hexagon (CORE-FR-217). */
const repoFolder = pathToFileURL(`${process.cwd()}/`);
/** The developer's home, which the sessions kept on this machine are under
 *  (CORE-FR-218). */
const homeFolder = pathToFileURL(`${homedir()}/`);

const cwCommander = new Commander({
  cwd: process.cwd(),
  version: packageJson.version,
  // An answer read as data holds standard output alone: what the engine
  // reports as it goes is written to standard error (CORE-FR-241).
  composeApplications: (isJsonAnswer) =>
    composeApplications(repoFolder, homeFolder, isJsonAnswer ? { progressReporter: new StderrReporter() } : {}),
});

process.exitCode = await cwCommander.runCommandLine(process.argv.slice(2));
