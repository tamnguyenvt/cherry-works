/**
 * DRIVEN PORT — the clock of this machine. The hexagon asks what time it is
 * and is told; which clock answers is the adapter's business.
 */
export interface ForTellingTime {
  /** This moment. */
  now(): Date;
}
