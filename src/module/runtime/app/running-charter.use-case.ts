import type { AgentProviderName, CharterDTOs, ForAuthoringCharter, ForBuildingCharter } from "../../charter/module.js";
import {
  ApplicationService,
  type FaultDTOs,
  type ForCallingMcpServers,
  type ForReadingFiles,
  type ForReportingProgress,
  type ForTellingTime,
  UnauthorizedMcpFault,
} from "../../shared/module.js";
import { EvalCaseReport, EvalRunReport } from "../domain/models/eval/eval-run-report.js";
import {
  AgentCliMissingFault,
  ExactCountUnsupportedFault,
  McpCredentialFault,
  McpServersMissingFault,
  UnknownToolFault,
} from "../domain/models/runtime.fault.js";
import { SensorAnswers } from "../domain/models/sensor/sensor-answer.js";
import { SessionAnalysisFactory } from "../domain/models/session/session-analysis.factory.js";
import type { SessionAnalysisSummary } from "../domain/models/session/session-analysis-summary.js";
import { SessionSpans } from "../domain/models/session/session-span.js";
import { EvalService } from "../domain/services/eval.service.js";
import { LogFolder } from "../domain/value-objects/log-folder.js";
import type { ForRunningCharter, RuntimeSettings } from "./port/in/running-charter.port.js";
import { RuntimeDTOs } from "./port/in/runtime.dto.js";
import type { ForKeepingWorktrees } from "./port/out/keeping-worktrees.port.js";
import type { ForLoadingSessionAnalysis } from "./port/out/loading-session-analysis.port.js";
import type { Answer, ForCheckingAgentCli, ForRunningAgentCli } from "./port/out/running-agent-cli.port.js";
import type { ForRunningPromptfoo, PromptfooAssertion } from "./port/out/running-promptfoo.port.js";
import type { ForRunningShellCommands } from "./port/out/running-shell-commands.port.js";

/** How long one mcp origin has to answer when the server starts (FR-154). */
const CONNECT_TIMEOUT_MS = 10_000;

/** The tokens one agent was sent for one answer, its command line's own
 *  instructions among them. */
const countTokensFromAnswer = ({ usage: { inputTokens, cacheCreationInputTokens, cacheReadInputTokens } }: Answer) =>
  inputTokens + cacheCreationInputTokens + cacheReadInputTokens;

/**
 * APPLICATION SERVICE — running what the charter built: the sensors of a
 * signal, the calls forwarded to the mcp origins, the evaluations and their
 * log, the main context counted exactly, and the agents' sessions
 * (CORE-FR-222).
 *
 * What it needs of the charter — the commands of a signal, the tools the mcp
 * origins declare, a token to one, a build into a working copy, what an agent
 * is sent when a session opens, the evaluation cases — it asks charter's
 * applications, in DTOs, and holds no model of the charter's (CORE-FR-229).
 * Which agents the repository compiles for, and where its sessions are kept,
 * it is handed when it is composed (CORE-FR-231).
 */
export class RunningCharter extends ApplicationService implements ForRunningCharter {
  readonly #charterAuthoringApp: Pick<ForAuthoringCharter, "accessToken" | "evalSuites">;
  readonly #charterBuildingApp: ForBuildingCharter;
  readonly #fileReader: ForReadingFiles;
  readonly #agentCliByProvider: Readonly<Partial<Record<AgentProviderName, ForCheckingAgentCli | ForRunningAgentCli>>>;
  readonly #shell: ForRunningShellCommands;
  readonly #worktrees: ForKeepingWorktrees;
  readonly #promptfooRunner: ForRunningPromptfoo;
  readonly #sessionAnalysisRepository: ForLoadingSessionAnalysis;
  readonly #clock: ForTellingTime;
  readonly #runtimeSettings: RuntimeSettings;
  readonly #mcpServers: ForCallingMcpServers | undefined;

