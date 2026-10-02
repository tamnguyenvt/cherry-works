/**
 * DOMAIN MODEL — a greeting, and the rule for which one fits the hour.
 *
 * Pure: it is handed the hour rather than asking a clock, so it holds no port
 * and a test needs nothing but values. Replace it with the first real model.
 */
export class Greeting {
  /**
   * @param {string} salutation
   * @param {string} visitorName
   */
  constructor(salutation, visitorName) {
    /** @readonly */
    this.salutation = salutation;
    /** @readonly */
    this.visitorName = visitorName;
  }

  /**
   * @param {number} hour
   * @param {string} visitorName
   * @returns {Greeting}
   */
  static forHour(hour, visitorName) {
    const trimmedName = visitorName.trim();
    if (trimmedName === "") throw new Error("a visitor is greeted by name, and none was given");
    const salutation = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
    return new Greeting(salutation, trimmedName);
  }
}
