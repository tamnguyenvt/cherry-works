import { stripVTControlCharacters } from "node:util";
import yargs, { type Argv } from "yargs";
import { Parser } from "yargs/helpers";
import { settingsPath } from "#module/workspace/module.js";
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
import {
  isLaidOutCommand,
  listCommandWords,
  printFault,
  printFaultsByFile,
  printRunFault,
  RUNNING_HEAD_WORD,
  refuseCommand,
  showPathsInApps,
} from "./commands/helper.js";
import { COMMANDS } from "./commands/index.js";

/** The commands that write the settings, so are run where none are read yet
 *  (FR-037). */
const SETUP_COMMAND_NAMES: readonly string[] = ["init", "vendor init"];

/** What the help of `cw` itself opens with. */
const TOP_USAGE = "Usage: $0 <command> [options]";

/** The two sections `cw --help` lists the commands in (CORE-FR-243). */
const AUTHORING_HEADING = "Authoring the charter:";
const RUNNING_HEADING = "Running it:";

/** How wide the help is laid out, the sections as yargs lays out the rest. */
const HELP_WIDTH = 80;

/** The flag every command but the three `cw run` commands takes, to answer
 *  as data (CORE-FR-241). */
const JSON_OPTION_NAME = "json";

/** One name a command is typed by: its own, listed by the help, or the one it
 *  was typed by before, run alike and listed by none (CORE-FR-244). */
