import { DomainFault } from "../domain/models/DomainFault.js";
import { Greeting } from "../domain/models/Greeting.js";
import type { DataDTOs, ForGreetingVisitors } from "../port/driver/ForGreetingVisitors.js";
import type { ForReadingClock } from "../port/zdriven/ForReadingClock.js";
import type { ForWritingLogs } from "../port/zdriven/ForWritingLogs.js";
import { LogService } from "../service/LogService.js";
import { faultDTO, greetingDTO } from "./dtos.js";

/**
 * USE CASE — implements a driver port, and is named after it as a noun,
 * without its `For`. It orchestrates: reads through driven ports or services,
 * asks the domain to decide, turns the answer — a fault included — into a DTO.
 * It stays light: a rule belongs in the domain, logic that grows in a service.
 */
export class GreetingVisitors implements ForGreetingVisitors {
  readonly #clock: ForReadingClock;
  readonly #logs: ForWritingLogs;

  constructor(clock: ForReadingClock, logs: ForWritingLogs) {
    this.#clock = clock;
    this.#logs = logs;
  }

  async greet(visitorName: string): Promise<DataDTOs.Greeting | DataDTOs.Fault> {
    try {
      return greetingDTO(Greeting.greetingOf(this.#clock.now().getHours(), visitorName));
    } catch (error) {
      if (!(error instanceof DomainFault)) throw error;
      LogService.logFault(this.#logs, error);
      return faultDTO(error);
    }
  }
}
