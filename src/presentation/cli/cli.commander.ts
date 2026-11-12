import yargs, { type Argv } from "yargs";
import { SETTINGS_FILE_PATH } from "#module/workspace/module.js";
import {
  type AnyCommand,
  type CommandLine,
  type Context,
  EXIT_FAILURE,
  EXIT_OK,
  EXIT_USAGE,
  type OptionSpec,
  type Options,
  type Outcome,
  type WorkspaceSettings,
} from "./commands/command.interface.js";
import { printFault, showPathsInApps } from "./commands/helper.js";
import { COMMANDS } from "./commands/index.js";

/**
 * DRIVER ADAPTER: the command line.
 *
 * Turns argv into one command call and its result into an exit code. It decides
 * nothing: a command says what to say and this writes it — results on stdout,
 * problems on stderr, so a pipeline can separate the two. yargs hands even its
 * own help and error text back here, so it lands the same way.
 *
 * A refusal is a result like any other: every use case answers what is wrong
 * as a DTO, and each command writes it as a sentence and the next move rather
 * than a stack trace (SC-003, SDK-FR-004).
 */
export class Commander {
  readonly #commandLine: CommandLine;
  readonly #commands: readonly AnyCommand[];

  constructor(commandLine: CommandLine, commands: readonly AnyCommand[] = COMMANDS) {
    this.#commandLine = commandLine;
    this.#commands = commands;
  }

  async runCommandLine(argv: readonly string[]): Promise<number> {
    // yargs gives a handler no way to return a value, so it lands here.
    let exitCode = EXIT_OK;
    let isFailed = false;

    await this.#buildParser((outcome) => {
      exitCode = outcome.exitCode;
      if (outcome.resultText) process.stdout.write(outcome.resultText);
      if (outcome.problemText) process.stderr.write(outcome.problemText);
    }).parseAsync([...argv], {}, (error, _parsed, output) => {
      isFailed = error !== null && error !== undefined;
      if (output) (isFailed ? process.stderr : process.stdout).write(`${output}\n`);
    });

    return isFailed ? EXIT_USAGE : exitCode;
  }

  #buildParser(collectOutcome: (outcome: Outcome) => void): Argv {
    let cliParser = yargs()
      .scriptName("cw")
      .usage("Usage: $0 <command> [options]")
      .demandCommand(1, "")
      .strict()
      // Turns a typo into a suggestion rather than a wall of usage.
      .recommendCommands()
      .help("help")
      .alias("h", "help")
      .version(this.#commandLine.version)
      .wrap(80)
      .exitProcess(false);

    // A command whose name is two words — `vendor add <source>` — is a
    // subcommand, and yargs only knows one word: what follows it is read as
    // positional arguments. So the ones sharing a first word are registered
    // under it as a group of their own. What a command takes is not part of
    // that name: `explain <id>` is one word and an argument, and is
    // declared whole.
    const commandsByHead = new Map<string, AnyCommand[]>();
    for (const command of this.#commands) {
      const headWord = listCommandWords(command.name)[0] as string;
      commandsByHead.set(headWord, [...(commandsByHead.get(headWord) ?? []), command]);
    }

    for (const [headWord, commands] of commandsByHead) {
      const [onlyCommand] = commands;
      cliParser =
        commands.length === 1 && onlyCommand !== undefined && listCommandWords(onlyCommand.name).length === 1
          ? this.#registerCommand(cliParser, onlyCommand, onlyCommand.name, collectOutcome)
          : cliParser.command({
              command: headWord,
              // What the group is for is what its commands are: saying it any
              // other way would be a second description to keep in step.
              describe: commands.map((groupedCommand) => listCommandWords(groupedCommand.name)[1]).join(", "),
              builder: (child: Argv) =>
                commands
                  .reduce(
                    (parser, command) =>
                      this.#registerCommand(parser, command, command.name.slice(headWord.length + 1), collectOutcome),
                    child,
                  )
                  .demandCommand(1, ""),
              handler: () => undefined,
            });
    }

    return cliParser;
  }

  /** One command, said to yargs under the name it is typed by — the whole of it
   *  for a command that stands alone, what follows the group for one inside
   *  it. */
  #registerCommand(
    cliParser: Argv,
    command: AnyCommand,
    typedCommandName: string,
    collectOutcome: (outcome: Outcome) => void,
  ): Argv {
    return cliParser.command({
      command: typedCommandName,
      describe: command.summary,
      // The one place the parser hears what a command takes, so a command
      // declares it and names no parser. An argument the command's own name
      // asks for — `vendor add <source>` — is a positional, typed where it is
      // written rather than offered as a flag beside itself.
      builder: (childParser: Argv) =>
        Object.entries<OptionSpec[string]>(command.options ?? {}).reduce((parser, [optionName, option]) => {
          const argumentDeclaration = {
            type: option.type,
            describe: option.describe,
            ...(option.alias === undefined ? {} : { alias: option.alias }),
            ...(option.default === undefined ? {} : { default: option.default }),
            // Typed once per value: yargs collects them, and a run that typed none
            // reads an empty list rather than nothing, so the command asks how many
            // were typed instead of whether any were.
            ...(option.isArray === undefined ? {} : { array: true, default: [] }),
          };
          return typedCommandName.includes(`<${optionName}>`) || typedCommandName.includes(`[${optionName}]`)
            ? parser.positional(optionName, argumentDeclaration)
            : parser.option(optionName, argumentDeclaration);
        }, childParser),
      handler: async (options) => {
        // The one cast in the adapter, and the reason it is here: yargs
        // parses into a bag of names, and what the command declared is what
        // says how to read it. A refusal is an outcome like any other: every
        // use case answers its faults as DTOs, so nothing is caught here.
        const context = await loadCommandContext(this.#commandLine, command);
        collectOutcome(
          "exitCode" in context ? context : await command.runCommand(context, options as Options<OptionSpec>),
        );
      },
    });
  }
}

