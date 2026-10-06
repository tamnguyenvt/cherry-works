import type { AgentProvider } from "../domain/models/AgentProvider.js";
import { DomainFault, FaultsByFile } from "../domain/models/DomainFault.js";
import { evalSuiteNameOf } from "../domain/models/eval/EvalSuite.js";
import { EvalRunReport, validateEvalRoot, type EvalCaseReport } from "../domain/services/evalService.js";
import type { DataDTOs } from "../port/driver/dtos/index.js";
import type { ForEvaluatingCharter } from "../port/driver/ForEvaluatingCharter.js";
import type { ForParsingYaml } from "../port/zdriven/ForParsingYaml.js";
import type { ForReadingFiles } from "../port/zdriven/ForReadingFiles.js";
import type { ForReportingProgress } from "../port/zdriven/ForReportingProgress.js";
import type { ForRunningPromptfoo } from "../port/zdriven/ForRunningPromptfoo.js";
import type { ForRunningAgentCli } from "../port/zdriven/ForRunningAgentCli.js";
import type { ForVCS } from "../port/zdriven/ForVCS.js";
import type { ForWritingFiles } from "../port/zdriven/ForWritingFiles.js";
import { runWithPromptfoo } from "../service/promptfooService.js";
import { executePlan, plan } from "../service/buildService.js";
import { loadCharterRoot } from "../service/charterRepo.js";
import { loadEvalRoot } from "../service/evalSuitesRepo.js";
import { loadSettings } from "../service/settingsRepo.js";
import { evalFolderIn, evalWorktreesFolderIn, folderURL } from "../domain/path.js";
import { evalRunReportDTO, faultsByFileDTO } from "./dtos.js";

/**
 * APPLICATION SERVICE — the charter evaluated against the real agent
 * (EVAL-FR-020 – EVAL-FR-026).
 *
 * Read the charter and the cases off the last commit, refuse what cannot run,
 * install promptfoo where it is not yet, then for each case: add a worktree of
 * that commit under `.cw/eval/.worktrees/`, build the charter there, hand the
 * case to promptfoo to run and grade there, and remove the worktree. Nothing
 * is run or graded here (EVAL-FR-020).
 *
 * It writes nothing into the repository's own working tree: version control
 * ignores the worktrees by the section a build writes into `.cw/.gitignore`
 * (EVAL-FR-021).
 */
export class CharterEvaluating implements ForEvaluatingCharter {
  readonly #repoPath: URL;
  readonly #fileReader: ForReadingFiles;
  readonly #yamlParser: ForParsingYaml;
  readonly #fileWriter: ForWritingFiles;
  readonly #vcs: ForVCS;
  readonly #agentCliByProvider: Readonly<Record<AgentProvider, ForRunningAgentCli>>;
  readonly #promptfooRunner: ForRunningPromptfoo;
  readonly #progressReporter: ForReportingProgress;

  constructor(
    repoPath: URL,
    fileReader: ForReadingFiles,
    yamlParser: ForParsingYaml,
    /** What the charter is built into each worktree with. */
    fileWriter: ForWritingFiles,
    /** What adds a worktree of the last commit, and removes it. */
    vcs: ForVCS,
    /** Each agent's own command line: what promptfoo runs the agent through,
     *  asked only whether it is installed. */
    agentCliByProvider: Readonly<Record<AgentProvider, ForRunningAgentCli>>,
    /** What runs and grades every case (EVAL-FR-020). */
    promptfooRunner: ForRunningPromptfoo,
    /** What the developer is told while a run installs promptfoo
     *  (EVAL-FR-032). */
    progressReporter: ForReportingProgress,
  ) {
    this.#repoPath = repoPath;
    this.#fileReader = fileReader;
    this.#yamlParser = yamlParser;
    this.#fileWriter = fileWriter;
    this.#vcs = vcs;
    this.#agentCliByProvider = agentCliByProvider;
    this.#promptfooRunner = promptfooRunner;
    this.#progressReporter = progressReporter;
  }

