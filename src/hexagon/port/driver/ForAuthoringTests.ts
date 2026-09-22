import type { DataDTOs } from "./dtos/index.js";

/**
 * DRIVER PORT — the test files a repository writes beside its charter, and
 * nothing of the charter itself (FR-090 – FR-092, FR-124).
 *
 * Apart from `ForManagingCharter` because it is a different conversation: that
 * one reads the charter and resolves the cases against it; this one lists,
 * writes and removes the files the cases live in, and reads no charter.
 */
export interface ForAuthoringTests {
  /**
   * Every test file under `.cw/test/`, run or not: its name, its text, and its
   * description and cases — or, for a file that does not read, why (FR-124).
   *
   * Reads and says, and reads no charter: nothing is resolved here, which is
   * what `test` does. A file that does not read is listed all the same, since
   * it is the one its author most needs to open.
   */
  suites(): Promise<DataDTOs.TestSuites>;

  /**
   * A new test file, under a name no other test file has, holding one sample
   * case that reads as a suite (FR-091). What comes back is its name.
   */
  addSuite(): Promise<string>;

  /**
   * One existing test file written over with this text (FR-090). Text that does
   * not read as a suite is raised with the refusal and sample `cw test` gives,
   * and nothing is written; so is a name that is no test file. What comes back
   * is its name.
   */
  writeSuite(name: string, text: string): Promise<string>;

  /**
   * One test file taken away, and nothing else (FR-092). A name that is no test
   * file is raised. What comes back is its name.
   */
  removeSuite(name: string): Promise<string>;
}
