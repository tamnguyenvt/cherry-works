/** What an adapter answering this port raises when git refuses, named again
 *  here so it names this port and nothing behind it. */
export { Fault } from "../../domain/models/Fault.js";

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
   * Add this source under this folder of this repository, pinned to this
   * version where one is named (FR-023).
   *
   * The source is whatever version control fetches — an address over any
   * transport, a path on disk — and is passed along as it was written. Reading
   * it is the adapter's business, and deciding a transport on the author's
   * behalf is nobody's: the credentials a private source needs are the
   * configuration of whoever runs this (FR-031).
   *
   * The folder is named as it sits under the repository given, which is what
   * says where a vendor goes. What lands is the source's files there, committed: a checkout of this repository holds the whole
   * charter it is governed by, with nothing left to fetch (FR-028).
   *
   * A source that cannot be reached, a version that is not there, a folder
   * already taken, a repository with work in hand: each raises, saying what
   * version control said. Nothing is installed when it does (Edge Cases).
   */
  subtreeAdd(source: string, repo: URL, intoSubFolder: string, version?: string): Promise<void>;

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
}
