import type { CharterRoot } from "../../../domain/models/charter/charter-root.js";
import type { MainContextText } from "../../../domain/models/context/main-context.js";
import type { CharterOutput } from "../../../domain/models/projection/charter-output.js";
import type { ProjectionPlan } from "../../../domain/models/projection/projection-plan.js";

export { AdapterFault } from "../../../../shared/module.js";
export { ModelHelper } from "../../../domain/helper.js";
/** How a TOML file the charter shares with the repository is written into. */
export { mergedTomlText } from "../../../domain/libs/toml.lib.js";
export { AgentProvider } from "../../../domain/models/agent/agent-provider.js";
export { DocumentBasedComponent } from "../../../domain/models/agent/document-based-component.js";
export { ProviderComponent } from "../../../domain/models/agent/provider-component.js";
export { SettingBasedComponent } from "../../../domain/models/agent/setting-based-component.js";
export { CharterFolder } from "../../../domain/models/charter/charter-folder.js";
/** The models an agent's projection reads and answers in, named again here so
 *  an adapter projecting a charter onto an agent imports nothing of the
 *  hexagon but its port. */
export type { CharterRoot } from "../../../domain/models/charter/charter-root.js";
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
export { BuiltSensors } from "../../../domain/models/projection/built-sensor.js";
export { Catalogue } from "../../../domain/models/projection/catalogue.js";
export { CharterMd } from "../../../domain/models/projection/charter-md.js";
export type { CharterOutput } from "../../../domain/models/projection/charter-output.js";
export { CompiledPrimitive } from "../../../domain/models/projection/compiled-primitive.js";
export { OutputPart } from "../../../domain/models/projection/output-part.js";
export { ProjectionPlan, WritePlan } from "../../../domain/models/projection/projection-plan.js";
export { StampedDocument } from "../../../domain/models/projection/stamped-document.js";

/**
 * DRIVEN PORT — what one agent reads of a charter, and where: the files it
 * reads and how each goes over what is there, its own links in them, and
 * what of them it holds in its main context (FR-018, CORE-FR-221). The engine
 * hands it the charter and what the charter compiles to, whose paths are
 * under `$CW_OUT/`, and knows no agent: one is taught to the engine by
 * handing its application one more of these, under the agent's name.
 */
export interface ForManagingLocalAgentOutput {
  /**
   * What laying this agent's files would do, decided and not yet done
   * (FR-020, FR-022): each place it would write, with what it would hold and
   * what it holds now, each place the last build left for it that this one
   * would take away or write again, and what it could not lay as the charter
   * says. Reads, and only reads. Under `checkoutPath`, a checkout of the
   * repository such as a worktree, where one is named.
   */
  createAgentProjectionPlan(
    charter: CharterRoot,
    charterOutput: CharterOutput,
    checkoutPath?: string,
  ): Promise<ProjectionPlan>;

  /** What this agent puts into its main context of the charter, each text as
   *  it lays it (EVAL-FR-001, EVAL-FR-003). */
  mainContextTextsOf(charter: CharterRoot, charterOutput: CharterOutput): readonly MainContextText[];

  /** How many of this agent's tokens one token of the tokenizer on this
   *  machine stands for: what an estimate is scaled by (EVAL-SC-002). */
  readonly tokenFactor: number;
}
