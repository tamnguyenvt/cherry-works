import { text } from "node:stream/consumers";
import {
  type Command,
  type Context,
  EXIT_FAILURE,
  type OptionSpec,
  type Options,
  type Outcome,
} from "./command.interface.js";
import { printFault } from "./helper.js";

const OPTIONS = {
  agent: {
    type: "string",
    describe: "The agent raising the signal: claude or codex; with none named, only the sensors kept for no agent run",
  },
  signal: {
    type: "string",
    describe: "The signal the agent fired, as a sensor names it: Stop, PreToolUse…",
  },
} as const satisfies OptionSpec;

/**
 * `cw run sensor <signal> --agent <agent>`: the one hook an agent is given for
 * a signal, running the sensors of it that run for that agent, as the last
 * build wrote them; with no agent named, only those kept for no agent
 * (CORE-FR-175 – CORE-FR-179, CORE-FR-234).
 *
 * The event the agent hands over on standard input is read whole and handed to
 * each sensor; what they came to is answered as the agent reads one hook's:
 * the exit code passed through, the answer on standard output, the error
 * output on standard error.
 */
export class RunSensorCommand implements Command<typeof OPTIONS> {
  readonly name = "run sensor <signal>";
  readonly deprecatedName = "sensor run <signal>";
  readonly summary = "Run every sensor of a signal, as the agent's one hook for it";
  readonly options = OPTIONS;

  async runCommand(
    { charterRuntimeApp, workspaceApp }: Context,
    { signal, agent: namedAgentName }: Options<typeof OPTIONS>,
  ): Promise<Outcome> {
    if (namedAgentName !== undefined && !workspaceApp.agentProviderNames.includes(namedAgentName))
      return {
        exitCode: EXIT_FAILURE,
        problemText: `Unknown sensor agent "${namedAgentName}".\n  Name any of: ${workspaceApp.agentProviderNames.join(", ")}.\n`,
      };
    // Typed at a terminal, there is no event to wait for.
    const eventText = process.stdin.isTTY ? "" : await text(process.stdin);
    // With no agent named, only the sensors kept for no agent run (CORE-FR-234).
    const sensorRunOutcomeDTO = await charterRuntimeApp.runSensors(signal ?? "", eventText, namedAgentName);
    if (sensorRunOutcomeDTO.type === "Fault")
      return { exitCode: EXIT_FAILURE, problemText: printFault(sensorRunOutcomeDTO) };
    const { data: sensorRunOutcome } = sensorRunOutcomeDTO;
    return {
      exitCode: sensorRunOutcome.exitCode,
      resultText: sensorRunOutcome.answer,
      problemText: sensorRunOutcome.problem,
    };
  }
}
