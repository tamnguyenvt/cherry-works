import { type Command, type Context, EXIT_OK, type Outcome } from "./command.interface.js";
import { formatHeading, formatMention, layAnswerRows, reportFault } from "./helper.js";

/**
 * `cw charter`: every charter this repository holds, each authored or
 * installed, an installed one with the source and the version its
 * `cw-package.json` names (VENDOR-FR-021).
 */
export class CharterCommand implements Command {
  readonly name = "charter";
  readonly summary = "List the charters this repository holds, authored or installed, with where each came from";

  async runCommand({ charterAuthoringApp }: Context): Promise<Outcome> {
    const chartersDTO = await charterAuthoringApp.listCharters();
    if (chartersDTO.type === "Fault") return reportFault(chartersDTO);
    const heldCharters = chartersDTO.data.charters.map(({ data: heldCharter }) => heldCharter);
    if (heldCharters.length === 0)
      return {
        exitCode: EXIT_OK,
        resultText:
          'No charter is held. Run "cw charter create <name>" to make one, or "cw charter pull <source>" to install one.\n',
        answerDTO: chartersDTO,
      };
    return {
      exitCode: EXIT_OK,
      resultText: [
        formatHeading("Charters"),
        ...layAnswerRows(
          heldCharters.map(({ name, isInstalled, source, version }) => [
            formatMention(name),
            isInstalled ? `installed  ${`${source ?? ""} ${version ?? ""}`.trim()}` : "authored",
          ]),
        ),
        "",
      ].join("\n"),
      answerDTO: chartersDTO,
    };
  }
}