/** What one command runs with: the repository's settings, read by the
 *  workspace module, and the engine composed for them, every address it answers said
 *  as the path from where the command line runs (CORE-FR-231, CORE-FR-214).
 *  Settings that do not read refuse every command but setup, which writes them
 *  again (FR-037); a repository laid out the old way refuses every one, naming
 *  the skill that moves it (CORE-FR-226). */
async function loadCommandContext(commandLine: CommandLine, command: AnyCommand): Promise<Context | Outcome> {
  const composeApplications = async () => {
    const { workspaceApp, engineApp } = await commandLine.composeApplications();
    return { workspaceApp, engineApp: showPathsInApps(engineApp, commandLine.cwd) };
  };
  const { workspaceApp, engineApp } = await composeApplications();
  const workspaceSettingsDTO = await workspaceApp.readWorkspaceSettings();
  const workspaceSettings: WorkspaceSettings =
    workspaceSettingsDTO.type === "Fault" ? { agents: [] } : workspaceSettingsDTO.data;
  // The layout first: a repository laid out the old way is told so whatever
  // its settings say, since moving it is what comes before anything else.
  const charterLayoutDTO = await engineApp.charterAuthoringApp.readCharterLayout();
  if (charterLayoutDTO.type === "Fault") return { exitCode: EXIT_FAILURE, problemText: printFault(charterLayoutDTO) };
  if (workspaceSettingsDTO.type === "Fault" && command.name !== "init")
    return {
      exitCode: EXIT_FAILURE,
      problemText: `${SETTINGS_FILE_PATH}\n  error: ${workspaceSettingsDTO.data.message}\n    ${workspaceSettingsDTO.data.fix}\n`,
    };
  return { ...commandLine, composeApplications, workspaceApp, ...engineApp, workspaceSettings };
}

/** The words one command is typed by, without the arguments it takes: the name
 *  says where the command sits, and `<id>` is not a place. */
function listCommandWords(name: string): readonly string[] {
  return name.split(" ").filter((word) => !word.startsWith("<") && !word.startsWith("["));
}
