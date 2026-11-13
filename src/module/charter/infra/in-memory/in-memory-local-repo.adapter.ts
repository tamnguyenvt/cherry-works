import {
  type CharterOutput,
  type ForManagingLocalOutput,
  outputPath,
  ProjectionPlan,
  WritePlan,
} from "../../app/port/out/managing-local-output.port.js";

/** A compiled charter laid in memory: each part at its path inside the
 *  output, and every output it was handed and plan it laid kept, for a test
 *  that asks what a build handed its projection. */
export class InMemoryLocalRepo implements ForManagingLocalOutput {
  readonly charterOutputs: CharterOutput[] = [];
  readonly laidPlans: ProjectionPlan[] = [];
  /** What each place holds, as the last plan laid it or as a test sets it. */
  readonly textByPlace = new Map<string, string>();

  /** The same memory, whichever checkout is asked: the twin holds one folder
   *  and never stands in for a checkout kept apart, so a test proving a
   *  checkout left apart lays through `LocalRepoManipulator`. */
  createCheckoutOutput(): InMemoryLocalRepo {
    return this;
  }

  describeItemPlace(itemPath: string): string {
    return itemPath;
  }

  resolveOutputLinks(laidText: string): string {
    return laidText.replaceAll(outputPath.cwOutFolderPlaceholder, ".");
  }

  async createProjectionPlan(charterOutput: CharterOutput): Promise<ProjectionPlan> {
    this.charterOutputs.push(charterOutput);
    return new ProjectionPlan(
      [],
      [],
      charterOutput.charterOutputItems.map((charterOutputItem) => {
        const { text } = charterOutputItem;
        const path = outputPath.getPath(charterOutputItem);
        const itemPlace = this.describeItemPlace(path);
        return new WritePlan(itemPlace, itemPlace, text, this.textByPlace.get(itemPlace));
      }),
    );
  }

  async writePlan(projectionPlan: ProjectionPlan): Promise<void> {
    this.laidPlans.push(projectionPlan);
    for (const { path, contents } of projectionPlan.writePlans)
      if (typeof contents === "string") this.textByPlace.set(path, contents);
  }

  async readCompiledOutputItem(itemPath: string): Promise<string | undefined> {
    return this.textByPlace.get(this.describeItemPlace(itemPath));
  }
}
