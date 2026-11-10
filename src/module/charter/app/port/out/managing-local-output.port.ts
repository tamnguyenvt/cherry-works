import type { CharterOutput } from "../../../domain/models/projection/charter-output.js";
import type { ProjectionPlan } from "../../../domain/models/projection/projection-plan.js";

/** The models the local files are planned and written in, named again here so
 *  an adapter keeping them imports nothing of the hexagon but its port. */
export type { CharterOutput, CompiledPart } from "../../../domain/models/projection/charter-output.js";
export { ProjectionPlan, WritePlan } from "../../../domain/models/projection/projection-plan.js";
export { OutputPart } from "../../../domain/models/projection/output-part.js";
export { McpOrigins } from "../../../domain/models/projection/mcp-origin.js";
export { StampedDocument } from "../../../domain/models/projection/stamped-document.js";
export { AdapterFault } from "../../../../shared/module.js";

/**
 * The local files a build checks and writes: it lays a build's output onto a
 * repository, wherever it lays it, and writes every file a build planned: where the output lands is its own to know,
 * never the engine's, which knows a part by its path inside the output, under
 * `$CW_OUT/` (CORE-FR-220, CORE-FR-221). What each agent reads is
 * that agent's projection's, `ForManagingLocalAgentOutput`.
 *
 * What the build laid is read back through the charter's repository,
 * `ForManagingCharter`, never off a path the engine knows (CORE-FR-222).
 */
export interface ForManagingLocalOutput {
  /**
   * What laying this output would do, decided and not yet done (FR-020,
   * FR-022): each place it would write, with what it would hold and what it
   * holds now, and each place the last build left in the output that this one
   * would take away or write again. Reads, and only reads. Under
   * `checkoutPath`, a checkout of the repository such as a worktree, where one
   * is named.
   */
  createProjectionPlan(charterOutput: CharterOutput, checkoutPath?: string): Promise<ProjectionPlan>;

  /** That plan carried out, every agent's files in it: what the last build
   *  left taken away, then this one written (FR-020, FR-021). */
  writePlan(plan: ProjectionPlan): Promise<void>;
}
