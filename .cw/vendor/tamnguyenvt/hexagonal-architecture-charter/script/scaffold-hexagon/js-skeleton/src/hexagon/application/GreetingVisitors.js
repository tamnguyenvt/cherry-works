import { DomainFault } from "../domain/models/DomainFault.js";
import { Greeting } from "../domain/models/Greeting.js";
import { LogService } from "../service/LogService.js";
import { faultDTO, greetingDTO } from "./dtos.js";

/**
 * @typedef {import("../port/driver/ForGreetingVisitors.js").ForGreetingVisitors} ForGreetingVisitors
 * @typedef {import("../port/driver/ForGreetingVisitors.js").GreetingDTO} GreetingDTO
 * @typedef {import("../port/driver/ForGreetingVisitors.js").FaultDTO} FaultDTO
 * @typedef {import("../port/zdriven/ForReadingClock.js").ForReadingClock} ForReadingClock
 * @typedef {import("../port/zdriven/ForWritingLogs.js").ForWritingLogs} ForWritingLogs
 */

/**
 * USE CASE — implements a driver port, and is named after it as a noun,
 * without its `For`. It orchestrates: reads through driven ports or services,
 * asks the domain to decide, turns the answer — a fault included — into a DTO.
 * It stays light: a rule belongs in the domain, logic that grows in a service.
 *
 * @implements {ForGreetingVisitors}
 */
export class GreetingVisitors {
  /** @type {ForReadingClock} */
  #clock;
  /** @type {ForWritingLogs} */
  #logs;

  /**
   * @param {ForReadingClock} clock
   * @param {ForWritingLogs} logs
   */
  constructor(clock, logs) {
    this.#clock = clock;
    this.#logs = logs;
  }

  /**
   * @param {string} visitorName
   * @returns {Promise<GreetingDTO | FaultDTO>}
   */
  async greet(visitorName) {
    try {
      return greetingDTO(Greeting.greetingOf(this.#clock.now().getHours(), visitorName));
    } catch (error) {
      if (!(error instanceof DomainFault)) throw error;
      LogService.logFault(this.#logs, error);
      return faultDTO(error);
    }
  }
}
