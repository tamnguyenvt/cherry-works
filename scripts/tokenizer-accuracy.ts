/**
 * Measures how far the offline estimate of what this repository's charter
 * puts into Claude Code's main context is from the count the real `claude`
 * makes of it (EVAL-FR-004, EVAL-SC-002): `cw context` against
 * `cw context --exact`, at the commit checked out, over a copy of its `.cw`
 * without the eval cases and the log, whose one agent is claude, since no
 * other is counted exactly. It runs the real `claude`,
 * on whatever it is signed in with, so it spends tokens, and no substitute's
 * answer stands in for it. It prints each primitive's two counts, the totals
 * and their difference, and exits 1 when the totals differ by more than 15%.
 *
 *   pnpm tokenizer-accuracy
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { cp, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, sep } from "node:path";
import { EVAL_FOLDER_PATH } from "../src/module/charter/domain/constants.js";
import { LOG_FOLDER_PATH } from "../src/module/runtime/domain/constants.js";

const ROOT = join(import.meta.dirname, "..");
/** How far the estimate may be from the exact count, of the exact count (EVAL-SC-002). */
const ACCURACY_LIMIT = 0.15;
const AGENT = "claude";

/** What one `cw context` said of claude's main context: each primitive's
 *  tokens by its id, and their total. */
function claudeContextOf(
  repoFolder: string,
  contextArgs: readonly string[],
): { tokensById: Map<string, number>; totalTokens: number; totalLine: string } {
  const contextRun = spawnSync(
    process.execPath,
    [
      "--import",
      import.meta.resolve("tsx"),
      "--import",
      join(ROOT, "scripts/module-loader.mjs"),
      join(ROOT, "main.ts"),
      "context",
      ...contextArgs,
    ],
    { cwd: repoFolder, encoding: "utf8", maxBuffer: 16 * 1024 * 1024 },
  );
  if (contextRun.status !== 0)
    throw new Error(
      `cw context ${contextArgs.join(" ")} stopped with status ${contextRun.status}:\n${contextRun.stdout}${contextRun.stderr}`,
    );
  const contextLines = contextRun.stdout.split("\n");
  const claudeLines = contextLines.slice(contextLines.indexOf(`${AGENT} opens a session with:`) + 1);
  const totalLine = claudeLines.find((line) => / tokens in all, /.test(line));
  if (totalLine === undefined)
    throw new Error(`cw context ${contextArgs.join(" ")} said nothing of ${AGENT}:\n${contextRun.stdout}`);
  const tokensById = new Map<string, number>();
  for (const loadLine of claudeLines.slice(0, claudeLines.indexOf(totalLine))) {
    const [, tokens, id] = loadLine.match(/^\s+([\d,]+)\s+\S+\s+(\S+)/) ?? [];
    if (tokens !== undefined && id !== undefined) tokensById.set(id, Number(tokens.replaceAll(",", "")));
  }
  return {
    tokensById,
    totalTokens: Number(totalLine.trim().split(" ")[0]!.replaceAll(",", "")),
    totalLine: totalLine.trim(),
  };
}

// What is copied is the working tree's `.cw`: it is the commit's only while
// nothing under it has changed since.
const changedCharterFiles = spawnSync("git", ["status", "--porcelain", "--", ".cw"], {
  cwd: ROOT,
  encoding: "utf8",
}).stdout.trim();
if (changedCharterFiles !== "") {
  console.error(
    `Nothing was measured: .cw has changes not committed, so the charter measured would not be the commit's.\n${changedCharterFiles}`,
  );
  process.exit(1);
}
const commitId = spawnSync("git", ["rev-parse", "--short", "HEAD"], { cwd: ROOT, encoding: "utf8" }).stdout.trim();
const measuredAt = new Date().toISOString();
const charterCopyFolder = await mkdtemp(join(tmpdir(), "cw-tokenizer-accuracy-"));
let estimatedContext: ReturnType<typeof claudeContextOf>;
let exactContext: ReturnType<typeof claudeContextOf>;
try {
  // The charter alone is measured: no eval case and no log (EVAL Story 9).
  const unmeasuredFolderPaths = [EVAL_FOLDER_PATH, LOG_FOLDER_PATH];
  await cp(join(ROOT, ".cw"), join(charterCopyFolder, ".cw"), {
    recursive: true,
    filter: (sourcePath) =>
      !unmeasuredFolderPaths.some(
        (folderPath) =>
          sourcePath === join(ROOT, folderPath) || sourcePath.startsWith(`${join(ROOT, folderPath)}${sep}`),
      ),
  });
  const copiedUnmeasuredFolderPaths = unmeasuredFolderPaths.filter((folderPath) =>
    existsSync(join(charterCopyFolder, folderPath)),
  );
  if (copiedUnmeasuredFolderPaths.length > 0)
    throw new Error(`Nothing was measured: the charter's copy holds ${copiedUnmeasuredFolderPaths.join(" and ")}.`);
  await writeFile(join(charterCopyFolder, ".cw/settings.json"), JSON.stringify({ agents: [AGENT] }));
  estimatedContext = claudeContextOf(charterCopyFolder, []);
  exactContext = claudeContextOf(charterCopyFolder, ["--exact"]);
} finally {
  await rm(charterCopyFolder, { recursive: true, force: true });
}
if (!/counted exactly by claude/.test(exactContext.totalLine))
  throw new Error(`cw context --exact did not count through ${AGENT}: "${exactContext.totalLine}"`);
const totalDifference = (estimatedContext.totalTokens - exactContext.totalTokens) / exactContext.totalTokens;

console.log(`Tokenizer accuracy of this repository's charter at ${commitId}, measured ${measuredAt} through ${AGENT}:`);
console.log(`  ${"estimated".padStart(9)}  ${"exact".padStart(9)}  ${"difference".padStart(10)}  primitive`);
for (const [id, exactTokens] of [...exactContext.tokensById].sort(
  ([, oneTokens], [, otherTokens]) => otherTokens - oneTokens,
)) {
  const estimatedTokens = estimatedContext.tokensById.get(id) ?? 0;
  const primitiveDifference = exactTokens === 0 ? 0 : (estimatedTokens - exactTokens) / exactTokens;
  console.log(
    `  ${estimatedTokens.toLocaleString("en-US").padStart(9)}  ${exactTokens.toLocaleString("en-US").padStart(9)}  ${`${(primitiveDifference * 100).toFixed(1)}%`.padStart(10)}  ${id}`,
  );
}
console.log(
  `  ${estimatedContext.totalTokens.toLocaleString("en-US").padStart(9)}  ${exactContext.totalTokens.toLocaleString("en-US").padStart(9)}  ${`${(totalDifference * 100).toFixed(1)}%`.padStart(10)}  in all`,
);
if (Math.abs(totalDifference) > ACCURACY_LIMIT) {
  console.error(
    `The estimate is ${(Math.abs(totalDifference) * 100).toFixed(1)}% from the exact count, past the ${ACCURACY_LIMIT * 100}% EVAL-SC-002 allows.`,
  );
  process.exitCode = 1;
} else console.log(`Within the ${ACCURACY_LIMIT * 100}% EVAL-SC-002 allows.`);
