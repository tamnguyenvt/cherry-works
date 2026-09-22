/**
 * DRIVER PORT — what this engine offers for the charters a repository did not
 * author itself (FR-023 – FR-031).
 *
 * Apart from `ForManagingCharter` because it is a different conversation: that
 * one reads and compiles what is here, and this one is how what is here arrives
 * and is kept up to date. Nothing on it reads a charter, and nothing on the
 * other one installs anything.
 *
 * What it answers are folder names, as they sit under the repository: a name
 * is already plain JSON, and there is no model behind it to say more.
 */
export interface ForVendoringCharters {
  /**
   * Install one source under this repository's vendor folder, pinned to this
   * version where one is named (FR-023, FR-027).
   *
   * The source is passed on as it was written: which transport it names and
   * whether the credentials for it are there is version control's business, and
   * what it says when it refuses is what the caller is told (FR-031).
   *
   * Installing one that is already there brings it up to date instead, so a
   * repository has one way of saying what it wants rather than two (FR-030).
   *
   * Refused outside version control, and refused while there is work in hand:
   * what it installs lands as a commit on the branch checked out, and a commit
   * made over somebody's staged work would carry that work along with it.
   *
   * What it answers is the folder it landed in. Everything else about it is in
   * that repository's history, which is where a commit belongs.
   */
  add(source: string, version?: string): Promise<string>;

  /**
   * Take one installed charter away, named by the folder it was installed as
   * (FR-030), and answer that folder.
   *
   * Named by the folder rather than by the address it came from: the folder is
   * what a reader of this repository sees, and what the charter is read out of.
   *
   * Refused for the reasons installing is: outside version control, and while
   * there is work in hand, since what leaves does so as a commit.
   */
  remove(name: string): Promise<string>;

  /**
   * Every folder a source was installed as, under this repository's vendor
   * folder, sorted (FR-053, FR-122).
   *
   * The folder is all there is to say: nothing is recorded of where one came
   * from or at which version, since version control keeps no such record
   * either and a record kept beside it is one more thing to drift (FR-046).
   */
  installed(): Promise<readonly string[]>;
}
