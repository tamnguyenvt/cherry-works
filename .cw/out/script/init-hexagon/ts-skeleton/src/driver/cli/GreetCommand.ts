import type { ForGreetingVisitors } from "../../hexagon/port/driver/ForGreetingVisitors.js";

/**
 * DRIVING ADAPTER — turns a command line into a call on a driver port and the
 * answer back into text. It parses and prints; it decides nothing.
 */
export class GreetCommand {
  readonly #visitorGreetingApp: ForGreetingVisitors;

  constructor(visitorGreetingApp: ForGreetingVisitors) {
    this.#visitorGreetingApp = visitorGreetingApp;
  }

  async run(commandArguments: readonly string[]): Promise<number> {
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
