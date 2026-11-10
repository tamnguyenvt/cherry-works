import { WorkspaceFolder } from "./workspace-folder.js";
import { RepoFolder } from "./repo-folder.js";

/** The charter itself, the only part of the workspace a person authors: its
 *  primitives, its tests, its eval cases and its vendors, each in a folder of
 *  its own under it (CORE-FR-224). */
export class CharterFolder extends RepoFolder {
  static readonly path = `${WorkspaceFolder.path}/charter`;
}
