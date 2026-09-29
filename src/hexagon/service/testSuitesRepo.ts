import { DEFAULT_TEST_SUITE_BODY, testSuiteOf } from "../domain/models/test/TestSuite.js";
import { testRootOf, type TestRoot } from "../domain/models/test/TestRoot.js";
import { TEST_DIRECTORY, testFolderIn } from "../domain/path.js";
import { TestSuiteFault } from "../domain/models/DomainFault.js";
import type { ForReadingFiles } from "../port/zdriven/ForReadingFiles.js";
import type { ForWritingFiles } from "../port/zdriven/ForWritingFiles.js";

/**
 * One repository's self-regression tests, read off `.cw/test/` (FR-047).
 *
 * Read the way the charter is read and separately from it: these are not
 * primitives, so nothing here goes near a kind's folder and no charter is handed
 * them. A repository that wrote none has none, and running tests says so rather
 * than failing to find a folder. Only which files there are is settled here,
 * where the folder is; what each holds is `testRootOf`'s to read, as a
 * charter's is `charterRootOf`'s.
 */
export async function loadTestRoot(repo: URL, fileReaders: ForReadingFiles): Promise<TestRoot> {
  const repoHref = repo.href.endsWith("/") ? repo.href : `${repo.href}/`;
  return testRootOf(
    (await fileReaders.readFilesRecursively(testFolderIn(repo)))
      .filter(({ file }) => file.href.endsWith(".json"))
      .map(({ file, contents }) => ({ path: decodeURIComponent(file.href.slice(repoHref.length)), contents })),
  );
}

/** A new test file, named `untitled-<n>.json` for the first `n` no test file
 *  has, holding one sample case that reads as a suite; and its name (FR-091). */
export async function addTestSuite(repo: URL, fileReaders: ForReadingFiles, fileWriter: ForWritingFiles): Promise<string> {
  const name = (await loadTestRoot(repo, fileReaders)).untitledName;
  await fileWriter.write(new URL(name, testFolderIn(repo)), DEFAULT_TEST_SUITE_BODY);
  return name;
}

/** One existing test file written over with this text, refused with nothing
 *  written where the text does not read as a suite — the refusal and sample
 *  `cw test` gives (FR-090). */
export async function writeTestSuite(
  repo: URL,
  fileReaders: ForReadingFiles,
  fileWriter: ForWritingFiles,
  name: string,
  text: string,
): Promise<string> {
  await ensureTestSuiteNamed(repo, fileReaders, name);
  testSuiteOf(text);
  await fileWriter.write(new URL(name, testFolderIn(repo)), text);
  return name;
}

/** One test file taken away, and nothing else (FR-092). */
export async function removeTestSuite(
  repo: URL,
  fileReaders: ForReadingFiles,
  fileWriter: ForWritingFiles,
  name: string,
): Promise<string> {
  await ensureTestSuiteNamed(repo, fileReaders, name);
  await fileWriter.delete(new URL(name, testFolderIn(repo)));
  return name;
}

/** Refused unless a test file is listed under this name. A name that is none — a name reaching
 *  outside `.cw/test/` among them — is refused, so nothing but a test file is
 *  ever written over or taken away. */
async function ensureTestSuiteNamed(repo: URL, fileReaders: ForReadingFiles, name: string): Promise<void> {
  if (!(await loadTestRoot(repo, fileReaders)).hasTestSuiteNamed(name))
    throw new TestSuiteFault(`${TEST_DIRECTORY}/ holds no test file called "${name}".`, 'Run "cw suite add" to write a new one.');
}
