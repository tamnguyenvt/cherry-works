import { CharterFolder } from "./charter-folder.js";
import { RepoFolder } from "./repo-folder.js";

/** The cases this repository evaluates its charter by against the real agent,
 *  one file of cases each (EVAL-FR-020), under the charter (CORE-FR-224).
 *  Beside the tests rather than inside them: a test is resolved offline, and
 *  an evaluation spends a key. */
export class EvalFolder extends RepoFolder {
  static readonly path = `${CharterFolder.path}/eval`;
}
