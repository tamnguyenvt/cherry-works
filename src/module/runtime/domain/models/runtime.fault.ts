import { ApplicationFault } from "../../../shared/module.js";

/**
 * What runtime's application refuses, whatever the domain and the adapters say. Each is a class of its own where a driver tells it
 * apart, by the `name` its fault DTO carries, never by the class.
 */

/** An agent whose own command line is not installed here (EVAL-FR-026). */
export class AgentCliMissingFault extends ApplicationFault {}

/** An exact count asked for an agent with no command line to count by
 *  (EVAL-FR-004). */
export class ExactCountUnsupportedFault extends ApplicationFault {}

/** A call naming a tool this server does not serve (FR-153). */
export class UnknownToolFault extends ApplicationFault {}

/** A call the mcp origin refused the credential for (FR-151, FR-154). */
export class McpCredentialFault extends ApplicationFault {}

/** A call to an mcp origin by an engine set up with no way to reach one: the
 *  system's own, never the caller's (FR-154). */
export class McpServersMissingFault extends ApplicationFault {}
