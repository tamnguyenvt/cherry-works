/**
 * DRIVEN PORT — repository. The hexagon says which folder it means; walking
 * that folder is the adapter's business, and where the files live — a disk
 * today, a git object database or a test's own map tomorrow — is its business
 * too.
 */
export interface ForReadingFiles {
  /** Every file under one folder, at any depth, each with what it holds, in no
   *  promised order. A folder that is not there is no files rather than a
   *  failure: a charter holding some of the kind folders and not the rest is a charter. */
  readFilesRecursively(folder: URL): Promise<readonly ReadFile[]>;

  /** The folders one level under one folder, in no promised order. A charter
   *  asks this of `.cw/vendor/`, where each folder is one layer someone
   *  installed (FR-023, FR-024). */
  listFolders(folder: URL): Promise<readonly URL[]>;

  /** The text of one file that may not be there, and nothing where it is not.
   *  What is asked of a file the engine allows to be absent: the settings a
   *  repository configured itself with, and the settings file a host already
   *  keeps that a build has to write into rather than over. */
  readIfThere(file: URL): Promise<string | undefined>;

  /** The files directly in one folder, not in the folders under it, each with
   *  when it was last modified and without what it holds, in no promised
   *  order: what is asked where most of the files are not to be read. A folder
   *  that is not there is no files. */
  listFiles(folder: URL): Promise<readonly ListedFile[]>;
}

/** One file as it was listed: where it is, and when it was last modified. */
export interface ListedFile {
  readonly file: URL;
  readonly modifiedAt: Date;
}

/** One file as it was read: where it is, and what it says. */
export interface ReadFile {
  readonly file: URL;
  readonly contents: string;
}
