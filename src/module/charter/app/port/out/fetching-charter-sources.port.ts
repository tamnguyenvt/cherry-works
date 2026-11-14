/** What an adapter answering this port raises when git refuses, named again
 *  here so it names this port and nothing behind it. */
export {
  AdapterFault,
  FailedCheckoutFault,
  LeftoverFolderFault,
  LinkedFolderFault,
  MissingGitFault,
  UnreachableSourceFault,
  UnreadableFetchedSourceFault,
  UnreadableGitConfigFault,
  UnrestoredFolderFault,
  UnwritableSourceStoreFault,
} from "../../../../shared/module.js";

/**
 * DRIVEN PORT — reaching a source. How it is answered — a git command today, a
 * library or a test's own answer tomorrow — is the adapter's business.
 *
 * The folder a source lands in need not be a repository: nothing here needs a
 * repository, and nothing here writes to one (FR-023, CORE-FR-205).
 */
export interface ForFetchingCharterSources {
  /**
   * Fetch this source, at this version where one is named, and answer the
   * commit fetched: what the other questions about a source are asked of, so it
   * is fetched once. Its text is the adapter's own, for this port alone to
   * read. Nothing in the repository is touched; it is only what a relative source is
   * read from, and whose own version control settings reach it, where it has
   * any. Whoever fetched it says `removeFetchedCommit` when done.
   *
   * A source that cannot be reached, a version that is not there, and a machine
   * that cannot fetch at all each raise an `AdapterFault` saying so
   * (CORE-FR-190, CORE-FR-205).
   */
  fetchCommit(source: string, version?: string): Promise<string>;

  /** Every file this fetched commit holds, by its path in it, at any depth, in
   *  no promised order. */
  listFilesAt(commit: string): Promise<readonly string[]>;

  /** What one file of this fetched commit holds, as text. */
  readFileAt(commit: string, path: string): Promise<string>;

  /** What one file of this fetched commit holds, as the bytes it holds, never
   *  decoded (CORE-FR-208). */
  readBytesAt(commit: string, path: string): Promise<Uint8Array>;

  /**
   * Put one folder of this fetched commit — every file under it, at any depth —
   * at this folder of this repository, replacing whatever that folder held and
   * nothing beside it. The empty path is the commit's root. Nothing is staged
   * and nothing is committed: what lands is left in the working tree for the
   * user to read, whatever else is in hand (FR-023, FR-042, CORE-FR-187,
   * CORE-FR-190).
   */
  checkOutFolder(commit: string, fromFolder: string, intoSubFolder: string): Promise<void>;

  /** This fetched commit let go, with all the adapter kept to answer for it;
   *  nothing is asked of it afterwards. */
  removeFetchedCommit(commit: string): Promise<void>;
}
