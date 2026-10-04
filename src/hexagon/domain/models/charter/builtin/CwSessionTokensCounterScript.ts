import { ScriptPrimitive } from "../primitive/ScriptPrimitive.js";
import { BUILTIN_PRIMITIVE_LAYER } from "../PrimitiveLayer.js";
// Its text, not the module: it runs on the developer's machine when the agent
// stops, never here.
import sessionTokensCounterMjs from "./scripts/sessionTokensCounter.mjs";

/** The engine's own counter of a session's tokens, run by
 *  `cw-session-tokens-counter-on-stop` each time the agent stops (EVAL-FR-008). */
export class CwSessionTokensCounterScript extends ScriptPrimitive {
  constructor() {
    super(
      {
        id: "cw-session-tokens-counter",
        description: "Count the session's tokens when the agent stops, keep them on this machine, and say so at every mark.",
        executionPath: "./sessionTokensCounter.mjs",
      },
      `This script is cw's own. It comes with the engine, is not authored in this
repository, and cannot be changed here.

Run when the agent stops, with Claude Code's Stop event on its standard input,
it counts the session's tokens so far — input, output, written to and read from
the cache — subagents included, off Claude Code's own transcript of the
session. Each stop is kept as one line of
\`<session id>/session-analysis.jsonl\`, on this machine: under
\`~/.cherry-works/<the repository's path>/\`, each character of the path that is
not a letter or a digit written as a dash, or in the \`sessionAnalysisFolder\`
of \`.cw/settings.json\`. Nothing is committed or sent
anywhere.

When the session crosses a mark — every 100,000 tokens, or the
\`sessionContextMark\` of \`.cw/settings.json\` — the developer is shown one line with
its tokens. The model is sent nothing of it.

A transcript it cannot read is left alone: nothing is shown or kept, and the
agent stops as it would have.`,
      [{ file: "sessionTokensCounter.mjs", contents: sessionTokensCounterMjs }],
      BUILTIN_PRIMITIVE_LAYER,
    );
  }
}
