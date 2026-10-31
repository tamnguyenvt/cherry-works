import { EXIT_OK, type Command, type Context, type OptionSpec, type Options, type Outcome } from "./Command.js";

const OPTIONS = {
  log: { type: "string", describe: "Read one case.json path printed by cw eval; otherwise show the latest twenty case logs for this repository" },
  json: { type: "boolean", describe: "Print the saved diagnostics as JSON", default: false },
} as const satisfies OptionSpec;

/** `cw eval-analyze`: read retained promptfoo evidence without spending tokens. */
export class EvalAnalyzeCommand implements Command<typeof OPTIONS> {
  readonly name = "eval-analyze";
  readonly summary = "Read evaluation results, tool evidence and agent session paths without running an agent";
  readonly options = OPTIONS;

  async run({ charterEvaluatingApp }: Context, { log: logFilePath, json: isJson }: Options<typeof OPTIONS>): Promise<Outcome> {
    const evalLogAnalysis = await charterEvaluatingApp.analyze(logFilePath);
    if (isJson) return { code: EXIT_OK, result: `${JSON.stringify(evalLogAnalysis, null, 2)}\n` };
    const { logs: savedLogs } = evalLogAnalysis.data;
    if (savedLogs.length === 0) return { code: EXIT_OK, result: "No saved evaluation log for this repository. Run cw eval first; older runs without retained logs cannot be reconstructed.\n" };
    return {
      code: EXIT_OK,
      result: savedLogs.flatMap((savedLog) => [
        `${savedLog.success ? "PASS" : "FAIL"} ${savedLog.agent} | ${savedLog.createdAt} | ${savedLog.totalTokens.toLocaleString("en-US")} tokens`,
        `Prompt: ${savedLog.prompt}`,
        ...savedLog.unmetReasons.map((reason) => `Reason: ${reason}`),
        ...(savedLog.error === undefined ? [] : [`Provider error: ${savedLog.error}`]),
        `Log: ${savedLog.logPath}`,
        `Promptfoo output: ${savedLog.outputPath}`,
        `stdout: ${savedLog.stdoutPath}`,
        `stderr: ${savedLog.stderrPath}`,
        `Agent session: ${savedLog.sessionId ?? "not returned by provider"}`,
        `Session log: ${savedLog.sessionPath ?? "not found locally"}`,
        `Answer:\n${savedLog.answer || "(no answer)"}`,
        `Tool evidence (${savedLog.toolCalls.length}):`,
        ...savedLog.toolCalls.map((toolCall, toolIndex) => {
          let toolText = toolCall;
          try { toolText = JSON.stringify(JSON.parse(toolCall), null, 2); } catch { /* Render unstructured evidence as saved. */ }
          return `Tool ${toolIndex + 1}:\n${toolText.length > 4000 ? `${toolText.slice(0, 4000)}… [truncated; see promptfoo output]` : toolText}`;
        }),
        "",
      ]).join("\n"),
    };
  }
}
