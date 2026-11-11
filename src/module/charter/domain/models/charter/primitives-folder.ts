import { CharterFolder } from "./charter-folder.js";
import { RepoFolder } from "./repo-folder.js";

/** The repository's own primitives, a folder per kind, under the charter
 *  (CORE-FR-224). */
export class PrimitivesFolder extends RepoFolder {
  static readonly path = `${CharterFolder.path}/primitive`;
}
