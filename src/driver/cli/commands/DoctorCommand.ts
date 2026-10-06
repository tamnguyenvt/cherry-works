import { printFaultsByFile } from "./helper.js";
import { EXIT_FAILURE, EXIT_OK, type Command, type Context, type Options, type Outcome } from "./Command.js";

/**
 * `cw doctor`: the four questions about this repository, asked in one command
 * (FR-040), and everything wrong with its charter written out under them
 * (FR-009, FR-010).
 *
 * Which agents it compiles for, whether its charter holds, whether an installed
 * charter has been edited here, and whether what agents read is still what the
 * charter compiles to. All four are `doctor()`'s answer, worked out behind the
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
 * same thing about one of these four questions and nothing about the other
 * three, and two commands answering one question differently is one command
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
  readonly summary = "Check this repository: agents, charter, vendors, and what is built";

  async run({ version, charterAuthoringApp }: Context, _options: Options): Promise<Outcome> {
    const {
      agents,
      errorCount: errors,
      warnCount: warnings,
      pendingCount: pending,
      faultsByFile,
      driftedVendors,
      problemCount,
      mainContexts,
      mainContextCeiling,
    } = (await charterAuthoringApp.doctor()).data;

    // Each answer is marked by what it asks of the developer: nothing, a step to
    // take, or a fault to fix. Coloured only on a terminal that takes colour, so
    // a report piped or pasted reads the same marks without escape codes.
    const isColoured = process.stdout.isTTY === true && process.env.NO_COLOR === undefined;
    const markByStanding = {
      good: isColoured ? "\x1b[32m✔\x1b[0m" : "✔",
      todo: isColoured ? "\x1b[33m⚠\x1b[0m" : "⚠",
      fault: isColoured ? "\x1b[31m✘\x1b[0m" : "✘",
    } as const;

    return {
      code: problemCount === 0 ? EXIT_OK : EXIT_FAILURE,
      result: [
        // Which cw wrote the report, so one pasted into a bug report names
        // the release it came from (FR-132).
        `cw ${version}`,
        // A repository that compiles for none is set up and building: the
        // neutral surface is compiled for everybody (FR-019).
        agents.length === 0
          ? `${markByStanding.good} Agents:   none chosen, so only the neutral surface is compiled.`
          : `${markByStanding.good} Agents:   ${agents.join(", ")}.`,
        errors > 0
          ? `${markByStanding.fault} Charter:  ${errors} error${errors === 1 ? "" : "s"}.`
          : warnings === 0
            ? `${markByStanding.good} Charter:  good.`
            : `${markByStanding.todo} Charter:  good, with ${warnings} warning${warnings === 1 ? "" : "s"}.`,
        driftedVendors.length === 0
          ? `${markByStanding.good} Vendors:  good.`
          : `${markByStanding.fault} Vendors:  edited here: ${driftedVendors.join(", ")}. Run "git checkout" under .cw/vendor/ to undo, or commit what you meant.`,
        pending === null
          ? `${markByStanding.fault} Built:    Fix the charter's errors, then run "cw build".`
          : pending === 0
            ? `${markByStanding.good} Built:    up to date.`
            : `${markByStanding.todo} Built:    ${pending} file${pending === 1 ? "" : "s"} out of date. Run "cw build".`,
        // What each agent opens a session with, held to the ceiling: past it is
        // a warning, and fails nothing (EVAL-FR-006).
        ...mainContexts.map(({ agent, totalTokens }) =>
          totalTokens > mainContextCeiling
            ? `${markByStanding.todo} Context:  ${agent} opens a session with about ${totalTokens.toLocaleString("en-US")} tokens, past the ceiling of ${mainContextCeiling.toLocaleString("en-US")}. Run "cw context" to see what takes the most.`
            : `${markByStanding.good} Context:  good (${agent} opens a session with about ${totalTokens.toLocaleString("en-US")} tokens, within the ceiling of ${mainContextCeiling.toLocaleString("en-US")}).`,
        ),
        // Every fault under the file that has to change, below the four lines
        // rather than inside them: a line says how many, and this says which
        // (FR-009).
        ...(Object.keys(faultsByFile.data.files).length === 0 ? [] : ["", printFaultsByFile(faultsByFile)]),
        problemCount === 0 ? "Nothing to fix." : `${problemCount} thing${problemCount === 1 ? "" : "s"} to fix.`,
        "",
      ].join("\n"),
    };
  }
}
