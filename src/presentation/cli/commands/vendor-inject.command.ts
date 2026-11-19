import {
  type Command,
  type Context,
  EXIT_OK,
  type OptionSpec,
  type Options,
  type Outcome,
} from "./command.interface.js";
import { formatMention, formatStatusLine, reportFault } from "./helper.js";

const OPTIONS = {
  source: {
    type: "string",
    describe: "What git fetches the charters from: an address over any transport, or a path on disk",
  },
  ref: {
    type: "string",
    describe: "The tag, branch or commit to pin to; the source's own default where none is named",
  },
  charter: {
    type: "string",
    isArray: true,
    describe:
      "A charter the source authored, by its name; typed once per charter, and every charter it authored where none is named. What a charter names of another charter of the source comes with it",
  },
  as: {
    type: "string",
    describe: "The name the one charter named is held under here; its own where none is given",
  },
} as const satisfies OptionSpec;

/** Copy a source's charters, and what they include, into the repository as
 *  charters of its own, with no `cw-vendor.json` (VENDOR-FR-022). */
export class VendorInjectCommand implements Command<typeof OPTIONS> {
  readonly name = "vendor inject <source>";
  readonly summary = "Copy charters from a git source into charters of this repository's own";
  readonly options = OPTIONS;

  async runCommand(
    { charterAuthoringApp }: Context,
    { source, ref, charter: charterNames, as: asName }: Options<typeof OPTIONS>,
  ): Promise<Outcome> {
    const vendorAddOutcomeDTO = await charterAuthoringApp.injectVendor(source ?? "", ref, charterNames, asName);
    if (vendorAddOutcomeDTO.type === "Fault") return reportFault(vendorAddOutcomeDTO);
    const vendorInstalls = vendorAddOutcomeDTO.data;
    return {
      exitCode: EXIT_OK,
      resultText: [
        ...vendorInstalls.flatMap(({ primitives }) =>
          primitives.map(({ data: { kind, id } }) =>
            formatStatusLine("good", `Injected ${kind} ${formatMention(id)}.`),
          ),
        ),
        'Run "cw build" to compile what it adds to this charter.',
        "",
      ].join("\n"),
      answerDTO: vendorAddOutcomeDTO,
    };
  }
}
