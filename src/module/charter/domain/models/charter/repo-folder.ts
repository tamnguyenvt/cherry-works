/** One folder under a repository, named by its path from it, and by nothing
 *  of where the repository is (CORE-FR-217). */
export abstract class RepoFolder {
  protected constructor(readonly path: string) {}
}
