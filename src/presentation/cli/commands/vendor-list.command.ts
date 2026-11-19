import { type Command, type Context, EXIT_OK, type Outcome } from "./command.interface.js";
import { formatHeading, formatMention, layAnswerRows, reportFault } from "./helper.js";

/**
 * `cw vendor list`: every charter this repository installed, with the source
 * and the version its `cw-vendor.json` names (VENDOR-FR-021).
 */
export class VendorListCommand implements Command {
  readonly name = "vendor list";
  readonly summary = "List the charters this repository installed, with their source and version";

  async runCommand({ charterAuthoringApp }: Context): Promise<Outcome> {
    const chartersDTO = await charterAuthoringApp.listVendors();
    if (chartersDTO.type === "Fault") return reportFault(chartersDTO);
    const installedCharters = chartersDTO.data.charters.map(({ data: installedCharter }) => installedCharter);
    if (installedCharters.length === 0)
      return {
        exitCode: EXIT_OK,
        resultText: 'No charter is installed. Run "cw vendor add <source>" to install one.\n',
        answerDTO: chartersDTO,
      };
    return {
      exitCode: EXIT_OK,
      resultText: [
        formatHeading("Installed charters"),
        ...layAnswerRows(
          installedCharters.map(({ name, source, version }) => [
            formatMention(name),
            `${source ?? ""} ${version ?? ""}`.trim(),
          ]),
        ),
        "",
      ].join("\n"),
      answerDTO: chartersDTO,
    };
  }
}
