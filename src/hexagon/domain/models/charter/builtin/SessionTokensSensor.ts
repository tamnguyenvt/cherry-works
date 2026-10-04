import { SensorPrimitive } from "../primitive/SensorPrimitive.js";
import { BUILTIN_PRIMITIVE_LAYER } from "../PrimitiveLayer.js";

/** What runs `session-tokens-counter` each time the agent stops, so a built
 *  charter counts every session with nothing written by the repository
 *  (EVAL-FR-008). */
export class SessionTokensSensor extends SensorPrimitive {
  constructor() {
    super(
      {
        id: "session-tokens-counter-on-stop",
        description: "Count the session's tokens each time the agent stops.",
        signal: "Stop",
        run: 'node "[[session-tokens-counter]]"',
      },
      `This sensor is cw's own. It comes with the engine, is not authored in this
repository, and cannot be changed here.

When the agent stops, [[session-tokens-counter]] counts the session's tokens and
keeps them on this machine. It shows the developer one line only when the
session crosses a mark, and never holds the stop up.`,
      [],
      BUILTIN_PRIMITIVE_LAYER,
    );
  }
}
