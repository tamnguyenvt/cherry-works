import type { ForTellingTime } from "../app/port/out/telling-time.port.js";

/** DRIVEN ADAPTER: the system clock. */
export class SystemClock implements ForTellingTime {
  tellTime(): Date {
    return new Date();
  }
}
