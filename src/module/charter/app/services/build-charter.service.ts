import { AgentProvider, type AgentProviderName, DomainFault, type FaultsByFile } from "#module/shared/module.js";
import type { CharterRoot } from "../../domain/models/charter/charter-root.js";
import { UnwrittenBuildFault } from "../../domain/models/charter.fault.js";
import {
  ProjectionPlan,
  ProjectionPlanSummary,
  type WritePlan,
} from "../../domain/models/charter-output/projection-plan.js";
import { CharterOutputService } from "../../domain/services/charter-output.service.js";
import type { ForManagingCharter } from "../port/out/managing-charter.port.js";
import type { ForManagingLocalAgentOutput } from "../port/out/managing-local-agent-output.port.js";
import type { ForManagingLocalOutput } from "../port/out/managing-local-output.port.js";
import { type LoadMcpOriginsService, loadMcpOriginsService, type McpReaching } from "./load-mcp-origins.service.js";

/** Plans, previews and lays what a build of the charter puts down, through
 *  what lays the compiled output and each agent's projection, which know where
 *  each part lands (CORE-FR-221). */
export class BuildCharterService {
  readonly #loadMcpOriginsService: LoadMcpOriginsService;

  constructor(
    /** What it reaches the mcp origins through. */
    loadMcpOriginsService: LoadMcpOriginsService,
  ) {
    this.#loadMcpOriginsService = loadMcpOriginsService;
  }

  /**
   * What a build would do, decided and not yet done (FR-020, FR-021, FR-022).
   *
   * The two halves together, because neither is worth anything alone: what the
   * last build left is only a deletion where this one puts nothing back, and what
   * this one puts down is only a change against what is there. Asked for once and
   * handed to `executePlan` or to `previewPlan`, so a preview and the build after
   * it are looking at one plan rather than at two readings that may have drifted.
   *
   * Reads, and only reads. Which agents the repository chose at setup is what
   * a build lays a surface for, never what happens to be installed on the
   * machine running this (FR-033); one naming none still gets the surface every
   * reader shares (FR-019).
   *
   * What each mcp origin lists is asked of it through `mcpReaching` where
   * `shouldRefreshMcpOrigins` says so, and read off what the last build kept otherwise;
   * an mcp origin that cannot be asked, or lacks a tool declared, is answered as
   * its faults in place of a plan (EVAL-FR-031).
   *
   * What is built is the repository, or a checkout of it such as an
   * evaluation's worktree where the adapters handed were opened at one,
   * nothing of where that root is (CORE-FR-217); where the output lands, and what is there now, is
   * `localRepo`'s, what each agent reads of it is its projection's,
   * under the agent's name in `agentProjectionByProvider`, and what the last build
   * kept is read back through `charterRepository` (CORE-FR-221).
   */
  async planBuild(
    charter: CharterRoot,
    agentProjectionByProvider: Readonly<Record<AgentProviderName, ForManagingLocalAgentOutput>>,
    localRepo: ForManagingLocalOutput,
    charterRepository: Pick<ForManagingCharter, "readCompiledOutputItem" | "describeItemPlace">,
    mcpReaching: McpReaching | undefined,
    { shouldRefreshMcpOrigins }: { readonly shouldRefreshMcpOrigins: boolean },
  ): Promise<ProjectionPlan | FaultsByFile> {
    const { toolsByOriginKey, faultsByFile } = await this.#loadMcpOriginsService.loadToolsByOriginKey(
      charter,
      charterRepository,
      mcpReaching,
      shouldRefreshMcpOrigins,
    );
    if (!faultsByFile.isEmpty) return faultsByFile;

