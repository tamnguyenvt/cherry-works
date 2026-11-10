import assert from "node:assert/strict";
import type { FaultDTOs } from "../src/module/shared/app/port/in/fault.dto.js";

/** What a use case answered, where the test expects no fault: a fault fails the
 *  test with what it said (SDK-FR-004). */
export function answerOf<Answer>(answer: Answer | FaultDTOs.Fault): Answer {
  const isFault = typeof answer === "object" && answer !== null && "type" in answer && answer.type === "Fault";
  assert.ok(!isFault, `the use case answered a fault: ${JSON.stringify(answer)}`);
  return answer as Answer;
}

/** The portal started, where the test expects it to start: what refused it
 *  fails the test with what it said. */
export function startedPortalOf<StartedPortal extends object>(startedPortal: StartedPortal | string): StartedPortal {
  assert.ok(typeof startedPortal !== "string", `the portal did not start: ${startedPortal}`);
  return startedPortal;
}

/** The fault a use case answered with, where the test expects one: anything
 *  else fails the test (SDK-FR-004). */
export function faultOf(answer: unknown): FaultDTOs.Fault["data"] {
  const isFault = typeof answer === "object" && answer !== null && "type" in answer && answer.type === "Fault";
  assert.ok(isFault, `the use case answered no fault: ${JSON.stringify(answer)}`);
  return (answer as FaultDTOs.Fault).data;
}

/** The words of the fault a use case answered with, its message and under it
 *  its fix, where the test expects one. */
export function faultTextOf(answer: unknown): string {
  const { message, fix } = faultOf(answer);
  return `${message}\n  ${fix}`;
}
