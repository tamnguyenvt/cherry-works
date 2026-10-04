import {
  EXIT_FAILURE,
  EXIT_OK,
  type Command,
  type Context,
  type OptionSpec,
  type Options,
  type Outcome,
} from "./Command.js";

/** What `cw build` takes: whether the build lands, or is only said. One flag
 *  rather than a command of its own, because what is asked for is the same
 *  build either way (FR-022). */
const BUILDING = {
  preview: {
    type: "boolean",
    describe: "Say what a build would do to each file, and write nothing",
    default: false,
  },
} as const satisfies OptionSpec;

type Building = typeof BUILDING;

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
 * A charter with an error builds nothing and previews nothing. What is wrong is
 * not repeated here: `cw doctor` is the command that says it, in full and
 * under each file, and sending the user there is one line rather than two
 * commands saying the same thing differently.
 */
export class BuildCommand implements Command<Building> {
  readonly name = "build";
  readonly summary = "Compile the charter into the files each agent reads";
  readonly options = BUILDING;

  async run({ charterAuthoringApp }: Context, { preview }: Options<Building>): Promise<Outcome> {
    // What a build would do, every file it would touch under what would happen
    // to it, and how many of each (FR-022). The unchanged are said too — naming
    // none of them would leave a fully built repository saying nothing.
    if (preview) {
      const planSummaryDTO = await charterAuthoringApp.preview();

      if (planSummaryDTO.type === "FaultsByFile") {
        const noOfFiles = Object.keys(planSummaryDTO.data.files).length;
        return {
          code: EXIT_FAILURE,
          problem: `Nothing was previewed: ${noOfFiles} file${noOfFiles === 1 ? " has" : "s have"} errors.\nRun "cw doctor" to see what is wrong with them.\n`,
        };
      }

      const { added, edited, deleted, unchanged } = planSummaryDTO.data;
      const changes = [
        ...added.map((path) => ["create", path] as const),
        ...edited.map((path) => ["update", path] as const),
        ...deleted.map((path) => ["delete", path] as const),
        ...unchanged.map((path) => ["unchanged", path] as const),
      ];

      return {
        code: EXIT_OK,
        result: [
          ...changes.map(([change, path]) => `  ${change.padEnd("unchanged".length)}  ${path}`),
          `${changes.length} file${changes.length === 1 ? "" : "s"}: ${added.length} create, ${edited.length} update, ${deleted.length} delete, ${unchanged.length} unchanged.`,
          "",
        ].join("\n"),
      };
    }

    const planSummaryDTO = await charterAuthoringApp.build();

    if (planSummaryDTO.type === "FaultsByFile") {
      const noOfFiles = Object.keys(planSummaryDTO.data.files).length;
      return {
        code: EXIT_FAILURE,
        problem: `Nothing was built: ${noOfFiles} file${noOfFiles === 1 ? " has" : "s have"} errors.\nRun "cw doctor" to see what is wrong with them.\n`,
      };
    }

    const { added, edited, deleted } = planSummaryDTO.data;
    const wrote = added.length + edited.length;
    // What each agent will open a session with, in one line (EVAL-FR-005).
    const mainContextsDTO = await charterAuthoringApp.predictMainContext(false);
    const mainContexts = mainContextsDTO.type === "MainContexts" ? mainContextsDTO.data.contexts : [];
    return {
      code: EXIT_OK,
      result: [
        `Built ${wrote} file${wrote === 1 ? "" : "s"}: ${added.length} added, ${edited.length} changed.`,
        ...deleted.map((path) => `  deleted ${path}, whose primitive is gone`),
        ...mainContexts.map(
          ({ data: { agent, totalTokens } }) =>
            `${agent} opens a session with about ${totalTokens.toLocaleString("en-US")} tokens of the charter, estimated. Run "cw context" for each primitive's share.`,
        ),
        "",
      ].join("\n"),
    };
  }
}
