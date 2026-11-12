import type { CharterOutput } from "../../../domain/models/charter-output/charter-output.js";
import type { ProjectionPlan } from "../../../domain/models/charter-output/projection-plan.js";

export { AdapterFault, UnbuiltCheckoutAdapterFault } from "../../../../shared/module.js";
export { outputPath } from "../../../domain/constants.js";
/** The models the local files are planned and written in, named again here so
 *  an adapter keeping them imports nothing of the hexagon but its port. */
export type { CharterOutput } from "../../../domain/models/charter-output/charter-output.js";
export { CharterOutputItem } from "../../../domain/models/charter-output/charter-output-item.js";
export { CompiledPrimitive } from "../../../domain/models/charter-output/compiled-primitive.js";
export { McpOrigins } from "../../../domain/models/charter-output/mcp-origin.js";
export { OutputPath } from "../../../domain/models/charter-output/output-path.js";
export { ProjectionPlan, WritePlan } from "../../../domain/models/charter-output/projection-plan.js";
export { StampedDocument } from "../../../domain/models/charter-output/stamped-document.value-object.js";

/**
 * The local files a build checks and writes: it lays a build's output onto a
 * repository, wherever it lays it, and writes every file a build planned: where the output lands is its own to know,
 * never the engine's, which knows an item by its path inside the output, under
 * `$CW_OUT/` (CORE-FR-220, CORE-FR-221). What each agent reads is
 * that agent's projection's, `ForManagingLocalAgentOutput`.
 *
 * What the build laid is read back through the charter's repository,
 * `ForManagingCharter`, never off a path the engine knows (CORE-FR-222).
 */
export interface ForManagingLocalOutput {
  /** The same output, laid onto another checkout of the repository, such as
   *  a worktree, by the folder the checkout was made in, in this adapter's
   *  words. */
  createCheckoutOutput(checkoutFolder: string): ForManagingLocalOutput;

  /**
   * What laying this output would do, decided and not yet done (FR-020,
   * FR-022): each place it would write, with what it would hold and what it
   * holds now, and each place the last build left in the output that this one
   * would take away or write again. Reads, and only reads.
   */
  createProjectionPlan(charterOutput: CharterOutput): Promise<ProjectionPlan>;

  /** That plan carried out, every agent's files in it: what the last build
   *  left taken away, then this one written (FR-020, FR-021). */
  writePlan(projectionPlan: ProjectionPlan): Promise<void>;
}
