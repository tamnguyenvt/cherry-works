#!/usr/bin/env node
// A PostToolUse hook: format and lint the file the agent just wrote, with the
// repository's own Biome, and hand back what Biome cannot fix (exit 2).
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { extname, join } from "node:path";

const BIOME_EXTENSIONS = new Set([".ts", ".tsx", ".mts", ".cts", ".js", ".jsx", ".mjs", ".cjs", ".json", ".jsonc", ".css"]);

const hookText = readFileSync(0, "utf8");
const hookInput = hookText.trim() === "" ? {} : JSON.parse(hookText);
const writtenFilePath = hookInput.tool_input?.file_path ?? hookInput.tool_input?.path;
const biomePath = join(process.cwd(), "node_modules", ".bin", "biome");

if (typeof writtenFilePath !== "string" || !BIOME_EXTENSIONS.has(extname(writtenFilePath)) || !existsSync(writtenFilePath) || !existsSync(biomePath)) process.exit(0);

const biomeRun = spawnSync(biomePath, ["check", "--write", "--no-errors-on-unmatched", "--files-ignore-unknown=true", writtenFilePath], { encoding: "utf8" });
if (biomeRun.status === 0) process.exit(0);
process.stderr.write(`Biome left problems in ${writtenFilePath}; fix them:\n${biomeRun.stdout}${biomeRun.stderr}`);
process.exit(2);
