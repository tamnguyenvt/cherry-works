import { DomainFault } from "../../domain/models/DomainFault.js";

/**
 * ADAPTER FAULT — what a driven adapter raises when what stands behind its
 * port refuses or cannot be reached. Add the adapters' faults here, each
 * extending it; each driven port re-exports the ones its adapters raise.
 */
export class AdapterFault extends DomainFault {}
// @example-start

/** The clock could not be read — the system's own fault, so internal. */
export class ClockUnreadableFault extends AdapterFault {}
// @example-end
