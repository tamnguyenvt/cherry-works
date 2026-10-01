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
    `[catalog.json](./catalog.json) — the kind, identity, description and file of every primitive this charter holds, with its globs. Survey it to find what you need, and open a file only once its activation condition below is met.`,
    "## When each kind applies",
    kinds.map((one) => `- **${one.kind}** — ${one.activatesWhen}.`).join("\n"),
    "## One identity, one primitive",
    `An identity names one primitive in the whole charter: \`kind:id\`, whether this repository authored it, installed it from a vendor, or the engine brought it. Nothing overrides anything — two files claiming one identity is an error the charter refuses to build with.`,
  ].join("\n\n")}\n`));
}
