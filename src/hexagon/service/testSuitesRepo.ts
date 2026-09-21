import { testSuiteOf, type TestSuite } from "../domain/models/TestSuite.js";
import { testFolderIn } from "../domain/path.js";
import { Fault, TestSuiteFault } from "../domain/models/Fault.js";
import type { ForReadingFiles } from "../port/zdriven/ForReadingFiles.js";

/** One test file, read: the suite it holds, or the fault that is why it holds
 *  none. Either way under the file it was read from — which is what a failing
 *  case is named by, since two files may each put the same situation, and what
 *  a fault is filed under. */
export type TestSuiteByFile =
  | { readonly file: string; readonly suite: TestSuite }
  | { readonly file: string; readonly fault: Fault };

/**
 * One repository's self-regression tests, read off `.cw/test/` (FR-047).
 *
 * Read the way the charter is read and separately from it: these are not
 * primitives, so nothing here goes near a kind's folder and no charter is handed
 * them. A repository that wrote none has none, and running tests says so rather
 * than failing to find a folder.
 *
 * One entry per file, in the order their paths sort in, so two runs over one
 * repository report in the same order (SC-007). A file that does not read comes
 * back as the fault it is rather than raised: whoever asked for a run is the one
 * who reports it, and the fault names the file it is wrong with, since this is
 * what knew where it was read from (SC-003, FR-009).
 */
export async function loadTestSuites(
  repo: URL,
  fileReaders: ForReadingFiles,
): Promise<readonly TestSuiteByFile[]> {
  const repoHref = repo.href.endsWith("/") ? repo.href : `${repo.href}/`;
  const read = await fileReaders.readFilesRecursively(testFolderIn(repo));

  return read
    .filter(({ file }) => file.href.endsWith(".json"))
    .sort((one, another) => one.file.href.localeCompare(another.file.href))
    .map(({ file, contents }) => {
      const path = decodeURIComponent(file.href.slice(repoHref.length));
      try {
        return { file: path, suite: testSuiteOf(contents) };
      } catch (raised) {
        if (!(raised instanceof Fault)) throw raised;
        return { file: path, fault: new TestSuiteFault(`${path}: ${raised.message}`, raised.fix) };
      }
    });
}
