import {
  type Command,
  type Context,
  EXIT_FAILURE,
  EXIT_OK,
  type OptionSpec,
  type Options,
  type Outcome,
} from "./command.interface.js";
import { printFault } from "./helper.js";

const OPTIONS = {
  log: {
    type: "string",
    describe:
      "Read one case.json path printed by cw eval; otherwise show the latest twenty case logs for this repository",
  },
  json: { type: "boolean", describe: "Print the saved diagnostics as JSON", default: false },
} as const satisfies OptionSpec;

/** `cw eval-analyze`: read retained promptfoo evidence without spending tokens. */
export class EvalAnalyzeCommand implements Command<typeof OPTIONS> {
  readonly name = "eval-analyze";
  readonly summary = "Read evaluation results, tool evidence and agent session paths without running an agent";
  readonly options = OPTIONS;

  async runCommand(
    { charterRuntimeApp }: Context,
    { log: logFilePath, json: isJson }: Options<typeof OPTIONS>,
  ): Promise<Outcome> {
    const evalLogAnalysisDTO = await charterRuntimeApp.analyzeEvalLog(logFilePath);
    if (evalLogAnalysisDTO.type === "Fault")
      return { exitCode: EXIT_FAILURE, problemText: printFault(evalLogAnalysisDTO) };
    if (isJson) return { exitCode: EXIT_OK, resultText: `${JSON.stringify(evalLogAnalysisDTO, null, 2)}\n` };
    const { logs: savedLogs } = evalLogAnalysisDTO.data;
    if (savedLogs.length === 0)
      return {
        exitCode: EXIT_OK,
        resultText:
          "No saved evaluation log for this repository. Run cw eval first; older runs without retained logs cannot be reconstructed.\n",
      };
    return {
      exitCode: EXIT_OK,
      resultText: savedLogs
        .flatMap((savedLog) => [
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
            try {
              toolText = JSON.stringify(JSON.parse(toolCall), null, 2);
            } catch {
              /* Render unstructured evidence as saved. */
            }
            return `Tool ${toolIndex + 1}:\n${toolText.length > 4000 ? `${toolText.slice(0, 4000)}… [truncated; see promptfoo output]` : toolText}`;
          }),
          "",
        ])
        .join("\n"),
    };
  }
}
