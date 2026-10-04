import type { ForTellingTime } from "#hexagon/port/zdriven/ForTellingTime.js";

/** A clock stopped at one moment, so a test knows what today is. */
export class InMemoryClock implements ForTellingTime {
  constructor(private readonly moment: Date) {}

  now(): Date {
    return this.moment;
  }
}