  constructor(
    /** Charter authoring's application: the developer's token to an mcp
     *  origin, renewed where it has expired, and the evaluation files kept. */
    charterAuthoringApp: Pick<ForAuthoringCharter, "accessToken" | "evalSuites">,
    /** Charter projecting's application: what the last build laid, a build
     *  into a working copy, and the evaluation cases. */
    charterBuildingApp: ForBuildingCharter,
    /** What the evaluations' working copies a run stopped halfway left are
     *  listed with. */
    fileReader: ForReadingFiles,
    /** Each agent's own command line: what a main context is counted exactly
     *  by where it can be asked (EVAL-FR-004), and, asked only whether it is
     *  installed, what promptfoo runs the agent through. */
    agentCliByProvider: Readonly<Partial<Record<AgentProviderName, ForCheckingAgentCli | ForRunningAgentCli>>>,
    /** What runs each sensor's command in the repository's root
     *  (CORE-FR-176). */
    shell: ForRunningShellCommands,
    /** What adds a working copy of the last commit for an evaluation, and
     *  removes it. */
    worktrees: ForKeepingWorktrees,
    /** What runs and grades every evaluation case (EVAL-FR-020). */
    promptfooRunner: ForRunningPromptfoo,
    /** Where the logs of the sessions kept on this machine are read: where
     *  this repository and the developer's home are is its alone (CORE-FR-218). */
    sessionAnalysisRepository: ForLoadingSessionAnalysis,
    /** What today is, which the span of the sessions is the last 31 days to
     *  when none is named (EVAL-FR-030). */
    clock: ForTellingTime,
    /** Which agents the repository compiles for, and where its sessions are
     *  kept, as whoever composes this keeps them (CORE-FR-231). */
    runtimeSettings: RuntimeSettings,
    /** Where an internal fault is logged for whoever runs the system, before
     *  the caller is answered in the system's own words (SDK-FR-017). */
    progressReporter: ForReportingProgress,
    /** The mcp origins' MCP servers, what a call is forwarded through (FR-154). */
    mcpServers?: ForCallingMcpServers,
  ) {
    super(progressReporter);
    this.#charterAuthoringApp = charterAuthoringApp;
    this.#charterBuildingApp = charterBuildingApp;
    this.#fileReader = fileReader;
    this.#agentCliByProvider = agentCliByProvider;
    this.#shell = shell;
    this.#worktrees = worktrees;
    this.#promptfooRunner = promptfooRunner;
    this.#sessionAnalysisRepository = sessionAnalysisRepository;
    this.#clock = clock;
    this.#runtimeSettings = runtimeSettings;
    this.#mcpServers = mcpServers;
  }

  async runSensors(
    signal: string,
    stdin: string,
    agentProviderName: AgentProviderName,
  ): Promise<RuntimeDTOs.SensorRunOutcome | FaultDTOs.Fault> {
    return this.answerWithFaultDTO("RunningCharter.runSensors", async () => {
      const { commands } = this.answeredDTOOf(
        await this.#charterBuildingApp.sensorCommands(signal, agentProviderName),
      ).data;
      // Each runs to its end whatever the others do: one failing stops none.
      const sensorAnswers = await Promise.all(
        commands.map((command) => this.#shell.runShellCommand(command, "", stdin)),
      );
      const signalAnswer = SensorAnswers.signalAnswerOf(signal, sensorAnswers);
      return RuntimeDTOs.SensorRunOutcome.of({
        exitCode: signalAnswer.exitCode,
        answer: signalAnswer.stdout,
        problem: signalAnswer.stderr,
      });
    });
  }

  /**
   * One call forwarded to the mcp origin serving it, reached for this call
   * alone and let go once it has answered (EVAL-FR-031). What it keeps goes to
   * the credential store, so nothing it does can change the repository
   * (FR-149).
   */
  async call(name: string, args: Readonly<Record<string, unknown>>): Promise<RuntimeDTOs.ToolAnswer | FaultDTOs.Fault> {
    return this.answerWithFaultDTO("RunningCharter.call", async () => {
      const mcpServers = this.#mcpServers;
      if (mcpServers === undefined)
        throw new McpServersMissingFault(
          "This engine was set up with no way to reach an mcp origin.",
          "Set it up with the MCP servers.",
        );
      const declaredTool = this.answeredDTOOf(await this.#charterBuildingApp.declaredTools()).data.tools.find(
        ({ data: { servedName } }) => servedName === name,
      );
      if (declaredTool === undefined)
        throw new UnknownToolFault(`"${name}" is not a tool this server serves.`, "Call one it listed.", {
          internal: false,
        });

      const { origin, mcpId, tool } = declaredTool.data;
      const createCredentialRefusedFault = () =>
        new McpCredentialFault(
          `${origin.address} refused your credential.`,
          `Run "cw mcp auth ${mcpId}" at a terminal to sign in there again.`,
          { internal: false },
        );
      const loadAccessToken = async (isRefused: boolean) =>
        this.answeredDTOOf(
          await this.#charterAuthoringApp.accessToken(
            { address: origin.address, ...(origin.endpoint === undefined ? {} : { endpoint: origin.endpoint }), mcpId },
            isRefused,
          ),
        ).data.accessToken;
      // A local command was handed its token when it started; only an mcp origin at an
      // endpoint is sent one with each call, renewed first where it has expired.
      const loadCallAccessToken = (isRefused: boolean) =>
        origin.endpoint === undefined ? Promise.resolve(undefined) : loadAccessToken(isRefused);
      try {
        const connectToken = origin.auth.length > 0 ? await loadAccessToken(false) : undefined;
        const connection = await mcpServers.connect(
          {
            address: origin.address,
            ...(origin.endpoint === undefined ? {} : { endpoint: origin.endpoint }),
            ...(origin.command === undefined
              ? {}
              : {
                  command: {
                    command: origin.command.command,
                    args: origin.command.args,
                    ...(origin.command.tokenEnv === undefined ? {} : { tokenEnv: origin.command.tokenEnv }),
                  },
                }),
          },
          connectToken,
          CONNECT_TIMEOUT_MS,
        );
        try {
          return RuntimeDTOs.ToolAnswer.of(await connection.callTool(tool, args, await loadCallAccessToken(false)));
        } catch (raisedValue) {
          if (!(raisedValue instanceof UnauthorizedMcpFault)) throw raisedValue;
          // Refused once: renewed and tried again. A second refusal is the
          // developer's to sign in again.
          const renewedToken = await loadCallAccessToken(true);
          if (renewedToken === undefined) throw createCredentialRefusedFault();
          return RuntimeDTOs.ToolAnswer.of(await connection.callTool(tool, args, renewedToken));
        } finally {
          await connection.close();
        }
      } catch (raisedValue) {
        if (raisedValue instanceof UnauthorizedMcpFault) throw createCredentialRefusedFault();
        throw raisedValue;
      }
    });
  }

