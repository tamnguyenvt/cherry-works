export { DataDTOs } from "./dtos/index.js";

/**
 * DRIVER PORT — what this application offers to whoever calls in: a command
 * line, an HTTP route, a test. Named `For<doing something>` after the
 * conversation it holds, and answering DTOs — a fault included — never a model
 * or a fault class.
 *
 * A port in JavaScript is a JSDoc type: it costs nothing at runtime, and the
 * type checker (`checkJs`) holds every implementation to it.
 *
 * @typedef {import("./dtos/data.js").GreetingDTO} GreetingDTO
 * @typedef {import("./dtos/data.js").FaultDTO} FaultDTO
 *
 * @typedef {object} ForGreetingVisitors
 * @property {(visitorName: string) => Promise<GreetingDTO | FaultDTO>} greet
 *   Greet one visitor, by name, as fits the hour it is now.
 */
