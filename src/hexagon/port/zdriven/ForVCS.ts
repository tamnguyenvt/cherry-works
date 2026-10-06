/** What an adapter answering this port raises when git refuses, named again
 *  here so it names this port and nothing behind it. */
export { DrivenFault } from "./DrivenFault.js";

/**
 * DRIVEN PORT — version control. The hexagon asks what is true of a folder it
 * is about to set up; how that is answered — a git command today, a library or
 * a test's own answer tomorrow — is the adapter's business.
 *
 * Setup asks what is true of the folder it is about to write in, and vendoring
 * asks for a source to be fetched: both are git's business and neither is the
 * hexagon's (FR-032, FR-023).
 */
export interface ForVCS {
  /** Is this folder inside version control? A folder that is not there is not,
   *  which is the same answer for the same reason: there is nothing to commit
   *  what setup writes into. */
  isInstalled(folder: URL): Promise<boolean>;

  /** Is there nothing staged and nothing modified here? What vendoring asks
   *  before it fetches: what it installs lands as a commit on the branch that
   *  is checked out, and a commit made while somebody's work is in the index
   *  would carry that work along with it. */
  isClean(folder: URL): Promise<boolean>;

  /**
   * Every file under this folder of this repository that is not as version
   * control last recorded it — edited, staged, added since, or gone — named as
   * it sits under the repository (FR-040).
   *
   * What is installed lands as a commit, so a vendored file that differs from
   * the commit it arrived in is a hand-edit and version control already knows
   * it (T204, T209). This is that question asked of one folder rather than of
   * the whole repository, since the work somebody is holding elsewhere is no
   * part of the answer.
   *
   * A folder that is not there, and one no repository holds, has nothing
   * changed under it: there is no recorded state to differ from.
   */
  changedUnder(repo: URL, subFolder: string): Promise<readonly string[]>;

  /**
   * Copy one folder of this source, at this version where one is named, into
   * this folder of this repository, replacing what that folder held, and commit
   * it (FR-023, FR-042).
   *
   * The source is whatever version control fetches — an address over any
   * transport, a path on disk — and is passed along as it was written. Reading
   * it is the adapter's business, and deciding a transport on the author's
   * behalf is nobody's: the credentials a private source needs are the
   * configuration of whoever runs this (FR-031).
   *
   * Both folders are named as they sit under their own repository: which one
   * is taken from the source, and where it goes here, is the caller's to say.
   * What lands is that folder's files alone, committed: a checkout of this
   * repository holds the whole charter it is governed by, with nothing left to
   * fetch (FR-028). Copying it again is how what was copied is brought up to
   * date. Answers the folder it copied into.
   *
   * A source that holds no such folder at that version, one that holds a file
   * under `refusedIfSourceHolds`, a source that cannot be reached, a version
   * that is not there, a repository with work in hand: each raises a
   * `DrivenFault`, saying what version control found. Nothing is installed
   * when it does (Edge Cases).
   */
  subtreeAdd(
    source: string,
    sourceSubFolder: string,
    repo: URL,
    intoSubFolder: string,
    version?: string,
    refusedIfSourceHolds?: string,
  ): Promise<string>;

  /**
   * Take this folder of this repository away, and commit that it is gone
   * (FR-030).
   *
   * The other half of `subtreeAdd`: what was installed as a commit leaves as
   * one, so the repository's history says when it arrived and when it went.
   *
   * A folder this repository has not got, and a repository with work in hand:
   * each raises, saying what version control said. Nothing is taken away when
   * it does.
   */
  removeSubFolder(repo: URL, subFolder: string): Promise<void>;

  /**
   * A worktree of this repository's last commit, checked out detached at this
   * folder: its files as committed, and none of the work in hand
   * (EVAL-FR-021). A repository with nothing committed raises a
   * `DrivenFault`.
   */
  addWorktree(repo: URL, worktreeFolder: URL): Promise<void>;

  /** One worktree taken away: its folder, and version control's record of
   *  it. A folder that is no worktree any more, or is not there, is removed
   *  all the same. */
  removeWorktree(repo: URL, worktreeFolder: URL): Promise<void>;
}
