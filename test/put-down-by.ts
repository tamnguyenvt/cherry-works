import type { CharterOutput } from "../src/hexagon/domain/models/output/CharterOutput.js";
import { executePlan, planForProjection, previewPlan } from "../src/hexagon/service/buildService.js";
import { InMemoryFileOutput } from "../src/zdriven/InMemoryFileOutput.js";
import type { InMemoryFileReaders } from "../src/zdriven/InMemoryFileReaders.js";

/** Everything one reading of a charter is put down as, at the paths it landed
 *  at: the projection planned and then carried out, which is what a build does
 *  with it (FR-021). Nothing is cleaned up first — a test compiling one charter
 *  into empty files has nothing to take away. */
export async function putDownBy(repo: URL, output: CharterOutput, held: InMemoryFileReaders): Promise<readonly string[]> {
  const projectionPlan = await planForProjection(repo, output, held);
  await executePlan([], projectionPlan, new InMemoryFileOutput(held));

  const { added, edited, unchanged } = previewPlan([], projectionPlan);
  return [...added, ...edited, ...unchanged];
}
