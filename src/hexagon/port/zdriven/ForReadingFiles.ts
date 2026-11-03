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

  /** Every file under one folder, as `readFilesRecursively` answers them, each
   *  with the bytes it holds, never decoded: what is asked of a folder whose
   *  files are copied as they are, whatever they hold (CORE-FR-207,
   *  CORE-FR-208). */
  readBytesRecursively(folder: URL): Promise<readonly ReadFile<Uint8Array>[]>;

  /** The folders one level under one folder, in no promised order. A charter
   *  asks this of `.cw/vendor/` and of each owner's folder under it, where each
   *  folder is one layer someone installed (FR-023, FR-024, FR-050). */
  listFolders(folder: URL): Promise<readonly URL[]>;

  /** The text of one file that may not be there, and nothing where it is not.
   *  What is asked of a file the engine allows to be absent: the settings a
   *  repository configured itself with, and the settings file a host already
   *  keeps that a build has to write into rather than over. */
  readIfThere(file: URL): Promise<string | undefined>;

  /** The bytes of one file that may not be there, never decoded, and nothing
   *  where it is not: what a copy is compared with (CORE-FR-207). */
  readBytesIfThere(file: URL): Promise<Uint8Array | undefined>;

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

/** One file as it was read: where it is, and what it says — its text, or its
 *  bytes where they were asked for. */
export interface ReadFile<Contents extends string | Uint8Array = string> {
  readonly file: URL;
  readonly contents: Contents;
}
