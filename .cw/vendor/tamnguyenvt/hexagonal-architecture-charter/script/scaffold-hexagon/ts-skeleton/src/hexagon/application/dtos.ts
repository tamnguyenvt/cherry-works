import type { DomainFault } from "../domain/models/DomainFault.js";
// @example-start
import type { Greeting } from "../domain/models/Greeting.js";
// @example-end
import type { DataDTOs } from "../port/driver/dtos/index.js";

/**
 * What the use cases answer with, made from what the domain decided: one
 * function per DTO, named for the DTO it makes.
 */

/** What a driver is told in place of an internal fault, which says how the system is set up. */
const INTERNAL_FAULT_DTO: DataDTOs.Fault = {
  type: "Fault",
  data: {
    name: "InternalFault",
    message: "Something went wrong on our side.",
    fix: "Try again in a moment. If it keeps happening, tell whoever runs this system.",
  },
};

/** One fault as a driver reads it: the person's as it is, an internal one
 *  cooked into the system's own words — an `Error` does not survive being sent. */
export function faultDTO({ name, message, fix, internal }: DomainFault): DataDTOs.Fault {
  return internal ? INTERNAL_FAULT_DTO : { type: "Fault", data: { name, message, fix } };
}
// @example-start

/** A greeting as a driver reads it: one line of text. */
export function greetingDTO({ salutation, visitorName }: Greeting): DataDTOs.Greeting {
  return { type: "Greeting", data: { text: `${salutation}, ${visitorName}.` } };
}
// @example-end
