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

  static forHour(hour: number, visitorName: string): Greeting {
    const trimmedName = visitorName.trim();
    if (trimmedName === "") throw new Error("a visitor is greeted by name, and none was given");
    const salutation = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
    return new Greeting(salutation, trimmedName);
  }
}
