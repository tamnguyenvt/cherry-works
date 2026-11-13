import { buildCharterService } from "../src/module/charter/app/services/build-charter.service.js";
import type { CharterRoot } from "../src/module/charter/domain/models/charter/charter-root.js";
import { Catalogue } from "../src/module/charter/domain/models/charter-output/catalogue.js";
import type { CharterOutput } from "../src/module/charter/domain/models/charter-output/charter-output.js";
import { ProjectionPlan } from "../src/module/charter/domain/models/charter-output/projection-plan.js";
import { InMemoryFileOutput } from "../src/module/shared/infra/in-memory/in-memory-file-output.adapter.js";
import type { InMemoryFileReaders } from "../src/module/shared/infra/in-memory/in-memory-file-readers.adapter.js";
import { agentProjectionByProviderOf, charterOutputWriterOf } from "./use-cases-of.js";

/** Everything one reading of a charter is laid as, at the paths it landed
 *  at: the output and each agent's projection of it planned and then carried
 *  out, which is what a build does with it (FR-021). Nothing is cleaned up
 *  first — a test compiling one charter into empty files has nothing to take
 *  away. */
export async function putDownBy(
  charter: CharterRoot,
  output: CharterOutput,
  held: InMemoryFileReaders,
): Promise<readonly string[]> {
  const localRepo = charterOutputWriterOf(held, new InMemoryFileOutput(held));
  const agentProjectionByProvider = agentProjectionByProviderOf(held);
  const buildPlans = [
    await localRepo.createProjectionPlan(output),
    ...(await Promise.all(
      output.charterOutputItems.flatMap((charterOutputItem) =>
        charterOutputItem instanceof Catalogue && charterOutputItem.agentProvider !== undefined
          ? [
              agentProjectionByProvider[charterOutputItem.agentProvider.name]!.createAgentProjectionPlan(
                charter,
                output,
              ),
            ]
          : [],
      ),
    )),
  ];
  const projectionPlan = buildPlans.flatMap((buildPlan) => buildPlan.writePlans);
  await localRepo.writePlan(
    new ProjectionPlan(
      buildPlans.flatMap((buildPlan) => buildPlan.warnings),
      [],
      projectionPlan,
    ),
  );

  const { addedPaths, editedPaths, unchangedPaths } = buildCharterService.previewPlan([], projectionPlan);
  return [...addedPaths, ...editedPaths, ...unchangedPaths];
}
