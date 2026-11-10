import type { AgentProvider } from "../agent/agent-provider.js";
import type { AgentProviderName } from "../agent/agent-provider.js";
import { OutputPart } from "./output-part.js";

/** One sensor as a build leaves it: its id, the signal it fires on, and the
 *  command that runs, each script it names written as its built file (FR-169). */
export class BuiltSensor {
  declare readonly id: string;
  declare readonly signal: string;
  declare readonly command: string;
  declare readonly "agent-provider"?: readonly AgentProviderName[];

  constructor(fields: BuiltSensor) {
    Object.assign(this, fields);
  }
}

/** The one command a host is given for a signal its charter's sensors fire
 *  on, whichever host: `cw` runs every one of them (FR-175). */
function sensorRunCommandOf(signal: string, agent?: AgentProvider): string {
  return `cw sensor run ${signal}${agent === undefined ? "" : ` --agent ${agent.name}`}`;
}

/** Every sensor the last build compiled, in order of id: what
 *  `cw sensor run <signal>` reads, since it reads no charter (FR-179). */
export class BuiltSensors {
  static readonly runCommandOf: typeof sensorRunCommandOf = sensorRunCommandOf;

  static readonly of: typeof keptBuiltSensorsOf = keptBuiltSensorsOf;

  constructor(readonly sensors: readonly BuiltSensor[]) {}

  /** Select only sensors that support the host raising the signal. */
  forAgent(agent: AgentProvider): BuiltSensors {
    return new BuiltSensors(this.sensors.filter((builtSensor) => {
      const agentProviders = builtSensor["agent-provider"];
      return agentProviders === undefined || agentProviders.length === 0 || agentProviders.includes(agent.name);
    }));
  }

  /** What it is among the parts of a build's output: the whole charter's,
   *  every host's. */
  static get outputPart(): OutputPart {
    return OutputPart.ofCharter("sensors", "sensors.json");
  }

  get outputPart(): OutputPart {
    return BuiltSensors.outputPart;
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

/**
 * The sensors the last build compiled, from the text it kept (CORE-FR-179):
 * never the charter, so a sensor runs as built.
 *
 * No list, or one that does not read, is no sensor: what reads it is a hook,
 * and the host is given that hook only by a build that wrote the list.
 */
function keptBuiltSensorsOf(sensorsText: string | undefined): BuiltSensors {
  try {
    const sensorsJson: unknown = JSON.parse(sensorsText ?? "{}");
    const sensors = (sensorsJson as { sensors?: unknown }).sensors;
    if (Array.isArray(sensors)) return new BuiltSensors((sensors as readonly BuiltSensor[]).map((builtSensor) => new BuiltSensor(builtSensor)));
  } catch {
    // Said below, as no list is.
  }
  return new BuiltSensors([]);
}

