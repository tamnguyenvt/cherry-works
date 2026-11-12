import type { ForTellingTime } from "../../app/port/out/telling-time.port.js";

/** A clock stopped at one moment, so a test knows what today is. */
export class InMemoryClock implements ForTellingTime {
  constructor(private readonly moment: Date) {}

  tellTime(): Date {
    return this.moment;
  }
}
