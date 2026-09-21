import { BasePrimitive, CommonHeaders, headersOf, type RequiredHeaders } from "./BasePrimitive.js";

/** A unit of work an agent can be asked to carry out, by name or by what it
 *  says it is for (FR-004). */
export class CommandPrimitive extends BasePrimitive<CommonHeaders> {
  static readonly kind = "command" as const;
  readonly kind = CommandPrimitive.kind;

  /** What this kind requires beyond the common headers: nothing. Declared all
   *  the same, since what a file is scaffolded with is read off this (FR-039). */
  static override readonly requires = {} as const satisfies RequiredHeaders;

  /** The schema its headers are read by: what `headersOf` refuses a file
   *  against, and what says the shape of every header this kind takes, required
   *  or not (FR-004). */
  static override readonly schema = CommonHeaders;

  /** When a reader of this charter is to open this kind at all, said
   *  where the kind's contract is: the neutral surface lists one
   *  line per kind and none of them is written down twice (FR-002). */
  static readonly activatesWhen = "it is asked for by name, or a request matches what it describes itself as being for";

  /** A command as an author writes one: what a refused header is fixed with. */
  static readonly sample: CommonHeaders = {
    id: "release",
    description: "Cut a release from the main branch.",
  };

  /** One command, or every fault its headers have. Nothing beyond what every
   *  primitive declares: a command is asked for by name, and the one line it
   *  describes itself with is what decides that it is the one being asked for. */
  static of(record: Readonly<Record<string, unknown>>, body: string): CommandPrimitive {
    return new CommandPrimitive(headersOf(CommandPrimitive, CommonHeaders, record), body);
  }
}
