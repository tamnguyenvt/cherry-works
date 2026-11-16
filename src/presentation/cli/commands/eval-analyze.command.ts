import {
  type Command,
  type Context,
  EXIT_FAILURE,
  EXIT_OK,
  type OptionSpec,
  type Options,
  type Outcome,
} from "./command.interface.js";
import { formatHeading, formatMention, formatStatusLine, layAnswerRows, printFault } from "./helper.js";

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
          formatHeading(
            formatStatusLine(
              savedLog.success ? "good" : "fault",
              `${savedLog.success ? "PASS" : "FAIL"} ${savedLog.agent} | ${savedLog.createdAt} | ${savedLog.totalTokens.toLocaleString("en-US")} tokens`,
            ),
          ),
          // Each fact of the run in one column, what it holds in another.
          ...layAnswerRows(
            [
              ["Prompt:", savedLog.prompt],
              ...savedLog.unmetReasons.map((reason) => ["Reason:", reason] as const),
              ...(savedLog.error === undefined ? [] : [["Provider error:", savedLog.error] as const]),
              ["Log:", formatMention(savedLog.logPath)],
              ["Promptfoo output:", formatMention(savedLog.outputPath)],
              ["stdout:", formatMention(savedLog.stdoutPath)],
              ["stderr:", formatMention(savedLog.stderrPath)],
              [
                "Agent session:",
                savedLog.sessionId === undefined ? "not returned by provider" : formatMention(savedLog.sessionId),
              ],
              [
                "Session log:",
                savedLog.sessionPath === undefined ? "not found locally" : formatMention(savedLog.sessionPath),
              ],
            ],
            "",
          ),
          formatHeading("Answer:"),
          savedLog.answer || "(no answer)",
          formatHeading(`Tool evidence (${savedLog.toolCalls.length}):`),
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
