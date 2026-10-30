import { CharterMd } from "../../models/output/common/CharterMd.js";
import { stamp } from "../../models/output/StampedDocument.js";
import { CHARTER_DIRECTORY } from "../../path.js";

/**
 * The orientation every reader of the charter gets: where the listings are,
 * and when each kind is to be opened, one line per kind read off the kind's own
 * class (FR-019).
 */
export function charterMdOf(
  kinds: readonly {
    readonly kind: string;
    readonly activatesWhen: string;
  }[],
): CharterMd {
  return new CharterMd(stamp(`${[
    "# Charter",
    `This repository is governed by a charter — the standards it authored under \`${CHARTER_DIRECTORY}/\`, which constrain whatever coding agent runs here. Every surface an agent reads, this file included, is generated from that charter: do not edit them, edit the primitive behind them.`,
    "## Read first",
    "Read [catalogue.json](./catalogue.json) for shared primitives and `catalogue.<provider>.json` linked from your host's entry file for primitives restricted to your provider. Entries are not repeated between these files. Each entry lists kind, id, description, file and globs. Use these two catalogues and open a file when its activation condition below is met.",
    "## When each kind applies",
    kinds.map((one) => `- **${one.kind}** — ${one.activatesWhen}.`).join("\n"),
    "## One id, one primitive",
    `An id names one primitive in the whole charter, whatever its kind: it is all a primitive is named by — bare in a header, a test or a command, and as \`[[<id>]]\` in a body, a sensor's \`run\` or an agent's \`tools\` — whether this repository authored it, installed it from a vendor, or the engine brought it. Nothing overrides anything — two files claiming one id is an error the charter refuses to build with.`,
  ].join("\n\n")}\n`));
}
