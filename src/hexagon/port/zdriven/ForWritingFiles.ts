/**
 * DRIVEN PORT — repository, the writing half. What `build` needs and nothing
 * else: put this text at this path, and take that file away.
 *
 * Apart from `ForReadingFiles` because the split is the point (FR-041). A
 * service constructed without this one cannot write whoever calls it, which is
 * what makes `doctor` provably read-only rather than politely so.
 *
 * Files, never patches: compiled output is regenerated whole, so what is handed
 * over is everything the file should hold (FR-020).
 */
export interface ForWritingFiles {
  /** Put this text at this file, whatever is there now, making whatever
   *  directories it takes to get to it. */
  write(file: URL, contents: string): Promise<void>;

  /** Take this file away. A file that is not there is already gone rather than
   *  a failure: a build that deletes what a previous build wrote is asking for
   *  an end state, not for a file to exist first. */
  delete(file: URL): Promise<void>;
}
