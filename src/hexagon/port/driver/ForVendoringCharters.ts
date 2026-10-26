import type { OutcomeDTOs } from "./dtos/index.js";

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
 * is already plain JSON, and there is no model behind it to say more. Installing
 * answers the skills it took beside the folder, where the source was a skills
 * repository (CORE-FR-184).
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
   * Refused outside version control. What it installs is left unstaged for the
   * user to read and commit, whatever else is in hand (CORE-FR-190).
   *
   * A charter is installed whole, and `skillIds` is refused for it
   * (CORE-FR-193). A skills repository's skills `skillIds` names are installed,
   * or every one it holds where none is named, asking nothing (CORE-FR-184,
   * CORE-FR-188).
   *
   * What it answers is the folder it landed in, and the primitives installed
   * there, each skill with the headers its `SKILL.md` declared that were left
   * out (CORE-FR-186).
   */
  add(source: string, version?: string, skillIds?: readonly string[]): Promise<OutcomeDTOs.VendorAddOutcome>;

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
