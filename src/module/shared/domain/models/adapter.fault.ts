import { DomainFault } from "./domain.fault.js";

/**
 * What a driven adapter raises when what stands behind its port refuses: git,
 * the credential store. Nothing is wrong with the charter; the message says
 * what the tool said, and the fix what to check on this machine.
 *
 * A `DomainFault` still, so a driver reports it as it reports any other: one
 * message, one next move.
 */
export class AdapterFault extends DomainFault {}

/** What an adapter raises when an mcp origin refuses the credential a call was made
 *  with (`401`): the one refusal the caller can do something about, by renewing
 *  and asking again (FR-151). */
export class UnauthorizedMcpFault extends AdapterFault {}
