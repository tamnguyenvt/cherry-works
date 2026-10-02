import { Greeting } from "../domain/models/Greeting.js";

/**
 * @typedef {import("../port/driver/ForGreetingVisitors.js").ForGreetingVisitors} ForGreetingVisitors
 * @typedef {import("../port/driver/ForGreetingVisitors.js").GreetingDTO} GreetingDTO
 * @typedef {import("../port/zdriven/ForReadingClock.js").ForReadingClock} ForReadingClock
 */

/**
 * APPLICATION SERVICE — implements a driver port. It orchestrates: reads
 * through driven ports, asks the domain to decide, turns the model into a DTO.
 * It holds no rule of its own; a rule found here belongs in the domain.
 *
 * @implements {ForGreetingVisitors}
 */
export class VisitorGreeting {
  /** @type {ForReadingClock} */
  #clock;

  /** @param {ForReadingClock} clock */
  constructor(clock) {
    this.#clock = clock;
  }

  /**
   * @param {string} visitorName
   * @returns {Promise<GreetingDTO>}
   */
  async greet(visitorName) {
    const greeting = Greeting.forHour(this.#clock.now().getHours(), visitorName);
    return { text: `${greeting.salutation}, ${greeting.visitorName}.` };
  }
}
