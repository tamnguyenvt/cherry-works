import { ApplicationFault, DomainFault } from "../../../shared/module.js";

/**
 * What the workspace's application refuses, whatever the domain and the
 * adapters say. Each is a class of its own where a driver tells it
 * apart, by the `name` its fault DTO carries, never by the class.
 */

/** Setup given no agent to compile for (FR-033). */
export class NoAgentFault extends ApplicationFault {}

/** An agent this engine compiles for none of (FR-033). */
export class UnknownAgentFault extends ApplicationFault {}

/** A main-context ceiling that is no whole number above 0 (EVAL-FR-006). */
export class InvalidMainContextCeilingFault extends ApplicationFault {}

/**
 * One thing wrong with what a repository configured itself with: settings that
 * are not JSON, that hold something other than a set of fields, or that write a
 * field as something it cannot be read as (FR-037).
 *
 * Its own file is the file that has to change, and that file is nobody's
 * primitive — which is what tells it apart from the two below.
 */
export class InvalidSettingsFault extends DomainFault {}
