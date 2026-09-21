import { pathToFileURL } from "node:url";
import type { ForManagingCharter } from "#hexagon/port/driver/ForManagingCharter.js";
import type { ForVendoringCharters } from "#hexagon/port/driver/ForVendoringCharters.js";

/** What every command is run with: where it runs, and the use cases the hexagon
 *  offers. Held by the command line and handed over at execution, so a command
 *  is a declaration and nothing it has to be constructed with. */
export interface Context {
  readonly cwd: string;
  /** What the engine offers, whichever use case a command reaches for. */
  readonly charterAuthoringApp: ForManagingCharter;
  /** What it offers for the charters this repository did not author: installing
   *  one is a different conversation from reading one, and a command reaches for
   *  whichever it is having. */
  readonly charterVendoringApp: ForVendoringCharters;
}

/** What a command did: the exit status, and what the user reads.
 *
 *  Text rather than a call to something that prints. A command says what it has
 *  to say; where that goes is the command line's own business, and the command
 *  line is the terminal — it has no need of a port to reach one. */
export interface Outcome {
  readonly code: number;
  /** What was asked for. */
  readonly result?: string;
  /** What went wrong, and the next move after it (SC-003). */
  readonly problem?: string;
}

/** The three things an argument can be worth. */
export type OptionType = "string" | "number" | "boolean";

/** What one of those is worth once parsed. */
type Valued<Type extends OptionType> = Type extends "string"
  ? string
  : Type extends "number"
    ? number
    : boolean;

/** One argument, declared as data rather than as a call into a parser: a
 *  command says what it takes, and turning that into flags is the command
 *  line's arithmetic. A default is what the option is worth when it is not
 *  typed; declaring none means it can be absent, and the type says so. */
interface Declared<Type extends OptionType> {
  readonly type: Type;
  readonly describe: string;
  readonly default?: Valued<Type>;
  readonly alias?: string;
  /** Worth a list rather than one value, typed once per entry:
   *  `--header a=1 --header b=2`. What the command reads is every value in the
   *  order they were typed, and an empty list when none was, so it is never
   *  absent and never defaulted. */
  readonly isArray?: true;
}

/** One argument, whichever of the three it is worth. A number never defaults to
 *  a word, because the two are declared together. */
export type Option = Declared<"string"> | Declared<"number"> | Declared<"boolean">;

/** Everything one command takes, under the names it is typed by. */
export type OptionSpec = Readonly<Record<string, Option>>;

/** A command that takes nothing. */
export type NoOptions = Record<string, never>;

/** What a command reads when it runs: its own declaration, turned into values.
 *  An option declared with a default is always there; one without it may not
 *  be, and has to be checked before it is used. Nothing else is in here — a name
 *  the command never declared does not compile. */
export type Options<Spec extends OptionSpec = NoOptions> = {
  readonly [Name in keyof Spec]: Spec[Name] extends { readonly isArray: true }
    ? readonly Valued<Spec[Name]["type"]>[]
    : Spec[Name] extends { readonly default: unknown }
      ? Valued<Spec[Name]["type"]>
      : Valued<Spec[Name]["type"]> | undefined;
};

/** One command: what it is called, what it is for, what it takes, and what it
 *  does.
 *
 *  It names no parser. Which one reads the arguments is the command line's
 *  business, and swapping it is a change in one file rather than in every
 *  command.
 *
 *  The reader/writer split (FR-041) is not declared here either. It falls out of
 *  the application service a command reaches for: one constructed without a
 *  writing port cannot write, whoever calls it. */
export interface Command<Spec extends OptionSpec = NoOptions> {
  readonly name: string;
  readonly summary: string;
  /** The arguments this command takes. `Options` is read off this, so declaring
   *  one is what makes it readable in `run` — under its own name, at its own
   *  type. */
  readonly options?: Spec;
  /** The context first: every command is run with one, while arguments are what
   *  a command may or may not take. Never calls `process.exit`, so the whole
   *  CLI stays testable in-process. */
  run(context: Context, options: Options<Spec>): Promise<Outcome> | Outcome;
}

/** A command whatever it takes. What a table of them holds: each one's
 *  arguments are its own, and a list cannot name one type for all of them. The
 *  type is checked where a command is written and where its arguments are read
 *  — the two places it says anything. */
export type AnyCommand = Command<any>;

/** Where the command was run, as the hexagon takes a repository: a directory,
 *  so it ends in a separator. Every use case resolves the charter and the files
 *  it compiles against this, and a URL naming a file rather than a directory
 *  would put both beside the repository instead of inside it. */
export function repoPathOf(cwd: string): URL {
  return pathToFileURL(`${cwd}/`);
}

export const EXIT_OK = 0;
export const EXIT_FAILURE = 1;
export const EXIT_USAGE = 2;
