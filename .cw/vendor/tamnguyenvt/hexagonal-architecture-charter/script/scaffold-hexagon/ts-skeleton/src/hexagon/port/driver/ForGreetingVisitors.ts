import type { DataDTOs } from "./dtos/index.js";

export { DataDTOs } from "./dtos/index.js";

/**
 * DRIVER PORT — what this application offers to whoever calls in: a command
 * line, an HTTP route, a test. Named `For<doing something>` after the
 * conversation it holds, and answering DTOs — a fault included — never a model
 * or a fault class.
 */
export interface ForGreetingVisitors {
  /** Greet one visitor, by name, as fits the hour it is now. */
  greet(visitorName: string): Promise<DataDTOs.Greeting | DataDTOs.Fault>;
}
