/** @typedef {import("../../hexagon/port/driver/ForGreetingVisitors.js").ForGreetingVisitors} ForGreetingVisitors */

/**
 * DRIVING ADAPTER — turns a command line into a call on a driver port and the
 * answer back into text. It parses and prints; it decides nothing.
 */
export class GreetCommand {
  /** @type {ForGreetingVisitors} */
  #visitorGreetingApp;

  /** @param {ForGreetingVisitors} visitorGreetingApp */
  constructor(visitorGreetingApp) {
    this.#visitorGreetingApp = visitorGreetingApp;
  }

  /**
   * @param {readonly string[]} commandArguments
   * @returns {Promise<number>}
   */
  async run(commandArguments) {
    const visitorName = commandArguments.join(" ");
    try {
      const greetingDTO = await this.#visitorGreetingApp.greet(visitorName);
      console.log(greetingDTO.text);
      return 0;
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error));
      return 1;
    }
  }
}
