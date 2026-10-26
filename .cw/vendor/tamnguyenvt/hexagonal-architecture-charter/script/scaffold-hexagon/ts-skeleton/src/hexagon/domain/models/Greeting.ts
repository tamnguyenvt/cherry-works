import { NamelessVisitorFault } from "./DomainFault.js";

/**
 * DOMAIN MODEL — a greeting, and the rule for which one fits the hour.
 *
 * Pure: it is handed the hour rather than asking a clock, so it holds no port
 * and a test needs nothing but values. Replace it with the first real model.
 */
export class Greeting {
  private constructor(
    readonly salutation: string,
    readonly visitorName: string,
  ) {}

  /** The greeting that fits this hour; a visitor with no name is refused. */
  static greetingOf(hour: number, visitorName: string): Greeting {
    const trimmedName = visitorName.trim();
    if (trimmedName === "") {
      throw new NamelessVisitorFault("A visitor is greeted by name, and none was given.", "Give a name.", {
        internal: false,
      });
    }
    const salutation = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
    return new Greeting(salutation, trimmedName);
  }
}
