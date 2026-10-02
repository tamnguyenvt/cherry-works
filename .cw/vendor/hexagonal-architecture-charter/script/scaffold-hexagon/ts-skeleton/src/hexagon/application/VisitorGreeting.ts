import { Greeting } from "../domain/models/Greeting.js";
import type { ForGreetingVisitors, GreetingDTO } from "../port/driver/ForGreetingVisitors.js";
import type { ForReadingClock } from "../port/zdriven/ForReadingClock.js";

/**
 * APPLICATION SERVICE — implements a driver port. It orchestrates: reads
 * through driven ports, asks the domain to decide, turns the model into a DTO.
 * It holds no rule of its own; a rule found here belongs in the domain.
 */
export class VisitorGreeting implements ForGreetingVisitors {
  readonly #clock: ForReadingClock;

  constructor(clock: ForReadingClock) {
    this.#clock = clock;
  }

  async greet(visitorName: string): Promise<GreetingDTO> {
    const greeting = Greeting.forHour(this.#clock.now().getHours(), visitorName);
    return { text: `${greeting.salutation}, ${greeting.visitorName}.` };
  }
}
