import prompts from "prompts";
import {
  AGENT_PROVIDERS,
  DomainFault,
  isAgentProvider,
  type AgentProvider,
  type ForManagingCharter,
} from "#hexagon/port/driver/ForManagingCharter.js";
import { EXIT_FAILURE, EXIT_OK, type Command, type Context, type Options, type Outcome } from "./Command.js";

const OPTIONS = {
  agent: {
    type: "string",
    describe: `Which agent this charter compiles for: ${AGENT_PROVIDERS.join(", ")}`,
  },
} as const;

/**
 * `cw init`: set this repository up under a charter (FR-032 – FR-037).
 *
 * The asking happens here and only here. This command gathers every answer —
 * from what was typed, from what the repository already chose, or from the
 * person at the terminal — and only then calls the use case, which is handed a
 * decided set of answers and puts no question of its own.
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
 * SC-012).
 */
export class InitCommand implements Command<typeof OPTIONS> {
  readonly name = "init";
  readonly summary = "Set this repository up under a charter";
  readonly options = OPTIONS;

  async run({ charterAuthoringApp }: Context, { agent }: Options<typeof OPTIONS>): Promise<Outcome> {
    const agents = await whichAgents(charterAuthoringApp, agent);
    const planSummaryDTO = await charterAuthoringApp.init({ agents });
    const setUp = ["Set up this repository under a charter.", `Compiling for: ${agents.join(", ")}.`];

    // Set up either way; a charter already here that does not hold is not
    // built, and is said in the build's own words (FR-057).
    if (planSummaryDTO.type === "FaultsByFile") {
      const noOfFiles = Object.keys(planSummaryDTO.data.files).length;
      return {
        code: EXIT_FAILURE,
        result: [...setUp, ""].join("\n"),
        problem: `Nothing was built: ${noOfFiles} file${noOfFiles === 1 ? " has" : "s have"} errors.\nRun "cw doctor" to see what is wrong with them.\n`,
      };
    }

    const { added, edited } = planSummaryDTO.data;
    const wrote = added.length + edited.length;
    return {
      code: EXIT_OK,
      result: [
        ...setUp,
        `Built ${wrote} file${wrote === 1 ? "" : "s"}: ${added.length} added, ${edited.length} changed.`,
        'Author your first rule under .cw/charter/guide/, or ask your agent to write one, then run "cw build".',
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
 * default, so that run is refused, naming the flag that answers it.
 */
async function whichAgents(
  charterAuthoringApp: ForManagingCharter,
  typed: string | undefined,
): Promise<readonly AgentProvider[]> {
  if (typed !== undefined) {
    if (!isAgentProvider(typed))
      throw new DomainFault(
        `This engine compiles for no agent called "${typed}".`,
        `Name any of: ${AGENT_PROVIDERS.join(", ")}.`,
      );
    return [typed];
  }

  const agentsInSettings = (await charterAuthoringApp.settings()).data.agents.filter(isAgentProvider);
  // What the repository already chose, or — where this engine compiles for one
  // agent only — that one, selected before anybody is asked (FR-055).
  const defaultAgents: readonly AgentProvider[] =
    agentsInSettings.length > 0 ? agentsInSettings : AGENT_PROVIDERS.length === 1 ? AGENT_PROVIDERS : [];

  // Nobody at the terminal is answered with what the settings already name,
  // which is what the prompt below would hand back on a return: a pipeline
  // finishes rather than waits on an answer that is never coming (FR-035,
  // SC-012).
  if (!process.stdin.isTTY) {
    if (defaultAgents.length === 0)
      throw new DomainFault(
        "Nobody is at the terminal to choose an agent, and this repository has none chosen yet.",
        `Run "cw init --agent <name>", naming one of: ${AGENT_PROVIDERS.join(", ")}.`,
      );
    return defaultAgents;
  }

  const { chosen } = await prompts({
    type: "multiselect",
    name: "chosen",
    message: "Which agents does this charter compile for?",
    // What the settings already name arrives ticked, so a return keeps what this
    // repository is already running under and a second run is rechoosing rather
    // than starting over (FR-038). Nothing named yet — a repository being set up
    // for the first time — arrives with the one agent ticked where this engine
    // compiles for one, and with nothing ticked otherwise (FR-055).
    choices: AGENT_PROVIDERS.map((one) => ({ title: one, value: one, selected: defaultAgents.includes(one) })),
    // Ticking none of them is not an answer: a charter compiles for at least one
    // agent, so the prompt holds the submit until one is ticked (FR-033).
    min: 1,
  });
  if (chosen === undefined)
    throw new DomainFault("Setup was stopped before it had its answers.", 'Run "cw init" again.');

  return chosen as readonly AgentProvider[];
}
