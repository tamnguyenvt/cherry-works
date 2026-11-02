/** What an adapter answering this port raises when git refuses, named again
 *  here so it names this port and nothing behind it. */
export { AdapterFault } from "./AdapterFault.js";

/**
 * DRIVEN PORT — version control. How it is answered — a git command today, a
 * library or a test's own answer tomorrow — is the adapter's business.
 *
 * Vendoring asks for a source to be fetched; setup and the portal ask it nothing
 * (FR-023, CORE-FR-054, CORE-FR-107).
 */
export interface ForVCS {
  /** Is this folder inside version control? A folder that is not there is not,
   *  which is the same answer for the same reason: there is nothing to install
   *  a source into. */
  isInstalled(folder: URL): Promise<boolean>;

  /** Is there nothing staged and nothing modified here? What removing a
   *  vendor asks first: that it is gone lands as a commit on the branch that
   *  is checked out, and a commit made while somebody's work is in the index
   *  would carry that work along with it. */
  isClean(folder: URL): Promise<boolean>;

  /**
   * Fetch this source, at this version where one is named, into this
   * repository's object store, and answer the commit fetched: what the other
   * questions about a source are asked of, so it is fetched once. Nothing in
   * the working tree, the index or the history is touched.
   *
   * A source that cannot be reached, and a version that is not there, each
   * raise an `AdapterFault` saying what version control said (CORE-FR-190).
   */
  fetchCommit(source: string, repo: URL, version?: string): Promise<string>;

  /** Every file this fetched commit holds, by its path in it, at any depth, in
   *  no promised order. */
  listFilesAt(repo: URL, commit: string): Promise<readonly string[]>;

  /** What one file of this fetched commit holds, as text. */
  readFileAt(repo: URL, commit: string, path: string): Promise<string>;

  /**
   * Put one folder of this fetched commit — every file under it, at any depth —
   * at this folder of this repository, replacing whatever that folder held and
   * nothing beside it. The empty path is the commit's root. Nothing is staged
   * and nothing is committed: what lands is left in the working tree for the
   * user to read, whatever else is in hand (FR-023, FR-042, CORE-FR-187,
   * CORE-FR-190).
   */
  checkoutFolderAt(repo: URL, commit: string, fromFolder: string, intoSubFolder: string): Promise<void>;

  /**
   * Take this folder of this repository away, and commit that it is gone
   * (FR-030).
   *
   * What was installed is committed by whoever read it, and what leaves does so
   * as a commit, so the repository's history says when it arrived and when it went.
   *
   * A folder this repository has not got, and a repository with work in hand:
   * each raises, saying what version control said. Nothing is taken away when
   * it does.
   */
  removeSubFolder(repo: URL, subFolder: string): Promise<void>;
}