  /**
   * Every text an agent is sent when a session opens is run as a prompt, and so
   * is a prompt of next to nothing; what the model was sent for the text past
   * what it was sent for that is the text's count, the command line's own
   * instructions taken away (EVAL-FR-004). Refused before anything runs where
   * the command line is not installed.
   */
  async countMainContext(): Promise<RuntimeDTOs.MainContexts | FaultDTOs.FaultsByFile | FaultDTOs.Fault> {
    return this.answerWithFaultDTO("RunningCharter.countMainContext", async () => {
      const mainContextTextsAnswer = await this.#charterBuildingApp.mainContextTexts();
      if (mainContextTextsAnswer.type === "FaultsByFile") return mainContextTextsAnswer;
      const mainContexts: RuntimeDTOs.MainContext[] = [];
      for (const { agent, texts } of this.answeredDTOOf(mainContextTextsAnswer).data.agents) {
        const agentCli = this.#agentCliByProvider[agent];
        if (agentCli === undefined || !("ask" in agentCli))
          throw new ExactCountUnsupportedFault(
            `Counting exactly is not supported for ${agent} yet.`,
            'Run "cw context" without --exact: the estimate needs nothing.',
            { internal: false },
          );
        if (!(await agentCli.isInstalled()))
          throw new AgentCliMissingFault(
            `Counting exactly runs ${agent}'s own command line, and it is not installed here.`,
            'Run "cw context" without --exact: the estimate needs nothing.',
            { internal: false },
          );
        const ownTokens = countTokensFromAnswer(await agentCli.ask("."));
        const mainContextLoads = await Promise.all(
          texts.map(async ({ text, ...mainContextText }) => ({
            ...mainContextText,
            tokens: Math.max(0, countTokensFromAnswer(await agentCli.ask(text)) - ownTokens),
          })),
        );
        const mainContextLoadsLargestFirst = [...mainContextLoads].sort(
          (leftLoad, rightLoad) => rightLoad.tokens - leftLoad.tokens || leftLoad.id.localeCompare(rightLoad.id),
        );
        const sessionLoads = mainContextLoadsLargestFirst.filter((load) => load.globs === undefined);
        mainContexts.push(
          RuntimeDTOs.MainContext.of({
            agent,
            isExact: true,
            sessionLoads: sessionLoads.map(RuntimeDTOs.MainContextLoad.of),
            fileLoads: mainContextLoadsLargestFirst
              .filter((load) => load.globs !== undefined)
              .map(RuntimeDTOs.MainContextLoad.of),
            totalTokens: sessionLoads.reduce((total, load) => total + load.tokens, 0),
          }),
        );
      }
      return RuntimeDTOs.MainContexts.of({ contexts: mainContexts });
    });
  }

