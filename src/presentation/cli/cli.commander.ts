import yargs, { type Argv } from "yargs";
import { printFault, showPathsInApps } from "./commands/helper.js";
import { SETTINGS_FILE } from "#module/workspace/module.js";
import { COMMANDS } from "./commands/index.js";
import { EXIT_FAILURE, EXIT_OK, EXIT_USAGE, type AnyCommand, type CommandLine, type Context, type OptionSpec, type Options, type Outcome, type WorkspaceSettings } from "./commands/command.interface.js";

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

  async run(argv: readonly string[]): Promise<number> {
    // yargs gives a handler no way to return a value, so it lands here.
    let code = EXIT_OK;
    let isFailed = false;

    await this.#parser((outcome) => {
      code = outcome.code;
      if (outcome.result) process.stdout.write(outcome.result);
      if (outcome.problem) process.stderr.write(outcome.problem);
    }).parseAsync([...argv], {}, (error, _parsed, output) => {
      isFailed = error !== null && error !== undefined;
      if (output) (isFailed ? process.stderr : process.stdout).write(`${output}\n`);
    });

    return isFailed ? EXIT_USAGE : code;
  }

  #parser(collect: (outcome: Outcome) => void): Argv {
    let cli = yargs()
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
      const head = wordsOf(command.name)[0] as string;
      commandsByHead.set(head, [...(commandsByHead.get(head) ?? []), command]);
    }

    for (const [head, commands] of commandsByHead) {
      const [onlyCommand] = commands;
      cli =
        commands.length === 1 && onlyCommand !== undefined && wordsOf(onlyCommand.name).length === 1
          ? this.#declaringCommand(cli, onlyCommand, onlyCommand.name, collect)
          : cli.command({
              command: head,
              // What the group is for is what its commands are: saying it any
              // other way would be a second description to keep in step.
              describe: commands.map((groupedCommand) => wordsOf(groupedCommand.name)[1]).join(", "),
              builder: (child: Argv) =>
                commands
                  .reduce((parser, command) => this.#declaringCommand(parser, command, command.name.slice(head.length + 1), collect), child)
                  .demandCommand(1, ""),
              handler: () => undefined,
            });
    }

    return cli;
  }

  /** One command, said to yargs under the name it is typed by — the whole of it
   *  for a command that stands alone, what follows the group for one inside
   *  it. */
  #declaringCommand(cli: Argv, command: AnyCommand, name: string, collect: (outcome: Outcome) => void): Argv {
    return cli.command({
      command: name,
      describe: command.summary,
      builder: (child: Argv) => declaringArguments(child, command.options ?? {}, name),
      handler: async (options) => {
        // The one cast in the adapter, and the reason it is here: yargs
        // parses into a bag of names, and what the command declared is what
        // says how to read it. A refusal is an outcome like any other: every
        // use case answers its faults as DTOs, so nothing is caught here.
        const context = await contextOf(this.#commandLine, command);
        collect("code" in context ? context : await command.run(context, options as Options<OptionSpec>));
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
async function contextOf(commandLine: CommandLine, command: AnyCommand): Promise<Context | Outcome> {
  const workspaceSettingsDTO = await commandLine.workspaceApp.settings();
  const workspaceSettings: WorkspaceSettings = workspaceSettingsDTO.type === "Fault" ? { agents: [] } : workspaceSettingsDTO.data;
  const engineApps = showPathsInApps(commandLine.engineFactory(workspaceSettings), commandLine.cwd);
  // The layout first: a repository laid out the old way is told so whatever
  // its settings say, since moving it is what comes before anything else.
  const layoutAnswer = await engineApps.charterAuthoringApp.layout();
  if (layoutAnswer.type === "Fault") return { code: EXIT_FAILURE, problem: printFault(layoutAnswer) };
  if (workspaceSettingsDTO.type === "Fault" && command.name !== "init")
    return { code: EXIT_FAILURE, problem: `${SETTINGS_FILE}\n  error: ${workspaceSettingsDTO.data.message}\n    ${workspaceSettingsDTO.data.fix}\n` };
  return { ...commandLine, ...engineApps, engineFactory: (settings) => showPathsInApps(commandLine.engineFactory(settings), commandLine.cwd), workspaceSettings };
}

/** The words one command is typed by, without the arguments it takes: the name
 *  says where the command sits, and `<id>` is not a place. */
function wordsOf(name: string): readonly string[] {
  return name.split(" ").filter((word) => !word.startsWith("<") && !word.startsWith("["));
}

/**
 * One command's arguments, said to yargs. The one place the parser hears about
 * what a command takes, so a command declares it and names no parser.
 *
 * An argument the command's own name asks for — `vendor add <source>` — is a
 * positional and is declared as one, so it is typed where it is written rather
 * than offered as a flag beside itself.
 */
function declaringArguments(cli: Argv, options: OptionSpec, name: string): Argv {
  return Object.entries(options).reduce((parser, [argument, option]) => {
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
    return name.includes(`<${argument}>`) || name.includes(`[${argument}]`)
      ? parser.positional(argument, argumentDeclaration)
      : parser.option(argument, argumentDeclaration);
  }, cli);
}
