import { CharterFolder } from "./charter-folder.js";
import { RepoFolder } from "./repo-folder.js";

/** What this repository installed from someone else, one folder per vendor,
 *  `<owner>/<repository>` (FR-023, FR-024, FR-050), under the charter
 *  (CORE-FR-224). Apart from the primitives: what a vendor published is
 *  read-only, and what this repository authored is not. */
export class VendorsFolder extends RepoFolder {
  static readonly path = `${CharterFolder.path}/vendor`;
}
