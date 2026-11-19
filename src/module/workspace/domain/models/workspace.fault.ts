import { DomainFault } from "../../../shared/module.js";

/**
 * What the workspace's settings refuse, whatever the adapters say. Each is a class of its own where a driver tells it
 * apart, by the `name` its fault DTO carries, never by the class.
 */

/** Setup given no agent to choose (FR-033). */
export class NoAgentFault extends DomainFault {}

/** An agent this engine compiles for none of (FR-033). */
export class UnknownAgentFault extends DomainFault {}

/** A main-context ceiling that is no whole number above 0 (EVAL-FR-006). */
export class InvalidMainContextCeilingFault extends DomainFault {}

/** A repository never set up, asked to be marked a vendor's (VENDOR-FR-027). */
export class UnsetWorkspaceFault extends DomainFault {}

/**
 * One thing wrong with what a repository configured itself with: settings that
 * are not JSON, that hold something other than a set of fields, or that write a
 * field as something it cannot be read as (FR-037).
 *
 * Its own file is the file that has to change, and that file is nobody's
 * primitive — which is what tells it apart from the two below.
 */
export class InvalidSettingsFault extends DomainFault {}
