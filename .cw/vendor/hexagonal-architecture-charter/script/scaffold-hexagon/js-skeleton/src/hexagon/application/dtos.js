/**
 * What the use cases answer with, made from what the domain decided: one
 * function per DTO, named for the DTO it makes.
 *
 * @typedef {import("../domain/models/DomainFault.js").DomainFault} DomainFault
 * @typedef {import("../port/driver/dtos/data.js").FaultDTO} FaultDTO
 */
// @example-start
/**
 * @typedef {import("../domain/models/Greeting.js").Greeting} Greeting
 * @typedef {import("../port/driver/dtos/data.js").GreetingDTO} GreetingDTO
 */
// @example-end

/**
 * What a driver is told in place of an internal fault, which says how the system is set up.
 * @type {FaultDTO}
 */
const INTERNAL_FAULT_DTO = {
  type: "Fault",
  data: {
    name: "InternalFault",
    message: "Something went wrong on our side.",
    fix: "Try again in a moment. If it keeps happening, tell whoever runs this system.",
  },
};

/**
 * One fault as a driver reads it: the person's as it is, an internal one
 * cooked into the system's own words — an `Error` does not survive being sent.
 * @param {DomainFault} fault
 * @returns {FaultDTO}
 */
export function faultDTO({ name, message, fix, internal }) {
  return internal ? INTERNAL_FAULT_DTO : { type: "Fault", data: { name, message, fix } };
}
// @example-start

/**
 * A greeting as a driver reads it: one line of text.
 * @param {Greeting} greeting
 * @returns {GreetingDTO}
 */
export function greetingDTO({ salutation, visitorName }) {
  return { type: "Greeting", data: { text: `${salutation}, ${visitorName}.` } };
}
// @example-end