  async evaluate(): Promise<DataDTOs.EvalRunReport | DataDTOs.FaultsByFile> {
    // A repository that wrote no case is told so, and nothing is written.
    const evalFolder = evalFolderIn(this.#repoPath);
    const worktreesFolder = evalWorktreesFolderIn(this.#repoPath);
    const evalFiles = (await this.#fileReader.readFilesRecursively(evalFolder)).filter(({ file }) => !file.href.startsWith(worktreesFolder.href));
    if (evalFiles.length === 0) return evalRunReportDTO(new EvalRunReport([]));

    // What a run stopped halfway left is swept (EVAL-FR-021).
    for (const leftWorktreeFolder of await this.#fileReader.listFolders(worktreesFolder))
      await this.#vcs.removeWorktree(this.#repoPath, leftWorktreeFolder);

    // What is evaluated is the last commit: its charter and its cases are read
    // off a worktree of it, so what is checked and what the agent meets are one.
    const headWorktreeFolder = folderURL(new URL("head/", worktreesFolder));
    await this.#vcs.addWorktree(this.#repoPath, headWorktreeFolder);
    let charter, settings, evalRoot;
    try {
      [charter, settings, evalRoot] = await Promise.all([
        loadCharterRoot(headWorktreeFolder, this.#fileReader, this.#yamlParser),
        loadSettings(headWorktreeFolder, this.#fileReader),
        loadEvalRoot(headWorktreeFolder, this.#fileReader),
      ]);
    } finally {
      await this.#vcs.removeWorktree(this.#repoPath, headWorktreeFolder);
    }
    // Everything that would stop a case is said before the first one spends
    // anything (EVAL-FR-026).
    for (const faultsByFile of [charter.allFaultsByFiles.errors(), evalRoot.faultsByFiles, validateEvalRoot(charter, evalRoot)])
      if (!faultsByFile.isEmpty) return faultsByFileDTO(faultsByFile, headWorktreeFolder);

    const suiteCases = Object.entries(evalRoot.suitesByFile).flatMap(([path, evalSuite]) =>
      evalSuite.cases.map((evalCase) => ({ suiteName: evalSuiteNameOf(path), evalCase })),
    );
    if (suiteCases.length === 0) return evalRunReportDTO(new EvalRunReport([]));

    // Claude Code is the one agent evaluated (spec Assumptions).
    if (!settings.agents.includes("claude"))
      throw new DomainFault("Evaluating runs the cases through claude, and this repository does not compile for it.", 'Run "cw init" and choose claude.');
    if (!(await this.#agentCliByProvider.claude.isInstalled()))
      throw new DomainFault(
        "Evaluating puts every case to claude's own command line, and it is not installed here.",
        'Install Claude Code and sign in, then run "cw eval" again.',
      );

    // Installed once, the first time a run needs it (EVAL-FR-032).
    if (!(await this.#promptfooRunner.isInstalled())) {
      this.#progressReporter.report(`Installing promptfoo once into ${this.#promptfooRunner.installFolderPath} (about 2.5 GB)...\n`);
      await this.#promptfooRunner.install();
    }

    // One case at a time, each in a worktree of its own: what one case's agent
    // edits is no part of the next one's, nor of the working tree someone may
    // be writing in.
    const evalCaseReports: EvalCaseReport[] = [];
    for (const [caseIndex, { suiteName, evalCase }] of suiteCases.entries()) {
      const caseWorktreeFolder = folderURL(new URL(`${caseIndex + 1}/`, worktreesFolder));
      await this.#vcs.addWorktree(this.#repoPath, caseWorktreeFolder);
      try {
        const buildPlan = await plan(caseWorktreeFolder, charter, settings.agents, this.#fileReader, undefined, { refreshMcpOrigins: false });
        if (buildPlan instanceof FaultsByFile) return faultsByFileDTO(buildPlan, caseWorktreeFolder);
        await executePlan(buildPlan.cleanupPlan, buildPlan.projectionPlan, this.#fileWriter);

        const guideId = evalCase.expect.follow;
        const guideBody = guideId === undefined ? undefined : charter.primitiveById.get(guideId)?.body;
        evalCaseReports.push(await runWithPromptfoo(this.#promptfooRunner, caseWorktreeFolder, suiteName, evalCase, guideBody));
      } finally {
        await this.#vcs.removeWorktree(this.#repoPath, caseWorktreeFolder);
      }
    }
    return evalRunReportDTO(new EvalRunReport(evalCaseReports));
  }
}
