import { OUT_DIRECTORY } from "../../../path.js";
import type { Projection } from "../ProjectionPolicy.js";

/** One sensor as a build leaves it: its id, the signal it fires on, and the
 *  command that runs, each script it names written as its built file (FR-169). */
export interface BuiltSensor {
  readonly id: string;
  readonly signal: string;
  readonly command: string;
}

/** The one command a host is given for a signal its charter's sensors fire
 *  on, whichever host: `cw` runs every one of them (FR-175). */
export function sensorRunCommandOf(signal: string): string {
  return `cw sensor run ${signal}`;
}

/** Every sensor the last build compiled, in order of id: what
 *  `cw sensor run <signal>` reads, since it reads no charter (FR-179). */
export class BuiltSensors {
  constructor(readonly sensors: readonly BuiltSensor[]) {}

  /** The file it is put down as, in the output folder: generated, and the
   *  charter's alone. Indented, since it is committed and read in diffs when a
   *  sensor's command changes. */
  get projections(): readonly Projection[] {
    return [
      {
        file: `${OUT_DIRECTORY}/sensors.json`,
        contents: `${JSON.stringify({ sensors: this.sensors }, undefined, 2)}\n`,
        projectionPolicy: "replace",
        executable: false,
      },
    ];
  }

  /** Every signal at least one sensor names, each once, in the order the
   *  sensors name them. */
  get signals(): readonly string[] {
    return [...new Set(this.sensors.map((builtSensor) => builtSensor.signal))];
  }
}
