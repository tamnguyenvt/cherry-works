import type { GreetingDTO } from "./dtos/GreetingDTO.js";

export type { GreetingDTO } from "./dtos/GreetingDTO.js";

/**
 * DRIVER PORT — what this application offers to whoever calls in: a command
 * line, an HTTP route, a test. Named `For<doing something>` after the
 * conversation it holds, and answering DTOs, never a model.
 */
export interface ForGreetingVisitors {
  /** Greet one visitor, by name, as fits the hour it is now. */
  greet(visitorName: string): Promise<GreetingDTO>;
}
