import {
  AgentProvider,
  ApplicationService,
  type FaultDTOs,
  FaultsByFile,
  type ForCallingMcpServers,
  type ForReportingProgress,
} from "#module/shared/module.js";
import { outputPath } from "../domain/constants.js";
import type { CharterRoot } from "../domain/models/charter/charter-root.js";
import { UncompiledAgentFault } from "../domain/models/charter.fault.js";
import { BuiltSensorsFactory } from "../domain/models/charter-output/built-sensors.factory.js";
import type { McpOrigin } from "../domain/models/charter-output/mcp-origin.js";
import type { ProjectionPlanSummary } from "../domain/models/charter-output/projection-plan.js";
import { MainContext, MainContextLoad, type MainContextText } from "../domain/models/context/main-context.js";
import { EvalRootFactory } from "../domain/models/eval/eval-root.factory.js";
import { McpPrimitive } from "../domain/models/primitive/mcp-primitive.js";
import { PrimitiveLayer } from "../domain/models/primitive/primitive-layer.value-object.js";
import { TestRootFactory } from "../domain/models/test/test-root.factory.js";
import { CompileService } from "../domain/services/compile.service.js";
import { EvalService } from "../domain/services/eval.service.js";
import { TestService } from "../domain/services/test.service.js";
import type { ForAuthoringCharter } from "./port/in/authoring-charter.port.js";
import type { AgentProviderName, ForBuildingCharter, ProjectionSettings } from "./port/in/building-charter.port.js";
import { CharterDTOs } from "./port/in/charter.dto.js";
import type { ForCountingTokens } from "./port/out/counting-tokens.port.js";
import type { ForManagingCharter } from "./port/out/managing-charter.port.js";
import type { ForManagingLocalAgentOutput } from "./port/out/managing-local-agent-output.port.js";
import type { ForManagingLocalOutput } from "./port/out/managing-local-output.port.js";
import type { BuildCharterService } from "./services/build-charter.service.js";
import type { LoadCharterService } from "./services/load-charter.service.js";
import type { LoadMcpOriginsService, McpReaching } from "./services/load-mcp-origins.service.js";

/** One tool an mcp declares, under the name it is served by: the mcp origin it is
 *  at, the id declaring it, and its name there. */
interface DeclaredTool {
  readonly origin: McpOrigin;
  readonly id: string;
  readonly tool: string;
  readonly servedName: string;
}

/**
 * APPLICATION SERVICE — projecting the charter: the charter this module keeps,
 * built and laid onto each agent provider the repository was composed for;
 * the build and its preview, the health check, the estimated main context,
 * and what the last build laid to be served or run — the mcp origins' tools,
 * the sensors (CORE-FR-222). What runtime asks of it is answered here in DTOs
 * (CORE-FR-229).
 *
 * Which agents it builds for, and the ceiling of a main context, it is handed
 * when it is composed, by whoever keeps them (CORE-FR-231). Every use case
 * here is the same two steps: read the charter, then ask it, or read what the
 * last build laid through what laid it. What it answers a driver with is the
 * DTO its schema makes of what the domain handed back; whatever an operation
 * raises is answered as a `FaultDTOs.Fault` (SDK-FR-004).
 */
export class BuildingCharter extends ApplicationService implements ForBuildingCharter {
  readonly #buildCharterService: BuildCharterService;
  readonly #loadCharterService: LoadCharterService;
  readonly #loadMcpOriginsService: LoadMcpOriginsService;
  readonly #charterRepository: Pick<
    ForManagingCharter,
    | "loadCharter"
    | "describeCharterPlace"
    | "loadTestSuites"
    | "loadEvalSuites"
    | "readCompiledOutputItem"
    | "describeItemPlace"
    | "resolveOutputLinks"
  >;
  readonly #localRepo: ForManagingLocalOutput;
  readonly #agentProjectionByProvider: Readonly<Record<AgentProviderName, ForManagingLocalAgentOutput>>;
  readonly #tokenCounter: ForCountingTokens;
  readonly #agents: readonly AgentProvider[];
  readonly #mainContextCeiling: number;
  readonly #mcpReaching: McpReaching | undefined;

