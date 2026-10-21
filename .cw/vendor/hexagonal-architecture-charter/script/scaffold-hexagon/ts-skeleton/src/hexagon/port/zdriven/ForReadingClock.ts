import { ClockUnreadableFault } from "./AdapterFault.js";

export { ClockUnreadableFault };

/**
 * DRIVEN PORT — what the hexagon asks of the world outside. Named after what
 * its adapter deals in (a clock knows instants, not greetings), so any clock
 * — the system's, a test's fixed one — can fill it without learning the domain.
 */
export interface ForReadingClock {
  /** The instant it is now; throws `ClockUnreadableFault` when it cannot tell. */
  now(): Date;
}
