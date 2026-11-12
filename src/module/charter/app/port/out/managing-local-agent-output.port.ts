import type { CharterRoot } from "../../../domain/models/charter/charter-root.js";
import type { CharterOutput } from "../../../domain/models/charter-output/charter-output.js";
import type { ProjectionPlan } from "../../../domain/models/charter-output/projection-plan.js";
import type { MainContextText } from "../../../domain/models/context/main-context.js";

export { AgentProvider } from "#module/shared/module.js";
export { AdapterFault, UnbuiltCheckoutAdapterFault } from "../../../../shared/module.js";
export { CHARTER_FOLDER_PATH, outputPath } from "../../../domain/constants.js";
export { ModelHelper } from "../../../domain/helper.js";
/** How a TOML file the charter shares with the repository is written into. */
export { mergeTomlText } from "../../../domain/libs/toml.lib.js";
export { DocumentBasedComponent } from "../../../domain/models/agent/document-based-component.js";
export { ProviderComponent } from "../../../domain/models/agent/provider-component.js";
export { SettingBasedComponent } from "../../../domain/models/agent/setting-based-component.js";
/** The models an agent's projection reads and answers in, named again here so
 *  an adapter projecting a charter onto an agent imports nothing of the
 *  hexagon but its port. */
export type { CharterRoot } from "../../../domain/models/charter/charter-root.js";
export { BuiltSensors } from "../../../domain/models/charter-output/built-sensor.js";
export { Catalogue } from "../../../domain/models/charter-output/catalogue.js";
export { CharterMd } from "../../../domain/models/charter-output/charter-md.js";
export type { CharterOutput } from "../../../domain/models/charter-output/charter-output.js";
export { CharterOutputItem } from "../../../domain/models/charter-output/charter-output-item.js";
export { CompiledPrimitive } from "../../../domain/models/charter-output/compiled-primitive.js";
export { McpOrigins } from "../../../domain/models/charter-output/mcp-origin.js";
export { ProjectionPlan, WritePlan } from "../../../domain/models/charter-output/projection-plan.js";
export { StampedDocumentSpec } from "../../../domain/models/charter-output/stamped-document.specification.js";
export { StampedDocument } from "../../../domain/models/charter-output/stamped-document.value-object.js";
export type { MainContextText } from "../../../domain/models/context/main-context.js";
export { AgentPrimitive } from "../../../domain/models/primitive/agent-primitive.js";
export { BasePrimitive } from "../../../domain/models/primitive/base-primitive.js";
export { GuidePrimitive } from "../../../domain/models/primitive/guide-primitive.js";
export { McpPrimitive } from "../../../domain/models/primitive/mcp-primitive.js";
export { PlaybookPrimitive } from "../../../domain/models/primitive/playbook-primitive.js";
export { PosturePrimitive } from "../../../domain/models/primitive/posture-primitive.js";
export type { Primitive } from "../../../domain/models/primitive/primitive.js";
export { SensorPrimitive } from "../../../domain/models/primitive/sensor-primitive.js";
export { SkillPrimitive } from "../../../domain/models/primitive/skill-primitive.js";

/**
 * DRIVEN PORT — what one agent reads of a charter, and where: the files it
 * reads and how each goes over what is there, its own links in them, and
 * what of them it holds in its main context (FR-018, CORE-FR-221). The engine
 * hands it the charter and what the charter compiles to, whose paths are
 * under `$CW_OUT/`, and knows no agent: one is taught to the engine by
 * handing its application one more of these, under the agent's name.
 */
export interface ForManagingLocalAgentOutput {
  /** The same agent's files, laid onto another checkout of the repository,
   *  such as a worktree, by the folder the checkout was made in, in this
   *  adapter's words. */
  createCheckoutProjection(checkoutFolder: string): ForManagingLocalAgentOutput;

  /**
   * What laying this agent's files would do, decided and not yet done
   * (FR-020, FR-022): each place it would write, with what it would hold and
   * what it holds now, each place the last build left for it that this one
   * would take away or write again, and what it could not lay as the charter
   * says. Reads, and only reads.
   */
  createAgentProjectionPlan(charter: CharterRoot, charterOutput: CharterOutput): Promise<ProjectionPlan>;

  /** What this agent puts into its main context of the charter, each text as
   *  it lays it (EVAL-FR-001, EVAL-FR-003). */
  listMainContextTexts(charter: CharterRoot, charterOutput: CharterOutput): readonly MainContextText[];

  /** How many of this agent's tokens one token of the tokenizer on this
   *  machine stands for: what an estimate is scaled by (EVAL-SC-002). */
  readonly tokenFactor: number;
}
