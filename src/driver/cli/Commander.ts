import yargs, { type Argv } from "yargs";
import { DomainFault } from "#hexagon/port/driver/ForManagingCharter.js";
import { COMMANDS } from "./commands/index.js";
import {
  EXIT_FAILURE,
  EXIT_OK,
  EXIT_USAGE,
  type AnyCommand,
  type Context,
  type OptionSpec,
  type Options,
  type Outcome,
} from "./commands/Command.js";

/**
 * DRIVER ADAPTER: the command line.
 *
 * Turns argv into one command call and its result into an exit code. It decides
 * nothing: a command says what to say and this writes it — results on stdout,
 * problems on stderr, so a pipeline can separate the two. yargs hands even its
 * own help and error text back here, so it lands the same way.
 *
 * A fault raised rather than reported lands here too. A use case reports what is
 * wrong with a charter and raises what leaves it nothing to work with — settings
 * that do not read, and a repository to set up again — so the user reads a
 * sentence and the next move rather than a stack trace (SC-003).
 */
export class Commander {
  readonly #context: Context;
  readonly #commands: readonly AnyCommand[];

  constructor(context: Context, commands: readonly AnyCommand[] = COMMANDS) {
    this.#context = context;
    this.#commands = commands;
  }

  async run(argv: readonly string[]): Promise<number> {
    // yargs gives a handler no way to return a value, so it lands here.
    let code = EXIT_OK;
    let failed = false;

    await this.#parser((outcome) => {
      code = outcome.code;
      if (outcome.result) process.stdout.write(outcome.result);
      if (outcome.problem) process.stderr.write(outcome.problem);
    }).parseAsync([...argv], {}, (error, _parsed, output) => {
      failed = error !== null && error !== undefined;
      if (output) (failed ? process.stderr : process.stdout).write(`${output}\n`);
    });

    return failed ? EXIT_USAGE : code;
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
      .version(this.#context.version)
      .wrap(80)
      .exitProcess(false);

    // A command whose name is two words — `vendor add <source>` — is a
    // subcommand, and yargs only knows one word: what follows it is read as
    // positional arguments. So the ones sharing a first word are registered
    // under it as a group of their own. What a command takes is not part of
    // that name: `explain <id>` is one word and an argument, and is
    // declared whole.
    const groups = new Map<string, AnyCommand[]>();
    for (const command of this.#commands) {
      const head = wordsOf(command.name)[0] as string;
      groups.set(head, [...(groups.get(head) ?? []), command]);
    }

    for (const [head, commands] of groups) {
      const [only] = commands;
      cli =
        commands.length === 1 && only !== undefined && wordsOf(only.name).length === 1
          ? this.#declaringCommand(cli, only, only.name, collect)
          : cli.command({
              command: head,
              // What the group is for is what its commands are: saying it any
              // other way would be a second description to keep in step.
              describe: commands.map((one) => wordsOf(one.name)[1]).join(", "),
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
        try {
          // The one cast in the adapter, and the reason it is here: yargs
          // parses into a bag of names, and what the command declared is what
          // says how to read it.
          collect(await command.run(this.#context, options as Options<OptionSpec>));
        } catch (raised) {
          if (!(raised instanceof DomainFault)) throw raised;
          collect({ code: EXIT_FAILURE, problem: `${raised.message}\n  ${raised.fix}\n` });
        }
      },
    });
  }
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
    const declared = {
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
      ? parser.positional(argument, declared)
      : parser.option(argument, declared);
  }, cli);
}
