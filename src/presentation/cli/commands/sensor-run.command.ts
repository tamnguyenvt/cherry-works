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
  agent: { type: "string", describe: "The agent raising the signal: claude or codex" },
  signal: {
    type: "string",
    describe: "The signal the agent fired, as a sensor names it: Stop, PreToolUse…",
  },
} as const satisfies OptionSpec;

/**
 * `cw sensor run <signal>`: the one hook an agent is given for a signal, running
 * every sensor of it as the last build wrote them (CORE-FR-175 – CORE-FR-179).
 *
 * The event the agent hands over on standard input is read whole and handed to
 * each sensor; what they came to is answered as the agent reads one hook's:
 * the exit code passed through, the answer on standard output, the error
 * output on standard error.
 */
export class SensorRunCommand implements Command<typeof OPTIONS> {
  readonly name = "sensor run <signal>";
  readonly summary = "Run every sensor of a signal, as the agent's one hook for it";
  readonly options = OPTIONS;

  async runCommand(
    { charterRuntimeApp, workspaceApp }: Context,
    { signal, agent }: Options<typeof OPTIONS>,
  ): Promise<Outcome> {
    if (agent !== undefined && !workspaceApp.agentProviderNames.includes(agent))
      return {
        exitCode: EXIT_FAILURE,
        problemText: `Unknown sensor agent "${agent}".\n  Name any of: ${workspaceApp.agentProviderNames.join(", ")}.\n`,
      };
    // Typed at a terminal, there is no event to wait for.
    const stdin = process.stdin.isTTY ? "" : await text(process.stdin);
    // A hook written before hooks named their agent is Claude's.
    const sensorRunOutcomeDTO = await charterRuntimeApp.runSensors(signal ?? "", stdin, agent ?? "claude");
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
