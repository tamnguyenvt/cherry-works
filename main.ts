#!/usr/bin/env node
import { pathToFileURL } from "node:url";
import { Commander } from "./src/driver/cli/Commander.js";
import { CharterAuthoring } from "./src/hexagon/application/CharterAuthoring.js";
import { CharterVendoring } from "./src/hexagon/application/CharterVendoring.js";
import { FileReaders } from "./src/zdriven/FileReaders.js";
import { YamlParser } from "./src/zdriven/YamlParser.js";
import { FileOutput } from "./src/zdriven/FileOutput.js";
import { Git } from "./src/zdriven/Git.js";
import type { ForReadingFiles } from "./src/hexagon/port/zdriven/ForReadingFiles.js";
import type { ForParsingYaml } from "./src/hexagon/port/zdriven/ForParsingYaml.js";
import type { ForWritingFiles } from "./src/hexagon/port/zdriven/ForWritingFiles.js";
import type { ForVCS } from "./src/hexagon/port/zdriven/ForVCS.js";
import type { ForManagingCharter } from "./src/hexagon/port/driver/ForManagingCharter.js";
import type { ForVendoringCharters } from "./src/hexagon/port/driver/ForVendoringCharters.js";

/**
 * COMPOSITION ROOT — the one place that knows every concrete class.
 *
 * Each binding is declared as its port, never as the class, so the compiler
 * confirms that swapping an adapter needs no change inside the hexagon.
 */
const fileReader: ForReadingFiles = new FileReaders();
const yamlParser: ForParsingYaml = new YamlParser();
const fileWriter: ForWritingFiles = new FileOutput();
const vcs: ForVCS = new Git(fileReader);

/** Where this was run, as the hexagon takes a repository: a directory, so it
 *  ends in a separator. */
const repoPath = pathToFileURL(`${process.cwd()}/`);

const charterAuthoringApp: ForManagingCharter = new CharterAuthoring(repoPath, fileReader, yamlParser, fileWriter, vcs);

const charterVendoringApp: ForVendoringCharters = new CharterVendoring(repoPath, vcs);

const cli = new Commander({ cwd: process.cwd(), charterAuthoringApp, charterVendoringApp });

process.exitCode = await cli.run(process.argv.slice(2));