  async evaluate(
    requestedAgent?: string,
  ): Promise<RuntimeDTOs.EvalRunReport | FaultDTOs.FaultsByFile | FaultDTOs.Fault> {
    return this.answerWithFaultDTO("RunningCharter.evaluate", async () => {
      const agentProviderName = EvalService.selectEvaluationAgent(
        this.#runtimeSettings.agents,
        Object.keys(this.#agentCliByProvider),
        requestedAgent,
      );

      // A repository that wrote no case is told so, and nothing is written or
      // added: no version control is needed to say so.
      if (this.answeredDTOOf(await this.#charterAuthoringApp.evalSuites()).data.evalSuites.length === 0)
        return this.#evalRunReportDTOOf(new EvalRunReport([], agentProviderName));

      // What a run stopped halfway left is swept (EVAL-FR-021).
      for (const leftWorktreePath of await this.#fileReader.listFolders(LogFolder.evalWorktreesPath))
        await this.#worktrees.removeWorktree(leftWorktreePath);

      // What is evaluated is the last commit: its charter and its cases are read
      // off a worktree of it, so what is checked and what the agent meets are one.
      const headWorktreePath = `${LogFolder.evalWorktreesPath}/head`;
      await this.#worktrees.addWorktree(headWorktreePath);
      let evalCasesAnswer: Awaited<ReturnType<ForBuildingCharter["evalCases"]>>;
      try {
        evalCasesAnswer = await this.#charterBuildingApp.evalCases(headWorktreePath);
      } finally {
        await this.#worktrees.removeWorktree(headWorktreePath);
      }
      // Everything that would stop a case is said before the first one spends
      // anything (EVAL-FR-026).
      if (evalCasesAnswer.type === "FaultsByFile") return evalCasesAnswer;
      const { cases } = this.answeredDTOOf(evalCasesAnswer).data;
      // None committed is a report of no case.
      if (cases.length === 0) return this.#evalRunReportDTOOf(new EvalRunReport([], agentProviderName));

      if (!(await this.#agentCliByProvider[agentProviderName]?.isInstalled()))
        throw new AgentCliMissingFault(
          `Evaluating puts every case to ${agentProviderName}'s own command line, and it is not installed here.`,
          `Install ${agentProviderName}'s command line and sign in, then run "cw eval --agent=${agentProviderName}" again.`,
          { internal: false },
        );

      // Installed once, the first time a run needs it (EVAL-FR-032).
      if (!(await this.#promptfooRunner.isInstalled())) {
        this.progressReporter.report(
          `Installing promptfoo once into ${this.#promptfooRunner.installFolderPath} (about 2.5 GB)...\n`,
        );
        await this.#promptfooRunner.install();
      }

      // One case at a time, each in a worktree of its own: what one case's agent
      // edits is no part of the next one's, nor of the working tree someone may
      // be writing in.
      const evalCaseReports: EvalCaseReport[] = [];
      for (const [caseIndex, evalCase] of cases.entries()) {
        const caseWorktreePath = `${LogFolder.evalWorktreesPath}/${caseIndex + 1}`;
        await this.#worktrees.addWorktree(caseWorktreePath);
        try {
          const buildAnswer = await this.#charterBuildingApp.buildInto(caseWorktreePath);
          if (buildAnswer.type === "FaultsByFile") return buildAnswer;
          this.answeredDTOOf(buildAnswer);
          evalCaseReports.push(await this.#runWithPromptfoo(caseWorktreePath, evalCase, agentProviderName));
        } finally {
          await this.#worktrees.removeWorktree(caseWorktreePath);
        }
      }
      return this.#evalRunReportDTOOf(new EvalRunReport(evalCaseReports, agentProviderName));
    });
  }

  async analyze(logFilePath?: string): Promise<RuntimeDTOs.EvalLogAnalysis | FaultDTOs.Fault> {
    return this.answerWithFaultDTO("RunningCharter.analyze", async () => {
      return RuntimeDTOs.EvalLogAnalysis.of({ logs: await this.#promptfooRunner.readLogs(logFilePath) });
    });
  }

  async sessionSummary(since?: string, until?: string): Promise<RuntimeDTOs.SessionReviewOutcome | FaultDTOs.Fault> {
    return this.answerWithFaultDTO("RunningCharter.sessionSummary", async () => {
      const sessionSpan = SessionSpans.of(this.#clock.now(), since, until);
      const { writtenFromMs, writtenUntilMs } = SessionSpans.logWindowOf(sessionSpan);
      const { sessionsFolder, logTexts } = await this.#sessionAnalysisRepository.loadSessionLogs(
        this.#runtimeSettings.sessionAnalysisFolder,
        writtenFromMs,
        writtenUntilMs,
      );
      const sessionAnalysis = SessionAnalysisFactory.create(sessionsFolder, logTexts);
      // The folder they are kept in, their summary, and each day's, each within
      // its span at its last stop (EVAL-FR-012, EVAL-FR-013). The lines read
      // stay behind.
      const sessionSummaryDTOOf = ({
        span,
        sessions,
        sessionCount,
        totalTokens,
      }: SessionAnalysisSummary): RuntimeDTOs.SessionSummary =>
        RuntimeDTOs.SessionSummary.of({ span, sessions, sessionCount, totalTokens });
      return RuntimeDTOs.SessionReviewOutcome.of({
        sessionsFolder: sessionAnalysis.sessionsFolder,
        sessionSummary: sessionSummaryDTOOf(sessionAnalysis.summarize(sessionSpan)),
        dailySessionSummary: Object.fromEntries(
          Object.entries(sessionAnalysis.summarizeByDay(sessionSpan)).map(([day, daySummary]) => [
            day,
            sessionSummaryDTOOf(daySummary),
          ]),
        ),
      });
    });
  }

  /**
   * How one case came out, run and graded by promptfoo in this working folder
   * (EVAL-FR-020 – EVAL-FR-024): the case said as a promptfoo test — a skill as
   * `skill-used`, a guide as an `agent-rubric` an agent grader holds what the
   * agent did to, at most a number of tokens as a JavaScript check of the
   * tokens the agent used — and what promptfoo graded read back as the case's
   * report. Nothing is graded here.
   */
  async #runWithPromptfoo(
    workingPath: string,
    { suiteName, prompt, expect, guideBody }: CharterDTOs.EvalCases["data"]["cases"][number],
    agentProviderName: AgentProviderName,
  ): Promise<EvalCaseReport> {
    const { invoke: skillId, follow: guideId, read: filePath, maxTokens } = expect;
    const assertions: PromptfooAssertion[] = [
      ...(filePath === undefined ? [] : [{ type: "file-read" as const, value: filePath }]),
      ...(skillId === undefined ? [] : [{ type: "skill-used" as const, value: skillId }]),
      ...(guideId === undefined || guideBody === undefined
        ? []
        : [
            {
              type: "agent-rubric" as const,
              // promptfoo renders an assertion's value as a nunjucks template, so
              // the guide goes in raw: what reads as a template in it is text.
              value: `The agent followed the guide "${guideId}" in what it did and in every file it wrote:\n\n{% raw %}${guideBody.trim()}{% endraw %}`,
            },
          ]),
      ...(maxTokens === undefined
        ? []
        : [
            {
              type: "javascript" as const,
              value: [
                "const total = context.providerResponse?.tokenUsage?.total ?? 0;",
                `const isWithin = total <= ${maxTokens};`,
                `return { pass: isWithin, score: isWithin ? 1 : 0, reason: isWithin ? "The agent used " + total.toLocaleString("en-US") + " tokens." : "The agent used " + total.toLocaleString("en-US") + " tokens, more than the ${maxTokens.toLocaleString("en-US")} this case allows." };`,
              ].join("\n"),
            },
          ]),
    ];
    const { success, totalTokens, componentResults, error, logPath, sessionId, sessionPath } =
      await this.#promptfooRunner.evaluate({
        agent: agentProviderName,
        description: `${suiteName}: ${prompt}`,
        prompt,
        workingPath,
        assertions,
      });
    const unmetReasons = componentResults
      .filter(({ pass }) => !pass)
      .map(({ assertionType, reason }) =>
        assertionType === "agent-rubric" ? `"${guideId}" was not followed: ${reason}` : reason,
      );
    // A case promptfoo could not run has no grading to say: its error is why.
    if (!success && unmetReasons.length === 0)
      unmetReasons.push(error ?? "promptfoo failed this case without saying why.");
    return new EvalCaseReport(suiteName, prompt, totalTokens, unmetReasons, logPath, sessionId, sessionPath);
  }

  /** How every evaluation case came out, and the tokens of them all. */
  #evalRunReportDTOOf(evalRunReport: EvalRunReport): RuntimeDTOs.EvalRunReport {
    return RuntimeDTOs.EvalRunReport.of({
      evalCaseReports: evalRunReport.evalCaseReports.map(
        ({ suiteName, prompt, passed, tokens, unmetReasons, logPath, sessionId, sessionPath }) =>
          RuntimeDTOs.EvalCaseReport.of({
            suiteName,
            prompt,
            passed,
            tokens,
            unmetReasons,
            ...(logPath === undefined ? {} : { logPath }),
            ...(sessionId === undefined ? {} : { sessionId }),
            ...(sessionPath === undefined ? {} : { sessionPath }),
          }),
      ),
      totalTokens: evalRunReport.totalTokens,
      agent: evalRunReport.agent,
    });
  }
}