  constructor(
    /** How a build is planned, previewed and written. */
    buildCharterService: BuildCharterService,
    /** How the repository's charter is read off its layers. */
    loadCharterService: LoadCharterService,
    /** How the mcp origins a build kept, and their tools, are read. */
    loadMcpOriginsService: LoadMcpOriginsService,
    /** Where the charter, its test cases and its eval cases are read
     *  (CORE-FR-228); handed alone, since projecting writes none of them. */
    charterRepository: Pick<
      ForManagingCharter,
      | "loadCharter"
      | "describeCharterPlace"
      | "loadTestSuites"
      | "loadEvalSuites"
      | "readCompiledOutputItem"
      | "describeItemPlace"
      | "resolveOutputLinks"
    >,
    /** What lays the compiled output onto the repository, deciding where it
     *  lands, and writes every file a build planned (CORE-FR-221). */
    localRepo: ForManagingLocalOutput,
    /** What each agent reads of a charter, and where, under the agent's name:
     *  the agents a repository may compile for are these names, and teaching
     *  the engine an agent is one more of them (FR-018, CORE-FR-221). */
    agentProjectionByProvider: Readonly<Record<AgentProviderName, ForManagingLocalAgentOutput>>,
    /** What a main context is estimated by, on this machine (EVAL-FR-001). */
    tokenCounter: ForCountingTokens,
    /** Which agents the repository compiles for, and its context ceiling, as
     *  whoever composes this keeps them (CORE-FR-231). */
    projectionSettings: ProjectionSettings,
    /** Where an internal fault is logged for whoever runs the system, before
     *  the caller is answered in the system's own words (SDK-FR-017). */
    progressReporter: ForReportingProgress,
    /** Charter authoring's application, which keeps the developer's
     *  credential to each mcp origin and renews it. */
    charterAuthoringApp?: Pick<ForAuthoringCharter, "getAccessToken">,
    /** The mcp origins' MCP servers: what a build asks each mcp origin for its
     *  tools with, and stops where one cannot be asked (EVAL-FR-031). Without
     *  them, a build keeps the tools the last one kept. */
    mcpServers?: ForCallingMcpServers,
  ) {
    super(progressReporter);
    this.#buildCharterService = buildCharterService;
    this.#loadCharterService = loadCharterService;
    this.#loadMcpOriginsService = loadMcpOriginsService;
    this.#charterRepository = charterRepository;
    this.#localRepo = localRepo;
    this.#agentProjectionByProvider = agentProjectionByProvider;
    this.#tokenCounter = tokenCounter;
    this.#agents = projectionSettings.agents.map((agentName) => this.#findAgentProvider(agentName));
    this.#mainContextCeiling = projectionSettings.mainContextCeiling ?? MainContext.defaultCeiling;
    this.#mcpReaching =
      mcpServers === undefined || charterAuthoringApp === undefined
        ? undefined
        : {
            mcpServers,
            loadAccessToken: async (origin, isRefused) =>
              this.answeredDTOOf(
                await charterAuthoringApp.getAccessToken(
                  {
                    address: origin.address,
                    ...(origin.endpoint === undefined ? {} : { endpoint: origin.endpoint }),
                    mcpId: origin.ids[0] ?? "",
                  },
                  isRefused,
                ),
              ).data.accessToken,
          };
  }

