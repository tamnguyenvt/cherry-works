import type { AgentProvider } from "#module/shared/module.js";
import { CharterOutputItem } from "./charter-output-item.js";

/** One sensor as a build leaves it: its id, the signal it fires on, and the
 *  command that runs, each script it names written as its built file (FR-169). */
export class BuiltSensor {
  readonly id: string;
  readonly signal: string;
  readonly "agent-provider"?: readonly AgentProvider[];
  readonly command: string;

  constructor(builtSensor: BuiltSensor) {
    this.id = builtSensor.id;
    this.signal = builtSensor.signal;
    if (builtSensor["agent-provider"] !== undefined) this["agent-provider"] = builtSensor["agent-provider"];
    this.command = builtSensor.command;
  }
}

/** Every sensor the last build compiled, in order of id: what
 *  `cw sensor run <signal>` reads, since it reads no charter (FR-179). */
export class BuiltSensors extends CharterOutputItem {
  /** The one command a host is given for a signal its charter's sensors fire
   *  on, whichever host: `cw` runs every one of them (FR-175). */
  getRunCommand(signal: string, agent?: AgentProvider): string {
    return `cw sensor run ${signal}${agent === undefined ? "" : ` --agent ${agent.name}`}`;
  }

  constructor(readonly sensors: readonly BuiltSensor[]) {
    super();
  }

  /** Select only sensors that support the host raising the signal. */
  filterForAgent(agent: AgentProvider): BuiltSensors {
    return new BuiltSensors(
      this.sensors.filter((builtSensor) => {
        const agentProviders = builtSensor["agent-provider"];
        return (
          agentProviders === undefined ||
          agentProviders.length === 0 ||
          agentProviders.some((agentProvider) => agentProvider.name === agent.name)
        );
      }),
    );
  }

  /** What it holds: generated, and the charter's alone. Indented, since it is
   *  committed and read in diffs when a sensor's command changes. */
  get text(): string {
    return `${JSON.stringify({ sensors: this.sensors }, undefined, 2)}\n`;
  }

  /** Every signal at least one sensor names, each once, in the order the
   *  sensors name them. */
  get signals(): readonly string[] {
    return [...new Set(this.sensors.map((builtSensor) => builtSensor.signal))];
  }
}
