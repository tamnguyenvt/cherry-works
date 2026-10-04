#!/usr/bin/env node
import { pathToFileURL } from "node:url";
import packageJson from "./package.json" with { type: "json" };
import { Commander } from "./src/driver/cli/Commander.js";
import { CharterAuthoring } from "./src/hexagon/application/CharterAuthoring.js";
import { CharterVendoring } from "./src/hexagon/application/CharterVendoring.js";
import { TestAuthoring } from "./src/hexagon/application/TestAuthoring.js";
import { McpConnecting } from "./src/hexagon/application/McpConnecting.js";
import { FileReaders } from "./src/zdriven/FileReaders.js";
import { YamlParser } from "./src/zdriven/YamlParser.js";
import { FileOutput } from "./src/zdriven/FileOutput.js";
import { Git } from "./src/zdriven/Git.js";
import { OsSecrets } from "./src/zdriven/OsSecrets.js";
import { OAuth } from "./src/zdriven/OAuth.js";
import { McpClients } from "./src/zdriven/McpClients.js";
import { Tiktoken } from "./src/zdriven/Tiktoken.js";
import { ClaudeCli } from "./src/zdriven/ClaudeCli.js";
import type { ForReadingFiles } from "./src/hexagon/port/zdriven/ForReadingFiles.js";
import type { ForParsingYaml } from "./src/hexagon/port/zdriven/ForParsingYaml.js";
import type { ForWritingFiles } from "./src/hexagon/port/zdriven/ForWritingFiles.js";
import type { ForVCS } from "./src/hexagon/port/zdriven/ForVCS.js";
import type { ForKeepingSecrets } from "./src/hexagon/port/zdriven/ForKeepingSecrets.js";
import type { ForAuthorizing } from "./src/hexagon/port/zdriven/ForAuthorizing.js";
import type { ForCallingMcpServers } from "./src/hexagon/port/zdriven/ForCallingMcpServers.js";
import type { ForCountingTokens } from "./src/hexagon/port/zdriven/ForCountingTokens.js";
import type { ForRunningAgentCli } from "./src/hexagon/port/zdriven/ForRunningAgentCli.js";
import type { AgentProvider } from "./src/hexagon/port/driver/ForManagingCharter.js";
import type { ForManagingCharter } from "./src/hexagon/port/driver/ForManagingCharter.js";
import type { ForVendoringCharters } from "./src/hexagon/port/driver/ForVendoringCharters.js";
import type { ForAuthoringTests } from "./src/hexagon/port/driver/ForAuthoringTests.js";
import type { ForConnectingMcps } from "./src/hexagon/port/driver/ForConnectingMcps.js";

/**
 * COMPOSITION ROOT — the one place that knows every concrete class.
 *
 * Each binding is declared as its port, never as the class, so the compiler
 * confirms that swapping an adapter needs no change inside the hexagon.
 */
const fileReader: ForReadingFiles = new FileReaders();
const yamlParser: ForParsingYaml = new YamlParser();
const fileWriter: ForWritingFiles = new FileOutput();
const vcs: ForVCS = new Git();
const secrets: ForKeepingSecrets = new OsSecrets();
const authorizing: ForAuthorizing = new OAuth();
const mcpServers: ForCallingMcpServers = new McpClients();
const tokenCounter: ForCountingTokens = new Tiktoken();
/** Each agent's own command line, under the agent it runs: a second host is
 *  one more entry here. */
const agentCliByProvider: Readonly<Record<AgentProvider, ForRunningAgentCli>> = { claude: new ClaudeCli() };

/** Where this was run, as the hexagon takes a repository: a directory, so it
 *  ends in a separator. */
const repoPath = pathToFileURL(`${process.cwd()}/`);

const charterAuthoringApp: ForManagingCharter = new CharterAuthoring(repoPath, fileReader, yamlParser, fileWriter, vcs, tokenCounter, agentCliByProvider);

const charterVendoringApp: ForVendoringCharters = new CharterVendoring(repoPath, fileReader, vcs);

const testAuthoringApp: ForAuthoringTests = new TestAuthoring(repoPath, fileReader, fileWriter);

const mcpConnectingApp: ForConnectingMcps = new McpConnecting(repoPath, fileReader, secrets, authorizing, yamlParser, mcpServers);

const cli = new Commander({ cwd: process.cwd(), version: packageJson.version, charterAuthoringApp, charterVendoringApp, testAuthoringApp, mcpConnectingApp });

process.exitCode = await cli.run(process.argv.slice(2));