    const charterOutput = CharterOutputService.compileCharterRoot(
      charter,
      Object.keys(agentProjectionByProvider).map((agentName) => new AgentProvider(agentName)),
      toolsByOriginKey,
    );
    const buildPlans = await Promise.all([
      localRepo.createProjectionPlan(charterOutput),
      ...Object.values(agentProjectionByProvider).map((agentProjection) =>
        agentProjection.createAgentProjectionPlan(charter, charterOutput),
      ),
    ]);
    return new ProjectionPlan(
      buildPlans.flatMap((buildPlan) => buildPlan.warnings),
      buildPlans.flatMap((buildPlan) => buildPlan.cleanupPlan),
      buildPlans.flatMap((buildPlan) => buildPlan.writePlans),
    );
  }

  /**
   * What running the two plans would come to, and nothing done (FR-022).
   *
   * Read off the plans and nothing else: the projection carries what each file
   * would hold and what it holds now, and the cleanup carries what the engine owns
   * on disk. A file both plans name is one this build writes again rather than one
   * it takes away.
   *
   * A file already holding byte for byte what the build compiles to is unchanged,
   * which is the whole of the question a preview asks: a repository where every
   * file is unchanged is one that is fully built (SC-007).
   */
  previewPlan(
    cleanupPlan: readonly WritePlan[],
    projectionPlan: readonly WritePlan[],
    warnings: readonly string[] = [],
  ): ProjectionPlanSummary {
    return new ProjectionPlanSummary(
      projectionPlan.filter((writePlan) => writePlan.heldContents === undefined).map((writePlan) => writePlan.path),
      projectionPlan
        .filter((writePlan) => writePlan.heldContents !== undefined && !this.#isUnchanged(writePlan))
        .map((writePlan) => writePlan.path),
      cleanupPlan
        .filter((cleanupFile) => !projectionPlan.some((projectionFile) => projectionFile.path === cleanupFile.path))
        .map((cleanupFile) => cleanupFile.path),
      projectionPlan.filter((writePlan) => this.#isUnchanged(writePlan)).map((writePlan) => writePlan.path),
      warnings,
    );
  }

  /**
   * The two plans, carried out by the projection that made them (FR-020,
   * FR-021).
   *
   * It says nothing about what it did: `previewPlan` reads that off the same two
   * plans, and a caller wanting both asks for the preview and then runs it — so
   * what a user was told a build would do is what the build reports having done.
   *
   * A file that cannot be written or taken away is a fault naming it: the disk
   * refusing is not something a caller can read out of a list of paths.
   */
  async executePlan(buildPlan: ProjectionPlan, localRepo: ForManagingLocalOutput): Promise<void> {
    try {
      await localRepo.writePlan(buildPlan);
    } catch (raisedValue) {
      // What the disk said, said as a fault with the next move on it: a caller
      // reading a list of paths has nowhere to learn that one of them refused
      // (SC-003). Only a fault the writer meant for the person is said so; any
      // other is the system's, logged and never said (SDK-FR-017, SDK-FR-018).
      if (!(raisedValue instanceof DomainFault) || raisedValue.internal) throw raisedValue;
      throw new UnwrittenBuildFault(
        `This build could not be written: ${raisedValue.message}`,
        "Check that the files this build writes can be written, then build again.",
        { cause: raisedValue, internal: false },
      );
    }
  }

  /** Whether a planned file already holds what the build would leave in it: text
   *  by its text, a copy byte for byte (CORE-FR-207). */
  #isUnchanged(writePlan: WritePlan): boolean {
    const heldContents = writePlan.heldContents;
    const plannedContents = writePlan.contents;
    if (
      typeof heldContents === "string" ||
      typeof plannedContents === "string" ||
      heldContents === undefined ||
      plannedContents === undefined
    )
      return heldContents === plannedContents;
    return (
      heldContents.length === plannedContents.length &&
      heldContents.every((heldByte, byteIndex) => heldByte === plannedContents[byteIndex])
    );
  }
}

/** The one BuildCharterService the composition root hands every use case that asks for it. */
export const buildCharterService = new BuildCharterService(loadMcpOriginsService);
