import { addTestSuite, loadTestRoot, removeTestSuite, writeTestSuite } from "../service/testSuitesRepo.js";
import type { DataDTOs } from "../port/driver/dtos/index.js";
import type { ForAuthoringTests } from "../port/driver/ForAuthoringTests.js";
import type { ForReadingFiles } from "../port/zdriven/ForReadingFiles.js";
import type { ForWritingFiles } from "../port/zdriven/ForWritingFiles.js";
import { testSuitesDTO } from "./dtos.js";

/**
 * APPLICATION SERVICE — the test files a repository writes beside its charter
 * (FR-090 – FR-092, FR-124).
 *
 * No charter is read here: listing, writing and removing a test file asks
 * nothing of it. Resolving the cases against the charter is `CharterAuthoring`'s
 * `test`. Where a new file is named and what refuses a text are
 * `testSuitesRepo`'s.
 */
export class TestAuthoring implements ForAuthoringTests {
  readonly #repoPath: URL;
  readonly #fileReader: ForReadingFiles;
  readonly #fileWriter: ForWritingFiles;

  constructor(
    /** The repository this speaks for, named once: its test files are listed
     *  and written under the same one. */
    repoPath: URL,
    fileReader: ForReadingFiles,
    fileWriter: ForWritingFiles,
  ) {
    this.#repoPath = repoPath;
    this.#fileReader = fileReader;
    this.#fileWriter = fileWriter;
  }

  /** Every test file as it was read, with its text, one that does not read
   *  among them (FR-124). */
  async suites(): Promise<DataDTOs.TestSuites> {
    return testSuitesDTO(await loadTestRoot(this.#repoPath, this.#fileReader));
  }

  async addSuite(): Promise<string> {
    return addTestSuite(this.#repoPath, this.#fileReader, this.#fileWriter);
  }

  async writeSuite(name: string, text: string): Promise<string> {
    return writeTestSuite(this.#repoPath, this.#fileReader, this.#fileWriter, name, text);
  }

  async removeSuite(name: string): Promise<string> {
    return removeTestSuite(this.#repoPath, this.#fileReader, this.#fileWriter, name);
  }
}
