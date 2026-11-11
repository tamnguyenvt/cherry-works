import { CharterFolder } from "./charter-folder.js";
import { RepoFolder } from "./repo-folder.js";

/** The situations this repository pins its charter down with, one file of cases
 *  each (FR-047), under the charter (CORE-FR-224). Apart from the primitives: a
 *  test is not a primitive, nothing compiles it and no agent is instructed by
 *  it, so it is read only when tests run. */
export class TestFolder extends RepoFolder {
  static readonly path = `${CharterFolder.path}/test`;
}
