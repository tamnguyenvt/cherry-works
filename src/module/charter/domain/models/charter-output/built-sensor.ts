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
  /** The one command an agent is given for a signal its charter's sensors fire
   *  on, whichever agent: `cw` runs every one of them (FR-175). */
  getRunCommand(signal: string, agentProvider?: AgentProvider): string {
    return `cw sensor run ${signal}${agentProvider === undefined ? "" : ` --agent ${agentProvider.name}`}`;
  }

  constructor(readonly sensors: readonly BuiltSensor[]) {
    super();
  }

  /** Select only sensors that support the agent raising the signal; with no
   *  agent named, only the sensors kept for no agent (CORE-FR-233). */
  filterForAgent(raisingAgentProvider: AgentProvider | undefined): BuiltSensors {
    return new BuiltSensors(
      this.sensors.filter((builtSensor) => {
        const agentProviders = builtSensor["agent-provider"];
        return (
          agentProviders === undefined ||
          agentProviders.length === 0 ||
          agentProviders.some((agentProvider) => agentProvider.name === raisingAgentProvider?.name)
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
