import { type Command, type Context, EXIT_FAILURE, EXIT_OK, type Options, type Outcome } from "./command.interface.js";
import { formatHeading, formatStatusLine, layAnswerRows, printFaultsByFile, reportFault } from "./helper.js";

/**
 * `cw doctor`: the three questions about this repository, asked in one command
 * (FR-040), and everything wrong with its charter written out under them
 * (FR-009, FR-010).
 *
 * Which agents it chose, whether its charter holds, and whether what agents
 * read is still what the charter compiles to. All three are `diagnoseCharter()`'s answer, worked out behind the
 * port — how many are unwell included — so this command and the portal's
 * health check say one thing, nothing here is a second opinion, and staleness
 * in particular is the preview run rather than a record kept of it.
 *
 * The agents are the repository's own answer and not a search of this machine:
 * whether claude is installed here is no business of a charter's (T104), so
 * what is reported is what the repository chose and a repository that chose
 * none is told what that means rather than failed for it.
 *
 * It is also where a fault is read. There was a `cw validate` that said the
 * same thing about one of these three questions and nothing about the other
 * two, and two commands answering one question differently is one command
 * too many: what is wrong with the charter is written out here, by `printFaultsByFile`,
 * which is what a fault says rather than how this prints it (SC-003).
 *
 * Every question is asked even when an earlier one is unwell, since the point
 * of one command is one report; the exit status fails on any of them, so a
 * pipeline reads the whole picture and gates on it (FR-010).
 *
 * The whole report is what was asked for, so all of it goes to the result —
 * faults included. A charter with errors is not this command going wrong: it
 * ran, and this is what it found.
 */
export class DoctorCommand implements Command {
  readonly name = "doctor";
  readonly summary = "Check this repository: agents, charter, installed charters, and what is built";

  async runCommand({ version, charterBuildingApp }: Context, _options: Options): Promise<Outcome> {
    const doctorOutcomeDTO = await charterBuildingApp.diagnoseCharter();
    if (doctorOutcomeDTO.type === "Fault") return reportFault(doctorOutcomeDTO);
    const {
      agents,
      errorCount,
      warnCount,
      pendingCount,
      faultsByFile,
      problemCount,
      mainContexts,
      mainContextCeiling,
    } = doctorOutcomeDTO.data;

    // Each answer is marked by what it asks of the developer: nothing, a step
    // to take, or a fault to fix — its label and value in one column with the
    // others'.
    const agentsRow = [
      formatStatusLine("good", "Agents:"),
      // A repository that chose none is set up and building: the
      // neutral surface is compiled for everybody (FR-019).
      agents.length === 0 ? "none chosen, so only the neutral surface is compiled." : `${agents.join(", ")}.`,
    ] as const;
    const charterRow =
      errorCount > 0
        ? ([formatStatusLine("fault", "Charter:"), `${errorCount} error${errorCount === 1 ? "" : "s"}.`] as const)
        : warnCount === 0
          ? ([formatStatusLine("good", "Charter:"), "good."] as const)
          : ([
              formatStatusLine("todo", "Charter:"),
              `good, with ${warnCount} warning${warnCount === 1 ? "" : "s"}.`,
            ] as const);
    const builtRow =
      pendingCount === null
        ? ([formatStatusLine("fault", "Built:"), `Fix the charter's errors, then run "cw build".`] as const)
        : pendingCount === 0
          ? ([formatStatusLine("good", "Built:"), "up to date."] as const)
          : ([
              formatStatusLine("todo", "Built:"),
              `${pendingCount} file${pendingCount === 1 ? "" : "s"} out of date. Run "cw build".`,
            ] as const);
    // What each agent opens a session with, held to the ceiling: past it is
    // a warning, and fails nothing (EVAL-FR-006).
    const contextRows = mainContexts.map(({ agent, totalTokens }) =>
      totalTokens > mainContextCeiling
        ? ([
            formatStatusLine("todo", "Context:"),
            `${agent} opens a session with about ${totalTokens.toLocaleString("en-US")} tokens, past the ceiling of ${mainContextCeiling.toLocaleString("en-US")}. Run "cw context" to see what takes the most.`,
          ] as const)
        : ([
            formatStatusLine("good", "Context:"),
            `good (${agent} opens a session with about ${totalTokens.toLocaleString("en-US")} tokens, within the ceiling of ${mainContextCeiling.toLocaleString("en-US")}).`,
          ] as const),
    );

    return {
      exitCode: problemCount === 0 ? EXIT_OK : EXIT_FAILURE,
      resultText: [
        // Which cw wrote the report, so one pasted into a bug report names
        // the release it came from (FR-132).
        formatHeading(`cw ${version}`),
        ...layAnswerRows([agentsRow, charterRow, builtRow, ...contextRows], ""),
        // Every fault under the file that has to change, below the three lines
        // rather than inside them: a line says how many, and this says which
        // (FR-009).
        ...(Object.keys(faultsByFile.data.files).length === 0
          ? []
          : ["", formatHeading("To fix, by file"), printFaultsByFile(faultsByFile)]),
        problemCount === 0
          ? formatStatusLine("good", "Nothing to fix.")
          : formatStatusLine("fault", `${problemCount} thing${problemCount === 1 ? "" : "s"} to fix.`),
        "",
      ].join("\n"),
      answerDTO: doctorOutcomeDTO,
    };
  }
}
