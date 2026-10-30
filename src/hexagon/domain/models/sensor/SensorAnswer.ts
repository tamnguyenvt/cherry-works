/** What one sensor's command came to, or what every sensor of a signal came
 *  to together: the exit code, the answer on standard output, and the error
 *  output. */
export interface SensorAnswer {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
}

/** The signals whose plain answer this host adds to the agent's context
 *  rather than only showing it. */
const CONTEXT_SIGNALS: readonly string[] = ["UserPromptSubmit", "SessionStart", "SubagentStart"];

/** Each permission decision, the one that stops more first. */
const PERMISSION_DECISIONS: readonly string[] = ["deny", "ask", "allow"];

/**
 * What the sensors of one signal answer the host with, as one command, given
 * each one's answer in order of id (FR-177, FR-178).
 *
 * The exit code is 2 where any exited 2, with the error output of each that
 * did; else the first other non-zero, with the error output of each that
 * failed; else 0, and none.
 *
 * The answers are combined the way Claude, the one host so far, combines the
 * answers of several hooks on one event, so it acts as it did when given one
 * hook per sensor (SC-048). Plain answers are joined as written. Where any is
 * its structured form, all are read into one: a block, `continue: false` and
 * the most restrictive permission decision win, and every reason, message and
 * context is kept, joined in order of id; a plain answer is context on a
 * signal whose answer is context, and a message on any other.
 */
export function signalAnswerOf(signal: string, sensorAnswers: readonly SensorAnswer[]): SensorAnswer {
  const blockingAnswers = sensorAnswers.filter((sensorAnswer) => sensorAnswer.exitCode === 2);
  const failedAnswers = sensorAnswers.filter((sensorAnswer) => sensorAnswer.exitCode !== 0);
  const exitCode = blockingAnswers.length > 0 ? 2 : (failedAnswers[0]?.exitCode ?? 0);
  const stderr = (blockingAnswers.length > 0 ? blockingAnswers : failedAnswers).map((sensorAnswer) => sensorAnswer.stderr).join("");

  const answerTexts = sensorAnswers.map((sensorAnswer) => sensorAnswer.stdout.trim()).filter((answerText) => answerText !== "");
  const isPlainObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
  const structuredAnswers = answerTexts.map((answerText) => {
    try {
      const answerJSON: unknown = JSON.parse(answerText);
      return isPlainObject(answerJSON) ? answerJSON : undefined;
    } catch {
      return undefined;
    }
  });
  if (structuredAnswers.every((structuredAnswer) => structuredAnswer === undefined))
    return { exitCode, stdout: answerTexts.map((answerText) => `${answerText}\n`).join(""), stderr };

  const plainTexts = answerTexts.filter((_answerText, index) => structuredAnswers[index] === undefined);
  const answerJSONs = structuredAnswers.filter((structuredAnswer) => structuredAnswer !== undefined);
  const hookSpecificOutputs = answerJSONs.map((answerJSON) => answerJSON["hookSpecificOutput"]).filter(isPlainObject);
  const joinedTextOf = (values: readonly unknown[]) => values.filter((value) => typeof value === "string" && value !== "").join("\n");

  // Any field no rule below speaks for is the first sensor's that set it.
  const combinedAnswer: Record<string, unknown> = Object.assign({}, ...[...answerJSONs].reverse());
  const combinedHookSpecificOutput: Record<string, unknown> = Object.assign({}, ...[...hookSpecificOutputs].reverse());

  const stoppingAnswers = answerJSONs.filter((answerJSON) => answerJSON["continue"] === false);
  if (stoppingAnswers.length > 0) {
    combinedAnswer["continue"] = false;
    combinedAnswer["stopReason"] = joinedTextOf(stoppingAnswers.map((answerJSON) => answerJSON["stopReason"]));
  }
  if ("suppressOutput" in combinedAnswer) combinedAnswer["suppressOutput"] = answerJSONs.every((answerJSON) => answerJSON["suppressOutput"] === true);
  const blockingJSONs = answerJSONs.filter((answerJSON) => answerJSON["decision"] === "block");
  if (blockingJSONs.length > 0) {
    combinedAnswer["decision"] = "block";
    combinedAnswer["reason"] = joinedTextOf(blockingJSONs.map((answerJSON) => answerJSON["reason"]));
  }
  const isContextSignal = CONTEXT_SIGNALS.includes(signal);
  const systemMessage = joinedTextOf([...answerJSONs.map((answerJSON) => answerJSON["systemMessage"]), ...(isContextSignal ? [] : plainTexts)]);
  if (systemMessage !== "") combinedAnswer["systemMessage"] = systemMessage;

  const permissionDecision = PERMISSION_DECISIONS.find((rankedDecision) => hookSpecificOutputs.some((hookSpecificOutput) => hookSpecificOutput["permissionDecision"] === rankedDecision));
  if (permissionDecision !== undefined) {
    combinedHookSpecificOutput["permissionDecision"] = permissionDecision;
    combinedHookSpecificOutput["permissionDecisionReason"] = joinedTextOf(
      hookSpecificOutputs.filter((hookSpecificOutput) => hookSpecificOutput["permissionDecision"] === permissionDecision).map((hookSpecificOutput) => hookSpecificOutput["permissionDecisionReason"]),
    );
  }
  // Claude's PermissionRequest uses a nested decision, unlike PreToolUse's
  // permissionDecision. Preserve denials when another sensor allows first.
  // Claude: https://code.claude.com/docs/en/hooks#permissionrequest-decision-control
  // Codex: https://learn.chatgpt.com/docs/hooks#permissionrequest
  // Codex does not currently support interrupt, updatedInput or updatedPermissions here.
  if (signal === "PermissionRequest") {
    const deniedDecisions = hookSpecificOutputs
      .map((hookSpecificOutput) => hookSpecificOutput["decision"])
      .filter(isPlainObject)
      .filter((decision) => decision["behavior"] === "deny");
    if (deniedDecisions.length > 0) {
      combinedHookSpecificOutput["decision"] = {
        ...deniedDecisions[0],
        message: joinedTextOf(deniedDecisions.map((decision) => decision["message"])),
        ...(deniedDecisions.some((decision) => decision["interrupt"] === true) ? { interrupt: true } : {}),
      };
    }
  }
  const additionalContext = joinedTextOf([...hookSpecificOutputs.map((hookSpecificOutput) => hookSpecificOutput["additionalContext"]), ...(isContextSignal ? plainTexts : [])]);
  if (additionalContext !== "") combinedHookSpecificOutput["additionalContext"] = additionalContext;
  if (Object.keys(combinedHookSpecificOutput).length > 0) combinedAnswer["hookSpecificOutput"] = { ...combinedHookSpecificOutput, hookEventName: signal };

  return { exitCode, stdout: `${JSON.stringify(combinedAnswer)}\n`, stderr };
}