  /**
   * The three questions about this repository, asked in one go (FR-040): which
   * agents it compiles for, what validating its charter finds, and how many of
   * those are unwell.
   *
   * Where the charter holds, what a build would still change is the preview run
   * for it, and every guide and sensor no test case names is a warning too, so
   * the test files are read here: a file that will not read names no case, and
   * `cw test` is what refuses it (FR-014). Where it does not hold, nothing is
   * previewed (FR-005, FR-009).
   *
   * The warnings under the vendors are left out before anything is counted,
   * so the summary line and the faults below it say one thing: a vendor is
   * tested and checked in its own repository. Its errors stay, since they stop
   * the build here.
   */
  async diagnoseCharter(): Promise<CharterDTOs.DoctorOutcome | FaultDTOs.Fault> {
    return this.answerWithFaultDTO("BuildingCharter.diagnoseCharter", async () => {
      const [charter, testRoot] = await Promise.all([
        this.#loadCharterService.loadCharterRoot(this.#charterRepository),
        this.#charterRepository.loadTestSuites().then(TestRootFactory.create),
      ]);
      const charterFaultsByFile = this.#collectCharterFaults(charter);
      const isHolding = charterFaultsByFile.filterErrors().isEmpty;
      const allFaultsByFile = isHolding
        ? charterFaultsByFile.mergeWith(TestService.validateTestRoot(charter, testRoot))
        : charterFaultsByFile;
      const primitiveLayerByUri = charter.primitiveLayerByUri;
      const heardFaultsByFile = new FaultsByFile(
        Object.fromEntries(
          Object.entries(allFaultsByFile.faultsByFilePath)
            .map(
              ([filePath, faults]) =>
                [
                  filePath,
                  primitiveLayerByUri[filePath]?.name === PrimitiveLayer.vendorName
                    ? faults.filter((fault) => fault.severity !== "warn")
                    : faults,
                ] as const,
            )
            .filter(([, faults]) => faults.length > 0),
        ),
      );
      // A charter that does not hold is previewed for nothing: how many files a
      // build would still change cannot be known, and is `null`. Asked often, so
      // no mcp origin is reached: what the last build kept is what a build would
      // keep where nothing changed there.
      const doctorPlan = isHolding
        ? await this.#buildCharterService.planBuild(
            charter,
            this.#chosenAgentProjectionByProvider,
            this.#localRepo,
            this.#charterRepository,
            this.#mcpReaching,
            { shouldRefreshMcpOrigins: false },
          )
        : undefined;
      const planSummary =
        doctorPlan === undefined || doctorPlan instanceof FaultsByFile
          ? undefined
          : this.#buildCharterService.previewPlan(doctorPlan.cleanupPlan, doctorPlan.writePlans);
      const mainContexts = isHolding ? this.#agents.map((agent) => this.#estimateMainContext(charter, agent)) : [];

      // A repository compiling for no agent is well — the neutral surface is
      // compiled for everybody (FR-019) — and the other two questions are
      // unwell with an error in the charter, or a build still to run or one
      // that cannot be known. A main context past the ceiling is a warning
      // rather than a question unwell (EVAL-FR-006).
      const faultsByFileDTO = this.faultsByFileDTOOf(heardFaultsByFile);
      const faults = Object.values(faultsByFileDTO.data.files)
        .flat()
        .map(({ data: faultData }) => faultData);
      const errorCount = faults.filter((fault) => fault.severity === "error").length;
      const pendingCount =
        planSummary === undefined
          ? null
          : planSummary.addedPaths.length + planSummary.editedPaths.length + planSummary.deletedPaths.length;
      return CharterDTOs.DoctorOutcome.of({
        agents: this.#agents.map((agent) => agent.name),
        errorCount,
        warnCount: faults.filter((fault) => fault.severity === "warn").length,
        pendingCount,
        faultsByFile: faultsByFileDTO,
        problemCount: [errorCount > 0, pendingCount !== 0].filter(Boolean).length,
        mainContexts: mainContexts.map((mainContext) => ({
          agent: mainContext.agent.name,
          totalTokens: mainContext.totalTokens,
        })),
        mainContextCeiling: this.#mainContextCeiling,
      });
    });
  }

  async predictMainContext(): Promise<CharterDTOs.MainContexts | FaultDTOs.FaultsByFile | FaultDTOs.Fault> {
    return this.answerWithFaultDTO("BuildingCharter.predictMainContext", async () => {
      const charter = await this.#loadHoldingCharter();
      if (charter instanceof FaultsByFile) return this.faultsByFileDTOOf(charter);
      return CharterDTOs.MainContexts.of({
        contexts: this.#agents.map((agent) => {
          const mainContext = this.#estimateMainContext(charter, agent);
          return CharterDTOs.MainContext.of({
            agent: mainContext.agent.name,
            isExact: mainContext.isExact,
            sessionLoads: mainContext.sessionLoads.map(this.#mainContextLoadDTOOf),
            fileLoads: mainContext.fileLoads.map(this.#mainContextLoadDTOOf),
            totalTokens: mainContext.totalTokens,
          });
        }),
      });
    });
  }

  /**
   * One reading of the charter, put on disk (FR-020, FR-021).
   *
   * Read, ask what is wrong, take away what the last build left, then compile and
   * write. A charter with an error is refused before anything is touched, so a
   * half-built surface never stands — and a warning is not an error (FR-005,
   * FR-009). Which agents are compiled for is what this was composed with,
   * never what happens to be installed on the machine running this (FR-033).
   */
  async buildCharter(): Promise<CharterDTOs.ProjectionPlanSummary | FaultDTOs.FaultsByFile | FaultDTOs.Fault> {
    return this.answerWithFaultDTO("BuildingCharter.buildCharter", async () => {
      const charter = await this.#loadHoldingCharter();
      if (charter instanceof FaultsByFile) return this.faultsByFileDTOOf(charter);

      // An mcp origin that cannot be asked for its tools, or lacks one declared,
      // stops the build as an error in the charter does (EVAL-FR-031).
      const buildProjectionPlan = await this.#buildCharterService.planBuild(
        charter,
        this.#chosenAgentProjectionByProvider,
        this.#localRepo,
        this.#charterRepository,
        this.#mcpReaching,
        { shouldRefreshMcpOrigins: true },
      );
      if (buildProjectionPlan instanceof FaultsByFile) return this.faultsByFileDTOOf(buildProjectionPlan);

      // What it will have done, read off the plans before anything moves: a build
      // says the same thing a preview of it said (FR-022).
      const planSummary = this.#buildCharterService.previewPlan(
        buildProjectionPlan.cleanupPlan,
        buildProjectionPlan.writePlans,
        buildProjectionPlan.warnings,
      );
      await this.#buildCharterService.executePlan(buildProjectionPlan, this.#localRepo);
      return this.#planSummaryDTOOf(planSummary);
    });
  }

  /** The same two plans a build carries out, read rather than run (FR-022). */
  async previewCharterBuild(): Promise<CharterDTOs.ProjectionPlanSummary | FaultDTOs.FaultsByFile | FaultDTOs.Fault> {
    return this.answerWithFaultDTO("BuildingCharter.previewCharterBuild", async () => {
      const charter = await this.#loadHoldingCharter();
      if (charter instanceof FaultsByFile) return this.faultsByFileDTOOf(charter);

      const buildProjectionPlan = await this.#buildCharterService.planBuild(
        charter,
        this.#chosenAgentProjectionByProvider,
        this.#localRepo,
        this.#charterRepository,
        this.#mcpReaching,
        { shouldRefreshMcpOrigins: true },
      );
      if (buildProjectionPlan instanceof FaultsByFile) return this.faultsByFileDTOOf(buildProjectionPlan);
      return this.#planSummaryDTOOf(
        this.#buildCharterService.previewPlan(
          buildProjectionPlan.cleanupPlan,
          buildProjectionPlan.writePlans,
          buildProjectionPlan.warnings,
        ),
      );
    });
  }

  async listServedTools(): Promise<CharterDTOs.ServedTools | FaultDTOs.Fault> {
    return this.answerWithFaultDTO("BuildingCharter.listServedTools", async () => {
      const { declaredTools, problems } = await this.#loadDeclaredTools();
      const servedTools: CharterDTOs.ServedTool[] = [];
      for (const { origin, id, tool, servedName } of declaredTools) {
        const keptTool = origin.tools?.find(({ name }) => name === tool);
        if (keptTool === undefined) {
          problems.push(
            `${id} declares "${tool}", which ${this.#charterRepository.describeItemPlace(outputPath.mcpOriginsFileName)} does not hold; it is not served. Run "cw build" again.`,
          );
          continue;
        }
        const mcpOriginName = origin.path === undefined ? id : `${id} — ${origin.path}`;
        servedTools.push(
          CharterDTOs.ServedTool.of({
            name: servedName,
            description: `[${mcpOriginName}] ${keptTool.description}`.trimEnd(),
            inputSchema: keptTool.inputSchema,
          }),
        );
      }
      // Sorted by name, with what kept the others from being served (FR-152).
      return CharterDTOs.ServedTools.of({
        tools: servedTools.sort((leftTool, rightTool) => leftTool.data.name.localeCompare(rightTool.data.name)),
        problems,
      });
    });
  }

  async listDeclaredTools(): Promise<CharterDTOs.DeclaredTools | FaultDTOs.Fault> {
    return this.answerWithFaultDTO("BuildingCharter.listDeclaredTools", async () => {
      const { declaredTools, problems } = await this.#loadDeclaredTools();
      return CharterDTOs.DeclaredTools.of({
        tools: declaredTools.map(({ origin, id, tool, servedName }) =>
          CharterDTOs.DeclaredTool.of({
            servedName,
            tool,
            mcpId: id,
            origin: {
              address: origin.address,
              ...(origin.endpoint === undefined ? {} : { endpoint: origin.endpoint }),
              ...(origin.command === undefined ? {} : { command: origin.command }),
              ...(origin.path === undefined ? {} : { path: origin.path }),
              auth: origin.auth.map((authMethod) => authMethod.name),
            },
          }),
        ),
        problems,
      });
    });
  }

  /** Read off the list the last build laid, through what laid it, each path
   *  into the compiled output in a command written as where the output lands;
   *  it runs nothing (CORE-FR-176, FR-041, CORE-FR-221). */
  async listSensorCommands(
    signal: string,
    agentName: AgentProviderName,
  ): Promise<CharterDTOs.SensorCommands | FaultDTOs.Fault> {
    return this.answerWithFaultDTO("BuildingCharter.listSensorCommands", async () => {
      const builtSensors = BuiltSensorsFactory.createFromBuiltText(
        await this.#charterRepository.readCompiledOutputItem(outputPath.sensorsFileName),
      );
      const commands = builtSensors
        .filterForAgent(this.#findAgentProvider(agentName))
        .sensors.filter((builtSensor) => builtSensor.signal === signal)
        .map((builtSensor) => this.#charterRepository.resolveOutputLinks(builtSensor.command));
      return CharterDTOs.SensorCommands.of({ commands });
    });
  }

  async buildCharterInto(
    checkoutPath: string,
  ): Promise<CharterDTOs.ProjectionPlanSummary | FaultDTOs.FaultsByFile | FaultDTOs.Fault> {
    return this.answerWithFaultDTO("BuildingCharter.buildCharterInto", async () => {
      // The charter as the store holds it now, committed or not, laid into
      // the checkout by the output and each agent's projection made over it:
      // no path of it crosses a driven port after this (EVAL-FR-021).
      const checkoutLocalOutput = this.#localRepo.createCheckoutOutput(checkoutPath);
      const charter = await this.#loadCharterService.loadCharterRoot(this.#charterRepository);
      const charterErrorFaultsByFile = this.#collectCharterFaults(charter).filterErrors();
      if (!charterErrorFaultsByFile.isEmpty) return this.faultsByFileDTOOf(charterErrorFaultsByFile);
      const checkoutProjectionPlan = await this.#buildCharterService.planBuild(
        charter,
        Object.fromEntries(
          Object.entries(this.#chosenAgentProjectionByProvider).map(([agentName, agentProjection]) => [
            agentName,
            agentProjection.createCheckoutProjection(checkoutPath),
          ]),
        ),
        checkoutLocalOutput,
        this.#charterRepository,
        undefined,
        { shouldRefreshMcpOrigins: false },
      );
      if (checkoutProjectionPlan instanceof FaultsByFile) return this.faultsByFileDTOOf(checkoutProjectionPlan);
      const planSummary = this.#buildCharterService.previewPlan(
        checkoutProjectionPlan.cleanupPlan,
        checkoutProjectionPlan.writePlans,
        checkoutProjectionPlan.warnings,
      );
      await this.#buildCharterService.executePlan(checkoutProjectionPlan, checkoutLocalOutput);
      return this.#planSummaryDTOOf(planSummary);
    });
  }

  async readMainContextTexts(): Promise<CharterDTOs.MainContextTexts | FaultDTOs.FaultsByFile | FaultDTOs.Fault> {
    return this.answerWithFaultDTO("BuildingCharter.readMainContextTexts", async () => {
      const charter = await this.#loadHoldingCharter();
      if (charter instanceof FaultsByFile) return this.faultsByFileDTOOf(charter);
      return CharterDTOs.MainContextTexts.of({
        agents: this.#agents.map((agent) => ({
          agent: agent.name,
          texts: this.#layMainContextTexts(charter, agent).map(({ id, kind, text, globs }) => ({
            id,
            kind,
            text,
            ...(globs === undefined ? {} : { globs }),
          })),
        })),
      });
    });
  }

  async listEvalCases(): Promise<CharterDTOs.EvalCases | FaultDTOs.FaultsByFile | FaultDTOs.Fault> {
    return this.answerWithFaultDTO("BuildingCharter.listEvalCases", async () => {
      const [charter, evalRoot] = await Promise.all([
        this.#loadCharterService.loadCharterRoot(this.#charterRepository),
        this.#charterRepository.loadEvalSuites().then(EvalRootFactory.create),
      ]);
      // Everything that would stop a case is said before the first one spends
      // anything (EVAL-FR-026).
      for (const faultsByFile of [
        charter.allFaultsByFiles.filterErrors(),
        evalRoot.faultsByFiles,
        EvalService.validateEvalRoot(charter, evalRoot),
      ])
        if (!faultsByFile.isEmpty) return this.faultsByFileDTOOf(faultsByFile);
      return CharterDTOs.EvalCases.of({
        cases: Object.entries(evalRoot.suitesByFile).flatMap(([path, evalSuite]) =>
          evalSuite.cases.map((evalCase) => {
            const guideBody =
              evalCase.expect.follow === undefined
                ? undefined
                : charter.primitiveById.get(evalCase.expect.follow)?.body;
            return {
              suiteName: evalRoot.suiteNameByFile[path] ?? path,
              prompt: evalCase.prompt,
              expect: { ...evalCase.expect },
              ...(guideBody === undefined ? {} : { guideBody }),
            };
          }),
        ),
      });
    });
  }

  /** The charter, where none of what is wrong with it is an error; and where
   *  something is, the errors, under the file that has to change (FR-005,
   *  FR-009). */
  async #loadHoldingCharter(): Promise<CharterRoot | FaultsByFile> {
    const charter = await this.#loadCharterService.loadCharterRoot(this.#charterRepository);
    const charterErrorFaultsByFile = this.#collectCharterFaults(charter).filterErrors();
    return charterErrorFaultsByFile.isEmpty ? charter : charterErrorFaultsByFile;
  }

  /** Everything wrong with the charter, an agent it names that no projection
   *  was handed for among it (FR-033). */
  #collectCharterFaults(charter: CharterRoot): FaultsByFile {
    return charter.allFaultsByFiles.mergeWith(
      charter.agentFaultsByFilesOf(Object.keys(this.#agentProjectionByProvider)),
    );
  }

  /** What one agent puts into its main context of this charter, each text as
   *  its projection lays it: an agent reads what is laid (EVAL-FR-001,
   *  CORE-FR-221). */
  #layMainContextTexts(charter: CharterRoot, agent: AgentProvider): readonly MainContextText[] {
    return this.#agentProjectionByProvider[agent.name]!.listMainContextTexts(
      charter,
      CompileService.compileCharterRoot(charter, [agent]),
    );
  }

  /** What one primitive, or the charter itself, puts into an agent's main
   *  context, counted, as a DTO. */
  #mainContextLoadDTOOf({ id, kind, tokenCount, globs }: MainContextLoad): CharterDTOs.MainContextLoad {
    return CharterDTOs.MainContextLoad.of({ id, kind, ...(globs === undefined ? {} : { globs }), tokens: tokenCount });
  }

  /** What one agent's main context of this charter comes to, counted by a
   *  tokenizer on this machine and scaled to that agent's: an estimate, with no
   *  key and no network (EVAL-FR-001, EVAL-FR-002, EVAL-SC-001, EVAL-SC-002). */
  #estimateMainContext(charter: CharterRoot, agent: AgentProvider): MainContext {
    const { tokenFactor } = this.#agentProjectionByProvider[agent.name]!;
    return new MainContext(
      agent,
      this.#layMainContextTexts(charter, agent).map(
        ({ id, kind, text, globs }) =>
          new MainContextLoad(id, kind, Math.round(this.#tokenCounter.countTokens(text) * tokenFactor), globs),
      ),
      false,
    );
  }

  /** The projection of each agent the repository compiles for, under its
   *  name. */
  get #chosenAgentProjectionByProvider(): Readonly<Record<AgentProviderName, ForManagingLocalAgentOutput>> {
    return Object.fromEntries(this.#agents.map((agent) => [agent.name, this.#agentProjectionByProvider[agent.name]!]));
  }

  /** The agent a name names; a name no projection was handed for is refused
   *  where it comes in, rather than taken for another agent (FR-033). */
  #findAgentProvider(agentName: string): AgentProvider {
    const agentNames = Object.keys(this.#agentProjectionByProvider);
    if (!agentNames.includes(agentName))
      throw new UncompiledAgentFault(
        `This engine compiles for no agent called "${agentName}".`,
        `Name any of: ${agentNames.join(", ")}.`,
        { internal: false },
      );
    return new AgentProvider(agentName);
  }

  /**
   * Every tool the mcps the last build listed declare, under the name it is
   * served by, `<prefix>__<tool>` (FR-152, FR-153); an mcp whose compiled
   * document or served name is missing is said, naming the fix, and serves
   * nothing.
   */
  async #loadDeclaredTools(): Promise<{
    readonly declaredTools: readonly DeclaredTool[];
    readonly problems: string[];
  }> {
    const { origins } = await this.#loadMcpOriginsService.loadMcpOrigins(this.#charterRepository);
    const { toolNamesById } = await this.#loadMcpOriginsService.loadMcpTools(
      this.#charterRepository,
      origins.flatMap(({ ids }) => ids),
    );
    const problems: string[] = [];
    const declaredTools: DeclaredTool[] = [];
    for (const origin of origins)
      for (const id of origin.ids) {
        if (!toolNamesById.has(id)) continue;
        const tools = toolNamesById.get(id);
        if (tools === undefined) {
          problems.push(
            `${id} has no compiled document at ${this.#charterRepository.describeItemPlace(outputPath.getCompiledPrimitivePath(McpPrimitive.kind, id))}, so none of its tools is served. Run "cw build".`,
          );
          continue;
        }
        // The name the build served this id under and wrote into every body
        // naming it (FR-145); a list without one is from before.
        const servedPrefix = origin.names?.[id];
        if (servedPrefix === undefined) {
          problems.push(
            `${id} has no served name in ${this.#charterRepository.describeItemPlace(outputPath.mcpOriginsFileName)}, so none of its tools is served. Run "cw build" again.`,
          );
          continue;
        }
        declaredTools.push(...tools.map((tool) => ({ origin, id, tool, servedName: `${servedPrefix}__${tool}` })));
      }
    return { declaredTools, problems };
  }

  /** What a build did, or would do: the four lists as they are, and its
   *  warnings where it had any. */
  #planSummaryDTOOf(planSummary: ProjectionPlanSummary): CharterDTOs.ProjectionPlanSummary {
    const { warnings } = planSummary;
    return CharterDTOs.ProjectionPlanSummary.of({
      added: planSummary.addedPaths,
      edited: planSummary.editedPaths,
      deleted: planSummary.deletedPaths,
      unchanged: planSummary.unchangedPaths,
      ...(warnings.length === 0 ? {} : { warnings }),
    });
  }
}
