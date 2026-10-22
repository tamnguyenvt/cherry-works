import { text } from "node:stream/consumers";
import type { Command, Context, OptionSpec, Options, Outcome } from "./Command.js";

const OPTIONS = {
  signal: {
    type: "string",
    describe: "The signal the host fired, as a sensor names it: Stop, PreToolUse…",
  },
} as const satisfies OptionSpec;

/**
 * `cw sensor run <signal>`: the one hook a host is given for a signal, running
 * every sensor of it as the last build wrote them (CORE-FR-175 – CORE-FR-179).
 *
 * The event the host hands over on standard input is read whole and handed to
 * each sensor; what they came to is answered as the host reads one hook's:
 * the exit code passed through, the answer on standard output, the error
 * output on standard error.
 */
export class SensorRunCommand implements Command<typeof OPTIONS> {
  readonly name = "sensor run <signal>";
  readonly summary = "Run every sensor of a signal, as the host's one hook for it";
  readonly options = OPTIONS;

  async run({ sensorRunningApp }: Context, { signal }: Options<typeof OPTIONS>): Promise<Outcome> {
    // Typed at a terminal, there is no event to wait for.
    const stdin = process.stdin.isTTY ? "" : await text(process.stdin);
    const { data: sensorRunOutcome } = await sensorRunningApp.runSensors(signal ?? "", stdin);
    return { code: sensorRunOutcome.exitCode, result: sensorRunOutcome.answer, problem: sensorRunOutcome.problem };
  }
}
