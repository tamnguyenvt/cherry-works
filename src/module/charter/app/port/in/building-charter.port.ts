import type { AgentProviderName } from "#module/shared/module.js";
import type { FaultDTOs } from "../../../../shared/module.js";
import type { CharterDTOs } from "./charter.dto.js";

/*
 * What a driver reads or says beside the DTOs themselves, named again here: a
 * driver names this port and nothing behind it, and dependency-cruiser refuses
 * it anything else.
 */

/** An agent a charter is compiled for, by the name a driver writes it with:
 *  one of the names the projections the engine was composed with answer to. */
export type { AgentProviderName };

/** What a repository configured itself with that a projection is built for,
 *  handed by whoever composes it, which keeps it (CORE-FR-231). */
export interface ProjectionSettings {
  /** Which agents this repository compiles its charter for (FR-033). None is
   *  a repository that compiles for none and still gets the neutral surface
   *  (FR-019). */
  readonly agents: readonly string[];
  /** The tokens past which the health check warns of the main context a
   *  session opens with (EVAL-FR-006); none is 20,000. */
  readonly mainContextCeiling?: number;
}

/**
 * DRIVER PORT — projecting the charter: the charter charter authoring keeps,
 * built and laid onto each agent the repository uses; the build and
 * its preview, the health check, the estimated main context, and what the
 * last build laid to be served or run — the tools of the mcp origins, the
 * sensors (CORE-FR-222). Runtime asks it, through this port alone, for the
 * mcp origins, the sensors of a signal, a build into a working copy, what an
 * agent is sent when a session opens, and an evaluation's cases
 * (CORE-FR-229).
 *
 * Which agents it builds for is what it was composed with, never what it reads
 * (CORE-FR-231). Every answer is a DTO, told apart from the others it may be
 * by its `type`; whatever stops an operation is among them, a
 * `FaultDTOs.Fault`, and never thrown (SDK-FR-004, SDK-FR-017, SDK-FR-018).
 */
export interface ForBuildingCharter {
  /**
   * The three questions about this repository, asked in one go (FR-040): which
   * agents it compiles for, what validating its charter finds — its test files'
   * findings among it — and how many files a build would still change, with
   * the main context each agent opens with, estimated. Reads and says
   * (FR-041).
   */
  diagnoseCharter(): Promise<CharterDTOs.DoctorOutcome | FaultDTOs.Fault>;

  /** What each agent this repository compiles for is sent of the charter when
   *  a session opens, estimated by a tokenizer on this machine (EVAL-FR-001,
   *  EVAL-FR-002). Reads and says (FR-041). */
  predictMainContext(): Promise<CharterDTOs.MainContexts | FaultDTOs.FaultsByFile | FaultDTOs.Fault>;

  /**
   * One reading of the charter, put on disk (FR-020, FR-021): a charter with
   * an error is refused before anything is touched, with its errors given back
   * (FR-005, FR-009); an mcp origin that cannot be asked for its tools stops it
   * as an error does (EVAL-FR-031).
   */
  buildCharter(): Promise<CharterDTOs.PlanSummary | FaultDTOs.FaultsByFile | FaultDTOs.Fault>;

  /** The build, worked out and stopped short of disk (FR-022). */
  previewCharterBuild(): Promise<CharterDTOs.PlanSummary | FaultDTOs.FaultsByFile | FaultDTOs.Fault>;

  /** Every tool the mcp origins the last build listed serve, read off what it
   *  kept there: no mcp origin is reached to list them (EVAL-FR-031). */
  listServedTools(): Promise<CharterDTOs.ServedTools | FaultDTOs.Fault>;

  /** Every tool the mcp origins the last build listed declare, under the name
   *  it is served by, with the mcp origin a call to it is forwarded to
   *  (FR-152 – FR-154). */
  listDeclaredTools(): Promise<CharterDTOs.DeclaredTools | FaultDTOs.Fault>;

  /** The commands the last build laid for this signal of this agent
   *  (CORE-FR-176). */
  listSensorCommands(
    signal: string,
    agentProviderName: AgentProviderName,
  ): Promise<CharterDTOs.SensorCommands | FaultDTOs.Fault>;

  /** The charter as the store holds it now, committed or not, built into the
   *  checkout `checkoutPath` names for the agents this was composed with,
   *  keeping the tools the last build kept; the repository's own working tree
   *  is left as it was (EVAL-FR-021). */
  buildCharterInto(checkoutPath: string): Promise<CharterDTOs.PlanSummary | FaultDTOs.FaultsByFile | FaultDTOs.Fault>;

  /** What each agent this repository compiles for is sent of the charter when
   *  a session opens, each text as the build lays it, for an exact count
   *  (EVAL-FR-004). */
  readMainContextTexts(): Promise<CharterDTOs.MainContextTexts | FaultDTOs.FaultsByFile | FaultDTOs.Fault>;

  /** Every evaluation case the store holds now, committed or not, checked
   *  against the charter it holds: a charter with an error, a file that does not read,
   *  or a case naming a skill or a guide the charter does not hold, is answered
   *  as faults under their files (EVAL-FR-026). */
  listEvalCases(): Promise<CharterDTOs.EvalCases | FaultDTOs.FaultsByFile | FaultDTOs.Fault>;
}
