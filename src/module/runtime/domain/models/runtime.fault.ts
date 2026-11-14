import { ApplicationFault, DomainFault } from "../../../shared/module.js";

/**
 * What runtime's application and domain refuse, whatever the adapters say. Each is a class of its own where a driver tells it
 * apart, by the `name` its fault DTO carries, never by the class.
 */

/** An agent whose own command line is not installed here (EVAL-FR-026). */
export class MissingAgentCliFault extends ApplicationFault {}

/** An exact count asked for an agent with no command line to count by
 *  (EVAL-FR-004). */
export class UnsupportedExactCountFault extends ApplicationFault {}

/** An exact count asked for an agent the repository did not choose
 *  (EVAL-FR-004). */
export class UnchosenExactCountAgentFault extends ApplicationFault {}

/** An exact count of a primitive the estimate beside it does not hold: the
 *  engine's own fault (EVAL-FR-004). */
export class MissingEstimateFault extends ApplicationFault {}

/** A call naming a tool this server does not serve (FR-153). */
export class UnknownToolFault extends ApplicationFault {}

/** A call the mcp origin refused the credential for (FR-151, FR-154). */
export class RefusedMcpCredentialFault extends ApplicationFault {}

/** A call to an mcp origin by an engine set up with no way to reach one: the
 *  system's own, never the caller's (FR-154). */
export class MissingMcpServersFault extends ApplicationFault {}

/** A day of a session span not written as `YYYY-MM-DD`, or one the calendar
 *  does not hold (EVAL-FR-030). */
export class InvalidDayFault extends DomainFault {}

/** A session span ending before it starts (EVAL-FR-030). */
export class ReversedSessionSpanFault extends DomainFault {}

/** A session span longer than a summary spans (EVAL-FR-030). */
export class OverlongSessionSpanFault extends DomainFault {}

/** An evaluation asked of an agent this engine does not compile for
 *  (EVAL-FR-038). */
export class UnsupportedEvaluationAgentFault extends DomainFault {}

/** An evaluation in a repository that chose no agent this engine can
 *  evaluate with (EVAL-FR-035). */
export class NoEvaluationAgentFault extends DomainFault {}

/** An evaluation asked of an agent the repository did not choose
 *  (EVAL-FR-034). */
export class UnchosenEvaluationAgentFault extends DomainFault {}

/** An evaluation in a repository that chose several agents and named none
 *  (EVAL-FR-033). */
export class UnnamedEvaluationAgentFault extends DomainFault {}
