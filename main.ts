#!/usr/bin/env node
import { homedir } from "node:os";
import { pathToFileURL } from "node:url";
import packageJson from "./package.json" with { type: "json" };
import { Commander } from "./src/presentation/cli/cli.commander.js";
import { composeApplications } from "./src/module/composition.js";

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

const cli = new Commander({
  cwd: process.cwd(),
  version: packageJson.version,
  composeApplications: () => composeApplications(repoFolder, homeFolder),
});

process.exitCode = await cli.run(process.argv.slice(2));
