import { signalAnswerOf } from "../domain/models/sensor/SensorAnswer.js";
import type { OutcomeDTOs } from "../port/driver/dtos/index.js";
import type { ForRunningSensors } from "../port/driver/ForRunningSensors.js";
import type { ForReadingFiles } from "../port/zdriven/ForReadingFiles.js";
import type { ForRunningShellCommands } from "../port/zdriven/ForRunningShellCommands.js";
import { loadBuiltSensors } from "../service/sensorsRepo.js";
import { sensorRunOutcomeDTO } from "./dtos.js";
import type { AgentProvider } from "../domain/models/AgentProvider.js";

/**
 * APPLICATION SERVICE — the sensors of one signal, run as one hook
 * (CORE-FR-176 – CORE-FR-179).
 *
 * Reads the list the last build wrote and runs each command it holds for the
 * signal in the repository's root, all at once; it is handed no writing port
 * (FR-041). How their answers come to one is `signalAnswerOf`'s.
 */
export class SensorRunning implements ForRunningSensors {
  readonly #repoPath: URL;
  readonly #fileReader: ForReadingFiles;
  readonly #shell: ForRunningShellCommands;

  constructor(repoPath: URL, fileReader: ForReadingFiles, shell: ForRunningShellCommands) {
    this.#repoPath = repoPath;
    this.#fileReader = fileReader;
    this.#shell = shell;
  }

  async runSensors(signal: string, stdin: string, agent: AgentProvider = "claude"): Promise<OutcomeDTOs.SensorRunOutcome> {
    const builtSensors = await loadBuiltSensors(this.#repoPath, this.#fileReader);
    // Each runs to its end whatever the others do: one failing stops none.
    const sensorAnswers = await Promise.all(
      builtSensors.forAgent(agent).sensors
        .filter((builtSensor) => builtSensor.signal === signal)
        .map((builtSensor) => this.#shell.runShellCommand(builtSensor.command, this.#repoPath, stdin)),
    );
    return sensorRunOutcomeDTO(signalAnswerOf(signal, sensorAnswers));
  }
}
