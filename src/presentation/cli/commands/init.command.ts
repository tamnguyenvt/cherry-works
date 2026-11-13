import prompts from "prompts";
import { type ForManagingWorkspace, SETTINGS_FILE_PATH } from "#module/workspace/module.js";
import { type Command, type Context, EXIT_FAILURE, EXIT_OK, type Options, type Outcome } from "./command.interface.js";
import { printFault, printFaultsByFile } from "./helper.js";

const OPTIONS = {
  agent: {
    type: "string",
    describe: "Which agent this charter compiles for",
  },
  mainContextCeiling: {
    type: "number",
    describe: "The tokens of main context past which the health check warns; 20000 unless set",
  },
} as const;

/**
 * `cw init`: set this repository up under a charter (FR-032 – FR-037).
 *
 * The asking happens here and only here. This command gathers every answer —
 * from what was typed, from what the repository already chose, or from the
 * person at the terminal — has the workspace module keep them in the settings
 * (CORE-FR-231), and only then composes the engine for them: the
 * charter's folders are laid out, and a build runs over them.
 *
 * Which agent is one such answer, and it is asked of the list this engine
 * compiles for rather than of the machine: whether claude is installed here is
 * no business of a charter's. Choose claude and the build setup runs compiles
 * everything for claude, `.claude/` created if it was not there.
 *
 * A repository already set up answers with what it is already running under, so
 * running this again is rechoosing rather than starting over (FR-038).
 *
 * Every question has a flag that answers it and a default that is taken when
 * nobody is at the terminal, so the whole run works unattended (FR-035,
 * SC-012) — except the agent of a repository that has chosen none yet, which
 * stops naming `--agent` (CORE-FR-056).
 */
export class InitCommand implements Command<typeof OPTIONS> {
  readonly name = "init";
  readonly summary = "Set this repository up under a charter";
  readonly options = OPTIONS;

  async runCommand(
    { workspaceApp, composeApplications, version }: Context,
    { agent, mainContextCeiling }: Options<typeof OPTIONS>,
  ): Promise<Outcome> {
    const agents = await pickAgents(workspaceApp, agent);
    if (typeof agents === "string") return { exitCode: EXIT_FAILURE, problemText: agents };
    // No agent, one this engine does not compile for, and a ceiling that is
    // no whole number are the workspace module's to refuse (FR-033).
    const workspaceSettingsDTO = await workspaceApp.setUpWorkspace(agents, version, mainContextCeiling);
    if (workspaceSettingsDTO.type === "Fault")
      return { exitCode: EXIT_FAILURE, problemText: printFault(workspaceSettingsDTO) };
    const { charterAuthoringApp, charterBuildingApp } = (await composeApplications()).engineApp;
    const charterLayoutDTO = await charterAuthoringApp.setUpCharter();
    if (charterLayoutDTO.type === "Fault") return { exitCode: EXIT_FAILURE, problemText: printFault(charterLayoutDTO) };
    const planSummaryDTO = await charterBuildingApp.buildCharter();
    if (planSummaryDTO.type === "Fault") return { exitCode: EXIT_FAILURE, problemText: printFault(planSummaryDTO) };
    const setUpLines = ["Set up this repository under a charter.", `Compiling for: ${agents.join(", ")}.`];

    // Set up either way; a charter already here that does not hold is not
    // built, and is said in the build's own words (FR-057).
    if (planSummaryDTO.type === "FaultsByFile") {
      const noOfFiles = Object.keys(planSummaryDTO.data.files).length;
      return {
        exitCode: EXIT_FAILURE,
        resultText: [...setUpLines, ""].join("\n"),
        problemText: `Nothing was built: ${noOfFiles} file${noOfFiles === 1 ? " has" : "s have"} errors.\n\n${printFaultsByFile(planSummaryDTO)}`,
      };
    }

    const { added: addedPaths, edited: editedPaths } = planSummaryDTO.data;
    const writtenFileCount = addedPaths.length + editedPaths.length;
    return {
      exitCode: EXIT_OK,
      resultText: [
        ...setUpLines,
        ...(planSummaryDTO.data.warnings ?? []).map((warning) => `Warning: ${warning}`),
        `Built ${writtenFileCount} file${writtenFileCount === 1 ? "" : "s"}: ${addedPaths.length} added, ${editedPaths.length} changed.`,
        'Author your first rule under .cw/charter/primitive/guide/, or ask your agent to write one, then run "cw build".',
        "",
      ].join("\n"),
    };
  }
}

/**
 * Which agents this repository compiles for, answered by the first of these
 * that applies: what was typed, and otherwise whoever is at the terminal
 * choosing from the ones this engine compiles for.
 *
 * Nothing is detected. What is installed on this machine does not decide what a
 * repository's charter compiles for — a charter choosing claude compiles for
 * claude whether claude is here or not, and the build creates the directory it
 * reads from either way.
 *
 * What the repository is already running under is the choice already made, so
 * it arrives as the default: a return keeps it, and a run with nobody at the
 * terminal takes it rather than waiting on an answer that is never coming
 * (FR-035, FR-038, SC-012). A repository that has chosen none yet has no such
 * default, so that run is refused, naming the flag that answers it: what comes
 * back then is what to report, in place of the agents.
 */
async function pickAgents(
  workspaceApp: ForManagingWorkspace,
  typedAgent: string | undefined,
): Promise<readonly string[] | string> {
  if (typedAgent !== undefined) return [typedAgent];

  const workspaceSettingsDTO = await workspaceApp.readWorkspaceSettings();
  if (workspaceSettingsDTO.type === "Fault")
    return `${SETTINGS_FILE_PATH}\n  error: ${workspaceSettingsDTO.data.message}\n    ${workspaceSettingsDTO.data.fix}\n`;
  const agentsInSettings = workspaceSettingsDTO.data.agents;

  // Nobody at the terminal is answered with what the settings already name,
  // which is what the prompt below would hand back on a return: a pipeline
  // finishes rather than waits on an answer that is never coming (FR-035,
  // SC-012). A repository that has chosen none yet has no such default,
  // however many agents this engine compiles for (CORE-FR-055, CORE-FR-056).
  if (!process.stdin.isTTY) {
    if (agentsInSettings.length === 0)
      return `Nobody is at the terminal to choose an agent, and this repository has none chosen yet.\n  Run "cw init --agent <name>", naming one of: ${workspaceApp.agentProviderNames.join(", ")}.\n`;
    return agentsInSettings;
  }

  const { chosen: chosenAgents } = await prompts({
    type: "multiselect",
    name: "chosen",
    message: "Which agents does this charter compile for?",
    // What the settings already name arrives ticked, so a return keeps what this
    // repository is already running under and a second run is rechoosing rather
    // than starting over (FR-038). Nothing named yet — a repository being set up
    // for the first time — arrives with none ticked (CORE-FR-055).
    choices: workspaceApp.agentProviderNames.map((agentProviderName) => ({
      title: agentProviderName,
      value: agentProviderName,
      selected: agentsInSettings.includes(agentProviderName),
    })),
    // Ticking none of them is not an answer: a charter compiles for at least one
    // agent, so the prompt holds the submit until one is ticked (FR-033).
    min: 1,
  });
  if (chosenAgents === undefined) return 'Setup was stopped before it had its answers.\n  Run "cw init" again.\n';

  return chosenAgents as readonly string[];
}
