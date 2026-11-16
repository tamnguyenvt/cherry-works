import {
  type Command,
  type Context,
  EXIT_FAILURE,
  EXIT_OK,
  type OptionSpec,
  type Options,
  type Outcome,
} from "./command.interface.js";
import {
  formatHeading,
  formatMention,
  formatStatusLine,
  layAnswerRows,
  printFaultsByFile,
  printProblem,
  reportFault,
} from "./helper.js";

/** What `cw build` takes: whether the build lands, or is only said. One flag
 *  rather than a command of its own, because what is asked for is the same
 *  build either way (FR-022). */
const OPTIONS = {
  preview: {
    type: "boolean",
    describe: "Say what a build would do to each file, and write nothing",
    default: false,
  },
} as const satisfies OptionSpec;

/**
 * `cw build`: compile the charter and put it where each reader looks.
 *
 * The one command that writes — and under `--preview` the one that says what
 * writing would come to and touches nothing (FR-020, FR-022). What a build says
 * is what it did: how many files it put down, and every one it took away, since
 * a deletion is the surprising half and a build of forty files is not worth
 * listing. A preview lists every file all the same, each under what would happen
 * to it, since what is being asked for there is exactly that.
 *
 * A charter with an error builds nothing and previews nothing, and what is
 * wrong is written out here, under each file. Sending the user to `cw doctor`
 * instead left them nowhere when the fault was an mcp origin that could not be
 * reached: only a build reaches one, so doctor never saw it and sent them back.
 */
export class BuildCommand implements Command<typeof OPTIONS> {
  readonly name = "build";
  readonly summary = "Compile the charter into the files each agent reads";
  readonly options = OPTIONS;

  async runCommand({ charterBuildingApp }: Context, { preview: isPreview }: Options<typeof OPTIONS>): Promise<Outcome> {
    // What a build would do, every file it would touch under what would happen
    // to it, and how many of each (FR-022). The unchanged are said too — naming
    // none of them would leave a fully built repository saying nothing.
    if (isPreview) {
      const planSummaryDTO = await charterBuildingApp.previewCharterBuild();
      if (planSummaryDTO.type === "Fault") return reportFault(planSummaryDTO);

      if (planSummaryDTO.type === "FaultsByFile") {
        const faultyFileCount = Object.keys(planSummaryDTO.data.files).length;
        return {
          exitCode: EXIT_FAILURE,
          problemText: `${printProblem(`Nothing was previewed: ${faultyFileCount} file${faultyFileCount === 1 ? " has" : "s have"} errors.`)}\n${printFaultsByFile(planSummaryDTO)}`,
          answerDTO: planSummaryDTO,
        };
      }

      const {
        added: addedPaths,
        edited: editedPaths,
        deleted: deletedPaths,
        unchanged: unchangedPaths,
      } = planSummaryDTO.data;
      // A file a build would change is a step to take; one it would leave
      // as it is, nothing.
      const changeRows = [
        ...addedPaths.map((path) => [formatStatusLine("todo", "create"), formatMention(path)] as const),
        ...editedPaths.map((path) => [formatStatusLine("todo", "update"), formatMention(path)] as const),
        ...deletedPaths.map((path) => [formatStatusLine("todo", "delete"), formatMention(path)] as const),
        ...unchangedPaths.map((path) => [formatStatusLine("good", "unchanged"), formatMention(path)] as const),
      ];

      // A preview fails while anything would change, so a pipeline can gate on a
      // charter built and committed (FR-034).
      return {
        exitCode: changeRows.length === unchangedPaths.length ? EXIT_OK : EXIT_FAILURE,
        resultText: [
          ...(planSummaryDTO.data.warnings ?? []).map((warning) => formatStatusLine("todo", `Warning: ${warning}`)),
          ...layAnswerRows(changeRows),
          // The count closes the list, as a total does, rather than heading it.
          `${changeRows.length} file${changeRows.length === 1 ? "" : "s"}: ${addedPaths.length} create, ${editedPaths.length} update, ${deletedPaths.length} delete, ${unchangedPaths.length} unchanged.`,
          "",
        ].join("\n"),
        answerDTO: planSummaryDTO,
      };
    }

    const planSummaryDTO = await charterBuildingApp.buildCharter();
    if (planSummaryDTO.type === "Fault") return reportFault(planSummaryDTO);

    if (planSummaryDTO.type === "FaultsByFile") {
      const faultyFileCount = Object.keys(planSummaryDTO.data.files).length;
      return {
        exitCode: EXIT_FAILURE,
        problemText: `${printProblem(`Nothing was built: ${faultyFileCount} file${faultyFileCount === 1 ? " has" : "s have"} errors.`)}\n${printFaultsByFile(planSummaryDTO)}`,
        answerDTO: planSummaryDTO,
      };
    }

    const { added: addedPaths, edited: editedPaths, deleted: deletedPaths } = planSummaryDTO.data;
    const writtenFileCount = addedPaths.length + editedPaths.length;
    // What each agent will open a session with, in one line (EVAL-FR-005).
    const mainContextsDTO = await charterBuildingApp.predictMainContext();
    const mainContexts = mainContextsDTO.type === "MainContexts" ? mainContextsDTO.data.contexts : [];
    return {
      exitCode: EXIT_OK,
      resultText: [
        ...(planSummaryDTO.data.warnings ?? []).map((warning) => formatStatusLine("todo", `Warning: ${warning}`)),
        formatHeading(
          formatStatusLine(
            "good",
            `Built ${writtenFileCount} file${writtenFileCount === 1 ? "" : "s"}: ${addedPaths.length} added, ${editedPaths.length} changed.`,
          ),
        ),
        ...layAnswerRows(deletedPaths.map((path) => ["deleted", `${formatMention(path)}, whose primitive is gone`])),
        ...mainContexts.map(
          ({ data: { agent, totalTokens } }) =>
            `${agent} opens a session with about ${totalTokens.toLocaleString("en-US")} tokens of the charter, estimated. Run "cw context" for each primitive's share.`,
        ),
        "",
      ].join("\n"),
      answerDTO: planSummaryDTO,
    };
  }
}
