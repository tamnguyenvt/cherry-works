import type { ForGreetingVisitors } from "../../hexagon/port/driver/ForGreetingVisitors.js";

/**
 * DRIVING ADAPTER — turns a command line into a call on a driver port and the
 * answer back into text. It parses and prints; it decides nothing.
 */
export class GreetCommand {
  readonly #greetingVisitors: ForGreetingVisitors;

  constructor(greetingVisitors: ForGreetingVisitors) {
    this.#greetingVisitors = greetingVisitors;
  }

  async run(commandArguments: readonly string[]): Promise<number> {
    const greetingAnswer = await this.#greetingVisitors.greet(commandArguments.join(" "));
    if (greetingAnswer.type === "Fault") {
      console.error(`${greetingAnswer.data.message} ${greetingAnswer.data.fix}`);
      return 1;
    }
    console.log(greetingAnswer.data.text);
    return 0;
  }
}
