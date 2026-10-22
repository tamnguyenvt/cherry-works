import type { OutcomeDTOs } from "./dtos/index.js";

/**
 * DRIVER PORT — the sensors of one signal, run when the host fires it
 * (CORE-FR-176 – CORE-FR-179).
 *
 * Apart from `ForManagingCharter` because it reads no charter: what it runs is
 * `.cw/out/sensors.json`, the list the last build wrote, so a sensor runs as
 * built. It holds no port that writes a file.
 */
export interface ForRunningSensors {
  /**
   * Run every sensor of `signal` at once, each handed `stdin`, and answer what
   * they came to as one command: the exit code, the one answer, and the error
   * output. A signal no sensor names, or a repository never built, runs
   * nothing and answers 0 with nothing said.
   */
  runSensors(signal: string, stdin: string): Promise<OutcomeDTOs.SensorRunOutcome>;
}