interface TypedCommand {
  readonly typedName: string;
  readonly command: AnyCommand;
  readonly isListed: boolean;
}

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

    // An answer is written in colour only to a terminal, with NO_COLOR not
    // set; anywhere else it is the same layout, every colour taken off. A
    // `cw run` command's is written as it said it (CORE-FR-238, CORE-FR-240).
    // With `--json`, standard output holds the answer the engine made, as it
    // is, and nothing else, faults included (CORE-FR-241, CORE-FR-242).
    const collectOutcome = (outcome: Outcome, isLaidOut: boolean, isJsonAnswer: boolean) => {
      exitCode = outcome.exitCode;
      if (isJsonAnswer) {
        // A command that ended on no answer of the engine's is refused as
        // data rather than leaving standard output no document at all.
        if (outcome.answerDTO === undefined) exitCode = EXIT_FAILURE;
        process.stdout.write(
          `${JSON.stringify(outcome.answerDTO ?? refuseCommand("NoAnswerFault", "This command answered nothing to print as data.", 'Run it again without "--json".'), null, 2)}\n`,
        );
        return;
      }
      const writeAnswer = (stream: NodeJS.WriteStream, answerText: string) =>
        stream.write(
          !isLaidOut || (stream.isTTY === true && process.env.NO_COLOR === undefined)
            ? answerText
            : stripVTControlCharacters(answerText),
        );
      if (outcome.resultText) writeAnswer(process.stdout, outcome.resultText);
      if (outcome.problemText) writeAnswer(process.stderr, outcome.problemText);
    };

    let cliParser: Argv = yargs()
      .scriptName("cw")
      .usage(TOP_USAGE)
      .demandCommand(1, "")
      .strict()
      // Turns a typo into a suggestion rather than a wall of usage.
      .recommendCommands()
      .help("help")
      .alias("h", "help")
      .version(this.#commandLine.version)
      .wrap(HELP_WIDTH)
      // Read as a flag wherever it is typed, before the command's name too;
      // each command taking it lists it in its own help (CORE-FR-241).
      .option(JSON_OPTION_NAME, { type: "boolean", hidden: true })
      .exitProcess(false);

    // A command whose name is two words — `vendor add <source>` — is a
    // subcommand, and yargs only knows one word: what follows it is read as
    // positional arguments. So the ones sharing a first word are registered
    // under it as a group of their own. What a command takes is not part of
    // that name: `explain <id>` is one word and an argument, and is
    // declared whole.
    const typedCommandsByHeadWord = new Map<string, TypedCommand[]>();
    for (const typedCommand of this.#commands.flatMap((command): TypedCommand[] => [
      { typedName: command.name, command, isListed: true },
      ...(command.deprecatedName === undefined
        ? []
        : [{ typedName: command.deprecatedName, command, isListed: false }]),
    ])) {
      const headWord = listCommandWords(typedCommand.typedName)[0] as string;
      typedCommandsByHeadWord.set(headWord, [...(typedCommandsByHeadWord.get(headWord) ?? []), typedCommand]);
    }

    for (const [headWord, typedCommands] of typedCommandsByHeadWord) {
      const [onlyTypedCommand] = typedCommands;
      const listedNameWords = typedCommands
        .filter((typedCommand) => typedCommand.isListed)
        .map((typedCommand) => listCommandWords(typedCommand.typedName)[1]);
      cliParser =
        typedCommands.length === 1 &&
        onlyTypedCommand !== undefined &&
        listCommandWords(onlyTypedCommand.typedName).length === 1
          ? this.#registerCommand(cliParser, onlyTypedCommand, onlyTypedCommand.typedName, collectOutcome)
          : cliParser.command({
              command: headWord,
              // What the group is for is what its commands are: saying it any
              // other way would be a second description to keep in step. A
              // group holding only names typed before is listed by no help.
              describe: listedNameWords.length === 0 ? false : listedNameWords.join(", "),
              builder: (childParser: Argv) =>
                typedCommands
                  .reduce(
                    (parser, typedCommand) =>
                      this.#registerCommand(
                        parser,
                        typedCommand,
                        typedCommand.typedName.slice(headWord.length + 1),
                        collectOutcome,
                      ),
                    childParser,
                  )
                  .demandCommand(1, ""),
              handler: () => undefined,
            });
    }

    // yargs lists commands under one heading; the help of `cw` itself lists
    // them in two sections: authoring the charter, each group on one line as
    // yargs lists it, and running it, each `cw run` command on a line of its
    // own; laid out in two columns as yargs lays out the rest (CORE-FR-243).
    // Each command's own help is left as yargs wrote it.
    const helpRowsBySection = new Map<string, [string, string][]>([
      [AUTHORING_HEADING, []],
      [RUNNING_HEADING, []],
    ]);
    for (const [headWord, typedCommands] of typedCommandsByHeadWord) {
      const listedCommands = typedCommands
        .filter((typedCommand) => typedCommand.isListed)
        .map((typedCommand) => typedCommand.command);
      const [onlyCommand] = listedCommands;
      if (headWord === RUNNING_HEAD_WORD)
        helpRowsBySection
          .get(RUNNING_HEADING)
          ?.push(...listedCommands.map((command): [string, string] => [`cw ${command.name}`, command.summary]));
      else if (
        listedCommands.length === 1 &&
        onlyCommand !== undefined &&
        listCommandWords(onlyCommand.name).length === 1
      )
        helpRowsBySection.get(AUTHORING_HEADING)?.push([`cw ${onlyCommand.name}`, onlyCommand.summary]);
      else if (listedCommands.length > 0)
        helpRowsBySection
          .get(AUTHORING_HEADING)
          ?.push([`cw ${headWord}`, listedCommands.map((command) => listCommandWords(command.name)[1]).join(", ")]);
    }
    const usageWidth =
      Math.max(...[...helpRowsBySection.values()].flat().map(([commandUsage]) => commandUsage.length)) + 2;
    const summaryWidth = HELP_WIDTH - 2 - usageWidth;
    const commandSectionsText = [...helpRowsBySection]
      .map(([sectionHeading, helpRows]) =>
        [
          sectionHeading,
          ...helpRows.map(([commandUsage, summary]) => {
            // Each summary wrapped by words into its column, as yargs wraps.
            const wrappedSummaryLines = summary.split(" ").reduce<string[]>((summaryLines, word) => {
              const lastLine = summaryLines.at(-1);
              if (lastLine !== undefined && lastLine.length + 1 + word.length <= summaryWidth)
                summaryLines[summaryLines.length - 1] = `${lastLine} ${word}`;
              else summaryLines.push(word);
              return summaryLines;
            }, []);
            return wrappedSummaryLines
              .map((summaryLine, lineIndex) =>
                `  ${(lineIndex === 0 ? commandUsage : "").padEnd(usageWidth)}${summaryLine}`.trimEnd(),
              )
              .join("\n");
          }),
        ].join("\n"),
      )
      .map((sectionText) => `${sectionText}\n\n`)
      .join("");

    // A refusal of the parser, typed with `--json` to a command taking it, is
    // answered as data too (CORE-FR-242); a `cw run` command, by any name it
    // is typed by, takes no `--json` and is refused in words (CORE-FR-240).
    // Read as yargs reads the flag: `--json`, `--json true`, `--json=1`.
    const typedArguments = Parser([...argv], { boolean: [JSON_OPTION_NAME] });
    const typedWords = typedArguments._.map(String);
    const isJsonTyped =
      typedArguments[JSON_OPTION_NAME] === true &&
      typedWords[0] !== RUNNING_HEAD_WORD &&
      !this.#commands.some(
        (command) =>
          !isLaidOutCommand(command) &&
          [command.name, command.deprecatedName].some(
            (typedName) =>
              typedName !== undefined &&
              listCommandWords(typedName).every((commandWord, wordIndex) => typedWords[wordIndex] === commandWord),
          ),
      );

    await cliParser.parseAsync([...argv], {}, (error, _parsed, output) => {
      isFailed = error !== null && error !== undefined;
      if (isFailed && isJsonTyped) {
        // What yargs refused of what was typed, in its words: a command
        // that throws as it runs rejects the parse, and never reaches here.
        process.stdout.write(
          `${JSON.stringify(
            refuseCommand(
              "UnreadArgumentsFault",
              error?.message || output,
              'Run "cw --help" to see what each command takes.',
            ),
            null,
            2,
          )}\n`,
        );
        return;
      }
      const shownText = output.startsWith(TOP_USAGE.replace("$0", "cw"))
        ? output.replace(/^Commands:\n[\s\S]*?\n\n(?=Options:)/m, commandSectionsText)
        : output;
      if (shownText) (isFailed ? process.stderr : process.stdout).write(`${shownText}\n`);
    });

    return isFailed ? EXIT_USAGE : exitCode;
  }

  /** One name a command is typed by, said to yargs — the whole of it for a
   *  command that stands alone, what follows the group for one inside it; a
   *  name typed before runs alike and is listed by no help (CORE-FR-244). */
  #registerCommand(
    cliParser: Argv,
    { command, isListed }: TypedCommand,
    typedCommandName: string,
    collectOutcome: (outcome: Outcome, isLaidOut: boolean, isJsonAnswer: boolean) => void,
  ): Argv {
    // The commands running what was built print as they always did, with no
    // layout and no colour, and take no `--json` (CORE-FR-240).
    const isLaidOut = isLaidOutCommand(command);
    const commandOptions: OptionSpec = isLaidOut
      ? {
          ...command.options,
          [JSON_OPTION_NAME]: {
            type: "boolean",
            describe: "Print the answer as one JSON document, and ask nothing",
            default: false,
          },
        }
      : (command.options ?? {});
    return cliParser.command({
      command: typedCommandName,
      describe: isListed ? command.summary : false,
      // The one place the parser hears what a command takes, so a command
      // declares it and names no parser. An argument the command's own name
      // asks for — `vendor add <source>` — is a positional, typed where it is
      // written rather than offered as a flag beside itself.
      builder: (childParser: Argv) =>
        Object.entries<OptionSpec[string]>(commandOptions).reduce((parser, [optionName, option]) => {
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
        // A `cw run` command is refused `--json`, naming it, before anything
        // runs (CORE-FR-240).
        if (!isLaidOut && options[JSON_OPTION_NAME] !== undefined)
          return collectOutcome(
            { exitCode: EXIT_USAGE, problemText: `Unknown argument: ${JSON_OPTION_NAME}\n` },
            isLaidOut,
            false,
          );
        // What the command runs with: the repository's settings, read by the
        // workspace module, and the engine composed for them, every address it
        // answers said as the path from where the command line runs
        // (CORE-FR-231, CORE-FR-214). Settings that do not read refuse every
        // command but setup, which writes them again (FR-037); a repository
        // laid out the old way refuses every one, naming the skill that moves
        // it (CORE-FR-226).
        const commandLine = this.#commandLine;
        const isJsonAnswer = options[JSON_OPTION_NAME] === true;
        const composeApplications = async () => {
          const { workspaceApp, engineApp } = await commandLine.composeApplications(isJsonAnswer);
          return { workspaceApp, engineApp: showPathsInApps(engineApp, commandLine.cwd) };
        };
        const { workspaceApp, engineApp } = await composeApplications();
        const workspaceSettingsDTO = await workspaceApp.readWorkspaceSettings();
        const workspaceSettings: WorkspaceSettings =
          workspaceSettingsDTO.type === "Fault" ? { agents: [] } : workspaceSettingsDTO.data;
        // The layout first: a repository laid out the old way is told so whatever
        // its settings say, since moving it is what comes before anything else.
        const charterLayoutDTO = await engineApp.charterAuthoringApp.readCharterLayout();
        if (charterLayoutDTO.type === "Fault")
          return collectOutcome(
            {
              exitCode: EXIT_FAILURE,
              problemText: isLaidOut ? printFault(charterLayoutDTO) : printRunFault(charterLayoutDTO),
              answerDTO: charterLayoutDTO,
            },
            isLaidOut,
            isJsonAnswer,
          );
        if (workspaceSettingsDTO.type === "Fault" && !SETUP_COMMAND_NAMES.includes(command.name))
          return collectOutcome(
            {
              exitCode: EXIT_FAILURE,
              problemText: isLaidOut
                ? printFaultsByFile({
                    type: "FaultsByFile",
                    data: { files: { [settingsPath.settingsFilePath]: [workspaceSettingsDTO] } },
                  })
                : `${settingsPath.settingsFilePath}\n  error: ${workspaceSettingsDTO.data.message}\n    ${workspaceSettingsDTO.data.fix}\n`,
              answerDTO: workspaceSettingsDTO,
            },
            isLaidOut,
            isJsonAnswer,
          );
        // Someone at the terminal is asked; with `--json` nobody is, as a
        // run with no terminal (CORE-FR-242).
        const context: Context = {
          ...commandLine,
          composeApplications,
          workspaceApp,
          ...engineApp,
          workspaceSettings,
          isAtTerminal: process.stdin.isTTY === true && !isJsonAnswer,
          isJsonAnswer,
        };
        // The one cast in the adapter, and the reason it is here: yargs
        // parses into a bag of names, and what the command declared is what
        // says how to read it. A refusal is an outcome like any other: every
        // use case answers its faults as DTOs, so nothing is caught here.
        collectOutcome(await command.runCommand(context, options as Options<OptionSpec>), isLaidOut, isJsonAnswer);
      },
    });
  }
}
