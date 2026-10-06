import { evalRootOf, type EvalRoot } from "../domain/models/eval/EvalSuite.js";
import { evalFolderIn } from "../domain/path.js";
import type { ForReadingFiles } from "../port/zdriven/ForReadingFiles.js";

/** One repository's evaluation cases, read off `.cw/eval/` (EVAL-FR-020): read
 *  apart from the charter and from the tests, since they are neither. None
 *  written is none read, not a failure. */
export async function loadEvalRoot(repo: URL, fileReaders: ForReadingFiles): Promise<EvalRoot> {
  const repoHref = repo.href.endsWith("/") ? repo.href : `${repo.href}/`;
  return evalRootOf(
    (await fileReaders.readFilesRecursively(evalFolderIn(repo)))
      .filter(({ file }) => file.href.endsWith(".json"))
      .map(({ file, contents }) => ({ path: decodeURIComponent(file.href.slice(repoHref.length)), contents })),
  );
}
