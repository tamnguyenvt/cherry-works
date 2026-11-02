import { evalRootOf, type EvalRoot } from "../domain/models/eval/EvalSuite.js";
import { evalFolderIn, evalWorktreesFolderIn } from "../domain/path.js";
import type { ForReadingFiles } from "../port/zdriven/ForReadingFiles.js";

/** One repository's evaluation cases, read off `.cw/eval/` (EVAL-FR-020): read
 *  apart from the charter and from the tests, since they are neither. None
 *  written is none read, not a failure, and what a stopped run left among the
 *  worktrees is no case. */
export async function loadEvalRoot(repo: URL, fileReaders: ForReadingFiles): Promise<EvalRoot> {
  const repoHref = repo.href.endsWith("/") ? repo.href : `${repo.href}/`;
  const worktreesFolder = evalWorktreesFolderIn(repo);
  return evalRootOf(
    (await fileReaders.readFilesRecursively(evalFolderIn(repo)))
      .filter(({ file }) => file.href.endsWith(".json") && !file.href.startsWith(worktreesFolder.href))
      .map(({ file, contents }) => ({ path: decodeURIComponent(file.href.slice(repoHref.length)), contents })),
  );
}
