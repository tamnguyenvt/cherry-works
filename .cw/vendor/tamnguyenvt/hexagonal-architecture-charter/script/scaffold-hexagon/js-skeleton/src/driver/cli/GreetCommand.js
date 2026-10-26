/** @typedef {import("../../hexagon/port/driver/ForGreetingVisitors.js").ForGreetingVisitors} ForGreetingVisitors */

/**
 * DRIVING ADAPTER — turns a command line into a call on a driver port and the
 * answer back into text. It parses and prints; it decides nothing.
 */
export class GreetCommand {
  /** @type {ForGreetingVisitors} */
  #greetingVisitors;

  /** @param {ForGreetingVisitors} greetingVisitors */
  constructor(greetingVisitors) {
    this.#greetingVisitors = greetingVisitors;
  }

  /**
   * @param {readonly string[]} commandArguments
   * @returns {Promise<number>}
   */
  async run(commandArguments) {
    const greetingAnswer = await this.#greetingVisitors.greet(commandArguments.join(" "));
    if (greetingAnswer.type === "Fault") {
      console.error(`${greetingAnswer.data.message} ${greetingAnswer.data.fix}`);
      return 1;
    }
    console.log(greetingAnswer.data.text);
    return 0;
  }
}
