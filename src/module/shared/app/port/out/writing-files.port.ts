/** What an adapter answering this port raises when a file cannot be written,
 *  a folder cannot be taken away, or a path reaches out of its folder, named
 *  again here so it names this port and nothing behind it. */
export {
  AdapterFault,
  PathOutsideFolderFault,
  UndeletableFolderFault,
  UnwritableFileFault,
} from "../../../domain/models/adapter.fault.js";

/**
 * DRIVEN PORT — repository, the writing half. What writing to the repository
 * needs: put this text at this path, and take that file away. Every path is
 * the repository's, as `ForReadingFiles` says one (CORE-FR-217).
 *
 * Apart from `ForReadingFiles` because the split is the point (FR-041). A
 * service constructed without this one cannot write whoever calls it, which is
 * what makes `diagnoseCharter` provably read-only rather than politely so.
 *
 * Files, never patches: compiled output is regenerated whole, so what is handed
 * over is everything the file should hold (FR-020).
 */
export interface ForWritingFiles {
  /** Put this text, or these bytes as they are, at this file, whatever is
   *  there now, making whatever directories it takes to get to it. An
   *  executable file is one its owner may run by its path (CORE-FR-208). */
  writeFile(
    filePath: string,
    contents: string | Uint8Array,
    options?: { readonly isExecutable?: boolean },
  ): Promise<void>;

  /** Take this file away. A file that is not there is already gone rather than
   *  a failure: a build that deletes what a previous build wrote is asking for
   *  an end state, not for a file to exist first. */
  deleteFile(filePath: string): Promise<void>;

  /** Take this folder away, with everything under it, whatever that is. A
   *  folder that is not there is already gone, as a file is. */
  deleteFolder(folderPath: string): Promise<void>;

  /** Take this folder away only if it holds nothing at all, and leave it as it
   *  is otherwise. A folder that is not there is already gone. */
  deleteEmptyFolder(folderPath: string): Promise<void>;
}
