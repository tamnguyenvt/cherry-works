/**
 * DRIVER PORT — what this application offers to whoever calls in: a command
 * line, an HTTP route, a test. Named `For<doing something>` after the
 * conversation it holds, and answering DTOs, never a model.
 *
 * A port in JavaScript is a JSDoc type: it costs nothing at runtime, and the
 * type checker (`checkJs`) holds every implementation to it.
 *
 * @typedef {import("./dtos/GreetingDTO.js").GreetingDTO} GreetingDTO
 *
 * @typedef {object} ForGreetingVisitors
 * @property {(visitorName: string) => Promise<GreetingDTO>} greet
 *   Greet one visitor, by name, as fits the hour it is now.
 */

export {};
