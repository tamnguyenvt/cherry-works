import { ProjectionPlan, WritePlan, type CharterOutput, type ForManagingLocalOutput, type OutputPart } from "../../app/port/out/managing-local-output.port.js";

/** A compiled charter laid in memory: each part at its path inside the
 *  output, and every output it was handed and plan it laid kept, for a test
 *  that asks what a build handed its projection. */
export class InMemoryLocalRepo implements ForManagingLocalOutput {
  readonly charterOutputs: CharterOutput[] = [];
  readonly laidPlans: ProjectionPlan[] = [];
  /** What each place holds, as the last plan laid it or as a test sets it. */
  readonly textByPlace = new Map<string, string>();

  findPlace(outputPart: OutputPart): string {
    return outputPart.path;
  }

  findOutputFolder(): string {
    return ".";
  }

  async createProjectionPlan(charterOutput: CharterOutput): Promise<ProjectionPlan> {
    this.charterOutputs.push(charterOutput);
    return new ProjectionPlan(
      [],
      [],
      charterOutput.compiledParts.map(({ outputPart, text }) => {
        const place = this.findPlace(outputPart);
        return new WritePlan(place, place, text, this.textByPlace.get(place));
      }),
    );
  }

  async writePlan(buildPlan: ProjectionPlan): Promise<void> {
    this.laidPlans.push(buildPlan);
    for (const { path, contents } of buildPlan.projectionPlan) if (typeof contents === "string") this.textByPlace.set(path, contents);
  }

  async loadLaidText(outputPart: OutputPart): Promise<string | undefined> {
    return this.textByPlace.get(this.findPlace(outputPart));
  }
}
