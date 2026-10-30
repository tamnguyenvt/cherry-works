import { EXIT_OK, type Command, type Context, type OptionSpec, type Options, type Outcome } from "./Command.js";

const OPTIONS = {
  source: {
    type: "string",
    describe: "What git fetches the charter or the skills from: an address over any transport, or a path on disk",
  },
  ref: {
    type: "string",
    describe: "The tag, branch or commit to pin to; the source's own default where none is named",
  },
  charter: {
    type: "string",
    isArray: true,
    describe: "A charter to pick from the source's charters/ folder, by its name; typed once per charter, each copied into this repository's own charter",
  },
  skill: {
    type: "string",
    isArray: true,
    describe: "A skill to take from the source's skills/ folder, by its name; typed once per skill, and every skill it holds where none is named",
  },
} as const satisfies OptionSpec;

/** Copy a source into the repository's editable charter (CORE Story 34). */
export class VendorInjectCommand implements Command<typeof OPTIONS> {
  readonly name = "vendor inject <source>";
  readonly summary = "Copy a charter or skills into this repository's own charter";
  readonly options = OPTIONS;

  async run({ charterVendoringApp }: Context, { source, ref, charter, skill }: Options<typeof OPTIONS>): Promise<Outcome> {
    const vendorInstalls = (await charterVendoringApp.inject(source ?? "", ref, skill, charter)).data;
    return {
      code: EXIT_OK,
      result: [
        ...vendorInstalls.flatMap(({ primitives }) => primitives.map(({ data: { kind, id, leftOutHeaders } }) =>
          `Injected ${kind} ${id}${leftOutHeaders.length === 0 ? "" : `, leaving out ${leftOutHeaders.join(", ")}: the charter has no field for them`}.`,
        )),
        'Run "cw build" to compile what it adds to this charter.',
        "",
      ].join("\n"),
    };
  }
}
